# NewDemo Milestone 3 — Overhaul import

This is the handoff manifest for the integrated NewDemo build intended for the `overhaul` branch.

## Source package

- Archive: `NewDemo-Integrated-Milestone3.zip`
- SHA-256: `b550a89b9f642c8c90ac48f1d21038d2f118ff4fb9a192c976140a79b6acf403`
- Compressed size: 121,900,669 bytes
- Entries: 6,328 (6,300 files, 28 directories)
- Expanded size: 131,769,586 bytes
- Largest individual file: 3,356,527 bytes
- Files exceeding GitHub's 100 MB per-file limit: 0
- Archive root: `NewDemo-integrated/`

The archive is designed to be extracted to the repository root, producing `NewDemo-integrated/` without replacing the existing repository files.

## Validation recorded for this build

- Native GatewayDialog renderer checks: 28 passed, 0 failed.
- Inventory Chromium harness: 21 passed, 0 failed.
- Inventory harness covers catalog bootstrap, search, category filtering, favorites, focus/equip, equipped filtering, INFO/DROP event dispatch, tool-item protection, mobile-width constraints, and virtualization.
- The inventory harness uses the real inventory source and catalog with a controlled mock host API. It is not a live NewDemo browser run; the container blocked navigation to the full NewDemo page.
- Native renderer dialog checks validate the GatewayDialog draw and hit-test lifecycle separately from the mocked inventory host.

## Import status

This branch is based on `origin`. The archive itself has **not** been uploaded by the GitHub connector: the connector supports Git objects and text content but cannot stream a local mounted archive into GitHub. The import helper in `tools/import-newdemo-milestone3.sh` verifies the archive checksum, extracts it, stages only `NewDemo-integrated/`, commits it, and pushes `overhaul`.

Do not treat this manifest commit as the full NewDemo source import. The full source import is complete only after `NewDemo-integrated/` appears in the repository tree on `overhaul`.
