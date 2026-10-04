"""Independent saved-source audit. Pass saved .blend before --python this script."""
import bpy,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[3]
m=json.loads((root/'public/art/buildings-landmarks/manifest.json').read_text());report=[]
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
roof_count=0
for a in m['assets']:
 for o in bpy.data.collections[a['id']].objects:
  if o.name.startswith('RoofTile '):
   assert o.data.polygons[1].normal.z>0, o.name+' upward roof top';roof_count+=1
assert roof_count>0
result={'roofTopNormalsChecked':roof_count,'passed':True,'blenderVersion':bpy.app.version_string,'source':bpy.data.filepath,'assetCount':len(report),'assets':report}
(root/'art/verification/buildings-landmarks/source-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
