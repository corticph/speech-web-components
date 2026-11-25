import type { Corti, CortiAuth } from "@corti/sdk";
import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { createRef, type Ref } from "lit/directives/ref.js";
import type {
  ConfigurableSettings,
  ProxyOptions,
  RecordingState,
} from "../types.js";
import { commaSeparatedConverter } from "../utils/converters.js";

type CortiProviderRoot = LitElement & {
  recordingState?: RecordingState;
  languages?: Corti.TranscribeSupportedLanguage[];
  devices?: MediaDeviceInfo[];
  selectedDevice?: MediaDeviceInfo | undefined;
  pushToTalkKeybinding?: string | null | undefined;
  toggleToTalkKeybinding?: string | null | undefined;
};

type CortiRecordingButtonHost = LitElement & {
  startRecording(): void;
  stopRecording(): void;
  toggleRecording(): void;
  openConnection(): Promise<void>;
  closeConnection(): Promise<void>;
};

/**
 * Shared base for all-in-one Corti host elements (e.g. corti-dictation, corti-ambient).
 * Intentionally minimal; shared behavior will move here incrementally.
 */
export class CortiRoot<
  TRoot extends CortiProviderRoot = CortiProviderRoot,
  TRecordingButton extends CortiRecordingButtonHost = CortiRecordingButtonHost,
> extends LitElement {
  static styles = css`
    .hidden {
      display: none;
    }
  `;

  // ─────────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Latest access token
   */
  @property({ type: String })
  accessToken?: string;

  /**
   * Authentication configuration with optional refresh mechanism.
   */
  @property({ attribute: false, type: Object })
  authConfig?: CortiAuth.AuthTokenDerivable;

  /**
   * WebSocket URL for proxy connection. When provided, uses CortiWebSocketProxyClient instead of CortiClient.
   */
  @property({ type: String })
  socketUrl?: string;

  /**
   * Socket proxy configuration object. When provided, uses CortiWebSocketProxyClient instead of CortiClient.
   */
  @property({ attribute: false, type: Object })
  socketProxy?: ProxyOptions;

  /**
   * Extra keys on `x-corti-analytics`. `web_component` and
   * `web_component_version` are reserved by the component.
   */
  @property({ attribute: false, type: Object })
  analytics?: Record<string, string>;

  /**
   * Which settings should be available in the UI.
   *  If an empty array is passed, the settings will be disabled entirely.
   */
  @property({
    converter: commaSeparatedConverter,
    type: Array,
  })
  settingsEnabled: ConfigurableSettings[] = ["device", "language"];

  /**
   * When false (default), clicking the start/stop or settings button does not
   * move focus to the button, allowing textareas or other input elements to keep focus.
   * Set to true to allow these buttons to receive focus on click.
   * While settings are open, a mouse-down on a non-focusable outside area is
   * prevented to retain editor focus. This can prevent text selection or dragging.
   * Clicks on other focusable controls keep their normal focus behavior.
   */
  @property({ type: Boolean })
  allowButtonFocus: boolean = false;

  /**
   * List of all language codes available for use with the Web Component.
   *  Default list depends on the accessToken
   */
  @property({
    converter: commaSeparatedConverter,
    type: Array,
  })
  set languagesSupported(value:
    | Corti.TranscribeSupportedLanguage[]
    | undefined) {
    this._languagesSupported = value;
  }

  get languagesSupported(): Corti.TranscribeSupportedLanguage[] {
    return (
      this._contextProviderRef.value?.languages ||
      this._languagesSupported ||
      []
    );
  }

  @state()
  protected _languagesSupported?: Corti.TranscribeSupportedLanguage[];

  /**
   * List of available recording devices
   */
  @property({ attribute: false, type: Array })
  set devices(value: MediaDeviceInfo[] | undefined) {
    this._devices = value;
  }

  get devices(): MediaDeviceInfo[] {
    return this._contextProviderRef.value?.devices || this._devices || [];
  }

  @state()
  protected _devices?: MediaDeviceInfo[];

  /**
   * The selected device used for recording (MediaDeviceInfo).
   */
  @property({ attribute: false, type: Object })
  set selectedDevice(value: MediaDeviceInfo | undefined) {
    this._selectedDevice = value;
  }

  get selectedDevice(): MediaDeviceInfo | undefined {
    return (
      this._contextProviderRef.value?.selectedDevice || this._selectedDevice
    );
  }

  @state()
  protected _selectedDevice?: MediaDeviceInfo;

  /**
   * Push-to-talk keybinding for keyboard shortcut. Single key only (e.g., "Space", "k", "meta", "ctrl").
   * Combinations with "+" are not supported.
   * Keydown starts recording, keyup stops recording.
   * Defaults to "Space" if keybinding is in settingsEnabled, otherwise undefined
   */
  @property({ type: String })
  set pushToTalkKeybinding(value: string | null | undefined) {
    this._pushToTalkKeybinding = value;
  }

  get pushToTalkKeybinding(): string | null | undefined {
    return (
      this._contextProviderRef.value?.pushToTalkKeybinding ||
      this._pushToTalkKeybinding
    );
  }

  @state()
  protected _pushToTalkKeybinding?: string | null;

  /**
   * Toggle-to-talk keybinding for keyboard shortcut. Single key only (e.g., "`", "k", "meta", "ctrl").
   * Combinations with "+" are not supported.
   * Pressing the key toggles recording on/off.
   * Defaults to "Enter" if keybinding is in settingsEnabled, otherwise undefined
   */
  @property({ type: String })
  set toggleToTalkKeybinding(value: string | null | undefined) {
    this._toggleToTalkKeybinding = value;
  }

  get toggleToTalkKeybinding(): string | null | undefined {
    return (
      this._contextProviderRef.value?.toggleToTalkKeybinding ||
      this._toggleToTalkKeybinding
    );
  }

  @state()
  protected _toggleToTalkKeybinding?: string | null;

  protected _contextProviderRef: Ref<TRoot> = createRef();
  protected _recordingButtonRef: Ref<TRecordingButton> = createRef();

  // ─────────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Current state of recording (stopped, recording, initializing and stopping, ).
   */
  get recordingState(): RecordingState {
    return this._contextProviderRef.value?.recordingState ?? "stopped";
  }

  /**
   * Starts a recording.
   */
  public startRecording(): void {
    this._recordingButtonRef.value?.startRecording();
  }

  /**
   * Stops a recording.
   */
  public stopRecording(): void {
    this._recordingButtonRef.value?.stopRecording();
  }

  /**
   * Starts or stops recording. Convenience layer on top of the start/stop methods.
   */
  public toggleRecording(): void {
    this._recordingButtonRef.value?.toggleRecording();
  }

  /**
   * Opens the WebSocket connection without starting recording.
   * Use this to pre-establish the connection before recording starts.
   */
  public async openConnection(): Promise<void> {
    await this._recordingButtonRef.value?.openConnection();
  }

  /**
   * Closes the WebSocket connection by sending "end" and waiting for "ended".
   * Call this to receive "usage" statistics or when done with the connection.
   */
  public async closeConnection(): Promise<void> {
    await this._recordingButtonRef.value?.closeConnection();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  render() {
    return html``;
  }
}
