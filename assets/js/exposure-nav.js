document.addEventListener("keydown", (e) => {
  const view = document.querySelector(".exposure-view");
  if (!view) return;
  if (e.target.closest("input, textarea, select, video, [contenteditable]")) return;

  if (e.key === "ArrowRight" && view.dataset.next) {
    window.location.href = view.dataset.next;
  } else if (e.key === "ArrowLeft" && view.dataset.prev) {
    window.location.href = view.dataset.prev;
  } else if (e.key === "Escape" && view.dataset.exit) {
    window.location.href = view.dataset.exit;
  }
});
