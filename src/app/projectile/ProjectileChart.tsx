import type { SceneDocument } from '../../core/scene/schema.ts';
import { projectileProfiles,projectileFits } from '../../equipment/projectile/measure.ts';
import { MeasurementChart } from '../measurements/MeasurementChart.tsx';
export function ProjectileChart({scene}:{scene:SceneDocument}){
  return <div><MeasurementChart scene={scene} profiles={projectileProfiles}/><section className="projectile-fits"><h3>由记录检验运动规律</h3><p>至少三个不同时间的有效记录，分发射轨迹作普通最小二乘，不强迫过原点。x–t 斜率单位 m/s，ydrop–t² 斜率单位 m/s²；不拿发射初速或 g/2 充当拟合结果。</p>{projectileProfiles.map(profile=><div key={profile.id}><h4>{profile.label}</h4>{projectileFits(scene,profile).map(series=><p key={series.id} data-projectile-fit={profile.id} data-slope={series.fit?.slope}>{series.label}：{series.fit?`斜率 ${Number(series.fit.slope.toPrecision(8))} ${profile.id==='projectile-x-t'?'m/s':'m/s²'}；截距 ${Math.abs(series.fit.intercept)<1e-12?0:Number(series.fit.intercept.toPrecision(6))} m；R²=${Number(series.fit.rSquared.toPrecision(6))}；${series.fit.count} 个有效点`:'至少需要三个不同时间的有效点'}</p>)}</div>)}</section></div>;
}
