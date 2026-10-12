import {useState,useEffect} from 'react';import {jsonRequest,request} from '../lib/http';import {buildWebhookUrl} from '../config/globals';
let localSequence=0;
const localKey=()=>globalThis.crypto?.randomUUID?.() || `ui-${Date.now()}-${++localSequence}`;
const blank=()=>({titulo:'',apresentacao:'',encerramento:'Obrigado pela sua participação!',inicio:'',fim:'',ativo:false,perguntas:[]});
const types={UNICA:'Uma alternativa',MULTIPLA:'Várias alternativas',NOTA:'Nota',TEXTO:'Texto livre'};
export default function Surveys(){
 const [list,setList]=useState([]),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [arquivo,setArquivo]=useState(null),[importOpen,setImportOpen]=useState(false),[preview,setPreview]=useState(null),[modoImportacao,setModoImportacao]=useState('ACRESCENTAR'),[aba,setAba]=useState(''),[delimitador,setDelimitador]=useState(';'),[dirty,setDirty]=useState(false),[questionDirty,setQuestionDirty]=useState(false);
 async function api(acao,payload={}){return jsonRequest(buildWebhookUrl('prospectflow-pesquisas'),{acao,payload});}
 async function load(){setBusy(true);setError('');try{const data=await api('LISTAR_PESQUISAS');if(!Array.isArray(data.pesquisas))throw new Error('Resposta inválida: esperado pesquisas[].');setList(data.pesquisas);}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{load();},[]);
 async function operate(acao,s){
  if(acao==='EXCLUIR_PESQUISA'&&!window.confirm(`Excluir a pesquisa "${s.titulo}"?`))return;
  setBusy(true);setError('');setNotice('');try{
   await api(acao,{id:Number(s.id),...(acao==='ALTERAR_ATIVO'?{ativo:!s.ativo}:{})});
   await load();setNotice(acao==='DUPLICAR_PESQUISA'?'Cópia criada.':acao==='EXCLUIR_PESQUISA'?'Pesquisa excluída.':'Situação atualizada.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function update(key,value){if(key==='perguntas')setQuestionDirty(true);setDirty(true);setPreview(null);setForm(f=>({...f,[key]:value}));}
 function question(index,key,value){setQuestionDirty(true);setDirty(true);setPreview(null);setForm(f=>({...f,perguntas:f.perguntas.map((q,i)=>i===index?{...q,[key]:value}:q)}));}
 async function edit(id){setBusy(true);setError('');try{const data=await api('OBTER_PESQUISA',{id});if(!Array.isArray(data.pesquisa?.perguntas))throw new Error('Pesquisa inválida.');setForm(data.pesquisa);setDirty(false);setQuestionDirty(false);setPreview(null);setImportOpen(false);setArquivo(null);return true;}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function salvarCadastro(e){
  e?.preventDefault();setError('');setNotice('');setBusy(true);
  try{
   if(!form.titulo?.trim())throw new Error('Informe o título da pesquisa.');
   if(form.inicio&&form.fim&&form.fim<form.inicio)throw new Error('Confira a vigência.');
   const payload={id:form.id,titulo:form.titulo,apresentacao:form.apresentacao,encerramento:form.encerramento,inicio:form.inicio,fim:form.fim,
  ativo: form.id ? form.ativo === true : false,};
   const data=await api('SALVAR_PESQUISA',payload);
   if(!data.pesquisa?.id)throw new Error('A API não retornou a pesquisa salva. Execute a correção da função pesquisas_api.');
   setForm(f=>({...data.pesquisa,perguntas:f.id?f.perguntas:data.pesquisa.perguntas}));setDirty(questionDirty);setPreview(null);await load();setNotice('Cadastro salvo. Agora importe a planilha ou cadastre as perguntas manualmente.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function save(e){e.preventDefault();
  if(!form.id){await salvarCadastro();return;}
  setError('');setNotice('');setBusy(true);try{
  if(form.inicio&&form.fim&&form.fim<form.inicio)throw new Error('O fim da vigência deve ser posterior ao início.');
  const payload={...form,perguntas:form.perguntas.map((q,i)=>{
   if(!q.enunciado.trim())throw new Error(`Informe o texto da pergunta ${i+1}.`);
   const options=['UNICA','MULTIPLA'].includes(q.tipo)?q.alternativas:[];
   if(['UNICA','MULTIPLA'].includes(q.tipo)&&(options.length<2||options.some(a=>!a.texto.trim())))throw new Error(`A pergunta ${i+1} precisa de pelo menos duas alternativas preenchidas.`);
   if(q.tipo==='NOTA'&&(!Number.isInteger(q.nota_min)||!Number.isInteger(q.nota_max)||q.nota_max<=q.nota_min))throw new Error(`Confira a escala da pergunta ${i+1}.`);
   return {...q,ordem:i+1,alternativas:options.map((a,j)=>({...a,ordem:j+1}))};})};
  await api('SALVAR_PESQUISA',payload);setDirty(false);setQuestionDirty(false);setPreview(null);setForm(null);await load();setNotice('Pesquisa salva.');
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function lerPlanilha(){
  setError('');setNotice('');setPreview(null);
  if(!form?.id){setError('Crie e salve a pesquisa primeiro.');return;}
  if(dirty){setError('Salve as alterações antes de importar a planilha.');return;}
  if(!arquivo){setError('Selecione uma planilha.');return;}
  if(arquivo.size>5*1024*1024){setError('A planilha deve ter até 5 MB.');return;}
  setBusy(true);try{
   const data=new FormData();data.append('acao','PREVISUALIZAR');data.append('pesquisa_id',String(form.id));data.append('aba',aba);data.append('delimitador',delimitador);data.append('arquivo',arquivo);
   const response=await request(buildWebhookUrl('prospectflow-pesquisa-importar'),{method:'POST',body:data});
   let result;try{result=await response.json();}catch{throw new Error('O webhook não retornou JSON válido.');}
   if(!response.ok||result.ok!==true)throw new Error(result.mensagem||'Não foi possível ler a planilha.');
   if(!Array.isArray(result.perguntas)||!result.perguntas.length)throw new Error('Nenhuma pergunta encontrada.');
   setPreview(result);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function confirmarImportacao(){setBusy(true);setError('');try{
  const result=await jsonRequest(buildWebhookUrl('prospectflow-pesquisa-importar'),{acao:'CONFIRMAR',pesquisa_id:form.id,versao:preview.versao,modo:modoImportacao,perguntas:preview.perguntas});
  if(!result.pesquisa?.id)throw new Error('A API não retornou o questionário salvo.');
  setForm(result.pesquisa);setDirty(false);setQuestionDirty(false);setPreview(null);setImportOpen(false);setArquivo(null);await load();setNotice(`${result.importadas} perguntas importadas. Você pode revisar e editar abaixo.`);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 function iniciarManual(){setImportOpen(false);if(!form.perguntas.length)update('perguntas',[{key:localKey(),enunciado:'',tipo:'UNICA',obrigatoria:true,nota_min:0,nota_max:10,alternativas:[]}]);}
 function move(index,delta){setQuestionDirty(true);setDirty(true);setPreview(null);setForm(f=>{const q=[...f.perguntas];[q[index],q[index+delta]]=[q[index+delta],q[index]];return {...f,perguntas:q};});}
 return <section className="content"><div className="page-title"><div><h1>Pesquisas</h1><p>Monte perguntas e alternativas para conhecer seus clientes.</p></div>{!form&&<button className="primary" onClick={()=>{setForm(blank());setError('');setNotice('');setDirty(false);setQuestionDirty(false);setPreview(null);setImportOpen(false);setArquivo(null);}}>Nova pesquisa</button>}</div>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
 {!form?<div className="card"><div className="row"><h2>Suas pesquisas</h2><button className="secondary" disabled={busy} onClick={load}>{busy?'Carregando…':'Atualizar'}</button></div>{!busy&&!list.length&&<p className="muted">Nenhuma pesquisa carregada.</p>}<div className="survey-list">{list.map(s=><article key={s.id}><div><h3>{s.titulo}</h3><small>{s.ativo?'Ativa':'Inativa'} · {s.quantidade_perguntas??s.perguntas?.length??'—'} perguntas</small></div><div className="row"><button className="secondary" disabled={busy} onClick={()=>edit(s.id)}>Editar</button><button className="secondary" disabled={busy} onClick={async()=>{if(await edit(s.id))setImportOpen(true);}}>Importar planilha</button><button className="secondary" disabled={busy} onClick={()=>operate('DUPLICAR_PESQUISA',s)}>Duplicar</button><button className="secondary" onClick={()=>operate('ALTERAR_ATIVO',s)} disabled={busy||(!s.ativo&&Number(s.quantidade_perguntas??s.perguntas?.length??0)===0)}>{s.ativo?'Desativar':'Ativar'}</button><button className="danger" disabled={busy} onClick={()=>operate('EXCLUIR_PESQUISA',s)}>Excluir</button></div></article>)}</div></div>:<form noValidate onSubmit={!form.id?salvarCadastro:save}>
 <section className="card"><h2>{form.id?'Dados da pesquisa':'1. Crie e salve a pesquisa'}</h2>{!form.id&&<p>Depois de salvar, você poderá importar uma planilha ou cadastrar as perguntas manualmente.</p>}<label>Título<input required maxLength={160} value={form.titulo} onChange={e=>update('titulo',e.target.value)}/></label><label>Mensagem de abertura<textarea maxLength={4000} value={form.apresentacao} onChange={e=>update('apresentacao',e.target.value)}/></label><div className="columns"><label>Início da vigência<input type="date" value={form.inicio||''} onChange={e=>update('inicio',e.target.value)}/></label><label>Fim da vigência<input type="date" value={form.fim||''} onChange={e=>update('fim',e.target.value)}/></label></div><label className="check"><input type="checkbox" disabled={!form.id||!form.perguntas.length} checked={form.ativo} onChange={e=>update('ativo',e.target.checked)}/>Pesquisa ativa</label>{form.id&&<button type="button" className="secondary" disabled={busy} onClick={salvarCadastro}>Salvar somente dados da pesquisa</button>}</section>
 {form.id&&<section className="card"><h2>2. Monte o questionário</h2><div className="row"><button type="button" className="secondary" disabled={busy} onClick={()=>{setImportOpen(true);setPreview(null);}}>Importar planilha</button><button type="button" className="secondary" disabled={busy} onClick={iniciarManual}>Cadastrar manualmente</button></div></section>}
 {form.id&&importOpen&&<section className="card"><h2>Importar perguntas</h2><p>Selecione XLS, XLSX, XLSM, ODS ou CSV. A primeira linha deve conter os cabeçalhos.</p><label>Planilha<input type="file" accept=".xls,.xlsx,.xlsm,.ods,.csv" disabled={busy} onChange={e=>{setArquivo(e.target.files?.[0]||null);setPreview(null);}}/></label><div className="columns"><label>Nome da aba (opcional)<input value={aba} maxLength={80} onChange={e=>{setAba(e.target.value);setPreview(null);}} placeholder="Vazio: primeira aba"/></label><label>Separador do CSV<select value={delimitador} onChange={e=>{setDelimitador(e.target.value);setPreview(null);}}><option value=";">Ponto e vírgula</option><option value=",">Vírgula</option><option value={'\t'}>Tabulação</option></select></label></div><label>Como importar<select value={modoImportacao} onChange={e=>setModoImportacao(e.target.value)}><option value="ACRESCENTAR">Acrescentar às perguntas existentes</option><option value="SUBSTITUIR">Substituir o questionário atual</option></select></label><button type="button" className="secondary" disabled={busy||!arquivo} onClick={lerPlanilha}>{busy?'Aguarde…':'Ler planilha e revisar'}</button>{preview&&<div><h3 style={{marginTop:20}}>{preview.resumo?.perguntas??preview.perguntas.length} perguntas encontradas</h3><p>{preview.resumo?.alternativas??0} alternativas · {preview.quantidade_atual??0} perguntas já cadastradas</p>{preview.avisos?.map((a,i)=><p key={i} className="notice">{a}</p>)}<ol>{preview.perguntas.map((q,i)=><li key={i} style={{marginBottom:16}}><strong>{q.enunciado}</strong><p>{types[q.tipo]} · {q.obrigatoria?'Obrigatória':'Opcional'}</p>{q.alternativas.length>0&&<ul>{q.alternativas.map((a,j)=><li key={j}>{a.texto}{a.permite_texto?' (permite complemento)':''}</li>)}</ul>}</li>)}</ol>{modoImportacao==='SUBSTITUIR'&&preview.quantidade_atual>0&&<p className="notice">Ao confirmar, as perguntas atuais serão substituídas pelas perguntas acima.</p>}<button type="button" className="primary" disabled={busy} onClick={confirmarImportacao}>Confirmar importação</button></div>}</section>}
 {form.perguntas.map((q,i)=><section className="card question" key={q.id||q.key}><div className="row"><h2>Pergunta {i+1}</h2><div className="row"><button type="button" className="secondary" disabled={i===0} onClick={()=>move(i,-1)} aria-label="Mover pergunta para cima">↑</button><button type="button" className="secondary" disabled={i===form.perguntas.length-1} onClick={()=>move(i,1)} aria-label="Mover pergunta para baixo">↓</button><button type="button" className="danger" onClick={()=>update('perguntas',form.perguntas.filter((_,j)=>j!==i))}>Remover</button></div></div><label>Pergunta<input required maxLength={2000} value={q.enunciado} onChange={e=>question(i,'enunciado',e.target.value)}/></label><div className="columns"><label>Tipo de resposta<select value={q.tipo} onChange={e=>question(i,'tipo',e.target.value)}>{Object.entries(types).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label className="check"><input type="checkbox" checked={q.obrigatoria} onChange={e=>question(i,'obrigatoria',e.target.checked)}/>Obrigatória</label></div>
 {['UNICA','MULTIPLA'].includes(q.tipo)&&<div><h3>Alternativas</h3>{q.alternativas.map((a,j)=><div className="option" key={a.id||a.key}><span>{j+1}.</span><input aria-label={`Alternativa ${j+1} da pergunta ${i+1}`} required maxLength={500} value={a.texto} onChange={e=>question(i,'alternativas',q.alternativas.map((v,k)=>k===j?{...v,texto:e.target.value}:v))}/><label className="check"><input type="checkbox" checked={a.permite_texto} onChange={e=>question(i,'alternativas',q.alternativas.map((v,k)=>k===j?{...v,permite_texto:e.target.checked}:v))}/>Complemento</label><button type="button" className="secondary" aria-label="Excluir alternativa" onClick={()=>question(i,'alternativas',q.alternativas.filter((_,k)=>k!==j))}>×</button></div>)}<button type="button" className="secondary" onClick={()=>question(i,'alternativas',[...q.alternativas,{key:localKey(),texto:'',permite_texto:false}])}>Adicionar alternativa</button></div>}
 {q.tipo==='NOTA'&&<div className="columns"><label>Nota mínima<input type="number" required value={q.nota_min} onChange={e=>question(i,'nota_min',Number(e.target.value))}/></label><label>Nota máxima<input type="number" required value={q.nota_max} onChange={e=>question(i,'nota_max',Number(e.target.value))}/></label></div>}</section>)}
 {form.id&&<button type="button" className="secondary" disabled={busy} onClick={()=>update('perguntas',[...form.perguntas,{key:localKey(),enunciado:'',tipo:'UNICA',obrigatoria:true,nota_min:0,nota_max:10,alternativas:[]}])}>Adicionar pergunta</button>}<section className="card"><label>Mensagem de encerramento<textarea maxLength={4000} value={form.encerramento} onChange={e=>update('encerramento',e.target.value)}/></label><div className="row"><button className="primary" disabled={busy}>{busy?'Salvando…':!form.id?'Salvar cadastro da pesquisa':form.perguntas.length?'Salvar questionário':'Salvar dados da pesquisa'}</button><button type="button" disabled={busy} className="secondary" onClick={()=>setForm(null)}>Cancelar</button></div></section></form>}
 </section>;
}
