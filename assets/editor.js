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
    .ed-panel{position:fixed;top:56px;right:0;width:300px;bottom:0;z-index:9999;
      background:#FCFAF7;border-left:1px solid rgba(46,64,87,.18);padding:22px;
      overflow:auto;font:400 12px/1.6 Inter,sans-serif;transform:translateX(100%);
      transition:transform .35s cubic-bezier(.22,1,.36,1)}
    .ed-panel.open{transform:none}
    .ed-panel h4{font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;
      text-transform:uppercase;color:#2E4057;margin:0 0 14px}
    .ed-row{display:flex;justify-content:space-between;align-items:center;
      padding:7px 0;border-bottom:1px solid rgba(46,64,87,.09)}
    .ed-row input[type=color]{width:34px;height:24px;border:0;background:none;cursor:pointer}
    .ed-panel h4{margin-top:26px}
    .ed-panel h4:first-child{margin-top:0}
    .ed-field{padding:11px 0;border-bottom:1px solid rgba(46,64,87,.09)}
    .ed-field label{display:flex;justify-content:space-between;align-items:baseline;
      font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2E4057;
      font-weight:500;margin-bottom:7px}
    .ed-field label b{font-weight:400;color:rgba(35,38,44,.55);text-transform:none;letter-spacing:0}
    .ed-field select{width:100%;padding:8px 9px;border:1px solid rgba(46,64,87,.2);
      background:#fff;font-family:inherit;font-size:13px;color:#23262C;border-radius:2px}
    .ed-field input[type=range]{width:100%;accent-color:#2E4057}
    .ed-preview{font-size:22px;line-height:1.15;color:#16181C;margin-top:8px;
      padding:10px 0;border-top:1px solid rgba(46,64,87,.09)}
    .ed-reset{width:100%;margin-top:22px;padding:12px;border:1px solid rgba(46,64,87,.3);
      background:none;font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;
      text-transform:uppercase;color:#2E4057;cursor:pointer;border-radius:2px}
    .ed-reset:hover{background:#2E4057;color:#FCFAF7}
    .ed-guides{position:fixed;inset:0;z-index:9998;pointer-events:none}
    .ed-ins{position:fixed;background:#2E4057;border-radius:2px;box-shadow:0 0 0 2px rgba(46,64,87,.22);display:none}
    .ed-ins::before,.ed-ins::after{content:'';position:absolute;width:7px;height:7px;
      background:#2E4057;border-radius:50%}
    .ed-ins.x::before{left:-3px;top:-4px}.ed-ins.x::after{left:-3px;bottom:-4px}
    .ed-ins.y::before{top:-3px;left:-4px}.ed-ins.y::after{top:-3px;right:-4px}
    .ed-g{position:fixed;background:rgba(147,174,201,.85);display:none}
    .ed-g.h{height:1px;left:0;right:0}
    .ed-g.v{width:1px;top:0;bottom:0}
    .ed-drag{opacity:.35!important}
    body.ed-free [data-move]{outline:1px dashed rgba(147,174,201,.75);cursor:move}
    body.ed-free [data-move]:hover{outline:1px solid #2E4057;background:rgba(147,174,201,.07)}
    body.ed-free [data-path]{cursor:move}
    .ed-moving{outline:2px solid #2E4057!important;z-index:70;position:relative}
    .ed-snap{position:fixed;background:#8B0000;display:none;z-index:9998;pointer-events:none}
    .ed-snap.h{height:1px;left:0;right:0}
    .ed-snap.v{width:1px;top:0;bottom:0}
    .ed-pos{position:fixed;z-index:10001;background:#16181C;color:#F0E9DC;
      font:400 11px/1 Inter,sans-serif;padding:6px 9px;border-radius:2px;display:none}
    .ed-grab{cursor:grab}
    .ed-sec-h{position:absolute;top:14px;left:5vw;z-index:60}
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
      <button class="ed-btn" id="edFree">Free move: off</button>
      <button class="ed-btn" id="edLogin">Sign in</button>
      <button class="ed-btn" id="edColors">Design</button>
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

  const DISPLAY_FONTS = ['Cormorant Garamond','Playfair Display','DM Serif Display',
                         'Bodoni Moda','Marcellus','Italiana','Libre Baskerville',
                         'Syne','Space Grotesk'];
  const BODY_FONTS    = ['Inter','DM Sans','Work Sans','Manrope','Karla','Jost','IBM Plex Sans'];

  const STYLE_DEFAULTS = { displayFont:'Cormorant Garamond', bodyFont:'Inter',
                           headScale:1, bodyScale:1, spaceScale:1, tracking:-0.02 };

  const sliders = [
    { key:'headScale',  label:'Heading size',   min:0.6,  max:1.6,  step:0.02, fmt:v=>Math.round(v*100)+'%' },
    { key:'bodyScale',  label:'Text size',      min:0.8,  max:1.5,  step:0.02, fmt:v=>Math.round(v*100)+'%' },
    { key:'tracking',   label:'Letter spacing', min:-0.06,max:0.12, step:0.005,fmt:v=>v.toFixed(3)+'em' },
    { key:'spaceScale', label:'Section spacing',min:0.5,  max:1.8,  step:0.05, fmt:v=>Math.round(v*100)+'%' },
  ];

  const S = () => (D().style ||= {});
  const sv = k => S()[k] ?? STYLE_DEFAULTS[k];

  function buildPanel() {
    const opts = (list, cur) => list.map(f =>
      `<option value="${f}"${f===cur?' selected':''}>${f}</option>`).join('');

    panel.innerHTML = `
      <h4>Fonts</h4>
      <div class="ed-field">
        <label>Headings <b>display</b></label>
        <select data-f="displayFont">${opts(DISPLAY_FONTS, sv('displayFont'))}</select>
        <div class="ed-preview" id="pvHead">Cinematic work</div>
      </div>
      <div class="ed-field">
        <label>Body text <b>everything else</b></label>
        <select data-f="bodyFont">${opts(BODY_FONTS, sv('bodyFont'))}</select>
        <div class="ed-preview" id="pvBody" style="font-size:14px">
          Video production and motion design.</div>
      </div>

      <h4>Size &amp; spacing</h4>
      ${sliders.map(s => `
        <div class="ed-field">
          <label>${s.label} <b id="v-${s.key}">${s.fmt(sv(s.key))}</b></label>
          <input type="range" data-s="${s.key}" min="${s.min}" max="${s.max}"
                 step="${s.step}" value="${sv(s.key)}">
        </div>`).join('')}

      <h4>Colours</h4>
      ${Object.keys(labels).map(k =>
        `<div class="ed-row"><span>${labels[k]}</span>
         <input type="color" data-c="${k}" value="${D().theme[k]}"></div>`).join('')}

      <button class="ed-reset" id="edResetStyle">Reset design to default</button>
    `;

    const refreshPreview = () => {
      const st = window.ADKINE.FONT_STACK;
      panel.querySelector('#pvHead').style.fontFamily = st[sv('displayFont')] || 'serif';
      panel.querySelector('#pvBody').style.fontFamily = st[sv('bodyFont')] || 'sans-serif';
    };

    panel.querySelectorAll('select[data-f]').forEach(sel => {
      sel.onchange = () => {
        S()[sel.dataset.f] = sel.value;
        window.ADKINE.applyStyle(D());
        refreshPreview(); markDirty();
      };
    });

    panel.querySelectorAll('input[data-s]').forEach(r => {
      r.oninput = () => {
        const key = r.dataset.s, val = parseFloat(r.value);
        S()[key] = val;
        const meta = sliders.find(s => s.key === key);
        panel.querySelector('#v-' + key).textContent = meta.fmt(val);
        window.ADKINE.applyStyle(D());
        markDirty();
      };
    });

    panel.querySelectorAll('input[data-c]').forEach(i => {
      i.oninput = () => {
        D().theme[i.dataset.c] = i.value;
        window.ADKINE.applyTheme(D().theme);
        markDirty();
      };
    });

    panel.querySelector('#edResetStyle').onclick = () => {
      if (!confirm('Reset fonts, sizes and spacing to the original design?')) return;
      D().style = { ...STYLE_DEFAULTS };
      window.ADKINE.applyStyle(D());
      buildPanel(); panel.classList.add('open');
      markDirty(); say('Design reset');
    };

    refreshPreview();
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
    if (!token) return say('Sign in first — button at the top right', 4000);
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
      if (kind === 'project') {
        const has = el.dataset.hasvideo;
        btns.push(`<button class="ed-chip" data-a="vid" ${has ? 'style="background:#2E4057"' : ''}>${has ? '✓ Video' : 'Video link'}</button>`);
      }
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
            const v = prompt('Paste any YouTube or Vimeo link — the normal one from the address bar is fine.\n\nLeave empty to remove the video.', cur);
            if (v !== null) {
              const url = v.trim();
              set(D(), vp, url);
              markDirty(); redraw();
              say(url ? 'Video added' : 'Video removed');
            }
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

  /* ============================================================
     DRAG TO REORDER + GUIDE LINES
     ============================================================ */
  const layer = document.createElement('div');
  layer.className = 'ed-guides';
  layer.innerHTML = `<div class="ed-ins"></div>
    <div class="ed-g h" id="gT"></div><div class="ed-g h" id="gB"></div>
    <div class="ed-g v" id="gL"></div><div class="ed-g v" id="gR"></div>`;
  document.body.appendChild(layer);
  const ins = layer.querySelector('.ed-ins');
  const gT = layer.querySelector('#gT'), gB = layer.querySelector('#gB');
  const gL = layer.querySelector('#gL'), gR = layer.querySelector('#gR');

  let drag = null, drop = null;

  function showGuides(r, after, axis) {
    // alignment guides along the target's edges
    gT.style.top = r.top + 'px';      gT.style.display = 'block';
    gB.style.top = r.bottom + 'px';   gB.style.display = 'block';
    gL.style.left = r.left + 'px';    gL.style.display = 'block';
    gR.style.left = r.right + 'px';   gR.style.display = 'block';
    // insertion line
    ins.className = 'ed-ins ' + axis;
    if (axis === 'x') {
      ins.style.left = (after ? r.right + 6 : r.left - 8) + 'px';
      ins.style.top = r.top + 'px';
      ins.style.width = '3px';
      ins.style.height = r.height + 'px';
    } else {
      ins.style.left = r.left + 'px';
      ins.style.top = (after ? r.bottom + 4 : r.top - 6) + 'px';
      ins.style.height = '3px';
      ins.style.width = r.width + 'px';
    }
    ins.style.display = 'block';
  }
  function clearGuides() {
    [ins, gT, gB, gL, gR].forEach(e => e.style.display = 'none');
  }

  /** Make the children of `container` reorderable. */
  function sortable(container, itemSel, axis, listPath, onMove) {
    if (!container) return;
    const items = [...container.querySelectorAll(itemSel)];
    items.forEach((el, i) => {
      el.dataset.sortIdx = i;

      // drag only from the handle, so text editing keeps working
      const handle = document.createElement('button');
      handle.className = 'ed-chip ed-grab';
      handle.textContent = '⠿ Move';
      handle.title = 'Drag to reorder';
      handle.onmousedown = () => { el.draggable = true; };
      handle.onmouseup = () => { el.draggable = false; };
      handle.onclick = e => { e.preventDefault(); e.stopPropagation(); };

      let tag = el.querySelector(':scope > .ed-tag') || el.querySelector('.ed-tag');
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'ed-tag';
        el.style.position = el.style.position || 'relative';
        el.appendChild(tag);
      }
      tag.appendChild(handle);

      el.addEventListener('dragstart', e => {
        drag = { container, listPath, from: i, onMove };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
        el.classList.add('ed-drag');
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('ed-drag');
        el.draggable = false;
        clearGuides(); drag = null; drop = null;
      });
      el.addEventListener('dragover', e => {
        if (!drag || drag.container !== container) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = el.getBoundingClientRect();
        const after = axis === 'x'
          ? (e.clientX - r.left) > r.width / 2
          : (e.clientY - r.top) > r.height / 2;
        showGuides(r, after, axis);
        drop = { to: i, after };
      });
    });

    container.addEventListener('dragover', e => { if (drag) e.preventDefault(); });
    container.addEventListener('drop', e => {
      if (!drag || !drop || drag.container !== container) return;
      e.preventDefault();
      let { from } = drag, { to, after } = drop;
      let target = after ? to + 1 : to;
      if (from < target) target--;
      if (target !== from) {
        drag.onMove(from, target);
        markDirty();
        clearGuides();
        redraw();
        say('Moved');
      }
      clearGuides(); drag = null; drop = null;
    });
  }

  const moveIn = arr => (from, to) => arr.splice(to, 0, arr.splice(from, 1)[0]);

  function wireSortables() {
    sortable(document.querySelector('#work .work-grid'), '.project', 'x',
             'work.projects', moveIn(D().work.projects));
    sortable(document.querySelector('#gallery .g-grid'), '.g-item', 'x',
             'gallery.photos', moveIn(D().gallery.photos));
    sortable(document.querySelector('#services .s-grid'), '.s-card', 'x',
             'services.items', moveIn(D().services.items));

    // whole sections, stacked vertically
    const order = D().sectionOrder || ['work','gallery','services','about','contact'];
    order.forEach((id, i) => {
      const sec = document.getElementById(id);
      if (!sec) return;
      sec.style.position = 'relative';
      const h = document.createElement('div');
      h.className = 'ed-tag ed-sec-h';
      h.innerHTML = `<button class="ed-chip ed-grab">⠿ Move section</button>`;
      sec.appendChild(h);
      const btn = h.querySelector('button');
      btn.onmousedown = () => { sec.draggable = true; };
      btn.onmouseup = () => { sec.draggable = false; };
      btn.onclick = e => { e.preventDefault(); e.stopPropagation(); };

      sec.addEventListener('dragstart', e => {
        drag = { container: 'sections', from: i,
                 onMove: moveIn(D().sectionOrder) };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        sec.classList.add('ed-drag');
      });
      sec.addEventListener('dragend', () => {
        sec.classList.remove('ed-drag'); sec.draggable = false;
        clearGuides(); drag = null; drop = null;
      });
      sec.addEventListener('dragover', e => {
        if (!drag || drag.container !== 'sections') return;
        e.preventDefault();
        const r = sec.getBoundingClientRect();
        const after = (e.clientY - r.top) > r.height / 2;
        showGuides(r, after, 'y');
        drop = { to: i, after };
      });
      sec.addEventListener('drop', e => {
        if (!drag || !drop || drag.container !== 'sections') return;
        e.preventDefault();
        let { from } = drag, { to, after } = drop;
        let target = after ? to + 1 : to;
        if (from < target) target--;
        if (target !== from) {
          drag.onMove(from, target);
          markDirty(); clearGuides(); redraw(); say('Section moved');
        }
        clearGuides(); drag = null; drop = null;
      });
    });
  }

  /* ============================================================
     FREE MOVE — drag any block anywhere, with snap guides
     ============================================================ */
  const snapV = document.createElement('div'); snapV.className = 'ed-snap v';
  const snapH = document.createElement('div'); snapH.className = 'ed-snap h';
  const readout = document.createElement('div'); readout.className = 'ed-pos';
  layer.append(snapV, snapH);
  document.body.appendChild(readout);

  let freeMode = false;
  const freeBtn = bar.querySelector('#edFree');

  freeBtn.onclick = () => {
    freeMode = !freeMode;
    document.body.classList.toggle('ed-free', freeMode);
    freeBtn.textContent = 'Free move: ' + (freeMode ? 'ON' : 'off');
    freeBtn.classList.toggle('pri', freeMode);
    // text editing off while moving, so drags don't select words
    document.querySelectorAll('[data-path]').forEach(el => el.contentEditable = String(!freeMode));
    say(freeMode
      ? 'Drag any block. Double-click a block to snap it back.'
      : 'Free move off — text editing is back', 4000);
  };

  const SNAP = 7;

  function candidates(moving) {
    const xs = [], ys = [];
    document.querySelectorAll('[data-move]').forEach(el => {
      if (el === moving || moving.contains(el) || el.contains(moving)) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      xs.push(r.left, r.left + r.width / 2, r.right);
      ys.push(r.top, r.top + r.height / 2, r.bottom);
    });
    // page gutters (5vw) and centre
    const g = innerWidth * 0.05;
    xs.push(g, innerWidth / 2, innerWidth - g);
    return { xs, ys };
  }

  function startFreeDrag(el, e) {
    e.preventDefault();
    const key = el.dataset.move;
    const off = (D().offsets ||= {});
    const cur = off[key] || { x: 0, y: 0 };
    const sx = e.clientX, sy = e.clientY;
    const { xs, ys } = candidates(el);
    el.classList.add('ed-moving');
    readout.style.display = 'block';

    const move = ev => {
      let dx = cur.x + (ev.clientX - sx);
      let dy = cur.y + (ev.clientY - sy);

      // provisional position, then look for a snap
      el.style.transform = `translate(${dx}px,${dy}px)`;
      const r = el.getBoundingClientRect();
      const edgesX = [r.left, r.left + r.width / 2, r.right];
      const edgesY = [r.top, r.top + r.height / 2, r.bottom];

      let hitX = null, hitY = null;
      for (const ex of edgesX) for (const cx of xs)
        if (Math.abs(ex - cx) < SNAP) { dx += cx - ex; hitX = cx; break; }
      for (const ey of edgesY) for (const cy of ys)
        if (Math.abs(ey - cy) < SNAP) { dy += cy - ey; hitY = cy; break; }

      el.style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`;

      snapV.style.display = hitX === null ? 'none' : 'block';
      if (hitX !== null) snapV.style.left = hitX + 'px';
      snapH.style.display = hitY === null ? 'none' : 'block';
      if (hitY !== null) snapH.style.top = hitY + 'px';

      readout.style.left = (ev.clientX + 16) + 'px';
      readout.style.top = (ev.clientY + 16) + 'px';
      readout.textContent = `${Math.round(dx)}, ${Math.round(dy)}`;

      el._pending = { x: Math.round(dx), y: Math.round(dy) };
    };

    const up = () => {
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', up);
      el.classList.remove('ed-moving');
      snapV.style.display = snapH.style.display = readout.style.display = 'none';
      if (el._pending) { off[key] = el._pending; delete el._pending; markDirty(); }
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  }

  function wireFree() {
    document.querySelectorAll('[data-move]').forEach(el => {
      el.addEventListener('mousedown', e => {
        if (!freeMode || e.button !== 0) return;
        if (e.target.closest('.ed-chip, .ed-tag')) return;
        startFreeDrag(el, e);
      });
      el.addEventListener('dblclick', e => {
        if (!freeMode) return;
        e.preventDefault();
        const off = (D().offsets ||= {});
        delete off[el.dataset.move];
        el.style.transform = '';
        markDirty(); say('Snapped back');
      });
    });
  }

  /* ---------- redraw ---------- */
  function redraw() {
    const y = scrollY;
    window.ADKINE.render(D());
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
    wireText(); wireMedia(); wireAdders(); wireSortables(); wireFree();
    if (freeMode) document.querySelectorAll('[data-path]').forEach(el => el.contentEditable = 'false');
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
  const b64utf8 = b => new TextDecoder().decode(
    Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));

  // what the page held when the editor opened — used to detect stale loads
  let baseline = null;

  saveBtn.onclick = async () => {
    if (!token) return say('Sign in first — button at the top right', 4000);
    saveBtn.disabled = true; saveBtn.textContent = 'Publishing…';
    try {
      // Guard: if what's stored differs from what this editor loaded, the page
      // was served a stale copy and publishing would wipe newer changes.
      if (baseline !== null) {
        try {
          const live = await gh(`/repos/${REPO}/contents/content/site.json?ref=${BRANCH}`);
          const stored = b64utf8(live.content);
          if (JSON.stringify(JSON.parse(stored)) !== baseline) {
            const ok = confirm(
              'Heads up: the saved content is newer than what this page loaded ' +
              '(you probably edited from another tab or device).\n\n' +
              'Publishing now will overwrite those newer changes.\n\n' +
              'OK = publish anyway   ·   Cancel = stop, then reload the page to get the latest.');
            if (!ok) { saveBtn.disabled = false; saveBtn.textContent = 'Publish'; return; }
          }
        } catch { /* first save, or file missing — carry on */ }
      }

      await putFile('content/site.json', utf8b64(JSON.stringify(D(), null, 2)), 'Update site content');
      baseline = JSON.stringify(D());
      dirty = false; saveBtn.textContent = 'Saved';
      say('Published ✓ — the live site updates in about 30 seconds', 5000);
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

  /* ---------- sign in (must be a real click, or the popup is blocked) ---------- */
  const loginBtn = bar.querySelector('#edLogin');
  loginBtn.onclick = async () => {
    loginBtn.textContent = 'Opening…'; loginBtn.disabled = true;
    try {
      token = await login();
      loginBtn.textContent = 'Signed in';
      say('Signed in — photos and Publish are ready', 3500);
    } catch (e) {
      loginBtn.textContent = 'Sign in'; loginBtn.disabled = false;
      say(e.message, 7000);
    }
  };

  /* ---------- boot: editing works straight away ---------- */
  if (!Array.isArray(D().sectionOrder))
    D().sectionOrder = ['work','gallery','services','about','contact'];
  if (!D().offsets || typeof D().offsets !== 'object') D().offsets = {};
  if (!D().style || typeof D().style !== 'object') D().style = {};
  baseline = JSON.stringify(D());
  buildPanel();
  redraw();
  say('Click any text to edit it — sign in when you want to publish', 6000);
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
