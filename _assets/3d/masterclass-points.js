import * as THREE from 'three';

const SAMPLE_INTERVAL = 0.2;
const LIGHT_DIRECTION = new THREE.Vector3(0.62, 0.38, 0.68).normalize();

// ACW1: первые точки анимируются, остальные хранятся один раз. На каждом
// отсчёте позиции записаны в Int16 (0,1 мм), нормали в Int8. Нулевой отсчёт
// хранится вместе с неподвижными точками.
async function loadSamples() {
  const response = await fetch(new URL('./products-masterclass.bin', import.meta.url));
  if (!response.ok || !response.body) throw new Error('Мастер-класс: HTTP ' + response.status);
  const raw = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const header = new DataView(raw);
  if (raw.byteLength < 16 || header.getUint32(0) !== 0x41435731) throw new Error('Мастер-класс: формат точек');
  const count = header.getUint32(4, true);
  const moving = header.getUint32(8, true);
  const frames = header.getUint32(12, true);
  const lastOffset = 16 + count * 10 + moving * (frames - 1) * 9;
  if (!moving || moving > count || frames < 2 || lastOffset !== raw.byteLength) {
    throw new Error('Мастер-класс: неполные данные сцены');
  }
  const positions = new Int16Array(raw, 16, count * 3);
  const normals = new Int8Array(raw, 16 + count * 6, count * 3);
  const styles = new Uint8Array(raw, 16 + count * 9, count);
  const motionPositions = new Int16Array(raw, 16 + count * 10, moving * (frames - 1) * 3);
  const motionNormals = new Int8Array(raw, 16 + count * 10 + motionPositions.byteLength, motionPositions.length);
  return { count, moving, frames, positions, normals, styles, motionPositions, motionNormals };
}

function pointMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uDpr: { value: 1 }, uMix: { value: 0 }, uTheme: { value: 0 }, uDepthPass: { value: false },
      uLight: { value: LIGHT_DIRECTION },
      uBone: { value: new THREE.Color('#F2F0EB') },
      uBrass: { value: new THREE.Color('#DDA74F') },
      uGraphite: { value: new THREE.Color('#2B2A26') },
    },
    vertexShader: `
      in vec3 aNextPosition, aNextNormal;
      in float aStyle;
      uniform float uDpr, uMix, uTheme;
      uniform bool uDepthPass;
      uniform vec3 uLight, uBone, uBrass, uGraphite;
      out vec3 vColor;
      out float vAlpha;
      float hash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
      void main() {
        vec4 p = modelViewMatrix * vec4(mix(position, aNextPosition, uMix), 1.0);
        vec3 n = normalize(normalMatrix * mix(normal, aNextNormal, uMix));
        float facing = dot(n, normalize(-p.xyz));
        float lit = 0.16 + 0.84 * max(dot(n, uLight), 0.0);
        lit = (1.0 - exp(-2.35 * lit)) / (1.0 - exp(-2.35));
        float size = mix(1.02, 1.74, hash(float(gl_VertexID) + 17.0));
        float tone = 0.92;
        float alpha = smoothstep(-0.07, 0.17, facing);
        vec3 bone = mix(uBone, uGraphite, uTheme);
        vec3 color = bone;
        if (aStyle == 1.0) {
          tone = 0.66;
          lit = max(lit, 0.53);
          alpha *= 0.93;
          size *= 1.14;
        } else if (aStyle == 2.0) {
          tone = 0.14;
          alpha *= 0.43;
          size *= 0.80;
        } else if (aStyle == 3.0) {
          tone = 0.89;
          lit = max(lit, 0.76);
          size *= 1.10;
        } else if (aStyle == 4.0) {
          color = uBrass;
          lit = max(lit, 0.74);
          size *= 1.15;
        } else if (aStyle == 5.0) {
          tone = 1.0;
          lit = max(lit, 0.76);
          size *= 1.10;
        } else if (aStyle == 6.0) {
          tone = 0.72;
          lit = max(lit, 0.62);
        }
        vColor = color * mix(tone * lit, 1.0, uTheme * 0.55);
        vAlpha = alpha;
        if (uDepthPass) {
          // Более крупные точки записывают глубину перед цветом, чтобы
          // ближние фигуры перекрывали дальние. Сдвиг оставляет видимыми
          // соседние точки той же поверхности.
          vAlpha = (aStyle <= 1.0 && facing > 0.25) ? 1.0 : 0.0;
          size = 3.2;
          p.z -= 0.0065;
        }
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp(size * 5.0 / -p.z, 0.78, uDepthPass ? 4.0 : 2.25) * uDpr;
      }`,
    fragmentShader: `
      in vec3 vColor;
      in float vAlpha;
      layout(location = 0) out vec4 outColor;
      void main() {
        float opacity = vAlpha * (1.0 - smoothstep(0.37, 0.50, length(gl_PointCoord - 0.5)));
        if (opacity < 0.035) discard;
        vec3 srgb = mix(vColor * 12.92, 1.055 * pow(vColor, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, vColor));
        outColor = vec4(srgb, opacity);
      }`,
    transparent: true,
    depthTest: true,
    depthWrite: true,
  });
}

export async function createMasterclassPoints() {
  const data = await loadSamples();
  const geometry = new THREE.BufferGeometry();
  const attribute = (name, values, scale) => {
    const result = new THREE.BufferAttribute(Float32Array.from(values, value => value * scale), 3);
    result.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, result);
    return result;
  };
  const position = attribute('position', data.positions, 0.0001);
  const normal = attribute('normal', data.normals, 1 / 127);
  const nextPosition = attribute('aNextPosition', data.positions, 0.0001);
  const nextNormal = attribute('aNextNormal', data.normals, 1 / 127);
  geometry.setAttribute('aStyle', new THREE.BufferAttribute(data.styles, 1));

  const material = pointMaterial();
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  const depthMaterial = material.clone();
  depthMaterial.colorWrite = false;
  depthMaterial.uniforms = { ...material.uniforms, uDepthPass: { value: true } };
  const depth = new THREE.Points(geometry, depthMaterial);
  depth.frustumCulled = false;
  depth.renderOrder = 5;
  const group = new THREE.Group();
  group.add(depth, points);
  const frameSize = data.moving * 3;
  const duration = (data.frames - 1) * SAMPLE_INTERVAL;
  let lastIndex = -1, elapsed = 0;

  function writeFrame(index, pos, nrm) {
    const p = index === 0 ? data.positions : data.motionPositions;
    const n = index === 0 ? data.normals : data.motionNormals;
    const offset = Math.max(0, index - 1) * frameSize;
    for (let i = 0; i < frameSize; i++) {
      pos.array[i] = p[offset + i] * 0.0001;
      nrm.array[i] = n[offset + i] / 127;
    }
    for (const field of [pos, nrm]) {
      field.clearUpdateRanges();
      field.addUpdateRange(0, frameSize);
      field.needsUpdate = true;
    }
  }

  return {
    group,
    setPixelRatio(dpr) { material.uniforms.uDpr.value = dpr; },
    frame(dt, theme) {
      elapsed = (elapsed + dt) % duration;
      const sample = elapsed / SAMPLE_INTERVAL;
      const index = Math.min(data.frames - 2, Math.floor(sample));
      if (index !== lastIndex) {
        writeFrame(index, position, normal);
        writeFrame(index + 1, nextPosition, nextNormal);
        lastIndex = index;
      }
      material.uniforms.uMix.value = sample - index;
      material.uniforms.uTheme.value = theme;
    },
  };
}
