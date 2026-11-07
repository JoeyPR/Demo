import test from "node:test";
import assert from "node:assert/strict";
import { loadSheets } from "../weather-engine/weather-renderer.js";

test("Paradise City retries only missing bg_pc sheets from the original weather asset path", async () => {
  const PreviousImage = globalThis.Image;
  const requested = [];
  class FakeImage {
    complete = false;
    naturalWidth = 0;
    onload = null;
    onerror = null;
    set src(url) {
      this._src = url;
      requested.push(url);
      queueMicrotask(() => {
        if (url.startsWith("https://setplannergt.com/weather/sheets/")) {
          this.complete = true;
          this.naturalWidth = 32;
          this.onload?.();
        } else {
          this.complete = true;
          this.onerror?.();
        }
      });
    }
    get src() { return this._src; }
  }
  globalThis.Image = FakeImage;
  try {
    const names = [
      "bg_pc_city.webp", "bg_pc_island.webp", "bg_pc_sky.webp",
      "bg_pc_waves1.webp", "bg_pc_waves2.webp", "bg_pc_waves3.webp"
    ];
    const images = await loadSheets(
      { sheets: names },
      "/sheets/",
      "https://setplannergt.com/weather/sheets/"
    );
    for (const name of names) {
      assert.ok(images[name]);
      assert.equal(images[name].src, "https://setplannergt.com/weather/sheets/" + name);
    }
    assert.equal(requested.length, names.length * 2);
    const nonParadise = await loadSheets(
      { sheets: ["city_sky.webp"] },
      "/sheets/",
      "https://setplannergt.com/weather/sheets/"
    );
    assert.equal(nonParadise["city_sky.webp"], null);
    assert.equal(requested.length, names.length * 2 + 1);
  } finally {
    if (PreviousImage === undefined) delete globalThis.Image;
    else globalThis.Image = PreviousImage;
  }
});
