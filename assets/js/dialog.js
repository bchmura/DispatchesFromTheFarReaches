document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-dialog-target]");
  if (opener) {
    document.getElementById(opener.dataset.dialogTarget)?.showModal();
  }
  const closer = e.target.closest("[data-dialog-close]");
  if (closer) {
    closer.closest("dialog")?.close();
  }
});
