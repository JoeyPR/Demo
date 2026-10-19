# Planner punch restoration QA

- Compare the default punch against the pre-regression planner coefficients at 0, 16, 50, 100, 150, 200 and 250ms.
- Verify width starts at zero and expands to 1.8, rather than starting at .65 and using a sine/cosine retract curve.
- Verify the non-punching front arm advances from 90 toward 20 degrees without idle resetting it every frame.
- Verify held attacks retrigger at 200ms intervals and released attacks expire at 260ms.
- Browser: use the actual Punch pad, hold/release, near/far pointer aiming, reverse aiming, naked startup, and a shirt with punch sleeve mapping.
- Inspect animated frames on desktop and 375px phone. Confirm the adaptive render surface still expands beyond the old player box.
- Exploratory cases: aim across the player while holding; release outside the preview and check that no punch input remains stuck.

This restores the Set Planner-derived generic animation, not a claim of complete official-client punch parity or every custom item pose.
