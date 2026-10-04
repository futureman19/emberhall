import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3];src=root/'art/blender/character-reimagined';ev=root/'art/verification/character-reimagined'
result=[]
for id in ['baseline-current','rowan','mira','arden']:
 bpy.ops.wm.open_mainfile(filepath=str(src/(id+'.blend')))
 objects=list(bpy.context.scene.objects);meshes=[o for o in objects if o.type=='MESH'];assert meshes
 assert not any(o.type in ['ARMATURE','CAMERA','LIGHT'] for o in objects)
 deps=bpy.context.evaluated_depsgraph_get();coords=[];faces=0
 for o in meshes:
  assert o.get('editable_character_part');ob=o.evaluated_get(deps);mesh=ob.to_mesh();mesh.calc_loop_triangles()
  for v in mesh.vertices:
   co=ob.matrix_world@v.co;assert all(math.isfinite(c) for c in co);coords.append(co)
  for t in mesh.loop_triangles:
   a,b,c=[mesh.vertices[i].co for i in t.vertices];assert (b-a).cross(c-a).length>1e-10,(id,o.name,'zero area')
  faces+=len(mesh.loop_triangles);ob.to_mesh_clear()
 bounds=[[min(c[i] for c in coords) for i in range(3)],[max(c[i] for c in coords) for i in range(3)]]
 assert abs(bounds[0][2])<1e-5,(id,bounds)
 checks={}
 if id!='baseline-current':
  for name,loc in [('head',(0,0,.88)),('arm_L',(-.32,0,.52)),('arm_R',(.32,0,.52))]:
   pivot=bpy.data.objects[id+'_'+name];assert (pivot.location-Vector(loc)).length<1e-6;assert len(pivot.children)>4;checks[name]={'anchorBlender':list(pivot.location),'children':len(pivot.children)}
  assert bpy.data.objects[id+'_nose'].parent==bpy.data.objects[id+'_head']
  assert bpy.data.objects[id+'_pupil_1'].location.y>0
  assert len([o for o in meshes if 'thumb' in o.name])==2
  assert len([o for o in meshes if 'knuckle' in o.name])==6
  # Actual rigid-pivot articulation moves hand, does not change sole grounding.
  pivot=bpy.data.objects[id+'_arm_R'];hand=bpy.data.objects[id+'_palm_1'];bpy.context.view_layer.update();before=hand.matrix_world.translation.copy();pivot.rotation_euler.x=-.8;bpy.context.view_layer.update();after=hand.matrix_world.translation.copy();assert (after-before).length>.1
  checks['rigidArmMovementDistance']=(after-before).length
 result.append({'id':id,'passed':True,'meshObjects':len(meshes),'evaluatedTriangles':faces,'boundsBlender':bounds,'pivotChecks':checks,'armature':False,'animationCompatibility':'NOT TESTED'})
report={'passed':True,'sourceReopenedFromDisk':True,'assets':result};(ev/'source-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
