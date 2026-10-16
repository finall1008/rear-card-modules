/* 背屏卡片桥模块目录。模块只来自 ./modules.json，页面不内置目录。 */
(function () {
  "use strict";

  var MARKS = [
    { bg: "#e5f6f0", fg: "#0f6e62" },
    { bg: "#e7eef8", fg: "#1c3f6e" },
    { bg: "#f6eee4", fg: "#8a5524" },
    { bg: "#eaf3e8", fg: "#24643f" },
    { bg: "#f7ecea", fg: "#7a3e45" },
    { bg: "#eef2e6", fg: "#4c5b2c" },
    { bg: "#e8f3f4", fg: "#1a5f68" },
    { bg: "#f3eee8", fg: "#3e4b63" }
  ];

  function isHttpsUrl(value) {
    if (typeof value !== "string") return false;
    var trimmed = value.trim();
    if (!trimmed || /[\u0000-\u001F\u007F\s]/.test(trimmed)) return false;
    if (!/^https:\/\//i.test(trimmed)) return false;
    var url;
    try {
      url = new URL(trimmed);
    } catch (err) {
      return false;
    }
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!url.hostname) return false;
    return true;
  }

  function httpsUrl(value) {
    if (!isHttpsUrl(value)) return "";
    return new URL(value.trim()).href;
  }

  function cleanTags(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < value.length; i += 1) {
      if (typeof value[i] !== "string") continue;
      var tag = value[i].trim();
      if (!tag || seen[tag]) continue;
      seen[tag] = true;
      out.push(tag);
    }
    return out;
  }

  function asString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeModule(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var id = asString(raw.id);
    var name = asString(raw.name);
    if (!id || !name) return null;
    var apiVersion = typeof raw.apiVersion === "number" && isFinite(raw.apiVersion)
      ? raw.apiVersion
      : null;
    return {
      id: id,
      name: name,
      version: asString(raw.version),
      apiVersion: apiVersion,
      description: asString(raw.description),
      author: asString(raw.author),
      repository: asString(raw.repository),
      releaseUrl: asString(raw.releaseUrl),
      downloadUrl: asString(raw.downloadUrl),
      tags: cleanTags(raw.tags),
      previews: Array.isArray(raw.previews) ? raw.previews.map(httpsUrl).filter(Boolean) : []
    };
  }

  function normalizeCatalog(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, modules: [] };
    }
    if (data.schemaVersion !== 1 || !Array.isArray(data.modules)) {
      return { ok: false, modules: [] };
    }
    var modules = [];
    for (var i = 0; i < data.modules.length; i += 1) {
      var mod = normalizeModule(data.modules[i]);
      if (mod) modules.push(mod);
    }
    return { ok: true, modules: modules };
  }

  function moduleMatches(mod, query, tag) {
    if (tag && mod.tags.indexOf(tag) === -1) return false;
    var q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    var hay = [mod.name, mod.author, mod.description].concat(mod.tags).join("\n").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function markGlyph(name) {
    var text = String(name || "").trim();
    if (!text) return "\u6a21";
    var first = Array.from(text)[0];
    if (/^[A-Za-z]$/.test(first)) {
      var run = text.match(/^[A-Za-z0-9]+/);
      return run[0].slice(0, 2).toUpperCase();
    }
    return first;
  }

  function versionLabel(version) {
    if (!version) return "";
    return /^v/i.test(version) ? version : "v" + version;
  }

  var api = {
    isHttpsUrl: isHttpsUrl,
    httpsUrl: httpsUrl,
    normalizeCatalog: normalizeCatalog,
    moduleMatches: moduleMatches,
    markGlyph: markGlyph
  };

  if (typeof module === "object" && module !== null && module.exports) {
    module.exports = api;
  }

  if (typeof document === "undefined") return;

  var catalogEl = document.getElementById("catalog");
  var statusEl = document.getElementById("status");
  var searchEl = document.getElementById("q");
  var tagsEl = document.getElementById("tags");
  var errorEl = document.getElementById("error");
  var retryBtn = document.getElementById("retry");
  var errorDetail = errorEl ? errorEl.querySelector("[data-error-detail]") : null;

  if (!catalogEl || !statusEl || !searchEl || !tagsEl || !errorEl || !retryBtn) return;

  var modules = [];
  var query = "";
  var activeTag = "";
  var ready = false;
  var requestId = 0;
  var tagKey = "";

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function updatePressed() {
    var buttons = tagsEl.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-tag") === activeTag ? "true" : "false");
    }
  }

  function tagButton(label, tag) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "tag";
    button.setAttribute("data-tag", tag);
    button.textContent = label;
    button.addEventListener("click", function () {
      activeTag = tag;
      updatePressed();
      renderCards();
    });
    return button;
  }

  function renderTags() {
    var key = modules.map(function (mod) { return mod.tags.join("\u0001"); }).join("\u0002");
    if (key === tagKey && tagsEl.childElementCount > 0) {
      updatePressed();
      return;
    }
    tagKey = key;
    clear(tagsEl);
    var names = [];
    var seen = Object.create(null);
    modules.forEach(function (mod) {
      mod.tags.forEach(function (tag) {
        if (seen[tag]) return;
        seen[tag] = true;
        names.push(tag);
      });
    });
    names.sort(function (a, b) { return a.localeCompare(b, "zh"); });
    tagsEl.appendChild(tagButton("\u5168\u90e8", ""));
    names.forEach(function (name) { tagsEl.appendChild(tagButton(name, name)); });
    if (activeTag && !seen[activeTag]) activeTag = "";
    updatePressed();
  }

  function externalLink(href, label, className) {
    var safe = httpsUrl(href);
    if (!safe) return null;
    var anchor = document.createElement("a");
    anchor.href = safe;
    anchor.className = className;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.referrerPolicy = "no-referrer";
    var host = "";
    try { host = new URL(safe).hostname; } catch (err) { host = ""; }
    if (host) anchor.title = "\u6253\u5f00 " + host;
    anchor.textContent = label;
    var hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = "\uff08\u5728\u65b0\u6807\u7b7e\u9875\u6253\u5f00\uff09";
    anchor.appendChild(hint);
    return anchor;
  }

  var previewDialog = document.getElementById("preview-viewer");
  var previewContent = document.getElementById("preview-content");
  var previewTitle = document.getElementById("preview-title");
  var viewerGallery = null;

  document.getElementById("preview-close").addEventListener("click", function () {
    previewDialog.close();
  });
  previewDialog.addEventListener("close", function () {
    document.body.classList.remove("preview-open");
    clear(previewContent);
    viewerGallery = null;
  });
  previewDialog.addEventListener("keydown", function (event) {
    if (viewerGallery) viewerGallery.handleKey(event);
  });

  function openPreview(mod, page) {
    clear(previewContent);
    previewTitle.textContent = mod.name + " · 预览";
    viewerGallery = createPreview(mod, true);
    previewContent.appendChild(viewerGallery.element);
    document.body.classList.add("preview-open");
    previewDialog.showModal();
    viewerGallery.goTo(page);
  }

  function createPreview(mod, expanded) {
    var frame = document.createElement("section");
    frame.className = "preview";
    frame.setAttribute("aria-label", mod.name + "预览图");
    var track = document.createElement("div");
    track.className = "preview-track";
    frame.appendChild(track);
    var page = 0;

    mod.previews.forEach(function (url, index) {
      var slide = document.createElement(expanded ? "div" : "button");
      slide.className = "preview-slide";
      if (!expanded) {
        slide.type = "button";
        slide.setAttribute("aria-label", "放大查看" + mod.name + "第 " + (index + 1) + " 张预览图");
        slide.addEventListener("click", function () { openPreview(mod, index); });
      }
      var message = document.createElement("span");
      message.className = "preview-message";
      message.textContent = "正在加载…";
      var image = document.createElement("img");
      image.alt = mod.name + "预览，第 " + (index + 1) + " 张，共 " + mod.previews.length + " 张";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", function () { message.hidden = true; });
      image.addEventListener("error", function () {
        image.hidden = true;
        message.hidden = false;
        message.textContent = "图片加载失败";
      });
      image.src = url;
      slide.appendChild(message);
      slide.appendChild(image);
      track.appendChild(slide);
    });

    var controls = document.createElement("div");
    controls.className = "preview-controls";
    var previous = document.createElement("button");
    previous.type = "button";
    previous.className = "preview-control";
    previous.textContent = "←";
    previous.setAttribute("aria-label", "上一张预览图");
    var count = document.createElement("span");
    count.className = "preview-count";
    count.setAttribute("aria-live", "polite");
    count.setAttribute("aria-atomic", "true");
    var next = document.createElement("button");
    next.type = "button";
    next.className = "preview-control";
    next.textContent = "→";
    next.setAttribute("aria-label", "下一张预览图");
    controls.appendChild(previous);
    controls.appendChild(count);
    controls.appendChild(next);
    previous.hidden = next.hidden = mod.previews.length < 2;
    frame.appendChild(controls);

    function update() {
      count.textContent = (page + 1) + " / " + mod.previews.length;
      previous.disabled = page === 0;
      next.disabled = page === mod.previews.length - 1;
    }
    function goTo(target) {
      page = Math.max(0, Math.min(target, mod.previews.length - 1));
      track.scrollTo({ left: page * track.clientWidth, behavior: "instant" });
      update();
    }
    function handleKey(event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goTo(page + (event.key === "ArrowLeft" ? -1 : 1));
    }
    previous.addEventListener("click", function () { goTo(page - 1); });
    next.addEventListener("click", function () { goTo(page + 1); });
    if (!expanded) frame.addEventListener("keydown", handleKey);
    track.addEventListener("scroll", function () {
      if (!track.clientWidth) return;
      page = Math.max(0, Math.min(Math.round(track.scrollLeft / track.clientWidth), mod.previews.length - 1));
      update();
    }, { passive: true });
    update();
    return { element: frame, goTo: goTo, handleKey: handleKey };
  }

  function renderCard(mod) {
    var article = document.createElement("article");
    article.className = "card";

    var glyph = markGlyph(mod.name);
    var tone = MARKS[modules.indexOf(mod) % MARKS.length];
    var mark = document.createElement("div");
    mark.className = "mark";
    mark.setAttribute("aria-hidden", "true");
    mark.dataset.len = String(Array.from(glyph).length);
    mark.style.backgroundColor = tone.bg;
    mark.style.color = tone.fg;
    mark.textContent = glyph;

    var body = document.createElement("div");
    var title = document.createElement("h3");
    title.textContent = mod.name;
    var desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = mod.description || "\u6682\u65e0\u7b80\u4ecb";
    body.appendChild(title);
    body.appendChild(desc);

    var parts = [];
    if (mod.author) parts.push(mod.author);
    var version = versionLabel(mod.version);
    if (version) parts.push(version);
    if (mod.apiVersion !== null) parts.push("API " + mod.apiVersion);
    if (parts.length) {
      var meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = parts.join(" \u00b7 ");
      body.appendChild(meta);
    }

    if (mod.tags.length) {
      var list = document.createElement("ul");
      list.className = "chips";
      mod.tags.forEach(function (tag) {
        var item = document.createElement("li");
        item.textContent = tag;
        list.appendChild(item);
      });
      body.appendChild(list);
    }

    var actions = document.createElement("div");
    actions.className = "actions";
    var download = externalLink(mod.downloadUrl, "\u4e0b\u8f7d ZIP", "btn primary");
    var source = externalLink(mod.repository, "\u6e90\u7801", "btn");
    var release = externalLink(mod.releaseUrl, "\u53d1\u5e03\u9875", "btn");
    if (download) actions.appendChild(download);
    if (source) actions.appendChild(source);
    if (release) actions.appendChild(release);
    if (!download) {
      var missing = document.createElement("span");
      missing.className = "missing";
      missing.textContent = "\u6ca1\u6709\u53ef\u7528\u7684 HTTPS \u4e0b\u8f7d\u94fe\u63a5";
      actions.insertBefore(missing, actions.firstChild);
    }
    body.appendChild(actions);
    if (mod.previews.length) article.appendChild(createPreview(mod, false).element);
    article.appendChild(mark);
    article.appendChild(body);
    return article;
  }

  function renderCards() {
    clear(catalogEl);
    var shown = modules.filter(function (mod) {
      return moduleMatches(mod, query, activeTag);
    });
    var total = modules.length;
    if (activeTag) {
      statusEl.textContent = "\u6807\u7b7e\u300c" + activeTag + "\u300d\u00b7 \u663e\u793a " + shown.length + " / " + total + " \u4e2a\u6a21\u5757";
    } else if (String(query || "").trim()) {
      statusEl.textContent = "\u663e\u793a " + shown.length + " / " + total + " \u4e2a\u6a21\u5757";
    } else {
      statusEl.textContent = "\u5171 " + total + " \u4e2a\u6a21\u5757";
    }
    if (!shown.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = total === 0 ? "\u76ee\u5f55\u91cc\u8fd8\u6ca1\u6709\u6a21\u5757\u3002" : "\u6ca1\u6709\u7b26\u5408\u5f53\u524d\u6761\u4ef6\u7684\u6a21\u5757\u3002";
      catalogEl.appendChild(empty);
      return;
    }
    shown.forEach(function (mod) { catalogEl.appendChild(renderCard(mod)); });
  }

  function resetTags() {
    clear(tagsEl);
    tagKey = "\u0000reset";
  }

  function showError(kind) {
    ready = false;
    modules = [];
    activeTag = "";
    clear(catalogEl);
    resetTags();
    catalogEl.hidden = true;
    errorEl.hidden = false;
    statusEl.textContent = "\u76ee\u5f55\u672a\u52a0\u8f7d";
    if (errorDetail) {
      errorDetail.textContent = kind === "format"
        ? "模块目录格式有误，请稍后重试。"
        : "加载失败，请检查网络后重试。";
    }
  }

  function showCatalog(next) {
    modules = next;
    ready = true;
    errorEl.hidden = true;
    catalogEl.hidden = false;
    renderTags();
    renderCards();
  }

  async function load() {
    var id = ++requestId;
    ready = false;
    catalogEl.setAttribute("aria-busy", "true");
    errorEl.hidden = true;
    catalogEl.hidden = false;
    statusEl.textContent = "\u6b63\u5728\u8bfb\u53d6\u6a21\u5757\u76ee\u5f55\u2026";
    try {
      var res = await fetch("./modules.json", { cache: "no-store" });
      if (id !== requestId) return;
      if (!res.ok) {
        var httpError = new Error("http");
        httpError.kind = "network";
        throw httpError;
      }
      var text = await res.text();
      if (id !== requestId) return;
      var data;
      try {
        data = JSON.parse(String(text).replace(/^\uFEFF/, ""));
      } catch (parseError) {
        var formatError = new Error("format");
        formatError.kind = "format";
        throw formatError;
      }
      var parsed = normalizeCatalog(data);
      if (!parsed.ok) {
        showError("format");
        return;
      }
      showCatalog(parsed.modules);
    } catch (err) {
      if (id !== requestId) return;
      if (err && err.name === "AbortError") return;
      showError(err && err.kind === "format" ? "format" : "network");
    } finally {
      if (id === requestId) catalogEl.setAttribute("aria-busy", "false");
    }
  }

  searchEl.addEventListener("input", function () {
    query = searchEl.value;
    if (ready) renderCards();
  });
  retryBtn.addEventListener("click", function () { load(); });
  load();
})();
