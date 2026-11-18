import { useState } from 'react';

export function ReflectionOrbit({degrees,onOrbit,disabled=false}:{degrees:number;onOrbit:(value:number)=>void;disabled?:boolean}){
  const [draft,setDraft]=useState<{raw:string;applied:number}|null>(null),current=Number(degrees.toFixed(4));
  const active=draft?.applied===current?draft:null,raw=active?.raw??String(current),value=Number(raw);
  const invalid=raw.trim()===''||!Number.isFinite(value)||value<5||value>175;
  return <label>绕入射点转动光源（方位角 °）<input aria-label="光源圆周方位角（°）" aria-invalid={invalid} type="number" disabled={disabled} min="5" max="175" step="5" value={raw}
    onChange={event=>{const raw=event.currentTarget.value,value=event.currentTarget.valueAsNumber,valid=raw.trim()!==''&&Number.isFinite(value)&&value>=5&&value<=175;setDraft({raw,applied:valid?Number(value.toFixed(4)):current});if(valid)onOrbit(value);}}
    onBlur={()=>setDraft(null)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDraft(null);}}}/>
    <span role={invalid?'status':undefined}>{invalid?'方位角限 5～175°；未完成或无效输入未应用，失焦或 Esc 恢复。':'此控件保持当前入射点和距离，移动并转动光源；未命中时先移动或调整转角对准镜面。'}</span>
  </label>;
}
