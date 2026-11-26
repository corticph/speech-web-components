import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { action } from "storybook/actions";
import type { DictationKeybindingSelector } from "../dictation/src/components/dictation-keybinding-selector.js";

import "../dictation/src/components/dictation-keybinding-selector.js";
import "../dictation/src/contexts/dictation-context.js";
import type { DictationRoot } from "../dictation/src/contexts/dictation-context.js";
import { disableControls } from "./helpers.js";

export type KeybindingSelectorStory = DictationKeybindingSelector &
  Pick<DictationRoot, "toggleToTalkKeybinding">;

const meta = {
  args: {
    disabled: false,
    toggleToTalkKeybinding: "`",
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Whether the keybinding selector is disabled",
    },
    toggleToTalkKeybinding: {
      control: "text",
      description:
        "Toggle-to-talk keyboard shortcut. Single key only (e.g., 'k', '`', 'KeyK', 'Backquote').",
    },
  },
  component: "dictation-keybinding-selector",
  render: ({ toggleToTalkKeybinding, disabled }) => {
    return html`
      <dictation-root
        ?noWrapper=${true}
        .toggleToTalkKeybinding=${toggleToTalkKeybinding}
        @keybinding-changed=${action("keybinding-changed")}
        @error=${action("error")}
      >
        <dictation-keybinding-selector ?disabled=${disabled} />
      </dictation-root>
    `;
  },
  title: "KeybindingSelector",
} satisfies Meta<KeybindingSelectorStory>;

export default meta;

export const Default = {} as StoryObj<KeybindingSelectorStory>;

export const Disabled = {
  args: {
    disabled: true,
  },
  argTypes: disableControls(["disabled"]),
} as StoryObj<KeybindingSelectorStory>;

export const WithKeyName = {
  args: {
    toggleToTalkKeybinding: "k",
  },
  argTypes: disableControls(["toggleToTalkKeybinding"]),
} as StoryObj<KeybindingSelectorStory>;

export const WithKeyCode = {
  args: {
    toggleToTalkKeybinding: "KeyK",
  },
  argTypes: disableControls(["toggleToTalkKeybinding"]),
} as StoryObj<KeybindingSelectorStory>;

export const WithMetaKey = {
  args: {
    toggleToTalkKeybinding: "meta",
  },
  argTypes: disableControls(["toggleToTalkKeybinding"]),
} as StoryObj<KeybindingSelectorStory>;

export const WithSpace = {
  args: {
    toggleToTalkKeybinding: "Space",
  },
  argTypes: disableControls(["toggleToTalkKeybinding"]),
} as StoryObj<KeybindingSelectorStory>;
