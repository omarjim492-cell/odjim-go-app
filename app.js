/* ODJIM GO — application layer extracted from index_1.html (R16.25)
   Business logic preserved. Firebase configuration remains in the HTML entry point.
*/
(function(){
"use strict";
firebase.initializeApp({
  apiKey:"AIzaSyCUB0t9wvZp2pXhjYmv2G7AeToWNekJRTg",
  authDomain:"odjim-solution.firebaseapp.com",
  projectId:"odjim-solution",
  storageBucket:"odjim-solution.firebasestorage.app",
  messagingSenderId:"165673018775",
  appId:"1:165673018775:web:c8b4cc6345b854763950d2"
});
const db=firebase.firestore();
const auth=firebase.auth();
let messaging=null;
try { messaging=firebase.messaging(); } catch(e) { console.warn("FCM indisponível neste ambiente", e); }

// ── ODJIM GO FIREBASE SERVICE LAYER ──
const ODJIM = {
  serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),
  userRef: uid => db.collection("usuarios").doc(uid),
  tecnicoRef: uid => db.collection("tecnicos").doc(uid),
  pedidoRef: id => db.collection("pedidos").doc(id),
  async getRole(user=auth.currentUser){
    if(!user) return null;
    const snap=await db.collection("usuarios").doc(user.uid).get();
    return snap.exists ? (snap.data().role || null) : null;
  },
  async requireRole(role){
    const user=auth.currentUser;
    if(!user) throw new Error("Sessão não autenticada.");
    const current=await this.getRole(user);
    if(current!==role && !(role==="admin" && current==="superadmin")) throw new Error("Acesso não autorizado.");
    return user;
  },
  async audit(acao, entidade, entidadeId, extras={}){
    const user=auth.currentUser;
    if(!user) return;
    const role=await this.getRole(user).catch(()=>null);
    return db.collection("auditoria").add({
      atorUid:user.uid, atorRole:role || "desconhecido", acao, entidade, entidadeId,
      ...extras, criadoEm:this.serverTimestamp()
    });
  },
  async notify(uid, tipo, titulo, mensagem, pedidoId=""){
    if(!uid) return;
    return db.collection("notificacoes").add({destinatarioUid:uid,tipo,titulo,mensagem,pedidoId,lida:false,criadoEm:this.serverTimestamp()});
  }
};

// Cache local do Firestore para melhor resiliência de rede
db.enablePersistence({synchronizeTabs:true}).catch(err=>console.warn("Persistência Firestore:",err.code));

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("firebase-messaging-sw.js").catch(e=>console.log(e));
}

// ── TOAST ──
function toast(msg,dur=4000){
  const t=document.getElementById("toast");
  t.textContent=msg;t.style.display="block";
  setTimeout(()=>t.style.display="none",dur);
}

// ── NAVEGAÇÃO ──
function irPara(tela){
  document.getElementById("splash").style.display="none";
  document.querySelectorAll(".tela").forEach(t=>t.classList.remove("ativa"));
  document.getElementById("tela-"+tela).classList.add("ativa");
  if(tela==="cliente"){initMap();carregarInfoEmpresa();}
  if(tela==="tecnico")verificarTecnico();
  if(tela==="admin")verificarAdmin();
}

function voltar(){
  document.querySelectorAll(".tela").forEach(t=>t.classList.remove("ativa"));
  document.getElementById("splash").style.display="flex";
}

// ── CLIENTE ──
function irCliente(){
  const user=auth.currentUser;
  if(user){
    irPara("cliente");
    document.getElementById("badge-cliente").textContent=user.displayName||"Cliente";
  } else {
    document.getElementById("modal-cadastro").classList.add("aberto");
  }
}

function modalTab(tab){
  document.getElementById("modal-login").style.display=tab==="login"?"block":"none";
  document.getElementById("modal-registo").style.display=tab==="registo"?"block":"none";
  document.querySelectorAll(".modal-tab").forEach((b,i)=>b.classList.toggle("ativa",(i===0&&tab==="login")||(i===1&&tab==="registo")));
}

async function loginCliente(){
  const email=document.getElementById("cl-email").value.trim();
  const pass=document.getElementById("cl-pass").value;
  if(!email||!pass){toast("⚠️ Preencha email e senha.");return;}
  try{
    const cred=await auth.signInWithEmailAndPassword(email,pass);
    document.getElementById("modal-cadastro").classList.remove("aberto");
    irPara("cliente");
    document.getElementById("badge-cliente").textContent=cred.user.displayName||"Cliente";
    toast("✅ Bem-vindo de volta!");
  }catch(e){
    if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")
      toast("❌ Email ou senha incorretos.");
    else toast("❌ Erro: "+e.message);
  }
}

async function cadastrarCliente(){
  const nome=document.getElementById("cr-nome").value.trim();
  const email=document.getElementById("cr-email").value.trim();
  const tel=document.getElementById("cr-tel").value.trim();
  const pass=document.getElementById("cr-pass").value;
  if(!nome||!email||!pass){toast("⚠️ Preencha todos os campos.");return;}
  if(pass.length<6){toast("⚠️ Senha mínimo 6 caracteres.");return;}
  try{
    const cred=await auth.createUserWithEmailAndPassword(email,pass);
    await cred.user.updateProfile({displayName:nome});
    const base={nome,email,telefone:tel,uid:cred.user.uid,role:"cliente",ativo:true,criadoEm:ODJIM.serverTimestamp(),atualizadoEm:ODJIM.serverTimestamp()};
    await ODJIM.userRef(cred.user.uid).set(base,{merge:true});
    await db.collection("clientes").doc(cred.user.uid).set(base,{merge:true});
    document.getElementById("modal-cadastro").classList.remove("aberto");
    irPara("cliente");
    document.getElementById("badge-cliente").textContent=nome;
    toast("🎉 Conta criada! Bem-vindo, "+nome+"!");
  }catch(e){
    if(e.code==="auth/email-already-in-use")toast("❌ Email já registado. Use 'Entrar'.");
    else toast("❌ Erro: "+e.message);
  }
}

async function recuperarSenhaCliente(){
  const email=document.getElementById("cl-email").value.trim();
  if(!email){toast("⚠️ Escreva o seu email no campo acima primeiro.");return;}
  try{
    await auth.sendPasswordResetEmail(email);
    toast("📧 Email de recuperação enviado para "+email+"! Verifique a caixa de entrada.",6000);
  }catch(e){
    if(e.code==="auth/user-not-found")toast("❌ Email não encontrado.");
    else toast("❌ Erro ao enviar email: "+e.message);
  }
}

async function logoutCliente(){
  await auth.signOut();voltar();toast("👋 Sessão terminada.");
}

// ── MAPA ──
let map,marker;
function initMap(){
  if(map){setTimeout(()=>map.invalidateSize(),300);return;}
  setTimeout(()=>{
    map=L.map("mapa").setView([-8.8383,13.2344],13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
    map.on("click",e=>{
      const lat=e.latlng.lat.toFixed(6),lng=e.latlng.lng.toFixed(6);
      if(marker)marker.setLatLng(e.latlng);else marker=L.marker(e.latlng).addTo(map);
      document.getElementById("c-local").value=`Lat: ${lat}, Lon: ${lng}`;
    });
  },400);
}

// ── ENVIAR PEDIDO ──
async function enviarPedido(){
  const nome=document.getElementById("c-nome").value.trim();
  const tel=document.getElementById("c-tel").value.trim();
  const local=document.getElementById("c-local").value.trim();
  if(!nome||!tel||!local){toast("⚠️ Preencha Nome, Telefone e Localização.");return;}
  try{
    const user=auth.currentUser;
    if(!user){toast("⚠️ Entre na sua conta antes de enviar o pedido.");return;}
    const pedidoRef=db.collection("pedidos").doc();
    const pedido={
      id:pedidoRef.id, clienteUid:user.uid, nome, telefone:tel,
      email:document.getElementById("c-email").value.trim(),
      local, servico:document.getElementById("c-servico").value,
      descricao:document.getElementById("c-desc").value.trim(),
      inicio:document.getElementById("c-inicio").value||"",
      fim:document.getElementById("c-fim").value||"",
      estado:"AGUARDANDO_TECNICO", tecnicoUid:null, tecnicoNome:null,
      criadoEm:ODJIM.serverTimestamp(), atualizadoEm:ODJIM.serverTimestamp()
    };
    await pedidoRef.set(pedido);
    await ODJIM.audit("CRIAR_PEDIDO","pedido",pedidoRef.id,{estadoNovo:"AGUARDANDO_TECNICO"});
    toast("✅ Pedido enviado com sucesso! Entraremos em contacto em breve.");
    ["c-nome","c-tel","c-email","c-local","c-desc","c-inicio","c-fim"].forEach(id=>document.getElementById(id).value="");
    if(marker){map.removeLayer(marker);marker=null;}
  }catch(e){toast("❌ Erro ao enviar pedido: "+e.message);}
}

// ── INQUÉRITO ──
let avaliacaoAtual=null;
function avaliar(btn,nota,emoji,label){
  document.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("sel"));
  btn.classList.add("sel");
  avaliacaoAtual={nota,emoji,label};
  document.getElementById("inq-comentario").style.display="block";
  document.getElementById("inq-feedback").style.display="none";
}

async function enviarAvaliacao(){
  if(!avaliacaoAtual){toast("⚠️ Selecione um emoji primeiro.");return;}
  try{
    const user=auth.currentUser;
    if(!user){toast("⚠️ Entre na sua conta para avaliar.");return;}
    const ref=db.collection("avaliacoes").doc();
    await ref.set({id:ref.id,pedidoId:"",clienteUid:user.uid,...avaliacaoAtual,comentario:document.getElementById("av-comentario").value.trim(),criadoEm:ODJIM.serverTimestamp()});
    const msgs={
      1:"Lamentamos a má experiência! Vamos melhorar. 🙏",
      2:"Obrigado pelo feedback! Trabalharemos para melhorar. 💪",
      3:"Obrigado! Continuamos a crescer para si. 🌱",
      4:"Fico feliz que gostou! Obrigado. 😊",
      5:"Uau! O seu apoio motiva-nos muito! 🚀"
    };
    document.getElementById("feedback-em").textContent=avaliacaoAtual.emoji;
    document.getElementById("feedback-msg").textContent=msgs[avaliacaoAtual.nota];
    document.getElementById("inq-comentario").style.display="none";
    document.getElementById("inq-feedback").style.display="block";
    document.getElementById("av-comentario").value="";
    avaliacaoAtual=null;
    toast("✅ Avaliação enviada! Obrigado.");
  }catch(e){toast("❌ Erro ao enviar avaliação.");}
}

// ── INFO DA EMPRESA ──
async function carregarInfoEmpresa(){
  try{
    const doc=await db.collection("config").doc("empresa").get();
    if(doc.exists){
      const d=doc.data();
      if(d.descricao)document.getElementById("odjim-descricao").textContent=d.descricao;
      if(d.sobre)document.getElementById("odjim-sobre").textContent=d.sobre||"";
      if(d.tecnicos)document.getElementById("stat-tecnicos").textContent=d.tecnicos;
      if(d.satisfacao)document.getElementById("stat-satisfacao").textContent=d.satisfacao;
    }
  }catch(e){console.log("Info empresa:",e);}
}

async function carregarInfoParaEditar(){
  try{
    const doc=await db.collection("config").doc("empresa").get();
    if(doc.exists){
      const d=doc.data();
      if(d.descricao)document.getElementById("edit-descricao").value=d.descricao;
      if(d.sobre)document.getElementById("edit-sobre").value=d.sobre;
      if(d.tecnicos)document.getElementById("edit-tecnicos").value=d.tecnicos;
      if(d.satisfacao)document.getElementById("edit-satisfacao").value=d.satisfacao;
    }
  }catch(e){}
}

async function salvarInfoEmpresa(){
  const descricao=document.getElementById("edit-descricao").value.trim();
  const sobre=document.getElementById("edit-sobre").value.trim();
  const tecnicos=document.getElementById("edit-tecnicos").value.trim();
  const satisfacao=document.getElementById("edit-satisfacao").value.trim();
  try{
    await ODJIM.requireRole("admin");
    await db.collection("config").doc("empresa").set({descricao,sobre,tecnicos,satisfacao,atualizadoEm:ODJIM.serverTimestamp()},{merge:true});
    await ODJIM.audit("ATUALIZAR_CONFIG_EMPRESA","config","empresa");
    toast("✅ Informações da ODJIM atualizadas com sucesso!");
  }catch(e){toast("❌ Erro ao guardar: "+e.message);}
}

// ── TÉCNICO ──
function verificarTecnico(){
  const user=auth.currentUser;
  if(!user){document.getElementById("tecnico-login").style.display="block";return;}
  ODJIM.getRole(user).then(role=>{if(role==="tecnico")mostrarPainelTecnico();else toast("❌ Esta conta não tem perfil de técnico.");}).catch(()=>{});
}

async function loginTecnico(){
  const email=document.getElementById("t-email").value.trim();
  const pass=document.getElementById("t-pass").value;
  if(!email||!pass){toast("⚠️ Preencha email e senha.");return;}
  try{
    const cred=await auth.signInWithEmailAndPassword(email,pass);
    const role=await ODJIM.getRole(cred.user);
    if(role!=="tecnico"){await auth.signOut();throw new Error("Esta conta não possui perfil de técnico.");}
    mostrarPainelTecnico();
    toast("✅ Bem-vindo ao painel técnico!");
  }catch(e){
    if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")
      toast("❌ Email ou senha incorretos.");
    else toast("❌ Erro: "+e.message);
  }
}

function mostrarPainelTecnico(){
  document.getElementById("tecnico-login").style.display="none";
  document.getElementById("tecnico-painel").style.display="block";
  monitorarPedidos("t-pedidos");
}

async function logoutTecnico(){
  await auth.signOut();
  document.getElementById("tecnico-painel").style.display="none";
  document.getElementById("tecnico-login").style.display="block";
  toast("👋 Sessão terminada.");
}

async function recuperarSenhaTecnico(){
  const email=document.getElementById("t-email").value.trim();
  if(!email){toast("⚠️ Escreva o seu email no campo acima primeiro.");return;}
  try{
    await auth.sendPasswordResetEmail(email);
    toast("📧 Email de recuperação enviado para "+email+"! Verifique a caixa de entrada.",6000);
  }catch(e){
    if(e.code==="auth/user-not-found")toast("❌ Email não encontrado.");
    else toast("❌ Erro: "+e.message);
  }
}

// ── ADMIN ──
function verificarAdmin(){
  const user=auth.currentUser;
  if(!user){document.getElementById("admin-login").style.display="block";return;}
  ODJIM.getRole(user).then(role=>{if(role==="admin"||role==="superadmin")mostrarPainelAdmin();else toast("❌ Acesso administrativo negado.");}).catch(()=>{});
}

async function loginAdmin(){
  const email=document.getElementById("a-email").value.trim();
  const pass=document.getElementById("a-pass").value;
  if(!email||!pass){toast("⚠️ Preencha email e senha.");return;}
  try{
    const cred=await auth.signInWithEmailAndPassword(email,pass);
    const role=await ODJIM.getRole(cred.user);
    if(role!=="admin" && role!=="superadmin"){await auth.signOut();throw new Error("Esta conta não possui perfil administrativo.");}
    mostrarPainelAdmin();
    toast("✅ Bem-vindo, Admin!");
  }catch(e){
    if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")
      toast("❌ Credenciais incorretas.");
    else toast("❌ Erro: "+e.message);
  }
}

function mostrarPainelAdmin(){
  document.getElementById("admin-login").style.display="none";
  document.getElementById("admin-painel").style.display="block";
  monitorarPedidos("a-pedidos");
}


let ODJIM_REPORT_DATA=[];
function periodoRelatorio(){
  const ini=document.getElementById("rel-inicio")?.value||"";
  const fim=document.getElementById("rel-fim")?.value||"";
  return {ini,fim};
}
function dataPedido(p){
  const v=p.criadoEm;
  if(v && typeof v.toDate==="function") return v.toDate();
  if(v instanceof Date) return v;
  if(typeof v==="string") { const d=new Date(v); if(!isNaN(d)) return d; }
  return null;
}
function filtrarPeriodo(rows){
  const {ini,fim}=periodoRelatorio();
  const a=ini?new Date(ini+"T00:00:00"):null;
  const b=fim?new Date(fim+"T23:59:59.999"):null;
  return rows.filter(p=>{const d=dataPedido(p); if(!d)return true; return (!a||d>=a)&&(!b||d<=b);});
}
async function gerarRelatorioPedidos(){
  try{
    await ODJIM.requireRole("admin");
    const snap=await db.collection("pedidos").orderBy("criadoEm","desc").get();
    ODJIM_REPORT_DATA=filtrarPeriodo(snap.docs.map(d=>({id:d.id,...d.data()})));
    const total=ODJIM_REPORT_DATA.length;
    const concl=ODJIM_REPORT_DATA.filter(p=>p.estado==="CONCLUIDO").length;
    const cancel=ODJIM_REPORT_DATA.filter(p=>p.estado==="CANCELADO").length;
    const ativos=total-concl-cancel;
    const taxa=total?((concl/total)*100).toFixed(1):"0.0";
    const serv={}; ODJIM_REPORT_DATA.forEach(p=>{const k=p.servico||"Sem serviço";serv[k]=(serv[k]||0)+1;});
    const top=Object.entries(serv).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(k)}</span><strong>${v}</strong></div>`).join("")||"<span>Sem dados</span>";
    document.getElementById("relatorio-resumo").innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px"><div class="card"><small>Total</small><h3>${total}</h3></div><div class="card"><small>Concluídos</small><h3>${concl}</h3></div><div class="card"><small>Ativos</small><h3>${ativos}</h3></div><div class="card"><small>Taxa conclusão</small><h3>${taxa}%</h3></div></div><div class="card"><h4>Cancelados: ${cancel}</h4><h4 style="margin-top:12px">Serviços mais solicitados</h4>${top}</div>`;
    toast(`✅ Relatório gerado: ${total} pedidos.`);
  }catch(e){toast("❌ "+e.message);}
}
async function carregarResumoRelatorios(){
  const now=new Date(), first=new Date(now.getFullYear(),now.getMonth(),1);
  const f=x=>x.toISOString().slice(0,10);
  const a=document.getElementById("rel-inicio"),b=document.getElementById("rel-fim");
  if(a&&!a.value)a.value=f(first); if(b&&!b.value)b.value=f(now);
}
function exportarRelatorioCSV(){
  if(!ODJIM_REPORT_DATA.length){toast("⚠️ Gere o relatório primeiro.");return;}
  const headers=["ID","Cliente","Telefone","Serviço","Estado","Técnico","Local","Criado em"];
  const escCsv=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=ODJIM_REPORT_DATA.map(p=>[p.id,p.nome,p.telefone,p.servico,p.estado,p.tecnicoNome,p.local,dataPedido(p)?.toISOString()||""]);
  const csv=[headers,...rows].map(r=>r.map(escCsv).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`odjim-relatorio-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function imprimirRelatorio(){
  if(!ODJIM_REPORT_DATA.length){toast("⚠️ Gere o relatório primeiro.");return;}
  const w=window.open("","_blank"); if(!w){toast("❌ Permita pop-ups para gerar o relatório.");return;}
  const {ini,fim}=periodoRelatorio();
  const rows=ODJIM_REPORT_DATA.map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.nome)}</td><td>${esc(p.servico)}</td><td>${esc(p.estado)}</td><td>${esc(p.tecnicoNome||"")}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório ODJIM GO</title><style>body{font-family:Arial;padding:28px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:7px;text-align:left;font-size:12px}h1{margin:0 0 6px}@media print{button{display:none}}</style></head><body><h1>ODJIM SOLUTION — Relatório de Pedidos</h1><div>Período: ${esc(ini||"—")} a ${esc(fim||"—")}</div><p>Total: <b>${ODJIM_REPORT_DATA.length}</b></p><table><thead><tr><th>ID</th><th>Cliente</th><th>Serviço</th><th>Estado</th><th>Técnico</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}

async function logoutAdmin(){
  await auth.signOut();
  document.getElementById("admin-painel").style.display="none";
  document.getElementById("admin-login").style.display="block";
  toast("👋 Sessão terminada.");
}

async function recuperarSenhaAdmin(){
  const email=document.getElementById("a-email").value.trim();
  if(!email){toast("⚠️ Escreva o seu email no campo acima primeiro.");return;}
  try{
    await auth.sendPasswordResetEmail(email);
    toast("📧 Email de recuperação enviado para "+email+"! Verifique a caixa de entrada.",6000);
  }catch(e){
    if(e.code==="auth/user-not-found")toast("❌ Email não encontrado.");
    else toast("❌ Erro: "+e.message);
  }
}

function abrirTab(id,btn){
  ["tab-pedidos","tab-tecnicos","tab-cadastrar","tab-info"].forEach(t=>document.getElementById(t).style.display="none");
  document.getElementById(id).style.display="block";
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  if(id==="tab-tecnicos")carregarTecnicos();
  if(id==="tab-info")carregarInfoParaEditar();
}

// ── CADASTRAR TÉCNICO ──
async function cadastrarTecnico(){
  const admin=await ODJIM.requireRole("admin").catch(e=>{toast("❌ "+e.message);return null;});
  if(!admin)return;
  const nome=document.getElementById("nt-nome").value.trim();
  const email=document.getElementById("nt-email").value.trim();
  const pass=document.getElementById("nt-pass").value;
  const tel=document.getElementById("nt-tel").value.trim();
  const esp=document.getElementById("nt-esp").value;
  if(!nome||!email||!pass){toast("⚠️ Preencha todos os campos obrigatórios.");return;}
  if(pass.length<6){toast("⚠️ Senha mínimo 6 caracteres.");return;}
  let secondary=null;
  try{
    // Criação pela instância secundária preserva a sessão do administrador.
    secondary=firebase.initializeApp(firebase.app().options,"odjimAdminCreate");
    const secondaryAuth=secondary.auth();
    const cred=await secondaryAuth.createUserWithEmailAndPassword(email,pass);
    await cred.user.updateProfile({displayName:nome});
    const base={uid:cred.user.uid,nome,email,telefone:tel,especialidade:esp,role:"tecnico",ativo:true,disponibilidade:"disponivel",criadoEm:ODJIM.serverTimestamp(),atualizadoEm:ODJIM.serverTimestamp()};
    await ODJIM.userRef(cred.user.uid).set(base,{merge:true});
    await ODJIM.tecnicoRef(cred.user.uid).set(base,{merge:true});
    await ODJIM.audit("CRIAR_TECNICO","tecnico",cred.user.uid,{nome,email});
    await secondaryAuth.signOut();
    await secondary.delete();
    toast("✅ Técnico "+nome+" cadastrado com sucesso!");
    ["nt-nome","nt-email","nt-tel","nt-pass"].forEach(id=>document.getElementById(id).value="");
    carregarTecnicos();
  }catch(e){
    if(secondary){try{await secondary.delete();}catch(_){} }
    toast("❌ Erro ao cadastrar técnico: "+e.message);
  }
}

// ── CARREGAR TÉCNICOS ──
async function carregarTecnicos(){
  const el=document.getElementById("a-tecnicos");
  el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">A carregar...</div>';
  try{
    const snap=await db.collection("tecnicos").get();
    if(snap.empty){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico cadastrado.</div>';return;}
    let html="";
    snap.forEach(d=>{
      const t=d.data();
      if(!t.nome)return;
      html+=`<div class="tecnico-card">
        <div class="tecnico-avatar">${t.nome[0].toUpperCase()}</div>
        <div class="tecnico-info"><h4>${t.nome}</h4><p>${t.especialidade||""} · ${t.telefone||""}</p></div>
      </div>`;
    });
    el.innerHTML=html||'<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico encontrado.</div>';
  }catch(e){el.innerHTML='<div style="text-align:center;color:#f87171;padding:20px;">Erro: '+e.message+'</div>';}
}

// ── MONITORAR PEDIDOS (tempo real, todos dispositivos) ──
let pedidoUnsubscribers={};
function monitorarPedidos(elId){
  if(pedidoUnsubscribers[elId]) pedidoUnsubscribers[elId]();
  let q=db.collection("pedidos");
  const user=auth.currentUser;
  if(elId==="t-pedidos" && user) q=q.where("tecnicoUid","==",user.uid);
  else if(elId==="a-pedidos") q=q;
  pedidoUnsubscribers[elId]=q.onSnapshot(snap=>{
    const el=document.getElementById(elId); if(!el)return;
    if(snap.empty){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:30px;">Nenhum pedido no momento.</div>';return;}
    let html="";
    snap.forEach(d=>{
      const p=d.data();
      const statusMap={AGUARDANDO_TECNICO:"Aguardando técnico",TECNICO_ATRIBUIDO:"Técnico atribuído",A_CAMINHO:"A caminho",EM_EXECUCAO:"Em execução",CONCLUIDO:"Concluído",CANCELADO:"Cancelado"};
      const estado=statusMap[p.estado]||p.estado||"—";
      const sc=["AGUARDANDO_TECNICO"].includes(p.estado)||p.estado==="Aguardando técnico"?"s-aguardando":"s-caminho";
      const zap=(p.telefone||"").replace(/[^0-9]/g,"");
      let btn="";
      if(elId==="t-pedidos" && (p.estado==="AGUARDANDO_TECNICO"||p.estado==="Aguardando técnico")) btn=`<button onclick="aceitarPedido('${d.id}')" style="margin-top:8px;background:var(--accent);border:none;color:var(--bg);padding:11px;width:100%;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">✅ Aceitar Pedido</button>`;
      else if(elId==="t-pedidos" && zap) btn=`<a href="https://wa.me/244${zap}?text=Olá ${encodeURIComponent(p.nome||"")}! Estou a caminho para o seu pedido de ${encodeURIComponent(p.servico||"")}." target="_blank" style="display:block;text-align:center;background:#25D366;color:white;text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:13px;margin-top:8px;">💬 Contactar no WhatsApp</a>`;
      html+=`<div class="pedido-card"><div class="pedido-top"><span class="pedido-servico">${p.servico||"Serviço"}</span><span class="badge-status ${sc}">${estado}</span></div><div class="pedido-info"><p><strong>${esc(p.nome||"Cliente")}</strong> · ${p.telefone||""}</p><p>📍 ${p.local||""}</p>${p.descricao?`<p>📝 ${p.descricao}</p>`:""}${p.inicio?`<p>📅 ${p.inicio} → ${p.fim||""}</p>`:""}${p.tecnicoNome?`<p>🔧 ${p.tecnicoNome}</p>`:""}</div>${btn}</div>`;
    });
    el.innerHTML=html;
  },err=>{const el=document.getElementById(elId);if(el)el.innerHTML=`<div style="text-align:center;color:#f87171;padding:20px;">Erro: ${err.message}</div>`;});
}

async function aceitarPedido(id){
  try{
    const user=await ODJIM.requireRole("tecnico");
    const ref=ODJIM.pedidoRef(id);
    const snap=await ref.get();
    if(!snap.exists) throw new Error("Pedido não encontrado.");
    const p=snap.data();
    if(p.tecnicoUid && p.tecnicoUid!==user.uid) throw new Error("Este pedido já foi atribuído a outro técnico.");
    const tecnicoSnap=await ODJIM.tecnicoRef(user.uid).get();
    const tecnico=tecnicoSnap.exists?tecnicoSnap.data():{};
    await ref.update({tecnicoUid:user.uid,tecnicoNome:tecnico.nome||user.displayName||"Técnico",estado:"A_CAMINHO",atualizadoEm:ODJIM.serverTimestamp()});
    await ODJIM.notify(p.clienteUid,"PEDIDO_ATUALIZADO","Técnico atribuído","O técnico está a caminho do seu pedido.",id);
    await ODJIM.audit("ATRIBUIR_TECNICO","pedido",id,{estadoAnterior:p.estado,estadoNovo:"A_CAMINHO",tecnicoNovo:user.uid});
    toast("✅ Pedido aceite e atribuído a si.");
  }catch(e){toast("❌ "+e.message);}
}

// ── NOTIFICAÇÕES ──
async function ativarNotificacoes(){
  if(!auth.currentUser){toast("⚠️ Entre na sua conta primeiro.");return;}
  if(!messaging){toast("❌ Firebase Messaging não está disponível neste browser.");return;}
  if(!window.isSecureContext){toast("❌ Notificações requerem HTTPS (ou localhost).");return;}
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){toast("🔕 Notificações bloqueadas.");return;}
    // O token FCM web exige uma VAPID key pública configurada no Firebase Console.
    const vapid=window.ODJIM_VAPID_KEY||"";
    if(!vapid){toast("⚠️ Configure a VAPID Key do Firebase para ativar Push.",6000);return;}
    const token=await messaging.getToken({vapidKey:vapid,serviceWorkerRegistration:await navigator.serviceWorker.ready});
    await db.collection("dispositivos").doc(btoa(token).replace(/[^a-zA-Z0-9]/g,"").slice(0,120)).set({uid:auth.currentUser.uid,token,plataforma:"web",ativo:true,ultimoAcesso:ODJIM.serverTimestamp()},{merge:true});
    toast("🔔 Notificações push ativadas!");
  }catch(e){toast("❌ Erro nas notificações: "+e.message);}
}

// Define aqui apenas a chave pública VAPID fornecida no Firebase Console.
window.ODJIM_VAPID_KEY = window.ODJIM_VAPID_KEY || "";

// Estado de autenticação global: evita que uma conta autenticada fique perdida entre telas.
if(messaging){
  messaging.onMessage(payload=>{
    const n=payload.notification||{};
    toast("🔔 "+(n.title||"ODJIM GO")+" — "+(n.body||"Nova atualização."),6000);
  });
}

auth.onAuthStateChanged(async user=>{
  if(!user) return;
  try{
    const role=await ODJIM.getRole(user);
    if(role) document.body.dataset.role=role;
  }catch(e){console.warn("Perfil Firebase:",e);}
});

function atualizarStatusFirebase(){
  const el=document.getElementById("firebase-status");
  if(!el) return;
  el.textContent = (typeof firebase!=="undefined" && firebase.apps && firebase.apps.length)
    ? "🟢 Firebase conectado"
    : "🔴 Firebase indisponível";
}
document.addEventListener("DOMContentLoaded", atualizarStatusFirebase);

/* R16.23 — Firebase Storage: upload seguro de anexos de pedidos. */
window.ODJIM_STORAGE_MAX_BYTES = 10 * 1024 * 1024;
window.ODJIM_STORAGE_ALLOWED_TYPES = [
  "image/jpeg","image/png","image/webp","application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv"
];

window.ODJIM.uploadPedidoArquivo = async function(pedidoId, file){
  if(!firebase.auth().currentUser) throw new Error("Utilizador não autenticado.");
  if(!pedidoId || !file) throw new Error("Pedido e ficheiro são obrigatórios.");
  if(file.size > window.ODJIM_STORAGE_MAX_BYTES) throw new Error("Ficheiro excede 10 MB.");
  if(!window.ODJIM_STORAGE_ALLOWED_TYPES.includes(file.type)) throw new Error("Tipo de ficheiro não permitido.");
  const uid=firebase.auth().currentUser.uid;
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`pedidos/${pedidoId}/documentos/${uid}_${Date.now()}_${safeName}`;
  const ref=firebase.storage().ref(path);
  const snap=await ref.put(file,{contentType:file.type});
  const url=await snap.ref.getDownloadURL();
  const anexo={nome:file.name,tipo:file.type,tamanho:file.size,storagePath:path,url,enviadoPor:uid,criadoEm:firebase.firestore.FieldValue.serverTimestamp()};
  await firebase.firestore().collection("pedidos").doc(pedidoId).update({
    anexos:firebase.firestore.FieldValue.arrayUnion(anexo),
    atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
  });
  return anexo;
};
})();

