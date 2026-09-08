"""Authored oak meshes for Emberhall's original resource-instance transforms.
Run with Blender --background --factory-startup --python-exit-code 1 --python.
Export named Y-up meshes, source lineup stays editable; no resource data changes.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/art/lanternwood';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def xyz(p):return (p[0],-p[2],p[1])
material=bpy.data.materials.new('oak vertex tint');material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(1,1,1,1);bsdf.inputs['Roughness'].default_value=.94
vc=material.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';material.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color'])
parts={}
def branch(name,points,radius,tint):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=4;d.bevel_depth=radius;d.bevel_resolution=2
 sp=d.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,(p,r) in zip(sp.bezier_points,points):b.co=xyz(p);b.radius=r;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o['tint']=tint;return o

def foliage(name,position,scale,tint,seed):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=xyz(position));o=bpy.context.object;o.name=name
 for v in o.data.vertices:v.co*=1+.045*math.sin(v.co.x*11+v.co.y*9+v.co.z*13+seed)
 o.scale=(scale[0],scale[2],scale[1]);o['tint']=tint
 for p in o.data.polygons:p.use_smooth=True
 return o

def tag(name,objects):
 parts[name]=objects
 for o in objects:o['part']=name

bark=(.88,.85,.78)
trunk=[branch('crooked oak heart', [((0,-1.05,0),1.25),((-.055,-.5,.03),1),((.06,.1,-.025),.72),((-.035,.7,.015),.38),((.04,1.05,0),.12)],.145,bark)]
for i in range(5):
 a=i*math.tau/5+.2
 trunk.append(branch('root flare',[((math.cos(a)*.40,-1.04,math.sin(a)*.40),.05),((math.cos(a)*.19,-.99,math.sin(a)*.19),.58),((0,-.58,0),.8)],.11,bark))
for i in range(6):
 a=i*2.399+.3;h=-.1+i*.13
 trunk.append(branch('ascending oak bough',[((0,h,0),1),((math.cos(a)*.32,h+.27,math.sin(a)*.32),.58),((math.cos(a)*.62,1.01,math.sin(a)*.62),.04)],.075,bark))
tag('oak_trunk',trunk)
# Overlapping organic leaf masses; normalized to the original cone's envelope.
leaves=[]
for i,(p,s) in enumerate([((0,.15,0),(.82,.97,.80)),((-.55,-.22,.12),(.65,.71,.67)),((.55,-.20,-.10),(.65,.69,.67)),((.03,-.32,.55),(.69,.64,.66)),((-.05,-.31,-.52),(.67,.67,.66)),((.17,.64,.04),(.61,.58,.61))]):
 t=.82+i*.029;leaves.append(foliage('oak clustered crown',p,s,(t,min(1,t+.04),t*.93),i))
tag('oak_crown',leaves)
# Actual young tree presentation; stage scaling belongs to renderer/world state.
young=[branch('sapling flexible stem',[((0,0,0),1),((.025,.43,0),.6),((-.02,.9,.015),.13)],.045,(.27,.17,.09))]
for i in range(3):
 a=i*2.399
 young.append(branch('sapling twig',[((0,.4+i*.13,0),.8),((math.cos(a)*.19,.75+i*.1,math.sin(a)*.19),.06)],.025,(.27,.17,.09)))
 young.append(foliage('young oak leaves',(math.cos(a)*.16,.76+i*.13,math.sin(a)*.16),(.25,.24,.25),(.28+i*.035,.40+i*.03,.16),i+10))
tag('oak_sapling',young)
# A low cut stump asset; renderer only uses it when existing state proves depletion.
stump=[branch('cut oak stump',[((0,.015,0),1.15),((0,.27,0),.92)],.18,(.32,.20,.105))]
for i in range(4):
 a=i*math.tau/4
 stump.append(branch('stump root',[((math.cos(a)*.30,.015,math.sin(a)*.30),.1),((0,.15,0),.75)],.09,(.32,.20,.105)))
bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.162,depth=.016,location=(0,0,.28));top=bpy.context.object;top.name='fresh end grain';top['tint']=(.59,.40,.22);stump.append(top)
tag('oak_stump',stump)
# Keep editable curve pieces, named crown lobes, and a clean source lineup.
for i,(name,objects) in enumerate(parts.items()):
 for o in objects:
  o.location.x+=i*3;o['lineup_offset']=i*3
  o.data.materials.append(material)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/oak-kit.blend'))
for o in list(bpy.context.scene.objects):o.name='source_'+o.name
exports=[];manifest={}
for name,objects in parts.items():
 bpy.ops.object.select_all(action='DESELECT');copies=[]
 for src in objects:
  o=src.copy();o.data=src.data.copy();bpy.context.collection.objects.link(o);o.location.x-=src['lineup_offset'];o.select_set(True);copies.append(o)
 # Convert separately before joining so tint survives as vertex color.
 for o in copies:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  col=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
  for v in col.data:v.color=(*o['tint'],1)
 bpy.ops.object.select_all(action='DESELECT')
 for o in copies:o.select_set(True)
 bpy.context.view_layer.objects.active=copies[0]
 if len(copies)>1:bpy.ops.object.join()
 ob=bpy.context.object;ob.name=name
 # All parts use one material: one glTF primitive per asset, exact named meshes.
 ob.data.materials.clear();ob.data.materials.append(material)
 for p in ob.data.polygons:p.material_index=0
 if name=='oak_crown':
  mins=[min(v.co[i] for v in ob.data.vertices) for i in range(3)];maxs=[max(v.co[i] for v in ob.data.vertices) for i in range(3)]
  for v in ob.data.vertices:
   for i,span in enumerate([2.3,2.3,2.5]):v.co[i]=(v.co[i]-(mins[i]+maxs[i])/2)*span/(maxs[i]-mins[i])
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.mesh.quads_convert_to_tris();bpy.ops.object.mode_set(mode='OBJECT')
 coords=[v.co for v in ob.data.vertices]
 manifest[name]={'vertices':len(coords),'triangles':len(ob.data.polygons),'boundsBlender':[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]]}
 exports.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'oak.glb'),export_format='GLB',export_apply=True,export_yup=True,use_selection=True,export_cameras=False,export_lights=False)
(OUT/'oak-manifest.json').write_text(json.dumps(manifest,indent=2))
print('WROTE '+str(OUT/'oak.glb'));print(json.dumps(manifest))
