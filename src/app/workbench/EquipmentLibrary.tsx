import { useRef, useState } from 'react';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { equipmentAvailability, equipmentSupport, equipmentUsage } from '../../equipment/support.ts';
import { JUNCTION, POWER, WIRE } from '../../equipment/electrical/definitions.ts';
import { EquipmentGraphic } from './EquipmentGraphic.tsx';
import { OpticalGraphic } from '../optical/OpticalGraphic.tsx';
import { BENCH, RULER } from '../../equipment/optical/definitions.ts';
import { MechanicalGraphic } from '../mechanical/MechanicalGraphic.tsx';
import { BLOCK, SURFACE, DRIVE, LOAD } from '../../equipment/mechanical/frictionDefinitions.ts';
import { LAUNCHER, BALL, TIMER, SCALE, GROUND } from '../../equipment/projectile/definitions.ts';
import { PENDULUM } from '../../equipment/pendulum/definitions.ts';
import { SPRING } from '../../equipment/spring/definitions.ts';
import { LEVER, SUPPORT, MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';

import { MIRROR, EMITTER, PAPER, PROTRACTOR, NORMAL } from '../../equipment/reflection/definitions.ts';
import { BODY, OVERFLOW } from '../../equipment/buoyancy/definitions.ts';

import { BALANCE, CYLINDER, SPECIMEN, MASS_SET, BEAKER } from '../../equipment/density/definitions.ts';
import { CART, TRACK, GATE, TICKER } from '../../equipment/cart/definitions.ts';

const cartIconViews: Record<string, string> = { [CART]: '-.12 -.17 .24 .19', [TRACK]: '-.92 -.085 1.88 .16', [GATE]: '-.05 -.16 .1 .195', [TICKER]: '-.09 -.05 .18 .105' };

type Domain = 'electrical' | 'optical' | 'mechanical';
const domainLabels = { electrical: '电学', optical: '光学', mechanical: '力学' };

interface Props {
  registry: EquipmentRegistry;
  scene: SceneDocument;
  domain?: Domain;
  mirrorImage?: boolean;
  buoyancy?: boolean;
  locked: boolean;
  onNewDomain: (domain: Domain) => void;
  placing: string | null;
  onChoose: (type: string | null) => void;
  onDrop: (type: string, clientX: number, clientY: number) => void;
  onCenter: () => void;
}

export function EquipmentLibrary({ registry, scene, domain: sceneDomain = 'electrical', mirrorImage = false, buoyancy = false, locked, onNewDomain, placing, onChoose, onDrop, onCenter }: Props) {
  const [domain, setDomain] = useState(sceneDomain);
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const blocked = locked && domain !== sceneDomain;
  const domains = ['electrical', 'optical', 'mechanical'] as const;
  function chooseDomain(value: typeof domain) {
    drag.current = null;
    suppressClick.current = false;
    onChoose(null);
    setDomain(value);
  }
  const catalog = [...registry.list().filter(item => item.type !== JUNCTION && item.domain === domain), ...(domain === 'electrical' ? [{ type: WIRE, label: '导线', domain: 'electrical' }] : [])];
  const support = equipmentSupport(scene);
  if (support) catalog.sort((a, b) => Number(support.types.includes(b.type)) - Number(support.types.includes(a.type)));
  return <section className="panel library" aria-labelledby="library-title">
    <div className="panel-heading"><h2 id="library-title">器材库</h2><span className="count">{catalog.length}</span></div>
    <div className="library-tabs" role="tablist" aria-label="器材分类">
      {domains.map((value, index) => <button key={value} id={`library-tab-${value}`} role="tab" aria-selected={domain === value} aria-controls={`library-panel-${value}`}
        tabIndex={domain === value ? 0 : -1} onClick={() => chooseDomain(value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? domains.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + domains.length) % domains.length;
          chooseDomain(domains[next]!);
          document.getElementById(`library-tab-${domains[next]}`)?.focus();
        }}>{domainLabels[value]}</button>)}
    </div>
    <p className="section-caption">选择后点击放置，也可直接拖入。</p>
    {support && <p className="section-caption" data-testid="equipment-support-note">当前：{support.label}。适用器材排在前面，灰色器材不可添加。</p>}
    {buoyancy && domain === 'mechanical' && <p className="section-caption">测力计挂到支架；烧杯可在属性中选择盛液或接液用途。</p>}
    {mirrorImage && domain === 'optical' && <p className="section-caption">平面镜成像常用器材排在前面。将一把刻度尺设为 90°，可量标记的高度。</p>}
    {blocked && <div className="library-domain-notice"><p>当前为{domainLabels[sceneDomain]}装置，请新建{domainLabels[domain]}实验后使用这些器材。</p><button onClick={() => onNewDomain(domain)}>新建{domainLabels[domain]}实验</button></div>}
    <div className="equipment-catalog" role="tabpanel" id={`library-panel-${domain}`} aria-labelledby={`library-tab-${domain}`}>
      {catalog.map(definition => {
        const available = equipmentAvailability(scene, definition.type), disabled = blocked || !available.enabled;
        const reason = available.reason || (blocked ? '当前实验不支持此学科的器材。' : '');
        return <button key={definition.type} data-library-type={definition.type} disabled={disabled} title={disabled ? reason : equipmentUsage(definition.type)}
        aria-pressed={placing === definition.type} onClick={event => {
          if (disabled) return;
          if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
          suppressClick.current = false;
          onChoose(placing === definition.type ? null : definition.type);
        }} onPointerDown={event => {
          if (disabled) return;
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 6) drag.current.moved = true;
        }} onPointerUp={event => {
          if (disabled) { drag.current = null; suppressClick.current = false; return; }
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const moved = drag.current.moved;
          drag.current = null;
          if (moved) { suppressClick.current = true; onDrop(definition.type, event.clientX, event.clientY); }
          else if (event.pointerType !== 'mouse') {
            suppressClick.current = true;
            onChoose(placing === definition.type ? null : definition.type);
          }
        }} onPointerCancel={() => { drag.current = null; suppressClick.current = false; }}
        onLostPointerCapture={() => { drag.current = null; }}>
        <span className="catalog-symbol" aria-hidden="true">{definition.type === WIRE
          ? <svg viewBox="0 0 48 34" fill="none"><path d="M4 27C10 3 36 3 44 27" stroke="currentColor" strokeWidth="3" /><path d="M3 27l-1 4m42-4 2 4" stroke="#9dada8" strokeWidth="4" /></svg>
          : definition.type === BODY || definition.type === OVERFLOW ? <svg viewBox={definition.type === BODY ? '-.04 -.14 .08 .16' : '-.05 -.18 .18 .2'}><MechanicalGraphic instance={{ id: 'preview', type: definition.type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: registry.get(definition.type, 1)!.defaultParameters }} /></svg> : cartIconViews[definition.type] ? <svg viewBox={cartIconViews[definition.type]}><MechanicalGraphic instance={{ id: 'preview', type: definition.type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: registry.get(definition.type, 1)!.defaultParameters }} /></svg>
          : domain === 'mechanical' ? <svg viewBox={definition.type === PENDULUM ? '-.3 -.04 .6 .62' : definition.type === BALANCE ? '-.25 -.27 .5 .32' : definition.type === CYLINDER ? '-.07 -.27 .15 .3' : definition.type === SPECIMEN ? '-.03 -.15 .06 .17' : definition.type === MASS_SET ? '-.13 -.04 .26 .09' : definition.type === BEAKER ? '-.05 -.12 .1 .14' : definition.type === LAUNCHER ? '-.4 -.16 .5 .4' : definition.type === BALL ? '-.1 -.1 .2 .2' : definition.type === TIMER ? '-.28 -.16 .56 .32' : definition.type === SCALE ? '-.15 -.17 2.2 1.7' : definition.type === GROUND ? '-.05 -.1 3.4 .35' : definition.type === SPRING ? '-.1 -.03 .16 .2' : definition.type === MECHANICAL_RULER ? '-.02 -.04 1.24 .12' : definition.type === SURFACE ? '-1.6 -.04 3.2 .2' : definition.type === BLOCK ? '-.12 -.08 .24 .16' : definition.type === DRIVE || definition.type === LOAD ? '-.08 -.08 .16 .16' : definition.type === LEVER ? '-.4 -.07 .8 .14' : definition.type === SUPPORT ? '-.08 -.36 .16 .4' : '-.06 -.03 .13 .29'}><MechanicalGraphic instance={{ id: 'preview', type: definition.type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: registry.get(definition.type, 1)!.defaultParameters }} /></svg> : domain === 'optical' ? <svg viewBox={definition.type === PAPER ? '-.5 -.64 1 .7' : definition.type === PROTRACTOR ? '-.4 -.4 .8 .44' : definition.type === MIRROR ? '-.5 -.1 1 .2' : definition.type === NORMAL ? '-.1 -.6 .2 .65' : definition.type === EMITTER ? '-.1 -.05 .14 .1' : definition.type === BENCH || definition.type === RULER ? '-.02 -.04 1.24 .12' : '-.06 -.06 .12 .15'}><OpticalGraphic instance={{ id: 'preview', type: definition.type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: registry.get(definition.type, 1)!.defaultParameters }} /></svg> : <svg viewBox="-.1 -.07 .2 .14"><EquipmentGraphic instance={{ id: 'preview', type: definition.type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: registry.get(definition.type, 1)!.defaultParameters }} /></svg>}</span>
        <span>{definition.type === POWER ? '电池盒' : definition.label}<small>{disabled ? reason : equipmentUsage(definition.type)}</small></span>
      </button>;
      })}
    </div>
    {placing && <div className="placement-actions"><p>点击画布放置，或使用下方按钮。</p><button onClick={onCenter}>在视口中心放置</button><button onClick={() => onChoose(null)}>取消放置</button></div>}
    <div className="library-note"><span className="eyebrow">{domain === 'mechanical' ? '调平与挂接' : domain === 'optical' ? '摆放与读尺' : '接线方法'}</span>{domain === 'mechanical' ? <p>密度实验：空载调零，左物右码、平视液面。<br />平抛先调平、将小球装入发射器；弹簧挂到支架，钩码串接；杠杆先调平再挂码，摩擦实验连接水平牵引器材。<br />拖到挂点松手，或在属性区挂接。独立尺可摆放读数。</p> : domain === 'optical' ? <p>透镜实验独立调高、移动光屏找焦。<br />反射实验独立摆放镜、光源、量角器和纸板，校准后自行量角、折板观察。</p> : <p>拖入导线，将线头拖到接线柱。<br />多线可共用同一接线柱。</p>}</div>
  </section>;
}
