import { useEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { chartSegments, measurementChartProfiles, measurementSeries, normalizedChartPosition } from '../../core/measurements/charts.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';

const colors = ['#126c63', '#b56524', '#4d71ab', '#986492', '#a34343', '#657c30'];
export function MeasurementChart({ scene, profiles = measurementChartProfiles }: { scene: SceneDocument; profiles?: readonly MeasurementChartProfile[] | undefined }) {
  const [profileId, setProfileId] = useState(profiles[0]!.id);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(Math.max(300, Math.round(measured)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const profile = profiles.find(item => item.id === profileId) ?? profiles[0]!;
  const series = measurementSeries(scene, profile);
  const points = series.flatMap(group => group.points).filter(point => point.y !== null);
  const xValues = series.flatMap(group => group.points).map(point => point.x);
  const xmin = profile.x === 'sample' ? Math.min(1, ...xValues) : Math.min(0, ...xValues), xmax = Math.max(xmin + (profile.x === 'sample' ? 1 : 1e-9), ...xValues);
  const ymin = Math.min(0, ...points.map(point => point.y!)), ymax = Math.max(ymin + 1e-9, ...points.map(point => point.y!));
  const top = 30, bottom = 204, left = 58, right = width - 24;
  const sx = (value: number) => left + normalizedChartPosition(value, xmin, xmax) * (right - left);
  const sy = (value: number) => bottom - normalizedChartPosition(value, ymin, ymax) * (bottom - top);
  return <div ref={container} className="measurement-chart">
    <label>图线类型<select aria-label="图线类型" value={profile.id} onChange={event => setProfileId(event.target.value)}>{profiles.map(item => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}</option>)}</select></label>
    {!points.length ? <div className="measurement-empty"><h3>暂无可绘制的数据</h3><p>请记录对应物理量；缺失、反偏、超量程和其他无效记录不绘制为有效点。</p></div> : <>
      <svg viewBox={`0 0 ${width} 260`} role="img" aria-label={profile.label} data-testid="measurement-chart">
        <text x={left} y="18" fontSize="12" fill="#344d50">{profile.y.label}</text>
        {Array.from({ length: 5 }, (_, index) => {
          const value = ymin * (1 - index / 4) + ymax * (index / 4), y = sy(value);
          return <g key={index}><line x1={left} x2={right} y1={y} y2={y} stroke="#dfe8e3" /><text x={left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#526a65">{Number(value.toPrecision(4))}</text></g>;
        })}
        <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="#6c817b" />
        {Array.from(new Set(xValues)).filter((_, index, values) => values.length <= 12 || index % Math.ceil(values.length / 10) === 0).map(value => <text key={value} x={sx(value)} y={bottom + 18} textAnchor="middle" fontSize="11" fill="#526a65">{profile.x === 'sample' ? value : Number(value.toPrecision(5))}</text>)}
        <text x={(left + right) / 2} y="244" textAnchor="middle" fontSize="12" fill="#344d50">{profile.x === 'sample' ? width < 450 ? '采样组次' : '采样组次（同次多测点共用组次）' : profile.x.label}</text>
        {series.map((group, index) => <g key={group.id} data-chart-series={group.id} stroke={colors[index % colors.length]}>
          {chartSegments(group.points).map((segment, segmentIndex) => <path key={segmentIndex} data-chart-segment={segmentIndex} d={segment.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${sx(point.x)} ${sy(point.y!)}`).join(' ')} fill="none" strokeWidth="1.6" />)}
          {group.points.filter(point => point.y !== null).map(point => <circle key={point.recordId} data-record-id={point.recordId} data-value={point.y} data-sample-index={point.sampleIndex} cx={sx(point.x)} cy={sy(point.y!)} r={3.5 + index % 3} fill="white" strokeWidth="1.6"><title>{`${group.label}；第 ${point.sampleIndex} 组：${point.y} ${profile.y.displayUnit ?? profile.y.unit}；记录 ${point.recordId}`}</title></circle>)}
        </g>)}
      </svg>
      <ul className="chart-legend">{series.map((group, index) => <li key={group.id}><span style={{ background: colors[index % colors.length] }} />{group.label}</li>)}</ul>
      <p>图线只读取记录表中的有效记录值，不采用模型真值；缺失或无效组次断线，不按零值补齐。连线仅辅助比较采样顺序。</p>
    </>}
  </div>;
}
