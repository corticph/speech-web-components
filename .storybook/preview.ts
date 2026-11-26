import type { Preview } from "@storybook/web-components-vite";
import { html } from "lit";
import { keyed } from "lit/directives/keyed.js";
import type { LiveStoryValues } from "./live-session.js";

declare const __STORYBOOK_LIVE__: boolean;

if (__STORYBOOK_LIVE__) {
  await import("./live-session.js");
}

const preview: Preview = {
  decorators: [
    (story, context) => {
      const mode = context.parameters.cortiLive;
      if (!__STORYBOOK_LIVE__ || context.viewMode !== "story" || !mode) {
        return story();
      }
      return html`${keyed(context.id, html`
        <storybook-live-session
          .mode=${mode}
          .accessToken=${context.args.accessToken}
          .interactionId=${context.args.interactionId}
          .renderStory=${(values: LiveStoryValues) => story({
            args: { ...context.args, ...values },
          })}
        ></storybook-live-session>
      `)}`;
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      codePanel: true,
      source: {
        excludeDecorators: true,
      },
    }
  }
}

export default preview;

