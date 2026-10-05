"""Independent reopen + Blender GLB round-trip audit, never runs author generator.
All comparisons in Blender Z-up world coordinates; KD trees tolerate float export.
Run Blender --background --factory-startup --python-exit-code 1 --python THIS.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'art/blender/character-reimagined';OUT=ROOT/'public/art/character-reimagined';EV=ROOT/'art/verification/character-reimagined'
report={'passed':False,'method':'Independently reopen saved .blend, evaluate modifiers, then import exported GLB and compare named world-space vertex sets bidirectionally within 0.000003 units. Does not invoke generator.','assets':[]}

def meshes():
 dg=bpy.context.evaluated_depsgraph_get();result={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  ob=o.evaluated_get(dg);m=ob.to_mesh();coords=[tuple(ob.matrix_world@v.co) for v in m.vertices]
  assert coords and all(math.isfinite(v) for point in coords for v in point),o.name+' finite source vertices'
  m.calc_loop_triangles()
  result[o.name]={'coordinates':coords,'triangles':len(m.loop_triangles),'parent':o.parent.name if o.parent else None,'materials':[s.material.name for s in o.material_slots if s.material],'modifiers':[x.type for x in o.modifiers]}
  ob.to_mesh_clear()
 return result

def nearest_gap(a,b):
 tree=KDTree(len(b))
 for i,p in enumerate(b):tree.insert(p,i)
 tree.balance();return max(tree.find(p)[2] for p in a)

try:
 for id in ['baseline-current','rowan','mira','arden']:
  blend=SRC/(id+'.blend');glb=OUT/(id+'.glb')
  bpy.ops.wm.open_mainfile(filepath=str(blend));source=meshes()
  assert not any(o.type in ['CAMERA','LIGHT'] for o in bpy.context.scene.objects),'Studio must not leak into source'
  if id!='baseline-current':
   for part in ['face','hair_crown','nose','tunic_body','waist_belt','buckle','neck','satchel','palm_-1','palm_1','boot_-1','boot_1','expressive_brow_-1','expressive_brow_1']:
    assert id+'_'+part in source,id+' editable '+part
   for sign in ['L','R']:
    arm=bpy.data.objects[id+'_arm_'+sign];assert arm.type=='EMPTY'
    assert abs(arm.location.z-.52)<1e-6
    assert len(arm.children)>=7
   assert bpy.data.objects[id+'_face'].parent.name==id+'_head'
   assert len(source)>60
  allcoords=[p for m in source.values() for p in m['coordinates']]
  bounds=[[min(p[i] for p in allcoords) for i in range(3)],[max(p[i] for p in allcoords) for i in range(3)]]
  assert abs(bounds[0][2])<1e-5,(id,'ground pivot',bounds)
  assert 1.1<bounds[1][2]<1.3,(id,'Emberhall height',bounds)
  assert .6<bounds[1][0]-bounds[0][0]<.9,(id,'Emberhall width',bounds)
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  bpy.ops.import_scene.gltf(filepath=str(glb));exported=meshes()
  assert set(source)==set(exported),(id,'named mesh roundtrip',set(source)^set(exported))
  maxerror=0
  for name,s in source.items():
   e=exported[name];assert s['triangles']==e['triangles'],(name,'triangles',s['triangles'],e['triangles'])
   error=max(nearest_gap(s['coordinates'],e['coordinates']),nearest_gap(e['coordinates'],s['coordinates']))
   maxerror=max(maxerror,error);assert error<.000003,(name,'vertex mismatch',error)
  report['assets'].append({'id':id,'passed':True,'sourceSha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'namedEditableMeshes':len(source),'sourceTriangles':sum(x['triangles'] for x in source.values()),'maxBidirectionalVertexDistance':maxerror,'boundsBlender':bounds,'meshesWithEditableModifiers':sum(bool(x['modifiers']) for x in source.values()),'meshNames':list(source)})
 report['passed']=True
finally:
 (EV/'independent-saved-source-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
