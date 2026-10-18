# Resumo da mesa e diários dos personagens

O resumo geral continua armazenado em `session.diary`, para preservar campanhas existentes. Os diários individuais continuam em `session.playerDiaries[nome]`. Não é necessária migração SQL ou autenticação adicional.

O mestre cria/remove sessões e edita título, data e resumo. O jogador lê esses campos e edita apenas seu diário. O mestre seleciona um jogador para consultar/editar o diário dele. O seletor também inclui nomes encontrados em diários antigos, mesmo que o perfil não apareça mais na lista de jogadores. Trocar a seleção preserva os rascunhos até clicar em Salvar.

A seleção de diário é própria da janela da sessão e não depende do jogador selecionado em outra parte do app. Sem jogador selecionado, salvar o resumo não escreve no campo de diário individual nem apaga o resumo.

Cada gravação registra somente os campos alterados em `pendingSessions` no registro local da mesa. Esse registro sobrevive à recarga e é removido somente após o envio bem-sucedido da respectiva alteração. Atualizações de perfil ou do mestre não reenviam diários antigos. A gravação na nuvem reaproveita a comparação de `updated_at` e as novas tentativas para mesclar alterações concorrentes. Duas edições do mesmo texto ainda usam a última gravação; textos de jogadores diferentes e o resumo são independentes.

A atualização automática também renova o conteúdo de uma janela de sessão já aberta, preservando rascunhos em edição. Diferenças no relógio do dispositivo não impedem a leitura de uma revisão diferente do servidor.

Salvar primeiro grava no dispositivo e inicia o envio à nuvem. Se a rede falhar, acompanhe o estado da sincronização e tente novamente quando houver conexão. Dados já apagados por uma versão anterior não podem ser recuperados automaticamente sem uma cópia de backup.

Validação: `npm run build` e `npm test`. Dez testes de regressão exercitam os manipuladores de sessão, persistência/reabertura, três gravações concorrentes simuladas, seleção de diários, rascunhos durante atualização, falhas de armazenamento/rede e relógio local adiantado. A suíte usa serviço de nuvem simulado e não substitui um teste manual no Supabase/dispositivos reais.
