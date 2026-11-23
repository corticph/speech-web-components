import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { restore, stub } from "sinon";
import type {
  LiveStoryValues,
  StorybookLiveSession,
} from "../.storybook/live-session.js";
import "../.storybook/live-session.js";

describe("Storybook live Canvas sessions", () => {
  afterEach(() => restore());

  function tokenResponse() {
    return Response.json({ accessToken: "live-token", expiresIn: 300 });
  }

  async function session(
    mode: "ambient" | "dictation" = "ambient",
    values: LiveStoryValues = {},
  ) {
    return fixture<StorybookLiveSession>(html`
      <storybook-live-session
        .mode=${mode}
        .accessToken=${values.accessToken ?? "dummy_token"}
        .interactionId=${values.interactionId ?? "9254ec9b-70e6-45d1-bacb-63d6cce19e86"}
        .renderStory=${(resolved: LiveStoryValues) => html`
          <div class="story" .values=${resolved}>Story</div>
        `}
      ></storybook-live-session>
    `);
  }

  function resolved(element: StorybookLiveSession) {
    const story = element.shadowRoot?.querySelector<
      HTMLDivElement & { values: LiveStoryValues }
    >(".story");
    if (!story) throw new Error("Story has not rendered");
    return story.values;
  }

  async function ready(element: StorybookLiveSession) {
    await waitUntil(() => Boolean(element.shadowRoot?.querySelector(".story")));
  }

  it("keeps ready stories visually unchanged and reuses the interaction across control rerenders", async () => {
    const fetch = stub(window, "fetch");
    fetch.onFirstCall().resolves(tokenResponse());
    fetch
      .onSecondCall()
      .resolves(Response.json({ interactionId: "generated-id" }));
    const element = await session();
    await ready(element);
    const values = resolved(element);
    expect(values.accessToken).to.equal(undefined);
    expect(values.authConfig?.accessToken).to.equal("live-token");
    expect(values.authConfig?.expiresIn).to.equal(300);
    expect(values.interactionId).to.equal("generated-id");
    expect(element.accessToken).to.equal("dummy_token");
    expect(element.interactionId).to.equal(
      "9254ec9b-70e6-45d1-bacb-63d6cce19e86",
    );
    expect(element.shadowRoot?.textContent).not.to.contain("generated-id");
    expect(element.shadowRoot?.textContent).not.to.contain("live-token");
    expect(element.shadowRoot?.querySelector(".status")).to.equal(null);
    const story = element.shadowRoot?.querySelector<HTMLElement>(".story");
    if (!story) throw new Error("Story has not rendered");
    expect(story.getBoundingClientRect().top).to.equal(
      element.getBoundingClientRect().top,
    );
    element.renderStory = (next) =>
      html`<div class="story" .values=${next}>Updated controls</div>`;
    await element.updateComplete;
    expect(resolved(element).interactionId).to.equal("generated-id");
    expect(element.shadowRoot?.querySelector(".status")).to.equal(null);
    expect(fetch.callCount).to.equal(2);
    element.remove();
    fetch.onCall(2).resolves(tokenResponse());
    fetch
      .onCall(3)
      .resolves(Response.json({ interactionId: "new-mounted-id" }));
    const reopened = await session();
    await ready(reopened);
    expect(resolved(reopened).interactionId).to.equal("new-mounted-id");
  });

  it("preserves manual token and interaction overrides without contacting the server", async () => {
    const fetch = stub(window, "fetch");
    const element = await session("ambient", {
      accessToken: "manual-token",
      interactionId: "manual-id",
    });
    await ready(element);
    expect(resolved(element)).to.deep.equal({
      accessToken: "manual-token",
      authConfig: undefined,
      interactionId: "manual-id",
    });
    expect(fetch.callCount).to.equal(0);
    expect(element.shadowRoot?.querySelector(".status")).to.equal(null);
  });

  it("uses a manual token when creating an interaction and never creates one for dictation", async () => {
    const fetch = stub(window, "fetch").resolves(
      Response.json({ interactionId: "generated-id" }),
    );
    const element = await session("ambient", { accessToken: "manual-token" });
    await ready(element);
    expect(fetch.firstCall.args[0]).to.equal("/__storybook/corti/interaction");
    expect(
      new Headers(fetch.firstCall.args[1]?.headers).get("Authorization"),
    ).to.equal("Bearer manual-token");
    fetch.resolves(tokenResponse());
    const dictation = await session("dictation");
    await ready(dictation);
    expect(fetch.callCount).to.equal(2);
    expect(fetch.secondCall.args[0]).to.equal("/__storybook/corti/token");
  });

  it("provides renewed token lifetime without remounting the story", async () => {
    const fetch = stub(window, "fetch").resolves(tokenResponse());
    const element = await session("dictation");
    await ready(element);
    const refresh = resolved(element).authConfig?.refreshAccessToken;
    if (!refresh) throw new Error("Missing automatic token provider");
    fetch.resolves(
      Response.json({ accessToken: "renewed-token", expiresIn: 300 }),
    );
    const story = element.shadowRoot?.querySelector(".story");
    expect(await refresh()).to.deep.equal({
      accessToken: "renewed-token",
      expiresIn: 300,
    });
    expect(fetch.callCount).to.equal(2);
    expect(element.shadowRoot?.querySelector(".story")).to.equal(story);
  });

  it("renders no loading UI while setup is pending", async () => {
    let resolveToken: ((response: Response) => void) | undefined;
    const token = new Promise<Response>((resolve) => {
      resolveToken = resolve;
    });
    const fetch = stub(window, "fetch");
    fetch.onFirstCall().returns(token);
    fetch
      .onSecondCall()
      .resolves(Response.json({ interactionId: "generated-id" }));
    const element = await session();
    expect(element.shadowRoot?.textContent?.trim()).to.equal("");
    expect(element.shadowRoot?.querySelector(".story")).to.equal(null);
    if (!resolveToken) throw new Error("Missing token response resolver");
    resolveToken(tokenResponse());
    await ready(element);
  });

  it("reports ambiguous creation only in the console and retries only on remount", async () => {
    const log = stub(console, "error");
    const fetch = stub(window, "fetch");
    fetch.onFirstCall().resolves(tokenResponse());
    fetch.onSecondCall().rejects(new TypeError("sensitive network response"));
    const element = await session();
    await waitUntil(() => log.called);
    expect(element.shadowRoot?.querySelector(".story")).to.equal(null);
    expect(element.shadowRoot?.textContent?.trim()).to.equal("");
    expect(log.firstCall.args).to.have.length(1);
    expect(log.firstCall.args[0]).to.contain(
      "Reloading could create another interaction",
    );
    expect(log.firstCall.args[0]).not.to.contain("sensitive");
    expect(log.firstCall.args[0]).not.to.contain("live-token");
    expect(fetch.callCount).to.equal(2);
    element.requestUpdate();
    await element.updateComplete;
    expect(fetch.callCount).to.equal(2);
    expect(log.callCount).to.equal(1);
    element.remove();
    fetch.onCall(2).resolves(tokenResponse());
    fetch.onCall(3).resolves(Response.json({ interactionId: "retried-id" }));
    const reopened = await session();
    await ready(reopened);
    expect(resolved(reopened).interactionId).to.equal("retried-id");
    expect(fetch.callCount).to.equal(4);
  });

  it("logs sanitized refresh failures without adding UI or remounting the story", async () => {
    const log = stub(console, "error");
    const fetch = stub(window, "fetch").resolves(tokenResponse());
    const element = await session("dictation");
    await ready(element);
    const refresh = resolved(element).authConfig?.refreshAccessToken;
    if (!refresh) throw new Error("Missing automatic token provider");
    const story = element.shadowRoot?.querySelector(".story");
    fetch.rejects(new TypeError("sensitive token response"));
    let failure: unknown;
    try {
      await refresh();
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect(log.calledOnce).to.equal(true);
    expect(log.firstCall.args[0]).to.contain("Unable to fetch a Corti token");
    expect(log.firstCall.args[0]).to.contain("Reload the story to retry");
    expect(log.firstCall.args[0]).not.to.contain("sensitive");
    expect(element.shadowRoot?.querySelector(".story")).to.equal(story);
    expect(element.shadowRoot?.textContent?.trim()).to.equal("Story");
  });
});
