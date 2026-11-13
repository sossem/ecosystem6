/* =====================================================
   지구 지킴이 뉴스룸 - 앱 동작
   (설정은 js/config.js, 사례는 data/cases.js 에서 바꿉니다)
   ===================================================== */
(function () {
  "use strict";

  /* ---------- 도우미 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const TYPES = ["air", "water", "soil"];
  const T = CONFIG.types;
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------- 상태 (localStorage) ---------- */
  const emptyArticle = () => ({ caseId: "", title: "", anchor: "", greet: "", activity: "", pollution: "", effect: "", action: "", source: "" });
  const defaultState = () => ({
    name: "", klass: "", step: 0, maxStep: 0,
    scraps: [], guesses: {}, mine: [],
    article: emptyArticle(),
    canvaLink: "", checks: [false, false, false, false],
    quiz: null,
    reflection: "", promise: ""
  });
  let state = defaultState();

  function save() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (e) { /* 저장 공간 문제는 무시 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { state = defaultState(); }
  }

  /* ---------- 사례 ---------- */
  function allCases() { return CASES.concat(state.mine); }
  function getCase(id) { return allCases().find(c => c.id === id); }
  function caseImg(c, extraClass = "") {
    if (c.imageUrl) return `<div class="case-img ${c.type} ${extraClass}"><img src="${esc(c.imageUrl)}" alt="${esc(c.title)}"></div>`;
    return `<div class="case-img ${c.type} ${extraClass}" aria-hidden="true">${T[c.type].emoji}</div>`;
  }
  function badge(type, extra = "") { return `<span class="type-badge ${type} ${extra}">${T[type].emoji} ${T[type].name}</span>`; }
  function sourceHtml(c) {
    if (c.sourceUrl) return `출처: <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceName || c.sourceUrl)}</a>`;
    if (c.sourceName) return `출처: ${esc(c.sourceName)}`;
    return c.mine ? "" : "출처: 학습용 사례 (교사가 링크를 넣을 수 있어요)";
  }

  /* ---------- 단계 이동 ---------- */
  function showStep(n) {
    state.step = n;
    if (n > state.maxStep) state.maxStep = n;
    save();
    for (let i = 0; i <= 5; i++) $(`#screen-${i}`).hidden = (i !== n);
    renderStepper();
    const chip = $("#teamChip");
    chip.hidden = !state.name;
    chip.textContent = state.name ? `📰 ${state.name} 기자` : "";
    if (n === 1) renderScrap();
    if (n === 2) renderWrite();
    if (n === 3) renderCanva();
    if (n === 4) renderQuiz();
    if (n === 5) renderFinish();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function renderStepper() {
    $$("#stepper li").forEach(li => {
      const s = Number(li.dataset.step);
      li.classList.toggle("is-current", s === state.step);
      li.classList.toggle("is-done", s !== state.step && s <= state.maxStep);
    });
  }
  $("#stepper").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const s = Number(li.dataset.step);
    if (s <= state.maxStep && state.name) showStep(s);
  });

  /* =====================================================
     0. 시작 화면
     ===================================================== */
  $("#brandName").textContent = CONFIG.appName;
  $("#startForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#reporterName").value.trim();
    const klass = $("#reporterClass").value.trim();
    const err = $("#startError");
    if (!name) { err.textContent = "기자 이름을 써 주세요."; err.hidden = false; return; }
    err.hidden = true;
    state.name = name; state.klass = klass;
    save();
    toast(`${name} 기자, 뉴스룸에 온 것을 환영해요!`);
    showStep(1);
  });

  /* =====================================================
     1. 사례 스크랩
     ===================================================== */
  let currentTab = "air";

  $("#typeTabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    currentTab = b.dataset.type;
    $$("#typeTabs .tab").forEach(t => t.classList.toggle("is-active", t === b));
    renderCaseGrid();
  });

  function renderScrap() {
    renderCaseGrid();
    renderScrapStatus();
  }

  function renderCaseGrid() {
    const grid = $("#caseGrid");
    let list = currentTab === "mine" ? state.mine : CASES.filter(c => c.type === currentTab);
    if (!list.length) {
      grid.innerHTML = `<div class="card"><p class="pick-empty">아직 내가 찾은 사례가 없어요. 오른쪽 <b>"내가 찾은 사례 추가"</b>를 눌러 보세요.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(caseCardHtml).join("");
  }

  function caseCardHtml(c) {
    const guessed = c.mine ? c.type : state.guesses[c.id];
    const scrapped = state.scraps.includes(c.id);
    const revealed = !!guessed;
    let guessBlock = "";
    if (!c.mine) {
      if (!revealed) {
        guessBlock = `<div class="guess-box">
          <p>🤔 어떤 환경오염일까요? 먼저 예상해 보세요!</p>
          <div class="guess-btns">
            ${TYPES.map(t => `<button class="btn ${t}" data-guess="${t}" data-id="${c.id}">${T[t].emoji} ${T[t].name}</button>`).join("")}
          </div></div>`;
      } else {
        const ok = guessed === c.type;
        guessBlock = `<div class="guess-result ${ok ? "ok" : "no"}">${ok ? "🎉 맞았어요!" : "😮 아쉬워요."} 정답은 <b>${T[c.type].name}</b>이에요. ${T[c.type].hint}.</div>`;
      }
    }
    return `<article class="card case-card ${scrapped ? "is-scrapped" : ""}" data-id="${c.id}">
      ${scrapped ? `<span class="scrapped-mark">📌 스크랩함</span>` : ""}
      <span class="case-tag">${c.mine ? "내가 찾은 사례" : "학습용 사례"}</span>
      ${caseImg(c)}
      <h3 class="case-title">${esc(c.title)}</h3>
      <p class="case-body">${esc(c.body)}</p>
      ${guessBlock}
      <div class="summary">
        <div class="row"><b>사람의 활동</b><span class="val">${esc(c.activity)}</span></div>
        <div class="row pollution"><b>환경오염</b><span class="val ${revealed ? "" : "hidden-val"}">${revealed ? badge(c.type) + " " + esc(c.pollution) : "예상한 뒤에 볼 수 있어요"}</span></div>
        <div class="row"><b>생태계 영향</b><span class="val">${esc(c.effect)}</span></div>
      </div>
      <div class="case-foot">
        <span class="case-source">${sourceHtml(c)}</span>
        <button class="btn btn-primary btn-scrap ${scrapped ? "is-on" : ""}" data-scrap="${c.id}" ${revealed ? "" : "disabled title='먼저 예상해 보세요'"}>
          ${scrapped ? "✅ 스크랩 취소" : "📌 스크랩"}</button>
      </div>
      ${c.mine ? `<button class="btn btn-danger-ghost" data-delmine="${c.id}">🗑️ 이 사례 지우기</button>` : ""}
    </article>`;
  }

  $("#caseGrid").addEventListener("click", (e) => {
    const g = e.target.closest("[data-guess]");
    if (g) {
      state.guesses[g.dataset.id] = g.dataset.guess;
      save();
      const c = getCase(g.dataset.id);
      toast(g.dataset.guess === c.type ? "정답이에요! 🎉" : `정답은 ${T[c.type].name}이에요.`);
      renderCaseGrid();
      return;
    }
    const s = e.target.closest("[data-scrap]");
    if (s) { toggleScrap(s.dataset.scrap); return; }
    const d = e.target.closest("[data-delmine]");
    if (d) {
      if (!confirm("이 사례를 지울까요?")) return;
      const id = d.dataset.delmine;
      state.mine = state.mine.filter(m => m.id !== id);
      state.scraps = state.scraps.filter(x => x !== id);
      if (state.article.caseId === id) state.article.caseId = "";
      save(); renderScrap();
    }
  });

  function toggleScrap(id) {
    const i = state.scraps.indexOf(id);
    if (i >= 0) { state.scraps.splice(i, 1); toast("스크랩을 취소했어요."); }
    else { state.scraps.push(id); toast("스크랩했어요! 📌"); }
    save();
    renderCaseGrid();
    renderScrapStatus();
  }

  function scrapCounts() {
    const cnt = { air: 0, water: 0, soil: 0 };
    state.scraps.forEach(id => { const c = getCase(id); if (c) cnt[c.type]++; });
    return cnt;
  }
  function scrapRuleOk() {
    const cnt = scrapCounts();
    const r = CONFIG.scrapRule;
    const total = cnt.air + cnt.water + cnt.soil;
    return TYPES.every(t => cnt[t] >= r.minPerType) && total >= r.minTotal;
  }
  function renderScrapStatus() {
    const cnt = scrapCounts();
    $("#cntAir").textContent = cnt.air;
    $("#cntWater").textContent = cnt.water;
    $("#cntSoil").textContent = cnt.soil;
    $("#cntTotal").textContent = cnt.air + cnt.water + cnt.soil;
    const ok = scrapRuleOk();
    const r = CONFIG.scrapRule;
    const rule = $("#scrapRuleText");
    rule.classList.toggle("ok", ok);
    rule.innerHTML = ok ? "👍 조건을 채웠어요! 기사 쓰기로 갈 수 있어요."
      : `다음 단계 조건: 종류마다 <b>${r.minPerType}개</b> 이상, 모두 <b>${r.minTotal}개</b> 이상 스크랩`;
    $("#btnToWrite").disabled = !ok;
  }
  $("#btnToWrite").addEventListener("click", () => { if (scrapRuleOk()) showStep(2); });

  /* ---- 내가 찾은 사례 추가 ---- */
  $("#btnAddMine").addEventListener("click", openAddMine);
  function openAddMine() {
    openModal(`
      <h3>✏️ 내가 찾은 사례 추가</h3>
      <div class="notice">📚 디지털 자료를 활용할 때는 <b>출처를 밝혀요</b>. 어디에서 찾았는지 꼭 써 주세요.</div>
      <form id="mineForm" autocomplete="off">
        <label class="field"><span>제목</span><input type="text" name="title" maxlength="40" placeholder="예: 강가에 버려진 낚싯줄" required></label>
        <div class="field"><span>오염 종류</span>
          <div class="type-radio">
            ${TYPES.map(t => `<label class="${t}"><input type="radio" name="type" value="${t}">${T[t].emoji} ${T[t].name}</label>`).join("")}
          </div></div>
        <label class="field"><span>사람의 활동 (무엇을 했나요?)</span><textarea name="activity" rows="2" required></textarea></label>
        <label class="field"><span>생태계 영향 (생물에게 어떤 일이 생겼나요?)</span><textarea name="effect" rows="2" required></textarea></label>
        <label class="field"><span>출처 (링크 또는 자료 이름) <b style="color:#e2574c">*필수</b></span><input type="text" name="source" placeholder="예: https://… 또는 책·누리집 이름" required></label>
        <p class="form-error" id="mineError" hidden></p>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" data-close>취소</button>
          <button type="submit" class="btn btn-primary">추가하기</button>
        </div>
      </form>`);
    $("#mineForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $("#mineError");
      const type = (f.querySelector("input[name=type]:checked") || {}).value;
      const title = f.title.value.trim(), activity = f.activity.value.trim(), effect = f.effect.value.trim(), source = f.source.value.trim();
      const missing = [];
      if (!title) missing.push("제목"); if (!type) missing.push("오염 종류"); if (!activity) missing.push("사람의 활동"); if (!effect) missing.push("생태계 영향"); if (!source) missing.push("출처");
      if (missing.length) { err.textContent = "빈 칸이 있어요: " + missing.join(", "); err.hidden = false; return; }
      const isUrl = /^https?:\/\//i.test(source);
      const c = {
        id: "mine-" + Date.now(), type, title, mine: true,
        body: `${activity} 그 결과 ${T[type].name}이 생겼어요. ${effect}`,
        activity, pollution: `${T[type].name} (${T[type].hint})`, effect,
        imageUrl: "", sourceUrl: isUrl ? source : "", sourceName: isUrl ? "" : source
      };
      state.mine.push(c);
      state.scraps.push(c.id);
      save(); closeModal();
      currentTab = "mine";
      $$("#typeTabs .tab").forEach(t => t.classList.toggle("is-active", t.dataset.type === "mine"));
      renderScrap();
      toast("내가 찾은 사례를 추가하고 스크랩했어요!");
    });
  }

  /* ---- 생각 그물 ---- */
  $("#btnMindmap").addEventListener("click", () => {
    const branches = TYPES.map(t => {
      const items = state.scraps.map(getCase).filter(c => c && c.type === t);
      return `<div class="mm-branch ${t}"><h4>${T[t].emoji} ${T[t].name}</h4>
        ${items.length ? items.map(c => `<div class="mm-leaf">${esc(c.title)}<small>→ ${esc(c.effect)}</small></div>`).join("") : `<p class="mm-empty">아직 스크랩한 사례가 없어요</p>`}
      </div>`;
    }).join("");
    openModal(`<h3>🕸️ 생각 그물</h3>
      <div class="mindmap"><div class="mm-center">인간 활동이<br>생태계에 미치는 영향</div><div class="mm-branches">${branches}</div></div>
      <div class="btn-row"><button class="btn btn-primary" data-close>닫기</button></div>`);
  });

  /* =====================================================
     2. 기사 쓰기
     ===================================================== */
  const articleKeys = ["title", "anchor", "greet", "activity", "pollution", "effect", "action", "source"];
  const articleLabels = { title: "뉴스 제목", anchor: "뉴스 진행자", greet: "기자 인사", activity: "사람의 활동", pollution: "환경오염", effect: "생태계 영향", action: "마무리(실천)", source: "출처" };

  function renderWrite() {
    const list = $("#pickList");
    const scraps = state.scraps.map(getCase).filter(Boolean);
    if (!state.scraps.includes(state.article.caseId)) state.article.caseId = "";
    list.innerHTML = scraps.length ? scraps.map(c =>
      `<button class="pick-item ${state.article.caseId === c.id ? "is-picked" : ""}" data-pick="${c.id}">${T[c.type].emoji} ${esc(c.title)}</button>`).join("")
      : `<p class="pick-empty">스크랩한 사례가 없어요. 1단계로 돌아가 스크랩해 주세요.</p>`;
    // 입력값 복원
    articleKeys.forEach(k => { const el = $(`[data-key=${k}]`); if (el) el.value = state.article[k] || ""; });
    $("#tvTeam").textContent = state.name + " 기자";
    updateTicker();
    renderRefCard();
  }
  function renderRefCard() {
    const c = getCase(state.article.caseId);
    $("#writeLayout").hidden = !c;
    if (!c) return;
    $("#refCard").innerHTML = `<article class="card case-card ref-card">
      ${caseImg(c)}
      ${badge(c.type)}
      <h3 class="case-title">${esc(c.title)}</h3>
      <p class="case-body">${esc(c.body)}</p>
      <div class="summary">
        <div class="row"><b>사람의 활동</b><span class="val">${esc(c.activity)}</span></div>
        <div class="row"><b>환경오염</b><span class="val">${esc(c.pollution)}</span></div>
        <div class="row"><b>생태계 영향</b><span class="val">${esc(c.effect)}</span></div>
      </div>
      <span class="case-source">${sourceHtml(c)}</span>
    </article>`;
  }
  $("#pickList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    state.article.caseId = b.dataset.pick;
    save(); renderWrite();
    $("#writeLayout").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#articleForm").addEventListener("input", (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    state.article[k] = e.target.value;
    e.target.closest(".a-field").classList.remove("is-missing");
    if (k === "title") updateTicker();
    save();
  });
  function updateTicker() {
    $("#tickerText").textContent = state.article.title.trim() || "제목을 쓰면 여기에 자막이 나와요";
  }
  function missingFields() {
    return articleKeys.filter(k => !(state.article[k] || "").trim());
  }
  function showMissing(missing) {
    const err = $("#articleError");
    $$(".a-field").forEach(f => f.classList.remove("is-missing"));
    if (!missing.length) { err.hidden = true; return true; }
    missing.forEach(k => $(`[data-key=${k}]`).closest(".a-field").classList.add("is-missing"));
    err.innerHTML = "✍️ 아직 비어 있는 칸: <b>" + missing.map(k => articleLabels[k]).join(", ") + "</b>";
    err.hidden = false;
    $(`[data-key=${missing[0]}]`).focus({ preventScroll: false });
    return false;
  }
  function scriptHtml(forPrint = false) {
    const a = state.article;
    const who = (role, name) => `<span class="who">${role}${name ? "<br>" + esc(name) : ""}</span>`;
    return `<div class="tvp-screen">
      <div class="line anchor">${who("진행자", state.name)}<span>${esc(a.anchor)}</span></div>
      <div class="line reporter">${who("기자", state.name)}<span>${esc(a.greet)}</span></div>
      <div class="line reporter">${who("기자", "")}<span>${esc(a.activity)}</span></div>
      <div class="line reporter">${who("기자", "")}<span>${esc(a.pollution)}</span></div>
      <div class="line reporter">${who("기자", "")}<span>${esc(a.effect)}</span></div>
      <div class="line close">${who("마무리", "")}<span>${esc(a.action)}</span></div>
      <div class="line source">${who("출처", "")}<span>${esc(a.source)}</span></div>
    </div>`;
  }
  function tvPreviewHtml() {
    return `<div class="tv-preview">
      <div class="tvp-head"><span class="tvp-logo">● LIVE 지구 지킴이 뉴스</span><span class="tvp-team">${esc(state.name)} 기자 제작</span></div>
      ${scriptHtml()}
      <div class="tvp-ticker"><span class="ticker-tag">속보</span><span class="t-text">${esc(state.article.title)}</span></div>
    </div>`;
  }
  $("#btnPreview").addEventListener("click", () => {
    const missing = missingFields();
    if (!showMissing(missing)) { toast("빈 칸을 채우면 미리 볼 수 있어요."); return; }
    openModal(`<h3>📺 뉴스 미리 보기</h3>${tvPreviewHtml()}
      <div class="btn-row"><button class="btn btn-primary" data-close>닫기</button></div>`);
  });
  $("#btnToCanva").addEventListener("click", () => {
    if (!state.article.caseId) { toast("먼저 사례를 골라 주세요."); return; }
    if (!showMissing(missingFields())) return;
    showStep(3);
  });

  /* =====================================================
     3. 캔바 발표자료
     ===================================================== */
  const KEYWORDS = {
    air: ["공장 굴뚝 연기", "자동차 매연", "미세먼지 하늘", "마스크 쓴 사람"],
    water: ["바다 쓰레기", "바다거북 플라스틱", "강물 오염", "기름 유출 바다"],
    soil: ["쓰레기 매립지", "땅에 버려진 쓰레기", "농약 뿌리는 밭", "지렁이 흙"]
  };
  function slidesData() {
    const a = state.article, c = getCase(a.caseId);
    const type = c ? c.type : "air";
    return [
      { title: "1장 · 표지", head: a.title, body: `${state.klass ? state.klass + "\n" : ""}기자: ${state.name}`, kws: ["뉴스 스튜디오", "마이크", "지구"] },
      { title: "2장 · 무슨 일이 있었나요?", head: "무슨 일이 있었나요?", body: `${a.activity}\n\n→ ${c ? T[type].name : ""}이 생겼어요.\n${a.pollution}`, kws: KEYWORDS[type].slice(0, 2).concat([T[type].name]) },
      { title: "3장 · 생태계에 미친 영향", head: "생태계에 미친 영향", body: a.effect, kws: KEYWORDS[type].slice(2).concat(["생태계 먹이사슬"]) },
      { title: "4장 · 우리의 실천", head: "우리가 할 수 있는 일", body: `${a.action}\n\n출처: ${a.source}`, kws: ["분리배출", "환경 보호 어린이", "지구 지키기"] }
    ];
  }
  function renderCanva() {
    const slides = slidesData();
    $("#slidesGrid").innerHTML = slides.map((s, i) => `<div class="card slide">
      <span class="slide-no">${s.title}</span>
      <div class="slide-paper"><h4>${esc(s.head) || '<span class="empty">(제목 없음)</span>'}</h4><p>${esc(s.body)}</p></div>
      <div class="slide-keywords">🔎 어울리는 사진 검색어: ${s.kws.map(k => `<span class="kw">${esc(k)}</span>`).join("")}</div>
      <button class="btn btn-ghost" data-copy="${i}">📋 글 복사</button>
    </div>`).join("");
    $$("[data-check]").forEach(cb => { cb.checked = !!state.checks[Number(cb.dataset.check)]; });
    $("#canvaLink").value = state.canvaLink;
  }
  $("#slidesGrid").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const s = slidesData()[Number(b.dataset.copy)];
    const text = `${s.head}\n\n${s.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("복사했어요! 캔바에 붙여 넣어요.");
    } catch (err) {
      openModal(`<h3>글 복사</h3><p class="tiny">아래 글을 길게 눌러 복사하세요.</p><textarea rows="8" readonly>${esc(text)}</textarea>
        <div class="btn-row"><button class="btn btn-primary" data-close>닫기</button></div>`);
      $("#modal textarea").select();
    }
  });
  $$("[data-check]").forEach(cb => cb.addEventListener("change", () => {
    state.checks[Number(cb.dataset.check)] = cb.checked; save();
  }));
  $("#btnOpenCanva").addEventListener("click", () => window.open(CONFIG.canvaUrl, "_blank", "noopener"));
  $("#canvaLink").addEventListener("input", (e) => { state.canvaLink = e.target.value.trim(); save(); });
  $("#btnToQuiz").addEventListener("click", () => showStep(4));

  /* =====================================================
     4. 퀴즈
     ===================================================== */
  const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function chosung(str) {
    return Array.from(str).map(ch => {
      const code = ch.charCodeAt(0) - 0xAC00;
      if (code >= 0 && code < 11172) return CHO[Math.floor(code / 588)];
      return ch;
    }).join("");
  }
  const normalize = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

  /* 문항 생성 ------------------------------------------- */
  function buildQuestions() {
    const cases = allCases().filter(c => !c.mine || (c.activity && c.effect));
    const base = CASES.slice(); // 영향·OX 보기용 기준 데이터
    const mix = CONFIG.quiz.mix;
    const want = CONFIG.quiz.count;
    const used = new Set();
    const takeCase = (filterFn) => {
      let pool = cases.filter(c => !used.has(c.id) && (!filterFn || filterFn(c)));
      if (!pool.length) pool = cases.filter(c => !filterFn || filterFn(c));
      if (!pool.length) return null;
      const c = pick(pool); used.add(c.id); return c;
    };
    const qs = [];

    // 사례에 직접 적힌 문항(quiz 필드) 수집
    const custom = { ox: [], choice: [], initial: [] };
    cases.forEach(c => (c.quiz || []).forEach(q => { if (custom[q.type]) custom[q.type].push({ q, c }); }));

    // 영향 맞히기 (4지선다)  — 사례 quiz의 choice 문항도 여기에 섞음
    for (let i = 0; i < (mix.effect || 0); i++) {
      if (custom.choice.length && Math.random() < 0.5) {
        const { q, c } = custom.choice.splice(Math.floor(Math.random() * custom.choice.length), 1)[0];
        const opts = q.options.map((o, idx) => ({ text: o, ok: idx === q.answer }));
        qs.push({ kind: "effect", label: "영향 맞히기", caseId: c.id, text: q.question, passage: "", options: shuffle(opts), explain: q.explain || c.effect });
        continue;
      }
      const c = takeCase(); if (!c) break;
      const others = shuffle(base.filter(o => o.id !== c.id && o.effect !== c.effect));
      const distract = others.filter(o => o.type !== c.type).slice(0, 2).concat(others.filter(o => o.type === c.type).slice(0, 1));
      while (distract.length < 3 && others.length) { const o = others.pop(); if (!distract.includes(o)) distract.push(o); }
      const opts = shuffle([{ text: c.effect, ok: true }].concat(distract.slice(0, 3).map(o => ({ text: o.effect, ok: false }))));
      qs.push({ kind: "effect", label: "영향 맞히기", caseId: c.id, text: "이 오염은 생물에게 어떤 영향을 줄까요?", passage: `「${c.title}」 ${c.activity} 그 결과 ${T[c.type].name}이 생겼어요.`, options: opts, explain: c.effect });
    }
    // 원인-오염-영향 잇기
    for (let i = 0; i < (mix.chain || 0); i++) {
      const c = takeCase(); if (!c) break;
      const items = [{ key: "activity", text: c.activity }, { key: "pollution", text: c.pollution }, { key: "effect", text: c.effect }];
      qs.push({ kind: "chain", label: "원인과 결과 잇기", caseId: c.id, text: `「${c.title}」 사례를 사람의 활동 → 환경오염 → 생태계 영향 순서로 이어 보세요.`, items: shuffle(items), explain: `${c.activity} → ${c.pollution} → ${c.effect}` });
    }
    // OX
    for (let i = 0; i < (mix.ox || 0); i++) {
      if (custom.ox.length && Math.random() < 0.6) {
        const { q, c } = custom.ox.splice(Math.floor(Math.random() * custom.ox.length), 1)[0];
        qs.push({ kind: "ox", label: "OX 퀴즈", caseId: c.id, text: q.question, answer: !!q.answer, explain: q.explain || c.effect });
        continue;
      }
      const c = takeCase(); if (!c) break;
      const truth = Math.random() < 0.5;
      const shownType = truth ? c.type : pick(TYPES.filter(t => t !== c.type));
      qs.push({ kind: "ox", label: "OX 퀴즈", caseId: c.id, text: `「${c.title}」 사례에서 생긴 환경오염은 ${T[shownType].name}이다.`, answer: truth, explain: `${c.activity} → ${T[c.type].name}: ${c.pollution}` });
    }
    // 초성
    for (let i = 0; i < (mix.initial || 0); i++) {
      if (custom.initial.length && Math.random() < 0.7) {
        const { q, c } = custom.initial.splice(Math.floor(Math.random() * custom.initial.length), 1)[0];
        qs.push({ kind: "initial", label: "초성 퀴즈", caseId: c.id, text: q.question, answer: q.answer, explain: q.explain || c.effect });
        continue;
      }
      const c = takeCase(); if (!c) break;
      qs.push({ kind: "initial", label: "초성 퀴즈", caseId: c.id, text: `「${c.title}」 사례에서 생긴 환경오염의 종류는 무엇일까요?`, answer: T[c.type].name, explain: `${c.activity} → ${c.pollution}` });
    }
    // 오염 종류 맞히기 (나머지 채우기)
    while (qs.length < want) {
      const c = takeCase(); if (!c) break;
      qs.push({ kind: "type", label: "오염 종류 맞히기", caseId: c.id, text: "이 사례는 어떤 환경오염일까요?", passage: `${c.activity} ${c.effect}`, answer: c.type, explain: `${c.pollution} → ${T[c.type].name}` });
    }
    return shuffle(qs).slice(0, want).map((q, i) => Object.assign(q, { no: i + 1 }));
  }

  function newQuiz() {
    state.quiz = { questions: buildQuestions(), index: 0, results: [], phase: "main", retryList: [], retryResults: [], done: false };
    save();
  }
  function renderQuiz() {
    if (!state.quiz || state.quiz.done === "restart") newQuiz();
    const wrap = $("#quizWrap");
    const q = state.quiz;
    if (q.done) { renderQuizResult(); return; }
    if (!q.questions.length) { wrap.innerHTML = `<div class="card"><p>문제를 만들 사례가 없어요.</p></div>`; return; }
    if (q.phase === "main" && q.index >= q.questions.length) {
      const wrong = q.results.map((r, i) => (!r ? i : -1)).filter(i => i >= 0);
      if (CONFIG.quiz.retryWrong && wrong.length) {
        q.phase = "retry"; q.retryList = wrong; q.index = 0; q.retryResults = []; save();
        wrap.innerHTML = `<div class="card q-result"><div class="badge">💪</div><h3>다시 풀 기회!</h3><p style="margin:10px 0 18px">틀린 문제 <b>${wrong.length}개</b>를 한 번 더 풀어 봐요.</p>
          <button class="btn btn-primary btn-big" id="btnStartRetry">다시 풀기 시작</button></div>`;
        $("#btnStartRetry").addEventListener("click", renderQuiz);
        return;
      }
      q.done = true; save(); renderQuizResult(); return;
    }
    if (q.phase === "retry" && q.index >= q.retryList.length) { q.done = true; save(); renderQuizResult(); return; }

    const qi = q.phase === "main" ? q.index : q.retryList[q.index];
    const question = q.questions[qi];
    const total = q.phase === "main" ? q.questions.length : q.retryList.length;
    const c = getCase(question.caseId);

    let bodyHtml = "";
    if (question.kind === "type") {
      bodyHtml = `<div class="q-passage">${esc(question.passage)}</div>
        <div class="q-options three">${TYPES.map(t => `<button class="q-opt ${t}" data-ans="${t}">${T[t].emoji} ${T[t].name}</button>`).join("")}</div>`;
    } else if (question.kind === "effect") {
      bodyHtml = `${question.passage ? `<div class="q-passage">${esc(question.passage)}</div>` : ""}
        <div class="q-options">${question.options.map((o, i) => `<button class="q-opt" data-ans="${i}"><b>${"①②③④"[i]}</b> ${esc(o.text)}</button>`).join("")}</div>`;
    } else if (question.kind === "ox") {
      bodyHtml = `<div class="q-options ox"><button class="q-opt" data-ans="true" style="color:#2f7fd1">O</button><button class="q-opt" data-ans="false" style="color:#e2574c">X</button></div>`;
    } else if (question.kind === "initial") {
      bodyHtml = `<div class="q-initial">${esc(chosung(question.answer))}</div>
        <div class="q-input-row"><input type="text" id="initialInput" placeholder="정답을 써요" autocomplete="off"><button class="btn btn-primary" id="initialSubmit">정답 확인</button></div>`;
    } else if (question.kind === "chain") {
      bodyHtml = `<div class="chain">
        ${[["s1", "① 사람의 활동"], ["s2", "② 환경오염"], ["s3", "③ 생태계 영향"]].map(([cls, lab], i) =>
          `<div class="chain-slot"><span class="slot-label ${cls}">${lab}</span><div class="slot-box" data-slot="${i}">여기에 들어갈 글을 아래에서 눌러요</div></div>`).join("")}
        </div>
        <div class="chain-pool">${question.items.map((it, i) => `<button class="q-opt" data-item="${i}">${esc(it.text)}</button>`).join("")}</div>
        <div class="btn-row"><button class="btn btn-ghost" id="chainReset">다시 놓기</button><button class="btn btn-primary" id="chainSubmit" disabled>정답 확인</button></div>`;
    }

    wrap.innerHTML = `
      <div class="quiz-progress"><span>${q.phase === "retry" ? "🔁 다시 풀기 " : ""}${q.index + 1} / ${total}</span><span>맞힌 문제 ${q.results.filter(Boolean).length + q.retryResults.filter(Boolean).length}개</span></div>
      <div class="q-bar"><div style="width:${(q.index / total) * 100}%"></div></div>
      <div class="card q-card">
        <span class="q-kind">${question.label}</span>
        <p class="q-text">${esc(question.text)}</p>
        ${bodyHtml}
        <div id="qFeedback"></div>
      </div>`;

    const card = $(".q-card");
    let answered = false;
    const finish = (ok, chosenInfo) => {
      if (answered) return; answered = true;
      if (q.phase === "main") q.results[qi] = ok; else q.retryResults[q.index] = ok;
      save();
      let correctText = "";
      if (question.kind === "type") correctText = T[question.answer].name;
      else if (question.kind === "effect") correctText = question.options.find(o => o.ok).text;
      else if (question.kind === "ox") correctText = question.answer ? "O" : "X";
      else if (question.kind === "initial") correctText = question.answer;
      else if (question.kind === "chain") correctText = "활동 → 오염 → 영향 순서";
      $("#qFeedback").innerHTML = `<div class="q-feedback ${ok ? "ok" : "no"}">
        <span class="big">${ok ? "🎉 정답이에요!" : "😮 아쉬워요. 정답은 「" + esc(correctText) + "」"}</span>
        <div class="why">📖 근거: ${esc(c ? c.title + " – " : "")}${esc(question.explain)}</div>
      </div>
      <div class="q-next"><button class="btn btn-primary" id="qNext">${q.index + 1 >= total ? "결과 보기 ▶" : "다음 문제 ▶"}</button></div>`;
      $("#qNext").addEventListener("click", () => { q.index++; save(); renderQuiz(); });
      $("#qFeedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    if (question.kind === "type" || question.kind === "effect" || question.kind === "ox") {
      card.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ans]");
        if (!b || answered) return;
        const v = b.dataset.ans;
        let ok;
        if (question.kind === "type") ok = v === question.answer;
        else if (question.kind === "effect") ok = !!question.options[Number(v)].ok;
        else ok = (v === "true") === question.answer;
        $$("[data-ans]", card).forEach(x => {
          x.disabled = true;
          const xv = x.dataset.ans;
          const isRight = question.kind === "type" ? xv === question.answer : question.kind === "effect" ? !!question.options[Number(xv)].ok : (xv === "true") === question.answer;
          if (isRight) x.classList.add("is-correct");
          if (x === b && !ok) x.classList.add("is-wrong");
        });
        finish(ok);
      });
    } else if (question.kind === "initial") {
      const submit = () => {
        const v = $("#initialInput").value;
        if (!v.trim()) { toast("정답을 써 주세요."); return; }
        $("#initialInput").disabled = true; $("#initialSubmit").disabled = true;
        finish(normalize(v) === normalize(question.answer));
      };
      $("#initialSubmit").addEventListener("click", submit);
      $("#initialInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      $("#initialInput").focus();
    } else if (question.kind === "chain") {
      const slots = [null, null, null];
      const paint = () => {
        $$(".slot-box", card).forEach((box, i) => {
          const it = slots[i] != null ? question.items[slots[i]] : null;
          box.textContent = it ? it.text : "여기에 들어갈 글을 아래에서 눌러요";
          box.classList.toggle("filled", !!it);
        });
        $$("[data-item]", card).forEach(b => b.classList.toggle("used", slots.includes(Number(b.dataset.item))));
        $("#chainSubmit").disabled = slots.some(s => s == null);
      };
      card.addEventListener("click", (e) => {
        if (answered) return;
        const it = e.target.closest("[data-item]");
        if (it) {
          const idx = Number(it.dataset.item);
          if (slots.includes(idx)) return;
          const empty = slots.indexOf(null);
          if (empty >= 0) { slots[empty] = idx; paint(); }
          return;
        }
        const box = e.target.closest("[data-slot]");
        if (box) { slots[Number(box.dataset.slot)] = null; paint(); return; }
        if (e.target.id === "chainReset") { slots.fill(null); paint(); return; }
        if (e.target.id === "chainSubmit") {
          const order = ["activity", "pollution", "effect"];
          const ok = slots.every((s, i) => question.items[s].key === order[i]);
          $$(".slot-box", card).forEach((box, i) => {
            box.style.borderColor = question.items[slots[i]].key === order[i] ? "#4f9d3a" : "#e2574c";
          });
          $("#chainSubmit").disabled = true; $("#chainReset").disabled = true;
          finish(ok);
        }
      });
    }
  }

  function quizSummary() {
    const q = state.quiz;
    if (!q || !q.questions.length) return null;
    const total = q.questions.length;
    const first = q.results.filter(Boolean).length;
    const retried = (q.retryResults || []).filter(Boolean).length;
    const finalCorrect = first + retried;
    const pct = Math.round((finalCorrect / total) * 100);
    const badgeInfo = CONFIG.badges.find(b => pct >= b.min) || CONFIG.badges[CONFIG.badges.length - 1];
    return { total, first, retried, finalCorrect, pct, badge: badgeInfo };
  }
  function renderQuizResult() {
    const s = quizSummary();
    const q = state.quiz;
    const review = q.questions.map((qq, i) => {
      const ok = q.results[i];
      const retryIdx = (q.retryList || []).indexOf(i);
      const retryOk = retryIdx >= 0 ? q.retryResults[retryIdx] : null;
      const mark = ok ? "✅" : (retryOk ? "🔁✅" : "❌");
      return `<li>${mark} <b>${i + 1}.</b> ${esc(qq.text)} <span class="tiny">(${esc(qq.explain)})</span></li>`;
    }).join("");
    $("#quizWrap").innerHTML = `<div class="card q-result">
      <div class="badge">${s.badge.emoji}</div>
      <div class="badge-name">${esc(s.badge.name)}</div>
      <div class="score">${s.finalCorrect} / ${s.total}</div>
      <p class="tiny">처음에 맞힌 문제 ${s.first}개${s.retried ? ` + 다시 풀어 맞힌 문제 ${s.retried}개` : ""}</p>
      <ul class="q-review">${review}</ul>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-ghost" id="btnQuizAgain">🔄 새 문제로 다시 도전</button>
        <button class="btn btn-primary" id="btnToFinish">다음: 마무리 ▶</button>
      </div></div>`;
    $("#btnQuizAgain").addEventListener("click", () => { newQuiz(); renderQuiz(); });
    $("#btnToFinish").addEventListener("click", () => showStep(5));
  }

  /* =====================================================
     5. 마무리
     ===================================================== */
  function renderFinish() {
    const s = quizSummary();
    const scraps = state.scraps.map(getCase).filter(Boolean);
    const canva = state.canvaLink && /^https?:\/\//i.test(state.canvaLink) ? state.canvaLink : "";
    $("#finishGrid").innerHTML = `
      <div class="card">
        <h3>🏅 퀴즈 결과</h3>
        ${s ? `<div class="finish-score"><span class="badge">${s.badge.emoji}</span><div><div class="score-text">${s.finalCorrect} / ${s.total}</div><div class="badge-name">${esc(state.name)} 기자는 <b>${esc(s.badge.name)}</b>!</div></div></div>`
          : `<p class="tiny">아직 퀴즈를 풀지 않았어요.</p>`}
      </div>
      <div class="card">
        <h3>🎨 나의 발표자료</h3>
        ${canva ? `<a class="btn btn-canva btn-full" href="${esc(canva)}" target="_blank" rel="noopener">캔바 발표자료 열기</a>` : `<p class="tiny">저장된 캔바 링크가 없어요. 3단계에서 링크를 붙여 넣을 수 있어요.</p>`}
        <p class="tiny" style="margin-top:10px">${esc(state.klass ? state.klass + " " : "")}${esc(state.name)} 기자</p>
      </div>
      <div class="card wide print-target">
        <h3>📺 나의 뉴스 대본</h3>
        <div style="margin-top:10px">${state.article.title ? tvPreviewHtml() : `<p class="tiny">아직 기사를 쓰지 않았어요.</p>`}</div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="btnPrint">🖨️ 대본 인쇄</button>
          <button class="btn btn-ghost" id="btnSaveImg">🖼️ 이미지로 저장</button>
        </div>
      </div>
      <div class="card wide">
        <h3>📌 스크랩 모아 보기 (${scraps.length}개)</h3>
        <div class="scrap-chips">${scraps.map(c => `<span class="chip ${c.type}">${T[c.type].emoji} ${esc(c.title)}</span>`).join("") || '<span class="tiny">없음</span>'}</div>
      </div>
      <div class="card">
        <h3>💬 생각 나누기</h3>
        <p class="tiny">뉴스 기사를 만들면서 느낀 점을 한 줄 써요.</p>
        <textarea id="reflection" rows="3" placeholder="예: 플라스틱 하나가 바다거북에게 큰 피해를 준다는 걸 알았어요.">${esc(state.reflection)}</textarea>
        <p class="saved-ok" id="reflectionSaved" hidden>저장했어요 ✓</p>
      </div>
      <div class="card">
        <h3>🤝 환경 보호 실천 약속</h3>
        <p class="tiny">내가 지킬 약속 한 가지를 써요.</p>
        <textarea id="promise" rows="3" placeholder="예: 나는 일회용 컵 대신 물병을 가지고 다니겠습니다.">${esc(state.promise)}</textarea>
        <p class="saved-ok" id="promiseSaved" hidden>저장했어요 ✓</p>
      </div>`;
    const bind = (id, key) => {
      $("#" + id).addEventListener("input", (e) => {
        state[key] = e.target.value; save();
        const ok = $("#" + id + "Saved"); ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 1200);
      });
    };
    bind("reflection", "reflection"); bind("promise", "promise");
    $("#btnPrint").addEventListener("click", printScript);
    $("#btnSaveImg").addEventListener("click", saveScriptImage);
  }

  function printScript() {
    if (!state.article.title) { toast("먼저 기사를 써 주세요."); return; }
    const area = document.createElement("div");
    area.id = "printArea";
    area.innerHTML = `<h1>📺 ${esc(state.article.title)}</h1><p>${esc(state.klass ? state.klass + " · " : "")}${esc(state.name)} 기자</p>${scriptHtml(true)}
      ${state.promise ? `<p style="margin-top:14pt">🤝 실천 약속: ${esc(state.promise)}</p>` : ""}`;
    document.body.appendChild(area);
    document.body.classList.add("printing-script");
    const cleanup = () => { document.body.classList.remove("printing-script"); area.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  }

  /* 대본을 캔버스에 그려 PNG로 저장 (외부 라이브러리 없이) */
  function saveScriptImage() {
    if (!state.article.title) { toast("먼저 기사를 써 주세요."); return; }
    const a = state.article;
    const W = 1200, pad = 48, lineH = 40;
    const bodyFont = "26px Pretendard, 'Malgun Gothic', sans-serif";
    const headFont = "bold 44px SchoolSafetyRoundedSmile, Pretendard, sans-serif";
    const roleFont = "bold 22px SchoolSafetyRoundedSmile, Pretendard, sans-serif";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const wrap = (text, maxW, font) => {
      ctx.font = font;
      const out = [];
      String(text).split("\n").forEach(par => {
        let line = "";
        Array.from(par).forEach(ch => {
          if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch;
        });
        out.push(line);
      });
      return out;
    };
    const lines = [
      { role: "진행자", name: state.name, text: a.anchor, color: "#2f7fd1" },
      { role: "기자", name: state.name, text: a.greet, color: "#9a6b3f" },
      { role: "기자", name: "", text: a.activity, color: "#9a6b3f" },
      { role: "기자", name: "", text: a.pollution, color: "#9a6b3f" },
      { role: "기자", name: "", text: a.effect, color: "#9a6b3f" },
      { role: "마무리", name: "", text: a.action, color: "#7b7fa8" },
      { role: "출처", name: "", text: a.source, color: "#4f9d3a" }
    ];
    ctx.font = roleFont;
    const badgeW = Math.max(120, ...lines.map(l => ctx.measureText(l.role + (l.name ? " " + l.name : "")).width + 28));
    const textX = pad + 12 + badgeW + 18;
    const textW = W - textX - pad - 12;
    const titleLines = wrap(a.title, W - pad * 2, headFont);
    const blocks = lines.map(l => ({ l, ls: wrap(l.text, textW, bodyFont) }));
    let H = pad + 70 + titleLines.length * 56 + 40;
    blocks.forEach(b => { H += Math.max(b.ls.length, 1) * lineH + 24; });
    H += 110;
    canvas.width = W; canvas.height = H;
    // 배경
    ctx.fillStyle = "#eef7df"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2f6b24"; ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = "#e2574c"; ctx.fillRect(pad, 18, 80, 34);
    ctx.fillStyle = "#fff"; ctx.font = "bold 20px Pretendard, sans-serif"; ctx.textBaseline = "middle"; ctx.fillText("LIVE", pad + 16, 35);
    ctx.font = roleFont; ctx.fillText("지구 지킴이 뉴스룸  ·  " + state.name + " 기자", pad + 100, 35);
    // 제목
    let y = 70 + pad;
    ctx.fillStyle = "#223322"; ctx.font = headFont; ctx.textBaseline = "top";
    titleLines.forEach(t => { ctx.fillText(t, pad, y); y += 56; });
    y += 20;
    // 대본
    blocks.forEach(({ l, ls }) => {
      const h = Math.max(ls.length, 1) * lineH + 16;
      ctx.fillStyle = "#ffffff"; roundRect(ctx, pad, y, W - pad * 2, h, 14); ctx.fill();
      ctx.fillStyle = l.color; roundRect(ctx, pad + 12, y + 10, badgeW, 36, 8); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = roleFont; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.fillText(l.role + (l.name ? " " + l.name : ""), pad + 12 + badgeW / 2, y + 28); ctx.textAlign = "left";
      ctx.fillStyle = "#223322"; ctx.font = bodyFont; ctx.textBaseline = "top";
      ls.forEach((t, i) => ctx.fillText(t, textX, y + 12 + i * lineH));
      y += h + 8;
    });
    // 자막 띠
    y += 16;
    ctx.fillStyle = "#ffffff"; roundRect(ctx, pad, y, W - pad * 2, 56, 10); ctx.fill();
    ctx.fillStyle = "#e2574c"; ctx.fillRect(pad, y, 90, 56);
    ctx.fillStyle = "#fff"; ctx.font = roleFont; ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillText("속보", pad + 45, y + 28);
    ctx.textAlign = "left"; ctx.fillStyle = "#111"; ctx.font = "bold 26px SchoolSafetyRoundedSmile, Pretendard, sans-serif";
    ctx.fillText(a.title, pad + 110, y + 28, W - pad * 2 - 130);
    // 저장
    const link = document.createElement("a");
    link.download = `${state.name || "기자"}_뉴스대본.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link); link.click(); link.remove();
    toast("이미지를 저장했어요.");
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* =====================================================
     모달 / 초기화
     ===================================================== */
  function openModal(html) {
    $("#modal").innerHTML = html;
    $("#modalBack").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() { $("#modalBack").hidden = true; document.body.style.overflow = ""; }
  $("#modalBack").addEventListener("click", (e) => {
    if (e.target.id === "modalBack" || e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modalBack").hidden) closeModal(); });

  $("#btnReset").addEventListener("click", () => {
    openModal(`<h3>🔄 처음부터 다시 할까요?</h3><p>이름, 스크랩, 기사, 퀴즈 결과가 모두 지워져요.</p>
      <div class="btn-row"><button class="btn btn-ghost" data-close>아니요</button><button class="btn btn-primary" id="confirmReset" style="background:#e2574c;box-shadow:0 4px 0 #a53c33">네, 지울게요</button></div>`);
    $("#confirmReset").addEventListener("click", () => {
      state = defaultState(); save(); closeModal();
      $("#reporterName").value = ""; $("#reporterClass").value = "";
      $("#startError").hidden = true;
      currentTab = "air";
      $$("#typeTabs .tab").forEach(t => t.classList.toggle("is-active", t.dataset.type === "air"));
      showStep(0);
      toast("처음부터 다시 시작해요.");
    });
  });

  /* ---------- 시작 ---------- */
  load();
  if (state.name) {
    $("#reporterName").value = state.name;
    $("#reporterClass").value = state.klass || "";
    showStep(Math.max(1, state.step || 1));
  } else {
    showStep(0);
  }
})();
