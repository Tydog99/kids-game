// The look of anything Glimmer turns to diamond: shiny cut facets in the same colours as her
// breath (white, pink, aqua, lilac and gold), each facet twinkling now and then.
import * as THREE from 'three';

export function rainbowDiamond() {
  const m = new THREE.MeshPhongMaterial({ color: '#ffffff', emissive: '#7a7a7a', emissiveIntensity: 0.5, specular: '#ffffff', shininess: 220, flatShading: true });
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = m.userData.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDiamondPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDiamondPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDiamondPos;
        uniform float uTime;
        vec3 diamondTint(float k) {
          if (k < 0.2) return vec3(1.0);
          if (k < 0.4) return vec3(1.0, 0.42, 0.72);
          if (k < 0.6) return vec3(0.3, 0.88, 1.0);
          if (k < 0.8) return vec3(0.68, 0.45, 1.0);
          return vec3(1.0, 0.8, 0.25);
        }`,
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec4 diffuseColor = vec4( diffuse, opacity );
        vec3 cell = floor(vDiamondPos * 3.0);
        float pick = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 tint = diamondTint(pick);
        float twinkle = pow(max(0.0, sin(uTime * 2.5 + pick * 40.0)), 24.0);
        diffuseColor.rgb *= tint;`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = totalEmissiveRadiance * tint + twinkle * 0.8;');
  };
  return m;
}
