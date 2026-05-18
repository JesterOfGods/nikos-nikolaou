# Personal Website — Nikos Nikolaou

## What this is

A personal site / portfolio with a game-experience overlay. Visitor enters, the **Narrator** (DM + Stanley Parable + clean Deadpool meta) introduces two doors:

- **Adventurer** — full character-screen layout, lore, easter eggs, narrator active.
- **Patron** — clean modern portfolio, narrator quiet, scannable in 20 seconds.

Same content, two skins. Visitor can swap any time. Narrator notices.

## Design locks (don't second-guess)

- **Stack:** vanilla HTML/CSS/JS. No framework, no build step, no dependencies for the site itself (Node only for the optional `synth.mjs` script).
- **Performance budget:** <100KB initial payload, <1s LCP. No Google Fonts, no analytics, no third-party scripts. One CSS, one JS.
- **Narrator voice:** DM frame + Stanley/Beginner's Guide observation + Deadpool meta (clean, no edge). Dry, observational, fourth-wall-breaking, affectionately teasing. Knows the visitor is on a website AND knows Nikos personally.
- **Audio:** opt-in. Text bubble always shows the line. Audio is a bonus layer. ElevenLabs for MP3 generation; pre-rendered, never on-the-fly.
- **No overlapping narration.** One audio slot, one queue slot. HIGH priority lines pre-empt. NORMAL lines queue (max 1). LOW lines drop if anything is playing. Per-trigger cooldowns. Anti-repeat history.
- **Jargon dial: ~30%.** Universal RPG-menu labels (Skills, Quest Log, Bestiary), not paper-sheet jargon (Proficiencies, Saving Throws, Feats). D&D flavor lives in *descriptions and narrator lines*, not labels.
- **Specificity rule for narrator lines:** every line should reference real specifics of Nikos or the site. Audit question: *"Could this line appear on any developer's portfolio?"* If yes, rewrite.
- **Portrayal rule:** self-deprecation goes through external chaos (clients, scope creep, version migrations), never through Nikos being flaky or indecisive. The pattern is: *the world is messy; he ships anyway.*

## File map

```
my-website/
├── index.html              # Single page, both views in DOM, toggled by class
├── styles.css              # One stylesheet, sectioned by comments
├── app.js                  # Entry, narrator, intro, views, easter eggs
├── data/
│   ├── voicelines.json     # All narrator lines keyed by trigger ID
│   ├── content.json        # Bio, work, projects, hobbies, factions
│   └── now.json            # "What I'm doing right now" — edit manually
├── audio/                  # Pre-generated MP3s (file names match line IDs)
├── scripts/
│   └── synth.mjs           # Zero-dep Node script — generates MP3s via ElevenLabs API
├── .env.example            # ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID
├── .gitignore
└── README.md               # Deploy + audio-generation instructions
```

## Adding a new narrator line

1. Pick or create a trigger ID (e.g. `clickStrengthStat`).
2. Add a line entry to `data/voicelines.json`:
   ```json
   "clickStrengthStat": [
     { "id": "strength_1", "text": "We don't talk about Strength. The character's never invested a point." }
   ]
   ```
3. Add multiple entries per trigger ID for anti-repeat rotation.
4. Wire the trigger in JS (`narrator.fire('clickStrengthStat')`).
5. Optionally run `node scripts/synth.mjs` to generate MP3s for any lines missing audio.

## Narrator API (in app.js)

```js
narrator.fire(triggerId, {
  priority: 'HIGH' | 'NORMAL' | 'LOW',  // default NORMAL
  cooldown: <ms>                        // default 8000
});
```

- HIGH = pre-empts current line, clears queue (intro, secret reveal)
- NORMAL = plays if free, else replaces queue slot (door choice, swap)
- LOW = drops if anything is playing/queued (idle, ambient, hover-jokes)

## Things deliberately NOT in v1

- ElevenLabs voice cloning (do later when Nikos records a 30s sample)
- Paint-a-mini accent customization
- Embedded WebGL mini
- The "Heretic" hidden third door (post-Konami unlock — easy to add)
- Analytics, even privacy-respecting ones
- Service worker / offline support

## Deploy

GitHub Pages (free) or Netlify drag-and-drop. Static files only. No build step.
