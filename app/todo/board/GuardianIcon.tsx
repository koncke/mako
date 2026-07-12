'use client';

// GuardianIcon — el "Perro Guardián MaKo": un escudo con la silueta del perro
// (el logo de MaKo), teñido con los colores de la marca (var(--accent)).
// Basado en el SVG que pasó Martín, adaptado a los tokens de MaKo.

export function GuardianIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Perro Guardián MaKo" role="img">
      {/* escudo */}
      <path
        d="M256 26 L462 92 V250 C462 366 386 452 256 494 C126 452 50 366 50 250 V92 Z"
        fill="var(--accent)" fillOpacity="0.12" stroke="var(--accent)" strokeWidth="30" strokeLinejoin="round"
      />
      {/* perro (silueta del logo MaKo) */}
      <g stroke="var(--accent)" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* cabeza / oreja (el "loop") baja a la pata */}
        <path d="M196 150 C168 150 150 170 150 200 C150 236 168 300 150 360" />
        {/* lomo y hocico hacia el otro apoyo */}
        <path d="M196 150 C232 150 236 176 258 194 C278 210 300 200 320 208 C346 218 350 254 320 268 C300 278 288 286 300 312 L352 360" />
      </g>
      {/* ojo/detalle (triángulo) en color de acento suave */}
      <path d="M196 154 L214 154 L204 210 Z" fill="var(--accent)" fillOpacity="0.55" />
    </svg>
  );
}
