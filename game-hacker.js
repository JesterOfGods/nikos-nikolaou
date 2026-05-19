/* ════════════════════════════════════════════════════════════════════════
   game-hacker.js — Terminal hacker mini-game.
   Triggered by the cursed "DO NOT CLICK" button.
   Solving a challenge unlocks a CODE in the RPG (spell or dungeon select).
   ════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

const LS_KEY = 'nikos.hacker.solved';
const LS_GAMERTAG = 'nikos.gamertag';

const CHALLENGES = {
  recon: {
    id: 'recon',
    label: 'PASSWORD HUNT',
    rewardCode: 'BLOOM',
    rewardType: 'Heal spell',
    intro: [
      '─── PASSWORD HUNT ───────────────────────────────',
      'Guess the faction. Three clues. Be precise.',
      '',
      '  1. He paints them silver and bone-white.',
      '  2. They hunt daemons and he will never finish the army.',
      '  3. Their primary color is the same as their reputation.',
      '',
      'Format: two words. Case-insensitive.',
    ],
    accept: (input) => {
      const norm = input.toUpperCase().replace(/\s+/g, ' ').trim();
      return ['GREY KNIGHTS', 'GRAY KNIGHTS', 'GREY KNIGHT', 'GRAY KNIGHT', 'GREYKNIGHTS', 'GRAYKNIGHTS'].includes(norm);
    },
    win: 'Grey Knights. Silver, bone-white, and never finished.',
    fail: 'Wrong. Try again, or type `back` to give up.',
  },

  pivot: {
    id: 'pivot',
    label: 'SEQUENCE',
    rewardCode: 'FREEZE',
    rewardType: 'Cold damage spell',
    intro: [
      '─── SEQUENCE ────────────────────────────────────',
      'Continue the sequence by one term. Numeric.',
      '',
      '  1, 1, 2, 3, 5, 8, ?',
      '',
      'Format: a single number.',
    ],
    accept: (input) => input.trim() === '13',
    win: 'Thirteen. Fibonacci. Old. Cold. Like the spell.',
    fail: 'Off by some amount. Look closer.',
  },

  breach: {
    id: 'breach',
    label: 'CIPHER',
    rewardCode: 'WARD',
    rewardType: 'Shield spell',
    intro: [
      '─── CIPHER ──────────────────────────────────────',
      'Decode the message. Rot13 (each letter shifted by 13).',
      '',
      '  CIPHERTEXT:  ONEEVRE',
      '',
      'Format: the plaintext word.',
    ],
    accept: (input) => input.toUpperCase().trim() === 'BARRIER',
    win: 'Decoded. Barrier. Held.',
    fail: 'That isn\'t Rot13 of ONEEVRE. Each letter shifts by 13 positions.',
  },

  exploit: {
    id: 'exploit',
    label: 'WORDLE',
    rewardCode: 'SUNDER',
    rewardType: 'Heavy-strike spell',
    secret: 'GHOST',
    kind: 'wordle',
    intro: [
      '─── WORDLE ──────────────────────────────────────',
      'Guess the 5-letter word.',
      '',
      '  GREEN  — right letter, right position',
      '  YELLOW — right letter, wrong position',
      '  GREY   — not in the word',
      '',
      'Type 5 letters. Press enter. Keep going until solved.',
    ],
    accept: (input) => input.toUpperCase().trim() === 'GHOST',
    win: 'Word solved. Spell mastered.',
    fail: '',
  },

  void: {
    id: 'void',
    label: 'RIDDLE',
    rewardCode: 'STAR',
    rewardType: 'Dungeon shortcut: Forsaken Temple',
    intro: [
      '─── RIDDLE ──────────────────────────────────────',
      'You cast me. I follow. I leave when you do.',
      'I am darker where you are. What am I?',
      '',
      'Format: one word.',
    ],
    accept: (input) => ['SHADOW', 'A SHADOW', 'THE SHADOW'].includes(input.toUpperCase().trim()),
    win: 'Shadow. Heavy and obvious in retrospect.',
    fail: 'Closer. Think about what follows you on a sunny day.',
  },

  crack: {
    id: 'crack',
    label: 'CRACK THE LOCK',
    rewardCode: 'JOLT',
    rewardType: 'Bonus damage spell',
    intro: [
      '─── CRACK THE LOCK ──────────────────────────────',
      '4-digit PIN.',
      '',
      '  Clue: the answer to life — twice.',
      '',
      'Format: 4 digits.',
    ],
    accept: (input) => input.trim() === '4242',
    win: '4242. Twice the answer. Lock open.',
    fail: 'Not it. The clue is a famous number.',
  },
};

const CHALLENGE_ORDER = ['recon', 'pivot', 'breach', 'exploit', 'void', 'crack'];

/* ─── Persistence ─── */
function loadSolved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}
function saveSolved(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
}

/* ─── DOM ─── */
function ensureUI() {
  if (document.getElementById('hacker')) return document.getElementById('hacker');
  const root = document.createElement('div');
  root.id = 'hacker';
  root.className = 'hacker';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Hacker terminal');
  root.innerHTML = `
    <div class="hackerScanlines" aria-hidden="true"></div>
    <div class="hackerInner">
      <header class="hackerBar">
        <span class="hackerBarDot"></span>
        <span class="hackerBarLabel">root@nikos:~# THE BACKROOM</span>
        <button class="hackerClose" aria-label="Close">[ exit ]</button>
      </header>
      <div class="hackerScreen" id="hackerScreen"></div>
      <div class="hackerInputRow">
        <span class="hackerPrompt">root@nikos:~#</span>
        <input class="hackerInput" id="hackerInput" type="text" autocomplete="off" spellcheck="false" />
      </div>
    </div>
  `;
  document.body.append(root);
  root.querySelector('.hackerClose').addEventListener('click', () => Hacker.close());
  return root;
}

/* ─── The Game ─── */
const Hacker = {
  el: null, screenEl: null, inputEl: null,
  active: false,
  mode: 'menu',           // 'menu' | 'challenge'
  currentChallenge: null,
  attempts: 0,
  cmdHistory: [], cmdIdx: -1,

  open(opts = {}) {
    this.el = ensureUI();
    this.screenEl = document.getElementById('hackerScreen');
    this.inputEl = document.getElementById('hackerInput');
    this.el.hidden = false;
    document.body.style.overflow = 'hidden';
    this.active = true;
    this.mode = 'menu';
    this.currentChallenge = null;
    this._silent = !!opts.silent;
    this._gamertag = this._loadGamertag();
    if (!this._ip) this._fetchIp();

    if (!this._bound) {
      this._bound = true;
      this.inputEl.addEventListener('keydown', (e) => this.onKey(e));
      document.addEventListener('keydown', (e) => {
        if (this.active && e.key === 'Escape') this.close();
      });
    }

    this.screenEl.innerHTML = '';
    setTimeout(() => this._gamertag ? this.bootScreen() : this.promptGamertag(), 260);
    setTimeout(() => this.inputEl.focus(), 300);
  },

  /* ─── Gamertag handling ─── */
  _loadGamertag() {
    try { return localStorage.getItem(LS_GAMERTAG) || null; } catch { return null; }
  },
  _saveGamertag(name) {
    try { localStorage.setItem(LS_GAMERTAG, name); } catch {}
    this._gamertag = name;
  },
  _getGamertag() { return this._gamertag; },

  promptGamertag() {
    this.mode = 'gamertag';
    this.printHeader();
    this.print('');
    this.print('  Enter a gamertag (2–12 chars, letters & digits):', 'narr');
    this.print('  Type your name and press Enter.', 'out');
    this.print('');
  },

  /* ─── IP fetch (best-effort; fails silently) ─── */
  _ip: null,
  async _fetchIp() {
    try {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout?.(5000) });
      if (!r.ok) return;
      const j = await r.json();
      this._ip = j.ip || null;
    } catch {}
  },

  close() {
    if (!this.el) return;
    this.el.hidden = true;
    document.body.style.overflow = '';
    this.active = false;
    if (window.Narrator) window.Narrator.fire('hacker_exit', { priority: 'HIGH', cooldown: 0 });
  },

  bootScreen() {
    this.printHeader();
    this.printDashboard();
    this._renderMenuItems();
    if (window.Narrator && !this._silent) window.Narrator.fire('hacker_open', { cooldown: 0 });
  },

  printHeader() {
    const lines = [
      '',
      '  ██╗  ██╗ █████╗  ██████╗██╗  ██╗███████╗██████╗ ',
      '  ██║  ██║██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗',
      '  ███████║███████║██║     █████╔╝ █████╗  ██████╔╝',
      '  ██╔══██║██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗',
      '  ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║',
      '  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
      '',
      '  // welcome to the backroom //',
      '  // solve a challenge → earn a code → use it in the dungeon (`play`)',
      '',
    ];
    lines.forEach(l => this.print(l));
  },

  printDashboard() {
    if (!this._gamertag) return;
    const row = document.createElement('div');
    row.className = 'hackerLine hackerDashboard';
    const tag = document.createElement('span');
    tag.className = 'dashTag';
    tag.textContent = `  user: ${this._gamertag}`;
    row.append(tag);
    if (this._ip) {
      const ipSpan = document.createElement('span');
      ipSpan.className = 'dashIp';
      ipSpan.textContent = `   ip: ${this._ip}`;
      ipSpan.title = 'You should have used a VPN…';
      ipSpan.addEventListener('mouseenter', () => {
        if (window.Narrator) window.Narrator.fire('hacker_vpn', { cooldown: 60000 });
      });
      row.append(ipSpan);
    }
    this.screenEl.append(row);
    const sep = document.createElement('div');
    sep.className = 'hackerLine';
    sep.textContent = '';
    this.screenEl.append(sep);
  },

  clearScreen() {
    this.screenEl.innerHTML = '';
    this.printHeader();
    this.printDashboard();
  },

  showMenu() {
    this.clearScreen();
    this._renderMenuItems();
  },

  _renderMenuItems() {
    this.mode = 'menu';
    this.currentChallenge = null;
    const solved = new Set(loadSolved());
    this.print('  CHALLENGES  (solve to unlock dungeon codes):');
    for (const id of CHALLENGE_ORDER) {
      const c = CHALLENGES[id];
      const mark = solved.has(id) ? '[✓]' : '[ ]';
      this.print(`    ${mark}  ${c.id.padEnd(9)}  ${c.label.padEnd(15)}  →  ${c.rewardType}`);
    }
    this.print('');
    this.print('  commands:  run <id>   list   codes   help   exit');
    this.print('');
  },

  print(text, cls = 'out') {
    const row = document.createElement('div');
    row.className = 'hackerLine ' + cls;
    row.textContent = text;
    this.screenEl.append(row);
    this.screenEl.scrollTop = this.screenEl.scrollHeight;
  },

  onKey(e) {
    if (e.key === 'Enter') {
      const val = this.inputEl.value.trim();
      this.inputEl.value = '';
      if (!val) return;
      this.cmdHistory.push(val); this.cmdIdx = this.cmdHistory.length;
      this.process(val);
    } else if (e.key === 'ArrowUp') {
      if (this.cmdIdx > 0) this.cmdIdx--;
      this.inputEl.value = this.cmdHistory[this.cmdIdx] || '';
    } else if (e.key === 'ArrowDown') {
      if (this.cmdIdx < this.cmdHistory.length) this.cmdIdx++;
      this.inputEl.value = this.cmdHistory[this.cmdIdx] || '';
    }
  },

  process(input) {
    this.print(`root@nikos:~# ${input}`, 'echo');

    const lower = input.toLowerCase();

    // Gamertag entry takes over input entirely until set
    if (this.mode === 'gamertag') return this.handleGamertagInput(input);

    // Global commands
    if (lower === 'exit' || lower === 'quit' || lower === 'q') return this.close();
    if (lower === 'help' || lower === '?') return this.showHelp();
    if (lower === 'clear' || lower === 'cls') { this.clearScreen(); return; }
    if (lower === 'list' || lower === 'ls' || lower === 'menu') return this.showMenu();
    if (lower === 'codes') return this.showCodes();

    // Mode-specific
    if (this.mode === 'menu') {
      if (lower === 'back') return;
      const m = lower.match(/^run\s+(\w+)$/) || [null, lower];
      const id = m[1];
      if (CHALLENGES[id]) return this.openChallenge(id);
      return this.print(`unknown: "${input}". type \`list\` or \`help\`.`, 'err');
    }

    if (this.mode === 'challenge') {
      if (lower === 'back') return this.showMenu();
      return this.submit(input);
    }
  },

  handleGamertagInput(input) {
    const tag = input.trim();
    if (!/^[A-Za-z0-9_]{2,12}$/.test(tag)) {
      this.print('Invalid. Use 2–12 letters, digits, or underscore.', 'err');
      return;
    }
    this._saveGamertag(tag);
    this.print(`  gamertag set: ${tag}`, 'ok');
    this.print('');
    if (window.Narrator) window.Narrator.fire('hacker_nameGiven', { cooldown: 0 });
    // After a beat, transition into the normal boot dashboard + menu
    setTimeout(() => {
      this.clearScreen();
      this._renderMenuItems();
    }, 800);
    this.mode = 'menu';
  },

  showHelp() {
    this.print('  list           show challenges', 'out');
    this.print('  run <id>       enter a challenge (id from `list`)', 'out');
    this.print('  back           leave a challenge', 'out');
    this.print('  codes          show unlocked codes', 'out');
    this.print('  clear          clear screen', 'out');
    this.print('  exit           close the backroom', 'out');
    this.print('  in a challenge, just type your answer.', 'out');
  },

  showCodes() {
    const solved = loadSolved();
    if (solved.length === 0) return this.print('No codes unlocked yet.', 'out');
    this.print('  UNLOCKED:', 'out');
    for (const id of solved) {
      const c = CHALLENGES[id]; if (!c) continue;
      this.print(`    ${c.rewardCode.padEnd(8)}  →  ${c.rewardType}`, 'ok');
    }
    this.print('  Use these in `play` (in the main console) — e.g. `play star`.');
  },

  openChallenge(id) {
    this.clearScreen();
    this.mode = 'challenge';
    this.currentChallenge = id;
    this.attempts = 0;
    this.print('');
    CHALLENGES[id].intro.forEach(l => this.print(l, 'narr'));
    this.print('');
    this.print('  Type your answer below. `back` to return to the menu.', 'out');
  },

  submit(input) {
    const c = CHALLENGES[this.currentChallenge];
    this.attempts++;

    // Wordle has its own input gate + tile render
    if (c.kind === 'wordle') return this.submitWordle(input, c);

    if (c.accept(input)) return this.solved(c);
    this.print('  ✗ ' + (c.fail || 'Wrong.'), 'err');
  },

  submitWordle(input, c) {
    const guess = (input || '').toUpperCase().trim();
    if (!/^[A-Z]{5}$/.test(guess)) {
      this.print('  (wordle: enter exactly 5 letters, A–Z)', 'err');
      return;
    }
    this.renderWordleRow(guess, c.secret);
    if (guess === c.secret.toUpperCase()) return this.solved(c);
  },

  renderWordleRow(guess, secret) {
    const sec = secret.toUpperCase();
    const g = guess.toUpperCase();
    const colors = new Array(5).fill('white'); // not in word
    const used = new Array(5).fill(false);
    for (let i = 0; i < 5; i++) {
      if (g[i] === sec[i]) { colors[i] = 'green'; used[i] = true; }
    }
    for (let i = 0; i < 5; i++) {
      if (colors[i] === 'green') continue;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && g[i] === sec[j]) { colors[i] = 'orange'; used[j] = true; break; }
      }
    }

    const row = document.createElement('div');
    row.className = 'hackerLine wordleRow';
    for (let i = 0; i < 5; i++) {
      const tile = document.createElement('span');
      tile.className = `wordleTile ${colors[i]}`;
      tile.style.animationDelay = (i * 80) + 'ms';
      tile.textContent = g[i];
      row.append(tile);
    }
    this.screenEl.append(row);
    this.screenEl.scrollTop = this.screenEl.scrollHeight;
  },

  solved(c) {
    const solved = new Set(loadSolved());
    const isNew = !solved.has(c.id);
    solved.add(c.id);
    saveSolved([...solved]);

    this.print('');
    this.print('  ✓ ' + c.win, 'ok');
    this.print(`  ▸ CODE UNLOCKED:  ${c.rewardCode}  (${c.rewardType})`, 'ok');
    this.print('');

    if (window.RPG?.addCode) window.RPG.addCode(c.rewardCode);

    if (window.Narrator) {
      window.Narrator.fire(isNew ? 'hacker_solved' : 'hacker_resolved', { cooldown: 0 });
    }

    this.mode = 'menu';
    this.currentChallenge = null;
    // Wait long enough for the player to read the win message, then clear and
    // show the menu fresh with the new [✓] mark.
    setTimeout(() => this.showMenu(), 1800);
  },
};

window.Hacker = Hacker;

})();
