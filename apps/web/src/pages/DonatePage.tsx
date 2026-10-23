import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../services/api";
import type { Basket, BasketResponse } from "../types/basket";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(n);
type Created = { donation: { idDoacao: number; valorTotal: string | number }; paymentMode: string };
export function DonatePage() {
  const { user } = useAuth(); const { id } = useParams(); const navigate = useNavigate();
  const [basket,setBasket]=useState<Basket|null>(null);
  const [tipo,setTipo]=useState<"VALOR"|"ITEM">("ITEM"); const [valor,setValor]=useState(10);
  const [items,setItems]=useState<Record<number,number>>({}); const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false); const [error,setError]=useState(""); const [created,setCreated]=useState<number|null>(null);
  const [response,setResponse]=useState("");
  useEffect(()=>{ if(!id) return; void apiRequest<BasketResponse>(`/baskets/${id}`).then(r=>setBasket(r.basket)).catch(e=>setError(String(e.message||e))).finally(()=>setLoading(false)); },[id]);
  const valueItems=useMemo(()=>basket?.itens.reduce((acc,item)=>acc + (items[item.idItem]??0)*item.valorMedio,0)??0,[basket,items]);
  const left=Math.max(0,(basket?.valorEstimado??0)-(basket?.valorArrecadado??0));
  if(user?.tipo!=="DOADOR") return <Navigate to="/" replace/>;
  const donationValue=tipo==="VALOR"?valor:valueItems;
  async function submit(){
    if(!basket||sending)return;
    setSending(true);setError("");setResponse("");
    try { const body=tipo==="VALOR"?{tipo,idCesta:basket.idCesta,valor}:{tipo,idCesta:basket.idCesta,itens:Object.entries(items).filter(([,q])=>q>0).map(([key,q])=>({idItem:Number(key),quantidade:q}))};
      const data=await apiRequest<Created>("/donations",{method:"POST",body});setCreated(data.donation.idDoacao);setResponse("Contribuição registrada. Agora confirme o pagamento de demonstração.");
    } catch(e){setError(e instanceof Error?e.message:"Não foi possível registrar a doação.");}finally{setSending(false)}
  }
  async function simulate(resultado:"APROVADO"|"RECUSADO") {
    if(!created || sending)return;
    setSending(true);setError("");
    try{ await apiRequest(`/donations/${created}/simulate-payment`,{method:"POST",body:{resultado}});
      if(resultado==="APROVADO")navigate(`/baskets/${id}`);else setResponse("Pagamento recusado no simulador. Você pode tentar novamente ou escolher outra cesta.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível simular o pagamento. Em produção, é necessário configurar um gateway real.");}finally{setSending(false)}
  }
  async function retry(){if(!created)return;setSending(true);try{await apiRequest(`/donations/${created}/retry-payment`,{method:"POST"});setResponse("Nova tentativa de pagamento registrada.")}catch(e){setError(e instanceof Error?e.message:"Erro") }finally{setSending(false)}}
  return <section className="page-section feature-layout"><Link to={`/baskets/${id}`}>← Voltar à cesta</Link><h1>Contribuir com uma cesta</h1>
    {loading&&<p>Carregando…</p>}{error&&<p className="feature-error" role="alert">{error}</p>}
    {basket&&<><p>Família {basket.codigoFamilia.slice(0,8)} • meta restante: <strong>{brl(left)}</strong></p>
      <div className="feature-tabs"><button type="button" className={tipo==="ITEM"?"selected":""} onClick={()=>setTipo("ITEM")} disabled={!!created}>Doar itens</button><button type="button" className={tipo==="VALOR"?"selected":""} onClick={()=>setTipo("VALOR")} disabled={!!created}>Doar valor</button></div>
      {tipo==="ITEM"?<div className="feature-grid">{basket.itens.filter(it=>it.quantidadeNecessaria>it.quantidadeArrecadada).map(it=><div className="feature-card" key={it.idItem}><strong>{it.nome}</strong><p>Necessário: {it.quantidadeNecessaria-it.quantidadeArrecadada} • {brl(it.valorMedio)} por unidade</p><div className="feature-quantity"><button type="button" disabled={!!created||!(items[it.idItem]>0)} onClick={()=>setItems(v=>({...v,[it.idItem]:Math.max(0,(v[it.idItem]??0)-1)}))}>−</button><strong>{items[it.idItem]??0}</strong><button type="button" disabled={!!created||(items[it.idItem]??0)>=it.quantidadeNecessaria-it.quantidadeArrecadada} onClick={()=>setItems(v=>({...v,[it.idItem]:(v[it.idItem]??0)+1}))}>+</button></div></div>)}</div>
      :<label className="feature-card">Valor da contribuição em reais <input disabled={!!created} type="number" min="0.01" max={left} step="0.01" value={valor} onChange={e=>setValor(Number(e.target.value))}/></label>}
      <div className="feature-card"><h2>Total: {brl(donationValue)}</h2><p>Somente demonstração acadêmica. Nenhuma cobrança real será realizada.</p>{!created?<button className="primary-button" type="button" disabled={sending||donationValue<=0||donationValue>left} onClick={()=>void submit()}>{sending?"Registrando…":"Registrar contribuição"}</button>:<div className="feature-actions"><button className="primary-button" disabled={sending} onClick={()=>void simulate("APROVADO")}>Simular pagamento aprovado</button><button disabled={sending} onClick={()=>void simulate("RECUSADO")}>Simular recusa</button><button disabled={sending} onClick={()=>void retry()}>Nova tentativa</button></div>}{response&&<p role="status">{response}</p>}</div>
    </>}
  </section>;
}
