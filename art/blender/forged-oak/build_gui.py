"""Script-authored editable relief models; regeneration overwrites the saved .blend."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).parent
OUT=ROOT.parents[2]/'public/art/gui/forged-oak'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(19)

def material(name, dark, light, metallic, roughness, scale=18, strength=.12):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=m.node_tree.nodes; l=m.node_tree.links; bs=n.get('Principled BSDF')
    bs.inputs['Metallic'].default_value=metallic;bs.inputs['Roughness'].default_value=roughness
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=4
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*dark,1);ramp.color_ramp.elements[1].color=(*light,1)
    l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.045
    l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],bs.inputs['Normal'])
    return m
iron=material('01 | hammered charcoal iron',(.015,.02,.022),(.10,.13,.14),.72,.43,32)
gold=material('02 | worn antique brass',(.14,.075,.022),(.53,.32,.10),.78,.31,23,.10)
edge=material('03 | bright worn edges',(.28,.16,.05),(.74,.52,.22),.8,.24,35,.07)
oak=material('04 | smoked carved oak',(.025,.012,.007),(.12,.063,.022),.04,.72,9,.22)
dark=material('05 | recessed black leather',(.009,.011,.012),(.026,.033,.034),.02,.85,75,.10)
stone=material('06 | moss-dark slate',(.035,.045,.036),(.13,.16,.115),.16,.76,24,.16)
gem=material('07 | ember amber enamel',(.20,.026,.003),(.9,.24,.016),.52,.17,4,.04)
collections={}
active=None

def collect(o,name,mat):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o)
    o.data.materials.append(mat)
    return o

def cube(name,x,y,z,w,h,d,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=collect(bpy.context.object,name,mat);o.dimensions=(w,h,d)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Hand-softened bevel','BEVEL');b.width=min(bevel,min(w,h,d)*.4);b.segments=3
    o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def curve(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);active.objects.link(o);c.materials.append(mat)
    return o

def stud(x,y,z=.17,r=.025):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=r,location=(x,y,z));o=collect(bpy.context.object,'Forged brass pin',edge);o.scale.z=.50

def leaf(x,y,angle,size=.12):
    # Folded lance-shaped leaf with a raised central ridge and tapered point.
    coords=[(0,0,0),(-size*.28,size*.50,0),(0,size*.44,size*.14),(size*.28,size*.50,0),(0,size,0)]
    ca,sa=math.cos(angle),math.sin(angle)
    verts=[(x+a*ca-b*sa,y+a*sa+b*ca,.19+c) for a,b,c in coords]
    mesh=bpy.data.meshes.new('Leaf relief');mesh.from_pydata(verts,[],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)])
    o=bpy.data.objects.new('Chased oak leaf',mesh);active.objects.link(o);mesh.materials.append(gold)
    sol=o.modifiers.new('Leaf thickness','SOLIDIFY');sol.thickness=.006
    be=o.modifiers.new('Soft leaf rim','BEVEL');be.width=.003;be.segments=2

def frame(x,y,w,h,border,z=.02):
    for xx in [-1,1]:cube('Forged vertical rim',x+xx*(w-border)/2,y,z,border,h,.10,iron)
    for yy in [-1,1]:cube('Forged horizontal rim',x,y+yy*(h-border)/2,z,w,border,.10,iron)
    inset=border*.45
    for xx in [-1,1]:cube('Brass inner lip',x+xx*(w/2-border+inset/2),y,z+.07,inset,h-border,.035,gold,.008)
    for yy in [-1,1]:cube('Brass inner lip',x,y+yy*(h/2-border+inset/2),z+.07,w-border,inset,.035,gold,.008)

def crest(x,y,size=.15):
    o=cube('Diamond brass mount',x,y,.15,size,size,.055,gold,.01);o.rotation_euler.z=math.pi/4
    o=cube('Amber inset',x,y,.195,size*.5,size*.5,.055,gem,.008);o.rotation_euler.z=math.pi/4

active=bpy.data.collections.new('A | repeatable oak-and-iron band');bpy.context.scene.collection.children.link(active);collections['band']=active
cube('Dark iron backplate',0,0,0,10.24,1.2,.14,iron)
cube('Oak center inlay',0,0,.085,10.24,.80,.07,oak)
# A subtly striated dark face leaves the central action/text area quiet.
for y in [-.52,.52]:
    cube('Sculpted stone edge',0,y,.10,10.24,.14,.14,stone)
    cube('Continuous brass welt',0,y+(-.05 if y>0 else .05),.19,10.24,.025,.035,edge,.006)
for i in range(17):
    x=-5.12+i*.64
    for y in [-.50,.50]:stud(x,y,.22,.027)
for side in [-1,1]:
    y=side*.38
    for i in range(8):
        x=-4.9+i*1.40
        curve('Creeping oak branch',[(x,y,.15),(x+.24,y-side*.07,.17),(x+.48,y,.17),(x+.62,y-side*.03,.17)],.012,gold)
        leaf(x+.20,y-side*.045,math.pi if side>0 else 0,.105)
        leaf(x+.43,y,math.pi*.70 if side>0 else -.6,.10)
# Wood grain is sculpted, shallow and deliberately away from the primary icon line.
for i in range(35):
    x=random.uniform(-5.1,4.9);y=random.uniform(-.28,.28)
    curve('Oak grain cut',[(x,y,.126),(x+.13,y+.01,.128),(x+.32,y-.006,.126)],.004,dark)

active=bpy.data.collections.new('B | open minimap reliquary');bpy.context.scene.collection.children.link(active);collections['corner']=active
frame(0,0,2.24,2.24,.16)
for side in [-1,1]:
    for x in [-.94,.94]:
        y=side*.94;crest(x,y,.14)
        for angle in [0,.65,-.65]:leaf(x,y-side*.06,angle if side<0 else math.pi+angle,.17)
    curve('Braided side vine',[(side*1.04,-.72,.17),(side*.99,-.30,.19),(side*1.04,0,.17),(side*.99,.35,.19),(side*1.04,.72,.17)],.017,gold)
    for y in [-.62,-.30,.1,.45]:
        leaf(side*1.035,y,side*.65,.14)
    for x in [-.6,-.3,0,.3,.6]:stud(x,side*1.045,.16,.018)
# Stylized oak leaf crown; does not enter the map aperture.
crest(0,1.04,.17)

active=bpy.data.collections.new('C | recessed action slot');bpy.context.scene.collection.children.link(active);collections['button']=active
cube('Inset leather face',0,0,-.015,1.0,1.0,.09,dark,.06)
frame(0,0,1.1,1.1,.09,.015)
for x in [-.46,.46]:
    for y in [-.46,.46]:stud(x,y,.115,.022)

scene=bpy.context.scene
bpy.ops.object.camera_add(location=(0,0,15));cam=bpy.context.object;cam.name='Orthographic relief export';cam.data.type='ORTHO';cam.rotation_euler=(0,0,0);scene.camera=cam
# Blender cameras point down their local -Z, so zero rotation faces the XY relief.
for name,loc,power,color,sz in [('Warm upper-left',(-4,5,8),1000,(1,.83,.62),5),('Cool soft fill',(4,-1,7),650,(.63,.77,1),6)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=sz;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.resolution_percentage=100
scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
manifest={'scope':'isolated-gui-prototype','title':'Emberhall — Forged Oak','authoring':'Script-authored Blender relief geometry and procedural materials; not hand sculpted.','assets':[]}
for name,w,h,ortho in [('band',1024,120,10.24),('corner',336,336,2.30),('button',132,132,1.14)]:
    for key,col in collections.items():col.hide_render=key!=name;col.hide_viewport=key!=name
    cam.data.ortho_scale=ortho;scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.filepath=str(OUT/f'{name}.png')
    bpy.ops.render.render(write_still=True)
    manifest['assets'].append({'file':f'renders/{name}.png','width':w,'height':h,'collection':collections[name].name})
for key,col in collections.items():col.hide_render=key!='corner';col.hide_viewport=key!='corner'
cam.data.ortho_scale=2.6;scene.render.resolution_x=600;scene.render.resolution_y=600
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'emberhall-forged-oak.blend'))
(ROOT/'generation-manifest.json').write_text(json.dumps(manifest,indent=2))
print('FORGED_OAK_RENDER_COMPLETE')
