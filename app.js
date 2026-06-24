/* Greet anyone who opens DevTools — they're the kind of person who'd enjoy what's hidden. */
console.log('%c👋 You opened the inspector.', 'color:#c69b5e;font-size:14px;font-weight:700;font-family:monospace;');
console.log('%c   He hoped you would. Press ~ to open the terminal.', 'color:#9a8c6f;font-size:12px;font-family:monospace;');

/* ════════════════════════════════════════════════════════════════════════
   Nikos Nikolaou — personal site
   Single-file app. Sections (search for "═══" to jump):
     0. Utilities
     1. State + storage
     2. Data loading
     3. Narrator (queue, cooldowns, priorities, anti-repeat, audio)
     4. Intro flow (audio prompt → cold open → doors)
     5. Views (adventurer + commoner renderers)
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
  VIEW:     'nikos.view',          // 'adventurer' | 'commoner'
  VISITS:   'nikos.visits',        // number
  D20_RESULT: 'nikos.d20Result',   // last roll, persists; one roll per visitor
  // The "trolled" flag is intentionally in-memory only (State.cursedTrolled)
  // so the joke resets on reload.
};

const State = {
  data: null,          // loaded content + voicelines + now
  view: 'adventurer',
  audioEnabled: false,
  swapCount: 0,        // mid-session view swaps
  swapSilenced: false, // narrator has given up on swap commentary for this session
  cursedClicks: 0,
  cursedTrolled: false, // resets on reload — button reappears after refresh
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
    const [content, voicelines, now, assetManifest] = await Promise.all([
      fetch('data/content.json').then(r => r.json()),
      fetch('data/voicelines.json').then(r => r.json()),
      fetch('data/now.json').then(r => r.json()),
      fetch('data/asset-manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    // Merge auto-discovered images into showcases.
    // Rules:
    //   - coverHero.images: if empty/missing, fall back to manifest entries for that id.
    //   - gallery: if empty/missing AND no coverHero, fall back to manifest minus the hero file.
    //   - gallery: false opts out entirely (hero only, no gallery even if images exist).
    //   - slideshow: true reads the manifest directly at render time, so skip merging here.
    //   - manual values always win, so individual showcases can override.
    for (const sc of (content.showcases || [])) {
      if (sc.gallery === false || sc.slideshow) continue;
      const manifestImgs = assetManifest[sc.id] || [];
      if (!manifestImgs.length) continue;
      if (sc.coverHero) {
        if (!Array.isArray(sc.coverHero.images) || sc.coverHero.images.length === 0) {
          sc.coverHero.images = manifestImgs.slice();
        }
      } else if (!Array.isArray(sc.gallery) || sc.gallery.length === 0) {
        sc.gallery = manifestImgs.filter(p => p !== sc.hero);
      }
    }
    State.data = { content, voicelines, now, assetManifest };
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
  current: null,         // currently playing { line, triggerId }
  lastFired: {},         // trigger -> ts (for per-trigger cooldown)
  history: [],           // recent line IDs (anti-repeat)
  audioEl: null,
  bubbleEl: null,
  textEl: null,
  hideTimer: null,
  cooldownDefault: 8000,

  init() {
    this.bubbleEl = $('#narrator');
    this.textEl = $('#narratorText');
    this.audioEl = $('#narratorAudio');
    this.audioEl.addEventListener('ended', () => this.audioEnded());
    // If audio fails to load (file missing, 404, network), don't dismiss the
    // bubble — fall back to the text-read timer so the visitor can still read.
    this.audioEl.addEventListener('error', () => this.audioFailedFallback());
    $('#audioToggle').addEventListener('click', () => this.toggleAudio());
    $('#dismissNarrator').addEventListener('click', () => this.dismiss());
    this.refreshAudioIcon();
  },

  /* No queue — every fire pre-empts the current line and plays the new one.
     Cooldown is per-trigger (don't spam the same one); anti-repeat history
     keeps multi-line triggers from saying the same line twice in a row. */
  fire(triggerId, opts = {}) {
    const { cooldown = this.cooldownDefault, onEnd = null } = opts;
    const lines = State.data?.voicelines?.[triggerId];
    if (!lines || lines.length === 0) { if (onEnd) onEnd(); return; }

    const last = this.lastFired[triggerId];
    if (last && Date.now() - last < cooldown) { if (onEnd) onEnd(); return; }

    const line = this.pickLine(lines);
    if (!line) { if (onEnd) onEnd(); return; }

    this.stopCurrent();
    this._onEnd = onEnd;
    this.playLine(triggerId, line);
    this.lastFired[triggerId] = Date.now();
  },

  pickLine(lines) {
    const recent = new Set(this.history.slice(-3));
    const available = lines.filter(l => !recent.has(l.id));
    return rand(available.length ? available : lines);
  },

  playLine(triggerId, line) {
    this.current = { triggerId, line };
    this.history.push(line.id);
    if (this.history.length > 20) this.history.shift();
    this.showBubble(line.text);
    if (State.audioEnabled && line.id) {
      this.playAudio(line.id);
    } else {
      const ms = this.estimateReadMs(line.text);
      this.hideTimer = setTimeout(() => this.audioEnded(), ms);
    }
  },

  /* Deterministic version of fire() — plays one specific line from a bank by
     index, skipping random pick and cooldown. Used by the secrets-modal hint
     button where escalation order matters. */
  fireLine(triggerId, line, opts = {}) {
    const { onEnd = null } = opts;
    if (!line) { if (onEnd) onEnd(); return; }
    this.stopCurrent();
    this._onEnd = onEnd;
    this.playLine(triggerId, line);
  },

  playAudio(id) {
    const src = `audio/${id}.mp3`;
    this.audioEl.src = src;
    this.audioEl.play().catch(() => this.audioFailedFallback());
  },

  /* Audio file missing / blocked / 404 — keep the bubble visible for the
     estimated read time so the visitor still sees the line. */
  audioFailedFallback() {
    if (!this.current) return;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    const ms = this.estimateReadMs(this.current.line.text || '');
    this.hideTimer = setTimeout(() => this.audioEnded(), ms);
  },

  audioEnded() {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.current = null;
    const cb = this._onEnd; this._onEnd = null;
    if (cb) { try { cb(); } catch {} }
    // Bubble stays visible until the visitor dismisses it or another line plays.
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
    // If the cursed button is parked under where the bubble just appeared,
    // shove it out of the way now that the bubble's rect is known.
    requestAnimationFrame(() => Cursed?.moveIfOverlapping?.());
  },

  hideBubble() {
    if (this.current) return;
    this.bubbleEl.classList.add('leaving');
    setTimeout(() => {
      if (!this.current) this.bubbleEl.hidden = true;
    }, 300);
  },

  dismiss() {
    this.stopCurrent();
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
    // We always show the audio prompt on every load. Browsers block audio
    // playback without a user gesture, so the prompt's click is the gesture
    // that authorises everything downstream. Returning visitors just see a
    // different cold-open line.
    const promptTitle = $('#audioPromptTitle');
    if (promptTitle && Storage.get(LS.SEEN_INTRO) === '1') {
      promptTitle.textContent = '🔊 Back again. Voice on?';
    }
  },

  chooseAudio(audioOn) {
    State.audioEnabled = audioOn;
    Storage.set(LS.AUDIO, audioOn ? 'on' : 'off');
    Narrator.refreshAudioIcon();

    $('#audioPrompt').classList.remove('introStep--active');
    const coldOpen = $('#coldOpenScreen');
    coldOpen.classList.add('introStep--active');
    coldOpen.setAttribute('aria-hidden', 'false');

    this.runColdOpen();
  },

  async runColdOpen() {
    const textEl = $('#coldOpenText');
    const isReturning = Storage.get(LS.SEEN_INTRO) === '1';
    const is3am = new Date().getHours() === 3;
    // 3am window replaces the welcome entirely — easter egg for the insomniacs.
    let bank;
    if (is3am && State.data.voicelines.welcome_3am) bank = State.data.voicelines.welcome_3am;
    else if (isReturning) bank = State.data.voicelines.returningVisitor || State.data.voicelines.coldOpen;
    else bank = State.data.voicelines.coldOpen;
    const line = bank[Math.floor(Math.random() * bank.length)];
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
    const isReturning = Storage.get(LS.SEEN_INTRO) === '1';
    const bank = isReturning
      ? (State.data.voicelines.returningVisitor || State.data.voicelines.coldOpen)
      : State.data.voicelines.coldOpen;
    const line = bank[0];
    $('#coldOpenText').textContent = line.text;
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
      Narrator.fire(view === 'adventurer' ? 'pickAdventurer' : 'pickCommoner', { priority: 'HIGH' });
    }, 700);
  },
};


/* ════ 5. Views ════ */

const Views = {
  built: { adventurer: false, commoner: false },

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
      view === 'adventurer' ? this.renderAdventurer() : this.renderCommoner();
      this.built[view] = true;
    }
    // Cursed zone lives on <body>; toggle its visibility per view.
    const zone = document.getElementById('cursedZone');
    if (zone) zone.style.display = view === 'adventurer' ? '' : 'none';
  },

  renderAdventurer() {
    const d = State.data.content;

    // Header
    $('.charName').textContent = d.identity.name;
    $('.classChain').textContent = d.identity.classChain;
    $('.raceLine').textContent = `${d.identity.race} · ${d.identity.location}`;
    $('.alignmentValue').textContent = d.identity.alignment;
    $('.sheetIntro').textContent = d.identity.adventurerIntro;
    $('.brandName').textContent = d.identity.shortName + ' Nikolaou';
    $('.brandTag').textContent = d.identity.tagline;

    // Stats
    const statsGrid = $('#statsGrid');
    statsGrid.replaceChildren(...d.stats.map(s => {
      const mod = Math.floor((s.value - 10) / 2);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      return el('button', {
          class: 'stat', dataset: { id: s.id },
          onclick: () => {
            Narrator.fire(`clickStat_${s.id}`, { cooldown: 4000 });
          }
        },
        el('div', { class: 'statLabel' }, s.label),
        el('div', { class: 'statValue' }, String(s.value)),
        el('div', { class: 'statMod' }, modStr),
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
      el('button', {
        class: 'languageBtn',
        type: 'button',
        onclick: () => Narrator.fire(`clickLang_${l.id}`, { priority: 'NORMAL', cooldown: 4000 })
      },
        el('span', { class: 'name' }, l.name),
        el('span', { class: 'level' }, l.level),
      ),
    )));

    // Quests (from now.json)
    $('#quests').replaceChildren(...State.data.now.items.map(q => el('li', { class: 'quest' },
      el('span', { class: 'label' }, q.label),
      el('span', { class: 'value' }, q.value),
    )));

    // Completed Quests (work) — timeline layout. Date column anchors each job
    // on a left rail; click opens a showcase (or fires a narrator line if none).
    $('#companions').replaceChildren(...d.work.map(w => {
      const hasShowcase = d.showcases.some(s => s.id === w.id);
      return el('div', {
          class: 'companion' + (hasShowcase ? ' companion--linked' : ''),
          onclick: () => {
            if (hasShowcase) Showcase.open(w.id);
            else Narrator.fire(`clickProject_${w.id}`, { priority: 'NORMAL', cooldown: 4000 });
          },
        },
        el('div', { class: 'companionDate' }, w.period),
        el('div', { class: 'companionDot' }),
        el('div', { class: 'companionBody' },
          el('div', { class: 'role' }, w.role, hasShowcase ? el('span', { class: 'companionMore' }, '↗ open') : null),
          el('div', { class: 'company' }, `${w.company} · ${w.location}`),
          el('ul', { class: 'bullets' }, ...w.bullets.map(b => el('li', {}, b))),
        ),
      );
    }));

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

    // Showcases (tiles in sheet) — job + education showcases are shown via
    // the Completed Quests and Library cards instead.
    const anchoredIds = new Set([
      ...d.work.map(w => w.id),
      ...(d.education || []).map(e => e.id).filter(Boolean),
    ]);
    $('#showcases').replaceChildren(...d.showcases.filter(s => !anchoredIds.has(s.id)).map(s => el('button', {
        class: 'showcaseTile', dataset: { id: s.id },
        onclick: () => Showcase.open(s.id)
      },
      el('div', {},
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'tagline' }, s.tagline),
      ),
      el('div', { class: 'tileFoot' },
        el('div', { class: 'tags' }, ...s.tags.slice(0, 4).map(t => el('span', { class: 'tag' }, t))),
        el('div', { class: 'statusDot' }, '● ' + s.status),
      ),
    )));

    // Library — training & lore (formal education). Each card opens its
    // matching showcase if one exists; falls back to a generic narrator line.
    $('#library').replaceChildren(...d.education.map(e => {
      const hasShowcase = e.id && d.showcases.some(s => s.id === e.id);
      return el('div', {
          class: 'libEdu' + (hasShowcase ? ' libEdu--linked' : ''),
          onclick: () => {
            if (hasShowcase) Showcase.open(e.id);
            else Narrator.fire('clickLibrary', { priority: 'NORMAL', cooldown: 4000 });
          },
        },
        el('div', { class: 'libDeg' }, e.degree, hasShowcase ? el('span', { class: 'libMore' }, '↗ open') : null),
        el('div', { class: 'libInst' }, e.institution),
        el('div', { class: 'libThesis' }, e.thesis),
        e.tags && e.tags.length ? el('div', { class: 'libTags' }, ...e.tags.map(t => el('span', { class: 'tag' }, t))) : null,
      );
    }));

    $('.sheetBackstory').textContent = d.identity.backstory;
    $('#sheetInvite').textContent = d.identity.sheetInvite || '';
    $('#sheetMeta').replaceChildren(
      el('a', { href: 'mailto:' + d.identity.email }, '✉ ' + d.identity.email),
      el('a', { href: d.identity.linkedin, target: '_blank', rel: 'noopener' }, '🔗 LinkedIn'),
      el('span', {}, '📍 ' + d.identity.location),
    );

    // Cursed seal — lives in a bottom-of-page "zone" and teleports inside it on
    // each click. Zone is appended to <body> so .app's glitch transform can't
    // capture the containing block. Visibility gated per-view in Views.activate.
    if (!document.getElementById('cursedZone') && !State.cursedTrolled) {
      const zone = el('div', { id: 'cursedZone', class: 'cursedZone' },
        el('button', {
          id: 'cursedButton',
          class: 'cursedButton cursedButton--floating',
          'aria-label': 'Do not click',
          title: "don't",
        }, '⚠ DO NOT CLICK'),
      );
      document.body.append(zone);
    }

    // Restore D20 result if visitor already rolled this visit (LS-backed).
    const savedRoll = Storage.get(LS.D20_RESULT);
    if (savedRoll != null) {
      const value = parseInt(savedRoll, 10);
      if (!isNaN(value)) D20.applyResult(value, { restoring: true });
    }
  },

  renderCommoner() {
    const d = State.data.content;

    $('.commonerName').textContent = d.identity.name;
    $('.commonerTag').textContent = d.identity.tagline;
    $('.commonerBio').textContent = d.identity.bio;
    $('#commonerEmail').textContent = '✉ ' + d.identity.email;
    $('#commonerEmail').setAttribute('href', 'mailto:' + d.identity.email);
    $('#commonerLinkedin').setAttribute('href', d.identity.linkedin);
    $('#commonerLinkedin').setAttribute('target', '_blank');
    $('#commonerLinkedin').setAttribute('rel', 'noopener');

    // Work — bullets shown inline as before; each job with a showcase gets a small
    // "Read more" button that opens it (these work tabs used to live in Selected Work).
    $('#commonerWork').replaceChildren(...d.work.map(w => {
      const hasShowcase = d.showcases.some(s => s.id === w.id);
      return el('div', { class: 'commonerJob' },
        el('div', { class: 'row' },
          el('div', {},
            el('div', { class: 'roleLine' }, w.role),
            el('div', { class: 'companyLine' }, `${w.company} · ${w.location}`),
          ),
          el('div', { class: 'period' }, w.period),
        ),
        el('ul', {}, ...w.bullets.map(b => el('li', {}, b))),
        hasShowcase ? el('button', { class: 'commonerReadMore', onclick: () => Showcase.open(w.id) }, 'Read more ↗') : null,
      );
    }));

    // Skills
    $('#commonerSkills').replaceChildren(...d.skills.map(s => el('div', { class: 'commonerSkillChip' },
      s.name,
      el('span', { class: 'y' }, `${s.years}y`),
    )));

    // Selected Work (compact tile) — work showcases now open from each job's
    // "Read more" button, and education showcases live in the Education section,
    // so exclude both here. What remains is the standalone project work.
    const educationIds = new Set((d.education || []).map(e => e.id).filter(Boolean));
    const workIds = new Set(d.work.map(w => w.id));
    $('#commonerShowcases').replaceChildren(...d.showcases.filter(s => !educationIds.has(s.id) && !workIds.has(s.id)).map(s => {
      const v = cleanCut(s);
      return el('button', {
        class: 'commonerShowcase',
        onclick: () => Showcase.open(s.id)
      },
      el('div', { class: 't' }, v.title),
      el('div', { class: 's' }, v.tagline),
    );
    }));

    // Education — each degree with a matching showcase (medialogy, aegean) gets the
    // same "Read more" button as Experience, for consistency.
    $('#commonerEducation').replaceChildren(...d.education.map(e => {
      const hasShowcase = e.id && d.showcases.some(s => s.id === e.id);
      return el('div', { class: 'commonerEdu' },
        el('div', { class: 'deg' }, e.degree),
        el('div', { class: 'inst' }, e.institution),
        el('div', { class: 'thesis' }, e.thesis),
        hasShowcase ? el('button', { class: 'commonerReadMore', onclick: () => Showcase.open(e.id) }, 'Read more ↗') : null,
      );
    }));
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
    if (State.swapSilenced) return;
    // Escalating swap lines, then one "giving up" line, then silence.
    let triggerId;
    if (State.swapCount === 1)      triggerId = 'swapView_first';
    else if (State.swapCount === 2) triggerId = 'swapView_second';
    else if (State.swapCount === 3) triggerId = 'swapView_third';
    else if (State.swapCount === 4) triggerId = 'swapView_fourth';
    else if (State.swapCount < 8)   triggerId = 'swapView_repeat';
    else {
      triggerId = 'swapView_giveup';
      State.swapSilenced = true;
    }
    Narrator.fire(triggerId, { priority: 'HIGH', cooldown: 0 });
  },
};


/* ════ 7. Showcase overlay ════ */

// The clean, professional cut of a showcase — what commoners see. `clean` is a
// sparse overlay (only the fields that differ, e.g. tagline/story/milestones);
// adventurers get the raw, narrated object. Same renderer feeds off both.
function cleanCut(sc) { return sc.clean ? { ...sc, ...sc.clean } : sc; }

const Showcase = {
  el: null,
  init() {
    this.el = $('#showcase');
    $('#closeShowcase').addEventListener('click', () => this.close());
    // Click on backdrop (empty space outside the inner panel) closes too.
    // Strict equality so clicks inside .showcaseInner or on the Back button don't double-fire.
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) this.close();
    });
  },
  open(id) {
    const raw = State.data.content.showcases.find(s => s.id === id);
    if (!raw) return;
    // Commoners get the clean cut; adventurers get the raw, narrated one.
    const sc = State.view === 'commoner' ? cleanCut(raw) : raw;

    $('#showcaseTitle').textContent = sc.title;
    $('#showcaseTagline').textContent = sc.tagline;
    $('#showcaseTags').replaceChildren(...sc.tags.map(t => el('span', { class: 'tag' }, t)));

    // Hero — slideshow, cover-style split layout, background image, or placeholder
    const hero = $('#showcaseHero');
    hero.classList.remove('has-image', 'coverHero', 'slideshow');
    hero.style.backgroundImage = '';
    hero.innerHTML = '';
    if (this._coverInterval) { clearInterval(this._coverInterval); this._coverInterval = null; }

    if (sc.slideshow) {
      // Auto-changing slideshow at hero size, cycling every image for this category.
      const manifestImgs = (State.data.assetManifest && State.data.assetManifest[sc.id]) || [];
      const images = manifestImgs.slice();
      if (sc.hero && !images.includes(sc.hero)) images.unshift(sc.hero);
      hero.classList.add('slideshow');
      if (images.length === 0) {
        hero.replaceChildren(el('div', { class: 'placeholder' }, 'Slideshow images go here.', el('span', {}, `drop files in assets/showcase/${sc.id}/`)));
      } else {
        const slides = images.map((src, i) => el('img', {
          class: 'slide' + (i === 0 ? ' slide--active' : ''),
          src, alt: '', loading: i === 0 ? 'eager' : 'lazy', draggable: 'false',
        }));
        const dots = images.length > 1
          ? images.map((_, i) => el('span', { class: 'slideDot' + (i === 0 ? ' slideDot--active' : ''), 'aria-hidden': 'true' }))
          : [];
        hero.replaceChildren(...slides, dots.length ? el('div', { class: 'slideDots' }, ...dots) : null);
        if (images.length > 1) {
          let idx = 0;
          this._coverInterval = setInterval(() => {
            slides[idx].classList.remove('slide--active');
            if (dots.length) dots[idx].classList.remove('slideDot--active');
            idx = (idx + 1) % slides.length;
            slides[idx].classList.add('slide--active');
            if (dots.length) dots[idx].classList.add('slideDot--active');
          }, sc.slideshowMs || 3500);
        }
      }
    } else if (sc.coverHero) {
      const ch = sc.coverHero;
      const titleParts = Array.isArray(ch.titleParts) && ch.titleParts.length
        ? ch.titleParts
        : [sc.title];
      const images = Array.isArray(ch.images) && ch.images.length
        ? ch.images
        : (ch.image ? [ch.image] : []);
      hero.classList.add('coverHero');
      hero.replaceChildren(
        el('div', { class: 'coverHero__art' },
          el('img', { class: 'coverHero__photo coverHero__photo--a coverHero__photo--active', src: images[0] || '', alt: '' }),
          images.length > 1 ? el('img', { class: 'coverHero__photo coverHero__photo--b', src: '', alt: '' }) : null,
          ch.mask ? el('img', { class: 'coverHero__mask', src: ch.mask, alt: '', 'aria-hidden': 'true' }) : null,
        ),
        el('div', { class: 'coverHero__panel' },
          ch.kicker ? el('span', { class: 'coverHero__kicker' }, ch.kicker) : null,
          el('h3', { class: 'coverHero__title' },
            ...titleParts.map((part, i) => el('span', {
              class: 'coverHero__titlePart' + (part.trim() === '&' ? ' coverHero__titlePart--amp' : ''),
            }, part))
          ),
          el('span', { class: 'coverHero__rule', 'aria-hidden': 'true' }),
          ch.tagline ? el('p', { class: 'coverHero__tagline' }, ch.tagline) : null,
          ch.teaser
            ? (Array.isArray(ch.teaser)
                ? ch.teaser.map(p => el('p', { class: 'coverHero__teaser' }, p))
                : el('p', { class: 'coverHero__teaser' }, ch.teaser))
            : null,
          ch.byline ? el('p', { class: 'coverHero__byline' }, ch.byline) : null,
        ),
      );

      // Crossfade rotation between cover images (only if more than one)
      if (images.length > 1) {
        const imgs = hero.querySelectorAll('.coverHero__photo');
        let idx = 0;
        let activeIdx = 0;
        this._coverInterval = setInterval(() => {
          idx = (idx + 1) % images.length;
          const next = imgs[1 - activeIdx];
          const swap = () => {
            imgs[activeIdx].classList.remove('coverHero__photo--active');
            next.classList.add('coverHero__photo--active');
            activeIdx = 1 - activeIdx;
          };
          next.onload = swap;
          next.src = images[idx];
          if (next.complete && next.naturalHeight > 0) swap();
        }, ch.rotateMs || 5000);
      }
    } else if (sc.hero) {
      const img = new Image();
      img.onload = () => { hero.classList.add('has-image'); hero.style.backgroundImage = `url("${sc.hero}")`; hero.innerHTML = ''; };
      img.onerror = () => { hero.classList.remove('has-image'); hero.style.backgroundImage = ''; hero.replaceChildren(el('div', { class: 'placeholder' }, 'Hero image goes here.', el('span', {}, `drop a file at ${sc.hero}`))); };
      img.src = sc.hero;
    }

    // Gallery — hidden entirely if empty or when the slideshow already shows every image
    const gallery = $('#showcaseGallery');
    if (!sc.slideshow && sc.gallery && sc.gallery.length > 0) {
      gallery.hidden = false;
      gallery.replaceChildren(...sc.gallery.map(src => {
        const item = el('div', { class: 'galleryItem' });
        const img = new Image();
        img.onload = () => { item.classList.add('has-image'); item.style.backgroundImage = `url("${src}")`; };
        img.src = src;
        return item;
      }));
    } else {
      gallery.hidden = true;
      gallery.replaceChildren();
    }

    const storyEl = $('#showcaseStory');
    if (Array.isArray(sc.story)) {
      storyEl.replaceChildren(...sc.story.map(p => el('p', {}, p)));
    } else {
      storyEl.replaceChildren(el('p', {}, sc.story || ''));
    }
    // Milestones — hidden entirely (heading included) when a showcase has none
    const milestones = Array.isArray(sc.milestones) ? sc.milestones : [];
    $('#showcaseMilestonesHeading').hidden = milestones.length === 0;
    $('#showcaseMilestones').replaceChildren(...milestones.map(m => el('li', {}, m)));

    // External links (e.g. a shipped game, the original concept) — hidden when none
    const links = Array.isArray(sc.links) ? sc.links : [];
    const linksEl = $('#showcaseLinks');
    linksEl.hidden = links.length === 0;
    linksEl.replaceChildren(...links.map(l => el('a', {
      class: 'showcaseLink', href: l.url, target: '_blank', rel: 'noopener',
    }, l.label)));

    this.el.setAttribute('data-mood', sc.mood);
    this.el.hidden = false;
    this.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    Narrator.fire(`openShowcase_${id}`, { priority: 'HIGH', cooldown: 0 });
  },
  close() {
    if (this._coverInterval) { clearInterval(this._coverInterval); this._coverInterval = null; }
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.el.hidden = true;
      this.el.classList.remove('leaving');
      this.el.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }, 280);
    // First-time close fires the terminal hint variant; subsequent closes use the generic line.
    if (!Hints.fired.has('closeShowcase_first')) {
      Hints.fireOnce('closeShowcase_first');
    } else {
      Narrator.fire('closeShowcase', { cooldown: 0 });
    }
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
      if (e.key === '`' || e.key === '~' || e.key === ';') {
        if (inField) return;
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.visible) {
        this.hide();
      }
    });

    this.input.addEventListener('keydown', (e) => {
      // When the RPG is active and input is empty, arrows/enter/digits drive its menu.
      const rpgMenuMode = window.RPG?.active && this.input.value === '';
      if (rpgMenuMode) {
        if (e.key === 'ArrowUp')   { e.preventDefault(); window.RPG.menuMove(-1); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); window.RPG.menuMove(1);  return; }
        if (e.key === 'Enter')     { e.preventDefault(); window.RPG.menuRun();    return; }
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); window.RPG.menuPick(parseInt(e.key, 10) - 1); return; }
      }
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
    this.dockNarrator();
    Secrets.unlock('terminal');
    if (this.history.children.length === 0) {
      this.print('nikos@dm:~$ tilde to toggle. type "help" for commands. type `play` to enter the dungeon.', 'out');
      // Any "terminal" — DevTools or this in-page console — gets the same narrator response.
      Narrator.fire('openDevTools', { priority: 'HIGH', cooldown: 5000 });
    }
  },
  hide() {
    this.el.hidden = true;
    this.visible = false;
    this.undockNarrator();
  },

  /* When the console is open the narrator docks to the top of it as a
     terminal-flavored strip — keeps the speech "inside" the same window
     the player is reading instead of floating over the page. */
  dockNarrator() {
    const narrator = $('#narrator');
    if (!narrator) return;
    if (narrator.parentNode === this.el) return;
    this.el.prepend(narrator);
    narrator.classList.add('narrator--docked');
  },
  undockNarrator() {
    const narrator = $('#narrator');
    if (!narrator) return;
    if (narrator.parentNode !== this.el) return;
    document.body.append(narrator);
    narrator.classList.remove('narrator--docked');
  },

  print(text, cls = 'out') {
    const row = el('div', { class: `row ${cls}` }, text);
    this.history.append(row);
    this.history.scrollTop = this.history.scrollHeight;
  },

  /* Clickable line — used by the help listing and one-shot reveals like the
     post-dungeon "Hack Terminal?" prompt. */
  printCmd(cmd, desc) {
    const row = el('div', { class: 'row cmdRow' });
    const btn = el('button', {
      class: 'cmdLink',
      onclick: () => {
        // Commands with placeholders pre-fill the input for the visitor to edit;
        // others run immediately.
        const hasPlaceholder = /[<\[]/.test(cmd);
        if (hasPlaceholder) {
          // Drop placeholder text, keep the verb (e.g. "cast <spell>" → "cast ")
          this.input.value = cmd.replace(/\s*[<\[].+$/, '') + ' ';
          this.input.focus();
        } else {
          this.run(cmd);
        }
      },
    }, cmd);
    row.append(btn);
    if (desc) row.append(el('span', { class: 'cmdDesc' }, ' — ' + desc));
    this.history.append(row);
    this.history.scrollTop = this.history.scrollHeight;
  },

  printButton(label, onClick, cls = 'cmdLink consoleReveal') {
    const row = el('div', { class: 'row' });
    const btn = el('button', { class: cls, onclick: onClick }, label);
    row.append(btn);
    this.history.append(row);
    this.history.scrollTop = this.history.scrollHeight;
  },

  run(cmd) {
    // If RPG game is active, route all input there
    if (window.RPG?.active) {
      this.print(`dungeon> ${cmd}`);
      window.RPG.process(cmd);
      return;
    }
    this.print(`nikos@dm:~$ ${cmd}`);
    const [name, ...args] = cmd.split(/\s+/);
    const handler = this.commands[name.toLowerCase()];
    if (handler) handler.call(this, args);
    else this.print(`unknown command: ${name}. type "help".`, 'err');
  },

  commands: {
    help() {
      this.print('Available — click a command to run, or type:', 'out');
      this.printCmd('help',              'this list');
      this.printCmd('whoami',            'who is Nikos');
      this.printCmd('ls hobbies',        'list current hobbies');
      this.printCmd('ls work',           'list work history');
      this.printCmd('cast <spell>',      'cast a spell (try fireball)');
      this.printCmd('roll 1d20',         'roll dice');
      this.printCmd('view adventurer',   'switch view');
      this.printCmd('view commoner',       'switch view');
      this.printCmd('contact',           'how to reach him');
      this.printCmd('play',              'enter the dungeon (RPG game)');
      this.printCmd('reset',             'wipe state, reload (testing)');
      this.printCmd('clear',             'clear console');
      this.printCmd('exit',              'close console');
    },
    play(args) {
      if (!window.RPG) { this.print('RPG module not loaded.', 'err'); return; }
      window.RPG.start(args[0]);
    },
    reset(args) {
      const what = (args[0] || 'all').toLowerCase();
      this.print(`Clearing state: ${what}. Reloading...`, 'narr');
      const target = what === 'intro'
        ? `?reset=intro`
        : `?reset`;
      setTimeout(() => { window.location.search = target; }, 600);
    },
    whoami() {
      this.print(State.data.content.identity.name + ' — ' + State.data.content.identity.tagline, 'out');
    },
    ls(args) {
      const what = (args[0] || '').toLowerCase();
      if (what === 'hobbies') {
        this.print('MTG Commander · 3D printing (resin + FDM) · mini painting (40k Grey Knights, MESBG Rohan) · D&D GM · building own TTRPG · adversarial conversation', 'out');
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
      if (v === 'adventurer' || v === 'commoner') ViewSwap.swap(v);
      else this.print('view: adventurer | commoner', 'err');
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
  locked: false,    // true after click 13 — prevents accidental retrigger during the BSOD ramp
  init() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('#cursedButton');
      if (btn) this.click();
    });
    window.addEventListener('resize', () => {
      // Keep the button inside the viewport when the window changes size
      const btn = document.getElementById('cursedButton');
      if (btn && btn.style.left) this.moveButton();
    });
  },
  /* Random-teleport the button inside its zone. Classic "don't click me, you
     can't catch me" gag, but constrained so it never disappears off-screen.
     Avoids landing under the narrator bubble when it's on screen. */
  moveButton() {
    const btn = document.getElementById('cursedButton');
    const zone = document.getElementById('cursedZone');
    if (!btn || !zone) return;
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
    const margin = 12;
    const w = btn.offsetWidth || 200;
    const h = btn.offsetHeight || 40;
    const maxLeft = Math.max(margin, zone.clientWidth - w - margin);
    const maxTop  = Math.max(margin, zone.clientHeight - h - margin);

    // Translate the narrator bubble's viewport rect into zone-local coords
    // with a small pad — that becomes a no-go area for the button.
    let avoid = null;
    const narrator = document.getElementById('narrator');
    if (narrator && !narrator.hidden) {
      const nr = narrator.getBoundingClientRect();
      const zr = zone.getBoundingClientRect();
      const pad = 12;
      avoid = {
        left: nr.left - zr.left - pad,
        top: nr.top - zr.top - pad,
        right: nr.right - zr.left + pad,
        bottom: nr.bottom - zr.top + pad,
      };
    }
    const overlaps = (l, t) => avoid &&
      l < avoid.right && l + w > avoid.left &&
      t < avoid.bottom && t + h > avoid.top;

    let left = margin, top = margin, tries = 16;
    do {
      left = margin + Math.random() * (maxLeft - margin);
      top  = margin + Math.random() * (maxTop  - margin);
      tries -= 1;
    } while (tries > 0 && overlaps(left, top));
    if (overlaps(left, top)) { left = margin; top = margin; }

    btn.style.left = `${left}px`;
    btn.style.top  = `${top}px`;
  },
  /* Called when the narrator bubble appears — reposition only if the button
     is currently sitting under the freshly-shown bubble. */
  moveIfOverlapping() {
    const btn = document.getElementById('cursedButton');
    if (!btn || !btn.style.left) return;
    const narrator = document.getElementById('narrator');
    if (!narrator || narrator.hidden) return;
    const br = btn.getBoundingClientRect();
    const nr = narrator.getBoundingClientRect();
    const pad = 12;
    if (br.left < nr.right + pad && br.right > nr.left - pad &&
        br.top < nr.bottom + pad && br.bottom > nr.top - pad) {
      this.moveButton();
    }
  },
  click() {
    // Hard-stop once the BSOD has been armed — buys ~2-3s of safety before the
    // overlay actually covers the page and the button is removed.
    if (this.locked) return;

    // Simple cumulative counter — no time window. Resets on refresh.
    State.cursedClicks += 1;
    const count = State.cursedClicks;

    Secrets.unlock('cursed_click');

    // Always glitch
    const app = $('#app');
    app.classList.remove('glitching'); void app.offsetWidth;
    app.classList.add('glitching');
    setTimeout(() => app.classList.remove('glitching'), 900);

    if (count >= 13) {
      // No voice line on click 13 — the crash SFX + BSOD speak for themselves.
      this.locked = true;
      Secrets.unlock('cursed_bsod');
      this.playCrashSfx();
      setTimeout(() => {
        this.goFullscreen();
        setTimeout(() => BSOD.trigger(), 500);
      }, 600);
    } else {
      // First click stays put — the joke only lands once they try a second time.
      if (count > 1) this.moveButton();
      const n = Math.min(count, 12);
      Narrator.fire(`cursedButton_${n}`, { priority: 'HIGH', cooldown: 0 });
    }
  },
  goFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req || document.fullscreenElement) return;
    try { Promise.resolve(req.call(el)).catch(() => {}); } catch {}
  },
  /* Synthesized crash SFX — Web Audio so we don't ship an extra MP3.
     Gated on audioEnabled to respect the opt-in audio design lock. */
  playCrashSfx() {
    if (!State.audioEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      // White-noise burst, decaying — the "crunch"
      const len = Math.floor(ctx.sampleRate * 0.45);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noise.connect(noiseGain).connect(ctx.destination);
      noise.start(now);

      // Descending sawtooth — the "drop"
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.55);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.22, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(oscGain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);

      // Close the context after the tail so we don't leak nodes
      setTimeout(() => { try { ctx.close(); } catch {} }, 800);
    } catch {}
  },
};

const BSOD = {
  el: null, interval: null, timer: null,
  trigger() {
    this.show();
    this.timer = setTimeout(() => this.hide(), 11000);
  },
  show() {
    if (this.el) this.el.remove();
    // The narrator bubble (z-index 250) sits above the BSOD — dismiss it so
    // the crash screen owns the viewport. cursedRecover re-opens it later.
    Narrator.dismiss();
    this.el = el('div', { class: 'bsod', role: 'alert', 'aria-live': 'assertive' },
      el('div', { class: 'bsodInner' },
        el('div', { class: 'bsodFace' }, ':('),
        el('div', { class: 'bsodLede' }, "Your portfolio ran into a problem and needs to restart."),
        el('div', { class: 'bsodBody' },
          el('p', {}, "He warned you. The button literally said don't."),
          el('p', {}, "Twelve clicks could have been an accident. Thirteen is a confession."),
        ),
        el('div', { class: 'bsodProgress' }, '0% complete'),
        el('div', { class: 'bsodMeta' },
          el('div', {}, "If you'd like to know more, you can search online later for:"),
          el('div', {}, "Stop code: HE_TOLD_YOU_NOT_TO_CLICK"),
        ),
      ),
    );
    document.body.append(this.el);
    document.body.style.overflow = 'hidden';

    let p = 0;
    const progress = this.el.querySelector('.bsodProgress');
    this.interval = setInterval(() => {
      p = Math.min(100, p + Math.floor(Math.random() * 12) + 3);
      progress.textContent = `${p}% complete`;
      if (p >= 100) { clearInterval(this.interval); this.interval = null; }
    }, 600);

    // Click/keypress dismisses early
    const dismiss = () => { this.hide(); };
    setTimeout(() => {
      this.el?.addEventListener('click', dismiss, { once: true });
      document.addEventListener('keydown', dismiss, { once: true });
    }, 1500);
  },
  hide() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    if (!this.el) return;
    this.el.classList.add('leaving');
    document.body.style.overflow = '';
    // Exit fullscreen so the page returns to normal
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    // Hide the cursed button for the rest of this session (resets on reload).
    State.cursedTrolled = true;
    const zone = document.getElementById('cursedZone');
    if (zone) zone.remove();
    setTimeout(() => {
      this.el?.remove();
      this.el = null;
      // Post-BSOD narrator riff — "got you there, didn't I?"
      Narrator.fire('cursedRecover', { priority: 'HIGH', cooldown: 0 });
    }, 480);
  },
};

const D20_SHAPE_SVG = `
  <polygon points="0,-45 39,-22.5 39,22.5 0,45 -39,22.5 -39,-22.5"
           fill="rgba(0,0,0,0.35)" stroke="currentColor" stroke-width="2.2"
           stroke-linejoin="round"/>
  <polygon points="0,-23 20,11 -20,11"
           fill="rgba(198,155,94,0.12)" stroke="currentColor" stroke-width="1.6"
           stroke-linejoin="round"/>
  <line x1="0"   y1="-45"   x2="0"   y2="-23" stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
  <line x1="39"  y1="-22.5" x2="20"  y2="11"  stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
  <line x1="39"  y1="22.5"  x2="20"  y2="11"  stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
  <line x1="0"   y1="45"    x2="0"   y2="-23" stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
  <line x1="-39" y1="22.5"  x2="-20" y2="11"  stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
  <line x1="-39" y1="-22.5" x2="-20" y2="11"  stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
`;

const D20 = {
  locked: false,
  rolling: false,
  firstNat20Seen: false,
  buildSvg(value, opts = {}) {
    const cls = 'd20Svg' + (opts.rolling ? ' d20Svg--rolling' : '');
    return `
      <svg class="${cls}" viewBox="-50 -50 100 100" aria-hidden="true">
        ${D20_SHAPE_SVG}
        <text class="d20SvgNumber" x="0" y="0" text-anchor="middle" dominant-baseline="central"
              font-size="22" font-weight="700" fill="currentColor">${value}</text>
      </svg>
    `;
  },
  init() {
    // Restore "first nat 20 seen" flag — drives the special konami hint line
    this.firstNat20Seen = Storage.get('nikos.d20.firstNat20Seen') === '1';
    const btn = $('#d20Btn');
    // Default face: ? until rolled. applyResult overrides with the saved value
    // on restore (called from renderAdventurer).
    btn.innerHTML = this.buildSvg('?');
    btn.addEventListener('click', () => {
      if (this.locked || this.rolling) return;
      this.roll();
    });
  },
  roll() {
    const value = 1 + Math.floor(Math.random() * 20);
    Storage.set(LS.D20_RESULT, String(value));
    this.animateRoll(value);
  },
  /* Tumble the SVG d20 (which IS the button) in 3D CSS while cycling the
     number on its visible face. Slows toward the end for a settling feel;
     applies the real result via applyResult once the animation lands. */
  animateRoll(finalValue) {
    this.rolling = true;
    const btn = $('#d20Btn');
    btn.classList.remove('nat20', 'nat1');
    btn.innerHTML = this.buildSvg('?', { rolling: true });
    const numEl = btn.querySelector('.d20SvgNumber');

    const totalDuration = 850;
    const startTime = performance.now();
    let tickMs = 50;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= totalDuration) {
        this.rolling = false;
        this.applyResult(finalValue, { restoring: false });
        return;
      }
      const rand = 1 + Math.floor(Math.random() * 20);
      if (numEl) numEl.textContent = String(rand);
      if (elapsed > totalDuration * 0.55) tickMs = Math.min(tickMs + 8, 140);
      setTimeout(tick, tickMs);
    };
    tick();
  },
  applyResult(value, { restoring = false } = {}) {
    const btn = $('#d20Btn');
    btn.classList.remove('nat20', 'nat1');
    let face = String(value);
    if (value === 20) { btn.classList.add('nat20'); }
    else if (value === 1) { btn.classList.add('nat1'); face = '💀'; }
    btn.innerHTML = this.buildSvg(face);
    if (!restoring) {
      // Pop the die briefly on land
      btn.classList.add('d20Btn--landed');
      setTimeout(() => btn.classList.remove('d20Btn--landed'), 360);
    }

    // Only a nat 1 locks the die — everyone else can keep rolling
    if (value === 1) {
      this.locked = true;
      btn.disabled = true;
      btn.classList.add('used');
      btn.setAttribute('aria-disabled', 'true');
    }
    Secrets.unlock('d20');
    if (restoring) return;

    if (value === 20 && !this.firstNat20Seen) {
      // First nat 20 ever — fire the konami hint line, then mark seen
      this.firstNat20Seen = true;
      Storage.set('nikos.d20.firstNat20Seen', '1');
      Narrator.fire('d20_nat20_first', { cooldown: 0 });
    } else {
      const trigger = value === 20 ? 'd20_nat20' : value === 1 ? 'd20_nat1' : 'd20_normal';
      Narrator.fire(trigger, { cooldown: 0 });
    }
  },
};

const TriviaBtn = {
  init() {
    const btn = $('#triviaBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!window.Trivia?.open) return;
      Narrator.fire('openTrivia');
      window.Trivia.open();
    });
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
    Secrets.unlock('konami');
    document.documentElement.style.setProperty('--accent', '#e8a857');
    document.body.animate(
      [{ filter: 'hue-rotate(0)' }, { filter: 'hue-rotate(15deg)' }, { filter: 'hue-rotate(0)' }],
      { duration: 4000, iterations: 1 }
    );
    // Wait for the konami line to finish before opening the hacker terminal.
    // Then let the hacker_open line play naturally too — two sequential lines.
    Narrator.fire('konami', {
      cooldown: 0,
      onEnd: () => { if (window.Hacker?.open) window.Hacker.open(); },
    });
  },
};

const DevTools = {
  _waiting: false,
  init() {
    // Intro is "visible" until its display goes to none (i.e. through fade too).
    const introVisible = () => {
      const i = $('#intro');
      return i && i.style.display !== 'none';
    };
    // Defer firing while the intro is up OR another narrator line is currently
    // playing. Single shared poll so spam-presses don't stack intervals.
    const fire = () => {
      const blocked = introVisible() || Narrator.current;
      if (blocked) {
        if (this._waiting) return;
        this._waiting = true;
        const wait = setInterval(() => {
          if (!introVisible() && !Narrator.current) {
            clearInterval(wait);
            this._waiting = false;
            Secrets.unlock('devtools');
            Narrator.fire('openDevTools', { cooldown: 30000 });
          }
        }, 400);
        return;
      }
      Secrets.unlock('devtools');
      Narrator.fire('openDevTools', { cooldown: 30000 });
    };
    // Listen on window in capture phase so nothing can swallow the event first.
    // Use e.key, e.code, and e.keyCode (deprecated but most reliable cross-browser)
    // — some keyboards/OS combos don't set e.key='F12' consistently.
    const handler = (e) => {
      const k = e.key;
      const code = e.code;
      const kc = e.keyCode;
      const isF12 = k === 'F12' || code === 'F12' || kc === 123;
      const isCtrlShift = (e.ctrlKey || e.metaKey) && e.shiftKey && /^[ijc]$/i.test(k || '');
      const isCmdOpt    = e.metaKey && e.altKey && /^[ij]$/i.test(k || '');
      if (isF12 || isCtrlShift || isCmdOpt) fire();
    };
    window.addEventListener('keydown', handler, { capture: true });
    document.addEventListener('keydown', handler, { capture: true });
  },
};


/* ════ 10. Ambient triggers ════ */

/* ════ Hints — fires once per session to nudge toward hidden features ════ */
const Hints = {
  fired: new Set(),
  fireOnce(narratorTrigger) {
    if (this.fired.has(narratorTrigger)) return;
    this.fired.add(narratorTrigger);
    Narrator.fire(narratorTrigger, { cooldown: 0 });
  },
};

/* ════ Secrets system ════ */

const SECRETS_DEF = [
  { id: 'terminal',     name: 'Opened the Terminal',  trigger: 'Press ` or ~ on your keyboard.',                          hint: 'secretHint_terminal' },
  { id: 'd20',          name: 'Rolled the Die',        trigger: 'Click the 🎲 d20 button in the sheet header.',           hint: 'secretHint_d20' },
  { id: 'devtools',     name: 'Inspected the Page',    trigger: 'Open DevTools (F12 or Ctrl+Shift+I).',                   hint: 'secretHint_devtools' },
  { id: 'konami',       name: 'The Old Code',          trigger: '↑ ↑ ↓ ↓ ← → ← → B A — the Konami code.',                 hint: 'secretHint_konami' },
  { id: 'cursed_click', name: 'Heeded the Warning',    trigger: 'Press the "DO NOT CLICK" button.',                       hint: 'secretHint_cursed_click' },
  { id: 'cursed_bsod',  name: 'Ignored the Warning',   trigger: 'Click the cursed button 13 times.',                      hint: 'secretHint_cursed_bsod' },
  { id: 'late_night',   name: 'Burned the Midnight',   trigger: 'Visit between 3:00 and 3:59 AM local time.',             hint: 'secretHint_late_night' },
];
const LS_SECRETS = 'nikos.secrets';
const LS_SECRETS_HINTS = 'nikos.secrets.hints';
const HINTS_PER_SECRET = 3;

const Secrets = {
  state: {},
  hintsUsed: {},   // secretId -> index of next hint to play (0..HINTS_PER_SECRET)
  init() {
    try { this.state = JSON.parse(localStorage.getItem(LS_SECRETS) || '{}'); } catch { this.state = {}; }
    try { this.hintsUsed = JSON.parse(localStorage.getItem(LS_SECRETS_HINTS) || '{}'); } catch { this.hintsUsed = {}; }
    this.render();
    const counter = $('#secretsCounter');
    const close   = $('#secretsClose');
    const backdrop = document.querySelector('#secretsModal .secretsBackdrop');
    if (counter)  counter.addEventListener('click', () => this.openModal());
    if (close)    close.addEventListener('click', () => this.closeModal());
    if (backdrop) backdrop.addEventListener('click', () => this.closeModal());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#secretsModal').hidden) this.closeModal();
    });
  },
  unlock(id) {
    if (this.state[id]) return;
    this.state[id] = true;
    try { localStorage.setItem(LS_SECRETS, JSON.stringify(this.state)); } catch {}
    this.render();
  },
  count() { return SECRETS_DEF.filter(s => this.state[s.id]).length; },
  /* Plays the next hint for a secret in sequence (subtle → direct → explicit),
     decrementing the visible counter. No-op once the bank is exhausted. */
  useHint(id) {
    const def = SECRETS_DEF.find(s => s.id === id);
    if (!def) return;
    const used = this.hintsUsed[id] || 0;
    const bank = State.data?.voicelines?.[def.hint] || [];
    const cap = Math.min(HINTS_PER_SECRET, bank.length);
    if (used >= cap) return;
    const line = bank[used];
    this.hintsUsed[id] = used + 1;
    try { localStorage.setItem(LS_SECRETS_HINTS, JSON.stringify(this.hintsUsed)); } catch {}
    Narrator.fireLine(def.hint, line);
    this.render();
  },
  /* Re-plays the most recently used hint without consuming another. Lets the
     player re-hear a line they missed or want to chew on before advancing. */
  replayHint(id) {
    const def = SECRETS_DEF.find(s => s.id === id);
    if (!def) return;
    const used = this.hintsUsed[id] || 0;
    if (used <= 0) return;
    const bank = State.data?.voicelines?.[def.hint] || [];
    const line = bank[used - 1];
    if (!line) return;
    Narrator.fireLine(def.hint, line);
  },
  render() {
    const n = this.count();
    const total = SECRETS_DEF.length;
    const txt = `${n}/${total}`;
    const c1 = $('#secretsCount');
    const c2 = $('#secretsModalCount');
    if (c1) c1.textContent = txt;
    if (c2) c2.textContent = txt;
    const list = $('#secretsList');
    if (!list) return;
    list.replaceChildren(...SECRETS_DEF.map(s => {
      const found = !!this.state[s.id];
      const used = this.hintsUsed[s.id] || 0;
      const remaining = Math.max(0, HINTS_PER_SECRET - used);
      const attrs = { class: 'secretsItem' + (found ? ' found' : '') };
      // Found rows put the trigger explanation in a native hover tooltip.
      if (found) attrs.title = s.trigger;
      const li = el('li', attrs,
        el('span', { class: 'secretsMark' }, found ? '✓' : '?'),
        el('span', { class: 'secretsName' }, found ? s.name : '???'),
      );
      if (!found) {
        const actions = el('div', { class: 'secretsActions' });
        if (used > 0) {
          actions.append(el('button', {
            class: 'secretsHint secretsHint--replay',
            title: 'Replay the last hint without using another',
            onclick: (e) => { e.stopPropagation(); this.replayHint(s.id); },
          }, '↻ Replay'));
        }
        actions.append(el('button', {
          class: 'secretsHint',
          disabled: remaining === 0,
          onclick: (e) => { e.stopPropagation(); this.useHint(s.id); },
        }, remaining > 0 ? `Hint (${remaining})` : 'No hints left'));
        li.append(actions);
      }
      return li;
    }));
  },
  openModal() { $('#secretsModal').hidden = false; this.render(); },
  closeModal() { $('#secretsModal').hidden = true; },
};

const Ambient = {
  idleTimer: null,
  IDLE_MS: 25000,   // was 60000 — felt too long
  init() {
    const reset = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      // Only schedule when the tab is visible; otherwise we'd fire into an empty room.
      if (document.visibilityState !== 'visible') return;
      this.idleTimer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          Narrator.fire('idle_30s', { priority: 'LOW', cooldown: 90000 });
        }
      }, this.IDLE_MS);
    };
    ['mousemove','keydown','scroll','click','touchstart'].forEach(evt => window.addEventListener(evt, reset, { passive: true }));
    reset();

    // Tab visibility — pause the idle timer while hidden; reset it on return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        Narrator.fire('tabBlurred', { priority: 'LOW', cooldown: 120000 });
        reset();
      } else if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    });

    // 3 AM window — easter-egg unlock (the welcome line itself plays at intro time).
    const hour = new Date().getHours();
    if (hour === 3) {
      Secrets.unlock('late_night');
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

function maybeReset() {
  // ?reset clears all our state for dev/testing. After clearing, strip the
  // param from the URL so a refresh doesn't keep wiping.
  const params = new URLSearchParams(window.location.search);
  if (!params.has('reset')) return false;
  const what = params.get('reset') || 'all';
  try {
    if (what === 'intro') {
      localStorage.removeItem(LS.SEEN_INTRO);
      localStorage.removeItem(LS.VISITS);
    } else {
      // Full wipe — only keys under our `nikos.` namespace
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nikos.')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    }
  } catch {}
  params.delete('reset');
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
  return true;
}

async function boot() {
  maybeReset();
  State.audioEnabled = Storage.get(LS.AUDIO) === 'on';
  await loadData();

  Narrator.init();
  Intro.start();
  ViewSwap.init();
  Showcase.init();
  Console.init();
  Cursed.init();
  D20.init();
  TriviaBtn.init();
  Konami.init();
  DevTools.init();
  Ambient.init();
  Secrets.init();

  // Expose for cross-module integration (RPG + hacker game call into these)
  window.Console = Console;
  window.Narrator = Narrator;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
