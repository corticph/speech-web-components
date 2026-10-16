import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../core/src/components/speech-audio-visualiser.js";
import type { CortiDictation } from "../dictation/src/components/corti-dictation.js";

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
        "Whether the recording button inside the corti-dictation component can take focus on click",
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
    docs: {
      codePanel: true,
    },
  },
  render: ({
    accessToken,
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
        @media-stream-changed=${eventAction("media-stream-changed")}
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
    settingsEnabled,
    allowButtonFocus,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
  }) => html`
    <corti-dictation
      .accessToken=${accessToken}
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
      @media-stream-changed=${eventAction("media-stream-changed")}
      @recording-state-changed=${eventAction("recording-state-changed")}
      @network-activity=${eventAction("network-activity")}
      @error=${eventAction("error")}
    />
  `,
};
