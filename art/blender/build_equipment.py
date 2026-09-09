"""Regeneration overwrites manual edits to equipment.blend and tools.glb.
Named editable source meshes are assembled in a lineup; export copies are grip-part centered.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
wood=mat('warm walnut',(.21,.10,.045));iron=mat('soft forged iron',(.42,.40,.36))
def rings(name,rings,sides=8):
 verts=[]
 for y,rx,rz,dx in rings:
  verts += [(dx+rx*math.cos(a*2*math.pi/sides),-rz*math.sin(a*2*math.pi/sides),y) for a in range(sides)]
 faces=[tuple(reversed(range(sides))),tuple((len(rings)-1)*sides+a for a in range(sides))]
 for j in range(len(rings)-1):
  for a in range(sides):b=(a+1)%sides;faces.append((j*sides+a,j*sides+b,(j+1)*sides+b,(j+1)*sides+a))
 return mesh(name,verts,faces)
def mesh(name,v,f):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return o
def prism(name,poly,depth):
 # XY game silhouette extruded through Z; Blender (x,-z,y).
 v=[(x,-z,y) for z in [-depth/2,depth/2] for x,y in poly];n=len(poly)
 f=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
 f +=[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 o=mesh(name,v,f);bevel=o.modifiers.new('forged softened edges','BEVEL');bevel.width=.002;bevel.segments=2;return o
def register(o,id,offset,material):
 o.data.materials.append(material);o.location=(offset[0],-offset[2],offset[1]);o['export_part']=id;parts.append(o)
# Existing part centres in tool-local space; spread source tools along X only.
for i,(id,length,width,cy) in enumerate([('hatchet',.42,.045,.16),('pick',.44,.04,.16),('hoe',.44,.04,.16),('fishing_rod',.9,.064,.42)]):
 h=length/2;r=width/2
 if id=='fishing_rod':rs=[(-h,r*.85,r*.85,0),(-h+.04,r,r,0),(-.24,r*.9,r*.9,0),(.23,.018,.018,0),(h,.014,.014,0)]
 else:rs=[(-h,r*.65,r*.65,0),(-h+.025,r,r,0),(-.07,r*.85,r*.85,0),(.06,r*.8,r*.8,0),(h-.02,r*.8,r*.8,0),(h,r*.65,r*.65,0)]
 o=rings(id+'_handle',rs);register(o,id+'_handle',(i*.5,cy,0),wood)
 if id=='hatchet':o=prism(id+'_head',[(-.1,-.022),(-.06,-.027),(.07,-.05),(.1,-.036),(.1,.04),(.065,.05),(-.06,.025),(-.1,.02)],.066);center=(.08,.36,0)
 elif id=='pick':o=prism(id+'_head',[(-.14,-.035),(-.09,.015),(-.035,.035),(.035,.035),(.10,.006),(.14,-.035),(.068,-.007),(-.05,-.007)],.052);center=(.02,.38,0)
 elif id=='hoe':o=prism(id+'_head',[(-.11,-.02),(.1,-.025),(.11,-.01),(.1,.025),(-.11,.02)],.114);center=(.1,.38,0)
 else:
  # The runtime retains the original mesh X rotation, so this torus remains Z-normal in game.
  bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=6,location=(0,0,0),major_radius=.07,minor_radius=.013)
  o=bpy.context.object;o.name=id+'_head'
  # Blender XY torus exports as game XZ, rotate to export XY.
  o.rotation_euler.x=math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);center=(0,-.03,.035)
 register(o,id+'_head',(i*.5+center[0],center[1],center[2]),iron)
for o in parts:
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 # Recalculate outward normals for hand-authored prism winding.
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/equipment.blend'))
export=[]
for source in parts:
 id=source['export_part'];source.name='source_'+id
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=id;o.location=(0,0,0);export.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in export:o.select_set(True)
bpy.context.view_layer.objects.active=export[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'tools.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=False,export_animations=False)
print('EXPORTED',len(export),'parts', (OUT/'tools.glb').stat().st_size,'bytes')
