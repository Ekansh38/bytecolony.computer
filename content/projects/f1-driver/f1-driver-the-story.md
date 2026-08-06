---
title: "I Built a Racing Game, My Friends Started Cheating, So I Added Cryptography"
project: "f1-driver"
date: 2026-03-26
status: "done for now"
weight: 1
---

<p>I really like F1. One day I was playing F1 25 on my PS5 and I was having a lot of fun. A part of me wondered, are there any local 2D F1 racing games that are actually fun? I couldn't find any that scratched that itch I had, some had obstacles and unrealistic turning and physics, some where just not fun. So I decided to scratch my own itch. On a Sunday afternoon I set out to build the racing game I always wanted! Custom maps, real F1 physics, laptimes, graphs, telemetry, all that jazz. I started in Pygame and Python because that was the only framework I was familiar with and I was pretty stupid at that time. I had this grand plan to add AI and reinforcement learning to the game, hence the first name, rl-driver.</p>

<p>I started making it on and off, in school and at home (don't tell me teachers...) and I just loved playing, I got hooked by the game play and adding more features like custom tracks, physics, graphs and I completely forgot about the AI part of it. Thus the rename to f1-driver, boring I know.</p>

<h2>The Cheating Problem</h2>

<p>Anyway I got my friends to install it and they loved it, they where playing tons and sending screenshots of there laptimes on our group chat. All was well and good until they found the "params" feature which let you adjust the physics of your car, more acceleration, easier turning, etc. They abused this, just a little and not enough to get caught. I had no idea how there laptimes where so quick, they said they made no changes to params and there was no way for me to prove them wrong with just a screenshot!</p>

<h2>The Insight</h2>

<p>Anyway I let this thought sit in my brain for a few weeks while I went about with my life. I read Grokking Algorithms in this time and had some prior knowledge regarding Bitcoin and cryptocurrency and how it worked. One night, something just clicked. A concept from Grokking Algorithms, hash maps and hash functions came to me. This is the perfect fix I thought! I would use a hashing algorithm like SHA256 along with a secret key that was stored in the binary to "locally" authenticate laptimes.</p>

<p>Now I will dive into my approach but I just want to preface it by saying, I am aware it can be cracked easily by anybody with more than 2 brain cells (hex editor) but my friends have no clue what they are doing and the concept is still valid if I was to host the authentication on a server. But anyway here is how it works.</p>

<h2>How It Works</h2>

<p>The program, after the user completes a valid lap (default params), gets the lap data (laptime, track) as well as the secret key and hashes it all together. In an ideal scenario the client would send this data to a server and the server would return the hash but I am doing it all locally.</p>

<p>First, the lap data and secret key are combined and hashed:</p>

<pre>"1:32.851,monza" + "f1-driver-secret-key"
        |
        v SHA256("1:32.851,monza f1-driver-secret-key")
        |
        v "a3f9c2...8b4e1d"</pre>

<p>This is the certificate the user gets. Their proof to say: hey, this is my laptime!</p>

<pre>Final laptime string:
"1:32.851,monza a3f9c2...8b4e1d"</pre>

<p>If someone doesn't believe them and wants to verify, all they have to do is pass that string to the verifier. It splits out the data and the hash, recomputes the hash using the secret key, and checks if they match:</p>

<pre>Input: "1:32.851,monza a3f9c2...8b4e1d"
        |
        v Data = "1:32.851,monza" Hash = "a3f9c2...8b4e1d"
        |
        v if SHA256(Data + secret_key) == Hash:     print("he want lying!") else:     print("Something is off...")</pre>

<h2>Wait, This Has a Name?</h2>

<p>After I built this I discovered that what I made is actually a well known cryptographic technique called <strong>HMAC</strong> (Hash-based Message Authentication Code). I just reinvented it without knowing it existed, which was a nice surprise.</p>

<p>Here is why it works, even to a non-technical person. Think of it like a wax seal on a letter. Anyone can read the letter, but only the person with the original seal stamp can produce a seal that looks exactly right. In f1-driver, the "stamp" is the secret key baked into the binary. The seal is the hash. If you change the laptime even by one millisecond, the entire hash changes completely, and the seal breaks. You cannot fake a valid seal without the stamp, and the stamp is hidden inside the program.</p>

<p>The weakness is that someone could extract the key from the binary directly (a hex editor would do it). But for my friends, that is not happening. And if I moved the key to a server, it becomes genuinely unbreakable from the outside.</p>

<h2>Where It Ended Up</h2>

<p>I kinda got bored of it and left it around here. You can download it right now via Homebrew or install from source. Checkout the Github for more details.</p>

<pre>brew install Ekansh38/f1-driver/f1-driver</pre>

<p><a href="https://github.com/Ekansh38/f1-driver">github.com/Ekansh38/f1-driver</a></p>
