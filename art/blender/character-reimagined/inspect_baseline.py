import bpy,json
from pathlib import Path
p=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(p/'art/blender/character.blend'))
a=[]
for o in bpy.context.scene.objects:
 a.append({'name':o.name,'type':o.type,'location':list(o.location),'dimensions':list(o.dimensions),'hidden':o.hide_get(),'part':o.get('part'),'anchor':list(o.get('anchor',[])),'previewOnly':o.get('source_preview_only',False)})
(p/'art/verification/character-reimagined/baseline-source-inspection.json').write_text(json.dumps(a,indent=2))
print(json.dumps(a))
