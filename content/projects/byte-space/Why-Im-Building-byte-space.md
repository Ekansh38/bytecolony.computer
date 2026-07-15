---
title: "Why I'm Building Byte-space"
project: "byte-space"
date: 2026-03-11
status: "complete"
weight: 1
---

I am building byte-space, or have finished by the time you are reading this article. This article explains what byte-space is, why I want to build it, and what sparked the idea. Hope you enjoy the read!

## What is byte-space?

byte-space (all lowercase) is an internet simulator that boasts some pretty cool features. I think the most interesting and fun part about byte-space compared to other network simulators is that you can actually interact with the network like a user. Telnet onto machines, send email and do "userly" activities. ACTUALLY USE IT! That is what I find fun about it. Being able to transport myself into a 1980s academic network that I build, or a military one... "Playing" with others in the same network or geeking around alone (with others is more fun, if you have nerdy friends).

## The technical side

I also really like this idea from a technical perspective. I get to write, from scratch the parts of an OS I find interesting and get to simulate OS functionality to a pretty deep level, none of the hardware type stuff but a lot of cool things like:

- Writing my own filesystem from scratch called **BS-EXTFS** (Bull-shit extended file system)
- Learning binary serialization
- How actual kernel internals work, file descriptors, TTY's
- **TCP/IP and networking** at a very deep level, from ARP all the way up to routing protocols like RIP, with real packet structures and TTLs and routing decisions between nodes

lot of juicy stuff that super ambitious.

## Features

That is what I find cool about byte-space. You are **INSIDE** the simulation not just observing it. That is the core feature of byte-space but of course it has other cool features. Some of them include (skip this list if you don't care):

- **A whole interpreted programming language themed to the era and project:** yep, this is for configuring and building cool stuff on servers, like for building a chat room server or BBS. Or heck a 1980s style X (Twitter) clone. Anything (almost) is possible with this language.
- **The visualizer:** you can observe the network topology in a graph format and see packets travel between machines. You can click on packets to open them mid flight and inspect the data. Networking in 4k.
- **Custom protocol implementations:** HTTP, SMTP, DNS, all from scratch.
- **Hacking:** arp poisoning, DNS spoofing, honeypots, no encryption... no consequences, real networking.
- **A custom text based markup language and website browsing:** I am aware other text-based markup languages exist, but making my own sounded interesting, and fun so... here we are.
- **Emails:** emails, I don't need to explain that...
- **1980s vibes:** telnet, server profiles, browsing simple websites, hacking, The Cuckoo's Egg vibes. I don't really consider this a feature but it's there.

## Why build it?

Now onto why I want to build it (not vibe-code, build). Building byte-space teaches me how the internet actually works, not from textbooks, but by implementing it all from scratch. I'll understand the INTERNET to a level most developers never reach. Plus, it's fun. Building complex systems is what I enjoy most.

## What sparked the idea?

*The Cuckoo's Egg* by Clifford Stoll. This book is the sole reason for me building byte-space. **The 1980s internet was so cool and I had to have it.**

## Could AI build byte-space?

Maybe. (edit: Not really... the original plan AI suggested to me towards the start of the project crashed and burned, safe to say it would need a lot of help). But I'll learn more building it myself, build stronger foundations for larger projects that AI can't do and its kinda fun. Check out [My Thoughts on AI in CS](/writing/ai-and-the-13-year-old-engineer) for my full take on AI in computer science.

---

Anyway, hope you understand why I find this idea so interesting and check out the other articles. Everything from this point forward will get more nerdy and technical so buckle up and enjoy the ride!
