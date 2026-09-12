import {BUILD_SIZE} from '../../game/building-size.ts';
export type HospitalityKit = 'kitchen' | 'tavern' | 'market';
/** Presentation only: existing built kinds worldwide, never world generation. */
export function hospitalityKitName(kind:string,x:number,z:number):HospitalityKit|null {
 if(kind!=='kitchen'&&kind!=='tavern'&&kind!=='market')return null;
 return Number.isFinite(x)&&Number.isFinite(z)?kind:null;
}
/** Keep original floors/station contents under the exterior; don't duplicate stall posts. */
export function retainHospitalityInteriorVoxel(kind:string,v:{x:number;y:number;z:number;cut?:boolean}):boolean {
 if(v.cut)return false;
 if(kind==='market')return Math.abs(v.x)<=2&&Math.abs(v.z)<=1&&v.y<=2;
 if(kind!=='kitchen'&&kind!=='tavern')return false;
 const b=BUILD_SIZE[kind];return v.x>b.x0&&v.x<b.x1&&v.z>b.z0&&v.z<b.z1;
}
