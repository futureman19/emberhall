import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).with_name('reedwake-bridge.blend')))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len([o for o in meshes if o.name.startswith('Deck plank')])==20
for prefix in ['Rail post','Abutment','Crossbrace','Longitudinal bearer','Top handrail']:
    assert any(o.name.startswith(prefix) for o in meshes),prefix
vertices=[]
for o in meshes:
    ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); m=ev.to_mesh(); m.calc_loop_triangles()
    if o.name.startswith('Deck plank'):
        assert abs(max((o.matrix_world@v.co).z for v in m.vertices)-.6)<1e-6
    for t in m.loop_triangles:
        a,b,c=[o.matrix_world@m.vertices[i].co for i in t.vertices]
        assert (b-a).cross(c-a).length>1e-10, o.name
    for v in m.vertices:
        p=o.matrix_world@v.co
        vertices.append([p.x,p.z,-p.y])
    ev.to_mesh_clear()
out=ROOT/'art/verification/river-bridge/source-reopen.json'
out.write_text(json.dumps({'passed':True,'meshes':len(meshes),'names':[o.name for o in meshes],'worldYUpVertices':vertices}))
print('SOURCE_REOPEN_OK',len(meshes),'meshes',len(vertices),'evaluated vertices')
