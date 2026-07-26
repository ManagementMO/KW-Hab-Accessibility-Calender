# Belonging Loop

A polished frontend prototype for concept in [BELONGING-LOOP.md](./BELONGING-LOOP.md). It demonstrates a truthful, privacy-aware path from an individual's event wish to event preparation, a private event circle, and coordinator-reviewed support options.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

## Validate

```bash
npm test
npm run build
```

## Prototype flows

- **Home:** picture-first choices and a voice-first request lead to a small set of recommended events.
- **Recommended:** three visual sample events explain what, when, where, cost, bus information, group/noise cues, support, and whether sign-up is required.
- **Event details:** an Easy Read description, tap-to-listen controls, visual arrival steps, and sourced access framing make an event understandable before attendance.
- **My Week:** saved events create a simple, printable, fridge-friendly schedule with transport and support reminders.
- **Event Circle:** a private, host-moderated event space has updates, chat, consent-approved photos, private attendance, and optional contributions.
- **Support:** participants choose a kind of help first, then make a simple request to staff rather than browsing a worker database.
- **Staff tools:** event authoring, arrival/access information, moderation, photos, attendance totals, and support coordination remain distinct from the participant interface.

## Presentation modes

`Easy Read` is the default, `Audio First` makes speech controls prominent and slower, and `PECS mode` turns the home choice flow into picture-only cards. The prototype uses browser speech synthesis and hard-coded demonstration data.


## Boundaries

This is a frontend-only demonstration using mock data. It does not diagnose people, claim universal accessibility, automatically assign care, or expose public attendance. Event discovery would remain connected to the Teamup calendar in a production implementation.
