import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLivePlugin, readLiveSettings } from "./live-server.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default {
  stories: ['../stories/**/*.stories.ts'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-links',
    '@storybook/addon-a11y'
  ],
  framework:  '@storybook/web-components-vite',

  viteFinal: async (config, { configType }) => {
    const settings = configType === "DEVELOPMENT" ? readLiveSettings(root) : undefined;
    config.define = {
      ...config.define,
      __STORYBOOK_LIVE__: JSON.stringify(Boolean(settings)),
    };
    if (settings) {
      config.server = { ...config.server, host: "127.0.0.1" };
      config.plugins = [...(config.plugins ?? []), createLivePlugin(settings)];
    }
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@core": resolve(root, "core/src"),
    };
    return config;
  },

  wdsFinal: async (config) => {
    return {
      ...config,
      nodeResolve: {
        ...config.nodeResolve,
        exportConditions: ['browser', 'development'],
        browser: true,
        mainFields: ['browser', 'module', 'main'],
        preferBuiltins: false,
      },
      plugins: [
        ...(config.plugins || []),
        {
          name: 'resolve-ws',
          resolveImport({ source }) {
            if (source === 'ws') {
              return 'data:text/javascript,export const WebSocket = globalThis.WebSocket;';
            }
          },
        },
      ],
    };
  },
};
