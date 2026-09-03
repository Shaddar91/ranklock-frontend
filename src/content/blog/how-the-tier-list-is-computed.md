---
title: "How RankLock grades the Deadlock tier list, S through F"
description: "S starts at 52.5% and F is anything below 47.0%. Seven holds seven heroes, Haze sits on the cut, and picking a rank re-grades every hero on its own data."
pubDate: 2026-09-03
author: RankLock team
tags: [meta, tier-list, method]
liveHeroes: [Seven, Haze, Bebop, Sinclair]
liveItems: []
---

RankLock grades every hero on one number: the measured win rate over the
current data window, 2026-05-01 to 2026-09-03. Six cuts turn that figure into
a letter. S starts at 52.5%, A at 51.0%, B at 49.5%, C at 48.0%, D at 47.0%,
and anything under 47.0% is F. Pick rate, KDA, and popularity never enter the
grade, only the win rate itself, and the same six thresholds apply to every
hero on the roster without exception. See the cuts applied live on the
[tier list](/tier-list/).

## How the roster falls into them today

Thirty-eight heroes sort across the six grades unevenly: S holds 7, A holds
6, B holds 8, C holds 4, D holds 8, and F holds 5. C is the narrowest grade
on the roster by hero count, sitting between the 8-hero B and D grades on
either side of it. S holds Seven at 55.9%,
Victor at 55.6%, Graves at 55.2%, Kelvin at 53.7%, McGinnis at 53.5%, Ivy at
53.2%, and Haze at 52.5%. F holds Bebop and Silver tied at 46.5%, Mina at
46.3%, Venator at 45.3%, and Sinclair at the bottom at 44.7%. Eleven points
separate the top grade from the bottom, Seven's 55.9% against Sinclair's
44.7%, and every other hero on the roster lands somewhere on that line. Check the full spread on the [heroes grid](/heroes/), or see
where [Sinclair](/heroes/sinclair/) falls short of the cut above it.

## A tenth of a point decides a grade

[Haze](/heroes/haze/) wins 52.5% of its games, landing exactly on the S cut.
Drop that number one tenth of a point and Haze grades A instead, with
nothing about how the hero plays actually changing. Dynamo and Paige both
sit at 52.4%, one tenth under Haze, and both grade A for it. The same knife
edge shows up one cut down: Drifter and Mo & Krill both hold 51.1% and grade
A, while Lash and Warden both hold 50.9% and grade B, a 0.2-point gap
deciding the letter for all four. A cut marks a bucket boundary, not a
distance from the middle, so two heroes a full letter apart can sit closer
to each other than either sits to the rest of its own grade.

## Popularity plays no part in the formula

Bebop is the second most-picked hero on the roster, 2,067,938 picks in the
current window, and it grades F at a 46.5% win rate. Venator sits beside it
at 2,012,180 picks and the same F grade. Between them, over four million
picks in the window belong to the bottom grade. At the other end, S-tier's
Kelvin holds the top grade on 873,395 picks, well under half of Bebop's
total. The formula never counts picks, so a hero half the lobby plays and a
hero picked less than half as often get graded by the identical rule:
whether the games they were in were won. Weight the picks by grade instead and the split reads
differently: S carries 19.6% of every pick in the window, B carries 21.5%,
D carries 17.8%, and F, Bebop and Venator's own grade, still carries 14.7%
of the playerbase. A popular hero and a winning hero are separate questions,
and the tier list answers only one of them. See where
[Bebop](/heroes/bebop/) sits against its own pick count.

## A grade is a snapshot, not a recommendation

The tier list re-sorts itself every time the data window rolls forward, and
a hero's letter today says nothing about where it sat a month ago or where
it will sit after the next patch. [Reading the patch tracker](/blog/patch-tracker-meta-shifts/)
covers how a single balance pass can move a hero's win rate enough to cross
a cut in either direction, S to A or F to D, without anything about the six
thresholds themselves changing. Treat the grade as a read of the current
window, re-check it after a patch you care about, and never treat this
week's letter as a permanent verdict on a hero.

## The grade moves when you pick your rank

The [heroes grid](/heroes/)'s band filter reruns the same six cuts against
that band's own win rates, so one hero can hold several grades depending on
who is asking. Haze grades S overall at 52.5%, stays S at Archon (52.6%),
drops to A at Oracle (52.1%), to B at Ascendant (50.2%), and to C at Eternus
(49.4%), four letters across one hero's climb up the ladder. Bebop grades F
overall and climbs two full grades to C at Eternus, where its 48.2% win rate
clears cuts the rest of the ladder can't reach. Filter to your own band before
trusting a letter grade, whichever direction your own rank sits from the
all-ranks figure; the [rank bands guide](/blog/rank-bands-hero-choice/)
covers how far a filtered win rate can move from the headline number.

## What sits behind the number

Every win rate behind every grade comes from RankLock's own fold of public
match data, windowed 2026-05-01 through 2026-09-03, with the newest counted
match landing at 2026-09-02T23:27:36Z. That window holds 56,145,122 hero
picks across the roster, and even Sinclair, the least-picked hero on it,
still clears 802,794 of them. Nothing on the tier list is modeled,
weighted, or guessed, and no MMR feed touches any part of it. The
[methodology page](/methodology/) documents the fold end to end, and [what
RankLock computes and what it does not](/blog/computed-vs-raw-match-data/)
covers the pipeline behind every number on the site, this grade included.
