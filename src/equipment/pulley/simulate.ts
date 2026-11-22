import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { SUPPORT, FORCE_METER, WEIGHT, MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { positionWeightChains, weightBottom, weightChainIssue, weightRoot, weightDescendants } from '../mechanical/weightChain.ts';
import { PULLEY, pulleyApparatus, pulleyModes } from './definitions.ts';
import type { PulleyMode } from './definitions.ts';
export const pulleyRadius = .04;
export const pulleySpin = (mode:PulleyMode,travelM:number) => mode==='direct'?0:(mode==='fixed'?travelM:-travelM/2)/pulleyRadius;
export function pulleyLayout(scene:SceneDocument) {
  const pulley=scene.equipment.find(i=>i.type===PULLEY),support=scene.equipment.find(i=>i.type===SUPPORT&&i.id===pulley?.parameters.supportId),meter=scene.equipment.find(i=>i.type===FORCE_METER&&i.id===pulley?.parameters.meterId),weight=scene.equipment.find(i=>i.type===WEIGHT&&i.id===pulley?.parameters.weightId);
  if(!pulley||!support||!meter||!weight)return null;
  const mode=pulley.parameters.mode as PulleyMode;if(!Object.hasOwn(pulleyModes,mode))return null;
  const anchor={xM:support.pose.xM+.18,yM:support.pose.yM+Number(support.parameters.heightM)},u=Number(pulley.parameters.pullM),n=mode==='movable'?2:1,sign=mode==='fixed'?-1:1;
  const center={xM:anchor.xM,yM:anchor.yM-(mode==='movable'?.4:.11)+(mode==='movable'?u/2:0)},meterStart={xM:mode==='fixed'||mode==='movable'?anchor.xM+pulleyRadius:anchor.xM,yM:anchor.yM-(mode==='fixed'?.23:mode==='movable'?.14:.22)},loadStart={xM:mode==='fixed'?anchor.xM-pulleyRadius:anchor.xM,yM:mode==='fixed'?anchor.yM-.42:mode==='movable'?anchor.yM-.465:meterStart.yM-.205},meterPoint={...meterStart,yM:meterStart.yM+sign*u},loadPoint={...loadStart,yM:loadStart.yM+u/n};
  return {pulley,support,meter,weight,mode,anchor,u,n,sign,center,meterStart,loadStart,meterPoint,loadPoint};
}
export function pulleyViewScene(scene:SceneDocument) {
  const layout=pulleyLayout(scene);if(!layout)return {...scene,equipment:positionWeightChains(scene.equipment)};
  return {...scene,equipment:positionWeightChains(scene.equipment.map(i=>i.id===layout.pulley.id?{...i,pose:{...i.pose,...(layout.mode==='direct'?{xM:layout.anchor.xM+.29,yM:layout.support.pose.yM+.08}:layout.center)}}:i.id===layout.meter.id?{...i,pose:{...i.pose,...layout.meterPoint}}:i.id===layout.weight.id?{...i,pose:{...i.pose,...layout.loadPoint}}:i))};
}
export function simulatePulley(scene:SceneDocument,registry:EquipmentRegistry,preview=false) {
  const layout=pulleyLayout(scene),view=pulleyViewScene(scene),weights=scene.equipment.filter(i=>i.type===WEIGHT),hung=layout?weights.filter(i=>weightRoot(weights,i)?.id===layout.weight.id):[],massKg=hung.reduce((sum,i)=>sum+Number(i.parameters.massKg),0),g=scene.simulationConfig.gravityMPerS2,weightN=massKg*g,movingMass=layout?.mode==='movable'?Number(layout.pulley.parameters.massKg):0,forceN=layout?(massKg+movingMass)*g/layout.n:0;
  let code='';
  if(!validateSceneDocument(scene,registry).ok||scene.connections.length||scene.equipment.some(i=>!pulleyApparatus.includes(i.type)))code='PULLEY_DOCUMENT';
  else if(preview)code='PULLEY_PREVIEW';
  else if(!layout||[PULLEY,SUPPORT,FORCE_METER].some(type=>scene.equipment.filter(i=>i.type===type).length!==1)||weights.length>6||scene.equipment.filter(i=>i.type===MECHANICAL_RULER).length>2)code='PULLEY_APPARATUS';
  else if(scene.simulationConfig.randomError.enabled||!Number.isFinite(g)||g<=0||g>30||scene.equipment.some(i=>i.pose.flippedX||i.type!==MECHANICAL_RULER&&Math.abs(i.pose.rotationRad)>1e-8)||Number(layout.support.parameters.heightM)<.6)code='PULLEY_ORIENTATION';
  else if(weightChainIssue(weights)||layout.weight.parameters.parentWeightId||layout.meter.parameters.leverId||layout.meter.parameters.supportId||Number(layout.meter.parameters.directionDeg)!==-90||weights.some(i=>i.parameters.leverId||i.parameters.springId||i.parameters.forceMeterId||i.parameters.twoForceTableId))code='PULLEY_ATTACHMENT';
  else if(!massKg||massKg>1||!Number.isFinite(forceN))code='PULLEY_MASS';
  else if(Number(layout.meter.parameters.resolutionN)>Number(layout.meter.parameters.rangeN)||Number(layout.meter.parameters.rangeN)/Number(layout.meter.parameters.resolutionN)>200)code='PULLEY_SCALE';
  else if(forceN>Number(layout.meter.parameters.rangeN)+1e-10||(layout.mode==='fixed'?2*forceN+Number(layout.pulley.parameters.massKg)*g:layout.mode==='movable'?forceN:0)>Number(layout.support.parameters.capacityN))code='PULLEY_OVER_RANGE';
  else if(view.equipment.filter(i=>hung.some(w=>w.id===i.id)).some(i=>weightBottom(i).yM<layout.support.pose.yM+.025)||layout.meterPoint.yM-.22<layout.support.pose.yM+.025||layout.mode==='fixed'&&layout.center.yM-layout.loadPoint.yM<.075||layout.mode==='movable'&&(layout.anchor.yM-layout.center.yM<.075||layout.meterPoint.yM-.205-layout.center.yM<.04))code='PULLEY_CONTACT';
  const reading={forceN,status:code?'invalid':'valid'},displayN=!code&&layout?Number((Math.round(forceN/Number(layout.meter.parameters.resolutionN))*Number(layout.meter.parameters.resolutionN)).toPrecision(12)):null;
  return {ok:!code,code,layout,view,hung,massKg,weightN,forceN,reading,displayN};
}
export type PulleyOutcome=ReturnType<typeof simulatePulley>;
export function pulleyPullUpdates(scene:SceneDocument,point:WorldPoint) {
  const layout=pulleyLayout(scene);if(!layout)return [];
  const pullM=Math.max(0,Math.min(.2,layout.sign*(point.yM-layout.meterStart.yM)));
  return [{id:layout.pulley.id,pose:layout.pulley.pose,parameters:{...layout.pulley.parameters,pullM}}];
}
export function pulleyPreviewScene(scene:SceneDocument,preview?:{id:string;point:WorldPoint}|null) {
  if(!preview)return scene;const item=scene.equipment.find(i=>i.id===preview.id);if(!item)return scene;
  const result=pulleyDrop(scene,item,preview.point);return result.ok?{...scene,equipment:scene.equipment.map(i=>{const update=result.updates.find(update=>update.id===i.id);return update?{...i,...update}:i;})}:scene;
}
export function pulleyAttach(scene:SceneDocument,key:'supportId'|'meterId'|'weightId',id:string) {
  const pulley=scene.equipment.find(i=>i.type===PULLEY),type=key==='supportId'?SUPPORT:key==='meterId'?FORCE_METER:WEIGHT,target=scene.equipment.find(i=>i.id===id&&i.type===type);
  if(!pulley||id&&!target||target?.parameters.parentWeightId)return null;
  return {id:pulley.id,pose:pulley.pose,parameters:{...pulley.parameters,[key]:id,pullM:0}};
}
export function pulleyDrop(scene:SceneDocument,item:EquipmentInstance,point:WorldPoint) {
  const layout=pulleyLayout(scene),pulley=scene.equipment.find(i=>i.type===PULLEY),view=pulleyViewScene(scene);
  if(layout&&item.id===layout.meter.id)return {ok:true as const,updates:pulleyPullUpdates(scene,point)};
  if(item.type===WEIGHT){const excluded=weightDescendants(scene.equipment,item.id),peers=view.equipment.filter(i=>i.type===WEIGHT&&!excluded.has(i.id)),nearest=peers.map(i=>({item:i,distance:Math.hypot(point.xM-weightBottom(i).xM,point.yM-weightBottom(i).yM)})).sort((a,b)=>a.distance-b.distance)[0],parent=nearest&&nearest.distance<.05?nearest.item:null;
    if(parent&&scene.equipment.some(i=>i.id!==item.id&&!excluded.has(i.id)&&i.parameters.parentWeightId===parent.id))return {ok:false as const,message:'挂钩已占用，请挂到最下方空钩。'};
    const parameters:Record<string,Scalar>={...item.parameters,parentWeightId:parent?.id??'',leverId:'',springId:'',forceMeterId:''},updates=[{id:item.id,pose:{...item.pose,...point},parameters}];
    if(pulley?.parameters.weightId===item.id)updates.push({id:pulley.id,pose:pulley.pose,parameters:{...pulley.parameters,weightId:'',pullM:0}});
    return {ok:true as const,updates};
  }
  return {ok:true as const,updates:[{id:item.id,pose:{...item.pose,...point},parameters:item.parameters}]};
}
export function pulleyDetached(scene:SceneDocument,ids:readonly string[]) {
  const view=pulleyViewScene(scene);
  return scene.equipment.filter(i=>!ids.includes(i.id)).flatMap(i=>{
    const keys=i.type===PULLEY?['supportId','meterId','weightId']:i.type===WEIGHT?['parentWeightId']:[],removed=keys.filter(key=>ids.includes(String(i.parameters[key])));if(!removed.length)return [];
    return [{id:i.id,pose:view.equipment.find(peer=>peer.id===i.id)!.pose,parameters:{...i.parameters,...Object.fromEntries(removed.map(key=>[key,''])),...(i.type===PULLEY?{pullM:0}:{})}}];
  });
}
export const pulleyMessage=(code:string)=>({PULLEY_DOCUMENT:'本实验使用一套支架、滑轮、测力计、钩码与两把独立尺。',PULLEY_PREVIEW:'请先松手并静止后读表。',PULLEY_APPARATUS:'请在装配区选择支架、测力计和根钩码。',PULLEY_ORIENTATION:'支架高度至少 60 cm，器材保持竖直，关闭随机误差；尺可独立转动。',PULLEY_ATTACHMENT:'钩码串接且无其他实验连接，测力计保持正向竖直。',PULLEY_MASS:'悬挂钩码总质量不超过 1 kg。',PULLEY_SCALE:'测力计分度不能超过量程，最多 200 格。',PULLEY_OVER_RANGE:'超出测力计量程或支架承载，不能作为正常读数。',PULLEY_CONTACT:'器材接触底面或绳段过短，请调整装置或回到起点。'} as Record<string,string>)[code]??'请检查当前滑轮装置。';
