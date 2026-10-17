# Segredos individuais: instalação e migração

Esta mudança exige Supabase Auth e a migração SQL. Não publique somente o JavaScript.
Nenhuma migração é aplicada automaticamente pelo aplicativo ou pelo PR.

## Modelo de acesso

- `mesa_arcana_tables.owner_id` identifica a conta do mestre; campanhas antigas ficam sem dono até o operador atribuí-lo no SQL Editor.
- `mesa_arcana_members` vincula o UUID de uma conta verificada ao nome existente do jogador. O mestre pode vincular contas; jogadores não podem conceder acesso nem se promover a mestre.
- `mesa_arcana_character_secrets` usa a chave `(table_id, character_id, player_id)`. RLS permite acesso exclusivamente ao destinatário autenticado e ao mestre daquela campanha, inclusive em chamadas REST/RPC diretas.
- O RPC de gravação usa revisão esperada. Jogadores diferentes gravam registros distintos. Uma sessão desatualizada recebe conflito em vez de substituir o texto mais recente.
- `SELECT` não autorizado normalmente retorna uma lista vazia com RLS, e não HTTP 403. Inserções indevidas são rejeitadas; atualizações/exclusões de linhas invisíveis afetam zero registros. Isso é o comportamento esperado do PostgreSQL/Supabase.
- Segredos individuais online ficam somente na tabela protegida e na memória da tela aberta. Não entram no JSON da campanha, no registro local de mesas, nas mensagens/notificações ou no cofre do mestre.
- O cofre AES-GCM/PBKDF2 e os antigos `character.secrets` continuam separados. A chave mestra ainda é necessária para descriptografar esse cofre; login por e-mail não a substitui.
- Anotações, diários e os demais campos já compartilhados da campanha continuam compartilhados entre seus membros. Use o novo campo **Segredos individuais** para informação privada. As políticas de campanha, participantes e chat deixam de aceitar acesso anônimo; não foi redesenhado o modelo de privacidade das conversas neste PR.

## Passo a passo no painel do Supabase

1. Faça backup do banco e exporte as mesas dos dispositivos do mestre. Guarde a chave mestra fora do navegador. Use primeiro um projeto de homologação/restauração do backup.
2. Em **Authentication → Providers → Email**, habilite login por e-mail e a criação de contas (se usar cadastro pelo app). Configure SMTP para entrega confiável e os limites de envio adequados. Em **Authentication → Email Templates → Magic Link**, inclua `{{ .Token }}` no texto: o aplicativo solicita esse código com `verifyOtp`, sem depender de redirecionamento. Não remova as opções de confirmação de e-mail.
3. No app desta branch, com URL e chave **pública** do projeto configuradas, mestre e jogadores usam **Configurações → Entrar com e-mail**. Cada pessoa usa seu próprio e-mail e confirma o código. Contas novas também podem ser criadas durante a validação de um convite: o e-mail é verificado antes da consulta da campanha; a entrada falhará até o mestre autorizar o vínculo. Nunca coloque `service_role` no navegador.
4. Em **Authentication → Users**, identifique o UUID da conta verificada do mestre. Confirme por um canal confiável que é a conta correta; o nome, PIN ou convite antigo não provam propriedade.
5. Se houver segredos antigos em texto puro no JSON remoto, a migração abortará integralmente. Abra a versão antiga no dispositivo do mestre com seus dados completos, gere/guarde a chave mestra e salve o cofre na nuvem. Confirme que consegue abrir o cofre em outro dispositivo do mestre e confira o backup antes de repetir a migração. Não limpe campos no SQL para contornar essa checagem. Caso não possa criptografá-los com segurança, interrompa a migração e restaure/investigue a cópia de homologação.
6. Em **SQL Editor → New query**, para projetos novos execute primeiro `supabase-setup.sql`. Em projetos existentes a estrutura base já deve existir. Depois execute **o arquivo inteiro** `supabase/migrations/20261017_individual_secrets.sql`. Ele é transacional e pode ser repetido. Ele remove as políticas antigas das tabelas afetadas; revise políticas customizadas antes de aplicar. Nenhuma campanha, personagem, imagem, ficha ou segredo é excluído. Campanhas antigas sem dono ficam inacessíveis pela API até o próximo passo, preservadas no banco.
7. Ainda no SQL Editor, atribua cada campanha ao seu mestre, usando UUIDs reais:

```sql
update public.mesa_arcana_tables
set owner_id = 'UUID-DA-CONTA-VERIFICADA-DO-MESTRE'
where id = 'UUID-DA-CAMPANHA' and owner_id is null;
```

8. O mestre entra no app com essa conta e abre a mesa local correspondente. Em **Configurações → Vincular conta de jogador**, informa o e-mail já verificado e o **mesmo nome** usado antes pelo jogador na campanha. Isso preserva a associação às fichas/anotações antigas. Também é possível provisionar pelo SQL Editor, sem publicar UUIDs/credenciais:

```sql
insert into public.mesa_arcana_members(table_id,user_id,display_name)
values ('UUID-DA-CAMPANHA','UUID-DA-CONTA-DO-JOGADOR','Nome existente do jogador')
on conflict (table_id,user_id) do update set display_name=excluded.display_name;
```

9. Os jogadores usam seu convite existente, o nome vinculado, seu PIN antigo quando solicitado **e** a conta verificada. Novos dispositivos entram com o mesmo e-mail; nenhum PIN autoriza ler segredos de outra conta. A chave mestra antiga continua necessária para abrir o cofre em outro dispositivo do mestre. Não é necessário recriar personagens nem campanhas.
10. Em **Table Editor → mesa_arcana_character_secrets**, confira RLS habilitado e as políticas de acesso. Em SQL Editor confira `pg_policies`; não podem restar políticas `dev ...` com `using (true)` nas tabelas afetadas. Não restaure o antigo script permissivo. Faça os testes abaixo com contas reais em homologação antes de publicar/mesclar o PR.
11. Publique somente após validar a configuração. Usuários sem vínculo terão falha de sincronização; seus dados locais continuam disponíveis. O app não tenta reivindicar automaticamente campanhas antigas.

## Uso

Abra qualquer personagem/NPC. Em **Segredos individuais de**, o jogador vê sua conta; o mestre escolhe o destinatário autorizado. Escreva um segredo por linha e clique **Salvar segredos**. Remova linhas e salve para excluí-las. **Recarregar** consulta o banco novamente e pede confirmação antes de descartar um rascunho alterado. Se houver conflito, copie o rascunho, recarregue e reconcilie antes de salvar.

Mesas exclusivamente locais usam uma chave separada por mesa/jogador no armazenamento do dispositivo. O aviso da tela informa que isso **não oferece privacidade contra outros usuários do navegador nem sincronização entre dispositivos**. Em mesa online, falha de rede/autenticação mantém o rascunho na tela e não informa sucesso; não há fila offline de segredos online. Salve antes de fechar a tela/aba. Sair da conta ou fechar o personagem limpa o conteúdo da memória da interface.

## Testes e limites da validação

```sh
npm run build
npm test
```

Os testes de cliente usam um serviço simulado: verificam persistência via API em uma nova instância, filtros pelo UID, seleção do mestre, gravações independentes, conflitos, remoção, falhas de rede, respostas atrasadas e separação do armazenamento. Um teste criptográfico real verifica o round-trip dos segredos antigos do mestre. Eles não comprovam RLS nem entrega de e-mails.

A workflow `Private secrets and RLS` executa PostgreSQL 16 real em banco descartável: aplica o esquema, repete a migração e roda `supabase/tests/individual-secrets.sql` sob os papéis `authenticated`/`anon`, com claims diferentes. Usa um substituto mínimo de `auth.uid()`; não testa a emissão/validação de JWT pelo Supabase Auth. Para repetir fora do CI, em um **PostgreSQL vazio descartável**, com `PGHOST`, `PGUSER`, `PGPASSWORD` e `PGDATABASE` configurados:

```sh
psql -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
psql -v ON_ERROR_STOP=1 -f supabase-setup.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261017_individual_secrets.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261017_individual_secrets.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/individual-secrets.sql
```

**Nunca execute `bootstrap.sql` em um projeto Supabase real.**

Validação de aceitação em homologação, com três perfis de navegador independentes:

1. Ana entra com sua conta, abre Selene, grava um segredo e atualiza a página.
2. Em outro dispositivo/contexto, Ana verifica o mesmo e-mail e encontra o segredo.
3. Beto entra com outra conta e abre Selene: nenhum segredo de Ana aparece.
4. Com o cliente Supabase autenticado como Beto, faça `.from('mesa_arcana_character_secrets').select('*').eq('player_id', UUID_ANA)`: resultado vazio. Tente inserir um registro com `player_id=UUID_ANA`: erro RLS. Tente atualizar/excluir o registro: zero linhas afetadas. Nunca use o SQL Editor como prova de RLS: ele roda com privilégios administrativos.
5. O mestre seleciona Ana e Beto separadamente, lê ambos e grava uma linha destinada a Ana. Somente Ana e o mestre a encontram.
6. Ana e Beto salvam quase simultaneamente; recarreguem ambos e confirmem os dois registros. Duas sessões de Ana com a mesma revisão devem produzir um conflito na segunda gravação, mantendo seu rascunho.
7. Abra e compare os segredos privados antigos do mestre e confira que o JSON compartilhado não contém o texto dos segredos individuais.

O ambiente de implementação não tinha Supabase de homologação configurado, SMTP/contas de teste ou PostgreSQL local utilizável. A tentativa de acesso ao Docker foi cancelada. Portanto os testes manuais em Supabase real e de dois dispositivos físicos não foram executados localmente. Consulte o resultado da workflow no PR para o teste PostgreSQL; não trate sua mera inclusão como aprovação.

O smoke test de navegador também ficou bloqueado neste ambiente: o servidor local recebeu `EPERM` ao abrir a porta e o executável Chromium do Playwright não está instalado. Os testes de sintaxe/estrutura do HTML e JavaScript passaram.
