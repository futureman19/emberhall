"""Original editable hospitality exteriors. Regeneration overwrites manual edits.
Run with Blender --background --factory-startup --python-exit-code 1 --python this_file.
Independent saved-source check: append -- --verify. No approved generator imported.
"""
import bpy, math, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
SOURCE=ROOT/'art/blender/hospitality-kit.blend'
KITS=['kitchen','tavern','market']
if '--verify' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    result={}
    for kit in KITS:
        obs=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
        tops=[o for o in obs if o.get('roof_top')]
        assert len(obs)>15 and tops
        assert all(p.normal.z>0 for o in tops for p in o.data.polygons)
        assert any(o.type=='CURVE' for o in obs)
        assert any(o.modifiers for o in obs)
        source_materials={m.name for o in obs for m in o.data.materials}
        assert len(source_materials)>=4
        assert 'hospitality shared vertex palette' not in source_materials
        assert all(not o.data.color_attributes for o in obs if o.type=='MESH')
        result[kit]={'editableParts':len(obs),'upwardNormals':True,'liveBevelsAndCurves':True,'originalMaterials':len(source_materials),'exportOnlyColorBake':True}
    print('SOURCE_REOPEN_VERIFIED '+json.dumps(result))
    sys.exit(0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
KIT='kitchen'
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
    m=o.modifiers.new('crafted softened edges','BEVEL'); m.width=bevel; m.segments=2
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


def label(text,x,y,z,size=.19):
    bpy.ops.object.text_add(location=xyz((x,y,z)))
    o=bpy.context.object; o.rotation_euler=(math.pi/2,0,0)
    o.data.body=text; o.data.align_x='CENTER'; o.data.size=size; o.data.extrude=.001; o.data.resolution_u=1
    tag(o,'readable '+text+' label',gold)

def window(x,y,z,w=.48,h=.68):
    arch('arched dark window surround',x,y,z,w+.12,h+.10,wood)
    arch('honey glass',x,y+.05,z+.014,w,h,glow)
    box('window mullion',(x,y+h/2,z+.03),(.035,h,.03),wood,.005)
    box('window sill',(x,y,z+.045),(w+.20,.10,.20),wood)

def walls(left,right,door,top):
    rear=-1.20; front=1.48
    for x in [left+.10,right-.10]:
        box('plaster side',(x,top/2,.15),(.20,top,2.7),cream)
        box('stone side footing',(x,.15,.15),(.24,.30,2.7),stone)
    box('rear plaster',((left+right)/2,top/2,rear),(right-left,top,.20),cream)
    box('rear stone',((left+right)/2,.15,rear),(right-left,.30,.24),stone)
    for a,b in [(left,door-.55),(door+.55,right)]:
        box('entrance plaster wing',((a+b)/2,top/2,front),(b-a,top,.20),cream)
        box('entrance low stone',((a+b)/2,.15,front),(b-a,.30,.24),stone)
    for x in [left+.08,door-.56,door+.56,right-.08]:
        box('front oak upright',(x,top/2,front+.10),(.13,top,.17))
    box('entry lintel',(door,1.90,front+.10),(1.23,.22,.22))
    box('front top plate',((left+right)/2,top-.03,front+.08),(right-left,.16,.22))
    for x in [left+.09,right-.09]:
        box('rear oak upright',(x,top/2,rear-.10),(.16,top,.17))
        line('side diagonal timber',[(x,.45,-1),(x,top-.15,.9)],.047)

# A compact bakehouse with a low main roof, side oven and porch cloth.
walls(-1.25,1.75,.25,2.02)
window(-.78,.78,1.604,.36,.67)
window(1.24,.78,1.604,.36,.67)
roof(.25,.15,3.37,3.10,2.06,.70)
box('side oven masonry',(-1.40,.49,-.45),(.72,.98,1.05),stone,.12)
arch('oven dark mouth',-1.43,.16,.087,.42,.58,wood)
box('side oven chimney',(-1.38,2.09,-.53),(.43,2.40,.46),stone,.045)
for y in [1.27,2.70,3.24]: box('chimney stone band',(-1.38,y,-.53),(.55,.10,.57),cream)
box('chimney soot top',(-1.38,3.30,-.53),(.30,.015,.32),wood,.008)
for x in [-.47,.97]:
    box('porch post',(x,1.02,2.56),(.085,2.04,.085))
    line('porch brace',[(x,1.72,2.56),(x,2.08,2.23)],.034)
pts=[(x,2.19-.23*t+.05*math.sin(t*math.pi),1.56+1.16*t) for x in [-.58,1.08] for t in [j/6 for j in range(7)]]
o=mesh('small cream bowed porch cloth',pts,[(j,j+1,j+8,j+7) for j in range(6)],cream); o['roof_top']=True
o.modifiers.new('cloth thickness','SOLIDIFY').thickness=.018
line('porch crimson hem',[(-.58,1.96,2.72),(1.08,1.96,2.72)],.036,red)
box('bakehouse trade board',(.25,2.35,1.81),(1.1,.32,.06),red)
label('BAKEHOUSE',.25,2.27,1.848,.14)
# Loaf motif on the oven, away from the retained original entrance.
box('gold loaf motif',(-1.43,.97,.105),(.40,.17,.06),gold,.075)
for x in [-1.54,-1.42,-1.30]: line('loaf scoring',[(x-.02,.92,.141),(x+.035,1.02,.141)],.009,cream)

KIT='tavern'
# Wider two-storey inn, asymmetrical entrance, steep sweeping roof; no towers.
walls(-1.85,2.35,-.25,2.60)
for x in [-1.25,.88,1.80]: window(x,.87,1.604,.44,.80)
box('upper storey cross timber',(.25,2.10,1.61),(4.20,.13,.16))
for x in [-1.2,.8,1.7]:
    box('upper short stud',(x,2.34,1.61),(.10,.48,.15))
    line('upper diagonal brace',[(x-.28,2.19,1.61),(x,2.56,1.61)],.04)
roof(.25,.15,4.62,3.35,2.64,1.18)
box('inn door hood',(-.25,2.08,1.83),(1.32,.13,.53),wood)
# Hanging sign with a modest tankard instead of civic crown art.
line('sign bracket',[(1.91,2.62,1.55),(1.91,2.62,2.07)],.037)
for x in [1.67,2.14]: line('sign gold hanger',[(x,2.61,2.06),(x,2.38,2.06)],.017,gold)
box('red hanging tankard board',(1.905,2.15,2.07),(.75,.61,.07),red,.06)
for y in [1.89,2.42]: box('gold sign edge',(1.905,y,2.112),(.65,.025,.012),gold,.004)
box('tankard gold body',(1.84,2.22,2.117),(.19,.23,.018),gold,.02)
line('tankard handle',[(1.94,2.32,2.13),(2.05,2.31,2.13),(2.06,2.16,2.13),(1.94,2.14,2.13)],.022,gold)
line('tankard foam',[(1.73,2.35,2.13),(1.80,2.38,2.13),(1.88,2.35,2.13),(1.94,2.38,2.13)],.025,cream)
label('TAVERN',1.905,1.97,2.115,.115)

KIT='market'
# Open timber stall. Original four post locations and counter remain in gameplay.
for x in [-1.5,1.5]:
    for z in [-1,1]:
        box('open stall post shoe',(x,.10,z),(.23,.20,.23),stone)
        box('open stall oak pillar',(x,1.15,z),(.14,2.30,.14))
        line('stall knee brace',[(x,1.80,z),(x+(.34 if x<0 else -.34),2.26,z)],.045)
        box('gold joinery peg',(x,2.16,z+.09),(.045,.05,.075),gold,.009)
    box('awning side rail',(x,2.28,0),(.14,.12,2.78))
for z in [-1.30,1.30]: box('awning cross rail',(0,2.28,z),(3.70,.12,.13))
# Curved striped fabric and separate soft scallops; entirely open below.
for i in range(10):
    a=-1.91+i*.382; b=a+.382
    def p(x,t): return (x,2.30+.50*(1-t*t),t*1.48)
    pts=[p(x,-1+j/6) for x in [a,b] for j in range(13)]
    m=red if i%2==0 else cream
    o=mesh('crimson cream awning stripe',pts,[(j,j+1,j+14,j+13) for j in range(12)],m); o['roof_top']=True
    o.modifiers.new('cloth body','SOLIDIFY').thickness=.022
    for z in [-1.48,1.48]:
        pts=[(a,2.30,z),(b,2.30,z)]+[(b-(b-a)*j/8,2.24-.11*math.sin(math.pi*j/8),z) for j in range(9)]
        mesh('scalloped fabric valance',pts,[tuple(range(len(pts)))],m)
for x in [-1.94,1.94]:
    line('curved exposed awning edging',[(x,2.30+.50*(1-t*t),t*1.48) for t in [-1+j/6 for j in range(13)]],.025,wood)
box('small MARKET board',(0,2.30,1.52),(1.04,.28,.06),wood)
label('MARKET',0,2.22,1.554,.17)
# No counter/floor/interior duplicates: original voxel counter is retained.

for o in bpy.context.scene.objects:
    if o.get('roof_top'): assert all(p.normal.z>0 for p in o.data.polygons), o.name
    o.location.x+=6*KITS.index(o['kit'])
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=False)
# Export-only palette baking: saved source retains named original materials.
base = mat('hospitality shared vertex palette', (1,1,1))
vertex = base.node_tree.nodes.new('ShaderNodeVertexColor')
vertex.layer_name = 'Color'
base.node_tree.links.new(vertex.outputs['Color'], base.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
manifest={}
for kit in KITS:
    originals=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
    bpy.ops.object.select_all(action='DESELECT'); copies=[]
    for o in originals:
        c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c)
        c.location.x-=6*KITS.index(kit); c.select_set(True); copies.append(c)
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
    manifest[kit]={'parts':[o.name for o in originals],'source':{'file':'art/blender/hospitality-kit.blend','generator':'art/blender/build_hospitality.py','lineupOffsetX':6*KITS.index(kit),'editable':True,'regenerationWarning':'Regeneration overwrites manual edits.'}}
    bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'hospitality-manifest.json').write_text(json.dumps(manifest,indent=2))
print('HOSPITALITY_EXPORTED kitchen tavern market')
