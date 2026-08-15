/* ============================================================
   ADKINE — visual page builder
   Loads only with ?edit — visitors never download it.
   Blocks, inline text, media, per-block settings, undo, publish.
   ============================================================ */
(() => {
  const REPO = 'ADKKINE/adkine', BRANCH = 'main';
  const AUTH = 'https://sveltia-cms-auth.adratzabi.workers.dev';
  const API  = 'https://api.github.com';

  const A = () => window.ADKINE;
  const D = () => A().data;
  let token = null, dirty = false, baseline = null, freeMode = false;

  /* ---------------- path utils ---------------- */
  const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  const set = (o, p, v) => {
    const ks = p.split('.'), last = ks.pop();
    ks.reduce((a, k) => a[k], o)[last] = v;
  };
  const splitLast = p => { const i = p.lastIndexOf('.'); return [p.slice(0,i), +p.slice(i+1)]; };
  const uid = () => 'b' + Math.random().toString(36).slice(2, 9);

  /* ---------------- undo history ---------------- */
  const past = [], future = [];
  const snap = () => JSON.stringify(D());
  let last = null;
  function push() {
    const s = snap();
    if (s === last) return;
    if (last !== null) past.push(last);
    if (past.length > 60) past.shift();
    future.length = 0;
    last = s;
  }
  function restore(str) {
    const d = JSON.parse(str);
    Object.keys(D()).forEach(k => delete D()[k]);
    Object.assign(D(), d);
    last = str;
    redraw();
  }
  function undo() {
    if (!past.length) return say('Nothing to undo');
    future.push(snap()); restore(past.pop()); markDirty(true); say('Undone');
  }
  function redo() {
    if (!future.length) return say('Nothing to redo');
    past.push(snap()); restore(future.pop()); markDirty(true); say('Redone');
  }

  /* ---------------- styles ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  .ed-bar{position:fixed;top:0;left:0;right:0;height:56px;z-index:10000;background:#16181C;
    color:#F0E9DC;display:flex;align-items:center;justify-content:space-between;padding:0 18px;
    font:500 12px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;gap:10px}
  .ed-bar .grp{display:flex;gap:8px;align-items:center}
  .ed-btn{background:none;border:1px solid rgba(240,233,220,.35);color:#F0E9DC;padding:10px 15px;
    font:500 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;
    border-radius:2px;transition:.2s;white-space:nowrap}
  .ed-btn:hover{background:rgba(240,233,220,.12)}
  .ed-btn.pri{background:#2E4057;border-color:#2E4057}
  .ed-btn.pri:hover{background:#93AEC9;color:#16181C}
  .ed-btn:disabled{opacity:.35;cursor:default}
  .ed-btn.on{background:#2E4057;border-color:#2E4057}
  /* until you sign in, make it obvious that this is the thing standing between
     you and uploading photos */
  #edLogin:not(.on){background:#8A6D2F;border-color:#8A6D2F;color:#FCFAF7}
  #edLogin:not(.on):hover{background:#A5843C}
  /* unpublished work is easy to lose by simply closing the tab — make the
     Publish button impossible to overlook while anything is unsaved */
  #edSave.unsaved{background:#8A6D2F;border-color:#8A6D2F;color:#FCFAF7;
    animation:edPulse 2s ease-in-out infinite}
  @keyframes edPulse{0%,100%{box-shadow:0 0 0 0 rgba(138,109,47,.7)}
                     50%{box-shadow:0 0 0 7px rgba(138,109,47,0)}}
  body.ed-on{padding-top:56px}
  body.ed-on nav{top:56px}

  /* inline text */
  [data-path]{outline:1px dashed transparent;transition:outline-color .15s;border-radius:2px}
  body.ed-on [data-path]{cursor:text}
  body.ed-on [data-path]:hover{outline-color:rgba(147,174,201,.9)}
  body.ed-on [data-path]:focus{outline:2px solid #2E4057;background:rgba(147,174,201,.12)}
  /* an empty line still has to be clickable */
  body.ed-on [data-path]:empty::before{content:'Empty';opacity:.35;font-style:italic}
  /* a moving strip is impossible to click into — hold it still while editing */
  body.ed-on .marquee-track{animation:none!important}

  /* per-text style button — follows whichever text you are working on */
  .ed-txtbtn{position:fixed;z-index:10001;display:none;background:#2E4057;color:#FCFAF7;
    border:0;border-radius:2px;padding:6px 10px;cursor:pointer;box-shadow:0 3px 12px rgba(22,24,28,.3);
    font:600 11px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
  .ed-txtbtn.show{display:block}
  .ed-txtbtn:hover{background:#93AEC9;color:#16181C}
  .ed-txt-live{outline:2px solid #8A6D2F!important;background:rgba(138,109,47,.10)}

  /* device switcher */
  .ed-dev{display:flex;border:1px solid rgba(240,233,220,.35);border-radius:2px;overflow:hidden}
  .ed-dev button{background:none;border:0;color:#F0E9DC;padding:10px 13px;cursor:pointer;
    font:500 11px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase}
  .ed-dev button.on{background:#93AEC9;color:#16181C}
  .ed-devnote{background:#8A6D2F;color:#FCFAF7;font:500 10px/1 Inter,sans-serif;letter-spacing:.14em;
    text-transform:uppercase;padding:6px 10px;border-radius:2px;margin-bottom:14px;display:none}
  .ed-devnote.show{display:block}
  .ed-panel textarea{width:100%;padding:8px 9px;border:1px solid rgba(46,64,87,.2);background:#fff;
    font-family:inherit;font-size:13px;color:#23262C;border-radius:2px;min-height:96px;resize:vertical}
  .ed-mini{font:400 11px/1.5 Inter,sans-serif;color:rgba(35,38,44,.6);margin:-4px 0 10px}

  /* block frame */
  body.ed-on .blk{outline:1px dashed transparent;transition:outline-color .15s}
  body.ed-on .blk:hover{outline-color:rgba(46,64,87,.28)}
  body.ed-on .blk.ed-sel{outline:2px solid #2E4057}
  /* Toolbars sit ABOVE the fixed nav (z-index 100) or they'd be unreachable
     on whichever block is at the top of the screen. */
  .ed-blkbar{position:absolute;top:8px;right:8px;z-index:120;display:none;gap:4px}
  body.ed-on .blk:hover>.ed-blkbar,.blk.ed-sel>.ed-blkbar{display:flex}
  .ed-blkname{position:absolute;top:8px;left:5vw;z-index:120;display:none;
    background:#2E4057;color:#F0E9DC;font:500 9px/1 Inter,sans-serif;letter-spacing:.16em;
    text-transform:uppercase;padding:7px 10px;border-radius:2px}
  body.ed-on .blk:hover>.ed-blkname,.blk.ed-sel>.ed-blkname{display:block}
  /* Positions are set in JS (see placeBar) so the toolbar always stays clear
     of the fixed nav, whatever the scroll position. */

  /* The nav is fixed and full-width, so its empty areas were swallowing the
     mouse and cancelling :hover on the block underneath — that's why the
     block buttons vanished as you reached for them. Let the gaps pass through. */
  body.ed-on nav{pointer-events:none}
  body.ed-on nav .logo,
  body.ed-on nav .nav-links,
  body.ed-on nav .burger{pointer-events:auto}

  .ed-chip{background:rgba(22,24,28,.88);color:#F0E9DC;border:0;font:500 9px/1 Inter,sans-serif;
    letter-spacing:.12em;text-transform:uppercase;padding:7px 9px;border-radius:2px;cursor:pointer;
    backdrop-filter:blur(6px);white-space:nowrap}
  .ed-chip:hover{background:#2E4057}
  .ed-chip.del:hover{background:#8B1A1A}
  .ed-chip.grab{cursor:grab}

  /* item controls — top RIGHT, so they never sit under the media buttons */
  body.ed-on [data-item]{position:relative}
  .ed-itembar{position:absolute;top:4px;right:4px;z-index:57;display:none;gap:3px}
  body.ed-on [data-item]:hover>.ed-itembar{display:flex}
  .ed-itembar .ed-chip{padding:5px 7px;font-size:8px}

  /* media buttons — bottom LEFT of the picture itself */
  .ed-mediabar{position:absolute;bottom:8px;left:8px;z-index:56;display:flex;gap:4px;
    flex-wrap:wrap;max-width:calc(100% - 16px)}

  /* add-block inserter */
  .ed-ins-row{position:relative;height:0;z-index:58}
  .ed-ins-btn{position:absolute;left:50%;top:-17px;transform:translateX(-50%);
    background:#2E4057;color:#FCFAF7;border:0;border-radius:20px;padding:9px 18px;
    font:500 10px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;
    cursor:pointer;opacity:0;transition:opacity .2s;box-shadow:0 3px 14px rgba(22,24,28,.25)}
  .ed-ins-row:hover .ed-ins-btn,.ed-ins-btn:focus{opacity:1}
  .ed-ins-row::before{content:'';position:absolute;left:5vw;right:5vw;top:0;height:1px;
    background:rgba(46,64,87,.25);opacity:0;transition:opacity .2s}
  .ed-ins-row:hover::before{opacity:1}

  /* picker */
  .ed-modal{position:fixed;inset:0;z-index:10002;background:rgba(22,24,28,.6);
    display:none;place-items:center;padding:5vw;backdrop-filter:blur(3px)}
  .ed-modal.open{display:grid}
  .ed-sheet{background:#FCFAF7;width:min(760px,100%);max-height:82vh;overflow:auto;
    padding:30px;border-radius:4px;font-family:Inter,sans-serif}
  .ed-sheet h3{font:500 11px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;
    color:#2E4057;margin-bottom:20px}
  .ed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
  .ed-card{border:1px solid rgba(46,64,87,.18);background:#fff;padding:16px 14px;cursor:pointer;
    border-radius:3px;transition:.18s;text-align:left}
  .ed-card:hover{border-color:#2E4057;background:#DCE6F0}
  .ed-card b{display:block;font:600 13px/1.3 Inter,sans-serif;color:#16181C;margin-bottom:4px}
  .ed-card span{font:400 11px/1.4 Inter,sans-serif;color:rgba(35,38,44,.6)}

  /* panels */
  .ed-panel{position:fixed;top:56px;right:0;width:308px;bottom:0;z-index:9999;background:#FCFAF7;
    border-left:1px solid rgba(46,64,87,.18);padding:22px;overflow:auto;
    font:400 12px/1.6 Inter,sans-serif;transform:translateX(100%);
    transition:transform .3s cubic-bezier(.22,1,.36,1)}
  .ed-panel.open{transform:none}
  .ed-panel h4{font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;
    color:#2E4057;margin:26px 0 12px}
  .ed-panel h4:first-of-type{margin-top:0}
  .ed-panel .close-x{float:right;cursor:pointer;color:rgba(35,38,44,.5);font-size:16px;line-height:1}
  .ed-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;
    border-bottom:1px solid rgba(46,64,87,.09)}
  .ed-row input[type=color]{width:34px;height:24px;border:0;background:none;cursor:pointer}
  .ed-field{padding:11px 0;border-bottom:1px solid rgba(46,64,87,.09)}
  .ed-field label{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;
    letter-spacing:.1em;text-transform:uppercase;color:#2E4057;font-weight:500;margin-bottom:7px}
  .ed-field label b{font-weight:400;color:rgba(35,38,44,.55);text-transform:none;letter-spacing:0}
  .ed-field select,.ed-field input[type=text],.ed-field input[type=number]{width:100%;padding:8px 9px;
    border:1px solid rgba(46,64,87,.2);background:#fff;font-family:inherit;font-size:13px;
    color:#23262C;border-radius:2px}
  .ed-field input[type=range]{width:100%;accent-color:#2E4057}
  .ed-swatches{display:flex;gap:7px;flex-wrap:wrap}
  .ed-sw{width:34px;height:34px;border-radius:3px;border:2px solid transparent;cursor:pointer}
  .ed-sw.sel{border-color:#2E4057;box-shadow:0 0 0 2px #FCFAF7 inset}
  .ed-seg{display:flex;gap:0;border:1px solid rgba(46,64,87,.2);border-radius:2px;overflow:hidden}
  .ed-seg button{flex:1;padding:9px 4px;border:0;background:#fff;font:500 10px/1 Inter,sans-serif;
    letter-spacing:.1em;text-transform:uppercase;cursor:pointer;color:#2E4057}
  .ed-seg button.on{background:#2E4057;color:#FCFAF7}
  .ed-preview{font-size:22px;line-height:1.15;color:#16181C;margin-top:8px;padding:10px 0;
    border-top:1px solid rgba(46,64,87,.09)}
  .ed-reset{width:100%;margin-top:20px;padding:12px;border:1px solid rgba(46,64,87,.3);background:none;
    font:500 10px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#2E4057;
    cursor:pointer;border-radius:2px}
  .ed-reset:hover{background:#2E4057;color:#FCFAF7}
  .ed-danger{border-color:rgba(139,26,26,.4);color:#8B1A1A}
  .ed-danger:hover{background:#8B1A1A;color:#fff}

  /* guides */
  .ed-guides{position:fixed;inset:0;z-index:9998;pointer-events:none}
  .ed-ins{position:fixed;background:#2E4057;border-radius:2px;display:none}
  .ed-g{position:fixed;background:rgba(147,174,201,.85);display:none}
  .ed-g.h{height:1px;left:0;right:0}.ed-g.v{width:1px;top:0;bottom:0}
  .ed-snap{position:fixed;background:#8B0000;display:none;z-index:9998;pointer-events:none}
  .ed-snap.h{height:1px;left:0;right:0}.ed-snap.v{width:1px;top:0;bottom:0}
  .ed-drag{opacity:.35!important}
  body.ed-free [data-move]{outline:1px dashed rgba(147,174,201,.75);cursor:move}
  body.ed-free [data-move]:hover{outline:1px solid #2E4057}
  .ed-moving{outline:2px solid #2E4057!important;z-index:70}
  .ed-pos{position:fixed;z-index:10001;background:#16181C;color:#F0E9DC;
    font:400 11px/1 Inter,sans-serif;padding:6px 9px;border-radius:2px;display:none}

  /* keep the nav's add-link button out of the way until you go looking for it */
  #links > button.ed-chip{opacity:0;transition:opacity .2s;margin:0 0 0 18px!important;
    padding:5px 9px!important;display:inline-block!important}
  nav:hover #links > button.ed-chip{opacity:1}

  .ed-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10003;
    background:#16181C;color:#F0E9DC;padding:14px 26px;border-radius:3px;
    font:400 12px/1 Inter,sans-serif;letter-spacing:.06em;opacity:0;transition:opacity .25s;
    pointer-events:none;max-width:80vw;text-align:center}
  .ed-toast.show{opacity:1}
  `;
  document.head.appendChild(css);

  /* ---------------- toast ---------------- */
  const toast = Object.assign(document.createElement('div'), {className:'ed-toast'});
  document.body.appendChild(toast);
  let tId;
  const say = (m, ms=2600) => { toast.textContent = m; toast.classList.add('show');
    clearTimeout(tId); tId = setTimeout(()=>toast.classList.remove('show'), ms); };

  /* ---------------- top bar ---------------- */
  const bar = Object.assign(document.createElement('div'), {className:'ed-bar'});
  bar.innerHTML = `
    <div class="grp"><strong style="letter-spacing:.2em">ADKINE</strong>
      <button class="ed-btn" id="edUndo" title="Ctrl+Z">↶</button>
      <button class="ed-btn" id="edRedo" title="Ctrl+Shift+Z">↷</button>
    </div>
    <div class="grp">
      <div class="ed-dev" id="edDev">
        <button data-d="desktop" class="on">🖥 Computer</button>
        <button data-d="mobile">📱 Phone</button>
      </div>
      <button class="ed-btn" id="edAdd">+ Add block</button>
      <button class="ed-btn" id="edFree">Free move</button>
      <button class="ed-btn" id="edDesign">Design</button>
      <button class="ed-btn" id="edLogin">Sign in</button>
      <button class="ed-btn" id="edExit">Exit</button>
      <button class="ed-btn pri" id="edSave" disabled>Saved</button>
    </div>`;
  document.body.appendChild(bar);
  document.body.classList.add('ed-on');

  const saveBtn = bar.querySelector('#edSave');
  function markDirty(skipPush) {
    if (!skipPush) push();
    dirty = true; saveBtn.disabled = false; saveBtn.textContent = 'Publish';
    saveBtn.classList.add('unsaved');
  }
  bar.querySelector('#edUndo').onclick = undo;
  bar.querySelector('#edRedo').onclick = redo;
  bar.querySelector('#edExit').onclick = () => {
    if (dirty && !confirm('You have unpublished changes. Leave anyway?')) return;
    location.href = location.pathname;
  };
  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if (e.key.toLowerCase() === 's') { e.preventDefault(); saveBtn.click(); }
  });

  /* ---------------- device switcher ----------------
     Computer and Phone are edited separately. Desktop is the base; anything you
     change while Phone is selected is stored as a phone-only override, so the
     two never fight each other. */
  const devBar = bar.querySelector('#edDev');
  const dev = () => A().device();
  const onPhone = () => dev() === 'mobile';

  function switchDevice(mode) {
    A().setDevice(mode);
    devBar.querySelectorAll('button').forEach(b2 =>
      b2.classList.toggle('on', b2.dataset.d === mode));
    hideTextBtn();
    redraw();
    if (panelMode === 'block' && selected != null) blockPanel(selected);
    else if (panelMode === 'text' && textTarget) textPanel(textTarget.key, textTarget.el);
    say(mode === 'mobile'
      ? 'Phone view — sizes, spacing and text styles you change now apply to phones only.'
      : 'Computer view — you are editing the desktop layout.', 4200);
  }
  devBar.querySelectorAll('button').forEach(b2 =>
    b2.onclick = () => { if (b2.dataset.d !== dev()) switchDevice(b2.dataset.d); });

  /* ---------------- block catalogue ---------------- */
  const CATALOGUE = [
    ['text','Text','Heading and paragraphs'],
    ['projects','Project grid','Videos with titles'],
    ['gallery','Photo grid','Images in a grid'],
    ['services','Cards','Numbered service cards'],
    ['about','Image + text','Photo beside copy'],
    ['image','Image','One picture, any width'],
    ['video','Video','A single embedded video'],
    ['quote','Quote','Large pull quote'],
    ['buttons','Buttons','A row of links'],
    ['logos','Client list','Names in a row'],
    ['marquee','Scrolling strip','Words moving across'],
    ['contact','Contact','Email and socials'],
    ['hero','Hero','Full-screen opener'],
    ['spacer','Spacer','Empty vertical space'],
    ['divider','Divider','A thin line'],
  ];

  function newBlock(type) {
    const id = uid();
    const base = { id, type, bg:'white', pad:1 };
    switch (type) {
      case 'hero': return { ...base, eyebrow:'Small line above', titleLine1:'A bold', titleLine2:'headline',
        titleAccent:'right here', paragraph:'One or two sentences that set the tone.', backgroundVideo:'',
        buttons:[{label:'View Work',link:'#',solid:true},{label:'Get in Touch',link:'#',solid:false}] };
      case 'marquee': return { id, type, items:['Cinematography','Motion Design','Colour'] };
      case 'projects': return { ...base, label:'01 — Section', heading:'Projects', intro:'A line about this section.',
        columns:2, items:[{title:'New Project',category:'Category',thumbnail:'',videoUrl:''},
                          {title:'New Project',category:'Category',thumbnail:'',videoUrl:''}] };
      case 'gallery': return { ...base, bg:'beige', label:'02 — Section', heading:'Frames', intro:'',
        columns:4, items:[{image:'',alt:'Photo 01'},{image:'',alt:'Photo 02'},
                          {image:'',alt:'Photo 03'},{image:'',alt:'Photo 04'}] };
      case 'services': return { ...base, bg:'black', label:'03 — Section', heading:'Services', intro:'',
        columns:2, items:[{number:'01',title:'Service one',description:'What it is.',bullets:['Point one','Point two']},
                          {number:'02',title:'Service two',description:'What it is.',bullets:['Point one','Point two']}] };
      case 'about': return { ...base, label:'04 — About', heading:'Behind the lens', photo:'', flip:false,
        paragraphs:['Say something about yourself here.'], stats:[{value:'50+',label:'Projects'}] };
      case 'contact': return { ...base, bg:'navy', label:'05 — Contact', heading:"Let's make<br>something",
        intro:'Tell me about the project.', email:'adratzabi@gmail.com',
        socials:[{label:'Instagram',url:'https://instagram.com/ad_ratzabi'}] };
      case 'text': return { ...base, eyebrow:'', heading:'A heading', paragraphs:['Your text goes here.'], align:'left' };
      case 'image': return { ...base, src:'', caption:'', width:'wide', ratio:'16/9' };
      case 'video': return { ...base, url:'', poster:'', caption:'', width:'wide' };
      case 'buttons': return { ...base, align:'center', items:[{label:'Get in Touch',link:'#',solid:true}] };
      case 'quote': return { ...base, bg:'beige', text:'A line worth repeating.', author:'Client name', align:'center' };
      case 'logos': return { ...base, label:'', heading:'Worked with', intro:'', items:['Client one','Client two','Client three'] };
      case 'spacer': return { id, type, height:80 };
      case 'divider': return { id, type, pad:1 };
      default: return base;
    }
  }

  /* picker modal */
  const picker = Object.assign(document.createElement('div'), {className:'ed-modal'});
  picker.innerHTML = `<div class="ed-sheet"><h3>Add a block</h3><div class="ed-grid">
    ${CATALOGUE.map(([t,n,d])=>`<button class="ed-card" data-t="${t}"><b>${n}</b><span>${d}</span></button>`).join('')}
  </div></div>`;
  document.body.appendChild(picker);
  let insertAt = null;
  picker.onclick = e => { if (e.target === picker) picker.classList.remove('open'); };
  picker.querySelectorAll('.ed-card').forEach(c => {
    c.onclick = () => {
      const at = insertAt ?? D().blocks.length;
      D().blocks.splice(at, 0, newBlock(c.dataset.t));
      picker.classList.remove('open');
      markDirty(); redraw();
      say('Block added');
      const el = document.querySelector(`[data-blk="${at}"]`);
      el?.scrollIntoView({behavior:'smooth', block:'center'});
    };
  });
  const openPicker = at => { insertAt = at; picker.classList.add('open'); };
  bar.querySelector('#edAdd').onclick = () => openPicker(D().blocks.length);

  /* ---------------- panels ---------------- */
  const panel = Object.assign(document.createElement('div'), {className:'ed-panel'});
  document.body.appendChild(panel);
  let panelMode = null;   // 'design' | 'block'
  let selected = null;    // selected block index

  const closePanel = () => { panel.classList.remove('open'); panelMode = null;
    document.querySelectorAll('.blk.ed-sel').forEach(e=>e.classList.remove('ed-sel'));
    document.querySelectorAll('.ed-txt-live').forEach(e=>e.classList.remove('ed-txt-live'));
    textTarget = null; hideTextBtn(); };

  /* ---- design panel ---- */
  const COLOR_LABELS = { blue:'Pastel blue', navy:'Deep blue', beige:'Beige',
    beigePale:'Beige pale', bluePale:'Blue pale', white:'White', black:'Black' };
  const DISPLAY_FONTS = ['Cormorant Garamond','Playfair Display','DM Serif Display','Bodoni Moda',
    'Marcellus','Italiana','Libre Baskerville','Syne','Space Grotesk'];
  const BODY_FONTS = ['Inter','DM Sans','Work Sans','Manrope','Karla','Jost','IBM Plex Sans'];
  const STYLE_DEFAULTS = { displayFont:'Cormorant Garamond', bodyFont:'Inter',
    headScale:1, bodyScale:1, spaceScale:1, tracking:-0.02 };
  const SLIDERS = [
    {key:'headScale', label:'Heading size', min:.6, max:1.6, step:.02, fmt:v=>Math.round(v*100)+'%'},
    {key:'bodyScale', label:'Text size', min:.8, max:1.5, step:.02, fmt:v=>Math.round(v*100)+'%'},
    {key:'tracking', label:'Letter spacing', min:-.06, max:.12, step:.005, fmt:v=>v.toFixed(3)+'em'},
    {key:'spaceScale', label:'Section spacing', min:.5, max:1.8, step:.05, fmt:v=>Math.round(v*100)+'%'},
  ];
  const S = () => (D().style ||= {});
  const sv = k => S()[k] ?? STYLE_DEFAULTS[k];

  function designPanel() {
    panelMode = 'design';
    const opts = (l,c) => l.map(f=>`<option value="${f}"${f===c?' selected':''}>${f}</option>`).join('');
    panel.innerHTML = `
      <span class="close-x" id="pClose">✕</span>
      <h4>Fonts</h4>
      <div class="ed-field"><label>Headings <b>display</b></label>
        <select data-f="displayFont">${opts(DISPLAY_FONTS, sv('displayFont'))}</select>
        <div class="ed-preview" id="pvHead">Cinematic work</div></div>
      <div class="ed-field"><label>Body text <b>everything else</b></label>
        <select data-f="bodyFont">${opts(BODY_FONTS, sv('bodyFont'))}</select>
        <div class="ed-preview" id="pvBody" style="font-size:14px">Video production and motion design.</div></div>
      <h4>Size &amp; spacing</h4>
      ${SLIDERS.map(s=>`<div class="ed-field"><label>${s.label} <b id="v-${s.key}">${s.fmt(sv(s.key))}</b></label>
        <input type="range" data-s="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${sv(s.key)}"></div>`).join('')}
      <h4>Colours</h4>
      ${Object.keys(COLOR_LABELS).map(k=>`<div class="ed-row"><span>${COLOR_LABELS[k]}</span>
        <input type="color" data-c="${k}" value="${D().theme[k]||'#000000'}"></div>`).join('')}
      <h4>Site</h4>
      <div class="ed-field"><label>Browser tab title</label>
        <input type="text" id="pTitle" value="${A().esc(D().brand.pageTitle||'')}"></div>
      <button class="ed-reset" id="pResetStyle">Reset design to default</button>`;

    const pv = () => {
      panel.querySelector('#pvHead').style.fontFamily = A().FONT_STACK[sv('displayFont')] || 'serif';
      panel.querySelector('#pvBody').style.fontFamily = A().FONT_STACK[sv('bodyFont')] || 'sans-serif';
    };
    panel.querySelector('#pClose').onclick = closePanel;
    panel.querySelectorAll('select[data-f]').forEach(s2 => s2.onchange = () => {
      S()[s2.dataset.f] = s2.value; A().applyStyle(D()); pv(); markDirty(); });
    panel.querySelectorAll('input[data-s]').forEach(r => r.oninput = () => {
      const k = r.dataset.s, v = parseFloat(r.value);
      S()[k] = v; panel.querySelector('#v-'+k).textContent = SLIDERS.find(x=>x.key===k).fmt(v);
      A().applyStyle(D()); markDirty(); });
    panel.querySelectorAll('input[data-c]').forEach(i => i.oninput = () => {
      D().theme[i.dataset.c] = i.value; A().applyTheme(D().theme); markDirty(); });
    panel.querySelector('#pTitle').oninput = e => { D().brand.pageTitle = e.target.value;
      document.title = e.target.value; markDirty(); };
    panel.querySelector('#pResetStyle').onclick = () => {
      if (!confirm('Reset fonts, sizes and spacing?')) return;
      D().style = {...STYLE_DEFAULTS}; A().applyStyle(D()); designPanel(); markDirty(); say('Design reset'); };
    pv();
    panel.classList.add('open');
  }
  bar.querySelector('#edDesign').onclick = () =>
    (panelMode === 'design' && panel.classList.contains('open')) ? closePanel() : designPanel();

  /* ---- block settings panel ---- */
  const BGS = [['white','#FCFAF7'],['beige','#F0E9DC'],['blue','#DCE6F0'],['navy','#2E4057'],['black','#16181C']];

  /* Reading and writing a block setting always goes through these two, so a
     change made in Phone view lands in b.mobile and never touches the desktop. */
  const isDevKey = k => A().DEVICE_KEYS.includes(k);
  function bget(b, k, def) {
    if (onPhone() && isDevKey(k)) {
      const v = (b.mobile || {})[k];
      if (v !== undefined && v !== null) return v;
    }
    return (b[k] !== undefined && b[k] !== null) ? b[k] : def;
  }
  function bset(b, k, v) {
    if (onPhone() && isDevKey(k)) (b.mobile ||= {})[k] = v;
    else b[k] = v;
  }

  function blockPanel(i) {
    const b = D().blocks[i];
    if (!b) return;
    panelMode = 'block'; selected = i;
    document.querySelectorAll('.blk.ed-sel').forEach(e=>e.classList.remove('ed-sel'));
    const selEl = document.querySelector(`[data-blk="${i}"]`);
    selEl?.classList.add('ed-sel');
    if (selEl) { const tb = selEl.querySelector(':scope > .ed-blkbar'),
                       tg = selEl.querySelector(':scope > .ed-blkname');
                 pinned = {el:selEl, tb, tag:tg}; placeBar(selEl, tb, tg); }

    const name = (CATALOGUE.find(c=>c[0]===b.type)||[,b.type])[1];
    const seg = (key, opts, cur) => `<div class="ed-seg">${opts.map(([v,l])=>
      `<button data-k="${key}" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;

    let extra = '';
    if (['projects','gallery','services'].includes(b.type))
      extra += `<div class="ed-field"><label>Columns</label>
        ${seg('columns', (b.type==='gallery'?[1,2,3,4]:[1,2,3]).map(n=>[n,n]),
              bget(b,'columns', b.type==='gallery'?4:2))}</div>`;
    if (['image','video'].includes(b.type))
      extra += `<div class="ed-field"><label>Width</label>
        ${seg('width',[['narrow','Narrow'],['wide','Wide'],['full','Full']], bget(b,'width','wide'))}</div>`;
    if (b.type === 'image')
      extra += `<div class="ed-field"><label>Shape</label>
        ${seg('ratio',[['16/9','Wide'],['4/3','Classic'],['1/1','Square'],['3/4','Tall']], bget(b,'ratio','16/9'))}</div>`;
    if (b.type === 'about')
      extra += `<div class="ed-field"><label>Photo side</label>
        ${seg('flip',[[false,'Left'],[true,'Right']], !!bget(b,'flip',false))}</div>`;
    if (b.type === 'spacer')
      extra += `<div class="ed-field"><label>Height <b id="v-height">${bget(b,'height',80)}px</b></label>
        <input type="range" data-n="height" min="20" max="400" step="10" value="${bget(b,'height',80)}"></div>`;
    if (['text','buttons','quote'].includes(b.type))
      extra += `<div class="ed-field"><label>Alignment</label>
        ${seg('align',[['left','Left'],['center','Centre']], bget(b,'align','left'))}</div>`;
    if (b.type === 'marquee')
      extra += `<div class="ed-field"><label>Words <b>one per line</b></label>
        <textarea id="pMqItems">${A().esc((b.items||[]).join('\n'))}</textarea></div>`;

    const showBg = !['spacer','marquee'].includes(b.type);
    const POSITIONS = [
      ['left top','Top left'],['center top','Top'],['right top','Top right'],
      ['left center','Left'],['center center','Centre'],['right center','Right'],
      ['left bottom','Bottom left'],['center bottom','Bottom'],['right bottom','Bottom right'],
    ];
    const bgPhoto = showBg ? `
      <h4>Background photo</h4>
      <div class="ed-field">
        <button class="ed-reset" id="pBgPick" style="margin-top:0">
          ${b.bgImage ? 'Replace background photo' : 'Add a background photo'}</button>
        ${b.bgImage ? `<button class="ed-reset ed-danger" id="pBgClear">Remove it</button>` : ''}
      </div>
      ${b.bgImage ? `
      <div class="ed-field"><label>Opacity <b id="v-bgOpacity">${Math.round(bget(b,'bgOpacity',.6)*100)}%</b></label>
        <input type="range" data-n="bgOpacity" min="0.05" max="1" step="0.05" value="${bget(b,'bgOpacity',.6)}"></div>
      <div class="ed-field"><label>Position <b>where it sits</b></label>
        <select id="pBgPos">${POSITIONS.map(([v,l])=>
          `<option value="${v}"${bget(b,'bgPosition','center center')===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="ed-field"><label>Fill</label>
        ${seg('bgSize',[['cover','Fill'],['contain','Fit'],['auto','Actual size']], bget(b,'bgSize','cover'))}</div>
      <div class="ed-field"><label>Scroll</label>
        ${seg('bgFixed',[[false,'Moves'],[true,'Stays put']], !!bget(b,'bgFixed',false))}</div>` : ''}
    ` : '';

    const heroVideo = b.type === 'hero' ? `
      <h4>Background video</h4>
      <div class="ed-field"><label>YouTube or Vimeo link <b>optional</b></label>
        <input type="text" id="pHeroVid" placeholder="Paste a link, or leave empty"
               value="${A().esc(b.backgroundVideo||'')}"></div>` : '';

    const phoneOnly = Object.keys(b.mobile || {}).length;
    panel.innerHTML = `
      <span class="close-x" id="pClose">✕</span>
      <h4>${name} block</h4>
      <div class="ed-devnote ${onPhone()?'show':''}">📱 Editing the phone version</div>
      <div class="ed-field"><label>${onPhone() ? 'Show this block on phones' : 'Show this block'}</label>
        ${seg('hidden',[[false,'Show'],[true,'Hide']], !!bget(b,'hidden',false))}</div>
      <div class="ed-mini">${onPhone()
        ? 'Phones only — the computer version is not affected.'
        : 'Hiding here hides it everywhere, unless you set it differently in Phone view.'}</div>
      ${onPhone() ? `<button class="ed-reset" id="pDevReset"
          style="margin-top:0${phoneOnly ? '' : ';display:none'}">Clear phone-only settings</button>` : ''}
      ${showBg ? `<div class="ed-field"><label>Background colour</label>
        <div class="ed-swatches">${BGS.map(([v,c])=>
          `<div class="ed-sw ${(b.bg||'white')===v?'sel':''}" data-bg="${v}"
                style="background:${c};border:2px solid ${(b.bg||'white')===v?'#2E4057':'rgba(46,64,87,.2)'}"></div>`).join('')}
        </div></div>` : ''}
      ${bgPhoto}
      ${heroVideo}
      ${b.type!=='spacer' ? `<div class="ed-field"><label>Padding <b id="v-pad">${Math.round(bget(b,'pad',1)*100)}%</b></label>
        <input type="range" data-n="pad" min="0.2" max="2.2" step="0.05" value="${bget(b,'pad',1)}"></div>` : ''}
      ${extra}
      <div class="ed-field"><label>Anchor name <b>for menu links</b></label>
        <input type="text" id="pAnchor" value="${A().esc(b.id)}"></div>
      <button class="ed-reset" id="pDup">Duplicate this block</button>
      <button class="ed-reset ed-danger" id="pDel">Delete this block</button>`;

    panel.querySelector('#pClose').onclick = closePanel;
    panel.querySelectorAll('.ed-sw').forEach(sw => sw.onclick = () => {
      b.bg = sw.dataset.bg; markDirty(); redraw(); blockPanel(i); });
    panel.querySelectorAll('.ed-seg button').forEach(bt => bt.onclick = () => {
      const v = bt.dataset.v;
      bset(b, bt.dataset.k, v === 'true' ? true : v === 'false' ? false : (isNaN(+v) ? v : +v));
      markDirty(); redraw(); blockPanel(i); });
    panel.querySelector('#pDevReset')?.addEventListener('click', () => {
      delete b.mobile; markDirty(); redraw(); blockPanel(i);
      say('This block now follows the computer version on phones'); });
    panel.querySelector('#pMqItems')?.addEventListener('input', e => {
      b.items = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);
      markDirty(true); redraw(); });
    panel.querySelectorAll('input[data-n]').forEach(r => r.oninput = () => {
      const k = r.dataset.n, v = parseFloat(r.value);
      bset(b, k, v);
      const lbl = panel.querySelector('#v-'+k);
      if (lbl) lbl.textContent = (k === 'pad' || k === 'bgOpacity')
        ? Math.round(v*100)+'%' : v+'px';
      const el = document.querySelector(`[data-blk="${i}"]`);
      if (k === 'pad') el?.style.setProperty('--pad', v);
      else if (k === 'bgOpacity') { const bg = el?.querySelector('.blk-bg'); if (bg) bg.style.opacity = v; }
      else { const sp = el?.querySelector('.spacer-inner'); sp?.style.setProperty('--h', v+'px'); }
      const dr = panel.querySelector('#pDevReset');
      if (dr) dr.style.display = Object.keys(b.mobile || {}).length ? '' : 'none';
      markDirty(true); });

    // background photo
    panel.querySelector('#pBgPick')?.addEventListener('click', () =>
      pickImage(`blocks.${i}.bgImage`, () => blockPanel(i)));
    panel.querySelector('#pBgClear')?.addEventListener('click', () => {
      delete b.bgImage; markDirty(); redraw(); blockPanel(i); say('Background photo removed'); });
    panel.querySelector('#pBgPos')?.addEventListener('change', e => {
      bset(b, 'bgPosition', e.target.value);
      const bg = document.querySelector(`[data-blk="${i}"] .blk-bg`);
      if (bg) bg.style.backgroundPosition = e.target.value;
      markDirty(); });

    // hero background video
    panel.querySelector('#pHeroVid')?.addEventListener('change', e => {
      b.backgroundVideo = e.target.value.trim(); markDirty(); redraw(); blockPanel(i);
      say(b.backgroundVideo ? 'Background video set' : 'Background video removed'); });
    panel.querySelector('#pAnchor').onchange = e => {
      const v = e.target.value.trim().replace(/[^\w-]/g,'-');
      if (v) { b.id = v; markDirty(); redraw(); } };
    panel.querySelector('#pDup').onclick = () => {
      const copy = JSON.parse(JSON.stringify(b)); copy.id = uid();
      D().blocks.splice(i+1, 0, copy); markDirty(); redraw(); closePanel(); say('Block duplicated'); };
    panel.querySelector('#pDel').onclick = () => {
      if (!confirm(`Delete this ${name.toLowerCase()} block?`)) return;
      D().blocks.splice(i,1); markDirty(); redraw(); closePanel(); say('Block deleted'); };

    panel.classList.add('open');
  }

  /* ---------------- inline text ---------------- */
  function wireText() {
    document.querySelectorAll('[data-path]').forEach(el => {
      el.contentEditable = String(!freeMode);
      el.spellcheck = false;
      const multi = el.dataset.multiline === '1';
      let before = null;
      el.addEventListener('focus', () => { before = snap(); showTextBtn(el); });
      el.addEventListener('input', () => {
        // a multi-line heading keeps its line breaks; everything else is one line
        set(D(), el.dataset.path, multi ? el.innerText.replace(/\n+$/, '') : el.innerText.trim());
        dirty = true; saveBtn.disabled = false; saveBtn.textContent = 'Publish';
        saveBtn.classList.add('unsaved');
      });
      el.addEventListener('blur', () => {
        if (before && before !== snap()) { past.push(before); last = snap(); future.length = 0; }
        before = null;
        setTimeout(() => { if (panelMode !== 'text') hideTextBtn(); }, 220);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !multi) { e.preventDefault(); el.blur(); }
      });
      el.addEventListener('click', e => e.stopPropagation());
      el.addEventListener('mouseenter', () => { if (!freeMode && panelMode !== 'text') showTextBtn(el); });
    });
    if (textTarget) {                       // keep the open text panel pointing at a live node
      const again = findText(textTarget.key);
      if (again) { textTarget.el = again; again.classList.add('ed-txt-live'); showTextBtn(again); }
    }
  }

  /* ---------------- per-text styling ----------------
     Every single piece of text has its own key, and its own look for Computer
     and for Phone. Phone values are layered over the computer ones, so a text
     you never touch on the phone simply follows the computer. */
  let textTarget = null;
  const findText = key => key
    ? document.querySelector('[data-tkey="' + (window.CSS?.escape ? CSS.escape(key) : key) + '"]')
    : null;

  const txtBtn = Object.assign(document.createElement('button'),
    { className:'ed-txtbtn', textContent:'Aa  Style this text', type:'button' });
  document.body.appendChild(txtBtn);
  function showTextBtn(el) {
    if (freeMode || !el || !el.dataset.tkey) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const navB = document.querySelector('nav')?.getBoundingClientRect().bottom || 0;
    txtBtn._el = el;
    // scrolled out of sight — a button floating over nothing is just confusing.
    // Keep the target so it comes straight back when you scroll to it again.
    // (nav text sits above navB and is still perfectly visible, so measure the
    //  viewport, not the nav.)
    if (r.bottom < 0 || r.top > innerHeight) { txtBtn.classList.remove('show'); return; }
    txtBtn.dataset.key = el.dataset.tkey;
    txtBtn.style.left = Math.max(6, Math.round(r.left)) + 'px';
    txtBtn.classList.add('show');
    // above the text by default; drop below if that would bury a photo/video button
    const hits = y => {
      const box = { left: r.left, right: r.left + txtBtn.offsetWidth, top: y, bottom: y + txtBtn.offsetHeight };
      return [...document.querySelectorAll('.ed-mediabar, .ed-itembar')].some(o => {
        const q = o.getBoundingClientRect();
        return q.width && !(box.right <= q.left || q.right <= box.left ||
                            box.bottom <= q.top || q.bottom <= box.top);
      });
    };
    const above = Math.max(navB + 6, r.top - 27);
    txtBtn.style.top = Math.round(hits(above) && !hits(r.bottom + 5) ? r.bottom + 5 : above) + 'px';
  }
  function hideTextBtn() { txtBtn.classList.remove('show'); txtBtn._el = null; }
  txtBtn.addEventListener('mousedown', e => e.preventDefault());   // never steal the caret
  txtBtn.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (txtBtn._el) textPanel(txtBtn.dataset.key, txtBtn._el);
  };
  addEventListener('scroll', () => {
    if (txtBtn._el && txtBtn._el.isConnected) showTextBtn(txtBtn._el);
  }, { passive:true });

  const TS = () => (D().textStyles ||= {});
  const tslot = key => { const t = (TS()[key] ||= {}); return (t[onPhone() ? 'mobile' : 'desktop'] ||= {}); };
  function tread(key, k) {
    const t = TS()[key] || {};
    if (onPhone() && t.mobile && t.mobile[k] !== undefined) return t.mobile[k];
    return (t.desktop || {})[k];
  }
  const hexOf = c => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c || '');
    return m ? '#' + [m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('') : '#16181C';
  };
  const pretty = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\./g, ' › ').replace(/(^|\s|›\s)\w/g, c => c.toUpperCase());
  const ALL_FONTS = [...DISPLAY_FONTS, ...BODY_FONTS];

  function textPanel(key, el) {
    el = (el && el.isConnected) ? el : findText(key);
    if (!el) return closePanel();
    panelMode = 'text'; textTarget = { key, el };
    document.querySelectorAll('.ed-txt-live').forEach(e => e.classList.remove('ed-txt-live'));
    el.classList.add('ed-txt-live');
    showTextBtn(el);

    const cs = getComputedStyle(el);
    const cur = k => tread(key, k);
    const size = Math.round(parseFloat(cur('size') ?? cs.fontSize)) || 16;
    const weight = String(cur('weight') ?? (parseInt(cs.fontWeight) || 400));
    const align = cur('align') ?? (['left','center','right'].includes(cs.textAlign) ? cs.textAlign : 'left');
    const track = cur('tracking') ?? 0;
    const lh = cur('lineHeight') ??
      ((Math.round((parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 16)) * 100) / 100) || 1.4);
    const color = cur('color') ?? hexOf(cs.color);
    const seg = (k, opts, c) => `<div class="ed-seg">${opts.map(([v,l]) =>
      `<button data-t="${k}" data-v="${v}" class="${String(c)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
    const hasPhone = Object.keys((TS()[key] || {}).mobile || {}).length;

    panel.innerHTML = `
      <span class="close-x" id="pClose">✕</span>
      <h4>Text — ${pretty(key)}</h4>
      <div class="ed-devnote ${onPhone()?'show':''}">📱 Editing the phone version</div>
      <div class="ed-mini">Only this one piece of text changes.</div>
      <div class="ed-field"><label>Font</label>
        <select id="tFont">
          <option value="">Default</option>
          ${ALL_FONTS.map(f=>`<option value="${f}"${cur('font')===f?' selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="ed-field"><label>Size <b id="v-tsize">${size}px</b></label>
        <input type="range" id="tSize" min="8" max="180" step="1" value="${size}"></div>
      <div class="ed-field"><label>Weight</label>
        ${seg('weight',[[300,'Light'],[400,'Normal'],[500,'Medium'],[600,'Bold'],[800,'Black']], weight)}</div>
      <div class="ed-field"><label>Style</label>
        ${seg('italic',[[false,'Normal'],[true,'Italic']], !!cur('italic'))}</div>
      <div class="ed-field"><label>Capitals</label>
        ${seg('caps',[[false,'As typed'],[true,'UPPERCASE']], !!cur('caps'))}</div>
      <div class="ed-field"><label>Alignment</label>
        ${seg('align',[['left','Left'],['center','Centre'],['right','Right']], align)}</div>
      <div class="ed-row"><span>Colour</span><input type="color" id="tColor" value="${color}"></div>
      <div class="ed-field"><label>Letter spacing <b id="v-ttrack">${(+track).toFixed(3)}em</b></label>
        <input type="range" id="tTrack" min="-0.08" max="0.4" step="0.005" value="${track}"></div>
      <div class="ed-field"><label>Line height <b id="v-tlh">${(+lh).toFixed(2)}</b></label>
        <input type="range" id="tLh" min="0.8" max="2.6" step="0.02" value="${lh}"></div>
      ${onPhone() ? `<button class="ed-reset" id="tFollow"
          style="${hasPhone ? '' : 'display:none'}">Follow the computer version</button>` : ''}
      <button class="ed-reset ed-danger" id="tReset">
        Reset this text${onPhone() ? ' (phone)' : ''}</button>`;

    const live = () => {
      A().applyTextStyles(D());
      const f = panel.querySelector('#tFollow');
      if (f) f.style.display = Object.keys((TS()[key] || {}).mobile || {}).length ? '' : 'none';
      markDirty(true);
    };
    const put = (k, v) => {
      const s = tslot(key);
      if (v === '' || v === null || v === undefined) delete s[k]; else s[k] = v;
      live();
    };

    panel.querySelector('#pClose').onclick = closePanel;
    panel.querySelector('#tFont').onchange = e => { if (e.target.value) A().ensureFont(e.target.value);
      put('font', e.target.value); };
    panel.querySelector('#tSize').oninput = e => {
      panel.querySelector('#v-tsize').textContent = e.target.value + 'px';
      put('size', +e.target.value); };
    panel.querySelector('#tTrack').oninput = e => {
      panel.querySelector('#v-ttrack').textContent = (+e.target.value).toFixed(3) + 'em';
      put('tracking', +e.target.value); };
    panel.querySelector('#tLh').oninput = e => {
      panel.querySelector('#v-tlh').textContent = (+e.target.value).toFixed(2);
      put('lineHeight', +e.target.value); };
    panel.querySelector('#tColor').oninput = e => put('color', e.target.value);
    panel.querySelectorAll('.ed-seg button').forEach(bt => bt.onclick = () => {
      const v = bt.dataset.v;
      put(bt.dataset.t, v === 'true' ? true : v === 'false' ? false : (isNaN(+v) ? v : +v));
      bt.parentElement.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      bt.classList.add('on'); });
    panel.querySelector('#tFollow')?.addEventListener('click', () => {
      delete (TS()[key] || {}).mobile; live(); textPanel(key, findText(key));
      say('This text now follows the computer version on phones'); });
    panel.querySelector('#tReset').onclick = () => {
      const t = TS()[key];
      if (t) { delete t[onPhone() ? 'mobile' : 'desktop']; if (!Object.keys(t).length) delete TS()[key]; }
      live(); textPanel(key, findText(key)); say('Text style reset'); };

    panel.classList.add('open');
  }

  /* ---------------- media ---------------- */
  const filePicker = Object.assign(document.createElement('input'),
    {type:'file', accept:'image/*', style:'display:none'});
  document.body.appendChild(filePicker);
  const toBase64 = f => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

  /* Straight-from-camera photos are ~6 MB and 20+ megapixels. Browsers refuse
     to use images that large as page backgrounds, and they'd be brutal for
     visitors anyway. Shrink to something a website can actually use. */
  const MAX_EDGE = 2400, JPEG_Q = 0.82;
  async function prepareImage(file) {
    if (!/^image\//.test(file.type)) return { blob: file, name: file.name };
    // small PNGs keep their transparency (logos, marks)
    if (file.type === 'image/png' && file.size < 1_200_000) return { blob: file, name: file.name };

    let src = null;
    try { src = await createImageBitmap(file); }
    catch {
      try {
        const url = URL.createObjectURL(file);
        src = await new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
        });
      } catch { return { blob: file, name: file.name, failed: true }; }
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    if (scale === 1 && file.size < 900_000) { src.close?.(); return { blob: file, name: file.name }; }

    const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    src.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', JPEG_Q));
    if (!blob) return { blob: file, name: file.name, failed: true };
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
             from: { w: w0, h: h0, kb: Math.round(file.size / 1024) },
             to:   { w, h, kb: Math.round(blob.size / 1024) } };
  }

  /* An uploaded file is committed to GitHub, but Cloudflare needs ~a minute to
     publish it — until then its URL 404s and the picture looks like it never
     arrived. Show the local file straight away so you can see what you added. */
  const PREVIEW = new Map();   // data path -> blob url
  function applyPreviews() {
    for (const [path, url] of PREVIEW) {
      if (/\.bgImage$/.test(path)) {
        const i = path.split('.')[1];
        const layer = document.querySelector(`[data-blk="${i}"] .blk-bg`);
        if (layer) layer.style.backgroundImage = `url('${url}')`;
      } else {
        const host = document.querySelector(`[data-media="${path}"]`);
        const img = host?.querySelector('img');
        if (img) img.src = url;
        else if (host) {
          host.querySelector('.ph-label')?.remove();
          const el = document.createElement('img');
          el.src = url; el.alt = '';
          host.prepend(el);
        }
      }
    }
  }

  function pickImage(path, after) {
    // A click is a real user gesture, so we can open the sign-in popup right
    // here instead of just refusing and leaving nothing to see.
    if (!token) return requireAuth();
    filePicker.value = '';
    filePicker.onchange = async () => {
      const f = filePicker.files[0]; if (!f) return;
      if (f.size > 25*1024*1024) return say('That file is enormous — keep it under 25 MB', 5000);
      say('Preparing ' + f.name + '…', 20000);
      try {
        const prepared = await prepareImage(f);
        if (prepared.to) {
          say(`Shrinking ${prepared.from.w}×${prepared.from.h} (${prepared.from.kb} KB) ` +
              `to ${prepared.to.w}×${prepared.to.h} (${prepared.to.kb} KB), then uploading…`, 20000);
        } else {
          say('Uploading ' + f.name + '…', 20000);
        }
        const name = Date.now() + '-' + prepared.name.replace(/[^\w.\-]/g,'_');
        await putFile('assets/uploads/' + name, await toBase64(prepared.blob), 'Upload ' + name);
        set(D(), path, '/assets/uploads/' + name);
        PREVIEW.set(path, URL.createObjectURL(prepared.blob));
        markDirty(); redraw();
        say('Photo added — visible here now, and on the live site about a minute after you Publish.', 8000);
        if (after) after();
      } catch (e) { say('Upload failed: ' + e.message, 6000); }
    };
    filePicker.click();
  }

  function wireMedia() {
    document.querySelectorAll('[data-media],[data-video-path]').forEach(el => {
      const bar2 = document.createElement('div');
      bar2.className = 'ed-mediabar';
      const btns = [];
      if (el.dataset.media)
        btns.push(`<button class="ed-chip" data-a="img">${get(D(), el.dataset.media) ? 'Replace' : 'Add'} photo</button>`);
      if (el.dataset.videoPath)
        btns.push(`<button class="ed-chip" data-a="vid" ${el.dataset.hasvideo?'style="background:#2E4057"':''}>${el.dataset.hasvideo?'✓ Video':'Video link'}</button>`);
      if (!btns.length) return;
      bar2.innerHTML = btns.join('');
      el.style.position = el.style.position || 'relative';
      el.appendChild(bar2);
      bar2.querySelectorAll('button').forEach(b2 => b2.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        if (b2.dataset.a === 'img') pickImage(el.dataset.media);
        else {
          const cur = get(D(), el.dataset.videoPath) || '';
          const v = prompt('Paste any YouTube or Vimeo link (the normal one from the address bar).\n\nLeave empty to remove.', cur);
          if (v !== null) { set(D(), el.dataset.videoPath, v.trim()); markDirty(); redraw();
            say(v.trim() ? 'Video added' : 'Video removed'); }
        }
      });
    });
  }

  /* ---------------- list items (add / duplicate / delete / drag) ---------------- */
  const ITEM_TEMPLATE = {
    'projects.items': () => ({title:'New Project',category:'Category',thumbnail:'',videoUrl:''}),
    'gallery.items':  () => ({image:'',alt:'Photo'}),
    'services.items': () => ({number:'00',title:'New service',description:'What it is.',bullets:['Point']}),
    'bullets':        () => 'New point',
    'paragraphs':     () => 'New paragraph.',
    'stats':          () => ({value:'10',label:'Label'}),
    'socials':        () => ({label:'Instagram',url:'https://'}),
    'buttons':        () => ({label:'Button',link:'#',solid:false}),
    'items':          () => 'New item',
    'nav':            () => ({label:'Link',link:'#'}),
  };
  function templateFor(listPath) {
    const b = D().blocks?.[+listPath.split('.')[1]];
    if (b && ITEM_TEMPLATE[b.type + '.' + listPath.split('.').slice(2).join('.')])
      return ITEM_TEMPLATE[b.type + '.items']();
    const tail = listPath.split('.').pop();
    if (ITEM_TEMPLATE[tail]) return ITEM_TEMPLATE[tail]();
    const arr = get(D(), listPath);
    const sample = arr?.[arr.length-1];
    if (typeof sample === 'string') return 'New item';
    if (sample && typeof sample === 'object') {
      const c = {}; for (const k in sample) c[k] = typeof sample[k] === 'string' ? '' : sample[k];
      return c;
    }
    return 'New item';
  }

  function wireLists() {
    // per-item controls
    document.querySelectorAll('[data-item]').forEach(el => {
      const [listPath, idx] = splitLast(el.dataset.item);
      const b2 = document.createElement('div');
      b2.className = 'ed-itembar';
      b2.innerHTML = `<button class="ed-chip grab" data-a="drag" title="Drag to reorder">⠿</button>
                      <button class="ed-chip" data-a="dup" title="Duplicate">＋</button>
                      <button class="ed-chip del" data-a="del" title="Delete">✕</button>`;
      el.appendChild(b2);
      b2.querySelectorAll('button').forEach(btn => {
        btn.onmousedown = e => { if (btn.dataset.a === 'drag') el.draggable = true; e.stopPropagation(); };
        btn.onmouseup = () => { el.draggable = false; };
        btn.onclick = e => {
          e.preventDefault(); e.stopPropagation();
          const arr = get(D(), listPath);
          if (btn.dataset.a === 'dup') {
            const v = arr[idx];
            arr.splice(idx+1, 0, typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
            markDirty(); redraw(); say('Duplicated');
          }
          if (btn.dataset.a === 'del') {
            arr.splice(idx,1); markDirty(); redraw(); say('Removed');
          }
        };
      });
      // drag to reorder within its list
      el.addEventListener('dragstart', e => {
        drag = { kind:'item', listPath, from: idx }; el.classList.add('ed-drag');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx));
        e.stopPropagation();
      });
      el.addEventListener('dragend', () => { el.classList.remove('ed-drag'); el.draggable = false;
        clearGuides(); drag = null; drop = null; });
      el.addEventListener('dragover', e => {
        if (!drag || drag.kind !== 'item' || drag.listPath !== listPath) return;
        e.preventDefault(); e.stopPropagation();
        const r = el.getBoundingClientRect();
        const horizontal = r.width < window.innerWidth * 0.8;
        const after = horizontal ? (e.clientX - r.left) > r.width/2 : (e.clientY - r.top) > r.height/2;
        showGuides(r, after, horizontal ? 'x' : 'y');
        drop = { to: idx, after };
      });
      el.addEventListener('drop', e => {
        if (!drag || drag.kind !== 'item' || !drop || drag.listPath !== listPath) return;
        e.preventDefault(); e.stopPropagation();
        moveIn(get(D(), listPath), drag.from, drop.after ? drop.to+1 : drop.to);
        markDirty(); clearGuides(); redraw(); say('Moved');
      });
    });

    // "add item" button at the end of every list
    document.querySelectorAll('[data-list]').forEach(host => {
      const path = host.dataset.list;
      const btn = document.createElement('button');
      btn.className = 'ed-chip';
      btn.style.cssText = 'display:block;margin:14px auto 0;padding:9px 16px';
      btn.textContent = '+ Add';
      btn.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        get(D(), path).push(templateFor(path));
        markDirty(); redraw(); say('Added');
      };
      host.appendChild(btn);
    });
  }
  function moveIn(arr, from, to) {
    if (from < to) to--;
    if (from === to) return;
    arr.splice(to, 0, arr.splice(from,1)[0]);
  }

  /* ---------------- block toolbars + inserters ---------------- */

  /* The nav is fixed; a toolbar pinned inside the block would slide under it.
     Pin the toolbar to the viewport instead, clamped to the block's own edges
     and always below the nav, so it's reachable at any scroll position. */
  let pinned = null;
  function placeBar(el, tb, tag) {
    const nav = document.querySelector('nav');
    const nb = nav ? nav.getBoundingClientRect().bottom : 0;
    const r = el.getBoundingClientRect();
    const top = Math.min(Math.max(nb + 8, r.top + 8), r.bottom - 44);
    for (const [node, side] of [[tb,'right'], [tag,'left']]) {
      if (!node) continue;
      node.style.position = 'fixed';
      node.style.top = Math.round(top) + 'px';
      if (side === 'right') { node.style.right = Math.round(innerWidth - r.right + 8) + 'px'; node.style.left = 'auto'; }
      else { node.style.left = Math.round(r.left + r.width * 0.05) + 'px'; node.style.right = 'auto'; }
    }
  }
  const repin = () => { if (pinned) placeBar(pinned.el, pinned.tb, pinned.tag); };
  addEventListener('scroll', repin, { passive: true });
  addEventListener('resize', repin);

  function wireBlocks() {
    pinned = null;
    const host = document.getElementById('blocks');
    const blocks = [...host.querySelectorAll(':scope > .blk')];

    blocks.forEach((el, i) => {
      const b = D().blocks[i];
      const name = (CATALOGUE.find(c=>c[0]===b.type)||[,b.type])[1];

      const tag = document.createElement('div');
      tag.className = 'ed-blkname';
      tag.textContent = name;
      el.appendChild(tag);

      const tb = document.createElement('div');
      tb.className = 'ed-blkbar';
      tb.innerHTML = `
        <button class="ed-chip grab" data-a="drag" title="Drag to move">⠿</button>
        <button class="ed-chip" data-a="up" title="Move up">↑</button>
        <button class="ed-chip" data-a="down" title="Move down">↓</button>
        <button class="ed-chip" data-a="set">Settings</button>
        <button class="ed-chip" data-a="dup" title="Duplicate">⧉</button>
        <button class="ed-chip del" data-a="del" title="Delete">✕</button>`;
      el.appendChild(tb);

      tb.querySelectorAll('button').forEach(btn => {
        btn.onmousedown = e => { if (btn.dataset.a === 'drag') el.draggable = true; e.stopPropagation(); };
        btn.onmouseup = () => { el.draggable = false; };
        btn.onclick = e => {
          e.preventDefault(); e.stopPropagation();
          const B = D().blocks;
          switch (btn.dataset.a) {
            case 'up':   if (i > 0) { moveIn(B, i, i-1); markDirty(); redraw(); } break;
            case 'down': if (i < B.length-1) { moveIn(B, i, i+2); markDirty(); redraw(); } break;
            case 'set':  blockPanel(i); break;
            case 'dup': { const c = JSON.parse(JSON.stringify(B[i])); c.id = uid();
                          B.splice(i+1,0,c); markDirty(); redraw(); say('Duplicated'); break; }
            case 'del':  if (confirm(`Delete this ${name.toLowerCase()} block?`)) {
                           B.splice(i,1); markDirty(); redraw(); closePanel(); say('Deleted'); } break;
          }
        };
      });

      el.addEventListener('mouseenter', () => { pinned = {el, tb, tag}; placeBar(el, tb, tag); });
      el.addEventListener('mouseleave', () => { if (pinned && pinned.el === el) pinned = null; });

      el.addEventListener('dragstart', e => {
        drag = { kind:'block', from:i }; el.classList.add('ed-drag');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain','blk'+i);
      });
      el.addEventListener('dragend', () => { el.classList.remove('ed-drag'); el.draggable = false;
        clearGuides(); drag = null; drop = null; });
      el.addEventListener('dragover', e => {
        if (!drag || drag.kind !== 'block') return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const after = (e.clientY - r.top) > r.height/2;
        showGuides(r, after, 'y');
        drop = { to:i, after };
      });
      el.addEventListener('drop', e => {
        if (!drag || drag.kind !== 'block' || !drop) return;
        e.preventDefault();
        moveIn(D().blocks, drag.from, drop.after ? drop.to+1 : drop.to);
        markDirty(); clearGuides(); redraw(); say('Block moved');
      });
    });

    // inserters between and around blocks
    const mkIns = at => {
      const row = document.createElement('div');
      row.className = 'ed-ins-row';
      row.innerHTML = `<button class="ed-ins-btn">+ Add block here</button>`;
      row.querySelector('button').onclick = () => openPicker(at);
      return row;
    };
    blocks.forEach((el, i) => host.insertBefore(mkIns(i), el));
    host.appendChild(mkIns(blocks.length));
  }

  /* ---------------- guides (shared by all drags) ---------------- */
  const layer = Object.assign(document.createElement('div'), {className:'ed-guides'});
  layer.innerHTML = `<div class="ed-ins"></div>
    <div class="ed-g h" id="gT"></div><div class="ed-g h" id="gB"></div>
    <div class="ed-g v" id="gL"></div><div class="ed-g v" id="gR"></div>
    <div class="ed-snap v" id="snapV"></div><div class="ed-snap h" id="snapH"></div>`;
  document.body.appendChild(layer);
  const ins = layer.querySelector('.ed-ins');
  const gT=layer.querySelector('#gT'), gB=layer.querySelector('#gB'),
        gL=layer.querySelector('#gL'), gR=layer.querySelector('#gR'),
        snapV=layer.querySelector('#snapV'), snapH=layer.querySelector('#snapH');
  let drag = null, drop = null;

  function showGuides(r, after, axis) {
    gT.style.top = r.top+'px'; gB.style.top = r.bottom+'px';
    gL.style.left = r.left+'px'; gR.style.left = r.right+'px';
    [gT,gB,gL,gR].forEach(e=>e.style.display='block');
    if (axis === 'x') {
      Object.assign(ins.style, {left:(after?r.right+6:r.left-8)+'px', top:r.top+'px',
        width:'3px', height:r.height+'px', display:'block'});
    } else {
      Object.assign(ins.style, {left:r.left+'px', top:(after?r.bottom-2:r.top-2)+'px',
        width:r.width+'px', height:'3px', display:'block'});
    }
  }
  const clearGuides = () => [ins,gT,gB,gL,gR,snapV,snapH].forEach(e=>e.style.display='none');

  /* ---------------- free move ---------------- */
  const readout = Object.assign(document.createElement('div'), {className:'ed-pos'});
  document.body.appendChild(readout);
  const freeBtn = bar.querySelector('#edFree');
  freeBtn.onclick = () => {
    freeMode = !freeMode;
    document.body.classList.toggle('ed-free', freeMode);
    freeBtn.classList.toggle('on', freeMode);
    document.querySelectorAll('[data-path]').forEach(el => el.contentEditable = String(!freeMode));
    if (freeMode) hideTextBtn();
    say(freeMode
      ? `Drag anything. Double-click to snap it back. Positions are saved for ${onPhone()?'phones':'computers'} only.`
      : 'Free move off', 3800);
  };
  const SNAP = 7;
  function candidates(moving) {
    const xs = [], ys = [];
    document.querySelectorAll('[data-move]').forEach(el => {
      if (el === moving || moving.contains(el) || el.contains(moving)) return;
      const r = el.getBoundingClientRect(); if (!r.width) return;
      xs.push(r.left, r.left+r.width/2, r.right);
      ys.push(r.top, r.top+r.height/2, r.bottom);
    });
    // page edges + centre — measured from the page itself so the phone frame works too
    const pr = document.getElementById('blocks').getBoundingClientRect();
    const g = pr.width * 0.05;
    xs.push(pr.left + g, pr.left + pr.width/2, pr.right - g);
    return {xs, ys};
  }
  function wireFree() {
    document.querySelectorAll('[data-move]').forEach(el => {
      el.addEventListener('mousedown', e => {
        if (!freeMode || e.button !== 0 || e.target.closest('.ed-chip,.ed-blkbar,.ed-itembar')) return;
        e.preventDefault();
        // computer and phone each remember their own positions
        const key = el.dataset.move;
        const off = onPhone() ? (D().offsetsMobile ||= {}) : (D().offsets ||= {});
        const cur = off[key] || {x:0,y:0};
        const sx = e.clientX, sy = e.clientY, {xs,ys} = candidates(el);
        const before = snap();
        el.classList.add('ed-moving'); readout.style.display = 'block';
        const move = ev => {
          let dx = cur.x + (ev.clientX-sx), dy = cur.y + (ev.clientY-sy);
          el.style.transform = `translate(${dx}px,${dy}px)`;
          const r = el.getBoundingClientRect();
          let hx=null, hy=null;
          for (const ex of [r.left,r.left+r.width/2,r.right])
            for (const cx of xs) if (Math.abs(ex-cx)<SNAP) { dx += cx-ex; hx=cx; break; }
          for (const ey of [r.top,r.top+r.height/2,r.bottom])
            for (const cy of ys) if (Math.abs(ey-cy)<SNAP) { dy += cy-ey; hy=cy; break; }
          el.style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`;
          snapV.style.display = hx===null?'none':'block'; if(hx!==null) snapV.style.left = hx+'px';
          snapH.style.display = hy===null?'none':'block'; if(hy!==null) snapH.style.top = hy+'px';
          readout.style.left = (ev.clientX+16)+'px'; readout.style.top = (ev.clientY+16)+'px';
          readout.textContent = `${Math.round(dx)}, ${Math.round(dy)}`;
          el._p = {x:Math.round(dx), y:Math.round(dy)};
        };
        const up = () => {
          removeEventListener('mousemove', move); removeEventListener('mouseup', up);
          el.classList.remove('ed-moving');
          snapV.style.display = snapH.style.display = readout.style.display = 'none';
          if (el._p) { off[key] = el._p; delete el._p;
            past.push(before); last = snap(); future.length = 0;
            dirty = true; saveBtn.disabled = false; saveBtn.textContent = 'Publish';
            saveBtn.classList.add('unsaved'); }
        };
        addEventListener('mousemove', move); addEventListener('mouseup', up);
      });
      el.addEventListener('dblclick', e => {
        if (!freeMode) return;
        e.preventDefault();
        delete (onPhone() ? (D().offsetsMobile ||= {}) : (D().offsets ||= {}))[el.dataset.move];
        el.style.transform = ''; markDirty(); say('Snapped back');
      });
    });
  }

  /* ---------------- redraw ---------------- */
  function redraw() {
    const y = scrollY;
    A().render(D());
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
    wireText(); wireMedia(); wireLists(); wireBlocks(); wireFree();
    applyPreviews();
    if (freeMode) document.querySelectorAll('[data-path]').forEach(el => el.contentEditable = 'false');
    scrollTo(0, y);
  }

  /* ---------------- GitHub ---------------- */
  async function gh(path, opts={}) {
    const r = await fetch(API + path, { ...opts,
      headers:{ Authorization:'Bearer '+token, Accept:'application/vnd.github+json', ...(opts.headers||{}) }});
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).message || r.status);
    return r.json();
  }
  async function putFile(path, contentB64, message) {
    let sha;
    try { sha = (await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`)).sha; } catch {}
    return gh(`/repos/${REPO}/contents/${path}`, { method:'PUT',
      body: JSON.stringify({ message, content:contentB64, branch:BRANCH, ...(sha?{sha}:{}) }) });
  }
  const utf8b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const b64utf8 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g,'')), c=>c.charCodeAt(0)));

  saveBtn.onclick = async () => {
    if (!token) return requireAuth();
    if (saveBtn.disabled) return;
    saveBtn.disabled = true; saveBtn.textContent = 'Publishing…';
    try {
      if (baseline !== null) {
        try {
          const live = await gh(`/repos/${REPO}/contents/content/site.json?ref=${BRANCH}`);
          const stored = JSON.stringify(A().migrate(JSON.parse(b64utf8(live.content))));
          if (stored !== baseline) {
            const okGo = confirm(
              'The saved content is newer than what this page loaded (edited from another tab or device).\n\n' +
              'Publishing now overwrites those changes.\n\nOK = publish anyway  ·  Cancel = stop and reload.');
            if (!okGo) { saveBtn.disabled = false; saveBtn.textContent = 'Publish'; return; }
          }
        } catch {}
      }
      await putFile('content/site.json', utf8b64(JSON.stringify(D(), null, 2)), 'Update site content');
      baseline = snap(); dirty = false; saveBtn.textContent = 'Saved';
      saveBtn.classList.remove('unsaved');
      say('Published ✓ — live in about 30 seconds', 5000);
    } catch (e) {
      saveBtn.disabled = false; saveBtn.textContent = 'Publish';
      say('Failed: ' + e.message, 6000);
    }
  };

  /* ---------------- login ---------------- */
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
          removeEventListener('message', onMsg); w.close(); rej(new Error('Sign-in failed'));
        }
      };
      addEventListener('message', onMsg);
    });
  }
  const loginBtn = bar.querySelector('#edLogin');
  let authRunning = false;

  /** Sign in from wherever the user clicked. Returns true if already signed in. */
  async function requireAuth() {
    if (token) return true;
    if (authRunning) return false;
    authRunning = true;
    loginBtn.textContent = 'Opening…'; loginBtn.disabled = true;
    say('Opening the GitHub sign-in window…', 8000);
    try {
      token = await login();
      loginBtn.textContent = 'Signed in'; loginBtn.classList.add('on'); loginBtn.disabled = true;
      say('Signed in ✓ — now click the button again to pick your photo', 7000);
    } catch (e) {
      loginBtn.textContent = 'Sign in'; loginBtn.disabled = false;
      say(e.message, 8000);
    }
    authRunning = false;
    return false;
  }
  loginBtn.onclick = () => requireAuth();

  /* ---------------- boot ---------------- */
  if (!D().offsets || typeof D().offsets !== 'object') D().offsets = {};
  if (!D().offsetsMobile || typeof D().offsetsMobile !== 'object') D().offsetsMobile = {};
  if (!D().textStyles || typeof D().textStyles !== 'object') D().textStyles = {};
  if (!D().style || typeof D().style !== 'object') D().style = {};
  if (!Array.isArray(D().blocks)) D().blocks = [];
  A().buildDeviceCSS();
  A().setDevice('desktop');
  devBar.querySelectorAll('button').forEach(b2 => b2.classList.toggle('on', b2.dataset.d === 'desktop'));
  baseline = snap(); last = snap();
  redraw();
  say('Click any text to edit, then “Aa Style this text” to change just that one · switch Computer / Phone at the top', 9000);
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
