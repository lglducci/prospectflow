import { useEffect, useRef, useState } from "react";
import { useAgendaContext } from "./AgendaContext";

export default function BuscaContatoAgenda() {
  const {
    api,
    empresaId,
    aba,
    novo,
    contato,
    salvando,
    selecionarContato,
    limparContato,
    mudarTelefone,
    buscarContato,
    revisaoHoje,
  } = useAgendaContext();
  const [busca, setBusca] = useState("");
  const [novoCliente, setNovoCliente] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [offset, setOffset] = useState(0);
  const [indice, setIndice] = useState(-1);
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState({
    termo: "",
    itens: [],
    total: 0,
    carregando: false,
    erro: "",
  });
  const sequencia = useRef(0);
  const input = useRef(null);
  const termo = busca.trim();
  const numerico = /^[\d\s()+.\-]+$/.test(termo);
  const suficiente = numerico
    ? termo.replace(/\D/g, "").length >= 3
    : termo.length >= 2;
  const selecionado = Boolean(novo.lead_id);
  const itens = estado.termo === termo ? estado.itens : [];
  const carregando =
    suficiente &&
    (!estado.termo || estado.termo !== termo || estado.carregando);

  useEffect(() => {
    if (aba !== "NOVO" || novoCliente || selecionado || !suficiente) return;
    let cancelado = false;
    const seq = ++sequencia.current;
    setEstado((e) => ({
      termo,
      itens: e.termo === termo ? e.itens : [],
      total: e.termo === termo ? e.total : 0,
      carregando: true,
      erro: "",
    }));
    const timer = setTimeout(async () => {
      try {
        const r = await api("BUSCAR_CONTATOS_AGENDA", {
          busca: termo,
          limite: 20,
          offset,
        });
        if (cancelado || seq !== sequencia.current) return;
        if (
          r.busca !== termo ||
          !Array.isArray(r.dados) ||
          !Number.isInteger(r.total) ||
          r.total < 0 ||
          r.offset !== offset ||
          r.dados.some(
            (p) =>
              !/^[1-9][0-9]*$/.test(String(p.id)) ||
              String(p.empresa_id) !== String(empresaId),
          )
        ) {
          throw Error("A busca não retornou os contatos esperados.");
        }
        setEstado((e) => ({
          termo,
          itens:
            offset && e.termo === termo ? [...e.itens, ...r.dados] : r.dados,
          total: r.total,
          carregando: false,
          erro: "",
        }));
      } catch (e) {
        if (!cancelado && seq === sequencia.current)
          setEstado((s) => ({
            ...s,
            termo,
            carregando: false,
            erro: e.message,
          }));
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    api,
    empresaId,
    aba,
    termo,
    offset,
    novoCliente,
    selecionado,
    suficiente,
    tentativa,
  ]);

  useEffect(() => {
    if (!selecionado) return;
    setBusca(novo.nome);
    setAberta(false);
  }, [selecionado, novo.nome]);

  useEffect(() => {
    sequencia.current++;
    setBusca("");
    setNovoCliente(false);
    setAberta(false);
    setOffset(0);
    setIndice(-1);
    setEstado({ termo: "", itens: [], total: 0, carregando: false, erro: "" });
  }, [revisaoHoje]);

  function digitar(valor) {
    sequencia.current++;
    limparContato();
    setBusca(valor);
    setOffset(0);
    setIndice(-1);
    setAberta(true);
    setEstado({ termo: "", itens: [], total: 0, carregando: false, erro: "" });
  }
  function escolher(p) {
    sequencia.current++;
    selecionarContato(p);
    setBusca(p.nome || p.empresa_nome || "Contato sem nome");
    setAberta(false);
    setIndice(-1);
    input.current?.focus();
  }
  function mostrarTelefone(valor) {
    if (!valor) return "Telefone não informado";
    let digitos = String(valor).replace(/\D/g, "");
    if ([12, 13].includes(digitos.length) && digitos.startsWith("55"))
      digitos = digitos.slice(2);
    if ([10, 11].includes(digitos.length))
      return `(${digitos.slice(0, 2)}) ${digitos.slice(2, -4)}-${digitos.slice(-4)}`;
    return String(valor);
  }
  const mostrar = aberta && !novoCliente && !selecionado && suficiente;
  return (
    <section
      className="pfn-contact-finder"
      aria-label="Busca de clientes"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberta(false);
      }}
    >
      <div className="pfn-contact-finder-top">
        <label className="pfn-contact-query">
          Buscar cliente
          <div className="pfn-contact-input-wrap">
            <span aria-hidden="true" className="pfn-contact-search-icon">
              ⌕
            </span>
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={mostrar}
              aria-controls="pfn-contact-results"
              aria-activedescendant={
                mostrar && indice >= 0
                  ? `pfn-contact-option-${itens[indice]?.id}`
                  : undefined
              }
              autoComplete="off"
              maxLength={200}
              placeholder="Nome, sobrenome ou parte do telefone"
              value={busca}
              disabled={salvando || novoCliente}
              onFocus={() => setAberta(true)}
              onChange={(e) => digitar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAberta(false);
                  setIndice(-1);
                } else if (
                  ["ArrowDown", "ArrowUp"].includes(e.key) &&
                  itens.length
                ) {
                  e.preventDefault();
                  setAberta(true);
                  const n =
                    e.key === "ArrowDown"
                      ? (indice + 1) % itens.length
                      : indice <= 0
                        ? itens.length - 1
                        : indice - 1;
                  setIndice(n);
                  document
                    .getElementById(`pfn-contact-option-${itens[n].id}`)
                    ?.scrollIntoView?.({ block: "nearest" });
                } else if (
                  e.key === "Enter" &&
                  mostrar &&
                  indice >= 0 &&
                  itens[indice]
                ) {
                  e.preventDefault();
                  escolher(itens[indice]);
                }
              }}
            />
          </div>
        </label>
        <button
          type="button"
          className="pfn-secondary"
          disabled={salvando}
          onClick={() => {
            sequencia.current++;
            limparContato();
            setBusca("");
            setOffset(0);
            setIndice(-1);
            setNovoCliente((v) => !v);
            setAberta(false);
          }}
        >
          {novoCliente ? "Buscar cliente cadastrado" : "Novo cliente"}
        </button>
      </div>
      {!novoCliente && !selecionado && (
        <p className="pfn-contact-search-hint">
          Digite pelo menos 2 letras ou 3 números. A lista é filtrada enquanto
          você digita.
        </p>
      )}
      {selecionado && (
        <button
          type="button"
          className="pfn-booking-change"
          onClick={() => {
            digitar("");
            input.current?.focus();
          }}
        >
          Trocar cliente
        </button>
      )}
      {mostrar && (
        <div className="pfn-contact-results-panel">
          <div
            className="pfn-contact-results"
            id="pfn-contact-results"
            role="listbox"
            aria-label="Clientes encontrados"
            aria-busy={carregando}
          >
            {itens.map((p, i) => (
              <button
                type="button"
                role="option"
                key={p.id}
                id={`pfn-contact-option-${p.id}`}
                aria-selected={indice === i}
                className={`pfn-contact-option ${indice === i ? "is-active" : ""}`}
                onClick={() => escolher(p)}
                onMouseEnter={() => setIndice(i)}
              >
                <span className="pfn-contact-avatar" aria-hidden="true">
                  {(p.nome || p.empresa_nome || "?")
                    .trim()
                    .split(/\s+/)
                    .map((v) => v[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="pfn-contact-option-text">
                  <strong>
                    {p.nome || p.empresa_nome || "Contato sem nome"}
                  </strong>
                  <small>{mostrarTelefone(p.telefone)}</small>
                </span>
                <span className="pfn-contact-option-id">#{p.id}</span>
              </button>
            ))}
          </div>
          {carregando && (
            <p className="pfn-contact-result-state" role="status">
              Buscando clientes…
            </p>
          )}
          {estado.termo === termo && estado.erro && (
            <p className="pfn-message pfn-error" role="alert">
              {estado.erro}
              <button type="button" onClick={() => setTentativa((n) => n + 1)}>
                Tentar novamente
              </button>
            </p>
          )}
          {!carregando &&
            estado.termo === termo &&
            !estado.erro &&
            !itens.length && (
              <p className="pfn-contact-result-state" role="status">
                Nenhum cliente encontrado. Você pode cadastrar um novo cliente.
              </p>
            )}
          {!estado.erro && itens.length > 0 && (
            <div className="pfn-contact-results-footer">
              <span>
                {itens.length} de {estado.total} cliente(s)
              </span>
              {itens.length < estado.total && (
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => setOffset(itens.length)}
                >
                  Carregar mais
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {!mostrar && (
        <div
          id="pfn-contact-results"
          role="listbox"
          aria-label="Clientes encontrados"
          hidden
        />
      )}
      {novoCliente && (
        <form
          className="pfn-booking-search pfn-contact-new-form"
          onSubmit={buscarContato}
        >
          <label>
            Telefone do novo cliente
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
            {contato.carregando ? "Verificando…" : "Usar este telefone"}
          </button>
          <p>
            Se o telefone já estiver cadastrado, o cliente será localizado. Caso
            contrário, preencha o nome nos detalhes do agendamento.
          </p>
        </form>
      )}
    </section>
  );
}
