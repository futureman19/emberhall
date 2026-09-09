"""Script-authored editable furniture. Regeneration overwrites manual source edits."""
import bpy, math, sys, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
SOURCE=ROOT/'art/blender/interiors-kit.blend'
KINDS=['hall','dormitory','kitchen','yard','market','forge','tavern','bank']
if '--verify' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    report={}
    for k in KINDS:
        col=bpy.data.collections['interior-'+k]
        assert len(col.objects)>=5
        assert all(o.type=='MESH' for o in col.objects)
        assert any(len(o.modifiers)>0 for o in col.objects)
        report[k]={'editableParts':len(col.objects),'modifiers':sum(len(o.modifiers) for o in col.objects)}
    assert not any(o.type in ['LIGHT','CAMERA'] for o in bpy.data.objects)
    dest=ROOT/'art/verification/interiors-author';dest.mkdir(parents=True,exist_ok=True)
    (dest/'source-reopen.json').write_text(json.dumps(report,indent=2))
    print('INDEPENDENT SOURCE REOPEN VERIFIED',json.dumps(report));sys.exit(0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
palette={}
for n,c in {'oak':(.29,.14,.055,1),'endgrain':(.42,.23,.09,1),'iron':(.085,.095,.105,1),'brass':(.62,.38,.10,1),'stone':(.31,.29,.25,1),'coal':(.045,.035,.028,1),'ember':(.68,.16,.035,1)}.items():
    m=bpy.data.materials.new(n);m.diffuse_color=c;palette[n]=m
current=None

def box(name,x,y,z,w,h,d,mat='oak',bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for col in list(o.users_collection):col.objects.unlink(o)
    current.objects.link(o);o.data.materials.append(palette[mat])
    if bevel:
        b=o.modifiers.new('Hand-planed edges','BEVEL');b.width=bevel;b.segments=1
    return o

def taper(name,x,y,z,w,h,d,mat='oak',top=.7):
    o=box(name,x,y,z,w,h,d,mat)
    for v in o.data.vertices:
        if v.co.z>0:v.co.x*=top;v.co.y*=top
    return o

def table(kind,w=1.44,d=.94):
    x=.25;z=.25 if kind=='market counter' else 0
    for i in range(4):box(kind+' top plank '+str(i),x,.94,z-d/2+(i+.5)*d/4,w,.12,d/4-.012,'endgrain')
    for sx in [-1,1]:
        taper(kind+' splayed trestle',x+sx*w*.33,.71,z,.16,.42,d*.78,top=.68)
        box(kind+' foot',x+sx*w*.33,.54,z,.27,.08,d*.87)
    box(kind+' pegged stretcher',x,.68,z,w*.7,.09,.1)
    for sx in [-1,1]:box(kind+' brass peg',x+sx*w*.34,.71,z+d*.40,.045,.045,.025,'brass',.003)
    # Existing gold voxel becomes a low octagonal tally dish; not new usable inventory.
    dish(kind+' tally dish',.25,1.015,-.25,.16)

def dish(name,x,y,z,r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=.035,location=(x,-z,y));o=bpy.context.object;o.name=name
    for col in list(o.users_collection):col.objects.unlink(o)
    current.objects.link(o);o.data.materials.append(palette['brass'])

def hearth(name,x,z):
    # Original two adjacent half-metre cells; no chimney/wall replacement.
    box(name+' ash pan',x,.535,z,.46,.07,.94,'coal')
    for sx in [-1,1]:box(name+' stone cheek',x+sx*.185,.66,z,.09,.25,.92,'stone')
    for zz in [-.41,.41]:box(name+' stone end',x,.62,z+zz,.29,.17,.10,'stone')
    for i in [-1,0,1]:
        o=box(name+' charred billet',x+i*.095,.615,z,.075,.10,.60,'coal');o.rotation_euler.z=i*.13
        box(name+' banked coal',x+i*.08,.68,z-.1+i*.1,.065,.07,.12,'ember')

def anvil(name,x,z,height=.48):
    taper(name+' octagonal-inspired stump',x,.5+height*.32,z,.39,height*.64,.40,'endgrain',.82)
    box(name+' iron base',x,.5+height*.64,z,.37,.05,.32,'iron')
    taper(name+' waist',x,.5+height*.79,z,.22,height*.28,.19,'iron',1.3)
    box(name+' face',x,.5+height*.94,z,.39,height*.12,.24,'iron')
    # Wedge horn stays inside authoritative cell.
    o=box(name+' tapered horn',x+.20,.5+height*.92,z,.085,.055,.15,'iron',0)
    for v in o.data.vertices:
        if v.co.x>0:v.co.y*=.08;v.co.z*=.15

for k in KINDS:
    current=bpy.data.collections.new('interior-'+k);bpy.context.scene.collection.children.link(current)
    if k in ['hall','dormitory','kitchen','tavern','bank']:table(k)
    if k=='market':
        table('market counter',2.44,1.44)
        for i in range(7):box('counter front panel '+str(i),-.81+i*.35,.72,.65,.33,.34,.07,'oak')
    if k=='bank':
        dish('bank second tally dish',.25,1.015,.25,.16)
        for x in [-.35,.85]:box('bank iron corner strap',x,.83,.455,.04,.22,.025,'iron')
    if k=='kitchen':hearth('kitchen hearth',-.75,-.5)
    if k=='tavern':hearth('tavern hearth',1.75,-.5)
    if k=='forge':hearth('forge hearth',.25,.5);anvil('forge anvil',-.25,.25)
    if k=='yard':anvil('yard crafting station',.25,.25,.97)
# Editable source remains named parts and palette materials, no export joins saved.
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
exportmat=bpy.data.materials.new('Interior vertex palette');exportmat.use_nodes=True
bs=exportmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.86
vc=exportmat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';exportmat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
OUT.mkdir(parents=True,exist_ok=True)
for k in KINDS:
    bpy.ops.object.select_all(action='DESELECT');copies=[]
    for src in list(bpy.data.collections['interior-'+k].objects):
        o=src.copy();o.data=src.data.copy();bpy.context.scene.collection.objects.link(o);copies.append(o)
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        colors=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        c=src.data.materials[0].diffuse_color
        for datum in colors.data:datum.color=c
        o.data.materials.clear();o.data.materials.append(exportmat);o.select_set(False)
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name='interior-'+k+'-visual'
    bpy.ops.export_scene.gltf(filepath=str(OUT/('interior-'+k+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    bpy.data.objects.remove(joined,do_unlink=True)
print('EXPORTED',KINDS)
