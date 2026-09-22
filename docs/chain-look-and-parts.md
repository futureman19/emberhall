# Phase 5 chain identity

## Character looks: successor inscriptions

A character look is an `emberhall` JSON inscription with version `4`, type `look`, an `emberhall.look/1` recipe, name, calling, world/hour, and revision.

Changing a look does not destroy history. The new inscription points to the prior outpoint and increments its revision. Emberhall restores the highest valid revision held by the connected wallet; malformed or foreign content is ignored and the local save remains the fallback. Rendering still goes through `resolveLook`—there is no chain-specific renderer.

## Sculpted parts: Vault citizens

A sculpted `emberhall.part/1` inscription preserves the exact part id, name, slot, voxels/colors, creation time, author, and deterministic rarity. New part envelopes use version `5`; character looks remain version `4`. Mint confirms first, then removes the part from the local bench and current outfit. Listing and cancellation use the existing 1Sat OrdLock paths. Redeem preflight rejects unreadable content or a different local part with the same ID before requesting any burn, with neutral feedback and no local overwrite. A successful burn restores the original committed ID (not an origin-derived replacement), so existing `LookRecipeV1.parts` references work again. Identical replay is idempotent. Pending or rejected burns do not restore a part.

## Beta authority

Phase 5 keeps client-side mint authority. Local parts remain freely editable; the free walletless path and save-v4 format are unchanged. The protected chain decoder requires the commitment below and silently ignores invalid or legacy uncommitted v4 parts rather than accusing the player. When Emberhall gains a persistent world, mint authority moves server-side.

## Part content commitment v1

A v5 part envelope requires `commitment: { v: 1, algorithm: "sha256", digest: "<64 lowercase hex characters>" }` alongside `app`, `v`, `type`, `part`, `world`, and `hour`. Missing, malformed, unknown-version/algorithm or mismatched commitments are rejected; uncommitted v4 parts are not accepted through this protected decoder. Look v4 decoding is unchanged.

The digest is SHA-256 over UTF-8 bytes of the literal domain separator `emberhall.part-content/1\n` (one LF after `1`) followed by compact `JSON.stringify` of the validated canonical part. Object keys are emitted in this exact order: `schema`, `id`, `name`, `slot`, `voxels`, `createdAt`, `author`, `rarity`. Voxels are sorted numerically by x, then y, then z; each voxel emits `x`, `y`, `z`, `c`, with lowercase six-digit hex color. Coordinates and timestamps are validated integers; duplicate positions, invalid rarity, unknown fields and accessor properties are rejected. Input object key order, voxel order, and color letter case do not change the commitment. All part fields, including identity and metadata, are covered; envelope world/hour are context, not committed part content.

This is **content integrity, not authenticity or mint authorization**. Edits with an unchanged digest fail, but anyone able to replace both content and digest can compute a valid new commitment. No creator signature, provenance guarantee, server authority or transaction finality is implied. Wallet ownership, signing and confirmed burns remain separate concerns.

## Local verification

`node scripts/chain-smoke.mjs` exercises production UI/parser/transitions against independent Node-crypto v5 fixtures, with only SDK mint/burn actions replaced by deferred fake-wallet adapters. It retains exact-original-ID and valid-color-tamper assertions, and checks collision-before-burn, pending/rejected burn, malformed commitments, desktop/mobile layout and listed-item controls. Use `CHAIN_SMOKE_OUTPUT_DIR` to preserve separate before/after evidence. This harness uses no funded wallet and proves no real signing, broadcast or chain finality.
