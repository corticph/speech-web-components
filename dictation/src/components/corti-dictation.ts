import { CortiRoot } from "@core/components/corti-root.js";
import { safeCustomElement } from "@core/utils/custom-elements.js";
import type { Corti, CortiAuth } from "@corti/sdk";
import { html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ref } from "lit/directives/ref.js";
import { DEFAULT_DICTATION_CONFIG } from "../constants.js";
import type { DictationRoot } from "../contexts/dictation-context.js";
import { WEB_COMPONENT_VERSION } from "../version.js";
import type { DictationRecordingButton } from "./dictation-recording-button.js";

import "../contexts/dictation-context.js";
import "./dictation-recording-button.js";
import "./dictation-settings-menu.js";

@safeCustomElement("corti-dictation")
export class CortiDictation extends CortiRoot<
  DictationRoot,
  DictationRecordingButton
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

  /**
   * Overrides any device selection and instead uses getDisplayMedia to stream system audio.
   * Should only be used for debugging.
   */
  @property({ attribute: "debug-display-audio", type: Boolean })
  debug_displayAudio: boolean = false;

  /**
   * Configuration settings for dictation
   */
  @property({ attribute: false, type: Object })
  set dictationConfig(value: Corti.TranscribeConfig) {
    this._dictationConfig = value;
  }

  get dictationConfig(): Corti.TranscribeConfig {
    return (
      this._contextProviderRef.value?.dictationConfig || this._dictationConfig
    );
  }

  @state()
  _dictationConfig: Corti.TranscribeConfig = DEFAULT_DICTATION_CONFIG;

  // ─────────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the latest access token.
   * @returns ServerConfig with environment, tenant, and accessToken
   * @deprecated Use 'accessToken' property instead.
   */
  public setAccessToken(token: string) {
    this.accessToken = token;

    return (
      this._contextProviderRef.value?.setAccessToken(token) ?? {
        accessToken: token,
        environment: undefined,
        tenant: undefined,
      }
    );
  }

  /**
   * Set the auth configuration for OAuth flows.
   * @returns Promise with ServerConfig containing environment, tenant, and accessToken
   * @deprecated Use 'authConfig' property instead.
   */
  public async setAuthConfig(config: CortiAuth.AuthTokenDerivable) {
    this.authConfig = config;

    return (
      this._contextProviderRef.value?.setAuthConfig(config) ?? {
        accessToken: undefined,
        environment: undefined,
        tenant: undefined,
      }
    );
  }

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
      <dictation-root
        ${ref(this._contextProviderRef)}
        class=${classMap({ hidden: isHidden })}
        .accessToken=${this.accessToken}
        .authConfig=${this.authConfig}
        .analytics=${this.analytics}
        .socketUrl=${this.socketUrl}
        .socketProxy=${this.socketProxy}
        .dictationConfig=${this._dictationConfig}
        .languages=${this._languagesSupported}
        .devices=${this._devices}
        .selectedDevice=${this._selectedDevice}
        .debug_displayAudio=${this.debug_displayAudio}
        .pushToTalkKeybinding=${this._pushToTalkKeybinding}
        .toggleToTalkKeybinding=${this._toggleToTalkKeybinding}
      >
        <dictation-recording-button
          ${ref(this._recordingButtonRef)}
          ?allowButtonFocus=${this.allowButtonFocus}
        ></dictation-recording-button>
        ${
          this.settingsEnabled?.length > 0
            ? html`<dictation-settings-menu
                .settingsEnabled=${this.settingsEnabled}
                ?allowButtonFocus=${this.allowButtonFocus}
              ></dictation-settings-menu>`
            : nothing
        }
      </dictation-root>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corti-dictation": CortiDictation;
  }
}
