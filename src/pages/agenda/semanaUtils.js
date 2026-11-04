import { pfLocal, pfHistorico } from "./agendaUtils";

export function pfSomarDias(data, quantidade) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  const d = new Date(data + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== data)
    return "";
  d.setUTCDate(d.getUTCDate() + quantidade);
  if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 9999) return "";
  return d.toISOString().slice(0, 10);
}

export function pfSemanaProfissional(data = pfLocal().slice(0, 10)) {
  if (!pfSomarDias(data, 0)) return null;
  const diaSemana = new Date(data + "T12:00:00Z").getUTCDay();
  const inicio = pfSomarDias(data, diaSemana === 0 ? -6 : 1 - diaSemana);
  const fim = inicio && pfSomarDias(inicio, 4);
  if (!inicio || !fim) return null;
  return {
    inicio,
    fim,
    dias: Array.from({ length: 5 }, (_, n) => pfSomarDias(inicio, n)),
  };
}

export function montarSemanaProfissional(dados, semana, profissionalId) {
  const horarios = new Set();
  const porDia = new Map(semana.dias.map((data) => [data, new Map()]));
  const tarefas = new Map();
  const visiveis = new Set();
  const pertence = (t) =>
    t.id != null &&
    !pfHistorico(t) &&
    (t.profissional_id == null ||
      String(t.profissional_id) === String(profissionalId));
  const guardar = (t) => {
    if (pertence(t))
      tarefas.set(String(t.id), {
        ...t,
        profissional_id: String(profissionalId),
      });
  };
  for (const t of dados?.agendamentos || []) guardar(t);
  for (const dia of dados?.dias || []) {
    const mapa = porDia.get(dia.data);
    if (!mapa) continue;
    for (const h of dia.horarios || []) {
      const local = pfLocal(h.inicio);
      const hora = local.slice(11, 16);
      if (
        !local ||
        local.slice(0, 10) !== dia.data ||
        !Number.isFinite(Date.parse(h.fim)) ||
        Date.parse(h.fim) <= Date.parse(h.inicio)
      )
        continue;
      const itens = (h.agendamentos || []).filter(pertence);
      for (const t of itens) {
        guardar(t);
        visiveis.add(String(t.id));
      }
      let estado = itens.length ? "OCUPADO" : h.situacao;
      if (!["LIVRE", "OCUPADO", "BLOQUEADO"].includes(estado))
        estado = "SEM_GRADE";
      horarios.add(hora);
      mapa.set(hora, { slot: h, itens, estado, rowSpan: 1, oculta: false });
    }
  }
  const linhas = [...horarios].sort().map((hora) => ({
    hora,
    celulas: semana.dias.map((data) => ({
      data,
      ...(porDia.get(data).get(hora) || {
        estado: "SEM_GRADE",
        itens: [],
        slot: null,
        rowSpan: 1,
        oculta: false,
      }),
    })),
  }));
  // Une os blocos consecutivos ocupados pela mesma consulta para exibir um único cartão.
  for (let coluna = 0; coluna < semana.dias.length; coluna++) {
    for (let i = 0; i < linhas.length; i++) {
      const atual = linhas[i].celulas[coluna];
      if (atual.oculta || atual.estado !== "OCUPADO" || !atual.itens.length)
        continue;
      const assinatura = atual.itens
        .map((t) => String(t.id))
        .sort()
        .join(":");
      let anterior = atual;
      for (let j = i + 1; j < linhas.length; j++) {
        const proxima = linhas[j].celulas[coluna];
        if (
          proxima.estado !== "OCUPADO" ||
          proxima.itens
            .map((t) => String(t.id))
            .sort()
            .join(":") !== assinatura ||
          Date.parse(anterior.slot?.fim) !== Date.parse(proxima.slot?.inicio)
        )
          break;
        atual.rowSpan++;
        proxima.oculta = true;
        anterior = proxima;
      }
    }
  }
  const itens = [...tarefas.values()].sort(
    (a, b) =>
      Date.parse(a.agendada_para || a.inicio) -
      Date.parse(b.agendada_para || b.inicio),
  );
  return {
    linhas,
    itens,
    fora: itens.filter((t) => !visiveis.has(String(t.id))),
    livres: linhas.reduce(
      (n, l) => n + l.celulas.filter((c) => c.estado === "LIVRE").length,
      0,
    ),
  };
}
