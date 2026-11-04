import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../lib/theme";
import useAgenda from "./useAgenda";
import { AgendaContext } from "./AgendaContext";
import AgendaSemanal from "./AgendaSemanal";
import AgendaPeriodo from "./AgendaPeriodo";
import NovoAgendamento from "./NovoAgendamento";
import AgendaAcoes from "./AgendaAcoes";
import AgendaAbas from "./AgendaAbas";
import AgendaMovimentacoes from "./AgendaMovimentacoes";
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
  const [visaoAgenda, setVisaoAgenda] = useState("HOJE");
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
  const principal = ["HOJE", "AGENDA"].includes(aba) ? "PROFISSIONAL" : aba;
  const abas = [
    {
      id: "PROFISSIONAL",
      nome: "Agenda profissional",
      tab: "pfn-tab-profissional",
      panel: "pfn-panel-profissional",
    },
    {
      id: "REMARCACOES",
      nome: "Remarcações",
      tab: "pfn-tab-remarcacoes",
      panel: "pfn-panel-remarcacoes",
    },
    {
      id: "CANCELAMENTOS",
      nome: "Cancelamentos",
      tab: "pfn-tab-cancelamentos",
      panel: "pfn-panel-cancelamentos",
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
    else setAba(id === "PROFISSIONAL" ? visaoAgenda : id);
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
          <AgendaAbas
            itens={abas}
            valor={principal}
            onChange={escolher}
            rotulo="Agenda"
            className="pfn-tabs"
          />
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
          ) : !profissionais.length &&
            !["REMARCACOES", "CANCELAMENTOS"].includes(aba) ? (
            <p className="pfn-state">
              Nenhum profissional ativo cadastrado nesta empresa.
            </p>
          ) : (
            <>
              <div
                role="tabpanel"
                id="pfn-panel-profissional"
                aria-labelledby="pfn-tab-profissional"
                hidden={principal !== "PROFISSIONAL"}
              >
                <div className="pfn-professional-subtabs">
                  <AgendaAbas
                    rotulo="Agenda profissional"
                    valor={aba}
                    itens={[
                      {
                        id: "AGENDA",
                        nome: "Por período",
                        tab: "pfn-tab-0",
                        panel: "pfn-panel-0",
                      },
                      {
                        id: "HOJE",
                        nome: "Painel semanal",
                        tab: "pfn-tab-hoje",
                        panel: "pfn-panel-hoje",
                      },
                    ]}
                    onChange={(id) => {
                      setSelecionado(null);
                      setVisaoAgenda(id);
                      setAba(id);
                    }}
                  />
                </div>
                <AgendaSemanal ativo={aba === "HOJE"} />
                <AgendaPeriodo />
              </div>
              <AgendaMovimentacoes
                tipo="REMARCADO"
                ativo={aba === "REMARCACOES"}
              />
              <AgendaMovimentacoes
                tipo="CANCELADO"
                ativo={aba === "CANCELAMENTOS"}
              />
              <NovoAgendamento />
            </>
          )}
        </div>
        <AgendaAcoes />
      </section>
    </AgendaContext.Provider>
  );
}
