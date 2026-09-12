"""Script-authored field props. Regeneration overwrites field-props.blend/glb.
Stone stays a neutral shared form: catalog tint/identity remains runtime-owned.
"""
import bpy,math,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
kits={}
def material(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
stone=material('neutral layered stone',(.8,.8,.8));cloth=material('oat canvas',(.56,.43,.28));cord=material('dark flax cord',(.22,.14,.08))
def rings(name,levels,sides,mat):
 verts=[]
 for j,(y,r,dx,dz) in enumerate(levels):
  for i in range(sides):
   a=math.tau*i/sides
   wobble=1+.055*math.sin(i*2.4+j*.9)
   verts.append((dx+math.cos(a)*r*wobble,-dz-math.sin(a)*r*wobble,y))
 faces=[tuple(reversed(range(sides))),tuple((len(levels)-1)*sides+i for i in range(sides))]
 for j in range(len(levels)-1):
  for i in range(sides):
   n=(i+1)%sides;faces.append((j*sides+i,j*sides+n,(j+1)*sides+n,(j+1)*sides+i))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
# Centered for the original +0.42 * height * .55 terrain instance translation.
kits['field_rock']=[rings('boulder_courses',[(-.23,.26,0,0),(-.13,.38,0,0),(.08,.35,-.02,0),(.15,.28,-.055,.015),(.34,.21,-.07,.01),(.37,.1,-.04,.02)],7,stone)]
parts=[rings('canvas_bag',[(0,.13,0,0),(.035,.22,0,0),(.13,.21,.012,0),(.23,.12,.008,0),(.26,.065,0,0),(.31,.09,0,0)],10,cloth)]
bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=5,major_radius=.07,minor_radius=.016,location=(0,0,.26))
o=bpy.context.object;o.name='drawstring';o.data.materials.append(cord);parts.append(o)
for x in [-.025,.025]:
 o=rings('cord_end',[(.15,.012,x,.085),(.22,.012,x,.075),(.27,.012,x,.05)],5,cord);parts.append(o)
kits['field_pouch']=parts
for index,(name,parts) in enumerate(kits.items()):
 for o in parts:o['export_mesh']=name;o.location.x+=index*1.5
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/field-props.blend'))
exports=[];records=[]
for index,(name,parts) in enumerate(kits.items()):
 bpy.ops.object.select_all(action='DESELECT');copies=[]
 for source in parts:
  o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.location.x-=index*1.5;o.select_set(True);copies.append(o)
  c=tuple(o.data.materials[0].diffuse_color);attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for d in attr.data:d.color=c
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.data.materials.clear();m=bpy.data.materials.get('field_palette') or bpy.data.materials.new('field_palette');m.use_nodes=True
 nodes=m.node_tree.nodes;v=nodes.get('FieldColor') or nodes.new('ShaderNodeVertexColor');v.name='FieldColor';v.layer_name='Color'
 m.node_tree.links.new(v.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);o.data.materials.append(m)
 for face in o.data.polygons:face.material_index=0
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 records.append({'name':name,'editableParts':len(parts),'vertices':len(o.data.vertices)})
 exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'field-props.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False)
data=(OUT/'field-props.glb').read_bytes()
(OUT/'field-props-manifest.json').write_text(json.dumps({'meshes':records,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},indent=2))
print('FIELD_PROPS_EXPORTED',len(records),len(data),'bytes')
