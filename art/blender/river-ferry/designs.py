"""Reedwake Crossing — original, deterministic low-poly riverbank art. No simulation."""
PAL.update({'timber':(.34,.205,.105),'oldwood':(.44,.31,.18),'endgrain':(.54,.39,.22),'iron':(.105,.125,.12),'rope':(.53,.43,.255),'dirt':(.285,.245,.155),'sand':(.42,.37,.235),'water':(.095,.265,.265),'ripple':(.18,.36,.33),'reed':(.34,.375,.17),'moss':(.22,.285,.135),'cloth':(.36,.24,.115)})
def box(name,p,s,col='timber',yaw=0):
 x,y,z=p;dx,dy,dz=s;vs=[]
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def beam(name,a,b,width,depth,col='timber'):
 a=Vector(a);b=Vector(b);t=(b-a).normalized();u=t.cross(Vector((0,0,1)))
 if u.length<.01:u=t.cross(Vector((0,1,0)))
 u.normalize();v=t.cross(u).normalized()
 vs=[p+u*i*width/2+v*j*depth/2 for p in [a,b] for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def hoop(name,x,y,z,r,col='rope',horizontal=True):
 pts=[(x+r*math.cos(k*math.tau/24),y+r*math.sin(k*math.tau/24),z) if horizontal else (x,y+r*math.cos(k*math.tau/24),z+r*math.sin(k*math.tau/24)) for k in range(25)]
 return tube(name,pts,[.028]*25,col,6)
def ferry():
 # A shallow double-ended river hull: tapered longitudinal strakes, exposed transverse ribs.
 stations=[(-2.9,.17),(-2.18,.86),(-.95,1.04),(.95,1.04),(2.18,.86),(2.9,.17)]
 beam('Heavy keel',(-2.80,0,.10),(2.80,0,.10),.22,.20)
 for j in range(5):
  x=-1.86+j*.93;w=.79 if j in [0,4] else .94
  beam('Exposed rib floor '+str(j),(x,-w,.26),(x,w,.26),.15,.17,'endgrain')
  for side in [-1,1]:beam('Exposed curved rib '+str(j),(x,side*w,.26),(x,side*(w+.13),1.07),.15,.14,'endgrain')
 for side in [-1,1]:
  for row in range(4):
   z=.34+row*.205
   for j,((x,w),(xx,ww)) in enumerate(zip(stations,stations[1:])):
    # Missing near-side upper strakes reveal ribs; asymmetry reads as a wreck.
    if side==-1 and ((row>=2 and j in [1,2]) or (row==1 and j==2)):continue
    inset=(3-row)*.08
    beam('Hull strake s%d r%d bay%d'%(side,row,j),(x,side*max(.10,w-inset),z),(xx,side*max(.10,ww-inset),z),.10,.178,'oldwood' if (j+row)%3 else 'timber')
  for j,((x,w),(xx,ww)) in enumerate(zip(stations,stations[1:])):
   if side==-1 and j in [1,2]:continue
   beam('Worn gunwale',(x,side*w,1.10),(xx,side*ww,1.10),.16,.12,'endgrain')
 for x in [-2.88,2.88]:beam('Rising end stem',(x,0,.10),(x,0,1.20),.24,.20,'timber')
 for j in range(9):
  if j in [3,4,6]:continue
  x=-1.84+j*.46;box('Surviving ferry deck '+str(j),(x,0,.39),(.425,1.59,.12),'oldwood')
 beam('Broken deck splinter',(-.6,-.5,.37),(.20,-.35,.44),.17,.07,'endgrain')
 box('Rear transverse bench',(1.66,0,.81),(.34,1.62,.13),'oldwood')
 for y in [-.64,.64]:box('Bench leg',(1.66,y,.56),(.16,.16,.40))
 for x in [-2.4,2.4]:box('Hull end iron strap',(x,0,.16),(.13,.55,.10),'iron')
 # Grounded, detached oar inside the broken deck rather than floating outside the hull.
 beam('Discarded oar shaft',(-1.65,.30,.47),(1.15,.50,.51),.07,.07,'endgrain')
 box('Discarded oar blade',(-1.85,.286,.46),(.55,.24,.055),'oldwood',.07)
def dock():
 for x in [-1.25,1.25]:
  for y in [-.68,.68]:
   box('Dock bearing pile',(x,y,.575),(.23,.23,1.15))
   box('Iron pile collar',(x,y,.82),(.255,.255,.09),'iron')
 for y in [-.62,.62]:box('Longitudinal deck bearer',(0,y,.83),(2.96,.21,.24))
 for j in range(12):box('Dock deck plank %02d'%j,(-1.375+j*.25,0,1.015),(.226,1.78,.13),'oldwood' if j%3 else 'timber')
 beam('Dock diagonal brace',(-1.25,-.70,.24),(1.25,-.70,.80),.115,.13,'timber')
def broken():
 for y in [-.62,.62]:beam('Snapped end bearer',(-.68,y,.83),(.66,y,.70),.20,.21)
 for j in range(5):
  x=-.575+j*.25;length=1.75 if j<2 else 1.15-(j-2)*.23
  box('Broken end deck plank %02d'%j,(x,.89-length/2,1.015),(.225,length,.13),'oldwood')
 for y in [-.67,.67]:box('Broken end support',(-.54,y,.51),(.23,.23,1.02))
 beam('Trailing fractured plank',(.37,.70,1.0),(.94,.64,.57),.20,.11,'endgrain')
def mooring():
 for x in [-.48,.48]:
  rings('Mooring post',[(.15,0,0,0),(.145,.80,0,0),(.17,.85,0,0)],'timber',8,center=(x,0),rough=0)
  for z in [.60,.67]:hoop('Attached rope winding',x,0,z,.16)
  box('Bollard cross pin',(x,0,.72),(.52,.115,.105),'iron')
 tube('Sagging attached mooring rope',[(-.48,-.16,.64),(-.25,-.18,.47),(0,-.2,.42),(.25,-.18,.47),(.48,-.16,.64)],[.032]*5,'rope',6)
def winch():
 for y in [-.5,.5]:box('Winch sleeper',(0,y,.11),(1.66,.25,.22))
 for x in [-.56,.56]:
  box('Winch upright',(x,0,.58),(.20,.26,.94))
  beam('Winch angled footing',(x,-.49,.20),(x,0,.8),.13,.15)
 tube('Wooden hauling drum',[(-.50,0,.80),(.50,0,.80)],[.25,.25],'timber',12)
 tube('Iron drum axle',[(-.79,0,.80),(.86,0,.80)],[.065,.065],'iron',8)
 for x in [-.47,.47]:tube('Drum end flange',[(x-.035,0,.80),(x+.035,0,.80)],[.36,.36],'oldwood',12)
 # Helical rope wraps, continuous and seated on the drum.
 pts=[(-.36+.72*k/160,.285*math.cos(k*math.tau/20),.80+.285*math.sin(k*math.tau/20)) for k in range(161)]
 tube('Wound hauling rope',pts,[.034]*len(pts),'rope',6)
 beam('Crank arm',(.83,0,.8),(.83,0,1.25),.085,.085,'iron');beam('Crank grip',(.83,0,1.25),(1.06,0,1.25),.11,.11,'oldwood')
 tube('Attached loose rope end',[(-.36,.285,.8),(-.50,.45,.45),(-.64,.57,.14)],[.034]*3,'rope',6)
def sign():
 box('Sign stone socket',(0,0,.13),(.58,.53,.26),'stone')
 box('Landing sign upright',(0,0,1.43),(.20,.20,2.60))
 box('Sign crossarm',(.32,0,2.55),(1.00,.18,.17),'oldwood')
 for x in [.22,.62]:tube('Sign suspension iron',[(x,0,2.50),(x,0,2.21)],[.022,.022],'iron',6)
 for j in range(2):box('Faded ferry signboard',(.42,0,2.04+j*.17),(.96,.105,.15),'oldwood')
 # Original nonverbal boat pictogram, on the front of a weathered two-plank sign.
 beam('Boat pictogram keel',(.13,-.061,1.998),(.69,-.061,1.998),.027,.027,'rope')
 for a,b in [((.13,-.061,1.998),(.045,-.061,2.085)),((.69,-.061,1.998),(.78,-.061,2.085))]:beam('Boat pictogram stem',a,b,.027,.027,'rope')
 box('Unlit lantern top',(-.36,0,1.69),(.34,.30,.08),'iron');box('Unlit lantern foot',(-.36,0,1.26),(.32,.28,.07),'iron')
 box('Clouded amber lantern panes',(-.36,0,1.475),(.24,.21,.36),'cloth')
 for x in [-.505,-.215]:
  for y in [-.12,.12]:beam('Lantern iron corner',(x,y,1.28),(x,y,1.67),.035,.035,'iron')
 beam('Lantern wall bracket',(0,0,1.88),(-.36,0,1.88),.06,.06,'iron');beam('Lantern hanger',(-.36,0,1.88),(-.36,0,1.73),.04,.04,'iron')
def cargo():
 for j in range(4):
  for side in [-1,1]:box('Crate side plank',(-.35,side*.33,.10+j*.17),(.72,.065,.15),'oldwood')
  for x in [-.71,.01]:box('Crate end plank',(x,0,.10+j*.17),(.065,.61,.15),'timber')
 for y in [-.245,-.08,.085,.25]:box('Crate lid board',(-.35,y,.725),(.75,.145,.10),'oldwood')
 for x in [-.63,-.08]:box('Crate iron binding',(x,-.369,.39),(.055,.025,.69),'iron')
 rings('Washed-up barrel',[(.28,0,0,0),(.34,.22,0,0),(.36,.43,0,0),(.30,.78,0,0)],'oldwood',12,center=(.59,.07),rough=0)
 for z,r in [(.12,.317),(.57,.335),(.73,.310)]:
  rings('Barrel hoop',[(r,z,0,0),(r,z+.045,0,0)],'iron',12,center=(.59,.07),rough=0,cap=False)
 box('Barrel bung',(.59,.07,.79),(.11,.11,.03),'timber')
 beam('Washed-up loose timber',(-.76,-.54,.08),(.73,-.46,.08),.20,.16,'endgrain')
def reeds():
 rock('Silt mound',(0,0,0),(.76,.58,.10),'sand')
 for k in range(13):
  a=k*2.4;r=.16+.30*((k*7%11)/10);x=r*math.cos(a);y=r*math.sin(a);h=.49+(k%4)*.17
  tube('Bent reed stalk',[(x,y,.055),(x+.07,y,.40),(x+.15,y+.06,h)],[.018,.014,.009],'reed',5)
  if k%2==0:tube('Dry cattail',[(x+.15,y+.06,h-.12),(x+.16,y+.064,h+.04)],[.038,.03],'cloth',6)
  beam('Reed blade',(x,y,.17),(x-.15*math.cos(a),y-.15*math.sin(a),h*.66),.055,.012,'moss')
 beam('Stranded driftwood',(-.65,-.35,.12),(.63,-.23,.12),.18,.19,'oldwood')
 rock('River pebble',(.38,.34,.02),(.22,.17,.13),'stone')
LAYOUT=[('wrecked-ferry','stranded-ferry',(3.55,-.95,.12),1.48),('intact-dock','landing-deck',(-1.05,.70,.12),0),('broken-dock','broken-end',(1.14,.70,.12),0),('mooring-posts','dock-bollards',(-.70,1.36,1.20),0),('mooring-posts','bank-bollards',(-3.5,-2.1,.46),.24),('hauling-winch','hauling-winch',(-3.80,.80,.46),0),('landing-sign','old-sign',(-3.60,2.30,.46),0),('washed-cargo','bank-cargo',(-4.05,-.95,.46),-.12),('washed-cargo','upper-bank-cargo',(-4.25,3.65,.46),.35),('reed-debris','south-reeds',(-1.95,-2.95,.13),.2),('reed-debris','north-reeds',(-2.1,3.0,.13),-.3),('reed-debris','ferry-reeds',(1.15,-3.55,.12),.5)]
def assembly():
 # Explicitly removable presentation geometry. Opaque static water, no shader or gameplay water.
 shore=[(-2.10,-4.6),(-2.45,-3.2),(-2.65,-1.7),(-2.55,.0),(-2.40,1.65),(-2.0,3.15),(-2.25,4.6)]
 def slab(name,poly,z0,z1,col):
  n=len(poly);vs=[(x,y,z) for z in [z0,z1] for x,y in poly];faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)];return mesh(name,vs,faces,col)
 slab('Presentation water removable',[(-5.5,-4.6),(5.5,-4.6),(5.5,4.6),(-5.5,4.6)],0,.12,'water')
 slab('Presentation land removable',[(-5.5,-4.6)]+shore+[(-5.5,4.6)],.12,.46,'dirt')
 rock('Presentation ferry silt shoal removable',(3.55,-.95,.03),(1.30,3.28,.13),'sand')
 for j in range(len(shore)-1):
  a=shore[j];b=shore[j+1];beam('Wet shoreline lip',(a[0],a[1],.25),(b[0],b[1],.25),.17,.19,'sand')
 for k in range(16):
  x=-4.85+(k%3)*.7;y=-3.9+(k//3)*1.40
  rock('Bank moss patch',(x,y,.44),(.34,.26,.045),'moss')
 for k in range(12):
  x=-.7+(k%4)*1.65;y=-3.9+(k//4)*3.8
  box('Static water stroke',(x,y,.126),(.42+.12*(k%3),.027,.012),'ripple',.08)
 # Inclined access apron ends on land and the first dock bearer; not a walkability contract.
 for y in [.16,.43,.70,.97,1.24]:beam('Assembly access ramp plank',(-3.05,y,.49),(-2.53,y,1.135),.235,.085,'oldwood')
 for aid,label,p,yaw in LAYOUT:
  for o in bpy.data.collections[aid].objects:
   c=o.copy();c.data=o.data.copy();c.name=label+'/'+o.name;active.objects.link(c);objects.append(c)
   for v in c.data.vertices:x,y,z=v.co;v.co=(p[0]+x*math.cos(yaw)-y*math.sin(yaw),p[1]+x*math.sin(yaw)+y*math.cos(yaw),p[2]+z)
 blueprint={'name':'Reedwake Crossing','scope':'Static original decorative art. No walkability, physics, vehicles, NPCs, quests or performance acceptance.','axis':'glTF Y-up','assemblyOnlyDressing':['Presentation water removable (1 opaque slab)','Presentation land removable (1 raised polygon)','Presentation ferry silt shoal removable (1)','Wet shoreline lip (6)','Bank moss patch (16)','Static water stroke (12)','Assembly access ramp plank (5)'],'reconstruction':'Instances alone do not reconstruct presentation dressing; see assembly() in designs.py. Remove named presentation parts in Blender before re-export to integrate without base/water.','instances':[{'asset':a,'instance':n,'translation':[p[0],p[2],-p[1]],'yawRadians':y,'scale':[1,1,1]} for a,n,p,y in LAYOUT]}
 (OUT/'layout.json').write_text(json.dumps(blueprint,indent=2))
SPECS=[('wrecked-ferry','Ferry and landing','Wrecked River Ferry',ferry),('intact-dock','Ferry and landing','Weathered Dock',dock),('broken-dock','Ferry and landing','Broken Landing End',broken),('mooring-posts','River hardware','Roped Mooring Posts',mooring),('hauling-winch','River hardware','Abandoned Hauling Winch',winch),('landing-sign','Bank details','Ferry Sign and Lantern',sign),('washed-cargo','Bank details','Washed-up Cargo',cargo),('reed-debris','Bank details','Reeds and Driftwood',reeds),('reedwake-crossing','Assembled landmark','Reedwake Crossing',assembly)]
