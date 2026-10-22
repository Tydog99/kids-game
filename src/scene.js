import * as THREE from 'three';

export const SKY = '#9fdcff';

export function addLights(scene) {
  const hemi = new THREE.HemisphereLight('#dff3ff', '#6a8f4e', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4dc', 2.0);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -16; s.right = 16; s.top = 16; s.bottom = -16; s.near = 1; s.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { hemi, sun };
}
