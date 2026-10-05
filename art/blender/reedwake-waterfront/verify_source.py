import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).with_name('reedwake-waterfront.blend')))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert meshes and not any(o.name.startswith(('Presentation','Static water','Wet shoreline','Bank moss')) for o in meshes)
vertices=[]
for o in meshes:
    ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();m.calc_loop_triangles()
    for t in m.loop_triangles:
        a,b,c=[o.matrix_world@m.vertices[i].co for i in t.vertices]
        assert (b-a).cross(c-a).length>1e-10,o.name
    for v in m.vertices:
        p=o.matrix_world@v.co;vertices.append([p.x,p.z,-p.y])
    ev.to_mesh_clear()
(ROOT/'art/verification/reedwake-waterfront/source-reopen.json').write_text(json.dumps({'passed':True,'meshes':len(meshes),'names':[o.name for o in meshes],'worldYUpVertices':vertices}))
print('SOURCE_REOPEN_OK',len(meshes),len(vertices))
