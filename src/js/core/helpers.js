    function noteItem(item, collection, extraTag = "") {
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <div class="meta">
                ${item.type ? `<span class="tag">${escapeHtml(item.type)}</span>` : ""}
                ${item.column ? `<span class="tag shared">${escapeHtml(item.column)}</span>` : ""}
                ${extraTag}
              </div>
            </div>
            <div>
              ${collection === "masterNotes" && ["Segredo", "Local", "Pista", "Gancho"].includes(item.type) ? `<button class="btn" data-edit-master-note="${escapeHtml(item.id)}">Editar</button>` : ""}
              <button class="icon-btn" title="Remover" data-remove="${collection}" data-id="${item.id}">${iconTrash()}</button>
            </div>
          </div>
          <p>${escapeHtml(item.body || item.notes || "")}</p>
          ${collection === "masterNotes" && item.image ? `<button class="btn" data-clue-image="${escapeHtml(item.id)}" aria-label="Ampliar imagem"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" style="display:block;max-width:100%;max-height:300px;object-fit:contain"></button>` : ""}
        </article>`;
    }

    function empty(text) {
      return `<div class="empty">${text}</div>`;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function setSelectValuePreservingLegacy(selector, value) {
      const select = document.querySelector(selector);
      if (!select) return;
      const nextValue = value || "";
      if (nextValue && ![...select.options].some(option => option.value === nextValue)) {
        const option = document.createElement("option");
        option.value = nextValue;
        option.textContent = nextValue;
        option.hidden = true;
        select.appendChild(option);
      }
      select.value = nextValue;
    }

    function characterInitials(character) {
      return String(character || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || "")
        .join("")
        .toUpperCase();
    }

    function fallbackHashSecret(value) {
      const text = String(value || "");
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fallback-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }

    async function shaSecret(value) {
      if (!crypto.subtle) return "";
      const text = String(value || "");
      const bytes = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    async function hashSecret(value) {
      return fallbackHashSecret(value);
    }

    async function secretMatches(storedHash, value) {
      const stored = String(storedHash || "");
      if (!stored) return false;
      if (stored === fallbackHashSecret(value)) return true;
      const sha = await shaSecret(value);
      return Boolean(sha && stored === sha);
    }

    function createSecretToken(prefix = "mesa") {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      const body = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      return `${prefix}-${body}`;
    }

    function encodeInvitePayload(prefix, payload) {
      return `${prefix}:${btoa(encodeURIComponent(JSON.stringify(payload)))}`;
    }

    function createInviteCode(tableId) {
      const payload = {
        app: "mesa-arcana",
        version: 1,
        tableId,
        supabaseUrl: supabaseConfig.url,
        supabaseKey: supabaseConfig.key
      };
      return encodeInvitePayload("MESA-ARCANA", payload);
    }

    function createMasterInviteCode(tableId, masterKey) {
      return encodeInvitePayload("MESA-ARCANA-MESTRE", {
        app: "mesa-arcana",
        version: 1,
        role: "master",
        tableId,
        masterKey,
        supabaseUrl: supabaseConfig.url,
        supabaseKey: supabaseConfig.key
      });
    }

    function readInviteCode(value) {
      const text = String(value || "").trim();
      const masterPrefix = "MESA-ARCANA-MESTRE:";
      const playerPrefix = "MESA-ARCANA:";
      if (!text.startsWith(masterPrefix) && !text.startsWith(playerPrefix)) {
        return { role: "player", tableId: text };
      }
      try {
        const isMasterInvite = text.startsWith(masterPrefix);
        const prefix = isMasterInvite ? masterPrefix : playerPrefix;
        const payload = JSON.parse(decodeURIComponent(atob(text.slice(prefix.length))));
        if (payload.app !== "mesa-arcana" || !payload.tableId) throw new Error("Convite invalido");
        return {
          role: isMasterInvite ? "master" : "player",
          tableId: String(payload.tableId || "").trim(),
          masterKey: String(payload.masterKey || "").trim(),
          supabaseUrl: String(payload.supabaseUrl || "").trim().replace(/\/+$/, ""),
          supabaseKey: String(payload.supabaseKey || "").trim()
        };
      } catch (error) {
        console.warn("Convite invalido.", error);
        return null;
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    async function readImageFile(file, options = {}) {
      const original = await readFileAsDataUrl(file);
      try {
        const image = await loadImageElement(original);
        const maxSize = options.maxSize || 1280;
        const quality = options.quality || .78;
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = longestSide > maxSize ? maxSize / longestSide : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        const type = canvas.toDataURL("image/webp", quality).startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
        const compressed = canvas.toDataURL(type, quality);
        return compressed.length < original.length ? compressed : original;
      } catch (error) {
        console.warn("Não foi possível comprimir a imagem. Salvando original.", error);
        return original;
      }
    }

