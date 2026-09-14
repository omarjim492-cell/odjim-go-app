// ODJIM Solution - app.js
// Versão Final Corrigida e Estável

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
    
    if(document.getElementById("c-nome")) document.getElementById("c-nome").value = user.displayName || "";
    if(document.getElementById("c-email")) document.getElementById("c-email").value = user.email || "";
    
    db.collection("clientes").doc(user.uid).get().then(doc => {
      if(doc.exists && doc.data().telefone){
        if(document.getElementById("c-tel")) document.getElementById("c-tel").value = doc.data().telefone;
      }
    }).catch(()=>{});

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
  const user = auth.currentUser;
  const btnEnviar = document.querySelector("#tela-cliente button[onclick='enviarPedido()']");

  let nome = document.getElementById("c-nome").value.trim();
  let tel = document.getElementById("c-tel").value.trim();
  let email = document.getElementById("c-email").value.trim();
  const local = document.getElementById("c-local").value.trim();
  const servico = document.getElementById("c-servico").value;
  const desc = document.getElementById("c-desc").value.trim();

  if (user) {
    if (!nome) nome = user.displayName || "Cliente Registado";
    if (!email) email = user.email || "";
  }

  if (!nome || !tel || !local) {
    toast("⚠️ Preencha Nome, Telefone e Localização.");
    return;
  }

  try {
    if(btnEnviar){ btnEnviar.disabled = true; btnEnviar.textContent = "⏳ A enviar..."; }

    // Evita duplicados em aberto com o mesmo telefone e serviço
    const recentCheck = await db.collection("pedidos")
      .where("telefone", "==", tel)
      .where("servico", "==", servico)
      .where("estado", "==", "Aguardando técnico")
      .get();

    if(!recentCheck.empty){
      toast("⚠️ Já tem um pedido idêntico aguardando atendimento.");
      if(btnEnviar){ btnEnviar.disabled = false; btnEnviar.textContent = "🚀 Enviar Pedido"; }
      return;
    }

    const docRef = await db.collection("pedidos").add({
      nome: nome,
      telefone: tel,
      email: email,
      local: local,
      servico: servico,
      descricao: desc,
      inicio: document.getElementById("c-inicio") ? document.getElementById("c-inicio").value : "",
      fim: document.getElementById("c-fim") ? document.getElementById("c-fim").value : "",
      estado: "Aguardando técnico",
      clienteUid: user ? user.uid : "",
      dataCriacao: new Date().toISOString()
    });

    toast("🎉 Pedido efetuado! Código: " + docRef.id.substring(0,6));

    const mensagemZap = 
`*--- ODJIM SOLUTION | NOVO PEDIDO ---*

👤 *Cliente:* ${nome}
📞 *Contacto:* ${tel}
📍 *Local:* ${local}
🛠️ *Serviço:* ${servico}
📝 *Detalhes:* ${desc || "Sem observações adicionais"}
🆔 *Ref:* ${docRef.id}

---
_Solicitação registada via Plataforma ODJIM GO_`;

    const numeroEmpresa = "244900000000";
    const urlZap = `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(mensagemZap)}`;
    window.open(urlZap, "_blank");

    ["c-nome","c-tel","c-email","c-local","c-desc","c-inicio","c-fim"].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = "";
    });
    if(marker && map){ map.removeLayer(marker); marker = null; }

  } catch(e) {
    toast("❌ Erro ao submeter pedido: " + e.message);
  } finally {
    if(btnEnviar){ btnEnviar.disabled = false; btnEnviar.textContent = "🚀 Enviar Pedido"; }
  }
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
  
  if (window.pedidosTecnicoListener) window.pedidosTecnicoListener();
  
  window.pedidosTecnicoListener = db.collection("pedidos")
    .onSnapshot(snap => {
      const el = document.getElementById("t-pedidos");
      if(!el) return;
      if(snap.empty){
        el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;">Nenhum pedido no momento.</div>';
        return;
      }
      
      let html = "";
      snap.forEach(d => {
        const p = d.data();
        const sc = p.estado === "Aguardando técnico" ? "s-aguardando" : "s-caminho";
        const zap = (p.telefone || "").replace(/[^0-9]/g, "");
        
        const btn = p.estado === "Aguardando técnico"
          ? `<button onclick="aceitarPedido('${d.id}')" style="margin-top:8px;background:var(--accent);border:none;color:var(--bg);padding:11px;width:100%;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">✅ Aceitar Pedido</button>`
          : `<a href="https://wa.me/244${zap}?text=${encodeURIComponent('Olá! Sou o técnico da ODJIM Solution e já estou a caminho.')}" target="_blank" style="display:block;text-align:center;background:#25D366;color:white;text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:13px;margin-top:8px;">💬 Contactar Cliente</a>`;

        html += `<div class="pedido-card"><div class="pedido-top"><span class="pedido-servico">${p.servico||""}</span><span class="badge-status ${sc}">${p.estado||""}</span></div><div class="pedido-info"><p><strong>${p.nome||""}</strong> · ${p.telefone||""}</p><p>📍 ${p.local||""}</p>${p.descricao?'<p>📝 '+p.descricao+'</p>':""}</div>${btn}</div>`;
      });
      el.innerHTML = html;
    }, err => {
      console.error("Erro no painel do técnico:", err);
    });
}

async function aceitarPedido(id){
  try {
    const docRef = db.collection("pedidos").doc(id);
    const doc = await docRef.get();
    
    if(!doc.exists){
      toast("❌ Pedido não encontrado.");
      return;
    }

    const p = doc.data();
    await docRef.update({ 
      estado: "Técnico a caminho",
      tecnicoAtribuido: auth.currentUser ? auth.currentUser.email : "Técnico ODJIM"
    });

    toast("✅ Pedido aceite com sucesso!");

    const zapCliente = (p.telefone || "").replace(/[^0-9]/g, "");
    
    const mensagemFormal = 
`*ESTIMADO(A) ${p.nome.toUpperCase()}*

Informamos que o seu pedido de serviço foi aceite e o técnico já se encontra em deslocação.

📌 *Resumo do Atendimento:*
• *Serviço:* ${p.servico}
• *Ref. Pedido:* ${id.substring(0,6)}
• *Estado:* Técnico a caminho

A equipa técnica da *ODJIM Solution* entrará em contacto para o atendimento na localização indicada (${p.local}).

---
*ODJIM Solution | Prestação de Serviços em Luanda*`;

    if(zapCliente){
      const urlZap = `https://wa.me/244${zapCliente}?text=${encodeURIComponent(mensagemFormal)}`;
      window.open(urlZap, "_blank");
    }

  } catch(e){
    toast("❌ Erro ao aceitar pedido: " + e.message);
  }
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
    else toast("❌ Erro: "+e.message);
  }
}

function mostrarPainelAdmin(){
  document.getElementById("admin-login").style.display="none";
  document.getElementById("admin-painel").style.display="block";
  carregarTecnicos();
}

function carregarTecnicos(){
  const el = document.getElementById("a-tecnicos");
  if(!el) return;
  
  db.collection("tecnicos").onSnapshot(snap => {
    if(snap.empty){
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico registado.</div>';
      return;
    }
    
    let html = "";
    snap.forEach(d => {
      const t = d.data();
      const ini = t.nome ? t.nome[0].toUpperCase() : "T";
      html += `
        <div class="tecnico-card" style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div class="tecnico-avatar" style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:bold;">${ini}</div>
          <div class="tecnico-info" style="flex:1;">
            <h4 style="margin:0;font-size:14px;color:var(--text);">${t.nome}</h4>
            <p style="margin:2px 0 0;font-size:12px;color:var(--muted);">${t.especialidade || 'Geral'} · 📞 ${t.telefone || 'N/A'}</p>
            <p style="margin:2px 0 0;font-size:11px;color:var(--accent);">${t.email}</p>
          </div>
        </div>`;
    });
    el.innerHTML = html;
  }, e => {
    el.innerHTML = '<div style="text-align:center;color:#f87171;padding:20px;">Erro ao carregar técnicos.</div>';
  });
}

// ── EXPORTAÇÃO EXCEL / CSV CORRIGIDA ──
async function exportarCSV() {
  try {
    toast("⏳ A gerar CSV...");
    const snap = await db.collection("pedidos").get();
    if (snap.empty) {
      toast("⚠️ Não há pedidos para exportar.");
      return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Nome;Telefone;Email;Serviço;Localização;Descrição;Estado;Data\n";

    snap.forEach(doc => {
      const p = doc.data();
      const nome = (p.nome || "").replace(/;/g, ",");
      const tel = (p.telefone || "").replace(/;/g, ",");
      const email = (p.email || "").replace(/;/g, ",");
      const servico = (p.servico || "").replace(/;/g, ",");
      const local = (p.local || "").replace(/;/g, ",");
      const desc = (p.descricao || "").replace(/;/g, ",").replace(/\n/g, " ");
      const estado = (p.estado || "").replace(/;/g, ",");
      const data = p.dataCriacao ? new Date(p.dataCriacao).toLocaleDateString("pt-PT") : "";

      csvContent += `"${nome}";"${tel}";"${email}";"${servico}";"${local}";"${desc}";"${estado}";"${data}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoje = new Date().toISOString().split("T")[0];
    
    a.href = url;
    a.download = `ODJIM_Pedidos_${hoje}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("✅ CSV exportado com sucesso!");
  } catch (e) {
    toast("❌ Erro ao exportar CSV: " + e.message);
  }
}
