import type { CortiAuth } from "@corti/sdk";
import { css, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

const dummyInteractionId = "9254ec9b-70e6-45d1-bacb-63d6cce19e86";

export type LiveStoryValues = {
  accessToken?: string;
  authConfig?: CortiAuth.AuthTokenDerivable;
  interactionId?: string;
};

class LiveSetupError extends Error {
  constructor(
    message: string,
    readonly creationUncertain = false,
  ) {
    super(message);
  }
}

async function post(action: "token" | "interaction", manualToken?: string) {
  const message =
    action === "token"
      ? "Unable to fetch a Corti token. Check credentials and API availability."
      : "Unable to create a Corti interaction. Check permissions and API availability.";
  let response: Response;
  try {
    response = await fetch(`/__storybook/corti/${action}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "X-Storybook-Live": "1",
        ...(manualToken ? { Authorization: `Bearer ${manualToken}` } : {}),
      },
      method: "POST",
    });
  } catch {
    throw new LiveSetupError(message, action === "interaction");
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new LiveSetupError(message, action === "interaction");
  }
  if (!result || typeof result !== "object") {
    throw new LiveSetupError(message, action === "interaction");
  }
  if (!response.ok) {
    throw new LiveSetupError(
      message,
      action === "interaction" &&
        (!("creationUncertain" in result) ||
          result.creationUncertain !== false),
    );
  }
  return result;
}

export class StorybookLiveSession extends LitElement {
  static styles = css`
    :host { display: block; }
  `;

  @property()
  declare mode: "dictation" | "ambient";

  @property()
  declare accessToken?: string;

  @property()
  declare interactionId?: string;

  @property({ attribute: false })
  declare renderStory?: (values: LiveStoryValues) => unknown;

  #authConfig?: CortiAuth.AuthTokenDerivable;
  #generatedInteractionId?: string;
  #error?: LiveSetupError;
  #pending = false;
  #generation = 0;

  constructor() {
    super();
    // Initialize through Lit's accessors rather than shadowing them with native class fields.
    this.mode = "dictation";
  }

  get #manualToken() {
    const token = this.accessToken?.trim();
    return token && token !== "dummy_token" ? token : undefined;
  }

  get #manualInteractionId() {
    const id = this.interactionId?.trim();
    return id && id !== dummyInteractionId ? id : undefined;
  }

  get #ready() {
    return Boolean(
      (this.#manualToken || this.#authConfig) &&
        (this.mode !== "ambient" ||
          this.#manualInteractionId ||
          this.#generatedInteractionId),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#generation++;
  }

  willUpdate() {
    if (!this.#ready && !this.#error && !this.#pending) void this.#setup();
  }

  async #token() {
    const result = await post("token");
    if (
      !("accessToken" in result) ||
      typeof result.accessToken !== "string" ||
      !result.accessToken
    ) {
      throw new LiveSetupError(
        "The local server returned an invalid token response.",
      );
    }
    if (
      !("expiresIn" in result) ||
      typeof result.expiresIn !== "number" ||
      !Number.isFinite(result.expiresIn) ||
      result.expiresIn <= 0
    ) {
      throw new LiveSetupError(
        "The local server returned an invalid token lifetime.",
      );
    }
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  async #refreshToken() {
    try {
      return await this.#token();
    } catch (error) {
      const failure = this.#setupError(error);
      if (this.isConnected) {
        this.#logError(failure);
      }
      throw failure;
    }
  }

  #setupError(error: unknown) {
    return error instanceof LiveSetupError
      ? error
      : new LiveSetupError("Live setup failed. Check the local server.");
  }

  #logError(error: LiveSetupError) {
    const recovery = error.creationUncertain
      ? "Creation may have succeeded. Reloading could create another interaction."
      : "Reload the story to retry.";
    console.error(`[Storybook live session] ${error.message} ${recovery}`);
  }

  async #setup() {
    if (this.#pending) return;
    const generation = this.#generation;
    this.#pending = true;
    this.#error = undefined;
    try {
      if (!this.#manualToken && !this.#authConfig) {
        const token = await this.#token();
        if (!this.isConnected || generation !== this.#generation) return;
        this.#authConfig = {
          ...token,
          refreshAccessToken: () => this.#refreshToken(),
        };
      }
      if (
        this.mode === "ambient" &&
        !this.#manualInteractionId &&
        !this.#generatedInteractionId
      ) {
        const result = await post("interaction", this.#manualToken);
        if (
          !("interactionId" in result) ||
          typeof result.interactionId !== "string" ||
          !result.interactionId
        ) {
          throw new LiveSetupError(
            "The local server returned an invalid interaction response.",
            true,
          );
        }
        if (!this.isConnected || generation !== this.#generation) return;
        this.#generatedInteractionId = result.interactionId;
      }
    } catch (error) {
      if (this.isConnected && generation === this.#generation) {
        this.#error = this.#setupError(error);
        this.#logError(this.#error);
      }
    } finally {
      this.#pending = false;
      if (this.isConnected) this.requestUpdate();
    }
  }

  render() {
    if (!this.#ready) return nothing;
    return (
      this.renderStory?.({
        accessToken: this.#manualToken,
        authConfig: this.#manualToken ? undefined : this.#authConfig,
        interactionId:
          this.#manualInteractionId ?? this.#generatedInteractionId,
      }) ?? nothing
    );
  }
}

customElements.define("storybook-live-session", StorybookLiveSession);

declare global {
  interface HTMLElementTagNameMap {
    "storybook-live-session": StorybookLiveSession;
  }
}
