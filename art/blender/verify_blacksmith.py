"""Independently reopen saved source and validate evaluated ground-space geometry."""
import bpy
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
rows=[]
for p in sorted((ROOT/'art/blender/blacksmith').glob('*.blend')):
    bpy.ops.wm.open_mainfile(filepath=str(p))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(objects)>=5,p.name
    points=[];triangles=0
    for o in objects:
        mesh=o.to_mesh();mesh.calc_loop_triangles()
        points.extend(o.matrix_world@v.co for v in mesh.vertices)
        for tri in mesh.loop_triangles:
            a,b,c=[o.matrix_world@mesh.vertices[i].co for i in tri.vertices]
            assert (b-a).cross(c-a).length_squared>1e-16,(p.name,o.name)
            triangles+=1
        o.to_mesh_clear()
    assert abs(min(v.z for v in points))<1e-5
    assert min(v.x for v in points)>=0 and max(v.x for v in points)<=1
    assert min(v.y for v in points)>=-1 and max(v.y for v in points)<=0
    rows.append({'source':p.name,'namedParts':len(objects),'triangles':triangles})
assert len(rows)==6
(ROOT/'art/blacksmith/evidence/source-validation.json').write_text(json.dumps(rows,indent=2)+'\n')
print('REOPENED SIX SOURCES: finite grounded nondegenerate meshes')
