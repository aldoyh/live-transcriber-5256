# نصّ — Arabic YouTube audio transcription

Responsive Arabic RTL web workspace, self-hosted Tajawal typography, charcoal/green design. Replaces Frequency's podcast interface; previous podcast source is retained but no longer rendered.

## How to use
1. Open the app in desktop Chrome over HTTPS (localhost works for development). Inside an embedded preview, use **فتح التطبيق في تبويب مستقل** to open the standalone app; the entered source URL is preserved.
2. Paste a valid YouTube video/live URL and open its tab. The URL validates the source; it does not download the video or capture audio automatically.
3. Confirm permission to process the audio, click Start, choose **Chrome Tab**, select the YouTube tab, and enable **Share tab audio**.
4. Play the video. Captured audio is converted locally into standalone mono 16 kHz WAV chunks around 12 seconds long.
5. Read/edit Arabic output. Stop flushes the final chunk. Copy or download TXT/SRT. Sessions are stored in this browser's local storage (last 30), not a cloud account.
Start inside an embedded preview opens the standalone app rather than requesting capture inside the iframe. Missing URL/consent is explained visibly. Web Audio is unlocked during the click gesture; processor startup has bounded waits and shows its setup phase.

## Backend
Typed oRPC `transcription.chunk` calls Gemini 3 Flash through the provisioned AI gateway (SDK v3 protocol). Flash-Lite was unavailable on the gateway; Flash audio input was tested successfully. Transcribes Arabic faithfully and translates other speech into Arabic. No extra provider key is required. Calls consume gateway usage credits. Input format/size checks, per-caller rate controls and process-local global concurrency/rate limits are applied; no user authentication is included.

Audio is not saved by this application. Only audio, not captured video frames, is sent to inference. Provider processing/retention follows the gateway/provider policies; we do not claim provider-side zero retention.

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
`xvfb-run -a python tests/verify-real-chrome-capture.py`: native headed Chrome captures a local audio-playing tab and sends real captured audio through the API/gateway, producing Arabic text without capture or API mocks. Chrome's automation flag selects the tab; this does not verify manual picker consent or a YouTube livestream in the user's environment.
Capture requests favor Chrome tabs and exclude monitor/system audio. The interface displays the selected source and warns after eight seconds without audible input. These preferences cannot bypass Chrome's permission picker.
`tests/verify-manual-picker.py`: headed Chrome with default autoplay and no auto-selection or screen-capture permission override flags. Native picker was operated through OS-level clicks; the local audio-playing tab produced Arabic through the real API, without runtime errors. This is not a test of the user's environment or an actual YouTube livestream.

Run web: `bun run dev` (fixed port in `__ports.cjs`).
