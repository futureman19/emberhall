from pathlib import Path
import json,shutil
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3];out=ROOT/'public/art/abandoned-mine';ev=ROOT/'art/verification/abandoned-mine';m=json.loads((out/'manifest.json').read_text())
for src,dst in [('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),('examples/jsm/loaders/GLTFLoader.js','addons/loaders/GLTFLoader.js'),('examples/jsm/utils/BufferGeometryUtils.js','addons/utils/BufferGeometryUtils.js'),('examples/jsm/utils/SkeletonUtils.js','addons/utils/SkeletonUtils.js'),('examples/jsm/controls/OrbitControls.js','addons/controls/OrbitControls.js')]:
 target=out/'vendor'/dst;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'node_modules/three'/src,target)
shutil.copy(ROOT/'node_modules/three/LICENSE',out/'vendor/THREE-LICENSE.txt')
f=lambda size:ImageFont.truetype('C:/Windows/Fonts/georgia.ttf',size)
g=lambda size:ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',size)
sheet=Image.new('RGB',(2200,2310),'#171e19');d=ImageDraw.Draw(sheet)
d.text((70,42),'EMBERHALL / LANDMARK COLLECTION 05',font=g(24),fill='#c6a66d');d.text((65,90),'Hollowvein Diggings',font=f(70),fill='#f0e6d1');d.text((70,181),'An abandoned mining camp / Eight modular pieces + assembled landmark',font=g(24),fill='#a6b5aa')
d.rounded_rectangle((60,242,2140,1197),radius=18,fill='#253027',outline='#454e3d',width=2)
hero=Image.open(ev/'camp-hero.png').convert('RGBA');hero.thumbnail((2050,925));sheet.paste(hero,((2200-hero.width)//2,252),hero)
for i,a in enumerate(m['assets'][:-1]):
 x=60+(i%4)*525;y=1240+(i//4)*460;d.rounded_rectangle((x,y,x+500,y+435),radius=16,fill='#253027',outline='#454e3d',width=2)
 im=Image.open(ev/(a['id']+'.png')).convert('RGBA');im.thumbnail((490,330));sheet.paste(im,(x+(500-im.width)//2,y+4),im)
 d.text((x+22,y+339),a['family'].upper(),font=g(15),fill='#d1ab68');d.text((x+22,y+367),a['name'],font=f(26),fill='#f0e6d1');d.text((x+22,y+407),a['id'],font=g(14),fill='#a6b5aa')
d.text((70,2213),'EDITABLE SOURCE / INDIVIDUAL GLBs / ASSEMBLY BLUEPRINT / NO LIVE-WORLD CHANGES',font=g(21),fill='#c6a66d')
sheet.save(ev/'contact-sheet.png');sheet.resize((1600,1680)).save(out/'contact-sheet.jpg',quality=94)
hero=Image.open(ev/'camp-hero.png').convert('RGBA');cover=Image.new('RGB',(1600,1390),'#1b241d');cover.paste(hero,(0,160),hero);d=ImageDraw.Draw(cover);d.text((60,36),'EMBERHALL / A LANDMARK OFF THE ROAD',font=g(22),fill='#c6a66d');d.text((55,78),'Hollowvein Diggings',font=f(65),fill='#f0e6d1');d.text((60,1318),'Original modular artwork. No NPCs, loot, quests or gameplay integration.',font=g(21),fill='#a6b5aa');cover.save(ev/'camp-presentation.jpg',quality=95)
for a in m['assets']:shutil.copyfile(ev/(a['id']+'.png'),out/(a['id']+'.png'))
print('Packaged 8 reusable pieces, assembled camp, hero plate and contact sheet')
