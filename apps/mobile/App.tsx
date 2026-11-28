import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, Image, ImageBackground, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3333/api/v1";
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function parseDonationValue(raw: string): number {
  const normalized = raw.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return NaN;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

type Role = "DOADOR" | "FAMILIA" | "ONG" | "ADMIN";
type User = { idUsuario: number; nome: string; tipo: Role; email: string; familia: {codigoPublico:string}|null; ong:{idOng:number;statusVerificacao:string;nomeFantasia:string}|null };
type Item = { idItem:number;nome:string;valorMedio:number;categoria:string;basico?:boolean;quantidadePadrao?:number;quantidadeNecessaria?:number;quantidadeArrecadada?:number };
type Basket = { idCesta:number;codigoFamilia:string;status:string;valorEstimado:number;valorArrecadado:number;percentual:number;itens:Item[] };
type Notification = {idNotificacao:number;tipo:string;mensagem:string;lida:boolean};
type Stock = {idItem:number;nome:string;quantidadeDisponivel:number;quantidadeReservada:number};
type Delivery = {idEntrega:number;idCesta:number;status:string;dataAgendada:string};
type PendingOrg = {idOng:number;nomeFantasia:string;cnpj:string};
type Screen = "home"|"detail"|"aid"|"donate"|"inventory"|"deliveries"|"notifications"|"admin"|"profile";
async function api<T>(path:string, token:string|null, method="GET", body?:unknown):Promise<T>{
  const res = await fetch(`${API_URL}${path}`, {method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data = await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data?.error?.message??`Falha HTTP ${res.status}`);
  return data as T;
}
// Paleta compartilhada com a web (apps/web/src/styles/global.css).
const C={logo:"#1d5a37",brand:"#16943a",brandDark:"#127a31",brandDeep:"#0f3d1e",brand50:"#f0fbf2",brand100:"#dcf5e1",brand200:"#b6e9c2",ink:"#13231a",inkSoft:"#3b4d42",muted:"#66776c",line:"#e3ece6",lineStrong:"#cfdcd3",page:"#f3f8f4",surface:"#ffffff",surfaceSoft:"#f7fbf8",danger:"#c62828",dangerBg:"#fdeeee",warning:"#b45309",warningBg:"#fff6e5",info:"#2563eb",infoBg:"#ebf2ff"};
const LABELS:Record<string,string>={EM_MONTAGEM:"Em montagem",CONCLUIDA:"Concluída",ENTREGUE:"Entregue",PENDENTE:"Pendente",EM_ROTA:"Em rota",APROVADA:"Aprovada",REJEITADA:"Rejeitada",ENTREGA:"Entrega",CESTA_CONCLUIDA:"Cesta concluída",DOACAO:"Doação",DOACAO_CONFIRMADA:"Doação confirmada",DOADOR:"Doador",FAMILIA:"Família",ONG:"Organização",ADMIN:"Administrador"};
const label=(v:string)=>LABELS[v]??v.toLowerCase().replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
const initials=(n:string)=>{const p=n.trim().split(/\s+/);return((p[0]?.[0]??"")+(p[1]?.[0]??"")).toUpperCase()||"A"};
function Action({title,onPress,disabled,secondary=false,light=false,danger=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;light?:boolean;danger?:boolean}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.buttonSecondary,light&&styles.buttonLight,danger&&styles.buttonDanger,disabled&&{opacity:.45},pressed&&{opacity:.85}]}><Text style={[styles.buttonText,secondary&&styles.buttonTextSecondary,light&&styles.buttonTextLight,danger&&styles.buttonTextDanger]}>{title}</Text></Pressable>;
}
const LOGO=require("./assets/logo-anama.png");
const HERO=require("./assets/hero-cestas.jpg");
function Brand(){return <View style={styles.brand}><Image source={LOGO} style={styles.brandMark} resizeMode="contain" accessibilityIgnoresInvertColors/><View><Text style={styles.logo}>ANAMÃ</Text><Text style={styles.logoSub}>Cestas Solidárias</Text></View></View>}
function Badge({status}:{status:string}){const tone=status==="PENDENTE"?"warn":status==="EM_ROTA"?"info":"ok";return <View style={[styles.badge,tone==="warn"&&styles.badgeWarn,tone==="info"&&styles.badgeInfo]}><Text style={[styles.badgeText,tone==="warn"&&{color:C.warning},tone==="info"&&{color:C.info}]}>{label(status)}</Text></View>}
function Progress({value,hideLabel=false}:{value:number;hideLabel?:boolean}){const v=Math.min(100,Math.max(0,Number(value)||0));return <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressValue,{width:`${v}%`}]}/></View>{hideLabel?null:<Text style={styles.progressLabel}>{v.toFixed(0)}%</Text>}</View>}
function Stat({label:l,value}:{label:string;value:string}){return <View style={styles.stat}><Text style={styles.muted}>{l}</Text><Text style={styles.statValue}>{value}</Text></View>}
function Stepper({value,onMinus,onPlus}:{value:number;onMinus:()=>void;onPlus:()=>void}){return <View style={styles.stepper}><Pressable accessibilityRole="button" accessibilityLabel="Diminuir" onPress={onMinus} style={styles.stepBtn}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable accessibilityRole="button" accessibilityLabel="Aumentar" onPress={onPlus} style={styles.stepBtn}><Text style={styles.stepText}>+</Text></Pressable></View>}
function Empty({title,text}:{title:string;text:string}){return <View style={styles.empty}><Text style={styles.cardTitle}>{title}</Text><Text style={[styles.muted,{textAlign:"center"}]}>{text}</Text></View>}
function Field({label,value,onChange,secure=false,number=false}:{label:string;value:string;onChange:(s:string)=>void;secure?:boolean;number?:boolean}){
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" keyboardType={number?"numeric":"default"} secureTextEntry={secure} style={styles.input} value={value} onChangeText={onChange} /></View>;
}
function Panel({children,compact=false,tone}:{children:ReactNode;compact?:boolean;tone?:"muted"|"highlight"}){return <View style={[styles.panel,compact&&styles.panelCompact,tone==="highlight"&&styles.panelHighlight,tone==="muted"&&styles.panelMuted]}>{children}</View>}
export default function App(){
  const [token,setToken]=useState<string|null>(null);const [user,setUser]=useState<User|null>(null);const [booting,setBooting]=useState(true);
  const [register,setRegister]=useState(false);const [role,setRole]=useState<"DOADOR"|"FAMILIA"|"ONG">("DOADOR");
  const [email,setEmail]=useState("");const [senha,setSenha]=useState("");const [nome,setNome]=useState("");const [extra,setExtra]=useState("");const [cnpj,setCnpj]=useState("");
  const [screen,setScreen]=useState<Screen>("home");const [baskets,setBaskets]=useState<Basket[]>([]);const [current,setCurrent]=useState<Basket|null>(null);
  const [catalog,setCatalog]=useState<Item[]>([]);const [quantities,setQuantities]=useState<Record<number,number>>({});const [type,setType]=useState<"VALOR"|"ITEM">("ITEM");const [value,setValue]=useState("10");
  const [notifications,setNotifications]=useState<Notification[]>([]);const [inventory,setInventory]=useState<Stock[]>([]);const [stockEdit,setStockEdit]=useState<Record<number,string>>({});
  const [deliveries,setDeliveries]=useState<Delivery[]>([]);const [organizations,setOrganizations]=useState<PendingOrg[]>([]);
  const [address,setAddress]=useState("");const [latitude,setLatitude]=useState("");const [longitude,setLongitude]=useState("");
  const [refreshing,setRefreshing]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");

  useEffect(()=>{void (async()=>{try{const saved=await SecureStore.getItemAsync("anama_token");if(saved){const response=await api<{user:User}>("/auth/me",saved);setToken(saved);setUser(response.user)}}catch{await SecureStore.deleteItemAsync("anama_token")}finally{setBooting(false)}})()},[]);
  const load=useCallback(async()=>{
    if(!token)return;
    try{
      const res=await api<{baskets:Basket[]}>("/baskets",token);setBaskets(res.baskets);
      if(current?.idCesta){const det=await api<{basket:Basket}>(`/baskets/${current.idCesta}`,token).catch(()=>null);if(det)setCurrent(det.basket)}
      if(screen==="aid"){const cat=await api<{items:Item[]}>("/baskets/catalog/items",token);setCatalog(cat.items)}
      if(screen==="notifications"){const n=await api<{notifications:Notification[]}>("/notifications",token);setNotifications(n.notifications)}
      if(screen==="inventory"&&user?.tipo==="ONG"){const n=await api<{inventory:Stock[]}>("/organizations/me/inventory",token);setInventory(n.inventory)}
      if(screen==="deliveries"&&user?.tipo==="ONG"){const n=await api<{deliveries:Delivery[]}>("/organizations/me/deliveries",token);setDeliveries(n.deliveries)}
      if(screen==="admin"&&user?.tipo==="ADMIN"){const n=await api<{organizations:PendingOrg[]}>("/admin/organizations/pending",token);setOrganizations(n.organizations)}
    }catch(e){setError(e instanceof Error?e.message:"Erro ao carregar")}
  },[token,screen,current?.idCesta,user?.tipo]);
  useEffect(()=>{if(token)void load()},[load,token]);
  useEffect(()=>{if(!token)return;const timer=setInterval(()=>void load(),12000);return()=>clearInterval(timer)},[load,token]);
  async function refresh(){setRefreshing(true);await load();setRefreshing(false)}
  async function session(){setBusy(true);setError("");try{
    const data=register? await api<{token:string;user:User}>("/auth/register",null,"POST",{tipo:role,nome,email,senha,...(role==="FAMILIA"?{numeroIntegrantes:Number(extra||1)}:{}),...(role==="ONG"?{nomeFantasia:extra,cnpj}:{})}) : await api<{token:string;user:User}>("/auth/login",null,"POST",{email,senha});
    await SecureStore.setItemAsync("anama_token",data.token);setToken(data.token);setUser(data.user);setScreen("home");setSenha("");
  }catch(e){setError(e instanceof Error?e.message:"Falha") }finally{setBusy(false)}}
  async function logOut(){await SecureStore.deleteItemAsync("anama_token");setToken(null);setUser(null);setCurrent(null);setScreen("home")}
  async function change(action:()=>Promise<unknown>,success:string){setBusy(true);setError("");try{await action();Alert.alert("ANAMÃ",success);await load()}catch(e){setError(e instanceof Error?e.message:"Falha inesperada") }finally{setBusy(false)}}
  function openBasket(basket:Basket){setCurrent(basket);setScreen("detail")}
  function go(next:Screen){setError("");setScreen(next)}
  async function submitAid(){const itensAdicionais=Object.entries(quantities).filter(([,q])=>q>0).map(([idItem,quantidade])=>({idItem:Number(idItem),quantidade}));
    await change(async()=>{const r=await api<{basket:Basket}>("/families/me/aid-requests",token,"POST",{itensAdicionais});setCurrent(r.basket);setScreen("detail");setQuantities({})},"Solicitação criada com sucesso")}
  async function submitDonation(){
    if(!current || busy)return;
if (
  !Number.isFinite(donatePrice) ||
  donatePrice < 0.01 ||
  donatePrice > remaining
) {
  Alert.alert(
    "Valor inválido",
    "Informe uma contribuição válida dentro da meta restante."
  );
  return;
}

    const itens=Object.entries(quantities).filter(([,q])=>q>0).map(([idItem,quantidade])=>({idItem:Number(idItem),quantidade}));
    setBusy(true);setError("");
    try {
      const body=type==="VALOR"?{tipo:type,idCesta:current.idCesta,valor:parseDonationValue(value)}:{tipo:type,idCesta:current.idCesta,itens};
      const {donation}=await api<{donation:{idDoacao:number}}>("/donations",token,"POST",body);
      Alert.alert("Pagamento acadêmico", "Deseja simular a aprovação? Não haverá cobrança real.",[
        {text:"Depois",style:"cancel"},
        {text:"Simular aprovação",onPress:()=>void change(async()=>{
          await api(`/donations/${donation.idDoacao}/simulate-payment`,token,"POST",{resultado:"APROVADO"});
          setScreen("detail");setQuantities({});
        },"Contribuição confirmada no simulador")},
      ]);
    } catch(e){setError(e instanceof Error?e.message:"Falha ao registrar contribuição")}
    finally{setBusy(false)}
  }
  const remaining=(current?.valorEstimado??0)-(current?.valorArrecadado??0);
  const additional=catalog.filter(it=>!it.basico);
  const basePrice=catalog.filter(it=>it.basico).reduce((sum,it)=>sum+it.valorMedio*(it.quantidadePadrao??0),0);
  const addPrice=additional.reduce((sum,it)=>sum+(quantities[it.idItem]??0)*it.valorMedio,0);
  const donatePrice=type==="VALOR"?parseDonationValue(value):current?.itens.reduce((sum,it)=>sum+(quantities[it.idItem]??0)*it.valorMedio,0)??0;
  if(booting)return <SafeAreaView style={[styles.safe,styles.center]}><Brand/><Text style={[styles.caption,{marginTop:12}]}>Carregando ANAMÃ…</Text></SafeAreaView>;
  if(!token||!user)return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content"/><ScrollView contentContainerStyle={[styles.container,styles.authContainer]} keyboardShouldPersistTaps="handled">
    <View style={styles.authCard}>
      <Brand/>
      <Text style={styles.heading}>{register?"Criar conta":"Bem-vindo(a)"}</Text><Text style={styles.caption}>Plataforma solidária de cestas básicas</Text>{error?<Text style={styles.error}>{error}</Text>:null}
      {register?<><View style={styles.segment}>{(["DOADOR","FAMILIA","ONG"] as const).map(r=><Pressable key={r} accessibilityRole="button" onPress={()=>setRole(r)} style={[styles.segmentItem,role===r&&styles.segmentItemActive]}><Text style={[styles.segmentText,role===r&&styles.segmentTextActive]}>{label(r)}</Text></Pressable>)}</View><Field label="Seu nome" value={nome} onChange={setNome}/>{role==="FAMILIA"?<Field label="Número de integrantes" value={extra} onChange={setExtra} number/>:null}{role==="ONG"?<><Field label="Nome da ONG" value={extra} onChange={setExtra}/><Field label="CNPJ" value={cnpj} onChange={setCnpj}/></>:null}</>:null}
      <Field label="E-mail" value={email} onChange={setEmail}/><Field label="Senha" value={senha} onChange={setSenha} secure/>
      <View style={{height:6}}/>
      <Action title={busy?"Aguarde…":register?"Cadastrar":"Entrar"} disabled={busy} onPress={()=>void session()}/><Action title={register?"Já tenho conta":"Criar conta"} secondary onPress={()=>{setRegister(!register);setError("")}}/>
    </View>
  </ScrollView></SafeAreaView>;
  const tabs:{key:Screen;title:string}[]=[{key:"home",title:"Início"},{key:"notifications",title:"Avisos"},{key:"profile",title:"Perfil"}];
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content"/>
    <View style={styles.header}><Brand/><View style={styles.headerRight}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(user.nome)}</Text></View><Pressable accessibilityRole="button" onPress={()=>void logOut()} style={styles.logout}><Text style={styles.logoutText}>Sair</Text></Pressable></View></View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor={C.brand} colors={[C.brand]}/>} contentContainerStyle={styles.container}>
      {error?<Text style={styles.error}>{error}</Text>:null}
      {screen!=="home"?<Pressable accessibilityRole="button" onPress={()=>go("home")} style={styles.back}><Text style={styles.backText}>← Voltar ao início</Text></Pressable>:null}
      {screen==="home"?<>
        <ImageBackground source={HERO} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}><View style={styles.heroOverlay}/><Text style={styles.heroChip}>{label(user.tipo)}</Text><Text style={styles.heroTitle}>Olá, {user.nome.split(" ")[0]}</Text><Text style={styles.heroText}>Conectando quem pode com quem precisa.</Text>
          {user.tipo==="FAMILIA"?<Action title="Solicitar auxílio" light onPress={()=>{setQuantities({});go("aid")}}/>:null}
          {user.tipo==="ONG"?<Action title={user.ong?.statusVerificacao==="APROVADA"?"Estoque e entregas":"ONG em análise"} light disabled={user.ong?.statusVerificacao!=="APROVADA"} onPress={()=>go("inventory")}/>:null}
          {user.tipo==="ADMIN"?<Action title="Homologar ONGs" light onPress={()=>go("admin")}/>:null}
        </ImageBackground>
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Cestas em andamento</Text><Text style={styles.count}>{baskets.length}</Text></View>
        {baskets.length===0?<Empty title="Nenhuma cesta em montagem" text="Ainda não existem solicitações disponíveis neste momento."/>:null}
        {baskets.map(b=><Panel key={b.idCesta}>
          <View style={styles.cardHead}><View><Text style={styles.cardTitle}>Cesta #{b.idCesta}</Text><Text style={styles.muted}>Família {b.codigoFamilia.slice(0,8).toUpperCase()}</Text></View><Badge status={b.status}/></View>
          <Progress value={b.percentual}/>
          <View style={styles.cardHead}><Text style={styles.muted}>{currency(b.valorArrecadado)} arrecadados</Text><Text style={styles.muted}>Meta: {currency(b.valorEstimado)}</Text></View>
          <Action title="Ver cesta" secondary onPress={()=>openBasket(b)}/>
        </Panel>)}
      </>:null}
      {screen==="detail"&&current?<><Text style={styles.heading}>Cesta #{current.idCesta}</Text><Panel><View style={styles.cardHead}><Text style={styles.muted}>Família {current.codigoFamilia.slice(0,8).toUpperCase()}</Text><Badge status={current.status}/></View>
          <View style={styles.statRow}><Stat label="Arrecadado" value={currency(current.valorArrecadado)}/><Stat label="Meta" value={currency(current.valorEstimado)}/></View><Progress value={current.percentual}/></Panel>
        <Text style={styles.sectionTitle}>Itens necessários</Text>
        {current.itens.map(it=><Panel key={it.idItem} compact><View style={styles.cardHead}><Text style={styles.itemTitle}>{it.nome}</Text><Text style={styles.itemQty}>{it.quantidadeArrecadada}/{it.quantidadeNecessaria}</Text></View><Progress value={(it.quantidadeNecessaria??0)>0?((it.quantidadeArrecadada??0)/(it.quantidadeNecessaria??1))*100:0} hideLabel/></Panel>)}
        {user.tipo==="DOADOR"&&current.status==="EM_MONTAGEM"?<Action title="Contribuir" onPress={()=>{setQuantities({});go("donate")}}/>:null}
      </>:null}
      {screen==="aid"?<><Text style={styles.heading}>Solicitar cesta</Text><View style={styles.notice}><Text style={styles.noticeText}>Itens essenciais incluídos automaticamente ({currency(basePrice)}). Suas informações são protegidas.</Text></View>{additional.map(it=><Panel key={it.idItem} compact><View style={styles.cardHead}><View style={{flex:1}}><Text style={styles.itemTitle}>{it.nome}</Text><Text style={styles.muted}>{currency(it.valorMedio)} por unidade</Text></View><Stepper value={quantities[it.idItem]??0} onMinus={()=>setQuantities(q=>({...q,[it.idItem]:Math.max(0,(q[it.idItem]??0)-1)}))} onPlus={()=>setQuantities(q=>({...q,[it.idItem]:(q[it.idItem]??0)+1}))}/></View></Panel>)}<View style={styles.totalBox}><Text style={styles.muted}>Total estimado</Text><Text style={styles.totalValue}>{currency(basePrice+addPrice)}</Text></View><Action title="Confirmar solicitação" disabled={busy} onPress={()=>void submitAid()}/></>:null}
      {screen==="donate"&&current?<><Text style={styles.heading}>Contribuir</Text><Text style={styles.caption}>Meta restante: <Text style={styles.strong}>{currency(Math.max(0,remaining))}</Text></Text><View style={styles.notice}><Text style={styles.noticeText}>Esta é uma simulação acadêmica; nenhuma cobrança será feita.</Text></View>
        <View style={styles.segment}><Pressable accessibilityRole="button" onPress={()=>setType("ITEM")} style={[styles.segmentItem,type==="ITEM"&&styles.segmentItemActive]}><Text style={[styles.segmentText,type==="ITEM"&&styles.segmentTextActive]}>Por item</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setType("VALOR")} style={[styles.segmentItem,type==="VALOR"&&styles.segmentItemActive]}><Text style={[styles.segmentText,type==="VALOR"&&styles.segmentTextActive]}>Por valor</Text></Pressable></View>
        {type==="VALOR"?<Field label="Valor em R$" value={value} onChange={setValue} number/>:current.itens.filter(it=>(it.quantidadeArrecadada??0)<(it.quantidadeNecessaria??0)).map(it=><Panel key={it.idItem} compact><View style={styles.cardHead}><View style={{flex:1}}><Text style={styles.itemTitle}>{it.nome}</Text><Text style={styles.muted}>{currency(it.valorMedio)} • necessário: {(it.quantidadeNecessaria??0)-(it.quantidadeArrecadada??0)}</Text></View><Stepper value={quantities[it.idItem]??0} onMinus={()=>setQuantities(q=>({...q,[it.idItem]:Math.max(0,(q[it.idItem]??0)-1)}))} onPlus={()=>setQuantities(q=>({...q,[it.idItem]:Math.min((it.quantidadeNecessaria??0)-(it.quantidadeArrecadada??0),(q[it.idItem]??0)+1)}))}/></View></Panel>)}
        <View style={styles.totalBox}><Text style={styles.muted}>Contribuição</Text><Text style={styles.totalValue}>{Number.isFinite(donatePrice) ? currency(donatePrice) : "Valor inválido"}</Text></View><Action title="Registrar doação de teste" disabled={busy||!Number.isFinite(donatePrice)||donatePrice<0.01||donatePrice>remaining} onPress={()=>void submitDonation()}/>
      </>:null}
      {screen==="notifications"?<><Text style={styles.heading}>Notificações</Text>{notifications.length===0?<Empty title="Nenhuma notificação" text="Os avisos sobre suas cestas aparecerão aqui."/>:null}{notifications.map(n=><Panel key={n.idNotificacao} tone={n.lida?"muted":"highlight"}><View style={styles.cardHead}><Text style={styles.notifType}>{label(n.tipo)}</Text>{!n.lida?<View style={styles.dot}/>:<Text style={styles.muted}>Lida</Text>}</View><Text style={styles.body}>{n.mensagem}</Text>{!n.lida?<Action title="Marcar como lida" secondary onPress={()=>void change(()=>api(`/notifications/${n.idNotificacao}/read`,token,"PATCH"),"Notificação lida")}/>:null}</Panel>)}</>:null}
      {screen==="admin"&&user.tipo==="ADMIN"?<><Text style={styles.heading}>Homologar ONGs</Text>{organizations.length===0?<Empty title="Nenhuma ONG pendente" text="Todas as instituições já foram analisadas."/>:null}{organizations.map(o=><Panel key={o.idOng}><View style={styles.cardHead}><Text style={[styles.cardTitle,{flex:1}]}>{o.nomeFantasia}</Text><Badge status="PENDENTE"/></View><Text style={styles.muted}>CNPJ: {o.cnpj}</Text><Action title="Aprovar" onPress={()=>void change(async()=>{await api(`/admin/organizations/${o.idOng}/approve`,token,"PATCH");setOrganizations(prev=>prev.filter(x=>x.idOng!==o.idOng))},"ONG aprovada")}/><Action title="Rejeitar" danger onPress={()=>void change(async()=>{await api(`/admin/organizations/${o.idOng}/reject`,token,"PATCH");setOrganizations(prev=>prev.filter(x=>x.idOng!==o.idOng))},"ONG rejeitada")}/></Panel>)}</>:null}
      {screen==="inventory"&&user.tipo==="ONG"?<><Text style={styles.heading}>Estoque da ONG</Text>{inventory.map(it=><Panel key={it.idItem}><Text style={styles.cardTitle}>{it.nome}</Text><View style={styles.statRow}><Stat label="Disponível" value={String(it.quantidadeDisponivel)}/><Stat label="Reservado" value={String(it.quantidadeReservada)}/></View><Field label="Nova quantidade disponível" value={stockEdit[it.idItem]??String(it.quantidadeDisponivel)} onChange={s=>setStockEdit(q=>({...q,[it.idItem]:s}))} number/><Action title="Salvar estoque" onPress={()=>void change(()=>api(`/organizations/me/inventory/${it.idItem}`,token,"PUT",{quantidadeDisponivel:Number(stockEdit[it.idItem]??it.quantidadeDisponivel)}),"Estoque salvo")}/></Panel>)}<Action title="Acompanhar entregas" secondary onPress={()=>go("deliveries")}/></>:null}
      {screen==="deliveries"&&user.tipo==="ONG"?<><Text style={styles.heading}>Entregas da ONG</Text>{deliveries.length===0?<Empty title="Nenhuma entrega agendada" text="As entregas agendadas pelo painel web aparecerão aqui."/>:null}{deliveries.map(d=><Panel key={d.idEntrega}><View style={styles.cardHead}><Text style={[styles.cardTitle,{flex:1}]}>Entrega #{d.idEntrega} · Cesta #{d.idCesta}</Text><Badge status={d.status}/></View><Text style={styles.muted}>Agendada para {new Date(d.dataAgendada).toLocaleDateString("pt-BR")}</Text>{d.status!=="ENTREGUE"?<Action title={d.status==="PENDENTE"?"Iniciar rota":"Confirmar entrega"} onPress={()=>void change(()=>api(`/organizations/me/deliveries/${d.idEntrega}/status`,token,"PATCH",{status:d.status==="PENDENTE"?"EM_ROTA":"ENTREGUE"}),"Status atualizado")}/>:null}</Panel>)}
        <View style={styles.notice}><Text style={styles.noticeText}>Para agendar uma entrega, use o painel web da ONG: ele permite selecionar as cestas concluídas e reservar estoque.</Text></View>
      </>:null}
      {screen==="profile"?<><Text style={styles.heading}>Meu perfil</Text><Panel><View style={styles.profileRow}><View style={[styles.avatar,styles.avatarLg]}><Text style={[styles.avatarText,{fontSize:20}]}>{initials(user.nome)}</Text></View><View style={{flex:1}}><Text style={styles.cardTitle}>{user.nome}</Text><Text style={styles.muted}>{user.email}</Text><Text style={styles.heroChipDark}>{label(user.tipo)}</Text></View></View></Panel>{user.tipo==="FAMILIA"?<Panel><Text style={styles.cardTitle}>Endereço de entrega</Text><Text style={styles.muted}>Visível apenas para a ONG responsável.</Text><Field label="Endereço de entrega" value={address} onChange={setAddress}/><Field label="Latitude opcional" value={latitude} onChange={setLatitude} number/><Field label="Longitude opcional" value={longitude} onChange={setLongitude} number/><Action title="Salvar endereço protegido" onPress={()=>void change(()=>api("/families/me/address",token,"PUT",{endereco:address,...(latitude&&longitude?{latitude:Number(latitude),longitude:Number(longitude)}:{})}),"Endereço salvo")}/></Panel>:null}</>:null}
    </ScrollView>
    <View style={styles.navigation}>{tabs.map(t=>{const active=screen===t.key;return <Pressable key={t.key} accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>go(t.key)} style={[styles.tab,active&&styles.tabActive]}><View style={[styles.tabDot,active&&styles.tabDotActive]}/><Text style={[styles.tabText,active&&styles.tabTextActive]}>{t.title}</Text></Pressable>})}</View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.page,paddingTop:StatusBar.currentHeight??0},
  center:{alignItems:"center",justifyContent:"center"},
  header:{paddingHorizontal:18,paddingVertical:12,backgroundColor:C.surface,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderColor:C.line},
  headerRight:{flexDirection:"row",alignItems:"center",gap:10},
  brand:{flexDirection:"row",alignItems:"center",gap:10},
  brandMark:{width:40,height:40},
  logo:{fontSize:19,fontWeight:"900",color:C.logo,letterSpacing:.4},
  logoSub:{fontSize:11,fontWeight:"600",color:C.muted,marginTop:-2},
  avatar:{width:36,height:36,borderRadius:18,backgroundColor:C.brand100,alignItems:"center",justifyContent:"center"},
  avatarLg:{width:56,height:56,borderRadius:28},
  avatarText:{color:C.brandDark,fontWeight:"800",fontSize:13},
  logout:{paddingVertical:8,paddingHorizontal:14,borderRadius:999,borderWidth:1,borderColor:C.lineStrong},
  logoutText:{color:C.inkSoft,fontWeight:"700",fontSize:13},
  container:{padding:18,paddingBottom:40,gap:12},
  authContainer:{flexGrow:1,justifyContent:"center"},
  authCard:{backgroundColor:C.surface,borderRadius:24,padding:24,gap:10,borderWidth:1,borderColor:C.line,shadowColor:"#13231a",shadowOpacity:.08,shadowRadius:20,shadowOffset:{width:0,height:10},elevation:3},
  heading:{fontSize:24,fontWeight:"800",color:C.ink,marginTop:8,letterSpacing:-.3},
  sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:8},
  sectionTitle:{fontSize:18,fontWeight:"800",color:C.ink,marginTop:6},
  count:{minWidth:28,textAlign:"center",paddingHorizontal:10,paddingVertical:3,borderRadius:999,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,color:C.muted,fontWeight:"700",fontSize:12,overflow:"hidden"},
  caption:{color:C.muted,fontSize:14},
  strong:{color:C.brandDark,fontWeight:"800"},
  muted:{color:C.muted,fontSize:13},
  body:{color:C.inkSoft,fontSize:14,lineHeight:20},
  hero:{backgroundColor:C.brandDark,borderRadius:22,padding:20,paddingTop:24,minHeight:190,justifyContent:"flex-end",overflow:"hidden",gap:8,shadowColor:C.brandDark,shadowOpacity:.25,shadowRadius:16,shadowOffset:{width:0,height:8},elevation:4},
  heroImage:{borderRadius:22},
  heroOverlay:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(13,58,31,0.78)"},
  heroChip:{alignSelf:"flex-start",color:"#fff",backgroundColor:"rgba(255,255,255,0.18)",paddingHorizontal:10,paddingVertical:4,borderRadius:999,fontSize:11,fontWeight:"800",overflow:"hidden"},
  heroChipDark:{alignSelf:"flex-start",marginTop:6,color:C.brandDark,backgroundColor:C.brand50,paddingHorizontal:10,paddingVertical:3,borderRadius:999,fontSize:11,fontWeight:"800",overflow:"hidden"},
  heroTitle:{color:"#fff",fontSize:24,fontWeight:"800",letterSpacing:-.3},
  heroText:{color:"rgba(255,255,255,0.86)",fontSize:14,marginBottom:4},
  panel:{backgroundColor:C.surface,padding:16,borderRadius:18,borderWidth:1,borderColor:C.line,gap:10,shadowColor:"#13231a",shadowOpacity:.05,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1},
  panelCompact:{padding:14,borderRadius:14,gap:8},
  panelHighlight:{backgroundColor:C.brand50,borderColor:C.brand200},
  panelMuted:{opacity:.8},
  cardHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  cardTitle:{fontSize:16,fontWeight:"800",color:C.ink},
  itemTitle:{fontSize:15,fontWeight:"700",color:C.ink},
  itemQty:{fontSize:14,fontWeight:"800",color:C.brandDark},
  notifType:{fontSize:11,fontWeight:"800",letterSpacing:.8,color:C.brandDark,textTransform:"uppercase"},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:C.brand},
  badge:{paddingHorizontal:10,paddingVertical:4,borderRadius:999,backgroundColor:C.brand50,borderWidth:1,borderColor:C.brand200},
  badgeWarn:{backgroundColor:C.warningBg,borderColor:"#f6dfae"},
  badgeInfo:{backgroundColor:C.infoBg,borderColor:"#c9dafc"},
  badgeText:{fontSize:11,fontWeight:"800",color:C.brandDark},
  progressRow:{flexDirection:"row",alignItems:"center",gap:10},
  progressTrack:{flex:1,height:8,borderRadius:999,backgroundColor:C.brand100,overflow:"hidden"},
  progressValue:{height:"100%",borderRadius:999,backgroundColor:C.brand},
  progressLabel:{minWidth:38,textAlign:"right",fontWeight:"800",color:C.brandDark,fontSize:13},
  statRow:{flexDirection:"row",gap:10},
  stat:{flex:1,padding:12,borderRadius:14,backgroundColor:C.surfaceSoft,borderWidth:1,borderColor:C.line,gap:2},
  statValue:{fontSize:17,fontWeight:"800",color:C.ink},
  notice:{padding:12,borderRadius:14,backgroundColor:C.brand50,borderWidth:1,borderColor:C.brand200},
  noticeText:{color:C.brandDeep,fontSize:13,lineHeight:19},
  totalBox:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:16,borderRadius:16,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,marginTop:4},
  totalValue:{fontSize:20,fontWeight:"900",color:C.brandDark},
  stepper:{flexDirection:"row",alignItems:"center",gap:4,padding:4,borderRadius:999,borderWidth:1,borderColor:C.lineStrong,backgroundColor:C.surface},
  stepBtn:{width:32,height:32,borderRadius:16,backgroundColor:C.brand50,alignItems:"center",justifyContent:"center"},
  stepText:{fontSize:18,fontWeight:"800",color:C.brandDark,marginTop:-1},
  stepValue:{minWidth:24,textAlign:"center",fontWeight:"800",color:C.ink},
  segment:{flexDirection:"row",padding:4,borderRadius:999,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,gap:4},
  segmentItem:{flex:1,paddingVertical:9,borderRadius:999,alignItems:"center"},
  segmentItemActive:{backgroundColor:C.brand},
  segmentText:{fontWeight:"700",color:C.inkSoft,fontSize:13},
  segmentTextActive:{color:"#fff"},
  empty:{alignItems:"center",gap:6,padding:24,borderRadius:18,borderWidth:1,borderStyle:"dashed",borderColor:C.lineStrong,backgroundColor:C.surface},
  profileRow:{flexDirection:"row",alignItems:"center",gap:14},
  back:{alignSelf:"flex-start",paddingVertical:4},
  backText:{color:C.muted,fontWeight:"700"},
  label:{fontWeight:"700",color:C.inkSoft,fontSize:13},field:{gap:6,marginTop:4},
  input:{backgroundColor:C.surfaceSoft,paddingVertical:12,paddingHorizontal:14,borderRadius:12,borderWidth:1,borderColor:C.lineStrong,fontSize:16,color:C.ink},
  row:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10},
  button:{paddingVertical:13,paddingHorizontal:18,backgroundColor:C.brand,borderRadius:999,alignItems:"center",minWidth:55,marginTop:4},
  buttonSecondary:{backgroundColor:C.surface,borderWidth:1,borderColor:C.brand200},
  buttonLight:{backgroundColor:"#fff",alignSelf:"flex-start",paddingVertical:10},
  buttonDanger:{backgroundColor:C.surface,borderWidth:1,borderColor:"#f0c4c4"},
  buttonText:{color:"#fff",fontWeight:"800",fontSize:15},buttonTextSecondary:{color:C.brandDark},buttonTextLight:{color:C.brandDark},buttonTextDanger:{color:C.danger},
  navigation:{flexDirection:"row",justifyContent:"space-around",padding:6,marginHorizontal:12,marginBottom:10,backgroundColor:C.surface,borderRadius:22,borderWidth:1,borderColor:C.line,shadowColor:"#13231a",shadowOpacity:.1,shadowRadius:16,shadowOffset:{width:0,height:6},elevation:6},
  tab:{flex:1,alignItems:"center",paddingVertical:9,borderRadius:16,gap:4},
  tabActive:{backgroundColor:C.brand100},
  tabDot:{width:5,height:5,borderRadius:3,backgroundColor:"transparent"},
  tabDotActive:{backgroundColor:C.brand},
  tabText:{fontSize:12,fontWeight:"700",color:C.muted},
  tabTextActive:{color:C.brandDark},
  error:{color:C.danger,backgroundColor:C.dangerBg,padding:12,borderRadius:12,borderWidth:1,borderColor:"#f3c7c7"},
  link:{color:C.brandDark,fontWeight:"700"}
});
