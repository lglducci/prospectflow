import { useEffect, useState } from "react";
import { useAgendaContext } from "./AgendaContext";
import AgendaAbas from "./AgendaAbas";
import { pfDia, pfLocal, pfSemana, pfRotulo } from "./agendaUtils";

const TAMANHO = 50;
function dataHora(valor) {
  if (!valor) return "Não informado";
  const local = pfLocal(valor);
  return local
    ? `${pfDia(local.slice(0, 10))} às ${local.slice(11, 16)}`
    : "Não informado";
}

export default function AgendaMovimentacoes({ tipo, ativo }) {
  const { api, profissionais, revisaoHoje } = useAgendaContext();
  const remarcacao = tipo === "REMARCADO";
  const titulo = remarcacao ? "Remarcações" : "Cancelamentos";
  const prefixo = remarcacao ? "remarcacoes" : "cancelamentos";
  const [visao, setVisao] = useState("HOJE");
  const [filtros, setFiltros] = useState(() => ({
    ...pfSemana(),
    profissional: "",
    busca: "",
  }));
  const [pesquisa, setPesquisa] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [revisao, setRevisao] = useState(0);
  const [hoje, setHoje] = useState(() => pfLocal().slice(0, 10));
  const [estado, setEstado] = useState({
    chave: "",
    dados: null,
    carregando: false,
    erro: "",
  });
  const [opcoesProf, setOpcoesProf] = useState(null);
  const parametros =
    visao === "HOJE"
      ? {
          data_inicio: hoje,
          data_fim: hoje,
          profissional_id: filtros.profissional || null,
          busca: pesquisa?.busca || "",
        }
      : pesquisa;
  const chave = parametros
    ? JSON.stringify({
        ...parametros,
        tipo,
        limite: TAMANHO,
        offset: pagina * TAMANHO,
      })
    : "";

  useEffect(() => {
    if (!ativo || visao !== "HOJE") return;
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      setHoje(pfLocal().slice(0, 10));
      setRevisao((n) => n + 1);
    };
    atualizar();
    const timer = setInterval(atualizar, 60000);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [ativo, visao]);

  useEffect(() => {
    if (!ativo || !chave) return;
    let cancelado = false;
    setEstado({ chave, dados: null, carregando: true, erro: "" });
    api("CONSULTAR_MOVIMENTACOES_AGENDA", JSON.parse(chave))
      .then((r) => {
        if (cancelado) return;
        if (
          !Array.isArray(r.dados) ||
          r.tipo !== tipo ||
          r.data_inicio !== JSON.parse(chave).data_inicio ||
          r.data_fim !== JSON.parse(chave).data_fim ||
          String(r.profissional_id ?? "") !==
            String(JSON.parse(chave).profissional_id ?? "") ||
          !Number.isInteger(r.total) ||
          r.total < 0 ||
          r.offset !== JSON.parse(chave).offset ||
          r.dados.some((t) => t.tipo !== tipo || t.profissional_id == null)
        )
          throw Error(
            "O servidor não retornou o histórico solicitado. Confira a instalação da consulta de movimentações.",
          );
        if (Array.isArray(r.profissionais)) setOpcoesProf(r.profissionais);
        setEstado({ chave, dados: r, carregando: false, erro: "" });
      })
      .catch((e) => {
        if (!cancelado)
          setEstado({ chave, dados: null, carregando: false, erro: e.message });
      });
    return () => {
      cancelado = true;
    };
  }, [ativo, api, chave, revisao, revisaoHoje, tipo]);

  const atual = estado.chave === chave;
  const dados = atual ? estado.dados : null;
  const carregando = Boolean(chave) && (!atual || estado.carregando);
  const itens = dados?.dados || [];
  function mudar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(0);
    if (visao === "PERIODO") setPesquisa(null);
  }
  function consultar(e) {
    e.preventDefault();
    setPagina(0);
    setPesquisa({
      data_inicio: filtros.inicio,
      data_fim: filtros.fim,
      profissional_id: filtros.profissional || null,
      busca: filtros.busca.trim(),
    });
    setRevisao((n) => n + 1);
  }
  function destino(t) {
    return t.nova_tarefa_id ? (
      <>
        <strong>{dataHora(t.nova_agendada_para)}</strong>
        <small>
          Agendamento #{t.nova_tarefa_id} ·{" "}
          {pfRotulo({
            status: t.novo_status,
            situacao_atendimento: t.nova_situacao,
          })}
        </small>
      </>
    ) : (
      <span>Sem vínculo com novo agendamento</span>
    );
  }
  function detalhes(t) {
    return (
      <>
        <span>{t.motivo || "Motivo não registrado"}</span>
        <small>
          {t.movimentada_em
            ? `Registrado em ${dataHora(t.movimentada_em)}`
            : "Data da alteração não registrada"}
        </small>
        {t.atendente && <small>Por {t.atendente}</small>}
      </>
    );
  }
  const tabs = [
    {
      id: "PERIODO",
      nome: "Por período",
      tab: `pfn-${prefixo}-tab-periodo`,
      panel: `pfn-${prefixo}-periodo`,
    },
    {
      id: "HOJE",
      nome: "Painel hoje",
      tab: `pfn-${prefixo}-tab-hoje`,
      panel: `pfn-${prefixo}-hoje`,
    },
  ];
  return (
    <div
      role="tabpanel"
      id={`pfn-panel-${prefixo}`}
      aria-labelledby={`pfn-tab-${prefixo}`}
      hidden={!ativo}
      className="pfn-panel pfn-movements"
    >
      <AgendaAbas
        itens={tabs}
        valor={visao}
        rotulo={`${titulo}: visualização`}
        onChange={(id) => {
          setVisao(id);
          setPagina(0);
          setPesquisa(null);
          setFiltros((f) => ({ ...f, busca: "" }));
        }}
      />
      <div
        hidden
        role="tabpanel"
        id={`pfn-${prefixo}-${visao === "HOJE" ? "periodo" : "hoje"}`}
        aria-labelledby={`pfn-${prefixo}-tab-${visao === "HOJE" ? "periodo" : "hoje"}`}
      />
      <div
        role="tabpanel"
        id={`pfn-${prefixo}-${visao === "HOJE" ? "hoje" : "periodo"}`}
        aria-labelledby={`pfn-${prefixo}-tab-${visao === "HOJE" ? "hoje" : "periodo"}`}
      >
        <div className="pfn-results-header">
          <div>
            <h2>
              {titulo}
              {visao === "HOJE" ? " de horários de hoje" : " por período"}
            </h2>
            <p>
              {visao === "HOJE"
                ? pfDia(hoje)
                : "Pesquise pela data original da consulta"}{" "}
              · Horário de Brasília
            </p>
          </div>
        </div>
        <form className="pfn-filters" onSubmit={consultar}>
          <label className="pfn-prof">
            Profissional
            <select
              value={filtros.profissional}
              onChange={(e) => mudar("profissional", e.target.value)}
            >
              <option value="">Todos os profissionais</option>
              {(opcoesProf || profissionais).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.ativo === false ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </label>
          {visao === "PERIODO" && (
            <>
              <label>
                Data inicial
                <input
                  type="date"
                  required
                  value={filtros.inicio}
                  max={filtros.fim || undefined}
                  onChange={(e) => mudar("inicio", e.target.value)}
                />
              </label>
              <label>
                Data final
                <input
                  type="date"
                  required
                  min={filtros.inicio || undefined}
                  value={filtros.fim}
                  onChange={(e) => mudar("fim", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Paciente ou telefone
            <input
              type="search"
              maxLength={200}
              value={filtros.busca}
              onChange={(e) => mudar("busca", e.target.value)}
              placeholder="Todos os pacientes"
            />
          </label>
          <button type="submit" className="pfn-primary" disabled={carregando}>
            {carregando ? "Consultando…" : "Pesquisar"}
          </button>
          {visao === "HOJE" && (
            <button
              type="button"
              disabled={carregando}
              onClick={() => setRevisao((n) => n + 1)}
            >
              Atualizar
            </button>
          )}
        </form>
        <p className="pfn-foot">
          Somente consultas da agenda profissional. A data do filtro é a do
          horário original, não a data em que a alteração foi feita. Um horário
          cancelado ou remarcado pode já ter sido ocupado novamente; confira a
          disponibilidade na Agenda profissional.
        </p>
        {carregando && (
          <p className="pfn-state" role="status">
            Consultando {titulo.toLowerCase()}…
          </p>
        )}
        {atual && estado.erro && (
          <p className="pfn-message pfn-error" role="alert">
            {estado.erro}
          </p>
        )}
        {!chave && (
          <p className="pfn-state">Escolha o período e clique em Pesquisar.</p>
        )}
        {dados && (
          <>
            <div className="pfn-totals" role="status">
              <span>
                <b>{dados.total}</b> {titulo.toLowerCase()}
              </span>
              <span>
                <b>{dados.resumo?.profissionais || 0}</b> profissional(is)
              </span>
              {pesquisa?.busca && <span>Busca: {pesquisa.busca}</span>}
            </div>
            {!itens.length && (
              <p className="pfn-state">
                Nenhum registro nesta página para os filtros informados.
              </p>
            )}
            {itens.length > 0 &&
              (visao === "HOJE" ? (
                <div className="pfn-movement-cards">
                  {itens.map((t) => (
                    <article
                      key={t.tarefa_id}
                      className={`pfn-movement-card ${remarcacao ? "is-rescheduled" : "is-cancelled"}`}
                    >
                      <div className="pfn-movement-heading">
                        <time dateTime={t.agendada_para}>
                          {pfLocal(t.agendada_para).slice(11, 16)}
                        </time>
                        <span>{remarcacao ? "Remarcado" : "Cancelado"}</span>
                      </div>
                      <h3>{t.lead_nome || "Contato não informado"}</h3>
                      <p>
                        {t.profissional_nome} · #{t.tarefa_id}
                      </p>
                      {t.telefone && <p>{t.telefone}</p>}
                      {remarcacao && (
                        <div className="pfn-movement-details">
                          <small>Novo horário</small>
                          {destino(t)}
                        </div>
                      )}
                      <div className="pfn-movement-details">{detalhes(t)}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pfn-movement-table-wrap">
                  <table className="pfn-movement-table">
                    <caption>{titulo} pela data do horário original</caption>
                    <thead>
                      <tr>
                        <th scope="col">Horário original</th>
                        <th scope="col">Paciente</th>
                        <th scope="col">Profissional</th>
                        {remarcacao && <th scope="col">Novo horário</th>}
                        <th scope="col">Registro da alteração</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((t) => (
                        <tr key={t.tarefa_id}>
                          <td>
                            <strong>{dataHora(t.agendada_para)}</strong>
                            <small>
                              #{t.tarefa_id} ·{" "}
                              {remarcacao ? "Remarcado" : "Cancelado"}
                            </small>
                          </td>
                          <td>
                            <strong>
                              {t.lead_nome || "Contato não informado"}
                            </strong>
                            <small>
                              {t.telefone || "Telefone não informado"}
                            </small>
                          </td>
                          <td>{t.profissional_nome}</td>
                          {remarcacao && <td>{destino(t)}</td>}
                          <td>{detalhes(t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            <div className="pfn-movement-pagination">
              <span>
                {dados.total
                  ? `${itens.length ? pagina * TAMANHO + 1 : 0} a ${Math.min((pagina + 1) * TAMANHO, dados.total)} de ${dados.total}`
                  : "0 registros"}
              </span>
              <button
                type="button"
                disabled={carregando || pagina === 0}
                onClick={() => setPagina((n) => n - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={carregando || (pagina + 1) * TAMANHO >= dados.total}
                onClick={() => setPagina((n) => n + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
        {visao === "HOJE" && (
          <p className="pfn-foot">
            Atualização a cada minuto enquanto esta aba estiver visível.
          </p>
        )}
      </div>
    </div>
  );
}
