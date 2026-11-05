import { useEffect,useRef,useState } from 'react';
export function ProjectileStart({onChoose,onCancel}:{onChoose:(empty:boolean)=>void;onCancel:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[empty,setEmpty]=useState(false);useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="projectile-start-title" onCancel={onCancel}><h2 id="projectile-start-title">平抛运动实验</h2><p>高中定量探究：校准水平与高度，发射后暂停或单步，读尺抄录至少三组落地前数据。当前发射初态冻结，修改参数用于下一次；教材具体条目待教师核验。</p><label><input type="radio" name="projectile-start" checked={!empty} onChange={()=>setEmpty(false)}/>一套水平平抛器材</label><label><input type="radio" name="projectile-start" checked={empty} onChange={()=>setEmpty(true)}/>平抛空白搭建</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={()=>onChoose(empty)}>预览平抛实验</button></div></dialog>;
}
