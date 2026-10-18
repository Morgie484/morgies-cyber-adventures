# GREPOIRE — A Digital Forensics Investigation RPG

> *`grep` + grimoire* — part search command, part book of spells. Trace the ghost in the logs.
>
> *A **MORG** systems production.* (psst — try typing `morg` in the forensic shell.)

A browser-based, **D&D-style** forensics RPG with a **hybrid open world**: play a
customizable **data-mage**, walk a top-down map, enter locations, and "jack in"
to devices to do **realistic** digital-forensics work in a working command-line
shell. Skill checks resolve with an **animated d20 roll**, and everything has
**procedural music & sound effects**.

Built to be **beginner-friendly** — a guided training case teaches one concept
at a time, every command self-documents, and you can never permanently fail —
with **harder cases** (encrypted data, hash-tampering, multi-hop trails) mixed in.

## The world
GREPOIRE is set in **the Archive** — an enchanted wood between worlds where all data persists as living magic. You explore a **mystical forest** overworld (glowing shrine-stones, cloaked wanderers, drifting fireflies) as a **Data-Mage of the Order of the Silent Grep**: part detective, part sorcerer. Devices are shrines in the clearings; encryption is a **ward** you *banish*; deleted files are **echoes** you *mend*; a hash is a file's **true-name sigil**; network traffic is an **aether-stream** you *scry*. Cases are **quests** commissioned by the Order, and your five skills are **arcane disciplines** (schools of magic). Read the full lore in the in-game Codex ([J]).

### Classes
Six classes in the Order, each with its own discipline spread and a signature boon:
| Class | Origin | Boon |
|---|---|---|
| **Warden of Seals** | ex-cybercrime investigator | sealed evidence is unchallengeable |
| **Shadow Revenant** | reformed ward-breaker | +2 vs. attacker tooling |
| **Rune-Scholar** | cloistered cryptomancer | +2 on decode/crypto |
| **Aether-Seer** | clairvoyant stream-reader | +2 on scrying (scan/traffic) |
| **Silver-Tongue Bard** | wandering loremonger | +2 on SOCIAL confrontations |
| **Clockwork Artificer** | tinker-mage | +2 on TECH (recover/reassemble) |

### Quests
`The Pilfered Sigil` (Tutorial) · `The Curse of the Hollow Coin` (Hard) · `The Masque of the Revenant` (Expert) · `Song of the Null Choir` (Expert, packet-capture).

## Features
- **Deep D&D world** — lore codex, faction bible, arcane re-skin of every mechanic, rank titles per level (Initiate → Grand Magus of the Archive), and **spellword aliases** you can cast in the shell: `scry`=scan, `banish`=decode, `mend`=recover, `divine`=sha256, `reveal`=ls, `behold`=cat, `commune`=stats.
- **The Adventurer's Codex** ([J]) — an in-game journal with four tabs: your D&D-style **character sheet**, the **quest log**, **evidence & field notes**, and the **world codex** (realm primer, glossary, factions).
- **Packet-capture quests** — a new forensic skill: `pcap <file>` scries an aether-stream (network capture), flags the suspicious flow, and `pcap <file> follow <#>` reassembles it.
- **Keyboard terminal navigation** — command **history** with ↑/↓ and **Tab-completion** for commands, spellwords, and filenames.
- **Settings panel** (⚙) — master/music/SFX **volume sliders** and a **reset-save** option.
- **Save & continue** — progress auto-saves to your browser (localStorage): character, level, appearance, and which cases you've solved. The title screen offers **Continue** when a save exists; **New Game** starts fresh.
- **Animated title screen** — a GREPOIRE landing page with falling data-rune rain before you begin.
- **Animated dice rolls** — a tumbling d20 lands on your result with success/crit flair and sound.
- **Level-up celebration** — a burst animation announces each new level and the skill points you earned.
- **Customizable wizard characters** — pick robe color, hat, magic focus, aura, and skin; your look appears on the overworld avatar and in creation.
- **Four quests, scaling difficulty:**
  - `The Pilfered Sigil` — **TUTORIAL** (learn the tools)
  - `The Curse of the Hollow Coin` — **HARD** (hash-tamper detection, a hidden backdoor, a multi-hop trail)
  - `The Masque of the Revenant` — **EXPERT** (a frame-up to see through, a tampered log, chained `base64 → ROT13` decoding, and a confession gated behind two pieces of evidence)
  - `Song of the Null Choir` — **EXPERT** (packet-capture: scry an aether-stream, follow the tainted flow)
  - `dcBonus` raises every skill-check DC per quest; pick from the case-select screen, and solving one offers the next.
- **Procedural audio** — ambient arcane music + SFX for movement, typing, dice, evidence, success/failure, and level-ups. Toggle with the on-screen button or **M**. No audio files required.

## How to play

Because it uses ES modules, serve the folder over HTTP (don't open the file
directly):

```bash
cd /projects/sandbox
python3 -m http.server 8000
# then open http://localhost:8000
```

### Controls
- **WASD / arrow keys** — move around the world
- **SPACE** — enter a location (blue block) or talk to an NPC (yellow dot)
- **E** — open the Evidence Board (review clues, spend discipline points, solve the quest)
- **J** — open the Adventurer's Codex (character sheet, quest log, evidence, world lore)
- **M** — mute / unmute audio · **⚙** (top-right) — settings (volume, reset save)
- **In the shell:** ↑/↓ for command history, **Tab** to complete commands & filenames
- **ESC** — disconnect from a device / close a panel

### The loop
1. **Create your investigator** — pick a background that sets your skills
   (LOGIC, PERCEPTION, TECH, SOCIAL, COMPOSURE).
2. **Explore** the three locations on the map.
3. **Investigate devices** in the terminal. Type `help` to see commands.
4. **Tag evidence** with `tag <file>`. Risky actions trigger **dice rolls**
   (`d20 + skill vs. difficulty`) — like D&D skill checks.
5. **Interrogate NPCs** — SOCIAL checks unlock confessions (some need evidence first).
6. **Solve the case** on the Evidence Board: WHO, HOW, and WHEN.

### Forensics concepts you'll learn (Case #4471)
- Listing / reading files, and finding **hidden** files (`ls -a`)
- **Recovering deleted** files (`scan`, then `recover`)
- **Hashes** as fingerprints, and **verifying** file integrity (`sha256`, `verify`)
- Reading **logs** as a **timeline** to trace an intruder (`log`, `grep`)
- **Decoding** scrambled/encoded data (`decode`)

## Project structure

```
index.html            Entry point + layout
styles.css            Terminal/CRT styling + dice-popup animation
src/
  main.js             Orchestrator: world + terminal + dialogue + dice + audio + cases
  engine/
    dice.js           d20 skill-check engine (crit success/failure, DCs)
    character.js      Stats, backgrounds, perks, XP/leveling, inventory, appearance
    crypto.js         hash / strings / hexdump / ROT / base64 helpers
    filesystem.js     Simulated device filesystem (deleted/hidden/locked files)
    terminal.js       The forensic shell: all commands, async skill-gated actions
    appearance.js     Customizable data-mage data + canvas renderer
    audio.js          Procedural Web Audio music + SFX (no asset files)
    save.js           Save/load to localStorage (character, progress, solved cases)
  world/
    overworld.js      Top-down map, movement, collision, custom avatar, prompts
  ui/
    screens.js        Boot, character creation, case select, dialogue, evidence board
    diceRoll.js       Animated d20 roll popup
  data/
    case01.js         "The Pilfered Sigil" — TUTORIAL quest
    case02.js         "The Curse of the Hollow Coin" — HARD quest (tamper detection, backdoor, insider)
    case03.js         "The Masque of the Revenant" — EXPERT quest (frame-up, chained decoding, 2-evidence gate)
    case04.js         "Song of the Null Choir" — EXPERT packet-capture quest (D&D-framed)
    cases.js          Case registry
    lore.js           World bible: realm, order, disciplines, factions, spellwords, rank titles
```

## Adding a harder case
Set a `difficulty` label and a `dcBonus` (added to every skill-check DC) on the
case object, then raise the required rolls by using encrypted (`locked`) files,
hash mismatches, and multi-step NPC confrontations gated behind decoded evidence.
See `case02.js` for a worked example.

## Adding more cases
Each case is a self-contained module in `src/data/` describing its devices
(filesystems), NPCs (dialogue trees), and the questions that solve it. Copy
`case01.js` as a template.
```
