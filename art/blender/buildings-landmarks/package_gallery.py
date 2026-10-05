from pathlib import Path
import json,shutil
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3];out=ROOT/'public/art/buildings-landmarks';ev=ROOT/'art/verification/buildings-landmarks';m=json.loads((out/'manifest.json').read_text())
for src,dst in [('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),('examples/jsm/loaders/GLTFLoader.js','addons/loaders/GLTFLoader.js'),('examples/jsm/utils/BufferGeometryUtils.js','addons/utils/BufferGeometryUtils.js'),('examples/jsm/utils/SkeletonUtils.js','addons/utils/SkeletonUtils.js'),('examples/jsm/controls/OrbitControls.js','addons/controls/OrbitControls.js')]:
 target=out/'vendor'/dst;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'node_modules/three'/src,target)
shutil.copy(ROOT/'node_modules/three/LICENSE',out/'vendor/THREE-LICENSE.txt')
f=lambda size:ImageFont.truetype('C:/Windows/Fonts/georgia.ttf',size)
g=lambda size:ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',size)
sheet=Image.new('RGB',(2000,1390),'#171d1a');d=ImageDraw.Draw(sheet)
d.text((70,45),'EMBERHALL / HEARTH & HERITAGE',font=g(23),fill='#c6a66d');d.text((65,91),'Places worth finding.',font=f(60),fill='#f0e6d1');d.text((70,181),'08 original assets / Buildings & Landmarks / Collection 03',font=g(23),fill='#a6b5aa')
for i,a in enumerate(m['assets']):
 x=60+(i%4)*475;y=250+(i//4)*475;d.rounded_rectangle((x,y,x+455,y+449),radius=16,fill='#27302a',outline='#4b5143',width=2)
 im=Image.open(ev/(a['id']+'.png')).convert('RGBA');im.thumbnail((445,352));sheet.paste(im,(x+(455-im.width)//2,y+4),im)
 d.text((x+22,y+354),a['family'].upper(),font=g(15),fill='#d1ab68');d.text((x+22,y+382),a['name'],font=f(25),fill='#f0e6d1');d.text((x+22,y+417),a['id'],font=g(14),fill='#a6b5aa')
d.text((70,1240),'WARM STONE. OLD TIMBER. NEW STORIES.',font=g(23),fill='#d1ab68');d.text((70,1290),'Editable Blender source  /  Y-up GLBs  /  Exterior artwork only — no map or gameplay changes',font=g(21),fill='#a6b5aa')
sheet.save(ev/'contact-sheet.png');sheet.resize((1600,1112)).save(out/'contact-sheet.jpg',quality=94)
for a in m['assets']:shutil.copyfile(ev/(a['id']+'.png'),out/(a['id']+'.png'))
for family in ['Buildings','Landmarks']:
 assets=[a for a in m['assets'] if a['family']==family];board=Image.new('RGB',(1500,1400),'#171d1a');draw=ImageDraw.Draw(board);draw.text((45,32),'EMBERHALL / '+family.upper(),font=g(22),fill='#d1ab68');draw.text((45,75),'Hearth & Heritage',font=f(44),fill='#f0e6d1')
 for i,a in enumerate(assets):
  x=30+(i%2)*735;y=165+(i//2)*610;draw.rounded_rectangle((x,y,x+710,y+590),radius=16,fill='#27352b');im=Image.open(ev/(a['id']+'.png')).convert('RGBA');board.paste(im,(x+35,y),im);draw.text((x+30,y+538),a['name'],font=f(31),fill='#f0e6d1')
 board.save(ev/(family.lower()+'-closeup.jpg'),quality=94)
print('Packaged 8 assets, contact sheet, 2 closeups and local viewer dependencies')
