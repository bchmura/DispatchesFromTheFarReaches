import * as pagefind from "/pagefind/pagefind.js";

const input = document.getElementById("site-search");
const results = document.getElementById("site-search-results");
if (input && results) {
  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const term = input.value.trim();
      results.innerHTML = "";
      if (!term) return;
      const search = await pagefind.search(term);
      if (!search.results.length) {
        results.innerHTML = '<p class="no-results">Nothing filed under that yet.</p>';
        return;
      }
      for (const r of search.results.slice(0, 6)) {
        const data = await r.data();
        const a = document.createElement("a");
        a.href = data.url;
        a.textContent = data.meta.title || data.url;
        results.appendChild(a);
      }
    }, 200);
  });
}
