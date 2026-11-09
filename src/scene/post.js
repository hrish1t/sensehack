import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const RetroShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uAb: { value: .006 },
    uGlitch: { value: 0 },
    uCRT: { value: 0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uAb; uniform float uGlitch; uniform float uCRT;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uCRT > 0.001){ vec2 c = uv * 2.0 - 1.0; c *= 1.0 + 0.07 * uCRT * dot(c, c); uv = c * 0.5 + 0.5; }
      if (uGlitch > 0.001){
        float band = floor(uv.y * 26.0) + floor(uTime * 14.0) * 7.0;
        if (h(vec2(band, floor(uTime * 22.0))) < uGlitch * 0.55) uv.x += (h(vec2(band, 3.1)) - 0.5) * 0.22 * uGlitch;
        uv.y += (h(vec2(floor(uTime * 9.0), 1.0)) - 0.5) * 0.02 * uGlitch;
      }
      vec2 d = uv - 0.5; float r2 = dot(d, d);
      vec2 off = d * uAb * (0.35 + r2 * 3.0) + vec2(uGlitch * 0.012, 0.0);
      vec3 c = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      c = c * vec3(1.0, 0.98, 0.95) + vec3(0.028, 0.022, 0.02);
      float g = h(floor(vUv * uRes) + fract(uTime * 7.0) * 91.7) - 0.5;
      c += g * (0.065 + uGlitch * 0.25);
      c *= 0.975 + 0.05 * h(floor(vUv * uRes / 3.0) + 17.0);
      c *= 1.0 - (uGlitch * 0.35 + uCRT * 0.22) * step(0.5, fract(vUv.y * uRes.y / 4.0));
      c *= 1.0 - r2 * (0.6 + uCRT * 0.8);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) c = vec3(0.0);
      gl_FragColor = vec4(c, 1.0);
    }`
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  composer.addPass(new OutputPass());
  const retro = new ShaderPass(RetroShader);
  composer.addPass(retro);

  return {
    composer,
    renderPass,
    retro: retro.uniforms,
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      retro.uniforms.uRes.value.set(w * dpr, h * dpr);
    },
    show(scene, camera) {
      renderPass.scene = scene;
      renderPass.camera = camera;
    },
    render() {
      composer.render();
    }
  };
}
