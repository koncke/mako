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

/** Una etapa de la entrega de UN producto. */
export type EtapaEntrega = {
  /** Estable y única dentro del producto. NUNCA se renombra ni se reusa. */
  key: string;
  /** Lo que se ve. Se edita libremente; nada apunta acá. */
  label: string;
  /** Color del chip en el kanban. Misma paleta que el CRM, no una segunda. */
  tone: StageTone;
  dot: string;
};

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
  return { productoId, etapas: [...ETAPAS_ENTREGA_DEFAULT], origen: 'default' };
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

/** El color de la próxima etapa que se agregue, rotando la paleta del CRM para
 *  que dos columnas seguidas no salgan iguales. */
export function colorNuevaEtapa(cuantas: number): Pick<EtapaEntrega, 'tone' | 'dot'> {
  return {
    tone: NEW_STAGE_TONES[cuantas % NEW_STAGE_TONES.length] ?? 'neutral',
    dot: NEW_STAGE_PALETTE[cuantas % NEW_STAGE_PALETTE.length] ?? '#5A463A',
  };
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
  etapasDeCadaUno: Iterable<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of etapas) out[e.key] = 0;
  for (const k of etapasDeCadaUno) if (k in out) out[k] += 1;
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
    });
  }
  return out;
}
