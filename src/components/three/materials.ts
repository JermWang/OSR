// Rarity material system — rim/flow/foil-sweep shader injection and PBR
// re-theming, ported from the original build's onBeforeCompile pipeline.

import * as THREE from 'three';

export interface RimUniforms {
  uRimColor: { value: THREE.Color };
  uRimPower: { value: number };
  uRimIntensity: { value: number };
  uFlow: { value: number };
  uFlowColor: { value: THREE.Color };
  uPulseAmp: { value: number };
  uPulseSpeed: { value: number };
  uSweep: { value: number };
  uTime: { value: number };
}

export interface RimOpts {
  color: string;
  rimPower: number;
  rimIntensity: number;
  flow?: number;
  flowColor?: string;
  pulseAmp?: number;
  pulseSpeed?: number;
  sweep?: number;
  tierKey: string;
}

type Standard = THREE.MeshStandardMaterial;

export function applyRarityRim(material: Standard, opts: RimOpts): RimUniforms | null {
  if (opts.rimIntensity <= 0 && !opts.flow && !opts.sweep) return null;

  const uniforms: RimUniforms = {
    uRimColor: { value: new THREE.Color(opts.color) },
    uRimPower: { value: opts.rimPower },
    uRimIntensity: { value: opts.rimIntensity },
    uFlow: { value: opts.flow ?? 0 },
    uFlowColor: { value: new THREE.Color(opts.flowColor ?? opts.color) },
    uPulseAmp: { value: opts.pulseAmp ?? 0.15 },
    uPulseSpeed: { value: opts.pulseSpeed ?? 1.6 },
    uSweep: { value: opts.sweep ?? 0 },
    uTime: { value: 0 },
  };
  material.userData.rimUniforms = uniforms;
  material.toneMapped = false;
  material.customProgramCacheKey = () => 'rarityRim:' + opts.tierKey;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRarWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vRarWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uRimColor, uFlowColor;
uniform float uRimPower, uRimIntensity, uFlow, uTime, uPulseAmp, uPulseSpeed, uSweep;
varying vec3 vRarWorld;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 V = normalize( vViewPosition );
  float rim = pow( 1.0 - clamp( dot( normalize( vNormal ), V ), 0.0, 1.0 ), uRimPower );
  float pulse = ( 1.0 - uPulseAmp ) + uPulseAmp * sin( uTime * uPulseSpeed );
  totalEmissiveRadiance += uRimColor * rim * uRimIntensity * pulse;
  if ( uFlow > 0.0 ) {
    float band = abs( sin( vRarWorld.y * 3.0 - uTime * 2.0 ) );
    band = smoothstep( 0.55, 1.0, band ) * uFlow;
    totalEmissiveRadiance += uFlowColor * band;
  }
  if ( uSweep > 0.0 ) {
    float s = abs( fract( vRarWorld.y * 0.22 - uTime * 0.10 ) - 0.5 );
    float foil = smoothstep( 0.06, 0.0, s );
    totalEmissiveRadiance += uRimColor * foil * uSweep;
  }
}`
      );
  };
  material.needsUpdate = true;
  return uniforms;
}

const EMISSIVE_NAME = /emission|emissive|flame|beacon|lamp|glow|accent/i;

export interface RarityMatOpts {
  color: string;
  glow: number;
  metal: number;
  rough: number;
  bodyTint?: number;
  bodyEmissive?: number;
  finish?: number;
}

export function applyRarityToMaterial(mat: Standard, opts: RarityMatOpts) {
  const Q = new THREE.Color(opts.color);
  const bodyTint = opts.bodyTint ?? 0;
  const bodyEmissive = opts.bodyEmissive ?? 0.14;
  const emissiveSum = mat.emissive ? mat.emissive.r + mat.emissive.g + mat.emissive.b : 0;

  if (EMISSIVE_NAME.test(mat.name || '') || emissiveSum > 0.05) {
    if (mat.emissive) mat.emissive.copy(Q);
    else mat.emissive = Q.clone();
    mat.emissiveIntensity = opts.glow;
    if (opts.glow > 0 && mat.color) mat.color.copy(Q);
    mat.toneMapped = false;
  } else {
    const e = opts.finish ?? bodyTint;
    mat.metalness = Math.min(0.72, (mat.metalness ?? 0.4) + 0.5 * opts.metal + 0.3 * e);
    mat.roughness = Math.min(0.95, Math.max(0.35, (mat.roughness ?? 0.7) - 0.5 * opts.rough - 0.3 * e));
    if (bodyTint > 0 && mat.color) {
      mat.color.lerp(Q, Math.min(0.82, bodyTint));
      const eI = e * bodyEmissive;
      if (eI > 0) {
        if (mat.emissive) mat.emissive.copy(Q);
        else mat.emissive = Q.clone();
        mat.emissiveIntensity = eI;
        mat.toneMapped = false;
      }
    }
  }
  mat.needsUpdate = true;
}

import { levelTheme, type LevelTheme } from './fx';

export function applyLevelEra(mat: Standard, theme: LevelTheme) {
  mat.metalness = theme.metal;
  mat.roughness = theme.rough;
  if (theme.pigmentTint > 0 && mat.color) {
    mat.color.lerp(new THREE.Color(theme.pigment), theme.pigmentTint);
  }
  if (theme.emissive > 0) {
    const c = new THREE.Color(theme.pigment);
    if (mat.emissive) mat.emissive.lerp(c, 0.7);
    else mat.emissive = c.clone();
    mat.emissiveIntensity = theme.emissive;
    mat.toneMapped = false;
  }
  mat.needsUpdate = true;
}

export { levelTheme };
