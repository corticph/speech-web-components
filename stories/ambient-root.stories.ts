import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { action } from "storybook/actions";
import type { AmbientRecordingButton } from "../ambient/src/components/ambient-recording-button.js";

import "../ambient/src/components/ambient-recording-button.js";
import "../core/src/components/speech-audio-visualiser.js";
import "../ambient/src/components/ambient-settings-menu.js";
import type { AmbientSettingsMenu } from "../ambient/src/components/ambient-settings-menu.js";
import type { AmbientRoot } from "../ambient/src/contexts/ambient-context.js";
import "../ambient/src/contexts/ambient-context.js";

type AmbientRootStory = AmbientSettingsMenu &
  Pick<
    AmbientRoot,
    | "accessToken"
    | "interactionId"
    | "recordingState"
    | "pushToTalkKeybinding"
    | "toggleToTalkKeybinding"
  > &
  Pick<AmbientRecordingButton, "allowButtonFocus"> & {
    noWrapper?: boolean;
  };

const meta = {
  args: {
    accessToken: "dummy_token",
    allowButtonFocus: false,
    interactionId: "9254ec9b-70e6-45d1-bacb-63d6cce19e86",
    noWrapper: false,
    pushToTalkKeybinding: "Space",
    recordingState: "stopped",
    settingsEnabled: ["device", "language", "keybinding", "virtualMode"],
    toggleToTalkKeybinding: "`",
  },
  argTypes: {
    accessToken: {
      control: "text",
      description:
        "JWT or bearer token for Corti API (decoded for region/tenant on the root)",
    },
    allowButtonFocus: {
      control: "boolean",
      description:
        "Whether the ambient recording button can receive focus when clicked",
    },
    interactionId: {
      control: "text",
      description:
        "Stream interaction id passed to Corti stream.connect for this session",
    },
    noWrapper: {
      control: "boolean",
      description:
        "When true, ambient-root renders only a slot (no padded wrapper div)",
    },
  },
  component: "ambient-root",
  parameters: {
    docs: {
      codePanel: true,
    },
  },
  render: ({
    accessToken,
    interactionId,
    settingsEnabled,
    recordingState,
    pushToTalkKeybinding,
    toggleToTalkKeybinding,
    allowButtonFocus,
    noWrapper,
  }) => {
    const token = accessToken?.trim() || undefined;
    const interaction = interactionId?.trim() || undefined;

    return html`
      <ambient-root
        .accessToken=${token}
        .interactionId=${interaction}
        .recordingState=${recordingState}
        pushToTalkKeybinding=${pushToTalkKeybinding}
        toggleToTalkKeybinding=${toggleToTalkKeybinding}
        ?noWrapper=${noWrapper}
        @command=${action("command")}
        @delta-usage=${action("delta-usage")}
        @error=${action("error")}
        @facts=${action("facts")}
        @keybinding-changed=${action("keybinding-changed")}
        @languages-changed=${action("languages-changed")}
        @network-activity=${action("network-activity")}
        @ready=${action("ready")}
        @recording-devices-changed=${action("recording-devices-changed")}
        @virtual-mode-changed=${action("virtual-mode-changed")}
        @recording-state-changed=${action("recording-state-changed")}
        @stream-closed=${action("stream-closed")}
        @transcript=${action("transcript")}
        @usage=${action("usage")}
      >
        <ambient-recording-button
          ?allowButtonFocus=${allowButtonFocus}
          @audio-level-changed=${action("audio-level-changed")}
          @media-stream-changed=${action("media-stream-changed")}
          @error=${action("error")}
        ></ambient-recording-button>
        <dictation-settings-menu
          .settingsEnabled=${settingsEnabled}
          @error=${action("error")}
          @keybinding-changed=${action("keybinding-changed")}
          @languages-changed=${action("languages-changed")}
          @recording-devices-changed=${action("recording-devices-changed")}
          @virtual-mode-changed=${action("virtual-mode-changed")}
          @ready=${action("ready")}
        ></dictation-settings-menu>
      </ambient-root>
    `;
  },
  title: "AmbientRoot",
} satisfies Meta<AmbientRootStory>;

export default meta;

export const Default = {} satisfies StoryObj<AmbientRootStory>;
