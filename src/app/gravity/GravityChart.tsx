import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { gravityProfile } from '../../equipment/gravity/measure.ts';
import { MeasurementChart } from '../measurements/MeasurementChart.tsx';
export function GravityChart({ scene }: { scene: SceneDocument }) {
  const [origin, setOrigin] = useState(false);
  return <><label className="checkbox-field"><input type="checkbox" checked={origin} onChange={e => setOrigin(e.target.checked)} />显示重力图原点参照（不是实测）</label><MeasurementChart scene={scene} profiles={[{ ...gravityProfile, referenceOrigin: origin }]} /><p>横轴为质量 m，纵轴为重力 G；描点连线只使用学生记录，不画理论答案线。</p></>;
}
