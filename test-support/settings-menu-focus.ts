import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { resetMouse, sendKeys, sendMouse } from "@web/test-runner-commands";
import { nothing } from "lit";
import { SettingsMenuBase } from "../core/src/components/settings-menu-base.js";

class TestSettingsMenu extends SettingsMenuBase {
  protected _renderDeviceSelector() {
    return html`<input aria-label="Device">`;
  }

  protected _renderLanguageSelector(): typeof nothing {
    return nothing;
  }

  protected _renderKeybindingSelector(): typeof nothing {
    return nothing;
  }
}

customElements.define("test-settings-menu", TestSettingsMenu);

describe("SettingsMenuBase focus", () => {
  afterEach(async () => {
    await resetMouse();
  });

  async function setup() {
    const container = await fixture<HTMLDivElement>(html`
      <div>
        <div contenteditable="true">hello world</div>
        <test-settings-menu></test-settings-menu>
        <textarea data-textarea>hello world</textarea>
        <input data-other id="other-field" style="position: fixed; right: 8px; bottom: 60px">
        <button data-other-button style="position: fixed; right: 8px; top: 8px">Other action</button>
        <label data-other-label for="other-field" style="position: fixed; right: 8px; top: 60px">Other field</label>
        <div data-outside style="position: fixed; right: 8px; bottom: 8px; width: 40px; height: 40px"></div>
      </div>
    `);
    const editor = container.querySelector("div[contenteditable]");
    const menu = container.querySelector("test-settings-menu");
    const textarea =
      container.querySelector<HTMLTextAreaElement>("[data-textarea]");
    const other = container.querySelector<HTMLInputElement>("[data-other]");
    const otherButton = container.querySelector<HTMLButtonElement>(
      "[data-other-button]",
    );
    const otherLabel =
      container.querySelector<HTMLLabelElement>("[data-other-label]");
    const outside = container.querySelector<HTMLElement>("[data-outside]");
    if (
      !(editor instanceof HTMLElement) ||
      !(menu instanceof TestSettingsMenu) ||
      !textarea ||
      !other ||
      !otherButton ||
      !otherLabel ||
      !outside
    ) {
      throw new Error("Settings menu fixture is incomplete.");
    }

    await menu.updateComplete;
    const button = menu.shadowRoot?.querySelector<HTMLButtonElement>(
      "#settings-popover-button",
    );
    const popover =
      menu.shadowRoot?.querySelector<HTMLElement>("#settings-popover");
    if (!button || !popover || !editor.firstChild) {
      throw new Error("Settings menu fixture did not render.");
    }

    editor.focus();
    const range = document.createRange();
    range.setStart(editor.firstChild, 5);
    range.collapse(true);
    const selection = document.getSelection();
    if (!selection) throw new Error("Selection is unavailable.");
    selection.removeAllRanges();
    selection.addRange(range);

    return {
      button,
      editor,
      menu,
      other,
      otherButton,
      otherLabel,
      outside,
      popover,
      selection,
      textarea,
    };
  }

  async function click(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    await sendMouse({
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
      type: "click",
    });
  }

  it("opens and closes with Escape without moving editor focus or the caret", async () => {
    const { button, editor, popover, selection } = await setup();
    await click(button);

    expect(popover.matches(":popover-open")).to.equal(true);
    expect(document.activeElement === editor).to.equal(true);
    expect(selection.anchorNode === editor.firstChild).to.equal(true);
    expect(selection.anchorOffset).to.equal(5);

    await sendKeys({ press: "Escape" });
    expect(popover.matches(":popover-open")).to.equal(false);
    expect(document.activeElement === editor).to.equal(true);
    expect(selection.anchorOffset).to.equal(5);
  });

  it("dismisses the popover when the editor is clicked", async () => {
    const { button, editor, popover } = await setup();
    await click(button);
    expect(popover.matches(":popover-open")).to.equal(true);
    await click(editor);
    expect(popover.matches(":popover-open")).to.equal(false);
    expect(document.activeElement === editor).to.equal(true);
  });

  it("keeps editor focus and selection during a neutral outside click", async () => {
    const { button, editor, outside, popover, selection } = await setup();
    let clicked = false;
    let preventedMouseDown = false;
    let blurred = false;
    editor.addEventListener("blur", () => {
      blurred = true;
    });
    outside.addEventListener("mousedown", (event) => {
      preventedMouseDown = event.defaultPrevented;
    });
    outside.addEventListener("click", (event) => {
      clicked = !event.defaultPrevented;
    });
    await click(button);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    await waitUntil(() => document.activeElement === editor);
    expect(clicked).to.equal(true);
    expect(preventedMouseDown).to.equal(true);
    expect(blurred).to.equal(false);
    expect(selection.anchorNode === editor.firstChild).to.equal(true);
    expect(selection.anchorOffset).to.equal(5);
  });

  it("keeps textarea focus and its selection during a neutral outside click", async () => {
    const { button, outside, popover, textarea } = await setup();
    let blurred = false;
    textarea.addEventListener("blur", () => {
      blurred = true;
    });
    textarea.focus();
    textarea.setSelectionRange(2, 5);
    await click(button);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    await waitUntil(() => document.activeElement === textarea);
    expect(blurred).to.equal(false);
    expect([textarea.selectionStart, textarea.selectionEnd]).to.deep.equal([
      2, 5,
    ]);
  });

  it("keeps focus on a textarea in an open shadow root", async () => {
    const { button, editor, outside, popover } = await setup();
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const field = document.createElement("textarea");
    field.value = "hello world";
    shadow.append(field);
    editor.after(host);
    field.focus();
    field.setSelectionRange(2, 5);
    await click(button);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    await waitUntil(() => shadow.activeElement === field);
    expect([field.selectionStart, field.selectionEnd]).to.deep.equal([2, 5]);
  });

  it("keeps the caret in a contenteditable inside an open shadow root", async () => {
    const { button, editor, outside, popover } = await setup();
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const field = document.createElement("div");
    field.contentEditable = "true";
    field.textContent = "hello world";
    shadow.append(field);
    editor.after(host);
    field.focus();
    const selection = document.getSelection();
    if (!selection || !field.firstChild)
      throw new Error("Selection is unavailable.");
    const range = document.createRange();
    range.setStart(field.firstChild, 5);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    await click(button);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    await waitUntil(() => shadow.activeElement === field);
    expect(selection.anchorNode === field.firstChild).to.equal(true);
    expect(selection.anchorOffset).to.equal(5);
  });

  it("respects focusable outside targets", async () => {
    const { button, editor, other, otherButton, otherLabel, popover } =
      await setup();
    await click(button);
    await click(other);
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === other).to.equal(true);
    editor.focus();
    await click(button);
    await click(otherButton);
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === otherButton).to.equal(true);
    editor.focus();
    await click(button);
    await click(otherLabel);
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === other).to.equal(true);
  });

  it("does not override focus set by an outside click handler", async () => {
    const { button, other, outside, popover } = await setup();
    outside.addEventListener("click", () => other.focus());
    await click(button);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === other).to.equal(true);
  });

  it("does not restore the editor after interacting with settings", async () => {
    const { button, editor, menu, outside, popover } = await setup();
    await click(button);
    const input = menu.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Settings input did not render.");
    await click(input);
    expect(menu.shadowRoot?.activeElement === input).to.equal(true);
    await click(outside);
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === editor).to.equal(false);
  });

  it("keeps focus during an outside drag while the popover remains open", async () => {
    const { button, editor, outside, popover } = await setup();
    await click(button);
    const outsideRect = outside.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    await sendMouse({
      position: [
        Math.round(outsideRect.left + 5),
        Math.round(outsideRect.top + 5),
      ],
      type: "move",
    });
    await sendMouse({ type: "down" });
    await sendMouse({
      position: [
        Math.round(popoverRect.left + 5),
        Math.round(popoverRect.top + 5),
      ],
      type: "move",
    });
    await sendMouse({ type: "up" });
    expect(popover.matches(":popover-open")).to.equal(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await sendKeys({ press: "Escape" });
    await waitUntil(() => !popover.matches(":popover-open"));
    expect(document.activeElement === editor).to.equal(true);
  });

  it("does not affect outside clicks after settings are removed", async () => {
    const { button, editor, menu, outside } = await setup();
    await click(button);
    menu.settingsEnabled = [];
    await menu.updateComplete;
    await click(outside);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement === editor).to.equal(false);
  });

  it("stops blocking outside mouse-downs when the popover closes", async () => {
    const { button, editor, outside, popover } = await setup();
    await click(button);
    await sendKeys({ press: "Escape" });
    await waitUntil(() => !popover.matches(":popover-open"));
    await click(outside);
    expect(document.activeElement === editor).to.equal(false);
  });

  it("stops blocking outside mouse-downs when the menu disconnects", async () => {
    const { button, editor, menu, outside } = await setup();
    await click(button);
    menu.remove();
    await click(outside);
    expect(document.activeElement === editor).to.equal(false);
  });

  it("respects enabling button focus while the popover is open", async () => {
    const { button, editor, menu, outside } = await setup();
    await click(button);
    menu.allowButtonFocus = true;
    await menu.updateComplete;
    await click(outside);
    expect(document.activeElement === editor).to.equal(false);
  });

  it("allows the trigger to receive focus when explicitly enabled", async () => {
    const { button, editor, menu, popover } = await setup();
    menu.allowButtonFocus = true;
    await menu.updateComplete;
    await click(button);

    expect(popover.matches(":popover-open")).to.equal(true);
    expect(document.activeElement === editor).to.equal(false);
    expect(menu.shadowRoot?.activeElement === button).to.equal(true);
  });

  it("supports keyboard activation when the trigger has focus", async () => {
    const { button, popover } = await setup();
    button.focus();
    await sendKeys({ press: "Enter" });
    expect(popover.matches(":popover-open")).to.equal(true);
    await sendKeys({ press: "Space" });
    expect(popover.matches(":popover-open")).to.equal(false);
  });
});
