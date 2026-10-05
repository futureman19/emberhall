"""Original Trails & Transitions geometry. Used by build_trails.py, not standalone."""
PAL.update({'wood':(.42,.26,.115),'endgrain':(.62,.42,.20),'rope':(.56,.46,.27),'grass':(.32,.40,.13),'ash':(.23,.22,.20),'canvas':(.59,.43,.22),'iron':(.09,.105,.1)})
def box(name,p,s,col='wood',yaw=0):
 vs=[];x,y,z=p;dx,dy,dz=s
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def scatter(col,count=10):
 for k in range(count):
  a=k*2.4;r=.3+1.25*((k*.37)%1);s=.15+.2*((k*.73)%1);rock('Loose '+col+' stone '+str(k),(r*math.cos(a),r*.55*math.sin(a),.04),(s,s*.8,s*.65),col)
def slope():
 rings('Broad fractured scree wedge',[(2.1,0,0,0),(1.95,.16,0,0),(1.25,.4,.3,.4),(.42,1.0,.55,.65)],'stone',n=12,rough=.11)
 for k in range(14):
  a=k*2.4;r=.4+1.4*((k*.3)%1);x=r*math.cos(a);y=r*.6*math.sin(a);rock('Tumbled talus '+str(k),(x,y,.1),(.28,.24,.18+.25*((k*.7)%1)),'lightstone')
def bank(snow=False):
 # Uneven tapered strip: open landscape blend edge, not a watertight terrain tile.
 vs=[]
 for i in range(9):
  x=-2+i*.5;y=.08*math.sin(i*2.3)
  vs.extend([(x,-.9+y,0),(x,.65+y,0),(x,.65+y,.4),(x,-.9+y,.035)])
 fs=[(3,2,1,0),(32,33,34,35)]
 for i in range(8):
  a=i*4;b=a+4;fs.extend([(a,b,b+1,a+1),(a+1,b+1,b+2,a+2),(a+2,b+2,b+3,a+3),(a+3,b+3,b,a)])
 mesh('Sloping snowmelt bank' if snow else 'Wet eroded bank',vs,fs,'stone' if snow else 'mud')
 for k in range(7):
  x=-1.6+k*.52;rock('Bank cap '+str(k),(x,.3,.3),(.4,.37,.16),'snow' if snow else 'moss')
 for k in range(5):rock('Shore pebble '+str(k),(-1.6+k*.7,-.5,.02),(.18,.16,.16),'lightstone')
def verge():
 rings('Low soil transition',[(2,0,0,0),(1.9,.13,0,0),(1.3,.15,0,0)],'mud',n=15,rough=.13)
 for k in range(15):
  a=k*2.4;r=.3+1.3*((k*.38)%1);x=r*math.cos(a);y=r*.55*math.sin(a)
  for j in range(3):
   h=.2+.16*((k*.3+j*.22)%1);d=j*math.tau/3
   mesh('Folded grass blade '+str(k)+'-'+str(j),[(x,y,.09),(x+.1*math.cos(d),y+.1*math.sin(d),h),(x+.24*math.cos(d),y+.24*math.sin(d),h*.8),(x+.04,y+.04,.09)],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],'grass')
 scatter('lightstone',4)
def ash():
 rings('Scalloped ash apron',[(2,0,0,0),(1.85,.11,0,0),(1.4,.14,0,0)],'ash',n=16,rough=.14);scatter('basalt',9)
 for k in range(3):tube('Charred branch '+str(k),[(-.9+k*.6,-.2,.16),(-.6+k*.6,.1,.18),(-.25+k*.6,.5,.21)],[.1,.08,.02],'basalt')
def crust():
 rings('Dark cooled lava tongue',[(2,0,0,0),(1.85,.12,0,0),(1.4,.2,0,0)],'basalt',n=13,rough=.15)
 for k in range(8):
  a=k*2.4;r=.3+1.1*((k*.4)%1);rock('Raised crust plate '+str(k),(r*math.cos(a),r*.6*math.sin(a),.08),(.45,.3,.14),'ash')
 # Non-emissive cooling surface, intentionally distinct from kit I lava.

def boardwalk(corner=False):
 length=4.5 if corner else 4.0
 for x in [-length/2+.25,length/2-.25]:
  for y in [-.55,.55]:box('Driven support post',(x,y,.32),(.18,.18,.64),'bark')
 for y in [-.5,.5]:box('Longitudinal bearer',(0,y,.45),(length,.16,.18),'bark')
 count=15 if corner else 12;pitch=length/count
 for k in range(count):box('Cross plank '+str(k),(-length/2+pitch/2+k*pitch,0,.6),(pitch-.02,1.5,.16),'wood' if k%3 else 'endgrain')
 if corner:
  # Clean butt joint: main deck ends at x=2.25, return spans x=.75..2.25.
  # First return plank starts y=.76, leaving the same small seam as other planks.
  for k in range(7):box('Return plank '+str(k),(1.5,.9+k*.3,.6),(1.5,.28,.16),'wood' if k%3 else 'endgrain')
  for x in [1,2]:
   box('Return bearer',(x,1.8,.45),(.16,2.1,.18),'bark');box('Return end post',(x,2.65,.32),(.18,.18,.64),'bark')
 else:
  for x in [-1.75,1.75]:
   box('Low handrail upright',(x,.69,1.0),(.12,.12,.8),'bark')
  tube('Sagging safety rope',[(-1.75,.69,1.37),(0,.69,1.2),(1.75,.69,1.37)],[.035,.035,.035],'rope',6)
def logbridge():
 tube('Fallen trunk crossing',[(-2,0,.48),(-.9,.06,.57),(.5,-.03,.54),(2,0,.49)],[.43,.44,.4,.34],'bark',10)
 tube('Left sawn end',[(-2.013,0,.48),(-2.027,0,.48)],[.35,.35],'endgrain',10)
 tube('Right sawn end',[(2.01,0,.49),(2.025,0,.49)],[.28,.28],'endgrain',10)
 for x,y in [(-1.5,.2),(.7,-.24)]:tube('Broken branch stub',[(x,y,.54),(x+.14,y*2,.93)],[.13,.035],'bark')
 for x in [-1.5,1.5]:rock('Ground saddle',(x,0,0),(.58,.62,.19),'stone')
 for k in range(5):box('Flat hewn tread '+str(k),(-1.2+k*.58,0,.9),(.5,.47,.065),'wood',.025*math.sin(k))
def steps():
 for k in range(6):rock('Flat crossing slab '+str(k),(-1.9+k*.76,.19*math.sin(k*2),0),(.46,.49,.22+.045*math.sin(k)),'lightstone')
def cairn():
 for k in range(5):rock('Balanced cairn stone '+str(k),(.06*math.sin(k*2),.07*math.cos(k*2),k*.3),(.61-k*.08,.53-k*.065,.35),'lightstone' if k%2 else 'stone')
 scatter('stone',5)
def sign():
 box('Weathered guidepost',(0,0,1.1),(.19,.22,2.2),'bark');rock('Post footing',(0,0,0),(.4,.35,.21),'stone')
 for k in range(2):
  z=1.4+k*.5;direction=1 if k==0 else -1
  vs=[(-.8,-.16,z-.12),(.6,-.16,z-.12),(.85,-.16,z),(.6,-.16,z+.12),(-.8,-.16,z+.12)]
  if direction<0:vs=[(-x,y,z) for x,y,z in vs]
  v2=[(x,y+.1,z) for x,y,z in vs];mesh('Blank arrow board '+str(k),vs+v2,[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],'wood')
  for x in [-.07,.07]:box('Iron fastener',(x,-.177,z),(.035,.025,.04),'iron')
def arch():
 for x in [-1.28,1.28]:
  box('Wide dressed footing',(x,0,.16),(.78,.9,.32),'stone')
  for k in range(4):box('Weathered pillar course',(x+.025*math.sin(k*2),0,.36+k*.39),(.57,.66,.37),'lightstone' if k%2 else 'stone')
 # Radial voussoirs form a real opening, not a filled disk.
 for k in range(9):
  a=k*math.pi/9+.014;b=(k+1)*math.pi/9-.014;vs=[]
  for y in [-.35,.35]:
   for r,t in [(1.01,a),(1.52,a),(1.52,b),(1.01,b)]:vs.append((r*math.cos(t),y,1.54+r*math.sin(t)))
  mesh('Arch voussoir '+str(k),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'lightstone' if k==4 else 'stone')
 for k in range(4):rock('Collapsed rubble '+str(k),(-1.7+k*.5,-.8-.18*math.sin(k),0),(.3,.24,.22),'stone')
 rock('Moss on footing',(-1.3,.25,.29),(.35,.3,.12),'moss')
def camp():
 # Empty shelter: canvas roof with open ends, no NPCs, loot or fire behavior.
 for x in [-.95,.95]:tube('Tent upright '+str(x),[(x,0,0),(x,0,1.65)],[.05,.035],'bark')
 tube('Tent ridgepole',[(-1.13,0,1.6),(1.13,0,1.6)],[.05,.05],'bark')
 mesh('Canvas A-frame',[(-1,-.8,.13),(1,-.8,.13),(1,0,1.57),(-1,0,1.57),(-1,.8,.13),(1,.8,.13)],[(0,1,2,3),(3,2,5,4),(3,2,1,0),(4,5,2,3)],'canvas')
 for x in [-1.25,1.25]:
  tube('Guy rope',[(x*.8,0,1.6),(x*1.3,0,.1)],[.018,.018],'rope',5);box('Tent peg',(x*1.3,0,.09),(.065,.065,.18),'wood')
 for k in range(9):a=k*math.tau/9;rock('Cold fire ring '+str(k),(.4+.45*math.cos(a),-1.6+.45*math.sin(a),0),(.13,.12,.14),'stone')
 for k in range(3):tube('Spent firewood '+str(k),[(.1+k*.17,-1.9,.1),(.5+k*.1,-1.35,.13)],[.04,.03],'basalt')
SPECS=[('scree-slope','Terrain','Tumbled Foothill',slope),('snowmelt-bank','Terrain','Thawline Bank',lambda:bank(True)),('muddy-bank','Terrain','Siltwater Edge',bank),('grassy-verge','Terrain','Meadow Fringe',verge),('ash-apron','Terrain','Ashfall Margin',ash),('cooling-crust','Terrain','Cooled Lava Tongue',crust),('boardwalk-straight','Crossings','Fenway Boardwalk',boardwalk),('boardwalk-corner','Crossings','Fenway Return',lambda:boardwalk(True)),('fallen-log','Crossings','Old Trunk Crossing',logbridge),('stepping-stones','Crossings','Shallow Ford',steps),('trail-cairn','Landmarks','Wayfarer Cairn',cairn),('guidepost','Landmarks','Forkroad Sign',sign),('ruined-arch','Landmarks','Forgotten Threshold',arch),('abandoned-camp','Landmarks','Quiet Camp',camp)]
