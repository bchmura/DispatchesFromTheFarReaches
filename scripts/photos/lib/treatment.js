const TREATMENTS = new Set(["sepia", "bw", "duotone-brass", "darkened"]);

function applyTreatment(image, treatmentName) {
  if (!TREATMENTS.has(treatmentName)) {
    throw new Error(`Unknown photo treatment: ${treatmentName}`);
  }
  switch (treatmentName) {
    case "bw":
      return image.greyscale().modulate({ brightness: 0.92 });
    case "sepia":
      return image
        .modulate({ saturation: 0 })
        .modulate({ brightness: 0.95 })
        .tint({ r: 112, g: 66, b: 20 });
    case "duotone-brass":
      return image
        .modulate({ saturation: 0 })
        .tint({ r: 168, g: 132, b: 74 })
        .modulate({ brightness: 0.9 });
    case "darkened":
      return image.modulate({ brightness: 0.75, saturation: 0.85 });
    default:
      throw new Error(`Unhandled photo treatment: ${treatmentName}`);
  }
}

module.exports = { applyTreatment, TREATMENTS };
