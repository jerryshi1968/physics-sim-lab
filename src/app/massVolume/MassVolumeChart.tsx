import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { massVolumeProfile } from '../../equipment/massVolume/measure.ts';
import { MeasurementChart } from '../measurements/MeasurementChart.tsx';
export function MassVolumeChart({ scene }: { scene: SceneDocument }) {
  const [origin, setOrigin] = useState(false);
  return <><label className="checkbox-field"><input type="checkbox" checked={origin} onChange={e => setOrigin(e.target.checked)} />显示原点参照（理论点，不是实测）</label><MeasurementChart scene={scene} profiles={[{ ...massVolumeProfile, referenceOrigin: origin }]} /><p>横轴为体积 V，纵轴为质量 m。只使用已成组的手工读数，不画理论关系线，不自动填写结论。</p></>;
}
