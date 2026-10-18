# Versões individuais dos personagens — entrada por PIN

O mestre cria os personagens/NPCs e mantém a descrição original e os segredos antigos no cofre privado. Cada jogador entra pelo convite, nome e PIN existentes; não há etapa nova de e-mail.

Ao abrir um personagem, o jogador encontra **Minha versão**, com sua própria descrição e seus próprios segredos (um por linha). Na primeira edição, a descrição original serve de ponto de partida. Salvar não altera a descrição original nem a versão dos outros jogadores. Apagar todo o texto e salvar mantém a versão vazia. O mestre pode selecionar um jogador e consultar/editar essa versão separadamente.

As versões são salvas em `character.playerVersions[nome]`, separadas dos antigos `character.secrets` do mestre. Alterações pendentes ficam registradas localmente por personagem/jogador. A sincronização lê a campanha atual e envia somente as versões alteradas; o mestre também preserva versões de jogadores que não editou. O update verifica `updated_at` e repete a leitura/mesclagem quando outra gravação chegou antes, para evitar perda entre jogadores. Duas sessões do mesmo jogador ainda podem substituir sua própria versão pela última gravação.

**Limite escolhido para esta versão:** a separação é feita pela interface e pela lógica normal do app, não por autenticação ou RLS individual. As versões ficam no JSON compartilhado da campanha e no armazenamento local. Uma pessoa com acesso técnico ao navegador/API/Supabase pode ler ou modificar outras versões. Não use esta edição para informações que precisem de confidencialidade garantida. O login verificável e o armazenamento protegido no banco foram adiados a pedido do proprietário.

## Instalação

Nenhuma migração SQL nova, login por e-mail ou cadastro adicional é necessário. Esta edição usa o esquema/PIN já existentes. O PR substitui a proposta anterior com Auth/RLS; ela não deve ser aplicada junto desta edição. Nenhuma campanha, personagem, imagem ou segredo antigo é removido. O arquivo `supabase-setup.sql` permanece igual ao esquema original: não há motivo para executá-lo novamente em um projeto já configurado.

Se a migração Auth/RLS da proposta anterior tiver sido aplicada manualmente em algum projeto, interrompa a implantação e revise esse banco antes: esta edição por PIN não contém rollback automático das políticas nem apaga possíveis registros autenticados existentes.

## Verificação

Execute `npm run build` e `npm test`. Os testes cobrem isolamento das versões na lógica do app, gravação e remoção, persistência local, preservação dos segredos antigos do mestre e mesclagem de sincronizações concorrentes com conflito de `updated_at`.

Para validar no app: Ana edita Selene e salva; atualiza e confere sua versão. Beto abre Selene e encontra sua própria versão, sem ver a de Ana na interface. O mestre consulta Ana e Beto separadamente. Ambos gravam quase ao mesmo tempo e conferem as versões após sincronizar. Outro dispositivo precisa usar o mesmo nome/PIN e carregar a mesma campanha online. Em modo local, os dados ficam somente no dispositivo.

Build e testes automatizados não substituem a validação manual em dispositivos reais. Não há teste RLS individual nesta edição porque ela não implementa essa proteção.
