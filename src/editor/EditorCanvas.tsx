import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { ElFuegoProject, SceneObjectBase, Transform2D } from '../types/project';

const symbols: Record<string,string>={
  'player-spawn':'🔥',finish:'🏁',checkpoint:'⚑',platform:'▬',wall:'▮','drop-zone':'⌄','no-collision-zone':'◇','pickup-health':'♥','pickup-attack':'⚔','pickup-defense':'◆','enemy-cactus':'🌵',boss:'♛',decoration:'◆',obstacle:'▰',trigger:'◎','dialogue-zone':'💬',collectible:'✦'
};
type ResizeHandle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
type Interaction={objectId:string;objectIds:string[];mode:'move'|ResizeHandle;pointerId:number;startX:number;startY:number;startTransforms:Record<string,Transform2D>;beforeProject:ElFuegoProject};
const handles:ResizeHandle[]=['n','s','e','w','ne','nw','se','sw'];
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));

export function EditorCanvas(){
  const {project,selectedSceneId,selectedObjectId,selectedObjectIds,selectObject,zoom,setZoom,gridEnabled,previewObjectTransforms,commitTransformPreview,cancelTransformPreview}=useEditorStore();
  const assets=useAssetStore(state=>state.assets);
  const [interaction,setInteraction]=useState<Interaction|null>(null);
  const [guides,setGuides]=useState({vertical:false,horizontal:false});
  const [backgroundUrl,setBackgroundUrl]=useState<string|null>(null);
  const scene=project.scenes.find(item=>item.id===selectedSceneId)??project.scenes[0];
  const background=assets.find(asset=>asset.id===scene.backgroundAssetId);

  useEffect(()=>{if(!background){setBackgroundUrl(null);return;}const url=URL.createObjectURL(background.blob);setBackgroundUrl(url);return()=>URL.revokeObjectURL(url);},[background]);
  const snap=(value:number)=>project.settings.snapEnabled?Math.round(value/project.settings.gridSize)*project.settings.gridSize:Math.round(value);

  const startInteraction=(event:ReactPointerEvent<HTMLElement>,object:SceneObjectBase,mode:'move'|ResizeHandle)=>{
    event.preventDefault();event.stopPropagation();const additive=event.ctrlKey||event.metaKey||event.shiftKey;
    if(additive&&mode==='move'){selectObject(object.id,true);return;}if(object.locked){selectObject(object.id);return;}
    const ids=mode==='move'&&selectedObjectIds.includes(object.id)&&selectedObjectIds.length>1?selectedObjectIds:[object.id];
    if(!selectedObjectIds.includes(object.id))selectObject(object.id);
    const startTransforms=Object.fromEntries(scene.objects.filter(item=>ids.includes(item.id)).map(item=>[item.id,{...item.transform}]));
    event.currentTarget.setPointerCapture(event.pointerId);setInteraction({objectId:object.id,objectIds:ids,mode,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startTransforms,beforeProject:structuredClone(project)});
  };
  const updateInteraction=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!interaction||event.pointerId!==interaction.pointerId)return;let dx=(event.clientX-interaction.startX)/zoom,dy=(event.clientY-interaction.startY)/zoom;const primary=interaction.startTransforms[interaction.objectId];if(!primary)return;const next:Record<string,Transform2D>={};
    if(interaction.mode==='move'){
      const starts=Object.values(interaction.startTransforms);dx=clamp(dx,Math.max(...starts.map(t=>-t.x)),Math.min(...starts.map(t=>scene.width-t.x-t.width)));dy=clamp(dy,Math.max(...starts.map(t=>-t.y)),Math.min(...starts.map(t=>scene.height-t.y-t.height)));
      dx=snap(primary.x+dx)-primary.x;dy=snap(primary.y+dy)-primary.y;for(const [id,t] of Object.entries(interaction.startTransforms))next[id]={...t,x:t.x+dx,y:t.y+dy};const p=next[interaction.objectId];setGuides({vertical:Math.abs(p.x+p.width/2-scene.width/2)<=8/zoom,horizontal:Math.abs(p.y+p.height/2-scene.height/2)<=8/zoom});
    }else{
      const t={...primary},mode=interaction.mode,min=32;if(mode.includes('e'))t.width=snap(clamp(primary.width+dx,min,scene.width-primary.x));if(mode.includes('s'))t.height=snap(clamp(primary.height+dy,min,scene.height-primary.y));if(mode.includes('w')){const right=primary.x+primary.width;t.x=snap(clamp(primary.x+dx,0,right-min));t.width=snap(Math.max(min,right-t.x));}if(mode.includes('n')){const bottom=primary.y+primary.height;t.y=snap(clamp(primary.y+dy,0,bottom-min));t.height=snap(Math.max(min,bottom-t.y));}next[interaction.objectId]=t;setGuides({vertical:false,horizontal:false});
    }
    previewObjectTransforms(next);
  };
  const finish=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!interaction||event.pointerId!==interaction.pointerId)return;commitTransformPreview(interaction.beforeProject);setInteraction(null);setGuides({vertical:false,horizontal:false});};
  const cancel=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!interaction||event.pointerId!==interaction.pointerId)return;cancelTransformPreview(interaction.beforeProject);setInteraction(null);setGuides({vertical:false,horizontal:false});};

  return <section className={`canvas-area ${gridEnabled?'grid-enabled':''}`} onClick={()=>selectObject(null)}>
    <div className="canvas-scroll"><div className={`scene-canvas ${interaction?'is-transforming':''}`} style={{width:scene.width*zoom,height:scene.height*zoom}} onPointerMove={updateInteraction} onPointerUp={finish} onPointerCancel={cancel}>
      {backgroundUrl&&<img className="scene-background" src={backgroundUrl} alt="" draggable={false}/>}<div className="scene-canvas-label"><strong>{scene.name}</strong><span>{scene.width} × {scene.height}</span></div>
      {guides.vertical&&<div className="alignment-guide vertical"/>}{guides.horizontal&&<div className="alignment-guide horizontal"/>}
      {!backgroundUrl&&scene.objects.length===0&&<div className="empty-scene"><span>Área vazia</span><small>Importe um cenário ou adicione objetos.</small></div>}
      {scene.objects.filter(object=>object.visible).map(object=>{const selected=selectedObjectIds.includes(object.id),primary=selectedObjectId===object.id;return <div key={object.id} className={`canvas-object object-${object.type} ${selected?'selected':''} ${primary?'primary-selected':''} ${object.locked?'locked':''}`} style={{left:object.transform.x*zoom,top:object.transform.y*zoom,width:object.transform.width*zoom,height:object.transform.height*zoom,transform:`rotate(${object.transform.rotation}deg)`}} onPointerDown={event=>startInteraction(event,object,'move')} onClick={event=>event.stopPropagation()} title={object.name} role="button" tabIndex={0}>
        <span className="object-symbol">{symbols[object.type]??'■'}</span><small>{object.name}</small>{primary&&selectedObjectIds.length===1&&!object.locked&&handles.map(handle=><span key={handle} className={`resize-handle handle-${handle}`} onPointerDown={event=>startInteraction(event,object,handle)}/>)}{primary&&<span className="object-size">{selectedObjectIds.length>1?`${selectedObjectIds.length} objetos`:`${Math.round(object.transform.width)} × ${Math.round(object.transform.height)}`}</span>}
      </div>;})}
    </div></div>
    <div className="zoom-control"><button onClick={()=>setZoom(zoom-.1)}>−</button><input aria-label="Zoom" type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/><button onClick={()=>setZoom(zoom+.1)}>＋</button></div>
  </section>;
}