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

This article is going to walk you through how a CPU is built, starting with the simplest possible components.

We start with a simple circuit turning on and off a light bulb and work our way through fundamental digital logic and electrical engineering concepts.

Some resources stay extremely high-level, so you never really understand how a CPU actually works.

The deeper resources are amazing, but they are long, dense, and intimidating. And frankly, for someone who doesn't want that level of detail, a lot of it can often feel like too much. This article will hopefully help you understand what is going on under the hood, without exploding your brain or eating weeks of time.

The key point is that nothing here is smart in isolation. A CPU is not one hard idea. It is a very tall pile of simple ones.

(Full simple CPU drawing: a few labeled boxes, data bus, address bus, and some control wires)

We are going to try to understand this simple CPU. It is not a modern CPU with decades of optimization, but it has the same core functionality.

## The House

Let's start with a high-level overview of how the CPU functions, so we have a goal to work towards.

Imagine your computer is a house.

Inside this house is one stupid but surprisingly pedantic worker. His name is Otto. Also he never leaves his house.

Inside this house we have our downstairs desk where Otto does all the serious work. On the desk are a few things:

- three small drawers that can each hold one number, labeled `A`, `B`, and `PC`
- an abacus for basic arithmetic.
- A decoder chart that does some stuff. We will come back to this later.

<a id="diagram-1-1"></a> 

{{< svg "desk" >}}

*Diagram 1.1. The desk setup.*

Upstairs is the filing cabinet room. The cabinet has slots labeled 0, 1, 2, 3, all the way up to 99. Each slot holds one piece of paper with a two-digit number written on it, from `00` to `99`.

One quick distinction before we start: when I say "drawer," I mean the desk drawers right next to Otto where he works. When I say "slot," I mean the numbered compartments in the upstairs filing cabinet.

<a id="diagram-1-2"></a> 

{{< svg "cabinet" >}}

*Diagram 1.2. The filing cabinet.*

Most of these slots are boring and filled with paper. But slot 98 is special. It's a little window to the outside world. When Otto puts a number there, it doesn't get written on paper. It shows up on a display. Put `00` there and it glows `00`. Put `07` there and it glows `07`. Otto can read, write, and interact with it just as if it were any cabinet slot.

Slot 99 works the opposite way. It's connected to a dial outside the house. Otto reads from it like any other slot, but the value comes from whoever is turning the dial. He could technically write to slot 99 too, but that would be a bit disruptive.

<a id="diagram-1-3"></a> 

{{< svg "house" >}}

*Diagram 1.3. The outside of the house, with the display and input dial.*

The important point for now is simple: the program itself also lives in the upstairs cabinet. Instructions are just numbers stored in slots. Otto uses `PC` to know which slot to read next, then uses the decoder chart to decide what that number means, and what procedure to follow based on each instruction.

<a id="diagram-1-4"></a> 

{{< svg "loop" >}}

Diagram 1.4. Otto's basic loop. He reads the address in `PC`, fetches the number from that cabinet slot, uses the decoder chart to choose what to do, does it, updates `PC`, and repeats.

Most instructions just move Otto forward to the next instruction. If `PC` says `10`, Otto reads slot 10, follows that instruction, and then `PC` moves to the next relevant slot.

But some instructions are jumps. A jump changes `PC` to a different slot instead of moving forward. That is how a program can loop, skip work, or do one thing if a value is `0` and another thing if it isn't.

That is kinda just how your computer works: instructions live in memory, `PC` points at the next one, the decoder chart says what each instruction means, and Otto repeats the same fetch-decode-execute loop again and again.

Something like this is happening inside your computer right now.

Except there is no Otto.

Nobody is home.

## Circuits & Electricity

Let's explore the basics of how electricity and circuits work for the purposes of this article.

Here is a simple circuit:

<a id="diagram-2-1"></a> 

<div class="svg-diagram"><img src="/images/basic-circuit.gif" alt="A basic circuit with a switch and light bulb and drawings not symbols"></div>

*Diagram 2.1. The circuit.*

We can think of the battery as being able to push charge around the loop. Current can only flow when this loop is completed.

If the loop is broken, nothing flows. A switch is simply a controlled break in the loop, allowing us to break and complete the loop whenever we want.

And a light bulb is just a simple light bulb. It glows when current flows through the filament.

Now we have a circuit that can do one yes/no thing. Current flows or it doesn't.

Now let's see if we can combine switches and relays so the circuit can "answer" slightly more interesting questions.

## Switches, Relays, & Logic Gates

Let's assume we want to build a simple dog washer circuit: a circuit that, based on some inputs, can tell us whether to wash our dog or not.

Our simple circuit is going to use a light bulb being on to mean yes, wash the dog. Light bulb off means no, don't wash the dog.

So let's start with an extremely simple version with two switches.

In this first version, the switches are directly inside the bulb circuit. The person using the circuit can open or close each switch to answer a yes/no question.

Let's say switch 1 represents `STINKY`: whether the dog is stinky or not. Switch 2 represents `OLD_WASH`: has it been more than 5 days since the last wash.

So the rules for our first circuit are:

if `STINKY AND OLD_WASH`, the bulb is on.

Or in other words, if the dog is stinky and its last wash was over 5 days ago, then wash the dog.

Let's see the circuit:

<a id="diagram-3-1"></a> 

<div class="svg-diagram"><img src="/images/switches-1.gif" alt="A logical AND circuit"></div>

*Diagram 3.1. The hand-switch version of AND.*

This circuit shows a logical AND operation. A person is flipping the switches manually. The output turns on only when both inputs are true.

Now let's introduce a new input: `MUDDY`, if the dog is muddy.

Now the rules of the circuit change:

if `(MUDDY OR STINKY) AND OLD_WASH`

All this says is, if the dog is muddy or stinky and it's been at least 5 days since the dog's last wash, you should wash the dog.

Now let's focus on the (`MUDDY` OR `STINKY`) part of this circuit:

<a id="diagram-3-2"></a> 

<div class="svg-diagram"><img src="/images/or-gate-logical.gif" alt="A logical OR circuit"></div>

*Diagram 3.2. The hand-switch version of OR.*

This is a logical OR: either `MUDDY` or `STINKY` needs to be on for the bulb to turn on.

Now lets combine the two to form the complete circuit.

But now we have a problem.

The `MUDDY OR STINKY` circuit outputs its result with an electrical signal: on or off. Our previous AND circuit relies on a human flipping a switch in order to compute a result.

Or in other words the OR circuit we built outputs a result as electricity, but the AND circuit we want to combine it with expects a input as a metal switch physically being moved. A signal in a wire can't reach over and somehow close that switch.

<a id="diagram-3-3"></a> 

{{< svg "combination-problem" >}}

*Diagram 3.3. The problem we currently face.*

So if we want to chain circuits together, we need a way for an electrical signal to control a switch automatically. How can we do this?

Electromagnetic relays, that's how. (or at least that is one of the early solutions to this problem, we will talk about other solutions a little more later on)

This probably sounds quite complicated, but it is just a magnet powered by electricity.

Here is how it works:

One thing to quickly mention: if you see several little batteries in a circuit, don't read that as several totally separate power sources. I am using the battery drawing as a shortcut for "this point is connected to power," so the diagram doesn't turn into spaghetti.

<a id="diagram-3-4"></a> 

<div class="svg-diagram"><img src="/images/basic-relay.gif" alt="An electromagnetic relay"></div>

*Diagram 3.4. An electromagnetic relay.*

This relay is made from a coil of wire and a movable metal arm. When current flows through the coil, the coil becomes a magnet and pulls the arm down. When current stops, a spring pulls the arm back up.

A relay lets one circuit open or close a switch in another circuit. The two circuits stay separate, but the relay arm physically connects them.

Also in this example we end up using a switch anyway, but any kind of electrical signal could be used, like the output of another circuit, the switch is just to demonstrate how the relay works.

As you can also tell by the diagram, there is a slight delay between the coil turning on and the metal arm moving. Relays are mechanical, so they do not switch instantly.

Now lets see how we can build an actual electrical AND gate that takes in as input 2 wires, and outputs and electrical signal.

<a id="diagram-3-5"></a> 

<div class="svg-diagram"><img src="/images/electronic-and-gate.gif" alt="An AND gate"></div>

*Diagram 3.5. An AND gate.*

If both inputs have signal, then the output circuit forms a complete loop. The output circuit has 2 breaks which are both controlled by each input.

Using these relays chained in clever ways, you can create every fundamental logic gate, such as the OR gate:

But before the next diagram, I am going to use one more new symbol: ground.

For the purposes of this article the ground symbol will simply refer to the common return point of the circuit usually connected to the negative side of the battery.

Every point marked with the ground symbol is connected together, as if there were hidden wires joining them underneath the drawing. It is not a new component. It is just a cleaner way to draw the return path.

The circuits are still loops. I am just not explicitly drawing the return wire anymore.

This is how the ground symbol looks:

<a id="diagram-3-6"></a> 

{{< svg "ground-symbol" "small" >}}

*Diagram 3.6. The ground symbol.*

Now here is the OR gate:

<a id="diagram-3-7"></a> 

<div class="svg-diagram"><img src="/images/electronic-or-gate.gif" alt="An electronic OR gate"></div>

*Diagram 3.7. An electronic OR gate.*

That is an OR gate using relays. Now here is the full dog washer circuit up to this point:

<a id="diagram-3-8"></a> 

<div class="svg-diagram"><img src="/images/dog-washer-v1.gif" alt="The full dog washer circuit built with relays"></div>

*Diagram 3.8. The full dog washer circuit built with relays.*

The animation does not show every possible combination of switches, only a handful. But in a nutshell, if any of the first 2 inputs are on, and the third the bulb will be on. I hope it makes sense how it works.

Okay, now let's introduce one last input, or "sensor": `RAIN_SOON`, whether it is predicted to rain soon. The rules of the circuit change once again:

`((MUDDY OR STINKY) AND OLD_WASH) AND NOT RAIN_SOON`

The parentheses indicate order of operations. This should be pretty familiar. So in plain English:

If the dog is muddy or stinky and it's been at least 5 days since the dog's last wash and it's not going to rain soon, then wash the dog.

Let's focus on this NOT for a second. NOT just inverts a signal: if it receives signal, it outputs no signal; if it receives no signal, it outputs signal.

That is what a NOT gate does.

<a id="diagram-3-9"></a> 

<div class="svg-diagram"><img src="/images/not-gate.gif" alt="A NOT gate"></div>

*Diagram 3.9. A NOT gate.*

Now before we look at the completed circuit, lets learn some basic logic gate symbols.

An AND gate is drawn like this:

<a id="diagram-3-10"></a> 

{{< svg "and-gate" >}}

*Diagram 3.10. An AND gate.*

This symbol represents the [AND circuit](diagram-3-5) we made previously.

An OR gate is drawn like this:

<a id="diagram-3-11"></a> 

{{< svg "or-gate" >}}

*Diagram 3.11. A OR gate.*

This symbol represents the [OR circuit](diagram-3-7) we made previously.

Whenever I use these symbols moving forward, they can directly translate to the circuits with the relays I showed you previously, the inputs and outputs are the same, but the internal components stay hidden for cleanliness sake.

Here are three more useful gate symbols:

<a id="diagram-3-12"></a> 

{{< svg "not-nand-nor-gates" >}}

*Diagram 3.12. NOT, NAND, NOR gates.*

NAND is just AND but then flip the result, so AND + NOT or NAND. Same with NOR. OR + NOT = NOR.

I hope the pattern makes sense now, any regular gate with a circle at the end flips its output.

With our knowledge about logic gates, let's create the "should-I-wash-my-dog 5000" machine!

<diagram>

Keep in mind these [electromagnetic relays](diagram-3-4) we used in the examples are quite big and slow.

Relays aren't the only solution. They are simply one of the early and intuitive methods to understand, and many real computers like the [Harvard Mark I](https://en.wikipedia.org/wiki/Harvard_Mark_I) actually used these types of relays.

In modern computers a similar behavior is achieved by using transistors. If you want to learn more about transistor based logic gates: [visit this site](https://www.electronics-tutorials.ws/logic/logic-gates-using-transistors.html)

I don't know about you, but addition seems like a pretty logical next step to these logic gates. But not so fast.

This is how circuits make yes/no decisions. Not by understanding anything or knowing what `MUDDY` means, but by wiring simple gates so the output turns on only for the input pattern we care about.

One important thing to notice: a wire is just a wire. We gave these wires meaning. We decided that one wire means `STINKY`, another means `MUDDY`, and another means `RAIN_SOON`.

To make a CPU, we need to give wires a different kind of meaning: numbers. Before we can build a circuit that adds, we need a way to represent numbers using only on and off.

That is what the next section is about.
