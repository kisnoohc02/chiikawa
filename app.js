/* 하치와레 놀이터 — 캐릭터 인터랙션 + 미니게임
   저장: localStorage. 혼자 쓰는 개인용 정적 웹앱 (GitHub Pages). */
(() => {
  "use strict";

  const SAVE_KEY = "monggle_v1";
  const THEME_KEY = "hachiware_theme";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 저장 ---------- */
  const defaultState = { pokes: 0, mood: 70, catchBest: 0, memBest: null, sound: true };
  let state = load();
  function load() {
    try { return { ...defaultState, ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") }; }
    catch { return { ...defaultState }; }
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }

  /* ---------- 사운드 (WebAudio, 파일 없이 생성) ---------- */
  let audioCtx = null;
  function beep(freq = 660, dur = 0.09, type = "sine", vol = 0.15) {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch {}
  }
  const sndPoke = () => beep(720 + Math.random() * 120, 0.08, "triangle");
  const sndHappy = () => { beep(660, .08); setTimeout(() => beep(880, .1), 80); };
  const sndBad = () => beep(180, .18, "sawtooth", .12);
  const sndWin = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .12, "triangle"), i * 110)); };

  /* ---------- 놀아주기 / 게임 / 게임 선택 ---------- */
  function showView(view) {
    const previous = $(".view.is-active")?.id.slice(5);
    if (previous === "catch" && view !== "catch") stopCatch();
    if (previous === "memory" && view !== "memory") {
      clearInterval(memTimer);
      memStarted = false;
    }
    $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
    $$(".tab").forEach(tab => {
      const active = tab.dataset.view === (view === "play" ? "play" : "games");
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  $$(".tab").forEach(tab => tab.addEventListener("click", () => showView(tab.dataset.view)));
  $$("[data-open-game]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.openGame)));
  $$("[data-back-games]").forEach(btn => btn.addEventListener("click", () => showView("games")));

  /* ---------- 라이트 / 다크 모드 ---------- */
  const themeBtn = $("#themeToggle");
  const themeMeta = $('meta[name="theme-color"]');
  let darkMode = false;
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    darkMode = savedTheme === null
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : savedTheme === "dark";
  } catch {}
  function renderTheme() {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    themeBtn.textContent = darkMode ? "☀️" : "🌙";
    themeBtn.setAttribute("aria-label", darkMode ? "라이트 모드 켜기" : "다크 모드 켜기");
    themeBtn.title = themeBtn.getAttribute("aria-label");
    themeBtn.setAttribute("aria-pressed", String(darkMode));
    themeMeta?.setAttribute("content", darkMode ? "#202f3b" : "#c8eff6");
  }
  themeBtn.addEventListener("click", () => {
    darkMode = !darkMode;
    renderTheme();
    try { localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light"); } catch {}
  });
  renderTheme();

  /* ================= 하치와레 인터랙션 ================= */
  const wrap = $("#mascotWrap"), mascot = $("#mascot");
  const mouth = $("#mouth"), tongue = $("#tongue"), bodyShape = $("#bodyShape");
  const eyeGroups = { open: $("#eyes"), closed: $("#eyesClosed"), happy: $("#eyesHappy"), tense: $("#eyesTense") };
  const cheekLeft = $("#cheekLeft"), cheekRight = $("#cheekRight");
  const moodFill = $("#moodFill"), moodText = $("#moodText"), moodEmoji = $("#moodEmoji");
  const totalPokes = $("#totalPokes"), tapHint = $("#tapHint");
  const BODY_BASE = bodyShape.getAttribute("d");
  const MOUTH = {
    smile: "M273 290 Q267 304 259 294 M273 290 Q280 304 291 292 M269 299 Q266 318 276 316 Q285 313 281 300",
    happy: "M253 296 Q273 336 294 296 Q286 344 273 338 Q258 332 253 296 Z",
    surprise: "M274 304 m-10 0 a10 13 0 1 0 20 0 a10 13 0 1 0 -20 0",
    content: "M253 302 Q272 320 292 302",
    pout: "M260 308 Q275 304 288 310",
    sad: "M260 316 Q274 304 289 316",
  };
  let eyeMode = "open", reactionTimer = null, drag = null, springFrame = null;
  function setEyes(mode) {
    eyeMode = mode;
    Object.entries(eyeGroups).forEach(([name, group]) => { group.style.display = name === mode ? "" : "none"; });
  }
  function setFace(eyes, expression) {
    setEyes(eyes);
    mouth.setAttribute("d", MOUTH[expression]);
    tongue.style.display = expression === "happy" ? "" : "none";
  }
  function renderMood() {
    const m = Math.max(0, Math.min(100, state.mood));
    moodFill.style.width = m + "%";
    $("#moodBar").setAttribute("aria-valuenow", m);
    totalPokes.textContent = state.pokes;
    if (m >= 75) { moodEmoji.textContent = "🥰"; moodText.textContent = "완전 행복해!"; }
    else if (m >= 45) { moodEmoji.textContent = "😊"; moodText.textContent = "기분 좋아!"; }
    else if (m >= 20) { moodEmoji.textContent = "😐"; moodText.textContent = "조금 심심해…"; }
    else { moodEmoji.textContent = "🥺"; moodText.textContent = "놀아줘!"; }
    if (reactionTimer === null && !drag) setFace("open", m < 20 ? "sad" : m < 45 ? "pout" : "smile");
  }
  function floatFx(emoji, x, y) {
    const el = document.createElement("div");
    el.className = "fx"; el.textContent = emoji;
    el.style.left = x + "px"; el.style.top = y + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  function animateWrap(name) {
    wrap.classList.remove("happy", "squish", "bounce");
    void wrap.offsetWidth;
    wrap.classList.add(name);
  }
  function react(eyes, expression, animation, duration = 850) {
    clearTimeout(reactionTimer);
    setFace(eyes, expression);
    if (animation) animateWrap(animation);
    reactionTimer = setTimeout(() => {
      reactionTimer = null;
      wrap.classList.remove("happy", "squish", "bounce");
      renderMood();
    }, duration);
  }
  function blink() {
    if (eyeMode !== "open" || drag || reactionTimer !== null) return;
    setEyes("closed");
    setTimeout(() => { if (!drag && reactionTimer === null && eyeMode === "closed") setEyes("open"); }, 140);
  }
  setInterval(() => { if (Math.random() < .5) blink(); }, 2600);

  function pokeAt(x, y) {
    state.pokes++;
    state.mood = Math.min(100, state.mood + 3);
    const cheerful = state.mood >= 45;
    react(cheerful ? "happy" : "open", cheerful ? "happy" : "surprise", "squish", 850);
    floatFx(cheerful ? ["💙", "✨", "💕"][Math.floor(Math.random() * 3)] : "✦", x, y);
    sndPoke(); tapHint.classList.add("hide");
    renderMood(); save();
  }
  function svgPoint(clientX, clientY) {
    const point = mascot.createSVGPoint();
    point.x = clientX; point.y = clientY;
    return point.matrixTransform(mascot.getScreenCTM().inverse());
  }
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  function deform(side, dx, dy) {
    let d = BODY_BASE;
    if (side === "left") {
      d = d.replace("Q115 246 119 284 Q119 316 148 334", `Q${Math.round(115 + dx)} ${Math.round(246 + dy * .2)} ${Math.round(119 + dx)} ${Math.round(284 + dy * .4)} Q${Math.round(119 + dx * .8)} ${Math.round(316 + dy * .5)} 148 334`);
      cheekLeft.setAttribute("transform", `translate(${(dx * .48).toFixed(1)} ${(dy * .3).toFixed(1)})`);
      cheekRight.removeAttribute("transform");
    } else {
      d = d.replace("Q451 301 444 266", `Q${Math.round(451 + dx)} ${Math.round(301 + dy * .4)} ${Math.round(444 + dx * .8)} ${Math.round(266 + dy * .5)}`);
      cheekRight.setAttribute("transform", `translate(${(dx * .48).toFixed(1)} ${(dy * .3).toFixed(1)})`);
      cheekLeft.removeAttribute("transform");
    }
    bodyShape.setAttribute("d", d);
    mascot.style.transform = `rotate(${(dx * .035).toFixed(2)}deg)`;
  }
  function resetDeform() {
    bodyShape.setAttribute("d", BODY_BASE);
    cheekLeft.removeAttribute("transform"); cheekRight.removeAttribute("transform");
    mascot.style.transform = "";
    wrap.classList.remove("dragging");
  }
  wrap.addEventListener("pointerdown", e => {
    e.preventDefault();
    cancelAnimationFrame(springFrame);
    resetDeform();
    const point = svgPoint(e.clientX, e.clientY);
    const targetSide = e.target.closest?.("[data-cheek]")?.dataset.cheek;
    const side = targetSide || (Math.hypot(point.x - 175, point.y - 273) < 75 ? "left"
      : Math.hypot(point.x - 362, point.y - 294) < 75 ? "right" : null);
    drag = { pointerId: e.pointerId, start: point, side, dx: 0, dy: 0, moved: false };
    try { wrap.setPointerCapture(e.pointerId); } catch {}
    if (side) {
      clearTimeout(reactionTimer); reactionTimer = null;
      setFace("tense", "pout");
      wrap.classList.add("dragging");
      tapHint.classList.add("hide");
    }
  });
  window.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.pointerId || !drag.side) return;
    const point = svgPoint(e.clientX, e.clientY);
    const rawX = point.x - drag.start.x;
    drag.dx = drag.side === "left" ? clamp(rawX, -83, 16) : clamp(rawX, -16, 83);
    drag.dy = clamp(point.y - drag.start.y, -35, 35);
    drag.moved ||= Math.hypot(rawX, point.y - drag.start.y) > 9;
    if (drag.moved) deform(drag.side, drag.dx, drag.dy);
  });
  function finishPointer(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { side, dx, dy, moved } = drag;
    drag = null;
    if (!side || !moved) {
      resetDeform();
      pokeAt(e.clientX, e.clientY);
      return;
    }
    const start = performance.now();
    function spring(now) {
      const t = Math.min(1, (now - start) / 420);
      const ease = Math.exp(-7 * t) * Math.cos(16 * t);
      deform(side, dx * ease, dy * ease);
      if (t < 1) springFrame = requestAnimationFrame(spring);
      else { resetDeform(); react("happy", "happy", "happy", 850); }
    }
    springFrame = requestAnimationFrame(spring);
    state.pokes++;
    state.mood = Math.min(100, state.mood + 4);
    floatFx("💙", e.clientX, e.clientY);
    sndHappy(); renderMood(); save();
  }
  window.addEventListener("pointerup", finishPointer);
  window.addEventListener("pointercancel", finishPointer);
  wrap.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); const r = wrap.getBoundingClientRect(); pokeAt(r.left + r.width / 2, r.top + r.height / 2);
    }
  });
  setInterval(() => { state.mood = Math.max(0, state.mood - 1); renderMood(); save(); }, 9000);

  $("#btnPet").addEventListener("click", () => {
    state.mood = Math.min(100, state.mood + 10);
    react("closed", "content", "happy", 1200);
    const r = wrap.getBoundingClientRect();
    for (let i = 0; i < 3; i++) setTimeout(() => floatFx("💕", r.left + r.width * (.3 + Math.random() * .4), r.top + r.height * .35), i * 130);
    sndHappy(); renderMood(); save();
  });
  $("#btnFeed").addEventListener("click", () => {
    state.mood = Math.min(100, state.mood + 14);
    const r = wrap.getBoundingClientRect();
    floatFx("🍡", r.left + r.width / 2, r.top + r.height * .35);
    react("happy", "happy", "bounce", 1250);
    sndHappy(); renderMood(); save();
  });
  const GACHA = ["🎀 리본", "🍓 딸기", "⭐ 별사탕", "🧦 양말", "🍄 버섯", "👑 왕관", "🫧 비눗방울", "🌈 무지개"];
  $("#btnSpin").addEventListener("click", () => {
    const prize = GACHA[Math.floor(Math.random() * GACHA.length)];
    const r = wrap.getBoundingClientRect();
    react("open", "surprise", "bounce", 1500);
    floatFx("🎁", r.left + r.width / 2, r.top + r.height * .3);
    sndWin();
    setTimeout(() => {
      setFace("happy", "happy");
      floatFx(prize.split(" ")[0], r.left + r.width / 2, r.top + r.height * .2);
      moodText.textContent = prize + " 획득!"; moodEmoji.textContent = "🎉";
    }, 350);
    state.mood = Math.min(100, state.mood + 5); save();
  });

  /* 사운드 토글 */
  const soundBtn = $("#soundToggle");
  function renderSound() { soundBtn.textContent = state.sound ? "🔔" : "🔕"; soundBtn.classList.toggle("off", !state.sound); soundBtn.setAttribute("aria-label", state.sound ? "소리 끄기" : "소리 켜기"); soundBtn.title = soundBtn.getAttribute("aria-label"); }
  soundBtn.addEventListener("click", () => { state.sound = !state.sound; renderSound(); save(); if (state.sound) sndPoke(); });

  /* ================= 미니게임 1: 하치와레 잡기 ================= */
  // 잡기 게임도 메인과 동일한 그림을 사용한다. 복제본의 id는 제거한다.
  const gameMascot = $("#mascot").cloneNode(true);
  gameMascot.removeAttribute("id");
  gameMascot.setAttribute("viewBox", "105 80 350 420");
  gameMascot.querySelector("#eyesClosed")?.remove();
  gameMascot.querySelectorAll("[data-cheek]").forEach(el => el.remove());
  gameMascot.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
  const MASCOT_SVG = gameMascot.outerHTML;
  const BOMB_SVG = `<svg viewBox="0 0 100 110"><circle cx="50" cy="64" r="30" fill="#3a3a44"/><rect x="46" y="26" width="8" height="12" rx="3" fill="#555"/><path d="M54 26 Q64 16 68 24" fill="none" stroke="#e08a2e" stroke-width="3" stroke-linecap="round"/><circle cx="69" cy="22" r="4" fill="#ffcf4d"/><circle cx="40" cy="60" r="4" fill="#fff" opacity=".5"/></svg>`;

  const holeGrid = $("#holeGrid");
  const catchScoreEl = $("#catchScore"), catchTimeEl = $("#catchTime"), catchBestEl = $("#catchBest");
  const catchStartBtn = $("#catchStart");
  let catchScore = 0, catchTime = 30, catchTimer = null, popTimer = null, catchRunning = false;
  const HOLES = 9;

  function buildHoles() {
    holeGrid.innerHTML = "";
    for (let i = 0; i < HOLES; i++) {
      const hole = document.createElement("div");
      hole.className = "hole";
      const pop = document.createElement("div");
      pop.className = "pop";
      hole.appendChild(pop);
      pop.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!catchRunning || !hole.classList.contains("up")) return;
        if (pop.dataset.type === "bomb") {
          catchScore = Math.max(0, catchScore - 3); sndBad();
          pop.classList.add("bonk");
        } else {
          catchScore++; sndPoke(); pop.classList.add("bonk");
          floatFx("+1", e.clientX, e.clientY);
        }
        catchScoreEl.textContent = catchScore;
        hole.classList.remove("up");
      });
      holeGrid.appendChild(hole);
    }
  }
  catchBestEl.textContent = state.catchBest;
  buildHoles();

  function popRandom() {
    const holes = $$(".hole", holeGrid);
    const idle = holes.filter(h => !h.classList.contains("up"));
    if (!idle.length) return;
    const hole = idle[Math.floor(Math.random() * idle.length)];
    const pop = $(".pop", hole);
    const isBomb = Math.random() < 0.22;
    pop.dataset.type = isBomb ? "bomb" : "good";
    pop.innerHTML = isBomb ? BOMB_SVG : MASCOT_SVG;
    pop.classList.remove("bonk");
    hole.classList.add("up");
    const stay = 700 + Math.random() * 600;
    setTimeout(() => hole.classList.remove("up"), stay);
  }

  function startCatch() {
    if (catchRunning) return;
    catchRunning = true; catchScore = 0; catchTime = 30;
    catchScoreEl.textContent = 0; catchTimeEl.textContent = 30;
    catchStartBtn.textContent = "진행 중…"; catchStartBtn.disabled = true;
    try { audioCtx && audioCtx.resume(); } catch {}
    catchTimer = setInterval(() => {
      catchTime--; catchTimeEl.textContent = catchTime;
      if (catchTime <= 0) endCatch();
    }, 1000);
    const loop = () => {
      if (!catchRunning) return;
      popRandom();
      if (catchScore > 12 && Math.random() < 0.4) popRandom();
      popTimer = setTimeout(loop, Math.max(420, 900 - catchScore * 12));
    };
    loop();
  }
  function endCatch() {
    catchRunning = false;
    clearInterval(catchTimer); clearTimeout(popTimer);
    $$(".hole", holeGrid).forEach(h => h.classList.remove("up"));
    catchStartBtn.textContent = "다시 하기 ▶"; catchStartBtn.disabled = false;
    let msg = `게임 끝! 점수 ${catchScore}점 🐱`;
    if (catchScore > state.catchBest) {
      state.catchBest = catchScore; catchBestEl.textContent = catchScore; save();
      msg = `🎉 신기록 ${catchScore}점!`; sndWin();
    }
    setTimeout(() => alert(msg), 100);
  }
  function stopCatch() {
    if (!catchRunning) return;
    catchRunning = false;
    clearInterval(catchTimer); clearTimeout(popTimer);
    $$(".hole", holeGrid).forEach(h => h.classList.remove("up"));
    catchStartBtn.textContent = "게임 시작 ▶";
    catchStartBtn.disabled = false;
  }
  catchStartBtn.addEventListener("click", startCatch);

  /* ================= 미니게임 2: 카드 짝맞추기 ================= */
  const cardGrid = $("#cardGrid");
  const memMovesEl = $("#memMoves"), memTimeEl = $("#memTime"), memBestEl = $("#memBest");
  const EMOJIS = ["🐱", "🍡", "🎀", "🍓", "⭐", "🍄", "🌸", "🫧"];
  let memMoves = 0, memFlipped = [], memMatched = 0, memTime = 0, memTimer = null, memLock = false, memStarted = false;

  memBestEl.textContent = state.memBest == null ? "-" : state.memBest + "번";

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function buildMemory() {
    clearInterval(memTimer);
    memMoves = 0; memFlipped = []; memMatched = 0; memTime = 0; memLock = false; memStarted = false;
    memMovesEl.textContent = 0; memTimeEl.textContent = 0;
    const deck = shuffle([...EMOJIS, ...EMOJIS]);
    cardGrid.innerHTML = "";
    deck.forEach(emoji => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="card-inner">
        <div class="card-face card-front">?</div>
        <div class="card-face card-back">${emoji}</div>
      </div>`;
      card.dataset.emoji = emoji;
      card.addEventListener("click", () => flipCard(card));
      cardGrid.appendChild(card);
    });
  }
  function startMemTimer() {
    if (memStarted) return; memStarted = true;
    memTimer = setInterval(() => { memTime++; memTimeEl.textContent = memTime; }, 1000);
  }
  function flipCard(card) {
    if (memLock || card.classList.contains("flipped") || card.classList.contains("matched")) return;
    startMemTimer();
    card.classList.add("flipped"); sndPoke();
    memFlipped.push(card);
    if (memFlipped.length === 2) {
      memMoves++; memMovesEl.textContent = memMoves; memLock = true;
      const [a, b] = memFlipped;
      if (a.dataset.emoji === b.dataset.emoji) {
        setTimeout(() => {
          a.classList.add("matched"); b.classList.add("matched");
          memFlipped = []; memLock = false; memMatched++;
          sndHappy();
          if (memMatched === EMOJIS.length) finishMemory();
        }, 350);
      } else {
        setTimeout(() => {
          a.classList.remove("flipped"); b.classList.remove("flipped");
          memFlipped = []; memLock = false;
        }, 800);
      }
    }
  }
  function finishMemory() {
    clearInterval(memTimer); sndWin();
    let msg = `클리어! ${memMoves}번 · ${memTime}초 🎉`;
    if (state.memBest == null || memMoves < state.memBest) {
      state.memBest = memMoves; memBestEl.textContent = memMoves + "번"; save();
      msg = `🏆 최소 뒤집기 신기록 ${memMoves}번!`;
    }
    setTimeout(() => alert(msg), 200);
  }
  $("#memReset").addEventListener("click", buildMemory);
  buildMemory();

  /* ---------- 초기 렌더 ---------- */
  renderMood();
  renderSound();
  moodFill.style.width = state.mood + "%";
})();
