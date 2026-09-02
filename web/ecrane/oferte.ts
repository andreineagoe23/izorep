import type { Ecran } from "./tip.js";

export const ecran: Ecran = {
  id: "oferte",
  titlu: "oferte",
  render(root) { root.innerHTML = '<p class="nota">În lucru.</p>'; },
};
