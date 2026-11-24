import { LAMP_CIRCUIT_EXPERIMENT, createLampCircuitExperiment } from './lamp-circuits.ts';
import { seriesReferenceConnections, seriesReferenceEquipment } from './series-current-layouts.ts';
import type { SceneDocument } from '../core/scene/schema.ts';
import type { Connection, Endpoint } from '../core/connections/schema.ts';
import type { SceneCommand } from '../core/workbench/history.ts';
import { AMMETER, LAMP, POWER, SWITCH } from '../equipment/electrical/definitions.ts';
export const SERIES_CURRENT_EXPERIMENT='J-ELEC-01-SERIES';
export const seriesPositions=[{id:'before',label:'A 点：电源与灯泡 L1 之间'},{id:'between',label:'B 点：两灯之间'},{id:'after',label:'C 点：灯泡 L2 与开关之间'}] as const;
export type SeriesPosition=typeof seriesPositions[number]['id'];
export type SeriesLamps='same'|'different';
type SeriesRole='E'|'S'|'A'|'L1'|'L2';
const endpointKey=(e:Endpoint|null|undefined)=>e?`${e.equipmentId}:${e.portId}`:'loose';
const edge=(c:Connection)=>[endpointKey(c.from),endpointKey(c.to)].sort().join('|');
function seriesRoles(scene:Pick<SceneDocument,'equipment'>){
  const one=(type:string)=>scene.equipment.filter(i=>i.type===type),lamps=one(LAMP);if(scene.equipment.length!==5||[POWER,SWITCH,AMMETER].some(t=>one(t).length!==1)||lamps.length!==2)return null;
  const first=lamps.find(i=>i.id==='L1')??lamps.find(i=>i.id!=='L2')!,second=lamps.find(i=>i.id!==first.id)!;
  return {E:one(POWER)[0]!.id,S:one(SWITCH)[0]!.id,A:one(AMMETER)[0]!.id,L1:first.id,L2:second.id};
}
export function seriesCurrentSetup(document:Pick<SceneDocument,'equipment'|'connections'>){
  const roles=seriesRoles(document),name=(id:string)=>Object.entries(roles??{}).find(([,value])=>value===id)?.[0]??id,scene=roles?{equipment:document.equipment.map(i=>({...i,id:name(i.id)})),connections:document.connections.map(c=>({...c,from:c.from?{...c.from,equipmentId:name(c.from.equipmentId)}:c.from,to:c.to?{...c.to,equipmentId:name(c.to.equipmentId)}:c.to}))}:document;
  const supported=!!roles,ports=scene.connections.flatMap(c=>[c.from,c.to]).filter(e=>e?.equipmentId==='A'&&e.portId!=='common').map(e=>e!.portId),meterPort=ports.length===1&&['low','high'].includes(ports[0]!)?ports[0]!:null;
  const actual=scene.connections.map(edge).sort(),index=supported&&meterPort?seriesReferenceConnections.findIndex(wires=>JSON.stringify(wires.map(c=>edge({...c,from:c.from?.equipmentId==='A'&&c.from.portId==='low'?{...c.from,portId:meterPort}:c.from,to:c.to?.equipmentId==='A'&&c.to.portId==='low'?{...c.to,portId:meterPort}:c.to})).sort())===JSON.stringify(actual)):-1;
  const l1=scene.equipment.find(i=>i.id==='L1'),l2=scene.equipment.find(i=>i.id==='L2'),matches=(i:typeof l1,v:number,cold:number)=>i?.parameters.ratedVoltageV===v&&i.parameters.ratedCurrentA===.3&&i.parameters.coldResistanceOhm===cold;
  const lamps:SeriesLamps|null=matches(l1,3,2)&&matches(l2,3,2)?'same':matches(l1,3,2)&&matches(l2,6,4)?'different':null;
  return {supported,roles,position:index>=0?seriesPositions[index]!.id:null,meterPort,lamps,closed:scene.equipment.find(i=>i.id==='S')?.parameters.closed===true};
}
export function createSeriesCurrentExperiment(id:string,time:string,lamps:SeriesLamps='different'){
  const scene=createLampCircuitExperiment(id,time,lamps==='same'?'series-same':'series-different');scene.experimentId=SERIES_CURRENT_EXPERIMENT;scene.title='探究串联电路中各处电流的关系';
  scene.equipment=seriesReferenceEquipment.map(item=>({...item,pose:{...item.pose},parameters:{...item.parameters,...(item.id==='S'?{closed:false}:item.id==='E'?{voltageV:lamps==='same'?6:9}:item.id==='L2'&&lamps==='same'?{ratedVoltageV:3,coldResistanceOhm:2}:{})}}));
  scene.connections=seriesConnections('before','low');scene.viewport={centerXM:-.2,centerYM:-.07,pixelsPerM:600};scene.curriculumRef!.standard.topic='探究串联电路中各处电流的关系';scene.provenance.notes=['根据教师提供的三份串联测电流装置复用已有五件器材；右侧选择三处串入位置及相同/不同灯泡，预放开关断开。'];return scene;
}
function seriesConnections(position:SeriesPosition,port:string){return seriesReferenceConnections[seriesPositions.findIndex(p=>p.id===position)]!.map(c=>({...c,from:c.from?{...c.from,portId:c.from.equipmentId==='A'&&c.from.portId==='low'?port:c.from.portId}:c.from,to:c.to?{...c.to,portId:c.to.equipmentId==='A'&&c.to.portId==='low'?port:c.to.portId}:c.to,...(c.routeWorldM?{routeWorldM:c.routeWorldM.map(p=>({...p}))}:{})}));}
export function configureSeriesCurrent(scene:SceneDocument,change:{position?:SeriesPosition;lamps?:SeriesLamps;restore?:boolean}):SceneCommand|null{
  if(scene.experimentId!==SERIES_CURRENT_EXPERIMENT&&scene.experimentId!==LAMP_CIRCUIT_EXPERIMENT)return null;const setup=seriesCurrentSetup(scene);if(!setup.supported||!setup.position&&!change.restore||change.position&&!seriesPositions.some(p=>p.id===change.position)||change.lamps&&!['same','different'].includes(change.lamps))return null;
  const roles=setup.roles!,updates=scene.equipment.filter(i=>i.id===roles.S||change.lamps&&[roles.L1,roles.L2].includes(i.id)).map(i=>({...i,parameters:{...i.parameters,...(i.id===roles.S?{closed:false}:i.id===roles.L1?{ratedVoltageV:3,ratedCurrentA:.3,coldResistanceOhm:2}:{ratedVoltageV:change.lamps==='same'?3:6,ratedCurrentA:.3,coldResistanceOhm:change.lamps==='same'?2:4})}}));
  return {type:'update-circuit',updates,connections:change.position||change.restore?seriesConnections(change.position??'before',setup.meterPort??'low').map(c=>({...c,from:c.from?{...c.from,equipmentId:roles[c.from.equipmentId as SeriesRole]}:c.from,to:c.to?{...c.to,equipmentId:roles[c.to.equipmentId as SeriesRole]}:c.to})):scene.connections};
}
export function seriesCurrentPoint(scene:Pick<SceneDocument,'equipment'|'connections'>){const setup=seriesCurrentSetup(scene);return setup.position?`${setup.lamps==='same'?'相同灯泡':setup.lamps==='different'?'不同灯泡':'自定灯泡'} · ${seriesPositions.find(p=>p.id===setup.position)!.label}`:'串联电流（自定义接线）';}
export function seriesCurrentRows(scene:SceneDocument){
  const rows=new Map<string,{group:string;lamps:string;values:Record<SeriesPosition,number|null>}>();
  for(const r of scene.measurementRecords){if(r.quantity!=='current'||r.unit!=='A')continue;const snap=scene.measurementSnapshots?.find(s=>s.id===r.context?.sampleId);if(!snap)continue;const setup=seriesCurrentSetup(snap);if(!setup.position||r.equipmentId!==setup.roles?.A)continue;
    const fingerprint=JSON.stringify([snap.setupLabel,snap.equipment.filter(i=>[setup.roles!.E,setup.roles!.L1,setup.roles!.L2].includes(i.id)).map(i=>[i.id,i.parameters]).sort(),snap.equipment.find(i=>i.id===setup.roles!.A)?.parameters.resistanceOhm,snap.modelConfigSnapshot]);
    const row=rows.get(fingerprint)??{group:snap.setupLabel,lamps:setup.lamps==='same'?'相同灯泡':setup.lamps==='different'?'不同灯泡':'自定灯泡',values:{before:null,between:null,after:null}};row.values[setup.position]=r.measurementStatus==='valid'?r.value:null;rows.set(fingerprint,row);
  }return [...rows.values()];
}
