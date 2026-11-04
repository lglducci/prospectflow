import { useEffect, useMemo, useState } from "react";
import { useAgendaContext } from "./AgendaContext";
import { AgendaBarraAcoes } from "./AgendaAcoes";
import { pfLocal, pfDia, pfRotulo, pfDestaqueHoje } from "./agendaUtils";
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
        className={`pfn-week-appointment ${selecionadoAtual ? "is-selected" : ""} ${destaque === "PROXIMO" ? "is-next" : ""}`}
        onClick={() => escolher(t)}
      >
        <small>
          {fora ? `${pfDia(local.slice(0, 10))} · ` : ""}
          {local.slice(11, 16)}
          {t.fim ? ` - ${pfLocal(t.fim).slice(11, 16)}` : ""}
        </small>
        <strong>
          {t.lead_nome || t.empresa_nome || "Contato não informado"}
        </strong>
        <span>
          {pfRotulo(t)} · #{t.id}
        </span>
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
              className="pfn-week-scroll"
              role="region"
              aria-label="Grade semanal de horários"
              tabIndex={0}
              aria-busy={carregando}
            >
              <table className="pfn-week-table">
                <caption className="pfn-sr-only">
                  Agenda de {prof?.nome}, de {pfDia(semana.inicio)} a{" "}
                  {pfDia(semana.fim)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="pfn-week-hour">
                      Horário
                    </th>
                    {semana.dias.map((data, i) => (
                      <th
                        key={data}
                        scope="col"
                        className={data === hoje ? "is-today" : ""}
                        aria-current={data === hoje ? "date" : undefined}
                      >
                        <span>
                          {["Segunda", "Terça", "Quarta", "Quinta", "Sexta"][i]}
                        </span>
                        <strong>{pfDia(data).slice(0, 5)}</strong>
                        {data === hoje && <small>Hoje</small>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {painel.linhas.map((linha) => (
                    <tr key={linha.hora}>
                      <th scope="row" className="pfn-week-hour">
                        {linha.hora}
                      </th>
                      {linha.celulas.map((c) =>
                        c.oculta ? null : (
                          <td
                            key={c.data}
                            rowSpan={c.rowSpan}
                            className={`pfn-week-cell pfn-week-${c.estado.toLowerCase()} ${c.data === hoje ? "is-today" : ""}`}
                          >
                            {c.itens.length ? (
                              c.itens.map((t) => compromisso(t))
                            ) : c.estado === "LIVRE" ? (
                              <button
                                type="button"
                                className="pfn-week-free"
                                disabled={
                                  carregando ||
                                  Date.parse(c.slot.inicio) <= agora.getTime()
                                }
                                aria-label={`Agendar ${prof?.nome}, ${pfDia(c.data)} às ${linha.hora}`}
                                onClick={() => abrirNovo(c.slot, profissional)}
                              >
                                <span>Livre</span>
                                <small>
                                  {Date.parse(c.slot.inicio) <= agora.getTime()
                                    ? "Horário passado"
                                    : "+ Agendar"}
                                </small>
                              </button>
                            ) : (
                              <span className="pfn-week-unavailable">
                                {c.estado === "OCUPADO"
                                  ? "Ocupado · detalhes indisponíveis"
                                  : c.estado === "SEM_GRADE"
                                    ? "Sem grade"
                                    : c.slot?.motivo_bloqueio === "ALMOCO"
                                      ? "Almoço"
                                      : "Sem expediente"}
                              </span>
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
        profissional selecionado. Clique em um atendimento para ver as ações ou
        em um horário livre futuro para agendar. Atualização a cada minuto
        enquanto esta aba estiver visível.
      </p>
    </div>
  );
}
