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
        inputPlaceholder = ""
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

