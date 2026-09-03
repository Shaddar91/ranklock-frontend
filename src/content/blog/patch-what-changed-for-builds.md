---
title: "What the {{PATCH_LABEL}} patch changed for builds"
description: "The {{PATCH_LABEL}} patch touched {{CHANGED_COUNT}} things. Which of them reach a real build, measured over {{SAMPLE_N}} ranked matches, and which are noise."
pubDate: 2026-09-25
author: RankLock team
heroImage: /assets/heroes/haze_card.png
tags: [patch-notes, builds, meta]
liveHeroes: []
liveItems: []
draft: true
---

The {{PATCH_LABEL}} went live at {{PATCH_DATE}}. This post goes up the same day
and opens with no win-rate table, because on the first day there is no honest one
to print. What it has instead is the list of what moved, the reason our numbers
trail it, and a way to read a build while the games that will answer the question
are still being played.

## What changed

{{CHANGED_ENTITIES}}

That is {{CHANGED_COUNT}} changes with a number on both sides of them: an entity,
a field, a value before and a value after. Those are the lines you can plan
around. The rest of a changelog is prose, and prose does not tell you how far
anything moved.

## Why the numbers are not here yet

Our match data runs about {{DATA_LAG}} behind live play, and the lag is the
smaller half of the problem. The window is the larger half.

Every win rate on the heroes grid, the item tables and the build pages is
computed over one long span of matches, months of ranked play rather than
days. Divide a hero's wins by its games across that span a few hours into a
balance change and almost every match in the sum was played under the old values. The arithmetic is
right and the population is wrong. A tenth of a point of movement in a quotient
that size is one busy evening of games, and from the outside there is no way to
separate it from the change that supposedly caused it.

A delta published tonight is therefore not a lie about its own sum. It is a
measurement of a stretch of games that is mostly the previous version of the
game, carrying the new version's name. We would rather wait and print something
you can act on.

The one surface that escapes the problem is a patch window: matches filtered to
the span between one release and the next, which gives every release its own
separate population instead of a rolling average across all of them. That is
where the second half of this post will come from, and it needs games in it
before it can say anything at all.

## How to read a build in the meantime

The long-window number is a prior, not a verdict. It tells you what has been
winning for months, which is the best guess available about tomorrow until
tomorrow has some games in it. Three places to spend the wait:

- **The build page for the hero you play.** [Haze's build
  page](/heroes/haze/build) prints a win rate and the number of games behind it
  for every set, item and first buy. Read the games column before the
  percentage. The same rate over four hundred games and over ninety thousand
  games are two different claims wearing one number.
- **[The items page](/items/)**, for buy timing. A cost or scaling edit shows up
  in the average buy minute before it shows up in any win rate, because players
  change what they buy as soon as they read the note, and change how often they
  win with it only once they have worked out how.
- **[The tier list](/tier-list/)**, for the ordering that is about to be
  challenged. Knowing which heroes sat at the top going in is what makes the next
  wave of numbers readable at all.

The strongest move in the first days is usually to change nothing. A buff pulls
players onto a hero faster than it makes the hero good, so the early sample for
anything the changelog touched is thick with people playing it for the first
time. That drags the measured rate in a direction that has nothing to do with the
balance edit and everything to do with who is holding the hero. Play what you
know while the sample fills in.

## What we publish next

The measured half of this post arrives in a second pass, once enough games have
been played on the new values to divide by, and once the share of the sample
played before release has fallen far enough for the split to mean something. When
it lands, this page gains a movers table and a modified date. If it never lands,
the games were not there, and a missing table is the correct outcome rather than
a hole we filled with a guess.

<!-- wave2:start
## What actually moved

{{MOVERS_TABLE}}

Measured over {{SAMPLE_N}} ranked matches played since the patch went live.
wave2:end -->

Read the changelog for what changed. Come back for what it did.
