"""Independent saved-source audit. Pass saved .blend before --python this script."""
import bpy,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[3]
m=json.loads((root/'public/art/trails-kit/manifest.json').read_text());report=[]
# Optional presentation repair does not change mesh data or exports; reopen afterward.
import sys
from mathutils import Vector
if '--present' in sys.argv:
 for i,a in enumerate(m['assets']):
  c=bpy.data.collections[a['id']];c.hide_render=i!=0
  for o in c.objects:o.hide_set(i!=0)
 cam=bpy.context.scene.camera;cam.location=(10,-14,10);cam.rotation_euler=(Vector((0,0,2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=11
 bpy.context.preferences.filepaths.save_version=0
 source=bpy.data.filepath;bpy.ops.wm.save_as_mainfile(filepath=source);bpy.ops.wm.open_mainfile(filepath=source)
for a in m['assets']:
 c=bpy.data.collections.get(a['sourceCollection']);assert c,a['id']
 obs=[o for o in c.objects if o.type=='MESH'];assert len(obs)==a['editableParts'];vs=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
 assert all(math.isfinite(v) for p in vs for v in p)
 assert abs(min(v.z for v in vs))<1e-5
 assert all(o.data.color_attributes.get('Palette') for o in obs)
 report.append({'id':a['id'],'editableParts':len(obs),'groundZ':min(v.z for v in vs),'passed':True})
# Source geometry contract for the decorative boardwalk joint (not navigation).
c=bpy.data.collections['boardwalk-corner'];planks=[o for o in c.objects if 'plank' in o.name]
def bounds(o):return ([min(v.co[i] for v in o.data.vertices) for i in range(3)],[max(v.co[i] for v in o.data.vertices) for i in range(3)])
boxes=[bounds(o) for o in planks]
assert len(planks)==22
assert all(abs(hi[2]-.68)<1e-5 for lo,hi in boxes),'level deck tops'
for i,(lo,hi) in enumerate(boxes):
 for lo2,hi2 in boxes[i+1:]:
  assert not all(min(hi[k],hi2[k])-max(lo[k],lo2[k])>1e-5 for k in [0,1]),'overlapping deck planks'
main=[bounds(o) for o in planks if o.name.startswith('Cross plank')];ret=[bounds(o) for o in planks if o.name.startswith('Return plank')]
seam=min(lo[1] for lo,hi in ret)-max(hi[1] for lo,hi in main)
assert 0<seam<.025,('joint seam',seam)
result={'passed':True,'boardwalkCorner':{'coplanarDeck':True,'overlappingDeckPlanks':False,'jointSeam':seam,'planks':len(planks)},'blenderVersion':bpy.app.version_string,'source':bpy.data.filepath,'assetCount':len(report),'assets':report}
(root/'art/verification/trails-kit/source-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
