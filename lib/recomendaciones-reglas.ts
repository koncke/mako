// =============================================================================
// recomendaciones-reglas — el motor de recomendaciones de MaKo, lo puro (26/10/2026)
// =============================================================================
// Pedido de Martín (26/10/2026 ~01:50, textual): «Lo que mas me interesa... es que MaKo sea realmente inteligente... Y
// comience a dar recomendaciones en todos lados... Pero estas recomendaciones y MaKo "pensando" deben ser reales, no le
// presetees que cada ratito debe de hacer recomendaciones basura para cumplir con su "cuota", tiene que ser posta
// inteligente». El diseño y el porqué de cada regla: docs/diseno-mako-recomienda.md.
//
// LAS TRES CONDICIONES (sin las tres, no hay recomendación):
//   (a) UN DATO DEL NEGOCIO LA SOSTIENE: nace de una `Senal`, que mide el CÓDIGO sobre la base del negocio (nunca la IA),
//       con su número, su muestra, su ventana y su fuente. Una señal debajo de su umbral, o con una muestra chica, no existe.
//   (b) DICE QUÉ HACER Y QUÉ CAMBIA: `hacer` y `cambia` son obligatorios; el «por qué» (`porque`) lo escribe el código con
//       el dato de la señal, así que la IA no puede inventar el número.
//   (c) NO LA DIJO YA NI LA DESCARTARON: la memoria del negocio (`MemoriaRecs`) guarda cada decisión. «No aplica» la calla
//       para siempre; «Ahora no», `DIAS_AHORA_NO`; «Hecha», `DIAS_HECHA` (y si después sigue igual, vuelve diciéndolo).
//
// SIN NADA QUE DECIR, NADA: no hay cuota ni mínimo. `elegir` puede devolver `[]`, y ninguna superficie rellena.
//
// APRENDE de lo que la persona acepta o descarta: dos «No aplica» de un mismo TIPO sin ninguna aceptada lo apagan para ese
// negocio (`tipoApagado`), y el orden pondera cada tipo por cuánto se le aceptó (`pesoAprendido`). Lo que se descartó, con
// su motivo, viaja a la IA para que no lo vuelva a proponer con otras palabras.
//
// LA IA REDACTA, NO MIDE: `leerRedaccion` acepta de la IA sólo recomendaciones que citan señales que existen, y descarta
// la que trae un número que no está en el dossier (`numerosAjenos`) o que es un consejo genérico (`esGenerico`). Si la IA
// falla o no hay IA, cada señal vigente sale con su texto por defecto, escrito por el código (`deSenal`).
// =============================================================================

/** Dónde aparece un MaKo que puede recomendar. `whatsapp` sólo contesta cuando le preguntan (MaKo en WhatsApp no avisa). */
export const SUPERFICIES = ['ops-center', 'automations', 'offer', 'landing', 'whatsapp'] as const;
export type Superficie = (typeof SUPERFICIES)[number];
export const esSuperficie = (s: unknown): s is Superficie => typeof s === 'string' && (SUPERFICIES as readonly string[]).includes(s);

/** Lo que pasa al tocar «Hacerlo». Nunca ejecuta solo: lleva a la pantalla o le pasa el pedido al chat, que PROPONE. */
export type AccionRec =
  | { tipo: 'link'; href: string; etiqueta: string }
  | { tipo: 'chat'; pedido: string; etiqueta: string };

/**
 * Un hecho MEDIDO del negocio que puede sostener una recomendación. Lo arma el código (lib/recomendaciones-senales.ts),
 * nunca un modelo. `dato` es la frase que se le muestra a la persona como el porqué, con el número adentro.
 */
export type Senal = {
  /** El tipo (`respuesta-lenta`, `automatizacion-con-errores`…): lo que aprende el motor va por tipo. */
  tipo: string;
  /** A qué se refiere dentro del negocio: `negocio`, `automatizacion:12`, `landing:abc`. Con `tipo`, la clave. */
  objeto: string;
  superficies: readonly Superficie[];
  /** El porqué, en una línea y con el número: «14 de 37 personas que te escribieron esperaron más de un día». */
  dato: string;
  /** El número principal (para comparar en el tiempo) y a partir de cuánto es recomendable. */
  valor: number;
  umbral: number;
  /** `mayor`: es malo cuando `valor >= umbral` (lo común). `menor`: cuando `valor <= umbral` (una tasa que se cae). */
  sentido: 'mayor' | 'menor';
  /** Cuántos casos hay detrás del número, y el mínimo para creerle. Con menos, la señal calla. */
  n: number;
  nMinimo: number;
  /** De dónde sale, dicho para la persona: «tus conversaciones de WhatsApp de los últimos 14 días». */
  fuente: string;
  /** 0..1: cuánta plata o cuánta gente toca. Ordena; nunca hace aparecer algo debajo del umbral. */
  impacto: number;
  /** Lo que el código propone por defecto (si la IA no redacta): qué hacer y qué cambia. */
  hacer: string;
  cambia: string;
  accion?: AccionRec;
};

export type Recomendacion = {
  /** `tipo|objeto` de su señal principal: con esto se calla, se acepta y se aprende. */
  clave: string;
  /**
   * TODAS las claves que la sostienen (la principal primero). La IA puede juntar varias señales en una recomendación; decidir
   * sobre ella decide sobre todas (revisión del tren-l, hallazgo 14: con sólo la principal, «No aplica» callaba la mitad y la
   * otra volvía en la carga siguiente).
   */
  claves: string[];
  tipo: string;
  superficie: Superficie;
  hacer: string;
  cambia: string;
  /** El porqué: el `dato` de cada señal que la sostiene, escrito por el código. Nunca vacío. */
  porque: string[];
  fuentes: string[];
  accion?: AccionRec;
  /** `regla`: el texto por defecto de la señal. `ia`: lo redactó la IA del negocio sobre las señales. */
  origen: 'regla' | 'ia';
  /** La aceptaste y, pasado `DIAS_HECHA`, el dato sigue igual: se dice así, no como si fuera nueva. */
  seguimiento?: { aceptadaEl: string };
};

// ── La memoria: lo que la persona decidió ───────────────────────────────────────────────────────────────────────────

/** `reabierta` deshace un «Ahora no» o un «No aplica» (la API lo pide: lo descartado tiene vuelta). */
export const DECISIONES = ['hecha', 'ahora-no', 'no-aplica', 'reabierta'] as const;
export type Decision = (typeof DECISIONES)[number];
export const esDecision = (d: unknown): d is Decision => typeof d === 'string' && (DECISIONES as readonly string[]).includes(d);

export type DecisionGuardada = {
  clave: string;
  tipo: string;
  superficie: Superficie;
  d: Decision;
  /** Lo que escribió la persona al descartar («ya lo hago a mano»): viaja a la IA para que no lo repita. */
  motivo?: string;
  /** ISO. */
  en: string;
  /** El valor de la señal cuando se decidió: con esto se dice «sigue igual» o «mejoró». */
  valor: number;
  /** Quién decidió (email o «api»), para el historial. */
  quien?: string;
};

export type MemoriaRecs = { v: 1; decisiones: DecisionGuardada[] };

/** La clave del setting del negocio donde vive su memoria (con compare-and-set, como lo callado del CRM). */
export const CLAVE_MEMORIA = 'mako.recomendaciones.memoria';
/** Cuántas decisiones guarda (las más nuevas). Una memoria que crece sin tope es un setting de megas. */
export const MAX_DECISIONES = 300;
/** Y en bytes (el JSON entero): viaja en cada lectura y en cada escritura. */
export const MAX_BYTES_MEMORIA = 60_000;
/** «Ahora no» calla esto; después vuelve SÓLO si el dato sigue sosteniéndola. */
export const DIAS_AHORA_NO = 14;
/** «Hecha» calla esto (lo que tarda un cambio en verse en los números); después, si sigue igual, vuelve como seguimiento. */
export const DIAS_HECHA = 10;
/** Dos «No aplica» de un mismo tipo sin ninguna aceptada lo apagan para el negocio. */
export const NO_APLICA_PARA_APAGAR = 2;
/** El largo máximo de un motivo guardado. */
export const MAX_MOTIVO = 280;

export const memoriaVacia = (): MemoriaRecs => ({ v: 1, decisiones: [] });

/** Lee la memoria guardada. Lo que no se entiende se tira por fila, nunca entera (una fila rota no borra las demás). */
export function leerMemoria(crudo: string | null | undefined): MemoriaRecs {
  if (!crudo) return memoriaVacia();
  let j: unknown;
  try { j = JSON.parse(crudo); } catch { return memoriaVacia(); }
  const filas = (j && typeof j === 'object' && Array.isArray((j as { decisiones?: unknown }).decisiones)) ? (j as { decisiones: unknown[] }).decisiones : [];
  const decisiones: DecisionGuardada[] = [];
  for (const f of filas) {
    if (!f || typeof f !== 'object') continue;
    const x = f as Record<string, unknown>;
    if (typeof x.clave !== 'string' || typeof x.tipo !== 'string' || !esSuperficie(x.superficie) || !esDecision(x.d)) continue;
    if (typeof x.en !== 'string' || Number.isNaN(Date.parse(x.en))) continue;
    decisiones.push({
      clave: x.clave, tipo: x.tipo, superficie: x.superficie, d: x.d, en: x.en,
      valor: typeof x.valor === 'number' && Number.isFinite(x.valor) ? x.valor : 0,
      ...(typeof x.motivo === 'string' && x.motivo.trim() ? { motivo: x.motivo.trim().slice(0, MAX_MOTIVO) } : {}),
      ...(typeof x.quien === 'string' && x.quien ? { quien: x.quien } : {}),
    });
  }
  return { v: 1, decisiones };
}

/** Suma una decisión (la más nueva al final) y recorta a `MAX_DECISIONES`. Pura: devuelve otra memoria. */
export function anotarDecision(m: MemoriaRecs, d: DecisionGuardada): MemoriaRecs {
  const motivo = d.motivo?.trim().slice(0, MAX_MOTIVO);
  const fila: DecisionGuardada = { ...d, ...(motivo ? { motivo } : { motivo: undefined }) };
  if (!fila.motivo) delete fila.motivo;
  let decisiones = [...m.decisiones, fila].slice(-MAX_DECISIONES);
  // Y un tope en BYTES, no sólo en filas: el setting viaja entero en cada lectura (las más viejas se van primero).
  while (decisiones.length > 1 && JSON.stringify({ v: 1, decisiones }).length > MAX_BYTES_MEMORIA) decisiones = decisiones.slice(1);
  return { v: 1, decisiones };
}

/**
 * ¿La última decisión sobre una clave SIGUE callándola con el mismo veredicto? Entonces repetirla no escribe nada (revisión
 * del tren-l, hallazgo 15: otra instancia, o la misma pantalla abierta en el celular, mostraba la lista vieja y un segundo
 * «Ahora no» sumaba otra fila). Pasado el plazo de un «Ahora no» o de una «Hecha», la recomendación vuelve y decidir otra vez
 * sí es nuevo.
 */
export function decisionVigente(previa: DecisionGuardada | null, d: Decision, ahora: Date): boolean {
  if (!previa || previa.d !== d || d === 'reabierta') return false;
  const hace = ahora.getTime() - Date.parse(previa.en);
  if (d === 'no-aplica') return true;
  if (d === 'ahora-no') return hace < DIAS_AHORA_NO * DIA;
  return hace < DIAS_HECHA * DIA;
}

export const claveDe = (s: Pick<Senal, 'tipo' | 'objeto'>): string => `${s.tipo}|${s.objeto}`;
/** ¿Tiene la forma de una clave (`tipo|objeto`)? Lo que llega de afuera (la pantalla, el chat) pasa por acá. */
export const esClaveDeRecomendacion = (k: unknown): k is string => typeof k === 'string' && /^[a-z0-9-]{2,40}\|[^\n\r]{1,300}$/.test(k);
/** Las otras claves que manda quien mostró la tarjeta: con forma de clave y pocas. */
export const clavesValidas = (x: unknown): string[] => (Array.isArray(x) ? x.filter(esClaveDeRecomendacion).slice(0, 8) : []);

const DIA = 86_400_000;

/** ¿El número de la señal la sostiene? (umbral cruzado y muestra suficiente). Una señal que no, no existe. */
export function sostiene(s: Senal): boolean {
  if (!Number.isFinite(s.valor) || !Number.isFinite(s.umbral)) return false;
  if (!(s.n >= s.nMinimo) || s.nMinimo < 1) return false;
  return s.sentido === 'mayor' ? s.valor >= s.umbral : s.valor <= s.umbral;
}

/** La última decisión sobre una clave, si la hay. */
export function ultimaDecision(m: MemoriaRecs, clave: string): DecisionGuardada | null {
  for (let i = m.decisiones.length - 1; i >= 0; i--) if (m.decisiones[i].clave === clave) return m.decisiones[i];
  return null;
}

/** La última decisión de cada clave (una reabierta deja de contar como descartada). */
function ultimasPorClave(m: MemoriaRecs): Map<string, DecisionGuardada> {
  const u = new Map<string, DecisionGuardada>();
  for (const d of m.decisiones) u.set(d.clave, d);
  return u;
}

/** ¿El negocio apagó este tipo? (`NO_APLICA_PARA_APAGAR` claves de ese tipo en «No aplica» y ninguna aceptada nunca). */
export function tipoApagado(m: MemoriaRecs, tipo: string): boolean {
  if (m.decisiones.some((d) => d.tipo === tipo && d.d === 'hecha')) return false;
  let n = 0;
  for (const d of ultimasPorClave(m).values()) if (d.tipo === tipo && d.d === 'no-aplica') n++;
  return n >= NO_APLICA_PARA_APAGAR;
}

/** Lo que la persona calló y sigue callado (para «Descartadas» y para la API): la última decisión de cada clave. */
export function descartadas(m: MemoriaRecs, ahora: Date): DecisionGuardada[] {
  return [...ultimasPorClave(m).values()].filter((d) =>
    d.d === 'no-aplica' || (d.d === 'ahora-no' && ahora.getTime() - Date.parse(d.en) < DIAS_AHORA_NO * DIA));
}

/**
 * Cuánto pesa un tipo para ESTE negocio, por lo que hizo con él: (aceptadas + 1) / (aceptadas + descartadas + 2). Sin
 * historia, 0,5 para todos (no cambia el orden); con lo que acepta, sube; con lo que descarta, baja. Nunca llega a 0:
 * ordenar no es callar (callar es `tipoApagado`).
 */
export function pesoAprendido(m: MemoriaRecs, tipo: string): number {
  let si = 0, no = 0;
  for (const d of m.decisiones) {
    if (d.tipo !== tipo || d.d === 'reabierta') continue;
    if (d.d === 'hecha') si++; else no++;
  }
  return (si + 1) / (si + no + 2);
}

export type EstadoClave =
  | { ve: true; seguimiento?: { aceptadaEl: string } }
  | { ve: false; por: 'no-aplica' | 'ahora-no' | 'hecha' | 'tipo-apagado' };

/** ¿Se puede mostrar la recomendación de esta señal, según lo que decidió la persona? */
export function estadoDe(m: MemoriaRecs, s: Senal, ahora: Date): EstadoClave {
  const u = ultimaDecision(m, claveDe(s));
  // Una clave REABIERTA a propósito se ve aunque su tipo siga apagado por otras (revisión del tren-l, hallazgo 16: con tres
  // «No aplica» del tipo, la reabierta quedaba escondida, fuera de «Descartadas» y sin poder reabrirse otra vez).
  if (u?.d === 'reabierta') return { ve: true };
  if (tipoApagado(m, s.tipo)) return { ve: false, por: 'tipo-apagado' };
  if (!u) return { ve: true };
  const hace = ahora.getTime() - Date.parse(u.en);
  if (u.d === 'no-aplica') return { ve: false, por: 'no-aplica' };
  if (u.d === 'ahora-no') return hace < DIAS_AHORA_NO * DIA ? { ve: false, por: 'ahora-no' } : { ve: true };
  // «Hecha»: se le da tiempo a que se note. Pasado ese tiempo, si el dato SIGUE sosteniéndola, vuelve diciendo que se
  // aceptó y sigue igual (no como nueva: eso sería repetirse sin decir lo que ya pasó).
  return hace < DIAS_HECHA * DIA ? { ve: false, por: 'hecha' } : { ve: true, seguimiento: { aceptadaEl: u.en } };
}

/**
 * Lo que cambió desde que se aceptó (para «Lo que cambió»): las aceptadas cuya señal ya NO se sostiene, Y QUE SE MIDIERON en
 * esta lectura (revisión del tren-l, hallazgo 12). `tiposMedidos`: los tipos cuya fuente se leyó bien en esta pantalla; sin él,
 * no se afirma ninguna mejora. Una señal con poca muestra no «mejoró»: no se puede decir (cuenta como sigue igual).
 */
export function funcionaron(m: MemoriaRecs, senales: readonly Senal[], ahora: Date, tiposMedidos: ReadonlySet<string> = new Set()): Array<{ clave: string; aceptadaEl: string; antes: number }> {
  // Mejoró sólo lo que ESTÁ hoy, con muestra, y debajo del umbral (verificación del tren-m, hallazgo 12): una señal que no se
  // emite porque no hay datos (la línea de WhatsApp desconectada, la asistencia sin marcar, una página sin visitas) no mejoró.
  const mejoradas = new Set(senales.filter((s) => s.nMinimo > 0 && s.n >= s.nMinimo && !sostiene(s)).map(claveDe));
  const vistas = new Set<string>();
  const out: Array<{ clave: string; aceptadaEl: string; antes: number }> = [];
  for (let i = m.decisiones.length - 1; i >= 0; i--) {
    const d = m.decisiones[i];
    if (vistas.has(d.clave)) continue;
    vistas.add(d.clave);
    if (d.d !== 'hecha' || !mejoradas.has(d.clave) || !tiposMedidos.has(d.tipo)) continue;
    if (ahora.getTime() - Date.parse(d.en) < DIAS_HECHA * DIA) continue;
    out.push({ clave: d.clave, aceptadaEl: d.en, antes: d.valor });
  }
  return out;
}

// ── Elegir qué se dice ──────────────────────────────────────────────────────────────────────────────────────────────

/** Cuántas puede tener abiertas una superficie a la vez. El bloque muestra UNA por vez; esto es la cola, no la vista. */
export const TOPE_POR_SUPERFICIE: Record<Superficie, number> = { 'ops-center': 3, automations: 2, offer: 2, landing: 2, whatsapp: 3 };

/** Las señales que pueden hablar en una superficie, ordenadas por lo que pesan para este negocio. Sin ninguna, `[]`. */
export function senalesQueHablan(senales: readonly Senal[], m: MemoriaRecs, superficie: Superficie, ahora: Date): Array<{ s: Senal; seguimiento?: { aceptadaEl: string } }> {
  const vistas = new Set<string>();
  const out: Array<{ s: Senal; seguimiento?: { aceptadaEl: string }; orden: number }> = [];
  for (const s of senales) {
    if (!s.superficies.includes(superficie) || !sostiene(s)) continue;
    const k = claveDe(s);
    if (vistas.has(k)) continue;
    vistas.add(k);
    const e = estadoDe(m, s, ahora);
    if (!e.ve) continue;
    out.push({ s, ...(e.seguimiento ? { seguimiento: e.seguimiento } : {}), orden: Math.max(0, Math.min(1, s.impacto)) * pesoAprendido(m, s.tipo) });
  }
  return out.sort((a, b) => b.orden - a.orden).map(({ s, seguimiento }) => (seguimiento ? { s, seguimiento } : { s }));
}

/** La recomendación por defecto de una señal: el texto lo escribió el código. */
export function deSenal(s: Senal, superficie: Superficie, seguimiento?: { aceptadaEl: string }): Recomendacion {
  return {
    clave: claveDe(s), claves: [claveDe(s)], tipo: s.tipo, superficie, hacer: s.hacer, cambia: s.cambia, porque: [s.dato], fuentes: [s.fuente],
    ...(s.accion ? { accion: s.accion } : {}), origen: 'regla', ...(seguimiento ? { seguimiento } : {}),
  };
}

/** Sin IA (o si falló): una por señal que habla, hasta el tope. Con ninguna, `[]`. */
export function elegirSinIA(senales: readonly Senal[], m: MemoriaRecs, superficie: Superficie, ahora: Date): Recomendacion[] {
  return senalesQueHablan(senales, m, superficie, ahora).slice(0, TOPE_POR_SUPERFICIE[superficie]).map(({ s, seguimiento }) => deSenal(s, superficie, seguimiento));
}

// ── La IA redacta: lo que se le pide y lo que se le acepta ──────────────────────────────────────────────────────────

/** El contexto del negocio que acompaña a las señales (lo arma el server: perfil, oferta, hechos del Second Brain). */
export type ContextoAsesor = { negocio: string; extras: string[] };

/** Los ids que ve la IA (`S1`, `S2`…), en el orden de `senalesQueHablan`. */
export const idDeSenal = (i: number): string => `S${i + 1}`;

export const MAX_HACER = 160;
export const MAX_CAMBIA = 200;

/** Lo que lee la IA del negocio. Nada de nombres de leads ni texto de conversaciones: sólo números y hechos agregados. */
export function pedidoAlAsesor(o: {
  superficie: Superficie; senales: ReadonlyArray<{ s: Senal; seguimiento?: { aceptadaEl: string } }>; contexto: ContextoAsesor; memoria: MemoriaRecs; ahora?: Date;
}): { system: string; user: string } {
  const descartes = descartadas(o.memoria, o.ahora ?? new Date()).slice(-12)
    .map((d) => `- ${d.tipo} (${d.d === 'no-aplica' ? 'no aplica' : 'ahora no'})${d.motivo ? `: «${d.motivo}»` : ''}`);
  const system = [
    'Eres MaKo, el asesor de marketing y ventas de este negocio. Hablas en español neutro (tú), directo y concreto.',
    'Te paso SEÑALES medidas en los datos reales del negocio (S1, S2…). Decide cuáles merecen una recomendación AHORA y redáctalas.',
    'Reglas:',
    '- Una recomendación cita al menos una señal por su id. Si varias señales son el mismo problema, júntalas en una.',
    '- «hacer» dice la acción concreta en una frase (máx. 160 caracteres). «cambia» dice qué mejora si lo hace (máx. 200).',
    '- No escribas números que no estén en las señales o en el contexto. No inventes datos, nombres ni herramientas.',
    '- Nada de consejos genéricos («mejora tu marketing», «sé constante»). Si una señal no vale la pena para este negocio, déjala afuera.',
    '- Si ninguna vale la pena, devuelve una lista vacía. No hay una cantidad mínima.',
    '- No repitas lo que la persona ya descartó (te paso sus motivos).',
    'Responde SOLO con JSON: {"recomendaciones":[{"senales":["S1"],"hacer":"…","cambia":"…"}]}',
  ].join('\n');
  const lineas = o.senales.map(({ s, seguimiento }, i) =>
    `${idDeSenal(i)} [${s.tipo}] ${s.dato} (fuente: ${s.fuente}). Por defecto: ${s.hacer}${seguimiento ? ` — OJO: la persona ya la aceptó el ${seguimiento.aceptadaEl.slice(0, 10)} y el dato sigue igual` : ''}`);
  const user = [
    `PANTALLA: ${o.superficie}`,
    `EL NEGOCIO:\n${o.contexto.negocio || '(sin perfil cargado)'}`,
    ...(o.contexto.extras.length ? [`LO QUE SABES DEL NEGOCIO (Second Brain):\n${o.contexto.extras.map((e) => `- ${e}`).join('\n')}`] : []),
    `SEÑALES:\n${lineas.join('\n')}`,
    ...(descartes.length ? [`LO QUE YA DESCARTÓ:\n${descartes.join('\n')}`] : []),
  ].join('\n\n');
  return { system, user };
}

/** Frases que delatan un consejo de manual. Una recomendación que es SÓLO eso no se acepta. */
const GENERICO = /\b(mejora(r)? (tu|el|la|los|las) (marketing|estrategia|presencia|marca|comunicaci[oó]n)|s[eé] constante|mant[eé]n(te)? (activo|constante)|aporta(r)? valor|conoce a tu (p[uú]blico|audiencia|cliente)|optimiza(r)? (tu|el|la) (estrategia|embudo|marketing)|publica (m[aá]s|contenido de valor)|usa (las )?redes sociales)\b/i;

/** ¿El texto es un consejo genérico? (lo que haría cualquiera sin mirar este negocio). */
export const esGenerico = (t: string): boolean => GENERICO.test(t);

/** Los números de un texto, normalizados («1.200» → 1200, «35 %» → 35, «2,5» → 2.5). */
export function numerosDe(t: string): number[] {
  const out: number[] = [];
  for (const m of t.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const crudo = m[0];
    // «1.200» y «1,200» son miles; «2,5» y «2.5» son decimales: un separador seguido de exactamente 3 dígitos es de miles.
    const sinMiles = /^\d{1,3}([.,]\d{3})+$/.test(crudo) ? crudo.replace(/[.,]/g, '') : crudo.replace(',', '.');
    const n = Number(sinMiles);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Los números del texto de la IA que NO están en lo que se le pasó: un número ajeno es un número inventado. */
export function numerosAjenos(texto: string, dossier: string): number[] {
  const permitidos = new Set(numerosDe(dossier));
  // Los chicos (1 a 3) se usan como palabras («un paso», «2 mensajes» al proponer): no son un dato del negocio.
  return numerosDe(texto).filter((n) => !permitidos.has(n) && !(Number.isInteger(n) && n >= 0 && n <= 3));
}

export type LecturaRedaccion = { ok: true; recs: Recomendacion[]; descartadas: Array<{ motivo: string }> } | { ok: false; motivo: string };

/**
 * Lee lo que contestó la IA. `ok: false` = no se entiende (se cae a `elegirSinIA`). `ok: true` con `recs: []` = la IA
 * decidió que no hay nada que valga la pena, y eso se respeta: no se rellena con las reglas.
 */
export function leerRedaccion(texto: string, o: {
  superficie: Superficie; senales: ReadonlyArray<{ s: Senal; seguimiento?: { aceptadaEl: string } }>; dossier: string;
}): LecturaRedaccion {
  const crudo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let j: unknown;
  try { j = JSON.parse(crudo); } catch { return { ok: false, motivo: 'la respuesta no es JSON' }; }
  const lista = j && typeof j === 'object' ? (j as { recomendaciones?: unknown }).recomendaciones : undefined;
  if (!Array.isArray(lista)) return { ok: false, motivo: 'falta la lista de recomendaciones' };
  const porId = new Map(o.senales.map((x, i) => [idDeSenal(i), x]));
  const usadas = new Set<string>();
  const recs: Recomendacion[] = [];
  const descartadas: Array<{ motivo: string }> = [];
  for (const r of lista) {
    if (!r || typeof r !== 'object') { descartadas.push({ motivo: 'no es un objeto' }); continue; }
    const x = r as Record<string, unknown>;
    const ids = Array.isArray(x.senales) ? x.senales.filter((i): i is string => typeof i === 'string') : [];
    const citadas = ids.filter((i) => porId.has(i) && !usadas.has(i));
    if (!citadas.length) { descartadas.push({ motivo: 'no cita ninguna señal que exista (o ya usada)' }); continue; }
    const hacer = typeof x.hacer === 'string' ? x.hacer.trim().replace(/\s+/g, ' ') : '';
    const cambia = typeof x.cambia === 'string' ? x.cambia.trim().replace(/\s+/g, ' ') : '';
    if (!hacer || !cambia) { descartadas.push({ motivo: 'le falta qué hacer o qué cambia' }); continue; }
    if (hacer.length > MAX_HACER || cambia.length > MAX_CAMBIA) { descartadas.push({ motivo: 'demasiado larga' }); continue; }
    if (esGenerico(hacer)) { descartadas.push({ motivo: `consejo genérico: «${hacer.slice(0, 60)}»` }); continue; }
    const ajenos = numerosAjenos(`${hacer} ${cambia}`, o.dossier);
    if (ajenos.length) { descartadas.push({ motivo: `número que no está en los datos: ${ajenos.join(', ')}` }); continue; }
    citadas.forEach((i) => usadas.add(i));
    const principal = porId.get(citadas[0])!;
    const todas = citadas.map((i) => porId.get(i)!.s);
    recs.push({
      clave: claveDe(principal.s), claves: todas.map(claveDe), tipo: principal.s.tipo, superficie: o.superficie, hacer, cambia,
      porque: todas.map((s) => s.dato), fuentes: [...new Set(todas.map((s) => s.fuente))],
      ...(principal.s.accion ? { accion: principal.s.accion } : {}), origen: 'ia',
      ...(principal.seguimiento ? { seguimiento: principal.seguimiento } : {}),
    });
  }
  return { ok: true, recs: recs.slice(0, TOPE_POR_SUPERFICIE[o.superficie]), descartadas };
}

/** La huella de lo que se le pasaría a la IA: si no cambió, la redacción guardada sigue valiendo (no se gasta IA). */
export function huellaDe(superficie: Superficie, senales: ReadonlyArray<{ s: Senal; seguimiento?: { aceptadaEl: string } }>, m: MemoriaRecs): string {
  const partes = senales.map(({ s, seguimiento }) => `${claveDe(s)}=${Math.round(s.valor * 100) / 100}${seguimiento ? '+seg' : ''}`);
  const ultima = m.decisiones.length ? m.decisiones[m.decisiones.length - 1].en : '';
  return `${superficie}#${partes.join(';')}#${m.decisiones.length}@${ultima}`;
}
