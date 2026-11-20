# Practice everywhere: cards on the lock screen, your own week, saying it for real, Hebrew on the move, a live coach

## Where this came from

An overnight review of both apps (19–20 Nov 2026) read his own numbers back to him: words held
strong flat at about 60 since 23 Oct (63, now 59), spoken answers right about 45% of the time,
0.2 h of Hebrew in the week against a 3.5 h target, sessions of 11 to 26 minutes when they happen,
several opened and left at zero cards, "words said live" 0 of 15. The practice itself is good; the
problem is how little of it happens, and that none of it reaches a real conversation.

Five ideas went to George on the review page and he approved all five the same evening. On the live
coach his note was: *"If this is free and on the API then yes."* Google's pricing page lists
`gemini-3.8-live` as "Free of charge" on the free tier, and the Live API lists Hebrew (`he`) among
its languages, so it qualifies.

His earlier words about the coach, from the flags: *"The coach is actually useless … unusable"*
(10 Nov) and *"The coach is actually so slow"* (12 Nov).

## Phase 1: a card on the lock screen

The planner's three Hebrew pings (09:30, 15:00, 19:00 his time) say "come and practise". Each now
also carries one card: a word he is learning (weak or progressing for saying it), the same choice for
the same ping on every device.

- The notification says *Say it in Hebrew: "tired"* with the ping's own line after it, and one
  button, **Show answer**.
- **Show answer** replaces it with the Hebrew, its transliteration and the English, and two buttons:
  **Got it** and **Missed**. Nothing opens; he can do it from the lock screen in fifteen seconds.
- A tap on the notification itself still opens the app, as it always has.
- The answer is queued by the service worker (IndexedDB, `hvr-sw` → `cards`), because a service
  worker cannot reach localStorage. The app applies the queue the next time it is open or comes to
  the front: an ordinary production answer through `srsAnswer` (logged `kd: "push"`), one card in the
  day's stats, and the seconds between Show answer and the grade (capped at a minute) as practice.
- A self-graded card here is exactly what a self-graded card in a session is, so it moves the
  schedule like one. A card older than three days in the queue is dropped unapplied: the moment has
  gone, and the schedule must not be written against a day long past.

## Phase 2: your own week, in Hebrew

Once a week Claude reads his coming week from the dashboard (the calendar, his plans) and his
Hebrew state (level, the words he can say, the words he is learning) and writes 20 to 30 cards about
that week, in the house transliteration scheme, mostly from words he has, any new word glossed so it
takes the ordinary road through Pending.

- The cards are personal, so they never go near `content/nodes.json`, which is public. They live in
  the dashboard's private sync repo as `hebrew/week.json`, written by the dashboard tool.
- The app reads that file with the dashboard's own settings. Both apps are served from the same
  address, so on a device where the dashboard is set up the key is already there; elsewhere there is
  simply no weekly file. It is read at most every three hours and banked through `learnIngest` as
  usual, with `src: "week"` and `wk` (the week's Monday).
- A `week` item is Claude's writing, so it is kept and served like a `claude` one (`bankIsClaudes`).
  Unlike those its words exist nowhere public, so `bankSlimForSync` leaves its text in the sync file.
- The sentence picker gives this week's unseen cards a lift, at most four a session, so they turn up
  while the week is still the week.
- The file can carry the name of the person he is learning for (`partner`), so no name is written
  into this public code.

## Phase 3: say it for real

"Words said live" counted only words said to the AI coach. The point of all of it is saying them to
a person.

- **Tonight's phrase.** One sentence a day to say to her: from this week's cards marked `say`, else
  from the course at his level. The same choice everywhere: the Learn page, and the dashboard's
  Hebrew widget, whose evening card shows it (as a phrase card) and opens the app with it.
- **I said it.** One tap records it (`hvr_irl`, by day). Its words count as said live for the
  dashboard's weekly target and ladder, and the day gets a spoken rep. Opened from the widget, the app
  asks the one question, *Did you say it?*, and records on yes.
- **It does not move the schedule.** On 3 Nov the app stopped letting the coach's right answers move
  a word's schedule, because unverified credit had inflated "strong" (47 of 60 strong words had never
  been answered on a bare card). A tap saying "I said it" is less verifiable than the coach, so it is
  logged and counted as real-life use, and the schedule stays with the cards.

## Phase 4: Hebrew on the move

Hands-free, screen-off listening for the walk to the park, the run, cooking, a flight: the English,
a pause to say it, the Hebrew slowly, then at normal speed.

- **The voice.** The device voice cannot play with the screen off or be recorded, so clips are made
  ahead on the laptop with a free natural Hebrew voice (Microsoft's Hila, through `edge-tts`), and an
  English one for the prompts: `tools/audio/build.py` writes `audio/clips/<id>.<he|slow|en>.mp3` and
  `audio/index.json`. Only public course content is ever sent to the voice service.
- **The episode is his.** The app picks 40-odd sentences from his own bank, the ones his due words
  need most, fetches their clips (cached for good: a clip's name is its text's hash), and lays them
  end to end with the pauses into one track on the phone. One track plays with the screen off and
  shows on the lock screen with play, pause and skip.
- **It counts.** The seconds actually played go into the day's practice time.

## Phase 5: a coach you can talk to

The coach was record, wait, read. This is a call: he speaks, it answers in Hebrew in a second or two,
he can interrupt it, and it can hear him hesitate.

- Google's Live API (`gemini-3.8-live`, free tier) over a WebSocket, with the key already in
  Settings. The microphone goes up as 16 kHz PCM; the answer comes back as 24 kHz PCM and plays as it
  arrives. Both sides are transcribed and shown.
- It is told his level, the words he can say and the words he is learning, the transliteration does
  not matter (it is spoken), to keep its turns short and slow, to answer English with the Hebrew for
  it, and a situation to start from (his week's cards, or a place on the map).
- Fifteen minutes at most (the API's own limit for audio). The words of his library that he said are
  credited as said live, as the old coach's are, and the call's minutes count as practice.
- If the API refuses (a limit, a key problem, the model unavailable) it says so in a sentence and the
  ordinary coach is still there.

## Deferred, with reasons

- **A page for her to tap when he uses Hebrew with her.** It needs a place she can write to without
  his keys; worth doing only if he wants her in it.
- **Audio for the weekly cards.** They are personal; sending them to Microsoft's voice service is his
  call, not a default.
- **Grading from the widget.** The widget can show and open; buttons on it need a new phone build,
  which is the dashboard's widgets work.
