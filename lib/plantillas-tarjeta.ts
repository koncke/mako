// =============================================================================
// plantillas-tarjeta — las PLANTILLAS de estilo de la tarjeta de un tablero (21/10/2026), lo puro
// =============================================================================
// Martín, 21/10/2026: «el pop-up debe ser mucho más grueso y poder ver TEMPLATES de estilos de tarjeta, no solo info,
// sino que otros estilos también, como las que tenemos en CLIENTES y puedes crear otras más, como otra que no tenga foto
// de perfil, piensa en varios diseños» y «la personalización de las tarjetas en clientes, plan, etc.».
//
// UNA PLANTILLA = una FORMA (cómo se dibuja: completa, compacta, con portada…) + los DATOS que lleva, en su orden. Cada
// tablero tiene su catálogo de formas y de datos (el del CRM, lib/tarjeta-kanban.ts; los de Clientes y el Plan, al lado)
// y sus plantillas de fábrica; acá vive lo que es igual en los tres:
//   · cuál plantilla está puesta (la que coincide en forma y datos, en el mismo orden; si ninguna, «Personalizada»);
//   · las PROPIAS de cada persona: se guardan con un nombre, se limpian contra el catálogo al leerlas (un dato viejo no
//     rompe la pantalla) y tienen tope.
// Se guarda POR PERSONA, como el resto de la tarjeta (el porqué, en lib/tarjeta-kanban.ts → CAMPOS_TARJETA_LEAD).
//
// Sin `server-only` ni `'use client'`: lo importan las pantallas, el perfil y los tests.
// =============================================================================

export type PlantillaTarjeta<F extends string, C extends string> = {
  /** `fabrica:<x>` las de la casa; `propia:<n>` las de la persona. */
  id: string;
  nombre: string;
  forma: F;
  campos: readonly C[];
};

/** Cuántas plantillas propias guarda una persona por tablero. */
export const MAX_PLANTILLAS_PROPIAS = 12;
/** El nombre de una plantilla: corto, es texto que se dibuja debajo de la miniatura. */
export const MAX_NOMBRE_PLANTILLA = 32;

export const esPropia = (p: { id: string }): boolean => p.id.startsWith('propia:');

const mismosCampos = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * La plantilla puesta: la PRIMERA que coincide en forma y en datos, en el mismo orden (las de fábrica van antes, así
 * una propia idéntica a «Completa» no le gana el nombre). `null` = lo elegido no es ninguna: «Personalizada».
 */
export function plantillaPuesta<F extends string, C extends string>(
  plantillas: readonly PlantillaTarjeta<F, C>[], forma: F, campos: readonly C[],
): PlantillaTarjeta<F, C> | null {
  return plantillas.find((p) => p.forma === forma && mismosCampos(p.campos, campos)) ?? null;
}

/** El nombre limpio: sin espacios de más, sin saltos y con tope. Vacío = no se puede guardar. */
export function nombrePlantillaLimpio(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE_PLANTILLA).trim();
}

/**
 * Las propias guardadas, limpias contra el catálogo del tablero: sin forma desconocida, sin nombre, sin ids repetidos,
 * con los datos limpiados por `limpiarCampos` (el mismo que limpia la tarjeta de todos los días) y con tope.
 */
export function plantillasPropiasDe<F extends string, C extends string>(
  raw: unknown, formas: readonly F[], limpiarCampos: (raw: unknown) => C[],
): PlantillaTarjeta<F, C>[] {
  if (!Array.isArray(raw)) return [];
  const out: PlantillaTarjeta<F, C>[] = [];
  const ids = new Set<string>();
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as { id?: unknown; nombre?: unknown; forma?: unknown; campos?: unknown };
    const nombre = nombrePlantillaLimpio(o.nombre);
    const id = typeof o.id === 'string' && /^propia:[a-z0-9-]{1,40}$/.test(o.id) ? o.id : null;
    if (!id || !nombre || ids.has(id) || !(formas as readonly unknown[]).includes(o.forma)) continue;
    ids.add(id);
    out.push({ id, nombre, forma: o.forma as F, campos: limpiarCampos(o.campos) });
    if (out.length >= MAX_PLANTILLAS_PROPIAS) break;
  }
  return out;
}

/**
 * Guarda lo elegido como una plantilla propia. Con el MISMO nombre (sin mayúsculas ni acentos), la reemplaza: dos
 * «Mi tarjeta» en la galería no se distinguen. Sin lugar, no guarda (`lleno`).
 */
export function guardarPlantillaPropia<F extends string, C extends string>(
  propias: readonly PlantillaTarjeta<F, C>[], nombreRaw: unknown, forma: F, campos: readonly C[], idNuevo: string,
): { ok: true; propias: PlantillaTarjeta<F, C>[]; plantilla: PlantillaTarjeta<F, C> } | { ok: false; error: 'sin-nombre' | 'lleno' } {
  const nombre = nombrePlantillaLimpio(nombreRaw);
  if (!nombre) return { ok: false, error: 'sin-nombre' };
  const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const i = propias.findIndex((p) => clave(p.nombre) === clave(nombre));
  if (i >= 0) {
    const plantilla = { ...propias[i], nombre, forma, campos: [...campos] };
    return { ok: true, propias: propias.map((p, j) => (j === i ? plantilla : p)), plantilla };
  }
  if (propias.length >= MAX_PLANTILLAS_PROPIAS) return { ok: false, error: 'lleno' };
  const plantilla = { id: idNuevo, nombre, forma, campos: [...campos] };
  return { ok: true, propias: [...propias, plantilla], plantilla };
}

/** Un id nuevo para una propia (`propia:` + base 36). Lo genera la pantalla; el server lo vuelve a validar. */
export function idPlantillaNueva(ahora = Date.now(), azar = Math.random()): string {
  return `propia:${ahora.toString(36)}-${Math.floor(azar * 1296).toString(36)}`;
}

const claveNombre = (x: unknown) => String(x ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export type PedidoTarjeta<F extends string, C extends string> =
  | { ok: true; forma: F; campos: C[]; propias?: PlantillaTarjeta<F, C>[]; plantilla: string | null }
  | { ok: false; error: string; disponibles?: unknown; yaEstaba?: true };

/**
 * LO QUE PIDE MaKo POR LA API (`personalizar_tarjetas_clientes` y `_plan`, 21/10/2026), resuelto contra lo que la
 * persona tiene: una plantilla por su nombre (de fábrica o propia, sin mayúsculas ni acentos), o la forma y los datos;
 * con `guardarComo`, además la guarda como propia (con el mismo nombre, la reemplaza). Es la cuenta de
 * `personalizar_tarjetas_crm` (lib/api-mako/areas/crm.run.ts), sacada a un lugar para que Clientes y el Plan no la
 * escriban otra vez. `donde` es dónde se borra una propia cuando no hay lugar («Clientes», «el Plan»).
 * ⚠️ Los datos se limpian con el `limpiarCampos` del tablero: el de Clientes los pone en el orden del catálogo (cada dato
 *    tiene su lugar en la tarjeta) y el del Plan conserva el pedido.
 */
export function pedidoDeTarjeta<F extends string, C extends string>(
  input: { plantilla?: unknown; forma?: unknown; campos?: unknown; guardarComo?: unknown },
  actual: { forma: F; campos: readonly C[]; plantillas: readonly PlantillaTarjeta<F, C>[] },
  tablero: {
    fabrica: readonly PlantillaTarjeta<F, C>[]; formas: readonly F[]; campos: readonly C[];
    limpiarCampos: (raw: unknown) => C[]; nombreCampo: Readonly<Record<C, string>>; donde: string;
  },
  idNuevo: string,
): PedidoTarjeta<F, C> {
  const todas = [...tablero.fabrica, ...actual.plantillas];
  let forma: F;
  let campos: C[];
  if (input.plantilla !== undefined && String(input.plantilla).trim()) {
    const p = todas.find((x) => claveNombre(x.nombre) === claveNombre(input.plantilla));
    if (!p) return { ok: false, error: `No hay una plantilla «${String(input.plantilla).trim()}».`, disponibles: todas.map((x) => x.nombre) };
    forma = p.forma;
    campos = [...p.campos];
  } else if (input.forma !== undefined || input.campos !== undefined) {
    forma = (tablero.formas as readonly unknown[]).includes(input.forma) ? input.forma as F : actual.forma;
    if (input.campos !== undefined) {
      const pedidos = Array.isArray(input.campos) ? input.campos.map(String) : [];
      const raros = pedidos.filter((c) => !(tablero.campos as readonly string[]).includes(c));
      if (raros.length) return { ok: false, error: `No conozco ${raros.map((r) => `«${r}»`).join(', ')}.`, disponibles: tablero.campos.map((c) => ({ campo: c, nombre: tablero.nombreCampo[c] })) };
      campos = tablero.limpiarCampos(pedidos);
    } else campos = [...actual.campos];
  } else {
    return { ok: false, error: 'Pasa una plantilla por su nombre, o la forma y los datos.', disponibles: todas.map((x) => x.nombre) };
  }
  let propias: PlantillaTarjeta<F, C>[] | undefined;
  if (input.guardarComo !== undefined && String(input.guardarComo).trim()) {
    const g = guardarPlantillaPropia(actual.plantillas, input.guardarComo, forma, campos, idNuevo);
    if (!g.ok) return { ok: false, error: g.error === 'lleno' ? `Ya tiene ${MAX_PLANTILLAS_PROPIAS} plantillas propias: hay que borrar una en ${tablero.donde}.` : 'Falta el nombre de la plantilla.' };
    propias = g.propias;
  }
  const igual = forma === actual.forma && campos.length === actual.campos.length && campos.every((c, i) => c === actual.campos[i]);
  if (igual && !propias) return { ok: false, error: 'La tarjeta ya está así.', yaEstaba: true };
  return { ok: true, forma, campos, ...(propias ? { propias } : {}), plantilla: plantillaPuesta(todas, forma, campos)?.nombre ?? null };
}
