import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';
import { validateProject } from '../validation/validateProject';

export function Inspector(){
  const {project,selectedSceneId,selectedObjectId,renameProject,updateScene,updateObject}=useEditorStore();
  const scene=project.scenes.find(item=>item.id===selectedSceneId)??project.scenes[0];
  const object=scene.objects.find(item=>item.id===selectedObjectId) as any;
  const validation=useMemo(()=>validateProject(project),[project]);
  const numberField=(label:string,key:string,min?:number)=><label>{label}<input type="number" min={min} value={object[key]??0} onChange={event=>updateObject(object.id,{[key]:Number(event.target.value)} as any)}/></label>;
  const transformField=(label:string,key:'x'|'y'|'width'|'height'|'rotation')=><label>{label}<input type="number" value={object.transform[key]} onChange={event=>updateObject(object.id,{transform:{...object.transform,[key]:Number(event.target.value)}})}/></label>;

  return <aside className="panel inspector"><h2>Propriedades</h2><label>Projeto<input value={project.project.name} onChange={event=>renameProject(event.target.value)}/></label>
    {object?<div className="inspector-section"><h3>{object.name}</h3><label>Nome<input value={object.name} onChange={event=>updateObject(object.id,{name:event.target.value})}/></label>
      <div className="field-grid">{transformField('Posição X','x')}{transformField('Posição Y','y')}{transformField('Largura','width')}{transformField('Altura','height')}{transformField('Rotação','rotation')}</div>
      {object.type==='player-spawn'&&<><h3>Player</h3><label>Direção<select value={object.direction} onChange={event=>updateObject(object.id,{direction:event.target.value} as any)}><option value="left">Esquerda</option><option value="right">Direita</option></select></label><div className="field-grid">{numberField('Vida inicial','initialHealth',0)}{numberField('Ataque inicial','initialAttack',0)}{numberField('Defesa inicial','initialDefense',0)}</div></>}
      {object.type==='platform'&&<><h3>Plataforma</h3><label>Colisão<select value={object.collisionType} onChange={event=>updateObject(object.id,{collisionType:event.target.value} as any)}><option value="solid">Sólida</option><option value="one-way">Atravessável</option><option value="none">Sem colisão</option></select></label></>}
      {object.type==='enemy-cactus'&&<><h3>Cacto</h3><label>Direção<select value={object.direction} onChange={event=>updateObject(object.id,{direction:event.target.value} as any)}><option value="left">Esquerda</option><option value="right">Direita</option></select></label><div className="field-grid">{numberField('Limite esquerdo','patrolLeft')}{numberField('Limite direito','patrolRight')}{numberField('Área de visão','visionDistance',0)}{numberField('Vel. andando','walkSpeed',0)}{numberField('Vel. correndo','runSpeed',0)}{numberField('Dist. ataque','attackDistance',0)}{numberField('Dano','damage',0)}{numberField('Intervalo ms','attackCooldownMs',0)}</div></>}
      <dl><div><dt>Tipo</dt><dd>{object.type}</dd></div><div><dt>Asset</dt><dd>{object.assetId?project.assets.find(a=>a.id===object.assetId)?.name??'Ausente':'Nenhum'}</dd></div><div><dt>Visível</dt><dd>{object.visible?'Sim':'Não'}</dd></div><div><dt>Bloqueado</dt><dd>{object.locked?'Sim':'Não'}</dd></div></dl>
    </div>:<div className="inspector-section"><h3>Cena selecionada</h3><label>Nome<input value={scene.name} onChange={event=>updateScene(scene.id,{name:event.target.value})}/></label><div className="field-grid"><label>Largura<input type="number" min="320" max="20000" value={scene.width} onChange={event=>updateScene(scene.id,{width:Number(event.target.value)})}/></label><label>Altura<input type="number" min="180" max="12000" value={scene.height} onChange={event=>updateScene(scene.id,{height:Number(event.target.value)})}/></label></div><dl><div><dt>Ordem</dt><dd>{scene.order+1}</dd></div><div><dt>Objetos</dt><dd>{scene.objects.length}</dd></div><div><dt>Cenário</dt><dd>{scene.backgroundAssetId?project.assets.find(a=>a.id===scene.backgroundAssetId)?.name??'Ausente':'Nenhum'}</dd></div></dl></div>}
    <div className={validation.valid?'validation ok':'validation error'}>{validation.valid?'Projeto estruturalmente válido':`${validation.issues.length} erro(s) no projeto`}</div>
  </aside>;
}