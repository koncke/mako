// =============================================================================
// Marketing CoPilot — «Oferta y comunicación»: qué se completa y cómo se lee (12/11/2026, vuelta 19 de la maqueta)
// =============================================================================
// Martín (12/11): MaKo te ayuda primero con tus ÁNGULOS (las razones de Jan, las «temáticas hot» de Doglio, el «ángulo ganador» de
// Cubría), después con tu VOZ (tu comunicación única) y con tu OFERTA. Las tres partes llevan UN SOLO MOLDE: grupos desplegables
// con sus cosas, cada una con su estado (falta / por confirmar / listo) y de dónde lo sacó MaKo. Y en el análisis, «nota por nota».
// La maqueta es docs/marketing-copilot/rediseno/maqueta-diecinueve.html; lo de los cursos, docs/marketing-copilot/analisis/comunicacion.md.
//
// PURO: sin base ni IA, lo usan la pantalla, la ruta y la API de MaKo.
//   · La OFERTA son las piezas de Offer (lib/offer-marco.ts → PIEZAS): no se copian, se leen de su conversación.
//   · ÁNGULOS y TU VOZ no existían en ningún lado (12/11/2026): se guardan por negocio en app_settings (./comunicacion-store.ts).
// ⚠️ Sin las explicaciones de cada grupo (Martín, vuelta 19: «texto innecesario»). Lo que es cada cosa va al popup y al prompt.
// =============================================================================

import { DIMENSIONES, PIEZAS, type PiezaKey } from '@/lib/offer-marco';

export type ParteOC = 'oferta' | 'angulos' | 'voz';
export const PARTES_OC: ReadonlyArray<readonly [ParteOC, string]> = [['oferta', 'Oferta'], ['angulos', 'Ángulos'], ['voz', 'Tu voz']];
export const esParteOC = (v: unknown): v is ParteOC => v === 'oferta' || v === 'angulos' || v === 'voz';

/** vacia = falta · negocio = MaKo lo leyó y hay que confirmarlo · confirmada = listo. Los mismos tres de Offer (app/offer/ayudas.ts). */
export type EstadoOC = 'vacia' | 'negocio' | 'confirmada';
export const ETIQUETA_ESTADO_OC: Record<EstadoOC, string> = { vacia: 'Falta', negocio: 'Confirmar', confirmada: 'Listo' };

/** De dónde lo sacó MaKo. Se dibuja con su ícono al lado de lo que sabe. */
export type TipoFuenteOC = 'pdf' | 'web' | 'llamada' | 'reel' | 'video' | 'anuncio' | 'comentario' | 'chat' | 'negocio';
export const TIPOS_FUENTE_OC: readonly TipoFuenteOC[] = ['pdf', 'web', 'llamada', 'reel', 'video', 'anuncio', 'comentario', 'chat', 'negocio'];
export type FuenteOC = { tipo: TipoFuenteOC; texto: string };

/** Lo que sabe MaKo de una cosa, como lo dibuja la pantalla. */
export type CosaOC = { estado: EstadoOC; valor: string; fuente: FuenteOC | null; at: string | null };

/** Una cosa que se completa: su nombre y qué es (va al popup y al prompt, nunca suelto en la lista). */
export type ItemOC = { k: string; nombre: string; que: string };
export type GrupoOC = { titulo: string; items: readonly string[] };
export type DefParteOC = { grupos: readonly GrupoOC[]; items: Readonly<Record<string, ItemOC>> };

const item = (k: string, nombre: string, que: string): ItemOC => ({ k, nombre, que });
const porClave = (xs: ItemOC[]): Record<string, ItemOC> => Object.fromEntries(xs.map((x) => [x.k, x]));

// La oferta: los grupos de la maqueta sobre las 20 piezas de Offer (los nombres y qué es salen de Offer, no se escriben dos veces).
const NOMBRE_OFERTA: Partial<Record<PiezaKey, string>> = { mecanismo: 'Método', frase: 'La frase' };
const ITEMS_OFERTA = porClave(PIEZAS.map((p) => item(p.key, NOMBRE_OFERTA[p.key] ?? p.label, p.que)));

export const OC: Readonly<Record<ParteOC, DefParteOC>> = {
  oferta: {
    grupos: [
      { titulo: 'Para quién', items: ['cliente', 'problema', 'resultado', 'objecion'] },
      { titulo: 'Cómo', items: ['mecanismo', 'entregables', 'semana', 'formato'] },
      { titulo: 'Prueba', items: ['ventas', 'prueba'] },
      { titulo: 'Precio', items: ['precio', 'cobro', 'valor', 'costo'] },
      { titulo: 'Cierre', items: ['garantia', 'bonos', 'urgencia', 'frase'] },
      { titulo: 'Tu negocio', items: ['escalera', 'otras'] },
    ],
    items: ITEMS_OFERTA,
  },
  angulos: {
    grupos: [
      { titulo: 'Tu dolor', items: ['dolor', 'dolor2', 'palabras'] },
      { titulo: 'Tus ángulos', items: ['ganador', 'probar', 'quemado'] },
      { titulo: 'De dónde salen', items: ['piden', 'competencia', 'momento'] },
      { titulo: 'Cómo los mides', items: ['venta', 'semana'] },
    ],
    items: porClave([
      item('dolor', 'Dolor que más vende', 'El problema que más repiten tus clientes y que más ventas trae.'),
      item('dolor2', 'Otro dolor', 'Un segundo problema de tu cliente, para cuando el primero se canse.'),
      item('palabras', 'Sus palabras', 'Cómo cuenta tu cliente su problema, palabra por palabra. Tus guiones las usan.'),
      item('ganador', 'Ángulo ganador', 'El que más agendas trae con tu dolor. Se sigue usando hasta que se queme.'),
      item('probar', 'Ángulos para probar', 'Ángulos nuevos para el mismo dolor. Se prueban en reels de prueba antes de pautarlos.'),
      item('quemado', 'Ángulo quemado', 'El que ya no rinde: descansa un mes y se vuelve a probar contado de otra forma.'),
      item('piden', 'Lo que te piden', 'Lo que tu cliente pide en comentarios y mensajes: ya tiene demanda.'),
      item('competencia', 'Tu competencia', 'Los ángulos de los anuncios que siguen activos hace semanas en tu nicho, para no repetirlos.'),
      item('momento', 'El momento', 'Un cambio del mercado del que hoy se habla en tu nicho.'),
      item('venta', 'Qué trajo cada venta', 'La pieza que vio cada cliente al llegar y la última antes de comprar.'),
      item('semana', 'Revisión semanal', 'Cada semana, qué ángulo trajo más agendas y cuál se quemó.'),
    ]),
  },
  voz: {
    grupos: [
      { titulo: 'Cómo hablas', items: ['tono', 'arranque', 'atraen', 'evitar'] },
      { titulo: 'Tu historia', items: ['origen', 'quiebre', 'casos'] },
      { titulo: 'Lo que defiendes', items: ['contra', 'noeres', 'creencia'] },
      { titulo: 'Lo que muestras', items: ['vida', 'quiere'] },
    ],
    items: porClave([
      item('tono', 'Tu tono', 'Cómo suenas: directo, cercano, técnico, con humor.'),
      item('arranque', 'Cómo arrancas', 'Las primeras palabras de tus videos: ahí se decide si te escuchan.'),
      item('atraen', 'Palabras que atraen', 'Las que usa tu cliente y le despiertan interés. Salen de tus llamadas.'),
      item('evitar', 'Palabras que evitar', 'Las que le levantan la guardia o suenan a vendehumo.'),
      item('origen', 'De dónde vienes', 'Tu historia en una frase: dónde estabas cuando tenías el problema de tu cliente.'),
      item('quiebre', 'Lo que te cambió', 'El momento en que entendiste lo que hoy enseñas.'),
      item('casos', 'Tus casos', 'Clientes que lograron el resultado, contados por ti.'),
      item('contra', 'Contra qué estás', 'Una idea o una práctica que tu cliente sufre y tú rechazas. Nunca una persona.'),
      item('noeres', 'Quién no eres', 'Lo que no haces y a quién no ayudas: te separa de los demás.'),
      item('creencia', 'Lo que quieres que crean', 'La idea que tu cliente tiene que creer para comprarte.'),
      item('vida', 'Tu vida y tu equipo', 'Lo que muestras de tu día a día.'),
      item('quiere', 'Lo que tu cliente quiere vivir', 'La vida que desea tu cliente: lo que muestras tiene que acercarse a eso.'),
    ]),
  },
};

export const esItemOC = (p: ParteOC, k: unknown): k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(OC[p].items, k);
export const clavesOC = (p: ParteOC): string[] => OC[p].grupos.flatMap((g) => g.items);
export const nombreItemOC = (p: ParteOC, k: string): string => OC[p].items[k]?.nombre ?? k;

// ── El estado de un grupo, en una línea ───────────────────────────────────────

export type EstadoGrupoOC = 'falta' | 'confirmar' | 'listo';
/**
 * Lo que dice la cabecera de cada caja: el nombre si entra («Falta: resultado»), y si no, cuántas («Faltan 2», «1 por confirmar»).
 * Dos renglones partían el nombre del grupo (vuelta 19). `tel` es lo corto, para el teléfono.
 */
export function estadoDeGrupoOC(p: ParteOC, g: GrupoOC, cosas: Record<string, CosaOC>): { e: EstadoGrupoOC; dice: string; tel: string } {
  const est = g.items.map((k) => cosas[k]?.estado ?? 'vacia');
  const f = g.items.filter((_, i) => est[i] === 'vacia');
  const c = g.items.filter((_, i) => est[i] === 'negocio');
  const lista = (xs: string[]) => xs.map((k) => nombreItemOC(p, k).toLowerCase());
  const y = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  const corto = (largo: string, alt: string) => ({ dice: largo.length <= 24 ? largo : alt, tel: alt });
  if (f.length === g.items.length) return { e: 'falta', dice: 'Todo por hacer', tel: 'Todo por hacer' };
  if (f.length) return { e: 'falta', ...corto(`Falta: ${y(lista(f))}`, f.length === 1 ? 'Falta 1' : `Faltan ${f.length}`) };
  if (c.length) return { e: 'confirmar', ...corto(`Por confirmar: ${y(lista(c))}`, `${c.length} por confirmar`) };
  return { e: 'listo', dice: 'Listo', tel: 'Listo' };
}

/** El grupo que se abre solo: el primero al que le falta algo (o ninguno, si está todo). */
export function grupoParaAbrirOC(p: ParteOC, cosas: Record<string, CosaOC>): string | null {
  return OC[p].grupos.find((g) => estadoDeGrupoOC(p, g, cosas).e === 'falta')?.titulo ?? null;
}

/** Cuántas cosas le faltan a una parte (el número de la tarjeta, «te tocan»). */
export const faltanOC = (p: ParteOC, cosas: Record<string, CosaOC>): number => clavesOC(p).filter((k) => (cosas[k]?.estado ?? 'vacia') === 'vacia').length;

// ── Lo guardado de Ángulos y Tu voz ───────────────────────────────────────────

/** Una cosa guardada. `estado` nunca es 'vacia': lo vacío no se guarda. */
export type GuardadaOC = { valor: string; estado: 'negocio' | 'confirmada'; fuente: FuenteOC | null; at: string };
/** La nota del análisis, criterio por criterio (1 a 10) y el total (promedio × 10). */
export type NotaOC = { total: number; criterios: Array<{ id: string; nota: number; porque: string }>; lei: Array<{ titulo: string; texto: string }>; at: string; modelo?: string };
export type GuardadoOC = { cosas: Record<string, GuardadaOC>; nota?: NotaOC | null; leidoAt?: string | null };

const corta = (s: unknown, max: number): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Sanea lo que viene de la base o de la IA: sólo claves del catálogo, textos cortados, estados válidos. */
export function sanearGuardadoOC(p: Exclude<ParteOC, 'oferta'>, crudo: unknown): GuardadoOC {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const cosasCrudas = (o.cosas && typeof o.cosas === 'object' ? o.cosas : {}) as Record<string, unknown>;
  const cosas: Record<string, GuardadaOC> = {};
  for (const [k, v] of Object.entries(cosasCrudas)) {
    if (!esItemOC(p, k) || !v || typeof v !== 'object') continue;
    const c = v as Record<string, unknown>;
    const valor = corta(c.valor, 600);
    if (!valor) continue;
    cosas[k] = { valor, estado: c.estado === 'confirmada' ? 'confirmada' : 'negocio', fuente: sanearFuenteOC(c.fuente), at: corta(c.at, 40) || new Date(0).toISOString() };
  }
  return { cosas, nota: sanearNotaOC(p, o.nota), leidoAt: corta(o.leidoAt, 40) || null };
}

export function sanearFuenteOC(f: unknown): FuenteOC | null {
  if (!f || typeof f !== 'object') return null;
  const x = f as Record<string, unknown>;
  const tipo = TIPOS_FUENTE_OC.includes(x.tipo as TipoFuenteOC) ? (x.tipo as TipoFuenteOC) : null;
  const texto = corta(x.texto, 200);
  return tipo && texto ? { tipo, texto } : null;
}

function sanearNotaOC(p: Exclude<ParteOC, 'oferta'>, n: unknown): NotaOC | null {
  if (!n || typeof n !== 'object') return null;
  const x = n as Record<string, unknown>;
  const ids = new Set(RUBRICA_OC[p].map((r) => r.id));
  const criterios = (Array.isArray(x.criterios) ? x.criterios : [])
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : null))
    .filter((c): c is Record<string, unknown> => !!c && ids.has(String(c.id)))
    .map((c) => ({ id: String(c.id), nota: Math.max(1, Math.min(10, Math.round(Number(c.nota) || 1))), porque: corta(c.porque, 400) }));
  if (!criterios.length) return null;
  const lei = (Array.isArray(x.lei) ? x.lei : []).slice(0, 6)
    .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : {}))
    .map((l) => ({ titulo: corta(l.titulo, 60), texto: corta(l.texto, 300) })).filter((l) => l.titulo && l.texto);
  return { total: totalNotaOC(criterios), criterios, lei, at: corta(x.at, 40) || new Date(0).toISOString(), modelo: corta(x.modelo, 60) || undefined };
}

/** El total: el promedio de los criterios × 10, redondeado. Lo calcula el código, nunca la IA. */
export const totalNotaOC = (cs: ReadonlyArray<{ nota: number }>): number => (cs.length ? Math.round((cs.reduce((a, c) => a + c.nota, 0) / cs.length) * 10) : 0);

/** Lo que el negocio ve de una cosa guardada (o «falta» si no hay nada). */
export const cosaDeGuardada = (g: GuardadaOC | undefined): CosaOC =>
  g ? { estado: g.estado, valor: g.valor, fuente: g.fuente, at: g.at } : { estado: 'vacia', valor: '', fuente: null, at: null };

/**
 * Marcar o desmarcar el check de una cosa (como las tareas de Web). Marcar una que MaKo leyó la confirma; desmarcar una confirmada
 * la deja «por confirmar» (no se borra lo que se sabe). Una vacía no se marca: primero hay que decir qué es (en el chat).
 */
export function marcarOC(g: GuardadoOC, k: string, listo: boolean, ahora: string): GuardadoOC {
  const c = g.cosas[k];
  if (!c) return g;
  return { ...g, cosas: { ...g.cosas, [k]: { ...c, estado: listo ? 'confirmada' : 'negocio', at: ahora } } };
}

/** Lo que dice la persona (en el chat o a mano): queda confirmado, con el chat de fuente. */
export function decirOC(g: GuardadoOC, k: string, valor: string, ahora: string): GuardadoOC {
  const v = corta(valor, 600);
  if (!v) return g;
  return { ...g, cosas: { ...g.cosas, [k]: { valor: v, estado: 'confirmada', fuente: { tipo: 'chat', texto: 'Lo dijiste en el chat' }, at: ahora } } };
}

/**
 * Lo que leyó MaKo se suma SIN PISAR lo confirmado: una lectura nueva no le cambia a la persona lo que ya dijo que está bien. Lo que
 * MaKo ya había leído (por confirmar) sí se actualiza con lo nuevo.
 */
export function fundirLecturaOC(g: GuardadoOC, leido: Record<string, { valor: string; fuente: FuenteOC | null }>, ahora: string): GuardadoOC {
  const cosas = { ...g.cosas };
  for (const [k, l] of Object.entries(leido)) {
    if (cosas[k]?.estado === 'confirmada') continue;
    const v = corta(l.valor, 600);
    if (!v) continue;
    cosas[k] = { valor: v, estado: 'negocio', fuente: l.fuente, at: ahora };
  }
  return { ...g, cosas, leidoAt: ahora };
}

// ── La rúbrica del análisis (nueve criterios por parte, del 1 al 10) ──────────
// Salen de los cursos (docs/marketing-copilot/analisis/comunicacion.md): dolor ≠ ángulo (Carrizo), la matriz de ángulos (Cubría), juzgar
// por agendas y ventas y no por vistas, de nicho = el problema que más tiene el cliente ideal, nada viral para empezar.

export type CriterioOC = { id: string; nombre: string; mide: string };
export const RUBRICA_OC: Readonly<Record<Exclude<ParteOC, 'oferta'>, readonly CriterioOC[]>> = {
  angulos: [
    { id: 'A1', nombre: 'Tu dolor, claro', mide: 'Si hay UN dolor que más vende, dicho como lo dice el cliente, y si se sabe de dónde sale (llamadas, mensajes, ventas).' },
    { id: 'A2', nombre: 'Ángulo ganador', mide: 'Si hay un ángulo que trae más agendas o ventas que los demás, medido por resultados y no por vistas.' },
    { id: 'A3', nombre: 'Ángulos distintos', mide: 'Si las piezas que corren cuentan el dolor desde ángulos de verdad distintos (no el mismo con otras palabras).' },
    { id: 'A4', nombre: 'De nicho', mide: 'Si lo que publica le habla a su cliente ideal y a su problema, y no busca vistas de cualquiera (nada viral para empezar).' },
    { id: 'A5', nombre: 'Lo que te piden', mide: 'Si usa lo que su cliente pide en comentarios y mensajes.' },
    { id: 'A6', nombre: 'Temas del momento', mide: 'Si aprovecha los cambios del mercado de los que hoy se habla en su nicho.' },
    { id: 'A7', nombre: 'Las palabras de tu cliente', mide: 'Si sus textos y guiones usan las palabras del cliente y no la jerga del negocio.' },
    { id: 'A8', nombre: 'Qué trajo cada venta', mide: 'Si sabe qué pieza vio cada cliente al llegar y la última antes de comprar.' },
    { id: 'A9', nombre: 'Ángulos quemados', mide: 'Si detecta y descansa los ángulos que ya no rinden (frecuencia alta, costo en subida).' },
  ],
  voz: [
    { id: 'V1', nombre: 'Hablas como hablas', mide: 'Si suena a la persona (su forma de hablar, su tono) y no a una plantilla.' },
    { id: 'V2', nombre: 'Cómo arrancas', mide: 'Si las primeras palabras de sus videos enganchan a su cliente.' },
    { id: 'V3', nombre: 'Tus anuncios, con tu voz', mide: 'Si sus anuncios suenan a la persona y no a una marca en tercera persona.' },
    { id: 'V4', nombre: 'Tu historia', mide: 'Si cuenta de dónde viene y qué la cambió.' },
    { id: 'V5', nombre: 'Contra qué estás', mide: 'Si dice contra qué idea o práctica está, y lo repite.' },
    { id: 'V6', nombre: 'Quién no eres', mide: 'Si dice qué no hace y a quién no ayuda.' },
    { id: 'V7', nombre: 'Las palabras de tu cliente', mide: 'Si usa las palabras de su cliente y no las suyas de oficio.' },
    { id: 'V8', nombre: 'Lo que muestras', mide: 'Si lo que muestra de su vida se parece a lo que su cliente quiere vivir.' },
    { id: 'V9', nombre: 'Tus casos, contados por ti', mide: 'Si sus casos de éxito los cuenta la persona, con nombre y números.' },
  ],
};
/** El nombre de un criterio de la nota. La oferta usa las nueve dimensiones de Offer (D1-D9). */
export const nombreCriterioOC = (p: ParteOC, id: string): string =>
  (p === 'oferta' ? DIMENSIONES.find((d) => d.id === id)?.label : RUBRICA_OC[p].find((r) => r.id === id)?.nombre) ?? id;

/** Las claves de app_settings: por negocio. Ángulos va por conversación de Offer (cada oferta tiene su dolor); Tu voz, una por negocio. */
export const PREFIJO_OC = 'marketing-copilot.oc.';
/** La conversación de Offer elegida en la tarjeta: el chat guarda en ésa sin pasarla en cada turno. */
export const CLAVE_OFERTA_OC = `${PREFIJO_OC}oferta`;
export const claveOC = (p: Exclude<ParteOC, 'oferta'>, sesionOffer: number | null): string =>
  p === 'voz' ? `${PREFIJO_OC}voz` : `${PREFIJO_OC}angulos.${sesionOffer ?? 'general'}`;
