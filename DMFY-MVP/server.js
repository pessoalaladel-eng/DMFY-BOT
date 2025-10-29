// DMFY-MVP/server.js → server.js
 - MVP Webhook (Node.js + Express)
// Usage: set VERIFY_TOKEN and PAGE_ACCESS_TOKEN in env vars
// Deploy-friendly for Render/Railway/Fly.io

const express = require('express');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Health check (optional)
app.get('/', (req, res) => res.status(200).send('DMFY webhook is live'));

// 1) Webhook verification (GET)
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

// 2) Receive messages (POST)
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

async function handleMessage(senderId, text, channel) {
  const lower = (text || '').toLowerCase().trim();

  if (!PAGE_ACCESS_TOKEN) {
    console.error('Missing PAGE_ACCESS_TOKEN');
    return;
  }

  // --- DMFY Universal Flow (v1) ---
  if (['start','oi','ola','olá','/start','dmfy'].includes(lower)) {
    return sendText(senderId,
      'Fala! 👋 Eu sou o DMFY. Você quer vender (1) Mentoria, (2) Produto físico ou (3) Serviço?');
  }

  if (lower.includes('1') || lower.includes('mentoria')) {
    return sendText(senderId,
      'Top! Mentoria: me diga seu ticket (ex.: 497/997/2000) e se você tem prova social (S/N).');
  }

  if (lower.includes('2') || lower.includes('produto')) {
    return sendText(senderId,
      'Beleza. Produto físico: qual nicho? (ex.: saúde/beleza) e qual o principal benefício?');
  }

  if (lower.includes('3') || lower.includes('serviço') || lower.includes('servico')) {
    return sendText(senderId,
      'Show. Serviço: qual? (ex.: tráfego, social media, design) e onde você atende?');
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
  return sendText(senderId, 'Beleza. Me dá mais um detalhe do que você vende e já te passo o melhor caminho.');
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DMFY webhook on http://localhost:${PORT}`));
