import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { sendKeys } from "@web/test-runner-commands";
import { LitElement } from "lit";
import { restore, spy, stub, useFakeTimers } from "sinon";
import { KeybindingController } from "../core/src/controllers/keybinding-controller.js";
import type { RecordingStateChangedEventDetail } from "../core/src/utils/events.js";
import {
  errorEvent,
  recordingStateChangedEvent,
  transcriptEvent,
} from "../core/src/utils/events.js";
import {
  type DictationTextBoundaries,
  type DictationTextBoundaryContext,
  DictationTextController,
  type DictationTextControllerOptions,
} from "../dictation/src/controllers/dictation-text-controller.js";

class TextTestDictation extends LitElement {
  recordingState: RecordingStateChangedEventDetail["state"] = "stopped";
  dictationConfig = { primaryLanguage: "en" };
  pushToTalkKeybinding = "Space";
  toggleToTalkKeybinding = "`";
  readonly editableKeybindingEvents = true;

  get _pushToTalkKeybinding() {
    return this.pushToTalkKeybinding;
  }

  get _toggleToTalkKeybinding() {
    return this.toggleToTalkKeybinding;
  }

  constructor() {
    super();
    new KeybindingController(this);
  }

  startRecording() {}
  stopRecording() {}
  toggleRecording() {}
}

customElements.define("text-test-dictation", TextTestDictation);

describe("DictationTextController", () => {
  let controller: DictationTextController | undefined;

  afterEach(() => {
    controller?.disconnect();
    controller = undefined;
    restore();
  });

  async function setup(
    options: Partial<DictationTextControllerOptions> = {},
    shadow = false,
  ) {
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    const scope = shadow ? container.attachShadow({ mode: "open" }) : container;
    const field = document.createElement("textarea");
    const second = document.createElement("input");
    const dictation = new TextTestDictation();
    scope.append(field, second, dictation);
    await dictation.updateComplete;
    const state = (
      value: RecordingStateChangedEventDetail["state"],
      processing = false,
    ) => {
      dictation.recordingState = value;
      dictation.dispatchEvent(
        recordingStateChangedEvent(value, { processing }),
      );
    };
    const start = stub(dictation, "startRecording").callsFake(() => {
      state("initializing");
      state("recording", true);
    });
    const stop = stub(dictation, "stopRecording").callsFake(() => {
      state("stopping", true);
      state("stopped", true);
    });
    const toggle = stub(dictation, "toggleRecording");
    controller = new DictationTextController({
      dictation,
      fields: [field, second],
      ...options,
    });
    return {
      container,
      dictation,
      field,
      second,
      start,
      state,
      stop,
      toggle,
    };
  }

  function key(
    target: HTMLElement,
    type: "keydown" | "keyup",
    value = " ",
    code = "Space",
    options: KeyboardEventInit = {},
  ) {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      code,
      composed: true,
      key: value,
      ...options,
    });
    target.dispatchEvent(event);
    return event;
  }

  function transcript(
    dictation: TextTestDictation,
    text: string,
    isFinal = false,
    start = 0,
  ) {
    dictation.dispatchEvent(
      transcriptEvent({
        data: { end: start + 1, isFinal, rawTranscriptText: text, start, text },
        type: "transcript",
      }),
    );
  }

  function input(
    field: HTMLTextAreaElement | HTMLInputElement,
    text: string,
    start: number,
    end = start,
  ) {
    field.setSelectionRange(start, end);
    field.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        composed: true,
        data: text,
        inputType: "insertText",
      }),
    );
    field.setRangeText(text, start, end, "end");
    field.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true }),
    );
  }

  it("types a tap on release, but starts exactly at the hold threshold without inserting repeated spaces", async () => {
    const { field, start, stop } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.value = "ab";
    field.focus();
    field.setSelectionRange(1, 1);
    expect(key(field, "keydown").defaultPrevented).to.equal(true);
    clock.tick(249);
    expect(start.callCount).to.equal(0);
    expect(field.value).to.equal("ab");
    key(field, "keyup");
    expect(field.value).to.equal("a b");
    expect(stop.callCount).to.equal(0);
    key(field, "keydown");
    clock.tick(249);
    expect(start.callCount).to.equal(0);
    clock.tick(1);
    expect(start.callCount).to.equal(1);
    expect(field.readOnly).to.equal(true);
    expect(
      key(field, "keydown", " ", "Space", { repeat: true }).defaultPrevented,
    ).to.equal(true);
    key(field, "keyup");
    expect(stop.callCount).to.equal(1);
    expect(field.value).to.equal("a b");
  });

  it("commits pending Space before another typed key and cancels that hold", async () => {
    const { field, start, stop } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    field.value = "hello";
    field.setSelectionRange(5, 5);
    key(field, "keydown");
    clock.tick(80);
    expect(key(field, "keydown", "w", "KeyW").defaultPrevented).to.equal(false);
    expect(field.value).to.equal("hello ");
    input(field, "w", 6);
    clock.tick(500);
    key(field, "keyup");
    expect(field.value).to.equal("hello w");
    expect(start.callCount).to.equal(0);
    expect(stop.callCount).to.equal(0);
  });

  it("supports real native typing and suppresses native insertion while Space is held", async () => {
    const { field, start, stop } = await setup({ holdDelay: 100 }, true);
    field.focus();
    await sendKeys({ type: "hello" });
    await sendKeys({ press: "Space" });
    await sendKeys({ type: "world" });
    expect(field.value).to.equal("hello world");
    await sendKeys({ down: "Space" });
    try {
      await waitUntil(() => start.calledOnce);
      expect(field.value).to.equal("hello world");
      expect(field.readOnly).to.equal(true);
    } finally {
      await sendKeys({ up: "Space" });
    }
    expect(stop.callCount).to.equal(1);
    expect(field.value).to.equal("hello world");
  });

  it("keeps native rollover typing in the right order", async () => {
    const { field, start } = await setup({ holdDelay: 1000 });
    field.focus();
    await sendKeys({ type: "hello" });
    await sendKeys({ down: "Space" });
    try {
      await sendKeys({ press: "w" });
    } finally {
      await sendKeys({ up: "Space" });
    }
    await sendKeys({ type: "orld" });
    expect(field.value).to.equal("hello world");
    expect(start.callCount).to.equal(0);
  });

  it("uses configurable delay and supports printable push-to-talk keys other than Space", async () => {
    const { dictation, field, start } = await setup({ holdDelay: 40 });
    dictation.pushToTalkKeybinding = "k";
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    key(field, "keydown", "k", "KeyK");
    clock.tick(39);
    expect(start.callCount).to.equal(0);
    clock.tick(1);
    expect(start.callCount).to.equal(1);
    key(field, "keyup", "k", "KeyK");
    expect(field.value).to.equal("");
  });

  it("cancels a pending hold when composition or a modified shortcut takes over", async () => {
    const { field, start } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    key(field, "keydown");
    field.dispatchEvent(new CompositionEvent("compositionstart"));
    clock.tick(300);
    key(field, "keyup");
    field.dispatchEvent(new CompositionEvent("compositionend"));
    key(field, "keydown");
    key(field, "keydown", "Control", "ControlLeft", { ctrlKey: true });
    clock.tick(300);
    key(field, "keyup");
    expect(start.callCount).to.equal(0);
    expect(field.value).to.equal("");
  });

  it("consumes toggle keys once, supports opt-out, and preserves modified and composing input", async () => {
    const { field, toggle, start, dictation, second } = await setup();
    field.focus();
    expect(key(field, "keydown", "`", "Backquote").defaultPrevented).to.equal(
      true,
    );
    key(field, "keydown", "`", "Backquote", { repeat: true });
    expect(toggle.callCount).to.equal(1);
    expect(
      key(field, "keydown", " ", "Space", { ctrlKey: true }).defaultPrevented,
    ).to.equal(false);
    expect(
      key(field, "keydown", " ", "Space", { isComposing: true })
        .defaultPrevented,
    ).to.equal(false);
    expect(start.callCount).to.equal(0);
    controller?.disconnect();
    controller = new DictationTextController({
      allowToggleWhileEditing: false,
      dictation,
      fields: [field, second],
    });
    expect(key(field, "keydown", "`", "Backquote").defaultPrevented).to.equal(
      false,
    );
    controller.disconnect();
    controller = new DictationTextController({
      dictation,
      fields: [field, second],
      shouldHandleKey: () => false,
    });
    expect(key(field, "keydown").defaultPrevented).to.equal(false);
    expect(toggle.callCount).to.equal(1);
  });

  it("handles registered fields inside shadow roots and ignores unregistered editable targets", async () => {
    const { field, start, toggle, container } = await setup({}, true);
    field.focus();
    key(field, "keydown", "`", "Backquote");
    expect(toggle.callCount).to.equal(1);
    const unregistered = document.createElement("textarea");
    container.shadowRoot?.append(unregistered);
    unregistered.focus();
    key(unregistered, "keydown", "`", "Backquote");
    key(unregistered, "keydown");
    key(unregistered, "keyup");
    expect(start.callCount).to.equal(0);
    expect(toggle.callCount).to.equal(1);
  });

  it("anchors field and selection through focus changes and holds the lock until final processing", async () => {
    const { field, second, dictation, state } = await setup();
    field.value = "before selected after";
    field.focus();
    field.setSelectionRange(7, 15);
    state("initializing");
    expect(field.readOnly).to.equal(true);
    expect(second.readOnly).to.equal(false);
    field.setSelectionRange(0, 0);
    second.focus();
    transcript(dictation, "wor");
    expect(field.value).to.equal("before wor after");
    transcript(dictation, "world");
    expect(field.value).to.equal("before world after");
    transcript(dictation, "world", true);
    transcript(dictation, "world", true);
    expect(field.value).to.equal("before world after");
    state("stopped", true);
    expect(field.readOnly).to.equal(true);
    transcript(dictation, "!", true, 1);
    expect(field.value).to.equal("before world! after");
    state("stopped", false);
    expect(field.readOnly).to.equal(false);
    expect(second.matches(":focus")).to.equal(true);
    state("initializing");
    transcript(dictation, "next", true, 2);
    expect(second.value).to.equal("next");
  });

  it("does not delete a selection on start and restores it if an interim never finalizes", async () => {
    const { dictation, field, state } = await setup();
    field.value = "original";
    field.focus();
    field.select();
    state("initializing");
    expect(field.value).to.equal("original");
    transcript(dictation, "unfinished");
    expect(field.value).to.equal("unfinished");
    state("stopped");
    expect(field.value).to.equal("original");
    expect(field.readOnly).to.equal(false);
    field.select();
    state("initializing");
    transcript(dictation, "final", true);
    transcript(dictation, " temporary", false, 1);
    dictation.dispatchEvent(errorEvent("Synthetic failure"));
    expect(field.value).to.equal("final");
    expect(field.readOnly).to.equal(false);
  });

  it("supports final-only mode, configurable transformation, and disabled insertion", async () => {
    const { dictation, field, state, second } = await setup({
      transcriptMode: "final",
      transformTranscript: (text) => text.toUpperCase(),
    });

    field.focus();
    state("recording", true);
    transcript(dictation, "interim");
    expect(field.value).to.equal("");
    transcript(dictation, "final", true);
    expect(field.value).to.equal("FINAL");
    state("stopped");
    controller?.disconnect();
    controller = new DictationTextController({
      dictation,
      fields: [field, second],
      insertTranscripts: false,
    });
    state("initializing");
    transcript(dictation, "ignored", true, 1);
    expect(field.value).to.equal("FINAL");
  });

  it("spaces both existing-text boundaries in textareas and inputs without changing supplied whitespace or punctuation", async () => {
    const { dictation, field, second, state } = await setup();
    const cases: [string, number, number, string, string][] = [
      ["hello", 0, 0, "new", "new hello"],
      ["hello", 5, 5, "world", "hello world"],
      ["hello", 3, 3, "world", "hel world lo"],
      ["hello", 1, 4, "word", "h word o"],
      ["", 0, 0, "word", "word"],
      ["before after", 7, 7, "word", "before word after"],
      ["before\nsuffix", 7, 7, "word\n", "before\nword\nsuffix"],
      ["before", 6, 6, " word", "before word"],
      ["()", 1, 1, "word", "(word)"],
      ["pain", 4, 4, ",", "pain,"],
      ["suffix", 0, 0, "word.", "word. suffix"],
      ["hello", 5, 5, "\n\n", "hello\n\n"],
      ["hello", 5, 5, "-world", "hello-world"],
      ["hello-", 6, 6, "world", "hello-world"],
      ["word:", 5, 5, "value", "word: value"],
    ];
    for (const target of [field, second]) {
      for (const [value, start, end, text, expected] of cases) {
        if (target === second && (value.includes("\n") || text.includes("\n")))
          continue;
        target.value = value;
        target.focus();
        target.setSelectionRange(start, end);
        state("initializing");
        transcript(dictation, text, true);
        expect(
          target.value,
          `${JSON.stringify(value)} + ${JSON.stringify(text)}`,
        ).to.equal(expected);
        state("stopped");
      }
    }
  });

  it("keeps interim separators temporary and appends segments before the preserved suffix", async () => {
    const { dictation, field, state } = await setup();
    field.value = "hello";
    field.focus();
    field.setSelectionRange(3, 3);
    state("recording", true);
    transcript(dictation, "wor");
    expect(field.value).to.equal("hel wor lo");
    expect(field.selectionStart).to.equal(7);
    transcript(dictation, "world");
    expect(field.value).to.equal("hel world lo");
    transcript(dictation, "world", true);
    transcript(dictation, "world", true);
    expect(field.selectionStart).to.equal(9);
    transcript(dictation, ",", false, 1);
    expect(field.value).to.equal("hel world, lo");
    transcript(dictation, "aga", false, 1);
    expect(field.value).to.equal("hel world aga lo");
    transcript(dictation, "again", true, 1);
    transcript(dictation, ".", true, 2);
    expect(field.value).to.equal("hel world again. lo");
    expect(field.selectionStart).to.equal(16);
    state("stopped", true);
    transcript(dictation, "next", true, 3);
    expect(field.value).to.equal("hel world again. next lo");
    state("stopped");
    state("initializing");
    transcript(dictation, "session", true);
    expect(field.value).to.equal("hel world again. next session lo");
  });

  it("restores selection and separators when a spaced interim is discarded or finalized empty", async () => {
    const { dictation, field, state } = await setup();
    field.value = "hello";
    field.focus();
    field.setSelectionRange(1, 4);
    state("initializing");
    transcript(dictation, "preview");
    expect(field.value).to.equal("h preview o");
    transcript(dictation, "", true);
    expect(field.value).to.equal("hello");
    transcript(dictation, "word");
    state("stopped");
    expect(field.value).to.equal("hello");

    field.setSelectionRange(1, 4);
    state("initializing");
    transcript(dictation, "word", true);
    transcript(dictation, "temporary", false, 1);
    expect(field.value).to.equal("h word temporary o");
    transcript(dictation, "", true, 1);
    expect(field.value).to.equal("h word o");
    expect(field.selectionStart).to.equal(6);
    transcript(dictation, "unfinished", false, 2);
    state("stopped");
    expect(field.value).to.equal("h word o");
    expect(field.selectionStart).to.equal(6);
  });

  for (const [spaceBetweenSegments, spaceAroundInsertion, expected] of [
    [false, true, "hel worldagain lo"],
    [true, false, "helworld againlo"],
    [false, false, "helworldagainlo"],
  ] as const) {
    it(`independently configures segment spacing (${spaceBetweenSegments}) and existing-text spacing (${spaceAroundInsertion})`, async () => {
      const { dictation, field, state } = await setup({
        spaceAroundInsertion,
        spaceBetweenSegments,
      });
      field.value = "hello";
      field.focus();
      field.setSelectionRange(3, 3);
      state("initializing");
      transcript(dictation, "world", true);
      transcript(dictation, "again", false, 1);
      transcript(dictation, "again", true, 1);
      expect(field.value).to.equal(expected);
    });
  }

  it("uses the recording language for French punctuation and preserves service-provided non-breaking spaces", async () => {
    const { dictation, field, state } = await setup();
    for (const language of ["fr", "fr-FR", "FR-fr", "fr-CH", "en"]) {
      dictation.dictationConfig = { primaryLanguage: language };
      field.value = "Bonjour";
      field.focus();
      field.setSelectionRange(7, 7);
      state("initializing");
      transcript(dictation, ":", true);
      expect(field.value).to.equal(
        language.toLowerCase() === "fr-ch" || language === "en"
          ? "Bonjour:"
          : "Bonjour\u00a0:",
      );
      state("stopped");
    }
    field.value = "";
    state("initializing");
    transcript(dictation, "bonjour\u00a0:", true);
    transcript(dictation, "suite", true, 1);
    expect(field.value).to.equal("bonjour\u00a0: suite");
  });

  it("lets a formatter customize boundaries after transformation without owning interim ranges", async () => {
    const formatter = spy(
      (
        boundaries: DictationTextBoundaries,
        context: DictationTextBoundaryContext,
      ) => ({
        leading:
          context.leadingBoundary === "dictated-text"
            ? "\n"
            : boundaries.leading,
        trailing: boundaries.trailing ? "\t" : "",
      }),
    );
    const { dictation, field, state } = await setup({
      formatBoundaries: formatter,
      transformTranscript: (text) => text.toUpperCase(),
    });
    field.value = "hello";
    field.focus();
    field.setSelectionRange(3, 3);
    state("initializing");
    transcript(dictation, "one", true);
    expect(field.value).to.equal("hel ONE\tlo");
    expect(formatter.firstCall.args[0]).to.deep.equal({
      leading: " ",
      trailing: " ",
    });
    expect(formatter.firstCall.args[1]).to.include({
      after: "lo",
      before: "hel",
      isFinal: true,
      leadingBoundary: "existing-text",
      primaryLanguage: "en",
      text: "ONE",
      trailingBoundary: "existing-text",
    });
    transcript(dictation, "tw", false, 1);
    transcript(dictation, "two", false, 1);
    expect(field.value).to.equal("hel ONE\nTWO\tlo");
    expect(formatter.lastCall.args[1]).to.include({
      after: "lo",
      before: "hel ONE",
      isFinal: false,
      leadingBoundary: "dictated-text",
    });
    transcript(dictation, "two", true, 1);
    expect(field.value).to.equal("hel ONE\nTWO\tlo");
    expect(field.selectionStart).to.equal(11);
  });

  it("surfaces boundary formatter errors without modifying text and releases the typing lock", async () => {
    const { dictation, field, state } = await setup({
      formatBoundaries: () => {
        throw new Error("Formatting failed");
      },
    });
    field.value = "hello";
    field.focus();
    state("initializing");
    const failure = spy();
    controller?.addEventListener("error", failure);
    transcript(dictation, "world");
    expect(failure.callCount).to.equal(1);
    expect(field.value).to.equal("hello");
    expect(field.readOnly).to.equal(false);
  });

  it("tracks outside edits while keeping a generated trailing boundary replaceable", async () => {
    const { dictation, field, state } = await setup({
      preventTypingWhileDictating: false,
    });
    field.value = "hello";
    field.focus();
    field.setSelectionRange(3, 3);
    state("initializing");
    transcript(dictation, "world", true);
    input(field, "new ", 0);
    input(field, "!", field.value.length);
    transcript(dictation, "aga", false, 1);
    transcript(dictation, "again", true, 1);
    expect(field.value).to.equal("new hel world again lo!");
    transcript(dictation, "temporary", false, 2);
    state("stopped");
    expect(field.value).to.equal("new hel world again lo!");
  });

  it("uses a single registered destination even without focus and restores selected text for an empty final", async () => {
    const { dictation, field, second, state } = await setup();
    controller?.disconnect();
    controller = new DictationTextController({ dictation, fields: field });
    second.focus();
    field.value = "selected";
    field.setSelectionRange(0, 8);
    state("initializing");
    transcript(dictation, "preview");
    transcript(dictation, "", true);
    expect(field.value).to.equal("selected");
    transcript(dictation, "accepted", true, 1);
    expect(field.value).to.equal("accepted");
    expect(second.matches(":focus")).to.equal(true);
  });

  it("tracks outside edits and stops insertion on overlapping edits without reverting user text", async () => {
    const { dictation, field, state } = await setup({
      preventTypingWhileDictating: false,
    });
    field.value = "prefix  suffix";
    field.focus();
    field.setSelectionRange(7, 7);
    state("recording", true);
    const conflict = spy();
    controller?.addEventListener("text-conflict", conflict);
    transcript(dictation, "test");
    input(field, "new ", 0);
    transcript(dictation, "tested");
    expect(field.value).to.equal("new prefix tested suffix");
    input(field, "USER", 12, 14);
    const edited = field.value;
    expect(conflict.callCount).to.equal(1);
    transcript(dictation, "replacement", true);
    state("stopped");
    expect(field.value).to.equal(edited);
    expect(field.readOnly).to.equal(false);
  });

  it("reports incompatible programmatic value replacement before applying a transcript", async () => {
    const { dictation, field, state } = await setup({
      preventTypingWhileDictating: false,
    });
    field.focus();
    state("initializing");
    transcript(dictation, "working");
    field.value = "application replacement";
    const conflict = spy();
    controller?.addEventListener("text-conflict", conflict);
    transcript(dictation, "final", true);
    expect(conflict.callCount).to.equal(1);
    expect(field.value).to.equal("application replacement");
  });

  it("applies edits through the configured adapter and surfaces adapter failures", async () => {
    const adapter = spy(
      (
        edit: Parameters<
          NonNullable<DictationTextControllerOptions["applyEdit"]>
        >[0],
      ) => {
        edit.field.setRangeText(edit.text, edit.start, edit.end, "preserve");
        edit.field.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      },
    );
    const { dictation, field, state, second } = await setup({
      applyEdit: adapter,
    });
    field.focus();
    key(field, "keydown");
    key(field, "keyup");
    expect(field.value).to.equal(" ");
    expect(adapter.callCount).to.equal(1);
    state("initializing");
    transcript(dictation, "word", true);
    expect(field.value).to.equal(" word");
    expect(adapter.callCount).to.equal(2);
    state("stopped");
    controller?.disconnect();
    controller = new DictationTextController({
      applyEdit: () => {
        throw new Error("Adapter failed");
      },
      dictation,
      fields: [field, second],
    });
    const failure = spy();
    controller.addEventListener("error", failure);
    state("initializing");
    transcript(dictation, "next");
    expect(failure.callCount).to.equal(1);
    expect(field.readOnly).to.equal(false);
  });

  it("continues a hold across field focus changes, stops on window blur, and cancels pending gestures on field blur", async () => {
    const { field, second, start, stop, state } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    key(field, "keydown");
    second.focus();
    clock.tick(300);
    key(second, "keyup");
    expect(start.callCount).to.equal(0);
    expect(field.value).to.equal("");
    field.focus();
    key(field, "keydown");
    clock.tick(250);
    second.focus();
    expect(stop.callCount).to.equal(0);
    key(second, "keyup");
    expect(stop.callCount).to.equal(1);
    state("stopped");
    field.focus();
    key(field, "keydown");
    clock.tick(250);
    window.dispatchEvent(new Event("blur"));
    expect(stop.callCount).to.equal(2);
  });

  it("does not let a push-to-talk release or window blur stop a button-started recording", async () => {
    const { field, state, stop, start } = await setup();
    field.focus();
    state("recording", true);
    key(field, "keydown");
    key(field, "keyup");
    window.dispatchEvent(new Event("blur"));
    expect(start.callCount).to.equal(0);
    expect(stop.callCount).to.equal(0);
  });

  it("allows taps during an unlocked button-started recording without taking recording ownership", async () => {
    const { field, state, stop, start } = await setup({
      preventTypingWhileDictating: false,
    });
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    state("recording", true);
    key(field, "keydown");
    key(field, "keyup");
    expect(field.value).to.equal(" ");
    key(field, "keydown");
    clock.tick(250);
    key(field, "keyup");
    expect(field.value).to.equal(" ");
    expect(start.callCount).to.equal(0);
    expect(stop.callCount).to.equal(0);
  });

  it("uses beforeinput ranges to detect edits within repeated interim text", async () => {
    const { dictation, field, state } = await setup({
      preventTypingWhileDictating: false,
    });
    field.value = "aaa";
    field.focus();
    field.setSelectionRange(1, 1);
    state("initializing");
    transcript(dictation, "aaa");
    const conflict = spy();
    controller?.addEventListener("text-conflict", conflict);
    input(field, "a", 2);
    expect(conflict.callCount).to.equal(1);
    transcript(dictation, "different", true);
    expect(field.value).to.equal("a aaaa aa");
  });

  it("unlocks and reports transcript transformation errors", async () => {
    const { dictation, field, state } = await setup({
      transformTranscript: () => {
        throw new Error("Transform failed");
      },
    });

    field.focus();
    const failure = spy();
    controller?.addEventListener("error", failure);
    state("initializing");
    transcript(dictation, "hello");
    expect(failure.callCount).to.equal(1);
    expect(field.readOnly).to.equal(false);
    expect(field.value).to.equal("");
  });

  it("allows retry after an error even if the recording button still reports pending processing", async () => {
    const { dictation, field, state, start } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    state("recording", true);
    dictation.dispatchEvent(errorEvent("Synthetic connection failure"));
    state("stopped", true);
    expect(field.readOnly).to.equal(false);
    key(field, "keydown");
    clock.tick(250);
    expect(start.callCount).to.equal(1);
    key(field, "keyup");
  });

  it("reports no target for ambiguous routing and preserves preexisting read-only state", async () => {
    const { field, second, state } = await setup();
    const noTarget = spy();
    controller?.addEventListener("no-target", noTarget);
    field.readOnly = true;
    second.readOnly = true;
    state("initializing");
    expect(noTarget.callCount).to.equal(1);
    state("stopped");
    expect(field.readOnly).to.equal(true);
    expect(second.readOnly).to.equal(true);
  });

  it("disconnects idempotently and stops only its held recording when a destination is removed", async () => {
    const { field, dictation, start, stop } = await setup();
    const clock = useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    field.focus();
    key(field, "keydown");
    clock.tick(250);
    expect(start.callCount).to.equal(1);
    field.remove();
    await Promise.resolve();
    expect(stop.callCount).to.equal(1);
    expect(field.readOnly).to.equal(false);
    controller?.disconnect();
    controller?.disconnect();
    const next = new DictationTextController({
      dictation,
      fields: document.createElement("textarea"),
    });
    next.disconnect();
  });
});

describe("keybinding event pipeline", () => {
  it("offers cancelable input before editable filtering and releases only owned presses", async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const start = spy();
    const stop = spy();
    const toggle = spy();
    const keyboard = new KeybindingController({
      _pushToTalkKeybinding: "Space",
      _toggleToTalkKeybinding: "`",
      addController: () => {},
      dispatchEvent: (event) => host.dispatchEvent(event),
      editableKeybindingEvents: true,
      removeController: () => {},
      requestUpdate: () => {},
      startRecording: start,
      stopRecording: stop,
      toggleRecording: toggle,
      updateComplete: Promise.resolve(true),
    });
    keyboard.hostConnected();
    try {
      const event = (type: string) =>
        host.dispatchEvent(
          new KeyboardEvent(type, {
            bubbles: true,
            code: "Space",
            key: " ",
          }),
        );
      event("keyup");
      expect(stop.callCount).to.equal(0);
      const cancel = (event: Event) => event.preventDefault();
      host.addEventListener("keybinding-input", cancel);
      event("keydown");
      expect(start.callCount).to.equal(0);
      host.removeEventListener("keybinding-input", cancel);
      event("keydown");
      expect(start.callCount).to.equal(1);
      event("keyup");
      expect(stop.callCount).to.equal(1);
    } finally {
      keyboard.hostDisconnected();
    }
  });
});
