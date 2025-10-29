
# DMFY - MVP Webhook (Messenger/Instagram)
Automação inteligente de vendas no Messenger/Instagram.

## Como rodar localmente
1) Node >= 18 instalado.
2) Crie um arquivo `.env` com:
```
VERIFY_TOKEN=dmfy_verify_123
PAGE_ACCESS_TOKEN=EAAG... # token da Página
PORT=3000
```
3) Instale e rode:
```
npm install
npm start
```
GET http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=dmfy_verify_123&hub.challenge=123
→ Deve retornar `123`.

## Deploy rápido (Render)
- Build command: `npm install`
- Start command: `npm start`
- Vars: `VERIFY_TOKEN` e `PAGE_ACCESS_TOKEN`
- Webhook URL: `https://SEU-APP.onrender.com/webhook`
- Verify Token: `dmfy_verify_123`
- Assinar eventos: Messenger `messages`, `messaging_postbacks`; Instagram `messages`.

## Endpoint de envio (Graph API)
POST https://graph.facebook.com/v20.0/me/messages?access_token=PAGE_ACCESS_TOKEN
Body:
```
{ "recipient": { "id": "<PSID>" }, "message": { "text": "Mensagem de teste" } }
```

## Observações
- Em Developer Mode, converse com usuários que sejam *testers/roles* da app.
- Para abrir ao público depois, faça App Review nas permissões.
