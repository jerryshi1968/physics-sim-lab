export interface Vec3 { x: number; y: number; z: number }
export const add3 = (a:Vec3,b:Vec3):Vec3 => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const scale3 = (a:Vec3,s:number):Vec3 => ({x:a.x*s,y:a.y*s,z:a.z*s});
export const dot3 = (a:Vec3,b:Vec3) => a.x*b.x+a.y*b.y+a.z*b.z;
export const cross3 = (a:Vec3,b:Vec3):Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const length3 = (a:Vec3) => Math.hypot(a.x,a.y,a.z);
export function unit3(a:Vec3):Vec3 { const length=length3(a);if(!Number.isFinite(length)||length<1e-12)throw new RangeError('INVALID_VECTOR');return scale3(a,1/length); }
export function reflect3(direction:Vec3,normal:Vec3):Vec3 { const d=unit3(direction),n=unit3(normal);return add3(d,scale3(n,-2*dot3(d,n))); }
export interface PaperPlane { origin:Vec3; u:Vec3; v:Vec3; minU:number; maxU:number; height:number }
export interface PaperTrace { kind:'along'|'point'|'none'; start:Vec3|null; end:Vec3|null; lengthM:number; distanceAtProbeM:number }
export function paperTrace(origin:Vec3,direction:Vec3,plane:PaperPlane,maximum:number):PaperTrace {
  const d=unit3(direction),normal=unit3(cross3(plane.u,plane.v)),offset=add3(origin,scale3(plane.origin,-1));
  const distance=dot3(offset,normal),denominator=dot3(d,normal),distanceAtProbeM=distance+.2*denominator;
  const none:PaperTrace={kind:'none',start:null,end:null,lengthM:0,distanceAtProbeM};
  const inside=(p:Vec3)=>{const q=add3(p,scale3(plane.origin,-1)),u=dot3(q,plane.u),v=dot3(q,plane.v);return u>=plane.minU-1e-10&&u<=plane.maxU+1e-10&&v>=-1e-10&&v<=plane.height+1e-10;};
  if(Math.abs(denominator)>1e-10){const t=-distance/denominator,p=add3(origin,scale3(d,t));return t>=-1e-10&&t<=maximum+1e-10&&inside(p)?{...none,kind:'point',start:p,end:p}:none;}
  if(Math.abs(distance)>1e-10)return none;
  let lo=0,hi=maximum;
  for(const [axis,min,max]of [[plane.u,plane.minU,plane.maxU],[plane.v,0,plane.height]]as const){const position=dot3(offset,axis),slope=dot3(d,axis);if(Math.abs(slope)<1e-12){if(position<min-1e-10||position>max+1e-10)return none;}else{const a=(min-position)/slope,b=(max-position)/slope;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}
  if(hi<lo-1e-10)return none;
  const start=add3(origin,scale3(d,lo)),end=add3(origin,scale3(d,hi)),lengthM=Math.max(0,hi-lo);
  return {kind:lengthM>1e-8?'along':'point',start,end,lengthM,distanceAtProbeM};
}
