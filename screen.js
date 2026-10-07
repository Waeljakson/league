(() => {
  const cfg = window.LEAGUE_CONFIG || {};
  const apiBase = String(cfg.apiUrl || "").replace(/\/$/, "");
  const $ = (s) => document.querySelector(s);

  const leagues = [
    {
      slug:"first-middle",
      name:"دوري الصف الأول متوسط",
      teams:["أول 1","أول 2","أول 3"],
      fixtures:[
        {matchNo:2,date:"2026-10-05",day:"الاثنين",home:"أول 1",away:"أول 2"},
        {matchNo:4,date:"2026-10-07",day:"الأربعاء",home:"أول 2",away:"أول 3"},
        {matchNo:6,date:"2026-10-11",day:"الأحد",home:"أول 3",away:"أول 1"},
        {matchNo:8,date:"2026-10-13",day:"الثلاثاء",home:"أول 2",away:"أول 1"},
        {matchNo:10,date:"2026-10-15",day:"الخميس",home:"أول 3",away:"أول 2"},
        {matchNo:12,date:"2026-10-19",day:"الاثنين",home:"أول 1",away:"أول 3"}
      ]
    },
    {
      slug:"second-third-middle",
      name:"دوري الصفين الثاني والثالث متوسط",
      teams:["ثاني 1","ثاني 2","ثاني 3","ثالث 1","ثالث 2"],
      fixtures:[
        {matchNo:1,date:"2026-10-04",day:"الأحد",home:"ثالث 2",away:"ثاني 2"},
        {matchNo:3,date:"2026-10-06",day:"الثلاثاء",home:"ثاني 1",away:"ثالث 1"},
        {matchNo:5,date:"2026-10-08",day:"الخميس",home:"ثاني 3",away:"ثالث 2"},
        {matchNo:7,date:"2026-10-12",day:"الاثنين",home:"ثاني 2",away:"ثالث 1"},
        {matchNo:9,date:"2026-10-14",day:"الأربعاء",home:"ثاني 1",away:"ثاني 3"},
        {matchNo:11,date:"2026-10-18",day:"الأحد",home:"ثالث 1",away:"ثالث 2"},
        {matchNo:13,date:"2026-10-20",day:"الثلاثاء",home:"ثاني 2",away:"ثاني 3"},
        {matchNo:14,date:"2026-10-21",day:"الأربعاء",home:"ثاني 1",away:"ثالث 2"},
        {matchNo:15,date:"2026-10-22",day:"الخميس",home:"ثاني 3",away:"ثالث 1"},
        {matchNo:16,date:"2026-10-25",day:"الأحد",home:"ثاني 1",away:"ثاني 2"}
      ]
    }
  ];

  let results = {};
  let discipline = [];
  let lastUpdated = null;
  let source = null;

  function isoLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,"0");
    const d = String(date.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }

  function todayIso() {
    return isoLocal(new Date());
  }

  function tomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate()+1);
    return isoLocal(d);
  }

  function formatClock() {
    const now = new Date();
    $("#clockTime").textContent = new Intl.DateTimeFormat("ar-SA", {
      hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
    }).format(now);
    $("#clockDate").textContent = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
      weekday:"long", day:"numeric", month:"long", year:"numeric"
    }).format(now);
  }

  function applyResults() {
    for (const league of leagues) {
      for (const match of league.fixtures) {
        const r = results[match.matchNo] || results[String(match.matchNo)];
        match.homeScore = r?.homeScore ?? null;
        match.awayScore = r?.awayScore ?? null;
        match.status = r?.status || "scheduled";
      }
    }
  }

  function calcStandings(league) {
    const rows = Object.fromEntries(league.teams.map(team => [team, {
      team, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0
    }]));

    for (const m of league.fixtures) {
      if (m.status !== "completed" || m.homeScore == null || m.awayScore == null) continue;
      const h = rows[m.home], a = rows[m.away];
      h.played++; a.played++;
      h.gf += Number(m.homeScore); h.ga += Number(m.awayScore);
      a.gf += Number(m.awayScore); a.ga += Number(m.homeScore);
      if (Number(m.homeScore) > Number(m.awayScore)) { h.won++; a.lost++; h.points += 3; }
      else if (Number(m.homeScore) < Number(m.awayScore)) { a.won++; h.lost++; a.points += 3; }
      else { h.drawn++; a.drawn++; h.points++; a.points++; }
    }

    return Object.values(rows)
      .map(r => ({...r, gd:r.gf-r.ga}))
      .sort((a,b) => b.points-a.points || b.gd-a.gd || b.gf-a.gf || a.team.localeCompare(b.team,"ar"));
  }

  function allFixtures() {
    return leagues.flatMap(league => league.fixtures.map(match => ({league,match})));
  }

  function getTodayContext() {
    const today = todayIso();
    const todayItem = allFixtures().find(x => x.match.date === today);
    if (todayItem) return {...todayItem,isToday:true};

    const upcoming = allFixtures()
      .filter(x => x.match.status === "scheduled" && x.match.date > today)
      .sort((a,b) => a.match.date.localeCompare(b.match.date))[0];

    if (upcoming) return {...upcoming,isToday:false};

    const latest = allFixtures().sort((a,b) => b.match.date.localeCompare(a.match.date))[0];
    return latest ? {...latest,isToday:false} : null;
  }

  function getTomorrowContext() {
    const date = tomorrowIso();
    return allFixtures().find(x => x.match.date === date) || null;
  }

  function renderMainMatch(context) {
    if (!context) {
      $("#matchStage").hidden = true;
      $("#noMatch").hidden = false;
      $("#leagueName").textContent = "—";
      $("#matchMeta").textContent = "—";
      return;
    }

    const {league,match,isToday} = context;
    $("#matchStage").hidden = false;
    $("#noMatch").hidden = true;
    $("#matchLabel").textContent = isToday ? "مباراة اليوم" : "المباراة القادمة";
    $("#leagueName").textContent = league.name;
    $("#matchMeta").textContent = `مباراة #${match.matchNo} — ${match.day} — ${match.date}`;
    $("#homeTeam").textContent = match.home;
    $("#awayTeam").textContent = match.away;

    const status = $("#matchStatus");
    status.className = "match-status";

    if (match.status === "completed") {
      $("#homeScore").textContent = match.homeScore;
      $("#awayScore").textContent = match.awayScore;
      status.textContent = isToday ? "النتيجة المباشرة" : "انتهت";
      status.classList.add("completed");
    } else if (match.status === "postponed") {
      $("#homeScore").textContent = "—";
      $("#awayScore").textContent = "—";
      status.textContent = "مؤجلة";
      status.classList.add("postponed");
    } else {
      $("#homeScore").textContent = "VS";
      $("#awayScore").textContent = "";
      status.textContent = isToday ? "مباراة اليوم" : "لم تبدأ";
    }
  }

  function renderTomorrow() {
    const item = getTomorrowContext();
    if (!item) {
      $("#tomorrowMatch").hidden = true;
      $("#tomorrowEmpty").hidden = false;
      $("#tomorrowMeta").textContent = tomorrowIso();
      return;
    }

    $("#tomorrowMatch").hidden = false;
    $("#tomorrowEmpty").hidden = true;
    $("#tomorrowHome").textContent = item.match.home;
    $("#tomorrowAway").textContent = item.match.away;
    $("#tomorrowMeta").textContent = `#${item.match.matchNo} — ${item.league.name}`;
  }

  function renderStandings(league) {
    $("#standingsTitle").textContent = league.name;
    const rows = calcStandings(league);

    $("#standingsBody").innerHTML = rows.map((r,i) => `<tr class="${i===0?"leader":""}">
      <td><span class="rank">${i+1}</span></td>
      <td>${r.team}</td>
      <td>${r.played}</td>
      <td>${r.won}</td>
      <td>${r.drawn}</td>
      <td>${r.lost}</td>
      <td>${r.gd > 0 ? "+"+r.gd : r.gd}</td>
      <td class="points">${r.points}</td>
    </tr>`).join("");
  }

  function aggregateDiscipline() {
    const map = new Map();

    for (const r of discipline || []) {
      const player = String(r.player || "").trim();
      const team = String(r.team || "").trim();
      if (!player || !team) continue;

      const key = team + "||" + player.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {player,team,yellow:0,red:0,suspension:0});
      }

      const row = map.get(key);
      if (r.cardType === "yellow") row.yellow++;
      if (r.cardType === "red") row.red++;
      row.suspension += Math.max(0, Number(r.remainingSuspension || 0));
    }

    return [...map.values()].sort((a,b) =>
      b.suspension-a.suspension ||
      b.red-a.red ||
      b.yellow-a.yellow ||
      a.player.localeCompare(b.player,"ar")
    );
  }

  function renderDiscipline() {
    const rows = aggregateDiscipline();
    $("#yellowTotal").textContent = (discipline || []).filter(r => r.cardType === "yellow").length;
    $("#redTotal").textContent = (discipline || []).filter(r => r.cardType === "red").length;

    const visible = rows.slice(0,6);
    $("#disciplineBody").innerHTML = visible.map(r => `<tr>
      <td>${r.player}</td>
      <td>${r.team}</td>
      <td>${r.yellow}</td>
      <td>${r.red}</td>
      <td class="${r.suspension>0?"suspended":""}">${r.suspension}</td>
    </tr>`).join("");

    $("#disciplineEmpty").style.display = rows.length ? "none" : "block";
    $("#disciplineBody").closest(".discipline-wrap").style.display = rows.length ? "block" : "none";
  }

  function renderRecentResults() {
    const completed = leagues
      .flatMap(league => league.fixtures.map(match => ({...match,leagueName:league.name})))
      .filter(m => m.status === "completed")
      .sort((a,b) => b.date.localeCompare(a.date) || b.matchNo-a.matchNo)
      .slice(0,4);

    $("#recentResults").innerHTML = completed.map(m => `<div class="result-row">
      <span class="team-name home">${m.home}</span>
      <span class="result-score">${m.homeScore} - ${m.awayScore}</span>
      <span class="team-name away">${m.away}</span>
    </div>`).join("");

    $("#noResults").style.display = completed.length ? "none" : "block";
  }

  function render() {
    applyResults();
    const context = getTodayContext();
    renderMainMatch(context);
    renderTomorrow();
    renderStandings(context?.league || leagues[0]);
    renderDiscipline();
    renderRecentResults();

    $("#lastUpdate").textContent = lastUpdated
      ? "آخر تحديث: " + new Intl.DateTimeFormat("ar-SA", {
          hour:"2-digit", minute:"2-digit", second:"2-digit"
        }).format(new Date(lastUpdated))
      : "آخر تحديث: —";
  }

  function setConnection(mode) {
    const el = $("#liveBadge");
    const text = el.querySelector("span");
    el.classList.remove("online","offline");

    if (mode === "online") {
      el.classList.add("online");
      text.textContent = "LIVE — متصل";
    } else if (mode === "offline") {
      el.classList.add("offline");
      text.textContent = "غير متصل";
    } else {
      text.textContent = "جاري الاتصال";
    }
  }

  async function loadState() {
    if (!apiBase) {
      setConnection("offline");
      render();
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(apiBase + "/state", {cache:"no-store",signal:controller.signal});
      clearTimeout(timeout);
      if (!res.ok) throw new Error("STATE");

      const payload = await res.json();
      results = payload.results || {};
      discipline = Array.isArray(payload.discipline) ? payload.discipline : [];
      lastUpdated = payload.updatedAt || new Date().toISOString();
      setConnection("online");
      render();
    } catch (err) {
      console.error(err);
      setConnection("offline");
    }
  }

  function startEvents() {
    if (!apiBase || !window.EventSource) return;

    try {
      source?.close();
      source = new EventSource(apiBase + "/events");
      source.addEventListener("ready", () => setConnection("online"));
      source.addEventListener("update", () => loadState());
      source.onerror = () => setConnection("connecting");
    } catch (err) {
      console.error(err);
    }
  }

  $("#fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  });

  formatClock();
  setInterval(formatClock, 1000);
  loadState().then(startEvents);
  setInterval(loadState, 10000);
})();