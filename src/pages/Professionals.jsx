import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAuth} from '../auth/AuthContext';
import {request} from '../lib/http';
import {buildWebhookUrl} from '../config/globals';
import './Professionals.css';

const emptyProfessional = () => ({id:null,nome:'',telefone:'',email:'',especialidade_id:'',registro_profissional:'',cor_agenda:'#60A5FA',observacoes:''});
const emptySpecialty = () => ({id:null,nome:'',descricao:''});
function unpack(value, depth=0) {
  if (depth>10 || value==null) throw new Error('O servidor não retornou os dados esperados.');
  if (typeof value==='string') {let parsed;try {parsed=JSON.parse(value);} catch {throw new Error('O servidor não retornou uma resposta válida.');}return unpack(parsed,depth+1);}
  if (Array.isArray(value)) return unpack(value[0],depth+1);
  if (value.error || value.ok===false || Number(value.responseCode)>=400) {
    const text=value.mensagem || value.message || value.error?.message || value.error;
    throw new Error(typeof text==='string' && text.length<300 ? text : 'Não foi possível concluir a operação.');
  }
  if (Array.isArray(value.dados) || value.profissional?.id || value.especialidade?.id) return value;
  for (const key of ['prospectflow_api','resultado','body','data']) if (value[key]!=null) return unpack(value[key],depth+1);
  throw new Error('O servidor não retornou os dados esperados.');
}
function phone(value) {
  const n=String(value||'').replace(/\D/g,'');
  if(n.startsWith('55')&&n.length===13) return `+55 (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`;
  if(n.startsWith('55')&&n.length===12) return `+55 (${n.slice(2,4)}) ${n.slice(4,8)}-${n.slice(8)}`;
  return value||'—';
}

export default function Professionals() {
  const {session}=useAuth();
  const empresaId=session?.empresa?.id;
  const [tab,setTab]=useState('professionals');
  const [rows,setRows]=useState([]),[specialties,setSpecialties]=useState([]),[summary,setSummary]=useState({total:0,ativos:0,inativos:0});
  const [search,setSearch]=useState(''),[appliedSearch,setAppliedSearch]=useState(''),[filter,setFilter]=useState('ATIVOS');
  const [loading,setLoading]=useState(true),[ready,setReady]=useState(false),[pending,setPending]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState(null),[professional,setProfessional]=useState(emptyProfessional),[specialty,setSpecialty]=useState(emptySpecialty);
  const sequence=useRef(0),nameInput=useRef(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current+=1;};},[]);
  const api=useCallback(async(acao,payload={})=>{
    if(!empresaId) throw new Error('Empresa não identificada. Entre novamente no sistema.');
    const response=await request(buildWebhookUrl('prospectflow'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({empresa_id:Number(empresaId),acao,payload}),
    });
    const text=await response.text();let raw;try{raw=JSON.parse(text);}catch{throw new Error('Não foi possível ler a resposta do servidor.');}
    const result=unpack(raw);
    if(!response.ok)throw new Error(result?.message||'Não foi possível concluir a operação.');
    return result;
  },[empresaId]);
  const load=useCallback(async()=>{
    const seq=++sequence.current;setLoading(true);setError('');
    const results=await Promise.allSettled([
      api('LISTAR_PROFISSIONAIS',{filtro:filter,busca:appliedSearch}),
      api('LISTAR_ESPECIALIDADES',{filtro:'TODOS'}),
    ]);
    if(!mounted.current||seq!==sequence.current)return;
    if(results[0].status==='fulfilled'){setRows(results[0].value.dados);setSummary(results[0].value.resumo||{});}
    if(results[1].status==='fulfilled')setSpecialties(results[1].value.dados);
    const failed=results.filter(r=>r.status==='rejected');
    setReady(!failed.length);setError(failed.map(r=>r.reason?.message||'Não foi possível carregar o cadastro.').filter((v,i,a)=>a.indexOf(v)===i).join(' '));setLoading(false);
  },[api,filter,appliedSearch]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(editor)nameInput.current?.focus();},[editor]);
  const specialtySummary=useMemo(()=>({total:specialties.length,ativos:specialties.filter(e=>e.ativo).length,inativos:specialties.filter(e=>!e.ativo).length}),[specialties]);
  const visibleSpecialties=useMemo(()=>specialties.filter(e=>(filter==='TODOS'||e.ativo===(filter==='ATIVOS'))&&String(e.nome).toLocaleLowerCase('pt-BR').includes(appliedSearch.toLocaleLowerCase('pt-BR'))),[specialties,filter,appliedSearch]);
  const currentSummary=tab==='professionals'?summary:specialtySummary;
  const currentRows=tab==='professionals'?rows:visibleSpecialties;
  function switchTab(next){if(pending)return;setTab(next);setEditor(null);setSearch('');setAppliedSearch('');setNotice('');}
  function openProfessional(row){setProfessional(row?{...emptyProfessional(),...row,especialidade_id:row.especialidade_id==null?'':String(row.especialidade_id),telefone:row.telefone||'',email:row.email||'',registro_profissional:row.registro_profissional||'',observacoes:row.observacoes||''}:emptyProfessional());setEditor('professional');setNotice('');}
  function openSpecialty(row){setSpecialty(row?{id:row.id,nome:row.nome,descricao:row.descricao||''}:emptySpecialty());setEditor('specialty');setNotice('');}
  async function save(event){
    event.preventDefault();if(pending)return;
    const isProfessional=editor==='professional';setPending(true);setError('');setNotice('');
    try{
      const payload=isProfessional?{...professional,nome:professional.nome.trim(),especialidade_id:professional.especialidade_id||null}:{...specialty,nome:specialty.nome.trim()};
      await api(isProfessional?'SALVAR_PROFISSIONAL':'SALVAR_ESPECIALIDADE',payload);
      if(!mounted.current)return;
      setEditor(null);setNotice(isProfessional?'Profissional salvo.':'Especialidade salva.');await load();
    }catch(e){if(mounted.current)setError(e.message||'Não foi possível salvar.');}
    finally{if(mounted.current)setPending(false);}
  }
  async function toggle(row,isProfessional){
    if(pending)return;setPending(true);setError('');setNotice('');
    try{await api(isProfessional?'ALTERAR_STATUS_PROFISSIONAL':'ALTERAR_STATUS_ESPECIALIDADE',{id:row.id,ativo:!row.ativo});if(!mounted.current)return;setNotice(isProfessional?(row.ativo?'Profissional inativado.':'Profissional reativado.'):(row.ativo?'Especialidade inativada.':'Especialidade reativada.'));await load();}
    catch(e){if(mounted.current)setError(e.message||'Não foi possível alterar a situação.');}
    finally{if(mounted.current)setPending(false);}
  }
  function searchSubmit(e){e.preventDefault();setAppliedSearch(search.trim());}
  function field(key,label,options={}){return <label key={key}>{label}<input ref={key==='nome'?nameInput:undefined} type={options.type||'text'} required={options.required} maxLength={options.max||160} value={professional[key]} onChange={e=>setProfessional(p=>({...p,[key]:e.target.value}))}/></label>;}
  function moveTab(e){if(pending||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'professionals':e.key==='End'?'specialties':tab==='professionals'?'specialties':'professionals';switchTab(next);document.getElementById('pfp-tab-'+next)?.focus();}
  if(!empresaId)return <section className="pfp-page"><p role="alert" className="pfp-alert">Empresa não identificada.</p></section>;
  return <section className="pfp-page" aria-label="Cadastro de profissionais">
    <header className="pfp-heading"><div><span className="pfp-eyebrow">EQUIPE E ATENDIMENTO</span><h1>Profissionais</h1><p>Organize os profissionais e suas especialidades.</p></div><button type="button" className="pfp-primary" disabled={!ready||loading||pending} onClick={()=>tab==='professionals'?openProfessional():openSpecialty()}>{tab==='professionals'?'+ Novo profissional':'+ Nova especialidade'}</button></header>
    <div className="pfp-tabs" role="tablist" aria-label="Cadastros da equipe" onKeyDown={moveTab}>{[['professionals','Profissionais'],['specialties','Especialidades']].map(([id,label])=><button key={id} type="button" role="tab" id={'pfp-tab-'+id} aria-controls={'pfp-panel-'+id} aria-selected={tab===id} tabIndex={tab===id?0:-1} disabled={pending} onClick={()=>switchTab(id)}>{label}</button>)}</div>
    {error&&<div className="pfp-alert" role="alert">{error}<button type="button" className="pfp-link-button" onClick={load} disabled={loading||pending}>Tentar atualizar</button></div>}
    {notice&&<div className="pfp-notice" role="status">{notice}</div>}
    <div className="pfp-summary"><span><b>{currentSummary.total||0}</b> cadastrados</span><span><b>{currentSummary.ativos||0}</b> ativos</span><span><b>{currentSummary.inativos||0}</b> inativos</span></div>
    <div className={'pfp-layout'+(editor?' has-editor':'')}><div className="pfp-list" id={'pfp-panel-'+tab} role="tabpanel" aria-labelledby={'pfp-tab-'+tab}>
      <form className="pfp-filters" onSubmit={searchSubmit}><label className="pfp-search">Buscar<input type="search" placeholder={tab==='professionals'?'Nome, telefone ou especialidade':'Nome da especialidade'} value={search} onChange={e=>setSearch(e.target.value)} disabled={pending}/></label><label>Situação<select aria-label="Situação" value={filter} onChange={e=>setFilter(e.target.value)} disabled={pending}><option value="ATIVOS">Ativos</option><option value="INATIVOS">Inativos</option><option value="TODOS">Todos</option></select></label><button type="submit" className="pfp-secondary" disabled={pending||loading}>Buscar</button><button type="button" className="pfp-secondary" onClick={load} disabled={pending||loading} aria-label="Atualizar cadastros">Atualizar</button></form>
      {loading?<p className="pfp-empty" role="status">Carregando cadastros…</p>:!ready?<p className="pfp-empty">Não foi possível carregar todos os dados. Use Tentar atualizar.</p>:currentRows.length===0?<div className="pfp-empty"><h2>{appliedSearch?'Nenhum resultado encontrado':tab==='professionals'?'Nenhum profissional nesta situação':'Nenhuma especialidade nesta situação'}</h2><p>{appliedSearch?'Confira a busca ou escolha outra situação.':tab==='professionals'?'Cadastre sua equipe para preparar a agenda por profissional.':'Cadastre as áreas de atuação da equipe.'}</p></div>:<div className="pfp-table-scroll"><table className="pfp-table"><thead><tr>{(tab==='professionals'?['Profissional','Especialidade','Telefone','Situação','Ações']:['Especialidade','Descrição','Situação','Ações']).map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{currentRows.map(row=><tr key={row.id} className={row.ativo?'':'is-inactive'}>
        {tab==='professionals'?<><td><div className="pfp-name"><span className="pfp-color" style={{background:row.cor_agenda}} aria-hidden="true"/><div><strong>{row.nome}</strong>{row.registro_profissional&&<small>{row.registro_profissional}</small>}</div></div></td><td>{row.especialidade_nome||<span className="pfp-muted">Não informada</span>}</td><td className="pfp-phone">{phone(row.telefone)}</td></>:<><td><strong>{row.nome}</strong></td><td className="pfp-description">{row.descricao||'—'}</td></>}
        <td><span className={'pfp-status '+(row.ativo?'is-active':'is-off')}>{row.ativo?'Ativo':'Inativo'}</span></td><td><div className="pfp-row-actions"><button type="button" disabled={pending} onClick={()=>tab==='professionals'?openProfessional(row):openSpecialty(row)} aria-label={'Editar '+row.nome}>Editar</button><button type="button" disabled={pending} onClick={()=>toggle(row,tab==='professionals')} aria-label={(row.ativo?'Inativar ':'Reativar ')+row.nome}>{row.ativo?'Inativar':'Reativar'}</button></div></td></tr>)}</tbody></table></div>}
    </div>
    {editor&&<aside className="pfp-editor" aria-label={editor==='professional'?'Dados do profissional':'Dados da especialidade'}><div className="pfp-editor-title"><h2>{editor==='professional'?(professional.id?'Editar profissional':'Novo profissional'):(specialty.id?'Editar especialidade':'Nova especialidade')}</h2><button type="button" className="pfp-close" disabled={pending} aria-label="Fechar cadastro" onClick={()=>setEditor(null)}>×</button></div><form onSubmit={save}><fieldset disabled={pending||loading}>
      {editor==='professional'?<>{field('nome','Nome *',{required:true,max:160})}<label>Especialidade principal<select aria-label="Especialidade principal" value={professional.especialidade_id} onChange={e=>setProfessional(p=>({...p,especialidade_id:e.target.value}))}><option value="">Não informada</option>{specialties.filter(s=>s.ativo||String(s.id)===professional.especialidade_id).map(s=><option key={s.id} value={String(s.id)} disabled={!s.ativo}>{s.nome}{!s.ativo?' (inativa)':''}</option>)}</select></label>{specialties.filter(s=>s.ativo).length===0&&<p className="pfp-field-help">Cadastre as áreas na aba Especialidades. Você também pode salvar sem especialidade.</p>}<div className="pfp-form-row">{field('telefone','Telefone',{type:'tel',max:32})}{field('email','E-mail',{type:'email',max:254})}</div>{field('registro_profissional','Registro profissional',{max:80})}<label className="pfp-color-field">Cor na agenda<input type="color" value={professional.cor_agenda} onChange={e=>setProfessional(p=>({...p,cor_agenda:e.target.value}))}/></label><label>Observações<textarea maxLength={4000} rows={3} value={professional.observacoes} onChange={e=>setProfessional(p=>({...p,observacoes:e.target.value}))}/></label></>:<><label>Nome *<input ref={nameInput} required maxLength={120} value={specialty.nome} onChange={e=>setSpecialty(s=>({...s,nome:e.target.value}))} placeholder="Ex.: Ortodontia"/></label><label>Descrição<textarea rows={4} maxLength={2000} value={specialty.descricao} onChange={e=>setSpecialty(s=>({...s,descricao:e.target.value}))} placeholder="Detalhes da área de atuação"/></label></>}
      <div className="pfp-form-actions"><button type="button" className="pfp-secondary" onClick={()=>setEditor(null)} disabled={pending}>Cancelar</button><button type="submit" className="pfp-primary">{pending?'Salvando…':'Salvar cadastro'}</button></div></fieldset></form></aside>}
    </div><p className="pfp-footnote">Cada profissional tem uma especialidade principal. Inativar preserva o histórico dos cadastros.</p>
  </section>;
}
