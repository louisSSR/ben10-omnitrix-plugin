"""Merge individually reviewed additions without losing them on snapshot re-import."""
from pathlib import Path
import base64, hashlib, io, json, re, struct, subprocess, sys
from PIL import Image
from art_files import hydrate_svg, externalize_svg
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
IDENTITY_FIELDS = ('id', 'name', 'en', 'group', 'appearance', 'aliases', 'sourceUrls')

def require(condition, message):
    if not condition:
        raise ValueError(message)


def https_source(value):
    if not isinstance(value, str) or any(char.isspace() for char in value):
        return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme == 'https' and bool(parsed.hostname)
    except ValueError:
        return False


def merge_extra_art(catalog, svg_bytes, provenance):
    svg_bytes = hydrate_svg(svg_bytes, ROOT / 'assets')
    registry = ROOT / 'assets/extra-art.json'
    if not registry.exists():
        return catalog, svg_bytes, provenance
    plan = json.loads(registry.read_text(encoding='utf-8'))
    extras = plan['assets']
    svg = svg_bytes.decode('utf-8')
    forms = {form['id']: form for form in catalog['forms']}
    new_forms = plan.get('newForms', [])
    require(isinstance(new_forms, list), 'Invalid newForms list')
    new_ids = set()
    for row in new_forms:
        require(isinstance(row, dict) and set(row) == set(IDENTITY_FIELDS), 'Invalid new form identity fields')
        key = row['id']
        require(isinstance(key, str) and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key), 'Invalid new form ID')
        require(key not in new_ids, 'Duplicate new form ID: '+key)
        new_ids.add(key)
        require(row['name'] is None or isinstance(row['name'], str) and row['name'].strip(), 'Invalid new form name: '+key)
        require(all(isinstance(row[field], str) and row[field].strip() for field in ('en', 'appearance')), 'Invalid new form label: '+key)
        require(isinstance(catalog.get('groups'), dict) and isinstance(row['group'], str) and row['group'] in catalog['groups'], 'Unknown new form group: '+key)
        require(isinstance(row['aliases'], list) and all(isinstance(alias, str) and alias.strip() for alias in row['aliases']), 'Invalid new form aliases: '+key)
        require(isinstance(row['sourceUrls'], list) and row['sourceUrls'] and all(https_source(url) for url in row['sourceUrls']), 'Invalid new form HTTPS sources: '+key)
        if key in forms:
            require(all(forms[key].get(field) == row[field] for field in IDENTITY_FIELDS), 'Conflicting new form identity: '+key)
        else:
            # Identity alone never makes a selectable silhouette. The reviewed
            # art loop below is the only path that assigns an asset.
            form = {**row, 'aliases': row['aliases'].copy(), 'sourceUrls': row['sourceUrls'].copy(), 'asset': None}
            catalog['forms'].append(form)
            forms[key] = form
    seen = set()
    for entry in extras:
        key = entry['formId']
        require(key in forms and key not in seen and re.fullmatch(r'[a-z0-9-]+', key), 'Unknown or duplicate form: '+key)
        seen.add(key)
        require(entry.get('sourceViewed') is True and entry.get('maskViewed') is True, 'Unreviewed art: '+key)
        raw = {}
        for kind in ('source', 'mask'):
            relative = entry[kind+'File']
            file = (ROOT / relative).resolve()
            require(file.is_relative_to((ROOT / 'assets/source-art').resolve()), 'Invalid art path: '+key)
            raw[kind] = file.read_bytes()
            require(hashlib.sha256(raw[kind]).hexdigest() == entry[kind+'Sha256'], 'Hash mismatch: '+key+' '+kind)
        mask = raw['mask']
        require(len(mask) >= 33 and mask[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid PNG: '+key)
        width,height = struct.unpack('>II', mask[16:24])
        require(0 < width <= 8192 and 0 < height <= 8192 and mask[24] == 8 and mask[25] in (3,6) and mask[28] == 0, 'Unsupported PNG: '+key)
        # Validate checksum/structure and decode every pixel BEFORE any outputs
        # are written. Reading only IHDR permits a truncated image into the SVG.
        with Image.open(io.BytesIO(mask)) as pic:
            pic.verify()
        with Image.open(io.BytesIO(mask)) as pic:
            pic.load()
            require(pic.mode == 'RGBA' or (pic.mode == 'P' and 'transparency' in pic.info), 'Missing alpha: '+key)
            # Decode palette transparency for validation only; embed original bytes.
            require(pic.size == (width,height) and pic.convert('RGBA').getchannel('A').getextrema()[1] > 0, 'Empty or invalid body: '+key)
        symbol_id = 'alien-' + key
        symbol = '<symbol id="'+symbol_id+'" viewBox="0 0 200 240"><image href="data:image/png;base64,'+base64.b64encode(mask).decode('ascii')+'" width="200" height="240"/></symbol>'
        pattern = r'<symbol\b[^>]*id="'+re.escape(symbol_id)+r'"[^>]*>[\s\S]*?</symbol>'
        matches = re.findall(pattern, svg)
        require(len(matches) <= 1, 'Duplicate SVG symbol: '+key)
        if matches:
            require(matches[0] == symbol, 'Existing symbol differs: '+key)
        else:
            require(svg.endswith('</svg>') or svg.endswith('</svg>\n'), 'Unclosed SVG')
            svg = svg.replace('</svg>', symbol+'</svg>')
        form = forms[key]
        form['asset'] = symbol_id
        form['visualSourceUrls'] = [entry['pageUrl']]
        form['artSourceLabel'] = ('AI reference edit; not official original' if entry['renderMode'] == 'reference-guided-edit-alpha' else 'Community reference; source and silhouette inspected')
        form['artProvenance'] = entry['artProvenance']
        asset = {field: entry[field] for field in ('formId','url','pageUrl','rights','renderMode','sourceSha256','maskSha256')}
        asset['contentType'] = 'image/png'
        provenance['assets'] = [item for item in provenance['assets'] if item['formId'] != key] + [asset]
    for merge in plan.get('mergedForms', []):
        source = forms.get(merge['from'])
        target = forms[merge['into']]
        aliases = target.setdefault('aliases', [])
        require(merge['from'] != merge['into'], 'Cannot merge a form into itself')
        for alias in [merge['from']] + ([source['en'], *source.get('aliases', [])] if source else []):
            if alias not in aliases:
                aliases.append(alias)
        if source:
            require(source['appearance'] == target['appearance'] and not source.get('asset'), 'Conflicting form merge: '+merge['from'])
            target['sourceUrls'] = list(dict.fromkeys(target.get('sourceUrls', []) + source.get('sourceUrls', [])))
            catalog['forms'].remove(source)
    count = sum(bool(form.get('asset')) for form in catalog['forms'])
    catalog['coverage'] = {'total':len(catalog['forms']), 'reviewed':count, 'missing':len(catalog['forms'])-count}
    provenance['coverage'] = catalog['coverage'].copy()
    svg_bytes = svg.encode('utf-8')
    provenance['svgSha256'] = hashlib.sha256(svg_bytes).hexdigest()
    provenance['supplementalRegistry'] = 'assets/extra-art.json'
    return catalog, svg_bytes, provenance

if __name__ == '__main__':
    catalog_path = ROOT / 'assets/catalog.json'
    svg_path = ROOT / 'assets/silhouettes.svg'
    provenance_path = ROOT / 'assets/provenance.json'
    values = merge_extra_art(json.loads(catalog_path.read_text(encoding='utf-8')), svg_path.read_bytes(), json.loads(provenance_path.read_text(encoding='utf-8')))
    catalog, svg, provenance = values
    svg = externalize_svg(svg, ROOT / 'assets')
    provenance['svgSha256'] = hashlib.sha256(svg).hexdigest()
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    svg_path.write_bytes(svg)
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
    subprocess.run([sys.executable, str(ROOT/'scripts/fit-dial.py')], check=True)
    print(json.dumps(catalog['coverage']))
