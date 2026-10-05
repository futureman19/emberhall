"""Editable commons kit; regeneration overwrites this kit only. -- --verify reopens saved source."""
import bpy, math, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
SOURCE=ROOT/'art/blender/commons-kit.blend'
KITS=['dormitory','yard','farm']
if '--verify' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    result={}
    for kit in KITS:
        obs=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
        tops=[o for o in obs if o.get('roof_top')]
        assert len(obs)>15
        assert all(o.name.startswith(kit) for o in obs)
        assert all(p.normal.z>0 for o in tops for p in o.data.polygons)
        assert any(o.type=='CURVE' for o in obs)
        assert any(any(m.type=='BEVEL' for m in o.modifiers) for o in obs)
        assert not any(o.type=='LIGHT' for o in bpy.context.scene.objects)
        result[kit]={'parts':len(obs),'roofSurfaces':len(tops),'upward':True,'liveBevelsAndCurves':True}
    print('SOURCE_REOPEN_VERIFIED '+json.dumps(result))
    sys.exit(0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
KIT='dormitory'
def mat(name, rgb, emission=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .86
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m
stone = mat('warm softened limestone stone', (.43,.43,.33))
cream = mat('honey lime plaster', (.72,.61,.43))
wood = mat('carved walnut timber', (.15,.075,.038))
roofs = [mat('chestnut shingles '+str(i), (.19+i*.025,.09+i*.016,.045+i*.01)) for i in range(3)]
gold = mat('antique gold', (.72,.43,.12))
red = mat('oxblood civic enamel', (.40,.045,.035))
glow = mat('restrained honey ember', (1,.38,.065), .55)
def xyz(p): return (p[0],-p[2],p[1])
def tag(o, name, material):
    o.name = KIT+' '+name; o['kit'] = KIT; o['render_only'] = True
    o.data.materials.append(material); return o

def mesh(name, points, faces, material):
    data = bpy.data.meshes.new(KIT+' '+name)
    data.from_pydata([xyz(p) for p in points], [], faces); data.update()
    o = bpy.data.objects.new(KIT+' '+name, data); bpy.context.collection.objects.link(o)
    return tag(o,name,material)

def box(name, p, size, material=wood, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p)); o = bpy.context.object
    o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    tag(o,name,material)
    m=o.modifiers.new('crafted softened edges','BEVEL'); m.width=bevel; m.segments=1
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); return o

def line(name, points, radius=.035, material=wood):
    data=bpy.data.curves.new(KIT+' '+name,'CURVE'); data.dimensions='3D'; data.resolution_u=2
    data.bevel_depth=radius; data.bevel_resolution=1
    s=data.splines.new('POLY'); s.points.add(len(points)-1)
    for p,v in zip(s.points,points): p.co=(*xyz(v),1)
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); return tag(o,name,material)

def arch(name,x,y,z,w,h,material):
    pts=[(x-w/2,y,z),(x+w/2,y,z)]
    pts += [(x+math.cos(a)*w/2,y+h-w/2+math.sin(a)*w/2,z) for a in [i*math.pi/12 for i in range(13)]]
    return mesh(name,pts,[tuple(range(len(pts)))],material)

def roof(cx,cz,w,d,y,h):
    def point(u,v,lift=0):
        return (cx+u*w/2,y+h*(1-abs(v))**1.6+.13*abs(v)**8+.07*u*u+lift,cz+v*d/2)
    pts=[point(-1+i/4,-1+j/6) for i in range(9) for j in range(13)]
    faces=[(i*13+j,i*13+j+1,(i+1)*13+j+1,(i+1)*13+j) for i in range(8) for j in range(12)]
    o=mesh('continuous bowed roof shell',pts,faces,roofs[0]); o['roof_top']=True
    o.modifiers.new('solid roof boards','SOLIDIFY').thickness=.085
    for side in [-1,1]:
        for row in range(5):
            for col in range(8):
                ua=-1+col/4; ub=ua+.24; va=side*row/5; vb=side*min(1,(row+1.09)/5)
                pts=[point(u,v,.025) for u,v in [(ua,va),(ub,va),(ub,vb),(ua,vb)]]
                o=mesh('individual bowed shingle',pts,[(3,2,1,0) if side>0 else (0,1,2,3)],roofs[(row+col)%3]); o['roof_top']=True
    for u in [-1,1]: line('curved gable verge',[point(u,-1+j/6,.01) for j in range(13)],.055)
    for v in [-1,1]: line('rolled timber eave',[point(-1+i/4,v) for i in range(9)],.065)
    line('bowed ridge cap',[point(-1+i/4,0,.045) for i in range(9)],.065)


# Long communal dwelling: open doorway, low bowed chestnut roof; no tower.
for x in [-2.88,2.88]:
    box('cream long end wall',(x,1.02,0),(.20,2.04,2.9),cream)
    box('end stone footing',(x,.12,0),(.23,.24,2.9),stone)
box('rear communal plaster',(0,1.02,-1.39),(5.8,2.04,.18),cream)
box('rear stone footing',(0,.12,-1.39),(5.8,.24,.22),stone)
for a,b in [(-2.98,-.55),(.55,2.98)]:
    box('front plaster wing',((a+b)/2,1.02,1.39),(b-a,2.04,.18),cream)
    box('front stone footing',((a+b)/2,.12,1.39),(b-a,.24,.22),stone)
for x in [-2.88,-1.85,-.61,.61,1.5,2.88]:
    box('communal timber post',(x,1.02,1.50),(.12,2.04,.12))
    box('gold timber peg',(x,1.88,1.575),(.04,.04,.025),gold,.004)
box('door lintel',(0,1.65,1.50),(1.25,.18,.20))
box('long top plate',(0,2.0,1.47),(5.94,.15,.17))
for x in [-2.35,-1.34,.92,2.1]:
    box('dark window frame',(x,1.12,1.50),(.53,.70,.06),wood)
    box('warm window pane',(x,1.12,1.54),(.40,.55,.025),glow,.01)
    box('window center mullion',(x,1.12,1.565),(.038,.56,.035),wood,.005)
    box('window sill',(x,.78,1.53),(.64,.09,.17),wood)
    line('angled half timber',[(x-.30,1.65,1.51),(x,1.94,1.51)],.028)
roof(0,0,6.35,3.27,2.07,.83)
box('communal red door crest',(0,1.99,1.62),(.61,.27,.045),red)
for x in [-.16,0,.16]: box('gold communal crest bars',(x,1.99,1.65),(.05,.15,.018),gold,.005)

# Open perimeter. Farm borders sit just OUTSIDE soil extents at -2.5.
def fence(farm=False):
    edge=2.60 if farm else 2.48
    high=.68 if farm else .88
    coords=[-edge,-1.35,0,1.35,edge]
    for z in [-edge,edge]:
        for x in coords:
            if z>0 and abs(x)<.8: continue
            box('border stone shoe',(x,.09,z),(.16,.18,.16),stone,.025)
            box('shaped border post',(x,high/2,z),(.105,high,.105),wood,.018)
            box('cream post cap',(x,high+.025,z),(.15,.08,.15),cream,.025)
        intervals=[(-edge,-.65),(1.15,edge)] if z>0 else [(-edge,edge)]
        for a,b in intervals:
            for y in [.26,.52]: box('horizontal boundary rail',((a+b)/2,y,z),(b-a,.085,.07),wood,.018)
    for x in [-edge,edge]:
        for z in [-1.35,0,1.35]:
            box('side post',(x,high/2,z),(.11,high,.11),wood,.018)
        for y in [.26,.52]: box('long side boundary rail',(x,y,0),(.07,.085,edge*2),wood,.018)
    for x in [-.65,1.15]:
        box('open gate jamb',(x,.48,edge),(.14,.96,.14),wood,.025)
        box('gate gold collar',(x,.82,edge),(.17,.065,.17),gold,.009)
        line('gate carved finial',[(x,.94,edge),(x,1.12,edge),(x+.045,1.16,edge)],.025,gold)
    if not farm:
        for x in [-edge,edge]:
            line('pennant upright',[(x,.8,edge),(x,1.56,edge)],.024,wood)
            mesh('red forked pennant',[(x,1.51,edge),(x+.37,1.46,edge),(x+.27,1.33,edge),(x+.37,1.21,edge),(x,1.27,edge)],[(0,1,2,3,4)],red)
    else:
        for x in [-.65,1.15]: box('red gate identity band',(x,.66,edge),(.15,.09,.15),red,.005)
KIT='yard'
fence()
# Interior intentionally empty: original central stone belongs to runtime.
KIT='farm'
fence(True)
# A shallow rear tool shed outside the retained northern bed row.
for x in [-1.42,1.42]:
    box('tool shed side',(x,.65,-2.87),(.14,1.3,.50),wood)
box('tool shed rear',(0,.65,-3.08),(2.95,1.3,.12),wood)
for x in [-1.1,-.72,.72,1.1]:
    box('cream tool shed panel',(x,.64,-2.64),(.30,1.20,.08),cream,.018)
for x in [-1.46,-.47,.47,1.46]: box('shed front upright',(x,.67,-2.59),(.10,1.34,.10),wood)
box('shed footing',(0,.07,-3.04),(2.95,.14,.19),stone)
roof(0,-2.91,3.16,.76,1.36,.30)
box('red tools plaque',(0,1.19,-2.57),(.64,.21,.045),red)
line('gold tool motif',[(-.15,1.13,-2.54),(.13,1.27,-2.54)],.022,gold)
# No crops, soil, harvest props, center clutter, lights or animations.
for o in bpy.context.scene.objects:
    if o.get('roof_top'): assert all(p.normal.z>0 for p in o.data.polygons), o.name
    o.location.x+=8*KITS.index(o['kit'])
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=False)
# Export-only palette baking: saved source retains named original materials.
base = mat('commons shared vertex palette', (1,1,1))
vertex = base.node_tree.nodes.new('ShaderNodeVertexColor')
vertex.layer_name = 'Color'
base.node_tree.links.new(vertex.outputs['Color'], base.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
manifest={}
for kit in KITS:
    originals=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
    bpy.ops.object.select_all(action='DESELECT'); copies=[]
    for o in originals:
        c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c)
        c.location.x-=8*KITS.index(kit); c.select_set(True); copies.append(c)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
    joined=bpy.context.object; joined.name=kit+'-exterior'
    colors=joined.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    original_materials=list(joined.data.materials)
    indices=[]
    for polygon in joined.data.polygons:
        material=original_materials[polygon.material_index]
        emitting=material == glow
        rgba=(1,1,1,1) if emitting else tuple(material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value)
        for loop in polygon.loop_indices: colors.data[loop].color=rgba
        indices.append(1 if emitting else 0)
    joined.data.materials.clear()
    joined.data.materials.append(base)
    if any(indices): joined.data.materials.append(glow)
    for polygon,index in zip(joined.data.polygons,indices): polygon.material_index=index
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(kit+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    manifest[kit]={'parts':[o.name for o in originals],'roofNormals':{'upward':all(p.normal.z>0 for o in originals if o.get('roof_top') for p in o.data.polygons),'sourceSurfaces':sum(bool(o.get('roof_top')) for o in originals)},'noLights':True,'noAnimations':True,'decorativeOnly':True,'retainedContent':('original interior; hide entire exterior inside' if kit=='dormitory' else 'original central stone' if kit=='yard' else 'all original soil beds; replacement owns shed'),'source':{'file':'art/blender/commons-kit.blend','generator':'art/blender/build_commons.py','lineupOffsetX':8*KITS.index(kit),'editable':True,'regenerationWarning':'Regeneration overwrites manual edits.'}}
    bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'commons-manifest.json').write_text(json.dumps(manifest,indent=2))
print('COMMONS_EXPORTED dormitory yard farm')
