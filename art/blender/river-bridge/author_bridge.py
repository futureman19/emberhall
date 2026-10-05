"""Original script-authored Reedwake timber bridge. Re-running overwrites source edits.
Game X/Y-up/Z -> Blender X/-Z/Y. Source origin is waterline, deck top +0.6.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/art/river-bridge'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb,1)
    bs.inputs['Roughness'].default_value = .91
    return m
wood = material('Honey oak planks', (.36,.19,.075))
dark = material('Old oak structure', (.17,.083,.033))
stone = material('Warm moss stone', (.135,.145,.085))
iron = material('Forged iron pegs', (.065,.065,.055))

def cube(name, pos, size, mat, bevel=.012):
    x,y,z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,-z,y))
    o=bpy.context.object; o.name=name
    o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Hand softened edges','BEVEL'); mod.width=min(bevel,min(size)*.3); mod.segments=1
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def brace(name, a, b, width):
    av=Vector((a[0],-a[2],a[1])); bv=Vector((b[0],-b[2],b[1]))
    o=cube(name, ((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2), (width,(bv-av).length,width),dark,.01)
    o.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
    return o

for i in range(20):
    x=-3.5+(i+.5)*.35
    cube(f'Deck plank {i+1:02}',(x,.54,0),(.342,.12,3.2),wood,.008)
    for z in [-1.32,1.32]:
        cube(f'Iron deck peg {i:02} {z}',(x,.596,z),(.04,.008,.04),iron,.001)
for z in [-1.36,1.36]:
    cube(f'Longitudinal bearer {z}',(0,.34,z),(7.5,.28,.22),dark)
for x in [-3.5,3.5]:
    for row in range(2):
        for j in range(4):
            cube(f'Abutment {x} course {row} block {j}',(x,.11+row*.22,-1.35+j*.9),(.94,.22,.87),stone,.035)
    cube(f'Abutment cap {x}',(x,.46,0),(1.02,.08,3.7),stone,.018)
for z in [-1.7,1.7]:
    for i,x in enumerate([-3.2,-1.6,0,1.6,3.2]):
        cube(f'Rail post {z} {i}',(x,.93,z),(.16,1.18,.16),dark,.018)
        cube(f'Post cap {z} {i}',(x,1.54,z),(.23,.09,.23),wood,.02)
    cube(f'Top handrail {z}',(0,1.43,z),(6.8,.14,.18),wood,.023)
    cube(f'Low rail {z}',(0,.83,z),(6.7,.09,.11),dark,.01)
    for i in range(4):
        a=-3.2+i*1.6
        brace(f'Crossbrace rising {z} {i}',(a,.84,z),(a+1.6,1.37,z),.065)
        brace(f'Crossbrace falling {z} {i}',(a,1.37,z+.025),(a+1.6,.84,z+.025),.065)
# Exact canonical 1:5 central slope; irregular skirts feather into the bank.
for side in [-1,1]:
    verts=[]
    for x,width in [(3.5,1.72),(4.0,2.1),(4.8,1.95),(5.5,1.66)]:
        top=.6-(x-3.5)*.2
        for z,h in [(-width,.17),(-1.5,top),(1.5,top),(width,.17)]:
            verts.append((side*x,-z,h))
    faces=[]
    for row in range(3):
        for col in range(3):
            a=row*4+col
            faces.extend([(a,a+1,a+5),(a,a+5,a+4)])
    # Closed shallow earth wedge; skirt perimeter is slightly buried in bank Y=.2.
    rim=[0,1,2,3,7,11,15,14,13,12,8,4]
    for i in rim: verts.append((verts[i][0],verts[i][1],0))
    faces.append(tuple(range(16,28)))
    for j,a in enumerate(rim):
        k=(j+1)%len(rim)
        faces.append((a,rim[k],16+k,16+j))
    mesh=bpy.data.meshes.new('Approach ramp mesh')
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    o=bpy.data.objects.new(f'Stone approach ramp {side}',mesh)
    bpy.context.collection.objects.link(o);o.data.materials.append(stone)
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
# Vertex-painted earth: uneven shoulder perimeter fades toward dark bank soil.
# The same shared draw retains solid moss-stone blocks and uses no textures.
vc=stone.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='BankPalette'
stone.node_tree.links.new(vc.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for o in bpy.context.scene.objects:
    if o.type!='MESH' or o.data.materials[0]!=stone: continue
    ca=o.data.color_attributes.new(name='BankPalette',type='FLOAT_COLOR',domain='CORNER')
    for poly in o.data.polygons:
        for i in poly.loop_indices:
            v=o.data.vertices[o.data.loops[i].vertex_index].co
            if o.name.startswith('Stone approach'):
                edge=min(1,max(0,(abs(v.y)-1.05)/.8))
                end=min(1,max(0,(abs(v.x)-4.0)/1.5))
                t=max(edge,end*.8)
                f=1+.05*math.sin(v.x*13+v.y*7)
                rgb=[(a+(b-a)*t)*f for a,b in zip((.115,.087,.044),(.045,.052,.024))]
            else: rgb=(.135,.145,.085)
            ca.data[i].color=(*rgb,1)
# Named editable pieces are kept in the saved source, never destructive joined there.
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('reedwake-bridge.blend')))
source = list(bpy.context.scene.objects)
# Join evaluated EXPORT copies by material: four draws, source remains editable.
bpy.ops.object.select_all(action='DESELECT')
exports=[]
for mat in [wood,dark,stone,iron]:
    copies=[]
    for original in source:
        if original.type!='MESH' or original.data.materials[0]!=mat: continue
        mesh=bpy.data.meshes.new_from_object(original.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        copy=bpy.data.objects.new('Export '+original.name,mesh)
        bpy.context.collection.objects.link(copy); copy.matrix_world=original.matrix_world.copy()
        copies.append(copy)
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    joined=bpy.context.object; joined.name='Bridge '+mat.name
    exports.append(joined)
    bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'reedwake-bridge.glb'),export_format='GLB',use_selection=True,export_yup=True)
(OUT/'manifest.json').write_text(json.dumps({'id':'reedwake-bridge','authoring':'Original script-authored Blender geometry','source':'art/blender/river-bridge/reedwake-bridge.blend','origin':'waterline','waterY':.6,'localDeckY':.6,'worldDeckY':1.2,'placement':[952,.6,560],'deckBounds':[-3.5,-1.6,3.5,1.6],'materials':4,'editableMeshes':len(source)},indent=2))
print('BRIDGE_EXPORT_OK',len(source), 'named editable parts')
