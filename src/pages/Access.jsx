import {useState} from 'react';
import {useAuth} from '../auth/AuthContext';
import {ThemeButton} from '../lib/theme';
import {jsonRequest} from '../lib/http';
import {buildWebhookUrl} from '../config/globals';
export default function Access(){
 const {login,error:sessionError}=useAuth();
 const [mode,setMode]=useState(()=>location.pathname==='/redefinir-senha'?'reset':'login');
 const [email,setEmail]=useState(''),[senha,setSenha]=useState(''),[confirm,setConfirm]=useState(''),[nome,setNome]=useState(''),[empresa,setEmpresa]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [token]=useState(()=>{const params=new URLSearchParams(location.hash.slice(1));const token=params.get('token')||'';if(token)history.replaceState(null,'',location.pathname);return token;});
 function change(next){setMode(next);setError('');setNotice('');setSenha('');setConfirm('');}
 async function submit(e){e.preventDefault();setError('');setNotice('');setBusy(true);try{
  if(['register','reset'].includes(mode) && senha!==confirm)throw new Error('As senhas não coincidem.');
  if(mode==='login')await login(email.trim(),senha);
  if(mode==='forgot'){await jsonRequest(buildWebhookUrl('prospectflow-auth-recuperar'),{email:email.trim()});setNotice('Se houver um cadastro com esse e-mail, você receberá as instruções.');}
  if(mode==='register'){await jsonRequest(buildWebhookUrl('prospectflow-auth-cadastrar'),{email:email.trim(),senha,nome:nome.trim(),empresa_nome:empresa.trim()});setNotice('Solicitação recebida. Confira seu e-mail para continuar o cadastro.');setSenha('');setConfirm('');}
  if(mode==='reset'){if(!token)throw new Error('Abra o link de recuperação recebido por e-mail.');await jsonRequest(buildWebhookUrl('prospectflow-auth-redefinir'),{token,senha});history.replaceState(null,'','/');change('login');setNotice('Senha atualizada. Entre com sua nova senha.');}
 }catch(err){setError(err.name==='AbortError'?'O servidor demorou para responder. Tente novamente.':err.message);}finally{setBusy(false);}}
 const title={login:'Bem-vindo de volta',register:'Crie seu acesso',forgot:'Recuperar acesso',reset:'Definir nova senha'}[mode];
 return <div className="access"><header className="access-top"><strong>Prospect<span>Flow</span></strong><ThemeButton/></header><main className="access-grid"><section className="pitch">
 <div className="eyebrow">RELACIONAMENTO · ATENDIMENTO · AUTOMAÇÕES</div>
 <h1>Mais perto dos seus clientes.</h1>
 <p>Organize contatos, acompanhe conversas e compromissos, crie campanhas e transforme respostas em informação para sua empresa.</p>
 <div className="pitch-cards">
  <div><span className="pitch-number">01</span><b>Contatos e Prospecção</b><small>Organize contatos, oportunidades e próximos retornos.</small></div>
  <div><span className="pitch-number">02</span><b>Atendimento</b><small>Centralize conversas e acompanhe cada cliente com sua equipe.</small></div>
  <div><span className="pitch-number">03</span><b>Agenda</b><small>Reúna compromissos, tarefas e lembretes de acompanhamento.</small></div>
  <div><span className="pitch-number">04</span><b>Campanhas e Pesquisas</b><small>Comunique-se com seu público e conheça suas opiniões.</small></div>
  <div><span className="pitch-number">05</span><b>Automações</b><small>Programe ações e acompanhamentos conforme sua rotina.</small></div>
  <div><span className="pitch-number">06</span><b>Resultados</b><small>Acompanhe indicadores e transforme informações em decisões.</small></div>
 </div>
 </section><section className="card access-card"><div className="eyebrow">SEU ESPAÇO DE TRABALHO</div><h2>{title}</h2><p>{mode==='login'?'Entre com o e-mail do responsável pela empresa.':'Siga as instruções para acessar sua conta.'}</p><form onSubmit={submit}>
 {mode==='register'&&<><label>Seu nome<input required maxLength={120} value={nome} onChange={e=>setNome(e.target.value)} autoComplete="name"/></label><label>Nome da empresa<input required maxLength={160} value={empresa} onChange={e=>setEmpresa(e.target.value)} autoComplete="organization"/></label></>}
 {mode!=='reset'&&<label>E-mail<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>}
 {mode!=='forgot'&&<label>Senha<input type="password" required minLength={mode==='login'?1:12} maxLength={128} value={senha} onChange={e=>setSenha(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'}/>{mode!=='login'&&<small>Use pelo menos 12 caracteres.</small>}</label>}
 {['register','reset'].includes(mode)&&<label>Confirmar senha<input type="password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>}
 {error&&<div role="alert" className="error">{error}</div>}{notice&&<div role="status" className="notice">{notice}</div>}
 <button disabled={busy} className="primary">{busy?'Aguarde…':{login:'Entrar',register:'Criar conta',forgot:'Enviar instruções',reset:'Salvar nova senha'}[mode]}</button>
 </form><div className="access-links">{mode==='login'?<><button onClick={()=>change('forgot')}>Esqueci minha senha</button><button onClick={()=>change('register')}>Criar uma conta</button></>:<button onClick={()=>change('login')}>Voltar ao login</button>}</div>{mode==='login'&&sessionError&&<small className="muted">Não foi possível restaurar uma sessão. Você pode tentar entrar.</small>}</section></main></div>;
}
