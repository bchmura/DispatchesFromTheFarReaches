document.querySelectorAll(".callout-foldable > .callout-head").forEach((head) => {
  head.addEventListener("click", () => {
    const expanded = head.getAttribute("aria-expanded") === "true";
    head.setAttribute("aria-expanded", String(!expanded));
    head.nextElementSibling.hidden = expanded;
  });
});
