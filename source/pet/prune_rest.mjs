// Remove animation channels whose every keyframe equals the node's rest (bind) transform.
// three.js AnimationMixer falls back to the rest value for bones a clip does not touch.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [,, inp, out] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const EPS = { translation: 1e-4, rotation: 1e-4, scale: 1e-4, weights: 1e-4 };
let removed = 0, kept = 0;
for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode(), path = ch.getTargetPath();
    const s = ch.getSampler(), outA = s.getOutput();
    if (!node || path === 'weights') { kept++; continue; }
    const rest = path === 'translation' ? node.getTranslation() : path === 'rotation' ? node.getRotation() : node.getScale();
    const n = rest.length, arr = outA.getArray();
    let same = true;
    for (let i = 0; i < arr.length && same; i += n) {
      let dot = 0;
      for (let k = 0; k < n; k++) { if (path !== 'rotation' && Math.abs(arr[i + k] - rest[k]) > EPS[path]) same = false; dot += arr[i + k] * rest[k]; }
      if (path === 'rotation' && 1 - Math.abs(dot) > EPS.rotation) same = false;   // q and -q are the same rotation
    }
    if (same) { ch.dispose(); s.dispose(); removed++; } else kept++;
  }
}
await io.write(out, doc);
console.log(`prune_rest: removed ${removed} channels, kept ${kept}`);
