---
title: "Day one of the {{PATCH_LABEL}}: sizing {{CHANGED_COUNT}} changes before the win rates land"
description: "Every line the {{PATCH_LABEL}} moved, with a value on both sides, sized against {{SAMPLE_N}} ranked matches, so you can order the edits on release night without a win rate."
pubDate: 2026-09-08
author: RankLock team
heroImage: /assets/heroes/mirage_card.png
tags: [patch-notes, builds, meta]
liveHeroes: []
liveItems: []
draft: true
---

{{PATCH_LABEL}} shipped at {{PATCH_DATE}}. What follows is every line of it that
carries a value on both sides, and a way to put those lines in order of size
tonight — hours before any win rate has the games behind it to do the ordering
for you.

## The edits, with their before and after

{{CHANGED_ENTITIES}}

{{CHANGED_COUNT}} lines cleared the filter. A line clears it when it names an
entity, the field that moved, the value it left and the value it arrived at.
Anything written as prose is left out here rather than summarised: a summary of
a balance note is a judgement, and judgements are what the rest of the internet
will supply tonight.

## Order them by ratio, not by their place in the notes

Release notes are ordered by whoever wrote them, which usually means by hero and
then by ability. That ordering says nothing about how far anything moved. Divide
the new value by the old one on each line above and re-sort. A few percent either
way is maintenance. A quarter of a value gone is a different ability wearing the
same name, and it is the only kind of line worth changing a habit over on the
first night.

Then split what is left in two. Cooldowns, costs and durations change how often
something happens. Damage, healing and scaling change what happens when it does.
The first kind you feel in the first game you play, because the rhythm of the
fight changes. The second kind hides until a fight lands near a threshold, which
is why it is almost always the second kind that people argue about for a week.

## Two clocks, and why there is no table on this page yet

Our match feed runs about {{DATA_LAG}} behind live play. That is the smaller of
the two clocks, and the one people usually blame.

The bigger clock is the window. Every win rate on the heroes grid, the item
tables and the build pages is counted over a rolling window of {{DATA_WINDOW}}.
Divide wins by games across a span that long a few hours into a release and the
sum is almost entirely games played on the old values. The division is correct
and the population is wrong, so whatever movement shows up in it belongs to last
month's play rather than to the lines listed above.

Waiting longer on that same rolling number does not fix it either, because the
old games leave the window one day at a time. The fix is a different
denominator: count only the games played between one release and the next, which
is what the [patch tracker](/patches/) is for once a release has games in it.

## What the list above is good for tonight

- **The build page of anything the notes touched.** [Bebop's build
  page](/heroes/bebop/build/) prints a set, its win rate and the number of games
  behind it. Read the game count first and treat the rate as a prior about the
  weeks before tonight, which is the only honest thing it can be right now.
- **[The item tables](/items/)**, for the cost and scaling lines. Those reach you
  through what other players buy, and a buy order turns the day people read the
  note — long before the win column agrees with them.
- **[The tier list](/tier-list/)**, as a photograph of the ordering going in. A
  day-one list is worth more later than it is now: it is the before image that
  the next fortnight gets compared against.

The hardest part is doing none of it. A buffed hero fills up with people playing
it for the first time, and their games land in the numerator too. On release
night the measured rate of anything the notes touched says more about who picked
it up than about the edit itself.

## When the measured half arrives

This page gets a second pass once the release has enough games of its own to
divide by, and once the share of the sample played before it shipped has fallen
far enough for the split to mean something. That pass adds a table and a
modified date. If the games never arrive, no table appears, and an absent table
is the correct outcome rather than a gap filled with a guess.

<!-- wave2:start
## What the games said in the end

{{MOVERS_TABLE}}

Every row is counted over {{SAMPLE_N}} ranked matches played inside this
release's own window and no other.
wave2:end -->

The notes tell you what moved. The window tells you whether it mattered.
