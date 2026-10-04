"""Saved-source visual structure contract; not physics or navigation acceptance."""
import bpy,json,math,itertools
from pathlib import Path
root=Path(__file__).resolve().parents[3]
def bounds(o):
 v=[o.matrix_world@v.co for v in o.data.vertices]
 return tuple(min(p[k] for p in v) for k in range(3)),tuple(max(p[k] for p in v) for k in range(3))
def group(cid,prefix):return [o for o in bpy.data.collections[cid].objects if o.name.startswith(prefix)]
def ext(obs):
 b=[bounds(o) for o in obs]
 return [min(v[0][k] for v in b) for k in range(3)],[max(v[1][k] for v in b) for k in range(3)]
checks=[]
for cid,prefix,expected in [('intact-dock','Dock deck plank',12),('broken-dock','Broken end deck plank',5),('wrecked-ferry','Surviving ferry deck',6)]:
 obs=group(cid,prefix);assert len(obs)==expected,(cid,len(obs))
 for a,b in itertools.combinations(obs,2):
  al,ah=bounds(a);bl,bh=bounds(b);xy=[min(ah[k],bh[k])-max(al[k],bl[k]) for k in [0,1]]
  assert min(xy)<-1e-5,(a.name,b.name,'coplanar deck overlap')
 checks.append({'check':cid+' deck planks have positive separation','parts':len(obs),'passed':True})
for cid,prefix in [('intact-dock','Dock bearing pile'),('broken-dock','Broken end support')]:
 obs=group(cid,prefix)
 for o in obs:lo,hi=bounds(o);assert abs(lo[2])<1e-6 and hi[2]>.9
 checks.append({'check':cid+' supports start at local ground and reach framing','parts':len(obs),'passed':True})
coll='reedwake-crossing';boat=group(coll,'stranded-ferry/');end=group(coll,'broken-end/');lo,hi=ext(boat);el,eh=ext(end);gap=lo[0]-eh[0];assert gap>.08,gap
checks.append({'check':'wreck and broken landing separated along X','gap':gap,'passed':True})
land=bpy.data.collections[coll].objects.get('Presentation land removable');ll,lh=bounds(land)
for label in ['bank-cargo/','upper-bank-cargo/','old-sign/','hauling-winch/','bank-bollards/']:
 lo,hi=ext(group(coll,label));assert abs(lo[2]-.46)<1e-5 and hi[0]<-2.65,(label,lo,hi)
checks.append({'check':'bank cargo and equipment seated on raised land, not water','passed':True})
rope=group('mooring-posts','Sagging attached mooring rope')[0]
# End ring centers from authored six-vertex cross sections must terminate on the rope winding fronts.
v=rope.data.vertices
for segment,x in [(list(v[:6]),-.48),(list(v[-6:]),.48)]:
 center=sum((p.co for p in segment),start=__import__('mathutils').Vector())/6
 assert (center-__import__('mathutils').Vector((x,-.16,.64))).length<1e-5
checks.append({'check':'mooring rope endpoints seated on winding fronts','passed':True})
# Hull remains unmistakably shaped and intentionally open: tapered ends, exposed ribs, missing near-side strakes.
hull=group('wrecked-ferry','Hull strake');ribs=group('wrecked-ferry','Exposed curved rib');assert len(ribs)==10 and len(hull)==35
checks.append({'check':'tapered hull retains 35 strake sections and 10 exposed rib sides','passed':True})
water=group(coll,'Presentation water removable');assert len(water)==1;wl,wh=ext(water);assert abs(wh[2]-.12)<1e-5 and abs(lh[2]-.46)<1e-5
checks.append({'check':'distinct opaque water and raised land surfaces','waterTop':wh[2],'landTop':lh[2],'passed':True})
result={'passed':True,'checks':checks,'scope':'Saved decorative geometry only; not comprehensive collision, flotation, rope mechanics or gameplay acceptance.'}
(root/'art/verification/river-ferry/structure-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
