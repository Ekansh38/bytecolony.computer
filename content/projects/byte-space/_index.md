---
title: "byte-space"
weight: 1
layout: "list"
summary: "Recreates the early 1980s internet in the terminal (WIP)"
stack: "Go"
status: "active"
github: "https://github.com/Ekansh38/byte-space"
devlog: "https://www.youtube.com/playlist?list=PL0VzTA7jLj1SHQWzZwZ8IUoeMu9LrmBKd"
---

"byte-space" is a terminal-based internet simulator set in the early internet era.

Right now my main focus is BS-EXTFS, my own inode-based hand-rolled filesystem for byte-space. The project is still heavily a work-in-progress. After BS-EXTFS the next phases are networking, and then my own scripting language.

Features will include (hopefully if I get to it):

- browsing text-based websites
- seeing packets travel between machines in real-time
- a custom hand-rolled filesystem with inodes, permissions, and directories
- a custom scripting language for writing programs inside the simulation
- a virtual kernel that implements real Unix-like syscalls (open, read, socket) and a full TCP/IP stack; programs interact with it exactly like they would a real OS

It is a pretty cool project and you should definitely star it on Github.


