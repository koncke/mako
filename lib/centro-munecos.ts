// =============================================================================
// Los muñequitos del Centro: de qué están hechos, cuál le toca a cada chat y cuál eligió Martín (15/10/2026)
// =============================================================================
// Martín: «Crea más diseños variados de las figuras tipo trabajadores... Con diferentes caras, etc... Y que si le
// doy click pueda elegir cambiar a otro». Un muñeco son tres piezas —cuerpo, color y cara— y el selector
// (app/admin/operaciones/ElegirMuneco.tsx) cambia de a una, como el armador de Notion Faces.
// ⚠️ SIN ACCESORIOS desde el 16/10/2026 (Martín, mirándolo en producción: «Elimina los accesorios de los personajes»).
// Lo guardado antes con su accesorio se sigue leyendo: el accesorio se ignora (`sanearAspecto`).
//
// ⚠️ LOS OJOS NO SON UNA PIEZA: dicen el estado del chat (despierto, trabajando, cansado, dormido), así que la «cara»
// que se elige es la boca y las mejillas. Si los ojos se eligieran, el muñeco dejaría de
// contar cómo está su chat.
// ⚠️ LO ELEGIDO SE GUARDA POR NOMBRE (normalizado), no por sesión: el Centro une las tres cuentas por nombre, así que el
// muñeco que eligió para «CRM» es el mismo en las tres. Vive en app_settings del workspace de la plataforma
// (`CLAVE_MUNECOS`), y lo que no se eligió sale del nombre (`aspectoDe`), igual en el server y en el navegador.
// ⚠️ SIN `server-only`: lo usan las pantallas, el server y los tests.

import type { IdAsesor } from './asesores/catalogo';

// LA CRIATURA (17/10/2026, la F del feedback de Martín: «"Su muñeco" pasa a llamarse "Criatura". Tiene 9 cuerpos, 9 colores
// y 9 caras»). Las piezas nuevas van AL FINAL de cada lista: el que no se eligió sale de su nombre con las de antes
// (`DE_SIEMPRE`), así ningún chat cambia de cara por haber más opciones.
export const FORMAS = ['circulo', 'cuadrado', 'hexagono', 'triangulo', 'frijol', 'gota', 'pildora', 'nube', 'diamante'] as const;
/** LA ESTRELLA DE MAKO (17/10/2026, Martín: «cerebro tiene la criatura de MaKo estrella, solo ese»): la chispa de la marca
 *  como cuerpo, en su dorado. Va FUERA de `FORMAS` y de `COLORES` a propósito: no se elige ni sale en un sorteo
 *  (`sanearAspecto` la rechaza), así que ningún otro chat puede tenerla. La dibujan el Cerebro y quien muestre a MaKo
 *  (el onboarding y la barra la piden con `ASPECTO_MAKO`). */
export const FORMA_MAKO = 'estrella';
export const COLOR_MAKO = '--mako';
export type Forma = (typeof FORMAS)[number] | typeof FORMA_MAKO;
/** La paleta categórica de la casa (app/globals.css). Pasteles: el ojo oscuro se lee sobre todos. `--grafo-funnel`
 *  queda afuera a propósito: al lado de `--grafo-panorama` son dos verdes que no se distinguen en 38 px. */
export const COLORES = [
  '--grafo-documentos', '--grafo-panorama', '--grafo-oferta', '--grafo-cliente', '--grafo-productos',
  '--grafo-entregables', '--grafo-avatares', '--grafo-razones', '--grafo-voz',
] as const;
export type Color = (typeof COLORES)[number] | typeof COLOR_MAKO;
export const CARAS = ['sonrisa', 'risa', 'dientes', 'tranquila', 'asombro', 'lengua', 'beso', 'bigote', 'gato'] as const;
/** Las piezas con las que se sortea el que no se eligió: las de antes del 17/10/2026 (ver arriba). */
const DE_SIEMPRE = { formas: FORMAS.slice(0, 7), caras: CARAS.slice(0, 6) } as const;
export type CaraMuneco = (typeof CARAS)[number];
/** `retrato`: un referente (lib/asesores/catalogo.ts): se dibuja su retrato (app/admin/operaciones/Retratos.tsx) en vez del cuerpo y
 *  la cara. No se elige con las piezas ni se guarda acá: `sanearAspecto` no lo deja pasar. */
export type Aspecto = { forma: Forma; color: Color; cara: CaraMuneco; retrato?: IdAsesor };
export type MunecosElegidos = Record<string, Aspecto>;
/** La criatura de MaKo: la estrella dorada, sonriendo. */
export const ASPECTO_MAKO: Aspecto = { forma: FORMA_MAKO, color: COLOR_MAKO, cara: 'sonrisa' };
/** La criatura de un chat con un referente al frente: su caricatura. */
export const aspectoDeReferente = (retrato: IdAsesor): Aspecto => ({ forma: 'circulo', color: '--grafo-voz', cara: 'sonrisa', retrato });

export const ROTULO_FORMA: Record<Forma, string> = {
  circulo: 'Círculo', cuadrado: 'Cuadrado', hexagono: 'Hexágono', triangulo: 'Triángulo', frijol: 'Frijol', gota: 'Gota', pildora: 'Píldora',
  nube: 'Nube', diamante: 'Diamante', estrella: 'Estrella de MaKo',
};

/** El Cerebro (el orquestador; «Estrategia 3 cuentas» es su nombre de antes, lib/centro-chats.ts → esCerebro) es MaKo. */
const DEL_CEREBRO = new Set(['cerebro', 'estrategia 3 cuentas', 'estrategia']);
export const esCriaturaDeMako = (titulo: string) => DEL_CEREBRO.has(normalDe(titulo));
function normalDe(s: string) { return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
export const ROTULO_CARA: Record<CaraMuneco, string> = {
  sonrisa: 'Sonrisa', risa: 'Risa', dientes: 'Dientes', tranquila: 'Tranquila', asombro: 'Asombro', lengua: 'Lengua',
  beso: 'Beso', bigote: 'Bigote', gato: 'Gato',
};

/** Dónde se guarda lo elegido: app_settings del workspace de la plataforma. */
export const CLAVE_MUNECOS = 'operaciones.munecos';
/** Un tope de cuántos nombres se guardan: la lista de chats crece, y un JSON que crece sin tope es un problema mañana. */
export const TOPE_MUNECOS = 400;

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** La clave de un nombre para lo elegido (la misma normalización que une los chats). */
export const claveDeMuneco = (titulo: string) => normal(titulo).slice(0, 120);

/**
 * El equipo de siempre, con su cuerpo y su color FIJOS para que no se repitan entre ellos (con un hash, dos de las
 * áreas principales pueden salir iguales). Se busca por el comienzo del título normalizado —así un sub-chat
 * («CRM › Lead Detail») es de la familia de su jefe: mismo cuerpo y color—; el jefe lleva su cara fija (un área
 * renombrada, como Chatbot → Automations, es el mismo empleado), y un sub-chat la saca de su nombre entero, para que
 * se distinga del jefe.
 */
const EQUIPO: Array<[string, Forma, Color, CaraMuneco]> = [
  ['estrategia', 'circulo', '--grafo-avatares', 'sonrisa'],
  // El Cerebro es el orquestador que se llamaba «Estrategia 3 cuentas»: el mismo empleado (lib/centro-chats.ts → CEREBRO).
  ['cerebro', 'circulo', '--grafo-avatares', 'sonrisa'],
  ['centro de operaciones', 'cuadrado', '--grafo-documentos', 'tranquila'],
  ['crm', 'hexagono', '--grafo-oferta', 'risa'],
  ['automations', 'cuadrado', '--grafo-panorama', 'dientes'],
  ['chatbot', 'cuadrado', '--grafo-panorama', 'dientes'],
  ['video editor', 'triangulo', '--grafo-razones', 'asombro'],
  ['image editor', 'triangulo', '--grafo-entregables', 'lengua'],
  ['landing', 'frijol', '--grafo-productos', 'sonrisa'],
  ['web generator', 'frijol', '--grafo-productos', 'sonrisa'],
  ['graphics', 'hexagono', '--grafo-cliente', 'tranquila'],
  ['dashboard', 'hexagono', '--grafo-cliente', 'tranquila'],
  ['mako mobile', 'circulo', '--grafo-documentos', 'risa'],
  ['offer', 'circulo', '--grafo-voz', 'dientes'],
  ['mako pricing', 'frijol', '--grafo-voz', 'asombro'],
  ['onboarding', 'circulo', '--grafo-entregables', 'lengua'],
  ['ads', 'triangulo', '--grafo-oferta', 'sonrisa'],
  ['plan', 'cuadrado', '--grafo-razones', 'tranquila'],
  ['integracion', 'hexagono', '--grafo-avatares', 'risa'],
  ['pagos', 'hexagono', '--grafo-avatares', 'risa'],
  ['seguridad', 'frijol', '--grafo-cliente', 'tranquila'],
  ['customer success', 'circulo', '--grafo-razones', 'sonrisa'],
  // El jefe del chat con MaKo (/second-brain, 16/10/2026): sus sub-chats («Second Brain › Precios») heredan su cuerpo y
  // su color, como los del Centro. La gota es la única forma que no tenía ningún jefe.
  ['second brain', 'gota', '--grafo-documentos', 'sonrisa'],
];

/** Un hash chico y estable (FNV-1a): el mismo título da siempre el mismo muñeco, en el server y en el navegador. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** El muñeco de un chat: lo que eligió Martín para ese nombre, o el que le toca por su nombre. */
export function aspectoDe(titulo: string, elegido?: Aspecto | null): Aspecto {
  // El Cerebro es SIEMPRE la estrella de MaKo, aunque se le haya elegido otra antes (Martín: «solo ese»).
  if (esCriaturaDeMako(titulo)) return ASPECTO_MAKO;
  if (elegido) return elegido;
  const t = normal(titulo) || '?';
  const h = hash(t);
  const cara = DE_SIEMPRE.caras[(h >>> 7) % DE_SIEMPRE.caras.length];
  const fijo = EQUIPO.find(([pre]) => t.startsWith(pre));
  const esSub = /[›>]/.test(titulo);
  if (fijo) return { forma: fijo[1], color: fijo[2], cara: esSub ? cara : fijo[3] };
  return sorteada(h, cara);
}

/** La del sorteo: cuerpo, color y cara salen del hash (las piezas de siempre, `DE_SIEMPRE`). */
function sorteada(h: number, cara: CaraMuneco = DE_SIEMPRE.caras[(h >>> 7) % DE_SIEMPRE.caras.length]): Aspecto {
  const { formas } = DE_SIEMPRE;
  return { forma: formas[h % formas.length], color: COLORES[Math.floor(h / formas.length) % COLORES.length], cara };
}

/**
 * LA CRIATURA DE UN CHAT DEL CLIENTE (22/10/2026, Martín, con la captura del ws1: «todas las criaturas son el círculo... No hay
 * randomizer»). La lista del cliente sacaba la criatura del NOMBRE con la familia del equipo (`EQUIPO`), y ahí las de Offer y el
 * Onboarding son círculos: «Mi oferta», «Sprint de Diseño…» y «Onboarding», todos círculos de colores. Y tres «Chat de antes»
 * con el mismo nombre eran la misma criatura. Ahora sale del MISMO sorteo que el super admin, con la clave del chat (`o13`,
 * `a23`, `s8`): cada chat la suya, la misma al recargar y aunque se renombre. El Cerebro no pasa por acá: es la estrella.
 */
export const aspectoDeChat = (clave: string): Aspecto => sorteada(hash(`chat:${clave}`));

/** Lo elegido para un nombre, si lo hay. */
export const elegidoPara = (munecos: Readonly<MunecosElegidos> | null | undefined, titulo: string): Aspecto | null =>
  munecos?.[claveDeMuneco(titulo)] ?? null;

const de = <T extends string>(lista: readonly T[], v: unknown): T | null => (typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null);

/** Un aspecto que vino de afuera (el navegador o la base): con las tres piezas válidas, o null. Uno guardado antes del
 *  16/10/2026 trae además su `accesorio`: se ignora, y el muñeco se sigue viendo como lo eligió (sin él). */
export function sanearAspecto(v: unknown): Aspecto | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const forma = de(FORMAS, o.forma), color = de(COLORES, o.color), cara = de(CARAS, o.cara);
  return forma && color && cara ? { forma, color, cara } : null;
}

/** El mapa guardado: sólo nombres con texto y aspectos válidos, hasta el tope. Lo que no sirve se tira, no rompe. */
export function sanearMunecos(v: unknown): MunecosElegidos {
  const out: MunecosElegidos = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, a] of Object.entries(v as Record<string, unknown>).slice(0, TOPE_MUNECOS)) {
    const clave = claveDeMuneco(k);
    const aspecto = sanearAspecto(a);
    if (clave && aspecto) out[clave] = aspecto;
  }
  return out;
}

/** Uno al azar (el dado del selector). `azar` recibe un número en [0, 1): en el navegador es Math.random. */
export function aspectoAlAzar(azar: () => number): Aspecto {
  const uno = <T,>(xs: readonly T[]) => xs[Math.floor(azar() * xs.length) % xs.length];
  return { forma: uno(FORMAS), color: uno(COLORES), cara: uno(CARAS) };
}
