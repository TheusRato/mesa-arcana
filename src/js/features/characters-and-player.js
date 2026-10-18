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
      const owner = characterVersionOwner();
      if (!owner) return character?.annotations || "";
      const notes = character?.playerAnnotations || {};
      return notes[owner] ?? "";
    }

    function setCharacterAnnotation(character, value) {
      const owner = characterVersionOwner();
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
      document.querySelector("#characterAnnotationPlayerBox").style.display = "none";
      const owner = characterVersionOwner();
      document.querySelector("#characterModalAnnotations").placeholder = owner
        ? `Anotações de ${owner} sobre ${character?.character || "este personagem"}.`
        : "Anotações do mestre sobre este personagem.";
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
            ${getActiveTable()?.role === "master" ? `<button class="btn danger" type="button" data-delete-photo="${index}">Excluir</button>` : ""}
          </div>`).join("")
        : empty("Nenhuma foto extra adicionada.");
      document.querySelectorAll("[data-delete-photo]").forEach(button => {
        button.onclick = () => deleteCharacterPhoto(Number(button.dataset.deletePhoto));
      });
    }

    function deleteCharacterPhoto(index) {
      if (getActiveTable()?.role !== "master") return;
      const character = getCharacter(activeCharacterId);
      if (!character) return;
      character.photos = (character.photos || []).filter((_, itemIndex) => itemIndex !== index);
      activePhotoIndex = 0;
      save();
      renderCharacterMedia();
      renderPhotoGallery();
    }

    function openCharacterModal(id, requestedOwner = "") {
      const sourceCharacter = getCharacter(id);
      if (!sourceCharacter) return;
      renderCharacterVersionSelect(sourceCharacter, requestedOwner);
      const character = characterForCurrentView(sourceCharacter);
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
      activeCharacterId = null;
      activeCharacterMasterView = false;
      closePhotoGallery();
      document.querySelector("#characterModal").classList.add("hidden");
    }

    function openAddCharacterModal() {
      if (getActiveTable()?.role !== "master") return;
      document.querySelector("#newCharacterCover").closest("label").classList.remove("hidden");
      document.querySelector("#characterEditStatus").textContent = "";
      editingCharacterId = null;
      document.querySelector("#addCharacterModalTitle").textContent = "Adicionar personagem";
      document.querySelector("#addCharacterModalTitle").nextElementSibling.textContent = "Crie um personagem dos jogadores ou um NPC importante para o elenco.";
      document.querySelector("#addPlayer").textContent = "Salvar personagem";
      renderSecretInputs([]);
      document.querySelector("#addCharacterModal").classList.remove("hidden");
      document.querySelector("#characterName").focus();
    }

    function openEditCharacterModal() {
      const sourceCharacter = getCharacter(activeCharacterId);
      if (!sourceCharacter) return;
      const personal = getActiveTable()?.role === "player";
      const character = personal ? characterForCurrentView(sourceCharacter) : sourceCharacter;
      if (!character) return;
      editingCharacterId = character.id;
      newCharacterCover = character.cover || "";
      document.querySelector("#addCharacterModalTitle").textContent = "Editar personagem";
      document.querySelector("#addCharacterModalTitle").nextElementSibling.textContent = personal
        ? "Suas alterações ficam na sua versão deste personagem."
        : "Atualize os detalhes deste personagem.";
      document.querySelector("#newCharacterCover").closest("label").classList.toggle("hidden", personal);
      document.querySelector("#characterEditStatus").textContent = "";
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
      preview.classList.toggle("hidden", personal || !newCharacterCover);
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

