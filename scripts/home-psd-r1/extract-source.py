"""Pin observed PSD facts separately from authored crosswalk candidates. No media export."""
from pathlib import Path
from io import BytesIO
from collections import Counter
import argparse
import hashlib
import json
import math
import psd_tools
from psd_tools import PSDImage
from PIL import Image

HERE = Path(__file__).resolve().parent
POLICY = json.loads((HERE / 'policy.json').read_text(encoding='utf8'))
WEIGHTS = {'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800}
sha = lambda data: hashlib.sha256(data).hexdigest()
u16 = lambda value: len(value.encode('utf-16-le')) // 2


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')


def color(value):
    return '#' + ''.join(f'{round(float(v) * 255):02X}' for v in value)


def descriptor_rgb(value):
    return '#' + ''.join(f'{round(float(value[k])):02X}' for k in [b'Rd  ', b'Grn ', b'Bl  '])


def text_record(layer):
    raw, transform = layer.text, list(layer.transform)
    scale = math.hypot(transform[2], transform[3])
    runs, offset = [], 0
    for run in layer.typesetting.runs:
        s, value = run.style, run.text
        suffix = s.font_name.split('-')[-1]
        if suffix not in WEIGHTS or not s.font_name.startswith('Pretendard-'):
            raise ValueError('HOME_PSD_FONT_UNSUPPORTED:' + s.font_name)
        leading = float(s.leading)
        if s.auto_leading:
            leading = s.font_size * layer.typesetting.default_paragraph_style.auto_leading
        if leading <= 0 or scale <= 0:
            raise ValueError('HOME_PSD_TEXT_METRICS_INVALID:' + str(layer.layer_id))
        end = offset + u16(value)
        runs.append({'startUtf16': offset, 'endUtf16': end, 'rawText': value,
                     'fontName': s.font_name, 'fontWeight': WEIGHTS[suffix],
                     'fontSize': float(s.font_size), 'leading': leading, 'autoLeading': bool(s.auto_leading),
                     'effectiveFontSizeY': s.font_size * scale, 'effectiveLeadingY': leading * scale,
                     'tracking': s.tracking, 'trackingEm': s.tracking / 1000,
                     'fillColorArgb': list(s.fill_color), 'sourceColor': color(s.fill_color[1:]),
                     'fauxBold': bool(s.faux_bold), 'fauxItalic': bool(s.faux_italic),
                     'fontCaps': int(s.font_caps), 'horizontalScale': s.horizontal_scale,
                     'verticalScale': s.vertical_scale, 'baselineShift': s.baseline_shift})
        offset = end
    if ''.join(r['rawText'] for r in runs) != raw or offset != u16(raw):
        raise ValueError('HOME_PSD_UTF16_COVERAGE:' + str(layer.layer_id))
    paragraphs, offset = [], 0
    for p in layer.typesetting.paragraphs:
        end = offset + u16(p.text)
        paragraphs.append({'startUtf16': offset, 'endUtf16': end, 'rawText': p.text,
                           'justification': int(p.style.justification), 'autoLeading': p.style.auto_leading,
                           'firstLineIndent': p.style.first_line_indent, 'startIndent': p.style.start_indent,
                           'endIndent': p.style.end_indent, 'spaceBefore': p.style.space_before,
                           'spaceAfter': p.style.space_after, 'autoHyphenate': p.style.auto_hyphenate})
        offset = end
    if ''.join(p['rawText'] for p in paragraphs) != raw:
        raise ValueError('HOME_PSD_PARAGRAPH_COVERAGE:' + str(layer.layer_id))
    return {'sourceLayerId': layer.layer_id, 'sourceKey': POLICY['sourceSha256'] + ':' + str(layer.layer_id),
            'rawText': raw, 'sourceTextDigest': sha(raw.encode()), 'bbox': list(layer.bbox),
            'textType': int(layer.text_type), 'writingDirection': int(layer.typesetting.writing_direction),
            'warp': {'style': layer.warp[b'warpStyle'].enum.decode('ascii'),
                     'value': float(layer.warp[b'warpValue']), 'perspective': float(layer.warp[b'warpPerspective']),
                     'perspectiveOther': float(layer.warp[b'warpPerspectiveOther'])},
            'transform': transform, 'baselineOrigin': transform[4:], 'layerOpacity': layer.opacity,
            'paragraphs': paragraphs, 'runs': runs}


def shape_record(layer):
    origins = []
    for o in layer.origination:
        radii = getattr(o, 'radii', None)
        origins.append({'originType': int(o.origin_type), 'bbox': list(o.bbox),
                        'radii': [float(radii[k]) for k in [b'topLeft', b'topRight', b'bottomRight', b'bottomLeft']] if radii else None})
    stroke, paint = layer.tagged_blocks.get_data(b'vstk'), layer.tagged_blocks.get_data(b'vscg')
    if not stroke or not paint:
        raise ValueError('HOME_PSD_SHAPE_PAINT_UNRESOLVED:' + str(layer.layer_id))
    return {'sourceLayerId': layer.layer_id, 'origins': origins, 'layerOpacity': layer.opacity,
            'fillEnabled': bool(stroke[b'fillEnabled']), 'sourceFill': descriptor_rgb(paint[b'Clr ']),
            'strokeEnabled': bool(stroke[b'strokeEnabled']), 'strokeWidth': float(stroke[b'strokeStyleLineWidth']),
            'sourceStroke': descriptor_rgb(stroke[b'strokeStyleContent'][b'Clr ']),
            'vectorPaths': [{'operation': int(path.operation), 'closed': path.is_closed(),
                             'knots': [{'precedingYX': list(k.preceding), 'anchorYX': list(k.anchor), 'leavingYX': list(k.leaving)} for k in path]}
                            for path in layer.vector_mask.paths]}


def extract(source, root):
    if psd_tools.__version__ != '1.26.1':
        raise ValueError('HOME_PSD_EXTRACTOR_VERSION_MISMATCH:' + psd_tools.__version__)
    if sha(source.read_bytes()) != POLICY['sourceSha256']:
        raise ValueError('HOME_PSD_SOURCE_MISMATCH')
    psd = PSDImage.open(source)
    layers = list(psd.descendants())
    if psd.size != (1920, 9003) or psd.depth != 8 or len(layers) != 131:
        raise ValueError('HOME_PSD_STRUCTURE_MISMATCH')
    by_id = {l.layer_id: l for l in layers}
    if len(by_id) != len(layers):
        raise ValueError('HOME_PSD_DUPLICATE_LAYER_ID')
    inventory, texts, shapes, assets = [], {}, {}, {}
    for order, layer in enumerate(layers):
        siblings = list(layer.parent)
        index = siblings.index(layer)
        parent = getattr(layer.parent, 'layer_id', None)
        clip = None
        if layer.clipping:
            base = index - 1
            while base >= 0 and siblings[base].clipping:
                base -= 1
            if base < 0:
                raise ValueError('HOME_PSD_CLIP_BASE_MISSING')
            clip = siblings[base].layer_id
        inventory.append({'layerId': layer.layer_id, 'sourceKey': POLICY['sourceSha256'] + ':' + str(layer.layer_id),
                          'painterOrder': order, 'siblingOrder': index, 'parentLayerId': parent,
                          'childLayerIds': [c.layer_id for c in layer] if layer.is_group() else [],
                          'kind': layer.kind, 'name': layer.name, 'bbox': list(layer.bbox),
                          'visible': layer.visible, 'effectiveVisible': layer.is_visible(),
                          'opacity': layer.opacity, 'blendMode': layer.blend_mode.value.decode('ascii'),
                          'clipping': bool(layer.clipping), 'clipBaseLayerId': clip})
        if layer.kind == 'type':
            texts[str(layer.layer_id)] = text_record(layer)
        if layer.kind == 'shape':
            shapes[str(layer.layer_id)] = shape_record(layer)
        if layer.kind == 'smartobject':
            obj = layer.smart_object
            data = obj.data
            size = list(Image.open(BytesIO(data)).size) if obj.filetype in ['png', 'jpg', 'jpeg'] else None
            assets[str(layer.layer_id)] = {'sourceLayerId': layer.layer_id, 'embeddedFileName': obj.filename,
                 'fileType': obj.filetype, 'byteLength': len(data), 'sha256': sha(data),
                 'gitBlobSha': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest(),
                 'intrinsicSize': size, 'transformBox': list(obj.transform_box), 'clipBaseLayerId': clip}
    for entry in POLICY['mediaMappings']:
        if assets[str(entry['layerId'])]['clipBaseLayerId'] != entry['clipLayerId']:
            raise ValueError('HOME_PSD_CLIP_MAPPING_CONFLICT')
    for key, ids in POLICY['textMappings'].items():
        if any(str(i) not in texts or not texts[str(i)]['rawText'] for i in ids):
            raise ValueError('HOME_PSD_TEXT_MAPPING_MISSING:' + key)
    crosswalk = []
    for layer in inventory:
        lid = layer['layerId']
        text_keys = [k for k, ids in POLICY['textMappings'].items() if lid in ids]
        media = next((m for m in POLICY['mediaMappings'] if lid in [m['layerId'], m['clipLayerId']]), None)
        shape = POLICY['shapeMappings'].get(str(lid))
        top = layer['bbox'][1]
        section = next((s[0] for s in POLICY['sectionCandidates'] if s[1] <= top < s[2]), None)
        crosswalk.append({'sourceLayerId': lid, 'candidateSectionId': section,
                          'sectionEvidence': 'Y_RANGE_CANDIDATE_NOT_SOURCE_PARENT',
                          'figmaTextKeys': text_keys, 'mediaMapping': media, 'shapeMapping': shape,
                          'mappingStatus': 'AUTHORED_SEMANTIC_CROSSWALK' if text_keys or media or shape else 'UNMAPPED',
                          'disposition': POLICY['dispositions'].get(str(lid), 'CF4_CANDIDATE' if text_keys else 'SOURCE_ONLY')})
    resolution, guides = psd.image_resources.get_data(1005), psd.image_resources.get_data(1032)
    profile = psd.image_resources.get_data(1039)
    manifest = {'schema': 'SMD_HOME_PSD_SOURCE_V1', 'baseCommit': POLICY['baseCommit'],
                'psdFileName': source.name, 'psdSha256': POLICY['sourceSha256'], 'byteLength': source.stat().st_size,
                'width': psd.width, 'height': psd.height, 'depth': psd.depth, 'colorMode': psd.color_mode.name,
                'iccSha256': sha(profile), 'sourceLayerCount': len(layers), 'kindCounts': dict(Counter(l.kind for l in layers)),
                'extractor': 'psd-tools@' + psd_tools.__version__, 'policySha256': sha((HERE / 'policy.json').read_bytes()),
                'resolution': {k: getattr(resolution, k) for k in ['horizontal', 'vertical', 'horizontal_unit', 'vertical_unit', 'width_unit', 'height_unit']},
                'guides': [{'position32': pos, 'positionPx': pos / 32, 'direction': direction} for pos, direction in guides.data],
                'sectionCandidates': [{'id': s, 'top': a, 'bottom': b, 'authority': 'AUTHORED_CANDIDATE_NOT_PSD_GROUP'} for s, a, b in POLICY['sectionCandidates']],
                'operationalExceptions': POLICY['operationalExceptions']}
    frozen = {'manifest': manifest, 'layers': inventory, 'texts': texts, 'shapes': shapes, 'assets': assets, 'crosswalk': crosswalk}
    dump(root / 'docs/migration/smd-home-psd-r1/source-manifest.json', frozen)
    for filename, symbol, value in [('home-psd-r1-manifest.ts', 'homePsdR1Source', manifest),
                                    ('home-psd-r1-copy.generated.ts', 'homePsdSourceText', texts),
                                    ('home-psd-r1-mapping.ts', 'homePsdTextMappings', POLICY['textMappings'])]:
        path = root / 'app/data' / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('/** Generated by scripts/home-psd-r1/extract-source.py; raw source is immutable. */\nexport const ' + symbol + ' = ' + json.dumps(value, ensure_ascii=False, indent=2) + ' as const;\n', encoding='utf8')
    print(json.dumps({'tier': 'SOURCE', 'layers': len(layers), 'texts': len(texts), 'shapes': len(shapes), 'smartObjects': len(assets)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--root', default=str(HERE.parents[1]))
    args = parser.parse_args()
    extract(Path(args.source), Path(args.root))
