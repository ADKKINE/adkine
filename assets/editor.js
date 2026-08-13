/* ============================================================
   ADKINE — live visual editor
   Loads only when the URL has ?edit — visitors never download it.
   Edits the real page in place, commits to GitHub on Save.
   ============================================================ */
(() => {
  const REPO   = 'ADKKINE/adkine';
  const BRANCH = 'main';
  const AUTH   = 'https://sveltia-cms-auth.adratzabi.workers.dev';
  const API    = 'https://api.github.com';

  let token = null;
  let dirty = false;
  const D = () => window.ADKINE.data;

  /* ---------- path helpers ---------- */
  const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  const set = (o, p, v) => {
    const ks = p.split('.'), last = ks.pop();
    ks.reduce((a, k) => a[k], o)[last] = v;
  };

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
    .ed-bar{position:fixed;top:0;left:0;right:0;height:56px;z-index:10000;
      background:#16181C;color:#F0E9DC;display:flex;align-items:center;
      justify-content:space-between;padding:0 20px;font:500 12px/1 Inter,sans-serif;
      letter-spacing:.14em;text-transform:uppercase}
    .ed-bar .grp{display:flex;gap:10px;align-items:center}
    .ed-btn{background:none;border:1px solid rgba(240,233,220,.35);color:#F0E9DC;
      padding:10px 18px;font:500 11px/1 Inter,sans-serif;letter-spacing:.16em;
      text-transform:uppercase;cursor:pointer;border-radius:2px;transition:.25s}
    .ed-btn:hover{background:rgba(240,233,220,.12)}
    .ed-btn.pri{background:#2E4057;border-color:#2E4057}
    .ed-btn.pri:hover{background:#93AEC9;color:#16181C}
    .ed-btn:disabled{opacity:.4;cursor:default}
    body.ed-on{padding-top:56px}
    body.ed-on nav{top:56px}
    [data-path]{outline:1px dashed transparent;transition:outline-color .2s;
      border-radius:2px;cursor:text}
    body.ed-on [data-path]:hover{outline-color:rgba(147,174,201,.9)}
    body.ed-on [data-path]:focus{outline:2px solid #2E4057;background:rgba(147,174,201,.10)}
    body.ed-on [data-media]{position:relative}
    .ed-tag{position:absolute;z-index:50;top:8px;left:8px;display:flex;gap:6px}
    .ed-chip{background:rgba(22,24,28,.86);color:#F0E9DC;border:0;
      font:500 9px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;
      padding:7px 10px;border-radius:2px;cursor:pointer;backdrop-filter:blur(6px)}
    .ed-chip:hover{background:#2E4057}
    .ed-chip.del{background:rgba(139,0,0,.8)}
    .ed-add{display:block;width:100%;margin-top:18px;padding:16px;
      border:1px dashed rgba(46,64,87,.4);background:none;color:#2E4057;
      font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}
    .ed-add:hover{background:rgba(147,174,201,.12)}
    .ed-panel{position:fixed;top:56px;right:0;width:260px;bottom:0;z-index:9999;
      background:#FCFAF7;border-left:1px solid rgba(46,64,87,.18);padding:22px;
      overflow:auto;font:400 12px/1.6 Inter,sans-serif;transform:translateX(100%);
      transition:transform .35s cubic-bezier(.22,1,.36,1)}
    .ed-panel.open{transform:none}
    .ed-panel h4{font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;
      text-transform:uppercase;color:#2E4057;margin:0 0 14px}
    .ed-row{display:flex;justify-content:space-between;align-items:center;
      padding:7px 0;border-bottom:1px solid rgba(46,64,87,.09)}
    .ed-row input[type=color]{width:34px;height:24px;border:0;background:none;cursor:pointer}
    .ed-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:10001;background:#16181C;color:#F0E9DC;padding:14px 26px;border-radius:3px;
      font:400 12px/1 Inter,sans-serif;letter-spacing:.06em;opacity:0;
      transition:opacity .3s;pointer-events:none}
    .ed-toast.show{opacity:1}
  `;
  document.head.appendChild(css);

  /* ---------- toast ---------- */
  const toast = document.createElement('div');
  toast.className = 'ed-toast';
  document.body.appendChild(toast);
  let tId;
  const say = (m, ms = 2600) => {
    toast.textContent = m; toast.classList.add('show');
    clearTimeout(tId); tId = setTimeout(() => toast.classList.remove('show'), ms);
  };

  /* ---------- top bar ---------- */
  const bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.innerHTML = `
    <div class="grp"><strong style="letter-spacing:.2em">ADKINE · EDIT</strong></div>
    <div class="grp">
      <button class="ed-btn" id="edColors">Colours</button>
      <button class="ed-btn" id="edExit">Exit</button>
      <button class="ed-btn pri" id="edSave" disabled>Saved</button>
    </div>`;
  document.body.appendChild(bar);
  document.body.classList.add('ed-on');

  const saveBtn = bar.querySelector('#edSave');
  const markDirty = () => {
    dirty = true; saveBtn.disabled = false; saveBtn.textContent = 'Publish';
  };

  bar.querySelector('#edExit').onclick = () => {
    if (dirty && !confirm('You have unpublished changes. Leave anyway?')) return;
    location.href = location.pathname;
  };

  /* ---------- colours panel ---------- */
  const panel = document.createElement('div');
  panel.className = 'ed-panel';
  document.body.appendChild(panel);
  const labels = { blue:'Pastel blue', navy:'Deep blue', beige:'Beige',
                   beigePale:'Beige pale', bluePale:'Blue pale', white:'White', black:'Black' };
  function buildPanel() {
    panel.innerHTML = '<h4>Colours</h4>' + Object.keys(labels).map(k =>
      `<div class="ed-row"><span>${labels[k]}</span>
       <input type="color" data-c="${k}" value="${D().theme[k]}"></div>`).join('');
    panel.querySelectorAll('input[data-c]').forEach(i => {
      i.oninput = () => {
        D().theme[i.dataset.c] = i.value;
        window.ADKINE.applyTheme(D().theme);
        markDirty();
      };
    });
  }
  bar.querySelector('#edColors').onclick = () => panel.classList.toggle('open');

  /* ---------- text editing ---------- */
  function wireText() {
    document.querySelectorAll('[data-path]').forEach(el => {
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.oninput = () => { set(D(), el.dataset.path, el.innerText.trim()); markDirty(); };
      el.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); } };
      el.onclick = e => e.stopPropagation();
    });
  }

  /* ---------- media slots ---------- */
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'image/*';
  filePicker.style.display = 'none';
  document.body.appendChild(filePicker);

  function pickImage(path) {
    filePicker.value = '';
    filePicker.onchange = async () => {
      const f = filePicker.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) return say('Image too large — keep under 8 MB');
      say('Uploading ' + f.name + '…', 8000);
      try {
        const b64 = await toBase64(f);
        const name = Date.now() + '-' + f.name.replace(/[^\w.\-]/g, '_');
        await putFile('assets/uploads/' + name, b64, 'Upload ' + name);
        set(D(), path, '/assets/uploads/' + name);
        markDirty();
        redraw();
        say('Image added');
      } catch (err) { say('Upload failed: ' + err.message, 5000); }
    };
    filePicker.click();
  }

  function wireMedia() {
    document.querySelectorAll('[data-media]').forEach(el => {
      const path = el.dataset.media;
      const kind = el.dataset.kind || 'image';
      const tag = document.createElement('div');
      tag.className = 'ed-tag';
      const btns = [`<button class="ed-chip" data-a="img">${get(D(), path) ? 'Replace' : 'Add'} photo</button>`];
      if (kind === 'project') btns.push('<button class="ed-chip" data-a="vid">Video link</button>');
      if (el.dataset.del) btns.push('<button class="ed-chip del" data-a="del">Delete</button>');
      tag.innerHTML = btns.join('');
      el.appendChild(tag);

      tag.querySelectorAll('.ed-chip').forEach(b => {
        b.onclick = e => {
          e.stopPropagation(); e.preventDefault();
          const a = b.dataset.a;
          if (a === 'img') pickImage(path);
          if (a === 'vid') {
            const vp = el.dataset.videoPath;
            const cur = get(D(), vp) || '';
            const v = prompt('Paste the YouTube or Vimeo EMBED link:\n\nhttps://www.youtube.com/embed/XXXX\nhttps://player.vimeo.com/video/XXXX', cur);
            if (v !== null) { set(D(), vp, v.trim()); markDirty(); redraw(); }
          }
          if (a === 'del') {
            const [lp, i] = splitIndex(el.dataset.del);
            get(D(), lp).splice(+i, 1);
            markDirty(); redraw();
          }
        };
      });
    });
  }
  const splitIndex = s => { const i = s.lastIndexOf('.'); return [s.slice(0, i), s.slice(i + 1)]; };

  /* ---------- add buttons ---------- */
  function wireAdders() {
    addBtn('#work .work-grid', 'Add project', () => {
      D().work.projects.push({ title:'New Project', category:'Category', thumbnail:'', videoUrl:'' });
    });
    addBtn('#gallery .g-grid', 'Add photo', () => {
      D().gallery.photos.push({ image:'', alt:'New photo' });
    });
    addBtn('#services .s-grid', 'Add service', () => {
      D().services.items.push({ number:String(D().services.items.length+1).padStart(2,'0'),
        title:'New Service', description:'Describe it.', bullets:['Point one'] });
    });
  }
  function addBtn(sel, label, fn) {
    const host = document.querySelector(sel);
    if (!host) return;
    const b = document.createElement('button');
    b.className = 'ed-add'; b.textContent = '+ ' + label;
    b.onclick = () => { fn(); markDirty(); redraw(); };
    host.parentNode.insertBefore(b, host.nextSibling);
  }

  /* ---------- redraw ---------- */
  function redraw() {
    const y = scrollY;
    window.ADKINE.render(D());
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
    wireText(); wireMedia(); wireAdders();
    scrollTo(0, y);
  }

  /* ---------- GitHub ---------- */
  const toBase64 = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  async function gh(path, opts = {}) {
    const r = await fetch(API + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(opts.headers||{}) }
    });
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message || r.status);
    return r.json();
  }

  async function putFile(path, contentB64, message) {
    let sha;
    try { sha = (await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`)).sha; } catch {}
    return gh(`/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: contentB64, branch: BRANCH, ...(sha ? { sha } : {}) })
    });
  }

  const utf8b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

  saveBtn.onclick = async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Publishing…';
    try {
      await putFile('content/site.json', utf8b64(JSON.stringify(D(), null, 2)), 'Update site content');
      dirty = false; saveBtn.textContent = 'Saved';
      say('Published — live in about 30 seconds', 4000);
    } catch (e) {
      saveBtn.disabled = false; saveBtn.textContent = 'Publish';
      say('Failed: ' + e.message, 5000);
    }
  };

  /* ---------- login ---------- */
  function login() {
    return new Promise((res, rej) => {
      const w = open(`${AUTH}/auth?provider=github&site_id=${location.hostname}&scope=repo`,
                     'gh-auth', 'width=680,height=760');
      if (!w) return rej(new Error('Popup blocked — allow popups and reload'));
      const onMsg = e => {
        if (typeof e.data !== 'string') return;
        if (e.data.startsWith('authorizing:github')) { w.postMessage(e.data, e.origin); return; }
        if (e.data.startsWith('authorization:github:success:')) {
          removeEventListener('message', onMsg);
          try { res(JSON.parse(e.data.split('authorization:github:success:')[1]).token); }
          catch (err) { rej(err); }
          w.close();
        }
        if (e.data.startsWith('authorization:github:error:')) {
          removeEventListener('message', onMsg); w.close();
          rej(new Error('Sign-in failed'));
        }
      };
      addEventListener('message', onMsg);
    });
  }

  /* ---------- boot ---------- */
  (async () => {
    say('Signing in with GitHub…', 20000);
    try {
      token = await login();
      say('Click any text to edit it', 4000);
      buildPanel(); redraw();
      addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    } catch (e) {
      say(e.message, 8000);
    }
  })();
})();
