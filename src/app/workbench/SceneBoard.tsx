import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Connection, Endpoint } from '../../core/connections/schema.ts';
import type { Pose2D } from '../../core/equipment/schema.ts';
import { DEFAULT_VIEWPORT, endpointKey, endpointWorld, localToWorld, panViewport, screenToWorld, wireWorldPoints, worldToScreen, zoomViewport } from '../../core/workbench/geometry.ts';
import type { Viewport, WorldPoint } from '../../core/workbench/geometry.ts';
import { positionWireEnd } from '../../core/workbench/edit.ts';
import { curvedWirePath, nearestElectricalPort, translateLooseWire } from '../../core/workbench/wire.ts';
import { SWITCH, WIRE, RHEOSTAT } from '../../equipment/electrical/definitions.ts';
import { rheostatLocalXM, rheostatPointerPosition, rheostatWiperXM } from '../../core/workbench/rheostat.ts';
import { EquipmentGraphic } from './EquipmentGraphic.tsx';
import { endpointLabel, equipmentLabel, equipmentSelectionIds } from './shared.ts';
import type { Selection, WireEndSelection } from './shared.ts';
import type { ElectricalOutcome } from '../../equipment/electrical/simulate.ts';
import type { OpticalOutcome } from '../../core/optical/bench.ts';
import { OpticalGraphic, opticalBounds } from '../optical/OpticalGraphic.tsx';
import type { ReflectionOutcome } from '../../equipment/reflection/simulate.ts';
import { reflectionTypes, PAPER, MIRROR, PROTRACTOR, NORMAL } from '../../equipment/reflection/definitions.ts';
import { ReflectionRays } from '../reflection/ReflectionRays.tsx';
import { MirrorImageGraphic, MirrorImageOverlay, mirrorImageBounds } from '../mirrorImage/MirrorImageGraphic.tsx';
import type { MirrorImageOutcome } from '../../equipment/mirrorImage/simulate.ts';
import { EYE, MATCH, mirrorImageApparatus } from '../../equipment/mirrorImage/definitions.ts';
import { OpticalRays } from '../optical/OpticalRays.tsx';
import { BENCH } from '../../equipment/optical/definitions.ts';
import { MechanicalGraphic, mechanicalBounds } from '../mechanical/MechanicalGraphic.tsx';
import { LeverForces } from '../mechanical/LeverForces.tsx';
import { BLOCK, SURFACE, DRIVE } from '../../equipment/mechanical/frictionDefinitions.ts';
import { BODY as BUOY_BODY, OVERFLOW } from '../../equipment/buoyancy/definitions.ts';
import { isReceiver } from '../../equipment/buoyancy/simulate.ts';
import type { BuoyancyOutcome } from '../../equipment/buoyancy/simulate.ts';
import { BuoyancyGraphic, BuoyancyOverlay, buoyancyBounds } from '../buoyancy/BuoyancyGraphic.tsx';
import { BEAKER as BUOY_BEAKER } from '../../equipment/density/definitions.ts';
import { WEIGHT } from '../../equipment/mechanical/definitions.ts';
import { hookWorld } from '../../equipment/mechanical/simulate.ts';
import { leverPresentationScene, leverTrendAngle } from '../mechanical/leverPresentation.ts';
import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';

import type { FrictionSample } from '../../equipment/mechanical/frictionScene.ts';

import { SPRING } from '../../equipment/spring/definitions.ts';
import type { SpringOutcome } from '../../equipment/spring/simulate.ts';

import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
import { BALL as PROJECTILE_BALL, SCALE as PROJECTILE_SCALE, GROUND as PROJECTILE_GROUND, LAUNCHER as PROJECTILE_LAUNCHER } from '../../equipment/projectile/definitions.ts';
import { ProjectileOverlay } from '../projectile/ProjectileOverlay.tsx';

import type { DensityOutcome } from '../../equipment/density/simulate.ts';
import { BALANCE, MASS_SET, densityTypes, SPECIMEN as DENSITY_SPECIMEN, BEAKER as DENSITY_BEAKER } from '../../equipment/density/definitions.ts';
import { balanceAdjustments, steppedBalanceValue } from '../density/DensityGraphic.tsx';
import type { BalanceAdjustment } from '../density/DensityGraphic.tsx';
import type { DensityPreview } from '../density/DensityPanel.tsx';
import { CART as DYNAMICS_CART, TICKER as CART_TICKER, TRACK as CART_TRACK } from '../../equipment/cart/definitions.ts';
import type { CartRig, CartRun } from '../../equipment/cart/simulate.ts';
import { CartTether } from '../cart/CartGraphic.tsx';

interface Props {
  pendulumAngle?: number | undefined;
  pendulumTimeS?: number | undefined;
  onPendulumAngle?: ((id: string, degrees: number) => void) | undefined;
  cartMode?: boolean;
  cartRig?: CartRig | null;
  cartRun?: CartRun | null;
  densityOutcome?: DensityOutcome | null;
  buoyancyOutcome?: BuoyancyOutcome | null;
  onDensityPreview: (preview: DensityPreview | null) => void;
  onDensityAdjust: (id: string, key: BalanceAdjustment, value: number) => void;
  onDensityWeight: (id: string, index: number) => void;
  projectileMode?: boolean;
  projectileFlight?: ProjectileFlight | null;
  projectileMarks?: boolean;
  springOutcome?: SpringOutcome | null;
  frictionSample?: FrictionSample | null;
  scene: SceneDocument; registry: EquipmentRegistry; selection: Selection;
  placing: string | null; start: Endpoint | null; wireColor: string;
  activeWireEnd: WireEndSelection | null;
  onSelect: (selection: Selection, additive?: boolean) => void;
  onPort: (endpoint: Endpoint) => void;
  onPlace: (type: string, point: WorldPoint) => void;
  onMove: (id: string, point: WorldPoint) => void;
  onRoute: (id: string, points: { x: number; y: number }[]) => void;
  onWireChange: (wire: Connection) => void;
  onWireEnd: (selection: WireEndSelection) => void;
  onViewport: (viewport: Viewport) => void;
  onCancel: () => void;
  onNotice: (message: string) => void;
  undoLabel: string | null;
  redoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
  outcome: ElectricalOutcome | null;
  reflectionOutcome?: ReflectionOutcome | null;
  mirrorImageOutcome?: MirrorImageOutcome | null;
  mirrorGuides?: boolean;
  mirrorRays?: boolean;
  opticalOutcome: OpticalOutcome | null;
  opticalAuxiliary: boolean;
  leverOutcome: LeverOutcome | null;
  leverAuxiliary: boolean;
  onMechanicalPreview: (value: { id: string; point: WorldPoint } | null) => void;
  onOpticalPreview: (value: { id: string; point: WorldPoint } | null) => void;
  calculationStatus: string;
  onToggleSwitch: (id: string) => void;
  onRheostatChange: (id: string, position: number) => void;
  onRheostatPreview: (preview: { id: string; position: number } | null) => void;
}
type Gesture = { pointerId: number; clientX: number; clientY: number; view: Viewport } & (
  | { kind: 'equipment'; id: string; origin: WorldPoint; pointer: WorldPoint; travelled?: boolean }
  | { kind: 'rheostat'; id: string; pose: Pose2D; grabOffsetXM: number; lastPreviewAt: number }
  | { kind: 'balance-adjust'; id: string; pose: Pose2D; key: BalanceAdjustment; startXM: number; value: number }
  | { kind: 'route'; id: string; index: number; points: { x: number; y: number }[] }
  | { kind: 'wire-body'; wire: Connection; pointer: WorldPoint; bendIndex: number }
  | { kind: 'wire-end'; wire: Connection; side: 'from' | 'to' }
  | { kind: 'tap'; endpoint?: Endpoint; dragged: boolean }
  | { kind: 'pan' }
);

export function SceneBoard({ pendulumAngle, pendulumTimeS, onPendulumAngle, cartMode = false, cartRig = null, cartRun = null, densityOutcome = null, buoyancyOutcome = null, onDensityPreview, onDensityAdjust, onDensityWeight, reflectionOutcome = null, mirrorImageOutcome = null, mirrorGuides = false, mirrorRays = false, projectileMode = false, projectileFlight = null, projectileMarks = false, springOutcome, frictionSample, scene, registry, selection, placing, start, wireColor, activeWireEnd, onSelect, onPort, onPlace, onMove, onRoute, onWireChange, onWireEnd, onViewport, onCancel, onNotice, undoLabel, redoLabel, onUndo, onRedo, outcome, opticalOutcome, opticalAuxiliary, onOpticalPreview, leverOutcome, leverAuxiliary, onMechanicalPreview, calculationStatus, onToggleSwitch, onRheostatChange, onRheostatPreview }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const wireLayerId = useId();
  const gesture = useRef<Gesture | null>(null);
  const wiperTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipClick = useRef(false);
  const touchClickTarget = useRef<string | null>(null);
  const [size, setSize] = useState({ width: 600, height: 320 });
  const [preview, setPreview] = useState<{ id: string; point: WorldPoint } | null>(null);
  const [wiperPreview, setWiperPreview] = useState<{ id: string; position: number } | null>(null);
  const [routePreview, setRoutePreview] = useState<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const [wirePreview, setWirePreview] = useState<Connection | null>(null);
  const [snapPort, setSnapPort] = useState<Endpoint | null>(null);
  const [panMode, setPanMode] = useState(false);
  const view = scene.viewport ?? DEFAULT_VIEWPORT;
  const positionedEquipment = leverOutcome ? leverPresentationScene(scene, leverOutcome, preview).equipment : preview ? scene.equipment.map(item => item.id === preview.id ? { ...item, pose: { ...item.pose, ...preview.point } } : item) : scene.equipment;
  const trendAngle = leverTrendAngle(leverOutcome);
  const equipment = wiperPreview ? positionedEquipment.map(item => item.id === wiperPreview.id ? { ...item, parameters: { ...item.parameters, position: wiperPreview.position } } : item) : positionedEquipment;

  useEffect(() => () => { if (wiperTimer.current !== null) clearTimeout(wiperTimer.current); }, []);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      if (gesture.current) return;
      const rect = element!.getBoundingClientRect();
      const anchor = { x: (event.clientX - rect.left) * size.width / rect.width, y: (event.clientY - rect.top) * size.height / rect.height };
      onViewport(zoomViewport(view, Math.exp(Math.max(-1, Math.min(1, -event.deltaY * 0.001))), anchor, size));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [view, size, onViewport]);

  function pointerPoint(clientX: number, clientY: number, viewport = view): WorldPoint {
    const rect = svg.current!.getBoundingClientRect();
    return screenToWorld({ x: (clientX - rect.left) * size.width / rect.width, y: (clientY - rect.top) * size.height / rect.height }, viewport, size);
  }

  function cancelGesture() {
    onOpticalPreview(null);
    onMechanicalPreview(null);
    if (wiperTimer.current !== null) { clearTimeout(wiperTimer.current); wiperTimer.current = null; }
    if (gesture.current?.kind === 'rheostat') onRheostatPreview(null);
    if (gesture.current?.kind === 'balance-adjust') onDensityPreview(null);
    gesture.current = null;
    setPreview(null);
    setWiperPreview(null);
    setRoutePreview(null);
    setWirePreview(null);
    setSnapPort(null);
  }

  function capture(event: ReactPointerEvent<SVGElement>, value: Gesture) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = value;
    skipClick.current = true;
    svg.current!.focus();
    svg.current!.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: ReactPointerEvent<SVGSVGElement>, commit: boolean) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) > 3 || !!buoyancyOutcome && active.kind === 'equipment' && active.travelled === true;
    if (buoyancyOutcome && active.kind === 'equipment' && moved) active.travelled = true;
    if (active.kind === 'rheostat') {
      const position = rheostatPointerPosition(pointerPoint(event.clientX, event.clientY, active.view), active.pose, active.grabOffsetXM);
      if (moved) {
        if (commit) onRheostatChange(active.id, position);
        else {
          setWiperPreview({ id: active.id, position });
          if (wiperTimer.current !== null) clearTimeout(wiperTimer.current);
          const delay = 80 - (event.timeStamp - active.lastPreviewAt);
          const publish = () => {
            wiperTimer.current = null;
            if (gesture.current !== active) return;
            active.lastPreviewAt = event.timeStamp + Math.max(0, delay);
            onRheostatPreview({ id: active.id, position });
          };
          if (delay <= 0) publish();
          else wiperTimer.current = setTimeout(publish, delay);
        }
      }
    } else if (active.kind === 'balance-adjust') {
      const { key, id } = active;
      const { spanM, minKg, maxKg } = balanceAdjustments[key];
      const localXM = rheostatLocalXM(pointerPoint(event.clientX, event.clientY, active.view), active.pose);
      const value = localXM === active.startXM ? active.value : steppedBalanceValue(key, active.value + (localXM - active.startXM) / spanM * (maxKg - minKg));
      if (commit) {
        if (value !== active.value) onDensityAdjust(id, key, value);
      } else onDensityPreview(value === active.value ? null : { id, key, value });
    } else if (active.kind === 'equipment') {
      const pointer = pointerPoint(event.clientX, event.clientY, active.view);
      const point = { xM: active.origin.xM + pointer.xM - active.pointer.xM, yM: active.origin.yM + pointer.yM - active.pointer.yM };
      if (moved) {
        if (commit) onMove(active.id, point);
        else {
          setPreview({ id: active.id, point });
          if (scene.equipment.find(item => item.id === active.id)?.type.startsWith('optical.')) onOpticalPreview({ id: active.id, point });
          if (scene.equipment.find(item => item.id === active.id)?.type.startsWith('mechanical.')) onMechanicalPreview({ id: active.id, point });
        }
      }
    } else if (active.kind === 'route') {
      const point = pointerPoint(event.clientX, event.clientY, active.view);
      const points = active.points.map((item, index) => index === active.index ? { x: point.xM, y: point.yM } : item);
      if (moved) {
        if (commit) onRoute(active.id, points);
        else setRoutePreview({ id: active.id, points });
      }
    } else if (active.kind === 'wire-body' && moved) {
      const pointer = pointerPoint(event.clientX, event.clientY, active.view);
      const delta = { xM: pointer.xM - active.pointer.xM, yM: pointer.yM - active.pointer.yM };
      const changed = active.bendIndex < 0 ? translateLooseWire(active.wire, delta) : { ...active.wire,
        routeWorldM: active.wire.routeWorldM!.map((point, index) => index === active.bendIndex ? { x: point.x + delta.xM, y: point.y + delta.yM } : point) };
      if (commit) onWireChange(changed);
      else setWirePreview(changed);
    } else if (active.kind === 'wire-end' && moved) {
      const point = pointerPoint(event.clientX, event.clientY, active.view);
      const target = nearestElectricalPort(point, scene.equipment, registry, 20 / active.view.pixelsPerM);
      const changed = positionWireEnd(active.wire, active.side, target, point);
      if (commit) onWireChange(changed);
      else { setWirePreview(changed); setSnapPort(target); }
    } else if (active.kind === 'tap') {
      active.dragged ||= moved;
      if (commit && !active.dragged) {
        if (active.endpoint) onPort(active.endpoint);
        else activateCanvas(event.clientX, event.clientY);
      }
    } else if (active.kind === 'pan' && moved) onViewport(panViewport(active.view, event.clientX - active.clientX, event.clientY - active.clientY));
    if (commit) cancelGesture();
  }

  function activateCanvas(clientX: number, clientY: number) {
    if (placing) onPlace(placing, pointerPoint(clientX, clientY));
    else if (start || activeWireEnd) onNotice('请点选器材的接线柱；也可将导线线头直接拖到接线柱。');
    else onSelect(null);
  }

  function bendControls(wire: Connection) {
    if (selection?.kind !== 'connection' || selection.id !== wire.id) return null;
    const base = wirePreview?.id === wire.id ? wirePreview : wire;
    const displayed = routePreview?.id === wire.id ? { ...base, routeWorldM: routePreview.points } : base;
    return <g key={wire.id} data-wire-controls-of={wire.id}>{(displayed.routeWorldM ?? []).map((point, pointIndex) => {
      const screen = worldToScreen({ xM: point.x, yM: point.y }, view, size);
      return <g key={pointIndex} className="route-handle" role="button" tabIndex={0} aria-label={`弯曲点 ${pointIndex + 1}，方向键移动，Delete 删除`}
        transform={`translate(${screen.x} ${screen.y})`} onClick={event => event.stopPropagation()}
        onContextMenu={event => {
          event.preventDefault(); event.stopPropagation();
          cancelGesture();
          onRoute(wire.id, (wire.routeWorldM ?? []).filter((_, index) => index !== pointIndex));
        }}
        onKeyDown={event => {
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault(); event.stopPropagation();
            if (!event.repeat) onRoute(wire.id, (wire.routeWorldM ?? []).filter((_, index) => index !== pointIndex));
            return;
          }
          const deltas: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -0.01, y: 0 }, ArrowRight: { x: 0.01, y: 0 }, ArrowUp: { x: 0, y: 0.01 }, ArrowDown: { x: 0, y: -0.01 } };
          const delta = deltas[event.key];
          if (delta) {
            event.preventDefault(); event.stopPropagation();
            onRoute(wire.id, (wire.routeWorldM ?? []).map((item, index) => index === pointIndex ? { x: item.x + delta.x, y: item.y + delta.y } : item));
          }
        }}
        onPointerDown={event => capture(event, { kind: 'route', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
          view: { ...view }, id: wire.id, index: pointIndex, points: (wire.routeWorldM ?? []).map(item => ({ ...item })) })}>
        <circle r="18" fill="transparent" /><rect x="-4" y="-4" width="8" height="8" rx="1" transform="rotate(45)" fill="#fff8dd" stroke="#c68c35" strokeWidth="1.5" /></g>;
    })}</g>;
  }

  return <section className="panel bench" id="workbench" tabIndex={-1} aria-labelledby="bench-title">
    <div className="bench-toolbar"><div><h2 id="bench-title">实验区域</h2><span className="muted">{scene.equipment.length} 件器材 · {pendulumTimeS !== undefined ? '单摆实验' : buoyancyOutcome ? '浮力实验' : cartMode ? '小车实验' : densityOutcome ? '密度实验' : mirrorImageOutcome ? '平面镜成像' : reflectionOutcome ? '反射实验' : projectileMode ? '平抛实验' : springOutcome ? '弹簧实验' : frictionSample ? '摩擦实验' : leverOutcome ? '杠杆实验' : opticalOutcome ? '光具座实验' : `${scene.connections.length} 根导线`}</span></div>
      <div className="view-actions"><button aria-label="缩小" onClick={() => onViewport(zoomViewport(view, 1 / 1.25, { x: size.width / 2, y: size.height / 2 }, size))}>−</button>
        <span aria-label="缩放比例">{Math.round(view.pixelsPerM / DEFAULT_VIEWPORT.pixelsPerM * 100)}%</span>
        <button aria-label="放大" onClick={() => onViewport(zoomViewport(view, 1.25, { x: size.width / 2, y: size.height / 2 }, size))}>＋</button>
        <button aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>平移</button><button onClick={() => onViewport({ ...DEFAULT_VIEWPORT })}>复位视图</button>
      </div>
      <div className="history-actions"><button disabled={!undoLabel} aria-label="撤销" title={undoLabel ? `撤销：${undoLabel}（Ctrl+Z）` : '暂无可撤销操作'} onClick={onUndo}>↶</button><button disabled={!redoLabel} aria-label="重做" title={redoLabel ? `重做：${redoLabel}（Ctrl+Shift+Z / Ctrl+Y）` : '暂无可重做操作'} onClick={onRedo}>↷</button></div>
    </div>
    <div className={`experiment-surface svg-surface ${panMode ? 'pan-mode' : ''} ${placing ? 'placing-mode' : ''}`}>
      <svg ref={svg} data-testid="scene-board" data-revision={scene.revision} role="group" aria-label="实验画布" tabIndex={0} viewBox={`0 0 ${size.width} ${size.height}`}
        onPointerDownCapture={event => {
          if (!panMode) return;
          event.stopPropagation();
          capture(event, { kind: 'pan', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view } });
        }} onPointerDown={event => {
          skipClick.current = false;
          if (event.pointerType !== 'mouse') capture(event, { kind: 'tap', dragged: false, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view } });
        }} onPointerMove={event => moveGesture(event, false)} onPointerUp={event => moveGesture(event, true)}
        onPointerCancel={() => { skipClick.current = false; cancelGesture(); }} onLostPointerCapture={() => {
          if (gesture.current) { skipClick.current = false; cancelGesture(); }
        }}
        onClickCapture={event => { if (panMode) event.stopPropagation(); }} onClick={event => {
          if (skipClick.current) { skipClick.current = false; return; }
          activateCanvas(event.clientX, event.clientY);
        }} onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); skipClick.current = false; cancelGesture(); onCancel(); }
          else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            onViewport(panViewport(view, event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0, event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0));
          }
        }}>
        <defs><linearGradient id="wire-plug-metal" x2="0" y2="1"><stop stopColor="#fafafa" /><stop offset=".5" stopColor="#9ca9ae" /><stop offset="1" stopColor="#e2e9e9" /></linearGradient></defs>
        <defs><clipPath id={`${wireLayerId}-wire-hit`} clipPathUnits="userSpaceOnUse">
          <path clipRule="evenodd" d={wireHitClipPath(size.width, size.height, equipment.flatMap(instance => {
            const definition = registry.get(instance.type, instance.definitionVersion)!;
            const radius = definition.ports.length === 1 ? 22 : Math.min(22, view.pixelsPerM * (instance.type === SWITCH ? .045 : definition.ports.length >= 3 ? .03 : .07));
            const regions = definition.ports.map(port => {
              const point = worldToScreen(endpointWorld({ equipmentId: instance.id, portId: port.id }, equipment, registry), view, size);
              return [point.x - radius, point.y - radius, point.x + radius, point.y + radius];
            });
            if (instance.type === SWITCH || instance.type === RHEOSTAT) {
              const x = instance.type === RHEOSTAT ? rheostatWiperXM(Number(instance.parameters.position)) : 0;
              const bounds = instance.type === RHEOSTAT ? [[x - .024, -.058], [x + .024, -.058], [x + .024, .018], [x - .024, .018]] : [[-.088, -.065], [.088, -.065], [.088, .065], [-.088, .065]];
              const points = bounds.map(([localX, localY]) => worldToScreen(localToWorld({ x: localX!, y: -localY! }, instance.pose), view, size));
              regions.push([Math.min(...points.map(point => point.x)), Math.min(...points.map(point => point.y)), Math.max(...points.map(point => point.x)), Math.max(...points.map(point => point.y))]);
            }
            return regions;
          }))} />
        </clipPath></defs>
        {buoyancyOutcome && <BuoyancyOverlay outcome={buoyancyOutcome} view={view} size={size} />}
        {mirrorImageOutcome && <MirrorImageOverlay outcome={mirrorImageOutcome} equipment={equipment} view={view} size={size} guides={mirrorGuides} rays={mirrorRays} />}
        {opticalOutcome && opticalAuxiliary && <OpticalRays outcome={opticalOutcome} view={view} size={size} />}
        {trendAngle !== 0 && leverOutcome?.ok && (() => {
          const half = Number(leverOutcome.lever.parameters.halfHooks), a = worldToScreen(hookWorld(leverOutcome.lever, -half), view, size), b = worldToScreen(hookWorld(leverOutcome.lever, half), view, size);
          return <path data-lever-initial-axis="true" d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#98a8ad" strokeWidth="2" strokeDasharray="6 5" pointerEvents="none" />;
        })()}
        {leverOutcome && leverAuxiliary && <LeverForces outcome={leverOutcome} view={view} size={size} />}
        {frictionSample?.ok && (() => {
          const block = equipment.find(item => item.id === frictionSample.rig.block.id)!, meter = equipment.find(item => item.id === frictionSample.rig.meter.id)!, drive = equipment.find(item => item.id === frictionSample.rig.drive.id)!;
          const sign = Math.cos(Number(meter.parameters.directionDeg) * Math.PI / 180);
          const points = [worldToScreen({ xM: block.pose.xM + sign * Number(block.parameters.widthM) / 2, yM: block.pose.yM }, view, size), worldToScreen(meter.pose, view, size), worldToScreen({ xM: meter.pose.xM + sign * .22, yM: meter.pose.yM }, view, size), worldToScreen(drive.pose, view, size)];
          return <path data-friction-link="true" d={`M${points[0]!.x} ${points[0]!.y}L${points[1]!.x} ${points[1]!.y}M${points[2]!.x} ${points[2]!.y}L${drive.type === DRIVE ? points[3]!.x : points[2]!.x + sign * .06 * view.pixelsPerM} ${points[3]!.y}`} fill="none" stroke="#7d8780" strokeWidth="2" pointerEvents="none" />;
        })()}
        {projectileMode && <ProjectileOverlay scene={scene} flight={projectileFlight} marks={projectileMarks} view={view} size={size} />}
        {cartRig && !preview && <CartTether rig={cartRig} run={cartRun} view={view} size={size} />}
        {(buoyancyOutcome ? [...equipment].sort((a, b) => Number([OVERFLOW, BUOY_BEAKER].includes(b.type)) - Number([OVERFLOW, BUOY_BEAKER].includes(a.type))) : cartMode ? [...equipment].sort((a, b) => Number(b.type === CART_TRACK) - Number(a.type === CART_TRACK)) : densityOutcome ? [...equipment].sort((a, b) => Number([DENSITY_SPECIMEN, DENSITY_BEAKER].includes(a.type)) - Number([DENSITY_SPECIMEN, DENSITY_BEAKER].includes(b.type))) : reflectionOutcome ? [...equipment].sort((a, b) => reflectionTypes.indexOf(a.type) - reflectionTypes.indexOf(b.type)) : projectileMode ? [...equipment].sort((a, b) => ([PROJECTILE_SCALE, PROJECTILE_GROUND].includes(a.type) ? -1 : a.type === PROJECTILE_BALL ? 1 : 0) - ([PROJECTILE_SCALE, PROJECTILE_GROUND].includes(b.type) ? -1 : b.type === PROJECTILE_BALL ? 1 : 0)) : equipment).map((instance, equipmentIndex) => {
          const screen = worldToScreen(instance.pose, view, size);
          const selected = equipmentSelectionIds(selection).includes(instance.id);
          const definition = registry.get(instance.type, instance.definitionVersion)!;
          if (definition.domain === 'optical' && ![screen.x, screen.y].every(Number.isFinite)) return null;
          const bounds = definition.domain === 'mechanical' ? buoyancyOutcome && [BUOY_BODY, OVERFLOW, BUOY_BEAKER].includes(instance.type) ? buoyancyBounds(instance) : mechanicalBounds(instance, springOutcome) : definition.domain === 'optical' ? mirrorImageOutcome && mirrorImageApparatus.includes(instance.type) ? mirrorImageBounds(instance) : opticalBounds(instance) : { x: -.088, y: -.06, width: .176, height: .12 };
          let frictionCaption: { x: number; y: number } | null = null;
          if (frictionSample?.ok) {
            const base = worldToScreen(frictionSample.rig.surface.pose, view, size).y + .07 * view.pixelsPerM;
            if (instance.type === BLOCK) frictionCaption = { x: screen.x, y: base + 18 };
            else if (instance.id === frictionSample.rig.meter.id) frictionCaption = { x: screen.x + Math.cos(Number(instance.parameters.directionDeg) * Math.PI / 180) * .11 * view.pixelsPerM, y: base + 38 };
            else if (instance.type === DRIVE && instance.id === frictionSample.rig.drive.id) frictionCaption = { x: screen.x, y: base + 58 };
            else if (instance.type === SURFACE && instance.id === frictionSample.rig.surface.id) frictionCaption = { x: screen.x, y: base + 78 };
          }
          const densityCaption = densityOutcome && densityTypes.includes(instance.type) && [DENSITY_SPECIMEN, DENSITY_BEAKER].includes(instance.type) ? { x: screen.x + (instance.parameters.targetId === equipment.find(item => item.type === 'mechanical.density-balance')?.id ? -.06 * view.pixelsPerM - 8 : .055 * view.pixelsPerM + 8), y: screen.y + (bounds.y + bounds.height / 2) * view.pixelsPerM, anchor: instance.parameters.targetId === equipment.find(item => item.type === 'mechanical.density-balance')?.id ? 'end' as const : 'start' as const } : null;
          const buoySideCaption = buoyancyOutcome && ['mechanical.force-meter', 'mechanical.support', BUOY_BODY].includes(instance.type);
          const buoyCaption = buoyancyOutcome ? { x: buoySideCaption ? screen.x - .035 * view.pixelsPerM - 8 : screen.x,
            y: instance.type === 'mechanical.support' ? screen.y - 8 : instance.type === 'mechanical.force-meter' ? screen.y + .12 * view.pixelsPerM : instance.type === BUOY_BODY ? screen.y - Number(instance.parameters.heightM) * view.pixelsPerM / 2 : instance.type === BUOY_BEAKER && isReceiver(instance) ? screen.y - (instance.parameters.targetId ? .11 : .15) * view.pixelsPerM - 10 : screen.y + (bounds.y + bounds.height) * view.pixelsPerM + 17,
            anchor: buoySideCaption ? 'end' as const : 'middle' as const } : null;
          const mirrorCaption = mirrorImageOutcome ? { x: instance.type === 'optical.ruler' ? screen.x + Math.cos(instance.pose.rotationRad) * Number(instance.parameters.lengthM) * view.pixelsPerM / 2 : screen.x,
            y: instance.type === 'optical.ruler' ? screen.y + (Math.abs(Math.sin(instance.pose.rotationRad)) > .5 ? 13 : .026 * view.pixelsPerM + 13) : [EYE, MATCH, MIRROR].includes(instance.type) ? Math.max(12, screen.y + bounds.y * view.pixelsPerM - 8) : screen.y + (bounds.y + bounds.height) * view.pixelsPerM + 14 } : null;
          const reflectionCaption = reflectionOutcome ? instance.type === PAPER ? { x: screen.x - Number(instance.parameters.halfWidthM) * view.pixelsPerM / 2, y: Math.max(16, screen.y - Number(instance.parameters.heightM) * view.pixelsPerM - 18), anchor: 'middle' as const }
            : instance.type === MIRROR ? { x: screen.x, y: screen.y + 40, anchor: 'middle' as const }
            : instance.type === NORMAL ? { x: screen.x + 12, y: screen.y - Number(instance.parameters.lengthM) * view.pixelsPerM - 8, anchor: 'start' as const }
            : instance.type === PROTRACTOR ? { x: screen.x - Number(instance.parameters.radiusM) * view.pixelsPerM - 8, y: screen.y - .18 * view.pixelsPerM, anchor: 'end' as const }
            : { x: screen.x, y: screen.y + .06 * view.pixelsPerM + 16, anchor: 'middle' as const } : null;
          const projectileCaption = projectileMode ? instance.type === PROJECTILE_SCALE ? { x: screen.x + Number(instance.parameters.widthM) * view.pixelsPerM / 2, y: screen.y - .21 * view.pixelsPerM - 16, anchor: 'middle' as const }
            : instance.type === PROJECTILE_GROUND ? { x: screen.x + Number(instance.parameters.lengthM) * view.pixelsPerM / 2, y: Math.min(size.height - 12, screen.y + .12 * view.pixelsPerM + 18), anchor: 'middle' as const }
            : instance.type === PROJECTILE_LAUNCHER ? { x: screen.x - .35 * view.pixelsPerM - 10, y: screen.y + 4, anchor: 'end' as const } : null : null;
          const springCaption = springOutcome ? instance.type === SPRING ? { x: screen.x - .12 * view.pixelsPerM, y: screen.y + (springOutcome.ok ? springOutcome.value.lengthM : Number(instance.parameters.originalLengthM)) * .5 * view.pixelsPerM, anchor: 'end' as const }
            : instance.type === 'mechanical.ruler' ? { x: screen.x + 12, y: screen.y - 12, anchor: 'start' as const }
            : instance.type === WEIGHT ? { x: Math.max(screen.x + .03 * view.pixelsPerM + 6, ...equipment.filter(item => item.type === 'mechanical.ruler').map(item => worldToScreen(item.pose, view, size).x + .045 * view.pixelsPerM)), y: screen.y + .046 * view.pixelsPerM, anchor: 'start' as const } : null : null;
          const cartCaption = instance.type === CART_TRACK ? { x: screen.x - Number(instance.parameters.lengthM) * view.pixelsPerM / 2, y: screen.y + .06 * view.pixelsPerM + 30, anchor: 'start' as const }
            : instance.type === DYNAMICS_CART ? { x: screen.x, y: Math.max(14, screen.y - .17 * view.pixelsPerM - 7), anchor: 'middle' as const }
            : instance.type === CART_TICKER ? { x: Math.max(8, screen.x - .085 * view.pixelsPerM), y: screen.y + .053 * view.pixelsPerM + 16, anchor: 'start' as const } : null;
          const hasDensityControls = densityOutcome && (instance.type === BALANCE || instance.type === MASS_SET);
          return <g key={instance.id} data-equipment-id={instance.id} data-equipment-type={instance.type} data-x-m={instance.pose.xM} data-y-m={instance.pose.yM} data-rotation-rad={instance.pose.rotationRad}>
            <g className={`equipment-body ${selected ? 'is-selected' : ''} ${instance.pose.flippedX ? 'is-flipped' : ''}`} data-flipped-x={!!instance.pose.flippedX} data-selected={selected} role={instance.type === SWITCH || instance.type === RHEOSTAT || hasDensityControls ? 'group' : 'button'} tabIndex={0} aria-label={`选择${equipmentLabel(scene, registry, instance.id)}`}
              transform={`translate(${screen.x} ${screen.y}) rotate(${-instance.pose.rotationRad * 180 / Math.PI}) scale(${view.pixelsPerM * (instance.pose.flippedX ? -1 : 1)} ${view.pixelsPerM})`}
              onPointerDown={event => {
                if (start || activeWireEnd) { event.stopPropagation(); onNotice('请将线头连接到器材的金属接线柱，或使用右侧接线按钮。'); return; }
                onSelect({ kind: 'equipment', id: instance.id }, event.shiftKey);
                if (cartRun?.rig.cart.id === instance.id) { event.stopPropagation(); onNotice('请重置后再调整小车起点。'); return; }
                if (projectileFlight && instance.id === projectileFlight.rig.ball.id) { event.stopPropagation(); onNotice('本次小球按冻结初态运动；请重置后再拖放小球，或在属性区配置下一次。'); return; }
                capture(event, { kind: 'equipment', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
                  view: { ...view }, id: instance.id, origin: { xM: instance.pose.xM, yM: instance.pose.yM }, pointer: pointerPoint(event.clientX, event.clientY) });
              }} onClick={event => { event.stopPropagation(); skipClick.current = false; }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect({ kind: 'equipment', id: instance.id }, event.shiftKey); }
                const deltas: Record<string, WorldPoint> = { ArrowLeft: { xM: -0.01, yM: 0 }, ArrowRight: { xM: 0.01, yM: 0 }, ArrowUp: { xM: 0, yM: 0.01 }, ArrowDown: { xM: 0, yM: -0.01 } };
                const delta = deltas[event.key];
                if (delta && cartRun?.rig.cart.id === instance.id) { event.preventDefault(); event.stopPropagation(); onNotice('请重置后再调整小车起点。'); return; }
                if (delta && projectileFlight && instance.id === projectileFlight.rig.ball.id) { event.preventDefault(); event.stopPropagation(); onNotice('请重置后再摆放小球。'); return; }
                if (delta) { event.preventDefault(); event.stopPropagation(); onMove(instance.id, { xM: instance.pose.xM + delta.xM, yM: instance.pose.yM + delta.yM }); }
              }}>
              <rect className="equipment-backdrop" {...bounds} rx=".008" />{buoyancyOutcome && [BUOY_BODY, OVERFLOW, BUOY_BEAKER].includes(instance.type) ? <BuoyancyGraphic item={instance} outcome={buoyancyOutcome} /> : definition.domain === 'mechanical' ? <MechanicalGraphic onPendulumSelect={(id, additive) => onSelect({ kind: 'equipment', id }, additive)} pendulumAngle={pendulumAngle} timerValueS={pendulumTimeS} onPendulumAngle={onPendulumAngle} cartRun={cartRun} densityOutcome={densityOutcome} densityControls={hasDensityControls ? {
                onAdjustStart: (key, event) => {
                  if (!event.isPrimary || event.button !== 0) return;
                  if (key === 'zeroTrimKg' && (!densityOutcome?.weighing.ok || !densityOutcome.weighing.canZero)) {
                    onNotice('先清空两盘并将游码归零，才能调节螺母。');
                    return;
                  }
                  onSelect({ kind: 'equipment', id: instance.id });
                  capture(event, { kind: 'balance-adjust', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
                    view: { ...view }, id: instance.id, pose: { ...instance.pose }, key, value: Number(instance.parameters[key]),
                    startXM: rheostatLocalXM(pointerPoint(event.clientX, event.clientY), instance.pose) });
                },
                onAdjust: (key, value) => {
                  if (value !== Number(instance.parameters[key])) onDensityAdjust(instance.id, key, value);
                },
                onWeight: index => onDensityWeight(instance.id, index),
              } : undefined} projectileFlight={projectileFlight} springOutcome={springOutcome} instance={instance} outcome={leverOutcome} pixelsPerM={view.pixelsPerM} showWeightLabel={false} buoyancyReading={buoyancyOutcome && instance.id === buoyancyOutcome.meter?.id ? buoyancyOutcome.meterReading : undefined} frictionReading={frictionSample?.ok && instance.id === frictionSample.rig.meter.id ? { forceN: frictionSample.state.timeS === 0 ? 0 : Math.abs(frictionSample.forces.pullN), status: frictionSample.state.timeS === 0 ? 'disconnected' : frictionSample.reading.status } : undefined} /> : mirrorImageOutcome && mirrorImageApparatus.includes(instance.type) ? <MirrorImageGraphic item={instance} pixelsPerM={view.pixelsPerM} /> : definition.domain === 'optical' ? <OpticalGraphic instance={instance} pixelsPerM={view.pixelsPerM} benchYM={equipment.find(item => item.type === BENCH)?.pose.yM ?? 0} /> : <EquipmentGraphic instance={instance}
                branchValue={outcome?.result.ok ? outcome.result.solution.branches.find(branch => branch.id === instance.id) : undefined}
                meter={outcome?.meters.find(item => item.id === instance.id)} onToggleSwitch={() => onToggleSwitch(instance.id)}
                onWiperPointerDown={instance.type === RHEOSTAT ? event => {
                  if (!event.isPrimary || event.button !== 0) return;
                  if (start || activeWireEnd) { event.stopPropagation(); onNotice('请连接到 A/B/C/D 接线柱；按 Escape 可取消接线后调节滑片。'); return; }
                  onSelect({ kind: 'equipment', id: instance.id });
                  capture(event, { kind: 'rheostat', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view },
                    id: instance.id, pose: { ...instance.pose }, grabOffsetXM: rheostatLocalXM(pointerPoint(event.clientX, event.clientY), instance.pose) - rheostatWiperXM(Number(instance.parameters.position)), lastPreviewAt: -Infinity });
                } : undefined}
                onWiperKeyDown={instance.type === RHEOSTAT ? event => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault(); event.stopPropagation();
                  const position = Number(instance.parameters.position), step = event.shiftKey ? .1 : .01;
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : Math.max(0, Math.min(1, position + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step)));
                  onSelect({ kind: 'equipment', id: instance.id }); onRheostatChange(instance.id, Number(next.toFixed(10)));
                } : undefined} />}
            </g>
            <text className="equipment-caption" data-friction-caption={frictionCaption ? instance.type : undefined} x={buoyCaption?.x ?? mirrorCaption?.x ?? cartCaption?.x ?? densityCaption?.x ?? reflectionCaption?.x ?? projectileCaption?.x ?? springCaption?.x ?? frictionCaption?.x ?? (instance.type === WEIGHT ? screen.x + .03 * view.pixelsPerM + 6 : screen.x)} y={buoyCaption?.y ?? mirrorCaption?.y ?? cartCaption?.y ?? densityCaption?.y ?? reflectionCaption?.y ?? projectileCaption?.y ?? springCaption?.y ?? frictionCaption?.y ?? (instance.type === WEIGHT ? screen.y + .046 * view.pixelsPerM : definition.domain === 'mechanical' ? screen.y + (bounds.y + bounds.height) * view.pixelsPerM + 18 : definition.domain === 'optical' && ![BENCH, 'optical.ruler'].includes(instance.type) ? worldToScreen({ xM: instance.pose.xM, yM: equipment.find(item => item.type === BENCH)?.pose.yM ?? 0 }, view, size).y + (instance.type === 'optical.candle' ? 34 : instance.type === 'optical.convex-lens' ? 48 : 62) : screen.y + Math.max(0.09 * view.pixelsPerM, 40))} textAnchor={buoyCaption?.anchor ?? cartCaption?.anchor ?? densityCaption?.anchor ?? reflectionCaption?.anchor ?? projectileCaption?.anchor ?? springCaption?.anchor ?? (instance.type === WEIGHT ? 'start' : 'middle')}>{buoyancyOutcome && instance.type === BUOY_BEAKER ? isReceiver(instance) ? '接液杯' : '盛液烧杯' : mirrorImageOutcome && instance.type === MIRROR ? '薄玻璃板' : mirrorImageOutcome && instance.type === 'optical.ruler' ? 'cm · 1 cm/格' : projectileMode && instance.type === PROJECTILE_BALL && projectileFlight ? '' : equipmentLabel(scene, registry, instance.id)}{instance.type === WEIGHT ? ` · ${Number(instance.parameters.massKg)} kg` : ''}</text>
            {definition.ports.map((port, portIndex) => {
              const endpoint = { equipmentId: instance.id, portId: port.id };
              const point = worldToScreen(endpointWorld(endpoint, equipment, registry), view, size);
              const active = Boolean(start && endpointKey(start) === endpointKey(endpoint)) || Boolean(snapPort && endpointKey(snapPort) === endpointKey(endpoint));
              return <g key={port.id} id={`${wireLayerId}-post-${equipmentIndex}-${portIndex}`} data-port-id={port.id} className={`equipment-port ${active ? 'is-active' : ''}`} role="button" tabIndex={0}
                aria-label={endpointLabel(scene, registry, endpoint)} aria-pressed={Boolean(active)} transform={`translate(${point.x} ${point.y})`}
                onPointerDown={event => {
                  event.stopPropagation();
                  skipClick.current = false;
                  if (event.pointerType !== 'mouse') capture(event, { kind: 'tap', endpoint, dragged: false, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view } });
                }} onClick={event => {
                  event.stopPropagation();
                  if (skipClick.current) { skipClick.current = false; return; }
                  onPort(endpoint);
                }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onPort(endpoint); } }}>
                <title>{endpointLabel(scene, registry, endpoint)}</title><circle className="port-hit" r={definition.ports.length === 1 ? 22 : Math.min(22, view.pixelsPerM * (instance.type === SWITCH ? .045 : definition.ports.length >= 3 ? .03 : .07))} />
                <circle className="terminal-base" r={definition.ports.length === 4 ? Math.min(8, view.pixelsPerM * .027) : 8} pointerEvents="none" fill={port.id === 'positive' || port.id === 'low' || port.id === 'high' ? '#ad493b' : port.id === 'negative' || port.id === 'common' ? '#33434a' : '#776141'} />
                <circle className="port-dot" r={definition.ports.length === 4 ? Math.min(5, view.pixelsPerM * .017) : 5} pointerEvents="none" /><path d="M-3 0H3" stroke="#766339" strokeWidth="1.3" pointerEvents="none" />
              </g>;
            })}
          </g>;
        })}
        {reflectionOutcome && <ReflectionRays outcome={reflectionOutcome} view={view} size={size} />}
        {scene.connections.map((wire, index) => {
          const base = wirePreview?.id === wire.id ? wirePreview : wire;
          const displayed = routePreview?.id === wire.id ? { ...base, routeWorldM: routePreview.points } : base;
          const points = wireWorldPoints(displayed, equipment, registry).map(point => worldToScreen(point, view, size));
          const controlPoints = points.map(point => `${point.x},${point.y}`).join(' ');
          const path = curvedWirePath(points);
          const selected = selection?.kind === 'connection' && selection.id === wire.id;
          return <g key={wire.id} data-wire-id={wire.id} data-from={endpointKey(wire.from)} data-to={endpointKey(wire.to)}>
            <path className="wire-shadow" d={path} fill="none" stroke="#18342c" strokeWidth="8" opacity=".16" transform="translate(0 2)" />
            <path className={`wire-line ${selected ? 'is-selected' : ''}`} d={path} data-points={controlPoints} fill="none" stroke={wireColor} />
            <path className="wire-sheen" d={path} fill="none" stroke="white" strokeWidth="1.4" opacity=".27" transform="translate(-.8 -.8)" />
            <path className="wire-hit" d={path} clipPath={`url(#${wireLayerId}-wire-hit)`} fill="none" role="button" tabIndex={0} aria-label={`选择导线 ${index + 1}`}
              onPointerDown={event => {
                event.stopPropagation(); touchClickTarget.current = null;
                onSelect({ kind: 'connection', id: wire.id });
                const pointer = pointerPoint(event.clientX, event.clientY);
                const loose = !wire.from && !wire.to;
                const shape = !loose && !(wire.routeWorldM?.length) ? { ...wire, routeWorldM: [{ x: pointer.xM, y: pointer.yM }] } : wire;
                let bendIndex = loose ? -1 : 0;
                if (!loose) shape.routeWorldM!.forEach((point, index) => {
                  const best = shape.routeWorldM![bendIndex]!;
                  if (Math.hypot(point.x - pointer.xM, point.y - pointer.yM) < Math.hypot(best.x - pointer.xM, best.y - pointer.yM)) bendIndex = index;
                });
                capture(event, { kind: 'wire-body', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view }, wire: shape, pointer, bendIndex });
              }}
              onPointerUp={event => {
                event.stopPropagation();
                if (event.isPrimary && event.pointerType !== 'mouse') {
                  touchClickTarget.current = wire.id;
                  onSelect({ kind: 'connection', id: wire.id });
                }
              }} onClick={event => {
                event.stopPropagation();
                if (touchClickTarget.current === wire.id && event.detail !== 0) { touchClickTarget.current = null; return; }
                onSelect({ kind: 'connection', id: wire.id });
              }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect({ kind: 'connection', id: wire.id }); } }} />
          </g>;
        })}
        <g aria-hidden="true" pointerEvents="none">{equipment.flatMap((instance, equipmentIndex) =>
          registry.get(instance.type, instance.definitionVersion)!.ports.map((port, portIndex) =>
            <use key={`${instance.id}:${port.id}`} href={`#${wireLayerId}-post-${equipmentIndex}-${portIndex}`} />))}</g>
        {scene.connections.map(wire => bendControls(wire))}
        {scene.connections.map((wire, index) => {
          const displayed = wirePreview?.id === wire.id ? wirePreview : wire;
          const points = wireWorldPoints(displayed, equipment, registry).map(point => worldToScreen(point, view, size));
          const selected = selection?.kind === 'connection' && selection.id === wire.id;
          return <g key={wire.id} data-wire-end-of={wire.id}>{(['from', 'to'] as const).map((side, endIndex) => {
            if (displayed[side] && !selected) return null;
            const owner = displayed[side] ? equipment.find(item => item.id === displayed[side]!.equipmentId) : null;
            const compactEnd = owner && registry.get(owner.type, owner.definitionVersion)!.ports.length >= 3;
            const point = endIndex === 0 ? points[0]! : points[points.length - 1]!;
            const neighbour = endIndex === 0 ? points[1]! : points[points.length - 2]!;
            const angle = Math.atan2(point.y - neighbour.y, point.x - neighbour.x) * 180 / Math.PI;
            return <g key={side} className={`wire-end ${displayed[side] ? 'is-attached' : ''}`} role="button" tabIndex={0}
              data-wire-end={side} data-attached={Boolean(displayed[side])} aria-label={`导线 ${index + 1} 线头 ${endIndex === 0 ? 'A' : 'B'}`}
              transform={`translate(${point.x} ${point.y})`}
              onPointerDown={event => {
                onWireEnd({ wireId: wire.id, side });
                capture(event, { kind: 'wire-end', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, view: { ...view }, wire, side });
              }} onClick={event => event.stopPropagation()}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onWireEnd({ wireId: wire.id, side }); }
              }}>
              <title>{`导线 ${index + 1} 线头 ${endIndex === 0 ? 'A' : 'B'}（${displayed[side] ? '已连接' : '自由线头'}）`}</title>
              <circle className="wire-end-hit" r={compactEnd ? Math.min(18, view.pixelsPerM * .03) : 18} fill="transparent" />
              <g transform={`rotate(${angle})`} pointerEvents="none"><rect x="-15" y="-5" width="12" height="10" rx="3" fill={wireColor} /><rect x="-5" y="-2.5" width="8" height="5" rx="1" fill="url(#wire-plug-metal)" /></g>
              {selected && !displayed[side] && <g data-wire-end-label={side} transform="translate(0 -26)" pointerEvents="none"><rect x="-22" y="-8" width="44" height="16" rx="4" fill="#fff" stroke="#b7c9c0" strokeWidth="1" /><text y="4" textAnchor="middle" fontSize="10" fill="#3e625a">线头 {endIndex === 0 ? 'A' : 'B'}</text></g>}
            </g>;
          })}</g>;
        })}
        <g className="selection-overlay" pointerEvents="none" aria-hidden="true">{equipment.filter(instance => equipmentSelectionIds(selection).includes(instance.id)).map(instance => {
          const definition = registry.get(instance.type, instance.definitionVersion)!, screen = worldToScreen(instance.pose, view, size);
          const bounds = definition.domain === 'mechanical' ? buoyancyOutcome && [BUOY_BODY, OVERFLOW, BUOY_BEAKER].includes(instance.type) ? buoyancyBounds(instance) : mechanicalBounds(instance, springOutcome) : definition.domain === 'optical' ? mirrorImageOutcome && mirrorImageApparatus.includes(instance.type) ? mirrorImageBounds(instance) : opticalBounds(instance) : { x: -.088, y: -.06, width: .176, height: .12 };
          const padding = 7 / view.pixelsPerM;
          return <g key={instance.id} data-selection-outline={instance.id} transform={`translate(${screen.x} ${screen.y}) rotate(${-instance.pose.rotationRad * 180 / Math.PI}) scale(${view.pixelsPerM * (instance.pose.flippedX ? -1 : 1)} ${view.pixelsPerM})`}><rect x={bounds.x - padding} y={bounds.y - padding} width={bounds.width + 2 * padding} height={bounds.height + 2 * padding} rx={4 / view.pixelsPerM} fill="none" stroke="#167e6a" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /></g>;
        })}</g>
      </svg>
      {trendAngle !== 0 && <div className="lever-trend-banner" data-testid="lever-trend-banner">失衡：{trendAngle > 0 ? '左端下沉' : '右端下沉'}（转动趋势示意）。虚线为原位置，倾斜角不用于读尺。</div>}
      {scene.equipment.length === 0 && scene.connections.length === 0 && <div className="surface-empty empty-overlay"><h3>从一个问题，开始实验</h3>{pendulumTimeS !== undefined ? <p>放置支架、单摆、刻度尺和计时器。<br />单摆挂到支架，量悬点到球心的距离后多周期计时。</p> : buoyancyOutcome ? <p>放置支架、测力计、带吊环圆柱体和盛液容器。<br />验证排液时再添加溢水杯、接液杯、天平与量筒。</p> : cartMode ? <p>放置水平轨道、小车和计时器材。<br />将小车和光电门放到轨道上，再释放小车。</p> : densityOutcome ? <p>放置托盘天平、量筒、砝码盒和本方法所需的待测样品。<br />先调零、称量，再排水或倒液读体积。</p> : mirrorImageOutcome ? <p>放置平面镜、成像标记物和观察眼。<br />添加镜后对照物、刻度尺和光屏进行测量。</p> : reflectionOutcome ? <p>放置平面镜、窄光束光源、可折纸板、量角器与法线。<br />独立摆放并校准，斜入射后折板观察共面现象。</p> : projectileMode ? <p>放置水平发射器、小球、二维标尺、计时器与地面。<br />自行调平、测高度，发射后暂停或步进读数。</p> : springOutcome ? <p>放置弹簧、支架、钩码和独立刻度尺。<br />先无载读原长，再加载、卸载复测。</p> : frictionSample ? <p>放置接触面、木块、牵引器与测力计。<br />在装配区连接，等待滑动稳态后读数。</p> : leverOutcome ? <p>放置支架、杠杆、钩码和测力计。<br />先空载调平，再挂接和测量；独立尺可单独摆放。</p> : opticalOutcome ? <p>拖入光具座、蜡烛、透镜、光屏与独立尺。<br />独立摆放、调高，再移动光屏找像。</p> : <p>拖入电池盒、电阻、开关与导线。<br />将导线线头接到器材的接线柱上。</p>}<span className="empty-state-label">当前装置为空</span></div>}
      {(placing || start || activeWireEnd) && <div className="canvas-prompt">{placing ? `待放置：${placing === WIRE ? '导线' : registry.list().find(item => item.type === placing)?.label}` : activeWireEnd ? `待连接：线头 ${activeWireEnd.side === 'from' ? 'A' : 'B'}，请拖到或点击接线柱` : `接线起点：${endpointLabel(scene, registry, start!)}`}<button onClick={onCancel}>取消</button></div>}
      <span className="coordinate-label" aria-hidden="true">世界坐标：x 向右 · y 向上</span>
    </div>
    <div className="bench-footer"><span><span className="status-dot" />{calculationStatus}</span><span>长度单位 m</span></div>
  </section>;
}

function wireHitClipPath(width: number, height: number, regions: number[][]): string {
  const xs = [...new Set(regions.flatMap(region => [region[0]!, region[2]!]))].sort((a, b) => a - b);
  let path = `M0 0H${width}V${height}H0Z`;
  for (let index = 1; index < xs.length; index++) {
    const left = xs[index - 1]!, right = xs[index]!;
    const intervals = regions.filter(region => region[0]! < right && region[2]! > left).map(region => [region[1]!, region[3]!]).sort((a, b) => a[0]! - b[0]!);
    const merged: number[][] = [];
    for (const interval of intervals) {
      const last = merged.at(-1);
      if (last && interval[0]! <= last[1]!) last[1] = Math.max(last[1]!, interval[1]!);
      else merged.push([...interval]);
    }
    for (const [top, bottom] of merged) path += `M${left} ${top}H${right}V${bottom}H${left}Z`;
  }
  return path;
}
