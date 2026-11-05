import type { ReflectionOutcome } from '../../equipment/reflection/simulate.ts';
import { add3,scale3,dot3 } from '../../core/optical/reflection.ts';
import type { Vec3,PaperPlane } from '../../core/optical/reflection.ts';
export function ReflectionFoldView({outcome,auxiliary}:{outcome:ReflectionOutcome;auxiliary:boolean}){
  if(!outcome.ok)return null;
  const {left,right}=outcome,w=Number(outcome.paper.parameters.halfWidthM),height=Number(outcome.paper.parameters.heightM),factor=220/Math.max(2*w,height+.15),base=left.origin;
  const project=(p:Vec3)=>{const q=add3(p,scale3(base,-1));return {x:160+(dot3(q,left.u)+q.z*.55)*factor,y:215-(dot3(q,left.v)+q.z*.3)*factor};};
  const point=(p:Vec3)=>{const q=project(p);return `${q.x},${q.y}`;};
  const corners=(plane:PaperPlane)=>[[plane.minU,0],[plane.maxU,0],[plane.maxU,height],[plane.minU,height]].map(([u,v])=>point(add3(plane.origin,add3(scale3(plane.u,u!),scale3(plane.v,v!))))).join(' ');
  const line=(a:Vec3,b:Vec3)=>`M${point(a)}L${point(b)}`;
  return <svg viewBox="0 0 320 240" role="img" aria-label="可折纸板的空间观察图，右板绕法线折转" className="reflection-fold-view" data-testid="reflection-fold-view" data-evidence={outcome.evidence}>
    <polygon points={corners(left)} fill="#f8f4df" stroke="#a9b698"/><polygon data-fold-space-leaf="true" points={corners(right)} fill="#dfdfc3" stroke="#8a9c88"/>
    <path d={line(base,add3(base,scale3(left.v,height)))} stroke="#377d70" strokeDasharray="4 3"/><text x="166" y="20" fontSize="10" fill="#37695c">折轴（须与法线对齐）</text>
    {[...outcome.incoming,...outcome.outgoing].map((trace,i)=>trace.kind==='along'&&trace.start&&trace.end?<path key={i} data-space-paper-ray={i<2?'incident':'reflected'} d={line(trace.start,trace.end)} fill="none" stroke={i<2?'#d97627':'#be473e'} strokeWidth="2.5"/>:null)}
    {auxiliary&&<path data-space-free-ray="true" d={line(outcome.hit,add3(outcome.hit,scale3(outcome.reflected,.6)))} fill="none" stroke="#ba4141" strokeWidth="1.5" strokeDasharray="5 4"/>}
    <path d={line(add3(outcome.hit,scale3(outcome.tangent,-.4)),add3(outcome.hit,scale3(outcome.tangent,.4)))} stroke="#637d88" strokeWidth="4"/><text x="8" y="233" fontSize="10" fill="#44665a">局部空间斜视；纸板光迹来自射线与承接平面的关系</text>
  </svg>;
}
