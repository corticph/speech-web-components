import { RecordingButtonBase } from "@core/components/recording-button-base.js";
import { safeCustomElement } from "@core/utils/custom-elements.js";
import type { Corti } from "@corti/sdk";
import { consume } from "@lit/context";
import { state } from "lit/decorators.js";
import { DEFAULT_DICTATION_CONFIG } from "../constants.js";
import {
  debugDisplayAudioContext,
  dictationConfigContext,
} from "../contexts/dictation-context.js";
import {
  DictationController,
  type TranscribeMessage,
} from "../controllers/dictation-controller.js";

@safeCustomElement("dictation-recording-button")
export class DictationRecordingButton extends RecordingButtonBase<
  Corti.TranscribeConfig,
  TranscribeMessage
> {
  readonly editableKeybindingEvents = true;

  @consume({ context: debugDisplayAudioContext, subscribe: true })
  @state()
  override _debug_displayAudio?: boolean;

  @consume({ context: dictationConfigContext, subscribe: true })
  @state()
  protected _dictationConfig?: Corti.TranscribeConfig;

  protected _socketController = new DictationController(this);

  protected _getConnectConfig(): Corti.TranscribeConfig {
    return this._dictationConfig ?? DEFAULT_DICTATION_CONFIG;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dictation-recording-button": DictationRecordingButton;
  }
}
