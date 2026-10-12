export function buildWebhookUrl(endpoint) {
 const base=(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/,'');
 return `${base}/${endpoint}`;
}
