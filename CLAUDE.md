# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Competition materials and competing strategy proposals for **Impact-a-thon 2026** (UW Blueprint, University of Waterloo, July 11 2026). The challenge comes from **KW Habilitation** and **The Belonging Collective** — 12 ministry-funded developmental-services agencies in Kitchener-Waterloo, of which only 7 actually post events. Their shared community calendar is hard to navigate, overwhelming, and not built for accessibility.

> How might we let community members of all abilities easily discover programming that meets their needs, all in one place?

**There is no application code here yet** — no build, test, or lint tooling exists. The repo holds the source PDFs and three strategy documents written *before* the build. If a prototype gets added, document its commands in this section.

# The live data — this repo's real asset

The Belonging Collective calendar is a **Teamup** board (key `ksakacjdxmrwoqtzym`) embedded at `kwhab.ca/join-us/calendar-of-events/`. Its JSON API is **publicly readable with no auth or API key**. This is the single highest-leverage fact in the repo: any concept here can run on real live data with zero migration, and the numbers in a pitch can be true.

```bash
# Event instances in a date window (verified working)
curl -s "https://teamup.com/ksakacjdxmrwoqtzym/events?startDate=2026-07-11&endDate=2026-09-30" \
  -H "Accept: application/json"

# The 12 subcalendars
curl -s "https://teamup.com/ksakacjdxmrwoqtzym/subcalendars" -H "Accept: application/json"
```

Event fields: `title`, `start_dt`, `end_dt`, `location`, `notes` (HTML), `who`, `rrule`, `series_id`, `subcalendar_ids`, `attachments`, `signup_enabled`, `all_day`, `tz`.

Structural findings that most competing teams will not know. Every figure below was derived from the two calls above over the **Jul 11 – Sep 30 2026** window (219 event instances, 52 distinct titles) and is reproducible on demand:

- The 12 subcalendars **conflate two different axes**: 8 are organizations (DSO, Extend-A-Family, Independent Living WR, Karis, KW Habilitation, Our Studio, Sunbeam, Waterloo Region Family Network) and 4 are attributes (Free / Paid / Virtual / Youth). Cost is encoded as a *subcalendar colour* — invisible to a screen reader.
- **The filters lie.** `YOUTH` and `PAID` match **zero** events in the window; `FREE` carries 124. A user who filters by Youth gets an empty calendar, not a small one.
- **The weekend desert:** **0 of 219** events fall on a Saturday or Sunday (Mon 29 · Tue 70 · Wed 42 · Thu 41 · Fri 37). This is weekday business-hours, staff-run programming. It is the most defensible stat available and the judges cannot fake it.
- **Three org subcalendars are silent** — DSO, Sunbeam, and Our Studio post nothing in the window. The organizers' "why would a nonprofit ever contribute?" question is empirically live, but see the diplomacy note under Non-negotiables before putting this on a slide.
- Nobody uses Teamup's native signup (`signup_enabled` is false on all 219), confirming registration lives entirely outside the calendar.
- 147 of 219 have **no `who` value** and 11 have no notes at all; 24 carry flyer **images** as attachments, locking date/cost/location inside a PNG.
- 34 instances are closed registration-gated sessions (`who` = "People who registered through LEG Up!") sitting alongside open drop-ins, so *"can I even show up?"* is unanswerable from the listing.
- Recurrence dominates (18 recurring series behind those 219 instances), so instance counts are far larger than the number of distinct programs. It also means the calendar has a stable weekly *rhythm* — which is what makes routine- and club-shaped framings credible.
- Nonprofits contribute today by **emailing KW Hab**, who re-types events into Teamup by hand. Registration is fragmented per agency (KW Hab uses WooCommerce) and is **explicitly out of scope** — deep-link out to it, never rebuild it.

**Re-fetch and recompute before quoting any statistic.** The three strategy docs cite different counts (384 instances, 219 occurrences, 102 events) because each used a different date window — they are not contradictions, but a number said on stage to the nonprofit that owns the calendar has to be one you just derived yourself.

## The three strategy docs are alternatives, not layers

This is the thing that isn't obvious from the filenames. They were written independently and **recommend different products**. Do not try to merge them.

| File | Recommends | Character |
|---|---|---|
| [WINNING-IDEAS.md](WINNING-IDEAS.md) | **"Belle"** — outbound weekly phone calls, clubs replacing the calendar grid, a data-driven Gap Map, symbol/easy-read rendering, print+lobby output | Adversarial and competitive; reasons about what the *rest of the room* will build, then avoids it |
| [IMPACT-A-THON-INDEPENDENT-CONCEPTS.md](IMPACT-A-THON-INDEPENDENT-CONCEPTS.md) | **"Listen First"** (demand precedes supply) or **"First Five"** (rehearse the first five minutes after arrival) — with 8 more ranked concepts and a shared event data model | Written with `WINNING-IDEAS.md` deliberately excluded, as an independent second opinion; more service-design and trust-model rigor |
| [BELONGING-LOOP.md](BELONGING-LOOP.md) | **"The Belonging Loop"** — a synthesis fusing seven ideas (wishes, access facts, AI support-staffing, event circles, contributions, memories, cooperative momentum) | The most complete product vision and the most dangerous scope; it says so itself and prescribes a deliberately small vertical slice |

The correct posture is **pick one concept and build one polished vertical slice** — every doc independently reaches this conclusion. `BELONGING-LOOP.md` is the largest vision but is only buildable as its own "Build live" list; treat the rest as roadmap.

Where they *do* converge is where the confidence is highest: registration stays external; nothing publishes without human approval; the existing Teamup calendar remains the source of truth rather than being migrated; and collaboration must be demonstrable as a concrete moment, not a row of logos.

## Non-negotiables

**Do not build "another filterable calendar."** The organizers say this in the challenge package explicitly. A polished calendar rebuild scores near zero on originality.

**The four ideas on the organizers' own slide are now the most obvious ideas in the room** — a monthly emailed podcast, an SMS postal-code lookup, an attendance streak, and flyer-photo OCR. They are *permitted*, but using one as the whole twist means competing head-on with the teams who read the same slide. (KW Hab has also already moved on the podcast direction.)

**Low literacy ≠ blind ≠ intellectual disability.** The package calls this out by name, and 25% of the score rides on it. Designing for a single generic "accessible user," or shipping an "accessibility mode" toggle with font size and contrast, is the failure case. Each persona needs a *distinct* interaction and a distinct proof. Demonstrate accessibility (axe scan, screen-reader run, reading-grade score, keyboard path) rather than claiming it, and state honestly what still needs testing with real self-advocates.

**Domain landmines the nonprofit judges will probe in the Q&A** — all three docs converge here independently:

- Never label an event universally "accessible" or imply certification. Access facts carry provenance: confirmed / reported / not known, plus an owner and a last-confirmed date. *Wrong arrival information does more harm than missing information.*
- Never infer or store a diagnosis. Match on situational needs ("quiet group", "step-free route"), not on disability.
- AI recommends; a human approves. Nothing auto-publishes, and AI never assigns care, approves a volunteer for physical support, or decides media consent.
- Never gamify receiving care, disclosing a need, or attending despite discomfort. No streaks, no public leaderboards.
- Volunteer help must never substitute for required paid care.
- Photos require event-specific, revocable consent; participation must remain possible without appearing in media.
- Don't name-and-shame the quiet partner agencies on stage. Pitch the structural gap, keep per-org contribution health as a private admin view framed as opportunity.

**Answer "why would a nonprofit ever contribute?"** The organizers ask this directly. Ministry-funded agencies respond to participation evidence for funders, fewer repetitive access questions, validated demand before spending program money, and filled seats — not to a new CMS. Any flow that makes agency staff learn a new tool or re-enter data is a feasibility loss.

## Source materials

The PDFs are the ground truth; the markdown docs are interpretation. Read the PDFs directly when a claim matters.

- `impact-a-thon participant package.pdf` — the challenge, deliverables, judging criteria, pitch rules
- `KW Hab - Scoping Notes.pdf` — the nonprofit's own meeting notes: current tools, challenges, NPO-staff and end-user needs, AODA
- `Impact-a-thon Opening Ceremonies.pdf` — event-day logistics
