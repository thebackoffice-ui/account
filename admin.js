
// ── Apps Script source ─────────────────────────────────
const APPS_SCRIPT_VERSION = '2.7.2';
const APPS_SCRIPT = `// The Back Office — Google Apps Script v${APPS_SCRIPT_VERSION}
// Extensions > Apps Script > paste > Deploy as Web App (Anyone)

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ⚠️ TOKEN_SECRET must be set in Apps Script Project Settings → Script Properties
// Key: TOKEN_SECRET  Value: a long random string (e.g. 32+ random chars)
// NEVER hardcode a real secret here — this file is embedded in admin.html source.
function getTokenSecret() {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
    if (secret) return secret;
  } catch(e) {}
  // Fallback for first-time setup only — change this in Script Properties immediately
  return 'TBO_SET_TOKEN_SECRET_IN_SCRIPT_PROPERTIES';
}
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function getOrCreate(name, headers) {
  let sh = SS.getSheetByName(name);
  if (!sh) { sh = SS.insertSheet(name); sh.appendRow(headers); return sh; }
  const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0];
  for (let i = existing.length; i < headers.length; i++) { sh.getRange(1,i+1).setValue(headers[i]); }
  return sh;
}
function safeDate(val) { if (val instanceof Date) { return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd'); } return String(val||''); }
function makeToken(role) { const expires=Date.now()+TOKEN_TTL_MS; const payload=role+':'+expires; const sig=Utilities.computeHmacSha256Signature(payload,getTokenSecret()); const sigHex=sig.map(b=>('0'+(b&0xff).toString(16)).slice(-2)).join(''); return payload+':'+sigHex; }
function verifyToken(token,requiredRole) { try { const parts=token.split(':'); if(parts.length!==3)return false; const role=parts[0],expires=parseInt(parts[1],10),sigHex=parts[2]; if(role!==requiredRole)return false; if(Date.now()>expires)return false; const payload=role+':'+expires; const expected=Utilities.computeHmacSha256Signature(payload,getTokenSecret()); const expectedHex=expected.map(b=>('0'+(b&0xff).toString(16)).slice(-2)).join(''); return sigHex===expectedHex; } catch(e){return false;} }
function getPicFolder() { const folderName='BackOffice_ProfilePics'; const folders=DriveApp.getFoldersByName(folderName); if(folders.hasNext())return folders.next(); const folder=DriveApp.createFolder(folderName); folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW); return folder; }

function hashPassword(pw) { var salt=Utilities.getUuid(); var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+pw); var hex=hash.map(function(b){return ('0'+(b&0xff).toString(16)).slice(-2);}).join(''); return salt+':'+hex; }
function verifyPassword(pw,stored) { if(!stored)return false; if(stored.indexOf(':')===-1)return stored===pw; var parts=stored.split(':'); var salt=parts[0],storedHex=parts[1]; var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+pw); var hex=hash.map(function(b){return ('0'+(b&0xff).toString(16)).slice(-2);}).join(''); return hex===storedHex; }

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  // ── Rate limiting ─────────────────────────────────────
  // Allow max 60 requests per manager/IP per minute for write actions
  // Login attempts are stricter: max 10 per IP per 15 minutes
  const cache = CacheService.getScriptCache();
  // For login actions use a stable key; e.parameter is not available for POST
  var clientKey = data.manager || data.action || 'anon';
  const isLoginAction = data.action === 'adminLogin' || data.action === 'checkPassword';
  const rateCacheKey = (isLoginAction ? 'rl_login_' : 'rl_') + clientKey;
  const rateLimit = isLoginAction ? 10 : 60;
  const rateTtl = isLoginAction ? 900 : 60;
  const current = parseInt(cache.get(rateCacheKey) || '0', 10);
  if (current >= rateLimit) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Too many requests. Please wait before trying again.'})).setMimeType(ContentService.MimeType.JSON);
  }
  cache.put(rateCacheKey, String(current + 1), rateTtl);
  // ─────────────────────────────────────────────────────
  let result = {};

  if (data.action === 'adminLogin') {
    const sh=getOrCreate('settings',['key','value','updatedAt']); const rows=sh.getDataRange().getValues().slice(1); const row=rows.find(r=>r[0]==='adminPassword'); const storedPw=row?String(row[1]):'';
    if (!storedPw) { const hashed=hashPassword(data.password); const nr=sh.getDataRange().getValues(); let f=false; for(let i=1;i<nr.length;i++){if(nr[i][0]==='adminPassword'){sh.getRange(i+1,2,1,2).setValues([[hashed,new Date().toISOString()]]);f=true;break;}} if(!f)sh.appendRow(['adminPassword',hashed,new Date().toISOString()]); result={ok:true,token:makeToken('admin'),firstSetup:true};
    } else if (verifyPassword(data.password,storedPw)) { if(storedPw.indexOf(':')===-1){const hashed=hashPassword(data.password);const nr=sh.getDataRange().getValues();for(let i=1;i<nr.length;i++){if(nr[i][0]==='adminPassword'){sh.getRange(i+1,2,1,2).setValues([[hashed,new Date().toISOString()]]);break;}}} result={ok:true,token:makeToken('admin')};
    } else { result={ok:false,error:'Incorrect password.'}; }

  } else if (data.action === 'setAdminPassword') {
    if (!verifyToken(data.token||'','admin')) return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorised'})).setMimeType(ContentService.MimeType.JSON);
    const sh=getOrCreate('settings',['key','value','updatedAt']); const hashed=hashPassword(data.newPassword); const rows=sh.getDataRange().getValues(); let f=false; for(let i=1;i<rows.length;i++){if(rows[i][0]==='adminPassword'){sh.getRange(i+1,2,1,2).setValues([[hashed,new Date().toISOString()]]);f=true;break;}} if(!f)sh.appendRow(['adminPassword',hashed,new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'checkPassword') {
    const mh=getOrCreate('managers',['name','password']); const rows=mh.getDataRange().getValues().slice(1); const row=rows.find(r=>r[0]===data.manager);
    if (!row) { result={ok:false,error:'Manager not found.'};
    } else { const sp=row.length>1?String(row[1]).trim():''; if(!sp){result={ok:false,noPassword:true,error:'No password set — contact your admin.'};} else if(verifyPassword(data.password,sp)){if(sp.indexOf(':')===-1){const hashed=hashPassword(data.password);const allRows=mh.getDataRange().getValues();for(let i=1;i<allRows.length;i++){if(allRows[i][0]===data.manager){mh.getRange(i+1,2).setValue(hashed);break;}}} result={ok:true,token:makeToken('mgr:'+data.manager)};} else{result={ok:false,error:'Incorrect password.'};} }

  } else if (data.action === 'checkToken') {
    result={ok: verifyToken(data.token||'','mgr:'+data.manager)};

  } else if (data.action === 'submit') {
    const sh=getOrCreate('submissions',['timestamp','manager','week','name','email','position','leaver']); const rows=sh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][1]===data.manager&&rows[i][2]===data.week)sh.deleteRow(i+1);}
    const ts=new Date().toISOString(); data.rows.forEach(r=>sh.appendRow([ts,data.manager,data.week,r.name,r.email||'',r.position||'',r.leaver?'yes':'no']));
    const ph=getOrCreate('people',['name','email','manager','firstSeen']); const pRows=ph.getDataRange().getValues();
    data.rows.forEach(r=>{if(!pRows.some(p=>p[0].toLowerCase()===r.name.toLowerCase()&&p[2]===data.manager))ph.appendRow([r.name,r.email||'',data.manager,data.week]);}); result={ok:true};

  } else if (data.action === 'getSubmission') {
    const sh=getOrCreate('submissions',['timestamp','manager','week','name','email','position','leaver']); const ah=getOrCreate('acks',['manager','week','ackedAt']);
    result.rows=sh.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager&&r[2]===data.week).map(r=>({name:r[3],email:r[4],position:r[5],leaver:r[6]==='yes'}));
    result.acked=ah.getDataRange().getValues().slice(1).some(r=>r[0]===data.manager&&r[1]===data.week);

  } else if (data.action === 'getRoster') {
    const rh=getOrCreate('roster',['id','manager','name','email','position','leader','notes','flag','leaver','addedOn','updatedAt','managerNotes']);
    result.roster=rh.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager).map(r=>({id:r[0],name:r[2],email:r[3],position:r[4],leader:r[5],notes:r[6],flag:r[7],leaver:r[8]==='yes',addedOn:r[9],managerNotes:(()=>{try{return r[11]?JSON.parse(r[11]):[];}catch(e){return[];}})()}));

  } else if (data.action === 'saveRep') {
    const rh=getOrCreate('roster',['id','manager','name','email','position','leader','notes','flag','leaver','addedOn','updatedAt','managerNotes']); const r=data.rep;
    const mnJson=r.managerNotes&&r.managerNotes.length?JSON.stringify(r.managerNotes):'';
    const row=[r.id,data.manager,r.name||'',r.email||'',r.position||'',r.leader||'',r.notes||'',r.flag||'',r.leaver?'yes':'no',r.addedOn||'',new Date().toISOString(),mnJson];
    const rows=rh.getDataRange().getValues(); let f=false; for(let i=1;i<rows.length;i++){if(rows[i][0]===r.id&&rows[i][1]===data.manager){rh.getRange(i+1,1,1,row.length).setValues([row]);f=true;break;}} if(!f)rh.appendRow(row); result={ok:true};

  } else if (data.action === 'getAllData') {
    const sh=getOrCreate('submissions',['timestamp','manager','week','name','email','position','leaver']);
    const ph=getOrCreate('people',['name','email','manager','firstSeen']); const mh=getOrCreate('managers',['name','password']);
    const rh=getOrCreate('roster',['id','manager','name','email','position','leader','notes','flag','leaver','addedOn','updatedAt','managerNotes']);
    const mgrRows=mh.getDataRange().getValues().slice(1);
    result={
      subs:sh.getDataRange().getValues().slice(1).map(r=>({manager:r[1],week:r[2],name:r[3],email:r[4],position:r[5],leaver:r[6]==='yes'})),
      people:ph.getDataRange().getValues().slice(1).map(r=>({name:r[0],email:r[1],manager:r[2],firstSeen:r[3]})),
      managers:mgrRows.map(r=>r[0]).filter(Boolean),
      managerPasswordStatus:mgrRows.reduce((acc,r)=>{if(r[0])acc[r[0]]=!!(String(r[1]||'').trim());return acc;},{}),
      roster:rh.getDataRange().getValues().slice(1).map(r=>({id:r[0],manager:r[1],name:r[2],email:r[3],position:r[4],leader:r[5],notes:r[6],flag:r[7],leaver:r[8]==='yes',addedOn:r[9],managerNotes:(()=>{try{return r[11]?JSON.parse(r[11]):[];}catch(e){return[];}})()}))
    };

  } else if (data.action === 'addManager') {
    if(!data.name||typeof data.name!=='string'||data.name.trim().length<1||data.name.trim().length>40){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Invalid manager name.'})).setMimeType(ContentService.MimeType.JSON);}
    const safeName=data.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
    if(!safeName){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Name must contain letters or numbers.'})).setMimeType(ContentService.MimeType.JSON);}
    const mh=getOrCreate('managers',['name','password']); const existing=mh.getDataRange().getValues().slice(1).map(r=>r[0]);
    if(!existing.includes(safeName)){mh.appendRow([safeName,'']); writeAuditLog('addManager','admin','Added manager: '+safeName);} result={ok:true};

  } else if (data.action === 'setPassword') {
    const mh=getOrCreate('managers',['name','password']); const rows=mh.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager){mh.getRange(i+1,2).setValue(hashPassword(data.password));writeAuditLog('setPassword','admin','Password set for: '+data.manager);result={ok:true};break;}}

  } else if (data.action === 'removeManager') {
    const mh=getOrCreate('managers',['name','password']); const rows=mh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][0]===data.name)mh.deleteRow(i+1);} writeAuditLog('removeManager','admin','Removed manager: '+data.name); result={ok:true};

  } else if (data.action === 'saveMap') {
    const mh=getOrCreate('maps',['manager','mapData','updatedAt']); const rows=mh.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager){mh.getRange(i+1,2,1,2).setValues([[data.mapData,new Date().toISOString()]]);f=true;break;}} if(!f)mh.appendRow([data.manager,data.mapData,new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'loadMap') {
    const mh=getOrCreate('maps',['manager','mapData','updatedAt']); const row=mh.getDataRange().getValues().slice(1).find(r=>r[0]===data.manager); result={mapData:row?row[1]:null};

  } else if (data.action === 'saveReport') {
    if(!data.report||!data.report.url||!data.report.week){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Report must include url and week.'})).setMimeType(ContentService.MimeType.JSON);}
    if(!new RegExp('^https?://').test(data.report.url)){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Report URL must start with http:// or https://'})).setMimeType(ContentService.MimeType.JSON);}
    const rh=getOrCreate('reports',['id','type','url','campaign','week','managers','uploadedAt','officeWire','mgrTake']); const r=data.report;
    rh.appendRow([r.id,r.type,r.url,r.campaign||'',String(r.week||''),(r.managers||[]).join(','),r.uploadedAt||'',r.officeWire||'',r.mgrTake||'']); writeAuditLog('saveReport','admin',r.type+': '+(r.campaign||''),' w/c '+String(r.week||'')); result={ok:true};

  } else if (data.action === 'getAllReports') {
    const rh=getOrCreate('reports',['id','type','url','campaign','week','managers','uploadedAt','officeWire','mgrTake']);
    result={reports:rh.getDataRange().getValues().slice(1).map(r=>({id:r[0],type:r[1],url:r[2],campaign:r[3],week:safeDate(r[4]),managers:r[5]?String(r[5]).split(','):[],uploadedAt:r[6]||'',officeWire:r[7]!=null?String(r[7]):'',mgrTake:r[8]!=null?String(r[8]):''}))};

  } else if (data.action === 'getReports') {
    const rh=getOrCreate('reports',['id','type','url','campaign','week','managers','uploadedAt','officeWire','mgrTake']);
    result={reports:rh.getDataRange().getValues().slice(1).filter(r=>r[5]&&r[5].split(',').map(m=>m.trim()).includes(data.manager)).map(r=>({id:r[0],type:r[1],url:r[2],campaign:r[3],week:safeDate(r[4]),managers:r[5]?String(r[5]).split(','):[],uploadedAt:r[6]||'',officeWire:r[7]!=null?String(r[7]):'',mgrTake:r[8]!=null?String(r[8]):''}))};

  } else if (data.action === 'deleteReport') {
    const rh=getOrCreate('reports',['id','type','url','campaign','week','managers','uploadedAt']); const rows=rh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][0]===data.id){writeAuditLog('deleteReport','admin','Deleted report id: '+data.id);rh.deleteRow(i+1);break;}} result={ok:true};

  } else if (data.action === 'savePayData') {
    const ph=getOrCreate('pay_data',['manager','week','officeWire','mgrTake','updatedAt']); const rows=ph.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager&&rows[i][1]===data.week){ph.getRange(i+1,3,1,3).setValues([[data.officeWire||'',data.mgrTake||'',new Date().toISOString()]]);f=true;break;}}
    if(!f)ph.appendRow([data.manager,String(data.week||''),data.officeWire||'',data.mgrTake||'',new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'getPayData') {
    const ph=getOrCreate('pay_data',['manager','week','officeWire','mgrTake','updatedAt']);
    result={payData:ph.getDataRange().getValues().slice(1).filter(r=>r[0]===data.manager).map(r=>({week:safeDate(r[1]),officeWire:r[2]!=null?String(r[2]):'',mgrTake:r[3]!=null?String(r[3]):''}))};

  } else if (data.action === 'ackReport') {
    const ah=getOrCreate('acks',['manager','week','ackedAt']); const rows=ah.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager&&rows[i][1]===data.week){ah.getRange(i+1,3).setValue(new Date().toISOString());f=true;break;}} if(!f)ah.appendRow([data.manager,data.week,new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'getCalEvents') {
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    const rows=ch.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager);
    result={events:rows.map(r=>({id:String(r[0]),manager:r[1],title:r[2],date:safeDate(r[3]),time:r[4]||'',notes:r[5]||'',reminder:r[6]||'',category:r[7]||'personal',pushedAt:r[8]||'',recurring:r[9]==='yes'||r[9]===true,recurringGroupId:r[10]||null,recurringFreq:r[11]||null}))};

  } else if (data.action === 'getAllCalEvents') {
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    result={events:ch.getDataRange().getValues().slice(1).map(r=>({id:String(r[0]),manager:r[1],title:r[2],date:safeDate(r[3]),time:r[4]||'',notes:r[5]||'',reminder:r[6]||'',category:r[7]||'personal',pushedAt:r[8]||'',recurring:r[9]==='yes'||r[9]===true,recurringGroupId:r[10]||null,recurringFreq:r[11]||null}))};

  } else if (data.action === 'saveCalEvents') {
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    const rows=ch.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][1]===data.manager)ch.deleteRow(i+1);}
    (data.events||[]).forEach(ev=>{ch.appendRow([ev.id||('ev'+Date.now()+Math.random().toString(36).slice(2,5)),data.manager,ev.title||'',ev.date||'',ev.time||'',ev.notes||'',ev.reminder||'',ev.category||'personal',ev.pushedAt||new Date().toISOString(),ev.recurring?'yes':'no',ev.recurringGroupId||'',ev.recurringFreq||'']);});
    result={ok:true};

  } else if (data.action === 'saveCalEvent') {
    if(!data.event||!data.event.title||!data.event.date){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Calendar event must include title and date.'})).setMimeType(ContentService.MimeType.JSON);}
    if(data.event.date&&!new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}$').test(data.event.date)){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Invalid date format — expected YYYY-MM-DD.'})).setMimeType(ContentService.MimeType.JSON);}
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    const ev=data.event; const rows=ch.getDataRange().getValues(); let found=false;
    const row=[ev.id,ev.manager||data.manager,ev.title||'',ev.date||'',ev.time||'',ev.notes||'',ev.reminder||'',ev.category||'personal',ev.pushedAt||new Date().toISOString(),ev.recurring?'yes':'no',ev.recurringGroupId||'',ev.recurringFreq||''];
    for(let i=1;i<rows.length;i++){if(rows[i][0]===ev.id&&rows[i][1]===(ev.manager||data.manager)){ch.getRange(i+1,1,1,row.length).setValues([row]);found=true;break;}}
    if(!found)ch.appendRow(row); result={ok:true};

  } else if (data.action === 'deleteCalEvent') {
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    const rows=ch.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][0]===data.id)ch.deleteRow(i+1);}
    result={ok:true};

  } else if (data.action === 'updateCalEvent') {
    const ch=getOrCreate('cal_events',['id','manager','title','date','time','notes','reminder','category','pushedAt','recurring','recurringGroupId','recurringFreq']);
    const rows=ch.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      const rowId=String(rows[i][0]||'');
      const rowGroupId=String(rows[i][10]||'');
      // Edit series: update all rows sharing the same recurringGroupId
      const matchSeries = data.scope==='series' && data.groupId && rowGroupId===String(data.groupId);
      // Edit one: update only the exact row by id
      const matchOne = data.scope!=='series' && rowId===String(data.id);
      if(matchSeries||matchOne){
        if(data.title!==undefined)ch.getRange(i+1,3).setValue(data.title);
        if(data.notes!==undefined)ch.getRange(i+1,6).setValue(data.notes);
        // Only update date/time for single-event edits, not series
        if(!matchSeries){
          if(data.date!==undefined)ch.getRange(i+1,4).setValue(data.date);
          if(data.time!==undefined)ch.getRange(i+1,5).setValue(data.time);
        }
      }
    }
    result={ok:true};

  } else if (data.action === 'saveDeadlineSettings') {
    const sh=getOrCreate('settings',['key','value','updatedAt']);
    const keyMap={deadlineDay:data.day,deadlineTime:data.time,deadlineMsg:data.msg};
    const rows=sh.getDataRange().getValues();
    Object.entries(keyMap).forEach(([key,val])=>{
      let found=false;
      for(let i=1;i<rows.length;i++){if(rows[i][0]===key){sh.getRange(i+1,2,1,2).setValues([[val,new Date().toISOString()]]);found=true;break;}}
      if(!found)sh.appendRow([key,val,new Date().toISOString()]);
    });
    installDeadlineTrigger();
    result={ok:true};

  } else if (data.action === 'getDeadlineSettings') {
    const sh=getOrCreate('settings',['key','value','updatedAt']);
    const rows=sh.getDataRange().getValues().slice(1);
    const get=k=>{const r=rows.find(r=>r[0]===k);return r?String(r[1]||''):'';}
    result={day:get('deadlineDay'),time:get('deadlineTime')||'17:00',msg:get('deadlineMsg')};

  } else if (data.action === 'removeDeadlineTrigger') {
    ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='runDeadlineCheckTrigger').forEach(t=>ScriptApp.deleteTrigger(t));
    result={ok:true};

  } else if (data.action === 'getAnnouncement') {
    const ah=getOrCreate('announcements',['id','title','message','active','createdAt']);
    const active=ah.getDataRange().getValues().slice(1).filter(r=>r[3]==='yes').sort((a,b)=>b[4].localeCompare(a[4]));
    result={announcement:active.length?{id:active[0][0],title:active[0][1],message:active[0][2]}:null};

  } else if (data.action === 'saveAnnouncement') {
    const ah=getOrCreate('announcements',['id','title','message','active','createdAt']); const rows=ah.getDataRange().getValues();
    for(let i=1;i<rows.length;i++)ah.getRange(i+1,4).setValue('no');
    if(data.title)ah.appendRow(['ann'+Date.now(),data.title,data.message||'','yes',new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'getNotes') {
    const nh=getOrCreate('notes',['manager','notes','updatedAt']); const row=nh.getDataRange().getValues().slice(1).find(r=>r[0]===data.manager); result={notes:row?row[1]:''};

  } else if (data.action === 'saveNotes') {
    const nh=getOrCreate('notes',['manager','notes','updatedAt']); const rows=nh.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager){nh.getRange(i+1,2,1,2).setValues([[data.notes,new Date().toISOString()]]);f=true;break;}} if(!f)nh.appendRow([data.manager,data.notes,new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'getLastWeekCount') {
    const sh=getOrCreate('submissions',['timestamp','manager','week','name','email','position','leaver']);
    const pts=data.currentWeek.split('-'); const cur=new Date(+pts[0],+pts[1]-1,+pts[2]); cur.setDate(cur.getDate()-7);
    const pw=cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
    result={count:sh.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager&&r[2]===pw&&r[6]!=='yes').length};

  } else if (data.action === 'saveWeeklyReview') {
    const rh=getOrCreate('weekly_reviews',['id','manager','week','reviewData','submittedAt']); const rows=rh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][1]===data.manager&&rows[i][2]===data.week)rh.deleteRow(i+1);}
    rh.appendRow([data.id||('wr'+Date.now()),data.manager,data.week,JSON.stringify(data.reviewData),new Date().toISOString()]);
    try{var esh=getOrCreate('settings',['key','value','updatedAt']);var erow=esh.getDataRange().getValues().slice(1).find(function(r){return r[0]==='reviewEmails';});var es=erow?String(erow[1]):'';if(es){var recs=es.split(',').map(function(x){return x.trim();}).filter(Boolean);if(recs.length){var dn2=data.manager.charAt(0).toUpperCase()+data.manager.slice(1);var subj='Weekly Review - '+dn2+' - w/c '+(data.week||'');var ph2=(data.reviewData||{}).pdfHtml||'';recs.forEach(function(to){try{if(ph2){MailApp.sendEmail({to:to,subject:subj,body:'Weekly Review: '+dn2,htmlBody:ph2});}else{MailApp.sendEmail(to,subj,'Weekly Review: '+dn2);}}catch(me2){}});}}}catch(mailErr){}
    result={ok:true};

  } else if (data.action === 'getManagerReviews') {
    const rh=getOrCreate('weekly_reviews',['id','manager','week','reviewData','submittedAt']);
    result={reviews:rh.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager).map(r=>({id:r[0],manager:r[1],week:r[2],reviewData:(()=>{try{return JSON.parse(r[3]);}catch(e){return{};}})(),submittedAt:r[4]}))};

  } else if (data.action === 'getAllWeeklyReviews') {
    const rh=getOrCreate('weekly_reviews',['id','manager','week','reviewData','submittedAt']);
    result={reviews:rh.getDataRange().getValues().slice(1).map(r=>({id:r[0],manager:r[1],week:r[2],reviewData:(()=>{try{return JSON.parse(r[3]);}catch(e){return{};}})(),submittedAt:r[4]}))};

  } else if (data.action === 'saveReviewEmails') {
    const sh=getOrCreate('settings',['key','value','updatedAt']); const rows=sh.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]==='reviewEmails'){sh.getRange(i+1,2,1,2).setValues([[data.emails,new Date().toISOString()]]);f=true;break;}} if(!f)sh.appendRow(['reviewEmails',data.emails,new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'getReviewEmails') {
    const sh=getOrCreate('settings',['key','value','updatedAt']); const row=sh.getDataRange().getValues().slice(1).find(r=>r[0]==='reviewEmails'); result={emails:row?row[1]:''};

  } else if (data.action === 'saveProfilePic') {
    const ph=getOrCreate('profile_pics',['manager','picUrl','updatedAt']); const rows=ph.getDataRange().getValues(); let picUrl='';
    if(data.picData&&data.picData.startsWith('data:')){
      const folder=getPicFolder(); const parts=data.picData.split(','); const mm=parts[0].match(/:(.*?);/); const mime=mm?mm[1]:'image/jpeg'; const ext=mime.split('/')[1]||'jpg';
      const decoded=Utilities.newBlob(Utilities.base64Decode(parts[1]),mime);
      const er=rows.slice(1).find(r=>r[0]===data.manager); if(er&&er[1]){try{const oid=er[1].match(/[-\\w]{25,}/);if(oid)DriveApp.getFileById(oid[0]).setTrashed(true);}catch(e){}}
      const file=folder.createFile(decoded.setName('pic_'+data.manager+'_'+Date.now()+'.'+ext));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      picUrl='https://drive.google.com/uc?export=view&id='+file.getId();
    }
    let f=false; for(let i=1;i<rows.length;i++){if(rows[i][0]===data.manager){ph.getRange(i+1,2,1,2).setValues([[picUrl,new Date().toISOString()]]);f=true;break;}} if(!f&&picUrl)ph.appendRow([data.manager,picUrl,new Date().toISOString()]); result={ok:true,picUrl};

  } else if (data.action === 'getProfilePic') {
    const ph=getOrCreate('profile_pics',['manager','picUrl','updatedAt']); const row=ph.getDataRange().getValues().slice(1).find(r=>r[0]===data.manager); result={picUrl:row?row[1]:null};

  } else if (data.action === 'getAllProfilePics') {
    const ph=getOrCreate('profile_pics',['manager','picUrl','updatedAt']); result={pics:ph.getDataRange().getValues().slice(1).map(r=>({manager:r[0],picUrl:r[1]}))};

  } else if (data.action === 'saveNotification') {
    const nh=getOrCreate('notifications',['id','manager','title','message','sentAt','readAt']); const n=data.notification;
    nh.appendRow([n.id,n.manager,n.title||'',n.message||'',n.sentAt||new Date().toISOString(),'']); writeAuditLog('sendNotification','admin','To: '+n.manager+' — '+n.title); result={ok:true};

  } else if (data.action === 'getNotifications') {
    const nh=getOrCreate('notifications',['id','manager','title','message','sentAt','readAt']);
    result={notifications:nh.getDataRange().getValues().slice(1).filter(r=>r[1]===data.manager).map(r=>({id:r[0],manager:r[1],title:r[2],message:r[3],sentAt:r[4]||'',readAt:r[5]||''}))};

  } else if (data.action === 'getAllNotifications') {
    const nh=getOrCreate('notifications',['id','manager','title','message','sentAt','readAt']);
    result={notifications:nh.getDataRange().getValues().slice(1).map(r=>({id:r[0],manager:r[1],title:r[2],message:r[3],sentAt:r[4]||'',readAt:r[5]||''}))};

  } else if (data.action === 'markNotifRead') {
    const nh=getOrCreate('notifications',['id','manager','title','message','sentAt','readAt']); const rows=nh.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){if(rows[i][0]===data.id&&rows[i][1]===data.manager){nh.getRange(i+1,6).setValue(new Date().toISOString());break;}} result={ok:true};

  } else if (data.action === 'deleteNotification') {
    const nh=getOrCreate('notifications',['id','manager','title','message','sentAt','readAt']); const rows=nh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][0]===data.id){nh.deleteRow(i+1);break;}} result={ok:true};

  } else if (data.action === 'getNotifTemplates') {
    const th=getOrCreate('notif_templates',['id','name','title','message','createdAt']);
    result={templates:th.getDataRange().getValues().slice(1).map(r=>({id:r[0],name:r[1],title:r[2],message:r[3],createdAt:r[4]||''}))};

  } else if (data.action === 'saveNotifTemplate') {
    const th=getOrCreate('notif_templates',['id','name','title','message','createdAt']);
    th.appendRow([data.template.id,data.template.name,data.template.title||'',data.template.message||'',new Date().toISOString()]); result={ok:true};

  } else if (data.action === 'deleteNotifTemplate') {
    const th=getOrCreate('notif_templates',['id','name','title','message','createdAt']); const rows=th.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(rows[i][0]===data.id){th.deleteRow(i+1);break;}} result={ok:true};

  } else if (data.action === 'saveDailyPlanner') {
    // Group keys (shared planners) are not guessable — allow saves without a session token
    const isGroupKey = String(data.manager||'').startsWith('group::');
    if(!isGroupKey){
      const mgrRole='mgr:'+String(data.manager||'');
      if(!verifyToken(data.token||'',mgrRole)&&!verifyToken(data.token||'','admin')){
        return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorised'})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    const ph=getOrCreate('daily_planner',['manager','date','data','updatedAt']);
    const rows=ph.getDataRange().getValues(); let f=false;
    for(let i=1;i<rows.length;i++){
      if(rows[i][0]===data.manager&&safeDate(rows[i][1])===data.date){
        ph.getRange(i+1,3,1,2).setValues([[data.data,new Date().toISOString()]]);f=true;break;
      }
    }
    if(!f)ph.appendRow([data.manager,data.date,data.data,new Date().toISOString()]);
    result={ok:true};

  } else if (data.action === 'getDailyPlanner') {
    const ph=getOrCreate('daily_planner',['manager','date','data','updatedAt']);
    const row=ph.getDataRange().getValues().slice(1).find(r=>r[0]===data.manager&&safeDate(r[1])===data.date);
    result={data:row?String(row[2]||''):null};

  } else if (data.action === 'createPlannerToken') {
    if(!verifyToken(data.token||'','mgr:'+String(data.manager||''))&&!verifyToken(data.token||'','admin'))return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorised'})).setMimeType(ContentService.MimeType.JSON);
    const pts=getOrCreate('planner_tokens',['token','groupKey','manager','createdAt']);
    // Remove any existing tokens for this manager+groupKey first
    const ptRows=pts.getDataRange().getValues();
    for(let i=ptRows.length-1;i>=1;i--){if(String(ptRows[i][2])===String(data.manager)&&String(ptRows[i][1])===String(data.groupKey)){pts.deleteRow(i+1);}}
    const token=Utilities.getUuid().replace(/-/g,'').slice(0,32);
    pts.appendRow([token,data.groupKey,data.manager,new Date().toISOString()]);
    result={ok:true,token};

  } else if (data.action === 'validatePlannerToken') {
    const pts=getOrCreate('planner_tokens',['token','groupKey','manager','createdAt']);
    const ptRows=pts.getDataRange().getValues().slice(1);
    const valid=ptRows.some(r=>String(r[0])===String(data.guestToken)&&String(r[1])===String(data.groupKey));
    result={ok:valid};

  } else if (data.action === 'savePlannerGroups') {
    // Admin saves group assignments: [{id, name, members:[]}]
    const sh=getOrCreate('planner_groups',['groupId','groupName','members','updatedAt']);
    // Delete all existing rows and rewrite
    const lr=sh.getLastRow();
    if(lr>1)sh.deleteRows(2,lr-1);
    (data.groups||[]).forEach(g=>{
      sh.appendRow([g.id,g.name,(g.members||[]).join(','),new Date().toISOString()]);
    });
    result={ok:true};

  } else if (data.action === 'getPlannerGroups') {
    const sh=getOrCreate('planner_groups',['groupId','groupName','members','updatedAt']);
    const rows=sh.getDataRange().getValues().slice(1).filter(r=>r[0]);
    result={groups:rows.map(r=>({id:String(r[0]),name:String(r[1]),members:r[2]?String(r[2]).split(',').filter(Boolean):[]}))};

  } else if (data.action === 'saveClient') {
    // Save a new registered client; optionally upload logo to Drive
    const sh=getOrCreate('clients',['id','clientName','campaign','fullName','logoUrl','createdAt']);
    const c=data.client||{};
    let logoUrl='';
    if(c.logoData&&c.logoData.startsWith('data:')){
      try{
        const mime=c.logoData.split(';')[0].split(':')[1];
        const b64=c.logoData.split(',')[1];
        const bytes=Utilities.base64Decode(b64);
        const blob=Utilities.newBlob(bytes,mime,(c.clientName||'logo')+'_logo');
        const folder=getPicFolder();
        const file=folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
        logoUrl='https://drive.google.com/uc?id='+file.getId();
      }catch(e){logoUrl='';}
    }
    sh.appendRow([c.id,c.clientName,c.campaign,c.fullName,logoUrl,new Date().toISOString()]);
    result={ok:true,logoUrl};

  } else if (data.action === 'getClients') {
    const sh=getOrCreate('clients',['id','clientName','campaign','fullName','logoUrl','createdAt']);
    const rows=sh.getDataRange().getValues().slice(1).filter(r=>r[0]);
    result={clients:rows.map(r=>({id:String(r[0]),clientName:String(r[1]),campaign:String(r[2]),fullName:String(r[3]),logoUrl:String(r[4]||'')}))};

  } else if (data.action === 'deleteClient') {
    const sh=getOrCreate('clients',['id','clientName','campaign','fullName','logoUrl','createdAt']);
    const rows=sh.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--){if(String(rows[i][0])===String(data.id)){sh.deleteRow(i+1);break;}}
    result={ok:true};

  } else if (data.action === 'saveManagerProfile') {
    // Save profile fields for a manager: city, phone, startDate, weeklyTarget, bio, campaigns[]
    const sh=getOrCreate('manager_profiles',['manager','city','phone','startDate','weeklyTarget','bio','campaigns','updatedAt']);
    const m=String(data.manager||'').toLowerCase();
    const p=data.profile||{};
    const campaignsStr=(p.campaigns||[]).join(',');
    const rows=sh.getDataRange().getValues();
    let found=false;
    for(let i=1;i<rows.length;i++){
      if(String(rows[i][0]).toLowerCase()===m){
        sh.getRange(i+1,2,1,7).setValues([[p.city||'',p.phone||'',p.startDate||'',p.weeklyTarget||'',p.bio||'',campaignsStr,new Date().toISOString()]]);
        found=true;break;
      }
    }
    if(!found)sh.appendRow([m,p.city||'',p.phone||'',p.startDate||'',p.weeklyTarget||'',p.bio||'',campaignsStr,new Date().toISOString()]);
    result={ok:true};

  } else if (data.action === 'getManagerProfile') {
    const sh=getOrCreate('manager_profiles',['manager','city','phone','startDate','weeklyTarget','bio','campaigns','updatedAt']);
    const m=String(data.manager||'').toLowerCase();
    const rows=sh.getDataRange().getValues().slice(1).filter(r=>r[0]);
    const row=rows.find(r=>String(r[0]).toLowerCase()===m);
    if(row){
      result={profile:{city:String(row[1]||''),phone:String(row[2]||''),startDate:row[3]?safeDate(row[3]):'',weeklyTarget:String(row[4]||''),bio:String(row[5]||''),campaigns:row[6]?String(row[6]).split(',').filter(Boolean):[]}};
    }else{result={profile:{}};}

  } else if (data.action === 'getManagerProfiles') {
    // Returns all manager profiles as a map { managerName: profile }
    const sh=getOrCreate('manager_profiles',['manager','city','phone','startDate','weeklyTarget','bio','campaigns','updatedAt']);
    const rows=sh.getDataRange().getValues().slice(1).filter(r=>r[0]);
    const profiles={};
    rows.forEach(r=>{
      profiles[String(r[0]).toLowerCase()]={city:String(r[1]||''),phone:String(r[2]||''),startDate:r[3]?safeDate(r[3]):'',weeklyTarget:String(r[4]||''),bio:String(r[5]||''),campaigns:r[6]?String(r[6]).split(',').filter(Boolean):[]};
    });
    result={profiles};

  } else if (data.action === 'getDpSharing') {
    const gsh=getOrCreate('planner_groups',['groupId','groupName','members','updatedAt']);
    const groups=gsh.getDataRange().getValues().slice(1).filter(r=>r[0]);
    let groupMembers=[];let groupName='';
    for(const g of groups){const members=g[2]?String(g[2]).split(',').filter(Boolean):[];if(members.includes(data.manager)){groupMembers=members;groupName=String(g[1]);break;}}
    if(groupMembers.length>=1){
      const groupId=groups.find(g=>String(g[1])===groupName)?.[0]||'';
      result={sharedWith:groupMembers.filter(m=>m!==data.manager),groupName,groupId,adminAssigned:true};
    } else {
      result={sharedWith:[],adminAssigned:false};
    }

  } else if (data.action === 'getAuditLog') {
    const al=getOrCreate('audit_log',['timestamp','action','actor','detail']);
    const rows=al.getDataRange().getValues().slice(1).reverse();
    result={entries:rows.slice(0,200).map(r=>({timestamp:r[0]||'',action:r[1]||'',actor:r[2]||'',detail:r[3]||''}))};

  } else if (data.action === 'savePayIndexUrl') {
    const sh=getOrCreate('settings',['key','value','updatedAt']);
    const rows=sh.getDataRange().getValues();
    let found=false;
    for(let i=1;i<rows.length;i++){if(rows[i][0]==='payIndexUrl'){sh.getRange(i+1,2,1,2).setValues([[data.url,new Date().toISOString()]]);found=true;break;}}
    if(!found)sh.appendRow(['payIndexUrl',data.url,new Date().toISOString()]);
    result={ok:true};

  } else if (data.action === 'getPayIndexUrl') {
    const sh=getOrCreate('settings',['key','value','updatedAt']);
    const rows=sh.getDataRange().getValues().slice(1);
    const row=rows.find(r=>r[0]==='payIndexUrl');
    result={url:row?String(row[1]||''):''};

  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function writeAuditLog(action,actor,detail) {
  try {
    var al=getOrCreate('audit_log',['timestamp','action','actor','detail']);
    al.appendRow([new Date().toISOString(),action,actor||'admin',detail||'']);
  } catch(e) {}
}

function installDeadlineTrigger() {
  // Remove any existing deadline triggers first
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runDeadlineCheckTrigger')
    .forEach(t => ScriptApp.deleteTrigger(t));
  // Install a new trigger that runs every day at 8am
  // The handler itself reads the configured time from the sheet and skips if not yet due
  ScriptApp.newTrigger('runDeadlineCheckTrigger')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function runDeadlineCheckTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('settings');
  if (!sh) return;
  const rows = sh.getDataRange().getValues().slice(1);
  const get = k => { const r = rows.find(r => r[0]===k); return r ? String(r[1]||'') : ''; };
  const day = get('deadlineDay');
  const time = get('deadlineTime') || '17:00';
  const msg = get('deadlineMsg') || '⏰ Reminder: Your weekly update is overdue. Please submit it now.';
  if (!day) return; // not configured

  // Work out if deadline has passed this week
  const now = new Date();
  const [hh, mm] = time.split(':').map(Number);
  // Find Monday of this week
  const mon = new Date(now);
  mon.setHours(0,0,0,0);
  const dow = mon.getDay() === 0 ? 6 : mon.getDay() - 1; // Mon=0
  mon.setDate(mon.getDate() - dow);
  const dayOffset = parseInt(day) === 0 ? 6 : parseInt(day) - 1;
  const deadlineDate = new Date(mon);
  deadlineDate.setDate(mon.getDate() + dayOffset);
  deadlineDate.setHours(hh, mm, 0, 0);
  if (now < deadlineDate) return; // not yet due

  // Check last-run to avoid duplicate sends on same week
  const weekKey = Utilities.formatDate(mon, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const lrSheet = getOrCreate('trigger_log', ['weekKey','ranAt']);
  const lrRows = lrSheet.getDataRange().getValues().slice(1);
  if (lrRows.some(r => r[0] === weekKey)) return; // already ran this week

  // Find managers who haven't submitted
  const subSheet = ss.getSheetByName('submissions');
  if (!subSheet) return;
  const subs = subSheet.getDataRange().getValues().slice(1);
  const submittedMgrs = new Set(subs.filter(r => r[2] === weekKey).map(r => r[1]));
  const mgrSheet = ss.getSheetByName('managers');
  if (!mgrSheet) return;
  const allMgrs = mgrSheet.getDataRange().getValues().slice(1).map(r => r[0]).filter(Boolean);
  const missing = allMgrs.filter(m => !submittedMgrs.has(m));
  if (!missing.length) { lrSheet.appendRow([weekKey, now.toISOString()]); return; }

  // Send notifications
  const notifSheet = getOrCreate('notifications', ['id','manager','title','message','sentAt','readAt']);
  missing.forEach(mgr => {
    notifSheet.appendRow(['deadline'+now.getTime()+Math.random().toString(36).slice(2,5), mgr, 'Submission Overdue', msg, now.toISOString(), '']);
  });
  lrSheet.appendRow([weekKey, now.toISOString()]);
}`;

// Apps Script source is populated lazily when the Setup tab is opened (see switchTab)

// ── Admin Auth (server-side token) ─────────────────────
const ADMIN_TOKEN_KEY = 'tt_admin_token';

let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';

async function doAdminLogin() {
  const val = document.getElementById('admin-pw-input').value.trim();
  const err = document.getElementById('admin-login-err');
  const btn = document.querySelector('.admin-login-btn');
  const showErr = msg => { err.textContent = msg; err.style.display = 'block'; };
  err.style.display = 'none';

  // If no scriptUrl, try to read it from the inline field on the login screen
  if (!scriptUrl) {
    const urlField = document.getElementById('login-script-url');
    if (urlField && urlField.value.trim()) {
      scriptUrl = urlField.value.trim();
      localStorage.setItem('teamtracker_script_url', scriptUrl);
    } else {
      document.getElementById('login-url-field').style.display = 'block';
      showErr('Please enter your Apps Script URL above first.');
      document.getElementById('login-script-url').focus();
      return;
    }
  }

  if (!val) { showErr('Please enter a password.'); return; }
  btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const res = await fetch(scriptUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'adminLogin', password: val }) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      showErr('Apps Script returned an unexpected response — make sure it is deployed as a Web App with access set to "Anyone".');
      btn.disabled = false; btn.textContent = 'Sign in';
      return;
    }
    if (data.ok && data.token) {
      adminToken = data.token;
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      document.getElementById('admin-login-screen').style.display = 'none';
      document.getElementById('admin-main-wrap').style.display = 'block';
      if (data.firstSetup) showToast('Admin password set for the first time ✓', 'success');
      if (scriptUrl) { loadAll(); } else { showEmpty(); }
      renderLinks();
      const calInp=document.getElementById('cal-date');
      if(calInp){const t=new Date();calInp.value=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');}
      const d=new Date();d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
      const inp=document.getElementById('ul-week');
      if(inp){inp.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    } else {
      err.textContent = data.error || 'Incorrect password.';
      err.style.display = 'block';
      document.getElementById('admin-pw-input').value = '';
      document.getElementById('admin-pw-input').focus();
    }
  } catch(e) {
    err.textContent = 'Login failed — check the Script URL is deployed correctly.';
    err.style.display = 'block';
  }
  btn.disabled = false; btn.textContent = 'Sign in';
}

function checkAdminAuth() {
  const stored = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!stored || !scriptUrl) return false;
  // Verify token with server before showing the app — avoids stale/forged tokens
  adminToken = stored;
  fetch(scriptUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'getAllData', token: stored }) })
    .then(r => r.text())
    .then(text => { try { return JSON.parse(text); } catch(e) { return null; } })
    .then(data => {
      if (data && (data.managers !== undefined)) {
        // Token accepted — show the app and load data
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-main-wrap').style.display = 'block';
        const scriptInp = document.getElementById('script-url-input');
        if (scriptInp) { scriptInp.value = scriptUrl; document.getElementById('url-status').textContent = '✓ Script URL saved'; }
        const payInp = document.getElementById('pay-index-url-input');
        const savedPayUrl = localStorage.getItem('tt_pay_index_url') || '';
        if (payInp && savedPayUrl) { payInp.value = savedPayUrl; document.getElementById('pay-index-url-status').textContent = '✓ Pay index URL saved'; }
        renderLinks();
        const calInp=document.getElementById('cal-date');
        if(calInp){const t=new Date();calInp.value=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');}
        const d=new Date();d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
        const inp=document.getElementById('ul-week');
        if(inp){inp.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
        loadAll();
      } else {
        // Token rejected or expired — clear and show login screen
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        adminToken = '';
        document.getElementById('admin-login-screen').style.display = '';
        document.getElementById('admin-main-wrap').style.display = 'none';
      }
    })
    .catch(() => {
      // Network error — clear token and show login screen so user can retry
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      adminToken = '';
      document.getElementById('admin-login-screen').style.display = '';
      document.getElementById('admin-main-wrap').style.display = 'none';
    });
  // Hide login screen optimistically while we verify — it snaps back if rejected
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-main-wrap').style.display = 'block';
  return true;
}

// ── Theme ──────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('tt_theme')||'light';
  document.documentElement.setAttribute('data-theme', saved);
  _updateThemeBtn(saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('tt_theme',next);
  _updateThemeBtn(next);
}
const _SVG_MOON='<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 12a7 7 0 1 1-9-9 5.5 5.5 0 0 0 9 9z" stroke-linejoin="round"/></svg>';
const _SVG_SUN='<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M4.6 15.4l1.4-1.4M14 6l1.4-1.4" stroke-linecap="round"/></svg>';
const _SVG_WARN='<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3L2 17h16L10 3z" stroke-linejoin="round"/><path d="M10 9v4M10 15h.01" stroke-linecap="round"/></svg>';
const _SVG_CAM='<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="16" height="12" rx="2"/><circle cx="10" cy="12" r="3"/><path d="M7 6l1-3h4l1 3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const _SVG_BLDG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h6" stroke-linecap="round"/></svg>';
const _SVG_POUND='<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 5a4 4 0 0 0-7 2.5V11H4M4 14h12M6 11h6" stroke-linecap="round"/></svg>';
function _updateThemeBtn(theme){
  const btn=document.getElementById('theme-btn');
  if(!btn)return;
  btn.innerHTML=(theme==='dark'?_SVG_SUN+' Light':_SVG_MOON+' Dark');
}
// ── State ──────────────────────────────────────────────
var DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeCMHtk4box-1rKwTt4UKF5UlpsyGWB2QISs522KkoQvJ3XzhjvvQ8wcOWU3bYJ7dc/exec';
var scriptUrl = localStorage.getItem('teamtracker_script_url') || DEFAULT_SCRIPT_URL;
try{localStorage.setItem('teamtracker_script_url', scriptUrl);}catch(e){}
let managers=[], plannerGroups=[], allSubs=[], allPeople=[], allWeeks=[], viewWeekKey='', allRoster=[];
let managerPasswordStatus = {}; // manager -> true if password set
let allProfilePics = {}; // manager -> Drive URL
let pushedCalEvents = [];
let allWeeklyReviews = [];
const MGR_BASE = window.location.href.replace('admin.html','manager.html');

function getWeekKey(date) {
  const d=new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
  return d.toISOString().split('T')[0];
}
function formatWeek(key) {
  if(!key||typeof key!=='string')return'—';
  const parts=key.split('-');
  if(parts.length!==3)return key;
  const d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
  if(isNaN(d))return key;
  const end=new Date(d);end.setDate(end.getDate()+6);
  const f=dt=>dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  return `w/c ${f(d)} – ${f(end)}`;
}
function fmtReportDate(key) {
  if(!key||typeof key!=='string')return'—';
  const raw=key.trim().split('T')[0];
  const p=raw.split('-');
  if(p.length!==3)return key;
  const yr=parseInt(p[0],10),mo=parseInt(p[1],10),dy=parseInt(p[2],10);
  if(isNaN(yr)||isNaN(mo)||isNaN(dy)||mo<1||mo>12||dy<1||dy>31)return key;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sfx=dy===1||dy===21||dy===31?'st':dy===2||dy===22?'nd':dy===3||dy===23?'rd':'th';
  return dy+sfx+' '+months[mo-1]+' '+yr;
}
var currentWeek = getWeekKey(new Date());

window.onload = () => {
  initTheme();
  // If no scriptUrl, show the URL field on the login screen immediately
  if (!scriptUrl) {
    document.getElementById('login-url-field').style.display = 'block';
  }
  // Check auth — if already logged in this session, verify token and skip login screen
  const alreadyAuthed = checkAdminAuth();
  if (alreadyAuthed) return; // checkAdminAuth handles loadAll + UI init asynchronously
  // No session token — show login screen (already visible by default)
};

// Tracks which tabs have already loaded their data this session
const _tabLoaded = new Set();

async function loadAll(force=false) {
  if (!scriptUrl) { showEmpty(); return; }
  if (force) _tabLoaded.clear();
  document.getElementById('teams-grid').innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
  try {
    // ── Phase 1: Core data needed for Overview only ──────────────────
    const [data, picsData] = await Promise.all([
      api({action:'getAllData'}),
      api({action:'getAllProfilePics'})
    ]);
    managers=data.managers||[]; allSubs=data.subs||[]; allPeople=data.people||[]; allRoster=data.roster||[];
    (picsData.pics||[]).forEach(p => { if(p.picUrl) allProfilePics[p.manager] = p.picUrl; });
    if (data.managerPasswordStatus) managerPasswordStatus = data.managerPasswordStatus;

    const ws=new Set();
    allSubs.forEach(s=>ws.add(s.week));
    ws.add(currentWeek);
    for(let i=1;i<=4;i++){const fw=new Date();fw.setDate(fw.getDate()-(fw.getDay()===0?6:fw.getDay()-1)+i*7);ws.add(fw.toISOString().split('T')[0]);}
    allWeeks=Array.from(ws).sort();
    if (!viewWeekKey||!allWeeks.includes(viewWeekKey)) viewWeekKey=currentWeek;

    // Overview renders immediately — user sees data fast
    renderOverview(); renderPeople(); renderLinks();

    // ── Phase 2: Background loads that don't block the UI ────────────
    // Run in background — tabs will also lazy-load on first open,
    // but pre-fetching here means they're instant if user navigates quickly.
    Promise.allSettled([
      _loadReportsData(),
      _loadCalendarData(),
      _loadReviewsData(),
      _loadPlannerData(),
      loadDeadlineSettings(),
      loadPayIndexUrl(),
    ]).then(() => { runDeadlineCheck(); });

  } catch(e) {
    showToast('Failed to load — check script URL','error',5000);
    document.getElementById('teams-grid').innerHTML='<div class="no-data"><strong>Could not load data</strong>Check your Apps Script URL in the Setup tab.</div>';
  }
}

// ── Lazy loaders — each runs once, then marks itself done ─────────────

async function _loadReportsData() {
  if (_tabLoaded.has('upload')) return;
  _tabLoaded.add('upload');
  try {
    const res = await api({action:'getAllReports'});
    allUploadedReports = res.reports||[];
    updateCampaignSuggestions();
  } catch(e) { _tabLoaded.delete('upload'); }
}

async function _loadCalendarData() {
  if (_tabLoaded.has('calendar')) return;
  _tabLoaded.add('calendar');
  try { await loadAllCalendarEvents(); } catch(e) { _tabLoaded.delete('calendar'); }
}

async function _loadReviewsData() {
  if (_tabLoaded.has('reviews')) return;
  _tabLoaded.add('reviews');
  try {
    await loadWeeklyReviews();
    await loadReviewEmails();
  } catch(e) { _tabLoaded.delete('reviews'); }
}

async function _loadPlannerData() {
  if (_tabLoaded.has('planner')) return;
  _tabLoaded.add('planner');
  try { await pgLoad(); } catch(e) { _tabLoaded.delete('planner'); }
}

async function loadAllCalendarEvents() {
  if (!managers.length) return;
  pushedCalEvents = [];
  // Single API call returns all managers' events — avoids N parallel requests
  try {
    const res = await api({action:'getAllCalEvents'});
    const seen = new Set();
    (res.events||[]).forEach(ev => {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        if (!ev.managers) ev.managers = [ev.manager].filter(Boolean);
        pushedCalEvents.push(ev);
      } else {
        const existing = pushedCalEvents.find(e=>e.id===ev.id);
        if (existing && ev.manager && !existing.managers.includes(ev.manager)) existing.managers.push(ev.manager);
      }
    });
    pushedCalEvents.sort((a,b)=>b.pushedAt?.localeCompare(a.pushedAt||'')||0);
  } catch(e) { console.warn('loadAllCalendarEvents failed:', e); }
  renderCalHistory();
}

async function loadWeeklyReviews() {
  try {
    const res = await api({action:'getAllWeeklyReviews'});
    allWeeklyReviews = res.reviews||[];
    populateReviewFilters();
    renderReviews();
  } catch(e) {}
}

async function loadReviewEmails() {
  try {
    const res = await api({action:'getReviewEmails'});
    if (res.emails) document.getElementById('review-emails').value = res.emails;
  } catch(e) {}
}

async function saveReviewEmails() {
  const emails = document.getElementById('review-emails').value.trim();
  const status = document.getElementById('review-emails-status');
  try {
    await api({action:'saveReviewEmails', emails});
    status.textContent = '✓ Saved';
    showToast('Email list saved ✓','success');
    setTimeout(()=>status.textContent='',3000);
  } catch(e) { showToast('Failed to save emails','error'); }
}

// ── Week nav ───────────────────────────────────────────
function updateWeekNav() {
  const idx=allWeeks.indexOf(viewWeekKey);
  document.getElementById('prev-week').disabled=idx<=0;
  document.getElementById('next-week').disabled=idx>=allWeeks.length-1;
  const isNow=viewWeekKey===currentWeek;
  document.getElementById('week-display').innerHTML=
    formatWeek(viewWeekKey)+(isNow?' <span class="now-badge">NOW</span>':'');
}
function changeWeek(dir) {
  const idx=allWeeks.indexOf(viewWeekKey), ni=idx+dir;
  if (ni>=0&&ni<allWeeks.length) { viewWeekKey=allWeeks[ni]; renderOverview(); }
}

// ── Submission history chart ─────────────────────────────
let _chartResizeObserver = null;

function renderSubmissionChart() {
  const svg = document.getElementById('submission-chart');
  const card = document.getElementById('chart-card');
  if (!svg || !managers.length) return;
  const weeks = allWeeks.slice(-12);
  if (weeks.length < 2) { if(card) card.style.display='none'; return; }
  if(card) card.style.display='block';
  const total = managers.length;
  const data = weeks.map(w => {
    const submitted = new Set(allSubs.filter(s=>s.week===w).map(s=>s.manager)).size;
    return { week: w, pct: total ? Math.round((submitted/total)*100) : 0, submitted, total };
  });
  const gap = 4, h = 60, pad = 20;
  const containerW = svg.parentElement ? svg.parentElement.clientWidth || 600 : 600;
  const availW = Math.max(100, containerW - pad * 2);
  const barW = Math.max(8, Math.floor((availW - gap * (weeks.length - 1)) / weeks.length));
  const svgW = pad * 2 + barW * weeks.length + gap * (weeks.length - 1);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${h + 16}`);
  svg.innerHTML = data.map((d, i) => {
    const x = pad + i * (barW + gap);
    const barH = Math.max(3, Math.round((d.pct / 100) * h));
    const y = h - barH;
    const isNow = d.week === currentWeek;
    const fill = isNow ? 'var(--accent)' : d.pct===100 ? 'var(--success)' : d.pct===0 ? 'var(--border2)' : 'var(--accent-soft)';
    const stroke = isNow ? 'var(--accent-dark)' : d.pct===100 ? 'var(--success)' : 'var(--border)';
    const label = d.week ? d.week.slice(5) : '';
    return `<g>
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1">
        <title>${d.week}: ${d.submitted}/${d.total} submitted (${d.pct}%)</title>
      </rect>
      <text x="${x + barW / 2}" y="${h + 12}" text-anchor="middle" font-size="8" fill="var(--muted)" font-family="var(--font)">${label}</text>
    </g>`;
  }).join('');

  if (!_chartResizeObserver && svg.parentElement) {
    _chartResizeObserver = new ResizeObserver(() => renderSubmissionChart());
    _chartResizeObserver.observe(svg.parentElement);
  }
}

// ── Overview ───────────────────────────────────────────
function posClass(pos) {
  if (!pos) return '';
  const k=pos.replace(/[^a-zA-Z]/g,'');
  return 'pos-'+k.charAt(0).toUpperCase()+k.slice(1);
}

function renderOverview() {
  updateWeekNav();
  const ws=allSubs.filter(s=>s.week===viewWeekKey);
  const submittedSet=new Set(ws.map(s=>s.manager));
  const rosterActive=allRoster.filter(r=>!r.leaver);
  const rosterLeavers=allRoster.filter(r=>r.leaver);
  const everyName=new Set([
    ...allPeople.map(p=>p.name.toLowerCase()),
    ...allRoster.map(r=>r.name.toLowerCase())
  ]);
  document.getElementById('s-submitted').textContent=`${submittedSet.size}/${managers.length||'—'}`;
  document.getElementById('s-headcount').textContent=rosterActive.length||ws.filter(s=>!s.leaver).length;
  document.getElementById('s-ever').textContent=everyName.size;
  document.getElementById('s-leavers').textContent=rosterLeavers.length||ws.filter(s=>s.leaver).length;
  // Submission status panel
  const statusPanel = document.getElementById('submit-status-panel');
  if (statusPanel && managers.length) {
    const submitted = managers.filter(m => submittedSet.has(m));
    const missing = managers.filter(m => !submittedSet.has(m));
    statusPanel.style.display = 'flex';
    statusPanel.innerHTML =
      '<span class="submit-status-lbl">This week</span>' +
      submitted.map(m => `<span class="submit-pill submit-pill-done">✓ ${esc(m.charAt(0).toUpperCase()+m.slice(1))}</span>`).join('') +
      missing.map(m => `<span class="submit-pill submit-pill-missing">✗ ${esc(m.charAt(0).toUpperCase()+m.slice(1))}</span>`).join('');
  }

  renderSubmissionChart();
  if (!managers.length) { showEmpty(); return; }
  document.getElementById('teams-grid').innerHTML = managers.map(m=>{
    const dn=m.charAt(0).toUpperCase()+m.slice(1);
    const url=`${MGR_BASE}?name=${encodeURIComponent(m)}`;
    const rosterReps=allRoster.filter(r=>r.manager===m);
    const weekSubs=ws.filter(s=>s.manager===m);
    const useRoster=rosterReps.length>0;
    const reps = useRoster ? rosterReps : weekSubs.map(s=>({...s,leaver:s.leaver}));
    const activeReps=reps.filter(r=>!r.leaver);
    const leaverReps=reps.filter(r=>r.leaver);
    const hasData=reps.length>0;
    const hasWeekSub=weekSubs.length>0;
    const picSrc = allProfilePics[m];
    const avatarHtml = picSrc
      ? `<img class="mgr-avatar" src="${picSrc}" alt="${esc(dn)}" />`
      : `<div class="mgr-avatar-init">${dn.charAt(0)}</div>`;
    const memberHtml = hasData
      ? [...activeReps,...leaverReps].map(r=>`
          <div class="mem-row">
            <div class="mem-left">
              <span class="mem-name" style="${r.leaver?'text-decoration:line-through;color:var(--muted);':''}">${esc(r.name)}</span>
              ${r.email?`<span class="mem-email">${esc(r.email)}</span>`:''}
            </div>
            <div class="mem-right">
              ${r.position?`<span class="pos-tag ${posClass(r.position)}">${esc(r.position)}</span>`:''}
              ${r.leaver?'<span class="leaver-tag">Leaver</span>':''}
            </div>
          </div>`).join('')
      : `<div style="padding:12px 0;color:var(--muted);font-size:13px;">No data yet.</div>`;
    const metaText = hasData
      ? `${activeReps.length} active${leaverReps.length?' · '+leaverReps.length+' leaver'+(leaverReps.length>1?'s':''):''}${hasWeekSub?' · ✓ submitted':' · not submitted this week'}`
      : 'no data yet';
    return `<div class="team-card ${hasData?'':'no-sub'}">
      <div class="card-head">
        <div class="card-head-left">
          ${avatarHtml}
          <div>
            <div class="mgr-name">${esc(dn)}</div>
            <div class="mgr-meta">${metaText}</div>
          </div>
        </div>
        <a class="open-link" href="${url}" target="_blank">open ↗</a>
      </div>
      <div class="card-members">${memberHtml}</div>
    </div>`;
  }).join('');
}

// ── People ─────────────────────────────────────────────
function renderPeople() {
  const thisWeek=new Set(allSubs.filter(s=>s.week===currentWeek&&!s.leaver).map(s=>s.name.toLowerCase()));
  const seen=new Map();
  allRoster.forEach(r=>{
    seen.set(r.name.toLowerCase()+r.manager, {
      name:r.name, email:r.email||'', manager:r.manager,
      position:r.position||'—', firstSeen:r.addedOn||'',
      active:!r.leaver&&thisWeek.has(r.name.toLowerCase()),
      leaver:r.leaver
    });
  });
  allPeople.forEach(p=>{
    const k=p.name.toLowerCase()+p.manager;
    if(!seen.has(k)){
      seen.set(k,{
        name:p.name, email:p.email||'', manager:p.manager,
        position:'—', firstSeen:p.firstSeen,
        active:thisWeek.has(p.name.toLowerCase()), leaver:false
      });
    }
  });
  window._peopleRows=[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  renderPeopleTable(window._peopleRows);
}

function renderPeopleTable(rows) {
  const tbody=document.getElementById('people-tbody');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;">No people tracked yet.</td></tr>'; return; }
  tbody.innerHTML=rows.map(r=>`
    <tr>
      <td style="font-weight:500;">${esc(r.name)}</td>
      <td style="color:var(--muted);font-size:12px;">${r.email?`<a href="mailto:${esc(r.email)}" style="color:var(--accent);text-decoration:none;">${esc(r.email)}</a>`:'—'}</td>
      <td style="text-transform:capitalize;color:var(--muted);">${esc(r.manager)}</td>
      <td>${r.position!=='—'?`<span class="pos-tag ${posClass(r.position)}">${esc(r.position)}</span>`:'<span style="color:var(--muted);">—</span>'}</td>
      <td style="font-size:12px;color:var(--muted);font-family:monospace;">${r.firstSeen}</td>
      <td><span class="badge ${r.active?'badge-active':'badge-leaver'}">${r.active?'Active':'Leaver'}</span></td>
      <td><button class="edit-btn" data-name="${esc(r.name)}" data-email="${esc(r.email||'')}" data-manager="${esc(r.manager)}" data-position="${esc(r.position==='—'?'':r.position)}" data-leaver="${r.leaver?'1':'0'}" onclick="openPersonEdit(this)" style="font-size:11px;padding:3px 9px;">Edit</button></td>
    </tr>`).join('');
}

function filterPeople() {
  const q=document.getElementById('people-search').value.toLowerCase();
  if (!window._peopleRows) return;
  renderPeopleTable(q?window._peopleRows.filter(r=>
    r.name.toLowerCase().includes(q)||r.manager.toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q)
  ):window._peopleRows);
}

function renderLinks() {
  const list=document.getElementById('link-list');
  if (!managers.length) { list.innerHTML='<div style="color:var(--muted);font-size:13px;">No managers added yet.</div>'; return; }
  list.innerHTML=managers.map(m=>{
    const url=`${MGR_BASE}?name=${encodeURIComponent(m)}`;
    const dn=m.charAt(0).toUpperCase()+m.slice(1);
    const hasPassword = managerPasswordStatus[m] === true;
    const picSrc = allProfilePics[m];
    const picHtml = picSrc
      ? `<img src="${picSrc}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;border:2px solid var(--border);flex-shrink:0;" />`
      : `<div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,var(--accent-dark),var(--accent));display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;">${dn.charAt(0)}</div>`;
    const noPwBadge = !hasPassword
      ? `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--warning-soft);border:1px solid rgba(217,119,6,.3);color:var(--warning);font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;margin-bottom:4px;">${_SVG_WARN} No password set — manager cannot log in</div>`
      : '';
    return `<div style="background:var(--surface2);border:1px solid ${!hasPassword?'rgba(217,119,6,.4)':'var(--border)'};border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${picHtml}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <div style="font-weight:600;font-size:14px;text-transform:capitalize;">${esc(dn)}</div>
            ${hasPassword ? '<span style="font-size:10px;font-weight:700;color:var(--success);background:var(--success-soft);border:1px solid rgba(5,150,105,.25);padding:2px 7px;border-radius:10px;">✓ Password set</span>' : ''}
          </div>
          ${noPwBadge}
          <input type="text" value="${esc(url)}" readonly onclick="this.select()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:monospace;font-size:11px;padding:5px 9px;border-radius:6px;outline:none;width:100%;" />
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="copy-btn" onclick="copyLink('${esc(url)}',this)">Copy</button>
          <a class="open-btn" href="${esc(url)}" target="_blank">Open ↗</a>
          <button class="del-btn" onclick="removeManager('${esc(m)}')">×</button>
        </div>
      </div>
      <!-- Profile pic upload -->
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Profile picture</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="cursor:pointer;background:var(--surface);border:1px dashed var(--border2);color:var(--muted);font-size:12px;font-weight:500;padding:7px 14px;border-radius:var(--radius-sm);transition:all .15s;display:inline-flex;align-items:center;gap:6px;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted)'">
            ${_SVG_CAM} Upload photo
            <input type="file" accept="image/*" onchange="uploadProfilePic('${esc(m)}',this)" style="display:none;" />
          </label>
          ${picSrc?`<button onclick="removeProfilePic('${esc(m)}')" style="background:none;border:1px solid var(--border2);color:var(--muted);font-size:12px;padding:7px 12px;border-radius:var(--radius-sm);cursor:pointer;font-family:var(--font);" onmouseover="this.style.color='var(--danger)';this.style.borderColor='var(--danger)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--border2)'">Remove</button>`:''}
        </div>
      </div>
      <!-- Password -->
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;">Password</label>
        <input type="text" id="pw-${m}" value="" placeholder="Set a password…" style="flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:13px;padding:7px 11px;border-radius:8px;outline:none;" />
        <button onclick="setPassword('${esc(m)}')" style="background:var(--accent);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:500;padding:7px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;">Save</button>
      </div>
    </div>`;
  }).join('');
}

async function uploadProfilePic(manager, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { showToast('Image too large — max 2MB','error'); return; }
  showToast('Uploading to Drive…','success',8000);
  const reader = new FileReader();
  reader.onload = async (e) => {
    const picData = e.target.result; // base64 — Apps Script saves to Drive and returns URL
    try {
      const res = await api({action:'saveProfilePic', manager, picData});
      if (res.picUrl) {
        allProfilePics[manager] = res.picUrl; // store Drive URL locally
      }
      renderLinks();
      renderOverview();
      showToast(`Profile picture updated for ${manager} ✓`,'success');
    } catch(err) { showToast('Failed to save picture','error'); }
  };
  reader.readAsDataURL(file);
}

async function removeProfilePic(manager) {
  try {
    await api({action:'saveProfilePic', manager, picData:''});
    delete allProfilePics[manager];
    renderLinks();
    renderOverview();
    showToast('Picture removed ✓','success');
  } catch(e) { showToast('Failed to remove picture','error'); }
}

async function addManager() {
  const input=document.getElementById('new-mgr');
  const raw=input.value.trim(); if (!raw) return;
  const name=raw.toLowerCase().replace(/[^a-z0-9_-]/g,'');
  if (!name) { showToast('Use letters/numbers/hyphens only','error'); return; }
  if (managers.includes(name)) { showToast('Already added','error'); return; }
  if (!scriptUrl) { showToast('Save script URL first','error'); return; }
  managers.push(name); renderLinks(); input.value='';
  try { await api({action:'addManager',name}); } catch(e) { showToast('Added locally but sheet sync failed','error'); }
}

async function removeManager(name) {
  if (!confirm(`Remove ${name}? Historical data stays in the sheet.`)) return;
  managers=managers.filter(m=>m!==name); renderLinks();
  try { await api({action:'removeManager',name}); } catch(e){}
}

function saveScriptUrl() {
  const v=document.getElementById('script-url-input').value.trim();
  if (!v) { showToast('Enter a URL first','error'); return; }
  scriptUrl=v; localStorage.setItem('teamtracker_script_url',v);
  document.getElementById('url-status').textContent='✓ Saved — loading data…';
  loadAll();
}

function savePayIndexUrl() {
  const v=document.getElementById('pay-index-url-input').value.trim();
  if (!v) { showToast('Enter a URL first','error'); return; }
  const statusEl=document.getElementById('pay-index-url-status');
  statusEl.textContent='Saving…';
  api({ action:'savePayIndexUrl', url:v })
    .then(()=>{
      localStorage.setItem('tt_pay_index_url',v); // keep local copy as fallback
      statusEl.textContent='✓ Saved to sheet — all managers will load this automatically.';
      showToast('Pay index URL saved ✓','success');
    })
    .catch(()=>{
      localStorage.setItem('tt_pay_index_url',v); // at least save locally
      statusEl.innerHTML=_SVG_WARN+' Saved locally only — sheet save failed. Check script URL.';
      showToast('Saved locally only','error');
    });
}

function copyScript(btn) {
  navigator.clipboard.writeText(APPS_SCRIPT).then(()=>{ btn.textContent='Copied ✓'; btn.style.color='var(--success)'; setTimeout(()=>{ btn.textContent='Copy'; btn.style.color=''; },2000); });
}
function copyLink(url,btn) {
  navigator.clipboard.writeText(url).then(()=>{ const o=btn.textContent; btn.textContent='✓'; btn.style.color='var(--success)'; setTimeout(()=>{ btn.textContent=o; btn.style.color=''; },2000); });
}

// ── Tabs ───────────────────────────────────────────────
function switchTab(tab) {
  const tabNames = ['overview','people','upload','calendar','reviews','notifications','planner','clients','mgrprofiles','setup','audit'];
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', tabNames[i] === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

  if (tab === 'upload') {
    if (!_tabLoaded.has('upload')) {
      _showTabSpinner('ul-history');
      _loadReportsData().then(() => { renderUploadHistory(); renderManagerCheckboxes(); updateCampaignSuggestions(); });
    } else {
      renderUploadHistory(); renderManagerCheckboxes();
    }
  }

  if (tab === 'calendar') {
    if (!_tabLoaded.has('calendar')) {
      _showTabSpinner('cal-history');
      _loadCalendarData().then(() => { renderCalManagerCheckboxes(); renderCalHistory(); });
    } else {
      renderCalManagerCheckboxes(); renderCalHistory();
    }
  }

  if (tab === 'reviews') {
    if (!_tabLoaded.has('reviews')) {
      _showTabSpinner('reviews-list');
      _loadReviewsData().then(() => { populateReviewFilters(); _preselectReviewWeek(); renderReviews(); });
    } else {
      populateReviewFilters(); _preselectReviewWeek(); renderReviews();
    }
  }

  if (tab === 'notifications') {
    renderNotifManagerCheckboxes(); refreshLiveNotifs(); loadNotifTemplates();
  }

  if (tab === 'planner') {
    if (!_tabLoaded.has('planner')) {
      _loadPlannerData().then(() => pgRender());
    } else {
      pgRender();
    }
  }

  if (tab === 'clients') { clLoadClients(); }
  if (tab === 'mgrprofiles') { mgrProfilesLoad(); }

  if (tab === 'audit') { loadAuditLog(); }

  // Lazy-populate the Apps Script source — only when Setup tab is opened
  if (tab === 'setup') {
    const pre = document.getElementById('apps-script-pre');
    if (pre && !pre._populated) {
      pre.textContent = APPS_SCRIPT;
      pre._populated = true;
    }
    const lbl = document.getElementById('apps-script-version-lbl');
    if (lbl && !lbl._populated) {
      lbl.textContent = `v${APPS_SCRIPT_VERSION} — copy and redeploy whenever this changes`;
      lbl._populated = true;
    }
  }

  if (tab === 'people') {
    const lbl = document.querySelector('#tab-people .sec-lbl');
    if (lbl && viewWeekKey !== currentWeek) lbl.textContent = 'All people ever tracked (viewing w/c ' + formatWeek(viewWeekKey) + ')';
    else if (lbl) lbl.textContent = 'All people ever tracked';
  }
}

function _preselectReviewWeek() {
  const wkSel = document.getElementById('review-filter-week');
  if (wkSel && viewWeekKey && viewWeekKey !== currentWeek) {
    const opt = Array.from(wkSel.options).find(o => o.value === viewWeekKey);
    if (opt) wkSel.value = viewWeekKey;
  }
}

function _showTabSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
}

async function loadAuditLog() {
  const el = document.getElementById('audit-log-list');
  if (!el || !scriptUrl) return;
  el.innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
  try {
    const res = await api({action:'getAuditLog'});
    const entries = res.entries || [];
    if (!entries.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;">No audit entries yet.</div>'; return; }
    el.innerHTML = entries.map(function(e) {
      const ts = e.timestamp ? new Date(e.timestamp).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      const actionColour = {
        addManager:'var(--success)', removeManager:'var(--danger)', setPassword:'var(--warning)',
        saveReport:'var(--accent)', deleteReport:'var(--danger)', sendNotification:'var(--accent)',
      }[e.action] || 'var(--muted)';
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:12px;">' +
        '<span style="font-size:10px;font-weight:700;color:' + actionColour + ';background:var(--surface2);padding:2px 7px;border-radius:20px;white-space:nowrap;min-width:100px;text-align:center;">' + esc(e.action) + '</span>' +
        '<span style="color:var(--muted);white-space:nowrap;font-family:monospace;font-size:11px;">' + ts + '</span>' +
        '<span style="flex:1;color:var(--text);">' + esc(e.detail) + '</span>' +
        '</div>';
    }).join('');
  } catch(err) { el.innerHTML = '<div style="color:var(--danger);font-size:13px;">Failed to load audit log.</div>'; }
}

function showEmpty() {
  document.getElementById('teams-grid').innerHTML='<div class="no-data" style="grid-column:1/-1"><strong>No data yet</strong>Go to the <strong>Setup</strong> tab to connect Google Sheets and add manager links.</div>';
  ['s-submitted','s-headcount','s-ever','s-leavers'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('week-display').textContent=`w/c ${formatWeek(currentWeek)}`;
  document.getElementById('prev-week').disabled=true;
  document.getElementById('next-week').disabled=true;
}

async function api(payload) {
  // Attach admin token to every request so Apps Script can validate it
  const body = JSON.stringify({ ...payload, token: adminToken });
  const res = await fetch(scriptUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
  try { return JSON.parse(text); } catch(e) { throw new Error('Apps Script did not return JSON: ' + text.slice(0, 200)); }
}

// ── Upload reports ────────────────────────────────────
let allUploadedReports = [];

function getUploadWeekKey() {
  const val = document.getElementById('ul-week').value;
  if (!val) return null;
  // Use the exact date selected — admin picks the Monday themselves
  return val;
}

function handleTypeChange() {
  const type = document.getElementById('ul-type').value;
  const wrap = document.getElementById('ul-campaign-wrap');
  const payFields = document.getElementById('ul-pay-fields');
  wrap.style.display = (type === 'Pay Report') ? 'none' : '';
  payFields.style.display = (type === 'Pay Report') ? '' : 'none';
}

function renderManagerCheckboxes() {
  const wrap = document.getElementById('ul-manager-checkboxes');
  if (!managers.length) { wrap.innerHTML = '<div style="color:var(--muted);font-size:13px;">No managers added yet — add them in Setup first.</div>'; return; }
  wrap.innerHTML = managers.map(m => {
    const dn = m.charAt(0).toUpperCase() + m.slice(1);
    return `<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--surface2);border:1px solid var(--border);padding:5px 12px;border-radius:20px;">
      <input type="checkbox" id="ulm-${m}" value="${esc(m)}" style="cursor:pointer;accent-color:var(--accent);" /> ${esc(dn)}
    </label>`;
  }).join('');
}

function getCheckedManagers() {
  return managers.filter(m => { const cb = document.getElementById(`ulm-${m}`); return cb && cb.checked; });
}

async function uploadReport() {
  const type = document.getElementById('ul-type').value;
  const url = document.getElementById('ul-url').value.trim();
  const campaign = document.getElementById('ul-campaign').value.trim();
  const weekVal = document.getElementById('ul-week').value;
  const selectedMgrs = getCheckedManagers();
  const officeWire = type === 'Pay Report' ? document.getElementById('ul-office-wire').value.trim() : '';
  const mgrTake = type === 'Pay Report' ? document.getElementById('ul-mgr-take').value.trim() : '';
  if (!url) { showToast('Paste a URL first', 'error'); return; }
  if (!weekVal) { showToast('Select a week', 'error'); return; }
  if (!selectedMgrs.length) { showToast('Select at least one manager', 'error'); return; }
  if (type !== 'Pay Report' && !campaign) { showToast('Add a campaign/label', 'error'); return; }
  const weekKey = getUploadWeekKey();
  const id = 'rep' + Date.now();
  const status = document.getElementById('ul-status');
  status.textContent = 'Saving…';
  try {
    await api({ action: 'saveReport', report: { id, type, url, campaign, week: weekKey, managers: selectedMgrs, uploadedAt: new Date().toISOString(), officeWire: officeWire || '', mgrTake: mgrTake || '' } });
    status.textContent = '✓ Saved';
    showToast('Report uploaded ✓', 'success');
    document.getElementById('ul-url').value = '';
    document.getElementById('ul-campaign').value = '';
    document.getElementById('ul-office-wire').value = '';
    document.getElementById('ul-mgr-take').value = '';
    managers.forEach(m => { const cb = document.getElementById(`ulm-${m}`); if (cb) cb.checked = false; });
    await loadUploadHistory();
    renderUploadHistory();
    updateCampaignSuggestions();
    setTimeout(() => status.textContent = '', 3000);
  } catch(e) { status.textContent = 'Save failed'; showToast('Upload failed', 'error'); }
}

async function loadUploadHistory() {
  if (!scriptUrl) return;
  try { const res = await api({ action: 'getAllReports' }); allUploadedReports = res.reports || []; } catch(e) {}
}

function renderUploadHistory() {
  const el = document.getElementById('ul-history');
  if (!allUploadedReports.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;">No reports uploaded yet.</div>'; return; }
  const sorted = [...allUploadedReports].sort((a,b) => b.week.localeCompare(a.week));
  el.innerHTML = sorted.map(r => {
    const mgrList = (r.managers||[]).map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(', ');
    const payMeta = r.type === 'Pay Report' && (r.officeWire || r.mgrTake)
      ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;display:flex;align-items:center;gap:4px;">${_SVG_POUND} Wire: £${r.officeWire||'—'} &nbsp;·&nbsp; Take: £${r.mgrTake||'—'}</div>` : '';
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent-border);padding:3px 8px;border-radius:20px;white-space:nowrap;">${esc(r.type)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;">${r.campaign?esc(r.campaign)+' — ':''}${fmtReportDate(r.week)}</div>
        <div style="font-size:11px;color:var(--muted);">→ ${esc(mgrList)}</div>
        ${payMeta}
      </div>
      <a href="${esc(r.url)}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;white-space:nowrap;">View ↗</a>
      <button onclick="deleteReport('${r.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;transition:color .15s;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--muted)'">×</button>
    </div>`;
  }).join('');
}

async function deleteReport(id) {
  if (!confirm('Remove this report?')) return;
  try { await api({ action: 'deleteReport', id }); await loadUploadHistory(); renderUploadHistory(); showToast('Removed', 'success'); } catch(e) { showToast('Failed to remove', 'error'); }
}

function updateCampaignSuggestions() {
  const campaigns = [...new Set(allUploadedReports.filter(r=>r.campaign).map(r=>r.campaign))];
  const dl = document.getElementById('campaign-suggestions');
  if (dl) dl.innerHTML = campaigns.map(c=>`<option value="${esc(c)}">`).join('');
}

// ── Calendar ──────────────────────────────────────────
let calHistoryFilter = 'all';

function toggleRecurrence() {
  const cb = document.getElementById('cal-recurring');
  const opts = document.getElementById('recurrence-options');
  opts.style.display = cb.checked ? 'grid' : 'none';
}

function renderCalManagerCheckboxes() {
  const wrap = document.getElementById('cal-manager-checkboxes');
  if (!wrap) return;
  if (!managers.length) { wrap.innerHTML = '<div style="color:var(--muted);font-size:13px;">No managers added yet — add them in Setup first.</div>'; return; }
  wrap.innerHTML = managers.map(m => {
    const dn = m.charAt(0).toUpperCase() + m.slice(1);
    return `<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--surface2);border:1px solid var(--border);padding:5px 12px;border-radius:20px;">
      <input type="checkbox" id="calm-${m}" value="${esc(m)}" style="cursor:pointer;accent-color:var(--accent);" /> ${esc(dn)}
    </label>`;
  }).join('');
}

function calSelectAll() {
  managers.forEach(m => { const cb = document.getElementById(`calm-${m}`); if (cb) cb.checked = true; });
}
function calSelectNone() {
  managers.forEach(m => { const cb = document.getElementById(`calm-${m}`); if (cb) cb.checked = false; });
}
function getCalCheckedManagers() {
  return managers.filter(m => { const cb = document.getElementById(`calm-${m}`); return cb && cb.checked; });
}

function generateRecurringDates(startDate, freq, count) {
  const dates = [];
  const d = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().split('T')[0]);
    if (freq === 'weekly') d.setDate(d.getDate()+7);
    else if (freq === 'biweekly') d.setDate(d.getDate()+14);
    else if (freq === 'monthly') d.setMonth(d.getMonth()+1);
  }
  return dates;
}

async function pushCalendarEvent() {
  const title = document.getElementById('cal-title').value.trim();
  const date = document.getElementById('cal-date').value;
  const time = document.getElementById('cal-time').value;
  const notes = document.getElementById('cal-notes').value.trim();
  const reminder = document.getElementById('cal-reminder').value.trim();
  const category = getSelectedCalColour();
  const isRecurring = document.getElementById('cal-recurring').checked;
  const selectedMgrs = getCalCheckedManagers();
  const status = document.getElementById('cal-status');

  if (!title) { showToast('Add an event title', 'error'); return; }
  if (!date) { showToast('Pick a date', 'error'); return; }
  if (!selectedMgrs.length) { showToast('Select at least one manager', 'error'); return; }

  const freq = document.getElementById('cal-recur-freq').value;
  const count = isRecurring ? Math.max(1, parseInt(document.getElementById('cal-recur-count').value)||10) : 1;
  const dates = isRecurring ? generateRecurringDates(date, freq, count) : [date];

  const baseTs = Date.now();
  const groupId = isRecurring ? 'rg'+baseTs : null;
  const newEvents = dates.map((d,i) => ({
    id: 'ev'+baseTs+'_'+i,
    title, date:d, time:time||'', notes:notes||'', reminder:reminder||'', category:category||'personal',
    pushedAt: new Date().toISOString(),
    recurring: isRecurring,
    recurringGroupId: groupId,
    recurringFreq: isRecurring ? freq : null
  }));

  status.textContent = `Pushing to ${selectedMgrs.length} manager${selectedMgrs.length!==1?'s':''}…`;
  // Push sequentially per manager to avoid Apps Script concurrency/lock errors
  const errors = [];
  let successCount = 0;
  for (const mgr of selectedMgrs) {
    let mgrOk = true;
    for (const ev of newEvents) {
      try {
        const res = await api({ action: 'saveCalEvent', manager: mgr, event: { ...ev, manager: mgr } });
        if (!res || res.ok === false) { mgrOk = false; break; }
      } catch(e) { mgrOk = false; break; }
    }
    if (mgrOk) successCount++;
    else errors.push(mgr);
  }

  if (errors.length === 0) {
    status.textContent = `✓ Pushed to ${successCount} manager${successCount!==1?'s':''}`;
    showToast(`Event${isRecurring?' series':''} pushed to ${successCount} manager${successCount!==1?'s':''} ✓`, 'success');
    newEvents.forEach(ev => pushedCalEvents.unshift({ ...ev, managers: selectedMgrs }));
    renderCalHistory();

    // Send a notification to each manager so they see it immediately
    const notifTitle = 'New calendar event';
    const dateLabel = new Date(newEvents[0].date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const notifMsg = isRecurring
      ? `A new recurring event has been added to your calendar: "${title}" — starting ${dateLabel}.`
      : `"${title}" has been added to your calendar on ${dateLabel}${time?' at '+time:''}.`;
    selectedMgrs.forEach(mgr => {
      api({ action: 'saveNotification', notification: {
        id: 'caln_' + Date.now() + '_' + mgr,
        manager: mgr,
        title: notifTitle,
        message: notifMsg,
        sentAt: new Date().toISOString()
      }}).catch(()=>{});
    });
    document.getElementById('cal-title').value = '';
    document.getElementById('cal-time').value = '';
    document.getElementById('cal-notes').value = '';
    document.getElementById('cal-reminder').value = '';
    document.querySelectorAll('#cal-colour-picker .cal-swatch').forEach(s => s.classList.toggle('selected', s.dataset.cat==='personal'));
    document.getElementById('cal-recurring').checked = false;
    document.getElementById('recurrence-options').style.display = 'none';
    calSelectNone();
    setTimeout(() => status.textContent = '', 4000);
  } else {
    status.textContent = `Pushed to ${successCount}, failed for: ${errors.join(', ')}`;
    showToast(`Some pushes failed: ${errors.join(', ')}`, 'error', 5000);
  }
}

function filterCalHistory(filter) {
  calHistoryFilter = filter;
  ['all','recurring','once'].forEach(f => {
    const btn = document.getElementById(`cal-filter-${f}`);
    if (btn) {
      btn.style.background = f===filter ? 'var(--accent)' : 'none';
      btn.style.color = f===filter ? '#fff' : 'var(--muted)';
      btn.style.border = f===filter ? 'none' : '1px solid var(--border2)';
    }
  });
  renderCalHistory();
}

function renderCalHistory() {
  const el = document.getElementById('cal-history');
  if (!el) return;
  let events = [...pushedCalEvents];
  if (calHistoryFilter === 'recurring') events = events.filter(e=>e.recurring);
  if (calHistoryFilter === 'once') events = events.filter(e=>!e.recurring);
  if (!events.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;">No events pushed yet.</div>'; return; }
  // Group recurring events
  const seen = new Set();
  el.innerHTML = events.map(e => {
    const mgrList = (e.managers || []).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
    const dateStr = e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const recurringBadge = e.recurring ? `<span class="recur-tag">↻ ${e.recurringFreq||'recurring'}</span>` : '';
    return `<div class="event-item">
      <div class="event-item-body">
        <div class="event-item-title">${esc(e.title)}${e.time?' · '+esc(e.time):''}${recurringBadge}</div>
        <div class="event-item-meta">${dateStr}${e.notes?' — '+esc(e.notes):''}</div>
        <div style="font-size:11px;color:var(--accent);margin-top:3px;">→ ${esc(mgrList)}</div>
      </div>
      <div class="event-item-actions">
        <button class="edit-btn" data-id="${esc(e.id)}" data-title="${esc(e.title)}" data-date="${esc(e.date)}" data-time="${esc(e.time||'')}" data-notes="${esc(e.notes||'')}" onclick="openEditModalFromBtn(this)">Edit</button>
        <button class="edit-btn" onclick="deleteCalEvent('${esc(e.id)}')" style="color:var(--danger);border-color:var(--danger);" onmouseover="this.style.background='var(--danger-soft)'" onmouseout="this.style.background='none'">Remove</button>
      </div>
    </div>`;
  }).join('');
}

// Edit event modal
let _editingEventId = null;
function openPersonEdit(btn) {
  const d = btn.dataset;
  document.getElementById('ep-name').value = d.name;
  document.getElementById('ep-email').value = d.email;
  document.getElementById('ep-position').value = d.position;
  document.getElementById('ep-leaver').checked = d.leaver === '1';
  // Populate manager select
  const sel = document.getElementById('ep-manager');
  sel.innerHTML = managers.map(m => `<option value="${esc(m)}" ${m===d.manager?'selected':''}>${esc(m.charAt(0).toUpperCase()+m.slice(1))}</option>`).join('');
  // Store original for lookup
  sel.dataset.origManager = d.manager;
  sel.dataset.origName = d.name;
  document.getElementById('edit-person-modal').classList.add('open');
}
function closePersonEdit() {
  document.getElementById('edit-person-modal').classList.remove('open');
}
document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('edit-person-modal');
  if (m) m.addEventListener('click', e => { if (e.target === m) closePersonEdit(); });
});
async function savePersonEdit() {
  const name = document.getElementById('ep-name').value.trim();
  const email = document.getElementById('ep-email').value.trim();
  const manager = document.getElementById('ep-manager').value;
  const position = document.getElementById('ep-position').value;
  const leaver = document.getElementById('ep-leaver').checked;
  const origManager = document.getElementById('ep-manager').dataset.origManager;
  const origName = document.getElementById('ep-manager').dataset.origName;
  if (!name) { showToast('Name is required', 'error'); return; }
  // Find the roster entry and update it
  const rep = allRoster.find(r => r.name.toLowerCase()===origName.toLowerCase() && r.manager===origManager);
  if (!rep) { showToast('Person not found in roster — they may only be in submission history', 'error'); return; }
  rep.name = name; rep.email = email; rep.position = position; rep.leaver = leaver; rep.manager = manager;
  try {
    // If manager changed: mark as leaver under old manager FIRST, then save under new manager.
    // Doing it in this order means the old roster slot is closed before the new one opens,
    // preventing duplicate rows if the API call partially fails.
    if (manager !== origManager) {
      const oldRep = {...rep, manager: origManager, leaver: true};
      await api({action:'saveRep', manager: origManager, rep: oldRep});
    }
    await api({action:'saveRep', manager, rep});
    allRoster = allRoster.map(r => (r.name.toLowerCase()===origName.toLowerCase()&&r.manager===origManager) ? rep : r);
    renderPeople();
    closePersonEdit();
    showToast('Person updated ✓', 'success');
  } catch(e) { showToast('Failed to save changes', 'error'); }
}

function openEditModalFromBtn(btn) {
  openEditModal(btn.dataset.id, btn.dataset.title, btn.dataset.date, btn.dataset.time, btn.dataset.notes);
}
function openEditModal(id, title, date, time, notes) {
  _editingEventId = id;
  document.getElementById('edit-event-id').value = id;
  document.getElementById('edit-event-title').value = title;
  document.getElementById('edit-event-date').value = date;
  document.getElementById('edit-event-time').value = time;
  document.getElementById('edit-event-notes').value = notes;
  // Show scope selector only for recurring events
  const ev = pushedCalEvents.find(e => e.id === id);
  const scopeWrap = document.getElementById('edit-scope-wrap');
  if (scopeWrap) {
    scopeWrap.style.display = (ev && ev.recurring) ? 'block' : 'none';
    // Reset to single-event edit by default
    const radios = document.querySelectorAll('input[name="edit-scope"]');
    if (radios.length) radios[0].checked = true;
  }
  document.getElementById('edit-event-modal').classList.add('open');
}
function closeEditModal() {
  document.getElementById('edit-event-modal').classList.remove('open');
  _editingEventId = null;
}
document.getElementById('edit-event-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('edit-event-modal')) closeEditModal();
});

async function saveEditedEvent() {
  const id = _editingEventId;
  const newTitle = document.getElementById('edit-event-title').value.trim();
  const newDate = document.getElementById('edit-event-date').value;
  const newTime = document.getElementById('edit-event-time').value;
  const newNotes = document.getElementById('edit-event-notes').value.trim();
  if (!newTitle || !newDate) { showToast('Title and date required','error'); return; }

  const ev = pushedCalEvents.find(e => e.id === id);
  if (!ev) { showToast('Event not found','error'); return; }

  // Determine scope — series edit uses recurringGroupId to update all occurrences
  const scopeRadio = document.querySelector('input[name="edit-scope"]:checked');
  const scope = (scopeRadio && ev.recurring) ? scopeRadio.value : 'one';
  const groupId = (scope === 'series' && ev.recurringGroupId) ? ev.recurringGroupId : null;

  // Update local cache
  if (scope === 'series' && groupId) {
    pushedCalEvents.forEach(e => {
      if (e.recurringGroupId === groupId) { e.title = newTitle; e.notes = newNotes; }
    });
  } else {
    ev.title = newTitle; ev.date = newDate; ev.time = newTime; ev.notes = newNotes;
  }

  try {
    await api({ action: 'updateCalEvent', id, title: newTitle, date: newDate, time: newTime, notes: newNotes, scope, groupId });
  } catch(e) { showToast('Failed to save changes', 'error'); return; }

  closeEditModal();
  renderCalHistory();
  showToast(scope==='series' ? 'All occurrences updated ✓' : 'Event updated ✓', 'success');
}

async function deleteCalEvent(id) {
  if (!confirm('Remove this event from all managers?')) return;
  pushedCalEvents = pushedCalEvents.filter(e => e.id !== id);
  renderCalHistory();
  try {
    await api({ action: 'deleteCalEvent', id });
    showToast('Event removed ✓', 'success');
  } catch(e) { showToast('Failed to remove from sheet', 'error'); }
}

// ── Weekly Reviews ────────────────────────────────────
function populateReviewFilters() {
  const mgrSel = document.getElementById('review-filter-manager');
  const wkSel = document.getElementById('review-filter-week');
  if (!mgrSel || !wkSel) return;

  const mgrVal = mgrSel.value;
  const wkVal = wkSel.value;

  const uniqueMgrs = [...new Set(allWeeklyReviews.map(r=>r.manager))].sort();
  const uniqueWeeks = [...new Set(allWeeklyReviews.map(r=>r.week))].sort().reverse();

  mgrSel.innerHTML = '<option value="">All managers</option>' + uniqueMgrs.map(m=>`<option value="${esc(m)}" ${m===mgrVal?'selected':''}>${esc(m.charAt(0).toUpperCase()+m.slice(1))}</option>`).join('');
  wkSel.innerHTML = '<option value="">All weeks</option>' + uniqueWeeks.map(w=>`<option value="${esc(w)}" ${w===wkVal?'selected':''}>${formatWeek(w)}</option>`).join('');
}

function filterReviews() {
  renderReviews();
}

function renderReviews() {
  const el = document.getElementById('reviews-list');
  if (!el) return;
  const mgrFilter = document.getElementById('review-filter-manager')?.value||'';
  const wkFilter = document.getElementById('review-filter-week')?.value||'';
  let reviews = [...allWeeklyReviews];
  if (mgrFilter) reviews = reviews.filter(r=>r.manager===mgrFilter);
  if (wkFilter) reviews = reviews.filter(r=>r.week===wkFilter);
  reviews.sort((a,b)=>b.week.localeCompare(a.week)||a.manager.localeCompare(b.manager));
  if (!reviews.length) { el.innerHTML='<div style="color:var(--muted);font-size:13px;">No reviews match the current filter.</div>'; return; }
  el.innerHTML = reviews.map(r => {
    const dn = r.manager.charAt(0).toUpperCase()+r.manager.slice(1);
    const d = r.reviewData||{};
    const submittedDate = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '';
    const sections = Object.entries(d).filter(([k])=>k!=='pdfHtml').map(([key,val])=>{
      if (!val || (Array.isArray(val) && !val.length)) return '';
      const lbl = key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
      const content = Array.isArray(val) ? val.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join(', ') : String(val);
      return `<div class="review-section"><div class="review-section-lbl">${esc(lbl)}</div><div style="color:var(--text);">${esc(content)}</div></div>`;
    }).filter(Boolean).join('');
    return `<div class="review-card" id="rev-${esc(r.id)}">
      <div class="review-card-head" onclick="toggleReview('${esc(r.id)}')">
        <div>
          <div class="review-card-title">${esc(dn)} — ${fmtReportDate(r.week)}</div>
          <div class="review-card-meta">Submitted ${submittedDate}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="event.stopPropagation();exportReviewPDF('${esc(r.id)}')" style="background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);font-family:var(--font);font-size:11px;font-weight:600;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;" title="Export as PDF — opens print dialog">⬇ PDF</button>
          <span style="font-size:18px;color:var(--muted);transition:transform .2s;" id="rev-arrow-${esc(r.id)}">›</span>
        </div>
      </div>
      <div class="review-body" id="rev-body-${esc(r.id)}">${sections||'<div style="color:var(--muted);">No data in this review.</div>'}</div>
    </div>`;
  }).join('');
}

function toggleReview(id) {
  const body = document.getElementById(`rev-body-${id}`);
  const arrow = document.getElementById(`rev-arrow-${id}`);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (arrow) arrow.style.transform = open ? 'rotate(90deg)' : '';
}

function exportReviewPDF(id) {
  const r = allWeeklyReviews.find(x=>x.id===id);
  if (!r) { showToast('Review not found','error'); return; }
  const dn = r.manager.charAt(0).toUpperCase()+r.manager.slice(1);
  const d = r.reviewData||{};
  const submittedDate = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';

  // Use pdfHtml if available from the submission, else build from data
  // Strip any script/iframe tags before injecting to prevent XSS
  function sanitiseHtml(h) {
    return String(h||'')
      .replace(/<script[\s\S]*?<\/script>/gi,'')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi,'')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi,'')
      .replace(/javascript\s*:/gi,'');
  }
  let bodyHtml = '';
  if (d.pdfHtml) {
    bodyHtml = sanitiseHtml(d.pdfHtml);
  } else {
    bodyHtml = Object.entries(d).filter(([k])=>k!=='pdfHtml').map(([key,val])=>{
      if (!val || (Array.isArray(val) && !val.length)) return '';
      const lbl = key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
      const content = Array.isArray(val) ? val.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join('<br>') : String(val).replace(/\n/g,'<br>');
      return `<div style="margin-bottom:18px;"><div style="font-size:10px;font-weight:700;color:#666;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;">${lbl}</div><div style="font-size:13px;color:#111;line-height:1.6;">${content}</div></div>`;
    }).filter(Boolean).join('');
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Weekly Review — ${dn}</title>
  <style>body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;margin:40px;color:#111;}
  h1{font-size:22px;font-weight:700;margin-bottom:4px;}
  .meta{font-size:12px;color:#888;margin-bottom:28px;}
  .section{margin-bottom:18px;page-break-inside:avoid;}
  .lbl{font-size:10px;font-weight:700;color:#666;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;}
  .val{font-size:13px;color:#111;line-height:1.6;}
  hr{border:none;border-top:1px solid #e5e5e5;margin:20px 0;}
  </style></head><body>
  <h1>Weekly Review — ${dn}</h1>
  <div class="meta">Week commencing ${fmtReportDate(r.week)} · Submitted ${submittedDate}</div>
  <hr>
  ${bodyHtml}
  </body></html>`;

  // Open in a new window and trigger print-to-PDF (works without extra libs)
  const win = window.open('', '_blank');
  win.document.write(html + '<script>window.onload=function(){window.print();}<\/script>');
  win.document.close();
  showToast('Review opened — use Print → Save as PDF ✓','success');
}

function exportAllReviewsCSV() {
  const mgrFilter = document.getElementById('review-filter-manager')?.value||'';
  const wkFilter = document.getElementById('review-filter-week')?.value||'';
  let reviews = [...allWeeklyReviews];
  if (mgrFilter) reviews = reviews.filter(r=>r.manager===mgrFilter);
  if (wkFilter) reviews = reviews.filter(r=>r.week===wkFilter);
  if (!reviews.length) { showToast('No reviews to export','error'); return; }

  // Get all unique keys
  const allKeys = new Set();
  reviews.forEach(r=>Object.keys(r.reviewData||{}).filter(k=>k!=='pdfHtml').forEach(k=>allKeys.add(k)));
  const keys = [...allKeys];
  const header = ['Manager','Week','SubmittedAt',...keys].map(k=>`"${k}"`).join(',');
  const rows = reviews.map(r=>{
    const d=r.reviewData||{};
    const base=[r.manager,r.week,r.submittedAt||''].map(v=>`"${String(v).replace(/"/g,'""')}"`);
    const vals=keys.map(k=>{const v=d[k];if(!v)return'""';const s=Array.isArray(v)?v.join('; '):String(v);return`"${s.replace(/"/g,'""')}"`});
    return [...base,...vals].join(',');
  });
  const csv=[header,...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`reviews_export_${currentWeek}.csv`;a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${reviews.length} reviews ✓`,'success');
}

async function saveDeadlineSettings() {
  const day = document.getElementById('deadline-day').value;
  const time = document.getElementById('deadline-time').value;
  const msg = document.getElementById('deadline-msg').value.trim();
  const status = document.getElementById('deadline-status');
  try {
    await api({ action: 'saveDeadlineSettings', day, time, msg });
    status.textContent = '✓ Saved & trigger activated';
    setTimeout(() => status.textContent = '', 4000);
    showToast('Deadline settings saved — daily trigger installed ✓', 'success');
    runDeadlineCheck();
  } catch(e) { showToast('Failed to save deadline settings', 'error'); }
}

async function loadDeadlineSettings() {
  // Load from sheet first; fall back to localStorage for backwards compat
  try {
    const res = await api({ action: 'getDeadlineSettings' });
    const day = res.day || localStorage.getItem('tt_deadline_day') || '';
    const time = res.time || localStorage.getItem('tt_deadline_time') || '17:00';
    const msg = res.msg || localStorage.getItem('tt_deadline_msg') || '⏰ Reminder: Your weekly update is overdue. Please submit it now.';
    const ddEl = document.getElementById('deadline-day');
    const dtEl = document.getElementById('deadline-time');
    const dmEl = document.getElementById('deadline-msg');
    if (ddEl) ddEl.value = day;
    if (dtEl) dtEl.value = time;
    if (dmEl) dmEl.value = msg;
  } catch(e) {
    // Fallback to localStorage
    const day = localStorage.getItem('tt_deadline_day') || '';
    const time = localStorage.getItem('tt_deadline_time') || '17:00';
    const msg = localStorage.getItem('tt_deadline_msg') || '⏰ Reminder: Your weekly update is overdue. Please submit it now.';
    const ddEl = document.getElementById('deadline-day'); const dtEl = document.getElementById('deadline-time'); const dmEl = document.getElementById('deadline-msg');
    if (ddEl) ddEl.value = day; if (dtEl) dtEl.value = time; if (dmEl) dmEl.value = msg;
  }
}

async function loadPayIndexUrl() {
  try {
    const res = await api({ action:'getPayIndexUrl' });
    const url = res.url || localStorage.getItem('tt_pay_index_url') || '';
    if (url) localStorage.setItem('tt_pay_index_url', url); // keep local copy in sync
    const inp = document.getElementById('pay-index-url-input');
    const statusEl = document.getElementById('pay-index-url-status');
    if (inp && url) { inp.value = url; if(statusEl) statusEl.textContent = '✓ Pay index URL saved'; }
  } catch(e) {
    // Fallback to localStorage
    const url = localStorage.getItem('tt_pay_index_url') || '';
    const inp = document.getElementById('pay-index-url-input');
    if (inp && url) inp.value = url;
  }
}

async function runDeadlineCheckNow() {
  const status = document.getElementById('deadline-status');
  status.textContent = 'Checking…';
  await runDeadlineCheck(true);
}

async function runDeadlineCheck(force=false) {
  // Read settings from sheet (already loaded into UI fields)
  const day = document.getElementById('deadline-day')?.value || localStorage.getItem('tt_deadline_day');
  if (!day) return;
  const time = document.getElementById('deadline-time')?.value || localStorage.getItem('tt_deadline_time') || '17:00';
  const msg = document.getElementById('deadline-msg')?.value || localStorage.getItem('tt_deadline_msg') || '⏰ Reminder: Your weekly update is overdue. Please submit it now.';
  const lastRunKey = `tt_deadline_last_${currentWeek}`;
  const lastRun = localStorage.getItem(lastRunKey);
  const status = document.getElementById('deadline-status');
  const lastRunEl = document.getElementById('deadline-last-run');

  const now = new Date();
  const [hh,mm] = time.split(':').map(Number);
  const deadlineDay = parseInt(day);
  const weekStart = new Date(currentWeek+'T12:00:00');
  const dayOffset = deadlineDay === 0 ? 6 : deadlineDay - 1;
  const deadlineDate = new Date(weekStart);
  deadlineDate.setDate(weekStart.getDate() + dayOffset);
  deadlineDate.setHours(hh, mm, 0, 0);

  if (!force && lastRun) {
    if(lastRunEl) lastRunEl.textContent = `Last reminder sent: ${new Date(lastRun).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`;
    if(status) status.textContent=''; return;
  }
  if (!force && now < deadlineDate) {
    if(lastRunEl) lastRunEl.textContent = `Deadline: ${deadlineDate.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} — not yet passed`;
    if(status) status.textContent=''; return;
  }

  const submittedMgrs = new Set(allSubs.filter(s=>s.week===currentWeek).map(s=>s.manager));
  const missing = managers.filter(m=>!submittedMgrs.has(m));
  if (!missing.length) {
    if(status) status.textContent='✓ All managers submitted';
    if(lastRunEl) lastRunEl.textContent=`Checked ${now.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} — all submitted`;
    return;
  }

  let sent=0;
  for(const mgr of missing){
    try{ await api({action:'saveNotification',notification:{id:'deadline'+Date.now()+Math.random().toString(36).slice(2,5),manager:mgr,title:'Submission Overdue',message:msg,sentAt:new Date().toISOString()}}); sent++; }catch(e){}
  }
  localStorage.setItem(lastRunKey, now.toISOString());
  if(status){status.textContent=`✓ Sent ${sent} reminder${sent!==1?'s':''}`;setTimeout(()=>{if(status)status.textContent='';},4000);}
  if(lastRunEl) lastRunEl.textContent=`Reminders sent to: ${missing.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(', ')} — ${now.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`;
  if(sent>0) showToast(`Deadline reminders sent to ${sent} manager${sent!==1?'s':''} ✓`,'success');
}


// Bulk clear read notifications
async function bulkClearReadNotifs() {
  const readOnes = allLiveNotifs.filter(n=>!!n.readAt);
  if (!readOnes.length) { showToast('No read notifications to clear','error'); return; }
  if (!confirm(`Delete ${readOnes.length} read notification${readOnes.length!==1?'s':''}?`)) return;
  let ok=0;
  for(const n of readOnes){
    try{ await api({action:'deleteNotification',id:n.id}); ok++; }catch(e){}
  }
  allLiveNotifs = allLiveNotifs.filter(n=>!n.readAt);
  renderLiveNotifs();
  showToast(`Cleared ${ok} read notification${ok!==1?'s':''} ✓`,'success');
}

// Bulk delete all notifications for a specific manager
async function bulkClearMgrNotifs() {
  const filter=(document.getElementById('notif-filter-mgr')||{}).value||'';
  if(!filter){showToast('Select a manager to bulk-clear','error');return;}
  const toDelete=allLiveNotifs.filter(n=>n.manager===filter);
  if(!toDelete.length){showToast('No notifications for this manager','error');return;}
  const dn=filter.charAt(0).toUpperCase()+filter.slice(1);
  if(!confirm(`Delete all ${toDelete.length} notifications for ${dn}?`))return;
  let ok=0;
  for(const n of toDelete){try{await api({action:'deleteNotification',id:n.id});ok++;}catch(e){}}
  allLiveNotifs=allLiveNotifs.filter(n=>n.manager!==filter);
  renderLiveNotifs();
  showToast(`Cleared ${ok} notification${ok!==1?'s':''} for ${dn} ✓`,'success');
}

// Bulk delete old uploaded reports
async function bulkDeleteOldReports(weeksOld=8) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksOld*7);
  const old = allUploadedReports.filter(r=>{
    if(!r.week)return false;
    const d=new Date(r.week+'T12:00:00');
    return d < cutoff;
  });
  if(!old.length){showToast(`No reports older than ${weeksOld} weeks`,'error');return;}
  if(!confirm(`Delete ${old.length} report${old.length!==1?'s':''} older than ${weeksOld} weeks?`))return;
  let ok=0;
  for(const r of old){try{await api({action:'deleteReport',id:r.id});ok++;}catch(e){}}
  await loadUploadHistory();renderUploadHistory();
  showToast(`Deleted ${ok} old report${ok!==1?'s':''} ✓`,'success');
}

// ── Announcements ─────────────────────────────────────
async function postAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const message = document.getElementById('ann-message').value.trim();
  if (!title) { showToast('Add a title', 'error'); return; }
  try { await api({ action: 'saveAnnouncement', title, message }); showToast('Announcement posted ✓', 'success'); } catch(e) { showToast('Failed to post', 'error'); }
}

async function clearAnnouncement() {
  try {
    await api({ action: 'saveAnnouncement', title: '', message: '' });
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-message').value = '';
    showToast('Announcement cleared ✓', 'success');
  } catch(e) { showToast('Failed to clear', 'error'); }
}

// ── Toast & utils ─────────────────────────────────────
function showToast(msg,type,duration) {
  const t=document.getElementById('toast'); t.textContent=msg; t.className=`toast ${type} show`;
  setTimeout(()=>t.className='toast',duration||3000);
}

async function setPassword(manager) {
  const inp = document.getElementById('pw-'+manager);
  if (!inp) return;
  const pw = inp.value.trim();
  if (!pw) { showToast('Enter a password first', 'error'); return; }
  try {
    await api({ action: 'setPassword', manager, password: pw });
    managerPasswordStatus[manager] = true;
    renderLinks();
    showToast(`Password set for ${manager} ✓`, 'success');
  } catch(e) { showToast('Failed to save password', 'error'); }
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }


// ── Calendar colour picker ────────────────────────────
function selectCalColour(el,cat){document.querySelectorAll('#cal-colour-picker .cal-swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected');}
function getSelectedCalColour(){const s=document.querySelector('#cal-colour-picker .cal-swatch.selected');return s?s.dataset.cat:'personal';}

// ── Notifications ────────────────────────────────────
let allLiveNotifs=[];
let notifTemplates=[];

function renderNotifManagerCheckboxes(){
  const wrap=document.getElementById('notif-manager-checkboxes');if(!wrap)return;
  if(!managers.length){wrap.innerHTML='<div style="color:var(--muted);font-size:13px;">No managers added yet.</div>';return;}
  wrap.innerHTML=managers.map(m=>{const dn=m.charAt(0).toUpperCase()+m.slice(1);
    return`<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--surface2);border:1px solid var(--border);padding:5px 12px;border-radius:20px;"><input type="checkbox" id="nm-${m}" value="${esc(m)}" style="cursor:pointer;accent-color:var(--accent);"/> ${esc(dn)}</label>`;
  }).join('');
  const filterSel=document.getElementById('notif-filter-mgr');
  if(filterSel){const cur=filterSel.value;filterSel.innerHTML='<option value="">All managers</option>'+managers.map(m=>`<option value="${esc(m)}" ${m===cur?'selected':''}>${esc(m.charAt(0).toUpperCase()+m.slice(1))}</option>`).join('');}
}
function notifSelectAll(){managers.forEach(m=>{const cb=document.getElementById(`nm-${m}`);if(cb)cb.checked=true;});}
function notifSelectNone(){managers.forEach(m=>{const cb=document.getElementById(`nm-${m}`);if(cb)cb.checked=false;});}
function getNotifCheckedManagers(){return managers.filter(m=>{const cb=document.getElementById(`nm-${m}`);return cb&&cb.checked;});}

async function sendNotification(){
  const title=document.getElementById('notif-title').value.trim();
  const message=document.getElementById('notif-message').value.trim();
  const selectedMgrs=getNotifCheckedManagers();
  const status=document.getElementById('notif-status');
  if(!title){showToast('Add a title','error');return;}
  if(!selectedMgrs.length){showToast('Select at least one manager','error');return;}
  status.textContent='Sending…';
  let ok=0,fail=[];
  for(const mgr of selectedMgrs){
    try{
      await api({action:'saveNotification',notification:{id:'notif'+Date.now()+Math.random().toString(36).slice(2,6),manager:mgr,title,message,sentAt:new Date().toISOString()}});
      ok++;
    }catch(e){fail.push(mgr);}
  }
  status.textContent=fail.length?`Sent to ${ok}, failed: ${fail.join(', ')}`:`✓ Sent to ${ok} manager${ok!==1?'s':''}`;
  if(!fail.length){
    showToast(`Notification sent to ${ok} manager${ok!==1?'s':''} ✓`,'success');
    document.getElementById('notif-title').value='';
    document.getElementById('notif-message').value='';
    notifSelectNone();
    setTimeout(()=>status.textContent='',4000);
    await refreshLiveNotifs();
  }else{showToast(`Some sends failed: ${fail.join(', ')}`,'error',5000);}
}

async function refreshLiveNotifs(){
  if(!scriptUrl)return;
  try{const res=await api({action:'getAllNotifications'});allLiveNotifs=res.notifications||[];renderLiveNotifs();}catch(e){}
}

function renderLiveNotifs(){
  const el=document.getElementById('live-notifs-list');if(!el)return;
  const filter=(document.getElementById('notif-filter-mgr')||{}).value||'';
  let notifs=[...allLiveNotifs].filter(n=>!filter||n.manager===filter);
  notifs.sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
  if(!notifs.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;">No notifications sent yet.</div>';return;}
  el.innerHTML=notifs.map(n=>{
    const dn=(n.manager||'').charAt(0).toUpperCase()+(n.manager||'').slice(1);
    const sent=n.sentAt?new Date(n.sentAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    const isRead=!!n.readAt;
    const readStr=isRead?`<span style="font-size:11px;color:var(--success);font-weight:600;">✓ Read</span>`:`<span style="font-size:11px;color:var(--warning);font-weight:600;">● Unread</span>`;
    return`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <span style="font-size:12px;font-weight:700;color:var(--accent);text-transform:capitalize;">${esc(dn)}</span>
          ${readStr}
          <span style="font-size:11px;color:var(--muted);margin-left:auto;">${sent}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px;">${esc(n.title)}</div>
        ${n.message?`<div style="font-size:12px;color:var(--muted);">${esc(n.message)}</div>`:''}
      </div>
      <button onclick="deleteLiveNotif('${esc(n.id)}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;flex-shrink:0;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--muted)'">×</button>
    </div>`;
  }).join('');
}

async function deleteLiveNotif(id){
  if(!confirm('Remove this notification?'))return;
  try{await api({action:'deleteNotification',id});allLiveNotifs=allLiveNotifs.filter(n=>n.id!==id);renderLiveNotifs();showToast('Notification removed ✓','success');}
  catch(e){showToast('Failed to remove','error');}
}

// ── Notification templates ────────────────────────────
async function loadNotifTemplates(){
  if(!scriptUrl)return;
  try{const res=await api({action:'getNotifTemplates'});notifTemplates=res.templates||[];renderTemplateDropdown();}catch(e){}
}
function renderTemplateDropdown(){
  const sel=document.getElementById('notif-template-select');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— choose template —</option>'+notifTemplates.map(t=>`<option value="${esc(t.id)}" ${t.id===cur?'selected':''}>${esc(t.name)}</option>`).join('');
}
function loadNotifTemplate(){
  const id=document.getElementById('notif-template-select').value;if(!id)return;
  const tmpl=notifTemplates.find(t=>t.id===id);if(!tmpl)return;
  document.getElementById('notif-title').value=tmpl.title||'';
  document.getElementById('notif-message').value=tmpl.message||'';
}
async function saveNotifTemplate(){
  const title=document.getElementById('notif-title').value.trim();
  const message=document.getElementById('notif-message').value.trim();
  if(!title){showToast('Fill in a title to save as template','error');return;}
  const name=prompt('Template name:',title);if(!name)return;
  const tmpl={id:'tmpl'+Date.now(),name,title,message,createdAt:new Date().toISOString()};
  try{await api({action:'saveNotifTemplate',template:tmpl});notifTemplates.push(tmpl);renderTemplateDropdown();showToast('Template saved ✓','success');}
  catch(e){showToast('Failed to save template','error');}
}
async function createNotifTemplate(){
  const name=document.getElementById('tmpl-name').value.trim();
  const title=document.getElementById('tmpl-title').value.trim();
  const message=document.getElementById('tmpl-body').value.trim();
  const status=document.getElementById('tmpl-status');
  if(!name||!title){showToast('Name and title required','error');return;}
  const tmpl={id:'tmpl'+Date.now(),name,title,message,createdAt:new Date().toISOString()};
  try{
    await api({action:'saveNotifTemplate',template:tmpl});notifTemplates.push(tmpl);renderTemplateDropdown();
    document.getElementById('tmpl-name').value='';document.getElementById('tmpl-title').value='';document.getElementById('tmpl-body').value='';
    status.textContent='✓ Saved';setTimeout(()=>status.textContent='',3000);showToast('Template created ✓','success');
  }catch(e){showToast('Failed to create template','error');}
}
async function deleteNotifTemplate(){
  const id=document.getElementById('notif-template-select').value;
  if(!id){showToast('Select a template first','error');return;}
  const tmpl=notifTemplates.find(t=>t.id===id);
  if(!confirm(`Delete template "${tmpl?.name}"?`))return;
  try{await api({action:'deleteNotifTemplate',id});notifTemplates=notifTemplates.filter(t=>t.id!==id);renderTemplateDropdown();showToast('Template deleted ✓','success');}
  catch(e){showToast('Failed to delete','error');}
}

/* ══════════════════════════════════════════
   PLANNER GROUPS (admin)
══════════════════════════════════════════ */

async function pgLoad() {
  try {
    const res = await api({action:'getPlannerGroups'});
    plannerGroups = (res && res.groups) || [];
  } catch(e) {
    // getPlannerGroups not deployed yet — silently ignore
    plannerGroups = [];
  }
  pgRender();
}

function pgRender() {
  const list = document.getElementById('pg-groups-list');
  const unassignedEl = document.getElementById('pg-unassigned');
  if (!list || !unassignedEl) return;

  // Which managers are assigned
  const assigned = new Set(plannerGroups.flatMap(g => g.members));
  const unassigned = managers.filter(m => !assigned.has(m));

  // Render groups
  if (!plannerGroups.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;">No groups yet — click "+ New group" to create one.</div>';
  } else {
    list.innerHTML = plannerGroups.map((g, gi) => {
      const memberChips = managers.map(m => {
        const dn = m.charAt(0).toUpperCase() + m.slice(1);
        const inGroup = g.members.includes(m);
        return `<div onclick="pgToggleMember(${gi},'${esc(m)}')" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;cursor:pointer;user-select:none;transition:all .15s;${inGroup ? 'background:var(--accent);color:#fff;border:1px solid var(--accent);' : 'background:var(--surface);color:var(--muted);border:1px solid var(--border);'}">
          <span style="width:18px;height:18px;border-radius:50%;background:${inGroup?'rgba(255,255,255,.3)':'var(--surface2)'};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;">${dn.charAt(0)}</span>
          ${esc(dn)}
        </div>`;
      }).join('');
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <input value="${esc(g.name)}" oninput="plannerGroups[${gi}].name=this.value" placeholder="Group name…" style="flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:13px;font-weight:600;padding:6px 10px;border-radius:7px;outline:none;"/>
          <button onclick="pgRemoveGroup(${gi})" style="background:none;border:1px solid var(--border2);color:var(--muted);font-size:12px;padding:5px 10px;border-radius:6px;cursor:pointer;font-family:var(--font);" onmouseover="this.style.color='var(--danger)';this.style.borderColor='var(--danger)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--border2)'">Remove group</button>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Members — click to toggle</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${memberChips || '<span style="font-size:12px;color:var(--muted);">No managers yet</span>'}</div>
        <div style="font-size:11px;color:var(--muted);">${g.members.length} manager${g.members.length!==1?'s':''} share one planner${g.members.length>0?' — shared under <code style="font-size:11px;background:var(--surface);padding:1px 5px;border-radius:4px;">'+ g.members.slice().sort()[0] +'</code>&#39;s key':''}</div>
      </div>`;
    }).join('');
  }

  // Render unassigned
  if (!unassigned.length) {
    unassignedEl.innerHTML = '<span style="font-size:12px;color:var(--muted);">All managers are in a group.</span>';
  } else {
    unassignedEl.innerHTML = unassigned.map(m => {
      const dn = m.charAt(0).toUpperCase() + m.slice(1);
      return `<div style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 10px;border-radius:20px;background:var(--surface);border:1px solid var(--border);color:var(--muted);">
        <span style="width:18px;height:18px;border-radius:50%;background:var(--surface2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;">${dn.charAt(0)}</span>
        ${esc(dn)}
      </div>`;
    }).join('');
  }
}

function pgAddGroup() {
  const id = 'g_' + Date.now();
  plannerGroups.push({id, name: 'Group ' + (plannerGroups.length + 1), members: []});
  pgRender();
  pgSaveDebounced();
}

function pgRemoveGroup(gi) {
  if (!confirm('Remove this group? Managers will revert to private planners.')) return;
  plannerGroups.splice(gi, 1);
  pgRender();
  pgSaveDebounced();
}

let _pgSaveTimer = null;
function pgToggleMember(gi, mgr) {
  const g = plannerGroups[gi];
  const idx = g.members.indexOf(mgr);
  if (idx === -1) {
    // Remove from any other group first
    plannerGroups.forEach((og, i) => { if (i !== gi) og.members = og.members.filter(m => m !== mgr); });
    g.members.push(mgr);
  } else {
    g.members.splice(idx, 1);
  }
  pgRender();
  pgSaveDebounced();
}

function pgSaveDebounced() {
  clearTimeout(_pgSaveTimer);
  _pgSaveTimer = setTimeout(pgSave, 800);
}

async function pgSave() {
  try {
    await api({action:'savePlannerGroups', groups: plannerGroups});
    showToast('Groups saved ✓', 'success');
  } catch(e) { showToast('Failed to save groups', 'error'); }
}

/* ══════════════════════════════════════════
   CLIENTS & CAMPAIGNS
══════════════════════════════════════════ */

let allClients = [];   // [{id, clientName, campaign, logoUrl, fullName}]
let _clLogoData = '';  // base64 of logo being uploaded

function clPreviewLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 1*1024*1024) { showToast('Logo too large — max 1MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    _clLogoData = e.target.result;
    const preview = document.getElementById('cl-logo-preview');
    preview.innerHTML = `<img src="${_clLogoData}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;"/>`;
    document.getElementById('cl-logo-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function clSaveClient() {
  const clientName = document.getElementById('cl-client-name').value.trim();
  const campaign = document.getElementById('cl-campaign-type').value;
  const status = document.getElementById('cl-save-status');
  if (!clientName) { showToast('Enter a client name', 'error'); return; }
  const fullName = clientName + ' ' + campaign;
  const client = {
    id: 'cl_' + Date.now(),
    clientName,
    campaign,
    fullName,
    logoData: _clLogoData || '',
    logoUrl: ''
  };
  status.textContent = 'Saving…';
  try {
    const res = await api({action: 'saveClient', client});
    if (res && res.logoUrl) client.logoUrl = res.logoUrl;
    client.logoData = ''; // clear base64 after save
    allClients.push(client);
    renderClientList();
    // reset form
    document.getElementById('cl-client-name').value = '';
    document.getElementById('cl-campaign-type').value = 'Doors';
    document.getElementById('cl-logo-preview').innerHTML = _SVG_BLDG;
    document.getElementById('cl-logo-name').textContent = '';
    _clLogoData = '';
    const inp = document.getElementById('cl-logo-input');
    if (inp) inp.value = '';
    status.textContent = '✓ Saved';
    setTimeout(() => status.textContent = '', 3000);
    showToast('Client saved ✓', 'success');
    // Re-render manager profiles if loaded
    renderMgrProfilesCampaignDropdowns();
  } catch(e) { status.textContent = ''; showToast('Failed to save client', 'error'); }
}

async function clLoadClients() {
  const list = document.getElementById('cl-client-list');
  if (!list) return;
  list.innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
  try {
    const res = await api({action: 'getClients'});
    allClients = (res && res.clients) || [];
    renderClientList();
  } catch(e) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;">Could not load clients.</div>';
  }
}

function renderClientList() {
  const list = document.getElementById('cl-client-list');
  if (!list) return;
  if (!allClients.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;">No clients registered yet.</div>';
    return;
  }
  list.innerHTML = allClients.map(c => {
    const imgHtml = c.logoUrl
      ? `<img src="${esc(c.logoUrl)}" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid var(--border);background:#fff;" />`
      : `<div style="width:40px;height:40px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted);">${_SVG_BLDG}</div>`;
    const campStyle = c.campaign === 'Doors'
      ? 'background:#ffe0a0;color:#b85c00;border-color:#f08000;'
      : 'background:#b3d4ff;color:#1140cc;border-color:#1d50ff;';
    return `<div style="display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
      ${imgHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;">${esc(c.clientName)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid;${campStyle}">${esc(c.campaign)}</span>
          <span style="margin-left:8px;font-weight:600;color:var(--text);">${esc(c.fullName)}</span>
        </div>
      </div>
      <button onclick="clDeleteClient('${esc(c.id)}')" style="background:none;border:1px solid var(--border2);color:var(--muted);font-size:13px;padding:5px 10px;border-radius:var(--radius-sm);cursor:pointer;transition:all .15s;" onmouseover="this.style.color='var(--danger)';this.style.borderColor='var(--danger)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--border2)'">×</button>
    </div>`;
  }).join('');
}

async function clDeleteClient(id) {
  if (!confirm('Remove this client? Will not unassign from managers.')) return;
  allClients = allClients.filter(c => c.id !== id);
  renderClientList();
  renderMgrProfilesCampaignDropdowns();
  try { await api({action: 'deleteClient', id}); } catch(e) {}
}

/* ══════════════════════════════════════════
   MANAGER PROFILES (admin side)
══════════════════════════════════════════ */

let mgrProfiles = {}; // { managerName: { city, campaigns:[], phone, startDate, target, bio } }

async function mgrProfilesLoad() {
  const list = document.getElementById('mgr-profiles-list');
  if (!list) return;
  list.innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
  // Load clients too if not loaded
  if (!allClients.length) {
    try { const res = await api({action:'getClients'}); allClients = (res&&res.clients)||[]; } catch(e) {}
  }
  try {
    const res = await api({action: 'getManagerProfiles'});
    mgrProfiles = (res && res.profiles) || {};
  } catch(e) { mgrProfiles = {}; }
  renderMgrProfiles();
}

function renderMgrProfiles() {
  const list = document.getElementById('mgr-profiles-list');
  if (!list) return;
  if (!managers.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;">No managers added yet. Go to Setup to add managers first.</div>';
    return;
  }
  list.innerHTML = managers.map(m => {
    const dn = m.charAt(0).toUpperCase() + m.slice(1);
    const p = mgrProfiles[m] || {};
    const assignedCampaigns = p.campaigns || [];
    const picSrc = allProfilePics[m];
    const avatarHtml = picSrc
      ? `<img src="${picSrc}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid var(--border);flex-shrink:0;" />`
      : `<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--accent-dark),var(--accent));display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0;">${dn.charAt(0)}</div>`;

    // Campaign checkboxes
    const campCheckboxes = allClients.length
      ? allClients.map(c => {
          const checked = assignedCampaigns.includes(c.id) ? 'checked' : '';
          const imgTag = c.logoUrl ? `<img src="${esc(c.logoUrl)}" style="width:16px;height:16px;object-fit:contain;border-radius:3px;vertical-align:middle;margin-right:4px;" />` : '';
          return `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;cursor:pointer;background:var(--surface);border:1px solid var(--border);user-select:none;transition:all .12s;" class="cl-check-wrap" id="clw-${esc(m)}-${esc(c.id)}">
            <input type="checkbox" ${checked} data-mgr="${esc(m)}" data-cl="${esc(c.id)}" onchange="mgrToggleCampaign('${esc(m)}','${esc(c.id)}',this.checked)" style="accent-color:var(--accent);cursor:pointer;" />
            ${imgTag}${esc(c.fullName)}
          </label>`;
        }).join('')
      : '<span style="font-size:12px;color:var(--muted);">No clients yet — register clients above first.</span>';

    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        ${avatarHtml}
        <div style="font-size:15px;font-weight:700;text-transform:capitalize;">${esc(dn)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div class="form-lbl" style="margin-bottom:4px;">City</div>
          <input type="text" id="mgrp-city-${esc(m)}" class="form-input" value="${esc(p.city||'')}" placeholder="e.g. Glasgow" oninput="mgrProfileDirty('${esc(m)}')" />
        </div>
        <div>
          <div class="form-lbl" style="margin-bottom:4px;">Phone</div>
          <input type="text" id="mgrp-phone-${esc(m)}" class="form-input" value="${esc(p.phone||'')}" placeholder="e.g. 07700 900000" oninput="mgrProfileDirty('${esc(m)}')" />
        </div>
        <div>
          <div class="form-lbl" style="margin-bottom:4px;">Start date</div>
          <input type="date" id="mgrp-start-${esc(m)}" class="form-input" value="${esc(p.startDate||'')}" oninput="mgrProfileDirty('${esc(m)}')" />
        </div>
        <div>
          <div class="form-lbl" style="margin-bottom:4px;">Weekly target (£)</div>
          <input type="number" id="mgrp-target-${esc(m)}" class="form-input" value="${esc(p.weeklyTarget||'')}" placeholder="e.g. 5000" min="0" step="100" oninput="mgrProfileDirty('${esc(m)}')" />
        </div>
        <div style="grid-column:span 2;">
          <div class="form-lbl" style="margin-bottom:4px;">Bio / motto</div>
          <input type="text" id="mgrp-bio-${esc(m)}" class="form-input" value="${esc(p.bio||'')}" placeholder="A short bio or team motto…" oninput="mgrProfileDirty('${esc(m)}')" />
        </div>
      </div>
      <div class="form-lbl" style="margin-bottom:6px;">Campaigns assigned</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;" id="clchecks-${esc(m)}">${campCheckboxes}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button onclick="mgrProfileSave('${esc(m)}')" id="mgrp-save-${esc(m)}" style="background:var(--accent);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:500;padding:7px 16px;border-radius:var(--radius-sm);cursor:pointer;transition:opacity .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Save profile</button>
        <span id="mgrp-status-${esc(m)}" style="font-size:11px;color:var(--muted);font-family:monospace;"></span>
      </div>
    </div>`;
  }).join('');
}

function renderMgrProfilesCampaignDropdowns() {
  if (!document.getElementById('tab-mgrprofiles').classList.contains('active')) return;
  renderMgrProfiles();
}

function mgrProfileDirty(m) {
  const st = document.getElementById('mgrp-status-' + m);
  if (st) st.textContent = '(unsaved)';
}

function mgrToggleCampaign(m, clId, checked) {
  if (!mgrProfiles[m]) mgrProfiles[m] = {};
  if (!mgrProfiles[m].campaigns) mgrProfiles[m].campaigns = [];
  if (checked && !mgrProfiles[m].campaigns.includes(clId)) {
    mgrProfiles[m].campaigns.push(clId);
  } else {
    mgrProfiles[m].campaigns = mgrProfiles[m].campaigns.filter(x => x !== clId);
  }
  // Update visual style
  const wrap = document.getElementById(`clw-${m}-${clId}`);
  if (wrap) {
    if (checked) { wrap.style.background='var(--accent)'; wrap.style.color='#fff'; wrap.style.borderColor='var(--accent)'; }
    else { wrap.style.background='var(--surface)'; wrap.style.color=''; wrap.style.borderColor='var(--border)'; }
  }
  mgrProfileDirty(m);
}

async function mgrProfileSave(m) {
  const city = (document.getElementById('mgrp-city-' + m)||{}).value || '';
  const phone = (document.getElementById('mgrp-phone-' + m)||{}).value || '';
  const startDate = (document.getElementById('mgrp-start-' + m)||{}).value || '';
  const weeklyTarget = (document.getElementById('mgrp-target-' + m)||{}).value || '';
  const bio = (document.getElementById('mgrp-bio-' + m)||{}).value || '';
  const campaigns = (mgrProfiles[m] && mgrProfiles[m].campaigns) || [];
  const profile = { city, phone, startDate, weeklyTarget, bio, campaigns };
  mgrProfiles[m] = profile;
  const st = document.getElementById('mgrp-status-' + m);
  if (st) st.textContent = 'Saving…';
  try {
    await api({action: 'saveManagerProfile', manager: m, profile});
    if (st) { st.textContent = '✓ Saved'; setTimeout(() => { if(st) st.textContent=''; }, 3000); }
    showToast(`${m} profile saved ✓`, 'success');
  } catch(e) {
    if (st) st.textContent = 'Save failed';
    showToast('Failed to save profile', 'error');
  }
}

