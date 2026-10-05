"""Hollowvein Diggings: original abandoned mining modules; static visual art only."""
PAL.update({'timber':(.25,.16,.085),'cutwood':(.43,.31,.18),'iron':(.12,.14,.13),'rust':(.35,.17,.07),'dirt':(.27,.22,.14),'ore':(.25,.34,.30),'sack':(.47,.41,.27),'moss':(.22,.28,.12)})
def box(name,p,s,col='timber',yaw=0):
 vs=[];x,y,z=p;dx,dy,dz=s
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def beam(name,a,b,r=.12,col='timber'):return tube(name,[a,b],[r,r],col,4)
def weeds(x,y,z=0):
 for k in range(5):
  a=k*2.4;beam('Dry stalk', (x,y,z),(x+.16*math.cos(a),y+.16*math.sin(a),z+.22+.09*math.sin(k)),.015,'sack')
def mine():
 # Solid faceted rock face, recessed dark sealed centre, no enterable tunnel.
 rock('Solid collapsed seam',(0,.65,0),(2.7,1.15,3.1),'stone')
 for side in [-1,1]:
  rock('Shoulder outcrop',(side*1.95,.25,0),(1.15,1.15,2.05),'lightstone')
  box('Heavy portal upright',(side*1.03,-.86,1.12),(.33,.36,2.24),'timber',side*.025)
  for z in [.32,1.83]:box('Rusted upright strap',(side*1.03,-1.05,z),(.37,.045,.14),'rust')
 box('Hewn portal lintel',(0,-.87,2.23),(2.65,.49,.38),'cutwood',-.035)
 box('Sealed darkness',(0,-.70,1.08),(1.82,.1,1.96),'basalt')
 for k in range(6):box('Split sealing board '+str(k),(-.78+k*.31,-.83,1.05),(.27,.13,1.86-.08*(k%3)),'timber',.025*math.sin(k))
 beam('Barricade diagonal',(-.9,-.94,.44),(.88,-.94,1.75),.13,'cutwood')
 for k in range(9):rock('Entrance collapse '+str(k),(-1.0+(k%5)*.49,-1.03-(k//5)*.35,0),(.34,.36,.33+.24*(k%3)),'lightstone' if k%2 else 'stone')
 for k in range(7):rock('Moss on ledge '+str(k),(-2.2+k*.69,.18+.15*math.sin(k),1.15+.35*math.sin(k)),(.25,.32,.085),'moss')
 # Hanging broken warning marker with crossed pick motif.
 box('Weathered warning board',(-1.85,-.89,1.4),(.66,.07,.38),'cutwood',-.18)
 beam('Warning stroke A',(-2.04,-.94,1.28),(-1.67,-.94,1.52),.022,'iron');beam('Warning stroke B',(-2.04,-.94,1.51),(-1.67,-.94,1.28),.022,'iron')
def straight():
 for k in range(7):box('Uneven sleeper '+str(k),(0,-1.35+k*.45,.065),(1.38,.18,.13),'cutwood',.015*math.sin(k))
 for x in [-.45,.45]:
  box('Rusted rail',(x,0,.19),(.095,3,.12),'rust');box('Rail bright worn edge',(x,0,.255),(.105,3,.023),'iron')
  for y in [-1.35,-.45,.45,1.35]:box('Rail spike',(x+.09,y,.15),(.07,.065,.08),'iron')
def broken_track():
 for k in range(7):
  a=-.60+k*.2;x=1.6*(1-math.cos(a));y=1.6*math.sin(a)
  box('Skewed curved sleeper '+str(k),(x,y,.065),(1.42,.17,.13),'cutwood',a+.07*math.sin(k))
 for side in [-1,1]:
  pts=[]
  for k in range(7):
   a=-.65+k*.18;rr=1.6+side*.45;pts.append((1.6-rr*math.cos(a),rr*math.sin(a),.2))
  tube('Bent severed rail '+str(side),pts,[.065]*len(pts),'rust',4)
 box('Dislodged sleeper',(-.25,1.25,.07),(1.32,.16,.14),'timber',-.4);weeds(.15,.45,.13)
def cart():
 for k in range(5):box('Cart bed plank',(-.5+k*.25,0,.52),(.23,1.55,.12),'cutwood')
 for y in [-.52,.52]:beam('Corroded axle',(-.85,y,.29),(.85,y,.29),.075,'iron')
 for x in [-.7,.7]:
  for y in [-.52,.52]:
   if x>0 and y<0:continue
   pts=[(x,y+.29*math.cos(k*math.tau/12),.30+.29*math.sin(k*math.tau/12)) for k in range(13)]
   tube('Wheel iron rim',pts,[.048]*13,'iron',6)
   for k in range(6):a=k*math.tau/6;beam('Wheel spoke',(x,y,.30),(x,y+.26*math.cos(a),.30+.26*math.sin(a)),.035,'rust')
 for x in [-.62,.62]:
  for k in range(3):
   if x>.0 and k==2:continue
   box('Broken cart side',(x,0,.72+k*.20),(.10,1.55,.17),'timber')
  for y in [-.66,.66]:box('Cart corner iron',(x,y,.90),(.14,.13,.91),'rust')
 for y in [-.78,.78]:
  for k in range(3):box('Cart end board',(0,y,.71+k*.2),(1.3,.1,.17),'cutwood')
 for k in range(5):rock('Abandoned ore in cart',(-.36+k*.18,.16*math.sin(k),.60),(.23,.30,.27),'ore')
 box('Fallen side board',(.95,-.45,.055),(.18,1.35,.11),'cutwood',.4)
 # Detached wheel laid flat beside broken axle.
 pts=[(1.02+.28*math.cos(k*math.tau/12),.65+.28*math.sin(k*math.tau/12),.065) for k in range(13)]
 tube('Detached wheel rim',pts,[.045]*13,'iron',6)
 for k in range(4):a=k*math.tau/4;beam('Detached wheel spoke',(1.02,.65,.065),(1.02+.25*math.cos(a),.65+.25*math.sin(a),.065),.026,'rust')
def shoring():
 for x in [-.91,.91]:
  box('Shore foot',(x,0,.08),(.52,.65,.16),'cutwood');box('Shore upright',(x,0,1.15),(.24,.28,2.2),'timber')
  beam('Diagonal knee brace',(x,0,1.49),(x*.46,0,2.09),.10,'cutwood')
 box('Shoring cap',(0,0,2.23),(2.43,.36,.29),'cutwood')
 for x in [-.92,.92]:box('Rust cap bracket',(x,-.195,2.19),(.19,.045,.33),'rust')
 beam('Fallen shore beam',(-1.18,-.55,.11),(.6,-.75,.11),.11,'timber');weeds(.7,.15)
def tools():
 for x in [-.65,.65]:box('Tool rack foot',(x,0,.08),(.25,.62,.16),'timber');box('Rack upright',(x,0,.85),(.13,.14,1.7),'cutwood')
 for z in [.46,1.38]:box('Rack crossbar',(0,0,z),(1.49,.14,.15),'timber')
 for x,z in [(-.38,1.45),(.12,1.25)]:
  beam('Old pick handle',(x,-.18,.12),(x+.1,-.18,z),.037,'cutwood');tube('Rusted pick head',[(x-.27,-.18,z-.10),(x+.1,-.18,z),(x+.40,-.18,z-.12)],[.018,.065,.013],'rust',6)
 beam('Broken shovel handle',(.52,-.23,.12),(.56,-.23,.9),.035,'timber');box('Shovel blade',(.51,-.24,.18),(.25,.065,.30),'iron')
 weeds(-.8,-.19)
def heap():
 rock('Spoil mound',(0,0,0),(1.2,.9,.63),'mud')
 for k in range(18):
  a=k*2.4;rr=.75*(.3+.7*((k%5)/4));rock('Loose tailings '+str(k),(rr*math.cos(a),rr*.7*math.sin(a),.12+.31*(1-rr)),(.22,.21,.2+.1*(k%3)),'ore' if k%4==0 else 'stone')
 weeds(.78,-.35)
def workbench():
 for x in [-.78,.78]:
  for y in [-.32,.32]:box('Workbench weathered leg',(x,y,.44),(.13,.15,.88),'timber')
 for k in range(4):box('Split worktop '+str(k),(0,-.38+k*.25,.94),(1.95,.23,.13),'cutwood')
 box('Lower bench brace',(0,.3,.28),(1.7,.12,.13),'timber')
 box('Empty sample tray',(0,.05,1.05),(.63,.44,.09),'timber')
 for x in [-.35,.35]:box('Sample tray lip',(x,.05,1.13),(.055,.48,.18),'cutwood')
 for k in range(3):rock('Discarded sample',(-.2+k*.2,.05,1.1),(.07,.085,.075),'ore')
 beam('Hammer handle',(.42,-.19,1.02),(.79,.05,1.02),.032,'cutwood');box('Hammer head',(.8,.05,1.06),(.16,.25,.13),'iron')
 for k in range(2):
  x=-.9+k*.4;y=.69;r=.23;rings('Slumped empty sack',[(r*.8,0,x,y),(r,.15,x,y),(r*.68,.31,x+.09,y),(.07,.35,x+.12,y)],'sack',n=8,rough=.10)
 box('Discarded plank',(0,-.65,.055),(1.35,.19,.11),'timber',-.18);weeds(.9,.45)
LAYOUT=[('sealed-mine-mouth','sealed-seam',(0,2.6,.10),0),('straight-track','track-rear',(0,.10,.10),0),('straight-track','track-front',(0,-2.9,.10),0),('broken-track','derailed-spur',(1.55,-3.25,.10),-.6),('broken-ore-cart','abandoned-cart',(-1.65,-2.05,.10),.20),('timber-shoring','forgotten-shore',(-3.05,1.25,.10),-.2),('tool-rack','old-tools',(-3.05,-.8,.10),.15),('spoil-heap','tailings-east',(3.1,1.0,.10),0),('spoil-heap','tailings-west',(-2.3,3.45,.10),.2),('mining-workbench','assay-bench',(3,-1.25,.10),-.28)]
def assembly():
 rings('Diggings earth skirt',[(5.85,0,0,0),(5.65,.1,0,0)],'dirt',n=28,rough=.055)
 for k in range(22):
  a=k*2.4;rr=4.5+.55*math.sin(k);rock('Scattered boundary rubble '+str(k),(rr*math.cos(a),rr*math.sin(a),.1),(.23,.19,.12),'stone')
 for x,y in [(-2,-2.5),(2.6,-3),(3.5,2.3),(-3.9,.1),(1.7,.6),(-1,-4.5)]:weeds(x,y,.1)
 for aid,label,p,yaw in LAYOUT:
  for o in bpy.data.collections[aid].objects:
   c=o.copy();c.data=o.data.copy();c.name=label+'/'+o.name;active.objects.link(c);objects.append(c)
   for v in c.data.vertices:x,y,z=v.co;v.co=(p[0]+x*math.cos(yaw)-y*math.sin(yaw),p[1]+x*math.sin(yaw)+y*math.cos(yaw),p[2]+z)
 blueprint={'name':'Hollowvein Diggings','scope':'Decorative prefab only; sealed mine, no navigation, resources or gameplay.','axis':'glTF Y-up','assemblyOnlyDressing':['Diggings earth skirt','Scattered boundary rubble (22)','Dry stalk clusters (6 x 5)'],'instances':[{'asset':a,'instance':n,'translation':[p[0],p[2],-p[1]],'yawRadians':y,'scale':[1,1,1]} for a,n,p,y in LAYOUT]}
 (OUT/'layout.json').write_text(json.dumps(blueprint,indent=2))
SPECS=[('sealed-mine-mouth','Structures','Sealed Mine Mouth',mine),('timber-shoring','Structures','Forgotten Shoring',shoring),('straight-track','Trackwork','Straight Ore Track',straight),('broken-track','Trackwork','Broken Curved Track',broken_track),('broken-ore-cart','Camp details','Broken Ore Cart',cart),('tool-rack','Camp details','Abandoned Tools',tools),('spoil-heap','Camp details','Weathered Tailings',heap),('mining-workbench','Camp details','Old Assay Bench',workbench),('hollowvein-diggings','Assembled camp','Hollowvein Diggings',assembly)]
