---
name: brainstorm-to-ship
description: Use when starting a feature, redesign, or non-trivial bug fix in the Hebrew Reader app (hebrew-reader.html) — from a rough idea, a bug report, or an external research or design document — before writing any code.
---

# brainstorm-to-ship

## Overview

The feature pipeline this repo actually runs on, reconstructed from its own git
history (60+ commits, 32 specs, 7 plans), not invented. Five stages: ground the
idea in evidence, design, plan (sometimes), build in phases, ship in one batch.
Each stage's mechanics come from another skill; this one adds the project's own
shape on top. Mechanical gotchas (service worker, line endings, test isolation,
AI budget) live in `CLAUDE.md`, not here — they apply regardless of whether
this pipeline is in use.

## When to use

A new feature, redesign, or non-trivial bug fix. Not a one-line fix or a typo —
those don't need a spec, just `CLAUDE.md`'s gotchas directly.

## The five stages

**1. Ground it in evidence.** **REQUIRED SUB-SKILL:** superpowers:brainstorming
for the mechanics. One addition: if the trigger is an external artifact — a
research document, someone else's design — fact-check its claims against the
actual code before trusting it. What it got right, what it got wrong, and what
it describes that's already built becomes the spec's opening section. If the
trigger is George's own report instead, quote him directly — every spec here
opens with a "Where this came from" section in his words, not a paraphrase.

**2. Spec** — `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, approved
before any code changes. Two structural elements worth keeping: phased sections
for multi-part work ("Phase 1 — X"), and a "Deferred, with reasons" section
naming what was deliberately left out — a reader later should be able to tell
"not done yet" from "considered and rejected." Commit the spec alone, before
touching `hebrew-reader.html`. (`docs/superpowers/specs/2026-08-26-retrievability-and-grading-design.md`
is a representative example.)

**3. Plan — only for genuinely multi-phase work.** This project deliberately
overrides `superpowers:brainstorming`'s hard gate that the only skill invoked
after it is `writing-plans` — that skill has no lightweight path of its own
(it always produces a full task-by-task document), and most work here is
already right-sized by the spec's own phased sections. **REQUIRED SUB-SKILL:**
superpowers:writing-plans, but only invoke it when the spec is genuinely
multi-phase and independent phases each need their own file breakdown — most
specs here go straight to implementation with no separate plan file (roughly
1 plan per 4–5 specs). When one is warranted:
`docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, not committed alone — it rides
in with the first implementation commit.

**4. Implement in phases, one commit per phase.** Read the code a phase
touches, make the change, add tests that fail on wrong behavior (not tests
that confirm what you already believe), verify per `CLAUDE.md` before trusting
a result, then commit. Message voice: a narrative, specific, present-tense
title — never "Add feature X" — and a body explaining *why* and the tradeoff
chosen, not the diff, ending with a Co-Authored-By line. Touching the map or
drill card: read `docs/style-guide.md` first.

**5. Ship: batch the push, verify live.** Commits accumulate locally across
the whole feature; push once, at the end or when asked, never per phase. Then
poll the GitHub Pages URL, clear caches against the *live* site per
`CLAUDE.md` (the stale-shell trap applies there too), and confirm a
new-build-only function is actually present — not just that the page loads.

## Quick reference

| Question | Answer |
|---|---|
| Spec location? | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Plan location, and when? | `docs/superpowers/plans/`, only for genuinely multi-phase work |
| Commit granularity? | One per phase |
| When to push? | Once, at the end or when asked — never mid-feature |
| Trigger is an external document? | Fact-check against the code first; that becomes the spec's opening section |

## Common mistakes

- Pushing after every commit — breaks batch-review-then-ship, puts half-built phases live.
- Trusting a document's claims about this codebase instead of checking them.
- Writing a plan file for something that's really one phase, or skipping one for 4+ independent phases.
- Verifying with a plain reload instead of clearing the service worker — you'll debug a bug that's already fixed.
- A commit message describing the diff instead of the reasoning.
