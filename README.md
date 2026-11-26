# Corti Speech Web Components

Lit-based web components for Corti speech APIs. Published as two npm packages from this monorepo:

| Package | Use case | Primary element |
| --- | --- | --- |
| [@corti/dictation-web](https://www.npmjs.com/package/@corti/dictation-web) | Real-time single-speaker dictation (Transcribe) | `<corti-dictation>` |
| [@corti/ambient-web](https://www.npmjs.com/package/@corti/ambient-web) | Real-time multi-speaker ambient streaming (Streams) | `<corti-ambient>` |

Package readmes: [dictation/README.md](./dictation/README.md), [ambient/README.md](./ambient/README.md).

[![Dictation on npm](https://img.shields.io/npm/v/@corti/dictation-web.svg?logo=npm&label=dictation)](https://www.npmjs.com/package/@corti/dictation-web)
[![Ambient on npm](https://img.shields.io/npm/v/@corti/ambient-web.svg?logo=npm&label=ambient)](https://www.npmjs.com/package/@corti/ambient-web)
[![License: MIT](https://img.shields.io/npm/l/%40corti%2Fdictation-web)](https://opensource.org/licenses/MIT)
[![Get Support on Discord](https://img.shields.io/badge/Discord-Get%20Support-5865F2.svg?logo=discord&logoColor=fff)](https://discord.com/invite/zXeXHgnZXX)

## Overview

Both packages share the same architecture:

1. **Opinionated component** — drop-in UI (`<corti-dictation>` or `<corti-ambient>`)
2. **Modular components** — compose your own layout under `<dictation-root>` or `<ambient-root>`

> **Note:** OAuth 2.0 authentication is not handled by this library. The client must provide an authorization token or token refresh function while using the component. Ambient streaming also requires an `interactionId`.

## Documentation

Product documentation (install, API, auth, styling) lives on [docs.corti.ai](https://docs.corti.ai):

- [Dictation Web Component](https://docs.corti.ai/sdk/dictation/overview)
- [Ambient Web Component](https://docs.corti.ai/sdk/ambient/overview)

## Live testing in local Storybook

Credential-enabled Storybook is local-computer-only. Use `pnpm storybook`. To 
enable automatic authentication, copy [.env.local.example](./.env.local.example) 
to `.env.local` and fill in the Corti client ID, client secret, tenant name, and
environment (for example, `eu` or `us`). The .env file is read only by the local
server; restart Storybook after changing it.

In the **Canvas** view, CortiDictation, CortiAmbient, and AmbientRoot automatically
replace dummy/empty credentials. The server-side Corti SDK acquires and refreshes
tokens, and the browser SDK requests renewed tokens through local endpoints.
Fetched tokens stay out of Storybook Controls/args. A real token entered in the
`accessToken` control overrides automatic authentication.

Ambient stories also create one real interaction per mounted story, with synthetic
encounter metadata and no patient details. Re-rendering controls reuses it; opening
another story or reloading creates another. Stories have no additional status or
debug UI, including during setup and failures. A real `interactionId` entered manually
overrides the example/generated ID. Interactions are **retained** for inspecting 
results: clean them up outside Storybook. Real API usage may incur charges; use test
credentials and synthetic audio, not patient data.


