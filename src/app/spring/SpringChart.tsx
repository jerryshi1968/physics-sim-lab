import type { SceneDocument } from '../../core/scene/schema.ts';
import { springFits, springProfiles } from '../../equipment/spring/measure.ts';
import { MeasurementChart } from '../measurements/MeasurementChart.tsx';
export function SpringChart({ scene }: { scene: SceneDocument }) {
  const fits = springFits(scene);
  return <div><MeasurementChart scene={scene} profiles={springProfiles} /><div className="spring-fits"><h3>由记录拟合劲度系数</h3><p>使用同组有效记录的 Δx、F 作普通最小二乘 F=kΔx+b，不强迫过原点；至少五个不同形变量。重复卸载点参与拟合但不补足不同工作点；不混用不同弹簧配置。</p>
    {fits.map(series => <div key={series.id}><h4>{series.label}</h4>{series.fit ? <p data-testid="spring-fit" data-slope={series.fit.slope}>k={Number(series.fit.slope.toPrecision(8))} N/m；截距 b={Number(series.fit.intercept.toPrecision(6))} N；R²={Number(series.fit.rSquared.toPrecision(6))}；{series.fit.count} 个有效点 / {series.fit.distinct} 个不同形变量</p> : <p>{series.mixed ? '同组弹簧配置发生变化，请分组后拟合。' : `当前 ${series.validCount} 个有效点；至少需要五个不同形变量。`}</p>}</div>)}
  </div></div>;
}
