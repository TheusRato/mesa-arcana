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

