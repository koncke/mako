// =============================================================================
// editor-video/presets-subtitulos — los estilos de subtítulos guardados de una marca
// =============================================================================
// Pedido de Leila (llamada del 30/10/2026): «presets guardados por marca o por cliente».
// Hoy cada video arranca con las plantillas de fábrica y el estilo de la marca se arma a
// mano otra vez. Un preset es ese estilo con nombre, guardado en el NEGOCIO (no en el
// navegador): lo ve todo el equipo, en cualquier computadora, y lo usan el editor, su
// chat y la API de MaKo.
//
// «Por marca o por cliente»: una agencia tiene un negocio por cliente en MaKo, así que
// cada cliente ya tiene los suyos; dentro de un negocio, `marca` es una etiqueta libre
// (la persona que edita para varias marcas los agrupa por ella).
//
// QUÉ ES un preset: la misma forma que una plantilla de subtítulos del editor
// (app/video-editor/_opencut/subtitles/estilos.ts, `PlantillaSubtitulo`): fuente, color,
// tamaño RELATIVO al lienzo, fondo, trazo, sombra, mayúsculas y karaoke. Relativo y no
// en píxeles: el mismo preset sirve en un video vertical y en uno horizontal (con un
// `fontSize` fijo, un subtítulo de 16:9 salía la mitad de grande en 9:16). Más las
// palabras clave: si se resaltan solas, su color y las palabras de la marca que se
// resaltan SIEMPRE («MaKo», el nombre del curso).
//
// DÓNDE: app_settings del negocio, una sola clave con la lista (`CLAVE_PRESETS`): son
// pocos y chicos, y así anda sin migración. Escribe lib/editor-video/presets-subtitulos-server.ts
// con compare-and-set.
//
// Puro y sin `server-only`, sin importar nada del motor (`_opencut/`): lo leen la ruta,
// la API, el editor y los tests (tests/video-editor-presets-subtitulos.test.ts). Lo
// que viene de afuera (el navegador, la API) se SANEA acá: nada se guarda sin pasar.

export const CLAVE_PRESETS = 'video_editor.presets_subtitulos';

export const TOPES_PRESETS = {
  presets: 40,
  nombre: 60,
  marca: 60,
  fuente: 60,
  siempre: 30,
  palabra: 40,
} as const;

export type FondoPreset = { color: string; radio: number; x: number; y: number };
export type EstiloPresetSubtitulos = {
  fuente: string;
  negrita: boolean;
  color: string;
  /** Multiplica el tamaño base del lienzo (1 = el de las plantillas). */
  escala?: number;
  espaciado?: number;
  fondo?: FondoPreset;
  trazo?: { color: string; grosor: number };
  mayusculas?: boolean;
  /** En minúsculas (la plantilla «Lima», 9/11/2026). Con las dos, gana mayúsculas, como en la plantilla. */
  minusculas?: boolean;
  sombra?: boolean;
  resaltado?: { modo: 'palabra' | 'frase'; color: string; noDichasOpacidad?: number };
};
export type ClavesPreset = {
  /** Las palabras clave se eligen solas al aplicar el preset y al generar subtítulos. */
  auto: boolean;
  color: string;
  /** Las de la marca: se resaltan cada vez que se dicen. */
  siempre: string[];
};
export type PresetSubtitulos = {
  id: string;
  nombre: string;
  /** La marca o el cliente (etiqueta libre). Null: del negocio entero. */
  marca: string | null;
  estilo: EstiloPresetSubtitulos;
  claves: ClavesPreset;
  actualizado: string;
};

/** El verde de las palabras clave del editor (params/extra/subtitulos.ts, DEFAULTS_CLAVES). Lo fija el test. */
export const COLOR_CLAVES_POR_DEFECTO = '#4ade80';

const HEX = /^#[0-9a-f]{6}$/i;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;
/** Un color de contenido: #RRGGBB (o rgba para el fondo, como las plantillas de fábrica). */
export function colorValido(v: unknown, conAlfa = false): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (HEX.test(t)) return t.toLowerCase();
  if (conAlfa && RGBA.test(t)) return t.replace(/\s+/g, ' ');
  return null;
}

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
};
const numero = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string };

/** El estilo, saneado. Rechaza con su motivo; nunca recorta un valor fuera de rango. */
export function sanearEstilo(raw: unknown): Resultado<EstiloPresetSubtitulos> {
  if (!raw || typeof raw !== 'object') return { ok: false, motivo: 'falta el estilo' };
  const r = raw as Record<string, unknown>;
  const fuente = texto(r.fuente, TOPES_PRESETS.fuente);
  if (!fuente) return { ok: false, motivo: 'falta la fuente' };
  const color = colorValido(r.color);
  if (!color) return { ok: false, motivo: 'el color de la letra no es #RRGGBB' };
  const estilo: EstiloPresetSubtitulos = { fuente, negrita: r.negrita === true, color };
  if (r.escala !== undefined) {
    const e = numero(r.escala, 0.3, 4);
    if (e === null) return { ok: false, motivo: 'el tamaño va de 0,3 a 4 veces el de siempre' };
    estilo.escala = Math.round(e * 100) / 100;
  }
  if (r.espaciado !== undefined) {
    const e = numero(r.espaciado, -20, 100);
    if (e === null) return { ok: false, motivo: 'el espaciado va de -20 a 100' };
    estilo.espaciado = Math.round(e);
  }
  if (r.fondo) {
    const f = r.fondo as Record<string, unknown>;
    const c = colorValido(f.color, true);
    const radio = numero(f.radio ?? 0, 0, 100);
    const x = numero(f.x ?? 0.35, 0, 2);
    const y = numero(f.y ?? 0.12, 0, 2);
    if (!c || radio === null || x === null || y === null) return { ok: false, motivo: 'un fondo con un color o un tamaño que no valen' };
    estilo.fondo = { color: c, radio: Math.round(radio), x, y };
  }
  if (r.trazo) {
    const t = r.trazo as Record<string, unknown>;
    const c = colorValido(t.color);
    const g = numero(t.grosor, 0, 100);
    if (!c || g === null) return { ok: false, motivo: 'un contorno con un color o un grosor que no valen' };
    estilo.trazo = { color: c, grosor: Math.round(g) };
  }
  if (r.mayusculas === true) estilo.mayusculas = true;
  else if (r.minusculas === true) estilo.minusculas = true;
  if (r.sombra === true) estilo.sombra = true;
  if (r.resaltado) {
    const s = r.resaltado as Record<string, unknown>;
    if (s.modo !== 'palabra' && s.modo !== 'frase') return { ok: false, motivo: 'el resaltado de la palabra que se dice es «palabra» o «frase»' };
    const c = colorValido(s.color);
    if (!c) return { ok: false, motivo: 'el color del resaltado no es #RRGGBB' };
    const o = s.noDichasOpacidad === undefined ? 100 : numero(s.noDichasOpacidad, 0, 100);
    if (o === null) return { ok: false, motivo: 'la opacidad de lo no dicho va de 0 a 100' };
    estilo.resaltado = { modo: s.modo, color: c, ...(o !== 100 ? { noDichasOpacidad: Math.round(o) } : {}) };
  }
  return { ok: true, valor: estilo };
}

/** Las palabras que la marca resalta siempre: sin repetir, sin vacías, con tope. */
export function sanearSiempre(v: unknown): Resultado<string[]> {
  if (v === undefined || v === null) return { ok: true, valor: [] };
  if (!Array.isArray(v)) return { ok: false, motivo: 'las palabras de la marca van en una lista' };
  const vistas = new Map<string, string>();
  for (const x of v) {
    const t = texto(x, TOPES_PRESETS.palabra);
    if (!t) continue;
    if (/\s/.test(t)) return { ok: false, motivo: `«${t.slice(0, 30)}» son varias palabras: va una por renglón` };
    const clave = t.toLowerCase();
    if (!vistas.has(clave)) vistas.set(clave, t);
  }
  if (vistas.size > TOPES_PRESETS.siempre) return { ok: false, motivo: `hasta ${TOPES_PRESETS.siempre} palabras de la marca` };
  return { ok: true, valor: [...vistas.values()] };
}

export function sanearClaves(raw: unknown): Resultado<ClavesPreset> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const color = r.color === undefined ? COLOR_CLAVES_POR_DEFECTO : colorValido(r.color);
  if (!color) return { ok: false, motivo: 'el color de las palabras clave no es #RRGGBB' };
  const siempre = sanearSiempre(r.siempre);
  if (!siempre.ok) return siempre;
  return { ok: true, valor: { auto: r.auto === true, color, siempre: siempre.valor } };
}

/** Un id corto y estable (el de un preset nuevo). */
export function nuevoIdPreset(azar: () => number = Math.random): string {
  return `p${Date.now().toString(36)}${Math.floor(azar() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

const ID_PRESET = /^p[0-9a-z]{4,20}$/;
export const esIdPreset = (v: unknown): v is string => typeof v === 'string' && ID_PRESET.test(v);

/** Un preset entero, saneado (lo que manda el editor o la API). */
export function sanearPreset(raw: unknown, { id, ahora }: { id: string; ahora: string }): Resultado<PresetSubtitulos> {
  if (!raw || typeof raw !== 'object') return { ok: false, motivo: 'falta el preset' };
  const r = raw as Record<string, unknown>;
  const nombre = texto(r.nombre, TOPES_PRESETS.nombre);
  if (!nombre) return { ok: false, motivo: `el nombre va de 1 a ${TOPES_PRESETS.nombre} letras` };
  let marca: string | null = null;
  if (r.marca !== undefined && r.marca !== null && r.marca !== '') {
    marca = texto(r.marca, TOPES_PRESETS.marca);
    if (!marca) return { ok: false, motivo: `la marca va hasta ${TOPES_PRESETS.marca} letras` };
  }
  const estilo = sanearEstilo(r.estilo);
  if (!estilo.ok) return estilo;
  const claves = sanearClaves(r.claves);
  if (!claves.ok) return claves;
  return { ok: true, valor: { id, nombre, marca, estilo: estilo.valor, claves: claves.valor, actualizado: ahora } };
}

/** La lista guardada. Lo que no se lee (un preset roto) se salta, no tira la lista entera. */
export function leerPresets(valor: string | null): PresetSubtitulos[] {
  if (!valor) return [];
  let crudo: unknown;
  try { crudo = JSON.parse(valor); } catch { return []; }
  const lista = Array.isArray((crudo as { presets?: unknown })?.presets) ? (crudo as { presets: unknown[] }).presets : [];
  const salida: PresetSubtitulos[] = [];
  for (const p of lista) {
    const id = (p as { id?: unknown })?.id;
    const actualizado = (p as { actualizado?: unknown })?.actualizado;
    if (!esIdPreset(id)) continue;
    const s = sanearPreset(p, { id, ahora: typeof actualizado === 'string' ? actualizado : '' });
    if (s.ok) salida.push(s.valor);
  }
  return salida.slice(0, TOPES_PRESETS.presets);
}

export const escribirPresets = (lista: readonly PresetSubtitulos[]): string => JSON.stringify({ presets: lista });

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Un preset por su id o por su nombre (sin tildes ni mayúsculas). Dos con el mismo nombre
 * en marcas distintas: se pide la marca, nunca se elige el primero.
 */
export function buscarPreset(
  lista: readonly PresetSubtitulos[],
  cual: string,
  marca?: string | null,
): { ok: true; preset: PresetSubtitulos } | { ok: false; motivo: string } {
  const t = cual.trim();
  if (!t) return { ok: false, motivo: 'falta cuál preset' };
  const porId = lista.find((p) => p.id === t);
  if (porId) return { ok: true, preset: porId };
  let candidatos = lista.filter((p) => normalizar(p.nombre) === normalizar(t));
  if (marca) candidatos = candidatos.filter((p) => p.marca != null && normalizar(p.marca) === normalizar(marca));
  if (candidatos.length === 1) return { ok: true, preset: candidatos[0] };
  if (candidatos.length > 1) {
    return { ok: false, motivo: `hay ${candidatos.length} presets «${t}»: di de qué marca (${candidatos.map((p) => p.marca ?? 'sin marca').join(', ')})` };
  }
  const nombres = lista.map((p) => (p.marca ? `${p.nombre} (${p.marca})` : p.nombre));
  return { ok: false, motivo: nombres.length ? `no hay un preset «${t}»; están: ${nombres.join(', ')}` : 'este negocio todavía no tiene presets de subtítulos' };
}

/** La lista con el preset puesto (reemplaza el del mismo id, o lo suma al principio). */
export function conPreset(lista: readonly PresetSubtitulos[], preset: PresetSubtitulos): { ok: true; lista: PresetSubtitulos[] } | { ok: false; motivo: string } {
  const sin = lista.filter((p) => p.id !== preset.id);
  const repetido = sin.find((p) => normalizar(p.nombre) === normalizar(preset.nombre) && normalizar(p.marca ?? '') === normalizar(preset.marca ?? ''));
  if (repetido) return { ok: false, motivo: `ya hay un preset «${repetido.nombre}»${repetido.marca ? ` de ${repetido.marca}` : ''}` };
  if (sin.length === lista.length && sin.length >= TOPES_PRESETS.presets) {
    return { ok: false, motivo: `hasta ${TOPES_PRESETS.presets} presets: borra uno que ya no uses` };
  }
  return { ok: true, lista: [preset, ...sin] };
}

/** En palabras, para la API y el chat: «Montserrat negrita, blanco con contorno negro, palabra clave en verde». */
export function resumenPreset(p: PresetSubtitulos): string {
  const e = p.estilo;
  const partes = [`${e.fuente}${e.negrita ? ' negrita' : ''}`, `letra ${e.color}`];
  if (e.mayusculas) partes.push('en mayúsculas');
  else if (e.minusculas) partes.push('en minúsculas');
  if (e.escala && e.escala !== 1) partes.push(`tamaño ×${String(e.escala).replace('.', ',')}`);
  if (e.fondo) partes.push(`fondo ${e.fondo.color}`);
  if (e.trazo) partes.push(`contorno ${e.trazo.color}`);
  if (e.sombra) partes.push('con sombra');
  if (e.resaltado) partes.push(`${e.resaltado.modo === 'palabra' ? 'la palabra' : 'la frase'} que se dice en ${e.resaltado.color}`);
  if (p.claves.auto) partes.push(`palabras clave en ${p.claves.color}`);
  if (p.claves.siempre.length) partes.push(`siempre resalta: ${p.claves.siempre.join(', ')}`);
  return partes.join(' · ');
}

// ── Lo que manda la API de MaKo (guardar_preset_subtitulos) ──────────────────

const QUITAR = new Set(['no', 'ninguno', 'ninguna', 'sin', 'none']);
const esQuitar = (v: unknown) => typeof v === 'string' && QUITAR.has(v.trim().toLowerCase());
/** El color de karaoke de las plantillas de fábrica («Karaoke», el amarillo de la casa). */
const COLOR_KARAOKE_POR_DEFECTO = '#ffe14d';

/**
 * Los campos planos de la API, sobre el preset que se cambia (o sobre uno nuevo): lo que no
 * viene queda como estaba. Devuelve lo CRUDO: lo sanea `sanearPreset` (aquí no se valida).
 */
export function presetDesdeApi(input: Record<string, unknown>, existente: PresetSubtitulos | null): Record<string, unknown> {
  const base: Omit<PresetSubtitulos, 'id' | 'actualizado'> = existente ?? {
    nombre: '',
    marca: null,
    estilo: { fuente: 'Montserrat', negrita: true, color: '#ffffff' },
    claves: { auto: false, color: COLOR_CLAVES_POR_DEFECTO, siempre: [] },
  };
  const estilo: Record<string, unknown> = { ...base.estilo };
  if (input.fuente !== undefined) estilo.fuente = input.fuente;
  if (input.negrita !== undefined) estilo.negrita = input.negrita;
  if (input.color !== undefined) estilo.color = input.color;
  if (input.escala !== undefined) estilo.escala = input.escala;
  if (input.mayusculas !== undefined) {
    if (input.mayusculas === true) {
      estilo.mayusculas = true;
      delete estilo.minusculas;
    } else delete estilo.mayusculas;
  }
  // «Lima» (la plantilla del reel) va en minúsculas: sin esto la API no podía guardar ni sacar ese estilo (revisión del
  // 9/11/2026). Las dos no van juntas: la que se prende saca a la otra.
  if (input.minusculas !== undefined) {
    if (input.minusculas === true) {
      estilo.minusculas = true;
      delete estilo.mayusculas;
    } else delete estilo.minusculas;
  }
  if (input.sombra !== undefined) {
    if (input.sombra === true) estilo.sombra = true;
    else delete estilo.sombra;
  }
  if (esQuitar(input.contorno)) delete estilo.trazo;
  else if (input.contorno !== undefined || (input.grosor_contorno !== undefined && base.estilo.trazo)) {
    estilo.trazo = {
      color: input.contorno ?? base.estilo.trazo?.color,
      grosor: input.grosor_contorno ?? base.estilo.trazo?.grosor ?? 20,
    };
  }
  if (esQuitar(input.fondo)) delete estilo.fondo;
  else if (input.fondo !== undefined) {
    estilo.fondo = { ...(base.estilo.fondo ?? { radio: 25, x: 0.35, y: 0.12 }), color: input.fondo };
  }
  if (input.karaoke === 'ninguno') delete estilo.resaltado;
  else if (input.karaoke === 'palabra' || input.karaoke === 'frase' || (input.color_karaoke !== undefined && base.estilo.resaltado)) {
    estilo.resaltado = {
      ...(base.estilo.resaltado ?? {}),
      modo: input.karaoke === 'palabra' || input.karaoke === 'frase' ? input.karaoke : base.estilo.resaltado?.modo,
      color: input.color_karaoke ?? base.estilo.resaltado?.color ?? COLOR_KARAOKE_POR_DEFECTO,
    };
  }
  const marca = input.marca === undefined ? base.marca : esQuitar(input.marca) || input.marca === '' ? null : input.marca;
  return {
    nombre: input.nombre ?? base.nombre,
    marca,
    estilo,
    claves: {
      auto: input.claves_automaticas ?? base.claves.auto,
      color: input.color_claves ?? base.claves.color,
      siempre: input.siempre ?? base.claves.siempre,
    },
  };
}
