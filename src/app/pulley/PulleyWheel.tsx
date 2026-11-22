import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { pulleySpin } from '../../equipment/pulley/simulate.ts';
import type { PulleyMode } from '../../equipment/pulley/definitions.ts';
export function PulleyWheel({item}:{item:EquipmentInstance}) {
  const angle=pulleySpin(item.parameters.mode as PulleyMode,Number(item.parameters.pullM))*180/Math.PI;
  return <g className="real-apparatus" data-appearance="physical" data-pulley-wheel="true" stroke="none"><path d="M0-.065V-.04M0 .04V.065" stroke="#69858a" strokeWidth="2"/><circle cy="-.069" r=".006" fill="none" stroke="#69858a" strokeWidth="1.5"/><path d="M0 .06q.012.015 0 .015q-.008 0-.008-.007" fill="none" stroke="#69858a" strokeWidth="1.5"/><circle r=".04" fill="#bfcac8" stroke="#526f76" strokeWidth="1.5"/><circle r=".033" fill="#e4ebe6" stroke="#97aaa7" strokeWidth="1"/><g transform={`rotate(${angle})`}>{[0,60,120].map(a=><path key={a} d="M-.028 0H.028" transform={`rotate(${a})`} stroke="#869e9d" strokeWidth="2"/>)}</g><circle r=".008" fill="#55767c"/><circle r=".003" fill="#e9e7c7"/></g>;
}
