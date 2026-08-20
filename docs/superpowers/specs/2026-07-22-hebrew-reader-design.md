# Hebrew Voice Note Reader — Design

**Date:** 2026-07-22
**Status:** Built (v1)

## Purpose

George receives Hebrew voice notes and transcribes them. He wants to understand each
message word-by-word — Hebrew script, anglicised (transliterated) pronunciation, and
English meaning stacked per word, reading right-to-left — well enough to build a reply.

## Constraints

- Self-contained: one HTML file, no build step, no server, works offline for the core flow.
- Lives in the "Hebrew Learning" Google Drive folder so it syncs across devices.
- Must handle arbitrary Hebrew input (unvocalised, casual/slang register typical of voice notes).

## Architecture

Single file `hebrew-reader.html` (vanilla HTML/CSS/JS, no dependencies). Data persisted in
`localStorage` (personal dictionary corrections, message history, optional API key).

### Translation engines (three, layered)

1. **Instant / offline** — built-in dictionary (~400 high-frequency conversational
   words + multi-word phrases) with clitic-prefix stripping (ו, ה, ב, ל, מ, ש, כ, כש).
   Unknown words get a rule-based letter transliteration and are visually flagged.
2. **Claude API (optional)** — user pastes their own Anthropic API key in Settings.
   Direct browser fetch to `POST /v1/messages` with the
   `anthropic-dangerous-direct-browser-access: true` CORS header, model
   `claude-opus-4-8`, structured output (`output_config.format` json_schema):
   `{translation, words:[{hebrew, translit, english}]}`.
3. **Copy prompt / paste result** — free path with no key: app copies a prompt to the
   clipboard; user pastes it into any AI chat, then pastes the JSON reply back into the app.

### Display

- Word cards in a `dir="rtl"` flex-wrap container → message reads right-to-left, wrapping
  naturally. Card = Hebrew (large) / transliteration / English.
- Punctuation rendered as its own slim card; blank lines split messages into blocks.
- Natural full-message translation shown beneath (AI modes).
- Toggles to hide transliteration or English (self-quizzing).

### Learning loop

- Click a word card → edit its transliteration/English. Edits are saved to a personal
  dictionary in `localStorage` that overrides the built-in dictionary in future messages.
- Save button stores the message (transcript + gloss) to a history list; reload/delete.

## Non-goals (v1)

- English→Hebrew composition help (may add later).
- Niqqud-accurate transliteration in offline mode (impossible without vowels; AI modes solve it).
