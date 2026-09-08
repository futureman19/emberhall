"""Reproducible artist-directed Emberhall kit. Run with Blender --background --python.
Coordinates below use game X,Y-up,Z; Blender objects remain independently editable.
No third-party assets. Roofs are sampled bowed surfaces, branches tapered curves.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/lanternwood'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .86
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m

cream = material('warm lime plaster', (.72,.61,.43))
stone = material('weathered limestone', (.43,.43,.33))
wood = material('carved walnut', (.15,.075,.038))
roofm = [material('chestnut shingle '+str(i), (.19+i*.018,.09+i*.012,.045+i*.008)) for i in range(5)]
gold = material('antique gold', (.72,.43,.12))
red = material('oxblood linen', (.40,.045,.035))
glass = material('honey window light', (1,.53,.12), .9)
leaf = [material('woodland foliage '+str(i), c) for i,c in enumerate([(.19,.34,.12),(.28,.43,.17),(.38,.49,.20),(.23,.39,.22)])]

def xyz(p): return (p[0], -p[2], p[1])
def mesh(name, verts, faces, mat):
    data=bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    data.update()
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

def box(name, p, size, mat, bevel=.07):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    ob=bpy.context.object
    ob.name=name
    ob.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    mod=ob.modifiers.new('hand softened arrises','BEVEL'); mod.width=bevel; mod.segments=3
    ob.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
    return ob

def branch(name, pts, radius, mat):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.resolution_u=5
    data.bevel_depth=radius; data.bevel_resolution=2
    sp=data.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for i,(point,rad) in enumerate(pts):
        b=sp.bezier_points[i]; b.co=xyz(point); b.radius=rad; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(ob); data.materials.append(mat)
    return ob

def arch(name,x,y,z,w,h,mat):
    # Filled arched panel facing the entrance (+Z).
    points=[(x-w/2,y,z),(x+w/2,y,z)]
    points += [(x+math.cos(a)*w/2,y+h-w/2+math.sin(a)*w/2,z) for a in [i*math.pi/16 for i in range(17)]]
    return mesh(name,points,[tuple(range(len(points)))],mat)

def roof(name,cx,cz,w,d,y,h):
    def point(u,v, lift=0):
        # Steep at ridge, concave toward generous curled eaves; bowed ridge.
        a=abs(v)
        return (cx+u*w/2,y+h*(1-a)**1.6+.20*a**8+.12*u*u+lift,cz+v*d/2)
    verts=[point(-1+2*i/16,-1+2*j/24) for i in range(17) for j in range(25)]
    faces=[(i*25+j,(i+1)*25+j,(i+1)*25+j+1,i*25+j+1) for i in range(16) for j in range(24)]
    ob=mesh(name+' continuous bowed shell',verts,[tuple(reversed(f)) for f in faces],roofm[0])
    sol=ob.modifiers.new('solid timber roof thickness','SOLIDIFY'); sol.thickness=.10
    # Individually curved shingles, not stacked slabs. Consolidated at export.
    for side in [-1,1]:
        for row in range(9):
            va=side*(row/9); vb=side*min(1,(row+1.12)/9)
            for col in range(14):
                ua=-1+2*col/14; ub=-1+2*(col+.97)/14
                vs=[point(u,v,.035) for u,v in [(ua,va),(ub,va),(ub,(va+vb)/2),(ub,vb),(ua,vb),(ua,(va+vb)/2)]]
                faces=[(0,1,2,5),(5,2,3,4)]
                mesh(name+' scalloped shingle',vs,[tuple(reversed(f)) if side > 0 else f for f in faces],roofm[(col*3+row*7)%5])
    for u in [-1,1]:
        branch(name+' curved verge',[(point(u,-1+2*i/12,.025),1) for i in range(13)],.065,wood)
    for v in [-1,1]:
        branch(name+' rolled eave',[(point(-1+2*i/8,v),1) for i in range(9)],.08,wood)
    branch(name+' bowed ridge cap',[(point(-1+2*i/12,0,.08),1) for i in range(13)],.09,gold)

def banner(x):
    verts=[]
    for j in range(13):
        for i in range(5):
            u=i/4; t=j/12
            verts.append((x+(u-.5)*.60,4.55-t*1.65+.12*abs(u-.5)*2,2.66+.08*math.sin(t*7+u*2)))
    ob=mesh('wind bowed red swallowtail banner',verts,[(j*5+i,j*5+i+1,(j+1)*5+i+1,(j+1)*5+i) for j in range(12) for i in range(4)],red)
    ob.modifiers.new('woven cloth thickness','SOLIDIFY').thickness=.014
    for side in [-.28,.28]:
        branch('gold embroidered border',[((x+side,4.53-t*1.65,2.68+.08*math.sin(t*7+(side/.6+.5)*2)),1) for t in [j/12 for j in range(13)]],.015,gold)
    mesh('gold heraldic lozenge',[(x,3.96,2.78),(x+.13,3.73,2.78),(x,3.50,2.78),(x-.13,3.73,2.78)],[(0,1,2,3)],gold)
    box('banner crossbar',(x,4.62,2.68),(.85,.055,.065),wood,.02)

# Hall dimensions match the original voxel envelope, doorway remains open.
box('hall stone plinth',(.25,.16,.25),(5.6,.3,4.6),stone)
box('rear plaster wall',(.25,1.4,-1.94),(5.3,2.5,.25),cream)
for x in [-2.35,2.85]: box('side plaster wall',(x,1.4,.15),(.24,2.5,4.35),cream)
for x in [-1.28,1.78]: box('entrance plaster wing',(x,1.4,2.28),(1.55,2.5,.24),cream)
box('door lintel',(.25,2.32,2.3),(1.6,.46,.30),wood)
for x in [-.54,1.04]: box('carved door jamb',(x,1.1,2.34),(.12,2.15,.33),wood,.035)
for z in [-2.07,2.43]:
    box('timber wall plate',(.25,2.54,z),(5.45,.17,.16),wood,.04)
    for x in [-2.35,-1.3,1.8,2.85]: box('half timber post',(x,1.4,z),(.13,2.4,.12),wood,.035)
for x in [-1.25,1.75]:
    arch('window walnut surround',x,.95,2.435,.61,1.15,wood)
    arch('warm arched glass',x,1.04,2.446,.43,.96,glass)
    box('window mullion',(x,1.5,2.46),(.035,.85,.035),gold,.005)
    box('window transom',(x,1.44,2.47),(.43,.035,.035),gold,.005)
roof('great hall',.25,-.20,5.0,4.7,2.63,1.72)
for x in [-2,2.5]:
    box('tower limestone foot',(x,.3,2),(1.37,.55,1.38),stone,.14)
    box('tower softened plaster shaft',(x,2.58,2),(1.18,4.55,1.18),cream,.16)
    for y in [.72,2.5,4.62]: box('tower limestone stringcourse',(x,y,2),(1.26,.16,1.26),stone,.065)
    arch('tower lower window frame',x,1.1,2.60,.46,.95,wood)
    arch('tower lower honey pane',x,1.17,2.615,.30,.78,glass)
    # Open stone crown: supported parapet and softened medieval battlements.
    box('tower crown floor',(x,4.86,2),(1.34,.20,1.34),stone,.065)
    for side in [-1,1]:
        box('stone parapet',(x,5.04,2+side*.57),(1.38,.30,.22),cream,.06)
        box('stone parapet',(x+side*.57,5.04,2),(.22,.30,.98),cream,.06)
        for step in [-1,0,1]:
            box('rounded battlement',(x+step*.54,5.33,2+side*.57),(.27,.43,.25),cream,.045)
        box('side battlement',(x+side*.57,5.33,2),(.25,.43,.27),cream,.045)
    banner(x)
# chimney visible above the rear roof slope
box('chimney', (1.2,4.05,-1.25),(.46,1.8,.5),stone)
box('chimney crown',(1.2,4.95,-1.25),(.60,.18,.65),cream)
hall=list(bpy.context.scene.objects)
for o in hall: o['kit']='hall'; o['render_only']=True

# Separate reusable tree source at origin (hidden from hall export).
for variant in range(2):
    before=set(bpy.context.scene.objects)
    s=1 if variant==0 else -.8
    branch('living trunk', [((0,0,0),1.4),((.08,.65,.04),1),((-.12,1.5,.02),.68),((.18*s,2.25,0),.42),((.35*s,3.1,.12),.03)],.18,wood)
    for i in range(7):
        a=i*2.399+variant
        h=1.1+i*.19
        end=(math.cos(a)*(.8+(i%2)*.25),h+.9,math.sin(a)*.8)
        branch('tapered reaching bough', [((0,h,0),.85),((end[0]*.55,h+.28,end[2]*.55),.5),(end,.03)],.10,wood)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=xyz((end[0],end[1]+.23,end[2])))
        ob=bpy.context.object; ob.name='sculpted leafy crown'
        for v in ob.data.vertices:
            f=1+.08*math.sin(v.co.x*13+v.co.y*8+v.co.z*17+i)
            v.co*=f
        ob.scale=(.77,.70,.62); ob.data.materials.append(leaf[(i+variant)%4])
        for poly in ob.data.polygons: poly.use_smooth=True
    for i in range(5):
        a=i*math.tau/5
        branch('root flare',[((math.cos(a)*.45,.03,math.sin(a)*.45),.15),((math.cos(a)*.18,.10,math.sin(a)*.18),.7),((0,.48,0),.7)],.10,wood)
    for o in set(bpy.context.scene.objects)-before: o['kit']='tree-'+str(variant); o['render_only']=True

# Validate the source surface winding before modifiers/export; Blender uses Z up.
roof_surfaces=[o for o in bpy.context.scene.objects if o.type == 'MESH' and ('continuous bowed shell' in o.name or 'scalloped shingle' in o.name)]
assert roof_surfaces and all(p.normal.z > 0 for o in roof_surfaces for p in o.data.polygons), 'Roof top faces must point upward'
assert len([o for o in bpy.context.scene.objects if 'rounded battlement' in o.name]) == 12, 'Twin crenellated crowns required'

# Save source with named parts and live bevel/curve modifiers; exports join by material.
# Source is an explorable kit lineup; export copies return to a local ground pivot.
for o in bpy.context.scene.objects:
    if o.get('kit','').startswith('tree-'): o.location.x += 8 + int(o['kit'][-1])*5
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/lanternwood-kit.blend'), compress=False)
for o in bpy.context.scene.objects:
    if o.get('kit','').startswith('tree-'): o.location.x -= 8 + int(o['kit'][-1])*5
manifest={}
for kit in ['hall','tree-0','tree-1']:
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if o.get('kit')==kit]
    # Export copies: source .blend remains fully editable.
    copies=[]
    for o in objects:
        c=o.copy(); c.data=o.data.copy(); bpy.context.collection.objects.link(c); c.select_set(True); copies.append(c)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    joined=bpy.context.object; joined.name=kit+'-artist-mesh'
    bpy.ops.export_scene.gltf(filepath=str(OUT/(kit+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
    coords=[joined.matrix_world @ v.co for v in joined.data.vertices]
    manifest[kit]={'vertices':len(coords),'polygons':len(joined.data.polygons),'boundsBlender':[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]],'bytes':(OUT/(kit+'.glb')).stat().st_size}
    bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('LANTERNWOOD_KIT '+json.dumps(manifest))
