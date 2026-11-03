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
      configureGroupHeader(null);
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
      configureGroupHeader(activeTarget);
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
        if (getActiveTable() !== table || activeConversationId !== conversationId) return;
        loadedMessageContext = { tableId: table.id, conversationId, messages: safeList(messages) };
        renderConversationMessages();
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


    let groupDetailsId = "";
    let groupDetailsTableId = "";

    function configureGroupHeader(target) {
      const header = document.querySelector("#messageGroupHeader");
      const isGroup = target?.type === "group";
      header.classList.toggle("group-header-link", isGroup);
      if (isGroup) {
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-label", `Ver integrantes de ${target.npcName}`);
        header.setAttribute("aria-haspopup", "dialog");
      } else {
        ["role", "tabindex", "aria-label", "aria-haspopup"].forEach(name => header.removeAttribute(name));
      }
    }

    function currentDetailsGroup() {
      if (getActiveTable()?.id !== groupDetailsTableId) return null;
      return safeList(data.messageGroups).find(group => group.id === groupDetailsId) || null;
    }

    function openGroupDetails() {
      const target = getActiveMessageTarget();
      if (target?.type !== "group") return;
      groupDetailsId = target.groupId;
      groupDetailsTableId = getActiveTable()?.id;
      if (!currentDetailsGroup()) return;
      closeAddGroupPeople();
      renderGroupDetails();
      document.querySelector("#groupDetailsModal").classList.remove("hidden");
      document.querySelector("#closeGroupDetails").focus();
    }

    function closeGroupDetails() {
      document.querySelector("#groupDetailsModal").classList.add("hidden");
      groupDetailsId = "";
      groupDetailsTableId = "";
      document.querySelector("#messageGroupHeader").focus();
    }

    function renderGroupDetails() {
      const group = currentDetailsGroup();
      if (!group) { closeGroupDetails(); return; }
      const master = getActiveTable()?.role === "master";
      const members = [
        ...safeList(group.npcIds).map(id => {
          const npc = safeList(data.players).find(character => character.id === id);
          return { type: "npc", value: id, name: npc?.character || npc?.name || "NPC indisponível", label: "NPC" };
        }),
        ...safeList(group.playerNames).map(name => ({ type: "player", value: name, name, label: "Jogador" }))
      ];
      document.querySelector("#groupDetailsTitle").textContent = group.name;
      document.querySelector("#groupDetailsCount").textContent = `${members.length} integrante${members.length === 1 ? "" : "s"}`;
      document.querySelector("#groupMembersList").innerHTML = members.length ? members.map(member => `
        <div class="group-member-row">
          <div><strong>${escapeHtml(member.name)}</strong><small>${member.label}</small></div>
          ${master ? `<button type="button" class="btn danger" data-remove-group-member="${escapeHtml(member.value)}" data-member-type="${member.type}" aria-label="Remover ${escapeHtml(member.name)} do grupo">Remover</button>` : ""}
        </div>
      `).join("") : empty("Este grupo ainda não tem integrantes.");
      document.querySelector("#groupMemberControls").classList.toggle("hidden", !master);
    }

    async function openAddGroupPeople() {
      if (getActiveTable()?.role !== "master") return;
      const openingGroupId = groupDetailsId;
      const openingTableId = groupDetailsTableId;
      await syncParticipantsFromCloud({ force: true });
      if (openingGroupId !== groupDetailsId || openingTableId !== groupDetailsTableId || getActiveTable()?.role !== "master") return;
      const group = currentDetailsGroup();
      if (!group) return;
      const available = [
        ...allMessageContacts().filter(npc => !safeList(group.npcIds).includes(npc.npcId))
          .map(npc => ({ type: "npc", value: npc.npcId, name: npc.npcName, label: "NPC" })),
        ...playerSheetProfiles().filter(profile => !safeList(group.playerNames).includes(profile.name))
          .map(profile => ({ type: "player", value: profile.name, name: profile.name, label: "Jogador" }))
      ];
      document.querySelector("#groupAvailablePeople").innerHTML = available.length ? available.map(person => `
        <label class="group-option"><input type="checkbox" data-member-type="${person.type}" value="${escapeHtml(person.value)}"><span>${escapeHtml(person.name)} · ${person.label}</span></label>
      `).join("") : empty("Todos os jogadores e NPCs disponíveis já estão no grupo.");
      document.querySelector("#confirmAddGroupPeople").disabled = !available.length;
      document.querySelector("#groupAddPeoplePanel").classList.remove("hidden");
      document.querySelector("#addGroupPeople").setAttribute("aria-expanded", "true");
      document.querySelector("#groupAvailablePeople input")?.focus();
    }

    function closeAddGroupPeople() {
      document.querySelector("#groupAddPeoplePanel").classList.add("hidden");
      document.querySelector("#addGroupPeople").setAttribute("aria-expanded", "false");
    }

    function updateGroupMembers(group, npcIds, playerNames) {
      if (getActiveTable()?.role !== "master" || currentDetailsGroup() !== group) return false;
      // Preserve the existing group ID and every cloud conversation/message record.
      group.npcIds = [...new Set(npcIds)];
      group.playerNames = [...new Set(playerNames)];
      save();
      renderMessagesView();
      renderGroupDetails();
      // Removing the selected player may select another conversation. Load its own history.
      loadConversationMessages();
      return true;
    }

    function addSelectedGroupPeople() {
      if (getActiveTable()?.role !== "master") return;
      const group = currentDetailsGroup();
      if (!group) return;
      const selected = [...document.querySelectorAll("#groupAvailablePeople input:checked")];
      if (!selected.length) return;
      const availableNpcIds = allMessageContacts().map(npc => npc.npcId);
      const availablePlayerNames = playerSheetProfiles().map(profile => profile.name);
      const npcIds = selected.filter(input => input.dataset.memberType === "npc" && availableNpcIds.includes(input.value)).map(input => input.value);
      const playerNames = selected.filter(input => input.dataset.memberType === "player" && availablePlayerNames.includes(input.value)).map(input => input.value);
      if (updateGroupMembers(group, [...safeList(group.npcIds), ...npcIds], [...safeList(group.playerNames), ...playerNames])) {
        closeAddGroupPeople();
        document.querySelector("#addGroupPeople").focus();
      }
    }

    function removeGroupMember(type, value) {
      if (getActiveTable()?.role !== "master") return;
      const group = currentDetailsGroup();
      if (!group || !["npc", "player"].includes(type)) return;
      const npcIds = safeList(group.npcIds).filter(id => type !== "npc" || id !== value);
      const playerNames = safeList(group.playerNames).filter(name => type !== "player" || name !== value);
      if (updateGroupMembers(group, npcIds, playerNames)) {
        closeAddGroupPeople();
        document.querySelector("#closeGroupDetails").focus();
      }
    }

    let loadedMessageContext = null;
    let editingMessage = null;

    function messageOverrideFor(message, conversationId) {
      if (!["npc", "master"].includes(message.sender_role)) return null;
      const change = normalizeMessageOverrides(data.messageOverrides)[message.id];
      return change?.conversationId === conversationId ? change : null;
    }

    function renderConversationMessages() {
      const context = loadedMessageContext;
      const table = getActiveTable();
      if (!context || context.tableId !== table?.id || context.conversationId !== activeConversationId) return;
      const visible = context.messages.filter(message => !messageOverrideFor(message, context.conversationId)?.hidden);
      document.querySelector("#messageThread").innerHTML = visible.length ? visible.map(message => {
        const change = messageOverrideFor(message, context.conversationId);
        const editable = table.role === "master" && ["npc", "master"].includes(message.sender_role);
        return `<article class="message-bubble ${message.sender_role === "player" ? "player" : "npc"}">
          <small>${escapeHtml(message.sender_name)} · ${formatMessageTime(message.created_at)}</small>
          <span class="message-text">${escapeHtml(change?.body ?? message.body)}</span>
          ${editable ? `<div class="message-master-actions">
            <button type="button" class="btn" data-edit-message="${escapeHtml(message.id)}">Editar</button>
            <button type="button" class="btn danger" data-hide-message="${escapeHtml(message.id)}">Excluir</button>
          </div>` : ""}
        </article>`;
      }).join("") : empty("Nenhuma mensagem ainda.");
    }

    function masterMessageContext(messageId) {
      const table = getActiveTable();
      const context = loadedMessageContext;
      if (table?.role !== "master" || !table.onlineId || context?.tableId !== table.id || context.conversationId !== activeConversationId) return null;
      const message = context.messages.find(item => item.id === messageId && ["npc", "master"].includes(item.sender_role));
      if (!message || messageOverrideFor(message, context.conversationId)?.hidden) return null;
      return { tableId: table.id, conversationId: context.conversationId, message };
    }

    function applyMasterMessageChange(context, change) {
      const current = masterMessageContext(context.message.id);
      if (!current || current.tableId !== context.tableId || current.conversationId !== context.conversationId) return false;
      const table = getActiveTable();
      const entry = { conversationId: context.conversationId, ...change };
      const previous = data.messageOverrides;
      const previousPending = table.pendingMessageChanges;
      const previousCloudSave = table.pendingCloudSave;
      data.messageOverrides = { ...normalizeMessageOverrides(previous), [context.message.id]: entry };
      table.pendingMessageChanges = { ...normalizeMessageOverrides(previousPending), [context.message.id]: entry };
      table.pendingCloudSave = true;
      if (!persistLocalData()) {
        data.messageOverrides = previous;
        table.pendingMessageChanges = previousPending;
        table.pendingCloudSave = previousCloudSave;
        table.data = normalizeData(data);
        setMessageStatus("Não foi possível salvar a alteração neste dispositivo", "error");
        return false;
      }
      scheduleCloudTableSave();
      renderConversationMessages();
      setMessageStatus("Alteração salva neste dispositivo; sincronizando...", "local");
      return true;
    }

    function openEditMessage(messageId) {
      const context = masterMessageContext(messageId);
      if (!context) return;
      editingMessage = context;
      const input = document.querySelector("#editMessageBody");
      input.value = messageOverrideFor(context.message, context.conversationId)?.body ?? context.message.body;
      document.querySelector("#editMessageError").classList.add("hidden");
      document.querySelector("#editMessageModal").classList.remove("hidden");
      input.focus();
    }

    function closeEditMessage() {
      const id = editingMessage?.message.id;
      editingMessage = null;
      document.querySelector("#editMessageModal").classList.add("hidden");
      if (id) document.querySelector(`[data-edit-message="${CSS.escape(id)}"]`)?.focus();
    }

    function saveEditedMessage() {
      if (!editingMessage) return;
      const body = document.querySelector("#editMessageBody").value.trim();
      if (!body) {
        document.querySelector("#editMessageError").textContent = "Escreva uma mensagem antes de salvar.";
        document.querySelector("#editMessageError").classList.remove("hidden");
        return;
      }
      if (applyMasterMessageChange(editingMessage, { body, hidden: false })) closeEditMessage();
      else {
        document.querySelector("#editMessageError").textContent = "Não foi possível salvar. Confira a conversa e o armazenamento do dispositivo e tente novamente.";
        document.querySelector("#editMessageError").classList.remove("hidden");
      }
    }

    async function hideMasterMessage(messageId) {
      const context = masterMessageContext(messageId);
      if (!context) return;
      const confirmed = await askConfirm({
        title: "Excluir mensagem da conversa?",
        message: "Ela desaparecerá para o mestre e os jogadores, sem aviso de exclusão. As outras mensagens serão mantidas.",
        confirmText: "Excluir mensagem", danger: true
      });
      if (confirmed) applyMasterMessageChange(context, { hidden: true });
    }
