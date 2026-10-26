 import { useEffect, useRef, useState } from 'react';
import { jsonRequest } from '../lib/http';
import { buildWebhookUrl } from '../config/globals';

function ler(data, empresaId) {
  if (!data || data.ok === false || data.erro || data.error) {
    throw Error(
      data?.erro ||
      data?.mensagem ||
      'Não foi possível consultar o robô.'
    );
  }

  if (
    String(data.empresa_id) !== String(empresaId) ||
    !Object.hasOwn(data, 'robo')
  ) {
    throw Error('Resposta do robô inválida.');
  }

  if (
    data.robo !== null &&
    (
      typeof data.robo.bot_ativo !== 'boolean' ||
      typeof data.robo.ativo !== 'boolean' ||
      !data.robo.instancia_id
    )
  ) {
    throw Error('Configuração do robô inválida.');
  }

  return data.robo;
}

function telefone(valor) {
  const numero = String(valor || '').replace(/\D/g, '');

  if (numero.length === 13 && numero.startsWith('55')) {
    return `+55 (${numero.slice(2, 4)}) ${numero.slice(4, 9)}-${numero.slice(9)}`;
  }

  if (numero.length === 12 && numero.startsWith('55')) {
    return `+55 (${numero.slice(2, 4)}) ${numero.slice(4, 8)}-${numero.slice(8)}`;
  }

  return valor || 'Número não informado';
}

export default function EmpresaRobo({ empresaId }) {
  const [robo, setRobo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [revisao, setRevisao] = useState(0);

  const alive = useRef(false);
  const pendente = useRef(false);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let atual = true;

    setLoading(true);
    setErro('');
    setAviso('');
    setRobo(null);

    jsonRequest(
      buildWebhookUrl('prospectflow-empresa'),
      {
        acao: 'OBTER_ROBO',
        payload: {}
      }
    )
      .then((data) => {
        const resultado = ler(data, empresaId);

        if (atual) {
          setRobo(resultado);
        }
      })
      .catch((error) => {
        if (atual) {
          setErro(error.message);
        }
      })
      .finally(() => {
        if (atual) {
          setLoading(false);
        }
      });

    return () => {
      atual = false;
    };
  }, [empresaId, revisao]);

  async function alternar() {
    if (!robo || pendente.current || loading) {
      return;
    }

    pendente.current = true;
    setBusy(true);
    setErro('');
    setAviso('');

    try {
      const data = await jsonRequest(
        buildWebhookUrl('prospectflow-empresa'),
        {
          acao: 'ALTERAR_ROBO',
          payload: {
            instancia_id: String(robo.instancia_id),
            bot_ativo: !robo.bot_ativo
          }
        }
      );

      const resultado = ler(data, empresaId);

      if (!resultado) {
        throw Error('O número do robô não está mais configurado.');
      }

      if (alive.current) {
        setRobo(resultado);
        setAviso(
          resultado.bot_ativo
            ? 'Robô ligado.'
            : 'Robô desligado.'
        );
      }
    } catch (error) {
      if (alive.current) {
        setErro(
          error.message +
          ' Atualize o estado para conferir antes de tentar novamente.'
        );
      }
    } finally {
      pendente.current = false;

      if (alive.current) {
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="card narrow empresa-robo"
      aria-labelledby="empresa-robo-titulo"
      style={{ marginTop: 20 }}
    >
      <style>{`
        .empresa-robo .robo-linha {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin: 18px 0;
        }

        .empresa-robo .robo-numero {
          font-size: 17px;
          font-weight: 600;
        }

        .empresa-robo .robo-status {
          display: block;
          margin-top: 6px;
          color: var(--muted);
        }

        .empresa-robo button.robo-switch {
          box-sizing: border-box;
          position: relative;
          display: inline-block;
          flex-shrink: 0;
          width: 50px;
          min-width: 50px;
          height: 26px;
          min-height: 26px;
          padding: 2px !important;
          border: 1px solid #a6b0c0;
          border-radius: 16px;
          background: linear-gradient(#fdfefe, #c4cbd4);
          box-shadow: 0 2px 0 #8993a3, 0 4px 6px #0002;
          cursor: pointer;
        }

        .empresa-robo .robo-trilho {
          position: absolute;
          inset: 4px 6px;
          border-radius: 12px;
          background: linear-gradient(#666f7d, #a6afbc);
        }

        .empresa-robo .robo-switch[aria-checked="true"] .robo-trilho {
          background: linear-gradient(#1459c6, #3b97ff);
        }

        .empresa-robo .robo-bola {
          box-sizing: border-box;
          position: absolute;
          left: 3px;
          top: 2px;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: linear-gradient(#fff, #dce1e8);
          border: 1px solid #fff;
          box-shadow: 0 1px 3px #0003;
          transition: transform .18s;
        }

        .empresa-robo .robo-switch[aria-checked="true"] .robo-bola {
          transform: translateX(22px);
        }

        .empresa-robo .robo-switch:focus-visible {
          outline: 3px solid #60a5fa;
          outline-offset: 5px;
        }

        .empresa-robo .robo-switch:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        @media (prefers-reduced-motion: reduce) {
          .empresa-robo .robo-bola {
            transition: none;
          }
        }
      `}</style>

      <h2 id="empresa-robo-titulo">
        Atendimento automático
      </h2>

      <p>
        Ative ou pause o robô no número configurado para sua empresa.
      </p>

      {loading ? (
        <p role="status">Carregando robô…</p>
      ) : robo ? (
        <>
          <div className="robo-linha">
            <div>
              <div className="robo-numero">
                {telefone(robo.numero_whatsapp)}
              </div>

              <span className="robo-status">
                {busy
                  ? 'Salvando…'
                  : robo.bot_ativo
                    ? 'Robô ligado'
                    : 'Robô desligado'}
              </span>
            </div>

            <button
              type="button"
              className="robo-switch"
              role="switch"
              aria-checked={robo.bot_ativo}
              aria-label="Atendimento automático no WhatsApp"
              disabled={busy || (!robo.ativo && !robo.bot_ativo)}
              onClick={alternar}
            >
              <span className="robo-trilho" aria-hidden="true" />
              <span className="robo-bola" aria-hidden="true" />
            </button>
          </div>

          {!robo.ativo && (
            <p className="error">
              Esta conexão está inativa. Entre em contato com o suporte.
            </p>
          )}

          <p className="muted">
            Desligar o robô mantém o WhatsApp conectado. Conversas em
            atendimento com a recepção continuam com a equipe.
          </p>
        </>
      ) : (
        !erro && (
          <p>
            Número do robô ainda não configurado.
            Entre em contato com o suporte.
          </p>
        )
      )}

      {erro && (
        <p className="error" role="alert">
          {erro}
        </p>
      )}

      {aviso && (
        <p role="status">{aviso}</p>
      )}

      <button
        type="button"
        disabled={loading || busy}
        onClick={() => setRevisao((valor) => valor + 1)}
      >
        Atualizar estado
      </button>
    </section>
  );
}