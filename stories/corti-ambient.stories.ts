import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../core/src/components/speech-audio-visualiser.js";
import type { CortiAmbient } from "../ambient/src/components/corti-ambient.js";

import DeviceSelectorStoryMeta from "./device-selector.stories.js";
import LanguageSelectorStoryMeta from "./language-selector.stories.js";
import SettingsMenuStoryMeta from "./settings-menu.stories.js";

import "../ambient/src/components/corti-ambient.js";
import {
  disableControls,
  eventAction,
  languages,
  mockDevices,
} from "./helpers.js";

type CortiAmbientStory = Omit<CortiAmbient, "selectedDevice"> & {
  selectedDevice?: string;
};

const meta = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    interactionId: "9254ec9b-70e6-45d1-bacb-63d6cce19e86",
    languagesSupported: languages,
    pushToTalkKeybinding: "Space",
    settingsEnabled: ["device", "language", "keybinding", "virtualMode"],
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
        "Whether the recording button inside corti-ambient can take focus on click",
    },
    devices: DeviceSelectorStoryMeta.argTypes.devices,
    interactionId: {
      control: "text",
      description:
        "Stream interaction id passed to Corti stream.connect for this session",
    },
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
  component: "corti-ambient",
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
    interactionId,
  }) => {
    const selectedDeviceValue = selectedDevice
      ? mockDevices.find((device) => device.deviceId === selectedDevice)
      : nothing;

    const interaction = interactionId?.trim() || undefined;

    return html`
      <corti-ambient
        .accessToken=${accessToken}
        .interactionId=${interaction}
        settingsEnabled=${settingsEnabled}
        languagesSupported=${languagesSupported}
        ?allowButtonFocus=${allowButtonFocus}
        .devices=${devices}
        .selectedDevice=${selectedDeviceValue}
        pushToTalkKeybinding=${pushToTalkKeybinding}
        toggleToTalkKeybinding=${toggleToTalkKeybinding}
        @command=${eventAction("command")}
        @delta-usage=${eventAction("delta-usage")}
        @error=${eventAction("error")}
        @facts=${eventAction("facts")}
        @keybinding-changed=${eventAction("keybinding-changed")}
        @languages-changed=${eventAction("languages-changed")}
        @network-activity=${eventAction("network-activity")}
        @ready=${eventAction("ready")}
        @recording-devices-changed=${eventAction("recording-devices-changed")}
        @virtual-mode-changed=${eventAction("virtual-mode-changed")}
        @recording-state-changed=${eventAction("recording-state-changed")}
        @stream-closed=${eventAction("stream-closed")}
        @transcript=${eventAction("transcript")}
        @usage=${eventAction("usage")}
        @audio-level-changed=${eventAction("audio-level-changed")}
        @media-stream-changed=${eventAction("media-stream-changed")}
      />
    `;
  },
  title: "CortiAmbient",
} satisfies Meta<CortiAmbientStory>;

export default meta;

export const Default = {} satisfies StoryObj<CortiAmbientStory>;

export const NoSettings = {
  args: {
    accessToken: "dummy_token",
    interactionId: "9254ec9b-70e6-45d1-bacb-63d6cce19e86",
    settingsEnabled: [],
  },
  argTypes: disableControls([
    "settingsEnabled",
    "devices",
    "languagesSupported",
  ]),
} satisfies StoryObj<CortiAmbientStory>;

export const AutoLoadLanguagesAndDevices = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    interactionId: "9254ec9b-70e6-45d1-bacb-63d6cce19e86",
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
    interactionId,
    allowButtonFocus,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
  }) => {
    const interaction = interactionId?.trim() || undefined;

    return html`
      <corti-ambient
        .accessToken=${accessToken}
        .interactionId=${interaction}
        ?allowButtonFocus=${allowButtonFocus}
        pushToTalkKeybinding=${pushToTalkKeybinding}
        toggleToTalkKeybinding=${toggleToTalkKeybinding}
        @command=${eventAction("command")}
        @delta-usage=${eventAction("delta-usage")}
        @error=${eventAction("error")}
        @facts=${eventAction("facts")}
        @keybinding-changed=${eventAction("keybinding-changed")}
        @languages-changed=${eventAction("languages-changed")}
        @network-activity=${eventAction("network-activity")}
        @ready=${eventAction("ready")}
        @recording-devices-changed=${eventAction("recording-devices-changed")}
        @recording-state-changed=${eventAction("recording-state-changed")}
        @stream-closed=${eventAction("stream-closed")}
        @transcript=${eventAction("transcript")}
        @usage=${eventAction("usage")}
        @audio-level-changed=${eventAction("audio-level-changed")}
        @media-stream-changed=${eventAction("media-stream-changed")}
        @virtual-mode-changed=${eventAction("virtual-mode-changed")}
      />
    `;
  },
} satisfies StoryObj<CortiAmbientStory>;
