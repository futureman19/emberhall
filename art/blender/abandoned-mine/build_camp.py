"""Original deterministic script-authored Emberhall landscape kit. No gameplay integration.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Regeneration overwrites this kit's generated files, including manual .blend edits.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/art/abandoned-mine'; EV=ROOT/'art/verification/abandoned-mine'
OUT.mkdir(parents=True,exist_ok=True); EV.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PAL={'stone':(.32,.29,.22),'lightstone':(.49,.46,.35),'snow':(.81,.84,.74),'basalt':(.12,.105,.10),'mud':(.22,.16,.095),'water':(.085,.22,.17),'moss':(.26,.35,.10),'reed':(.38,.42,.12),'bark':(.25,.15,.075),'lava':(1,.17,.014),'hot':(1,.57,.045),'leaf':(.22,.32,.105)}
def mat(name,emit=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes; bs=n.get('Principled BSDF'); vc=n.new('ShaderNodeVertexColor');vc.layer_name='Palette';m.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.9
 if emit:bs.inputs['Emission Color'].default_value=(1,.09,.005,1);bs.inputs['Emission Strength'].default_value=.55
 return m
MAT=mat('Shared earth palette'); EMIT=mat('Molten palette',True)
active=None; objects=[]; phase=0

def mesh(name,vs,fs,col):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);active.objects.link(ob);objects.append(ob);me.materials.append(EMIT if col in ['lava','hot'] else MAT)
 ca=me.color_attributes.new(name='Palette',type='FLOAT_COLOR',domain='CORNER')
 for p in me.polygons:
  f=1+.095*math.sin(p.index*7.31+len(objects)*2.5)
  for i in p.loop_indices:ca.data[i].color=(*(min(1,c*f) for c in PAL[col]),1)
 return ob

def rings(name,ringspec,col,n=12,center=(0,0),rough=.1,cap=True):
 vs=[]
 for j,(r,z,dx,dy) in enumerate(ringspec):
  for k in range(n):
   a=k*math.tau/n; wob=1+rough*math.sin(k*4.7+phase)+rough*.4*math.cos(k*2.8+j)
   zz=z if j==0 else z*(1+rough*.4*math.sin(k*3.7+phase))
   vs.append((center[0]+dx+r*wob*math.cos(a),center[1]+dy+r*wob*math.sin(a),zz))
 fs=[]
 for j in range(len(ringspec)-1):
  for k in range(n):
   a=j*n+k;b=j*n+(k+1)%n;c=b+n;d=a+n
   fs.extend([(a,b,d),(b,c,d)])
 if cap:fs.extend([tuple(reversed(range(n))),tuple((len(ringspec)-1)*n+k for k in range(n))])
 return mesh(name,vs,fs,col)

def rock(name,p,s,col='stone'):
 x,y,z=p;sx,sy,sz=s
 ob=rings(name,[(1,0,0,0),(.96,.32,.1,0),(.69,.83,-.07,.09),(.24,1,.04,0)],col,n=7,rough=.14)
 for v in ob.data.vertices:v.co=(x+v.co.x*sx,y+v.co.y*sy,z+v.co.z*sz)
 return ob

def tube(name,pts,rs,col,n=7):
 vs=[]
 for j,p in enumerate(pts):
  t=(Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])).normalized();u=t.cross(Vector((0,1,0)))
  if u.length<.001:u=t.cross(Vector((1,0,0)))
  u.normalize();v=t.cross(u).normalized()
  for k in range(n):vs.append(Vector(p)+rs[j]*(math.cos(k*math.tau/n)*u+math.sin(k*math.tau/n)*v))
 fs=[]
 for j in range(len(pts)-1):
  for k in range(n):a=j*n+k;b=j*n+(k+1)%n;fs.append((a,b,b+n,a+n))
 fs.extend([tuple(reversed(range(n))),tuple((len(pts)-1)*n+k for k in range(n))]);return mesh(name,vs,fs,col)

exec(compile((Path(__file__).parent/'designs.py').read_text(),str(Path(__file__).parent/'designs.py'),'exec'))
manifest={'schemaVersion':1,'title':'Emberhall • Hollowvein Diggings','units':'provisional world units (not approved tile occupancy)','axis':'glTF Y-up','pivot':'ground-level local origin; no lineup offsets','integration':'VISUAL ONLY; placement/collision suggestions are NON-AUTHORITATIVE. No map, biome, navigation or gameplay changes.','assets':[]}
collections=[]
for index,(aid,family,title,build) in enumerate(SPECS):
 phase=index*.9;active=bpy.data.collections.new(aid);bpy.context.scene.collection.children.link(active);collections.append(active);objects=[]
 build()
 # Bake all transforms, shift lowest vertex exactly to ground. Named editable parts retain origin.
 lo=min(v.co.z for o in objects for v in o.data.vertices)
 for o in objects:
  for v in o.data.vertices:v.co.z-=lo
 bpy.ops.object.select_all(action='DESELECT');copies=[]
 for o in objects:
  c=o.copy();c.data=o.data.copy();bpy.context.scene.collection.objects.link(c);copies.append(c);c.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=aid
 bpy.ops.export_scene.gltf(filepath=str(OUT/(aid+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
 bpy.data.objects.remove(joined,do_unlink=True)
 manifest['assets'].append({'id':aid,'name':title,'family':family,'file':aid+'.glb','editableParts':len(objects),'suggestedPlacement':'ground-origin decorative camp art; no spawns, collision, loot, quests, captives or map integration','collisionSuggestion':'NON-AUTHORITATIVE: traversal, ground clearance, blockers and sockets require separate integration approval','sourceCollection':aid})
 active.hide_render=True
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
# Studio and real-source thumbnail renders; all authored collections kept at local origin.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.world.color=(.28,.28,.28);scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(-4,-6,10));bpy.context.object.data.energy=1500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7;aim(bpy.context.object,(0,0,1))
bpy.ops.object.light_add(type='AREA',location=(5,3,7));bpy.context.object.data.energy=950;bpy.context.object.data.size=6;aim(bpy.context.object,(0,0,1))
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO'
collections[0].hide_render=False
cam.location=(10,-14,10);aim(cam,(0,0,2));cam.data.ortho_scale=11
for i,c in enumerate(collections):c.hide_viewport=(i!=0)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'emberhall-mine.blend'))
collections[0].hide_render=True
for coll,entry in zip(collections,manifest['assets']):
 coll.hide_render=False;vs=[v.co for o in coll.objects for v in o.data.vertices];height=max(v.z for v in vs);width=max(max(v.x for v in vs)-min(v.x for v in vs),max(v.y for v in vs)-min(v.y for v in vs));target=Vector((0,0,height*.42));cam.location=target+Vector((8,-12,9));aim(cam,target);cam.data.ortho_scale=max(width*1.7,height*1.95,3.0);scene.render.filepath=str(EV/(entry['id']+'.png'));bpy.ops.render.render(write_still=True);coll.hide_render=True
print('HOLLOWVEIN_KIT_GENERATED',len(manifest['assets']))

coll=collections[-1];coll.hide_render=False;scene.render.resolution_x=1600;scene.render.resolution_y=1150;target=Vector((0,0,.8));cam.location=target+Vector((11,-16,20));aim(cam,target);cam.data.ortho_scale=16.0;scene.render.filepath=str(EV/'camp-hero.png');bpy.ops.render.render(write_still=True);coll.hide_render=True
