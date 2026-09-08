# Emberhall: authored assets + procedural assembly

## Intent
Original storybook woodland art: soft architectural forms and a crafted miniature feel, with cozy greenery and warm inhabited spaces. Preserve the proud medieval twin-tower hall, brown roof, red/gold banners, and Ultima Online-inspired gameplay. Reference qualities, not copied assets or recognizable film characters.

## First review slice
- Editable Blender hall and tree kit, exported as runtime GLB.
- Deliberately shaped roof surfaces, softened wall/tower edges, readable heraldry, organic branching and asymmetric foliage.
- Deterministic assembly and placement in the starting courtyard vicinity.
- Review at the unchanged gameplay camera, not just a Blender beauty render.
- This is the first authored-asset slice, not a claim of matching Tiny Glade's finished production quality.

## Boundary between art and game
The simulation remains the authority for buildings, resource kinds, harvesting, collisions, paths, player position and saves. Decorative assets do not create resource nodes or capture terrain/resource picking. Loading failures must retain a usable original visual. Indoor cutaway remains functional. No schema migrations or gameplay balance changes belong in this pass.

## Asset workflow
Keep editable source separate from runtime export. Blender-generated construction scripts are repeatable modeling tools: their output must include a real editable .blend, not just code. GLB exports must be exercised by the actual runtime loader. Reusable shapes, carefully controlled proportions, and a small material palette take priority over adding detail indiscriminately.

## Acceptance
- Open and export the assets using the installed Blender executable.
- Validate exported geometry and bounds and finite transforms.
- Run lint, type checking, game tests and build; disclose pre-existing canonical test failures rather than weakening the gate.
- Inspect desktop and mobile, outside and inside, and check successful asset HTTP responses.
- Compare using the existing disposable QA save and normal camera.
- Walk into and out of the hall using the actual simulation command/tick path. This is separate from verifying pointer picking.
- Publish only an isolated preview after local validation; production remains unchanged.

## Deferred deliberately
Characters and animation overhaul, world-wide replacement of all building/resource assets, a true nighttime-lighting overhaul, HUD redesign, and certified low-end hardware performance. These are later passes, not silently completed by the first hall/tree kit.
