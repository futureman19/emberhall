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
for index,weapon in enumerate(['knife','sword','club','mace','staff']):
 if weapon=='knife':
  register(handle('knife_handle',.16,.04),'knife_handle',weapon,[0,.08,0],[.04,.16,.04],wood,index)
  register(blade('knife_blade',.05,.22,.02,True),'knife_blade',weapon,[0,.24,0],[.05,.22,.02],steel,index)
 elif weapon=='sword':
  register(handle('sword_handle',.22,.045),'sword_handle',weapon,[0,.1,0],[.045,.22,.045],wood,index)
  # Swept quillons, maximum old guard envelope preserved.
  o=mesh('sword_guard',[(-.08,-.015,-.02),(-.08,.015,-.02),(-.055,-.02,.005),(-.055,.02,.005),(0,-.02,.02),(0,.02,.02),(.055,-.02,.005),(.055,.02,.005),(.08,-.015,-.02),(.08,.015,-.02)],[(0,2,4,6,8),(1,9,7,5,3),(0,1,3,2),(2,3,5,4),(4,5,7,6),(6,7,9,8),(8,9,1,0)])
  register(o,'sword_guard',weapon,[0,.22,0],[.16,.04,.04],iron,index)
  register(blade('sword_blade',.055,.46,.02),'sword_blade',weapon,[0,.44,0],[.055,.46,.02],steel,index)
 elif weapon=='club':
  register(handle('club_handle',.5,.055),'club_handle',weapon,[0,.22,0],[.055,.5,.055],wood,index)
  register(rings('club_head',[(-.08,.033,.033,0),(-.045,.052,.052,0),(.045,.06,.06,0),(.08,.044,.044,0)],7),'club_head',weapon,[0,.48,0],[.12,.16,.12],wood,index)
 elif weapon=='mace':
  register(handle('mace_handle',.42,.045),'mace_handle',weapon,[0,.2,0],[.045,.42,.045],wood,index)
  # Faceted flanges within the original cubical head bounds.
  o=rings('mace_head',[(-.08,.038,.038,0),(-.052,.08,.08,0),(.052,.08,.08,0),(.08,.038,.038,0)],12)
  for i,v in enumerate(o.data.vertices):
   if i//12 in [1,2] and i%2:v.co.x*=.65;v.co.y*=.65
  register(o,'mace_head',weapon,[0,.46,0],[.16,.16,.16],iron,index)
 else:
  register(rings('staff_handle',[(-.45,.015,.015,0),(-.4,.019,.019,0),(0,.016,.016,.003),(.36,.017,.017,-.002),(.45,.02,.02,0)],8),'staff_handle',weapon,[0,.38,0],[.04,.9,.04],wood,index)
  register(rings('staff_head',[(-.05,.028,.028,0),(-.025,.05,.05,0),(.025,.046,.046,0),(.05,.025,.025,0)],8),'staff_head',weapon,[0,.86,0],[.1,.1,.1],gold,index)
# Source-only presentation plinths and labels; never included in export.
base=material('display walnut',(.07,.055,.038));letter=material('label cream',(.8,.69,.49))
for i,name in enumerate(['KNIFE','SWORD','CLUB','MACE','STAFF']):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(i*.5,0,-.12));o=bpy.context.object;o.name='display_'+name;o.scale=(.39,.22,.025);o.data.materials.append(base)
 bpy.ops.object.text_add(location=(i*.5,-.17,-.18),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='label_'+name;o.data.body=name;o.data.align_x='CENTER';o.data.size=.053;o.data.materials.append(letter)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.14,.17,.13)
for location,power,size in [((-.5,-2,3),220,3),((3,-1,2),140,2)]:
 bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((1,0,.35))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1,-4,1.35));camera=bpy.context.object;camera.rotation_euler=(Vector((1,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.65;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'weapon-lineup.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'weapons.blend'))
bpy.ops.render.render(write_still=True)
exports=[]
for source in parts:
 name=source['export_part'];source.name='source_'+name
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=name;o.location=(0,0,0);exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'weapons.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False)
data=(OUT/'weapons.glb').read_bytes()
(OUT/'manifest.json').write_text(json.dumps({'status':'offline authored; NOT integrated or gameplay-tested','weapons':['knife','sword','club','mace','staff'],'parts':records,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},indent=2))
print('OFFLINE_WEAPONS_EXPORTED',len(records),'parts',len(data),'bytes')
