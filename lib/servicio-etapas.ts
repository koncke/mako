// =============================================================================
// servicio-etapas — las etapas de ENTREGA de un producto (puro, compartido)
// =============================================================================
// Sin 'server-only' a propósito: lo importan el server (la página arma el tablero)
// y el cliente (el kanban lo dibuja), igual que lib/pipeline.ts. Lo que toca
// Supabase vive en lib/entrega-servicio.ts.
//
// QUÉ ES: «si un CLIENTE actual llega a X etapa de mi SERVICIO (onboarding, hito 1,
// hito 2, o lo que sea que el usuario configure en su entrega de servicio…)»
// (Martín, 05/10/2026). Las columnas del kanban de Customer Success son estas
// etapas y las tarjetas son los clientes.
//
// ⚠️ POR QUÉ ESTO NO ES «OTRO EMBUDO DEL MISMO PRODUCTO», que era la hipótesis
// razonable y está medida como falsa:
//
//   · `leads.funnel_id` es UNA columna (migración 0181). Un lead vive en un
//     embudo, no en dos.
//   · Un cliente ES un lead ganado — no hay tabla de clientes (ver el encabezado
//     de app/customer-success/BarraClientes.tsx).
//   · La etapa del lead también es UNA: `pipeline_stage` + la derivada + `etapa_vista`.
//
// Las dos etapas son SIMULTÁNEAS, no sucesivas: el mismo cliente es `ganado` en
// ventas y `hito2` en entrega AL MISMO TIEMPO. Meterlo en un embudo de entrega lo
// sacaría del tablero del CRM donde está ganado. Por eso la ASIGNACIÓN vive
// aparte (tabla `cliente_entrega`) y lo que se reusa del CRM es la FORMA del
// catálogo, no su almacenamiento.
//
// ⚠️ LA CLAVE ES ESTABLE Y EL RÓTULO SE EDITA APARTE. Es la lección de ManyChat
// (docs/hallazgos-comunicacion.md, 05/10): ellos apuntan a todo por nombre y lo
// admiten roto en su propia doc — renombrar una etapa rompe el flujo en silencio.
// Acá el kanban, la secuencia y la fila guardada hablan de `key`; `label` es
// decoración que se puede cambiar sin romper nada.
//
// LO QUE NO ESTÁ, NO FALTA: las etapas de entrega no tienen banda (no hay
// nutrición ni descarte), ni `kind` de reunión, ni layout de diagrama. Eso es del
// CRM porque allá la etapa se DERIVA de señales; acá es un hecho declarado —
// alguien dice «este cliente llegó a hito 2». Copiar el `Stage` entero habría
// traído cinco conceptos que en entrega no existen.

import { NEW_STAGE_PALETTE, NEW_STAGE_TONES, type StageTone } from './pipeline';

/**
 * Una FASE: el tramo del programa al que pertenecen varias etapas.
 *
 * Pedido de Martín (05/10/2026), con su ejemplo: «en todo programa existen fases, por
 * ejemplo, Fase 1: "Cimientos" y dentro están las etapas». Es el mismo modelo que el CRM
 * ya tiene con Activo / Nutrición / Descartado: tres botones arriba que engloban varias
 * columnas y les dan su color.
 *
 * ⚠️ LA FASE ES OPCIONAL Y EL DEFAULT ES NO TENERLA. Un negocio con cinco etapas y sin
 * tramos no gana nada agrupándolas, y obligarlo a inventar una fase para poder crear una
 * etapa es fricción por una estructura que no pidió. Sin fases, el tablero se dibuja
 * exactamente como antes.
 */
export type FaseEntrega = {
  /** Estable y única. Lo que apunta una etapa. NUNCA se renombra ni se reusa. */
  key: string;
  label: string;
  tone: StageTone;
  dot: string;
};

/** Una etapa de la entrega de UN producto. */
export type EtapaEntrega = {
  /** Estable y única dentro del producto. NUNCA se renombra ni se reusa. */
  key: string;
  /** Lo que se ve. Se edita libremente; nada apunta acá. */
  label: string;
  /** Color del chip en el kanban. Misma paleta que el CRM, no una segunda. */
  tone: StageTone;
  dot: string;
  /**
   * La fase a la que pertenece, si pertenece a alguna.
   *
   * ⚠️ EL COLOR DE LA FASE GANA SOBRE EL PROPIO, y el propio NO se borra al asignarla:
   * sacar la etapa de su fase tiene que devolverle el suyo, y si se hubiera pisado
   * habría que inventarle uno. Quién gana se decide al PINTAR (`colorDeEtapa`), que es
   * lo que permite que las dos cosas convivan sin que una destruya a la otra.
   */
  fase?: string;
  /**
   * El link para agendar la sesión de esta etapa (su Calendly), #665: el portal del alumno lo
   * muestra —«Agenda tu sesión»— RECIÉN cuando el alumno completó la etapa (`etapaCompleta`), y
   * antes ni siquiera viaja a su navegador (lib/curso-portal.ts, `armarEtapas`). Sólo https
   * (`agendaValida`): termina en el `href` de un botón que ve el cliente de un cliente.
   *
   * ⚠️ ES UNA TRABA BLANDA y está dicho acá, no en la pantalla: el link existe afuera del portal,
   * y quien lo tenga (se lo pasó otro cliente, lo encontró en el perfil público de Calendly) agenda
   * sin haber terminado. Lo que la traba logra es que el camino normal pase por la tarea.
   */
  agendaUrl?: string;
};

/** El tope del link de agenda: un Calendly con sus parámetros entra de sobra. */
export const MAX_AGENDA = 500;

/**
 * El link de agenda de una etapa, saneado. `null` = no sirve (no es https, no es un link, trae
 * usuario y clave adentro, o es demasiado largo). Lo usan el saneo de las etapas, el editor (para
 * decir «no sirve» ANTES de guardar) y el portal (otra vez, antes de pintarlo).
 *
 * ⚠️ SÓLO https, no http: es un botón que abre afuera desde el portal de un cliente, y un
 * `javascript:` en ese `href` es un script corriendo en su navegador.
 */
export function agendaValida(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > MAX_AGENDA) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname || !u.hostname.includes('.') || u.username || u.password) return null;
  return u.toString();
}

/**
 * La entrega de un producto: sus etapas y de dónde salieron.
 *
 * ⚠️ `origen` NO se deriva de si `etapas` viene llena. Es la misma trampa que la
 * 0170 documenta para `funnels.data`: una fila que nace con `'{}'::jsonb` es
 * truthy en JS, y un lector que mire el contenido leería «declarado» donde no se
 * declaró nada. Sin esto, la pantalla no puede decir «todavía no configuraste la
 * entrega de este producto» y muestra las etapas genéricas como si fueran una
 * decisión del cliente.
 */
export type EntregaConfig = {
  productoId: number;
  etapas: EtapaEntrega[];
  /**
   * Los tramos que agrupan a las etapas. Vacío es el caso normal.
   *
   * ⚠️ VIAJA PEGADO A LAS ETAPAS Y NO EN UN CAMPO APARTE DE LA PANTALLA, porque el
   * color de una columna sale de las dos cosas juntas (`colorDeEtapa`): una pantalla
   * que reciba las etapas sin las fases dibuja los colores propios, que es el estado
   * de ANTES de agrupar — y se lee como que agrupar no hizo nada.
   */
  fases: FaseEntrega[];
  origen: 'declarado' | 'default';
};

/**
 * Las etapas con las que arranca un producto que todavía no configuró su entrega.
 *
 * Son genéricas a propósito y la pantalla lo dice: `origen: 'default'`. La lección
 * está en lib/producto-con-funnel.ts — tres productos nuevos le mostraron a Martín
 * lo mismo que el funnel del negocio y los tres parecían rotos. La diferencia acá
 * es que el default no PRETENDE ser una configuración: se declara como lo que es.
 */
export const ETAPAS_ENTREGA_DEFAULT: readonly EtapaEntrega[] = [
  { key: 'onboarding', label: 'Onboarding', tone: 'info',   dot: '#2F6DDB' },
  { key: 'arranque',   label: 'Arranque',   tone: 'accent', dot: '#E08A12' },
  { key: 'hito1',      label: 'Hito 1',     tone: 'teal',   dot: '#0E8E7E' },
  { key: 'hito2',      label: 'Hito 2',     tone: 'violet', dot: '#6A4BD8' },
  { key: 'entregado',  label: 'Entregado',  tone: 'good',   dot: '#3B6D11' },
];

/** La entrega de un producto que no declaró nada. Nunca devuelve `[]`: un tablero
 *  sin columnas no se puede dibujar, y «no configuró» no es «no tiene». */
export function entregaPorDefecto(productoId: number): EntregaConfig {
  // Sin fases: cinco etapas genéricas no ganan nada agrupadas, y un tramo de fábrica
  // sería una estructura que nadie pidió con cara de configuración.
  return { productoId, etapas: [...ETAPAS_ENTREGA_DEFAULT], fases: [], origen: 'default' };
}

/**
 * El color con el que se dibuja una etapa: el de su FASE si tiene, el suyo si no.
 *
 * ⚠️ SE DECIDE ACÁ Y NO EN LA PANTALLA. El punto de la cabecera y la línea de arriba de
 * la columna son el mismo color por construcción; si cada uno lo resolviera por su
 * cuenta, el día que alguien cambie la regla quedan dos colores para la misma etapa.
 */
export function colorDeEtapa(e: EtapaEntrega, fases: readonly FaseEntrega[]): string {
  return faseDe(fases, e.fase)?.dot ?? e.dot;
}

export function faseDe(fases: readonly FaseEntrega[], key: string | null | undefined): FaseEntrega | null {
  return (key && fases.find((f) => f.key === key)) || null;
}

/**
 * Las etapas de una fase, en el orden del tablero.
 *
 * `null` = todas. Es lo que usan los chips de arriba del tablero: el de «Todas» no es un
 * caso especial, es la ausencia de filtro.
 */
export function etapasDeFase(etapas: readonly EtapaEntrega[], fase: string | null): EtapaEntrega[] {
  return fase === null ? [...etapas] : etapas.filter((e) => e.fase === fase);
}

/** La primera columna: donde cae un cliente que entra a la entrega. */
export function etapaInicial(etapas: readonly EtapaEntrega[]): string | null {
  return etapas[0]?.key ?? null;
}

export function etapaValida(etapas: readonly EtapaEntrega[], key: string | null | undefined): boolean {
  return Boolean(key) && etapas.some((e) => e.key === key);
}

export function etapaDe(etapas: readonly EtapaEntrega[], key: string | null | undefined): EtapaEntrega | null {
  return etapas.find((e) => e.key === key) ?? null;
}

/**
 * El reloj que vuelve con un DESHACER: la `etapa_desde` que la fila tenía ANTES del
 * movimiento que se está deshaciendo. `null` = no hay uno válido y se usa «ahora».
 *
 * ⚠️ SIN ESTO, DESHACER MIENTE SOBRE EL TIEMPO. El deshacer llega al choke point como un
 * movimiento más, y un movimiento escribe `etapa_desde = ahora`: un cliente trabado hace
 * tres semanas (el rojo de «En la etapa») que alguien arrastró por error y devolvió con
 * el toast quedaba como recién llegado. Y la pantalla no lo mostraba — restauraba en su
 * estado la fila de antes, con su fecha vieja — así que el dato cambiaba recién en el
 * próximo F5. Medido leyendo el código el 05/10/2026, verificando la integración del lote.
 *
 * Lo manda el navegador, así que se valida: una fecha ilegible o del FUTURO no se escribe.
 * No hay tolerancia de relojes porque la fecha la escribió el server (es la que leyó la
 * página); la única que nace en el navegador es la de un movimiento de esta misma sesión,
 * y si ése quedó adelantado, «ahora» es la misma respuesta.
 */
export function relojDeVuelta(iso: string | null | undefined, ahora: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > ahora) return null;
  return new Date(t).toISOString();
}

/** Sólo letras, números y guión bajo: la clave viaja en JSON, en la URL y en el
 *  `value` de un `<option>`. */
const CLAVE_OK = /^[a-z0-9_]+$/;

/**
 * Una clave nueva a partir del rótulo que escribió la persona.
 *
 * ⚠️ NUNCA devuelve una clave que ya exista, ni siquiera una que haya existido y
 * se haya borrado si se le pasa en `existentes`. Reusar una clave es peor que
 * duplicarla: las filas viejas de `cliente_entrega` que apuntaban a la etapa
 * borrada reaparecerían dentro de la nueva, con clientes en una columna a la que
 * nadie los movió.
 */
export function nuevaClaveEtapa(label: string, existentes: readonly string[]): string {
  const base = (label ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const raiz = CLAVE_OK.test(base) ? base : 'etapa';
  const usadas = new Set(existentes);
  if (!usadas.has(raiz)) return raiz;
  for (let i = 2; i < 500; i++) {
    const cand = `${raiz}_${i}`;
    if (!usadas.has(cand)) return cand;
  }
  // 500 etapas con el mismo nombre no es un caso real; igual no se devuelve algo
  // que colisione.
  return `${raiz}_${usadas.size + 1}`;
}

/**
 * Una clave nueva de FASE. Misma regla que la de etapa y por el mismo motivo: una clave
 * reusada haría que las etapas de una fase borrada reaparezcan dentro de la nueva.
 *
 * El prefijo evita el otro choque, que es más silencioso: una fase y una etapa pueden
 * llamarse igual («Cimientos» las dos), y sin prefijo compartirían clave — con lo cual
 * una etapa apuntaría a una fase por accidente.
 */
export function nuevaClaveFase(label: string, existentes: readonly string[]): string {
  const sinPrefijo = existentes.map((k) => k.replace(/^f_/, ''));
  return `f_${nuevaClaveEtapa(label, sinPrefijo)}`;
}

/** El color de la próxima etapa que se agregue, rotando la paleta del CRM para
 *  que dos columnas seguidas no salgan iguales. */
export function colorNuevaEtapa(cuantas: number): Pick<EtapaEntrega, 'tone' | 'dot'> {
  return {
    tone: NEW_STAGE_TONES[cuantas % NEW_STAGE_TONES.length] ?? 'neutral',
    dot: NEW_STAGE_PALETTE[cuantas % NEW_STAGE_PALETTE.length] ?? '#5A463A',
  };
}

/**
 * Las secuencias que quedan apuntando a una etapa que se está por borrar, en una frase.
 *
 * Es el aviso MÁS caro del editor de etapas: un cliente sin columna se puede volver a
 * mover y mientras tanto el tablero lo muestra, pero una secuencia sin etapa deja de
 * dispararse y no se ve en ningún lado.
 *
 * ⚠️ EL PLURAL SALE DEL TOTAL, no de cada entrada. Con los verbos cableados en plural,
 * sacar UNA columna con UNA secuencia escribía «1 secuencia en Hito 1: al guardar DEJAN
 * de dispararse. ReapúntaLAS». Un aviso que no concuerda se lee como un texto
 * automático, y a un texto automático se le hace menos caso — justo en el renglón que
 * tiene que frenar a alguien.
 *
 * Devuelve `''` cuando no hay nada que avisar.
 */
export function fraseSecuenciasHuerfanas(sacadas: readonly { label: string; n: number }[]): string {
  const vivas = sacadas.filter((x) => x.n > 0);
  if (!vivas.length) return '';
  const total = vivas.reduce((a, x) => a + x.n, 0);
  const lista = vivas.map((x) => `${x.n} ${x.n === 1 ? 'secuencia' : 'secuencias'} en ${x.label}`).join(' · ');
  const verbo = total === 1 ? 'deja' : 'dejan';
  const reapunta = total === 1 ? 'Reapúntala' : 'Reapúntalas';
  return `${lista}: al guardar ${verbo} de dispararse. ${reapunta} en Chatbot antes de guardar.`;
}

/**
 * Lo que se pierde de la ENTREGA al borrar un producto, en una frase.
 *
 * Vive acá —módulo puro, sin `server-only`— y no adentro de la acción de MaKo por la
 * misma razón de siempre: la condición que gobierna un texto irreversible tiene que
 * poder testearse. Adentro del `preparar()` ningún test la puede importar, y termina
 * siendo lo único sin red justo donde más duele.
 *
 * ⚠️ `null` NO ES CERO. `null` es «no pude contar», y decir «ninguno» sobre una
 * consulta caída es exactamente la clase de afirmación que hace que se apriete el
 * botón. Se dice que no se pudo revisar y la decisión sigue siendo de quien lee.
 *
 * Devuelve `''` cuando no hay nada que agregar: un producto sin nadie en su entrega no
 * necesita un renglón diciendo que no pasa nada.
 */
export function fraseEntregaAlBorrar(enEntrega: number | null): string {
  if (enEntrega === null) return ' No pude revisar si tienes clientes en su entrega.';
  if (enEntrega <= 0) return '';
  const q = enEntrega === 1 ? 'cliente pierde su etapa' : 'clientes pierden su etapa';
  // El historial se nombra a propósito: es la mitad que NO se pierde, y sin decirla el
  // aviso suena a que se borra todo rastro del cliente.
  return ` ${enEntrega} ${q} de entrega en Customer Success; el historial de cada uno se conserva.`;
}

/**
 * El `campo` con el que un movimiento de entrega queda en `lead_audit`.
 *
 * Lleva el NOMBRE DEL PRODUCTO adentro porque un cliente puede estar en varias
 * entregas a la vez («pueden tener muchos productos»): dos líneas que dijeran
 * «Entrega: Onboarding → Hito 1» sin nombrar el servicio son indistinguibles, y
 * `lead_audit` sólo tiene dos columnas de valor (anterior y nuevo), así que el
 * tercer dato no tiene otro lugar donde ir.
 *
 * Que una línea vieja conserve el nombre que el producto tenía ENTONCES es
 * correcto, no un defecto: un historial dice lo que pasó, y renombrar el producto
 * no cambia lo que se escribió ese día. Es exactamente por esto que la CLAVE de la
 * etapa es estable y el rótulo es decoración.
 */
export const PREFIJO_CAMPO_ENTREGA = 'Entrega: ';

export function campoEntrega(nombreProducto: string): string {
  const n = (nombreProducto ?? '').trim();
  return `${PREFIJO_CAMPO_ENTREGA}${n || 'servicio'}`;
}

/** ¿Esta línea del historial es un movimiento de entrega? */
export function esCampoEntrega(campo: string): boolean {
  return typeof campo === 'string' && campo.startsWith(PREFIJO_CAMPO_ENTREGA);
}

/**
 * Dónde va cada cliente en el tablero de un servicio.
 *
 * ⚠️ UN CLIENTE SIN FILA ESTÁ EN LA PRIMERA ETAPA, no afuera del tablero. Es la regla
 * que gobierna todo esto y se pagó viéndola: «no puede ser que yo vea muchos leads en la
 * vista de tabla y luego no vea nada en la vista de kanban... Jamás puede ser eso»
 * (Martín, 05/10/2026). Con 14 clientes y cero filas, el tablero dibujaba cinco columnas
 * vacías al lado de una tabla con catorce renglones — dos vistas de la misma cartera
 * contando cosas distintas.
 *
 * Y es DERIVADO, no sembrado: no hay que escribirle una fila a nadie. El cliente que se
 * gane mañana aparece solo en la primera columna, y recién se le escribe una fila cuando
 * alguien lo mueve. Un backfill habría arreglado a los catorce de hoy y dejado al
 * decimoquinto afuera.
 *
 * `huerfanos` son los que SÍ tienen fila, con una etapa que el catálogo ya no tiene
 * (alguien borró esa columna). Esos NO se reparten: inventarles una etapa sería afirmar
 * algo que nadie decidió, y por eso salen aparte para que la pantalla los nombre.
 */
export function repartirEnEtapas<T>(
  etapas: readonly EtapaEntrega[],
  clientes: readonly T[],
  etapaDe: (c: T) => string | null | undefined,
): { porEtapa: Record<string, T[]>; huerfanos: T[] } {
  const porEtapa: Record<string, T[]> = {};
  // Se inicializa con el UNIVERSO: una columna sin nadie tiene que existir como lista
  // vacía, o «nadie acá» se vuelve indistinguible de «no pude leer».
  for (const e of etapas) porEtapa[e.key] = [];
  const primera = etapas[0]?.key ?? null;
  const huerfanos: T[] = [];
  for (const c of clientes) {
    const k = (etapaDe(c) ?? '').trim();
    if (!k) {
      if (primera) porEtapa[primera].push(c);
      // Sin etapas no hay tablero, y entonces tampoco hay dónde ponerlo. No se pierde:
      // el llamador no puede dibujar un tablero de cero columnas y lo dice antes.
      continue;
    }
    if (k in porEtapa) porEtapa[k].push(c);
    else huerfanos.push(c);
  }
  return { porEtapa, huerfanos };
}

/**
 * Cuantos hay en cada etapa.
 *
 * ⚠️ SE INICIALIZA CON EL UNIVERSO, y es toda la razon por la que existe en vez de un
 * `reduce` en cada pantalla. Contando solo lo que aparece, una etapa sin clientes no
 * entra al mapa y el lector recibe `undefined`: un `if (n === 0)` —la rama que saca la
 * friccion de borrar una columna vacia— no corre NUNCA, y un `if (!n)` trata un error
 * de lectura como un cero. Con el universo puesto, `undefined` vuelve a significar lo
 * unico que deberia: no se pudo leer. Es el bug que el CRM ya pago el 29/09/2026 con el
 * conteo de leads por etapa.
 *
 * Lo que NO cuenta: una etapa guardada que ya no esta en el catalogo. Esos clientes
 * existen y el tablero los lista aparte — sumarlos a una columna que no les toca seria
 * inventarles una etapa.
 */
export function conteoDeEtapas(
  etapas: readonly EtapaEntrega[],
  etapasDeCadaUno: Iterable<string | null | undefined>,
): Record<string, number> {
  // ⚠️ CUENTA LO MISMO QUE SE DIBUJA, y por eso delega en `repartirEnEtapas` en vez de
  // tener su propio bucle: con dos implementaciones, el editor de etapas termina
  // diciendo «0 en Onboarding» sobre una columna que muestra catorce clientes — porque
  // una de las dos sabe que un cliente sin fila está en la primera y la otra no.
  const { porEtapa } = repartirEnEtapas(etapas, [...etapasDeCadaUno], (k) => k);
  const out: Record<string, number> = {};
  for (const e of etapas) out[e.key] = porEtapa[e.key]?.length ?? 0;
  return out;
}

/**
 * Lee lo que haya en la base y devuelve etapas usables, o `null` si no hay nada
 * declarado.
 *
 * ⚠️ FALLA CERRADO: con un jsonb corrupto, una etapa sin `key` o claves repetidas
 * devuelve `null` —o sea «no declarado», y el tablero cae al default— en vez de
 * devolver una lista a medias. Un kanban al que le falta una columna no avisa: los
 * clientes de esa etapa simplemente no se dibujan, y eso se lee como «no tengo
 * clientes ahí», que es una afirmación falsa.
 */
export function normalizarFases(raw: unknown): FaseEntrega[] {
  // ⚠️ ACÁ EL VACÍO ES LEGÍTIMO, al revés que con las etapas: no tener fases es el
  // estado normal de un servicio, así que un jsonb sin `fases` devuelve `[]` y no `null`.
  // Lo que sí se descarta entero es una lista ROTA: media lista de fases dejaría etapas
  // apuntando a una fase que no se dibuja, o sea columnas con el color equivocado.
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const vistas = new Set<string>();
  const out: FaseEntrega[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object') return [];
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    if (!CLAVE_FASE_OK.test(key) || vistas.has(key)) return [];
    vistas.add(key);
    const fallback = colorNuevaEtapa(i);
    out.push({
      key,
      label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : key,
      tone: typeof o.tone === 'string' ? (o.tone as StageTone) : fallback.tone,
      dot: typeof o.dot === 'string' && o.dot.trim() ? o.dot : fallback.dot,
    });
  }
  return out;
}

/** Las claves de fase llevan el prefijo: ver `nuevaClaveFase`. */
const CLAVE_FASE_OK = /^f_[a-z0-9_]+$/;

export function normalizarEtapas(raw: unknown): EtapaEntrega[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const vistas = new Set<string>();
  const out: EtapaEntrega[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    if (!CLAVE_OK.test(key) || vistas.has(key)) return null;
    vistas.add(key);
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : key;
    const fallback = colorNuevaEtapa(i);
    out.push({
      key,
      label,
      tone: typeof o.tone === 'string' ? (o.tone as StageTone) : fallback.tone,
      dot: typeof o.dot === 'string' && o.dot.trim() ? o.dot : fallback.dot,
      // ⚠️ SOBREVIVE AL SANEO. Un mapper que reconstruye campo por campo y se olvida uno
      // lo borra en el próximo guardado de cualquier otro campo — y acá lo que se
      // borraría es a qué fase pertenece la columna, o sea su color. Se valida contra el
      // catálogo al PINTAR (`colorDeEtapa` cae al color propio si la fase no existe), no
      // acá: este saneo no conoce las fases.
      ...(typeof o.fase === 'string' && CLAVE_FASE_OK.test(o.fase.trim()) ? { fase: o.fase.trim() } : {}),
      // ⚠️ EL LINK DE AGENDA TAMBIÉN SOBREVIVE AL SANEO (#665), por la misma razón que la fase: el
      // `data` se guarda ENTERO, y lo que este mapper no copie se borra en el próximo guardado de
      // un nombre o un color. Uno que no sirve se tira acá en silencio: el editor ya dijo «no
      // sirve» antes de mandarlo (`agendaValida`), así que lo único que llega roto es un pedido
      // armado a mano.
      ...(agendaValida(o.agendaUrl) ? { agendaUrl: agendaValida(o.agendaUrl)! } : {}),
    });
  }
  return out;
}
