// Grandpa Ollie's Dragon Book: it pops out of the opened chest, lands on the ground nearby and
// floats there, glowing, until the player walks up and picks it up.
import * as THREE from 'three';

const GROUND = 0.25;
const FLIGHT = 1.1; // seconds from the chest to the ground
const HOVER = 0.32; // how high it floats once landed

export class BookView {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    const book = new THREE.Group();
    const cover = new THREE.MeshLambertMaterial({ color: '#7a2e2e', emissive: '#3a0d0d', emissiveIntensity: 0.4 });
    const pages = new THREE.MeshLambertMaterial({ color: '#fff4dc' });
    const gold = new THREE.MeshLambertMaterial({ color: '#ffd24a', emissive: '#8a5a00', emissiveIntensity: 0.8 });
    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      book.add(m);
      return m;
    };
    box(0.56, 0.04, 0.44, cover, 0, -0.07, 0); // back cover
    box(0.52, 0.1, 0.4, pages, 0.01, 0, 0); // pages
    box(0.56, 0.04, 0.44, cover, 0, 0.07, 0); // front cover
    box(0.05, 0.18, 0.44, cover, -0.27, 0, 0); // spine
    // a golden dragon-eye badge and corner trims on the front
    box(0.16, 0.02, 0.16, gold, 0.03, 0.095, 0);
    box(0.06, 0.025, 0.06, new THREE.MeshLambertMaterial({ color: '#6fe0ff', emissive: '#2a7a9a' }), 0.03, 0.105, 0);
    for (const [x, z] of [[0.24, 0.18], [0.24, -0.18], [-0.2, 0.18], [-0.2, -0.18]]) box(0.07, 0.02, 0.07, gold, x, 0.095, z);
    book.scale.setScalar(1.3);
    this.book = book;
    this.root.add(book);

    // a soft golden glow under it, and sparkles rising around it
    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.sparkles = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#fff2a8' }), 14);
    this.sparkles.frustumCulled = false;
    this.light = new THREE.PointLight('#ffd27a', 0, 3.5, 1.5);
    this.tmp = new THREE.Object3D();
    this.root.visible = false;
    scene.add(this.root, this.glow, this.sparkles, this.light);
    this.glow.visible = this.sparkles.visible = false;
  }

  // Pop it out of the chest (from: {x, y, z}) to land at spot {x, z}; or appear there at once.
  show(spot, from = null) {
    this.spot = spot;
    this.from = from;
    this.flight = from ? 0 : FLIGHT;
    this.pickT = null;
    this.root.visible = true;
  }

  get landed() {
    return this.root.visible && this.flight >= FLIGHT && this.pickT === null;
  }

  // Picked up: it zips up toward the player and vanishes.
  pickUp(target) {
    this.pickT = 0;
    this.pickFrom = this.root.position.clone();
    this.target = target;
  }

  update(dt, t) {
    if (!this.root.visible) return;
    const { spot } = this;
    const groundY = GROUND + HOVER + Math.sin(t * 2.2) * 0.06;
    if (this.flight < FLIGHT) {
      // a high arc out of the chest, tumbling, and settling flat as it lands
      this.flight = Math.min(FLIGHT, this.flight + dt);
      const k = this.flight / FLIGHT;
      const f = this.from;
      this.root.position.set(f.x + (spot.x - f.x) * k, f.y + (groundY - f.y) * k + Math.sin(k * Math.PI) * 2.2, f.z + (spot.z - f.z) * k);
      this.book.rotation.set((1 - k) * 9, (1 - k) * 4, (1 - k) * 3);
    } else if (this.pickT === null) {
      this.root.position.set(spot.x, groundY, spot.z);
      this.book.rotation.set(-0.35, t * 0.9, 0);
    }
    if (this.pickT !== null) {
      this.pickT += dt;
      const k = Math.min(1, this.pickT / 0.45);
      const to = this.target;
      this.root.position.lerpVectors(this.pickFrom, new THREE.Vector3(to.x, (to.y ?? GROUND) + 1.6, to.z), k);
      this.root.scale.setScalar(1 - k * 0.9);
      this.book.rotation.y += dt * 14;
      if (k >= 1) this.hide();
    }

    const on = this.landed ? 1 : 0;
    this.glow.visible = this.sparkles.visible = !!on;
    this.light.intensity = on * (1.6 + Math.sin(t * 3) * 0.4);
    this.light.position.set(spot.x, GROUND + 1, spot.z);
    if (on) {
      this.glow.position.set(spot.x, GROUND + 0.02, spot.z);
      this.glow.material.opacity = 0.28 + Math.sin(t * 3) * 0.08;
      for (let i = 0; i < 14; i++) {
        const life = (t * 0.6 + i / 14) % 1, a = i * 2.4 + t * 0.5;
        this.tmp.position.set(spot.x + Math.cos(a) * 0.55, GROUND + 0.1 + life * 1.4, spot.z + Math.sin(a) * 0.55);
        this.tmp.scale.setScalar(Math.sin(life * Math.PI));
        this.tmp.rotation.y = t * 3 + i;
        this.tmp.updateMatrix();
        this.sparkles.setMatrixAt(i, this.tmp.matrix);
      }
      this.sparkles.instanceMatrix.needsUpdate = true;
    }
  }

  hide() {
    this.root.visible = false;
    this.glow.visible = this.sparkles.visible = false;
    this.light.intensity = 0;
    this.pickT = null;
  }

  dispose() {
    this.scene.remove(this.root, this.glow, this.sparkles, this.light);
    this.root.traverse((o) => o.geometry?.dispose());
    this.glow.geometry.dispose();
    this.sparkles.geometry.dispose();
  }
}
