import { voltammetryMode } from '../../equipment/electrical/voltammetry.ts';
import { ohmRecordMode } from '../../equipment/electrical/ohm.ts';
import type { ElectricalOutcome } from '../../equipment/electrical/simulate.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';

export function electricalMessage(code: string): string {
  return ({ IDEAL_SOURCE_SHORT: '理想电源被短接，没有有限稳态解。', INCONSISTENT_VOLTAGE_CONSTRAINT: '理想电源或电流表接法冲突，请检查接线。',
    REDUNDANT_IDEAL_SOURCE: '理想源构成冗余回路，支路电流不唯一。', ZERO_RESISTANCE_LOOP: '电流表处于零阻回路，无法确定读数。',
    METER_MULTI_RANGE: '当前多端接法超出首版仪表模型：两个正量程端同时接线，请只使用一个。',
    NON_CONVERGENCE: '灯泡非线性计算未收敛，已停止有效读数。', LAMP_MODEL_RANGE: '灯泡超出电流模型范围，不能给出有效读数。',
    UNDEFINED_VOLTAGE: '探针跨越独立浮置分量，电位差未定义。', NETWORK_TOO_LARGE: '电路规模超过当前求解上限。',
    COMPUTATION_TIMEOUT: '计算超时，已停止任务，请简化电路后重试。', WORKER_UNAVAILABLE: '此浏览器无法启动计算线程。',
    COMPUTATION_FAILED: '计算失败，请点击“重新计算”重试。', NUMERIC_RANGE: '数值超出安全计算范围。',
    ILL_CONDITIONED_MATRIX: '电路数值病态，无法提供可靠读数。', SINGULAR_MATRIX: '电路方程不唯一，请检查接线。',
  } as Record<string, string>)[code] ?? '当前装置未通过模型校验，请检查接线和器材参数。';
}

export function SimulationPanel({ scene, outcome, running, status, onStart, onPause, onReset }: {
  scene: SceneDocument; outcome: ElectricalOutcome | null; running: boolean; status: string;
  onStart: () => void; onPause: () => void; onReset: () => void;
}) {
  const diagnostics = outcome?.result.diagnostics.filter(item => item.severity !== 'info') ?? [];
  return <section className="simulation-panel" aria-label="电学计算与仪表示数">
    <div className="simulation-actions"><button onClick={running ? onPause : onStart}>{running ? '暂停自动更新' : '恢复自动更新'}</button><button onClick={onReset}>重新计算</button></div>
    <p data-testid="calculation-status" aria-live="polite">{status}</p>
    {diagnostics.map((item, index) => <p key={`${item.code}:${index}`} className="simulation-diagnostic" role={item.severity === 'error' ? 'alert' : undefined}>{electricalMessage(item.code)}</p>)}
    {outcome?.meters.map(meter => {
      const index = scene.equipment.findIndex(item => item.id === meter.id) + 1;
      const state = ({ valid: '有效', disconnected: '未完整接线', reverse: '反偏', 'over-range': '超量程', undefined: '电位差未定义', invalid: '接法超出模型' })[meter.status];
      return <div className="instrument-reading" key={meter.id} data-meter-reading={meter.id} data-meter-status={meter.status}>
        <h3>{meter.unit === 'A' ? '电流表' : '电压表'} {index}</h3>
        <p><strong>{meter.displayValue === null ? state : `${meter.displayValue} ${meter.unit}`}</strong>{meter.reverse && meter.overRange ? ' · 反偏' : ''}</p>
        <p>量程：{meter.range ? `0～${meter.maximum} ${meter.unit}` : '未选择端子'} · 分度值 {meter.resolution} {meter.unit}</p>
        <details><summary>查看模型真值</summary><p>{meter.trueValue === null ? '不可用' : `${meter.trueValue} ${meter.unit}`}（未按分度值取整）</p></details>
      </div>;
    })}
    <p className="simulation-model-note">{(ohmRecordMode(scene) || voltammetryMode(scene)) ? '定值电阻保持恒定，不模拟温升；仪表示数按分度值显示，需自行保存实验记录。' : scene.experimentId === 'H-ELEC-01' ? '电源按设置的电动势、内阻供电，电表按器材参数加载；仪表示数不会自动写入学生记录。' : '灯泡为准静态教学模型，不模拟热惯性或真实烧毁；仪表示数不会自动写入学生记录。'}</p>
  </section>;
}
