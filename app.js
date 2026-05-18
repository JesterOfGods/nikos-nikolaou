/* ════════════════════════════════════════════════════════════════════════
   Nikos Nikolaou — personal site
   Single-file app. Sections (search for "═══" to jump):
     0. Utilities
     1. State + storage
     2. Data loading
     3. Narrator (queue, cooldowns, priorities, anti-repeat, audio)
     4. Intro flow (audio prompt → cold open → doors)
     5. Views (adventurer + patron renderers)
     6. View switching + swap escalation
     7. Showcase overlay (CSS-mood scenes)
     8. Console (~)
     9. Easter eggs (cursed button, konami, d20, devtools detect)
     10. Ambient triggers (idle, blur, late-night)
     11. Boot
   ════════════════════════════════════════════════════════════════════════ */


/* ════ 0. Utilities ════ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else if (v != null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}


/* ════ 1. State + storage ════ */

const LS = {
  AUDIO:    'nikos.audio',         // 'on' | 'off'
  SEEN_INTRO: 'nikos.seenIntro',   // '1'
  VIEW:     'nikos.view',          // 'adventurer' | 'patron'
  VISITS:   'nikos.visits',        // number
};

const State = {
  data: null,          // loaded content + voicelines + now
  view: 'adventurer',
  audioEnabled: false,
  swapCount: 0,        // mid-session view swaps
  cursedClicks: 0,
};

const Storage = {
  get(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  incVisits() {
    const v = parseInt(this.get(LS.VISITS, '0'), 10) || 0;
    this.set(LS.VISITS, String(v + 1));
    return v + 1;
  },
};


/* ════ 2. Data loading ════ */

async function loadData() {
  try {
    const [content, voicelines, now] = await Promise.all([
      fetch('data/content.json').then(r => r.json()),
      fetch('data/voicelines.json').then(r => r.json()),
      fetch('data/now.json').then(r => r.json()),
    ]);
    State.data = { content, voicelines, now };
  } catch (err) {
    console.error('Data load failed:', err);
    showDataError();
    throw err;
  }
}

function showDataError() {
  document.body.innerHTML = `
    <div style="padding:2rem;font-family:sans-serif;color:#ece4d4;background:#0e0d0c;height:100vh;">
      <h1 style="color:#c69b5e;">Data didn't load.</h1>
      <p>This site loads its data via fetch. If you're opening this from a <code>file://</code> URL,
      your browser will block it. Run a local server:</p>
      <pre style="background:#1a1611;padding:1rem;border-radius:6px;">npx serve .</pre>
      <p>Then open the URL it prints. Deployed to GitHub Pages or Netlify, it just works.</p>
    </div>`;
}


/* ════ 3. Narrator ════ */

const Narrator = {
  queue: [],
  current: null,
  lastFired: {},
  history: [],   // recent line IDs for anti-repeat
  audioEl: null,
  bubbleEl: null,
  textEl: null,
  hideTimer: null,
  textTimer: null,
  cooldownDefault: 8000,

  init() {
    this.bubbleEl = $('#narrator');
    this.textEl = $('#narratorText');
    this.audioEl = $('#narratorAudio');
    this.audioEl.addEventListener('ended', () => this.audioEnded());
    this.audioEl.addEventListener('error', () => this.audioEnded()); // graceful fallback
    $('#audioToggle').addEventListener('click', () => this.toggleAudio());
    $('#dismissNarrator').addEventListener('click', () => this.dismiss());
    this.refreshAudioIcon();
  },

  fire(triggerId, opts = {}) {
    const { priority = 'NORMAL', cooldown = this.cooldownDefault } = opts;
    const lines = State.data?.voicelines?.[triggerId];
    if (!lines || lines.length === 0) return;

    // Cooldown check
    const last = this.lastFired[triggerId];
    if (last && Date.now() - last < cooldown && priority !== 'HIGH') return;

    const line = this.pickLine(lines);
    if (!line) return;

    if (priority === 'HIGH') {
      this.stopCurrent();
      this.queue = [{ triggerId, line }];
      this.playNext();
    } else if (priority === 'NORMAL') {
      if (this.current) {
        this.queue = [{ triggerId, line }];   // replace queue (latest wins)
      } else {
        this.queue.push({ triggerId, line });
        this.playNext();
      }
    } else { // LOW
      if (this.current || this.queue.length > 0) return; // drop
      this.queue.push({ triggerId, line });
      this.playNext();
    }

    this.lastFired[triggerId] = Date.now();
  },

  pickLine(lines) {
    const recent = new Set(this.history.slice(-3));
    const available = lines.filter(l => !recent.has(l.id));
    return rand(available.length ? available : lines);
  },

  playNext() {
    if (this.current) return;
    const slot = this.queue.shift();
    if (!slot) return;
    this.current = slot;
    this.history.push(slot.line.id);
    if (this.history.length > 20) this.history.shift();
    this.showBubble(slot.line.text);
    if (State.audioEnabled && slot.line.id) {
      this.playAudio(slot.line.id);
    } else {
      // Auto-dismiss after estimated read time
      const ms = this.estimateReadMs(slot.line.text);
      this.hideTimer = setTimeout(() => this.audioEnded(), ms);
    }
  },

  playAudio(id) {
    const src = `audio/${id}.mp3`;
    this.audioEl.src = src;
    this.audioEl.play().catch(() => {
      // Audio file missing or blocked — fall back to text timer
      const ms = this.estimateReadMs(this.current?.line.text || '');
      this.hideTimer = setTimeout(() => this.audioEnded(), ms);
    });
  },

  audioEnded() {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.current = null;
    // Brief gap before next line, then continue queue or hide bubble
    setTimeout(() => {
      if (this.queue.length > 0) this.playNext();
      else this.hideBubble();
    }, 350);
  },

  stopCurrent() {
    try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch {}
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.current = null;
  },

  estimateReadMs(text) {
    // ~14 chars/sec slow read, min 2.5s, max 10s
    return clamp(text.length * 70, 2500, 10000);
  },

  showBubble(text) {
    this.bubbleEl.hidden = false;
    this.bubbleEl.classList.remove('leaving');
    this.textEl.textContent = text;
  },

  hideBubble() {
    if (this.current || this.queue.length > 0) return;
    this.bubbleEl.classList.add('leaving');
    setTimeout(() => {
      if (!this.current && this.queue.length === 0) this.bubbleEl.hidden = true;
    }, 300);
  },

  dismiss() {
    this.stopCurrent();
    this.queue = [];
    this.hideBubble();
  },

  toggleAudio() {
    State.audioEnabled = !State.audioEnabled;
    Storage.set(LS.AUDIO, State.audioEnabled ? 'on' : 'off');
    this.refreshAudioIcon();
    // Acknowledge with a line
    this.fire(State.audioEnabled ? 'audioOn' : 'audioOff', { priority: 'HIGH' });
    // If user just toggled OFF while a line was playing, stop audio but keep text
    if (!State.audioEnabled) {
      try { this.audioEl.pause(); } catch {}
    }
  },

  refreshAudioIcon() {
    const btn = $('#audioToggle');
    btn.textContent = State.audioEnabled ? '🔊' : '🔈';
    btn.setAttribute('aria-pressed', State.audioEnabled ? 'true' : 'false');
  },
};


/* ════ 4. Intro flow ════ */

const Intro = {
  finished: false,

  start() {
    const skip = $('#skipIntro');
    skip.addEventListener('click', () => this.skip());
    $$('#audioPrompt .introBtn').forEach(btn => {
      btn.addEventListener('click', () => this.chooseAudio(btn.dataset.audio === 'on'));
    });
    $$('.door').forEach(btn => {
      btn.addEventListener('click', () => this.chooseDoor(btn.dataset.view));
    });

    const seenBefore = Storage.get(LS.SEEN_INTRO) === '1';
    if (seenBefore) {
      // Returning visitor — light flow
      this.chooseAudio(Storage.get(LS.AUDIO) === 'on', { quick: true });
    }
  },

  chooseAudio(audioOn, { quick = false } = {}) {
    State.audioEnabled = audioOn;
    Storage.set(LS.AUDIO, audioOn ? 'on' : 'off');
    Narrator.refreshAudioIcon();

    $('#audioPrompt').classList.remove('introStep--active');
    const coldOpen = $('#coldOpenScreen');
    coldOpen.classList.add('introStep--active');
    coldOpen.setAttribute('aria-hidden', 'false');

    const isReturning = Storage.get(LS.SEEN_INTRO) === '1';

    if (quick && isReturning) {
      // Short return line, skip the full cold open typewriter
      $('#coldOpenText').textContent = '';
      $('#coldOpenText').classList.add('done');
      $('#doors').classList.add('visible');
      // Trigger return line through narrator AFTER intro is gone
      setTimeout(() => Narrator.fire('returningVisitor', { priority: 'HIGH' }), 600);
    } else {
      this.runColdOpen();
    }
  },

  async runColdOpen() {
    const textEl = $('#coldOpenText');
    const lines = State.data.voicelines.coldOpen;
    const line = lines[0];
    const fullText = line.text;

    // Pre-play audio if enabled — kicks off in parallel with type-on
    if (State.audioEnabled) {
      Narrator.audioEl.src = `audio/${line.id}.mp3`;
      Narrator.audioEl.play().catch(() => {});
    }

    // Type-on effect
    textEl.textContent = '';
    textEl.classList.remove('done');
    const charDelay = 22; // fast type
    for (let i = 0; i < fullText.length; i++) {
      if (this.skipped) break;
      textEl.textContent += fullText[i];
      // Slight pause on punctuation for rhythm
      const ch = fullText[i];
      const extra = ('.,—').includes(ch) ? 150 : 0;
      await sleep(charDelay + extra);
    }
    textEl.textContent = fullText;
    textEl.classList.add('done');
    await sleep(400);
    $('#doors').classList.add('visible');
  },

  skip() {
    this.skipped = true;
    try { Narrator.audioEl.pause(); } catch {}
    // Force-finish text + reveal doors immediately
    const lines = State.data.voicelines.coldOpen;
    $('#coldOpenText').textContent = lines[0].text;
    $('#coldOpenText').classList.add('done');
    $('#audioPrompt').classList.remove('introStep--active');
    const coldOpen = $('#coldOpenScreen');
    coldOpen.classList.add('introStep--active');
    coldOpen.setAttribute('aria-hidden', 'false');
    $('#doors').classList.add('visible');
  },

  chooseDoor(view) {
    Storage.set(LS.SEEN_INTRO, '1');
    Storage.set(LS.VIEW, view);
    State.view = view;
    Storage.incVisits();

    // Fade out intro
    const intro = $('#intro');
    intro.classList.add('fading');
    setTimeout(() => { intro.style.display = 'none'; }, 500);

    // Reveal app
    document.body.classList.remove('boot');
    $('#app').hidden = false;
    Views.activate(view);

    // Door-choice line
    setTimeout(() => {
      Narrator.fire(view === 'adventurer' ? 'pickAdventurer' : 'pickPatron', { priority: 'HIGH' });
    }, 700);
  },
};


/* ════ 5. Views ════ */

const Views = {
  built: { adventurer: false, patron: false },

  activate(view) {
    State.view = view;
    Storage.set(LS.VIEW, view);
    $$('.view').forEach(v => {
      const active = v.id === `view-${view}`;
      v.classList.toggle('active', active);
      v.hidden = !active;
    });
    $$('.viewBtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view ? 'true' : 'false'));
    if (!this.built[view]) {
      view === 'adventurer' ? this.renderAdventurer() : this.renderPatron();
      this.built[view] = true;
    }
  },

  renderAdventurer() {
    const d = State.data.content;

    // Header
    $('.charName').textContent = d.identity.name;
    $('.classChain').textContent = d.identity.classChain;
    $('.raceLine').textContent = `${d.identity.race} · ${d.identity.location}`;
    $('.alignmentValue').textContent = d.identity.alignment;
    $('.bio').textContent = d.identity.bio;
    $('.brandName').textContent = d.identity.shortName + ' Nikolaou';
    $('.brandTag').textContent = d.identity.tagline;

    // Stats
    const statsGrid = $('#statsGrid');
    statsGrid.replaceChildren(...d.stats.map(s => {
      const mod = Math.floor((s.value - 10) / 2);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      return el('button', {
          class: 'stat', dataset: { id: s.id },
          onclick: () => Narrator.fire(`clickStat_${s.id}`, { priority: 'NORMAL', cooldown: 4000 })
        },
        el('div', { class: 'statLabel' }, s.label),
        el('div', { class: 'statValue' }, String(s.value)),
        el('div', { class: 'statMod' }, modStr),
        el('div', { class: 'statBlurb' }, s.blurb),
      );
    }));

    // Saving throws
    $('#savingThrows').replaceChildren(...d.savingThrows.map(st => el('li', { class: `savingThrow ${st.type}` },
      el('span', { class: 'mod' }, st.modifier),
      el('span', { class: 'label' }, st.label),
    )));

    // Traits
    $('#traits').replaceChildren(...d.traits.map(t => el('li', { class: 'trait' },
      el('div', { class: 'name' }, t.name),
      el('div', { class: 'desc' }, t.desc),
    )));

    // Skills
    $('#skills').replaceChildren(...d.skills.map(s => el('li', {
        class: 'skill', dataset: { id: s.id },
        onclick: () => Narrator.fire(`clickSkill_${s.id}`, { priority: 'NORMAL', cooldown: 4000 })
      },
      el('span', { class: 'name' }, s.name),
      el('span', { class: 'level' }, s.level),
      el('span', { class: 'years' }, `${s.years} yr`),
    )));

    // Languages
    $('#languages').replaceChildren(...d.languages.map(l => el('li', { class: 'language' },
      el('span', { class: 'name' }, l.name),
      el('span', { class: 'level' }, l.level),
    )));

    // Quests (from now.json)
    $('#quests').replaceChildren(...State.data.now.items.map(q => el('li', { class: 'quest' },
      el('span', { class: 'label' }, q.label),
      el('span', { class: 'value' }, q.value),
    )));

    // Companions (work)
    $('#companions').replaceChildren(...d.work.map(w => el('div', {
        class: 'companion',
        onclick: () => Narrator.fire(`clickProject_${w.id}`, { priority: 'NORMAL', cooldown: 4000 })
      },
      el('div', { class: 'role' }, w.role),
      el('div', { class: 'company' }, `${w.company} · ${w.location}`),
      el('div', { class: 'period' }, w.period),
      el('ul', { class: 'bullets' }, ...w.bullets.map(b => el('li', {}, b))),
    )));

    // Factions
    $('#factions').replaceChildren(...d.factions.map(f => el('div', {
        class: 'faction', dataset: { id: f.id },
        style: { '--faction-color': f.color },
        onclick: () => Narrator.fire(`clickFaction_${f.id}`, { priority: 'NORMAL', cooldown: 4000 })
      },
      el('div', { class: 'name' }, f.name),
      el('div', { class: 'game' }, f.game),
      el('div', { class: 'blurb' }, f.blurb),
    )));

    // Showcases (tiles in sheet)
    $('#showcases').replaceChildren(...d.showcases.map(s => el('button', {
        class: 'showcaseTile', dataset: { id: s.id },
        onclick: () => Showcase.open(s.id)
      },
      el('div', {},
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'tagline' }, s.tagline),
      ),
      el('div', { class: 'tags' }, ...s.tags.slice(0, 4).map(t => el('span', { class: 'tag' }, t))),
      el('div', { class: 'statusDot' }, '● ' + s.status),
    )));

    // Library
    const lib = d.library;
    $('#library').replaceChildren(
      libCategory('Books', lib.books, lib.booksNote, 'lib_1'),
      libCategory('Games', lib.games, null),
      libCategory('Films', lib.films, null),
      libCategory('Anime', lib.anime, null),
      libCategory('Series', lib.series, null),
    );

    // Backstory + contact
    const bs = $('#backstory');
    bs.replaceChildren(
      el('p', {}, d.identity.bio),
      el('p', {}, 'Greek by birth, Copenhagen by choice. Twin MSc — Medialogy (Aalborg, "Comfort XR") and Products & Systems Design Engineering (Aegean, "Big Chimera" — location-based serious AR game). Currently building a TTRPG system on the side. Probably has more hobbies than fingers.'),
      el('div', { class: 'backstoryMeta' },
        el('a', { href: 'mailto:' + d.identity.email }, '✉ ' + d.identity.email),
        el('a', { href: d.identity.linkedin, target: '_blank', rel: 'noopener' }, '🔗 LinkedIn'),
        el('span', {}, '📍 ' + d.identity.location),
      ),
    );
  },

  renderPatron() {
    const d = State.data.content;

    $('.patronName').textContent = d.identity.name;
    $('.patronTag').textContent = d.identity.tagline;
    $('.patronBio').textContent = d.identity.bio;
    $('#patronEmail').textContent = '✉ ' + d.identity.email;
    $('#patronEmail').setAttribute('href', 'mailto:' + d.identity.email);
    $('#patronLinkedin').setAttribute('href', d.identity.linkedin);
    $('#patronLinkedin').setAttribute('target', '_blank');
    $('#patronLinkedin').setAttribute('rel', 'noopener');

    // Work
    $('#patronWork').replaceChildren(...d.work.map(w => el('div', { class: 'patronJob' },
      el('div', { class: 'row' },
        el('div', {},
          el('div', { class: 'roleLine' }, w.role),
          el('div', { class: 'companyLine' }, `${w.company} · ${w.location}`),
        ),
        el('div', { class: 'period' }, w.period),
      ),
      el('ul', {}, ...w.bullets.map(b => el('li', {}, b))),
    )));

    // Skills
    $('#patronSkills').replaceChildren(...d.skills.map(s => el('div', { class: 'patronSkillChip' },
      s.name,
      el('span', { class: 'y' }, `${s.years}y`),
    )));

    // Showcases (compact tile)
    $('#patronShowcases').replaceChildren(...d.showcases.map(s => el('button', {
        class: 'patronShowcase',
        onclick: () => Showcase.open(s.id)
      },
      el('div', { class: 't' }, s.title),
      el('div', { class: 's' }, s.tagline),
    )));

    // Education
    $('#patronEducation').replaceChildren(...d.education.map(e => el('div', { class: 'patronEdu' },
      el('div', { class: 'deg' }, e.degree),
      el('div', { class: 'inst' }, e.institution),
      el('div', { class: 'thesis' }, e.thesis),
    )));

    // Beyond Work
    $('#patronBeyond').textContent =
      'Tabletop DM for 6+ years (D&D, building my own TTRPG system). Mini painter (Grey Knights for 40k, Rohan for MESBG). 3D printing (resin + FDM — ran my own company for a while). MTG Commander. Adversarial communicator by sport. Will not be taking the Books proficiency.';
  },
};

function libCategory(title, items, emptyNote, emptyTrigger) {
  const isEmpty = !items || items.length === 0;
  return el('div', { class: 'libCategory' },
    el('h3', {}, title),
    isEmpty
      ? el('div', { class: 'empty', onclick: emptyTrigger ? () => Narrator.fire('clickLibrary', { priority: 'NORMAL', cooldown: 4000 }) : null }, emptyNote || 'Nothing yet.')
      : el('div', {}, ...items.map(item => el('div', {
          class: 'libItem',
          onclick: () => {
            // Specific Easter eggs
            if (/beginner's guide/i.test(item.title)) Narrator.fire('clickLibrary_film_beginnersGuide', { priority: 'NORMAL', cooldown: 4000 });
          }
        }, item.title, item.note ? el('span', { class: 'libNote' }, '— ' + item.note) : null))),
  );
}


/* ════ 6. View switching + swap escalation ════ */

const ViewSwap = {
  init() {
    $$('.viewBtn').forEach(b => {
      b.addEventListener('click', () => this.swap(b.dataset.view));
    });
  },

  swap(view) {
    if (view === State.view) return;
    Views.activate(view);
    State.swapCount += 1;
    // Escalating swap lines
    const triggers = ['swapView_first', 'swapView_second', 'swapView_third', 'swapView_fourth', 'swapView_repeat'];
    const triggerId = triggers[Math.min(State.swapCount - 1, triggers.length - 1)];
    Narrator.fire(triggerId, { priority: 'HIGH', cooldown: 0 });
  },
};


/* ════ 7. Showcase overlay ════ */

const Showcase = {
  el: null,
  init() {
    this.el = $('#showcase');
    $('#closeShowcase').addEventListener('click', () => this.close());
    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) this.close();
    });
  },
  open(id) {
    const sc = State.data.content.showcases.find(s => s.id === id);
    if (!sc) return;

    $('#showcaseTitle').textContent = sc.title;
    $('#showcaseTagline').textContent = sc.tagline;
    $('#showcaseTags').replaceChildren(...sc.tags.map(t => el('span', { class: 'tag' }, t)));

    // Hero — image or placeholder
    const hero = $('#showcaseHero');
    if (sc.hero) {
      // Use a probe so missing files fall back gracefully
      const img = new Image();
      img.onload = () => { hero.classList.add('has-image'); hero.style.backgroundImage = `url("${sc.hero}")`; hero.innerHTML = ''; };
      img.onerror = () => { hero.classList.remove('has-image'); hero.style.backgroundImage = ''; hero.replaceChildren(el('div', { class: 'placeholder' }, 'Hero image goes here.', el('span', {}, `drop a file at ${sc.hero}`))); };
      img.src = sc.hero;
    } else {
      hero.classList.remove('has-image');
      hero.innerHTML = '';
    }

    // Gallery — placeholders for now
    const gallery = $('#showcaseGallery');
    if (sc.gallery && sc.gallery.length > 0) {
      gallery.replaceChildren(...sc.gallery.map(src => {
        const item = el('div', { class: 'galleryItem' });
        const img = new Image();
        img.onload = () => { item.classList.add('has-image'); item.style.backgroundImage = `url("${src}")`; };
        img.src = src;
        return item;
      }));
    } else {
      gallery.replaceChildren(
        el('div', { class: 'galleryItem' }),
        el('div', { class: 'galleryItem' }),
        el('div', { class: 'galleryItem' }),
      );
    }

    $('#showcaseStory').textContent = sc.story;
    $('#showcaseMilestones').replaceChildren(...sc.milestones.map(m => el('li', {}, m)));

    this.el.setAttribute('data-mood', sc.mood);
    this.el.hidden = false;
    this.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    Narrator.fire(`openShowcase_${id}`, { priority: 'HIGH', cooldown: 0 });
  },
  close() {
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.el.hidden = true;
      this.el.classList.remove('leaving');
      this.el.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }, 280);
    Narrator.fire('closeShowcase', { priority: 'NORMAL', cooldown: 0 });
  },
};


/* ════ 8. Console (~) ════ */

const Console = {
  el: null, history: null, input: null,
  visible: false,
  cmdHistory: [], cmdIdx: -1,

  init() {
    this.el = $('#console');
    this.history = $('#consoleHistory');
    this.input = $('#consoleInput');

    document.addEventListener('keydown', (e) => {
      // Ignore if typing in another input/textarea (unless it's our input)
      const inField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement !== this.input;
      if (e.key === '`' || e.key === '~') {
        if (inField) return;
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.visible) {
        this.hide();
      }
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.input.value.trim();
        this.input.value = '';
        if (cmd) {
          this.cmdHistory.push(cmd); this.cmdIdx = this.cmdHistory.length;
          this.run(cmd);
        }
      } else if (e.key === 'ArrowUp') {
        if (this.cmdIdx > 0) this.cmdIdx--;
        this.input.value = this.cmdHistory[this.cmdIdx] || '';
      } else if (e.key === 'ArrowDown') {
        if (this.cmdIdx < this.cmdHistory.length) this.cmdIdx++;
        this.input.value = this.cmdHistory[this.cmdIdx] || '';
      }
    });
  },

  toggle() { this.visible ? this.hide() : this.show(); },
  show() {
    this.el.hidden = false;
    this.visible = true;
    this.input.focus();
    if (this.history.children.length === 0) {
      this.print('nikos@dm:~$ tilde to toggle. type "help" for commands.', 'out');
      Narrator.fire('openConsole', { priority: 'HIGH', cooldown: 5000 });
    }
  },
  hide() { this.el.hidden = true; this.visible = false; },

  print(text, cls = 'out') {
    const row = el('div', { class: `row ${cls}` }, text);
    this.history.append(row);
    this.history.scrollTop = this.history.scrollHeight;
  },

  run(cmd) {
    this.print(`nikos@dm:~$ ${cmd}`);
    const [name, ...args] = cmd.split(/\s+/);
    const handler = this.commands[name.toLowerCase()];
    if (handler) handler.call(this, args);
    else this.print(`unknown command: ${name}. type "help".`, 'err');
  },

  commands: {
    help() {
      this.print('Available:', 'out');
      this.print('  help                    — this list', 'out');
      this.print('  whoami                  — who is Nikos', 'out');
      this.print('  ls hobbies              — list current hobbies', 'out');
      this.print('  ls work                 — list work history', 'out');
      this.print('  cast <spell>            — cast a spell (try fireball)', 'out');
      this.print('  roll [Nd]M              — dice roll, e.g. roll 1d20', 'out');
      this.print('  view adventurer|patron  — switch view', 'out');
      this.print('  contact                 — how to reach him', 'out');
      this.print('  clear                   — clear console', 'out');
      this.print('  exit                    — close console', 'out');
    },
    whoami() {
      this.print(State.data.content.identity.name + ' — ' + State.data.content.identity.tagline, 'out');
    },
    ls(args) {
      const what = (args[0] || '').toLowerCase();
      if (what === 'hobbies') {
        this.print('MTG Commander · 3D printing (resin + FDM) · mini painting (40k Grey Knights, MESBG Rohan) · D&D DM · building own TTRPG · adversarial conversation', 'out');
      } else if (what === 'work') {
        State.data.content.work.forEach(w => this.print(`${w.period}  ${w.role} @ ${w.company}`, 'out'));
      } else this.print('ls: try "hobbies" or "work"', 'err');
    },
    cast(args) {
      const spell = (args[0] || '').toLowerCase();
      const grimoire = {
        fireball: '🔥 You cast Fireball. Roll 8d6 fire damage. (The sheet smells faintly of smoke.)',
        magicmissile: '✨ Three darts of force, three targets, no save. He always picks this.',
        identify: '🔍 You learn the magic in this site. Mostly vanilla JS and one CSS file.',
        counterspell: '🛑 You counter the spell. There was no spell. He counters yours instead.',
      };
      const result = grimoire[spell] || `You don't know "${args[0] || ''}". Try "fireball".`;
      this.print(result, 'narr');
    },
    roll(args) {
      const m = (args[0] || '1d20').match(/^(\d+)?d(\d+)$/i);
      if (!m) { this.print('roll: format is NdM, e.g. 1d20', 'err'); return; }
      const n = parseInt(m[1] || '1', 10);
      const sides = parseInt(m[2], 10);
      if (n < 1 || n > 100 || sides < 2 || sides > 1000) { this.print('roll: keep it reasonable.', 'err'); return; }
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      this.print(`🎲 ${rolls.join(' + ')} = ${total}`, 'narr');
    },
    view(args) {
      const v = (args[0] || '').toLowerCase();
      if (v === 'adventurer' || v === 'patron') ViewSwap.swap(v);
      else this.print('view: adventurer | patron', 'err');
    },
    contact() {
      this.print('✉ ' + State.data.content.identity.email, 'out');
      this.print('🔗 ' + State.data.content.identity.linkedin, 'out');
      this.print('📍 ' + State.data.content.identity.location, 'out');
    },
    clear() { this.history.innerHTML = ''; },
    exit()  { this.hide(); },
  },
};


/* ════ 9. Easter eggs ════ */

const Cursed = {
  init() {
    $('#cursedButton').addEventListener('click', () => this.click());
  },
  click() {
    State.cursedClicks += 1;
    const app = $('#app');
    app.classList.remove('glitching'); void app.offsetWidth; // restart animation
    app.classList.add('glitching');
    setTimeout(() => app.classList.remove('glitching'), 900);
    Narrator.fire(State.cursedClicks === 1 ? 'cursedButton_first' : 'cursedButton_repeat', { priority: 'HIGH', cooldown: 0 });
  },
};

const D20 = {
  init() {
    $('#d20Btn').addEventListener('click', () => this.roll());
  },
  roll() {
    const value = 1 + Math.floor(Math.random() * 20);
    const result = $('#d20Result');
    result.classList.remove('nat20', 'nat1');
    result.textContent = `Rolled ${value}`;
    let trigger = 'd20_normal';
    if (value === 20) { result.classList.add('nat20'); result.textContent = `🎯 NAT 20 — ${value}`; trigger = 'd20_nat20'; }
    else if (value === 1) { result.classList.add('nat1'); result.textContent = `💀 NAT 1 — ${value}`; trigger = 'd20_nat1'; }
    Narrator.fire(trigger, { priority: 'HIGH', cooldown: 0 });
  },
};

const Konami = {
  seq: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'],
  idx: 0,
  triggered: false,
  init() {
    document.addEventListener('keydown', (e) => {
      if (this.triggered) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === this.seq[this.idx]) {
        this.idx += 1;
        if (this.idx === this.seq.length) this.fire();
      } else {
        this.idx = key === this.seq[0] ? 1 : 0;
      }
    });
  },
  fire() {
    this.triggered = true;
    Narrator.fire('konami', { priority: 'HIGH', cooldown: 0 });
    document.documentElement.style.setProperty('--accent', '#e8a857');
    // Easter-egg shimmer for 4 seconds
    document.body.animate(
      [{ filter: 'hue-rotate(0)' }, { filter: 'hue-rotate(15deg)' }, { filter: 'hue-rotate(0)' }],
      { duration: 4000, iterations: 1 }
    );
  },
};

const DevTools = {
  triggered: false,
  init() {
    // Heuristic: if the gap between window.outerWidth and innerWidth is big, devtools is likely open
    const check = () => {
      if (this.triggered) return;
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        this.triggered = true;
        Narrator.fire('openDevTools', { priority: 'LOW', cooldown: 60000 });
      }
    };
    window.addEventListener('resize', check);
    setTimeout(check, 2000);
  },
};


/* ════ 10. Ambient triggers ════ */

const Ambient = {
  idleTimer: null,
  init() {
    // Idle 60s
    const reset = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        Narrator.fire('idle_30s', { priority: 'LOW', cooldown: 90000 });
      }, 60000);
    };
    ['mousemove','keydown','scroll','click','touchstart'].forEach(evt => window.addEventListener(evt, reset, { passive: true }));
    reset();

    // Tab blur
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        Narrator.fire('tabBlurred', { priority: 'LOW', cooldown: 120000 });
      }
    });

    // Late night
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
      setTimeout(() => Narrator.fire('lateNight', { priority: 'LOW', cooldown: 0 }), 5000);
    }

    // Fast skim — detects scroll velocity bursts
    let lastScroll = 0; let lastTime = Date.now(); let skimFired = false;
    window.addEventListener('scroll', () => {
      const now = Date.now();
      const dt = now - lastTime;
      const dy = Math.abs(window.scrollY - lastScroll);
      if (dt > 50 && dy / dt > 2.5 && !skimFired) {
        skimFired = true;
        Narrator.fire('fastSkim', { priority: 'LOW', cooldown: 30000 });
        setTimeout(() => skimFired = false, 30000);
      }
      lastScroll = window.scrollY; lastTime = now;
    }, { passive: true });
  },
};


/* ════ 11. Boot ════ */

async function boot() {
  State.audioEnabled = Storage.get(LS.AUDIO) === 'on';
  await loadData();

  Narrator.init();
  Intro.start();
  ViewSwap.init();
  Showcase.init();
  Console.init();
  Cursed.init();
  D20.init();
  Konami.init();
  DevTools.init();
  Ambient.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
