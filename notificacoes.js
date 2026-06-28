
const VAPID_KEY = "BJKg7cCzoji6MiA83LgN6kx0TUPXulMOxLb9kjWS_yz3ycMl_99ll9Gf2UHdPFS6TRimDUqGxKSNG1s2LVUABBw";

async function inicializarNotificacoes() {
  try {
    const { getMessaging, getToken, onMessage } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js"
    );
    const app = window._firebaseApp;
    if (!app) return;
    const messaging = getMessaging(app);

    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      mostrarBanner(false);
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });

    if (token) {
      console.log("[FCM] Token:", token);
      if (window.db && window.addDoc && window.collection) {
        await window.addDoc(window.collection(window.db, "tokens_fcm"), {
          token,
          plataforma: "web",
          criadoEm: new Date().toISOString()
        });
      }
      mostrarBanner(true);
    }

    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      mostrarToast(title || "ODJIM Solution", body || "Nova atualização.");
    });

  } catch (err) {
    console.error("[FCM] Erro:", err);
  }
}

function mostrarBanner(ativo) {
  const b = document.getElementById("pwaBanner");
  if (!b) return;
  b.style.display = "block";
  if (ativo) {
    b.style.background = "rgba(16,185,129,0.15)";
    b.style.color = "#34d399";
    b.style.border = "1px solid rgba(16,185,129,0.3)";
    b.innerHTML = "🔔 Notificações ativadas com sucesso!";
  } else {
    b.style.background = "rgba(239,68,68,0.15)";
    b.style.color = "#f87171";
    b.style.border = "1px solid rgba(239,68,68,0.3)";
    b.innerHTML = "🔕 Notificações bloqueadas. Ative nas definições do browser.";
  }
  setTimeout(() => { b.style.display = "none"; }, 5000);
}

function mostrarToast(titulo, mensagem) {
  const old = document.getElementById("odjim-toast");
  if (old) old.remove();
  const t = document.createElement("div");
  t.id = "odjim-toast";
  t.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:4px;">🔔 ${titulo}</div><div style="font-size:13px;color:#cbd5e1;">${mensagem}</div>`;
  t.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:rgba(30,41,59,0.95);border:1px solid rgba(255,152,0,0.4);border-left:4px solid #ff9800;color:#f8fafc;padding:16px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:'Outfit',sans-serif;max-width:320px;cursor:pointer;";
  t.onclick = () => t.remove();
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 6000);
}

window.inicializarNotificacoes = inicializarNotificacoes;
window.mostrarToast = mostrarToast;
