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

  #handleOutsideMouseDown = (event: MouseEvent): void => {
    const path = event.composedPath();
    if (
      this.allowButtonFocus ||
      event.button !== 0 ||
      this.matches(":focus-within") ||
      path.includes(this) ||
      path.some(
        (node) =>
          node instanceof Element &&
          (node.matches(
            "a[href], area[href], button, input, select, textarea, summary, [tabindex], [controls]",
          ) ||
            (node instanceof HTMLElement && node.isContentEditable) ||
            (node instanceof HTMLLabelElement && node.control !== null)),
      )
    ) {
      return;
    }

    let active = this.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      event.preventDefault();
    }
  };

  #removeOutsideListener(): void {
    this.ownerDocument.removeEventListener(
      "mousedown",
      this.#handleOutsideMouseDown,
      true,
    );
  }

  #handleBeforeToggle(event: ToggleEvent): void {
    this.#removeOutsideListener();
    if (event.newState === "open") {
      this.ownerDocument.addEventListener(
        "mousedown",
        this.#handleOutsideMouseDown,
        true,
      );
    }
  }

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("settingsEnabled") &&
      this.settingsEnabled?.length === 0
    ) {
      this.#removeOutsideListener();
    }
  }

  override disconnectedCallback(): void {
    this.#removeOutsideListener();
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
