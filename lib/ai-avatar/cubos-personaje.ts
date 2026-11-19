// =============================================================================
// cubos-personaje — el personaje en cubos de cada persona (módulo PURO, sin React ni servidor)
// =============================================================================
// El personaje es el de la galería (C:/dev/artefactos-animaciones/reels/kit/toma.js, el «Martín en cubos» que Martín eligió
// el 18/11: memoria personaje-martin-en-cubos), con su paleta y su peinado como DATOS. Cada parte se elige de una lista
// CERRADA (nunca un color suelto): así la IA que lee la foto no puede inventar un color raro, y un personaje guardado se
// dibuja igual siempre. `PERSONAJE_MARTIN` es el de la galería tal cual: con él, la plantilla da el mismo video.
//
// Lo usan la pantalla (las muestras), la action que lee la foto (`normalizarPersonaje` sobre lo que contesta la IA) y la
// plantilla (`resolverPersonaje` → los colores que lee public/avatar-cubos/kit/toma.js).
// =============================================================================

type Opcion = { clave: string; nombre: string };

export const PIELES = [
  { clave: 'muy-clara', nombre: 'Muy clara', skin: '#f3c6aa', skinD: '#dba68a' },
  { clave: 'clara', nombre: 'Clara', skin: '#e8a682', skinD: '#d08a66' },
  { clave: 'media', nombre: 'Media', skin: '#c98a5e', skinD: '#ad7048' },
  { clave: 'morena', nombre: 'Morena', skin: '#a66a42', skinD: '#8a5432' },
  { clave: 'oscura', nombre: 'Oscura', skin: '#7a4a2c', skinD: '#603820' },
  { clave: 'muy-oscura', nombre: 'Muy oscura', skin: '#56331e', skinD: '#432716' },
] as const;

export const PELOS = [
  { clave: 'cobrizo', nombre: 'Cobrizo', hair: '#b4471a', hair2: '#d0622a', hairD: '#8a3212', brow: '#3a1d10' },
  { clave: 'negro', nombre: 'Negro', hair: '#1c1714', hair2: '#2c241f', hairD: '#100c0a', brow: '#14100c' },
  { clave: 'castano-oscuro', nombre: 'Castaño oscuro', hair: '#3d2616', hair2: '#523421', hairD: '#2a190e', brow: '#24160c' },
  { clave: 'castano', nombre: 'Castaño', hair: '#6b4325', hair2: '#845431', hairD: '#4e2f18', brow: '#3b2614' },
  { clave: 'rubio', nombre: 'Rubio', hair: '#d6ac5c', hair2: '#e8c47a', hairD: '#ad853c', brow: '#8a6a35' },
  { clave: 'canoso', nombre: 'Canoso', hair: '#b8b5ae', hair2: '#d3d0ca', hairD: '#8e8b85', brow: '#6e6b66' },
] as const;

export const PEINADOS = [
  { clave: 'rulos', nombre: 'Rulos' },
  { clave: 'corto', nombre: 'Corto' },
  { clave: 'largo', nombre: 'Largo' },
  { clave: 'rapado', nombre: 'Rapado' },
] as const;

export const ROPAS = [
  { clave: 'negra', nombre: 'Negra', tee: '#1c1c23', teeL: '#2d2d36' },
  { clave: 'blanca', nombre: 'Blanca', tee: '#e4e4ea', teeL: '#f4f4f7' },
  { clave: 'gris', nombre: 'Gris', tee: '#5a5f66', teeL: '#6c7178' },
  { clave: 'azul', nombre: 'Azul', tee: '#1f3a6b', teeL: '#2b4a85' },
  { clave: 'verde', nombre: 'Verde', tee: '#2f5d46', teeL: '#3c7057' },
  { clave: 'roja', nombre: 'Roja', tee: '#8e2430', teeL: '#a3303d' },
  { clave: 'beige', nombre: 'Beige', tee: '#c4ad88', teeL: '#d4c09e' },
] as const;

export const OJOS = [
  { clave: 'marrones', nombre: 'Marrones', iris: '#4a2a14' },
  { clave: 'oscuros', nombre: 'Oscuros', iris: '#22150b' },
  { clave: 'miel', nombre: 'Miel', iris: '#86581f' },
  { clave: 'verdes', nombre: 'Verdes', iris: '#4b6b38' },
  { clave: 'azules', nombre: 'Azules', iris: '#3d6c9c' },
] as const;

export type Personaje = {
  piel: (typeof PIELES)[number]['clave'];
  pelo: (typeof PELOS)[number]['clave'];
  peinado: (typeof PEINADOS)[number]['clave'];
  ropa: (typeof ROPAS)[number]['clave'];
  ojos: (typeof OJOS)[number]['clave'];
  anteojos: boolean;
  barba: boolean;
};

/** El Martín en cubos de la galería, tal cual (toma.js: piel e8a682, pelo b4471a, ropa 1c1c23, iris 4a2a14). */
export const PERSONAJE_MARTIN: Personaje = Object.freeze({
  piel: 'clara', pelo: 'cobrizo', peinado: 'rulos', ropa: 'negra', ojos: 'marrones', anteojos: false, barba: false,
});

/** Las partes que se eligen, en el orden de la pantalla. */
export const PARTES_PERSONAJE = [
  { clave: 'piel', nombre: 'Piel', opciones: PIELES as readonly Opcion[] },
  { clave: 'pelo', nombre: 'Pelo', opciones: PELOS as readonly Opcion[] },
  { clave: 'peinado', nombre: 'Peinado', opciones: PEINADOS as readonly Opcion[] },
  { clave: 'ropa', nombre: 'Ropa', opciones: ROPAS as readonly Opcion[] },
  { clave: 'ojos', nombre: 'Ojos', opciones: OJOS as readonly Opcion[] },
] as const;

const de = <T extends Opcion>(lista: readonly T[], v: unknown, defecto: T['clave']): T['clave'] => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (lista.find((o) => o.clave === s) ?? lista.find((o) => o.clave === defecto)!).clave;
};

/** Lo que llegue (la IA, la base, la pantalla) pasado a un personaje válido; lo que no calza toma el valor de Martín. */
export function normalizarPersonaje(x: unknown): Personaje {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const d = PERSONAJE_MARTIN;
  return {
    piel: de(PIELES, o.piel, d.piel) as Personaje['piel'],
    pelo: de(PELOS, o.pelo, d.pelo) as Personaje['pelo'],
    peinado: de(PEINADOS, o.peinado, d.peinado) as Personaje['peinado'],
    ropa: de(ROPAS, o.ropa, d.ropa) as Personaje['ropa'],
    ojos: de(OJOS, o.ojos, d.ojos) as Personaje['ojos'],
    anteojos: o.anteojos === true,
    barba: o.barba === true,
  };
}

/** Los colores que lee la plantilla (public/avatar-cubos/kit/toma.js → `armarChico`). */
export type PersonajeResuelto = {
  skin: string; skinD: string; hair: string; hair2: string; hairD: string; brow: string; tee: string; teeL: string; iris: string;
  peinado: Personaje['peinado']; anteojos: boolean; barba: boolean;
};

export function resolverPersonaje(p: Personaje): PersonajeResuelto {
  const n = normalizarPersonaje(p);
  const piel = PIELES.find((x) => x.clave === n.piel)!, pelo = PELOS.find((x) => x.clave === n.pelo)!;
  const rem = ROPAS.find((x) => x.clave === n.ropa)!, ojo = OJOS.find((x) => x.clave === n.ojos)!;
  return {
    skin: piel.skin, skinD: piel.skinD, hair: pelo.hair, hair2: pelo.hair2, hairD: pelo.hairD, brow: pelo.brow,
    tee: rem.tee, teeL: rem.teeL, iris: ojo.iris, peinado: n.peinado, anteojos: n.anteojos, barba: n.barba,
  };
}

/** Lo que se le pide a la IA que mira la foto: sólo claves de las listas. */
export function pedidoDelPersonaje(): string {
  const l = (xs: readonly Opcion[]) => xs.map((o) => o.clave).join(' | ');
  return [
    'Mira la foto de la persona y elige cómo sería su personaje en cubos (estilo voxel, de juguete).',
    'Contesta SOLO un JSON con estas claves y uno de estos valores:',
    `"piel": ${l(PIELES)}`,
    `"pelo": ${l(PELOS)}`,
    `"peinado": ${l(PEINADOS)} (rapado = casi sin pelo o pelado)`,
    `"ropa": ${l(ROPAS)} (el color de su ropa de arriba)`,
    `"ojos": ${l(OJOS)}`,
    '"anteojos": true | false',
    '"barba": true | false',
  ].join('\n');
}
