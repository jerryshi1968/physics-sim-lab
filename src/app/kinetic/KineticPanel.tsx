import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { BALL } from '../../equipment/projectile/definitions.ts';
import { TRACK } from '../../equipment/cart/definitions.ts';
import { kineticBallPoint } from '../../equipment/kinetic/simulate.ts';
import type { KineticSimulation } from './useKinetic.ts';
export function KineticPanel({scene,simulation:s,preview,onUpdate,onView}:{scene:SceneDocument;simulation:KineticSimulation;preview:boolean;onUpdate:(item:EquipmentInstance)=>void;onView:(close:boolean)=>void}) {
  const ball=scene.equipment.find(i=>i.type===BALL),track=scene.equipment.find(i=>i.type===TRACK),height=ball&&track?ball.pose.yM-track.pose.yM-.025:.15;
  const setHeight=(h:number)=>{if(ball&&track&&Number.isFinite(h)&&h>=.02&&h<=Math.min(.4,1.5*Number(track.parameters.lengthM)/Math.PI))onUpdate({...ball,pose:{...ball.pose,...kineticBallPoint(track,h)}});};
  return <section className="simulation-panel density-panel"><h3>动能实验</h3><div className="projectile-controls"><button disabled={!s.rig.ok||preview||s.running} onClick={s.release}>释放钢球</button><button disabled={!s.running} onClick={s.pause}>暂停动能实验</button><button disabled={!s.run||s.running||s.run.timeS>=s.run.rig.endTime} onClick={s.resume}>继续动能实验</button><button disabled={!s.rig.ok||preview||s.running||!!s.run&&s.run.timeS>=s.run.rig.endTime} onClick={s.step}>动能单步 0.1 s</button><button onClick={s.reset}>重置动能实验</button></div>
    <p role="status" data-testid="kinetic-status">{!s.rig.ok?s.rig.message:!s.run?'从静止释放钢球。':s.state?.phase}</p>
    {ball&&<label>钢球质量（g）<input aria-label="钢球质量（g）" type="number" min="20" max="500" step="10" value={Number(ball.parameters.massKg??.05)*1000} onChange={e=>{const m=e.currentTarget.valueAsNumber;if(Number.isFinite(m)&&m>=20&&m<=500)onUpdate({...ball,parameters:{...ball.parameters,massKg:m/1000}});}} /></label>}
    {ball&&track&&<><label>释放高度（cm）<input aria-label="释放高度（cm）" type="number" min="2" max={Math.min(40,150*Number(track.parameters.lengthM)/Math.PI)} step="1" value={Number((height*100).toFixed(3))} onChange={e=>setHeight(e.currentTarget.valueAsNumber/100)} /></label><div className="projectile-controls">{[.1,.15,.3].map(h=><button key={h} onClick={()=>setHeight(h)}>{h*100} cm 释放</button>)}</div></>}
    <label>动能实验播放速度<select aria-label="动能实验播放速度" value={s.rate} onChange={e=>s.setRate(Number(e.target.value))}>{[.25,.5,1,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
    <div className="projectile-controls"><button onClick={()=>onView(true)}>放大碰撞与读尺</button><button onClick={()=>onView(false)}>查看动能装置</button></div><p>拖动钢球改变释放高度，拖动木块调整起点。改变条件会重置运动，已有记录保留。每次比较保持同一木块、同一接触面和同一起点。</p>
    <details><summary>实验步骤与模型范围</summary><ol><li>同一钢球从不同高度由静止滚下，比较撞击前快慢与木块位移。</li><li>保持释放高度，更换钢球质量，再比较木块位移。</li><li>木块停止后，用同一边缘读起点、终点并相减，至少重复三次；自行填写结论。</li></ol><p>钢球为理想均质实心球，纯滚动、忽略滚阻；斜槽平滑连接水平面。碰撞按完全非弹性接触近似，碰后钢球继续贴着木块运动，木块受恒定滑动摩擦。位移用于相同装置下的定性比较，不能直接当作钢球动能的精确读数。图示球半径固定，以质量参数表示不同钢球。</p></details>
    {s.rig.ok&&<details><summary>查看模型参考值</summary><p>撞前速度 {s.rig.speed.toFixed(3)} m/s；模型停止位移 {s.rig.distance.toFixed(3)} m。记录区不自动填写这些值。</p></details>}
  </section>;
}
