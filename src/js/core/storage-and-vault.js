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
        return saveTableRegistry();
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

