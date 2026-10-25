import { useEffect, useMemo, useState, useRef } from "react";
import { useAgendaContext } from "./AgendaContext";
import AgendaPainelHoje from "./AgendaPainelHoje";
import { AgendaBarraAcoes } from "./AgendaAcoes";
import {
  pfLocal,
  pfDia,
  pfRotulo,
  pfSituacao,
  pfItensHoje,
  pfDestaqueHoje,
} from "./agendaUtils";

export default function AgendaHoje({ ativo }) {
  const {
    api,
    profissionais,
    revisaoHoje,
    selecionado,
    setSelecionado,
    setAviso,
  } = useAgendaContext();
  const [visao, setVisao] = useState("LISTA");
  const subTabs = useRef([]);
  const [profissional, setProfissional] = useState("");
  const [agora, setAgora] = useState(() => new Date());
  const [recarregar, setRecarregar] = useState(0);
  const [estado, setEstado] = useState({
    chave: "",
    agendas: [],
    itens: [],
    falhas: [],
    carregando: true,
    atualizado: null,
  });
  const hoje = pfLocal(agora).slice(0, 10);
  const chave = hoje + ":" + (visao === "PAINEL" ? "TODOS" : profissional);
  const alvos = useMemo(
    () =>
      profissionais.filter(
        (p) =>
          visao === "PAINEL" || !profissional || String(p.id) === profissional,
      ),
    [profissionais, profissional, visao],
  );

  useEffect(() => {
    if (!ativo) return;
    setAgora(new Date());
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setAgora(new Date());
    }, 30000);
    const visivel = () => {
      if (document.visibilityState === "visible") setAgora(new Date());
    };
    document.addEventListener("visibilitychange", visivel);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [ativo]);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false,
      ocupado = false;
    async function carregar() {
      if (ocupado || cancelado) return;
      ocupado = true;
      setEstado((e) => ({
        ...e,
        chave,
        itens: e.chave === chave ? e.itens : [],
        agendas: e.chave === chave ? e.agendas : [],
        falhas: [],
        carregando: true,
      }));
      const agendas = [],
        itens = [],
        falhas = [];
      let proximo = 0;
      // Evita disparar uma chamada simultânea para cada profissional da empresa.
      async function trabalhador() {
        while (!cancelado && proximo < alvos.length) {
          const p = alvos[proximo++];
          try {
            const r = await api("CONSULTAR_DISPONIBILIDADE_AGENDA", {
              profissional_id: String(p.id),
              data_inicio: hoje,
              data_fim: hoje,
            });
            if (
              String(r.profissional_id) !== String(p.id) ||
              !Array.isArray(r.dias)
            )
              throw Error("A resposta não corresponde ao profissional.");
            agendas.push({ profissional: p, dados: r });
            itens.push(...pfItensHoje(r, hoje, p));
          } catch (e) {
            falhas.push({ id: p.id, nome: p.nome, erro: e.message });
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(3, alvos.length) }, () => trabalhador()),
      );
      if (!cancelado) {
        itens.sort(
          (a, b) =>
            new Date(a.agendada_para || a.inicio) -
              new Date(b.agendada_para || b.inicio) ||
            String(a.profissional_nome).localeCompare(
              String(b.profissional_nome),
              "pt-BR",
            ) ||
            String(a.id).localeCompare(String(b.id)),
        );
        setEstado({
          chave,
          agendas,
          itens,
          falhas,
          carregando: false,
          atualizado: new Date(),
        });
      }
      ocupado = false;
    }
    carregar();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, 60000);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [ativo, api, alvos, hoje, chave, recarregar, revisaoHoje]);

  const itens = estado.chave === chave ? estado.itens : [];
  const carregando = estado.chave !== chave || estado.carregando;
  const contagens = itens.reduce(
    (r, t) => {
      const situacao = pfSituacao(t),
        destaque = pfDestaqueHoje(t, agora);
      if (destaque === "PROXIMO") r.proximos++;
      if (destaque === "ATRASADO") r.atrasados++;
      if (situacao === "CHEGOU") r.chegaram++;
      if (situacao === "CONCLUIDO") r.concluidos++;
      return r;
    },
    { proximos: 0, atrasados: 0, chegaram: 0, concluidos: 0 },
  );
  const selecionadoHoje =
    selecionado?._origem === "HOJE" &&
    (itens.some(
      (t) =>
        String(t.id) === String(selecionado.id) &&
        String(t.profissional_id) === String(selecionado.profissional_id),
    ) ||
      (visao === "PAINEL" &&
        estado.chave === chave &&
        estado.agendas.some(
          (a) =>
            String(a.profissional.id) === String(selecionado.profissional_id) &&
            (a.dados.dias || []).some((d) =>
              (d.horarios || []).some((h) =>
                (h.agendamentos || []).some(
                  (t) => String(t.id) === String(selecionado.id),
                ),
              ),
            ),
        )));

  return (
    <div
      role="tabpanel"
      id="pfn-panel-hoje"
      aria-labelledby="pfn-tab-hoje"
      hidden={!ativo}
      className="pfn-panel pfn-today"
    >
      <div className="pfn-today-header">
        <div>
          <h2>Atendimentos de hoje</h2>
          <p>{pfDia(hoje)} · Horário de Brasília</p>
        </div>
        <span className="pfn-today-update">
          {estado.atualizado && estado.chave === chave
            ? `Atualizado às ${pfLocal(estado.atualizado).slice(11, 16)}`
            : ""}
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Visualização de hoje"
        className="pfn-today-subtabs"
      >
        {[
          ["LISTA", "Lista"],
          ["PAINEL", "Painel"],
        ].map(([id, label], index) => (
          <button
            type="button"
            key={id}
            role="tab"
            id={"pfn-hoje-tab-" + id}
            aria-selected={visao === id}
            aria-controls={"pfn-hoje-view-" + id}
            tabIndex={visao === id ? 0 : -1}
            ref={(el) => (subTabs.current[index] = el)}
            onClick={() => {
              setVisao(id);
              setSelecionado(null);
            }}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const n = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - index;
              setVisao(n === 0 ? "LISTA" : "PAINEL");
              setSelecionado(null);
              subTabs.current[n]?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pfn-today-filters">
        {visao === "LISTA" && (
          <label>
            Profissional de hoje
            <select
              aria-label="Profissional de hoje"
              value={profissional}
              onChange={(e) => {
                setProfissional(e.target.value);
                setSelecionado(null);
              }}
            >
              <option value="">Todos os profissionais</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {visao === "PAINEL" && (
          <span className="pfn-panel-scope">
            Todos os profissionais · horários de hoje
          </span>
        )}
        <button
          type="button"
          className="pfn-secondary"
          disabled={carregando}
          onClick={() => {
            setSelecionado(null);
            setRecarregar((n) => n + 1);
          }}
        >
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <div className="pfn-today-counters">
        <span>
          <b>{itens.length}</b> atendimentos
        </span>
        <span className="pfn-today-next">
          <b>{contagens.proximos}</b> em até 30 min
        </span>
        <span>
          <b>{contagens.chegaram}</b> chegaram
        </span>
        <span className="pfn-today-late">
          <b>{contagens.atrasados}</b> atrasados
        </span>
        <span>
          <b>{contagens.concluidos}</b> concluídos
        </span>
      </div>
      {estado.chave === chave && estado.falhas.length > 0 && (
        <div className="pfn-message pfn-error" role="alert">
          {estado.falhas.length === alvos.length
            ? "Não foi possível consultar os atendimentos."
            : "A lista está incompleta: alguns profissionais não puderam ser consultados."}
          <details>
            <summary>Ver detalhes</summary>
            {estado.falhas.map((f) => (
              <p key={f.id}>
                {f.nome}: {f.erro}
              </p>
            ))}
          </details>
        </div>
      )}
      {carregando && (
        <p className="pfn-today-loading" role="status">
          Consultando os atendimentos de hoje…
        </p>
      )}
      {selecionadoHoje && <AgendaBarraAcoes />}
      <div
        role="tabpanel"
        id="pfn-hoje-view-LISTA"
        aria-labelledby="pfn-hoje-tab-LISTA"
        hidden={visao !== "LISTA"}
      >
        {!carregando && !itens.length && !estado.falhas.length && (
          <p className="pfn-state">Nenhum atendimento encontrado para hoje.</p>
        )}
        {itens.length > 0 && (
          <div className="pfn-today-list" aria-label="Atendimentos de hoje">
            {itens.map((t) => {
              const tipo = pfDestaqueHoje(t, agora),
                selecionadoAtual =
                  selecionadoHoje &&
                  String(selecionado.id) === String(t.id) &&
                  String(selecionado.profissional_id) ===
                    String(t.profissional_id);
              return (
                <button
                  type="button"
                  key={`${t.profissional_id}:${t.id}`}
                  className={`pfn-today-item pfn-today-${tipo.toLowerCase()} ${selecionadoAtual ? "pfn-today-selected" : ""}`}
                  aria-pressed={selecionadoAtual}
                  onClick={() => {
                    setAviso("");
                    setSelecionado(
                      selecionadoAtual ? null : { ...t, _origem: "HOJE" },
                    );
                  }}
                >
                  <time dateTime={t.agendada_para || t.inicio}>
                    {String(
                      t.inicio_local || pfLocal(t.agendada_para || t.inicio),
                    ).slice(11, 16)}
                  </time>
                  <span className="pfn-today-contact">
                    <strong>
                      {t.lead_nome || t.empresa_nome || "Contato não informado"}
                    </strong>
                    <span>
                      {t.profissional_nome} · #{t.id}
                    </span>
                  </span>
                  <span className="pfn-today-badges">
                    <span>{pfRotulo(t)}</span>
                    {tipo === "PROXIMO" && <small>Em até 30 min</small>}
                    {tipo === "ATRASADO" && <small>Atrasado</small>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div
        role="tabpanel"
        id="pfn-hoje-view-PAINEL"
        aria-labelledby="pfn-hoje-tab-PAINEL"
        hidden={visao !== "PAINEL"}
      >
        {visao === "PAINEL" && (
          <AgendaPainelHoje
            agendas={estado.chave === chave ? estado.agendas : []}
            profissionais={profissionais}
            falhas={estado.chave === chave ? estado.falhas : []}
            agora={agora}
            hoje={hoje}
            carregando={carregando}
          />
        )}
      </div>
      <p className="pfn-foot">
        Clique no atendimento para ver as ações. Atualização a cada minuto
        enquanto esta aba estiver visível. “Atrasado” indica horário
        ultrapassado sem chegada registrada.
      </p>
    </div>
  );
}
