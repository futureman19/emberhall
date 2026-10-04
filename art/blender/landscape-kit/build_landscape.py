"""Original deterministic script-authored Emberhall landscape kit. No gameplay integration.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Regeneration overwrites this kit's generated files, including manual .blend edits.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/art/landscape-kit'; EV=ROOT/'art/verification/landscape-kit'
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
  t=(Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])).normalized();u=t.cross(Vector((0,1,0))).normalized();v=t.cross(u).normalized()
  for k in range(n):vs.append(Vector(p)+rs[j]*(math.cos(k*math.tau/n)*u+math.sin(k*math.tau/n)*v))
 fs=[]
 for j in range(len(pts)-1):
  for k in range(n):a=j*n+k;b=j*n+(k+1)%n;fs.append((a,b,b+n,a+n))
 fs.extend([tuple(reversed(range(n))),tuple((len(pts)-1)*n+k for k in range(n))]);return mesh(name,vs,fs,col)

def peak(snow=False):
 rings('Broken stratified massif',[(3.4,0,0,0),(2.85,.65,.15,0),(2.25,2,-.15,.12),(1.1,3.65,.3,.03),(.05,5.9,.55,.1)],'stone',rough=.19,n=13)
 for k in range(5):
  a=k*math.tau/5;rock('Radial fractured buttress '+str(k),(2*math.cos(a),2*math.sin(a),0),(1.1,.95,2.4+.5*math.sin(k)),'lightstone' if k%2 else 'stone')
 if snow:rings('Irregular permanent snow mantle',[(1.12,3.68,.3,.03),(.6,4.8,.44,.07),(.055,5.94,.55,.1)],'snow',rough=.18,n=13)

def volcano(active_lava):
 rings('Eroded outer crater and inner bowl',[(3.25,0,0,0),(2.85,.6,0,0),(1.48,2.65,.22,.1),(1.1,2.64,.22,.1),(.75,1.75,.22,.1)],'basalt' if active_lava else 'stone',rough=.13,n=18)
 rings('Crater basin',[(.85,2.06 if active_lava else 1.86,.22,.1),(.85,2.12 if active_lava else 1.91,.22,.1)],'lava' if active_lava else 'mud',n=18,rough=.02)
 for k in range(7):
  a=k*math.tau/7;rock('Talus '+str(k),(2.5*math.cos(a),2.5*math.sin(a),0),(.65,.65,.75),'basalt' if active_lava else 'lightstone')
 if active_lava:
  tube('Overflow incandescent channel',[(.25,-.96,2.76),(.4,-1.3,2.8),(.62,-1.7,2.45),(.65,-2.1,1.85),(.72,-2.55,1.02),(.85,-3.03,.47),(1,-3.4,.12)],[.18,.2,.21,.24,.27,.31,.35],'lava')
  tube('Golden channel core',[(.25,-.98,2.83),(.4,-1.32,2.91),(.62,-1.73,2.59),(.65,-2.13,2.0),(.72,-2.59,1.19),(.85,-3.07,.67),(1,-3.4,.34)],[.055,.06,.065,.07,.085,.09,.11],'hot',5)

def cliff(corner=False):
 for k in range(5):
  x=k*.82-1.64;y=.25*math.sin(k)
  rock('Upright weathered face '+str(k),(x,y,0),(.66,.75,2.5+.3*math.sin(k)),'stone')
  rock('Ochre ledge '+str(k),(x,y-.2,1.25),(.69,.79,.28),'lightstone')
 if corner:
  for k in range(1,4):rock('Return face '+str(k),(1.64,k*.83,0),(.7,.65,2.45),'stone')

def swamp():
 rings('Scalloped muddy bank',[(2.7,0,0,0),(2.73,.13,0,0),(2.36,.22,0,0),(2.18,.14,0,0)],'mud',n=22,rough=.1)
 rings('Still opaque green water',[(2.18,.09,0,0),(2.18,.15,0,0)],'water',n=22,rough=.1)
 for k in range(6):
  a=k*1.8;x=1.5*math.cos(a);y=1.5*math.sin(a);rings('Lily pad '+str(k),[(.23,.16,x,y),(.24,.18,x,y)],'moss',n=7,rough=.08)
 for k in range(3):rock('Bank stone '+str(k),(2.2*math.cos(k*2),2.2*math.sin(k*2),.04),(.36,.3,.36),'lightstone')

def reeds():
 for k in range(13):
  a=k*2.4;r=.65*math.sqrt(k/13);x=r*math.cos(a);y=r*math.sin(a);h=.8+.55*(.5+.5*math.sin(k*3))
  tube('Bent reed '+str(k),[(x,y,.02),(x+.05,y,h*.5),(x+.16,y+.07,h)],[.032,.024,.01],'reed',5)
  tube('Cattail '+str(k),[(x+.13,y+.055,h*.85),(x+.16,y+.07,h+.2)],[.065,.047],'bark',6)
  mesh('Broad folded blade '+str(k),[(x,y,.03),(x-.15,y-.1,h*.7),(x-.4,y-.17,h*.62),(x-.12,y+.015,h*.43)],[(0,1,3),(1,2,3),(3,1,0),(3,2,1)],'moss')

def tree():
 tube('Twisted hollow-looking bole',[(0,0,.18),(.2,.08,.8),(-.2,.03,1.6),(.04,.12,2.3),(.45,.2,3.3)],[.48,.42,.29,.24,.11],'bark')
 for k in range(7):
  a=k*math.tau/7;tube('Exposed root '+str(k),[(.12,0,.6),(.64*math.cos(a),.64*math.sin(a),.22),(1.25*math.cos(a),1.25*math.sin(a),.025)],[.22,.17,.025],'bark')
 for k in range(5):
  a=k*2.4;x=1.15*math.cos(a);y=1.15*math.sin(a);z=2.6+.45*math.sin(k)
  tube('Crooked branch '+str(k),[(0,.1,1.9),(.55*x,.55*y,z),(x,y,z+.18),(x*1.2,y*1.2,z+.6)],[.18,.13,.08,.015],'bark')
  rock('Sparse moss canopy '+str(k),(x,y,z+.15),(.85,.7,.53),'leaf')
  tube('Hanging moss '+str(k),[(x,y,z+.15),(x+.03,y,z-.38),(x+.12,y,z-.65)],[.14,.1,.01],'moss',5)

SPECS=[('rocky-peak','Highlands','Broken Crown',lambda:peak()),('snowcap-peak','Highlands','Winter Crown',lambda:peak(True)),('mountain-ridge','Highlands','Splitback Ridge',None),('cliff-straight','Highlands','Weathered Escarpment',lambda:cliff()),('cliff-corner','Highlands','Escarpment Return',lambda:cliff(True)),('boulder-cluster','Highlands','Waystone Scree',None),('active-volcano','Cinderlands','Embermouth',lambda:volcano(True)),('dormant-caldera','Cinderlands','Sleeping Caldera',lambda:volcano(False)),('basalt-columns','Cinderlands','Cinder Organ',None),('lava-pool','Cinderlands','Molten Tarn',None),('swamp-patch','Wetlands','Stillwater Fen',swamp),('reed-cluster','Wetlands','Cattail Thicket',reeds),('swamp-tree','Wetlands','Old Fenkeeper',tree),('moss-rocks','Wetlands','Mossbound Stones',None)]
manifest={'schemaVersion':1,'title':'Emberhall • Wild Frontiers','units':'provisional world units (not approved tile occupancy)','axis':'glTF Y-up','pivot':'ground-level local origin; no lineup offsets','integration':'VISUAL ONLY; placement/collision suggestions are NON-AUTHORITATIVE. No map, biome, navigation or gameplay changes.','assets':[]}
collections=[]
for index,(aid,family,title,build) in enumerate(SPECS):
 phase=index*.9;active=bpy.data.collections.new(aid);bpy.context.scene.collection.children.link(active);collections.append(active);objects=[]
 if build:build()
 elif aid=='mountain-ridge':
  for k in range(4):rock('Interlocking ridge tooth '+str(k),(k*1.5-2.25,.27*math.sin(k),0),(1.3,1.55,2.9+.65*math.sin(k*2)),'stone' if k%2 else 'lightstone')
 elif aid in ['boulder-cluster','moss-rocks']:
  for k in range(5):
   x=.95*math.cos(k*2.4);y=.85*math.sin(k*2.4);s=.6+.22*math.sin(k)
   rock('Grounded boulder '+str(k),(x,y,0),(s,s*.82,s*1.15),'stone')
   if aid=='moss-rocks':rock('Moss saddle '+str(k),(x-.04,y,s*.73),(s*.65,s*.6,s*.35),'moss')
 elif aid=='basalt-columns':
  for k in range(13):
   x=(k%4)*.62-1;y=(k//4)*.57-.8;h=.8+1.9*(.5+.5*math.sin(k*1.7));rings('Hexagonal jointed column '+str(k),[(.34,0,x,y),(.34,h*.49,x,y),(.32,h*.52,x,y),(.33,h,x,y)],'basalt',n=6,rough=.01)
 elif aid=='lava-pool':
  rings('Broken lava crust rim',[(2.1,0,0,0),(2.2,.23,0,0),(1.82,.28,0,0),(1.75,.11,0,0)],'basalt',n=17,rough=.14)
  rings('Molten surface',[(1.78,.1,0,0),(1.78,.16,0,0)],'lava',n=17,rough=.1)
  for k in range(5):rock('Cooling crust island '+str(k),(.9*math.cos(k*2.4),.9*math.sin(k*2.4),.17),(.35,.29,.08),'basalt')
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
 manifest['assets'].append({'id':aid,'name':title,'family':family,'file':aid+'.glb','editableParts':len(objects),'suggestedPlacement':'grounded decorative module; overlap bases to conceal seams; cliff pieces are not watertight terrain tiles','collisionSuggestion':'non-authoritative: broad footprint blocker' if family!='Wetlands' else 'non-authoritative: designer decides water traversal, reeds decorative; tree/rocks may need blockers','sourceCollection':aid})
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
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'emberhall-landscape.blend'))
collections[0].hide_render=True
for coll,entry in zip(collections,manifest['assets']):
 coll.hide_render=False;vs=[v.co for o in coll.objects for v in o.data.vertices];height=max(v.z for v in vs);width=max(max(v.x for v in vs)-min(v.x for v in vs),max(v.y for v in vs)-min(v.y for v in vs));target=Vector((0,0,height*.42));cam.location=target+Vector((8,-12,9));aim(cam,target);cam.data.ortho_scale=max(width*1.7,height*1.95,3.0);scene.render.filepath=str(EV/(entry['id']+'.png'));bpy.ops.render.render(write_still=True);coll.hide_render=True
print('LANDSCAPE_KIT_GENERATED',len(manifest['assets']))
