import { lampCircuitQuestions, lampCircuitSteps, lampCircuitHints } from '../../experiments/lamp-circuits.ts';

export function LampCircuitGuide({ onRecord }: { onRecord: () => void }) {
  return <details className="experiment-guide" data-testid="lamp-circuit-guide">
    <summary>实验指导：灯泡串并联</summary>
    <p>自主搭建、测量，再用不同灯泡对照。此指导不检查答案，也不会修改器材、接线、电源或量程；模板名称不决定实际接法。</p>
    <h3>探究问题</h3><ol>{lampCircuitQuestions.map(question => <li key={question}>{question}</li>)}</ol>
    <details><summary>步骤建议</summary><ol>{lampCircuitSteps.map(step => <li key={step}>{step}</li>)}</ol></details>
    <details><summary>空白测量安排</summary>
      <p>每种接法至少比较相同与不同灯泡。下表用于规划测点；实际数值在记录表抄写或采集，留空不补数。</p>
      <div className="experiment-plan-scroll" tabIndex={0} role="region" aria-label="空白测量安排，可横向滚动"><table><caption>电流单位 A，电压单位 V；另记录电源设置、灯泡参数、量程和状态</caption>
        <thead><tr>{['接法', '灯泡组合', 'I总', 'I₁', 'I₂', 'U总', 'U₁', 'U₂'].map(item => <th key={item} scope="col">{item}</th>)}</tr></thead>
        <tbody>{['串联', '并联'].flatMap(wiring => ['相同', '不同'].map(lamps => <tr key={`${wiring}-${lamps}`}><th scope="row">{wiring}</th><td>{lamps}</td>{Array.from({ length: 6 }, (_, index) => <td key={index}>待测</td>)}</tr>))}</tbody>
      </table></div>
      <button onClick={onRecord}>前往记录表</button>
    </details>
    <h3>需要时再展开提示</h3>{lampCircuitHints.map(hint => <details key={hint.title}><summary>{hint.title}</summary><p>{hint.text}</p></details>)}
    <p className="experiment-guide-note">亮度仅辅助观察；手工抄表、仪表示数和模型真值分别保存。模型不模拟真实烧毁。教材版次、章节、页码待教师核验。</p>
  </details>;
}
