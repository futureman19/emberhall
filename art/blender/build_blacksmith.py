"""Deterministic, script-authored editable smith-yard decorations. No sibling writes.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Source is assembled at ground origin; GLBs occupy [0,1] X/Z and Y-up.
Regeneration overwrites this kit's source and exports, not hand edits elsewhere.
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/blacksmith'
SOURCE = ROOT / 'art/blender/blacksmith'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

def xyz(p): return Vector((p[0], -p[2], p[1]))
def material(name, rgb, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1)
    bs.inputs['Roughness'].default_value = .77
    bs.inputs['Metallic'].default_value = metal
    return m
WOOD = material('Honey oak', (.34, .16, .065))
EDGE = material('Cut end grain', (.57, .31, .12))
IRON = material('Forged charcoal iron', (.095, .12, .14), .45)
STEEL = material('Worn steel edges', (.32, .38, .39), .5)
STONE = material('Warm hearth stone', (.37, .30, .23))
LEATHER = material('Oxblood leather', (.29, .075, .035))
WATER = material('Still quench water', (.065, .20, .22), .15)
COAL = material('Banked ember', (.68, .18, .035))

def cube(name, p, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    o=bpy.context.object; o.name=name; o.scale=(size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft hand-worked edges', 'BEVEL'); mod.width=min(bevel,min(size)*.35);mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def cylinder(name, p, radius, depth, mat, axis='y', vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=xyz(p))
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='z':o.rotation_euler.x=math.pi/2
    return o

def beam(name, a, b, width, mat):
    av=xyz(a);bv=xyz(b)
    o=cube(name, (0,0,0), (width,(bv-av).length,width),mat,.012)
    o.location=(av+bv)/2;o.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
    return o

def feet(height=.6):
    for x in [-.32,.32]:
        for z in [-.26,.26]:cube('Oak leg',(x,height/2,z),(.13,height,.13),WOOD)

def anvil():
    cylinder('Octagonal oak stump',(0,.23,0),.32,.46,WOOD)
    for y in [.12,.35]:cylinder('Iron stump hoop',(0,y,0),.327,.035,IRON)
    cube('Anvil foot',(0,.49,0),(.52,.09,.32),IRON)
    cube('Anvil waist',(0,.60,0),(.27,.19,.22),IRON)
    cube('Steel face',(0,.74,0),(.64,.10,.30),STEEL)
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.13,radius2=.025,depth=.30,location=xyz((.43,.71,0)))
    o=bpy.context.object;o.name='Tapered horn';o.rotation_euler.y=math.pi/2;o.data.materials.append(STEEL)
    cube('Hardy hole',(-.21,.793,0),(.065,.008,.065),IRON,.001)

def forge():
    cube('Foundation',(0,.08,0),(.90,.16,.84),STONE)
    for y in [.25,.43,.61]:
        for x in [-.34,.34]:cube('Side hearth block',(x,y,0),(.20,.17,.72),STONE)
        cube('Rear hearth block',(0,y,.29),(.50,.17,.15),STONE)
    cube('Coal bed',(0,.47,-.02),(.48,.12,.46),IRON)
    for x,z in [(-.14,-.12),(.08,-.08),(-.03,.12),(.16,.12)]:cube('Banked ember',(x,.54,z),(.12,.06,.10),COAL)
    cube('Lintel',(0,.76,.12),(.90,.15,.57),STONE)
    cube('Chimney base',(0,.91,.24),(.52,.18,.36),STONE)
    cube('Chimney shaft',(0,1.17,.24),(.36,.36,.30),STONE)
    cube('Chimney lip',(0,1.38,.24),(.46,.08,.38),STONE)
    cube('Dark flue',(0,1.425,.24),(.26,.009,.19),IRON,.001)

def trough():
    for x in [-.32,.32]:cube('Trough trestle',(x,.10,0),(.14,.20,.65),WOOD)
    cube('Trough bottom',(0,.23,0),(.90,.12,.54),WOOD)
    for z in [-.28,.28]:cube('Long plank',(0,.40,z),(.94,.30,.075),EDGE)
    for x in [-.43,.43]:cube('End plank',(x,.40,0),(.08,.30,.52),WOOD)
    cube('Opaque water inset',(0,.43,0),(.76,.025,.46),WATER,.003)
    for x in [-.32,.32]:
        for z in [-.325,.325]:cube('Iron band',(x,.40,z),(.045,.32,.025),IRON,.003)

def grindstone():
    feet(.55)
    cube('Axle cradle',(0,.55,0),(.78,.12,.65),WOOD)
    cylinder('Grinding wheel',(0,.85,0),.31,.16,STONE,'x',16)
    cylinder('Iron axle',(0,.85,0),.045,.75,IRON,'x')
    beam('Crank arm',(.39,.85,0),(.39,.68,.13),.05,IRON)
    cylinder('Crank grip',(.46,.68,.13),.045,.15,EDGE,'x')
    cube('Tool rest',(0,.77,-.32),(.39,.05,.12),IRON)

def rack():
    for x in [-.35,.35]:
        cube('Rack shoe',(x,.07,0),(.19,.14,.62),WOOD)
        cube('Rack upright',(x,.69,.12),(.12,1.24,.12),WOOD)
    for y in [.38,1.06]:cube('Rack crossbar',(0,y,.12),(.84,.13,.12),EDGE)
    for x in [-.22,0,.22]:
        cube('Sword blade',(x,.71,-.02),(.075,.60,.035),STEEL,.008)
        cube('Sword guard',(x,1.02,-.02),(.20,.04,.06),IRON,.008)
        cube('Wrapped grip',(x,1.12,-.02),(.055,.15,.055),LEATHER,.01)
        cylinder('Pommel',(x,1.22,-.02),.045,.045,EDGE)

def bellows():
    feet(.35)
    for y in [.38,.62]:cube('Bellows board',(0,y,0),(.70,.065,.52),WOOD)
    for y in [.44,.50,.56]:cube('Leather pleat',(0,y,0),(.66,.05,.48),LEATHER,.018)
    for x in [-.19,.19]:cube('Leather strap',(x,.662,0),(.045,.02,.50),IRON,.003)
    cylinder('Air nozzle',(.44,.49,0),.07,.25,IRON,'x')
    beam('Handle',(-.28,.64,0),(-.55,.64,0),.08,EDGE)

def export_stable(objects, path):
    # Explicit stable order avoids Blender glTF exporter's unordered material batches.
    # Flat normals, no textures/animation: a deliberately small glTF 2.0 subset.
    binary=bytearray();views=[];accessors=[];primitives=[];materials=[]
    mats=sorted({o.data.materials[0] for o in objects},key=lambda m:m.name)
    def attribute(values):
        offset=len(binary)
        for v in values:binary.extend(struct.pack('<3f',*v))
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset,'target':34962})
        accessors.append({'bufferView':len(views)-1,'componentType':5126,'count':len(values),'type':'VEC3','min':[min(v[k] for v in values) for k in range(3)],'max':[max(v[k] for v in values) for k in range(3)]})
        return len(accessors)-1
    for mi,mat in enumerate(mats):
        bs=mat.node_tree.nodes.get('Principled BSDF')
        materials.append({'name':mat.name,'pbrMetallicRoughness':{'baseColorFactor':list(bs.inputs['Base Color'].default_value),'metallicFactor':bs.inputs['Metallic'].default_value,'roughnessFactor':bs.inputs['Roughness'].default_value}})
        positions=[];normals=[]
        for o in sorted(objects,key=lambda o:o.name):
            if o.data.materials[0]!=mat:continue
            mesh=o.to_mesh();mesh.calc_loop_triangles()
            for tri in mesh.loop_triangles:
                points=[o.matrix_world@mesh.vertices[i].co for i in tri.vertices]
                normal=(points[1]-points[0]).cross(points[2]-points[0]).normalized()
                for p in points:
                    positions.append((p.x,p.z,-p.y));normals.append((normal.x,normal.z,-normal.y))
            o.to_mesh_clear()
        primitives.append({'attributes':{'POSITION':attribute(positions),'NORMAL':attribute(normals)},'material':mi})
    doc={'asset':{'version':'2.0','generator':'Emberhall deterministic Blender smith exporter v1'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':path.stem}],'meshes':[{'primitives':primitives}],'materials':materials,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
    text=json.dumps(doc,separators=(',',':'),sort_keys=True).encode()
    text+=b' '*((-len(text))%4)
    payload=struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
    path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(payload))+payload)

for name, build in [('anvil',anvil),('forge',forge),('trough',trough),('grindstone',grindstone),('rack',rack),('bellows',bellows)]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    build();bpy.context.view_layer.update()
    objects=list(bpy.context.scene.objects)
    # Normalize horizontal extents once; retain editable separate named parts.
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    extent=max(max(abs(p.x),abs(p.y)) for p in points)
    scale=min(1,.48/extent)
    bottom=min(p.z for p in points)
    for o in objects:
        matrix=o.matrix_world.copy()
        for v in o.data.vertices:
            p=matrix@v.co;v.co=(p.x*scale+.5,p.y*scale-.5,p.z-bottom)
        o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'smith_{name}.blend'))
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.update()
    export_stable(objects, OUT/f'smith_{name}.glb')
print('BLACKSMITH EXPORT COMPLETE: six editable sources and GLBs. Run scripts/measure-blacksmith.mjs.')
