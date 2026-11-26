import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { RecordingState } from "../types.js";
import {
  type KeybindingInputEventDetail,
  keybindingActivatedEvent,
  keybindingCancelledEvent,
  keybindingInputEvent,
} from "../utils/events.js";
import {
  keybindingEditableTarget,
  matchesKeybinding,
} from "../utils/keybinding.js";

interface KeybindingControllerHost extends ReactiveControllerHost {
  _recordingState?: RecordingState;
  _pushToTalkKeybinding?: string | null;
  _toggleToTalkKeybinding?: string | null;
  readonly editableKeybindingEvents?: boolean;
  startRecording(): void;
  stopRecording(): void;
  toggleRecording(): void;
  dispatchEvent(event: Event): boolean;
}

export class KeybindingController implements ReactiveController {
  host: KeybindingControllerHost;

  #keydownHandler?: (event: KeyboardEvent) => void;
  #keyupHandler?: (event: KeyboardEvent) => void;
  #blurHandler?: () => void;
  #isPushToTalkKeyPressed: boolean = false;

  constructor(host: KeybindingControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#setupListeners();
  }

  hostDisconnected(): void {
    this.#cancel("disconnected");
    this.#removeListeners();
  }

  #cancel(reason: "blur" | "disconnected"): void {
    if (this.host.editableKeybindingEvents) {
      this.host.dispatchEvent(keybindingCancelledEvent(reason));
    }
    if (this.#isPushToTalkKeyPressed) {
      this.#isPushToTalkKeyPressed = false;
      this.host.stopRecording();
    }
  }

  #binding(event: KeyboardEvent): KeybindingInputEventDetail["binding"] {
    if (matchesKeybinding(event, this.host._toggleToTalkKeybinding)) {
      return "toggle-to-talk";
    }
    return matchesKeybinding(event, this.host._pushToTalkKeybinding)
      ? "push-to-talk"
      : null;
  }

  #arbitrate(event: KeyboardEvent): boolean {
    return (
      !this.host.editableKeybindingEvents ||
      this.host.dispatchEvent(
        keybindingInputEvent({
          binding: this.#binding(event),
          keyboardEvent: event,
        }),
      )
    );
  }

  #setupListeners(): void {
    this.#removeListeners();

    this.#keydownHandler = (event: KeyboardEvent) => {
      if (!this.#arbitrate(event) || keybindingEditableTarget(event)) {
        return;
      }

      if (
        this.host.editableKeybindingEvents &&
        (event.repeat || event.isComposing || event.defaultPrevented)
      ) {
        return;
      }

      if (
        this.host._toggleToTalkKeybinding &&
        matchesKeybinding(event, this.host._toggleToTalkKeybinding) &&
        !this.#isPushToTalkKeyPressed
      ) {
        if (!this.host.dispatchEvent(keybindingActivatedEvent(event))) {
          return;
        }

        this.host.toggleRecording();
        return;
      }

      if (
        this.host._pushToTalkKeybinding &&
        matchesKeybinding(event, this.host._pushToTalkKeybinding)
      ) {
        if (
          this.host.editableKeybindingEvents &&
          this.host._recordingState !== undefined &&
          this.host._recordingState !== "stopped"
        ) {
          return;
        }
        if (!this.host.dispatchEvent(keybindingActivatedEvent(event))) {
          return;
        }

        this.#isPushToTalkKeyPressed = true;
        this.host.startRecording();
      }
    };

    this.#keyupHandler = (event: KeyboardEvent) => {
      if (!this.#arbitrate(event)) {
        return;
      }
      if (
        this.#isPushToTalkKeyPressed &&
        this.host._pushToTalkKeybinding &&
        matchesKeybinding(event, this.host._pushToTalkKeybinding)
      ) {
        if (!this.host.dispatchEvent(keybindingActivatedEvent(event))) {
          return;
        }
        this.#isPushToTalkKeyPressed = false;
        this.host.stopRecording();
      }
    };

    this.#blurHandler = () => {
      this.#cancel("blur");
    };

    window.addEventListener("keydown", this.#keydownHandler);
    window.addEventListener("keyup", this.#keyupHandler);
    window.addEventListener("blur", this.#blurHandler);
  }

  #removeListeners(): void {
    if (this.#keydownHandler) {
      window.removeEventListener("keydown", this.#keydownHandler);
      this.#keydownHandler = undefined;
    }

    if (this.#keyupHandler) {
      window.removeEventListener("keyup", this.#keyupHandler);
      this.#keyupHandler = undefined;
    }

    if (this.#blurHandler) {
      window.removeEventListener("blur", this.#blurHandler);
      this.#blurHandler = undefined;
    }
  }
}
