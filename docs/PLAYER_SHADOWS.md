# Player clothing shadow and scale revision

## Source notes

The supplied `Shaders.zip` contains `Shaders/android/essl/DropShadow.fs.bin`. Its binary wrapper contains ESSL source declaring `s_texture`, `_texCoordMin`, `_texCoordMax`, `_color`, and `_textureOffset`. The fragment operation uses the sampled texture alpha and coordinate mask multiplied by `_color`; this is the useful source-backed contract for rendering a colored alpha silhouette with a positional offset. The archive includes a separate `Blur.fs.bin`, but this implementation intentionally does not blur the requested pixel-art shadow.

Public Growtopia depot manifests list a `Shaders` directory with `DropShadow.fs.bin` variants, confirming that this shader is present among shipped game assets: https://steamdb.info/depot/866021/manifests/ . The public manifest does not establish exactly which player/item draw calls use it in the official client; the per-item player projection below is therefore the requested planner behavior, implemented using the shader's alpha-mask pattern rather than claimed as an exact recovered client call site.

## Planner behavior

- The old elliptical floor shadow is removed.
- Render order keeps the shadow behind the land and the player/clothing in front of the land. Land no longer overlays the character.
- Eligible player and clothing sprite calls are rendered to a separate, black-tinted alpha-mask canvas, preserving each sprite's transparency and transform.
- The mask is composited at 50% opacity.
- The mask shifts exactly 6 canvas pixels toward the facing side and 3 canvas pixels downward: right-facing characters project bottom-right, left-facing characters bottom-left. Camera zoom is compensated so the screen-space shift stays 6×6 pixels.
- Ancestral slot sprites, aura/FX calls, additive visuals, pets, lines, particles, and punch-arm/hand projections are filtered out. During a punch, arm/hand calls and the triggering punch item are also excluded; the torso and unrelated clothing keep their shadows.
- Shadow color is #000000 with no blur, preserving crisp pixels.
- The base 32-unit player rig is scaled to 0.78 and land tiles render at 24 screen-units per 32-unit source tile — the midpoint between 16 and 32. The feet pivot remains fixed.

The silhouette is built from each eligible draw call using its own matrix. The shared mask is only a rendering optimization; the projected shape remains the combined set of individual player/clothing sprite silhouettes.
