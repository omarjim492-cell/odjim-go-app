// ODJIM Solution - app.js
// Versão limpa e corrigida

// ── SERVICE WORKER ──
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("firebase-messaging-sw.js").catch(e=>console.log(e));
}

// ── TOAST ──
function toast(msg,dur=4000){
  const t=document.getElementById("toast");
  if(!t)return;
  t.textContent=msg;t.style.display="block";
  setTimeout(()=>t.style.display="none",dur);
}

// ── AGUARDAR AUTH ──
function aguardarAuth(){
  return new Promise(resolve=>{
    if(auth.currentUser){resolve(auth.currentUser);return;}
    const unsub=auth.onAuthStateChanged(user=>{unsub();resolve(user);});
    setTimeout(()=>resolve(null),5000);
  });
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
    toast("❌ Email ou senha incorretos.");
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
    if(e.code==="auth/email-already-in-use")toast("❌ Email já registado. Use Entrar.");
    else toast("❌ Erro: "+e.message);
  }
}

async function recuperarSenhaCliente(){
  const email=document.getElementById("cl-email").value.trim();
  if(!email){toast("⚠️ Escreva o email primeiro.");return;}
  try{
    await auth.sendPasswordResetEmail(email);
    toast("📧 Email de recuperação enviado! Verifique o Spam.");
  }catch(e){toast("📧 Email de recuperação enviado! Verifique o Spam.");}
}

async function logoutCliente(){
  await auth.signOut();
  voltar();
  toast("👋 Sessão terminada.");
}

// ── PERFIL ──
function abrirPerfil(){
  const user=auth.currentUser;
  if(!user){
    document.getElementById("modal-cadastro").classList.add("aberto");
    return;
  }
  const modal=document.getElementById("modal-perfil");
  if(!modal){return;}
  modal.classList.add("aberto");
  const nome=user.displayName||"";
  document.getElementById("perfil-avatar").textContent=nome?nome[0].toUpperCase():"?";
  document.getElementById("perfil-nome-display").textContent=nome||"Sem nome";
  document.getElementById("perfil-email-display").textContent=user.email||"";
  document.getElementById("perfil-nome").value=nome;
  db.collection("clientes").doc(user.uid).get().then(doc=>{
    if(doc.exists){
      const d=doc.data();
      if(d.telefone)document.getElementById("perfil-tel").value=d.telefone;
      if(d.morada)document.getElementById("perfil-morada").value=d.morada;
    }
  }).catch(()=>{});
}

function fecharPerfil(){
  const modal=document.getElementById("modal-perfil");
  if(modal)modal.classList.remove("aberto");
}

async function salvarPerfil(){
  const user=auth.currentUser;
  if(!user){toast("❌ Não autenticado.");return;}
  const nome=document.getElementById("perfil-nome").value.trim();
  const tel=document.getElementById("perfil-tel").value.trim();
  const morada=document.getElementById("perfil-morada").value.trim();
  try{
    if(nome)await user.updateProfile({displayName:nome});
    await db.collection("clientes").doc(user.uid).set({nome,telefone:tel,morada,email:user.email,uid:user.uid,atualizadoEm:new Date().toISOString()},{merge:true});
    document.getElementById("badge-cliente").textContent=nome||"Cliente";
    fecharPerfil();
    toast("✅ Perfil actualizado!");
  }catch(e){toast("❌ Erro: "+e.message);}
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
      document.getElementById("c-local").value="Lat: "+lat+", Lon: "+lng;
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
  }catch(e){toast("❌ Erro: "+e.message);}
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
  if(!avaliacaoAtual){toast("⚠️ Selecione primeiro.");return;}
  try{
    await db.collection("avaliacoes").add({...avaliacaoAtual,comentario:document.getElementById("av-comentario").value,data:new Date().toISOString()});
    const msgs={1:"Lamentamos! Vamos melhorar. 🙏",2:"Obrigado! Melhoraremos. 💪",3:"Obrigado! Continuamos. 🌱",4:"Fico feliz! 😊",5:"Uau! Motiva-nos! 🚀"};
    document.getElementById("feedback-em").textContent=avaliacaoAtual.emoji;
    document.getElementById("feedback-msg").textContent=msgs[avaliacaoAtual.nota];
    document.getElementById("inq-comentario").style.display="none";
    document.getElementById("inq-feedback").style.display="block";
    document.getElementById("av-comentario").value="";
    avaliacaoAtual=null;
  }catch(e){toast("❌ Erro: "+e.message);}
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
  }catch(e){toast("❌ Erro: "+e.message);}
}

// ── STATS REAIS ──
function carregarStatsReais(){
  db.collection("tecnicos").onSnapshot(snap=>{
    const el=document.getElementById("info-stat1");
    if(el)el.textContent=snap.size+"+";
  },()=>{});
  db.collection("pedidos").onSnapshot(snap=>{
    const el=document.getElementById("stat-pedidos");
    if(el)el.textContent=snap.size;
  },()=>{});
  db.collection("avaliacoes").onSnapshot(snap=>{
    const el=document.getElementById("stat-avaliacao");
    if(!el)return;
    if(snap.empty){el.textContent="N/A";return;}
    let total=0;
    snap.forEach(d=>total+=(d.data().nota||0));
    el.textContent=(total/snap.size).toFixed(1)+"⭐";
  },()=>{});
}

// ── SERVIÇOS ──
function toggleServico(el){
  const aberto=el.classList.contains("aberto");
  document.querySelectorAll(".servico-detalhe").forEach(s=>s.classList.remove("aberto"));
  if(!aberto)el.classList.add("aberto");
}

function carregarServicosCliente(){
  const el=document.getElementById("lista-servicos");
  if(!el)return;
  db.collection("servicos").onSnapshot(snap=>{
    if(snap.empty)return;
    let html="";
    snap.forEach(d=>{
      const s=d.data();
      html+='<div class="servico-detalhe" onclick="toggleServico(this)"><div class="servico-header"><span>'+s.emoji+'</span><span>'+s.nome+'</span><span class="seta">›</span></div><div class="servico-body">'+s.descricao+'<br>'+(s.preco?'<span style="color:var(--accent);font-weight:700;">'+s.preco+'</span>':'')+'</div></div>';
    });
    el.innerHTML=html;
    const select=document.getElementById("c-servico");
    if(select){
      select.innerHTML="";
      snap.forEach(d=>{
        const opt=document.createElement("option");
        opt.value=d.data().nome;opt.textContent=d.data().nome;
        select.appendChild(opt);
      });
    }
  },()=>{});
}

// ── TÉCNICO ──
async function verificarTecnico(){
  const tecEmail=localStorage.getItem("odjim_tecnico_email");
  const tecPass=localStorage.getItem("odjim_tecnico_pass");
  if(tecEmail&&tecPass){
    try{
      const user=await aguardarAuth();
      if(user&&user.email===tecEmail){mostrarPainelTecnico();return;}
      await auth.signInWithEmailAndPassword(tecEmail,tecPass);
      mostrarPainelTecnico();return;
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
    await auth.signInWithEmailAndPassword(email,pass);
    const snap=await db.collection("tecnicos").where("email","==",email).get();
    if(snap.empty){await auth.signOut();toast("❌ Não tem acesso de técnico.");return;}
    localStorage.setItem("odjim_tecnico_email",email);
    localStorage.setItem("odjim_tecnico_pass",pass);
    mostrarPainelTecnico();
    toast("✅ Bem-vindo, Técnico!");
  }catch(e){
    if(e.code==="auth/user-not-found"||e.code==="auth/invalid-credential"){
      try{
        const snap=await db.collection("tecnicos").where("email","==",email).get();
        if(snap.empty){toast("❌ Técnico não encontrado. Contacte o administrador.");return;}
        await auth.createUserWithEmailAndPassword(email,pass);
        localStorage.setItem("odjim_tecnico_email",email);
        localStorage.setItem("odjim_tecnico_pass",pass);
        mostrarPainelTecnico();
        toast("✅ Conta criada! Bem-vindo!");
      }catch(e2){toast("❌ Erro: "+e2.message);}
    }else if(e.code==="auth/wrong-password"){
      toast("❌ Senha incorreta.");
    }else{toast("❌ Erro: "+e.message);}
  }
}

function mostrarPainelTecnico(){
  document.getElementById("tecnico-login").style.display="none";
  document.getElementById("tecnico-painel").style.display="block";
  monitorarPedidos("t-pedidos");
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
  if(!email){toast("⚠️ Escreva o email primeiro.");return;}
  try{await auth.sendPasswordResetEmail(email);toast("📧 Email enviado! Verifique o Spam.");}
  catch(e){toast("📧 Email enviado! Verifique o Spam.");}
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
    const user=await aguardarAuth();
    if(user&&user.email===adminEmail){
      mostrarPainelAdmin();
    }else{
      await auth.signInWithEmailAndPassword(adminEmail,adminPass);
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
    else if(e.code==="auth/network-request-failed")toast("❌ Sem ligação à internet. Verifica a rede.");
    else toast("❌ Erro: "+e.message);
  }
}

function mostrarPainelAdmin(){
  document.getElementById("admin-login").style.display="none";
  document.getElementById("admin-painel").style.display="block";
  monitorarPedidos("a-pedidos");
  carregarTecnicos();
  carregarDashboard();
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
  if(!email){toast("⚠️ Escreva o email primeiro.");return;}
  try{await auth.sendPasswordResetEmail(email);toast("📧 Email enviado! Verifique o Spam.");}
  catch(e){toast("📧 Email enviado! Verifique o Spam.");}
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

// ── TÉCNICOS ADMIN ──
let tecnicosListener=null;
function carregarTecnicos(){
  const el=document.getElementById("a-tecnicos");
  if(!el)return;
  el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">A carregar...</div>';
  if(tecnicosListener){tecnicosListener();tecnicosListener=null;}
  tecnicosListener=db.collection("tecnicos").onSnapshot(snap=>{
    if(snap.empty){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico cadastrado.</div>';return;}
    let html="";
    snap.forEach(d=>{
      const t=d.data();
      const ini=t.nome?t.nome[0].toUpperCase():"T";
      html+='<div class="tecnico-card"><div class="tecnico-avatar">'+ini+'</div><div class="tecnico-info"><h4>'+t.nome+'</h4><p>'+t.especialidade+' · '+t.telefone+'</p><p style="color:var(--muted);font-size:11px;">'+t.email+'</p></div><button onclick="removerTecnico(\''+d.id+'\')" style="margin-left:auto;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🗑️</button></div>';
    });
    el.innerHTML=html;
  },e=>{el.innerHTML='<div style="text-align:center;color:#f87171;padding:20px;">Erro: '+e.message+'</div>';});
}

async function removerTecnico(id){
  if(!confirm("Remover este técnico?"))return;
  try{await db.collection("tecnicos").doc(id).delete();toast("🗑️ Técnico removido.");}
  catch(e){toast("❌ Erro: "+e.message);}
}

async function cadastrarTecnico(){
  const nome=document.getElementById("nt-nome").value.trim();
  const email=document.getElementById("nt-email").value.trim();
  const tel=document.getElementById("nt-tel").value.trim();
  const esp=document.getElementById("nt-esp").value;
  const passEl=document.getElementById("nt-pass");
  const pass=passEl?passEl.value.trim():"";
  if(!nome||!email){toast("⚠️ Preencha Nome e Email.");return;}
  try{
    const existe=await db.collection("tecnicos").where("email","==",email).get();
    if(!existe.empty){toast("⚠️ Técnico com este email já existe!");return;}
    await db.collection("tecnicos").add({nome,email,telefone:tel,especialidade:esp,senha:pass,ativo:true,criadoEm:new Date().toISOString()});
    toast("✅ Técnico "+nome+" cadastrado!");
    ["nt-nome","nt-email","nt-tel"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
    if(passEl)passEl.value="";
  }catch(e){toast("❌ Erro: "+e.message);}
}

// ── SERVIÇOS ADMIN ──
async function adicionarServico(){
  const nome=document.getElementById("srv-nome").value.trim();
  const emoji=document.getElementById("srv-emoji").value.trim();
  const desc=document.getElementById("srv-desc").value.trim();
  const preco=document.getElementById("srv-preco").value.trim();
  if(!nome||!emoji){toast("⚠️ Preencha Nome e Emoji.");return;}
  try{
    const existe=await db.collection("servicos").where("nome","==",nome).get();
    if(!existe.empty){toast("⚠️ Serviço já existe!");return;}
    await db.collection("servicos").add({nome,emoji,descricao:desc,preco,ativo:true,criadoEm:new Date().toISOString()});
    toast("✅ Serviço "+nome+" adicionado!");
    ["srv-nome","srv-emoji","srv-desc","srv-preco"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  }catch(e){toast("❌ Erro: "+e.message);}
}

async function removerServico(id){
  if(!confirm("Remover este serviço?"))return;
  try{await db.collection("servicos").doc(id).delete();toast("🗑️ Serviço removido.");}
  catch(e){toast("❌ Erro: "+e.message);}
}

function carregarServicosAdmin(){
  const el=document.getElementById("lista-servicos-admin");
  if(!el)return;
  el.innerHTML='<div style="text-align:center;color:var(--muted);padding:16px;">A carregar...</div>';
  db.collection("servicos").onSnapshot(snap=>{
    if(snap.empty){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:16px;">Nenhum serviço adicionado.</div>';return;}
    let html="";
    snap.forEach(d=>{
      const s=d.data();
      html+='<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px;"><span style="font-size:26px;">'+s.emoji+'</span><div style="flex:1;"><div style="font-weight:700;font-size:14px;">'+s.nome+'</div><div style="font-size:12px;color:var(--muted);">'+s.descricao+'</div><div style="font-size:12px;color:var(--accent);font-weight:600;">'+s.preco+'</div></div><button onclick="removerServico(\''+d.id+'\')" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🗑️</button></div>';
    });
    el.innerHTML=html;
  },()=>{});
}

// ── PEDIDOS ──
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
        ?'<button onclick="aceitarPedido(\''+p.id+'\')" style="margin-top:8px;background:var(--accent);border:none;color:var(--bg);padding:11px;width:100%;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">✅ Aceitar Pedido</button>'
        :'<a href="https://wa.me/244'+zap+'?text=Olá! Aceitei o seu pedido no ODJIM Solution." target="_blank" style="display:block;text-align:center;background:#25D366;color:white;text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:13px;margin-top:8px;">💬 WhatsApp</a>';
      html+='<div class="pedido-card"><div class="pedido-top"><span class="pedido-servico">'+(p.servico||"")+'</span><span class="badge-status '+sc+'">'+(p.estado||"")+'</span></div><div class="pedido-info"><p><strong>'+(p.nome||"")+'</strong> · '+(p.telefone||"")+'</p><p>📍 '+(p.local||"")+'</p>'+(p.descricao?'<p>📝 '+p.descricao+'</p>':'")+(p.inicio?'<p>📅 '+p.inicio+' → '+p.fim+'</p>':'")+'</div>'+btn+'</div>';
    });
    el.innerHTML=html;
  },err=>{const el=document.getElementById(elId);if(el)el.innerHTML='<div style="text-align:center;color:#f87171;padding:20px;">Erro: '+err.message+'</div>';});
}

async function aceitarPedido(id){
  try{await db.collection("pedidos").doc(id).update({estado:"Técnico a caminho"});toast("✅ Pedido aceite!");}
  catch(e){toast("❌ Erro: "+e.message);}
}

// ── DASHBOARD ──
function carregarDashboard(){
  db.collection("tecnicos").onSnapshot(snap=>{const el=document.getElementById("dash-tecnicos");if(el)el.textContent=snap.size;},()=>{});
  db.collection("pedidos").onSnapshot(snap=>{
    let pendentes=0,concluidos=0;const servicos={};
    snap.forEach(d=>{
      const p=d.data();
      if(p.estado==="Aguardando técnico")pendentes++;else concluidos++;
      const s=p.servico||"Outro";servicos[s]=(servicos[s]||0)+1;
    });
    const elT=document.getElementById("dash-pedidos");const elP=document.getElementById("dash-pendentes");
    if(elT)elT.textContent=snap.size;if(elP)elP.textContent=pendentes;
    desenharPizza(pendentes,concluidos);
    desenharBarras(servicos);
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
      html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><div><div style="font-weight:700;font-size:13px;color:var(--text);">'+(p.nome||"")+'</div><div style="font-size:11px;color:var(--muted);">'+(p.servico||"")+" · "+data+'</div></div><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:'+cor+'22;color:'+cor+';">'+(p.estado||"")+'</span></div>';
    });
    el.innerHTML=html;
  },()=>{});
  db.collection("avaliacoes").onSnapshot(snap=>{
    if(snap.empty){const el=document.getElementById("dash-avaliacoes");if(el)el.textContent="-";return;}
    let total=0;const dist={1:0,2:0,3:0,4:0,5:0};
    snap.forEach(d=>{const nota=d.data().nota||0;total+=nota;if(dist[nota]!==undefined)dist[nota]++;});
    const media=(total/snap.size).toFixed(1);
    const el=document.getElementById("dash-avaliacoes");if(el)el.textContent=media+"⭐";
    const el2=document.getElementById("grafico-avaliacoes");
    if(!el2)return;
    const emojis={1:"😡",2:"😕",3:"😐",4:"😊",5:"🤩"};
    const max=Math.max(...Object.values(dist))||1;
    let html="";
    [5,4,3,2,1].forEach(n=>{
      const pct=Math.round((dist[n]/max)*100);
      html+='<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;width:24px;">'+emojis[n]+'</span><div style="flex:1;background:rgba(255,255,255,0.05);border-radius:20px;height:14px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:linear-gradient(to right,var(--accent),var(--accent2));border-radius:20px;"></div></div><span style="font-size:12px;color:var(--muted);width:20px;text-align:right;">'+dist[n]+'</span></div>';
    });
    el2.innerHTML=html;
  },()=>{});
}

function desenharPizza(pendentes,concluidos){
  const canvas=document.getElementById("grafico-pizza");
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const total=pendentes+concluidos;
  ctx.clearRect(0,0,140,140);
  if(total===0){
    ctx.beginPath();ctx.arc(70,70,60,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,0.05)";ctx.fill();
    return;
  }
  const angPend=(pendentes/total)*Math.PI*2;
  ctx.beginPath();ctx.moveTo(70,70);ctx.arc(70,70,60,-Math.PI/2,-Math.PI/2+angPend);ctx.closePath();ctx.fillStyle="#facc15";ctx.fill();
  ctx.beginPath();ctx.moveTo(70,70);ctx.arc(70,70,60,-Math.PI/2+angPend,-Math.PI/2+Math.PI*2);ctx.closePath();ctx.fillStyle="#4ade80";ctx.fill();
  ctx.beginPath();ctx.arc(70,70,35,0,Math.PI*2);ctx.fillStyle="#1e293b";ctx.fill();
  ctx.fillStyle="#f8fafc";ctx.font="bold 14px Outfit";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(total,70,70);
  const leg=document.getElementById("legenda-pizza");
  if(leg)leg.innerHTML='<div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#facc15;border-radius:4px;"></div><span>Aguardando ('+pendentes+')</span></div><div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#4ade80;border-radius:4px;"></div><span>Concluídos ('+concluidos+')</span></div>';
}

function desenharBarras(servicos){
  const canvas=document.getElementById("grafico-barras");
  if(!canvas)return;
  const entries=Object.entries(servicos).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(entries.length===0)return;
  const ctx=canvas.getContext("2d");
  const W=canvas.parentElement?canvas.parentElement.offsetWidth-32:300;
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
    ctx.beginPath();ctx.rect(x,y,barW,h);ctx.fill();
    ctx.fillStyle="#f8fafc";ctx.font="bold 13px Outfit";ctx.textAlign="center";ctx.fillText(val,x+barW/2,y-6);
    ctx.fillStyle="#94a3b8";ctx.font="10px Outfit";
    const nomeShort=nome.length>8?nome.substring(0,8)+"…":nome;
    ctx.fillText(nomeShort,x+barW/2,178);
  });
}

// ── RELATÓRIOS ──
async function exportarCSV(){
  try{
    toast("⏳ A gerar CSV...");
    const snap=await db.collection("pedidos").get();
    if(snap.empty){toast("⚠️ Não há pedidos.");return;}
    const rows=[["Nome","Telefone","Email","Serviço","Local","Descrição","Estado","Data Início","Data Fim","Data Criação"]];
    snap.forEach(d=>{
      const p=d.data();
      rows.push([p.nome||"",p.telefone||"",p.email||"",p.servico||"",p.local||"",p.descricao||"",p.estado||"",p.inicio||"",p.fim||"",p.dataCriacao?new Date(p.dataCriacao).toLocaleString("pt-PT"):""]);
    });
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="ODJIM_"+new Date().toLocaleDateString("pt-PT").replace(/\//g,"-")+".csv";
    a.click();URL.revokeObjectURL(url);
    toast("✅ CSV exportado!");
  }catch(e){toast("❌ Erro: "+e.message);}
}

async function exportarPDF(){
  try{
    toast("⏳ A gerar PDF...");
    const snap=await db.collection("pedidos").get();
    let pendentes=0,concluidos=0;
    snap.forEach(d=>{if(d.data().estado==="Aguardando técnico")pendentes++;else concluidos++;});
    const data=new Date().toLocaleDateString("pt-PT");
    let linhas="";
    const docs=[];snap.forEach(d=>docs.push(d.data()));
    docs.sort((a,b)=>new Date(b.dataCriacao||0)-new Date(a.dataCriacao||0));
    docs.slice(0,20).forEach((p,i)=>{
      const cor=p.estado==="Aguardando técnico"?"#f59e0b":"#10b981";
      const dataPed=p.dataCriacao?new Date(p.dataCriacao).toLocaleDateString("pt-PT"):"";
      linhas+="<tr><td>"+(i+1)+"</td><td>"+(p.nome||"")+"</td><td>"+(p.telefone||"")+"</td><td>"+(p.servico||"")+"</td><td><span style='background:"+cor+"22;color:"+cor+";padding:2px 8px;border-radius:10px;font-size:11px;'>"+(p.estado||"")+"</span></td><td>"+dataPed+"</td></tr>";
    });
    const html="<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Relatório ODJIM</title><style>body{font-family:sans-serif;margin:0;padding:0;}header{background:linear-gradient(135deg,#ff9800,#ff5722);padding:24px 32px;color:white;}h1{margin:0;font-size:24px;}p{margin:4px 0 0;opacity:.9;font-size:13px;}.kpis{display:flex;gap:16px;padding:20px 32px;background:#f9fafb;}.kpi{background:white;border-radius:10px;padding:14px 20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}.kpi .n{font-size:24px;font-weight:800;color:#ff9800;}.kpi .l{font-size:11px;color:#6b7280;}.section{padding:20px 32px;}h2{font-size:16px;font-weight:700;border-left:4px solid #ff9800;padding-left:8px;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#f3f4f6;padding:8px;text-align:left;}td{padding:8px;border-bottom:1px solid #e5e7eb;}footer{text-align:center;padding:16px;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;}</style></head><body><header><h1>🇦🇴 ODJIM Solution</h1><p>Relatório gerado em "+data+"</p></header><div class='kpis'><div class='kpi'><div class='n'>"+snap.size+"</div><div class='l'>Total Pedidos</div></div><div class='kpi'><div class='n'>"+pendentes+"</div><div class='l'>Aguardando</div></div><div class='kpi'><div class='n'>"+concluidos+"</div><div class='l'>Concluídos</div></div></div><div class='section'><h2>Últimos 20 Pedidos</h2><table><thead><tr><th>#</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Estado</th><th>Data</th></tr></thead><tbody>"+linhas+"</tbody></table></div><footer>ODJIM Solution • Luanda, Angola • "+data+"</footer></body></html>";
    const blob=new Blob([html],{type:"text/html;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,"_blank");
    if(win){win.onload=()=>{win.print();URL.revokeObjectURL(url);};}
    toast("✅ PDF aberto! Usa Imprimir para guardar.");
  }catch(e){toast("❌ Erro: "+e.message);}
}

// ── NOTIFICAÇÕES ──
const VAPID_KEY="BJKg7cCzoji6MiA83LgN6kx0TUPXulMOxLb9kjWS_yz3ycMl_99ll9Gf2UHdPFS6TRimDUqGxKSNG1s2LVUABBw";

async function ativarNotificacoes(){
  if(!("Notification" in window)){toast("❌ Browser não suporta notificações.");return;}
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){toast("🔕 Notificações bloqueadas.");return;}
    const reg=await navigator.serviceWorker.register("firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    const messaging=firebase.messaging();
    const token=await messaging.getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
    if(token){
      const user=auth.currentUser;
      await db.collection("tokens_fcm").doc(token.substring(0,20)).set({token,uid:user?user.uid:"",email:user?user.email:"",plataforma:"web",criadoEm:new Date().toISOString()});
      toast("🔔 Notificações ativadas!");
      messaging.onMessage(payload=>{
        const title=payload.notification&&payload.notification.title?payload.notification.title:"ODJIM Solution";
        const body=payload.notification&&payload.notification.body?payload.notification.body:"Nova actualização.";
        mostrarNotifForeground(title,body);
      });
    }
  }catch(e){toast("❌ Erro: "+e.message);}
}

function mostrarNotifForeground(titulo,mensagem){
  const div=document.createElement("div");
  div.style.cssText="position:fixed;top:20px;right:20px;z-index:9999;background:rgba(30,41,59,.97);border-left:4px solid #ff9800;color:#f8fafc;padding:16px 20px;border-radius:12px;max-width:300px;cursor:pointer;";
  div.innerHTML="<div style='font-weight:700;font-size:14px;margin-bottom:4px;'>🔔 "+titulo+"</div><div style='font-size:13px;color:#94a3b8;'>"+mensagem+"</div>";
  div.onclick=()=>div.remove();
  document.body.appendChild(div);
  setTimeout(()=>{if(div.parentNode)div.remove();},6000);
}
