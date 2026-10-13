import {useEffect,useRef,useState} from 'react';
import {jsonRequest,request} from '../lib/http';
import {buildWebhookUrl} from '../config/globals';
import {campaignStates,participationStates,importStates,pastedContacts,campaignForm,campaignPayload,downloadContactTemplate} from '../lib/campaigns';
import './Campaigns.css';

const api=(acao,payload={})=>jsonRequest(buildWebhookUrl('prospectflow-campanhas'),{acao,payload});
const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const labelDate=(value,zone)=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:zone||'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Sem data';
const canEdit=c=>c&&['RASCUNHO','PAUSADA'].includes(c.status);
const metrics=[['total','Participantes'],['aguardando','Aguardando convite'],['respondendo','Respondendo'],['concluidos','Concluídos'],['recusados','Recusaram'],['falhas','Falhas no convite']];

export default function Campaigns(){
 const [list,setList]=useState([]),[surveys,setSurveys]=useState([]),[instances,setInstances]=useState([]);
 const [listPage,setListPage]=useState(1),[total,setTotal]=useState(0),[statusFilter,setStatusFilter]=useState('');
 const [selected,setSelected]=useState(null),[summary,setSummary]=useState({}),[form,setForm]=useState(null),[dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [people,setPeople]=useState([]),[peoplePage,setPeoplePage]=useState(1),[peopleTotal,setPeopleTotal]=useState(0),[peopleFilter,setPeopleFilter]=useState('');
 const [audience,setAudience]=useState(''),[file,setFile]=useState(null),[sheet,setSheet]=useState(''),[delimiter,setDelimiter]=useState(';'),[paste,setPaste]=useState('');
 const [contacts,setContacts]=useState([]),[contactSearch,setContactSearch]=useState(''),[contactPage,setContactPage]=useState(1),[chosen,setChosen]=useState(new Map());
 const [sourceCampaign,setSourceCampaign]=useState(''),[copyFilter,setCopyFilter]=useState('TODOS'),[sourceOptions,setSourceOptions]=useState([]);
 const [preview,setPreview]=useState(null),[previewPage,setPreviewPage]=useState(1),[previewFilter,setPreviewFilter]=useState('');
 const [responses,setResponses]=useState(null);
 const lock=useRef(false),mounted=useRef(true),selectedId=useRef(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function run(work){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{await work();}catch(e){if(mounted.current)setError(e.message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function reloadList(page=listPage,status=statusFilter){
  const data=await api('LISTAR_CAMPANHAS',{pagina:page,limite:20,status});
  if(!Array.isArray(data.campanhas))throw new Error('A API não retornou a lista de campanhas.');
  if(mounted.current){setList(data.campanhas);setTotal(data.total);setListPage(page);setStatusFilter(status);}
 }
 async function reloadPeople(id,page=peoplePage,status=peopleFilter){
  const data=await api('LISTAR_PARTICIPANTES',{id,pagina:page,limite:50,status});
  if(mounted.current&&selectedId.current===id){setPeople(data.participantes);setPeopleTotal(data.total);setPeoplePage(page);setPeopleFilter(status);}
 }
 async function reloadSelected(id){
  const data=await api('OBTER_CAMPANHA',{id});
  if(mounted.current&&selectedId.current===id){setSelected(data.campanha);setSummary(data.resumo);}
 }
 useEffect(()=>{run(async()=>{
  const results=await Promise.allSettled([api('LISTAR_CAMPANHAS',{pagina:1,limite:20}),jsonRequest(buildWebhookUrl('prospectflow-pesquisas'),{acao:'LISTAR_PESQUISAS',payload:{}}),api('LISTAR_INSTANCIAS')]);
  if(!mounted.current)return;
  const failures=[];
  if(results[0].status==='fulfilled'){setList(results[0].value.campanhas||[]);setTotal(results[0].value.total||0);}else failures.push(results[0].reason.message);
  if(results[1].status==='fulfilled')setSurveys(results[1].value.pesquisas||[]);else failures.push(results[1].reason.message);
  if(results[2].status==='fulfilled')setInstances(results[2].value.instancias||[]);else failures.push(results[2].reason.message);
  if(failures.length)throw new Error([...new Set(failures)].join(' '));
 });},[]);
 function discardChanges(){return !dirty||window.confirm('Descartar as alterações que ainda não foram salvas?');}
 function resetAudience(){setAudience('');setPreview(null);setChosen(new Map());setFile(null);setPaste('');setSourceCampaign('');}
 async function open(id){
  if(!discardChanges())return;
  await run(async()=>{
   const data=await api('OBTER_CAMPANHA',{id});selectedId.current=id;setSelected(data.campanha);setSummary(data.resumo);setForm(null);setDirty(false);setResponses(null);resetAudience();
   await reloadPeople(id,1,'');
  });
 }
 function create(){if(!discardChanges())return;selectedId.current=null;setSelected(null);setForm(campaignForm());setDirty(false);setError('');setNotice('');setResponses(null);resetAudience();}
 function update(key,value){setDirty(true);setForm(f=>({...f,[key]:value}));}
 function cancelForm(){if(!discardChanges())return;setForm(null);setDirty(false);}
 async function save(event){event.preventDefault();await run(async()=>{
  const data=await api('SALVAR_CAMPANHA',campaignPayload(form));const id=Number(data.id);
  selectedId.current=id;setSelected(data.campanha);setForm(null);setDirty(false);resetAudience();setResponses(null);
  await reloadList(1,'');await reloadSelected(id);await reloadPeople(id,1,'');setNotice('Campanha salva. Agora adicione os participantes.');
 });}
 async function action(acao){
  const texts={ENCERRAR_CAMPANHA:'Encerrar a campanha? Quem ainda não terminou será marcado como expirado. As respostas serão preservadas.',CANCELAR_CAMPANHA:'Cancelar a campanha? As respostas existentes serão preservadas.',EXCLUIR_CAMPANHA:'Excluir este rascunho?'};
  if(texts[acao]&&!window.confirm(texts[acao]))return;
  await run(async()=>{
   const id=selected.id;await api(acao,{id});
   if(acao==='EXCLUIR_CAMPANHA'){selectedId.current=null;setSelected(null);resetAudience();}else{await reloadSelected(id);await reloadPeople(id);}
   await reloadList();setNotice('Situação da campanha atualizada.');
  });
 }
 async function participantAction(acao,p){
  if(acao==='REMOVER_PARTICIPANTE'&&!window.confirm(`Remover ${p.nome||p.telefone} desta campanha?`))return;
  await run(async()=>{await api(acao,{id:selected.id,participacao_id:p.id});await reloadPeople(selected.id);await reloadSelected(selected.id);setNotice('Participante atualizado.');});
 }
 async function chooseMode(mode){
  setAudience(mode);setPreview(null);setPreviewPage(1);setPreviewFilter('');setError('');setNotice('');
  if(mode==='contacts')await searchContacts(1);
  if(mode==='copy')await run(async()=>{
   const all=[];let page=1;
   while(true){const d=await api('LISTAR_CAMPANHAS',{pagina:page,limite:500});all.push(...d.campanhas);if(all.length>=d.total||!d.campanhas.length)break;page++;}
   setSourceOptions(all.filter(c=>c.id!==selected.id));
  });
 }
 async function searchContacts(page=1){await run(async()=>{const d=await api('PESQUISAR_CONTATOS',{busca:contactSearch,pagina:page,limite:50});setContacts(d.contatos);setContactPage(page);});}
 function toggleContact(contact){setChosen(prev=>{const next=new Map(prev);next.has(contact.id)?next.delete(contact.id):next.set(contact.id,contact);return next;});setPreview(null);}
 async function prepare(){await run(async()=>{
  let result;
  if(audience==='file'){
   if(!file)throw new Error('Selecione a planilha.');if(file.size>5*1024*1024)throw new Error('Use uma planilha de até 5 MB.');
   const body=new FormData();body.append('campanha_id',String(selected.id));body.append('aba',sheet);body.append('delimitador',delimiter);body.append('arquivo',file);
   const response=await request(buildWebhookUrl('prospectflow-campanha-importar'),{method:'POST',body});
   try{result=await response.json();}catch{throw new Error('A importação não retornou JSON válido. Confira o webhook de planilhas.');}
   if(!response.ok||result.ok!==true)throw new Error(result.mensagem||'Não foi possível ler a planilha.');
  }else if(audience==='paste')result=await api('PREPARAR_IMPORTACAO',{id:selected.id,contatos:pastedContacts(paste)});
  else if(audience==='contacts'){
   if(!chosen.size)throw new Error('Escolha pelo menos um contato.');
   result=await api('PREPARAR_SELECAO',{id:selected.id,lead_ids:[...chosen.keys()]});
  }else{
   if(!sourceCampaign)throw new Error('Escolha a campanha de origem.');
   result=await api('PREPARAR_COPIA',{id:selected.id,campanha_origem_id:Number(sourceCampaign),filtro:copyFilter});
  }
  setPreview(result);setPreviewPage(1);setPreviewFilter('');
 });}
 async function confirm(){await run(async()=>{
  const r=await api('CONFIRMAR_IMPORTACAO',{importacao_id:preview.importacao_id});
  resetAudience();await reloadSelected(selected.id);await reloadPeople(selected.id,1,'');await reloadList();
  setNotice(`${r.adicionados} participantes adicionados · ${r.contatos_criados} contatos novos · ${r.ignorados} linhas ignoradas.`);
 });}
 async function seeResponses(p){await run(async()=>{setResponses(await api('OBTER_RESPOSTAS',{participacao_id:p.id}));});}
 const previewRows=(preview?.linhas||[]).filter(x=>!previewFilter||x.situacao===previewFilter);
 const research=surveys.find(s=>s.id===selected?.pesquisa_id);

 return <main className="campaigns-page" aria-busy={busy}>
  <header className="campaigns-title"><div><span className="eyebrow">PESQUISAS · PÚBLICO · ACOMPANHAMENTO</span><h1>Campanhas</h1><p>Escolha a pesquisa, organize os participantes e acompanhe cada rodada.</p></div><button className="primary" disabled={busy} onClick={create}>＋ Nova campanha</button></header>
  {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {form?<form onSubmit={save} className="campaigns-editor"><fieldset disabled={busy} className="campaigns-form-fields">
   <section className="card"><div className="row"><h2>{form.id?'Editar campanha':'1. Cadastre a campanha'}</h2><button type="button" className="secondary" disabled={busy} onClick={cancelForm}>Voltar</button></div>
    <div className="columns"><label>Nome da campanha<input required maxLength={160} value={form.titulo} onChange={e=>update('titulo',e.target.value)}/></label><label>Pesquisa<select required value={form.pesquisa_id} disabled={busy||Boolean(selected?.iniciada_em)||Boolean(form.id&&summary.total)} onChange={e=>update('pesquisa_id',e.target.value)}><option value="">Escolha uma pesquisa</option>{surveys.map(s=><option key={s.id} value={s.id}>{s.titulo}{s.ativo?'':' — inativa'}</option>)}</select></label></div>
    {!surveys.length&&<p className="notice">Cadastre uma pesquisa na aba Pesquisas para criar a campanha.</p>}
    <div className="columns"><label>WhatsApp de envio<select value={form.instancia_nome} disabled={busy||Boolean(selected?.iniciada_em)} onChange={e=>update('instancia_nome',e.target.value)}><option value="">Escolher depois</option>{form.instancia_nome&&!instances.some(i=>i.instancia_nome===form.instancia_nome)&&<option value={form.instancia_nome}>{form.instancia_nome} — indisponível</option>}{instances.map(i=><option key={i.instancia_nome} value={i.instancia_nome}>{i.instancia_nome}{i.numero_whatsapp?` · ${i.numero_whatsapp}`:''}</option>)}</select></label><label>Fuso horário<input required maxLength={80} value={form.fuso_horario} onChange={e=>update('fuso_horario',e.target.value)}/></label></div>
    <div className="columns"><label>Início — no fuso acima<input type="datetime-local" value={form.inicio_em} onChange={e=>update('inicio_em',e.target.value)}/></label><label>Término — no fuso acima<input type="datetime-local" value={form.fim_em} onChange={e=>update('fim_em',e.target.value)}/></label></div>
   </section>
   <section className="card"><h2>2. Configure o ritmo dos convites</h2><div className="campaigns-grid3">
    <label>Novos convites por dia<input type="number" required min={1} max={10000} value={form.convites_por_dia} onChange={e=>update('convites_por_dia',e.target.value)}/></label>
    <label>Convites por lote<input type="number" required min={1} max={1000} value={form.quantidade_lote} onChange={e=>update('quantidade_lote',e.target.value)}/></label>
    <label>Intervalo de envio (segundos)<input type="number" required min={1} max={86400} value={form.intervalo_segundos} onChange={e=>update('intervalo_segundos',e.target.value)}/></label>
   </div><div className="columns"><label>Enviar a partir de<input type="time" required value={form.horario_inicio} onChange={e=>update('horario_inicio',e.target.value)}/></label><label>Enviar até<input type="time" required value={form.horario_fim} onChange={e=>update('horario_fim',e.target.value)}/></label></div>
    <fieldset className="campaigns-days"><legend>Dias de envio</legend>{days.map((day,i)=><label className="check" key={day}><input type="checkbox" checked={form.dias_semana.includes(i)} onChange={e=>update('dias_semana',e.target.checked?[...form.dias_semana,i].sort():form.dias_semana.filter(d=>d!==i))}/>{day}</label>)}</fieldset>
   </section>
   <section className="card"><h2>3. Mensagens e lembretes</h2><label>Apresentação — vazio utiliza a apresentação da pesquisa<textarea maxLength={4000} value={form.apresentacao} onChange={e=>update('apresentacao',e.target.value)}/></label><label>Encerramento — vazio utiliza o encerramento da pesquisa<textarea maxLength={4000} value={form.encerramento} onChange={e=>update('encerramento',e.target.value)}/></label>
    <div className="columns"><label>Máximo de lembretes<input type="number" required min={0} max={5} value={form.max_lembretes} onChange={e=>update('max_lembretes',e.target.value)}/></label><label>Lembrar após (horas)<input type="number" required min={1} max={720} value={form.lembrete_apos_horas} onChange={e=>update('lembrete_apos_horas',e.target.value)}/></label></div>
    <label className="check"><input type="checkbox" checked={form.ia_habilitada} onChange={e=>update('ia_habilitada',e.target.checked)}/>Usar IA para interpretar as respostas</label>
    <div className="campaigns-actions"><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar campanha'}</button><button type="button" className="secondary" disabled={busy} onClick={cancelForm}>Cancelar</button></div>
   </section>
  </fieldset></form>:<>
   <section className="card campaigns-list"><div className="row"><h2>Suas campanhas</h2><div className="campaigns-actions"><select aria-label="Filtrar campanhas por situação" value={statusFilter} disabled={busy} onChange={e=>run(()=>reloadList(1,e.target.value))}><option value="">Todas as situações</option>{Object.entries(campaignStates).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="secondary" disabled={busy} onClick={()=>run(()=>reloadList())}>Atualizar</button></div></div>
    {!list.length?<p className="campaigns-empty">{busy?'Carregando…':'Nenhuma campanha encontrada. Crie uma campanha para começar.'}</p>:<div className="campaigns-table-scroll"><table><thead><tr><th>Campanha</th><th>Situação</th><th>Participantes</th><th>Concluídos</th><th>Convites/dia</th><th></th></tr></thead><tbody>{list.map(c=><tr key={c.id} className={selected?.id===c.id?'selected':''}><td><button className="campaigns-link" disabled={busy} onClick={()=>open(c.id)}>{c.titulo}</button><small>#{c.id} · {labelDate(c.inicio_em,c.fuso_horario)}</small></td><td><span className={`campaigns-badge state-${c.status}`}>{campaignStates[c.status]}</span></td><td>{c.resumo?.total||0}</td><td>{c.resumo?.concluidos||0}</td><td>{c.convites_por_dia}</td><td><button className="secondary" disabled={busy} onClick={()=>open(c.id)}>Abrir</button></td></tr>)}</tbody></table></div>}
    <Pager page={listPage} total={total} size={20} busy={busy} onPage={p=>run(()=>reloadList(p))}/>
   </section>
   {selected&&<section className="campaigns-detail">
    <section className="card"><div className="row"><div><span className={`campaigns-badge state-${selected.status}`}>{campaignStates[selected.status]}</span><h2 className="campaigns-detail-title">{selected.titulo}</h2><p>{research?.titulo||`Pesquisa #${selected.pesquisa_id}`} · {selected.instancia_nome||'WhatsApp ainda não escolhido'}</p></div><button className="secondary" disabled={busy} onClick={()=>run(async()=>{await reloadSelected(selected.id);await reloadPeople(selected.id);})}>Atualizar acompanhamento</button></div>
     <div className="campaigns-metrics">{metrics.map(([key,title])=><div key={key}><span>{title}</span><strong>{summary[key]||0}</strong></div>)}</div>
     <div className="campaigns-config"><span><b>{selected.convites_por_dia}</b> novos convites/dia</span><span>{selected.horario_inicio.slice(0,5)}–{selected.horario_fim.slice(0,5)}</span><span>{selected.dias_semana.map(d=>days[d]).join(', ')}</span><span>{selected.fuso_horario}</span></div>
     <div className="campaigns-actions">
      {canEdit(selected)&&<button className="secondary" disabled={busy} onClick={()=>{setForm(campaignForm(selected));setDirty(false);resetAudience();}}>Editar configuração</button>}
      {['RASCUNHO','AGENDADA'].includes(selected.status)&&<button className="primary" disabled={busy||!summary.total} onClick={()=>action('INICIAR_CAMPANHA')}>Iniciar</button>}
      {selected.status==='RASCUNHO'&&selected.inicio_em&&<button className="secondary" disabled={busy||!summary.total} onClick={()=>action('AGENDAR_CAMPANHA')}>Agendar</button>}
      {['EM_ANDAMENTO','AGENDADA'].includes(selected.status)&&<button className="secondary" disabled={busy} onClick={()=>action('PAUSAR_CAMPANHA')}>Pausar</button>}
      {selected.status==='PAUSADA'&&<button className="primary" disabled={busy} onClick={()=>action('CONTINUAR_CAMPANHA')}>Continuar</button>}
      {['EM_ANDAMENTO','PAUSADA'].includes(selected.status)&&<button className="secondary" disabled={busy} onClick={()=>action('ENCERRAR_CAMPANHA')}>Encerrar</button>}
      {!['CONCLUIDA','CANCELADA'].includes(selected.status)&&<button className="danger" disabled={busy} onClick={()=>action('CANCELAR_CAMPANHA')}>Cancelar campanha</button>}
      {selected.status==='RASCUNHO'&&!summary.total&&<button className="danger" disabled={busy} onClick={()=>action('EXCLUIR_CAMPANHA')}>Excluir rascunho</button>}
     </div>
    </section>
    <section className="card"><div className="row"><div><h2>Participantes</h2><p>Importar novamente acrescenta contatos sem reiniciar as respostas.</p></div>{!canEdit(selected)&&<span className="muted">Pause a campanha para adicionar participantes.</span>}</div>
     {canEdit(selected)&&<div className="campaigns-actions campaigns-add-actions">{[['file','Importar planilha'],['paste','Colar telefones'],['contacts','Selecionar contatos'],['copy','Copiar de outra campanha']].map(([mode,label])=><button key={mode} className={audience===mode?'primary':'secondary'} disabled={busy} onClick={()=>chooseMode(mode)}>{label}</button>)}</div>}
     {audience&&canEdit(selected)&&<div className="campaigns-audience"><div className="row"><h3>Adicionar participantes</h3><button className="secondary" disabled={busy} onClick={resetAudience}>Fechar</button></div>
      {audience==='file'&&<><p>Colunas: <strong>Telefone</strong> e, opcionalmente, <strong>Nome</strong>. Até 5000 contatos e 5 MB por arquivo.</p><label>Planilha<input type="file" accept=".xls,.xlsx,.xlsm,.ods,.csv" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);}}/></label><div className="columns"><label>Aba (opcional)<input maxLength={80} value={sheet} disabled={busy} onChange={e=>{setSheet(e.target.value);setPreview(null);}} placeholder="Primeira aba"/></label><label>Separador do CSV<select value={delimiter} disabled={busy} onChange={e=>{setDelimiter(e.target.value);setPreview(null);}}><option value=";">Ponto e vírgula</option><option value=",">Vírgula</option><option value={'\t'}>Tabulação</option></select></label></div><button className="campaigns-link" disabled={busy} onClick={downloadContactTemplate}>Baixar modelo CSV</button></>}
      {audience==='paste'&&<label>Um telefone por linha, ou Nome;Telefone<textarea rows={8} value={paste} disabled={busy} onChange={e=>{setPaste(e.target.value);setPreview(null);}} placeholder={'16999991234\nMaria;16999991235'}/></label>}
      {audience==='contacts'&&<><form className="campaigns-search" onSubmit={e=>{e.preventDefault();searchContacts(1);}}><input aria-label="Pesquisar contatos" value={contactSearch} disabled={busy} onChange={e=>setContactSearch(e.target.value)} placeholder="Nome, telefone, empresa, segmento ou cidade"/><button className="secondary" disabled={busy}>Pesquisar</button></form><p>{chosen.size} contatos selecionados <button className="campaigns-link" disabled={busy} onClick={()=>{setChosen(new Map());setPreview(null);}}>Limpar seleção</button></p><div className="campaigns-table-scroll"><table><thead><tr><th>Selecionar</th><th>Contato</th><th>Telefone</th><th>Informações</th></tr></thead><tbody>{contacts.map(contact=><tr key={contact.id}><td><input className="campaigns-checkbox" type="checkbox" aria-label={`Selecionar ${contact.nome}`} checked={chosen.has(contact.id)} disabled={busy||contact.nao_contatar||contact.status==='BLOQUEADO'} onChange={()=>toggleContact(contact)}/></td><td>{contact.nome}</td><td>{contact.telefone||'Sem telefone'}</td><td>{contact.nao_contatar||contact.status==='BLOQUEADO'?'Não contatar':[contact.segmento,contact.cidade].filter(Boolean).join(' · ')}</td></tr>)}</tbody></table></div><div className="campaigns-pagination"><button className="secondary" disabled={busy||contactPage<=1} onClick={()=>searchContacts(contactPage-1)}>Anterior</button><span>Página {contactPage}</span><button className="secondary" disabled={busy||contacts.length<50} onClick={()=>searchContacts(contactPage+1)}>Próxima</button></div></>}
      {audience==='copy'&&<div className="columns"><label>Campanha de origem<select value={sourceCampaign} disabled={busy} onChange={e=>{setSourceCampaign(e.target.value);setPreview(null);}}><option value="">Escolha a campanha</option>{sourceOptions.map(c=><option key={c.id} value={c.id}>{c.titulo} · {campaignStates[c.status]}</option>)}</select></label><label>Quem copiar<select value={copyFilter} disabled={busy} onChange={e=>{setCopyFilter(e.target.value);setPreview(null);}}><option value="TODOS">Todos os participantes</option><option value="CONCLUIDOS">Quem concluiu</option><option value="NAO_RESPONDERAM">Quem não respondeu</option><option value="RECUSADOS">Quem recusou aquela pesquisa</option></select></label></div>}
      <div className="campaigns-actions"><button className="secondary" disabled={busy} onClick={prepare}>{busy?'Aguarde…':'Preparar e conferir a lista'}</button></div>
      {preview&&<section className="campaigns-preview"><h3>Confira antes de adicionar</h3><p>{preview.resumo.novos} novos · {preview.resumo.existentes} existentes · {preview.resumo.ja_vinculados} já participam · {preview.resumo.duplicados} repetidos · {preview.resumo.invalidos} para revisar · {preview.resumo.bloqueados} bloqueados</p>{preview.avisos?.map((a,i)=><p key={i} className="notice">{a}</p>)}<label>Mostrar linhas<select value={previewFilter} disabled={busy} onChange={e=>{setPreviewFilter(e.target.value);setPreviewPage(1);}}><option value="">Todas</option>{Object.entries(importStates).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="campaigns-table-scroll"><table><thead><tr><th>Linha</th><th>Nome</th><th>Telefone</th><th>Resultado</th><th>Observação</th></tr></thead><tbody>{previewRows.slice((previewPage-1)*100,previewPage*100).map(row=><tr key={row.linha}><td>{row.linha}</td><td>{row.nome||'—'}</td><td>{row.telefone||'—'}</td><td><span className={`campaigns-badge import-${row.situacao}`}>{importStates[row.situacao]}</span></td><td>{row.motivo||'—'}</td></tr>)}</tbody></table></div><Pager page={previewPage} total={previewRows.length} size={100} busy={busy} onPage={setPreviewPage}/><button className="primary" disabled={busy||!(preview.resumo.novos+preview.resumo.existentes)} onClick={confirm}>Confirmar participantes</button></section>}
     </div>}
     <div className="campaigns-participants-filter"><label>Situação<select value={peopleFilter} disabled={busy} onChange={e=>run(()=>reloadPeople(selected.id,1,e.target.value))}><option value="">Todos os participantes</option>{Object.entries(participationStates).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
     {!people.length?<p className="campaigns-empty">Nenhum participante neste filtro.</p>:<div className="campaigns-table-scroll"><table><thead><tr><th>Contato</th><th>Telefone</th><th>Andamento</th><th>Atendimento</th><th>Ações</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td>{p.nome||'Contato'}<small>#{p.lead_id||'legado'}</small></td><td>{p.telefone}</td><td>{participationStates[p.status]}{p.status==='EM_ANDAMENTO'&&<small>Pergunta {p.pergunta_atual}</small>}</td><td>{p.atendimento_humano?'Humano':'Automático'}</td><td><div className="campaigns-actions"><button className="secondary" disabled={busy} onClick={()=>seeResponses(p)}>Respostas</button>{['PENDENTE','EM_ANDAMENTO'].includes(p.status)&&<button className="secondary" disabled={busy} onClick={()=>participantAction(p.atendimento_humano?'RETOMAR_AUTOMACAO':'ASSUMIR_ATENDIMENTO',p)}>{p.atendimento_humano?'Retomar automação':'Assumir'}</button>}{canEdit(selected)&&p.status==='PENDENTE'&&p.convite_status==='AGUARDANDO'&&<button className="danger" disabled={busy} onClick={()=>participantAction('REMOVER_PARTICIPANTE',p)}>Remover</button>}</div></td></tr>)}</tbody></table></div>}
     <Pager page={peoplePage} total={peopleTotal} size={50} busy={busy} onPage={p=>run(()=>reloadPeople(selected.id,p))}/>
    </section>
    {responses&&<section className="card campaigns-responses"><div className="row"><h2>Respostas · {responses.participacao.telefone}</h2><button className="secondary" disabled={busy} onClick={()=>setResponses(null)}>Fechar</button></div>{!responses.respostas.length?<p>Ainda não há respostas registradas.</p>:responses.respostas.map(r=>{
     const q=responses.questionario?.perguntas?.find(q=>q.id===r.pergunta_id);
     return <article key={r.id}><h3>{q?.enunciado||`Pergunta #${r.pergunta_id}`}</h3>{r.pulada?<p>Pergunta pulada</p>:<><p>{r.texto??(r.nota!=null?`Nota: ${r.nota}`:'')}</p>{r.alternativas?.map(a=><p key={a.alternativa_id}>{q?.alternativas?.find(v=>v.id===a.alternativa_id)?.texto||`Alternativa #${a.alternativa_id}`}{a.complemento?` — ${a.complemento}`:''}</p>)}</>}{r.texto_original&&r.texto_original!==r.texto&&<small>Mensagem original: {r.texto_original}</small>}</article>;
    })}</section>}
   </section>}
  </>}
 </main>;
}
function Pager({page,total,size,busy,onPage}){
 const pages=Math.max(1,Math.ceil(total/size));
 return <div className="campaigns-pagination"><span>{total} registros · página {page} de {pages}</span><div className="campaigns-actions"><button className="secondary" disabled={busy||page<=1} onClick={()=>onPage(page-1)}>Anterior</button><button className="secondary" disabled={busy||page>=pages} onClick={()=>onPage(page+1)}>Próxima</button></div></div>;
}
