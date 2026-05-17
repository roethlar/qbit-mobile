// Shared Tab-key handler for modal dialogs (BottomSheet, TorrentDetail).
// Cycles focus within `container` so screen-reader / keyboard users can't tab
// into the background page while a modal is open.

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function trapTabKey(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
  if (nodes.length === 0) {
    // No focusable descendants — keep focus on the container itself so it
    // doesn't escape to the page behind.
    e.preventDefault();
    container.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    e.preventDefault();
    first.focus();
  }
}
