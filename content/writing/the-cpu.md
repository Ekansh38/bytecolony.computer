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



## The House

Let's start with a high-level overview of how the CPU functions, so we have a goal to work towards.

Imagine your computer is a house.

Inside this house is one stupid but surprisingly pedantic worker. His name is Otto. Also he never leaves his house.

<br>

Inside this house we have our downstairs desk where Otto does all the serious work. On the desk are a few things:

- three small drawers that can each hold one number, labeled `A`, `B`, and `PC`
- an abacus for basic arithmetic.
- A decoder chart that does some stuff. We will come back to this later.

<a id="diagram-1-1"></a> {{< svg "desk" >}}

*Diagram 1.1. The desk setup.*

<br>

Upstairs is the filing cabinet room. The cabinet has slots labeled 0, 1, 2, 3, all the way up to 99. Each slot holds one piece of paper with a two-digit number written on it, from `00` to `99`.

One quick distinction before we start: when I say "drawer," I mean the desk drawers right next to Otto where he works. When I say "slot," I mean the numbered compartments in the upstairs filing cabinet.

<a id="diagram-1-2"></a> {{< svg "cabinet" >}}

*Diagram 1.2. The filing cabinet.*

<br>

Most of these slots are boring and filled with paper. But slot 98 is special. It's a little window to the outside world. When Otto puts a number there, it doesn't get written on paper. It shows up on a display. Put `00` there and it glows `00`. Put `07` there and it glows `07`. Otto can read, write, and interact with it just as if it were any cabinet slot.

Slot 99 works the opposite way. It's connected to a dial outside the house. Otto reads from it like any other slot, but the value comes from whoever is turning the dial. He could technically write to slot 99 too, but that would be a bit disruptive.

<a id="diagram-1-3"></a> {{< svg "house" >}}

*Diagram 1.3. The outside of the house, with the display and input dial.*

<br>

The important point for now is simple: the program itself also lives in the upstairs cabinet. Instructions are just numbers stored in slots. Otto uses `PC` to know which slot to read next, then uses the decoder chart to decide what that number means.

<br>

<a id="diagram-1-4"></a> {{< svg "loop" >}}

Diagram 1.4. Otto's basic loop. He reads the address in `PC`, fetches the number from that cabinet slot, uses the decoder chart to choose what to do, does it, updates `PC`, and repeats.

Most instructions just move Otto forward to the next instruction. If `PC` says `10`, Otto reads slot 10, follows that instruction, and then `PC` moves to the next relevant slot.

But some instructions are jumps. A jump changes `PC` to a different slot instead of moving forward. That is how a program can loop, skip work, or do one thing if a value is `0` and another thing if it isn't.

That is the whole shape of the machine: instructions live in memory, `PC` points at the next one, the decoder chart says what each instruction means, and Otto repeats the same fetch-decode-execute loop again and again.

Something like this is happening inside your computer right now.

Except there is no Otto.

Nobody is home.

## Circuits & Electricity

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

## Switches, Relays, & Logic Gates

Let's assume we want to build a simple dog washer circuit.

A circuit that, based on some inputs, can tell us whether to wash our dog or not.

Our simple circuit is going to use a light bulb on to indicate, yes, wash the dog, and a light bulb off to indicate, no, don't wash the dog.

So let's start with an extremely simple version: two switches. In this first version, the switches are directly inside the bulb circuit. The person using the circuit can open or close each switch to answer a yes/no question.

Let's say switch 1 represents `STINKY`: whether the dog is stinky or not. Switch 2 represents `OLD_WASH`: has it been more than 5 days since the last wash.

So the rules for our first circuit are:

if `STINKY` AND `OLD_WASH`, the bulb is on.

Or in other words, if the dog is stinky and its last wash was over 5 days ago, then wash the dog.

Let's see the circuit:

<a id="diagram-3-1"></a> <div class="svg-diagram"><img src="/images/switches-1.gif" alt="A two-switch circuit for the dog washer machine"></div>

*Diagram 3.1. The hand-switch version of AND.*

This circuit shows the logic of AND. A person is flipping the switches manually. The output turns on only when both inputs are true.

Now let's introduce a new input: `MUDDY`, if the dog is muddy. Now the rules of the circuit change:

if (`MUDDY` OR `STINKY`) AND `OLD_WASH`

All this says is, if the dog is muddy or stinky and it's been at least 5 days since the dog's last wash, you should wash the dog.

Now let's focus on the (`MUDDY` OR `STINKY`) part of this circuit:

<diagram>

This is OR: either `MUDDY` or `STINKY` needs to be on for the bulb to turn on.

Now lets combine the two.

But now we have a problem. The `MUDDY` or `STINKY` circuit outputs its result with an electrical signal: on or off.

Okay, now let's introduce one last input, or "sensor": `RAIN_SOON`, whether it is predicted to rain soon. The rules of the circuit change once again:

((`MUDDY` OR `STINKY`) AND `OLD_WASH`) AND NOT `RAIN_SOON`

The parentheses indicate order of operations. This should be pretty familiar. So in plain English:

If the dog is muddy or stinky and it's been at least 5 days since the dog's last wash and it's not going to rain soon, then wash the dog.

Let's focus on this `NOT` for a second. If a switch is open, we want current to flow. If the switch is closed, we want current to stop flowing. We can't just chain switches in clever ways to achieve this. This is something fundamentally different.

<diagram showing the problem with a question mark??> like open switch flow and closed no switch how?

Now you might think, "Why not just rename `RAIN_SOON` to `NOT_RAIN_SOON`, problem solved."

If a person is flipping a switch by hand, sure. You can label the switch however you want.

But circuits usually receive signals from other circuits, and those signals already mean something. For example, a small circuit inside a CPU might check a number and output one signal: `IS_ZERO`. If the number is zero, the wire is on. If the number is not zero, the wire is off.

But what if another part of the CPU needs the opposite condition? What if it needs to continue only when the number is *not* zero?

Renaming `IS_ZERO` to `NOT_ZERO` would not change the electricity. The wire would still be on when the number is zero. To get the opposite signal, you need a circuit that physically flips on into off, and off into on.

That is what a NOT gate does.

So back to the problem at hand. How?

Electromagnetic relays, that's how.

This probably sounds quite complicated, but it is just a magnet powered by electricity.

Here is how it works:

<diagram>

This relay is made from a coil of wire and a movable metal arm. When current flows through the coil, the coil becomes a magnet and pulls the arm down. When current stops, a spring pulls the arm back up.

A relay lets one circuit control a switch in another circuit. These are separate circuits, but mechanically linked by the relay arm.

Now we can finally use the normal logic gate symbols.

An `AND` gate is drawn like this:

<diagram of AND gate symbol>

An `OR` gate is drawn like this:

<diagram of OR gate symbol>

And the symbol for a `NOT` gate is basically a buffer with a little circle after it.

A plain triangle is called a buffer. For this article, you can think of it as a wire: the same signal comes out that went in.

The little circle is the important part. In logic diagrams, a little circle means "invert this." So a buffer with a circle on the output becomes a `NOT` gate: on becomes off, and off becomes on.

You can put the same circle on other gates too. An `AND` gate with a circle on the output means "do the AND, then flip the answer." That is called a `NAND` gate. An `OR` gate with a circle on the output means "do the OR, then flip the answer." That is called a `NOR` gate.

<diagram of NOT gate, NAND, NOR, and plain buffer>

With our knowledge about logic gates, let's create the "should-I-wash-my-dog 5000" machine!

<diagram>

Now keep in mind these electromagnetic relays are quite big and slow.

These relays aren't the only way to solve this problem of inverting a signal but, they are one of the early and intuitive methods to understand, but many real computers like [Harvard Mark I](https://en.wikipedia.org/wiki/Harvard_Mark_I) used these relays.

In modern computers a similar behavior is achieved by using tiny transistors. If you want to learn more about transistors: [visit this site](https://www.electronics-tutorials.ws/logic/logic-gates-using-transistors.html)

I don't know about you, but addition seems like a pretty logical next step to these logic gates. But not so fast.

This is how circuits make yes/no decisions. Not by understanding anything or knowing what `MUDDY` means, but by wiring simple gates so the output turns on only for the input pattern we care about.

One important thing to notice: a wire is just a wire. We gave these wires meaning. We decided that one wire means `STINKY`, another means `MUDDY`, and another means `RAIN_SOON`.

To make a CPU, we need to give wires a different kind of meaning: numbers. Before we can build a circuit that adds, we need a way to represent numbers using only on and off.

That is what the next section is about.
