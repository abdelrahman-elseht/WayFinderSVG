"""Render candidate contours over A's cleaned vector master for independent QA."""
from pathlib import Path
import json, html
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_context import selection
selected = selection()
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/f'data/buildings/{selected.building}/{selected.floor}.json').read_text(encoding='utf-8'))
base=Image.open(ROOT/f'maps/{selected.building}/{selected.floor}/inspection/master.png').convert('RGBA')
layer=Image.new('RGBA',base.size); draw=ImageDraw.Draw(layer)
x,y,w,h=data['floor']['viewBox']; sx=base.width/w; sy=base.height/h
def pt(p):return ((p[0]-x)*sx,(p[1]-y)*sy)
# Pillow's bundled font keeps this evidence overlay portable and repeatable.
font=ImageFont.load_default(size=13)
graph=json.loads((ROOT/f'data/buildings/{selected.building}/{selected.floor}.graph.json').read_text(encoding='utf-8'))
for area in graph['navigableAreas']:
 draw.polygon([pt(p) for p in area],fill=(30,155,225,30))
for r in data['rooms']:
 hue=int(r['code'][-2:]); color=((hue*71)%180+30,(hue*97)%160+40,(hue*53)%170+40)
 footprint=r['polygon'] or r.get('displayFootprint',{}).get('polygon')
 if footprint:draw.polygon([pt(p) for p in footprint],fill=(*color,64),outline=(*color,220),width=2)
 p=pt(r['centroid']); label=r['code']+(' D' if r.get('displayFootprint') else ' ?' if not footprint else '')
 draw.ellipse([p[0]-3,p[1]-3,p[0]+3,p[1]+3],fill=(220,50,20,255) if not r['polygon'] else (*color,255))
 box=draw.textbbox((p[0]+5,p[1]-8),label,font=font);draw.rectangle(box,fill=(255,255,255,230));draw.text((p[0]+5,p[1]-8),label,fill=(20,25,45,255),font=font)
for feature in data.get('mapFeatures',[]):
 draw.polygon([pt(p) for p in feature['polygon']],fill=(60,90,160,80),outline=(30,50,100,230),width=2)
for edge in graph['edges']:
 draw.line([pt(p) for p in edge['geometry']],fill=(215,90,0,255),width=3)
for node in graph['nodes']:
 p=pt(node['point']);draw.ellipse([p[0]-4,p[1]-4,p[0]+4,p[1]+4],fill=(255,190,50,255),outline=(150,70,0,255))
draw.rectangle((10,10,650,42),fill=(255,255,255,235))
draw.text((18,18),'Orange routes | blue navigation | D display only | ? open/unresolved | access unknown',font=font,fill=(30,35,50,255))
output=ROOT/f'data/buildings/{selected.building}/{selected.floor}.semantic-review.png'
Image.alpha_composite(base,layer).convert('RGB').save(output)
print(f'Rendered {output.relative_to(ROOT)}')
