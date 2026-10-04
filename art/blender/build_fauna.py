"""Emberhall worldwide fauna: deterministic script-authored editable Blender sculpture.
Run with Blender --background --factory-startup --python-exit-code 1 --python this.py.
Game coordinates X,Y-up,+Z-front are mapped to Blender X,-Z,Y before glTF export.
Regeneration overwrites fauna sources/exports, never existing non-fauna art.
"""
import bpy, json, re, math, hashlib
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/lanternwood'
OUT.mkdir(parents=True, exist_ok=True)
text = (ROOT / 'src/components/game/fauna-meshes.tsx').read_text()
COLORS = dict(re.findall(r'  (\w+): "(#[a-f0-9]+)"', text.split('const SIZE')[0]))
SIZES = {k: float(v) for k,v in re.findall(r'  (\w+): ([\d.]+)', text.split('const SIZE')[1].split('const DARK')[0])}
FAMILIES = {
 'lagomorph': ['hare'], 'cervid': ['hart','brambleback_stag','thornhide_doe','whiteback_elk'],
 'canid': ['wolf','ember_fox','ridgeback_warg','brine_hound','barrow_hound'], 'feline':['pine_lynx'],
 'stocky': ['ironwood_boar','moss_badger','oak_bear','frosthorn_ram','highland_aurochs'],
 'amphibian':['mire_croaker','bog_toad'], 'reptile':['reedback_stalker','coal_salamander','deepmaw_basilisk','cinder_drake'],
 'arthropod':['dune_crawler','orebeetle','stonecrawl_spider','tideclaw_crab'], 'chelonian':['saltback_tortoise'],
 'avian':['bonecrow','reed_heron','dusk_owl'], 'chiropteran':['cavern_bat'], 'worm':['fen_leech'],
 'spirit':['wight','greybarrow_wightling','ashen_banshee','willow_wisp','rime_revenant'],
 'humanoid':['brine_troll','stonefang_ogre','orc_marauder','tomb_sentinel','blackbriar_hag','fen_ghoul','drowned_reaver','ossuary_knight','ash_demon','grave_lich'],
 'small_mammal':['redtail_squirrel','river_otter','brine_seal','cave_mole','field_rat'],
}
FAMILY = {k:f for f,ks in FAMILIES.items() for k in ks}
assert set(FAMILY) == set(COLORS) == set(SIZES)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
parts=[]; current=''; base=''; family=''
MAT={}
def linear(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
def material(hex, glow=False):
    key=(hex,glow)
    if key not in MAT:
        m=bpy.data.materials.new(('Glow_' if glow else 'Clay_')+hex[1:]); m.use_nodes=True
        rgb=tuple(linear(int(hex[i:i+2],16)/255) for i in (1,3,5))+(1,)
        m.diffuse_color=rgb; p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=rgb; p.inputs['Roughness'].default_value=.87; p.inputs['Emission Strength'].default_value=0
        if glow: p.inputs['Emission Color'].default_value=rgb; p.inputs['Emission Strength'].default_value=1.4
        MAT[key]=m
    return MAT[key]
def coord(p): return Vector((p[0],-p[2],p[1]))
def finish(o,name,color,glow=False):
    o.name=current+'__'+name; o.data.materials.append(material(color or base,glow)); o['part']=name; o['species']=current
    parts.append(o); return o
def oval(name,p,r,color=None,glow=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=1, location=coord(p))
    o=bpy.context.object; o.scale=(r[0],r[2],r[1]); return finish(o,name,color,glow)
def rod(name,a,b,r=.06,color=None,tip=None):
    a,b=coord(a),coord(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=r, radius2=r if tip is None else tip, depth=d.length, location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,color)
def chain(name,points,r,color=None):
    for i in range(len(points)-1): rod(name+str(i),points[i],points[i+1],r*(1-i/(len(points)+1)),color, r*(1-(i+1)/(len(points)+1)))
def wing(name,side,y,span,color):
    # Solid scalloped membrane, not a flat box: pointed finger and trailing notches.
    ps=[(.18,y,.02),(.52,y+.3,.24),(span,y+.22,-.08),(.8*span,y-.06,-.25),(.66*span,y+.02,-.48),(.46*span,y-.12,-.36),(.2,y-.12,-.48)]
    verts=[tuple(coord((side*x,yy+dy,z))) for dy in (-.025,.025) for x,yy,z in ps]; n=len(ps)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); finish(o,name,color)
    rod(name+'_finger',(side*.2,y,.02),(side*span,y+.22,-.08),.035,base,.018)
def eyes(y,z,w=.18,glow=False):
    for side in (-1,1):
        oval('eye_socket_'+str(side),(side*w,y,z),(.074,.078,.044),'#342d29')
        oval('eye_'+str(side),(side*w,y+.007,z+.037),(.037,.044,.024),'#f4c16f' if glow else '#171f21',glow)
        if not glow: oval('eye_glint_'+str(side),(side*w-.008,y+.022,z+.056),(.012,.014,.01),'#fff2cf')
def ears(y,z,w=.2,long=False,round=False):
    for side in (-1,1):
        if round: oval('round_ear_'+str(side),(side*w,y,z),(.12,.13,.07))
        elif long:
            oval('long_ear_'+str(side),(side*w,y+.23,z-.04),(.075,.34,.09)); oval('ear_lining_'+str(side),(side*w,y+.24,z+.035),(.038,.24,.025),'#d6a18b')
        else: rod('pointed_ear_'+str(side),(side*w,y-.04,z),(side*(w+.07),y+.28,z-.04),.125,None,0)
def feet(y=.3,w=.25,zs=(-.4,.4),r=.095):
    for side in (-1,1):
        for j,z in enumerate(zs):
            rod('leg_'+str(side)+'_'+str(j),(side*w,.075,z),(side*w*.55,y+.12,z-.04),r)
            oval('paw_'+str(side)+'_'+str(j),(side*w,.07,z+.04),(r*1.18,.07,r*1.65),'#42382e')
def tail(points,r=.12,color=None): chain('tail_',points,r,color)
def spikes(y,zs,color='#b8ae87'):
    for i,z in enumerate(zs): rod('spine_'+str(i),(0,y-.2,z),(0,y+.25+(i%2)*.08,z-.09),.1,color,0)
def antlers(y,z,broad=False):
    for side in (-1,1):
        chain('antler_'+str(side),[(side*.16,y,z),(side*.28,y+.25,z-.08),(side*.44,y+.58,z-.13),(side*(.65 if broad else .48),y+.8,z-.2)],.055,'#dbc9a0')
        for j in range(2 if broad else 1): rod('antler_tine_'+str(side)+str(j),(side*(.29+j*.1),y+.3+j*.2,z-.1),(side*(.53+j*.17),y+.45+j*.22,z+.03),.038,'#dbc9a0',.008)
def muzzle(y,z,w=.18,color='#d0b78f'):
    oval('muzzle',(0,y,z),(w,.13,.18),color); oval('nose',(0,y+.055,z+.155),(w*.5,.055,.048),'#302b29')
def author(k):
    global current,parts,base,family
    current=k; parts=[]; base=COLORS[k]; family=FAMILY[k]
    if family in ('canid','feline'):
        oval('tapered_flank',(0,.48,0),(.32,.29,.62)); oval('chest',(0,.56,.36),(.34,.35,.32))
        oval('head',(0,.78,.62),(.25,.25,.29)); muzzle(.69,.88,.17 if family=='canid' else .2)
        ears(.96,.57); eyes(.83,.84,.16,k in ('ridgeback_warg','barrow_hound'))
        feet(.45)
        if family=='canid': tail([(0,.51,-.52),(.08,.58,-.85),(.17,.75,-1.06)],.22 if k=='ember_fox' else .1)
        if k=='ember_fox': oval('cream_tail_tip',(.17,.73,-1.02),(.17,.15,.22),'#eddbc0')
        if family=='feline':
            oval('bobtail',(0,.56,-.66),(.14,.14,.18));
            for side in (-1,1): rod('ear_tuft'+str(side),(side*.25,1.13,.53),(side*.29,1.27,.5),.035,'#282b31',0)
        if k=='ridgeback_warg': spikes(.84,[-.4,-.15,.1])
        if k=='brine_hound': oval('salt_ruff',(0,.6,.41),(.37,.32,.18),'#b2c4c1')
        if k=='barrow_hound':
            for z in (-.22,0,.22): oval('bone_rib'+str(z),(0,.57,z),(.335,.19,.043),'#c8bd9f')
    elif family=='cervid':
        oval('deer_flank',(0,.65,0),(.32,.33,.65)); rod('rising_neck',(0,.66,.42),(0,1.18,.59),.19,None,.13)
        oval('deer_head',(0,1.24,.74),(.2,.18,.31)); muzzle(1.16,.96,.13); ears(1.36,.66,.23); eyes(1.29,.94,.135)
        feet(.65,.23,(-.43,.41),.065); tail([(0,.77,-.55),(0,.86,-.8)],.075,'#dcd0b1')
        if k!='thornhide_doe': antlers(1.36,.65,k=='whiteback_elk')
        if k=='whiteback_elk': oval('white_saddle',(0,.91,-.27),(.29,.12,.3),'#e4dfc9')
        if k in ('brambleback_stag','thornhide_doe'):
            for i,z in enumerate((-.36,-.08,.19)): oval('moss_clump'+str(i),(.08,.92,z),(.23,.13,.19),'#71864e')
    elif family=='lagomorph':
        oval('haunch',(0,.38,-.15),(.39,.38,.44)); oval('chest',(0,.5,.23),(.28,.31,.32)); oval('head',(0,.76,.44),(.27,.24,.26))
        ears(.86,.39,.13,True); muzzle(.68,.65,.14); eyes(.79,.65,.16); feet(.25,.25,(-.27,.29),.1); oval('cotton_tail',(0,.44,-.56),(.16,.17,.17),'#ede0c7')
    elif family=='stocky':
        bear=k=='oak_bear'; au=k=='highland_aurochs'; badger=k=='moss_badger'
        oval('heavy_flank',(0,.57,0),(.46 if au or bear else .39,.4,.65)); oval('heavy_head',(0,.8 if bear or au else .66,.64),(.35,.3,.34))
        muzzle(.68 if bear or au else .56,.94,.24,'#d0b28a' if bear else '#675348'); eyes(.85 if bear or au else .71,.9,.21)
        ears(1.02 if bear or au else .88,.59,.26,round=bear or badger); feet(.5,.31,(-.42,.41),.13)
        if k=='ironwood_boar':
            for side in (-1,1): chain('ivory_tusk'+str(side),[(side*.2,.48,.85),(side*.31,.6,1.02),(side*.33,.81,1.01)],.07,'#e9d6ac')
            spikes(.93,[-.4,-.15,.1],'#413a2f')
        if badger:
            for side in (-1,1): oval('face_stripe'+str(side),(side*.18,.79,.8),(.075,.21,.19),'#dfd7c2')
        if au:
            oval('shaggy_hump',(0,.91,.2),(.45,.31,.43),'#675344')
            for side in (-1,1): chain('swept_horn'+str(side),[(side*.25,1.01,.62),(side*.59,1.05,.6),(side*.77,1.34,.65)],.105,'#ddcdae')
        if k=='frosthorn_ram':
            for side in (-1,1):
                ps=[(side*.34,.87+math.cos(t)*.23,.61+math.sin(t)*.22) for t in (0,.8,1.6,2.4,3.2,4.0,4.8)]
                chain('curled_horn'+str(side),ps,.085,'#e1d9bd')
            for z in (-.35,0,.3): oval('wool'+str(z),(0,.81,z),(.38,.22,.23),'#c9c6b7')
    elif family in ('amphibian','chelonian','reptile'):
        frog=family=='amphibian'; turtle=family=='chelonian'; y=.32 if frog else .42
        oval('low_body',(0,y,0),(.42 if frog or turtle else .33,.26,.5 if frog or turtle else .69))
        oval('broad_head',(0,y+.13,.5 if frog else .72),(.36 if frog else .27,.22,.27)); eyes(y+.27,.7 if frog else .94,.23 if frog else .16, k in ('deepmaw_basilisk','cinder_drake'))
        feet(y,.36,(-.36,.35),.1)
        if frog:
            for side in (-1,1): oval('folded_haunch'+str(side),(side*.37,.23,-.3),(.25,.23,.32))
            oval('throat_sac',(0,.23,.56),(.28,.16,.19),'#baae73')
            if k=='mire_croaker': spikes(.54,[-.3,0],'#8e985d')
        elif turtle:
            oval('domed_shell',(0,.53,-.08),(.57,.4,.58),'#857953')
            for x,z in ((0,0),(-.26,0),(.26,0),(0,-.3),(0,.3)): oval('shell_scute'+str(x)+str(z),(x,.81-abs(x)*.3,z-.08),(.18,.095,.2),'#b5ab83')
        else:
            tail([(0,.39,-.55),(.09,.29,-.97),(.21,.17,-1.36)],.2)
            spikes(.69,[-.45,-.17,.1], '#ee9b48' if k=='coal_salamander' else '#8d9969')
            if k=='reedback_stalker':
                for side in (-1,1): rod('reed_crest'+str(side),(side*.14,.53,.08),(side*.2,.98,-.1),.08,'#768761',0)
            if k=='cinder_drake':
                for side in (-1,1): wing('drake_wing'+str(side),side,.81,1.06,'#563532')
            if k=='deepmaw_basilisk':
                feet(.32,.4,(-.1,),.08)
                for side in (-1,1): rod('fang'+str(side),(side*.14,.51,.91),(side*.14,.23,1.01),.05,'#e5d7b5',0)
    elif family=='arthropod':
        crab=k=='tideclaw_crab'; beetle=k=='orebeetle'; spider=k=='stonecrawl_spider'
        oval('carapace',(0,.35,-.12),(.5 if crab else .33,.25,.34 if crab else .46)); oval('cephalothorax',(0,.35,.35),(.25,.18,.23)); eyes(.46,.54,.13,spider)
        for side in (-1,1):
            for j in range(4 if spider else 3):
                z=-.38+j*.23; chain('jointed_leg'+str(side)+str(j),[(side*.24,.35,z),(side*.62,.46,z-.16),(side*.81,.03,z+.06)],.045)
            if crab:
                chain('claw_arm'+str(side),[(side*.3,.35,.26),(side*.67,.41,.54),(side*.75,.5,.76)],.1)
                oval('pincer_palm'+str(side),(side*.77,.51,.8),(.19,.16,.23),'#ba7050')
                for x in (-.1,.1): rod('pincer_finger'+str(side)+str(x),(side*.77+x,.51,.9),(side*.77+x*.5,.52,1.15),.065,'#ce9873',.015)
            elif beetle: rod('antenna'+str(side),(side*.13,.45,.43),(side*.3,.72,.62),.025,'#c5aa72',.012)
        if beetle:
            for side in (-1,1): oval('metal_elytron'+str(side),(side*.16,.53,-.15),(.18,.17,.38),'#a58c54')
        if k=='dune_crawler': tail([(0,.4,-.41),(0,.72,-.73),(0,1,-.55),(0,.91,-.25)],.11,'#d2a266')
    elif family in ('avian','chiropteran'):
        heron=k=='reed_heron'; owl=k=='dusk_owl'; bat=family=='chiropteran'
        y=.95 if heron else .67; hy=1.8 if heron else 1.06
        oval('breast',(0,y,0),(.3 if heron or bat else .4,.36,.37))
        if heron: chain('curved_neck',[(0,1.08,.16),(0,1.39,-.03),(0,1.72,.18)],.095,'#c1c7b8')
        oval('head',(0,hy,.19),(.34 if owl else .21,.23,.21)); eyes(hy+.025,.39,.2 if owl else .12,owl)
        if bat: ears(1.2,.13,.18)
        else: rod('beak',(0,hy-.06,.36),(0,hy-.12,.88 if heron else .61),.09,'#ccab61',0)
        if bat or k=='bonecrow':
            for side in (-1,1): wing('wing'+str(side),side,.79,1.35 if bat else .85,'#927c99' if bat else '#313740')
        else:
            for side in (-1,1): oval('folded_wing'+str(side),(side*.31,y,-.06),(.12,.39,.35),'#555b54')
        for side in (-1,1):
            if bat:
                rod('bat_hindleg'+str(side),(side*.13,.23,.07),(side*.13,.48,0),.045,'#403744'); rod('bat_claw'+str(side),(side*.13,.23,.02),(side*.13,.20,.19),.03,'#7d727a')
            else:
                rod('bird_leg'+str(side),(side*.13,.045,.04),(side*.13,y-.24,0),.035,'#a99561'); rod('toe'+str(side),(side*.13,.035,-.06),(side*.13,.035,.24),.03,'#a99561')
        if owl:
            for side in (-1,1): oval('facial_disk'+str(side),(side*.17,hy,.376),(.14,.17,.042),'#dacda9')
            eyes(hy+.025,.425,.17,True)
    elif family=='worm':
        for i in range(7): oval('leech_segment'+str(i),(0,.21+math.sin(i*.45)*.06,-.69+i*.23),(.29-i*.015,.21,.2))
        oval('feeding_disc',(0,.3,.8),(.22,.18,.07),'#b18274'); oval('maw',(0,.3,.86),(.135,.11,.034),'#271e27')
    elif family=='small_mammal':
        squirrel=k=='redtail_squirrel'; seal=k=='brine_seal'; mole=k=='cave_mole'; rat=k=='field_rat'
        y=.48 if squirrel else .34; hy=.83 if squirrel else .51
        oval('soft_body',(0,y,-.05),(.33 if not seal else .46,y,.43 if squirrel or mole else .68)); oval('round_head',(0,hy,.45 if squirrel else .65),(.27,.24,.28))
        z=.69 if squirrel else .89; muzzle(hy-.08,z,.17,'#d1b99b'); eyes(hy+.055,z,.16)
        if not seal and not mole: ears(hy+.22,z-.24,.19,round=True)
        if squirrel: tail([(0,.46,-.38),(0,.72,-.69),(.03,1.12,-.79),(.03,1.37,-.6)],.29,'#cf7547')
        elif not seal and not mole: tail([(0,.25,-.56),(.12,.19,-1.02),(.24,.12,-1.35)],.04 if rat else .16,'#b38a78' if rat else base)
        if seal or mole:
            for side in (-1,1): oval('flipper'+str(side),(side*.33,.18,.19),(.3,.14,.22),'#a38b78' if mole else '#667b81')
            if seal:
                for side in (-1,1): oval('tail_fluke'+str(side),(side*.18,.16,-.62),(.26,.13,.29))
        else: feet(.28,.24,(-.35,.35),.07)
    elif family in ('spirit','humanoid'):
        wisp=k=='willow_wisp'; ghost=family=='spirit'; robe=ghost or k in ('blackbriar_hag','grave_lich'); hag=k=='blackbriar_hag'; lich=k=='grave_lich'; demon=k=='ash_demon'; ghoul=k=='fen_ghoul'
        if wisp:
            oval('lantern_heart',(0,1.1,0),(.38,.44,.36),base,True)
            for side in (-1,1): oval('wandering_spark'+str(side),(side*.45,.9,.03),(.095,.13,.1),'#e3f8cc',True)
            chain('willow_flame',[(0,.48,0),(.12,.69,-.06),(0,.97,0)],.13,base); eyes(1.16,.34,.14)
        else:
            hy=1.6 if not ghoul else 1.35
            if robe:
                rod('fluted_robe',(0,.07,0),(0,1.3,0),.48,None,.22)
                for side in (-1,1): rod('sweeping_sleeve'+str(side),(side*.22,1.15,0),(side*.52,.7,.15),.15,None,.08)
            else:
                oval('muscular_torso',(0,.98,0),(.43 if demon or k in ('brine_troll','stonefang_ogre') else .34,.48,.26))
                feet(.69,.21, (0,), .13)
                for side in (-1,1): chain('long_arm'+str(side),[(side*.32,1.22,0),(side*.5,.86,.06),(side*.53,.38 if ghoul else .66,.22)],.13)
            oval('skull' if lich or ghost else 'head',(0,hy,.09 if not ghoul else .22),(.25,.28,.23),'#d4c7ab' if lich or ghost else base)
            facez=.43 if ghoul else .31; eyes(hy+.04,facez,.14,True)
            oval('mouth',(0,hy-.13,facez),(.14,.06,.035),'#292729')
            if hag:
                rod('crooked_hat',(0,1.78,0),(.19,2.24,-.08),.42,'#282d26',0); rod('hooked_nose',(0,1.57,.29),(0,1.48,.52),.09,'#8d936b',.028)
            if lich or k=='rime_revenant':
                for side in (-1,0,1): rod('crown'+str(side),(side*.19,1.79,.04),(side*.23,2.16-abs(side)*.12,.01),.062,'#d4b971' if lich else '#cbeced',0)
            if hag or lich:
                oval('gripping_hand',(.56,.76,.08),(.11,.1,.1),'#d4c7ab' if lich else base)
                chain('gnarled_staff',[(.62,.04,.05),(.57,.93,.04),(.65,1.88,.01),(.51,2.02,.02)],.045,'#42352f')
                oval('staff_heart',(.59,1.91,.05),(.115,.15,.12),'#c5a0e5' if lich else '#cbb16b',True)
            if k in ('tomb_sentinel','ossuary_knight','drowned_reaver','orc_marauder'):
                oval('breastplate',(0,1.06,.19),(.34,.35,.12),'#858778' if k!='drowned_reaver' else '#587f7f')
                for side in (-1,1): oval('pauldron'+str(side),(side*.36,1.27,0),(.23,.16,.25),'#696b60')
                oval('shield',(-.57,.86,.14),(.29,.4,.075),'#6c6e60')
                rod('blade',(.58,.48,.08),(.58,1.51,.08),.085,'#c5c4b2',0); rod('crossguard',(.43,.72,.08),(.73,.72,.08),.042,'#b29c62')
                if k=='ossuary_knight':
                    for y in (.9,1.04,1.18): oval('rib_armor'+str(y),(0,y,.29),(.25,.038,.032),'#e0d4b6')
            if k in ('brine_troll','stonefang_ogre','orc_marauder'):
                for side in (-1,1): rod('lower_tusk'+str(side),(side*.15,hy-.16,facez),(side*.2,hy+.04,facez+.07),.05,'#dbcdae',0)
                if k=='stonefang_ogre': oval('stone_club',(.59,.51,.24),(.19,.34,.16),'#929184')
                if k=='brine_troll': spikes(1.28,[-.22,-.05],'#8a9f85')
            if demon:
                for side in (-1,1):
                    chain('demon_horn'+str(side),[(side*.18,1.78,0),(side*.38,2.04,-.08),(side*.32,2.31,.02)],.11,'#35292d')
                    wing('demon_wing'+str(side),side,1.16,1.01,'#3d2c30')
            if k=='ashen_banshee':
                for side in (-1,1): chain('streaming_hair'+str(side),[(side*.18,1.75,-.06),(side*.37,1.39,-.24),(side*.48,.82,-.3)],.13,'#e6ded4')
            if k=='greybarrow_wightling': oval('burial_cowl',(0,1.61,-.055),(.3,.33,.22),'#6e7376')
    else: raise AssertionError(k)
    # Ground the actual sculpture once; pivot is the existing simulation ground anchor.
    bpy.context.view_layer.update()
    low=min((o.matrix_world @ v.co).z for o in parts for v in o.data.vertices)
    for o in parts: o.location.z-=low
    front=bpy.data.objects.new(k+'__front_axis',None); bpy.context.collection.objects.link(front); front.location=coord((0,1,1)); front['front_axis']='+Z'; front['species']=k
    return list(parts),front

entries=[]; sources=[]
# Individual sources keep all editable semantic parts; also one collection per species.
for k in COLORS:
    authored,front=author(k)
    collection=bpy.data.collections.new('Fauna_'+k); bpy.context.scene.collection.children.link(collection)
    for o in authored+[front]:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    sources.append((k,authored,front))
# Save the actual named unmerged authoring source before export mutation.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/fauna-worldwide.blend'))
opaque=material('#ffffff'); opaque.name='Fauna_VertexClay'
vertex_node=opaque.node_tree.nodes.new('ShaderNodeVertexColor'); vertex_node.layer_name='ClayColor'
opaque.node_tree.links.new(vertex_node.outputs['Color'],opaque.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for k,authored,front in sources:
    bpy.ops.object.select_all(action='DESELECT'); copies=[]
    for original in authored:
        o=original.copy(); o.data=original.data.copy(); bpy.context.scene.collection.objects.link(o); o.select_set(True); copies.append(o)
        bpy.context.view_layer.objects.active=o; bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        m=o.data.materials[0]; p=m.node_tree.nodes.get('Principled BSDF'); glow=p.inputs['Emission Strength'].default_value>0
        if not glow:
            color=m.diffuse_color; attr=o.data.color_attributes.new(name='ClayColor',type='FLOAT_COLOR',domain='CORNER')
            for d in attr.data: d.color=color
            o.data.materials.clear(); o.data.materials.append(opaque)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.join(); merged=bpy.context.object; merged.name='Fauna_'+k
    merged['kind']=k; merged['family']=FAMILY[k]; merged['front_axis']='+Z'; merged['ground_pivot']=True
    marker=front.copy(); bpy.context.scene.collection.objects.link(marker); marker.name='front_axis'; marker.select_set(True)
    path=OUT/('fauna-'+k+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True)
    mesh=merged.data; mesh.calc_loop_triangles(); triangles=len(mesh.loop_triangles)
    assert triangles<2500,(k,triangles)
    points=[merged.matrix_world @ v.co for v in mesh.vertices]
    mins=[min(p[i] for p in points) for i in range(3)]; maxs=[max(p[i] for p in points) for i in range(3)]
    entries.append(dict(kind=k,family=FAMILY[k],file=path.name,size=SIZES[k],triangles=triangles,materials=len(mesh.materials),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bounds={'min':[mins[0],mins[2],-maxs[1]],'max':[maxs[0],maxs[2],-mins[1]]},parts=[o['part'] for o in authored]))
    bpy.data.objects.remove(merged,do_unlink=True); bpy.data.objects.remove(marker,do_unlink=True)
    print('FAUNA_EXPORT',k,triangles,path.stat().st_size,flush=True)
manifest={'schema':1,'generator':'art/blender/build_fauna.py','source':'art/blender/fauna-worldwide.blend','coordinateSystem':'Y-up +Z-front ground-pivot; normalized SIZE units','speciesCount':len(entries),'species':entries}
(OUT/'fauna-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('FAUNA_COMPLETE',len(entries),'species',sum(e['bytes'] for e in entries),'bytes',flush=True)
