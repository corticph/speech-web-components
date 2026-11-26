# @corti/dictation-web

[![Published on npm](https://img.shields.io/npm/v/@corti/dictation-web.svg?logo=npm)](https://www.npmjs.com/package/@corti/dictation-web)
[![License: MIT](https://img.shields.io/npm/l/%40corti%2Fdictation-web)](https://opensource.org/licenses/MIT)
[![Get Support on Discord](https://img.shields.io/badge/Discord-Get%20Support-5865F2.svg?logo=discord&logoColor=fff)](https://discord.com/invite/zXeXHgnZXX)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-blue.svg?logo=rocket&logoColor=fff)](https://codepen.io/hccullen/pen/OPJmxQR)

Web components for real-time, single-speaker dictation on the Corti Transcribe API.

- **All-in-one:** `<corti-dictation>` — recording button, settings, keyboard shortcuts, and theming
- **Modular:** `<dictation-root>` plus `<dictation-recording-button>`, `<dictation-settings-menu>`, and selectors for custom layouts

> **Note:** OAuth 2.0 authentication is not handled by this library. The client must provide an authorization token or token refresh function while using the component.

For multi-speaker ambient streaming, use [@corti/ambient-web](https://www.npmjs.com/package/@corti/ambient-web) instead.

## Installation

```bash
npm i @corti/dictation-web
# yarn add @corti/dictation-web
# pnpm add @corti/dictation-web
```

```js
import "@corti/dictation-web";
// or: import { CortiDictation } from "@corti/dictation-web";
```

CDN (quick try only):

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@corti/dictation-web/dist/bundle.js"></script>
```

## Quick start

```html
<corti-dictation id="dictation"></corti-dictation>
<textarea id="transcript" placeholder="Transcript will appear here..."></textarea>

<script type="module">
  import "@corti/dictation-web";

  const dictationEl = document.getElementById("dictation");
  const transcriptEl = document.getElementById("transcript");

  dictationEl.addEventListener("ready", () => {
    dictationEl.accessToken = "<your-access-token>";
  });

  dictationEl.addEventListener("transcript", (e) => {
    if (e.detail.data.isFinal) {
      transcriptEl.value += `${e.detail.data.text} `;
    }
  });
</script>
```

## Modular layout

```html
<dictation-root id="dictationRoot">
  <dictation-recording-button></dictation-recording-button>
  <dictation-settings-menu settingsEnabled="device,language,keybinding"></dictation-settings-menu>
</dictation-root>

<script type="module">
  import "@corti/dictation-web";

  const root = document.getElementById("dictationRoot");
  root.addEventListener("ready", () => {
    root.accessToken = "<your-access-token>";
  });
</script>
```

Modular components require `<dictation-root>` as a parent. They share state through Lit context.

| Component | Role |
| --- | --- |
| `<dictation-root>` | Context provider (auth, config, devices, keybindings) |
| `<dictation-recording-button>` | Start/stop with audio visualization |
| `<dictation-settings-menu>` | Device, language, and keybinding UI |
| `<dictation-device-selector>` | Device dropdown |
| `<dictation-language-selector>` | Language dropdown |
| `<dictation-keybinding-selector>` | Push-to-talk / toggle-to-talk keys |

## Keybindings

Defaults: **Enter** (toggle-to-talk), **Space** (push-to-talk). Key names (`event.key`) and codes (`event.code`) are supported. Shortcuts are ignored while focus is in inputs. If both modes use the same key, toggle-to-talk wins.

Configure on `<corti-dictation>` or `<dictation-root>`:

```html
<corti-dictation toggleToTalkKeybinding="`" pushToTalkKeybinding="Space"></corti-dictation>
```

### Combining typing and dictation

`DictationTextController` integrates existing native fields without a wrapper:

```js
import { DictationTextController } from "@corti/dictation-web";

const controller = new DictationTextController({
  dictation: document.querySelector("corti-dictation"),
  fields: [...document.querySelectorAll("textarea")],
  holdDelay: 250,
  allowToggleWhileEditing: true,
  insertTranscripts: true,
  transcriptMode: "interim",
  preventTypingWhileDictating: true,
  spaceBetweenSegments: true,
  spaceAroundInsertion: true,
});

controller.addEventListener("text-conflict", ({ detail }) => {
  // Automatic insertion is suspended for this session; detail.field retains user edits.
});
controller.addEventListener("no-target", () => {
  // Focus a registered field before starting the next recording.
});
controller.addEventListener("error", ({ detail }) => {
  // Surface detail.message through your application's error UI.
});

// When unmounting the integration:
// controller.disconnect();
```

The options shown above are the defaults. Configure the component's
`pushToTalkKeybinding` and `toggleToTalkKeybinding` separately and enable its
device setting (or supply a selected recording device).

The controller displays interim transcripts by default, but the API must also
be configured to send them. Set `dictation.dictationConfig` before recording:

```js
dictation.dictationConfig = {
  ...dictation.dictationConfig,
  interimResults: true,
};
```

The API defaults `interimResults` to `false`; the controller does not change it.

- A printable push-to-talk key types one character when released before the
  hold delay. Holding starts recording without typing or repeating the character.
  Pressing another typing key first commits the pending character and cancels
  that hold. Non-printing push-to-talk keys start immediately.
- Toggle-to-talk consumes its key while editing; set `allowToggleWhileEditing`
  to `false` to type that character normally instead.
- Register a textarea or a `text`, `search`, `url`, or `tel` input, or an array of
  these fields. Shadow-root fields are supported. Passwords, unsupported input
  types, disabled fields, and preexisting read-only fields are not destinations.
  Only one controller may attach to a dictation component.
- At recording start, the controller anchors the focused registered field and
  its selection. It falls back to the last focused field, or the sole registered
  field if none has been focused. Multiple fields with no previous focus produce
  `no-target`; recording itself is not cancelled. Moving focus never redirects
  the current session's transcripts or steals focus back.
- Interim updates replace their temporary range; final segments commit that
  range once. Selected text is not replaced until text arrives. Unfinalized
  interim text is discarded when processing finishes, on failure, or on
  disconnect; already finalized text remains. Use `transcriptMode: "final"` to
  insert only final segments, or `insertTranscripts: false` to handle text yourself.
- The destination is temporarily read-only from initialization through final
  processing, including when recording starts from the button or API.
  `preventTypingWhileDictating: false` permits editing: edits outside the dictated
  range shift its anchor; overlapping or incompatible edits suspend insertion
  and emit `text-conflict` instead of overwriting user text.
- Leaving the field before the hold threshold cancels the pending tap. A
  hold-started recording continues across field focus changes, but ends on key
  release, window blur, destination removal, or disconnect. A push-to-talk
  gesture never takes ownership of a button- or toggle-started recording.
- IME composition and modified editing shortcuts bypass handling. An optional
  `shouldHandleKey(event, field)` predicate can exclude application shortcuts.
  Modifier-only keybindings are supported; modified character shortcuts are left
  untouched.

Transcript content is preserved, with boundary spacing enabled by default:

- `spaceBetweenSegments` separates segments within the same recording, including
  final results delivered during processing after stop.
- `spaceAroundInsertion` separates the inserted text from existing text on both
  sides. Inserting `world` at `hel|lo` produces `hel world lo`. Subsequent segments
  remain before the original suffix: `hel world again lo`.
- Each option can be disabled independently. Set both to `false` for verbatim
  concatenation.
- No separator is added at an empty boundary, next to existing whitespace, after
  opening brackets/quotes, or before left-attaching punctuation. Hyphens and
  slashes attach without spaces. Service-provided whitespace and line breaks are
  preserved; punctuation and capitalization are not invented.
- The recording's `dictationConfig.primaryLanguage` controls locale-specific
  spacing. `fr` and `fr-FR` use a non-breaking space before standalone `: ; ! ?`;
  `fr-CH` does not.

Interim updates replace their text and generated separators together. Empty
final results and discarded interims restore the prior selection or boundary;
already committed text and its spacing remain. The caret stays before a generated
trailing separator so a later recording can continue in the same location.

The optional `transformTranscript(text, { field, start, end, isFinal })` callback
changes transcript content before spacing is calculated. To customize only the
boundaries, provide `formatBoundaries(boundaries, context)`:

```js
const controller = new DictationTextController({
  dictation,
  fields: textarea,
  formatBoundaries: ({ leading, trailing }, context) => ({
    leading: context.leadingBoundary === "dictated-text" ? "\n" : leading,
    trailing,
  }),
});
```

The formatter receives the proposed `{ leading, trailing }` separators after
applying the two spacing options, and returns both strings. It may override
either option. Context includes `field`, replacement `start`/`end`, transformed
`text`, surrounding `before`/`after` text (excluding the current interim or
generated trailing separator), `isFinal`, and `primaryLanguage`. Its
`leadingBoundary` is `"existing-text"`, `"dictated-text"`, or `null` at the field
start; `trailingBoundary` is `"existing-text"` or `null` at the field end. The
formatter runs for every nonempty transformed interim/final result; it should be
deterministic and must not edit the field itself. Exceptions emit `error` and
suspend insertion for that session.

See Corti's [Transcript Text Handling](https://docs.corti.ai/stt/best-practices-transcribe)
for boundary rules. Punctuation generation is configured separately through
`dictationConfig`: spoken and automatic punctuation are mutually exclusive, with
spoken punctuation taking precedence if both are enabled.

Native edits dispatch a bubbling, composed `input` event. For controlled fields
or custom undo/state management, provide `applyEdit(edit)` and synchronously apply
`edit.text` to `edit.field` between `edit.start` and `edit.end`, setting the
selection to `edit.selectionStart` / `edit.selectionEnd`. The adapter owns
application notifications. Do not retain both the controller's insertion and a
separate transcript insertion listener.

The default edits use `setRangeText` and do not preserve browser undo/redo history.
They may also disrupt existing typing history. The controller does not maintain
its own history stack.

### Keyboard event integration

The controller uses the recording button's existing keyboard pipeline, not new
global keyboard listeners. Dictation buttons emit `keybinding-input` before
editable filtering for each keydown/keyup. Its detail contains the original
`keyboardEvent` and a matching `binding` (`"push-to-talk"`, `"toggle-to-talk"`, or
`null`); preventing this custom event cancels the component's default shortcut
action, while preventing `keyboardEvent` cancels native typing. A
`keybinding-cancelled` event reports `reason: "blur"` or `"disconnected"` so
integrations can clean up pending gestures. Unregistered editable fields continue
to bypass recording shortcuts. Ambient does not expose this text integration.

## Documentation

- [Dictation Web Component (full guide)](https://docs.corti.ai/sdk/dictation/overview)
- [API reference](https://docs.corti.ai/sdk/dictation/reference)
- [Authentication](https://docs.corti.ai/sdk/dictation/authentication)
- [Styling](https://docs.corti.ai/sdk/dictation/styling)
- [Proxy setup](https://docs.corti.ai/sdk/dictation/proxy)
- [Examples](https://github.com/corticph/corti-examples/tree/main/dictation)

## Repository

Source and issue tracking: [github.com/corticph/dictation-web](https://github.com/corticph/dictation-web)
