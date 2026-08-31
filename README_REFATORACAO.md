# ODJIM Solution — Refatoração v2.0

## 📋 Resumo das Mudanças

Esta refatoração corrige **vulnerabilidades críticas de segurança** e **inconsistências arquiteturais** identificadas na análise do repositório original.

---

## 🚨 Problemas Críticos Corrigidos

### 1. Segurança
| Problema Original | Solução |
|-------------------|---------|
| Senhas de técnicos em **texto plano** no Firestore | Eliminado campo `senha`. Técnicos usam Firebase Auth normalmente. |
| Credenciais guardadas em `localStorage` | Removido completamente. Usa `browserLocalPersistence` do Firebase Auth. |
| Sem verificação de roles no login | Agora verifica `usuarios/{uid}.role` em todas as entradas (cliente, técnico, admin). |
| Regras Firestore incompletas | Regras completas com funções `isAdmin()`, `isTecnico()`, `isCliente()`. |

### 2. Arquitetura
| Problema Original | Solução |
|-------------------|---------|
| `app.js` usava Firebase compat, `admin.html` usava RTDB, `notificacoes.js` usava modular | **Unificado tudo para Firebase v10 Modular** (ES modules). |
| `admin.html` lia técnicos do Realtime Database mas app.js guardava em Firestore | `admin.html` agora usa **Firestore** com coleções `tecnicos` e `localizacoes`. |
| `firebase.json` mal formatado (JSON duplicado) | Corrigido para JSON válido com hosting, firestore e storage. |
| Service workers conflitantes | `service-worker.js` simplificado com estratégia de cache adequada. |

### 3. UX / Performance
| Problema Original | Solução |
|-------------------|---------|
| Sem loading states nos botões | Adicionado `setLoading()` com spinner em todas as operações. |
| Sem validação de formulários | Validação de email, telefone, senha mínima. |
| Sem sanitização de inputs | Adicionada função `sanitize()` para prevenir XSS. |
| Listas sem paginação | Pedidos agora usam `limit()` e `orderBy()` no Firestore. |
| Gráficos quebravam em mobile | Canvas redimensiona corretamente. |

---

## 📁 Estrutura dos Ficheiros

```
odjim-refatorado/
├── index.html              # App principal (cliente, técnico, admin)
├── admin.html              # Painel admin com mapa (Firestore)
├── app.js                  # Lógica principal — Firebase v10 Modular
├── service-worker.js       # Cache PWA melhorado
├── firebase-messaging-sw.js # Notificações push FCM
├── firebase.json           # Config Firebase Hosting (corrigido)
├── firestore.rules         # Regras de segurança completas
└── manifest.json           # Manifesto PWA (manter o original)
```

---

## 🔧 Configuração Necessária

### 1. Criar o primeiro administrador
Como não há backend (Firebase Functions), precisas de criar o primeiro admin manualmente no Firebase Console:

```javascript
// No console do browser (com o app aberto), executa:
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const auth = getAuth();
const db = getFirestore();

const cred = await createUserWithEmailAndPassword(auth, "admin@odjim.com", "SENHA_SEGURA_123");
await setDoc(doc(db, "usuarios", cred.user.uid), {
  uid: cred.user.uid,
  email: "admin@odjim.com",
  nome: "Administrador",
  role: "admin",
  criadoEm: new Date()
});
```

### 2. Criar técnicos (processo recomendado)
**Opção A — Backend (recomendado):**
Usa Firebase Admin SDK num Cloud Function para criar a conta Auth e o documento `usuarios` com `role: "tecnico"`.

**Opção B — Frontend (implementado):**
O admin preenche os dados do técnico. O sistema guarda numa coleção `convites_tecnico` (sem senha em texto plano — idealmente encriptada no backend). O técnico recebe um email de convite para criar a sua conta.

### 3. Deploy
```bash
firebase deploy
```

---

## 🗂️ Coleções Firestore Necessárias

```
usuarios/{uid}       → { uid, email, nome, role, telefone, criadoEm }
clientes/{uid}       → { uid, email, nome, telefone, morada, criadoEm }
tecnicos/{id}        → { nome, email, telefone, especialidade, ativo, criadoEm }
localizacoes/{uid}   → { lat, lng, nome, especialidade, atualizadoEm }
pedidos/{id}         → { nome, telefone, email, local, servico, descricao, estado, clienteUid, tecnicoUid, dataCriacao }
avaliacoes/{id}      → { nota, emoji, label, comentario, clienteUid, data }
servicos/{id}        → { nome, emoji, descricao, preco, ativo, criadoEm }
config/empresa       → { titulo, descricao, sobre, stat1, atualizadoEm }
tokens_fcm/{id}      → { token, uid, email, plataforma, criadoEm }
convites_tecnico/{id} → { nome, email, telefone, especialidade, criadoPor, criadoEm, usado }
```

---

## ⚠️ Notas Importantes

1. **Nunca commites a API key do Firebase** em repositórios públicos. Considera usar variáveis de ambiente.
2. **Firebase Functions** são recomendadas para operações sensíveis (criar técnicos, enviar notificações push).
3. **Custom Claims** no Auth são mais seguros que verificar roles no Firestore, mas requerem Admin SDK.
4. **HTTPS obrigatório** para FCM, geolocalização e PWA funcionarem corretamente.

---

*Gerado em Agosto 2026 — Análise e Refatoração ODJIM Solution*
