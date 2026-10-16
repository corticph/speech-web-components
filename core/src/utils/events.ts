import type { Corti } from "@corti/sdk";
import type { RecordingState } from "../types.js";

export type LanguagesChangedEventDetail = {
  languages: Corti.TranscribeSupportedLanguage[];
  selectedLanguage: string | undefined;
};

export type LanguageChangedEventDetail = {
  language: string;
};

export type RecordingDevicesChangedEventDetail = {
  devices: MediaDeviceInfo[];
  selectedDevice: MediaDeviceInfo | undefined;
};

export type RecordingStateChangedEventDetail = {
  state: RecordingState;
  connection?: "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | null;
  processing?: boolean;
};

export type AudioLevelChangedEventDetail = {
  audioLevel: number;
};

export type MediaStreamChangedEventDetail = {
  /** The stream being recorded, or `null` once it is released. */
  stream: MediaStream | null;
};

export type TranscriptEventDetail =
  | Corti.TranscribeTranscriptMessage
  | Corti.StreamTranscriptMessage;

export type CommandEventDetail = Corti.TranscribeCommandMessage;

export type UsageEventDetail =
  | Corti.TranscribeUsageMessage
  | Corti.StreamUsageMessage;

export type DeltaUsageEventDetail =
  | Corti.TranscribeDeltaUsageMessage
  | Corti.StreamDeltaUsageMessage;

export type FactsEventDetail = Corti.StreamFactsMessage;

export type AudioEventEventDetail =
  | Corti.TranscribeAudioEventMessage
  | Corti.StreamAudioEventMessage;

export type ErrorEventDetail = {
  message: string;
};

export function languagesChangedEvent(
  languages: Corti.TranscribeSupportedLanguage[],
  selectedLanguage: string | undefined,
): CustomEvent<LanguagesChangedEventDetail> {
  return new CustomEvent("languages-changed", {
    bubbles: true,
    composed: true,
    detail: { languages, selectedLanguage },
  });
}

/**
 * @deprecated Use languagesChangedEvent instead. This event is kept for backward compatibility.
 */
export function languageChangedEvent(
  language: string,
): CustomEvent<LanguageChangedEventDetail> {
  return new CustomEvent("language-changed", {
    bubbles: true,
    composed: true,
    detail: { language },
  });
}

export function recordingDevicesChangedEvent(
  devices: MediaDeviceInfo[],
  selectedDevice: MediaDeviceInfo | undefined,
): CustomEvent<RecordingDevicesChangedEventDetail> {
  return new CustomEvent("recording-devices-changed", {
    bubbles: true,
    composed: true,
    detail: { devices, selectedDevice },
  });
}

export function recordingStateChangedEvent(
  state: RecordingState,
  options: Partial<{
    connection: "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | null;
    processing: boolean;
  }> = {},
): CustomEvent<RecordingStateChangedEventDetail> {
  return new CustomEvent("recording-state-changed", {
    bubbles: true,
    composed: true,
    detail: {
      connection: options.connection,
      processing: options.processing,
      state,
    },
  });
}

export function transcriptEvent(
  detail: TranscriptEventDetail,
): CustomEvent<TranscriptEventDetail> {
  return new CustomEvent("transcript", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function commandEvent(
  detail: CommandEventDetail,
): CustomEvent<CommandEventDetail> {
  return new CustomEvent("command", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function usageEvent(
  detail: UsageEventDetail,
): CustomEvent<UsageEventDetail> {
  return new CustomEvent("usage", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function deltaUsageEvent(
  detail: DeltaUsageEventDetail,
): CustomEvent<DeltaUsageEventDetail> {
  return new CustomEvent("delta-usage", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function factsEvent(
  detail: FactsEventDetail,
): CustomEvent<FactsEventDetail> {
  return new CustomEvent("facts", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function audioEventEvent(
  detail: AudioEventEventDetail,
): CustomEvent<AudioEventEventDetail> {
  return new CustomEvent("audio-event", {
    bubbles: true,
    composed: true,
    detail,
  });
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export function errorEvent(error: unknown): CustomEvent<ErrorEventDetail> {
  const message = errorToMessage(error);

  return new CustomEvent("error", {
    bubbles: false,
    composed: true,
    detail: { message },
  });
}

/**
 * @deprecated Use recording-state-changed event with detail.connection field instead.
 */
export function streamClosedEvent(detail: unknown): CustomEvent {
  return new CustomEvent("stream-closed", {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function readyEvent(): CustomEvent {
  return new CustomEvent("ready", {
    bubbles: true,
    composed: true,
  });
}

export function audioLevelChangedEvent(
  audioLevel: number,
): CustomEvent<AudioLevelChangedEventDetail> {
  return new CustomEvent("audio-level-changed", {
    bubbles: true,
    composed: true,
    detail: { audioLevel },
  });
}

/**
 * Fires with the stream the component records, right before recording starts,
 * and with `null` when that stream is released. The stream is shared: read it
 * (for example with an `AnalyserNode`) but do not stop or change its tracks.
 */
export function mediaStreamChangedEvent(
  stream: MediaStream | null,
): CustomEvent<MediaStreamChangedEventDetail> {
  return new CustomEvent("media-stream-changed", {
    bubbles: true,
    composed: true,
    detail: { stream },
  });
}

export type NetworkActivityEventDetail = {
  direction: "sent" | "received";
  data: unknown;
};

export function networkActivityEvent(
  direction: "sent" | "received",
  data: unknown,
): CustomEvent<NetworkActivityEventDetail> {
  return new CustomEvent("network-activity", {
    bubbles: true,
    composed: true,
    detail: { data, direction },
  });
}

export type KeybindingChangedEventDetail = {
  key: string | null | undefined;
  code: string | null | undefined;
  keybinding: string | null;
  type?: "push-to-talk" | "toggle-to-talk";
};

export type KeybindingActivatedEventDetail = {
  keyboardEvent: KeyboardEvent;
};

export function keybindingChangedEvent(
  key: string | null | undefined,
  code: string | null | undefined,
  keybinding: string | null,
  type?: "push-to-talk" | "toggle-to-talk",
): CustomEvent<KeybindingChangedEventDetail> {
  return new CustomEvent("keybinding-changed", {
    bubbles: true,
    composed: true,
    detail: { code, key, keybinding, type },
  });
}

export function keybindingActivatedEvent(
  keyboardEvent: KeyboardEvent,
): CustomEvent<KeybindingActivatedEventDetail> {
  return new CustomEvent("keybinding-activated", {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail: { keyboardEvent },
  });
}

export type VirtualModeChangedEventDetail = {
  enabled: boolean;
};

export function virtualModeChangedEvent(
  enabled: boolean,
): CustomEvent<VirtualModeChangedEventDetail> {
  return new CustomEvent("virtual-mode-changed", {
    bubbles: true,
    composed: true,
    detail: { enabled },
  });
}
