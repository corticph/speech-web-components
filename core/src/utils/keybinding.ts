/**
 * Checks if the current platform is macOS.
 * Uses userAgent string for reliable cross-browser detection.
 *
 * @returns true if running on macOS
 */
function isMac(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  // Check user agent for Mac patterns (most reliable method)
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Capitalizes the first letter of a string.
 *
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
function capitalize(str: string): string {
  if (str.length === 0) {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Normalizes a key string to the keybinding format.
 * Handles platform-specific mappings and capitalization.
 *
 * @param key - Key string to normalize (will be trimmed and uppercased)
 * @returns Formatted key string for keybinding
 *
 * @example
 * normalizeKeyForKeybinding("Control") // "Ctrl"
 * normalizeKeyForKeybinding("META") // "Cmd" on Mac, "Meta" elsewhere
 * normalizeKeyForKeybinding(" alt ") // "Opt" on Mac, "Alt" elsewhere
 * normalizeKeyForKeybinding("shift") // "Shift"
 * normalizeKeyForKeybinding("k") // "K"
 * normalizeKeyForKeybinding(" ") // "Space"
 */
function normalizeKeyForKeybinding(key: string): string {
  if (key === " ") {
    return "Space";
  }

  const normalized = key.trim().toLowerCase();

  if (normalized === "control") {
    return "Ctrl";
  }
  if (normalized === "meta" || normalized === "cmd") {
    return isMac() ? "Cmd" : "Meta";
  }
  if (normalized === "alt" || normalized === "opt") {
    return isMac() ? "Opt" : "Alt";
  }
  if (normalized === "space") {
    return "Space";
  }

  // TODO: Uncomment this for v1 to avoid breaking changes now
  // Capitalize single letters (a-z) for consistent display
  // if (/^[a-z]$/.test(normalized)) {
  //   return normalized.toUpperCase();
  // }

  return normalized.length > 1 ? capitalize(normalized) : normalized;
}

/**
 * Normalizes a keybinding string.
 *
 * @param keybinding - Keybinding string to normalize
 * @returns Normalized keybinding string or null if empty
 *
 * @example
 * normalizeKeybinding("k") // "K"
 * normalizeKeybinding("meta") // "Cmd" on Mac
 * normalizeKeybinding(" ") // "Space"
 * normalizeKeybinding(" space ") // "Space"
 */
export function normalizeKeybinding(
  keybinding: string | null | undefined,
): string | null {
  if (!keybinding) {
    return null;
  }
  if (keybinding !== " " && keybinding.trim() === "") {
    return null;
  }

  return normalizeKeyForKeybinding(keybinding);
}

/**
 * Checks if a pressed key matches the keybinding.
 * Checks both event.key and event.code for better reliability.
 *
 * @param event - KeyboardEvent to check
 * @param keybinding - Keybinding string to match against
 * @returns true if either the key or code matches the keybinding
 *
 * @example
 * matchesKeybinding(event, "k") // true if event.key is "k" or event.code is "KeyK"
 * matchesKeybinding(event, "`") // true if event.key is "`" or event.code is "Backquote"
 */
export function matchesKeybinding(
  event: KeyboardEvent,
  keybinding: string | null | undefined,
): boolean {
  const normalizedKeybinding = normalizeKeybinding(keybinding);

  if (!normalizedKeybinding) {
    return false;
  }

  const normalizedKey = normalizeKeyForKeybinding(event.key);
  const normalizedCode = normalizeKeyForKeybinding(event.code);

  return (
    normalizedKey === normalizedKeybinding ||
    normalizedCode === normalizedKeybinding
  );
}

/**
 * Checks if keybindings should be ignored for the current active element.
 * Returns true if the user is typing in an input field.
 *
 * @param element - Element to check
 * @returns true if keybindings should be ignored for this element
 *
 * @example
 * shouldIgnoreKeybinding(document.activeElement) // true if input/textarea/contenteditable
 */
export function shouldIgnoreKeybinding(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  if (tagName === "input" || tagName === "textarea") {
    return true;
  }

  if (element instanceof HTMLElement && element.contentEditable === "true") {
    return true;
  }

  return false;
}

export function keybindingEditableTarget(event: KeyboardEvent): Element | null {
  for (const target of event.composedPath()) {
    if (target instanceof Element && shouldIgnoreKeybinding(target)) {
      return target;
    }
  }

  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active && shouldIgnoreKeybinding(active) ? active : null;
}
