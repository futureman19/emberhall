# Approved Forged Oak GUI art

Exact PNG bytes selected by the user from the isolated Forged Oak prototype. Three named Blender collections: repeatable band, open minimap reliquary, recessed action slot. Source is editable and script-authored, not hand-sculpted human artwork.

Runtime: `src/styles/forged-oak.css`; exported PNGs and hash manifest in `public/art/gui/forged-oak/`. CSS keeps the pre-existing controls, aria labels, frame sizes, safe areas, meter roles and reduced-motion behavior. Location-name text buttons are intentionally excluded from square relief frames. Gradients and the existing minimap border remain visible if artwork fails to load.

Rebuild with Blender --background --factory-startup --python-exit-code 1 --python art/blender/forged-oak/build_gui.py. WARNING: rebuilding overwrites the editable source and exported PNGs; it does not automatically approve new hashes. Render metadata can change PNG hashes. Review exports before deliberately updating the approved manifest/tests. No .blend1 backups are committed.

Approved scope is the band, map surround and band/rail icon-button artwork, not a full window/renderer redesign. Main art ledger links the Band, Rail and DockedMinimap surfaces to this source.
