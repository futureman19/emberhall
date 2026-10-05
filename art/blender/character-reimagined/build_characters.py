"""Original script-authored Emberhall character concept; no application integration.
Blender +Y front -> glTF -Z front. Coordinates below use Blender Z-up.
Regeneration replaces only this new kit. Named meshes remain editable in .blend.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'art/blender/character-reimagined'; OUT=ROOT/'public/art/character-reimagined'; EV=ROOT/'art/verification/character-reimagined'

def clean():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):bpy.data.materials.remove(m)

def mat(name,h):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.78
 return m

def finish(o,name,material):
 o.name=name;o.data.materials.clear();o.data.materials.append(material);o['editable_character_part']=True
 return o

def box(name,loc,size,material,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 finish(o,name,material)
 if bevel:
  m=o.modifiers.new('Crafted edge bevel','BEVEL');m.width=min(bevel,min(size)*.40);m.segments=2
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def ell(name,loc,size,material,seg=16,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc)
 o=bpy.context.object;o.scale=tuple(s/2 for s in size);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 finish(o,name,material)
 for f in o.data.polygons:f.use_smooth=True
 return o

def profile(name,levels,material,n=12):
 # z, x radius, y radius, x centre, y centre; closed tailored silhouette.
 vs=[];fs=[]
 for z,rx,ry,x,y in levels:
  for i in range(n):
   a=math.tau*i/n;vs.append((x+rx*math.cos(a),y+ry*math.sin(a),z))
 for j in range(len(levels)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs+=[tuple(reversed(range(n))),tuple((len(levels)-1)*n+i for i in range(n))]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,material)
 return o

def ribbon(name,points,widths,depths,material):
 return profile(name,[(p[2],w,d,p[0],p[1]) for p,w,d in zip(points,widths,depths)],material,8)

def rod(name,a,b,r,material):
 a,b=Vector(a),Vector(b);d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=d.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,material)

def parent_group(name,anchor,objects):
 e=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(e);e.location=anchor;e.empty_display_size=.055;e['candidate_pivot']=True
 bpy.context.view_layer.update()
 for o in objects:
  mw=o.matrix_world.copy();o.parent=e;o.matrix_world=mw
 return e

def export_save(id):
 bpy.context.view_layer.update()
 bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(id+'.blend')))
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_animations=False)

def studio():
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
 scene.cycles.use_denoising=True;scene.render.resolution_percentage=100
 scene.world.color=(.24,.24,.24);scene.view_settings.view_transform='AgX'
 floor=mat('Studio / warm charcoal','303932');box('STUDIO ground',(0,0,-.045),(200,200,.08),floor,0)
 for name,loc,power,size,col in [('Key',(-3,4,5),430,4,(1,.85,.66)),('Fill',(3,2,3),280,3,(.75,.86,1)),('Rim',(0,-3,4),550,3,(1,.75,.45))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(2.2,5,2.8));cam=bpy.context.object;scene.camera=cam
 return cam

def render(id):
 cam=studio();s=bpy.context.scene
 def shot(label,loc,target,scale,w,h):
  cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale
  s.render.resolution_x=w;s.render.resolution_y=h;s.render.filepath=str(EV/(id+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
 shot('beauty',(2.2,5,2.5),(0,0,.64),1.66,720,820)
 shot('face',(1.1,5,1.8),(0,.02,.92),.78,640,640)
 shot('back',(-2.5,-5,2.8),(0,0,.65),1.65,640,740)
 # Default world camera exactly: +16,+23,+20 game XYZ, target Y=.4.
 # Rotate figures PI so local -Z front faces the default camera.
 for o in list(bpy.context.scene.objects):
  if o.get('editable_character_part') and not o.parent:o.rotation_euler.z+=math.pi;o.location.x*=-1;o.location.y*=-1
  elif o.get('candidate_pivot') and not o.parent:o.rotation_euler.z+=math.pi;o.location.x*=-1;o.location.y*=-1
 cam.location=(16,-20,23);cam.rotation_euler=(Vector((0,0,.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=32/(2*math.tan(math.radians(48)/2))
 s.render.resolution_x=1440;s.render.resolution_y=900;s.render.filepath=str(EV/(id+'-gameplay.png'));bpy.ops.render.render(write_still=True)

VARIANTS=[
 dict(id='rowan',name='Rowan / ember & oak',skin='d5ac88',hair='50362a',highlight='78503a',cloth='9a503d',trim='cf985d',pants='3c4541',style='swept',width=1.0),
 dict(id='mira',name='Mira / river & brass',skin='78513d',hair='24232a',highlight='403638',cloth='376f70',trim='d4ac6c',pants='343d43',style='braid',width=.94),
 dict(id='arden',name='Arden / heather & silver',skin='b99270',hair='b6b5a4',highlight='ded7bc',cloth='69536d',trim='b4bcb0',pants='383845',style='crop',width=1.06)
]

def candidate(v):
 clean();sid=v['id'];w=v['width']
 skin=mat('Skin / '+v['skin'],v['skin']);skinshadow=mat('Ear and lip warmth','935f49' if sid!='mira' else '58352e')
 hair=mat('Hair / '+v['style'],v['hair']);hairhi=mat('Hair ridges',v['highlight']);cloth=mat('Garb / '+v['cloth'],v['cloth']);trim=mat('Woven edging',v['trim'])
 linen=mat('Undershirt / warm flax','d5c6a6');leather=mat('Leather / oiled walnut','48382e');leatherhi=mat('Leather edges','7d5a39');pants=mat('Trouser wool',v['pants']);dark=mat('Eye and mouth ink','272626');white=mat('Eye warm ivory','f2e5cd');iris=mat('Iris','4a7363' if sid=='arden' else '795932');metal=mat('Hardware / antique brass',v['trim'])
 # Small grounded boots with flared cuffs, extended shaped toes and layered soles.
 for sign in [-1,1]:
  x=sign*.115
  profile(f'{sid}_trouser_{sign}',[(.10,.073,.075,x,0),(.17,.082,.085,x,0),(.29,.083,.078,x,0),(.35,.085,.075,x,0)],pants)
  box(f'{sid}_sole_{sign}',(x,.031,.018),(.19,.27,.036),leather,.014)
  profile(f'{sid}_boot_{sign}',[(.03,.091,.123,x,.03),(.068,.091,.124,x,.03),(.10,.077,.090,x,.012),(.19,.077,.077,x,-.008)],leather,12)
  profile(f'{sid}_boot_cuff_{sign}',[(.159,.083,.081,x,-.008),(.185,.087,.083,x,-.008),(.201,.083,.079,x,-.008)],leatherhi)
  for z in [.09,.12]:rod(f'{sid}_boot_stitch_{sign}_{z}',(x-.044,.096,z),(x+.044,.096,z+.006),.004,trim)
 # Torso remains short, broad and recognizable. Longer split tails, structured chest.
 profile(f'{sid}_tunic_body',[(.28,.235*w,.14,0,0),(.32,.245*w,.153,0,0),(.415,.197*w,.138,0,0),(.53,.221*w,.151,0,0),(.60,.247*w,.142,0,0),(.655,.174*w,.119,0,0)],cloth,16)
 profile(f'{sid}_collar_linen',[(.595,.129,.12,0,.01),(.68,.10,.092,0,0),(.702,.098,.09,0,0)],linen)
 profile(f'{sid}_neck',[(.656,.072,.068,0,0),(.736,.077,.074,0,0)],skin)
 # Separate overlapping front panels and edged V opening.
 for sign in [-1,1]:
  if sid=='rowan':
   o=box(f'{sid}_lapel_{sign}',(sign*.087,.135,.601),(.067,.033,.137),trim,.012);o.rotation_euler.y=sign*.36
  elif sid=='arden':
   o=box(f'{sid}_stand_collar_{sign}',(sign*.11,.096,.644),(.052,.033,.087),leather,.010);o.rotation_euler.y=sign*.20
  else:
   o=box(f'{sid}_scarf_fold_{sign}',(sign*.068,.127,.640),(.14,.070,.070),linen,.023);o.rotation_euler.y=sign*.20
  o=box(f'{sid}_split_tail_{sign}',(sign*.112,.132,.328),(.193,.044,.115),cloth,.015);o.rotation_euler.y=sign*.075
  rod(f'{sid}_hem_{sign}',(sign*.025,.159,.281),(sign*.211,.148,.295),.008,trim)
 profile(f'{sid}_waist_belt',[(.408,.208*w,.151,0,0),(.447,.214*w,.154,0,0)],leather,16)
 box(f'{sid}_buckle',(0,.168,.43),(.076,.026,.064),metal,.008);box(f'{sid}_buckle_inset',(0,.184,.43),(.039,.012,.033),leather,.004)
 # Diagonal satchel strap seated above tunic, functional-looking pouch at hip.
 strap=box(f'{sid}_strap',(-.007,.166,.527),(.034,.014,.393),leather,.005);strap.rotation_euler.y=-1.052
 # Flat continuation over the left shoulder: no rigid cylindrical cross-body bar.
 shoulderstrap=box(f'{sid}_strap_shoulder',(-.177,.028,.636),(.036,.25,.014),leather,.005);shoulderstrap.rotation_euler.y=.15
 box(f'{sid}_satchel',(.224,-.005,.355),(.142,.167,.15),leather,.027)
 box(f'{sid}_satchel_flap',(.224,.082,.384),(.149,.024,.081),leatherhi,.012)
 box(f'{sid}_satchel_clasp',(.224,.099,.367),(.022,.012,.035),metal,.003)
 for z in [.50,.548]:ell(f'{sid}_tunic_button_{z}',(-.032,.164,z),(.016,.014,.016),metal,12,6)
 if sid=='mira':
  scarf=box(f'{sid}_scarf_tail',(-.112,.161,.571),(.084,.040,.15),linen,.018);scarf.rotation_euler.y=-.22
  ell(f'{sid}_scarf_knot',(-.10,.16,.635),(.075,.068,.071),linen,12,8)
 if sid=='arden':
  box(f'{sid}_shoulder_tab',(-.236,.008,.604),(.20,.205,.052),leather,.015)
  for z in [.50,.545,.59]:rod(f'{sid}_toggle_{z}',(-.058,.16,z),(.034,.167,z),.008,trim)
 # Arm pivots share old shoulder location, but geometry is redesigned, not drop-in.
 for sign in [-1,1]:
  before=set(bpy.context.scene.objects);x=sign*.304
  profile(f'{sid}_sleeve_{sign}',[(.315,.068,.072,sign*.33,0),(.40,.078,.082,sign*.328,0),(.54,.096,.096,x,0),(.604,.087,.095,sign*.28,0)],cloth)
  profile(f'{sid}_cuff_{sign}',[(.314,.076,.078,sign*.33,0),(.351,.079,.081,sign*.33,0)],linen)
  profile(f'{sid}_bracer_{sign}',[(.30,.073,.078,sign*.331,0),(.317,.076,.081,sign*.331,0)],leather)
  palm=box(f'{sid}_palm_{sign}',(sign*.336,.005,.269),(.118,.115,.096),skin,.025)
  ell(f'{sid}_thumb_{sign}',(sign*.285,.049,.276),(.051,.060,.068),skin,12,8)
  for k in range(3):
   ell(f'{sid}_knuckle_{sign}_{k}',(sign*.336+(k-1)*.027,.052,.251),(.029,.028,.043),skin,12,6)
  parent_group(f'{sid}_arm_{"L" if sign<0 else "R"}',(sign*.32,0,.52),set(bpy.context.scene.objects)-before)
 # Custom profile head: chin, cheek plane, brow shelf, crown. Not a capsule.
 before=set(bpy.context.scene.objects)
 profile(f'{sid}_face',[(.686,.086,.088,0,.012),(.717,.147,.15,0,.013),(.789,.214,.193,0,.012),(.89,.242,.214,0,0),(.983,.235,.20,0,0),(1.052,.19,.169,0,-.002),(1.09,.10,.10,0,-.006)],skin,20)
 for sign in [-1,1]:
  ell(f'{sid}_ear_{sign}',(sign*.238,-.002,.874),(.085,.083,.127),skin,12,8)
  ell(f'{sid}_ear_inner_{sign}',(sign*.265,.031,.875),(.034,.025,.073),skinshadow,12,8)
  # Ivory small almond-shaped eyes with upper lid and dark iris.
  eye=ell(f'{sid}_eye_socket_{sign}',(sign*.10,.193,.90),(.095,.025,.048),dark,16,8)
  ell(f'{sid}_eye_white_{sign}',(sign*.10,.205,.897),(.080,.016,.035),white,16,8)
  ell(f'{sid}_iris_{sign}',(sign*.10,.214,.899),(.030,.009,.032),iris,12,8)
  ell(f'{sid}_pupil_{sign}',(sign*.10,.219,.899),(.016,.005,.024),dark,12,8)
  ell(f'{sid}_catchlight_{sign}',(sign*.10-.005,.222,.906),(.008,.004,.009),white,8,6)
  brow=box(f'{sid}_expressive_brow_{sign}',(sign*.099,.214,.957),(.104,.027,.023),hair,.007);brow.rotation_euler.y=sign*(-.12 if sid!='arden' else .1)
 # Nose bridge grows from face, tip projects rather than isolated sphere.
 profile(f'{sid}_nose',[(.826,.027,.02,0,.221),(.848,.04,.040,0,.229),(.876,.022,.038,0,.219),(.929,.013,.013,0,.201)],skin,8)
 rod(f'{sid}_smile_left',(-.035,.205,.791),(0,.212,.784),.0035,skinshadow)
 rod(f'{sid}_smile_right',(0,.212,.784),(.035,.205,.791),.0035,skinshadow)
 # Fitted hair crown, explicit temples and discrete directional locks.
 profile(f'{sid}_hair_crown',[(.994,.233,.202,0,-.009),(1.052,.247,.215,0,-.012),(1.112,.205,.184,0,-.021),(1.158,.124,.12,0,-.025),(1.177,.025,.028,0,-.025)],hair,20)
 for sign in [-1,1]:
  ribbon(f'{sid}_temple_{sign}',[(sign*.225,-.025,.875),(sign*.245,-.018,.966),(sign*.222,-.025,1.06)],[.018,.037,.036],[.08,.12,.12],hair)
 if v['style']=='swept':
  for i in range(5):
   x=-.19+i*.077
   ribbon(f'{sid}_swept_lock_{i}',[(x-.02,.198,.988+abs(i-1)*.008),(x+.032,.206,1.048),(x+.064,.135,1.119),(x+.04,.032,1.153)],[.012,.055,.061,.025],[.013,.032,.049,.045],hair if i%2 else hairhi)
 elif v['style']=='braid':
  for i in range(5):
   x=-.17+i*.085
   ribbon(f'{sid}_pulled_lock_{i}',[(x,.206,1.014),(x*1.18,.11,1.11),(x*.65,-.05,1.167)],[.025,.053,.022],[.023,.045,.035],hair if i%2 else hairhi)
  ell(f'{sid}_braid_root',(.10,-.201,1.076),(.19,.17,.18),hair)
  for i in range(6):
   x=.11+(.02 if i%2 else -.02);z=1.015-i*.058;y=-.246+i*.009
   o=ell(f'{sid}_braid_weave_{i}',(x,y,z),(.114-i*.009,.094-i*.005,.102),hair if i%2 else hairhi,12,8);o.rotation_euler.y=(-1 if i%2 else 1)*.4
  box(f'{sid}_braid_tie',(.11,-.199,.705),(.060,.07,.029),trim,.009)
  ribbon(f'{sid}_braid_tip',[(.115,-.199,.642),(.112,-.205,.702)],[.008,.027],[.014,.029],hair)
 else:
  for i in range(7):
   x=-.19+i*.058
   ribbon(f'{sid}_cropped_wave_{i}',[(x,.186,.991+(.025 if i>2 else .002)),(x+.016,.202,1.042),(x+.006,.118,1.125)],[.008,.036,.029],[.013,.026,.043],hair if i%3 else hairhi)
  # subtle paired cheek marks, not a combat-role prop
  for sign in [-1,1]:rod(f'{sid}_cheek_line_{sign}',(sign*.153,.161,.815),(sign*.182,.142,.837),.004,skinshadow)
 parent_group(f'{sid}_head',(0,0,.88),set(bpy.context.scene.objects)-before)
 if sid!='rowan':
  # Short back mantle gives a different silhouette without hiding face/hands.
  profile(f'{sid}_back_mantle',[(.40,.243,.035,0,-.181),(.455,.255,.045,0,-.187),(.60,.248,.043,0,-.143),(.672,.119,.036,0,-.097)],cloth if sid=='mira' else leather,16)
  rod(f'{sid}_mantle_hem',(-.225,-.19,.41),(.225,-.19,.41),.009,trim)
 # Named neutral anchors are documentation, not runtime equipment sockets yet.
 e=bpy.data.objects.new(sid+'_equipment_preview_anchor',None);bpy.context.collection.objects.link(e);e.location=(.32,0,.26);e['candidate_pivot']=True;e['integration_status']='unvalidated'
 export_save(sid);render(sid)


def baseline():
 clean();bpy.ops.import_scene.gltf(filepath=str(SRC/'reference/current-character.glb'))
 original={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
 # Preserve exact imported, axis-baked GLB geometry. Runtime replaces all materials.
 for o in original.values():
  o.data.transform(o.matrix_world);o.matrix_world.identity();o.parent=None
 skin=mat('Current default skin','c9c3b6');cloth=mat('Current default rust','a85a42');hair=mat('Current default hair','3a322c');legs=mat('Current wool','3a342e');boots=mat('Current boots','2e241c');gold=mat('Current belt','c9a36a');ink=mat('Current face ink','29211e');white=mat('Current catchlight','fff3d9');seam=mat('Current seam','8c4a36')
 mapping={'head':[(0,0,.88)],'torso':[(0,0,.48)],'leg':[(-.11,0,.19),(.11,0,.19)],'foot':[(-.11,-.02,.04),(.11,-.02,.04)],'hair_cap':[(0,0,1.14)],'belt':[(0,.16,.48)]}
 mats={'head':skin,'torso':cloth,'leg':legs,'foot':boots,'hair_cap':hair,'belt':gold}
 used=[]
 for name,locs in mapping.items():
  for i,loc in enumerate(locs):
   o=original[name].copy();o.data=original[name].data.copy();bpy.context.collection.objects.link(o);o.location=loc;finish(o,'baseline_'+name+str(i),mats[name]);used.append(o)
 for sign in [-1,1]:
  obs=[]
  for name,z,ma in [('arm',.42,cloth),('hand',.26,skin)]:
   o=original[name].copy();o.data=original[name].data.copy();bpy.context.collection.objects.link(o);o.location=(sign*.32,0,z);finish(o,'baseline_'+name+str(sign),ma);obs.append(o)
  arm=parent_group('baseline_arm_'+str(sign),(sign*.32,0,.52),obs);arm.rotation_euler.y=sign*.12
 for o in original.values():bpy.data.objects.remove(o,do_unlink=True)
 # Remove imported empty nodes, leaving reconstructed geometry.
 for o in list(bpy.context.scene.objects):
  if o.type=='EMPTY' and not o.get('candidate_pivot'):bpy.data.objects.remove(o,do_unlink=True)
 for x in [-.1,.1]:
  ell('baseline_eye',(x,.216,.895),(.044,.024,.064),ink,12,8)
  ell('baseline_glint',(x-.006,.227,.905),(.012,.012,.012),white,8,6)
 ell('baseline_nose',(0,.221,.845),(.05,.046,.05),skin,8,6)
 # exact runtime seam linear colour is .67 * garb
 base=list(cloth.diffuse_color);seam.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*(c*.67 for c in base[:3]),1)
 for sign in [-1,1]:
  o=box('baseline_seam_'+str(sign),(sign*.04,.153,.61),(.018,.012,.1),seam,0);o.rotation_euler.y=sign*.55
 export_save('baseline-current');render('baseline-current')

if __name__=='__main__':
 baseline()
 for v in VARIANTS:candidate(v)
 manifest={'title':'Emberhall / A self for the road','scope':'Standalone character redesign review. Not integrated.', 'front':'glTF -Z; Blender +Y','rig':'Rigid head and arm empty pivots. No armature, skinning or animation clips.','baseline':'Actual current character.glb reconstructed with FIGURE anchors, DEFAULT_LOOK, idle arm rotations, belt and runtime face/seams; no gear or bob; neutral studio, not live game screenshot.','assets':[{'id':'baseline-current','name':'Current / default crop','file':'baseline-current.glb','kind':'baseline'}]+[{'id':v['id'],'name':v['name'],'file':v['id']+'.glb','kind':'candidate','palette':v} for v in VARIANTS]}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
 print('CHARACTER PREVIEW COMPLETE')
