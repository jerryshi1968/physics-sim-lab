import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import { EYE, MATCH, TARGET } from '../../equipment/mirrorImage/definitions.ts';
import { mirrorImageRulers, rulerCovers } from '../../equipment/mirrorImage/simulate.ts';
import type { MirrorImageOutcome } from '../../equipment/mirrorImage/simulate.ts';
import { RULER, SCREEN } from '../../equipment/optical/definitions.ts';
import { MIRROR } from '../../equipment/reflection/definitions.ts';

export function mirrorImageBounds(item: EquipmentInstance) {
  const length = Number(item.parameters.lengthM), height = Number(item.parameters.heightM);
  if (item.type === RULER) return { x: -.004, y: -.014, width: length + .008, height: .043 };
  if (item.type === MIRROR) return { x: -.018, y: -length / 2, width: .036, height: length + .022 };
  if (item.type === SCREEN) return { x: -.016, y: -height / 2, width: .032, height: height + .014 };
  if (item.type === EYE) return { x: -.033, y: -.018, width: .063, height: .036 };
  const width = Math.max(.038, height * .31);
  return { x: -width / 2, y: -height / 2, width, height };
}

export function MarkerShape({ height, color, outline = false }: { height: number; color: string; outline?: boolean }) {
  const half = height / 2;
  return <path d={`M0 ${-half} L${height * .155} ${-half * .41} H${height * .059} V${half} H${-height * .059} V${-half * .41} H${-height * .155} Z`}
    fill={outline ? 'none' : color} stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />;
}

export function MirrorImageGraphic({ item, pixelsPerM = 600 }: { item: EquipmentInstance; pixelsPerM?: number }) {
  const { type, parameters } = item, length = Number(parameters.lengthM), height = Number(parameters.heightM);
  const labelEvery = pixelsPerM >= 550 ? 5 : 10;
  return <g className="real-apparatus" data-appearance="physical" data-mirror-image-equipment={type} stroke="none">
    {type === MIRROR && <><rect x="-.012" y={-length / 2} width=".024" height={length} rx=".004" fill="#a8d8df" stroke="#4d8c95" strokeWidth="1.2" /><path d={`M0 ${-length / 2}V${length / 2}`} stroke="#267d90" strokeWidth="1.7" /><rect x="-.019" y={length / 2} width=".038" height=".014" rx=".003" fill="#45636a" /></>}
    {type === SCREEN && <><rect x="-.009" y={-height / 2} width=".018" height={height} rx=".003" fill="#f4edd3" stroke="#756b51" strokeWidth="1.2" /><path d={`M0 ${height / 2}v.014m-.016 0h.032`} stroke="#596969" strokeWidth="2" /></>}
    {type === EYE && <><path d="M-.03 0Q0-.032 .029 0Q0 .032 -.03 0Z" fill="#fffdf4" stroke="#355d69" strokeWidth="1.4" /><circle cx=".009" r=".010" fill="#74a8af" /><circle cx=".009" r=".0045" fill="#203f49" /></>}
    {(type === TARGET || type === MATCH) && <MarkerShape height={height} color={type === TARGET ? '#b8543e' : '#16766e'} />}
    {type === RULER && <>
      <rect x="0" y="-.012" width={length} height=".038" rx=".002" fill="#e8d6a5" stroke="#98875b" strokeWidth=".8" />
      {Array.from({ length: Math.floor(length * 100 + 1e-8) + 1 }, (_, centimetres) => {
        const x = centimetres / 100, major = centimetres % labelEvery === 0;
        const font = 9 / pixelsPerM;
        return <g key={centimetres}><path d={`M${x} 0v${major ? .012 : .006}`} stroke="#716745" strokeWidth=".8" />
          {major && <text x={x} y={.016 + font * .48} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${item.pose.rotationRad * 180 / Math.PI} ${x} ${.016 + font * .48})`} fontSize={font} fill="#464b37">{centimetres}</text>}</g>;
      })}
    </>}
  </g>;
}

export function MirrorImageOverlay({ outcome, equipment, view, size, guides, rays }: {
  outcome: MirrorImageOutcome; equipment: SceneDocument['equipment']; view: NonNullable<SceneDocument['viewport']>; size: { width: number; height: number }; guides: boolean; rays: boolean;
}) {
  if (!outcome.ok) return null;
  const { mirror, eye, object, image, comparison, imageProjection } = outcome;
  const { distance, height } = mirrorImageRulers(equipment);
  const at = (xM: number, yM: number) => worldToScreen({ xM, yM }, view, size);
  const line = (a: { xM: number; yM: number }, b: { xM: number; yM: number }) => {
    const p = at(a.xM, a.yM), q = at(b.xM, b.yM);
    return `M${p.x} ${p.y}L${q.x} ${q.y}`;
  };
  const imageCenter = at(image.bottom.xM, (image.bottom.yM + image.top.yM) / 2);
  return <g pointerEvents="none" aria-hidden="true">
    {guides && distance && [mirror.pose, object.bottom, comparison?.bottom].map((point, index) => point && rulerCovers(distance, [point.xM]) && <path key={index} d={line(point, { xM: point.xM, yM: distance.pose.yM })} stroke="#8a8269" strokeDasharray="3 4" />)}
    {guides && height && [object, comparison].map((segment, index) => segment && <g key={index} stroke={index ? '#569790' : '#b67e6e'} strokeDasharray="3 4">
      {[segment.bottom, segment.top].map((point, endpoint) => rulerCovers(height, [point.yM], true) && <path key={endpoint} d={line(point, { xM: height.pose.xM, yM: point.yM })} />)}
    </g>)}
    {rays && <g data-testid="mirror-image-rays">
      {(['bottom', 'top'] as const).map(key => {
        const hit = imageProjection[key];
        if (hit.yM < outcome.mirrorBottom || hit.yM > outcome.mirrorTop) return null;
        return <g key={key} fill="none" stroke="#b2782e"><path d={line(object[key], hit) + line(hit, eye.pose)} strokeWidth="1.6" /><path d={line(hit, image[key])} strokeDasharray="5 4" /></g>;
      })}
      <g transform={`translate(${imageCenter.x} ${imageCenter.y})`} opacity=".8"><MarkerShape height={outcome.heightM * view.pixelsPerM} color="#aa6e9d" outline /><text x="11" y="-8" fontSize="11" fill="#81507a">虚像</text></g>
    </g>}
  </g>;
}
