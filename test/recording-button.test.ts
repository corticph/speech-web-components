import { expect, fixture, html } from "@open-wc/testing";
import { resetMouse, sendKeys, sendMouse } from "@web/test-runner-commands";
import { stub } from "sinon";
import { RecordingButtonBase } from "../core/src/components/recording-button-base.js";
import type {
  SocketController,
  SocketControllerOutboundItem,
  SocketControllerWebSocket,
} from "../core/src/controllers/socket-controller.js";
import type { RecordingSocketInboundMessage } from "../core/src/socket-messages.js";

class TestRecordingButton extends RecordingButtonBase<unknown> {
  protected declare _socketController: SocketController<
    SocketControllerOutboundItem,
    RecordingSocketInboundMessage,
    unknown,
    SocketControllerWebSocket
  >;

  protected _getConnectConfig() {
    return undefined;
  }
}

customElements.define("test-recording-button", TestRecordingButton);

describe("RecordingButtonBase focus", () => {
  afterEach(async () => {
    await resetMouse();
  });

  async function setup() {
    const container = await fixture<HTMLDivElement>(html`
      <div>
        <div contenteditable="true">hello world</div>
        <test-recording-button></test-recording-button>
      </div>
    `);
    const editor = container.querySelector("div[contenteditable]");
    const host = container.querySelector("test-recording-button");
    if (
      !(editor instanceof HTMLElement) ||
      !(host instanceof TestRecordingButton)
    ) {
      throw new Error("Recording button fixture is incomplete.");
    }

    await host.updateComplete;
    const button = host.shadowRoot?.querySelector("button");
    if (!button || !editor.firstChild) {
      throw new Error("Recording button fixture did not render.");
    }

    editor.focus();
    const range = document.createRange();
    range.setStart(editor.firstChild, 5);
    range.collapse(true);
    const selection = document.getSelection();
    if (!selection) throw new Error("Selection is unavailable.");
    selection.removeAllRanges();
    selection.addRange(range);
    const toggle = stub(host, "toggleRecording");

    return { button, editor, host, selection, toggle };
  }

  async function click(button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    await sendMouse({
      position: [rect.left + rect.width / 2, rect.top + rect.height / 2],
      type: "click",
    });
  }

  it("preserves editor focus and the insertion point when clicked by default", async () => {
    const { button, editor, selection, toggle } = await setup();
    await click(button);

    expect(toggle.callCount).to.equal(1);
    expect(document.activeElement === editor).to.equal(true);
    expect(selection.anchorNode === editor.firstChild).to.equal(true);
    expect(selection.anchorOffset).to.equal(5);

    const range = selection.getRangeAt(0);
    range.insertNode(document.createTextNode(" dictated"));
    expect(editor.textContent).to.equal("hello dictated world");
  });

  it("allows mouse focus when explicitly enabled", async () => {
    const { button, editor, host, toggle } = await setup();
    host.allowButtonFocus = true;
    await host.updateComplete;
    await click(button);

    expect(toggle.callCount).to.equal(1);
    expect(document.activeElement === editor).to.equal(false);
    expect(host.shadowRoot?.activeElement === button).to.equal(true);
  });

  it("still activates from the keyboard when the button is focused", async () => {
    const { button, toggle } = await setup();
    button.focus();
    await sendKeys({ press: "Space" });
    await sendKeys({ press: "Enter" });
    expect(toggle.callCount).to.equal(2);
  });
});
