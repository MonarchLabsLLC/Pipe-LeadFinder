/* Click-to-play YouTube video cards. See docs/video-cards.md.
   Markup: [data-video-card][data-youtube-id][data-title][data-duration]
           > button.video-card-poster
   Nothing loads from YouTube until the poster is clicked. The click opens one
   shared accessible modal (role=dialog, aria-modal) and creates the
   youtube-nocookie iframe inside it. Closing removes the iframe, so audio stops,
   and returns focus to the poster that opened it. */
(function () {
  "use strict";
  // Guard: run once per page, even if the script tag is included twice.
  if (window.__scaleVideoCards) return;
  window.__scaleVideoCards = true;

  var cards = document.querySelectorAll("[data-video-card]");
  if (!cards.length) return;

  var ID_PATTERN = /^[\w-]{11}$/;
  var modal = null;
  var panel = null;
  var frameBox = null;
  var titleEl = null;
  var closeBtn = null;
  var opener = null;
  var inerted = [];
  var watch = null;
  var wrapping = false; // re-entrancy guard for the focus-wrap sentinels

  function embedUrl(id, muted) {
    return "https://www.youtube-nocookie.com/embed/" + id +
      "?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1" +
      (muted ? "&mute=1" : "") +
      "&origin=" + encodeURIComponent(location.origin);
  }

  function buildModal() {
    modal = document.createElement("div");
    modal.className = "vc-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="vc-modal-backdrop" data-vc-close></div>' +
      '<span class="vc-modal-sentinel" tabindex="0" data-vc-sentinel="start"></span>' +
      '<div class="vc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="vc-modal-title">' +
        '<div class="vc-modal-bar"><h2 class="vc-modal-title" id="vc-modal-title"></h2>' +
        '<button class="vc-modal-close" type="button" aria-label="Close video" data-vc-close><span aria-hidden="true">&times;</span></button></div>' +
        '<div class="vc-modal-frame"></div>' +
      "</div>" +
      '<span class="vc-modal-sentinel" tabindex="0" data-vc-sentinel="end"></span>';
    panel = modal.querySelector(".vc-modal-panel");
    frameBox = modal.querySelector(".vc-modal-frame");
    titleEl = modal.querySelector(".vc-modal-title");
    closeBtn = modal.querySelector(".vc-modal-close");

    modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-vc-close]")) close();
    });
    // Focus that leaves the iframe (or Shift+Tab off the close button) lands on a
    // sentinel and wraps back inside the dialog.
    modal.querySelectorAll("[data-vc-sentinel]").forEach(function (sentinel) {
      sentinel.addEventListener("focus", function () {
        if (wrapping || modal.hidden) return;
        wrapping = true;
        try {
          var targets = focusables();
          var target = sentinel.getAttribute("data-vc-sentinel") === "start" ? targets[targets.length - 1] : targets[0];
          if (target && target !== sentinel) target.focus();
        } finally { wrapping = false; }
      });
    });
    document.body.appendChild(modal);
  }

  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll("button, iframe, a[href], [tabindex]:not([tabindex='-1'])"), function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
  }

  function onKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    var targets = focusables();
    if (!targets.length) { event.preventDefault(); return; }
    var first = targets[0];
    var last = targets[targets.length - 1];
    var active = document.activeElement;
    if (!panel.contains(active)) { event.preventDefault(); first.focus(); return; }
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  // Autoplay with sound needs the click's user activation. If the browser still
  // blocks it, YouTube reports the player as unstarted/cued; only then reload
  // the player muted so playback starts and the visitor can unmute.
  function watchAutoplay(iframe, id) {
    var started = false;
    var timer = null;
    function listen() {
      if (iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "vc", channel: "widget" }), "*");
    }
    function onMessage(event) {
      if (event.source !== iframe.contentWindow || !/youtube(-nocookie)?\.com$/.test(event.origin.replace(/^https?:\/\//, "").replace(/:\d+$/, ""))) return;
      var data;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (e) { return; }
      if (!data) return;
      var state = data.info && typeof data.info.playerState === "number" ? data.info.playerState : null;
      if (data.event === "onStateChange" && typeof data.info === "number") state = data.info;
      if (state === 1 || state === 3) started = true;
      if (!timer && (data.event === "onReady" || data.event === "initialDelivery" || data.event === "infoDelivery")) {
        timer = setTimeout(function () {
          if (!started && iframe.isConnected && iframe.src.indexOf("mute=1") === -1) iframe.src = embedUrl(id, true);
          stop();
        }, 2500);
      }
    }
    function stop() {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      iframe.removeEventListener("load", listen);
    }
    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", listen);
    return stop;
  }

  function open(card, button) {
    if (modal && !modal.hidden) return; // already open: never stack or re-enter
    var id = (card.getAttribute("data-youtube-id") || "").trim();
    if (!ID_PATTERN.test(id)) return;
    if (!modal) buildModal();
    // Stay last in <body> so the dialog stacks above late-loading widgets.
    if (modal !== document.body.lastElementChild) document.body.appendChild(modal);
    var title = card.getAttribute("data-title") || "Video";
    opener = button;

    titleEl.textContent = title;
    var iframe = document.createElement("iframe");
    iframe.src = embedUrl(id, false);
    iframe.title = title;
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    frameBox.replaceChildren(iframe);
    watch = watchAutoplay(iframe, id);

    // Lock page scroll without a layout jump, and take the page out of reach.
    var gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.documentElement.style.paddingRight = gap + "px";
    document.documentElement.classList.add("vc-modal-open");
    inerted = Array.prototype.filter.call(document.body.children, function (el) {
      return el !== modal && !el.hasAttribute("inert") && el.tagName !== "SCRIPT";
    });
    inerted.forEach(function (el) { el.setAttribute("inert", ""); });

    modal.hidden = false;
    document.addEventListener("keydown", onKeydown, true);
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!modal || modal.hidden) return;
    if (watch) { watch(); watch = null; }
    frameBox.replaceChildren();
    modal.hidden = true;
    document.removeEventListener("keydown", onKeydown, true);
    inerted.forEach(function (el) { el.removeAttribute("inert"); });
    inerted = [];
    document.documentElement.classList.remove("vc-modal-open");
    document.documentElement.style.paddingRight = "";
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  Array.prototype.forEach.call(cards, function (card) {
    if (card.__vcReady) return;
    card.__vcReady = true;
    var button = card.querySelector(".video-card-poster");
    if (!button || !ID_PATTERN.test((card.getAttribute("data-youtube-id") || "").trim())) return;
    if (!button.hasAttribute("aria-label")) {
      var duration = card.getAttribute("data-duration") || "";
      button.setAttribute("aria-label", "Play video: " + (card.getAttribute("data-title") || "Video") + (duration ? " (" + duration + ")" : ""));
    }
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", function () { open(card, button); });
  });
})();
