import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { recipientsForMessage, validPushEndpoint, legacyHash } from './routing.mjs';

const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': new URL(env('PUSH_APP_URL')).origin, 'Access-Control-Allow-Headers': 'content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' } });

Deno.serve(async request => {
  try {
    if (request.method === 'OPTIONS') return json({});
    if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
    if (Number(request.headers.get('content-length') || 0) > 131072) return json({ error: 'Requisição muito grande.' }, 413);
    const input = await request.json();
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const checked = (result: any) => { if (result.error) throw result.error; return result.data; };

    if (input.action === 'config') return json({ publicKey: env('VAPID_PUBLIC_KEY') });
    if (input.action === 'unsubscribe') {
      if (typeof input.token !== 'string' || input.token.length > 128) return json({ error: 'Token inválido.' }, 400);
      checked(await admin.from('mesa_arcana_push_subscriptions').delete().eq('table_id', input.tableId).eq('revoke_hash', await digest(input.token)));
      return json({ ok: true });
    }
    if (input.action === 'subscribe') {
      if (!['master', 'player'].includes(input.role) || typeof input.secret !== 'string' || input.secret.length > 512) return json({ error: 'Identificação inválida.' }, 400);
      const identity = `${input.tableId}:${input.role}:${String(input.playerName || '').slice(0, 120)}`;
      const rateKey = await digest(env('PUSH_WEBHOOK_SECRET') + identity);
      const allowed = checked(await admin.rpc('mesa_arcana_push_rate_limit', { rate_key: rateKey }));
      if (!allowed) return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429);
      const table = checked(await admin.from('mesa_arcana_tables').select('data').eq('id', input.tableId).single());
      const expected = input.role === 'master' ? table.data.masterAccessHash : (table.data.playerProfiles || []).find((profile: any) => profile.name === input.playerName)?.pinHash;
      if (!expected || !(same(expected, legacyHash(input.secret)) || same(expected, await digest(input.secret)))) return json({ error: 'PIN ou chave mestra incorretos.' }, 403);
      const subscription = input.subscription;
      if (!validPushEndpoint(subscription?.endpoint) || typeof subscription?.keys?.auth !== 'string' || typeof subscription?.keys?.p256dh !== 'string' || subscription.keys.auth.length > 128 || subscription.keys.p256dh.length > 256) return json({ error: 'Dispositivo inválido.' }, 400);
      const token = crypto.randomUUID() + crypto.randomUUID();
      checked(await admin.from('mesa_arcana_push_subscriptions').upsert({
        table_id: input.tableId, endpoint_hash: await digest(subscription.endpoint), role: input.role,
        player_name: input.role === 'player' ? input.playerName : '',
        credential_fingerprint: await digest(expected), subscription,
        revoke_hash: await digest(token), updated_at: new Date().toISOString()
      }, { onConflict: 'table_id,endpoint_hash' }));
      return json({ token });
    }

    // Database webhook: never accept message text or recipients supplied by a browser.
    const header = request.headers.get('x-mesa-push-secret') || '';
    if (!same(await digest(header), await digest(env('PUSH_WEBHOOK_SECRET')))) return json({ error: 'Não autorizado.' }, 401);
    if (input.type !== 'INSERT' || input.table !== 'mesa_arcana_messages' || input.schema !== 'public' || !input.record?.id) return json({ error: 'Evento inválido.' }, 400);
    const message = checked(await admin.from('mesa_arcana_messages').select('*').eq('id', input.record.id).single());
    const conversation = checked(await admin.from('mesa_arcana_conversations').select('*').eq('id', message.conversation_id).single());
    const table = checked(await admin.from('mesa_arcana_tables').select('data').eq('id', message.table_id).single());
    const subscriptions = checked(await admin.from('mesa_arcana_push_subscriptions').select('*').eq('table_id', message.table_id));
    const recipients = recipientsForMessage(message, conversation, table.data, subscriptions);
    webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
    const payload = JSON.stringify({ sender: String(message.sender_name).slice(0, 100), body: String(message.body).slice(0, 600), tableId: message.table_id, messageId: message.id, conversationKey: conversation.npc_name });
    let failed = 0;
    for (const recipient of recipients) {
      const currentHash = recipient.role === 'master' ? table.data.masterAccessHash : (table.data.playerProfiles || []).find((profile: any) => profile.name === recipient.player_name)?.pinHash;
      if (!currentHash || !same(await digest(currentHash), recipient.credential_fingerprint)) continue;
      if (!validPushEndpoint(recipient.subscription.endpoint)) continue;
      const claim = await admin.from('mesa_arcana_push_deliveries').insert({ message_id: message.id, subscription_id: recipient.id });
      if (claim.error?.code === '23505') continue;
      if (claim.error) throw claim.error;
      try {
        await webpush.sendNotification(recipient.subscription, payload, { TTL: 86400, urgency: 'high', timeout: 10000 });
      } catch (error: any) {
        if ([404, 410].includes(error.statusCode)) checked(await admin.from('mesa_arcana_push_subscriptions').delete().eq('id', recipient.id));
        else {
          failed++;
          checked(await admin.from('mesa_arcana_push_deliveries').delete().eq('message_id', message.id).eq('subscription_id', recipient.id));
        }
      }
    }
    return json({ ok: failed === 0, failed }, failed ? 503 : 200);
  } catch {
    // Do not log request bodies, credentials, message content or endpoint URLs.
    return json({ error: 'Não foi possível processar as notificações. Confira a configuração do serviço.' }, 500);
  }
});
