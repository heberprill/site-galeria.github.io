"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const DATA_PATH = "albums.json";

  // =========================
  // ELEMENTOS
  // =========================
  const grid = document.getElementById("grid");
  const q = document.getElementById("q");
  const count = document.getElementById("count");
  const empty = document.getElementById("empty");
  const chips = Array.from(document.querySelectorAll(".chip"));
  const year = document.getElementById("year");

  year.textContent = new Date().getFullYear();

  // Evita submit (enter) do form recarregar a página
  const form = document.querySelector("form.toolbar");
  if (form) form.addEventListener("submit", (e) => e.preventDefault());

  const iconPorTipo = { foto: "📸", video: "🎥", misto: "🧩" };
  let filtroAtual = "all";
  let ALBUNS = [];

  // =========================
  // UTILITÁRIOS
  // =========================
  function safeUrl(value){
    if(!value) return null;
    try{
      const u = new URL(value, window.location.href);
      if(u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.href;
    }catch{
      return null;
    }
  }

  function norm(s){
    const txt = (s || "").toString().toLowerCase();
    try{
      return txt.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    }catch{
      return txt.normalize ? txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : txt;
    }
  }

  function matches(album, query){
    const hay = [
      album.titulo,
      album.descricao,
      (album.tags || []).join(" "),
      album.tipo,
      album.data
    ].join(" ");
    return norm(hay).includes(norm(query));
  }

  function labelTipo(tipo){
    if(tipo === "foto") return "Fotos";
    if(tipo === "video") return "Vídeos";
    if(tipo === "misto") return "Misto";
    return "Álbum";
  }

  function formatarData(iso){
    if(!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if(!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function createEl(tag, attrs = {}, ...children){
    const el = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs)){
      if(v === null || v === undefined) continue;
      if(k === "class") el.className = v;
      else if(k === "dataset"){
        for(const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      }else if(k.startsWith("aria-")) el.setAttribute(k, v);
      else if(k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
    for(const child of children){
      if(child === null || child === undefined) continue;
      el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return el;
  }

  function setStatus(message, show){
    empty.textContent = message;
    empty.style.display = show ? "block" : "none";
  }

  // =========================
  // CARDS
  // =========================
  function criarCard(album){
    const linkSeguro = safeUrl(album.link);
    const miniaturaSegura = safeUrl(album.miniatura);

    const card = createEl("article", { class: "card", dataset: { tipo: album.tipo || "" } });

    const thumb = createEl("div", { class: "thumb" });
    if(miniaturaSegura){
      thumb.appendChild(createEl("img", {
        src: miniaturaSegura,
        alt: `Capa do álbum: ${album.titulo || ""}`,
        loading: "lazy",
        decoding: "async"
      }));
    }else{
      thumb.appendChild(createEl("div", { class: "placeholder", text: "Capa (opcional)" }));
    }

    thumb.appendChild(createEl("div", { class: "badge" },
      createEl("span", { text: iconPorTipo[album.tipo] || "📁" }),
      createEl("span", { text: labelTipo(album.tipo) })
    ));

    const tagsTxt = (album.tags && album.tags.length) ? ("# " + album.tags.join(" • ")) : "";

    const content = createEl("div", { class: "content" },
      createEl("h2", { class: "title", text: album.titulo || "" }),
      createEl("p", { class: "desc", text: album.descricao || "" }),
      createEl("div", { class: "row" },
        createEl("span", { text: formatarData(album.data) }),
        createEl("span", { text: tagsTxt })
      )
    );

    const actions = createEl("div", { class: "actions" });

    const abrir = createEl("a", {
      class: "btn primary",
      href: linkSeguro || "#",
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Abrir álbum em nova aba"
    }, "Abrir álbum ↗");

    if(!linkSeguro){
      abrir.setAttribute("aria-disabled", "true");
      abrir.addEventListener("click", (e) => e.preventDefault());
    }

    const copiar = createEl("button", {
      class: "btn",
      type: "button",
      dataset: { copy: linkSeguro || "" },
      "aria-label": "Copiar link do álbum"
    }, "Copiar link");

    if(!linkSeguro){
      copiar.disabled = true;
      copiar.title = "Link inválido";
    }

    actions.appendChild(abrir);
    actions.appendChild(copiar);

    card.appendChild(thumb);
    card.appendChild(content);
    card.appendChild(actions);

    return card;
  }

  function render(){
    const query = q.value.trim();
    grid.innerHTML = "";

    const filtrados = ALBUNS.filter(a => {
      const okTipo = (filtroAtual === "all") ? true : (a.tipo === filtroAtual);
      const okBusca = query ? matches(a, query) : true;
      return okTipo && okBusca;
    });

    const frag = document.createDocumentFragment();
    for(const a of filtrados) frag.appendChild(criarCard(a));
    grid.appendChild(frag);

    count.textContent = `${filtrados.length} álbum(ns)`;

    if (filtrados.length === 0){
      setStatus("Nenhum álbum encontrado com os filtros atuais.", true);
    }else{
      setStatus("", false);
    }
  }

  function fallbackCopy(text){
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand("copy"); }catch{}
    document.body.removeChild(ta);
  }

  // Delegação: um único listener para "Copiar link"
  grid.addEventListener("click", async (ev) => {
    const btn = ev.target.closest('button[data-copy]');
    if(!btn) return;

    const url = btn.dataset.copy;
    if(!url) return;

    const original = btn.textContent;

    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(url);
      }else{
        fallbackCopy(url);
      }
      btn.textContent = "Link copiado ✓";
      setTimeout(() => { btn.textContent = original; }, 1200);
    }catch{
      window.prompt("Copie o link:", url);
    }
  });

  // Busca e filtros
  q.addEventListener("input", render);
  chips.forEach(btn => {
    btn.addEventListener("click", () => {
      chips.forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      filtroAtual = btn.dataset.filter || "all";
      render();
    });
  });

  // =========================
  // CARREGAR albums.json
  // =========================
  function normalizeAlbumsPayload(payload){
    // Aceita: [ ... ] OU { albums: [ ... ], updated_at: "..." }
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.albums)) return payload.albums;
    return [];
  }

  function sanitizeAlbum(a){
    return {
      titulo: (a?.titulo ?? "").toString(),
      tipo: (a?.tipo ?? "").toString(),
      descricao: (a?.descricao ?? "").toString(),
      link: (a?.link ?? "").toString(),
      miniatura: (a?.miniatura ?? "").toString(),
      data: (a?.data ?? "").toString(),
      tags: Array.isArray(a?.tags) ? a.tags.map(x => (x ?? "").toString()) : []
    };
  }

  async function loadAlbums(){
    setStatus("Carregando álbuns…", true);

    try{
      const res = await fetch(DATA_PATH, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if(!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = await res.json();
      const arr = normalizeAlbumsPayload(payload);

      ALBUNS = arr.map(sanitizeAlbum).filter(a => a.titulo && a.link);
      render();

    }catch(err){
      // Se não carregar, mostra mensagem amigável
      ALBUNS = [];
      count.textContent = "0 álbuns";
      setStatus(
        "Não foi possível carregar o arquivo albums.json. Verifique se ele está ao lado do index.html e se o site está sendo servido por um servidor (não via file://).",
        true
      );
      console.error("Erro ao carregar albums.json:", err);
    }
  }

  loadAlbums();
});
