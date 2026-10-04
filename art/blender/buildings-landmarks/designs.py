"""Original editable Hearth & Heritage geometry; procedural art, no game integration."""
PAL.update({'plaster':(.68,.59,.41),'cream':(.79,.73,.55),'wood':(.30,.17,.075),'beam':(.16,.085,.035),'tile':(.29,.13,.055),'tilelight':(.37,.19,.085),'window':(.95,.57,.17),'dark':(.045,.045,.03),'brass':(.64,.39,.10),'banner':(.42,.035,.024),'gold':(.78,.47,.11),'moss':(.26,.34,.1)})
def box(name,p,s,col='stone',yaw=0):
 vs=[];x,y,z=p;dx,dy,dz=s
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def roof(name,cx,cy,length,depth,base,rise):
 half=depth/2
 for side in [-1,1]:
  for row in range(4):
   y0=side*half*row/4;y1=side*half*(row+1)/4;yl,yh=sorted([y0,y1])
   for k in range(7):
    xl=cx-length/2+k*length/7+.009;xh=xl+length/7-.018
    zl=base+rise*(1-abs(yl)/half)**1.35;zh=base+rise*(1-abs(yh)/half)**1.35
    top=[(xl,cy+yl,zl),(xh,cy+yl,zl),(xh,cy+yh,zh),(xl,cy+yh,zh)];verts=[(x,y,z-.075) for x,y,z in top]+top
    o=mesh('RoofTile '+name+' '+str(side)+' '+str(row)+' '+str(k),verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'tilelight' if (k+row)%4==0 else 'tile')
    assert o.data.polygons[1].normal.z>0
 for side in [-1,1]:box('Eave fascia '+name,(cx,cy+side*half,base-.035),(length,.105,.15),'beam')
 tube('Ridge cap '+name,[(cx-length/2,cy,base+rise),(cx+length/2,cy,base+rise)],[.105,.105],'tilelight',6)
def front_window(x,y,z,w=.48,h=.62):
 box('Window dark surround',(x,y,z),(w+.12,.1,h+.12),'beam');box('Warm glass',(x,y-.057,z),(w,.03,h),'window')
 box('Window cross vertical',(x,y-.083,z),(.045,.05,h),'wood');box('Window cross horizontal',(x,y-.084,z),(w,.05,.04),'wood');box('Window sill',(x,y-.1,z-h/2-.055),(w+.2,.23,.08),'wood')
 for s in [-1,1]:box('Open shutter',(x+s*(w/2+.16),y+.01,z),(.2,.085,h+.07),'wood',s*.17)
def side_window(x,y,z,w=.48,h=.62):
 before=len(objects);front_window(0,0,z,w,h)
 for o in objects[before:]:
  for v in o.data.vertices:v.co=(-v.co.y+x,v.co.x+y,v.co.z)
def doorway(x,y,z=0,w=.68,h=1.2):
 box('Door frame',(x,y,z+h/2),(w+.16,.14,h+.14),'beam')
 for k in range(5):box('Door plank '+str(k),(x-w/2+(k+.5)*w/5,y-.085,z+h/2),(w/5-.012,.06,h),'wood')
 for zz in [z+.27,z+h-.25]:box('Door iron strap',(x,y-.126,zz),(w*.9,.04,.055),'dark')
 box('Latch',(x+w*.3,y-.16,z+h*.5),(.055,.065,.07),'brass');box('Threshold step',(x,y-.22,z+.08),(w+.35,.48,.16),'lightstone')
def banner(x,y,z):
 mesh('Crimson forked banner',[(x-.19,y,z),(x+.19,y,z),(x+.19,y,z-.9),(x,y,z-.75),(x-.19,y,z-.9)],[(0,1,3),(1,2,3),(0,3,4),(3,1,0),(3,2,1),(4,3,0)],'banner')
 box('Banner gold stripe',(x,y-.016,z-.36),(.055,.035,.55),'gold');tube('Banner crossbar',[(x-.25,y,z+.03),(x+.25,y,z+.03)],[.035,.035],'brass',6)
def chimney(x,y,z):
 box('Chimney shaft',(x,y,z+.5),(.43,.47,1),'stone')
 for k in range(4):box('Chimney mortar course',(x,y,z+.12+k*.23),(.45,.49,.045),'lightstone')
 box('Chimney cap',(x,y,z+1.03),(.58,.62,.12),'lightstone');box('Soot opening',(x,y,z+1.095),(.3,.33,.015),'dark')
def shell(w,d,h,upper=False,rise=1):
 box('Stone plinth',(0,0,.16),(w+.18,d+.18,.32),'stone');box('Plastered main body',(0,0,.3+h/2),(w,d,h),'plaster')
 for x in [-w/2+.05,0,w/2-.05]:
  for y in [-d/2-.025,d/2+.025]:box('Structural upright',(x,y,.3+h/2),(.12,.12,h+.05),'beam')
 for zz in [.36,.3+h]:
  for y in [-d/2-.05,d/2+.05]:box('Horizontal facade beam',(0,y,zz),(w+.13,.12,.14),'beam')
  for x in [-w/2-.03,w/2+.03]:box('Side sill beam',(x,0,zz),(.12,d,.14),'beam')
 for s in [-1,1]:tube('Diagonal timber brace',[(s*w*.35,-d/2-.06,.65),(s*w*.1,-d/2-.06,1.35)],[.055,.055],'beam',4)
 # Gables occupy the triangular volume below the roof, not a floating roof shell.
 for side in [-1,1]:
  x=side*w/2
  for j in range(8):
   y0=-d/2+j*d/8;y1=-d/2+(j+1)*d/8
   z0=.3+h-.065+rise*(1-abs(y0)/(d/2+.25))**1.35;z1=.3+h-.065+rise*(1-abs(y1)/(d/2+.25))**1.35
   v=[]
   for xx in [x-.055,x+.055]:v.extend([(xx,y0,.3+h-.15),(xx,y1,.3+h-.15),(xx,y1,z1),(xx,y0,z0)])
   mesh('Solid gable panel '+str(side)+' '+str(j),v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'plaster')
def cottage():
 shell(3,2.45,1.65);roof('Cottage',0,0,3.5,2.95,1.92,1.0);doorway(-.65,-1.29,.25);front_window(.75,-1.29,1.18);side_window(1.56,0,1.18);chimney(-.85,.45,2.35)
 for k in range(4):rock('Garden edging',(1.2+k*.22,-1.55,0),(.15,.17,.17),'lightstone')
 box('Window flower box',(.75,-1.47,.74),(.84,.24,.2),'wood')
 for k in range(4):rock('Herb tuft',(.48+k*.17,-1.46,.83),(.12,.12,.16),'moss')
def inn():
 shell(4.2,3.1,2.85,rise=1.35);roof('Inn',0,0,4.8,3.7,3.12,1.35);doorway(0,-1.62,.25,.84,1.5)
 for x in [-1.42,1.42]:
  front_window(x,-1.63,1.35,.55,.68);front_window(x,-1.63,2.5,.62,.65)
 for y in [-.8,.8]:side_window(2.16,y,2.3,.55,.73)
 box('Upper floor belt',(0,-1.63,1.91),(4.4,.17,.2),'beam');chimney(-1.35,.7,3.6)
 for x in [-.8,.8]:box('Porch post',(x,-2.35,.82),(.13,.13,1.64),'wood')
 roof('Porch',0,-2.05,2.05,1.25,1.7,.35)
 box('Hanging sign arm',(-1.7,-1.92,2.03),(.12,.7,.12),'beam');box('Hanging inn sign',(-1.7,-2.22,1.76),(.5,.1,.46),'wood');box('Golden sign emblem',(-1.7,-2.28,1.76),(.2,.035,.22),'gold')
 for x in [-1.65,1.65]:box('Roadside bench seat',(x,-1.92,.4),(.9,.33,.12),'wood')
def wheel(cx,cy,cz,r):
 # Open paddle wheel, axial X orientation; not a solid disk.
 for x in [cx-.22,cx+.22]:
  for k in range(16):
   a=k*math.tau/16;b=(k+1)*math.tau/16;v=[]
   for xx in [x-.05,x+.05]:
    for rr,t in [(r-.1,a),(r,a),(r,b),(r-.1,b)]:v.append((xx,cy+rr*math.cos(t),cz+rr*math.sin(t)))
   mesh('Wheel rim segment',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'wood')
 for k in range(12):
  a=k*math.tau/12;y=cy+r*.9*math.cos(a);z=cz+r*.9*math.sin(a)
  tube('Wheel radial spoke',[(cx,cy,cz),(cx,y,z)],[.06,.05],'beam',5)
  # Broad paddles tangent to the circumference, spanning wheel width.
  o=box('Wheel paddle',(0,0,0),(.6,.28,.07),'wood')
  for v in o.data.vertices:yy=v.co.y;zz=v.co.z;t=a+math.pi/2;v.co=(cx+v.co.x,y+yy*math.cos(t)-zz*math.sin(t),z+yy*math.sin(t)+zz*math.cos(t))
 tube('Wheel axle',[(cx-.65,cy,cz),(cx+.65,cy,cz)],[.13,.13],'dark',10)
 for y in [cy-.5,cy+.5]:box('Outboard wheel bearing leg',(cx+.51,y,cz/2),(.17,.18,cz),'beam')
 box('Outboard axle bearing',(cx+.51,cy,cz),(.22,1.2,.21),'beam')
def mill():
 shell(3,2.6,2.15,rise=1.05);roof('Mill',0,0,3.55,3.15,2.43,1.05);doorway(-.55,-1.37,.25);front_window(.78,-1.37,1.4);side_window(1.56,.85,1.8,.4,.5);wheel(1.98,-.2,1.28,1.18)
 box('Millstone base',(-1.5,-1.6,.14),(.9,.9,.28),'stone');rings('Spare millstone',[(.46,.28,-1.5,-1.6),(.46,.43,-1.5,-1.6)],'lightstone',n=12,rough=.01)
 box('Raised sluice bed',(2.06,.79,2.62),(.68,2.02,.12),'wood')
 for x in [1.7,2.42]:box('Sluice channel side',(x,.79,2.83),(.08,2.02,.42),'wood')
 for x in [1.8,2.35]:box('Sluice trestle post',(x,1.45,1.3),(.14,.14,2.6),'beam')
def square_tower(x,y,width,h,name):
 box(name+' foot',(x,y,.18),(width+.28,width+.28,.36),'stone');box(name+' shaft',(x,y,h/2),(width,width,h),'cream')
 for z in [.6,1.45,2.3,h-.2]:box(name+' belt',(x,y,z),(width+.08,width+.08,.1),'lightstone')
 for z in [.85,1.6,2.4]:
  for sx in [-1,1]:box(name+' corner quoin',(x+sx*(width/2-.11),y-width/2-.025,z),(.28,.09,.22),'lightstone')
 box(name+' parapet slab',(x,y,h),(width+.28,width+.28,.18),'stone')
 for side in [-1,1]:
  for k in range(3):
   t=(k-1)*width*.36;box(name+' battlement',(x+t,y+side*(width/2),h+.29),(.31,.3,.5),'cream');box(name+' side battlement',(x+side*width/2,y+t,h+.29),(.3,.31,.5),'cream')
 for z in [1.35,2.25]:box(name+' arrow slit',(x,y-width/2-.035,z),(.14,.035,.48),'dark')
def watchtower():
 square_tower(0,0,1.7,3.7,'Watch');doorway(0,-.9,.12,.56,1.0);banner(.57,-.91,3.18)
 for k in range(3):box('Approach stair',(0,-1.18-k*.23,.06*(3-k)),(.86,.32,.12*(3-k)),'lightstone')
def arch_span(cx,cy,r,base,depth,col='cream'):
 for k in range(11):
  a=k*math.pi/11+.008;b=(k+1)*math.pi/11-.008;vs=[]
  for y in [cy-depth/2,cy+depth/2]:
   for rr,t in [(r,a),(r+.38,a),(r+.38,b),(r,b)]:vs.append((cx+rr*math.cos(t),y,base+rr*math.sin(t)))
  mesh('Gateway arch voussoir',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def gatehouse():
 for x in [-2,2]:square_tower(x,0,1.6,3.5,'Gate tower '+str(x));banner(x,-.85,2.85)
 # Genuine unobstructed central opening, with bridge and brown main roof above.
 arch_span(0,0,1.2,1.45,1.1)
 for x in [-1.39,1.39]:box('Arch jamb',(x,0,.72),(.38,1.1,1.44),'cream')
 box('Gate upper gallery',(0,0,2.96),(2.6,1.5,.47),'plaster');roof('Gate gallery',0,0,3,2,3.15,.73)
 for x in [-.65,.65]:front_window(x,-.8,2.94,.3,.28)
 for x in [-1.07,1.07]:box('Raised gate guide',(x,-.55,1.6),(.1,.14,2.3),'beam')
def shrine():
 box('Shrine lower step',(0,0,.12),(2.2,2,.24),'stone');box('Shrine upper step',(0,0,.31),(1.75,1.6,.16),'lightstone')
 for x in [-.65,.65]:
  for y in [-.52,.52]:box('Shrine slender pier',(x,y,1.25),(.18,.18,1.8),'cream');box('Pier capital',(x,y,2.1),(.32,.32,.16),'lightstone')
 roof('Shrine',0,0,1.95,1.9,2.14,.6)
 box('Offering altar',(0,.1,.73),(.68,.58,.72),'cream');box('Altar cap',(0,.1,1.13),(.84,.74,.13),'lightstone')
 rock('Sacred standing stone',(0,.13,1.18),(.22,.15,.66),'lightstone')
 tube('Shrine sun medallion',[(0,-.04,1.53),(0,-.07,1.53)],[.12,.12],'gold',10)
 box('Shrine devotional stem',(0,-.075,1.43),(.045,.025,.43),'brass')
 for x in [-.38,.38]:tube('Votive candle',[(x,-.1,1.17),(x,-.1,1.38)],[.045,.045],'gold',7)
 banner(0,.55,1.98)
def belltower():
 box('Bell tower stepped foot',(0,0,.16),(1.8,1.8,.32),'stone');box('Bell tower lower shaft',(0,0,1.27),(1.4,1.4,2.25),'cream');doorway(0,-.75,.22,.5,1.1)
 for z in [.5,1.5,2.35]:box('Bell tower stone course',(0,0,z),(1.49,1.49,.12),'lightstone')
 for x in [-.57,.57]:
  for y in [-.57,.57]:box('Open belfry pier',(x,y,2.96),(.24,.24,1.15),'cream')
 box('Bell hanger',(0,0,3.38),(1.25,.18,.15),'beam');roof('Belfry',0,0,1.85,1.85,3.53,.78)
 rings('Bronze bell',[(.44,2.58,0,0),(.43,2.66,0,0),(.24,2.94,0,0),(.16,3.15,0,0),(.07,3.23,0,0)],'brass',n=14,rough=0,cap=False)
 tube('Bell crown suspension',[(0,0,3.19),(0,0,3.4)],[.055,.055],'dark',8)
 tube('Bell clapper',[(0,0,3),(0,0,2.48)],[.045,.065],'dark',8)
 for x in [-.54,.54]:banner(x,-.73,2.07)
def standing():
 rings('Ancient moss mound',[(2.1,0,0,0),(1.93,.14,0,0),(1.4,.22,0,0)],'moss',n=15,rough=.12)
 for k in range(5):
  a=k*math.tau/5;r=1.35;x=r*math.cos(a);y=r*math.sin(a);h=1.5+.5*math.sin(k*2)
  rock('Weathered megalith '+str(k),(x,y,.05),(.38,.31,h),'lightstone')
  # Shallow dark rune marks, geometric inscriptions not glowing magic.
  for j in range(3):box('Carved rune mark '+str(k)+'-'+str(j),(x,y-.30,.55+j*.22),(.15,.018,.025),'stone',.12*(j-1))
 rock('Central offering stone',(0,0,.15),(.65,.53,.35),'stone')
SPECS=[('hearth-cottage','Buildings','Hearthside Cottage',cottage),('roadside-inn','Buildings','The Amber Rest',inn),('watermill','Buildings','Willowbrook Mill',mill),('watchtower','Buildings','Border Watch',watchtower),('gatehouse','Landmarks','Twinward Gate',gatehouse),('wayside-shrine','Landmarks','Pilgrim’s Shelter',shrine),('bell-tower','Landmarks','Evening Bell',belltower),('standing-stones','Landmarks','The Elder Circle',standing)]
