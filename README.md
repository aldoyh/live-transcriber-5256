# نصّ — Arabic YouTube audio transcription

Arabic RTL transcription workspace with self-hosted Tajawal, neutral charcoal surfaces, restrained red accents and a green capture action. Promotional panels, slogans and the commercial badge have been removed. The interface prioritizes source controls, transcript editing, session history and operational activity.

## How to use
1. Open the app in desktop Chrome over HTTPS (localhost works for development). Inside an embedded preview, use **فتح التطبيق في تبويب مستقل** to open the standalone app; the entered source URL is preserved.
2. Paste a valid YouTube video/live URL and open its tab. The URL validates the source; it does not download the video or capture audio automatically.
3. Confirm permission to process the audio, click Start, choose **Chrome Tab**, select the YouTube tab, and enable **Share tab audio**.
4. Play the video. Captured audio is converted locally into standalone mono 16 kHz WAV chunks around 12 seconds long.
5. Read/edit Arabic output. Stop flushes the final chunk. Copy or download TXT/SRT. Sessions and activity are saved in server-side SQLite; the browser retains a fallback copy and an outbox for failed writes.
Start inside an embedded preview opens the standalone app rather than requesting capture inside the iframe. Missing URL/consent is explained visibly. Web Audio is unlocked during the click gesture; processor startup has bounded waits and shows its setup phase.

## Backend
Typed oRPC `transcription.chunk` calls Gemini 3 Flash through the provisioned AI gateway (SDK v3 protocol). Flash-Lite was unavailable on the gateway; Flash audio input was tested successfully. Transcribes Arabic faithfully and translates other speech into Arabic. No extra provider key is required. Calls consume gateway usage credits. Input format/size checks, per-caller rate controls and process-local global concurrency/rate limits are applied; no user authentication is included.

Audio is not saved by this application. Only audio, not captured video frames, is sent to inference. Provider processing/retention follows the gateway/provider policies; we do not claim provider-side zero retention.

## SQLite storage
The managed database uses SQLite/libSQL with Drizzle. Verified SQLite engine version: 3.47.0.
- `transcript_sessions`: source URL, title, content mode, timestamps, duration and editable transcript segments.
- `transcript_activity`: append-only operational events, session association, event/receipt times, before/after transcript changes, capture lifecycle, model request/result/error details, processing latency, copy and exports.
- All reads and writes are scoped by a random device-held workspace capability. Only its SHA-256 hash is stored in the database; there is no public session listing. This is not account authentication or cross-device login. Clearing the browser's workspace key removes access to that workspace's records.
- Existing local sessions migrate once. Failed writes remain in a local outbox and can be retried; the UI reports connection and saving errors. The database has no 30-session retention limit; the local fallback keeps 30 sessions.
- Activity is inspectable in **سجل النشاط**, with pagination, expandable details and JSON export. Audio/video blobs and API secrets are not stored in these tables.

For another database, provision the root `.env` values and run `bun run db:push` from `packages/web`. Never commit `.env` or real credentials.

## Limitations
- Desktop tab capture requires user consent; it cannot auto-select or verify the chosen tab. Mobile typically cannot capture tabs; history/edit/export remain available.
- Updates arrive per chunk plus model/network processing latency, not word by word.
- Chunk timing is capture-session-relative, not video-relative or word-aligned. SRT captions use approximate chunk timing.
- Transcription/translation can contain errors; review before reliance.
- Failed chunks stop capture, remain in memory for retry, and can be explicitly discarded. Queues are bounded. Closing the page loses pending audio. No invented fallback transcript is shown.
- This app has no login. Before exposing a large public service, add authentication and per-user spending limits.

## Verification
`bun run build`, `bun run lint`.
`tests/verify-transcription.py`: simulated browser capture using real sample audio, real typed API/gateway Arabic translation, final chunk flush, editing/history persistence, SRT export.
`tests/verify-errors.py`: browser permission denial, missing tab audio, failed chunk retry/discard, new-session reset.
`python tests/verify-workspace.py`: real database round trips, transcript revision audit, restoration without local session cache, workspace isolation, offline outbox/retry, activity JSON export and responsive layout. Controlled transcript fixtures in this test are not live transcriptions.
`xvfb-run -a python tests/verify-real-chrome-capture.py`: native headed Chrome captures a local audio-playing tab and sends real captured audio through the API/gateway, producing Arabic text without capture or API mocks. Chrome's automation flag selects the tab; this does not verify manual picker consent or a YouTube livestream in the user's environment.
Capture requests favor Chrome tabs and exclude monitor/system audio. The interface displays the selected source and warns after eight seconds without audible input. These preferences cannot bypass Chrome's permission picker.
`tests/verify-manual-picker.py`: headed Chrome with default autoplay and no auto-selection or screen-capture permission override flags. Native picker was operated through OS-level clicks; the local audio-playing tab produced Arabic through the real API, without runtime errors. This is not a test of the user's environment or an actual YouTube livestream.

Run web: `bun run dev` (fixed port in `__ports.cjs`).
