"""Store image bytes unchanged next to the SVG, with content-addressed local paths."""
from pathlib import Path
import base64,hashlib,re

LOCAL=re.compile(r'runtime/([a-f0-9]{64})\.(png|avif)')
DATA=re.compile(r'data:image/(png|avif);base64,([A-Za-z0-9+/=]+)')
HREF=re.compile(r'(<image\b[^>]*\bhref=")([^"]+)(")')

def image_bytes(href, assets):
    data=DATA.fullmatch(href)
    if data:
        return base64.b64decode(data[2],validate=True),data[1]
    local=LOCAL.fullmatch(href)
    if not local:raise ValueError('Invalid local image reference')
    folder=(assets/'runtime').resolve();file=(assets/href).resolve()
    if not folder.is_relative_to(assets.resolve()) or file.parent!=folder or file.is_symlink():raise ValueError('Image path escapes assets')
    raw=file.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=local[1]:raise ValueError('Local image hash mismatch')
    return raw,local[2]

def hydrate_svg(svg_bytes,assets):
    def replace(match):
        raw,kind=image_bytes(match[2],assets)
        return match[1]+'data:image/'+kind+';base64,'+base64.b64encode(raw).decode('ascii')+match[3]
    return HREF.sub(replace,svg_bytes.decode('utf-8')).encode('utf-8')

def externalize_svg(svg_bytes,assets):
    files={}
    def replace(match):
        raw,kind=image_bytes(match[2],assets)
        name=hashlib.sha256(raw).hexdigest()+'.'+kind
        files[name]=raw
        return match[1]+'runtime/'+name+match[3]
    svg=HREF.sub(replace,svg_bytes.decode('utf-8')).encode('utf-8')
    folder=assets/'runtime'
    if folder.is_symlink() or (folder.exists() and not folder.is_dir()):raise ValueError('Invalid runtime asset directory')
    # Check every existing destination before creating anything; never repair a
    # corrupt content-addressed file by silently replacing its original bytes.
    for name,raw in files.items():
        p=folder/name
        if p.is_symlink() or (p.exists() and (not p.is_file() or p.read_bytes()!=raw)):raise ValueError('Runtime image destination conflicts')
    folder.mkdir(exist_ok=True)
    for name,raw in files.items():
        p=folder/name
        if not p.exists():
            with p.open('xb') as out:out.write(raw)
    return svg
