import AgendaConfiguracao from "./AgendaConfiguracao";
import EmpresaRobo from "./EmpresaRobo";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { jsonRequest } from "../lib/http";
import { buildWebhookUrl } from "../config/globals";

const CAMPOS = [
  "nome",
  "documento",
  "email_contato",
  "telefone",
  "cidade",
  "uf",
  "bot_endereco",
  "bot_horario_funcionamento",
  "bot_informacoes",
];

function lerEmpresa(empresa) {
  return Object.fromEntries(CAMPOS.map((k) => [k, String(empresa?.[k] ?? "")]));
}

export default function Company() {
  const { session, restore } = useAuth();
  const empresaId = String(session.empresa.id);

  const [form, setForm] = useState(() => lerEmpresa(session.empresa));
  const [aba, setAba] = useState("dados");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregada, setCarregada] = useState(null);

  const atual = useRef(empresaId);
  atual.current = empresaId;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoaded(false);
    setCarregada(null);
    setError("");
    setAviso("");

    jsonRequest(buildWebhookUrl("prospectflow-empresa"), {
      acao: "OBTER_EMPRESA",
      payload: {},
    })
      .then((data) => {
        if (!data.empresa || typeof data.empresa.nome !== "string") {
          throw Error("Resposta de empresa inválida.");
        }

        if (data.empresa.id != null && String(data.empresa.id) !== empresaId) {
          throw Error("A empresa retornada não corresponde à sessão.");
        }

        if (alive) {
          const f = lerEmpresa(data.empresa);
          setForm(f);
          setLoaded(true);
          setCarregada(empresaId);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [empresaId]);

  const bloqueado = loading || busy || !loaded || carregada !== empresaId;

  function alterar(k, v) {
    setAviso("");
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (bloqueado) return;

    const id = empresaId;
    setBusy(true);
    setError("");
    setAviso("");

    try {
      const horario = form.bot_horario_funcionamento;
      const payload = { ...form, bot_horario_funcionamento: horario };
      const data = await jsonRequest(buildWebhookUrl("prospectflow-empresa"), {
        acao: "SALVAR_EMPRESA",
        payload,
      });

      if (data?.ok === false || data?.erro || data?.error) {
        throw Error(
          data.erro ||
            data.error ||
            data.mensagem ||
            "Não foi possível salvar.",
        );
      }

      if (atual.current !== id) return;

      // Confere os campos novos: versões antigas da API podem ignorá-los sem emitir erro.
      const check = await jsonRequest(buildWebhookUrl("prospectflow-empresa"), {
        acao: "OBTER_EMPRESA",
        payload: {},
      });

      if (
        !check?.empresa ||
        (check.empresa.id != null && String(check.empresa.id) !== id)
      ) {
        throw Error("Não foi possível confirmar os dados da empresa.");
      }

      for (const k of [
        "bot_endereco",
        "bot_horario_funcionamento",
        "bot_informacoes",
      ]) {
        if (String(check.empresa[k] ?? "") !== String(payload[k] ?? "")) {
          throw Error(
            "A API não confirmou a gravação das informações do robô. É necessário ajustar a função de consultar/salvar empresa.",
          );
        }
      }

      if (atual.current !== id) return;
      setForm(lerEmpresa(check.empresa));
      await restore();
      if (atual.current === id) setAviso("Dados salvos e conferidos.");
    } catch (e) {
      if (atual.current === id) setError(e.message);
    } finally {
      if (atual.current === id) setBusy(false);
    }
  }

  function field(key, label, max, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          maxLength={max}
          required={key === "nome"}
          value={form[key]}
          onChange={(e) =>
            alterar(
              key,
              key === "uf" ? e.target.value.toUpperCase() : e.target.value,
            )
          }
        />
      </label>
    );
  }

  return (
    <section className="content company-page">
      <h1>Minha empresa</h1>
      <p>{session.empresa.nome} — informações do seu espaço de trabalho.</p>

      <style>{`
        .company-page .company-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 16px 0;
        }
        .company-page textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
        }
        .company-page .company-preview {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .company-page [hidden] {
          display: none !important;
        }
      `}</style>

      {/* TÍTULOS DAS ABAS: altere o texto dentro dos botões abaixo. */}
      <div
        className="company-tabs"
        role="tablist"
        aria-label="Configurações da empresa"
      >
        <button
          type="button"
          role="tab"
          id="company-tab-dados"
          aria-controls="company-dados"
          aria-selected={aba === "dados"}
          className={aba === "dados" ? "primary" : ""}
          onClick={() => setAba("dados")}
        >
          Dados da empresa
        </button>

        {/* TÍTULO DA ABA ROBÔ */}
        <button
          type="button"
          role="tab"
          id="company-tab-robo"
          aria-controls="company-robo"
          aria-selected={aba === "robo"}
          className={aba === "robo" ? "primary" : ""}
          onClick={() => setAba("robo")}
        >
          Demais Informações
        </button>
        <button
          type="button"
          role="tab"
          id="company-tab-horarios"
          aria-controls="company-horarios"
          aria-selected={aba === "horarios"}
          className={aba === "horarios" ? "primary" : ""}
          onClick={() => setAba("horarios")}
        >
          Agenda — horários
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}

      <form className="card narrow" onSubmit={save} hidden={aba === "horarios"}>
        <fieldset
          disabled={bloqueado}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          {/* CONTEÚDO DA ABA DADOS DA EMPRESA */}
          <div
            id="company-dados"
            role="tabpanel"
            aria-labelledby="company-tab-dados"
            hidden={aba !== "dados"}
          >
            {field("nome", "Nome da empresa", 160)}
            {field("documento", "CNPJ / CPF", 32)}
            {field("email_contato", "E-mail de contato", 254, "email")}
            {field("telefone", "Telefone", 32, "tel")}

            <div className="columns">
              {field("cidade", "Cidade", 120)}
              {field("uf", "UF", 2)}
            </div>

            <label>
              Responsável
              <input disabled value={session.usuario.nome || ""} />
            </label>
            <label>
              E-mail de acesso
              <input disabled value={session.usuario.email || ""} />
            </label>
          </div>

          {/* CONTEÚDO DA ABA ROBÔ */}
          <div
            id="company-robo"
            role="tabpanel"
            aria-labelledby="company-tab-robo"
            hidden={aba !== "robo"}
          >
            <h2>Informações do robô</h2>
            <p>Exibidas quando o paciente escolhe “Informações”.</p>

            <label>
              Endereço
              <textarea
                rows={3}
                maxLength={2000}
                value={form.bot_endereco}
                onChange={(e) => alterar("bot_endereco", e.target.value)}
              />
            </label>

            <label>
              Horário de funcionamento
              <textarea
                rows={3}
                maxLength={4000}
                placeholder="Ex.: Segunda a sexta, das 08h às 18h. Sábado, das 08h às 12h."
                value={form.bot_horario_funcionamento}
                onChange={(e) =>
                  alterar("bot_horario_funcionamento", e.target.value)
                }
              />
            </label>

            <p>
              Esses horários são informativos. Os horários disponíveis para
              agendamento seguem a configuração da agenda.
            </p>

            <label>
              Informações adicionais
              <textarea
                rows={4}
                maxLength={6000}
                value={form.bot_informacoes}
                onChange={(e) => alterar("bot_informacoes", e.target.value)}
              />
            </label>

            <h3>Prévia das informações</h3>
            <div className="company-preview">
              {[
                form.bot_endereco.trim() &&
                  `Endereço: ${form.bot_endereco.trim()}`,
                form.bot_horario_funcionamento.trim() &&
                  `Horário de funcionamento: ${form.bot_horario_funcionamento.trim()}`,
                form.bot_informacoes.trim(),
              ]
                .filter(Boolean)
                .join("\n") ||
                "As informações do consultório ainda não foram cadastradas."}
            </div>
          </div>

          <button className="primary" style={{ marginTop: 16 }}>
            {loading ? "Carregando…" : busy ? "Salvando…" : "Salvar dados"}
          </button>
        </fieldset>
      </form>

      {aba === "horarios" && (
        <div
          id="company-horarios"
          role="tabpanel"
          aria-labelledby="company-tab-horarios"
        >
          <AgendaConfiguracao key={empresaId} />
        </div>
      )}

      <div hidden={aba !== "robo"}>
        <EmpresaRobo key={session.empresa.id} empresaId={session.empresa.id} />
      </div>
    </section>
  );
}
