import { buildWebhookUrl } from "../../config/globals";
import { request as fetch } from "../../lib/http";
import { pfResposta } from "./agendaUtils";
const PF_AGENDA_ENDPOINT = "prospectflow-agenda";
export function criarAgendaApi(empresaId, requests) {
  return async (acao, payload = {}) => {
    const controller = new AbortController();
    requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const r = await fetch(buildWebhookUrl(PF_AGENDA_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, payload }),
        signal: controller.signal,
      });
      const texto = await r.text();
      let bruto;
      try {
        bruto = JSON.parse(texto);
      } catch {
        throw Error(
          "A agenda não retornou JSON. Confira se o novo webhook foi publicado.",
        );
      }
      if (!r.ok)
        throw Error(
          bruto.erro ||
            bruto.mensagem ||
            "Não foi possível consultar a agenda.",
        );
      return pfResposta(bruto, empresaId);
    } catch (e) {
      if (e.name === "AbortError")
        throw Error(
          "A resposta demorou. Tente novamente; o mesmo envio não duplica o agendamento.",
        );
      throw e;
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
    }
  };
}
