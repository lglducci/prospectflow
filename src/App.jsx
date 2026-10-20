import {useEffect, useRef, useState} from 'react';
import {useAuth} from './auth/AuthContext';
import {ThemeButton} from './lib/theme';
import {request} from './lib/http';
import {buildWebhookUrl} from './config/globals';
import Access from './pages/Access';
import ProspectFlow from './pages/ProspectFlow';
import Surveys from './pages/Surveys';
import Company from './pages/Company';
import Campaigns from './pages/Campaigns';
import Professionals from './pages/Professionals';
import './AppNavigation.css';

const operationItems = [
  ['prospect', 'Contatos e conversas', 'contacts'],
  ['agenda', 'Agenda', 'calendar'],
  ['professionals', 'Profissionais', 'professionals'],
  ['research', 'Pesquisas e campanhas', 'campaign'],
];
const settingsItems = [
  ['connection', 'Conexão', 'connection'],
  ['company', 'Empresa', 'company'],
];
const pageTitles = Object.fromEntries([...operationItems, ...settingsItems].map(([id, title]) => [id, title]));

function NavIcon({name}) {
  const paths = {
    contacts: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-4-5.65"/></>,
    professionals: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 8v6M16 11h6M17 18h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/></>,
    campaign: <><path d="m3 10 14-5v14L3 14zM7 16l1 5h4l-2-6M21 9v6"/></>,
    connection: <><path d="M8 12h8M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4"/></>,
    company: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-6h4v6"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    collapse: <path d="m14 6-6 6 6 6"/>,
    expand: <path d="m10 6 6 6-6 6"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ResearchWorkspace() {
  const [tab, setTab] = useState('surveys');
  function moveTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'surveys' : event.key === 'End' ? 'campaigns' : tab === 'surveys' ? 'campaigns' : 'surveys';
    setTab(next);
    document.getElementById(`research-tab-${next}`)?.focus();
  }
  return <section className="research-workspace" aria-label="Pesquisas e campanhas">
    <div className="workspace-intro"><h1>Pesquisas e campanhas</h1><p>Prepare suas perguntas, organize os envios e acompanhe as respostas.</p></div>
    <div className="workspace-tabs" role="tablist" aria-label="Áreas de pesquisas e campanhas" onKeyDown={moveTab}>
      {[['surveys', 'Pesquisas'], ['campaigns', 'Campanhas']].map(([id, label]) => <button key={id} type="button" role="tab" id={`research-tab-${id}`} aria-selected={tab === id} aria-controls={`research-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div id={`research-panel-${tab}`} role="tabpanel" aria-labelledby={`research-tab-${tab}`} tabIndex={0}>
      {tab === 'surveys' ? <Surveys/> : <Campaigns/>}
    </div>
  </section>;
}

function Connection({empresaId}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('NAO_VERIFICADO');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState(null);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  async function connect() {
    if (requestRef.current || !empresaId) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    setQr('');
    setStatus('NAO_VERIFICADO');
    try {
      const response = await request(buildWebhookUrl('prospectflow-conectar-whatsapp'), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({empresa_id: empresaId}), signal: controller.signal,
      });
      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (!response.ok || result?.ok === false) throw new Error(result?.mensagem || result?.message || 'Não foi possível consultar a conexão.');
      if (controller.signal.aborted) return;
      if (result?.status === 'CONECTADO') {
        setStatus('CONECTADO');
      } else if (result?.status === 'PRECISA_QR' && typeof result.qrCode === 'string' && result.qrCode.trim()) {
        const value = result.qrCode.trim();
        if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) setQr(value);
        else if (/^[A-Za-z0-9+/=\s]+$/.test(value)) setQr(`data:image/png;base64,${value.replace(/\s/g, '')}`);
        else throw new Error('O servidor retornou um QR Code em formato inválido.');
        setStatus('PRECISA_QR');
      } else throw new Error(result?.mensagem || result?.message || 'O servidor não retornou o estado da conexão nem um QR Code.');
      setCheckedAt(new Date());
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e.message || 'Não foi possível conectar o WhatsApp.');
        setStatus('ERRO');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }
  const labels = {NAO_VERIFICADO: 'Conexão ainda não verificada', CONECTADO: 'WhatsApp conectado na última verificação', PRECISA_QR: 'Aguardando leitura do QR Code', ERRO: 'Não foi possível verificar a conexão'};
  return <section className="content connection-page">
    <div className="page-title"><div><h1>Conexão</h1><p>Conecte o WhatsApp da sua empresa ou refaça o pareamento quando necessário.</p></div></div>
    <div className="card connection-card">
      <div className="connection-heading"><span className="connection-icon"><NavIcon name="connection"/></span><div><h2>WhatsApp da empresa</h2><p>Utilize o número da empresa neste espaço de trabalho.</p></div></div>
      <p className={`connection-status is-${status.toLowerCase()}`} role="status" aria-live="polite"><span aria-hidden="true">●</span>{busy ? 'Consultando a conexão…' : labels[status]}</p>
      {checkedAt && !busy && <small className="connection-checked">Última resposta: {checkedAt.toLocaleString('pt-BR')}</small>}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="primary" onClick={connect} disabled={busy || !empresaId}>{busy ? 'Aguarde…' : qr ? 'Gerar novo QR Code / verificar conexão' : status === 'CONECTADO' ? 'Verificar conexão' : 'Conectar / verificar WhatsApp'}</button>
      {qr && <div className="connection-qr"><h3>Leia o QR Code com seu celular</h3><p>No WhatsApp, abra <strong>Aparelhos conectados</strong> e selecione <strong>Conectar um aparelho</strong>.</p><img src={qr} alt="QR Code para conectar o WhatsApp da empresa" width="280" height="280"/><small>O QR Code expira em pouco tempo. Se necessário, gere outro. Após a leitura, clique no botão para confirmar a conexão.</small></div>}
      <p className="connection-help">Esta ação utiliza a instância vinculada à sua empresa. As conversas continuam disponíveis na área Contatos e conversas.</p>
    </div>
  </section>;
}

export default function App() {
  const {session, loading, logout} = useAuth();
  const [page, setPage] = useState('prospect');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {setPage('prospect'); setMobileMenuOpen(false);}, [session?.empresa?.id]);
  function navigate(next) {setPage(next); setMobileMenuOpen(false);}
  async function exit() {
    setBusy(true); setError('');
    try {await logout(); setPage('prospect');}
    catch (e) {setError('Não foi possível encerrar a sessão no servidor: ' + e.message);}
    finally {setBusy(false);}
  }
  if (loading) return <main className="loading" role="status">Carregando seu espaço…</main>;
  if (!session || location.pathname === '/redefinir-senha') return <Access/>;
  function navItem([id, label, icon]) {
    return <button key={id} type="button" className={`sidebar-item ${page === id ? 'is-active' : ''}`} aria-current={page === id ? 'page' : undefined} aria-label={label} title={collapsed ? label : undefined} onClick={() => navigate(id)}><NavIcon name={icon}/><span className="sidebar-label">{label}</span></button>;
  }
  return <div className={`app app-layout${collapsed ? ' is-collapsed' : ''}${mobileMenuOpen ? ' is-mobile-menu-open' : ''}`}>
    <a className="app-skip-link" href="#workspace-content">Ir para o conteúdo</a>
    <aside className="app-sidebar" aria-label="Navegação do espaço de trabalho">
      <div className="sidebar-brand"><strong className="sidebar-full-brand">Prospect<span>Flow</span></strong><strong className="sidebar-short-brand" aria-hidden="true">P<span>F</span></strong><button className="sidebar-collapse" type="button" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed} aria-controls="workspace-navigation" onClick={() => setCollapsed(value => !value)}><NavIcon name={collapsed ? 'expand' : 'collapse'}/></button></div>
      <div className="sidebar-company sidebar-label" title={session.empresa.nome}>{session.empresa.nome}</div>
      <nav id="workspace-navigation" className="sidebar-navigation" aria-label="Menu principal" onKeyDown={e => {if (e.key === 'Escape') {setMobileMenuOpen(false); menuRef.current?.focus();}}}>
        <div className="sidebar-operation"><p className="sidebar-group-label sidebar-label">ESPAÇO DE TRABALHO</p>{operationItems.map(navItem)}</div>
        <div className="sidebar-settings"><p className="sidebar-group-label sidebar-label">CONFIGURAÇÕES</p>{settingsItems.map(navItem)}</div>
      </nav>
    </aside>
    <div className="app-workspace">
      <header className="app-header workspace-header"><button ref={menuRef} type="button" className="secondary mobile-menu-toggle" aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMobileMenuOpen(value => !value)}><NavIcon name="menu"/></button><div className="workspace-heading"><span className="workspace-page-name">{pageTitles[page]}</span><span className="workspace-company-name">{session.empresa.nome}</span></div><div className="header-actions"><ThemeButton/><button className="secondary" disabled={busy} onClick={exit}>{busy ? 'Saindo…' : 'Sair'}</button></div></header>
      <div id="workspace-content" className="app-content" tabIndex={-1}>
        {error && <p role="alert" className="error workspace-error">{error}</p>}
        {page === 'prospect' || page === 'agenda' ? <ProspectFlow key={session.empresa.id} view={page === 'agenda' ? 'agenda' : 'contacts'}/> : page === 'professionals' ? <Professionals key={session.empresa.id}/> : page === 'research' ? <ResearchWorkspace key={session.empresa.id}/> : page === 'connection' ? <Connection key={session.empresa.id} empresaId={session.empresa.id}/> : <Company key={session.empresa.id}/>}
      </div>
    </div>
  </div>;
}
