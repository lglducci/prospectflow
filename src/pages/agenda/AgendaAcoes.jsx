import { useRef, useEffect } from "react";
import { useAgendaContext } from "./AgendaContext";
import { pfAcoes, pfLocal, pfDia, pfPode } from "./agendaUtils";
export function AgendaBarraAcoes() {
  const { profissional, selecionado, setSelecionado, nomeProf, abrirAcao } =
    useAgendaContext();
  return (
    <>
      {" "}
      {selecionado && (
        <section className="pfn-actions" aria-label="Ações do compromisso">
          <div>
            <strong>
              {selecionado.lead_nome || selecionado.empresa_nome || "Contato"}
            </strong>
            <span>
              {nomeProf(String(selecionado?.profissional_id ?? profissional))} ·{" "}
              {pfDia(
                String(
                  selecionado.inicio_local ||
                    pfLocal(selecionado.agendada_para || selecionado.inicio),
                ).slice(0, 10),
              )}{" "}
              às{" "}
              {String(
                selecionado.inicio_local ||
                  pfLocal(selecionado.agendada_para || selecionado.inicio),
              ).slice(11, 16)}{" "}
              · #{selecionado.id}
            </span>
          </div>
          <div className="pfn-action-buttons">
            {Object.entries(pfAcoes).map(([key, label]) => (
              <button
                type="button"
                key={key}
                disabled={!pfPode(selecionado, key)}
                className={key === "CANCELAR" ? "pfn-danger" : ""}
                onClick={() => abrirAcao(key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Limpar seleção"
              onClick={() => setSelecionado(null)}
            >
              ×
            </button>
          </div>
        </section>
      )}
    </>
  );
}
export default function AgendaAcoes() {
  const {
    profissional,
    selecionado,
    modal,
    setModal,
    enviandoAcao,
    erroAcao,
    nomeProf,
    executarAcao,
    retornoHorarios, mudarRetorno, consultarRetorno,
  } = useAgendaContext();
  const dialogRef = useRef(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (modal && !d?.open) d?.showModal();
    if (!modal && d?.open) d.close();
  }, [modal]);
  return (
    <dialog
      className="pfn-dialog"
      ref={dialogRef}
      onCancel={(e) => {
        if (enviandoAcao) e.preventDefault();
        else setModal(null);
      }}
      onClose={() => {
        if (!enviandoAcao) setModal(null);
      }}
      aria-labelledby="pfn-dialog-title"
    >
      {modal && (
        <form onSubmit={executarAcao}>
          <h2 id="pfn-dialog-title">{pfAcoes[modal.acao]}</h2>
          <p>
            {selecionado?.lead_nome || selecionado?.empresa_nome || "Contato"} ·{" "}
            {nomeProf(String(selecionado?.profissional_id ?? profissional))} ·
            Compromisso #{selecionado?.id}
          </p>
          <fieldset disabled={enviandoAcao}>
            {modal.acao === "REMARCAR" && (
              <>
                <label>
                  Profissional
                  <input
                    disabled
                    value={nomeProf(
                      String(selecionado?.profissional_id ?? profissional),
                    )}
                  />
                </label>
                <label>
                  Nova data e horário
                  <input
                    type="datetime-local"
                    required
                    value={modal.data}
                    onChange={(e) =>
                      setModal((m) => ({ ...m, data: e.target.value }))
                    }
                  />
                </label>
                <small>
                  O servidor confere a disponibilidade antes de remarcar.
                </small>
              </>
            )}
            {modal.acao === 'CONCLUIR' && (
              <div className="pfn-return">
                <label>Agendar retorno?
                  <select value={modal.agendarRetorno?'sim':'nao'} onChange={e=>mudarRetorno('agendarRetorno',e.target.value==='sim')}>
                    <option value="nao">Não</option><option value="sim">Sim</option>
                  </select>
                </label>
                {modal.agendarRetorno && <>
                  <label>Cliente<input readOnly value={selecionado?.lead_nome||selecionado?.empresa_nome||'Contato'}/></label>
                  <label>Profissional<input readOnly value={nomeProf(String(selecionado?.profissional_id??profissional))}/></label>
                  <label>Data do retorno<input type="date" required value={modal.retornoDia} onChange={e=>mudarRetorno('retornoDia',e.target.value)}/></label>
                  <button type="button" onClick={consultarRetorno} disabled={retornoHorarios.carregando}>{retornoHorarios.carregando?'Consultando…':'Ver horários livres'}</button>
                  <label>Horário do retorno<select required disabled={retornoHorarios.carregando||!retornoHorarios.itens.length} value={modal.retornoHorario} onChange={e=>setModal(m=>({...m,retornoHorario:e.target.value}))}>
                    <option value="">Selecione um horário livre</option>
                    {retornoHorarios.itens.map(h=><option key={h.local} value={h.local}>{h.hora}</option>)}
                  </select></label>
                  {retornoHorarios.erro&&<p role="status" className="pfn-message">{retornoHorarios.erro}</p>}
                  <label>Observação do retorno (opcional)<textarea rows={3} maxLength={4000} value={modal.retornoDescricao} onChange={e=>setModal(m=>({...m,retornoDescricao:e.target.value}))}/></label>
                  <small>A disponibilidade será validada novamente ao salvar. Se o retorno falhar, o atendimento não será concluído.</small>
                </>}
              </div>
            )}
            {["REMARCAR", "CANCELAR", "FALTOU"].includes(modal.acao) && (
              <label>
                Motivo
                {modal.acao === "CANCELAR" ? " (obrigatório)" : " (opcional)"}
                <textarea
                  rows={3}
                  maxLength={1000}
                  required={modal.acao === "CANCELAR"}
                  value={modal.motivo}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, motivo: e.target.value }))
                  }
                />
              </label>
            )}
            {erroAcao && (
              <p className="pfn-message pfn-error" role="alert">
                {erroAcao}
              </p>
            )}
            <div className="pfn-dialog-buttons">
              <button type="button" onClick={() => setModal(null)}>
                Voltar
              </button>
              <button
                className={
                  modal.acao === "CANCELAR" ? "pfn-danger" : "pfn-primary"
                }
                type="submit"
              >
                {enviandoAcao
                  ? "Salvando…"
                  : modal.acao === "CANCELAR"
                    ? "Confirmar cancelamento"
                    : "Confirmar"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}
