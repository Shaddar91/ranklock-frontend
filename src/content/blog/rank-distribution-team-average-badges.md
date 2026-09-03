---
title: "Deadlock rank distribution: what a band on RankLock measures"
description: "A band on RankLock is a match's team-average badge, not a player's rank. Obscurus carries 19.7% of measured matches, Eternus 2.1%, across 4.68 million games."
pubDate: 2026-09-03
author: RankLock team
tags: [ranks, method, data]
liveHeroes: []
liveItems: []
---

A band on RankLock is not a player's rank. It is the team-average badge of a
single match, and mixing up the two is the easiest way to misread every
number below, on this page and on every band-filtered table across the
site.

## The badge is a team average

[The pipeline](/methodology/) never reads an individual player's MMR. What
it reads is a badge, a team-average rank value the upstream match data
assigns to every player in that match. All six players on a team carry the
same badge for that game, whatever their own personal rank happens to be
that week. No raw MMR number is stored anywhere in the pipeline, so there is
no more precise figure sitting behind the badge for a future page to reveal.

## What that makes a "band"

Divide the badge by ten and you get the band, twelve of them running from
Obscurus through Eternus. That division powers the rank filter on the
[heroes grid](/heroes/): set it to Archon and the page recomputes every
win rate using only matches whose team-average badge landed there. Because
the badge describes a match rather than a person, a band is a bucket of
matches, not a bucket of players. A player whose own rank sits at Archon
can still appear inside a lower or higher band on any given night,
depending on who filled the other five slots.

The same badge also drives a coarser, five-way split used on the item
tables, All ranks through Ascendant-Eternus, rather than the twelve-band
split used here. Both groupings read the same underlying number; they just
draw the lines at different widths. [Item win rates by rank](/blog/item-win-rates-by-rank/)
covers that five-way version and what a thin bracket does to a win rate.

## The shape of the ladder in the data

Summed across the current window, the twelve bands carry 56,145,122 hero
picks. Since every match produces twelve picks, that works out to roughly
4,678,760 measured matches. The share running by band: Obscurus 19.7%,
Initiate 5.1%, Seeker 8.8%, Alchemist 6.1%, Arcanist 7.0%, Ritualist 8.2%,
Emissary 10.3%, Archon 9.3%, Oracle 11.2%, Phantom 5.6%, Ascendant 6.5%, and
Eternus 2.1%. Obscurus alone carries close to a fifth of every match in the
window, nearly double Oracle, the next largest band, and Eternus carries the
smallest share of any tier. The seven bands from Seeker through Oracle hold
60.9% of matches between them and stay within 5.1 points of one another, a
much flatter run than the sharp spike at Obscurus and the long taper into
Eternus at the other end. Read that shape for what it measures: a
distribution of matches by team-average badge, nothing more.

## Why the two are not the same number

Averaging six badges into one pulls a match toward the middle even when the
players inside it don't sit there. A lobby of five Oracle players and one
Eternus player folds into whichever band the average lands on, not into
Eternus, so a team-average distribution carries thinner tails than a true
per-player one would show. Take a hypothetical lobby of three Obscurus
players and three Seeker players instead: the average badge lands at
Initiate, a band with none of the six actual players in it.
Run that pattern across millions of matches and both ends of the ladder read
smaller than the players sitting there would suggest, not just the top.

Eternus's 2.1% share of matches is a floor on how many Eternus players exist
in the data, not a count of them, and the same logic holds at the other end
for Obscurus's 19.7%. Neither share is a census. Both are what's left after
every mixed lobby that included an extreme-band player got folded into
whatever band its six-player average actually reached, and the real
per-player counts at both extremes sit somewhere above the number this page
can show.

## What per-player rank will change

RankLock has no page today that answers how many players sit at each rank,
because the pipeline has no per-player rank to draw one from. The closest
working surface is the [leaderboard](/leaderboard/), which orders players by
their own latest match badge, requires at least five matches to qualify, and
sorts from the top down. That five-match floor is the one place on the site
where a player-level minimum sample requirement shows up at all; everywhere
else, the match count that matters is the one behind the band, not the one
behind the person. When per-player rank lands in the pipeline, the same
band selector
starts describing players instead of lobbies, and every share quoted above
needs measuring again under the new definition. [Leaderboard, badges, and
the MMR you will not find](/blog/leaderboard-badges-not-mmr/) covers how
that leaderboard orders players today.

## Reading a band number without over-reading it

A per-band win rate is a statement about lobbies of that average strength.
That is the right frame for a pick decision: filter to your band, and the
number describes games shaped like yours. It is the wrong frame for a claim
about the playerbase, because a band was never built to count people, only
to describe the matches they played. This page can support "Oracle carries
11.2% of matches" as a fact. It cannot support "11.2% of players are
Oracle," a different claim entirely, since the same match can draw its
average badge from six players none of whom sit at Oracle individually. The
[rank bands guide](/blog/rank-bands-hero-choice/) walks through using a
filtered win rate for exactly the first purpose.
