'use client';

// GuardianIcon — el "Perro Guardián MaKo": un escudo con la cabeza del perro de
// frente (orejas en punta), teñido con los colores de la marca (var(--accent)).
// Silueta rellena para que se lea bien también a tamaño chico.
// NOTA: es una aproximación del logo que pasó Martín; para calcarlo exacto hace
// falta el archivo .svg original.

export function GuardianIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Perro Guardián MaKo" role="img">
      {/* escudo */}
      <path
        d="M256 30 L456 94 V248 C456 360 384 444 256 486 C128 444 56 360 56 248 V94 Z"
        fill="var(--accent)" fillOpacity="0.10" stroke="var(--accent)" strokeWidth="26" strokeLinejoin="round"
      />
      {/* cabeza del perro (de frente) + orejas en punta */}
      <g fill="var(--accent)">
        <path d="M198 148 L234 212 L200 216 Z" />
        <path d="M314 148 L278 212 L312 216 Z" />
        <path d="M256 176 C210 176 187 214 196 258 C202 294 212 318 238 340 L256 358 L274 340 C300 318 310 294 316 258 C325 214 302 176 256 176 Z" />
      </g>
      {/* ojos + nariz (recortados con el color de fondo) */}
      <circle cx="228" cy="250" r="13" fill="var(--surface)" />
      <circle cx="284" cy="250" r="13" fill="var(--surface)" />
      <path d="M256 318 l-15 -20 h30 Z" fill="var(--surface)" />
    </svg>
  );
}
