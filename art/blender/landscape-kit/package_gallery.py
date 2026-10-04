from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[3];out=ROOT/'public/art/landscape-kit';ev=ROOT/'art/verification/landscape-kit';m=json.loads((out/'manifest.json').read_text())
(out/'vendor').mkdir(exist_ok=True)
for src,dst in [('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),('examples/jsm/loaders/GLTFLoader.js','addons/loaders/GLTFLoader.js'),('examples/jsm/utils/BufferGeometryUtils.js','addons/utils/BufferGeometryUtils.js'),('examples/jsm/utils/SkeletonUtils.js','addons/utils/SkeletonUtils.js'),('examples/jsm/controls/OrbitControls.js','addons/controls/OrbitControls.js')]:
 target=out/'vendor'/dst;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'node_modules/three'/src,target)
shutil.copy(ROOT/'node_modules/three/LICENSE',out/'vendor/THREE-LICENSE.txt')
font='C:/Windows/Fonts/georgia.ttf';sans='C:/Windows/Fonts/seguisb.ttf'
f=lambda size:ImageFont.truetype(font,size)
g=lambda size:ImageFont.truetype(sans,size)
sheet=Image.new('RGB',(2000,2260),'#121f20');d=ImageDraw.Draw(sheet)
d.text((70,45),'EMBERHALL  /  WILD FRONTIERS',font=g(23),fill='#c6a66d');d.text((65,89),'Landscapes for worlds yet to come.',font=f(57),fill='#f0e6d1');d.text((70,174),'14 original modular assets  /  Highlands · Cinderlands · Wetlands',font=g(23),fill='#a6b5aa')
for i,a in enumerate(m['assets']):
 x=60+(i%4)*475;y=240+(i//4)*475
 d.rounded_rectangle((x,y,x+455,y+449),radius=16,fill='#203030',outline='#415048',width=2)
 im=Image.open(ev/(a['id']+'.png')).convert('RGBA');im.thumbnail((445,352));sheet.paste(im,(x+(455-im.width)//2,y+4),im)
 d.text((x+22,y+354),a['family'].upper(),font=g(15),fill='#d1ab68');d.text((x+22,y+382),a['name'],font=f(25),fill='#f0e6d1');d.text((x+22,y+417),a['id'],font=g(14),fill='#a6b5aa')
d.text((1020,1795),'MATTE EARTH. BROKEN STONE.',font=g(20),fill='#d1ab68');d.text((1020,1840),'A new frontier, not a changed world.',font=f(27),fill='#f0e6d1');d.text((1020,1890),'Editable Blender source · Grounded Y-up GLBs',font=g(19),fill='#a6b5aa');d.text((1020,1930),'Decorative kit only. No map or gameplay integration.',font=g(18),fill='#a6b5aa');d.text((65,2183),'EMBERHALL ASSET LIBRARY   /   VOLUME 01',font=g(19),fill='#c6a66d')
sheet.save(ev/'contact-sheet.png');sheet.resize((1600,1808)).save(out/'contact-sheet.jpg',quality=92)
for a in m['assets']:shutil.copy(ev/(a['id']+'.png'),out/(a['id']+'.png'))
for family in ['Highlands','Cinderlands','Wetlands']:
 assets=[a for a in m['assets'] if a['family']==family]; rows=(len(assets)+1)//2
 board=Image.new('RGB',(1500,rows*610+180),'#142320');draw=ImageDraw.Draw(board)
 draw.text((45,32),'EMBERHALL / '+family.upper(),font=g(22),fill='#d1ab68');draw.text((45,75),'The '+family+' collection',font=f(44),fill='#f0e6d1')
 for i,a in enumerate(assets):
  x=30+(i%2)*735;y=165+(i//2)*610
  draw.rounded_rectangle((x,y,x+710,y+590),radius=16,fill='#24362e')
  im=Image.open(ev/(a['id']+'.png')).convert('RGBA');board.paste(im,(x+35,y),im)
  draw.text((x+30,y+538),a['name'],font=f(31),fill='#f0e6d1')
 board.save(ev/(family.lower()+'-closeup.jpg'),quality=94)
print('Packaged gallery vendor files, rendered contact sheet and three family closeups')
