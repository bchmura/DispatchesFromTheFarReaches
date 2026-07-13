(function () {
  var chips = Array.prototype.slice.call(
    document.querySelectorAll("#tag-filter button[data-tag]")
  );
  var articles = Array.prototype.slice.call(
    document.querySelectorAll("#tag-list article")
  );
  if (!chips.length || !articles.length) return;

  function selectedTags() {
    return chips
      .filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
      .map(function (c) { return c.getAttribute("data-tag"); });
  }

  // OR semantics: with nothing selected everything shows; otherwise an
  // article shows when it carries any selected tag.
  function applyFilter() {
    var selected = selectedTags();
    articles.forEach(function (article) {
      if (!selected.length) {
        article.hidden = false;
        return;
      }
      var tags = (article.getAttribute("data-tags") || "").split(",");
      article.hidden = !selected.some(function (t) {
        return tags.indexOf(t) !== -1;
      });
    });
    // Keep the URL shareable: /tags/?tags=a,b while filtered, bare /tags/
    // when not. replaceState so toggling doesn't pollute history.
    var qs = selected.length
      ? "?tags=" + selected.map(encodeURIComponent).join(",")
      : "";
    history.replaceState(null, "", location.pathname + qs);
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", pressed ? "false" : "true");
      applyFilter();
    });
  });

  // Pre-select from ?tags= (links elsewhere on the site point here with a
  // tag already chosen). URLSearchParams decodes; unknown tags are ignored.
  var initial = new URLSearchParams(location.search).get("tags");
  if (initial) {
    var wanted = initial.split(",");
    chips.forEach(function (chip) {
      if (wanted.indexOf(chip.getAttribute("data-tag")) !== -1) {
        chip.setAttribute("aria-pressed", "true");
      }
    });
    applyFilter();
  }
})();
