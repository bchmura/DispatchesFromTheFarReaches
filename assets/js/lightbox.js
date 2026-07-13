// Opens pipeline-managed media (a[data-lightbox]) in a native <dialog>
// instead of a new tab. Without JS — or in a browser without showModal —
// the anchors keep working as plain CloudFront links in a new tab.
(() => {
  const dialog = document.getElementById("lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const content = dialog.querySelector(".lightbox-content");

  document.addEventListener("click", (e) => {
    // Modified clicks (new-tab intent) keep their native behavior.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("a[data-lightbox]");
    if (!link) return;
    e.preventDefault();
    content.replaceChildren();
    if (link.dataset.lightbox === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.src = link.href;
      content.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = link.href;
      img.alt = link.querySelector("img")?.alt || "";
      content.appendChild(img);
    }
    dialog.showModal();
  });

  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    // A click on the dialog element itself (not its children) is the backdrop.
    if (e.target === dialog) dialog.close();
  });
  // Esc closes via the native dialog cancel path; emptying the content on
  // every close is what actually stops video playback.
  dialog.addEventListener("close", () => content.replaceChildren());
})();
