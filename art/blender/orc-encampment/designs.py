"""Grimroot Warcamp: original modular landmark art; no NPCs or gameplay behavior."""
PAL.update({'timber':(.20,.105,.04),'cutwood':(.37,.23,.10),'hide':(.31,.13,.07),'hidepatch':(.43,.21,.105),'cloth':(.39,.055,.025),'bone':(.72,.66,.46),'rope':(.39,.30,.16),'iron':(.085,.09,.075),'coal':(.055,.045,.035),'ember':(.67,.20,.035),'sack':(.40,.34,.18),'dirt':(.21,.17,.095),'moss':(.20,.27,.095)})
def box(name,p,s,col='timber',yaw=0):
 vs=[];x,y,z=p;dx,dy,dz=s
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
def hide_panel(name,points,col='hide'):
 # Two separate offset surfaces, not coplanar opposite faces.
 o=mesh(name,points,[tuple(range(len(points)))],col)
 normal=o.data.polygons[0].normal.copy()
 bottom=[tuple(Vector(p)-normal*.025) for p in points]
 mesh(name+' underside',bottom,[tuple(reversed(range(len(points))))],col)
 return o
def stake(name,x,y,h=2,r=.13):
 tube(name,[(x,y,0),(x+.03*math.sin(h),y,h-.22),(x+.02,y,h)],[r,r*.9,.018],'timber',7)
def binding(name,p,axis='z',r=.15):
 x,y,z=p
 for j in range(3):
  rings(name+' rope wrap '+str(j),[(r,z+j*.045,x,y),(r,z+j*.045+.027,x,y)],'rope',n=9,rough=0)
def tusk(name,x,y,z,s=1,side=1):
 tube(name,[(x,y,z),(x+side*.22*s,y,z+.44*s),(x+side*.14*s,y,z+.86*s),(x-side*.15*s,y,z+1.12*s)],[.16*s,.13*s,.075*s,.009*s],'bone',8)
def tent():
 # Patched hide canopy, ridge along Y; front flaps leave a genuine visual opening.
 for side in [-1,1]:
  for row in range(3):
   y0=-1.5+row; y1=y0+1
   for k in range(3):
    u0=k/3;u1=(k+1)/3
    def point(u,y):return (side*(.06+1.36*u),y,2.18*(1-u)+.22*u+.06*math.sin(y*2))
    points=[point(u0,y0),point(u1,y0),point(u1,y1),point(u0,y1)]
    if side<0:points.reverse()
    hide_panel('Stitched canopy '+str(side)+' '+str(row)+' '+str(k),points,'hidepatch' if (row+k)%3==0 else 'hide')
  hide_panel('Torn entrance flap '+str(side),[(side*.1,-1.53,2.12),(side*1.43,-1.53,.18),(side*.74,-1.58,.12),(side*.53,-1.56,1.36)],'cloth')
  stake('Front ridge support '+str(side),side*1.05,-1.73,1.92,.12);tusk('Entrance tusk '+str(side),side*1.05,-1.74,1.5,.72,-side)
  for y in [-1.2,.25,1.25]:
   stake('Hide peg',side*1.84,y,.25,.075);tube('Guyline',[(side*1.37,y,.31),(side*1.84,y,.13)],[.022,.022],'rope',5)
  # Pale stitches across canopy seams, with offset above the hide.
  for y in [-.5,.5]:
   for k in range(5):
    u=.13+k*.16;x=side*(.06+1.36*u);z=2.18*(1-u)+.22*u+.06*math.sin(y*2)+.023
    tube('Hide seam stitch',[(x,y-.045,z),(x,y+.045,z)],[.014,.014],'rope',5)
 tube('Tent ridge spine',[(0,-1.6,2.22),(0,1.6,2.2)],[.06,.075],'timber',7)
 hide_panel('Rear hide closure',[(-1.4,1.51,.2),(1.4,1.51,.2),(0,1.51,2.18)],'hide')
 box('Tent hide floor',(0,.15,.035),(2.23,2.65,.07),'hidepatch')
 tube('Rolled sleeping hide',[(-.65,.98,.17),(.58,.98,.17)],[.14,.14],'sack',9)
 box('Entrance hide mat',(0,-1.95,.026),(1.17,.82,.052),'hidepatch');rock('Tent rear stone',(0,1.55,0),(.36,.25,.25),'stone')
def wall():
 for k in range(13):stake('Hewn wall stake '+str(k),-1.8+k*.3,.055*math.sin(k*2),1.7+.32*(.5+.5*math.sin(k*2.3)),.155)
 for z in [.58,1.22]:tube('Back crossbeam',[(-1.95,.16,z),(1.95,.16,z)],[.08,.08],'cutwood',7)
 for x in [-1.5,0,1.5]:binding('Wall lashing',(x,0,1.02),r=.18)
 for x in [-1.4,1.4]:tube('Raking support',[(x,.19,1.13),(x,.85,.04)],[.1,.1],'timber',7)
def gate():
 for x in [-1.35,1.35]:
  stake('Gate main post',x,0,2.8,.24);binding('Gate lashing',(x,0,2.13),r=.255);tusk('Gate crown tusk',x,0,2.4,.65,-1 if x<0 else 1)
 tube('Crooked gate lintel',[(-1.65,0,2.36),(0,-.06,2.19),(1.65,0,2.4)],[.13,.16,.13],'timber',8)
 for side in [-1,1]:
  for k in range(3):stake('Gate wing stake',side*(1.7+k*.28),0,1.65+.2*math.sin(k),.15)
  tube('Gate diagonal brace',[(side*2.25,.14,.45),(side*1.48,.14,1.58)],[.07,.07],'cutwood',6)
 hide_panel('Gate torn clan pennant',[(-.28,-.18,2.23),(.28,-.18,2.23),(.24,-.18,1.75),(0,-.18,1.91),(-.24,-.18,1.75)],'cloth')
 # Original tooth-shaped clan emblem, not copied insignia.
 mesh('Bone tooth emblem',[(-.09,-.207,2.12),(.09,-.207,2.12),(0,-.207,1.91)],[(0,2,1)],'bone')
def lookout():
 for x in [-.63,.63]:
  for y in [-.63,.63]:stake('Lookout support',x,y,3.12 if y>0 else 2.99,.13);binding('Platform rope',(x,y,1.8),r=.145)
 for k in range(7):box('Uneven lookout decking '+str(k),(-.75+k*.25,0,1.86+.018*math.sin(k)),(.235,1.7,.13),'cutwood')
 for y in [-.7,.7]:
  tube('Platform bearer',[(-.85,y,1.72),(.85,y,1.72)],[.12,.12],'timber',7)
  tube('Crossbrace',[(-.65,y,.25),(.65,y,1.64)],[.08,.08],'timber',6)
 # Front opening for ladder, two rear/side guardrails.
 for x in [-.66,.66]:tube('Side guardrail',[(x,-.65,2.56),(x,.65,2.56)],[.08,.08],'timber',7)
 tube('Rear guardrail',[(-.66,.65,2.56),(.66,.65,2.56)],[.08,.08],'timber',7)
 for x in [-.26,.26]:tube('Ladder side',[(x,-1.28,.05),(x,-.78,1.94)],[.055,.055],'cutwood',6)
 for k in range(7):
  z=.2+k*.25;y=-1.28+(z-.05)/1.89*.5;tube('Ladder rung',[(-.29,y,z),(.29,y,z)],[.04,.04],'cutwood',6)
 tube('Front awning beam',[(-.81,-.65,2.86),(.81,-.65,2.86)],[.055,.055],'timber',7)
 tube('Rear awning beam',[(-.81,.65,3.02),(.81,.65,3.02)],[.055,.055],'timber',7)
 hide_panel('Lookout rag awning',[(-.91,-.72,2.91),(.91,-.72,2.88),(.85,.85,3.04),(-.85,.85,3.1)],'hide')
def cookpit():
 for k in range(12):a=k*math.tau/12;rock('Fire ring stone '+str(k),(.63*math.cos(a),.63*math.sin(a),0),(.19,.18,.23),'stone')
 rings('Charcoal bed',[(.52,0,0,0),(.53,.08,0,0)],'coal',n=14,rough=.08)
 for k in range(6):
  a=k*2.4;rock('Dull ember '+str(k),(.3*math.cos(a),.3*math.sin(a),.08),(.12,.1,.07),'ember')
 for x in [-.83,.83]:
  tube('Fork cooking support',[(x,0,0),(x,0,1.26)],[.09,.06],'timber',7)
  tube('Fork prong',[(x,0,1.04),(x-.15,0,1.32)],[.05,.035],'timber',6)
 tube('Cooking crossbar',[(-1.02,0,1.21),(1.02,0,1.21)],[.055,.055],'iron',8)
 for x in [-.36,.36]:tube('Pot hanger',[(x,0,1.23),(x,0,.82)],[.026,.026],'iron',5)
 rings('Open iron cauldron',[(.19,.36,0,0),(.35,.48,0,0),(.4,.75,0,0),(.37,.84,0,0),(.32,.84,0,0),(.3,.55,0,0)],'iron',n=14,rough=0,cap=False)
 rings('Cauldron contents',[(.29,.6,0,0),(.29,.62,0,0)],'mud',n=14,rough=0)
def cage():
 for k in range(6):box('Cage floor plank',(-.65+k*.26,0,.18),(.245,1.3,.16),'cutwood')
 for x in [-.72,.72]:
  for y in [-.62,.62]:stake('Cage corner post',x,y,1.9,.09)
 for side in [-1,1]:
  for k in range(5):
   x=-.6+k*.3;tube('Cage front/back bar',[(x,side*.62,.28),(x,side*.62,1.67)],[.029,.029],'iron',6)
  for k in range(4):
   y=-.45+k*.3;tube('Cage side bar',[(side*.72,y,.28),(side*.72,y,1.67)],[.029,.029],'iron',6)
  box('Cage upper front rail',(0,side*.62,1.68),(1.54,.13,.14),'cutwood');box('Cage upper side rail',(side*.72,0,1.68),(.13,1.35,.14),'cutwood')
 for k in range(6):box('Cage lid slat',(-.65+k*.26,0,1.8),(.21,1.4,.09),'timber')
 box('Cage latch',(0,-.68,.83),(.16,.065,.16),'iron');box('Cage straw bed',(0,0,.3),(.83,.71,.04),'sack')
def trophy():
 stake('Totem crooked pole',0,0,2.48,.16);binding('Totem lashing',(0,0,1.69),r=.18)
 tube('Trophy crossbar',[(-.62,0,1.82),(.62,0,1.82)],[.09,.09],'cutwood',7)
 for s in [-1,1]:tusk('Ceremonial tusk',s*.3,-.02,1.79,.55,s)
 hide_panel('Clan standard',[(-.46,-.05,1.77),(.46,-.05,1.77),(.41,-.08,.53),(0,-.08,.76),(-.42,-.08,.51)],'cloth')
 mesh('Clan tooth emblem',[(-.18,-.105,1.49),(.18,-.105,1.49),(0,-.105,.94)],[(0,2,1)],'bone')
 for k in range(5):a=k*math.tau/5;rock('Totem footing',(.32*math.cos(a),.3*math.sin(a),0),(.23,.2,.2),'stone')
def supplies():
 for x,y,z,sz in [(-.42,.25,.35,.7),(.34,.35,.27,.54),(-.4,.23,.94,.5)]:
  box('Loot-free supply crate',(x,y,z),(sz,sz,sz),'cutwood')
  for zz in [z-sz*.35,z+sz*.35]:
   for yy in [y-sz/2-.015,y+sz/2+.015]:box('Crate binding',(x,yy,zz),(sz+.04,.045,.07),'iron')
  tube('Crate diagonal slat',[(x-sz*.4,y-sz/2-.04,z-sz*.38),(x+sz*.4,y-sz/2-.04,z+sz*.38)],[.035,.035],'timber',4)
 for k in range(3):
  x=-.5+k*.5;y=-.43;r=.25+.03*math.sin(k)
  rings('Tied supply sack '+str(k),[(r*.7,0,x,y),(r,.15,x,y),(r*.83,.43,x,y),(.07,.57,x,y),(.1,.64,x,y)],'sack',n=9,rough=.08)
 tube('Spare spear shaft',[(-.92,.1,.07),(.5,.6,1.25)],[.025,.025],'timber',6)
 tube('Spare spearhead',[(.5,.6,1.25),(.68,.66,1.42)],[.075,.004],'iron',6)

# Blueprint coordinates below are Blender Z-up; yaw maps directly to glTF Y-up yaw.
LAYOUT=[('war-tent','chieftain',(0,2.5,.10),0),('palisade-gate','entry',(0,-3.9,.10),0),('palisade-wall','west-front',(-4,-1.85,.10),math.pi/2),('palisade-wall','west-back',(-4,1.85,.10),math.pi/2),('palisade-wall','east-front',(4,-1.85,.10),-math.pi/2),('palisade-wall','east-back',(4,1.85,.10),-math.pi/2),('palisade-wall','rear-left',(-1.95,4.2,.10),0),('palisade-wall','rear-right',(1.95,4.2,.10),0),('lookout-platform','lookout',(-2.55,2.75,.10),0),('cooking-pit','hearth',(-1.15,-.15,.10),0),('empty-cage','cage',(2,.5,.10),-.12),('trophy-standard','standard',(1.75,-1.4,.10),.12),('supply-pile','stores',(2.65,2.8,.10),.3),('supply-pile','provisions',(-2.65,.35,.10),-.4)]
SCALES={}
def assembly():
 rings('Camp earth skirt',[(6.2,0,0,0),(6.0,.1,0,0)],'dirt',n=24,rough=.045)
 for k in range(15):
  a=k*2.4;r=5.3+.45*math.sin(k);rock('Camp edge rubble '+str(k),(r*math.cos(a),r*math.sin(a),.045),(.24,.2,.12),'stone')
 for side in [-1,1]:
  for k in range(5):
   # Full-size stakes on normal spacing: no compressed repeated wall geometry.
   before=len(objects);stake('Front infill stake '+str(side)+' '+str(k),side*(2.55+k*.3),-3.9,1.66+.15*math.sin(k*2),.15)
   for o in objects[before:]:
    for v in o.data.vertices:v.co.z+=.1
  for z in [.65,1.3]:tube('Front infill rail '+str(side),[(side*2.45,-3.73,z),(side*3.95,-3.73,z)],[.07,.07],'cutwood',7)
 for aid,label,p,yaw in LAYOUT:
  source=bpy.data.collections[aid]
  for o in source.objects:
   c=o.copy();c.data=o.data.copy();c.name=label+'/'+o.name;active.objects.link(c);objects.append(c)
   scale=SCALES.get(label,(1,1,1))
   for v in c.data.vertices:x,y,z=v.co;x*=scale[0];y*=scale[1];z*=scale[2];v.co=(p[0]+x*math.cos(yaw)-y*math.sin(yaw),p[1]+x*math.sin(yaw)+y*math.cos(yaw),p[2]+z)
 blueprint={'name':'Grimroot Warcamp','scope':'Decorative prefab only. No authoritative collision, spawn, loot or encounter data.','axis':'glTF Y-up','assemblyOnlyDressing':['Camp earth skirt','Camp edge rubble (15)','Front infill full-size stakes (10) and rails (4)'],'instances':[{'asset':a,'instance':n,'translation':[p[0],p[2],-p[1]],'yawRadians':y,'scale':[SCALES.get(n,(1,1,1))[0],SCALES.get(n,(1,1,1))[2],SCALES.get(n,(1,1,1))[1]]} for a,n,p,y in LAYOUT]}
 (OUT/'layout.json').write_text(json.dumps(blueprint,indent=2))
SPECS=[('war-tent','Structures','Chieftain’s Hide',tent),('palisade-gate','Structures','Tuskbound Gate',gate),('lookout-platform','Structures','Ragged Lookout',lookout),('palisade-wall','Structures','Hewn Palisade',wall),('cooking-pit','Camp details','Ironpot Hearth',cookpit),('empty-cage','Camp details','Empty Holding Cage',cage),('trophy-standard','Camp details','Grimroot Standard',trophy),('supply-pile','Camp details','Raider Provisions',supplies),('grimroot-camp','Assembled camp','Grimroot Warcamp',assembly)]
