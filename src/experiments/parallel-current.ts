import { LAMP_CIRCUIT_EXPERIMENT, createLampCircuitExperiment } from './lamp-circuits.ts';
import { parallelReferenceConnections, parallelReferenceEquipment } from './parallel-current-layouts.ts';
import type { SceneDocument } from '../core/scene/schema.ts';
import type { Connection, Endpoint } from '../core/connections/schema.ts';
import type { SceneCommand } from '../core/workbench/history.ts';
import { AMMETER, LAMP, POWER, SWITCH } from '../equipment/electrical/definitions.ts';
export const PARALLEL_CURRENT_EXPERIMENT='J-ELEC-01-PARALLEL';
export const parallelPositions=[{id:'main',label:'干路'},{id:'branch1',label:'L1 支路（上方灯泡）'},{id:'branch2',label:'L2 支路（下方灯泡）'}] as const;
export type ParallelPosition=typeof parallelPositions[number]['id'];
export type ParallelLamps='same'|'different';
type ParallelRole='E'|'S'|'A'|'L1'|'L2';
const endpointKey=(e:Endpoint|null|undefined)=>e?`${e.equipmentId}:${e.portId}`:'loose';
const edge=(c:Connection)=>[endpointKey(c.from),endpointKey(c.to)].sort().join('|');
function parallelRoles(scene:Pick<SceneDocument,'equipment'>){
  const one=(type:string)=>scene.equipment.filter(i=>i.type===type),lamps=one(LAMP);if(scene.equipment.length!==5||[POWER,SWITCH,AMMETER].some(t=>one(t).length!==1)||lamps.length!==2)return null;
  const first=lamps.find(i=>i.id==='L1')??lamps.find(i=>i.id!=='L2')!,second=lamps.find(i=>i.id!==first.id)!;
  return {E:one(POWER)[0]!.id,S:one(SWITCH)[0]!.id,A:one(AMMETER)[0]!.id,L1:first.id,L2:second.id};
}
export function parallelCurrentSetup(document:Pick<SceneDocument,'equipment'|'connections'>){
  const roles=parallelRoles(document),name=(id:string)=>Object.entries(roles??{}).find(([,value])=>value===id)?.[0]??id,scene=roles?{equipment:document.equipment.map(i=>({...i,id:name(i.id)})),connections:document.connections.map(c=>({...c,from:c.from?{...c.from,equipmentId:name(c.from.equipmentId)}:c.from,to:c.to?{...c.to,equipmentId:name(c.to.equipmentId)}:c.to}))}:document;
  const supported=!!roles,ports=[...new Set(scene.connections.flatMap(c=>[c.from,c.to]).filter(e=>e?.equipmentId==='A'&&e.portId!=='common').map(e=>e!.portId))],meterPort=ports.length===1&&['low','high'].includes(ports[0]!)?ports[0]!:null;
  const actual=scene.connections.map(edge).sort(),index=supported&&meterPort?parallelReferenceConnections.findIndex(wires=>JSON.stringify(wires.map(c=>edge({...c,from:c.from?.equipmentId==='A'&&c.from.portId==='low'?{...c.from,portId:meterPort}:c.from,to:c.to?.equipmentId==='A'&&c.to.portId==='low'?{...c.to,portId:meterPort}:c.to})).sort())===JSON.stringify(actual)):-1;
  const l1=scene.equipment.find(i=>i.id==='L1'),l2=scene.equipment.find(i=>i.id==='L2'),matches=(i:typeof l1,current:number)=>i?.parameters.ratedVoltageV===3&&i.parameters.ratedCurrentA===current&&i.parameters.coldResistanceOhm===2;
  const lamps:ParallelLamps|null=matches(l1,.3)&&matches(l2,.3)?'same':matches(l1,.3)&&matches(l2,.2)?'different':null;
  return {supported,roles,position:index>=0?parallelPositions[index]!.id:null,meterPort,lamps,closed:scene.equipment.find(i=>i.id==='S')?.parameters.closed===true};
}
export function createParallelCurrentExperiment(id:string,time:string,lamps:ParallelLamps='different'){
  const scene=createLampCircuitExperiment(id,time,lamps==='same'?'parallel-same':'parallel-different');scene.experimentId=PARALLEL_CURRENT_EXPERIMENT;scene.title='探究并联电路中干路电流与各支路电流的关系';
  scene.equipment=parallelReferenceEquipment.map(item=>({...item,pose:{...item.pose},parameters:{...item.parameters,...(item.id==='S'?{closed:false}:item.id==='L2'&&lamps==='same'?{ratedCurrentA:.3}:{})}}));
  scene.connections=parallelConnections('main','low');scene.viewport={centerXM:-.04,centerYM:-.10,pixelsPerM:600};scene.curriculumRef!.standard.topic='探究并联电路中干路电流与各支路电流的关系';scene.provenance.notes=['根据教师提供的三份并联测电流装置复用已有五件器材；右侧选择干路与两条支路及相同/不同灯泡，预放开关断开。'];return scene;
}
function parallelConnections(position:ParallelPosition,port:string){return parallelReferenceConnections[parallelPositions.findIndex(p=>p.id===position)]!.map(c=>({...c,from:c.from?{...c.from,portId:c.from.equipmentId==='A'&&c.from.portId==='low'?port:c.from.portId}:c.from,to:c.to?{...c.to,portId:c.to.equipmentId==='A'&&c.to.portId==='low'?port:c.to.portId}:c.to,...(c.routeWorldM?{routeWorldM:c.routeWorldM.map(p=>({...p}))}:{})}));}
export function configureParallelCurrent(scene:SceneDocument,change:{position?:ParallelPosition;lamps?:ParallelLamps;restore?:boolean}):SceneCommand|null{
  if(scene.experimentId!==PARALLEL_CURRENT_EXPERIMENT&&scene.experimentId!==LAMP_CIRCUIT_EXPERIMENT)return null;const setup=parallelCurrentSetup(scene);if(!setup.supported||!setup.position&&!change.restore||change.position&&!parallelPositions.some(p=>p.id===change.position)||change.lamps&&!['same','different'].includes(change.lamps))return null;
  const roles=setup.roles!,updates=scene.equipment.filter(i=>i.id===roles.S||change.lamps&&[roles.L1,roles.L2].includes(i.id)).map(i=>({...i,parameters:{...i.parameters,...(i.id===roles.S?{closed:false}:i.id===roles.L1?{ratedVoltageV:3,ratedCurrentA:.3,coldResistanceOhm:2}:{ratedVoltageV:3,ratedCurrentA:change.lamps==='same'?.3:.2,coldResistanceOhm:2})}}));
  return {type:'update-circuit',updates,connections:change.position||change.restore?parallelConnections(change.position??'main',setup.meterPort??'low').map(c=>({...c,from:c.from?{...c.from,equipmentId:roles[c.from.equipmentId as ParallelRole]}:c.from,to:c.to?{...c.to,equipmentId:roles[c.to.equipmentId as ParallelRole]}:c.to})):scene.connections};
}
export function parallelCurrentPoint(scene:Pick<SceneDocument,'equipment'|'connections'>){const setup=parallelCurrentSetup(scene);return setup.position?`${setup.lamps==='same'?'相同灯泡':setup.lamps==='different'?'不同灯泡':'自定灯泡'} · ${parallelPositions.find(p=>p.id===setup.position)!.label}`:'并联电流（自定义接线）';}
export function parallelCurrentRows(scene:SceneDocument){
  const rows=new Map<string,{group:string;lamps:string;values:Record<ParallelPosition,number|null>}>();
  for(const r of scene.measurementRecords){if(r.quantity!=='current'||r.unit!=='A')continue;const snap=scene.measurementSnapshots?.find(s=>s.id===r.context?.sampleId);if(!snap)continue;const setup=parallelCurrentSetup(snap);if(!setup.position||r.equipmentId!==setup.roles?.A)continue;
    const fingerprint=JSON.stringify([snap.setupLabel,snap.equipment.filter(i=>[setup.roles!.E,setup.roles!.L1,setup.roles!.L2].includes(i.id)).map(i=>[i.id,i.parameters]).sort(),snap.equipment.find(i=>i.id===setup.roles!.A)?.parameters.resistanceOhm,snap.modelConfigSnapshot]);
    const row=rows.get(fingerprint)??{group:snap.setupLabel,lamps:setup.lamps==='same'?'相同灯泡':setup.lamps==='different'?'不同灯泡':'自定灯泡',values:{main:null,branch1:null,branch2:null}};row.values[setup.position]=r.measurementStatus==='valid'?r.value:null;rows.set(fingerprint,row);
  }return [...rows.values()];
}
