/* Shared product screenshot gallery: pointer tilt + glint on desktop,
   gentle press scale on touch (CSS), and a keyboard-friendly lightbox.
   Markup: [data-shots] > figure.shot[data-shot] > button.shot-frame > img[data-full]
   Feature rows (css/feature-rows.css) spread shots across a page: they share one
   lightbox sequence through data-shot-group="<name>" and, having no figcaption,
   carry their caption in data-shot-title / data-shot-text. */
(function () {
  "use strict";
  if (window.__scaleShots) return;
  window.__scaleShots = true;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  function bindTilt(frame) {
    var raf = 0, px = 0.5, py = 0.5;
    function apply() {
      raf = 0;
      frame.style.setProperty("--ry", ((px - 0.5) * 7).toFixed(2) + "deg");
      frame.style.setProperty("--rx", ((0.5 - py) * 6).toFixed(2) + "deg");
      frame.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      frame.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    }
    frame.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse" || reduced.matches || !fine.matches) return;
      frame.classList.add("is-tilting");
    });
    frame.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || reduced.matches || !fine.matches) return;
      var r = frame.getBoundingClientRect();
      px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (!raf) raf = requestAnimationFrame(apply);
    });
    frame.addEventListener("pointerleave", function () {
      if (raf) cancelAnimationFrame(raf), (raf = 0);
      frame.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy"].forEach(function (p) { frame.style.removeProperty(p); });
    });
  }

  // ---------------------------------------------------------------- lightbox
  var dialog, stageImg, capTitle, capText, counter, items = [], index = 0, opener = null;

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "shot-lightbox";
    dialog.setAttribute("aria-label", "Screenshot viewer");
    dialog.innerHTML =
      '<div class="shot-lightbox-bar"><span class="shot-lightbox-count" aria-live="polite"></span>' +
      '<button type="button" class="shot-lightbox-close" aria-label="Close">✕</button></div>' +
      '<div class="shot-lightbox-stage"><button type="button" class="shot-lightbox-prev" aria-label="Previous screen">←</button>' +
      '<img alt="" decoding="async"><button type="button" class="shot-lightbox-next" aria-label="Next screen">→</button></div>' +
      '<p class="shot-lightbox-caption"><strong></strong><span></span></p>';
    document.body.appendChild(dialog);
    stageImg = dialog.querySelector("img");
    capTitle = dialog.querySelector(".shot-lightbox-caption strong");
    capText = dialog.querySelector(".shot-lightbox-caption span");
    counter = dialog.querySelector(".shot-lightbox-count");
    dialog.querySelector(".shot-lightbox-close").addEventListener("click", close);
    dialog.querySelector(".shot-lightbox-prev").addEventListener("click", function () { show(index - 1); });
    dialog.querySelector(".shot-lightbox-next").addEventListener("click", function () { show(index + 1); });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog || e.target.classList.contains("shot-lightbox-stage")) close();
    });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
    });
    dialog.addEventListener("close", function () {
      document.documentElement.classList.remove("shot-lightbox-open");
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    });
    var startX = null;
    stageImg.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    stageImg.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 48) show(index + (dx < 0 ? 1 : -1));
    });
  }

  function data(figure) {
    var img = figure.querySelector("img");
    var strong = figure.querySelector("figcaption strong");
    var span = figure.querySelector("figcaption span");
    return {
      src: img.getAttribute("data-full") || img.currentSrc || img.src, alt: img.alt,
      title: strong ? strong.textContent : figure.getAttribute("data-shot-title") || "",
      text: span ? span.textContent : figure.getAttribute("data-shot-text") || ""
    };
  }

  function show(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var d = data(items[index]);
    stageImg.src = d.src;
    stageImg.alt = d.alt;
    capTitle.textContent = d.title;
    capText.textContent = d.text;
    counter.textContent = (index + 1) + " / " + items.length;
    // Warm the neighbours so arrowing feels instant.
    [index + 1, index - 1].forEach(function (n) {
      var f = items[(n + items.length) % items.length];
      if (f) { var pre = new Image(); pre.src = data(f).src; }
    });
  }

  function open(figure, trigger) {
    if (!dialog) build();
    var name = figure.getAttribute("data-shot-group");
    var group = figure.closest("[data-shots]");
    if (name) items = Array.prototype.filter.call(document.querySelectorAll("[data-shot][data-shot-group]"), function (f) { return f.getAttribute("data-shot-group") === name; });
    else items = group ? Array.prototype.slice.call(group.querySelectorAll("[data-shot]")) : [figure];
    opener = trigger;
    if (items.length < 2) dialog.setAttribute("data-single", ""); else dialog.removeAttribute("data-single");
    show(items.indexOf(figure));
    document.documentElement.classList.add("shot-lightbox-open");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    dialog.querySelector(".shot-lightbox-close").focus({ preventScroll: true });
  }

  function close() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else { dialog.removeAttribute("open"); dialog.dispatchEvent(new Event("close")); }
  }

  function init(root) {
    (root || document).querySelectorAll("[data-shot]").forEach(function (figure) {
      if (figure.__shotReady) return;
      figure.__shotReady = true;
      var frame = figure.querySelector(".shot-frame");
      if (!frame) return;
      bindTilt(frame);
      frame.addEventListener("click", function () { open(figure, frame); });
    });
  }

  window.ScaleShots = { init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
