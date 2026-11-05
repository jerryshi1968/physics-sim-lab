import { useEffect,useRef,useState } from 'react';
export function ReflectionStart({onChoose,onCancel}:{onChoose:(empty:boolean)=>void;onCancel:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[empty,setEmpty]=useState(false);useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="reflection-start-title" onCancel={onCancel}><h2 id="reflection-start-title">光的反射定律实验</h2><p>平面镜、窄光束光源、量角器、法线与可折承接纸板。自行校准、读角，并折动右纸板观察连续光迹。</p><label><input type="radio" name="reflection-start" checked={!empty} onChange={()=>setEmpty(false)}/>一套反射器材</label><label><input type="radio" name="reflection-start" checked={empty} onChange={()=>setEmpty(true)}/>反射空白搭建</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={()=>onChoose(empty)}>预览反射实验</button></div></dialog>;
}
