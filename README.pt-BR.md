# Mesa Arcana

[English](README.md) | **Português (Brasil)**

Organizador de campanhas de RPG para mestres e jogadores, com diário de bordo, personagens, mensagens e preparação de sessões. Funciona no computador e no celular, com armazenamento local e sincronização opcional pelo Supabase.

## Recursos

- **Campanha:** sessões, resumo compartilhado e diários por jogador.
- **Escudo do Mestre:** segredos, fichas privadas de NPCs, locais, pistas, preparação da próxima sessão e arquivos.
- **NPCs planejados:** prepare personagens em privado e revise o cartão público antes de revelá-los.
- **Personagens:** elenco da campanha, descrições, fotos e anotações por jogador.
- **Mensagens:** conversas com NPCs, grupos e liberação de contatos por jogador.
- **Jogador:** foto do personagem, ficha em imagem, anotações, inventário, relações e arquivos pessoais.
- **Mundo:** lugares, itens, regras e facções, com busca e visualização ampliada das imagens.
- **Aparência:** temas claro e escuro, com preferência salva no navegador.
- **Vários dispositivos:** acesso do mestre por convite de mestre e acesso do jogador por convite e PIN.

O mestre pode consultar as fichas dos jogadores, mas a troca da foto e da imagem da ficha pertence ao jogador daquele perfil.

## Uso local

Requer **Node.js 20 ou superior**. A montagem e o servidor não precisam de pacotes adicionais.

Na raiz do projeto, execute:

```sh
node tools/build.mjs
node tools/serve.mjs
```

Abra [http://localhost:4174/](http://localhost:4174/). Para acessar pelo celular, use o IP do computador nessa mesma porta, com os dois dispositivos conectados à mesma rede. O computador precisa permanecer ligado e permitir a conexão no firewall.

A variável de ambiente `PORT` permite escolher outra porta. Com npm instalado, os comandos equivalentes são `npm run build` e `npm start`.

## Mesas e sincronização

Sem Supabase, os dados ficam no navegador usado para acessar o app. Para compartilhar uma mesa e usar mensagens entre dispositivos:

1. Crie um projeto no Supabase e aplique [`supabase-setup.sql`](supabase-setup.sql) no editor SQL.
2. Em **Configurações**, informe a URL do projeto e a chave pública do Supabase.
3. Como mestre, use **Convidar jogadores** para disponibilizar a mesa online e obter o convite.
4. Para entrar como jogador, valide o convite e informe personagem e PIN. No primeiro acesso, confirme o PIN.
5. Para acessar como mestre em outro dispositivo, gere e use o convite de mestre.

Use somente a chave pública nessa configuração. Chaves administrativas, como `service_role`, não devem ser colocadas no navegador nem no repositório.

### Dados e privacidade

O conteúdo privado do mestre é separado dos dados públicos da mesa e enviado ao Supabase em um cofre criptografado pela chave mestra. NPCs planejados permanecem nessa área privada até serem revelados.

Guarde o convite de mestre e o PIN do jogador com cuidado. Limpar os dados do navegador, mudar de navegador ou usar uma janela anônima cria um acesso separado e pode exigir a entrada novamente. A preferência de tema também é salva por navegador.

As campanhas criadas pelos usuários não são gravadas nos arquivos publicados do site. A hospedagem e o banco Supabase são serviços separados. Publicar o código não substitui as permissões do banco nem a proteção dos convites e PINs.

## Estado atual

O app está em desenvolvimento. As revisões locais automatizadas passaram, e os fluxos de mestre e jogador entre dispositivos foram testados manualmente durante o desenvolvimento. Depois da publicação, confira novamente o acesso, os convites e a sincronização pelo endereço definitivo.
