"""Original script-authored settlement exteriors. REGENERATION OVERWRITES MANUAL EDITS.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Independent source reopen: same command with -- --verify. No approved assets imported.
"""
import bpy
import math
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/lanternwood'
SOURCE = ROOT / 'art/blender/settlement-kit.blend'

def verify():
    assert SOURCE.read_bytes()[:7] == b'BLENDER'
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    result = {}
    for kit in ['bank', 'forge']:
        objects = [o for o in bpy.context.scene.objects if o.get('kit') == kit]
        roofs = [o for o in objects if o.get('roof_top')]
        assert objects and roofs
        assert all(p.normal.z > 0 for o in roofs for p in o.data.polygons)
        assert all(o.name.startswith(kit) for o in objects)
        assert any(o.modifiers for o in objects)
        result[kit] = {'editableParts': len(objects), 'roofSurfaces': len(roofs), 'upwardNormals': True}
    print('SOURCE_REOPEN_VERIFIED ' + json.dumps(result))

if '--verify' in sys.argv:
    verify()
    sys.exit(0)
print('WARNING: regeneration overwrites manual source and export edits; .blend1 backups retained.')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
KIT = 'bank'
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
    m=o.modifiers.new('crafted softened edges','BEVEL'); m.width=bevel; m.segments=2
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

# Compact countinghouse: low stone courses and framed plaster, not a hall clone.
for x in [-1.39,1.89]:
    box('side plaster wall',(x,1.16,.25),(.20,2.2,2.5),cream)
    for j in range(2): box('side dressed stone course',(x,.15+j*.27,.25),(.25,.26,2.5),stone)
box('rear wall',(.25,1.16,-.90),(3.5,2.2,.20),cream)
box('rear stone footing',(.25,.15,-.90),(3.5,.30,.25),stone)
for x,w in [(-1.025,.95),(1.275,1.45)]:
    box('entrance plaster wing',(x,1.16,1.39),(w,2.2,.20),cream)
    for j in range(2): box('front stone course',(x,.15+j*.27,1.4),(w,.26,.24),stone)
for x in [-1.40,-.55,.55,1.90]: box('front structural post',(x,1.15,1.49),(.12,2.3,.16))
box('door carved lintel',(0,1.92,1.48),(1.12,.24,.20))
box('front wall plate',(.25,2.28,1.42),(3.55,.17,.24))
for x in [-1.02,1.30]:
    arch('arched window frame',x,.87,1.505,.58,1.08,wood)
    arch('warm arched glazing',x,.94,1.516,.43,.92,glow)
    for dx in [-.12,0,.12]: box('security window bar',(x+dx,1.35,1.54),(.028,.75,.035),gold,.005)
    box('window transom',(x,1.28,1.55),(.45,.035,.035),gold,.005)
    box('rounded window sill',(x,.88,1.55),(.70,.10,.24),stone)
roof(.25,.25,3.85,2.92,2.28,.92)
# Freestanding readable sign above the doorway, with a scales motif.
box('oxblood BANK signboard',(0,2.26,1.66),(1.02,.43,.10),red,.07)
for yy in [2.07,2.45]: box('gold sign edging',(0,yy,1.723),(.91,.026,.022),gold,.005)
bpy.ops.object.text_add(location=xyz((0,2.14,1.723)))
o=bpy.context.object; o.rotation_euler=(math.pi/2,0,0); o.data.body='BANK'; o.data.align_x='CENTER'; o.data.size=.255; o.data.extrude=.002; o.data.resolution_u=2; tag(o,'readable BANK lettering',gold)
line('scales upright',[(.95,2.61,1.40),(.95,2.96,1.40)],.025,gold)
line('scales balance beam',[(.64,2.86,1.40),(1.26,2.86,1.40)],.022,gold)
for x in [.68,1.22]:
    line('scales suspended pan',[(x-.12,2.67,1.40),(x,2.84,1.40),(x+.12,2.67,1.40),(x-.12,2.67,1.40)],.017,gold)

KIT='forge'
# Open-front craft shelter: only rear/side framing; central work floor is untouched.
for x in [-1.35,1.85]:
    for z in [-1.32,1.82]:
        box('stone post shoe',(x,.15,z),(.35,.30,.35),stone)
        box('oak shelter pillar',(x,1.27,z),(.22,2.30,.22))
        line('pegged knee brace',[(x,1.72,z),(x+(.45 if x<0 else -.45),2.30,z)],.07)
    box('side sill',(x,.43,.25),(.16,.15,2.85))
    box('side upper plate',(x,2.32,.25),(.22,.19,3.4))
box('front open beam',(.25,2.32,1.82),(3.5,.22,.24))
box('rear cross beam',(.25,2.32,-1.32),(3.5,.22,.24))
roof(.25,.25,3.90,3.82,2.34,.73)
# Back-set shaped hood, leaving the original central hearth/work contents intact.
for x in [-.50,1.0]: box('masonry hearth jamb',(x,.92,-1.15),(.28,1.84,.55),stone,.06)
box('hearth back',(.25,.90,-1.42),(1.75,1.8,.16),stone)
pts=[]
for y,w,d in [(1.55,1.9,.85),(2.52,.66,.50)]:
    pts += [(.25-w/2,y,-1.10-d/2),(.25+w/2,y,-1.10-d/2),(.25+w/2,y,-1.10+d/2),(.25-w/2,y,-1.10+d/2)]
mesh('tapered stone smoke hood',pts,[(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(4,7,6,5)],stone)
box('hood rim',(.25,1.57,-1.10),(1.98,.16,.93),stone,.05)
box('tall masonry chimney',(.25,3.14,-1.10),(.63,1.40,.52),stone,.06)
for y in [2.71,3.25,3.77]: box('chimney band',(.25,y,-1.10),(.72,.11,.61),cream)
box('chimney dark throat',(.25,3.845,-1.10),(.43,.018,.33),wood,.01)
for x in [-.28,.0,.28,.56,.79]: box('banked ember accent',(x,.20,-1.22),(.13,.07,.10),glow,.025)
box('forge hanging trade board',(1.30,1.94,1.98),(.52,.38,.08),red)
# Small gold anvil pictogram on the right, never in the front opening.
mesh('gold anvil trade symbol',[(1.08,2.04,2.03),(1.52,2.04,2.03),(1.42,1.94,2.03),(1.34,1.94,2.03),(1.34,1.87,2.03),(1.44,1.84,2.03),(1.14,1.84,2.03),(1.23,1.88,2.03),(1.23,1.95,2.03)],[(0,1,2,3,4,5,6,7,8)],gold)

for o in bpy.context.scene.objects:
    if o.get('roof_top'): assert all(p.normal.z>0 for p in o.data.polygons)
    if o.get('kit')=='forge': o.location.x += 6
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=False)
manifest={}
for kit in ['bank','forge']:
    originals=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
    bpy.ops.object.select_all(action='DESELECT'); copies=[]
    for o in originals:
        c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c)
        if kit=='forge': c.location.x-=6
        c.select_set(True); copies.append(c)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
    joined=bpy.context.object; joined.name=kit+'-exterior'
    # Put exported object origin at the ground anchor without moving its geometry.
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(kit+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    manifest[kit]={'parts':[o.name for o in originals],'source':{'file':'art/blender/settlement-kit.blend','generator':'art/blender/build_settlement.py','lineupOffsetX':6 if kit=='forge' else 0,'editable':True,'regenerationWarning':'Overwrites manual source edits; backups retained.'}}
    bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'settlement-manifest.json').write_text(json.dumps(manifest,indent=2))
print('SETTLEMENT_EXPORTED bank.glb forge.glb; run scripts/measure-settlement.mjs for actual runtime counts')
