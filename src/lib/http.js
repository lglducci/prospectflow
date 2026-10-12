let csrfToken='';
export function setCsrfToken(value) { csrfToken=value || ''; }
export async function request(url, options={}) {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),60000);
 const headers=new Headers(options.headers);
 if(csrfToken && (options.method || 'GET').toUpperCase() !== 'GET') headers.set('X-CSRF-Token',csrfToken);
 try {
  const response=await fetch(url,{...options,headers,credentials:'include',signal:options.signal || controller.signal});
  if(response.status===401) window.dispatchEvent(new Event('prospectflow:unauthorized'));
  return response;
 } finally {clearTimeout(timer);}
}
export async function jsonRequest(url,body,method='POST') {
 const response=await request(url,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body || {})})});
 let data;try {data=await response.json();} catch {throw new Error('O servidor não retornou JSON válido.');}
 if(!response.ok || data.ok===false) throw new Error(data.mensagem || 'Não foi possível concluir a operação.');
 return data;
}
