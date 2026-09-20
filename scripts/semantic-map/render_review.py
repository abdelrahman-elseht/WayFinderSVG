"""Render candidate contours over A's cleaned vector master for independent QA."""
from pathlib import Path
import json, html
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'data/buildings/B03/GF.json').read_text(encoding='utf-8'))
base=Image.open(ROOT/'maps/B03/GF/inspection/master.png').convert('RGBA')
layer=Image.new('RGBA',base.size); draw=ImageDraw.Draw(layer)
x,y,w,h=data['floor']['viewBox']; sx=base.width/w; sy=base.height/h
def pt(p):return ((p[0]-x)*sx,(p[1]-y)*sy)
# Pillow's bundled font keeps this evidence overlay portable and repeatable.
font=ImageFont.load_default(size=13)
graph=json.loads((ROOT/'data/buildings/B03/GF.graph.json').read_text(encoding='utf-8'))
for area in graph['navigableAreas']:
 draw.polygon([pt(p) for p in area],fill=(30,155,225,30))
for r in data['rooms']:
 hue=int(r['code'][-2:]); color=((hue*71)%180+30,(hue*97)%160+40,(hue*53)%170+40)
 if r['polygon']:draw.polygon([pt(p) for p in r['polygon']],fill=(*color,64),outline=(*color,220),width=2)
 p=pt(r['centroid']); label=r['code']+(' ?' if not r['polygon'] else '')
 draw.ellipse([p[0]-3,p[1]-3,p[0]+3,p[1]+3],fill=(220,50,20,255) if not r['polygon'] else (*color,255))
 box=draw.textbbox((p[0]+5,p[1]-8),label,font=font);draw.rectangle(box,fill=(255,255,255,230));draw.text((p[0]+5,p[1]-8),label,fill=(20,25,45,255),font=font)
for edge in graph['edges']:
 draw.line([pt(p) for p in edge['geometry']],fill=(215,90,0,255),width=3)
for node in graph['nodes']:
 p=pt(node['point']);draw.ellipse([p[0]-4,p[1]-4,p[0]+4,p[1]+4],fill=(255,190,50,255),outline=(150,70,0,255))
draw.rectangle((10,10,650,42),fill=(255,255,255,235))
draw.text((18,18),'Orange routes | blue navigation area | ? unresolved footprint | access unknown',font=font,fill=(30,35,50,255))
Image.alpha_composite(base,layer).convert('RGB').save(ROOT/'data/buildings/B03/GF.semantic-review.png')
print('Rendered data/buildings/B03/GF.semantic-review.png')
