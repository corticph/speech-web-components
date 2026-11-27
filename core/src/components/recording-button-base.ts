import type { CortiAuth } from "@corti/sdk";
import { consume } from "@lit/context";
import type { TemplateResult } from "lit";
import {
  type CSSResultGroup,
  html,
  LitElement,
  type PropertyValues,
} from "lit";
import { property, state } from "lit/decorators.js";
import { AUDIO_CHUNK_INTERVAL_MS } from "../constants.js";
import { analyticsContext } from "../contexts/mixins/analytics-context.js";
import {
  accessTokenContext,
  authConfigContext,
  regionContext,
  tenantNameContext,
} from "../contexts/mixins/auth-context.js";
import { selectedDeviceContext } from "../contexts/mixins/devices-context.js";
import {
  pushToTalkKeybindingContext,
  toggleToTalkKeybindingContext,
} from "../contexts/mixins/keybindings-context.js";
import {
  socketProxyContext,
  socketUrlContext,
} from "../contexts/mixins/proxy-context.js";
import { recordingStateContext } from "../contexts/mixins/recording-state-context.js";
import { KeybindingController } from "../controllers/keybinding-controller.js";
import { MediaController } from "../controllers/media-controller.js";
import type {
  SocketController,
  SocketControllerOutboundItem,
  SocketControllerWebSocket,
} from "../controllers/socket-controller.js";
import type { RecordingSocketInboundMessage } from "../socket-messages.js";
import ButtonStyles from "../styles/buttons.js";
import RecordingButtonStyles from "../styles/recording-button.js";
import type { ProxyOptions, RecordingState } from "../types.js";
import {
  audioEventEvent,
  audioLevelChangedEvent,
  commandEvent,
  deltaUsageEvent,
  errorEvent,
  factsEvent,
  networkActivityEvent,
  type RecordingStateChangedEventDetail,
  recordingStateChangedEvent,
  streamClosedEvent,
  transcriptEvent,
  usageEvent,
} from "../utils/events.js";

import "../icons/icons.js";
import "./speech-audio-visualiser.js";

export abstract class RecordingButtonBase<
  TConfig,
  TMessage extends
    RecordingSocketInboundMessage = RecordingSocketInboundMessage,
> extends LitElement {
  @state()
  _debug_displayAudio?: boolean;

  @state()
  _virtualMode?: boolean;
  protected get _audioLevel(): number {
    return this.#mediaController.audioLevel;
  }

  protected _renderAudioVisualiser(isRecording: boolean): TemplateResult {
    return html`<speech-audio-visualiser
      .level=${this._audioLevel}
      ?active=${isRecording}
    ></speech-audio-visualiser>`;
  }

  @consume({ context: recordingStateContext, subscribe: true })
  @state()
  _recordingState: RecordingState = "stopped";

  @consume({ context: selectedDeviceContext, subscribe: true })
  @state()
  _selectedDevice?: MediaDeviceInfo;

  @consume({ context: analyticsContext, subscribe: true })
  @state()
  _analytics?: Record<string, string>;

  @consume({ context: accessTokenContext, subscribe: true })
  @state()
  _accessToken?: string;

  @consume({ context: authConfigContext, subscribe: true })
  @state()
  _authConfig?: CortiAuth.AuthTokenDerivable;

  @consume({ context: regionContext, subscribe: true })
  @state()
  _region?: string;

  @consume({ context: tenantNameContext, subscribe: true })
  @state()
  _tenantName?: string;

  @consume({ context: socketUrlContext, subscribe: true })
  @state()
  _socketUrl?: string;

  @consume({ context: socketProxyContext, subscribe: true })
  @state()
  _socketProxy?: ProxyOptions;

  @consume({ context: pushToTalkKeybindingContext, subscribe: true })
  @state()
  _pushToTalkKeybinding?: string | null;

  @consume({ context: toggleToTalkKeybindingContext, subscribe: true })
  @state()
  _toggleToTalkKeybinding?: string | null;

  @property({ type: Boolean })
  allowButtonFocus: boolean = false;

  protected abstract _socketController: SocketController<
    SocketControllerOutboundItem,
    TMessage,
    TConfig,
    SocketControllerWebSocket
  >;

  protected abstract _getConnectConfig(): TConfig;

  #mediaController = new MediaController(this);
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Controller self-registers in constructor (addController).
  #keybindingController = new KeybindingController(this);
  #closeConnectionOnInit = false;
  #processing = false;
  #connection: RecordingStateChangedEventDetail["connection"] = "CLOSED";

  static styles: CSSResultGroup = [RecordingButtonStyles, ButtonStyles];

  protected update(changedProperties: PropertyValues) {
    if (
      changedProperties.has("_recordingState") &&
      this._recordingState === "recording" &&
      this.#closeConnectionOnInit
    ) {
      this.#closeConnectionOnInit = false;
      this.#handleStop();
    }

    super.update(changedProperties);
  }

  #handleClick(event: MouseEvent): void {
    if (!this.allowButtonFocus) {
      event.preventDefault();
    }

    this.toggleRecording();
  }

  #handleMouseDown(event: MouseEvent): void {
    if (!this.allowButtonFocus) {
      event.preventDefault();
    }
  }

  #handleWebSocketMessage = (message: TMessage): void => {
    switch (message.type) {
      case "CONFIG_DENIED":
        this.dispatchEvent(
          errorEvent(`Config denied: ${message.reason ?? "Unknown reason"}`),
        );
        this.#handleStop();
        break;
      case "CONFIG_TIMEOUT":
        this.dispatchEvent(errorEvent("Config timeout"));
        this.#handleStop();
        break;
      case "transcript":
        this.dispatchEvent(transcriptEvent(message));
        break;
      case "command":
        this.dispatchEvent(commandEvent(message));
        break;
      case "facts":
        this.dispatchEvent(factsEvent(message));
        break;
      case "usage":
        this.dispatchEvent(usageEvent(message));
        break;
      case "delta_usage":
        this.dispatchEvent(deltaUsageEvent(message));
        break;
      case "audioEvent":
        this.dispatchEvent(audioEventEvent(message));
        break;
      case "error":
        this.dispatchEvent(errorEvent(message.error));
        this.#handleStop();
        break;
      case "ended":
      case "ENDED":
        this.#processing = false;
        this.#dispatchRecordingStateChanged(this._recordingState);
        break;
      case "flushed":
        if (
          this._recordingState === "stopped" ||
          this._recordingState === "stopping"
        ) {
          this.#processing = false;
          this.#dispatchRecordingStateChanged(this._recordingState);
        }
        break;
    }
  };

  #handleWebSocketError = (error: Error): void => {
    this.dispatchEvent(errorEvent(`Socket error: ${error.message}`));
    this.#processing = false;
    this.#connection = "CLOSED";
    this.#handleStop();
  };

  #handleWebSocketClose = (event: unknown): void => {
    if (
      this._socketController.isConnectionOpen() ||
      this._socketController.isConnecting()
    ) {
      return;
    }

    this.#processing = false;
    this.#connection = "CLOSED";
    this.dispatchEvent(streamClosedEvent(event));
    this.#dispatchRecordingStateChanged(this._recordingState);
  };

  #dispatchRecordingStateChanged(state: RecordingState): void {
    this.dispatchEvent(
      recordingStateChangedEvent(state, {
        connection: this.#connection,
        processing: this.#processing,
      }),
    );
  }

  async #handleStart(): Promise<void> {
    this.#dispatchRecordingStateChanged("initializing");

    try {
      await this.#mediaController.initialize(() => {
        if (this._recordingState === "recording") {
          this.dispatchEvent(errorEvent("Recording device access was lost."));
          this.#handleStop();
        }
      }, this._socketController.mediaRecorderHandler);
      this.#mediaController.mediaRecorder?.start(AUDIO_CHUNK_INTERVAL_MS);
      this.#mediaController.startAudioLevelMonitoring((level) => {
        this.dispatchEvent(audioLevelChangedEvent(level));
      });

      this.#processing = true;

      if (this.#connection !== "OPEN") {
        this.#connection = "CONNECTING";
      }

      this.#dispatchRecordingStateChanged("recording");

      const isNewConnection = await this._socketController.connect(
        this._getConnectConfig(),
        {
          onClose: this.#handleWebSocketClose,
          onError: this.#handleWebSocketError,
          onMessage: this.#handleWebSocketMessage,
          onNetworkActivity: (direction, data) => {
            this.dispatchEvent(networkActivityEvent(direction, data));
          },
        },
      );

      if (isNewConnection === "superseded") {
        return;
      }

      this.#connection = "OPEN";

      this.#dispatchRecordingStateChanged(this._recordingState);
    } catch (error) {
      this.dispatchEvent(errorEvent(error));
      await this.#handleStop();
    }
  }

  async #handleStop(): Promise<void> {
    this.#dispatchRecordingStateChanged("stopping");

    try {
      this.#mediaController.stopAudioLevelMonitoring();
      await this.#mediaController.stopRecording();
      await this._socketController.stopRecording();
    } catch (error) {
      this.dispatchEvent(errorEvent(error));
    }

    try {
      await this.#mediaController.cleanup();
    } catch (error) {
      this.dispatchEvent(errorEvent(error));
    }

    this.#dispatchRecordingStateChanged("stopped");
  }

  public startRecording(): void {
    if (this._recordingState !== "stopped") {
      return;
    }

    this.#handleStart();
  }

  public stopRecording(): void {
    if (
      this._recordingState === "stopped" ||
      this._recordingState === "stopping"
    ) {
      return;
    }

    if (this._recordingState === "initializing") {
      this.#closeConnectionOnInit = true;
      return;
    }

    this.#handleStop();
  }

  public toggleRecording(): void {
    if (this._recordingState === "stopped") {
      this.startRecording();
    } else if (this._recordingState === "recording") {
      this.stopRecording();
    }
  }

  public async openConnection(): Promise<void> {
    if (this._recordingState !== "stopped" || this.#processing) {
      return;
    }

    if (this._socketController.isConnectionOpen()) {
      return;
    }

    try {
      this.#connection = "CONNECTING";
      this.#dispatchRecordingStateChanged(this._recordingState);

      await this._socketController.connect(this._getConnectConfig(), {
        onClose: this.#handleWebSocketClose,
        onError: this.#handleWebSocketError,
        onMessage: this.#handleWebSocketMessage,
        onNetworkActivity: (direction, data) => {
          this.dispatchEvent(networkActivityEvent(direction, data));
        },
      });

      this.#connection = "OPEN";
      this.#dispatchRecordingStateChanged(this._recordingState);
    } catch (error) {
      this.#connection = "CLOSED";
      this.dispatchEvent(errorEvent(error));
    }
  }

  public async closeConnection(): Promise<void> {
    if (this._recordingState !== "stopped" || this.#processing) {
      return;
    }

    if (this._socketController.isConnecting()) {
      await this._socketController.waitForConnection();
    }

    if (!this._socketController.isConnectionOpen()) {
      this.#connection = "CLOSED";
      this.#dispatchRecordingStateChanged("stopped");
      return;
    }

    try {
      this.#connection = "CLOSING";
      this.#dispatchRecordingStateChanged("stopped");
      await this._socketController.closeConnection(this.#handleWebSocketClose);
    } catch (error) {
      this.dispatchEvent(errorEvent(error));
    }
  }

  render() {
    const isLoading =
      this._recordingState === "initializing" ||
      this._recordingState === "stopping";
    const isRecording = this._recordingState === "recording";

    return html`
      <button
        @mousedown=${this.#handleMouseDown}
        @click=${this.#handleClick}
        ?disabled=${isLoading}
        class=${isRecording ? "red" : "accent"}
        aria-label=${isRecording ? "Stop recording" : "Start recording"}
        aria-pressed=${isRecording}
      >
        ${
          isLoading
            ? html`<icon-loading-spinner />`
            : isRecording
              ? html`<icon-recording />`
              : html`<icon-mic-on />`
        }
        ${this._renderAudioVisualiser(isRecording)}
      </button>
    `;
  }
}
