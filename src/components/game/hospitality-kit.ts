import {COURT} from '../../game/atlas.ts';
import {BUILD_SIZE} from '../../game/building-size.ts';
export type HospitalityKit = 'kitchen' | 'tavern' | 'market';
/** Presentation only: built starting-settlement placements, not other towns. */
export function hospitalityKitName(kind:string,x:number,z:number):HospitalityKit|null {
 if(kind!=='kitchen'&&kind!=='tavern'&&kind!=='market')return null;
 return Math.hypot(x-COURT.tx,z-COURT.ty)<=18?kind:null;
}
/** Keep original floors/station contents under the exterior; don't duplicate stall posts. */
export function retainHospitalityInteriorVoxel(kind:string,v:{x:number;y:number;z:number;cut?:boolean}):boolean {
 if(v.cut)return false;
 if(kind==='market')return Math.abs(v.x)<=2&&Math.abs(v.z)<=1&&v.y<=2;
 if(kind!=='kitchen'&&kind!=='tavern')return false;
 const b=BUILD_SIZE[kind];return v.x>b.x0&&v.x<b.x1&&v.z>b.z0&&v.z<b.z1;
}
