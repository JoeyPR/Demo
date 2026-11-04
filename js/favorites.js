/* Persistent inventory favorites, following the ID-list storage model from
   codex/setplanner-research-de2711c-20261031 (36729cffa5c93ba02de2c33d4af16105e228facc). */
(function () {
  const MAX_FAVORITES = 20;

  function normalize(values) {
    const ids = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length === MAX_FAVORITES) break;
    }
    return ids;
  }

  function toggle(values, value) {
    const ids = normalize(values);
    const id = Number(value);
    if (!Number.isSafeInteger(id)) return { ids, action: "invalid", limitReached: false };
    const index = ids.indexOf(id);
    if (index !== -1) {
      ids.splice(index, 1);
      return { ids, action: "removed", limitReached: false };
    }
    if (ids.length >= MAX_FAVORITES) return { ids, action: "limit", limitReached: true };
    ids.push(id);
    return { ids, action: "added", limitReached: false };
  }

  window.P.favoriteStore = Object.freeze({ MAX_FAVORITES, normalize, toggle });
})();
