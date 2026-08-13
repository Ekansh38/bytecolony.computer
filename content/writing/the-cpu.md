---
title: "The CPU: A very tall pile of simple"
date: 2026-07-31
build:
  list: never
  render: always
---

You can hear the phrase

"computers think in 1s and 0s"

a hundred times and still not understand how a computer actually works. It sounds like an explanation, but by itself it explains basically nothing. Sure, a wire can be high or low, a light can be on or off, and a switch can be open or closed. But how does that become addition?

How does that become memory?

How does that become a program sitting in RAM, one instruction after another, telling a machine what to do?

If you are familiar with programming, you know what `x += 1` does, but it might still be confusing what actually happens under the hood. Some circuit fires, some values move, some data gets saved. But that connection is foggy for a lot of people and it certainly was for me.

A lot of explanations either stay so high-level that the CPU remains a black box, or are book length and full of interesting detail but not super approachable.

This article is going to follow one simple CPU and fill it in piece by piece, starting from the simplest building blocks and showing why each part has to exist.

The key point is that nothing here is smart in isolation. A CPU is not one hard idea. It is a very tall pile of simple ones.


(Full simple CPU drawing: a few labeled boxes, data bus, address bus, and some control wires)

<br>

We are going to try to understand this simple CPU. Not a modern CPU. We are NOT going into caches, pipelining, branch prediction, out of order operations, operating systems, GPUs, or all the other machinery that makes your laptop fast or "good". At least not in this article.

Right now this diagram of a CPU might look like a bunch of random lines and labels with words of no meaning, but by the end of this article you should be able to point to where instructions come from, where computation happens, where data gets saved, and then how simple wires can become logic gates and then a CPU.



### The House

Let's start with a high-level overview of how the CPU functions, so we have a goal to work towards.

Imagine your computer is a house.

<a id="diagram-1-1"></a> {{< svg "house" >}}

*Diagram 1.1. The outside of the house.*

<br>

Inside this house is one stupid but surprisingly pedantic worker. His name is Otto. Also he never leaves his house.

> [!NOTE]
> For this article, assume one worker doing one thing at a time. Real CPUs use pipelining,
> branch prediction, and other tricks to keep multiple pieces of work going at once. These are
> optimization techniques and do not affect the invariants of how a CPU functions (at least not much).

<br>

Inside this house we have our downstairs desk where Otto does all the serious work. On the desk are a few things:

- three small drawers that can each hold one number, labeled `A`, `B`, and `PC`
- an abacus for basic arithmetic.
- A decoder chart that does some stuff. We will come back to this later.

<a id="diagram-1-2"></a> {{< svg "desk" >}}

*Diagram 1.2. The desk setup.*

<br>

Keep in mind the decoder table for this analogy is quite small since Otto only needs a few instructions for this program.

Upstairs is the filing cabinet room. The cabinet has slots labeled 0, 1, 2, 3, all the way up to 99. Each slot holds one piece of paper with a two-digit number written on it, from `00` to `99`.

One quick distinction before we start: when I say "drawer," I mean the desk drawers right next to Otto where he works. When I say "slot," I mean the numbered compartments in the upstairs filing cabinet.

<a id="diagram-1-3"></a> {{< svg "cabinet" >}}

*Diagram 1.3. The filing cabinet.*

<br>

Most of these slots are boring and filled with paper. But slot 98 is special. It's a little window to the outside world. When Otto puts a number there, it doesn't get written on paper. It shows up on a display. Put `00` there and it glows `00`. Put `07` there and it glows `07`. Otto can read, write, and interact with it just as if it were any cabinet slot.

Slot 99 works the opposite way. It's connected to a dial outside the house. Otto reads from it like any other slot, but the value comes from whoever is turning the dial. He could technically write to slot 99 too, but that would be a bit disruptive.

(See [Diagram 1.1](#diagram-1-1) for a recap of how these elements look from the outside of the house.)

<br>

Okay, now that we have the setup, let's make Otto do something. Here is the program in plain English:

<a id="otto-program-english"></a>

Here, A and B refer to the desk drawers.

```
10: Put 0 in drawer A
12: Copy A to slot 98 (the display)
14: Copy the value from slot 99 (the dial) into drawer B
16: If B is 0, jump to line 21
18: Add B to A
19: Jump back to line 12

21: Put 0 in drawer A
23: Copy A to slot 98 (the display)
25: Jump back to line 14
```

<br>

Take a minute to guess what this program does before I reveal it.

Set the input dial to 1 and the display counts 0, 1, 2, 3, 4... Set it to 5 and it counts in fives. Set it to 0 and the display resets to 0. Otto reads the input, either adds it to his running total or clears the total, shows you the result, and loops.

> [!NOTE]
> In a real computer, this loop would run millions of times per second, so the display would
> be nothing but a blur. A real program would need some kind of "wait" or "sleep" instruction, maybe
> using a timer. Otto is slow enough that we can watch him count. Also, since this toy machine only
> stores two-digit unsigned numbers (unsigned meaning not negative), counting past 99 wraps around
> to 00. This will make more sense after we get into the mechanics of binary counting later on.

<br>

You might have noticed the odd-looking numbers before each instruction. These are addresses. They tell us which cabinet slot each instruction lives in.

In this CPU, the program itself is stored in the upstairs cabinet too, right next to ordinary data. But why do the addresses jump around? Why do some parts of the program go from 10 to 12 and some from 18 to 19?

> [!NOTE]
> This style of CPU where the instructions and data live in the same memory is known
> as a Von Neumann architecture.

To understand these jumps, let's first look at the program in a more broken-down form.

<a id="otto-program-broken-down"></a>

```
10: LOAD A
11: 00

12: STORE A
13: [98]

14: LOAD B
15: [99]

16: JUMP-IF-ZERO B
17: 21

18: ADD A, B

19: JUMP
20: 12

21: LOAD A
22: 00

23: STORE A
24: [98]

25: JUMP
26: 14
```

This is how the program would actually look sitting in those cabinet slots upstairs. If you get lost during the trace, come back to this picture:

<a id="diagram-1-4"></a> {{< svg "program-in-cabinet" >}}

Diagram 1.4. The same program but as raw cabinet contents. The top number in red is the cabinet slot's address; the bottom number in yellow is the value stored there. Values below 10 are written with a leading zero, so `01` means the number 1. Each slot still only holds a number. Otto uses [the decoder chart on his desk](#diagram-1-2) to interpret numbers like `01`, `05`, and `13` as instructions.

<br>

Quick notation note:
- `A` and `B` are Otto's desk drawers.
- Brackets mean "go to that cabinet slot." So `[98]` means slot 98, not the number 98.
- Plain numbers are just numbers. In `LOAD A, 00`, the `00` is the raw two-digit value in the next cabinet slot, so the value `0` gets put into drawer A. In `JUMP 21`, the `21` tells Otto which cabinet slot to run next.
- I'll use two digits for raw cabinet contents and the physical two-digit display, but normal numbers for values in arithmetic, tables, and prose.

If this feels like a lot, that's fine. This is only the high level overview. The rest of the article dives into all of this properly.

Now back to the reason for the jumps. Each cabinet slot can only hold one two-digit number from `00` to `99`. That means some instructions fit in one slot, while others spill into the next slot.

Small fixed choices, like `A` and `B`, can be encoded into the instruction itself because there are only a few drawers. But bigger flexible values, like `0`, `[98]`, or the jump target `21`, need their own slot. (See [Otto's decoder chart](#diagram-1-2) to make sense of this better)

So `ADD A, B` fits in one slot. But `LOAD A, 0` takes two: one slot for the `LOAD A` instruction, and one slot for the actual value `0`.

For now, the important point is simple: instructions are stored in numbered slots too, and some instructions need more than one slot. Now let's execute this program with Otto.

<br>

Setup: drawer `PC`, which stands for program counter, starts at `10`, because `10` is the address of the first instruction in [the program](#otto-program-broken-down).

The program is [already loaded](#diagram-1-4) into the upstairs cabinet. Drawers `A` and `B` may contain old garbage values from whatever ran before.

Because Otto has bad memory, he carries two scraps of paper. The address slip holds the slot he wants to look at. The value slip holds the value he reads from that slot.

The input dial is set to `2`, because we want to count in twos for this example: 0, 2, 4, 6, 8...

<a id="diagram-1-5"></a> {{< svg "loop" >}}

Diagram 1.5. Otto's basic loop. He copies `PC` onto the address slip, fetches the value from that cabinet slot, uses the decoder chart to choose a procedure, follows it, and then repeats from the new `PC`.

This is the basic loop Otto follows, so let's trace it through.

<br>

Otto opens the drawer labeled `PC` and sees `10`. He copies `10` onto the address slip, goes upstairs to slot `10`, reads the number there, and copies it onto his value slip. The paper has `01` written on it.

Back at his desk, Otto checks the [decoder chart](#diagram-1-2). `01` means `LOAD A, n`.

For `LOAD A, n`, the procedure is:

- Move `PC` forward by 1
- Read the next cabinet slot at address `PC`
- Put that value into drawer `A`
- Move `PC` forward by 1 again

This is why `LOAD A, n` uses two slots. The first slot says what procedure to follow. The next slot is the number that gets loaded into `A`.

So Otto moves `PC` from `10` to `11`, reads slot `11`, finds `00`, puts `0` into drawer `A`, then moves `PC` from `11` to `12`.

| `PC` | `A` | `B` | Display | Dial |
| --- | --- | --- | --- | --- |
| 12 | 0 | old garbage | unchanged | 2 |

Now you can start to see how the loop works. (See [Diagram 1.5](#diagram-1-5).)

Let's do the next instruction faster.

```
12: STORE A
13: [98]
```

Otto fetches slot `12`, which contains `05`. The decoder chart says `05` maps to `STORE A, [addr]`.

Here is the procedure but less verbose:

increment `PC` to read the next slot as the destination address, copy drawer `A` there, then increment `PC` again

So Otto moves `PC` from `12` to `13`, reads slot `13`, and gets `98`.

The `98` is not the data being stored. It is the destination address. So once Otto comes back downstairs with that `98` on his value slip, he copies it onto his address slip, and copies the value of `A` onto the value slip.

So Otto copies the value in drawer `A` into slot `98`, the display.

The display now shows `00`. Then he moves `PC` from `13` to `14`.

| `PC` | `A` | `B` | Display | Dial |
| --- | --- | --- | --- | --- |
| 14 | 0 | old garbage | 0 | 2 |

Next:

```
14: LOAD B
15: [99]
```

This grabs the value from slot 99, the input dial, and puts it in drawer `B`.

Now `PC` is `16` and `B` is `2`.

| `PC` | `A` | `B` | Display | Dial |
| --- | --- | --- | --- | --- |
| 16 | 0 | 2 | 0 | 2 |

Now the next instruction is a little different:

```
16: JUMP-IF-ZERO B
17: 21
```

If drawer `B` is `0`, Otto uses the next slot as the place to jump to. If drawer `B` is not `0`, he skips over that next slot and keeps on going!

This is the key idea: changing `PC` changes what instruction runs next. That is how if-statements and loops work at the lowest level.

In this case `B` is `2`, so Otto does not jump to address `21`. He skips the target slot and moves `PC` from `16` to `18`.

The next instruction is at address `18`.

```
18: ADD A, B
```

This instruction fits in one slot! There is no extra value to fetch.

Otto uses the abacus to add drawer `B` into drawer `A`: `0 + 2 = 2`.

By "into drawer `A`" I simply mean the result of `A` + `B` is stored in drawer `A` overriding the previous value.

The value in drawer `A` becomes `2`. Drawer `B` stays `2`. Then Otto moves `PC` from `18` to `19`.

Next:

```
19: JUMP
20: 12
```

For `JUMP`, the next slot is the value to set `PC` to.

So Otto moves `PC` from `19` to `20`, reads slot `20`, sees `12`, and sets `PC` to `12`.

Because `PC` is now `12`, that sends him back to the display instruction:

```
12: STORE A
13: [98]
```

Now drawer `A` contains `2`, so Otto copies that value into slot `98`. The display changes from `00` to `02`.

| `PC` | `A` | `B` | Display | Dial |
| --- | --- | --- | --- | --- |
| 14 | 2 | 2 | 2 | 2 |

From there, the loop keeps doing the same three things from [the plain-English program](#otto-program-english): show `A`, read the dial into `B`, and either add `B` into `A` or reset.


| Dial value | `A` before add | What happens | Display soon shows |
| --- | --- | --- | --- |
| 2 | 0 | add 2 | 2 |
| 2 | 2 | add 2 | 4 |
| 2 | 4 | add 2 | 6 |
| 5 | 6 | add 5 | 11 |
| 0 | 11 | jump to reset code | 0 |

So if the input dial stays at `2`, the display counts `0, 2, 4, 6, 8...`

If the user changes the dial, the jump size changes too. And if the user sets the dial to `0`, Otto runs the reset part of the program: put `0` in `A`, copy `A` to the display, then jump back to address `14` to keep checking the dial.

That is the whole trick. Otto reads numbers, remembers numbers, adds numbers, chooses where to go next, and repeats the process forever.

Something like this is happening inside your computer right now.

Except there is no Otto.

Nobody is home.

### Circuits & Electricity

Let's explore the basics of how electricity and circuits work for the purposes of this article.

Here is a simple circuit:

<a id="diagram-2-1"></a> <div class="svg-diagram"><img src="/images/basic-circuit.gif" alt="A basic circuit with a switch and light bulb and drawings not symbols"></div>

*Diagram 2.1. The circuit.*

We can think of the battery as being able to push charge around the loop. Current can only flow when this loop is completed. If the loop is broken, nothing flows. A switch is simply a controlled break in the loop, allowing us to break and complete the loop whenever we want. And a light bulb is just a simple light bulb. It glows when current flows through the filament.

Here is our circuit with some fancy symbols in place of our previous drawings:

<a id="diagram-2-2"></a> <div class="svg-diagram"><img src="/images/symbol-circuit.gif" alt="A basic circuit with a switch and light bulb and symbols"></div>

*Diagram 2.2. The circuit with symbols.*

Each symbol represents the same thing but is just easier for engineers to draw. These are the symbols I will continue to use throughout the article.

Now we have a circuit that can do one yes/no thing. Current flows or it doesn't. Now let's see if we can combine switches and relays so the circuit can "answer" slightly more interesting questions.

### Switches, Relays, & Logic Gates

Okay, now let's assume we want to build a simple dog washer circuit.

A circuit that, based on some inputs, can tell us whether to wash our dog or not.

So let's start with an extremely simple version: two switches. The person using the circuit can open or close each switch to answer a yes/no question.

Let's say switch 1 represents `STINKY`: whether the dog is stinky or not. Switch 2 represents `OLD_WASH`: has it been more than 5 days since the last wash.

Our simple circuit is simply going to use a light bulb on to indicate, yes, wash the dog, and a light bulb off to indicate, no, don't wash the dog.

So the rules for our first circuit are:

if `STINKY` AND `OLD_WASH`, the bulb is on.

Let's see the circuit:

<diagram>

This circuit is known as an `AND` gate because the output turns on only when both inputs are true. It can be represented by a symbol, similar to the letter `D`, like this:

<diagram>

Now let's introduce a new input, or "sensor": `MUDDY`, if the dog is muddy. Now the rules of the circuit change:

if (`MUDDY` OR `STINKY`) AND `OLD_WASH`

All this says is, if the dog is muddy or stinky and it's been at least 5 days since its last wash, you should wash it.

Here is how this circuit would work:

<diagram>

We have introduced a new gate, the `OR` gate, I think you can guess how it got its name.

<diagram>


Here is our circuit so far:

<diagram> (with symbols)

Okay, now let's introduce one last input, or "sensor": `RAIN_SOON`, whether it is predicted to rain soon. The rules of the circuit change once again:

((`MUDDY` OR `STINKY`) AND `OLD_WASH`) AND NOT `RAIN_SOON`

The parentheses indicate order of operations. This should be pretty familiar. So in plain English:

If the dog is muddy or stinky and its been at least 5 days since its last wash and its not going to rain soon, then wash the dog.

Let's focus on this `NOT` for a second. If a switch is open, we want current to flow. If the switch is closed, we want current to stop flowing. We can't just chain switches in clever ways to achieve this. This is something fundamentally different.

Now you might think, "Why not just rename `RAIN_SOON` to `NOT_RAIN_SOON`, problem solved."

If a person is flipping a switch by hand, sure. You can label the switch however you want.

But circuits usually receive signals from other circuits, and those signals already mean something. For example, a small circuit inside a CPU might check a number and output one signal: `IS_ZERO`. If the number is zero, the wire is on. If the number is not zero, the wire is off.

But what if another part of the CPU needs the opposite condition? What if it needs to continue only when the number is *not* zero?

Renaming `IS_ZERO` to `NOT_ZERO` would not change the electricity. The wire would still be on when the number is zero. To get the opposite signal, you need a circuit that physically flips on into off, and off into on.

That is what a NOT gate does.

So back to the dog washer analogy. How?

Electromagnetic relays, that's how.

This probably sounds quite complicated, but it is just a magnet powered by electricity.

Here is how it works:

<diagram>

This relay is made from a coil of wire and a movable metal arm. When current flows through the coil, the coil becomes a magnet and pulls the arm down. When current stops, a spring pulls the arm back up.

So for a `NOT` gate, when the input is off, the output circuit is complete. When the input turns on, the coil pulls the arm away, breaking the output circuit.

Okay the symbol for a `NOT` gate is basically a buffer with a little circle after it.

A plain triangle is called a buffer. For this article, you can think of it as a wire: the same signal comes out that went in.

The little circle is the important part. In logic diagrams, a little circle means "invert this." So a buffer with a circle on the output becomes a `NOT` gate: on becomes off, and off becomes on.

You can put the same circle on other gates too. An `AND` gate with a circle on the output means "do the AND, then flip the answer." That is called a `NAND` gate. An `OR` gate with a circle on the output means "do the OR, then flip the answer." That is called a `NOR` gate.

<diagram of NOT gate, NAND, NOR, and plain buffer>

With our knowledge about logic gates, let's create the "should-I-wash-my-dog 5000" machine!

<diagram>

I don't know about you, but addition seems like a pretty logical next step to these logic gates. But not so fast.

This is how circuits make yes/no decisions. Not by understanding anything or knowing what `MUDDY` means, but by wiring simple gates so the output turns on only for the input pattern we care about.

One important thing to notice: a wire is just a wire. We gave these wires meaning. We decided that one wire means `STINKY`, another means `MUDDY`, and another means `RAIN_SOON`.

To make a CPU, we need to give wires a different kind of meaning: numbers. Before we can build a circuit that adds, we need a way to represent numbers using only on and off.

That is what the next section is about.

### Ending

Now I hope you understand why computers aren't JUST 1s and 0s. Feel free to checkout some more material I personally love and that expands on this article.

- Code: The Hidden Language
- But how do it know?
- OSTEP (wanna just 1 level up towards os?)
