/* ════════════════════════════════════════════════════════════════════════
   game-rpg.js — Text dungeon for the in-page terminal.
   Triggered by `play` from Console (see app.js Console.commands.play).

   Design rules:
   - Deterministic. Same action, same result. No RNG anywhere.
   - HP 0 doesn't game-over — narrator interjects, you respawn at room 0.
   - 5 dungeons, 5 rooms each. Random by default. Hacker-game codes unlock direct picks.
   - State persists in localStorage. Refresh-safe.
   - Free-form input — each room has a list of recognized phrases.
     Unrecognized input prints a gentle nudge with discoverable hints.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

const LS_KEY = 'nikos.rpg.state';

const STARTING_KIT = {
  hp: 30, maxHp: 30,
  mp: 15, maxMp: 15,
  inventory: [
    { id: 'staff', count: 1 },
    { id: 'eldritch_potion', count: 3 },
  ],
  spells: ['eldritch_blast'],
  codes: [],          // codes from the hacker game
  flags: {},
};

/* ─── Items ─── */
const ITEMS = {
  staff: {
    name: 'Staff',
    desc: 'A worn oak staff. Reliable. Deals 4 damage in melee, no mana cost.',
    weapon: true, dmg: 4, mp: 0,
  },
  eldritch_potion: {
    name: 'Eldritch Blast potion',
    desc: 'Bitter violet liquid. Drinking restores 5 mana.',
    consume: { mp: 5 },
  },
  herb: {
    name: 'Healing herb',
    desc: 'A bitter root. Restores 8 HP.',
    consume: { hp: 8 },
  },
  rune_key: {
    name: 'Rune Key',
    desc: 'A bone key inscribed with cold-burning runes. Opens warded doors.',
  },
  cursed_coin: {
    name: 'Cursed coin',
    desc: 'A coin that whispers. Disadvantage on speech, advantage on bargains.',
  },
  scale_shard: {
    name: 'Dragon-scale shard',
    desc: 'A black flake of scale. Burns with cold fire.',
  },
  drowned_codex: {
    name: 'Drowned Codex',
    desc: 'Pages still wet, words still readable. One spell sleeps in its margins.',
  },
  pharaoh_amulet: {
    name: 'Pharaoh\'s Amulet',
    desc: 'Heavy gold. Hums faintly. Resists death once.',
  },
  star_fragment: {
    name: 'Fragment of Star',
    desc: 'It is heavier than it looks. It does not want to be held.',
  },
};

/* ─── Spells ─── */
const SPELLS = {
  eldritch_blast: {
    name: 'Eldritch Blast', mp: 3, dmg: 7,
    cast: () => 'Violet light crashes from your hand. The target staggers.',
  },
  // Below are unlockable via hacker codes.
  bloom: {
    name: 'Bloom (heal)', mp: 4, heal: 12, code: 'BLOOM',
    cast: () => 'Warm light blooms across you. Wounds close.',
  },
  freeze: {
    name: 'Freeze', mp: 5, dmg: 9, status: 'frozen',
    cast: () => 'Frost-bolt. The target seizes mid-motion.',
    code: 'FREEZE',
  },
  ward: {
    name: 'Ward (shield)', mp: 4, shield: 10, code: 'WARD',
    cast: () => 'A pale shell forms around you. Next blow is softened.',
  },
  sunder: {
    name: 'Sunder', mp: 7, dmg: 14, code: 'SUNDER',
    cast: () => 'Force splits the air. Bone, stone, and pride all bend.',
  },
  jolt: {
    name: 'Jolt', mp: 2, dmg: 5, code: 'JOLT',
    cast: () => 'A quick spark cracks across the gap. Cheap. Rude. Effective.',
  },
};

/* ─── ASCII bits ─── */
const ART = {
  title: `
  ╔══════════════════════════════════════════════╗
  ║   ░▒▓█  THE DUNGEON BENEATH THE SHEET  █▓▒░  ║
  ╚══════════════════════════════════════════════╝`,

  lich: `
        .-""""""-.
       /          \\
      |  o      o  |
      |     /\\     |
       \\   '--'   /
        \`.______.'
        /        \\
       (  L I C H  )`,

  dragon: `
            ___====-_  _-====___
      _--^^^#####//      \\\\#####^^^--_
   _-^##########// (    ) \\\\##########^-_
  -############//  |\\^^/|  \\\\############-
 _/############//   (@::@)   \\\\############\\_
/#############((     \\\\//     ))#############\\
  D R A G O N   o f   T H E   D E E P   C A V E`,

  archivist: `
       ~~~ ~~~ ~~~ ~~~ ~~~
         _________
        /  ___    \\
       | |  ___ |  |
        \\____|___/
       ~~~ ~ ~ ~ ~~~~
   THE DROWNED ARCHIVIST`,

  mummy: `
         /-----\\
        | M M M |
        | _   _ |
        |( ) ( )|
        |   .   |
         \\_____/
    PHARAOH RA-NEKHET`,

  star: `
           *   .   *
        .       \\|/
           ~ -- ☼ -- ~
              /|\\
        *   .   *
   PRIEST OF THE STAR-EATEN`,
};

/* ─── Room helpers (small DSL) ─── */
function fight(opts) { return { fight: true, ...opts }; }

/* ─── Dungeons ─── */
/* Each dungeon: { id, name, theme, rooms: [room0..room4], boss: room4 } */

const DUNGEONS = {

  /* ════════════════════════════════════════════════ */
  crypt: {
    id: 'crypt',
    name: "The Lich's Crypt",
    theme: 'manuscript',
    blurb: 'Stone, cold, dust. The dead do not always stay quiet here.',
    rooms: [
      // Room 0 — entrance
      {
        banner: 'CRYPT — THE ENTRY',
        description:
          'Iron-bound doors yawn shut behind you. A single torch flickers in a sconce. ' +
          'Steps descend into darkness ahead. Carved into the wall: a warning in a dead language.',
        hints: 'Try: read warning · take torch · go down · examine sconce',
        actions: {
          'read warning': { text: 'Letters writhe — slowly — into meaning: "The first to enter is the first to lie." You shiver and decide to lie about something, just in case.', flag: 'crypt_lied' },
          'take torch': { text: 'You lift the torch. The flame leans away from you, as if reading your intentions.', give: 'torch_crypt', once: true },
          'examine sconce': { text: 'Wax, soot, fingerprints. Someone was here recently. Or always. Hard to tell with this lighting.' },
          'go down': { goto: 1 },
        },
      },
      // Room 1 — ossuary
      {
        banner: 'CRYPT — OSSUARY',
        description:
          'Bones in patterns: ribs as fans, skulls as tiles. A bone choir hums on a wavelength your teeth can feel. ' +
          'Three openings — a low arch (north), a stairwell (down), a cracked door (east).',
        hints: 'Try: listen · examine bones · disturb bones · sing along · go north / down / east',
        actions: {
          'listen': { text: 'A funeral hymn in a key that does not exist. You recognize three words. None of them are nice.', flag: 'crypt_listened' },
          'examine bones': { text: 'Arranged by someone who cared about composition. Not someone alive.' },
          'disturb bones': { text: 'You kick a rib. The choir falters, then resumes louder. A femur cracks toward you — you take 3 damage.', dmg: 3 },
          'sing along': {
            ifFlag: 'crypt_listened',
            text: 'You hum the three words you caught. The choir warms. A panel of bone slides aside, revealing a bone key.',
            elseText: 'You hum a guess. The choir falls silent in a way that feels judgmental.',
            giveIfFlag: 'rune_key', giveFlag: 'crypt_listened',
          },
          'go north': { goto: 2 },
          'go down':  { needFlag: 'crypt_descended', text: 'The stairs only lead down when something has gone down them first. (Try the north door for now.)' },
          'go east':  { goto: 3 },
        },
      },
      // Room 2 — pool
      {
        banner: 'CRYPT — THE REFLECTION POOL',
        description:
          'A still pool of black water. Your reflection moves slightly behind you, not with you. ' +
          'On the far wall: a niche with a herb growing where no herb should grow.',
        hints: 'Try: examine pool · drink from pool · touch reflection · take herb · go back',
        actions: {
          'examine pool': { text: 'It is a mirror that has stopped pretending. Your reflection nods politely.' },
          'drink from pool': { text: 'You take a mouthful. It tastes like a year you would rather forget. You take 4 damage and forget what you ate for breakfast.', dmg: 4, flag: 'crypt_drank' },
          'touch reflection': {
            text: 'Your reflection takes your hand. For a heartbeat you are two. It releases you and presses a small key into your palm before slipping back into the pool.',
            give: 'rune_key', once: true,
          },
          'take herb': { text: 'Pluck. The herb shivers and goes still in your hand.', give: 'herb', once: true },
          'go back':  { goto: 1 },
          'go south': { goto: 1 },
        },
      },
      // Room 3 — sealed door
      {
        banner: 'CRYPT — THE WARDED DOOR',
        description:
          'A door inlaid with iron runes. It looks expensive in a way that suggests it is also smug. ' +
          'A bowl beside it: empty. A plinth beside the bowl: empty. The air says: bring something.',
        hints: 'Try: examine door · use rune key · cast freeze on door · go back',
        actions: {
          'examine door': { text: 'The runes spell the same word in seven languages. The word is NO.' },
          'use rune key': {
            needItem: 'rune_key',
            text: 'The key fits. The door is briefly polite. It opens with the dignity of a defeated bureaucrat.',
            goto: 4, consume: 'rune_key',
          },
          'cast freeze on door': {
            needSpell: 'freeze',
            text: 'The ice splits the runes mid-syllable. The door, mid-NO, becomes mid-OPEN.',
            goto: 4,
          },
          'go back': { goto: 1 }, 'go west': { goto: 1 },
        },
      },
      // Room 4 — boss
      fight({
        banner: 'CRYPT — THE LICH\'S CHAMBER',
        art: ART.lich,
        description:
          'The Lich sits on a throne of shelved manuscripts. He looks up like you have interrupted his reading. ' +
          'He has. He returns to it. Behind him: a chest.',
        enemy: { name: 'The Lich', hp: 30, dmg: 6 },
        winText: 'The Lich crumbles, then the throne, then the manuscripts. Centuries of footnotes redact themselves. The chest opens. Inside: a Drowned Codex (one new spell sleeps in its margins) and a Pharaoh\'s Amulet — though that one feels misfiled.',
        rewards: ['drowned_codex', 'pharaoh_amulet'],
        loseText: 'A bone-cold hand passes through your chest. You blink and you are at the crypt door again. The Lich is still reading.',
      }),
    ],
  },

  /* ════════════════════════════════════════════════ */
  cavern: {
    id: 'cavern',
    name: 'The Deep-Cave of Wyrms',
    theme: 'workshop',
    blurb: 'Heat from below. Old wings folded somewhere ahead.',
    rooms: [
      {
        banner: 'CAVERN — THE GAPING MOUTH',
        description:
          'The cave breathes. Inhale: cold. Exhale: hot. Each breath shifts the floor by an inch. ' +
          'A narrow ledge leads down. A scorched skeleton sits cross-legged, waiting politely.',
        hints: 'Try: examine skeleton · talk to skeleton · search skeleton · descend',
        actions: {
          'examine skeleton': { text: 'It died holding a pose. Knee on knee, palms up, like a yoga teacher who got committed.' },
          'talk to skeleton': { text: 'You greet it. It does not respond. You feel rude. You feel less rude when you realize it had this coming.', flag: 'cavern_talked' },
          'search skeleton': {
            ifFlag: 'cavern_talked',
            text: 'Polite first. You search. In its hand: a folded note. It says "do not go down." You will.',
            elseText: 'You rifle through bones. They clatter accusingly. You take 2 damage from a sharp femur of judgment.', dmg: 2,
          },
          'descend': { goto: 1 }, 'go down': { goto: 1 },
        },
      },
      {
        banner: 'CAVERN — RIVER OF GLASS',
        description:
          'A river of obsidian flows slowly. Cold. Sharp. On the far bank: a sleeping bat the size of a dog. ' +
          'A boulder rocks gently. Probably alive. Probably.',
        hints: 'Try: cross river · throw stone at bat · examine boulder · go back',
        actions: {
          'cross river': { text: 'You step. Glass cuts. You bleed obsidian-black for a second before it turns red. 5 damage.', dmg: 5, goto: 2 },
          'throw stone at bat': { text: 'You miss on purpose. The bat opens one eye, decides you do not matter, and closes it. You feel insulted but unscathed.' },
          'examine boulder': { text: 'It snores. You walk past quietly.' },
          'go back': { goto: 0 },
        },
      },
      {
        banner: 'CAVERN — THE HOARD',
        description:
          'Coins. Crowns. A signed first-edition of a fantasy novel. Two of every minor magical thing. ' +
          'And, leaning against a pillar, a herb growing somehow in this heat.',
        hints: 'Try: take coins · take herb · examine novel · go back · go forward',
        actions: {
          'take coins': { text: 'You scoop a handful. They are warm. They begin to whisper compliments. You drop them. Mostly.', give: 'cursed_coin', once: true },
          'take herb': { text: 'Plucked. Cooler in your hand than it had any business being.', give: 'herb', once: true },
          'examine novel': { text: 'Signed: "To Daragon, my muse. Sorry about the third act. — N." You are momentarily certain the author is here somewhere.' },
          'go forward': { goto: 3 }, 'go back': { goto: 1 },
        },
      },
      {
        banner: 'CAVERN — THE SCALE PASSAGE',
        description:
          'The walls are warm and shed scales the size of plates. A single fresh one rests at your feet. ' +
          'Ahead: a vast opening. A snore so loud you feel it in your sternum.',
        hints: 'Try: take scale · listen · approach quietly · sing',
        actions: {
          'take scale': { text: 'A black scale. It is cold despite the heat. You feel ready and unprepared, simultaneously.', give: 'scale_shard', once: true, flag: 'cavern_has_scale' },
          'listen': { text: 'A heartbeat older than your country, slower than your patience.' },
          'sing': { text: 'You hum a lullaby. Somewhere ahead the snoring deepens. You buy yourself time you will not need.', flag: 'cavern_lullaby' },
          'approach quietly': { goto: 4 }, 'go forward': { goto: 4 },
        },
      },
      fight({
        banner: 'CAVERN — THE WYRM',
        art: ART.dragon,
        description:
          'A dragon coiled around a mountain of small bright things. It opens one eye. Then both. ' +
          'It is not large, exactly. The cave is small. The dragon is the cave.',
        enemy: { name: 'Vrythelion the Long-Patient', hp: 38, dmg: 7 },
        modifiers: { ifFlag: 'cavern_lullaby', enemyHp: -8, note: 'The lullaby left it slow. Vrythelion starts wounded by sleep.' },
        winText: 'The dragon sighs a long exhale that smells of pepper and apology. Its hoard rearranges itself, sliding a single Rune Key and a Star Fragment toward you. The dragon goes still, and is — somehow — less dead than empty.',
        rewards: ['rune_key', 'star_fragment'],
        loseText: 'A claw lifts you and sets you, gently, at the cave mouth. The dragon goes back to sleep. You are alive but humiliated.',
      }),
    ],
  },

  /* ════════════════════════════════════════════════ */
  library: {
    id: 'library',
    name: 'The Sunken Library',
    theme: 'dm-screen',
    blurb: 'Books that read you back. Water that knows things.',
    rooms: [
      {
        banner: 'LIBRARY — THE VESTIBULE',
        description:
          'Water laps at your ankles. Bookshelves rise out of it like masts. A reading desk floats nearby, ' +
          'still set with an open book and a long-cold cup of tea.',
        hints: 'Try: read book · drink tea · examine shelves · wade north',
        actions: {
          'read book': { text: 'The page describes you, doing exactly what you are doing. You stop reading. The page stops describing.', flag: 'lib_self_read' },
          'drink tea': { text: 'Cold. Steeped too long. Restores 2 HP — the kind of HP only nostalgia can give.', heal: 2 },
          'examine shelves': { text: 'The spines all face inward. Of course they do.' },
          'wade north': { goto: 1 }, 'go north': { goto: 1 },
        },
      },
      {
        banner: 'LIBRARY — THE CATALOG',
        description:
          'Drawers and drawers of index cards. One drawer hangs slightly open. Above it, a card pinned to the wall reads: ' +
          'KEYS ARE FILED UNDER WHAT THEY OPEN.',
        hints: 'Try: read pinned card · examine open drawer · pull drawer DOOR · pull drawer SELF',
        actions: {
          'read pinned card': { text: '"Keys are filed under what they open. Authors are filed under what they cannot say."' },
          'examine open drawer': { text: 'The cards are blank. They have decided they would rather not.' },
          'pull drawer door': { text: 'The drawer labeled DOOR rattles open. Inside: a wet bone key.', give: 'rune_key', once: true },
          'pull drawer self': {
            ifFlag: 'lib_self_read',
            text: 'You pull the SELF drawer. Inside, a single card with your own handwriting on it. You read it. You take 3 damage and gain a small important thing.', dmg: 3, give: 'herb',
            elseText: 'The drawer marked SELF refuses to open until you know something about yourself.',
          },
          'go forward': { goto: 2 }, 'go back': { goto: 0 },
        },
      },
      {
        banner: 'LIBRARY — THE READING ROOM',
        description:
          'Tables flooded to their tops. Pages drift like leaves. In the center: a great mirror that shows the room ' +
          'as it was, dry and warm, with a librarian shelving sound advice.',
        hints: 'Try: examine mirror · step through mirror · catch page · speak to librarian',
        actions: {
          'examine mirror': { text: 'The librarian glances up. She has been waiting for you. The room around her is dry.' },
          'step through mirror': { text: 'You press the glass. It accepts you the way water accepts a stone. You arrive somewhere drier.', flag: 'lib_dry', goto: 3 },
          'catch page': { text: 'A page lands in your palm and dries. It is a recipe for tea, with a note in the margin: "drink cold for grief."' },
          'speak to librarian': { text: 'She mouths a word through the glass. It is the title of a book you have not read. (Of course it is.)' },
          'go forward': { goto: 3 }, 'go back': { goto: 1 },
        },
      },
      {
        banner: 'LIBRARY — THE STACKS',
        description:
          'Endless stacks. The shelves rearrange when you blink. One book glows faintly — a Drowned Codex, page corners ' +
          'still wet despite the air.',
        hints: 'Try: take codex · examine glow · listen · go forward',
        actions: {
          'take codex': { text: 'You take it. The shelves un-rearrange. The whole library exhales.', give: 'drowned_codex', once: true, flag: 'lib_codex' },
          'examine glow': { text: 'The light reads you. Concludes you are mostly carbon. Loses interest.' },
          'listen': { text: 'Someone is reading aloud, several aisles over, in a voice that is mostly bubbles.' },
          'go forward': { goto: 4 }, 'go back': { goto: 2 },
        },
      },
      fight({
        banner: 'LIBRARY — THE ARCHIVIST\'S DESK',
        art: ART.archivist,
        description:
          'A figure stands behind a great desk, head ringed by lazy bubbles. It opens its mouth — a school of letters ' +
          'pours out, then back in. It points at you. Reference check.',
        enemy: { name: 'The Drowned Archivist', hp: 28, dmg: 5 },
        modifiers: { ifFlag: 'lib_codex', enemyHp: -4, note: 'It is missing its codex. It is less itself without it.' },
        winText: 'The Archivist gives a slow, formal bow and dissolves into water. Its desk yields a Star Fragment and a slim Rune Key. You feel quietly thanked.',
        rewards: ['star_fragment', 'rune_key'],
        loseText: 'It hands you a slip of paper that says "see librarian" and pushes you out. You stand in the vestibule, embarrassed but whole.',
      }),
    ],
  },

  /* ════════════════════════════════════════════════ */
  throne: {
    id: 'throne',
    name: 'The Throne of Ra-Nekhet',
    theme: 'xr-lab',
    blurb: 'Gold without warmth. A pharaoh whose patience outlasted his god.',
    rooms: [
      {
        banner: 'THRONE — THE PROCESSIONAL',
        description:
          'A long hall of statues, each holding a different gesture: invitation, refusal, mourning, a thumbs-up. ' +
          'The floor is patterned in tiles that hum when stepped on.',
        hints: 'Try: examine thumbs-up · step on tiles · avoid tiles · go forward',
        actions: {
          'examine thumbs-up': { text: 'The statue holds a thumbs-up. The other hand: a small note. It says: "the way through is approval."', flag: 'throne_approve' },
          'step on tiles': { text: 'The tiles light in your wake. A statue tilts its head. You take 2 damage from the sheer scrutiny.', dmg: 2 },
          'avoid tiles': { ifFlag: 'throne_approve', text: 'You walk only on un-lit tiles, the path of approval. The hall warms to you.', goto: 1, elseText: 'You sidle along the wall. The statues do not approve. The hall remains cold but lets you pass.', goto: 1 },
          'go forward': { goto: 1 },
        },
      },
      {
        banner: 'THRONE — THE SCALES OF NAMING',
        description:
          'A great pair of brass scales. On the left pan: a feather. On the right pan: a card asking your true name. ' +
          'A scribe waits, also waiting to be named.',
        hints: 'Try: write name · write false name · examine feather · talk to scribe',
        actions: {
          'write name': { text: 'You write something true. The feather rises. The scribe nods, oddly proud of you.', flag: 'throne_truth', heal: 4 },
          'write false name': { text: 'You write a lie. The feather sinks. The scribe writes the lie down with great care, as if relieved.', flag: 'throne_lie', give: 'cursed_coin' },
          'examine feather': { text: 'It is heavier than it looks. Maat\'s feathers always are.' },
          'talk to scribe': { text: 'He has no mouth, but he leans toward you in a way that is encouraging.' },
          'go forward': { goto: 2 }, 'go back': { goto: 0 },
        },
      },
      {
        banner: 'THRONE — THE QUIET POOL',
        description:
          'A small reflecting pool. A linen-wrapped figure dips a cup, drinks, and gestures for you to do the same. ' +
          'A herb floats on the water.',
        hints: 'Try: drink · take herb · refuse · examine figure',
        actions: {
          'drink': { text: 'You sip. The water tastes of dates and dry summer. Restores 6 HP.', heal: 6, flag: 'throne_drank' },
          'take herb': { text: 'Plucked from the pool, dripping. It rises to body warmth in your palm.', give: 'herb', once: true },
          'refuse': { text: 'You decline. The figure shrugs. It has all the time in the world. You have less.' },
          'examine figure': { text: 'Beneath the wrappings: smiling. Patient. He is not the boss, but he knows him.' },
          'go forward': { goto: 3 }, 'go back': { goto: 1 },
        },
      },
      {
        banner: 'THRONE — THE GATEWAY',
        description:
          'Two pillars, no door between them. A line painted in gold across the floor. A voice says: "Bring me what is yours alone."',
        hints: 'Try: present name · present amulet · step across · go back',
        actions: {
          'present name': { ifFlag: 'throne_truth', text: 'You speak your true name aloud. The line dims and lets you pass.', goto: 4, elseText: 'You speak a name. The line stays bright. The voice waits.' },
          'present amulet': { needItem: 'pharaoh_amulet', text: 'You hold up the amulet. The voice says, "ah," with great courtesy, and the gold line dims.', goto: 4 },
          'step across': { text: 'You step. The gold line burns. 6 damage. You retreat.', dmg: 6 },
          'go back': { goto: 2 },
        },
      },
      fight({
        banner: 'THRONE — THE PHARAOH',
        art: ART.mummy,
        description:
          'Ra-Nekhet rises from a sarcophagus older than language. His eyes are two coins. The throne room behind him ' +
          'is empty in the way of museums after hours.',
        enemy: { name: 'Pharaoh Ra-Nekhet', hp: 34, dmg: 7 },
        modifiers: { ifFlag: 'throne_lie', enemyHp: 6, note: 'He read your lie at the scales. Ra-Nekhet is offended into greater health.' },
        winText: 'The pharaoh\'s coins fall. He smiles, finally tired, and crumbles into clean dust. The throne yields a Pharaoh\'s Amulet and a Star Fragment.',
        rewards: ['pharaoh_amulet', 'star_fragment'],
        loseText: 'He sets you, very gently, outside the procession. The doors close. He returns to ruling no one.',
      }),
    ],
  },

  /* ════════════════════════════════════════════════ */
  temple: {
    id: 'temple',
    name: 'The Forsaken Temple',
    theme: 'manuscript',
    blurb: 'The god is gone. The priest stayed.',
    rooms: [
      {
        banner: 'TEMPLE — THE EMPTY NAVE',
        description:
          'Pews face an altar that faces a wall. The stained glass shows a constellation with one star missing. ' +
          'A choir of empty robes hangs from the rafters.',
        hints: 'Try: examine glass · examine robes · sit · pray',
        actions: {
          'examine glass': { text: 'The missing star is where you are standing.', flag: 'temple_centered' },
          'examine robes': { text: 'Wool. Moth-eaten. One pocket bulges. You take a herb from it.', give: 'herb', once: true },
          'sit': { text: 'You sit. The bench creaks. Restores 3 HP — the kind only being still gives.', heal: 3 },
          'pray': { text: 'You attempt prayer. A reply comes from much closer than expected.', flag: 'temple_prayed' },
          'go forward': { goto: 1 },
        },
      },
      {
        banner: 'TEMPLE — THE BELL TOWER',
        description:
          'A rope, frayed but functional. A bell whose tongue has been carefully removed and replaced with a wooden one. ' +
          'A ladder up to a small door.',
        hints: 'Try: pull rope · ring bell · climb ladder · examine tongue',
        actions: {
          'pull rope': { text: 'The bell makes a dull wooden knock. It is more pleasing than you expected. Something below shifts.', flag: 'temple_rung' },
          'ring bell': { text: 'See: pull rope.', flag: 'temple_rung' },
          'examine tongue': { text: 'Olive wood. Recently carved. The original bronze tongue lies in a velvet-lined case beside it.' },
          'climb ladder': { goto: 2 }, 'go forward': { goto: 2 },
        },
      },
      {
        banner: 'TEMPLE — THE OBSERVATORY',
        description:
          'A roof opens to a starless sky. A great brass orrery turns, missing one planet. ' +
          'A telescope points at a piece of dark masking-taped to the inside of the dome.',
        hints: 'Try: examine orrery · look through telescope · spin orrery · go back',
        actions: {
          'examine orrery': { text: 'Beautiful. It models a system that is not ours.' },
          'look through telescope': { ifFlag: 'temple_centered', text: 'You look. The masking-tape moves out of the way. You see a star that should not exist. It sees you back.', flag: 'temple_seen', elseText: 'Tape, in the way. You step back.' },
          'spin orrery': { text: 'You spin it. A small black orb falls into your hand.', give: 'star_fragment', once: true },
          'go forward': { goto: 3 }, 'go back': { goto: 1 },
        },
      },
      {
        banner: 'TEMPLE — THE SANCTUM',
        description:
          'Behind the altar, a door. Inside: a priest kneels facing away. His robe is the color of a dry sky. ' +
          'His prayer beads are not made of stone.',
        hints: 'Try: cough · speak · examine beads · attack now',
        actions: {
          'cough': { ifFlag: 'temple_rung', text: 'The priest turns at the courtesy. He bows. "You rang. I came." He stands, ready.', flag: 'temple_announced', goto: 4, elseText: 'He does not turn. He does not turn. He does not turn.' },
          'speak': { text: '"Hello," you say. The priest does not stop praying. The room gets a little cooler.', flag: 'temple_announced' },
          'examine beads': { text: 'Closer: each bead has a small mouth, all closed. You step back politely.' },
          'attack now': { text: 'You strike at him from behind. The robe collapses. He stands behind you. 5 damage.', dmg: 5, goto: 4 },
          'go forward': { goto: 4 }, 'go back': { goto: 2 },
        },
      },
      fight({
        banner: 'TEMPLE — THE STAR-EATEN',
        art: ART.star,
        description:
          'The priest faces you. Where his eyes should be: two empty constellations. The temple loses its echo. ' +
          'You can hear him breathe between worlds.',
        enemy: { name: 'Priest of the Star-Eaten', hp: 36, dmg: 6 },
        modifiers: { ifFlag: 'temple_seen', enemyHp: -6, note: 'He flinches at being known. He starts off-balance.' },
        winText: 'The priest closes his missing eyes. The constellations finish what they started. He says, "thank you," in a voice older than priesthood, and is gone. The altar yields a Star Fragment and a Pharaoh\'s Amulet.',
        rewards: ['star_fragment', 'pharaoh_amulet'],
        loseText: 'He sets a hand on your shoulder. The temple is suddenly behind you. You are outside. You have all your fingers. You count.',
      }),
    ],
  },
};

const DUNGEON_ORDER = ['crypt', 'cavern', 'library', 'throne', 'temple'];


/* ─── Helpers ─── */

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

function clearState() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

function pickDungeonRandom(exclude = []) {
  const pool = DUNGEON_ORDER.filter(d => !exclude.includes(d));
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ─── The Game ─── */

const RPG = {
  state: null,
  active: false,

  init() {
    this.state = loadState();
    // Codes are part of state — make sure starter state still picks them up.
    if (this.state && !this.state.codes) this.state.codes = [];
  },

  /* Codes from hacker game — called externally */
  addCode(code) {
    this.init();
    if (!this.state) {
      this.state = this.freshState();
    }
    code = String(code).toUpperCase();
    if (!this.state.codes.includes(code)) {
      this.state.codes.push(code);
      // Unlock corresponding spell if any
      for (const [id, spell] of Object.entries(SPELLS)) {
        if (spell.code === code && !this.state.spells.includes(id)) {
          this.state.spells.push(id);
        }
      }
      saveState(this.state);
    }
  },

  knowsCode(code) {
    return this.state?.codes?.includes(String(code).toUpperCase());
  },

  freshState() {
    return {
      ...JSON.parse(JSON.stringify(STARTING_KIT)),
      dungeon: null,
      room: 0,
      inCombat: false,
      combat: null,
      // Preserve codes across runs
      codes: this.state?.codes ? [...this.state.codes] : [],
      spells: this.state?.spells ? [...this.state.spells] : [...STARTING_KIT.spells],
    };
  },

  /* Entry from Console */
  start(dungeonArg) {
    this.active = true;
    const firstEver = !this.state || (!this.state.dungeon && !(this.state.flags && this.state.flags.__cleared));
    if (!this.state || !this.state.dungeon) {
      this.state = this.freshState();
      let dungeon;
      if (dungeonArg && DUNGEONS[dungeonArg]) {
        if (this.requiresCode(dungeonArg) && !this.canPick(dungeonArg)) {
          this.out(`Direct entry to "${dungeonArg}" requires a code from the hacker game. Try \`play\` alone for random.`, 'err');
          this.active = false;
          return;
        }
        dungeon = dungeonArg;
      } else if (dungeonArg) {
        const slug = (dungeonArg || '').toLowerCase();
        const code = slug.toUpperCase();
        const map = { TOMB: 'crypt', WYRM: 'cavern', INK: 'library', GOLD: 'throne', STAR: 'temple' };
        if (map[code] && this.knowsCode(code)) {
          dungeon = map[code];
        } else {
          this.out(`Unknown dungeon or missing code: "${dungeonArg}". Try: play, or play <name> with a valid code.`, 'err');
          this.active = false;
          return;
        }
      } else {
        dungeon = pickDungeonRandom();
      }
      this.state.dungeon = dungeon;
      this.state.room = 0;
      saveState(this.state);

      const D = DUNGEONS[dungeon];
      this.out(ART.title, 'narr');
      this.out('', 'out');
      this.out(`▸ ${D.name}`, 'narr');
      this.out(`  ${D.blurb}`, 'out');
      this.out('', 'out');

      // Narrator bubble — the same DM is running this dungeon
      this.narrate(firstEver ? 'rpg_firstPlay' : 'rpg_start');
      this.narrate(`rpg_start_${dungeon}`);
    } else {
      this.out(`Resuming: ${DUNGEONS[this.state.dungeon].name}, room ${this.state.room + 1}/5.`, 'narr');
      this.narrate('rpg_resume');
    }
    this.help(true);
    this.describe();
  },

  /* Bridge to the bubble narrator */
  narrate(triggerId, opts) {
    if (typeof window !== 'undefined' && window.Narrator && window.Narrator.fire) {
      window.Narrator.fire(triggerId, opts || { priority: 'HIGH', cooldown: 0 });
    }
  },

  requiresCode(slug) {
    return DUNGEON_ORDER.includes(slug);
  },
  canPick(slug) {
    const map = { crypt: 'TOMB', cavern: 'WYRM', library: 'INK', throne: 'GOLD', temple: 'STAR' };
    return this.knowsCode(map[slug]);
  },

  /* Console hands input to us when this.active is true */
  process(raw) {
    const cmd = String(raw).trim().toLowerCase();
    if (!cmd) return;
    // After every input, the menu may need to refresh (state changed).
    // We schedule a render *after* the action runs.
    queueMicrotask(() => this.renderMenu());

    // Global commands available always
    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q')        return this.quit();
    if (cmd === 'restart' || cmd === 'reset')                   return this.restart();
    if (cmd === 'help' || cmd === '?')                          return this.help();
    if (cmd === 'look' || cmd === 'l')                          return this.describe();
    if (cmd === 'inventory' || cmd === 'i' || cmd === 'inv')    return this.showInventory();
    if (cmd === 'stats' || cmd === 'status' || cmd === 'sheet') return this.showStats();
    if (cmd === 'spells')                                       return this.showSpells();
    if (cmd === 'codes')                                        return this.showCodes();
    if (cmd === 'save')                                         { saveState(this.state); return this.out('Saved.', 'out'); }
    if (cmd === 'map' || cmd === 'where')                       return this.out(`${DUNGEONS[this.state.dungeon].name} — Room ${this.state.room + 1} of 5`, 'narr');

    // Combat input
    if (this.state.inCombat) return this.combatInput(cmd);

    // Movement shortcuts
    const dirShorts = { n: 'go north', s: 'go south', e: 'go east', w: 'go west', u: 'go up', d: 'go down' };
    const expanded = dirShorts[cmd] || cmd;

    // Room actions
    const room = this.here();
    const actions = room.actions || {};
    // Try exact match
    if (actions[expanded]) return this.doAction(expanded, actions[expanded]);

    // Try synonym normalization (look at → examine, pick up → take, etc.)
    const normalized = this.normalize(expanded);
    if (actions[normalized]) return this.doAction(normalized, actions[normalized]);

    // Try fuzzy: match command words against action keys
    const match = Object.keys(actions).find(k => k.toLowerCase() === normalized);
    if (match) return this.doAction(match, actions[match]);

    // Universal item commands
    if (expanded.startsWith('use ') || expanded.startsWith('drink ') || expanded.startsWith('eat ')) {
      const itemName = expanded.split(/\s+/).slice(1).join(' ');
      return this.useItem(itemName);
    }
    if (expanded.startsWith('cast ')) {
      // cast eldritch blast / cast bloom etc.
      const spellName = expanded.replace(/^cast\s+/, '').replace(/\s+on\s+.*$/, '');
      return this.cast(spellName);
    }
    if (expanded.startsWith('take ') || expanded.startsWith('get ') || expanded.startsWith('grab ')) {
      const target = expanded.split(/\s+/).slice(1).join(' ');
      // No room-specific match — gentle nudge
      return this.out(`There is no "${target}" you can take here right now.`, 'err');
    }
    if (expanded.startsWith('go ')) {
      return this.out(`You cannot go that way from here.`, 'err');
    }

    // Generic miss
    return this.out(`The world does not react to "${cmd}". Try \`look\` for what's here, or \`help\` for commands.`, 'err');
  },

  normalize(cmd) {
    return cmd
      .replace(/^look at /, 'examine ')
      .replace(/^x /, 'examine ')
      .replace(/^pick up /, 'take ')
      .replace(/^grab /, 'take ')
      .replace(/^get /, 'take ')
      .replace(/^fight /, 'attack ')
      .replace(/^hit /, 'attack ')
      .replace(/^strike /, 'attack ');
  },

  here() { return DUNGEONS[this.state.dungeon].rooms[this.state.room]; },

  doAction(key, action) {
    // Conditional gating
    if (action.needItem && !this.hasItem(action.needItem)) {
      return this.out(`You need: ${ITEMS[action.needItem].name}.`, 'err');
    }
    if (action.needSpell && !this.state.spells.includes(action.needSpell)) {
      return this.out(`You don't know that spell yet.`, 'err');
    }
    if (action.needFlag && !this.state.flags[action.needFlag]) {
      return this.out(action.text || 'Something is missing.', 'out');
    }

    // Flag-conditional text
    let text;
    if (action.ifFlag !== undefined) {
      const flagOn = !!this.state.flags[action.ifFlag];
      text = flagOn ? action.text : action.elseText;
      if (flagOn && action.giveIfFlag) this.giveItem(action.giveIfFlag);
      if (flagOn && action.giveFlag) {} // already handled by give
    } else {
      text = action.text;
    }

    // Once-only (don't repeat give)
    let doGive = !!action.give;
    if (action.once && this.state.flags[`__taken_${key}`]) doGive = false;

    if (text) this.out(text, 'narr');

    if (action.flag) this.state.flags[action.flag] = true;
    if (action.dmg) this.damage(action.dmg);
    if (action.heal) this.heal(action.heal);
    if (doGive) {
      this.giveItem(action.give);
      this.state.flags[`__taken_${key}`] = true;
    }
    if (action.consume) this.removeItem(action.consume);

    // Mark action as performed in this dungeon so the menu can hide it next time
    // (unless it's a movement — those always stay).
    if (typeof action.goto !== 'number') {
      const perfKey = `__performed_${this.state.dungeon}_${this.state.room}_${key}`;
      this.state.flags[perfKey] = true;
    }

    if (typeof action.goto === 'number') return this.goto(action.goto);

    saveState(this.state);
  },

  describe() {
    const room = this.here();
    this.out('', 'out');
    if (room.banner) this.out(`── ${room.banner} ──`, 'narr');
    if (room.art) this.out(room.art, 'out');
    this.out(room.description, 'out');
    if (room.fight && !this.state.inCombat) {
      this.startCombat(room);
    } else {
      this.renderMenu();
    }
  },

  /* ─── Arrow-key menu ─── */
  menuOptions: [],
  menuIndex: 0,

  buildMenu() {
    const opts = [];
    if (this.state.inCombat) {
      opts.push({ label: 'Attack with staff', cmd: 'attack' });
      for (const spellId of this.state.spells) {
        const s = SPELLS[spellId]; if (!s) continue;
        const canCast = this.state.mp >= s.mp;
        opts.push({
          label: `Cast ${s.name}  ·  MP ${s.mp}`,
          cmd: `cast ${spellId}`,
          disabled: !canCast,
          meta: s.dmg ? `${s.dmg} dmg` : (s.heal ? `+${s.heal} HP` : (s.shield ? `+${s.shield} shield` : '')),
        });
      }
      for (const slot of this.state.inventory) {
        const it = ITEMS[slot.id];
        if (!it?.consume) continue;
        opts.push({
          label: `Use ${it.name}`,
          cmd: `use ${it.name.toLowerCase()}`,
          meta: `×${slot.count}`,
        });
      }
      opts.push({ label: 'Flee (back to entrance)', cmd: 'flee' });
    } else {
      const room = this.here();
      const actions = room.actions || {};
      const perfPrefix = `__performed_${this.state.dungeon}_${this.state.room}_`;
      for (const key of Object.keys(actions)) {
        const a = actions[key];
        // Hide gated actions whose only effect requires items the player doesn't have
        if (a.needItem && !this.hasItem(a.needItem) && !a.text) continue;
        // Hide items that have been taken (once + give pattern)
        if (a.once && a.give && this.state.flags[`__taken_${key}`]) continue;
        // Hide non-movement actions that have already played — same response would just repeat
        if (typeof a.goto !== 'number' && this.state.flags[perfPrefix + key]) continue;
        opts.push({ label: this.prettyAction(key), cmd: key });
      }
      // Universal exploration actions
      opts.push({ label: 'Look around again', cmd: 'look', meta: 'L' });
      if (this.state.inventory.length) opts.push({ label: 'Open inventory', cmd: 'inventory', meta: 'I' });
      opts.push({ label: 'Show stats', cmd: 'stats' });
    }
    this.menuOptions = opts;
    if (this.menuIndex >= opts.length) this.menuIndex = 0;
  },

  prettyAction(key) {
    return key
      .replace(/^go (\w+)/i, '↑ Go $1')
      .replace(/^examine /, '🔍 Examine ')
      .replace(/^take /, '✦ Take ')
      .replace(/^read /, '📜 Read ')
      .replace(/^use /, '✦ Use ')
      .replace(/^cast /, '✦ Cast ')
      .replace(/^drink /, '✦ Drink ')
      .replace(/^touch /, '✦ Touch ')
      .replace(/^listen/, '👂 Listen')
      .replace(/^talk to /, '💬 Talk to ')
      .replace(/^speak/, '💬 Speak')
      .replace(/^attack /, '⚔ Attack ')
      .replace(/^sing/, '🎵 Sing')
      .replace(/^pray/, '🙏 Pray')
      .replace(/^cough/, '💬 Cough politely');
  },

  renderMenu() {
    if (!this.active) return;
    this.buildMenu();
    const wrap = document.getElementById('consoleMenu');
    if (!wrap) return;
    wrap.hidden = false;
    wrap.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'menuTitle';
    title.textContent = this.state.inCombat ? 'COMBAT — choose your action  (↑↓ Enter, or type)' : 'Actions  (↑↓ Enter · 1–9 · or type freely)';
    wrap.append(title);
    this.menuOptions.forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'consoleMenuItem' + (idx === this.menuIndex ? ' selected' : '') + (opt.disabled ? ' disabled' : '');
      item.innerHTML = `
        <span class="arrow">▸</span>
        <span class="idx">${idx < 9 ? idx + 1 : ' '}</span>
        <span class="label"></span>
        <span class="meta"></span>
      `;
      item.querySelector('.label').textContent = opt.label;
      item.querySelector('.meta').textContent = opt.meta || '';
      item.addEventListener('click', () => {
        this.menuIndex = idx;
        if (!opt.disabled) this.menuRun();
      });
      wrap.append(item);
    });
  },

  hideMenu() {
    const wrap = document.getElementById('consoleMenu');
    if (wrap) { wrap.hidden = true; wrap.innerHTML = ''; }
  },

  menuMove(delta) {
    if (!this.menuOptions.length) return;
    let i = this.menuIndex + delta;
    // Skip disabled entries
    for (let tries = 0; tries < this.menuOptions.length; tries++) {
      if (i < 0) i = this.menuOptions.length - 1;
      if (i >= this.menuOptions.length) i = 0;
      if (!this.menuOptions[i]?.disabled) break;
      i += delta || 1;
    }
    this.menuIndex = i;
    this.renderMenu();
  },

  menuPick(idx) {
    if (idx < 0 || idx >= this.menuOptions.length) return;
    if (this.menuOptions[idx].disabled) return;
    this.menuIndex = idx;
    this.menuRun();
  },

  menuRun() {
    const opt = this.menuOptions[this.menuIndex];
    if (!opt || opt.disabled) return;
    // Clear the console history so each turn renders to a clean page.
    this.clearConsole();
    if (window.Console) window.Console.print(`▸ ${opt.label}`, 'narr');
    this.process(opt.cmd);
  },

  clearConsole() {
    const hist = document.getElementById('consoleHistory');
    if (hist) hist.innerHTML = '';
  },

  goto(roomIdx) {
    this.state.room = roomIdx;
    saveState(this.state);
    this.describe();
  },

  /* ─── Inventory ─── */
  hasItem(id) { return this.state.inventory.some(i => i.id === id && i.count > 0); }
  ,
  giveItem(id) {
    const item = ITEMS[id];
    if (!item) return;
    const slot = this.state.inventory.find(i => i.id === id);
    if (slot) slot.count += 1;
    else this.state.inventory.push({ id, count: 1 });
    this.out(`▸ Picked up: ${item.name}.`, 'narr');
  },
  removeItem(id) {
    const slot = this.state.inventory.find(i => i.id === id);
    if (!slot) return;
    slot.count -= 1;
    if (slot.count <= 0) this.state.inventory = this.state.inventory.filter(i => i.id !== id);
  },
  showInventory() {
    if (!this.state.inventory.length) return this.out('Empty.', 'out');
    this.out('— Inventory —', 'narr');
    for (const slot of this.state.inventory) {
      const it = ITEMS[slot.id];
      this.out(`  ${slot.count}× ${it?.name || slot.id}  · ${it?.desc || ''}`, 'out');
    }
  },
  useItem(name) {
    const slot = this.state.inventory.find(i => {
      const it = ITEMS[i.id];
      return (it?.name || '').toLowerCase() === name || i.id === name.replace(/\s+/g, '_');
    });
    if (!slot) return this.out(`You don't have a "${name}".`, 'err');
    const it = ITEMS[slot.id];
    if (it.consume?.mp) { this.state.mp = Math.min(this.state.maxMp, this.state.mp + it.consume.mp); this.out(`You drink the ${it.name}. +${it.consume.mp} MP.`, 'narr'); }
    if (it.consume?.hp) { this.heal(it.consume.hp); }
    if (it.consume) this.removeItem(slot.id);
    saveState(this.state);
  },

  /* ─── Stats / health / mana ─── */
  damage(n) {
    this.state.hp -= n;
    this.out(`✖ ${n} damage.  (HP ${this.state.hp}/${this.state.maxHp})`, 'err');
    if (this.state.hp <= 0) {
      this.out('You collapse. The narrator clears his throat.', 'narr');
      this.narrate('rpg_death');
      this.state.hp = Math.floor(this.state.maxHp / 2);
      this.state.room = 0;
      this.state.inCombat = false;
      this.state.combat = null;
      saveState(this.state);
      setTimeout(() => this.describe(), 80);
    }
  },
  heal(n) {
    const before = this.state.hp;
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + n);
    const gained = this.state.hp - before;
    if (gained > 0) this.out(`+ ${gained} HP.  (HP ${this.state.hp}/${this.state.maxHp})`, 'out');
  },
  showStats() {
    this.out(`HP ${this.state.hp}/${this.state.maxHp}   MP ${this.state.mp}/${this.state.maxMp}`, 'narr');
    this.out(`Dungeon: ${DUNGEONS[this.state.dungeon].name}   Room: ${this.state.room + 1}/5`, 'out');
  },
  showSpells() {
    this.out('— Spells —', 'narr');
    for (const id of this.state.spells) {
      const s = SPELLS[id]; if (!s) continue;
      const parts = [`MP ${s.mp}`];
      if (s.dmg) parts.push(`Damage ${s.dmg}`);
      if (s.heal) parts.push(`Heal ${s.heal}`);
      if (s.shield) parts.push(`Shield ${s.shield}`);
      this.out(`  ${s.name}  · ${parts.join(' · ')}`, 'out');
    }
  },
  showCodes() {
    if (!this.state.codes.length) return this.out('No codes yet. Solve the hacker game (DO NOT CLICK button) to earn them.', 'out');
    this.out('— Codes —', 'narr');
    for (const c of this.state.codes) this.out(`  ${c}`, 'out');
  },

  /* ─── Spells ─── */
  cast(rawName) {
    const name = rawName.replace(/\s+/g, '_');
    let spellId = this.state.spells.find(id => id === name || (SPELLS[id]?.name || '').toLowerCase() === rawName.toLowerCase());
    if (!spellId) return this.out(`You don't know "${rawName}".`, 'err');
    const s = SPELLS[spellId];
    if (this.state.mp < s.mp) return this.out(`Not enough mana. (Have ${this.state.mp}, need ${s.mp}.)`, 'err');
    this.state.mp -= s.mp;
    this.out(s.cast(), 'narr');
    if (this.state.inCombat && s.dmg) {
      this.state.combat.enemyHp -= s.dmg;
      this.out(`▸ ${s.dmg} damage. Enemy HP ${this.state.combat.enemyHp}.`, 'narr');
      this.afterPlayerAction();
    } else if (s.heal) {
      this.heal(s.heal);
    } else if (s.shield) {
      this.state.flags.__shield = (this.state.flags.__shield || 0) + s.shield;
      this.out(`Shield: ${this.state.flags.__shield} HP next hit.`, 'out');
    }
    saveState(this.state);
  },

  /* ─── Combat ─── */
  startCombat(room) {
    const e = { ...room.enemy };
    if (room.modifiers && room.modifiers.ifFlag && this.state.flags[room.modifiers.ifFlag]) {
      e.hp += room.modifiers.enemyHp || 0;
      if (room.modifiers.note) this.out(`  · ${room.modifiers.note}`, 'out');
    }
    this.state.combat = { enemyName: e.name, enemyHp: e.hp, enemyMaxHp: e.hp, enemyDmg: e.dmg, room };
    this.state.inCombat = true;
    saveState(this.state);
    this.out('', 'out');
    this.out(`⚔  ${e.name}  — HP ${e.hp}`, 'narr');
    this.renderMenu();
  },

  combatInput(cmd) {
    if (cmd === 'attack' || cmd === 'attack enemy' || cmd === 'hit' || cmd === 'strike') {
      const dmg = 4; // staff base
      this.state.combat.enemyHp -= dmg;
      this.out(`You strike with your staff. ${dmg} damage. ${this.state.combat.enemyName} HP ${this.state.combat.enemyHp}.`, 'out');
      return this.afterPlayerAction();
    }
    if (cmd === 'flee' || cmd === 'run' || cmd === 'retreat') {
      this.out('You step back. The enemy lets you go, because it has nowhere to be. You arrive at room 1.', 'narr');
      this.state.inCombat = false; this.state.combat = null; this.state.room = 0; saveState(this.state);
      return setTimeout(() => this.describe(), 80);
    }
    if (cmd.startsWith('cast ')) {
      const name = cmd.replace(/^cast\s+/, '').replace(/\s+on\s+.*$/, '');
      return this.cast(name);
    }
    if (cmd.startsWith('use ') || cmd.startsWith('drink ') || cmd.startsWith('eat ')) {
      const itemName = cmd.split(/\s+/).slice(1).join(' ');
      return this.useItem(itemName);
    }
    if (cmd === 'i' || cmd === 'inventory') return this.showInventory();
    if (cmd === 'stats') return this.showStats();
    if (cmd === 'spells') return this.showSpells();
    if (cmd === 'look' || cmd === 'l') return this.describe();
    this.out(`In combat. Try: attack · cast <spell> · use <item> · flee · stats · inventory`, 'err');
  },

  afterPlayerAction() {
    if (this.state.combat.enemyHp <= 0) {
      const room = this.state.combat.room;
      this.out(`▼ ${this.state.combat.enemyName} falls.`, 'narr');
      this.out(room.winText, 'out');
      for (const r of (room.rewards || [])) this.giveItem(r);
      this.narrate(`rpg_boss_${this.state.dungeon}`);
      this.state.inCombat = false;
      this.state.combat = null;
      this.state.flags.__cleared = (this.state.flags.__cleared || []);
      this.state.flags.__cleared.push(this.state.dungeon);
      saveState(this.state);
      this.out('', 'out');
      this.out('▸ DUNGEON COMPLETE. Type `play` to start a new dungeon, or `quit` to exit.', 'narr');

      // First-ever clear → reveal the konami code as a clickable prompt in the console.
      // No explanation. Player figures out what to do with it.
      try {
        const revealed = localStorage.getItem('nikos.konamiRevealed') === '1';
        if (!revealed && window.Console?.printButton) {
          this.out('', 'out');
          window.Console.printButton('[ Hack Terminal? ]', () => {
            try { localStorage.setItem('nikos.konamiRevealed', '1'); } catch {}
            window.Console.print('', 'out');
            window.Console.print('  ↑ ↑ ↓ ↓ ← → ← → B A', 'narr');
            window.Console.print('', 'out');
          });
        }
      } catch {}

      // Clear dungeon so a new `play` starts fresh
      this.state.dungeon = null;
      this.state.room = 0;
      saveState(this.state);
      this.active = false;
      return;
    }
    // Enemy turn
    let dmg = this.state.combat.enemyDmg;
    if (this.state.flags.__shield) {
      const absorbed = Math.min(this.state.flags.__shield, dmg);
      dmg -= absorbed;
      this.state.flags.__shield -= absorbed;
      this.out(`Shield absorbs ${absorbed}.`, 'out');
      if (this.state.flags.__shield <= 0) delete this.state.flags.__shield;
    }
    if (dmg > 0) {
      this.out(`${this.state.combat.enemyName} strikes back for ${dmg}.`, 'err');
      this.damage(dmg);
    }
    saveState(this.state);
  },

  /* ─── Quit / Restart / Help ─── */
  quit() {
    this.active = false;
    this.hideMenu();
    this.out('You step out of the dungeon. The console returns to normal. (Progress saved — `play` to continue.)', 'narr');
    this.narrate('rpg_quit');
  },
  restart() {
    clearState();
    this.state = this.freshState();
    this.out('Game reset. Codes and unlocked spells preserved.', 'narr');
    this.active = false;
    this.narrate('rpg_restart');
  },
  help(short = false) {
    if (short) {
      this.out('Commands: look · go <dir> · examine <x> · take <x> · use <item> · cast <spell> · attack · flee · inventory · stats · spells · codes · map · save · restart · quit', 'out');
      return;
    }
    this.out('— Commands —', 'narr');
    this.out('  look            describe the room', 'out');
    this.out('  go <dir>        move (n/s/e/w/u/d also work)', 'out');
    this.out('  examine <x>     closer look (also: look at, x)', 'out');
    this.out('  take <x>        pick up (also: get, grab)', 'out');
    this.out('  use <item>      use/drink/eat (drink, eat work too)', 'out');
    this.out('  cast <spell>    spend mana, expend a spell', 'out');
    this.out('  attack / flee   in combat only', 'out');
    this.out('  inventory       what you carry  (i)', 'out');
    this.out('  stats           HP / MP', 'out');
    this.out('  spells          known spells', 'out');
    this.out('  codes           unlocked codes from the hacker game', 'out');
    this.out('  map             where you are', 'out');
    this.out('  save / restart  manage save (auto-saves)', 'out');
    this.out('  quit            return to normal console', 'out');
  },

  out(text, cls = 'out') {
    if (typeof window !== 'undefined' && window.Console && window.Console.print) {
      window.Console.print(text, cls);
    } else {
      console.log(text);
    }
  },
};

window.RPG = RPG;
RPG.init();

})();
