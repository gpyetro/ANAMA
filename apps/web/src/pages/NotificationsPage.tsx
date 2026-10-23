import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { useLiveUpdates } from "../hooks/useLiveUpdates";
type Notification = { idNotificacao: number; tipo: string; mensagem: string; lida: boolean };
export function NotificationsPage(){
  const [notifications,setNotifications]=useState<Notification[]>([]);const [error,setError]=useState("");
  const reload=useCallback(()=>{void apiRequest<{notifications:Notification[]}>("/notifications").then(r=>{setNotifications(r.notifications);setError("")}).catch(e=>setError(e instanceof Error?e.message:"Erro"));},[]);
  useEffect(reload,[reload]);useLiveUpdates(reload);
  async function read(id:number){await apiRequest(`/notifications/${id}/read`,{method:"PATCH"});reload()}
  async function readAll(){await apiRequest("/notifications/read-all",{method:"PATCH"});reload()}
  return <section className="page-section feature-layout"><h1>Notificações</h1>{error&&<p role="alert" className="feature-error">{error}</p>}<button onClick={()=>void readAll()}>Marcar todas como lidas</button><div className="feature-grid">{notifications.length===0&&<p>Nenhuma notificação.</p>}{notifications.map(n=><article key={n.idNotificacao} className="feature-card"><strong>{n.tipo}</strong><p>{n.mensagem}</p>{n.lida?<small>Lida</small>:<button onClick={()=>void read(n.idNotificacao)}>Marcar como lida</button>}</article>)}</div></section>
}
