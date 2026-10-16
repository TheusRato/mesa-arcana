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

