# Phase 5 chain identity

## Character looks: successor inscriptions

A character look is an `emberhall` JSON inscription with version `4`, type `look`, an `emberhall.look/1` recipe, name, calling, world/hour, and revision.

Changing a look does not destroy history. The new inscription points to the prior outpoint and increments its revision. Emberhall restores the highest valid revision held by the connected wallet; malformed or foreign content is ignored and the local save remains the fallback. Rendering still goes through `resolveLook`—there is no chain-specific renderer.

## Sculpted parts: Vault citizens

A sculpted `emberhall.part/1` inscription preserves the exact part id, slot, voxels/colors, creation time, author, and deterministic rarity. Mint confirms first, then removes the part from the local bench and current outfit. Listing and cancellation use the existing 1Sat OrdLock paths. Redeeming burns the ordinal first, then restores the exact part to the local collection so it can be worn through `LookRecipeV1.parts` again.

## Beta authority

Phase 5 intentionally keeps the current silent client-side trust model. The app performs total parsing and atomic local transitions, but it does not accuse, block, or label a player whose local state was changed. When Emberhall gains a persistent world, mint authority moves server-side behind the same inscription contracts; the free walletless path and save-v4 format remain unchanged.
