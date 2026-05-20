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
    { d: 1,  q: "Who is the father of Zeus, Poseidon, and Hades?", o: ["Uranus", "Cronus", "Oceanus", "Hyperion"], a: 1 },
    { d: 2,  q: "Which Titan stole fire from the gods to give to humanity?", o: ["Prometheus", "Epimetheus", "Atlas", "Hyperion"], a: 0 },
    { d: 3,  q: "Which Olympian was cast down from Olympus by his mother Hera for being lame and ugly?", o: ["Hermes", "Ares", "Hephaestus", "Dionysus"], a: 2 },
    { d: 4,  q: "What winged horse sprang from the blood of Medusa when Perseus beheaded her?", o: ["Bucephalus", "Pegasus", "Arion", "Skinfaxi"], a: 1 },
    { d: 5,  q: "Which hero, with the help of the witch Medea, retrieved the Golden Fleece from Colchis?", o: ["Theseus", "Jason", "Heracles", "Bellerophon"], a: 1 },
    { d: 6,  q: "Which Titaness was Cronus's sister-wife and mother of the first Olympian generation?", o: ["Rhea", "Themis", "Mnemosyne", "Tethys"], a: 0 },
    { d: 7,  q: "What sea-nymph (Nereid) was the mother of the hero Achilles?", o: ["Galatea", "Amphitrite", "Thetis", "Calypso"], a: 2 },
    { d: 8,  q: "In Greek myth, who are the three judges of the dead in the Underworld?", o: ["Minos, Rhadamanthus, and Aeacus", "Hades, Thanatos, and Hypnos", "Charon, Hermes, and Anubis", "Theseus, Pirithous, and Heracles"], a: 0 },
    { d: 9,  q: "According to Hesiod's Theogony, which primordial being is the first to emerge after Chaos?", o: ["Eros", "Gaia", "Nyx", "Tartarus"], a: 1 },
    { d: 10, q: "Which three Cyclopes, sons of Uranus and Gaia, forged Zeus's thunderbolts?", o: ["Brontes, Steropes, and Arges", "Cottus, Briareus, and Gyges", "Polyphemus, Telemus, and Geryon", "Helios, Selene, and Eos"], a: 0 },
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

    // Reset the title bar in case a prior session ran a sub-mode.
    const label = this._el.querySelector('.triviaBarLabel');
    if (label) label.textContent = 'Trivia · Pursuit of Points';

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

    // Always start at the mode picker. Gamertag/rules come after the player
    // chooses Standard. Impossible mode is its own modal — we close this one
    // and hand off when picked.
    this.phase = 'modeSelect';
    this.showModeSelect();
    setTimeout(() => this._inputEl?.focus(), 220);
  },

  process(input) {
    const cmd = (input || '').trim().toLowerCase();
    if (this.phase === 'gamertag') return this.handleGamertagInput(input);
    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') return this.quit();
    // All other phases are click-driven; ignore stray input.
  },

  showModeSelect() {
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    p('Trivia — pick your mode', 'narr');
    p('');
    p('  Normal', 'ok');
    p('    10 categories, one question each. Pick order = difficulty curve.');
    p('    Strategy game. Multi-fandom. Max 5,500 pts.');
    p('');
    p('  Impossible', 'err');
    p('    Single category. 20 deep-cut questions. No mercy. Max 2,000 pts.');
    p('    Pick a fandom on the next screen.');
    p('');
    this.printActions([
      { label: '🧠 Normal',     variant: 'primary', onClick: () => this._enterStandard() },
      { label: '💀 Impossible',                     onClick: () => this.showImpossiblePicker() },
      { label: 'Cancel',                            onClick: () => this.quit() },
    ]);
  },

  showImpossiblePicker() {
    this.phase = 'impossiblePicker';
    this.clearScreen();
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    p('Impossible — pick a category', 'narr');
    p('');
    p('  20 deep-cut questions in a single category.');
    p('  Each category has its own leaderboard.');
    p('');
    const buttons = Object.keys(IMPOSSIBLE_BANKS).map(id => {
      const name = impossibleCategoryName(id);
      return { label: `💀  ${name}`, onClick: () => this._enterImpossible(id) };
    });
    buttons.push({ label: '← Back', onClick: () => { this.clearScreen(); this.phase = 'modeSelect'; this.showModeSelect(); } });
    buttons.push({ label: 'Cancel', onClick: () => this.quit() });
    this.printActions(buttons);
  },

  _enterStandard() {
    this.clearScreen();
    this._gamertag = this._loadGamertag();
    if (this._gamertag) {
      this.phase = 'rules';
      this.showRules();
    } else {
      this.phase = 'gamertag';
      this.promptGamertag();
    }
  },

  _enterImpossible(categoryId) {
    // Close this modal and hand off to the Impossible one (separate window).
    this.quit();
    if (window.Narrator?.fire) window.Narrator.fire('openImpossible');
    if (window.Impossible?.open) window.Impossible.open(categoryId);
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
   IMPOSSIBLE MODE — Deep-cut single-category gauntlets.
   For now: One Piece only. Architecture supports more categories later via
   IMPOSSIBLE_BANKS[categoryId] = [...questions].

   Lives in its OWN modal (#impossible) so it can layer over (or beside) the
   regular Trivia window. Independent state, gamertag, and leaderboard
   storage — same scoring shape (100 pts per correct) so the leaderboard UI
   is identical.
   ════════════════════════════════════════════════════════════════════════ */

const LS_IMPOSSIBLE_LB_PREFIX = 'nikos.impossible.leaderboard';

/* Display names for impossible categories that aren't in CATEGORIES
   (or that want a different label there). Falls back to CATEGORIES, then id. */
const IMPOSSIBLE_NAMES = {
  himym: 'How I Met Your Mother',
  friends: 'Friends',
};

function impossibleCategoryName(id) {
  return IMPOSSIBLE_NAMES[id]
    || (CATEGORIES.find(c => c.id === id) || {}).name
    || id;
}

/* Per-category result blurbs. Six tiers, ordered best → worst:
   [0] perfect (== total)
   [1] elite (>=17)
   [2] strong (>=13)
   [3] respectable (>=8)
   [4] surface (>=4)
   [5] bottom (<4) */
const IMPOSSIBLE_BLURBS = {
  onepiece: [
    "Perfect. You are Oda in disguise.",
    "Elite. You read the SBS columns.",
    "Strong. You've been keeping up with Egghead.",
    "Respectable. Anime-only, but well-watched.",
    "Surface level. Crew names alone won't cut it here.",
    "Did you mean to click Trivia instead?",
  ],
  lotr: [
    "Perfect. Tolkien would nod once, then return to inventing a language.",
    "Elite. You've cross-read the Appendices and Unfinished Tales.",
    "Strong. You know your Silmarillion from your Hobbit.",
    "Respectable. Trilogy-and-Hobbit reader. Or extended-edition loyalist.",
    "Surface level. You've watched the films. Once.",
    "You shall not pass… this quiz.",
  ],
  harrypotter: [
    "Perfect. Hermione would let you copy her notes.",
    "Elite. You'd hold your own in a Pensieve deep-dive.",
    "Strong. Ravenclaw would set a place for you at the table.",
    "Respectable. Solid Gryffindor recall.",
    "Surface level. You've seen the films and skimmed the books.",
    "The Sorting Hat says Muggle.",
  ],
  friends: [
    "Perfect. He's your lobster.",
    "Elite. You'd ace the apartment quiz Ross set up.",
    "Strong. You can recite Joey's catchphrases on demand.",
    "Respectable. You've seen every Thanksgiving episode.",
    "Surface level. You know Central Perk and not much else.",
    "PIVOT! PIVOT! …back to the show, please.",
  ],
  himym: [
    "Perfect. Legen — wait for it — dary.",
    "Elite. You'd run the Bro Code revisions.",
    "Strong. You can name all five doppelgängers.",
    "Respectable. Solid MacLaren's regular.",
    "Surface level. You remember the yellow umbrella. That's it.",
    "Suit up. And try again.",
  ],
  greek: [
    "Perfect. Hesiod takes notes from you.",
    "Elite. You've read Apollodorus in the original.",
    "Strong. Pausanias-level wandering scholar.",
    "Respectable. You've read your Edith Hamilton cover to cover.",
    "Surface level. Percy Jackson is not a primary source.",
    "Olympus has not heard of you.",
  ],
  mtg: [
    "Perfect. Mark Rosewater wants you on the podcast.",
    "Elite. You drafted at the Pro Tour, didn't you.",
    "Strong. You can name the praetors without checking.",
    "Respectable. You've played since Innistrad at least.",
    "Surface level. You opened a starter deck once.",
    "Mulligan. Try again.",
  ],
  arrowverse: [
    "Perfect. The Monitor would draft you to Earth-Prime.",
    "Elite. You watched every annual crossover, live.",
    "Strong. You can name every speedster. In order.",
    "Respectable. Flash-and-Arrow loyalist.",
    "Surface level. You watched the pilots. Maybe a finale.",
    "You missed the Crisis.",
  ],
  supernatural: [
    "Perfect. Saving people, hunting things. The family business.",
    "Elite. You'd ride shotgun in Baby.",
    "Strong. Solid hunter — Bobby would call you.",
    "Respectable. You know your salt-and-burn.",
    "Surface level. You've seen a few cold opens.",
    "Sammy would not be impressed.",
  ],
  dnd: [
    "Perfect. Gygax salutes you from across the Astral.",
    "Elite. You read the Monster Manual for fun.",
    "Strong. You DM'd Curse of Strahd and knew the lore by heart.",
    "Respectable. Solid Forgotten Realms reader.",
    "Surface level. You played one campaign in college.",
    "Roll a 1. Try again next session.",
  ],
  warhammer: [
    "Perfect. The Emperor knows your name.",
    "Elite. You've read the entire Horus Heresy series.",
    "Strong. Devout student of the Codex Astartes.",
    "Respectable. You can field a legal 1000-point list and quote the lore.",
    "Surface level. You saw the trailers.",
    "Heresy. Confess.",
  ],
  disney: [
    "Perfect. Walt himself would tip his hat.",
    "Elite. You know the difference between Renaissance-era and post-Pixar Disney.",
    "Strong. Solid Disney-adult.",
    "Respectable. You grew up on the VHS releases.",
    "Surface level. You've seen the modern remakes.",
    "Bibbidi-Bobbidi… no.",
  ],
  _default: [
    "Perfect score. Unreal.",
    "Elite-tier knowledge.",
    "Strong showing.",
    "Respectable round.",
    "Surface-level scratch.",
    "Did you mean to click Trivia instead?",
  ],
};

function impossibleBlurb(category, correctCount, total) {
  const tier =
    correctCount === total ? 0 :
    correctCount >= 17     ? 1 :
    correctCount >= 13     ? 2 :
    correctCount >= 8      ? 3 :
    correctCount >= 4      ? 4 :
                             5;
  const list = IMPOSSIBLE_BLURBS[category] || IMPOSSIBLE_BLURBS._default;
  const tone = tier <= 2 ? 'ok' : tier === 3 ? 'out' : 'err';
  return { message: list[tier], tone };
}

const IMPOSSIBLE_BANKS = {
  mtg: [
    { q: "Yawgmoth's most common Imperial title is:",
      o: ["Father of Machines", "Lord of the Wastes", "Pope of Phyrexia", "The Cabal Patriarch"], a: 0 },
    { q: "The corrupted artificial plane Yawgmoth ruled:",
      o: ["Mirrodin", "Phyrexia", "Dominaria", "Rath"], a: 1 },
    { q: "The Brothers' War was fought between:",
      o: ["Urza and Mishra", "Urza and Karn", "Mishra and Tawnos", "Gerrard and Karn"], a: 0 },
    { q: "What ancient artifact ended the Brothers' War, devastating western Argoth?",
      o: ["The Golgothian Sylex", "The Mirari", "The Helm of Kaldra", "The Crucible of Worlds"], a: 0 },
    { q: "Who created Karn, the silver golem and first artificial planeswalker?",
      o: ["Mishra", "Urza", "Nicol Bolas", "Teferi"], a: 1 },
    { q: "Name the white Phyrexian Praetor of New Phyrexia:",
      o: ["Sheoldred", "Jin-Gitaxias", "Elesh Norn, Grand Cenobite", "Vorinclex"], a: 2 },
    { q: "Name all three Eldrazi Titans:",
      o: ["Emrakul, Ulamog, Kozilek", "Emrakul, Ulamog, Nicol Bolas", "Ulamog, Kozilek, Ugin", "Emrakul, Kozilek, Marit Lage"], a: 0 },
    { q: "Which Eldrazi Titan is referred to as 'the Promised End'?",
      o: ["Ulamog", "Kozilek", "Emrakul", "Marit Lage"], a: 2 },
    { q: "Which trio of planeswalkers originally sealed the Eldrazi on Zendikar?",
      o: ["Sorin, Ugin, and Nahiri", "Jace, Chandra, and Liliana", "Sorin, Avacyn, and Nahiri", "Ugin, Karn, and Teferi"], a: 0 },
    { q: "Nicol Bolas's elder dragon 'twin,' the Spirit Dragon, is:",
      o: ["Arcades Sabboth", "Ugin", "Palladia-Mors", "Chromium Rhuell"], a: 1 },
    { q: "The captain of the Skyship Weatherlight is:",
      o: ["Sisay", "Gerrard Capashen", "Hanna", "Tahngarth"], a: 1 },
    { q: "The planeswalker who rewrote Tarkir's history, restoring the dragons:",
      o: ["Narset", "Sarkhan Vol", "Sorin Markov", "Teferi"], a: 1 },
    { q: "The Sultai khan on Tarkir:",
      o: ["Anafenza", "Surrak Dragonclaw", "Sidisi", "Zurgo Helmsmasher"], a: 2 },
    { q: "The Mardu khan, 'Helmsmasher':",
      o: ["Zurgo Helmsmasher", "Anafenza, the Foremost", "Surrak Dragonclaw", "Narset"], a: 0 },
    { q: "Which set introduced the planeswalker card type?",
      o: ["Future Sight", "Time Spiral", "Lorwyn", "Shards of Alara"], a: 2 },
    { q: "Which set introduced the Mythic Rare rarity?",
      o: ["Future Sight", "Lorwyn", "Shards of Alara", "Zendikar"], a: 2 },
    { q: "In what year was the Reserved List established?",
      o: ["1994", "1996", "1998", "2000"], a: 1 },
    { q: "Innistrad's vampire planeswalker who created the moon to protect humans:",
      o: ["Sorin Markov", "Olivia Voldaren", "Edgar Markov", "Anowon"], a: 0 },
    { q: "In which set was Yawgmoth finally defeated?",
      o: ["Invasion", "Planeshift", "Apocalypse", "Odyssey"], a: 2 },
    { q: "Foil cards were first introduced in which set?",
      o: ["Urza's Saga", "Urza's Legacy", "Urza's Destiny", "Mercadian Masques"], a: 1 },
  ],

  arrowverse: [
    { q: "What does 'Lian Yu' translate to in English?",
      o: ["Paradise", "Purgatory", "Exile", "Sanctuary"], a: 1 },
    { q: "Eobard Thawne, the original Reverse-Flash, stole the identity of which scientist?",
      o: ["Harrison Wells", "Henry Allen", "Hartley Rathaway", "Martin Stein"], a: 0 },
    { q: "Mon-El's home planet, Krypton's sister world, is:",
      o: ["Krypton", "Daxam", "Argo", "Rann"], a: 1 },
    { q: "Captain Cold's real full name is:",
      o: ["Mick Rory", "Leonard Snart", "Lewis Snart", "Lisa Snart"], a: 1 },
    { q: "Captain Cold's sister, alias Golden Glider:",
      o: ["Glenda Snart", "Lisa Snart", "Mick Snart", "Lara Snart"], a: 1 },
    { q: "Rip Hunter, the original captain of the Waverider, is played by:",
      o: ["Arthur Darvill", "Matt Smith", "David Tennant", "Tom Welling"], a: 0 },
    { q: "Oliver Queen takes on which cosmic persona before dying in Crisis on Infinite Earths?",
      o: ["The Monitor", "The Anti-Monitor", "The Spectre", "Pariah"], a: 2 },
    { q: "Thea Queen's biological father is:",
      o: ["Robert Queen", "Malcolm Merlyn", "Tommy Merlyn", "John Diggle"], a: 1 },
    { q: "Cisco Ramon's hero alias on The Flash is:",
      o: ["Vibe", "Reverb", "Mecha-Vibe", "Echo"], a: 0 },
    { q: "Caitlin Snow's villain alias is:",
      o: ["Killer Frost", "Frostbite", "Black Ice", "Crystal"], a: 0 },
    { q: "Sara Lance's hero alias on Legends of Tomorrow:",
      o: ["Black Canary", "White Canary", "Huntress", "Arsenal"], a: 1 },
    { q: "The Earth-2 doppelgänger of Laurel Lance, who appears as a villain:",
      o: ["Siren-X", "Black Siren", "Tigress", "Black Canary"], a: 1 },
    { q: "The cosmic guardian who oversees the multiverse and falls in Crisis on Infinite Earths:",
      o: ["The Anti-Monitor", "The Monitor (Mar Novu)", "Pariah", "Harbinger"], a: 1 },
    { q: "Across the Arrowverse, Constantine is played by:",
      o: ["Matt Ryan", "Keanu Reeves", "Tom Mison", "David Tennant"], a: 0 },
    { q: "Cisco Ramon's brother, killed by Savitar:",
      o: ["Dante Ramon", "Daniel Ramon", "Diego Ramon", "David Ramon"], a: 0 },
    { q: "Savitar's true identity is revealed to be:",
      o: ["Hunter Zolomon", "A time remnant of Barry Allen from the future", "Eobard Thawne", "Henry Allen"], a: 1 },
    { q: "Mon-El's future wife in the Legion of Super-Heroes:",
      o: ["Princess Diana", "Imra Ardeen (Saturn Girl)", "Querl Dox (Brainiac 5)", "Andromeda"], a: 1 },
    { q: "Nyssa al Ghul's wife via League ritual on Arrow:",
      o: ["Sara Lance", "Laurel Lance", "Felicity Smoak", "Talia al Ghul"], a: 0 },
    { q: "The Earth-X version of Oliver Queen, leader of the New Reich, is called:",
      o: ["Dark Arrow", "Negative Arrow", "Reichsführer Queen", "Mirror Arrow"], a: 0 },
    { q: "The Demon's Head, leader of the League of Assassins, translates to:",
      o: ["Ra's al Ghul", "Talia al Ghul", "Nyssa al Ghul", "Damien Darhk"], a: 0 },
  ],

  supernatural: [
    { q: "The Winchesters' maternal grandparents are:",
      o: ["Samuel and Deanna Campbell", "Henry and Mary Winchester", "Bobby and Karen Singer", "John and Mary Winchester"], a: 0 },
    { q: "The yellow-eyed demon's true name is:",
      o: ["Lilith", "Azazel", "Alastair", "Crowley"], a: 1 },
    { q: "Castiel's human vessel is named:",
      o: ["Jimmy Novak", "Adam Milligan", "Henry Winchester", "Aaron Bass"], a: 0 },
    { q: "Lucifer's 'true vessel' is:",
      o: ["Adam Milligan", "Sam Winchester", "Dean Winchester", "Nick"], a: 1 },
    { q: "Michael's 'true vessel' is:",
      o: ["Dean Winchester", "Sam Winchester", "John Winchester", "Adam Milligan"], a: 0 },
    { q: "Crowley's mortal birth name is:",
      o: ["Fergus Roderick MacLeod", "Crowley MacLeod", "Aleister MacLeod", "Robert MacLeod"], a: 0 },
    { q: "Crowley's witch mother is:",
      o: ["Rowena MacLeod", "Lilith", "Naomi", "Amara"], a: 0 },
    { q: "The Men of Letters bunker is located in:",
      o: ["Lawrence, Kansas", "Lebanon, Kansas", "Wichita, Kansas", "Topeka, Kansas"], a: 1 },
    { q: "The Impala's most famous license plate reads:",
      o: ["KAZ 2Y5", "KAS 2Y5", "BAK 1Y9", "IMP 4N7"], a: 0 },
    { q: "The model year of the Winchesters' Chevy Impala:",
      o: ["1965", "1967", "1969", "1972"], a: 1 },
    { q: "The Colt — capable of killing almost anything — was forged by which historical gunsmith?",
      o: ["Samuel Colt", "John Browning", "Eliphalet Remington", "Daniel Wesson"], a: 0 },
    { q: "The Trickster who tormented Sam and Dean is revealed to actually be:",
      o: ["Lucifer", "Loki the Norse god", "Archangel Gabriel", "Archangel Raphael"], a: 2 },
    { q: "Jack Kline's biological father is:",
      o: ["Lucifer", "Michael", "Castiel", "Dean Winchester"], a: 0 },
    { q: "Jack Kline's mother is:",
      o: ["Mary Winchester", "Kelly Kline", "Rowena", "Naomi"], a: 1 },
    { q: "Sam and Dean's half-brother is:",
      o: ["Adam Milligan", "Henry Winchester", "Jack Kline", "Bobby Singer"], a: 0 },
    { q: "'The Empty' is the void where which beings go after death?",
      o: ["Only angels", "Only demons", "Angels and demons", "All supernatural beings"], a: 2 },
    { q: "The Apocalypse World alternate Earth differed because:",
      o: ["Lucifer had already won", "Sam and Dean were never born", "The Mark of Cain was never created", "God had abandoned creation"], a: 1 },
    { q: "Garth Fitzgerald IV is later revealed to be a:",
      o: ["Werewolf", "Vampire", "Shapeshifter", "Wendigo"], a: 0 },
    { q: "Billie succeeds whom in the role of Death?",
      o: ["The original Death (the Horseman)", "Lucifer", "Chuck/God", "Crowley"], a: 0 },
    { q: "Who originally bore the Mark of Cain in the show's mythology?",
      o: ["Cain", "Abel", "Lucifer", "Lilith"], a: 0 },
  ],

  dnd: [
    { q: "The five-headed mother of chromatic dragons:",
      o: ["Bahamut", "Tiamat", "Io", "Asgorath"], a: 1 },
    { q: "The platinum-scaled father of metallic dragons:",
      o: ["Bahamut", "Io", "Asgorath", "Sardior"], a: 0 },
    { q: "The City of Splendors, jewel of the Sword Coast:",
      o: ["Neverwinter", "Baldur's Gate", "Waterdeep", "Athkatla"], a: 2 },
    { q: "The City of Doors, where all portals across the multiverse lead:",
      o: ["Sigil", "Limbo", "Mechanus", "Union"], a: 0 },
    { q: "The enigmatic ruler of Sigil:",
      o: ["Asmodeus", "The Lady of Pain", "Mordenkainen", "Vecna"], a: 1 },
    { q: "How many heads does Demogorgon, the Prince of Demons, have?",
      o: ["One", "Two", "Three", "Five"], a: 1 },
    { q: "The names of Demogorgon's two heads:",
      o: ["Aameul and Hethradiah", "Orcus and Yeenoghu", "Graz'zt and Fraz-Urb'luu", "Pazuzu and Dagon"], a: 0 },
    { q: "The Count of Strahd's full name:",
      o: ["Strahd von Karelius", "Strahd von Zarovich", "Strahd Krezk", "Strahd Vallakovich"], a: 1 },
    { q: "Strahd rules over which Domain of Dread?",
      o: ["Tepest", "Mordent", "Barovia", "Valachan"], a: 2 },
    { q: "Vecna lost which two body parts that became iconic magic items?",
      o: ["His Eye and his Hand", "His Heart and his Skull", "His Tongue and his Eye", "His Hand and his Foot"], a: 0 },
    { q: "The Lord of the Nine Hells:",
      o: ["Bel", "Asmodeus", "Mephistopheles", "Dispater"], a: 1 },
    { q: "The first layer of the Nine Hells:",
      o: ["Dis", "Avernus", "Phlegethos", "Nessus"], a: 1 },
    { q: "The co-creators of Dungeons & Dragons:",
      o: ["Gary Gygax and Dave Arneson", "Gary Gygax and Frank Mentzer", "Dave Arneson and Don Kaye", "Gary Gygax and Brian Blume"], a: 0 },
    { q: "Year of D&D's first publication:",
      o: ["1971", "1974", "1977", "1980"], a: 1 },
    { q: "The Forgotten Realms goddess of magic, whose death briefly shattered the Weave:",
      o: ["Mystra", "Selûne", "Lathander", "Eilistraee"], a: 0 },
    { q: "During the Time of Troubles, three Forgotten Realms gods were slain. Which trio?",
      o: ["Bhaal, Bane, Myrkul", "Cyric, Kelemvor, Mask", "Bane, Cyric, Helm", "Mystra, Bhaal, Tyr"], a: 0 },
    { q: "The matriarchal Underdark city of the drow, ruled by warring Houses:",
      o: ["Menzoberranzan", "Sshamath", "Ched Nasad", "Erelhei-Cinlu"], a: 0 },
    { q: "The continent of the Forgotten Realms:",
      o: ["Khorvaire", "Oerth", "Faerûn", "Mystara"], a: 2 },
    { q: "The plane of pure law and order in the Great Wheel cosmology:",
      o: ["Mechanus", "Acheron", "Mount Celestia", "Arcadia"], a: 0 },
    { q: "The iconic drow ranger of the Forgotten Realms novels:",
      o: ["Drizzt Do'Urden", "Jarlaxle Baenre", "Zaknafein Do'Urden", "Artemis Entreri"], a: 0 },
  ],

  warhammer: [
    { q: "The Emperor originally created how many Primarchs?",
      o: ["18", "19", "20", "21"], a: 2 },
    { q: "The 'Lost Primarchs,' whose records were expunged, were of which legion numbers?",
      o: ["I and X", "II and XI", "III and XII", "IX and XVII"], a: 1 },
    { q: "The Sons of Horus Legion was previously known as:",
      o: ["The Lightning Bearers", "The Luna Wolves", "The War Hounds", "The Storm Lords"], a: 1 },
    { q: "The first Primarch to fall to Chaos:",
      o: ["Horus Lupercal", "Lorgar", "Angron", "Fulgrim"], a: 1 },
    { q: "The Primarch of the Imperial Fists:",
      o: ["Roboute Guilliman", "Rogal Dorn", "Sanguinius", "Vulkan"], a: 1 },
    { q: "The Primarch of the Iron Warriors:",
      o: ["Ferrus Manus", "Perturabo", "Konrad Curze", "Mortarion"], a: 1 },
    { q: "The Primarch of the Death Guard, later a Daemon Primarch of Nurgle:",
      o: ["Mortarion", "Typhus", "Fulgrim", "Magnus the Red"], a: 0 },
    { q: "The Primarch of the World Eaters, Khorne's favored Legion:",
      o: ["Angron", "Kharn the Betrayer", "Lorgar", "Konrad Curze"], a: 0 },
    { q: "The Astronomican is powered by:",
      o: ["The Adeptus Mechanicus", "The Emperor on the Golden Throne", "The Adeptus Custodes", "The Eldar Avatar"], a: 1 },
    { q: "The Fall of the Eldar Empire gave birth to which Chaos God?",
      o: ["Khorne", "Nurgle", "Tzeentch", "Slaanesh"], a: 3 },
    { q: "The four C'tan star gods, once served and ultimately shattered by the Necrons:",
      o: ["Nightbringer, Deceiver, Void Dragon, Outsider", "Nightbringer, Deceiver, Star Eater, Soul Drinker", "Tzeentch, Nurgle, Khorne, Slaanesh", "The Emperor, Magnus, Ahriman, Mortarion"], a: 0 },
    { q: "The two Orkish gods are:",
      o: ["Mork and Skarbrand", "Gork and Mork", "Gorkamorka and Beasty", "Grimm and Grom"], a: 1 },
    { q: "The four Tau worker castes (excluding Ethereals):",
      o: ["Fire, Earth, Water, Air", "Fire, Stone, Wind, Wave", "Sun, Earth, Moon, Sky", "Blood, Bone, Spirit, Mind"], a: 0 },
    { q: "In Tau society, the concept of 'the Greater Good' is called:",
      o: ["Tau'va", "Vior'la", "Y'eldi", "Sa'cea"], a: 0 },
    { q: "The Emperor's elite golden warriors, His personal bodyguard, are the:",
      o: ["Adeptus Astartes", "Grey Knights", "Adeptus Custodes", "Sisters of Silence"], a: 2 },
    { q: "The formal name of the Sisters of Battle's order:",
      o: ["Adepta Sororitas", "Ordo Hereticus", "Ecclesia Imperialis", "Sororitas Militant"], a: 0 },
    { q: "The Eye of Terror is a permanent rift to:",
      o: ["The Webway", "The Warp / Realm of Chaos", "The Materium beyond", "The Outer Dark"], a: 1 },
    { q: "The Sisters of Battle were officially formed as a consequence of which Imperial crisis (M36)?",
      o: ["The Beast Arises", "The Age of Apostasy", "The Plague of Unbelief", "The Great Crusade"], a: 1 },
    { q: "The Ultima Founding produced which new generation of Space Marines?",
      o: ["Primaris Space Marines", "Grey Knights", "Adeptus Custodes", "Deathwatch"], a: 0 },
    { q: "Roboute Guilliman returns from stasis approximately how many millennia after the Horus Heresy?",
      o: ["1,000 years", "5,000 years", "10,000 years", "15,000 years"], a: 2 },
  ],

  disney: [
    { q: "Mickey Mouse's original proposed name was:",
      o: ["Mortimer Mouse", "Maximilian Mouse", "Marvin Mouse", "Maxwell Mouse"], a: 0 },
    { q: "The Disney animator who actually designed Mickey Mouse:",
      o: ["Don Bluth", "Ub Iwerks", "Walt Disney himself", "Friz Freleng"], a: 1 },
    { q: "Walt Disney's first (bankrupt) animation studio in Kansas City was:",
      o: ["Laugh-O-Gram Studio", "Disney Brothers Cartoons", "Iwerks-Disney", "Hyperion Studio"], a: 0 },
    { q: "The voice actress for Snow White in the 1937 film:",
      o: ["Adriana Caselotti", "Mary Costa", "Ilene Woods", "Jodi Benson"], a: 0 },
    { q: "The whale that swallows Geppetto in Pinocchio is named:",
      o: ["Moby", "Cleo", "Monstro", "Figaro"], a: 2 },
    { q: "Geppetto's pet goldfish in Pinocchio is named:",
      o: ["Cleo", "Figaro", "Mister Bubbles", "Jiminy"], a: 0 },
    { q: "The Beast's name, per Disney supplementary materials:",
      o: ["Prince Adam", "Prince Beauregard", "Prince Lumière", "Prince Andre"], a: 0 },
    { q: "Scar's name before he became 'Scar' (per The Lion King: Six New Adventures):",
      o: ["Taka", "Ahadi", "Mohatu", "Mufasa Jr."], a: 0 },
    { q: "The three hyenas in The Lion King:",
      o: ["Shenzi, Banzai, Ed", "Banzai, Ed, Zira", "Shenzi, Nuka, Vitani", "Pumbaa, Banzai, Ed"], a: 0 },
    { q: "Ursula's two eel henchmen in The Little Mermaid:",
      o: ["Flotsam and Jetsam", "Sebastian and Flounder", "Scuttle and Eric", "Vanessa and Triton"], a: 0 },
    { q: "Ariel is the youngest of how many princess sisters?",
      o: ["Five", "Six", "Seven", "Eight"], a: 2 },
    { q: "The three good fairies in Sleeping Beauty:",
      o: ["Flora, Fauna, Merryweather", "Aurora, Maleficent, Phillip", "Glinda, Rapunzel, Tinker Bell", "Petal, Pixie, Pollen"], a: 0 },
    { q: "The three gargoyle companions in The Hunchback of Notre Dame:",
      o: ["Victor, Hugo, Laverne", "Tantor, Terk, Phoebus", "Victor, Hugo, Phoebus", "Frollo, Esmeralda, Achilles"], a: 0 },
    { q: "Mulan's tiny lucky cricket companion:",
      o: ["Cri-Kee", "Mushu", "Khan", "Little Brother"], a: 0 },
    { q: "The gorilla matriarch who adopts Tarzan as her own:",
      o: ["Terk", "Kala", "Kerchak", "Tantor"], a: 1 },
    { q: "The silverback gorilla who is Tarzan's reluctant adoptive father:",
      o: ["Kerchak", "Tantor", "Sabor", "Clayton"], a: 0 },
    { q: "Pocahontas's tribe, in the Disney film:",
      o: ["Powhatan", "Iroquois", "Algonquin", "Mohawk"], a: 0 },
    { q: "In 101 Dalmatians, Pongo's owner is:",
      o: ["Anita", "Roger Radcliffe", "Cruella de Vil", "Jasper"], a: 1 },
    { q: "Steamboat Willie, Mickey's debut sound cartoon, was released in:",
      o: ["1923", "1928", "1932", "1937"], a: 1 },
    { q: "Snow White and the Seven Dwarfs — Disney's first animated feature — was released in:",
      o: ["1933", "1937", "1940", "1942"], a: 1 },
  ],

  greek: [
    { q: "In Hesiod's Theogony, what was the very first being to come into existence?",
      o: ["Gaia", "Chaos", "Uranus", "Cronus"], a: 1 },
    { q: "Who castrated Uranus, and with what weapon?",
      o: ["Zeus, with a thunderbolt", "Cronus, with an adamantine sickle", "Tartarus, with a flint knife", "The Hekatonkheires, with their hundred hands"], a: 1 },
    { q: "Per Hesiod, what goddess was born from Uranus's severed genitals falling into the sea?",
      o: ["Aphrodite", "Hephaestus", "Athena", "The Erinyes"], a: 0 },
    { q: "Of the three Gorgons, only one was mortal. Which?",
      o: ["Stheno", "Euryale", "Medusa", "Echidna"], a: 2 },
    { q: "When Perseus beheaded Medusa, what two beings sprang from her severed neck?",
      o: ["Pegasus and Chimera", "Pegasus and Chrysaor", "Bellerophon and Pegasus", "Chrysaor and Geryon"], a: 1 },
    { q: "What are the names of the three Hekatonkheires (the hundred-handed ones)?",
      o: ["Brontes, Steropes, Arges", "Hyperion, Iapetus, Crius", "Mimas, Porphyrion, Alcyoneus", "Briareus, Cottus, Gyges"], a: 3 },
    { q: "Per Apollodorus, who tricked Cronus into vomiting back up his swallowed children?",
      o: ["Zeus, by force", "Metis, with an emetic potion", "Rhea, with magic herbs", "Themis, by prophecy"], a: 1 },
    { q: "Why did Zeus swallow the Titaness Metis, leading to Athena's birth from his head?",
      o: ["She tried to overthrow him", "A prophecy that her son would overthrow him", "She insulted his mother Rhea", "She refused to marry him"], a: 1 },
    { q: "Eos asked Zeus to make her mortal lover Tithonus immortal — but forgot to ask for what?",
      o: ["Eternal youth", "Strength", "Memory", "Beauty"], a: 0 },
    { q: "Who gave Deianeira the poisoned blood that ultimately killed Heracles?",
      o: ["Hera, in disguise", "The centaur Nessus", "The goddess Iris", "The priestess of Apollo"], a: 1 },
    { q: "Who tore Orpheus apart after he lost Eurydice?",
      o: ["The Erinyes", "The Maenads", "The Cyclopes", "The Sirens"], a: 1 },
    { q: "In Euripides's Bacchae, King Pentheus of Thebes is torn apart by:",
      o: ["Dionysus directly", "His own mother Agave", "A wild boar sent by Dionysus", "Bacchic women who do not know him"], a: 1 },
    { q: "The Lapiths and Centaurs first came to violence at whose wedding feast?",
      o: ["Pirithous", "Theseus", "Peleus and Thetis", "Cadmus and Harmonia"], a: 0 },
    { q: "Heracles's 11th labor was to retrieve:",
      o: ["The Cattle of Geryon", "The Golden Apples of the Hesperides", "The Girdle of Hippolyta", "Cerberus from the Underworld"], a: 1 },
    { q: "Heracles's 12th and final labor was to:",
      o: ["Bring Cerberus back alive", "Capture the Erymanthian Boar", "Slay the Stymphalian Birds", "Steal the Mares of Diomedes"], a: 0 },
    { q: "How did Heracles clean the Augean stables in a single day?",
      o: ["Burned them with the Hydra's fire", "Diverted two rivers through them", "Made the cattle clean themselves", "Summoned Hephaestus's bellows"], a: 1 },
    { q: "In Homer's Iliad, Aphrodite is the daughter of Zeus and which goddess (a different lineage from Hesiod's foam-birth)?",
      o: ["Dione", "Hera", "Themis", "Leto"], a: 0 },
    { q: "The three Erinyes (Furies) are named:",
      o: ["Clotho, Lachesis, Atropos", "Aglaea, Euphrosyne, Thalia", "Alecto, Megaera, Tisiphone", "Calliope, Clio, Urania"], a: 2 },
    { q: "The Pleiades, pursued by a hunter before being turned into stars, were daughters of which Titan?",
      o: ["Hyperion", "Atlas", "Iapetus", "Oceanus"], a: 1 },
    { q: "In the Homeric Hymn to Demeter, Persephone became bound to the underworld because Hades tricked her into eating:",
      o: ["A figgrant cake", "Pomegranate seeds", "Six grapes from Dionysus's vine", "A draught from the Lethe"], a: 1 },
  ],

  harrypotter: [
    { q: "What is Hermione Granger's middle name?",
      o: ["Jane", "Jean", "Joan", "June"], a: 1 },
    { q: "What is Ron Weasley's middle name?",
      o: ["Bilius", "Arthur", "Fred", "Charles"], a: 0 },
    { q: "In The Crimes of Grindelwald, Credence Barebone is revealed to be:",
      o: ["Aurelius Dumbledore", "Corvus Lestrange", "Modesty Barebone's twin", "A son of Newt Scamander"], a: 0 },
    { q: "What is the name of Voldemort's mother?",
      o: ["Merope Gaunt", "Bellatrix Gaunt", "Morfin Gaunt", "Marvolo Gaunt"], a: 0 },
    { q: "What is the name of Severus Snape's witch mother?",
      o: ["Petunia Prince", "Eileen Prince", "Elizabeth Snape", "Aileen Black"], a: 1 },
    { q: "What is the name of Snape's Muggle father?",
      o: ["Severus Snape Sr.", "Tobias Snape", "Tomas Snape", "Thomas Prince"], a: 1 },
    { q: "What are the names of Albus Dumbledore's younger brother and sister, in order?",
      o: ["Aberforth and Ariana", "Albus and Ariana", "Aberforth and Bathilda", "Alphard and Anya"], a: 0 },
    { q: "What is Grindelwald's first name?",
      o: ["Gerald", "Gellert", "Gustav", "Gregor"], a: 1 },
    { q: "In what year did Dumbledore defeat Grindelwald in their famous duel?",
      o: ["1942", "1945", "1948", "1950"], a: 1 },
    { q: "What is Newt Scamander's full birth name?",
      o: ["Newton Augustus Frederick Scamander", "Newton Artemis Fido Scamander", "Newton Arthur Felix Scamander", "Newton Alfred Frank Scamander"], a: 1 },
    { q: "In Fantastic Beasts, what does the acronym MACUSA stand for?",
      o: ["Magical American Council for Universal Spell-craft and Arcana", "Magical Congress of the United States of America", "Ministry of American Conjurers and United States Aurors", "Magical Association of Continental United States Aurors"], a: 1 },
    { q: "Helena Ravenclaw, Rowena's daughter, is known to Hogwarts students as:",
      o: ["The White Lady", "The Grey Lady", "The Silver Lady", "The Fair Lady"], a: 1 },
    { q: "The Bloody Baron is the ghost of which Hogwarts house?",
      o: ["Gryffindor", "Ravenclaw", "Hufflepuff", "Slytherin"], a: 3 },
    { q: "Rita Skeeter's unregistered Animagus form is:",
      o: ["A bumblebee", "A beetle", "A mosquito", "A spider"], a: 1 },
    { q: "What is Tonks's full first name (which she hates)?",
      o: ["Nymphaea", "Nymphadora", "Andromeda", "Persephone"], a: 1 },
    { q: "Who does Luna Lovegood ultimately marry?",
      o: ["Neville Longbottom", "Dean Thomas", "Rolf Scamander", "Seamus Finnigan"], a: 2 },
    { q: "What is the name of Hagrid's giantess mother?",
      o: ["Olympe", "Fridwulfa", "Bertha", "Maxime"], a: 1 },
    { q: "In The Cursed Child, what is the name of the secret daughter of Bellatrix Lestrange and Voldemort?",
      o: ["Delphini", "Nymphadora", "Andromeda", "Astoria"], a: 0 },
    { q: "What is the wood and core of Harry Potter's wand?",
      o: ["Yew and dragon heartstring", "Holly and phoenix feather", "Willow and unicorn hair", "Vine and phoenix feather"], a: 1 },
    { q: "Harry Potter is a direct descendant of which of the three Peverell brothers?",
      o: ["Antioch, the eldest", "Cadmus, the middle", "Ignotus, the youngest", "Ignotius, the disowned"], a: 2 },
  ],

  friends: [
    { q: "What is Chandler Bing's middle name?",
      o: ["Maurice", "Muriel", "Mortimer", "Matthew"], a: 1 },
    { q: "What is Ross Geller's middle name?",
      o: ["Edward", "Ezekiel", "Eustace", "Ethan"], a: 2 },
    { q: "What is Joey Tribbiani's middle name?",
      o: ["Francis", "Frank", "Anthony", "Vincent"], a: 0 },
    { q: "What is the full name of Phoebe's identical twin sister?",
      o: ["Ursula Buffay", "Frances Buffay", "Lily Buffay", "Phoebe Abbott"], a: 0 },
    { q: "What is the name of Phoebe's biological father?",
      o: ["Frank Buffay Sr.", "Joseph Buffay", "Frankie Buffay", "Lou Buffay"], a: 0 },
    { q: "What are the names of the triplets Phoebe carries as a surrogate for her brother Frank Jr.?",
      o: ["Frankie, Leslie, and Phoebe Jr.", "Frank Jr. Jr., Leslie, and Chandler", "Frank III, Lily, and Ross", "Frank Jr. Jr., Phoebe, and Joey"], a: 1 },
    { q: "What is the full name of Ross's second wife, whom he marries in London?",
      o: ["Emma Waltham", "Emily Waltham", "Elizabeth Waltham", "Eleanor Waltham"], a: 1 },
    { q: "What is the name of Joey's beloved stuffed penguin?",
      o: ["Mr. Snuffles", "Hugsy", "Penguinsy", "Joey Jr."], a: 1 },
    { q: "What is the name of Joey's longtime agent?",
      o: ["Bobbie Wexler", "Lauren Reed", "Estelle Leonard", "Sandra Cohen"], a: 2 },
    { q: "What is Joey's character name on the soap opera Days of Our Lives?",
      o: ["Dr. Drake Ramoray", "Dr. Hans Ramoray", "Dr. Brett Markham", "Dr. Joseph Travers"], a: 0 },
    { q: "What is the name of Chandler's mother, the erotic novelist?",
      o: ["Helen Bing", "Nora Tyler Bing", "Loretta Bing", "Maggie Bing"], a: 1 },
    { q: "Who plays Chandler's father, a Las Vegas drag performer?",
      o: ["Bea Arthur", "Kathleen Turner", "Susan Sarandon", "Cher"], a: 1 },
    { q: "Which Hollywood movie does Ross's monkey Marcel end up starring in?",
      o: ["Congo", "Outbreak", "Twister", "Independence Day"], a: 1 },
    { q: "Who plays Rachel's father, Dr. Leonard Green?",
      o: ["Ron Leibman", "Jeff Goldblum", "Charles Grodin", "Alan Alda"], a: 0 },
    { q: "Reese Witherspoon plays which of Rachel's two sisters?",
      o: ["Amy", "Jill", "Sandra", "Joanna"], a: 1 },
    { q: "How many sisters does Joey Tribbiani have?",
      o: ["Five", "Six", "Seven", "Eight"], a: 2 },
    { q: "What is the name of Brad Pitt's character — Monica's overweight high-school friend, co-founder of the 'I Hate Rachel Green Club'?",
      o: ["Will Colbert", "Pete Becker", "Tag Jones", "Tommy Rollerson"], a: 0 },
    { q: "What are the names of Chandler and Monica's adopted twins?",
      o: ["Ben and Emma", "Erica and Jack", "Frank and Alice", "Lily and Marvin"], a: 1 },
    { q: "What does Phoebe legally change her full name to after marrying Mike Hannigan?",
      o: ["Princess Consuela Banana Hammock", "Regina Phalange", "Phoebe Hannigan Buffay", "Princess Buffay-Hannigan"], a: 0 },
    { q: "What is the apartment number of Monica's apartment in seasons 5 onward (after the show 'corrected' it)?",
      o: ["5", "19", "20", "14"], a: 2 },
  ],

  himym: [
    { q: "What is the Mother's full name, revealed in the series finale?",
      o: ["Tracy McConnell", "Stella Zinman", "Cindy McConnell", "Victoria Anderson"], a: 0 },
    { q: "What is the name of the Mother's college roommate, who briefly dated Ted?",
      o: ["Stella", "Cindy", "Victoria", "Zoey"], a: 1 },
    { q: "What instrument does the Mother play in her band?",
      o: ["Acoustic guitar", "Piano", "Bass guitar", "Violin"], a: 2 },
    { q: "What is the name of the Mother's deceased ex-boyfriend, who died on her 21st birthday?",
      o: ["Mitch", "Max", "Marshall", "Mark"], a: 1 },
    { q: "What is the name of Barney's biological father, played by John Lithgow?",
      o: ["Jerome 'Jerry' Whittaker", "Sam Gibbs", "Marvin Eriksen Sr.", "Bob Barker"], a: 0 },
    { q: "What is the name of Barney's mother?",
      o: ["Patricia Stinson", "Loretta Stinson", "Wendy Stinson", "Judy Stinson"], a: 1 },
    { q: "Who plays Barney's half-brother James Stinson?",
      o: ["Neil Patrick Harris", "Joe Manganiello", "Wayne Brady", "Will Forte"], a: 2 },
    { q: "What is Marshall's father's full name?",
      o: ["Martin Eriksen Sr.", "Marvin Eriksen Sr.", "Marshall Eriksen Sr.", "Marcus Eriksen Sr."], a: 1 },
    { q: "What town in Minnesota is Marshall's hometown?",
      o: ["Duluth", "Minneapolis", "St. Cloud", "St. Paul"], a: 2 },
    { q: "What is the full middle name of Marshall and Lily's first son, Marvin Eriksen?",
      o: ["Junior", "Wait For It", "Big Fudge", "Marshmallow"], a: 1 },
    { q: "What is Ted's architecture firm called, which he founds in season 5?",
      o: ["Mosbius Designs", "Mosby & Associates", "Ted Mosby Architecture", "Mosby Designs Inc."], a: 0 },
    { q: "What is the real first name of 'The Captain' (Zoey's ex-husband, played by Kyle MacLachlan)?",
      o: ["Charles", "George", "Walter", "Frederick"], a: 1 },
    { q: "What is the name of Robin's Canadian teen pop-star alter ego?",
      o: ["Robin Sparkles", "Robin Daggers", "Sparkles Robin", "Princess Robin"], a: 0 },
    { q: "What is the title of Robin Sparkles' second single, set on a beach?",
      o: ["Let's Go to the Mall (Today!)", "Sandcastles in the Sand", "Beaver Song", "Two Beavers Are Better Than One"], a: 1 },
    { q: "What is the name of Robin's darker, grunge-era Canadian alter ego revealed later in the series?",
      o: ["Robin Daggers", "Robin Stinson", "Robin Edge", "Robin Black"], a: 0 },
    { q: "Who plays Jessica Glitter, Robin Sparkles' co-star on the Canadian variety show?",
      o: ["Carly Rae Jepsen", "Avril Lavigne", "Nicole Scherzinger", "Alanis Morissette"], a: 2 },
    { q: "Who holds the title of 'Slap Bet Commissioner'?",
      o: ["Lily", "Marshall", "Ted", "Future Ted"], a: 0 },
    { q: "In Barney's job at GNB, what does the acronym 'PLEASE' stand for?",
      o: ["Provide Legal Exculpation And Sign Everything", "Please Look Elsewhere And Stop Examining", "Profit-Loss Evaluation And Securities Exchange", "Personal Liability Exception And Statute Enforcement"], a: 0 },
    { q: "What are the names of Ted's two future children, who narrate the framing story?",
      o: ["Penny and Luke", "Penny and Max", "Lucy and Max", "Penny and Marvin"], a: 0 },
    { q: "Where does Ted finally meet the Mother in the series?",
      o: ["MacLaren's Pub", "Farhampton train station", "Central Park", "JFK Airport"], a: 1 },
  ],

  lotr: [
    { q: "Who originally forged Narsil, the sword of Elendil, in the First Age?",
      o: ["Celebrimbor", "Eöl the Dark Elf", "Telchar of Nogrod", "Aulë himself"], a: 2 },
    { q: "What is Gandalf's true Maia name, used in Valinor?",
      o: ["Curunír", "Mithrandir", "Olórin", "Tharkûn"], a: 2 },
    { q: "What is Saruman's true Maia name in Quenya?",
      o: ["Aiwendil", "Olórin", "Curumo", "Pallando"], a: 2 },
    { q: "Which Vala did Sauron originally serve, before turning to Melkor?",
      o: ["Manwë", "Aulë", "Mandos", "Oromë"], a: 1 },
    { q: "Under what assumed name did Sauron deceive the Elven-smiths of Eregion into forging the Rings of Power?",
      o: ["Mairon", "Annatar", "Gorthaur", "Tar-Mairon"], a: 1 },
    { q: "Which Elven smith forged the Three Elven Rings independently of Sauron?",
      o: ["Galadriel", "Celebrimbor", "Fëanor", "Gil-galad"], a: 1 },
    { q: "Celebrimbor was the grandson of which legendary First Age elf?",
      o: ["Fingolfin", "Finarfin", "Fëanor", "Finwë"], a: 2 },
    { q: "Who was the last King of Gondor before the Stewardship, lost to the Witch-king in Minas Morgul?",
      o: ["Anárion", "Eldacar", "Eärnil II", "Eärnur"], a: 3 },
    { q: "Who was the first of the Ruling Stewards of Gondor?",
      o: ["Pelendur", "Húrin of Emyn Arnen", "Vorondil the Hunter", "Mardil Voronwë"], a: 3 },
    { q: "What is the name of Aragorn's father?",
      o: ["Arador", "Arathorn II", "Arvedui", "Argonui"], a: 1 },
    { q: "What name was Aragorn given as a child, raised in secret at Rivendell?",
      o: ["Elessar", "Thorongil", "Estel", "Telcontar"], a: 2 },
    { q: "How old is Aragorn during the War of the Ring?",
      o: ["47", "67", "87", "107"], a: 2 },
    { q: "What is the name of Bilbo Baggins's mother?",
      o: ["Mirabella Took", "Belladonna Took", "Primula Brandybuck", "Lobelia Sackville-Baggins"], a: 1 },
    { q: "What is the name of Frodo Baggins's mother, who drowned with his father on the Brandywine?",
      o: ["Belladonna Took", "Esmeralda Took", "Primula Brandybuck", "Eglantine Banks"], a: 2 },
    { q: "Who is Galadriel's mother?",
      o: ["Indis", "Eärwen", "Anairë", "Nerdanel"], a: 1 },
    { q: "What was the name of Treebeard's long-lost beloved Entwife?",
      o: ["Wandlimb", "Fimbrethil", "Beechbone", "Quickbeam"], a: 1 },
    { q: "What was Mirkwood called before it was darkened by the Necromancer?",
      o: ["Eryn Galen", "Greenwood the Great", "Eryn Lasgalen", "Taur-im-Duinath"], a: 1 },
    { q: "What name did Mirkwood take after Sauron's defeat, when Thranduil's realm was cleansed?",
      o: ["Greenwood the Great", "Taur-nu-Fuin", "Doriath", "Eryn Lasgalen"], a: 3 },
    { q: "What was the name of the great White Tree of Númenor, ancestor of Gondor's White Tree?",
      o: ["Galathilion", "Telperion", "Nimloth", "Laurelin"], a: 2 },
    { q: "In which hidden First Age Elven city were Glamdring, Orcrist, and Sting forged?",
      o: ["Nargothrond", "Doriath", "Gondolin", "Menegroth"], a: 2 },
  ],

  onepiece: [
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
  ],
};

function ensureImpossibleUI() {
  if (document.getElementById('impossible')) return document.getElementById('impossible');
  const root = document.createElement('div');
  root.id = 'impossible';
  root.className = 'trivia trivia--impossible';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Impossible trivia game terminal');
  root.innerHTML = `
    <div class="triviaBackdrop" aria-hidden="true"></div>
    <div class="triviaInner">
      <header class="triviaBar">
        <span class="triviaBarDot"></span>
        <span class="triviaBarLabel" id="impossibleBarLabel">Impossible · Deep Cuts</span>
        <button class="triviaClose" id="impossibleClose" aria-label="Close">×</button>
      </header>
      <div class="triviaScreen" id="impossibleScreen"></div>
      <div class="triviaInputRow" id="impossibleInputRow">
        <span class="triviaPrompt">▸</span>
        <input class="triviaInput" id="impossibleInput" type="text" autocomplete="off" spellcheck="false" />
      </div>
    </div>
  `;
  document.body.append(root);
  root.querySelector('#impossibleClose').addEventListener('click', () => Impossible.quit());
  root.querySelector('.triviaBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) Impossible.quit();
  });
  return root;
}

const Impossible = {
  active: false,
  phase: null,
  category: 'onepiece',
  bank: [],
  idx: 0,
  score: 0,
  results: [],
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

  clearScreen() { if (this._screenEl) this._screenEl.innerHTML = ''; },

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

  open(categoryId) {
    this.category = categoryId || 'onepiece';
    this.bank = (IMPOSSIBLE_BANKS[this.category] || []).slice();
    if (!this.bank.length) return;

    this._el = ensureImpossibleUI();
    this._screenEl = document.getElementById('impossibleScreen');
    this._inputEl  = document.getElementById('impossibleInput');

    const catName = impossibleCategoryName(this.category);
    const label = this._el.querySelector('#impossibleBarLabel');
    if (label) label.textContent = `Impossible · ${catName} · Deep Cuts`;

    if (!this._bound) {
      this._bound = true;
      this._inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = this._inputEl.value;
          this._inputEl.value = '';
          if (val.trim()) this.print(`impossible@nikos:~# ${val}`, 'echo');
          this.process(val);
        }
      });
      document.addEventListener('keydown', (e) => {
        if (this.active && e.key === 'Escape') this.quit();
      });
    }

    this._wasHackerActive = !!(window.Hacker?.active && window.Hacker.inputEl);
    if (this._wasHackerActive) window.Hacker.inputEl.disabled = true;

    this._el.hidden = false;
    this.active = true;
    this.idx = 0;
    this.score = 0;
    this.results = [];
    this.clearScreen();

    this._gamertag = this._loadGamertag();
    if (this._gamertag) { this.phase = 'rules'; this.showRules(); }
    else                { this.phase = 'gamertag'; this.promptGamertag(); }
    setTimeout(() => this._inputEl?.focus(), 220);
  },

  process(input) {
    const cmd = (input || '').trim().toLowerCase();
    if (this.phase === 'gamertag') return this.handleGamertagInput(input);
    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') return this.quit();
  },

  showRules() {
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    const catName = impossibleCategoryName(this.category);
    const total = this.bank.length;
    const maxScore = total * 100;
    p(`Impossible — ${catName}, deep cuts`, 'narr');
    p('');
    p(`  ${total} questions. ${catName} only. The obscure stuff.`);
    p('  No category pick. No difficulty curve. Every one of these hurts.');
    p('');
    p('  100 pts per correct. Wrong = 0. No partial credit.', 'ok');
    p(`  Max possible score: ${maxScore.toLocaleString()}.`, 'ok');
    p('');
    p('  Get 15+ correct and you have read the manga. Twice.');
    p('');
    this.printActions([
      { label: 'Begin', variant: 'primary', onClick: () => { this.phase = 'question'; this.clearScreen(); this.showQuestion(); } },
      { label: 'Cancel', onClick: () => this.quit() },
    ]);
  },

  showQuestion() {
    this.setInputVisible(false);
    const p = (t, c = 'out') => this.print(t, c);
    const catName = impossibleCategoryName(this.category);
    const total = this.bank.length;
    const q = this.bank[this.idx];
    p(`${catName}  ·  Q ${this.idx + 1} / ${total}  ·  100 pts`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    this.printOptions(q.o, (i) => this.handleAnswerPick(i));
  },

  handleAnswerPick(idx) {
    const q = this.bank[this.idx];
    const catName = impossibleCategoryName(this.category);
    const correct = idx === q.a;
    const pts = correct ? 100 : 0;
    this.score += pts;
    this.results.push({
      n: this.idx + 1,
      asked: q.q,
      yourAnswer: q.o[idx],
      correctAnswer: q.o[q.a],
      correct,
      pts,
    });
    this.clearScreen();
    const p = (t, c = 'out') => this.print(t, c);
    p(`${catName}  ·  Q ${this.idx + 1} / ${this.bank.length}`, 'narr');
    p('');
    p('  ' + q.q);
    p('');
    if (correct) p(`  ✓ Correct.  +${pts} pts.`, 'ok');
    else         p(`  ✗ Wrong.  The answer was: ${q.o[q.a]}`, 'err');
    p('');
    p(`  Score: ${this.score} pts`);
    p('');
    this.idx++;
    if (this.idx >= this.bank.length) {
      setTimeout(() => this.gameOver(), 1200);
    } else {
      this.phase = 'between';
      this.printActions([
        { label: 'Next →', variant: 'primary', onClick: () => { this.phase = 'question'; this.clearScreen(); this.showQuestion(); } },
      ]);
    }
  },

  async gameOver() {
    this.phase = 'gameover';
    this.setInputVisible(false);
    const gamertag = this._gamertag || 'Anon';
    const total = this.bank.length;
    const maxScore = total * 100;
    const correctCount = this.results.filter(r => r.correct).length;
    const entry = {
      gamertag,
      uuid: getUuid(),
      score: this.score,
      date: new Date().toISOString(),
    };
    const lbKey = `${LS_IMPOSSIBLE_LB_PREFIX}.${this.category}`;
    const top = await ImpossibleLeaderboardAdapter.submit(lbKey, entry);
    const placement = placementOf(entry, top);

    this.clearScreen();
    const p = (t, c = 'out') => this.print(t, c);
    const catName = impossibleCategoryName(this.category);
    p(`Impossible — ${catName} — Result`, 'narr');
    p('');
    p(`  ${gamertag}  —  ${this.score} / ${maxScore}   (${correctCount}/${total} correct)`, 'ok');
    p('');
    if (placement === 1)      p('  🥇  NEW #1 — top of the impossible leaderboard.', 'ok');
    else if (placement === 2) p('  🥈  #2 on the impossible leaderboard.', 'ok');
    else if (placement === 3) p('  🥉  #3 on the impossible leaderboard.', 'ok');
    else if (placement > 0)   p(`  ▸  Made the impossible leaderboard at #${placement}.`, 'ok');
    else                      p('  Not in the top 10 this time.', 'out');
    p('');
    const blurb = impossibleBlurb(this.category, correctCount, total);
    p('  ' + blurb.message, blurb.tone);
    p('');
    p(`  Impossible Leaderboard — ${catName}`, 'narr');
    p('');
    top.forEach((e, i) => {
      const isYou = e.uuid === entry.uuid && e.score === entry.score && e.date === entry.date;
      const marker = isYou ? '  ←  YOU' : '';
      p(`    ${String(i + 1).padStart(2)}.  ${e.gamertag.padEnd(12)}  ${String(e.score).padStart(5)} pts${marker}`,
        isYou ? 'ok' : 'out');
    });
    p('');
    p('  Answers', 'narr');
    p('');
    this.results.forEach((r) => {
      const icon = r.correct ? '✓' : '✗';
      const cls = r.correct ? 'ok' : 'err';
      p(`    ${icon}  Q${String(r.n).padStart(2)}  ${r.correctAnswer}`, cls);
    });
    p('');
    this.printActions([
      { label: 'Play Again', variant: 'primary', onClick: () => this.open(this.category) },
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

/* Per-category leaderboard storage for Impossible mode. Same entry shape as
   the standard leaderboard so the rendering can be identical. */
const ImpossibleLeaderboardAdapter = {
  async list(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },
  async submit(key, entry) {
    const list = await this.list(key);
    const idx = list.findIndex(e => e.uuid === entry.uuid);
    if (idx >= 0) { if (entry.score > list[idx].score) list[idx] = entry; }
    else { list.push(entry); }
    list.sort((a, b) => b.score - a.score || (a.date || '').localeCompare(b.date || ''));
    const top = list.slice(0, 10);
    try { localStorage.setItem(key, JSON.stringify(top)); } catch {}
    return top;
  },
};

window.Trivia = Trivia;
window.Impossible = Impossible;
window.TriviaAdapter = LeaderboardAdapter;  // for swapping backend
window.ImpossibleAdapter = ImpossibleLeaderboardAdapter;
window.getUuid = getUuid;

})();
