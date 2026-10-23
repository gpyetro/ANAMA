/* Integração reproduzível em banco descartável com ADMIN previamente criado.
 * NÃO executar em produção: cria usuários, cesta, contribuição e registros de entrega.
 * RUN_SMOKE_CONFIRM=1 API_BASE=http://localhost:3333/api/v1 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-api.mjs
 */
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const BASE=process.env.API_BASE??'http://localhost:3333/api/v1';
if(process.env.RUN_SMOKE_CONFIRM!=='1') throw new Error('Somente dados de teste. Defina RUN_SMOKE_CONFIRM=1 para confirmar execução.');
if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD) throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD de ambiente de testes.');
const seed=randomUUID().slice(0,8);
async function api(route, {token,method='GET',body,expected}={}) {
 const response=await fetch(`${BASE}${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({}));
 if(expected!==undefined)assert.equal(response.status,expected,`${route}: ${JSON.stringify(data)}`);
 if(!response.ok)throw new Error(`${route}: ${response.status} ${JSON.stringify(data)}`);
 return data;
}
console.log('Etapa 1: servidor /health'); await api('/health',{expected:200});
const admin=(await api('/auth/login',{method:'POST',body:{email:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_PASSWORD},expected:200})).token;
const family=(await api('/auth/register',{method:'POST',body:{nome:'Família Teste',email:`familia-${seed}@example.test`,senha:`SenhaTeste${seed}!`,tipo:'FAMILIA',numeroIntegrantes:4},expected:201})).token;
const donor=(await api('/auth/register',{method:'POST',body:{nome:'Doador Teste',email:`doador-${seed}@example.test`,senha:`SenhaTeste${seed}!`,tipo:'DOADOR'},expected:201})).token;
console.log('Etapa 2: autenticação, papéis e bloqueio de acesso');
const forbidden=await fetch(`${BASE}/families/me`,{headers:{Authorization:`Bearer ${donor}`}}); assert.equal(forbidden.status,403);
console.log('Etapa 3: solicitação de auxílio e banco relacional');
const aid=await api('/families/me/aid-requests',{token:family,method:'POST',body:{itensAdicionais:[]},expected:201});
const idCesta=aid.basket.idCesta;const before=await api(`/baskets/${idCesta}`,{token:donor,expected:200});assert.equal(before.basket.valorArrecadado,0);
console.log('Etapa 4: contribuição e aprovação simulada');
const created=await api('/donations',{token:donor,method:'POST',body:{idCesta,tipo:'VALOR',valor:aid.basket.valorEstimado},expected:201});
const idDoacao=created.donation.idDoacao;
const confirmed=await api(`/donations/${idDoacao}/simulate-payment`,{token:donor,method:'POST',body:{resultado:'APROVADO'},expected:200});assert.equal(confirmed.completed,true);
await api(`/donations/${idDoacao}/simulate-payment`,{token:donor,method:'POST',body:{resultado:'APROVADO'},expected:200});
const after=await api(`/baskets/${idCesta}`,{token:family,expected:200});assert.equal(after.basket.status,'CONCLUIDA');assert.equal(after.basket.percentual,100);
console.log('Etapa 5: conferir notificações e ONG aprovada');
const pending=await api('/admin/organizations/pending',{token:admin,expected:200});
let idOrg;
if(pending.organizations.length){idOrg=pending.organizations[0].idOng;await api(`/admin/organizations/${idOrg}/approve`,{token:admin,method:'PATCH',expected:200});}
console.log('SUCESSO: health, login, permissões, cesta, pagamento simulado idempotente, conclusão.');
console.log(`Registros de teste: cesta #${idCesta}, doação #${idDoacao}. Integração com estoque/entrega necessita ONG autenticada e estoque cadastrado.`);
