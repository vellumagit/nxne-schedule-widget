(function() {
  // ─── CONFIG ───────────────────────────────────
  const PROXY_URL = 'https://velluma.co/nxne-proxy.php';
  const POLL_MS   = 3 * 60 * 1000;
  const ARTIST_URL = 'https://www.nxne.com/2026-artists/';
  const MAPS_URL   = 'https://www.google.com/maps/d/embed?mid=12BzW8UyWMSzRxecnzOHiRROUgrjYBgg';

  // ─── HIDDEN ───────────────────────────────────
  // Exact artist name matches (case-insensitive)
  const HIDDEN_ARTISTS = [
    // MGK — top secret
    'mgk','machine gun kelly','billboard live - mgk','mgk?',
    // Loviet — not yet announced
    'loviet','loviet?',
    // bbno$
    'billboard the stage - bbno$ (direct)','billboard the stage - bbno$','bbno$',
    // MICO
    'billboard live - mico','mico','mico?',
    // Josh/Joss Ross
    'rolling stone future of music - joss ross','rolling stone future of music - josh ross',
    'rolling stone future of music - joss ross? (direct)','joss ross','josh ross',
    // Lee's Palace
    'turnstile','james blake',
    // Cameron House
    'brock mattsson',
    // Garrison
    'big wreck','big wreck?',
    // Rivoli
    'terra lightfoot','the trews','the trews?','julia wolf','julia wolf?',
    // Sneaky Dee's
    'dirty nil','dirty nil?',
    // W Hotel / Karri
    'karri','billboard live - karri','billboard live - karri (direct)',
  ];

  // Partial artist name matches — catches any variant containing these strings
  const HIDDEN_ARTIST_PARTIALS = [
    'mico','turnstile','james blake','dirty nil','the trews','julia wolf',
    'terra lightfoot','big wreck','brock mattsson','karri','spin showcase',
    'mgk','machine gun kelly',
    'loviet',
  ];

  // Venue name partials — hide ALL artists at these venues
  const HIDDEN_VENUES = ['union station','billy bishop','redwood theatre'];

  // ─── GENRES ───────────────────────────────────
  const APPROVED_GENRES = ['Afro','Alternative Rock','Blues','Country','Disco','Electronic','Folk','Funk','Heavy Rock','Hip-hop','Indie Folk','Indie Pop','Indie Rock','Jazz','Metal','Pop','Punk','R&B','Rap','Reggae','Rock','Shoegaze','Soul'];
  const GENRE_MAP = {'afro':'Afro','afro-soul':'Afro','afrobeats':'Afro','afrobeats/ afro-fusion':'Afro','afrobeat/ arabesque/ cumbia':'Afro','alternative rock':'Alternative Rock','alternative hip hop':'Hip-hop','alternative r&b':'R&B','art-rock':'Alternative Rock','blues':'Blues','country':'Country','americana':'Country','disco':'Disco','electronic':'Electronic','uk garage':'Electronic','trap':'Electronic','dubstep':'Electronic','bass house':'Electronic','folk':'Folk','indie-folk':'Indie Folk','indie folk':'Indie Folk','singer/songwriter':'Folk','spoken word':'Folk','funk':'Funk','heavy rock':'Heavy Rock','heavy alternative rock':'Heavy Rock','hip-hop':'Hip-hop','hip hop':'Hip-hop','rap':'Rap','alternative rap':'Rap','pop-rap':'Rap','indie pop':'Indie Pop','dream pop':'Indie Pop','synth pop':'Indie Pop','power pop':'Indie Pop','pop punk':'Punk','indie rock':'Indie Rock','math rock':'Indie Rock','garage rock':'Rock','retro rock':'Rock','jazz':'Jazz','neo-soul meets neo-jazz with hints of r&b':'Jazz','metal':'Metal','alternative metal':'Metal','horror metal':'Metal','metalcore':'Metal','post hardcore / metalcore / screamo':'Metal','pop':'Pop','latin urban':'Pop','reggaeton':'Reggae','punk':'Punk','noise-punk':'Punk','post-punk':'Punk','post hardcore':'Punk','post-hardcore':'Punk','hardcore':'Punk','r&b':'R&B','neo soul':'R&B','neo-soul':'R&B','reggae':'Reggae','island fusion':'Reggae','rock':'Rock','shoegaze':'Shoegaze','dream pop/shoegaze':'Shoegaze','soul':'Soul','noise rock':'Heavy Rock','noise':'Heavy Rock','harmony-driven':'Folk','farsi':null,'roots/ soul/ rock/ pop':'Rock'};

  function normalizeGenre(raw) {
    const key = (raw||'').toLowerCase().trim();
    if (GENRE_MAP.hasOwnProperty(key)) return GENRE_MAP[key];
    return APPROVED_GENRES.find(g => g.toLowerCase() === key) || null;
  }

  // ─── STATE ────────────────────────────────────
  let SCHEDULE=[], VENUES=[{key:'all',name:'All Venues',cap:'',color:'#e8341c'}], ALL_GENRES=[];
  let state={q:'',day:'all',venue:'all',genres:[]}, loaded=false;

  const DOT_COLORS=['#f5a623','#4ab8c1','#8b6fbf','#4caf7d','#e87d3e','#d4547a','#6b9fd4','#9fd46b','#d4a554','#e8341c','#7ec8c8','#c87e7e','#7ec87e','#c8c87e','#7e7ec8'];

  // ─── HELPERS ──────────────────────────────────
  function timeToNum(t) {
    if (!t||t==='TBA') return 999;
    const m=t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 999;
    let h=parseInt(m[1]),min=parseInt(m[2]);
    const pm=m[3].toUpperCase()==='PM';
    if (pm&&h!==12) h+=12; if (!pm&&h===12) h=0; if (h<6) h+=24;
    return h*60+min;
  }
  function dayKey(d) { const m={'jun 10':'jun10','june 10':'jun10','jun 11':'jun11','june 11':'jun11','jun 12':'jun12','june 12':'jun12','jun 13':'jun13','june 13':'jun13','jun 14':'jun14','june 14':'jun14'}; return m[(d||'').toLowerCase().trim()]||'jun10'; }
  function dayLabel(dk) { return {jun10:'Wednesday',jun11:'Thursday',jun12:'Friday',jun13:'Saturday',jun14:'Sunday'}[dk]||''; }
  function slugify(n) { return (n||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  function artistSlug(n) { return (n||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function hl(text,q) { if (!q||!text) return text; return text.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark style="background:#d94f2b;color:#e8e4c0;padding:0 2px">$1</mark>'); }

  // ─── CSS ──────────────────────────────────────
  const css = `
    #nxne-widget * { box-sizing:border-box; margin:0; padding:0; }
    #nxne-widget {
      font-family:'Barlow',sans-serif; font-weight:300;
      background:#000; color:#e8e4c0;
      --black:#000000; --cream:#e8e4c0; --red:#d94f2b;
      --muted:rgba(232,228,192,0.42); --border:rgba(232,228,192,0.13);
      --border-strong:rgba(232,228,192,0.28); --red-dim:rgba(217,79,43,0.15);
    }
    #nxne-widget .hero { padding:52px 40px 40px; border-bottom:1px solid rgba(232,228,192,0.13); }
    #nxne-widget .hero-eye { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:26px; letter-spacing:4px; text-transform:uppercase; color:rgba(232,228,192,0.42); margin-bottom:12px; display:flex; align-items:center; gap:10px; }
    #nxne-widget .hero-eye::before { content:''; display:inline-block; width:24px; height:1px; background:#d94f2b; }
    #nxne-widget .hero-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:clamp(48px,8vw,100px); line-height:0.88; text-transform:uppercase; letter-spacing:-1px; color:#e8e4c0; margin-bottom:20px; }
    #nxne-widget .hero-title em { color:#d94f2b; font-style:normal; }
    #nxne-widget .hero-sub { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:20px; letter-spacing:3px; text-transform:uppercase; color:rgba(232,228,192,0.42); border-top:1px solid rgba(232,228,192,0.13); padding-top:16px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    #nxne-widget .hero-sub span::after { content:'|'; margin-left:16px; opacity:0.3; }
    #nxne-widget .hero-sub span:last-child::after { display:none; }
    #nxne-widget .live-bar { display:flex; align-items:center; gap:8px; padding:14px 40px; background:rgba(217,79,43,0.15); border-bottom:1px solid rgba(217,79,43,0.25); font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:24px; letter-spacing:2px; text-transform:uppercase; color:#e8e4c0; }
    #nxne-widget .live-dot { width:7px; height:7px; border-radius:50%; background:#d94f2b; animation:nxne-pulse 2s ease-in-out infinite; flex-shrink:0; }
    @keyframes nxne-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
    #nxne-widget .how-to { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 40px; background:rgba(232,228,192,0.05); border-bottom:2px solid rgba(232,228,192,0.28); flex-wrap:wrap; }
    #nxne-widget .hero-announce { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:32px; letter-spacing:1px; color:#d94f2b; margin-top:14px; }
    #nxne-widget .how-to-text { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:22px; letter-spacing:1px; color:rgba(232,228,192,0.42); line-height:1.5; }
    #nxne-widget .how-to-line1 { margin-bottom:4px; font-size:24px; }
    #nxne-widget .how-to-text strong { color:#e8e4c0; font-weight:900; }
    #nxne-widget .reset-btn { background:#d94f2b; border:none; color:#e8e4c0; font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:9px 20px; cursor:pointer; }
    #nxne-widget .search-wrap { padding:20px 40px 0; }
    #nxne-widget .search-row { display:flex; align-items:center; gap:12px; background:rgba(232,228,192,0.05); border:1px solid rgba(232,228,192,0.28); padding:0 18px; }
    #nxne-widget .search-row:focus-within { border-color:#e8e4c0; }
    #nxne-widget .search-input { background:none; border:none; outline:none; color:#e8e4c0; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:16px; letter-spacing:1px; text-transform:uppercase; padding:15px 0; flex:1; }
    #nxne-widget .search-input::placeholder { color:rgba(232,228,192,0.42); }
    #nxne-widget .search-clear { background:none; border:none; color:rgba(232,228,192,0.42); cursor:pointer; font-size:20px; padding:0; line-height:1; display:none; }
    #nxne-widget .search-clear.vis { display:block; }
    #nxne-widget .pills-outer { border-bottom:2px solid rgba(232,228,192,0.28); margin-top:16px; }
    #nxne-widget .pills-row { display:flex; align-items:stretch; }
    #nxne-widget .pills-label { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:#e8e4c0; background:rgba(232,228,192,0.09); padding:16px 28px 16px 40px; white-space:nowrap; border-right:1px solid rgba(232,228,192,0.28); display:flex; align-items:center; gap:10px; min-width:200px; cursor:pointer; user-select:none; }
    #nxne-widget .pills-label::before { content:'▾'; font-size:18px; color:#d94f2b; transition:transform 0.25s; display:inline-block; }
    #nxne-widget .pills-label.open::before { transform:rotate(180deg); }
    #nxne-widget .genre-wrap { display:none; flex-wrap:wrap; flex:1; background:rgba(232,228,192,0.03); }
    #nxne-widget .genre-wrap.open { display:flex; }
    #nxne-widget .genre-col { display:flex; flex-direction:column; flex:1; min-width:200px; padding:8px 0; border-right:1px solid rgba(232,228,192,0.13); }
    #nxne-widget .genre-col:last-child { border-right:none; }
    #nxne-widget .pill { display:block; background:transparent; border:none; padding:9px 24px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:18px; color:#e8e4c0; cursor:pointer; text-align:left; width:100%; text-decoration:underline; text-underline-offset:3px; text-decoration-color:rgba(232,228,192,0.3); }
    #nxne-widget .pill.active { color:#d94f2b; text-decoration-color:#d94f2b; }
    #nxne-widget .results-bar { display:flex; align-items:center; justify-content:space-between; padding:11px 40px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; letter-spacing:2px; text-transform:uppercase; background:#e8e4c0; color:rgba(11,11,7,0.55); }
    #nxne-widget .results-bar strong { color:#000; font-weight:900; font-size:13px; }
    #nxne-widget .clear-all { background:none; border:1px solid rgba(11,11,7,0.25); color:rgba(11,11,7,0.6); font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; letter-spacing:2px; text-transform:uppercase; cursor:pointer; padding:5px 12px; display:none; }
    #nxne-widget .clear-all.vis { display:block; }
    #nxne-widget .day-tabs { display:flex; padding:0 40px; overflow-x:auto; scrollbar-width:none; background:#e8e4c0; border-bottom:2px solid #000; }
    #nxne-widget .day-tabs::-webkit-scrollbar { display:none; }
    #nxne-widget .day-tab { background:none; border:none; border-bottom:3px solid transparent; color:rgba(11,11,7,0.45); font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; letter-spacing:2px; text-transform:uppercase; padding:13px 20px; cursor:pointer; white-space:nowrap; margin-bottom:-2px; }
    #nxne-widget .day-tab.active { color:#000; border-bottom-color:#d94f2b; }
    #nxne-widget .layout { display:grid; grid-template-columns:240px 1fr; }
    #nxne-widget .sidebar { border-right:2px solid #000; background:#e8e4c0; }
    #nxne-widget .sidebar-label { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:rgba(11,11,7,0.45); padding:18px 22px 10px; border-bottom:1px solid rgba(11,11,7,0.1); }
    #nxne-widget .venue-item { display:flex; align-items:center; gap:10px; padding:10px 20px; cursor:pointer; border-left:3px solid transparent; border-bottom:1px solid rgba(11,11,7,0.07); }
    #nxne-widget .venue-item:hover { background:rgba(11,11,7,0.06); }
    #nxne-widget .venue-item.active { border-left-color:#d94f2b; background:rgba(11,11,7,0.08); }
    #nxne-widget .venue-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    #nxne-widget .venue-name { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:17px; text-transform:uppercase; color:#000; }
    #nxne-widget .venue-cap { font-size:11px; color:rgba(11,11,7,0.45); }
    #nxne-widget .schedule { background:#e8e4c0; }
    #nxne-widget .day-section { border-bottom:2px solid rgba(11,11,7,0.15); }
    #nxne-widget .day-label { display:flex; align-items:baseline; gap:14px; padding:20px 28px 16px; background:rgba(11,11,7,0.06); border-bottom:1px solid rgba(11,11,7,0.12); }
    #nxne-widget .day-name { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:28px; text-transform:uppercase; color:#000; }
    #nxne-widget .day-date { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; color:rgba(11,11,7,0.45); letter-spacing:2px; text-transform:uppercase; }
    #nxne-widget .slot { display:grid; grid-template-columns:80px 1fr auto; align-items:center; gap:14px; padding:16px 28px; border-bottom:1px solid rgba(11,11,7,0.08); }
    #nxne-widget .slot:hover { background:rgba(217,79,43,0.07); }
    #nxne-widget .slot-time { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:17px; color:rgba(11,11,7,0.45); text-transform:uppercase; }
    #nxne-widget .slot-artist { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:23px; text-transform:uppercase; color:#000; }
    #nxne-widget .slot-meta { font-family:'Barlow',sans-serif; font-size:14px; color:rgba(11,11,7,0.5); margin-top:3px; }
    #nxne-widget .slot-actions { display:flex; gap:6px; flex-shrink:0; }
    #nxne-widget .slot-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:none; border:1px solid; cursor:pointer; white-space:nowrap; }
    #nxne-widget .btn-artist { background:#000; border-color:#000; color:#e8e4c0; }
    #nxne-widget .btn-artist:hover { background:#d94f2b; border-color:#d94f2b; }
    #nxne-widget .btn-map { background:transparent; border-color:rgba(11,11,7,0.25); color:rgba(11,11,7,0.6); }
    #nxne-widget .btn-map:hover { background:#000; border-color:#000; color:#e8e4c0; }
    #nxne-widget .empty { padding:60px 28px; text-align:center; color:rgba(11,11,7,0.4); font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px; letter-spacing:2px; text-transform:uppercase; background:#e8e4c0; }
    #nxne-widget .empty strong { display:block; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:32px; color:rgba(11,11,7,0.12); letter-spacing:3px; margin-bottom:8px; }
    #nxne-widget .mobile-strip { display:none; }
    @media(max-width:680px){
      /* HERO — compact, no wrapping */
      #nxne-widget .hero { padding:20px 20px 16px; }
      #nxne-widget .hero-eye { font-size:10px; letter-spacing:1.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #nxne-widget .hero-announce { font-size:12px; margin-top:10px; }
      #nxne-widget .how-to-line1 { font-size:16px; }
      #nxne-widget .how-to-text { font-size:14px; }
      #nxne-widget .hero-title { font-size:clamp(36px,12vw,52px); margin-bottom:10px; line-height:0.9; }
      #nxne-widget .hero-sub { font-size:11px; letter-spacing:1px; gap:0; padding-top:10px; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; white-space:nowrap; }
      #nxne-widget .hero-sub::-webkit-scrollbar { display:none; }
      #nxne-widget .hero-sub span { flex-shrink:0; }
      #nxne-widget .hero-sub span::after { margin-left:8px; margin-right:8px; }

      /* LIVE BAR */
      #nxne-widget .live-bar { font-size:12px; padding:9px 20px; letter-spacing:1.5px; }

      /* HOW TO — stacked cleanly */
      #nxne-widget .how-to { padding:12px 20px; flex-direction:column; align-items:flex-start; gap:10px; }
      #nxne-widget .how-to-text { font-size:13px; line-height:1.6; }
      #nxne-widget .reset-btn { width:100%; text-align:center; padding:10px; font-size:12px; }

      /* SEARCH */
      #nxne-widget .search-wrap { padding:12px 20px 0; }
      #nxne-widget .search-input { font-size:14px; padding:12px 0; }

      /* GENRE DROPDOWN — full width */
      #nxne-widget .pills-outer { margin-top:12px; }
      #nxne-widget .pills-row { flex-direction:column; }
      #nxne-widget .pills-label { min-width:100%; border-right:none; border-bottom:1px solid rgba(232,228,192,0.28); font-size:13px; padding:12px 20px; }
      #nxne-widget .genre-wrap { flex-direction:column; }
      #nxne-widget .genre-col { min-width:100%; border-right:none; border-bottom:1px solid rgba(232,228,192,0.13); padding:4px 0; }
      #nxne-widget .genre-col:last-child { border-bottom:none; }
      #nxne-widget .pill { font-size:14px; padding:7px 20px; }

      /* RESULTS + TABS */
      #nxne-widget .results-bar { padding:9px 20px; font-size:11px; }
      #nxne-widget .day-tabs { padding:0 12px; }
      #nxne-widget .day-tab { font-size:11px; padding:10px 10px; letter-spacing:0.5px; }

      /* LAYOUT */
      #nxne-widget .layout { grid-template-columns:1fr; }
      #nxne-widget .sidebar { display:none; }

      /* VENUE STRIP */
      #nxne-widget .mobile-strip { display:flex; align-items:center; gap:6px; overflow-x:auto; scrollbar-width:none; padding:8px 20px; border-bottom:1px solid rgba(232,228,192,0.13); background:rgba(232,228,192,0.03); -webkit-overflow-scrolling:touch; }
      #nxne-widget .mobile-strip::-webkit-scrollbar { display:none; }
      #nxne-widget .mobile-pill { flex-shrink:0; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:rgba(232,228,192,0.42); background:transparent; border:1px solid rgba(232,228,192,0.28); padding:5px 12px; cursor:pointer; white-space:nowrap; }
      #nxne-widget .mobile-pill.active { background:#e8e4c0; color:#000; border-color:#e8e4c0; }

      /* DAY LABELS */
      #nxne-widget .day-label { padding:12px 20px 10px; }
      #nxne-widget .day-name { font-size:20px; }
      #nxne-widget .day-date { font-size:11px; }

      /* SLOTS */
      #nxne-widget .slot { grid-template-columns:54px 1fr; grid-template-rows:auto auto; padding:10px 20px; gap:10px; }
      #nxne-widget .slot-time { font-size:12px; }
      #nxne-widget .slot-artist { font-size:16px; }
      #nxne-widget .slot-meta { font-size:11px; margin-top:2px; }
      #nxne-widget .slot-actions { grid-column:2; margin-top:6px; flex-direction:row; gap:6px; }
      #nxne-widget .slot-btn { flex:1; justify-content:center; padding:6px 8px; font-size:10px; letter-spacing:1px; }

      /* MAP PANEL */
      #nxne-map-panel { width:100%; right:-100%; }
    }
    /* MAP PANEL */
    #nxne-map-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:99998; display:none; backdrop-filter:blur(2px); }
    #nxne-map-overlay.open { display:block; }
    #nxne-map-panel { position:fixed; top:0; right:-480px; width:460px; height:100vh; background:#000; border-left:2px solid #e8e4c0; z-index:99999; transition:right 0.3s ease; display:flex; flex-direction:column; padding-top:var(--nxne-nav-height, 80px); }
    #nxne-map-panel.open { right:0; }
    #nxne-map-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(232,228,192,0.13); flex-shrink:0; }
    #nxne-map-find { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(232,228,192,0.42); margin-bottom:3px; }
    #nxne-map-name { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; letter-spacing:1px; text-transform:uppercase; color:#e8e4c0; }
    #nxne-map-close { background:none; border:none; color:rgba(232,228,192,0.42); font-size:22px; cursor:pointer; padding:0; line-height:1; }
    #nxne-map-close:hover { color:#e8e4c0; }
    #nxne-map-footer { padding:14px 20px; border-bottom:1px solid rgba(232,228,192,0.13); flex-shrink:0; }
    #nxne-map-gmaps { display:inline-block; background:#d94f2b; color:#e8e4c0; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:14px; letter-spacing:2px; text-transform:uppercase; text-decoration:none; padding:10px 20px; }
    #nxne-map-frame-wrap { flex:1; position:relative; overflow:hidden; }
    #nxne-map-frame { position:absolute; top:0; left:0; width:100%; height:100%; border:none; }
    @media(max-width:680px){
      #nxne-map-panel { width:100%; right:-100%; }
    }
  `;

  // ─── INJECT FONTS + CSS ───────────────────────
  if (!document.getElementById('nxne-barlow')) {
    const link = document.createElement('link');
    link.id = 'nxne-barlow';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@300;400;500&display=swap';
    document.head.appendChild(link);
  }
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── INJECT HTML ──────────────────────────────
  const target = document.getElementById('nxne-schedule') || document.currentScript.parentElement;
  target.innerHTML = `
    <div id="nxne-widget">
      <div class="hero">
        <div class="hero-eye">North by Northeast Music Festival &amp; Conference</div>
        <div class="hero-title">2026 Festival<br><em>Schedule</em></div>
        <div class="hero-sub">
          <span>June 10 – 14</span><span>Toronto, Ontario</span><span>300+ Artists</span><span>30+ Venues</span>
        </div>
        <div class="hero-announce">Full list of announced artists — more to come!</div>
      </div>
      <div class="live-bar"><span class="live-dot"></span>Live schedule &nbsp;·&nbsp; Last sync: <span id="nxne-sync">—</span></div>
      <div class="how-to">
        <div class="how-to-text">
          <div class="how-to-line1"><strong>Search</strong> by artist, venue or genre</div>
          <div class="how-to-line2"><strong>Filter by day</strong> using the tabs &nbsp;·&nbsp; <strong>Filter by genre</strong> using the dropdown &nbsp;·&nbsp; <strong>Pick a venue</strong> from the sidebar</div>
        </div>
        <button class="reset-btn" onclick="nxneWidget.clearAll()">↺ Reset</button>
      </div>
      <div class="search-wrap">
        <div class="search-row">
          <span style="color:#e8e4c0">⚲</span>
          <input class="search-input" id="nxne-search" placeholder="Search artists, venues, genres…" oninput="nxneWidget.onSearch(this.value)">
          <button class="search-clear" id="nxne-clear" onclick="nxneWidget.clearSearch()">×</button>
        </div>
      </div>
      <div class="pills-outer">
        <div class="pills-row">
          <span class="pills-label" id="nxne-genre-toggle" onclick="nxneWidget.toggleGenre()">Filter by Genre</span>
          <div class="genre-wrap" id="nxne-genre-wrap">
            <div class="genre-col" id="nxne-col1"></div>
            <div class="genre-col" id="nxne-col2"></div>
          </div>
        </div>
      </div>
      <div class="results-bar">
        <span id="nxne-count"></span>
        <button class="clear-all" id="nxne-clear-all" onclick="nxneWidget.clearAll()">Clear filters</button>
      </div>
      <div class="day-tabs" id="nxne-tabs">
        <button class="day-tab active" data-day="all" onclick="nxneWidget.setDay('all',this)">All Days</button>
        <button class="day-tab" data-day="jun10" onclick="nxneWidget.setDay('jun10',this)">June 10 · Wed</button>
        <button class="day-tab" data-day="jun11" onclick="nxneWidget.setDay('jun11',this)">June 11 · Thu</button>
        <button class="day-tab" data-day="jun12" onclick="nxneWidget.setDay('jun12',this)">June 12 · Fri</button>
        <button class="day-tab" data-day="jun13" onclick="nxneWidget.setDay('jun13',this)">June 13 · Sat</button>
        <button class="day-tab" data-day="jun14" onclick="nxneWidget.setDay('jun14',this)">June 14 · Sun</button>
      </div>
      <div class="mobile-strip" id="nxne-mobile-strip"></div>
      <div class="layout">
        <aside class="sidebar"><div class="sidebar-label">Venues</div><div id="nxne-venues"></div></aside>
        <main class="schedule" id="nxne-main"></main>
      </div>
    </div>
    <div id="nxne-map-overlay" onclick="nxneWidget.closeMap()"></div>
    <div id="nxne-map-panel">
      <div id="nxne-map-header">
        <div>
          <div id="nxne-map-find">Find on map</div>
          <div id="nxne-map-name">Venue</div>
        </div>
        <button id="nxne-map-close" onclick="nxneWidget.closeMap()">&#215;</button>
      </div>
      <div id="nxne-map-footer">
        <a id="nxne-map-gmaps" href="#" target="_blank" rel="noopener">⚲ Open in Google Maps &#8599;</a>
      </div>
      <div id="nxne-map-frame-wrap">
        <iframe id="nxne-map-frame" src="" allowfullscreen loading="lazy"></iframe>
      </div>
    </div>
  `;

  // ─── FETCH ────────────────────────────────────
  async function fetchLive() {
    if (!loaded) document.getElementById('nxne-main').innerHTML = '<div class="empty"><strong>Loading</strong>Fetching schedule…</div>';
    try {
      const res = await fetch(PROXY_URL);
      if (!res.ok) throw new Error('HTTP '+res.status);
      processData(await res.json());
    } catch(e) {
      if (!loaded) document.getElementById('nxne-main').innerHTML = '<div class="empty"><strong>Unavailable</strong>Could not load schedule. Try refreshing.</div>';
    }
  }

  function processData(data) {
    SCHEDULE = (data.artists||[]).map(a => {
      const dk=dayKey(a.date);
      const genres=[...new Set((a.genres||'').split(',').map(g=>g.trim()).filter(Boolean).map(normalizeGenre).filter(Boolean))];
      return { day:dk, dayLabel:dayLabel(dk), dayDate:(a.date||'').replace('Jun ','June '), time:a.time||'TBA', timeNum:timeToNum(a.time), artist:(a.name||'').split('\n')[0].trim(), venue:a.venue||'', venueKey:slugify(a.venue), genres, tag:a.tag||'' };
    }).filter(s => {
      const al = s.artist.toLowerCase();
      const v  = s.venue.toLowerCase();
      // Exact artist match
      if (HIDDEN_ARTISTS.includes(al)) return false;
      // Partial artist match — catches variants
      if (HIDDEN_ARTIST_PARTIALS.some(p => al.includes(p))) return false;
      // Hide all artists at hidden venues
      if (HIDDEN_VENUES.some(h => v.includes(h))) return false;
      // W Hotel — hide karri and spin showcase
      if (v.includes('w hotel') && (al.includes('karri') || al.includes('spin') || s.artist.toLowerCase().includes('showcase'))) return false;
      // Hide anything with spin showcase in artist or venue name
      if (al.includes('spin') && al.includes('showcase')) return false;
      if (v.includes('spin') && v.includes('showcase')) return false;
      return true;
    });
    const seen=new Map();
    SCHEDULE.forEach(s=>{ if(s.venue&&!seen.has(s.venueKey)) seen.set(s.venueKey,s.venue); });
    const capMap={};
    (data.venues||[]).forEach(v=>{ const c=parseInt(v.capacity); if(!isNaN(c)&&c>0) capMap[slugify(v.name)]=c; });
    VENUES=[{key:'all',name:'All Venues',cap:seen.size+' venues',color:'#e8341c'}];
    let ci=0;
    seen.forEach((name,key)=>{ VENUES.push({key,name,cap:capMap[key]?'Cap. '+capMap[key]:'',color:DOT_COLORS[ci++%DOT_COLORS.length]}); });
    const used=new Set(SCHEDULE.flatMap(s=>s.genres));
    ALL_GENRES=APPROVED_GENRES.filter(g=>used.has(g));
    document.getElementById('nxne-sync').textContent=new Date(data.last_updated||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    loaded=true;
    buildSidebar(); buildGenrePills(); render();
  }

  function buildSidebar() {
    document.getElementById('nxne-venues').innerHTML=VENUES.map(v=>`<div class="venue-item${state.venue===v.key?' active':''}" onclick="nxneWidget.setVenue('${v.key}')"><span class="venue-dot" style="background:${v.color}"></span><div><div class="venue-name">${v.name}</div><div class="venue-cap">${v.cap}</div></div></div>`).join('');
    const strip=document.getElementById('nxne-mobile-strip');
    if(strip) strip.innerHTML=VENUES.map(v=>`<button class="mobile-pill${state.venue===v.key?' active':''}" onclick="nxneWidget.setVenue('${v.key}')">${v.key!=='all'?`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${v.color};margin-right:6px;vertical-align:middle"></span>`:''}${v.name}</button>`).join('');
  }

  function buildGenrePills() {
    const half=Math.ceil(ALL_GENRES.length/2);
    const make=g=>`<button class="pill${state.genres.includes(g)?' active':''}" onclick="nxneWidget.toggleGenrePill('${g.replace(/'/g,"\\'")}')"> ${g}</button>`;
    document.getElementById('nxne-col1').innerHTML=ALL_GENRES.slice(0,half).map(make).join('');
    document.getElementById('nxne-col2').innerHTML=ALL_GENRES.slice(half).map(make).join('');
  }

  function getFiltered() {
    const q=state.q.toLowerCase().trim();
    if(q) return SCHEDULE.filter(s=>[s.artist,s.venue,...s.genres].join(' ').toLowerCase().includes(q));
    return SCHEDULE.filter(s=>{
      if(state.day!=='all'&&s.day!==state.day) return false;
      if(state.venue!=='all'&&s.venueKey!==state.venue) return false;
      if(state.genres.length&&!state.genres.some(g=>s.genres.includes(g))) return false;
      return true;
    });
  }

  function render() {
    const filtered=getFiltered(), q=state.q.trim();
    const hasFilter=q||state.genres.length||state.venue!=='all'||state.day!=='all';
    document.getElementById('nxne-count').innerHTML=q?`<strong>${filtered.length}</strong> result${filtered.length!==1?'s':''} for "${q}"`:hasFilter?`Showing <strong>${filtered.length}</strong> show${filtered.length!==1?'s':''}` :`<strong>${SCHEDULE.length}</strong> shows across 5 nights`;
    document.getElementById('nxne-clear-all').classList.toggle('vis',hasFilter);
    document.getElementById('nxne-clear').classList.toggle('vis',!!q);
    if(!filtered.length){ document.getElementById('nxne-main').innerHTML='<div class="empty"><strong>No Results</strong>Try a different search or filter combination</div>'; return; }
    const byDay={},order=['jun10','jun11','jun12','jun13','jun14'];
    filtered.forEach(s=>{ if(!byDay[s.day]) byDay[s.day]={label:s.dayLabel,date:s.dayDate,slots:[]}; byDay[s.day].slots.push(s); });
    let html='';
    order.forEach(dk=>{
      if(!byDay[dk]) return;
      const {label,date,slots}=byDay[dk];
      html+=`<div class="day-section"><div class="day-label"><span class="day-name">${label}</span><span class="day-date">${date}</span></div><div>`;
      slots.sort((a,b)=>a.timeNum!==b.timeNum?a.timeNum-b.timeNum:a.artist.localeCompare(b.artist)).forEach((s,i)=>{
        const aSlug=artistSlug(s.artist), vSafe=s.venue.replace(/'/g,"\\'").replace(/"/g,'&quot;');
        html+=`<div class="slot" style="animation-delay:${i*0.02}s">
          <span class="slot-time">${s.time}</span>
          <div><div class="slot-artist">${hl(s.artist,q)}</div><div class="slot-meta">${hl(s.venue,q)}</div></div>
          <div class="slot-actions">
            <a class="slot-btn btn-artist" href="${ARTIST_URL}${aSlug}" target="_blank">♪ Artist</a>
            <button class="slot-btn btn-map" onclick="nxneWidget.openMap('${vSafe}')">● Map</button>
          </div>
        </div>`;
      });
      html+='</div></div>';
    });
    document.getElementById('nxne-main').innerHTML=html;
  }

  // ─── PUBLIC API ───────────────────────────────
  window.nxneWidget = {
    onSearch(v){ state.q=v; render(); },
    clearSearch(){ state.q=''; document.getElementById('nxne-search').value=''; render(); },
    setDay(d,btn){ state.day=d; document.querySelectorAll('#nxne-widget .day-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); render(); },
    setVenue(v){ state.venue=v; buildSidebar(); render(); },
    toggleGenrePill(g){ const i=state.genres.indexOf(g); i>-1?state.genres.splice(i,1):state.genres.push(g); buildGenrePills(); render(); },
    toggleGenre(){ document.getElementById('nxne-genre-toggle').classList.toggle('open'); document.getElementById('nxne-genre-wrap').classList.toggle('open'); },
    clearAll(){ state={q:'',day:'all',venue:'all',genres:[]}; document.getElementById('nxne-search').value=''; document.querySelectorAll('#nxne-widget .day-tab').forEach(b=>b.classList.remove('active')); document.querySelector('#nxne-widget [data-day="all"]').classList.add('active'); buildSidebar(); buildGenrePills(); render(); },
    openMap(venueName){
      document.getElementById('nxne-map-name').textContent=venueName;
      // Venue-specific embed — centers on that exact location
      const q = encodeURIComponent(venueName + ' Toronto ON');
      document.getElementById('nxne-map-frame').src='https://maps.google.com/maps?q='+q+'&output=embed&z=16';
      document.getElementById('nxne-map-gmaps').href='https://www.google.com/maps/search/'+q;
      document.getElementById('nxne-map-panel').classList.add('open');
      document.getElementById('nxne-map-overlay').classList.add('open');
      document.body.style.overflow='hidden';
    },
    closeMap(){
      document.getElementById('nxne-map-panel').classList.remove('open');
      document.getElementById('nxne-map-overlay').classList.remove('open');
      document.getElementById('nxne-map-frame').src='';
      document.body.style.overflow='';
    },
  };

  // Detect Squarespace nav height and offset map panel accordingly
  function setNavOffset() {
    const nav = document.querySelector('header') || document.querySelector('.header-nav') || document.querySelector('[data-controller="header"]') || document.querySelector('nav');
    const h = nav ? nav.offsetHeight : 80;
    document.documentElement.style.setProperty('--nxne-nav-height', h + 'px');
  }
  setNavOffset();
  window.addEventListener('resize', setNavOffset);

  fetchLive();
  setInterval(fetchLive, POLL_MS);
  document.addEventListener('keydown', e => { if(e.key==='Escape') window.nxneWidget.closeMap(); });
})();
