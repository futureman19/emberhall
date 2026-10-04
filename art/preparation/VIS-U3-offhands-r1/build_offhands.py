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
 o.location=(index*.5+center[0],-center[2],center[1]);parts.append(o)
 records.append({'name':name,'weapon':weapon,'center':center,'bounds':bounds,'sourceVertices':len(o.data.vertices)})
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)

def handle(name,length,width):
 h=length/2;r=width/2
 return rings(name,[(-h,r*.68,r*.68,0),(-h+.018,r,r,0),(-h+.032,r*.78,r*.78,0),(h-.032,r*.78,r*.78,0),(h-.018,r,r,0),(h,r*.68,r*.68,0)])
# Bow uses the union of the old stave/string envelope, not each old narrow box.
# Existing combined game-space envelope: x [-.02,.09], y [-.03,.59], z [-.02,.02].
# New part center is [.035,.28,0]; integration must keep arrow ref/pose unchanged.
levels=[(-.31,.004,.012,.042),(-.24,.009,.017,.012),(-.12,.012,.02,-.028),(0,.009,.018,-.044),(.12,.012,.02,-.028),(.24,.009,.017,.012),(.31,.004,.012,.042)]
register(rings('bow_limb',levels,8),'bow_limb','bow',[.035,.28,0],[.11,.62,.04],wood,0)
string=material('bow linen',(.78,.70,.53))
register(rings('bow_string',[(-.305,.004,.004,.042),(.305,.004,.004,.042)],6),'bow_string','bow',[.035,.28,0],[.11,.62,.04],string,0)
register(handle('torch_handle',.36,.045),'torch_handle','torch',[0,.18,0],[.045,.36,.045],wood,1)
flame=material('warm ember',(.7,.22,.045));bs=flame.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.8,.16,.025,1);bs.inputs['Emission Strength'].default_value=.8
register(rings('torch_ember',[(-.05,.035,.035,0),(-.015,.04,.04,0),(.02,.025,.025,.005),(.05,.001,.001,-.006)],7),'torch_ember','torch',[0,.4,0],[.08,.1,.08],flame,1)
# Convex plank/iron faces preserve the original shield and boss envelopes.
def shield_face(name,outline):
 n=len(outline);verts=[(x,.025,y) for x,y in outline]+[(x,-.02,y) for x,y in outline]+[(0,-.03,.02)]
 faces=[tuple(reversed(range(n)))]
 for i in range(n):
  j=(i+1)%n;faces.append((i,j,n+j,n+i));faces.append((n+i,n+j,2*n))
 return mesh(name,verts,faces)
for index,weapon in [(2,'shield'),(3,'heater')]:
 if weapon=='shield':outline=[(.14*math.sin(i*math.tau/12),.19*math.cos(i*math.tau/12)) for i in range(12)]
 else:outline=[(-.14,.19),(.14,.19),(.135,.015),(.085,-.095),(0,-.19),(-.085,-.095),(-.135,.015)]
 register(shield_face(weapon+'_face',outline),weapon+'_face',weapon,[0,0,0],[.28,.38,.06],wood if weapon=='shield' else iron,index)
 # Low faceted boss front follows original z=.04 center; no back grip redesign.
 outline=[(.05*math.sin(i*math.tau/8),.05*math.cos(i*math.tau/8)) for i in range(8)]
 o=shield_face(weapon+'_boss',outline)
 for v in o.data.vertices:v.co.y*=2/3
 register(o,weapon+'_boss',weapon,[0,.02,.04],[.1,.1,.04],gold,index)
# Source-only presentation plinths and labels; never included in export.
base=material('display walnut',(.07,.055,.038));letter=material('label cream',(.8,.69,.49))
for i,name in enumerate(['BOW','TORCH','SHIELD','HEATER']):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(i*.5,0,-.28));o=bpy.context.object;o.name='display_'+name;o.scale=(.39,.22,.025);o.data.materials.append(base)
 bpy.ops.object.text_add(location=(i*.5,-.17,-.34),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='label_'+name;o.data.body=name;o.data.align_x='CENTER';o.data.size=.053;o.data.materials.append(letter)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.14,.17,.13)
for location,power,size in [((-.5,-2,3),220,3),((3,-1,2),140,2)]:
 bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((1,0,.35))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.75,-4,1.05));camera=bpy.context.object;camera.rotation_euler=(Vector((.75,0,.20))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.2;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'offhand-lineup.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'offhands.blend'))
bpy.ops.render.render(write_still=True)
exports=[]
for source in parts:
 name=source['export_part'];source.name='source_'+name
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=name;o.location=(0,0,0);exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'offhands.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False)
data=(OUT/'offhands.glb').read_bytes()
(OUT/'manifest.json').write_text(json.dumps({'status':'offline authored; NOT integrated or gameplay-tested','weapons':['bow','torch','shield','heater'],'parts':records,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},indent=2))
print('OFFLINE_WEAPONS_EXPORTED',len(records),'parts',len(data),'bytes')
