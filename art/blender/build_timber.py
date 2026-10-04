"""Original script-authored Lanternwood timber, not third-party/sculpted artwork.
Run Blender background factory-startup. Re-running replaces timber*.blend / GLBs.
Editable named branch and foliage meshes are saved before export joins. Oak is read-only.
Game coordinates (x,y,z) map to Blender (x,-z,y); standard glTF export is Y-up.
"""
import bpy
import math
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/lanternwood'
IDS = ['pine', 'willow', 'birch', 'ash', 'redwood', 'yew', 'ghostwood']
DESIGNS = {
 'pine': 'Scalloped evergreen tiers, lifted branch tips and rounded leader',
 'willow': 'Arched arms, umbrella crown and long soft pendant foliage',
 'birch': 'Slender twin forks and airy alternating oval leaf sprays',
 'ash': 'Uplifted branching fan with layered broad feather-like sprays',
 'redwood': 'Buttressed bole and narrow stacked rounded evergreen boughs',
 'yew': 'Twisted spreading arms and broad flattened evergreen pillows',
 'ghostwood': 'Spiralling pale forks and connected teardrop foliage on visible slender crown boughs',
}

def xyz(p): return Vector((p[0], -p[2], p[1]))
def material(name, rgb):
 m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
 m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*rgb,1)
 m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95
 return m

def tube(name, points, radii, mat):
 # Ring-built taper follows an original bent path; softer octagonal cross-section.
 verts=[]; faces=[]; sides=8
 for j,p in enumerate(points):
  pos=xyz(p); tangent=xyz(points[min(j+1,len(points)-1)])-xyz(points[max(0,j-1)])
  tangent.normalize(); u=tangent.cross(Vector((0,1,0)))
  if u.length<.01: u=tangent.cross(Vector((1,0,0)))
  u.normalize(); v=tangent.cross(u).normalized()
  for k in range(sides):
   a=k*math.tau/sides; verts.append(pos+radii[j]*(math.cos(a)*u+math.sin(a)*v))
 for j in range(len(points)-1):
  for k in range(sides):
   a=j*sides+k; b=j*sides+(k+1)%sides
   faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))])
 mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
 ob=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat)
 for p in mesh.polygons:p.use_smooth=True
 return ob

def lobe(name, p, size, mat, yaw=0):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, location=xyz(p))
 ob=bpy.context.object; ob.name=name; ob.scale=(size[0],size[2],size[1]); ob.rotation_euler.z=-yaw
 # Small fixed asymmetry makes softer hand-shaped silhouettes, no random stream.
 for v in ob.data.vertices:
  v.co.x *= 1+.065*math.sin(v.co.z*5+v.co.y*3)
 for poly in ob.data.polygons:poly.use_smooth=True
 ob.data.materials.append(mat)
 return ob

def normalize(objects, bottom, top, radius):
 bpy.context.view_layer.update()
 coords=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 lo=min(v.z for v in coords); hi=max(v.z for v in coords)
 extent=max(max(abs(v.x),abs(v.y)) for v in coords)
 radial=min(1,radius/extent)
 for o in objects:
  matrix=o.matrix_world.copy()
  for v in o.data.vertices:
   p=matrix@v.co; v.co=(p.x*radial,p.y*radial,bottom+(p.z-lo)/(hi-lo)*(top-bottom))
  o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)

def joined(copies, name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in copies:o.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
 ob=bpy.context.object;ob.name=name
 # Single material per canonical part: renderer owns resource color.
 ob.data.materials.clear();ob.data.materials.append(WHITE)
 for p in ob.data.polygons:p.material_index=0
 return ob

def clone(objects):
 copies=[]
 for ob in objects:
  c=ob.copy();c.data=ob.data.copy();bpy.context.collection.objects.link(c);copies.append(c)
 return copies

OUT.mkdir(parents=True,exist_ok=True)
manifest={'generator':'Blender '+bpy.app.version_string,'coordinates':'Y-up; assembled mature ground pivot; runtime trunk/crown anchors baked by loader','assets':{}}
oak=(OUT/'oak.glb').read_bytes()
assert hashlib.sha256(oak).hexdigest()=='e38306e785170da4e66399611d7e1e715d4ccb40b9693883f63abb66055f0f8a'
manifest['assets']['oak']={'url':'/art/lanternwood/oak.glb','bytes':len(oak),'sha256':hashlib.sha256(oak).hexdigest(),'source':'art/blender/oak-kit.blend','design':'Approved oak retained byte-identical; original local-part anchors'}
for species in IDS:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 WHITE=material('export_runtime_palette',(1,1,1));bark=material(species+'_editable_bark',(.34,.23,.15));leaf=material(species+'_editable_leaf',(.26,.42,.24))
 trunk=[];crown=[]
 width={'birch':.09,'redwood':.23,'yew':.17,'ghostwood':.11}.get(species,.14)
 bend={'willow':.18,'yew':-.2,'ghostwood':.24}.get(species,.04)
 trunk.append(tube(species+'_bole',[(0,0,0),(bend,.7,.03),(-bend*.3,1.4,-.02),(.06,2.1,0)],[width*1.5,width,width*.72,.045],bark))
 for k in range(4):
  a=k*math.tau/4+.3
  trunk.append(tube(species+'_root_'+str(k),[(math.cos(a)*width*2.1,.025,math.sin(a)*width*2.1),(math.cos(a)*width*.7,.18,math.sin(a)*width*.7),(0,.4,0)],[.018,width*.45,width*.55],bark))
 arms={'pine':6,'willow':7,'birch':5,'ash':6,'redwood':8,'yew':7,'ghostwood':5}[species]
 for k in range(arms):
  a=k*2.39996; reach=.55 if species=='redwood' else .82
  h=1.1+(k%3)*.21
  trunk.append(tube(species+'_branch_'+str(k),[(0,h,0),(math.cos(a)*reach*.45,h+.35,math.sin(a)*reach*.45),(math.cos(a)*reach,h+.6,math.sin(a)*reach)],[width*.57,.065,.019],bark))
 if species in ['pine','redwood']:
  levels=4 if species=='pine' else 6
  for j in range(levels):
   radius=(1-j/(levels+1))*(1 if species=='pine' else .78)
   for k in range(3):
    a=k*math.tau/3+j*.65
    crown.append(lobe(species+'_tier_%d_%d'%(j,k),(math.cos(a)*radius*.27,1.8+j*.43,math.sin(a)*radius*.27),(radius*.8,.47 if species=='pine' else .4,radius*.7),leaf,a))
  crown.append(lobe(species+'_leader',(0,3.85,0),(.25,.5,.25),leaf))
 elif species=='willow':
  crown.append(lobe('willow_umbrella',(0,3.4,0),(.85,.57,.83),leaf))
  for k in range(9):
   a=k*math.tau/9
   crown.append(lobe('willow_pendant_'+str(k),(math.cos(a)*.78,2.55+(k%2)*.15,math.sin(a)*.78),(.28,.95,.3),leaf,a))
 elif species=='birch':
  for k in range(7):
   a=k*2.4; y=2.1+k*.26
   crown.append(lobe('birch_spray_'+str(k),(math.cos(a)*.43,y,math.sin(a)*.43),(.55,.39,.35),leaf,a))
 elif species=='ash':
  for k in range(8):
   a=k*2.4
   crown.append(lobe('ash_uplift_'+str(k),(math.cos(a)*.56,2.35+(k%3)*.53,math.sin(a)*.56),(.66,.52,.4),leaf,a))
 elif species=='yew':
  for k in range(8):
   a=k*2.4
   crown.append(lobe('yew_pillow_'+str(k),(math.cos(a)*.55,2.1+(k%3)*.5,math.sin(a)*.55),(.69,.35,.51),leaf,a))
 else:
  for k in range(5):
   a=k*2.4
   crown.append(lobe('ghostwood_wisp_'+str(k),(math.cos(a)*.63,2.15+k*.37,math.sin(a)*.63),(.27,.66,.3),leaf,a))
  crown.append(lobe('ghostwood_spirit_tip',(.13,3.8,0),(.23,.46,.2),leaf))
  # Continuous upper crown skeleton: visible support, never floating foliage.
  crown.append(tube('ghostwood_crown_leader',[(0,1.7,0),(.08,2.4,.02),(-.03,3.1,0),(.13,3.8,0)],[.065,.052,.038,.015],leaf))
  for k in range(5):
   a=k*2.4; y=2.15+k*.37
   crown.append(tube('ghostwood_crown_bough_'+str(k),[(.02,y-.38,0),(math.cos(a)*.32,y-.14,math.sin(a)*.32),(math.cos(a)*.63,y,math.sin(a)*.63)],[.045,.032,.012],leaf))
 normalize(trunk,0,2.1,.88);normalize(crown,1.7,4.2,1.14)
 stump=[tube(species+'_cut_bole',[(0,0,0),(.012,.14,0),(0,.29,0)],[width*1.45,width*1.2,width*1.1],bark)]
 normalize(stump,0,.29,.4)
 groups={'trunk':trunk,'crown':crown,'stump':stump}
 # Grounded saplings retain species-specific branching and split runtime palettes.
 for part,objects in [('sapling_trunk',trunk),('sapling_crown',crown)]:
  small=clone(objects)
  for i,o in enumerate(small):
   o.name=species+'_'+part+'_editable_'+str(i)
   for v in o.data.vertices:v.co*=1.2/4.2
  groups[part]=small
 bpy.context.scene['timber_species']=species;bpy.context.scene['design']=DESIGNS[species]
 bpy.context.scene['runtime_contract']='Ground Y-up export; mature trunk offset -1.05, crown -2.95; neutral export material'
 source=ROOT/'art/blender'/('timber-'+species+'.blend')
 bpy.ops.wm.save_as_mainfile(filepath=str(source))
 exports=[joined(clone(objects),species+'_'+part) for part,objects in groups.items()]
 bpy.ops.object.select_all(action='DESELECT')
 for o in exports:o.select_set(True)
 dest=OUT/('timber-'+species+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
 parts={}
 for o in exports:
  co=[o.matrix_world@v.co for v in o.data.vertices]
  game=[(v.x,v.z,-v.y) for v in co]
  parts[o.name]={'vertices':len(co),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'min':[round(min(p[i] for p in game),6) for i in range(3)],'max':[round(max(p[i] for p in game),6) for i in range(3)]}
 data=dest.read_bytes()
 manifest['assets'][species]={'url':'/art/lanternwood/'+dest.name,'source':source.relative_to(ROOT).as_posix(),'design':DESIGNS[species],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'parts':parts}
(OUT/'timber-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('TIMBER_EXPORT_OK '+json.dumps({id:a['bytes'] for id,a in manifest['assets'].items()}))
