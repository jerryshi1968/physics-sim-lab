import { useState } from 'react';

export function ReflectionOrbit({degrees,onOrbit}:{degrees:number;onOrbit:(value:number)=>void}){
  const [draft,setDraft]=useState<{raw:string;applied:number}|null>(null),current=Number(degrees.toFixed(4));
  const active=draft?.applied===current?draft:null,raw=active?.raw??String(current),value=Number(raw);
  const invalid=raw.trim()===''||!Number.isFinite(value)||value<5||value>175;
  return <label>绕镜面中心转动光源（方位角 °）<input aria-label="光源圆周方位角（°）" aria-invalid={invalid} type="number" min="5" max="175" step="5" value={raw}
    onChange={event=>{const raw=event.currentTarget.value,value=event.currentTarget.valueAsNumber,valid=raw.trim()!==''&&Number.isFinite(value)&&value>=5&&value<=175;setDraft({raw,applied:valid?Number(value.toFixed(4)):current});if(valid)onOrbit(value);}}
    onBlur={()=>setDraft(null)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDraft(null);}}}/>
    <span role={invalid?'status':undefined}>{invalid?'方位角限 5～175°；未完成或无效输入未应用，失焦或 Esc 恢复。':'此控件明确移动并转动光源、瞄准镜面中心，不移动其他器材，也不填写记录。'}</span>
  </label>;
}
