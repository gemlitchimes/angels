// angels — content script for aistudio.google.com
(() => {
  if (window.__angelsChimes) return;
  window.__angelsChimes = true;

  const Chime = globalThis.AngelsChime;
  const root = document.documentElement;
  let S = { ...Chime.DEFAULTS };
  root.classList.add("angels-on"); // paint immediately; corrected once settings load

  // ---------------------------------------------------------------- settings
  chrome.storage.sync.get(Chime.DEFAULTS, (v) => { S = { ...Chime.DEFAULTS, ...v }; apply(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k in changes) S[k] = changes[k].newValue;
    apply();
  });

  function apply() {
    root.classList.toggle("angels-on", !!S.enabled);
    root.classList.toggle("angels-still", !S.motion);
    root.style.setProperty("--g-glass", String(Math.max(0.2, Math.min(0.9, S.glass / 100))));
    if (S.enabled) whenBody(() => { Ambient.mount(); Ambient.setRunning(!!S.motion); clearShell(); welcome(); });
    else { Ambient.setRunning(false); resetTurns(); }
  }

  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  // ---------------------------------------------------------------- ambient
  const Ambient = (() => {
    let host, canvas, ctx, glow, raf = 0, running = false;
    let W = innerWidth, H = innerHeight;
    let stars = [], flies = [];
    let mx = -999, my = -999, gx = -999, gy = -999;

    function makeStars() {
      const count = Math.round(Math.min(420, Math.max(180, (W * H) / 4500)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 2.2 + 1, vy: -(Math.random() * 0.5 + 0.12),
        vx: (Math.random() - 0.5) * 0.3, t: Math.random() * Math.PI * 2,
      }));
      const n = Math.round(Math.min(14, Math.max(6, (W * H) / 120000)));
      flies = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        s: Math.random() * 6 + 6, vy: -(Math.random() * 0.35 + 0.15),
        vx: (Math.random() - 0.5) * 0.4, t: Math.random() * 10, f: Math.random() * 0.06 + 0.1,
      }));
    }

    function resize() {
      W = innerWidth; H = innerHeight;
      if (canvas) { canvas.width = W; canvas.height = H; }
      makeStars();
    }

    function onMove(e) { mx = e.clientX; my = e.clientY; if (gx < -900) { gx = mx; gy = my; } }

    function wing(s, open, side) {
      const k = side * open;
      ctx.beginPath();

      // Cánh trên: vươn rộng chéo lên, bo tròn ở chóp và thu nhẹ về thân
      ctx.moveTo(k * s * 0.04, -s * 0.08);
      ctx.bezierCurveTo(k * s * 0.45, -s * 0.86, k * s * 1.26, -s * 1.04, k * s * 1.52, -s * 0.84);
      ctx.bezierCurveTo(k * s * 1.56, -s * 0.54, k * s * 1.32, -s * 0.16, k * s * 1.10, -s * 0.04);
      ctx.bezierCurveTo(k * s * 0.72,  s * 0.03, k * s * 0.34,  s * 0.02, k * s * 0.04,  s * 0.04);
      ctx.closePath();

      // Cánh dưới: bầu tròn rộng, tạo khía nhẹ với cánh trên và khe chữ V ở đáy
      ctx.moveTo(k * s * 0.05,  s * 0.06);
      ctx.bezierCurveTo(k * s * 0.62,  s * 0.05, k * s * 1.18,  s * 0.16, k * s * 1.12,  s * 0.46);
      ctx.bezierCurveTo(k * s * 1.04,  s * 0.86, k * s * 0.76,  s * 1.18, k * s * 0.44,  s * 1.14);
      ctx.bezierCurveTo(k * s * 0.22,  s * 1.08, k * s * 0.08,  s * 0.64, k * s * 0.04,  s * 0.28);
      ctx.closePath();

      ctx.fill();
    }

    function frame() {
      // the cursor spot eases after the mouse
      gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
      if (glow) glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      for (const p of stars) {
        p.x += p.vx + Math.sin(p.t * 0.5) * 0.15; p.y += p.vy; p.t += 0.035;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        ctx.globalAlpha = 0.55 + Math.sin(p.t) * 0.35;
        ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255,255,255,1)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 14; ctx.shadowColor = "rgba(255,255,255,.9)";
      ctx.strokeStyle = "#fff";
      ctx.lineCap = "round";
      for (const b of flies) {
        b.t += b.f;
        b.x += b.vx + Math.sin(b.t * 0.23) * 0.6; b.y += b.vy + Math.cos(b.t * 0.31) * 0.25;
        if (b.y < -30) { b.y = H + 30; b.x = Math.random() * W; }
        if (b.x < -30) b.x = W + 30; if (b.x > W + 30) b.x = -30;
        const open = 0.25 + Math.abs(Math.sin(b.t)) * 0.75;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.sin(b.t * 0.23) * 0.35);

        ctx.globalAlpha = 0.85;
        wing(b.s, open, -1);
        wing(b.s, open, 1);

        // Thân mảnh + đôi râu mảnh chữ V
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.ellipse(0, b.s * 0.08, Math.max(0.8, b.s * 0.065), b.s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = Math.max(0.5, b.s * 0.04);
        ctx.beginPath();
        ctx.moveTo(-b.s * 0.02, -b.s * 0.22);
        ctx.quadraticCurveTo(-b.s * 0.08, -b.s * 0.46, -b.s * 0.13, -b.s * 0.68);
        ctx.moveTo(b.s * 0.02, -b.s * 0.22);
        ctx.quadraticCurveTo(b.s * 0.08, -b.s * 0.46, b.s * 0.13, -b.s * 0.68);
        ctx.stroke();

        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    function mount() {
      if (host && host.isConnected) return;
      host = document.createElement("div");
      host.id = "angels-ambient";
      host.setAttribute("aria-hidden", "true");
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
      ctx = canvas.getContext("2d");
      root.insertBefore(host, document.body);
      glow = document.createElement("div");
      glow.id = "angels-glow";
      glow.setAttribute("aria-hidden", "true");
      root.appendChild(glow);
      resize();
      addEventListener("resize", resize);
      addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseleave", () => { mx = my = -999; });
      document.addEventListener("visibilitychange", () => setRunning(running, true));
    }

    function setRunning(on, fromVisibility) {
      if (!fromVisibility) running = on;
      cancelAnimationFrame(raf);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (running && !reduce && !document.hidden && ctx) raf = requestAnimationFrame(frame);
    }

    return { mount, setRunning };
  })();

  // Find large opaque wrappers AI Studio paints over the whole window and make them see-through.
  function clearShell() {
    if (!S.enabled || !document.body) return;
    const vw = innerWidth, vh = innerHeight, area = vw * vh;
    const points = [[0.5, 0.5], [0.3, 0.4], [0.7, 0.6], [0.5, 0.85], [0.5, 0.15]];
    const glass = "ms-navbar, mat-sidenav, mat-drawer, ms-run-settings, ms-right-side-panel, ms-chat-turn, ms-prompt-input-wrapper, ms-prompt-box, .cdk-overlay-container, #angels-ambient, #angels-glow, pre, ms-code-block";
    for (const [fx, fy] of points) {
      for (const el of document.elementsFromPoint(vw * fx, vh * fy)) {
        if (el === document.documentElement || el.closest(glass)) continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height < area * 0.35) continue;
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const alpha = m ? (m[1].split(",")[3] ?? "1") : "0";
        if (parseFloat(alpha) > 0.05) el.classList.add("angels-clear");
      }
    }
    alignTurns();
  }

  // Line every framed chat turn up with the prompt box: same left and right edge.
  const TURN_SEL = 'ms-chat-turn .chat-turn-container, ms-chat-turn [class*="chat-turn-container"]';
  const PROMPT_SEL = "ms-prompt-input-wrapper .prompt-input-wrapper, ms-prompt-box, .prompt-input-wrapper, .prompt-box-container";
  const innermost = (sel) => [...document.querySelectorAll(sel)].filter((el) => !el.querySelector(sel));
  function resetTurns() {
    for (const el of document.querySelectorAll("[data-angels-aligned]")) {
      el.style.removeProperty("margin-left");
      el.style.removeProperty("margin-right");
      el.style.removeProperty("width");
      el.style.removeProperty("box-sizing");
      el.removeAttribute("data-angels-aligned");
    }
  }
  function alignTurns() {
    resetTurns();
    if (!S.enabled) return;
    const prompt = innermost(PROMPT_SEL).map((el) => el.getBoundingClientRect()).find((r) => r.width > 200);
    if (!prompt) return;
    const turns = innermost(TURN_SEL);
    const rects = turns.map((el) => el.getBoundingClientRect()); // read everything first, then write
    turns.forEach((el, i) => {
      const r = rects[i];
      if (r.width < 100 || r.right < prompt.left || r.left > prompt.right) return;
      const ml = prompt.left - r.left;   // + moves the left edge in, − nudges it out
      const mr = r.right - prompt.right;
      if (Math.abs(ml) < 0.5 && Math.abs(mr) < 0.5) return;
      if (Math.abs(ml) > 120 || Math.abs(mr) > 120) return; // a different column — leave it alone
      const cs = getComputedStyle(el);
      el.style.setProperty("box-sizing", "border-box", "important");
      el.style.setProperty("width", `${r.width - ml - mr}px`, "important");
      el.style.setProperty("margin-left", `${parseFloat(cs.marginLeft) + ml}px`, "important");
      el.style.setProperty("margin-right", `${parseFloat(cs.marginRight)}px`, "important");
      el.setAttribute("data-angels-aligned", "");
    });
  }
  let clearTimer = 0;
  const scheduleClear = () => { clearTimeout(clearTimer); clearTimer = setTimeout(clearShell, 400); };
  whenBody(() => {
    new MutationObserver(scheduleClear).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", scheduleClear);
    [800, 2000, 4000, 8000].forEach((ms) => setTimeout(clearShell, ms));
  });

  // ---------------------------------------------------------------- welcome + toast
  function welcome() {
    try { if (sessionStorage.getItem("angels_welcome")) return; sessionStorage.setItem("angels_welcome", "1"); } catch (_) { return; }
    const w = document.createElement("div");
    w.id = "angels-welcome";
    w.innerHTML = '<svg viewBox="0 0 1000 200"><text x="500" y="130" text-anchor="middle">angels</text></svg>' +
      '<p class="credit">created by <b>Poesía of the Gemlit Chimes</b></p>';
    root.appendChild(w);
    setTimeout(() => w.classList.add("out"), 4200);
    setTimeout(() => w.remove(), 5200);
  }

  let toastEl, toastTimer = 0;
  function toast(msg) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.id = "angels-toast";
      toastEl.setAttribute("role", "status");
      root.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  // ---------------------------------------------------------------- sounds
  const ring = (len) => { if (S.enabled && S.sound) Chime.play(len, S.volume); };

  const RUN_RE = /^\s*(run|send|chạy|gửi)\b/i;
  function isRunButton(el) {
    if (el.closest("ms-run-button") || el.classList.contains("run-button")) return true;
    const label = el.getAttribute("aria-label") || el.textContent || "";
    return RUN_RE.test(label);
  }

  document.addEventListener("pointerdown", (e) => {
    const el = e.target instanceof Element
      ? e.target.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], mat-option, .mat-mdc-chip')
      : null;
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    ring(isRunButton(el) ? "long" : Chime.lengthFor(el));
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target instanceof HTMLTextAreaElement) ring("long");
  }, true);

  // ---------------------------------------------------------------- "answer finished" chime
  function isGenerating() {
    const btn = document.querySelector("ms-run-button button, button.run-button");
    if (!btn) return false;
    const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`;
    return /\b(stop|dừng)\b/i.test(label) || btn.classList.contains("stoppable");
  }
  let wasGenerating = false;
  setInterval(() => {
    const now = isGenerating();
    if (wasGenerating && !now && S.enabled && S.doneChime) {
      if (S.sound) Chime.play("done", S.volume);
      toast("✦ Thiên thần đã trả lời xong");
    }
    wasGenerating = now;
  }, 600);
})();
