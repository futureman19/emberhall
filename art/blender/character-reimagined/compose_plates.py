"""Compose actual rendered evidence; never synthesize missing renders."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[3];EV=ROOT/'art/verification/character-reimagined';OUT=ROOT/'public/art/character-reimagined'
BG='#14211d';FG='#eee6d3';MUTED='#aebaab';GOLD='#d1ac70';PANEL='#303932'
FONT=Path('C:/Windows/Fonts')
def font(n,serif=False):return ImageFont.truetype(str(FONT/('georgia.ttf' if serif else 'segoeui.ttf')),n)
def text(d,xy,s,size=22,color=FG,serif=False):d.text(xy,s,font=font(size,serif),fill=color)
ids=['baseline-current','rowan','mira','arden'];names=['CURRENT','ROWAN','MIRA','ARDEN'];sub=['Default hairstyle / current asset','Ember & oak / swept chestnut','River & brass / woven braid','Heather & silver / silver crop']

def base(h,title,subtitle):
 im=Image.new('RGB',(1800,h),BG);d=ImageDraw.Draw(im);d.line((60,43,1740,43),fill='#455347',width=1);text(d,(60,64),'EMBERHALL  /  ORIGINAL CHARACTER STUDIES',20,GOLD);text(d,(60,107),title,62,serif=True);text(d,(63,188),subtitle,22,MUTED);return im,d

def pic(im,id,view,x,y,w,h):
 f=EV/f'{id}-{view}.png';assert f.is_file(),f
 im.paste(Image.open(f).convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x,y))

im,d=base(1260,'A self for the road.','Current character on the left. Three proposed adventurer appearances. No live game changes.')
for i,id in enumerate(ids):
 x=60+425*i;pic(im,id,'beauty',x,245,405,461)
 text(d,(x+6,730),names[i],27,GOLD);text(d,(x+6,771),sub[i],18,MUTED)
 pic(im,id,'face',x+38,825,328,328)
d.line((60,1187,1740,1187),fill='#455347');text(d,(60,1203),'SAME CAMERA + LIGHT  /  EDITABLE BLENDER SOURCE  /  REVIEW-ONLY GEOMETRY',18,MUTED)
im.save(EV/'hero-before-after.png');im.save(OUT/'hero-before-after.jpg',quality=93)

im,d=base(1780,'Craft, from every angle.','Same-camera design contact sheet. Shared base proportions; distinct hair, collars, materials and silhouettes.')
for i,id in enumerate(ids):
 x=60+425*i;text(d,(x+4,250),names[i],24,GOLD)
 pic(im,id,'beauty',x,298,405,461);pic(im,id,'face',x+20,790,365,365);pic(im,id,'back',x+20,1190,365,422)
 text(d,(x+4,1640),sub[i],18,MUTED)
text(d,(60,1720),'TOP: FULL FIGURE     MIDDLE: FACE     BOTTOM: BACK / HAIR / MANTLE',19,MUTED)
im.save(EV/'contact-sheet.png');im.save(OUT/'contact-sheet.jpg',quality=93)

im,d=base(1180,'Readable on the road.','Default world camera: offset (16, 23, 20), target (0, .4, 0), 48° vertical FOV. Neutral studio, not live gameplay.')
for i,id in enumerate(ids):
 x=60+425*i;text(d,(x,250),names[i],24,GOLD);raw=Image.open(EV/f'{id}-gameplay.png').convert('RGB');assert raw.size==(1440,900)
 # Native pixels, no scaling. Render-center crop preserves actual desktop gameplay size.
 im.paste(raw.crop((600,340,840,550)),(x+82,300));text(d,(x+66,528),'Native crop / view sheet at 100%',17,MUTED)
 # Explicit nearest-neighbor enlargement, not falsely labeled normal game size.
 crop=raw.crop((675,395,765,515)).resize((360,480),Image.Resampling.NEAREST);im.paste(crop,(x+22,594));text(d,(x+104,1091),'4x inspection enlargement',17,MUTED)
text(d,(60,1140),'At world distance the broad head, outfit blocks and grounded boots carry identity; fine facial detail is intentionally a close-range benefit.',18,MUTED)
im.save(EV/'gameplay-scale-comparison.png');im.save(OUT/'gameplay-scale-comparison.jpg',quality=94)
(EV/'plate-provenance.json').write_text(json.dumps({'source':'Actual Blender renders produced by build_characters.py','sameCamera':True,'hero':'4 beauty renders plus 4 face renders','contact':'4 beauty, 4 face, 4 back renders','gameplay':{'renderSize':[1440,900],'cameraGame':[16,23,20],'target':[0,.4,0],'verticalFov':48,'avatarYaw':3.141592653589793,'nativeCrop':[600,340,840,550],'enlargedCrop':[675,395,765,515],'enlargement':4,'filter':'nearest'},'notLiveGameScreenshot':True},indent=2))
print('Created hero-before-after.png, contact-sheet.png, gameplay-scale-comparison.png')
