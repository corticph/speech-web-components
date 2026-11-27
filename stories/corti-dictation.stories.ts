import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";
import { AsyncDirective } from "lit/async-directive.js";
import { directive, type ElementPart } from "lit/directive.js";

import "../core/src/components/speech-audio-visualiser.js";
import type { CortiDictation } from "../dictation/src/components/corti-dictation.js";
import { DEFAULT_DICTATION_CONFIG } from "../dictation/src/constants.js";
import { DictationTextController } from "../dictation/src/controllers/dictation-text-controller.js";

import DeviceSelectorStoryMeta from "./device-selector.stories.js";
import LanguageSelectorStoryMeta from "./language-selector.stories.js";
import SettingsMenuStoryMeta from "./settings-menu.stories.js";

import "../dictation/src/components/corti-dictation.js";
import {
  disableControls,
  eventAction,
  languages,
  mockDevices,
} from "./helpers.js";

type CortiDictationStory = Omit<CortiDictation, "selectedDevice"> & {
  selectedDevice?: string;
};

class FocusHandlingBinding extends AsyncDirective {
  #element?: Element;
  #controller?: DictationTextController;

  render() {
    return nothing;
  }

  update(part: ElementPart) {
    this.#element = part.element;
    this.#connect();
    return nothing;
  }

  #connect() {
    queueMicrotask(() => {
      if (!this.isConnected || this.#controller) return;
      const dictation = this.#element?.querySelector("corti-dictation");
      const fields = this.#element?.querySelectorAll("textarea");
      if (!dictation || !fields?.length) return;
      this.#controller = new DictationTextController({
        dictation,
        fields: [...fields],
      });
      for (const name of ["error", "text-conflict", "no-target"]) {
        this.#controller.addEventListener(name, eventAction(name));
      }
    });
  }

  disconnected() {
    this.#controller?.disconnect();
    this.#controller = undefined;
  }

  reconnected() {
    this.#connect();
  }
}

const focusHandlingBinding = directive(FocusHandlingBinding);

const meta = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    languagesSupported: languages,
    pushToTalkKeybinding: "Space",
    settingsEnabled: ["device", "language"],
    toggleToTalkKeybinding: "`",
  },
  argTypes: {
    accessToken: {
      control: "text",
      description: "Access token for authentication (required to render)",
    },
    allowButtonFocus: {
      control: "boolean",
      description:
        "Whether the recording and settings buttons can take focus on click",
    },
    devices: DeviceSelectorStoryMeta.argTypes.devices,
    languagesSupported: LanguageSelectorStoryMeta.argTypes.languages,
    pushToTalkKeybinding: {
      control: "text",
      description:
        "Push-to-talk keyboard shortcut (keydown starts, keyup stops). Single key only (e.g., 'Space', 'k', 'KeyK')",
    },
    settingsEnabled: SettingsMenuStoryMeta.argTypes.settingsEnabled,
    toggleToTalkKeybinding: {
      control: "text",
      description:
        "Toggle-to-talk keyboard shortcut (press toggles). Single key only (e.g., '`', 'k', 'KeyK', 'Backquote')",
    },
  },
  component: "corti-dictation",
  parameters: {
    cortiLive: "dictation",
    docs: {
      codePanel: true,
    },
  },
  render: ({
    accessToken,
    authConfig,
    settingsEnabled,
    languagesSupported,
    allowButtonFocus,
    devices,
    selectedDevice,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
  }) => {
    const selectedDeviceValue = selectedDevice
      ? mockDevices.find((device) => device.deviceId === selectedDevice)
      : nothing;

    return html`
      <corti-dictation
        .accessToken=${accessToken}
        .authConfig=${authConfig}
        settingsEnabled=${settingsEnabled}
        languagesSupported=${languagesSupported}
        ?allowButtonFocus=${allowButtonFocus}
        .devices=${devices}
        .selectedDevice=${selectedDeviceValue}
        pushToTalkKeybinding=${pushToTalkKeybinding}
        toggleToTalkKeybinding=${toggleToTalkKeybinding}
        @keybinding-changed=${eventAction("keybinding-changed")}
        @languages-changed=${eventAction("languages-changed")}
        @recording-devices-changed=${eventAction("recording-devices-changed")}
        @stream-closed=${eventAction("stream-closed")}
        @usage=${eventAction("usage")}
        @delta-usage=${eventAction("delta-usage")}
        @transcript=${eventAction("transcript")}
        @command=${eventAction("command")}
        @ready=${eventAction("ready")}
        @audio-level-changed=${eventAction("audio-level-changed")}
        @recording-state-changed=${eventAction("recording-state-changed")}
        @network-activity=${eventAction("network-activity")}
        @error=${eventAction("error")}
      />
    `;
  },
  title: "CortiDictation",
} satisfies Meta<CortiDictationStory>;

export default meta;

export const Default = {
  args: {
    pushToTalkKeybinding: "`",
    settingsEnabled: ["device", "language", "keybinding"],
    toggleToTalkKeybinding: "Space",
  },
} as StoryObj<CortiDictationStory>;

export const OnlyLanguageSettings = {
  args: {
    accessToken: "dummy_token",
    languagesSupported: languages,
    settingsEnabled: ["language"],
  },
  argTypes: disableControls(["settingsEnabled", "devices"]),
};

export const OnlyDeviceSettings = {
  args: {
    accessToken: "dummy_token",
    settingsEnabled: ["device"],
  },
  argTypes: disableControls(["settingsEnabled", "languagesSupported"]),
};

export const NoSettings = {
  args: {
    accessToken: "dummy_token",
    settingsEnabled: [],
  },
  argTypes: disableControls([
    "settingsEnabled",
    "devices",
    "languagesSupported",
  ]),
};

export const WithCustomLanguages = {
  args: {
    accessToken: "dummy_token",
    languagesSupported: ["en", "es", "fr", "de"],
    settingsEnabled: ["language", "device"],
  },
  argTypes: disableControls(["languagesSupported", "settingsEnabled"]),
};

export const WithCustomDevices = {
  args: {
    accessToken: "dummy_token",
    devices: mockDevices,
    languagesSupported: languages,
    settingsEnabled: ["language", "device"],
  },
  argTypes: {
    selectedDevice: {
      control: "select",
      description: "The currently selected audio input device.",
      options: mockDevices.map((device) => device.deviceId),
    },
    ...disableControls(["devices", "settingsEnabled"]),
  },
};

export const WithKeybindings = {
  args: {
    accessToken: "dummy_token",
    languagesSupported: languages,
    pushToTalkKeybinding: "Space",
    settingsEnabled: ["device", "language", "keybinding"],
    toggleToTalkKeybinding: "k",
  },
  argTypes: disableControls(["settingsEnabled"]),
};

export const FocusHandling = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    dictationConfig: { ...DEFAULT_DICTATION_CONFIG, interimResults: true },
    languagesSupported: languages,
    settingsEnabled: ["device"],
  },
  argTypes: disableControls(["settingsEnabled"]),
  render: ({
    accessToken,
    authConfig,
    allowButtonFocus,
    settingsEnabled,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
    dictationConfig,
  }) => {
    return html`
      <div ${focusHandlingBinding()}>
        <p>
          Tap Space to type a space; hold it for 250 ms to dictate.
          Focus a field to choose the next dictation destination.
          Typing is read-only while dictation is processing.
          Dictated segments are spaced automatically, including when inserted
          inside existing words.
        </p>
        <textarea
          aria-label="Dictation text"
          placeholder="Dictate here, with or without focus"
          rows="8"
        ></textarea>
        <textarea
          aria-label="Second dictation field"
          placeholder="Or focus this field before dictating"
          rows="8"
        ></textarea>
        <corti-dictation
          .accessToken=${accessToken}
          .authConfig=${authConfig}
          ?allowButtonFocus=${allowButtonFocus}
          settingsEnabled=${settingsEnabled}
          .pushToTalkKeybinding=${pushToTalkKeybinding}
          .toggleToTalkKeybinding=${toggleToTalkKeybinding}
          .dictationConfig=${dictationConfig}
          @error=${eventAction("error")}
        />
      </div>
    `;
  },
} as StoryObj<CortiDictationStory>;

export const AutoLoadLanguagesAndDevices = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    pushToTalkKeybinding: "Space",
    settingsEnabled: ["device", "language"],
    toggleToTalkKeybinding: "`",
  },
  argTypes: disableControls([
    "devices",
    "languagesSupported",
    "selectedDevice",
    "settingsEnabled",
  ]),
  render: ({
    accessToken,
    authConfig,
    settingsEnabled,
    allowButtonFocus,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
  }: CortiDictationStory) => html`
    <corti-dictation
      .accessToken=${accessToken}
      .authConfig=${authConfig}
      settingsEnabled=${settingsEnabled}
      ?allowButtonFocus=${allowButtonFocus}
      pushToTalkKeybinding=${pushToTalkKeybinding}
      toggleToTalkKeybinding=${toggleToTalkKeybinding}
      @keybinding-changed=${eventAction("keybinding-changed")}
      @languages-changed=${eventAction("languages-changed")}
      @recording-devices-changed=${eventAction("recording-devices-changed")}
      @stream-closed=${eventAction("stream-closed")}
      @usage=${eventAction("usage")}
      @delta-usage=${eventAction("delta-usage")}
      @transcript=${eventAction("transcript")}
      @command=${eventAction("command")}
      @ready=${eventAction("ready")}
      @audio-level-changed=${eventAction("audio-level-changed")}
      @recording-state-changed=${eventAction("recording-state-changed")}
      @network-activity=${eventAction("network-activity")}
      @error=${eventAction("error")}
    />
  `,
};
