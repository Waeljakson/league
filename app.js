(() => {
  const cfg = window.LEAGUE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const baseState = {
    config: {
      schoolName: cfg.schoolName || "متوسطة وثانوية مدارس المشكاة",
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
    ]
  };

  let state = structuredClone(baseState);
  let activeLeague = "first-middle";

  function calcStandings(league) {
    const teamNames = league.teams || [...new Set(league.fixtures.flatMap(m => [m.home,m.away]))];
    const rows = Object.fromEntries(teamNames.map((team, i) => [team, {
      teamId:i+1, team, played:0, won:0, drawn:0, lost:0, goalsFor:0, goalsAgainst:0,
      goalDifference:0, points:0
    }]));
    for (const m of league.fixtures) {
      if (m.status !== "completed" || m.homeScore == null || m.awayScore == null) continue;
      const h = rows[m.home], a = rows[m.away];
      h.played++; a.played++;
      h.goalsFor += +m.homeScore; h.goalsAgainst += +m.awayScore;
      a.goalsFor += +m.awayScore; a.goalsAgainst += +m.homeScore;
      if (+m.homeScore > +m.awayScore) { h.won++; a.lost++; h.points += 3; }
      else if (+m.homeScore < +m.awayScore) { a.won++; h.lost++; a.points += 3; }
      else { h.drawn++; a.drawn++; h.points++; a.points++; }
    }
    return Object.values(rows).map(r => ({...r,goalDifference:r.goalsFor-r.goalsAgainst}))
      .sort((a,b) => b.points-a.points || b.goalDifference-a.goalDifference || b.goalsFor-a.goalsFor || a.team.localeCompare(b.team,"ar"));
  }

  function normalizeState(s) {
    if (!s || !Array.isArray(s.leagues)) return structuredClone(baseState);
    s.leagues.forEach(l => {
      if (!Array.isArray(l.teams)) l.teams = [...new Set((l.fixtures || []).flatMap(m => [m.home,m.away]))];
      if (!Array.isArray(l.standings)) l.standings = calcStandings(l);
    });
    return s;
  }

  function localLoad() {
    try {
      const saved = JSON.parse(localStorage.getItem("mishkatLeagueState") || "null");
      if (saved) return normalizeState(saved);
    } catch {}
    return normalizeState(structuredClone(baseState));
  }

  function localSave() {
    localStorage.setItem("mishkatLeagueState", JSON.stringify(state));
  }

  async function rpc(name, body = {}) {
    if (!cfg.dataApiUrl) throw new Error("NO_REMOTE");
    const url = cfg.dataApiUrl.replace(/\/$/,"") + "/rpc/" + name;
    const res = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = await res.text();
      try { const j = JSON.parse(msg); msg = j.message || j.details || msg; } catch {}
      throw new Error(msg || "API_ERROR");
    }
    const data = await res.json();
    return data;
  }

  async function loadState(showStatus = true) {
    if (showStatus) setSync("جاري التحديث…");
    if (cfg.dataApiUrl) {
      try {
        const remote = await rpc("league_state");
        state = normalizeState(remote);
        setSync("متصل بقاعدة البيانات");
      } catch (e) {
        console.error(e);
        state = localLoad();
        setSync("وضع محلي مؤقت");
      }
    } else {
      state = localLoad();
      setSync("وضع تجريبي محلي");
    }
    renderAll();
  }

  function setSync(text) {
    $("#syncStatus").textContent = text;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso + "T12:00:00");
      return new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
    } catch { return iso; }
  }

  function getAllFixtures() {
    return state.leagues.flatMap(l => l.fixtures.map(m => ({...m,leagueSlug:l.slug,leagueName:l.name})));
  }

  function renderStats() {
    const all = getAllFixtures();
    const done = all.filter(m => m.status === "completed").length;
    const left = all.length - done;
    const now = new Date(); now.setHours(0,0,0,0);
    const next = all.filter(m => m.status !== "completed" && m.status !== "postponed")
      .sort((a,b) => new Date(a.date)-new Date(b.date))
      .find(m => new Date(m.date+"T00:00:00") >= now) ||
      all.filter(m => m.status === "scheduled").sort((a,b) => new Date(a.date)-new Date(b.date))[0];
    $("#statTotal").textContent = all.length;
    $("#statDone").textContent = done;
    $("#statLeft").textContent = left;
    $("#statNext").textContent = next ? `#${next.matchNo} — ${next.day}` : "اكتمل الدوري";
  }

  function renderLeague() {
    const league = state.leagues.find(l => l.slug === activeLeague) || state.leagues[0];
    if (!league) return;
    $("#fixturesTitle").textContent = league.name;
    $("#standingsTitle").textContent = league.description || "جدول الترتيب";

    const fixtures = [...league.fixtures].sort((a,b) => a.matchNo-b.matchNo);
    $("#fixtures").innerHTML = fixtures.map(m => {
      const done = m.status === "completed";
      const postponed = m.status === "postponed";
      const score = done ? `${m.homeScore} - ${m.awayScore}` : postponed ? "مؤجلة" : "لم تلعب";
      return `<article class="fixture">
        <div class="fixture-date"><strong>مباراة #${m.matchNo}</strong>${m.day}<br>${formatDate(m.date)}</div>
        <div class="fixture-teams">${m.home} <span aria-hidden="true">×</span> ${m.away}</div>
        <div class="fixture-score ${done?"done":""} ${postponed?"postponed":""}">${score}</div>
      </article>`;
    }).join("");

    const standings = Array.isArray(league.standings) ? league.standings : calcStandings(league);
    $("#standings").innerHTML = standings.map((r,i) => `<tr>
      <td><span class="rank">${i+1}</span></td>
      <td>${r.team}</td>
      <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
      <td>${r.goalsFor}</td><td>${r.goalsAgainst}</td><td>${r.goalDifference}</td><td><strong>${r.points}</strong></td>
    </tr>`).join("");
  }

  function renderRules() {
    const rules = state.config?.rules || baseState.config.rules;
    $("#rulesList").innerHTML = rules.map(r => `<li>${r}</li>`).join("");
  }

  function renderMatchOptions() {
    const all = getAllFixtures().sort((a,b) => a.matchNo-b.matchNo);
    $("#matchSelect").innerHTML = all.map(m => `<option value="${m.matchNo}">#${m.matchNo} — ${m.home} × ${m.away} (${m.day})</option>`).join("");
    updateSelectedMatch();
  }

  function updateSelectedMatch() {
    const no = +$("#matchSelect").value;
    const m = getAllFixtures().find(x => x.matchNo === no);
    if (!m) return;
    $("#homeLabel").textContent = m.home;
    $("#awayLabel").textContent = m.away;
    $("#homeScore").value = m.homeScore ?? "";
    $("#awayScore").value = m.awayScore ?? "";
  }

  function renderAll() {
    state.leagues.forEach(l => { if (!Array.isArray(l.standings) || !cfg.dataApiUrl) l.standings = calcStandings(l); });
    renderStats();
    renderLeague();
    renderRules();
    renderMatchOptions();
  }

  function adminMsg(text, type="") {
    const el = $("#adminMessage");
    el.textContent = text;
    el.className = "admin-message " + type;
  }

  async function setScore() {
    const matchNo = +$("#matchSelect").value;
    const homeScore = +$("#homeScore").value;
    const awayScore = +$("#awayScore").value;
    const adminKey = $("#adminKey").value.trim();
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      return adminMsg("أدخل نتيجة صحيحة للفريقين.", "error");
    }
    adminMsg("جاري الحفظ…");
    try {
      if (cfg.dataApiUrl) {
        await rpc("league_set_score", {p_match_no:matchNo,p_home_score:homeScore,p_away_score:awayScore,p_admin_key:adminKey});
        await loadState(false);
      } else {
        const m = getAllFixtures().find(x => x.matchNo === matchNo);
        const target = state.leagues.find(l => l.fixtures.some(x => x.matchNo === matchNo)).fixtures.find(x => x.matchNo === matchNo);
        Object.assign(target,{homeScore,awayScore,status:"completed"});
        localSave(); renderAll();
      }
      sessionStorage.setItem("leagueAdminKey", adminKey);
      adminMsg("تم حفظ النتيجة وتحديث الترتيب.", "ok");
    } catch (e) {
      console.error(e);
      adminMsg(String(e.message).includes("INVALID_ADMIN_KEY") ? "رمز الإدارة غير صحيح." : "تعذر حفظ النتيجة. تحقق من الاتصال.", "error");
    }
  }

  async function changeMatch(action) {
    const matchNo = +$("#matchSelect").value;
    const adminKey = $("#adminKey").value.trim();
    adminMsg("جاري التنفيذ…");
    try {
      if (cfg.dataApiUrl) {
        await rpc(action === "reset" ? "league_reset_match" : "league_postpone_match", {p_match_no:matchNo,p_admin_key:adminKey});
        await loadState(false);
      } else {
        const target = state.leagues.find(l => l.fixtures.some(x => x.matchNo === matchNo)).fixtures.find(x => x.matchNo === matchNo);
        target.homeScore = null; target.awayScore = null; target.status = action === "reset" ? "scheduled" : "postponed";
        localSave(); renderAll();
      }
      adminMsg(action === "reset" ? "تم إلغاء النتيجة." : "تم تأجيل المباراة.", "ok");
    } catch (e) {
      adminMsg(String(e.message).includes("INVALID_ADMIN_KEY") ? "رمز الإدارة غير صحيح." : "تعذر تنفيذ الطلب.", "error");
    }
  }

  $$(".league-tab").forEach(btn => btn.addEventListener("click", () => {
    $$(".league-tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    activeLeague = btn.dataset.league;
    renderLeague();
  }));
  $("#adminBtn").addEventListener("click", () => {
    $("#adminKey").value = sessionStorage.getItem("leagueAdminKey") || "";
    adminMsg("");
    renderMatchOptions();
    $("#adminDialog").showModal();
  });
  $("#matchSelect").addEventListener("change", updateSelectedMatch);
  $("#saveScoreBtn").addEventListener("click", setScore);
  $("#resetMatchBtn").addEventListener("click", () => changeMatch("reset"));
  $("#postponeBtn").addEventListener("click", () => changeMatch("postpone"));

  loadState();
  setInterval(() => { if (cfg.dataApiUrl) loadState(false); }, Math.max(30, cfg.refreshSeconds || 60) * 1000);
})();