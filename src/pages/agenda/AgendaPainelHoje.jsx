import { useMemo } from "react";
import { useAgendaContext } from "./AgendaContext";
import { pfLocal, pfRotulo, pfDestaqueHoje } from "./agendaUtils";
import { montarPainelHoje } from "./painelHojeUtils";

export default function AgendaPainelHoje({
  agendas,
  profissionais,
  falhas,
  agora,
  hoje,
  carregando,
}) {
  const { selecionado, setSelecionado, setAviso, abrirNovo } =
    useAgendaContext();
  const painel = useMemo(
    () => montarPainelHoje(agendas, profissionais, falhas, hoje, agora),
    [agendas, profissionais, falhas, hoje, agora],
  );
  function escolher(t) {
    const igual =
      String(selecionado?.id) === String(t.id) &&
      String(selecionado?.profissional_id) === String(t.profissional_id);
    setAviso("");
    setSelecionado(igual ? null : { ...t, _origem: "HOJE" });
  }
  function atendimento(t) {
    const igual =
      String(selecionado?.id) === String(t.id) &&
      String(selecionado?.profissional_id) === String(t.profissional_id);
    const atrasado = pfDestaqueHoje(t, agora) === "ATRASADO";
    return (
      <button
        type="button"
        key={t.id}
        className={"pfn-day-appointment " + (igual ? "is-selected" : "")}
        aria-pressed={igual}
        onClick={() => escolher(t)}
      >
        <strong>
          {t.profissional_nome} →{" "}
          {t.lead_nome || t.empresa_nome || "Contato não informado"}
        </strong>
        <small>
          {pfRotulo(t)}
          {atrasado ? " · Atrasado" : ""} · #{t.id}
        </small>
      </button>
    );
  }
  return (
    <section className="pfn-day-board" aria-label="Painel de horários de hoje">
      <p className="pfn-day-legend">
        Verde: há profissional livre · Vermelho: há atendimento · Cinza:
        bloqueado ou sem informação.
      </p>
      {painel.proxima != null && (
        <p className="pfn-day-next" role="status">
          Próximo atendimento às {pfLocal(painel.proxima).slice(11, 16)}. O
          destaque pulsa apenas nos 30 minutos anteriores.
        </p>
      )}
      {!painel.linhas.length && !carregando && (
        <p className="pfn-state">
          Nenhuma grade de horários disponível para hoje.
        </p>
      )}
      <div className="pfn-day-grid">
        {painel.linhas.map((l) => (
          <details
            key={l.inicio}
            className={
              "pfn-day-slot pfn-day-" +
              l.estado +
              (l.proximo ? " pfn-day-pulse" : "")
            }
          >
            <summary>
              <time dateTime={l.inicio}>{l.hora}</time>
              <span>
                {l.ocupados} ocupado{l.ocupados === 1 ? "" : "s"} · {l.livres}{" "}
                livre{l.livres === 1 ? "" : "s"}
              </span>
              {l.indisponiveis > 0 && (
                <small>{l.indisponiveis} bloqueado(s) / sem informação</small>
              )}
              {l.proximo && <b className="pfn-day-next-label">Próximo</b>}
            </summary>
            <div className="pfn-day-people">
              {l.pessoas.map((p) => (
                <div
                  key={p.profissional.id}
                  className={
                    "pfn-day-person pfn-day-state-" + p.estado.toLowerCase()
                  }
                >
                  {p.itens.length ? (
                    p.itens.map((t) => atendimento(t))
                  ) : p.estado === "LIVRE" ? (
                    <button
                      type="button"
                      disabled={
                        Date.parse(l.inicio) <= new Date(agora).getTime() ||
                        carregando
                      }
                      onClick={() => abrirNovo(p.slot, p.profissional.id)}
                    >
                      <strong>{p.profissional.nome} → Livre</strong>
                      <small>
                        {Date.parse(l.inicio) <= new Date(agora).getTime()
                          ? "Horário passado"
                          : "Novo agendamento"}
                      </small>
                    </button>
                  ) : (
                    <p>
                      <strong>{p.profissional.nome}</strong>
                      <small>
                        {p.estado === "OCUPADO"
                          ? "Ocupado · detalhes indisponíveis"
                          : p.estado === "ERRO"
                            ? "Não foi possível consultar"
                            : p.estado === "SEM_GRADE"
                              ? "Sem grade neste horário"
                              : p.slot?.motivo_bloqueio === "ALMOCO"
                                ? "Almoço"
                                : "Bloqueado / sem expediente"}
                      </small>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
      {painel.fora.length > 0 && (
        <div className="pfn-day-outside">
          <h3>Atendimentos fora da grade</h3>
          {painel.fora.map((t) => (
            <div key={t.profissional_id + ":" + t.id}>
              <time>{pfLocal(t.agendada_para || t.inicio).slice(11, 16)}</time>
              {atendimento(t)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
