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

