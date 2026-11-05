import { useEffect, useMemo, useState } from "react";
import { useAgendaContext } from "./AgendaContext";
import { AgendaBarraAcoes } from "./AgendaAcoes";
import {
  pfLocal,
  pfDia,
  pfRotulo,
  pfDestaqueHoje,
  pfBlocos,
} from "./agendaUtils";
import {
  pfSomarDias,
  pfSemanaProfissional,
  montarSemanaProfissional,
} from "./semanaUtils";

export default function AgendaSemanal({ ativo }) {
  const {
    api,
    profissionais,
    profissional,
    setProfissional,
    limparAgenda,
    selecionado,
    setSelecionado,
    setAviso,
    abrirNovo,
    revisaoHoje,
  } = useAgendaContext();
  const [inicio, setInicio] = useState(() => pfSemanaProfissional().inicio);
  const [agora, setAgora] = useState(() => new Date());
  const [revisao, setRevisao] = useState(0);
  const [estado, setEstado] = useState({
    chave: "",
    dados: null,
    carregando: false,
    erro: "",
    atualizado: null,
  });
  const semana = useMemo(() => pfSemanaProfissional(inicio), [inicio]);
  const hoje = pfLocal(agora).slice(0, 10);
  const prof = profissionais.find((p) => String(p.id) === profissional);
  const chave = JSON.stringify({
    profissional_id: profissional,
    data_inicio: semana.inicio,
    data_fim: semana.fim,
  });

  useEffect(() => {
    if (!ativo || prof || !profissionais.length) return;
    setProfissional(String(profissionais[0].id));
    setSelecionado(null);
  }, [ativo, prof, profissionais, setProfissional, setSelecionado]);

  useEffect(() => {
    if (!ativo) return;
    setAgora(new Date());
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setAgora(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, [ativo]);

  useEffect(() => {
    if (!ativo || !prof) return;
    let cancelado = false;
    let ocupado = false;
    async function carregar() {
      if (cancelado || ocupado) return;
      ocupado = true;
      setEstado((e) => ({
        ...e,
        chave,
        dados: e.chave === chave ? e.dados : null,
        carregando: true,
        erro: "",
      }));
      try {
        const parametros = JSON.parse(chave);
        const r = await api("CONSULTAR_DISPONIBILIDADE_AGENDA", parametros);
        if (
          !Array.isArray(r.dias) ||
          String(r.profissional_id) !== parametros.profissional_id ||
          (r.data_inicio != null && r.data_inicio !== parametros.data_inicio) ||
          (r.data_fim != null && r.data_fim !== parametros.data_fim)
        ) {
          throw Error(
            "A resposta não corresponde à semana e ao profissional escolhidos.",
          );
        }
        if (!cancelado)
          setEstado({
            chave,
            dados: r,
            carregando: false,
            erro: "",
            atualizado: new Date(),
          });
      } catch (e) {
        if (!cancelado)
          setEstado({
            chave,
            dados: null,
            carregando: false,
            erro: e.message,
            atualizado: null,
          });
      } finally {
        ocupado = false;
      }
    }
    carregar();
    const visivel = () => {
      if (document.visibilityState === "visible") {
        setAgora(new Date());
        carregar();
      }
    };
    const timer = setInterval(visivel, 60000);
    document.addEventListener("visibilitychange", visivel);
    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [ativo, api, chave, prof, revisao, revisaoHoje]);

  const atual = estado.chave === chave;
  const dados = atual ? estado.dados : null;
  const carregando = Boolean(prof) && (!atual || estado.carregando);
  const painel = useMemo(
    () => montarSemanaProfissional(dados, semana, profissional),
    [dados, semana, profissional],
  );
  const diasCompactos = useMemo(
    () =>
      semana.dias.map((data, coluna) => {
        const celulas = painel.linhas.map((linha) => linha.celulas[coluna]);
        const horarios = celulas.flatMap((c, index) => {
          if (!c.slot || c.oculta) return [];
          const fim = celulas[index + c.rowSpan - 1]?.slot?.fim || c.slot.fim;
          return [
            {
              ...c.slot,
              inicio: new Date(c.slot.inicio).toISOString(),
              fim: new Date(fim).toISOString(),
              hora_inicio: pfLocal(c.slot.inicio).slice(11, 16),
              hora_fim: pfLocal(fim).slice(11, 16),
              situacao: c.estado,
              agendamentos: c.itens,
            },
          ];
        });
        return {
          data,
          livres: celulas.filter((c) => c.estado === "LIVRE").length,
          ocupados: celulas.filter((c) => c.estado === "OCUPADO").length,
          blocos: pfBlocos(horarios),
        };
      }),
    [painel, semana],
  );
  const selecionadoAqui =
    selecionado?._origem === "SEMANA" &&
    painel.itens.some(
      (t) =>
        String(t.id) === String(selecionado.id) &&
        String(t.profissional_id) === String(selecionado.profissional_id),
    );

  function mudarSemana(data) {
    const nova = pfSemanaProfissional(data);
    if (!nova) return;
    setSelecionado(null);
    setAviso("");
    setInicio(nova.inicio);
  }
  function escolher(t) {
    const igual = selecionadoAqui && String(selecionado.id) === String(t.id);
    setAviso("");
    setSelecionado(
      igual ? null : { ...t, profissional_nome: prof.nome, _origem: "SEMANA" },
    );
  }
  function compromisso(t, fora = false) {
    const selecionadoAtual =
      selecionadoAqui && String(selecionado.id) === String(t.id);
    const local = t.inicio_local || pfLocal(t.agendada_para || t.inicio);
    const destaque =
      local.slice(0, 10) === hoje ? pfDestaqueHoje(t, agora) : "";
    return (
      <button
        type="button"
        key={t.id}
        disabled={carregando}
        aria-pressed={Boolean(selecionadoAtual)}
        aria-label={`${t.lead_nome || t.empresa_nome || "Contato não informado"}, ${local.slice(11, 16)}, ${pfRotulo(t)}`}
        className={`pfn-week-appointment ${selecionadoAtual ? "is-selected" : ""} ${destaque === "PROXIMO" ? "is-next" : ""}`}
        onClick={() => escolher(t)}
      >
        {(selecionadoAtual || fora) && (
          <small>
            {fora ? `${pfDia(local.slice(0, 10))} · ` : ""}
            {local.slice(11, 16)}
            {t.fim ? ` - ${pfLocal(t.fim).slice(11, 16)}` : ""}
          </small>
        )}
        <strong>
          <span aria-hidden="true">{selecionadoAtual ? "▾ " : "▸ "}</span>
          {t.lead_nome || t.empresa_nome || "Contato não informado"}
        </strong>
        {selecionadoAtual && (
          <span>
            {pfRotulo(t)} · #{t.id}
          </span>
        )}
        {destaque === "PROXIMO" && <b>Em até 30 min</b>}
        {destaque === "ATRASADO" && <b>Atrasado</b>}
      </button>
    );
  }

  return (
    <div
      role="tabpanel"
      id="pfn-panel-hoje"
      aria-labelledby="pfn-tab-hoje"
      hidden={!ativo}
      className="pfn-panel pfn-week"
    >
      <div className="pfn-week-toolbar">
        <label className="pfn-week-prof">
          Profissional
          <select
            value={profissional}
            onChange={(e) => {
              setProfissional(e.target.value);
              limparAgenda();
            }}
          >
            {profissionais.map((p) => (
              <option value={String(p.id)} key={p.id}>
                {p.nome}
                {p.especialidade_nome ? ` · ${p.especialidade_nome}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div
          className="pfn-week-navigation"
          role="group"
          aria-label="Navegar por semana"
        >
          <button
            type="button"
            aria-label="Semana anterior"
            disabled={!pfSemanaProfissional(pfSomarDias(inicio, -7))}
            onClick={() => mudarSemana(pfSomarDias(inicio, -7))}
          >
            ‹
          </button>
          <button
            type="button"
            className="pfn-secondary"
            onClick={() => {
              mudarSemana(pfLocal().slice(0, 10));
              setAgora(new Date());
              setRevisao((n) => n + 1);
            }}
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próxima semana"
            disabled={!pfSemanaProfissional(pfSomarDias(inicio, 7))}
            onClick={() => mudarSemana(pfSomarDias(inicio, 7))}
          >
            ›
          </button>
        </div>
        <label>
          Ir para a semana de
          <input
            type="date"
            value={inicio}
            min="0001-01-08"
            max="9999-12-24"
            onChange={(e) => mudarSemana(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={carregando || !prof}
          onClick={() => {
            setSelecionado(null);
            setRevisao((n) => n + 1);
          }}
        >
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <div className="pfn-results-header">
        <div>
          <h2>Agenda semanal{prof ? ` de ${prof.nome}` : ""}</h2>
          <p aria-live="polite">
            {pfDia(semana.inicio)} a {pfDia(semana.fim)} · Horário de Brasília
          </p>
        </div>
        {atual && estado.atualizado && (
          <span className="pfn-today-update">
            Atualizado às {pfLocal(estado.atualizado).slice(11, 16)}
          </span>
        )}
      </div>
      {carregando && (
        <p className="pfn-week-loading" role="status">
          Consultando a semana…
        </p>
      )}
      {atual && estado.erro && (
        <p className="pfn-message pfn-error" role="alert">
          {estado.erro}
        </p>
      )}
      {dados && (
        <>
          <div className="pfn-totals">
            <span>
              <b>{painel.itens.length}</b> atendimentos na semana
            </span>
            <span>
              <b>{painel.livres}</b> horários livres
            </span>
          </div>
          {selecionadoAqui && !carregando && <AgendaBarraAcoes />}
          <div className="pfn-week-legend">
            <span>● Livre</span>
            <span>● Atendimento</span>
            <span>● Bloqueado ou sem informação</span>
          </div>
          {!painel.linhas.length ? (
            <p className="pfn-state">
              Nenhuma grade de horários retornada para esta semana.
            </p>
          ) : (
            <div
              className="pfn-week-scroll pfn-week-compact-scroll"
              role="region"
              aria-label="Grade semanal de horários"
              tabIndex={0}
              aria-busy={carregando}
            >
              <div className="pfn-week-compact-board">
                {diasCompactos.map((dia, index) => (
                  <details
                    key={`${chave}:${dia.data}`}
                    className={`pfn-day pfn-week-compact-day ${dia.data === hoje ? "is-today" : ""}`}
                  >
                    <summary
                      aria-label={`${["Segunda", "Terça", "Quarta", "Quinta", "Sexta"][index]}, ${pfDia(dia.data)}, ${dia.livres} livres, ${dia.ocupados} ocupados`}
                      aria-current={dia.data === hoje ? "date" : undefined}
                    >
                      <strong>
                        {["Seg.", "Ter.", "Qua.", "Qui.", "Sex."][index]},{" "}
                        {pfDia(dia.data).slice(0, 5)}
                        {dia.data === hoje ? " · Hoje" : ""}
                      </strong>
                      <small>
                        {dia.livres} livres · {dia.ocupados} ocupados
                      </small>
                    </summary>
                    <div className="pfn-slots">
                      {!dia.blocos.length && (
                        <p className="pfn-week-unavailable">
                          Sem grade de horários.
                        </p>
                      )}
                      {dia.blocos.map((h) => {
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
                                  : h.situacao === "SEM_GRADE"
                                    ? "Sem grade"
                                    : h.motivo_bloqueio === "ALMOCO"
                                      ? "Almoço"
                                      : "Sem expediente"}
                            </span>
                          </>
                        );
                        return h.situacao === "LIVRE" ? (
                          <details
                            key={h.inicio}
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
                              aria-label={`Horários livres de ${pfDia(dia.data)}`}
                            >
                              {h.originais.map((slot) => (
                                <button
                                  type="button"
                                  key={slot.inicio}
                                  disabled={
                                    carregando ||
                                    Date.parse(slot.inicio) <= agora.getTime()
                                  }
                                  aria-label={`Agendar ${prof?.nome}, ${pfDia(dia.data)} às ${slot.hora_inicio}`}
                                  onClick={() => abrirNovo(slot, profissional)}
                                >
                                  {slot.hora_inicio}
                                </button>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <div
                            key={h.inicio}
                            className={`pfn-slot pfn-${String(h.situacao).toLowerCase()}`}
                          >
                            <div className="pfn-slot-head">{cabecalho}</div>
                            {h.agendamentos.map((t) => compromisso(t))}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
          {painel.fora.length > 0 && (
            <section className="pfn-week-outside">
              <h3>Atendimentos fora da grade</h3>
              <div>{painel.fora.map((t) => compromisso(t, true))}</div>
            </section>
          )}
        </>
      )}
      <p className="pfn-foot">
        Segunda a sexta. As setas mudam uma semana por vez e mantêm o
        profissional selecionado. Abra um dia para ver as faixas; abra uma faixa
        livre para escolher o horário. Clique no contato para ver as ações.
        Atualização a cada minuto enquanto esta aba estiver visível.
      </p>
    </div>
  );
}
