---
title: "The CPU: A very tall pile of simple"
date: 2026-07-31
draft: true
---


THE SEAM CHAIN (locked at plan level, refine wording while drafting):
- Intro -> the house: before building anything, give the reader the SHAPE of the machine (the jobs it
  has to do). Map first, then the bottom-up climb.
- House -> relays: every one of those jobs needs someone who can read, count, remember, and decide.
  Your computer does all four and has none of those things. Nobody is home. So what IS in there?
  Everything hinges on one weird object: a switch that flips itself.
- Relays/gates -> binary: our circuits can decide yes/no, but computers do numbers. With only
  on/off, where do numbers even come from? The seam here being like, so what, we have gates but so
  what.

- Binary -> adder: we can WRITE numbers with switches, but writing isn't computing. Can dumb
  switches actually do math?
- Adder -> flip-flops: hold 2 and 3 on the adder's inputs and you get 5; let go and it's gone. Every
  circuit so far has no past, output only depends on current inputs. How do you build a circuit
  whose output depends on what happened BEFORE? (answer: feed a gate's output back into itself)
- RAM/registers -> clock: we can compute and store, but nothing says WHEN to grab a value vs hold
  it. A pile of parts with no beat. What sequences it?
- Clock/PC -> instructions: the PC counts through memory addresses, but what's AT those addresses?
  What is the machine fetching?
- Instructions -> decoder: an instruction is a number, but a number can't pull a switch by itself.
  How do opcode bits physically become control signals?
- Decoder -> fetch-decode-execute: every part exists now. Watch one heartbeat.
- FDE -> I/O: the machine computes in the dark. How does your keypress get in, and pixels get out?
- I/O -> assembly: nobody writes bit patterns by hand. (anticlimax, on purpose)
- Ending: trace the tower down.

SECTION SHAPE for hard concepts: need -> mechanism -> immediate use -> scale-up.
- Need: create the problem first, in terms the reader already owns. Example: an adder is live; if
  its output feeds back into its input, it races. We need old value and next value separated.
- Mechanism: show the physical trick. Example: feedback gives a flip-flop two stable states; a load
  signal lets it catch a bit.
- Immediate use: use it right away. Example: 8 flip-flops make a register; the register holds old A
  while the adder computes next A, then catches the result on a tick.
- Scale-up: only then generalize. Example: many storage cells, selected by address wires and write
  signals, become RAM.

STRUCTURAL DECISION (the differentiator vs Code): give the reader the SHAPE of the machine before
building it bottom-up. Petzold promises the destination but withholds the shape, which works in a book
you paid for and bleeds readers in a browser tab. Readers who stall out are holding a pile of
disconnected gates with no idea what they are for. Keep Petzold's promise AND his ending (last section
recontextualizes everything), drop the withholding. The map also gives the reader somewhere to file
each new piece: when a flip-flop shows up, "that's the remembering job" is a hook to hang it on.

PER-SECTION ENGINE: global curiosity gets someone to start, not to minute 18. Every section runs the
same small shape: name a job that obviously requires a brain -> show it cannot possibly be done by
wires -> do it with wires. ("How does anything remember? How does anything pick between two options?
How does anything know what comes next?")
- Kill one job early: gates -> half adder -> full adder -> 4-bit adder is reachable fast, and when it
  works the arithmetic job is provably gone. Make that an explicit celebration: nothing replaced it
  but wires.
- Visible progress artifact: reprint the house diagram at each milestone with finished jobs crossed
  off and replaced by circuitry. Cheap to draw, does most of the pacing work.
- The electricity/gates sections need their own hook, not borrowed tension: how can something with no
  brain answer a question at all? If that section reads like six gates and their truth tables, it is
  dead on arrival.


## Writing

### The CPU: A very tall pile of simple

You can hear the phrase

"computers think in 1s and 0s"

a hundred times and still not understand how a computer actually works. It sounds like an explanation,
but by itself it explains basically nothing. Sure, a wire can be high or low, a light can be on or
off, and a switch can be open or closed. But how does that become addition?

How does that become memory?

How does that become a program sitting in RAM, one instruction after another, telling a machine what
to do?

If you are familiar with programming, you know what `x += 1` does, but it might still be confusing
what actually happens under the hood. Some circuit fires, some values move, some data gets saved.
But that connection is foggy for a lot of people and it certainly was for me.

A lot of explanations either stay so high-level that the CPU remains a black box or are book length
and full of interesting detail, but not approachable if you want the mental models without drowning
in technical detail.

This article is going to follow one simple CPU and fill it in piece by piece, starting from the
simplest building blocks and showing why each part has to exist.

This is not just for programmers. Most of your life probably runs on computers, and there is
something satisfying about understanding how a critical part of everyday life works.

The key point is that nothing here is smart in isolation. A CPU is not one hard idea. It is a
very tall pile of simple ones that I am going to build up from the simplest possible idea.

(Full simple CPU drawing: a few labeled boxes, data bus, address bus, and some control wires)

We are going to try to understand this simple CPU. Not a modern CPU. We are NOT going into caches,
pipelining, branch prediction, out of order operations, operating systems, GPUs, or all the other
interesting machinery that makes your laptop fast or "good". (at least not in this article)

Right now this diagram of a CPU might look like a bunch of random lines and labels with words of no
meaning, but by the end of this article you should be able to point to where instructions come from,
where computation happens, where data gets saved, and most importantly, have the mental model for
how these circuits work, from literal wires up to logic gates and then to a CPU.

(TODO: add more or make the things we aren't doing in order of real life
importance)


### The House

Lets start with a high-level overview of how the CPU functions, so we have a goal to work towards.

Imagine your computer is a house.

![simple house drawing](/images/house.svg)

Inside this house is one stupid but surprisingly pedantic worker. His name is Otto.

> [!NOTE] For this article, assume one worker doing one thing at a time. Real CPUs use pipelining
> and branch prediction to do multiple things at once. These are optimization techniques and do not
> affect the invariants of how a CPU functions.

Inside this house we have our downstairs desk where we do all the serious work. On the desk is a
little abacus for basic mathematical operations. Also on the desk are three separate drawers
with little pieces of paper storing some value, such as the number "10". 

The last thing we have on the desk is our chart.

(show desk diagram with drawers labeled PC, A, B and chart and abacus)

This is our decoder chart. It maps numbers to operations, so when we get a new instruction
(we'll get there), we look at the corresponding digits to figure out what to do.

For our simple house analogy, an instruction can either perform some mathematical operation on the
abacus, or move a number to or from any storage location (I'll explain soon).

One quick distinction before we start: when I say "drawer," I mean the desk drawers right next to
Otto where he works. When I say "slot," I mean the numbered compartments in the upstairs filing
cabinet.

Upstairs we have our filing cabinet room. It doesn't have an AC and can get really hot (it's much
cheaper without the AC). The cabinet has slots labeled 0, 1, 2, 3, all the way up to 255. Each
slot holds one piece of paper with a number written on it. Want the value at address 42? Open
slot 42 and read the paper inside.

(filing cabinet drawing)

Most of these slots are boring and filled with paper. But slot 254 is special, it's not a slot at
all. It's a little window to the outside world. When Otto puts a number there, it doesn't get
written on paper. It shows up on a display. Put 0 there and it glows "0". Put 7 there and it glows
"7". Otto can read, write and interact with it just as if it were any cabinet slot.

Slot 255 works the opposite way. It's connected to a dial or switches outside the house. Otto
reads from it like any other slot, but the value comes from whoever is turning the dial. He could
technically write to slot 255 too, but that would be a bit disruptive.


Okay now that we have the setup, let's go through running a simple program on our "computer". Here
is the program in plain English:

```
10: Put 0 in drawer A
12: Copy A to slot 254 (the display)
14: Add value from slot 255 to A (the dial)
15: Jump back to line 12
```

Set the input dial to 1 and the display counts 0, 1, 2, 3, 4... Set it to 5 and it counts in fives,
0, 5, 10, 15... Otto reads the input, adds it to his running total, shows you the result, and
loops. A relatively simple program.

> [!NOTE] In a real computer, this loop would run millions of times per second causing the display
> to be nothing but a blur. A real program would need some kind of "wait" or "sleep" instruction.
> Otto is slow enough that we can watch him count.

You might have noticed the odd-looking numbers before each instruction. These are the addresses of
where each instruction is stored, basically what slot they're in. But why do they jump around?
(like from 10 to 12)

```
10: LOAD  A
11: #0

12: STORE A 
13: 254

14: ADD 255

15: JUMP 12 
```

Each slot can only hold so much information. Some instructions need a number as part of the
instruction, so they spill into the next slot. We'll come back to how this works exactly when we run
through the program and it should click by then.



later say how ink can leak like rowhammer.





## Plan

### intro


Intro goal:
- Target reader: curious normal person or coder (working at a higher level, websites/apps/etc.) who
  never understood how a CPU really works or got a chance to form that mental model.

- Base knowledge assumed: they know what a switch/light/wire is, maybe have written a little code.
  No electronics, assembly, or computer architecture assumed.

- Hook strategy: start from a familiar fact that feels hollow. "Computers are 1s and 0s" is true but
  unsatisfying. The gap is: how does on/off become a machine that adds, stores, follows instructions,
  and shows output?

- Promise: show a tiny CPU drawing early, then progressively reveal it. By the end, the reader should
  be able to trace a simple program through the machine without hand-waving.

### 0. The House (the map) - goes after the hook, before electricity

~600-800 words, 3 diagrams, 3-4 min read.

Setting: a house. Downstairs: a desk with several small drawers, an abacus. Upstairs: a filing cabinet
with labeled drawers (A, B, C...). ONE worker, one instruction at a time.

Beat 1, set the scene: "Let's imagine your computer is this house. Let's figure out how it works and
what steps it needs to take." One worker, several rooms, a lot of paper. Plain, slightly deadpan.

Beat 2, the parts: explain what's in the house and what each thing does. Downstairs desk with drawers
(registers — several, each holding one number). An abacus on the desk (arithmetic). Upstairs filing
cabinet with labeled drawers (RAM — address is the label, value is the paper inside). One worker.

Beat 3, the loop: walk through one instruction's execution. Incrementing the register (which drawer
the worker is pointing to), grabbing the next instruction from the filing cabinet, decoding it,
executing, writing back to memory. One concrete example instruction traced through the cycle. Diagram
showing the loop as a cycle, not an assembly line.

Beat 4, distance: the filing cabinet isn't on the desk — there's a walk involved. Add texture that
seems like storytelling (stairs, walking to the cabinet) but is actually setting up timing ratios.
Experienced readers will recognize the latency hierarchy immediately; non-experienced readers will
clock it later when we talk about registers vs RAM. The ratio should feel big because it is.

Beat 5, the turn: punchline — every one of those jobs needs someone who can read, count, remember,
and decide. Your computer does all four. It has none of those things. Close on: nobody is home, just
switches wired so that the behaviour of a worker comes out the other end. Write this line LAST.

Diagrams (3):
1. The house with parts labelled (desk, drawers, abacus, upstairs cabinet, worker).
2. The loop: fetch → decode → execute → store → increment → repeat. Arrows in a cycle.
3. Distance: desk / upstairs cabinet, with rough sense of the walk involved.

Diagrams don't need to be polished. "Random fun quirky diagrams" are fine — reader is here for the
ideas, not the art. The house should feel like a sketch, not a blueprint.

Transition out: "We know what the house has to do. Now we start with the only thing we're allowed to
use: a wire and a switch."

---

### 0. Circuits and Electricity

- goal is to not go too much into physics, just basics of how electricity flows enough for the
  purposes for the cpu.






### 1. Switches, relays, logic gates Basic electricity and circuits, just enough. Logic gates built
from electromagnetic relays: fully real hardware (Z3, Harvard Mark I), switching action visible and
drawable. One paragraph at the end: transistors do the same job with no moving parts, way smaller
and faster; link out for modern transistor-based gates. Simple boolean algebra (very short, taught
where the gates need it), then build a few basic circuits from the gates.

[link out for
transistors](https://www.electronics-tutorials.ws/logic/logic-gates-using-transistors.html)
 
### 2. Binary The binary number system explained properly. 2's complement as a brief taste, link
out. ASCII/Unicode as one short paragraph: numbers can represent letters, audio, video, everything.
Pays off later in the I/O section.

### 3. The adder and the ALU Half adder gate by gate, truth table next to the circuit: slow-down
point #1 of the essay. Chain into full adders for multi-bit addition. ALU briefly: the adder plus
friends behind a selector. One extra output: a zero flag, a single NOR of all result bits, high only
when the answer is 0. Plant it here in one sentence; it pays off at jump-if-zero. Map to subtraction
and multiplication with an image or two, then link out; don't linger.

Now end this section with the idea of an accumulator, how it works in theory and why it's needed.
(to sum multiple numbers)

Then leave them with the issue, its not possible to make one with our current knowledge.

### 4. Memory: flip-flops, RAM, registers

Start with teaching flip-flops from gates as the "solution" to the accumulator problem, explain them
and then fit it in and show the accumulator working.

NOTES ON CODE:

- Petzold introduces the idea of "feedback" and oscillation via the buzzer. 

- I guess how can I do it and how Petzold then does it later is just jump straight to the logic gate
  diagram of a not gate, since in a previous sections we looked at how to make a not gate out of
  relays. We earn that abstraction.

Then

Start from the programmer-facing idea of RAM: a big numbered shelf of bytes. Give it an address,
read the value there; give it an address plus a new value, write over it. Then reveal that this is
not a new kind of magic, just the catch-and-hold trick scaled up.

Feed a gate's output back into its own input: the first circuit whose output depends on the past.
Show them some beautiful SRAM and don't teach them about the horrors of DRAM. Flip-flop, then a
proper RAM cell with a write signal, then the same cell scaled up into a grid: address wires choose
which cell/row is being talked to, data wires carry the value, write/read signals decide whether the
cell catches a new value or exposes the old one. Registers fall out for free: the same flip-flops
sitting next to the ALU.

Section 4 concrete teaching plan:
- Start with the accumulator problem: if the adder output feeds straight back into its input, it
  races. We need old value and next value separated.
- Introduce the core mechanism: feedback creates a circuit with two stable states.
- Add the practical control: a load/write signal decides when the bit is allowed to change.
- Use it immediately: 8 flip-flops sharing a load signal make a register that can hold an 8-bit
  number while the ALU computes.
- Scale up to RAM: many storage cells in a grid, address wires select the cell/row, data wires carry
  the value, write/read signals control storing vs exposing.
- Tie back to the CPU diagram: registers are small, fast storage near the ALU; RAM is the larger
  numbered shelf the program and data live in.

Then I will later apply the concept of feedback for the clock.

### 5. The clock A signal ticking on/off; on each tick registers grab their new values. One tick =
one step. Short. Gate by gate explanation.

### 6. The program counter A register wired to an adder that adds 1 to itself every tick. Reader
already knows both parts, I am just composing them. It counts 0, 1, 2... and those are addresses in
memory.

### 7. Instructions are numbers The big click of this section: an instruction is a bit pattern,
opcode bits say what, operand bits say with which, and it lives in the same RAM as data.
Stored-program idea, slow beat here.

### 8. The instruction decoder Opcode bits in, control signals out. Make control signals concrete:
each is one wire to one enable input, with a dumb name and a dumb job (RegA_load = grab the bus,
RegA_out = drive the bus, ALU_out, ALU_subtract, RAM_write, RAM_out, PC_increment, PC_load,
IR_load). ~A dozen wires total; an instruction is just a recipe for which wires go high. Draw a real
fragment: a few AND gates matching opcode 0010, output feeding RegA_load, with the relay visuals.
One honest sentence: the signals fire in a couple of clocked steps (fetch first, then execute), full
micro-sequencing is a link-out (Ben Eater's control logic). Link back to the start: gates deciding
things again, just MANY MANY of them. Mental model: player piano. Instruction = punched holes,
control wires = keys.

### 9. Plumbing: buses and the address decoder Two buses: the data bus (shared wires carrying the
value) and the address bus (wires saying which cell/device is being talked to). Control signals
decide who talks when. One paragraph, no MUX internals, link out. The instruction register gets one
sentence inside fetch (where the fetched instruction sits while the decoder reads it), not a
section. The address decoder: gates that look at the address bits and raise exactly one "you're
selected" line. Addresses 0-200 enable RAM, address 255 enables the output register. This is what
makes memory-mapped I/O work later: output is just a store whose address lands on a device instead
of RAM.

### 10. Fetch-decode-execute Assemble the loop. Tick: PC's address goes to memory, instruction comes
out (fetch), decoder turns bits into control signals (decode), ALU/registers do the thing and PC
increments (execute). Trace ONE instruction through a full cycle with drawings. Slow-down point #2,
same budget as the half adder.

### 11. Basic I/O, two stages Stage 1, honest basic output. There is exactly ONE output register
(the thing at address 255); the display has no register of its own, it is just wired to that
register's output bits. Rung one: a lamp per bit, the answer glows in binary (real machines shipped
like this: Altair 8800 front panels). Rung two: the same register's bits feed a seven-segment
decoder, just gates again, that continuously translates 4 bits into the on/off pattern of 7 lamps
arranged as a digit. No clock, purely combinational: the display always shows whatever the output
register currently holds, until the next store overwrites it. Full signal path to draw: instruction
-> instruction decoder raises control signals -> value rides the data bus -> address decoder selects
the output register -> register latches -> its bits are wires driving the lamps / 7-seg decoder.
Third decoder of the essay (instruction, address, 7-seg), all the same trick: bits in, one-of-many
lines out. Reader should say "it's just gates again" before I do. Input side stays manual:
front-panel switches to pick a RAM address and value.

Stage 2, the modern taste (slightly past scope on purpose). A screen is the same idea as the lamps,
just WAY more of them (pixels). Memory-mapped: a framebuffer, a region of memory where each number
is a pixel's color; display hardware sweeps through it many times a second. Keyboard: keys are a
grid of switches (back to switches!), a controller scans the grid, a keypress becomes a number
(scancode) written to an address the CPU can read. Show a letter go key -> number -> memory ->
framebuffer pixels. Then link out (interrupts, GPUs, device drivers are the rabbit holes).

### 12. Assembly Framed as an anticlimax: just human-readable names for bit patterns, ADD instead of
0010, an assembler is a find-and-replace. Show a 3-4 line program next to its binary. One line on
jumps: a jump just writes into the PC, and that's how loops exist. Half a line more: jump-if-zero
(the ALU's zero flag wire from section 3, finally used), and that's how if-statements exist. HLT
gets one line: a control signal that stops the clock, so programs can end. Close with a short bit on
how higher-level languages sit on top.

### 13. Ending Trace the tower back down in one paragraph. Program, instructions, decoder, gates,
relays, a switch. Nothing on the way down was hard. It was just tall.

Scheduled payoff: reprint diagram 1 (the house) with every job replaced by circuitry. Line to land:
nothing was added to that first picture except detail.

## Research shelf (capped: ~1 week, notes go into the plan sections above)

Core review (details sharpness):
- Code ch. 17-24 reread: the fuzzy zone only (flip-flops -> clock -> RAM -> ALU -> registers/buses
  -> control signals -> jumps).
- Ben Eater 8-bit CPU series (eater.net/8bit): watch the bus/registers videos and especially the
  control logic + microcode arc. Physical control wires going high on LEDs; exactly my section 8
  gap.

Same-mission explainers (study pacing, engagement, compression; how do THEY hold the reader):
- "But How Do It Know" (J. Clark Scott): the closest book to my thesis, tiny and friendly, whole
  Scott CPU in ~200 pages. Skim for compression choices: what he cuts vs what Petzold keeps.
- Sebastian Lague, "Exploring How Computers Work" + logic sim videos: gates -> ALU visually, superb
  pacing and visual language for the drawings.
- Core Dumped (YouTube): CPU/memory explainers with animated internals; study how he keeps grip on
  abstract material.
- microCeption (jsgonsette.github.io/microception): interactive simplified CPU, step through
  fetch-decode-execute in browser. Reference for what interactivity gives that prose must replace.

## Style / voice notes

- Be a tour guide, not a textbook. Walk the reader through the machine, point at the load-bearing
  tricks, explain why each part exists, then move before the section becomes a spec dump.
- The "tell my mum" test is the success condition for every section: simple enough for her to follow,
  not dumbed down, true, and underwritten by understanding I have but do not fully expose.
- No visual hook = the section is not ready. If I cannot work out how to draw it, the fix is more
  reduction, not more words.
- Two different kinds of cost: some work costs HOURS (the filesystem, grinding), some costs
  DISTILLATION (this article - the hard part is getting the idea clean enough to be worth saying).
  Do not brute-force the second kind and then feel bad when hours don't move it.
- The beginner's model and the expert's model are often the SAME object (Godbolt still uses the
  Usborne cartoon robots for out-of-order execution). A good explanation is not a watered-down real
  model; it frequently is the real model. So the article I can write now, with the understanding I
  actually have, is legitimate.
- Use precise vocabulary, but don't flex randomly. Terms like "Von Neumann architecture," "control
  signal," "data bus," "address bus," "combinational," and "sequential" are useful when they name a
  real idea the reader is already touching. Define them in context, then keep moving.
- A little "deep vocabulary" is good because it signals that this is a real field, not a toy
  analogy. But every term must pay rent: it should either sharpen the mental model or help the
  reader search deeper later.
- Use diagrams to carry complexity. Especially distinguish data paths from control paths visually:
  data/value wires carry numbers, control wires tell parts when to load, output, add, write, or
  increment.
- Add a few tiny reality-check callouts, not many. Good callouts: relay vs transistor, registers vs
  RAM, simple CPU vs modern CPUs. Bad callouts: anything that drags into caches, pipelines, GPUs,
  interrupts, or OS internals before the reader has finished the tiny CPU.
- Frame components as solutions to concrete frustrations: the adder races, so we need registers; RAM
  is big, so we need addresses; an instruction is only a number, so we need a decoder; output is
  invisible, so we need lamps / display hardware.
- Voice target: "I just climbed this tower. Here is the exact path up." Direct, curious, slightly
  opinionated, but never pretending the simple model is the whole modern reality.



## stuff todo


write the intro and section 1.

take notes of chap 17, skim chap 18, read chap 19, take notes. Read but how do it know.

so do some concrete writing/working and then some planning/reading/note taking.

## Next 2-hour work block

Learn about circuits and electricity

Take notes/draft text and diagrams.










## Intro Testing

> “Read this intro. Don’t be nice. I want to know if you would keep reading and where your attention drops.”

1. **Would you keep reading?**  
   Force yes/no. If they say “maybe,” ask: “If this were a random article online, would you continue?”

2. **What do you think the article is promising to explain?**  
   You’re checking whether the contract is clear. Good answer: “how 1s and 0s become a CPU/program.” Bad answer: “computer history” or “coding basics.”

3. **Where did your attention dip?**  
   Make them point to a sentence/paragraph. Don’t accept “it was good.”

4. **What question are you expecting the next sections to answer? or what questions do you have**  
   Good answer: “how switches/wires become logic” or “how on/off does anything useful.” If they don’t have a next-question, your seam is weak.

5. **Circle any words that feel too technical or too childish.**  
   This catches both ends: boring textbook and over-casual.

Who to test on:
- 1 coder friend
- 1 smart non-coder adult/teen
- 1 parent/family member
- Optional: someone who doesn’t care about computers


**Diagram workflow (reference):**

Most diagrams = sequence of still SVGs, embedded in order, no animation

some = an actual gif for continuous motion Gif pipeline: draw frames in Excalidraw → export each as
PNG (not SVG) → stitch on ezgif.com

Every frame/diagram needs a solid dark background (the invert filter flips the whole image;
transparent breaks it) 

Embed everything as plain ![](/images/x.svg) — auto-inverts on light themes for free

Hero photo (if any) is the exception: inline <img class="hero-img">, doesn't invert
SVG stays sharper than gif; gif only for the one loop that needs motion


Types: `[!NOTE]` (clarifications), `[!TIP]` (performance intuition), `[!WARNING]` (tradeoffs). Style with CSS on the site — no custom syntax needed.

