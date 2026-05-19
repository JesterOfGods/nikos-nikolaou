# Voice Lines — Generation Guide

**42 lines.** Generate any subset. Site works text-only if a line has no audio.

## How to use this file

1. Sign up at [elevenlabs.io](https://elevenlabs.io). Free tier (~10k chars/month) covers this whole bank with room left over.
2. Recommended: do voice cloning — feed ElevenLabs **30 seconds of you talking in your DM voice** (warm, dry, observational). The whole site then sounds like you DM-ing.
3. For each line: copy the text, paste into ElevenLabs, generate, download MP3.
4. Rename the MP3 to **`<ID>.mp3`** (exact match, case-sensitive).
5. Drop it into the **`audio/`** folder at the project root.
6. The site picks it up automatically. If a file is missing, text shows alone — nothing breaks.

## Voice direction

- Warm DM who's known Nikos for years, knows they're on a website, talks to the visitor.
- Dry, observational, fourth-wall-breaking, affectionately teasing.
- References: clean Deadpool, The Beginner's Guide narrator, Stanley Parable.
- Slight pauses where the em-dashes are. Reads natural, not theatrical.

## Pronunciation notes

If ElevenLabs mispronounces, swap these in the audio script and regenerate:

| Written | Say it as |
|---|---|
| C# | "C sharp" |
| 3D | "three D" |
| d20 | "dee twenty" |
| Nat 20 / Nat 1 | "nat twenty" / "nat one" |
| XR / VR / AR | letter-by-letter |
| DM | "dee em" |
| SXSW | "south by southwest" or letters |
| DFI | letters |
| FDM | letters |
| TTRPG | letters |
| ADHD | letters |
| EDH | letters |
| LOTRO | "lot-ro" |
| Faerûn | "fay-roon" |
| MESBG | letters or "middle earth strategy battle game" |

---

# THE LINES

## 1. Cold open — the one to nail

The most important line in the whole site. Every visitor hears this. If you only record one, record this.

### `coldOpen_1.mp3`
> Welcome. There are two doors. Adventurer means you have time and curiosity. Commoner means you have neither — and that's not an insult. He built both versions. Pick whichever you actually are, not which one sounds cooler. He'll know.

---

## 2. Returning visitor (instead of the cold open)

### `return_1.mp3`
> Back again. You know the drill.

### `return_2.mp3`
> Back. Either he's hiring you or you're stalling on something at work. Probably both.

---

## 3. Picking a door

### `adv_1.mp3` — picked Adventurer
> Adventurer. He bet me you'd pick this. He doesn't like losing, so he won.

### `com_1.mp3` — picked Commoner
> Commoner. Practical. The character sheet stays in the drawer for you. You're welcome.

---

## 4. Swapping mid-session (escalates)

These play in order as the visitor swaps repeatedly.

### `swap_combo.mp3` — first swap
> Pick a lane. He didn't — he built both. You're welcome. He'd like that weekend back, though.

### `swap_a.mp3` — second swap
> Pick a lane. He didn't get to — he had to build both. You're welcome.

### `swap_b.mp3` — third swap
> You switched. No consequences for you. Usually it costs him a weekend you'll never see.

### `swap_c.mp3` — fourth swap
> Mid-scope flip. He's done this for clients — he shipped them. He'll ship you too.

### `swap_meta.mp3` — fifth+ swap (visitor is clearly testing)
> Okay, you're doing this on purpose now. He respects it.

---

## 5. Clicking stats

### `str_1.mp3` — Strength stat
> We don't talk about Strength. The character's never invested a single point.

### `caf_1.mp3` — Caffeine Resistance stat
> Caffeine Resistance. Negative modifier. He drinks coffee anyway. Calls it a superpower. We disagree.

---

## 6. Clicking skills

### `unity_1.mp3` — Unity
> Unity. Cast daily since 2019. Bonus damage vs. spaghetti code. Disadvantage on version-migration days.

### `ue_1.mp3` — Unreal
> Unreal 5. He used this on a DFI-funded vertical slice. Solo programmer. It shipped. He's proud of it. He won't say that.

### `cs_1.mp3` — C# (write "C sharp" in audio)
> C sharp. Six years deep. He has opinions about async. Don't ask unless you have time.

---

## 7. Clicking factions

### `rohan_1.mp3` — Rohan (MESBG)
> Rohan. Horse lords. He likes that the cool guys ride in late and turn the battle. Says a lot about him.

### `gk_1.mp3` — Grey Knights (40k)
> Grey Knights. Daemon hunters in silver armor. He paints them slowly. Nine years in, three hundred to go. He'll finish. Probably.

### `ttrpg_1.mp3` — The TTRPG he's building
> That's the system he's building. Don't ask when it's done. Polite answer: "soon." Real answer: "when it's right."

### `faerun_1.mp3` — Homebrew Faerûn (say "fay-roon")
> Fay-roon, but his. Six years of edits. The canon doesn't survive contact with his players.

---

## 8. Clicking Library

### `lib_1.mp3` — the empty Books section
> Empty. He doesn't read books. He's mentioned it twice. He's going to mention it again.

### `bg_1.mp3` — clicking The Beginner's Guide
> Of course he likes that one. We're basically inside it right now.

---

## 9. Clicking projects / work positions

### `proj_novo_1.mp3` — Novo Nordisk (current day job)
> Novo. The day job. Healthcare training simulations. He can't show you most of it. He'll tell you it's the most interesting N D A he's ever signed.

### `proj_khora_1.mp3` — Khora (workplace + SXSW project)
> Khora. The south-by-southwest one. He won't tell you which award, he'll tell you what the team built.

### `proj_silkroad_1.mp3` — Silkroad Studios (CTO era)
> Silkroad. Sole programmer. Unreal 5. A vertical slice that shipped. He was C T O for two years and won't say the word "C T O" out loud unless you ask him to.

### `proj_ttrpg_1.mp3` — TTRPG project card
> His TTRPG. Rules. Setting. Stories. Slowly growing. He won't show you everything — some of it isn't ready. The rest he just hasn't decided you've earned yet.

### `proj_3d_1.mp3` — 3D print project card
> Resin. F D M. Minis, statues, the occasional bracket that fixes something he should have just bought. He had a company for this. He doesn't talk about why it ended. Ask him over coffee.

---

## 10. Opening showcases (full overlay)

These play as the sheet "puts down" and the showcase opens.

### `show_ttrpg_1.mp3`
> He puts the sheet down. Behind it: the manuscript. The good stuff. Or the part he'll let you see.

### `show_minis_1.mp3`
> The desk. Paints out of order. Wash drying. He'd apologize for the mess. He won't mean it.

### `show_faerun_1.mp3`
> He flips open the D M screen. Six years of notes. Most of them are the players' fault.

### `show_khora_1.mp3`
> The X R work. Cleaner room, headset on the desk. The award's in a box somewhere. He moved twice.

### `close_show_1.mp3` — closing the showcase
> Back to the sheet. He picks it up. We continue.

---

## 11. Ambient / behavior-triggered

### `idle_1.mp3` — idle 30s
> Still reading? Most people skim. Don't tell him you actually read it — he won't believe you.

### `idle_2.mp3` — idle 30s (alternative)
> You're really reading this. He'd want to argue with you. About something. Probably this.

### `skim_1.mp3` — visitor scrolls past a section fast
> Skimming. Bold. He'd respect you more if you slowed down. He's also doing the same thing in another tab right now.

### `late_1.mp3` — visit after midnight
> 3 a.m.? He'd be up too. He'd tell you to sleep, then keep working.

### `blur_1.mp3` — visitor switches tabs away
> You left. He's not offended. He left tabs open during his own honeymoon.

---

## 12. Easter eggs

### `dev_1.mp3` — visitor opens DevTools
> You opened the inspector. Looking for the seams. Good. He builds for that kind of audience.

### `con_1.mp3` — visitor opens the in-page console (tilde key)
> You found the terminal. He hoped you would. Type "help" if you're stuck. Type "cast fireball" if you're not.

### `kon_1.mp3` — Konami code entered
> He hoped someone would try that. Welcome to the back room.

---

## 13. The d20 roll (initiative button)

### `nat20_1.mp3` — natural 20 (5% chance)
> Nat twenty. You got lucky. Take it. You only get one roll — he insisted on that.

### `nat1_1.mp3` — natural 1 (5% chance)
> Nat one. Embarrassing. The roll stands. He insisted.

### `d20_norm_1.mp3` — rolls 2–19 (90% chance)
> A respectable roll. Nothing's going to happen because of it. He thought that was funnier.

---

## 14. The cursed button

### `cursed_1.mp3` — first click
> There it is. I told him to label it "do not click" and you'd press it harder. He bet me dinner.

### `cursed_2.mp3` — repeat clicks
> You're really committed to breaking this. Fine. He admires the persistence.

---

## 15. Audio toggle

### `audio_on_1.mp3` — visitor enables audio mid-session
> Voice on. Hello. You can hear me. That's still novel for both of us.

### `audio_off_1.mp3` — visitor mutes audio mid-session
> Muted. Probably for the best. You'll still see me. Like a subtitle. With opinions.

---

## 16. Dungeon RPG (terminal `play` command)

The same DM narrator runs the dungeon. The line fires from the bubble while the game text runs in the console.

### `rpg_firstPlay_1.mp3` — very first time a visitor types `play`
> You typed 'play'. He hoped you would. The console isn't just a console — it's a table. Pull up a chair. I'll D M this one too.

### `rpg_start_1.mp3` — any subsequent new dungeon roll
> New session. Rolled the dungeon for you — he likes randomness more than he admits.

### `rpg_resume_1.mp3` — picking up an in-progress dungeon
> Picking up where you left off. He saves state. He's that kind of player.

### `rpg_start_crypt_1.mp3` — entering the Lich's Crypt
> The Crypt. Liches. Footnotes. He ran a campaign in one of these once — three players, one T P K, everyone left smiling.

### `rpg_start_cavern_1.mp3` — entering the Deep-Cave of Wyrms
> Dragons. Of course. He paints these for fun. Don't tell him the dragon is also a mini in a box at his apartment.

### `rpg_start_library_1.mp3` — entering the Sunken Library
> A library. Joke's on him — he doesn't read books. He'll D M this one harder out of spite.

### `rpg_start_throne_1.mp3` — entering the Throne of Ra-Nekhet
> A pharaoh. He has opinions about historical accuracy. He will not air them. He will simply judge you.

### `rpg_start_temple_1.mp3` — entering the Forsaken Temple
> The Star-Eaten. He wrote this one late at night, between client emails. It shows.

### `rpg_death_1.mp3` — HP drops to 0
> You went down. He's not letting you stay down. Back to the door. That's the deal — we never quit.

### `rpg_boss_crypt_1.mp3` — Lich defeated
> Lich, deceased. He'd want a write-up. Don't give him one.

### `rpg_boss_cavern_1.mp3` — Dragon defeated
> You killed his dragon. He'll forgive you eventually. Probably.

### `rpg_boss_library_1.mp3` — Drowned Archivist defeated
> Cleared. The Archivist would have hated you on principle. He likes you for it.

### `rpg_boss_throne_1.mp3` — Pharaoh defeated
> Pharaoh down. Bureaucracy never dies, but the man behind it does.

### `rpg_boss_temple_1.mp3` — Star-Eaten Priest defeated
> The Priest is gone. The Star-Eaten god takes nothing. He's quietly proud of you.

### `rpg_quit_1.mp3` — visitor quits the dungeon
> Saved. Resume anytime. He plays the same way — bookmarks everything, finishes things eventually.

### `rpg_restart_1.mp3` — visitor restarts game from scratch
> Cleared the table. Codes stay. He's not cruel about progression.

---

## 17. Hacker game (cursed "DO NOT CLICK" button)

### `hacker_open_1.mp3` — visitor enters the backroom (plays AFTER the konami line completes)
> Welcome to the backroom. Solve a challenge, earn a code, take it back to the dungeon. He built this when he should've been sleeping.

### `hacker_exit_1.mp3` — visitor leaves the backroom
> You left the backroom. The site looks more normal now. Trust me, it isn't.

### `hacker_solved_1.mp3` — first time solving a challenge
> Solved. Code's yours. Use it in `play` — he's curious which spell you go for first.

### `hacker_resolved_1.mp3` — re-solving an already-solved challenge
> You solved this one already. He still appreciates the effort.

---

# Quick batch suggestions

**Tier 1 — record these first** (~7 lines): `coldOpen_1`, `adv_1`, `com_1`, `swap_combo`, `cursed_1`, `nat20_1`, `kon_1`.
These cover the most impactful moments — first impression, door choice, easter egg payoffs.

**Tier 2 — section riffs** (~12 lines): all the `clickFaction_*`, `clickSkill_*`, `clickProject_*`, `clickLibrary_*` lines. Lets visitors who browse the sheet get audio commentary.

**Tier 3 — fill out** (~23 lines): everything else — ambient, idle, alternates, repeats. Optional, adds depth.

---

# Total character count

~6300 chars across all 42 lines — fits comfortably in ElevenLabs' free monthly tier.
