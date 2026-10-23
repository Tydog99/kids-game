// Grandpa Ollie's magic ring: a big glowing hoop standing in the air with a swirling middle.
// Flying a dragon through it takes you to the Sky Pitch (and one at the pitch brings you home).
import * as THREE from 'three';

export const MAGIC_RADIUS = 2.4;

export class MagicRing {
  // at: { x, y, z } centre; heading: the way it faces
  constructor(scene, at, heading) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(at.x, at.y, at.z);
    this.group.rotation.y = heading;
    this.at = new THREE.Vector3(at.x, at.y, at.z);
    this.hoop = new THREE.Mesh(
      new THREE.TorusGeometry(MAGIC_RADIUS, 0.26, 12, 48),
      new THREE.MeshPhongMaterial({ color: '#c79bff', emissive: '#6a2fd0', emissiveIntensity: 0.8, shininess: 60 }),
    );
    this.swirl = new THREE.Mesh(
      new THREE.CircleGeometry(MAGIC_RADIUS - 0.1, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0;
            float a = atan(p.y, p.x);
            float swirl = sin(a * 3.0 + r * 9.0 - uTime * 3.0) * 0.5 + 0.5;
            vec3 col = mix(vec3(0.45, 0.25, 0.95), vec3(1.0, 0.85, 0.45), swirl * (1.0 - r));
            float alpha = (0.35 + 0.4 * swirl) * smoothstep(1.0, 0.75, r);
            gl_FragColor = vec4(col, alpha);
          }`,
      }),
    );
    this.group.add(this.hoop, this.swirl);
    // sparkles drifting round the hoop
    this.sparkles = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: '#fff3c4' }), 18);
    this.sparkles.frustumCulled = false;
    this.group.add(this.sparkles);
    this.light = new THREE.PointLight('#b58cff', 2.5, 10, 1.4);
    this.group.add(this.light);
    this.tmp = new THREE.Object3D();
    scene.add(this.group);
  }

  set visible(v) {
    this.group.visible = v;
  }

  get visible() {
    return this.group.visible;
  }

  // viewer: where it's seen from (the camera); the ring turns to face it
  update(t, viewer) {
    if (viewer) this.group.rotation.y = Math.atan2(viewer.x - this.at.x, viewer.z - this.at.z);
    this.swirl.material.uniforms.uTime.value = t;
    this.hoop.rotation.z = Math.sin(t * 0.7) * 0.05;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + t * 0.8, r = MAGIC_RADIUS + 0.3 + Math.sin(t * 2 + i) * 0.25;
      this.tmp.position.set(Math.cos(a) * r, Math.sin(a) * r, Math.sin(t * 3 + i) * 0.3);
      this.tmp.scale.setScalar(0.6 + Math.sin(t * 4 + i * 1.3) * 0.4);
      this.tmp.updateMatrix();
      this.sparkles.setMatrixAt(i, this.tmp.matrix);
    }
    this.sparkles.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}
