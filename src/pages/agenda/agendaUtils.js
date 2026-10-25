export const pfTipos = {
  LIGAR: "Ligar",
  REUNIAO: "Reunião",
  ENVIAR_MENSAGEM: "Enviar mensagem",
  ENVIAR_PROPOSTA: "Enviar proposta",
  COBRAR_RESPOSTA: "Retornar contato",
  VISITAR: "Visitar",
  OUTRO: "Outra ação",
};
export const pfAcoes = {
  CONFIRMAR: "Confirmar presença",
  REMARCAR: "Remarcar",
  CHEGOU: "Chegou",
  CONCLUIR: "Concluir",
  FALTOU: "Faltou",
  CANCELAR: "Cancelar",
};
export function pfLocal(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (key) => parts.find((item) => item.type === key)?.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
 
export function pfSemana() {
  const inicio = pfLocal().slice(0, 10);
  const d = new Date(inicio + "T12:00:00Z");

  d.setUTCDate(d.getUTCDate() + 7);

  return {
    inicio,
    fim: d.toISOString().slice(0, 10),
  };
}

export function pfDia(s) {
  return String(s || "")
    .split("-")
    .reverse()
    .join("/");
}
export function pfSituacao(t) {
  if (t.status === "CANCELADA") return "CANCELADO";
  if (t.status === "CONCLUIDA")
    return t.situacao_atendimento === "FALTOU" ? "FALTOU" : "CONCLUIDO";
  return ["CONFIRMADO", "CHEGOU"].includes(t.situacao_atendimento)
    ? t.situacao_atendimento
    : "AGENDADO";
}
export function pfRotulo(t) {
  return {
    AGENDADO: "Agendado",
    CONFIRMADO: "Confirmado",
    CHEGOU: "Cliente chegou",
    CONCLUIDO: "Concluído",
    FALTOU: "Faltou",
    CANCELADO: "Cancelado",
  }[pfSituacao(t)];
}
export function pfPode(t, acao) {
  if (!t) return false;
  const s = pfSituacao(t);
  if (acao === "REMARCAR")
    return ["AGENDADO", "CONFIRMADO", "FALTOU"].includes(s);
  if (t.status !== "PENDENTE") return false;
  if (acao === "CONFIRMAR") return s === "AGENDADO";
  if (acao === "CHEGOU") return ["AGENDADO", "CONFIRMADO"].includes(s);
  if (acao === "FALTOU")
    return (
      s !== "CHEGOU" &&
      new Date(t.agendada_para || t.inicio).getTime() <= Date.now()
    );
  return ["REMARCAR", "CONCLUIR", "CANCELAR"].includes(acao);
}
export function pfResposta(valor, empresa, depth = 0) {
  if (depth > 10 || valor == null)
    throw Error("O servidor não retornou os dados esperados.");
  if (typeof valor === "string") {
    let parsed;
    try {
      parsed = JSON.parse(valor);
    } catch {
      throw Error("O servidor não retornou JSON válido.");
    }
    return pfResposta(parsed, empresa, depth + 1);
  }
  if (Array.isArray(valor)) return pfResposta(valor[0], empresa, depth + 1);
  if (typeof valor !== "object") throw Error("Resposta inválida da agenda.");
  if (valor.ok === false || valor.error || valor.erro)
    throw Error(
      String(
        valor.erro ||
          valor.mensagem ||
          valor.message ||
          valor.error?.message ||
          valor.error ||
          "Não foi possível concluir a operação.",
      ),
    );
  if (valor.empresa_id != null && String(valor.empresa_id) !== String(empresa))
    throw Error("A resposta pertence a outra empresa. Entre novamente.");
  if (
    Array.isArray(valor.dias) ||
    Array.isArray(valor.dados) ||
    typeof valor.encontrado === "boolean" ||
    valor.tarefa?.id
  )
    return valor;
  for (const k of ["resultado", "prospectflow_api", "body", "data"])
    if (valor[k] != null) return pfResposta(valor[k], empresa, depth + 1);
  return valor;
}
export function pfBlocos(horarios) {
  const blocos = [];
  for (const h of horarios || []) {
    const ultimo = blocos.at(-1);
    if (
      h.situacao !== "OCUPADO" &&
      ultimo &&
      ultimo.situacao === h.situacao &&
      ultimo.motivo_bloqueio === h.motivo_bloqueio &&
      ultimo.fim === h.inicio
    ) {
      ultimo.fim = h.fim;
      ultimo.hora_fim = h.hora_fim;
      ultimo.originais.push(h);
    } else blocos.push({ ...h, originais: [h] });
  }
  return blocos;
}
export function pfRequisicao(ref, payload) {
  const signature = JSON.stringify(payload);
  if (!ref.current || ref.current.signature !== signature)
    ref.current = { signature, id: crypto.randomUUID() };
  return { ...payload, requisicao_id: ref.current.id };
}

export function pfItensHoje(resposta, hoje, profissional) {
  const itens = new Map();
  const todos = [
    ...(resposta.agendamentos || []),
    ...(resposta.dias || []).flatMap((d) =>
      (d.horarios || []).flatMap((h) => h.agendamentos || []),
    ),
  ];
  for (const t of todos) {
    if (t.id == null || t.status === "CANCELADA") continue;
    if (
      t.profissional_id != null &&
      String(t.profissional_id) !== String(profissional.id)
    )
      continue;
    const inicio = pfLocal(t.agendada_para || t.inicio);
    if (inicio.slice(0, 10) !== hoje) continue;
    const chave = String(profissional.id) + ":" + String(t.id);
    itens.set(chave, {
      ...itens.get(chave),
      ...t,
      profissional_id: String(profissional.id),
      profissional_nome: profissional.nome,
      inicio_local: t.inicio_local || inicio,
    });
  }
  return [...itens.values()];
}
export function pfDestaqueHoje(t, agora = new Date()) {
  const s = pfSituacao(t);
  if (["CHEGOU", "CONCLUIDO", "FALTOU", "CANCELADO"].includes(s)) return s;
  const minutos =
    (new Date(t.agendada_para || t.inicio).getTime() -
      new Date(agora).getTime()) /
    60000;
  if (minutos < 0) return "ATRASADO";
  if (minutos <= 30) return "PROXIMO";
  return "AGENDADO";
}
