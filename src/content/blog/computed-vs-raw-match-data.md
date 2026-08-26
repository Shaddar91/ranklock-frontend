---
title: "What RankLock computes and what it does not"
description: "Match pages expose raw scoreboards; tiers, matchup tables, lane curves, and buy timings are computed on top of them within a stated window. MMR and rank distribution stay dark on purpose."
pubDate: 2026-08-26
author: RankLock team
tags: [meta, data]
---

Every number on RankLock sits in one of two layers. The raw layer is the match
record itself, what both teams did, game by game. The computed layer is
everything the site derives from those records: tiers, matchup tables, lane
curves, buy timings. Knowing which layer you are reading tells you how much to
trust a number and how to check it.

## The raw layer

Start at the [matches page](/matches). Every match row exposes both teams' full
scoreboards: kills, deaths, and assists, net worth, last hits, denies, and
damage. Nothing on that page is derived. It is the record of what happened in
that game, and it is the layer every other page on the site is built from.

Raw records are where you go to study a single game. After your own matches,
the scoreboard answers the questions a win-rate never will: who farmed, who
fought, whether your net worth kept pace with your last hits, and where the
damage came from in the fights that decided it. What a scoreboard cannot show
you is a pattern, because a pattern needs more games than anyone can read by
hand.

The raw layer is also the audit trail for everything else on the site. Every
computed figure in the next section is a count over these records, so any claim
you doubt can be chased back to the games it came from. When a matchup table
says a hero struggles into Seven, the matches behind that line are open for
inspection. Few stats pages anywhere let you do that.

## The computed layer

The computed layer aggregates raw records across the window:

- The [heroes grid](/heroes) turns match records into per-hero tiers from S to
  D, with win-rate, pick rate, and KDA per hero, filterable by mode and rank
  band. As of the 2026-08-22 patch, [Seven leads it at 55.9% on a 3.7% pick
  rate](/heroes).
- Hero pages go deeper: per-bracket win-rates, matchup tables with match
  counts, and per-hero item win-rates like [Lash's Magic Carpet at 64.0% across
  636,736 games](/heroes/31).
- [Lane Lab](/lane-lab) computes the median souls curve, about 6,060 souls at
  9:00 for the median player, and attaches a win probability to each 9-minute
  souls threshold.
- The [items page](/items) computes average buy timing, such as [Improved
  Spirit at about 14:00 across 7.9 million matches](/items).

Each of these is the same operation at a different grain: count what happened
across many raw records, then divide. A tier is an ordering of those quotients,
a matchup row is one quotient per enemy hero, a lane curve is a median per
minute. The value is the sample behind the division. A win-rate over 636,736
games is a measurement; the same rate over a weekend's worth of games would be
a rumor, which is why the site prints match counts next to its rates.

One match where a strategy worked is an anecdote. The same outcome counted
across a million matches is a fact about the game, and aggregation is the step
between the two. Every quotient in this layer is a promise that the underlying
records exist and can be opened, which is why the computed pages keep pointing
back at the raw one.

## Every computed number has a window

The computation runs over a stated window, currently 2026-05-01 through
2026-08-23 in Normal mode, and every figure on the site is a statement about
that window. When a patch lands, the numbers drift as the window moves, which
is why our guides anchor each stat to its patch date.

The window is also your honesty check on anyone else's claims. A win-rate
quoted without a window or a sample size is a number you cannot verify, on this
site or anywhere else. When someone tells you a hero is at 54%, the questions
that make the claim testable are always the same: over how many matches, in
which window, at which ranks.

## What the site does not compute

Two absences are deliberate. RankLock publishes no MMR anywhere. The items page
labels its own stats "by badge tier, not MMR", and the
[leaderboard](/leaderboard) orders players by badge rather than any hidden
rating. There is also no rank distribution, so the site cannot back any claim
about what share of players sits in a given tier.

The line we hold is simple to state: if a number cannot be traced back to match
records inside a stated window, it does not go on the site. Invented precision
makes a stats page look richer and read worse, because every figure you cannot
verify teaches you to stop trusting the ones you can. When you see an MMR
estimate or a rank-distribution chart elsewhere, apply the same test: ask where
the underlying records are, and treat the answer accordingly.

## How to read the two layers together

- **Trust the computed layer for populations.** Pick decisions, matchup
  expectations, and economy benchmarks come from aggregated records, and the
  printed sample sizes tell you how firm each one is.
- **Open the raw layer for specifics.** When a matchup line surprises you, the
  match records are where the mechanism lives.
- **Check the anchor before you repeat a stat.** Window, mode, and patch date
  travel with the number or the number does not travel. If a guide or a forum
  post cannot tell you all three, you are holding a rumor, however confident it
  sounds.

Next time any stats page shows you a number, ask which layer produced it. Here,
you can always check.
