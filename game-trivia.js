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
    { d: 1,  q: "At what address do the Dursleys live?", o: ["4 Privet Drive", "12 Grimmauld Place", "13 Spinner's End", "5 Magnolia Crescent"], a: 0 },
    { d: 2,  q: "What is the Hogwarts school motto (in Latin)?", o: ["Draco Dormiens Nunquam Titillandus", "Veritas Aeterna Magica", "Per Aspera Ad Sapientiam", "Numquam Sine Magia"], a: 0 },
    { d: 3,  q: "What kind of creature is Aragog?", o: ["A dragon", "A werewolf", "A giant spider", "A basilisk"], a: 2 },
    { d: 4,  q: "Which Horcrux is destroyed by Crabbe's Fiendfyre in the Room of Requirement?", o: ["Helga Hufflepuff's cup", "Ravenclaw's Diadem", "Slytherin's locket", "Tom Riddle's diary"], a: 1 },
    { d: 5,  q: "Which Unforgivable Curse compels its target to obey the caster's commands?", o: ["Crucio", "Imperio", "Avada Kedavra", "Confundus"], a: 1 },
    { d: 6,  q: "Who teaches Defence Against the Dark Arts in Harry's third year?", o: ["Gilderoy Lockhart", "Quirinus Quirrell", "Remus Lupin", "Alastor Moody"], a: 2 },
    { d: 7,  q: "Who kills Bellatrix Lestrange in the Battle of Hogwarts?", o: ["Harry Potter", "Hermione Granger", "Molly Weasley", "Neville Longbottom"], a: 2 },
    { d: 8,  q: "What is Tom Riddle's middle name?", o: ["Salazar", "Marvolo", "Sirius", "Gaunt"], a: 1 },
    { d: 9,  q: "In what year is Harry Potter born?", o: ["1979", "1980", "1981", "1982"], a: 1 },
    { d: 10, q: "What is the title of Rita Skeeter's tell-all book about Dumbledore?", o: ["The Greatest Wizard of the Century", "Albus Dumbledore: A Life Examined", "The Life and Lies of Albus Dumbledore", "Secrets of the Headmaster"], a: 2 },
  ],

  mtg: [
    { d: 1,  q: "What is the default starting life total in standard Magic?", o: ["15", "20", "30", "40"], a: 1 },
    { d: 2,  q: "Which card type was first introduced in the Mirrodin block (2003)?", o: ["Planeswalker", "Vehicle", "Equipment", "Saga"], a: 2 },
    { d: 3,  q: "What color is associated with Islands?", o: ["White", "Blue", "Black", "Green"], a: 1 },
    { d: 4,  q: "Which card is widely considered the most valuable in Magic?", o: ["Time Walk", "Black Lotus", "Ancestral Recall", "Mox Sapphire"], a: 1 },
    { d: 5,  q: "What is the mana cost of Black Lotus?", o: ["0", "1", "2", "3"], a: 0 },
    { d: 6,  q: "Which set introduced the first Planeswalker cards as a new card type?", o: ["Future Sight", "Lorwyn", "Time Spiral", "Shards of Alara"], a: 1 },
    { d: 7,  q: "Which planeswalker is the iconic black-aligned queen of necromancy?", o: ["Jace Beleren", "Chandra Nalaar", "Liliana Vess", "Nissa Revane"], a: 2 },
    { d: 8,  q: "Niv-Mizzet belongs to which Ravnican guild?", o: ["Izzet", "Boros", "Simic", "Dimir"], a: 0 },
    { d: 9,  q: "In which year was the Reserved List established to permanently prevent reprints of valuable cards?", o: ["1994", "1996", "1998", "2000"], a: 1 },
    { d: 10, q: "Which set introduced the 'companion' mechanic?", o: ["Throne of Eldraine", "Theros Beyond Death", "Ikoria: Lair of Behemoths", "Zendikar Rising"], a: 2 },
  ],

  lotr: [
    { d: 1,  q: "Who ultimately carries the One Ring to Mount Doom?", o: ["Frodo Baggins", "Samwise Gamgee", "Aragorn", "Gandalf"], a: 0 },
    { d: 2,  q: "Where do hobbits live?", o: ["Rivendell", "The Shire", "Helm's Deep", "Lothlórien"], a: 1 },
    { d: 3,  q: "Legolas belongs to which race?", o: ["Hobbit", "Elf", "Dwarf", "Man"], a: 1 },
    { d: 4,  q: "Who is King of Rohan during the War of the Ring?", o: ["Aragorn", "Denethor", "Théoden", "Elrond"], a: 2 },
    { d: 5,  q: "What is the name of the sword reforged for Aragorn?", o: ["Glamdring", "Sting", "Andúril", "Hadhafang"], a: 2 },
    { d: 6,  q: "In what year did J.R.R. Tolkien die?", o: ["1971", "1973", "1975", "1977"], a: 1 },
    { d: 7,  q: "What is the name of Aragorn's father?", o: ["Arathorn", "Arador", "Aragost", "Arvegil"], a: 0 },
    { d: 8,  q: "How many Silmarils were created by Fëanor?", o: ["One", "Three", "Seven", "Nine"], a: 1 },
    { d: 9,  q: "Which of the Three Elven Rings of Power is borne by Galadriel?", o: ["Vilya", "Narya", "Nenya", "Andvarinaut"], a: 2 },
    { d: 10, q: "Who created the Palantíri?", o: ["Aulë", "Fëanor", "Manwë", "Celebrimbor"], a: 1 },
  ],

  onepiece: [
    { d: 1,  q: "Who is the first pirate Luffy ever fights at the start of his journey?", o: ["Buggy the Clown", "Alvida", "Arlong", "Captain Kuro"], a: 1 },
    { d: 2,  q: "How many crewmates total does Luffy say he wants in his crew?", o: ["8", "10", "11", "12"], a: 1 },
    { d: 3,  q: "What is the name of the pirate crew Brook belonged to before joining the Straw Hats?", o: ["Rumbar Pirates", "Florian Pirates", "Tequila Pirates", "Yarukimina Pirates"], a: 0 },
    { d: 4,  q: "Who is the doctor that trained Chopper in medicine after Dr. Hiriluk's death?", o: ["Dr. Vegapunk", "Dr. Kureha", "Dr. Indigo", "Dr. Tsumegami"], a: 1 },
    { d: 5,  q: "From which of the Four Seas is the former Warlord Gecko Moria originally from?", o: ["North Blue", "East Blue", "South Blue", "West Blue"], a: 3 },
    { d: 6,  q: "What is the given (first) name of the swordsman 'Hawk-Eyes' Mihawk?", o: ["Dracule", "Daiyamondo", "Juraku", "Mihos"], a: 0 },
    { d: 7,  q: "Who is revealed in the Egghead arc to be the biological father of Jewelry Bonney?", o: ["Silvers Rayleigh", "Bartholomew Kuma", "Marshall D. Teach", "Edward Newgate"], a: 1 },
    { d: 8,  q: "What is the family name of Sanji, revealed during the Whole Cake Island arc?", o: ["Vinsmoke", "Donquixote", "Charlotte", "Kurozumi"], a: 0 },
    { d: 9,  q: "What is the name of Dr. Vegapunk's iconic cyborg-human weapon program, modeled on Bartholomew Kuma?", o: ["Cipher Pol", "Pacifista", "Seraphim", "MADS"], a: 1 },
    { d: 10, q: "Which legendary figure, believed to be the world's first pirate, is central to the prophecy of the Void Century?", o: ["Imu", "Joy Boy", "Rocks D. Xebec", "Gol D. Roger"], a: 1 },
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
        <span class="triviaBarLabel">Trivia · Pursuit of Points</span>
        <button class="triviaClose" aria-label="Close">×</button>
      </header>
      <div class="triviaScreen" id="triviaScreen"></div>
      <div class="triviaInputRow">
        <span class="triviaPrompt">▸</span>
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
  _gamertag: '',
  _wasHackerActive: false,

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

  setInputVisible(visible) {
    const row = this._el?.querySelector('.triviaInputRow');
    if (row) row.style.display = visible ? '' : 'none';
  },

  printActions(buttons) {
    if (!this._screenEl) return;
    const row = document.createElement('div');
    row.className = 'triviaActions';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'triviaActionBtn' + (b.variant ? ' triviaActionBtn--' + b.variant : '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      row.appendChild(btn);
    });
    this._screenEl.appendChild(row);
    this._screenEl.scrollTop = this._screenEl.scrollHeight;
  },

  printCategoryGrid(categoryIds, onPick) {
    if (!this._screenEl) return;
    const grid = document.createElement('div');
    grid.className = 'triviaCategoryGrid';
    categoryIds.forEach(id => {
      const cat = CATEGORIES.find(c => c.id === id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'triviaCategoryBtn';
      btn.textContent = cat.name;
      btn.addEventListener('click', () => onPick(id));
      grid.appendChild(btn);
    });
    this._screenEl.appendChild(grid);
    this._screenEl.scrollTop = this._screenEl.scrollHeight;
  },

  printOptions(options, onPick) {
    if (!this._screenEl) return;
    const grid = document.createElement('div');
    grid.className = 'triviaOptions';
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'triviaOptionBtn';
      const letter = document.createElement('span');
      letter.className = 'triviaOptionLetter';
      letter.textContent = 'ABCD'[i];
      const text = document.createElement('span');
      text.className = 'triviaOptionText';
      text.textContent = opt;
      btn.appendChild(letter);
      btn.appendChild(text);
      btn.addEventListener('click', () => onPick(i));
      grid.appendChild(btn);
    });
    this._screenEl.appendChild(grid);
    this._screenEl.scrollTop = this._screenEl.scrollHeight;
  },

  _loadGamertag() {
    if (window.Hacker?._getGamertag) {
      const t = window.Hacker._getGamertag();
      if (t) return t;
    }
    try { return localStorage.getItem('nikos.gamertag') || ''; } catch { return ''; }
  },

  _saveGamertag(tag) {
    this._gamertag = tag;
    try { localStorage.setItem('nikos.gamertag', tag); } catch {}
    if (window.Hacker) window.Hacker._gamertag = tag;
  },

  promptGamertag() {
    this.setInputVisible(true);
    this.print('  Pick a gamertag for the leaderboard (2–12 letters, digits, or _).', 'narr');
    this.print('  Leave blank for Anon.', 'narr');
    this.print('', 'out');
  },

  handleGamertagInput(input) {
    const tag = (input || '').trim();
    if (!tag) {
      this._saveGamertag('Anon');
      this.print('  gamertag set: Anon', 'ok');
    } else if (!/^[A-Za-z0-9_]{2,12}$/.test(tag)) {
      this.print('  Invalid. 2–12 letters, digits, or underscore. Or leave blank for Anon.', 'err');
      return;
    } else {
      this._saveGamertag(tag);
      this.print(`  gamertag set: ${tag}`, 'ok');
    }
    this.print('', 'out');
    this.phase = 'rules';
    this.showRules();
  },

  open() {
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

    // Only disable the hacker input when it's actually live underneath.
    this._wasHackerActive = !!(window.Hacker?.active && window.Hacker.inputEl);
    if (this._wasHackerActive) window.Hacker.inputEl.disabled = true;

    this._el.hidden = false;
    this.active = true;
    this.picked = [];
    this.picksRemaining = CATEGORIES.map(c => c.id);
    this.score = 0;
    this.results = [];
    this.currentCategory = null;
    this.currentQuestion = null;
    this.currentDifficulty = 0;
    this.clearScreen();

    this._gamertag = this._loadGamertag();
    if (this._gamertag) {
      this.phase = 'rules';
      this.showRules();
    } else {
      this.phase = 'gamertag';
      this.promptGamertag();
    }
    setTimeout(() => this._inputEl?.focus(), 220);
  },

  process(input) {
    const cmd = (input || '').trim().toLowerCase();
    if (this.phase === 'gamertag') return this.handleGamertagInput(input);
    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') return this.quit();
    // All other phases are click-driven; ignore stray input.
  },

  showRules() {
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    p('Trivia — Rules', 'narr');
    p('');
    p('  10 categories. 10 questions. One per category.');
    p('');
    p('  The order you pick a category sets that category\'s difficulty:');
    p('     1st pick → difficulty 1  →  100 pts if correct', 'ok');
    p('     2nd pick → difficulty 2  →  200 pts if correct', 'ok');
    p('     ...');
    p('    10th pick → difficulty 10 → 1000 pts if correct', 'ok');
    p('');
    p('  Strategy: save your strongest categories for last.');
    p('  Max possible score: 5,500.');
    p('');
    p('  Each question is multiple choice. Wrong = 0 points. No partial credit.');
    p('');
    this.printActions([
      { label: 'Begin', variant: 'primary', onClick: () => { this.phase = 'category'; this.clearScreen(); this.showCategoryPicker(); } },
      { label: 'Cancel', onClick: () => this.quit() },
    ]);
  },

  showCategoryPicker() {
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    const pickNumber = this.picked.length + 1;
    const difficulty = pickNumber;
    const pts = difficulty * 100;
    p(`Pick #${pickNumber}  ·  Difficulty ${difficulty}  ·  ${pts} pts`, 'narr');
    p('');
    if (this.picked.length > 0) {
      p(`  Score so far: ${this.score} pts`);
      p('');
    }
    p('  Pick a category:');
    this.printCategoryGrid(this.picksRemaining, (id) => this.handleCategoryPick(id));
  },

  handleCategoryPick(categoryId) {
    const idx = this.picksRemaining.indexOf(categoryId);
    if (idx < 0) return;
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
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    const cat = CATEGORIES.find(c => c.id === this.currentCategory);
    const q = this.currentQuestion;
    const pts = this.currentDifficulty * 100;
    p(`${cat.name}  ·  D${q.d}  ·  ${pts} pts`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    this.printOptions(q.o, (i) => this.handleAnswerPick(i));
  },

  handleAnswerPick(idx) {
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
    p(`${cat.name}  ·  D${q.d}`, 'narr');
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
      this.phase = 'between';
      this.printActions([
        { label: 'Continue →', variant: 'primary', onClick: () => { this.phase = 'category'; this.clearScreen(); this.showCategoryPicker(); } },
      ]);
    }
  },

  async gameOver() {
    this.phase = 'gameover';
    this.setInputVisible(false);
    const gamertag = this._gamertag || 'Anon';
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
    p('Game Over', 'narr');
    p('');
    p(`  ${gamertag}  —  ${this.score} / 5500`, 'ok');
    p('');
    if (placement === 1)      p('  🥇  NEW #1 — top of the leaderboard.', 'ok');
    else if (placement === 2) p('  🥈  #2 on the leaderboard.', 'ok');
    else if (placement === 3) p('  🥉  #3 on the leaderboard.', 'ok');
    else if (placement > 0)   p(`  ▸  Made the leaderboard at #${placement}.`, 'ok');
    else                      p('  Not in the top 10 this time.', 'out');
    p('');
    p('  Leaderboard', 'narr');
    p('');
    top.forEach((e, i) => {
      const isYou = e.uuid === entry.uuid && e.score === entry.score && e.date === entry.date;
      const marker = isYou ? '  ←  YOU' : '';
      p(`    ${String(i + 1).padStart(2)}.  ${e.gamertag.padEnd(12)}  ${String(e.score).padStart(5)} pts${marker}`,
        isYou ? 'ok' : 'out');
    });
    p('');
    p('  Per category', 'narr');
    p('');
    this.results.forEach((r) => {
      const icon = r.correct ? '✓' : '✗';
      const cls = r.correct ? 'ok' : 'err';
      const pts = r.pts ? '+' + r.pts : '0';
      p(`    ${icon}  D${String(r.difficulty).padStart(2)}  ${r.category.padEnd(22)}  ${pts} pts`, cls);
    });
    p('');
    this.printActions([
      { label: 'Play Again', variant: 'primary', onClick: () => this.open() },
      { label: 'Close', onClick: () => this.quit() },
    ]);
  },

  quit() {
    this.active = false;
    this.phase = null;
    if (this._el) this._el.hidden = true;
    if (this._wasHackerActive && window.Hacker?.inputEl) {
      window.Hacker.inputEl.disabled = false;
      setTimeout(() => window.Hacker.inputEl?.focus(), 80);
    }
    this._wasHackerActive = false;
  },
};

/* ════════════════════════════════════════════════════════════════════════
   IMPOSSIBLE MODE — 20 deep-cut One Piece questions.
   Single-category gauntlet. Score = correct count out of 20. No partial credit.
   Reuses the Trivia modal/UI; separate phase + state to keep both modes simple.
   ════════════════════════════════════════════════════════════════════════ */

const IMPOSSIBLE_QUESTIONS = [
  { q: "Who was the captain of the legendary Rocks Pirates that fought Roger and Garp at God Valley?",
    o: ["Silvers Rayleigh", "Rocks D. Xebec", "Edward Newgate", "Shiki the Golden Lion"], a: 1 },
  { q: "On what island did the God Valley Incident take place?",
    o: ["Hachinosu", "Sphinx", "God Valley", "Lulusia"], a: 2 },
  { q: "What is the canonical name of Luffy's Devil Fruit, revealed in Wano?",
    o: ["Gomu Gomu no Mi", "Nika Nika no Mi", "Hito Hito no Mi, Model: Joy Boy", "Hito Hito no Mi, Model: Nika"], a: 3 },
  { q: "What is the model of Kaido's Mythical Zoan Devil Fruit?",
    o: ["Uo Uo no Mi, Model: Seiryu", "Ryu Ryu no Mi, Model: Pteranodon", "Hebi Hebi no Mi, Model: Yamata no Orochi", "Ryu Ryu no Mi, Model: Allosaurus"], a: 0 },
  { q: "Which of Vegapunk's six satellites is revealed to be the traitor on Egghead Island?",
    o: ["Shaka", "Lilith", "Atlas", "York"], a: 3 },
  { q: "Who is the hidden monarch seated on the Empty Throne in Mary Geoise?",
    o: ["Saint Jaygarcia Saturn", "Im", "Saint Topman Warcury", "Saint Marcus Mars"], a: 1 },
  { q: "Which planet is the Gorosei elder 'Saint Jaygarcia ___' named after?",
    o: ["Mars", "Jupiter", "Saturn", "Pluto"], a: 2 },
  { q: "What is the name of the orphanage where Charlotte Linlin (Big Mom) was raised by Mother Carmel?",
    o: ["Sheep's House", "Goat's Den", "Elbaf Orphanage", "Carmel's Hearth"], a: 0 },
  { q: "What is the birth name of Marine Fleet Admiral 'Akainu'?",
    o: ["Borsalino", "Kuzan", "Issho", "Sakazuki"], a: 3 },
  { q: "Who forged Zoro's sword Wado Ichimonji generations before the story begins?",
    o: ["Shimotsuki Ushimaru", "Shimotsuki Kozaburo", "Kawamatsu the Kappa", "Tenguyama Kotetsu"], a: 1 },
  { q: "What is the name of Sanji's biological mother?",
    o: ["Reiju", "Stussy", "Sora", "Bell-mère"], a: 2 },
  { q: "What is the name of Portgas D. Ace's biological mother?",
    o: ["Portgas D. Rouge", "Nico Olvia", "Kozuki Toki", "Bell-mère"], a: 0 },
  { q: "What was the name of Gol D. Roger's pirate ship?",
    o: ["Moby Dick", "Red Force", "Victoria Punk", "Oro Jackson"], a: 3 },
  { q: "Who served as the 1st Division Commander (de facto right hand) of the Whitebeard Pirates?",
    o: ["Marco the Phoenix", "Jozu the Diamond", "Vista the Flower Sword", "Portgas D. Ace"], a: 0 },
  { q: "What is the name of Kaido's biological daughter?",
    o: ["O-Tama", "Hiyori", "Yamato", "O-Lin"], a: 2 },
  { q: "Who is Jewelry Bonney's biological father?",
    o: ["Marshall D. Teach", "Silvers Rayleigh", "Crocodile", "Bartholomew Kuma"], a: 3 },
  { q: "What is Trafalgar Law's full real name, revealed to Doflamingo at Dressrosa?",
    o: ["Trafalgar D. North Law", "Trafalgar D. Water Law", "Trafalgar D. Cora Law", "Trafalgar D. Sea Law"], a: 1 },
  { q: "What is the model of Sengoku's Mythical Zoan Devil Fruit?",
    o: ["Hito Hito no Mi, Model: Daibutsu", "Hito Hito no Mi, Model: Tengu", "Hito Hito no Mi, Model: Kannon", "Hito Hito no Mi, Model: Nika"], a: 0 },
  { q: "Who is Donquixote Doflamingo's deceased younger brother, the undercover Marine known as 'Corazon'?",
    o: ["Donquixote Homing", "Donquixote Rosinante", "Donquixote Mjosgard", "Donquixote Doffy"], a: 1 },
  { q: "Which Vegapunk body is the original, oldest 'Punk-00' / Stella designation?",
    o: ["Shaka", "Edison", "The old man Vegapunk (Stella)", "Pythagoras"], a: 2 },
];

const Impossible = {
  active: false,
  phase: null,
  idx: 0,
  results: [],
  _wasHackerActive: false,

  open() {
    Trivia._el = ensureTriviaUI();
    Trivia._screenEl = document.getElementById('triviaScreen');
    Trivia._inputEl  = document.getElementById('triviaInput');

    const label = Trivia._el.querySelector('.triviaBarLabel');
    if (label) label.textContent = 'Impossible · One Piece · Deep Cuts';

    if (!Trivia._bound) {
      Trivia._bound = true;
      Trivia._inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = Trivia._inputEl.value;
          Trivia._inputEl.value = '';
          if (val.trim()) Trivia.print(`trivia@nikos:~# ${val}`, 'echo');
          Trivia.process(val);
        }
      });
      document.addEventListener('keydown', (e) => {
        if ((Trivia.active || Impossible.active) && e.key === 'Escape') {
          if (Impossible.active) Impossible.quit();
          else Trivia.quit();
        }
      });
    }

    this._wasHackerActive = !!(window.Hacker?.active && window.Hacker.inputEl);
    if (this._wasHackerActive) window.Hacker.inputEl.disabled = true;

    Trivia._el.hidden = false;
    this.active = true;
    Trivia.active = false;
    this.idx = 0;
    this.results = [];
    Trivia.clearScreen();
    this.phase = 'rules';
    this.showRules();
    setTimeout(() => Trivia._inputEl?.focus(), 220);
  },

  showRules() {
    Trivia.setInputVisible(false);
    const p = (t, c = 'out') => Trivia.print(t, c);
    p('Impossible — One Piece, deep cuts', 'narr');
    p('');
    p('  20 questions. One Piece only. The obscure stuff.');
    p('  Void Century, Vegapunk satellites, who-was-whose-mother, sword forgers,');
    p('  the names behind the epithets.');
    p('');
    p('  Each correct answer = 1 point. Max score: 20 / 20.', 'ok');
    p('  Wrong = 0. No partial credit. No second chances.', 'err');
    p('');
    p('  If you score 15+, you have read the manga. Twice.');
    p('');
    Trivia.printActions([
      { label: 'Begin', variant: 'primary', onClick: () => { this.phase = 'question'; Trivia.clearScreen(); this.showQuestion(); } },
      { label: 'Cancel', onClick: () => this.quit() },
    ]);
  },

  showQuestion() {
    Trivia.setInputVisible(false);
    const p = (t, c = 'out') => Trivia.print(t, c);
    const q = IMPOSSIBLE_QUESTIONS[this.idx];
    p(`Question ${this.idx + 1} / 20  ·  One Piece`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    Trivia.printOptions(q.o, (i) => this.handleAnswerPick(i));
  },

  handleAnswerPick(idx) {
    const q = IMPOSSIBLE_QUESTIONS[this.idx];
    const correct = idx === q.a;
    this.results.push({
      n: this.idx + 1,
      asked: q.q,
      yourAnswer: q.o[idx],
      correctAnswer: q.o[q.a],
      correct,
    });
    Trivia.clearScreen();
    const p = (t, c = 'out') => Trivia.print(t, c);
    p(`Question ${this.idx + 1} / 20`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    if (correct) p('  ✓ Correct.', 'ok');
    else         p(`  ✗ Wrong.  The answer was: ${q.o[q.a]}`, 'err');
    const score = this.results.filter(r => r.correct).length;
    p('');
    p(`  Score: ${score} / ${this.idx + 1}`);
    p('');
    this.idx++;
    if (this.idx >= IMPOSSIBLE_QUESTIONS.length) {
      setTimeout(() => this.gameOver(), 1200);
    } else {
      this.phase = 'between';
      Trivia.printActions([
        { label: 'Next →', variant: 'primary', onClick: () => { this.phase = 'question'; Trivia.clearScreen(); this.showQuestion(); } },
      ]);
    }
  },

  gameOver() {
    this.phase = 'gameover';
    Trivia.setInputVisible(false);
    const score = this.results.filter(r => r.correct).length;
    Trivia.clearScreen();
    const p = (t, c = 'out') => Trivia.print(t, c);
    p('Impossible — Result', 'narr');
    p('');
    p(`  ${score} / 20`, score >= 15 ? 'ok' : score >= 8 ? 'out' : 'err');
    p('');
    if (score === 20)      p('  Perfect. You are Oda in disguise.', 'ok');
    else if (score >= 17)  p('  Elite. You read the SBS columns.', 'ok');
    else if (score >= 13)  p('  Strong. You\'ve been keeping up with Egghead.', 'ok');
    else if (score >= 8)   p('  Respectable. Anime-only, but well-watched.');
    else if (score >= 4)   p('  Surface level. The crew names alone are not enough here.', 'err');
    else                   p('  Did you mean to click Trivia instead?', 'err');
    p('');
    p('  Answers', 'narr');
    p('');
    this.results.forEach((r) => {
      const icon = r.correct ? '✓' : '✗';
      const cls = r.correct ? 'ok' : 'err';
      p(`    ${icon}  Q${String(r.n).padStart(2)}  ${r.correctAnswer}`, cls);
    });
    p('');
    Trivia.printActions([
      { label: 'Play Again', variant: 'primary', onClick: () => this.open() },
      { label: 'Close', onClick: () => this.quit() },
    ]);
  },

  quit() {
    this.active = false;
    this.phase = null;
    if (Trivia._el) {
      Trivia._el.hidden = true;
      const label = Trivia._el.querySelector('.triviaBarLabel');
      if (label) label.textContent = 'Trivia · Pursuit of Points';
    }
    if (this._wasHackerActive && window.Hacker?.inputEl) {
      window.Hacker.inputEl.disabled = false;
      setTimeout(() => window.Hacker.inputEl?.focus(), 80);
    }
    this._wasHackerActive = false;
  },
};

window.Trivia = Trivia;
window.Impossible = Impossible;
window.TriviaAdapter = LeaderboardAdapter;  // for swapping backend
window.getUuid = getUuid;

})();
