/* ══════════════════════════════════════════
   APP.JS — core: constants, helpers, auth,
   state, api(), switchTab(), toast, notifs
══════════════════════════════════════════ */

/* ── Config setup ── */
var SCRIPT_URL = (()=>{
  const u = localStorage.getItem('teamtracker_script_url') || '';
  if(!u){
    document.getElementById('login-screen').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;color:#555;"><strong style="font-size:16px;color:#111;">Setup required</strong><p style="font-size:13px;text-align:center;max-width:340px;">No Apps Script URL is configured. Open the Admin panel, go to the Setup tab, and save the Script URL first.</p></div>';
  }
  return u;
})();

/* ── Position classes helper ── */
function applyPositionClasses(){
  document.querySelectorAll('[data-position],[data-pos]').forEach(el=>{
    const p=(el.dataset.position||el.dataset.pos||'').toLowerCase();
    el.classList.remove('pos-Trainee','pos-Solo','pos-Leader','pos-Core','pos-Junior','pos-JuniorPartner');
    if(p.includes('trainee')) el.classList.add('pos-Trainee');
    else if(p.includes('solo')) el.classList.add('pos-Solo');
    else if(p.includes('leader')) el.classList.add('pos-Leader');
    else if(p.includes('core')) el.classList.add('pos-Core');
    else if(p.includes('junior')) el.classList.add('pos-JuniorPartner');
  });
}
setTimeout(applyPositionClasses, 200);
document.addEventListener('DOMContentLoaded', ()=>setTimeout(applyPositionClasses, 400));

/* ── Constants ── */
const POSITIONS = ['Trainee','Solo','Leader','Core','Junior Partner +'];
var FLAGS = [
  {id:'Conversation',label:'Needs conversation',color:'#f97316'},
  {id:'AtRisk',label:'At risk',color:'#dc2626'},
  {id:'DoingWell',label:'Doing well',color:'#16a34a'},
  {id:'Watch',label:'Keep an eye',color:'#0d6b61'}
];
const CAT_NAMES = {personal:'Personal',work:'Work',team:'Pink',reminder:'Yellow',admin:'Purple',orange:'Orange',rose:'Rose',cyan:'Cyan'};
const CAT_COLORS = {personal:'#2563ff',work:'#22c55e',team:'#ec4899',reminder:'#f59e0b',admin:'#7c3aed',orange:'#f97316',rose:'#f43f5e',cyan:'#06b6d4'};
const PC = {Trainee:{f:'#e6f7f0',s:'#40b890',t:'#2a9470'},Solo:{f:'#fef3e0',s:'#e09020',t:'#c87810'},Leader:{f:'#e6eef8',s:'#5888d8',t:'#3060c0'},Core:{f:'#ede8f8',s:'#9070c8',t:'#6848b0'},'Junior Partner +':{f:'#fde8ee',s:'#e06888',t:'#c84870'},Manager:{f:'#e6f4f2',s:'#2aaa98',t:'#0f766e'},default:{f:'#f2f4f6',s:'#8898b0',t:'#4a5870'}};
const PCD = {Trainee:{f:'#082818',s:'#40b890',t:'#90e8c8'},Solo:{f:'#281800',s:'#e09020',t:'#f8d080'},Leader:{f:'#081428',s:'#5888d8',t:'#a0c0f0'},Core:{f:'#180828',s:'#9070c8',t:'#c8b0f0'},'Junior Partner +':{f:'#280810',s:'#e06888',t:'#f0b0c8'},Manager:{f:'#001818',s:'#2aaa98',t:'#80d8c8'},default:{f:'#181E28',s:'#7088A8',t:'#B0C0D8'}};

const TABS = ['home','reps','weekly','map','leaderboard','reports','review','calendar','notes','payrep','planner','events','notifications','profile'];

/* ── URL params ── */
const params = new URLSearchParams(window.location.search);
var rawName = params.get('name') || '';
var managerName = rawName.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');

/* ── Theme ── */
function initTheme(){
  const s = localStorage.getItem('tt_theme') || 'light';
  document.documentElement.setAttribute('data-theme', s);
  const lbl = document.getElementById('theme-lbl');
  if(lbl) lbl.textContent = s==='dark' ? 'Light mode' : 'Dark mode';
}
function toggleTheme(){
  const c = document.documentElement.getAttribute('data-theme');
  const n = c==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', n);
  localStorage.setItem('tt_theme', n);
  const lbl = document.getElementById('theme-lbl');
  if(lbl) lbl.textContent = n==='dark' ? 'Light mode' : 'Dark mode';
  if(typeof renderEdges === 'function') renderEdges();
}
initTheme();
function isDark(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }
function pc(pos){ const m=isDark()?PCD:PC; return m[pos]||m.default; }

/* ── Date helpers ── */
function getWeekKey(d){ const dt=new Date(d); dt.setHours(0,0,0,0); dt.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1)); return fmtDate(dt); }
function fmtDate(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return`${y}-${m}-${day}`; }
function parseDate(s){ if(!s||typeof s!=='string')return null; const p=s.split('-'); if(p.length!==3)return null; const d=new Date(+p[0],+p[1]-1,+p[2]); return isNaN(d)?null:d; }
function formatWeek(k){ const d=parseDate(k); if(!d)return'—'; const e=new Date(d); e.setDate(e.getDate()+6); const f=dt=>dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); return`w/c ${f(d)} – ${f(e)}`; }
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
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const weekKey = getWeekKey(new Date());

/* ── Position helpers ── */
function posKey(pos){
  const p = String(pos||'').toLowerCase().replace(/[^a-z]/g,'');
  if(p.includes('trainee')) return 'Trainee';
  if(p.includes('solo')) return 'Solo';
  if(p.includes('leader')) return 'Leader';
  if(p.includes('core')) return 'Core';
  if(p.includes('junior')) return 'Junior';
  return '';
}
function posClass(pos){ const k=posKey(pos); return k?`pos-colour-${k}`:''; }
function avStyle(name, pos){
  const palette=[{bg:'#a7ffdb',color:'#007a4d'},{bg:'#b3d4ff',color:'#1140cc'},{bg:'#d4b8ff',color:'#5b1fd6'},{bg:'#ffe0a0',color:'#b85c00'},{bg:'#ffb8cc',color:'#c4002e'}];
  const posMap={Trainee:0,Solo:3,Leader:1,Core:2,Junior:4};
  const k=posKey(pos);
  if(k&&posMap[k]!==undefined){ const c=palette[posMap[k]]; return`background:${c.bg};color:${c.color};border:none;`; }
  return 'background:#ffffff;color:#6b7d8a;border:none;box-shadow:none;';
}

/* ── State ── */
let roster=[], weekLeavers=new Set(), weekPromoted=new Set(), allReports=[], weekSubmitted=false,
    calEvents=[], announcement=null, notes='', lastWeekCount=0, ackDone=false,
    savedReviews=[], allPayData=[], managerNotifs=[];
let _myProfile=null, _myClients=[];
let repNotes={};

/* ── API ── */
function getMgrToken(){ return sessionStorage.getItem('tt_mgr_token_'+managerName)||''; }
async function api(p){
  const body = JSON.stringify({token:getMgrToken(),...p});
  const r = await fetch(SCRIPT_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body});
  const text = await r.text();
  if(!r.ok) throw new Error('HTTP '+r.status+': '+text.slice(0,200));
  try{ return JSON.parse(text); } catch(e){ throw new Error('Apps Script error: '+text.slice(0,200)); }
}

/* ── Toast ── */
function showToast(msg, type, dur){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(()=>t.className='toast', dur||3000);
}

/* ── LOGIN ── */
async function doLogin(){
  const input=document.getElementById('login-pw');
  const pw=input.value.trim();
  const err=document.getElementById('login-err');
  const btn=document.getElementById('login-btn');
  err.classList.remove('show'); err.textContent='';
  if(!pw){ err.textContent='Please enter a password.'; err.classList.add('show'); input.focus(); return; }
  if(!managerName){ err.textContent='URL missing manager name. Add ?name=yourname'; err.classList.add('show'); return; }
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Checking…'; input.disabled=true;
  try{
    const res = await api({action:'checkPassword', manager:managerName, password:pw});
    if(res&&res.ok){
      const tokenKey='tt_mgr_token_'+managerName;
      sessionStorage.setItem(tokenKey, res.token||'authed');
      btn.innerHTML='<span class="spinner"></span>Loading…';
      showApp(); return;
    }
    if(res&&res.noPassword){ err.textContent='No password has been set for your account. Please ask your admin to set one.'; }
    else { err.textContent=(res&&(res.message||res.error))||'Incorrect password.'; }
    err.classList.add('show'); input.value=''; input.focus();
  } catch(e){ err.textContent='Login failed: '+(e&&e.message?e.message:'check Script URL is deployed correctly.'); err.classList.add('show'); }
  finally{ btn.disabled=false; btn.textContent='Sign in'; input.disabled=false; }
}
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-pw').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

function checkAuth(){
  const tokenKey='tt_mgr_token_'+managerName;
  const stored=sessionStorage.getItem(tokenKey);
  if(!stored) return;
  if(!SCRIPT_URL) return;
  api({action:'checkToken', manager:managerName, token:stored})
    .then(res=>{ if(res&&res.ok){ showApp(); } else { sessionStorage.removeItem(tokenKey); } })
    .catch(()=>{ sessionStorage.removeItem(tokenKey); });
}

function showApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-shell').style.display='flex';
  const dn = rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1);
  const av = document.getElementById('sb-avatar');
  av.textContent = dn.charAt(0);
  document.getElementById('sb-name').textContent = dn;
  document.getElementById('sb-week').textContent = formatWeek(weekKey);
  document.getElementById('home-greeting').textContent = `Welcome back, ${dn} 👋`;
  document.getElementById('week-pill').textContent = formatWeek(weekKey);
  document.getElementById('week-pill2').textContent = formatWeek(weekKey);
  document.title = `${dn} · The Back Office`;
  loadAll();
}

function getMgrDisplay(){ return rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1); }

/* ── Handle profile pic upload ── */
function handleProfilePic(input){
  const file=input.files[0]; if(!file) return;
  if(file.size>2*1024*1024){ showToast('Image too large — max 2MB','error'); return; }
  const reader=new FileReader();
  reader.onload=async e=>{
    const picData=e.target.result;
    const imgHtml=`<img src="${picData}" alt="profile" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
    const av=document.getElementById('sb-avatar');
    av.innerHTML=imgHtml;
    const bigAv=document.getElementById('profile-big-avatar');
    if(bigAv) bigAv.innerHTML=imgHtml;
    try{
      const res=await api({action:'saveProfilePic',manager:managerName,picData});
      if(res&&res.picUrl){
        const stableHtml=`<img src="${res.picUrl}" alt="profile" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
        av.innerHTML=stableHtml;
        if(bigAv) bigAv.innerHTML=stableHtml;
      }
      showToast('Profile picture updated ✓','success');
    } catch(err){ showToast('Picture saved locally — sheet sync failed','error'); }
  };
  reader.readAsDataURL(file);
}

/* ── Load all data ── */
async function loadAll(){
  const unwrap = r => r.status==='fulfilled' ? r.value : {};
  try{
    const settled = await Promise.allSettled([
      api({action:'getRoster',manager:managerName}),
      api({action:'getSubmission',manager:managerName,week:weekKey}),
      api({action:'loadMap',manager:managerName}),
      api({action:'getReports',manager:managerName}),
      api({action:'getCalEvents',manager:managerName}),
      api({action:'getAnnouncement'}),
      api({action:'getNotes',manager:managerName}),
      api({action:'getLastWeekCount',manager:managerName,currentWeek:weekKey}),
      api({action:'getPayData',manager:managerName}),
      api({action:'getProfilePic',manager:managerName}),
      api({action:'getManagerReviews',manager:managerName}),
      api({action:'getNotifications',manager:managerName}),
      api({action:'getManagerProfile',manager:managerName}),
      api({action:'getClients'})
    ]);
    settled.forEach((r,i)=>{ if(r.status==='rejected') console.warn('loadAll action',i,'failed:',r.reason); });
    const[rRes,sRes,mRes,rpRes,calRes,annRes,notesRes,prevRes,pdRes,picRes,revRes,notifRes,profRes,clRes] = settled.map(unwrap);
    if(rRes.roster) roster=rRes.roster;
    if(sRes.rows&&sRes.rows.length){ weekSubmitted=true; document.getElementById('banner-done').style.display='block'; weekLeavers=new Set(sRes.rows.filter(r=>r.leaver).map(r=>r.id).filter(Boolean)); }
    if(mRes.mapData){ try{ const d=JSON.parse(mRes.mapData); sp.nodes=d.nodes||[]; sp.edges=d.edges||[]; } catch(e){} }
    if(rpRes.reports) allReports=rpRes.reports;
    if(calRes.events) calEvents=calRes.events;
    if(annRes.announcement) announcement=annRes.announcement;
    if(notesRes.notes!==undefined) notes=notesRes.notes||'';
    if(prevRes.count!==undefined) lastWeekCount=prevRes.count;
    if(sRes.acked) ackDone=true;
    if(pdRes.payData) allPayData=pdRes.payData;
    if(picRes.picUrl){
      const av=document.getElementById('sb-avatar');
      const dn=rawName.trim().charAt(0).toUpperCase()+rawName.trim().slice(1);
      av.innerHTML=`<img src="${picRes.picUrl}" alt="${dn}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`;
    }
    if(revRes.reviews) savedReviews=revRes.reviews;
    if(notifRes.notifications) managerNotifs=notifRes.notifications;
    _myProfile = (profRes&&profRes.profile!==undefined) ? profRes.profile : (_myProfile||{});
    _myClients = (clRes&&Array.isArray(clRes.clients)) ? clRes.clients : _myClients;
    updateNotifBadge();
    renderAll();
  } catch(e){ console.error('loadAll fatal:',e); renderAll(); }
}

function renderAll(){
  roster.forEach(r=>{ if(r.managerNotes&&r.managerNotes.length) repNotes[r.id]=r.managerNotes; });
  renderHome(); renderReps(); renderWeekly(); renderReports(); renderCalendar(); refreshAddLeaderDropdown();
  updateSidebarProfile();
  if(document.getElementById('ptab-profile')?.classList.contains('active')) profileRender();
}

/* ── Sidebar profile ── */
function updateSidebarProfile(){
  if(!_myProfile) return;
  const cityEl=document.getElementById('sb-city');
  if(cityEl){ if(_myProfile.city){ cityEl.textContent='📍 '+_myProfile.city; cityEl.style.display=''; } else { cityEl.textContent=''; cityEl.style.display='none'; } }
  const campEl=document.getElementById('sb-campaigns');
  if(campEl){
    const assignedIds=_myProfile.campaigns||[];
    const assignedNames=(_myClients||[]).filter(c=>assignedIds.includes(c.id)).map(c=>c.fullName);
    campEl.innerHTML=assignedNames.map(n=>`<span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:10px;background:rgba(15,118,110,.12);color:#0f766e;border:1px solid rgba(15,118,110,.2);">${esc(n)}</span>`).join('');
    campEl.style.display=assignedNames.length?'flex':'none';
  }
}

/* ── Tab switching ── */
function switchTab(tab){
  TABS.forEach(id=>{
    const nav=document.getElementById(`nav-${id}`);
    const panel=document.getElementById(`ptab-${id}`);
    if(nav) nav.classList.toggle('active', id===tab);
    if(panel) panel.classList.toggle('active', id===tab);
  });
  if(tab==='events') epInit();
  if(tab==='map') setTimeout(()=>{ initMapPan(); if(sp.nodes.length===0) rebuildMap(); else{ renderSpider(); renderLegend(); } applyTransform(); },50);
  if(tab==='home'&&typeof wireByWeekGlobal!=='undefined') requestAnimationFrame(()=>drawProdChart(wireByWeekGlobal));
  if(tab==='calendar') renderCalendar();
  if(tab==='leaderboard') lbInit();
  if(tab==='review') showReviewForm();
  if(tab==='notifications'){ renderManagerNotifs(); markAllNotifsRead(); }
  if(tab==='reports') setTimeout(rptPtcRenderChart, 80);
  if(tab==='notes'){ notesRenderFolders(); notesRenderList(); }
  if(tab==='planner') dpInit(); else clearInterval(dpPollTimer);
  if(tab==='payrep') rpInit();
  if(tab==='profile') profileLoad();
}

/* ── Notifications ── */
function updateNotifBadge(){
  const unread=managerNotifs.filter(n=>!n.readAt).length;
  const badge=document.getElementById('notif-badge');
  if(!badge) return;
  if(unread>0){ badge.textContent=unread>99?'99+':String(unread); badge.style.display=''; }
  else { badge.style.display='none'; }
}

function renderManagerNotifs(){
  const el=document.getElementById('notif-list-mgr'); if(!el) return;
  const sorted=[...managerNotifs].sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
  if(!sorted.length){ el.innerHTML='<div style="color:var(--muted);font-size:14px;text-align:center;padding:48px;line-height:1.7;"><strong style="display:block;color:var(--text);font-size:16px;margin-bottom:6px;">No notifications yet</strong>Your manager will send you updates here.</div>'; return; }
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
  if(!unread.length) return;
  await Promise.allSettled(unread.map(n=>api({action:'markNotifRead',id:n.id,manager:managerName})));
  managerNotifs.forEach(n=>{ if(!n.readAt) n.readAt=new Date().toISOString(); });
  updateNotifBadge();
  renderManagerNotifs();
}

/* ── Resize handlers ── */
window.addEventListener('resize', ()=>{
  if(document.getElementById('ptab-map')?.classList.contains('active')) renderEdges();
  if(document.getElementById('ptab-home')?.classList.contains('active')&&typeof wireByWeekGlobal!=='undefined') drawProdChart(wireByWeekGlobal);
});

/* ── Init ── */
if(!managerName){
  document.getElementById('login-screen').innerHTML='<div class="login-box"><div class="login-logo">The <span>Back Office</span></div><h2 style="font-size:18px;margin-bottom:8px;text-align:center;">No manager specified</h2><p style="color:var(--muted);font-size:13px;text-align:center;">Add your name to the URL: manager.html?name=sarah</p></div>';
} else {
  checkAuth();
}
