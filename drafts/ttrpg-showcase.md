# Grit & Glory — showcase copy

> **Status:** ready to port pending your sign-off. Everything below is the final copy
> as I plan to write it into `data/content.json`. Edit freely. When you're good,
> say **"port it"** and I'll move it across.

---

## Small things to confirm before porting

1. **"Hobrewing"** in milestone 1 — read as a typo for "Homebrewing" and corrected
   below. Push back if you meant something else.
2. The opening paragraph from "Paragraph I like" — *"You took the job because the
   pay was real. Three days in…"* — is NOT being used here. It reads as second-person
   diegetic flash-fiction, which clashes with the rest of the showcase copy's voice
   (third-person about the game itself). It still lives in the blog source if you
   want it elsewhere later. Say the word if you'd rather force-fit it in.

---

## 1. Cover hero (split-image book-cover at the top of the modal)

| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Kicker          | `First Edition`                                         |
| Title parts     | `GRIT` · `&` · `GLORY`  *(the `&` renders rust-colored)* |
| Cover tagline   | `A Roleplaying Game of Survival, Steel, and Scars`      |
| Byline          | `Designed and Written by Nikos Nikolaou · 2026`         |

**Teaser** (two paragraphs):

> After the gods withdrew and the Shatter cracked the sky, the world kept turning —
> colder, hungrier, and still worth fighting for.
>
> Grit & Glory is a tabletop RPG of earned competence and real consequence. Build
> a dice pool from what you've trained and watch yourself go thin under pressure.
> Watch your gear wear down, blow by blow, one die-step at a time.

---

## 2. Body story (long prose block under the cover, in the modal body)

Five paragraphs. Origin → mechanics → felt experience → capstone → status. No
overlap with the teaser above.

> Grit & Glory grew out of a six-year Faerûn campaign that kept outgrowing the rules
> holding it together. D&D's HP bloat didn't match the wounds the table was telling
> stories about; levels arrived faster than the world's economy could absorb; the
> players kept inventing — from whole cloth — the mechanics they wanted to see.
> Eventually I stopped patching and started writing my own system.
>
> The system is built on three locked feelings. **The Grind:** every action carries
> weight; nothing is free. **The Welcome Bruise:** the only band of outcome that
> delivers per-roll advancement is the one where you almost made it; growth is
> paid for in scars. **Lawful Brutality:** no hidden target numbers; the world is
> hostile, but it tells you exactly how hard it's pushing back, in the currency of
> dice.
>
> Sessions feel like pressure — every roll spends something: focus, gear, daylight,
> blood. Campaigns feel like becoming. Who your character is at session ten isn't
> who they were at session one, because something happened on the road, and
> something stayed.
>
> Heroism isn't a birthright here. Hope is earned. So is glory.
>
> Currently in writing. First-edition draft sits at 387 pages, the bestiary grows
> teeth every time I declare it finished, and playtest reports live in their own
> folder so design decisions stay auditable years from now.

---

## 3. Milestones (bulleted list under the story)

- Six years of homebrew Faerûn → homebrewing rules started in 2024.
- First-edition draft: 387 pages and growing. FAST!
- Three locked pillars — Grind, Welcome Bruise, Lawful Brutality.
- No d20, no class levels, no static AC.
- Design decisions tracked as DDRs; playtests as audited reports.

---

## 4. Locked decisions (notes for the future, not website copy)

### Cosmology
**Two events, in order:**

1. **The Withdrawal** — the gods gave up their power to seal a seam in the world.
   This is the older, foundational catastrophe.
2. **The Hollow Wake** — a later event in a godless world that *reopened* the seam
   the gods had sealed at the cost of their own power. The Shatter (visible cracks
   in the sky) is its lingering aftermath.

This is the canonical framing per Nikos as of 2026-05-21. The vault chapter
`Part 1 The Engine/ch01-world.typ` currently leads with the Hollow Wake only; the
Withdrawal layer is still being written. The website teaser's compressed phrasing
("After the gods withdrew and the Shatter cracked the sky") is consistent with
both events. No edits needed to the live site as the lore expands — unless a
future copy pass needs to clarify the two-event distinction.

### Blog post draft
The "Gods Are Gone. The World Kept Turning." draft was written to feed *this*
copy pass, not for publication. Treated as source material. Not building a blog
section on the site.

---

## 5. What's already live in code

- `data/content.json` — cover hero teaser is the two-paragraph version above (typo
  fixed: "traine" → "trained").
- `app.js` — cover hero teaser renderer accepts string OR array, so two-paragraph
  teasers render as two `<p>` elements.
- Nothing else updated. Body story + milestones + status field still hold the
  earlier draft. Saying "port it" will write Sections 1–3 above into
  `data/content.json` in one pass.
