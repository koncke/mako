// =============================================================================
// simulador-grafo — «Probar» recorre el FLUJO que se está editando, tarjeta por tarjeta
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10): «El botón de probar se rompe… No tiene la animación
// de entrada de los mensajes y tampoco puedo interactuar, para probarlo de verdad». Molde de
// ManyChat («In Manychat»): un teléfono al lado del lienzo que recorre la automatización; en una
// condición, quien prueba ELIGE la rama; una espera no espera; una acción no se ejecuta.
//
// Módulo PURO y sin `server-only`: lo ejecuta tests/simulador-grafo.test.ts y lo usa el panel
// (app/chatbot/PanelProbar.tsx). La navegación es la de lib/flujo-grafo.ts —la MISMA que lee el
// motor—, así que lo que se prueba es lo que va a pasar, y no un setter libre como antes: la
// #198 tenía cero casos y en el simulador viejo MaKo contestaba igual, mientras en producción
// toda respuesta iba a hand-off. Un simulador que no recorre el dato del motor afirma algo que
// el motor no hace.
//
// ── QUÉ SE PRUEBA: LO QUE SE VE, NO LO GUARDADO ──────────────────────────────
// Recibe los pasos LOCALES (lo que el lienzo tiene sin publicar, `onCambioLocal`). Antes
// «Probar» desmontaba el editor y simulaba la prop guardada: se probaba otra cosa y encima se
// perdía lo escrito.
//
// ── LAS DOS RAÍCES ───────────────────────────────────────────────────────────
// La SALIDA arranca en `raizSalida` y corre sola. Una respuesta del lead la PAUSA
// (`pausarPorRespuesta`, igual que el motor) y corre «Si responde»: el servidor clasifica contra
// los casos locales y este módulo entra por la rama elegida (`entrarEnRespuesta`). Un «Ir a» a una
// tarjeta desde «Si responde» RETOMA la salida ahí (lo mismo que hace el motor).
// =============================================================================

import {
  type PasoGrafo, type NombresParaTexto,
  claseDe, idDe, indicePorId, nodoPorId, normalizar, raizSalida, raizRespuesta, siguienteDe,
  textoEspera, textoRama,
} from './flujo-grafo';
import { legadoAGrafo, tieneLegado, type EstrategiaLegada } from './flujo-legado';
import { aplicarVariables, valoresVariablesLead, VARIABLES_LEAD } from './template-vars';

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

export type EstadoSim = {
  /** El próximo nodo a correr. */
  cursor: string | null;
  rama: 'salida' | 'respuesta';
  /** La condición que espera que quien prueba elija. Mientras no elija, no se avanza. */
  eligiendo: { nodo: string; opciones: OpcionRama[] } | null;
  /** Una respuesta del lead pausó la salida: ya no corre (salvo un «Ir a» desde «Si responde»). */
  salidaPausada: boolean;
  terminado: boolean;
  saltos: number;
  eventos: number;
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

// ── Recorrer ───────────────────────────────────────────────────────────────────

export function iniciar(pasos: readonly PasoGrafo[]): EstadoSim {
  const raiz = raizSalida(pasos);
  return { cursor: raiz, rama: 'salida', eligiendo: null, salidaPausada: false, terminado: false, saltos: 0, eventos: 0, caso: null };
}

const nombreAccion = (p: PasoGrafo, n: NombresSim): string => {
  const a = p.accion as { operacion?: unknown } | null | undefined;
  const op = typeof a?.operacion === 'string' ? a.operacion : '';
  if (!op) return 'Acción sin elegir';
  return n.accion?.(op) ?? op.replace(/_/g, ' ');
};

type Paso<P extends PasoGrafo> = { evento: EventoSim<P> | null; estado: EstadoSim };

function fin<P extends PasoGrafo>(estado: EstadoSim, texto: string): Paso<P> {
  return { evento: { t: 'fin', texto }, estado: { ...estado, cursor: null, eligiendo: null, terminado: true } };
}

/**
 * El próximo evento. `null` cuando no hay nada que correr: terminó, espera una elección, o la
 * salida está pausada. Un paso por llamada: el panel pone el «escribiendo…» y la pausa entre uno y
 * otro.
 */
export function siguiente<P extends PasoGrafo>(
  pasos: readonly P[],
  estado: EstadoSim,
  nombres: NombresSim = {},
): Paso<P> {
  if (estado.terminado || estado.eligiendo) return { evento: null, estado };
  if (estado.rama === 'salida' && estado.salidaPausada) return { evento: null, estado };
  if (!estado.cursor) {
    return fin(estado, estado.rama === 'respuesta' ? 'Fin de la respuesta' : estado.eventos === 0 ? 'Sin tarjetas' : 'Fin');
  }
  if (estado.eventos >= TOPE_EVENTOS) return fin(estado, 'Se repite: fin de la prueba');
  const i = indicePorId(pasos, estado.cursor);
  if (i < 0) return fin(estado, 'Esa tarjeta ya no existe');
  const p = pasos[i];
  const id = idDe(p, i);
  const base: EstadoSim = { ...estado, eventos: estado.eventos + 1 };
  switch (claseDe(p)) {
    case 'mensaje':
      return { evento: { t: 'mensaje', nodo: id, paso: p, enRespuesta: estado.rama === 'respuesta' }, estado: { ...base, cursor: siguienteDe(pasos, i) } };
    case 'accion':
      // No se ejecuta: probar no puede mover un lead ni crear una tarea de verdad.
      return { evento: { t: 'accion', nodo: id, texto: `⚡ ${nombreAccion(p, nombres)}` }, estado: { ...base, cursor: siguienteDe(pasos, i) } };
    case 'esperar':
      // No espera: se dice cuánto y se sigue.
      return { evento: { t: 'espera', nodo: id, texto: `⏳ ${textoEspera(p.espera)}` }, estado: { ...base, cursor: siguienteDe(pasos, i) } };
    case 'condicion': {
      const opciones: OpcionRama[] = [
        ...(p.ramas ?? []).map((r) => ({ puerto: r.id, texto: textoRama(r, nombres), destino: r.siguiente ?? null })),
        { puerto: 'si_no', texto: 'Si no', destino: p.si_no ?? null },
      ];
      return { evento: { t: 'condicion', nodo: id, opciones }, estado: { ...base, eligiendo: { nodo: id, opciones } } };
    }
    case 'respuesta':
      // A «Si responde» se entra por una respuesta del lead, no caminando.
      return fin(base, 'Espera la respuesta');
    case 'ir_a': {
      const d = p.destino;
      if (!d) return fin(base, 'Fin');
      if ('secuencia_id' in d) {
        const nom = nombres.secuencia?.(d.secuencia_id) ?? 'otra automatización';
        return { evento: { t: 'salto', nodo: id, texto: `↪ Sigue en «${nom}»` }, estado: { ...base, cursor: null, terminado: true } };
      }
      const saltos = estado.saltos + 1;
      if (saltos > TOPE_SALTOS) return fin(base, 'Se repite: fin de la prueba');
      // Desde «Si responde», un salto a una tarjeta RETOMA la salida ahí (el motor hace lo mismo).
      return {
        evento: { t: 'salto', nodo: id, texto: '↪ Ir a otra tarjeta' },
        estado: { ...base, saltos, cursor: d.nodo, rama: 'salida', salidaPausada: false },
      };
    }
  }
}

/** Quien prueba elige por qué rama sigue una condición. */
export function elegir(estado: EstadoSim, puerto: string): EstadoSim {
  const e = estado.eligiendo;
  if (!e) return estado;
  const o = e.opciones.find((x) => x.puerto === puerto);
  if (!o) return estado;
  return { ...estado, eligiendo: null, cursor: o.destino };
}

/**
 * El lead escribió: la salida se PAUSA, como en el motor (`pausarPorRespuesta`). Mientras la
 * salida corre el lead no respondió; por eso las condiciones de la salida no tienen «respondió».
 */
export function pausarPorRespuesta(estado: EstadoSim): { estado: EstadoSim; pausoLaSalida: boolean } {
  const corria = estado.rama === 'salida' && !estado.salidaPausada && !estado.terminado;
  return {
    estado: { ...estado, salidaPausada: estado.salidaPausada || estado.rama === 'salida', eligiendo: null, ...(estado.rama === 'respuesta' ? { terminado: true, cursor: null } : {}) },
    pausoLaSalida: corria,
  };
}

/**
 * Entra a «Si responde» por el caso que eligió el clasificador (`casoId`), o por «Otra cosa»
 * (`null`). Sin tarjeta «Si responde», `sinRespuesta`: MaKo no contesta.
 */
export function entrarEnRespuesta(
  pasos: readonly PasoGrafo[],
  estado: EstadoSim,
  casoId: string | null,
): { estado: EstadoSim; sinRespuesta: boolean; caso: CasoElegido | null } {
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r) return { estado: { ...estado, terminado: true, cursor: null, eligiendo: null }, sinRespuesta: true, caso: null };
  const c = casoId ? (r.casos ?? []).find((x) => x.id === casoId) ?? null : null;
  const caso: CasoElegido = c ? { id: c.id, titulo: c.titulo, cuando: c.cuando } : { id: null, titulo: 'Otra cosa', cuando: '' };
  const destino = c ? c.siguiente ?? null : r.si_no ?? null;
  return {
    estado: { ...estado, cursor: destino, rama: 'respuesta', eligiendo: null, terminado: false, saltos: 0, caso },
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
};

export type DestinoPrueba = { telefono: string | null; email: string | null };

/** Un envío concreto. El orden del array es el orden en que salen. */
export type EnvioPrueba =
  | { via: 'wa-texto'; texto: string }
  | { via: 'wa-audio'; audioId: number }
  | { via: 'wa-media'; mediaId: number; caption: string }
  | { via: 'email'; asunto: string; texto: string };

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
  if (canal === 'whatsapp' && tipo === 'audio' && !audio_id) return null;
  if (canal === 'whatsapp' && tipo === 'media' && !media_id) return null;
  if (tipo === 'texto' && !texto.trim()) return null;
  return { canal, tipo: canal === 'email' ? 'texto' : tipo, texto, asunto, audio_id, media_id };
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
    return [{ via: 'email', asunto, texto: primero ? `${AVISO_PRUEBA}\n\n${texto}` : texto }];
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
