/* ════════════════════════════════════════════════════════════════════════
   game-trivia.js — Trivial-Pursuit-style trivia inside the hacker terminal.
   10 categories × 10 questions. Pick order = difficulty (1..10).
   Score = difficulty × 100 per correct. Max = 5,500.

   Leaderboard architecture:
   - Each browser gets a persistent anonymous UUID in localStorage.
   - Score entries are { gamertag, uuid, score, date }.
   - LOCAL leaderboard (top 10) lives in localStorage.
   - The Adapter object below has read/write/list — swap those for a backend
     (Cloudflare Worker / Firebase / Supabase / JSONbin) to go global.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

const LS_LEADERBOARD = 'nikos.trivia.leaderboard';
const LS_UUID        = 'nikos.uuid';

/* ─── Per-browser anonymous UUID (prevents accidental score override) ─── */
function getUuid() {
  try {
    let u = localStorage.getItem(LS_UUID);
    if (!u) {
      u = 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(LS_UUID, u);
    }
    return u;
  } catch { return 'u-anon'; }
}

const CATEGORIES = [
  { id: 'harrypotter', name: 'Harry Potter' },
  { id: 'mtg',         name: 'Magic: The Gathering' },
  { id: 'lotr',        name: 'Lord of the Rings' },
  { id: 'onepiece',    name: 'One Piece' },
  { id: 'arrowverse',  name: 'DC Arrowverse' },
  { id: 'supernatural',name: 'Supernatural' },
  { id: 'dnd',         name: 'D&D' },
  { id: 'warhammer',   name: 'Warhammer 40K' },
  { id: 'disney',      name: 'Disney Classics' },
  { id: 'greek',       name: 'Greek Mythology' },
];

/* Each entry: d (difficulty 1..10), q (question), o (options), a (correct index) */
const QUESTIONS = {
  harrypotter: [
    { d: 1,  q: "What is the name of Harry Potter's pet owl?", o: ["Hedwig", "Errol", "Pigwidgeon", "Crookshanks"], a: 0 },
    { d: 2,  q: "Which Hogwarts house is associated with bravery?", o: ["Slytherin", "Hufflepuff", "Gryffindor", "Ravenclaw"], a: 2 },
    { d: 3,  q: "What kind of creature is Aragog?", o: ["A dragon", "A werewolf", "A giant spider", "A basilisk"], a: 2 },
    { d: 4,  q: "What is the name of Voldemort's snake horcrux?", o: ["Nagini", "Hedwig", "Trevor", "Fang"], a: 0 },
    { d: 5,  q: "Which spell disarms an opponent?", o: ["Stupefy", "Expelliarmus", "Petrificus Totalus", "Protego"], a: 1 },
    { d: 6,  q: "Who teaches Defence Against the Dark Arts in Harry's third year?", o: ["Gilderoy Lockhart", "Quirinus Quirrell", "Remus Lupin", "Alastor Moody"], a: 2 },
    { d: 7,  q: "Who kills Bellatrix Lestrange in the Battle of Hogwarts?", o: ["Harry Potter", "Hermione Granger", "Molly Weasley", "Neville Longbottom"], a: 2 },
    { d: 8,  q: "What is Tom Riddle's middle name?", o: ["Salazar", "Marvolo", "Sirius", "Gaunt"], a: 1 },
    { d: 9,  q: "In what year is Harry Potter born?", o: ["1979", "1980", "1981", "1982"], a: 1 },
    { d: 10, q: "What is the title of Rita Skeeter's tell-all book about Dumbledore?", o: ["The Greatest Wizard of the Century", "Albus Dumbledore: A Life Examined", "The Life and Lies of Albus Dumbledore", "Secrets of the Headmaster"], a: 2 },
  ],

  mtg: [
    { d: 1,  q: "What is the default starting life total in standard Magic?", o: ["15", "20", "30", "40"], a: 1 },
    { d: 2,  q: "Which format uses 100-card singleton decks led by a Commander?", o: ["Standard", "Modern", "Commander (EDH)", "Pauper"], a: 2 },
    { d: 3,  q: "What color is associated with Islands?", o: ["White", "Blue", "Black", "Green"], a: 1 },
    { d: 4,  q: "Which card is widely considered the most valuable in Magic?", o: ["Time Walk", "Black Lotus", "Ancestral Recall", "Mox Sapphire"], a: 1 },
    { d: 5,  q: "What is the mana cost of Black Lotus?", o: ["0", "1", "2", "3"], a: 0 },
    { d: 6,  q: "What was the first official set of Magic: The Gathering?", o: ["Arabian Nights", "Limited Edition Alpha", "The Dark", "Antiquities"], a: 1 },
    { d: 7,  q: "Which planeswalker is the iconic black-aligned queen of necromancy?", o: ["Jace Beleren", "Chandra Nalaar", "Liliana Vess", "Nissa Revane"], a: 2 },
    { d: 8,  q: "Niv-Mizzet belongs to which Ravnican guild?", o: ["Izzet", "Boros", "Simic", "Dimir"], a: 0 },
    { d: 9,  q: "Storm counts how many spells?", o: ["Spells cast this game", "Spells in your graveyard", "Spells cast this turn before the Storm spell", "Artifacts you control"], a: 2 },
    { d: 10, q: "Which set introduced the 'companion' mechanic?", o: ["Throne of Eldraine", "Theros Beyond Death", "Ikoria: Lair of Behemoths", "Zendikar Rising"], a: 2 },
  ],

  lotr: [
    { d: 1,  q: "Who ultimately carries the One Ring to Mount Doom?", o: ["Frodo Baggins", "Samwise Gamgee", "Aragorn", "Gandalf"], a: 0 },
    { d: 2,  q: "Legolas belongs to which race?", o: ["Hobbit", "Elf", "Dwarf", "Man"], a: 1 },
    { d: 3,  q: "Where do hobbits live?", o: ["Rivendell", "The Shire", "Helm's Deep", "Lothlórien"], a: 1 },
    { d: 4,  q: "Who is King of Rohan during the War of the Ring?", o: ["Aragorn", "Denethor", "Théoden", "Elrond"], a: 2 },
    { d: 5,  q: "What is the name of the sword reforged for Aragorn?", o: ["Glamdring", "Sting", "Andúril", "Hadhafang"], a: 2 },
    { d: 6,  q: "How many Rings of Power were given to the Elves?", o: ["One", "Three", "Seven", "Nine"], a: 1 },
    { d: 7,  q: "What was Gollum's birth name?", o: ["Déagol", "Sméagol", "Trahald", "Drogo"], a: 1 },
    { d: 8,  q: "How many Silmarils were created by Fëanor?", o: ["One", "Three", "Seven", "Nine"], a: 1 },
    { d: 9,  q: "What is the name of Aragorn's father?", o: ["Arathorn", "Arador", "Aragost", "Arvegil"], a: 0 },
    { d: 10, q: "Who created the Palantíri?", o: ["Aulë", "Fëanor", "Manwë", "Celebrimbor"], a: 1 },
  ],

  onepiece: [
    { d: 1,  q: "Who is the main protagonist of One Piece?", o: ["Roronoa Zoro", "Monkey D. Luffy", "Sanji", "Trafalgar Law"], a: 1 },
    { d: 2,  q: "What does Luffy want to become?", o: ["The Strongest Swordsman", "Emperor of the Sea", "The Pirate King", "World Government President"], a: 2 },
    { d: 3,  q: "What Devil Fruit did Luffy eat?", o: ["Flame-Flame Fruit", "Gum-Gum Fruit", "Sand-Sand Fruit", "Ice-Ice Fruit"], a: 1 },
    { d: 4,  q: "What is the name of Luffy's crew?", o: ["Whitebeard Pirates", "Red-Hair Pirates", "Straw Hat Pirates", "Heart Pirates"], a: 2 },
    { d: 5,  q: "Which crewmate fights with three swords?", o: ["Sanji", "Brook", "Mihawk", "Roronoa Zoro"], a: 3 },
    { d: 6,  q: "What is the name of Luffy's grandfather?", o: ["Gol D. Roger", "Monkey D. Garp", "Edward Newgate", "Shanks"], a: 1 },
    { d: 7,  q: "Who is Luffy's sworn (and later adopted) older brother executed by the Marines?", o: ["Sabo", "Portgas D. Ace", "Marco", "Whitebeard"], a: 1 },
    { d: 8,  q: "Which Yonko is known as 'Red-Haired'?", o: ["Kaido", "Big Mom", "Shanks", "Blackbeard"], a: 2 },
    { d: 9,  q: "What treasure did Gol D. Roger leave behind?", o: ["The Sea Stone", "World Government Documents", "The Devil Fruit's Origin", "The One Piece"], a: 3 },
    { d: 10, q: "On what enormous geographical feature is Mariejois (capital of the World Government) located?", o: ["The Grand Line", "The Red Line", "The Calm Belt", "Reverse Mountain"], a: 1 },
  ],

  arrowverse: [
    { d: 1,  q: "Who is the primary hero of Star City in the Arrowverse?", o: ["The Flash", "Green Arrow", "Supergirl", "Batwoman"], a: 1 },
    { d: 2,  q: "What is Barry Allen's superhero name?", o: ["Green Arrow", "The Flash", "Arsenal", "Vibe"], a: 1 },
    { d: 3,  q: "What is Kara Zor-El's adoptive surname on Earth?", o: ["Kent", "Olsen", "Danvers", "Luthor"], a: 2 },
    { d: 4,  q: "Which city is home to The Flash?", o: ["Star City", "Central City", "Gotham", "National City"], a: 1 },
    { d: 5,  q: "Who is the original Reverse-Flash from Earth-1?", o: ["Hunter Zolomon", "Eobard Thawne", "Edward Clariss", "Daniel West"], a: 1 },
    { d: 6,  q: "What is Sara Lance's hero alias on Legends of Tomorrow?", o: ["Black Canary", "White Canary", "Huntress", "Arsenal"], a: 1 },
    { d: 7,  q: "Which crossover first united Arrow, Flash, Supergirl and Legends?", o: ["Crisis on Earth-X", "Invasion!", "Elseworlds", "Crisis on Infinite Earths"], a: 1 },
    { d: 8,  q: "What is Mon-El's home planet?", o: ["Krypton", "Daxam", "Rann", "Maaldoria"], a: 1 },
    { d: 9,  q: "Who is the original captain of the Waverider in Legends of Tomorrow?", o: ["Sara Lance", "Ray Palmer", "Rip Hunter", "Mick Rory"], a: 2 },
    { d: 10, q: "What is the alias of the Earth-2 Laurel Lance?", o: ["Siren-X", "Tigress", "Black Siren", "Black Canary"], a: 2 },
  ],

  supernatural: [
    { d: 1,  q: "What is the surname of the two brothers?", o: ["Singer", "Winchester", "Roman", "Mills"], a: 1 },
    { d: 2,  q: "What are the first names of the two brothers?", o: ["Sam and Dean", "Adam and Jack", "John and Sam", "Dean and Bobby"], a: 0 },
    { d: 3,  q: "What is their father's name?", o: ["John", "Bobby", "Henry", "Samuel"], a: 0 },
    { d: 4,  q: "What model car do the Winchesters drive?", o: ["1969 Ford Mustang", "1967 Chevrolet Impala", "1972 Cadillac Eldorado", "1965 Pontiac GTO"], a: 1 },
    { d: 5,  q: "Whose body is Castiel inhabiting on Earth?", o: ["Jimmy Novak", "Adam Milligan", "Henry Winchester", "Aaron Bass"], a: 0 },
    { d: 6,  q: "Which legendary firearm can kill almost anything in the Supernatural mythos?", o: ["Death's Scythe", "The First Blade", "The Colt", "The Hand of God"], a: 2 },
    { d: 7,  q: "In which episode do the Winchesters wake up as actors on a TV show?", o: ["Changing Channels", "Hollywood Babylon", "The French Mistake", "Yellow Fever"], a: 2 },
    { d: 8,  q: "Who is God's sister in the show?", o: ["Lilith", "Eve", "Amara", "Rowena"], a: 2 },
    { d: 9,  q: "In what town is the Men of Letters bunker located?", o: ["Lawrence, Kansas", "Lebanon, Kansas", "Wichita, Kansas", "Topeka, Kansas"], a: 1 },
    { d: 10, q: "What is the name of Sam and Dean's half-brother?", o: ["Adam Milligan", "Henry Winchester", "Jack Kline", "Bobby Singer"], a: 0 },
  ],

  dnd: [
    { d: 1,  q: "Which die is the most iconic in D&D?", o: ["d4", "d6", "d20", "d100"], a: 2 },
    { d: 2,  q: "Which class can 'rage' as a core feature?", o: ["Bard", "Sorcerer", "Barbarian", "Cleric"], a: 2 },
    { d: 3,  q: "How many ability scores does a D&D character have?", o: ["4", "5", "6", "8"], a: 2 },
    { d: 4,  q: "What is the name of the magic bag that holds more than its size?", o: ["Bag of Tricks", "Bag of Holding", "Handy Haversack", "Endless Sack"], a: 1 },
    { d: 5,  q: "Which is the most popular D&D campaign setting?", o: ["Eberron", "Dragonlance", "Forgotten Realms", "Greyhawk"], a: 2 },
    { d: 6,  q: "Which deity is the five-headed mother of chromatic dragons?", o: ["Bahamut", "Tiamat", "Asgorath", "Io"], a: 1 },
    { d: 7,  q: "In which year was the 5th Edition Player's Handbook published?", o: ["2012", "2014", "2016", "2018"], a: 1 },
    { d: 8,  q: "Who is the iconic drow ranger of Forgotten Realms novels?", o: ["Elminster Aumar", "Drizzt Do'Urden", "Artemis Entreri", "Bruenor Battlehammer"], a: 1 },
    { d: 9,  q: "On which plane do devils reside?", o: ["The Abyss", "Mechanus", "The Nine Hells", "Carceri"], a: 2 },
    { d: 10, q: "What is the name of the Forgotten Realms god of murder?", o: ["Bane", "Bhaal", "Cyric", "Myrkul"], a: 1 },
  ],

  warhammer: [
    { d: 1,  q: "Complete the iconic 40K motto: 'In the grim darkness of the far future, there is only ___.'", o: ["fear", "war", "death", "silence"], a: 1 },
    { d: 2,  q: "Which Imperial chapter wears blue armor and is led by Marneus Calgar?", o: ["Blood Angels", "Ultramarines", "Space Wolves", "Imperial Fists"], a: 1 },
    { d: 3,  q: "Which faction's war cry is 'WAAAGH!'?", o: ["Tyranids", "Necrons", "Orks", "Eldar"], a: 2 },
    { d: 4,  q: "Which Chaos God is dedicated to disease and decay?", o: ["Khorne", "Tzeentch", "Nurgle", "Slaanesh"], a: 2 },
    { d: 5,  q: "Space Marines are best described as:", o: ["Aliens", "Genetically-enhanced humans", "Robots", "Daemons"], a: 1 },
    { d: 6,  q: "Which silver-armored chapter specializes in hunting daemons?", o: ["Deathwatch", "Grey Knights", "Black Templars", "Salamanders"], a: 1 },
    { d: 7,  q: "How many Primarchs were originally created by the Emperor?", o: ["18", "19", "20", "21"], a: 2 },
    { d: 8,  q: "Khorne's full battle cry is:", o: ["Skulls for the throne, blood for the hounds", "Blood for the Blood God, skulls for the Skull Throne", "Death heals all wounds", "The strong shall feed"], a: 1 },
    { d: 9,  q: "Who is the Primarch of the Emperor's Children Legion?", o: ["Lorgar", "Magnus", "Fulgrim", "Mortarion"], a: 2 },
    { d: 10, q: "Which Primarch was the first to fall to Chaos?", o: ["Horus", "Lorgar", "Angron", "Konrad Curze"], a: 1 },
  ],

  disney: [
    { d: 1,  q: "What is the first feature-length animated Disney film?", o: ["Pinocchio", "Snow White and the Seven Dwarfs", "Cinderella", "Bambi"], a: 1 },
    { d: 2,  q: "Who is the protagonist of The Lion King?", o: ["Mufasa", "Scar", "Simba", "Nala"], a: 2 },
    { d: 3,  q: "What is the name of the mermaid in The Little Mermaid?", o: ["Belle", "Ariel", "Aurora", "Jasmine"], a: 1 },
    { d: 4,  q: "Who serves as Pinocchio's conscience?", o: ["Jiminy Cricket", "Geppetto", "The Blue Fairy", "Figaro"], a: 0 },
    { d: 5,  q: "In what year did Snow White and the Seven Dwarfs release?", o: ["1933", "1937", "1940", "1945"], a: 1 },
    { d: 6,  q: "Who is the villain of Sleeping Beauty?", o: ["Ursula", "Maleficent", "Cruella de Vil", "The Queen of Hearts"], a: 1 },
    { d: 7,  q: "How many dwarfs are there in Snow White?", o: ["5", "6", "7", "8"], a: 2 },
    { d: 8,  q: "What is the name of Bambi's skunk friend?", o: ["Thumper", "Flower", "Friend Owl", "Faline"], a: 1 },
    { d: 9,  q: "What is the legendary sword in The Sword in the Stone?", o: ["Caliburn", "Excalibur", "Andúril", "Durandal"], a: 1 },
    { d: 10, q: "In what year was the classic Cinderella film released?", o: ["1948", "1950", "1953", "1955"], a: 1 },
  ],

  greek: [
    { d: 1,  q: "Who is the king of the Greek gods?", o: ["Apollo", "Zeus", "Hades", "Ares"], a: 1 },
    { d: 2,  q: "Which god rules the sea?", o: ["Zeus", "Poseidon", "Hermes", "Helios"], a: 1 },
    { d: 3,  q: "Which hero defeated the Minotaur?", o: ["Heracles", "Perseus", "Theseus", "Achilles"], a: 2 },
    { d: 4,  q: "Which hero killed Medusa?", o: ["Theseus", "Perseus", "Heracles", "Bellerophon"], a: 1 },
    { d: 5,  q: "How many labors did Heracles complete?", o: ["10", "11", "12", "13"], a: 2 },
    { d: 6,  q: "Which three-headed dog guards the underworld?", o: ["Orthrus", "Cerberus", "Hydra", "Chimera"], a: 1 },
    { d: 7,  q: "Who opened the box that released all evils into the world?", o: ["Helen", "Pandora", "Cassandra", "Penelope"], a: 1 },
    { d: 8,  q: "Who is the goddess of wisdom?", o: ["Artemis", "Athena", "Hera", "Aphrodite"], a: 1 },
    { d: 9,  q: "Who was condemned to push a boulder up a hill forever?", o: ["Tantalus", "Prometheus", "Sisyphus", "Atlas"], a: 2 },
    { d: 10, q: "Who was the father of Zeus, Poseidon, and Hades?", o: ["Uranus", "Cronus", "Oceanus", "Hyperion"], a: 1 },
  ],
};

/* ─── Leaderboard adapter — swap these for a backend for true global ─── */
const LeaderboardAdapter = {
  async list() {
    try { return JSON.parse(localStorage.getItem(LS_LEADERBOARD) || '[]'); }
    catch { return []; }
  },
  async submit(entry) {
    const list = await this.list();
    // Replace existing entry from the same UUID if the new score is higher
    const idx = list.findIndex(e => e.uuid === entry.uuid);
    if (idx >= 0) {
      if (entry.score > list[idx].score) list[idx] = entry;
    } else {
      list.push(entry);
    }
    list.sort((a, b) => b.score - a.score || (a.date || '').localeCompare(b.date || ''));
    const top = list.slice(0, 10);
    try { localStorage.setItem(LS_LEADERBOARD, JSON.stringify(top)); } catch {}
    return top;
  },
};

function placementOf(entry, list) {
  const idx = list.findIndex(e => e.uuid === entry.uuid && e.score === entry.score && e.date === entry.date);
  return idx >= 0 ? idx + 1 : 0;
}

/* ─── Popup UI: trivia opens as a second terminal layered on the hacker one ─── */
function ensureTriviaUI() {
  if (document.getElementById('trivia')) return document.getElementById('trivia');
  const root = document.createElement('div');
  root.id = 'trivia';
  root.className = 'trivia';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Trivia game terminal');
  root.innerHTML = `
    <div class="triviaBackdrop" aria-hidden="true"></div>
    <div class="triviaInner">
      <header class="triviaBar">
        <span class="triviaBarDot"></span>
        <span class="triviaBarLabel">trivia.exe — pursuit of points</span>
        <button class="triviaClose" aria-label="Close">[ exit ]</button>
      </header>
      <div class="triviaScreen" id="triviaScreen"></div>
      <div class="triviaInputRow">
        <span class="triviaPrompt">trivia@nikos:~#</span>
        <input class="triviaInput" id="triviaInput" type="text" autocomplete="off" spellcheck="false" />
      </div>
    </div>
  `;
  document.body.append(root);
  root.querySelector('.triviaClose').addEventListener('click', () => Trivia.quit());
  root.querySelector('.triviaBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) Trivia.quit();
  });
  return root;
}

/* ─── The game ─── */
const Trivia = {
  active: false,
  phase: null,
  picked: [],
  picksRemaining: [],
  score: 0,
  results: [],
  currentCategory: null,
  currentQuestion: null,
  currentDifficulty: 0,
  _continueHandler: null,
  _el: null, _screenEl: null, _inputEl: null, _bound: false,

  print(text, cls = 'out') {
    if (!this._screenEl) return;
    const row = document.createElement('div');
    row.className = 'triviaLine ' + cls;
    row.textContent = text;
    this._screenEl.append(row);
    this._screenEl.scrollTop = this._screenEl.scrollHeight;
  },

  clearScreen() {
    if (this._screenEl) this._screenEl.innerHTML = '';
  },

  open() {
    if (!window.Hacker?._getGamertag || !window.Hacker._getGamertag()) {
      if (window.Hacker?.print) window.Hacker.print('You need a gamertag before playing.', 'err');
      return;
    }
    this._el = ensureTriviaUI();
    this._screenEl = document.getElementById('triviaScreen');
    this._inputEl  = document.getElementById('triviaInput');

    if (!this._bound) {
      this._bound = true;
      this._inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = this._inputEl.value;
          this._inputEl.value = '';
          if (val.trim()) this.print(`trivia@nikos:~# ${val}`, 'echo');
          this.process(val);
        }
      });
      document.addEventListener('keydown', (e) => {
        if (this.active && e.key === 'Escape') this.quit();
      });
    }

    // Disable the underlying hacker input so typing goes to the popup
    if (window.Hacker?.inputEl) window.Hacker.inputEl.disabled = true;

    this._el.hidden = false;
    this.active = true;
    this.phase = 'rules';
    this.picked = [];
    this.picksRemaining = CATEGORIES.map(c => c.id);
    this.score = 0;
    this.results = [];
    this.currentCategory = null;
    this.currentQuestion = null;
    this.currentDifficulty = 0;
    this.clearScreen();
    this.showRules();
    setTimeout(() => this._inputEl?.focus(), 220);
  },

  process(input) {
    const cmd = (input || '').trim().toLowerCase();
    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') return this.quit();
    if (this.phase === 'rules')    return this.handleRulesInput(cmd);
    if (this.phase === 'category') return this.handleCategoryInput(cmd);
    if (this.phase === 'question') return this.handleAnswerInput(cmd);
    if (this.phase === 'between')  {
      const h = this._continueHandler; this._continueHandler = null;
      if (h) h();
      return;
    }
    if (this.phase === 'gameover') return this.handleGameOverInput(cmd);
  },

  showRules() {
    const p = (t, c = 'out') => this.print(t, c);
    p('═══ TRIVIA — RULES ═══════════════════════════════', 'narr');
    p('');
    p('  10 categories. 10 questions. One per category.');
    p('');
    p("  The ORDER you PICK a category is the DIFFICULTY of that");
    p("  category's question:");
    p('     1st pick → difficulty 1  →  100 pts if correct', 'ok');
    p('     2nd pick → difficulty 2  →  200 pts if correct', 'ok');
    p('     ...');
    p('     10th pick → difficulty 10 → 1000 pts if correct', 'ok');
    p('');
    p('  Strategy: save your strongest categories for LAST.');
    p('  Max possible score: 5,500.');
    p('');
    p('  Each question is multiple-choice: A / B / C / D.');
    p('  Wrong answer = 0 points. No partial credit.');
    p('');
    p('  Type `begin` to start, or `quit` to back out.');
    p('');
  },

  handleRulesInput(cmd) {
    if (cmd === 'begin' || cmd === 'start' || cmd === 'go' || cmd === '') {
      this.phase = 'category';
      this.clearScreen();
      this.showCategoryPicker();
    } else {
      this.print('Type `begin` to start (or `quit`).', 'err');
    }
  },

  showCategoryPicker() {
    const p = (t, c = 'out') => this.print(t, c);
    const pickNumber = this.picked.length + 1;
    const difficulty = pickNumber;
    const pts = difficulty * 100;
    p(`═══ PICK #${pickNumber}  ·  DIFFICULTY ${difficulty}  ·  ${pts} pts ═══`, 'narr');
    p('');
    if (this.picked.length > 0) {
      p(`  Score so far: ${this.score} pts`);
      p('');
    }
    p('  Pick a category by letter:');
    p('');
    const letters = 'ABCDEFGHIJ';
    this.picksRemaining.forEach((id, i) => {
      const cat = CATEGORIES.find(c => c.id === id);
      p(`    [${letters[i]}]  ${cat.name}`);
    });
    p('');
  },

  handleCategoryInput(cmd) {
    const letters = 'abcdefghij';
    const idx = letters.indexOf(cmd);
    if (idx < 0 || idx >= this.picksRemaining.length) {
      const lastLetter = 'ABCDEFGHIJ'[this.picksRemaining.length - 1];
      this.print(`Pick a letter A–${lastLetter}.`, 'err');
      return;
    }
    const categoryId = this.picksRemaining[idx];
    this.picksRemaining.splice(idx, 1);
    this.picked.push(categoryId);
    this.currentCategory = categoryId;
    this.currentDifficulty = this.picked.length;
    const bank = QUESTIONS[categoryId];
    this.currentQuestion = bank.find(q => q.d === this.currentDifficulty) || bank[this.currentDifficulty - 1];
    this.phase = 'question';
    this.clearScreen();
    this.showQuestion();
  },

  showQuestion() {
    const p = (t, c = 'out') => this.print(t, c);
    const cat = CATEGORIES.find(c => c.id === this.currentCategory);
    const q = this.currentQuestion;
    const pts = this.currentDifficulty * 100;
    p(`═══ ${cat.name.toUpperCase()}  ·  D${q.d}  ·  ${pts} pts ═══`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    const letters = 'ABCD';
    q.o.forEach((option, i) => {
      p(`    [${letters[i]}]  ${option}`);
    });
    p('');
    p('  Type your answer (A/B/C/D):');
  },

  handleAnswerInput(cmd) {
    const idx = 'abcd'.indexOf(cmd);
    if (idx < 0) {
      this.print('Type A, B, C, or D.', 'err');
      return;
    }
    const q = this.currentQuestion;
    const cat = CATEGORIES.find(c => c.id === this.currentCategory);
    const correct = idx === q.a;
    const pts = correct ? this.currentDifficulty * 100 : 0;
    this.score += pts;
    this.results.push({
      category: cat.name,
      difficulty: this.currentDifficulty,
      asked: q.q,
      yourAnswer: q.o[idx],
      correctAnswer: q.o[q.a],
      correct,
      pts,
    });
    this.clearScreen();
    const p = (t, c = 'out') => this.print(t, c);
    p(`═══ ${cat.name.toUpperCase()}  ·  D${q.d} ═══`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    if (correct) {
      p(`  ✓ Correct.  +${pts} pts.`, 'ok');
    } else {
      p(`  ✗ Wrong.  The answer was: ${q.o[q.a]}`, 'err');
    }
    p('');
    p(`  Score: ${this.score} pts`);
    p('');
    if (this.picked.length >= 10) {
      setTimeout(() => this.gameOver(), 1400);
    } else {
      p('  Press Enter to continue.');
      this.phase = 'between';
      this._continueHandler = () => {
        this.phase = 'category';
        this.clearScreen();
        this.showCategoryPicker();
      };
    }
  },

  async gameOver() {
    this.phase = 'gameover';
    const gamertag = (window.Hacker._getGamertag && window.Hacker._getGamertag()) || 'ANON';
    const entry = {
      gamertag,
      uuid: getUuid(),
      score: this.score,
      date: new Date().toISOString(),
    };
    const top = await LeaderboardAdapter.submit(entry);
    const placement = placementOf(entry, top);

    this.clearScreen();
    const p = (t, c = 'out') => this.print(t, c);
    p('═══ GAME OVER ════════════════════════════════════', 'narr');
    p('');
    p(`  ${gamertag}  —  ${this.score} / 5500`, 'ok');
    p('');
    if (placement === 1)      p('  🥇  NEW #1 — top of the leaderboard.', 'ok');
    else if (placement === 2) p('  🥈  #2 on the leaderboard.', 'ok');
    else if (placement === 3) p('  🥉  #3 on the leaderboard.', 'ok');
    else if (placement > 0)   p(`  ▸  Made the leaderboard at #${placement}.`, 'ok');
    else                      p('  Not in the top 10 this time.', 'out');
    p('');
    p('  ─── LEADERBOARD ───');
    p('');
    top.forEach((e, i) => {
      const isYou = e.uuid === entry.uuid && e.score === entry.score && e.date === entry.date;
      const marker = isYou ? '  ←  YOU' : '';
      p(`    ${String(i + 1).padStart(2)}.  ${e.gamertag.padEnd(12)}  ${String(e.score).padStart(5)} pts${marker}`,
        isYou ? 'ok' : 'out');
    });
    p('');
    p('  ─── PER-CATEGORY ───');
    p('');
    this.results.forEach((r) => {
      const icon = r.correct ? '✓' : '✗';
      const cls = r.correct ? 'ok' : 'err';
      const pts = r.pts ? '+' + r.pts : '0';
      p(`    ${icon}  D${String(r.difficulty).padStart(2)}  ${r.category.padEnd(22)}  ${pts} pts`, cls);
    });
    p('');
    p('  Type `again` to play again, or `back` to return to the hacker menu.');
  },

  handleGameOverInput(cmd) {
    if (cmd === 'again' || cmd === 'replay' || cmd === 'restart') return this.open();
    if (cmd === 'back' || cmd === '' || cmd === 'menu') return this.quit();
    this.print('Type `again` or `back`.', 'err');
  },

  quit() {
    this.active = false;
    this.phase = null;
    if (this._el) this._el.hidden = true;
    if (window.Hacker?.inputEl) {
      window.Hacker.inputEl.disabled = false;
      setTimeout(() => window.Hacker.inputEl?.focus(), 80);
    }
  },
};

window.Trivia = Trivia;
window.TriviaAdapter = LeaderboardAdapter;  // for swapping backend
window.getUuid = getUuid;

})();
