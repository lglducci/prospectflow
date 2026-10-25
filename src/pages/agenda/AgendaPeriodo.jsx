import { useAgendaContext } from "./AgendaContext";
import AgendaCompromisso from "./AgendaCompromisso";
import { AgendaBarraAcoes } from "./AgendaAcoes";
import { pfDia, pfBlocos } from "./agendaUtils";
export default function AgendaPeriodo() {
  const {
    aba,
    profissionais,
    profissional,
    setProfissional,
    periodo,
    setPeriodo,
    consulta,
    nomeProf,
    limparAgenda,
    consultar,
    abrirNovo,
    dias,
    totais,
    fora,
  } = useAgendaContext();
  return (
    <div
      role="tabpanel"
      id="pfn-panel-0"
      aria-labelledby="pfn-tab-0"
      hidden={aba !== "AGENDA"}
      className="pfn-panel"
    >
      <form className="pfn-filters" onSubmit={consultar}>
        <label className="pfn-prof">
          Profissional
          <select
            aria-label="Profissional"
            required
            value={profissional}
            onChange={(e) => {
              setProfissional(e.target.value);
              limparAgenda();
            }}
          >
            <option value="">Selecione um profissional</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.especialidade_nome ? ` · ${p.especialidade_nome}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data inicial
          <input
            type="date"
            required
            value={periodo.inicio}
            onChange={(e) => {
              setPeriodo((p) => ({ ...p, inicio: e.target.value }));
              limparAgenda();
            }}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            required
            value={periodo.fim}
            onChange={(e) => {
              setPeriodo((p) => ({ ...p, fim: e.target.value }));
              limparAgenda();
            }}
          />
        </label>
        <button
          className="pfn-primary"
          disabled={consulta.carregando}
          type="submit"
        >
          {consulta.carregando ? "Consultando…" : "Consultar"}
        </button>
      </form>
      {consulta.erro && (
        <p className="pfn-message pfn-error" role="alert">
          {consulta.erro}
        </p>
      )}
      {consulta.carregando && (
        <p className="pfn-state" role="status">
          Consultando horários de {nomeProf(profissional)}…
        </p>
      )}
      {!consulta.dados && !consulta.carregando && !consulta.erro && (
        <p className="pfn-state">
          Escolha um profissional e o período para consultar a agenda.
        </p>
      )}
      {consulta.dados && (
        <>
          <div className="pfn-results-header">
            <div>
              <h2>Agenda de {nomeProf(profissional)}</h2>
              <p>
                {pfDia(periodo.inicio)} a {pfDia(periodo.fim)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => abrirNovo()}
              className="pfn-secondary"
            >
              ＋ Novo agendamento
            </button>
          </div>
          <div className="pfn-totals">
            <span>
              <b>{totais.livres}</b> horários livres
            </span>
            <span>
              <b>{totais.ocupados}</b> horários ocupados
            </span>
            <span>
              <b>{Number(consulta.dados.resumo?.total_agendamentos || 0)}</b>{" "}
              compromissos
            </span>
          </div>
          <AgendaBarraAcoes />
          <div className="pfn-legend">
            <span>● Livre</span>
            <span>● Ocupado</span>
            <span>● Bloqueado</span>
          </div>
          <div className="pfn-board">
            {dias.map((d) => (
              <details className="pfn-day" key={d.data} open={dias.length <= 7}>
                <summary>
                  <strong>
                    {new Date(d.data + "T12:00:00Z").toLocaleDateString(
                      "pt-BR",
                      {
                        timeZone: "UTC",
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      },
                    )}
                  </strong>
                  <small>
                    {Number(d.livres || 0)} livres · {Number(d.ocupados || 0)}{" "}
                    ocupados
                  </small>
                </summary>
                <div className="pfn-slots">
                  {pfBlocos(d.horarios).map((h, i) => {
                    const opcoes = h.originais.filter(
                      (s) =>
                        s.situacao === "LIVRE" &&
                        new Date(s.inicio).getTime() > Date.now(),
                    );
                    const cabecalho = (
                      <>
                        <time>
                          {h.hora_inicio}–{h.hora_fim}
                        </time>
                        <span>
                          {h.situacao === "LIVRE"
                            ? "Livre"
                            : h.situacao === "OCUPADO"
                              ? "Ocupado"
                              : h.motivo_bloqueio === "ALMOCO"
                                ? "Almoço"
                                : "Sem expediente"}
                        </span>
                      </>
                    );
                    return h.situacao === "LIVRE" && opcoes.length > 0 ? (
                      <details
                        key={h.inicio || i}
                        className="pfn-slot pfn-livre pfn-free-options"
                      >
                        <summary
                          className="pfn-slot-head"
                          aria-label={`${h.hora_inicio} a ${h.hora_fim}, livre. Escolher horário para agendar.`}
                        >
                          {cabecalho}
                        </summary>
                        <div
                          className="pfn-free-picker"
                          role="group"
                          aria-label="Escolher horário para agendar"
                        >
                          {opcoes.map((s) => (
                            <button
                              type="button"
                              key={s.inicio}
                              onClick={() => abrirNovo(s)}
                            >
                              {s.hora_inicio}
                            </button>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div
                        className={`pfn-slot pfn-${String(h.situacao).toLowerCase()}`}
                        key={h.inicio || i}
                      >
                        <div className="pfn-slot-head">{cabecalho}</div>
                        {(h.agendamentos || []).map((t) => (
                          <AgendaCompromisso key={t.id} t={t} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
          {!dias.length && (
            <p className="pfn-message">Nenhum dia retornado para o período.</p>
          )}
          {fora.length > 0 && (
            <details className="pfn-outside">
              <summary>{fora.length} compromisso(s) fora da grade</summary>
              {fora.map((t) => (
                <AgendaCompromisso key={t.id} t={t} />
              ))}
            </details>
          )}
          <p className="pfn-foot">
            Contagens em blocos de{" "}
            {Number(consulta.dados.configuracao?.intervalo_minutos || 30)}{" "}
            minutos. Clique no contato para ver os detalhes e as ações; clique
            em uma faixa livre para escolher um horário.
          </p>
        </>
      )}
    </div>
  );
}
