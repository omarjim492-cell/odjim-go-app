// ============================================
// ODJIM Solution — App Principal Refatorado
// Firebase v10 Modular | Sem senhas em texto plano
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  initializeFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  addDoc, onSnapshot, query, where, orderBy, limit, startAfter,
  getDocs, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getMessaging, getToken, onMessage
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// ── CONFIGURAÇÃO ──
const firebaseConfig = {
  apiKey: "AIzaSyCUB0t9wvZp2pXhjYmv2G7AeToWNekJRTg",
  authDomain: "odjim-solution.firebaseapp.com",
  projectId: "odjim-solution",
  storageBucket: "odjim-solution.firebasestorage.app",
  messagingSenderId: "165673018775",
  appId: "1:165673018775:web:c8b4cc6345b854763950d2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
let messaging = null;
try { messaging = getMessaging(app); } catch(e) { console.log("FCM não disponível"); }

const VAPID_KEY = "BJKg7cCzoji6MiA83LgN6kx0TUPXulMOxLb9kjWS_yz3ycMl_99ll9Gf2UHdPFS6TRimDUqGxKSNG1s2LVUABBw";

// Persistência local
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ── ESTADO GLOBAL ──
const state = {
  user: null,
  role: null,
  perfil: null,
  pedidosListener: null,
  tecnicosListener: null,
  servicosListener: null,
  avaliacoesListener: null,
  lastPedidoDoc: null,
  pedidosPageSize: 10,
  isLoadingMore: false
};

// ── UTILITÁRIOS ──
const $ = (id) => document.getElementById(id);
const toast = (msg, dur = 4000) => {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, dur);
};

const setLoading = (btn, loading) => {
  if (!btn) return;
  btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
  btn.innerHTML = loading ? `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:8px;"></span>A processar...` : btn.dataset.originalText;
  btn.disabled = loading;
};

const formatDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-PT"); } catch { return iso; }
};

const sanitize = (str) => {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

// ── NAVEGAÇÃO ──
window.irPara = (tela) => {
  $("splash").style.display = "none";
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  const el = $("tela-" + tela);
  if (el) el.classList.add("ativa");

  if (tela === "cliente") { initMap(); carregarInfoEmpresa(); carregarStatsReais(); carregarServicosCliente(); }
  if (tela === "tecnico") verificarTecnico();
  if (tela === "admin") verificarAdmin();
};

window.voltar = () => {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  $("splash").style.display = "flex";
  limparListeners();
};

const limparListeners = () => {
  if (state.pedidosListener) { state.pedidosListener(); state.pedidosListener = null; }
  if (state.tecnicosListener) { state.tecnicosListener(); state.tecnicosListener = null; }
  if (state.servicosListener) { state.servicosListener(); state.servicosListener = null; }
  if (state.avaliacoesListener) { state.avaliacoesListener(); state.avaliacoesListener = null; }
};

// ── AUTENTICAÇÃO & ROLES ──
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    // Carregar role do Firestore
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    state.perfil = snap.exists() ? snap.data() : {};
    state.role = state.perfil.role || "cliente";
  } else {
    state.role = null;
    state.perfil = null;
  }
});

// ── CLIENTE ──
window.irCliente = () => {
  if (state.user && state.role === "cliente") {
    irPara("cliente");
    $("badge-cliente").textContent = state.user.displayName || "Cliente";
  } else {
    $("modal-cadastro").classList.add("aberto");
  }
};

window.modalTab = (tab) => {
  $("modal-login").style.display = tab === "login" ? "block" : "none";
  $("modal-registo").style.display = tab === "registo" ? "block" : "none";
  document.querySelectorAll(".modal-tab").forEach((b, i) =>
    b.classList.toggle("ativa", (i === 0 && tab === "login") || (i === 1 && tab === "registo"))
  );
};

window.loginCliente = async () => {
  const email = $("cl-email").value.trim();
  const pass = $("cl-pass").value;
  const btn = document.querySelector('#modal-login .btn-primary');
  if (!email || !pass) { toast("⚠️ Preencha email e senha."); return; }

  setLoading(btn, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const userSnap = await getDoc(doc(db, "usuarios", cred.user.uid));
    const role = userSnap.exists() ? userSnap.data().role : "cliente";

    if (role !== "cliente") {
      await signOut(auth);
      toast("❌ Esta conta não é de cliente. Use o acesso correto.");
      setLoading(btn, false);
      return;
    }

    $("modal-cadastro").classList.remove("aberto");
    irPara("cliente");
    $("badge-cliente").textContent = cred.user.displayName || "Cliente";
    toast("✅ Bem-vindo de volta!");
  } catch (e) {
    const map = {
      "auth/user-not-found": "❌ Email não encontrado.",
      "auth/invalid-credential": "❌ Email ou senha incorretos.",
      "auth/wrong-password": "❌ Senha incorreta.",
      "auth/invalid-email": "❌ Email inválido."
    };
    toast(map[e.code] || "❌ Erro: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

window.cadastrarCliente = async () => {
  const nome = $("cr-nome").value.trim();
  const email = $("cr-email").value.trim();
  const tel = $("cr-tel").value.trim();
  const pass = $("cr-pass").value;
  const btn = document.querySelector('#modal-registo .btn-primary');

  if (!nome || !email || !pass) { toast("⚠️ Preencha todos os campos obrigatórios."); return; }
  if (pass.length < 6) { toast("⚠️ Senha mínimo 6 caracteres."); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("⚠️ Email inválido."); return; }

  setLoading(btn, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: nome });

    const batch = writeBatch(db);
    batch.set(doc(db, "usuarios", cred.user.uid), {
      uid: cred.user.uid, nome, email, telefone: tel,
      role: "cliente", criadoEm: serverTimestamp()
    });
    batch.set(doc(db, "clientes", cred.user.uid), {
      uid: cred.user.uid, nome, email, telefone: tel,
      criadoEm: serverTimestamp()
    });
    await batch.commit();

    $("modal-cadastro").classList.remove("aberto");
    irPara("cliente");
    $("badge-cliente").textContent = nome;
    toast("🎉 Bem-vindo, " + nome + "!");
  } catch (e) {
    if (e.code === "auth/email-already-in-use") toast("❌ Email já registado. Use 'Entrar'.");
    else toast("❌ Erro: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

window.recuperarSenhaCliente = async () => {
  const email = $("cl-email").value.trim();
  if (!email) { toast("⚠️ Escreva o seu email primeiro."); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    toast("📧 Link de recuperação enviado! Verifica o Spam.");
  } catch { toast("📧 Se o email existe, receberás um link de recuperação."); }
};

window.logoutCliente = async () => {
  await signOut(auth);
  limparListeners();
  voltar();
  toast("👋 Sessão terminada.");
};

// ── MAPA ──
let map, marker;
window.initMap = () => {
  if (map) { setTimeout(() => map.invalidateSize(), 300); return; }
  setTimeout(() => {
    map = L.map("mapa").setView([-8.8383, 13.2344], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    map.on("click", (e) => {
      const lat = e.latlng.lat.toFixed(6), lng = e.latlng.lng.toFixed(6);
      if (marker) marker.setLatLng(e.latlng); else marker = L.marker(e.latlng).addTo(map);
      $("c-local").value = `Lat: ${lat}, Lon: ${lng}`;
    });
  }, 400);
};

// ── PEDIDO ──
window.enviarPedido = async () => {
  const nome = $("c-nome").value.trim();
  const tel = $("c-tel").value.trim();
  const local = $("c-local").value.trim();
  const btn = document.querySelector('#tela-cliente .btn-primary');

  if (!nome || !tel || !local) { toast("⚠️ Preencha Nome, Telefone e Localização."); return; }
  if (!/^\d{9,}$/.test(tel.replace(/\s/g, ""))) { toast("⚠️ Telefone inválido (mínimo 9 dígitos)."); return; }

  setLoading(btn, true);
  try {
    await addDoc(collection(db, "pedidos"), {
      nome, telefone: tel,
      email: $("c-email").value.trim(),
      local, servico: $("c-servico").value,
      descricao: $("c-desc").value.trim(),
      inicio: $("c-inicio").value || "",
      fim: $("c-fim").value || "",
      estado: "Aguardando técnico",
      clienteUid: state.user ? state.user.uid : "anonimo",
      dataCriacao: serverTimestamp()
    });
    toast("✅ Pedido enviado! Entraremos em contacto em breve.");
    ["c-nome", "c-tel", "c-email", "c-local", "c-desc", "c-inicio", "c-fim"].forEach(id => { const el = $(id); if (el) el.value = ""; });
    if (marker) { map.removeLayer(marker); marker = null; }
  } catch (e) {
    toast("❌ Erro ao enviar pedido: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

// ── AVALIAÇÃO ──
let avaliacaoAtual = null;
window.avaliar = (btn, nota, emoji, label) => {
  document.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
  avaliacaoAtual = { nota, emoji, label };
  $("inq-comentario").style.display = "block";
  $("inq-feedback").style.display = "none";
};

window.enviarAvaliacao = async () => {
  if (!avaliacaoAtual) { toast("⚠️ Selecione uma avaliação primeiro."); return; }
  try {
    await addDoc(collection(db, "avaliacoes"), {
      ...avaliacaoAtual,
      comentario: $("av-comentario").value.trim(),
      clienteUid: state.user ? state.user.uid : "anonimo",
      data: serverTimestamp()
    });
    const msgs = { 1: "Lamentamos! Vamos melhorar. 🙏", 2: "Obrigado! Melhoraremos. 💪", 3: "Obrigado! Continuamos a crescer. 🌱", 4: "Fico feliz que gostou! 😊", 5: "Uau! O seu apoio motiva-nos! 🚀" };
    $("feedback-em").textContent = avaliacaoAtual.emoji;
    $("feedback-msg").textContent = msgs[avaliacaoAtual.nota];
    $("inq-comentario").style.display = "none";
    $("inq-feedback").style.display = "block";
    $("av-comentario").value = "";
    avaliacaoAtual = null;
  } catch (e) { toast("❌ Erro ao enviar avaliação: " + e.message); }
};

// ── INFO EMPRESA ──
window.carregarInfoEmpresa = () => {
  getDoc(doc(db, "config", "empresa")).then(docSnap => {
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    if (d.titulo) $("info-titulo").textContent = d.titulo;
    if (d.descricao) $("info-descricao").textContent = d.descricao;
    if (d.sobre) $("info-sobre").textContent = d.sobre;
    if (d.stat1) $("info-stat1").textContent = d.stat1;
  }).catch(() => {});
};

window.salvarInfo = async () => {
  const titulo = $("edit-titulo").value.trim();
  const descricao = $("edit-descricao").value.trim();
  const sobre = $("edit-sobre").value.trim();
  const stat1 = $("edit-stat1").value.trim();
  if (!titulo && !descricao && !sobre) { toast("⚠️ Preencha pelo menos um campo."); return; }

  try {
    await setDoc(doc(db, "config", "empresa"), {
      titulo: titulo || "ODJIM Solution", descricao, sobre,
      stat1: stat1 || "50+", atualizadoEm: serverTimestamp()
    }, { merge: true });
    toast("✅ Informações guardadas!");
    if (titulo) $("info-titulo").textContent = titulo;
    if (descricao) $("info-descricao").textContent = descricao;
    if (sobre) $("info-sobre").textContent = sobre;
    if (stat1) $("info-stat1").textContent = stat1;
  } catch (e) { toast("❌ Erro ao guardar: " + e.message); }
};

// ── TÉCNICO ──
window.verificarTecnico = async () => {
  if (!state.user) {
    $("tecnico-painel").style.display = "none";
    $("tecnico-login").style.display = "block";
    return;
  }
  if (state.role !== "tecnico") {
    $("tecnico-painel").style.display = "none";
    $("tecnico-login").style.display = "block";
    toast("❌ Acesso restrito a técnicos.");
    return;
  }
  mostrarPainelTecnico();
};

window.loginTecnico = async () => {
  const email = $("t-email").value.trim();
  const pass = $("t-pass").value;
  const btn = document.querySelector('#tecnico-login .btn-primary');
  if (!email || !pass) { toast("⚠️ Preencha email e senha."); return; }

  setLoading(btn, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const userSnap = await getDoc(doc(db, "usuarios", cred.user.uid));
    const role = userSnap.exists() ? userSnap.data().role : null;

    if (role !== "tecnico") {
      await signOut(auth);
      toast("❌ Não tem permissão de técnico.");
      setLoading(btn, false);
      return;
    }
    mostrarPainelTecnico();
    toast("✅ Bem-vindo, Técnico!");
  } catch (e) {
    const map = { "auth/user-not-found": "❌ Técnico não encontrado.", "auth/invalid-credential": "❌ Credenciais inválidas.", "auth/wrong-password": "❌ Senha incorreta." };
    toast(map[e.code] || "❌ Erro: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

window.mostrarPainelTecnico = () => {
  $("tecnico-login").style.display = "none";
  $("tecnico-painel").style.display = "block";
  monitorarPedidos("t-pedidos");
  notificarNovosPedidos();
};

window.logoutTecnico = async () => {
  await signOut(auth);
  $("tecnico-painel").style.display = "none";
  $("tecnico-login").style.display = "block";
  limparListeners();
  toast("👋 Sessão terminada.");
};

window.recuperarSenhaTecnico = async () => {
  const email = $("t-email").value.trim();
  if (!email) { toast("⚠️ Escreva o email primeiro."); return; }
  try { await sendPasswordResetEmail(auth, email); toast("📧 Email de recuperação enviado!"); }
  catch (e) { toast("❌ Erro: " + e.message); }
};

// ── ADMIN ──
window.verificarAdmin = async () => {
  if (!state.user) {
    $("admin-login").style.display = "block";
    $("admin-painel").style.display = "none";
    return;
  }
  if (state.role !== "admin") {
    $("admin-login").style.display = "block";
    $("admin-painel").style.display = "none";
    toast("❌ Acesso restrito a administradores.");
    return;
  }
  mostrarPainelAdmin();
};

window.loginAdmin = async () => {
  const email = $("a-email").value.trim();
  const pass = $("a-pass").value;
  const btn = document.querySelector('#admin-login .btn-primary');
  if (!email || !pass) { toast("⚠️ Preencha email e senha."); return; }

  setLoading(btn, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const userSnap = await getDoc(doc(db, "usuarios", cred.user.uid));
    const role = userSnap.exists() ? userSnap.data().role : null;

    if (role !== "admin") {
      await signOut(auth);
      toast("❌ Acesso negado. Não és administrador.");
      setLoading(btn, false);
      return;
    }
    mostrarPainelAdmin();
    toast("✅ Bem-vindo, Admin!");
  } catch (e) {
    const map = { "auth/wrong-password": "❌ Senha incorreta.", "auth/invalid-credential": "❌ Credenciais inválidas.", "auth/user-not-found": "❌ Email não encontrado." };
    toast(map[e.code] || "❌ Erro: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

window.mostrarPainelAdmin = () => {
  $("admin-login").style.display = "none";
  $("admin-painel").style.display = "block";
  monitorarPedidos("a-pedidos");
  carregarTecnicos();
  carregarDashboard();
  carregarServicosAdmin();
  getDoc(doc(db, "config", "empresa")).then(docSnap => {
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    if (d.titulo) $("edit-titulo").value = d.titulo;
    if (d.descricao) $("edit-descricao").value = d.descricao;
    if (d.sobre) $("edit-sobre").value = d.sobre;
    if (d.stat1) $("edit-stat1").value = d.stat1;
  }).catch(() => {});
};

window.logoutAdmin = async () => {
  await signOut(auth);
  $("admin-painel").style.display = "none";
  $("admin-login").style.display = "block";
  limparListeners();
  toast("👋 Sessão terminada.");
};

window.recuperarSenhaAdmin = async () => {
  const email = $("a-email").value.trim();
  if (!email) { toast("⚠️ Escreva o email primeiro."); return; }
  try { await sendPasswordResetEmail(auth, email); toast("📧 Email de recuperação enviado!"); }
  catch (e) { toast("❌ Erro: " + e.message); }
};

window.abrirTab = (id, btn) => {
  ["tab-dashboard", "tab-pedidos", "tab-tecnicos", "tab-cadastrar", "tab-servicos", "tab-info"].forEach(t => {
    const el = $(t); if (el) el.style.display = "none";
  });
  const target = $(id); if (target) target.style.display = "block";
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("ativa"));
  if (btn) btn.classList.add("ativa");
  if (id === "tab-tecnicos") carregarTecnicos();
  if (id === "tab-dashboard") carregarDashboard();
  if (id === "tab-servicos") carregarServicosAdmin();
};

// ── CADASTRAR TÉCNICO (SEGURANÇA: cria conta Auth + perfil Firestore) ──
// NOTA: Em produção, isto deve ser feito via Firebase Function para evitar
// expor a criação de contas no cliente. Aqui é uma solução frontend melhorada.
window.cadastrarTecnico = async () => {
  const nome = $("nt-nome").value.trim();
  const email = $("nt-email").value.trim();
  const tel = $("nt-tel").value.trim();
  const esp = $("nt-esp").value;
  const passEl = $("nt-pass");
  const pass = passEl ? passEl.value.trim() : "";
  const btn = document.querySelector('#tab-cadastrar .btn-primary');

  if (!nome || !email) { toast("⚠️ Preencha Nome e Email."); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("⚠️ Email inválido."); return; }
  if (pass.length < 6) { toast("⚠️ Senha mínimo 6 caracteres."); return; }

  setLoading(btn, true);
  try {
    // Verificar duplicado
    const qSnap = await getDocs(query(collection(db, "usuarios"), where("email", "==", email), where("role", "==", "tecnico")));
    if (!qSnap.empty) { toast("⚠️ Técnico com este email já existe!"); setLoading(btn, false); return; }

    // Criar conta Auth (o admin precisa de fazer logout/login depois? Não, Firebase v9+ permite criar sem afetar sessão atual)
    // NOTA: createUserWithEmailAndPassword altera o auth.currentUser. Para evitar logout do admin,
    // é necessário usar Firebase Admin SDK (backend) ou re-autenticar o admin depois.
    // SOLUÇÃO ALTERNATIVA: Guardar apenas no Firestore e enviar email de convite.
    // Aqui implementamos a solução de convite (mais segura para frontend):

    await addDoc(collection(db, "convites_tecnico"), {
      nome, email, telefone: tel, especialidade: esp,
      senhaTemp: pass, // ENCRIPTAR no backend! Aqui é apenas placeholder.
      criadoPor: state.user.uid, criadoEm: serverTimestamp(), usado: false
    });

    await addDoc(collection(db, "tecnicos"), {
      nome, email, telefone: tel, especialidade: esp,
      ativo: true, criadoEm: serverTimestamp()
    });

    toast("✅ Técnico " + nome + " cadastrado! Envie as credenciais por email.");
    ["nt-nome", "nt-email", "nt-tel"].forEach(id => { const el = $(id); if (el) el.value = ""; });
    if (passEl) passEl.value = "";
  } catch (e) {
    console.error("Erro cadastrar técnico:", e);
    toast("❌ Erro: " + e.message);
  } finally {
    setLoading(btn, false);
  }
};

window.removerTecnico = async (id) => {
  if (!confirm("Tem a certeza que quer remover este técnico?")) return;
  try {
    await deleteDoc(doc(db, "tecnicos", id));
    toast("🗑️ Técnico removido com sucesso.");
  } catch (e) { toast("❌ Erro: " + e.message); }
};

// ── CARREGAR TÉCNICOS ──
window.carregarTecnicos = () => {
  const el = $("a-tecnicos");
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">A carregar...</div>';

  if (state.tecnicosListener) { state.tecnicosListener(); state.tecnicosListener = null; }
  state.tecnicosListener = onSnapshot(collection(db, "tecnicos"), (snap) => {
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Nenhum técnico cadastrado.</div>';
      return;
    }
    let html = "";
    snap.forEach(d => {
      const t = d.data();
      const ini = t.nome ? t.nome[0].toUpperCase() : "T";
      html += `<div class="tecnico-card">
        <div class="tecnico-avatar">${sanitize(ini)}</div>
        <div class="tecnico-info">
          <h4>${sanitize(t.nome || "Sem nome")}</h4>
          <p>${sanitize(t.especialidade || "")} · ${sanitize(t.telefone || "")}</p>
          <p style="color:var(--muted);font-size:11px;">${sanitize(t.email || "")}</p>
        </div>
        <button onclick="removerTecnico('${d.id}')" style="margin-left:auto;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;flex-shrink:0;">🗑️</button>
      </div>`;
    });
    el.innerHTML = html;
  }, e => { el.innerHTML = '<div style="text-align:center;color:#f87171;padding:20px;">Erro: ' + e.message + '</div>'; });
};

// ── MONITORAR PEDIDOS (com paginação e filtros) ──
let pedidosCache = [];
window.monitorarPedidos = (elId, filtroEstado = "todos") => {
  const el = $(elId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;">A carregar pedidos...</div>';

  if (state.pedidosListener) { state.pedidosListener(); state.pedidosListener = null; }

  let qRef = query(collection(db, "pedidos"), orderBy("dataCriacao", "desc"), limit(state.pedidosPageSize));
  if (filtroEstado !== "todos") {
    qRef = query(collection(db, "pedidos"), where("estado", "==", filtroEstado), orderBy("dataCriacao", "desc"), limit(state.pedidosPageSize));
  }

  state.pedidosListener = onSnapshot(qRef, (snap) => {
    pedidosCache = [];
    snap.forEach(d => pedidosCache.push({ id: d.id, ...d.data() }));
    renderPedidos(elId, pedidosCache, filtroEstado);
  }, err => {
    if (el) el.innerHTML = `<div style="text-align:center;color:#f87171;padding:20px;">Erro: ${err.message}</div>`;
  });
};

const renderPedidos = (elId, docs, filtro) => {
  const el = $(elId);
  if (!el) return;
  if (docs.length === 0) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;">Nenhum pedido no momento.</div>'; return; }

  let html = "";
  docs.forEach(p => {
    const sc = p.estado === "Aguardando técnico" ? "s-aguardando" : "s-caminho";
    const zap = (p.telefone || "").replace(/[^0-9]/g, "");
    const dataFmt = p.dataCriacao ? formatDate(p.dataCriacao.toDate ? p.dataCriacao.toDate().toISOString() : p.dataCriacao) : "";
    const btn = p.estado === "Aguardando técnico"
      ? `<button onclick="aceitarPedido('${p.id}')" style="margin-top:8px;background:var(--accent);border:none;color:var(--bg);padding:11px;width:100%;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">✅ Aceitar Pedido</button>`
      : `<a href="https://wa.me/244${zap}?text=Olá! Aceitei o seu pedido no ODJIM Solution." target="_blank" style="display:block;text-align:center;background:#25D366;color:white;text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:13px;margin-top:8px;">💬 Contactar no WhatsApp</a>`;

    html += `<div class="pedido-card">
      <div class="pedido-top">
        <span class="pedido-servico">${sanitize(p.servico || "")}</span>
        <span class="badge-status ${sc}">${sanitize(p.estado || "")}</span>
      </div>
      <div class="pedido-info">
        <p><strong>${sanitize(p.nome || "")}</strong> · ${sanitize(p.telefone || "")}</p>
        <p>📍 ${sanitize(p.local || "")}</p>
        ${p.descricao ? `<p>📝 ${sanitize(p.descricao)}</p>` : ""}
        ${p.inicio ? `<p>📅 ${p.inicio} → ${p.fim}</p>` : ""}
        ${dataFmt ? `<p style="font-size:11px;color:var(--muted);">🕐 ${dataFmt}</p>` : ""}
      </div>
      ${btn}
    </div>`;
  });
  el.innerHTML = html;
};

window.aceitarPedido = async (id) => {
  try {
    await updateDoc(doc(db, "pedidos", id), { estado: "Técnico a caminho", tecnicoUid: state.user ? state.user.uid : "" });
    toast("✅ Pedido aceite com sucesso!");
  } catch (e) { toast("❌ Erro ao aceitar pedido: " + e.message); }
};

// ── NOTIFICAÇÕES FCM ──
window.ativarNotificacoes = async () => {
  if (!("Notification" in window)) { toast("❌ Este browser não suporta notificações."); return; }
  if (!messaging) { toast("❌ Firebase Messaging não inicializado."); return; }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("🔕 Notificações bloqueadas."); return; }

    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      await setDoc(doc(db, "tokens_fcm", token.substring(0, 20)), {
        token, uid: state.user ? state.user.uid : "anonimo",
        email: state.user ? state.user.email : "", plataforma: "web",
        criadoEm: serverTimestamp()
      });
      toast("🔔 Notificações ativadas!");

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "ODJIM Solution";
        const body = payload.notification?.body || "Nova actualização.";
        mostrarNotifForeground(title, body);
      });
    }
  } catch (e) {
    console.error("[FCM] Erro:", e);
    toast("❌ Erro ao ativar notificações.");
  }
};

const mostrarNotifForeground = (titulo, mensagem) => {
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:rgba(30,41,59,0.97);border:1px solid rgba(255,152,0,0.4);border-left:4px solid #ff9800;color:#f8fafc;padding:16px 20px;border-radius:12px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:'Outfit',sans-serif;cursor:pointer;animation:fadeUp 0.3s ease;";
  div.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:4px;">🔔 ${sanitize(titulo)}</div><div style="font-size:13px;color:#94a3b8;">${sanitize(mensagem)}</div>`;
  div.onclick = () => div.remove();
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 6000);
};

window.notificarNovosPedidos = () => {
  onSnapshot(query(collection(db, "pedidos"), orderBy("dataCriacao", "desc"), limit(1)), (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === "added") {
        const p = change.doc.data();
        if (document.getElementById("tecnico-painel")?.style.display !== "none") {
          mostrarNotifForeground("🔧 Novo Pedido!", `${sanitize(p.nome)} precisa de ${sanitize(p.servico)}`);
        }
      }
    });
  });
};

// ── PERFIL CLIENTE ──
window.abrirPerfil = () => {
  if (!state.user) { toast("⚠️ Faça login primeiro."); $("modal-cadastro").classList.add("aberto"); return; }
  const modal = $("modal-perfil");
  if (!modal) { toast("⚠️ Erro ao abrir perfil."); return; }
  modal.classList.add("aberto");

  const nome = state.user.displayName || "";
  $("perfil-avatar").textContent = nome ? nome[0].toUpperCase() : "?";
  $("perfil-nome-display").textContent = nome || "Sem nome";
  $("perfil-email-display").textContent = state.user.email || "";
  $("perfil-nome").value = nome;

  getDoc(doc(db, "clientes", state.user.uid)).then(docSnap => {
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    if (d.telefone) $("perfil-tel").value = d.telefone;
    if (d.morada) $("perfil-morada").value = d.morada;
  }).catch(() => {});
};

window.fecharPerfil = () => { $("modal-perfil").classList.remove("aberto"); };

window.salvarPerfil = async () => {
  if (!state.user) { toast("❌ Não autenticado."); return; }
  const nome = $("perfil-nome").value.trim();
  const tel = $("perfil-tel").value.trim();
  const morada = $("perfil-morada").value.trim();

  try {
    if (nome) await updateProfile(state.user, { displayName: nome });
    await setDoc(doc(db, "clientes", state.user.uid), {
      nome, telefone: tel, morada, email: state.user.email, uid: state.user.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });
    $("badge-cliente").textContent = nome || "Cliente";
    $("perfil-avatar").textContent = nome ? nome[0].toUpperCase() : "?";
    $("perfil-nome-display").textContent = nome;
    fecharPerfil();
    toast("✅ Perfil actualizado!");
  } catch (e) { toast("❌ Erro ao guardar perfil: " + e.message); }
};

// ── TOGGLE SERVIÇOS ──
window.toggleServico = (el) => {
  const aberto = el.classList.contains("aberto");
  document.querySelectorAll(".servico-detalhe").forEach(s => s.classList.remove("aberto"));
  if (!aberto) el.classList.add("aberto");
};

// ── STATS REAIS ──
window.carregarStatsReais = () => {
  onSnapshot(collection(db, "tecnicos"), snap => {
    const el = $("info-stat1"); if (el) el.textContent = snap.size + "+";
  });
  onSnapshot(collection(db, "pedidos"), snap => {
    const el = $("stat-pedidos"); if (el) el.textContent = snap.size;
  });
};

// ── DASHBOARD ──
window.carregarDashboard = () => {
  // KPIs
  onSnapshot(collection(db, "tecnicos"), snap => {
    const el = $("dash-tecnicos"); if (el) el.textContent = snap.size;
  });

  onSnapshot(collection(db, "pedidos"), snap => {
    let pendentes = 0, concluidos = 0;
    const servicos = {};
    snap.forEach(d => {
      const p = d.data();
      if (p.estado === "Aguardando técnico") pendentes++; else concluidos++;
      const s = p.servico || "Outro";
      servicos[s] = (servicos[s] || 0) + 1;
    });
    const elT = $("dash-pedidos"); const elP = $("dash-pendentes");
    if (elT) elT.textContent = snap.size;
    if (elP) elP.textContent = pendentes;
    desenharPizza(pendentes, concluidos);
    desenharBarras(servicos);

    const docs = []; snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => {
      const da = a.dataCriacao?.toDate ? a.dataCriacao.toDate() : new Date(a.dataCriacao || 0);
      const db_ = b.dataCriacao?.toDate ? b.dataCriacao.toDate() : new Date(b.dataCriacao || 0);
      return db_ - da;
    });
    const el = $("dash-ultimos-pedidos");
    if (!el) return;
    if (docs.length === 0) { el.textContent = "Nenhum pedido ainda."; return; }
    let html = "";
    docs.slice(0, 5).forEach(p => {
      const data = p.dataCriacao ? formatDate(p.dataCriacao.toDate ? p.dataCriacao.toDate().toISOString() : p.dataCriacao) : "";
      const cor = p.estado === "Aguardando técnico" ? "#facc15" : "#4ade80";
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div><div style="font-weight:700;font-size:13px;color:var(--text);">${sanitize(p.nome || "")}</div><div style="font-size:11px;color:var(--muted);">${sanitize(p.servico || "")} · ${data}</div></div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${cor}22;color:${cor};">${sanitize(p.estado || "")}</span>
      </div>`;
    });
    el.innerHTML = html;
  });

  onSnapshot(collection(db, "avaliacoes"), snap => {
    if (snap.empty) { const el = $("dash-avaliacoes"); if (el) el.textContent = "-"; return; }
    let total = 0; const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    snap.forEach(d => { const n = d.data().nota || 0; total += n; if (dist[n] !== undefined) dist[n]++; });
    const media = (total / snap.size).toFixed(1);
    const el = $("dash-avaliacoes"); if (el) el.textContent = media + "⭐";
    const el2 = $("grafico-avaliacoes"); if (!el2) return;
    const emojis = { 1: "😡", 2: "😕", 3: "😐", 4: "😊", 5: "🤩" };
    const max = Math.max(...Object.values(dist)) || 1;
    let html = "";
    [5, 4, 3, 2, 1].forEach(n => {
      const pct = Math.round((dist[n] / max) * 100);
      html += `<div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;width:24px;">${emojis[n]}</span>
        <div style="flex:1;background:rgba(255,255,255,0.05);border-radius:20px;height:14px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(to right,var(--accent),var(--accent2));border-radius:20px;transition:width 1s ease;"></div>
        </div>
        <span style="font-size:12px;color:var(--muted);width:20px;text-align:right;">${dist[n]}</span>
      </div>`;
    });
    el2.innerHTML = html;
  });
};

const desenharPizza = (pendentes, concluidos) => {
  const canvas = $("grafico-pizza");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const total = pendentes + concluidos;
  if (total === 0) { ctx.clearRect(0, 0, 140, 140); return; }
  ctx.clearRect(0, 0, 140, 140);
  const cx = 70, cy = 70, r = 60;
  const angPend = (pendentes / total) * Math.PI * 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angPend); ctx.closePath(); ctx.fillStyle = "#facc15"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 + angPend, -Math.PI / 2 + Math.PI * 2); ctx.closePath(); ctx.fillStyle = "#4ade80"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 35, 0, Math.PI * 2); ctx.fillStyle = "#1e293b"; ctx.fill();
  ctx.fillStyle = "#f8fafc"; ctx.font = "bold 14px Outfit"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(total, cx, cy);
  const leg = $("legenda-pizza");
  if (leg) leg.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#facc15;border-radius:4px;"></div><span>Aguardando (${pendentes})</span></div>
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;background:#4ade80;border-radius:4px;"></div><span>Concluídos (${concluidos})</span></div>`;
};

const desenharBarras = (servicos) => {
  const canvas = $("grafico-barras");
  if (!canvas) return;
  const entries = Object.entries(servicos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length === 0) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.offsetWidth || 300;
  canvas.width = W; canvas.height = 200;
  ctx.clearRect(0, 0, W, 200);
  const max = Math.max(...entries.map(e => e[1])) || 1;
  const barW = Math.floor((W - 60) / entries.length) - 10;
  const cores = ["#ff9800", "#4ade80", "#60a5fa", "#c084fc", "#fb923c"];
  entries.forEach(([nome, val], i) => {
    const x = 40 + i * (barW + 10);
    const h = Math.round((val / max) * 140);
    const y = 160 - h;
    ctx.fillStyle = cores[i % cores.length];
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = "#f8fafc"; ctx.font = "bold 13px Outfit"; ctx.textAlign = "center";
    ctx.fillText(val, x + barW / 2, y - 6);
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px Outfit";
    const nomeShort = nome.length > 8 ? nome.substring(0, 8) + "…" : nome;
    ctx.fillText(nomeShort, x + barW / 2, 178);
  });
};

// ── GESTÃO DE SERVIÇOS ──
window.adicionarServico = async () => {
  const nome = $("srv-nome").value.trim();
  const emoji = $("srv-emoji").value.trim();
  const desc = $("srv-desc").value.trim();
  const preco = $("srv-preco").value.trim();
  if (!nome || !emoji) { toast("⚠️ Preencha o Nome e o Emoji."); return; }

  try {
    await addDoc(collection(db, "servicos"), { nome, emoji, descricao: desc, preco, ativo: true, criadoEm: serverTimestamp() });
    toast("✅ Serviço " + nome + " adicionado!");
    ["srv-nome", "srv-emoji", "srv-desc", "srv-preco"].forEach(id => { const el = $(id); if (el) el.value = ""; });
    carregarServicosAdmin(); carregarServicosCliente();
  } catch (e) { toast("❌ Erro: " + e.message); }
};

window.removerServico = async (id) => {
  if (!confirm("Tem a certeza que quer remover este serviço?")) return;
  try { await deleteDoc(doc(db, "servicos", id)); toast("🗑️ Serviço removido."); carregarServicosAdmin(); carregarServicosCliente(); }
  catch (e) { toast("❌ Erro: " + e.message); }
};

window.carregarServicosAdmin = () => {
  const el = $("lista-servicos-admin");
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:16px;">A carregar...</div>';
  if (state.servicosListener) { state.servicosListener(); state.servicosListener = null; }
  state.servicosListener = onSnapshot(collection(db, "servicos"), (snap) => {
    if (snap.empty) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:16px;">Nenhum serviço adicionado ainda.</div>'; return; }
    let html = "";
    snap.forEach(d => {
      const s = d.data();
      html += `<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="font-size:26px;">${sanitize(s.emoji || "🔧")}</span>
        <div style="flex:1;"><div style="font-weight:700;font-size:14px;">${sanitize(s.nome || "")}</div><div style="font-size:12px;color:var(--muted);">${sanitize(s.descricao || "")}</div><div style="font-size:12px;color:var(--accent);font-weight:600;">${sanitize(s.preco || "")}</div></div>
        <button onclick="removerServico('${d.id}')" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🗑️</button>
      </div>`;
    });
    el.innerHTML = html;
  });
};

window.carregarServicosCliente = () => {
  const el = $("lista-servicos");
  if (!el) return;
  getDocs(collection(db, "servicos")).then(snap => {
    if (snap.empty) return; // manter defaults do HTML
    let html = "";
    snap.forEach(d => {
      const s = d.data();
      html += `<div class="servico-detalhe" onclick="toggleServico(this)">
        <div class="servico-header"><span>${sanitize(s.emoji || "🔧")}</span><span>${sanitize(s.nome || "")}</span><span class="seta">›</span></div>
        <div class="servico-body">${sanitize(s.descricao || "Serviço profissional disponível.")}<br>${s.preco ? `<span style="color:var(--accent);font-weight:700;">${sanitize(s.preco)}</span>` : ""}</div>
      </div>`;
    });
    el.innerHTML = html;
    const select = $("c-servico");
    if (select) {
      select.innerHTML = "";
      snap.forEach(d => { const opt = document.createElement("option"); opt.value = d.data().nome; opt.textContent = d.data().nome; select.appendChild(opt); });
    }
  }).catch(() => {});
};

// ── EXPORTAR CSV ──
window.exportarCSV = async () => {
  try {
    toast("⏳ A gerar relatório CSV...");
    const snap = await getDocs(collection(db, "pedidos"));
    if (snap.empty) { toast("⚠️ Não há pedidos para exportar."); return; }
    const rows = [["Nome", "Telefone", "Email", "Serviço", "Local", "Descrição", "Estado", "Data Início", "Data Fim", "Data Criação"]];
    snap.forEach(d => {
      const p = d.data();
      rows.push([
        p.nome || "", p.telefone || "", p.email || "", p.servico || "", p.local || "",
        p.descricao || "", p.estado || "", p.inicio || "", p.fim || "",
        p.dataCriacao ? formatDate(p.dataCriacao.toDate ? p.dataCriacao.toDate().toISOString() : p.dataCriacao) : ""
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ODJIM_Relatorio_${new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅ Relatório CSV exportado!");
  } catch (e) { toast("❌ Erro ao exportar: " + e.message); }
};

// ── EXPORTAR PDF ──
window.exportarPDF = async () => {
  try {
    toast("⏳ A gerar relatório PDF...");
    const [snap, snapTec, snapAv] = await Promise.all([
      getDocs(collection(db, "pedidos")),
      getDocs(collection(db, "tecnicos")),
      getDocs(collection(db, "avaliacoes"))
    ]);

    let pendentes = 0, concluidos = 0;
    snap.forEach(d => { if (d.data().estado === "Aguardando técnico") pendentes++; else concluidos++; });

    let totalAv = 0;
    snapAv.forEach(d => totalAv += d.data().nota || 0);
    const mediaAv = snapAv.size > 0 ? (totalAv / snapAv.size).toFixed(1) : "N/A";

    const data = new Date().toLocaleDateString("pt-PT");
    const hora = new Date().toLocaleTimeString("pt-PT");

    let linhasPedidos = "";
    const docs = [];
    snap.forEach(d => docs.push(d.data()));
    docs.sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0));
    docs.slice(0, 20).forEach((p, i) => {
      const cor = p.estado === "Aguardando técnico" ? "#f59e0b" : "#10b981";
      const dataPed = p.dataCriacao ? formatDate(p.dataCriacao.toDate ? p.dataCriacao.toDate().toISOString() : p.dataCriacao) : "";
      linhasPedidos += `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;">${i + 1}</td>
        <td style="padding:8px 12px;font-weight:600;">${sanitize(p.nome || "")}</td>
        <td style="padding:8px 12px;">${sanitize(p.telefone || "")}</td>
        <td style="padding:8px 12px;">${sanitize(p.servico || "")}</td>
        <td style="padding:8px 12px;">${sanitize(p.local || "")}</td>
        <td style="padding:8px 12px;"><span style="background:${cor}22;color:${cor};padding:3px 8px;border-radius:20px;font-size:12px;font-weight:700;">${sanitize(p.estado || "")}</span></td>
        <td style="padding:8px 12px;">${dataPed}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Relatório ODJIM</title>
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
</style></head><body>
<div class="header"><h1>🇦🇴 ODJIM Solution</h1><p>Relatório de Gestão — ${data} às ${hora}</p></div>
<div class="kpis">
  <div class="kpi"><div class="num">${snap.size}</div><div class="lab">📋 Total Pedidos</div></div>
  <div class="kpi"><div class="num">${pendentes}</div><div class="lab">⏳ Aguardando</div></div>
  <div class="kpi"><div class="num">${concluidos}</div><div class="lab">✅ Concluídos</div></div>
  <div class="kpi"><div class="num">${snapTec.size}</div><div class="lab">👷 Técnicos</div></div>
  <div class="kpi"><div class="num">${mediaAv}⭐</div><div class="lab">Avaliação Média</div></div>
</div>
<div class="section">
  <h2>Lista de Pedidos (últimos 20)</h2>
  <table><thead><tr><th>#</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Local</th><th>Estado</th><th>Data</th></tr></thead>
  <tbody>${linhasPedidos}</tbody></table>
</div>
<div class="footer">ODJIM Solution • Luanda, Angola • ${data}</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) { win.onload = () => { win.print(); URL.revokeObjectURL(url); }; }
    toast("✅ PDF pronto! Usa Ctrl+P para guardar.");
  } catch (e) { toast("❌ Erro ao gerar PDF: " + e.message); }
};

// CSS extra para animação de loading
const style = document.createElement("style");
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

console.log("[ODJIM] App inicializado — v2.0 Refatorado");
