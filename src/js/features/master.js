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

