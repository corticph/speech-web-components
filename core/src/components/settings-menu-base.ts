import { consume } from "@lit/context";
import {
  type CSSResultGroup,
  html,
  LitElement,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from "lit";
import { property, state } from "lit/decorators.js";
import { recordingStateContext } from "../contexts/mixins/recording-state-context.js";
import ButtonStyles from "../styles/buttons.js";
import CalloutStyles from "../styles/callout.js";
import SettingsMenuStyles from "../styles/settings-menu.js";
import type { ConfigurableSettings, RecordingState } from "../types.js";
import { commaSeparatedConverter } from "../utils/converters.js";

import "../icons/icons.js";

type EditorFocus = {
  field: HTMLElement;
  selection?: {
    anchor: Node;
    anchorOffset: number;
    focus: Node;
    focusOffset: number;
  };
};

export abstract class SettingsMenuBase extends LitElement {
  protected abstract _renderDeviceSelector(
    isRecording: boolean,
  ): TemplateResult | typeof nothing;

  protected abstract _renderLanguageSelector(
    isRecording: boolean,
  ): TemplateResult | typeof nothing;

  protected abstract _renderKeybindingSelector(
    isRecording: boolean,
  ): TemplateResult | typeof nothing;

  protected _renderVirtualModeSelector(
    _isRecording: boolean,
  ): TemplateResult | typeof nothing {
    return nothing;
  }

  @consume({ context: recordingStateContext, subscribe: true })
  @state()
  _recordingState: RecordingState = "stopped";

  @property({
    converter: commaSeparatedConverter,
    type: Array,
  })
  settingsEnabled: ConfigurableSettings[] = ["device", "language"];

  /** Whether clicking the settings button may move focus to it. */
  @property({ type: Boolean })
  allowButtonFocus: boolean = false;

  #editorFocus?: EditorFocus;
  #pendingRestore?: { editor: EditorFocus; pointerId: number };

  static styles: CSSResultGroup = [
    SettingsMenuStyles,
    ButtonStyles,
    CalloutStyles,
  ];

  #handleMouseDown(event: MouseEvent): void {
    if (!this.allowButtonFocus) {
      event.preventDefault();
    }
  }

  #activeElement(): Element | null {
    let active = this.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  #captureEditorFocus(): EditorFocus | undefined {
    const field = this.#activeElement();
    if (
      !(field instanceof HTMLElement) ||
      !(
        (field instanceof HTMLInputElement && field.selectionStart !== null) ||
        field instanceof HTMLTextAreaElement ||
        field.isContentEditable
      )
    ) {
      return undefined;
    }

    const editor: EditorFocus = { field };
    const selection = this.ownerDocument.getSelection();
    if (
      field.isContentEditable &&
      selection?.anchorNode &&
      selection.focusNode &&
      field.contains(selection.anchorNode) &&
      field.contains(selection.focusNode)
    ) {
      editor.selection = {
        anchor: selection.anchorNode,
        anchorOffset: selection.anchorOffset,
        focus: selection.focusNode,
        focusOffset: selection.focusOffset,
      };
    }
    return editor;
  }

  #isNeutralOutside(event: MouseEvent | PointerEvent): boolean {
    const path = event.composedPath();
    return (
      !path.includes(this) &&
      !path.some(
        (node) =>
          node instanceof Element &&
          (node.matches(
            "a[href], area[href], button, input, select, textarea, summary, [tabindex], [controls]",
          ) ||
            (node instanceof HTMLElement && node.isContentEditable) ||
            (node instanceof HTMLLabelElement && node.control !== null)),
      )
    );
  }

  #handleOutsidePointerDown = (event: PointerEvent): void => {
    this.#pendingRestore = undefined;
    if (
      !this.allowButtonFocus &&
      event.isPrimary &&
      event.button === 0 &&
      this.#editorFocus &&
      this.#isNeutralOutside(event) &&
      this.#activeElement() instanceof HTMLSelectElement &&
      this.renderRoot
        .querySelector("#settings-popover")
        ?.matches(":focus-within")
    ) {
      this.#pendingRestore = {
        editor: this.#editorFocus,
        pointerId: event.pointerId,
      };
    }
  };

  #handleOutsidePointerUp = (event: PointerEvent): void => {
    const pending = this.#pendingRestore;
    if (!pending || event.pointerId !== pending.pointerId) return;

    // A drag can end without dismissing the popover.
    this.ownerDocument.defaultView?.setTimeout(() => {
      if (
        this.#pendingRestore === pending &&
        this.renderRoot
          .querySelector("#settings-popover")
          ?.matches(":popover-open")
      ) {
        this.#pendingRestore = undefined;
      }
    }, 0);
  };

  #handleOutsidePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.#pendingRestore?.pointerId) {
      this.#pendingRestore = undefined;
    }
  };

  #handleOutsideMouseDown = (event: MouseEvent): void => {
    if (
      this.allowButtonFocus ||
      event.button !== 0 ||
      this.matches(":focus-within") ||
      !this.#isNeutralOutside(event)
    ) {
      return;
    }

    const active = this.#activeElement();
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      event.preventDefault();
    }
  };

  #removeOutsideListener(): void {
    const document = this.ownerDocument;
    document.removeEventListener(
      "mousedown",
      this.#handleOutsideMouseDown,
      true,
    );
    document.removeEventListener(
      "pointerdown",
      this.#handleOutsidePointerDown,
      true,
    );
    document.removeEventListener(
      "pointerup",
      this.#handleOutsidePointerUp,
      true,
    );
    document.removeEventListener(
      "pointercancel",
      this.#handleOutsidePointerCancel,
      true,
    );
  }

  #handleBeforeToggle(event: ToggleEvent): void {
    this.#removeOutsideListener();
    if (event.newState === "open") {
      this.#pendingRestore = undefined;
      this.#editorFocus = this.allowButtonFocus
        ? undefined
        : this.#captureEditorFocus();
      this.ownerDocument.addEventListener(
        "mousedown",
        this.#handleOutsideMouseDown,
        true,
      );
      this.ownerDocument.addEventListener(
        "pointerdown",
        this.#handleOutsidePointerDown,
        true,
      );
      this.ownerDocument.addEventListener(
        "pointerup",
        this.#handleOutsidePointerUp,
        true,
      );
      this.ownerDocument.addEventListener(
        "pointercancel",
        this.#handleOutsidePointerCancel,
        true,
      );
    }
  }

  #handleToggle(event: ToggleEvent): void {
    if (event.newState !== "closed") return;
    const pending = this.#pendingRestore;
    this.#pendingRestore = undefined;
    this.#editorFocus = undefined;
    const document = this.ownerDocument;
    if (
      !pending ||
      this.allowButtonFocus ||
      !pending.editor.field.isConnected ||
      pending.editor.field.ownerDocument !== document ||
      !document.hasFocus() ||
      (document.activeElement !== document.body &&
        document.activeElement !== document.documentElement)
    ) {
      return;
    }

    const { field, selection } = pending.editor;
    field.focus({ preventScroll: true });
    if (
      selection &&
      this.#activeElement() === field &&
      field.contains(selection.anchor) &&
      field.contains(selection.focus) &&
      selection.anchorOffset <=
        (selection.anchor instanceof CharacterData
          ? selection.anchor.length
          : selection.anchor.childNodes.length) &&
      selection.focusOffset <=
        (selection.focus instanceof CharacterData
          ? selection.focus.length
          : selection.focus.childNodes.length)
    ) {
      document
        .getSelection()
        ?.setBaseAndExtent(
          selection.anchor,
          selection.anchorOffset,
          selection.focus,
          selection.focusOffset,
        );
    }
  }

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("settingsEnabled") &&
      this.settingsEnabled?.length === 0
    ) {
      this.#removeOutsideListener();
      this.#pendingRestore = undefined;
      this.#editorFocus = undefined;
    }
  }

  override disconnectedCallback(): void {
    this.#removeOutsideListener();
    this.#pendingRestore = undefined;
    this.#editorFocus = undefined;
    super.disconnectedCallback();
  }

  render() {
    if (this.settingsEnabled?.length === 0) {
      return nothing;
    }

    const isRecording = this._recordingState === "recording";
    const showDeviceSelector = this.settingsEnabled.includes("device");
    const showLanguageSelector = this.settingsEnabled.includes("language");
    const showKeybinding = this.settingsEnabled.includes("keybinding");
    const showVirtualMode = this.settingsEnabled.includes("virtualMode");

    return html`
      <div class="mic-selector">
        <button
          @mousedown=${this.#handleMouseDown}
          id="settings-popover-button"
          popovertarget="settings-popover"
        >
          <icon-settings />
        </button>
        <div
          id="settings-popover"
          popover
          @beforetoggle=${this.#handleBeforeToggle}
          @toggle=${this.#handleToggle}
        >
          <div class="settings-wrapper">
            ${
              isRecording
                ? html`
                  <div class="callout warn">
                    Recording is in progress. Stop recording to change settings.
                  </div>
                `
                : nothing
            }
            ${showDeviceSelector ? this._renderDeviceSelector(isRecording) : nothing}
            ${showLanguageSelector ? this._renderLanguageSelector(isRecording) : nothing}
            ${showKeybinding ? this._renderKeybindingSelector(isRecording) : nothing}
            ${showVirtualMode ? this._renderVirtualModeSelector(isRecording) : nothing}
          </div>
        </div>
      </div>
    `;
  }
}
