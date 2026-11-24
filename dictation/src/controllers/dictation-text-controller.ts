import type {
  KeybindingInputEventDetail,
  RecordingStateChangedEventDetail,
} from "@core/utils/events.js";
import { errorEvent } from "@core/utils/events.js";
import { keybindingEditableTarget } from "@core/utils/keybinding.js";
import type { Corti } from "@corti/sdk";
import type { CortiDictation } from "../components/corti-dictation.js";

/** A native textarea or input; only text, search, url, and tel inputs are supported. */
export type DictationTextField = HTMLTextAreaElement | HTMLInputElement;

/**
 * The recording and event API required by the text controller.
 * Optional dictation configuration supplies the recording's language for spacing.
 */
export type DictationTextHost = HTMLElement &
  Pick<
    CortiDictation,
    "recordingState" | "startRecording" | "stopRecording" | "toggleRecording"
  > &
  Partial<Pick<CortiDictation, "dictationConfig">>;

/** A synchronous field replacement and its resulting selection. */
export type DictationTextEdit = {
  /** The registered field to update. */
  field: DictationTextField;

  /** Inclusive replacement offset in UTF-16 code units. */
  start: number;

  /** Exclusive replacement offset in UTF-16 code units. */
  end: number;

  /** Replacement text, including any generated boundary separators. */
  text: string;

  /** Distinguishes a deferred typed character from transcript insertion. */
  inputType: "insertText" | "insertFromDictation";

  /** Selection start to apply after replacing the text, in UTF-16 code units. */
  selectionStart: number;

  /** Selection end to apply after replacing the text, in UTF-16 code units. */
  selectionEnd: number;
};

/** Separators inserted around a transformed transcript segment. */
export type DictationTextBoundaries = {
  /** Separator between preceding field content and the segment. */
  leading: string;

  /** Separator between the segment and preserved following content. */
  trailing: string;
};

/** Insertion context passed to the boundary formatter for each nonempty segment. */
export type DictationTextBoundaryContext = {
  /** The recording session's anchored destination. */
  field: DictationTextField;

  /** Inclusive replacement offset in UTF-16 code units. */
  start: number;

  /** Exclusive replacement offset, including any interim or generated trailing separator. */
  end: number;

  /** Transcript content after transformation, before adding separators. */
  text: string;

  /** Field content before the replacement range. */
  before: string;

  /** Preserved content after the replacement range, excluding generated separators. */
  after: string;

  /** Whether this segment is being committed rather than previewed. */
  isFinal: boolean;

  /** Language captured at recording start, if supplied by the host. */
  primaryLanguage: string | undefined;

  /** Origin of preceding content, or null at the field start. */
  leadingBoundary: "existing-text" | "dictated-text" | null;

  /** Origin of following content, or null at the field end. */
  trailingBoundary: "existing-text" | null;
};

/** Configuration for coordinating native editing, recording shortcuts, and transcripts. */
export type DictationTextControllerOptions = {
  /** Dictation host to observe; only one text controller may attach to it. */
  dictation: DictationTextHost;

  /**
   * Existing native fields to register as destinations.
   * Disabled, disconnected, and preexisting read-only fields are not selected.
   */
  fields: DictationTextField | readonly DictationTextField[];

  /**
   * Milliseconds a printable push-to-talk key must be held before recording starts.
   * Must be finite and non-negative; non-printing keys start immediately.
   * @defaultValue 250
   */
  holdDelay?: number;

  /**
   * Whether toggle-to-talk consumes its shortcut while editing a registered field.
   * @defaultValue true
   */
  allowToggleWhileEditing?: boolean;

  /**
   * Whether transcript events are automatically inserted into the anchored field.
   * @defaultValue true
   */
  insertTranscripts?: boolean;

  /**
   * Use `"interim"` for replaceable previews plus final results, or `"final"` for finals only.
   * Interim previews also require the API's `interimResults` setting to be enabled.
   * @defaultValue "interim"
   */
  transcriptMode?: "interim" | "final";

  /**
   * Temporarily make the destination read-only through recording and final processing.
   * When false, overlapping edits suspend insertion and emit `text-conflict`.
   * @defaultValue true
   */
  preventTypingWhileDictating?: boolean;

  /**
   * Apply boundary spacing between committed and incoming segments in one recording.
   * @defaultValue true
   */
  spaceBetweenSegments?: boolean;

  /**
   * Apply boundary spacing against existing content on both sides of the insertion.
   * Independent of spacing between segments.
   * @defaultValue true
   */
  spaceAroundInsertion?: boolean;

  /**
   * Customize proposed separators after transcript transformation and spacing options.
   * Called for every nonempty transformed preview or final; must not modify the field.
   * Exceptions or invalid results emit `error` and suspend insertion for the session.
   *
   * @param boundaries - Default separators; either may be overridden, including when spacing is disabled.
   * @param context - Transformed text, surrounding content, and boundary origins.
   * @returns Both leading and trailing separator strings.
   */
  formatBoundaries?: (
    boundaries: DictationTextBoundaries,
    context: DictationTextBoundaryContext,
  ) => DictationTextBoundaries;

  /**
   * Return false to bypass recording shortcut handling for an eligible keydown.
   * Modified editing shortcuts and composition events already bypass handling.
   *
   * @param event - The original keyboard event.
   * @param field - The focused registered field.
   * @returns Whether the controller may handle this shortcut.
   */
  shouldHandleKey?: (
    event: KeyboardEvent,
    field: DictationTextField,
  ) => boolean;

  /**
   * Apply a replacement and its supplied selection synchronously.
   * The adapter owns framework notifications and undo integration. When omitted,
   * native edits dispatch a bubbling, composed `input` event.
   * Exceptions or an unexpected resulting value emit `error` and suspend insertion.
   *
   * @param edit - Replacement range, text, input type, and resulting selection.
   */
  applyEdit?: (edit: DictationTextEdit) => void;

  /**
   * Transform transcript content before boundary spacing is calculated.
   * Return an empty string to omit a segment or clear its existing preview.
   * Exceptions or non-string results emit `error` and suspend insertion.
   *
   * @param text - The API's processed transcript text.
   * @param context - Anchored replacement range and final/preview status.
   * @returns Content to insert before adding boundary separators.
   */
  transformTranscript?: (
    text: string,
    context: {
      /** The recording session's anchored destination. */
      field: DictationTextField;

      /** Inclusive replacement offset in UTF-16 code units. */
      start: number;

      /** Exclusive replacement offset, including any interim or generated trailing separator. */
      end: number;

      /** Whether this segment is being committed rather than previewed. */
      isFinal: boolean;
    },
  ) => string;
};

type Gesture = {
  field: DictationTextField;
  key: string;
  code: string;
  canStart: boolean;
  state: "pending" | "typing" | "recording" | "cancelled";
  timer?: ReturnType<typeof setTimeout>;
};

type PendingEdit = {
  value: string;
  start: number;
  end: number;
  inputType: string;
};

type Session = {
  field: DictationTextField;
  start: number;
  end: number;
  original: string;
  interim: boolean;
  expected: string;
  conflicted: boolean;
  finals: Set<string>;
  hasText: boolean;
  primaryLanguage: string | undefined;
};

const controllers = new WeakMap<DictationTextHost, DictationTextController>();

function boundarySeparator(
  before: string,
  after: string,
  primaryLanguage: string | undefined,
): string {
  if (!before || !after || /\s/.test(before) || /\s/.test(after)) return "";
  if ("([{\"'\u201c\u2018\u00bf\u00a1-/".includes(before)) return "";

  const language = primaryLanguage?.toLowerCase();

  if ((language === "fr" || language === "fr-fr") && ":;!?".includes(after))
    return "\u00a0";

  return ",.:;!?)]}%'/-".includes(after) ? "" : " ";
}

function isTextField(value: unknown): value is DictationTextField {
  return (
    value instanceof HTMLTextAreaElement ||
    (value instanceof HTMLInputElement &&
      ["text", "search", "url", "tel"].includes(value.type))
  );
}

/**
 * Coordinates existing native fields with a CortiDictation component.
 * Call disconnect() when the integration is removed.
 */
export class DictationTextController extends EventTarget {
  readonly #options: DictationTextControllerOptions;
  readonly #fields: readonly DictationTextField[];
  readonly #dictation: DictationTextHost;
  readonly #listeners = new AbortController();
  readonly #observer: MutationObserver;
  #lastFocused?: DictationTextField;
  #gesture?: Gesture;
  #ownsRecording = false;
  #session?: Session;
  #active = false;
  #failed = false;
  #state: RecordingStateChangedEventDetail["state"];
  #processing = false;
  #locked?: DictationTextField;
  #composing = new Set<DictationTextField>();
  #applyingEdit = false;
  #pendingEdit?: PendingEdit;
  #disconnected = false;

  /**
   * Register fields and attach recording, keyboard, and transcript listeners.
   *
   * @param options - Destinations, keyboard behavior, and insertion customization.
   * @throws TypeError if no fields are supplied or an input type is unsupported.
   * @throws RangeError if the hold delay is negative or non-finite.
   * @throws Error if another controller is attached or fields belong to another document.
   */
  constructor(options: DictationTextControllerOptions) {
    super();

    const fields = Array.isArray(options.fields)
      ? [...options.fields]
      : [options.fields];

    if (!fields.length || fields.some((field) => !isTextField(field))) {
      throw new TypeError(
        "Register at least one textarea or text/search/url/tel input.",
      );
    }

    if (
      options.holdDelay !== undefined &&
      (!Number.isFinite(options.holdDelay) || options.holdDelay < 0)
    ) {
      throw new RangeError("holdDelay must be a finite, non-negative number.");
    }

    if (controllers.has(options.dictation)) {
      throw new Error(
        "This dictation component already has a text controller.",
      );
    }

    if (
      fields.some(
        (field) => field.ownerDocument !== options.dictation.ownerDocument,
      )
    ) {
      throw new Error("Fields and dictation must belong to the same document.");
    }

    this.#options = { ...options };
    this.#fields = [...new Set(fields)];
    this.#dictation = options.dictation;
    this.#state = options.dictation.recordingState;

    controllers.set(this.#dictation, this);

    const listenerOptions = { signal: this.#listeners.signal };

    this.#dictation.addEventListener(
      "keybinding-input",
      this.#onKey,
      listenerOptions,
    );
    this.#dictation.addEventListener(
      "keybinding-cancelled",
      this.#onCancel,
      listenerOptions,
    );
    this.#dictation.addEventListener(
      "recording-state-changed",
      this.#onRecordingState,
      listenerOptions,
    );
    this.#dictation.addEventListener(
      "transcript",
      this.#onTranscript,
      listenerOptions,
    );
    this.#dictation.addEventListener("error", this.#onError, listenerOptions);
    this.#dictation.addEventListener(
      "stream-closed",
      this.#onError,
      listenerOptions,
    );

    for (const field of this.#fields) {
      field.addEventListener("focus", this.#onFocus, listenerOptions);
      field.addEventListener("blur", this.#onFieldBlur, listenerOptions);
      field.addEventListener("input", this.#onInput, listenerOptions);
      field.addEventListener(
        "beforeinput",
        this.#onBeforeInput,
        listenerOptions,
      );
      field.addEventListener(
        "compositionstart",
        this.#onCompositionStart,
        listenerOptions,
      );
      field.addEventListener(
        "compositionend",
        this.#onCompositionEnd,
        listenerOptions,
      );

      if (field.matches(":focus")) this.#lastFocused = field;
    }

    this.#observer = new MutationObserver(() => {
      if (!this.#dictation.isConnected) {
        this.disconnect();
      } else if (
        (this.#session && !this.#session.field.isConnected) ||
        (this.#gesture && !this.#gesture.field.isConnected)
      ) {
        this.#failed = true;
        this.#cancelGesture();
        this.#finish();
        this.dispatchEvent(new CustomEvent("no-target"));
      }
    });

    const roots = new Set<Node>();

    for (const element of [this.#dictation, ...this.#fields]) {
      let root = element.getRootNode();
      roots.add(root);

      while (root instanceof ShadowRoot) {
        root = root.host.getRootNode();
        roots.add(root);
      }
    }

    for (const root of roots) {
      this.#observer.observe(root, { childList: true, subtree: true });
    }

    if (this.#state !== "stopped") this.#begin();
  }

  /**
   * Permanently detach listeners and observers and release the typing lock.
   * Cancels pending gestures, stops only a recording started by this controller's
   * hold gesture, and restores uncommitted preview content. Safe to call repeatedly.
   */
  disconnect(): void {
    if (this.#disconnected) return;

    this.#disconnected = true;
    this.#listeners.abort();
    this.#observer.disconnect();
    this.#cancelGesture();
    this.#finish();
    controllers.delete(this.#dictation);
  }

  #usable(field: DictationTextField): boolean {
    return (
      field.isConnected &&
      !field.disabled &&
      (!field.readOnly || field === this.#locked)
    );
  }

  #onFocus = (event: Event): void => {
    const field = event.currentTarget;

    if (isTextField(field) && this.#usable(field)) {
      this.#lastFocused = field;
    }
  };

  #onFieldBlur = (): void => {
    if (this.#gesture?.state === "pending") {
      clearTimeout(this.#gesture.timer);
      this.#gesture.state = "cancelled";
    }
  };

  #onCompositionStart = (event: Event): void => {
    if (isTextField(event.currentTarget)) {
      this.#composing.add(event.currentTarget);
      this.#onFieldBlur();
    }
  };

  #onCompositionEnd = (event: Event): void => {
    if (isTextField(event.currentTarget)) {
      this.#composing.delete(event.currentTarget);
    }
  };

  #onKey = (event: Event): void => {
    const { keyboardEvent: key, binding } = (
      event as CustomEvent<KeybindingInputEventDetail>
    ).detail;

    const gesture = this.#gesture;
    const sameKey =
      gesture &&
      (gesture.code ? key.code === gesture.code : key.key === gesture.key);

    if (gesture && sameKey) {
      event.preventDefault();
      key.preventDefault();

      if (key.type === "keyup") {
        this.#gesture = undefined;
        clearTimeout(gesture.timer);

        if (gesture.state === "pending" && this.#usable(gesture.field)) {
          this.#insertCharacter(gesture);
        }

        this.#stopOwnedRecording();
      }

      return;
    }

    if (
      gesture?.state === "pending" &&
      key.type === "keydown" &&
      (key.ctrlKey || key.metaKey || key.altKey || key.isComposing)
    ) {
      clearTimeout(gesture.timer);
      gesture.state = "cancelled";
    }

    if (
      gesture?.state === "pending" &&
      key.type === "keydown" &&
      !key.defaultPrevented &&
      !key.isComposing &&
      !key.ctrlKey &&
      !key.metaKey &&
      !key.altKey &&
      (key.key.length === 1 ||
        ["Enter", "Backspace", "Delete", "Tab"].includes(key.key))
    ) {
      clearTimeout(gesture.timer);
      gesture.state = "typing";
      this.#insertCharacter(gesture);
    }

    const target =
      keybindingEditableTarget(key) ??
      this.#fields.find((field) => field.matches(":focus"));

    if (!isTextField(target) || !this.#fields.includes(target)) return;

    event.preventDefault();

    if (
      key.type !== "keydown" ||
      key.defaultPrevented ||
      key.isComposing ||
      this.#composing.has(target) ||
      (key.ctrlKey && key.key !== "Control") ||
      (key.metaKey && key.key !== "Meta") ||
      (key.altKey && key.key !== "Alt") ||
      !this.#usable(target) ||
      this.#options.shouldHandleKey?.(key, target) === false
    ) {
      return;
    }

    if (!binding) return;

    if (binding === "toggle-to-talk") {
      if (this.#options.allowToggleWhileEditing === false) return;

      key.preventDefault();
      if (!key.repeat) this.#dictation.toggleRecording();
      return;
    }

    key.preventDefault();

    if (key.repeat || this.#gesture) return;

    const next: Gesture = {
      canStart: this.#state === "stopped" && !this.#processing,
      code: key.code,
      field: target,
      key: key.key,
      state: "cancelled",
    };

    this.#gesture = next;
    next.state = "pending";

    if (key.key.length === 1) {
      next.timer = setTimeout(
        () => this.#startHold(next),
        this.#options.holdDelay ?? 250,
      );
    } else {
      this.#startHold(next);
    }
  };

  #startHold(gesture: Gesture): void {
    if (this.#gesture !== gesture || gesture.state !== "pending") return;

    if (
      !this.#usable(gesture.field) ||
      !gesture.canStart ||
      this.#state !== "stopped" ||
      this.#processing
    ) {
      gesture.state = "cancelled";
      return;
    }

    gesture.state = "recording";
    this.#lastFocused = gesture.field;
    this.#ownsRecording = true;
    this.#dictation.startRecording();
  }

  #insertCharacter(gesture: Gesture): void {
    if (!this.#usable(gesture.field) || gesture.field.readOnly) return;

    this.#applyEdit({
      end: gesture.field.selectionEnd ?? 0,
      field: gesture.field,
      inputType: "insertText",
      start: gesture.field.selectionStart ?? 0,
      text: gesture.key,
    });
  }

  #onCancel = (): void => this.#cancelGesture();

  #cancelGesture(): void {
    clearTimeout(this.#gesture?.timer);
    this.#gesture = undefined;
    this.#stopOwnedRecording();
  }

  #stopOwnedRecording(): void {
    if (!this.#ownsRecording) return;

    this.#ownsRecording = false;
    this.#dictation.stopRecording();
  }

  #onRecordingState = (event: Event): void => {
    const detail = (event as CustomEvent<RecordingStateChangedEventDetail>)
      .detail;

    this.#state = detail.state;

    if (detail.state === "initializing") this.#failed = false;

    this.#processing = !this.#failed && detail.processing === true;

    if (
      !this.#active &&
      !this.#failed &&
      (detail.state === "initializing" || detail.state === "recording")
    ) {
      this.#begin();
    }

    if (detail.state === "stopping" || detail.state === "stopped") {
      this.#ownsRecording = false;
    }

    if (detail.state === "stopped" && !this.#processing) this.#finish();
  };

  #begin(): void {
    this.#active = true;

    const focused = this.#fields.find(
      (field) => field.matches(":focus") && this.#usable(field),
    );
    const field =
      focused ??
      (this.#lastFocused && this.#usable(this.#lastFocused)
        ? this.#lastFocused
        : this.#fields.length === 1 && this.#usable(this.#fields[0])
          ? this.#fields[0]
          : undefined);

    if (!field) {
      this.dispatchEvent(new CustomEvent("no-target"));
      return;
    }

    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;

    this.#session = {
      conflicted: false,
      end,
      expected: field.value,
      field,
      finals: new Set(),
      hasText: false,
      interim: false,
      original: field.value.slice(start, end),
      primaryLanguage: this.#dictation.dictationConfig?.primaryLanguage,
      start,
    };

    if (this.#options.preventTypingWhileDictating !== false) {
      this.#locked = field;
      field.readOnly = true;
    }
  }

  #onTranscript = (event: Event): void => {
    const session = this.#session;

    if (
      !session ||
      session.conflicted ||
      this.#options.insertTranscripts === false
    )
      return;

    const { data } = (event as CustomEvent<Corti.TranscribeTranscriptMessage>)
      .detail;

    if (!data.isFinal && this.#options.transcriptMode === "final") return;
    if (!this.#reconcile(session)) return;

    const id = `${data.start}:${data.end}:${data.text}`;

    if (data.isFinal && session.finals.has(id)) return;

    let text = data.text;
    let boundaries: DictationTextBoundaries = { leading: "", trailing: "" };

    try {
      if (this.#options.transformTranscript) {
        text = this.#options.transformTranscript(data.text, {
          end: session.end,
          field: session.field,
          isFinal: data.isFinal,
          start: session.start,
        });
      }

      if (typeof text !== "string") {
        throw new TypeError("transformTranscript must return a string.");
      }

      if (text) {
        const before = session.field.value.slice(0, session.start);
        const after = session.field.value.slice(session.end);

        boundaries = {
          leading:
            (session.hasText
              ? this.#options.spaceBetweenSegments
              : this.#options.spaceAroundInsertion) !== false
              ? boundarySeparator(
                  before.slice(-1),
                  text[0],
                  session.primaryLanguage,
                )
              : "",
          trailing:
            this.#options.spaceAroundInsertion !== false
              ? boundarySeparator(
                  text.slice(-1),
                  after[0] ?? "",
                  session.primaryLanguage,
                )
              : "",
        };

        if (this.#options.formatBoundaries) {
          boundaries = this.#options.formatBoundaries(boundaries, {
            after,
            before,
            end: session.end,
            field: session.field,
            isFinal: data.isFinal,
            leadingBoundary: before
              ? session.hasText
                ? "dictated-text"
                : "existing-text"
              : null,
            primaryLanguage: session.primaryLanguage,
            start: session.start,
            text,
            trailingBoundary: after ? "existing-text" : null,
          });
        }

        if (
          !boundaries ||
          typeof boundaries.leading !== "string" ||
          typeof boundaries.trailing !== "string"
        ) {
          throw new TypeError(
            "formatBoundaries must return leading and trailing strings.",
          );
        }
      }
    } catch (error) {
      this.#editFailed(error);
      return;
    }

    if (!text && !session.interim) return;

    if (!text && data.isFinal) {
      if (
        this.#applyEdit(
          {
            end: session.end,
            field: session.field,
            inputType: "insertFromDictation",
            start: session.start,
            text: session.original,
          },
          session.hasText ? 0 : session.original.length,
        )
      ) {
        session.end = session.start + session.original.length;
        session.expected = session.field.value;
        session.interim = false;
        session.finals.add(id);
      }

      return;
    }

    if (
      !this.#applyEdit(
        {
          end: session.end,
          field: session.field,
          inputType: "insertFromDictation",
          start: session.start,
          text: boundaries.leading + text + boundaries.trailing,
        },
        boundaries.leading.length + text.length,
      )
    )
      return;

    session.end =
      session.start +
      boundaries.leading.length +
      text.length +
      boundaries.trailing.length;
    session.expected = session.field.value;
    session.interim = !data.isFinal;

    if (data.isFinal) {
      session.finals.add(id);
      // Keep the generated suffix separator replaceable by the next segment.
      session.start = session.end - boundaries.trailing.length;
      session.original = boundaries.trailing;
      session.hasText = true;
    }
  };

  #onBeforeInput = (event: Event): void => {
    if (this.#applyingEdit || event.currentTarget !== this.#session?.field)
      return;

    const field = this.#session.field;

    this.#pendingEdit = {
      end: field.selectionEnd ?? 0,
      inputType: (event as InputEvent).inputType,
      start: field.selectionStart ?? 0,
      value: field.value,
    };
  };

  #onInput = (event: Event): void => {
    if (!this.#applyingEdit && event.currentTarget === this.#session?.field) {
      this.#reconcile(this.#session);
      this.#pendingEdit = undefined;
    }
  };

  #reconcile(session: Session): boolean {
    if (session.conflicted) return false;

    const before = session.expected;
    const after = session.field.value;

    if (before === after) return true;

    let start = 0;

    while (
      start < before.length &&
      start < after.length &&
      before[start] === after[start]
    )
      start++;

    let end = before.length;
    let nextEnd = after.length;

    while (
      end > start &&
      nextEnd > start &&
      before[end - 1] === after[nextEnd - 1]
    ) {
      end--;
      nextEnd--;
    }

    const delta = after.length - before.length;
    const pending = this.#pendingEdit;
    this.#pendingEdit = undefined;

    if (pending?.value === before) {
      let editStart = pending.start;
      let editEnd = pending.end;

      if (editStart === editEnd && delta < 0) {
        if (pending.inputType.endsWith("Backward")) editStart += delta;
        if (pending.inputType.endsWith("Forward")) editEnd -= delta;
      }

      const insertedLength = editEnd - editStart + delta;

      if (
        insertedLength >= 0 &&
        before.slice(0, editStart) === after.slice(0, editStart) &&
        before.slice(editEnd) === after.slice(editStart + insertedLength)
      ) {
        start = editStart;
        end = editEnd;
      }
    }

    if (end <= session.start && start < session.start) {
      session.start += delta;
      session.end += delta;
    } else if (
      start >= session.end &&
      (session.end !== session.start || start > session.start)
    ) {
      // The edit is after the dictated range.
    } else {
      session.conflicted = true;
      this.dispatchEvent(
        new CustomEvent("text-conflict", {
          detail: { field: session.field },
        }),
      );

      return false;
    }

    session.expected = after;
    return true;
  }

  #applyEdit(
    edit: Omit<DictationTextEdit, "selectionStart" | "selectionEnd">,
    selectionOffset = edit.text.length,
  ): boolean {
    const { field, start, end, text } = edit;
    const expected =
      field.value.slice(0, start) + text + field.value.slice(end);

    const map = (position: number) =>
      position < start
        ? position
        : position <= end
          ? start + selectionOffset
          : position + text.length - (end - start);

    const selectionStart =
      edit.inputType === "insertText"
        ? start + text.length
        : map(field.selectionStart ?? 0);
    const selectionEnd =
      edit.inputType === "insertText"
        ? selectionStart
        : map(field.selectionEnd ?? 0);

    this.#applyingEdit = true;

    try {
      if (this.#options.applyEdit) {
        this.#options.applyEdit({ ...edit, selectionEnd, selectionStart });
      } else {
        field.setRangeText(text, start, end, "preserve");
        field.setSelectionRange(selectionStart, selectionEnd);
        field.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            data: text,
            inputType: edit.inputType,
          }),
        );
      }

      if (field.value !== expected) {
        throw new Error(
          "The edit adapter or input handler must apply text edits synchronously without replacing the value.",
        );
      }

      return true;
    } catch (error) {
      this.#editFailed(error);
      return false;
    } finally {
      this.#applyingEdit = false;
    }
  }

  #editFailed(error: unknown): void {
    if (this.#session) this.#session.conflicted = true;

    this.#unlock();
    this.dispatchEvent(errorEvent(error));
  }

  #onError = (event: Event): void => {
    this.#failed = true;
    this.#processing = false;

    if (event.type !== "stream-closed") this.#ownsRecording = false;

    this.#cancelGesture();
    this.#finish();
  };

  #unlock(): void {
    if (this.#locked) this.#locked.readOnly = false;

    this.#locked = undefined;
  }

  #finish(): void {
    const session = this.#session;

    if (session?.interim && this.#reconcile(session)) {
      this.#applyEdit(
        {
          end: session.end,
          field: session.field,
          inputType: "insertFromDictation",
          start: session.start,
          text: session.original,
        },
        session.hasText ? 0 : session.original.length,
      );
    }

    this.#session = undefined;
    this.#pendingEdit = undefined;
    this.#active = false;
    this.#unlock();
  }
}
