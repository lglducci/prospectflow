import { useAgendaContext } from "./AgendaContext";
import { pfTipos, pfLocal, pfDia } from "./agendaUtils";
export default function NovoAgendamento() {
  const {
    aba,
    profissionais,
    novo,
    contato,
    horarios,
    salvando,
    erroNovo,
    horariosSeq,
    nomeProf,
    setHorarios,
    mudarNovo,
    mudarTelefone,
    buscarContato,
    verHorarios,
    salvarNovo,
    livres,
  } = useAgendaContext();
  return (
    <div
      role="tabpanel"
      id="pfn-panel-1"
      aria-labelledby="pfn-tab-1"
      hidden={aba !== "NOVO"}
      className="pfn-panel"
    >
      <div className="pfn-booking">
        <h2>Novo agendamento</h2>
        <p className="pfn-muted">
          Busque o cliente, escolha o profissional e consulte os horários.
        </p>
        <fieldset disabled={salvando} className="pfn-new-fields">
          <form className="pfn-booking-search" onSubmit={buscarContato}>
            <label>
              Telefone do cliente
              <input
                type="tel"
                autoComplete="tel"
                required
                value={novo.telefone}
                onChange={(e) => mudarTelefone(e.target.value)}
                placeholder="DDD + telefone"
              />
            </label>
            <button type="submit" disabled={contato.carregando}>
              {contato.carregando ? "Buscando…" : "Buscar cliente"}
            </button>
          </form>
          {contato.erro && (
            <p className="pfn-message pfn-error" role="alert">
              {contato.erro}
            </p>
          )}
          {contato.dados && (
            <section
              className={`pfn-booking-client ${contato.dados.encontrado ? "pfn-client-found" : ""}`}
              role="status"
              aria-label="Resultado da busca do cliente"
            >
              <div>
                <span className="pfn-client-caption">
                  {contato.dados.encontrado
                    ? "Cliente encontrado"
                    : "Cliente novo"}
                </span>
                <strong>
                  {contato.dados.encontrado
                    ? contato.dados.lead?.nome ||
                      contato.dados.lead?.empresa_nome ||
                      novo.nome ||
                      "Cliente localizado"
                    : "Telefone sem cadastro"}
                </strong>
                {!contato.dados.encontrado && (
                  <p>
                    Informe o nome abaixo. O cadastro será criado ao confirmar o
                    agendamento.
                  </p>
                )}
              </div>
              <span className="pfn-client-phone">
                {contato.dados.lead?.telefone || novo.telefone}
              </span>
            </section>
          )}
          <section
            className="pfn-booking-card"
            aria-labelledby="pfn-booking-choose"
          >
            <h3 id="pfn-booking-choose">Escolha o profissional e a data</h3>
            <form className="pfn-booking-availability" onSubmit={verHorarios}>
              <label>
                Profissional
                <select
                  aria-label="Profissional do novo agendamento"
                  required
                  disabled={novo.fixo}
                  value={novo.profissional_id}
                  onChange={(e) => {
                    horariosSeq.current++;
                    setHorarios({ dados: null, erro: "", carregando: false });
                    mudarNovo({
                      profissional_id: e.target.value,
                      fixo: Boolean(e.target.value),
                      horario: "",
                    });
                  }}
                >
                  <option value="">Selecione um profissional</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.especialidade_nome ? ` · ${p.especialidade_nome}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data do atendimento
                <input
                  type="date"
                  required
                  min={pfLocal().slice(0, 10)}
                  value={novo.dia}
                  onChange={(e) => {
                    horariosSeq.current++;
                    mudarNovo({ dia: e.target.value, horario: "" });
                    setHorarios({ dados: null, erro: "", carregando: false });
                  }}
                />
              </label>
              <button type="submit" disabled={horarios.carregando}>
                {horarios.carregando ? "Consultando…" : "Ver horários"}
              </button>
            </form>
            {novo.fixo && (
              <button
                type="button"
                className="pfn-booking-change"
                onClick={() => {
                  horariosSeq.current++;
                  setHorarios({ dados: null, erro: "", carregando: false });
                  mudarNovo({ fixo: false, horario: "" });
                }}
              >
                Trocar profissional
              </button>
            )}
            {horarios.erro && (
              <p className="pfn-message pfn-error" role="alert">
                {horarios.erro}
              </p>
            )}
            {horarios.dados && (
              <section
                className="pfn-booking-hours"
                aria-label="Horários disponíveis"
              >
                <div className="pfn-booking-hours-title">
                  <strong>
                    {nomeProf(novo.profissional_id)} · {pfDia(novo.dia)}
                  </strong>
                  <span>{livres.length} livres · 30 min</span>
                </div>
                {livres.length ? (
                  ["Manhã", "Tarde"].map((turno, index) => {
                    const grupo = livres.filter(
                      (h) =>
                        String(
                          h.hora_inicio || pfLocal(h.inicio).slice(11, 16),
                        ) <
                          "12:00" ===
                        (index === 0),
                    );
                    return (
                      grupo.length > 0 && (
                        <div className="pfn-time-period" key={turno}>
                          <h4>{turno}</h4>
                          <div
                            className="pfn-times"
                            role="group"
                            aria-label={`Horários da ${turno.toLowerCase()}`}
                          >
                            {grupo.map((h) => (
                              <button
                                type="button"
                                key={h.inicio}
                                aria-pressed={
                                  novo.horario === pfLocal(h.inicio)
                                }
                                onClick={() =>
                                  mudarNovo({ horario: pfLocal(h.inicio) })
                                }
                              >
                                {h.hora_inicio ||
                                  pfLocal(h.inicio).slice(11, 16)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    );
                  })
                ) : (
                  <p className="pfn-muted">
                    Nenhum horário futuro disponível nesta data.
                  </p>
                )}
              </section>
            )}
            <section
              className="pfn-booking-details"
              aria-labelledby="pfn-booking-confirm"
            >
              <h3 id="pfn-booking-confirm">Confirme os detalhes</h3>
              <form onSubmit={salvarNovo} className="pfn-confirm-form">
                {(!contato.dados?.encontrado ||
                  !String(
                    contato.dados?.lead?.nome ||
                      contato.dados?.lead?.empresa_nome ||
                      "",
                  ).trim()) && (
                  <label className="pfn-wide">
                    Nome do cliente
                    <input
                      required
                      maxLength={250}
                      value={novo.nome}
                      onChange={(e) => mudarNovo({ nome: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </label>
                )}
                <label>
                  Profissional confirmado
                  <input
                    disabled
                    readOnly
                    value={
                      novo.profissional_id
                        ? nomeProf(novo.profissional_id)
                        : "Escolha um profissional"
                    }
                  />
                </label>
                <label>
                  O que deve ser feito?
                  <select
                    aria-label="Tipo de ação"
                    value={novo.tipo}
                    onChange={(e) => mudarNovo({ tipo: e.target.value })}
                  >
                    {Object.entries(pfTipos).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pfn-wide">
                  Observação
                  <textarea
                    maxLength={4000}
                    rows={3}
                    value={novo.descricao}
                    placeholder="Descreva a próxima ação"
                    onChange={(e) => mudarNovo({ descricao: e.target.value })}
                  />
                </label>
                <div className="pfn-wide pfn-booking-summary" role="status">
                  {novo.horario ? (
                    <>
                      <strong>
                        {pfDia(novo.horario.slice(0, 10))} às{" "}
                        {novo.horario.slice(11, 16)}
                      </strong>
                      <span>
                        {nomeProf(novo.profissional_id)} · 30 minutos
                        {novo.nome ? ` · ${novo.nome}` : ""}
                      </span>
                    </>
                  ) : (
                    "Escolha um horário disponível para confirmar."
                  )}
                </div>
                {erroNovo && (
                  <p className="pfn-wide pfn-message pfn-error" role="alert">
                    {erroNovo}
                  </p>
                )}
                <button
                  type="submit"
                  className="pfn-primary pfn-wide pfn-booking-submit"
                  disabled={salvando || !novo.horario || !contato.dados}
                >
                  {salvando ? "Salvando…" : "Confirmar agendamento"}
                </button>
              </form>
            </section>
          </section>
        </fieldset>
      </div>
    </div>
  );
}
