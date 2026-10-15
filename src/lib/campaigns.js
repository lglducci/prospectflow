export const campaignStates = {RASCUNHO:'Rascunho',AGENDADA:'Agendada',EM_ANDAMENTO:'Em andamento',PAUSADA:'Pausada',CONCLUIDA:'Concluída',CANCELADA:'Cancelada'};
export const participationStates = {PENDENTE:'Aguardando',EM_ANDAMENTO:'Respondendo',CONCLUIDA:'Concluído',RECUSADA:'Recusou',EXPIRADA:'Expirou',CANCELADA:'Cancelado'};
export const importStates = {NOVO:'Novo contato',EXISTENTE:'Já cadastrado',JA_VINCULADO:'Já participa',DUPLICADO:'Repetido na lista',INVALIDO:'Revisar',BLOQUEADO:'Não contatar'};

export function pastedContacts(value) {
 const lines=String(value).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length)throw new Error('Cole pelo menos um telefone.');
 if(lines.length>5000)throw new Error('Envie até 5000 contatos por importação.');
 return lines.map(line=>{
  const cols=line.split(/\t|;/).map(x=>x.trim());
  if(cols.length===1)return line;
  if(cols.length!==2)throw new Error('Use um telefone por linha ou Nome;Telefone.');
  return {nome:cols[0],telefone:cols[1]};
 });
}

function partsInZone(date,timeZone){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=type=>parts.find(x=>x.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function zonedInput(iso,timeZone='America/Sao_Paulo'){
 if(!iso)return '';
 return partsInZone(new Date(iso),timeZone);
}
export function zonedISO(value,timeZone='America/Sao_Paulo'){
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Confira a data e o horário.');
 const asUTC=v=>Date.parse(v+':00Z');
 const target=asUTC(value);
 let timestamp=target;
 for(let i=0;i<4;i++)timestamp+=target-asUTC(partsInZone(new Date(timestamp),timeZone));
 if(partsInZone(new Date(timestamp),timeZone)!==value)throw new Error('Esse horário não existe no fuso selecionado.');
 return new Date(timestamp).toISOString();
}
export function campaignForm(c={}){
 const fuso=c.fuso_horario||'America/Sao_Paulo';
 return {id:c.id??null,titulo:c.titulo??'',pesquisa_id:c.pesquisa_id??'',instancia_nome:c.instancia_nome??'',
  convites_por_dia:c.convites_por_dia??20,quantidade_lote:c.quantidade_lote??5,intervalo_segundos:c.intervalo_segundos??60,
  horario_inicio:(c.horario_inicio||'09:00').slice(0,5),horario_fim:(c.horario_fim||'18:00').slice(0,5),fuso_horario:fuso,
  dias_semana:c.dias_semana??[1,2,3,4,5],inicio_em:zonedInput(c.inicio_em,fuso),fim_em:zonedInput(c.fim_em,fuso),
  apresentacao:c.apresentacao??'',encerramento:c.encerramento??'',max_lembretes:c.max_lembretes??1,
  lembrete_apos_horas:c.lembrete_apos_horas??48,ia_habilitada:c.ia_habilitada===true};
}
export function campaignPayload(form){
 if(!form.titulo.trim())throw new Error('Informe o nome da campanha.');
 const pesquisa=Number(form.pesquisa_id);
 if(!Number.isSafeInteger(pesquisa)||pesquisa<=0)throw new Error('Escolha uma pesquisa.');
 if(!form.dias_semana.length)throw new Error('Escolha pelo menos um dia da semana.');
 if(form.horario_fim<=form.horario_inicio)throw new Error('O horário final deve ser depois do inicial.');
 const payload={...form,pesquisa_id:pesquisa,titulo:form.titulo.trim(),inicio_em:zonedISO(form.inicio_em,form.fuso_horario),fim_em:zonedISO(form.fim_em,form.fuso_horario)};
 for(const field of ['convites_por_dia','quantidade_lote','intervalo_segundos','max_lembretes','lembrete_apos_horas']){
  payload[field]=Number(form[field]);
  if(!Number.isSafeInteger(payload[field]))throw new Error('Informe quantidades inteiras.');
 }
 if(payload.fim_em&&payload.inicio_em&&payload.fim_em<payload.inicio_em)throw new Error('Confira o período da campanha.');
 return payload;
}

export function downloadContactTemplate(){
 const blob=new Blob(['\ufeffNome;Telefone\r\nCliente exemplo;5516999991234\r\n'],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='modelo-participantes.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
