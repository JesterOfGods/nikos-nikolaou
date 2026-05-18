# Nikos Nikolaou — Personal Site

A personal portfolio + game-experience site. Two views:

- **Adventurer** — character-screen layout with traits, factions, skills, showcases, easter eggs, narrator on.
- **Patron** — clean modern portfolio, scannable in 20 seconds.

Same content, two skins. Visitor can swap any time. The narrator notices.

---

## Run it locally

The site loads its data via `fetch()`, so it needs a local web server. Two easy options:

```bash
# Option 1: with Node (no install needed)
npx serve .

# Option 2: with Python
python -m http.server 8000
```

Then open the URL it prints (usually `http://localhost:8000`).

If you open `index.html` directly via `file://`, the browser will block the data load and you'll see an inline error explaining why.

---

## Project structure

```
my-website/
├── index.html              # Single page — both views live in the DOM
├── styles.css              # One stylesheet, sectioned by comments
├── app.js                  # Entry, narrator, intro, views, easter eggs
├── data/
│   ├── content.json        # Bio, work, skills, factions, showcases
│   ├── voicelines.json     # All narrator lines keyed by trigger ID
│   └── now.json            # "What I'm doing right now" — edit by hand
├── audio/                  # MP3s for narrator lines (filename = line ID)
├── assets/showcase/<id>/   # Hero + gallery images per showcase
├── scripts/
│   └── synth.mjs           # Generate MP3s via ElevenLabs (zero-dep, Node 18+)
├── voicelines.md           # All lines in human-readable form for copy-paste
├── CLAUDE.md               # Project context for future sessions
├── .env.example            # ElevenLabs config template
└── README.md
```

---

## Editing content

| Want to change... | Edit... |
|---|---|
| Bio, work history, skills, traits, factions | [data/content.json](data/content.json) |
| What I'm doing right now (Quest Log) | [data/now.json](data/now.json) |
| Narrator lines | [data/voicelines.json](data/voicelines.json) (and re-run `synth.mjs` if audio is wanted) |
| Showcase descriptions / milestones | [data/content.json](data/content.json) → `showcases[]` |
| Showcase images | drop into `assets/showcase/<id>/hero.jpg` and `assets/showcase/<id>/<name>.jpg` — referenced from `content.json` |
| Visual theme | [styles.css](styles.css) → `:root` tokens at top |

No build step. Save the file, refresh the page.

---

## Audio (narrator voice)

The narrator works text-only out of the box. Audio is opt-in and additive.

### Generate audio with ElevenLabs

1. Sign up at [elevenlabs.io](https://elevenlabs.io). Free tier covers this whole site (~6300 characters total) with room left.
2. Copy the config template:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env`:
   - `ELEVENLABS_API_KEY` — from your ElevenLabs profile
   - `ELEVENLABS_VOICE_ID` — pick from their voice library, **or** clone your own voice from a 30-second sample (strongly recommended for the DM frame)
4. Generate MP3s:
   ```bash
   node scripts/synth.mjs              # only missing files
   node scripts/synth.mjs --force      # overwrite all
   node scripts/synth.mjs --only coldOpen_1,adv_1   # specific lines
   ```
5. MP3s land in `audio/<id>.mp3`. The site picks them up automatically.

### Or do it manually

If you'd rather paste each line into the ElevenLabs UI by hand:

- Use [voicelines.md](voicelines.md) — every line is grouped, named, and tagged with pronunciation notes.
- Save each MP3 as `<ID>.mp3` (e.g. `coldOpen_1.mp3`).
- Drop them in `audio/`.

### Priority order if you don't want to generate all 42

`voicelines.md` flags **Tier 1** (~7 lines): cold-open, door choices, the first swap line, the cursed-button line, nat 20, and the konami code. These cover the most impactful moments.

---

## Showcase images

Each showcase in `content.json` points to:

- `hero: "assets/showcase/<id>/hero.jpg"` — main image (~1600px wide, 16:9)
- `gallery: ["assets/showcase/<id>/1.jpg", ...]` — additional images, any size

Missing files fall back to placeholder boxes. Nothing breaks until you fill them in.

---

## Easter eggs

- **`~` or `` ` ``** — open the in-page console. Try `help`, `cast fireball`, `roll 1d20`, `view patron`.
- **🎲 d20 button** in the Adventurer header — rolls a real d20, narrator riffs on nat 20 / nat 1.
- **DO NOT CLICK button** (bottom-left in Adventurer view) — glitches the page and runs a custom line.
- **Konami code** (↑↑↓↓←→←→ B A) — narrator acknowledges, screen shimmers.
- **Open DevTools** — narrator notices.
- **Visit between midnight and 5 AM** — narrator notices.

---

## Deploy

### GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: deploy from branch `main` / `/ (root)`.
3. Done. Loads at `https://<username>.github.io/my-website/`.

### Netlify (drag-and-drop)

1. Build = none. Publish directory = repo root.
2. Drag the folder onto netlify.com/drop. Done.

### Custom domain

Both platforms support free HTTPS + custom domains. Configure in their UI.

---

## Performance

Built for fast first paint. No frameworks, no Google Fonts, no third-party scripts, no analytics.

- Initial payload (HTML + CSS + JS): ~50KB uncompressed
- JSON data: ~10KB more, loaded in parallel
- Audio: lazy-loaded only when a line plays
- Target: <1s LCP on a regular connection

If you add things, keep the spirit. Resist frameworks until you have a real reason.

---

## License / Reuse

This is Nikos's personal site. The code structure is yours to learn from. The content (bio, voice lines, showcases) is his.
