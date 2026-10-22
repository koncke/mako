// =============================================================================
// Desde dónde le escriben a MaKo: la tab, la entidad y el modo (22/10/2026, OC6)
// =============================================================================
// La estrella de cada tab (app/_chat/MakoEnLaTab.tsx) manda lo que se escribe al «Cerebro» de la persona, que reparte. Hasta el
// 22/10 caía SIN decir desde dónde (`tab` era sólo el aria-label), y «movelo a Ganado» con un lead abierto no sabía cuál. Ahora
// cada instancia declara `{ tab, entidad, modo }` (docs/diseno-chats-de-mako.md, «Cómo pasan todas», puntos 2 y 3):
//   · el mensaje lleva su chip «desde CRM › Ana», también al recargar (va como marca al principio de lo guardado);
//   · el turno sabe la entidad: va en el system, en la pista del clasificador, y las herramientas la toman por defecto;
//   · en «analizar» el servidor saca las herramientas que escriben (la generalización de `permisoEdicionMako`): se contesta
//     sin tocar nada. El modo lo pone la PANTALLA (vista → analizar), no un clic de la persona.
// SIN imports de valores: lo usan la pantalla, la ruta y los tests.

export type ModoChat = 'analizar' | 'editar';
export type TipoEntidad = 'lead' | 'automatizacion' | 'hoja' | 'oferta' | 'landing' | 'campana';
export type EntidadChat = { tipo: TipoEntidad; id: string | number; titulo: string };
export type Desde = { tab: string; entidad: EntidadChat | null; modo: ModoChat | null };

/** Cómo se nombra cada entidad, y el parámetro de las herramientas que la toma por defecto (null = ninguna lo tiene). */
export const ENTIDADES: Readonly<Record<TipoEntidad, { nombre: string; param: string | null }>> = {
  lead: { nombre: 'el lead', param: 'leadId' },
  automatizacion: { nombre: 'la automatización', param: 'secuenciaId' },
  hoja: { nombre: 'la hoja del dashboard', param: 'hojaId' },
  oferta: { nombre: 'la oferta', param: 'ofertaId' },
  landing: { nombre: 'la landing', param: null },
  campana: { nombre: 'la campaña', param: null },
};

const TOPE_TAB = 40;
const TOPE_TITULO = 80;
const TOPE_ID = 64;
const limpio = (v: unknown, tope: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
};

/** Lo que llegó del navegador, saneado: null si no dice desde qué tab. Una entidad o un modo que no se entienden se caen. */
export function sanearDesde(v: unknown): Desde | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const tab = limpio(o.tab, TOPE_TAB);
  if (!tab) return null;
  const modo = o.modo === 'analizar' || o.modo === 'editar' ? o.modo : null;
  let entidad: EntidadChat | null = null;
  const e = o.entidad;
  if (e && typeof e === 'object' && !Array.isArray(e)) {
    const r = e as Record<string, unknown>;
    const tipo = typeof r.tipo === 'string' && r.tipo in ENTIDADES ? (r.tipo as TipoEntidad) : null;
    const id = typeof r.id === 'number' && Number.isSafeInteger(r.id) && r.id > 0 ? r.id : limpio(r.id, TOPE_ID);
    const titulo = limpio(r.titulo, TOPE_TITULO);
    if (tipo && id != null && titulo) entidad = { tipo, id, titulo };
  }
  return { tab, entidad, modo };
}

/** «CRM › Ana»: lo que dice el chip del mensaje. */
export const etiquetaDesde = (d: Pick<Desde, 'tab' | 'entidad'>): string => (d.entidad ? `${d.tab} › ${d.entidad.titulo}` : d.tab);

/** La marca con que se GUARDA el mensaje: el chip vuelve al recargar, y el modelo lee en el historial desde dónde fue. */
const MARCA = /^\[desde: ([^\]\n]{1,140})\]\n/;
export const conDesde = (texto: string, d: Desde | null): string => (d ? `[desde: ${etiquetaDesde(d)}]\n${texto}` : texto);
/** El mensaje guardado, sin la marca, y lo que decía. */
export function sinDesde(content: string): { desde: string | null; texto: string } {
  const m = MARCA.exec(content);
  return m ? { desde: m[1], texto: content.slice(m[0].length) } : { desde: null, texto: content };
}

/** Lo que se antepone al texto que se CLASIFICA: «movelo a Ganado» solo no dice que es un lead. */
export const pistaDesde = (d: Desde | null): string => (d?.entidad ? `${ENTIDADES[d.entidad.tipo].nombre} «${d.entidad.titulo}»: ` : '');

/** Lo que va al final del system: desde dónde escribe y, en «analizar», que no cambia nada. */
export function contextoDesde(d: Desde | null): string {
  if (!d) return '';
  const partes = [`DESDE DÓNDE TE ESCRIBE: la tab ${d.tab}.`];
  if (d.entidad) {
    const e = ENTIDADES[d.entidad.tipo];
    partes.push(`Está mirando ${e.nombre} «${d.entidad.titulo}» (id ${d.entidad.id}). Si el pedido no nombra otra cosa, es sobre ÉSA: usa ese id y no la busques.`);
  }
  if (d.modo === 'analizar') {
    partes.push('MODO ANALIZAR: en esta pantalla la persona está mirando, no editando. Analiza, explica y aconseja con datos reales; no tienes con qué cambiar nada. Si te pide un cambio, dile en una línea que lo haga en modo Editar o desde el Ops Center.');
  }
  return partes.join(' ');
}

/** La entidad por defecto en una herramienta que la toma y no la trajo («movelo a Ganado» → `leadId` del lead abierto). */
export function conEntidadPorDefecto(
  def: { parametros?: ReadonlyArray<{ nombre: string; tipo?: string }> } | null | undefined,
  input: Record<string, unknown>, d: Desde | null,
): Record<string, unknown> {
  const e = d?.entidad;
  const param = e ? ENTIDADES[e.tipo].param : null;
  if (!e || !param || input[param] != null || !def?.parametros?.some((p) => p.nombre === param)) return input;
  const tipo = def.parametros.find((p) => p.nombre === param)?.tipo;
  const id = tipo === 'number' ? Number(e.id) : e.id;
  if (tipo === 'number' && !(Number.isSafeInteger(id) && (id as number) > 0)) return input;
  return { ...input, [param]: id };
}

/** En «analizar», las herramientas que escriben no viajan (el servidor lo cumple, no el modelo). */
export const herramientasDelModo = <T extends { name: string }>(tools: readonly T[], d: Desde | null, escribe: (nombre: string) => boolean): T[] =>
  d?.modo === 'analizar' ? tools.filter((t) => !escribe(t.name)) : [...tools];
