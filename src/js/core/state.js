    function createId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    const initialData = {
      campaign: {
        name: "As Cinzas de Veloria",
        summary: "O grupo saiu da cidade baixa com um mapa incompleto, uma dívida com a guilda dos vidreiros e a suspeita de que a relíquia está chamando por alguém da mesa.",
        date: "",
        tone: "Investigação"
      },
      sessions: [
        { id: createId(), title: "Sessão 01", date: "", diary: "" }
      ],
      masterNotes: [
        { id: createId(), type: "Segredo", title: "O mapa foi adulterado", body: "A rota mais curta passa por uma entrada falsa. A pista real está no selo invertido da família Arven." },
        { id: createId(), type: "Gancho", title: "A dívida cobra preço", body: "Se ignorarem os vidreiros por mais uma sessão, um cobrador aparece com uma oferta ruim." }
      ],
      clocks: [
        { id: createId(), title: "Culto encontra a relíquia", progress: 35 },
        { id: createId(), title: "Guarda fecha os portões", progress: 60 }
      ],
      players: [
        { id: createId(), kind: "Jogador", name: "Jogador 1", character: "Personagem a definir", focus: "Escolher um objetivo pessoal", state: "Precisa revisar", notes: "Espaço reservado para o arquivo individual deste jogador." },
        { id: createId(), kind: "Jogador", name: "Jogador 2", character: "Personagem a definir", focus: "Conectar o passado à campanha", state: "Precisa revisar", notes: "Espaço reservado para o arquivo individual deste jogador." },
        { id: createId(), kind: "NPC", name: "Marca e cripta", character: "Isaac Barros", focus: "Conectar sonhos, símbolos e a voz ouvida na cripta", state: "Suspeito", notes: "NPC ligado à marca, aos sonhos e à voz ouvida na cripta." },
        { id: createId(), kind: "NPC", name: "Guilda", character: "Samira", focus: "Proteger contatos e favores pendentes", state: "Aliado", notes: "NPC conectada à guilda, favores pendentes e nomes suspeitos." }
      ],
      playerInventory: [],
      playerRelations: [],
      playerFiles: [],
      masterFiles: [],
      playerProfiles: [],
      board: [
        { id: createId(), column: "Pistas", title: "Selo invertido", body: "Apareceu no mapa, na moeda antiga e na porta da capela." },
        { id: createId(), column: "Perguntas", title: "Quem pagou os mercenários?", body: "O grupo sabe que o pagamento veio em vidro negro." },
        { id: createId(), column: "Tarefas", title: "Falar com Mirna", body: "Ela reconhece o símbolo, mas só atende antes do sino do meio-dia." }
      ],
      allowedContacts: [],
      messageGroups: [],
      library: [
        { id: createId(), type: "Lugar", title: "Guilda dos Vidreiros", body: "Organização influente da cidade baixa, cobra favores com elegância e ameaça velada." },
        { id: createId(), type: "Lugar", title: "Capela Afundada", body: "Cheira a sal e cera fria. As paredes rangem quando alguém cita a relíquia." }
      ]
    };

    const legacyStoreKey = "mesa-arcana-data";
    const tablesStoreKey = "mesa-arcana-tables";
    const activeTableStoreKey = "mesa-arcana-active-table";
    const contactAliasesStoreKey = "mesa-arcana-contact-aliases";
    const supabaseConfigStoreKey = "mesa-arcana-supabase-config";
    let supabaseClient = null;
    let supabaseConfig = loadSupabaseConfig();
    let tableRegistry = loadTableRegistry();
    let activeTableId = readLocalValue(activeTableStoreKey);
    let data = loadData();
    let activeMasterType = "Segredo";
    let activeMasterSection = "secrets";
    let activeCharacterId = null;
    let activeCharacterMasterView = false;
    let activePhotoIndex = 0;
    let editingCharacterId = null;
    let newCharacterCover = "";
    let activeInventoryItemId = null;
    let inventoryDraftImage = "";
    let activePlayerRelationId = null;
    let playerFileDraftImage = "";
    let masterFileDraftImage = "";
    let libraryDraftCover = "";
    let cloudSaveTimer = null;
    let cloudRefreshTimer = null;
    let isRefreshingCloud = false;
    let activeMessageNpc = "";
    let activeMessageTargetId = "";
    let activeConversationId = "";
    let messageRefreshTimer = null;
    let messageChatOpen = false;
    let replyAsNpcId = "";
    let activeMasterPlayerName = "";
    let activePlayerSection = "sheet";
    let contactAliases = loadContactAliases();
    let isSyncingParticipants = false;
    let lastParticipantSyncAt = 0;
    let lastInviteCode = "";
    let quickModalResolve = null;
    let pendingJoinInvite = null;

    const pages = {
      dashboard: ["Campanha", "Diário de bordo das sessões, registrado pela visão de quem viveu a história."],
      master: ["Escudo do Mestre", "Sua sala privada para anotações, arquivos, segredos e preparação da campanha."],
      players: ["Personagens", "Veja personagens dos jogadores e NPCs importantes no mesmo elenco da campanha."],
      messages: ["Mensagens", "Conversas entre jogadores e NPCs, com respostas conduzidas pelo Mestre."],
      board: ["Jogador", "Ficha, inventário e anotações do personagem atual."],
      library: ["Mundo", "Lugares, itens, regras e facções que aparecem na campanha."],
      settings: ["Configurações", "Nuvem, sincronização e opções do Mesa Arcana."]
    };

    const masterSections = {
      secrets: {
        type: "Segredo",
        title: "Segredos",
        intro: "Verdades ocultas, reviravoltas e informações que só o mestre sabe.",
        titlePlaceholder: "Ex.: O patrono está mentindo",
        bodyPlaceholder: "Escreva a verdade por trás da cena, consequência ou segredo.",
        button: "Adicionar segredo",
        empty: "Nenhum segredo registrado ainda."
      },
      npcs: {
        type: "NPC",
        title: "Fichas dos NPCs",
        intro: "Arquivo privado do mestre para habilidades, passado, entrada em cena e pontos fortes ou fracos.",
        titlePlaceholder: "",
        bodyPlaceholder: "",
        button: "",
        empty: "Nenhuma ficha de NPC registrada ainda."
      },
      locations: {
        type: "Local",
        title: "Locais",
        intro: "Salas, ruas, prédios e lugares importantes que o mestre precisa consultar rápido.",
        titlePlaceholder: "Ex.: Porão interditado da escola",
        bodyPlaceholder: "Descreva clima, pistas escondidas, perigos e conexões com a campanha.",
        button: "Adicionar local",
        empty: "Nenhum local privado registrado ainda."
      },
      clues: {
        type: "Pista",
        title: "Pistas não reveladas",
        intro: "Pistas que ainda estão guardadas para serem entregues no momento certo.",
        titlePlaceholder: "Ex.: Bilhete com tinta apagada",
        bodyPlaceholder: "Anote o que a pista revela, onde pode aparecer e quem pode interpretá-la.",
        button: "Adicionar pista",
        empty: "Nenhuma pista reservada ainda."
      },
      next: {
        type: "Gancho",
        title: "Próxima sessão",
        intro: "Cenas, perguntas, pendências e ideias que você quer trazer para a próxima sessão.",
        titlePlaceholder: "Ex.: Abrir com o sino tocando sozinho",
        bodyPlaceholder: "Planeje aberturas, cenas fortes, decisões pendentes ou consequências.",
        button: "Adicionar preparação",
        empty: "Nenhuma preparação para a próxima sessão ainda."
      },
      files: {
        type: "Arquivo",
        title: "Arquivos privados",
        intro: "Imagens, pistas visuais, mapas e referências que só o mestre pode consultar.",
        titlePlaceholder: "",
        bodyPlaceholder: "",
        button: "",
        empty: "Nenhum arquivo privado ainda."
      }
    };

