'use strict';
(() => {
  const BOOT = JSON.parse(document.getElementById('boot-data').textContent);
  const ROOT = BOOT.root;
  const FOLDER = 'application/vnd.google-apps.folder';
  const SHORTCUT = 'application/vnd.google-apps.shortcut';
  const SEPKM = 'https://www.sepkm.com/e/login/';
  const SEPKM_ID = '1g0erCulMhIrB4hPjRD_KSnXRrK2iuYv1';
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => '<svg class="i" aria-hidden="true"><use href="#i-' + escapeHTML(name) + '"/></svg>';
  const folderType = item => item.mimeType === FOLDER || item.shortcutDetails?.targetMimeType === FOLDER;
  const isSePKM = item => item.id === SEPKM_ID || /\bsepkm\b/i.test(item.name || '');
  const shortName = name => String(name || '').replace(/^\s*(?:\d+|[a-z])\s*[.\-)]+\s*/i, '').trim();
  const routeFor = id => id === ROOT ? '#library' : '#folder/' + encodeURIComponent(id);
  const byName = (a,b) => String(a.name).localeCompare(String(b.name), 'ms', {numeric:true, sensitivity:'base'});
  const nameToIcon = item => BOOT.seed.find(x => x.id === item.id)?.icon || (isSePKM(item) ? 'clipboard' : 'folder');
  const resources = new Map(BOOT.seed.map(x => [x.id, x.resourceKey || '']));
  const state = { rootItems:BOOT.seed, folder:null, path:[], items:[], folderId:ROOT, page:'home', view:'grid', busy:false, routeSerial:0, viewer:null, viewerSerial:0, lastLive:0, lastRefresh:0, navAbort:null, toastTimer:null, frameTimer:null };

  class PortalError extends Error {
    constructor(message, code = 'NETWORK', status = 0) { super(message); this.code=code; this.status=status; }
  }
  function formatDate(value, time=false) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ms-MY', {timeZone:'Asia/Kuala_Lumpur', day:'2-digit', month:'short', year:'numeric', ...(time ? {hour:'2-digit',minute:'2-digit'} : {})}).format(date);
  }
  function toast(message) {
    clearTimeout(state.toastTimer); $('toast').textContent=message; $('toast').hidden=false;
    state.toastTimer=setTimeout(() => $('toast').hidden=true, 3800);
  }
  function setStatus(mode, message) {
    $('sync-status').dataset.state=mode; $('sync-text').textContent=message;
    $('sync-status').title = state.lastLive ? 'Semakan terakhir: ' + formatDate(state.lastLive,true) : message;
  }
  function connectionNote(message, error=false) {
    $('connection-note').hidden=!message;
    $('connection-note-text').textContent=message || '';
    $('connection-note').classList.toggle('notice-error',error);
  }
  function statusSuccess() {
    if (BOOT.preview) {
      setStatus('preview','Pratonton');
      connectionNote('Pratonton reka bentuk • Belum disambungkan ke Google Drive.');
    } else {
      state.lastLive=Date.now(); setStatus('live','Diselaraskan'); connectionNote('');
    }
  }
  function statusError(error) {
    if (BOOT.preview) { statusSuccess(); return; }
    const disconnected = error.code === 'SETUP_REQUIRED';
    setStatus('error',disconnected ? 'Belum disambungkan' : 'Sambungan terganggu');
    connectionNote(disconnected ? 'Sambungan Google Drive belum diaktifkan.' : (state.lastLive ? 'Sambungan terganggu. Paparan terakhir: '+formatDate(state.lastLive,true)+'.' : error.message || 'Bahan belum dapat dimuatkan.'), true);
  }
  function registerItems(items) {
    for (const item of items) if (item.resourceKey) resources.set(item.id,item.resourceKey);
  }
  async function jsonFetch(url, signal) {
    let response;
    try { response=await fetch(url,{headers:{'Accept':'application/json'},cache:'no-store',signal}); }
    catch(error) { if(error.name==='AbortError') throw error; throw new PortalError('Sambungan rangkaian tidak tersedia.'); }
    let data;
    try { data=await response.json(); }
    catch { throw new PortalError('Respons sambungan tidak sah.','BAD_RESPONSE',response.status); }
    if(!response.ok || data.error) throw new PortalError(data.message || 'Bahan tidak dapat dimuatkan.',data.error || 'UPSTREAM',response.status);
    return data;
  }
  async function fetchFolder(id, signal) {
    if (BOOT.preview) {
      const entry=BOOT.snapshots[id];
      if(!entry) throw new PortalError('Bahan langsung tersedia selepas sambungan Google Drive.','PREVIEW_ONLY');
      return structuredClone(entry);
    }
    const seen=new Set(); const items=[]; let token=''; let first;
    do {
      const p=new URLSearchParams({id});
      if(resources.get(id)) p.set('resourceKey',resources.get(id));
      if(token) p.set('pageToken',token);
      const result=await jsonFetch('/api/list?'+p,signal);
      if(!first) first=result;
      if(!Array.isArray(result.items)) throw new PortalError('Senarai bahan tidak sah.','BAD_RESPONSE');
      items.push(...result.items);
      token=result.nextPageToken || '';
      if (token && seen.has(token)) throw new PortalError('Senarai bahan belum lengkap. Sila cuba lagi.','PAGINATION');
      if (token) seen.add(token);
      if (seen.size > 100) throw new PortalError('Folder terlalu besar untuk satu paparan.','TOO_LARGE');
    } while(token);
    registerItems(items);
    return {...first, items};
  }
  async function fileInfo(item) {
    if (BOOT.preview) throw new PortalError('Pratonton dokumen langsung tersedia selepas sambungan Google Drive.','PREVIEW_ONLY');
    const p=new URLSearchParams({id:item.id});
    if(item.resourceKey || resources.get(item.id)) p.set('resourceKey',item.resourceKey || resources.get(item.id));
    return jsonFetch('/api/file?'+p);
  }
  function renderNavigation() {
    const filter=$('nav-search').value.trim().toLocaleLowerCase('ms');
    const folders=state.rootItems.filter(folderType).sort(byName);
    const active=state.path.map(x=>x.id);
    $('nav-list').innerHTML=folders.filter(item=>item.name.toLocaleLowerCase('ms').includes(filter)).map(item=> {
      const index=(item.name.match(/^\s*(\d+)/)||[])[1] || '';
      const current=state.page==='library' && (item.id===state.folderId || active.includes(item.id));
      const href=isSePKM(item) ? SEPKM : routeFor(item.id);
      return '<a class="nav-item'+(current?' is-active':'')+'" href="'+escapeHTML(href)+'"'+(current?' aria-current="page"':'')+'>'+icon(nameToIcon(item))+'<span><b>'+escapeHTML(shortName(item.name))+'</b></span><span class="nav-num">'+escapeHTML(index.padStart(2,'0'))+'</span></a>';
    }).join('') || '<div class="nav-empty">Tiada bahagian ditemui.</div>';
    $('home-link').classList.toggle('is-active',state.page==='home');
    if(state.page==='home') $('home-link').setAttribute('aria-current','page'); else $('home-link').removeAttribute('aria-current');
  }
  function renderCards() {
    const folders=state.rootItems.filter(folderType).sort(byName);
    $('section-count').textContent=folders.length+' bahagian';
    $('section-grid').innerHTML=folders.map((item,idx)=> {
      const num=(item.name.match(/^\s*(\d+)/)||[])[1] || String(idx+1);
      return '<a class="section-card" href="'+escapeHTML(isSePKM(item)?SEPKM:routeFor(item.id))+'"><div class="card-top"><span class="tile-icon">'+icon(nameToIcon(item))+'</span><span class="tile-index">'+escapeHTML(num.padStart(2,'0'))+'</span></div><h3>'+escapeHTML(shortName(item.name))+'</h3><div class="card-bottom"><span>'+(isSePKM(item)?'Ke SePKM':'Buka bahagian')+'</span>'+icon(isSePKM(item)?'external':'arrow')+'</div></a>';
    }).join('');
  }
  function crumbs(path) {
    return '<a href="#home">'+icon('home')+' Laman Utama</a>'+path.map((p,i)=> icon('chevron')+(i===path.length-1 ? '<span aria-current="page">'+escapeHTML(p.id===ROOT?'Pusat Dokumen':p.name)+'</span>' : '<a href="'+escapeHTML(routeFor(p.id))+'">'+escapeHTML(p.id===ROOT?'Pusat Dokumen':p.name)+'</a>')).join('');
  }
  function fileKind(item) {
    const type=item.shortcutDetails?.targetMimeType || item.mimeType || '';
    if (type.startsWith('image/')) return {icon:'image',name:'GAMBAR'};
    if (type.startsWith('video/')) return {icon:'video',name:'VIDEO'};
    if (type.startsWith('audio/')) return {icon:'video',name:'AUDIO'};
    if (type.includes('pdf')) return {icon:'file',name:'PDF'};
    if (type.includes('presentation') || type.includes('powerpoint')) return {icon:'file',name:'SLAID'};
    if (type.includes('spreadsheet') || type.includes('excel')) return {icon:'grid',name:'HAMPARAN'};
    return {icon:'file',name:'DOKUMEN'};
  }
  function emptyState(title,description='',retry=false,kind='folder') {
    return '<div class="empty-state">'+icon(kind)+'<strong>'+escapeHTML(title)+'</strong>'+(description?'<p>'+escapeHTML(description)+'</p>':'')+(retry?'<button class="btn secondary" data-retry="true">'+icon('refresh')+'Cuba semula</button>':'')+'</div>';
  }
  function renderContents() {
    $('folder-content').classList.toggle('files-list',state.view==='list');
    const search=$('file-search').value.trim().toLocaleLowerCase('ms');
    let items=state.items.filter(x=>String(x.name).toLocaleLowerCase('ms').includes(search));
    const order=$('sort-select').value;
    items.sort(order==='name'?byName:(a,b)=>((Date.parse(a.modifiedTime)||0)-(Date.parse(b.modifiedTime)||0))*(order==='new'?-1:1)||byName(a,b));
    if (!items.length) {
      $('folder-content').innerHTML=emptyState(search?'Tiada padanan ditemui.':'Belum ada bahan dalam folder ini.',search?'Cuba kata carian yang lain.':''); return;
    }
    const folders=items.filter(x=>folderType(x)||isSePKM(x));
    const files=items.filter(x=>!folderType(x)&&!isSePKM(x));
    let html='';
    if(folders.length) html+='<div class="file-section-title"><span>FOLDER &amp; PAUTAN</span><span>'+folders.length+'</span></div><div class="folder-grid">'+folders.map(item=>'<a class="folder-tile" href="'+escapeHTML(isSePKM(item)?SEPKM:routeFor(item.id))+'"><span class="tile-icon">'+icon(isSePKM(item)?'clipboard':'folder')+'</span><div><h3>'+escapeHTML(item.name)+'</h3><small>'+(isSePKM(item)?'SePKM':item.mimeType===SHORTCUT?'Pintasan folder':'Folder')+'</small></div>'+icon(isSePKM(item)?'external':'chevron')+'</a>').join('')+'</div>';
    if(files.length) html+='<div class="file-section-title"><span>DOKUMEN</span><span>'+files.length+'</span></div><div class="file-grid">'+files.map(item=>{
      const type=fileKind(item); const current=state.viewer?.id===item.id;
      return '<button type="button" class="file-tile'+(current?' is-current':'')+'" data-file="'+escapeHTML(item.id)+'" aria-label="Papar '+escapeHTML(item.name)+'"><span class="card-top"><span class="tile-icon">'+icon(type.icon)+'</span><span class="file-type">'+type.name+'</span></span><h3>'+escapeHTML(item.name)+'</h3><span class="file-meta"><time>'+escapeHTML(formatDate(item.modifiedTime))+'</time><span>'+icon('lock')+'</span></span></button>';
    }).join('')+'</div>';
    $('folder-content').innerHTML=html;
  }
  function showSkeleton() { $('folder-content').innerHTML='<div class="skeleton-grid">'+Array(6).fill('<div class="skeleton"></div>').join('')+'</div>'; }
  function setFolder(data) {
    state.folder=data.folder; state.items=data.items || []; state.path=data.path || []; registerItems(state.items);
    $('folder-title').textContent=data.folder.id===ROOT?'Pusat Dokumen':data.folder.name;
    $('top-path').textContent='Portal UBK / '+(data.folder.id===ROOT?'Pusat Dokumen':shortName(data.folder.name));
    $('folder-count').textContent=state.items.length+' bahan';
    $('breadcrumbs').innerHTML=crumbs(state.path);
    document.title=(data.folder.id===ROOT?'Pusat Dokumen':shortName(data.folder.name))+' | OSC UBK SMKBK';
    renderNavigation(); renderContents();
  }
  function closeViewer() {
    state.viewerSerial++; state.viewer=null; clearTimeout(state.frameTimer);
    $('viewer-stage').replaceChildren(); $('viewer-panel').hidden=true;
    if(state.page==='library') renderContents();
  }
  function viewerError(error) {
    const title=error.code==='RESTRICTION_REQUIRED'?'Paparan sahaja belum diaktifkan.':error.code==='PREVIEW_ONLY'?'Pratonton dokumen':error.code==='UNSUPPORTED'?'Pratonton tidak tersedia.':'Dokumen tidak dapat dipaparkan.';
    $('viewer-stage').innerHTML='<div class="viewer-message">'+emptyState(title,error.message,false,error.code==='RESTRICTION_REQUIRED'?'shield':'info')+'</div>';
    $('viewer-revision').textContent=error.code==='RESTRICTION_REQUIRED'?'Fail belum memenuhi tetapan paparan sahaja.':'Paparan dokumen tidak tersedia.';
  }
  function mountViewer(info) {
    const url=new URL(info.previewUrl);
    if(!['drive.google.com','docs.google.com'].includes(url.hostname)||url.protocol!=='https:') throw new PortalError('Sumber dokumen tidak dibenarkan.','INVALID_SOURCE');
    clearTimeout(state.frameTimer);
    const stage=$('viewer-stage'); stage.replaceChildren();
    const loading=document.createElement('div'); loading.className='viewer-loading'; loading.innerHTML='<span class="spinner"></span><span>Memuatkan dokumen...</span>';
    const frame=document.createElement('iframe'); frame.title=info.name || state.viewer?.name || 'Paparan dokumen';
    // No allow-downloads, allow-popups, allow-top-navigation or allow-modals.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    frame.setAttribute('allow',"fullscreen; clipboard-read 'none'; clipboard-write 'none'");
    frame.setAttribute('referrerpolicy','no-referrer'); frame.setAttribute('allowfullscreen','');
    frame.addEventListener('load',()=>{loading.remove();clearTimeout(state.frameTimer);});
    frame.addEventListener('error',()=>{loading.remove();clearTimeout(state.frameTimer);toast('Dokumen belum dapat dimuatkan.');});
    const cover=document.createElement('div'); cover.className='frame-cover'; cover.setAttribute('aria-hidden','true'); cover.innerHTML=icon('lock');
    stage.append(frame,cover,loading);
    frame.src=url.href;
    state.frameTimer=setTimeout(()=>{loading.remove();toast('Dokumen mengambil masa untuk dimuatkan.');},18000);
    $('viewer-revision').textContent=info.modifiedTime?'Dikemas kini: '+formatDate(info.modifiedTime,true):'Paparan dokumen';
  }
  async function openFile(item,{quiet=false,force=false}={}) {
    if(isSePKM(item)){location.assign(SEPKM);return;}
    const serial=++state.viewerSerial;
    const previous=state.viewer;
    state.viewer={...item}; $('viewer-title').textContent=item.name;
    $('viewer-panel').hidden=false;
    if(!quiet) {
      $('viewer-stage').innerHTML='<div class="viewer-loading"><span class="spinner"></span><span>Menyediakan paparan...</span></div>';
      $('viewer-revision').textContent='';
      renderContents();
      requestAnimationFrame(()=>$('viewer-panel').scrollIntoView({behavior:'smooth',block:'start'}));
    }
    try {
      const info=await fileInfo(item);
      if(serial!==state.viewerSerial || state.page!=='library') return;
      state.viewer={...item,...info}; $('viewer-title').textContent=info.name||item.name;
      if(!quiet||force||!previous?.previewUrl||previous.modifiedTime!==info.modifiedTime||previous.previewUrl!==info.previewUrl) mountViewer(info);
    } catch(error) {
      if(serial!==state.viewerSerial) return;
      // A failed permission check closes the previous frame instead of leaving stale content visible.
      state.viewer={...item}; clearTimeout(state.frameTimer); viewerError(error);
    }
  }
  function mobileMenu(open) {
    $('sidebar').classList.toggle('is-open',open); $('mobile-overlay').classList.toggle('is-open',open);
    $('open-menu').setAttribute('aria-expanded',String(open));
    document.body.style.overflow=open?'hidden':'';
    if(open) $('close-menu').focus();
  }
  async function navigate() {
    const route=location.hash || '#home';
    if(route==='#main-content') return;
    const serial=++state.routeSerial;
    state.navAbort?.abort(); state.navAbort=new AbortController();
    mobileMenu(false); closeViewer(); $('file-search').value='';
    if(route==='#home'||route==='#sections') {
      state.page='home'; state.path=[];
      $('home-page').hidden=false; $('library-page').hidden=true;
      $('top-path').textContent='Portal UBK / Laman Utama'; document.title='ONE STOP CENTRE UBK | SMK Buluh Kasap';
      renderNavigation();
      if(route==='#sections') $('sections').scrollIntoView({behavior:'smooth'}); else window.scrollTo({top:0,behavior:'instant'});
      return;
    }
    const match=route.match(/^#folder\/([A-Za-z0-9_-]{10,200})$/);
    const id=route==='#library'?ROOT:match?.[1];
    if(!id){location.replace('#home');return;}
    if(id===SEPKM_ID){location.assign(SEPKM);return;}
    state.page='library';state.folderId=id;state.items=[];state.path=[];
    $('home-page').hidden=true; $('library-page').hidden=false;
    $('folder-title').textContent=state.rootItems.find(x=>x.id===id)?.name || (id===ROOT?'Pusat Dokumen':'Folder');
    $('folder-count').textContent=''; $('breadcrumbs').innerHTML=crumbs([{id:ROOT,name:'Pusat Dokumen'}]);
    renderNavigation(); showSkeleton(); window.scrollTo({top:0,behavior:'instant'});
    try {
      const data=await fetchFolder(id,state.navAbort.signal);
      if(serial!==state.routeSerial) return;
      setFolder(data); statusSuccess();
    } catch(error) {
      if(serial!==state.routeSerial || error.name==='AbortError') return;
      $('folder-content').innerHTML=emptyState(error.code==='PREVIEW_ONLY'?'Pratonton folder':'Folder belum dapat dimuatkan.',error.message,error.code!=='PREVIEW_ONLY','info');
      statusError(error);
    }
  }
  async function refreshAll(manual=false) {
    if(state.busy || document.hidden && !manual) return;
    state.busy=true;state.lastRefresh=Date.now();$('sync-button').disabled=true;
    if(!BOOT.preview) setStatus('busy','Menyemak...');
    const serial=state.routeSerial; const folderId=state.folderId;
    try {
      const root=await fetchFolder(ROOT);
      state.rootItems=root.items; registerItems(root.items);renderNavigation();renderCards();
      if(state.page==='library' && serial===state.routeSerial) {
        const data=folderId===ROOT?root:await fetchFolder(folderId);
        if(serial===state.routeSerial) {
          setFolder(data);
          if(state.viewer) {
            const item=data.items.find(x=>x.id===state.viewer.id);
            if(!item){closeViewer();toast('Dokumen ini tidak lagi tersedia dalam folder.');}
            else await openFile(item,{quiet:true});
          }
        }
      }
      statusSuccess();
      if(manual) toast(BOOT.preview?'Pratonton reka bentuk belum disambungkan.':'Bahan telah diselaraskan.');
    } catch(error) {
      statusError(error);
      if(state.viewer && !BOOT.preview){clearTimeout(state.frameTimer);viewerError(error);}
      if(manual) toast(error.message || 'Sambungan tidak tersedia.');
    } finally {state.busy=false;$('sync-button').disabled=false;}
  }
  async function toggleFullscreen(element) {
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(element.requestFullscreen) await element.requestFullscreen();
      else toast('Paparan penuh tidak disokong oleh pelayar ini.');
    } catch {toast('Paparan penuh tidak tersedia pada peranti ini.');}
  }
  function setView(view) {
    state.view=view;
    $('grid-view').classList.toggle('is-active',view==='grid');$('grid-view').setAttribute('aria-pressed',String(view==='grid'));
    $('list-view').classList.toggle('is-active',view==='list');$('list-view').setAttribute('aria-pressed',String(view==='list'));
    try{localStorage.setItem('osc-view',view);}catch{}
    renderContents();
  }
  $('today').textContent=new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  $('today').dateTime=new Date().toISOString();
  $('nav-search').addEventListener('input',renderNavigation);
  $('file-search').addEventListener('input',renderContents);
  $('sort-select').addEventListener('change',renderContents);
  $('grid-view').addEventListener('click',()=>setView('grid'));
  $('list-view').addEventListener('click',()=>setView('list'));
  $('folder-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-file]');
    if(button){const item=state.items.find(x=>x.id===button.dataset.file);if(item) openFile(item);}
    if(event.target.closest('[data-retry]')) navigate();
  });
  $('back-folder').addEventListener('click',()=>{const parent=state.path.at(-2);location.hash=parent?routeFor(parent.id):'#home';});
  $('open-menu').addEventListener('click',()=>mobileMenu(true));
  $('close-menu').addEventListener('click',()=>mobileMenu(false));
  $('mobile-overlay').addEventListener('click',()=>mobileMenu(false));
  $('sidebar').addEventListener('click',event=>{if(event.target.closest('a'))mobileMenu(false);});
  $('sync-button').addEventListener('click',()=>refreshAll(true));
  $('fullscreen-button').addEventListener('click',()=>toggleFullscreen(document.documentElement));
  $('expand-viewer').addEventListener('click',()=>toggleFullscreen($('viewer-panel')));
  $('close-viewer').addEventListener('click',closeViewer);
  $('reload-viewer').addEventListener('click',()=>{if(state.viewer)openFile(state.viewer,{force:true});});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if($('sidebar').classList.contains('is-open')){mobileMenu(false);$('open-menu').focus();}else if(!document.fullscreenElement)closeViewer();}
    const editing=event.target.matches('input,textarea,[contenteditable="true"]');
    if(!editing && state.viewer && (event.ctrlKey||event.metaKey) && ['c','x','s','p'].includes(event.key.toLowerCase())){event.preventDefault();toast('Dokumen ini untuk paparan sahaja.');}
    // Keep keyboard navigation inside the mobile navigation while it is open.
    if(event.key==='Tab' && $('sidebar').classList.contains('is-open')){
      const nodes=[...$('sidebar').querySelectorAll('a,button,input')].filter(x=>x.offsetParent!==null);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  for(const type of ['contextmenu','copy','cut','dragstart']) $('viewer-panel').addEventListener(type,event=>event.preventDefault());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-state.lastRefresh>10000) refreshAll();});
  window.addEventListener('focus',()=>{if(Date.now()-state.lastRefresh>10000)refreshAll();});
  window.addEventListener('online',()=>refreshAll());
  window.addEventListener('offline',()=>statusError(new PortalError('Sambungan Internet terputus.')));
  window.addEventListener('hashchange',navigate);
  window.addEventListener('resize',()=>{if(innerWidth>760)mobileMenu(false);});
  try{if(localStorage.getItem('osc-view')==='list')setView('list');}catch{}
  renderNavigation(); renderCards(); navigate(); refreshAll();
  setInterval(()=>refreshAll(),60000);
})();
