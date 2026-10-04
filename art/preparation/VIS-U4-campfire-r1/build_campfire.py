"""Offline U3 weapon authoring only. Does NOT write runtime src/public files.
Script-authored editable meshes; regeneration overwrites files in this folder.
GLB parts are centered for existing mesh anchors; source lineup is assembled.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[];records=[]
def material(name,rgb,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=.38 if metal else .82
 return m
wood=material('warm walnut',(.20,.095,.038));iron=material('forged iron',(.42,.40,.36),.55);steel=material('soft blade steel',(.67,.65,.58),.65);gold=material('staff brass',(.52,.34,.12),.25)
def mesh(name,verts,faces):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return o

def rings(name,levels,sides=8):
 v=[]
 for y,rx,rz,dx in levels:
  for i in range(sides):
   a=i*math.tau/sides;v.append((dx+rx*math.cos(a),-rz*math.sin(a),y))
 f=[tuple(reversed(range(sides))),tuple((len(levels)-1)*sides+i for i in range(sides))]
 for j in range(len(levels)-1):
  for i in range(sides):
   n=(i+1)%sides;f.append((j*sides+i,j*sides+n,(j+1)*sides+n,(j+1)*sides+i))
 return mesh(name,v,f)
def blade(name,width,height,depth,asymmetric=False):
 # Diamond-section steel blade; profile closes at a real point.
 v=[]
 for y,w in [(-height/2,width*.38),(-height*.35,width/2),(height*.28,width*.36),(height/2,0)]:
  shift=width*.1 if asymmetric and y>0 else 0
  v.extend([(shift-w,0,y),(shift,-depth/2,y),(shift+w,0,y),(shift,depth/2,y)])
 f=[(3,2,1,0)]
 for j in range(3):
  for i in range(4):f.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
 return mesh(name,v,f)
def register(o,name,weapon,center,bounds,mat,index):
 o.name=name;o.data.materials.append(mat);o['export_part']=name
 o.location=(index*.5,-center[2],center[1]);parts.append(o)
 records.append({'name':name,'weapon':weapon,'center':center,'bounds':bounds,'sourceVertices':len(o.data.vertices)})
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)

def handle(name,length,width):
 h=length/2;r=width/2
 return rings(name,[(-h,r*.68,r*.68,0),(-h+.018,r,r,0),(-h+.032,r*.78,r*.78,0),(h-.032,r*.78,r*.78,0),(h-.018,r,r,0),(h,r*.68,r*.68,0)])
stone=material('warm field stone',(.26,.27,.25))
# Shared neutral stone fits original radius .09; six original placements remain runtime-owned.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.09);o=bpy.context.object
for v in o.data.vertices:v.co.z*=.72
register(o,'campfire_stone','campfire',[0,0,0],[.18,.18,.18],stone,0)
# Shared log axis maps to game Y, preserving both original rotated cylinders.
register(rings('campfire_log',[(-.25,.039,.039,0),(-.22,.049,.049,0),(.19,.047,.047,0),(.25,.037,.037,0)],8),'campfire_log','campfire',[0,0,0],[.1,.5,.1],wood,0)
# Source display assembles copies at original game transforms without altering export originals.
from mathutils import Euler
for o in parts:o.hide_render=True
for i in range(6):
 a=i*math.tau/6;o=parts[0].copy();o.data=parts[0].data.copy();bpy.context.collection.objects.link(o);o.hide_render=False;o.location=(math.cos(a)*.3,-math.sin(a)*.3,.05)
# Convert game XYZ Euler matrix through Y-up to Z-up basis, matching Three Euler XYZ.
from mathutils import Matrix
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
for rx,ry,rz in [(0,.6,.24),(.24,-.6,0)]:
 o=parts[1].copy();o.data=parts[1].data.copy();bpy.context.collection.objects.link(o);o.hide_render=False;o.location=(0,0,.08)
 # Three XYZ equals Rx @ Ry @ Rz for column vectors.
 R=Matrix.Rotation(rx,3,'X') @ Matrix.Rotation(ry,3,'Y') @ Matrix.Rotation(rz,3,'Z')
 o.rotation_euler=(C @ R @ C.inverted()).to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.14,.17,.13)
for location,power,size in [((-.5,-2,3),220,3),((3,-1,2),140,2)]:
 bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1,-2,1.5));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.0;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'campfire.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'campfire.blend'))
bpy.ops.render.render(write_still=True)
exports=[]
for source in parts:
 name=source['export_part'];source.name='source_'+name
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=name;o.location=(0,0,0);exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'campfire.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False)
data=(OUT/'campfire.glb').read_bytes()
(OUT/'manifest.json').write_text(json.dumps({'status':'offline authored; NOT integrated or gameplay-tested','weapons':['campfire'],'parts':records,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},indent=2))
print('OFFLINE_WEAPONS_EXPORTED',len(records),'parts',len(data),'bytes')
