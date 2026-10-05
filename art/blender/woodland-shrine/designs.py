"""Mossveil Sanctuary: original script-authored woodland ruins. Static visual art only."""
PAL.update({'stone':(.43,.37,.27),'lightstone':(.60,.53,.39),'moss':(.22,.29,.12),'dirt':(.25,.20,.12),'bark':(.24,.16,.095),'leaf':(.24,.33,.14),'carving':(.18,.17,.105),'altarstone':(.37,.305,.21)})
def box(name,p,s,col='stone',yaw=0):
 x,y,z=p;dx,dy,dz=s;vs=[]
 for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  u=a*dx/2;v=b*dy/2;vs.append((x+u*math.cos(yaw)-v*math.sin(yaw),y+u*math.sin(yaw)+v*math.cos(yaw),z+c*dz/2))
 ob=mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],col)
 # Shallow single-segment bevels create worn, chipped-looking masonry edges.
 if col in ['stone','lightstone','altarstone']:
  import bmesh
  bm=bmesh.new();bm.from_mesh(ob.data)
  bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(.043,min(s)*.17),segments=1,affect='EDGES')
  bm.to_mesh(ob.data);bm.free();ob.data.update()
 return ob
def sprig(x,y,z=0):
 for k in range(4):
  a=k*2.4;tube('Woodland grass',[(x,y,z),(x+.11*math.cos(a),y+.11*math.sin(a),z+.23+k*.025)],[.025,.006],'moss',4)
def arch():
 for side in [-1,1]:
  box('Arch foundation',(side*1.28,0,.13),(.94,.98,.26),'lightstone')
  for j in range(4):box('Weathered pier course',(side*1.28+.025*math.sin(j),0,.49+j*.43),(.66,.71,.40),'stone',.015*math.sin(j))
  box('Worn springer capital',(side*1.28,0,2.03),(.86,.85,.22),'lightstone')
 # Radial wedge blocks. Missing crown turns the arch into a distinct ruin.
 for j in list(range(0,5))+list(range(7,12)):
  a=j*math.pi/12+.006;b=(j+1)*math.pi/12-.006;vs=[]
  for y in [-.35,.35]:
   for r,t in [(1.0,a),(1.56,a),(1.56,b),(1.0,b)]:vs.append((r*math.cos(t),y,2.04+r*math.sin(t)))
  mesh('Radial arch voussoir '+str(j),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'lightstone' if j%3==0 else 'stone')
 for x in [-1.3,1.25]:rock('Moss over capital',(x,-.02,2.14),(.37,.40,.08),'moss')
 rock('Fallen crown block',(.45,-.65,0),(.42,.34,.30),'lightstone');sprig(-1.65,-.3)
def altar():
 box('Altar broad foot',(0,0,.12),(1.82,1.22,.24),'lightstone')
 box('Weathered altar monolith',(0,0,.64),(1.44,.90,.88),'altarstone')
 box('Chipped table slab',(0,0,1.15),(1.95,1.28,.23),'lightstone',.025)
 # Original sun-and-paired-leaf relief on front, readable without emissive effects.
 pts=[(.23*math.cos(k*math.tau/12),-.467,.69+.23*math.sin(k*math.tau/12)) for k in range(13)]
 tube('Sun ring relief',pts,[.023]*13,'carving',5)
 for k in range(8):
  a=k*math.tau/8;tube('Sun ray',[(.29*math.cos(a),-.475,.69+.29*math.sin(a)),(.37*math.cos(a),-.475,.69+.37*math.sin(a))],[.021,.013],'carving',5)
 for side in [-1,1]:
  tube('Leaf stem',[(0,-.485,.40),(side*.29,-.485,.47),(side*.49,-.485,.69)],[.018,.018,.008],'carving',5)
  rock('Leaf relief',(side*.38,-.48,.45),(.115,.035,.18),'moss')
 rock('Altar moss corner',(-.69,.36,1.27),(.22,.21,.055),'moss')
 for k in range(3):rock('Small dry offering pebble',(.24+k*.15,.1,1.265),(.055,.065,.04),'carving')
def basin():
 rings('Basin stepped foot',[(.66,0,0,0),(.66,.15,0,0),(.46,.24,0,0)],'stone',n=10,rough=.025)
 # continuous closed vessel section: exterior, rim, interior, recessed dry bottom
 rings('Dry hollow offering bowl',[(.40,.23,0,0),(.71,.61,0,0),(.69,.72,0,0),(.53,.72,0,0),(.34,.37,0,0)],'lightstone',n=12,rough=0)
 for k in range(3):rock('Dry leaf in bowl',(-.14+k*.13,.07*math.sin(k),.38),(.07,.035,.015),'bark')
def columns():
 rings('Broken standing column foot',[(.58,0,0,0),(.58,.18,0,0),(.39,.22,0,0),(.38,.91,0,0),(.29,1.03,.03,0)],'stone',n=8,rough=.05,center=(-.67,.24))
 tube('Fallen octagonal shaft',[(.05,-.25,.34),(1.17,.38,.34)],[.32,.32],'lightstone',8)
 box('Detached square capital',(.85,-.57,.14),(.77,.66,.28),'stone',.3)
 rock('Moss across broken foot',(-.68,.22,1.02),(.22,.26,.04),'moss')
def wall():
 for j in range(3):
  for k in range(5-j):box('Ruined wall ashlar',(-1.25+k*.62+j*.12,0,.22+j*.40),(.58,.57,.38),'stone',.015*math.sin(k+j))
 for k in range(4):rock('Wall cap moss',(-1.12+k*.50,.03,1.21 if k<3 else .82),(.31,.30,.08),'moss')
 for k in range(4):rock('Wall foot rubble',(.45+k*.29,-.43,.0),(.23,.26,.19),'lightstone')
 sprig(-1.42,-.32)
def paving():
 for j in range(3):
  for k in range(3):
   x=(k-1)*.66+.03*math.sin(j+k);y=(j-1)*.65
   box('Worn paving flag',(x,y,.075),(.61,.59,.15),'lightstone' if (j+k)%3==0 else 'stone',.028*math.sin(j*4+k))
 for x,y in [(-.35,-.34),(.33,.34)]:sprig(x,y,.14)
def markers():
 for k in range(3):
  x=(k-1)*.60;y=.14*math.sin(k);h=.60+k*.14
  rock('Votive marker base',(x,y,0),(.29,.26,.12),'stone')
  box('Upright votive tablet',(x,y,h/2+.1),(.30,.21,h),'lightstone',.04*(k-1))
  tube('Incised votive stem',[(x,y-.115,.27),(x,y-.115,h*.83)],[.015,.015],'carving',4)
  for side in [-1,1]:tube('Votive leaf stroke',[(x,y-.12,h*.55),(x+side*.095,y-.12,h*.70)],[.012,.012],'carving',4)
 sprig(.8,-.14)
def tree():
 tube('Ancient twisting trunk',[(0,0,.24),(-.28,.05,.85),(-.17,.18,1.65),(.25,.15,2.30),(.36,.20,3.0),(.15,.25,3.85)],[.55,.47,.39,.31,.23,.075],'bark',9)
 for k in range(7):
  a=k*math.tau/7;end=(1.42*math.cos(a),1.42*math.sin(a),.025)
  tube('Spreading ancient root',[(0,0,.45),(.65*math.cos(a),.65*math.sin(a),.17),end],[.25,.17,.045],'bark',6)
 for k in range(5):
  a=k*2.4;z=2.1+k*.22;tip=(1.30*math.cos(a),1.18*math.sin(a),3.35+k*.18)
  tube('Crooked bough',[(.05,.15,z),(.79*math.cos(a),.72*math.sin(a),z+.35),tip],[.20,.13,.035],'bark',7)
  rock('Sparse woodland crown',tip,(.83,.73,.49),'leaf')
 rock('Upper crown',(.15,.25,3.75),(.89,.80,.57),'moss')
 for a in [1,3,5]:rock('Root moss',(math.cos(a)*.53,math.sin(a)*.53,.15),(.24,.19,.065),'moss')
LAYOUT=[('broken-sun-arch','arch',(0,1.8,.12),0),('sunleaf-altar','altar',(0,.65,.27),0),('dry-offering-basin','basin',(-1.9,-.8,.12),0),('fallen-columns','fallen-east',(2.35,-.7,.12),.35),('mossy-wall','rear-wall',(-2.2,2.6,.12),-.22),('mossy-wall','east-wall',(2.65,2.4,.12),.28),('worn-paving','sanctum-floor',(0,.65,.12),0),('worn-paving','approach',(0,-1.35,.12),0),('votive-markers','west-votives',(-2.6,-2.1,.12),.16),('votive-markers','east-votives',(2.0,-2.8,.12),-.22),('ancient-root-tree','guardian-tree',(-3.35,1.1,.12),.15)]
def assembly():
 rings('Sanctuary earth skirt',[(5.3,0,0,0),(5.25,.12,0,0)],'dirt',n=28,rough=0)
 for k in range(26):
  a=k*2.4;rr=2.6+1.85*((k*7%13)/12);rock('Muted grass verge',(rr*math.cos(a),rr*math.sin(a),.085),(.30+.17*(k%3),.28+.08*(k%4),.07),'moss')
 for x,y in [(-2,-2.7),(3.1,-2),(3.3,1.2),(-3.8,-.8),(1.3,-3.6)]:sprig(x,y,.12)
 for aid,label,p,yaw in LAYOUT:
  for o in bpy.data.collections[aid].objects:
   c=o.copy();c.data=o.data.copy();c.name=label+'/'+o.name;active.objects.link(c);objects.append(c)
   for v in c.data.vertices:x,y,z=v.co;v.co=(p[0]+x*math.cos(yaw)-y*math.sin(yaw),p[1]+x*math.sin(yaw)+y*math.cos(yaw),p[2]+z)
 blueprint={'name':'Mossveil Sanctuary','scope':'Static decorative art only; no gameplay, walkability or collision acceptance.','axis':'glTF Y-up','assemblyOnlyDressing':['Sanctuary earth skirt','Muted grass verge (26)','Woodland grass clusters (5 x 4)'],'instances':[{'asset':a,'instance':n,'translation':[p[0],p[2],-p[1]],'yawRadians':y,'scale':[1,1,1]} for a,n,p,y in LAYOUT]}
 (OUT/'layout.json').write_text(json.dumps(blueprint,indent=2))
SPECS=[('broken-sun-arch','Ruined masonry','Broken Sun Arch',arch),('mossy-wall','Ruined masonry','Mossy Ruin Wall',wall),('worn-paving','Woodland relics','Worn Sanctuary Paving',paving),('votive-markers','Woodland relics','Leaf Votive Markers',markers),('dry-offering-basin','Sacred details','Dry Offering Basin',basin),('sunleaf-altar','Sacred details','Sunleaf Carved Altar',altar),('fallen-columns','Sacred details','Fallen Column Fragments',columns),('ancient-root-tree','Sacred details','Ancient Root Tree',tree),('mossveil-sanctuary','Assembled sanctuary','Mossveil Sanctuary',assembly)]
