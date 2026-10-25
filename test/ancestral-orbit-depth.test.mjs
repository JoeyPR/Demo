import test from "node:test";
import assert from "node:assert/strict";
import { orbitDirectionX } from "../docs/ancestral/renderer.js";

const track = {
  keys: [
    [0, 10, 12, 1, 1, 0, 255, 255, 255, 255],
    [250, 20, 12, 1, 1, 0, 255, 255, 255, 255],
    [500, 10, 12, 1, 1, 0, 255, 255, 255, 255],
    [750, 0, 12, 1, 1, 0, 255, 255, 255, 255],
    [1000, 10, 12, 1, 1, 0, 255, 255, 255, 255],
  ],
};

test("ancestral orbit is behind while travelling right-to-left and in front on return", () => {
  assert.ok(orbitDirectionX(track, 250) < 0, "turning from the right starts the rear arc");
  assert.ok(orbitDirectionX(track, 500) < 0, "the middle of the return-left arc stays behind");
  assert.ok(orbitDirectionX(track, 750) > 0, "turning from the left starts the front arc");
  assert.ok(orbitDirectionX(track, 900) > 0, "the return-right arc stays in front");
});
