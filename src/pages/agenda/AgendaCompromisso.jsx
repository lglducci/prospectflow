import { useAgendaContext } from "./AgendaContext";
import { pfTipos, pfLocal, pfRotulo } from "./agendaUtils";
export default function AgendaCompromisso({ t }) {
  const { selecionado, setSelecionado, setAviso } = useAgendaContext();
  const aberto = String(selecionado?.id) === String(t.id);
  const nome = t.lead_nome || t.empresa_nome || "Contato não informado";
  const hora = String(
    t.inicio_local || pfLocal(t.agendada_para || t.inicio),
  ).slice(11, 16);
  return (
    <button
      type="button"
      key={t.id}
      className={`pfn-appointment ${aberto ? "pfn-selected" : ""}`}
      aria-label={`${nome} · ${hora} · ${pfRotulo(t)} · #${t.id}`}
      aria-pressed={aberto}
      onClick={() => {
        setSelecionado(aberto ? null : t);
        setAviso("");
      }}
    >
      <strong>
        <span className="pfn-caret" aria-hidden="true">
          {aberto ? "▾" : "▸"}
        </span>
        {nome}
      </strong>
      {aberto && (
        <>
          <span>{t.titulo || pfTipos[t.tipo] || t.tipo || "Agendamento"}</span>
          <small>
            {pfRotulo(t)} · {hora} · #{t.id}
          </small>
          {t.descricao && (
            <span className="pfn-description">{t.descricao}</span>
          )}
        </>
      )}
    </button>
  );
}
