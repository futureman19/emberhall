// Browser-only diagnostic. Not imported by the application.
export function installOverlay(T, state, getWorld, { sync = true } = {}) {
  const { scene, camera, gl } = state;
  const originalRender = gl.render;
  const group = new T.Group();
  group.name = 'diagnostic-persistent-player-overlay';
  scene.add(group);
  const copies = new Map();
  const size = new T.Vector2();
  gl.getDrawingBufferSize(size);
  const target = new T.WebGLRenderTarget(size.x, size.y);
  target.depthTexture = new T.DepthTexture(size.x, size.y);
  const depth = new T.MeshDepthMaterial();
  depth.colorWrite = false;
  const stats = { frames: 0, mismatches: 0, created: 0, disposed: 0, suppressed: 0, eligible: 0, maxCopies: 0, errors: [] };
  let stopped = false;
  function drop(source) {
    const copy = copies.get(source);
    group.remove(copy);
    copy.material.dispose();
    copies.delete(source);
    stats.disposed++;
  }
  function render(s, c) {
    if (stopped || s !== scene || c !== camera || gl.getRenderTarget()) return originalRender.call(gl, s, c);
    const player = scene.getObjectByName('emberhall-player-figure');
    const world = getWorld();
    const person = world.people.find(p => p.isPlayer);
    let enabled = !!player && !!person && !person.ghost && !(world.hour < (world.player.invisUntil ?? 0));
    for (let p = player; p; p = p.parent) if (!p.visible) enabled = false;
    scene.updateMatrixWorld(true);
    const sources = new Set();
    if (enabled) player.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      sources.add(o);
      let copy = copies.get(o);
      if (copy && (copy.geometry !== o.geometry || copy.userData.sourceMaterial !== o.material)) { drop(o); copy = null; }
      if (!copy) {
        copy = new T.Mesh(o.geometry, o.material.clone());
        copy.userData.sourceMaterial = o.material;
        copy.material.color?.set('#ffcf70');
        copy.material.emissive?.set('#ffcf70');
        copy.material.emissiveIntensity = 1;
        copy.material.transparent = true;
        copy.material.opacity = 0.55;
        copy.material.depthTest = false;
        copy.material.depthWrite = false;
        copy.material.toneMapped = false;
        copy.material.onBeforeCompile = shader => {
          shader.uniforms.sceneDepth = { value: target.depthTexture };
          shader.uniforms.depthSize = { value: size };
          shader.fragmentShader = 'uniform sampler2D sceneDepth;uniform vec2 depthSize;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() { if(gl_FragCoord.z <= texture2D(sceneDepth, gl_FragCoord.xy/depthSize).x + 0.000001) discard;');
        };
        copy.material.customProgramCacheKey = () => 'persistent-lifecycle-diagnostic-v1';
        copy.matrixAutoUpdate = false;
        copy.matrix.copy(o.matrixWorld);
        copy.renderOrder = 10000;
        copy.raycast = () => {};
        copies.set(o, copy);
        group.add(copy);
        stats.created++;
      }
      if (sync) copy.matrix.copy(o.matrixWorld);
      if (!copy.matrix.equals(o.matrixWorld)) stats.mismatches++;
    });
    for (const source of copies.keys()) if (!sources.has(source)) drop(source);
    stats.frames++;
    stats.eligible = sources.size;
    stats.maxCopies = Math.max(stats.maxCopies, copies.size);
    if (!enabled) stats.suppressed++;
    if (enabled && copies.size) {
      const actualSize = gl.getDrawingBufferSize(new T.Vector2());
      if (!actualSize.equals(size)) { size.copy(actualSize); target.setSize(size.x, size.y); }
      const oldTarget = gl.getRenderTarget(), oldOverride = scene.overrideMaterial;
      const oldAuto = gl.shadowMap.autoUpdate, oldVisible = player.visible;
      const excluded = [];
      scene.traverse(o => {
        if (o.isMesh && !Array.isArray(o.material) && o.material.depthWrite === false) { excluded.push([o, o.visible]); o.visible = false; }
      });
      group.visible = false;
      player.visible = false;
      scene.overrideMaterial = depth;
      gl.shadowMap.autoUpdate = false;
      try { gl.setRenderTarget(target); originalRender.call(gl, scene, camera); }
      finally {
        for (const [o, visible] of excluded) o.visible = visible;
        player.visible = oldVisible;
        group.visible = true;
        scene.overrideMaterial = oldOverride;
        gl.shadowMap.autoUpdate = oldAuto;
        gl.setRenderTarget(oldTarget);
      }
    }
    return originalRender.call(gl, s, c);
  }
  gl.render = render;
  return {
    snapshot: () => ({ ...stats, errors: [...stats.errors], copies: copies.size, ids: [...copies.values()].map(o => o.uuid) }),
    stop() {
      if (stopped) return;
      stopped = true;
      if (gl.render === render) gl.render = originalRender;
      for (const source of copies.keys()) drop(source);
      scene.remove(group);
      depth.dispose();
      target.depthTexture.dispose();
      target.dispose();
    },
    originalRender,
  };
}
