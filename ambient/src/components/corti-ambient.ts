import { CortiRoot } from "@core/components/corti-root.js";
import type { ConfigurableSettings } from "@core/types.js";
import { commaSeparatedConverter } from "@core/utils/converters.js";
import { safeCustomElement } from "@core/utils/custom-elements.js";
import type { Corti } from "@corti/sdk";
import { html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ref } from "lit/directives/ref.js";
import { DEFAULT_AMBIENT_CONFIG } from "../constants.js";
import type { AmbientRoot } from "../contexts/ambient-context.js";
import { WEB_COMPONENT_VERSION } from "../version.js";
import type { AmbientRecordingButton } from "./ambient-recording-button.js";

import "../contexts/ambient-context.js";
import "./ambient-recording-button.js";
import "./ambient-settings-menu.js";

@safeCustomElement("corti-ambient")
export class CortiAmbient extends CortiRoot<
  AmbientRoot,
  AmbientRecordingButton
> {
  // ─────────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Published package version. `0.0.0-dev` in local builds.
   */
  get version(): string {
    return WEB_COMPONENT_VERSION;
  }

  @property({
    converter: commaSeparatedConverter,
    type: Array,
  })
  override settingsEnabled: ConfigurableSettings[] = [
    "device",
    "language",
    "virtualMode",
  ];

  /**
   * Stream configuration for ambient capture (modes, transcription, etc.).
   */
  @property({ attribute: false, type: Object })
  set ambientConfig(value: Corti.StreamConfig) {
    this._ambientConfig = value;
  }

  get ambientConfig(): Corti.StreamConfig {
    return (
      this._contextProviderRef.value?.ambientConfig ??
      this._ambientConfig ??
      DEFAULT_AMBIENT_CONFIG
    );
  }

  @state()
  _ambientConfig: Corti.StreamConfig = DEFAULT_AMBIENT_CONFIG;

  /**
   * Stream interaction id passed to `stream.connect` for this session.
   */
  @property({ type: String })
  set interactionId(value: string | undefined) {
    this._interactionId = value;
  }

  get interactionId(): string | undefined {
    return this._contextProviderRef.value?.interactionId ?? this._interactionId;
  }

  @state()
  _interactionId?: string;

  /**
   * Enables virtual mode behavior for ambient recording.
   */
  @property({ attribute: "virtualMode", type: Boolean })
  set virtualMode(value: boolean) {
    this._virtualMode = value;
  }

  get virtualMode(): boolean {
    return this._contextProviderRef.value?.virtualMode ?? this._virtualMode;
  }

  @state()
  _virtualMode: boolean = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  render() {
    const isHidden =
      !this.accessToken &&
      !this.authConfig &&
      !this.socketUrl &&
      !this.socketProxy;

    return html`
      <ambient-root
        ${ref(this._contextProviderRef)}
        class=${classMap({ hidden: isHidden })}
        .accessToken=${this.accessToken}
        .authConfig=${this.authConfig}
        .analytics=${this.analytics}
        .socketUrl=${this.socketUrl}
        .socketProxy=${this.socketProxy}
        .ambientConfig=${this._ambientConfig}
        .interactionId=${this._interactionId}
        ?virtualMode=${this.virtualMode}
        .languages=${this._languagesSupported}
        .devices=${this._devices}
        .selectedDevice=${this._selectedDevice}
        .pushToTalkKeybinding=${this._pushToTalkKeybinding}
        .toggleToTalkKeybinding=${this._toggleToTalkKeybinding}
      >
        <ambient-recording-button
          ${ref(this._recordingButtonRef)}
          ?allowButtonFocus=${this.allowButtonFocus}
        ></ambient-recording-button>
        ${
          this.settingsEnabled?.length > 0
            ? html`<ambient-settings-menu
                .settingsEnabled=${this.settingsEnabled}
                ?allowButtonFocus=${this.allowButtonFocus}
              ></ambient-settings-menu>`
            : nothing
        }
      </ambient-root>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corti-ambient": CortiAmbient;
  }
}
