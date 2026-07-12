(function () {
  var nodes = document.querySelectorAll(".mermaid");
  if (!nodes.length) return;

  // Matches the site's brass/ink-green "Archive" palette (see
  // docs/designSpecifications-updated.md) — diagram text set in Fragment
  // Mono, same as every other piece of metadata on the site.
  var themeVariables = {
    background: "#1b2318",
    primaryColor: "#1b2318",
    primaryTextColor: "#e7e1cf",
    primaryBorderColor: "#8a6d34",
    secondaryColor: "#20291d",
    secondaryBorderColor: "#2e3324",
    tertiaryColor: "#14150f",
    tertiaryBorderColor: "#2e3324",
    lineColor: "#8a6d34",
    textColor: "#e7e1cf",
    mainBkg: "#1b2318",
    nodeBorder: "#8a6d34",
    clusterBkg: "#20291d",
    clusterBorder: "#2e3324",
    titleColor: "#e7e1cf",
    edgeLabelBackground: "#1b2318",
    actorBkg: "#1b2318",
    actorBorder: "#8a6d34",
    actorTextColor: "#e7e1cf",
    actorLineColor: "#8a6d34",
    signalColor: "#a89f89",
    signalTextColor: "#e7e1cf",
    labelBoxBkgColor: "#20291d",
    labelBoxBorderColor: "#8a6d34",
    labelTextColor: "#e7e1cf",
    loopTextColor: "#e7e1cf",
    noteBkgColor: "#20291d",
    noteBorderColor: "#8a6d34",
    noteTextColor: "#e7e1cf",
    activationBorderColor: "#8a6d34",
    activationBkgColor: "#1b2318",
    sequenceNumberColor: "#14150f",
    // A handwriting-style face reads less "typed schematic" and more
    // "sketched in a field notebook" than the site's usual Fragment Mono —
    // fits the hand-drawn look better than a monospace ever could.
    fontFamily: "'Kalam', 'Comic Sans MS', cursive",
  };

  var script = document.createElement("script");
  script.src = "/assets/js/vendor/mermaid.min.js";
  script.onload = function () {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: themeVariables,
      // Mermaid's built-in rough.js-backed sketch renderer — box/line edges
      // come out slightly uneven instead of ruler-straight, matching the
      // hand-inked feel used elsewhere on the site (the hover-link squiggle,
      // the restricted-collection stamp).
      look: "handDrawn",
    });
    window.mermaid.run({ querySelector: ".mermaid" });
  };
  document.head.appendChild(script);
})();
