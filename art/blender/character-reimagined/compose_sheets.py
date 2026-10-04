"""Compose actual Blender renders; no painted-over or generated concept imagery."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3];EV=ROOT/'art/verification/character-reimagined';OUT=ROOT/'public/art/character-reimagined'
BG='#15201c';TEXT='#eee8d8';MUTED='#b9c0ad';GOLD='#dbb77c';LINE='#465344'
def font(n,serif=False):return ImageFont.truetype('C:/Windows/Fonts/georgia.ttf' if serif else 'C:/Windows/Fonts/arial.ttf',n)
def text(d,xy,s,n=22,color=TEXT,serif=False):d.text(xy,s,font=font(n,serif),fill=color)
ids=['baseline-current','rowan','mira','arden'];names=['CURRENT','ROWAN','MIRA','ARDEN'];sub=['Default crop / existing geometry','Ember & oak / swept chestnut','River & brass / woven braid','Heather & silver / short waves']
hero=Image.new('RGB',(1920,1030),BG);d=ImageDraw.Draw(hero)
text(d,(50,30),'EMBERHALL   /   ORIGINAL CHARACTER STUDIES',18,GOLD)
text(d,(48,70),'A self for the road.',64,TEXT,True)
text(d,(50,153),'Same camera. Same light. Familiar small adventurer silhouette.',24,MUTED)
for i,id in enumerate(ids):
 x=40+i*470
 im=Image.open(EV/(id+'-beauty.png')).convert('RGB');im=im.resize((450,513),Image.Resampling.LANCZOS);hero.paste(im,(x,222))
 text(d,(x+12,751),names[i],18,GOLD);text(d,(x+12,785),sub[i],19,TEXT)
 descriptions=[['Actual installed GLB, reconstructed','with default colors, eyes and belt.'],['Shaped face, tailored lapels,','split tunic and stitched boots.'],['Warm dark skin, scarf, back mantle','and a tied, interwoven braid.'],['Silver crop, stand collar, shoulder','tab and toggle-front plum wool.']][i]
 for k,line in enumerate(descriptions):text(d,(x+12,824+k*29),line,19,MUTED)
d.line((50,918,1870,918),fill=LINE,width=1)
text(d,(50,945),'REVIEW ONLY  /  Original script-authored Blender geometry. Static studio reconstruction, not a live gameplay capture.',19,GOLD)
text(d,(50,978),'Candidate body proportions stay close to the current player. No game files, equipment rules or creator behavior were replaced.',18,MUTED)
hero.save(EV/'hero-before-after.png');hero.save(OUT/'hero-before-after.jpg',quality=94)
sheet=Image.new('RGB',(1920,1440),BG);d=ImageDraw.Draw(sheet)
text(d,(48,26),'THE LOOKING GLASS / CONTACT SHEET',20,GOLD);text(d,(48,66),'Face, hair & silhouette.',48,TEXT,True)
for i,id in enumerate(ids):
 x=40+i*470;text(d,(x+12,141),names[i],18,GOLD)
 face=Image.open(EV/(id+'-face.png')).convert('RGB').resize((450,450),Image.Resampling.LANCZOS);sheet.paste(face,(x,182))
 back=Image.open(EV/(id+'-back.png')).convert('RGB').resize((345,399),Image.Resampling.LANCZOS);sheet.paste(back,(x+52,664))
 game=Image.open(EV/(id+'-gameplay.png')).convert('RGB').crop((600,325,840,565));sheet.paste(game,(x+105,1100))
text(d,(50,1354),'BOTTOM ROW: native 1:1 crops from 1440 × 900 renders at the actual default world camera (+16, +23, +20), 48° FOV.',19,GOLD)
text(d,(50,1390),'The tiny figure is intentional. Fine facial detail is for the creator / close-up; normal play primarily reads hair, color and silhouette.',18,MUTED)
sheet.save(EV/'contact-sheet.png');sheet.save(OUT/'contact-sheet.jpg',quality=94)
print('WROTE hero-before-after.png, contact-sheet.png and gallery JPG copies')
