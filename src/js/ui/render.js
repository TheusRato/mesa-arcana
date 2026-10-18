    function applyTableRole() {
      renderPushSettings();
      const table = getActiveTable();
      const isMaster = table?.role === "master";
      document.querySelector("#openAddCharacterModal").classList.toggle("hidden", !isMaster);
      document.querySelector("#addSessionBtn").classList.toggle("hidden", !isMaster);
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
        ? data.players.map(sourcePlayer => {
          const player = activeTable?.role === "player" ? characterForCurrentView(sourcePlayer) : sourcePlayer;
          return `
          <article class="player-card" data-character-id="${player.id}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(player.character)}">
            <header>
              <div>
                <h3>${escapeHtml(player.character)}</h3>
                <small>${escapeHtml(player.name)}</small>
              </div>
              ${activeTable?.role === "master" ? `<button class="icon-btn" title="Remover" data-remove="players" data-id="${player.id}">${iconTrash()}</button>` : ""}
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
          </article>`; }).join("")
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
          if (button.dataset.remove === "players" && getActiveTable()?.role !== "master") return;
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

