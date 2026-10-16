/* =========================================================================
   CipherTrace — Mission definitions
   Each mission is self-contained and teaches one real concept.

   Mission shape:
   {
     id:        unique string
     track:     "forensics" | "crypto"
     difficulty:"easy" | "normal" | "hard"  (assigned at the bottom of this file)
     icon:      emoji
     title:     short name
     desc:      one-line card description
     brief:     in-mission setup text
     time:      seconds on the timer
     type:      "choice" | "input" | "caesar"
     evidence:  HTML string shown in the black evidence box (optional)
     options:   [strings]            (for type "choice")
     answer:    index | string       (correct answer; strings compared case-insensitively, trimmed)
     hint:      optional hint string
     learn:     debrief / teaching text (HTML allowed)
     // caesar-only:
     cipher:    the shifted text to crack
   }
   ========================================================================= */

const MISSIONS = [
  /* ---------- CRYPTO: Caesar ---------- */
  {
    id: "caesar-1",
    track: "crypto",
    icon: "🔐",
    title: "The Caesar Shift",
    desc: "Crack a classic shift cipher used since ancient Rome.",
    brief:
      "An intercepted note is scrambled with a Caesar cipher — every letter is shifted the same number of places in the alphabet. Use the decoder to find the shift that reveals English, then type the hidden word.",
    time: 90,
    type: "caesar",
    cipher: "DWWDFN DW GDZQ",
    answer: "ATTACK AT DAWN",
    hint: "Try small shifts first. The message is two short English words plus 'AT'.",
    learn:
      "The <strong>Caesar cipher</strong> shifts each letter by a fixed amount (here, 3). It's one of the oldest known ciphers. Because there are only 25 possible shifts, it's trivially broken by <strong>brute force</strong> — trying every shift until the text reads as language. This is why modern crypto needs enormous key spaces.",
  },

  /* ---------- CRYPTO: Base64 ---------- */
  {
    id: "base64-1",
    track: "crypto",
    icon: "🧬",
    title: "Encoded, Not Encrypted",
    desc: "Recognize Base64 and decode a hidden message.",
    brief:
      "Analysts found this string in a config file. It looks scrambled, but notice the character set (A–Z, a–z, 0–9, +, /) and the '=' padding — that's Base64 ENCODING, not encryption. Decode it and type the plain message.",
    time: 75,
    type: "input",
    evidence: "VGhlIHZhdWx0IGNvZGUgaXMgNzc0Mg==",
    answer: "The vault code is 7742",
    hint: "Base64 is reversible with no key. The decoded text is a short English sentence.",
    learn:
      "<strong>Base64 is encoding, not encryption.</strong> It converts binary/text into a safe ASCII character set for transport — anyone can reverse it instantly, no key required. Finding Base64 in files or traffic is a classic forensics tell: attackers often use it to obfuscate payloads, but it provides <strong>zero</strong> real secrecy.",
  },

  /* ---------- CRYPTO: XOR concept via choice ---------- */
  {
    id: "xor-1",
    track: "crypto",
    icon: "⊕",
    title: "The XOR Key",
    desc: "Understand symmetric keys with a simple XOR puzzle.",
    brief:
      "A message byte was combined with a secret key byte using XOR (⊕). You intercepted both the ciphertext and know the key. Compute the original letter.\n\nCiphertext bit pattern: 01101000\nKey bit pattern:        00001010\n\nXOR each bit (1 if bits differ, 0 if same). Which ASCII letter is the result?",
    time: 100,
    type: "choice",
    evidence:
      "<span class='k'>cipher</span> 0 1 1 0 1 0 0 0\n<span class='k'>key   </span> 0 0 0 0 1 0 1 0\n<span class='k'>XOR   </span> ? ? ? ? ? ? ? ?   <span class='hl'>(1 if bits differ)</span>",
    options: [
      "01100010 → 'b'",
      "01100000 → '`'",
      "01101010 → 'j'",
      "00000010 → (control char)",
    ],
    answer: 0,
    hint: "Go bit by bit: output is 1 only where the two bits differ. 0⊕0=0, 1⊕0=1, 0⊕1=1, 1⊕1=0.",
    learn:
      "<strong>XOR</strong> is the heart of symmetric encryption. The same key both encrypts and decrypts: <code>cipher ⊕ key = plain</code> and <code>plain ⊕ key = cipher</code>. Here 01101000 ⊕ 00001010 = 01100010 = <strong>'b'</strong>. Real stream ciphers XOR data with a long pseudo-random keystream — reusing a key, however, is a fatal mistake that lets attackers recover both messages.",
  },

  /* ---------- FORENSICS: Metadata ---------- */
  {
    id: "meta-1",
    track: "forensics",
    icon: "🖼️",
    title: "Metadata Detective",
    desc: "A photo's hidden data contradicts the suspect's story.",
    brief:
      "A suspect claims a photo was taken in New York on the morning of the breach. You pull the image's EXIF metadata. Find the detail that proves the photo is NOT what they claim.",
    time: 80,
    type: "choice",
    evidence:
      "<span class='k'>File:</span> evidence_photo.jpg\n<span class='k'>Make:</span> Canon\n<span class='k'>DateTimeOriginal:</span> 2026:09:14 23:48:12\n<span class='k'>GPSLatitude:</span>  48.8584 N\n<span class='k'>GPSLongitude:</span> 2.2945 E\n<span class='k'>Software:</span> Adobe Photoshop 2026",
    options: [
      "The GPS coordinates point to Paris, France — not New York.",
      "The camera make is Canon.",
      "The file is a .jpg.",
      "Nothing is suspicious.",
    ],
    answer: 0,
    hint: "Look at the GPS coordinates (48.85 N, 2.29 E) and the timestamp. Where on Earth is that?",
    learn:
      "<strong>EXIF metadata</strong> is embedded by cameras and phones: timestamps, GPS location, device make, and editing software. Those coordinates are the Eiffel Tower in <strong>Paris</strong>, and the time is nearly midnight — contradicting the New York morning claim. The <em>Software: Photoshop</em> tag also hints the image was edited. Investigators routinely use metadata to verify when and where evidence was really created.",
  },

  /* ---------- FORENSICS: Log hunting ---------- */
  {
    id: "logs-1",
    track: "forensics",
    icon: "📜",
    title: "Log Hunter",
    desc: "Spot the malicious login hiding among normal traffic.",
    brief:
      "Here's a slice of an authentication log. One line is a red flag for a brute-force / credential-stuffing attack. Identify the suspicious entry.",
    time: 90,
    type: "choice",
    evidence:
      "<span class='k'>09:01</span> user=alice  ip=10.0.0.5    status=SUCCESS\n<span class='k'>09:03</span> user=bob    ip=10.0.0.9    status=SUCCESS\n<span class='hl'>09:04 user=admin  ip=203.0.113.7 status=FAILED x147</span>\n<span class='k'>09:06</span> user=carol  ip=10.0.0.4    status=SUCCESS\n<span class='k'>09:09</span> user=dave   ip=10.0.0.8    status=SUCCESS",
    options: [
      "09:04 — 147 FAILED logins for 'admin' from an external IP.",
      "09:01 — alice logged in successfully.",
      "09:06 — carol logged in from an internal IP.",
      "09:09 — dave logged in at 09:09.",
    ],
    answer: 0,
    hint: "Normal users succeed once. What does 147 consecutive FAILED attempts on the 'admin' account suggest?",
    learn:
      "A burst of <strong>failed logins</strong> against a privileged account (<code>admin</code>) from an <strong>external IP</strong> is a textbook <strong>brute-force</strong> signature. Defenders detect this with log analysis and set up <em>rate limiting</em>, <em>account lockouts</em>, and <em>alerts</em>. The external IP (203.0.113.x) stands out against the internal 10.0.0.x range — context is everything in log forensics.",
  },

  /* ---------- FORENSICS: Hashing / integrity ---------- */
  {
    id: "hash-1",
    track: "forensics",
    icon: "#️⃣",
    title: "Hash Match",
    desc: "Prove whether a downloaded file was tampered with.",
    brief:
      "A vendor publishes the official SHA-256 hash of their installer. You compute the hash of the file a user actually downloaded. Compare them: was the file tampered with?",
    time: 70,
    type: "choice",
    evidence:
      "<span class='k'>Official  :</span> 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08\n<span class='k'>Downloaded:</span> 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    options: [
      "Hashes match → the file is intact and NOT tampered with.",
      "Hashes differ → the file was modified.",
      "You can't tell from a hash.",
      "The file is encrypted.",
    ],
    answer: 0,
    hint: "Compare the two strings character by character. A single changed bit would completely change the hash.",
    learn:
      "A <strong>cryptographic hash</strong> (like SHA-256) is a fixed-length fingerprint of a file. Change even one bit and the hash changes drastically (the <em>avalanche effect</em>). Here the hashes are <strong>identical</strong>, so the download matches the original — integrity verified. This is how you confirm software hasn't been swapped with malware. Hashes verify <em>integrity</em>, not secrecy.",
  },

  /* ---------- FORENSICS: Deleted file / hex carving (concept) ---------- */
  {
    id: "carve-1",
    track: "forensics",
    icon: "🧩",
    title: "File Carver",
    desc: "Identify a file type from its magic-number header.",
    brief:
      "During recovery of a 'deleted' file, you read its first bytes in hex. Files start with a signature called a MAGIC NUMBER that reveals the true type — even if the extension was changed. What is this file really?",
    time: 80,
    type: "choice",
    evidence:
      "<span class='k'>Filename:</span> secret.txt\n<span class='k'>First bytes (hex):</span> <span class='hl'>FF D8 FF E0</span> 00 10 4A 46 49 46\n<span class='k'>As ASCII:</span> ....JFIF",
    options: [
      "A JPEG image (FF D8 FF is the JPEG magic number) renamed to .txt.",
      "A plain text file, exactly as named.",
      "A ZIP archive (PK header).",
      "A PDF document (%PDF header).",
    ],
    answer: 0,
    hint: "The extension says .txt, but 'FF D8 FF' and the 'JFIF' tag are the fingerprint of one specific image format.",
    learn:
      "Every file type has a <strong>magic number</strong> — bytes at the start that identify it regardless of extension. <code>FF D8 FF</code> = <strong>JPEG</strong>, <code>25 50 44 46</code> (%PDF) = PDF, <code>50 4B</code> (PK) = ZIP. Forensic tools use these signatures to <em>carve</em> real files out of raw disk data and to catch files disguised with fake extensions — a common trick for hiding malware or stolen data.",
  },

  /* ---------- CRYPTO: ROT13 ---------- */
  {
    id: "rot13-1",
    track: "crypto",
    icon: "🔁",
    title: "ROT13 Reflex",
    desc: "Decode the self-inverse cipher used all over the web.",
    brief:
      "ROT13 is a Caesar cipher locked to a shift of 13. Because the alphabet has 26 letters, applying it twice returns the original — it's its own inverse. Decode the tag below.",
    time: 60,
    type: "input",
    evidence: "GUR CNFFJBEQ VF FRPHER",
    answer: "THE PASSWORD IS SECURE",
    hint: "Shift every letter by 13. Running ROT13 on the ciphertext gives plaintext directly.",
    learn:
      "<strong>ROT13</strong> rotates letters by 13. Its party trick — being its own inverse — makes it handy for hiding spoilers or puzzle answers, but it offers <strong>no security</strong>: there's effectively no key. It's a reminder that 'scrambled' text is not the same as 'protected' text.",
  },

  /* ---------- CRYPTO: Vigenère ---------- */
  {
    id: "vigenere-1",
    track: "crypto",
    icon: "🗝️",
    title: "The Vigenère Key",
    desc: "Use a keyword to break a 'polyalphabetic' cipher.",
    brief:
      "The Vigenère cipher shifts each letter by a different amount, cycling through a KEYWORD. Agents recovered the key: KEY. Decrypt the message and type the plaintext.",
    time: 110,
    type: "input",
    evidence:
      "<span class='k'>Ciphertext:</span> WICD ER DLC ZMCB\n<span class='k'>Key:</span> KEY (repeat: K E Y K E ...)\n<span class='hl'>Shift each letter BACK by K=10, E=4, Y=24, repeating.</span>",
    answer: "MEET AT THE PIER",
    hint: "A=0,B=1... K=10, E=4, Y=24. Subtract those shifts in a repeating cycle (skip spaces).",
    learn:
      "The <strong>Vigenère cipher</strong> uses a repeating keyword so the same plaintext letter can map to different ciphertext letters — defeating the simple letter-frequency attack that breaks Caesar. It held the title of 'unbreakable' for ~300 years until the <strong>Kasiski examination</strong> exploited the repeating key length. Key reuse is the recurring villain of cryptography.",
  },

  /* ---------- CRYPTO: Hex decode ---------- */
  {
    id: "hex-1",
    track: "crypto",
    icon: "🔢",
    title: "Hex Whisperer",
    desc: "Read raw bytes the way forensic tools do.",
    brief:
      "Memory dumps and network captures show data as hexadecimal — each pair of hex digits is one byte (one ASCII character). Convert the bytes below to text.",
    time: 70,
    type: "input",
    evidence: "<span class='k'>Hex bytes:</span> 48 65 6c 70",
    answer: "Help",
    hint: "Each pair is a byte: 0x48=72='H', 0x65=101='e'. Convert all four.",
    learn:
      "<strong>Hexadecimal</strong> (base 16) compactly represents bytes — two digits per byte, values 00–FF. Analysts live in hex when reading memory dumps, packet captures, and file headers because it maps cleanly to binary. Knowing that <code>0x48='H'</code> and the ASCII table lets you spot hidden strings instantly.",
  },

  /* ---------- CRYPTO: Binary decode ---------- */
  {
    id: "binary-1",
    track: "crypto",
    icon: "💾",
    title: "Binary Basics",
    desc: "Translate 8-bit bytes into ASCII characters.",
    brief:
      "At the lowest level, everything is bits. Each 8-bit group below is one ASCII character. Decode the two bytes into text.",
    time: 70,
    type: "input",
    evidence: "<span class='k'>Byte 1:</span> 01001000\n<span class='k'>Byte 2:</span> 01001001",
    answer: "HI",
    hint: "01001000 = 64+8 = 72 = 'H'. Convert the second byte the same way.",
    learn:
      "An 8-bit <strong>byte</strong> stores values 0–255. ASCII maps those numbers to characters: 72='H', 73='I'. Reading binary → decimal → ASCII is the foundation under hex, Base64, and every encoding above it. Everything a computer stores is ultimately these 1s and 0s.",
  },

  /* ---------- CRYPTO: Morse ---------- */
  {
    id: "morse-1",
    track: "crypto",
    icon: "📡",
    title: "Signal in the Noise",
    desc: "Decode a Morse code distress signal.",
    brief:
      "A faint radio signal was captured as dots and dashes. Decode the Morse code (letters separated by spaces) and type the message.",
    time: 60,
    type: "input",
    evidence:
      "<span class='k'>Signal:</span> ... --- ...\n<span class='k'>Chart:</span> S=... O=--- A=.- E=. T=-",
    answer: "SOS",
    hint: "Three short, three long, three short — the universal distress call.",
    learn:
      "<strong>Morse code</strong> encodes letters as timed dots and dashes — an early digital transmission scheme. <code>...&nbsp;---&nbsp;...</code> is the famous <strong>SOS</strong> distress signal, chosen for being unmistakable. Signal analysis (turning raw pulses, light, or sound into meaning) is a real part of forensics and SIGINT.",
  },

  /* ---------- FORENSICS: Steganography ---------- */
  {
    id: "stego-1",
    track: "forensics",
    icon: "🫥",
    title: "Hidden in Plain Sight",
    desc: "Uncover a secret concealed inside ordinary data.",
    brief:
      "Steganography hides a message INSIDE innocent-looking data. Investigators extracted the first letter of each line from this 'poem'. Read the hidden acrostic message.",
    time: 90,
    type: "input",
    evidence:
      "<span class='hl'>F</span>og rolls over the quiet bay\n<span class='hl'>L</span>anterns flicker, then fade away\n<span class='hl'>E</span>very shadow holds its breath\n<span class='hl'>E</span>choes drift through empty halls",
    answer: "FLEE",
    hint: "Take the first letter of each line, top to bottom.",
    learn:
      "<strong>Steganography</strong> hides the <em>existence</em> of a message (unlike encryption, which hides its <em>content</em>). Secrets can live in the first letters of lines, in the least-significant bits of image pixels, in whitespace, or in audio spectrograms. Forensic analysts run stego-detection tools because attackers use these channels to exfiltrate data past security tools that only inspect the obvious.",
  },

  /* ---------- FORENSICS: Phishing URL ---------- */
  {
    id: "phish-url-1",
    track: "forensics",
    icon: "🎣",
    title: "The Lookalike Link",
    desc: "Catch a phishing URL disguised as a trusted site.",
    brief:
      "A user received an email urging them to 'verify their account.' Inspect the four links. Which one is a phishing URL impersonating the real bank at example-bank.com?",
    time: 80,
    type: "choice",
    evidence:
      "<span class='k'>Real site:</span> https://example-bank.com\n\n<span class='k'>A)</span> https://example-bank.com/login\n<span class='k'>B)</span> https://example-bank.com.secure-verify.ru/login\n<span class='k'>C)</span> https://support.example-bank.com\n<span class='k'>D)</span> https://example-bank.com/account/settings",
    options: [
      "B — the real domain is 'secure-verify.ru'; 'example-bank.com' is only a subdomain prefix.",
      "A — it goes to a /login page.",
      "C — it uses a 'support' subdomain.",
      "D — it has a long path.",
    ],
    answer: 0,
    hint: "Read each URL right-to-left to the FIRST single slash. The true domain is the last two labels before that slash.",
    learn:
      "The <strong>registered domain</strong> is the part right before the first single <code>/</code> — read right to left, it's the last two labels. In B, that's <code>secure-verify.ru</code>, NOT example-bank.com; the trusted name was demoted to a <em>subdomain</em> to fool you. Legit subdomains (C: <code>support.example-bank.com</code>) keep the real domain at the end. This right-to-left read is the single best habit for spotting phishing links.",
  },

  /* ---------- FORENSICS: SQL injection awareness ---------- */
  {
    id: "sqli-1",
    track: "forensics",
    icon: "💉",
    title: "Injection Detected",
    desc: "Recognize an SQL injection attempt in an access log.",
    brief:
      "A web server log shows the values users typed into a login form. One entry isn't a username at all — it's an attack. Which input is an SQL injection attempt?",
    time: 85,
    type: "choice",
    evidence:
      "<span class='k'>input 1:</span> alice\n<span class='k'>input 2:</span> bob_marley\n<span class='hl'>input 3:</span> <span class='hl'>' OR '1'='1' --</span>\n<span class='k'>input 4:</span> charlie2024",
    options: [
      "input 3 — <code>' OR '1'='1' --</code> breaks out of the query to always return true.",
      "input 1 — 'alice' is too short.",
      "input 2 — it contains an underscore.",
      "input 4 — it ends in numbers.",
    ],
    answer: 0,
    hint: "Which input contains SQL syntax (quotes, OR, a comment '--') instead of a normal name?",
    learn:
      "<strong>SQL injection</strong> happens when user input is pasted directly into a database query. <code>' OR '1'='1' --</code> closes the original string, adds an always-true condition, and comments out the rest — often bypassing login entirely. The fix is <strong>parameterized queries / prepared statements</strong>, which treat input strictly as data, never as code. Recognizing these patterns in logs is key to detecting attacks.",
  },
];

/* -------------------------------------------------------------------------
   Difficulty tags. Keeping these in one map makes it easy to re-balance.
   easy   = short / recognition tasks
   normal = multi-step reasoning
   hard   = heavier decoding / multiple shifting parts
   ------------------------------------------------------------------------- */
const MISSION_DIFFICULTY = {
  // crypto
  "caesar-1": "normal",
  "base64-1": "normal",
  "xor-1": "hard",
  "rot13-1": "easy",
  "vigenere-1": "hard",
  "hex-1": "normal",
  "binary-1": "easy",
  "morse-1": "easy",
  // forensics
  "meta-1": "normal",
  "logs-1": "easy",
  "hash-1": "easy",
  "carve-1": "normal",
  "stego-1": "normal",
  "phish-url-1": "normal",
  "sqli-1": "hard",
};

MISSIONS.forEach((m) => {
  m.difficulty = MISSION_DIFFICULTY[m.id] || "normal";
});

/* -------------------------------------------------------------------------
   BOSS MISSION — a multi-stage finale.
   Unlocked after every regular mission is cleared in campaign mode.
   All stages share ONE timer and ONE set of lives: a wrong answer or a
   timeout ends the whole encounter. Clearing every stage wins the game.

   Boss shape:
   {
     id, boss:true, icon, title, intro,
     time:   total seconds for ALL stages combined
     reward: bonus points added on full clear
     stages: [
       { prompt, evidence?, type:"input"|"choice",
         answer (string | option index), options?, hint?, learn }
     ]
   }
   ------------------------------------------------------------------------- */
const BOSS = {
  id: "boss-final",
  boss: true,
  icon: "💀",
  title: "BOSS: The Zero-Day Heist",
  intro:
    "This is it, Agent. An intruder known only as GLITCH is draining the vault RIGHT NOW. Three locks stand between you and lockout. One shared timer. One slip and GLITCH wins. Decrypt fast.",
  time: 150,
  reward: 1000,
  stages: [
    {
      prompt:
        "LOCK 1 / 3 — The access note is Caesar-shifted by 7. Decode it and type the plaintext.",
      evidence: "<span class='k'>Cipher (shift 7):</span> AOL RLF PZ OPKKLU",
      type: "input",
      answer: "THE KEY IS HIDDEN",
      hint: "Shift every letter BACK by 7.",
      learn:
        "Even chained with other steps, a Caesar shift falls instantly to brute force — layering weak ciphers doesn't create a strong one.",
    },
    {
      prompt:
        "LOCK 2 / 3 — The key's hiding place is Base64-encoded. Decode it to reveal the one-word location.",
      evidence: "<span class='k'>Base64:</span> ZmlyZXdhbGw=",
      type: "input",
      answer: "firewall",
      hint: "Base64 → plain text, no key needed. It's a single lowercase word.",
      learn:
        "Base64 is encoding, not encryption — attackers lean on it to smuggle data, and defenders learn to spot and reverse it on sight.",
    },
    {
      prompt:
        "LOCK 3 / 3 — The final override command is in hex. Convert the bytes to ASCII and type the word.",
      evidence: "<span class='k'>Hex:</span> 61 63 63 65 73 73",
      type: "input",
      answer: "access",
      hint: "Each pair is one byte: 0x61='a'. Convert all six.",
      learn:
        "Reading hex → ASCII is the last-mile skill of forensics: memory, packets, and payloads all surrender their secrets one byte at a time.",
    },
  ],
};


