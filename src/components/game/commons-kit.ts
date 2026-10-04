import {BUILD_SIZE} from '../../game/building-size.ts';
export type CommonsKit = 'dormitory'|'yard'|'farm';
/** Existing built structures worldwide; no world generation. */
export function commonsKitName(kind:string,x:number,z:number):CommonsKit|null {
 if(kind!=='dormitory'&&kind!=='yard'&&kind!=='farm')return null;
 return Number.isFinite(x)&&Number.isFinite(z)?kind:null;
}
/** Open compounds have no enclosing roof to remove on entry. */
export function keepCommonsExteriorOnEntry(kind:string|null):boolean {
 return kind==='yard'||kind==='farm';
}
export function retainCommonsInteriorVoxel(kind:string,v:{x:number;y:number;z:number;t?:string;cut?:boolean}):boolean {
 if(v.cut)return false;
 if(kind==='farm')return v.t==='soil';
 if(kind==='yard')return Math.abs(v.x)<5&&Math.abs(v.z)<5;
 if(kind!=='dormitory')return false;
 const b=BUILD_SIZE.dormitory;
 return v.x>b.x0&&v.x<b.x1&&v.z>b.z0&&v.z<b.z1;
}
