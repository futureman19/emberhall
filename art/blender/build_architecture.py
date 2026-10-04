"""Worldwide architecture exteriors. Regeneration overwrites architecture files ONLY.
Sources retain named editable parts and original materials. Export copies alone are joined/baked.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Use -- --verify to independently reopen saved editable source and check roof normals.
"""
import bpy, math, json, sys, struct, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
SOURCE=ROOT/'art/blender/architecture-kit.blend'
HOUSING={
 'shop':(-4,4,-3,3,3,-1,2), 'townhome':(-4,4,-3,3,3,0,2),
 'townhouse':(-3,3,-3,3,5,-1,2), 'cottage':(-3,3,-2,2,2,0,1),
 'porch':(-2,2,-1,1,2,0,1), 'hut':(-3,3,-2,2,3,0,1),
 'homestead':(-3,3,-3,3,5,-1,2),
}
KITS=list(HOUSING)+['rampart','rampartV','tower','gatehouse']
if '--verify' in sys.argv:
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
 result={}
 for kit in KITS:
  obs=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
  tops=[o for o in obs if o.get('roof_top')]
  assert len(obs)>10 and any(o.modifiers for o in obs)
  assert all(p.normal.z>0 for o in tops for p in o.data.polygons)
  assert all(not o.data.color_attributes for o in obs if o.type=='MESH')
  assert len({m.name for o in obs for m in o.data.materials})>=3
  if kit in HOUSING: assert tops and any(o.type=='CURVE' for o in obs)
  result[kit]={'editableParts':len(obs),'roofSurfaces':len(tops),'upwardRoofNormals':True,'exportOnlyColors':True}
 print('SOURCE_REOPEN_VERIFIED '+json.dumps(result))
 sys.exit(0)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
KIT='shop'
def mat(name, rgb, emission=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .86
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m
stone = mat('warm softened limestone stone', (.43,.43,.33))
cream = mat('honey lime plaster', (.72,.61,.43))
wood = mat('carved walnut timber', (.15,.075,.038))
roofs = [mat('chestnut shingles '+str(i), (.19+i*.025,.09+i*.016,.045+i*.01)) for i in range(3)]
gold = mat('antique gold', (.72,.43,.12))
red = mat('oxblood civic enamel', (.40,.045,.035))
glow = mat('restrained honey ember', (1,.38,.065), .55)
def xyz(p): return (p[0],-p[2],p[1])
def tag(o, name, material):
    o.name = KIT+' '+name; o['kit'] = KIT; o['render_only'] = True
    o.data.materials.append(material); return o

def mesh(name, points, faces, material):
    data = bpy.data.meshes.new(KIT+' '+name)
    data.from_pydata([xyz(p) for p in points], [], faces); data.update()
    o = bpy.data.objects.new(KIT+' '+name, data); bpy.context.collection.objects.link(o)
    return tag(o,name,material)

def box(name, p, size, material=wood, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p)); o = bpy.context.object
    o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    tag(o,name,material)
    m=o.modifiers.new('crafted softened edges','BEVEL'); m.width=bevel; m.segments=1
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); return o

def line(name, points, radius=.035, material=wood):
    data=bpy.data.curves.new(KIT+' '+name,'CURVE'); data.dimensions='3D'; data.resolution_u=2
    data.bevel_depth=radius; data.bevel_resolution=1
    s=data.splines.new('POLY'); s.points.add(len(points)-1)
    for p,v in zip(s.points,points): p.co=(*xyz(v),1)
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); return tag(o,name,material)

def arch(name,x,y,z,w,h,material):
    pts=[(x-w/2,y,z),(x+w/2,y,z)]
    pts += [(x+math.cos(a)*w/2,y+h-w/2+math.sin(a)*w/2,z) for a in [i*math.pi/12 for i in range(13)]]
    return mesh(name,pts,[tuple(range(len(pts)))],material)

def roof(cx,cz,w,d,y,h):
    def point(u,v,lift=0):
        return (cx+u*w/2,y+h*(1-abs(v))**1.6+.13*abs(v)**8+.07*u*u+lift,cz+v*d/2)
    pts=[point(-1+i/4,-1+j/6) for i in range(9) for j in range(13)]
    faces=[(i*13+j,i*13+j+1,(i+1)*13+j+1,(i+1)*13+j) for i in range(8) for j in range(12)]
    o=mesh('continuous bowed roof shell',pts,faces,roofs[0]); o['roof_top']=True
    o.modifiers.new('solid roof boards','SOLIDIFY').thickness=.085
    for side in [-1,1]:
        for row in range(5):
            for col in range(8):
                ua=-1+col/4; ub=ua+.24; va=side*row/5; vb=side*min(1,(row+1.09)/5)
                pts=[point(u,v,.025) for u,v in [(ua,va),(ub,va),(ub,vb),(ua,vb)]]
                o=mesh('individual bowed shingle',pts,[(3,2,1,0) if side>0 else (0,1,2,3)],roofs[(row+col)%3]); o['roof_top']=True
    for u in [-1,1]: line('curved gable verge',[point(u,-1+j/6,.01) for j in range(13)],.055)
    for v in [-1,1]: line('rolled timber eave',[point(-1+i/4,v) for i in range(9)],.065)
    line('bowed ridge cap',[point(-1+i/4,0,.045) for i in range(9)],.065)



def window(x,y,z,w=.42,h=.65):
 box('carved window surround',(x,y,z),(w+.14,h+.14,.10))
 box('warm honey window',(x,y,z+.06),(w,h,.035),glow,.014)
 box('slender window mullion',(x,y,z+.09),(.035,h,.035),wood,.005)
 box('gold window sill',(x,y-h/2-.05,z+.04),(w+.21,.09,.19),gold,.018)

def banner(x,y,z,h=.57):
 box('crimson hanging banner',(x,y,z),(.28,h,.045),red,.018)
 box('gold banner cap',(x,y+h/2,z+.029),(.31,.04,.02),gold,.005)
 line('gold stitched banner chevron',[(x-.10,y-h/2+.15,z+.027),(x,y-h/2+.08,z+.027),(x+.1,y-h/2+.15,z+.027)],.012,gold)

doors={}
for KIT,(x0,x1,z0,z1,h,dx,dw) in HOUSING.items():
 left=x0*.5; right=(x1+1)*.5; rear=z0*.5+.16; front=(z1+.5)*.5
 cx=(left+right)/2; cz=(rear+front)/2; top=max(2.14,(h+1)*.5)
 a=dx*.5-.065; b=(dx+dw)*.5+.065
 doors[KIT]={'axis':'z','min':dx*.5,'max':(dx+dw)*.5,'front':(z1+1)*.5,'clearBottom':.52,'clearTop':min(1.90,top-.2)}
 for x in [left+.15,right-.15]:
  box('lime plaster side',(x,top/2,cz),(.30,top,front-rear+.30),cream)
  box('stone plinth side',(x,.17,cz),(.32,.34,front-rear+.30),stone)
  line('side diagonal brace',[(x+(-.16 if x<cx else .16),.48,rear+.2),(x+(-.16 if x<cx else .16),top-.12,front-.25)],.04)
 box('rear plaster',(cx,top/2,rear),(right-left,top,.30),cream)
 box('rear plinth',(cx,.17,rear),(right-left,.34,.32),stone)
 for aa,bb in [(left,a),(b,right)]:
  box('front plaster wing',((aa+bb)/2,top/2,front),(bb-aa,top,.28),cream)
  box('front stone plinth',((aa+bb)/2,.17,front),(bb-aa,.34,.30),stone)
  if bb-aa>.62: window((aa+bb)/2,1.22,front+.17,min(.56,bb-aa-.3),.62)
 for x in [left+.08,a-.08,b+.08,right-.08]:
  box('front oak upright',(x,top/2,front+.17),(.13,top,.12))
  box('gold joinery pin',(x,top-.2,front+.244),(.045,.045,.018),gold,.006)
 box('open doorway lintel',((a+b)/2,top-.08,front+.14),(b-a+.23,.16,.20))
 box('long timber top plate',(cx,top-.04,rear),(right-left,.14,.36))
 for x in [left+.09,right-.09]: box('rear oak corner',(x,top/2,rear-.13),(.14,top,.15))
 if h==5:
  box('upper story cross beam',(cx,2.15,front+.17),(right-left,.12,.12))
  for aa,bb in [(left,a),(b,right)]:
   x=(aa+bb)/2
   line('upper diagonal brace',[(x-.20,2.24,front+.19),(x+.20,top-.13,front+.19)],.04)
 roof(cx,cz,right-left+.46,front-rear+.78,top+.06,.68 if h<4 else 1.0)
 banner(right-.30,top-.40,front+.25,.55)
 if KIT in ['cottage','hut','townhome','homestead']:
  x=right-.45; z=rear+.38
  box('masonry chimney',(x,top+.36,z),(.38,1.48,.40),stone,.04)
  for y in [top+.7,top+1.10]: box('chimney cap course',(x,y,z),(.49,.10,.51),cream,.025)
  box('soot chimney mouth',(x,top+1.16,z),(.30,.015,.32),wood,.005)
 if KIT=='shop':
  # A high hood, never a post or door across the existing passage.
  for i in range(6):
   xx=left+.35+i*(right-left-.7)/6
   box('crimson gold shop awning',(xx+(right-left-.7)/12,top+.07,front+.48),((right-left-.7)/6,.08,.75),red if i%2==0 else gold,.025)
 elif KIT=='porch':
  # Porch is canonically a tiny enterable house, not a new open navigation surface.
  line('porch ridge flourish',[(cx-.15,top+.86,cz),(cx,top+.96,cz),(cx+.15,top+.86,cz)],.025,gold)
 elif KIT=='hut':
  for x in [left+.48,right-.48]:
   box('crimson window flowerbox',(x,.65,front+.29),(.43,.20,.25),red)
 elif KIT=='homestead':
  banner(left+.3,top-.4,front+.25)

for KIT in ['rampart','rampartV']:
 vertical=KIT=='rampartV'
 def p(x,y,z): return (z,y,x) if vertical else (x,y,z)
 def size(x,y,z): return (z,y,x) if vertical else (x,y,z)
 box('continuous stone curtain',p(0,1.25,0),size(8,2.5,1),stone,.055)
 for y in [.12,.72,1.34,1.96,2.45]:
  box('soft masonry course',p(0,y,0),size(8,.095,1.025),cream,.02)
 for x in [-3.75,-2.75,-1.75,-.75,.25,1.25,2.25,3.25]:
  box('rounded stone merlon',p(x,2.75,-.25),size(.5,.5,.5),stone,.06)
  box('merlon cap',p(x,3.005,-.25),size(.52,.07,.52),cream,.025)
 # No new roof: original curtain wall silhouette, no gameplay access invented.
 box('civic stripe',p(0,1.6,.515),size(.28,.6,.025),red,.015)
 box('civic gold seal',p(0,1.84,.535),size(.18,.06,.025),gold,.008)

KIT='tower'
# A hollow stone crown rather than a pointed pavilion cap.
for x in [-.78,1.28]: box('stone crown side',(x,2.20,.25),(.44,4.4,2.5),stone,.07)
for z in [-.78,1.28]: box('stone crown front rear',(.25,2.20,z),(2.5,4.4,.44),stone,.07)
for y in [.16,1.48,2.96,4.30]:
 for x in [-.80,1.30]: box('tower side course',(x,y,.25),(.46,.12,2.50),cream,.02)
 for z in [-.80,1.30]: box('tower face course',(.25,y,z),(2.50,.12,.46),cream,.02)
for x in [-.75,.25,1.25]:
 for z in [-.75,1.25]: box('crown merlon',(x,4.68,z),(.49,.56,.49),stone,.055)
for z in [.25]:
 for x in [-.75,1.25]: box('side crown merlon',(x,4.68,z),(.49,.56,.49),stone,.055)
window(.25,2.9,1.52,.28,.90)
banner(-.65,2.0,1.55,.94)
box('brazier pedestal',(.25,4.50,.25),(.45,.5,.45),wood)
box('warm brazier ember',(.25,4.84,.25),(.25,.2,.25),glow,.07)

KIT='gatehouse'
# Existing passage runs along X, with voxel z=-1..1 open above the retained floor.
for aa,bb in [(-2,-.5),(1,2.5)]:
 z=(aa+bb)/2
 box('twin gate drum',(.25,1.96,z),(2.5,3.92,bb-aa),stone,.07)
 for y in [.14,1.2,2.4,3.88]: box('gate stone course',(.25,y,z),(2.53,.10,bb-aa+.025),cream,.02)
 for x in [-.75,1.25]:
  for zz in [aa+.25,bb-.25]: box('gate crenellation',(x,4.20,zz),(.48,.55,.48),stone,.05)
box('high passage lintel',(.25,2.55,.25),(2.5,.75,1.50),stone,.08)
box('gold passage cap',(.25,2.96,.25),(2.56,.10,1.5),gold,.025)
# The freestanding passage remains open x=-1..1.5, z=-.5..1, y=.5..2.0.
doors[KIT]={'axis':'x','min':-.5,'max':1,'front':1.5,'clearBottom':.52,'clearTop':2.05}
banner(.25,3.28,2.54,.66)
window(.25,2.43,2.54,.45,.67)

for o in bpy.context.scene.objects:
 if o.get('roof_top'): assert all(p.normal.z>0 for p in o.data.polygons),o.name
 o.location.x+=10*KITS.index(o['kit'])
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=False)
base=mat('architecture shared vertex palette',(1,1,1))
vertex=base.node_tree.nodes.new('ShaderNodeVertexColor'); vertex.layer_name='Color'
base.node_tree.links.new(vertex.outputs['Color'],base.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
manifest={}
for kit in KITS:
 originals=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
 bpy.ops.object.select_all(action='DESELECT'); copies=[]
 for o in originals:
  c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c)
  c.location.x-=10*KITS.index(kit); c.select_set(True); copies.append(c)
 bpy.context.view_layer.objects.active=copies[0]
 bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
 joined=bpy.context.object; joined.name='architecture-'+kit+'-exterior'
 colors=joined.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 materials=list(joined.data.materials); indices=[]
 for poly in joined.data.polygons:
  m=materials[poly.material_index]; emitting=m==glow
  rgba=(1,1,1,1) if emitting else tuple(m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value)
  for loop in poly.loop_indices: colors.data[loop].color=rgba
  indices.append(1 if emitting else 0)
 joined.data.materials.clear(); joined.data.materials.append(base)
 if any(indices): joined.data.materials.append(glow)
 for poly,index in zip(joined.data.polygons,indices): poly.material_index=index
 bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 file=OUT/('architecture-'+kit+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=False)
 raw=file.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]; doc=json.loads(raw[20:20+length])
 prims=[p for m in doc['meshes'] for p in m['primitives']]
 acc=doc['accessors']; positions=[acc[p['attributes']['POSITION']] for p in prims]
 manifest[kit]={'file':file.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
  'triangles':sum(acc[p['indices']]['count']//3 for p in prims),'vertices':sum(a['count'] for a in positions),
  'materialSlots':len(doc['materials']),'primitives':len(prims),
  'boundsYUp':[[min(a['min'][i] for a in positions) for i in range(3)],[max(a['max'][i] for a in positions) for i in range(3)]],
  'door':doors.get(kit),'parts':[o.name for o in originals],
  'roofNormals':{'upward':True,'sourceSurfaces':sum(bool(o.get('roof_top')) for o in originals)},
  'retainedContent':'Original noncut interior/floor voxels; original complete cutaway on entry. Keep is not replaced.',
  'source':{'file':'art/blender/architecture-kit.blend','generator':'art/blender/build_architecture.py','lineupOffsetX':10*KITS.index(kit),'editable':True},
  'decorativeOnly':True,'noLights':True,'noAnimations':True}
 bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'architecture-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('ARCHITECTURE_EXPORTED '+json.dumps({k:{a:v[a] for a in ['bytes','triangles','vertices','materialSlots','boundsYUp']} for k,v in manifest.items()}))
