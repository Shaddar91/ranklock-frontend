---
title: "Hero matchups 101: how RankLock computes them and how to use them"
description: "A matchup line is a win-rate over a counted sample. Lash beats Bebop at 54.0% across 465,892 matches. Check the match count first, then the rate."
pubDate: 2026-08-26
author: RankLock team
tags: [fundamentals, matchups]
liveHeroes: [Lash, Seven, Bebop]
---

Every hero page on RankLock carries a matchup table: one row per enemy hero, a
win-rate, and a match count. Used well, it is the fastest preparation a draft
gets. Used badly, it sends you dodging games you should play. This guide covers
what the number is, where it comes from, and how to read it without
overreacting to it.

## What a matchup number is

Take [Lash's matchup table](/heroes/31/). His worst common pairing is Seven:
Lash wins 45.0% of the 430,906 recorded matches where the two heroes met. His
best listed pairing is Bebop, at 54.0% across 465,892 matches. Each row is one
measured quantity: of the matches in the data window where Lash faced that
hero, the share Lash's team won.

Two things are baked into every row. The window, currently 2026-05-01 through
2026-08-23, and the mode, Normal. A matchup line is a statement about that
window and that mode as of the 2026-08-22 patch, and it will drift when the
window moves.

The table runs one row per enemy hero, so a hero's whole matchup profile sits
on a single page. The two rows quoted above are the extremes of Lash's profile:
the best listed pairing and the worst common one.

You can also read a row from the other side. Lash at 45.0% against Seven means
Seven won the other 55.0% of those same 430,906 matches. If you play Seven, the
same row that warns a Lash player is encouragement for you. Reading your
opponent's table before the draft is legal scouting: every hero page on the
site is public, and the pairings your pick fears are listed on yours.

## Where the table comes from

The matchup table is computed from raw match records, the same scoreboards you
can open on the [matches page](/matches/). The site counts every match in the
window where the two heroes appeared on opposite teams, then divides wins by
games. Nothing is modeled or estimated; a row in the table is a count and a
division, and [what RankLock computes and what it does
not](/blog/computed-vs-raw-match-data/) walks through that pipeline in full.

That origin explains both the table's strength and its limits. The strength is
sample size: 430,906 matches behind the Seven row and 465,892 behind the Bebop
row are large enough that the measured rates are stable quantities, not streaks.
The limit is aggregation: the count knows nothing about why those games went
the way they did.

## The count is the trust signal

Read the match count before you read the rate. A win-rate measured over half a
million matches is a stable quantity; the same rate measured over a few hundred
games can sit far from where it will land once the sample fills in. The table
prints the count next to every rate so you can weigh the two together.

Both Lash rows above clear the trust bar easily, with samples over 400,000
matches each, so both lines have earned belief. When you meet a row whose count
runs in the hundreds instead, treat the rate as a question mark and check again
once the window fills in.

Nine points of win-rate separate Lash's two extreme rows, and the only thing
that changed is which hero stands across the lane.

The same reading applies to item tables. On [Lash's page](/heroes/31/), Magic
Carpet posts a 64.0% win-rate across the 636,736 games where he bought it, and
Mystic Reverb posts 60.7% across about 1.8 million. Rate and count, same
discipline.

## Using matchups in the draft

- **Scout your hero's worst pairings before you queue.** If your pick wins
  45.0% into a common hero, walk in knowing which games will be uphill and what
  has to go right in them.
- **Turn a 45% line into a plan.** Lash still wins nearly half of
  those 430,906 games against Seven. A negative matchup changes what you play
  for in the lane; it rarely justifies abandoning the pick.
- **Pair the table with your band.** Matchups shift with bracket the same way
  win-rates do, so read them alongside the [rank band
  guide](/blog/rank-bands-hero-choice/) rather than off the all-ranks page.
- **Re-check after patches.** A balance pass rewrites matchup math, and the
  tables move with the data window. The [patch tracker](/patches/) tells you
  when to look again.
- **Check the item table on the same page.** Matchups tell you who beats whom;
  the item table beside them tells you what the winners were buying, with the
  same rate-and-count discipline.

## What a matchup cannot tell you

A matchup line averages both players' decisions across hundreds of thousands of
games. It describes a population, and your lane is not a population. The rate
averages newcomers and veterans alike, and your own record in a pairing can sit
far from the mean in either direction. A Lash who has studied the Seven pairing
can beat the 45.0% expectation routinely, because the number is the starting
point for your preparation; what you do in the matchup decides the rest.

The table also reports outcomes without mechanisms. It tells you that Lash
loses to Seven more often than he wins; it cannot tell you why. Use a bad row
as a prompt to go find the reason, in replays and in your own games, and the
next time you see the pairing you will be playing the version of it you
understand.

Matchups reward the players who read them as measurements. Count, rate, window,
then decide.
