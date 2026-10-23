(() => {
  const cfg = window.RAB_GOOGLE_CONFIG || { clientId: "136241267526-601ogh33oo9eem6lv6dl1c3k332ljjsp.apps.googleusercontent.com" };
  let token = '';
  let email = '';
  let driveFileId = localStorage.getItem('rabGoogleDriveFileId') || '';
  let syncing = false;
  let syncAgain = false;
  let lastSnapshot = '';
  let tokenClient = null;
  let tokenWaiter = null;
  const fileName = 'RAB Studio - Data Proyek.json';
  const scopes = 'openid email https://www.googleapis.com/auth/drive.file';

  const style = document.createElement('style');
  style.textContent = `
    body.google-locked{overflow:hidden} body.google-locked .app{display:none!important}
    #googleGate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:linear-gradient(135deg,#0d1a22,#17323a);font:14px/1.5 "Segoe UI",Arial,sans-serif;color:#14232c}
    #googleGate[hidden]{display:none}.google-box{width:min(470px,100%);background:#f8fbfa;border:1px solid #cbdad9;border-radius:14px;padding:28px;box-shadow:0 25px 80px #0005}
    .google-logo{font:700 11px Consolas,monospace;letter-spacing:.14em;color:#087e80}.google-box h1{font-size:25px;margin:10px 0 5px}.google-intro{color:#64777a;font-size:12px;margin:0 0 18px}
    .google-actions{display:flex;gap:8px;margin-top:17px}.google-actions button{border:1px solid #087e80;border-radius:7px;padding:11px 14px;background:#087e80;color:white;cursor:pointer;font-weight:700}.google-actions button:disabled{opacity:.6;cursor:wait}
    .google-message{min-height:20px;margin-top:12px;color:#53676b;font-size:11px}.google-message.error{color:#a43d36}.google-foot{font-size:10px;color:#879694;margin-top:14px}.google-local{margin-top:14px;border:1px solid #cfdddc;border-radius:7px;padding:9px 12px;background:white;color:#18343a;cursor:pointer;font-size:11px}
    #googleSyncBadge{position:fixed;right:14px;bottom:12px;z-index:9998;background:#132630;color:#d7eceb;border:1px solid #31525a;border-radius:7px;padding:7px 10px;font:10px Consolas,monospace;box-shadow:0 4px 14px #0002}
  `;
  document.head.appendChild(style);
  document.body.classList.add('google-locked');
  const gate = document.createElement('section'); gate.id = 'googleGate';
  gate.innerHTML = `<div class="google-box"><div class="google-logo">RAB STUDIO · GOOGLE DRIVE</div><h1>Hubungkan Google</h1><p class="google-intro">Masuk dengan akun Google Anda. Data proyek disimpan sebagai berkas pribadi di Drive akun tersebut.</p><div class="google-actions"><button id="googleConnect" type="button">Hubungkan akun Google</button></div><div id="googleMessage" class="google-message"></div><div class="google-foot" id="googleFoot">Aplikasi hanya meminta akses ke berkas yang dibuat atau dibukakan melalui aplikasi ini. Anda dapat mencabut akses dari Akun Google.</div><button id="googleLocal" class="google-local" type="button" hidden>Buka mode lokal di browser ini</button></div>`;
  document.body.appendChild(gate);
  const message = (text, error = false) => { const el = document.getElementById('googleMessage'); el.textContent = text; el.classList.toggle('error', error); };
  const parseLocal = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; } };
  const localData = () => ({ version: 1, projects: parseLocal('rabProjectHistory', []), catalog: parseLocal('rabCatalog', []), companyProfile: parseLocal('rabCompanyProfile', {}), updatedAt: new Date().toISOString() });
  const snapshot = () => JSON.stringify({ projects: parseLocal('rabProjectHistory', []), catalog: parseLocal('rabCatalog', []), companyProfile: parseLocal('rabCompanyProfile', {}) });
  const api = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) } });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status === 401) { token = ''; throw new Error('Sesi Google berakhir. Klik Hubungkan Google lagi.'); }
      throw new Error('Google Drive (' + response.status + '): ' + (detail.slice(0, 240) || response.statusText));
    }
    if (response.status === 204) return null;
    return response.json();
  };
  async function findDataFile() {
    if (driveFileId) {
      try { return await api('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(driveFileId) + '?fields=id,name,trashed'); }
      catch { driveFileId = ''; localStorage.removeItem('rabGoogleDriveFileId'); }
    }
    const q = "name = '" + fileName.replace(/'/g, "\\'") + "' and trashed = false";
    const params = new URLSearchParams({ q, spaces: 'drive', pageSize: '20', fields: 'files(id,name,modifiedTime)' });
    const result = await api('https://www.googleapis.com/drive/v3/files?' + params.toString());
    const file = (result.files || []).sort((a,b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')))[0];
    if (file) { driveFileId = file.id; localStorage.setItem('rabGoogleDriveFileId', file.id); }
    return file || null;
  }
  async function readFile(id) {
    const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Tidak bisa membaca berkas data dari Drive (' + response.status + ').');
    return response.json();
  }
  async function uploadNewFile(payload) {
    const boundary = 'rabstudio_' + Math.random().toString(16).slice(2);
    const body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify({ name: fileName, mimeType: 'application/json' }),
      '\r\n--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(payload),
      '\r\n--' + boundary + '--'
    ], { type: 'multipart/related; boundary=' + boundary });
    const result = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
    driveFileId = result.id; localStorage.setItem('rabGoogleDriveFileId', result.id);
    return result;
  }
  async function updateFile(payload) {
    const result = await api('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(driveFileId) + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(payload) });
    return result;
  }
  async function resumableUpload(payload, create) {
    const content = JSON.stringify(payload);
    const metadata = create ? { name: fileName, mimeType: 'application/json' } : {};
    const endpoint = create
      ? 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'
      : 'https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(driveFileId) + '?uploadType=resumable';
    const start = await fetch(endpoint, { method: create ? 'POST' : 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json', 'X-Upload-Content-Length': String(new Blob([content]).size) }, body: JSON.stringify(metadata) });
    if (!start.ok) throw new Error('Google Drive gagal memulai unggahan (' + start.status + ').');
    const sessionUrl = start.headers.get('Location');
    if (!sessionUrl) throw new Error('Google Drive tidak mengembalikan alamat sesi unggahan. Coba hubungkan ulang.');
    const finish = await fetch(sessionUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: content });
    if (!finish.ok) throw new Error('Google Drive gagal menyimpan data (' + finish.status + ').');
    const result = await finish.json();
    if (create && result.id) { driveFileId = result.id; localStorage.setItem('rabGoogleDriveFileId', result.id); }
    return result;
  }
  async function saveCloudData(payload, create = false) {
    const size = new Blob([JSON.stringify(payload)]).size;
    if (size > 4 * 1024 * 1024) return resumableUpload(payload, !driveFileId || create);
    if (!driveFileId || create) await uploadNewFile(payload); else await updateFile(payload);
  }

  function applyDataToApp(dataDoc) {
    localStorage.setItem('rabProjectHistory', JSON.stringify(Array.isArray(dataDoc.projects) ? dataDoc.projects : []));
    localStorage.setItem('rabCatalog', JSON.stringify(Array.isArray(dataDoc.catalog) ? dataDoc.catalog : []));
    localStorage.setItem('rabCompanyProfile', JSON.stringify(dataDoc.companyProfile && typeof dataDoc.companyProfile === 'object' ? dataDoc.companyProfile : {}));
    savedProjects = parseLocal('rabProjectHistory', []);
    const onlineCatalog = parseLocal('rabCatalog', null); if (Array.isArray(onlineCatalog)) catalog = onlineCatalog;
    companyProfile = { ...companyProfile, ...parseLocal('rabCompanyProfile', {}) }; applyCompanyProfile();
    const latest = savedProjects.slice().sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0];
    projectObserver.disconnect();
    if (latest) { overviewSelectionInProgress = true; applySavedProject(latest); overviewSelectionInProgress = false; }
    else { activeProjectId = null; data.splice(0, data.length); categoryOrder = []; draw(); }
    watchProjectMutations(); openSummary();
    document.querySelectorAll('.nav').forEach(item => item.classList.toggle('on', item.dataset.nav === 'summary'));
  }
  async function connectWithToken(accessToken) {
    token = accessToken; message('Menghubungkan ke Google Drive…');
    try {
      const account = await api('https://www.googleapis.com/oauth2/v3/userinfo'); email = account.email || '';
      const file = await findDataFile();
      if (file) { const remote = await readFile(file.id); applyDataToApp(remote); }
      else { const initial = localData(); await saveCloudData(initial, true); applyDataToApp(initial); }
      document.body.classList.remove('google-locked'); gate.hidden = true;
      const badge = document.createElement('button'); badge.id = 'googleSyncBadge'; badge.type = 'button'; badge.textContent = '● DRIVE · ' + (email || 'TERSAMBUNG'); badge.title = 'Klik untuk melepas koneksi Google'; badge.style.cursor = 'pointer';
      badge.addEventListener('click', () => { if (confirm('Lepas koneksi Google pada browser ini?')) { token = ''; document.body.classList.add('google-locked'); gate.hidden = false; message('Koneksi dilepas. Data tetap tersimpan di Drive.'); badge.remove(); } });
      document.body.appendChild(badge); lastSnapshot = snapshot(); message('');
    } catch (error) { token = ''; message(error.message || 'Koneksi ke Drive gagal.', true); }
  }
  async function syncNow() {
    if (!token || syncing) { if (syncing) syncAgain = true; return; }
    const snap = snapshot(); if (snap === lastSnapshot) return;
    syncing = true; const badge = document.getElementById('googleSyncBadge'); if (badge) badge.textContent = '◌ MENYIMPAN…';
    try { await saveCloudData(localData()); lastSnapshot = snap; if (badge) badge.textContent = '● DRIVE · ' + (email || 'TERSINKRON'); }
    catch (error) { if (badge) badge.textContent = '! DRIVE GAGAL'; if (!token) { document.body.classList.add('google-locked'); gate.hidden = false; } message(error.message, true); }
    finally { syncing = false; if (syncAgain) { syncAgain = false; setTimeout(syncNow, 300); } }
  }

  document.getElementById('googleLocal').addEventListener('click', () => { document.body.classList.remove('google-locked'); gate.hidden = true; });
  document.getElementById('googleConnect').addEventListener('click', () => {
    if (!cfg.clientId) { message('Google OAuth belum dikonfigurasi. Isi Client ID di config.js dan ikuti README.', true); return; }
    if (!window.google?.accounts?.oauth2) { message('Layanan login Google belum termuat. Pastikan browser tersambung ke internet, lalu muat ulang.', true); return; }
    tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: cfg.clientId, scope: scopes, callback: response => { if (response.error) { message('Izin Google belum diberikan: ' + response.error, true); return; } connectWithToken(response.access_token); }, error_callback: error => message(error.message || 'Jendela login Google tidak dapat dibuka.', true) });
    tokenClient.requestAccessToken({ prompt: '' });
  });

  if (!cfg.clientId) {
    message('Google OAuth belum diatur. Lengkapi Client ID di config.js sesuai panduan README.', true);
    document.getElementById('googleFoot').textContent = 'Setelah konfigurasi OAuth, tombol ini akan meminta izin Google secara resmi.';
    document.getElementById('googleLocal').hidden = false;
  }
  setInterval(syncNow, 1800);
  window.addEventListener('storage', () => setTimeout(syncNow, 150));
  window.addEventListener('beforeunload', () => { if (token) syncNow(); });
})();


