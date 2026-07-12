const dialogOpeners = new WeakMap();

document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-dialog-target]");
  if (opener) {
    const dialog = document.getElementById(opener.dataset.dialogTarget);
    if (dialog) {
      dialogOpeners.set(dialog, opener);
      dialog.showModal();
    }
    return;
  }

  const closer = e.target.closest("[data-dialog-close]");
  if (closer) {
    closer.closest("dialog")?.close();
    return;
  }

  // Clicking the photo itself, or the backdrop (a click on the backdrop is
  // dispatched with the <dialog> element itself as the target, since the
  // backdrop sits outside the dialog's own box but is still part of its hit
  // area), closes it too — a lighter dismiss than requiring the × button.
  // Clicking the capture-spec text does not close it, so it stays readable.
  const openDialog = document.querySelector("dialog[open].plate-dialog");
  if (openDialog && (e.target === openDialog || e.target.matches(".dialog-media"))) {
    openDialog.close();
  }
});

// Restore focus to whatever opened the dialog (without letting the browser
// scroll the page there) whenever it closes — via the close button, the
// Escape key, a backdrop/photo click, or any other way a <dialog> can
// close. Without this, the default focus-restoration can land on <body>
// and the browser scrolls to the top of the page.
document.addEventListener(
  "close",
  (e) => {
    if (e.target.tagName !== "DIALOG") return;
    dialogOpeners.get(e.target)?.focus({ preventScroll: true });
  },
  true
);
