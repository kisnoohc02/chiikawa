/* 하치와레 놀이터 — 캐릭터 인터랙션 + 미니게임
   저장: localStorage. 혼자 쓰는 개인용 정적 웹앱 (GitHub Pages). */
(() => {
  "use strict";

  const SAVE_KEY = "monggle_v1";
  const THEME_KEY = "hachiware_theme";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 저장 ---------- */
  const LEVELS = Object.fromEntries(Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return [`lv${n}`, { label: `Lv${n}`, n,
      catch: { target: 6 + n * 2, bombs: .08 + n * .025, interval: Math.max(420, 1140 - n * 70), stay: Math.max(610, 1560 - n * 95) },
      memory: { pairs: Math.min(8, 3 + Math.ceil(n / 2)), seconds: Math.max(42, 103 - n * 6), moves: Math.max(11, 12 + Math.ceil(n / 2) * 3 - Math.floor(n / 3)) },
    }];
  }));
  const rewardFor = (level, seconds) => Math.max(5, Math.round(level * (8 + Math.min(600, Math.max(20, seconds)) * .45)));
  const levelKeys = Object.keys(LEVELS);
  const emptyRecord = () => ({
    catch: Object.fromEntries(levelKeys.map(k => [k, { best: 0, clears: 0 }])),
    memory: Object.fromEntries(levelKeys.map(k => [k, { bestMoves: null, bestTime: null, clears: 0 }])),
  });
  const defaultState = { pokes: 0, mood: 70, catchBest: 0, memBest: null, sound: true, coins: 30,
    owned: {}, equipped: { accessory: null, wallpaper: null, theme: null }, records: emptyRecord(), boardRecords: { omok: {}, chess: {} } };
  let state = load();
  function load() {
    try {
      const old = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      const records = emptyRecord();
      for (const game of ["catch", "memory"]) for (const level of levelKeys) {
        Object.assign(records[game][level], old.records?.[game]?.[level] || {});
      }
      if (old.records && !old.records.catch?.lv1) {
        for (const [legacy, level] of [["easy", "lv2"], ["normal", "lv5"], ["hard", "lv8"]]) {
          Object.assign(records.catch[level], old.records.catch?.[legacy] || {});
          Object.assign(records.memory[level], old.records.memory?.[legacy] || {});
        }
      } else if (!old.records) {
        records.catch.lv5.best = Number(old.catchBest) || 0;
        records.memory.lv5.bestMoves = old.memBest ?? null;
      }
      return { ...defaultState, ...old, coins: Number.isFinite(old.coins) ? Math.max(0, Math.floor(old.coins)) : 30,
        owned: old.owned && typeof old.owned === "object" ? old.owned : {},
        equipped: { ...defaultState.equipped, ...(old.equipped || {}) }, records,
        boardRecords: { omok: {}, chess: {}, ...(old.boardRecords || {}) } };
    } catch { return { ...defaultState, records: emptyRecord() }; }
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }
  const ITEMS = [
    { id: "ribbon", name: "분홍 리본", icon: "🎀", category: "accessory" },
    { id: "flower", name: "작은 꽃", icon: "🌼", category: "accessory" },
    { id: "star", name: "반짝 별", icon: "⭐", category: "accessory" },
    { id: "clover", name: "네잎클로버", icon: "🍀", category: "accessory" },
    { id: "picnic", name: "소풍 들판", icon: "🌿", category: "wallpaper" },
    { id: "flowerfield", name: "꽃밭", icon: "🌷", category: "wallpaper" },
    { id: "moonlit", name: "달빛 밤", icon: "🌙", category: "wallpaper" },
    { id: "berry", name: "딸기빛 테마", icon: "🍓", category: "theme" },
    { id: "forest", name: "숲빛 테마", icon: "🌳", category: "theme" },
    { id: "lavender", name: "저녁빛 테마", icon: "🪻", category: "theme" },
    { id: "riceball", name: "주먹밥", icon: "🍙", category: "food", mood: 12 },
    { id: "pancake", name: "팬케이크", icon: "🥞", category: "food", mood: 25 },
    { id: "strawberry", name: "딸기", icon: "🍓", category: "food", mood: 40 },
    { id: "shell", name: "바다 조개", icon: "🐚", category: "item" },
    { id: "acorn", name: "도토리", icon: "🌰", category: "item" },
  ];
  const SNACKS = [
    { id: "riceball", price: 10 }, { id: "pancake", price: 20 }, { id: "strawberry", price: 35 },
  ];
  function itemById(id) { return ITEMS.find(item => item.id === id); }
  let noticeTimer = null;
  function notice(message) {
    const box = $("#notice");
    box.textContent = message; box.classList.add("show");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => box.classList.remove("show"), 3600);
  }
  function renderWallet() {
    $("#coinBalance").textContent = state.coins;
    $("#inventoryCoins").textContent = state.coins;
  }
  function earn(amount) { state.coins += amount; save(); renderWallet(); }
  function spend(amount) {
    if (state.coins < amount) { notice(`동전이 ${amount - state.coins}개 부족해요. 게임에서 모아보세요!`); sndBad(); return false; }
    state.coins -= amount; save(); renderWallet(); return true;
  }

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
  let boardGames = null;
  let runner = null;
  function showView(view) {
    const previous = $(".view.is-active")?.id.slice(5);
    if (previous === "catch" && view !== "catch") stopCatch();
    if (previous === "memory" && view !== "memory") stopMemory();
    if (["omok", "chess"].includes(previous) && previous !== view) boardGames?.leave(previous);
    if (previous === "starlane" && view !== previous) runner?.leave();
    if (view === "memory" && previous !== "memory" && memFinished) buildMemory();
    $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
    $$(".tab").forEach(tab => {
      const active = tab.dataset.view === (view === "play" ? "play" : view === "items" ? "items" : "games");
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (["omok", "chess"].includes(view) && previous !== view) boardGames?.enter(view);
    if (view === "starlane" && previous !== view) runner?.enter();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  $$(".tab").forEach(tab => tab.addEventListener("click", () => showView(tab.dataset.view)));
  $$("[data-open-game]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.openGame)));
  $$("[data-back-games]").forEach(btn => btn.addEventListener("click", () => showView("games")));
  $$("[data-view-link]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.viewLink)));

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
    const side = Math.hypot(point.x - 175, point.y - 273) < 75 ? "left"
      : Math.hypot(point.x - 362, point.y - 294) < 75 ? "right" : null;
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

  function feed(item) {
    state.mood = Math.min(100, state.mood + item.mood);
    const r = wrap.getBoundingClientRect();
    floatFx(item.icon, r.left + r.width / 2, r.top + r.height * .35);
    react("happy", "happy", "bounce", 1250);
    sndHappy(); renderMood(); save();
  }
  function applyEquipment() {
    const accessory = itemById(state.equipped.accessory);
    const sprite = $("#accessorySprite");
    sprite.textContent = accessory?.icon || "";
    sprite.style.display = accessory ? "" : "none";
    $(".mascot-stage").dataset.wallpaper = state.equipped.wallpaper || "default";
    document.documentElement.dataset.worldTheme = state.equipped.theme || "default";
  }
  function renderInventory() {
    const groups = [
      ["accessory", "장신구", "하치와레에게 직접 달아줘요"],
      ["wallpaper", "배경", "놀이터의 풍경을 바꿔요"],
      ["theme", "색 테마", "화면 전체의 색감을 바꿔요"],
      ["food", "간식", "뽑기로 받은 간식을 꺼내줘요"],
      ["item", "소장품", "모험의 작은 기념품이에요"],
    ];
    $("#inventoryGrid").innerHTML = groups.map(([category, label, desc]) => {
      const owned = ITEMS.filter(item => item.category === category && Number(state.owned[item.id]) > 0);
      const cards = owned.map(item => {
        const count = Math.max(0, Math.floor(Number(state.owned[item.id]) || 0));
        const equipped = state.equipped[category] === item.id;
        const action = category === "food" ? `<button class="mini-action" data-use="${item.id}">먹이기</button>`
          : category === "item" ? "" : `<button class="mini-action" data-equip="${item.id}" ${equipped ? "disabled" : ""}>${equipped ? "장착 중" : "장착"}</button>`;
        return `<div class="inventory-item"><span class="item-icon">${item.icon}</span><div><strong>${item.name}</strong><small>${category === "food" ? `기분 +${item.mood} · ` : ""}보유 ${count}개</small></div>${action}</div>`;
      }).join("");
      const reset = ["accessory", "wallpaper", "theme"].includes(category) && state.equipped[category]
        ? `<button class="text-link" data-unequip="${category}">기본으로 되돌리기</button>` : "";
      return `<section class="inventory-section"><div class="inventory-heading"><h3>${label}</h3><p>${desc}</p></div>${cards || '<p class="empty-note">아직 없어요. 랜덤 선물을 뽑아보세요.</p>'}${reset}</section>`;
    }).join("");
  }
  $("#inventoryGrid").addEventListener("click", e => {
    const equip = e.target.closest("[data-equip]");
    const unequip = e.target.closest("[data-unequip]");
    const use = e.target.closest("[data-use]");
    if (equip) {
      const item = itemById(equip.dataset.equip);
      if (!item || !state.owned[item.id]) return;
      state.equipped[item.category] = item.id;
      applyEquipment(); renderInventory(); save(); notice(`${item.icon} ${item.name} 장착!`);
    } else if (unequip) {
      state.equipped[unequip.dataset.unequip] = null;
      applyEquipment(); renderInventory(); save(); notice("기본 모습으로 돌아왔어요.");
    } else if (use) {
      const item = itemById(use.dataset.use);
      if (!item || item.category !== "food" || !state.owned[item.id]) return;
      state.owned[item.id]--;
      showView("play");
      feed(item); renderInventory(); save(); notice(`${item.name}을(를) 먹었어요!`);
    }
  });
  $("#snackShop").innerHTML = SNACKS.map(snack => {
    const item = itemById(snack.id);
    return `<button class="snack-option" data-snack="${snack.id}"><span class="snack-icon">${item.icon}</span><span><strong>${item.name}</strong><small>기분 +${item.mood}</small></span><b>🪙 ${snack.price}</b></button>`;
  }).join("");
  $("#snackShop").addEventListener("click", e => {
    const button = e.target.closest("[data-snack]");
    if (!button) return;
    const snack = SNACKS.find(x => x.id === button.dataset.snack);
    if (!snack || !spend(snack.price)) return;
    const item = itemById(snack.id);
    feed(item); notice(`${item.icon} ${item.name}을(를) 선물했어요! −${snack.price}동전`);
  });
  $("#btnSpin").addEventListener("click", () => {
    if (!spend(50)) return;
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    state.owned[item.id] = Math.max(0, Math.floor(Number(state.owned[item.id]) || 0)) + 1;
    const r = wrap.getBoundingClientRect();
    react("open", "surprise", "bounce", 1500);
    floatFx("🎁", r.left + r.width / 2, r.top + r.height * .3);
    sndWin(); state.mood = Math.min(100, state.mood + 5); save(); renderInventory();
    setTimeout(() => {
      setFace("happy", "happy");
      floatFx(item.icon, r.left + r.width / 2, r.top + r.height * .2);
      notice(`${item.icon} ${item.name} 획득! 아이템 칸에서 확인하세요.`);
    }, 350);
  });
  applyEquipment(); renderWallet(); renderInventory();

  /* 사운드 토글 */
  const soundBtn = $("#soundToggle");
  function renderSound() { soundBtn.textContent = state.sound ? "🔔" : "🔕"; soundBtn.classList.toggle("off", !state.sound); soundBtn.setAttribute("aria-label", state.sound ? "소리 끄기" : "소리 켜기"); soundBtn.title = soundBtn.getAttribute("aria-label"); }
  soundBtn.addEventListener("click", () => { state.sound = !state.sound; renderSound(); save(); if (state.sound) sndPoke(); });

  /* ================= 난이도와 기록 ================= */
  let catchLevel = "lv1", memLevel = "lv1";
  function renderDifficulty(game) {
    const selected = game === "catch" ? catchLevel : memLevel;
    const holder = $(game === "catch" ? "#catchDifficulty" : "#memDifficulty");
    holder.innerHTML = levelKeys.map(key => `<button class="difficulty-btn ${selected === key ? "selected" : ""}" data-level="${key}" aria-pressed="${selected === key}">${LEVELS[key].label}</button>`).join("");
    if (game === "catch") renderCatchInfo(); else renderMemoryInfo();
  }
  $("#catchDifficulty").addEventListener("click", e => {
    const key = e.target.closest("[data-level]")?.dataset.level;
    if (!key || catchRunning) return;
    catchLevel = key; renderDifficulty("catch");
    catchScore = 0; catchTime = 30; catchScoreEl.textContent = 0; catchTimeEl.textContent = 30;
  });
  $("#memDifficulty").addEventListener("click", e => {
    const key = e.target.closest("[data-level]")?.dataset.level;
    if (!key || (memStarted && !memFinished)) return;
    memLevel = key; renderDifficulty("memory"); buildMemory();
  });
  function renderGameSummaries() {
    $("#catchSummary").textContent = `총 클리어 ${levelKeys.reduce((n,k) => n + (state.records.catch[k].clears || 0), 0)}회`;
    $("#memSummary").textContent = `총 클리어 ${levelKeys.reduce((n,k) => n + (state.records.memory[k].clears || 0), 0)}회`;
  }

  /* ================= 미니게임 1: 하치와레 잡기 ================= */
  function gameMascotSvg() {
    const clone = $("#mascot").cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("viewBox", "105 80 350 420");
    clone.querySelector("#bodyShape").setAttribute("d", BODY_BASE);
    clone.querySelector("#eyes").style.display = "";
    clone.querySelector("#mouth").setAttribute("d", MOUTH.smile);
    clone.querySelectorAll("#eyesClosed, #eyesHappy, #eyesTense, #tongue").forEach(el => el.remove());
    clone.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    clone.style.transform = "";
    return clone.outerHTML;
  }
  const BOMB_SVG = `<svg viewBox="0 0 100 110" aria-label="폭탄"><circle cx="50" cy="64" r="30" fill="#3a3a44"/><rect x="46" y="26" width="8" height="12" rx="3" fill="#555"/><path d="M54 26 Q64 16 68 24" fill="none" stroke="#e08a2e" stroke-width="3" stroke-linecap="round"/><circle cx="69" cy="22" r="4" fill="#ffcf4d"/><circle cx="40" cy="60" r="4" fill="#fff" opacity=".5"/></svg>`;
  const holeGrid = $("#holeGrid"), catchScoreEl = $("#catchScore"), catchTimeEl = $("#catchTime");
  const catchBestEl = $("#catchBest"), catchStartBtn = $("#catchStart");
  let catchScore = 0, catchTime = 30, catchTimer = null, popTimer = null, catchRunning = false, catchRound = 0;
  function renderCatchInfo() {
    const level = LEVELS[catchLevel], record = state.records.catch[catchLevel];
    $("#catchGoal").textContent = `30초 안에 ${level.catch.target}점 이상 · 폭탄 −3점 · 클리어 🪙${rewardFor(level.n, 30)}`;
    catchBestEl.textContent = record.best || 0;
    $("#catchRecord").textContent = `🏆 ${level.label} 최고 ${record.best || 0}점 · 누적 클리어 ${record.clears || 0}회`;
  }
  function buildHoles() {
    holeGrid.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const hole = document.createElement("div"), pop = document.createElement("div");
      hole.className = "hole"; pop.className = "pop"; hole.appendChild(pop);
      pop.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!catchRunning || !hole.classList.contains("up")) return;
        if (pop.dataset.type === "bomb") { catchScore = Math.max(0, catchScore - 3); sndBad(); }
        else { catchScore++; sndPoke(); floatFx("+1", e.clientX, e.clientY); }
        pop.classList.add("bonk"); catchScoreEl.textContent = catchScore; hole.classList.remove("up");
      });
      holeGrid.appendChild(hole);
    }
  }
  function popRandom(round) {
    if (!catchRunning || round !== catchRound) return;
    const idle = $$(".hole", holeGrid).filter(h => !h.classList.contains("up"));
    if (!idle.length) return;
    const hole = idle[Math.floor(Math.random() * idle.length)], pop = $(".pop", hole);
    const bomb = Math.random() < LEVELS[catchLevel].catch.bombs;
    pop.dataset.type = bomb ? "bomb" : "good";
    pop.innerHTML = bomb ? BOMB_SVG : gameMascotSvg();
    pop.classList.remove("bonk"); hole.classList.add("up");
    setTimeout(() => { if (round === catchRound) hole.classList.remove("up"); }, LEVELS[catchLevel].catch.stay);
  }
  function startCatch() {
    if (catchRunning) return;
    catchRunning = true; catchRound++; catchScore = 0; catchTime = 30;
    catchScoreEl.textContent = 0; catchTimeEl.textContent = 30;
    catchStartBtn.textContent = "진행 중…"; catchStartBtn.disabled = true;
    $$("#catchDifficulty button").forEach(b => b.disabled = true);
    const round = catchRound;
    catchTimer = setInterval(() => {
      catchTime--; catchTimeEl.textContent = catchTime;
      if (catchTime <= 0) endCatch();
    }, 1000);
    const loop = () => {
      if (!catchRunning || round !== catchRound) return;
      popRandom(round);
      if (catchScore > 12 && Math.random() < .35) popRandom(round);
      popTimer = setTimeout(loop, LEVELS[catchLevel].catch.interval);
    };
    loop();
  }
  function cleanCatch() {
    catchRunning = false; catchRound++;
    clearInterval(catchTimer); clearTimeout(popTimer);
    $$(".hole", holeGrid).forEach(h => h.classList.remove("up"));
    $$("#catchDifficulty button").forEach(b => b.disabled = false);
    catchStartBtn.disabled = false;
  }
  function endCatch() {
    if (!catchRunning) return;
    cleanCatch(); catchStartBtn.textContent = "다시 하기 ▶";
    const record = state.records.catch[catchLevel], target = LEVELS[catchLevel].catch.target;
    record.best = Math.max(record.best || 0, catchScore);
    if (catchScore >= target) {
      record.clears = (record.clears || 0) + 1;
      const reward = rewardFor(LEVELS[catchLevel].n, 30);
      earn(reward); sndWin();
      notice(`클리어! ${catchScore}점 · 🪙${reward} 획득!`);
    } else notice(`이번에는 ${catchScore}점! 목표 ${target}점에 다시 도전해요.`);
    renderCatchInfo(); renderGameSummaries(); save();
  }
  function stopCatch() { if (catchRunning) { cleanCatch(); catchStartBtn.textContent = "게임 시작 ▶"; notice("하치와레 잡기를 중단했어요."); } }
  catchStartBtn.addEventListener("click", startCatch);
  buildHoles(); renderDifficulty("catch");

  /* ================= 미니게임 2: 카드 짝맞추기 ================= */
  const cardGrid = $("#cardGrid"), memMovesEl = $("#memMoves"), memTimeEl = $("#memTime");
  const memBestEl = $("#memBest"), EMOJIS = ["🐱", "🍡", "🎀", "🍓", "⭐", "🍄", "🌸", "🫧"];
  let memMoves = 0, memFlipped = [], memMatched = 0, memTime = 0, memTimer = null;
  let memLock = false, memStarted = false, memFinished = false, memRound = 0;
  function renderMemoryInfo() {
    const level = LEVELS[memLevel], record = state.records.memory[memLevel];
    $("#memGoal").textContent = `${level.memory.pairs}쌍 · ${level.memory.seconds}초 이내 · ${level.memory.moves}번 이내 · 클리어 약 🪙${rewardFor(level.n, Math.max(20, level.memory.seconds / 2))}~${rewardFor(level.n, level.memory.seconds)}`;
    memBestEl.textContent = record.bestMoves == null ? "-" : record.bestMoves + "번";
    $("#memRecord").textContent = `🏆 ${level.label} 최고 ${record.bestMoves ?? "-"}번 · 최단 ${record.bestTime == null ? "-" : record.bestTime + "초"} · 누적 클리어 ${record.clears || 0}회`;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildMemory() {
    memRound++; clearInterval(memTimer);
    memMoves = 0; memFlipped = []; memMatched = 0; memTime = 0;
    memLock = false; memStarted = false; memFinished = false;
    memMovesEl.textContent = 0; memTimeEl.textContent = 0;
    $$("#memDifficulty button").forEach(b => b.disabled = false);
    const icons = EMOJIS.slice(0, LEVELS[memLevel].memory.pairs);
    cardGrid.innerHTML = "";
    shuffle([...icons, ...icons]).forEach(emoji => {
      const card = document.createElement("button");
      card.type = "button"; card.className = "card";
      card.setAttribute("aria-label", "뒤집지 않은 카드");
      card.innerHTML = `<span class="card-inner"><span class="card-face card-front">?</span><span class="card-face card-back">${emoji}</span></span>`;
      card.dataset.emoji = emoji;
      card.addEventListener("click", () => flipCard(card));
      cardGrid.appendChild(card);
    });
  }
  function startMemTimer() {
    if (memStarted) return;
    memStarted = true;
    $$("#memDifficulty button").forEach(b => b.disabled = true);
    memTimer = setInterval(() => {
      memTime++; memTimeEl.textContent = memTime;
      if (memTime >= LEVELS[memLevel].memory.seconds) endMemory(false, "시간 초과!");
    }, 1000);
  }
  function flipCard(card) {
    if (memLock || memFinished || card.classList.contains("flipped") || card.classList.contains("matched")) return;
    startMemTimer(); card.classList.add("flipped");
    card.setAttribute("aria-label", `뒤집힌 카드 ${card.dataset.emoji}`);
    sndPoke(); memFlipped.push(card);
    if (memFlipped.length !== 2) return;
    memMoves++; memMovesEl.textContent = memMoves; memLock = true;
    const [a, b] = memFlipped, round = memRound;
    if (a.dataset.emoji === b.dataset.emoji) {
      setTimeout(() => {
        if (round !== memRound || memFinished) return;
        a.classList.add("matched"); b.classList.add("matched");
        memFlipped = []; memLock = false; memMatched++; sndHappy();
        if (memMatched === LEVELS[memLevel].memory.pairs) endMemory(memMoves <= LEVELS[memLevel].memory.moves, "뒤집기 횟수 초과!");
        else if (memMoves >= LEVELS[memLevel].memory.moves) endMemory(false, "뒤집기 횟수 초과!");
      }, 320);
    } else {
      setTimeout(() => {
        if (round !== memRound || memFinished) return;
        a.classList.remove("flipped"); b.classList.remove("flipped");
        a.setAttribute("aria-label", "뒤집지 않은 카드"); b.setAttribute("aria-label", "뒤집지 않은 카드");
        memFlipped = []; memLock = false;
        if (memMoves >= LEVELS[memLevel].memory.moves) endMemory(false, "뒤집기 횟수 초과!");
      }, 750);
    }
  }
  function endMemory(won, reason) {
    if (memFinished) return;
    memFinished = true; memLock = true; clearInterval(memTimer);
    $$("#memDifficulty button").forEach(b => b.disabled = false);
    if (won) {
      const record = state.records.memory[memLevel];
      record.bestMoves = record.bestMoves == null ? memMoves : Math.min(record.bestMoves, memMoves);
      record.bestTime = record.bestTime == null ? memTime : Math.min(record.bestTime, memTime);
      record.clears = (record.clears || 0) + 1;
      const reward = rewardFor(LEVELS[memLevel].n, memTime);
      earn(reward); sndWin();
      notice(`클리어! ${memMoves}번 · ${memTime}초 · 🪙${reward} 획득!`);
      renderMemoryInfo(); renderGameSummaries(); save();
    } else { sndBad(); notice(`${reason} 새 게임에서 다시 도전해요.`); }
  }
  function stopMemory() {
    if (!memStarted || memFinished) return;
    memRound++; clearInterval(memTimer); memFinished = true; memLock = true;
    $$("#memDifficulty button").forEach(b => b.disabled = false);
    notice("카드 게임을 중단했어요.");
  }
  $("#memReset").addEventListener("click", buildMemory);
  buildMemory(); renderDifficulty("memory"); renderGameSummaries();
  boardGames = window.HachiBoardGames?.init({ state, save, earn, notice, sndWin, sndBad, sndPoke, rewardFor, showView });
  runner = window.HachiStarlane?.init({ state, save, earn, notice, sndPoke, sndBad, sndWin });

  /* ---------- 초기 렌더 ---------- */
  renderMood();
  renderSound();
  moodFill.style.width = state.mood + "%";
})();
