"""VIS-U2: script-authored editable crop/reagent kit. Regeneration replaces flora.blend/flora.glb.
Game coordinates are (x,y,z); Blender coordinates (x,-z,y). No gameplay data is written.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/lanternwood'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
parts = []
kits = {}
colors = {'leaf': '#617a43', 'light': '#88a45a', 'dark': '#40573b', 'stem': '#78854c', 'gold': '#cba463', 'cream': '#e1d5b2', 'root': '#aa8053', 'red': '#a74843', 'purple': '#9476a4', 'moss': '#763e47', 'stone': '#82786b', 'ash': '#d9c59b', 'pearl': '#333449'}
def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
palette = {key: tuple(linear(int(value[i:i+2], 16) / 255) for i in (1,3,5)) + (1,) for key,value in colors.items()}
materials = {}
for key,color in palette.items():
    m = bpy.data.materials.new(key)
    m.diffuse_color = color
    materials[key] = m

def register(o, name, color):
    o.name = name
    o.data.materials.append(materials[color])
    parts.append(o)
    return o

def oval(name, x,y,z, sx,sy,sz,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, location=(x,-z,y))
    o = bpy.context.object
    o.scale = (sx,sz,sy)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return register(o,name,color)

def stem(name,x,z,h,color='stem'):
    bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.022,radius2=.012,depth=h,location=(x,-z,h/2))
    return register(bpy.context.object,name,color)

def leaf(name,x,y,z,a,length,width,lift,color):
    # A folded, pointed leaf with actual thickness, no alpha textures.
    local=[(0,0,0),(length*.42,width,lift*.42),(length,0,lift),(length*.42,-width,lift*.42),(length*.42,0,lift*.58+.018),(length*.42,0,lift*.42-.014)]
    verts=[]
    for r,t,h in local:
        xx=x+math.cos(a)*r-math.sin(a)*t
        zz=z+math.sin(a)*r+math.cos(a)*t
        verts.append((xx,-zz,y+h))
    faces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return register(o,name,color)

def rosette(prefix,y,length,width,lift,n=5,color='leaf'):
    for i in range(n):
        leaf(prefix+str(i),0,y,0,i*math.tau/n+.25,length,width,lift,'light' if i%2 else color)

def plant(kind,stage,wild=False):
    size=[0,.36,.68,1][stage]
    ripe=stage==3
    if kind=='wheat':
        for i,(x,z,h) in enumerate([(0,0,.66),(-.14,.1,.56),(.14,-.1,.59),(-.1,-.13,.48),( .13,.15,.5)]):
            stem('stalk',x*size,z*size,h*size,'gold' if ripe else 'stem')
            leaf('blade',x*size,h*.3*size,z*size,i*2.1,.18*size,.018*size,.15*size,'gold' if ripe else 'leaf')
            if stage>=2:
                for k in range(3):
                    oval('grain',x*size+(.025 if k%2 else -.025)*size,(h-.11+k*.045)*size,z*size,.036*size,.047*size,.03*size,'gold' if ripe else 'light')
    elif kind=='cabbage':
        rosette('outer_leaf',.025,.34*size,.12*size,.12*size,7)
        if stage>=2:
            oval('folded_head',0,.19*size,0,.23*size,.2*size,.22*size,'light')
            for i in range(4):
                leaf('head_fold',0,.24*size,0,i*math.pi/2,.2*size,.08*size,.13*size,'leaf')
    elif kind=='garlic':
        if stage>=2:
            for x,z in [(0,0),(-.05,.03),(.045,.03)]:
                oval('garlic_clove',x*size,.10*size,z*size,.072*size,.11*size,.075*size,'cream')
        rosette('garlic_blade',.09*size,.14*size,.025*size,.47*size,5)
    elif kind=='ginseng':
        stem('ginseng_stem',0,0,.29*size)
        rosette('ginseng_leaf',.2*size,.28*size,.085*size,.07*size,5)
        if ripe:
            for x,z in [(-.055,0),(.045,.035),(0,-.055)]:
                oval('red_berry',x,.34,z,.044,.045,.044,'red')
    elif kind=='mandrake':
        if stage>=2:
            oval('root_crown',0,.08*size,0,.095*size,.085*size,.08*size,'root')
        rosette('mandrake_leaf',.055*size,.25*size,.074*size,.18*size,6,'dark')
        if ripe:
            for a in [0,2.1,4.2]:
                oval('purple_blossom',math.cos(a)*.09,.24,math.sin(a)*.09,.06,.045,.06,'purple')
    elif kind=='moss':
        for i,(x,z,s) in enumerate([(0,0,.19),(-.17,.1,.13),(.16,.1,.12),(.09,-.14,.13)]):
            oval('moss_cushion',x*size,.05*size,z*size,s*size,.055*size,s*size,'moss' if ripe else 'dark')
        if ripe:
            for x,z in [(-.1,0),(.12,.08),(0,-.1)]:
                stem('moss_spore',x,z,.12,'red')
                oval('spore_tip',x,.12,z,.025,.03,.025,'red')
    elif kind=='ash':
        oval('charred_bed',0,.025,0,.24,.025,.2,'stone')
        for x,z,s in [(0,0,.12),(-.14,.05,.075),(.12,.08,.08)]:
            o=oval('ash_shard',x,.06+s*.25,z,s,.05+s*.4,s*.65,'ash' if ripe else 'stone')
            o.rotation_euler.z=.3
    elif kind=='pearl':
        oval('shell_bowl',0,.045,0,.22,.045,.19,'cream' if ripe else 'stone')
        if ripe:
            for i in range(5):
                leaf('shell_ridge',0,.06,0,i*.42+.6,.22,.015,.09,'cream')
            oval('black_pearl',0,.10,-.01,.073,.073,.073,'pearl')

for family,ids in [('crop',['cabbage','wheat','garlic','ginseng','mandrake','moss']),('herb',['moss','mandrake','ginseng','ash','pearl'])]:
    for kind in ids:
        for state in ([1,2,3] if family=='crop' else ['ready','picked']):
            parts=[]
            stage=state if family=='crop' else (3 if state=='ready' else 1)
            plant(kind,stage,family=='herb')
            name=f'{family}_{kind}_{state}'
            # World herb picked scale remains the existing runtime 0.62.
            if family=='herb' and state=='picked':
                for o in parts:
                    o.data.materials.clear();o.data.materials.append(materials['stone'])
            kits[name]=list(parts)
            for o in parts:
                o['kit']=name
                o.name=name+'__'+o.name
# Keep editable components with separated source lineup, reset copies on export.
for index,(name,objects) in enumerate(kits.items()):
    for o in objects:
        o.location.x += (index%7)*1.2
        o.location.y += (index//7)*1.2
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/flora.blend'))
exports=[]
manifest=[]
for index,(name,objects) in enumerate(kits.items()):
    copies=[]
    bpy.ops.object.select_all(action='DESELECT')
    for source in objects:
        o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o)
        o.location.x-=(index%7)*1.2;o.location.y-=(index//7)*1.2
        o.select_set(True);copies.append(o)
        attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        color=o.data.materials[0].diffuse_color
        for d in attr.data:d.color=color
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # One white vertex-color material / one draw per state.
    o.data.materials.clear()
    white=bpy.data.materials.get('flora_vertex_palette') or bpy.data.materials.new('flora_vertex_palette')
    white.diffuse_color=(1,1,1,1)
    white.use_nodes=True
    nodes=white.node_tree.nodes
    attribute=nodes.get('FloraColor') or nodes.new('ShaderNodeVertexColor')
    attribute.name='FloraColor';attribute.layer_name='Color'
    white.node_tree.links.new(attribute.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
    o.data.materials.append(white)
    for p in o.data.polygons:p.material_index=0
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    corners=[o.matrix_world@Vector(v) for v in o.bound_box]
    bounds=[[min(v[j] for v in corners) for j in range(3)],[max(v[j] for v in corners) for j in range(3)]]
    assert all(math.isfinite(v) for row in bounds for v in row)
    assert bounds[0][2]>=-.02 and bounds[1][2]<=.85
    manifest.append({'name':name,'editableParts':len(objects),'vertices':len(o.data.vertices),'blenderBounds':bounds})
    exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'flora.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False,export_attributes=True)
data=(OUT/'flora.glb').read_bytes()
(OUT/'flora-manifest.json').write_text(json.dumps({'scope':'VIS-U2 crop/herb visual kit; no simulation edits','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'meshes':manifest},indent=2))
print('FLORA_EXPORTED',len(exports),'state meshes',len(data),'bytes')
