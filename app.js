(() => {
  const cfg = window.LEAGUE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const apiBase = String(cfg.apiUrl || "").replace(/\/$/, "");

  const baseState = {
    config: {
      schoolName: cfg.schoolName || "متوسطة وثانوية مشكاة الشعلة الأهلية",
      appName: "دوري المشكاة المدرسي",
      season: "1448هـ / 2026",
      rules: [
        "عدد اللاعبين: 6 لاعبين + حارس مرمى",
        "الالتزام بالزي الرياضي وحذاء رياضي مناسب"
      ]
    },
    leagues: [
      {
        id: 1,
        slug: "first-middle",
        name: "دوري الصف الأول متوسط",
        description: "دوري ذهاب وعودة - كل فريق يلاعب جميع الفرق مرتين",
        fixtures: [
          {matchNo:2,date:"2026-10-05",day:"الاثنين",round:1,home:"أول 1",away:"أول 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:4,date:"2026-10-07",day:"الأربعاء",round:1,home:"أول 2",away:"أول 3",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:6,date:"2026-10-11",day:"الأحد",round:1,home:"أول 3",away:"أول 1",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:8,date:"2026-10-13",day:"الثلاثاء",round:2,home:"أول 2",away:"أول 1",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:10,date:"2026-10-15",day:"الخميس",round:2,home:"أول 3",away:"أول 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:12,date:"2026-10-19",day:"الاثنين",round:2,home:"أول 1",away:"أول 3",homeScore:null,awayScore:null,status:"scheduled"}
        ],
        teams:["أول 1","أول 2","أول 3"]
      },
      {
        id: 2,
        slug: "second-third-middle",
        name: "دوري الصفين الثاني والثالث متوسط",
        description: "دوري من دور واحد - كل فريق يلاعب جميع الفرق مرة واحدة",
        fixtures: [
          {matchNo:1,date:"2026-10-04",day:"الأحد",round:1,home:"ثالث 2",away:"ثاني 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:3,date:"2026-10-06",day:"الثلاثاء",round:1,home:"ثاني 1",away:"ثالث 1",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:5,date:"2026-10-08",day:"الخميس",round:1,home:"ثاني 3",away:"ثالث 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:7,date:"2026-10-12",day:"الاثنين",round:1,home:"ثاني 2",away:"ثالث 1",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:9,date:"2026-10-14",day:"الأربعاء",round:1,home:"ثاني 1",away:"ثاني 3",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:11,date:"2026-10-18",day:"الأحد",round:1,home:"ثالث 1",away:"ثالث 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:13,date:"2026-10-20",day:"الثلاثاء",round:1,home:"ثاني 2",away:"ثاني 3",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:14,date:"2026-10-21",day:"الأربعاء",round:1,home:"ثاني 1",away:"ثالث 2",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:15,date:"2026-10-22",day:"الخميس",round:1,home:"ثاني 3",away:"ثالث 1",homeScore:null,awayScore:null,status:"scheduled"},
          {matchNo:16,date:"2026-10-25",day:"الأحد",round:1,home:"ثاني 1",away:"ثاني 2",homeScore:null,awayScore:null,status:"scheduled"}
        ],
        teams:["ثاني 1","ثاني 2","ثاني 3","ثالث 1","ثالث 2"]
      }
    ],
    discipline: []
  };

  let state = clone(baseState);
  let activeLeague = "first-middle";
  let eventSource = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function calcStandings(league) {
    const rows = Object.fromEntries((league.teams || []).map((team, i) => [team, {
      teamId:i+1, team, played:0, won:0, drawn:0, lost:0,
      goalsFor:0, goalsAgainst:0, goalDifference:0, points:0
    }]));

    for (const m of league.fixtures || []) {
      if (m.status !== "completed" || m.homeScore == null || m.awayScore == null) continue;
      const h = rows[m.home];
      const a = rows[m.away];
      if (!h || !a) continue;

      h.played++; a.played++;
      h.goalsFor += Number(m.homeScore);
      h.goalsAgainst += Number(m.awayScore);
      a.goalsFor += Number(m.awayScore);
      a.goalsAgainst += Number(m.homeScore);

      if (Number(m.homeScore) > Number(m.awayScore)) {
        h.won++; a.lost++; h.points += 3;
      } else if (Number(m.homeScore) < Number(m.awayScore)) {
        a.won++; h.lost++; a.points += 3;
      } else {
        h.drawn++; a.drawn++; h.points++; a.points++;
      }
    }

    return Object.values(rows)
      .map(r => ({...r, goalDifference:r.goalsFor-r.goalsAgainst}))
      .sort((a,b) =>
        b.points-a.points ||
        b.goalDifference-a.goalDifference ||
        b.goalsFor-a.goalsFor ||
        a.team.localeCompare(b.team, "ar")
      );
  }

  function applyRemoteState(payload) {
    const next = clone(baseState);
    const results = payload?.results || {};

    for (const league of next.leagues) {
      for (const match of league.fixtures) {
        const r = results[match.matchNo] || results[String(match.matchNo)];
        if (!r) continue;
        match.homeScore = r.homeScore ?? null;
        match.awayScore = r.awayScore ?? null;
        match.status = r.status || "scheduled";
      }
    }

    next.discipline = Array.isArray(payload?.discipline) ? payload.discipline : [];
    return next;
  }

  function cacheState() {
    try {
      localStorage.setItem("mishkatLeagueLiveCache", JSON.stringify(state));
    } catch {}
  }

  function loadCache() {
    try {
      const saved = JSON.parse(localStorage.getItem("mishkatLeagueLiveCache") || "null");
      return saved?.leagues ? saved : clone(baseState);
    } catch {
      return clone(baseState);
    }
  }

  function setSync(text) {
    const el = $("#syncStatus");
    if (el) el.textContent = text;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {...options, signal:controller.signal, cache:"no-store"});
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadState(showLoading = true) {
    if (!apiBase) {
      state = loadCache();
      state.discipline ||= [];
      setSync("وضع محلي");
      renderAll();
      return;
    }

    if (showLoading) setSync("جاري الاتصال…");

    try {
      const res = await fetchWithTimeout(apiBase + "/state");
      if (!res.ok) throw new Error("STATE_FETCH_FAILED");
      const payload = await res.json();
      state = applyRemoteState(payload);
      cacheState();
      setSync("متصل — تحديث مباشر");
      renderAll();
    } catch (err) {
      console.error(err);
      state = loadCache();
      state.discipline ||= [];
      setSync("غير متصل — آخر نسخة محفوظة");
      renderAll();
    }
  }

  async function apiPost(path, body) {
    const res = await fetchWithTimeout(apiBase + path, {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(body)
    });

    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const error = new Error(data.error || "API_ERROR");
      error.status = res.status;
      throw error;
    }

    return data;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso + "T12:00:00");
      return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        day:"2-digit", month:"2-digit", year:"numeric"
      }).format(d);
    } catch {
      return iso;
    }
  }

  function getAllFixtures() {
    return state.leagues.flatMap(l =>
      l.fixtures.map(m => ({...m, leagueSlug:l.slug, leagueName:l.name}))
    );
  }

  function allTeams() {
    return [...new Set(baseState.leagues.flatMap(l => l.teams || []))];
  }

  function setActiveLeague(slug) {
    activeLeague = slug;
    $$(".league-tab").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.league === slug)
    );
  }

  function activateLeagueForMatch(matchNo) {
    const league = state.leagues.find(l =>
      l.fixtures.some(m => m.matchNo === matchNo)
    );
    if (league) setActiveLeague(league.slug);
  }

  function aggregateDiscipline() {
    const map = new Map();

    for (const record of state.discipline || []) {
      const player = String(record.player || "").trim();
      const team = String(record.team || "").trim();
      if (!player || !team) continue;

      const key = team + "||" + player.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          player,
          team,
          yellow:0,
          red:0,
          remainingSuspension:0
        });
      }

      const row = map.get(key);
      if (record.cardType === "yellow") row.yellow++;
      if (record.cardType === "red") row.red++;
      row.remainingSuspension += Math.max(0, Number(record.remainingSuspension || 0));
    }

    return [...map.values()].sort((a,b) =>
      b.remainingSuspension-a.remainingSuspension ||
      b.red-a.red ||
      b.yellow-a.yellow ||
      a.team.localeCompare(b.team, "ar") ||
      a.player.localeCompare(b.player, "ar")
    );
  }

  function renderStats() {
    const all = getAllFixtures();
    const done = all.filter(m => m.status === "completed").length;
    const left = all.filter(m => m.status !== "completed").length;

    const now = new Date();
    now.setHours(0,0,0,0);

    const next = all
      .filter(m => m.status === "scheduled")
      .sort((a,b) => new Date(a.date)-new Date(b.date))
      .find(m => new Date(m.date+"T00:00:00") >= now) ||
      all.filter(m => m.status === "scheduled")
        .sort((a,b) => new Date(a.date)-new Date(b.date))[0];

    $("#statTotal").textContent = all.length;
    $("#statDone").textContent = done;
    $("#statLeft").textContent = left;
    $("#statNext").textContent = next ? `#${next.matchNo} — ${next.day}` : "اكتمل الدوري";
  }

  function renderLeague() {
    const league = state.leagues.find(l => l.slug === activeLeague) || state.leagues[0];
    if (!league) return;

    $("#fixturesTitle").textContent = league.name;
    $("#standingsTitle").textContent = league.description || "جدول الدوري";

    $("#fixtures").innerHTML = [...league.fixtures]
      .sort((a,b) => a.matchNo-b.matchNo)
      .map(m => {
        const done = m.status === "completed";
        const postponed = m.status === "postponed";
        const score = done ? `${m.homeScore} - ${m.awayScore}` : postponed ? "مؤجلة" : "لم تلعب";

        return `<article class="fixture">
          <div class="fixture-date">
            <strong>مباراة #${m.matchNo}</strong>
            ${m.day}<br>${formatDate(m.date)}
          </div>
          <div class="fixture-teams">${m.home} <span aria-hidden="true">×</span> ${m.away}</div>
          <div class="fixture-score ${done?"done":""} ${postponed?"postponed":""}">${score}</div>
        </article>`;
      }).join("");

    const standings = calcStandings(league);
    $("#standings").innerHTML = standings.map((r,i) => `<tr>
      <td><span class="rank">${i+1}</span></td>
      <td>${r.team}</td>
      <td>${r.played}</td>
      <td>${r.won}</td>
      <td>${r.drawn}</td>
      <td>${r.lost}</td>
      <td>${r.goalsFor}</td>
      <td>${r.goalsAgainst}</td>
      <td>${r.goalDifference}</td>
      <td><strong>${r.points}</strong></td>
    </tr>`).join("");
  }

  function renderDiscipline() {
    const records = state.discipline || [];
    const rows = aggregateDiscipline();

    $("#yellowCount").textContent = records.filter(r => r.cardType === "yellow").length;
    $("#redCount").textContent = records.filter(r => r.cardType === "red").length;
    $("#suspendedCount").textContent = rows.filter(r => r.remainingSuspension > 0).length;

    $("#disciplineTable").innerHTML = rows.map(r => `<tr>
      <td>${escapeHtml(r.player)}</td>
      <td>${escapeHtml(r.team)}</td>
      <td><strong>${r.yellow}</strong></td>
      <td><strong>${r.red}</strong></td>
      <td><span class="suspension-number">${r.remainingSuspension}</span></td>
      <td>
        <span class="status-badge ${r.remainingSuspension > 0 ? "suspended" : "clear"}">
          ${r.remainingSuspension > 0 ? "موقوف" : "متاح"}
        </span>
      </td>
    </tr>`).join("");

    $("#disciplineEmpty").style.display = rows.length ? "none" : "block";
  }

  function renderRules() {
    $("#rulesList").innerHTML = (state.config?.rules || baseState.config.rules)
      .map(r => `<li>${escapeHtml(r)}</li>`)
      .join("");
  }

  function renderMatchOptions() {
    const select = $("#matchSelect");
    const current = select.value;
    const all = getAllFixtures().sort((a,b) => a.matchNo-b.matchNo);

    select.innerHTML = all.map(m =>
      `<option value="${m.matchNo}">#${m.matchNo} — ${m.home} × ${m.away} (${m.day})</option>`
    ).join("");

    if (current && all.some(m => String(m.matchNo) === String(current))) {
      select.value = current;
    }
    updateSelectedMatch();
  }

  function updateSelectedMatch() {
    const no = Number($("#matchSelect").value);
    const m = getAllFixtures().find(x => x.matchNo === no);
    if (!m) return;

    $("#homeLabel").textContent = m.home;
    $("#awayLabel").textContent = m.away;
    $("#homeScore").value = m.homeScore ?? "";
    $("#awayScore").value = m.awayScore ?? "";
  }

  function renderDisciplineTeamOptions() {
    const select = $("#disciplineTeam");
    const current = select.value;
    select.innerHTML = allTeams()
      .map(team => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`)
      .join("");

    if (current && allTeams().includes(current)) select.value = current;
    renderDisciplineMatchOptions();
  }

  function renderDisciplineMatchOptions() {
    const team = $("#disciplineTeam").value;
    const select = $("#disciplineMatch");
    const current = select.value;

    const matches = getAllFixtures()
      .filter(m => !team || m.home === team || m.away === team)
      .sort((a,b) => a.matchNo-b.matchNo);

    select.innerHTML =
      '<option value="">بدون تحديد مباراة</option>' +
      matches.map(m =>
        `<option value="${m.matchNo}">#${m.matchNo} — ${m.home} × ${m.away}</option>`
      ).join("");

    if (current && matches.some(m => String(m.matchNo) === String(current))) {
      select.value = current;
    }
  }

  function cardHtml(type) {
    return type === "red"
      ? '<span class="card-label"><span class="mini-card red"></span> أحمر</span>'
      : '<span class="card-label"><span class="mini-card yellow"></span> إنذار</span>';
  }

  function renderAdminDisciplineRecords() {
    const list = $("#disciplineAdminList");
    const records = [...(state.discipline || [])].sort((a,b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    if (!records.length) {
      list.innerHTML = '<p class="empty-state">لا توجد عقوبات مسجلة.</p>';
      return;
    }

    list.innerHTML = records.map(r => {
      const match = r.matchNo ? ` — مباراة #${r.matchNo}` : "";
      const remaining = Math.max(0, Number(r.remainingSuspension || 0));

      return `<div class="discipline-admin-row">
        <div>
          <div class="name">${escapeHtml(r.player)} — ${escapeHtml(r.team)}</div>
          <div class="meta">
            ${cardHtml(r.cardType)}
            ${match}
            — الإيقاف المتبقي: <strong>${remaining}</strong>
          </div>
        </div>
        <div class="discipline-admin-actions">
          ${remaining > 0 ? `<button class="mini-btn serve" type="button" data-discipline-action="serve" data-id="${escapeHtml(r.id)}">تنفيذ مباراة إيقاف</button>` : ""}
          <button class="mini-btn delete" type="button" data-discipline-action="delete" data-id="${escapeHtml(r.id)}">حذف</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderAll() {
    renderStats();
    renderLeague();
    renderDiscipline();
    renderRules();
    renderMatchOptions();
    renderDisciplineTeamOptions();
    renderAdminDisciplineRecords();
  }

  function adminMsg(text, type="") {
    const el = $("#adminMessage");
    el.textContent = text;
    el.className = "admin-message " + type;
  }

  function disciplineMsg(text, type="") {
    const el = $("#disciplineMessage");
    el.textContent = text;
    el.className = "admin-message " + type;
  }

  async function setScore() {
    const matchNo = Number($("#matchSelect").value);
    const homeScore = Number($("#homeScore").value);
    const awayScore = Number($("#awayScore").value);
    const adminKey = $("#adminKey").value.trim();

    if (!adminKey) return adminMsg("أدخل رمز الإدارة.", "error");

    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      return adminMsg("أدخل نتيجة صحيحة للفريقين.", "error");
    }

    adminMsg("جاري الحفظ…");

    try {
      await apiPost("/score", {matchNo,homeScore,awayScore,adminKey});
      sessionStorage.setItem("leagueAdminKey", adminKey);
      $("#disciplineAdminKey").value = adminKey;
      await loadState(false);
      activateLeagueForMatch(matchNo);
      renderAll();
      adminMsg("تم حفظ النتيجة وظهرت مباشرة لجميع الأجهزة.", "ok");
    } catch (e) {
      console.error(e);
      adminMsg(
        e.message === "INVALID_ADMIN_KEY"
          ? "رمز الإدارة غير صحيح."
          : "تعذر حفظ النتيجة. تحقق من الاتصال.",
        "error"
      );
    }
  }

  async function changeMatch(action) {
    const matchNo = Number($("#matchSelect").value);
    const adminKey = $("#adminKey").value.trim();

    if (!adminKey) return adminMsg("أدخل رمز الإدارة.", "error");

    adminMsg("جاري التنفيذ…");

    try {
      await apiPost(action === "reset" ? "/reset" : "/postpone", {matchNo,adminKey});
      sessionStorage.setItem("leagueAdminKey", adminKey);
      $("#disciplineAdminKey").value = adminKey;
      await loadState(false);
      activateLeagueForMatch(matchNo);
      renderAll();
      adminMsg(
        action === "reset"
          ? "تم إلغاء النتيجة وتحديث جميع الأجهزة."
          : "تم تأجيل المباراة وتحديث جميع الأجهزة.",
        "ok"
      );
    } catch (e) {
      console.error(e);
      adminMsg(
        e.message === "INVALID_ADMIN_KEY"
          ? "رمز الإدارة غير صحيح."
          : "تعذر تنفيذ الطلب.",
        "error"
      );
    }
  }

  async function addDisciplineRecord() {
    const adminKey = $("#disciplineAdminKey").value.trim();
    const team = $("#disciplineTeam").value;
    const player = $("#disciplinePlayer").value.trim();
    const cardType = $("#disciplineCardType").value;
    const matchNo = $("#disciplineMatch").value || null;
    const suspensionMatches = Number($("#disciplineSuspension").value);

    if (!adminKey) return disciplineMsg("أدخل رمز الإدارة.", "error");
    if (player.length < 2) return disciplineMsg("أدخل اسم اللاعب.", "error");
    if (!Number.isInteger(suspensionMatches) || suspensionMatches < 0 || suspensionMatches > 10) {
      return disciplineMsg("عدد مباريات الإيقاف يجب أن يكون من 0 إلى 10.", "error");
    }

    disciplineMsg("جاري تسجيل العقوبة…");

    try {
      await apiPost("/discipline/add", {
        adminKey,
        team,
        player,
        cardType,
        matchNo,
        suspensionMatches
      });

      sessionStorage.setItem("leagueAdminKey", adminKey);
      $("#adminKey").value = adminKey;
      $("#disciplinePlayer").value = "";
      $("#disciplineSuspension").value = cardType === "red" ? "1" : "0";
      await loadState(false);
      disciplineMsg("تم تسجيل العقوبة وظهرت مباشرة لجميع الأجهزة.", "ok");
    } catch (e) {
      console.error(e);
      disciplineMsg(
        e.message === "INVALID_ADMIN_KEY"
          ? "رمز الإدارة غير صحيح."
          : "تعذر تسجيل العقوبة.",
        "error"
      );
    }
  }

  async function disciplineAction(action, id) {
    const adminKey = $("#disciplineAdminKey").value.trim();
    if (!adminKey) return disciplineMsg("أدخل رمز الإدارة.", "error");

    if (action === "delete" && !window.confirm("هل تريد حذف هذا السجل؟")) return;

    disciplineMsg("جاري التحديث…");

    try {
      await apiPost(
        action === "serve" ? "/discipline/serve" : "/discipline/delete",
        {adminKey,id}
      );

      sessionStorage.setItem("leagueAdminKey", adminKey);
      $("#adminKey").value = adminKey;
      await loadState(false);
      disciplineMsg(
        action === "serve"
          ? "تم احتساب مباراة من الإيقاف."
          : "تم حذف السجل.",
        "ok"
      );
    } catch (e) {
      console.error(e);
      disciplineMsg(
        e.message === "INVALID_ADMIN_KEY"
          ? "رمز الإدارة غير صحيح."
          : "تعذر تحديث السجل.",
        "error"
      );
    }
  }

  function startLiveUpdates() {
    if (!apiBase || !window.EventSource) return;

    try {
      eventSource?.close();
      eventSource = new EventSource(apiBase + "/events");

      eventSource.addEventListener("ready", () =>
        setSync("متصل — تحديث مباشر")
      );

      eventSource.addEventListener("update", () =>
        loadState(false)
      );

      eventSource.onerror = () =>
        setSync("إعادة الاتصال…");
    } catch (e) {
      console.error(e);
    }
  }

  $$(".league-tab").forEach(btn =>
    btn.addEventListener("click", () => {
      setActiveLeague(btn.dataset.league);
      renderLeague();
    })
  );

  $$(".admin-tab").forEach(btn =>
    btn.addEventListener("click", () => {
      $$(".admin-tab").forEach(x => x.classList.remove("active"));
      $$(".admin-panel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      $("#" + btn.dataset.panel).classList.add("active");
    })
  );

  $("#adminBtn").addEventListener("click", () => {
    const savedKey = sessionStorage.getItem("leagueAdminKey") || "";
    $("#adminKey").value = savedKey;
    $("#disciplineAdminKey").value = savedKey;
    adminMsg("");
    disciplineMsg("");
    renderMatchOptions();
    renderDisciplineTeamOptions();
    renderAdminDisciplineRecords();
    $("#adminDialog").showModal();
  });

  $("#matchSelect").addEventListener("change", updateSelectedMatch);
  $("#saveScoreBtn").addEventListener("click", setScore);
  $("#resetMatchBtn").addEventListener("click", () => changeMatch("reset"));
  $("#postponeBtn").addEventListener("click", () => changeMatch("postpone"));

  $("#disciplineTeam").addEventListener("change", renderDisciplineMatchOptions);

  $("#disciplineCardType").addEventListener("change", () => {
    $("#disciplineSuspension").value =
      $("#disciplineCardType").value === "red" ? "1" : "0";
  });

  $("#addDisciplineBtn").addEventListener("click", addDisciplineRecord);

  $("#disciplineAdminList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-discipline-action]");
    if (!btn) return;
    disciplineAction(btn.dataset.disciplineAction, btn.dataset.id);
  });

  loadState().then(startLiveUpdates);

  setInterval(
    () => loadState(false),
    Math.max(10, Number(cfg.refreshSeconds) || 10) * 1000
  );
})();