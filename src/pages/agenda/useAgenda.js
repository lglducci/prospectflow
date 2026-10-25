import { useState, useEffect, useRef, useMemo } from "react";
import { criarAgendaApi } from "./agendaApi";
import { pfLocal, pfSemana, pfRequisicao } from "./agendaUtils";
export default function useAgenda(empresaId) {
  const [aba, setAba] = useState("HOJE");
  const [profissionais, setProfissionais] = useState([]),
    [carregandoProf, setCarregandoProf] = useState(true),
    [erroProf, setErroProf] = useState(""),
    [tentativa, setTentativa] = useState(0);
  const [profissional, setProfissional] = useState(""),
    [periodo, setPeriodo] = useState(pfSemana);
  const [consulta, setConsulta] = useState({
    dados: null,
    erro: "",
    carregando: false,
  });
  const [selecionado, setSelecionado] = useState(null),
    [aviso, setAviso] = useState("");
  const [modal, setModal] = useState(null),
    [enviandoAcao, setEnviandoAcao] = useState(false),
    [erroAcao, setErroAcao] = useState("");
  const [novo, setNovo] = useState({
    profissional_id: "",
    fixo: false,
    telefone: "",
    nome: "",
    dia: pfLocal().slice(0, 10),
    horario: "",
    tipo: "LIGAR",
    descricao: "",
  });
  const [contato, setContato] = useState({
    dados: null,
    erro: "",
    carregando: false,
  });
  const [horarios, setHorarios] = useState({
    dados: null,
    erro: "",
    carregando: false,
  });
  const [salvando, setSalvando] = useState(false),
    [erroNovo, setErroNovo] = useState("");
  const requests = useRef(new Set()),
    alive = useRef(true),
    agendaSeq = useRef(0),
    contatoSeq = useRef(0),
    horariosSeq = useRef(0);
  const actionRequest = useRef(null),
    saveRequest = useRef(null);
  const [revisaoHoje, setRevisaoHoje] = useState(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requests.current.forEach((c) => c.abort());
    };
  }, []);
  const api = useMemo(
    () => criarAgendaApi(empresaId, requests.current),
    [empresaId],
  );
  useEffect(() => {
    let cancelado = false;
    setCarregandoProf(true);
    setErroProf("");
    api("LISTAR_PROFISSIONAIS")
      .then((r) => {
        if (cancelado) return;
        if (!Array.isArray(r.dados))
          throw Error("Não foi possível ler a lista de profissionais.");
        const list = r.dados
          .filter((p) => p.ativo === true && String(p.empresa_id) === empresaId)
          .sort((a, b) =>
            String(a.nome).localeCompare(String(b.nome), "pt-BR"),
          );
        setProfissionais(list);
      })
      .catch((e) => {
        if (!cancelado) setErroProf(e.message);
      })
      .finally(() => {
        if (!cancelado) setCarregandoProf(false);
      });
    return () => {
      cancelado = true;
    };
  }, [api, empresaId, tentativa]);
  const nomeProf = (id) =>
    profissionais.find((p) => String(p.id) === String(id))?.nome ||
    "Profissional";
  function limparAgenda() {
    agendaSeq.current++;
    setConsulta({ dados: null, erro: "", carregando: false });
    setSelecionado(null);
    setAviso("");
  }
  async function consultar(e) {
    e?.preventDefault();
    setSelecionado(null);
    if (!profissional) {
      setConsulta({
        dados: null,
        erro: "Selecione um profissional.",
        carregando: false,
      });
      return;
    }
    if (!periodo.inicio || !periodo.fim || periodo.inicio > periodo.fim) {
      setConsulta({
        dados: null,
        erro: "Confira as datas do período.",
        carregando: false,
      });
      return;
    }
    const seq = ++agendaSeq.current;
    setConsulta({ dados: null, erro: "", carregando: true });
    try {
      const r = await api("CONSULTAR_DISPONIBILIDADE_AGENDA", {
        profissional_id: profissional,
        data_inicio: periodo.inicio,
        data_fim: periodo.fim,
      });
      if (!Array.isArray(r.dias) || String(r.profissional_id) !== profissional)
        throw Error(
          "A consulta não retornou a agenda do profissional escolhido.",
        );
      if (alive.current && seq === agendaSeq.current)
        setConsulta({ dados: r, erro: "", carregando: false });
    } catch (err) {
      if (alive.current && seq === agendaSeq.current)
        setConsulta({ dados: null, erro: err.message, carregando: false });
    }
  }
  function abrirNovo(slot = null, profissionalId = null) {
    setSelecionado(null);
    setAba("NOVO");
    setErroNovo("");
    setAviso("");
    const id =
      profissionalId != null
        ? String(profissionalId)
        : profissional || novo.profissional_id;
    if (!slot && id === novo.profissional_id) return;
    horariosSeq.current++;
    setHorarios({ dados: null, erro: "", carregando: false });
    setNovo((n) => ({
      ...n,
      profissional_id: id,
      fixo: Boolean(id),
      dia: slot ? pfLocal(slot.inicio).slice(0, 10) : n.dia,
      horario: slot ? pfLocal(slot.inicio) : "",
    }));
    if (slot) {
      setHorarios({
        dados: { dias: [{ horarios: [slot] }], profissional_id: id },
        erro: "",
        carregando: false,
      });
    }
  }
  function mudarNovo(patch) {
    setNovo((n) => ({ ...n, ...patch }));
    setErroNovo("");
  }
  function mudarTelefone(value) {
    contatoSeq.current++;
    setContato({ dados: null, erro: "", carregando: false });
    mudarNovo({ telefone: value, nome: "" });
  }
  async function buscarContato(e) {
    e?.preventDefault();
    const tel = novo.telefone.replace(/\D/g, "");
    if (tel.length < 10 || tel.length > 15) {
      setContato({
        dados: null,
        erro: "Informe o telefone com DDD.",
        carregando: false,
      });
      return;
    }
    const seq = ++contatoSeq.current;
    setContato({ dados: null, erro: "", carregando: true });
    try {
      const r = await api("CONTATO_AGENDA", {
        telefone: novo.telefone,
        criar: false,
      });
      if (typeof r.encontrado !== "boolean")
        throw Error("O servidor não confirmou os dados do contato.");
      if (alive.current && seq === contatoSeq.current) {
        setContato({ dados: r, erro: "", carregando: false });
        setNovo((n) => ({
          ...n,
          nome: r.lead?.nome || r.lead?.empresa_nome || "",
        }));
      }
    } catch (err) {
      if (alive.current && seq === contatoSeq.current)
        setContato({ dados: null, erro: err.message, carregando: false });
    }
  }
  async function verHorarios(e) {
    e?.preventDefault();
    setErroNovo("");
    if (!novo.profissional_id || !novo.dia) {
      setHorarios({
        dados: null,
        erro: "Escolha o profissional e a data.",
        carregando: false,
      });
      return;
    }
    const seq = ++horariosSeq.current;
    setNovo((n) => ({ ...n, horario: "", fixo: true }));
    setHorarios({ dados: null, erro: "", carregando: true });
    try {
      const r = await api("CONSULTAR_DISPONIBILIDADE_AGENDA", {
        profissional_id: novo.profissional_id,
        data_inicio: novo.dia,
        data_fim: novo.dia,
      });
      if (
        !Array.isArray(r.dias) ||
        String(r.profissional_id) !== novo.profissional_id
      )
        throw Error(
          "A disponibilidade não corresponde ao profissional escolhido.",
        );
      if (alive.current && seq === horariosSeq.current)
        setHorarios({ dados: r, erro: "", carregando: false });
    } catch (err) {
      if (alive.current && seq === horariosSeq.current)
        setHorarios({ dados: null, erro: err.message, carregando: false });
    }
  }
  async function salvarNovo(e) {
    e.preventDefault();
    if (salvando) return;
    setErroNovo("");
    setAviso("");
    if (!contato.dados) {
      setErroNovo("Busque o cliente pelo telefone antes de confirmar.");
      return;
    }
    if (!novo.nome.trim() || !novo.horario || !novo.profissional_id) {
      setErroNovo(
        "Informe o nome, o profissional e escolha um horário disponível.",
      );
      return;
    }
    const payload = pfRequisicao(saveRequest, {
      telefone: novo.telefone,
      nome: novo.nome.trim(),
      profissional_id: novo.profissional_id,
      tipo: novo.tipo,
      descricao: novo.descricao.trim(),
      agendada_para_local: novo.horario,
      duracao_minutos: 30,
      validar_disponibilidade: true,
    });
    setSalvando(true);
    try {
      const r = await api("SALVAR_TAREFA", payload);
      if (!r.tarefa?.id)
        throw Error(
          "O servidor não confirmou o agendamento. Consulte a agenda antes de tentar novamente.",
        );
      if (!alive.current) return;
      setAviso(
        `Agendamento #${r.tarefa.id} salvo para ${novo.nome.trim()} · ${nomeProf(novo.profissional_id)}.`,
      );
      setNovo((n) => ({
        ...n,
        telefone: "",
        nome: "",
        horario: "",
        descricao: "",
      }));
      setContato({ dados: null, erro: "", carregando: false });
      setHorarios({ dados: null, erro: "", carregando: false });
      saveRequest.current = null;
      setRevisaoHoje((v) => v + 1);
      limparAgenda();
      setAviso(
        `Agendamento #${r.tarefa.id} salvo para ${novo.nome.trim()} · ${nomeProf(novo.profissional_id)}.`,
      );
    } catch (err) {
      if (alive.current) setErroNovo(err.message);
    } finally {
      if (alive.current) setSalvando(false);
    }
  }
  const retornoSeq = useRef(0);
  const [retornoHorarios, setRetornoHorarios] = useState({
    itens: [],
    erro: "",
    carregando: false,
  });
  function mudarRetorno(campo, valor) {
    if (enviandoAcao) return;
    retornoSeq.current++;
    setRetornoHorarios({ itens: [], erro: "", carregando: false });
    setModal((m) => m && { ...m, [campo]: valor, retornoHorario: "" });
  }
  async function consultarRetorno() {
    if (!modal || !selecionado || enviandoAcao) return;
    const dia = modal.retornoDia,
      pro = String(selecionado.profissional_id ?? profissional);
    if (!dia) {
      setRetornoHorarios({
        itens: [],
        erro: "Escolha a data do retorno.",
        carregando: false,
      });
      return;
    }
    const seq = ++retornoSeq.current;
    setModal((m) => ({ ...m, retornoHorario: "" }));
    setRetornoHorarios({ itens: [], erro: "", carregando: true });
    try {
      const dados = await api("CONSULTAR_DISPONIBILIDADE_AGENDA", {
        profissional_id: pro,
        data_inicio: dia,
        data_fim: dia,
      });
      if (!alive.current || seq !== retornoSeq.current) return;
      if (String(dados.profissional_id) !== pro)
        throw Error("Profissional divergente na consulta.");
      const slots = (dados.dias || [])
        .filter((d) => d.data === dia)
        .flatMap((d) => d.horarios || [])
        .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
      const duracao = Number(selecionado.duracao_minutos || 30) * 60000;
      const itens = slots
        .filter((h) => {
          const start = Date.parse(h.inicio),
            end = start + duracao;
          if (
            h.situacao !== "LIVRE" ||
            !Number.isFinite(start) ||
            start <= Date.now() ||
            start <= Date.parse(selecionado.agendada_para || selecionado.inicio)
          )
            return false;
          let cursor = start;
          for (const b of slots) {
            const a = Date.parse(b.inicio),
              fim = Date.parse(b.fim);
            if (fim <= cursor) continue;
            if (a > cursor || b.situacao !== "LIVRE") break;
            cursor = Math.max(cursor, fim);
            if (cursor >= end) break;
          }
          return cursor >= end;
        })
        .map((h) => ({
          local: dia + "T" + h.hora_inicio,
          hora: h.hora_inicio,
        }));
      setRetornoHorarios({
        itens,
        erro: itens.length
          ? ""
          : "Nenhum horário livre para a duração deste atendimento.",
        carregando: false,
      });
    } catch (e) {
      if (alive.current && seq === retornoSeq.current)
        setRetornoHorarios({ itens: [], erro: e.message, carregando: false });
    }
  }
  useEffect(() => {
    if (!modal) retornoSeq.current++;
  }, [modal]);
  function abrirAcao(acao) {
    retornoSeq.current++;
    setRetornoHorarios({ itens: [], erro: "", carregando: false });
    actionRequest.current = null;
    setErroAcao("");
    setModal({
      acao,
      agendarRetorno: false,
      retornoDia: "",
      retornoHorario: "",
      retornoDescricao: "",
      motivo: "",
      data: String(
        selecionado.inicio_local ||
          pfLocal(selecionado.agendada_para || selecionado.inicio),
      ).slice(0, 16),
    });
  }
  async function executarAcao(e) {
    e.preventDefault();
    if (enviandoAcao || !modal || !selecionado) return;
    setErroAcao("");
    if (
      modal.acao === "CONCLUIR" &&
      modal.agendarRetorno &&
      (!modal.retornoHorario ||
        retornoHorarios.carregando ||
        !retornoHorarios.itens.some((h) => h.local === modal.retornoHorario))
    ) {
      setErroAcao("Consulte e escolha um horário livre para o retorno.");
      return;
    }
    const payload = pfRequisicao(actionRequest, {
      tarefa_id: String(selecionado.id),
      profissional_id: String(selecionado.profissional_id ?? profissional),
      acao: modal.acao,
      updated_at_original: selecionado.updated_at,
      agendada_para_original: selecionado.agendada_para || selecionado.inicio,
      status_original: selecionado.status,
      motivo: modal.motivo.trim(),
      ...(modal.acao === "CONCLUIR"
        ? {
            agendar_retorno: modal.agendarRetorno,
            ...(modal.agendarRetorno
              ? {
                  retorno_agendada_para_local: modal.retornoHorario,
                  retorno_descricao: modal.retornoDescricao.trim(),
                }
              : {}),
          }
        : {}),
      ...(modal.acao === "REMARCAR" ? { agendada_para_local: modal.data } : {}),
    });
    setEnviandoAcao(true);
    try {
      const r = await api("ACAO_AGENDA", payload);
      if (r.ok !== true) throw Error("O servidor não confirmou a alteração.");
      if (
        modal.acao === "CONCLUIR" &&
        modal.agendarRetorno &&
        (r.retorno_criado !== true || !r.tarefa_retorno?.id)
      )
        throw Error(
          "O servidor recebeu a conclusão, mas não confirmou o retorno. Confira a agenda antes de tentar novamente e verifique a versão de fn_agenda_acao.",
        );
      if (!alive.current) return;
      setModal(null);
      setSelecionado(null);
      actionRequest.current = null;
      setRevisaoHoje((v) => v + 1);
      if (aba === "AGENDA") await consultar();
      else limparAgenda();
      setAviso(
        r.retorno_criado
          ? `Atendimento concluído. Retorno #${r.tarefa_retorno.id} agendado para ${modal.retornoHorario.slice(0, 10).split("-").reverse().join("/")} às ${modal.retornoHorario.slice(11, 16)}.`
          : "Alteração salva.",
      );
    } catch (err) {
      if (alive.current) setErroAcao(err.message);
    } finally {
      if (alive.current) setEnviandoAcao(false);
    }
  }
  const dias = consulta.dados?.dias || [];
  const totais = dias.reduce(
    (r, d) => ({
      livres: r.livres + Number(d.livres || 0),
      ocupados: r.ocupados + Number(d.ocupados || 0),
    }),
    { livres: 0, ocupados: 0 },
  );
  const visiveis = new Set(
    dias.flatMap((d) =>
      (d.horarios || []).flatMap((h) =>
        (h.agendamentos || []).map((t) => String(t.id)),
      ),
    ),
  );
  const fora = (consulta.dados?.agendamentos || []).filter(
    (t) => !visiveis.has(String(t.id)),
  );
  const livres = (horarios.dados?.dias || [])
    .flatMap((d) => d.horarios || [])
    .filter(
      (h) =>
        h.situacao === "LIVRE" && new Date(h.inicio).getTime() > Date.now(),
    );
  return {
    aba,
    setAba,
    profissionais,
    carregandoProf,
    erroProf,
    setTentativa,
    profissional,
    setProfissional,
    periodo,
    setPeriodo,
    consulta,
    selecionado,
    setSelecionado,
    aviso,
    setAviso,
    modal,
    setModal,
    enviandoAcao,
    erroAcao,
    novo,
    setNovo,
    contato,
    horarios,
    setHorarios,
    salvando,
    erroNovo,
    horariosSeq,
    api,
    nomeProf,
    limparAgenda,
    consultar,
    abrirNovo,
    mudarNovo,
    mudarTelefone,
    buscarContato,
    verHorarios,
    salvarNovo,
    abrirAcao,
    executarAcao,
    retornoHorarios,
    mudarRetorno,
    consultarRetorno,
    dias,
    totais,
    fora,
    livres,
    revisaoHoje,
  };
}
