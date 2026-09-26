/* 몽글이 놀이터 — 오리지널 마스코트 인터랙션 + 미니게임
   저장: localStorage. 혼자 쓰는 개인용 정적 웹앱 (GitHub Pages). */
(() => {
  "use strict";

  const SAVE_KEY = "monggle_v1";
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

  /* ---------- 탭 네비게이션 ---------- */
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      $$(".tab").forEach(t => t.classList.toggle("is-active", t === tab));
      $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
      if (view === "catch") stopCatch();
    });
  });

  /* ================= 마스코트 인터랙션 ================= */
  const wrap = $("#mascotWrap");
  const mouth = $("#mouth");
  const eyes = $("#eyes"), eyesClosed = $("#eyesClosed");
  const moodFill = $("#moodFill"), moodText = $("#moodText"), moodEmoji = $("#moodEmoji");
  const totalPokes = $("#totalPokes");
  const tapHint = $("#tapHint");

  const MOUTH = {
    smile: "M92 140 Q100 148 108 140",
    big:   "M88 138 Q100 154 112 138 Q100 150 88 138",
    o:     "M100 140 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0",
    flat:  "M90 143 L110 143",
    sad:   "M92 146 Q100 138 108 146",
  };
  function setMouth(k) { mouth.setAttribute("d", MOUTH[k]); }

  function renderMood() {
    const m = Math.max(0, Math.min(100, state.mood));
    moodFill.style.width = m + "%";
    totalPokes.textContent = state.pokes;
    if (m >= 75) { moodEmoji.textContent = "😍"; moodText.textContent = "완전 행복해!"; setMouth("big"); }
    else if (m >= 45) { moodEmoji.textContent = "😊"; moodText.textContent = "기분 좋아!"; setMouth("smile"); }
    else if (m >= 20) { moodEmoji.textContent = "🥲"; moodText.textContent = "조금 심심해…"; setMouth("flat"); }
    else { moodEmoji.textContent = "😖"; moodText.textContent = "삐졌어! 놀아줘!"; setMouth("sad"); }
  }

  function floatFx(emoji, x, y) {
    const el = document.createElement("div");
    el.className = "fx"; el.textContent = emoji;
    el.style.left = x + "px"; el.style.top = y + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function blink() {
    eyes.style.display = "none"; eyesClosed.style.display = "";
    setTimeout(() => { eyes.style.display = ""; eyesClosed.style.display = "none"; }, 140);
  }
  setInterval(() => { if (Math.random() < 0.5) blink(); }, 2600);

  function pokeAt(clientX, clientY) {
    state.pokes++;
    state.mood = Math.min(100, state.mood + 3);
    wrap.classList.remove("squish"); void wrap.offsetWidth; wrap.classList.add("squish");
    const happy = state.mood >= 55;
    if (happy) { wrap.classList.remove("happy"); void wrap.offsetWidth; wrap.classList.add("happy"); }
    setMouth(happy ? "big" : "o");
    blink();
    const emo = happy ? ["💕", "✨", "💗", "🌸"][Math.floor(Math.random() * 4)] : "❓";
    floatFx(emo, clientX, clientY);
    sndPoke();
    tapHint.classList.add("hide");
    clearTimeout(pokeAt._t);
    pokeAt._t = setTimeout(renderMood, 350);
    renderMood(); moodFill.style.width = state.mood + "%"; totalPokes.textContent = state.pokes;
    save();
  }

  wrap.addEventListener("pointerdown", e => {
    e.preventDefault();
    pokeAt(e.clientX, e.clientY);
  });

  // 기분은 시간이 지나면 서서히 내려감
  setInterval(() => {
    state.mood = Math.max(0, state.mood - 1);
    renderMood(); save();
  }, 9000);

  // 버튼 액션
  $("#btnPet").addEventListener("click", () => {
    state.mood = Math.min(100, state.mood + 10);
    wrap.classList.remove("happy", "squish"); void wrap.offsetWidth; wrap.classList.add("happy");
    const r = wrap.getBoundingClientRect();
    for (let i = 0; i < 3; i++) setTimeout(() => floatFx("💕", r.left + r.width * (.3 + Math.random() * .4), r.top + r.height * .3), i * 120);
    sndHappy(); renderMood(); save();
  });
  $("#btnFeed").addEventListener("click", () => {
    state.mood = Math.min(100, state.mood + 14);
    const r = wrap.getBoundingClientRect();
    floatFx("🍡", r.left + r.width / 2, r.top + r.height * .4);
    setMouth("o"); wrap.classList.remove("bounce"); void wrap.offsetWidth; wrap.classList.add("bounce");
    sndHappy(); setTimeout(renderMood, 500); save();
  });
  const GACHA = ["🎀 리본", "🍓 딸기", "⭐ 별사탕", "🧦 양말", "🍄 버섯", "👑 왕관", "🫧 비눗방울", "🌈 무지개"];
  $("#btnSpin").addEventListener("click", () => {
    const prize = GACHA[Math.floor(Math.random() * GACHA.length)];
    const r = wrap.getBoundingClientRect();
    floatFx("🎁", r.left + r.width / 2, r.top + r.height * .3);
    wrap.classList.remove("bounce"); void wrap.offsetWidth; wrap.classList.add("bounce");
    sndWin();
    setTimeout(() => floatFx(prize.split(" ")[0], r.left + r.width / 2, r.top + r.height * .2), 300);
    setTimeout(() => { moodText.textContent = prize + " 획득!"; moodEmoji.textContent = "🎉"; }, 320);
    state.mood = Math.min(100, state.mood + 5); save();
    setTimeout(renderMood, 1600);
  });

  /* 사운드 토글 */
  const soundBtn = $("#soundToggle");
  function renderSound() { soundBtn.textContent = state.sound ? "🔔" : "🔕"; soundBtn.classList.toggle("off", !state.sound); }
  soundBtn.addEventListener("click", () => { state.sound = !state.sound; renderSound(); save(); if (state.sound) sndPoke(); });

  /* ================= 미니게임 1: 몽글이 잡기 ================= */
  const MASCOT_SVG = `<svg viewBox="0 0 100 110"><ellipse cx="50" cy="60" rx="34" ry="32" fill="#fff" stroke="#f0d8e2" stroke-width="2"/><path d="M34 32 Q28 6 38 12 Q42 24 44 34 Z" fill="#fff" stroke="#f0d8e2" stroke-width="2"/><path d="M66 32 Q72 6 62 12 Q58 24 56 34 Z" fill="#fff" stroke="#f0d8e2" stroke-width="2"/><circle cx="40" cy="56" r="3" fill="#4a3b44"/><circle cx="60" cy="56" r="3" fill="#4a3b44"/><circle cx="33" cy="66" r="6" fill="#f7b7cf"/><circle cx="67" cy="66" r="6" fill="#f7b7cf"/><path d="M45 66 Q50 72 55 66" fill="none" stroke="#b06d86" stroke-width="2.4" stroke-linecap="round"/></svg>`;
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
    let msg = `게임 끝! 점수 ${catchScore}점 🐰`;
    if (catchScore > state.catchBest) {
      state.catchBest = catchScore; catchBestEl.textContent = catchScore; save();
      msg = `🎉 신기록 ${catchScore}점!`; sndWin();
    }
    setTimeout(() => alert(msg), 100);
  }
  function stopCatch() { if (catchRunning) endCatch(); }
  catchStartBtn.addEventListener("click", startCatch);

  /* ================= 미니게임 2: 카드 짝맞추기 ================= */
  const cardGrid = $("#cardGrid");
  const memMovesEl = $("#memMoves"), memTimeEl = $("#memTime"), memBestEl = $("#memBest");
  const EMOJIS = ["🐰", "🍡", "🎀", "🍓", "⭐", "🍄", "🌸", "🫧"];
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
