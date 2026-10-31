---
title: "byte-space"
weight: 2
layout: "list"
summary: "Simulated Unix Machines and a Hand-Written Filesystem"
stack: "Go"
status: "active"
github: "https://github.com/Ekansh38/byte-space"
---

byte-space simulates Unix machines that you connect to from a terminal. A server process holds any number of virtual computers, and you open a session on one of them with a client. Inside a session you get a login prompt, a shell, users, permissions, and a filesystem.

The machines are a simulation. There is no hardware, nothing boots, and the processes are Go structs. The filesystem is not a simulation. BS-EXTFS is an ext2-inspired filesystem written from scratch, and every file you make is written as bytes into a 64MB disk.img with a real on-disk format you can open in a hex editor.

Checkout the Github for more information and a demo video!
