import { pfLocal, pfSituacao } from "./agendaUtils";

// Nenhuma resposta ausente ou com falha é interpretada como horário livre.
export function montarPainelHoje(agendas, profissionais, falhas, hoje, agora) {
  const linhas = new Map(),
    porProf = new Map();
  const falhou = new Set(falhas.map((p) => String(p.id)));
  const tarefas = new Map();
  for (const { profissional: p, dados } of agendas) {
    const mapa = new Map();
    for (const d of dados.dias || []) {
      if (d.data !== hoje) continue;
      for (const h of d.horarios || []) {
        const inicio = Date.parse(h.inicio),
          fim = Date.parse(h.fim);
        if (
          !Number.isFinite(inicio) ||
          !Number.isFinite(fim) ||
          fim <= inicio ||
          pfLocal(h.inicio).slice(0, 10) !== hoje
        )
          continue;
        mapa.set(inicio, h);
        if (!linhas.has(inicio))
          linhas.set(inicio, {
            inicio: h.inicio,
            fim: h.fim,
            hora: h.hora_inicio || pfLocal(h.inicio).slice(11, 16),
            pessoas: [],
          });
      }
    }
    porProf.set(String(p.id), mapa);
    for (const t of [
      ...(dados.agendamentos || []),
      ...(dados.dias || []).flatMap((d) =>
        (d.horarios || []).flatMap((h) => h.agendamentos || []),
      ),
    ]) {
      if (
        t.id == null ||
        t.status === "CANCELADA" ||
        (t.profissional_id != null &&
          String(t.profissional_id) !== String(p.id))
      )
        continue;
      tarefas.set(p.id + ":" + t.id, {
        ...t,
        profissional_id: String(p.id),
        profissional_nome: p.nome,
      });
    }
  }
  const agoraMs = new Date(agora).getTime();
  const futuras = [...tarefas.values()]
    .filter((t) => ["AGENDADO", "CONFIRMADO"].includes(pfSituacao(t)))
    .map((t) => Date.parse(t.agendada_para || t.inicio))
    .filter(
      (t) =>
        t >= agoraMs &&
        t - agoraMs <= 1800000 &&
        pfLocal(t).slice(0, 10) === hoje,
    );
  const proxima = futuras.length ? Math.min(...futuras) : null;
  const resultado = [...linhas.values()].sort(
    (a, b) => Date.parse(a.inicio) - Date.parse(b.inicio),
  );
  let destaqueUsado = false;
  const visiveis = new Set();
  for (const linha of resultado) {
    const ms = Date.parse(linha.inicio);
    for (const p of profissionais) {
      const h = porProf.get(String(p.id))?.get(ms);
      let estado = falhou.has(String(p.id))
        ? "ERRO"
        : !h
          ? "SEM_GRADE"
          : h.situacao;
      const itens = new Map();
      for (const t of h?.agendamentos || []) {
        if (
          t.id == null ||
          t.status === "CANCELADA" ||
          (t.profissional_id != null &&
            String(t.profissional_id) !== String(p.id))
        )
          continue;
        itens.set(String(t.id), {
          ...t,
          profissional_id: String(p.id),
          profissional_nome: p.nome,
        });
        visiveis.add(p.id + ":" + t.id);
      }
      if (itens.size) estado = "OCUPADO";
      if (
        !["LIVRE", "OCUPADO", "BLOQUEADO", "ERRO", "SEM_GRADE"].includes(estado)
      )
        estado = "SEM_GRADE";
      linha.pessoas.push({
        profissional: p,
        slot: h,
        estado,
        itens: [...itens.values()],
      });
    }
    linha.ocupados = linha.pessoas.filter((p) => p.estado === "OCUPADO").length;
    linha.livres = linha.pessoas.filter((p) => p.estado === "LIVRE").length;
    linha.indisponiveis = linha.pessoas.length - linha.ocupados - linha.livres;
    linha.estado = linha.ocupados
      ? "ocupado"
      : linha.livres
        ? "livre"
        : "bloqueado";
    linha.proximo =
      !destaqueUsado &&
      proxima != null &&
      proxima >= ms &&
      proxima < Date.parse(linha.fim);
    if (linha.proximo) destaqueUsado = true;
  }
  return {
    linhas: resultado,
    proxima,
    fora: [...tarefas.entries()]
      .filter(
        ([k, t]) =>
          !visiveis.has(k) &&
          pfLocal(t.agendada_para || t.inicio).slice(0, 10) === hoje,
      )
      .map(([, t]) => t),
  };
}
