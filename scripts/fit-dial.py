"""Measure existing embedded alpha masks. Never modify image pixels or source bytes."""
from pathlib import Path
import json,re,base64,io,hashlib
import xml.etree.ElementTree as ET
from PIL import Image
from art_files import hydrate_svg

SVG='{http://www.w3.org/2000/svg}'
SAFE_RADIUS=.87
# Reserve one unit on each axis for image sampling at the dial's render size.
# This is an envelope margin, not a threshold that discards faint source pixels.
LEGACY_SAMPLING_MARGIN=2


def legacy_envelope(symbol, filters):
    """Evaluate the existing sRGB LUT filter without creating/editing a bitmap."""
    image=symbol.find(SVG+'image')
    assert image is not None and len(symbol)==1, symbol.attrib['id']
    assert 'transform' not in image.attrib
    assert image.attrib.get('preserveAspectRatio')=='xMidYMid meet'
    encoded=image.attrib['href']
    assert encoded.startswith('data:image/avif;base64,')
    filter_id=re.fullmatch(r'url\(#([^)]+)\)',image.attrib['filter'])[1]
    filter_node=filters[filter_id]
    assert filter_node.attrib['color-interpolation-filters']=='sRGB'
    assert [child.tag for child in filter_node]==[SVG+'feComponentTransfer',SVG+'feColorMatrix']
    matrix=filter_node.find(SVG+'feColorMatrix')
    assert matrix.attrib['type']=='matrix'
    assert [float(v) for v in matrix.attrib['values'].split()]==[0]*15+[1,1,1,0,0]
    transfer=filter_node.find(SVG+'feComponentTransfer')
    assert [child.tag for child in transfer]==[SVG+'feFuncR',SVG+'feFuncG',SVG+'feFuncB']
    tables=[]
    for channel in transfer:
        assert channel.attrib['type']=='table'
        table=[float(v) for v in channel.attrib['tableValues'].split()]
        # 8-bit source components land exactly on these 256 table entries.
        assert len(table)==256 and all(0<=v<=1 for v in table)
        zeros=[index for index,value in enumerate(table) if value==0]
        # Transparent colors form one interval per channel. Averaging only
        # transparent neighbors cannot introduce a visible island during resize.
        assert zeros and zeros==list(range(zeros[0],zeros[-1]+1))
        tables.append(table)
    with Image.open(io.BytesIO(base64.b64decode(encoded.split(',',1)[1]))) as pic:
        assert pic.format=='AVIF' and pic.mode=='RGB'
        width,height=pic.size
        rgb=pic.tobytes()
    box_width,box_height=(float(image.attrib[key]) for key in ('width','height'))
    ratio=min(box_width/width,box_height/height)
    origin_x=float(image.attrib.get('x',0))+(box_width-width*ratio)/2
    origin_y=float(image.attrib.get('y',0))+(box_height-height*ratio)/2
    extent=0
    visible=0
    for index in range(width*height):
        r,g,b=rgb[index*3:index*3+3]
        # feColorMatrix alpha = clamp(R' + G' + B', 0, 1). Keep *all*
        # positive alpha, including faint edge pixels; no cosmetic threshold.
        if tables[0][r]+tables[1][g]+tables[2][b]<=0:
            continue
        visible+=1
        x=origin_x+(index%width+.5)*ratio
        y=origin_y+(index//width+.5)*ratio
        extent=max(extent,(abs(x-100)+abs(y-120)+ratio+LEGACY_SAMPLING_MARGIN)/120)
    assert visible, symbol.attrib['id']
    return extent,visible,{'sourceImageSize':[width,height],
                           'resamplingMargin':LEGACY_SAMPLING_MARGIN,
                           'filterId':filter_id}


root=Path(__file__).resolve().parents[1]
svg_bytes=(root/'assets/silhouettes.svg').read_bytes()
svg=hydrate_svg(svg_bytes,root/'assets').decode('utf-8')
svg_tree=ET.fromstring(svg)
symbols={node.attrib['id']:node for node in svg_tree.iter(SVG+'symbol')}
filters={node.attrib['id']:node for node in svg_tree.iter(SVG+'filter')}
catalog_path=root/'assets/catalog.json'
catalog=json.loads(catalog_path.read_text(encoding='utf-8'))
fits={}
for form in catalog['forms']:
    if not form.get('asset'):
        continue
    match=re.search(r'<symbol\b[^>]*id="'+re.escape(form['asset'])+r'"[^>]*>(.*?)</symbol>',svg,re.S)
    assert match,form['id']
    image=re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)',match[1])
    assert symbols[form['asset']].attrib['viewBox']=='0 0 200 240'
    detail={}
    if image:
        raw=base64.b64decode(image[1])
        with Image.open(io.BytesIO(raw)) as pic:
            width,height=pic.size
            alpha=pic.convert('RGBA').getchannel('A')
            points=[(index%width,index//width) for index,value in enumerate(alpha.tobytes()) if value>0]
        assert points,form['id']
        # SVG meet in a square dial: source width 200 is centered in 240.
        # Include each opaque pixel's full square, not just its center.
        ratio=min(200/width,240/height)
        origin_x=(200-width*ratio)/2
        origin_y=(240-height*ratio)/2
        extent=max((abs(origin_x+(x+.5)*ratio-100)+abs(origin_y+(y+.5)*ratio-120)+ratio)/120 for x,y in points)
        pixels=len(points)
        method='native-png-alpha-diamond-envelope'
    else:
        extent,pixels,detail=legacy_envelope(symbols[form['asset']],filters)
        method='legacy-avif-filter-diamond-envelope'
    scale=min(.93,SAFE_RADIUS/extent)
    scale=int(scale*10000)/10000
    assert scale*extent<=SAFE_RADIUS+1e-6
    fit={'scale':scale,'method':method,'diamondExtent':round(extent,6),'visiblePixels':pixels,**detail}
    form['dialFit']=fit
    fits[form['id']]=fit
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
provenance_path=root/'assets/provenance.json'
provenance=json.loads(provenance_path.read_text(encoding='utf-8'))
# Fit metadata changes the catalog bytes; bind provenance to the final catalog.
provenance['catalogSha256']=hashlib.sha256(catalog_path.read_bytes()).hexdigest()
provenance_path.write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf-8')
report={'sourceSvgSha256':hashlib.sha256(svg_bytes).hexdigest(),'shapeCount':len(fits),'safeDiamondRadius':SAFE_RADIUS,'bitmapEdits':0,'fits':fits}
(root/'assets/dial-fit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'forms':len(fits),'alphaMeasured':sum(f['method'].startswith('native') for f in fits.values()),'filterMeasured':sum(f['method'].startswith('legacy') for f in fits.values()),'minScale':min(f['scale'] for f in fits.values()),'maxScale':max(f['scale'] for f in fits.values()),'bitmapEdits':0}))
