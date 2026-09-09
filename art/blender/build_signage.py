"""Script-authored editable signage. Regeneration replaces this kit. -- --verify independently reopens source."""
import bpy, math, sys, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/blender/signage-kit.blend'
OUT=ROOT/'public/art/lanternwood'
KITS=['notice','board']
if '--verify' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    result={}
    for kit in KITS:
        obs=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
        assert len(obs)>10
        assert any(o.type=='CURVE' for o in obs)
        assert any(any(m.type=='BEVEL' for m in o.modifiers) for o in obs)
        tops=[o for o in obs if o.get('roof_top')]
        assert tops and all(p.normal.z>0 for o in tops for p in o.data.polygons)
        assert all(o.name.startswith(kit) for o in obs)
        result[kit]={'parts':len(obs),'upwardRoof':True,'editableCurvesAndBevels':True}
    assert not any(o.type in ['LIGHT','CAMERA'] or o.animation_data for o in bpy.context.scene.objects)
    print('SOURCE_REOPEN_VERIFIED '+json.dumps(result)); sys.exit(0)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def mat(name,rgb):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1); p.inputs['Roughness'].default_value=.86
    return m
wood=mat('walnut carved timber',(.17,.078,.033)); roofmat=mat('chestnut rain roof',(.24,.105,.045))
paper=mat('warm parchment',(.78,.65,.40)); red=mat('oxblood civic crest',(.43,.035,.025)); gold=mat('antique gold',(.78,.44,.09)); ink=mat('faded ink',(.28,.19,.10))
def xyz(p): return (p[0],-p[2],p[1])
def tag(o,name,m):
    o.name=KIT+' '+name; o['kit']=KIT; o.data.materials.append(m); return o
def mesh(name,pts,faces,m):
    d=bpy.data.meshes.new(name); d.from_pydata([xyz(p) for p in pts],[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); return tag(o,name,m)
def box(name,p,s,m=wood,b=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p)); o=bpy.context.object; o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    tag(o,name,m); mod=o.modifiers.new('hand softened edges','BEVEL'); mod.width=b; mod.segments=1
    return o
def line(name,pts,r=.018,m=wood):
    d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.bevel_depth=r; d.bevel_resolution=0; d.resolution_u=1
    s=d.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,v in zip(s.points,pts): p.co=(*xyz(v),1)
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); return tag(o,name,m)
def crest(x,y,z):
    pts=[(x-.11,y+.12,z),(x+.11,y+.12,z),(x+.095,y-.04,z),(x,y-.15,z),(x-.095,y-.04,z)]
    mesh('pointed civic shield',pts,[(4,3,2,1,0)],red)
    line('gold shield rim',pts+[pts[0]],.012,gold)
    line('gold crest chevron',[(x-.06,y-.02,z+.008),(x,y+.06,z+.008),(x+.06,y-.02,z+.008)],.013,gold)
for KIT in KITS:
    wide=KIT=='board'; w=3.18 if wide else 1.24; cx=.25; ytop=2.50
    for x in ([cx-1.25,cx+1.25] if wide else [cx]):
        box('taper softened ground post',(x,1.13,.46),(.19,2.26,.20))
        box('post foot collar',(x,.10,.46),(.25,.20,.26),roofmat)
        box('gold post peg',(x,1.0,.58),(.07,.07,.035),gold,.009)
    box('recessed backing',(cx,1.75,.75),(w-.12,1.22,.11),roofmat)
    for x in [cx-w/2+.06,cx+w/2-.06]: box('upright carved frame',(x,1.75,.85),(.12,1.35,.15))
    for y in [1.10,2.40]: box('mortised horizontal frame',(cx,y,.85),(w,.12,.17))
    pages=[(cx-.86,1.77,.58,.83),(cx,1.70,.61,.96),(cx+.87,1.80,.53,.77)] if wide else [(cx,1.74,.85,1.00)]
    for n,(x,y,pw,ph) in enumerate(pages):
        pts=[(x-pw/2,y-ph/2,.947),(x+pw/2-.045,y-ph/2+.035,.952),(x+pw/2,y+ph/2,.947),(x-pw/2+.018,y+ph/2-.015,.947)]
        o=mesh('uneven parchment '+str(n),pts,[(3,2,1,0)],paper); o.modifiers.new('paper thickness','SOLIDIFY').thickness=.008
        for j in range(3): box('faded notice inscription',(x-.025,y-.07-j*.105,.96),(pw*(.65-.09*j),.019,.008),ink,.001)
        box('gold parchment pin',(x,y+ph/2-.05,.97),(.035,.035,.025),gold,.006)
    crest(cx,2.17,.985)
    # Curved gable shell, with upward source normals and raised verge curves.
    rw=3.32 if wide else 1.32
    def point(u,v): return (cx+u*rw/2,ytop+.30*(1-abs(v))**1.5+.045*u*u,.75+v*.62)
    pts=[point(-1+i/3,-1+j/4) for i in range(7) for j in range(9)]
    faces=[(i*9+j,i*9+j+1,(i+1)*9+j+1,(i+1)*9+j) for i in range(6) for j in range(8)]
    o=mesh('curved brown rain cap',pts,faces,roofmat); o['roof_top']=True; o.modifiers.new('rain cap thickness','SOLIDIFY').thickness=.045
    for u in [-1,1]: line('curved gable edging',[point(u,-1+j/4) for j in range(9)],.026)
    for v in [-1,0,1]: line('rain cap ridge and eaves',[point(-1+i/3,v) for i in range(7)],.027)
    for u in [-.66,-.33,0,.33,.66]: line('roof stave seam',[point(u,-1+j/4) for j in range(9)],.007,wood)
    for o in [o for o in bpy.context.scene.objects if o.get('kit')==KIT]:
        if wide:
            o.location.z*=.68; o.scale.z*=.68
        o.location.x+=5*KITS.index(KIT)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
base=mat('signage shared vertex palette',(1,1,1)); v=base.node_tree.nodes.new('ShaderNodeVertexColor'); v.layer_name='Color'; base.node_tree.links.new(v.outputs['Color'],base.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for kit in KITS:
    originals=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
    bpy.ops.object.select_all(action='DESELECT'); copies=[]
    for o in originals:
        c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c); c.location.x-=5*KITS.index(kit); c.select_set(True); copies.append(c)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.convert(target='MESH'); bpy.ops.object.join(); joined=bpy.context.object
    joined.name=kit+'-signage'; colors=joined.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER'); materials=list(joined.data.materials)
    for p in joined.data.polygons:
        color=materials[p.material_index].diffuse_color
        for i in p.loop_indices: colors.data[i].color=color
        p.material_index=0
    joined.data.materials.clear(); joined.data.materials.append(base)
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(kit+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=False,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    bpy.ops.object.delete(use_global=False)
print('SIGNAGE_EXPORT_COMPLETE')
