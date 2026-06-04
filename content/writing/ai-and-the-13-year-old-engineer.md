---
title: "AI and the 13-Year-Old Engineer"
date: 2026-06-04
---

<img src="/images/ai-essay-hero.jpg" alt="AI and the 13-Year-Old Engineer" style="width:85%;border-radius:6px;margin-bottom:24px;">

AI changed how I code. I use it every day. My website is mostly vibe coded. Most of my projects are AI-assisted.

But for the work I am interested in: kernels, low-level stuff, robotics, the systems the world runs on: I hand code. Slowly. By myself. AI helps, but I write every important line.

I'm 13. I have years before I'm in the market. This essay is about why I'm spending those years writing code by hand instead of prompting my way through them and my general thoughts on AI and the future of the industry. 

---

## Is CS worth doing?

Last year I was teaching a coding class at my school. I taught some basics, Python, Scratch. They enjoyed it! It reminded me of me, when I started learning how to code. One of my first programs was using Pyautogui to spam people on WhatsApp, I spent hours playing with it, trying to get it to work. In awe at the reality that I could build anything. One of them was particularly excited, he had been building little things in Python on his own and was trying to get his parents to buy him a Raspberry Pi.

The English teacher supervising the activity said something to them like: "IT and computer science professions will be taken over by AI in the future, but it can still be a fun hobby." He said it with 100% confidence. He was a middle school English teacher, and that was the message the kids absorbed. This was early 2025. That frustrated me because I couldn't do anything about it.

I'm writing this partly because of that moment.

He was partly correct. The CS career a lot of people pictured is dead. The bootcamp-to-100k-job pipeline. Standard frontend devs shipping CRUD sites. The basic React job. The "I learned Python in 3 months and got hired" pipeline. Mostly dead. If that's the version of CS you wanted, the door is closing.

But that wasn't all of CS. That was a part of CS that briefly looked to some like all of CS because there was a decade of cheap money and easy hiring. The actual field, the one that builds the systems everything else runs on, is more valuable than ever. Just for reference I am referring to compilers, kernels, critical networking code and infrastructure, distributed systems, database engines, game engines, hardware, and a lot more.

So back to the question at hand. Is CS worth doing? Yes.

Here is why I think so in simple terms:

Software is getting cheaper to make because of AI. So we will have more software, not less. This is called Jevons paradox. Tech is expanding, not shrinking. Everything in our lives runs on software infrastructure and that isn't slowing down because of AI, it's speeding up. Until AGI, humans will have a place somewhere in tech. Simple.

If AGI shows up, the world is going to be very different and there's no sensible way to prep for it. Just do what you love. But even there, depth wins. The people who could get the most out of AI are the ones who understand the most in the field they are directing. Imagine everybody has a super intelligent scientist with them. The ones who win are the ones who can communicate the best and understand what the hard problems are. That comes from fundamentals and depth.

Linus Torvalds said it best: "I think actually on the programming side, we're in a fairly good spot. I really think that AI will be a tool." Not a replacement. A tool. (*Building the PERFECT Linux PC with Linus Torvalds*, Linus Tech Tips.)

I'm not trying to be a web developer. I'm not pumping out CRUD apps. I don't care about that work. 

Also. If you're going into CS just for money, or because you think it's easy, you're going to suck. This field has always rewarded people who are in it for the love of the game. AI reinforced that.

CS is not "dead" or "solved" nor will it be in the near future.

---

## AI is awesome!

I am not against AI.

Lets be honest, AI assisted development is here to stay. (I have some thoughts about flaws of autocomplete and LSPs but that is out of the scope of this post)

Many of my projects are vibe-coded. My website, bytecolony.computer, is mostly vibe coded even though I put a lot of time into style and design. Most of my development is AI-assisted (again, another post). I use it every day. It's not a slop cannon, it can code. It's not a perfect developer that has solved everything either.

The question I care about is what happens to learning, to understanding, and to building *good quality* things, when you replace writing code with directing an AI.

This is the thesis I'll keep coming back to.

**Vibe coding will not make you a better vibe coder.**

Even if your future job involves a lot of vibe coding (and for lots of people it very probably could be), the path to getting good at it isn't through more vibe coding. It's via hand coding. Via understanding how the things you're directing AI to build actually work. By becoming someone who can catch when AI is wrong, and direct it in the right direction. Those skills develop through depth.

I will come back to this point a lot throughout.

<mark>My dad pointed out something I love. When social media first came out, nobody knew the harm it caused. We had to wait a decade to find out. The first generation given unlimited social media at 13 paid the cost of being the experiment. We didn't know cigarettes were bad until we did. New technologies get rolled out before we understand the long-term effects, and the cost gets paid by whoever was the test group.</mark>

---

## The calculator analogy

Some people like to use this calculator analogy. It sounds good but I disagree.

Here's how it goes. Mathematicians used to memorize multiplication tables for hours. Now we have calculators and we just learn the concepts. AI is the same for code, they say. Why hand code when AI handles it? Focus on the high level architecture and plans.

The analogy is false for two reasons.

First, prompting isn't a different skill from coding the way addition/math is a different skill from rote learning. Prompting is just coding at a higher level of abstraction. The concepts are the same. Coding is just a more specific spec or PRD. But memorization of multiplication tables has nothing to do with concepts of math itself. The analogy just doesn't simply apply.

Second, calculators are deterministic. 6 x 7 is always 42. The output is always the same, and always correct (mostly). The tool doesn't have a "skill". AI is non-deterministic. The output varies. It can be wrong or sub-optimal. Evaluating it requires exactly the judgment that comes from hand coding (coming back to this later). It's just not the same.

Where I think the calculator analogy works is for syntax. Semicolons, function names, API signatures. AI can now handle all of that, the way a calculator handles arithmetic. I think this is great change, in the same way mathematicians don't have to spend hours brute forcing tricky division, developers don't have to go searching for a missing semi-colon. Also, after a while, syntax stops being an issue. You don't complain about a mathematician forgetting how to write a square root, right? Syntax isn't complicated. When mistakes happen, modern tools instantly pin-point and fix them. Syntax was never the hard part. Only for beginners.

---

## AI is an abstraction

Lets assume that AI is just an abstraction layer. Python was an abstraction over C. Lots of developers write Python without knowing what their code compiles to (yes, Python is partially compiled), what the CPython interpreter does, or how the GIL affects threading. That's fine for most application work. 

But assembly didn't disappear (even if you think it did, it didn't). The people who write assembly today (kernel developers, compiler engineers, embedded specialists) can do things Python developers fundamentally can't. The best Python developers know C. They've written plenty of it.

This is not a coincidence. The best developers know one layer up and importantly one layer down. The best JavaScript developers know what V8 actually does, why monomorphic call sites matter, when the engine bails out of optimization. The best C developers can read the assembly their compiler produces and know when to drop into inline asm. The best kernel developers know hardware behavior. The best hardware engineers know their fair share of theoretical physics. 

I would argue that the deeper you understand the stack, the better you are.

You don't need maximum depth in every direction. You need enough adjacency to step across the boundary when abstractions leak. **Abstractions always leak.** Every React (working on serious stuff) developer who has fought a re-render performance issue, every Python developer (again, working on serious stuff) who has debugged a memory issue, knows this.

AI is just the latest abstraction over coding itself, and the same rule applies. People who know what's underneath (which is just code) will do things AI-only developers can't, and they'll use AI better when they do use it. The weird part is that this abstraction is much more non-deterministic than the ones we are used to and can produce things with zero underlying knowledge in a way Python never could.

If Python is incredibly deterministic and it still makes you a better developer to know CPython and C, why wouldn't the same logic apply to AI? The layer underneath always matters.

---

## Is vibe-coding a skill?

I want to steelman the case that it is (show the strongest possible argument). A lot of smart people make this argument.

Here I go!

Vibe coding is not passive. You are deciding what to build, describing it precisely enough that AI produces something useful, reading the output and judging it, pushing back when something is wrong, iterating, integrating the pieces, noticing edge cases the model missed. It requires architectural sense, knowing what shape the system should take. Taste. Understanding the problem well enough to specify it. The ability to evaluate output, which means knowing what correct output looks like.

If you are bad at this, you produce bad results. If you are good, you produce working software.

That is the strongest version but I still think it's wrong, here is why:

<mark>Here's where I land. Every "skill" the argument lists is actually a skill that comes from somewhere else.</mark>

Architectural sense doesn't come from vibe coding. It comes from understanding how software systems work, which comes from having built them. Taste doesn't come from vibe coding. It comes from having seen enough good and bad code to know the difference, which mostly comes from writing it. <mark>The ability to evaluate AI's output doesn't come from vibe coding. It comes from knowing what correct code looks like, which comes from learning to write correct code.</mark> The ability to push back on AI comes from understanding why AI's approach might be wrong, which requires understanding what right looks like first.

You could say: couldn't you build these skills through AI-tutored learning? Asking AI to explain things while you read code, doing intensive vibe coding with deep review? Partially yes. AI-tutored learning is real, and as you'll see in a second, an Anthropic study showed people who used AI for conceptual questions while writing the code themselves scored 65% or higher on comprehension, versus below 40% for those who delegated the writing. <mark>Also deep review doesn't happen in practice. The path of least resistance with AI is always toward more delegation. People who set out to carefully review every line drift into skimming when stuck, and when you are stuck, is when real learning happens.</mark>

Pure vibe coding and AI-tutored learning are like only watching tutorials. There's a reason people tell you to actually build, not just watch. Friction.

So when someone says "vibe coding is a skill," I think they mean, "software engineering is a skill, and good engineers can apply that skill through vibe coding too". Which I agree with, but the skill is engineering, not prompting or which "skill pack" to download.

Theo put it this way: "the same lever that accelerates an expert's understanding accelerates a novice's ignorance." 

<mark>The model has the "skill" not you, and you are limited by what the model can do.</mark>

If something doesn't work and the model can't fix it, end of story. It's a direct ceiling. Not high enough to reach for frontier work.

Vibe-coding "skills", prompting, tool fluency, workflow knowledge, don't compound. Real skills last. Remember when in 2022 everyone was selling their course on prompting? Saying you would get left behind if you didn't learn prompting ASAP. Then everything switched to a more agentic workflow with tools like Claude Code and all the "skills" and workflows changed? Vibe coding fluency doesn't compound. Cursor tricks from 2024 are useless in 2026. You're learning to operate this quarter's tool, which gets replaced by next quarter's tool, which then get replaced by next quarter's tool.


All this is so new. It's extremely scary to bet on.

---

## You can't really learn from watching

When you vibe code, you're more like a manager than a builder. Managers have real skills. They make calls, evaluate work, push back. But they don't become engineers by managing more engineers. To become an engineer, you have to engineer.

You can't become a surgeon by watching surgery videos. You can't learn jiu jitsu from watching MMA. You can't become a tech team lead without first knowing the engineering concepts you'd be leading on. Reading and managing get you some surface. The actual skill only forms from doing it yourself. Many times. With real stakes.

The Cherno (Yan Chernikov) works at an AI robotics startup and ships AI-assisted production C++ for a living. Claude Code daily, fully agentic workflow, not anti-AI. But on beginners learning through AI: "If I was learning programming now and I was immediately thrown into AI tools and I was taught that, well, you just ask AI to do this for you and then it writes the code for you and then you test it and then it works and then you commit it, that is dreadful."

Why dreadful? The missing piece is being able to look at AI's output and say "no, that code is terrible." A beginner can't. They don't have the experience. They might not even read the code. So AI does its own thing, the tests pass, and they ship something nowhere near production quality with no idea anything is wrong. His worry for the next generation: "The next generation of software engineers who maybe have been brought up in an environment where they do use AI a lot, can wind up in a state where they have a portfolio that looks pretty sweet, but they don't actually understand how anything works."

Anthropic ran a randomized controlled trial on this in early 2026 ("How AI Impacts Skill Formation" by Shen and Tamkin, arxiv 2601.20245). 52 junior engineers learned Trio, an async library none of them had used. Half got AI assistance, half coded by hand. Then a conceptual quiz with no AI allowed. The AI-assisted group scored 17% lower, nearly two letter grades. They didn't even finish faster. They just understood less.

The detail that hit hardest was within the AI group itself. People who used AI to delegate code generation scored below 40%. People who used AI for conceptual questions while writing the code themselves scored 65% or higher. Same tool, used different ways, wildly different outcomes. <mark>This is from Anthropic, who has every incentive to show their tools help with learning.</mark> They published evidence the tools hurt learning instead.

You learn with your fingers. DHH said that. Basically everyone says some version of that. DHH put it sharper: he can "literally feel competence draining out of my fingers" when he leans on AI too much.

The point isn't that typing is magic. It's that when you write code yourself you're forced to make every decision. What's the variable called. What goes in this function versus that one. What happens when input is empty. What happens when input is huge. What happens when two things race. Each decision is a moment where you have to think. The thinking is what builds the mental model. The code is the byproduct. When AI generates the code, AI made those decisions for you. The thinking didn't happen. The mental model didn't form.

<mark>That's how to become skilled at vibe-coding, by not vibe-coding!!!!</mark>

The slowness of writing code yourself is part of the learning, not an issue to try and optimize.


---

## After you write it once, why write it again?

After you've built one scheduler, why hand code another? AI can handle the repetition. You learned the concept. Move on.

A kid learns that 7 × 8 = 56. Should they stop practicing multiplication? No. They spend years doing problem sets. Understanding a concept once and having it wired in deeply enough to use are not the same thing. You can't do calculus on top of multiplication you understand "in theory." You need it automatic, instinctive, fast. That only comes from reps.

A pianist learns scales in a week and practices them for life. A surgeon learns suturing in their first year and does thousands during training.

Coding is the same. There's a difference between understanding a scheduler conceptually and having it so internalized that you can write a custom one for a specific situation. The first implementation gives you the concept. The third gives you the intuition. The fifth gives you the pattern recognition that lets you spot bugs at a glance. Also it's not just about a scheduler, but general understanding of systems in proximity to the one you are making. Hand coding one system pulls you into the systems next to it.

Reps also expose areas you don't understand. The hash table for a database is different from one for a cache is different from one for a hot path with cache locality concerns. Each variation teaches you something new.

It's like adding a new tool to your toolbox, the more tools you have the more approaches you can think of to solving a problem, the more confident you are, and the better a developer you are too.

The point of hand coding a hash table isn't that you'll write hash tables for your job. You probably won't. The point is what hand coding it does to your brain. After you've built one, you start seeing the underlying patterns everywhere. Lookup tradeoffs. Memory layout. The hash table was the cause. The mental model is the effect.

Years of hand coding gives you those models. Build a parser and you see state machines everywhere. Build an allocator and you think about ownership in every system. Build a network protocol and you understand timing, ordering, partial failure in totally unrelated work.

I'm not saying you should build 10 schedulers. I'm saying don't skip past something just because you think you understand it. Just because you do something once doesn't mean you should start delegating away to AI. 

---

## Vibe debt in production

When you hand code something, your understanding is forced. You can't write a memory allocator without understanding exactly how it works! The understanding isn't optional. It's a side effect.

When you vibe code, the understanding is optional. The path of least resistance is to skim and ship. Even when people try to understand vibe-coded output, the understanding stays shallow because it's like reading a book compared to writing one.

The Cherno said: "You wind up getting into that state of yes, the code works and it's functional, but it's nowhere near production grade. It's nowhere near ready for publication. And there's also probably so many edge cases or it runs really slowly." He could be seeing this on systems his team ships.

This matters because production code breaks. Hand-coded systems break too, but the person who wrote them already understands them. Debugging is fast because the mental model exists. Vibe-coded systems break and someone has to rebuild that understanding from scratch.
The standard counter is: just have AI fix it. Ship fast, patch fast, move on. Plenty of companies operate this way. It works for shallow-er bugs. But deeper bugs need understanding of the system, and if/when AI fails, somebody has to step in. 

Also just an overall solid understand of the whole system is good, it helps you figure out solid ways to add a feature, when and what to refactor, what parts are fragile. That is how strong systems are built, through mental models of them.

Even the latest frontier models hit a ceiling here. DeepSWE, released in May 2026 by Datacurve, is the most credible coding benchmark out right now. It draws from 91 active open-source repos across five languages, specifically designed to be contamination-free. Tasks the models couldn't have seen in training. The verifier checks observable behavior, not specific code shape.

The numbers: GPT-5.5 hits 70%. Claude Opus 4.7 at max effort lands at 54%. Three out of ten bugs the best model still can't fix. Almost half for Opus.

Real production failures don't come framed like that. We still don't know if the skill of the models transfers well because the conditions are completely different. On the benchmark, the model gets the issue described, the failing test written, and a clean isolated environment. In production, the model would get a vague description of what is happening, a codebase with months of context it has no memory of, and no test that defines what "fixed" means, exactly what a human would get. The model has to figure out what's broken before it can fix it. Benchmarks skip that step entirely. So 70% on well-framed bugs doesn't mean 70% on real ones.

So when I say AI can't fix all bugs today or in the near future, I'm not making stuff up. I'm reading the numbers we have. And those numbers, even the best ones, are on an easier version of the task.

Just wanted to clarify that. This doesn't mean the models can't get better, just that we are not there yet. Models will keep improving. I just don't think the current approach gets all the way to replacing great engineers (I will talk a little more about this later). I could be wrong. But that's what I think, and I'd rather bet on depth than on whichever model is on top this quarter.

Concrete example from last week. I was testing AI on some filesystem code I'm writing in Go. Opus 4.7 max thinking, basically the best model out. I gave it the task, it produced a clean-looking solution. But there were bugs.

Here's one:

```go
for i := numOfCurrentBlocks - 1; i >= blocksNeeded; i-- {
    blockNum := getBlockNum(inode, i)
    freeDataBlock(blockNum)
}
```

`blocksNeeded` and `numOfCurrentBlocks` are `uint32`, thus meaning `i` inherits the type from `numOfCurrentBlocks`. If `numOfCurrentBlocks = 1` and `blocksNeeded = 0`, then `i` starts at 0. The condition `i >= blocksNeeded` passes. `i--` wraps to MAX_UINT32. Infinite loop. Reducing one block to zero crashes the program.

There was another one. The model used `!= 0` to check if a block was allocated. Zero is a valid block number. You're supposed to check against the inode size. Different bug, same kind of mistake.

These aren't hard bugs. I caught them in a few seconds. Prompted the model with what was wrong, it fixed them, two prompts later the code was clean. Basically as good as what I'd have written. But here's the thing. *I* caught those bugs. The model didn't. Those two prompts are what counted. If I didn't know about uint underflow, the loop would have shipped, if I hadn't had my fair share of experience writing shitty loops I would have never caught the bug. If I didn't know zero is a valid block number (and I did because I designed/wrote the whole filesystem), the `!= 0` check would have shipped. The model would have happily approved its own code.

And no, 100% test coverage doesn't save you. Some vibe coders argue "I have full coverage, so there are no bugs." That's not how tests work. Tests cover the cases you thought to test. The uint underflow above only fires when you reduce blocks to zero. If nobody wrote that specific test, and why would they, who thinks about that, the bug ships. Tests catch known cases. Bugs live in unknown ones. 100% test coverage means nothing.

And this is a relatively simple filesystem. Not super realistic. Toy-scale. Imagine the same kind of subtle bug at larger scale, in more complex projects, in code paths that only fire in production under specific conditions. The bugs don't get easier to catch as the system gets bigger. They get harder, and there are more of them.

This is the answer to "why are you writing this from scratch when AI can do it." To understand this stuff. To be able to catch the bug when the model ships it confidently. That's the entire point.

Some more data: "Debt Behind the AI Boom" (Liu et al., arxiv 2603.28592) tracked 304,362 verified AI-authored commits from 6,275 GitHub repos. Over 15% of AI commits introduce at least one issue, and 22.7% of those issues still survive in the latest version. They accumulate.

To be clear, what I care about is not humans alone or AI alone. It's the human + AI combination. This is the combination I think actually works, and it's the one I'm going for. But it only works if the human side of the equation has the depth to direct, evaluate, and help the AI. A vibe coder with no foundation can't do that. The human + AI combination isn't strong because there's a human in it. It's strong because the human has skill and depth. Without those skills, the combination collapses into: AI alone, with a person watching.

## Hashimoto's experiment

Here is another example of vibe debt in production.

Last week Mitchell Hashimoto ([tweet](https://x.com/mitchellh/status/2060088112257372610), creator of Ghostty and HashiCorp, very smart goat person) ran a controlled experiment on this exact question. He took the render core of Ghostty, ported it to Go with a deliberately naive but correct implementation: 88ms per frame, 150,000 allocations per frame. Slow but correct. Then he set an AI agent loop on it with the only goal of minimizing frame times. He let it run for about 4 hours and spent around $350 on inference.

The result: 88ms -> 1.5ms. 150,000 allocs -> ~500 allocs. Looks incredible.
Until you compare it to his own hand-written port of the same renderer: 20 microseconds per frame. Zero allocations.

The AI solution was 75x slower than what Hashimoto wrote himself. And the agent had no idea. It thought it had done great work. Hashimoto called this "agent psychosis." Not because the AI was confused, but because anyone watching the numbers without understanding the system would think the AI succeeded. The tests pass. The frame time dropped. The graph looks great.

His quote: "If you don't understand the system, you're going to accept that this is an incredible result. If you understand the system, you'll see better solutions immediately and can do roughly 75x better on throughput."

That's exactly the bet of this essay. The human + AI combination works only if the human can spot the 75x gap. Without that depth, the combination just produces mediocre results dressed up as wins. And Hashimoto is openly pro-AI. He uses it constantly. The point isn't to be against AI. The point is that without depth, you can't tell when AI is doing its best work and when it's stopping at 75x worse than the actual ceiling.


---

## The Zig and Bun story

Zig is a systems programming language designed by Andrew Kelley. He's been working on it for over a decade. Zig has a strict no-LLM policy. 

People assume engineers like Kelley or Carmack hand code because they have to, because AI can't keep up. That's a big part of it, but not the only thing. Even when AI could produce the exact same characters they would have typed, they often choose to write it themselves. Hand coding at the top isn't about productivity. It's about thinking. Writing the code forces you to sit with the design. You choose every name, every boundary, every data structure, and each choice surfaces tradeoffs you wouldn't have considered if you'd just approved AI's output. The understanding from writing a function yourself isn't the same as the understanding from reading a function someone else wrote, even if they're character-for-character identical.

Think about debugging your own code versus debugging someone else's. Same characters. Wildly different experience. When you wrote it, every line has context. You remember why this variable is named what it is, why this function exists, what edge cases you were thinking about. When someone else wrote it, you have to rebuild all of that from outside. It's slower. Sometimes impossible. The understanding wasn't in the code. It was in the writing.

That's why Zig's policy isn't really only about contributor relationships. It's about preserving the thinking that goes into a foundational project. The maintainers don't want AI in the loop because the loop is the thinking. Linux is built this way. Postgres is built this way. The compilers, kernels, and frontier game engines that define the top are built by people who choose to hand code even when they don't have to, because the choosing is the work.

Here's the part that makes the Zig/Bun story, a story. Zig's compile times have been a priority for years. Andrew Kelley said it best: "the compiler is too damn slow, that's why we have bugs." So the Zig team has been doing the hard, careful, multi-year work to fix it. They've replaced LLVM with their own x86 backend. They've built their own linkers. They've been working toward incremental compilation since 2024. In June 2025, the self-hosted backend shipped: hello world compile times went from 22.8 seconds to 275 milliseconds. Compiling the Zig compiler itself went from 75 seconds to 20. With incremental compilation, full first build is 36 seconds, then subsequent rebuilds are ~230 milliseconds. Roughly 125x faster on iteration. Kelley described it: "I just press save in vim and the new errors are literally on my screen in the blink of an eye."

This is what the proper version of "make the compiler fast" looks like. Years of work. Hard architectural decisions. Properly designed. Doesn't break things.

Now Bun.

Bun is a JavaScript runtime built in Zig. Bun was acquired by Anthropic in December 2025. Bun uses vibe-coding style workflows heavily, including Claude Code. Bun runs its own fork of Zig because of Zig's no-LLM policy. They can't upstream their AI-authored changes.

In April 2026 Bun announced their fork compiles Bun's builds over 4x faster than upstream Zig. The two changes: parallel semantic analysis, and splitting LLVM backend output into multiple codegen units. They tried to upstream it.

The Zig team rejected it. The reasons matter.

Core Zig team member Matthew Lugg explained: parallel semantic analysis has been an explicitly planned feature of the Zig compiler for years. It has influenced the design of the self-hosted compiler. It has implications for the language itself, not just the implementation. Bun's implementation, done with AI, was non-deterministic. Roughly 30% of runs produce random compilation errors. That's not a feature, that's a bug pretending to be a feature.

On the multiple codegen units change, the Zig team called it a "waste of time," because they're investing in incremental compilation instead, which "can improve compilation speed by orders of magnitude," not 4x.

This is the full picture. Bun's "4x faster" came from cutting corners on a feature the Zig team had specifically planned, designed the language around, and was implementing carefully. The corners Bun cut introduce random compile failures. Meanwhile, the proper version of the same work, done by the Zig team without AI, was already in progress and delivers way bigger speedups without breaking determinism.

And to be clear, this isn't a case of bad engineers using AI badly. Jarred Sumner and the Bun team are excellent developers. That's the point. The wall they hit wasn't a skill issue. Even strong engineers, working heavily with AI on a serious codebase, cut corners the careful approach specifically chose not to cut.

---

## AI is not that good yet

Right now the top 0.01% of human engineering does work AI cannot do yet.

AI is built on datasets. Datasets are backward-looking. Creativity is forward-looking. The work that defines the top of any technical field is by definition not in any dataset yet, because if it were, someone would have already done it. That's the structural reason these people are doing work AI cannot reach.

There's a technical version of this argument too. LLMs are bounded by their training distribution. If the task isn't well represented in the pretraining or post-training data, the model will most likely struggle or fail. The model interpolates between patterns it has seen. It doesn't extrapolate to genuinely novel work.  (Song et al., arxiv 2602.06176) traces this back to the training objective itself: next-token prediction biases models toward "local pattern completion over global logical planning." The model is trained to predict the next likely token, not to actually plan or reason. <mark>Andrej Karpathy</mark> put it well at Sequoia AI Ascent 2026: "Agents are jagged ghosts, not animals. LLMs can simultaneously refactor 100K-line codebases and find zero-day vulnerabilities, yet tell you to walk 50 meters to a car wash with your car. This jaggedness comes from RL training circuits: if your use case falls within the RL reward distribution, you fly. If not, you struggle." The "Is Chain-of-Thought Reasoning of LLMs a Mirage?" paper (arxiv 2508.01191) showed the same thing in controlled conditions. Researchers trained LLMs from scratch and found reasoning works on in-distribution tasks and gets fragile under even moderate distribution shifts. LLMs might improve. But that's not confirmed, and I'm talking about what exists now and in the near future.

The gap between this tier and AI isn't a percentage. It's categorical. AI couldn't have built Linux alone, or with no technical help from a deep technical person. I believe this simply because it doesn't have that level of skill and depth. For AI to build something like Linux on its own, the way it's made and how it works will probably have to fundamentally change. That's just what I think.

In simple words, I don't think LLMs ever reach that tier. The reason is structural. Here is why:

The future is impossible to predict. AI might keep getting better. It might hit a wall. I don't know.

But here's a thought. Maybe intelligence isn't something humans run, like a program. Maybe it's something humans are. Evolution spent 4 billion years on it. Started with the simplest cells. Compounded forever. Real intelligence runs on chemistry and physics, natively.

AI is something different. It's a model of intelligence built from the outside. It looks at what intelligent things tend to say, and tries to predict the next word. By doing that well, it produces things that look intelligent. But producing outputs that look like intelligence isn't the same as being intelligence.

To actually get to the real thing in silicon, you'd probably have to repeat something like the 4 billion year process. Not just train bigger models on more text. Build it from the bottom, the same way evolution did.

That is why I think the fundamental process is wrong. I don't think biological creatures have anything unique about them, or that intelligence is impossible in silicon. Intelligence is just simple things scaled up: neurons scaled into brains, replication and selection scaled into evolution. If we ever pull off the same kind of scaling-up in silicon, the result could blow past human intelligence. I'm bullish on the goal.

But what you scale matters, and right now we're scaling the wrong thing. LLMs scale prediction. They train on basically every word humans have written and learn to guess the next one. Scale that up enough and the model gets really good at guessing words. Which sounds like thinking, because thoughts come out as words. But it isn't. It's scaling the imitation, not the engine.

I don't think biology is the only possible substrate. Silicon might produce something genuinely new and useful over the next 50 or 100 years. But it'll probably be a new kind of thing, not a copy of human intelligence. And the version that quietly surpasses humans at deep technical work, the one a lot of AGI takes assume is coming. I'm skeptical the current approach gets there.

But I'm not sure to be honest.

---

## Why my situation is different from lots of others

I'm 13. I'm not trying to get a job. I have years before I'm in the market. I can do the pure handwriting path. Build foundations the way people built them before AI, then add AI on top once the foundation is solid. That's available to me because I have time.

Hand coding doesn't make sense for me because handwriting code is inherently virtuous. It makes sense because I have something most people learning to code today don't: time. Working adults telling me to vibe code are partly giving advice from their constraints. Their advice is right for their situation. Not necessarily mine. I can take the slow path that produces the deep engineer they couldn't afford to become.

I have a general idea of where I want to go. Low-level systems, networking, and hardware-adjacent work. But the bigger commitment is to the area itself: work where implementation details aren't abstractable away, where problems are novel by definition. AI is genuinely weak there. The most recent benchmark I've seen, KernelBench-X (arxiv 2605.04956, May 2026), tested LLMs on 176 GPU kernel tasks. GEAK scored 30.7% correctness. Direct prompting Claude got 22.7%. That's the state of the art on performance-critical low-level code, which means it isn't usable for production. Maybe I end up doing kernels. Maybe something adjacent. Either way, that's where I'm pointed.

Those numbers are not yet high enough for me to give up on what I love doing most.

If you don't know where you want to go, depth still gives you optionality. Deep systems people can move into webdev easily. Shallow webdev people can't move into systems. The skill transfer goes one direction.

## Slightly more on KernelBench-X

The five methods tested cover every approach the field currently has. AutoTriton and KernelLLM are models specifically fine-tuned for this task. They got 17% and 0%. GEAK and KernelAgent are agentic frameworks (multi-agent systems with iteration) running on DeepSeek-V3.2, a frontier model roughly comparable to Claude Opus 4.5 or GPT-5.4 on coding benchmarks. They got 30.7% and 10.8%. Claude (likely Opus 4.7 given the paper's May 2026 submission date) on its own got 22.7%. So an entire agentic framework with multiple iterations and agents on top of a frontier model gets you about 8 more points than just asking Claude once. Not much. And the paper's actual point is that the bottleneck isn't which model you use. Task type mattered three times more than which method was running. The same categories failed across every method tested. 72% of fusion tasks failed across all five. Quantization was 0% across the board. So a stronger model wouldn't really change the picture. The wall isn't "wait for the next model." It's structural to how these models work right now.

---

## Conclusion

Why do people think hard skills don't matter anymore? That you can prompt your way to depth? You can't. AI isn't a shortcut. It's a slot machine, and young devs can't stop pulling the lever. Becoming great still takes the same hard hours of coding and understanding it always did.

But anyway,

What a moment to be alive if you love building. Anyone can build almost anything now. Solo founders shipping cool products. Researchers researching cool things. Non-technical people building software for themselves. For me, AI is incredible too. It speeds up the boring stuff. It teaches me concepts I'd have taken way longer to learn.

But for the work I love, I keep coming back to hand coding. Not from stubbornness. From genuine belief that the empty file is still the best teacher there is, and that vibe coding will not make me a better vibe coder.

I'm 13. I have time. I'd rather spend it becoming someone who deeply understands what they build.

Anyway, hope you didn't regret reading this. Feel free to leave some comments.

---

## Definitions

**Vibe coding.** You describe what you want, AI implements, makes a plan, you go back and forth and ship it.

**AI-assisted coding.** You write most of it yourself. AI helps with autocomplete, lookups, debugging, conceptual questions, generating small pieces. You understand every line because you wrote it.

**Trad-coding.** No AI, or close to none. You think for yourself and code by hand.

**Agent-driven coding.** For this essay, basically the same as vibe coding.

**AI-tutored learning.** Using AI to explain concepts and answer questions.

AI-assisted coding is here to stay. The argument is about strict vibe coding versus actually writing the code yourself. (I have ideas about autocomplete and LSPs too, but that's a different post.)

---
