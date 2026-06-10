var SCRIPT_URL='https://script.google.com/macros/s/AKfycbyeCMHtk4box-1rKwTt4UKF5UlpsyGWB2QISs522KkoQvJ3XzhjvvQ8wcOWU3bYJ7dc/exec';
try{localStorage.setItem('teamtracker_script_url', SCRIPT_URL);}catch(e){}
function applyPositionClasses(){
  document.querySelectorAll('[data-position],[data-pos]').forEach(el=>{
    const p=(el.dataset.position||el.dataset.pos||'').toLowerCase();

    el.classList.remove('pos-Trainee','pos-Solo','pos-Leader','pos-Core','pos-Junior','pos-JuniorPartner');

    if(p.includes('trainee')) el.classList.add('pos-Trainee');
    else if(p.includes('solo')) el.classList.add('pos-Solo');
    else if(p.includes('leader')) el.classList.add('pos-Leader');
    else if(p.includes('core')) el.classList.add('pos-Core');
    else if(p.includes('junior')) el.classList.add('pos-Junior');
  });
}

setTimeout(applyPositionClasses,200);
document.addEventListener('DOMContentLoaded',()=>setTimeout(applyPositionClasses,400));




const POSITIONS=['Trainee','Solo','Leader','Core','Junior Partner +'];
var FLAGS=[{id:'Conversation',label:'Needs conversation',color:'#f97316'},{id:'AtRisk',label:'At risk',color:'#dc2626'},{id:'DoingWell',label:'Doing well',color:'#16a34a'},{id:'Watch',label:'Keep an eye',color:'#0d6b61'}];
const CAT_NAMES={personal:'Personal',work:'Work',team:'Pink',reminder:'Yellow',admin:'Purple',orange:'Orange',rose:'Rose',cyan:'Cyan'};
const PC={Trainee:{f:'#e6f7f0',s:'#40b890',t:'#2a9470'},Solo:{f:'#fef3e0',s:'#e09020',t:'#c87810'},Leader:{f:'#e6eef8',s:'#5888d8',t:'#3060c0'},Core:{f:'#ede8f8',s:'#9070c8',t:'#6848b0'},'Junior Partner +':{f:'#fde8ee',s:'#e06888',t:'#c84870'},Manager:{f:'#e6f4f2',s:'#2aaa98',t:'#0f766e'},default:{f:'#f2f4f6',s:'#8898b0',t:'#4a5870'}};
const PCD={Trainee:{f:'#082818',s:'#40b890',t:'#90e8c8'},Solo:{f:'#281800',s:'#e09020',t:'#f8d080'},Leader:{f:'#081428',s:'#5888d8',t:'#a0c0f0'},Core:{f:'#180828',s:'#9070c8',t:'#c8b0f0'},'Junior Partner +':{f:'#280810',s:'#e06888',t:'#f0b0c8'},Manager:{f:'#001818',s:'#2aaa98',t:'#80d8c8'},default:{f:'#181E28',s:'#7088A8',t:'#B0C0D8'}};

// ── Theme ──────────────────────────────────────────────
function initTheme(){const s=localStorage.getItem('tt_theme')||'light';document.documentElement.setAttribute('data-theme',s);document.getElementById('theme-lbl').textContent=s==='dark'?'Light mode':'Dark mode';}
function toggleTheme(){const c=document.documentElement.getAttribute('data-theme'),n=c==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('tt_theme',n);document.getElementById('theme-lbl').textContent=n==='dark'?'Light mode':'Dark mode';renderEdges();}
initTheme();
function isDark(){return document.documentElement.getAttribute('data-theme')==='dark';}
function pc(pos){const m=isDark()?PCD:PC;return m[pos]||m.default;}

// ── Helpers ────────────────────────────────────────────
function getWeekKey(d){const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1));return fmtDate(dt);}
function fmtDate(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${day}`;}
function parseDate(s){if(!s||typeof s!=='string')return null;const p=s.split('-');if(p.length!==3)return null;const d=new Date(+p[0],+p[1]-1,+p[2]);return isNaN(d)?null:d;}
function formatWeek(k){const d=parseDate(k);if(!d)return'—';const e=new Date(d);e.setDate(e.getDate()+6);const f=dt=>dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});return`w/c ${f(d)} – ${f(e)}`;}
function fmtReportDate(k){
  if(!k||typeof k!=='string'||k==='—')return'—';
  const raw=k.trim().split('T')[0];
  const p=raw.split('-');
  if(p.length!==3)return k;
  const yr=parseInt(p[0],10),mo=parseInt(p[1],10),dy=parseInt(p[2],10);
  if(isNaN(yr)||isNaN(mo)||isNaN(dy)||mo<1||mo>12||dy<1||dy>31)return k;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sfx=dy===1||dy===21||dy===31?'st':dy===2||dy===22?'nd':dy===3||dy===23?'rd':'th';
  return dy+sfx+' '+months[mo-1]+' '+yr;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

const params=new URLSearchParams(window.location.search);
var rawName=params.get('name')||'';
var managerName=rawName.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
const weekKey=getWeekKey(new Date());

// ── Guest / share-link mode ────────────────────────────
const guestMode = params.get('plannerGuest')==='1';
const guestGroupKey = (()=>{ try{ const g=params.get('gk'); return g?atob(g):null; }catch(e){return null;} })();
const guestToken = params.get('gt')||'';

// ── LOGIN ──────────────────────────────────────────────
async function doLogin(){
  const input=document.getElementById('login-pw');
  const pw=input.value.trim();
  const err=document.getElementById('login-err');
  const btn=document.getElementById('login-btn');
  err.classList.remove('show');err.textContent='';
  if(!pw){err.textContent='Please enter a password.';err.classList.add('show');input.focus();return;}
  if(!managerName){err.textContent='URL missing manager name. Add ?name=yourname';err.classList.add('show');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Checking…';input.disabled=true;
  try{
    const res=await api({action:'checkPassword',manager:managerName,password:pw});
    if(res&&res.ok){
      // Store a signed token returned by the server (falls back to flag if server doesn't return one yet)
      const tokenKey='tt_mgr_token_'+managerName;
      sessionStorage.setItem(tokenKey, res.token||'authed');
      btn.innerHTML='<span class="spinner"></span>Loading…';showApp();return;
    }
    // FIX 2: clear no-password message
    if(res&&res.noPassword){
      err.textContent='No password has been set for your account. Please ask your admin to set one.';
    } else {
      err.textContent=(res&&(res.message||res.error))||'Incorrect password.';
    }
    err.classList.add('show');input.value='';input.focus();
  }catch(e){err.textContent='Login failed: '+(e&&e.message?e.message:'check Script URL is deployed correctly.');err.classList.add('show');}
  finally{btn.disabled=false;btn.textContent='Sign in';input.disabled=false;}
}
document.getElementById('login-btn').addEventListener('click',doLogin);
document.getElementById('login-pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
function checkAuth(){
  const tokenKey='tt_mgr_token_'+managerName;
  const stored=sessionStorage.getItem(tokenKey);
  if(!stored)return;
  if(!SCRIPT_URL)return;
  api({action:'checkToken',manager:managerName,token:stored})
    .then(res=>{
      if(res&&res.ok){showApp();}
      else{
        // Server explicitly rejected the token — clear it
        sessionStorage.removeItem(tokenKey);
      }
    })
    .catch(()=>{
      // Network error (mobile blip, no connection) — keep the token so the
      // manager can retry login without having to re-enter their password
    });
}

function showApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-shell').style.display='flex';
  // Show skeleton loading state in home grid while data fetches
  const hg=document.getElementById('home-grid');
  if(hg)hg.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
    <div class="hg-row hg-stats">${[1,2,3,4].map(()=>`<div style="height:96px;border-radius:10px;background:var(--surface2);animation:pulse 1.4s ease-in-out infinite;"></div>`).join('')}</div>
    <div style="height:220px;border-radius:10px;background:var(--surface2);animation:pulse 1.4s ease-in-out infinite;"></div>
    <div style="height:180px;border-radius:10px;background:var(--surface2);animation:pulse 1.4s ease-in-out infinite;"></div>
  </div>`;
  const dn=rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1);
  // Avatar initial
  const av=document.getElementById('sb-avatar');
  if(av)av.textContent=dn.charAt(0);
  // Topbar profile name
  const tbName=document.getElementById('tb-name');
  if(tbName)tbName.textContent=dn;
  // Today's date in topbar
  const dateEl=document.getElementById('topbar-date');
  if(dateEl)dateEl.textContent=formatTodayDate();
  ['week-pill','week-pill2','week-pill-mob'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=formatWeek(weekKey);});
  document.title=`${dn} · The Back Office`;
  loadAll();
}

function handleProfilePic(input){
  const file=input.files[0];if(!file)return;
  if(file.size>2*1024*1024){showToast('Image too large — max 2MB','error');return;}
  const reader=new FileReader();
  reader.onload=async e=>{
    const picData=e.target.result;
    const imgHtml=`<img src="${picData}" alt="profile" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
    // Show preview immediately in topbar avatar + profile tab big avatar
    const av=document.getElementById('sb-avatar');
    if(av)av.innerHTML=imgHtml;
    const bigAv=document.getElementById('profile-big-avatar');
    if(bigAv)bigAv.innerHTML=imgHtml;
    try{
      const res=await api({action:'saveProfilePic',manager:managerName,picData});
      if(res&&res.picUrl){
        const stableHtml=`<img src="${res.picUrl}" alt="profile" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
        av.innerHTML=stableHtml;
        if(bigAv)bigAv.innerHTML=stableHtml;
      }
      showToast('Profile picture updated ✓','success');
    }catch(err){showToast('Picture saved locally — sheet sync failed','error');}
  };
  reader.readAsDataURL(file);
}


function posKey(pos){
  const p=String(pos||'').toLowerCase().replace(/[^a-z]/g,'');
  if(p.includes('trainee'))return 'Trainee';
  if(p.includes('solo'))return 'Solo';
  if(p.includes('leader'))return 'Leader';
  if(p.includes('core'))return 'Core';
  if(p.includes('junior'))return 'Junior';
  return '';
}
function posClass(pos){
  const k=posKey(pos);
  return k?`pos-colour-${k}`:'';
}
/* Returns inline style for an avatar — position colour if known, white if not */
function avStyle(name,pos){
  const palette=[
    {bg:'#a7ffdb',color:'#007a4d'},
    {bg:'#b3d4ff',color:'#1140cc'},
    {bg:'#d4b8ff',color:'#5b1fd6'},
    {bg:'#ffe0a0',color:'#b85c00'},
    {bg:'#ffb8cc',color:'#c4002e'},
  ];
  const posMap={Trainee:0,Solo:3,Leader:1,Core:2,Junior:4};
  const k=posKey(pos);
  if(k&&posMap[k]!==undefined){
    const c=palette[posMap[k]];
    return`background:${c.bg};color:${c.color};border:none;`;
  }
  return'background:#ffffff;color:#6b7d8a;border:none;box-shadow:none;';
}

// ── State ──────────────────────────────────────────────
let roster=[],weekLeavers=new Set(),allReports=[],weekSubmitted=false,calEvents=[],announcement=null,notes='',lastWeekCount=0,ackDone=false,savedReviews=[],allPayData=[],managerNotifs=[];
let wireByWeekGlobal=null;
let _dashResizeTimer=null;
let _myProfile=null,_myClients=[];

async function loadAll(){
  const unwrap=r=>r.status==='fulfilled'?r.value:{};

  // ── Phase 1: critical data for home dashboard (render immediately on arrival) ──
  try{
    const phase1=await Promise.allSettled([
      api({action:'getRoster',manager:managerName}),           // 0
      api({action:'getSubmission',manager:managerName,week:weekKey}), // 1
      api({action:'getAnnouncement'}),                         // 2
      api({action:'getNotifications',manager:managerName}),    // 3
      api({action:'getPayData',manager:managerName}),          // 4
      api({action:'getLastWeekCount',manager:managerName,currentWeek:weekKey}) // 5
    ]);
    phase1.forEach((r,i)=>{if(r.status==='rejected')console.warn('loadAll phase1',i,'failed:',r.reason);});
    const[rRes,sRes,annRes,notifRes,pdRes,prevRes]=phase1.map(unwrap);
    if(rRes.roster)roster=rRes.roster;
    if(sRes.rows&&sRes.rows.length){
      weekSubmitted=true;
      document.getElementById('banner-done').style.display='block';
      weekLeavers=new Set(sRes.rows.filter(r=>r.leaver).map(r=>{const m=roster.find(x=>x.name&&r.name&&x.name.toLowerCase()===r.name.toLowerCase());return m?m.id:null;}).filter(Boolean));
    }
    if(sRes.acked)ackDone=true;
    if(annRes.announcement)announcement=annRes.announcement;
    if(notifRes.notifications)managerNotifs=notifRes.notifications;
    if(pdRes.payData)allPayData=pdRes.payData;
    if(prevRes.count!==undefined)lastWeekCount=prevRes.count;
    updateNotifBadge();
    renderHome();renderReps();renderWeekly();

    // ── Phase 2: secondary data (reports, cal, map, profile, reviews, clients) ──
    const phase2=await Promise.allSettled([
      api({action:'getReports',manager:managerName}),          // 0
      api({action:'getCalEvents',manager:managerName}),        // 1
      api({action:'loadMap',manager:managerName}),             // 2
      api({action:'getNotes',manager:managerName}),            // 3
      api({action:'getProfilePic',manager:managerName}),       // 4
      api({action:'getManagerReviews',manager:managerName}),   // 5
      api({action:'getManagerProfile',manager:managerName}),   // 6
      api({action:'getClients'})                               // 7
    ]);
    phase2.forEach((r,i)=>{if(r.status==='rejected')console.warn('loadAll phase2',i,'failed:',r.reason);});
    const[rpRes,calRes,mRes,notesRes,picRes,revRes,profRes,clRes]=phase2.map(unwrap);
    if(rpRes.reports)allReports=rpRes.reports;
    if(calRes.events)calEvents=calRes.events;
    if(mRes.mapData){try{const d=JSON.parse(mRes.mapData);sp.nodes=d.nodes||[];sp.edges=d.edges||[];}catch(e){}}
    if(notesRes.notes!==undefined)notes=notesRes.notes||'';
    if(picRes.picUrl){
      const av=document.getElementById('sb-avatar');
      const dn=rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1);
      av.innerHTML=`<img src="${picRes.picUrl}" alt="${dn}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
    }
    if(revRes.reviews)savedReviews=revRes.reviews;
    _myProfile=(profRes&&profRes.profile!==undefined)?profRes.profile:(_myProfile||{});
    _myClients=(clRes&&Array.isArray(clRes.clients))?clRes.clients:_myClients;
    renderReports();renderCalendar();refreshAddLeaderDropdown();
    // Re-render home so the chart gets allReports data, and update sidebar profile
    renderHome();
    updateSidebarProfile();
  }catch(e){console.error('loadAll fatal:',e);renderAll();}
}

function renderAll(){
  roster.forEach(r=>{if(r.managerNotes&&r.managerNotes.length)repNotes[r.id]=r.managerNotes;});
  renderHome();renderReps();renderWeekly();renderReports();renderCalendar();refreshAddLeaderDropdown();
  updateSidebarProfile();
  // If profile tab is already open, re-render it with the freshly loaded data
  if(document.getElementById('ptab-profile')?.classList.contains('active')) profileRender();
}
function getMgrDisplay(){return rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1);}

function updateSidebarProfile(){
  if(!_myProfile) return;
  // Update topbar role subtitle from first campaign or generic label
  const roleEl = document.getElementById('tb-role');
  if(roleEl){
    const assignedIds = _myProfile.campaigns || [];
    const firstClient = (_myClients||[]).find(c=>assignedIds.includes(c.id));
    roleEl.textContent = firstClient ? firstClient.campaign+' Manager' : 'Field Manager';
  }
}

// Format today as "14th Aug 2023"
function formatTodayDate(){
  const d=new Date();
  const day=d.getDate();
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sfx=day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th';
  return`${day}${sfx} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── HOME ──────────────────────────────────────────────
var SVG={
  users:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/><path d="M4 17a7 7 0 0 1 12 0" stroke-linecap="round"/></svg>',
  warning:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3L2 17h16L10 3z" stroke-linejoin="round"/><path d="M10 9v4M10 15h.01" stroke-linecap="round"/></svg>',
  check:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7"/><path d="M7 10l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2" stroke-linecap="round"/></svg>',
  chart:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="3" height="6" rx="1"/><rect x="8.5" y="7" width="3" height="10" rx="1"/><rect x="14" y="3" width="3" height="14" rx="1"/></svg>',
  calendar:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="14" height="13" rx="2"/><path d="M3 9h14M7 3v4M13 3v4" stroke-linecap="round"/></svg>',
  doc:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 3v5h5M7 10h6M7 13h4" stroke-linecap="round"/></svg>',
  link:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 7l4-4M13 3h-3M13 3v3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3" stroke-linecap="round"/></svg>',
  arrow_up:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V4M4 8l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow_dn:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 4v8M4 8l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dash:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8h8" stroke-linecap="round"/></svg>',
  pound:'<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 5a4 4 0 0 0-7 2.5V11H4M4 14h12M6 11h6" stroke-linecap="round"/></svg>',
  pay:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M14 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM2 9h16" stroke-linecap="round"/></svg>',
  cal:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="14" height="13" rx="2"/><path d="M3 9h14M7 3v4M13 3v4" stroke-linecap="round"/></svg>',
  chev:'<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reps:'<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="7" r="3"/><circle cx="14" cy="7" r="3"/><path d="M1 17a6 6 0 0 1 10 0M9 17a6 6 0 0 1 10 0" stroke-linecap="round"/></svg>',
  pin:'<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 2C7.8 2 6 3.8 6 6c0 3.5 4 9 4 9s4-5.5 4-9c0-2.2-1.8-4-4-4z" stroke-linejoin="round"/><circle cx="10" cy="6" r="1.5"/></svg>',
  pinned:'<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2l-8 8 1 4-4 4 4-4 4 1 8-8-5-5zM10 10l-2-2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  inbox:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 13l2-7h12l2 7v3H2v-3z" stroke-linejoin="round"/><path d="M2 13h4l1.5 2h5L14 13h4" stroke-linecap="round"/></svg>',
  lock:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="12" height="9" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3" stroke-linecap="round"/></svg>',
  pencil:'<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2l4 4-10 10H4v-4L14 2z" stroke-linejoin="round"/></svg>',
  note:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="12" height="15" rx="2"/><path d="M7 8h6M7 11h4" stroke-linecap="round"/></svg>',
  building:'<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="14" height="15" rx="1"/><path d="M8 18V11h4v7M7 7h2M11 7h2M7 10h2M11 10h2" stroke-linecap="round"/></svg>',
  image:'<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="16" height="13" rx="2"/><circle cx="7" cy="9" r="1.5"/><path d="M2 14l4-4 3 3 2-2 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  moon:'<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 12a7 7 0 1 1-9-9 5.5 5.5 0 0 0 9 9z" stroke-linejoin="round"/></svg>',
  sun:'<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M4.6 15.4l1.4-1.4M14 6l1.4-1.4" stroke-linecap="round"/></svg>',
  camera:'<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="16" height="12" rx="2"/><circle cx="10" cy="12" r="3"/><path d="M7 6l1-3h4l1 3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star:'<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.3l-4.8 2.5.9-5.3L2.2 7.7l5.4-.8L10 2z"/></svg>',
  task:'<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  quote:'<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M4 8c0-2.2 1.8-4 4-4v2a2 2 0 0 0-2 2v1h2v5H4V8zm8 0c0-2.2 1.8-4 4-4v2a2 2 0 0 0-2 2v1h2v5h-4V8z"/></svg>',
};

const CAT_COLORS={personal:'#2563ff',work:'#22c55e',team:'#ec4899',reminder:'#f59e0b',admin:'#7c3aed',orange:'#f97316',rose:'#f43f5e',cyan:'#06b6d4'};

function renderHome(){
  const annSlot=document.getElementById('announcement-slot');
  if(announcement&&!localStorage.getItem('tt_ann_dismissed_'+announcement.id)){
    annSlot.innerHTML=`<div style="background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:20px;color:#fff;box-shadow:0 4px 16px rgba(15,118,110,.25);">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" style="flex-shrink:0;opacity:.9"><path d="M10 2l8 15H2L10 2z" stroke-linejoin="round"/><path d="M10 9v4M10 15h.01" stroke-linecap="round"/></svg>
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;margin-bottom:1px;">${esc(announcement.title)}</div><div style="font-size:12px;opacity:.88;">${esc(announcement.message)}</div></div>
      <button onclick="dismissAnn('${announcement.id}')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:26px;height:26px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto;">&#x2715;</button>
    </div>`;
  }else annSlot.innerHTML='';

  if(!weekSubmitted)document.getElementById('weekly-badge').style.display='';
  else document.getElementById('weekly-badge').style.display='none';
  syncWeeklyDot();

  const active=roster.filter(r=>!r.leaver);
  const leavers=roster.filter(r=>r.leaver);
  const flagged=roster.filter(r=>r.flag&&!r.leaver);
  const delta=active.length-lastWeekCount;

  const payReports=allReports.filter(r=>r.type==='Pay Report').sort((a,b)=>b.week.localeCompare(a.week));
  const latestPay=payReports[0]||null;
  const isThisWeekPay=latestPay&&(()=>{const rep=parseDate(latestPay.week);const mon=parseDate(weekKey);if(!rep||!mon)return false;const sun=new Date(mon);sun.setDate(sun.getDate()+6);return rep>=mon&&rep<=sun;})();
  const prologs=allReports.filter(r=>r.type==='Pro-log').sort((a,b)=>b.week.localeCompare(a.week));
  const latestProlog=prologs[0]||null;

  // 6-week wire data from actual uploaded dates
  const allPayWeeks=[...new Set([...allReports.filter(r=>r.type==='Pay Report').map(r=>r.week),...allPayData.map(p=>p.week)])].filter(Boolean).sort();
  const sixWeeks=allPayWeeks.slice(-6);
  while(sixWeeks.length<6)sixWeeks.unshift('');
  const wireByWeek=sixWeeks.map(wk=>{
    if(!wk)return{wk:'',wire:0,take:0};
    const rep=allReports.find(r=>r.type==='Pay Report'&&r.week===wk);
    const pd=allPayData.find(p=>p.week===wk);
    const wire=parseFloat((pd&&pd.officeWire!==''?pd.officeWire:null)||rep?.officeWire||0)||0;
    const take=parseFloat((pd&&pd.mgrTake!==''?pd.mgrTake:null)||rep?.mgrTake||0)||0;
    return{wk,wire,take};
  });
  wireByWeekGlobal=wireByWeek;

  const curWire=wireByWeek[5]?.wire||0;
  const prevWire=wireByWeek[4]?.wire||0;
  const wireDiff=curWire-prevWire;
  const wireUp=curWire>=prevWire;
  const wireDiffHtml=prevWire?`<span style="font-size:11px;font-weight:600;color:${wireUp?'#00BFA5':'#EF4444'};display:flex;align-items:center;gap:3px;margin-top:4px;">${wireUp?'▲':'▼'} £${Math.abs(wireDiff).toLocaleString('en-GB')} vs prev</span>`:'';

  // Leaderboard
  const lbSnap=(typeof lbRows!=='undefined'&&lbRows.length)?lbFiltered().slice(0,5):[];
  const repSnap=active.slice(0,5);
  function ndC(pos){const m=isDark()?PCD:PC;return m[pos]||m.default;}

  // Mini calendar
  const today=fmtDate(new Date());
  const now=new Date();
  const mY=now.getFullYear(),mM=now.getMonth();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS=['M','T','W','T','F','S','S'];
  const first=new Date(mY,mM,1);
  const startDow=first.getDay()===0?6:first.getDay()-1;
  const dim=new Date(mY,mM+1,0).getDate();
  const prev=new Date(mY,mM,0).getDate();
  const cells=[];
  for(let i=startDow-1;i>=0;i--)cells.push({d:fmtDate(new Date(mY,mM-1,prev-i)),o:true});
  for(let d=1;d<=dim;d++)cells.push({d:fmtDate(new Date(mY,mM,d)),o:false});
  let nd2=1;while(cells.length%7!==0)cells.push({d:fmtDate(new Date(mY,mM+1,nd2++)),o:true});
  const calGrid=DAYS.map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--muted);padding:4px 0;">${d}</div>`).join('')
    +cells.map(c=>{const isT=c.d===today;const ev=calEvents.filter(e=>e.date===c.d).length>0;const dayNum=parseInt(c.d.split('-')[2]);
    return`<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;margin:0 auto;border-radius:50%;font-size:11px;cursor:default;${c.o?'color:var(--subtle);':'color:var(--text);'}${isT?'background:#0f766e;color:#fff;font-weight:700;':''}${ev&&!isT?'font-weight:700;':''}position:relative;">${dayNum}${ev&&!isT?'<div style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:3px;height:3px;background:#0f766e;border-radius:50%;"></div>':''}</div>`}).join('');

  // SVGs

  document.getElementById('home-grid').innerHTML=`

    <!-- ROW 1: Stat tiles — solid colour blocks -->
    <div class="hg-row hg-stats">

      <div style="background:#abc9ff;border-radius:10px;padding:20px 22px;cursor:default;position:relative;overflow:hidden;">
        <div style="font-size:11px;font-weight:700;color:#1a3870;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Active Reps</div>
        <div style="font-size:34px;font-weight:800;color:#0c2060;letter-spacing:-.03em;line-height:1;">${active.length}</div>
        <div style="font-size:11px;font-weight:600;color:#1a3870;margin-top:8px;">${delta>0?'▲ +'+delta+' from last week':delta<0?'▼ '+delta+' from last week':'— Same as last week'}</div>
        <div style="position:absolute;right:-8px;bottom:-8px;opacity:.15;">${SVG.users.replace('width="18"','width="56"').replace('height="18"','height="56"').replace('stroke="currentColor"','stroke="#fff"')}</div>
      </div>

      <div style="background:#abc9ff;border-radius:10px;padding:20px 22px;position:relative;overflow:hidden;">
        <div style="font-size:11px;font-weight:700;color:#1a3870;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Flagged</div>
        <div style="font-size:34px;font-weight:800;color:#0c2060;letter-spacing:-.03em;line-height:1;">${flagged.length}</div>
        <div style="font-size:11px;font-weight:600;color:#1a3870;margin-top:8px;">${leavers.length} leaver${leavers.length!==1?'s':''}</div>
        <div style="position:absolute;right:-8px;bottom:-8px;opacity:.15;">${SVG.warning.replace('width="18"','width="56"').replace('height="18"','height="56"').replace('stroke="currentColor"','stroke="#fff"')}</div>
      </div>

      <div style="background:#abc9ff;border-radius:10px;padding:20px 22px;cursor:${weekSubmitted?'default':'pointer'};position:relative;overflow:hidden;" onclick="${weekSubmitted?'':String.raw`switchTab('weekly')`}">
        <div style="font-size:11px;font-weight:700;color:#1a3870;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Weekly Update</div>
        <div style="font-size:24px;font-weight:800;color:#0c2060;letter-spacing:-.02em;line-height:1.1;">${weekSubmitted?'Submitted':'Pending'}</div>
        <div style="font-size:11px;font-weight:600;color:#1a3870;margin-top:8px;">${weekSubmitted?'Done for this week':'Tap to submit'}</div>
        <div style="position:absolute;right:-8px;bottom:-8px;opacity:.15;">${(weekSubmitted?SVG.check:SVG.clock).replace(/width="1[68]"/,'width="56"').replace(/height="1[68]"/,'height="56"').replace('stroke="currentColor"','stroke="#fff"')}</div>
      </div>

      <div style="background:#1d9ba4;border-radius:10px;padding:20px 22px;position:relative;overflow:hidden;">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.82);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Latest Wire</div>
        <div style="font-size:34px;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1;">${curWire?'£'+curWire.toLocaleString('en-GB'):'—'}</div>
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.8);margin-top:8px;">${prevWire?((wireDiff>=0?'▲ ':'▼ ')+'£'+Math.abs(wireDiff).toLocaleString('en-GB')+' vs prev week'):'&nbsp;'}</div>
        <div style="position:absolute;right:-8px;bottom:-8px;opacity:.15;">${SVG.pound.replace('width="18"','width="56"').replace('height="18"','height="56"').replace('stroke="currentColor"','stroke="#fff"')}</div>
      </div>
    </div>

    <!-- ROW 2: Chart (left) + Links (centre-right) + Calendar (far right) -->
    <div class="hg-row hg-main">

      <!-- Production History -->
      <div style="background:#fff;border-radius:10px;padding:22px 24px;box-shadow:var(--niond-shadow);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.02em;">Production History</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">Office wire &amp; manager take — last 6 uploads</div>
          </div>
          <button onclick="switchTab('reports')" style="background:#0f766e;color:#fff;border:none;font-family:var(--font);font-size:11px;font-weight:700;padding:7px 16px;border-radius:20px;cursor:pointer;letter-spacing:.04em;transition:opacity .15s;" onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">View All</button>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--muted);">
            <div style="width:10px;height:10px;border-radius:50%;background:#5C9DFF;"></div>Office Wire
          </div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--muted);">
            <div style="width:10px;height:10px;border-radius:50%;background:#26C6B0;"></div>Manager Take
          </div>
        </div>
        <canvas id="prod-chart-canvas" style="width:100%;display:block;"></canvas>
      </div>

      <!-- This Week's Links — each as its own card -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:15px;font-weight:800;color:var(--text);letter-spacing:-.02em;padding:0 2px 4px;">This Week's Links</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px;padding:0 2px;">Updated weekly</div>

        ${latestPay
          ?`<a href="${esc(latestPay.url)}" target="_blank" style="background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:11px;text-decoration:none;box-shadow:var(--niond-shadow);transition:box-shadow .15s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.07),0 1px 3px rgba(0,0,0,.04)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03)'">
              <div style="width:34px;height:34px;border-radius:8px;background:#E8F1FF;color:#2979FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.pay}</div>
              <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">Pay Report</div><div style="font-size:11px;color:var(--muted);margin-top:1px;">${fmtReportDate(latestPay.week)}</div></div>
              <div style="color:var(--muted);">${SVG.chev}</div>
            </a>`
          :`<div style="background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:11px;box-shadow:var(--niond-shadow);opacity:.55;">
              <div style="width:34px;height:34px;border-radius:8px;background:#F2F4F6;color:#94A3B8;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.pay}</div>
              <div><div style="font-size:13px;font-weight:600;color:var(--muted);">Pay Report</div><div style="font-size:11px;color:var(--subtle);">Not uploaded yet</div></div>
            </div>`}

        <div onclick="switchTab('planner')" style="background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:11px;box-shadow:var(--niond-shadow);cursor:pointer;transition:box-shadow .15s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.07),0 1px 3px rgba(0,0,0,.04)'" onmouseout="this.style.boxShadow='var(--niond-shadow)'">
          <div style="width:34px;height:34px;border-radius:8px;background:#FFF4E0;color:#FFA800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.cal}</div>
          <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">Daily Planner</div><div style="font-size:11px;color:var(--muted);margin-top:1px;">Open this week's planner</div></div>
          <div style="color:var(--muted);">${SVG.chev}</div>
        </div>

        ${latestProlog
          ?`<a href="${esc(latestProlog.url)}" target="_blank" style="background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:11px;text-decoration:none;box-shadow:var(--niond-shadow);transition:box-shadow .15s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.07),0 1px 3px rgba(0,0,0,.04)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03)'">
              <div style="width:34px;height:34px;border-radius:8px;background:#E0F7F4;color:#00BFA5;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.doc}</div>
              <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">Pro-log</div><div style="font-size:11px;color:var(--muted);margin-top:1px;">${esc(latestProlog.campaign||'')}</div></div>
              <div style="color:var(--muted);">${SVG.chev}</div>
            </a>`
          :`<div style="background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:11px;box-shadow:var(--niond-shadow);opacity:.55;">
              <div style="width:34px;height:34px;border-radius:8px;background:#F2F4F6;color:#94A3B8;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.doc}</div>
              <div><div style="font-size:13px;font-weight:600;color:var(--muted);">Pro-log</div><div style="font-size:11px;color:var(--subtle);">Not uploaded yet</div></div>
            </div>`}

        ${isThisWeekPay?`<div style="background:#FFFBEB;border-radius:8px;padding:9px 13px;font-size:11px;color:#B45309;font-weight:500;display:flex;align-items:center;gap:6px;">${SVG.warning.replace('width="18" height="18"','width="13" height="13"')} Review pay report &amp; flag changes by 11am Friday</div>`:''}
        ${latestPay?`<button class="ack-btn ${ackDone?'done':''}" id="ack-btn" onclick="acknowledgeReport()" style="font-size:11px;padding:7px 14px;border-radius:20px;align-self:flex-start;">${ackDone?'Acknowledged ✓':'Mark as reviewed'}</button>`:''}
      </div>

      <!-- Mini Calendar -->
      <div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:var(--niond-shadow);display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:15px;font-weight:800;color:var(--text);letter-spacing:-.02em;">${MONTHS[mM]} ${mY}</div>
          <button onclick="switchTab('calendar')" style="background:none;border:none;font-family:var(--font);font-size:11px;font-weight:600;color:#0f766e;cursor:pointer;padding:0;white-space:nowrap;">Full calendar →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">
          ${calGrid}
        </div>
        ${(()=>{
          const next7=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return fmtDate(d);});
          const upcoming=calEvents.filter(e=>next7.includes(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,1);
          if(!upcoming.length)return'';
          const CAT_C={personal:'#5C9DFF',work:'#26C6B0',team:'#F51D7E',reminder:'#FFA800',admin:'#8533F5',orange:'#FF6F00',rose:'#F43F5E',cyan:'#06B6D4'};
          return'<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">'
            +'<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Upcoming</div>'
            +upcoming.map(e=>{
              const d=parseDate(e.date);
              const isT=e.date===today;
              const dayStr=isT?'Today':d?d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}):'';
              const col=CAT_C[e.category||'personal']||'#0f766e';
              return'<div style="display:flex;align-items:center;gap:8px;padding:5px 0;">'
                +'<div style="width:3px;height:32px;border-radius:2px;background:'+col+';flex-shrink:0;"></div>'
                +'<div style="min-width:0;"><div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(e.title)+'</div>'
                +'<div style="font-size:10px;color:var(--muted);">'+dayStr+(e.time?' · '+esc(e.time):'')+'</div></div>'
                +'</div>';
            }).join('')+'</div>';
        })()}
      </div>
    </div>

    <!-- ROW 3: Leaderboard (left) + Agents (right) -->
    <div class="hg-row hg-bottom">

      <!-- Top Agents leaderboard -->
      <div style="background:#fff;border-radius:10px;padding:22px 24px;box-shadow:var(--niond-shadow);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.02em;">Top Agents</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">National leaderboard — this week</div>
          </div>
          <button onclick="switchTab('leaderboard');setTimeout(lbInit,50);" style="background:#0f766e;color:#fff;border:none;font-family:var(--font);font-size:11px;font-weight:700;padding:7px 16px;border-radius:20px;cursor:pointer;letter-spacing:.04em;transition:opacity .15s;" onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">Full Board</button>
        </div>
        ${lbSnap.length?`
          ${lbSnap.map((r,i)=>{
            const score=(typeof lbNum!=='undefined')?lbNum(r['Week Total']):(Number(r['Week Total'])||0);
            const rankHtml=i<3?`<img src="${LB_MEDAL_IMG[i+1]}" alt="${i+1}" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;">`:`<div style="width:24px;height:24px;background:var(--surface2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0;">${i+1}</div>`;
            return`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
              ${rankHtml}
              <div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:600;color:var(--text);">${esc(r.Agent)}<span style="font-weight:400;color:var(--muted);margin-left:6px;">· ${esc(r.Campaign||'—')}</span></div>
              <div style="font-size:14px;font-weight:800;color:#0f766e;flex-shrink:0;letter-spacing:-.02em;">${score.toLocaleString()}</div>
            </div>`;
          }).join('')}`
          :`<div style="padding:24px 0;text-align:center;">
              <div style="color:var(--muted);font-size:13px;margin-bottom:12px;">Loads when you open the full board</div>
              <button onclick="switchTab('leaderboard');setTimeout(lbInit,50);" style="background:none;border:1px solid var(--border2);color:#0f766e;font-family:var(--font);font-size:12px;font-weight:600;padding:8px 18px;border-radius:20px;cursor:pointer;">Load Leaderboard</button>
            </div>`}
      </div>

      <!-- Agents snapshot -->
      <div style="background:#fff;border-radius:10px;padding:22px 20px;box-shadow:var(--niond-shadow);display:flex;flex-direction:column;">
        <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.02em;margin-bottom:4px;">Agents</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">${active.length} active · ${leavers.length} leaver${leavers.length!==1?'s':''}</div>
        <div style="display:flex;flex-direction:column;gap:0;flex:1;">
          ${repSnap.length?repSnap.map(r=>{
            const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            const fi=r.flag?FLAGS.find(f=>f.id===r.flag):null;
            return`<div onclick="switchTab('reps')" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:opacity .12s;" onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'">
              <div class="av av34 ${posClass(r.position||'')}" style="${avStyle(r.name,r.position)};flex-shrink:0;">${ini}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</div>
                <div style="font-size:11px;color:var(--muted);">${esc(r.position||'—')}</div>
              </div>
              ${fi?`<div style="width:6px;height:6px;border-radius:50%;background:${fi.color};flex-shrink:0;"></div>`:''}
              <div style="color:var(--subtle);">${SVG.chev}</div>
            </div>`;
          }).join(''):`<div style="padding:16px 0;color:var(--muted);font-size:13px;">No reps yet.</div>`}
        </div>
        <button onclick="switchTab('reps')" style="margin-top:14px;background:#F0E8FE;border:none;color:#8533F5;font-family:var(--font);font-size:12px;font-weight:700;padding:10px;border-radius:8px;cursor:pointer;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:6px;" onmouseover="this.style.background='#E4D4FC'" onmouseout="this.style.background='#F0E8FE'">${SVG.reps} View all ${active.length} reps</button>
      </div>
    </div>
  `;

  setTimeout(()=>drawProdChart(wireByWeek),80);

  if(typeof lbRows!=='undefined'&&!lbLoaded){
    lbInit().then(()=>renderHome()).catch(()=>{});
  }
}


function drawProdChart(wireByWeek){
  const canvas=document.getElementById('prod-chart-canvas');
  if(!canvas)return;
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||600;
  const H=160;
  canvas.width=W*dpr;
  canvas.height=H*dpr;
  canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const padL=48,padR=16,padT=12,padB=32;
  const innerW=W-padL-padR;
  const innerH=H-padT-padB;
  const maxWire=Math.max(...wireByWeek.map(w=>Math.max(w.wire||0,w.take||0)),1);

  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const gridCol=dark?'#2a3a3a':'#eef0f3';
  const labelCol=dark?'#6b8080':'#9aabb8';
  const textCol=dark?'#9aabb8':'#6b7d8a';

  // Grid lines
  ctx.strokeStyle=gridCol;
  ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(pct=>{
    const y=padT+innerH-(pct*innerH);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+innerW,y);ctx.stroke();
    const val=Math.round(maxWire*pct);
    const lbl=val>=1000?'£'+(val/1000).toFixed(1)+'k':'£'+val;
    ctx.fillStyle=labelCol;
    ctx.font='10px DM Sans,sans-serif';
    ctx.textAlign='right';
    ctx.fillText(lbl,padL-6,y+4);
  });

  // Bars
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const groupW=innerW/wireByWeek.length;
  const bw=Math.max(Math.floor(groupW*0.28),4);

  wireByWeek.forEach((d,i)=>{
    const cx=padL+i*groupW+groupW/2;

    // Wire bar (blue)
    if(d.wire>0){
      const bh=Math.max(Math.round((d.wire/maxWire)*innerH),2);
      ctx.fillStyle='#5C9DFF';
      const r=4;const x=cx-bw-3,y=padT+innerH-bh,w=bw,h=bh;
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();
    }

    // Take bar (green)
    if(d.take>0){
      const bh=Math.max(Math.round((d.take/maxWire)*innerH),2);
      ctx.fillStyle='#26C6B0';
      const r=4;const x=cx+3,y=padT+innerH-bh,w=bw,h=bh;
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();
    }

    // Date label
    if(d.wk){
      const parts=d.wk.split('-');
      if(parts.length===3){
        const yr=parseInt(parts[0],10),mo=parseInt(parts[1],10),dy=parseInt(parts[2],10);
        if(!isNaN(yr)&&!isNaN(mo)&&!isNaN(dy)){
          const lbl=dy+' '+months[mo-1];
          ctx.fillStyle=textCol;
          ctx.font='bold 10px DM Sans,sans-serif';
          ctx.textAlign='center';
          ctx.fillText(lbl,cx,padT+innerH+16);
          ctx.fillStyle=labelCol;
          ctx.font='9px DM Sans,sans-serif';
          ctx.fillText(yr,cx,padT+innerH+27);
        }
      }
    }
  });

}


function dismissAnn(id){localStorage.setItem('tt_ann_dismissed_'+id,'1');renderHome();}
async function acknowledgeReport(){
  if(ackDone)return;
  try{await api({action:'ackReport',manager:managerName,week:weekKey});ackDone=true;const btn=document.getElementById('ack-btn');if(btn){btn.textContent='✓ Acknowledged';btn.classList.add('done');}showToast('Pay report acknowledged ✓','success');}
  catch(e){showToast('Could not save','error');}
}
async function saveNotes(){const val=document.getElementById('notes-area').value;notes=val;try{await api({action:'saveNotes',manager:managerName,notes:val});showToast('Notes saved ✓','success');}catch(e){showToast('Could not save notes','error');}}

// ── MY REPS ───────────────────────────────────────────
let rp_posFilter = 'All';

function renderReps(){
  const list = document.getElementById('rep-list');
  if(!roster.length){list.innerHTML='<div class="empty-state"><strong>No reps yet</strong>Add your first rep above.</div>';renderRepPills();return;}

  const mgrEntry={id:'__mgr__',name:getMgrDisplay(),position:'Manager'};
  const REPORTABLE_POSITIONS=['Leader','Core','Junior Partner +'];
  const leaders=[mgrEntry,...roster.filter(r=>REPORTABLE_POSITIONS.includes(r.position)&&!r.leaver)];

  // Split active vs leavers, leavers always sink to bottom
  const active  = roster.filter(r=>!r.leaver);
  const leavers = roster.filter(r=>r.leaver);

  // Position group order
  const GROUP_ORDER = [...POSITIONS, ''];  // '' = unassigned
  const grouped = {};
  GROUP_ORDER.forEach(p=>grouped[p]=[]);
  active.forEach(r=>{
    const p = r.position||'';
    if(grouped[p]!==undefined) grouped[p].push(r);
    else grouped[''].push(r);
  });

  function repCardHtml(r){
    const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const leaderOpts=leaders.filter(l=>l.id!==r.id).map(l=>`<option value="${esc(l.id)}" ${r.leader===l.id?'selected':''}>${esc(l.name)} (${esc(l.position)})</option>`).join('');
    const flagOpts=FLAGS.map(f=>`<option value="${f.id}" ${r.flag===f.id?'selected':''}>${f.label}</option>`).join('');
    const flagInfo=r.flag?FLAGS.find(f=>f.id===r.flag):null;
    const pos=r.position||'';
    const dotCol=flagInfo?flagInfo.color:'';
    const dotCls=flagInfo?'':'no-flag';
    const dotTitle=flagInfo?flagInfo.label:'Set flag';
    return`<div class="rep-card ${r.leaver?'is-leaver':''}" id="rc-${r.id}">
      <div class="rep-card-head" onclick="toggleCard('${r.id}')">
        <div data-position="${pos}" class="av av34 ${posClass(pos)}" style="${avStyle(r.name,pos)}">${ini}</div>
        <div class="rep-info">
          <div class="rep-name">${esc(r.name)}</div>
          <div class="rep-meta">
            ${pos?`<span class="pos-tag ${posClass(pos)}">${esc(pos)}</span>`:''}
            ${r.leaver?'<span class="leaver-tag">Leaver</span>':''}
            ${r.leader?(()=>{if(r.leader==='__mgr__')return`<span>→${esc(getMgrDisplay())}</span>`;const l=roster.find(x=>x.id===r.leader);return l?`<span>→${esc(l.name)}</span>`:''})():''}
            <span class="rep-flag-indicator" style="${flagInfo?`font-size:11px;font-weight:600;color:${flagInfo.color};`:'display:none;font-size:11px;font-weight:600;'}">${flagInfo?`● ${esc(flagInfo.label)}`:''}</span>
          </div>
        </div>
        <div class="rep-flag-dot ${dotCls}" id="fd-${r.id}" title="${dotTitle}" style="${flagInfo?`background:${dotCol};border-color:${dotCol};`:''}" onclick="event.stopPropagation();cycleFlag('${r.id}')"></div>
        <button class="expand-btn" id="eb-${r.id}">›</button>
        <button class="sc-trigger-btn" onclick="event.stopPropagation();openScorecard('${r.id}')">Scorecard</button>
      </div>
      <div class="rep-card-body" id="rb-${r.id}">
        <div class="rep-fields" style="margin-top:14px;">
          <div class="field-group"><label class="field-lbl">Name</label><input class="field-input" type="text" value="${esc(r.name||'')}" onchange="updateRep('${r.id}','name',this.value)"/></div>
          <div class="field-group"><label class="field-lbl">Email</label><input class="field-input" type="email" placeholder="Optional" value="${esc(r.email||'')}" onchange="updateRep('${r.id}','email',this.value)"/></div>
          <div class="field-group"><label class="field-lbl">Position</label>
            <select class="field-input" onchange="updateRep('${r.id}','position',this.value)">
              <option value="">Select…</option>${POSITIONS.map(p=>`<option value="${p}" ${r.position===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field-group"><label class="field-lbl">Reports to</label>
            <select class="field-input" onchange="updateRep('${r.id}','leader',this.value)">
              <option value="">Not assigned</option>${leaderOpts}
            </select>
          </div>
          <div class="field-group"><label class="field-lbl">Flag</label>
            <select class="field-input" onchange="updateRep('${r.id}','flag',this.value)">
              <option value="">No flag</option>${flagOpts}
            </select>
          </div>
          <div class="field-group"><label class="field-lbl">Notes</label><input class="field-input" type="text" placeholder="Any notes…" value="${esc(r.notes||'')}" onchange="updateRep('${r.id}','notes',this.value)"/></div>
        </div>
        <div class="rep-foot">
          <button class="tag-btn" onclick="event.stopPropagation();openPromo('${r.id}')">⬆ Log promotion</button>
          <button class="tag-btn ${r.leaver?'warn':''}" onclick="toggleLeaver('${r.id}')">${r.leaver?'✓ Leaver':'Mark as leaver'}</button>
          <button class="save-btn-sm" onclick="saveRep('${r.id}')">Save changes</button>
        </div>
      </div>
    </div>`;
  }

  // Build filtered + grouped HTML
  const q = (document.getElementById('rep-search')?.value||'').toLowerCase();
  function matchesSearch(r){
    if(!q) return true;
    return (r.name||'').toLowerCase().includes(q)||(r.position||'').toLowerCase().includes(q);
  }
  function matchesFilter(r){
    if(rp_posFilter==='All') return true;
    if(rp_posFilter==='Leavers') return r.leaver;
    return (r.position||'')=== rp_posFilter && !r.leaver;
  }

  let html = '';

  if(rp_posFilter==='All' || rp_posFilter==='Leavers'){
    // Grouped view for All; flat for Leavers filter
    if(rp_posFilter==='All'){
      GROUP_ORDER.forEach(p=>{
        const reps = grouped[p].filter(r=>matchesSearch(r));
        if(!reps.length) return;
        const label = p||'Unassigned';
        html += `<div class="rep-group-hdr">${esc(label)}</div>`;
        html += reps.map(repCardHtml).join('');
      });
      // Leavers section at bottom
      const leaverFiltered = leavers.filter(r=>matchesSearch(r));
      if(leaverFiltered.length){
        html += `<div class="rep-group-hdr" style="margin-top:14px;color:var(--warning);">Leavers</div>`;
        html += leaverFiltered.map(repCardHtml).join('');
      }
    } else {
      // Leavers filter pill selected
      const shown = leavers.filter(r=>matchesSearch(r));
      html = shown.length ? shown.map(repCardHtml).join('') : '<div class="sc-empty-msg">No leavers.</div>';
    }
  } else {
    // Specific position filter — flat list, no group headers
    const shown = active.filter(r=>matchesFilter(r)&&matchesSearch(r));
    html = shown.length ? shown.map(repCardHtml).join('') : `<div class="sc-empty-msg">No reps with position "${esc(rp_posFilter)}".</div>`;
  }

  list.innerHTML = html || '<div class="empty-state"><strong>No results</strong>Try a different filter.</div>';
  renderRepPills();
}

function renderRepPills(){
  const wrap = document.getElementById('rep-filter-pills');
  if(!wrap) return;
  const positions = POSITIONS.filter(p=>roster.some(r=>r.position===p&&!r.leaver));
  const hasLeavers = roster.some(r=>r.leaver);
  const pills = ['All', ...positions, ...(hasLeavers?['Leavers']:[])];
  wrap.innerHTML = pills.map(p=>`<button class="rep-fpill${rp_posFilter===p?' active':''}" onclick="setRepFilter('${p}')">${esc(p)}</button>`).join('');
}

function setRepFilter(p){
  rp_posFilter=p;
  renderReps();
}

// ── Flag cycle on dot click ──
function cycleFlag(id){
  const r=roster.find(x=>x.id===id);if(!r)return;
  const flagIds=['', ...FLAGS.map(f=>f.id)];
  const cur=flagIds.indexOf(r.flag||'');
  const next=flagIds[(cur+1)%flagIds.length];
  r.flag=next||'';
  // update dot in-place
  const dot=document.getElementById(`fd-${id}`);
  const fi=next?FLAGS.find(f=>f.id===next):null;
  if(dot){
    dot.style.background=fi?fi.color:'var(--border2)';
    dot.style.borderColor=fi?fi.color:'var(--border2)';
    dot.className=`rep-flag-dot${fi?'':' no-flag'}`;
    dot.title=fi?fi.label:'Set flag';
  }
  // update text indicator
  const fm=document.querySelector(`#rc-${id} .rep-flag-indicator`);
  if(fm){fm.style.color=fi?fi.color:'';fm.textContent=fi?`● ${fi.label}`:'';fm.style.display=fi?'':'none';}
  // sync flag dropdown if card is open
  const sel=document.querySelector(`#rb-${id} select[onchange*="flag"]`);
  if(sel) sel.value=r.flag||'';
}

// ── Promotion modal ──
let promoRepId = null;
function openPromo(id){
  const r=roster.find(x=>x.id===id);if(!r)return;
  promoRepId=id;
  document.getElementById('promo-title').textContent=`Log promotion — ${r.name.split(' ')[0]}`;
  document.getElementById('promo-sub').textContent=`Current position: ${r.position||'None'}`;
  const sel=document.getElementById('promo-pos-sel');
  sel.innerHTML=POSITIONS.filter(p=>p!==r.position).map(p=>`<option value="${p}">${p}</option>`).join('');
  document.getElementById('promo-backdrop').style.display='flex';
}
function closePromo(){
  document.getElementById('promo-backdrop').style.display='none';
  promoRepId=null;
}
async function confirmPromo(){
  const r=roster.find(x=>x.id===promoRepId);if(!r)return;
  const newPos=document.getElementById('promo-pos-sel').value;
  if(!newPos){closePromo();return;}
  const today=new Date();
  const dateStr=today.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  if(!r.positionHistory) r.positionHistory=[];
  if(r.position) r.positionHistory.unshift({position:r.position,date:dateStr,type:'previous'});
  r.position=newPos;
  r.positionHistory.unshift({position:newPos,date:dateStr,type:'promoted'});
  closePromo();
  try{await api({action:'saveRep',manager:managerName,rep:r});showToast(`${r.name} promoted to ${newPos} ✓`,'success');}
  catch(e){showToast('Saved locally — sheet sync failed','error');}
  renderReps();renderHome();
}
function toggleCard(id){const b=document.getElementById(`rb-${id}`);const e=document.getElementById(`eb-${id}`);const o=b.classList.toggle('open');e.textContent=o?'∨':'›';}
function updateRep(id,f,v){const r=roster.find(x=>x.id===id);if(!r)return;r[f]=v;
  // Update visual indicators in-place without collapsing the card
  if(f==='position'){
    const pos=v||'';
    const rep=roster.find(r=>r.id===id);
    const av=document.querySelector(`#rc-${id} .av`);
    if(av){av.className=`av av34 ${posClass(pos)}`;av.setAttribute('data-position',pos);av.style.cssText=avStyle(rep?rep.name:'',pos);}
    const pt=document.querySelector(`#rc-${id} .pos-tag`);
    if(pt){if(pos){pt.className=`pos-tag ${posClass(pos)}`;pt.textContent=pos;}else{pt.className='pos-tag';pt.textContent='';}}
    refreshAddLeaderDropdown();
  }
  if(f==='flag'){
    const fi=v?FLAGS.find(x=>x.id===v):null;
    const fm=document.querySelector(`#rc-${id} .rep-flag-indicator`);
    if(fm){fm.style.color=fi?fi.color:'transparent';fm.textContent=fi?`● ${fi.label}`:'';fm.style.display=fi?'':'none';}
  }
}
function toggleLeaver(id){const r=roster.find(x=>x.id===id);if(!r)return;r.leaver=!r.leaver;renderReps();setTimeout(()=>{const b=document.getElementById(`rb-${id}`);if(b){b.classList.add('open');document.getElementById(`eb-${id}`).textContent='∨';}},0);}
async function saveRep(id){const r=roster.find(x=>x.id===id);if(!r)return;try{await api({action:'saveRep',manager:managerName,rep:r});showToast(`${r.name} saved ✓`,'success');renderReps();renderHome();}catch(e){showToast('Save failed','error');}}
function filterReps(){renderReps();}
function refreshAddLeaderDropdown(){
  // Populate position options
  const posSel=document.getElementById('add-rep-position');
  if(posSel&&posSel.options.length<=1){
    POSITIONS.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;posSel.appendChild(o);});
  }
  // Populate reports-to options
  const sel=document.getElementById('add-rep-leader');
  if(!sel)return;
  const REPORTABLE_POSITIONS=['Leader','Core','Junior Partner +'];
  const mgrEntry={id:'__mgr__',name:getMgrDisplay(),position:'Manager'};
  const opts=[mgrEntry,...roster.filter(r=>REPORTABLE_POSITIONS.includes(r.position)&&!r.leaver)];
  const cur=sel.value;
  sel.innerHTML='<option value="">Not assigned</option>'+opts.map(l=>`<option value="${esc(l.id)}"${cur===l.id?' selected':''}>${esc(l.name)} (${esc(l.position)})</option>`).join('');
}
async function addRep(){
  const inp=document.getElementById('add-rep-name');
  const emailInp=document.getElementById('add-rep-email');
  const posInp=document.getElementById('add-rep-position');
  const leaderInp=document.getElementById('add-rep-leader');
  const name=inp.value.trim();
  if(!name){showToast('Please enter a name','error');inp.focus();return;}
  if(roster.find(r=>r.name.toLowerCase()===name.toLowerCase())){showToast('Already in team','error');return;}
  const rep={id:'r'+Date.now(),name,email:(emailInp?emailInp.value.trim():''),position:(posInp?posInp.value:''),leader:(leaderInp?leaderInp.value:''),notes:'',flag:'',leaver:false,addedOn:weekKey};
  roster.push(rep);
  inp.value='';
  if(emailInp)emailInp.value='';
  if(posInp)posInp.value='';
  if(leaderInp)leaderInp.value='';
  try{await api({action:'saveRep',manager:managerName,rep});showToast(`${name} added ✓`,'success');}
  catch(e){showToast('Added — sheet sync failed','error');}
  renderReps();renderHome();refreshAddLeaderDropdown();
}

// ── WEEKLY UPDATE ─────────────────────────────────────
let weekPromoted = new Set();
function renderWeekly(){
  const list=document.getElementById('week-list');
  const active=roster.filter(r=>!r.leaver);

  // Headcount bar
  const hcBar=document.getElementById('wk-headcount-bar');
  if(hcBar&&lastWeekCount>0){
    const thisWeek=active.length-weekLeavers.size;
    const delta=thisWeek-lastWeekCount;
    const deltaHtml=delta===0
      ?`<span class="wk-hc-delta wk-hc-same">= same</span>`
      :delta>0
        ?`<span class="wk-hc-delta wk-hc-up">▲ +${delta}</span>`
        :`<span class="wk-hc-delta wk-hc-down">▼ ${delta}</span>`;
    hcBar.style.display='flex';
    hcBar.innerHTML=`Last week <strong>${lastWeekCount}</strong> → This week <strong>${thisWeek}</strong> ${deltaHtml}`;
  } else if(hcBar){hcBar.style.display='none';}

  if(!active.length){list.innerHTML='<div class="empty-state"><strong>No active reps</strong>Add reps on My Reps first.</div>';return;}
  list.innerHTML=active.map(r=>{
    const wl=weekLeavers.has(r.id);
    const wp=weekPromoted.has(r.id);
    const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const pos=r.position||'';
    return`<div class="week-row ${wl?'is-leaver':''} ${wp?'is-promoted':''}" id="wr-${r.id}">
      <div data-position="${pos}" class="av av28 ${posClass(pos)}" style="${avStyle(r.name,pos)}">${ini}</div>
      <div class="week-row-info">
        <div class="week-row-name" style="${wl?'text-decoration:line-through;color:var(--subtle);':''}">${esc(r.name)}</div>
        <div class="week-row-sub" style="display:flex;align-items:center;gap:5px;">
          ${pos?`<span class="pos-tag ${posClass(pos)}" style="font-size:10px;padding:1px 6px;">${esc(pos)}</span>`:'<span style="color:var(--muted);">—</span>'}
          ${r.email?`<span style="color:var(--muted);">· ${esc(r.email)}</span>`:''}
        </div>
      </div>
      ${wl?'<span class="leaver-tag">Leaving</span>':wp?'<span class="promoted-tag">⬆ Promoted</span>':''}
      <div style="display:flex;gap:5px;flex-shrink:0;">
        ${!wl?`<button class="promoted-toggle" onclick="toggleWeekPromoted('${r.id}')">${wp?'Undo':'Promoted'}</button>`:''}
        <button class="leaver-toggle" onclick="toggleWeekLeaver('${r.id}')">${wl?'Undo':'Left this week'}</button>
      </div>
    </div>`;
  }).join('');

  // Update submit button text
  const btn=document.getElementById('submit-btn');
  if(btn&&!btn.disabled) btn.textContent=weekSubmitted?'Update submission':'Submit team for this week';
}
function toggleWeekLeaver(id){
  if(weekLeavers.has(id)){weekLeavers.delete(id);}
  else{weekLeavers.add(id);weekPromoted.delete(id);}  // can't be both
  renderWeekly();
}
function toggleWeekPromoted(id){
  if(weekPromoted.has(id)){weekPromoted.delete(id);}
  else{weekPromoted.add(id);weekLeavers.delete(id);}  // can't be both
  renderWeekly();
}
async function submitWeek(){
  const leaverIds=[...weekLeavers];
  if(leaverIds.length>0){
    const names=leaverIds.map(id=>{const r=roster.find(x=>x.id===id);return r?r.name:id;}).join(', ');
    if(!confirm(`Marking ${leaverIds.length} person${leaverIds.length!==1?'s':''} as leaving this week:\n${names}\n\nAre you sure?`))return;
  }
  const rows=roster.filter(r=>!r.leaver).map(r=>({id:r.id,name:r.name,email:r.email||'',position:r.position||'',leaver:weekLeavers.has(r.id),promoted:weekPromoted.has(r.id)}));
  if(!rows.length){showToast('No active reps to submit','error');return;}
  const btn=document.getElementById('submit-btn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Saving…';
  try{
    const res=await api({action:'submit',manager:managerName,week:weekKey,rows});
    if(res&&res.ok){
      weekSubmitted=true;
      document.getElementById('banner-done').style.display='block';
      // Apply leavers to roster
      weekLeavers.forEach(id=>{const r=roster.find(x=>x.id===id);if(r){r.leaver=true;api({action:'saveRep',manager:managerName,rep:r});}});
      // Apply promotions — update position one step up
      const PROMO_MAP={'Trainee':'Solo','Solo':'Leader','Leader':'Core','Junior':'Solo'};
      weekPromoted.forEach(id=>{
        const r=roster.find(x=>x.id===id);
        if(r){
          const next=PROMO_MAP[r.position]||r.position;
          if(next!==r.position){r.position=next;api({action:'saveRep',manager:managerName,rep:r});}
        }
      });
      weekLeavers.clear();weekPromoted.clear();
      btn.disabled=false;btn.textContent='Update submission';
      document.getElementById('weekly-badge').style.display='none';
      syncWeeklyDot();
      showToast('Team submitted ✓','success');
      renderAll();
    }else throw new Error(JSON.stringify(res));
  }catch(e){btn.disabled=false;btn.textContent=weekSubmitted?'Update submission':'Submit team for this week';showToast('Submit failed','error');console.error(e);}
}

// ── REPORTS ───────────────────────────────────────────
function switchReportTab(tab){
  document.querySelectorAll('.rtab-btn').forEach((b,i)=>{const tabs=['pay','planner','prolog'];b.classList.toggle('active',tabs[i]===tab);});
  document.querySelectorAll('.rtab-panel').forEach(p=>p.classList.toggle('active',p.id===`rtab-${tab}`));
  const s=document.getElementById('rpt-search');if(s){s.value='';filterReports();}
}

function getPayDataForWeek(week){
  const rep=allReports.find(r=>r.type==='Pay Report'&&r.week===week);
  const saved=allPayData.find(p=>p.week===week);
  // Manager edits take priority; fall back to what admin uploaded on the report
  return{
    officeWire:(saved&&saved.officeWire!==''?saved.officeWire:null)||(rep&&rep.officeWire)||'',
    mgrTake:(saved&&saved.mgrTake!==''?saved.mgrTake:null)||(rep&&rep.mgrTake)||''
  };
}

async function savePayDataForWeek(week){
  const wire=document.getElementById(`pd-wire-${week}`)?.value||'';
  const take=document.getElementById(`pd-take-${week}`)?.value||'';
  const btn=document.getElementById(`pd-save-${week}`);
  if(btn){btn.textContent='Saving…';btn.disabled=true;}
  try{
    await api({action:'savePayData',manager:managerName,week,officeWire:wire,mgrTake:take});
    // update local cache
    const existing=allPayData.find(p=>p.week===week);
    if(existing){existing.officeWire=wire;existing.mgrTake=take;}
    else allPayData.push({week,officeWire:wire,mgrTake:take});
    showToast('Production data saved ✓','success');
    if(btn){btn.textContent='Saved ✓';btn.style.background='var(--success)';setTimeout(()=>{btn.textContent='Save';btn.style.background='';btn.disabled=false;},2000);}
    renderReports();
  }catch(e){
    showToast('Save failed','error');
    if(btn){btn.textContent='Save';btn.disabled=false;}
  }
}

function buildPayProductionCard(week){
  const pd=getPayDataForWeek(week);
  const isCurrentWeek=week===weekKey;
  const wire=parseFloat(pd.officeWire)||0;
  const take=parseFloat(pd.mgrTake)||0;
  const pct=wire>0?Math.round((take/wire)*100):null;
  const safeW=week.replace(/[^0-9-]/g,'');
  return`<div style="background:#fff;border-radius:10px;padding:18px 20px;margin-bottom:10px;box-shadow:var(--niond-shadow);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${wire>0||take>0?'14px':'4px'};">
      <div>
        <div style="font-size:15px;font-weight:800;color:var(--text);letter-spacing:-.02em;">Production Overview</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${fmtReportDate(week)}${isCurrentWeek?` · <span style="color:var(--warning);font-weight:600;">This Week</span>`:''}</div>
      </div>
      ${wire>0||take>0?`<div style="text-align:right;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">Your take</div><div style="font-size:26px;font-weight:800;color:#1d9ba4;letter-spacing:-.03em;">£${take>0?take.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div></div>`:''}
    </div>
    ${wire>0||take>0?`
    <div style="display:grid;grid-template-columns:1fr 1fr${pct!==null?' 1fr':''}; gap:10px;margin-bottom:4px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Office Wire</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);">£${wire>0?wire.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Manager's Take</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);">£${take>0?take.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
      </div>
      ${pct!==null?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Take %</div>
        <div style="font-size:18px;font-weight:800;color:var(--accent);">${pct}%</div>
      </div>`:''}
    </div>
    `:'<div style="font-size:13px;color:var(--subtle);margin-bottom:10px;padding:4px 0;">No production figures uploaded for this week yet.</div>'}
    <details style="margin-top:8px;">
      <summary style="font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;padding:4px 0;">
        ${SVG.pencil} Edit / update figures
      </summary>
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Office Wire £</div>
          <input id="pd-wire-${safeW}" type="number" min="0" step="0.01" value="${pd.officeWire}" placeholder="0.00" style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 11px;border-radius:var(--rsm);outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Manager's Take £</div>
          <input id="pd-take-${safeW}" type="number" min="0" step="0.01" value="${pd.mgrTake}" placeholder="0.00" style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 11px;border-radius:var(--rsm);outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
        </div>
      </div>
      <button id="pd-save-${safeW}" onclick="savePayDataForWeek('${week}')" style="margin-top:10px;background:#0f766e;border:none;color:#fff;font-family:var(--font);font-size:13px;font-weight:600;padding:8px 20px;border-radius:20px;cursor:pointer;transition:opacity .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Save</button>
    </details>
  </div>`;
}

function renderReports(){
  _renderPayReports();
  _renderSimpleReports(allReports.filter(r=>r.type==='Pro-log'),'prolog-reports-list','prolog-summary-strip','rt-prolog',SVG.doc,'#E0F7F4','#00BFA5');
  // Inline pay chart at top of reports page
  setTimeout(rptPtcRenderChart, 80);
}

function _weekToMonthKey(w){
  // w is "YYYY-MM-DD" — return "YYYY-MM"
  if(!w||typeof w!=='string')return'';
  return w.slice(0,7);
}
function _monthKeyLabel(mk){
  if(!mk)return'—';
  const [y,m]=mk.split('-');
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return(MONTHS[parseInt(m,10)-1]||'?')+' '+y;
}
function _currentMonthKey(){return weekKey.slice(0,7);}

// ── Pay Reports ────────────────────────────────────────
function _renderPayReports(){
  const stripEl=document.getElementById('pay-summary-strip');
  const listEl=document.getElementById('pay-reports-list');
  const payReports=allReports.filter(r=>r.type==='Pay Report');

  // Summary strip
  if(!payReports.length){
    stripEl.innerHTML='';
    listEl.innerHTML='<div class="empty-state"><strong>None yet</strong>Will appear here when uploaded.</div>';
    return;
  }
  const allWeeks=[...new Set([...payReports.map(r=>r.week),...allPayData.map(p=>p.week)])].filter(Boolean);
  let totalWire=0,totalTake=0,weeksWithData=0;
  allWeeks.forEach(w=>{
    const pd=getPayDataForWeek(w);
    const wire=parseFloat(pd.officeWire)||0;
    const take=parseFloat(pd.mgrTake)||0;
    if(wire>0||take>0)weeksWithData++;
    totalWire+=wire;totalTake+=take;
  });
  const weeks=Object.keys(allWeeks.reduce((a,w)=>{a[w]=1;return a;},{})).sort();
  const dateRange=weeks.length>1?`${fmtReportDate(weeks[0])} – ${fmtReportDate(weeks[weeks.length-1])}`:(weeks[0]?fmtReportDate(weeks[0]):'—');
  stripEl.innerHTML=`<div class="rpt-summary pay-grid">
    <div class="rpt-stat"><div class="rpt-stat-val">${payReports.length}</div><div class="rpt-stat-lbl">Pay reports</div></div>
    <div class="rpt-stat"><div class="rpt-stat-val">${weeksWithData}</div><div class="rpt-stat-lbl">Weeks with figures</div></div>
    <div class="rpt-stat teal-stat"><div class="rpt-stat-val">£${totalWire>0?totalWire.toLocaleString('en-GB',{maximumFractionDigits:0}):'—'}</div><div class="rpt-stat-lbl">Total office wire</div></div>
    <div class="rpt-stat teal-stat"><div class="rpt-stat-val">£${totalTake>0?totalTake.toLocaleString('en-GB',{maximumFractionDigits:0}):'—'}</div><div class="rpt-stat-lbl">Total your take</div></div>
  </div>`;

  // Group by week then by month
  const byW={};payReports.forEach(r=>{if(!byW[r.week])byW[r.week]=[];byW[r.week].push(r);});
  const sortedWeeks=Object.keys(byW).sort((a,b)=>b.localeCompare(a));
  const byMonth={};
  sortedWeeks.forEach(w=>{const mk=_weekToMonthKey(w);if(!byMonth[mk])byMonth[mk]=[];byMonth[mk].push(w);});
  const sortedMonths=Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));
  const curMk=_currentMonthKey();

  listEl.innerHTML=sortedMonths.map(mk=>{
    const isCur=mk===curMk;
    const mWeeks=byMonth[mk];
    // month-level wire/take totals
    let mWire=0,mTake=0;
    mWeeks.forEach(w=>{const pd=getPayDataForWeek(w);mWire+=parseFloat(pd.officeWire)||0;mTake+=parseFloat(pd.mgrTake)||0;});
    const metaParts=[`${mWeeks.length} week${mWeeks.length!==1?'s':''}`];
    if(mWire>0)metaParts.push(`£${mWire.toLocaleString('en-GB',{maximumFractionDigits:0})} wire`);
    if(mTake>0)metaParts.push(`£${mTake.toLocaleString('en-GB',{maximumFractionDigits:0})} take`);
    const bodyHtml=mWeeks.map(w=>{
      const isNow=w===weekKey;
      return`<div class="rpt-week-block" data-week="${w}">
        <div class="wk-hdr" style="margin-top:8px;">${fmtReportDate(w)}${isNow?'<span class="now-badge">THIS WEEK</span>':''}</div>
        ${buildPayProductionCard(w)}
        ${byW[w].map(r=>`<div class="rh-row">
          <div style="width:34px;height:34px;border-radius:8px;background:#E8F1FF;color:#2979FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SVG.chart}</div>
          <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--text);">Pay Report${r.campaign?` — ${esc(r.campaign)}`:''}</div>${isNow?`<div style="font-size:11px;color:var(--warning);margin-top:1px;display:flex;align-items:center;gap:4px;">${SVG.warning.replace('width="18" height="18"','width="11" height="11"')} Review and let Elle know before 11am Friday</div>`:''}</div>
          <span class="rtype-badge rt-pay">Pay Report</span>
          <a href="${esc(r.url)}" target="_blank" class="view-btn ghost">View ↗</a>
        </div>`).join('')}
      </div>`;
    }).join('');
    return`<div class="month-accordion${isCur?' is-current':''}" data-month="${mk}">
      <div class="month-acc-hdr" onclick="toggleMonthAcc(this)">
        <span class="month-acc-chevron">›</span>
        <span class="month-acc-title">${_monthKeyLabel(mk)}</span>
        ${isCur?'<span class="now-badge">Current</span>':''}
        <span class="month-acc-meta">${metaParts.join(' · ')}</span>
      </div>
      <div class="month-acc-body">${bodyHtml}</div>
    </div>`;
  }).join('');
}

// ── Simple (planner / prolog) Reports ─────────────────
function _renderSimpleReports(reports,listId,stripId,badgeClass,icon,iconBg,iconColor){
  const stripEl=document.getElementById(stripId);
  const listEl=document.getElementById(listId);
  if(!reports.length){
    stripEl.innerHTML='';
    listEl.innerHTML='<div class="empty-state"><strong>None yet</strong>Will appear here when uploaded.</div>';
    return;
  }
  // Summary strip
  const allWks=[...new Set(reports.map(r=>r.week))].sort();
  stripEl.innerHTML=`<div class="rpt-summary basic-grid">
    <div class="rpt-stat"><div class="rpt-stat-val">${reports.length}</div><div class="rpt-stat-lbl">Total reports</div></div>
    <div class="rpt-stat"><div class="rpt-stat-val">${allWks.length}</div><div class="rpt-stat-lbl">Weeks covered</div></div>
    <div class="rpt-stat"><div class="rpt-stat-val">${_monthKeyLabel(allWks[0]?allWks[0].slice(0,7):'')}</div><div class="rpt-stat-lbl">Earliest on record</div></div>
  </div>`;

  // Group by week then month
  const byW={};reports.forEach(r=>{if(!byW[r.week])byW[r.week]=[];byW[r.week].push(r);});
  const sortedWeeks=Object.keys(byW).sort((a,b)=>b.localeCompare(a));
  const byMonth={};
  sortedWeeks.forEach(w=>{const mk=_weekToMonthKey(w);if(!byMonth[mk])byMonth[mk]=[];byMonth[mk].push(w);});
  const sortedMonths=Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));
  const curMk=_currentMonthKey();

  listEl.innerHTML=sortedMonths.map(mk=>{
    const isCur=mk===curMk;
    const mWeeks=byMonth[mk];
    const totalInMonth=mWeeks.reduce((s,w)=>s+(byW[w]||[]).length,0);
    const bodyHtml=mWeeks.map(w=>{
      const isNow=w===weekKey;
      return`<div class="rpt-week-block" data-week="${w}">
        <div class="wk-hdr" style="margin-top:8px;">${fmtReportDate(w)}${isNow?'<span class="now-badge">THIS WEEK</span>':''}</div>
        ${byW[w].map(r=>`<div class="rh-row">
          <div style="width:34px;height:34px;border-radius:8px;background:${iconBg};color:${iconColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">${icon}</div>
          <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--text);">${esc(r.type)}${r.campaign?` — ${esc(r.campaign)}`:''}</div></div>
          <span class="rtype-badge ${badgeClass}">${esc(r.type)}</span>
          <a href="${esc(r.url)}" target="_blank" class="view-btn ghost">View ↗</a>
        </div>`).join('')}
      </div>`;
    }).join('');
    return`<div class="month-accordion${isCur?' is-current':''}" data-month="${mk}">
      <div class="month-acc-hdr" onclick="toggleMonthAcc(this)">
        <span class="month-acc-chevron">›</span>
        <span class="month-acc-title">${_monthKeyLabel(mk)}</span>
        ${isCur?'<span class="now-badge">Current</span>':''}
        <span class="month-acc-meta">${mWeeks.length} week${mWeeks.length!==1?'s':''} · ${totalInMonth} report${totalInMonth!==1?'s':''}</span>
      </div>
      <div class="month-acc-body">${bodyHtml}</div>
    </div>`;
  }).join('');
}

function toggleMonthAcc(hdr){
  const body=hdr.nextElementSibling;
  const open=body.classList.toggle('open');
  hdr.classList.toggle('open',open);
}

function filterReports(){
  const q=(document.getElementById('rpt-search').value||'').trim().toLowerCase();
  // Find which tab is active
  const panels=['pay','planner','prolog'];
  const activePanel=panels.find(p=>document.getElementById('rtab-'+p).classList.contains('active'))||'pay';
  const listId=activePanel+'-reports-list';
  const listEl=document.getElementById(listId);
  if(!listEl)return;
  const accordions=listEl.querySelectorAll('.month-accordion');
  let anyVisible=false;
  accordions.forEach(acc=>{
    const mk=acc.dataset.month||'';
    const label=_monthKeyLabel(mk).toLowerCase();
    const weeks=acc.querySelectorAll('.rpt-week-block');
    let accMatch=!q||label.includes(q)||mk.includes(q);
    if(!accMatch){
      // check individual weeks
      weeks.forEach(wb=>{
        const wDate=(wb.dataset.week||'').toLowerCase();
        const wLabel=fmtReportDate(wb.dataset.week||'').toLowerCase();
        if(wDate.includes(q)||wLabel.includes(q))accMatch=true;
      });
    }
    acc.style.display=accMatch?'':'none';
    if(accMatch){
      anyVisible=true;
      // If searching, expand all matching; if clearing, keep current state
      if(q){
        acc.querySelector('.month-acc-hdr').classList.add('open');
        acc.querySelector('.month-acc-body').classList.add('open');
        // show/hide individual week blocks
        weeks.forEach(wb=>{
          const wDate=(wb.dataset.week||'').toLowerCase();
          const wLabel=fmtReportDate(wb.dataset.week||'').toLowerCase();
          wb.style.display=(!q||wDate.includes(q)||wLabel.includes(q)||label.includes(q))?'':'none';
        });
      } else {
        weeks.forEach(wb=>wb.style.display='');
      }
    }
  });
  // No results message
  let noRes=listEl.querySelector('.rpt-no-results');
  if(!anyVisible&&q){
    if(!noRes){noRes=document.createElement('div');noRes.className='rpt-no-results';listEl.appendChild(noRes);}
    noRes.textContent=`No results for "${q}"`;noRes.style.display='';
  } else if(noRes){noRes.style.display='none';}
}

// ── WEEKLY REVIEW ─────────────────────────────────────
const POS_ORDER=['Leader','Core','Solo','Trainee','Junior Partner +'];
function sortedByPos(reps){return [...reps].sort((a,b)=>{const ai=POS_ORDER.indexOf(a.position);const bi=POS_ORDER.indexOf(b.position);return(ai===-1?99:ai)-(bi===-1?99:bi);});}

let reviewExpensesEnabled=false;
let wrFocusPeople=[];
let wrConvs=[];
let wrNetworks=[];
let wrNetGoals=[];
let wrExpenses=[];

function showReviewForm(){
  document.getElementById('review-past-view').style.display='none';
  document.getElementById('review-form-view').style.display='flex';
  document.getElementById('new-review-btn').style.background='var(--accent)';
  renderReviewForm();
}
function showPastReviews(){
  document.getElementById('review-form-view').style.display='none';
  document.getElementById('review-past-view').style.display='flex';
  renderPastReviews();
}

function renderPastReviews(){
  const el=document.getElementById('past-reviews-list');
  if(!savedReviews.length){el.innerHTML='<div class="empty-state"><strong>No reviews yet</strong>Complete a weekly review and it will be saved here.</div>';return;}
  el.innerHTML=[...savedReviews].reverse().map((rev,i)=>`
    <div class="wr-past-card" onclick="viewSavedReview(${savedReviews.length-1-i})">
      <div class="wr-past-title">Week of ${formatWeek(rev.week||weekKey)}</div>
      <div class="wr-past-sub">Submitted ${rev.submittedAt?new Date(rev.submittedAt).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'—'} · ${(rev.focusPeople||[]).length} focus reps · ${(rev.convs||[]).length} key conversations</div>
    </div>
  `).join('');
}

function viewSavedReview(idx){
  const rev=savedReviews[idx];
  if(!rev)return;
  const el=document.getElementById('past-reviews-list');
  const pdfHtml=buildReviewPDF(rev);
  // Build an inline preview using the same PDF HTML rendered in an iframe-like container
  const previewContent=pdfHtml.replace(/^[\s\S]*<body[^>]*>/i,'').replace(/<\/body[\s\S]*$/i,'');
  el.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rlg);padding:20px 24px;box-shadow:var(--niond-shadow);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
      <div><div style="font-size:17px;font-weight:700;">Review — ${formatWeek(rev.week||weekKey)}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Submitted ${rev.submittedAt?new Date(rev.submittedAt).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'—'}</div></div>
      <div style="display:flex;gap:8px;">
        <button onclick="downloadSavedReviewPDF(${idx})" style="background:#0f766e;border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:700;padding:7px 16px;border-radius:var(--rsm);cursor:pointer;transition:opacity .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">⬇ Download PDF</button>
        <button onclick="renderPastReviews()" style="background:none;border:1px solid var(--border2);color:var(--muted);font-family:var(--font);font-size:12px;padding:6px 12px;border-radius:var(--rsm);cursor:pointer;">← Back</button>
      </div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;color:#111827;font-family:'DM Sans',sans-serif;">${previewContent}</div>
  </div>`;
}

async function downloadSavedReviewPDF(idx){
  const rev=savedReviews[idx];
  if(!rev)return;
  await ensurePdfLib();
  const pdfHtml=buildReviewPDF(rev);
  const pdfContainer=document.createElement('div');
  pdfContainer.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:DM Sans,sans-serif;';
  pdfContainer.innerHTML=pdfHtml.replace(/^[\s\S]*<body[^>]*>/i,'').replace(/<\/body[\s\S]*$/i,'');
  document.body.appendChild(pdfContainer);
  const safeManagerName=getMgrDisplay().replace(/[^a-z0-9]/gi,'_');
  const safeWeek=(rev.week||weekKey).replace(/-/g,'');
  await html2pdf().set({
    margin:[10,12,10,12],
    filename:`Weekly_Review_${safeManagerName}_${safeWeek}.pdf`,
    image:{type:'jpeg',quality:0.97},
    html2canvas:{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['avoid-all','css','legacy']}
  }).from(pdfContainer).save();
  document.body.removeChild(pdfContainer);
}

function buildReviewText(data){
  const lines=[];
  const dn=getMgrDisplay();
  lines.push(`THE BACK OFFICE — WEEKLY REVIEW`);
  lines.push(`Manager: ${dn}`);
  lines.push(`Week: ${formatWeek(data.week||weekKey)}`);
  lines.push(`Submitted: ${data.submittedAt?new Date(data.submittedAt).toLocaleString('en-GB'):'—'}`);
  lines.push('');
  lines.push('━━━ KEY PEOPLE TO FOCUS ON ━━━');
  (data.focusPeople||[]).forEach(r=>lines.push(`  • ${r.name} (${r.position||'—'})`));
  lines.push('');
  lines.push('━━━ KEY CONVERSATIONS ━━━');
  (data.convs||[]).forEach(c=>lines.push(`  • ${c.rep}: ${c.note}`));
  lines.push('');
  lines.push('━━━ LAST WEEK SUMMARY ━━━');
  lines.push(`On field: ${data.onField?'Yes':'No'}`);
  if(data.personalProduction)lines.push(`Personal Production/Sales: ${data.personalProduction}`);
  lines.push(`Production last week: ${data.productionLastWeek||'—'}`);
  lines.push('');
  lines.push('— Leader Gauges (last week):');
  lines.push(`  ${data.leaderGaugesLW||'—'}`);
  lines.push('— Trainee/Solo Gauges (last week):');
  lines.push(`  ${data.traineeGaugesLW||'—'}`);
  lines.push('');
  lines.push('━━━ THIS WEEK GOALS ━━━');
  lines.push('— Leader Gauges (goals):');
  lines.push(`  ${data.leaderGaugesGoal||'—'}`);
  lines.push('— Trainee/Solo Gauges (goals):');
  lines.push(`  ${data.traineeGaugesGoal||'—'}`);
  lines.push('');
  lines.push('━━━ RECRUITMENT ━━━');
  const rc=(k,lbl)=>lines.push(`  ${lbl}: Last week ${data[k+'LW']||'—'} | Goal this week ${data[k+'Goal']||'—'}`);
  const showPct=(b,s)=>{if(!b||!s)return'—';const pct=Math.round((Number(s)/Number(b))*100);return`${pct}%`;};
  lines.push(`  Prelims Booked: LW ${data.prelimsBookedLW||'—'} | Goal ${data.prelimsBookedGoal||'—'}`);
  lines.push(`  Prelims Showed: LW ${data.prelimsShowedLW||'—'} (${showPct(data.prelimsBookedLW,data.prelimsShowedLW)} show rate) | Goal ${data.prelimsShowedGoal||'—'}`);
  lines.push(`  2nd Interviews Booked: LW ${data.secondBookedLW||'—'} | Goal ${data.secondBookedGoal||'—'}`);
  lines.push(`  2nd Interviews Showed: LW ${data.secondShowedLW||'—'} (${showPct(data.secondBookedLW,data.secondShowedLW)} show rate) | Goal ${data.secondShowedGoal||'—'}`);
  lines.push(`  Offered Position: LW ${data.offeredLW||'—'} | Goal ${data.offeredGoal||'—'}`);
  lines.push(`  Showed First Day: LW ${data.showedDay1LW||'—'} | Goal ${data.showedDay1Goal||'—'}`);
  lines.push(`  Onboarded/Badged: LW ${data.onboardedLW||'—'} | Goal ${data.onboardedGoal||'—'}`);
  lines.push('');
  lines.push('━━━ FOCUS FOR THE WEEK ━━━');
  lines.push(data.focusText||'—');
  lines.push('');
  lines.push('━━━ NETWORKING ━━━');
  lines.push('Last week:');
  (data.networks||[]).forEach(n=>lines.push(`  • ${n.name} (${n.position||'—'}) — ${n.date||'—'}: ${n.notes||'—'}`));
  lines.push('Goals this week:');
  (data.netGoals||[]).forEach(n=>lines.push(`  • ${n.name} — ${n.day||'—'}: ${n.topic||'—'}`));
  lines.push('');
  if(data.additionalNotes){lines.push('━━━ ADDITIONAL NOTES ━━━');lines.push(data.additionalNotes);lines.push('');}
  if(data.expenses&&data.expenses.length){
    lines.push('━━━ EVENT EXPENSES ━━━');
    lines.push(`Average wire per sale: £${data.avgWire||'—'}`);
    let totalCost=0;
    data.expenses.forEach(e=>{
      const cost=parseFloat(e.cost)||0;totalCost+=cost;
      const be=data.avgWire&&cost?(cost/parseFloat(data.avgWire)).toFixed(1):'—';
      lines.push(`  • ${e.name}: £${e.cost} (breakeven: ${be} sales)`);
    });
    lines.push(`  Total event costs: £${totalCost.toFixed(2)}`);
    if(data.avgWire&&totalCost){lines.push(`  Total breakeven: ${(totalCost/parseFloat(data.avgWire)).toFixed(1)} sales`);}
  }
  return lines.join('\n');
}

function renderReviewForm(){
  wrFocusPeople=[];wrConvs=[{rep:'',note:''}];wrNetworks=[{name:'',position:'',date:'',notes:''},{name:'',position:'',date:'',notes:''},{name:'',position:'',date:'',notes:''}];wrNetGoals=[{name:'',day:'',topic:''},{name:'',day:'',topic:''}];wrExpenses=[{name:'',cost:''}];
  const active=sortedByPos(roster.filter(r=>!r.leaver));
  const wrap=document.getElementById('review-form-wrap');
  wrap.innerHTML=`
  <div style="margin-bottom:22px;">
    <div style="font-size:22px;font-weight:800;color:var(--text);letter-spacing:-.03em;margin-bottom:4px;">Weekly Review</div>
    <div style="font-size:13px;color:var(--muted);">${formatWeek(weekKey)}</div>
  </div>

  <!-- 1. Key people -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">1</div><span>Key People to Focus On</span></div>
    <div class="wr-section-body">
      <div class="wr-label" style="margin-top:0;">Select reps — tap to highlight</div>
      <div class="wr-rep-grid" id="wr-focus-grid">
        ${active.map(r=>{
          const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
          return`<div class="wr-rep-card" data-id="${r.id}" data-name="${esc(r.name)}" data-pos="${esc(r.position||'')}" onclick="toggleFocusPerson(this)">
            <div class="av av34 ${posClass(r.position||'')}" style="${avStyle(r.name,r.position)}">${ini}</div>
            <div class="wr-rep-card-name">${esc(r.name)}</div>
            ${r.position?`<span class="pos-tag ${posClass(r.position)} wr-rep-card-pos">${esc(r.position)}</span>`:''}
          </div>`;
        }).join('')}
      </div>
      <div id="wr-focus-selected" class="wr-selected-list"></div>
    </div>
  </div>

  <!-- 2. Key conversations -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">2</div><span>Key Conversations This Week</span></div>
    <div class="wr-section-body">
      <div id="wr-convs-list"></div>
      <button class="wr-add-link" onclick="addConvRow()">+ Add conversation</button>
    </div>
  </div>

  <!-- 3. Last week summary -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">3</div><span>Last Week Summary</span></div>
    <div class="wr-section-body">
      <div class="wr-label">Were you on the field this week?</div>
      <div class="wr-toggle-group" style="margin-bottom:14px;">
        <button class="wr-toggle active" id="wr-field-yes" onclick="setField(true)">Yes</button>
        <button class="wr-toggle" id="wr-field-no" onclick="setField(false)">No</button>
      </div>
      <div id="wr-personal-prod-wrap">
        <div class="wr-label">Personal production / sales</div>
        <input class="wr-input" id="wr-personalProduction" type="text" placeholder="e.g. 3 sales, 12 referrals…"/>
      </div>
      <div class="wr-label">Team production last week</div>
      <input class="wr-input" id="wr-productionLastWeek" type="text" placeholder="Overall production figure…"/>

      <div class="wr-label" style="margin-top:18px;">Leaders Gauges — last week</div>
      <input class="wr-input" id="wr-leaderGaugesLW" type="text" placeholder="Leaders Gauges — last week"/>

      <div class="wr-label">Trainee / Solo Gauges — last week</div>
      <input class="wr-input" id="wr-traineeGaugesLW" type="text" placeholder="Trainee / Solo Gauges — last week"/>
    </div>
  </div>

  <!-- 4. This week goals -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">4</div><span>Goals This Week</span></div>
    <div class="wr-section-body">
      <div class="wr-label">Leaders Gauges — goals</div>
      <input class="wr-input" id="wr-leaderGaugesGoal" type="text" placeholder="Leaders Gauges — goals"/>
      <div class="wr-label">Trainee / Solo Gauges — goals</div>
      <input class="wr-input" id="wr-traineeGaugesGoal" type="text" placeholder="Trainee / Solo Gauges — goals"/>
    </div>
  </div>

  <!-- 5. Recruitment pipeline -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">5</div><span>Recruitment Pipeline</span></div>
    <div class="wr-section-body">
      <div style="display:grid;grid-template-columns:1fr 120px 120px 80px;gap:8px;align-items:center;margin-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);">Stage</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-align:center;">Last week</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-align:center;">Goal this week</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-align:center;">Show %</div>
      </div>
      ${[
        {lbl:'Prelims Booked',lw:'prelimsBookedLW',goal:'prelimsBookedGoal',pct:false},
        {lbl:'Prelims Showed',lw:'prelimsShowedLW',goal:'prelimsShowedGoal',pct:'prelimsBookedLW'},
        {lbl:'2nd Interviews Booked',lw:'secondBookedLW',goal:'secondBookedGoal',pct:false},
        {lbl:'2nd Interviews Showed',lw:'secondShowedLW',goal:'secondShowedGoal',pct:'secondBookedLW'},
        {lbl:'Offered Position',lw:'offeredLW',goal:'offeredGoal',pct:false},
        {lbl:'Showed First Day',lw:'showedDay1LW',goal:'showedDay1Goal',pct:false},
        {lbl:'Onboarded / Badged',lw:'onboardedLW',goal:'onboardedGoal',pct:false},
      ].map(row=>`<div class="wr-stat-row">
        <div class="wr-stat-lbl">${row.lbl}</div>
        <input class="wr-input wr-stat-input" id="wr-${row.lw}" type="number" min="0" placeholder="0" ${row.pct?`oninput="calcPct('${row.pct}','${row.lw}','wr-pct-${row.lw}')"`:''}/>
        <input class="wr-input wr-stat-input" id="wr-${row.goal}" type="number" min="0" placeholder="0"/>
        ${row.pct?`<div class="wr-stat-pct" id="wr-pct-${row.lw}">—</div>`:'<div></div>'}
      </div>`).join('')}
    </div>
  </div>

  <!-- 6. Focus for the week -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">6</div><span>Focus for the Week</span></div>
    <div class="wr-section-body">
      <textarea class="wr-input" id="wr-focusText" placeholder="What's your main area of focus this week? Key priorities, themes, what needs your attention…" style="min-height:100px;"></textarea>
    </div>
  </div>

  <!-- 7. Networking -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">7</div><span>Networking</span></div>
    <div class="wr-section-body">
      <div class="wr-label">Who did you network with last week?</div>
      <div style="display:grid;grid-template-columns:1fr 100px 1fr 28px;gap:6px;margin-bottom:6px;">
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">Name</div>
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">Date</div>
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">Takeaway</div>
        <div></div>
      </div>
      <div id="wr-networks-list"></div>
      <button class="wr-add-link" onclick="addNetworkRow()">+ Add person</button>
      <div class="wr-label" style="margin-top:18px;">Networking goals this week</div>
      <div style="display:grid;grid-template-columns:1fr 100px 1fr;gap:6px;margin-bottom:6px;">
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">Who to speak to</div>
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">When</div>
        <div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;">What to discuss</div>
      </div>
      <div id="wr-netgoals-list"></div>
      <button class="wr-add-link" onclick="addNetGoalRow()">+ Add goal</button>
    </div>
  </div>

  <!-- 8. Team map snapshot -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">8</div><span>Team Map Snapshot</span></div>
    <div class="wr-section-body">
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px;">A snapshot of your current team map will be included in the PDF automatically. Preview below.</div>
      <div id="wr-map-preview-wrap">
        <div style="font-size:12px;color:var(--subtle);font-style:italic;">Map preview will appear here — make sure your team map is up to date.</div>
      </div>
      <button onclick="captureMapPreview()" style="margin-top:10px;background:none;border:1px solid var(--accent-border);color:var(--accent);font-family:var(--font);font-size:12px;font-weight:600;padding:7px 16px;border-radius:20px;cursor:pointer;transition:all .15s;" onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background='none'">↺ Refresh preview</button>
    </div>
  </div>

  <!-- 9. Additional notes -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">9</div><span>Additional Notes</span></div>
    <div class="wr-section-body">
      <textarea class="wr-input" id="wr-additionalNotes" placeholder="Anything else worth noting…" style="min-height:80px;"></textarea>
    </div>
  </div>

  <!-- 10. Campaign / events -->
  <div class="wr-section">
    <div class="wr-section-hdr"><div class="wr-num">10</div><span>Campaign &amp; Event Expenses</span></div>
    <div class="wr-section-body">
      <div id="wr-ep-attach-wrap"></div>
    </div>
  </div>

  <div style="padding:16px 0 40px;">
    <button class="wr-submit-btn" onclick="submitReview()">Submit Review &amp; Generate PDF</button>
    <div style="font-size:12px;color:var(--muted);text-align:center;margin-top:10px;">Saves locally · Generates a PDF · Emails your admin</div>
  </div>
  `;

  renderConvRows();renderNetworkRows();renderNetGoalRows();
  renderEPAttach();
  setField(true);
  // Auto-capture map preview after a short delay
  setTimeout(captureMapPreview,400);
}

let wrOnField=true;
function setField(val){
  wrOnField=val;
  document.getElementById('wr-field-yes').classList.toggle('active',val);
  document.getElementById('wr-field-no').classList.toggle('active',!val);
  const pw=document.getElementById('wr-personal-prod-wrap');
  if(pw)pw.style.display=val?'':'none';
}
function checkVenueCampaign(val){
  const sec=document.getElementById('wr-expenses-section');
  if(sec)sec.style.display=['SP Venues','Charity Venues'].includes(val)?'':'none';
}
function setExpenses(val){
  reviewExpensesEnabled=val;
  document.getElementById('wr-exp-yes').classList.toggle('active',val);
  document.getElementById('wr-exp-no').classList.toggle('active',!val);
  const det=document.getElementById('wr-expenses-detail');
  if(det)det.style.display=val?'':'none';
  if(val)renderExpenseRows();
}

function toggleFocusPerson(el){
  const id=el.dataset.id,name=el.dataset.name,pos=el.dataset.pos;
  el.classList.toggle('selected');
  if(el.classList.contains('selected')){wrFocusPeople.push({id,name,position:pos});}
  else{wrFocusPeople=wrFocusPeople.filter(x=>x.id!==id);}
  const sorted=sortedByPos(wrFocusPeople.map(x=>({...x})));
  const disp=document.getElementById('wr-focus-selected');
  if(sorted.length){
    disp.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px;">Selected (${sorted.length}):</div>`
      +sorted.map(r=>{
        const ini=(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        return`<div class="wr-selected-row">
          <div class="av av28 ${posClass(r.position||'')}" style="${avStyle(r.name,r.position)}">${ini}</div>
          <div style="flex:1;font-size:13px;font-weight:500;">${esc(r.name)}</div>
          <span class="pos-tag ${posClass(r.position)}">${esc(r.position||'—')}</span>
        </div>`;
      }).join('');
  }else{disp.innerHTML='';}
}

let wrMapSnapshot='';
function generateMapSVG(){
  // Build a self-contained SVG from sp.nodes and sp.edges — no DOM capture needed
  if(!sp.nodes||!sp.nodes.length)return'';
  const NODE_W=110,NODE_H=36;
  const pad=80;
  const xs=sp.nodes.map(n=>n.x),ys=sp.nodes.map(n=>n.y);
  const minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad;
  const maxX=Math.max(...xs)+pad,maxY=Math.max(...ys)+pad;
  const W=maxX-minX,H=maxY-minY;
  const ox=-minX,oy=-minY;
  // Position colour map (light theme values)
  const posColors={
    Trainee:{bg:'#a7ffdb',color:'#007a4d',border:'#00c97a'},
    Solo:{bg:'#ffe0a0',color:'#b85c00',border:'#f08000'},
    Leader:{bg:'#b3d4ff',color:'#1140cc',border:'#1d50ff'},
    Core:{bg:'#d4b8ff',color:'#5b1fd6',border:'#6e2ff0'},
    Junior:{bg:'#ffb8cc',color:'#c4002e',border:'#f0004d'},
    JuniorPartner:{bg:'#ffb8cc',color:'#c4002e',border:'#f0004d'},
    Manager:{bg:'#0f766e',color:'#ffffff',border:'#0d9488'},
    default:{bg:'#e9eff0',color:'#3a5050',border:'#b0c4c4'}
  };
  function getPos(pos){
    if(!pos)return posColors.default;
    const k=pos.replace(/[^a-zA-Z]/g,'');
    const cap=k.charAt(0).toUpperCase()+k.slice(1);
    return posColors[cap]||posColors.default;
  }
  // Edges
  function clipToBox(cx,cy,tx,ty){
    const hw=NODE_W/2+2,hh=NODE_H/2+2;
    const dx=tx-cx,dy=ty-cy;
    if(Math.abs(dx)<0.01&&Math.abs(dy)<0.01)return{x:cx,y:cy};
    const sx=dx===0?Infinity:hw/Math.abs(dx),sy=dy===0?Infinity:hh/Math.abs(dy);
    const s=Math.min(sx,sy);
    return{x:cx+dx*s,y:cy+dy*s};
  }
  const edgeLines=sp.edges.map(e=>{
    const a=sp.nodes.find(n=>n.id===e.a),b=sp.nodes.find(n=>n.id===e.b);
    if(!a||!b)return'';
    const p1=clipToBox(a.x,a.y,b.x,b.y),p2=clipToBox(b.x,b.y,a.x,a.y);
    return`<line x1="${(p1.x+ox).toFixed(1)}" y1="${(p1.y+oy).toFixed(1)}" x2="${(p2.x+ox).toFixed(1)}" y2="${(p2.y+oy).toFixed(1)}" stroke="rgba(15,118,110,.35)" stroke-width="1.5"/><circle cx="${(p2.x+ox).toFixed(1)}" cy="${(p2.y+oy).toFixed(1)}" r="3" fill="rgba(15,118,110,.7)"/>`;
  }).join('');
  // Nodes
  const nodeRects=sp.nodes.map(n=>{
    const c=getPos(n.position);
    const nx=(n.x+ox-NODE_W/2).toFixed(1),ny=(n.y+oy-NODE_H/2).toFixed(1);
    let lbl=n.label||'';if(lbl.length>16)lbl=lbl.slice(0,15)+'…';
    return`<g>
      <rect x="${nx}" y="${ny}" width="${NODE_W}" height="${NODE_H}" rx="4" fill="${c.bg}" stroke="${c.border}" stroke-width="1.5"/>
      <text x="${(n.x+ox).toFixed(1)}" y="${(n.y+oy+5).toFixed(1)}" text-anchor="middle" font-family="DM Sans,Arial,sans-serif" font-size="11" font-weight="600" fill="${c.color}">${lbl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>
    </g>`;
  }).join('');
  return`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#f0f3f6;border-radius:8px;font-family:DM Sans,Arial,sans-serif;">${edgeLines}${nodeRects}</svg>`;
}

async function captureMapPreview(){
  const wrap=document.getElementById('wr-map-preview-wrap');
  if(!wrap)return;
  if(!sp.nodes||!sp.nodes.length){
    wrap.innerHTML='<div style="font-size:12px;color:var(--subtle);font-style:italic;padding:8px 0;">No team map data yet — build your map on the Team Map tab first.</div>';
    wrMapSnapshot='';return;
  }
  try{
    const svgStr=generateMapSVG();
    if(!svgStr){wrap.innerHTML='<div style="font-size:12px;color:var(--subtle);font-style:italic;padding:8px 0;">Could not render map.</div>';wrMapSnapshot='';return;}
    wrMapSnapshot='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgStr)));
    wrap.innerHTML=`<img src="${wrMapSnapshot}" class="wr-map-preview" alt="Team map snapshot" style="width:100%;border-radius:8px;display:block;"/>`;
  }catch(e){
    wrap.innerHTML='<div style="font-size:12px;color:var(--subtle);font-style:italic;padding:8px 0;">Could not render map preview.</div>';
    wrMapSnapshot='';
  }
}

function renderConvRows(){
  const el=document.getElementById('wr-convs-list');if(!el)return;
  const active=roster.filter(r=>!r.leaver);
  el.innerHTML=wrConvs.map((c,i)=>`
    <div class="wr-conv-row">
      <select class="wr-input" onchange="wrConvs[${i}].rep=this.value">
        <option value="">Select rep…</option>
        ${active.map(r=>`<option value="${esc(r.name)}" ${c.rep===r.name?'selected':''}>${esc(r.name)}</option>`).join('')}
      </select>
      <input class="wr-input" type="text" placeholder="Note the conversation needed…" value="${esc(c.note)}" oninput="wrConvs[${i}].note=this.value"/>
    </div>`).join('');
}
function addConvRow(){wrConvs.push({rep:'',note:''});renderConvRows();}

function renderNetworkRows(){
  const el=document.getElementById('wr-networks-list');if(!el)return;
  el.innerHTML=wrNetworks.map((n,i)=>`
    <div class="wr-network-row">
      <input class="wr-input" type="text" placeholder="Name &amp; position" value="${esc(n.name)}" oninput="wrNetworks[${i}].name=this.value"/>
      <input class="wr-input" type="date" value="${esc(n.date)}" oninput="wrNetworks[${i}].date=this.value"/>
      <input class="wr-input" type="text" placeholder="Key takeaway" value="${esc(n.notes)}" oninput="wrNetworks[${i}].notes=this.value"/>
      <button class="wr-remove-btn" onclick="removeNetworkRow(${i})">×</button>
    </div>`).join('');
}
function addNetworkRow(){wrNetworks.push({name:'',position:'',date:'',notes:''});renderNetworkRows();}
function removeNetworkRow(i){wrNetworks.splice(i,1);renderNetworkRows();}

function renderNetGoalRows(){
  const el=document.getElementById('wr-netgoals-list');if(!el)return;
  el.innerHTML=wrNetGoals.map((n,i)=>`
    <div class="wr-goal-row" style="grid-template-columns:1fr 100px 1fr;">
      <input class="wr-input" type="text" placeholder="Who" value="${esc(n.name)}" oninput="wrNetGoals[${i}].name=this.value"/>
      <input class="wr-input" type="text" placeholder="Day" value="${esc(n.day)}" oninput="wrNetGoals[${i}].day=this.value"/>
      <input class="wr-input" type="text" placeholder="What to discuss" value="${esc(n.topic)}" oninput="wrNetGoals[${i}].topic=this.value"/>
    </div>`).join('');
}
function addNetGoalRow(){wrNetGoals.push({name:'',day:'',topic:''});renderNetGoalRows();}

function renderExpenseRows(){
  const el=document.getElementById('wr-expenses-list');if(!el)return;
  el.innerHTML=wrExpenses.map((e,i)=>`
    <div class="wr-expense-row">
      <input class="wr-input" type="text" placeholder="Event name" value="${esc(e.name)}" oninput="wrExpenses[${i}].name=this.value;recalcBreakeven()"/>
      <input class="wr-input" type="number" min="0" step="0.01" placeholder="Cost £" value="${esc(e.cost)}" oninput="wrExpenses[${i}].cost=this.value;recalcBreakeven()"/>
      <button class="wr-remove-btn" onclick="removeExpenseRow(${i})">×</button>
    </div>`).join('');
  recalcBreakeven();
}
function addExpenseRow(){wrExpenses.push({name:'',cost:''});renderExpenseRows();}
function removeExpenseRow(i){wrExpenses.splice(i,1);renderExpenseRows();}

function recalcBreakeven(){
  const avgWireEl=document.getElementById('wr-avgWire');
  const sumEl=document.getElementById('wr-breakeven-summary');
  if(!avgWireEl||!sumEl)return;
  const avgWire=parseFloat(avgWireEl.value)||0;
  const totalCost=wrExpenses.reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  if(!totalCost){sumEl.innerHTML='';return;}
  let html=`<div style="background:var(--accent-soft);border:1px solid var(--accent-border);border-radius:var(--r);padding:12px 14px;">`;
  html+=`<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Breakeven analysis</div>`;
  html+=`<div style="font-size:14px;font-weight:600;">Total event costs: £${totalCost.toFixed(2)}</div>`;
  if(avgWire){
    const totalBE=(totalCost/avgWire).toFixed(1);
    html+=`<div style="font-size:13px;color:var(--accent);margin-top:4px;">You need <strong>${totalBE} sales</strong> to break even on events</div>`;
    const perDay=(totalCost/(avgWire*5)).toFixed(1);
    html+=`<div style="font-size:12px;color:var(--muted);margin-top:2px;">(~${perDay} sales/day over a 5-day week)</div>`;
  }
  html+=`</div>`;
  sumEl.innerHTML=html;
}

function calcPct(bookedId,showedId,pctElId){
  const b=parseFloat(document.getElementById('wr-'+bookedId)?.value)||0;
  const s=parseFloat(document.getElementById('wr-'+showedId)?.value)||0;
  const el=document.getElementById(pctElId);
  if(el)el.textContent=b?Math.round((s/b)*100)+'%':'—';
}

async function submitReview(){
  const btn=document.querySelector('.wr-submit-btn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Generating PDF…';
  const g=id=>(document.getElementById(id)||{value:''}).value;
  const data={
    week:weekKey,submittedAt:new Date().toISOString(),
    focusPeople:[...wrFocusPeople],
    convs:wrConvs.filter(c=>c.rep||c.note),
    onField:wrOnField,
    personalProduction:wrOnField?g('wr-personalProduction'):'',
    productionLastWeek:g('wr-productionLastWeek'),
    leaderGaugesLW:g('wr-leaderGaugesLW'),
    traineeGaugesLW:g('wr-traineeGaugesLW'),
    leaderGaugesGoal:g('wr-leaderGaugesGoal'),
    traineeGaugesGoal:g('wr-traineeGaugesGoal'),
    prelimsBookedLW:g('wr-prelimsBookedLW'),prelimsBookedGoal:g('wr-prelimsBookedGoal'),
    prelimsShowedLW:g('wr-prelimsShowedLW'),prelimsShowedGoal:g('wr-prelimsShowedGoal'),
    secondBookedLW:g('wr-secondBookedLW'),secondBookedGoal:g('wr-secondBookedGoal'),
    secondShowedLW:g('wr-secondShowedLW'),secondShowedGoal:g('wr-secondShowedGoal'),
    offeredLW:g('wr-offeredLW'),offeredGoal:g('wr-offeredGoal'),
    showedDay1LW:g('wr-showedDay1LW'),showedDay1Goal:g('wr-showedDay1Goal'),
    onboardedLW:g('wr-onboardedLW'),onboardedGoal:g('wr-onboardedGoal'),
    focusText:g('wr-focusText'),
    networks:wrNetworks.filter(n=>n.name),
    netGoals:wrNetGoals.filter(n=>n.name),
    additionalNotes:g('wr-additionalNotes'),
    expenses:epAttachEnabled?epEvents.filter(e=>e.name):[],
    avgWire:epAttachEnabled&&epAvgWire?String(epAvgWire):'',
    mapSnapshot:wrMapSnapshot,
    mapData:JSON.stringify({nodes:sp.nodes,edges:sp.edges})
  };

  // Always regenerate map SVG fresh at submit time for best quality
  const freshSvg=generateMapSVG();
  if(freshSvg){
    data.mapSnapshot='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(freshSvg)));
    data.mapSVG=freshSvg;
  } else if(!wrMapSnapshot){
    await captureMapPreview();
    data.mapSnapshot=wrMapSnapshot;
  }

  // Save locally in memory
  savedReviews.push(data);

  // Generate PDF HTML
  const pdfHtml=buildReviewPDF(data);

  // Build a hidden element and use html2pdf to download directly
  btn.innerHTML='<span class="spinner"></span>Building PDF…';
  await ensurePdfLib();
  const pdfContainer=document.createElement('div');
  pdfContainer.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:DM Sans,sans-serif;';
  pdfContainer.innerHTML=pdfHtml.replace(/^[\s\S]*<body[^>]*>/i,'').replace(/<\/body[\s\S]*$/i,'');
  document.body.appendChild(pdfContainer);
  const safeManagerName=getMgrDisplay().replace(/[^a-z0-9]/gi,'_');
  const safeWeek=(data.week||weekKey).replace(/-/g,'');
  await html2pdf().set({
    margin:[10,12,10,12],
    filename:`Weekly_Review_${safeManagerName}_${safeWeek}.pdf`,
    image:{type:'jpeg',quality:0.97},
    html2canvas:{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['avoid-all','css','legacy']}
  }).from(pdfContainer).save();
  document.body.removeChild(pdfContainer);

  // Try to save to sheet + email admin
  try{
    btn.innerHTML='<span class="spinner"></span>Sending…';
    await api({action:'saveWeeklyReview',manager:managerName,week:data.week||weekKey,id:'wr'+Date.now(),reviewData:{...data,pdfHtml}});
  }catch(e){/* sheet may not have this action yet */}

  btn.disabled=false;btn.textContent='Submit Review & Generate PDF';
  showToast('Review saved ✓ PDF generated','success');
  document.getElementById('review-form-wrap').innerHTML=`
    <div style="text-align:center;padding:60px 20px;">
      <div style="margin-bottom:16px;color:#16a34a;">${SVG.check.replace('width="18" height="18"','width="44" height="44"')}</div>
      <div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em;margin-bottom:6px;">Review submitted!</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">Your PDF has been downloaded automatically.</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:28px;">It's also saved in Past Reviews for you to look back on.</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button onclick="showPastReviews()" style="background:#0f766e;border:none;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;padding:11px 24px;border-radius:20px;cursor:pointer;transition:opacity .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">View past reviews</button>
        <button onclick="renderReviewForm()" style="background:none;border:1px solid var(--border2);color:var(--muted);font-family:var(--font);font-size:13px;padding:11px 24px;border-radius:20px;cursor:pointer;">Start new review</button>
      </div>
    </div>`;
}

function buildReviewPDF(data){
  const dn=getMgrDisplay();
  const wk=formatWeek(data.week||weekKey);
  const submitted=data.submittedAt?new Date(data.submittedAt).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'—';
  const showPct=(b,s)=>{if(!b||!s)return'';const p=Math.round((Number(s)/Number(b))*100);return` <span style="color:#0f766e;">(${p}%)</span>`;};
  const tblRow=(lbl,lw,goal,booked)=>`<tr><td style="padding:7px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${lbl}</td><td style="padding:7px 12px;text-align:center;font-size:12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${lw||'—'}</td><td style="padding:7px 12px;text-align:center;font-size:12px;font-weight:600;color:#0f766e;border-bottom:1px solid #f3f4f6;">${goal||'—'}${booked?showPct(booked,lw):''}</td></tr>`;

  // section helper — clean white card, light grey header bar
  const sec=(title,content)=>`<div style="margin-bottom:16px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#f9fafb;padding:9px 14px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;">${title}</div>
    </div>
    <div style="padding:14px;background:#fff;">${content}</div>
  </div>`;

  const focusHtml=(data.focusPeople||[]).map(r=>`<span style="display:inline-flex;align-items:center;gap:6px;background:#f3f4f6;border-radius:20px;padding:4px 10px 4px 5px;margin:3px;">
    <span style="width:22px;height:22px;border-radius:50%;background:#0f766e;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;">${(r.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</span>
    <span style="font-size:12px;font-weight:600;color:#111827;">${esc(r.name)}</span>
    ${r.position?`<span style="font-size:10px;color:#9ca3af;">${esc(r.position)}</span>`:''}
  </span>`).join('');

  const convsHtml=(data.convs||[]).filter(c=>c.rep||c.note).map(c=>`<div style="padding:8px 10px;border-left:2px solid #e5e7eb;margin-bottom:6px;">
    <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:2px;">${esc(c.rep||'—')}</div>
    <div style="font-size:12px;color:#6b7280;">${esc(c.note||'')}</div>
  </div>`).join('');

  const netHtml=(data.networks||[]).map(n=>`<tr>
    <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">${esc(n.name)}</td>
    <td style="padding:6px 10px;font-size:12px;color:#9ca3af;border-bottom:1px solid #f3f4f6;">${esc(n.date||'')}</td>
    <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">${esc(n.notes||'')}</td>
  </tr>`).join('');

  const netGoalHtml=(data.netGoals||[]).map(n=>`<tr>
    <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">${esc(n.name)}</td>
    <td style="padding:6px 10px;font-size:12px;color:#9ca3af;border-bottom:1px solid #f3f4f6;">${esc(n.day||'')}</td>
    <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">${esc(n.topic||'')}</td>
  </tr>`).join('');

  const expHtml=data.expenses&&data.expenses.length?data.expenses.map(e=>`<tr>
    <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">${esc(e.name)}</td>
    <td style="padding:6px 10px;font-size:12px;font-weight:600;border-bottom:1px solid #f3f4f6;">£${esc(e.cost)}</td>
  </tr>`).join(''):'';

  const tblWrap=(head,body)=>`<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;">${head}</tr></thead><tbody>${body}</tbody></table>`;
  const th=t=>`<th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">${t}</th>`;

  // two-col info row helper
  const infoGrid=(items)=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${items.map(([lbl,val])=>val?`<div><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">${lbl}</div><div style="font-size:13px;color:#111827;">${val}</div></div>`:'').join('')}</div>`;

  return`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Weekly Review — ${esc(dn)} — ${wk}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#fff;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@page{size:A4;margin:14mm 16mm;}
@media print{body{background:#fff;}}
.page{max-width:720px;margin:0 auto;padding:24px;}
</style>
</head><body><div class="page">

  <!-- Header — single dark bar, no colour noise -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;margin-bottom:20px;border-bottom:2px solid #111827;">
    <div>
      <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px;">The Back Office · Weekly Review</div>
      <div style="font-size:24px;font-weight:800;color:#111827;letter-spacing:-.03em;">${esc(dn)}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:3px;">${wk}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#9ca3af;">Submitted</div>
      <div style="font-size:12px;font-weight:600;color:#374151;margin-top:2px;">${submitted}</div>
      ${data.campaign?`<div style="margin-top:6px;background:#f3f4f6;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:#374151;display:inline-block;">${esc(data.campaign)}</div>`:''}
    </div>
  </div>

  <!-- Summary row — plain grey tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
    ${[
      ['Focus Reps',(data.focusPeople||[]).length],
      ['Key Convos',(data.convs||[]).filter(c=>c.rep||c.note).length],
      ['Team Production',data.productionLastWeek||'—'],
      ['On Field',data.onField?'Yes':'No']
    ].map(([lbl,val])=>`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:11px 12px;text-align:center;">
      <div style="font-size:18px;font-weight:800;color:#111827;">${val}</div>
      <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.07em;margin-top:3px;">${lbl}</div>
    </div>`).join('')}
  </div>

  ${focusHtml?sec('Key People to Focus On',`<div style="display:flex;flex-wrap:wrap;gap:2px;">${focusHtml}</div>`):''}
  ${convsHtml?sec('Key Conversations',convsHtml):''}

  ${sec('Last Week Summary',`
    ${data.onField&&data.personalProduction?`<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Personal production</div><div style="font-size:13px;font-weight:600;">${esc(data.personalProduction)}</div></div>`:''}
    ${infoGrid([
      ['Leaders Gauges',data.leaderGaugesLW],
      ['Trainee / Solo Gauges',data.traineeGaugesLW],
    ])}
  `)}

  ${sec('Goals This Week',infoGrid([
    ['Leaders Gauges',data.leaderGaugesGoal],
    ['Trainee / Solo Gauges',data.traineeGaugesGoal],
  ]))}

  ${sec('Recruitment Pipeline',tblWrap(
    [th('Stage'),th('Last Week'),th('Goal')].join(''),
    [
      tblRow('Prelims Booked',data.prelimsBookedLW,data.prelimsBookedGoal),
      tblRow('Prelims Showed',data.prelimsShowedLW,data.prelimsShowedGoal,data.prelimsBookedLW),
      tblRow('2nd Interviews Booked',data.secondBookedLW,data.secondBookedGoal),
      tblRow('2nd Interviews Showed',data.secondShowedLW,data.secondShowedGoal,data.secondBookedLW),
      tblRow('Offered Position',data.offeredLW,data.offeredGoal),
      tblRow('Showed First Day',data.showedDay1LW,data.showedDay1Goal),
      tblRow('Onboarded / Badged',data.onboardedLW,data.onboardedGoal),
    ].join('')
  ))}

  ${data.focusText?sec('Focus for the Week',`<div style="font-size:13px;line-height:1.7;color:#374151;white-space:pre-wrap;">${esc(data.focusText)}</div>`):''}

  ${netHtml?sec('Networking — Last Week',tblWrap([th('Name'),th('Date'),th('Takeaway')].join(''),netHtml)):''}
  ${netGoalHtml?sec('Networking Goals This Week',tblWrap([th('Who'),th('When'),th('Topic')].join(''),netGoalHtml)):''}
  ${data.additionalNotes?sec('Additional Notes',`<div style="font-size:13px;line-height:1.7;color:#374151;white-space:pre-wrap;">${esc(data.additionalNotes)}</div>`):''}
  ${expHtml?sec('Event Expenses',tblWrap([th('Event'),th('Cost')].join(''),expHtml)+(data.avgWire?`<div style="margin-top:10px;font-size:12px;color:#6b7280;">Avg wire per sale: <strong>£${data.avgWire}</strong></div>`:'')):''}

  ${(data.mapSVG||(data.mapSnapshot&&data.mapSnapshot.startsWith('data:')))?sec('Team Map', data.mapSVG ? `<div style="width:100%;overflow:hidden;border-radius:6px;border:1px solid #e5e7eb;">${data.mapSVG}</div>` : `<img src="${data.mapSnapshot}" style="width:100%;border-radius:6px;border:1px solid #e5e7eb;display:block;" alt="Team Map"/>`):''}

  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#d1d5db;">The Back Office · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
    <div style="font-size:10px;color:#d1d5db;">${esc(dn)}</div>
  </div>
</div></body></html>`;
}

// ── CALENDAR ──────────────────────────────────────────
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let editingEvent=null,editingDate=null;
let selectedDay=fmtDate(new Date());

function calPrev(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function calNext(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();}
function calToday(){calYear=new Date().getFullYear();calMonth=new Date().getMonth();selectedDay=fmtDate(new Date());renderCalendar();}

function renderCalendar(){
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_FULL=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAYS_MINI=['M','T','W','T','F','S','S'];
  const today=fmtDate(new Date());
  if(!selectedDay)selectedDay=today;

  // ── Topbar sub ──
  const topSub=document.getElementById('cal-topbar-sub');
  if(topSub)topSub.textContent=`${MONTHS[calMonth]} ${calYear}`;

  // ── Main grid month label ──
  const lbl=document.getElementById('cal-month-lbl');
  if(lbl)lbl.textContent=`${MONTHS[calMonth]} ${calYear}`;

  // ── Build cells ──
  const first=new Date(calYear,calMonth,1);
  const startDow=first.getDay()===0?6:first.getDay()-1;
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const prevDays=new Date(calYear,calMonth,0).getDate();
  const cells=[];
  for(let i=startDow-1;i>=0;i--)cells.push({date:fmtDate(new Date(calYear,calMonth-1,prevDays-i)),other:true});
  for(let d=1;d<=daysInMonth;d++)cells.push({date:fmtDate(new Date(calYear,calMonth,d)),other:false});
  let nd=1;while(cells.length%7!==0)cells.push({date:fmtDate(new Date(calYear,calMonth+1,nd++)),other:true});

  // ── Main calendar grid ──
  const CAT_BG={personal:'#dbeafe',work:'#dcfce7',team:'#fce7f3',reminder:'#fef9c3',admin:'#f0fdfa',orange:'#ffedd5',rose:'#ffe4e6',cyan:'#cffafe'};
  const CAT_TXT={personal:'#1d4ed8',work:'#15803d',team:'#be185d',reminder:'#92400e',admin:'#0f766e',orange:'#c2410c',rose:'#be123c',cyan:'#0e7490'};

  const grid=document.getElementById('cal-grid');
  grid.innerHTML=DAYS_FULL.map(d=>`<div class="cal-day-hdr">${d}</div>`).join('')+
  cells.map(c=>{
    const evs=calEvents.filter(e=>e.date===c.date);
    const isToday=c.date===today;
    const isSel=c.date===selectedDay;
    const evHtml=evs.slice(0,3).map(e=>{
      const col=CAT_COLORS[e.category||'personal']||'#2563ff';
      const bg=CAT_BG[e.category||'personal']||'#dbeafe';
      const txt=CAT_TXT[e.category||'personal']||'#1d4ed8';
      return`<div class="cal-event" style="background:${bg};color:${txt};" onclick="openEditEvent(event,'${e.id}')" title="${esc(e.title)}">${esc(e.title)}</div>`;
    }).join('');
    const moreHtml=evs.length>3?`<div class="cal-more">+${evs.length-3} more</div>`:'';
    return`<div class="cal-cell ${c.other?'other-month':''} ${isToday?'today':''} ${isSel&&!isToday?'selected-day':''}" onclick="selectCalDay('${c.date}')">
      <div class="cal-date">${parseInt(c.date.split('-')[2])}</div>
      ${evHtml}${moreHtml}
      <button class="cal-add-btn" onclick="event.stopPropagation();openNewEvent('${c.date}')">+</button>
    </div>`;
  }).join('');

  // ── Mini calendar ──
  renderMiniCal();

  // ── Events sidebar ──
  renderEventsList();
}

function renderMiniCal(){
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_MINI=['M','T','W','T','F','S','S'];
  const today=fmtDate(new Date());
  const lbl=document.getElementById('mini-cal-lbl');
  if(lbl)lbl.textContent=`${MONTHS[calMonth]} ${calYear}`;
  const first=new Date(calYear,calMonth,1);
  const startDow=first.getDay()===0?6:first.getDay()-1;
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const prevDays=new Date(calYear,calMonth,0).getDate();
  const cells=[];
  for(let i=startDow-1;i>=0;i--)cells.push({date:fmtDate(new Date(calYear,calMonth-1,prevDays-i)),other:true});
  for(let d=1;d<=daysInMonth;d++)cells.push({date:fmtDate(new Date(calYear,calMonth,d)),other:false});
  let nd2=1;while(cells.length%7!==0)cells.push({date:fmtDate(new Date(calYear,calMonth+1,nd2++)),other:true});
  const grid=document.getElementById('mini-cal-grid');
  if(!grid)return;
  grid.innerHTML=
    DAYS_MINI.map(d=>`<div class="mini-day-hdr">${d}</div>`).join('')+
    cells.map(c=>{
      const isT=c.date===today;
      const isSel=c.date===selectedDay;
      const hasEv=calEvents.some(e=>e.date===c.date);
      const cls=[
        c.other?'other-month':'this-month',
        isT?'today':'',
        isSel&&!isT?'selected':'',
        hasEv&&!isT?'has-dot':''
      ].filter(Boolean).join(' ');
      return`<div class="mini-cell ${cls}" onclick="selectCalDay('${c.date}')">${parseInt(c.date.split('-')[2])}</div>`;
    }).join('');
}

function renderEventsList(){
  const today=fmtDate(new Date());
  const day=selectedDay||today;
  const titleEl=document.getElementById('events-card-title');
  const dateEl=document.getElementById('events-card-date');
  const listEl=document.getElementById('events-list');
  if(!listEl)return;

  const isToday=day===today;
  const d=parseDate(day);
  const dayLabel=isToday?'Today':d?d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}):'';
  if(titleEl)titleEl.textContent=isToday?"Today's Events":"Events";
  if(dateEl)dateEl.textContent=dayLabel;

  const evs=calEvents.filter(e=>e.date===day);
  if(!evs.length){
    listEl.innerHTML='<div class="event-list-empty">No events this day.<br><span style="font-size:11px;">Click + to add one.</span></div>';
    return;
  }
  listEl.innerHTML=evs.map(e=>{
    const col=CAT_COLORS[e.category||'personal']||'#2563ff';
    return`<div class="event-list-row" onclick="openEditEvent(event,'${e.id}')">
      <div class="event-list-dot" style="background:${col};"></div>
      <div style="flex:1;min-width:0;">
        <div class="event-list-title">${esc(e.title)}</div>
        ${e.time?`<div class="event-list-time">${esc(e.time)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function selectCalDay(date){
  selectedDay=date;
  // If date is in a different month, navigate there
  const parts=date.split('-');
  const y=parseInt(parts[0]),m=parseInt(parts[1])-1;
  if(y!==calYear||m!==calMonth){calYear=y;calMonth=m;}
  renderCalendar();
}

function openNewEvent(date){editingEvent=null;editingDate=date;document.getElementById('ev-title').value='';document.getElementById('event-modal-title').textContent=`Add event — ${date}`;document.getElementById('ev-delete-btn').style.display='none';document.querySelectorAll('.colour-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.cat==='personal'));updateCatLabel('personal');document.getElementById('event-modal').style.display='flex';setTimeout(()=>document.getElementById('ev-title').focus(),100);}
function openEditEvent(ev,id){ev.stopPropagation();const event=calEvents.find(e=>e.id===id);if(!event)return;editingEvent=id;editingDate=event.date;document.getElementById('ev-title').value=event.title;document.getElementById('event-modal-title').textContent='Edit event';document.getElementById('ev-delete-btn').style.display='';document.querySelectorAll('.colour-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.cat===(event.category||'personal')));updateCatLabel(event.category||'personal');document.getElementById('event-modal').style.display='flex';setTimeout(()=>document.getElementById('ev-title').focus(),100);}
function selectCat(el,cat){document.querySelectorAll('.colour-swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected');updateCatLabel(cat);}
function updateCatLabel(cat){document.getElementById('ev-cat-lbl').textContent=CAT_NAMES[cat]||cat;}
function getSelectedCat(){const s=document.querySelector('.colour-swatch.selected');return s?s.dataset.cat:'personal';}
async function saveEvent(){
  const title=document.getElementById('ev-title').value.trim();
  if(!title){showToast('Add a title','error');return;}
  const cat=getSelectedCat();
  if(editingEvent){
    const ev=calEvents.find(e=>e.id===editingEvent);
    if(ev){ev.title=title;ev.category=cat;}
    closeEventModal();renderCalendar();
    try{await api({action:'saveCalEvent',manager:managerName,event:{...ev,title,category:cat}});showToast('Event saved ✓','success');}
    catch(e){showToast('Saved locally — sheet sync failed','error');}
  }else{
    const ev={id:'ev'+Date.now(),date:editingDate,title,category:cat,manager:managerName,pushedAt:new Date().toISOString(),recurring:false};
    calEvents.push(ev);closeEventModal();renderCalendar();
    try{await api({action:'saveCalEvent',manager:managerName,event:ev});showToast('Event saved ✓','success');}
    catch(e){showToast('Saved locally — sheet sync failed','error');}
  }
}
async function deleteEvent(){
  const id=editingEvent;
  calEvents=calEvents.filter(e=>e.id!==id);
  closeEventModal();renderCalendar();
  try{await api({action:'deleteCalEvent',id,manager:managerName});}catch(e){}
}
function closeEventModal(){document.getElementById('event-modal').style.display='none';}

// ── MAP ───────────────────────────────────────────────
const NODE_W=140,NODE_H=44;
let sp={nodes:[],edges:[]},addPanelTargetId=null;
let mapPan={x:40,y:40},mapScale=1,mapDrag=false,mapDS={x:0,y:0},mapPS={x:0,y:0};
function applyTransform(){const s=document.getElementById('map-stage');if(s)s.style.transform=`translate(${mapPan.x}px,${mapPan.y}px) scale(${mapScale})`;}
function resetZoom(){mapPan={x:40,y:40};mapScale=1;applyTransform();}
function initMapPan(){const wrap=document.getElementById('map-stage-wrap');if(!wrap||wrap._pi)return;wrap._pi=true;wrap.addEventListener('mousedown',e=>{if(e.target.closest('button')||e.target.closest('.map-node'))return;mapDrag=true;mapDS={x:e.clientX,y:e.clientY};mapPS={x:mapPan.x,y:mapPan.y};wrap.style.cursor='grabbing';e.preventDefault();});document.addEventListener('mousemove',e=>{if(!mapDrag)return;mapPan.x=mapPS.x+(e.clientX-mapDS.x);mapPan.y=mapPS.y+(e.clientY-mapDS.y);applyTransform();});document.addEventListener('mouseup',()=>{if(mapDrag){mapDrag=false;const w=document.getElementById('map-stage-wrap');if(w)w.style.cursor='grab';}});wrap.addEventListener('wheel',e=>{e.preventDefault();mapScale=Math.min(Math.max(mapScale*(e.deltaY>0?0.9:1.1),.3),2.5);applyTransform();},{passive:false});let tp=null;wrap.addEventListener('touchstart',e=>{if(e.touches.length===1)tp={x:e.touches[0].clientX,y:e.touches[0].clientY,px:mapPan.x,py:mapPan.y};},{passive:true});wrap.addEventListener('touchmove',e=>{if(tp&&e.touches.length===1){mapPan.x=tp.px+(e.touches[0].clientX-tp.x);mapPan.y=tp.py+(e.touches[0].clientY-tp.y);applyTransform();}},{passive:false});wrap.addEventListener('touchend',()=>{tp=null;});}
function rebuildMap(){
  sp.nodes=[];sp.edges=[];
  const CX=500,CY=420;
  sp.nodes.push({id:'mgr',label:getMgrDisplay(),position:'Manager',x:CX,y:CY});
  const active=roster.filter(r=>!r.leaver&&r.leader);
  active.forEach(r=>sp.nodes.push({id:r.id,label:r.name,position:r.position||'default',x:0,y:0}));
  active.forEach(r=>{const pid=r.leader==='__mgr__'?'mgr':r.leader;if(sp.nodes.find(n=>n.id===pid))sp.edges.push({a:pid,b:r.id});});
  applyRadialLayout(CX,CY);
  renderSpider();renderLegend();
  scheduleMapSave();
}
function applyRadialLayout(CX,CY){
  // Build children map
  const children={};
  sp.nodes.forEach(n=>{children[n.id]=[];});
  sp.edges.forEach(e=>{if(children[e.a])children[e.a].push(e.b);});

  // BFS to assign depths
  const depths={mgr:0};const q=['mgr'];
  while(q.length){const id=q.shift();(children[id]||[]).forEach(cid=>{if(!(cid in depths)){depths[cid]=(depths[id]||0)+1;q.push(cid);}});}
  sp.nodes.forEach(n=>{if(!(n.id in depths))depths[n.id]=1;});

  // Count nodes per depth ring so we can size radii dynamically
  const nodesAtDepth={};
  sp.nodes.forEach(n=>{const d=depths[n.id]||0;nodesAtDepth[d]=(nodesAtDepth[d]||0)+1;});

  // Dynamic radius: large enough that nodes at this ring don't overlap
  // Nodes are ~110px wide; add 30px gap between them
  const MIN_NODE_ARC=140;
  function getDynamicRadius(depth){
    const count=nodesAtDepth[depth]||1;
    const minR=(count*MIN_NODE_ARC)/(2*Math.PI);
    const baseR=depth*210;
    return Math.max(minR,baseR,200);
  }

  // Subtree size for proportional arc allocation
  function subtreeSize(id){return 1+(children[id]||[]).reduce((s,c)=>s+subtreeSize(c),0);}

  // Place manager at centre
  const mgr=sp.nodes.find(n=>n.id==='mgr');if(mgr){mgr.x=CX;mgr.y=CY;}

  // Recursively place children, enforcing a minimum arc per node
  function placeChildren(parentId,arcStart,arcEnd,depth){
    const kids=(children[parentId]||[]);
    if(!kids.length)return;
    const r=getDynamicRadius(depth);
    const available=arcEnd-arcStart;
    const totalSize=kids.reduce((s,k)=>s+subtreeSize(k),0);
    const minArc=MIN_NODE_ARC/r; // min arc in radians for one node at this radius
    // Give each kid proportional arc but at least minArc
    const rawArcs=kids.map(kid=>Math.max((available*subtreeSize(kid)/totalSize),minArc));
    const totalRaw=rawArcs.reduce((s,a)=>s+a,0);
    const scale=totalRaw>available?available/totalRaw:1;
    let cursor=arcStart;
    kids.forEach((kid,i)=>{
      const kidArc=rawArcs[i]*scale;
      const midAngle=cursor+kidArc/2;
      const node=sp.nodes.find(n=>n.id===kid);
      if(node){node.x=CX+r*Math.cos(midAngle);node.y=CY+r*Math.sin(midAngle);}
      placeChildren(kid,cursor,cursor+kidArc,depth+1);
      cursor+=kidArc;
    });
  }
  placeChildren('mgr',-Math.PI/2,-Math.PI/2+Math.PI*2,1);

  // Orphans fallback
  const placed=new Set(sp.nodes.filter(n=>n.x!==0||n.y!==0||n.id==='mgr').map(n=>n.id));
  sp.nodes.filter(n=>!placed.has(n.id)).forEach((n,i)=>{n.x=CX+260*Math.cos(i*1.2);n.y=CY+260*Math.sin(i*1.2);});

  // Repulsion pass: push any still-overlapping nodes apart (30 iterations max)
  const REPEL=135,STRENGTH=0.45;
  for(let iter=0;iter<30;iter++){
    let moved=false;
    for(let i=0;i<sp.nodes.length;i++){
      for(let j=i+1;j<sp.nodes.length;j++){
        const a=sp.nodes[i],b=sp.nodes[j];
        if(a.id==='mgr'||b.id==='mgr')continue;
        const dx=b.x-a.x,dy=b.y-a.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<REPEL&&dist>0.01){
          const force=(REPEL-dist)*STRENGTH;
          const nx=dx/dist,ny=dy/dist;
          a.x-=nx*force*0.5;a.y-=ny*force*0.5;
          b.x+=nx*force*0.5;b.y+=ny*force*0.5;
          moved=true;
        }
      }
    }
    if(!moved)break;
  }
}
function renderLegend(){const pos=[...new Set(roster.filter(r=>!r.leaver).map(r=>r.position).filter(Boolean))];document.getElementById('spider-legend').innerHTML=[['Manager','Manager'],...pos.map(p=>[p,p])].map(([p,l])=>{return`<span class="pos-tag ${posClass(p)}" style="font-size:10px;">${esc(l)}</span>`;}).join('');}
function renderSpider(){renderEdges();renderNodes();}
function renderEdges(){const svg=document.getElementById('spider-svg');if(!svg)return;const pad=NODE_W+80;const xs=sp.nodes.map(n=>n.x),ys=sp.nodes.map(n=>n.y);const minX=xs.length?Math.min(...xs)-pad:0,minY=ys.length?Math.min(...ys)-pad:0;const maxX=xs.length?Math.max(...xs)+pad:800,maxY=ys.length?Math.max(...ys)+pad:600;const offX=-Math.min(minX,0),offY=-Math.min(minY,0);const w=maxX+offX,h=maxY+offY;svg.style.width=w+'px';svg.style.height=h+'px';svg.dataset.offx=offX;svg.dataset.offy=offY;sp.nodes.forEach(n=>{const el=document.getElementById('spider-node-'+n.id);if(el){el.style.left=(n.x+offX-NODE_W/2)+'px';el.style.top=(n.y+offY-NODE_H/2)+'px';}});const ec=isDark()?'rgba(255,255,255,.18)':'rgba(15,118,110,.28)';const ed=isDark()?'rgba(255,255,255,.4)':'rgba(15,118,110,.7)';function clipToBox(cx,cy,tx,ty){const hw=NODE_W/2+2,hh=NODE_H/2+2;const dx=tx-cx,dy=ty-cy;if(Math.abs(dx)<0.01&&Math.abs(dy)<0.01)return{x:cx,y:cy};const sx=dx===0?Infinity:hw/Math.abs(dx),sy=dy===0?Infinity:hh/Math.abs(dy);const s=Math.min(sx,sy);return{x:cx+dx*s,y:cy+dy*s};}svg.innerHTML=sp.edges.map(e=>{const a=sp.nodes.find(n=>n.id===e.a),b=sp.nodes.find(n=>n.id===e.b);if(!a||!b)return'';const p1=clipToBox(a.x,a.y,b.x,b.y),p2=clipToBox(b.x,b.y,a.x,a.y);const x1=p1.x+offX,y1=p1.y+offY,x2=p2.x+offX,y2=p2.y+offY;return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ec}" stroke-width="1.5"/><circle cx="${x2}" cy="${y2}" r="3" fill="${ed}"/>`;}).join('');}
function renderNodes(){const container=document.getElementById('spider-nodes');if(!container)return;container.innerHTML='';const svg=document.getElementById('spider-svg');const offX=svg?parseFloat(svg.dataset.offx||0):0,offY=svg?parseFloat(svg.dataset.offy||0):0;sp.nodes.forEach(n=>{const el=document.createElement('div');el.id='spider-node-'+n.id;el.className='map-node '+posClass(n.position||'');el.style.cssText=`position:absolute;left:${n.x+offX-NODE_W/2}px;top:${n.y+offY-NODE_H/2}px;width:${NODE_W}px;height:${NODE_H}px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:var(--font);font-size:12px;font-weight:500;cursor:grab;user-select:none;box-shadow:var(--niond-shadow);`;let lbl=n.label;if(lbl.length>16)lbl=lbl.slice(0,15)+'…';el.innerHTML=`<span style="padding:0 22px 0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:center;">${esc(lbl)}</span>`;const rb=document.createElement('button');rb.textContent='×';rb.style.cssText=`position:absolute;top:-8px;right:-8px;width:18px;height:18px;background:var(--surface);border:1px solid var(--border2);color:var(--muted);border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;`;rb.onmouseenter=()=>{rb.style.background='#fee2e2';rb.style.color='var(--danger)';};rb.onmouseleave=()=>{rb.style.background='var(--surface)';rb.style.color='var(--muted)';};rb.addEventListener('click',ev=>{ev.stopPropagation();sp.nodes=sp.nodes.filter(x=>x.id!==n.id);sp.edges=sp.edges.filter(e=>e.a!==n.id&&e.b!==n.id);renderSpider();});el.appendChild(rb);const ab=document.createElement('button');ab.textContent='+';ab.style.cssText=`position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:20px;height:20px;background:var(--accent);border:none;color:#fff;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 1px 4px rgba(0,0,0,.2);z-index:10;`;ab.addEventListener('click',ev=>{ev.stopPropagation();openAddPanel(n,ev);});el.appendChild(ab);let drag=false,sx,sy,ox,oy;el.addEventListener('mousedown',ev=>{if(ev.target===rb||ev.target===ab)return;drag=true;sx=ev.clientX;sy=ev.clientY;ox=n.x;oy=n.y;el.style.cursor='grabbing';el.style.zIndex=100;ev.stopPropagation();ev.preventDefault();});document.addEventListener('mousemove',ev=>{if(!drag)return;n.x=ox+(ev.clientX-sx)/mapScale;n.y=oy+(ev.clientY-sy)/mapScale;el.style.left=(n.x-NODE_W/2)+'px';el.style.top=(n.y-NODE_H/2)+'px';renderEdges();});document.addEventListener('mouseup',()=>{if(!drag)return;drag=false;el.style.cursor='grab';el.style.zIndex='';scheduleMapSave();});container.appendChild(el);});}
function openAddPanel(pn,ev){addPanelTargetId=pn.id;const panel=document.getElementById('spider-add-panel');const onMap=new Set(sp.nodes.map(n=>n.id));const av=roster.filter(r=>!r.leaver&&!onMap.has(r.id));document.getElementById('spider-panel-label').textContent=`Add report to ${pn.label}`;const list=document.getElementById('spider-panel-list');if(!av.length){list.innerHTML='<div style="font-size:12px;color:var(--muted);">All active reps on map.</div>';}else{list.innerHTML=av.map(r=>{return`<button class="${posClass(r.position||'')}" onclick="addMapNode('${r.id}')" style="font-family:var(--font);font-size:12px;font-weight:500;padding:7px 10px;border-radius:4px;cursor:pointer;text-align:left;width:100%;border-width:1px;border-style:solid;">${esc(r.name)} <span style="opacity:.6;">${esc(r.position||'—')}</span></button>`;}).join('');}const br=ev.target.getBoundingClientRect();panel.style.left=Math.min(br.left,window.innerWidth-230)+'px';panel.style.top=(br.bottom+8)+'px';panel.style.display='block';setTimeout(()=>document.addEventListener('click',outsideClick,{once:true}),0);}
function outsideClick(ev){const p=document.getElementById('spider-add-panel');if(!p.contains(ev.target))closeAddPanel();else document.addEventListener('click',outsideClick,{once:true});}
function closeAddPanel(){document.getElementById('spider-add-panel').style.display='none';addPanelTargetId=null;}
function addMapNode(repId){closeAddPanel();const parent=sp.nodes.find(n=>n.id===addPanelTargetId);if(!parent)return;const rep=roster.find(r=>r.id===repId);if(!rep)return;// Find angle from root to parent for direction context
var mgr=sp.nodes.find(n=>n.id==='mgr');const baseAngle=mgr?(Math.atan2(parent.y-mgr.y,parent.x-mgr.x)):0;const siblings=sp.edges.filter(e=>e.a===parent.id).length;const RDIST=150;const spread=Math.PI*0.55;const angleOffset=(siblings===0?0:(siblings%2===1?1:-1)*Math.ceil(siblings/2)*spread/Math.max(siblings,2));const angle=baseAngle+angleOffset;sp.nodes.push({id:rep.id,label:rep.name,position:rep.position||'default',x:parent.x+RDIST*Math.cos(angle),y:parent.y+RDIST*Math.sin(angle)});sp.edges.push({a:parent.id,b:rep.id});renderSpider();scheduleMapSave();}
function clearMap(){
  if(!confirm('Clear the whole map? This will remove all nodes and auto-save immediately — this cannot be undone.'))return;
  // Cancel any pending auto-save so we control exactly what gets saved
  clearTimeout(_mapSaveTimer);
  sp.nodes=[];sp.edges=[];
  sp.nodes.push({id:'mgr',label:getMgrDisplay(),position:'Manager',x:500,y:420});
  renderSpider();
  scheduleMapSave();
}
async function saveMap(){const md=JSON.stringify({nodes:sp.nodes,edges:sp.edges});try{await api({action:'saveMap',manager:managerName,mapData:md});showToast('Map saved ✓','success');}catch(e){showToast('Failed to save map','error');}}

// Auto-save: debounced 2s after last change — no need to click Save layout
let _mapSaveTimer=null;
function scheduleMapSave(){
  clearTimeout(_mapSaveTimer);
  const ind=document.getElementById('map-autosave-ind');
  if(ind){ind.textContent='Saving…';ind.style.opacity='1';}
  _mapSaveTimer=setTimeout(async()=>{
    const md=JSON.stringify({nodes:sp.nodes,edges:sp.edges});
    try{
      await api({action:'saveMap',manager:managerName,mapData:md});
      if(ind){ind.textContent='Saved ✓';setTimeout(()=>{ind.style.opacity='0';},1500);}
    }catch(e){
      if(ind){ind.textContent='Save failed';setTimeout(()=>{ind.style.opacity='0';},2000);}
    }
  },2000);
}

// ── Tab switching ─────────────────────────────────────
// ── EVENT PLANNER ─────────────────────────────────────
let epEvents=[];
let epAvgWire=0;
let epAttachEnabled=false;

const EP_WIRE_KEY=()=>`tt_ep_wire_${managerName}`;
const EP_EVENTS_KEY=()=>`tt_ep_events_${managerName}_${weekKey}`;

function epInit(){
  const w=localStorage.getItem(EP_WIRE_KEY());
  epAvgWire=w?parseFloat(w):0;
  const saved=localStorage.getItem(EP_EVENTS_KEY());
  if(saved){try{epEvents=JSON.parse(saved);}catch(e){epEvents=[];}}
  else{epEvents=[];}
  if(!epEvents.length)epEvents=[{name:'',cost:''},{name:'',cost:''},{name:'',cost:''}];
  const wp=document.getElementById('ep-week-pill');
  if(wp)wp.textContent=formatWeek(weekKey);
  const wi=document.getElementById('ep-avg-wire');
  if(wi&&epAvgWire)wi.value=epAvgWire;
  epRenderRows();
  epRecalc();
}

function epSaveWire(){
  const wi=document.getElementById('ep-avg-wire');
  epAvgWire=parseFloat(wi?.value)||0;
  if(epAvgWire)localStorage.setItem(EP_WIRE_KEY(),epAvgWire);
  const savedEl=document.getElementById('ep-wire-saved');
  if(savedEl){savedEl.style.display='';setTimeout(()=>{savedEl.style.display='none';},2000);}
}

function epRenderRows(){
  const el=document.getElementById('ep-events-list');
  if(!el)return;
  el.innerHTML=epEvents.map((e,i)=>`
    <div style="display:grid;grid-template-columns:1fr 130px 36px;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:11px 13px;box-shadow:var(--niond-shadow);">
      <input type="text" placeholder="Event name (e.g. Westfield Venue)" value="${esc(e.name)}"
        style="border:none;background:transparent;color:var(--text);font-family:var(--font);font-size:13px;font-weight:500;outline:none;width:100%;"
        oninput="epEvents[${i}].name=this.value;epRecalc()"/>
      <div style="position:relative;display:flex;align-items:center;">
        <span style="position:absolute;left:8px;font-size:12px;color:var(--muted);pointer-events:none;">£</span>
        <input type="number" min="0" step="0.01" placeholder="0.00" value="${e.cost||''}"
          style="padding:6px 8px 6px 20px;border:1px solid var(--border);border-radius:var(--rsm);background:var(--surface2);color:var(--text);font-family:var(--font);font-size:13px;width:100%;outline:none;box-sizing:border-box;"
          oninput="epEvents[${i}].cost=this.value;epRecalc()"/>
      </div>
      <button onclick="epRemoveRow(${i})" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:0;line-height:1;transition:color .12s;" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--muted)'">×</button>
    </div>`).join('');
}

function epAddRow(){epEvents.push({name:'',cost:''});epRenderRows();epRecalc();}
function epRemoveRow(i){epEvents.splice(i,1);epRenderRows();epRecalc();}

function epRecalc(){
  const el=document.getElementById('ep-breakeven');
  if(!el)return;
  const filled=epEvents.filter(e=>e.name||e.cost);
  const totalCost=epEvents.reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  if(!filled.length||!totalCost){el.style.display='none';return;}
  el.style.display='';

  const wire=epAvgWire||(parseFloat(document.getElementById('ep-avg-wire')?.value)||0);
  const hasWire=wire>0;

  let html=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--niond-shadow);">`;
  html+=`<div style="padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
    <div style="font-size:13px;font-weight:700;color:var(--text);">Breakeven Analysis</div>
    <div style="font-size:13px;font-weight:700;color:var(--text);">Total cost: £${totalCost.toFixed(2)}</div>
  </div>`;

  const eventRows=epEvents.filter(e=>(e.name||e.cost)&&(parseFloat(e.cost)||0)>0);
  if(eventRows.length){
    html+=`<div style="padding:12px 16px;display:flex;flex-direction:column;gap:9px;">`;
    eventRows.forEach(e=>{
      const cost=parseFloat(e.cost)||0;
      const salesNeeded=hasWire&&cost?Math.ceil(cost/wire):null;
      html+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font-size:13px;font-weight:500;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.name||'Unnamed event')}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span style="font-size:12px;color:var(--muted);">£${cost.toFixed(2)}</span>
          ${salesNeeded!==null?`<span style="font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-soft);padding:2px 9px;border-radius:20px;white-space:nowrap;">${salesNeeded} sale${salesNeeded!==1?'s':''} to profit</span>`:''}
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  if(hasWire&&totalCost){
    const totalSales=Math.ceil(totalCost/wire);
    const perDay=(totalCost/(wire*5));
    html+=`<div style="padding:14px 16px;background:var(--accent-soft);border-top:1px solid var(--accent-border);display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="text-align:center;">
        <div style="font-size:26px;font-weight:800;color:var(--accent);letter-spacing:-.03em;">${totalSales}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">total sales to break even</div>
      </div>
      <div style="text-align:center;border-left:1px solid var(--accent-border);">
        <div style="font-size:26px;font-weight:800;color:var(--accent);letter-spacing:-.03em;">${perDay.toFixed(1)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">sales/day (5-day week)</div>
      </div>
    </div>`;
  } else if(!hasWire){
    html+=`<div style="padding:11px 16px;background:rgba(217,119,6,.06);border-top:1px solid rgba(217,119,6,.15);">
      <div style="font-size:12px;color:#b45309;font-weight:600;">↑ Enter your average wire per sale above to see how many sales you need</div>
    </div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}

function epSave(){
  const btn=document.getElementById('ep-save-btn');
  const status=document.getElementById('ep-save-status');
  const filled=epEvents.filter(e=>e.name||e.cost);
  if(!filled.length){showToast('Add at least one event first','error');return;}
  btn.disabled=true;btn.textContent='Saving…';
  localStorage.setItem(EP_EVENTS_KEY(),JSON.stringify(epEvents));
  setTimeout(()=>{
    btn.disabled=false;btn.textContent='Save event plan for this week';
    if(status){status.textContent='✓ Saved for '+formatWeek(weekKey);setTimeout(()=>{status.textContent='';},4000);}
    showToast('Event plan saved ✓','success');
  },350);
}

function renderEPAttach(){
  const wrap=document.getElementById('wr-ep-attach-wrap');
  if(!wrap)return;
  const saved=localStorage.getItem(EP_EVENTS_KEY());
  let events=[];
  if(saved){try{events=JSON.parse(saved).filter(e=>e.name||e.cost);}catch(e){}}
  const wire=parseFloat(localStorage.getItem(EP_WIRE_KEY())||0);

  if(events.length){
    const totalCost=events.reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
    const totalSales=wire&&totalCost?Math.ceil(totalCost/wire):null;
    wrap.innerHTML=`
      <div style="background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);border-radius:var(--r);padding:13px 15px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
          <span style="font-size:14px;">✓</span>
          <div style="font-size:13px;font-weight:700;color:#16a34a;">Event plan ready for ${formatWeek(weekKey)}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);">${events.length} event${events.length!==1?'s':''} · £${totalCost.toFixed(2)} total${totalSales?' · <strong>'+totalSales+' sales</strong> to break even':''}</div>
      </div>
      <div class="wr-label">Include this week's event plan in your review?</div>
      <div class="wr-toggle-group">
        <button class="wr-toggle active" id="wr-ep-yes" onclick="epSetAttach(true)">Yes, include it</button>
        <button class="wr-toggle" id="wr-ep-no" onclick="epSetAttach(false)">Submit without</button>
      </div>`;
    epAttachEnabled=true;
    epEvents=JSON.parse(saved);
    epAvgWire=wire;
  } else {
    wrap.innerHTML=`
      <div style="background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.18);border-radius:var(--r);padding:13px 15px;">
        <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px;">No event plan saved for this week</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:11px;">Head to the Event Planner tab to log your events and costs first, then come back to attach it — or submit without it.</div>
        <button onclick="switchTab('events')" style="background:var(--accent);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:600;padding:7px 16px;border-radius:20px;cursor:pointer;transition:opacity .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Go to Event Planner →</button>
      </div>`;
    epAttachEnabled=false;
    epEvents=[];
    epAvgWire=0;
  }
}

function epSetAttach(val){
  epAttachEnabled=val;
  document.getElementById('wr-ep-yes')?.classList.toggle('active',val);
  document.getElementById('wr-ep-no')?.classList.toggle('active',!val);
}

// ── Tab switching ─────────────────────────────────────
const TABS=['home','reps','weekly','reports','review','events','calendar','leaderboard','map','notifications','notes','payrep','planner','profile'];
function switchTab(tab){
  TABS.forEach(id=>{
    const nav=document.getElementById(`nav-${id}`);
    const panel=document.getElementById(`ptab-${id}`);
    if(nav)nav.classList.toggle('active',id===tab);
    if(panel)panel.classList.toggle('active',id===tab);
  });
  if(tab==='events'){epInit();}
  if(tab==='map'){setTimeout(()=>{initMapPan();if(sp.nodes.length===0)rebuildMap();else{renderSpider();renderLegend();}applyTransform();},50);}
  if(tab==='home'&&wireByWeekGlobal!==null){requestAnimationFrame(()=>drawProdChart(wireByWeekGlobal));}
  if(tab==='calendar')renderCalendar();
  if(tab==='leaderboard')lbInit();
  if(tab==='review'){showReviewForm();}
  if(tab==='notifications'){renderManagerNotifs();markAllNotifsRead();}
  if(tab==='reports'){setTimeout(rptPtcRenderChart,80);}
  if(tab==='notes'){notesRenderFolders();notesRenderList();}
  if(tab==='planner'){dpInit();} else { clearInterval(dpPollTimer); }
  if(tab==='payrep'){rpInit();}
  if(tab==='profile'){profileLoad();}
}

// ── LEADERBOARD ───────────────────────────────────────
const LB_SHEET_ID='1IeMq2niCZrz1FsFfW1ucmWVO5r8M9EqMhTUcH7AeP_M';
const LB_SHEET_NAMES=['All production','All Production','all production'];
const LB_HEADERS=['Campaign','Agent','Mon','Tue','Wed','Thu','Fri','Sat','Week Total'];
let lbRows=[],lbView='Week Total',lbSearch='',lbCampaign='',lbLoaded=false;
function lbCsvUrl(s){return`https://docs.google.com/spreadsheets/d/${LB_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(s)}`;}
function lbNorm(h){return String(h||'').replace(/﻿/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
function lbNum(v){if(!v)return 0;return Number(String(v).replace(/[^\d.-]/g,''))||0;}
function lbParseCSV(text){const rows=[];let row=[];let cell='';let inQ=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&inQ&&n==='"'){cell+='"';i++;}else if(c==='"'){inQ=!inQ;}else if(c===','&&!inQ){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!inQ){if(cell||row.length){row.push(cell);rows.push(row);row=[];cell='';}}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(c=>String(c||'').trim()!==''));}
function lbParseRows(csvRows){const hi=csvRows.findIndex(row=>{const n=row.map(lbNorm);return LB_HEADERS.every(h=>n.includes(lbNorm(h)));});if(hi===-1)throw new Error('Missing headers');const rawH=csvRows[hi].map(h=>String(h||'').trim());const hm={};rawH.forEach((h,i)=>{hm[lbNorm(h)]=i;});return csvRows.slice(hi+1).map(vals=>{const o={};LB_HEADERS.forEach(h=>{const idx=hm[lbNorm(h)];o[h]=idx!==undefined?String(vals[idx]||'').trim():'';});return o;}).filter(r=>r.Agent&&r.Agent.trim()!=='');}
async function lbInit(){document.getElementById('lb-week-pill').textContent=formatWeek(weekKey);if(lbLoaded){lbRender();return;}document.getElementById('lb-list').innerHTML='<div class="lb-loading">Loading leaderboard…</div>';let lastErr=null;for(const name of LB_SHEET_NAMES){try{const res=await fetch(lbCsvUrl(name));if(!res.ok)throw new Error(`Tab not found`);const text=await res.text();if(text.toLowerCase().includes('<html'))throw new Error('Not CSV');const parsed=lbParseCSV(text);const objs=lbParseRows(parsed);if(objs.length){lbRows=objs;lbLoaded=true;const campaigns=[...new Set(lbRows.map(r=>r.Campaign).filter(Boolean))];lbCampaign='';lbBuildCampaignPills(campaigns);lbRender();return;}}catch(e){lastErr=e;}}document.getElementById('lb-list').innerHTML=`<div class="lb-empty">Could not load leaderboard.<br><small style="color:var(--subtle);">${lastErr?.message||'Unknown error'}</small></div>`;}
function lbBuildCampaignPills(campaigns){const wrap=document.getElementById('lb-campaign-pills');wrap.innerHTML=`<button class="lb-camp-pill ${lbCampaign===''?'active':''}" onclick="lbSelectCampaign(this,'')">All</button>`+campaigns.map(c=>`<button class="lb-camp-pill ${lbCampaign===c?'active':''}" onclick="lbSelectCampaign(this,'${esc(c)}')">${esc(c)}</button>`).join('');}
function lbSelectCampaign(btn,camp){lbCampaign=camp;document.querySelectorAll('.lb-camp-pill').forEach(b=>b.classList.toggle('active',b===btn));lbRender();}
function lbSetView(btn,view){lbView=view;document.querySelectorAll('.lb-view-btn').forEach(b=>b.classList.toggle('active',b===btn));lbRender();}
function lbFiltered(){const s=(document.getElementById('lb-search')||{value:''}).value.toLowerCase();return lbRows.filter(r=>{const ms=`${r.Agent} ${r.Campaign}`.toLowerCase().includes(s);const mc=!lbCampaign||r.Campaign===lbCampaign;return ms&&mc;}).sort((a,b)=>lbNum(b[lbView])-lbNum(a[lbView]));}
const LB_MEDAL_IMG={
  1:'images/medal-1.png',
  2:'images/medal-2.png',
  3:'images/medal-3.png'
};
function lbAvInitials(name){const parts=(name||'?').trim().split(/\s+/);return(parts[0]?.[0]||'')+(parts[1]?.[0]||'').toUpperCase();}
const LB_CAMPAIGN_COLOURS={"charit":{bg:"#ffb8cc",color:"#c4002e",border:"#f0004d"},"venue":{bg:"#b3d4ff",color:"#1140cc",border:"#1d50ff"},"door":{bg:"#fef9c3",color:"#92400e",border:"#f59e0b"},"wight":{bg:"#d4b8ff",color:"#5b1fd6",border:"#6e2ff0"}};
const LB_CAMP_FALLBACK=[{bg:"#a7ffdb",color:"#007a4d",border:"#00c97a"},{bg:"#ffe0a0",color:"#b85c00",border:"#f08000"},{bg:"#ffd6f0",color:"#9d0063",border:"#e0009b"},{bg:"#c8f7c5",color:"#1a6b17",border:"#3dba38"},{bg:"#ffddc1",color:"#7a3200",border:"#c25a00"}];
function lbCampColour(camp){const c=(camp||"").toLowerCase();for(const[kw,col]of Object.entries(LB_CAMPAIGN_COLOURS)){if(c.includes(kw))return col;}let h=0;for(const ch of c)h=(h*31+ch.charCodeAt(0))&0xffff;return LB_CAMP_FALLBACK[h%LB_CAMP_FALLBACK.length];}
function lbAvStyle(name,campaign){const col=lbCampColour(campaign);return"background:"+col.bg+";color:"+col.color+";border:none;";}

function lbRender(){
  const rows=lbFiltered();
  const total=rows.reduce((s,r)=>s+lbNum(r[lbView]),0);
  const avgScore=rows.length?Math.round(total/rows.length):0;

  if(!rows.length){
    document.getElementById('lb-podium-wrap').innerHTML='';
    document.getElementById('lb-list').innerHTML='<div class="lb-empty">No results found</div>';
    return;
  }

  const maxScore=lbNum(rows[0][lbView])||1;

  // ── Podium (top 3) — order: 2nd | 1st | 3rd ──
  const top3=rows.slice(0,3);
  const podOrder=[top3[1],top3[0],top3[2]].filter(Boolean);
  const podClass=['lb-podium-2','lb-podium-1','lb-podium-3'];
  const podRank=[2,1,3];
  const podLabel=['2nd','1st','3rd'];

  document.getElementById('lb-podium-wrap').innerHTML=`
    <div class="lb2-podium-section">
      <div class="lb2-podium-label">Top 3</div>
      <div class="lb2-podium">${podOrder.map((r,pi)=>{
        const score=lbNum(r[lbView]);
        const pct=Math.round((score/maxScore)*100);
        const initials=lbAvInitials(r.Agent);
        const medalClass=['lb-av-silver','lb-av-gold','lb-av-bronze'][pi];
        const rankNum=[2,1,3][pi];
        return`<div class="lb-podium-card ${podClass[pi]}">
          <div class="lb-p-rank-box">${rankNum}</div>
          <div class="lb-p-av ${medalClass}" style="${lbAvStyle(r.Agent,r.Campaign)}">${initials}</div>
          <div class="lb-p-name">${esc(r.Agent)}</div>
          <div class="lb-p-camp">${esc(r.Campaign||'—')}</div>
          <div class="lb-p-score">${score.toLocaleString()}</div>
        </div>`;
      }).join('')}</div>
    </div>`;

  // ── Full ranking table ──
  const viewLabel=lbView==='Week Total'?'Full ranking':`${lbView} ranking`;

  document.getElementById('lb-list').innerHTML=`
    <div class="lb2-list-section">
      <div class="lb2-list-hdr">
        <span class="lb-section-title">${viewLabel}</span>
        <span class="lb-count-badge">${rows.length} reps</span>
      </div>
      <div style="background:var(--niond-surface,#fff);border:1px solid var(--niond-border,#e8ecee);border-radius:12px;overflow:hidden;box-shadow:var(--niond-shadow);">
      ${rows.map((r,i)=>{
        const score=lbNum(r[lbView]);
        const rankClass=i===0?'lb-rank-1':i===1?'lb-rank-2':i===2?'lb-rank-3':'';
        const initials=lbAvInitials(r.Agent);
        return`<div class="lb-row ${i===0?'lb-top':''}">
          <div class="lb-rank ${rankClass}">${i+1}</div>
          <div class="lb-rep-cell">
            <div class="lb-row-av" style="${lbAvStyle(r.Agent,r.Campaign)}">${initials}</div>
            <div style="min-width:0;">
              <div class="lb-row-name">${esc(r.Agent)}</div>
              <div class="lb-row-camp">${esc(r.Campaign||'—')}</div>
            </div>
          </div>
          <div class="lb-score">${score.toLocaleString()}</div>
        </div>`;
      }).join('')}
      </div>
    </div>`;


}

// ── Util ──────────────────────────────────────────────
function getMgrToken(){if(guestMode)return guestToken;return sessionStorage.getItem('tt_mgr_token_'+managerName)||'';}
async function api(p){
  const body=JSON.stringify({token:getMgrToken(),...p});
  // Content-Type: text/plain = CORS simple request, no preflight needed.
  // credentials: omit prevents mobile browsers (iOS Safari) sending cookies,
  // which causes Google to redirect to its own login page instead of running the script.
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let r,text;
  try{
    r=await fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body,credentials:'omit',redirect:'follow',signal:controller.signal});
    text=await r.text();
  }catch(e){
    if(e.name==='AbortError')throw new Error('Request timed out — check your connection and try again.');
    throw new Error('Network error: '+(e.message||'could not reach server'));
  }finally{clearTimeout(timer);}
  if(!r.ok)throw new Error('Server error ('+r.status+') — try again or contact your admin.');
  if(text.trim().startsWith('<'))throw new Error('Got a login page instead of data — Apps Script may not be deployed as "Anyone".');
  try{return JSON.parse(text);}catch(e){throw new Error('Unexpected response — redeploy the Apps Script and try again.');}
}
function showToast(msg,type,dur){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.className='toast',dur||3000);}
window.addEventListener('resize',()=>{
  if(document.getElementById('ptab-map').classList.contains('active'))renderEdges();
  clearTimeout(_dashResizeTimer);
  _dashResizeTimer=setTimeout(()=>{
    if(wireByWeekGlobal!==null&&document.getElementById('prod-chart-canvas'))drawProdChart(wireByWeekGlobal);
    if(document.getElementById('rpt-ptc-canvas'))rptPtcRenderChart();
  },150);
});

if(guestMode && guestGroupKey){
  dpGuestInit();
} else if(!managerName){
  document.getElementById('login-screen').innerHTML='<div class="login-box"><div class="login-logo">The <span>Back Office</span></div><h2 style="font-size:18px;margin-bottom:8px;text-align:center;">No manager specified</h2><p style="color:var(--muted);font-size:13px;text-align:center;">Add your name to the URL: manager.html?name=sarah</p></div>';
} else {
  checkAuth();
}



// ── Manager Notifications ─────────────────────────────
function updateNotifBadge(){
  const unread=managerNotifs.filter(n=>!n.readAt).length;
  // Update topbar bell badge
  const tbBadge=document.getElementById('tb-notif-badge');
  if(tbBadge){
    if(unread>0){tbBadge.textContent=unread>99?'99+':String(unread);tbBadge.style.display='';}
    else{tbBadge.style.display='none';}
  }
  // Keep old sidebar badge in sync for any JS that still references it
  const badge=document.getElementById('notif-badge');
  if(badge){badge.textContent=String(unread);}
}

function renderManagerNotifs(){
  const el=document.getElementById('notif-list-mgr');if(!el)return;
  const sorted=[...managerNotifs].sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
  if(!sorted.length){el.innerHTML='<div style="color:var(--muted);font-size:14px;text-align:center;padding:48px;line-height:1.7;"><strong style="display:block;color:var(--text);font-size:16px;margin-bottom:6px;">No notifications yet</strong>Your manager will send you updates here.</div>';return;}
  el.innerHTML=sorted.map(n=>{
    const isRead=!!n.readAt;
    const sent=n.sentAt?new Date(n.sentAt).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    return`<div style="background:var(--surface);border:1px solid ${isRead?'var(--border)':'#0d9488'};border-radius:12px;padding:16px 18px;position:relative;box-shadow:${isRead?'none':'0 0 0 1px rgba(13,148,136,.2)'};">
      ${!isRead?'<div style="position:absolute;top:14px;right:14px;width:8px;height:8px;background:#ef4444;border-radius:50%;"></div>':''}
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;padding-right:20px;">${esc(n.title)}</div>
      ${n.message?`<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:8px;">${esc(n.message)}</div>`:''}
      <div style="font-size:11px;color:var(--subtle);">${sent}${isRead?'&nbsp;·&nbsp;<span style="color:var(--success);">✓ Read</span>':''}</div>
    </div>`;
  }).join('');
}

async function markAllNotifsRead(){
  const unread=managerNotifs.filter(n=>!n.readAt);
  if(!unread.length)return;
  await Promise.allSettled(unread.map(n=>api({action:'markNotifRead',id:n.id,manager:managerName})));
  managerNotifs.forEach(n=>{if(!n.readAt)n.readAt=new Date().toISOString();});
  updateNotifBadge();
  renderManagerNotifs();
}

// ══════════════════════════════════════════════════════
// REP SCORECARD
// ══════════════════════════════════════════════════════
// ── Notification dropdown ─────────────────────────────
let _notifDropdownOpen=false;
function toggleNotifDropdown(){
  if(_notifDropdownOpen){closeNotifDropdown();return;}
  renderNotifDropdown();
  document.getElementById('notif-dropdown').style.display='block';
  _notifDropdownOpen=true;
  setTimeout(()=>document.addEventListener('click',_notifOutsideClick,{once:true}),0);
}
function closeNotifDropdown(){
  document.getElementById('notif-dropdown').style.display='none';
  _notifDropdownOpen=false;
}
function _notifOutsideClick(e){
  const dd=document.getElementById('notif-dropdown');
  const btn=document.getElementById('tb-notif-btn');
  if(dd&&!dd.contains(e.target)&&btn&&!btn.contains(e.target)){closeNotifDropdown();}
  else if(_notifDropdownOpen){document.addEventListener('click',_notifOutsideClick,{once:true});}
}
function renderNotifDropdown(){
  const el=document.getElementById('notif-dd-list');if(!el)return;
  const sorted=[...managerNotifs].sort((a,b)=>(b.sentAt||'').localeCompare(a.sentAt||'')).slice(0,5);
  if(!sorted.length){
    el.innerHTML='<div class="notif-dd-empty">No notifications yet</div>';
    return;
  }
  el.innerHTML=sorted.map(n=>{
    const isRead=!!n.readAt;
    const sent=n.sentAt?_timeAgo(n.sentAt):'';
    return`<div class="notif-dd-item${isRead?'':' unread'}">
      ${!isRead?'<div class="notif-dd-dot"></div>':''}
      <div class="notif-dd-item-title">${esc(n.title)}</div>
      ${n.message?`<div class="notif-dd-item-msg">${esc(n.message.length>80?n.message.slice(0,80)+'…':n.message)}</div>`:''}
      <div class="notif-dd-item-time">${sent}</div>
    </div>`;
  }).join('');
}
function _timeAgo(iso){
  try{
    const diff=(Date.now()-new Date(iso).getTime())/1000;
    if(diff<60)return'Just now';
    if(diff<3600)return Math.floor(diff/60)+'m ago';
    if(diff<86400)return Math.floor(diff/3600)+'h ago';
    if(diff<604800)return Math.floor(diff/86400)+'d ago';
    return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  }catch(e){return'';}
}
// ─────────────────────────────────────────────────────

let repNotes={};// keyed by rep id, array of {text,date}

function openScorecard(repId){
  const rep=roster.find(r=>r.id===repId);if(!rep)return;
  const ini=(rep.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const avEl=document.getElementById('sc-av');
  avEl.textContent=ini;
  avEl.className='sc-av '+posClass(rep.position||'');
  document.getElementById('sc-name').textContent=rep.name||'—';
  const posEl=document.getElementById('sc-pos');
  posEl.innerHTML=rep.position?`<span class="pos-tag ${posClass(rep.position)}" style="font-size:11px;">${esc(rep.position)}</span>`:'';

  const body=document.getElementById('sc-body');
  const notes=repNotes[repId]||[];

  // Build position history from roster history field if present
  const posHistory=rep.positionHistory||[];
  const posHtml=posHistory.length
    ? posHistory.map(ph=>`<div class="sc-tl-row">
        <div class="sc-tl-left"><div class="sc-dot pos">${SVG.star}</div></div>
        <div class="sc-tl-body"><div class="sc-tl-label">${esc(ph.position)}</div><div class="sc-tl-date">${esc(ph.date||'')}</div></div>
      </div>`).join('')
    : rep.position
      ? `<div class="sc-tl-row"><div class="sc-tl-left"><div class="sc-dot pos">${SVG.star}</div></div><div class="sc-tl-body"><div class="sc-tl-label">Currently: ${esc(rep.position)}</div><div class="sc-tl-date">No change history recorded</div></div></div>`
      : `<div class="sc-empty-msg">No position history yet.</div>`;

  // Flag history
  const flagHistory=rep.flagHistory||[];
  const currentFlag=rep.flag?FLAGS.find(f=>f.id===rep.flag):null;
  const flagRows=[...flagHistory];
  if(currentFlag&&!flagRows.find(f=>f.current)){flagRows.unshift({label:currentFlag.label,id:currentFlag.id,date:'Current',current:true});}
  const flagDotClass=f=>{
    if(f.id==='AtRisk')return'flag-risk';
    if(f.id==='DoingWell')return'flag-ok';
    if(f.id==='Conversation')return'flag-warn';
    return'flag-watch';
  };
  const flagHtml=flagRows.length
    ? flagRows.map(f=>`<div class="sc-tl-row">
        <div class="sc-tl-left"><div class="sc-dot ${flagDotClass(f)}">●</div></div>
        <div class="sc-tl-body"><div class="sc-tl-label">${esc(f.label||f.id)}</div><div class="sc-tl-date">${esc(f.date||'')}</div></div>
      </div>`).join('')
    : `<div class="sc-empty-msg">No flags on record.</div>`;

  // Notes
  const notesHtml=notes.length
    ? `<div class="sc-note-list">${notes.map((n,i)=>`<div class="sc-note-card"><div class="sc-note-text">${esc(n.text)}</div><div class="sc-note-meta">${esc(n.date)}</div></div>`).join('')}</div>`
    : `<div class="sc-empty-msg">No notes yet — add one below.</div>`;

  // ── Pay data for this rep ──
  const scRepName = rep.name||'';
  // Current week stats from loaded CSV
  let scPayHtml = '';
  if(rp_csvRows && rp_csvHeaders){
    const headers = rp_csvHeaders;
    const matchingRows = rp_csvRows.slice(1)
      .filter(r => {
        const csvName = r[0]?.trim()||'';
        return rp_matchRoster(csvName)?.id === repId;
      })
      .map(r=>{const d={};headers.forEach((h,i)=>d[h]=r[i]);return d;});
    if(matchingRows.length){
      const totalPay   = matchingRows.reduce((s,r)=>s+rp_num(r['Total Pay']),0);
      const submitted  = matchingRows.reduce((s,r)=>s+rp_num(r['Submitted 1'])+rp_num(r['Submitted 2']),0);
      const payable    = matchingRows.reduce((s,r)=>s+rp_num(r['Payable 1'])+rp_num(r['Payable 2']),0);
      const cancelled  = submitted - payable;
      const pct        = submitted>0?Math.round((payable/submitted)*100):0;
      const state      = rp_rateClass(pct);
      scPayHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--niond-border,#e8ecee);border-radius:10px;overflow:hidden;margin-bottom:12px;">
          <div style="padding:12px 14px;border-right:1px solid var(--niond-border,#e8ecee);text-align:center;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px;">Pay</div>
            <div style="font-size:16px;font-weight:800;color:var(--niond-text,#0f1923);">${rp_fmt(totalPay)}</div>
          </div>
          <div style="padding:12px 14px;border-right:1px solid var(--niond-border,#e8ecee);text-align:center;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px;">Submitted</div>
            <div style="font-size:16px;font-weight:800;color:var(--niond-text,#0f1923);">${submitted}</div>
          </div>
          <div style="padding:12px 14px;border-right:1px solid var(--niond-border,#e8ecee);text-align:center;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px;">Payable</div>
            <div style="font-size:16px;font-weight:800;color:var(--niond-text,#0f1923);">${payable}</div>
          </div>
          <div style="padding:12px 14px;text-align:center;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px;">Rate</div>
            <div style="font-size:16px;font-weight:800;color:${state==='good'?'#0f766e':state==='warn'?'#d97706':'#dc2626'};">${pct}%</div>
          </div>
        </div>`;
    }
  }
  const scHasHistory = rp_weekIndex.length >= 2;

  body.innerHTML=`
    <div>
      <div class="sc-sec-title">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 9l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Pay — ${esc(rp_activeLabel||'Current week')}
      </div>
      ${scPayHtml || `<div class="sc-empty-msg">No pay data loaded — open the Pay tab first.</div>`}
      ${scHasHistory ? `<div id="sc-pay-history" class="rp-history-card" style="margin-bottom:0;"></div>` : ''}
    </div>
    <div>
      <div class="sc-sec-title">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 2l1.5 3.5L13 6l-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z" stroke-linejoin="round"/></svg>
        Position History
      </div>
      <div class="sc-timeline">${posHtml}</div>
    </div>
    <div>
      <div class="sc-sec-title">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.5l2 2" stroke-linecap="round"/></svg>
        Flag History
      </div>
      <div class="sc-timeline">${flagHtml}</div>
    </div>
    <div>
      <div class="sc-sec-title">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 2h10a1 1 0 0 1 1 1v8l-3 3H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke-linejoin="round"/><path d="M5 6h6M5 9h4" stroke-linecap="round"/></svg>
        Manager Notes
      </div>
      ${notesHtml}
      <div class="sc-note-add" style="margin-top:10px;">
        <input class="sc-note-input" id="sc-note-input-${repId}" type="text" placeholder="Add a note about ${esc(rep.name.split(' ')[0])}…" onkeydown="if(event.key==='Enter')scAddNote('${repId}')"/>
        <button class="sc-note-save" onclick="scAddNote('${repId}')">Save</button>
      </div>
    </div>`;

  document.getElementById('scorecard-backdrop').style.display='flex';
  document.body.style.overflow='hidden';

  // Lazy load history chart after scorecard is visible
  if(scHasHistory){
    // find the csv name that matched this rep id
    let csvMatchName = scRepName;
    if(rp_csvRows && rp_csvHeaders){
      const headers = rp_csvHeaders;
      const matchRow = rp_csvRows.slice(1).find(r=>{
        const csvName = r[0]?.trim()||'';
        return rp_matchRoster(csvName)?.id === repId;
      });
      if(matchRow) csvMatchName = matchRow[0]?.trim()||scRepName;
    }
    requestAnimationFrame(()=>rp_loadRepHistory(csvMatchName,'sc-pay-history'));
  }
}

function closeScorecard(){
  document.getElementById('scorecard-backdrop').style.display='none';
  document.body.style.overflow='';
}

function scAddNote(repId){
  const input=document.getElementById(`sc-note-input-${repId}`);
  const text=(input?.value||'').trim();
  if(!text)return;
  const rep=roster.find(r=>r.id===repId);
  if(!rep)return;
  if(!repNotes[repId])repNotes[repId]=[];
  const now=new Date();
  const dateStr=now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  repNotes[repId].unshift({text,date:dateStr});
  // Persist by storing notes array inside the rep object and saving via existing saveRep
  rep.managerNotes=repNotes[repId];
  api({action:'saveRep',manager:managerName,rep}).catch(()=>{});
  openScorecard(repId);
}

// ══════════════════════════════════════════════════════
// PAY TREND CHART TAB + REPORTS INLINE CHART
// ══════════════════════════════════════════════════════
// Shared data fetcher — accepts explicit range
function ptcGetDataN(n){
  const allPayWeeks=[...new Set([
    ...allReports.filter(r=>r.type==='Pay Report').map(r=>r.week),
    ...allPayData.map(p=>p.week)
  ])].filter(Boolean).sort();
  const weeks=n>0?allPayWeeks.slice(-n):allPayWeeks;
  return weeks.map(wk=>{
    const rep=allReports.find(r=>r.type==='Pay Report'&&r.week===wk);
    const pd=allPayData.find(p=>p.week===wk);
    const wire=parseFloat((pd&&pd.officeWire!==''?pd.officeWire:null)||rep?.officeWire||0)||0;
    const take=parseFloat((pd&&pd.mgrTake!==''?pd.mgrTake:null)||rep?.mgrTake||0)||0;
    return{wk,wire,take};
  });
}

// Reports-page inline chart
let rptPtcRange=6;
function rptPtcSetRange(btn,n){
  document.querySelectorAll('#rpt-ptc-pills .ptc-rpill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  rptPtcRange=n;
  rptPtcRenderChart();
}
function rptPtcRenderChart(){
  const data=ptcGetDataN(rptPtcRange);
  const sub=document.getElementById('rpt-ptc-sub');
  if(sub)sub.textContent=data.length?`${data.length} week${data.length!==1?'s':''} of data · Wire vs Take`:'No pay data yet';
  const canvas=document.getElementById('rpt-ptc-canvas');
  if(canvas&&data.length)requestAnimationFrame(()=>ptcDraw(canvas,data));
}

function ptcDraw(canvas,data){
  const dpr=window.devicePixelRatio||1;
  const wrap=canvas.parentElement;
  const W=(wrap?wrap.clientWidth:0)||700;
  const H=(wrap?wrap.clientHeight:0)||240;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const dark=isDark();
  const gridCol=dark?'#2a3a3a':'#eef0f3';
  const labelCol=dark?'#5a7070':'#9aabb8';
  const textCol=dark?'#8a9db0':'#6b7d8a';

  // Generous padding so lines never touch the edges
  const padL=56,padR=40,padT=24,padB=58;
  const iW=W-padL-padR,iH=H-padT-padB;

  // Separate max for each series so a small Take line isn't squished
  const wireVals=data.map(d=>d.wire);
  const takeVals=data.map(d=>d.take);
  const maxWire=Math.max(...wireVals,1);
  const maxTake=Math.max(...takeVals,1);
  // Use a shared scale only if they're in a similar range (within 3x); else dual axis
  const useDual=maxWire>maxTake*3;
  const maxLeft=maxWire;
  const maxRight=useDual?maxTake:maxWire;

  // Round max up to a nice number so gridlines land cleanly
  function niceMax(v){
    const mag=Math.pow(10,Math.floor(Math.log10(v)));
    const frac=v/mag;
    const nice=frac<=1?1:frac<=2?2:frac<=5?5:10;
    return nice*mag*1.1;// 10% headroom
  }
  const niceLeft=niceMax(maxLeft);
  const niceRight=niceMax(maxRight);

  // Grid lines (4 steps)
  ctx.strokeStyle=gridCol;ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(p=>{
    const y=padT+iH-(p*iH);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+iW,y);ctx.stroke();
    // Left axis (Wire)
    const vL=Math.round(niceLeft*p);
    const lblL=vL>=1000?'£'+(vL/1000).toFixed(vL>=10000?0:1)+'k':'£'+vL;
    ctx.fillStyle=dark?'rgba(92,157,255,.6)':'rgba(60,120,220,.55)';
    ctx.font='10px DM Sans,sans-serif';ctx.textAlign='right';
    ctx.fillText(lblL,padL-8,y+3.5);
    // Right axis (Take) — only show if dual scale
    if(useDual){
      const vR=Math.round(niceRight*p);
      const lblR=vR>=1000?'£'+(vR/1000).toFixed(vR>=10000?0:1)+'k':'£'+vR;
      ctx.fillStyle=dark?'rgba(38,198,176,.6)':'rgba(15,150,130,.55)';
      ctx.textAlign='left';
      ctx.fillText(lblR,padL+iW+8,y+3.5);
    }
  });

  const xPos=i=>padL+i*(iW/(data.length-1||1));
  const yWire=v=>padT+iH-(v/niceLeft)*iH;
  const yTake=v=>padT+iH-(v/niceRight)*iH;

  function drawArea(yFn,vals,color){
    if(vals.length<2)return;
    ctx.beginPath();
    ctx.moveTo(xPos(0),padT+iH);
    vals.forEach((v,i)=>ctx.lineTo(xPos(i),yFn(v)));
    ctx.lineTo(xPos(vals.length-1),padT+iH);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
  }
  function drawLine(yFn,vals,color){
    if(vals.length<2)return;
    ctx.beginPath();
    vals.forEach((v,i)=>{i===0?ctx.moveTo(xPos(i),yFn(v)):ctx.lineTo(xPos(i),yFn(v));});
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    vals.forEach((v,i)=>{
      ctx.beginPath();ctx.arc(xPos(i),yFn(v),4,0,Math.PI*2);
      ctx.fillStyle=color;ctx.fill();
      ctx.strokeStyle=dark?'#131e2a':'#fff';ctx.lineWidth=2;ctx.stroke();
    });
  }

  drawArea(yWire,wireVals,dark?'rgba(92,157,255,.07)':'rgba(92,157,255,.08)');
  drawArea(yTake,takeVals,dark?'rgba(38,198,176,.07)':'rgba(38,198,176,.08)');
  drawLine(yWire,wireVals,'#5C9DFF');
  drawLine(yTake,takeVals,'#26C6B0');

  // X labels — skip crowded labels
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxLabels=Math.floor(iW/60);
  const step=data.length>maxLabels?Math.ceil(data.length/maxLabels):1;
  data.forEach((d,i)=>{
    if(i%step!==0&&i!==data.length-1)return;
    if(!d.wk)return;
    const p=d.wk.split('-');
    if(p.length===3){
      const dy=parseInt(p[2]),mo=parseInt(p[1])-1;
      if(!isNaN(dy)&&!isNaN(mo)){
        ctx.fillStyle=textCol;ctx.font='bold 10px DM Sans,sans-serif';ctx.textAlign='center';
        ctx.fillText(`${dy} ${months[mo]}`,xPos(i),padT+iH+18);
      }
    }
  });

  // Dual scale legend hint
  if(useDual){
    ctx.font='9px DM Sans,sans-serif';ctx.textAlign='left';
    ctx.fillStyle=dark?'rgba(92,157,255,.5)':'rgba(60,120,220,.45)';
    ctx.fillText('Wire →',padL,padT-8);
    ctx.textAlign='right';
    ctx.fillStyle=dark?'rgba(38,198,176,.5)':'rgba(15,150,130,.45)';
    ctx.fillText('← Take',padL+iW,padT-8);
  }

}

// ══════════════════════════════════════════════════════
// NOTES TAB
// ══════════════════════════════════════════════════════
const NOTE_COLOURS=['#0f766e','#2563ff','#7c3aed','#f59e0b','#ec4899','#ef4444','#06b6d4','#22c55e'];
let notesData={folders:[{id:'default',name:'General',color:'#0f766e'}],notes:[]};
let notesActiveFolderId='all';
let notesActiveNoteId=null;
let notesDirtyTimer=null;
let notesFolderPickedColor=NOTE_COLOURS[0];

function notesInit(){
  // Load from sheet data first, then layer localStorage cache on top
  try{const p=JSON.parse(notes);if(p&&p.folders&&p.notes)notesData=p;}catch(e){}
  const cached=localStorage.getItem(`tt_notes_${managerName}`);
  if(cached){try{const p=JSON.parse(cached);if(p&&p.folders&&p.notes)notesData=p;}catch(e){}}
  // Ensure every note has tags and history arrays
  notesData.notes.forEach(n=>{if(!n.tags)n.tags=[];if(!n.history)n.history=[];});
  // Ensure saved templates store
  if(!notesData.savedTemplates)notesData.savedTemplates=[];
  notesSortMode='date-desc';
  notesRenderFolders();
  notesRenderList();
  notesRenderSavedTemplates();
  notesInitToolbar();
}

function notesSave(){
  const json=JSON.stringify(notesData);
  localStorage.setItem(`tt_notes_${managerName}`,json);
  notes=json;
  api({action:'saveNotes',manager:managerName,notes:json}).catch(()=>{});
}

function notesMarkDirty(){
  clearTimeout(notesDirtyTimer);
  const lbl=document.getElementById('n-saved-lbl');
  if(lbl)lbl.textContent='Saving…';
  notesDirtyTimer=setTimeout(()=>{notesFlushEdit();if(lbl)lbl.textContent='Saved ✓';setTimeout(()=>{if(lbl)lbl.textContent='';},2500);},800);
}

function notesFlushEdit(){
  if(!notesActiveNoteId)return;
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  const body=document.getElementById('n-body');
  const newHtml=body?body.innerHTML:'';
  // Snapshot history before overwriting (max 8 snapshots)
  if(note.body!==undefined&&note.body!==newHtml){
    if(!note.history)note.history=[];
    note.history.unshift({html:note.body,savedAt:note.updatedAt||new Date().toISOString()});
    if(note.history.length>8)note.history=note.history.slice(0,8);
  }
  note.title=document.getElementById('n-title').value||'Untitled';
  note.body=newHtml;
  note.folder=document.getElementById('n-folder-sel').value||'default';
  note.updatedAt=new Date().toISOString();
  notesRenderList();
  notesSave();
}

/* ── Toolbar ─────────────────────────────── */
function notesInitToolbar(){
  document.querySelectorAll('.nt-btn[data-cmd]').forEach(btn=>{
    btn.addEventListener('mousedown',e=>{
      e.preventDefault();
      const cmd=btn.dataset.cmd;
      const editor=document.getElementById('n-body');
      if(!editor)return;
      editor.focus();
      if(cmd==='h1'||cmd==='h2'||cmd==='h3'){
        document.execCommand('formatBlock',false,cmd);
      } else if(cmd==='blockquote'){
        document.execCommand('formatBlock',false,'blockquote');
      } else if(cmd==='code'){
        document.execCommand('formatBlock',false,'pre');
      } else if(cmd==='checklist'){
        notesInsertChecklist();
      } else {
        document.execCommand(cmd,false,null);
      }
      notesMarkDirty();
      notesUpdateToolbarState();
    });
  });
  document.getElementById('n-body')?.addEventListener('keyup',notesUpdateToolbarState);
  document.getElementById('n-body')?.addEventListener('mouseup',notesUpdateToolbarState);
  // Keyboard shortcuts
  document.getElementById('n-body')?.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='b'){e.preventDefault();document.execCommand('bold',false,null);notesMarkDirty();}
    if((e.ctrlKey||e.metaKey)&&e.key==='i'){e.preventDefault();document.execCommand('italic',false,null);notesMarkDirty();}
    // Tab in editor → indent
    if(e.key==='Tab'){e.preventDefault();document.execCommand('insertHTML',false,'&nbsp;&nbsp;&nbsp;&nbsp;');}
  });
}

function notesUpdateToolbarState(){
  document.querySelectorAll('.nt-btn[data-cmd]').forEach(btn=>{
    const cmd=btn.dataset.cmd;
    let active=false;
    try{
      if(['bold','italic','strikeThrough','insertUnorderedList','insertOrderedList'].includes(cmd)){
        active=document.queryCommandState(cmd);
      }
    }catch(e){}
    btn.classList.toggle('active',active);
  });
}

function notesInsertChecklist(){
  const editor=document.getElementById('n-body');
  if(!editor)return;
  const sel=window.getSelection();
  const range=sel&&sel.rangeCount?sel.getRangeAt(0):null;
  const html='<div><input type="checkbox" onchange="notesMarkDirty()"> <span contenteditable="true">Task item</span></div>';
  document.execCommand('insertHTML',false,html);
}

/* ── Folders ─────────────────────────────── */
function notesRenderFolders(){
  const all=notesData.notes.length;
  const pinned=notesData.notes.filter(n=>n.pinned).length;
  let html=`<div class="nf-item ${notesActiveFolderId==='all'?'active':''}" onclick="notesSetFolder('all')">
    <div class="nf-dot" style="background:#6b7d8a;"></div>All notes<span class="nf-count">${all}</span></div>`;
  if(pinned){html+=`<div class="nf-item ${notesActiveFolderId==='pinned'?'active':''}" onclick="notesSetFolder('pinned')">
    <div class="nf-dot" style="background:#f59e0b;"></div>${SVG.pinned} Pinned<span class="nf-count">${pinned}</span></div>`;}
  notesData.folders.forEach(f=>{
    const cnt=notesData.notes.filter(n=>n.folder===f.id).length;
    html+=`<div class="nf-item ${notesActiveFolderId===f.id?'active':''}" onclick="notesSetFolder('${esc(f.id)}')">
      <div class="nf-dot" style="background:${esc(f.color)};"></div>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.name)}</span>
      <span class="nf-count">${cnt}</span>
      <button class="nf-del-btn" onclick="notesDeleteFolder(event,'${esc(f.id)}')" title="Delete folder">×</button>
    </div>`;
  });
  document.getElementById('nf-list').innerHTML=html;
}

function notesSetFolder(id){
  notesActiveFolderId=id;
  notesRenderFolders();
  notesRenderList();
}

function notesDeleteFolder(e,id){
  e.stopPropagation();
  const folder=notesData.folders.find(f=>f.id===id);
  if(!folder)return;
  const noteCount=notesData.notes.filter(n=>n.folder===id).length;
  const msg=noteCount
    ?`Delete folder "${folder.name}"? The ${noteCount} note${noteCount!==1?'s':''} inside will be moved to the first remaining folder.`
    :`Delete folder "${folder.name}"?`;
  if(!confirm(msg))return;
  // Move notes to first remaining folder or create Uncategorised
  const remaining=notesData.folders.filter(f=>f.id!==id);
  const fallback=remaining[0]?.id||(()=>{
    const uid='folder_uncategorised';
    if(!notesData.folders.find(f=>f.id===uid))notesData.folders.push({id:uid,name:'Uncategorised',color:'#6b7d8a'});
    return uid;
  })();
  notesData.notes.forEach(n=>{if(n.folder===id)n.folder=fallback;});
  notesData.folders=notesData.folders.filter(f=>f.id!==id);
  if(notesActiveFolderId===id)notesActiveFolderId='all';
  notesSave();notesRenderFolders();notesRenderList();
  showToast(`Folder "${folder.name}" deleted ✓`,'success');
}

/* ── Sort & filter ───────────────────────── */
let notesSortMode='date-desc';
const notesSortCycles=['date-desc','date-asc','alpha-asc','alpha-desc'];
const notesSortLabels={'date-desc':'↓ Newest','date-asc':'↑ Oldest','alpha-asc':'A–Z','alpha-desc':'Z–A'};
function notesCycleSort(){
  const idx=notesSortCycles.indexOf(notesSortMode);
  notesSortMode=notesSortCycles[(idx+1)%notesSortCycles.length];
  const btn=document.getElementById('notes-sort-btn');
  if(btn)btn.textContent=notesSortLabels[notesSortMode];
  notesRenderList();
}
function notesFilter(){notesRenderList();}

function notesRenderList(){
  const q=(document.getElementById('notes-search')?.value||'').toLowerCase();
  let list=[...notesData.notes];
  if(notesActiveFolderId==='pinned')list=list.filter(n=>n.pinned);
  else if(notesActiveFolderId!=='all')list=list.filter(n=>n.folder===notesActiveFolderId);
  if(q)list=list.filter(n=>{
    const tags=(n.tags||[]).join(' ').toLowerCase();
    return(n.title+n.body+tags).toLowerCase().includes(q);
  });
  // Sort: pinned always first, then by selected mode
  list.sort((a,b)=>{
    if(a.pinned&&!b.pinned)return-1;
    if(!a.pinned&&b.pinned)return 1;
    if(notesSortMode==='date-asc')return(a.updatedAt||'').localeCompare(b.updatedAt||'');
    if(notesSortMode==='alpha-asc')return(a.title||'').localeCompare(b.title||'');
    if(notesSortMode==='alpha-desc')return(b.title||'').localeCompare(a.title||'');
    return(b.updatedAt||'').localeCompare(a.updatedAt||'');
  });

  const el=document.getElementById('notes-list-items');
  if(!el)return;
  if(!list.length){el.innerHTML=`<div style="text-align:center;padding:32px 0;font-size:12px;color:var(--muted);">${q?'No results':'No notes yet'}</div>`;return;}

  el.innerHTML=list.map(n=>{
    const folder=notesData.folders.find(f=>f.id===n.folder);
    // Strip HTML tags for plain text preview
    const plainText=(n.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    const date=n.updatedAt?new Date(n.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'';
    const tags=(n.tags||[]).slice(0,3);
    const taskCount=(n.body||'').split('type="checkbox"').length-1;
    const doneCount=(n.body||'').split('checked').length-1;
    const taskStr=taskCount>0?`<span class="n-tag-pill">☑ ${doneCount}/${taskCount}</span>`:'';
    return`<div class="n-card ${n.pinned?'pinned':''} ${n.id===notesActiveNoteId?'active':''}" onclick="notesOpenNote('${n.id}')">
      <div class="n-card-title">${n.pinned?`<span class="n-pin-ico">${SVG.pinned}</span>`:''}${esc(n.title||'Untitled')}</div>
      ${plainText?`<div class="n-card-preview">${esc(plainText)}</div>`:''}
      <div class="n-card-meta">
        ${folder?`<span class="n-folder-pill" style="background:${folder.color}18;color:${folder.color};border-color:${folder.color}40;">${esc(folder.name)}</span>`:''}
        ${tags.map(t=>`<span class="n-tag-pill">${esc(t)}</span>`).join('')}
        ${taskStr}
        <span class="n-date">${date}</span>
      </div>
    </div>`;
  }).join('');
}

/* ── Open / create ───────────────────────── */
function notesOpenNote(id){
  notesFlushEdit();
  notesActiveNoteId=id;
  const note=notesData.notes.find(n=>n.id===id);
  if(!note)return;
  document.getElementById('notes-blank').style.display='none';
  const wrap=document.getElementById('notes-editor-wrap');
  wrap.style.display='flex';wrap.style.flexDirection='column';wrap.style.overflow='hidden';wrap.style.flex='1';
  document.getElementById('n-title').value=note.title||'';
  // Rich editor: set innerHTML
  const body=document.getElementById('n-body');
  if(body)body.innerHTML=note.body||'';
  const pinBtn=document.getElementById('n-pin-btn');
  pinBtn.innerHTML=(note.pinned?SVG.pinned+' Unpin':SVG.pinned+' Pin');
  pinBtn.className='n-ed-btn'+(note.pinned?' pinned':'');
  // Folder selector
  const sel=document.getElementById('n-folder-sel');
  sel.innerHTML=notesData.folders.map(f=>`<option value="${f.id}" ${note.folder===f.id?'selected':''}>${esc(f.name)}</option>`).join('');
  // Tags
  notesRenderTags();
  // Reset template selects
  const tmplSel=document.getElementById('n-tmpl-sel');
  if(tmplSel)tmplSel.value='';
  const savedTmplSel=document.getElementById('n-saved-tmpl-sel');
  if(savedTmplSel)savedTmplSel.value='';
  const savedLbl=document.getElementById('n-saved-lbl');
  if(savedLbl)savedLbl.textContent='';
  notesRenderList();
  notesUpdateToolbarState();
}

function notesNewNote(){
  notesFlushEdit();
  const id='note_'+Date.now();
  const folderId=notesActiveFolderId==='all'||notesActiveFolderId==='pinned'
    ? (notesData.folders[0]?.id||'default')
    : notesActiveFolderId;
  const note={id,title:'',body:'',folder:folderId,pinned:false,tags:[],history:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  notesData.notes.unshift(note);
  notesSave();
  notesRenderFolders();
  notesRenderList();
  notesOpenNote(id);
  setTimeout(()=>document.getElementById('n-title')?.focus(),50);
}

/* ── Pin / delete ────────────────────────── */
function notesTogglePin(){
  if(!notesActiveNoteId)return;
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  note.pinned=!note.pinned;
  const btn=document.getElementById('n-pin-btn');
  btn.innerHTML=(note.pinned?SVG.pinned+' Unpin':SVG.pinned+' Pin');
  btn.className='n-ed-btn'+(note.pinned?' pinned':'');
  notesSave();notesRenderList();notesRenderFolders();
}

function notesDeleteCurrent(){
  if(!notesActiveNoteId)return;
  if(!confirm('Delete this note?'))return;
  notesData.notes=notesData.notes.filter(n=>n.id!==notesActiveNoteId);
  notesActiveNoteId=null;
  document.getElementById('notes-editor-wrap').style.display='none';
  document.getElementById('notes-blank').style.display='flex';
  notesSave();notesRenderFolders();notesRenderList();
}

/* ── Tags ────────────────────────────────── */
function notesRenderTags(){
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  const el=document.getElementById('n-tags-list');
  if(!el)return;
  el.innerHTML=(note.tags||[]).map(t=>`<span class="n-tag-badge">${esc(t)}<button onclick="notesRemoveTag('${esc(t)}')" title="Remove tag">×</button></span>`).join('');
}

function notesRemoveTag(tag){
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  note.tags=(note.tags||[]).filter(t=>t!==tag);
  notesRenderTags();notesRenderList();notesSave();
}

function notesShowTagInput(e){
  // Remove any existing popover
  document.querySelectorAll('.n-tag-popover').forEach(p=>p.remove());
  const btn=e.currentTarget;
  const rect=btn.getBoundingClientRect();
  const pop=document.createElement('div');
  pop.className='n-tag-popover';
  pop.innerHTML=`<input class="n-tag-input" id="n-tag-inp" placeholder="tag name…" maxlength="32"/>
    <button class="n-tag-ok" onclick="notesAddTagFromInput()">Add</button>`;
  pop.style.top=(rect.bottom+6)+'px';
  pop.style.left=rect.left+'px';
  document.body.appendChild(pop);
  const inp=document.getElementById('n-tag-inp');
  inp.focus();
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter')notesAddTagFromInput();if(ev.key==='Escape')pop.remove();});
  // Close on outside click
  setTimeout(()=>document.addEventListener('click',function h(ev){if(!pop.contains(ev.target)&&ev.target!==btn){pop.remove();document.removeEventListener('click',h);}},true),0);
}

function notesAddTagFromInput(){
  const inp=document.getElementById('n-tag-inp');
  if(!inp)return;
  const tag=inp.value.trim().toLowerCase().replace(/\s+/g,'-');
  if(!tag){document.querySelectorAll('.n-tag-popover').forEach(p=>p.remove());return;}
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  if(!note.tags)note.tags=[];
  if(!note.tags.includes(tag))note.tags.push(tag);
  notesRenderTags();notesRenderList();notesSave();
  document.querySelectorAll('.n-tag-popover').forEach(p=>p.remove());
}

/* ── Templates ───────────────────────────── */
const NOTES_BUILTIN_TEMPLATES={
  '1on1':{title:'1-to-1 — [Name]',body:'<h2>1-to-1 Notes</h2><p><strong>Date:</strong> </p><h3>How are they doing?</h3><p></p><h3>Wins this week</h3><ul><li></li></ul><h3>Challenges / blockers</h3><ul><li></li></ul><h3>Action items</h3><div><input type="checkbox"> <span contenteditable="true">Item 1</span></div><div><input type="checkbox"> <span contenteditable="true">Item 2</span></div>'},
  'perf':{title:'Performance Review — [Name]',body:'<h2>Performance Review</h2><p><strong>Period:</strong> </p><h3>Strengths</h3><p></p><h3>Areas for development</h3><p></p><h3>Goals set</h3><ul><li></li></ul><h3>Overall rating</h3><p></p>'},
  'action':{title:'Action Items',body:'<h2>Action Items</h2><p><strong>Date:</strong> </p><div><input type="checkbox"> <span contenteditable="true">Action item</span></div><div><input type="checkbox"> <span contenteditable="true">Action item</span></div><div><input type="checkbox"> <span contenteditable="true">Action item</span></div>'},
  'onboard':{title:'Onboarding — [Name]',body:'<h2>Onboarding Checklist</h2><div><input type="checkbox"> <span contenteditable="true">Set up accounts & access</span></div><div><input type="checkbox"> <span contenteditable="true">Intro to team</span></div><div><input type="checkbox"> <span contenteditable="true">Systems walkthrough</span></div><div><input type="checkbox"> <span contenteditable="true">First week check-in</span></div><div><input type="checkbox"> <span contenteditable="true">30-day review</span></div>'},
  'meeting':{title:'Meeting Notes — [Topic]',body:'<h2>Meeting Notes</h2><p><strong>Date:</strong> &nbsp;&nbsp;<strong>Attendees:</strong> </p><h3>Agenda</h3><ul><li></li></ul><h3>Discussion</h3><p></p><h3>Decisions made</h3><p></p><h3>Next steps</h3><div><input type="checkbox"> <span contenteditable="true">Action</span></div>'}
};

function notesApplyTemplate(){
  const sel=document.getElementById('n-tmpl-sel');
  if(!sel||!sel.value)return;
  const tmpl=NOTES_BUILTIN_TEMPLATES[sel.value];
  if(!tmpl)return;
  if(!notesActiveNoteId){showToast('Open or create a note first','error');sel.value='';return;}
  if(!confirm('Apply template? This will replace the current content.'))return;
  document.getElementById('n-title').value=tmpl.title;
  document.getElementById('n-body').innerHTML=tmpl.body;
  notesMarkDirty();
  sel.value='';
}

function notesRenderSavedTemplates(){
  const sel=document.getElementById('n-saved-tmpl-sel');
  if(!sel)return;
  sel.innerHTML='<option value="">— saved templates —</option>'+(notesData.savedTemplates||[]).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
}

function notesApplySavedTemplate(){
  const sel=document.getElementById('n-saved-tmpl-sel');
  if(!sel||!sel.value)return;
  const tmpl=(notesData.savedTemplates||[]).find(t=>t.id===sel.value);
  if(!tmpl)return;
  if(!notesActiveNoteId){showToast('Open or create a note first','error');sel.value='';return;}
  if(!confirm('Apply template? This will replace the current content.'))return;
  document.getElementById('n-title').value=tmpl.title||'';
  document.getElementById('n-body').innerHTML=tmpl.body||'';
  notesMarkDirty();
  sel.value='';
}

function notesSaveAsTemplate(){
  if(!notesActiveNoteId){showToast('Open a note first','error');return;}
  const name=prompt('Template name:');
  if(!name)return;
  const title=document.getElementById('n-title').value||'';
  const body=document.getElementById('n-body').innerHTML||'';
  if(!notesData.savedTemplates)notesData.savedTemplates=[];
  notesData.savedTemplates.push({id:'stmpl_'+Date.now(),name,title,body});
  notesSave();
  notesRenderSavedTemplates();
  showToast(`Template "${name}" saved ✓`,'success');
}

/* ── Version history ─────────────────────── */
function notesShowHistory(){
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note)return;
  const list=document.getElementById('n-hist-list');
  const hist=note.history||[];
  if(!hist.length){list.innerHTML='<div style="font-size:13px;color:var(--muted);">No history yet — versions are saved automatically as you edit.</div>';}
  else{
    list.innerHTML=hist.map((h,i)=>{
      const d=new Date(h.savedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      const preview=(h.html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
      return`<div class="n-hist-item" onclick="notesRestoreHistory(${i})">
        <div class="n-hist-meta">${d} — version ${hist.length-i}</div>
        <div class="n-hist-preview">${esc(preview)||'(empty)'}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('n-hist-backdrop').style.display='flex';
}

function notesCloseHistory(){document.getElementById('n-hist-backdrop').style.display='none';}

function notesRestoreHistory(idx){
  const note=notesData.notes.find(n=>n.id===notesActiveNoteId);
  if(!note||!note.history||!note.history[idx])return;
  if(!confirm('Restore this version? Your current content will be saved to history first.'))return;
  // Save current as new history entry first
  note.history.unshift({html:note.body,savedAt:new Date().toISOString()});
  const restored=note.history.splice(idx+1,1)[0];
  document.getElementById('n-body').innerHTML=restored.html||'';
  notesMarkDirty();
  notesCloseHistory();
  showToast('Version restored ✓','success');
}

/* ── Folder modal ────────────────────────── */
function notesShowFolderModal(){
  notesFolderPickedColor=NOTE_COLOURS[0];
  const row=document.getElementById('nf-colour-row');
  row.innerHTML=NOTE_COLOURS.map(c=>`<div class="nf-swatch ${c===notesFolderPickedColor?'sel':''}" style="background:${c};" onclick="notesFolderPickColor(this,'${c}')"></div>`).join('');
  document.getElementById('nf-name-input').value='';
  document.getElementById('nf-modal-backdrop').style.display='flex';
  setTimeout(()=>document.getElementById('nf-name-input').focus(),50);
}

function notesCloseFolderModal(){document.getElementById('nf-modal-backdrop').style.display='none';}

function notesFolderPickColor(el,color){
  notesFolderPickedColor=color;
  document.querySelectorAll('.nf-swatch').forEach(s=>s.classList.remove('sel'));
  el.classList.add('sel');
}

function notesSaveFolder(){
  const name=(document.getElementById('nf-name-input').value||'').trim();
  if(!name){showToast('Enter a folder name','error');return;}
  const id='folder_'+Date.now();
  notesData.folders.push({id,name,color:notesFolderPickedColor});
  notesCloseFolderModal();
  notesSave();notesRenderFolders();notesRenderList();
  showToast(`Folder "${name}" created ✓`,'success');
}

// Initialise notes on load
document.addEventListener('DOMContentLoaded',()=>{notesInit();});

/* ══════════════════════════════════════════
   DAILY PLANNER
══════════════════════════════════════════ */
let dpActiveDayIdx = 0;       // 0=Mon … 4=Fri
let dpData = {};              // { 'YYYY-MM-DD': { daily:{…}, events:[…] } }
// ── Planner guest entry point ──────────────────────────
async function dpGuestInit(){
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');
  if(!guestGroupKey){
    loginScreen.innerHTML=`<div class="login-box"><div class="login-logo">The <span>Back Office</span></div><h2 style="font-size:18px;margin-bottom:8px;text-align:center;">Invalid link</h2><p style="color:var(--muted);font-size:13px;text-align:center;">Ask the manager to share a new link.</p></div>`;
    return;
  }

  // Hide login, show app in guest mode (planner only)
  loginScreen.style.display = 'none';
  appShell.style.display = 'flex';
  // Hide sidebar entirely for guests
  const sidebar = appShell.querySelector('.sidebar');
  if(sidebar) sidebar.style.display = 'none';
  // Show planner tab only
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  const plannerTab = document.getElementById('ptab-planner');
  if(plannerTab) plannerTab.classList.add('active');
  // Guest header in planner topbar
  const topbarTitle = plannerTab.querySelector('.topbar-title');
  if(topbarTitle) topbarTitle.textContent = 'Daily Planner — Guest View';
  // Hide the hamburger menu button (no sidebar for guests)
  const menuBtn = plannerTab.querySelector('.mob-menu-btn');
  if(menuBtn) menuBtn.style.display = 'none';

  // Set up planner state using the groupKey from the URL
  dpGroupKey = guestGroupKey;
  dpGroupMembers = [];
  dpAdminAssigned = true;

  // Init the day tabs and load data
  const dates = dpGetWeekDates();
  const todayStr = dpLocalDateStr(new Date());
  const todayIdx = dates.indexOf(todayStr);
  if(todayIdx >= 0) dpActiveDayIdx = todayIdx;
  dpInitDone = true;

  const pill = document.getElementById('dp-week-pill');
  if(pill) pill.textContent = `w/c ${dpDateLabel(dates[0]).replace(/^[A-Za-z]+,? /,'')}`;
  const tabsEl = document.getElementById('dp-day-tabs');
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  tabsEl.innerHTML = days.map((d,i)=>`<button class="dp-day-tab ${i===dpActiveDayIdx?'active':''}" onclick="dpSwitchDay(${i})">${d} <span style="font-weight:400;opacity:.7;">${dpDateLabel(dates[i]).split(' ').slice(1).join(' ')}</span></button>`).join('');

  // Load planner data and start live poll
  try {
    const results = await Promise.all(dates.map(date=>api({action:'getDailyPlanner',manager:dpGroupKey,date})));
    results.forEach((res,i)=>{
      if(res.data){try{dpData[dates[i]]=JSON.parse(res.data);}catch(e){dpData[dates[i]]=dpBlank();}}
      else{if(!dpData[dates[i]])dpData[dates[i]]=dpBlank();}
    });
  } catch(e) {
    dates.forEach(d=>{if(!dpData[d])dpData[d]=dpBlank();});
  }
  dpRenderDay();
  dpStartPoll();
}

async function dpShareLink(){
  if(!dpGroupKey){showToast('Planner not assigned yet','error');return;}
  try{
    const gk = btoa(dpGroupKey);
    const base = location.origin + location.pathname;
    const url = `${base}?name=${encodeURIComponent(managerName)}&plannerGuest=1&gk=${encodeURIComponent(gk)}`;
    await navigator.clipboard.writeText(url);
    showToast('Share link copied ✓','success',3500);
  }catch(e){
    showToast('Could not copy — try again','error');
  }
}

let dpSharedWith = [];        // manager names in my planner group
let dpSharedFrom = [];        // (legacy — kept for compat)
let dpSaveDirtyTimer = null;
let dpInitDone = false;
let dpGroupMembers = [];      // all managers in my group (incl. me)
let dpGroupKey = null;        // group name used as shared storage key
let dpPollTimer = null;       // live-poll interval
let dpLastSavedHash = '';     // for detecting remote changes
let dpPollInitialised = false; // true after first load sets the baseline hash
let dpAdminAssigned = false;  // true = admin controls the group, button hidden

// Get Mon-Fri dates for the current week
function dpLocalDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dy = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dy}`;
}

function dpGetWeekDates(){
  const d = new Date();
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const mon = new Date(d); mon.setHours(0,0,0,0); mon.setDate(d.getDate() - dow);
  const dates = [];
  for(let i=0;i<5;i++){
    const dd = new Date(mon); dd.setDate(mon.getDate()+i);
    dates.push(dpLocalDateStr(dd));
  }
  return dates;
}

function dpDateLabel(iso){
  const d = new Date(iso+'T12:00:00');
  return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
}

function dpInit(){
  const dates = dpGetWeekDates();
  // Work out today's index FIRST before building anything
  if(!dpInitDone){
    const todayStr = dpLocalDateStr(new Date());
    const todayIdx = dates.indexOf(todayStr);
    if(todayIdx>=0) dpActiveDayIdx = todayIdx;
    dpInitDone = true;
  }
  // Update week pill
  const pill = document.getElementById('dp-week-pill');
  if(pill) pill.textContent = `w/c ${dpDateLabel(dates[0]).replace(/^[A-Za-z]+,? /,'')}`;
  // Build day tabs with correct active state
  const tabsEl = document.getElementById('dp-day-tabs');
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  tabsEl.innerHTML = days.map((d,i)=>`<button class="dp-day-tab ${i===dpActiveDayIdx?'active':''}" onclick="dpSwitchDay(${i})">${d} <span style="font-weight:400;opacity:.7;">${dpDateLabel(dates[i]).split(' ').slice(1).join(' ')}</span></button>`).join('');
  dpLoadAndRender();
}

async function dpFetchGroup(){
  const prefRes = await api({action:'getDpSharing',manager:managerName});
  dpSharedWith = prefRes.sharedWith||[];
  dpAdminAssigned = prefRes.adminAssigned||false;
  if(!dpAdminAssigned) return false;
  dpGroupMembers = [managerName, ...dpSharedWith].sort();
  dpGroupKey = 'group::' + (prefRes.groupId||prefRes.groupName||dpGroupMembers.join(','));
  const badge = document.getElementById('dp-shared-badge');
  if(badge) badge.style.display = dpSharedWith.length?'':'none';
  // Show share button for managers with an assigned group
  const shareBtn = document.getElementById('dp-share-btn');
  if(shareBtn && !guestMode) shareBtn.style.display = '';
  return true;
}

async function dpLoadAndRender(silent=false){
  const dates = dpGetWeekDates();
  try{
    const assigned = await dpFetchGroup();
    if(!assigned){
      dpRenderLocked();
      return;
    }
    // Load all 5 days from the group owner's planner
    const results = await Promise.all(dates.map(date=>api({action:'getDailyPlanner',manager:dpGroupKey,date})));
    results.forEach((res,i)=>{
      if(res.data){
        try{dpData[dates[i]]=JSON.parse(res.data);}catch(e){dpData[dates[i]]=dpBlank();}
      } else {
        if(!dpData[dates[i]])dpData[dates[i]]=dpBlank();
      }
    });
  }catch(e){
    dates.forEach(d=>{if(!dpData[d])dpData[d]=dpBlank();});
  }
  dpRenderDay();
  dpStartPoll();
}

function dpRenderLocked(){
  clearInterval(dpPollTimer);
  const wrap = document.getElementById('dp-pages-wrap');
  if(wrap) wrap.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:340px;gap:14px;color:var(--muted);text-align:center;padding:32px;">
      <div style="color:var(--muted);">${SVG.lock.replace('width="16" height="16"','width="36" height="36"')}</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);">Planner not assigned</div>
      <div style="font-size:13px;max-width:300px;line-height:1.6;">Your admin hasn't assigned you to a planner group yet. Ask them to set this up in the Planner Groups tab.</div>
    </div>`;
  // Hide day tabs and save bar so there's nothing to interact with
  const tabs = document.getElementById('dp-day-tabs');
  const saveBar = document.querySelector('.dp-save-bar');
  if(tabs) tabs.style.visibility = 'hidden';
  if(saveBar) saveBar.style.visibility = 'hidden';
}

async function dpPollForChanges(){
  try{
    const prevKey = dpGroupKey;
    const assigned = await dpFetchGroup();
    if(!assigned){
      clearInterval(dpPollTimer);
      dpRenderLocked();
      return;
    }
    if(prevKey && prevKey !== dpGroupKey){
        dpLastSavedHash = '';
      dpPollInitialised = false;
      await dpLoadAndRender();
      return;
    }
    const dates = dpGetWeekDates();
    const date = dates[dpActiveDayIdx];
    const res = await api({action:'getDailyPlanner',manager:dpGroupKey,date});
    const incoming = res.data || null;
    if(incoming){
      if(dpPollInitialised && incoming !== dpLastSavedHash){
        const active = document.activeElement;
        const editing = active && (active.tagName==='TEXTAREA'||active.tagName==='INPUT') && document.getElementById('dp-pages-wrap')?.contains(active);
            if(!editing){
          try{dpData[date]=JSON.parse(incoming);}catch(e){}
          dpLastSavedHash = incoming;
          dpRenderDay();
          dpSetSyncStatus('saved','Updated by teammate ✓');
          setTimeout(()=>dpSetSyncStatus('',''), 3000);
        } else {
          dpLastSavedHash = incoming;
        }
      } else {
        dpLastSavedHash = incoming;
        if(!dpPollInitialised){ dpRenderDay(); }
        dpPollInitialised = true;
      }
    } else {
        dpPollInitialised = true;
    }
  }catch(e){}
}

function dpStartPoll(){
  clearInterval(dpPollTimer);
  // Always poll — the poll itself re-fetches group membership each tick
  dpPollTimer = setInterval(dpPollForChanges, 4000);
}

function dpBlank(){
  return {
    daily:{
      trainees:[],solo:[],leaders:[],
      lmNotes:'',lmUnder:'',lmEqual:'',lmOver:'',
      tpt1:'',tpt2:'',
      announcements:'',topPerformers:'',
      keyConversations:'',sitDowns:'',morningMeeting:''
    },
    events:[
      {q:['','','',''],location:''},
      {q:['','','',''],location:''},
      {q:['','','',''],location:''},
      {q:['','','',''],location:''},
      {q:['','','',''],location:''},
      {q:['','','',''],location:''}
    ]
  };
}

function dpSwitchDay(idx){
  dpFlushCurrentDay();
  dpActiveDayIdx = idx;
  dpLastSavedHash = '';
  dpPollInitialised = false;
  document.querySelectorAll('.dp-day-tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  dpRenderDay();
}

function dpRenderDay(){
  // Ensure tabs/save bar visible (may have been hidden by dpRenderLocked)
  const tabs = document.getElementById('dp-day-tabs');
  const saveBar = document.querySelector('.dp-save-bar');
  if(tabs) tabs.style.visibility = '';
  if(saveBar) saveBar.style.visibility = '';
  const dates = dpGetWeekDates();
  const date = dates[dpActiveDayIdx];
  const data = dpData[date] || dpBlank();
  const d = data.daily;
  const events = data.events || dpBlank().events;

  // Collab bar HTML
  let collabBar = '';
  if(dpGroupMembers.length>1){
    const avatars = dpGroupMembers.map(m=>{
      const initial = m.charAt(0).toUpperCase();
      const isMe = m===managerName;
      return `<div class="dp-collab-avatar" title="${esc(m.charAt(0).toUpperCase()+m.slice(1))}${isMe?' (you)':''}" style="${isMe?'background:var(--accent);':'background:#6b7280;'}">${initial}</div>`;
    }).join('');
    const groupNames = dpGroupMembers.filter(m=>m!==managerName).map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(', ');
    const adminLabel = dpAdminAssigned ? ' <span style="font-size:10px;opacity:.7;font-weight:400;">(assigned by admin)</span>' : '';
    collabBar = `<div class="dp-collab-bar">
      <div class="dp-live-dot"></div>
      <div class="dp-collab-avatars">${avatars}</div>
      <span>Live group planner — editing with ${esc(groupNames)}${adminLabel}</span>
    </div>`;
  }

  // Build planner pages HTML
  const pagesHtml = dpRenderDailyPageHTML(d, events, date, false, managerName);

  // Wrap in A4 container
  const html = `${collabBar}<div class="dp-page-a4-wrap">${pagesHtml}</div>`;

  document.getElementById('dp-pages-wrap').innerHTML = html;
  // Store hash of loaded data for poll comparison
  // Baseline hash set by first successful poll, not here
}

function dpToggleSharedView(btn){
  const content = btn.closest('[style*="border:1px solid var(--accent-border)"]').querySelector('.dp-shared-day-content');
  if(!content)return;
  const collapsed = content.style.display==='none';
  content.style.display = collapsed?'':'none';
  btn.textContent = collapsed?'▼ Collapse':'▶ Expand';
}

function dpRenderDailyPageHTML(d, events, date, readOnly, mgrName){
  const ro = readOnly ? 'disabled' : '';
  const dn = mgrName.charAt(0).toUpperCase()+mgrName.slice(1);
  const dateStr = dpDateLabel(date);

  // Helper to make a textarea/input
  const ta = (id, val, rows, ph='') => `<textarea class="dp-field" ${ro} rows="${rows}" placeholder="${ph}" id="${readOnly?'ro_':''}${id}" oninput="${readOnly?'':'dpMarkDirty()'}">${esc(val||'')}</textarea>`;
  const inp = (id, val, ph='') => `<input class="dp-field" ${ro} type="text" placeholder="${ph}" id="${readOnly?'ro_':''}${id}" value="${esc(val||'')}" oninput="${readOnly?'':'dpMarkDirty()'}"/>`;

  // Team columns: trainees, solo, leaders (arrays stored as newline-separated strings)
  const trainees = Array.isArray(d.trainees)?d.trainees.join('\n'):(d.trainees||'');
  const solo = Array.isArray(d.solo)?d.solo.join('\n'):(d.solo||'');
  const leaders = Array.isArray(d.leaders)?d.leaders.join('\n'):(d.leaders||'');

  let html = `
  <!-- PAGE 1: Daily Planner -->
  <div class="dp-page">
    <div class="dp-page-hdr">
      <span class="dp-page-hdr-title">${esc(dn)}'s Daily Planner</span>
      <span class="dp-page-hdr-date">${dateStr}</span>
    </div>
    <div class="dp-page-body">

      <!-- Team columns -->
      <div class="dp-sec-lbl">Team</div>
      <div class="dp-team-row">
        <div class="dp-team-col">
          <div class="dp-team-col-hdr">Trainees</div>
          <div class="dp-team-body">${ta('dp-trainees',trainees,8,'Names…')}</div>
        </div>
        <div class="dp-team-col">
          <div class="dp-team-col-hdr">Solo</div>
          <div class="dp-team-body">${ta('dp-solo',solo,8,'Names…')}</div>
        </div>
        <div class="dp-team-col">
          <div class="dp-team-col-hdr">Leaders</div>
          <div class="dp-team-body">${ta('dp-leaders',leaders,8,'Names…')}</div>
        </div>
        <div class="dp-team-col">
          <div class="dp-team-col-hdr accent">Leaders Meeting</div>
          <div class="dp-lm-top">${ta('dp-lm-notes',d.lmNotes,2,'Notes…')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;">
            <div class="dp-lm-cell-hdr">Under</div>
            <div class="dp-lm-cell-hdr">Equal</div>
            <div class="dp-lm-cell-hdr">Over</div>
          </div>
          <div class="dp-lm-grid">
            <div class="dp-lm-cell">${ta('dp-lm-under',d.lmUnder,5,'')}</div>
            <div class="dp-lm-cell">${ta('dp-lm-equal',d.lmEqual,5,'')}</div>
            <div class="dp-lm-cell">${ta('dp-lm-over',d.lmOver,5,'')}</div>
          </div>
        </div>
      </div>

      <!-- TPT 1 & 2 -->
      <div class="dp-tpt-row">
        <div class="dp-tpt-box">
          <div class="dp-tpt-lbl">TPT 1</div>
          <textarea class="dp-tpt-input" ${ro} placeholder="Top Performer Talk 1…" id="${readOnly?'ro_':''}dp-tpt1" oninput="${readOnly?'':'dpMarkDirty()'}">${esc(d.tpt1||'')}</textarea>
        </div>
        <div class="dp-tpt-box">
          <div class="dp-tpt-lbl">TPT 2</div>
          <textarea class="dp-tpt-input" ${ro} placeholder="Top Performer Talk 2…" id="${readOnly?'ro_':''}dp-tpt2" oninput="${readOnly?'':'dpMarkDirty()'}">${esc(d.tpt2||'')}</textarea>
        </div>
      </div>

      <!-- Announcements + Top Performers -->
      <div class="dp-bottom-grid">
        <div class="dp-section-box">
          <div class="dp-section-box-hdr accent">Announcements</div>
          <div class="dp-section-box-body">${ta('dp-announcements',d.announcements,6,'')}</div>
        </div>
        <div class="dp-section-box">
          <div class="dp-section-box-hdr">Top Performers</div>
          <div class="dp-section-box-body">${ta('dp-top-performers',d.topPerformers,6,'')}</div>
        </div>
      </div>

      <!-- Key Conversations / Sit Downs / Morning Meeting -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div class="dp-section-box">
          <div class="dp-section-box-hdr">Key Conversations</div>
          <div class="dp-section-box-body">${ta('dp-key-convos',d.keyConversations,4,'')}</div>
        </div>
        <div class="dp-section-box">
          <div class="dp-section-box-hdr">Sit Downs / Dinners</div>
          <div class="dp-section-box-body">${ta('dp-sit-downs',d.sitDowns,4,'')}</div>
        </div>
        <div class="dp-section-box">
          <div class="dp-section-box-hdr">Morning Meeting</div>
          <div class="dp-section-box-body">${ta('dp-morning',d.morningMeeting,4,'')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: Event Planner -->
  <div class="dp-page">
    <div class="dp-page-hdr">
      <span class="dp-page-hdr-title">${esc(dn)}'s Event Planner</span>
      <span class="dp-page-hdr-date">${dateStr}</span>
    </div>
    <div class="dp-event-grid">`;

  events.forEach((ev,i)=>{
    const prefix = readOnly ? `ro_ev${i}` : `ev${i}`;
    html += `
      <div class="dp-event-box">
        <div class="dp-event-box-hdr">
          <span class="dp-event-box-num">Event ${i+1}</span>
        </div>
        <div class="dp-event-quadrant">
          <div class="dp-event-qnames" style="position:relative;z-index:1;">
            <textarea class="dp-event-qname" ${ro} placeholder="Name…" id="${prefix}-q0" oninput="${readOnly?'':'dpMarkDirty()'}"\
 style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);">${esc(ev.q?.[0]||'')}</textarea>
            <textarea class="dp-event-qname" ${ro} placeholder="Name…" id="${prefix}-q1" oninput="${readOnly?'':'dpMarkDirty()'}"\
 style="border-bottom:1px solid var(--border);">${esc(ev.q?.[1]||'')}</textarea>
            <textarea class="dp-event-qname" ${ro} placeholder="Name…" id="${prefix}-q2" oninput="${readOnly?'':'dpMarkDirty()'}"\
 style="border-right:1px solid var(--border);">${esc(ev.q?.[2]||'')}</textarea>
            <textarea class="dp-event-qname" ${ro} placeholder="Name…" id="${prefix}-q3" oninput="${readOnly?'':'dpMarkDirty()'}\">${esc(ev.q?.[3]||'')}</textarea>
          </div>
        </div>
        <div class="dp-event-footer" style="display:block;">
          <div class="dp-event-footer-cell" style="width:100%;">
            <div class="dp-event-footer-lbl"><svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 2C7.24 2 5 4.24 5 7c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="7" r="1.5"/></svg>Location</div>
            <input class="dp-event-footer-input" ${ro} type="text" id="${prefix}-loc" value="${esc(ev.location||'')}" placeholder="Enter location…" oninput="${readOnly?'':'dpMarkDirty()'}"/>
          </div>
        </div>
      </div>`;
  });

  html += `
    </div>
  </div>`;

  return html;
}

/* ── Flush / save ─────────────────────────── */
function dpMarkDirty(){
  clearTimeout(dpSaveDirtyTimer);
  dpSetSyncStatus('saving','Saving…');
  dpSaveDirtyTimer = setTimeout(()=>{ dpFlushCurrentDay(); dpSaveCurrentDay(); }, 1200);
}

function dpSetSyncStatus(state, msg){
  const st = document.getElementById('dp-save-status');
  if(!st) return;
  if(!msg){ st.innerHTML=''; return; }
  st.innerHTML = `<span class="dp-sync-dot ${state}"></span>${msg}`;
}

function dpFlushCurrentDay(){
  const dates = dpGetWeekDates();
  const date = dates[dpActiveDayIdx];
  if(!dpData[date]) dpData[date] = dpBlank();
  const d = dpData[date].daily;
  const events = dpData[date].events;

  const g = id => { const el=document.getElementById(id); return el?el.value:''; };

  d.trainees = g('dp-trainees');
  d.solo = g('dp-solo');
  d.leaders = g('dp-leaders');
  d.lmNotes = g('dp-lm-notes');
  d.lmUnder = g('dp-lm-under');
  d.lmEqual = g('dp-lm-equal');
  d.lmOver = g('dp-lm-over');
  d.tpt1 = g('dp-tpt1');
  d.tpt2 = g('dp-tpt2');
  d.announcements = g('dp-announcements');
  d.topPerformers = g('dp-top-performers');
  d.keyConversations = g('dp-key-convos');
  d.sitDowns = g('dp-sit-downs');
  d.morningMeeting = g('dp-morning');

  events.forEach((ev,i)=>{
    ev.q = [g(`ev${i}-q0`),g(`ev${i}-q1`),g(`ev${i}-q2`),g(`ev${i}-q3`)];
    ev.location = g(`ev${i}-loc`);
  });
}

async function dpSaveCurrentDay(){
  const dates = dpGetWeekDates();
  const date = dates[dpActiveDayIdx];
  const owner = dpGroupKey||managerName;
  const payload = JSON.stringify(dpData[date]);
  try{
    await api({action:'saveDailyPlanner',manager:owner,date,data:payload});
    dpLastSavedHash = payload;
    dpSetSyncStatus('saved','Saved ✓');
    setTimeout(()=>dpSetSyncStatus('',''), 2500);
  }catch(e){
    dpSetSyncStatus('error','Save failed — check connection');
  }
}



/* ═══════════════════════════════════════════════════════
   REP PAY REPORTS — embedded pay-report viewer
   Reads from the same Week Index tab used by index.html
   ═══════════════════════════════════════════════════════ */

// ── Config — loaded from backend settings sheet on init ──
// Falls back to localStorage if backend fetch fails (set via admin Setup tab)
let RP_INDEX_URL = localStorage.getItem('tt_pay_index_url') || '';

// ── State ──
let rp_weekIndex   = [];   // [{label, url}] newest first
let rp_activeIdx   = 0;
let rp_activeUrl   = '';
let rp_activeLabel = '';
let rp_csvRows     = null; // raw parsed CSV rows for current week
let rp_csvHeaders  = null;
let rp_initialized = false;
let rp_loading     = false;
let rp_repWeeksWithData = new Set();
let rp_historyLoaded = false;
let rp_view        = 'team'; // 'team' | 'rep'
let rp_activeRep   = null;
const rp_csvCache  = new Map(); // url → parsed rows, shared across pay tab + scorecard

// ── Helpers ──
function rp_clean(v){return(v==null||v==='')?'0':String(v).trim();}
function rp_num(v){return parseFloat(rp_clean(v).replace(/[^0-9.-]/g,''))||0;}
function rp_fmt(n){return'£'+Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});}
function rp_initials(name){return(name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}
function rp_avatarStyle(name){
  /* Hash the name into one of the 5 vibrant position palette colours.
     Same palette used everywhere — pay tab, leaderboard, reps, dashboard. */
  const palette=[
    {bg:'#a7ffdb',color:'#007a4d',border:'#00c97a'},  // mint (Trainee)
    {bg:'#b3d4ff',color:'#1140cc',border:'#1d50ff'},  // blue (Leader)
    {bg:'#d4b8ff',color:'#5b1fd6',border:'#6e2ff0'},  // purple (Core)
    {bg:'#ffe0a0',color:'#b85c00',border:'#f08000'},  // orange (Solo)
    {bg:'#ffb8cc',color:'#c4002e',border:'#f0004d'},  // pink (Junior Partner+)
  ];
  let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))&0xffff;
  const c=palette[h%palette.length];
  return`background:${c.bg};color:${c.color};border:none;`;
}
function rp_posClass(name){
  const rep=roster.find(r=>(r.name||'').trim().toLowerCase()===(name||'').trim().toLowerCase());
  return rep?posClass(rep.position||''):'';
}
function rp_rateClass(rate){return rate>=80?'good':rate>=60?'warn':'bad';}
function rp_barColor(rate){return rate>=80?'#639922':rate>=60?'#BA7517':'#E24B4A';}

const RP_SVG={
  send:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  alert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  thumbs:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>`,
  tag:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  chev:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>`,
};

// ── Count-up ──
function rp_countUp(el,target,prefix,decimals,duration){
  if(!el)return;
  const neg=target<0,abs=Math.abs(target),start=performance.now();
  function step(now){
    const p=Math.min((now-start)/duration,1),e=p===1?1:1-Math.pow(2,-10*p);
    el.textContent=(neg?'-':'')+prefix+(e*abs).toLocaleString('en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── CSV parser ──
function rp_parseCSV(text){
  const rows=[];let row=[],current='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'&&q&&n==='"'){current+='"';i++;}
    else if(c==='"'){q=!q;}
    else if(c===','&&!q){row.push(current);current='';}
    else if((c==='\n'||c==='\r')&&!q){
      if(current!==''||row.length){row.push(current);rows.push(row);}
      row=[];current='';if(c==='\r'&&n==='\n')i++;
    }else{current+=c;}
  }
  if(current!==''||row.length){row.push(current);rows.push(row);}
  return rows;
}

// ── Week selector HTML ──
function rp_weekSelectorHTML(){
  if(!rp_weekIndex.length)return'';
  if(rp_weekIndex.length===1)return`<span class="rp-week-badge">${esc(rp_activeLabel)}</span>`;
  const opts=rp_weekIndex.map((w,i)=>`<option value="${i}"${i===rp_activeIdx?' selected':''}>${esc(w.label)}</option>`).join('');
  return`<div class="rp-week-sel-wrap">
    <select class="rp-week-sel" onchange="rp_switchWeek(this.value)">${opts}</select>
    <svg viewBox="0 0 14 14" fill="none" style="width:9px;height:9px;flex-shrink:0;pointer-events:none;opacity:0.7"><path d="M2 4.5l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>`;
}

function rp_updateWeekSelector(){
  const wrap=document.getElementById('rp-week-selector-wrap');
  if(wrap)wrap.innerHTML=rp_weekSelectorHTML();
}

// ── Init ──
async function rpInit(){
  if(rp_loading)return;
  // If week index is already loaded just re-render
  if(rp_initialized&&rp_weekIndex.length){
    rp_renderRoot();
    rp_updateWeekSelector();
    return;
  }

  const root=document.getElementById('rp-root');
  if(!root)return;

  // Try to fetch URL from backend if not already known
  if(!RP_INDEX_URL){
    try{
      const res=await api({action:'getPayIndexUrl'});
      if(res&&res.url){
        RP_INDEX_URL=res.url;
        localStorage.setItem('tt_pay_index_url',res.url);
      }
    }catch(e){}
  }

  // No index URL configured
  if(!RP_INDEX_URL){
    root.innerHTML=`<div class="rp-no-index">
      <div class="rp-no-index-title">${SVG.chart} Pay Reports not configured</div>
      <div class="rp-no-index-sub">
        To enable rep pay reports, set your Week Index URL in the admin Setup tab or run this once in the browser console:<br><br>
        <code>localStorage.setItem('tt_pay_index_url', 'YOUR_INDEX_URL')</code><br><br>
        The URL should be your Google Sheet's Week Index tab in CSV format:
        <code>https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=Week%20Index</code>
      </div>
    </div>`;
    return;
  }

  rp_loading=true;
  root.innerHTML=`<div class="rp-loading"><div class="rp-spinner"></div>Loading week index…</div>`;
  document.getElementById('rp-week-selector-wrap').innerHTML='';

  try{
    const text=await(await fetch(RP_INDEX_URL)).text();
    const rows=rp_parseCSV(text);
    // Header row: Week | Sheet ID | URL
    rp_weekIndex=rows.slice(1)
      .map(r=>({label:(r[0]||'').trim(),url:(r[2]||'').trim()}))
      .filter(r=>r.label&&r.url)
      .reverse(); // newest first
  }catch(e){
    root.innerHTML=`<div class="rp-no-index">
      <div class="rp-no-index-title">${SVG.warning} Could not load week index</div>
      <div class="rp-no-index-sub">Check that RP_INDEX_URL is correct and the sheet is shared publicly.<br><br>Error: ${esc(String(e))}</div>
    </div>`;
    rp_loading=false;return;
  }

  if(!rp_weekIndex.length){
    root.innerHTML=`<div class="rp-no-index"><div class="rp-no-index-title">${SVG.inbox} No weeks found</div><div class="rp-no-index-sub">The Week Index sheet appears to be empty.</div></div>`;
    rp_loading=false;return;
  }

  rp_activeIdx=0;
  rp_activeUrl=rp_weekIndex[0].url;
  rp_activeLabel=rp_weekIndex[0].label;
  rp_initialized=true;
  rp_loading=false;

  rp_updateWeekSelector();
  await rp_loadWeek(rp_activeUrl);
}

async function rp_switchWeek(idx){
  idx=parseInt(idx,10);
  const entry=rp_weekIndex[idx];
  if(!entry)return;
  rp_activeIdx=idx;
  rp_activeUrl=entry.url;
  rp_activeLabel=entry.label;
  rp_view='team';
  rp_activeRep=null;
  rp_historyLoaded=false;
  await rp_loadWeek(rp_activeUrl);
}

async function rp_loadWeek(url){
  const root=document.getElementById('rp-root');
  if(!root)return;
  root.innerHTML=`<div class="rp-loading"><div class="rp-spinner"></div>Loading ${esc(rp_activeLabel)}…</div>`;
  try{
    let rows;
    if(rp_csvCache.has(url)){
      rows=rp_csvCache.get(url);
    }else{
      const text=await(await fetch(url)).text();
      rows=rp_parseCSV(text);
      rp_csvCache.set(url,rows);
    }
    rp_csvHeaders=rows[0].map(h=>h.trim());
    rp_csvRows=rows;
  }catch(e){
    root.innerHTML=`<div class="rp-no-index"><div class="rp-no-index-title">${SVG.warning} Failed to load data</div><div class="rp-no-index-sub">${esc(String(e))}</div></div>`;
    return;
  }
  rp_renderRoot();
}

function rp_renderRoot(){
  if(rp_view==='rep'&&rp_activeRep){
    rp_renderRepReport(rp_activeRep);
  }else{
    rp_renderTeamView();
  }
}

// ── Roster match helper ──
// Normalises both sides: collapse whitespace, strip punctuation, lowercase
function rp_normName(s){
  return (s||'').trim().toLowerCase()
    .replace(/\s+/g,' ')          // collapse multiple spaces
    .replace(/[''`]/g,"'")        // normalise apostrophes
    .replace(/[-–—]/g,'-');       // normalise dashes
}
function rp_matchRoster(csvName){
  const n=rp_normName(csvName);
  if(!n)return null;
  // 1. Exact normalised match (handles extra spaces, case, apostrophe variants)
  let m=roster.find(r=>!r.leaver&&rp_normName(r.name)===n);
  if(m)return m;
  // 2. First + last name match (ignores middle names / initials in either source)
  const csvParts=n.split(' ').filter(Boolean);
  if(csvParts.length>=2){
    const csvFirst=csvParts[0], csvLast=csvParts[csvParts.length-1];
    m=roster.find(r=>{
      if(r.leaver)return false;
      const rp=rp_normName(r.name).split(' ').filter(Boolean);
      return rp.length>=2&&rp[0]===csvFirst&&rp[rp.length-1]===csvLast;
    });
    if(m)return m;
  }
  // 3. Contains match — roster name is a substring of CSV name or vice versa
  m=roster.find(r=>{
    if(r.leaver)return false;
    const rn=rp_normName(r.name);
    return rn&&(n.includes(rn)||rn.includes(n));
  });
  return m||null;
}

// ── Team / manager view ──
function rp_renderTeamView(){
  const root=document.getElementById('rp-root');
  if(!root||!rp_csvRows||!rp_csvHeaders)return;

  const headers=rp_csvHeaders;
  const allData=rp_csvRows.slice(1).map(r=>{
    const d={};headers.forEach((h,i)=>d[h]=r[i]);return d;
  }).filter(d=>{
    const name=rp_clean(d['Name']);
    return name!=='0'&&name!=='';
  });

  if(!allData.length){
    root.innerHTML=`<div class="rp-empty"><div class="rp-empty-icon">${SVG.inbox.replace('width="16" height="16"','width="32" height="32"')}</div><strong style="color:var(--text);font-size:15px;">No data for ${esc(rp_activeLabel)}</strong><span style="font-size:13px;color:var(--muted);">No agents found in this week's sheet.</span></div>`;
    return;
  }

  // Filter by Office column — must match the manager's ?name= URL param
  const data=allData.filter(d=>rp_clean(d['Office']).toLowerCase()===managerName.toLowerCase());

  if(!data.length){
    root.innerHTML=`<div class="rp-empty"><div class="rp-empty-icon">${SVG.inbox.replace('width="16" height="16"','width="32" height="32"')}</div><strong style="color:var(--text);font-size:15px;">No data for your team</strong><span style="font-size:13px;color:var(--muted);">No rows found with Office = "${esc(managerName)}" in ${esc(rp_activeLabel)}</span></div>`;
    return;
  }

  const totalPay       =data.reduce((s,d)=>s+rp_num(d['Total Pay']),0);
  const totalSubmitted =data.reduce((s,d)=>s+rp_num(d['Submitted 1'])+rp_num(d['Submitted 2']),0);
  const totalPayable   =data.reduce((s,d)=>s+rp_num(d['Payable 1'])+rp_num(d['Payable 2']),0);
  const totalCancelled =totalSubmitted-totalPayable;
  const avgRate        =totalSubmitted>0?Math.round((totalPayable/totalSubmitted)*100):0;
  const rateState      =rp_rateClass(avgRate);

  const sorted=[...data].sort((a,b)=>rp_num(b['Total Pay'])-rp_num(a['Total Pay']));

  // Build set of pay CSV names (lowercased) for roster-absent detection
  const payNames=new Set(sorted.map(d=>rp_clean(d['Name']).toLowerCase()));

  const agentRows=sorted.map((d,i)=>{
    const name    =rp_clean(d['Name']);
    const pay     =rp_num(d['Total Pay']);
    const sub     =rp_num(d['Submitted 1'])+rp_num(d['Submitted 2']);
    const payable =rp_num(d['Payable 1'])+rp_num(d['Payable 2']);
    const rate    =sub>0?Math.round((payable/sub)*100):0;
    const rs      =rp_rateClass(rate);
    const barCol  =rp_barColor(rate);
    const subCls  =rs==='warn'?'rp-agent-sub warn-text':rs==='bad'?'rp-agent-sub bad-text':'rp-agent-sub';
    const rRep    =rp_matchRoster(name);
    const pos     =rRep?rRep.position||'':'';
    const posTag  =pos?`<span class="pos-tag ${posClass(pos)}" style="font-size:10px;padding:2px 7px;">${esc(pos)}</span>`
                      :rRep?'':`<span style="font-size:10px;color:var(--muted);font-style:italic;">not on roster</span>`;
    return`<div class="rp-agent-row" data-name="${esc(name.toLowerCase())}" onclick="rp_openRep(${esc(JSON.stringify(name))})">
      <div class="rp-rank${i===0?' gold':''}">${i+1}</div>
      <div class="rp-av" style="${avStyle(name,pos)}">${rp_initials(name)}</div>
      <div class="rp-agent-mid">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <div class="rp-agent-name">${esc(name)}</div>
          ${posTag}
        </div>
        <div class="rp-agent-rate-row">
          <div class="rp-rate-track"><div class="rp-rate-bar" style="width:${rate}%;background:${barCol}"></div></div>
          <span class="${subCls}">${rate}% · ${payable} payable</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <div class="rp-agent-pay">${rp_fmt(pay)}</div>
        <div class="rp-chev">${RP_SVG.chev}</div>
      </div>
    </div>`;
  }).join('');

  // Roster reps with NO pay data this week
  const absentRows=roster.filter(r=>!r.leaver&&!payNames.has((r.name||'').trim().toLowerCase()))
    .map(r=>{
      const ini=(r.name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const pos=r.position||'';
      return`<div class="rp-agent-row" style="opacity:.45;">
        <div class="rp-rank" style="background:transparent;"></div>
        <div class="rp-av" style="${avStyle(r.name,pos)}">${ini}</div>
        <div class="rp-agent-mid">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <div class="rp-agent-name">${esc(r.name)}</div>
            ${pos?`<span class="pos-tag ${posClass(pos)}" style="font-size:10px;padding:2px 7px;">${esc(pos)}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">No data this week</div>
        </div>
        <div style="font-size:12px;color:var(--muted);flex-shrink:0;">—</div>
      </div>`;
    }).join('');

  root.innerHTML=`
    <div class="rp-stat-grid">
      <div class="rp-stat">
        <div class="rp-stat-top">
          <div class="rp-stat-icon" style="background:var(--accent-soft);color:var(--accent);">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M14 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM2 9h16" stroke-linecap="round"/></svg>
          </div>
          <span class="rp-stat-chip ${rateState}">${avgRate}%</span>
        </div>
        <div class="rp-stat-val" id="rp-total-pay">£0</div>
        <div class="rp-stat-lbl">Total agent pay</div>
      </div>
      <div class="rp-stat">
        <div class="rp-stat-top">
          <div class="rp-stat-icon" style="background:var(--warning-soft);color:var(--warning);">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
        </div>
        <div class="rp-stat-val">${totalSubmitted}</div>
        <div class="rp-stat-lbl">Submitted</div>
      </div>
      <div class="rp-stat">
        <div class="rp-stat-top">
          <div class="rp-stat-icon" style="background:var(--success-soft);color:var(--success);">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="rp-stat-val">${totalPayable}</div>
        <div class="rp-stat-lbl">Payable</div>
      </div>
      <div class="rp-stat">
        <div class="rp-stat-top">
          <div class="rp-stat-icon" style="background:var(--danger-soft);color:var(--danger);">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div class="rp-stat-val${totalCancelled>0?' ' :''}" style="${totalCancelled>0?'color:var(--danger)':''}">${totalCancelled}</div>
        <div class="rp-stat-lbl">Cancelled</div>
      </div>
    </div>

    <div class="rp-card" style="margin-bottom:16px;">
      <div class="rp-conv-wrap" style="padding-top:18px;">
        <div class="rp-conv-header">
          <span class="rp-conv-label">Team payable rate</span>
          <span class="rp-conv-pct">${avgRate}%</span>
        </div>
        <div class="rp-conv-track"><div class="rp-conv-fill ${rateState}" id="rp-conv-fill"></div></div>
      </div>
    </div>

    <div class="nd-section-lbl">Agent leaderboard — ${data.length} agent${data.length!==1?'s':''}</div>
    <div class="rp-search-wrap">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="rp-search" id="rp-search" type="text" placeholder="Search agents…" oninput="rp_filterAgents()" autocomplete="off"/>
    </div>
    <div class="rp-card" id="rp-agent-list">${agentRows}${absentRows?`<div style="border-top:1px solid var(--niond-border);margin:0;padding:8px 18px 4px;font-size:10px;font-weight:700;color:var(--niond-muted);letter-spacing:.07em;text-transform:uppercase;">Not in this week's data</div>${absentRows}`:''}</div>
  `;

  requestAnimationFrame(()=>{
    setTimeout(()=>{
      rp_countUp(document.getElementById('rp-total-pay'),totalPay,'£',0,700);
      const fill=document.getElementById('rp-conv-fill');
      if(fill)fill.style.width=avgRate+'%';
    },80);
  });
}

function rp_filterAgents(){
  const q=(document.getElementById('rp-search')?.value||'').toLowerCase();
  document.querySelectorAll('.rp-agent-row').forEach(el=>{
    el.style.display=(el.dataset.name||'').includes(q)?'flex':'none';
  });
}

// ── Open individual rep ──
function rp_openRep(name){
  rp_view='rep';
  rp_activeRep=name;
  rp_historyLoaded=false;
  rp_renderRepReport(name);
  const scroll=document.getElementById('rp-scroll');
  if(scroll)scroll.scrollTop=0;
}

function rp_renderRepReport(name){
  const root=document.getElementById('rp-root');
  if(!root||!rp_csvRows||!rp_csvHeaders)return;

  const headers=rp_csvHeaders;
  const matchingRows=rp_csvRows.slice(1)
    .filter(r=>r[0]?.trim().toLowerCase()===name.trim().toLowerCase())
    .map(r=>{const d={};headers.forEach((h,i)=>d[h]=r[i]);return d;});

  if(!matchingRows.length){
    root.innerHTML=`<button class="rp-back-btn" onclick="rp_backToTeam()">← Back to team</button>
      <div class="rp-empty"><div class="rp-empty-icon">${SVG.inbox.replace('width="16" height="16"','width="32" height="32"')}</div>
        <strong style="color:var(--text);font-size:15px;">No data for ${esc(name)}</strong>
        <span style="font-size:13px;color:var(--muted);">No rows found in ${esc(rp_activeLabel)}</span>
      </div>`;
    return;
  }

  const rows=matchingRows;
  const primaryRow=rows[0];
  const nameVal    =rp_clean(primaryRow['Name']);
  const officeVal  =rp_clean(primaryRow['Office'])||'—';
  const rRep       =rp_matchRoster(nameVal);
  const repPos     =rRep?rRep.position||'':'';
  const multiCamp  =rows.length>1;

  const totalPay      =rows.reduce((s,r)=>s+rp_num(r['Total Pay']),0);
  const topUps        =rows.reduce((s,r)=>s+rp_num(r['Top Ups']),0);
  const tablet        =rows.reduce((s,r)=>s+rp_num(r['Tablet']),0);
  const dwm           =rows.reduce((s,r)=>s+rp_num(r['DWM Incentive']),0);
  const adj           =rows.reduce((s,r)=>s+rp_num(r['Adjustment']),0);
  const override      =rows.reduce((s,r)=>s+rp_num(r['Override']),0);
  const hasOverride   =override!==0;
  const submittedTotal=rows.reduce((s,r)=>s+rp_num(r['Submitted 1'])+rp_num(r['Submitted 2']),0);
  const payableTotal  =rows.reduce((s,r)=>s+rp_num(r['Payable 1'])+rp_num(r['Payable 2']),0);
  const cancelledTotal=submittedTotal-payableTotal;
  const pct           =submittedTotal>0?Math.round((payableTotal/submittedTotal)*100):0;
  const state         =rp_rateClass(pct);
  const rateIcon      =state==='good'?RP_SVG.thumbs:RP_SVG.alert;
  const alertMsg      =state==='good'?'Strong week — payable rate is above target. Keep it up.'
                      :state==='warn'?'Getting there, but room to improve. Focus on lead quality this week.'
                      :'Below target. Review cancelled leads and approach this week.';

  // Build perf sections per campaign
  function perfSection(r,idx){
    const label=multiCamp?`Campaign ${idx+1}`:'';
    const types=[
      {key:'1',type:rp_clean(r['Type 1']),sub:rp_clean(r['Submitted 1']),pay:rp_clean(r['Payable 1']),can:rp_clean(r['Cancelled 1'])},
      {key:'2',type:rp_clean(r['Type 2']),sub:rp_clean(r['Submitted 2']),pay:rp_clean(r['Payable 2']),can:rp_clean(r['Cancelled 2'])},
    ].filter(t=>t.type&&t.type!=='0');
    return types.map((t,ti)=>`
      <div class="rp-card" style="margin-bottom:0;">
        <div class="rp-perf-type-bar">${RP_SVG.tag}<span class="rp-perf-type-name">${esc(t.type)}${multiCamp&&ti===0?` · ${esc(label)}`:''}</span></div>
        <div class="rp-perf-row"><div class="rp-perf-icon amb">${RP_SVG.send}</div><div class="rp-perf-mid"><div class="rp-perf-name">Submitted</div><div class="rp-perf-sub">Total ${esc(t.type)} leads</div></div><div class="rp-perf-val">${esc(t.sub)}</div></div>
        <div class="rp-perf-row"><div class="rp-perf-icon grn">${RP_SVG.check}</div><div class="rp-perf-mid"><div class="rp-perf-name">Payable</div><div class="rp-perf-sub">Approved for pay</div></div><div class="rp-perf-val">${esc(t.pay)}</div></div>
        <div class="rp-perf-row"><div class="rp-perf-icon red">${RP_SVG.x}</div><div class="rp-perf-mid"><div class="rp-perf-name">Cancelled</div><div class="rp-perf-sub">Not payable this week</div></div><div class="rp-perf-val">${esc(t.can)}</div></div>
      </div>`).join('');
  }
  const allPerfSections=rows.map((r,i)=>perfSection(r,i)).join('');

  root.innerHTML=`
    <button class="rp-back-btn" onclick="rp_backToTeam()">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11L5 7l4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Back to team
    </button>

    <div id="rp-history-chart" class="rp-history-card"></div>

    <!-- Hero stat row -->
    <div class="rp-card" style="margin-bottom:16px;">
      <div class="rp-card-hdr">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="rp-av" style="${avStyle(nameVal,repPos)};width:40px;height:40px;font-size:14px;flex-shrink:0;">${rp_initials(nameVal)}</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div class="rp-card-title">${esc(nameVal)}</div>
              ${repPos?`<span class="pos-tag ${posClass(repPos)}" style="font-size:10px;padding:2px 7px;">${esc(repPos)}</span>`:''}
            </div>
            <div class="rp-card-sub">${esc(officeVal)} Office · ${esc(rp_activeLabel)}${rRep&&rRep.email?` · ${esc(rRep.email)}`:''}</div>
          </div>
        </div>
        <span class="rp-stat-chip ${state}" style="font-size:12px;padding:5px 11px;">${rateIcon} ${pct}% rate</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--niond-border);" id="rp-rep-stat-row">
        <div style="padding:16px 20px;border-right:1px solid var(--niond-border);">
          <div class="rp-stat-lbl" style="margin-bottom:6px;">Total Pay</div>
          <div class="rp-stat-val" id="rp-pay-hero" style="font-size:28px;">£0</div>
        </div>
        <div style="padding:16px 20px;border-right:1px solid var(--niond-border);">
          <div class="rp-stat-lbl" style="margin-bottom:6px;">Payable</div>
          <div class="rp-stat-val" style="font-size:28px;">${payableTotal}</div>
        </div>
        <div style="padding:16px 20px;">
          <div class="rp-stat-lbl" style="margin-bottom:6px;">Cancelled</div>
          <div class="rp-stat-val" style="font-size:28px;${cancelledTotal>0?'color:var(--danger);':''}">${cancelledTotal}</div>
        </div>
      </div>
      <div class="rp-conv-wrap" style="padding-top:16px;">
        <div class="rp-conv-header"><span class="rp-conv-label">Payable conversion rate</span><span class="rp-conv-pct">${pct}%</span></div>
        <div class="rp-conv-track"><div class="rp-conv-fill ${state}" id="rp-rep-conv-fill"></div></div>
      </div>
      <div class="rp-alert-box ${state}">${rateIcon}<span>${alertMsg}</span></div>
    </div>

    <!-- Performance by campaign -->
    <div class="nd-section-lbl">Performance breakdown</div>
    <div class="rp-perf-grid" style="margin-bottom:16px;">${allPerfSections}</div>

    <!-- Earnings -->
    <div class="nd-section-lbl">Earnings breakdown</div>
    <div class="rp-earn-grid">
      <div class="rp-earn-box${topUps<0?' deduct':''}"><div class="rp-earn-label">Top Ups</div><div class="rp-earn-value${topUps<0?' negative':''}" id="rp-earn-topups">£0</div></div>
      <div class="rp-earn-box${tablet<0?' deduct':''}"><div class="rp-earn-label">Tablet</div><div class="rp-earn-value${tablet<0?' negative':''}" id="rp-earn-tablet">£0</div></div>
      <div class="rp-earn-box${dwm<0?' deduct':''}"><div class="rp-earn-label">DWM Incentive</div><div class="rp-earn-value${dwm<0?' negative':''}" id="rp-earn-dwm">£0</div></div>
      <div class="rp-earn-box${adj<0?' deduct':''}"><div class="rp-earn-label">Adjustment</div><div class="rp-earn-value${adj<0?' negative':''}" id="rp-earn-adj">£0</div></div>
      ${hasOverride?`<div class="rp-earn-box wide${override<0?' deduct':''}"><div class="rp-earn-label">Override</div><div class="rp-earn-value${override<0?' negative':''}" id="rp-earn-override">£0</div></div>`:''}
    </div>

    <!-- Pay summary -->
    <div class="nd-section-lbl">Pay summary</div>
    <div class="rp-summary-card">
      <div class="rp-summary-row"><span class="rp-summary-lbl">Submitted total</span><span class="rp-summary-val">${submittedTotal}</span></div>
      <div class="rp-summary-row"><span class="rp-summary-lbl">Cancelled total</span><span class="rp-summary-val">${cancelledTotal}</span></div>
      <div class="rp-summary-row"><span class="rp-summary-lbl">Payable total</span><span class="rp-summary-val">${payableTotal}</span></div>
      <div class="rp-summary-row total"><span class="rp-summary-lbl">Final pay</span><span class="rp-summary-val" id="rp-earn-final">£0</span></div>
    </div>
  `;

  requestAnimationFrame(()=>{
    setTimeout(()=>{
      const fill=document.getElementById('rp-rep-conv-fill');
      if(fill)fill.style.width=pct+'%';
      rp_countUp(document.getElementById('rp-pay-hero'),totalPay,'£',0,700);
      [
        ['rp-earn-topups',topUps],['rp-earn-tablet',tablet],
        ['rp-earn-dwm',dwm],['rp-earn-adj',adj],
        ...(hasOverride?[['rp-earn-override',override]]:[]),
        ['rp-earn-final',totalPay],
      ].forEach(([id,val],i)=>{
        setTimeout(()=>rp_countUp(document.getElementById(id),val,'£',0,500),i*50);
      });
    },80);
  });

  if(rp_weekIndex.length>=2&&!rp_historyLoaded){
    rp_historyLoaded=true;
    requestAnimationFrame(()=>rp_loadRepHistory(name));
  }
}

// ── Earnings history chart ──
async function rp_loadRepHistory(name, targetId='rp-history-chart'){
  const el=document.getElementById(targetId);
  if(!el)return;
  el.innerHTML=`<div class="rp-loading" style="padding:16px 0;"><div class="rp-spinner"></div><span style="font-size:12px;color:var(--muted);">Loading history…</span></div>`;
  el.style.display='block';

  const results=await Promise.allSettled(
    rp_weekIndex.map(async(w,i)=>{
      try{
        let rows;
        if(rp_csvCache.has(w.url)){
          rows=rp_csvCache.get(w.url);
        }else{
          const text=await(await fetch(w.url)).text();
          rows=rp_parseCSV(text);
          rp_csvCache.set(w.url,rows);
        }
        const headers=rows[0].map(h=>h.trim());
        const match=rows.slice(1).find(r=>r[0]?.trim().toLowerCase()===name.trim().toLowerCase());
        if(!match)return{label:w.label,pay:0,found:false,idx:i};
        const d={};headers.forEach((h,j)=>d[h]=match[j]);
        return{label:w.label,pay:rp_num(d['Total Pay']),found:true,idx:i};
      }catch{return{label:w.label,pay:0,found:false,idx:i};}
    })
  );

  const points=results
    .map((r,i)=>r.status==='fulfilled'?{...r.value,weekIdx:i}:{pay:0,found:false,weekIdx:i,label:rp_weekIndex[i]?.label||''})
    .reverse(); // oldest first for chart

  const found=points.filter(p=>p.found);
  if(found.length<2){el.style.display='none';return;}

  const n=points.length,PAD_L=6,PAD_R=6,PAD_T=24,PAD_B=20,BAR_H=44,VW=480,VH=PAD_T+BAR_H+PAD_B;
  const slotW=(VW-PAD_L-PAD_R)/n;
  const barW=Math.min(28,Math.max(10,slotW*0.62));
  const maxPay=Math.max(...found.map(p=>p.pay),1);
  const activeWeekIdx=rp_weekIndex.length-1-rp_activeIdx;

  const bars=points.map((p,i)=>{
    const cx=PAD_L+slotW*i+slotW/2;
    const bh=p.found?Math.max(5,(p.pay/maxPay)*BAR_H):5;
    const by=PAD_T+(BAR_H-bh);
    const isActive=p.weekIdx===activeWeekIdx;
    const fill=!p.found?'var(--border2)':isActive?'#0f766e':'rgba(15,118,110,.35)';
    const valTxt=p.found?(p.pay>=1000?'\xa3'+(p.pay/1000).toFixed(1)+'k':'\xa3'+Math.round(p.pay)):'';
    const shortLbl=p.label.replace(/w\/c\s*/i,'').replace(/\s*\d{4}$/,'').trim();
    const isDk=document.documentElement.getAttribute('data-theme')==='dark';
    const lblCol=isDk?'#6b8a8a':'#94a3b8';
    const activeLblCol=isDk?'#2dd4bf':'#0f766e';
    return`<g>
      <rect x="${cx-barW/2}" y="${by}" width="${barW}" height="${bh}" rx="3.5" fill="${fill}"/>
      ${p.found?`<text x="${cx}" y="${PAD_T-6}" text-anchor="middle" font-size="8" font-weight="${isActive?'700':'500'}" fill="${isActive?activeLblCol:lblCol}" font-family="DM Sans,sans-serif">${valTxt}</text>`:''}
      <text x="${cx}" y="${VH-3}" text-anchor="middle" font-size="7.5" font-weight="${isActive?'700':'400'}" fill="${isActive?activeLblCol:lblCol}" font-family="DM Sans,sans-serif">${shortLbl}</text>
    </g>`;
  }).join('');

  const total=found.reduce((s,p)=>s+p.pay,0);
  const avg=total/found.length;
  const last=found[found.length-1].pay;
  const prev=found.length>=2?found[found.length-2].pay:null;
  const diff=prev!==null?last-prev:0;
  const trendUp=diff>=0;

  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.13em;color:var(--subtle);">Earnings history</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:600;color:var(--muted);">Avg ${rp_fmt(avg)}</span>
        ${prev!==null?`<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:${trendUp?'#EAF3DE':'#FCEBEB'};color:${trendUp?'#3B6D11':'#A32D2D'};border:0.5px solid ${trendUp?'#C0DD97':'#F7C1C1'};">${trendUp?'▲':'▼'} ${rp_fmt(Math.abs(diff))}</span>`:''}
      </div>
    </div>
    <svg width="100%" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" style="overflow:visible;display:block;">${bars}</svg>`;
  el.style.display='block';
}

function rp_backToTeam(){
  rp_view='team';
  rp_activeRep=null;
  rp_historyLoaded=false;
  rp_renderTeamView();
  const scroll=document.getElementById('rp-scroll');
  if(scroll)scroll.scrollTop=0;
}


// Lazy-load html2pdf (+ html2canvas it bundles) only when first needed
let _pdfLibLoaded = false;
async function ensurePdfLib() {
  if (_pdfLibLoaded || typeof html2pdf !== 'undefined') { _pdfLibLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = () => { _pdfLibLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load PDF library'));
    document.head.appendChild(s);
  });
}

async function dpDownloadPDF(){
  await ensurePdfLib();
  // Flush current edits first
  dpFlushCurrentDay();
  const dates = dpGetWeekDates();
  const date = dates[dpActiveDayIdx];
  const data = dpData[date] || dpBlank();
  const d = data.daily;
  const events = data.events || dpBlank().events;
  const dn = managerName.charAt(0).toUpperCase()+managerName.slice(1);
  const dateStr = dpDateLabel(date);

  // Build a standalone printable HTML document
  const pageHtml = dpRenderDailyPageHTML(d, events, date, true, managerName);

  // Get current CSS variables from document
  const styles = [...document.styleSheets].map(ss=>{try{return [...ss.cssRules].map(r=>r.cssText).join('\n');}catch(e){return '';}}).join('\n');

  const printDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${dn} Daily Planner — ${dateStr}</title>
<style>
${styles}
body{margin:0;padding:20px;background:#f8fafc;font-family:'DM Sans',sans-serif;}
.dp-page{max-width:680px;margin:0 auto 24px;background:white;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden;width:100%;}
.dp-page-a4-wrap{max-width:680px;margin:0 auto;}
textarea,input{background:white!important;border-color:#e5e7eb!important;}
@media print{body{padding:0;background:white;}.dp-page{box-shadow:none;border-color:#e5e7eb;page-break-after:always;max-width:100%;}}
</style>
</head>
<body>
<div class="dp-page-a4-wrap">${pageHtml}</div>
</body>
</html>`;

  const win = window.open('','_blank','width=920,height=800');
  if(!win){showToast('Allow pop-ups to download PDF','error');return;}
  win.document.write(printDoc);
  win.document.close();
  win.onload = ()=>{ win.focus(); win.print(); };
}

/* ══════════════════════════════════════════
   MY PROFILE TAB
══════════════════════════════════════════ */

// _myProfile, _myClients are declared at top of state block — do not redeclare here
let _profileDirty = false;

async function profileLoad() {
  // Always fetch fresh — admin may have updated the profile since login
  // Show a loading state on campaigns while we fetch
  const campListEl = document.getElementById('profile-campaigns-list');
  if(campListEl && campListEl.textContent.trim() === 'Loading…') {
    campListEl.innerHTML = '<span style="font-size:12px;color:var(--muted);">Loading…</span>';
  }

  try {
    const [profRes, clRes] = await Promise.all([
      api({action:'getManagerProfile', manager:managerName}).catch(()=>({})),
      api({action:'getClients'}).catch(()=>({}))
    ]);
    // Only update if we got real data back (handles pre-redeploy gracefully)
    const newProfile = profRes && profRes.profile;
    const newClients = clRes && clRes.clients;
    if(newProfile !== undefined) _myProfile = newProfile;
    if(newClients !== undefined) _myClients = newClients;
    // Ensure _myProfile is at least an empty object, never null after this point
    if(_myProfile === null) _myProfile = {};
  } catch(e) {
    if(_myProfile === null) _myProfile = {};
  }
  profileRender();
}

function profileRender() {
  const p = _myProfile || {};
  const dn = rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1);

  // Big avatar — always mirror the sidebar avatar (which is always up to date)
  const sbAv = document.getElementById('sb-avatar');
  const bigAv = document.getElementById('profile-big-avatar');
  if (bigAv) {
    if(sbAv && sbAv.innerHTML.trim() && sbAv.innerHTML.trim() !== '?'){
      bigAv.innerHTML = sbAv.innerHTML;
    } else {
      bigAv.textContent = dn.charAt(0);
    }
  }

  // Name
  const nameEl = document.getElementById('profile-name-display');
  if (nameEl) nameEl.textContent = dn;

  // Tenure badge
  let tenureMonths = 0;
  if (p.startDate) {
    const sd = new Date(p.startDate);
    const now = new Date();
    tenureMonths = Math.max(0, (now.getFullYear() - sd.getFullYear()) * 12 + (now.getMonth() - sd.getMonth()));
  }
  const tenureEl = document.getElementById('profile-tenure-badge');
  if (tenureEl) {
    if (p.startDate) {
      const yrs = Math.floor(tenureMonths / 12);
      const mos = tenureMonths % 12;
      const parts = [];
      if (yrs) parts.push(yrs + (yrs===1?' year':' years'));
      if (mos) parts.push(mos + (mos===1?' month':' months'));
      tenureEl.innerHTML = SVG.calendar.replace('width="18" height="18"','width="12" height="12"') + ' ' + (parts.length ? parts.join(' ') + ' with the team' : 'Started this month');
      tenureEl.style.display = '';
    } else { tenureEl.textContent = ''; tenureEl.style.display = 'none'; }
  }

  // Fill form fields (only if not currently dirty — don't clobber user edits)
  if(!_profileDirty){
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('profile-city', p.city);
    setVal('profile-phone', p.phone);
    setVal('profile-start-date', p.startDate);
    setVal('profile-weekly-target', p.weeklyTarget);
    setVal('profile-bio', p.bio);
  }

  // Campaigns (assigned by admin — read from profile.campaigns which are client IDs)
  const assignedIds = p.campaigns || [];
  const assignedClients = _myClients.filter(c => assignedIds.includes(c.id));
  const campListEl = document.getElementById('profile-campaigns-list');
  const campDispEl = document.getElementById('profile-campaigns-display');
  if (campListEl) {
    if (!_myClients.length) {
      // No clients registered yet — likely Apps Script not yet redeployed
      campListEl.innerHTML = '<span style="font-size:12px;color:var(--muted);">No campaigns set up yet. Your admin will assign these.</span>';
    } else if (!assignedClients.length) {
      campListEl.innerHTML = '<span style="font-size:12px;color:var(--muted);">No campaigns assigned yet — your admin will set these up.</span>';
    } else {
      campListEl.innerHTML = assignedClients.map(c => {
        const imgTag = c.logoUrl ? `<img src="${esc(c.logoUrl)}" style="width:22px;height:22px;object-fit:contain;border-radius:4px;margin-right:6px;" />` : '';
        const campStyle = c.campaign === 'Doors' ? 'background:#ffe0a0;color:#b85c00;border-color:#f08000;' : 'background:#b3d4ff;color:#1140cc;border-color:#1d50ff;';
        return `<div style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);font-size:13px;font-weight:600;">
          ${imgTag}
          <span>${esc(c.clientName)}</span>
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid;${campStyle}">${esc(c.campaign)}</span>
        </div>`;
      }).join('');
    }
  }
  if (campDispEl) {
    campDispEl.innerHTML = assignedClients.map(c => {
      const imgTag = c.logoUrl ? `<img src="${esc(c.logoUrl)}" style="width:16px;height:16px;object-fit:contain;border-radius:3px;" />` : '';
      return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(15,118,110,.1);color:#0f766e;border:1px solid rgba(15,118,110,.2);">${imgTag}${esc(c.fullName)}</span>`;
    }).join('');
  }

  // Quick stats
  const activeReps = roster.filter(r => !r.leaver).length;
  const setQ = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setQ('pstat-reps', activeReps || '—');
  setQ('pstat-tenure', tenureMonths ? tenureMonths + ' mo' : '—');
  setQ('pstat-target', p.weeklyTarget ? '£' + Number(p.weeklyTarget).toLocaleString('en-GB') : '—');

  // Update sidebar city+campaigns too
  updateSidebarProfile();

  _profileDirty = false;
  const st = document.getElementById('profile-save-status');
  if (st) st.textContent = '';
}

function profileDirty() {
  _profileDirty = true;
  const st = document.getElementById('profile-save-status');
  if (st) st.textContent = '(unsaved)';
}

async function profileSave() {
  const g = id => (document.getElementById(id)||{}).value || '';
  const profile = {
    city: g('profile-city'),
    phone: g('profile-phone'),
    startDate: g('profile-start-date'),
    weeklyTarget: g('profile-weekly-target'),
    bio: g('profile-bio'),
    campaigns: (_myProfile && _myProfile.campaigns) || []  // preserve admin-assigned campaigns
  };
  _myProfile = profile;
  const st = document.getElementById('profile-save-status');
  if (st) st.textContent = 'Saving…';
  try {
    await api({action:'saveManagerProfile', manager:managerName, profile});
    _profileDirty = false;
    if (st) { st.textContent = '✓ Saved'; setTimeout(() => { if(st) st.textContent=''; }, 3000); }
    showToast('Profile saved ✓', 'success');
    updateSidebarProfile(); // update sidebar city + campaigns
    profileRender();        // re-render header card (tenure, stats)
  } catch(e) {
    if (st) st.textContent = 'Save failed';
    showToast('Could not save profile', 'error');
  }
}




/* ── Mobile sidebar / nav helpers ── */
function openMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mob-sidebar-overlay');
  if (sidebar) sidebar.classList.add('mob-open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mob-sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mob-open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function mobNavActive(tab) {
  document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('mob-nav-' + tab);
  if (el) el.classList.add('active');
  closeMobileSidebar();
}

/* Hook into existing switchTab so bottom nav stays in sync */
(function() {
  const _orig = window.switchTab;
  if (typeof _orig === 'function') {
    window.switchTab = function(tab) {
      _orig(tab);
      // Update bottom nav highlight
      const map = { home:'home', reps:'reps', weekly:'weekly', leaderboard:'leaderboard',
                    map:'leaderboard', payrep:'reps', review:'weekly', calendar:'more',
                    notes:'more', reports:'more', notifications:'more', profile:'more',
                    planner:'more', events:'more' };
      const mobKey = map[tab] || 'more';
      document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
      const el = document.getElementById('mob-nav-' + mobKey);
      if (el) el.classList.add('active');
      closeMobileSidebar();
    };
  }
})();

/* Sync the sidebar badge and mobile bottom-nav dot together */
function syncWeeklyDot() {
  const badge = document.getElementById('weekly-badge');
  const dot   = document.getElementById('mob-weekly-dot');
  if (!badge || !dot) return;
  const visible = badge.style.display !== 'none';
  dot.style.display = visible ? 'block' : 'none';
}

/* Swipe to close sidebar on mobile */
(function() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('mob-open') && dx < -50) {
      closeMobileSidebar();
    }
  }, { passive: true });
})();

/* ── Mobile inline-grid override ── */
function mobFixGrids() {
  if (window.innerWidth > 768) return;

  // ── Any remaining inline 3+ col or fixed-px grids across all tabs ──
  // (home grid rows now handled purely by CSS via .hg-stats/.hg-main/.hg-bottom classes)
  // Scoped to tab content only, skips calendar day grid and form input rows
  document.querySelectorAll('.tab-content [style], .page-scroll [style], .home-scroll [style]').forEach(el => {
    const gc = el.style.gridTemplateColumns;
    if (!gc) return;
    // Skip: 7-col calendar grid, 2-col grids without px widths, form rows
    if (/repeat\(7/.test(gc)) return;
    if (el.closest('.wr-stat-row, .wr-network-row, .wr-goal-row, .wr-expense-row')) return;
    // Collapse 3+ col grids to 1 col
    const hasRepeat3Plus = /repeat\([3-9]/.test(gc);
    const hasManyFr = (gc.match(/\bfr\b/g)||[]).length >= 3;
    const hasFixedPx = /\d+px/.test(gc) && !(/^1fr$|^1fr 1fr$/.test(gc.trim()));
    if (hasRepeat3Plus || hasManyFr || hasFixedPx) {
      // Keep 2-col for things already at 1fr 1fr
      if (gc.trim() === '1fr 1fr') return;
      el.style.gridTemplateColumns = '1fr';
      if (!el.style.gap) el.style.gap = '10px';
    }
  });

  // ── Rep pay stat row (has ID) ──
  const rpRow = document.getElementById('rp-rep-stat-row');
  if (rpRow) rpRow.style.gridTemplateColumns = '1fr 1fr';

  // ── Profile info grid (repeat(4,1fr)) ──
  document.querySelectorAll('#ptab-profile [style*="repeat(4"]').forEach(el => {
    el.style.gridTemplateColumns = '1fr 1fr';
    el.style.gap = '10px';
  });
}

// Hook into switchTab so it runs after every tab renders
const _origSwitchTab = switchTab;
window.switchTab = function(tab) {
  _origSwitchTab.apply(this, arguments);
  setTimeout(mobFixGrids, 80);
};

// Run on initial load and resize
window.addEventListener('DOMContentLoaded', () => setTimeout(mobFixGrids, 400));
window.addEventListener('resize', mobFixGrids);
// Also run after data loads (renderHome is called async)
setTimeout(mobFixGrids, 1500);
