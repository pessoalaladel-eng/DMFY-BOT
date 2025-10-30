// DMFY - MVP Webhook + Flow Builder API (Node.js + Express)
// Usage: set VERIFY_TOKEN and PAGE_ACCESS_TOKEN in env vars
// Deploy-friendly for Render/Railway/Fly.io

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ===== Armazenamento em memória (MVP) =====
// (em produção vamos trocar por Firestore/Postgres)
const flows = new Map(); // chave: 'default' (ou pageId/tenantId futuramente)

// ===== Health check (opcional) =====
app.get('/', (req, res) => res.status(200).send('DMFY webhook is live'));

// ===== Webhook verification (GET) =====
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== Receive messages (POST) =====
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Facebook Messenger pages
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if ((event.message || event.postback) && event.sender && event.sender.id) {
          const senderId = event.sender.id;
          const text = event.message?.text || event.postback?.payload || '';
          await handleMessage(senderId, text, 'messenger');
        }
      }
    }
    return res.sendStatus(200);
  }

  // Instagram
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const msg = change.value?.messages?.[0];
        if (msg && msg.from) {
          const senderId = msg.from;
          const text = msg.text || '';
          await handleMessage(senderId, text, 'instagram');
        }
      }
    }
    return res.sendStatus(200);
  }

  return res.sendStatus(404);
});

// ===== Lógica atual (fallback hardcoded) =====
// (mantida; depois ligamos o "engine" que executa o fluxo publicado)
async function handleMessage(senderId, text, channel) {
  const lower = (text || '').toLowerCase().trim();

  // (Opcional por enquanto) — se já houver fluxo publicado, no futuro
  // chamaremos um engine para executar publishedFlow.drawflow
  const publishedFlow = flows.get('default');
  if (publishedFlow) {
    // TODO: executar o fluxo publicado (engine)
    // Ex.: return runFlowEngine(publishedFlow, senderId, lower, channel);
    // Por enquanto, seguimos com o fallback hardcoded abaixo.
  }

  if (!PAGE_ACCESS_TOKEN) {
    console.error('Missing PAGE_ACCESS_TOKEN');
    return;
  }

  // --- DMFY Universal Flow (v1) — respostas fixas (MVP) ---
  if (['start','oi','ola','olá','/start','dmfy'].includes(lower)) {
    return sendText(
      senderId,
      'Fala! 👋 Eu sou o DMFY. Você quer vender (1) Mentoria, (2) Produto físico ou (3) Serviço?'
    );
  }

  if (lower.includes('1') || lower.includes('mentoria')) {
    return sendText(
      senderId,
      'Top! Mentoria: me diga seu ticket (ex.: 497/997/2000) e se você tem prova social (S/N).'
    );
  }

  if (lower.includes('2') || lower.includes('produto')) {
    return sendText(
      senderId,
      'Beleza. Produto físico: qual nicho? (ex.: saúde/beleza) e qual o principal benefício?'
    );
  }

  if (lower.includes('3') || lower.includes('serviço') || lower.includes('servico')) {
    return sendText(
      senderId,
      'Show. Serviço: qual? (ex.: tráfego, social media, design) e onde você atende?'
    );
  }

  if (/(^|\s)(997|497|2000)(\s|$)/.test(lower)) {
    await sendText(senderId, 'Perfeito. Vou te mostrar como fechamos isso nas DMs, passo a passo.');
    return sendText(senderId, 'Quer receber um roteiro otimizado e já agendar um diagnóstico? (S/N)');
  }

  if (lower === 's' || lower === 'sim') {
    await sendText(senderId, 'Ótimo! Segue o passo: https://seu-checkout-ou-form.com');
    return sendText(senderId, 'Se quiser falar com um especialista agora, digite: humano');
  }

  if (lower.includes('humano')) {
    return sendText(senderId, 'Um especialista foi acionado e vai te responder agora 😉');
  }

  // Fallback
  return sendText(
    senderId,
    'Beleza. Me dá mais um detalhe do que você vende e já te passo o melhor caminho.'
  );
}

async function sendText(psid, text) {
  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = { recipient: { id: psid }, message: { text } };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Erro ao enviar mensagem:', err);
    }
  } catch (e) {
    console.error('Erro de rede ao enviar mensagem:', e.message);
  }
}

// ======= APIs do Flow Builder (Publicar / Obter) =======
// Publicar fluxo (chamado pelo /dashboard/flow → "Publicar")
app.post('/api/flows/publish', (req, res) => {
  try {
    const flow = req.body; // { name, channel, drawflow, version, pageId? }
    const key = flow.pageId || 'default'; // depois use pageId/tenantId real
    flows.set(key, flow);
    console.log('[DMFY] Fluxo publicado:', key, flow.name, flow.version);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro publish', e);
    return res.status(400).json({ ok: false, error: e.message });
  }
});

// Obter fluxo vigente (debug/teste)
app.get('/api/flows/:key', (req, res) => {
  const key = req.params.key || 'default';
  const flow = flows.get(key);
  if (!flow) return res.status(404).json({ ok: false, error: 'Fluxo não encontrado' });
  return res.json({ ok: true, flow });
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DMFY webhook on http://localhost:${PORT}`));
