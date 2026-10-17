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
      hiddenPlayerProfiles: [],
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
    let isSavingCloud = false;
    let cloudChangeVersion = 0;
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


    function createTableRecord(name, role, tableData = initialData) {
      const normalizedData = role === "player" ? playerSafeData(tableData) : normalizeData(tableData);
      return {
        id: createId(),
        name: name || "Mesa sem nome",
        role,
        playerName: "",
        masterKey: "",
        onlineId: "",
        updatedAt: new Date().toISOString(),
        data: normalizedData
      };
    }

    function playerSafeData(tableData) {
      const publicData = normalizeData(tableData);
      return {
        ...publicData,
        masterNotes: [],
        clocks: [],
        masterFiles: [],
        players: publicData.players.map(character => ({
          ...character,
          secrets: []
        }))
      };
    }

    function publicCloudData(tableData) {
      const publicData = playerSafeData(tableData);
      publicData.masterVault = normalizeData(tableData).masterVault || null;
      return publicData;
    }

    function masterPrivatePayload(tableData) {
      const normalized = normalizeData(tableData);
      return {
        version: 1,
        masterNotes: normalized.masterNotes,
        clocks: normalized.clocks,
        masterFiles: normalized.masterFiles,
        characterSecrets: normalized.players.map(character => ({
          id: character.id,
          key: `${character.kind || ""}|${character.name || ""}|${character.character || ""}`.toLowerCase(),
          secrets: safeList(character.secrets)
        }))
      };
    }

    function applyMasterPrivatePayload(publicRawData, payload = {}) {
      const publicData = normalizeData(publicRawData || initialData);
      const privateData = {
        masterNotes: safeList(payload.masterNotes),
        clocks: safeList(payload.clocks),
        masterFiles: safeList(payload.masterFiles),
        characterSecrets: safeList(payload.characterSecrets)
      };
      const secretsById = new Map(privateData.characterSecrets.map(entry => [entry.id, safeList(entry.secrets)]));
      const secretsByKey = new Map(privateData.characterSecrets.map(entry => [String(entry.key || "").toLowerCase(), safeList(entry.secrets)]));
      return normalizeData({
        ...publicData,
        masterNotes: privateData.masterNotes,
        clocks: privateData.clocks,
        masterFiles: privateData.masterFiles,
        players: publicData.players.map(character => {
          const key = `${character.kind || ""}|${character.name || ""}|${character.character || ""}`.toLowerCase();
          return {
            ...character,
            secrets: secretsById.get(character.id) || secretsByKey.get(key) || []
          };
        })
      });
    }

    function mergeMasterLocalPrivateData(publicRawData, localRawData) {
      const publicData = normalizeData(publicRawData || initialData);
      const localData = normalizeData(localRawData || initialData);
      const secretsById = new Map(localData.players.map(character => [character.id, safeList(character.secrets)]));
      const secretsByName = new Map(localData.players.map(character => [
        `${character.kind || ""}|${character.name || ""}|${character.character || ""}`.toLowerCase(),
        safeList(character.secrets)
      ]));
      return normalizeData({
        ...publicData,
        masterNotes: localData.masterNotes,
        clocks: localData.clocks,
        masterFiles: localData.masterFiles,
        masterAccessHash: publicData.masterAccessHash || localData.masterAccessHash,
        players: publicData.players.map(character => {
          const nameKey = `${character.kind || ""}|${character.name || ""}|${character.character || ""}`.toLowerCase();
          return {
            ...character,
            secrets: secretsById.get(character.id) || secretsByName.get(nameKey) || []
          };
        })
      });
    }

    function bytesToBase64(bytes) {
      let binary = "";
      new Uint8Array(bytes).forEach(byte => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    }

    function base64ToBytes(value) {
      const binary = atob(String(value || ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

    async function deriveVaultKey(masterKey, saltBytes) {
      if (!crypto.subtle) {
        throw new Error("Criptografia segura indisponível neste navegador.");
      }
      const material = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(masterKey),
        "PBKDF2",
        false,
        ["deriveKey"]
      );
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }

    async function encryptMasterVault(payload, masterKey) {
      if (!masterKey) return null;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveVaultKey(masterKey, salt);
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
      return {
        version: 1,
        algorithm: "AES-GCM",
        kdf: "PBKDF2-SHA256",
        iterations: 120000,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        data: bytesToBase64(cipher)
      };
    }

    async function decryptMasterVault(vault, masterKey) {
      if (!vault || !masterKey) return null;
      const salt = base64ToBytes(vault.salt);
      const iv = base64ToBytes(vault.iv);
      const cipher = base64ToBytes(vault.data);
      const key = await deriveVaultKey(masterKey, salt);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return JSON.parse(new TextDecoder().decode(plain));
    }

    async function cloudDataForMaster(activeTable, tableData) {
      const publicData = publicCloudData(tableData);
      if (!activeTable?.masterKey) return publicData;
      try {
        publicData.masterVault = await encryptMasterVault(masterPrivatePayload(tableData), activeTable.masterKey);
      } catch (error) {
        console.warn("Cofre privado não foi criptografado neste endereço.", error);
        setSupabaseStatus("Chave criada. Cofre privado exige localhost ou HTTPS", "local");
      }
      return publicData;
    }

    async function masterDataFromCloud(remoteRawData, localRawData, masterKey = "") {
      const remoteData = normalizeData(remoteRawData || initialData);
      if (masterKey && remoteData.masterVault) {
        try {
          const payload = await decryptMasterVault(remoteData.masterVault, masterKey);
          return applyMasterPrivatePayload(remoteData, payload);
        } catch (error) {
          console.warn("Não foi possível abrir o cofre privado do Mestre.", error);
          setSupabaseStatus("Chave mestra não abriu o cofre privado", "error");
        }
      }
      return mergeMasterLocalPrivateData(remoteData, localRawData);
    }

    function readLocalValue(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn("Não foi possível ler os dados locais.", error);
        return null;
      }
    }

    function writeLocalValue(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn("Não foi possível salvar dados locais.", error);
        return false;
      }
    }

    function removeLocalValue(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn("Não foi possível remover dados locais.", error);
        return false;
      }
    }

    function loadContactAliases() {
      try {
        return JSON.parse(readLocalValue(contactAliasesStoreKey) || "{}");
      } catch {
        return {};
      }
    }

    function saveContactAliases() {
      writeLocalValue(contactAliasesStoreKey, JSON.stringify(contactAliases));
    }

    function loadSupabaseConfig() {
      try {
        const value = JSON.parse(readLocalValue(supabaseConfigStoreKey) || "{}");
        return {
          url: String(value.url || "").trim(),
          key: String(value.key || "").trim()
        };
      } catch {
        return { url: "", key: "" };
      }
    }

    function hasSupabaseConfig() {
      return Boolean(supabaseConfig.url && supabaseConfig.key);
    }

    function saveSupabaseConfig() {
      const urlInput = document.querySelector("#supabaseUrlInput");
      const keyInput = document.querySelector("#supabaseKeyInput");
      const url = String(urlInput?.value || "").trim().replace(/\/+$/, "");
      const key = String(keyInput?.value || "").trim();
      if (!url || !key) {
        setSupabaseStatus("Preencha URL e chave publica", "error");
        return false;
      }
      if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) {
        setSupabaseStatus("URL do Supabase parece invalida", "error");
        return false;
      }
      supabaseConfig = { url, key };
      supabaseClient = null;
      writeLocalValue(supabaseConfigStoreKey, JSON.stringify(supabaseConfig));
      fillSupabaseConfigForm();
      setSupabaseStatus("Supabase configurado", "synced");
      return true;
    }

    async function clearSupabaseConfig() {
      const confirmed = await askConfirm({
        title: "Limpar Supabase?",
        message: "Isso remove a configuração do Supabase apenas deste navegador.",
        confirmText: "Limpar",
        danger: true
      });
      if (!confirmed) return;
      supabaseConfig = { url: "", key: "" };
      supabaseClient = null;
      removeLocalValue(supabaseConfigStoreKey);
      fillSupabaseConfigForm();
      setSupabaseStatus("Supabase nao configurado", "local");
    }

    function fillSupabaseConfigForm() {
      [
        ["#supabaseUrlInput", supabaseConfig.url],
        ["#supabaseKeyInput", supabaseConfig.key]
      ].forEach(([selector, value]) => {
        const input = document.querySelector(selector);
        if (input) input.value = value || "";
      });
    }

    function updateSupabaseConfigStatus() {
      if (hasSupabaseConfig()) {
        setSupabaseStatus("Supabase configurado", "synced");
      } else {
        setSupabaseStatus("Supabase nao configurado", "local");
      }
    }

    function contactDisplayName(target) {
      return contactAliases[target.id] || target.npcName;
    }

    function loadTableRegistry() {
      const saved = readLocalValue(tablesStoreKey);
      try {
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) return parsed.map(table => ({
          ...table,
          id: table.id || createId(),
          name: table.name || table.data?.campaign?.name || "Mesa sem nome",
          role: table.role === "player" ? "player" : "master",
          playerName: table.playerName || "",
          masterKey: table.masterKey || "",
          onlineId: table.onlineId || "",
          updatedAt: table.updatedAt || new Date().toISOString(),
          data: normalizeData(table.data || initialData)
        }));
      } catch {
      }
      const legacy = readLocalValue(legacyStoreKey);
      if (!legacy) return [];
      try {
        const legacyData = normalizeData({ ...initialData, ...JSON.parse(legacy) });
        return [createTableRecord(legacyData.campaign.name || "Mesa antiga", "master", legacyData)];
      } catch {
        return [];
      }
    }

    function saveTableRegistry() {
      const payload = JSON.stringify(tableRegistry);
      try {
        if (!writeLocalValue(tablesStoreKey, payload)) throw new Error("Sem espaço para salvar a lista de mesas.");
        removeLocalValue(legacyStoreKey);
        return true;
      } catch (error) {
        const legacyData = readLocalValue(legacyStoreKey);
        if (legacyData) {
          try {
            removeLocalValue(legacyStoreKey);
            if (!writeLocalValue(tablesStoreKey, payload)) throw new Error("Sem espaço para salvar a lista de mesas.");
            return true;
          } catch (retryError) {
            writeLocalValue(legacyStoreKey, legacyData);
            console.warn("Não foi possível migrar os dados antigos para a lista de mesas.", retryError);
            return false;
          }
        }
        console.warn("Não foi possível salvar a lista de mesas neste navegador.", error);
        return false;
      }
    }

    function getActiveTable() {
      return tableRegistry.find(table => table.id === activeTableId) || null;
    }

    function loadData() {
      const activeTable = getActiveTable();
      return activeTable ? normalizeData(activeTable.data) : normalizeData(initialData);
    }

    function safeList(value) {
      return Array.isArray(value) ? value : [];
    }

    function normalizeInventoryItem(item) {
      if (typeof item === "string") {
        return { id: createId(), name: item, description: "", image: "", owner: "" };
      }
      return {
        id: item.id || createId(),
        name: item.name || item.title || "Item sem nome",
        description: item.description || item.body || "",
        image: item.image || item.cover || "",
        owner: item.owner || ""
      };
    }

    function normalizePlayerRelation(item) {
      return {
        id: item?.id || createId(),
        targetId: item?.targetId || "",
        name: item?.name || item?.title || "Relação sem nome",
        type: item?.type || item?.state || "Neutro",
        notes: item?.notes || item?.body || "",
        owner: item?.owner || ""
      };
    }

    function normalizePlayerFile(item) {
      return {
        id: item?.id || createId(),
        title: item?.title || item?.name || "Arquivo sem nome",
        notes: item?.notes || item?.body || "",
        image: item?.image || item?.cover || "",
        owner: item?.owner || ""
      };
    }

    function normalizeMasterFile(item) {
      return {
        id: item?.id || createId(),
        title: item?.title || item?.name || "Arquivo sem nome",
        notes: item?.notes || item?.body || "",
        image: item?.image || item?.cover || ""
      };
    }

    function currentPlayerOwner() {
      const table = getActiveTable();
      if (table?.role === "player") return table.playerName || "";
      if (table?.role === "master") return activeMasterPlayerName || "";
      return "";
    }

    function normalizeAllowedContacts(value) {
      return safeList(value).map(entry => {
        if (typeof entry === "string") return { playerName: "", targetId: entry };
        return {
          playerName: entry.playerName || "",
          targetId: entry.targetId || entry.contactId || entry.id || ""
        };
      }).filter(entry => entry.targetId);
    }

    function contactAllowedForPlayer(targetId, playerName = currentPlayerOwner()) {
      const rules = normalizeAllowedContacts(data.allowedContacts);
      return rules.some(rule => rule.targetId === targetId && (!rule.playerName || rule.playerName === playerName));
    }

    function playerNamesForTarget(targetId) {
      return normalizeAllowedContacts(data.allowedContacts)
        .filter(rule => rule.targetId === targetId && rule.playerName)
        .map(rule => rule.playerName);
    }

    function upsertPlayerProfile(name) {
      const playerName = String(name || "").trim();
      if (!playerName) return;
      if (safeList(data.hiddenPlayerProfiles).includes(playerName.toLowerCase())) return;
      data.playerProfiles = safeList(data.playerProfiles);
      if (!data.playerProfiles.some(profile => profile.name === playerName)) {
        data.playerProfiles.push({ id: createId(), name: playerName, pinHash: "", cover: "", sheetImage: "" });
      }
    }

    function mergePlayerProfileNames(names = []) {
      const before = safeList(data.playerProfiles).length;
      names.forEach(name => upsertPlayerProfile(name));
      return safeList(data.playerProfiles).length > before;
    }

    function itemBelongsToCurrentPlayer(item) {
      const owner = currentPlayerOwner();
      if (!owner) return true;
      return !item.owner || item.owner === owner;
    }

    function persistLocalData() {
      try {
        const activeTable = getActiveTable();
        if (!activeTable) return false;
        activeTable.data = normalizeData(data);
        activeTable.name = activeTable.data.campaign.name || activeTable.name || "Mesa sem nome";
        activeTable.updatedAt = new Date().toISOString();
        saveTableRegistry();
        return true;
      } catch (error) {
        console.warn("Não foi possível salvar todos os dados neste navegador.", error);
        return false;
      }
    }

    function normalizeData(rawData) {
      const next = {
        ...initialData,
        ...rawData,
        campaign: { ...initialData.campaign, ...(rawData.campaign || {}) },
        sessions: safeList(rawData.sessions).map(session => ({
          ...session,
          id: session.id || createId(),
          title: session.title || "Sessão",
          date: session.date || "",
          diary: session.diary || "",
          playerDiaries: { ...(session.playerDiaries || {}) }
        })),
        masterNotes: safeList(rawData.masterNotes),
        clocks: safeList(rawData.clocks),
        players: safeList(rawData.players),
        playerInventory: safeList(rawData.playerInventory).map(normalizeInventoryItem),
        playerRelations: safeList(rawData.playerRelations).map(normalizePlayerRelation),
        playerFiles: safeList(rawData.playerFiles).map(normalizePlayerFile),
        masterFiles: safeList(rawData.masterFiles).map(normalizeMasterFile),
        hiddenPlayerProfiles: [...new Set(safeList(rawData.hiddenPlayerProfiles).filter(name => typeof name === "string").map(name => name.trim().toLowerCase()).filter(Boolean))],
        playerProfiles: safeList(rawData.playerProfiles).map(profile => ({
          id: profile.id || createId(),
          name: profile.name || "Personagem sem nome",
          pinHash: profile.pinHash || "",
          cover: profile.cover || "",
          sheetImage: profile.sheetImage || ""
        })),
        masterAccessHash: rawData.masterAccessHash || "",
        masterVault: rawData.masterVault || null,
        board: safeList(rawData.board).map(item => ({
          ...item,
          id: item.id || createId(),
          owner: item.owner || ""
        })),
        allowedContacts: normalizeAllowedContacts(rawData.allowedContacts),
        messageGroups: safeList(rawData.messageGroups).map(group => ({
          id: group.id || createId(),
          name: group.name || "Grupo sem nome",
          npcIds: safeList(group.npcIds),
          playerNames: safeList(group.playerNames)
        })),
        library: safeList(rawData.library)
      };

      const npcNames = ["isaac", "isaac barros", "samira"];
      const migratedCharacters = [];
      next.players = next.players.map(player => ({
        ...player,
        id: player.id || createId(),
        kind: player.kind || "Jogador",
        secrets: safeList(player.secrets),
        annotations: player.annotations || "",
        playerAnnotations: { ...(player.playerAnnotations || {}) },
        inventory: safeList(player.inventory),
        sheetImage: player.sheetImage || "",
        photos: safeList(player.photos)
      })).filter(player => {
        const key = `${player.name || ""} ${player.character || ""}`.toLowerCase();
        const shouldMove = player.kind !== "NPC" && npcNames.some(name => key.includes(name));
        if (shouldMove) {
          migratedCharacters.push({
            id: createId(),
            kind: "NPC",
            name: player.name || "NPC",
            character: player.character || player.name,
            focus: player.focus || "",
            state: player.state || "Suspeito",
            notes: player.notes || "NPC migrado da antiga área de jogadores.",
            cover: player.cover || "",
            secrets: player.secrets || [],
            annotations: player.annotations || "",
            playerAnnotations: player.playerAnnotations || {},
            inventory: player.inventory || [],
            sheetImage: player.sheetImage || "",
            photos: player.photos || []
          });
        }
        return !shouldMove;
      });

      next.library = next.library.filter(item => {
        if (item.type === "NPC") {
          migratedCharacters.push({
            id: createId(),
            kind: "NPC",
            name: "NPC",
            character: item.title,
            focus: "",
            state: "Em dia",
            notes: item.body || "",
            cover: item.cover || "",
            secrets: item.secrets || [],
            annotations: item.annotations || "",
            playerAnnotations: item.playerAnnotations || {},
            inventory: item.inventory || [],
            sheetImage: item.sheetImage || "",
            photos: item.photos || []
          });
          return false;
        }
        return true;
      });

      const existingCharacters = new Set(next.players.map(item => String(item.character || "").toLowerCase()));
      migratedCharacters.forEach(character => {
        const key = String(character.character || "").toLowerCase();
        if (key && !existingCharacters.has(key)) {
          next.players.unshift(character);
          existingCharacters.add(key);
        }
      });

      next.library = next.library.map(item => ({
        ...item,
        id: item.id || createId(),
        cover: item.cover || ""
      }));

      if (!next.playerInventory.length) {
        next.playerInventory = next.players.flatMap(player => safeList(player.inventory)).map(normalizeInventoryItem);
      }

      return next;
    }

    function save() {
      persistLocalData();
      render();
      scheduleCloudTableSave();
    }

    function setSupabaseStatus(text, state = "local") {
      [document.querySelector("#supabaseStatus")]
        .filter(Boolean)
        .forEach(status => {
          status.textContent = text;
          status.classList.toggle("local", state === "local");
          status.classList.toggle("error", state === "error");
        });
    }

    function setMessageStatus(text, state = "local") {
      const status = document.querySelector("#messageStatus");
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("local", state === "local");
      status.classList.toggle("error", state === "error");
    }


    function setDialogError(id, text = "") {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = text;
      element.classList.toggle("hidden", !text);
    }

    function openCreateTableModal() {
      setDialogError("createTableError");
      document.querySelector("#createTableNameInput").value = "Nova mesa";
      document.querySelector("#createTableModal").classList.remove("hidden");
      document.querySelector("#createTableNameInput").focus();
      document.querySelector("#createTableNameInput").select();
    }

    function closeCreateTableModal() {
      document.querySelector("#createTableModal").classList.add("hidden");
    }

    function openJoinTableModal() {
      setDialogError("joinTableError");
      pendingJoinInvite = null;
      ["joinInviteInput", "joinCharacterNameInput", "joinPinInput", "joinPinConfirmInput"].forEach(id => {
        document.getElementById(id).value = "";
      });
      document.querySelector("#joinInviteInput").readOnly = false;
      document.querySelector("#joinTableIntro").textContent = "Cole o convite recebido para continuar.";
      document.querySelector("#joinDetailsHint").textContent = "Depois que o convite for validado, o app pede personagem e PIN se for jogador.";
      document.querySelector("#joinCharacterNameBox").classList.add("hidden");
      document.querySelector("#joinPinBox").classList.add("hidden");
      document.querySelector("#joinPinConfirmBox").classList.add("hidden");
      document.querySelector("#confirmJoinTableModal").textContent = "Continuar";
      document.querySelector("#joinTableModal").classList.remove("hidden");
      document.querySelector("#joinInviteInput").focus();
    }

    function closeJoinTableModal() {
      document.querySelector("#joinTableModal").classList.add("hidden");
      pendingJoinInvite = null;
    }

    function openInviteModal({ title = "Convite gerado", intro = "Envie este código para quem vai entrar na mesa.", code = "" } = {}) {
      lastInviteCode = code;
      document.querySelector("#inviteModalTitle").textContent = title;
      document.querySelector("#inviteModalIntro").textContent = intro;
      document.querySelector("#inviteOutput").textContent = code;
      setDialogError("inviteCopyStatus");
      document.querySelector("#inviteModal").classList.remove("hidden");
    }

    function closeInviteModal() {
      document.querySelector("#inviteModal").classList.add("hidden");
    }

    function closeQuickModal(result = null) {
      document.querySelector("#quickModal").classList.add("hidden");
      const resolver = quickModalResolve;
      quickModalResolve = null;
      if (resolver) resolver(result);
    }

    function openQuickModal(options = {}) {
      const {
        title = "Confirmar ação",
        message = "",
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        danger = false,
        input = false,
        inputLabel = "Valor",
        inputValue = "",
        inputPlaceholder = "",
        inputType = "text"
      } = options;
      document.querySelector("#quickModalTitle").textContent = title;
      document.querySelector("#quickModalIntro").textContent = message;
      document.querySelector("#quickModalConfirm").textContent = confirmText;
      document.querySelector("#quickModalCancel").textContent = cancelText;
      document.querySelector("#quickModalCancel").classList.toggle("hidden", !cancelText);
      document.querySelector("#quickModalConfirm").classList.toggle("danger", danger);
      document.querySelector("#quickModalConfirm").classList.toggle("primary", !danger);
      const inputBox = document.querySelector("#quickModalInputBox");
      const inputElement = document.querySelector("#quickModalInput");
      inputBox.classList.toggle("hidden", !input);
      document.querySelector("#quickModalInputLabel").textContent = inputLabel;
      inputElement.value = inputValue;
      inputElement.type = inputType;
      inputElement.placeholder = inputPlaceholder;
      document.querySelector("#quickModal").classList.remove("hidden");
      if (input) {
        requestAnimationFrame(() => {
          inputElement.focus();
          inputElement.select();
        });
      }
      return new Promise(resolve => {
        quickModalResolve = resolve;
      });
    }

    function askConfirm(options) {
      return openQuickModal(options);
    }

    async function askInput(options) {
      const result = await openQuickModal({ ...options, input: true });
      return result === null ? null : String(result || "");
    }

    function showAppNotice(title, message) {
      return openQuickModal({
        title,
        message,
        confirmText: "OK",
        cancelText: "",
        danger: false
      });
    }

    async function copyTextToClipboard(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }


    function getMessageTargets() {
      const table = getActiveTable();
      if (table?.role === "master") return getMasterMessageTargets();
      const owner = currentPlayerOwner();
      const contacts = safeList(data.players)
        .filter(character => (character.kind || "").toLowerCase() === "npc")
        .filter(character => table?.role === "master" || contactAllowedForPlayer(character.id, owner))
        .map(character => ({
          id: `npc:${character.id}:${owner}`,
          type: "npc",
          npcId: character.id,
          playerName: owner,
          npcName: character.character || character.name || "NPC sem nome",
          label: character.name || "NPC",
          allowed: contactAllowedForPlayer(character.id, owner),
          conversationKey: conversationKeyForTarget("npc", character.id),
          replyNpcIds: [character.id]
        }));
      const groups = safeList(data.messageGroups)
        .filter(group => table?.role === "master" || safeList(group.playerNames).includes(owner))
        .map(group => ({
          id: `group:${group.id}:${owner}`,
          type: "group",
          groupId: group.id,
          playerName: owner,
          npcName: group.name,
          label: `${group.npcIds.length} NPCs`,
          allowed: true,
          conversationKey: conversationKeyForTarget("group", group.id),
          replyNpcIds: group.npcIds
        }));
      return [...contacts, ...groups];
    }

    function allMessageContacts() {
      return safeList(data.players)
        .filter(character => (character.kind || "").toLowerCase() === "npc")
        .map(character => ({
          id: `npc:${character.id}`,
          type: "npc",
          npcId: character.id,
          npcName: character.character || character.name || "NPC sem nome",
          label: character.name || "NPC",
          allowed: playerNamesForTarget(character.id).length > 0,
          conversationKey: conversationKeyForTarget("npc", character.id),
          replyNpcIds: [character.id]
        }));
    }

    function conversationKeyForTarget(type, id) {
      const owner = currentPlayerOwner();
      return `${type}:${id}:${owner || "mesa"}`;
    }

    function getActiveMessageTarget() {
      const targets = getMessageTargets();
      return targets.find(target => target.id === activeMessageTargetId) || targets.find(target => target.npcName === activeMessageNpc) || targets[0] || null;
    }

    function getMasterMessageTargets() {
      const profiles = playerSheetProfiles();
      const npcs = safeList(data.players).filter(character => (character.kind || "").toLowerCase() === "npc");
      const selectedProfiles = profiles.length
        ? profiles.filter(profile => profile.name === activeMasterPlayerName || !activeMasterPlayerName)
        : [{ name: "Mesa" }];
      const visibleProfiles = selectedProfiles.length ? selectedProfiles : profiles.slice(0, 1);
      const contacts = visibleProfiles.flatMap(profile => npcs.map(character => ({
        id: `npc:${character.id}:${profile.name}`,
        type: "npc",
        npcId: character.id,
        playerName: profile.name,
        npcName: character.character || character.name || "NPC sem nome",
        label: `${character.name || "NPC"} · ${profile.name}`,
        allowed: contactAllowedForPlayer(character.id, profile.name),
        conversationKey: `npc:${character.id}:${profile.name}`,
        replyNpcIds: [character.id]
      })));
      const groups = safeList(data.messageGroups).flatMap(group => {
        const players = safeList(group.playerNames).filter(playerName => !activeMasterPlayerName || playerName === activeMasterPlayerName);
        if (activeMasterPlayerName && !players.length) return [];
        return (players.length ? players : ["Mesa"]).map(playerName => ({
          id: `group:${group.id}:${playerName}`,
          type: "group",
          groupId: group.id,
          playerName,
          npcName: group.name,
          label: `${group.npcIds.length} NPCs · ${playerName}`,
          allowed: true,
          conversationKey: `group:${group.id}:${playerName}`,
          replyNpcIds: group.npcIds
        }));
      });
      return [...contacts, ...groups];
    }

    function renderMasterPlayerSwitch(activeTarget = null) {
      const table = getActiveTable();
      const box = document.querySelector("#masterPlayerSwitch");
      const select = document.querySelector("#masterPlayerSelect");
      if (table?.role !== "master" || !activeTarget || activeTarget.type === "group") {
        box.style.display = "none";
        return;
      }
      const profiles = playerSheetProfiles();
      if (!profiles.length) {
        activeMasterPlayerName = "";
        box.style.display = "none";
        return;
      }
      if (!activeMasterPlayerName || !profiles.some(profile => profile.name === activeMasterPlayerName)) {
        activeMasterPlayerName = profiles[0].name;
      }
      select.innerHTML = profiles.map(profile => `<option value="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</option>`).join("");
      select.value = activeMasterPlayerName;
      box.style.display = "block";
    }

    function renderMessagesView() {
      const table = getActiveTable();
      const app = document.querySelector("#messageApp");
      const list = document.querySelector("#conversationList");
      const thread = document.querySelector("#messageThread");
      if (table?.role === "master" && table.onlineId) {
        syncParticipantsFromCloud({ rerender: true });
      }
      const targets = getMessageTargets();
      renderMasterPlayerSwitch(null);
      app.classList.toggle("chat-open", messageChatOpen);
      document.body.classList.toggle("mobile-chat-open", messageChatOpen);
      if (!table?.onlineId) {
        messageChatOpen = false;
        app.classList.remove("chat-open");
        document.body.classList.remove("mobile-chat-open");
        list.innerHTML = empty("Entre em uma mesa por código para usar mensagens.");
        thread.innerHTML = empty("Mensagens usam a nuvem da mesa.");
        document.querySelector("#messageTitle").textContent = "Mesa sem conexão";
        document.querySelector("#messageIntro").textContent = "Crie ou entre em uma mesa online primeiro.";
        setMessageStatus("Sem mesa online", "error");
        return;
      }
      if (!targets.length) {
        messageChatOpen = false;
        app.classList.remove("chat-open");
        document.body.classList.remove("mobile-chat-open");
        const hasNpcs = allMessageContacts().length > 0;
        list.innerHTML = empty(hasNpcs ? "Nenhum contato liberado pelo Mestre ainda." : "Cadastre NPCs em Personagens para abrir conversas.");
        thread.innerHTML = empty(hasNpcs ? "Seu celular ainda não tem contatos." : "Nenhum NPC disponível.");
        document.querySelector("#messageTitle").textContent = hasNpcs ? "Sem contatos" : "Sem NPCs";
        document.querySelector("#messageIntro").textContent = hasNpcs ? "O Mestre precisa liberar contatos para este celular." : "Adicione NPCs na aba Personagens.";
        setMessageStatus(hasNpcs ? "Sem contatos liberados" : "Sem NPCs", "local");
        return;
      }
      if (!activeMessageTargetId || !targets.some(target => target.id === activeMessageTargetId)) {
        activeMessageTargetId = targets[0].id;
        activeMessageNpc = targets[0].npcName;
        activeConversationId = "";
      }
      const activeTarget = getActiveMessageTarget();
      renderMasterPlayerSwitch(activeTarget);
      list.innerHTML = targets.map(target => `
        <button class="conversation-card ${target.id === activeMessageTargetId ? "active" : ""}" data-message-target-id="${target.id}">
          <span class="contact-row">
            <span class="contact-copy">
              <strong>${escapeHtml(contactDisplayName(target))}</strong>
              <small>${escapeHtml(target.label)}</small>
            </span>
            <span class="contact-actions">
              ${table.role === "master" && target.type === "npc" ? `
                ${target.allowed ? '<span class="contact-pill">Liberado</span>' : ""}
                <span class="contact-toggle ${target.allowed ? "block" : ""}" data-contact-toggle-id="${target.npcId}" data-contact-toggle-player="${escapeHtml(target.playerName || "")}">
                  ${target.allowed ? "Bloquear" : "Liberar"}
                </span>
              ` : ""}
              ${(table.role === "master" && target.type === "group") || table.role === "player" ? `
                <span class="contact-menu-btn" data-contact-menu-id="${target.id}" title="Opções">⋯</span>
              ` : ""}
            </span>
          </span>
        </button>
      `).join("");
      list.querySelectorAll("[data-contact-toggle-id]").forEach(toggle => {
        toggle.addEventListener("click", event => {
          event.stopPropagation();
          toggleContactPermission(toggle.dataset.contactToggleId, toggle.dataset.contactTogglePlayer || "");
        });
      });
      list.querySelectorAll("[data-message-target-id]").forEach(button => {
        button.addEventListener("click", () => {
          const target = targets.find(item => item.id === button.dataset.messageTargetId);
          if (target) selectMessageTarget(target);
        });
      });
      list.querySelectorAll("[data-contact-menu-id]").forEach(menu => {
        menu.addEventListener("click", event => {
          event.stopPropagation();
          const target = targets.find(item => item.id === menu.dataset.contactMenuId);
          if (target) openConversationOptions(target);
        });
      });
      document.querySelector("#messageTitle").textContent = activeTarget ? contactDisplayName(activeTarget) : activeMessageNpc;
      document.querySelector("#messageIntro").textContent = table.role === "master"
        ? (activeTarget?.type === "group" ? "Escolha qual NPC vai responder neste grupo." : `Responder como ${activeTarget?.npcName || activeMessageNpc}.`)
        : `Enviar mensagem para ${activeTarget?.npcName || activeMessageNpc}.`;
      renderReplyAsSelector(activeTarget);
      document.querySelector("#openGroupModal").classList.toggle("hidden", table.role !== "master");
    }

    async function selectMessageTarget(target) {
      activeMessageTargetId = target.id;
      activeMessageNpc = target.npcName;
      activeConversationId = "";
      messageChatOpen = true;
      renderMessagesView();
      await loadConversationMessages();
      startMessageAutoRefresh();
    }

    function toggleContactPermission(characterId, playerName = "") {
      const table = getActiveTable();
      if (table?.role !== "master") return;
      const rules = normalizeAllowedContacts(data.allowedContacts);
      const exists = rules.some(rule => rule.targetId === characterId && rule.playerName === playerName);
      if (exists) {
        data.allowedContacts = rules.filter(rule => !(rule.targetId === characterId && rule.playerName === playerName));
      } else {
        data.allowedContacts = [...rules, { playerName, targetId: characterId }];
      }
      renderMessagesView();
      save();
      setMessageStatus(exists ? "Contato bloqueado" : "Contato liberado", "synced");
    }

    async function openConversationOptions(target) {
      const table = getActiveTable();
      if (table?.role === "master" && target.type === "group") {
        const confirmed = await askConfirm({
          title: "Excluir grupo?",
          message: `O grupo "${target.npcName}" será removido desta mesa.`,
          confirmText: "Excluir grupo",
          danger: true
        });
        if (!confirmed) return;
        data.messageGroups = safeList(data.messageGroups).filter(group => group.id !== target.groupId);
        if (activeMessageTargetId === target.id) {
          activeMessageTargetId = "";
          activeMessageNpc = "";
          activeConversationId = "";
          messageChatOpen = false;
        }
        save();
        renderMessagesView();
        setMessageStatus("Grupo excluido", "synced");
        return;
      }
      if (table?.role === "player") {
        const current = contactDisplayName(target);
        const alias = await askInput({
          title: "Renomear contato",
          message: "Esse nome muda só neste dispositivo.",
          inputLabel: "Nome do contato",
          inputValue: current,
          inputPlaceholder: target.npcName,
          confirmText: "Salvar"
        });
        if (alias === null) return;
        const trimmed = alias.trim();
        if (trimmed && trimmed !== target.npcName) {
          contactAliases[target.id] = trimmed;
        } else {
          delete contactAliases[target.id];
        }
        saveContactAliases();
        renderMessagesView();
        setMessageStatus("Nome atualizado neste dispositivo", "synced");
      }
    }

    function renderReplyAsSelector(target) {
      const table = getActiveTable();
      const box = document.querySelector("#replyAsBox");
      const select = document.querySelector("#replyAsSelect");
      if (table?.role !== "master" || !target) {
        box.classList.add("hidden");
        return;
      }
      const npcIds = target.type === "group" ? target.replyNpcIds : [target.npcId];
      const npcs = safeList(data.players).filter(player => npcIds.includes(player.id));
      if (!npcs.length) {
        box.classList.add("hidden");
        return;
      }
      if (!replyAsNpcId || !npcs.some(npc => npc.id === replyAsNpcId)) {
        replyAsNpcId = npcs[0].id;
      }
      select.innerHTML = npcs.map(npc => `<option value="${escapeHtml(npc.id)}">${escapeHtml(npc.character || npc.name || "NPC")}</option>`).join("");
      select.value = replyAsNpcId;
      box.classList.toggle("hidden", target.type !== "group" && npcs.length <= 1);
    }

    function closeMessageChat() {
      messageChatOpen = false;
      renderMessagesView();
      stopMessageAutoRefresh();
    }

    async function ensureConversation() {
      const table = getActiveTable();
      const client = getSupabaseClient();
      const target = getActiveMessageTarget();
      if (!client || !table?.onlineId || !target) return null;
      if (activeConversationId) return activeConversationId;
      const { data: existing, error: readError } = await client
        .from("mesa_arcana_conversations")
        .select("id")
        .eq("table_id", table.onlineId)
        .eq("npc_name", target.conversationKey)
        .limit(1);
      if (readError) throw readError;
      if (existing?.[0]?.id) {
        activeConversationId = existing[0].id;
        return activeConversationId;
      }
      const { data: created, error: createError } = await client
        .from("mesa_arcana_conversations")
        .insert({
          table_id: table.onlineId,
          npc_name: target.conversationKey,
          player_name: table.role === "master" ? "Mesa" : "Jogador",
          title: target.npcName
        })
        .select("id")
        .single();
      if (createError) throw createError;
      activeConversationId = created.id;
      return activeConversationId;
    }

    async function loadConversationMessages(options = {}) {
      const { silent = false } = options;
      const thread = document.querySelector("#messageThread");
      const table = getActiveTable();
      const client = getSupabaseClient();
      if (!client || !table?.onlineId || !getActiveMessageTarget()) return;
      if (!silent) setMessageStatus("Carregando conversa...");
      try {
        const conversationId = await ensureConversation();
        if (!conversationId) return;
        const { data: messages, error } = await client
          .from("mesa_arcana_messages")
          .select("id,sender_role,sender_name,body,created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        thread.innerHTML = messages?.length
          ? messages.map(message => `
            <article class="message-bubble ${message.sender_role === "player" ? "player" : "npc"}">
              <small>${escapeHtml(message.sender_name)} · ${formatMessageTime(message.created_at)}</small>
              ${escapeHtml(message.body)}
            </article>
          `).join("")
          : empty("Nenhuma mensagem ainda.");
        thread.scrollTop = thread.scrollHeight;
        if (!silent) setMessageStatus("Conversa atualizada", "synced");
      } catch (error) {
        console.warn("Erro ao carregar mensagens.", error);
        setMessageStatus("Erro nas mensagens", "error");
      }
    }

    async function sendConversationMessage() {
      const table = getActiveTable();
      const client = getSupabaseClient();
      const input = document.querySelector("#messageBody");
      const body = input.value.trim();
      const target = getActiveMessageTarget();
      if (!client || !table?.onlineId || !target || !body) return;
      setMessageStatus("Enviando mensagem...");
      try {
        const conversationId = await ensureConversation();
        const senderRole = table.role === "master" ? "npc" : "player";
        const replyNpc = safeList(data.players).find(player => player.id === replyAsNpcId);
        const senderName = table.role === "master" ? (replyNpc?.character || replyNpc?.name || target.npcName) : (table.playerName || "Jogador");
        const { error } = await client
          .from("mesa_arcana_messages")
          .insert({
            conversation_id: conversationId,
            table_id: table.onlineId,
            sender_role: senderRole,
            sender_name: senderName,
            body
          });
        if (error) throw error;
        await client
          .from("mesa_arcana_conversations")
          .update({ title: target.npcName })
          .eq("id", conversationId);
        input.value = "";
        await loadConversationMessages();
      } catch (error) {
        console.warn("Erro ao enviar mensagem.", error);
        setMessageStatus("Erro ao enviar", "error");
      }
    }

    function formatMessageTime(value) {
      if (!value) return "";
      return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    async function registerTableParticipant(table) {
      const client = getSupabaseClient();
      if (!client || !table?.onlineId || table.role !== "player" || !table.playerName) return;
      try {
        await client
          .from("mesa_arcana_participants")
          .delete()
          .eq("table_id", table.onlineId)
          .eq("display_name", table.playerName)
          .eq("role", "player")
          .eq("device_key", table.id);
        await client
          .from("mesa_arcana_participants")
          .insert({
            table_id: table.onlineId,
            display_name: table.playerName,
            role: "player",
            device_key: table.id
          });
      } catch (error) {
        console.warn("Não foi possível registrar participante.", error);
      }
    }

    async function syncParticipantsFromCloud(options = {}) {
      const { force = false, rerender = false } = options;
      const table = getActiveTable();
      const client = getSupabaseClient();
      if (!client || table?.role !== "master" || !table.onlineId || isSyncingParticipants) return false;
      const now = Date.now();
      if (!force && now - lastParticipantSyncAt < 5000) return false;
      isSyncingParticipants = true;
      lastParticipantSyncAt = now;
      try {
        const { data: participants, error } = await client
          .from("mesa_arcana_participants")
          .select("display_name,role")
          .eq("table_id", table.onlineId)
          .eq("role", "player");
        if (error) throw error;
        const changed = mergePlayerProfileNames(safeList(participants).map(item => item.display_name));
        if (changed) {
          table.data = normalizeData(data);
          saveTableRegistry();
          if (rerender) renderMessagesView();
        }
        return changed;
      } catch (error) {
        console.warn("Não foi possível carregar jogadores da mesa.", error);
        return false;
      } finally {
        isSyncingParticipants = false;
      }
    }

    async function openGroupModal() {
      await syncParticipantsFromCloud({ force: true });
      const npcs = allMessageContacts();
      const profiles = playerSheetProfiles();
      document.querySelector("#groupName").value = "";
      document.querySelector("#groupNpcOptions").innerHTML = npcs.length
        ? npcs.map(npc => `
          <label class="group-option">
            <input type="checkbox" value="${escapeHtml(npc.npcId)}">
            <span>${escapeHtml(npc.npcName)}</span>
          </label>
        `).join("")
        : empty("Cadastre NPCs antes de criar grupos.");
      document.querySelector("#groupPlayerOptions").innerHTML = profiles.length
        ? profiles.map(profile => `
          <label class="group-option">
            <input type="checkbox" value="${escapeHtml(profile.name)}" ${profile.name === activeMasterPlayerName ? "checked" : ""}>
            <span>${escapeHtml(profile.name)}</span>
          </label>
        `).join("")
        : empty("Jogadores aparecem aqui quando entram na mesa.");
      document.querySelector("#groupModal").classList.remove("hidden");
      document.querySelector("#groupName").focus();
    }

    function closeGroupModal() {
      document.querySelector("#groupModal").classList.add("hidden");
    }

    function saveMessageGroup() {
      const table = getActiveTable();
      if (table?.role !== "master") return;
      const npcIds = [...document.querySelectorAll("#groupNpcOptions input:checked")].map(input => input.value);
      const playerNames = [...document.querySelectorAll("#groupPlayerOptions input:checked")].map(input => input.value);
      let name = document.querySelector("#groupName").value.trim();
      if (!npcIds.length) {
        setMessageStatus("Escolha pelo menos um NPC", "error");
        showAppNotice("Grupo incompleto", "Escolha pelo menos um NPC para criar o grupo.");
        return;
      }
      if (!playerNames.length) {
        setMessageStatus("Escolha pelo menos um jogador", "error");
        showAppNotice("Grupo incompleto", "Escolha pelo menos um jogador para criar o grupo.");
        return;
      }
      if (!name) {
        const selectedNpcs = safeList(data.players)
          .filter(player => npcIds.includes(player.id))
          .map(player => player.character || player.name)
          .filter(Boolean);
        name = selectedNpcs.length > 1 ? "Grupo" : `Conversa com ${selectedNpcs[0] || "NPC"}`;
      }
      const group = { id: createId(), name, npcIds, playerNames };
      data.messageGroups = safeList(data.messageGroups);
      data.messageGroups.push(group);
      const activeGroupPlayer = playerNames.includes(activeMasterPlayerName) ? activeMasterPlayerName : playerNames[0];
      activeMasterPlayerName = activeGroupPlayer;
      activeMessageTargetId = `group:${group.id}:${activeGroupPlayer}`;
      activeMessageNpc = group.name;
      activeConversationId = "";
      messageChatOpen = true;
      closeGroupModal();
      save();
      renderMessagesView();
      loadConversationMessages();
      setMessageStatus("Grupo criado", "synced");
    }


    function canAutoSaveCloud() {
      const activeTable = getActiveTable();
      return Boolean(activeTable && activeTable.role === "master" && activeTable.onlineId);
    }

    function getSupabaseClient() {
      if (supabaseClient) return supabaseClient;
      if (!hasSupabaseConfig()) {
        setSupabaseStatus("Configure o Supabase primeiro", "error");
        return null;
      }
      if (!window.supabase?.createClient) {
        setSupabaseStatus("Biblioteca não carregada", "error");
        return null;
      }
      supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.key);
      supabaseClient.auth.onAuthStateChange(event => {
        if (["SIGNED_OUT", "SIGNED_IN", "USER_UPDATED"].includes(event)) clearIndividualSecrets();
      });
      return supabaseClient;
    }

    async function testSupabaseConnection() {
      const client = getSupabaseClient();
      if (!client) return;
      setSupabaseStatus("Testando conexão...");
      try {
        const { error } = await client.auth.getSession();
        if (error) throw error;
        setSupabaseStatus("Supabase conectado", "synced");
      } catch (error) {
        console.warn("Erro ao conectar no Supabase.", error);
        setSupabaseStatus("Erro no Supabase", "error");
      }
    }

    function getOnlineTableOrWarn() {
      const activeTable = getActiveTable();
      if (!activeTable) {
        setSupabaseStatus("Abra ou crie uma mesa primeiro", "error");
        return null;
      }
      return activeTable;
    }

    async function createOnlineTable(options = {}) {
      const { showInvite = true } = options;
      const client = getSupabaseClient();
      const activeTable = getOnlineTableOrWarn();
      if (!client || !activeTable) return null;
      if (activeTable.role !== "master") {
        setSupabaseStatus("Apenas o Mestre cria a mesa online", "error");
        return null;
      }
      if (activeTable.onlineId) {
        setSupabaseStatus("Mesa online já criada", "synced");
        if (showInvite) {
          openInviteModal({
            title: "Convite de jogador",
            intro: "Envie este código para o jogador entrar na mesa.",
            code: createInviteCode(activeTable.onlineId)
          });
        }
        return activeTable.onlineId;
      }
      setSupabaseStatus("Criando mesa online...");
      try {
        await verifiedCloudUser(true);
        const cloudData = await cloudDataForMaster(activeTable, data);
        const payload = {
          name: activeTable.name || data.campaign.name || "Mesa sem nome",
          owner_label: activeTable.role === "master" ? "Mestre" : "Jogador",
          data: cloudData
        };
        const { data: created, error } = await client
          .from("mesa_arcana_tables")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        activeTable.onlineId = created.id;
        activeTable.data = normalizeData(data);
        activeTable.updatedAt = new Date().toISOString();
        saveTableRegistry();
        setSupabaseStatus("Mesa online criada", "synced");
        if (showInvite) {
          openInviteModal({
            title: "Mesa online criada",
            intro: "Envie este convite para o jogador entrar na mesa.",
            code: createInviteCode(created.id)
          });
        }
        return created.id;
      } catch (error) {
        console.warn("Erro ao criar mesa online.", error);
        setSupabaseStatus("Erro ao criar mesa online", "error");
        return null;
      }
    }

    async function createMasterInvite() {
      const client = getSupabaseClient();
      const activeTable = getOnlineTableOrWarn();
      if (!client || !activeTable) return;
      if (activeTable.role !== "master") {
        setSupabaseStatus("Apenas o Mestre gera chave mestra", "error");
        return;
      }
      if (!activeTable.onlineId) {
        const createdId = await createOnlineTable({ showInvite: false });
        if (!createdId) return;
      }
      const masterKey = createSecretToken("mestre");
      activeTable.masterKey = masterKey;
      data.masterAccessHash = await hashSecret(masterKey);
      activeTable.data = normalizeData(data);
      activeTable.updatedAt = new Date().toISOString();
      saveTableRegistry();
      try {
        const cloudData = await cloudDataForMaster(activeTable, data);
        const { error } = await client
          .from("mesa_arcana_tables")
          .update({ data: cloudData })
          .eq("id", activeTable.onlineId);
        if (error) throw error;
        setSupabaseStatus("Chave mestra gerada", "synced");
        openInviteModal({
          title: "Chave mestra",
          intro: "Use este código apenas nos seus dispositivos de Mestre.",
          code: createMasterInviteCode(activeTable.onlineId, masterKey)
        });
      } catch (error) {
        console.warn("Erro ao salvar chave mestra.", error);
        setSupabaseStatus("Erro ao gerar chave mestra", "error");
      }
    }

    async function saveOnlineTable() {
      if (isSavingCloud) return;
      const client = getSupabaseClient();
      const activeTable = getOnlineTableOrWarn();
      if (!client || !activeTable) return;
      window.clearTimeout(cloudSaveTimer);
      if (!activeTable.onlineId) {
        if (activeTable.role === "master") {
          await createOnlineTable();
        } else {
          setSupabaseStatus("Entre por codigo para salvar na nuvem", "error");
        }
        return;
      }
      setSupabaseStatus(activeTable.role === "master" ? "Salvando na nuvem..." : "Enviando alteracoes...");
      const saveVersion = cloudChangeVersion;
      isSavingCloud = true;
      try {
        const identity = await campaignIdentity(activeTable.onlineId);
        if (identity.role !== activeTable.role || (identity.role === "player" && identity.name !== activeTable.playerName)) throw new Error("Identidade local não corresponde à conta verificada.");
        let nextData = activeTable.role === "master" ? await cloudDataForMaster(activeTable, data) : normalizeData(data);
        if (activeTable.role === "player") {
          const { data: remoteTable, error: readError } = await client
            .from("mesa_arcana_tables")
            .select("data")
            .eq("id", activeTable.onlineId)
            .single();
          if (readError) throw readError;
          nextData = mergePlayerWritableData(remoteTable.data || initialData, data);
        }
        const payload = {
          name: activeTable.name || data.campaign.name || "Mesa sem nome",
          data: nextData
        };
        const { error } = await client
          .from("mesa_arcana_tables")
          .update(payload)
          .eq("id", activeTable.onlineId);
        if (error) throw error;
        if (saveVersion === cloudChangeVersion) activeTable.pendingCloudSave = false;
        activeTable.data = activeTable.role === "player" ? playerSafeData(nextData) : normalizeData(data);
        activeTable.updatedAt = new Date().toISOString();
        saveTableRegistry();
        setSupabaseStatus(activeTable.role === "master" ? "Mesa salva na nuvem" : "Alteracoes enviadas", "synced");
      } catch (error) {
        console.warn("Erro ao salvar mesa na nuvem.", error);
        setSupabaseStatus("Erro ao salvar na nuvem", "error");
      } finally {
        isSavingCloud = false;
        if (cloudChangeVersion !== saveVersion) scheduleCloudTableSave();
      }
    }

    function mergePlayerWritableData(remoteRawData, playerRawData) {
      const remoteData = normalizeData(remoteRawData || initialData);
      const playerData = normalizeData(playerRawData || initialData);
      const owner = currentPlayerOwner();
      return normalizeData({
        ...remoteData,
        sessions: mergeSessionDiaries(remoteData.sessions, playerData.sessions, owner),
        players: mergeCharacterAnnotations(remoteData.players, playerData.players, owner),
        playerInventory: mergeOwnedCollection(remoteData.playerInventory, playerData.playerInventory, owner),
        playerRelations: mergeOwnedCollection(remoteData.playerRelations, playerData.playerRelations, owner),
        playerFiles: mergeOwnedCollection(remoteData.playerFiles, playerData.playerFiles, owner),
        board: mergeOwnedCollection(remoteData.board, playerData.board, owner),
        playerProfiles: mergePlayerProfiles(remoteData.playerProfiles, playerData.playerProfiles),
        masterAccessHash: remoteData.masterAccessHash,
        masterVault: remoteData.masterVault,
        allowedContacts: remoteData.allowedContacts,
        messageGroups: remoteData.messageGroups,
        library: playerData.library
      });
    }

    function mergePlayerTextMap(remoteMap = {}, localMap = {}, owner = "") {
      if (!owner) return { ...(remoteMap || {}) };
      return {
        ...(remoteMap || {}),
        [owner]: (localMap || {})[owner] || ""
      };
    }

    function mergeSessionDiaries(remoteSessions, localSessions, owner) {
      const localById = new Map(safeList(localSessions).map(session => [session.id, session]));
      return safeList(remoteSessions).map(remoteSession => {
        const localSession = localById.get(remoteSession.id);
        if (!localSession || !owner) return remoteSession;
        return {
          ...remoteSession,
          playerDiaries: mergePlayerTextMap(remoteSession.playerDiaries, localSession.playerDiaries, owner)
        };
      });
    }

    function mergeCharacterAnnotations(remoteCharacters, localCharacters, owner) {
      const localById = new Map(safeList(localCharacters).map(character => [character.id, character]));
      return safeList(remoteCharacters).map(remoteCharacter => {
        const localCharacter = localById.get(remoteCharacter.id);
        if (!localCharacter || !owner) return remoteCharacter;
        return {
          ...remoteCharacter,
          ...([remoteCharacter.character, remoteCharacter.name].some(value => String(value || "").trim().toLowerCase() === owner.trim().toLowerCase()) && remoteCharacter.kind !== "NPC"
            ? { cover: localCharacter.cover || "", sheetImage: localCharacter.sheetImage || "" }
            : {}),
          playerAnnotations: mergePlayerTextMap(remoteCharacter.playerAnnotations, localCharacter.playerAnnotations, owner)
        };
      });
    }

    function mergePlayerProfiles(remoteProfiles, localProfiles) {
      const owner = currentPlayerOwner();
      const byName = new Map();
      [...safeList(remoteProfiles), ...safeList(localProfiles).filter(profile => profile.name === owner)].forEach(profile => {
        const name = String(profile.name || "").trim();
        if (!name) return;
        const current = byName.get(name) || { id: profile.id || createId(), name, pinHash: "", cover: "", sheetImage: "" };
        byName.set(name, {
          ...current,
          id: current.id || profile.id || createId(),
          name,
          pinHash: current.pinHash || profile.pinHash || "",
          cover: profile.cover || current.cover || "",
          sheetImage: profile.sheetImage || current.sheetImage || ""
        });
      });
      return [...byName.values()];
    }

    function mergeOwnedCollection(remoteItems, localItems, owner) {
      if (!owner) return localItems;
      const localOwned = safeList(localItems).filter(item => (item.owner || "") === owner);
      const remoteOthers = safeList(remoteItems).filter(item => (item.owner || "") !== owner);
      return [...localOwned, ...remoteOthers];
    }

    async function refreshOnlineTable(options = {}) {
      const { force = false, silent = false } = options;
      const client = getSupabaseClient();
      const activeTable = getOnlineTableOrWarn();
      if (!client || !activeTable || !activeTable.onlineId || isRefreshingCloud) return false;
      if (isSavingCloud) return false;
      if (activeTable.pendingCloudSave) {
        if (!force) return false;
        await saveOnlineTable();
        if (activeTable.pendingCloudSave) return false;
      }
      isRefreshingCloud = true;
      if (!silent) setSupabaseStatus("Carregando da nuvem...");
      try {
        const identity = await campaignIdentity(activeTable.onlineId);
        if (identity.role !== activeTable.role || (identity.role === "player" && identity.name !== activeTable.playerName)) throw new Error("Identidade local não corresponde à conta verificada.");
        const { data: remoteTable, error } = await client
          .from("mesa_arcana_tables")
          .select("id,name,data,updated_at")
          .eq("id", activeTable.onlineId)
          .single();
        if (error) throw error;
        const remoteUpdatedAt = remoteTable.updated_at || new Date().toISOString();
        const localUpdatedAt = activeTable.updatedAt || "";
        const hasRemoteChange = force || !localUpdatedAt || new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
        if (!hasRemoteChange) {
          if (!silent) setSupabaseStatus("Mesa já está atualizada", "synced");
          return false;
        }
        data = activeTable.role === "player"
          ? playerSafeData(remoteTable.data || initialData)
          : await masterDataFromCloud(remoteTable.data || initialData, activeTable.data || data, activeTable.masterKey || "");
        activeTable.onlineId = remoteTable.id;
        activeTable.name = remoteTable.name || activeTable.name;
        activeTable.data = data;
        activeTable.updatedAt = remoteUpdatedAt;
        saveTableRegistry();
        render();
        renderSessions();
        setSupabaseStatus(silent ? "Mesa atualizada automaticamente" : "Mesa carregada da nuvem", "synced");
        return true;
      } catch (error) {
        console.warn("Erro ao carregar mesa da nuvem.", error);
        setSupabaseStatus(silent ? "Erro ao atualizar da nuvem" : "Erro ao carregar da nuvem", "error");
        return false;
      } finally {
        isRefreshingCloud = false;
      }
    }

    async function loadOnlineTable() {
      const activeTable = getOnlineTableOrWarn();
      if (!activeTable) return;
      if (!activeTable.onlineId) {
        const id = await askInput({
          title: "Carregar mesa online",
          message: "Cole o ID da mesa online para vincular este dispositivo.",
          inputLabel: "ID da mesa",
          inputPlaceholder: "ID no Supabase",
          confirmText: "Carregar"
        });
        if (!id) return;
        activeTable.onlineId = id.trim();
        saveTableRegistry();
      }
      await refreshOnlineTable({ force: true });
    }

    function scheduleCloudTableSave() {
      const activeTable = getActiveTable();
      if (!activeTable) return;
      if (!activeTable.onlineId) {
        setSupabaseStatus("Crie a mesa online para auto-salvar", "local");
        return;
      }
      cloudChangeVersion++;
      activeTable.pendingCloudSave = true;
      saveTableRegistry();
      window.clearTimeout(cloudSaveTimer);
      setSupabaseStatus(activeTable.role === "master" ? "Salvando na nuvem..." : "Enviando alteracoes...");
      cloudSaveTimer = window.setTimeout(saveOnlineTable, 1200);
    }


    // Individual secrets never enter `data`, tableRegistry, campaign JSON or the master vault.
    let secretPanelEpoch = 0;
    let secretPanel = null;

    async function verifiedCloudUser(interactive = false) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Configure o Supabase primeiro.");
      let result = await client.auth.getUser();
      if (result.data?.user) return result.data.user;
      if (!interactive) throw new Error("Entre com sua conta verificada nas Configurações.");
      const email = await askInput({ title: "Entrar com e-mail", message: "Use sua conta pessoal. O PIN da mesa não autoriza acesso aos segredos.", inputLabel: "E-mail", confirmText: "Enviar código" });
      if (!email) throw new Error("Autenticação cancelada.");
      const sent = await client.auth.signInWithOtp({ email: email.trim() });
      if (sent.error) throw sent.error;
      const token = await askInput({ title: "Verificar e-mail", message: "Informe o código recebido por e-mail.", inputLabel: "Código", confirmText: "Entrar" });
      if (!token) throw new Error("Autenticação cancelada.");
      const verified = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
      if (verified.error) throw verified.error;
      result = await client.auth.getUser();
      if (result.error || !result.data?.user) throw new Error("Não foi possível verificar a conta.");
      return result.data.user;
    }

    async function campaignIdentity(tableId, interactive = false) {
      const user = await verifiedCloudUser(interactive);
      const client = getSupabaseClient();
      const campaign = await client.from("mesa_arcana_tables").select("owner_id").eq("id", tableId).single();
      if (campaign.error) throw new Error("Conta sem acesso à campanha. Peça ao mestre para vincular seu e-mail.");
      if (campaign.data.owner_id === user.id) return { user, role: "master", name: "Mestre" };
      const member = await client.from("mesa_arcana_members").select("user_id,display_name").eq("table_id", tableId).eq("user_id", user.id).single();
      if (member.error || !member.data) throw new Error("Conta sem vínculo com esta campanha.");
      return { user, role: "player", name: member.data.display_name };
    }

    function clearIndividualSecrets() {
      secretPanelEpoch++;
      secretPanel = null;
      const input = document.querySelector("#individualSecretsInput");
      if (input) { input.value = ""; input.disabled = true; }
      const select = document.querySelector("#individualSecretsPlayer");
      if (select) select.innerHTML = "";
      const button = document.querySelector("#saveIndividualSecrets");
      if (button) button.disabled = true;
    }

    function offlineSecretsKey(table, recipient) {
      return `mesa-arcana:offline-secrets:${table.id}:${encodeURIComponent(recipient)}`;
    }

    async function loadIndividualSecrets(recipient = "", discard = false) {
      const input = document.querySelector("#individualSecretsInput");
      const select = document.querySelector("#individualSecretsPlayer");
      const status = document.querySelector("#individualSecretsStatus");
      if (!discard && secretPanel && input.value !== secretPanel.original) {
        const accepted = await askConfirm({ title: "Descartar alterações?", message: "Há segredos ainda não salvos. Descartar para carregar outra seleção?", confirmText: "Descartar" });
        if (!accepted) { select.value = secretPanel.recipient; return; }
      }
      clearIndividualSecrets();
      const epoch = secretPanelEpoch;
      const table = getActiveTable();
      const characterId = activeCharacterId;
      if (!table || !characterId) return;
      status.textContent = "Carregando segredos...";
      try {
        let recipients, identity;
        if (table.onlineId) {
          identity = await campaignIdentity(table.onlineId);
          if (identity.role === "master") {
            const result = await getSupabaseClient().from("mesa_arcana_members").select("user_id,display_name").eq("table_id", table.onlineId).order("display_name");
            if (result.error) throw result.error;
            recipients = result.data.map(member => ({ id: member.user_id, name: member.display_name }));
          } else recipients = [{ id: identity.user.id, name: identity.name }];
        } else {
          const profiles = table.role === "master" ? playerSheetProfiles().map(p => p.name) : [table.playerName];
          recipients = profiles.filter(Boolean).map(name => ({ id: name, name }));
        }
        if (epoch !== secretPanelEpoch || activeCharacterId !== characterId || getActiveTable() !== table) return;
        if (!recipients.length) throw new Error("Nenhum jogador vinculado. O mestre deve adicionar um jogador nas Configurações.");
        const selected = recipients.find(r => r.id === recipient) || recipients[0];
        select.innerHTML = recipients.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
        select.value = selected.id;
        select.disabled = recipients.length === 1;
        let record = null;
        if (table.onlineId) {
          const result = await getSupabaseClient().from("mesa_arcana_character_secrets").select("secrets,revision").eq("table_id", table.onlineId).eq("character_id", characterId).eq("player_id", selected.id).maybeSingle();
          if (result.error) throw result.error;
          record = result.data;
        } else {
          const local = JSON.parse(readLocalValue(offlineSecretsKey(table, selected.id)) || "{}");
          record = local[characterId];
        }
        if (epoch !== secretPanelEpoch || activeCharacterId !== characterId || getActiveTable() !== table) return;
        input.value = (record?.secrets || []).join("\n");
        input.disabled = false;
        secretPanel = { table, characterId, recipient: selected.id, userId: identity?.user.id, revision: record?.revision || 0, original: input.value, epoch };
        document.querySelector("#saveIndividualSecrets").disabled = false;
        status.textContent = table.onlineId
          ? `Segredos de ${selected.name}. Acesso exclusivo desta conta e do mestre da campanha.`
          : `Segredos locais de ${selected.name}. Sem sincronização; outros usuários deste navegador podem acessar o armazenamento local.`;
      } catch (error) {
        if (epoch === secretPanelEpoch) status.textContent = error.message || "Não foi possível carregar os segredos.";
      }
    }

    async function saveIndividualSecrets() {
      const panel = secretPanel;
      if (!panel || panel.saving) return;
      const input = document.querySelector("#individualSecretsInput");
      const status = document.querySelector("#individualSecretsStatus");
      const original = input.value;
      const secrets = original.split("\n").map(s => s.trim()).filter(Boolean);
      panel.saving = true;
      document.querySelector("#saveIndividualSecrets").disabled = true;
      document.querySelector("#individualSecretsPlayer").disabled = true;
      try {
        let revision = panel.revision + 1;
        if (panel.table.onlineId) {
          const identity = await campaignIdentity(panel.table.onlineId);
          if (identity.user.id !== panel.userId) throw new Error("A conta mudou. Reabra o personagem antes de salvar.");
          const result = await getSupabaseClient().rpc("mesa_save_character_secrets", {
            campaign: panel.table.onlineId, character: panel.characterId, recipient: panel.recipient,
            body: secrets, expected_revision: panel.revision
          });
          if (result.error) throw result.error;
          revision = result.data.revision;
        } else {
          const key = offlineSecretsKey(panel.table, panel.recipient);
          const records = JSON.parse(readLocalValue(key) || "{}");
          records[panel.characterId] = { secrets, revision };
          if (!writeLocalValue(key, JSON.stringify(records))) throw new Error("Não foi possível salvar neste dispositivo.");
        }
        if (secretPanel !== panel) return;
        panel.revision = revision;
        panel.original = original;
        status.textContent = panel.table.onlineId ? "Segredos salvos no Supabase." : "Segredos salvos somente neste dispositivo.";
      } catch (error) {
        if (secretPanel === panel) status.textContent = error.code === "40001"
          ? "Outra sessão alterou estes segredos. Copie seu texto e clique em Recarregar antes de salvar novamente. Seu rascunho foi mantido."
          : `Falha ao salvar. Rascunho mantido. ${error.message || "Verifique a conexão e sua autenticação."}`;
      } finally {
        panel.saving = false;
        if (secretPanel === panel) {
          document.querySelector("#saveIndividualSecrets").disabled = false;
          document.querySelector("#individualSecretsPlayer").disabled = document.querySelector("#individualSecretsPlayer").options.length < 2;
        }
      }
    }

    async function loginCloudAccount() {
      try {
        const user = await verifiedCloudUser(true);
        setSupabaseStatus(`Conta verificada: ${user.email}`, "synced");
        if (activeCharacterId) await loadIndividualSecrets("", true);
      } catch (error) { setSupabaseStatus(error.message, "error"); }
    }

    async function addVerifiedPlayer() {
      try {
        const table = getActiveTable();
        if (!table?.onlineId) throw new Error("Crie a mesa online primeiro.");
        const identity = await campaignIdentity(table.onlineId, true);
        if (identity.role !== "master") throw new Error("Apenas o mestre cadastrado pode vincular jogadores.");
        const email = await askInput({ title: "Vincular jogador", message: "O jogador precisa verificar o e-mail antes, usando Entrar com e-mail.", inputLabel: "E-mail do jogador", confirmText: "Continuar" });
        if (!email) return;
        const name = await askInput({ title: "Identidade na campanha", message: "Use o nome já usado pelo jogador nesta mesa para preservar fichas e anotações.", inputLabel: "Nome do jogador", confirmText: "Vincular" });
        if (!name) return;
        const result = await getSupabaseClient().rpc("mesa_add_member", { campaign: table.onlineId, player_email: email, player_name: name });
        if (result.error) throw result.error;
        setSupabaseStatus("Conta do jogador vinculada", "synced");
      } catch (error) { setSupabaseStatus(error.message, "error"); }
    }

    function iconTrash() {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
    }

    function removeFrom(collection, id) {
      const removed = collection === "players" ? data.players.find(item => item.id === id) : null;
      data[collection] = data[collection].filter(item => item.id !== id);
      if (removed && (removed.kind || "").toLowerCase() !== "npc") {
        const remainingNames = new Set(data.players.filter(item => (item.kind || "").toLowerCase() !== "npc").flatMap(item => [item.character, item.name]).filter(Boolean).map(name => name.trim().toLowerCase()));
        const names = [removed.character, removed.name].filter(Boolean).map(name => name.trim().toLowerCase()).filter(name => !remainingNames.has(name));
        data.hiddenPlayerProfiles = [...new Set([...safeList(data.hiddenPlayerProfiles), ...names])];
      }
      if (collection === "players" && activeCharacterId === id) {
        closeCharacterModal();
      }
      if (collection === "playerRelations" && activePlayerRelationId === id) {
        resetPlayerRelationForm();
      }
      save();
    }

    function getCharacter(id) {
      return data.players.find(player => player.id === id);
    }

    function ensureActiveMasterPlayer() {
      const table = getActiveTable();
      if (table?.role !== "master") return;
      const profiles = playerSheetProfiles();
      if (!activeMasterPlayerName || !profiles.some(profile => profile.name === activeMasterPlayerName)) {
        activeMasterPlayerName = profiles[0]?.name || "";
      }
    }

    function activePersonalOwner() {
      ensureActiveMasterPlayer();
      return currentPlayerOwner();
    }

    function getCharacterAnnotation(character) {
      const owner = activePersonalOwner();
      if (!owner) return character?.annotations || "";
      const notes = character?.playerAnnotations || {};
      return notes[owner] ?? "";
    }

    function setCharacterAnnotation(character, value) {
      const owner = activePersonalOwner();
      if (!character) return;
      if (!owner) {
        character.annotations = value;
        return;
      }
      character.playerAnnotations = { ...(character.playerAnnotations || {}), [owner]: value };
    }

    function getSessionDiary(session) {
      const owner = activePersonalOwner();
      if (!owner) return session?.diary || "";
      const diaries = session?.playerDiaries || {};
      return diaries[owner] ?? "";
    }

    function setSessionDiary(session, value) {
      const owner = activePersonalOwner();
      if (!session) return;
      if (!owner) {
        session.diary = value;
        return;
      }
      session.playerDiaries = { ...(session.playerDiaries || {}), [owner]: value };
    }

    function renderCharacterAnnotationPlayerSelect(character) {
      const table = getActiveTable();
      const box = document.querySelector("#characterAnnotationPlayerBox");
      const select = document.querySelector("#characterAnnotationPlayerSelect");
      const annotationsField = document.querySelector("#characterModalAnnotations");
      if (table?.role !== "master") {
        box.style.display = "none";
        annotationsField.placeholder = "Anote aqui tudo que você descobriu, suspeita ou quer lembrar sobre esse personagem.";
        return;
      }
      const profiles = playerSheetProfiles();
      if (!profiles.length) {
        activeMasterPlayerName = "";
        box.style.display = "none";
        annotationsField.placeholder = "Nenhum jogador entrou nesta mesa ainda.";
        return;
      }
      ensureActiveMasterPlayer();
      select.innerHTML = profiles.map(profile => `<option value="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</option>`).join("");
      select.value = activeMasterPlayerName;
      box.style.display = "block";
      annotationsField.placeholder = `Anotações de ${activeMasterPlayerName || "jogador"} sobre ${character?.character || "este personagem"}.`;
    }

    function renderSessionDiaryPlayerSelect(session) {
      const table = getActiveTable();
      const box = document.querySelector("#sessionDiaryPlayerBox");
      const select = document.querySelector("#sessionDiaryPlayerSelect");
      const label = document.querySelector("#sessionDiaryLabel");
      const diaryField = document.querySelector("#sessionDiaryInput");
      if (table?.role !== "master") {
        box.style.display = "none";
        label.textContent = "Meu diário";
        diaryField.placeholder = "Escreva aqui o que aconteceu na sessão pela sua visão...";
        return;
      }
      const profiles = playerSheetProfiles();
      if (!profiles.length) {
        activeMasterPlayerName = "";
        box.style.display = "none";
        label.textContent = "Diário do jogador";
        diaryField.placeholder = "Os jogadores aparecem aqui depois de entrar na mesa.";
        return;
      }
      ensureActiveMasterPlayer();
      select.innerHTML = profiles.map(profile => `<option value="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</option>`).join("");
      select.value = activeMasterPlayerName;
      box.style.display = "block";
      label.textContent = `Diário de ${activeMasterPlayerName}`;
      diaryField.placeholder = `Diário pessoal de ${activeMasterPlayerName} nesta sessão.`;
    }

    function sessionHasDiary(session) {
      const table = getActiveTable();
      if (table?.role === "player") return Boolean(getSessionDiary(session));
      return Boolean(session?.diary || Object.values(session?.playerDiaries || {}).some(Boolean));
    }

    function getCurrentPlayerCharacter() {
      const owner = currentPlayerOwner();
      const playable = safeList(data.players).filter(player => (player.kind || "").toLowerCase() !== "npc");
      if (!owner) return playable[0] || null;
      const normalizedOwner = owner.toLowerCase();
      return playable.find(player => String(player.character || "").trim().toLowerCase() === normalizedOwner)
        || playable.find(player => String(player.name || "").trim().toLowerCase() === normalizedOwner)
        || null;
    }

    function getCurrentPlayerProfile() {
      const owner = currentPlayerOwner();
      if (!owner) return null;
      data.playerProfiles = safeList(data.playerProfiles);
      let profile = data.playerProfiles.find(item => item.name === owner);
      if (!profile) {
        profile = { id: createId(), name: owner, pinHash: "", cover: "", sheetImage: "" };
        data.playerProfiles.push(profile);
      }
      profile.cover = profile.cover || "";
      profile.sheetImage = profile.sheetImage || "";
      return profile;
    }

    function getCurrentPlayerSheetSource() {
      return getCurrentPlayerCharacter() || getCurrentPlayerProfile();
    }

    function canEditCurrentPlayerSheet() {
      return getActiveTable()?.role === "player";
    }

    function visiblePlayerProfile(profile) {
      const name = String(profile.name || "").trim();
      if (!name || safeList(data.hiddenPlayerProfiles).includes(name.toLowerCase())) return false;
      const linked = safeList(data.players).some(player => (player.kind || "").toLowerCase() !== "npc" && [player.character, player.name].some(value => String(value || "").trim().toLowerCase() === name.toLowerCase()));
      // Older versions created a profile just by previewing a sample character.
      return linked || name.toLowerCase() !== "personagem a definir" || Boolean(profile.pinHash);
    }

    function playerSheetProfiles() {
      const profiles = safeList(data.playerProfiles).filter(visiblePlayerProfile);
      if (profiles.length) return profiles;
      return safeList(data.players)
        .filter(player => (player.kind || "").toLowerCase() !== "npc")
        .map(player => ({ id: player.id || createId(), name: player.character || player.name || "Jogador" }))
        .filter(visiblePlayerProfile);
    }

    function renderPlayerSheetPicker() {
      const table = getActiveTable();
      const box = document.querySelector("#playerSheetPicker");
      const list = document.querySelector("#playerSheetPickerList");
      box.classList.add("hidden");
      renderPlayerNavSubmenu();
      if (table?.role !== "master") return;
      const profiles = playerSheetProfiles();
      if (!profiles.length) {
        activeMasterPlayerName = "";
        if (list) list.innerHTML = empty("Nenhum jogador entrou na mesa ainda.");
        return;
      }
      if (!activeMasterPlayerName || !profiles.some(profile => profile.name === activeMasterPlayerName)) {
        activeMasterPlayerName = profiles[0].name;
      }
      if (!list) return;
      list.innerHTML = profiles.map(profile => `
        <button class="player-picker-card ${profile.name === activeMasterPlayerName ? "active" : ""}" data-player-sheet-name="${escapeHtml(profile.name)}">
          <strong>${escapeHtml(profile.name)}</strong>
          <small>${profile.name === activeMasterPlayerName ? "Visualizando agora" : "Abrir ficha"}</small>
        </button>
      `).join("");
      list.querySelectorAll("[data-player-sheet-name]").forEach(button => {
        button.addEventListener("click", () => {
          activeMasterPlayerName = button.dataset.playerSheetName;
          render();
        });
      });
    }

    function renderPlayerNavSubmenu() {
      const table = getActiveTable();
      const submenu = document.querySelector("#playerNavSubmenu");
      const menu = document.querySelector("#navPlayerMenu");
      if (!submenu || !menu) return;
      if (table?.role !== "master") {
        submenu.classList.add("hidden");
        submenu.innerHTML = "";
        return;
      }
      const profiles = playerSheetProfiles();
      if (!profiles.length) {
        activeMasterPlayerName = "";
        submenu.classList.add("hidden");
        submenu.innerHTML = "";
        return;
      }
      if (!activeMasterPlayerName || !profiles.some(profile => profile.name === activeMasterPlayerName)) {
        activeMasterPlayerName = profiles[0].name;
      }
      submenu.classList.remove("hidden");
      submenu.innerHTML = profiles.map(profile => `
        <button class="player-nav-option ${profile.name === activeMasterPlayerName ? "active" : ""}" type="button" data-nav-player-name="${escapeHtml(profile.name)}">
          <strong>${escapeHtml(profile.name)}</strong>
          <small>${profile.name === activeMasterPlayerName ? "Visualizando agora" : "Abrir ficha"}</small>
        </button>
      `).join("");
      submenu.querySelectorAll("[data-nav-player-name]").forEach(button => {
        button.addEventListener("click", event => {
          event.stopPropagation();
          activeMasterPlayerName = button.dataset.navPlayerName;
          submenu.classList.remove("open");
          selectView("board");
          render();
        });
      });
    }

    function renderPlayerSheet() {
      const table = getActiveTable();
      const owner = currentPlayerOwner();
      const character = getCurrentPlayerCharacter();
      const profile = getCurrentPlayerProfile();
      const source = character || profile;
      const displayName = character?.character || profile?.name || owner || "Personagem";
      const playerLabel = character?.name || owner || (table?.role === "master" ? "Mestre" : "Jogador");
      const portrait = document.querySelector("#playerSheetPortrait");
      const tags = document.querySelector("#playerSheetTags");
      const canEdit = canEditCurrentPlayerSheet();

      document.querySelector("#playerSheetName").textContent = displayName;
      document.querySelector("#playerSheetMeta").textContent = character?.notes || `Ficha vinculada a ${playerLabel}.`;
      portrait.title = canEdit ? "Trocar foto do personagem" : "Foto do personagem";
      portrait.classList.toggle("readonly", !canEdit);
      portrait.innerHTML = source?.cover
        ? `<img src="${source.cover}" alt="Imagem de ${escapeHtml(displayName)}">`
        : `<span>${escapeHtml(characterInitials(displayName))}</span>`;
      tags.innerHTML = `
        <span class="tag">${escapeHtml(playerLabel)}</span>
        <span class="tag shared">${escapeHtml(character?.state || "Em jogo")}</span>
        ${character?.focus ? `<span class="tag">${escapeHtml(character.focus)}</span>` : ""}
      `;
    }

    function renderPlayerSections() {
      const sections = ["sheet", "notes", "inventory", "relations", "files"];
      if (!sections.includes(activePlayerSection)) activePlayerSection = "sheet";
      document.querySelectorAll("[data-player-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.playerTab === activePlayerSection);
      });
      document.querySelectorAll("[data-player-section]").forEach(section => {
        section.classList.toggle("hidden", section.dataset.playerSection !== activePlayerSection);
      });
    }

    function openPlayerSheetImageModal() {
      const character = getCurrentPlayerCharacter();
      const source = getCurrentPlayerSheetSource();
      const canEdit = canEditCurrentPlayerSheet();
      const displayName = character?.character || source?.name || currentPlayerOwner() || "Personagem";
      document.querySelector("#playerSheetImageTitle").textContent = `Ficha de ${displayName}`;
      document.querySelector("#playerSheetImageIntro").textContent = source?.sheetImage
        ? "Visualização da ficha enviada."
        : (canEdit ? "Adicione uma imagem da ficha para visualizar aqui." : "Esse jogador ainda não adicionou uma ficha.");
      document.querySelector("#changePlayerSheetImage").classList.toggle("hidden", !canEdit);
      renderPlayerSheetPreview(source);
      document.querySelector("#playerSheetImageModal").classList.remove("hidden");
    }

    function closePlayerSheetImageModal() {
      document.querySelector("#playerSheetImageModal").classList.add("hidden");
    }

    function renderPlayerSheetPreview(character = getCurrentPlayerSheetSource()) {
      const preview = document.querySelector("#playerSheetPreview");
      const displayName = character?.character || character?.name || currentPlayerOwner() || "personagem";
      preview.innerHTML = character?.sheetImage
        ? `<img src="${character.sheetImage}" alt="Ficha de ${escapeHtml(displayName)}">`
        : `<div class="sheet-preview-empty">Nenhuma ficha adicionada ainda.</div>`;
    }

    async function updateCurrentPlayerPortrait(file) {
      if (!canEditCurrentPlayerSheet()) return;
      const source = getCurrentPlayerSheetSource();
      if (!file || !source) return;
      source.cover = await readImageFile(file);
      save();
      renderPlayerSheet();
    }

    async function updateCurrentPlayerSheetImage(file) {
      if (!canEditCurrentPlayerSheet()) return;
      const source = getCurrentPlayerSheetSource();
      if (!file || !source) return;
      source.sheetImage = await readImageFile(file, { maxSize: 1800, quality: .82 });
      save();
      renderPlayerSheet();
      renderPlayerSheetPreview(source);
    }

    function characterMedia(character) {
      const media = [];
      if (character.cover) {
        media.push({ src: character.cover, label: "Capa" });
      }
      (character.photos || []).forEach((src, index) => media.push({ src, label: `Foto ${index + 1}` }));
      return media;
    }

    function renderCharacterMedia() {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      const media = characterMedia(character);
      const modalCover = document.querySelector("#characterModalCover");
      const coverPlaceholder = document.querySelector("#characterModalCoverPlaceholder");
      const previous = document.querySelector("#previousCharacterPhoto");
      const next = document.querySelector("#nextCharacterPhoto");
      const count = document.querySelector("#characterPhotoCount");

      if (activePhotoIndex >= media.length) activePhotoIndex = 0;
      const activeMedia = media[activePhotoIndex];
      modalCover.classList.toggle("hidden", !activeMedia);
      coverPlaceholder.classList.toggle("hidden", !!activeMedia);
      modalCover.src = activeMedia?.src || "";
      modalCover.alt = activeMedia ? `${activeMedia.label} de ${character.character || "personagem"}` : "";
      coverPlaceholder.textContent = characterInitials(character.character);
      previous.classList.toggle("hidden", media.length <= 1);
      next.classList.toggle("hidden", media.length <= 1);
      count.classList.toggle("hidden", media.length <= 1);
      count.textContent = media.length > 1 ? `${activePhotoIndex + 1}/${media.length}` : "";
    }

    function shiftCharacterMedia(direction) {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      const media = characterMedia(character);
      if (media.length <= 1) return;
      activePhotoIndex = (activePhotoIndex + direction + media.length) % media.length;
      renderCharacterMedia();
    }

    function openPhotoGallery() {
      renderPhotoGallery();
      document.querySelector("#photoGalleryModal").classList.remove("hidden");
    }

    function closePhotoGallery() {
      document.querySelector("#photoGalleryModal").classList.add("hidden");
    }

    function renderPhotoGallery() {
      const character = getCharacter(activeCharacterId);
      const grid = document.querySelector("#photoGalleryGrid");
      const photos = character?.photos || [];
      grid.innerHTML = photos.length
        ? photos.map((photo, index) => `
          <div class="gallery-item">
            <img src="${photo}" alt="Foto ${index + 1} de ${escapeHtml(character.character || "personagem")}">
            <button class="btn danger" type="button" data-delete-photo="${index}">Excluir</button>
          </div>`).join("")
        : empty("Nenhuma foto extra adicionada.");
      document.querySelectorAll("[data-delete-photo]").forEach(button => {
        button.onclick = () => deleteCharacterPhoto(Number(button.dataset.deletePhoto));
      });
    }

    function deleteCharacterPhoto(index) {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      character.photos = (character.photos || []).filter((_, itemIndex) => itemIndex !== index);
      activePhotoIndex = 0;
      save();
      renderCharacterMedia();
      renderPhotoGallery();
    }

    function openCharacterModal(id) {
      const character = getCharacter(id);
      if (!character) return;
      activeCharacterId = id;
      activeCharacterMasterView = false;
      document.querySelector("#characterModalTags").innerHTML = `
        <span class="tag ${character.kind === "NPC" ? "private" : "shared"}">${escapeHtml(character.kind || "Jogador")}</span>
        <span class="tag shared">${escapeHtml(character.state || "Em dia")}</span>
      `;
      document.querySelector("#characterModalTitle").textContent = character.character || "Personagem";
      document.querySelector("#characterModalSubtitle").textContent = character.name || "Sem vínculo definido";
      document.querySelector("#characterModalFocus").textContent = character.focus || "Sem objetivo registrado.";
      document.querySelector("#characterModalState").textContent = character.state || "Sem estado registrado.";
      document.querySelector("#characterModalNotes").textContent = character.notes || "Sem descrição ainda.";
      const annotationsField = document.querySelector("#characterModalAnnotations");
      renderCharacterAnnotationPlayerSelect(character);
      annotationsField.value = getCharacterAnnotation(character);
      const secrets = (character.secrets || []).filter(secret => String(secret).trim());
      const secretsBox = document.querySelector("#characterSecretsBox");
      const secretsList = document.querySelector("#characterModalSecrets");
      secretsBox.classList.toggle("hidden", secrets.length === 0);
      secretsList.innerHTML = secrets.map(secret => `<li><button class="secret-link" type="button" data-secret-jump="${escapeHtml(secret)}">${escapeHtml(secret)}</button></li>`).join("");
      bindSecretLinks();
      loadIndividualSecrets("", true);
      renderCharacterMasterView(character);
      activePhotoIndex = 0;
      renderCharacterMedia();
      document.querySelector("#modalCharacterCover").value = "";
      document.querySelector("#addCharacterPhoto").value = "";
      document.querySelector("#characterModal").classList.remove("hidden");
      requestAnimationFrame(() => {
        autoResizeTextarea(annotationsField);
        requestAnimationFrame(() => autoResizeTextarea(annotationsField));
      });
    }

    function closeCharacterModal() {
      clearIndividualSecrets();
      activeCharacterId = null;
      activeCharacterMasterView = false;
      closePhotoGallery();
      document.querySelector("#characterModal").classList.add("hidden");
    }

    function openAddCharacterModal() {
      editingCharacterId = null;
      document.querySelector("#addCharacterModalTitle").textContent = "Adicionar personagem";
      document.querySelector("#addCharacterModalTitle").nextElementSibling.textContent = "Crie um personagem dos jogadores ou um NPC importante para o elenco.";
      document.querySelector("#addPlayer").textContent = "Salvar personagem";
      renderSecretInputs([]);
      document.querySelector("#addCharacterModal").classList.remove("hidden");
      document.querySelector("#characterName").focus();
    }

    function openEditCharacterModal() {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      editingCharacterId = character.id;
      newCharacterCover = character.cover || "";
      document.querySelector("#addCharacterModalTitle").textContent = "Editar personagem";
      document.querySelector("#addCharacterModalTitle").nextElementSibling.textContent = "Atualize os detalhes deste personagem.";
      document.querySelector("#addPlayer").textContent = "Salvar alterações";
      document.querySelector("#characterKind").value = character.kind || "Jogador";
      document.querySelector("#playerName").value = character.name || "";
      document.querySelector("#characterName").value = character.character || "";
      document.querySelector("#playerFocus").value = character.focus || "";
      setSelectValuePreservingLegacy("#playerState", character.state || "Em dia");
      document.querySelector("#playerNotes").value = character.notes || "";
      renderSecretInputs(character.secrets || []);
      document.querySelector("#newCharacterCover").value = "";
      const preview = document.querySelector("#newCharacterCoverPreview");
      preview.classList.toggle("hidden", !newCharacterCover);
      preview.src = newCharacterCover || "";
      closeCharacterModal();
      document.querySelector("#addCharacterModal").classList.remove("hidden");
      document.querySelector("#characterName").focus();
    }

    function closeAddCharacterModal() {
      document.querySelector("#addCharacterModal").classList.add("hidden");
      resetCharacterForm();
    }

    function resetCharacterForm() {
      ["playerName", "characterName", "playerFocus", "playerNotes"].forEach(id => document.getElementById(id).value = "");
      document.querySelector("#characterKind").value = "Jogador";
      setSelectValuePreservingLegacy("#playerState", "Em dia");
      document.querySelector("#newCharacterCover").value = "";
      document.querySelector("#newCharacterCoverPreview").classList.add("hidden");
      renderSecretInputs([]);
      newCharacterCover = "";
      editingCharacterId = null;
      document.querySelector("#addCharacterModalTitle").textContent = "Adicionar personagem";
      document.querySelector("#addCharacterModalTitle").nextElementSibling.textContent = "Crie um personagem dos jogadores ou um NPC importante para o elenco.";
      document.querySelector("#addPlayer").textContent = "Salvar personagem";
    }

    function renderSecretInputs(secrets = []) {
      const list = document.querySelector("#secretList");
      list.innerHTML = "";
      list.classList.toggle("hidden", secrets.length === 0);
      secrets.forEach(secret => addSecretInput(secret));
    }

    function addSecretInput(value = "") {
      const list = document.querySelector("#secretList");
      list.classList.remove("hidden");
      const row = document.createElement("div");
      row.className = "secret-row";
      row.innerHTML = `
        <input class="secret-input" placeholder="Escreva um segredo deste personagem" value="${escapeHtml(value)}">
        <button class="icon-btn" type="button" title="Remover segredo">${iconTrash()}</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        row.remove();
        if (!list.querySelector(".secret-row")) {
          list.classList.add("hidden");
        }
      });
      list.appendChild(row);
      row.querySelector("input").focus();
    }

    function getSecretInputs() {
      return [...document.querySelectorAll(".secret-input")]
        .map(input => input.value.trim())
        .filter(Boolean);
    }

    function autoResizeTextarea(textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, 120)}px`;
    }

    function saveWithoutRerender() {
      persistLocalData();
      scheduleCloudTableSave();
    }

    function saveActiveCharacterAnnotations(value) {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      setCharacterAnnotation(character, value);
      saveWithoutRerender();
    }

    function renderPlayerInventory() {
      const list = document.querySelector("#playerInventoryList");
      data.playerInventory = safeList(data.playerInventory).map(normalizeInventoryItem);
      const inventory = data.playerInventory.filter(item => String(item.name).trim()).filter(itemBelongsToCurrentPlayer);
      list.innerHTML = inventory.length
        ? inventory.map(item => `
          <button class="inventory-item" type="button" data-inventory-item-id="${item.id}">
            <div class="inventory-thumb">
              ${item.image
                ? `<img src="${item.image}" alt="Imagem de ${escapeHtml(item.name)}">`
                : `<span>${escapeHtml(characterInitials(item.name))}</span>`}
            </div>
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.description || "Sem descrição registrada.")}</p>
            </div>
          </button>
        `).join("")
        : '<p class="inventory-empty">Nenhum item registrado no inventário do jogador.</p>';
      list.querySelectorAll("[data-inventory-item-id]").forEach(button => {
        button.addEventListener("click", () => openInventoryItemModal(button.dataset.inventoryItemId));
      });
    }

    function openInventoryItemModal(id = null) {
      activeInventoryItemId = id;
      const item = id ? data.playerInventory.find(entry => entry.id === id && itemBelongsToCurrentPlayer(entry)) : null;
      inventoryDraftImage = item?.image || "";
      document.querySelector("#inventoryItemModalTitle").textContent = item ? "Editar item" : "Adicionar item";
      document.querySelector("#inventoryItemName").value = item?.name || "";
      document.querySelector("#inventoryItemDescription").value = item?.description || "";
      document.querySelector("#inventoryItemImage").value = "";
      const preview = document.querySelector("#inventoryItemPreview");
      preview.classList.toggle("hidden", !inventoryDraftImage);
      preview.src = inventoryDraftImage || "";
      document.querySelector("#deleteInventoryItem").classList.toggle("hidden", !item);
      document.querySelector("#inventoryItemModal").classList.remove("hidden");
      document.querySelector("#inventoryItemName").focus();
    }

    function closeInventoryItemModal() {
      activeInventoryItemId = null;
      inventoryDraftImage = "";
      document.querySelector("#inventoryItemModal").classList.add("hidden");
    }

    function saveInventoryItem() {
      const name = document.querySelector("#inventoryItemName").value.trim();
      const description = document.querySelector("#inventoryItemDescription").value.trim();
      if (!name) return;
      const item = {
        id: activeInventoryItemId || createId(),
        name,
        description,
        image: inventoryDraftImage,
        owner: currentPlayerOwner()
      };
      data.playerInventory = safeList(data.playerInventory).map(normalizeInventoryItem);
      if (activeInventoryItemId) {
        data.playerInventory = data.playerInventory.map(entry => entry.id === activeInventoryItemId ? item : entry);
      } else {
        data.playerInventory.push(item);
      }
      renderPlayerInventory();
      save();
      closeInventoryItemModal();
    }

    function removeInventoryItem() {
      if (!activeInventoryItemId) return;
      data.playerInventory = safeList(data.playerInventory)
        .map(normalizeInventoryItem)
        .filter(item => item.id !== activeInventoryItemId || !itemBelongsToCurrentPlayer(item));
      renderPlayerInventory();
      save();
      closeInventoryItemModal();
    }

    function renderPlayerRelations() {
      const owner = currentPlayerOwner();
      const canEdit = canEditCurrentPlayerSheet();
      const form = document.querySelector("#playerRelationForm");
      const list = document.querySelector("#playerRelationList");
      document.querySelector("#relationsTitle").textContent = owner ? `Relações de ${owner}` : "Relações privadas";
      document.querySelector("#relationsIntro").textContent = canEdit
        ? "Seu mapa pessoal de aliados, suspeitos, ameaças e vínculos."
        : owner
          ? `Visão pessoal de ${owner} sobre as relações da campanha.`
          : "Escolha um jogador para ver as relações privadas dele.";
      form.classList.toggle("hidden", !canEdit);
      data.playerRelations = safeList(data.playerRelations).map(normalizePlayerRelation);
      renderPlayerRelationOptions();
      const relations = data.playerRelations
        .filter(item => String(item.name).trim())
        .filter(itemBelongsToCurrentPlayer);
      list.innerHTML = relations.length
        ? relations.map(item => relationItem(item, canEdit)).join("")
        : empty(canEdit ? "Nenhuma relação privada registrada ainda." : "Esse jogador ainda não registrou relações privadas.");
      list.querySelectorAll("[data-edit-relation]").forEach(button => {
        button.addEventListener("click", () => editPlayerRelation(button.dataset.editRelation));
      });
      list.querySelectorAll("[data-open-relation-character]").forEach(button => {
        button.addEventListener("click", () => openCharacterModal(button.dataset.openRelationCharacter));
      });
    }

    function relationItem(item, canEdit) {
      const character = relationTargetCharacter(item);
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <h3>
                ${character
                  ? `<button class="relation-character-link" type="button" data-open-relation-character="${character.id}" title="Abrir ficha de ${escapeHtml(character.character || item.name)}">${escapeHtml(item.name)}</button>`
                  : escapeHtml(item.name)}
              </h3>
              <div class="meta"><span class="tag shared">${escapeHtml(item.type)}</span></div>
            </div>
            ${canEdit ? `
              <div class="contact-actions">
                <button class="btn" type="button" data-edit-relation="${item.id}">Editar</button>
                <button class="icon-btn" title="Remover" data-remove="playerRelations" data-id="${item.id}">${iconTrash()}</button>
              </div>
            ` : ""}
          </div>
          <p>${escapeHtml(item.notes || "Sem notas ainda.")}</p>
        </article>
      `;
    }

    function relationTargetLabel(character) {
      const characterName = String(character.character || "").trim();
      const linkName = String(character.name || "").trim();
      if (characterName && linkName && characterName !== linkName) return `${characterName} (${linkName})`;
      return characterName || linkName || "Personagem sem nome";
    }

    function relationTargetMatches(relation, character) {
      if (relation.targetId && relation.targetId === character.id) return true;
      const relationName = String(relation.name || "").trim().toLowerCase();
      return Boolean(relationName && [
        character.character,
        character.name,
        relationTargetLabel(character)
      ].some(value => String(value || "").trim().toLowerCase() === relationName));
    }

    function relationTargetCharacter(relation) {
      return safeList(data.players).find(character => relationTargetMatches(relation, character)) || null;
    }

    function relationCandidates(currentRelation = null) {
      const owner = String(currentPlayerOwner() || "").trim().toLowerCase();
      const relations = safeList(data.playerRelations).map(normalizePlayerRelation)
        .filter(itemBelongsToCurrentPlayer)
        .filter(relation => relation.id !== currentRelation?.id);
      return safeList(data.players)
        .filter(character => String(character.character || character.name || "").trim())
        .filter(character => {
          const names = [character.character, character.name].map(value => String(value || "").trim().toLowerCase());
          return !owner || !names.includes(owner);
        })
        .filter(character => !relations.some(relation => relationTargetMatches(relation, character)));
    }

    function renderPlayerRelationOptions() {
      const select = document.querySelector("#playerRelationTarget");
      const currentRelation = activePlayerRelationId
        ? data.playerRelations.find(relation => relation.id === activePlayerRelationId)
        : null;
      const candidates = relationCandidates(currentRelation);
      const currentCharacter = currentRelation
        ? safeList(data.players).find(character => relationTargetMatches(currentRelation, character))
        : null;
      const options = [];
      if (currentRelation && !currentCharacter) {
        options.push(`<option value="custom:${escapeHtml(currentRelation.name)}">${escapeHtml(currentRelation.name)}</option>`);
      }
      options.push(...candidates.map(character => `
        <option value="${escapeHtml(character.id)}">${escapeHtml(relationTargetLabel(character))}</option>
      `));
      select.innerHTML = options.length
        ? options.join("")
        : '<option value="">Todos os personagens já têm relação</option>';
      select.disabled = options.length === 0;
      document.querySelector("#addPlayerRelation").disabled = options.length === 0;
      if (currentCharacter) select.value = currentCharacter.id;
      if (currentRelation && !currentCharacter) select.value = `custom:${currentRelation.name}`;
    }

    function resetPlayerRelationForm() {
      activePlayerRelationId = null;
      document.querySelector("#playerRelationType").value = "Aliado";
      document.querySelector("#playerRelationNotes").value = "";
      document.querySelector("#addPlayerRelation").textContent = "Adicionar relação";
      document.querySelector("#cancelPlayerRelationEdit").classList.add("hidden");
      renderPlayerRelationOptions();
    }

    function editPlayerRelation(id) {
      if (!canEditCurrentPlayerSheet()) return;
      data.playerRelations = safeList(data.playerRelations).map(normalizePlayerRelation);
      const relation = data.playerRelations.find(item => item.id === id && itemBelongsToCurrentPlayer(item));
      if (!relation) return;
      activePlayerRelationId = id;
      document.querySelector("#playerRelationType").value = relation.type || "Neutro";
      document.querySelector("#playerRelationNotes").value = relation.notes || "";
      document.querySelector("#addPlayerRelation").textContent = "Salvar relação";
      document.querySelector("#cancelPlayerRelationEdit").classList.remove("hidden");
      renderPlayerRelationOptions();
      document.querySelector("#playerRelationType").focus();
    }

    function savePlayerRelation() {
      if (!canEditCurrentPlayerSheet()) return;
      const targetValue = document.querySelector("#playerRelationTarget").value;
      const target = safeList(data.players).find(character => character.id === targetValue);
      const currentRelation = activePlayerRelationId
        ? data.playerRelations.find(relation => relation.id === activePlayerRelationId)
        : null;
      const name = target ? relationTargetLabel(target) : String(currentRelation?.name || "").trim();
      const type = document.querySelector("#playerRelationType").value;
      const notes = document.querySelector("#playerRelationNotes").value.trim();
      if (!name) return;
      data.playerRelations = safeList(data.playerRelations).map(normalizePlayerRelation);
      const relation = {
        id: activePlayerRelationId || createId(),
        targetId: target?.id || currentRelation?.targetId || "",
        name,
        type,
        notes,
        owner: currentPlayerOwner()
      };
      if (activePlayerRelationId) {
        data.playerRelations = data.playerRelations.map(item => item.id === activePlayerRelationId ? relation : item);
      } else {
        data.playerRelations.push(relation);
      }
      resetPlayerRelationForm();
      save();
    }

    function renderPlayerFiles() {
      const owner = currentPlayerOwner();
      const canEdit = canEditCurrentPlayerSheet();
      const form = document.querySelector("#playerFileForm");
      const list = document.querySelector("#playerFileList");
      document.querySelector("#filesTitle").textContent = owner ? `Arquivos de ${owner}` : "Arquivos do jogador";
      document.querySelector("#filesIntro").textContent = canEdit
        ? "Guarde imagens e referências que fazem sentido para o seu personagem."
        : owner
          ? `Arquivos pessoais enviados por ${owner}.`
          : "Escolha um jogador para ver os arquivos dele.";
      form.classList.toggle("hidden", !canEdit);
      data.playerFiles = safeList(data.playerFiles).map(normalizePlayerFile);
      const files = data.playerFiles
        .filter(item => String(item.title).trim())
        .filter(itemBelongsToCurrentPlayer);
      list.innerHTML = files.length
        ? files.map(item => `
          <article class="item player-file-card">
            <button class="player-file-open" type="button" data-open-player-file="${item.id}" aria-label="Abrir ${escapeHtml(item.title)}">
              <div class="player-file-cover" aria-hidden="true">
                ${item.image
                  ? `<img src="${item.image}" alt="">`
                  : `<span>${escapeHtml(characterInitials(item.title))}</span>`}
              </div>
            </button>
            <div>
              <div class="item-head">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <div class="meta"><span class="tag">Arquivo</span></div>
                </div>
                ${canEdit ? `<button class="icon-btn" title="Remover" data-remove="playerFiles" data-id="${item.id}">${iconTrash()}</button>` : ""}
              </div>
              <p>${escapeHtml(item.notes || "Sem observação registrada.")}</p>
            </div>
          </article>
        `).join("")
        : empty(canEdit ? "Nenhum arquivo adicionado ainda." : "Esse jogador ainda não adicionou arquivos.");
      list.querySelectorAll("[data-open-player-file]").forEach(button => {
        button.addEventListener("click", () => openPlayerFileView(button.dataset.openPlayerFile));
      });
    }


    function renderMasterFiles() {
      const list = document.querySelector("#masterFileList");
      if (!list) return;
      data.masterFiles = safeList(data.masterFiles).map(normalizeMasterFile);
      list.innerHTML = data.masterFiles.length
        ? data.masterFiles.map(item => `
          <article class="item player-file-card">
            <button class="player-file-open" type="button" data-open-master-file="${item.id}" aria-label="Abrir ${escapeHtml(item.title)}">
              <div class="player-file-cover" aria-hidden="true">
                ${item.image
                  ? `<img src="${item.image}" alt="">`
                  : `<span>${escapeHtml(characterInitials(item.title))}</span>`}
              </div>
            </button>
            <div>
              <div class="item-head">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <div class="meta"><span class="tag private">privado</span></div>
                </div>
                <button class="icon-btn" title="Remover" data-remove="masterFiles" data-id="${item.id}">${iconTrash()}</button>
              </div>
              <p>${escapeHtml(item.notes || "Sem observação registrada.")}</p>
            </div>
          </article>
        `).join("")
        : empty("Nenhum arquivo privado ainda.");
      list.querySelectorAll("[data-open-master-file]").forEach(button => {
        button.addEventListener("click", () => openMasterFileView(button.dataset.openMasterFile));
      });
    }

    function openMasterFileView(id) {
      const file = safeList(data.masterFiles)
        .map(normalizeMasterFile)
        .find(item => item.id === id);
      if (!file) return;
      document.querySelector("#playerFileViewTitle").textContent = file.title || "Arquivo privado";
      document.querySelector("#playerFileViewIntro").textContent = "Arquivo privado do Mestre.";
      document.querySelector("#playerFileViewer").innerHTML = file.image
        ? `<img src="${file.image}" alt="${escapeHtml(file.title || "Arquivo privado")}">`
        : '<div class="sheet-preview-empty">Este arquivo não tem imagem anexada.</div>';
      const notes = document.querySelector("#playerFileViewNotes");
      notes.textContent = file.notes || "";
      notes.classList.toggle("hidden", !file.notes);
      document.querySelector("#playerFileViewModal").classList.remove("hidden");
    }

    function addMasterFile() {
      const title = document.querySelector("#masterFileTitle").value.trim();
      const notes = document.querySelector("#masterFileNotes").value.trim();
      if (!title && !masterFileDraftImage) return;
      data.masterFiles = safeList(data.masterFiles).map(normalizeMasterFile);
      data.masterFiles.push({
        id: createId(),
        title: title || "Arquivo privado",
        notes,
        image: masterFileDraftImage
      });
      document.querySelector("#masterFileTitle").value = "";
      document.querySelector("#masterFileNotes").value = "";
      document.querySelector("#masterFileInput").value = "";
      document.querySelector("#masterFilePreview").classList.add("hidden");
      masterFileDraftImage = "";
      save();
    }

    let editingMasterNpcId = null;
    let masterNpcCoverDraft = "";
    let reviewingMasterNpc = false;
    let viewingPlannedNpcId = null;
    function openPlannedNpcSheet(id) {
      if (getActiveTable()?.role !== "master") return;
      const item = data.masterNotes.find(note => note.id === id && note.type === "NPC");
      if (!item || item.npcId && getCharacter(item.npcId)) return;
      viewingPlannedNpcId = id;
      document.querySelector("#plannedNpcTitle").textContent = item.title || "NPC sem nome";
      document.querySelector("#plannedNpcDescription").textContent = item.description || "Não definida.";
      document.querySelector("#plannedNpcNotes").textContent = item.body || "Nenhuma anotação.";
      document.querySelector("#plannedNpcDetails").innerHTML = [["Papel", item.role], ["Habilidades", item.abilities], ["Passado sombrio", item.past], ["Quando aparecer", item.entrance], ["Vantagens", item.advantages], ["Desvantagens", item.disadvantages]].map(([label, value]) => `<div class="npc-dossier-block"><strong>${label}</strong><p style="white-space:pre-wrap">${escapeHtml(value || "Não definido.")}</p></div>`).join("");
      const cover = document.querySelector("#plannedNpcCover");
      cover.src = item.cover || "";
      cover.alt = item.title || "NPC";
      cover.classList.toggle("hidden", !item.cover);
      const initials = document.querySelector("#plannedNpcInitials");
      initials.textContent = characterInitials(item.title || "NPC");
      initials.classList.toggle("hidden", Boolean(item.cover));
      document.querySelector("#plannedNpcModal").classList.remove("hidden");
      document.querySelector("#plannedNpcModal .character-modal-scroll").scrollTop = 0;
      document.querySelector("#closePlannedNpc").focus();
    }
    function closePlannedNpcSheet() {
      document.querySelector("#plannedNpcModal").classList.add("hidden");
      viewingPlannedNpcId = null;
    }
    function renderMasterNpcDossiers() {
      const select = document.querySelector("#masterNpcLinkedCharacter");
      const list = document.querySelector("#masterNpcList");
      if (!select || !list) return;
      const npcs = data.players.filter(character => character.kind === "NPC");
      const selectedNpc = select.value;
      select.innerHTML = [
        '<option value="">Novo NPC planejado</option>',
        ...npcs.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.character || character.name || "NPC sem nome")}</option>`)
      ].join("");
      select.value = selectedNpc;
      const filter = document.querySelector("#masterNpcFilter").value;
      const dossiers = data.masterNotes.filter(note => note.type === "NPC" && (filter === "all" || (filter === "revealed") === Boolean(note.npcId && getCharacter(note.npcId))));
      list.innerHTML = dossiers.length
        ? dossiers.map(item => masterNpcDossierItem(item)).join("")
        : empty("Nenhuma ficha de NPC registrada ainda.");
      list.querySelectorAll("[data-open-master-npc-character]").forEach(card => {
        card.addEventListener("click", () => openCharacterModal(card.dataset.openMasterNpcCharacter));
        card.addEventListener("keydown", event => {
          if (event.target === card && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openCharacterModal(card.dataset.openMasterNpcCharacter);
          }
        });
      });
      list.querySelectorAll("[data-edit-master-npc]").forEach(button => button.addEventListener("click", event => {
        event.stopPropagation();
        openMasterNpcForm(button.dataset.editMasterNpc);
      }));
      list.querySelectorAll("[data-open-planned-npc]").forEach(card => {
        card.addEventListener("click", event => {
          if (event.target.closest("button")) return;
          openPlannedNpcSheet(card.dataset.openPlannedNpc);
        });
        card.addEventListener("keydown", event => {
          if (event.target === card && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openPlannedNpcSheet(card.dataset.openPlannedNpc);
          }
        });
      });
    }

    function masterNpcDossierItem(item) {
      const linked = item.npcId ? getCharacter(item.npcId) : null;
      const title = item.title || linked?.character || "NPC sem nome";
      const summary = item.role || item.entrance || item.abilities || item.body || "Ficha privada do Mestre.";
      return `
        <article class="item npc-dossier-card" ${linked ? `data-open-master-npc-character="${linked.id}"` : `data-open-planned-npc="${escapeHtml(item.id)}"`} tabindex="0" role="button" aria-label="Abrir ficha de ${escapeHtml(title)}">
          ${(linked?.cover || item.cover)
            ? `<img class="npc-dossier-cover" src="${escapeHtml(linked?.cover || item.cover)}" alt="Capa de ${escapeHtml(title)}">`
            : `<div class="npc-dossier-cover" aria-hidden="true">${escapeHtml(characterInitials(title))}</div>`}
          <div class="npc-dossier-copy">
            <div>
              <h3>${escapeHtml(title)}</h3>
              <div class="meta">
                <span class="tag private">NPC</span>
                <span class="tag ${linked ? "shared" : "private"}">${linked ? "Revelado" : "Planejado"}</span>
                ${item.abilities ? '<span class="tag">habilidades</span>' : ""}
                ${item.past ? '<span class="tag">passado</span>' : ""}
              </div>
            </div>
            <p>${escapeHtml(summary)}</p>
          </div>
          <div><button class="btn" data-edit-master-npc="${item.id}">Editar ficha</button><button class="icon-btn" title="Remover" data-remove="masterNotes" data-id="${item.id}">${iconTrash()}</button></div>
        </article>`;
    }

    function addMasterNpcDossier() {
      if (getActiveTable()?.role !== "master") return;
      const npcId = document.querySelector("#masterNpcLinkedCharacter").value;
      const linked = npcId ? getCharacter(npcId) : null;
      const title = document.querySelector("#masterNpcName").value.trim() || linked?.character || "";
      const role = document.querySelector("#masterNpcRole").value.trim();
      const abilities = document.querySelector("#masterNpcAbilities").value.trim();
      const past = document.querySelector("#masterNpcPast").value.trim();
      const entrance = document.querySelector("#masterNpcEntrance").value.trim();
      const advantages = document.querySelector("#masterNpcAdvantages").value.trim();
      const disadvantages = document.querySelector("#masterNpcDisadvantages").value.trim();
      const body = document.querySelector("#masterNpcNotes").value.trim();
      if (!title && !role && !abilities && !past && !entrance && !advantages && !disadvantages && !body) return;
      if (!title) { document.querySelector("#masterNpcName").focus(); return; }
      const fields = {
        type: "NPC",
        npcId,
        title: title || "NPC sem nome",
        role,
        abilities,
        past,
        entrance,
        advantages,
        disadvantages,
        body,
        cover: masterNpcCoverDraft,
        description: document.querySelector("#masterNpcDescription").value.trim()
      };
      const existing = data.masterNotes.find(note => note.id === editingMasterNpcId && note.type === "NPC");
      if (reviewingMasterNpc && existing && !existing.npcId) {
        const character = { id: createId(), kind: "NPC", character: fields.title, name: "", notes: fields.description, cover: fields.cover, focus: "", state: "Em dia", secrets: [], photos: [] };
        data.players.push(character);
        fields.npcId = character.id;
      }
      if (existing) { Object.assign(existing, fields); save(); }
      else addItem("masterNotes", fields);
      resetMasterNpcForm();
      closeMasterNpcForm();
    }

    function openMasterNpcForm(id = null) {
      if (getActiveTable()?.role !== "master") return;
      resetMasterNpcForm();
      const item = data.masterNotes.find(note => note.id === id && note.type === "NPC");
      editingMasterNpcId = item?.id || null;
      if (item) {
        const fields = {Name: "title", Role: "role", Abilities: "abilities", Past: "past", Entrance: "entrance", Advantages: "advantages", Disadvantages: "disadvantages", Notes: "body", Description: "description"};
        Object.entries(fields).forEach(([field, key]) => document.querySelector(`#masterNpc${field}`).value = item[key] || "");
        document.querySelector("#masterNpcLinkedCharacter").value = item.npcId || "";
        masterNpcCoverDraft = item.cover || "";
      }
      document.querySelector("#masterNpcCoverPreview").src = masterNpcCoverDraft;
      document.querySelector("#masterNpcCoverPreview").classList.toggle("hidden", !masterNpcCoverDraft);
      document.querySelector("#masterNpcModalTitle").textContent = item ? "Editar NPC" : "Adicionar NPC";
      document.querySelector("#revealMasterNpc").classList.toggle("hidden", !item || Boolean(item.npcId));
      document.querySelector("#masterNpcLinkedCharacter").disabled = Boolean(item);
      document.querySelector("#masterNpcModal")?.classList.remove("hidden");
      document.querySelector("#masterNpcName")?.focus();
    }

    function closeMasterNpcForm() {
      document.querySelector("#masterNpcModal")?.classList.add("hidden");
    }

    function resetMasterNpcForm() {
      reviewingMasterNpc = false;
      editingMasterNpcId = null;
      masterNpcCoverDraft = "";
      document.querySelector("#masterNpcDescription").value = "";
      document.querySelector("#masterNpcCover").value = "";
      document.querySelector("#addMasterNpc").textContent = "Salvar ficha";
      document.querySelector("#masterNpcForm").querySelectorAll("label").forEach(label => label.classList.remove("hidden"));
      ["masterNpcName", "masterNpcRole", "masterNpcAbilities", "masterNpcPast", "masterNpcEntrance", "masterNpcAdvantages", "masterNpcDisadvantages", "masterNpcNotes"].forEach(id => {
        document.querySelector(`#${id}`).value = "";
      });
      document.querySelector("#masterNpcLinkedCharacter").value = "";
    }

    function masterNpcDossierForCharacter(characterId) {
      if (getActiveTable()?.role !== "master") return null;
      return data.masterNotes.find(note => note.type === "NPC" && note.npcId === characterId);
    }

    function renderCharacterMasterView(character) {
      const table = getActiveTable();
      const isMaster = table?.role === "master";
      const dossier = isMaster && character?.kind === "NPC" ? masterNpcDossierForCharacter(character.id) : null;
      const canUseMasterView = isMaster && Boolean(dossier);
      const toggle = document.querySelector("#toggleCharacterMasterView");
      if (!canUseMasterView) activeCharacterMasterView = false;
      toggle.classList.toggle("hidden", !canUseMasterView);
      toggle.textContent = activeCharacterMasterView ? "Visão pública" : "Visão do Mestre";

      document.querySelector("#characterPublicDescriptionBox").classList.toggle("hidden", activeCharacterMasterView);
      document.querySelector("#characterPublicStatsBox").classList.toggle("hidden", activeCharacterMasterView);
      document.querySelector("#characterSecretsBox").classList.toggle("hidden", activeCharacterMasterView || !safeList(character?.secrets).some(secret => String(secret).trim()));
      document.querySelector("#characterAnnotationsBox").classList.toggle("hidden", activeCharacterMasterView);
      document.querySelector("#characterMasterNpcBox").classList.toggle("hidden", !activeCharacterMasterView);

      if (!dossier) {
        document.querySelector("#characterMasterNpcDetails").innerHTML = "";
        document.querySelector("#characterMasterNpcNotes").textContent = "";
        document.querySelector("#characterMasterNpcNotes").classList.add("hidden");
        return;
      }
      document.querySelector("#characterMasterNpcDetails").innerHTML = [
        ["Papel", dossier.role],
        ["Habilidades", dossier.abilities],
        ["Passado sombrio", dossier.past],
        ["Quando aparecer", dossier.entrance],
        ["Vantagens", dossier.advantages],
        ["Desvantagens", dossier.disadvantages]
      ].map(([label, value]) => `
        <div class="npc-dossier-block">
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(value || "Não definido.")}</p>
        </div>
      `).join("");
      const notes = document.querySelector("#characterMasterNpcNotes");
      notes.textContent = dossier.body || "";
      notes.classList.toggle("hidden", !dossier.body);
    }


    function openPlayerFileView(id) {
      const file = safeList(data.playerFiles)
        .map(normalizePlayerFile)
        .find(item => item.id === id && itemBelongsToCurrentPlayer(item));
      if (!file) return;
      document.querySelector("#playerFileViewTitle").textContent = file.title || "Arquivo do jogador";
      document.querySelector("#playerFileViewIntro").textContent = currentPlayerOwner()
        ? `Arquivo de ${currentPlayerOwner()}.`
        : "Arquivo do jogador.";
      document.querySelector("#playerFileViewer").innerHTML = file.image
        ? `<img src="${file.image}" alt="${escapeHtml(file.title || "Arquivo do jogador")}">`
        : '<div class="sheet-preview-empty">Este arquivo não tem imagem anexada.</div>';
      const notes = document.querySelector("#playerFileViewNotes");
      notes.textContent = file.notes || "";
      notes.classList.toggle("hidden", !file.notes);
      document.querySelector("#playerFileViewModal").classList.remove("hidden");
    }

    function closePlayerFileView() {
      document.querySelector("#playerFileViewModal").classList.add("hidden");
    }

    function addPlayerFile() {
      if (!canEditCurrentPlayerSheet()) return;
      const title = document.querySelector("#playerFileTitle").value.trim();
      const notes = document.querySelector("#playerFileNotes").value.trim();
      if (!title && !playerFileDraftImage) return;
      data.playerFiles = safeList(data.playerFiles).map(normalizePlayerFile);
      data.playerFiles.push({
        id: createId(),
        title: title || "Arquivo do jogador",
        notes,
        image: playerFileDraftImage,
        owner: currentPlayerOwner()
      });
      document.querySelector("#playerFileTitle").value = "";
      document.querySelector("#playerFileNotes").value = "";
      document.querySelector("#playerFileInput").value = "";
      document.querySelector("#playerFilePreview").classList.add("hidden");
      playerFileDraftImage = "";
      save();
    }

    function bindSecretLinks() {
      document.querySelectorAll("[data-secret-jump]").forEach(button => {
        button.onclick = () => jumpToAnnotationSecret(button.dataset.secretJump);
      });
    }

    function jumpToAnnotationSecret(secret) {
      const textarea = document.querySelector("#characterModalAnnotations");
      const current = textarea.value;
      const lowerCurrent = current.toLowerCase();
      const lowerSecret = secret.toLowerCase();
      let index = lowerCurrent.indexOf(`${lowerSecret}:`);

      if (index === -1) {
        const prefix = current.trim() ? `${current.trimEnd()}\n\n` : "";
        textarea.value = `${prefix}${secret}: `;
        saveActiveCharacterAnnotations(textarea.value);
        index = textarea.value.length;
      }

      autoResizeTextarea(textarea);
      textarea.focus();
      const cursor = index === textarea.value.length ? textarea.value.length : index + secret.length + 2;
      textarea.setSelectionRange(cursor, cursor);
      const line = textarea.value.slice(0, index).split("\n").length - 1;
      const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 22;
      textarea.scrollTop = Math.max(0, line * lineHeight - 12);
    }


    function noteItem(item, collection, extraTag = "") {
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <div class="meta">
                ${item.type ? `<span class="tag">${escapeHtml(item.type)}</span>` : ""}
                ${item.column ? `<span class="tag shared">${escapeHtml(item.column)}</span>` : ""}
                ${extraTag}
              </div>
            </div>
            <div>
              ${collection === "masterNotes" && ["Segredo", "Local", "Pista", "Gancho"].includes(item.type) ? `<button class="btn" data-edit-master-note="${escapeHtml(item.id)}">Editar</button>` : ""}
              <button class="icon-btn" title="Remover" data-remove="${collection}" data-id="${item.id}">${iconTrash()}</button>
            </div>
          </div>
          <p>${escapeHtml(item.body || item.notes || "")}</p>
          ${collection === "masterNotes" && item.image ? `<button class="btn" data-clue-image="${escapeHtml(item.id)}" aria-label="Ampliar imagem"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" style="display:block;max-width:100%;max-height:300px;object-fit:contain"></button>` : ""}
        </article>`;
    }

    function empty(text) {
      return `<div class="empty">${text}</div>`;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function setSelectValuePreservingLegacy(selector, value) {
      const select = document.querySelector(selector);
      if (!select) return;
      const nextValue = value || "";
      if (nextValue && ![...select.options].some(option => option.value === nextValue)) {
        const option = document.createElement("option");
        option.value = nextValue;
        option.textContent = nextValue;
        option.hidden = true;
        select.appendChild(option);
      }
      select.value = nextValue;
    }

    function characterInitials(character) {
      return String(character || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || "")
        .join("")
        .toUpperCase();
    }

    function fallbackHashSecret(value) {
      const text = String(value || "");
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fallback-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }

    async function shaSecret(value) {
      if (!crypto.subtle) return "";
      const text = String(value || "");
      const bytes = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    async function hashSecret(value) {
      return fallbackHashSecret(value);
    }

    async function secretMatches(storedHash, value) {
      const stored = String(storedHash || "");
      if (!stored) return false;
      if (stored === fallbackHashSecret(value)) return true;
      const sha = await shaSecret(value);
      return Boolean(sha && stored === sha);
    }

    function createSecretToken(prefix = "mesa") {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      const body = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      return `${prefix}-${body}`;
    }

    function encodeInvitePayload(prefix, payload) {
      return `${prefix}:${btoa(encodeURIComponent(JSON.stringify(payload)))}`;
    }

    function createInviteCode(tableId) {
      const payload = {
        app: "mesa-arcana",
        version: 1,
        tableId,
        supabaseUrl: supabaseConfig.url,
        supabaseKey: supabaseConfig.key
      };
      return encodeInvitePayload("MESA-ARCANA", payload);
    }

    function createMasterInviteCode(tableId, masterKey) {
      return encodeInvitePayload("MESA-ARCANA-MESTRE", {
        app: "mesa-arcana",
        version: 1,
        role: "master",
        tableId,
        masterKey,
        supabaseUrl: supabaseConfig.url,
        supabaseKey: supabaseConfig.key
      });
    }

    function readInviteCode(value) {
      const text = String(value || "").trim();
      const masterPrefix = "MESA-ARCANA-MESTRE:";
      const playerPrefix = "MESA-ARCANA:";
      if (!text.startsWith(masterPrefix) && !text.startsWith(playerPrefix)) {
        return { role: "player", tableId: text };
      }
      try {
        const isMasterInvite = text.startsWith(masterPrefix);
        const prefix = isMasterInvite ? masterPrefix : playerPrefix;
        const payload = JSON.parse(decodeURIComponent(atob(text.slice(prefix.length))));
        if (payload.app !== "mesa-arcana" || !payload.tableId) throw new Error("Convite invalido");
        return {
          role: isMasterInvite ? "master" : "player",
          tableId: String(payload.tableId || "").trim(),
          masterKey: String(payload.masterKey || "").trim(),
          supabaseUrl: String(payload.supabaseUrl || "").trim().replace(/\/+$/, ""),
          supabaseKey: String(payload.supabaseKey || "").trim()
        };
      } catch (error) {
        console.warn("Convite invalido.", error);
        return null;
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    async function readImageFile(file, options = {}) {
      const original = await readFileAsDataUrl(file);
      try {
        const image = await loadImageElement(original);
        const maxSize = options.maxSize || 1280;
        const quality = options.quality || .78;
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = longestSide > maxSize ? maxSize / longestSide : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        const type = canvas.toDataURL("image/webp", quality).startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
        const compressed = canvas.toDataURL(type, quality);
        return compressed.length < original.length ? compressed : original;
      } catch (error) {
        console.warn("Não foi possível comprimir a imagem. Salvando original.", error);
        return original;
      }
    }


    function formatTableDate(value) {
      if (!value) return "Sem alterações";
      return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    }

    function tableRoleLabel(role) {
      return role === "master" ? "Mestre" : "Jogador";
    }

    function tableIdentityLabel(table) {
      if (!table) return "";
      return table.role === "player" && table.playerName
        ? `${table.name} · ${table.playerName}`
        : `${table.name} · ${tableRoleLabel(table.role)}`;
    }

    function renderTableLauncher() {
      const list = document.querySelector("#tableList");
      if (!tableRegistry.length) {
        list.innerHTML = '<div class="empty">Nenhuma mesa neste dispositivo ainda.</div>';
        return;
      }
      list.innerHTML = tableRegistry.map(table => `
        <div class="table-row">
          <button class="table-card" data-table-id="${table.id}">
            <span>
              <strong>${escapeHtml(table.name)}</strong>
              <small>${escapeHtml(formatTableDate(table.updatedAt))}</small>
            </span>
            <span class="role-pill ${table.role === "master" ? "master" : ""}">${escapeHtml(table.role === "player" && table.playerName ? table.playerName : tableRoleLabel(table.role))}</span>
          </button>
          <button class="table-remove" data-remove-table-id="${table.id}" title="Remover deste dispositivo" aria-label="Remover ${escapeHtml(table.name)} deste dispositivo">
            ${iconTrash()}
          </button>
        </div>
      `).join("");
      list.querySelectorAll("[data-table-id]").forEach(button => {
        button.addEventListener("click", () => openTable(button.dataset.tableId));
      });
      list.querySelectorAll("[data-remove-table-id]").forEach(button => {
        button.addEventListener("click", () => removeLocalTable(button.dataset.removeTableId));
      });
    }

    async function removeLocalTable(id) {
      const table = tableRegistry.find(item => item.id === id);
      if (!table) return;
      const label = tableIdentityLabel(table);
      const confirmed = await askConfirm({
        title: "Remover deste dispositivo?",
        message: `"${label}" será removida apenas deste aparelho. Isso não apaga nada do Supabase.`,
        confirmText: "Remover",
        danger: true
      });
      if (!confirmed) return;
      tableRegistry = tableRegistry.filter(item => item.id !== id);
      if (activeTableId === id) {
        activeTableId = null;
        removeLocalValue(activeTableStoreKey);
      }
      saveTableRegistry();
      renderTableLauncher();
    }

    function showLauncher() {
      clearIndividualSecrets();
      stopCloudAutoRefresh();
      activeTableId = null;
      removeLocalValue(activeTableStoreKey);
      document.querySelector("#app").classList.add("hidden");
      document.querySelector("#launcher").classList.remove("hidden");
      renderTableLauncher();
    }

    function openTable(id) {
      clearIndividualSecrets();
      const table = tableRegistry.find(item => item.id === id);
      if (!table) {
        showLauncher();
        return;
      }
      activeTableId = id;
      writeLocalValue(activeTableStoreKey, id);
      data = table.role === "player" ? playerSafeData(table.data) : normalizeData(table.data);
      if (table.role === "player" && table.playerName) {
        upsertPlayerProfile(table.playerName);
        table.data = data;
        saveTableRegistry();
        scheduleCloudTableSave();
      }
      document.querySelector("#launcher").classList.add("hidden");
      document.querySelector("#app").classList.remove("hidden");
      applyTableRole();
      selectView("dashboard");
      render();
      renderSessions();
      startCloudAutoRefresh();
    }

    async function createLocalTable(role, tableName = "") {
      const fallback = role === "master" ? "Nova mesa" : "Mesa do jogador";
      const name = String(tableName || fallback).trim() || fallback;
      const table = createTableRecord(name, role, {
        ...initialData,
        campaign: { ...initialData.campaign, name }
      });
      tableRegistry.unshift(table);
      saveTableRegistry();
      openTable(table.id);
      if (role === "master" && hasSupabaseConfig()) {
        await createOnlineTable();
      } else if (role === "master") {
        selectView("settings");
        setSupabaseStatus("Configure o Supabase para gerar convite", "local");
      }
    }

    async function validateJoinInviteFirstStep() {
      setDialogError("joinTableError");
      const code = document.querySelector("#joinInviteInput").value;
      if (!code.trim()) {
        setDialogError("joinTableError", "Cole o convite da mesa.");
        return false;
      }
      const invite = readInviteCode(code);
      if (!invite?.tableId) {
        setDialogError("joinTableError", "Esse convite não parece válido.");
        return false;
      }
      if (invite.supabaseUrl && invite.supabaseKey) {
        supabaseConfig = { url: invite.supabaseUrl, key: invite.supabaseKey };
        supabaseClient = null;
        writeLocalValue(supabaseConfigStoreKey, JSON.stringify(supabaseConfig));
        fillSupabaseConfigForm();
        setSupabaseStatus("Supabase configurado pelo convite", "synced");
      }
      const client = getSupabaseClient();
      if (!client) {
        setDialogError("joinTableError", "Não consegui conectar na nuvem agora. Peça para o Mestre enviar o convite completo.");
        return false;
      }
      try {
        const identity = await campaignIdentity(invite.tableId, true);
        if (invite.role === "master" && identity.role !== "master") throw new Error("Conta não é o mestre desta campanha.");
        const { data: remoteTable, error } = await client
          .from("mesa_arcana_tables")
          .select("id,name,data,updated_at")
          .eq("id", invite.tableId)
          .single();
        if (error) throw error;
        const remoteData = normalizeData(remoteTable.data || initialData);
        if (invite.role === "master") {
          if (!invite.masterKey) {
            setDialogError("joinTableError", "Essa chave mestra não parece válida.");
            return false;
          }
          if (!await secretMatches(remoteData.masterAccessHash, invite.masterKey)) {
            setDialogError("joinTableError", "Chave mestra incorreta.");
            return false;
          }
          return joinOnlineTableByCode({ code, errorId: "joinTableError" });
        }
        pendingJoinInvite = { invite, remoteTable, remoteData };
        const profiles = safeList(remoteData.playerProfiles);
        document.querySelector("#joinInviteInput").readOnly = true;
        document.querySelector("#joinTableIntro").textContent = "Convite aceito. Agora informe quem está entrando nesta mesa.";
        document.querySelector("#joinDetailsHint").textContent = "Se esse personagem já existe, use o PIN dele. Se for o primeiro acesso, crie e repita um PIN.";
        document.querySelector("#joinCharacterNameBox").classList.remove("hidden");
        document.querySelector("#joinPinBox").classList.remove("hidden");
        document.querySelector("#joinPinConfirmBox").classList.remove("hidden");
        document.querySelector("#confirmJoinTableModal").textContent = "Entrar";
        document.querySelector("#joinCharacterNameInput").focus();
        if (profiles.length === 1) {
          document.querySelector("#joinCharacterNameInput").value = profiles[0].name || "";
        }
        updateJoinPinConfirmVisibility();
        return true;
      } catch (error) {
        console.warn("Erro ao validar convite.", error);
        setDialogError("joinTableError", error.message || "Não foi possível validar o convite.");
        return false;
      }
    }

    function updateJoinPinConfirmVisibility() {
      if (!pendingJoinInvite) return;
      const playerName = document.querySelector("#joinCharacterNameInput").value.trim();
      const profile = safeList(pendingJoinInvite.remoteData?.playerProfiles).find(item => item.name === playerName);
      const needsNewPin = !profile?.pinHash;
      document.querySelector("#joinPinConfirmBox").classList.toggle("hidden", !needsNewPin);
      document.querySelector("#joinDetailsHint").textContent = needsNewPin
        ? "Primeiro acesso desse personagem: crie um PIN e repita para confirmar."
        : "Personagem encontrado: informe o PIN dele para entrar neste dispositivo.";
    }

    async function joinOnlineTableByCode(options = {}) {
      const {
        code = "",
        characterName = "",
        pin = "",
        pinConfirm = "",
        errorId = ""
      } = options;
      const fail = message => {
        if (errorId) setDialogError(errorId, message);
        else setSupabaseStatus(message, "error");
      };
      if (!code) {
        fail("Cole o convite da mesa.");
        return false;
      }
      const invite = readInviteCode(code);
      if (!invite?.tableId) {
        fail("Esse convite não parece válido.");
        return false;
      }
      if (invite.supabaseUrl && invite.supabaseKey) {
        supabaseConfig = { url: invite.supabaseUrl, key: invite.supabaseKey };
        supabaseClient = null;
        writeLocalValue(supabaseConfigStoreKey, JSON.stringify(supabaseConfig));
        fillSupabaseConfigForm();
        setSupabaseStatus("Supabase configurado pelo convite", "synced");
      }
      const client = getSupabaseClient();
      if (!client) {
        fail("Não consegui conectar na nuvem agora. Peça para o Mestre enviar o convite completo.");
        return false;
      }
      try {
        const identity = await campaignIdentity(invite.tableId, true);
        if (invite.role === "master" && identity.role !== "master") throw new Error("Conta não é o mestre desta campanha.");
        const { data: remoteTable, error } = await client
          .from("mesa_arcana_tables")
          .select("id,name,data,updated_at")
          .eq("id", invite.tableId)
          .single();
        if (error) throw error;
        const remoteData = normalizeData(remoteTable.data || initialData);
        if (invite.role === "master") {
          if (!invite.masterKey) {
            fail("Essa chave mestra não parece válida.");
            return false;
          }
          if (!await secretMatches(remoteData.masterAccessHash, invite.masterKey)) {
            fail("Chave mestra incorreta.");
            return false;
          }
          const masterData = await masterDataFromCloud(remoteData, remoteData, invite.masterKey);
          const table = createTableRecord(remoteTable.name || "Mesa online", "master", masterData);
          table.onlineId = remoteTable.id;
          table.masterKey = invite.masterKey;
          table.updatedAt = remoteTable.updated_at || new Date().toISOString();
          tableRegistry = tableRegistry.filter(item => item.onlineId !== table.onlineId || item.role !== "master");
          tableRegistry.unshift(table);
          saveTableRegistry();
          openTable(table.id);
          closeJoinTableModal();
          return true;
        }
        if (!characterName || !characterName.trim()) {
          fail("Informe o nome da personagem.");
          return false;
        }
        const playerName = characterName.trim();
        if (identity.role !== "player" || identity.name !== playerName) {
          fail("Use o nome vinculado à sua conta pelo mestre.");
          return false;
        }
        let nextRemoteData = remoteData;
        let profile = safeList(nextRemoteData.playerProfiles).find(item => item.name === playerName);
        if (profile?.pinHash) {
          if (!pin) {
            fail(`Informe o PIN de ${playerName}.`);
            return false;
          }
          if (!await secretMatches(profile.pinHash, pin)) {
            fail("Senha/PIN incorreto.");
            return false;
          }
        } else {
          if (!pin || pin.trim().length < 3) {
            fail("Use um PIN com pelo menos 3 caracteres.");
            return false;
          }
          if (pin !== pinConfirm) {
            fail("Os PINs não conferem.");
            return false;
          }
          const pinHash = await hashSecret(pin);
          nextRemoteData.playerProfiles = safeList(nextRemoteData.playerProfiles);
          if (profile) {
            profile.pinHash = pinHash;
          } else {
            profile = { id: createId(), name: playerName, pinHash, cover: "", sheetImage: "" };
            nextRemoteData.playerProfiles.push(profile);
          }
          const { error: updateError } = await client
            .from("mesa_arcana_tables")
            .update({ data: normalizeData(nextRemoteData) })
            .eq("id", remoteTable.id);
          if (updateError) throw updateError;
        }
        const table = createTableRecord(remoteTable.name || "Mesa online", "player", nextRemoteData);
        table.onlineId = remoteTable.id;
        table.playerName = playerName;
        table.data = normalizeData(table.data);
        if (!table.data.playerProfiles.some(profile => profile.name === table.playerName)) {
          table.data.playerProfiles.push({ id: createId(), name: table.playerName, pinHash: "", cover: "", sheetImage: "" });
        }
        table.updatedAt = remoteTable.updated_at || new Date().toISOString();
        tableRegistry = tableRegistry.filter(item => item.onlineId !== table.onlineId);
        tableRegistry.unshift(table);
        saveTableRegistry();
        await registerTableParticipant(table);
        openTable(table.id);
        await saveOnlineTable();
        closeJoinTableModal();
        return true;
      } catch (error) {
        console.warn("Erro ao entrar na mesa online.", error);
        fail(error.message || "Não foi possível entrar nesta mesa.");
        return false;
      }
    }


    function applyTableRole() {
      renderPushSettings();
      const table = getActiveTable();
      const isMaster = table?.role === "master";
      document.querySelector('[data-view="master"]').classList.toggle("hidden", !isMaster);
      document.querySelector("#currentTableLabel").textContent = table ? tableIdentityLabel(table) : "";
      renderPlayerNavSubmenu();
    }

    function selectView(view) {
      closeMobileMore();
      const table = getActiveTable();
      const requestedView = table?.role !== "master" && view === "master" ? "dashboard" : view;
      document.querySelector("#playerNavSubmenu")?.classList.remove("open");
      document.querySelectorAll(".nav button").forEach(item => {
        item.classList.toggle("active", item.dataset.view === requestedView);
      });
      document.querySelector("#mobileMoreToggle").classList.toggle("active", ["master", "library", "settings"].includes(requestedView));
      document.querySelectorAll(".view").forEach(section => section.classList.toggle("hidden", section.id !== `view-${requestedView}`));
      document.querySelector("#pageTitle").textContent = pages[requestedView][0];
      document.querySelector("#pageIntro").textContent = pages[requestedView][1];
      document.querySelector("main").classList.toggle("messages-mode", requestedView === "messages");
      if (requestedView === "messages") {
        renderMessagesView();
        loadConversationMessages();
        startMessageAutoRefresh();
      } else {
        document.body.classList.remove("mobile-chat-open");
        stopMessageAutoRefresh();
        if (requestedView === "board" && table?.role === "master" && table.onlineId) {
          syncParticipantsFromCloud({ rerender: true });
        }
      }
    }

    function closePlayerNavSubmenu() {
      document.querySelector("#playerNavSubmenu")?.classList.remove("open");
    }

    function startCloudAutoRefresh() {
      stopCloudAutoRefresh();
      const activeTable = getActiveTable();
      if (!activeTable || !activeTable.onlineId) return;
      setSupabaseStatus("Atualizacao automatica ligada", "synced");
      cloudRefreshTimer = window.setInterval(() => {
        refreshOnlineTable({ silent: true });
      }, 5000);
    }

    function stopCloudAutoRefresh() {
      if (!cloudRefreshTimer) return;
      window.clearInterval(cloudRefreshTimer);
      cloudRefreshTimer = null;
    }

    function startMessageAutoRefresh() {
      stopMessageAutoRefresh();
      const activeTable = getActiveTable();
      if (!activeTable?.onlineId || !getActiveMessageTarget()) return;
      messageRefreshTimer = window.setInterval(() => {
        loadConversationMessages({ silent: true });
      }, 3000);
    }

    function stopMessageAutoRefresh() {
      if (!messageRefreshTimer) return;
      window.clearInterval(messageRefreshTimer);
      messageRefreshTimer = null;
    }

    function initializeApp() {
      fillSupabaseConfigForm();
      updateSupabaseConfigStatus();
      saveTableRegistry();
      if (getActiveTable()) {
        openTable(activeTableId);
      } else {
        showLauncher();
      }
    }

    function render() {
      renderPushSettings();
      applyTableRole();
      const activeTable = getActiveTable();
      const playerName = activeTable?.role === "player" ? activeTable.playerName : "";
      document.querySelector("#campaignName").value = data.campaign.name || "";
      document.querySelector("#campaignSummary").value = data.campaign.summary || "";
      document.querySelector("#sessionDate").value = data.campaign.date || "";
      document.querySelector("#sessionTone").value = data.campaign.tone || "Investigação";
      document.querySelector("#nextSession").textContent = data.campaign.date ? new Date(data.campaign.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data";

      document.querySelector("#statHooks").textContent = data.masterNotes.filter(note => note.type === "Gancho").length;
      document.querySelector("#statSecrets").textContent = data.masterNotes.filter(note => note.type === "Segredo").length;
      document.querySelector("#statPlayers").textContent = data.players.length;
      document.querySelector("#statShared").textContent = data.board.length;
      renderPlayerSheetPicker();
      renderPlayerSheet();
      const selectedPlayerName = currentPlayerOwner();
      document.querySelector("#playerAreaTitle").textContent = selectedPlayerName ? `Anotações de ${selectedPlayerName}` : "Anotações do jogador";
      document.querySelector("#playerAreaIntro").textContent = playerName
        ? `Anotações, pistas e tarefas vistas pelo ponto de vista de ${playerName}.`
        : selectedPlayerName
          ? `Visão do Mestre sobre a ficha de ${selectedPlayerName}.`
          : "O que esse personagem já descobriu, o que ainda está em aberto e o que quer fazer.";
      document.querySelector("#inventoryTitle").textContent = selectedPlayerName ? `Inventário de ${selectedPlayerName}` : "Inventário";
      document.querySelector("#inventoryIntro").textContent = playerName
        ? `Itens carregados por ${playerName} durante a campanha.`
        : selectedPlayerName
          ? `Itens carregados por ${selectedPlayerName} durante a campanha.`
          : "Itens carregados pelo jogador durante a campanha.";

      const focus = [
        ...data.masterNotes.filter(note => note.type === "Gancho").slice(0, 2).map(note => ({ ...note, label: "Gancho" })),
        ...data.board.filter(note => note.column === "Tarefas").slice(0, 1).map(note => ({ ...note, label: "Tarefa" }))
      ];
      document.querySelector("#focusList").innerHTML = focus.length
        ? focus.map(item => noteItem(item, item.label === "Tarefa" ? "board" : "masterNotes", `<span class="tag ${item.label === "Gancho" ? "private" : "shared"}">${item.label}</span>`)).join("")
        : empty("Adicione ganchos ou tarefas para montar os focos da próxima sessão.");

      const masterConfig = masterSections[activeMasterSection] || masterSections.secrets;
      activeMasterType = masterConfig.type;
      document.querySelectorAll("[data-master-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.masterTab === activeMasterSection);
      });
      document.querySelectorAll("[data-master-section]").forEach(section => {
        const sectionName = section.dataset.masterSection;
        section.classList.toggle("hidden", sectionName === "notes" ? ["npcs", "files"].includes(activeMasterSection) : sectionName !== activeMasterSection);
      });
      document.querySelector("#masterSectionTitle").textContent = masterConfig.title;
      document.querySelector("#masterSectionIntro").textContent = masterConfig.intro;
      document.querySelector("#masterTitle").placeholder = masterConfig.titlePlaceholder;
      document.querySelector("#masterBody").placeholder = masterConfig.bodyPlaceholder;
      document.querySelector("#addMaster").textContent = masterConfig.button;
      document.querySelector("#masterInlineForm").classList.add("hidden");
      const addMasterNoteButton = document.querySelector("#openMasterClue");
      addMasterNoteButton.classList.remove("hidden");
      addMasterNoteButton.title = masterConfig.button;
      addMasterNoteButton.setAttribute("aria-label", masterConfig.button);

      const masterVisible = data.masterNotes.filter(note => note.type === activeMasterType);
      document.querySelector("#masterList").innerHTML = masterVisible.length
        ? masterVisible.map(item => noteItem(item, "masterNotes", '<span class="tag private">privado</span>')).join("")
        : empty(masterConfig.empty);

      renderMasterNpcDossiers();
      renderMasterFiles();

      document.querySelector("#playerGrid").innerHTML = data.players.length
        ? data.players.map(player => `
          <article class="player-card" data-character-id="${player.id}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(player.character)}">
            <header>
              <div>
                <h3>${escapeHtml(player.character)}</h3>
                <small>${escapeHtml(player.name)}</small>
              </div>
              <button class="icon-btn" title="Remover" data-remove="players" data-id="${player.id}">${iconTrash()}</button>
            </header>
            <div class="character-card-body">
              <div class="character-card-copy">
                <div class="meta">
                  <span class="tag ${player.kind === "NPC" ? "private" : "shared"}">${escapeHtml(player.kind || "Jogador")}</span>
                  <span class="tag shared">${escapeHtml(player.state)}</span>
                </div>
                <p><strong>Objetivo:</strong> ${escapeHtml(player.focus)}</p>
                <p>${escapeHtml(player.notes)}</p>
              </div>
              ${player.cover
                ? `<img class="character-cover" src="${player.cover}" alt="Capa de ${escapeHtml(player.character)}">`
                : `<div class="character-cover" aria-hidden="true">${escapeHtml(characterInitials(player.character))}</div>`}
            </div>
          </article>`).join("")
        : empty("Adicione personagens dos jogadores e NPCs importantes da campanha.");

      ["Pistas", "Perguntas", "Tarefas"].forEach(column => {
        const notes = data.board
          .filter(item => item.column === column)
          .filter(itemBelongsToCurrentPlayer);
        document.getElementById(`col-${column}`).innerHTML = notes.length
          ? notes.map(item => noteItem(item, "board")).join("")
          : empty("Sem itens.");
      });

      renderLibrary();
      renderPlayerInventory();
      renderPlayerRelations();
      renderPlayerFiles();
      renderPlayerSections();
      renderMessagesView();
      bindRemoveButtons();
      bindCharacterCards();
    }

    function renderLibrary() {
      const query = document.querySelector("#librarySearch").value.trim().toLowerCase();
      const items = data.library.filter(item => {
        const text = `${item.title} ${item.type} ${item.body}`.toLowerCase();
        return text.includes(query);
      });
      document.querySelector("#libraryList").innerHTML = items.length
        ? items.map(item => libraryItem(item)).join("")
        : empty("Nada encontrado.");
    }

    function libraryItem(item) {
      return `
        <article class="item library-card" data-open-world-image="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(item.title)}">
          ${item.cover
            ? `<div class="library-cover"><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"></div>`
            : `<div class="library-cover" aria-hidden="true"><span>${escapeHtml(characterInitials(item.title))}</span></div>`}
          <div>
            <div class="item-head">
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <div class="meta"><span class="tag">${escapeHtml(item.type)}</span></div>
              </div>
              <button class="icon-btn" title="Remover" data-remove="library" data-id="${item.id}">${iconTrash()}</button>
            </div>
            <p>${escapeHtml(item.body || "")}</p>
          </div>
        </article>`;
    }

    document.querySelector("#libraryList").addEventListener("click", event => {
      if (event.target.closest("[data-remove]")) return;
      const button = event.target.closest("[data-open-world-image]");
      if (!button) return;
      openWorldImage(button.dataset.openWorldImage);
    });
    document.querySelector("#libraryList").addEventListener("keydown", event => {
      if (!event.target.matches("[data-open-world-image]") || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openWorldImage(event.target.dataset.openWorldImage);
    });
    function openWorldImage(id) {
      const item = data.library.find(entry => entry.id === id);
      if (!item) return;
      document.querySelector("#playerFileViewTitle").textContent = item.title || "Mapa";
      document.querySelector("#playerFileViewIntro").textContent = item.type || "Mundo";
      document.querySelector("#playerFileViewer").innerHTML = item.cover
        ? `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title || "Mapa")}">`
        : '<div class="sheet-preview-empty">Este item ainda não tem imagem.</div>';
      const notes = document.querySelector("#playerFileViewNotes");
      notes.textContent = item.body || "";
      notes.classList.toggle("hidden", !item.body);
      document.querySelector("#playerFileViewModal").classList.remove("hidden");
    }

    function bindRemoveButtons() {
      document.querySelectorAll("[data-remove]").forEach(button => {
        button.onclick = event => {
          event.stopPropagation();
          removeFrom(button.dataset.remove, button.dataset.id);
        };
      });
    }

    function bindCharacterCards() {
      document.querySelectorAll("[data-character-id]").forEach(card => {
        card.onclick = () => openCharacterModal(card.dataset.characterId);
        card.onkeydown = event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCharacterModal(card.dataset.characterId);
          }
        };
      });
    }

    function addItem(collection, item) {
      data[collection].unshift({ id: createId(), ...item });
      save();
    }


    function closeMobileMore() {
      document.querySelector("#mobileMoreMenu").classList.add("hidden");
      document.querySelector("#mobileMoreToggle").setAttribute("aria-expanded", "false");
    }
    document.querySelector("#mobileMoreToggle").addEventListener("click", () => {
      const menu = document.querySelector("#mobileMoreMenu");
      if (!menu.classList.contains("hidden")) { closeMobileMore(); return; }
      closePlayerNavSubmenu();
      const views = getActiveTable()?.role === "master" ? ["master", "library", "settings"] : ["library", "settings"];
      menu.replaceChildren(...views.map(view => {
        const source = document.querySelector(`.nav > button[data-view="${view}"]`);
        const button = source.cloneNode(true);
        button.removeAttribute("data-view");
        button.classList.remove("hidden");
        button.addEventListener("click", () => selectView(view));
        return button;
      }));
      menu.classList.remove("hidden");
      document.querySelector("#mobileMoreToggle").setAttribute("aria-expanded", "true");
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".mobile-more-container")) closeMobileMore();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.querySelector("#mobileMoreToggle").getAttribute("aria-expanded") === "true") {
        closeMobileMore();
        document.querySelector("#mobileMoreToggle").focus();
      }
    });
    window.matchMedia("(max-width: 620px)").addEventListener("change", closeMobileMore);
    document.querySelectorAll(".nav button[data-view]").forEach(button => {
      button.addEventListener("click", event => {
        const table = getActiveTable();
        closeMobileMore();
        if (
          button.dataset.view === "board"
          && table?.role === "master"
          && playerSheetProfiles().length
        ) {
          event.preventDefault();
          document.querySelector("#playerNavSubmenu")?.classList.toggle("open");
          return;
        }
        closePlayerNavSubmenu();
        selectView(button.dataset.view);
      });
    });

    document.addEventListener("click", event => {
      const menu = document.querySelector("#navPlayerMenu");
      if (menu && !menu.contains(event.target)) closePlayerNavSubmenu();
    });

    document.querySelectorAll("[data-player-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activePlayerSection = button.dataset.playerTab;
        renderPlayerSections();
      });
    });

    document.querySelector("#createTableBtn").addEventListener("click", openCreateTableModal);
    document.querySelector("#joinTableBtn").addEventListener("click", openJoinTableModal);
    document.querySelector("#settingsChangeTableBtn").addEventListener("click", showLauncher);
    document.querySelector("#closeCreateTableModal").addEventListener("click", closeCreateTableModal);
    document.querySelector("#cancelCreateTableModal").addEventListener("click", closeCreateTableModal);
    document.querySelector("#createTableModal").addEventListener("click", event => {
      if (event.target.id === "createTableModal") closeCreateTableModal();
    });
    document.querySelector("#confirmCreateTableModal").addEventListener("click", async () => {
      const name = document.querySelector("#createTableNameInput").value.trim();
      if (!name) {
        setDialogError("createTableError", "Dê um nome para a mesa.");
        return;
      }
      closeCreateTableModal();
      await createLocalTable("master", name);
    });
    document.querySelector("#createTableNameInput").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.querySelector("#confirmCreateTableModal").click();
      }
    });
    document.querySelector("#closeJoinTableModal").addEventListener("click", closeJoinTableModal);
    document.querySelector("#cancelJoinTableModal").addEventListener("click", closeJoinTableModal);
    document.querySelector("#joinTableModal").addEventListener("click", event => {
      if (event.target.id === "joinTableModal") closeJoinTableModal();
    });
    document.querySelector("#joinCharacterNameInput").addEventListener("input", updateJoinPinConfirmVisibility);
    document.querySelector("#confirmJoinTableModal").addEventListener("click", async () => {
      setDialogError("joinTableError");
      if (!pendingJoinInvite) {
        await validateJoinInviteFirstStep();
        return;
      }
      await joinOnlineTableByCode({
        code: document.querySelector("#joinInviteInput").value,
        characterName: document.querySelector("#joinCharacterNameInput").value,
        pin: document.querySelector("#joinPinInput").value,
        pinConfirm: document.querySelector("#joinPinConfirmInput").value,
        errorId: "joinTableError"
      });
    });
    document.querySelector("#closeInviteModal").addEventListener("click", closeInviteModal);
    document.querySelector("#doneInviteBtn").addEventListener("click", closeInviteModal);
    document.querySelector("#inviteModal").addEventListener("click", event => {
      if (event.target.id === "inviteModal") closeInviteModal();
    });
    document.querySelector("#copyInviteBtn").addEventListener("click", async () => {
      try {
        await copyTextToClipboard(lastInviteCode);
        setDialogError("inviteCopyStatus", "Código copiado.");
      } catch (error) {
        console.warn("Não foi possível copiar.", error);
        setDialogError("inviteCopyStatus", "Não consegui copiar automaticamente. Selecione o código e copie manualmente.");
      }
    });
    document.querySelector("#quickModalClose").addEventListener("click", () => closeQuickModal(null));
    document.querySelector("#quickModalCancel").addEventListener("click", () => closeQuickModal(null));
    document.querySelector("#quickModalConfirm").addEventListener("click", () => {
      const inputBox = document.querySelector("#quickModalInputBox");
      const hasInput = !inputBox.classList.contains("hidden");
      closeQuickModal(hasInput ? document.querySelector("#quickModalInput").value : true);
    });
    document.querySelector("#quickModalInput").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        closeQuickModal(event.target.value);
      }
    });
    document.querySelector("#quickModal").addEventListener("click", event => {
      if (event.target.id === "quickModal") closeQuickModal(null);
    });
    document.querySelector("#messageBackBtn").addEventListener("click", closeMessageChat);
    document.querySelector("#openGroupModal").addEventListener("click", openGroupModal);
    document.querySelector("#closeGroupModal").addEventListener("click", closeGroupModal);
    document.querySelector("#cancelGroupModal").addEventListener("click", closeGroupModal);
    document.querySelector("#saveGroup").addEventListener("click", saveMessageGroup);
    document.querySelector("#groupModal").addEventListener("click", event => {
      if (event.target.id === "groupModal") closeGroupModal();
    });
    document.querySelector("#replyAsSelect").addEventListener("change", event => {
      replyAsNpcId = event.target.value;
    });
    document.querySelector("#masterPlayerSelect").addEventListener("change", event => {
      activeMasterPlayerName = event.target.value;
      activeMessageTargetId = "";
      activeMessageNpc = "";
      activeConversationId = "";
      messageChatOpen = false;
      renderMessagesView();
      loadConversationMessages();
    });
    document.querySelector("#sendMessageBtn").addEventListener("click", sendConversationMessage);
    document.querySelector("#messageBody").addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendConversationMessage();
      }
    });

    document.querySelectorAll("[data-master-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activeMasterSection = button.dataset.masterTab;
        render();
      });
    });

    ["campaignName", "campaignSummary", "sessionDate", "sessionTone"].forEach(id => {
      document.getElementById(id).addEventListener("input", event => {
        const key = { campaignName: "name", campaignSummary: "summary", sessionDate: "date", sessionTone: "tone" }[id];
        data.campaign[key] = event.target.value;
        save();
      });
    });

    document.querySelector("#addMaster").addEventListener("click", () => {
      const title = document.querySelector("#masterTitle").value.trim();
      const body = document.querySelector("#masterBody").value.trim();
      if (!title || !body) return;
      addItem("masterNotes", { type: activeMasterType, title, body });
      document.querySelector("#masterTitle").value = "";
      document.querySelector("#masterBody").value = "";
    });
    document.querySelector("#masterNpcLinkedCharacter").addEventListener("change", event => {
      const linked = getCharacter(event.target.value);
      if (!linked) return;
      document.querySelector("#masterNpcName").value = linked.character || "";
      document.querySelector("#masterNpcRole").value = linked.name || "";
      document.querySelector("#masterNpcNotes").value = linked.notes || "";
    });
    document.querySelector("#openMasterNpcForm").addEventListener("click", () => {
      resetMasterNpcForm();
      openMasterNpcForm();
    });
    document.querySelector("#cancelMasterNpc").addEventListener("click", () => {
      resetMasterNpcForm();
      closeMasterNpcForm();
    });
    document.querySelector("#closeMasterNpcModal").addEventListener("click", () => {
      resetMasterNpcForm();
      closeMasterNpcForm();
    });
    document.querySelector("#masterNpcModal").addEventListener("click", event => {
      if (event.target.id === "masterNpcModal") {
        resetMasterNpcForm();
        closeMasterNpcForm();
      }
    });
    document.querySelector("#addMasterNpc").addEventListener("click", addMasterNpcDossier);
    let masterClueDraftImage = "";
    let masterClueImagePending = false;
    let masterNoteModalType = "Pista";
    let editingMasterNoteId = null;
    let masterNoteImageVersion = 0;
    function closeMasterClue() {
      masterNoteImageVersion++;
      masterClueImagePending = false;
      document.querySelector("#masterClueModal").classList.add("hidden");
    }
    function openMasterNoteEditor(id = null) {
      if (getActiveTable()?.role !== "master") return;
      const item = id ? data.masterNotes.find(note => note.id === id) : null;
      if (id && !item) return;
      const config = item ? Object.values(masterSections).find(section => section.type === item.type) : masterSections[activeMasterSection];
      if (!config || !["Segredo", "Local", "Pista", "Gancho"].includes(config.type)) return;
      editingMasterNoteId = item?.id || null;
      masterNoteImageVersion++;
      masterClueImagePending = false;
      document.querySelector("#saveMasterClue").disabled = false;
      masterNoteModalType = config.type;
      document.querySelector("#masterClueTitle").textContent = item ? "Editar " + config.button.replace(/^Adicionar /, "") : config.button;
      document.querySelector("#saveMasterClue").textContent = item ? "Salvar alterações" : config.button;
      document.querySelector("#masterClueName").placeholder = config.titlePlaceholder;
      document.querySelector("#masterClueBody").placeholder = config.bodyPlaceholder;
      document.querySelector("#masterCluePreview").alt = "Imagem da anotação";
      const supportsImage = ["Pista", "Local"].includes(config.type);
      document.querySelector("#masterClueImage").closest("label").classList.toggle("hidden", !supportsImage);
      masterClueDraftImage = supportsImage ? item?.image || "" : "";
      document.querySelector("#masterClueName").value = item?.title || "";
      document.querySelector("#masterClueBody").value = item?.body || "";
      document.querySelector("#masterClueImage").value = "";
      document.querySelector("#masterCluePreview").src = masterClueDraftImage;
      document.querySelector("#masterCluePreview").classList.toggle("hidden", !masterClueDraftImage);
      document.querySelector("#removeMasterNoteImage").classList.toggle("hidden", !masterClueDraftImage);
      document.querySelector("#masterClueError").classList.add("hidden");
      document.querySelector("#masterClueModal").classList.remove("hidden");
      document.querySelector("#masterClueName").focus();
    }
    document.querySelector("#openMasterClue").addEventListener("click", () => openMasterNoteEditor());
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-edit-master-note]");
      if (button) openMasterNoteEditor(button.dataset.editMasterNote);
    });
    document.querySelector("#removeMasterNoteImage").addEventListener("click", () => {
      masterClueDraftImage = "";
      document.querySelector("#masterClueImage").value = "";
      document.querySelector("#masterCluePreview").classList.add("hidden");
      document.querySelector("#removeMasterNoteImage").classList.add("hidden");
    });
    ["closeMasterClue", "cancelMasterClue"].forEach(id => document.getElementById(id).addEventListener("click", closeMasterClue));
    document.querySelector("#masterClueModal").addEventListener("click", event => { if (event.target.id === "masterClueModal") closeMasterClue(); });
    document.querySelector("#masterClueModal").addEventListener("keydown", event => { if (event.key === "Escape") closeMasterClue(); });
    document.querySelector("#masterClueImage").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      const version = ++masterNoteImageVersion;
      masterClueImagePending = true;
      document.querySelector("#saveMasterClue").disabled = true;
      try {
        const image = await readImageFile(file, { maxSize: 1800, quality: .82 });
        if (version !== masterNoteImageVersion) return;
        masterClueDraftImage = image;
        document.querySelector("#masterCluePreview").src = masterClueDraftImage;
        document.querySelector("#masterCluePreview").classList.remove("hidden");
        document.querySelector("#removeMasterNoteImage").classList.remove("hidden");
      } catch {
        if (version !== masterNoteImageVersion) return;
        const error = document.querySelector("#masterClueError");
        error.textContent = "Não foi possível abrir essa imagem.";
        error.classList.remove("hidden");
      } finally {
        if (version === masterNoteImageVersion) {
          masterClueImagePending = false;
          document.querySelector("#saveMasterClue").disabled = false;
        }
      }
    });
    document.querySelector("#saveMasterClue").addEventListener("click", () => {
      if (getActiveTable()?.role !== "master" || masterClueImagePending) return;
      const title = document.querySelector("#masterClueName");
      if (!title.value.trim()) { title.reportValidity(); title.focus(); return; }
      const fields = { title: title.value.trim(), body: document.querySelector("#masterClueBody").value.trim() };
      if (["Pista", "Local"].includes(masterNoteModalType)) fields.image = masterClueDraftImage;
      if (editingMasterNoteId) {
        const item = data.masterNotes.find(note => note.id === editingMasterNoteId && note.type === masterNoteModalType);
        if (!item) return;
        Object.assign(item, fields);
        save();
      } else addItem("masterNotes", { type: masterNoteModalType, ...fields });
      closeMasterClue();
    });
    document.querySelector("#masterList").addEventListener("click", event => {
      const button = event.target.closest("[data-clue-image]");
      if (!button || getActiveTable()?.role !== "master") return;
      const clue = data.masterNotes.find(item => item.id === button.dataset.clueImage);
      if (!clue?.image) return;
      document.querySelector("#playerFileViewTitle").textContent = clue.title;
      document.querySelector("#playerFileViewIntro").textContent = "Imagem privada do Mestre.";
      document.querySelector("#playerFileViewer").innerHTML = `<img src="${escapeHtml(clue.image)}" alt="${escapeHtml(clue.title)}">`;
      document.querySelector("#playerFileViewNotes").textContent = clue.body || "";
      document.querySelector("#playerFileViewNotes").classList.toggle("hidden", !clue.body);
      document.querySelector("#playerFileViewModal").classList.remove("hidden");
    });
    document.querySelector("#closePlannedNpc").addEventListener("click", closePlannedNpcSheet);
    document.querySelector("#plannedNpcModal").addEventListener("click", event => {
      if (event.target.id === "plannedNpcModal") closePlannedNpcSheet();
    });
    document.querySelector("#plannedNpcModal").addEventListener("keydown", event => {
      if (event.key === "Escape") closePlannedNpcSheet();
    });
    function editViewedPlannedNpc(reveal = false) {
      const id = viewingPlannedNpcId;
      closePlannedNpcSheet();
      openMasterNpcForm(id);
      if (reveal) document.querySelector("#revealMasterNpc").click();
    }
    document.querySelector("#editPlannedNpc").addEventListener("click", () => editViewedPlannedNpc());
    document.querySelector("#revealPlannedNpc").addEventListener("click", () => editViewedPlannedNpc(true));
    document.querySelector("#masterNpcFilter").addEventListener("change", () => { renderMasterNpcDossiers(); bindRemoveButtons(); });
    document.querySelector("#masterNpcCover").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        masterNpcCoverDraft = await readImageFile(file);
        const preview = document.querySelector("#masterNpcCoverPreview");
        preview.src = masterNpcCoverDraft;
        preview.classList.remove("hidden");
      } catch { document.querySelector("#masterNpcModalTitle").textContent = "Não foi possível abrir a foto"; }
    });
    document.querySelector("#revealMasterNpc").addEventListener("click", () => {
      if (getActiveTable()?.role !== "master" || !editingMasterNpcId) return;
      reviewingMasterNpc = true;
      document.querySelector("#masterNpcModalTitle").textContent = "Revisar cartão público";
      document.querySelector("#masterNpcForm").querySelectorAll("label").forEach(label => {
        label.classList.toggle("hidden", !label.querySelector("#masterNpcName, #masterNpcCover, #masterNpcDescription"));
      });
      document.querySelector("#revealMasterNpc").classList.add("hidden");
      document.querySelector("#addMasterNpc").textContent = "Confirmar e revelar";
    });

    document.querySelector("#masterFileInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) {
        masterFileDraftImage = "";
        document.querySelector("#masterFilePreview").classList.add("hidden");
        return;
      }
      masterFileDraftImage = await readImageFile(file, { maxSize: 1600, quality: .82 });
      const preview = document.querySelector("#masterFilePreview");
      preview.src = masterFileDraftImage;
      preview.classList.remove("hidden");
    });
    document.querySelector("#addMasterFile").addEventListener("click", () => {
      addMasterFile();
      if (!document.querySelector("#masterFileTitle").value && !masterFileDraftImage) closeMasterFileModal();
    });
    document.querySelector("#openMasterFileModal").addEventListener("click", () => {
      if (getActiveTable()?.role !== "master") return;
      document.querySelector("#masterFileModal").classList.remove("hidden");
      document.querySelector("#masterFileTitle").focus();
    });
    function closeMasterFileModal() { document.querySelector("#masterFileModal").classList.add("hidden"); }
    ["closeMasterFileModal", "cancelMasterFileModal"].forEach(id => document.getElementById(id).addEventListener("click", closeMasterFileModal));
    document.querySelector("#masterFileModal").addEventListener("click", event => { if (event.target.id === "masterFileModal") closeMasterFileModal(); });
    document.querySelector("#masterFileModal").addEventListener("keydown", event => { if (event.key === "Escape") closeMasterFileModal(); });

    document.querySelector("#openAddCharacterModal").addEventListener("click", openAddCharacterModal);
    document.querySelector("#closeAddCharacterModal").addEventListener("click", closeAddCharacterModal);
    document.querySelector("#cancelAddCharacter").addEventListener("click", closeAddCharacterModal);
    document.querySelector("#addCharacterModal").addEventListener("click", event => {
      if (event.target.id === "addCharacterModal") {
        closeAddCharacterModal();
      }
    });

    document.querySelector("#newCharacterCover").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) {
        newCharacterCover = "";
        document.querySelector("#newCharacterCoverPreview").classList.add("hidden");
        return;
      }
      newCharacterCover = await readImageFile(file);
      const preview = document.querySelector("#newCharacterCoverPreview");
      preview.src = newCharacterCover;
      preview.classList.remove("hidden");
    });

    document.querySelector("#addSecretButton").addEventListener("click", () => addSecretInput());

    document.querySelector("#characterModalAnnotations").addEventListener("input", event => {
      autoResizeTextarea(event.target);
      saveActiveCharacterAnnotations(event.target.value);
    });
    document.querySelector("#toggleCharacterMasterView").addEventListener("click", () => {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      activeCharacterMasterView = !activeCharacterMasterView;
      renderCharacterMasterView(character);
    });
    document.querySelector("#characterAnnotationPlayerSelect").addEventListener("change", event => {
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      activeMasterPlayerName = event.target.value;
      renderCharacterAnnotationPlayerSelect(character);
      const annotationsField = document.querySelector("#characterModalAnnotations");
      annotationsField.value = getCharacterAnnotation(character);
      autoResizeTextarea(annotationsField);
    });
    document.querySelector("#openInventoryItemModal").addEventListener("click", () => openInventoryItemModal());
    document.querySelector("#closeInventoryItemModal").addEventListener("click", closeInventoryItemModal);
    document.querySelector("#cancelInventoryItem").addEventListener("click", closeInventoryItemModal);
    document.querySelector("#saveInventoryItem").addEventListener("click", saveInventoryItem);
    document.querySelector("#deleteInventoryItem").addEventListener("click", removeInventoryItem);
    document.querySelector("#inventoryItemModal").addEventListener("click", event => {
      if (event.target.id === "inventoryItemModal") closeInventoryItemModal();
    });
    document.querySelector("#inventoryItemName").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveInventoryItem();
      }
    });
    document.querySelector("#inventoryItemImage").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      inventoryDraftImage = await readImageFile(file);
      const preview = document.querySelector("#inventoryItemPreview");
      preview.src = inventoryDraftImage;
      preview.classList.remove("hidden");
    });
    document.querySelector("#addPlayerRelation").addEventListener("click", savePlayerRelation);
    document.querySelector("#cancelPlayerRelationEdit").addEventListener("click", resetPlayerRelationForm);
    document.querySelector("#playerFileInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) {
        playerFileDraftImage = "";
        document.querySelector("#playerFilePreview").classList.add("hidden");
        return;
      }
      playerFileDraftImage = await readImageFile(file, { maxSize: 1600, quality: .82 });
      const preview = document.querySelector("#playerFilePreview");
      preview.src = playerFileDraftImage;
      preview.classList.remove("hidden");
    });
    document.querySelector("#addPlayerFile").addEventListener("click", addPlayerFile);
    document.querySelector("#closePlayerFileViewModal").addEventListener("click", closePlayerFileView);
    document.querySelector("#playerFileViewModal").addEventListener("click", event => {
      if (event.target.id === "playerFileViewModal") closePlayerFileView();
    });

    document.querySelector("#openPlayerSheetModal").addEventListener("click", openPlayerSheetImageModal);
    document.querySelector("#playerSheetPortrait").addEventListener("click", event => {
      event.stopPropagation();
      if (!canEditCurrentPlayerSheet()) return;
      document.querySelector("#playerPortraitInput").click();
    });
    document.querySelector("#playerPortraitInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      await updateCurrentPlayerPortrait(file);
      event.target.value = "";
    });
    document.querySelector("#changePlayerSheetImage").addEventListener("click", () => {
      if (!canEditCurrentPlayerSheet()) return;
      document.querySelector("#playerSheetImageInput").click();
    });
    document.querySelector("#playerSheetImageInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      await updateCurrentPlayerSheetImage(file);
      event.target.value = "";
    });
    document.querySelector("#closePlayerSheetImageModal").addEventListener("click", closePlayerSheetImageModal);
    document.querySelector("#donePlayerSheetImage").addEventListener("click", closePlayerSheetImageModal);
    document.querySelector("#playerSheetImageModal").addEventListener("click", event => {
      if (event.target.id === "playerSheetImageModal") closePlayerSheetImageModal();
    });

    document.querySelector("#addPlayer").addEventListener("click", () => {
      const existingCharacter = editingCharacterId ? getCharacter(editingCharacterId) : null;
      const player = {
        kind: document.querySelector("#characterKind").value,
        name: document.querySelector("#playerName").value.trim(),
        character: document.querySelector("#characterName").value.trim(),
        focus: document.querySelector("#playerFocus").value.trim(),
        state: document.querySelector("#playerState").value,
        notes: document.querySelector("#playerNotes").value.trim(),
        annotations: existingCharacter?.annotations || "",
        playerAnnotations: existingCharacter?.playerAnnotations || {},
        inventory: existingCharacter?.inventory || [],
        cover: newCharacterCover,
        sheetImage: existingCharacter?.sheetImage || "",
        photos: existingCharacter?.photos || [],
        secrets: getSecretInputs()
      };
      if (!player.character) return;
      if ((player.kind || "").toLowerCase() !== "npc") {
        const names = [player.character, player.name].filter(Boolean).map(name => name.trim().toLowerCase());
        data.hiddenPlayerProfiles = safeList(data.hiddenPlayerProfiles).filter(name => !names.includes(name));
      }
      if (editingCharacterId) {
        data.players = data.players.map(item => item.id === editingCharacterId ? { ...item, ...player } : item);
        save();
      } else {
        addItem("players", player);
      }
      closeAddCharacterModal();
    });

    document.querySelector("#modalCharacterCover").addEventListener("change", async event => {
      const file = event.target.files[0];
      const character = getCharacter(activeCharacterId);
      if (!file || !character) return;
      character.cover = await readImageFile(file);
      activePhotoIndex = 0;
      save();
      renderCharacterMedia();
    });

    document.querySelector("#addCharacterPhoto").addEventListener("change", async event => {
      const file = event.target.files[0];
      const character = getCharacter(activeCharacterId);
      if (!file || !character) return;
      character.photos = [...(character.photos || []), await readImageFile(file)];
      activePhotoIndex = characterMedia(character).length - 1;
      event.target.value = "";
      save();
      renderCharacterMedia();
    });

    document.querySelector("#previousCharacterPhoto").addEventListener("click", () => shiftCharacterMedia(-1));
    document.querySelector("#nextCharacterPhoto").addEventListener("click", () => shiftCharacterMedia(1));
    document.querySelector("#openPhotoGallery").addEventListener("click", openPhotoGallery);
    document.querySelector("#closePhotoGallery").addEventListener("click", closePhotoGallery);
    document.querySelector("#photoGalleryModal").addEventListener("click", event => {
      if (event.target.id === "photoGalleryModal") {
        closePhotoGallery();
      }
    });

    document.querySelector("#closeCharacterModal").addEventListener("click", closeCharacterModal);
    document.querySelector("#editCharacterFromModal").addEventListener("click", openEditCharacterModal);
    document.querySelector("#characterModal").addEventListener("click", event => {
      if (event.target.id === "characterModal") {
        closeCharacterModal();
      }
    });
    document.querySelector("#deleteCharacterFromModal").addEventListener("click", () => {
      if (activeCharacterId) {
        removeFrom("players", activeCharacterId);
      }
    });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && !document.querySelector("#addCharacterModal").classList.contains("hidden")) {
        closeAddCharacterModal();
        return;
      }
      if (event.key === "Escape" && !document.querySelector("#photoGalleryModal").classList.contains("hidden")) {
        closePhotoGallery();
        return;
      }
      if (event.key === "Escape" && !document.querySelector("#inventoryItemModal").classList.contains("hidden")) {
        closeInventoryItemModal();
        return;
      }
      if (event.key === "Escape" && !document.querySelector("#playerSheetImageModal").classList.contains("hidden")) {
        closePlayerSheetImageModal();
        return;
      }
      if (event.key === "Escape" && !document.querySelector("#playerFileViewModal").classList.contains("hidden")) {
        closePlayerFileView();
        return;
      }
      if (event.key === "Escape" && !document.querySelector("#characterModal").classList.contains("hidden")) {
        closeCharacterModal();
      }
    });

    document.querySelector("#addBoard").addEventListener("click", () => {
      const title = document.querySelector("#boardTitle").value.trim();
      const body = document.querySelector("#boardBody").value.trim();
      const column = document.querySelector("#boardColumn").value;
      if (!title || !body) return;
      addItem("board", { column, title, body, owner: currentPlayerOwner() });
      document.querySelector("#boardTitle").value = "";
      document.querySelector("#boardBody").value = "";
    });

    let libraryImagePending = false;
    let libraryImageVersion = 0;
    function closeLibraryModal() {
      libraryImageVersion++;
      libraryImagePending = false;
      document.querySelector("#libraryModal").classList.add("hidden");
      document.querySelector("#openLibraryModal").focus();
    }
    document.querySelector("#openLibraryModal").addEventListener("click", () => {
      libraryImageVersion++;
      libraryImagePending = false;
      libraryDraftCover = "";
      ["libraryTitle", "libraryBody", "libraryCover"].forEach(id => document.getElementById(id).value = "");
      document.querySelector("#libraryType").selectedIndex = 0;
      document.querySelector("#libraryCoverPreview").classList.add("hidden");
      document.querySelector("#libraryCover").setCustomValidity("");
      document.querySelector("#addLibrary").disabled = false;
      document.querySelector("#libraryModal").classList.remove("hidden");
      document.querySelector("#libraryTitle").focus();
    });
    ["closeLibraryModal", "cancelLibraryModal"].forEach(id => document.getElementById(id).addEventListener("click", closeLibraryModal));
    document.querySelector("#libraryModal").addEventListener("click", event => { if (event.target.id === "libraryModal") closeLibraryModal(); });
    document.querySelector("#libraryModal").addEventListener("keydown", event => { if (event.key === "Escape") closeLibraryModal(); });
    document.querySelector("#addLibrary").addEventListener("click", () => {
      if (libraryImagePending) return;
      const title = document.querySelector("#libraryTitle").value.trim();
      const body = document.querySelector("#libraryBody").value.trim();
      const type = document.querySelector("#libraryType").value;
      if (!title || !body) {
        const input = document.querySelector(!title ? "#libraryTitle" : "#libraryBody");
        input.reportValidity(); input.focus(); return;
      }
      addItem("library", { type, title, body, cover: libraryDraftCover });
      document.querySelector("#libraryTitle").value = "";
      document.querySelector("#libraryBody").value = "";
      document.querySelector("#libraryCover").value = "";
      document.querySelector("#libraryCoverPreview").classList.add("hidden");
      libraryDraftCover = "";
      closeLibraryModal();
    });

    document.querySelector("#librarySearch").addEventListener("input", renderLibrary);
    document.querySelector("#libraryCover").addEventListener("change", async event => {
      const file = event.target.files[0];
      const version = ++libraryImageVersion;
      event.target.setCustomValidity("");
      if (!file) {
        libraryImagePending = false;
        document.querySelector("#addLibrary").disabled = false;
        libraryDraftCover = "";
        document.querySelector("#libraryCoverPreview").classList.add("hidden");
        return;
      }
      libraryImagePending = true;
      document.querySelector("#addLibrary").disabled = true;
      try {
        const cover = await readImageFile(file);
        if (version !== libraryImageVersion) return;
        libraryDraftCover = cover;
        const preview = document.querySelector("#libraryCoverPreview");
        preview.src = libraryDraftCover;
        preview.classList.remove("hidden");
      } catch {
        if (version !== libraryImageVersion) return;
        event.target.setCustomValidity("Não foi possível abrir essa imagem.");
        event.target.reportValidity();
      } finally {
        if (version === libraryImageVersion) {
          libraryImagePending = false;
          document.querySelector("#addLibrary").disabled = false;
        }
      }
    });

    document.querySelector("#saveSupabaseConfigBtn").addEventListener("click", saveSupabaseConfig);
    document.querySelector("#clearSupabaseConfigBtn").addEventListener("click", clearSupabaseConfig);
    document.querySelector("#testSupabaseBtn").addEventListener("click", testSupabaseConnection);
    document.querySelector("#createOnlineTableBtn").addEventListener("click", createOnlineTable);
    document.querySelector("#createMasterInviteBtn").addEventListener("click", createMasterInvite);
    document.querySelector("#saveOnlineTableBtn").addEventListener("click", saveOnlineTable);
    document.querySelector("#loadOnlineTableBtn").addEventListener("click", loadOnlineTable);

    // Diário de bordo das sessões
    let activeSessionId = null;


    document.querySelector("#saveIndividualSecrets").addEventListener("click", saveIndividualSecrets);
    document.querySelector("#individualSecretsPlayer").addEventListener("change", event => loadIndividualSecrets(event.target.value));
    document.querySelector("#reloadIndividualSecrets").addEventListener("click", () => loadIndividualSecrets(document.querySelector("#individualSecretsPlayer").value));
    document.querySelector("#loginCloudAccount").addEventListener("click", loginCloudAccount);
    document.querySelector("#addVerifiedPlayer").addEventListener("click", addVerifiedPlayer);
    document.querySelector("#logoutCloudAccount").addEventListener("click", async () => {
      clearIndividualSecrets();
      const client = getSupabaseClient();
      if (client) await client.auth.signOut();
      setSupabaseStatus("Conta desconectada", "local");
    });

    let pushOperationBusy = false;
    let pushOperationError = "";
    let pushOperationIdentity = "";
    function pushStorageKey(table = getActiveTable()) {
      return `mesa-arcana-push:${supabaseConfig.url}:${table?.onlineId}:${table?.role}:${table?.playerName || ""}`;
    }

    function renderPushSettings() {
      const table = getActiveTable();
      const saved = readLocalValue(pushStorageKey());
      const supported = window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      document.querySelector("#enablePush").disabled = pushOperationBusy || !supported || !table?.onlineId;
      document.querySelector("#disablePush").disabled = pushOperationBusy;
      document.querySelector("#enablePush").classList.toggle("hidden", Boolean(saved));
      document.querySelector("#disablePush").classList.toggle("hidden", !saved);
      document.querySelector("#pushStatus").textContent = pushOperationIdentity === pushStorageKey() && pushOperationError ? pushOperationError : !supported
        ? "Notificações exigem HTTPS e um navegador compatível. No iPhone, abra o app instalado na tela inicial."
        : !table?.onlineId ? "Entre em uma mesa online para ativar notificações."
        : saved && Notification.permission === "granted" ? "Notificações ativadas nesta mesa e neste dispositivo. O texto poderá aparecer na tela bloqueada."
        : "Ative para receber o nome e a mensagem de quem enviou, inclusive na tela bloqueada.";
    }

    async function callPushService(payload) {
      const response = await fetch(`${supabaseConfig.url}/functions/v1/mesa-push`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseConfig.key },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "O serviço de notificações ainda precisa ser configurado no Supabase.");
        error.status = response.status;
        throw error;
      }
      return result;
    }

    function pushPublicKey(value) {
      const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    }

    async function requestMasterPushKey(table) {
      const value = await askInput({
        title: "Confirmar acesso do Mestre",
        message: "Cole seu convite de Mestre para ativar as notificações neste dispositivo.",
        inputLabel: "Convite ou chave mestra", inputType: "password", confirmText: "Ativar"
      });
      if (value === null) return null;
      const trimmed = value.trim();
      if (!trimmed) throw new Error("Informe o convite de Mestre para continuar.");
      if (!trimmed.startsWith("MESA-ARCANA")) return trimmed;
      const invite = readInviteCode(trimmed);
      if (invite?.role !== "master" || !invite.masterKey || invite.tableId !== table.onlineId || (invite.supabaseUrl && invite.supabaseUrl !== supabaseConfig.url)) {
        throw new Error("Use um convite de Mestre válido para esta mesa.");
      }
      return invite.masterKey;
    }

    document.querySelector("#enablePush").addEventListener("click", async () => {
      const table = getActiveTable();
      if (!table?.onlineId || pushOperationBusy) return;
      const identity = pushStorageKey(table);
      pushOperationIdentity = identity;
      pushOperationBusy = true;
      pushOperationError = "";
      renderPushSettings();
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notificações não autorizadas. Você pode permitir nas configurações do navegador.");
        const config = await callPushService({ action: "config" });
        if (!config.publicKey) throw new Error("O serviço de notificações ainda precisa ser configurado no Supabase.");
        let secret = table.role === "master" ? table.masterKey || await requestMasterPushKey(table) : await askInput({
          title: "Ativar notificações", inputLabel: "Confirme seu PIN", inputType: "password", confirmText: "Ativar"
        });
        if (!secret) return;
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushPublicKey(config.publicKey) });
        const subscribe = () => callPushService({ action: "subscribe", tableId: table.onlineId, role: table.role, playerName: table.playerName || "", secret, subscription: subscription.toJSON() });
        let result;
        try { result = await subscribe(); }
        catch (error) {
          if (table.role !== "master" || error.status !== 403) throw error;
          secret = await requestMasterPushKey(table);
          if (!secret) return;
          result = await subscribe();
        }
        if (table.role === "master") {
          table.masterKey = secret;
          saveTableRegistry();
        }
        writeLocalValue(identity, JSON.stringify({ token: result.token }));
        renderPushSettings();
      } catch (error) {
        pushOperationError = error.message;
      } finally { pushOperationBusy = false; renderPushSettings(); }
    });

    document.querySelector("#disablePush").addEventListener("click", async () => {
      try {
        pushOperationIdentity = pushStorageKey();
        pushOperationError = "";
        const saved = JSON.parse(readLocalValue(pushStorageKey()) || "{}");
        await callPushService({ action: "unsubscribe", tableId: getActiveTable()?.onlineId, token: saved.token });
        removeLocalValue(pushStorageKey());
        renderPushSettings();
      } catch (error) { pushOperationError = error.message; renderPushSettings(); }
    });

    async function openPushConversation() {
      const url = new URL(window.location.href);
      const onlineId = url.searchParams.get("pushTable");
      const conversationKey = url.searchParams.get("pushConversation");
      if (!onlineId || !conversationKey) return;
      url.searchParams.delete("pushTable"); url.searchParams.delete("pushConversation");
      history.replaceState(null, "", url);
      const table = tableRegistry.find(item => item.onlineId === onlineId && (item.role === "master" || conversationKey.endsWith(`:${item.playerName}`)));
      if (!table) return;
      openTable(table.id);
      await refreshOnlineTable({ force: true, silent: true });
      if (table.role === "master") activeMasterPlayerName = "";
      const target = getMessageTargets().find(item => item.conversationKey === conversationKey);
      if (!target) return;
      activeMasterPlayerName = target.playerName;
      selectView("messages");
      await selectMessageTarget(target);
    }

    function ensureSessions() {
      if (!Array.isArray(data.sessions)) data.sessions = [];
    }

    function formatSessionDate(value) {
      if (!value) return "Sem data";
      const parts = value.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
    }

    function renderSessions() {
      ensureSessions();
      const list = document.getElementById("sessionList");
      if (!list) return;
      if (!data.sessions.length) {
        list.innerHTML = '<div class="empty">Nenhuma sessão registrada ainda. Use + para criar a primeira.</div>';
        return;
      }
      list.innerHTML = data.sessions.map((session, index) => `
        <button class="session-row" data-session-id="${session.id}">
          <span class="session-number">${String(index + 1).padStart(2, "0")}</span>
          <span>
            <strong>${escapeHtml(session.title || `Sessão ${index + 1}`)}</strong>
            <small>${formatSessionDate(session.date)}${sessionHasDiary(session) ? " · Diário iniciado" : ""}</small>
          </span>
          <span class="session-arrow">›</span>
        </button>
      `).join("");
      list.querySelectorAll("[data-session-id]").forEach(button => {
        button.addEventListener("click", () => openSession(button.dataset.sessionId));
      });
    }

    function openSession(id) {
      ensureSessions();
      const session = data.sessions.find(item => item.id === id);
      if (!session) return;
      activeSessionId = id;
      document.getElementById("sessionModalTitle").textContent = session.title || "Sessão";
      document.getElementById("sessionModalDateLabel").textContent = formatSessionDate(session.date);
      document.getElementById("sessionTitleInput").value = session.title || "";
      document.getElementById("sessionDateInput").value = session.date || "";
      document.getElementById("sessionSummaryInput").value = session.diary || "";
      renderSessionDiaryPlayerSelect(session);
      document.getElementById("sessionDiaryInput").value = getSessionDiary(session);
      document.getElementById("sessionModal").classList.remove("hidden");
    }

    function closeSession() {
      document.getElementById("sessionModal").classList.add("hidden");
      activeSessionId = null;
    }

    document.getElementById("addSessionBtn")?.addEventListener("click", () => {
      ensureSessions();
      const number = data.sessions.length + 1;
      const session = {
        id: createId(),
        title: `Sessão ${String(number).padStart(2, "0")}`,
        date: "",
        diary: "",
        playerDiaries: {}
      };
      data.sessions.push(session);
      save();
      renderSessions();
      openSession(session.id);
    });

    document.getElementById("saveSessionBtn")?.addEventListener("click", () => {
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) return;
      session.title = document.getElementById("sessionTitleInput").value.trim() || "Sessão";
      session.date = document.getElementById("sessionDateInput").value;
      session.diary = document.getElementById("sessionSummaryInput").value;
      setSessionDiary(session, document.getElementById("sessionDiaryInput").value);
      save();
      renderSessions();
      closeSession();
    });

    document.getElementById("sessionDiaryPlayerSelect")?.addEventListener("change", event => {
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) return;
      activeMasterPlayerName = event.target.value;
      renderSessionDiaryPlayerSelect(session);
      const diaryField = document.getElementById("sessionDiaryInput");
      diaryField.value = getSessionDiary(session);
      autoResizeTextarea(diaryField);
    });

    document.getElementById("deleteSessionBtn")?.addEventListener("click", () => {
      if (!activeSessionId) return;
      data.sessions = data.sessions.filter(item => item.id !== activeSessionId);
      save();
      renderSessions();
      closeSession();
    });

    document.getElementById("closeSessionModal")?.addEventListener("click", closeSession);
    document.getElementById("sessionModal")?.addEventListener("click", event => {
      if (event.target.id === "sessionModal") closeSession();
    });


    initializeApp();
    openPushConversation();

    if ("serviceWorker" in navigator && ["https:", "http:"].includes(window.location.protocol)) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloadingForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController && !reloadingForUpdate) {
          reloadingForUpdate = true;
          window.location.reload();
        }
      });
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).catch(error => {
          console.warn("Não foi possível ativar o modo app/offline.", error);
        });
      });
    }

    function refreshAfterResume() {
      if (document.visibilityState === "hidden") return;
      if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
      if (getActiveTable()?.onlineId) refreshOnlineTable({ force: true, silent: true });
    }
    window.addEventListener("online", refreshAfterResume);
    document.addEventListener("visibilitychange", refreshAfterResume);

