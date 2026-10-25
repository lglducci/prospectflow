import { useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../lib/theme";
import useAgenda from "./useAgenda";
import { AgendaContext } from "./AgendaContext";
import AgendaHoje from "./AgendaHoje";
import AgendaPeriodo from "./AgendaPeriodo";
import NovoAgendamento from "./NovoAgendamento";
import AgendaAcoes from "./AgendaAcoes";
import "./Agenda.css";
export default function Agenda() {
  const { session } = useAuth();
  const empresa = String(session?.empresa?.id ?? "");
  return empresa ? (
    <AgendaEmpresa key={empresa} empresaId={empresa} />
  ) : (
    <p role="alert">Entre no ProspectFlow para abrir a agenda.</p>
  );
}
function AgendaEmpresa({ empresaId }) {
  const { dark } = useTheme();
  const agenda = useAgenda(empresaId);
  const tabsRef = useRef([]);
  const {
    aba,
    setAba,
    abrirNovo,
    carregandoProf,
    erroProf,
    setTentativa,
    profissionais,
    aviso,
    setSelecionado,
  } = agenda;
  const abas = [
    { id: "HOJE", nome: "Hoje", tab: "pfn-tab-hoje", panel: "pfn-panel-hoje" },
    {
      id: "AGENDA",
      nome: "Agendamentos",
      tab: "pfn-tab-0",
      panel: "pfn-panel-0",
    },
    {
      id: "NOVO",
      nome: "Novo agendamento",
      tab: "pfn-tab-1",
      panel: "pfn-panel-1",
    },
  ];
  function escolher(id) {
    setSelecionado(null);
    if (id === "NOVO") abrirNovo();
    else setAba(id);
  }
  function teclado(e, index) {
    let next;
    if (e.key === "ArrowRight") next = (index + 1) % abas.length;
    else if (e.key === "ArrowLeft")
      next = (index + abas.length - 1) % abas.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = abas.length - 1;
    else return;
    e.preventDefault();
    escolher(abas[next].id);
    tabsRef.current[next]?.focus();
  }
  return (
    <AgendaContext.Provider value={{ ...agenda, empresaId }}>
      <section className={`pfn-agenda ${dark ? "pfn-dark" : ""}`}>
        <header className="pfn-header">
          <div>
            <p className="pfn-eyebrow">ATENDIMENTO</p>
            <h1>Agenda</h1>
            <p>
              Horários e compromissos por profissional · Horário de Brasília
            </p>
          </div>
          <span className="pfn-company">Sessão da empresa #{empresaId}</span>
        </header>
        <div className="pfn-shell">
          <nav className="pfn-tabs" role="tablist" aria-label="Agenda">
            {abas.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={a.tab}
                aria-controls={a.panel}
                aria-selected={aba === a.id}
                tabIndex={aba === a.id ? 0 : -1}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                onClick={() => escolher(a.id)}
                onKeyDown={(e) => teclado(e, i)}
              >
                {a.nome}
              </button>
            ))}
          </nav>
          {aviso && (
            <p className="pfn-success" role="status">
              {aviso}
            </p>
          )}
          {carregandoProf ? (
            <p className="pfn-state" role="status">
              Carregando profissionais…
            </p>
          ) : erroProf ? (
            <div className="pfn-state pfn-error" role="alert">
              {erroProf}
              <button type="button" onClick={() => setTentativa((n) => n + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : !profissionais.length ? (
            <p className="pfn-state">
              Nenhum profissional ativo cadastrado nesta empresa.
            </p>
          ) : (
            <>
              <AgendaHoje ativo={aba === "HOJE"} />
              <AgendaPeriodo />
              <NovoAgendamento />
            </>
          )}
        </div>
        <AgendaAcoes />
      </section>
    </AgendaContext.Provider>
  );
}
