"""Emberhall storybook player: editable modular meshes for existing animation anchors.
Run in Blender, not system Python. Exports centered named parts; source is assembled.
No gameplay skeleton/schema changes. Front = game -Z; Blender conversion (x,-z,y).
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/lanternwood'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def xyz(p): return (p[0],-p[2],p[1])
def mat(name,h):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=.82
    return m
skin=mat('preview skin - runtime recolorable','c9c3b6');cloth=mat('preview garb - runtime recolorable','a85a42')
hair=mat('preview hair - runtime recolorable','3a2818');leather=mat('preview boots','3a2818');gold=mat('preview gold','c9a36a')
parts={}

def rounded(name,size,bevel,material):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    b=o.modifiers.new('soft hand-shaped edges','BEVEL');b.width=bevel;b.segments=4
    o.modifiers.new('weighted surface normals','WEIGHTED_NORMAL')
    return o

def rings(name,levels,material,segments=16):
    # y, width, depth, front/back center offset. Elliptical tailored profile.
    verts=[]
    for y,w,d,z in levels:
        for i in range(segments):
            a=2*math.pi*i/segments;verts.append(xyz((math.cos(a)*w/2,y,z+math.sin(a)*d/2)))
    faces=[]
    for j in range(len(levels)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments;c=b+segments;d=a+segments
            faces.extend([(a,b,c),(a,c,d)])
    # Side winding checked and recalculated in Blender before export.
    for index,reverse in [(0,True),(len(levels)-1,False)]:
        center=len(verts);verts.append(xyz((0,levels[index][0],levels[index][3])))
        for i in range(segments):
            f=(center,index*segments+i,index*segments+(i+1)%segments)
            faces.append(tuple(reversed(f)) if reverse else f)
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(material)
    for p in m.polygons:p.use_smooth=True
    return o

def ellipsoid(name,center,size,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=xyz(center))
    o=bpy.context.object;o.name=name;o.scale=(size[0]/2,size[2]/2,size[1]/2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o

def register(name,objects,anchor):
    for o in objects:o['part']=name;o['anchor']=list(anchor);o['render_only']=True
    parts[name]=objects

# Original FIGURE dimensions/anchors. Broad cheeks, softly tapered jaw.
o=rounded('head',(.5,.44,.44),.095,skin)
for v in o.data.vertices:
    if v.co.z<0:v.co.x*=.91
register('head',[o],(0,.88,0))
register('torso',[rings('tailored tunic',[(-.18,.45,.30,0),(-.14,.48,.30,0),(-.10,.43,.28,0),(.07,.40,.28,0),(.13,.44,.27,0),(.18,.26,.23,0)],cloth),*[ellipsoid('seated shoulder', (side*.235,.055,0),(.135,.19,.245),cloth) for side in [-1,1]]],(0,.48,0))
register('arm',[rings('soft tapered sleeve',[(-.14,.105,.115,0),(-.115,.13,.13,0),(.085,.13,.13,0),(.14,.09,.10,0)],cloth,12)],(.32,.42,0))
register('hand',[rounded('mitten hand',(.13,.10,.13),.04,skin)],(.32,.26,0))
register('leg',[rings('trouser leg',[(-.11,.14,.16,0),(-.07,.16,.18,0),(.08,.15,.16,0),(.11,.13,.14,0)],leather,12)],(.11,.19,0))
register('foot',[rounded('rounded boot',(.18,.08,.24),.032,leather)],(.11,.04,.02))
# Curved cloak surface is fully closed: a draped elliptical panel, no cloth sim.
register('cloak',[rings('draped cape',[(-.25,.53,.09,.01),(-.20,.56,.12,.01),(.05,.42,.09,0),(.22,.25,.07,-.02),(.25,.22,.06,-.02)],cloth)],(0,.50,.18))
register('helm',[rounded('rounded steel cap',(.54,.22,.50),.09,gold)],(0,1.06,0))
register('hood',[rounded('soft hood',(.54,.26,.52),.105,cloth)],(0,1.06,-.02))
register('belt',[rounded('rounded belt pouch',(.26,.16,.06),.025,gold)],(0,.48,-.16))
# Hair cap: fitted scalp rather than a floating box; swept bangs made from lobes.
cap=rings('fitted hair crown',[(-.075,.51,.46,0),(-.045,.54,.50,0),(.015,.53,.48,.01),(.07,.42,.38,.02),(.105,.18,.15,.01),(.11,.02,.02,0)],hair)
bangs=[]
for i in range(5):
    x=(i-2)*.085
    ob=ellipsoid('swept fringe', (x,-.065+abs(i-2)*.012,-.20),(.12,.105,.10),hair)
    ob.rotation_euler[1]=.25
    bangs.append(ob)
register('hair_cap',[cap,*bangs],(0,1.14,0))
register('hair_shagSide',[rounded('layered side locks',(.12,.30,.46),.058,hair)],(.26,.96,0))
register('hair_shagFront',[rings('soft back locks',[(-.14,.36,.10,0),(-.1,.50,.12,0),(.07,.52,.12,0),(.14,.43,.10,0)],hair)],(0,.96,.26))
register('hair_tail',[rings('tied ponytail',[(-.15,.06,.07,.01),(-.1,.12,.12,0),(.02,.18,.14,0),(.12,.11,.09,0),(.15,.06,.05,0)],hair,12)],(0,.88,.28))
register('hair_long',[rings('flowing shoulder hair',[(-.19,.40,.10,0),(-.15,.50,.14,0),(.08,.52,.14,0),(.19,.45,.12,0)],hair)],(0,.86,.26))
# Duplicate left limbs in editable source only. All optional hair/gear hidden in source view.
for name,objects in parts.items():
    for o in objects:
        anchor=o['anchor'];o.location+=Vector(xyz(anchor))
        if name in ['cloak','helm','hood','hair_shagSide','hair_shagFront','hair_tail','hair_long']:o.hide_set(True)
        if name in ['arm','hand','leg','foot']:
            cp=o.copy();cp.data=o.data.copy();bpy.context.collection.objects.link(cp)
            cp.location.x*=-1;cp['source_preview_only']=True
# Save an assembled, editable figure. Runtime reconstructs using existing body anchors.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/character.blend'))
exports=[];manifest={}
# Avoid Blender's automatic .001 suffix on runtime contract names.
for original in list(bpy.context.scene.objects): original.name='source_'+original.name
for name,objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for original in objects:
        o=original.copy();o.data=original.data.copy();bpy.context.collection.objects.link(o);o.hide_set(False)
        o.location-=Vector(xyz(original['anchor']));o.select_set(True);copies.append(o)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
    ob=bpy.context.object;ob.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.mesh.quads_convert_to_tris();bpy.ops.object.mode_set(mode='OBJECT')
    assert all(len(p.vertices)==3 for p in ob.data.polygons)
    coords=[v.co for v in ob.data.vertices]
    manifest[name]={'vertices':len(coords),'triangles':len(ob.data.polygons),'boundsBlender':[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]]}
    exports.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'character.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
(OUT/'character-manifest.json').write_text(json.dumps(manifest,indent=2))
print('WROTE '+str(OUT/'character.glb'))
print('CHARACTER_PARTS '+json.dumps(manifest))
