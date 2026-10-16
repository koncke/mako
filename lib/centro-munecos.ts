// =============================================================================
// Los muñequitos del Centro: de qué están hechos, cuál le toca a cada chat y cuál eligió Martín (15/10/2026)
// =============================================================================
// Martín: «Crea más diseños variados de las figuras tipo trabajadores... Con diferentes caras, etc... Y que si le
// doy click pueda elegir cambiar a otro». Un muñeco son cuatro piezas —cuerpo, color, cara y accesorio— y el
// selector (app/admin/operaciones/ElegirMuneco.tsx) cambia de a una, como el armador de Notion Faces.
//
// ⚠️ LOS OJOS NO SON UNA PIEZA: dicen el estado del chat (despierto, trabajando, cansado, dormido), así que la «cara»
// que se elige es la boca y las mejillas, y lo demás es el accesorio. Si los ojos se eligieran, el muñeco dejaría de
// contar cómo está su chat.
// ⚠️ LO ELEGIDO SE GUARDA POR NOMBRE (normalizado), no por sesión: el Centro une las tres cuentas por nombre, así que el
// muñeco que eligió para «CRM» es el mismo en las tres. Vive en app_settings del workspace de la plataforma
// (`CLAVE_MUNECOS`), y lo que no se eligió sale del nombre (`aspectoDe`), igual en el server y en el navegador.
// ⚠️ SIN `server-only`: lo usan las pantallas, el server y los tests.

export const FORMAS = ['circulo', 'cuadrado', 'hexagono', 'triangulo', 'frijol', 'gota', 'pildora'] as const;
export type Forma = (typeof FORMAS)[number];
/** La paleta categórica de la casa (app/globals.css). Pasteles: el ojo oscuro se lee sobre todos. `--grafo-funnel`
 *  queda afuera a propósito: al lado de `--grafo-panorama` son dos verdes que no se distinguen en 38 px. */
export const COLORES = [
  '--grafo-documentos', '--grafo-panorama', '--grafo-oferta', '--grafo-cliente', '--grafo-productos',
  '--grafo-entregables', '--grafo-avatares', '--grafo-razones', '--grafo-voz',
] as const;
export type Color = (typeof COLORES)[number];
export const CARAS = ['sonrisa', 'risa', 'dientes', 'tranquila', 'asombro', 'lengua'] as const;
export type CaraMuneco = (typeof CARAS)[number];
export const ACCESORIOS = ['ninguno', 'antena', 'brote', 'lentes', 'auriculares', 'mono', 'gorro'] as const;
export type Accesorio = (typeof ACCESORIOS)[number];

export type Aspecto = { forma: Forma; color: Color; cara: CaraMuneco; accesorio: Accesorio };
export type MunecosElegidos = Record<string, Aspecto>;

export const ROTULO_FORMA: Record<Forma, string> = {
  circulo: 'Círculo', cuadrado: 'Cuadrado', hexagono: 'Hexágono', triangulo: 'Triángulo', frijol: 'Frijol', gota: 'Gota', pildora: 'Píldora',
};
export const ROTULO_CARA: Record<CaraMuneco, string> = {
  sonrisa: 'Sonrisa', risa: 'Risa', dientes: 'Dientes', tranquila: 'Tranquila', asombro: 'Asombro', lengua: 'Lengua',
};
export const ROTULO_ACCESORIO: Record<Accesorio, string> = {
  ninguno: 'Ninguno', antena: 'Antena', brote: 'Brote', lentes: 'Lentes', auriculares: 'Auriculares', mono: 'Moño', gorro: 'Gorro',
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
 * («CRM › Lead Detail») es de la familia de su jefe: mismo cuerpo y color—; el jefe lleva su cara y su accesorio
 * fijos (un área renombrada, como Chatbot → Automations, es el mismo empleado), y un sub-chat los saca de su nombre
 * entero, para que se distinga del jefe.
 */
const EQUIPO: Array<[string, Forma, Color, CaraMuneco, Accesorio]> = [
  ['estrategia', 'circulo', '--grafo-avatares', 'sonrisa', 'lentes'],
  ['centro de operaciones', 'cuadrado', '--grafo-documentos', 'tranquila', 'auriculares'],
  ['crm', 'hexagono', '--grafo-oferta', 'risa', 'ninguno'],
  ['automations', 'cuadrado', '--grafo-panorama', 'dientes', 'antena'],
  ['chatbot', 'cuadrado', '--grafo-panorama', 'dientes', 'antena'],
  ['video editor', 'triangulo', '--grafo-razones', 'asombro', 'gorro'],
  ['image editor', 'triangulo', '--grafo-entregables', 'lengua', 'brote'],
  ['landing', 'frijol', '--grafo-productos', 'sonrisa', 'mono'],
  ['web generator', 'frijol', '--grafo-productos', 'sonrisa', 'mono'],
  ['graphics', 'hexagono', '--grafo-cliente', 'tranquila', 'lentes'],
  ['dashboard', 'hexagono', '--grafo-cliente', 'tranquila', 'lentes'],
  ['mako mobile', 'circulo', '--grafo-documentos', 'risa', 'auriculares'],
  ['offer', 'circulo', '--grafo-voz', 'dientes', 'mono'],
  ['mako pricing', 'frijol', '--grafo-voz', 'asombro', 'antena'],
  ['onboarding', 'circulo', '--grafo-entregables', 'lengua', 'gorro'],
  ['ads', 'triangulo', '--grafo-oferta', 'sonrisa', 'brote'],
  ['plan', 'cuadrado', '--grafo-razones', 'tranquila', 'ninguno'],
  ['integracion', 'hexagono', '--grafo-avatares', 'risa', 'gorro'],
  ['pagos', 'hexagono', '--grafo-avatares', 'risa', 'gorro'],
  ['seguridad', 'frijol', '--grafo-cliente', 'tranquila', 'auriculares'],
  ['customer success', 'circulo', '--grafo-razones', 'sonrisa', 'brote'],
];

/** Un hash chico y estable (FNV-1a): el mismo título da siempre el mismo muñeco, en el server y en el navegador. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** El muñeco de un chat: lo que eligió Martín para ese nombre, o el que le toca por su nombre. */
export function aspectoDe(titulo: string, elegido?: Aspecto | null): Aspecto {
  if (elegido) return elegido;
  const t = normal(titulo) || '?';
  const h = hash(t);
  const cara = CARAS[(h >>> 7) % CARAS.length];
  const accesorio = ACCESORIOS[(h >>> 11) % ACCESORIOS.length];
  const fijo = EQUIPO.find(([pre]) => t.startsWith(pre));
  const esSub = /[›>]/.test(titulo);
  if (fijo) return { forma: fijo[1], color: fijo[2], cara: esSub ? cara : fijo[3], accesorio: esSub ? accesorio : fijo[4] };
  return { forma: FORMAS[h % FORMAS.length], color: COLORES[Math.floor(h / FORMAS.length) % COLORES.length], cara, accesorio };
}

/** Lo elegido para un nombre, si lo hay. */
export const elegidoPara = (munecos: Readonly<MunecosElegidos> | null | undefined, titulo: string): Aspecto | null =>
  munecos?.[claveDeMuneco(titulo)] ?? null;

const de = <T extends string>(lista: readonly T[], v: unknown): T | null => (typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null);

/** Un aspecto que vino de afuera (el navegador o la base): con las cuatro piezas válidas, o null. */
export function sanearAspecto(v: unknown): Aspecto | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const forma = de(FORMAS, o.forma), color = de(COLORES, o.color), cara = de(CARAS, o.cara), accesorio = de(ACCESORIOS, o.accesorio);
  return forma && color && cara && accesorio ? { forma, color, cara, accesorio } : null;
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
  return { forma: uno(FORMAS), color: uno(COLORES), cara: uno(CARAS), accesorio: uno(ACCESORIOS) };
}
