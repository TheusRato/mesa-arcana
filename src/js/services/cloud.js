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
        const snapshot = JSON.parse(JSON.stringify(data));
        const pending = JSON.parse(JSON.stringify(activeTable.pendingPlayerVersions || {}));
        let nextData, savedRow;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: remoteTable, error: readError } = await client
            .from("mesa_arcana_tables").select("data,updated_at").eq("id", activeTable.onlineId).single();
          if (readError) throw readError;
          nextData = activeTable.role === "master"
            ? await cloudDataForMaster(activeTable, snapshot)
            : mergePlayerWritableData(remoteTable.data || initialData, snapshot);
          nextData.players = mergePersonalCharacterVersions(
            remoteTable.data?.players, nextData.players, pending,
            activeTable.role === "master" ? null : activeTable.playerName
          );
          const { data: updated, error } = await client.from("mesa_arcana_tables")
            .update({ name: activeTable.name || snapshot.campaign.name || "Mesa sem nome", data: nextData })
            .eq("id", activeTable.onlineId).eq("updated_at", remoteTable.updated_at)
            .select("updated_at").maybeSingle();
          if (error) throw error;
          if (updated) { savedRow = updated; break; }
        }
        if (!savedRow) throw new Error("A mesa está recebendo outras alterações. Tente salvar novamente; sua versão permanece neste dispositivo.");
        acknowledgePersonalCharacterVersions(activeTable, pending);
        if (saveVersion === cloudChangeVersion) activeTable.pendingCloudSave = false;
        // Keep edits made while this request was in flight and incorporate other players' versions.
        if (getActiveTable() === activeTable) {
          data.players = mergePersonalCharacterVersions(nextData.players, data.players, activeTable.pendingPlayerVersions || {});
          activeTable.data = normalizeData(data);
        }
        activeTable.updatedAt = savedRow.updated_at;
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

