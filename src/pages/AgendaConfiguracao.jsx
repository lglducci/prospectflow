import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { request } from "../lib/http";
import { buildWebhookUrl } from "../config/globals";
import "./AgendaConfiguracao.css";

const DIAS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
const copia = (v) => JSON.parse(JSON.stringify(v));
function resposta(v, depth = 0) {
  if (depth > 12 || v == null)
    throw Error("O servidor não retornou a configuração.");
  if (typeof v === "string") {
    let p;
    try {
      p = JSON.parse(v);
    } catch {
      throw Error("Resposta inválida do servidor.");
    }
    return resposta(p, depth + 1);
  }
  if (Array.isArray(v)) return resposta(v[0], depth + 1);
  if (v.ok === false || v.error || v.erro) {
    const m = v.erro || v.mensagem || v.error?.message || v.error;
    throw Error(
      typeof m === "string" ? m : "Não foi possível concluir a operação.",
    );
  }
  if (v.configuracao && v.versao != null) return v;
  for (const k of ["resultado", "body", "data", "aplicacao_api"])
    if (v[k] != null) return resposta(v[k], depth + 1);
  throw Error("O servidor não retornou a configuração.");
}
export function validarConfiguracao(c) {
  if (!c?.fuso?.trim()) return "Informe o fuso horário.";
  for (const [k, label] of [
    ["intervalo_minutos", "Intervalo da grade"],
    ["duracao_minutos", "Duração padrão"],
  ])
    if (
      !Number.isInteger(Number(c[k])) ||
      Number(c[k]) < 5 ||
      Number(c[k]) > 720
    )
      return `${label}: informe de 5 a 720 minutos inteiros.`;
  const validar = (faixas, label) => {
    if (faixas.length > 12) return `${label}: use no máximo 12 faixas.`;
    const sorted = [...faixas].sort((a, b) => a.inicio.localeCompare(b.inicio));
    let fim = "";
    for (const f of sorted) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.inicio) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.fim) ||
        f.inicio >= f.fim
      )
        return `${label}: o fim deve ser após o início, no mesmo dia.`;
      if (f.inicio < fim) return `${label}: as faixas não podem se sobrepor.`;
      fim = f.fim;
    }
    return "";
  };
  for (const d of c.dias) {
    const e = validar(d.faixas, DIAS[d.dia - 1]);
    if (e) return e;
  }
  const datas = new Set();
  for (const x of c.excecoes) {
    const dt = new Date(x.data + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(x.data) ||
      Number.isNaN(dt.getTime()) ||
      dt.toISOString().slice(0, 10) !== x.data
    )
      return "Informe uma data válida para cada exceção.";
    if (datas.has(x.data)) return "Não repita datas nas exceções.";
    datas.add(x.data);
    const e = validar(x.faixas, `Exceção ${x.data}`);
    if (e) return e;
  }
  return "";
}
export default function AgendaConfiguracao({
  profissionalId = null,
  nomeProfissional = "",
}) {
  const { session } = useAuth();
  const empresaId = String(session?.empresa?.id || "");
  const [dados, setDados] = useState(null),
    [config, setConfig] = useState(null),
    [herdar, setHerdar] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [aviso, setAviso] = useState(""),
    [reload, setReload] = useState(0);
  const alive = useRef(false);
  const escopo = profissionalId == null ? "empresa" : String(profissionalId);
  const identidade = empresaId + ":" + escopo;
  const atual = useRef(identidade);
  atual.current = identidade;
  async function api(acao, payload, signal) {
    const r = await request(buildWebhookUrl("prospectflow-agenda"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, payload }),
      signal,
    });
    let raw;
    try {
      raw = JSON.parse(await r.text());
    } catch {
      throw Error(
        "Não foi possível ler a configuração. Confira a publicação do webhook da agenda.",
      );
    }
    const d = resposta(raw);
    if (!r.ok) throw Error("Não foi possível concluir a operação.");
    if (
      String(d.empresa_id) !== empresaId ||
      String(d.profissional_id ?? "empresa") !== escopo
    )
      throw Error(
        "A configuração retornada não corresponde ao cadastro aberto.",
      );
    return d;
  }
  function preencher(d) {
    setDados(d);
    setConfig(copia(d.configuracao));
    setHerdar(d.usar_padrao_empresa === true);
  }
  useEffect(() => {
    const controller = new AbortController();
    alive.current = true;
    setLoading(true);
    setDados(null);
    setConfig(null);
    setError("");
    setAviso("");
    api(
      "OBTER_CONFIG_AGENDA",
      { profissional_id: profissionalId },
      controller.signal,
    )
      .then((d) => {
        if (!controller.signal.aborted) preencher(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [identidade, reload]);
  const visivel = herdar ? dados?.padrao_empresa : config;
  const bloqueado = loading || busy || !dados;
  const somenteLeitura = bloqueado || herdar;
  function mudar(fn) {
    setConfig((c) => fn(c));
    setAviso("");
    setError("");
  }
  async function salvar(e) {
    e.preventDefault();
    if (bloqueado) return;
    const alvo = herdar ? dados.padrao_empresa : config;
    const erro = validarConfiguracao(alvo);
    if (erro) {
      setError(erro);
      return;
    }
    const id = identidade;
    setBusy(true);
    setError("");
    setAviso("");
    try {
      const d = await api("SALVAR_CONFIG_AGENDA", {
        profissional_id: profissionalId,
        versao: dados.versao,
        usar_padrao_empresa: herdar,
        configuracao: {
          ...alvo,
          intervalo_minutos: Number(alvo.intervalo_minutos),
          duracao_minutos: Number(alvo.duracao_minutos),
        },
      });
      if (alive.current && atual.current === id) {
        preencher(d);
        setAviso(
          "Configuração salva. A aplicação destes horários na agenda será habilitada na próxima etapa.",
        );
      }
    } catch (e) {
      if (alive.current && atual.current === id) setError(e.message);
    } finally {
      if (alive.current && atual.current === id) setBusy(false);
    }
  }
  function faixas(lista, onChange, label) {
    return (
      <div className="pfc-faixas">
        {lista.map((f, i) => (
          <div className="pfc-faixa" key={i}>
            <label>
              Início
              <input
                aria-label={`${label} início ${i + 1}`}
                type="time"
                step="60"
                required
                value={f.inicio}
                onChange={(e) =>
                  onChange(
                    lista.map((v, n) =>
                      n === i ? { ...v, inicio: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <span>até</span>
            <label>
              Fim
              <input
                aria-label={`${label} fim ${i + 1}`}
                type="time"
                step="60"
                required
                value={f.fim}
                onChange={(e) =>
                  onChange(
                    lista.map((v, n) =>
                      n === i ? { ...v, fim: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              aria-label={`Remover faixa ${i + 1} de ${label}`}
              onClick={() => onChange(lista.filter((_, n) => n !== i))}
            >
              Remover
            </button>
          </div>
        ))}
        {!lista.length && (
          <p className="pfc-muted">Sem atendimento neste dia.</p>
        )}
        <button
          type="button"
          disabled={somenteLeitura || lista.length >= 12}
          onClick={() => onChange([...lista, { inicio: "", fim: "" }])}
        >
          + Faixa de atendimento
        </button>
      </div>
    );
  }
  return (
    <section
      className="pfc"
      aria-label={
        profissionalId
          ? `Horários de ${nomeProfissional}`
          : "Configuração da agenda da empresa"
      }
    >
      <header>
        <h2>
          {profissionalId
            ? `Horários de ${nomeProfissional}`
            : "Configuração da agenda"}
        </h2>
        <p>
          {profissionalId
            ? "Use o padrão da empresa ou configure os horários deste profissional."
            : "Defina o padrão usado pelos profissionais que não possuem horários próprios."}
        </p>
      </header>
      <p className="pfc-etapa">
        Cadastro em preparação: nesta etapa, salvar não altera os horários
        oferecidos pela agenda e pelos robôs.
      </p>
      {error && (
        <p role="alert" className="pfc-error">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="pfc-success">
          {aviso}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando configuração…</p>
      ) : !dados ? (
        <button type="button" onClick={() => setReload((x) => x + 1)}>
          Tentar novamente
        </button>
      ) : (
        <form onSubmit={salvar}>
          {profissionalId && (
            <label className="pfc-herdar">
              <input
                type="checkbox"
                checked={herdar}
                disabled={busy}
                onChange={(e) => {
                  setHerdar(e.target.checked);
                  setAviso("");
                }}
              />
              Usar padrão da empresa
            </label>
          )}
          <fieldset disabled={somenteLeitura}>
            <legend>
              {herdar
                ? "Padrão da empresa (visualização)"
                : "Regras de atendimento"}
            </legend>
            <div className="pfc-parametros">
              <label>
                Intervalo da grade (minutos)
                <input
                  type="number"
                  min="5"
                  max="720"
                  step="1"
                  required
                  value={visivel.intervalo_minutos}
                  onChange={(e) =>
                    mudar((c) => ({ ...c, intervalo_minutos: e.target.value }))
                  }
                />
              </label>
              <label>
                Duração padrão da consulta (minutos)
                <input
                  type="number"
                  min="5"
                  max="720"
                  step="1"
                  required
                  value={visivel.duracao_minutos}
                  onChange={(e) =>
                    mudar((c) => ({ ...c, duracao_minutos: e.target.value }))
                  }
                />
              </label>
              <label>
                Fuso horário
                <input
                  required
                  maxLength="80"
                  value={visivel.fuso}
                  placeholder="America/Sao_Paulo"
                  onChange={(e) =>
                    mudar((c) => ({ ...c, fuso: e.target.value }))
                  }
                />
              </label>
            </div>
            <p className="pfc-muted">
              O intervalo define os horários de início oferecidos. A duração
              define quanto tempo a consulta ocupa. As faixas abaixo delimitam o
              expediente; deixe o almoço fora delas.
            </p>
            <div className="pfc-dias">
              {visivel.dias.map((d) => (
                <details key={d.dia}>
                  <summary>
                    <strong>{DIAS[d.dia - 1]}</strong>
                    <span>
                      {d.faixas.length
                        ? d.faixas
                            .map((f) => `${f.inicio}–${f.fim}`)
                            .join(" · ")
                        : "Sem atendimento"}
                    </span>
                  </summary>
                  {faixas(
                    d.faixas,
                    (fs) =>
                      mudar((c) => ({
                        ...c,
                        dias: c.dias.map((v) =>
                          v.dia === d.dia ? { ...v, faixas: fs } : v,
                        ),
                      })),
                    DIAS[d.dia - 1],
                  )}
                </details>
              ))}
            </div>
            <h3>Exceções por data</h3>
            <p className="pfc-muted">
              Uma exceção substitui o expediente daquele dia. Sem faixas,
              bloqueia o dia inteiro. Horários próprios do profissional
              substituem o padrão completo, incluindo as exceções.
            </p>
            {visivel.excecoes.map((x, i) => (
              <div className="pfc-excecao" key={i}>
                <div className="pfc-parametros">
                  <label>
                    Data
                    <input
                      type="date"
                      required
                      value={x.data}
                      onChange={(e) =>
                        mudar((c) => ({
                          ...c,
                          excecoes: c.excecoes.map((v, n) =>
                            n === i ? { ...v, data: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Motivo
                    <input
                      maxLength="250"
                      value={x.motivo || ""}
                      onChange={(e) =>
                        mudar((c) => ({
                          ...c,
                          excecoes: c.excecoes.map((v, n) =>
                            n === i ? { ...v, motivo: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      mudar((c) => ({
                        ...c,
                        excecoes: c.excecoes.filter((_, n) => n !== i),
                      }))
                    }
                  >
                    Excluir exceção
                  </button>
                </div>
                {faixas(
                  x.faixas,
                  (fs) =>
                    mudar((c) => ({
                      ...c,
                      excecoes: c.excecoes.map((v, n) =>
                        n === i ? { ...v, faixas: fs } : v,
                      ),
                    })),
                  `Exceção ${i + 1}`,
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={somenteLeitura || visivel.excecoes.length >= 366}
              onClick={() =>
                mudar((c) => ({
                  ...c,
                  excecoes: [
                    ...c.excecoes,
                    { data: "", motivo: "", faixas: [] },
                  ],
                }))
              }
            >
              + Exceção por data
            </button>
          </fieldset>
          <div className="pfc-acoes">
            <button
              type="button"
              disabled={busy}
              onClick={() => setReload((x) => x + 1)}
            >
              Recarregar configuração
            </button>
            <button className="primary" type="submit" disabled={bloqueado}>
              {busy ? "Salvando…" : "Salvar configuração da agenda"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
