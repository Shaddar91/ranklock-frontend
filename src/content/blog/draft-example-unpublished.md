---
title: "Draft example — this guide should never be published"
description: "A draft fixture used to prove the blog's draft:true exclusion works. If you can read this on the live site, the draft filter is broken."
pubDate: 2026-06-21
author: RankLock
tags: [draft-fixture]
draft: true
---

This post exists only as a regression fixture. It carries `draft: true` in its
front-matter and the newest `pubDate` in the collection, so if the draft filter
ever regresses it will surface as the first card on `/blog`, the first item in
`/rss.xml`, and a fresh URL in the sitemap — making the breakage impossible to miss.

A correctly-built site must NOT generate `/blog/draft-example-unpublished/`, must
NOT list this post on the index, and must NOT include it in the RSS feed or
sitemap. The exclusion is enforced by the `({ data }) => !data.draft` filter in
`src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, and
`src/pages/rss.xml.ts`.
