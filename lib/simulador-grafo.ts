// =============================================================================
// simulador-grafo — «Probar» recorre el FLUJO que se está editando, tarjeta por tarjeta
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10): «El botón de probar se rompe… No tiene la animación
// de entrada de los mensajes y tampoco puedo interactuar, para probarlo de verdad». Molde de
// ManyChat («In Manychat»): un teléfono al lado del lienzo que recorre la automatización; en una
// condición, quien prueba ELIGE la rama; una espera no espera; una acción no se ejecuta.
//
// Módulo PURO y sin `server-only`: lo ejecutan tests/simulador-grafo.test.ts y
// tests/simulador-hilos.test.ts, y lo usa el panel (app/chatbot/PanelProbar.tsx). La navegación es
// la de lib/flujo-grafo.ts —la MISMA que lee el motor—, así que lo que se prueba es lo que va a
// pasar, y no un setter libre como antes: la #198 tenía cero casos y en el simulador viejo MaKo
// contestaba igual, mientras en producción toda respuesta iba a hand-off. Un simulador que no
// recorre el dato del motor afirma algo que el motor no hace.
//
// ── QUÉ SE PRUEBA: LO QUE SE VE, NO LO GUARDADO ──────────────────────────────
// Recibe los pasos LOCALES (lo que el lienzo tiene sin publicar, `onCambioLocal`). Antes
// «Probar» desmontaba el editor y simulaba la prop guardada: se probaba otra cosa y encima se
// perdía lo escrito.
//
// ── LAS DOS RAÍCES ───────────────────────────────────────────────────────────
// La SALIDA arranca en `raicesSalida` y corre sola. Una respuesta del lead la PAUSA
// (`pausarPorRespuesta`, igual que el motor) y corre «Si responde»: el servidor clasifica contra
// los casos locales y este módulo entra por la rama elegida (`entrarEnRespuesta`). Un «Ir a» a una
// tarjeta desde «Si responde» RETOMA la salida ahí (lo mismo que hace el motor).
//
// ── SEGUNDA TANDA (08/10/2026, noche): VARIOS CAMINOS A LA VEZ ───────────────
// Pedido de Martín, punto 2: «de un mismo cron puedo sacar todo una secuencia para WhatsApp y
// toda otra secuencia de email». Con flechas en paralelo (`paralelos`, lib/flujo-grafo.ts) la
// salida deja de ser UN cursor: es una lista de HILOS, cada uno con su RELOJ en minutos virtuales
// (docs/chatbot-flujo-ramas-diseno.md, «"Probar" (parte P)», y la decisión 3 del motor).
//
//   · Corre el hilo de reloj más bajo; en un empate, el primero del array (que es el orden en
//     que nacieron). Así la prueba muestra el ORDEN REAL: el WhatsApp del día 0, el email del
//     día 0, y recién después el WhatsApp del día 1. Con un solo cursor, «Probar» mostraba toda
//     la rama de WhatsApp —días incluidos— antes del primer email.
//   · Una espera suma sus minutos al reloj de SU hilo y nada más.
//   · Una tarjeta con flechas en paralelo, cuando termina, agrega un hilo por flecha con el
//     reloj que tiene el padre en ese momento (una espera termina DESPUÉS de esperar).
//   · Una condición pendiente frena la prueba ENTERA: una pregunta a la vez, aunque otro hilo
//     tenga algo para mostrar.
//   · Una respuesta del lead pausa TODOS los hilos (como el motor, decisión 4); «Si responde»
//     corre en UN hilo, y su «Ir a {tarjeta}» retoma la salida en UN hilo y descarta los
//     congelados.
//   · Las raíces y las salidas salen del modelo (`raicesSalida`, `puertosDe`), no de una idea
//     propia: el puerto `par:<id>` es la flecha en paralelo.
// =============================================================================

import {
  type PasoGrafo, type NombresParaTexto,
  claseDe, idDe, indicePorId, nodoPorId, normalizar, puertosDe, raicesSalida, raizRespuesta,
  textoEspera, textoRama, TOPE_HILOS,
} from './flujo-grafo';
import { legadoAGrafo, tieneLegado, type EstrategiaLegada } from './flujo-legado';
import { aplicarVariables, valoresVariablesLead, VARIABLES_LEAD } from './template-vars';
// El HTML de un email (parte C de la tercera tanda): puro y sin `server-only`, como este módulo.
import { aplicarVariablesHtml, sanearHtmlEmail, htmlEmailVacio, TOPE_HTML_EMAIL } from './email-html-seguro';

/** Topes: el motor corta a 20 saltos por corrida; acá además se cortan las vueltas infinitas. */
export const TOPE_SALTOS = 20;
export const TOPE_EVENTOS = 200;

export type OpcionRama = { puerto: string; texto: string; destino: string | null };

/** Lo que pasa en el teléfono, de a uno. El panel decide CÓMO se ve (burbuja, píldora, chips). */
export type EventoSim<P extends PasoGrafo = PasoGrafo> =
  | { t: 'mensaje'; nodo: string; paso: P; enRespuesta: boolean }
  | { t: 'espera'; nodo: string; texto: string }
  | { t: 'accion'; nodo: string; texto: string }
  | { t: 'salto'; nodo: string; texto: string }
  | { t: 'condicion'; nodo: string; opciones: OpcionRama[] }
  | { t: 'fin'; texto: string };

export type CasoElegido = { id: string | null; titulo: string; cuando: string };

/**
 * Un camino que corre: en qué tarjeta está y su reloj.
 *
 * `esperado`: la espera donde está parado YA se sumó al reloj y falta DECIRLA. La píldora
 * «⏳ Esperar 1 día» sale cuando a este hilo le vuelve a tocar —o sea, después de lo que los
 * otros hilos mandan mientras tanto—, justo antes de lo que sigue a la espera. Si saliera al
 * empezar a esperar, el email del día 0 aparecería DEBAJO de «Esperar 1 día» y se leería como
 * que llega al día siguiente.
 */
export type HiloSim = { cursor: string; reloj: number; esperado?: true };

export type EstadoSim = {
  /**
   * Los caminos vivos (vacío = no queda nada que correr). Sin flechas en paralelo hay uno solo,
   * como siempre. Un hilo que termina SALE del array: su `cursor` nunca es null.
   */
  hilos: HiloSim[];
  rama: 'salida' | 'respuesta';
  /**
   * La condición que espera que quien prueba elija, y en QUÉ hilo (su índice: mientras se elige
   * no corre nada, así que el array no cambia). Mientras no elija, no avanza ningún hilo.
   */
  eligiendo: { nodo: string; opciones: OpcionRama[]; hilo: number } | null;
  /** Una respuesta del lead pausó la salida: ya no corre (salvo un «Ir a» desde «Si responde»). */
  salidaPausada: boolean;
  terminado: boolean;
  saltos: number;
  eventos: number;
  /**
   * El minuto virtual de lo último que corrió. Una respuesta del lead llega «ahora»: el hilo de
   * «Si responde» (y el que retoma la salida con un «Ir a») nace con este reloj.
   */
  ahora: number;
  /** El caso de «Si responde» por el que se entró (para redactar «MaKo contesta»). */
  caso: CasoElegido | null;
};

/** Los nombres que el texto de una píldora necesita y este módulo no tiene. */
export type NombresSim = NombresParaTexto & {
  secuencia?: (id: number) => string | null;
  accion?: (operacion: string) => string | null;
};

// ── El flujo que se prueba ─────────────────────────────────────────────────────

/**
 * El flujo a recorrer. Una secuencia de ANTES (delays en el paso, `requiere`, casos en la
 * estrategia) se pasa a tarjetas con `legadoAGrafo`, que es lo que hace el lienzo al abrirla y lo
 * que corre el motor: así el simulador no tiene una segunda idea de qué significaba.
 *
 * ⚠️ SÓLO SI TODAVÍA NO ES UN FLUJO. Un flujo que ya tiene tarjetas de control (`nodo`) se
 * normaliza y nada más: convertirlo otra vez con una estrategia sin limpiar le agregaría una
 * SEGUNDA tarjeta «Si responde» con los casos viejos.
 */
export function flujoParaProbar<P extends PasoGrafo>(
  pasos: readonly P[],
  est: EstrategiaLegada,
  op: { idDeClave?: (clave: string) => number | null } = {},
): { pasos: P[]; notas: string[] } {
  const yaEsFlujo = pasos.some((p) => p?.nodo != null);
  if (!yaEsFlujo && tieneLegado(pasos, est)) {
    const r = legadoAGrafo(pasos, est, { idDeClave: op.idDeClave });
    return { pasos: r.pasos, notas: r.notas };
  }
  return { pasos: normalizar(pasos), notas: [] };
}

/** Una huella corta del flujo, para decir «Cambió» si se edita mientras se prueba. */
export function firmaFlujo(pasos: readonly unknown[]): string {
  const s = JSON.stringify(pasos ?? []);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

// ── El lead de ejemplo ─────────────────────────────────────────────────────────

/**
 * El lead con el que se resuelven las variables: los EJEMPLOS del catálogo del motor
 * (lib/template-vars.ts), no un «Juan / Acme SRL» propio. El simulador viejo tenía su propio
 * reemplazo y dejaba crudos `{{negocio}}` y `{{nombre_completo}}`, que el motor sí resuelve.
 */
const ejemplo = (key: string): string => VARIABLES_LEAD.find((v) => v.key === key)?.ejemplo ?? '';
export const LEAD_DE_EJEMPLO = { nombre: ejemplo('nombre_completo'), empresa: ejemplo('empresa') };

/** El texto tal como le llegaría al lead de ejemplo. Lo desconocido queda CRUDO, como en el motor. */
export function textoDeEjemplo(texto: string, negocio?: string | null): string {
  return aplicarVariables(texto ?? '', valoresVariablesLead(LEAD_DE_EJEMPLO, { negocio }));
}

/**
 * Un email del flujo tal como lo ve el lead en su bandeja: el asunto, la vista previa (el
 * `preheader`, lo gris que Gmail pone al lado del asunto) y el cuerpo, con las variables del lead
 * de ejemplo. «Probar» lo dibuja como un MAIL y no como una burbuja de WhatsApp: un email que se
 * ve como un WhatsApp no prueba cómo llega (decisión 11 de la segunda tanda).
 *
 * Vacío = vacío: el panel decide qué rótulo poner («Sin asunto»), y la vista previa ausente no se
 * reemplaza por el principio del cuerpo, que ya se ve debajo.
 *
 * `html`: el cuerpo del editor rico (`cuerpo_html`, parte C de la tercera tanda) con las variables
 * puestas POR CONTEXTO (`aplicarVariablesHtml`: escapadas en el texto, codificadas en un link), que es
 * como lo pone el envío. '' = el paso no tiene HTML (un email de antes): se dibuja el `cuerpo`.
 */
export function correoDeEjemplo(
  p: { asunto?: string | null; preheader?: string | null; cuerpo?: string | null; cuerpo_html?: string | null },
  negocio?: string | null,
): { asunto: string; vistaPrevia: string; cuerpo: string; html: string } {
  return {
    asunto: textoDeEjemplo(p.asunto ?? '', negocio).trim(),
    vistaPrevia: textoDeEjemplo(p.preheader ?? '', negocio).trim(),
    cuerpo: textoDeEjemplo(p.cuerpo ?? '', negocio),
    html: p.cuerpo_html ? aplicarVariablesHtml(p.cuerpo_html, valoresVariablesLead(LEAD_DE_EJEMPLO, { negocio })) : '',
  };
}

// ── Recorrer ───────────────────────────────────────────────────────────────────

export function iniciar(pasos: readonly PasoGrafo[]): EstadoSim {
  // Un hilo por raíz: la principal y cada flecha en paralelo del CRON, todas en el minuto 0.
  const hilos = raicesSalida(pasos).slice(0, TOPE_HILOS).map((cursor) => ({ cursor, reloj: 0 }));
  return { hilos, rama: 'salida', eligiendo: null, salidaPausada: false, terminado: false, saltos: 0, eventos: 0, ahora: 0, caso: null };
}

/** El hilo que corre ahora: el de reloj más bajo; en un empate, el primero del array. */
export function proximoHilo(hilos: readonly HiloSim[]): number {
  let k = 0;
  for (let i = 1; i < hilos.length; i++) if (hilos[i].reloj < hilos[k].reloj) k = i;
  return k;
}

const nombreAccion = (p: PasoGrafo, n: NombresSim): string => {
  const a = p.accion as { operacion?: unknown } | null | undefined;
  const op = typeof a?.operacion === 'string' ? a.operacion : '';
  if (!op) return 'Acción sin elegir';
  return n.accion?.(op) ?? op.replace(/_/g, ' ');
};

type Paso<P extends PasoGrafo> = { evento: EventoSim<P> | null; estado: EstadoSim };

function fin<P extends PasoGrafo>(estado: EstadoSim, texto: string): Paso<P> {
  return { evento: { t: 'fin', texto }, estado: { ...estado, hilos: [], eligiendo: null, terminado: true } };
}

/**
 * Las salidas de una tarjeta de UNA salida, leídas de sus PUERTOS (el modelo): la de siempre
 * (`sig`) y las flechas en paralelo (`par:<id>`).
 */
function salidasDe(pasos: readonly PasoGrafo[], i: number): { sig: string | null; paralelos: string[] } {
  const pts = puertosDe(pasos, i);
  return {
    sig: pts.find((pt) => pt.puerto === 'sig')?.destino ?? null,
    paralelos: pts.filter((pt) => pt.puerto.startsWith('par:') && pt.destino).map((pt) => pt.destino as string),
  };
}

/**
 * El hilo `k` terminó su tarjeta: sigue en `sig` (o sale del array si no hay nada después) y
 * cada flecha en paralelo agrega un hilo AL FINAL con el mismo reloj.
 *
 * ⚠️ El tope de hilos vivos (`TOPE_HILOS`) se respeta acá aunque `validarGrafo` ya lo exija: lo
 * que se prueba es lo LOCAL, sin publicar, y puede ser un flujo que no se podría guardar. Lo que
 * no entra no se abre; el tope de eventos corta el resto.
 */
function seguir(hilos: readonly HiloSim[], k: number, sig: string | null, paralelos: readonly string[], reloj: number): HiloSim[] {
  const out = hilos.slice();
  if (sig) out[k] = { cursor: sig, reloj };
  else out.splice(k, 1);
  for (const d of paralelos) if (out.length < TOPE_HILOS) out.push({ cursor: d, reloj });
  return out;
}

/**
 * El hilo `k` se cierra sin decir nada (una tarjeta que ya no existe, un «Ir a» sin destino). Si
 * era el último, la prueba termina con `texto`.
 */
function cerrarHilo<P extends PasoGrafo>(estado: EstadoSim, k: number, texto: string): Paso<P> {
  const hilos = estado.hilos.filter((_, j) => j !== k);
  if (!hilos.length) return fin(estado, texto);
  return { evento: null, estado: { ...estado, hilos } };
}

/**
 * Corre UNA tarjeta del hilo `k`. `evento: null` = avanzó sin nada que mostrar (contó una espera,
 * cerró un hilo en silencio): `siguiente` vuelve a elegir hilo.
 */
function correrHilo<P extends PasoGrafo>(pasos: readonly P[], estado: EstadoSim, k: number, nombres: NombresSim): Paso<P> {
  const h = estado.hilos[k];
  const st: EstadoSim = { ...estado, ahora: h.reloj };
  const i = indicePorId(pasos, h.cursor);
  if (i < 0) return cerrarHilo(st, k, 'Esa tarjeta ya no existe');
  const p = pasos[i];
  const id = idDe(p, i);
  // `eventos` cuenta lo que se MUESTRA: lo que avanza en silencio (`cerrarHilo`, contar una
  // espera) parte de `st`.
  const base: EstadoSim = { ...st, eventos: st.eventos + 1 };
  // Adentro de «Si responde» no se reparte (no se puede guardar: `validarGrafo`), y la respuesta
  // corre en UN hilo, como en el motor.
  const avanzar = (reloj: number): HiloSim[] => {
    const s = salidasDe(pasos, i);
    return seguir(st.hilos, k, s.sig, st.rama === 'respuesta' ? [] : s.paralelos, reloj);
  };
  switch (claseDe(p)) {
    case 'mensaje':
      return { evento: { t: 'mensaje', nodo: id, paso: p, enRespuesta: st.rama === 'respuesta' }, estado: { ...base, hilos: avanzar(h.reloj) } };
    case 'accion':
      // No se ejecuta: probar no puede mover un lead ni crear una tarea de verdad.
      return { evento: { t: 'accion', nodo: id, texto: `⚡ ${nombreAccion(p, nombres)}` }, estado: { ...base, hilos: avanzar(h.reloj) } };
    case 'esperar': {
      if (!h.esperado) {
        // No espera: suma al reloj de SU hilo y lo dice cuando le vuelve a tocar (ver `HiloSim`).
        // «N antes de la reunión» no mueve el reloj: la prueba no tiene una reunión de la que
        // descontar, y un número inventado ordenaría los hilos con un dato que no existe.
        const min = p.espera?.modo === 'tiempo' ? Math.max(0, Number(p.espera.minutos) || 0) : 0;
        const hilos = st.hilos.slice();
        hilos[k] = { cursor: h.cursor, reloj: h.reloj + min, esperado: true };
        return { evento: null, estado: { ...st, hilos } };
      }
      return { evento: { t: 'espera', nodo: id, texto: `⏳ ${textoEspera(p.espera)}` }, estado: { ...base, hilos: avanzar(h.reloj) } };
    }
    case 'condicion': {
      const opciones: OpcionRama[] = [
        ...(p.ramas ?? []).map((r) => ({ puerto: r.id, texto: textoRama(r, nombres), destino: r.siguiente ?? null })),
        { puerto: 'si_no', texto: 'Si no', destino: p.si_no ?? null },
      ];
      return { evento: { t: 'condicion', nodo: id, opciones }, estado: { ...base, eligiendo: { nodo: id, opciones, hilo: k } } };
    }
    case 'respuesta':
      // A «Si responde» se entra por una respuesta del lead, no caminando (y no se puede guardar
      // una flecha hacia ella). Se cierra ese hilo; si era el último, se dice qué falta.
      return cerrarHilo(st, k, 'Espera la respuesta');
    case 'inicio':
      // El CRON no es una tarjeta del camino: nadie puede seguir en él (`validarGrafo`).
      return cerrarHilo(st, k, 'Fin');
    case 'ir_a': {
      const d = p.destino;
      if (!d) return cerrarHilo(st, k, 'Fin');
      if ('secuencia_id' in d) {
        // Cierra SU hilo (el motor la inscribe en la otra); los demás siguen.
        const nom = nombres.secuencia?.(d.secuencia_id) ?? 'otra automatización';
        const hilos = st.hilos.filter((_, j) => j !== k);
        return { evento: { t: 'salto', nodo: id, texto: `↪ Sigue en «${nom}»` }, estado: { ...base, hilos, terminado: hilos.length === 0 } };
      }
      const saltos = st.saltos + 1;
      if (saltos > TOPE_SALTOS) return fin(base, 'Se repite: fin de la prueba');
      const evento: EventoSim<P> = { t: 'salto', nodo: id, texto: '↪ Ir a otra tarjeta' };
      if (st.rama === 'respuesta') {
        // Desde «Si responde», un salto a una tarjeta RETOMA la salida ahí en UN hilo (el motor
        // hace lo mismo y descarta los congelados: retomar todo junto le mandaría varios mensajes
        // seguidos a alguien que acaba de escribir).
        return { evento, estado: { ...base, saltos, hilos: [{ cursor: d.nodo, reloj: h.reloj }], rama: 'salida', salidaPausada: false } };
      }
      const hilos = st.hilos.slice();
      hilos[k] = { cursor: d.nodo, reloj: h.reloj };
      return { evento, estado: { ...base, saltos, hilos } };
    }
  }
}

/** Cuántas vueltas sin evento puede dar `siguiente`: cada hilo cuenta una espera o se cierra. */
const TOPE_VUELTAS_MUDAS = TOPE_HILOS * 2 + 2;

/**
 * El próximo evento. `null` cuando no hay nada que correr: terminó, espera una elección, o la
 * salida está pausada. Un evento por llamada: el panel pone el «escribiendo…» y la pausa entre
 * uno y otro.
 */
export function siguiente<P extends PasoGrafo>(
  pasos: readonly P[],
  estado: EstadoSim,
  nombres: NombresSim = {},
): Paso<P> {
  if (estado.terminado || estado.eligiendo) return { evento: null, estado };
  if (estado.rama === 'salida' && estado.salidaPausada) return { evento: null, estado };
  let st = estado;
  for (let vuelta = 0; vuelta <= TOPE_VUELTAS_MUDAS; vuelta++) {
    if (!st.hilos.length) {
      return fin(st, st.rama === 'respuesta' ? 'Fin de la respuesta' : st.eventos === 0 ? 'Sin tarjetas' : 'Fin');
    }
    if (st.eventos >= TOPE_EVENTOS) return fin(st, 'Se repite: fin de la prueba');
    const r = correrHilo(pasos, st, proximoHilo(st.hilos), nombres);
    if (r.evento || r.estado.terminado) return r;
    st = r.estado;
  }
  return fin(st, 'Se repite: fin de la prueba');
}

/** Quien prueba elige por qué rama sigue una condición: se mueve SU hilo, no otro. */
export function elegir(estado: EstadoSim, puerto: string): EstadoSim {
  const e = estado.eligiendo;
  if (!e) return estado;
  const o = e.opciones.find((x) => x.puerto === puerto);
  if (!o) return estado;
  const h = estado.hilos[e.hilo];
  if (!h) return { ...estado, eligiendo: null };
  return { ...estado, eligiendo: null, hilos: seguir(estado.hilos, e.hilo, o.destino, [], h.reloj) };
}

/**
 * El lead escribió: la salida se PAUSA entera —todos sus hilos—, como en el motor
 * (`pausarPorRespuesta`). Mientras la salida corre el lead no respondió; por eso las condiciones
 * de la salida no tienen «respondió». Si estaba corriendo «Si responde», esa respuesta se corta:
 * el turno nuevo la reemplaza.
 */
export function pausarPorRespuesta(estado: EstadoSim): { estado: EstadoSim; pausoLaSalida: boolean } {
  const corria = estado.rama === 'salida' && !estado.salidaPausada && !estado.terminado && estado.hilos.length > 0;
  return {
    estado: { ...estado, salidaPausada: estado.salidaPausada || estado.rama === 'salida', eligiendo: null, ...(estado.rama === 'respuesta' ? { terminado: true, hilos: [] } : {}) },
    pausoLaSalida: corria,
  };
}

/**
 * Entra a «Si responde» por el caso que eligió el clasificador (`casoId`), o por «Otra cosa»
 * (`null`), en UN hilo con el reloj de «ahora». Los hilos congelados de la salida se descartan:
 * sólo vuelve el que retome un «Ir a» (decisión 4). Sin tarjeta «Si responde», `sinRespuesta`:
 * MaKo no contesta.
 */
export function entrarEnRespuesta(
  pasos: readonly PasoGrafo[],
  estado: EstadoSim,
  casoId: string | null,
): { estado: EstadoSim; sinRespuesta: boolean; caso: CasoElegido | null } {
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r) return { estado: { ...estado, terminado: true, hilos: [], eligiendo: null }, sinRespuesta: true, caso: null };
  const c = casoId ? (r.casos ?? []).find((x) => x.id === casoId) ?? null : null;
  const caso: CasoElegido = c ? { id: c.id, titulo: c.titulo, cuando: c.cuando } : { id: null, titulo: 'Otra cosa', cuando: '' };
  const destino = c ? c.siguiente ?? null : r.si_no ?? null;
  return {
    estado: { ...estado, hilos: destino ? [{ cursor: destino, reloj: estado.ahora }] : [], rama: 'respuesta', eligiendo: null, terminado: false, saltos: 0, caso },
    sinRespuesta: false,
    caso,
  };
}

/**
 * El caso con el que se redacta un «MaKo contesta» (`tipo: 'ia'`) de «Si responde»: su `cuerpo`
 * es la guía, como en el motor (`escenariosDeRespuesta`). La forma es la del clasificador y el
 * redactor de siempre (`EscenarioSecuencia`).
 */
export function escenarioParaRedactar(estado: EstadoSim, paso: PasoGrafo): { titulo: string; cuando: string; comoResponder: string } {
  return {
    titulo: estado.caso?.titulo ?? 'Otra cosa',
    cuando: estado.caso?.cuando ?? '',
    comoResponder: String(paso.cuerpo ?? ''),
  };
}

// ── La prueba REAL: qué sale a «mi WhatsApp» / «mi email» ────────────────────────
// Lo envía lib/prueba-paso.ts (server-only). Acá vive la parte que se puede EJECUTAR en un test:
// qué forma tiene un mensaje de prueba y qué envíos produce.

/** Un mensaje tal como APARECIÓ en el panel. El texto ya trae las variables resueltas. */
export type MensajePrueba = {
  canal: 'whatsapp' | 'email';
  tipo: 'texto' | 'audio' | 'media';
  /** El texto, el pie del audio, el caption del archivo o el cuerpo del email. */
  texto: string;
  asunto?: string | null;
  audio_id?: number | null;
  media_id?: number | null;
  /** Sólo email: el cuerpo HTML como apareció en la bandeja (las variables ya puestas). */
  html?: string | null;
};

export type DestinoPrueba = { telefono: string | null; email: string | null };

/** Un envío concreto. El orden del array es el orden en que salen. */
export type EnvioPrueba =
  | { via: 'wa-texto'; texto: string }
  | { via: 'wa-audio'; audioId: number }
  | { via: 'wa-media'; mediaId: number; caption: string }
  | { via: 'email'; asunto: string; texto: string; html?: string };

/** El aviso del PRIMER mensaje real: quien lo recibe tiene que saber que es una prueba. */
export const AVISO_PRUEBA = '🧪 Prueba de MaKo';
export const TOPE_TEXTO_PRUEBA = 4000;

// ── El ritmo de la prueba real (revisión adversarial del 08/10/2026, datos-4) ─────────────────
// Medido sobre el recorrido: un flujo mensaje → esperar → «Ir a» el mismo mensaje, con «A mi
// WhatsApp» prendido, mandaba ~21 WhatsApp IDÉNTICOS en un par de minutos por la línea NO
// oficial del cliente: el simulador no espera (`esperar` se dice y se sigue) y el «Ir a» vuelve
// hasta `TOPE_SALTOS`. Lo que protege a una línea no oficial es el RITMO (AGENTS.md, «El WhatsApp
// del chatbot es el NO OFICIAL»), así que van dos cortes, uno en cada punta:
//   · el PANEL no repite el envío real de una tarjeta que ya salió en esta prueba
//     (`debeSalirDeVerdad`); el teléfono la sigue DIBUJANDO, porque eso es lo que se prueba;
//   · el SERVER pone un tope por (workspace, destino): `TOPE_PRUEBA_REAL` mensajes del panel
//     cada `VENTANA_PRUEBA_MIN` minutos (`reclamarCupoPrueba`, con `reclamarEspaciado`). El
//     panel corre en el navegador: sin el tope del server, un POST a mano no tiene freno.

/** Cuántos mensajes del panel salen de verdad a UN destino por ventana. */
export const TOPE_PRUEBA_REAL = 10;
/** La ventana del tope, y la del aviso «🧪 Prueba de MaKo» que decide el server. */
export const VENTANA_PRUEBA_MIN = 10;

/**
 * ¿Esta tarjeta sale DE VERDAD, o ya salió en esta prueba? Marca y contesta en un paso.
 *
 * En la SALIDA la clave es la tarjeta: un «Ir a» que vuelve sobre un mensaje ya mandado no lo
 * reenvía (es el bucle de arriba). En «Si responde» la clave lleva además el TURNO del lead: cada
 * vez que quien prueba escribe como el lead es un pedido nuevo, y la respuesta que aparece tiene
 * que llegar —un «MaKo contesta» redacta otra cosa en cada turno—. Un bucle dentro del mismo
 * turno tampoco repite.
 *
 * ↻ arranca con un `Set` vacío: es otra prueba.
 */
export function debeSalirDeVerdad(enviados: Set<string>, nodo: string, enRespuesta: boolean, turno: number): boolean {
  const clave = enRespuesta ? `r${turno}:${nodo}` : `s:${nodo}`;
  if (enviados.has(clave)) return false;
  enviados.add(clave);
  return true;
}

/**
 * A quién se le cuenta el tope: el canal y el destino, normalizados. null = sin destino (no se
 * manda nada, así que no hay nada que contar).
 */
export function claveDestinoPrueba(m: Pick<MensajePrueba, 'canal'>, d: DestinoPrueba): string | null {
  if (m.canal === 'email') return d.email ? `email:${d.email.toLowerCase()}` : null;
  return d.telefono ? `wa:${d.telefono}` : null;
}

/**
 * Reclama UN lugar de los `tope` que tiene la ventana. Cada casillero guarda cuándo se usó por
 * última vez (`reclamarEspaciado`, con su compare-and-set): uno libre es uno cuya marca ya salió
 * de la ventana. Con los `tope` ocupados no queda lugar, así que en cualquier tramo de
 * `VENTANA_PRUEBA_MIN` minutos salen como mucho `tope` mensajes.
 *
 * Recibe el reclamo inyectado para que el test lo EJECUTE (el real es `server-only`). Un error del
 * reclamo sube: quien llama decide, y el server corta (sin poder contar, no se manda).
 */
export async function reclamarCupoPrueba(reclamar: (casillero: number) => Promise<boolean>, tope = TOPE_PRUEBA_REAL): Promise<boolean> {
  for (let i = 0; i < tope; i++) if (await reclamar(i)) return true;
  return false;
}

// ── Cómo se DIBUJA en el teléfono un archivo de la biblioteca (costuras-8) ──────────────────────

/** image | video | document, como lo pide Evolution `sendMedia` y como lo dibuja la burbuja. */
export const tipoDeMime = (mime: string): 'image' | 'video' | 'document' =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';

/**
 * La burbuja de un paso «archivo», tal como le llega al lead: el documento con SU nombre
 * (`catalogo.pdf`) y el caption como texto aparte.
 *
 * ⚠️ Antes el caption iba en `texto` y no había `nombreArchivo`: `ChatHilo` usa el `texto` de un
 * documento sin `nombreArchivo` como su NOMBRE, así que «Probar» mostraba un documento llamado
 * «Te dejo el catálogo» y ningún caption. La prueba no mostraba cómo llega.
 */
export function burbujaDeArchivo(
  adj: { url: string | null; mime: string; nombre: string | null } | null,
  caption: string,
): { tipo: 'image' | 'video' | 'document'; mediaUrl: string | null; mediaMime: string | null; nombreArchivo: string | null; texto: string | null } {
  const tipo = adj ? tipoDeMime(adj.mime) : 'document';
  return {
    tipo,
    mediaUrl: adj?.url ?? null,
    mediaMime: adj?.mime || null,
    nombreArchivo: tipo === 'document' ? (adj?.nombre?.trim() || 'Archivo') : null,
    texto: caption.trim() ? caption : null,
  };
}

// ── El destino precargado: el de QUIEN PRUEBA (lienzo-3) ────────────────────────────────────────

/**
 * El teléfono y el email de la persona que está mirando, de SU fila de `usuarios` (el teléfono vive
 * en el jsonb `perfil`). Sin fila, vacío: se escribe a mano.
 *
 * ⚠️ NUNCA el contacto de reportes del workspace (`user_telefono` / `user_email`). Ése es del
 * NEGOCIO: con el super admin mirando a un cliente, «A mi WhatsApp» venía cargado con el número
 * del cliente y cada mensaje de la prueba le llegaba a él. El rótulo dice «A mi…»: tiene que ser
 * de quien prueba, o vacío.
 */
export function destinoDelQueMira(u: { email?: unknown; perfil?: unknown } | null | undefined): { telefono: string; email: string } {
  if (!u) return { telefono: '', email: '' };
  const perfil = u.perfil && typeof u.perfil === 'object' && !Array.isArray(u.perfil) ? (u.perfil as Record<string, unknown>) : {};
  return {
    telefono: typeof perfil.telefono === 'string' ? perfil.telefono.trim() : '',
    email: typeof u.email === 'string' ? u.email.trim() : '',
  };
}

const idPositivo = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Lo que llega del navegador, saneado. null = no es un mensaje que se pueda mandar. */
export function sanearMensajePrueba(raw: unknown): MensajePrueba | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const canal = o.canal === 'email' ? 'email' : o.canal === 'whatsapp' ? 'whatsapp' : null;
  if (!canal) return null;
  const tipo = o.tipo === 'audio' || o.tipo === 'media' ? o.tipo : 'texto';
  const texto = typeof o.texto === 'string' ? o.texto.slice(0, TOPE_TEXTO_PRUEBA) : '';
  const asunto = typeof o.asunto === 'string' ? o.asunto.slice(0, 300) : null;
  const audio_id = idPositivo(o.audio_id);
  const media_id = idPositivo(o.media_id);
  // El HTML de un email vuelve a pasar por la lista blanca: lo manda el navegador. Uno sin nada que
  // leer (`<p></p>`) no viaja; uno con sólo una imagen sí, aunque su texto plano esté vacío.
  const saneado = canal === 'email' && typeof o.html === 'string' ? sanearHtmlEmail(o.html.slice(0, TOPE_HTML_EMAIL)) : '';
  const html = saneado && !htmlEmailVacio(saneado) ? saneado : null;
  if (canal === 'whatsapp' && tipo === 'audio' && !audio_id) return null;
  if (canal === 'whatsapp' && tipo === 'media' && !media_id) return null;
  if (tipo === 'texto' && !texto.trim() && !html) return null;
  return { canal, tipo: canal === 'email' ? 'texto' : tipo, texto, asunto, audio_id, media_id, ...(html ? { html } : {}) };
}

/** El destino que se escribió en el panel. NO se guarda en ningún lado: es de esta prueba. */
export function sanearDestinoPrueba(raw: unknown): DestinoPrueba {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const digitos = typeof o.telefono === 'string' ? o.telefono.replace(/\D/g, '') : '';
  const telefono = digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  const em = typeof o.email === 'string' ? o.email.trim() : '';
  const email = em.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : null;
  return { telefono, email };
}

/**
 * Qué sale, en orden. El primero lleva el aviso: en un texto va como primer renglón; un audio no
 * tiene dónde llevarlo y sale antes como texto aparte; un archivo lo lleva en el caption.
 */
export function planDePrueba(m: MensajePrueba, primero: boolean): EnvioPrueba[] {
  const texto = m.texto.trim();
  if (m.canal === 'email') {
    const asunto = `${primero ? '[Prueba] ' : ''}${(m.asunto ?? '').trim() || 'Sin asunto'}`;
    // El HTML lleva el aviso como su primer párrafo, igual que el texto plano lo lleva arriba.
    const html = m.html ? `${primero ? `<p>${AVISO_PRUEBA}</p>` : ''}${m.html}` : undefined;
    return [{ via: 'email', asunto, texto: primero ? `${AVISO_PRUEBA}\n\n${texto}` : texto, ...(html ? { html } : {}) }];
  }
  const conAviso = (t: string) => (primero ? (t ? `${AVISO_PRUEBA}\n${t}` : AVISO_PRUEBA) : t);
  if (m.tipo === 'audio' && m.audio_id) {
    return [
      ...(primero ? [{ via: 'wa-texto' as const, texto: AVISO_PRUEBA }] : []),
      { via: 'wa-audio', audioId: m.audio_id },
      // El pie del audio sale DESPUÉS, como segundo mensaje: así le llega al lead.
      ...(texto ? [{ via: 'wa-texto' as const, texto }] : []),
    ];
  }
  if (m.tipo === 'media' && m.media_id) return [{ via: 'wa-media', mediaId: m.media_id, caption: conAviso(texto) }];
  return [{ via: 'wa-texto', texto: conAviso(texto) }];
}
