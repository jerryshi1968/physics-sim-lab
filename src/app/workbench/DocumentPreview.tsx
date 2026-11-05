import { useEffect, useRef } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';

export interface PendingDocument { document: SceneDocument; fromVersion: number; source: 'import' | 'saved' | 'experiment' | 'optical' | 'lever' | 'friction' | 'spring' | 'projectile' | 'reflection' }

export function DocumentPreview({ pending, onConfirm, onCancel }: {
  pending: PendingDocument; onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const scene = pending.document;
  return <dialog ref={dialog} className="document-preview" aria-labelledby="preview-title" onCancel={onCancel}>
    <h2 id="preview-title">{pending.source === 'import' ? '导入预览' : pending.source === 'experiment' || pending.source === 'optical' || pending.source === 'lever' || pending.source === 'friction' || pending.source === 'spring' || pending.source === 'projectile' || pending.source === 'reflection' ? '实验起点预览' : '本地保存预览'}</h2>
    <h3>{scene.title}</h3>
    <p>{scene.equipment.length} 件器材 · {scene.connections.length} 根连接 · {scene.measurementRecords.length} 条记录</p>
    {pending.source === 'reflection' && <p>平面镜、光源、量角器、法线与可折承接纸板；局部三维计算光线与折板的关系。角从法线读起，记录不自动填写；折板无连续光迹不代表光消失。教材映射待教师核验。</p>}
    {pending.source === 'projectile' && <p>质点平抛，无空气阻力、恒定重力。器材起点水平，h=1.25 m、v0=2 m/s；请自行校准读尺后发射。本次初态冻结，运行中修改用于下一次，保存不续跑。高中教材映射待教师核验。</p>}
    {pending.source === 'spring' && <p>竖直静态弹簧，盘质量为零；先无载读尺，再加载/卸载复测。原长、总长和形变量分别记录，超限不外推长度。高中教材映射待教师核验。</p>}
    {pending.source === 'optical' && <p>近轴薄凸透镜，f=0.10 m；初态未同高、未对焦，请自行摆放、调高、移动光屏找像。无自动填入读数。</p>}
    {pending.source === 'friction' && <p>水平一维干摩擦，g={scene.simulationConfig.gravityMPerS2} N/kg。匀速牵引含启动过程，连续滑动稳态后读表；非稳态保留标签，不自动填写学生记录。重载从初态重跑。</p>}
    {pending.source === 'lever' && <p>刚性杠杆与理想铰支架，g={scene.simulationConfig.gravityMPerS2} N/kg。先空载调平，再自行挂码/接测力计、调力和抄表；不自动平衡或填写测量值。</p>}
    {pending.source === 'experiment' && <p>{scene.equipment.length ? '这是可编辑初态：开关断开，电流表接 0～3 A，电压表接 0～15 V。请核对电源与两灯参数后自行闭合；指导不会代为接线或选档。' : '空白工作台，没有预接线或预填读数；从器材库自行搭建。'}</p>}
    {pending.source === 'experiment' && scene.equipment.length > 0 && <ul className="experiment-preview-parameters">{scene.equipment.filter(item => item.type === 'electrical.power-supply' || item.type === 'electrical.lamp').map(item => <li key={item.id}>{item.type === 'electrical.power-supply' ? `电源：${item.parameters.voltageV} V` : `${item.id}：${item.parameters.ratedVoltageV} V / ${item.parameters.ratedCurrentA} A，冷态电阻 ${item.parameters.coldResistanceOhm} Ω`}</li>)}</ul>}
    <p>{pending.fromVersion === 1 ? '旧版 1 已校验并迁移为版本 2，保留原器材和连接。' : '版本 2，场景及端口校验通过。'}</p>
    <p>确认后替换当前实验并清空撤销历史；未保存的内容请先取消并保存或导出。</p>
    <p>重载后从实验初态重新运行，不恢复运行中的仿真时刻。</p>
    <div><button onClick={onCancel} autoFocus>取消</button><button className="confirm-replace" onClick={onConfirm}>确认替换当前实验</button></div>
  </dialog>;
}
