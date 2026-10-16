# Morgie's Cyber Adventures

> **Dey's Security Arcade** — an educational cyber game.

A browser-based arcade game that teaches **digital forensics** and **cryptography** fundamentals through short, hands-on missions. Built with plain HTML / CSS / JavaScript — **no build step, no dependencies**. Just open `index.html` in a browser and play.

## ▶️ How to run

Open `index.html` in any modern web browser. That's it — everything runs client-side.

## 🎮 Features

- **15 missions** across two tracks:
  - 🔐 **Cryptography** — Caesar, ROT13, Vigenère, Base64, XOR, hex, binary, Morse
  - 🔍 **Digital Forensics** — metadata, log hunting, file hashing, magic numbers, steganography, phishing URLs, SQL injection
- 💀 **Boss mission** — a 3-stage finale ("The Zero-Day Heist") unlocked after clearing the campaign
- 🎚️ **3 difficulty levels** (Easy / Normal / Hard) that scale timers, lives, and scoring
- 🧑‍🚀 **4 customizable agents** — edit name, avatar, bio, and tune perks
- 🎲 **Game modes** — Campaign (pick missions) and endless Random Quickplay
- 🏆 **Leaderboard** — persistent local top-10 high scores
- 🎖️ **12 achievements** with unlock toasts
- 🔊 **Sound effects** synthesized at runtime via the Web Audio API (no audio files), with a mute toggle

Every mission ends with a **debrief** explaining the real-world cybersecurity concept behind the puzzle.

## 📁 Project structure

| File | Purpose |
|------|---------|
| `index.html` | Screens and page structure |
| `styles.css` | Retro CRT / terminal arcade theme |
| `game.js` | Engine: screens, HUD, timer, scoring, modes |
| `missions.js` | All missions + the boss, with teaching content |
| `characters.js` | Playable agent definitions |
| `achievements.js` | Achievement definitions and tracking |
| `leaderboard.js` | Persistent local high-score table |
| `audio.js` | Runtime-synthesized sound effects |

Progress, leaderboard, achievements, and preferences are saved in the browser's `localStorage`.

---

_An educational project — built for learning._
