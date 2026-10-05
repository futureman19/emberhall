"""Game integration derivative. Original gallery/source remain byte-preserved.
Reopen the original editable assembly, remove display dressing, seat named parts on
actual east bank/river at (955,551). No boat/dock traversal is introduced.
"""
import bpy, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/art/reedwake-waterfront'
OUT.mkdir(parents=True,exist_ok=True)
original=ROOT/'art/blender/river-ferry/emberhall-reedwake.blend'
bpy.ops.wm.open_mainfile(filepath=str(original))
assembly=bpy.data.collections['reedwake-crossing']
parts=list(assembly.objects)
for o in list(bpy.data.objects):
    if o not in parts: bpy.data.objects.remove(o,do_unlink=True)
removed=[]
kept=[]
for o in parts:
    if o.name.startswith(('Presentation','Wet shoreline','Bank moss','Static water')):
        removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
    else: kept.append(o)
parts=kept
# Rotate the assembly onto the east bank. Local geometry is world-height based.
for o in parts:
    name=o.name.split('/')[0]
    if name=='stranded-ferry': dx,dz=-.55,.23
    elif name in ['landing-deck','broken-end','dock-bollards']: dx,dz=2,.20
    elif name in ['south-reeds','north-reeds']: dx,dz=2,.67
    elif name=='ferry-reeds': dx,dz=0,.68
    elif name.startswith('Assembly access'): dx,dz=2,0
    else: dx,dz=2,.34
    for v in o.data.vertices:
        x,y,z=v.co
        if name.startswith('Assembly access'):
            # Access toe embeds in bank at .8; head meets raised dock at 1.335.
            z += .33 - .13*max(0,min(1,(x+3.05)/.52))
        else: z+=dz
        v.co=(-(x+dx),-y,z)
assembly.hide_viewport=False;assembly.hide_render=False
bpy.context.view_layer.update()
# Remove empty gallery collections, retaining editable per-part identities.
for c in list(bpy.data.collections):
    if c!=assembly and not c.objects: bpy.data.collections.remove(c)
assembly.name='reedwake-game-waterfront'
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('reedwake-waterfront.blend')))
entries={}
for o in parts:
    name=o.name.split('/')[0]
    if name.startswith('Assembly access'): name='access-ramp'
    entry=entries.setdefault(name,{'min':[1e9]*3,'max':[-1e9]*3,'objects':[]})
    entry['objects'].append(o.name)
    for v in o.data.vertices:
        p=o.matrix_world@v.co;v3=[p.x,p.z,-p.y]
        entry['min']=[min(a,b) for a,b in zip(entry['min'],v3)]
        entry['max']=[max(a,b) for a,b in zip(entry['max'],v3)]
bpy.ops.object.select_all(action='DESELECT')
copies=[]
for o in parts:
    c=o.copy();c.data=o.data.copy();bpy.context.scene.collection.objects.link(c);c.select_set(True);copies.append(c)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join();bpy.context.object.name='Reedwake game waterfront'
bpy.ops.export_scene.gltf(filepath=str(OUT/'reedwake-crossing.glb'),export_format='GLB',use_selection=True,export_yup=True)
manifest={'source':'art/blender/reedwake-waterfront/reedwake-waterfront.blend','originalSource':str(original.relative_to(ROOT)),'originalSourceSHA256':hashlib.sha256(original.read_bytes()).hexdigest(),'placement':[955,0,551],'waterY':.6,'bankY':.8,'removed':removed,'parts':entries,'scope':'Static wreck and blocked dock; not transport or climbable deck. Original gallery untouched.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('WATERFRONT_DERIVATIVE_OK',len(parts),'parts',len(removed),'display parts removed')
