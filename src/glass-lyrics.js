// NAME: Glass Lyrics
// AUTHOR: dunzeyka (https://github.com/dunzeyka)
// DESCRIPTION: Полноэкранный текст песни в стиле Apple Music: размытая обложка на фоне, плавная прокрутка, заливка слов.
// VERSION: 0.2.1

(function GlassLyrics() {
  const Spicetify = window.Spicetify;
  if (
    !Spicetify?.Player?.addEventListener ||
    !Spicetify?.Platform?.History ||
    !Spicetify?.CosmosAsync ||
    !Spicetify?.Playbar?.Button
  ) {
    setTimeout(GlassLyrics, 300);
    return;
  }

  // ───────────────────────── Настройки ─────────────────────────
  const CONFIG = {
    replaceNativeLyrics: true, // открывать наш экран вместо родного текста Spotify
    anchor: 0.3, // на какой высоте (доля) держать активную строку
    leadMs: 120, // насколько раньше подсвечивать строку
    fillEndGapMs: 200, // заливка заканчивается за столько мс до начала следующей строки
    maxFillMs: 5000, // но не дольше 5 с: если артист допел раньше, строка не «доползает» в тишине
    minGapMs: 3000, // проигрыш длиннее этого показывается точками
    manualScrollMs: 3000, // сколько ждать после ручной прокрутки
    useLrclibFallback: true, // если у Spotify нет текста — искать на lrclib.net
    // Размытие строк по расстоянию от текущей (в долях размера шрифта: 0.05 ≈ 2.7px при шрифте 54px).
    // Уже соседние строки заметно размыты, как в Apple Music, а дальше размытие растёт плавнее.
    blur: [0, 0.05, 0.065, 0.078, 0.088, 0.095, 0.1],
  };

  // ───────────────────────── Иконки ─────────────────────────
  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5.5" y="4" width="4.6" height="16" rx="1.3"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.3"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 6.3v11.4a.8.8 0 0 0 1.2.7l8.8-5.3v4.6a.8.8 0 0 0 1.2.7l9.3-5.7a.8.8 0 0 0 0-1.4l-9.3-5.7a.8.8 0 0 0-1.2.7v4.6L2.7 5.6a.8.8 0 0 0-1.2.7z"/></svg>',
    exitFullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    volHigh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L7 8.5H4a1 1 0 0 0-1 1z"/><path d="M16 8.6a5 5 0 0 1 0 6.8M18.8 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volLow: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L7 8.5H4a1 1 0 0 0-1 1z"/><path d="M16 8.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volMute: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L7 8.5H4a1 1 0 0 0-1 1z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  };

  // ───────────────────────── Стили ─────────────────────────
  const CSS = `
@property --p { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --hi { syntax: '<number>'; inherits: true; initial-value: 1; }

#aml-root {
  position: fixed; inset: 0; z-index: 9999;
  color: #fff; background: #0d0d0f; overflow: hidden;
  font-family: "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none; -webkit-user-select: none; /* двойной клик не выделяет текст и обложку */
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity .45s ease, visibility 0s linear .45s;
}
#aml-root.aml-open { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .45s ease; }
#aml-root.aml-idle, #aml-root.aml-idle * { cursor: none !important; }
#aml-root img { -webkit-user-drag: none; pointer-events: none; }
#aml-root ::selection { background: transparent; }

/* Фон: размытые, медленно вращающиеся копии обложки */
.aml-bg { position: absolute; inset: 0; overflow: hidden; }
.aml-bg-inner {
  position: absolute; left: 50%; top: 50%; width: 42vmax; height: 42vmax;
  transform: translate(-50%, -50%) scale(3.2);
  filter: blur(22px) saturate(1.9) brightness(.72);
}
.aml-bg-inner img {
  position: absolute; width: 62%; height: 62%; object-fit: cover; border-radius: 50%;
  animation: aml-spin 46s linear infinite;
}
.aml-bg-inner .b1 { left: 0; top: 0; }
.aml-bg-inner .b2 { right: 0; top: 4%; animation-duration: 60s; animation-direction: reverse; }
.aml-bg-inner .b3 { left: 8%; bottom: 0; animation-duration: 52s; animation-direction: reverse; }
.aml-bg-inner .b4 { right: 4%; bottom: 6%; width: 50%; height: 50%; animation-duration: 38s; }
#aml-root:not(.aml-open) .aml-bg-inner img { animation-play-state: paused; }
.aml-bg-shade { position: absolute; inset: 0; background: radial-gradient(120% 100% at 30% 50%, rgba(0,0,0,.05), rgba(0,0,0,.42)); }
@keyframes aml-spin { to { transform: rotate(360deg); } }

/* Кнопки сверху */
.aml-btn { appearance: none; border: 0; background: none; color: inherit; padding: 0; margin: 0; cursor: pointer; display: grid; place-items: center; }
/* Полоса сверху, за которую можно таскать окно; кнопки сдвинуты левее системных (свернуть/развернуть/закрыть) */
.aml-drag-region { position: absolute; top: 0; left: 0; right: 0; height: 64px; z-index: 2; -webkit-app-region: drag; }
.aml-top { position: absolute; top: 13px; right: 156px; z-index: 3; display: flex; gap: 10px; transition: opacity .4s; -webkit-app-region: no-drag; }
#aml-root.aml-fs-on .aml-drag-region { display: none; }
/* Наши кнопки всегда левее зоны системных кнопок окна: даже спрятанные, они продолжают ловить клики
   (клик в зону «свернуть» сворачивал окно). */
.aml-top .aml-btn { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.12); backdrop-filter: blur(20px); color: rgba(255,255,255,.85); transition: background .2s, transform .2s; }
.aml-top .aml-btn:hover { background: rgba(255,255,255,.22); }
.aml-top .aml-btn:active { transform: scale(.92); }
.aml-top svg { width: 18px; height: 18px; }
#aml-root.aml-idle .aml-top { opacity: 0; }

/* Раскладка */
.aml-layout { position: relative; z-index: 1; height: 100%; display: grid; grid-template-columns: minmax(300px, 42%) 1fr; gap: 4vw; padding: 0 5vw 0 6vw; }
.aml-left { display: flex; flex-direction: column; justify-content: center; align-items: center; min-width: 0; }
.aml-col { width: min(30vw, 56vh); display: flex; flex-direction: column; gap: 18px; }
.aml-cover {
  width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: rgba(255,255,255,.08);
  box-shadow: 0 28px 70px rgba(0,0,0,.45);
  transition: transform .6s cubic-bezier(.2,.9,.25,1.15), box-shadow .6s;
}
#aml-root:not(.aml-playing) .aml-cover { transform: scale(.88); box-shadow: 0 14px 34px rgba(0,0,0,.35); }
.aml-meta { margin-top: 10px; min-width: 0; }
.aml-title, .aml-artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aml-title { font-size: 20px; font-weight: 650; }
.aml-artist { font-size: 18px; color: rgba(255,255,255,.6); margin-top: 2px; }
.aml-link { cursor: pointer; text-underline-offset: 3px; }
.aml-link:hover { text-decoration: underline; }
.aml-artist .aml-link:hover { color: rgba(255,255,255,.85); }

.aml-bar { position: relative; height: 6px; border-radius: 3px; background: rgba(255,255,255,.22); overflow: hidden; cursor: pointer; transition: height .2s; }
.aml-bar:hover, .aml-bar.aml-drag { height: 10px; }
.aml-progress { display: flex; flex-direction: column; justify-content: center; min-height: 10px; }
.aml-fill { position: absolute; inset: 0; background: rgba(255,255,255,.82); transform-origin: left; transform: scaleX(0); }
.aml-times { display: flex; justify-content: space-between; margin-top: 7px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }

.aml-controls { display: flex; justify-content: center; align-items: center; gap: 46px; margin-top: 4px; }
.aml-controls .aml-btn { color: rgba(255,255,255,.92); transition: transform .15s, opacity .2s; }
.aml-controls .aml-btn:hover { opacity: .8; }
.aml-controls .aml-btn:active { transform: scale(.88); }
.aml-controls svg { width: 34px; height: 34px; }
.aml-controls .aml-play svg { width: 44px; height: 44px; }
.aml-controls .aml-prev svg { transform: scaleX(-1); }

/* Громкость: иконка по центру под кнопками, при наведении вправо выезжает ползунок */
.aml-volume-row { position: relative; height: 36px; }
.aml-vol { position: absolute; top: 0; left: 50%; transform: translateX(-18px); display: flex; align-items: center; height: 36px; }
.aml-vol-icon { width: 36px; height: 36px; color: rgba(255,255,255,.7); transition: color .2s, transform .15s; }
.aml-vol-icon:hover { color: #fff; }
.aml-vol-icon:active { transform: scale(.9); }
.aml-vol-icon svg { width: 22px; height: 22px; }
.aml-vol-track { width: 0; height: 36px; display: flex; align-items: center; overflow: hidden; opacity: 0; transition: width .35s cubic-bezier(.22,1,.36,1), opacity .25s; }
.aml-vol:hover .aml-vol-track, .aml-vol.aml-drag .aml-vol-track { width: 156px; opacity: 1; }
.aml-vol-bar { position: relative; flex: none; width: 140px; height: 6px; margin-left: 8px; border-radius: 3px; background: rgba(255,255,255,.22); overflow: hidden; cursor: pointer; transition: height .2s; }
.aml-vol-bar:hover, .aml-vol.aml-drag .aml-vol-bar { height: 10px; }
.aml-vol-fill { position: absolute; inset: 0; background: rgba(255,255,255,.82); transform-origin: left; transform: scaleX(0); }

/* Текст */
.aml-right {
  position: relative; height: 100%; overflow: hidden; min-width: 0;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 82%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 82%, transparent 100%);
}
.aml-lyrics { position: relative; padding: 0 3vw 60vh 0; }
.aml-line {
  padding: .3em 0; will-change: transform;
  transition: transform .75s cubic-bezier(.22,1,.36,1);
  font-size: clamp(28px, 3vw, 54px);
}
#aml-root.aml-manual .aml-line { transition-duration: .3s; transition-delay: 0s !important; }
.aml-line-inner {
  display: inline-block; padding: .14em .4em; border-radius: .3em;
  font-weight: 700; line-height: 1.2; letter-spacing: -.02em;
  transform-origin: left center; transform: scale(.97);
  filter: blur(calc(var(--b, 0) * 1em)); /* --b задаётся из CONFIG.blur по расстоянию до текущей строки */
  transition: transform .6s cubic-bezier(.22,1,.36,1), filter .5s, background-color .2s;
}
.aml-active .aml-line-inner { transform: scale(1); }
#aml-root.aml-manual .aml-line-inner { filter: none; }
.aml-synced .aml-line-inner { cursor: pointer; }
.aml-synced .aml-line-inner:hover { background-color: rgba(255,255,255,.09); }

.aml-word {
  --p: 0;
  display: inline-block; padding: .08em 0 .14em; margin: -.08em 0 -.14em;
  color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(90deg,
    rgba(255,255,255,var(--hi)) 0%, rgba(255,255,255,var(--hi)) calc(var(--p) * 130% - 30%),
    rgba(255,255,255,.34) calc(var(--p) * 130%), rgba(255,255,255,.34) 100%);
  transform: translateY(calc(var(--p) * -0.05em));
}
/* Когда строка перестаёт быть активной, заливка целиком плавно гаснет до цвета остального текста
   (--hi от 1 до .34), а не убегает назад внутри каждого слова */
.aml-line { --hi: 1; transition: transform .75s cubic-bezier(.22,1,.36,1), --hi .7s ease; }
.aml-line:not(.aml-active) { --hi: .34; }
.aml-line:not(.aml-active) .aml-word { transition: transform .6s ease; }
.aml-unsynced .aml-word { background: none; color: rgba(255,255,255,.88); transform: none; }
.aml-unsynced .aml-line-inner { filter: none; transform: none; }
.aml-right.aml-scrollable { overflow-y: auto; }
.aml-right.aml-scrollable::-webkit-scrollbar { display: none; }

/* Проигрыш: три точки */
.aml-gap { padding: 0; }
.aml-gap .aml-line-inner { display: flex; align-items: center; gap: .26em; height: 0; opacity: 0; transition: height .45s ease, opacity .35s ease, transform .6s; }
.aml-gap.aml-active { padding: .3em 0; }
.aml-gap.aml-active .aml-line-inner { height: .9em; opacity: 1; animation: aml-breathe 2.6s ease-in-out infinite; }
.aml-dot { --p: 0; width: .34em; height: .34em; border-radius: 50%; background: #fff; opacity: calc(.28 + var(--p) * .72); transition: opacity .2s; }
@keyframes aml-breathe { 50% { transform: scale(1.12); } }

.aml-status {
  position: absolute; inset: 0; display: none; align-items: center; padding-right: 3vw;
  font-size: clamp(22px, 2.2vw, 36px); font-weight: 700; color: rgba(255,255,255,.45);
}
.aml-status.aml-show { display: flex; }

@media (max-width: 900px) {
  .aml-layout { grid-template-columns: 1fr; padding: 0 7vw; }
  .aml-left { display: none; }
}
`;

  // ───────────────────────── DOM ─────────────────────────
  const style = document.createElement("style");
  style.id = "aml-style";
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "aml-root";
  root.innerHTML = `
    <div class="aml-bg"><div class="aml-bg-inner">
      <img class="b1" alt=""><img class="b2" alt=""><img class="b3" alt=""><img class="b4" alt="">
    </div><div class="aml-bg-shade"></div></div>
    <div class="aml-drag-region"></div>
    <div class="aml-top">
      <button class="aml-btn aml-fs" title="Во весь экран">${ICON.fullscreen}</button>
      <button class="aml-btn aml-close" title="Закрыть (Esc)">${ICON.close}</button>
    </div>
    <div class="aml-layout">
      <section class="aml-left"><div class="aml-col">
        <img class="aml-cover" alt="">
        <div class="aml-meta"><div class="aml-title"></div><div class="aml-artist"></div></div>
        <div class="aml-progress">
          <div class="aml-bar"><div class="aml-fill"></div></div>
          <div class="aml-times"><span class="aml-cur">0:00</span><span class="aml-rem">-0:00</span></div>
        </div>
        <div class="aml-controls">
          <button class="aml-btn aml-prev" title="Назад">${ICON.next}</button>
          <button class="aml-btn aml-play" title="Пауза">${ICON.pause}</button>
          <button class="aml-btn aml-next" title="Далее">${ICON.next}</button>
        </div>
        <div class="aml-volume-row">
          <div class="aml-vol">
            <button class="aml-btn aml-vol-icon" title="Выключить звук">${ICON.volHigh}</button>
            <div class="aml-vol-track"><div class="aml-vol-bar"><div class="aml-vol-fill"></div></div></div>
          </div>
        </div>
      </div></section>
      <section class="aml-right"><div class="aml-lyrics"></div><div class="aml-status"></div></section>
    </div>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const el = {
    bgImgs: [...root.querySelectorAll(".aml-bg-inner img")],
    cover: $(".aml-cover"),
    title: $(".aml-title"),
    artist: $(".aml-artist"),
    bar: $(".aml-bar"),
    fill: $(".aml-fill"),
    cur: $(".aml-cur"),
    rem: $(".aml-rem"),
    play: $(".aml-play"),
    right: $(".aml-right"),
    lyrics: $(".aml-lyrics"),
    status: $(".aml-status"),
  };

  // ───────────────────────── Состояние ─────────────────────────
  const S = {
    open: false,
    fromRoute: false,
    suppressRouteUntil: 0,
    lyricsUri: null,
    token: 0,
    synced: false,
    lines: [],
    active: -2,
    baseY: 0,
    manualY: null,
    manualUntil: 0,
    dragging: false,
    dragRatio: 0,
    lastSec: -1,
    raf: 0,
  };

  const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const currentItem = () => Spicetify.Player.data?.item ?? Spicetify.Player.data?.track ?? null;
  const imgUrl = (u) => (!u ? "" : u.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + u.slice(14) : u);
  const seek = (ms) => Spicetify.Player.seek(ms <= 1 ? 0 : Math.round(ms)); // seek(≤1) трактуется как доля

  // ───────────────────────── Загрузка текста ─────────────────────────
  async function fetchSpotify(id) {
    const res = await Spicetify.CosmosAsync.get(
      `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`
    );
    const l = res?.lyrics;
    if (!l?.lines?.length) return null;
    return {
      synced: l.syncType !== "UNSYNCED",
      lines: l.lines.map((x) => ({ start: Number(x.startTimeMs) || 0, text: (x.words || "").trim() })),
    };
  }

  function parseLrc(text) {
    const out = [];
    for (const row of text.split(/\r?\n/)) {
      const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!stamps.length) continue;
      const words = row.replace(/\[[^\]]*\]/g, "").trim();
      for (const t of stamps) out.push({ start: Math.round((Number(t[1]) * 60 + Number(t[2])) * 1000), text: words });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  async function fetchLrclib(item) {
    const m = item?.metadata || {};
    if (!m.title || !m.artist_name) return null;
    const durMs = Number(item?.duration?.milliseconds ?? m.duration) || Spicetify.Player.getDuration();
    const q = new URLSearchParams({
      track_name: m.title,
      artist_name: m.artist_name,
      album_name: m.album_title || "",
      duration: String(Math.round(durMs / 1000)),
    });
    const r = await fetch(`https://lrclib.net/api/get?${q}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.syncedLyrics) return { synced: true, lines: parseLrc(j.syncedLyrics) };
    if (j.plainLyrics) return { synced: false, lines: j.plainLyrics.split(/\r?\n/).map((t) => ({ start: 0, text: t.trim() })) };
    return null;
  }

  async function loadLyrics() {
    const item = currentItem();
    const uri = item?.uri;
    if (!uri || uri === S.lyricsUri) return;
    S.lyricsUri = uri;
    const token = ++S.token;

    setLines(null);
    setStatus("Загружаю текст…");

    let res = null;
    const id = uri.startsWith("spotify:track:") ? uri.split(":")[2] : null;
    if (id) {
      try { res = await fetchSpotify(id); } catch (e) { console.warn("[Glass Lyrics] Spotify:", e); }
    }
    if (!res && CONFIG.useLrclibFallback) {
      try { res = await fetchLrclib(item); } catch (e) { console.warn("[Glass Lyrics] LRCLIB:", e); }
    }
    if (token !== S.token) return; // трек уже сменился

    if (!res || !res.lines.some((l) => l.text)) {
      setStatus("Текст для этого трека не найден");
      return;
    }
    setStatus(null);
    setLines(res);
  }

  function prepare(res) {
    const dur = Spicetify.Player.getDuration() || 0;
    let lines = res.lines.map((l) => ({ start: l.start, text: l.text === "♪" ? "" : l.text }));
    if (!res.synced) return lines.map((l) => ({ ...l, gap: false }));

    lines.forEach((l) => (l.gap = !l.text));
    if (lines.length && !lines[0].gap && lines[0].start > CONFIG.minGapMs) lines.unshift({ start: 0, text: "", gap: true });

    const withEnds = (arr) =>
      arr.forEach((l, i) => (l.end = i + 1 < arr.length ? arr[i + 1].start : Math.max(dur, l.start + 5000)));
    withEnds(lines);
    lines = lines.filter((l) => !l.gap || l.end - l.start >= CONFIG.minGapMs); // короткие паузы не показываем
    lines = lines.filter((l, i, a) => !(l.gap && a[i - 1]?.gap)); // склеиваем подряд идущие
    withEnds(lines);
    return lines;
  }

  function setLines(res) {
    el.lyrics.textContent = "";
    el.right.scrollTop = 0;
    S.lines = res ? prepare(res) : [];
    S.synced = !!res?.synced;
    S.active = -2;
    S.manualY = null;
    el.lyrics.classList.toggle("aml-synced", S.synced);
    el.lyrics.classList.toggle("aml-unsynced", !!res && !S.synced);
    el.right.classList.toggle("aml-scrollable", !!res && !S.synced);

    for (const ln of S.lines) {
      const line = document.createElement("div");
      line.className = "aml-line";
      const inner = document.createElement("div");
      inner.className = "aml-line-inner";
      line.appendChild(inner);

      if (ln.gap) {
        line.classList.add("aml-gap");
        ln.dots = [0, 1, 2].map(() => {
          const d = document.createElement("span");
          d.className = "aml-dot";
          inner.appendChild(d);
          return { el: d, p: -1 };
        });
      } else {
        const tokens = ln.text.split(/(\s+)/).filter(Boolean);
        const total = tokens.reduce((a, t) => a + (/^\s+$/.test(t) ? 0 : t.length), 0) || 1;
        let acc = 0;
        ln.words = [];
        for (const t of tokens) {
          if (/^\s+$/.test(t)) { inner.appendChild(document.createTextNode(" ")); continue; }
          const w = document.createElement("span");
          w.className = "aml-word";
          w.textContent = t;
          inner.appendChild(w);
          ln.words.push({ el: w, from: acc / total, to: (acc + t.length) / total, p: -1 });
          acc += t.length;
        }
        // Заливка растягивается на всё время до следующей строки, а не зависит от длины текста:
        // короткая строка, которую поют долго, заполняется так же медленно, как её поют.
        if (S.synced) ln.sung = clamp(ln.end - ln.start - CONFIG.fillEndGapMs, 400, CONFIG.maxFillMs);
      }

      if (S.synced) {
        inner.addEventListener("click", () => {
          S.manualUntil = 0;
          seek(ln.start);
        });
      }
      ln.el = line;
      el.lyrics.appendChild(line);
    }
    if (S.synced) requestAnimationFrame(() => scrollToActive(false));
  }

  function setStatus(text) {
    el.status.textContent = text || "";
    el.status.classList.toggle("aml-show", !!text);
  }

  // ───────────────────────── Подсветка и прокрутка ─────────────────────────
  function setP(o, p) {
    const v = Math.round(p * 1000) / 1000;
    if (o.p !== v) {
      o.p = v;
      o.el.style.setProperty("--p", v);
    }
  }

  function paint(ln, pos) {
    if (ln.gap) {
      const f = clamp((pos - ln.start) / (ln.end - ln.start));
      ln.dots.forEach((d, i) => setP(d, clamp(f * 3 - i)));
      return;
    }
    const f = clamp((pos - ln.start) / ln.sung);
    for (const w of ln.words) setP(w, clamp((f - w.from) / (w.to - w.from)));
  }

  function setActive(idx) {
    const prev = S.lines[S.active];
    if (prev) {
      // Сбрасываем заливку только после того, как строка погасла, иначе будет видно, как она убегает назад
      const prevIdx = S.active;
      setTimeout(() => {
        if (S.active !== prevIdx && S.lines[prevIdx] === prev) (prev.words || prev.dots).forEach((w) => setP(w, 0));
      }, 750);
    }
    S.active = idx;
    const ref = Math.max(idx, 0);
    S.lines.forEach((l, i) => {
      l.el.classList.toggle("aml-active", i === idx);
      const d = Math.abs(i - ref);
      l.el.style.setProperty("--b", CONFIG.blur[Math.min(d, CONFIG.blur.length - 1)]);
    });
    scrollToActive(true);
    setTimeout(() => scrollToActive(false), 460); // после схлопывания точек проигрыша
  }

  function applyY(y, stagger) {
    const a = Math.max(S.active, 0);
    S.lines.forEach((l, i) => {
      l.el.style.transitionDelay = stagger ? `${clamp(i - a + 1, 0, 10) * 45}ms` : "0ms";
      l.el.style.transform = `translate3d(0, ${y}px, 0)`;
    });
  }

  function scrollToActive(stagger) {
    if (!S.synced || !S.lines.length || S.manualUntil > Date.now()) return;
    const ref = S.lines[Math.max(S.active, 0)].el;
    S.baseY = el.right.clientHeight * CONFIG.anchor - ref.offsetTop;
    applyY(S.baseY, stagger);
  }

  el.right.addEventListener(
    "wheel",
    (e) => {
      if (!S.synced || !S.lines.length) return;
      e.preventDefault();
      S.manualUntil = Date.now() + CONFIG.manualScrollMs;
      root.classList.add("aml-manual");
      const last = S.lines[S.lines.length - 1].el;
      const minY = el.right.clientHeight * 0.4 - last.offsetTop;
      const maxY = el.right.clientHeight * 0.4;
      S.manualY = clamp((S.manualY ?? S.baseY) - e.deltaY, minY, maxY);
      applyY(S.manualY, false);
    },
    { passive: false }
  );

  // ───────────────────────── Плеер ─────────────────────────
  // Переход на страницу артиста или альбома: закрываем экран текста и открываем страницу в Spotify
  function goTo(uri) {
    const [, type, id] = (uri || "").split(":");
    if (!id || !["artist", "album"].includes(type)) return;
    S.fromRoute = false; // не делать «назад» при закрытии, иначе он перебьёт переход
    close();
    Spicetify.Platform.History.push(`/${type}/${id}`);
  }

  function getArtists(item) {
    if (Array.isArray(item?.artists) && item.artists.length) return item.artists.map((a) => ({ name: a.name, uri: a.uri }));
    const m = item?.metadata || {};
    const out = [];
    for (let i = 0; ; i++) {
      const sfx = i ? `:${i}` : "";
      if (!m["artist_name" + sfx]) break;
      out.push({ name: m["artist_name" + sfx], uri: m["artist_uri" + sfx] });
    }
    return out;
  }

  function updateMeta() {
    const item = currentItem();
    const m = item?.metadata || {};
    el.title.textContent = m.title || item?.name || "";
    const albumUri = item?.album?.uri || m.album_uri;
    el.title.dataset.uri = albumUri?.startsWith("spotify:album:") ? albumUri : "";
    el.title.classList.toggle("aml-link", !!el.title.dataset.uri);
    el.title.title = el.title.dataset.uri ? `Открыть альбом «${item?.album?.name || m.album_title || ""}»` : "";

    el.artist.textContent = "";
    getArtists(item).forEach((a, i) => {
      if (i) el.artist.append(", ");
      const span = document.createElement("span");
      span.textContent = a.name;
      if (a.uri?.startsWith("spotify:artist:")) {
        span.className = "aml-link";
        span.addEventListener("click", () => goTo(a.uri));
      }
      el.artist.appendChild(span);
    });
    const img = imgUrl(m.image_xlarge_url || m.image_large_url || m.image_url);
    if (img && el.cover.getAttribute("src") !== img) {
      el.cover.src = img;
      el.bgImgs.forEach((b) => (b.src = img));
    }
  }

  function updatePlaying() {
    const playing = Spicetify.Player.isPlaying();
    root.classList.toggle("aml-playing", playing);
    el.play.innerHTML = playing ? ICON.pause : ICON.play;
    el.play.title = playing ? "Пауза" : "Играть";
  }

  function updateProgress(pos, dur) {
    const ratio = S.dragging ? S.dragRatio : dur ? clamp(pos / dur) : 0;
    el.fill.style.transform = `scaleX(${ratio})`;
    const shown = S.dragging ? ratio * dur : pos;
    const sec = Math.floor(shown / 1000);
    if (sec !== S.lastSec) {
      S.lastSec = sec;
      el.cur.textContent = fmt(shown);
      el.rem.textContent = "-" + fmt(dur - shown);
    }
  }

  // ───────────────────────── Громкость ─────────────────────────
  const vol = {
    root: $(".aml-vol"),
    icon: $(".aml-vol-icon"),
    bar: $(".aml-vol-bar"),
    fill: $(".aml-vol-fill"),
    dragging: false,
    lastKey: "",
  };

  function renderVolume(v, muted) {
    const level = muted ? 0 : clamp(v);
    const key = `${level.toFixed(3)}|${muted}`;
    if (key === vol.lastKey) return;
    vol.lastKey = key;
    vol.fill.style.transform = `scaleX(${level})`;
    const icon = level === 0 ? "volMute" : level < 0.5 ? "volLow" : "volHigh";
    if (vol.icon.dataset.icon !== icon) {
      vol.icon.dataset.icon = icon;
      vol.icon.innerHTML = ICON[icon];
    }
    vol.icon.title = level === 0 ? "Включить звук" : "Выключить звук";
  }

  function updateVolume() {
    if (vol.dragging) return;
    renderVolume(Spicetify.Player.getVolume(), !!Spicetify.Player.getMute?.());
  }

  function setVolume(v) {
    v = clamp(v);
    if (v > 0 && Spicetify.Player.getMute?.()) Spicetify.Player.toggleMute();
    Spicetify.Player.setVolume(v);
    renderVolume(v, false);
  }

  const volRatioAt = (e) => {
    const r = vol.bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  vol.bar.addEventListener("pointerdown", (e) => {
    vol.dragging = true;
    vol.root.classList.add("aml-drag");
    vol.bar.setPointerCapture(e.pointerId);
    setVolume(volRatioAt(e));
  });
  vol.bar.addEventListener("pointermove", (e) => {
    if (vol.dragging) setVolume(volRatioAt(e));
  });
  const endVolDrag = () => {
    vol.dragging = false;
    vol.root.classList.remove("aml-drag");
  };
  vol.bar.addEventListener("pointerup", endVolDrag);
  vol.bar.addEventListener("pointercancel", endVolDrag);
  vol.icon.addEventListener("click", () => {
    Spicetify.Player.toggleMute();
    vol.lastKey = "";
  });
  vol.root.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setVolume(Spicetify.Player.getVolume() - Math.sign(e.deltaY) * 0.05);
    },
    { passive: false }
  );

  function tick() {
    if (!S.open) return;
    const pos = Spicetify.Player.getProgress();
    const dur = Spicetify.Player.getDuration();
    updateProgress(pos, dur);
    updateVolume();

    if (S.manualUntil && Date.now() > S.manualUntil) {
      S.manualUntil = 0;
      S.manualY = null;
      root.classList.remove("aml-manual");
      scrollToActive(true);
    }

    if (S.synced && S.lines.length) {
      const t = pos + CONFIG.leadMs;
      let idx = -1;
      for (let i = 0; i < S.lines.length; i++) {
        if (S.lines[i].start <= t) idx = i;
        else break;
      }
      if (idx !== S.active) setActive(idx);
      if (idx >= 0) paint(S.lines[idx], t);
    }
    S.raf = requestAnimationFrame(tick);
  }

  // Перемотка по полосе прогресса
  const ratioAt = (e) => {
    const r = el.bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  el.bar.addEventListener("pointerdown", (e) => {
    S.dragging = true;
    S.dragRatio = ratioAt(e);
    el.bar.classList.add("aml-drag");
    el.bar.setPointerCapture(e.pointerId);
  });
  el.bar.addEventListener("pointermove", (e) => {
    if (S.dragging) S.dragRatio = ratioAt(e);
  });
  el.bar.addEventListener("pointerup", (e) => {
    if (!S.dragging) return;
    S.dragging = false;
    el.bar.classList.remove("aml-drag");
    seek(ratioAt(e) * Spicetify.Player.getDuration());
  });

  $(".aml-prev").addEventListener("click", () => Spicetify.Player.back());
  $(".aml-next").addEventListener("click", () => Spicetify.Player.next());
  el.play.addEventListener("click", () => Spicetify.Player.togglePlay());
  el.title.addEventListener("click", () => goTo(el.title.dataset.uri));
  $(".aml-close").addEventListener("click", () => close());
  // Полноэкранный режим: разворачиваем на весь экран сам наш экран (как это делает Spotify со своими панелями),
  // а не весь документ, и проверяем состояние через fullscreenElement с запасным webkit-вариантом.
  const fsBtn = $(".aml-fs");
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function exitFs() {
    if (!isFs()) return;
    const p = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    p?.catch?.(() => {});
  }
  function toggleFs() {
    if (isFs()) exitFs();
    else root.requestFullscreen({ navigationUI: "hide" }).catch((e) => console.warn("[Glass Lyrics] fullscreen:", e));
  }
  fsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFs();
  });
  document.addEventListener("fullscreenchange", () => {
    const on = isFs();
    root.classList.toggle("aml-fs-on", on);
    fsBtn.innerHTML = on ? ICON.exitFullscreen : ICON.fullscreen;
    fsBtn.title = on ? "Выйти из полноэкранного режима" : "Во весь экран";
    // Кнопки при выходе из полноэкранного режима возвращает не JS-код Spotify, а нативная часть окна,
    // причём в момент, когда окно меняет размер. Поэтому прячем их сразу и потом всю первую секунду:
    // на каждом изменении размера окна и по таймеру.
    if (S.open) {
      S.hideButtonsUntil = Date.now() + 1200;
      setWindowButtons(false);
      [16, 50, 100, 180, 300, 500, 800, 1100].forEach((ms) => setTimeout(() => S.open && setWindowButtons(false), ms));
    }
  });
  window.addEventListener("resize", () => {
    if (S.open && Date.now() < (S.hideButtonsUntil || 0)) setWindowButtons(false);
  });

  // Прячем курсор и кнопки, если мышь не двигается
  let idleTimer = 0;
  root.addEventListener("mousemove", () => {
    root.classList.remove("aml-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.add("aml-idle"), 2500);
  });

  // ───────────────────────── Системные кнопки окна ─────────────────────────
  // В Spotify есть внутренний метод setWindowButtonsVisibility, он прячет кнопки «свернуть / развернуть / закрыть».
  // Ищем объект с этим методом среди Spicetify.Platform, потому что имя свойства может меняться от версии к версии.
  const winButtonsApi = (() => {
    for (const key of Object.keys(Spicetify.Platform)) {
      const v = Spicetify.Platform[key];
      if (v && typeof v.setWindowButtonsVisibility === "function") return v;
    }
    return null;
  })();
  // Spotify сам показывает кнопки, например при выходе из полноэкранного режима, причём через свою ссылку на API.
  // Поэтому перехватываем вызов уровнем ниже, в прототипе клиента: все пути идут через него.
  // Пока наш экран открыт, «показать» превращается в «спрятать».
  const uiClient = winButtonsApi?._updateUiClient;
  const uiProto = uiClient && Object.getPrototypeOf(uiClient);
  let rawSetButtons = null;
  if (uiProto && typeof uiProto.setButtonsVisibility === "function") {
    const orig = uiProto.setButtonsVisibility;
    rawSetButtons = (show) => orig.call(uiClient, { showButtons: show });
    uiProto.setButtonsVisibility = function (req, ...rest) {
      if (S.open && req?.showButtons) req = { ...req, showButtons: false };
      return orig.call(this, req, ...rest);
    };
  }

  function setWindowButtons(show) {
    try {
      const p = rawSetButtons ? rawSetButtons(show) : winButtonsApi?.setWindowButtonsVisibility(show);
      p?.catch?.((e) => console.warn("[Glass Lyrics] window buttons:", e));
    } catch (e) {
      console.warn("[Glass Lyrics] window buttons:", e);
    }
  }
  window.addEventListener("beforeunload", () => setWindowButtons(true));

  // ───────────────────────── Открытие / закрытие ─────────────────────────
  function open(fromRoute = false) {
    if (S.open) return;
    S.open = true;
    S.fromRoute = fromRoute;
    setWindowButtons(false);
    updateMeta();
    updatePlaying();
    root.classList.add("aml-open");
    button.active = true;
    loadLyrics();
    requestAnimationFrame(() => scrollToActive(false));
    S.raf = requestAnimationFrame(tick);
  }

  function close() {
    if (!S.open) return;
    S.open = false;
    cancelAnimationFrame(S.raf);
    root.classList.remove("aml-open", "aml-idle");
    button.active = false;
    setWindowButtons(true);
    exitFs();
    const History = Spicetify.Platform.History;
    if (S.fromRoute && History.location?.pathname === "/lyrics") {
      S.suppressRouteUntil = Date.now() + 1000;
      History.goBack();
    }
    S.fromRoute = false;
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (S.open && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (isFs()) exitFs(); // первый Esc выходит из полноэкранного режима, второй закрывает экран
        else close();
      }
    },
    true
  );

  window.addEventListener("resize", () => S.open && scrollToActive(false));

  Spicetify.Player.addEventListener("songchange", () => {
    updateMeta();
    if (S.open) loadLyrics();
  });
  Spicetify.Player.addEventListener("onplaypause", updatePlaying);

  // Своя контурная иконка 16×16 в стиле остальных кнопок Spotify. Встроенная "lyrics" рисуется
  // Spicetify с обводкой поверх заливки и выглядит жирнее соседей.
  const PLAYBAR_ICON =
    '<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M3 2.25h10A1.75 1.75 0 0 1 14.75 4v6A1.75 1.75 0 0 1 13 11.75H8.5L5 14.25v-2.5H3A1.75 1.75 0 0 1 1.25 10V4A1.75 1.75 0 0 1 3 2.25z"/>' +
    '<path d="M4.75 5.5h6.5M4.75 8.25h4"/></svg>';

  const button = new Spicetify.Playbar.Button(
    "Glass Lyrics",
    PLAYBAR_ICON,
    () => (S.open ? close() : open()),
    false,
    false
  );
  button.register();

  if (CONFIG.replaceNativeLyrics) {
    const onRoute = (arg) => {
      const loc = arg?.location ?? arg;
      if (loc?.pathname === "/lyrics" && !S.open && Date.now() > S.suppressRouteUntil) open(true);
    };
    Spicetify.Platform.History.listen(onRoute);
    onRoute(Spicetify.Platform.History.location);
  }

  window.GlassLyrics = { open, close, config: CONFIG };
})();
