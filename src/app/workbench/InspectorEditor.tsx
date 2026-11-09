import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { Pose2D, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Endpoint } from '../../core/connections/schema.ts';
import { parameterFields, portLabel, RHEOSTAT } from '../../equipment/electrical/definitions.ts';
import { rheostatResistances } from '../../core/electrical/rheostat.ts';
import { opticalParameterFields } from '../../equipment/optical/definitions.ts';
import { mechanicalParameterFields, MECHANICAL_RULER, FORCE_METER } from '../../equipment/mechanical/definitions.ts';
import { frictionParameterFields } from '../../equipment/mechanical/frictionDefinitions.ts';
import { isFrictionScene } from '../../equipment/mechanical/frictionScene.ts';
import { SPRING, springFields } from '../../equipment/spring/definitions.ts';
import { LAUNCHER, SCALE, projectileFields } from '../../equipment/projectile/definitions.ts';
import { cartFields } from '../../equipment/cart/definitions.ts';
import { reflectionFields, reflectionTypes } from '../../equipment/reflection/definitions.ts';
import { LiveProperties } from './LiveProperties.tsx';
import { endpointLabel, equipmentLabel } from './shared.ts';
import type { Selection, WireEndSelection } from './shared.ts';

interface Props {
  scene: SceneDocument;
  registry: EquipmentRegistry;
  selection: Selection;
  start: Endpoint | null;
  wireColor: string;
  activeWireEnd: WireEndSelection | null;
  onSelect: (selection: Selection) => void;
  onPort: (endpoint: Endpoint) => void;
  onApply: (id: string, pose: Pose2D, parameters: Record<string, Scalar>) => boolean;
  onRemove: () => void;
  onRoute: (add: boolean) => void;
  onDeleteRoutePoint: (index: number) => void;
  onColor: (color: string) => void;
  onWireEnd: (selection: WireEndSelection) => void;
  onDetachEnd: (side: 'from' | 'to') => void;
  onFlip: (id: string) => void;
}

export function InspectorEditor({ scene, registry, selection, start, wireColor, activeWireEnd, onSelect, onPort, onApply, onRemove, onRoute, onDeleteRoutePoint, onColor, onWireEnd, onDetachEnd, onFlip }: Props) {
  const instance = selection?.kind === 'equipment' ? scene.equipment.find(item => item.id === selection.id) : undefined;
  const wire = selection?.kind === 'connection' ? scene.connections.find(item => item.id === selection.id) : undefined;
  const definition = instance && registry.get(instance.type, instance.definitionVersion);
  const optical = definition?.domain === 'optical';
  const mechanical = definition?.domain === 'mechanical', canRotate = !!instance && reflectionTypes.includes(instance.type) || !optical && (!mechanical || instance?.type === MECHANICAL_RULER || instance?.type === LAUNCHER || instance?.type === SCALE);
  const fields = instance ? (mechanical ? { ...mechanicalParameterFields, ...frictionParameterFields, ...projectileFields, ...cartFields, [SPRING]: springFields } : optical ? { ...opticalParameterFields, ...reflectionFields } : parameterFields)[instance.type]?.filter(field => !(isFrictionScene(scene) && instance.type === FORCE_METER && field.key === 'forceN')) ?? [] : [];
  const rheostat = instance?.type === RHEOSTAT ? rheostatResistances({ maxResistanceOhm: Number(instance.parameters.maxResistanceOhm), position: Number(instance.parameters.position) }) : null;
  return <>
    {scene.equipment.length > 0 && <div className="selection-controls"><label>选择器材<select aria-label="选择器材" value={instance?.id ?? ''}
      onChange={event => onSelect(event.target.value ? { kind: 'equipment', id: event.target.value } : null)}>
      <option value="">请选择</option>{scene.equipment.map(item => <option key={item.id} value={item.id}>{equipmentLabel(scene, registry, item.id)}</option>)}
    </select></label></div>}
    {selection?.kind === 'equipment-group' && <div className="property-editor" aria-label="多选器材"><h3>已选择 {selection.ids.length} 件器材</h3><p>按住 Shift 点击器材可增选或取消选择；按 Delete 删除所选器材，保留相连导线。</p><button className="delete-button" onClick={onRemove}>删除所选器材</button></div>}
    {instance && definition ? <div className="property-editor"><h3>{equipmentLabel(scene, registry, instance.id)}</h3>
      <LiveProperties key={`${scene.documentId}:${instance.id}`} instance={instance} registry={registry} fields={fields} optical={optical && !reflectionTypes.includes(instance.type)} canRotate={canRotate} onApply={onApply} />
      {instance.type === FORCE_METER && isFrictionScene(scene) && <p className="editor-help">在上方控制水平拉力；可选匀速牵引器。斜拉超出模型，左右方向由控制拉力的正负决定。</p>}
      {!optical && !mechanical && <button aria-pressed={!!instance.pose.flippedX} onClick={() => onFlip(instance.id)}>左右翻转</button>}
      {rheostat && <p className="editor-help">下端 A/B 是电阻丝两端，上端 C/D 共用滑片。A/B 间固定为 {String(instance.parameters.maxResistanceOhm)} Ω，C/D 间为理想导线；一上一下可调。当前 A–滑片 {Number(rheostat.asOhm.toPrecision(6))} Ω，B–滑片 {Number(rheostat.sbOhm.toPrecision(6))} Ω。拖动红色滑片，或用方向键/Home/End 调节；拖动中仅预览，松手一次提交。</p>}
      {definition.ports.length > 0 && <fieldset className="port-controls"><legend>接线柱（点击起点，再点终点）</legend>{definition.ports.map(port =>
        <button key={port.id} aria-pressed={start?.equipmentId === instance.id && start.portId === port.id}
          onClick={() => onPort({ equipmentId: instance.id, portId: port.id })}>{portLabel(port.id)}</button>)}</fieldset>}
      <button className="delete-button" onClick={onRemove}>删除器材</button>
    </div> : !wire && selection?.kind !== 'equipment-group' && <div className="selection-empty"><span aria-hidden="true">⌖</span><h3>尚未选择器材</h3><p>选择器材后，在这里查看参数、位置和接线柱。</p></div>}
    {scene.connections.length > 0 && <div className="selection-controls"><label>选择导线<select aria-label="选择导线" value={wire?.id ?? ''}
      onChange={event => onSelect(event.target.value ? { kind: 'connection', id: event.target.value } : null)}>
      <option value="">请选择</option>{scene.connections.map((item, index) => <option key={item.id} value={item.id}>导线 {index + 1}：{endpointLabel(scene, registry, item.from)} → {endpointLabel(scene, registry, item.to)}</option>)}
    </select></label></div>}
    {wire && <div className="property-editor"><h3>导线属性</h3><p className="wire-description">{endpointLabel(scene, registry, wire.from)}<br />↔ {endpointLabel(scene, registry, wire.to)}</p>
      <label>导线颜色<select aria-label="导线颜色" value={wireColor} onChange={event => onColor(event.target.value)}><option value="#126c63">青绿</option><option value="#b76b18">橙色</option><option value="#4868ac">蓝色</option></select></label>
      <div className="wire-end-controls">{(['from', 'to'] as const).map((side, index) => <div key={side}>
        <button aria-pressed={activeWireEnd?.wireId === wire.id && activeWireEnd.side === side} onClick={() => onWireEnd({ wireId: wire.id, side })}>连接线头 {index === 0 ? 'A' : 'B'}</button>
        <span>{endpointLabel(scene, registry, wire[side])}</span>
        {wire[side] && <button onClick={() => onDetachEnd(side)}>拔开线头 {index === 0 ? 'A' : 'B'}</button>}
      </div>)}</div>
      <p className="editor-help">拖动线头改接；拖动线身或弯曲控制点调整形状。也可先选线头，再点击目标接线柱。</p>
      <p className="editor-help">当前有 {wire.routeWorldM?.length ?? 0} 个弯曲点。右键点击菱形点可删除；Tab 聚焦点后按 Delete 也可删除。触屏可用下方按钮逐点删除，操作支持撤销。</p>
      <button disabled={(wire.routeWorldM?.length ?? 0) >= 100} onClick={() => onRoute(true)}>添加弯曲点</button><button disabled={!wire.routeWorldM?.length} onClick={() => onRoute(false)}>清除弯曲点</button>
      {!!wire.routeWorldM?.length && <fieldset><legend>删除指定弯曲点（从线头 A 向 B 编号）</legend>{wire.routeWorldM.map((_, index) =>
        <button key={index} onClick={() => onDeleteRoutePoint(index)}>删除弯曲点 {index + 1}</button>)}</fieldset>}
      <button className="delete-button" onClick={onRemove}>删除导线</button>
    </div>}
  </>;
}
