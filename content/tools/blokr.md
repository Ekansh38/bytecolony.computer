---
title: "blokr"
weight: 2
summary: "Block distracting sites behind a physical code you keep on paper. macOS only."
stack: "Python"
status: "active"
github: "https://github.com/Ekansh38/blokr"
---

Blocks sites via `/etc/hosts`. To unblock, you have to type a 40-character code from a piece of paper kept somewhere physically inconvenient. No paste allowed. It reads keystrokes one at a time and rejects anything that arrives too fast. Then a 5-minute countdown. Then `yes`. Then `YES SIR YES`.

The code is never stored in plaintext, only its SHA-256 hash. Lose the paper, run setup again, write it down again.

Also includes `blokr watch`: download a YouTube video locally via yt-dlp and watch it without the algorithm, sidebar, or autoplay.
