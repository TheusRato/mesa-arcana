# Ativar notificações com o app fechado

A entrega usa Web Push: o Supabase recebe uma nova mensagem, uma Edge Function envia o aviso ao serviço de push do dispositivo e o service worker mostra o remetente e a prévia da mensagem. Não depende de uma aba aberta nem de consultas periódicas do celular.

## Configuração do projeto Supabase

1. No SQL Editor, execute `supabase/migrations/20261016_push.sql`. Execute `supabase-setup.sql` antes, se o banco ainda não tiver as tabelas do app.
2. Na raiz do projeto, execute `node tools/generate-push-keys.mjs` uma única vez. Ele cria `.push-secrets.env`, ignorado pelo Git. Não publique esse arquivo, não troque as chaves em cada atualização e guarde uma cópia segura.
3. Instale a CLI do Supabase e faça login na sua conta administrativa. Vincule o projeto:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set --env-file .push-secrets.env
supabase functions deploy mesa-push --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas automaticamente às Edge Functions pelo Supabase. Nunca copie a chave administrativa para o app. Os cinco valores do arquivo local também podem ser cadastrados no painel em Edge Functions > Secrets.

4. No painel, crie um Database Webhook para **public.mesa_arcana_messages**, somente no evento **INSERT**:

- Método: `POST`.
- URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/mesa-push`.
- Header `Content-Type`: `application/json`.
- Header `x-mesa-push-secret`: o valor local de `PUSH_WEBHOOK_SECRET`.
- Timeout: 10000 ms.

Não envie o segredo do webhook ao navegador. A verificação JWT de plataforma fica desligada porque o app atual não usa sessões Supabase Auth. A própria função valida o PIN/chave no cadastro, um token aleatório na desativação e o segredo exclusivo no webhook. As inscrições são armazenadas em tabelas sem acesso de `anon` e `authenticated`.

## Em cada dispositivo

1. Abra o site HTTPS ou o app instalado, já conectado à mesa.
2. Em **Configurações > Notificações**, toque em **Ativar notificações nesta mesa** e permita no sistema.
3. O jogador confirma o próprio PIN. O mestre usa a chave da sessão atual.
4. Envie uma mensagem a partir de outro dispositivo e teste com o app receptor fechado e a tela bloqueada.

No iPhone/iPad, use um sistema compatível com Web Push e adicione o site à tela inicial antes de ativar. As configurações de foco, economia de bateria, conectividade e privacidade da tela bloqueada podem alterar a apresentação ou atrasar a entrega. Mensagens longas aparecem como prévia; tocar abre a conversa completa.

O cadastro é por mesa, perfil e dispositivo. Se mudar o PIN ou a chave mestra, reative as notificações. A função deixa de enviar para cadastros vinculados à credencial antiga. Não há envio retroativo de mensagens anteriores ao cadastro. A desativação remove apenas a inscrição desta mesa; a inscrição do navegador pode continuar sendo usada por outras mesas.

## Revisão e diagnóstico

- As notificações do mestre recebem mensagens de jogadores; as de jogadores recebem respostas do mestre/NPC apenas na conversa correspondente e com o contato/grupo permitido.
- O texto pode aparecer na tela bloqueada. Cada pessoa escolhe ativar ou desativar no próprio dispositivo.
- Nos logs da Edge Function, confira os códigos de resposta sem expor PINs, chaves, texto de mensagens ou URLs de inscrição.
- Se o webhook falhar temporariamente, confira a falha no painel e reenvie o evento. As entregas bem-sucedidas são deduplicadas por mensagem e dispositivo. O serviço de push ainda pode atrasar ou descartar um aviso.
- A validação segue o modelo de identidade atual do app. As políticas de desenvolvimento do banco original não equivalem a autorização por usuário; notificações não substituem uma futura migração para Supabase Auth e RLS por participante.

Referências: [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks), [configuração de Edge Functions](https://supabase.com/docs/guides/functions/function-configuration), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
