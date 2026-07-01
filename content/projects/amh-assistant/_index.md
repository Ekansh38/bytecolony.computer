---
title: "AMH Assistant"
weight: 2
layout: "list"
summary: "AI assistant built for a 40-person company. Connects Trello, Gmail, Sheets, WhatsApp in one chat."
stack: "Python · Anthropic API · Composio MCP · Vercel"
status: "live"
shipped: true
live: "https://amh-assistant.vercel.app/"
---

I was hired as an AI Intern at AMH Singapore. Their workflow was all over the place: Trello boards, emails, WhatsApp messages, spreadsheets, none of it talking to each other. So I built a bot that pulls from all of those and can actually answer real questions about what's going on.

Ask it "what should I focus on today?" or "is the XYZ project on track?" and it goes and figures it out. It checks Trello, reads the emails, looks at the sheets, whatever it needs. You get an actual answer, not a list of links to go click yourself.

It also writes back. Send an email, add a Trello comment, log a performance note, send a WhatsApp message. All confirmed before it does anything.

This is a real project being used daily by a team of 40 employees. I built the whole thing.

---

**Trello**

Reads all boards, lists, and cards across the workspace. Pulls full card details including assignees, due dates, descriptions, and all comments (that's where the real status lives, not the card name). Finds overdue or stalled cards, shows who's assigned to what and how loaded each person is. Can create cards, move them between lists, and add comments.

**Gmail**

Searches the inbox by topic, sender, or keyword. Fetches full email bodies, not just snippets, so you get the actual amounts, decisions, and client details. Flags urgent or unread emails. Sends emails directly from your connected account, or drafts them for review first.

**Google Sheets**

Reads data from the AMH Master Log: performance scores, merit points, financial impact, disciplinary events per employee. Cross-references it to produce summaries and recommendations.

**Google Drive**

Searches for and locates files by name across the Drive.

**WhatsApp**

Lists all connected chats, reads message history from any group or individual, searches messages by keyword or date. Sends messages to any group or individual. Admin only.
