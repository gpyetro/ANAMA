import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
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
function Action({title,onPress,disabled,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button,secondary&&styles.buttonSecondary,disabled&&{opacity:.45}]}><Text style={[styles.buttonText,secondary&&styles.buttonTextSecondary]}>{title}</Text></Pressable>;
}
function Field({label,value,onChange,secure=false,number=false}:{label:string;value:string;onChange:(s:string)=>void;secure?:boolean;number?:boolean}){
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" keyboardType={number?"numeric":"default"} secureTextEntry={secure} style={styles.input} value={value} onChangeText={onChange} /></View>;
}
function Panel({children}:{children:ReactNode}){return <View style={styles.panel}>{children}</View>}
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
  if(booting)return <SafeAreaView style={styles.safe}><Text style={styles.heading}>Carregando ANAMÃ…</Text></SafeAreaView>;
  if(!token||!user)return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><Text style={styles.logo}>ANAMÃ</Text><Text style={styles.heading}>{register?"Criar conta":"Bem-vindo(a)"}</Text><Text style={styles.caption}>Plataforma solidária de cestas básicas</Text>{error?<Text style={styles.error}>{error}</Text>:null}
    {register?<><View style={styles.row}>{(["DOADOR","FAMILIA","ONG"] as const).map(r=><Action key={r} title={r} secondary={role!==r} onPress={()=>setRole(r)}/>)}</View><Field label="Seu nome" value={nome} onChange={setNome}/>{role==="FAMILIA"?<Field label="Número de integrantes" value={extra} onChange={setExtra} number/>:null}{role==="ONG"?<><Field label="Nome da ONG" value={extra} onChange={setExtra}/><Field label="CNPJ" value={cnpj} onChange={setCnpj}/></>:null}</>:null}
    <Field label="E-mail" value={email} onChange={setEmail}/><Field label="Senha" value={senha} onChange={setSenha} secure/><Action title={busy?"Aguarde…":register?"Cadastrar":"Entrar"} disabled={busy} onPress={()=>void session()}/><Action title={register?"Já tenho conta":"Criar conta"} secondary onPress={()=>{setRegister(!register);setError("")}}/></ScrollView></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content"/><View style={styles.header}><Text style={styles.logo}>ANAMÃ</Text><Pressable onPress={()=>void logOut()}><Text style={styles.link}>Sair</Text></Pressable></View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()}/>} contentContainerStyle={styles.container}>
      <Text style={styles.caption}>{user.nome} · {user.tipo}</Text>{error?<Text style={styles.error}>{error}</Text>:null}
      {screen!=="home"?<Action title="← Voltar ao início" secondary onPress={()=>go("home")}/>:null}
      {screen==="home"?<><Text style={styles.heading}>Cestas em andamento</Text>{user.tipo==="FAMILIA"?<Action title="Solicitar auxílio" onPress={()=>{setQuantities({});go("aid")}}/>:null}
        {user.tipo==="ONG"?<Action title={user.ong?.statusVerificacao==="APROVADA"?"Estoque e entregas":"ONG em análise"} disabled={user.ong?.statusVerificacao!=="APROVADA"} onPress={()=>go("inventory")}/>:null}
        {user.tipo==="ADMIN"?<Action title="Homologar ONGs" onPress={()=>go("admin")}/>:null}
        <Action title="Notificações" secondary onPress={()=>go("notifications")}/><Action title="Meu perfil" secondary onPress={()=>go("profile")}/>
        {baskets.length===0?<Text>Não existem cestas em montagem.</Text>:null}
        {baskets.map(b=><Panel key={b.idCesta}><Text style={styles.subtitle}>Cesta #{b.idCesta}</Text><Text>Família {b.codigoFamilia.slice(0,8)} · {b.status}</Text><Text>{currency(b.valorArrecadado)} de {currency(b.valorEstimado)} ({b.percentual}%)</Text><Action title="Ver cesta" onPress={()=>openBasket(b)}/></Panel>)}
      </>:null}
      {screen==="detail"&&current?<><Text style={styles.heading}>Cesta #{current.idCesta}</Text><Panel><Text>Família {current.codigoFamilia.slice(0,8)}</Text><Text>Status: {current.status}</Text><Text>Arrecadado: {currency(current.valorArrecadado)}</Text><Text>Meta: {currency(current.valorEstimado)}</Text><Text>Progresso: {current.percentual}%</Text></Panel>
        {current.itens.map(it=><Panel key={it.idItem}><Text style={styles.subtitle}>{it.nome}</Text><Text>Arrecadado: {it.quantidadeArrecadada}/{it.quantidadeNecessaria} itens</Text></Panel>)}
        {user.tipo==="DOADOR"&&current.status==="EM_MONTAGEM"?<Action title="Contribuir" onPress={()=>{setQuantities({});go("donate")}}/>:null}
      </>:null}
      {screen==="aid"?<><Text style={styles.heading}>Solicitar cesta</Text><Text>Itens essenciais incluídos automaticamente ({currency(basePrice)})</Text>{additional.map(it=><Panel key={it.idItem}><Text style={styles.subtitle}>{it.nome}</Text><Text>{currency(it.valorMedio)} por unidade</Text><View style={styles.row}><Action title="−" secondary onPress={()=>setQuantities(q=>({...q,[it.idItem]:Math.max(0,(q[it.idItem]??0)-1)}))}/><Text>{quantities[it.idItem]??0}</Text><Action title="+" secondary onPress={()=>setQuantities(q=>({...q,[it.idItem]:(q[it.idItem]??0)+1}))}/></View></Panel>)}<Text style={styles.subtitle}>Total estimado: {currency(basePrice+addPrice)}</Text><Action title="Confirmar solicitação" disabled={busy} onPress={()=>void submitAid()}/></>:null}
      {screen==="donate"&&current?<><Text style={styles.heading}>Contribuir</Text><Text>Meta restante: {currency(Math.max(0,remaining))}</Text><Text>Esta é uma simulação acadêmica; nenhuma cobrança será feita.</Text><View style={styles.row}><Action title="Por item" secondary={type!=="ITEM"} onPress={()=>setType("ITEM")}/><Action title="Por valor" secondary={type!=="VALOR"} onPress={()=>setType("VALOR")}/></View>
        {type==="VALOR"?<Field label="Valor em R$" value={value} onChange={setValue} number/>:current.itens.filter(it=>(it.quantidadeArrecadada??0)<(it.quantidadeNecessaria??0)).map(it=><Panel key={it.idItem}><Text style={styles.subtitle}>{it.nome}</Text><Text>{currency(it.valorMedio)} • necessário: {(it.quantidadeNecessaria??0)-(it.quantidadeArrecadada??0)}</Text><View style={styles.row}><Action title="−" secondary onPress={()=>setQuantities(q=>({...q,[it.idItem]:Math.max(0,(q[it.idItem]??0)-1)}))}/><Text>{quantities[it.idItem]??0}</Text><Action title="+" secondary onPress={()=>setQuantities(q=>({...q,[it.idItem]:Math.min((it.quantidadeNecessaria??0)-(it.quantidadeArrecadada??0),(q[it.idItem]??0)+1)}))}/></View></Panel>)}
        <Text style={styles.subtitle}>Contribuição: {Number.isFinite(donatePrice) ? currency(donatePrice) : "Valor inválido"}</Text><Action title="Registrar doação de teste" disabled={busy||!Number.isFinite(donatePrice)||donatePrice<0.01||donatePrice>remaining} onPress={()=>void submitDonation()}/>
      </>:null}
      {screen==="notifications"?<><Text style={styles.heading}>Notificações</Text>{notifications.map(n=><Panel key={n.idNotificacao}><Text style={styles.subtitle}>{n.tipo}</Text><Text>{n.mensagem}</Text>{!n.lida?<Action title="Marcar como lida" onPress={()=>void change(()=>api(`/notifications/${n.idNotificacao}/read`,token,"PATCH"),"Notificação lida")}/>:<Text>Lida</Text>}</Panel>)}</>:null}
      {screen==="admin"&&user.tipo==="ADMIN"?<><Text style={styles.heading}>Homologar ONGs</Text>{organizations.map(o=><Panel key={o.idOng}><Text style={styles.subtitle}>{o.nomeFantasia}</Text><Text>CNPJ: {o.cnpj}</Text><Action title="Aprovar" onPress={()=>void change(async()=>{await api(`/admin/organizations/${o.idOng}/approve`,token,"PATCH");setOrganizations(prev=>prev.filter(x=>x.idOng!==o.idOng))},"ONG aprovada")}/><Action title="Rejeitar" secondary onPress={()=>void change(async()=>{await api(`/admin/organizations/${o.idOng}/reject`,token,"PATCH");setOrganizations(prev=>prev.filter(x=>x.idOng!==o.idOng))},"ONG rejeitada")}/></Panel>)}</>:null}
      {screen==="inventory"&&user.tipo==="ONG"?<><Text style={styles.heading}>Estoque da ONG</Text>{inventory.map(it=><Panel key={it.idItem}><Text style={styles.subtitle}>{it.nome}</Text><Text>Disponível: {it.quantidadeDisponivel} · Reservado: {it.quantidadeReservada}</Text><Field label="Nova quantidade disponível" value={stockEdit[it.idItem]??String(it.quantidadeDisponivel)} onChange={s=>setStockEdit(q=>({...q,[it.idItem]:s}))} number/><Action title="Salvar estoque" onPress={()=>void change(()=>api(`/organizations/me/inventory/${it.idItem}`,token,"PUT",{quantidadeDisponivel:Number(stockEdit[it.idItem]??it.quantidadeDisponivel)}),"Estoque salvo")}/></Panel>)}<Action title="Acompanhar entregas" onPress={()=>go("deliveries")}/></>:null}
      {screen==="deliveries"&&user.tipo==="ONG"?<><Text style={styles.heading}>Entregas da ONG</Text>{deliveries.map(d=><Panel key={d.idEntrega}><Text style={styles.subtitle}>Entrega #{d.idEntrega} · Cesta #{d.idCesta}</Text><Text>{d.status} · {new Date(d.dataAgendada).toLocaleDateString("pt-BR")}</Text>{d.status!=="ENTREGUE"?<Action title={d.status==="PENDENTE"?"Iniciar rota":"Confirmar entrega"} onPress={()=>void change(()=>api(`/organizations/me/deliveries/${d.idEntrega}/status`,token,"PATCH",{status:d.status==="PENDENTE"?"EM_ROTA":"ENTREGUE"}),"Status atualizado")}/>:null}</Panel>)}
        <Text>Para agendar uma entrega, use o painel web da ONG: ele permite selecionar as cestas concluídas e reservar estoque.</Text>
      </>:null}
      {screen==="profile"?<><Text style={styles.heading}>Meu perfil</Text><Panel><Text>{user.nome}</Text><Text>{user.email}</Text><Text>Perfil: {user.tipo}</Text></Panel>{user.tipo==="FAMILIA"?<><Field label="Endereço de entrega" value={address} onChange={setAddress}/><Field label="Latitude opcional" value={latitude} onChange={setLatitude} number/><Field label="Longitude opcional" value={longitude} onChange={setLongitude} number/><Action title="Salvar endereço protegido" onPress={()=>void change(()=>api("/families/me/address",token,"PUT",{endereco:address,...(latitude&&longitude?{latitude:Number(latitude),longitude:Number(longitude)}:{})}),"Endereço salvo")}/></>:null}</>:null}
    </ScrollView>
    <View style={styles.navigation}><Action title="Início" secondary onPress={()=>go("home")}/><Action title="Avisos" secondary onPress={()=>go("notifications")}/><Action title="Perfil" secondary onPress={()=>go("profile")}/></View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f4f8f3",paddingTop:StatusBar.currentHeight??0},
  header:{padding:16,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderColor:"#d7e7da"},
  container:{padding:18,paddingBottom:48,gap:10},logo:{fontSize:23,fontWeight:"900",color:"#267846"},heading:{fontSize:26,fontWeight:"800",color:"#224a31",marginTop:14},subtitle:{fontSize:17,fontWeight:"700",color:"#235139",marginBottom:8},caption:{color:"#57705c"},
  panel:{backgroundColor:"#fff",padding:16,borderRadius:12,marginTop:12,borderWidth:1,borderColor:"#d9e9dc",gap:8},
  label:{fontWeight:"600",color:"#2d553a"},field:{gap:6,marginTop:8},input:{backgroundColor:"#fff",padding:12,borderRadius:8,borderWidth:1,borderColor:"#b2c9b7",fontSize:16},
  row:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10},button:{paddingVertical:11,paddingHorizontal:16,backgroundColor:"#287a48",borderRadius:9,alignItems:"center",minWidth:55,marginTop:6},buttonSecondary:{backgroundColor:"#e9f4eb",borderWidth:1,borderColor:"#b8d9c3"},buttonText:{color:"#fff",fontWeight:"700"},buttonTextSecondary:{color:"#276a3f"},
  navigation:{flexDirection:"row",justifyContent:"space-around",padding:8,backgroundColor:"#fff",borderTopWidth:1,borderColor:"#dceadf"},error:{color:"#8f3030",backgroundColor:"#ffeded",padding:12,borderRadius:8},link:{color:"#267846",fontWeight:"700"}
});
