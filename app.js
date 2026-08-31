
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
// Manter sessão mesmo após fechar o browser
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e=>console.log(e));


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
  if(tela==="cliente"){initMap();carregarInfoEmpresa();carregarStatsReais();carregarServicosCliente();}
  if(tela==="tecnico")verificarTecnico();
  if(tela==="admin")verificarAdmin();
}

function voltar(){
  document.querySelectorAll(".tela").forEach(t=>t.classList.remove("ativa"));
  document.getElementById("splash").style.display="flex";
}

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

// ── CLIENTE ──
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
    if(e.code==="auth/user-not-found"||e.code==="auth/invalid-credential")toast("❌ Email ou senha incorretos.");
    else if(e.code==="auth/wrong-password")toast("❌ Senha incorreta.");
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
    await db.collection("clientes").doc(cred.user.uid).set({
      nome,email,telefone:tel,uid:cred.user.uid,criadoEm:new Date().toISOString()
    });
    document.getElementById("modal-cadastro").classList.remove("aberto");
    irPara("cliente");
    document.getElementById("badge-cliente").textContent=nome;
    toast("🎉 Bem-vindo, "+nome+"!");
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
    // Firebase envia sempre para não revelar se email existe
    toast("📧 Se o email existe, receberás um link de recuperação! Verifica também o Spam.");
  }catch(e){
    toast("📧 Se o email existe, receberás um link de recuperação! Verifica também o Spam.");
  }
}

async function logoutCliente(){await auth.signOut();voltar();toast("👋 Sessão terminada.");}

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

// ── PEDIDO ──
async function enviarPedido(){
  const nome=document.getElementById("c-nome").value.trim();
  const tel=document.getElementById("c-tel").value.trim();
  const local=document.getElementById("c-local").value.trim();
  if(!nome||!tel||!local){toast("⚠️ Preencha Nome, Telefone e Localização.");return;}
  try{
    await db.collection("pedidos").add({
      nome,telefone:tel,
      email:document.getElementById("c-email").value,
      local,servico:document.getElementById("c-servico").value,
      descricao:document.getElementById("c-desc").value,
      inicio:document.getElementById("c-inicio").value||"",
      fim:document.getElementById("c-fim").value||"",
      estado:"Aguardando técnico",
      clienteUid:auth.currentUser?auth.currentUser.uid:"",
      dataCriacao:new Date().toISOString()
    });
    toast("✅ Pedido enviado! Entraremos em contacto em breve.");
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
  if(!avaliacaoAtual){toast("⚠️ Selecione uma avaliação primeiro.");return;}
  try{
    await db.collection("avaliacoes").add({
      ...avaliacaoAtual,
      comentario:document.getElementById("av-comentario").value,
      data:new Date().toISOString()
    });
    const msgs={1:"Lamentamos! Vamos melhorar. 🙏",2:"Obrigado! Melhoraremos. 💪",3:"Obrigado! Continuamos a crescer. 🌱",4:"Fico feliz que gostou! 😊",5:"Uau! O seu apoio motiva-nos! 🚀"};
    document.getElementById("feedback-em").textContent=avaliacaoAtual.emoji;
    document.getElementById("feedback-msg").textContent=msgs[avaliacaoAtual.nota];
    document.getElementById("inq-comentario").style.display="none";
    document.getElementById("inq-feedback").style.display="block";
    document.getElementById("av-comentario").value="";
    avaliacaoAtual=null;
  }catch(e){toast("❌ Erro ao enviar avaliação: "+e.message);}
}

// ── INFO EMPRESA ──
function carregarInfoEmpresa(){
  db.collection("config").doc("empresa").get().then(doc=>{
    if(doc.exists){
      const d=doc.data();
      if(d.titulo)document.getElementById("info-titulo").textContent=d.titulo;
      if(d.descricao)document.getElementById("info-descricao").textContent=d.descricao;
      if(d.sobre)document.getElementById("info-sobre").textContent=d.sobre;
      if(d.stat1)document.getElementById("info-stat1").textContent=d.stat1;
    }
  }).catch(()=>{});
}

async function salvarInfo(){
  const titulo=document.getElementById("edit-titulo").value.trim();
  const descricao=document.getElementById("edit-descricao").value.trim();
  const sobre=document.getElementById("edit-sobre").value.trim();
  const stat1=document.getElementById("edit-stat1").value.trim();
  if(!titulo&&!descricao&&!sobre){toast("⚠️ Preencha pelo menos um campo.");return;}
  try{
    await db.collection("config").doc("empresa").set({titulo:titulo||"ODJIM Solution",descricao,sobre,stat1:stat1||"50+",atualizadoEm:new Date().toISOString()},{merge:true});
    toast("✅ Informações guardadas!");
    if(titulo)document.getElementById("info-titulo").textContent=titulo;
    if(descricao)document.getElementById("info-descricao").textContent=descricao;
    if(sobre)document.getElementById("info-sobre").textContent=sobre;
    if(stat1)document.getElementById("info-stat1").textContent=stat1;
  }catch(e){toast("❌ Erro ao guardar: "+e.message);}
}

// ── TÉCNICO ──
// Aguarda Firebase restaurar sessão
function aguardarAuth(){
  return new Promise(resolve=>{
    if(auth.currentUser){resolve(auth.currentUser);return;}
    const unsub=auth.onAuthStateChanged(user=>{unsub();resolve(user);});
  });
}

async function verificarTecnico(){
  const tecEmail=localStorage.getItem("odjim_tecnico_email");
  const tecPass=localStorage.getItem("odjim_tecnico_pass");
  if(tecEmail&&tecPass){
    try{
      const user=await aguardarAuth();
      if(user && user.email===tecEmail){
        mostrarPainelTecnico();
        return;
      } else {
        await auth.signInWithEmailAndPassword(tecEmail,tecPass);
        mostrarPainelTecnico();
        return;
      }
    }catch(e){
      localStorage.removeItem("odjim_tecnico_email");
      localStorage.removeItem("odjim_tecnico_pass");
    }
  }
  document.getElementById("tecnico-painel").style.display="none";
  document.getElementById("tecnico-login").style.display="block";
}

async function loginTecnico(){
  const email=document.getElementById("t-email").value.trim();
  const pass=document.getElementById("t-pass").value;
  if(!email||!pass){toast("⚠️ Preencha email e senha.");return;}
  try{
    // Tenta fazer login directamente
    await auth.signInWithEmailAndPassword(email,pass);
    // Verifica se é técnico no Firestore
    const snap=await db.collection("tecnicos").where("email","==",email).get();
    if(snap.empty){
      await auth.signOut();
      toast("❌ Não tem permissão de técnico. Contacte o administrador.");
      return;
    }
    localStorage.setItem("odjim_tecnico_email", email);
    localStorage.setItem("odjim_tecnico_pass", pass);
    mostrarPainelTecnico();
    toast("✅ Bem-vindo, Técnico!");
  }catch(e){
    if(e.code==="auth/user-not-found"||e.code==="auth/invalid-credential"){
      // Verificar se existe no Firestore e criar conta Auth
      try{
        const snap=await db.collection("tecnicos").where("email","==",email).get();
        if(snap.empty){toast("❌ Técnico não encontrado. Contacte o administrador.");return;}
        await auth.createUserWithEmailAndPassword(email,pass);
        mostrarPainelTecnico();
        toast("✅ Conta criada! Bem-vindo!");
      }catch(e2){
        if(e2.code==="auth/email-already-in-use"){
          toast("❌ Senha incorreta.");
        } else {
          toast("❌ Erro: "+e2.message);
        }
      }
    } else if(e.code==="auth/wrong-password"){
      toast("❌ Senha incorreta.");
    } else {
      toast("❌ Erro: "+e.message);
    }
  }
}

function mostrarPainelTecnico(){
  document.getElementById("tecnico-login").style.display="none";
  document.getElementById("tecnico-painel").style.display="block";
  monitorarPedidos("t-pedidos");
  notificarNovosPedidos();
}

async function logoutTecnico(){
  await auth.signOut();
  localStorage.removeItem("odjim_tecnico_email");
  localStorage.removeItem("odjim_tecnico_pass");
  document.getElementById("tecnico-painel").style.display="none";
  document.getElementById("tecnico-login").style.display="block";
  toast("👋 Sessão terminada.");
}

async function recuperarSenhaTecnico(){
  const email=document.getElementById("t-email").value.trim();
  if(!email){toast("⚠️ Escreva o email no campo acima primeiro.");return;}
  try{await auth.sendPasswordResetEmail(email);toast("📧 Email de recuperação enviado!");}
  catch(e){toast("❌ Erro: "+e.message);}
}

// ── ADMIN ──
async function verificarAdmin(){
  const adminEmail=localStorage.getItem("odjim_admin_email");
  const adminPass=localStorage.getItem("odjim_admin_pass");
  if(!adminEmail||!adminPass){
    document.getElementById("admin-login").style.display="block";
    document.getElementById("admin-painel").style.display="none";
    return;
  }
  try{
    // Re-autenticar automaticamente com credenciais guardadas
    const user=await aguardarAuth();
    if(user && user.email===adminEmail){
      mostrarPainelAdmin();
    } else {
      await auth.signInWithEmailAndPassword(adminEmail, adminPass);
      mostrarPainelAdmin();
    }
  }catch(e){
    localStorage.removeItem("odjim_admin_email");
    localStorage.removeItem("odjim_admin_pass");
    document.getElementById("admin-login").style.display="block";
    document.getElementById("admin-painel").style.display="none";
  }
}

async function loginAdmin(){
  const email=document.getElementById("a-email").value.trim();
  const pass=document.getElementById("a-pass").value;
  if(!email||!pass){toast("⚠️ Preencha email e senha.");return;}
  try{
    await auth.signInWithEmailAndPassword(email,pass);
    localStorage.setItem("odjim_admin_email",email);
    localStorage.setItem("odjim_admin_pass",pass);
    mostrarPainelAdmin();
    toast("✅ Bem-vindo, Admin!");
  }catch(e){
    if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")toast("❌ Senha incorreta.");
    else if(e.code==="auth/user-not-found")toast("❌ Email não encontrado.");
    else toast("❌ Erro: "+e.message);
  }
}

function mostrarPainelAdmin(){
  document.getElementById("admin-login").style.display="none";
  document.getElementById("admin-painel").style.display="block";
  monitorarPedidos("a-pedidos");
  carregarTecnicos();
  carregarDashboard();
  carregarServicosAdmin();
  db.collection("config").doc("empresa").get().then(doc=>{
    if(doc.exists){
      const d=doc.data();
      if(d.titulo)document.getElementById("edit-titulo").value=d.titulo;
      if(d.descricao)document.getElementById("edit-descricao").value=d.descricao;
      if(d.sobre)document.getElementById("edit-sobre").value=d.sobre;
      if(d.stat1)document.getElementById("edit-stat1").value=d.stat1;
    }
  }).catch(()=>{});
}

async function logoutAdmin(){
  await auth.signOut();
  localStorage.removeItem("odjim_admin_email");
  localStorage.removeItem("odjim_admin_pass");
  document.getElementById("admin-painel").style.display="none";
  document.getElementById("admin-login").style.display="block";
  toast("👋 Sessão terminada.");
}

async function recuperarSenhaAdmin(){
  const email=document.getElementById("a-email").value.trim();
  if(!email){toast("⚠️ Escreva o email no campo acima primeiro.");return;}
  try{await auth.sendPasswordResetEmail(email);toast("📧 Email de recuperação enviado!");}
  catch(e){toast("❌ Erro: "+e.message);}
}

function abrirTab(id,btn){
  ["tab-dashboard","tab-pedidos","tab-tecnicos","tab-cadastrar","tab-servicos","tab-info"].forEach(t=>{const el=document.getElementById(t);if(el)el.style.display="none";});
  document.getElementById(id).style.display="block";
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  if(id==="tab-tecnicos")carregarTecnicos();
  if(id==="tab-dashboard")carregarDashboard();
  if(id==="tab-servicos")carregarServicosAdmin();
}

// ── CADASTRAR TÉCNICO (sem criar conta Auth - evita logout do Admin) ──
async function cadastrarTecnico(){
  const nome=document.getElementById("nt-nome").value.trim();
  const email=document.getElementById("nt-email").value.trim();
  const tel=document.getElementById("nt-tel").value.trim();
  const esp=document.getElementById("nt-esp").value;
  const passEl=document.getElementById("nt-pass");
  const pass=passEl?passEl.value.trim():"";
  if(!nome||!email){toast("⚠️ Preencha Nome e Email.");return;}
  try{
    // Verificar duplicados com query
    const existe=await db.collection("tecnicos").where("email","==",email).get();
    if(!existe.empty){
      toast("⚠️ Técnico com este email já existe!");
      return;
    }
    // Guardar no Firestore (sem criar conta Auth para não fazer logout do Admin)
    const docRef=await db.collection("tecnicos").add({
      nome,email,telefone:tel,especialidade:esp,
      senha:pass,ativo:true,criadoEm:new Date().toISOString()
    });
    console.log("Técnico guardado com ID:", docRef.id);
    toast("✅ Técnico "+nome+" cadastrado com sucesso!");
    ["nt-nome","nt-email","nt-tel"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.value="";
    });
    if(passEl)passEl.value="";
  }catch(e){
    console.error("Erro cadastrar técnico:",e);
    toast("❌ Erro: "+e.message);
  }
}

// ── CARREGAR TÉCNICOS (tempo real com listener único) ──
let tecnicosListener=null;
function carregarTecnicos(){
  const el=document.getElementById("a-tecnicos");
  if(!el)return;
  el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">A carregar...</div>';
  // Cancelar listener anterior se existir
  if(tecnicosListener){tecnicosListener();tecnicosListener=null;}
  tecnicosListener=db.collection("tecnicos").onSnapshot(snap=>{
    if(snap.empty){
      el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico cadastrado.</div>';
      return;
    }
    let html="";
    snap.forEach(d=>{
      const t=d.data();
      const ini=t.nome?t.nome[0].toUpperCase():"T";
      html+=`<div class="tecnico-card">
        <div class="tecnico-avatar">${ini}</div>
        <div class="tecnico-info">
          <h4>${t.nome||"Sem nome"}</h4>
          <p>${t.especialidade||""} · ${t.telefone||""}</p>
          <p style="color:var(--muted);font-size:11px;">${t.email||""}</p>
        </div>
        <button onclick="removerTecnico('${d.id}')" style="margin-left:auto;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;flex-shrink:0;">🗑️</button>
      </div>`;
    });
    el.innerHTML=html;
  },e=>{el.innerHTML='<div style="text-align:center;color:#f87171;padding:20px;">Erro: '+e.message+'</div>';});
}

async function removerTecnico(id){
  if(!confirm("Tem a certeza que quer remover este técnico?"))return;
  try{
    await db.collection("tecnicos").doc(id).delete();
    toast("🗑️ Técnico removido com sucesso.");
  }catch(e){toast("❌ Erro: "+e.message);}
}

// ── MONITORAR PEDIDOS (tempo real) ──
function monitorarPedidos(elId){
  db.collection("pedidos").onSnapshot(snap=>{
    const el=document.getElementById(elId);
    if(!el)return;
    if(snap.empty){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:30px;">Nenhum pedido no momento.</div>';return;}
    const docs=[];
    snap.forEach(d=>docs.push({id:d.id,...d.data()}));
    docs.sort((a,b)=>new Date(b.dataCriacao||0)-new Date(a.dataCriacao||0));
    let html="";
    docs.forEach(p=>{
      const sc=p.estado==="Aguardando técnico"?"s-aguardando":"s-caminho";
      const zap=(p.telefone||"").replace(/[^0-9]/g,"");
      const btn=p.estado==="Aguardando técnico"
        ?`<button onclick="aceitarPedido('${p.id}')" style="margin-top:8px;background:var(--accent);border:none;color:var(--bg);padding:11px;width:100%;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">✅ Aceitar Pedido</button>`
        :`<a href="https://wa.me/244${zap}?text=Olá! Aceitei o seu pedido no ODJIM Solution." target="_blank" style="display:block;text-align:center;background:#25D366;color:white;text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:13px;margin-top:8px;">💬 Contactar no WhatsApp</a>`;
      html+=`<div class="pedido-card">
        <div class="pedido-top">
          <span class="pedido-servico">${p.servico||""}</span>
          <span class="badge-status ${sc}">${p.estado||""}</span>
        </div>
        <div class="pedido-info">
          <p><strong>${p.nome||""}</strong> · ${p.telefone||""}</p>
          <p>📍 ${p.local||""}</p>
          ${p.descricao?`<p>📝 ${p.descricao}</p>`:""}
          ${p.inicio?`<p>📅 ${p.inicio} → ${p.fim}</p>`:""}
        </div>
        ${btn}
      </div>`;
    });
    el.innerHTML=html;
  },err=>{
    const el=document.getElementById(elId);
    if(el)el.innerHTML=`<div style="text-align:center;color:#f87171;padding:20px;">Erro: ${err.message}</div>`;
  });
}

async function aceitarPedido(id){
  try{
    await db.collection("pedidos").doc(id).update({estado:"Técnico a caminho"});
    toast("✅ Pedido aceite com sucesso!");
  }catch(e){toast("❌ Erro ao aceitar pedido: "+e.message);}
}

const VAPID_KEY = "BJKg7cCzoji6MiA83LgN6kx0TUPXulMOxLb9kjWS_yz3ycMl_99ll9Gf2UHdPFS6TRimDUqGxKSNG1s2LVUABBw";

async function ativarNotificacoes(){
  if(!("Notification" in window)){toast("❌ Este browser não suporta notificações.");return;}
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){
      toast("🔕 Notificações bloqueadas. Ative nas definições do browser.");
      return;
    }
    // Registar Service Worker
    const reg=await navigator.serviceWorker.register("firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    // Obter token FCM
    const messaging=firebase.messaging();
    const token=await messaging.getToken({
      vapidKey:VAPID_KEY,
      serviceWorkerRegistration:reg
    });

    if(token){
      console.log("[FCM] Token:", token);
      // Guardar token no Firestore
      const user=auth.currentUser;
      await db.collection("tokens_fcm").doc(token.substring(0,20)).set({
        token,
        uid:user?user.uid:"anonimo",
        email:user?user.email:"",
        plataforma:"web",
        criadoEm:new Date().toISOString()
      });
      toast("🔔 Notificações ativadas com sucesso!");

      // Notificação em foreground
      messaging.onMessage(function(payload){
        const title=payload.notification?.title||"ODJIM Solution";
        const body=payload.notification?.body||"Nova actualização.";
        mostrarNotifForeground(title, body);
      });
    }
  }catch(e){
    console.error("[FCM] Erro:", e);
    toast("❌ Erro ao ativar notificações: "+e.message);
  }
}

function mostrarNotifForeground(titulo, mensagem){
  const div=document.createElement("div");
  div.style.cssText="position:fixed;top:20px;right:20px;z-index:9999;background:rgba(30,41,59,0.97);border:1px solid rgba(255,152,0,0.4);border-left:4px solid #ff9800;color:#f8fafc;padding:16px 20px;border-radius:12px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:'Outfit',sans-serif;cursor:pointer;animation:fadeUp 0.3s ease;";
  div.innerHTML=`<div style="font-weight:700;font-size:14px;margin-bottom:4px;">🔔 ${titulo}</div><div style="font-size:13px;color:#94a3b8;">${mensagem}</div>`;
  div.onclick=()=>div.remove();
  document.body.appendChild(div);
  setTimeout(()=>{if(div.parentNode)div.remove();},6000);
}

// Notificar técnicos quando há novo pedido
async function notificarNovosPedidos(){
  db.collection("pedidos").onSnapshot(async snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==="added"){
        const p=change.doc.data();
        // Notificação local para técnicos logados
        if(document.getElementById("tecnico-painel")?.style.display!=="none"){
          mostrarNotifForeground(
            "🔧 Novo Pedido!",
            `${p.nome} precisa de ${p.servico}`
          );
        }
      }
    });
  });
}

// ── PERFIL CLIENTE ──
function abrirPerfil(){
  const user = auth.currentUser;
  if(!user){
    toast("⚠️ Faça login como Cliente primeiro.");
    document.getElementById("modal-cadastro").classList.add("aberto");
    return;
  }
  const modal = document.getElementById("modal-perfil");
  if(!modal){toast("⚠️ Erro ao abrir perfil.");return;}
  modal.classList.add("aberto");
  // Carregar dados do perfil
  db.collection("clientes").doc(user.uid).get().then(doc=>{
    const nome = user.displayName || "";
    document.getElementById("perfil-avatar").textContent = nome ? nome[0].toUpperCase() : "?";
    document.getElementById("perfil-nome-display").textContent = nome || "Sem nome";
    document.getElementById("perfil-email-display").textContent = user.email || "";
    document.getElementById("perfil-nome").value = nome;
    if(doc.exists){
      const d = doc.data();
      if(d.telefone) document.getElementById("perfil-tel").value = d.telefone;
      if(d.morada) document.getElementById("perfil-morada").value = d.morada;
    }
  }).catch(()=>{});
}

function fecharPerfil(){
  document.getElementById("modal-perfil").classList.remove("aberto");
}

async function salvarPerfil(){
  const user = auth.currentUser;
  if(!user){toast("❌ Não autenticado.");return;}
  const nome = document.getElementById("perfil-nome").value.trim();
  const tel = document.getElementById("perfil-tel").value.trim();
  const morada = document.getElementById("perfil-morada").value.trim();
  try{
    if(nome) await user.updateProfile({displayName:nome});
    await db.collection("clientes").doc(user.uid).set({
      nome,telefone:tel,morada,email:user.email,uid:user.uid,
      atualizadoEm:new Date().toISOString()
    },{merge:true});
    document.getElementById("badge-cliente").textContent = nome || "Cliente";
    document.getElementById("perfil-avatar").textContent = nome ? nome[0].toUpperCase() : "?";
    document.getElementById("perfil-nome-display").textContent = nome;
    fecharPerfil();
    toast("✅ Perfil actualizado com sucesso!");
  }catch(e){toast("❌ Erro ao guardar perfil: "+e.message);}
}

// ── TOGGLE SERVIÇOS ──
function toggleServico(el){
  const aberto = el.classList.contains("aberto");
  document.querySelectorAll(".servico-detalhe").forEach(s=>s.classList.remove("aberto"));
  if(!aberto) el.classList.add("aberto");
}

// ── STATS REAIS DO FIRESTORE ──
function carregarStatsReais(){
  // Total de técnicos
  db.collection("tecnicos").onSnapshot(snap=>{
    const el = document.getElementById("info-stat1");
    if(el) el.textContent = snap.size + "+";
  });
  // Total de pedidos
  db.collection("pedidos").onSnapshot(snap=>{
    const el = document.getElementById("stat-pedidos");
    if(el) el.textContent = snap.size;
  });
  // Média de avaliações
  db.collection("avaliacoes").onSnapshot(snap=>{
    const el = document.getElementById("stat-avaliacao");
    if(!el) return;
    if(snap.empty){el.textContent = "N/A";return;}
    let total = 0;
    snap.forEach(d => total += (d.data().nota||0));
    el.textContent = (total/snap.size).toFixed(1) + "⭐";
  });
}

// ── DASHBOARD COM GRÁFICOS ──
function carregarDashboard(){
  // KPIs
  db.collection("tecnicos").onSnapshot(snap=>{
    const el=document.getElementById("dash-tecnicos");
    if(el)el.textContent=snap.size;
  });

  db.collection("pedidos").onSnapshot(snap=>{
    const total=snap.size;
    let pendentes=0, concluidos=0;
    const servicos={};

    snap.forEach(d=>{
      const p=d.data();
      if(p.estado==="Aguardando técnico")pendentes++;
      else concluidos++;
      const s=p.servico||"Outro";
      servicos[s]=(servicos[s]||0)+1;
    });

    const elT=document.getElementById("dash-pedidos");
    const elP=document.getElementById("dash-pendentes");
    if(elT)elT.textContent=total;
    if(elP)elP.textContent=pendentes;

    // Gráfico Pizza
    desenharPizza(pendentes, concluidos);

    // Gráfico Barras - Serviços
    desenharBarras(servicos);

    // Últimos pedidos
    const docs=[];
    snap.forEach(d=>docs.push({id:d.id,...d.data()}));
    docs.sort((a,b)=>new Date(b.dataCriacao||0)-new Date(a.dataCriacao||0));
    const el=document.getElementById("dash-ultimos-pedidos");
    if(!el)return;
    if(docs.length===0){el.textContent="Nenhum pedido ainda.";return;}
    let html="";
    docs.slice(0,5).forEach(p=>{
      const data=p.dataCriacao?new Date(p.dataCriacao).toLocaleDateString("pt-PT"):"";
      const cor=p.estado==="Aguardando técnico"?"#facc15":"#4ade80";
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text);">${p.nome||""}</div>
          <div style="font-size:11px;color:var(--muted);">${p.servico||""} · ${data}</div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${cor}22;color:${cor};">${p.estado||""}</span>
      </div>`;
    });
    el.innerHTML=html;
  });

  // Avaliações
  db.collection("avaliacoes").onSnapshot(snap=>{
    if(snap.empty){
      const el=document.getElementById("dash-avaliacoes");
      if(el)el.textContent="-";
      return;
    }
    let total=0;
    const dist={1:0,2:0,3:0,4:0,5:0};
    snap.forEach(d=>{
      const nota=d.data().nota||0;
      total+=nota;
      if(dist[nota]!==undefined)dist[nota]++;
    });
    const media=(total/snap.size).toFixed(1);
    const el=document.getElementById("dash-avaliacoes");
    if(el)el.textContent=media+"⭐";

    // Gráfico de barras das avaliações
    const el2=document.getElementById("grafico-avaliacoes");
    if(!el2)return;
    const emojis={1:"😡",2:"😕",3:"😐",4:"😊",5:"🤩"};
    const max=Math.max(...Object.values(dist))||1;
    let html="";
    [5,4,3,2,1].forEach(n=>{
      const pct=Math.round((dist[n]/max)*100);
      html+=`<div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;width:24px;">${emojis[n]}</span>
        <div style="flex:1;background:rgba(255,255,255,0.05);border-radius:20px;height:14px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(to right,var(--accent),var(--accent2));border-radius:20px;transition:width 1s ease;"></div>
        </div>
        <span style="font-size:12px;color:var(--muted);width:20px;text-align:right;">${dist[n]}</span>
      </div>`;
    });
    el2.innerHTML=html;
  });
}

function desenharPizza(pendentes, concluidos){
  const canvas=document.getElementById("grafico-pizza");
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const total=pendentes+concluidos;
  if(total===0){ctx.clearRect(0,0,140,140);return;}
  ctx.clearRect(0,0,140,140);
  const cx=70,cy=70,r=60;
  const angPend=(pendentes/total)*Math.PI*2;
  // Pendentes - amarelo
  ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+angPend);
  ctx.closePath();ctx.fillStyle="#facc15";ctx.fill();
  // Concluídos - verde
  ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,r,-Math.PI/2+angPend,-Math.PI/2+Math.PI*2);
  ctx.closePath();ctx.fillStyle="#4ade80";ctx.fill();
  // Centro branco
  ctx.beginPath();ctx.arc(cx,cy,35,0,Math.PI*2);
  ctx.fillStyle="#1e293b";ctx.fill();
  ctx.fillStyle="#f8fafc";ctx.font="bold 14px Outfit";
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(total,cx,cy);

  const leg=document.getElementById("legenda-pizza");
  if(leg)leg.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#facc15;border-radius:4px;"></div><span>Aguardando (${pendentes})</span></div>
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#4ade80;border-radius:4px;"></div><span>Concluídos (${concluidos})</span></div>`;
}

function desenharBarras(servicos){
  const canvas=document.getElementById("grafico-barras");
  if(!canvas)return;
  const entries=Object.entries(servicos).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(entries.length===0)return;
  const ctx=canvas.getContext("2d");
  const W=canvas.offsetWidth||300;
  canvas.width=W;canvas.height=200;
  ctx.clearRect(0,0,W,200);
  const max=Math.max(...entries.map(e=>e[1]))||1;
  const barW=Math.floor((W-60)/entries.length)-10;
  const cores=["#ff9800","#4ade80","#60a5fa","#c084fc","#fb923c"];
  entries.forEach(([nome,val],i)=>{
    const x=40+i*(barW+10);
    const h=Math.round((val/max)*140);
    const y=160-h;
    ctx.fillStyle=cores[i%cores.length];
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(x,y,barW,h,6):ctx.rect(x,y,barW,h);
    ctx.fill();
    ctx.fillStyle="#f8fafc";ctx.font="bold 13px Outfit";
    ctx.textAlign="center";ctx.fillText(val,x+barW/2,y-6);
    ctx.fillStyle="#94a3b8";ctx.font="10px Outfit";
    const nomeShort=nome.length>8?nome.substring(0,8)+"…":nome;
    ctx.fillText(nomeShort,x+barW/2,178);
  });
}

// ── GESTÃO DE SERVIÇOS ──
async function adicionarServico(){
  const nome=document.getElementById("srv-nome").value.trim();
  const emoji=document.getElementById("srv-emoji").value.trim();
  const desc=document.getElementById("srv-desc").value.trim();
  const preco=document.getElementById("srv-preco").value.trim();
  if(!nome||!emoji){toast("⚠️ Preencha o Nome e o Emoji.");return;}
  try{
    await db.collection("servicos").add({
      nome,emoji,descricao:desc,preco,
      ativo:true,criadoEm:new Date().toISOString()
    });
    toast("✅ Serviço "+nome+" adicionado!");
    ["srv-nome","srv-emoji","srv-desc","srv-preco"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.value="";
    });
    carregarServicosAdmin();
    carregarServicosCliente();
  }catch(e){toast("❌ Erro: "+e.message);}
}

async function removerServico(id){
  if(!confirm("Tem a certeza que quer remover este serviço?"))return;
  try{
    await db.collection("servicos").doc(id).delete();
    toast("🗑️ Serviço removido.");
    carregarServicosAdmin();
    carregarServicosCliente();
  }catch(e){toast("❌ Erro: "+e.message);}
}

function carregarServicosAdmin(){
  const el=document.getElementById("lista-servicos-admin");
  if(!el)return;
  el.innerHTML='<div style="text-align:center;color:var(--muted);padding:16px;">A carregar...</div>';
  db.collection("servicos").onSnapshot(snap=>{
    if(snap.empty){
      el.innerHTML='<div style="text-align:center;color:var(--muted);padding:16px;">Nenhum serviço adicionado ainda.</div>';
      return;
    }
    let html="";
    snap.forEach(d=>{
      const s=d.data();
      html+=`<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="font-size:26px;">${s.emoji||"🔧"}</span>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${s.nome||""}</div>
          <div style="font-size:12px;color:var(--muted);">${s.descricao||""}</div>
          <div style="font-size:12px;color:var(--accent);font-weight:600;">${s.preco||""}</div>
        </div>
        <button onclick="removerServico('${d.id}')" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🗑️</button>
      </div>`;
    });
    el.innerHTML=html;
  });
}

function carregarServicosCliente(){
  const el=document.getElementById("lista-servicos");
  if(!el)return;
  db.collection("servicos").onSnapshot(snap=>{
    if(snap.empty){
      // Mostrar serviços padrão se não há serviços no Firestore
      return;
    }
    let html="";
    snap.forEach(d=>{
      const s=d.data();
      html+=`<div class="servico-detalhe" onclick="toggleServico(this)">
        <div class="servico-header">
          <span>${s.emoji||"🔧"}</span>
          <span>${s.nome||""}</span>
          <span class="seta">›</span>
        </div>
        <div class="servico-body">
          ${s.descricao||"Serviço profissional disponível."}<br>
          ${s.preco?`<span style="color:var(--accent);font-weight:700;">${s.preco}</span>`:""}
        </div>
      </div>`;
    });
    el.innerHTML=html;
    // Actualizar select do formulário de pedido
    const select=document.getElementById("c-servico");
    if(select){
      select.innerHTML="";
      snap.forEach(d=>{
        const opt=document.createElement("option");
        opt.value=d.data().nome;
        opt.textContent=d.data().nome;
        select.appendChild(opt);
      });
    }
  });
}

// ── EXPORTAR CSV ──
async function exportarCSV(){
  try{
    toast("⏳ A gerar relatório CSV...");
    const snap=await db.collection("pedidos").get();
    if(snap.empty){toast("⚠️ Não há pedidos para exportar.");return;}

    const rows=[["Nome","Telefone","Email","Serviço","Local","Descrição","Estado","Data Início","Data Fim","Data Criação"]];
    snap.forEach(d=>{
      const p=d.data();
      rows.push([
        p.nome||"",
        p.telefone||"",
        p.email||"",
        p.servico||"",
        p.local||"",
        p.descricao||"",
        p.estado||"",
        p.inicio||"",
        p.fim||"",
        p.dataCriacao?new Date(p.dataCriacao).toLocaleString("pt-PT"):""
      ]);
    });

    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("
");
    const bom="﻿"; // BOM para Excel reconhecer UTF-8
    const blob=new Blob([bom+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`ODJIM_Relatorio_${new Date().toLocaleDateString("pt-PT").replace(/\//g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅ Relatório CSV exportado com sucesso!");
  }catch(e){toast("❌ Erro ao exportar: "+e.message);}
}

// ── EXPORTAR PDF ──
async function exportarPDF(){
  try{
    toast("⏳ A gerar relatório PDF...");
    const snap=await db.collection("pedidos").get();
    const snapTec=await db.collection("tecnicos").get();
    const snapAv=await db.collection("avaliacoes").get();

    let pendentes=0,concluidos=0;
    snap.forEach(d=>{if(d.data().estado==="Aguardando técnico")pendentes++;else concluidos++;});

    let totalAv=0;
    snapAv.forEach(d=>totalAv+=d.data().nota||0);
    const mediaAv=snapAv.size>0?(totalAv/snapAv.size).toFixed(1):"N/A";

    const data=new Date().toLocaleDateString("pt-PT");
    const hora=new Date().toLocaleTimeString("pt-PT");

    let linhasPedidos="";
    const docs=[];
    snap.forEach(d=>docs.push({...d.data()}));
    docs.sort((a,b)=>new Date(b.dataCriacao||0)-new Date(a.dataCriacao||0));
    docs.slice(0,20).forEach((p,i)=>{
      const cor=p.estado==="Aguardando técnico"?"#f59e0b":"#10b981";
      const dataPed=p.dataCriacao?new Date(p.dataCriacao).toLocaleDateString("pt-PT"):"";
      linhasPedidos+=`<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;">${i+1}</td>
        <td style="padding:8px 12px;font-weight:600;">${p.nome||""}</td>
        <td style="padding:8px 12px;">${p.telefone||""}</td>
        <td style="padding:8px 12px;">${p.servico||""}</td>
        <td style="padding:8px 12px;">${p.local||""}</td>
        <td style="padding:8px 12px;"><span style="background:${cor}22;color:${cor};padding:3px 8px;border-radius:20px;font-size:12px;font-weight:700;">${p.estado||""}</span></td>
        <td style="padding:8px 12px;">${dataPed}</td>
      </tr>`;
    });

    const html=`<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Relatório ODJIM Solution</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;color:#1f2937;background:#fff;}
  .header{background:linear-gradient(135deg,#ff9800,#ff5722);padding:30px 40px;color:white;}
  .header h1{margin:0;font-size:28px;font-weight:800;}
  .header p{margin:4px 0 0;opacity:0.9;font-size:14px;}
  .kpis{display:flex;gap:20px;padding:24px 40px;background:#f9fafb;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;}
  .kpi{flex:1;min-width:120px;background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .kpi .num{font-size:28px;font-weight:800;color:#ff9800;}
  .kpi .lab{font-size:12px;color:#6b7280;margin-top:4px;}
  .section{padding:24px 40px;}
  .section h2{font-size:18px;font-weight:700;margin-bottom:16px;color:#111827;border-left:4px solid #ff9800;padding-left:10px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{background:#f3f4f6;padding:10px 12px;text-align:left;font-weight:700;color:#374151;}
  tr:hover{background:#fafafa;}
  .footer{text-align:center;padding:20px;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;}
</style>
</head>
<body>
<div class="header">
  <h1>🇦🇴 ODJIM Solution</h1>
  <p>Relatório de Gestão — Gerado em ${data} às ${hora}</p>
</div>
<div class="kpis">
  <div class="kpi"><div class="num">${snap.size}</div><div class="lab">📋 Total Pedidos</div></div>
  <div class="kpi"><div class="num">${pendentes}</div><div class="lab">⏳ Aguardando</div></div>
  <div class="kpi"><div class="num">${concluidos}</div><div class="lab">✅ Concluídos</div></div>
  <div class="kpi"><div class="num">${snapTec.size}</div><div class="lab">👷 Técnicos</div></div>
  <div class="kpi"><div class="num">${mediaAv}⭐</div><div class="lab">Avaliação Média</div></div>
</div>
<div class="section">
  <h2>Lista de Pedidos (últimos 20)</h2>
  <table>
    <thead><tr><th>#</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Local</th><th>Estado</th><th>Data</th></tr></thead>
    <tbody>${linhasPedidos}</tbody>
  </table>
</div>
<div class="footer">ODJIM Solution • Luanda, Angola • ${data}</div>
</body>
</html>`;

    const blob=new Blob([html],{type:"text/html;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,"_blank");
    if(win){
      win.onload=()=>{
        win.print();
        URL.revokeObjectURL(url);
      };
    }
    toast("✅ PDF aberto! Usa Ctrl+P / Imprimir para guardar.");
  }catch(e){toast("❌ Erro ao gerar PDF: "+e.message);}
}
