import { useRef } from "react";

export default function AgendaAbas({
  itens,
  valor,
  onChange,
  rotulo,
  className = "pfn-today-subtabs",
}) {
  const refs = useRef([]);
  function escolher(index) {
    onChange(itens[index].id);
    refs.current[index]?.focus();
  }
  return (
    <div role="tablist" aria-label={rotulo} className={className}>
      {itens.map((item, index) => (
        <button
          type="button"
          role="tab"
          key={item.id}
          id={item.tab}
          aria-controls={item.panel}
          aria-selected={valor === item.id}
          tabIndex={valor === item.id ? 0 : -1}
          ref={(el) => {
            refs.current[index] = el;
          }}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            let proximo;
            if (e.key === "ArrowRight") proximo = (index + 1) % itens.length;
            else if (e.key === "ArrowLeft")
              proximo = (index + itens.length - 1) % itens.length;
            else if (e.key === "Home") proximo = 0;
            else if (e.key === "End") proximo = itens.length - 1;
            else return;
            e.preventDefault();
            escolher(proximo);
          }}
        >
          {item.nome}
        </button>
      ))}
    </div>
  );
}
