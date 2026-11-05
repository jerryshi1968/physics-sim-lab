import { useRef } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { ReflectionOutcome } from '../../equipment/reflection/simulate.ts';
import { reflectionMessage } from '../../equipment/reflection/simulate.ts';
import { PAPER,MIRROR,EMITTER,PROTRACTOR,NORMAL } from '../../equipment/reflection/definitions.ts';
import { ReflectionFoldView } from './ReflectionFoldView.tsx';
import { ReflectionOrbit } from './ReflectionOrbit.tsx';
export function ReflectionPanel({scene,outcome,auxiliary,onAuxiliary,onFoldPreview,onFold,onAlign,onOrbit,preview}:{scene:SceneDocument;outcome:ReflectionOutcome;auxiliary:boolean;onAuxiliary:(value:boolean)=>void;onFoldPreview:(value:number|null)=>void;onFold:(value:number)=>void;onAlign:(type:string)=>void;onOrbit:(degrees:number)=>void;preview:boolean}){
  const drag=useRef(false),paper=scene.equipment.find(item=>item.type===PAPER),mirror=scene.equipment.find(item=>item.type===MIRROR),emitter=scene.equipment.find(item=>item.type===EMITTER);
  const fold=paper?Number(paper.parameters.foldRad)*180/Math.PI:0,orbit=mirror&&emitter?(Math.atan2(emitter.pose.yM-mirror.pose.yM,emitter.pose.xM-mirror.pose.xM)-mirror.pose.rotationRad)*180/Math.PI:120;
  const message=!outcome.ok?reflectionMessage(outcome.code):!outcome.calibrated?'纸板、量角器或法线未校准；分别对齐入射点和镜面法线后读角。':outcome.evidence==='hinge'?'正入射沿折轴，折动仍可沿轴；这组不能证明共面，请改用斜入射。':outcome.evidence==='wrong-side'?'反射光在固定左板上；请从左侧入射，检验右折板的共面现象。':outcome.evidence==='off-sheet'?'右纸板无连续反射光迹；光仍沿原空间方向传播，未随纸板转弯。':'右纸板上有连续反射光迹；自行读量角器并改变入射方向。';
  return <section className="reflection-panel"><h3>反射与共面观察</h3><p data-testid="reflection-status">{preview?'移动/折动预览中，松手后再记录。':message}</p>
    {paper&&<><label>右纸板折角（°，绕法线折轴）<input aria-label="右纸板折角（°）" type="range" min="-90" max="90" step="1" value={Math.round(fold)} style={{touchAction:'none'}}
      onPointerDown={event=>{drag.current=true;event.currentTarget.setPointerCapture(event.pointerId);onFoldPreview(Number(paper.parameters.foldRad));}} onChange={event=>{const value=Number(event.currentTarget.value)*Math.PI/180;if(drag.current)onFoldPreview(value);else onFold(value);}}
      onPointerUp={event=>{if(!drag.current)return;drag.current=false;onFold(Number(event.currentTarget.value)*Math.PI/180);onFoldPreview(null);}} onPointerCancel={()=>{drag.current=false;onFoldPreview(null);}}
      onLostPointerCapture={()=>{if(drag.current){drag.current=false;onFoldPreview(null);}}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();drag.current=false;onFoldPreview(null);}}}/><span>{Number(fold.toFixed(1))}°；0° 为展开，正负为向两侧折起</span></label><div className="reflection-actions">{[0,45,90].map(value=><button key={value} onClick={()=>onFold(value*Math.PI/180)}>{value===0?'展开纸板 0°':`折起纸板 ${value}°`}</button>)}</div></>}
    {mirror&&emitter&&<ReflectionOrbit degrees={(orbit%360+360)%360} onOrbit={onOrbit}/>}
    <div className="reflection-actions"><button disabled={!outcome.ok} onClick={()=>onAlign(PAPER)}>将纸板折轴对齐法线</button><button disabled={!outcome.ok} onClick={()=>onAlign(PROTRACTOR)}>将量角器对齐入射点</button><button disabled={!outcome.ok} onClick={()=>onAlign(NORMAL)}>将法线标记对齐镜面</button></div>
    <p>角从法线量起。独立移动器材后需自行重新校准；对齐按钮只在你点击时调整指定器材。</p>
    <ReflectionFoldView outcome={outcome} auxiliary={auxiliary}/><label className="checkbox-field"><input type="checkbox" checked={auxiliary} onChange={event=>onAuxiliary(event.target.checked)}/>显示空间光路与理论（可关闭）</label>
    {auxiliary&&outcome.ok&&<div data-testid="reflection-theory"><p>r=d−2(d·n)n；模型入射角 {Number((outcome.incidenceRad*180/Math.PI).toPrecision(6))}°，反射角 {Number((outcome.reflectionRad*180/Math.PI).toPrecision(6))}°。</p><p>反射光前进 0.20 m 后距右承接平面 {Number(Math.abs(outcome.outgoing[1]!.distanceAtProbeM).toPrecision(6))} m；仅交点不算沿板传播。</p></div>}
    <details><summary>反射实验步骤与范围</summary><ol><li>摆放镜、光源、纸板、量角器与法线，校准中心和零线；镜面蓝边为正面。</li><li>展开纸板，从左侧斜入射，读至少三组入射角/反射角，再折起右板观察连续光迹，展开复现。</li><li>记录自己的角度和观察。正入射沿折轴是退化对照，反射在左侧也不能证明右板离面。</li></ol><p>局部三维射线—平面几何；仅一面有限镜、单束光、平面纸板，不模拟衍射、厚光束和散射亮度。图中自由空间光路是辅助示意，教材映射待教师核验。</p></details>
  </section>;
}
