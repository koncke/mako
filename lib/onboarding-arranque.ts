// =============================================================================
// onboarding-arranque — el chat de arranque: el onboarding de MaKo es una conversación
// =============================================================================
// Pedido de Martín (16/10/2026): «Quiero que elimines todo lo que hay hoy en onboarding tal como está y
// que lo reemplaces por el chat de "Offer"… este onboarding no tiene que ser solo de "offer" (aunque será
// la gran parte), sino que también debe preguntar otras cosas, como el nombre, luego de analizar su offer,
// preguntar su funnel para que lo elija (y así crear su primer CRM)… NO quiero que sea un onboarding
// eterno, es más, mientras más ágil y rápido mejor.» El wizard de antes quedó escrito, pantalla por
// pantalla, en docs/onboarding-pasos-anteriores.md.
//
// Acá viven las reglas PURAS (sin `server-only`, con test que las ejecuta): en qué ETAPA está la
// conversación, qué DICE MaKo en cada una y con qué OPCIONES, qué CRM recomienda, cómo se lee cada
// respuesta y qué se escribe en el perfil del negocio al terminar. La ruta (/api/onboarding/arranque) sólo
// lee los hechos, aplica lo que esto decide y persiste; la pantalla (app/onboarding/ChatArranque.tsx) sólo
// dibuja.
//
// DOS MODOS, porque las capas no ven lo mismo (lib/capas.ts):
//   · 'oferta' (Completo, Agencia): nombre → negocio → objetivo → LA OFERTA (la conversación de Offer, con
//     el diagnóstico de fase adentro) → el CRM que elige → el teléfono (o «ahora no») → cierre.
//   · 'plan' (Project Manager: no ve Offer ni el CRM): nombre → negocio → objetivo → a qué se dedica → el
//     diagnóstico de fase (las preguntas originales, con sus opciones) → cierre con el plan de arranque.
//
// ⚠️ LO QUE NO SE PREGUNTA, y por qué: la zona horaria la toma sola el navegador del admin
// (ZonaDelNegocio en el layout); Meta se conecta después desde su tab (se posterga y queda el
// recordatorio en /general); la IA propia ya no hace falta para arrancar. Todo lo demás del perfil sale de
// la conversación de la oferta.
// ⚠️ LA VOZ: lo que lee el cliente va de «tú», neutro (AGENTS.md: la voz rioplatense es la de MaKo con
// Martín, no la del texto del cliente). El guard de voseo barre este archivo.
// =============================================================================

import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL, type CanalId } from './fase-diagnostico';
import { TIPOS_CRM, type TipoCrm, type TipoCrmId } from './pipeline';
import type { PiezasSabidas, PropuestaOferta } from './offer-marco';

export type ModoArranque = 'oferta' | 'plan';

/** Lo que el chat guardó de la conversación (app_settings 'onboarding.arranque', un JSON por workspace). */
export type EstadoArranque = {
  nombre?: string;
  negocio?: string;
  objetivo?: string;
  /** Sólo en modo 'plan': en 'oferta' sale de la conversación de la oferta. */
  queHace?: string;
  /** La respuesta de cada pregunta del diagnóstico que hizo el ARRANQUE (índice de la opción ORIGINAL, -1 =
   *  sin contestar): todas en modo 'plan'; en 'oferta', sólo las que la conversación de la oferta no llegó a hacer. */
  faseResp?: number[];
  /** Dónde cierra la venta, si lo preguntó el arranque (la pregunta de canal va antes de la de volumen). */
  canal?: CanalId;
  /** El tipo de CRM que eligió (modo 'oferta'). */
  crmTipo?: TipoCrmId;
  /** Mostrar todos los tipos de CRM, no sólo los de su canal. */
  crmVerTodos?: boolean;
  /** El teléfono de los avisos: 'codigo' = se mandó el código y falta cargarlo. */
  telefono?: 'codigo' | 'verificado' | 'postergado';
  telefonoNumero?: string;
  /** La conversación de Offer donde vive la oferta (modo 'oferta'). */
  sesionId?: number;
  /** Ya vio la animación del principio: no se repite al recargar. */
  introVista?: boolean;
};

/** Lo que el server MIDE (nunca se guarda: estado vivo, no recordado). */
export type HechosArranque = {
  modo: ModoArranque;
  /** usuarios.nombre de quien entra (de Google o de quien lo invitó), para ofrecerlo como opción. */
  nombreCuenta: string;
  /** workspaces.nombre (lo puso el alta), para ofrecerlo como opción. */
  nombreWorkspace: string;
  /** El negocio ya tiene diagnóstico de fase guardado. */
  faseGuardada: boolean;
  /** El canal del diagnóstico guardado (dónde cierra la venta), o null. */
  canalNegocio: CanalId | null;
  /** La conversación de Offer tiene las 7 piezas mínimas. */
  puedeConcluir: boolean;
  /** La oferta ya está armada (hay una conclusión). */
  ofertaLista: boolean;
  /** Lo que ya contestó del diagnóstico en la conversación de la oferta (id de pregunta → opción ORIGINAL, y el
   *  canal si lo contestó ahí), o null sin conversación. El arranque no lo vuelve a preguntar. */
  faseOffer?: { respuestas: Record<string, number>; canal: CanalId | null } | null;
  /** La capa ve el CRM: el chat siembra su funnel principal. */
  conCrm: boolean;
  /** La capa tiene el paso del teléfono ('tabs'). */
  conTelefono: boolean;
  /** El onboarding ya está cerrado. */
  terminado: boolean;
};

export type EtapaArranque =
  | 'nombre' | 'negocio' | 'objetivo' | 'que_hace' | 'fase' | 'oferta' | 'crm'
  | 'telefono' | 'codigo' | 'armando' | 'cierre' | 'listo';

export type TarjetaArranque = 'crm' | 'telefono' | 'armando' | 'listo';

/** Un mensaje del chat de arranque (los de la conversación de la oferta son los de Offer, aparte). */
export type MensajeArranque = {
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  opciones?: string[];
  tarjeta?: TarjetaArranque;
};

// ── Textos ──────────────────────────────────────────────────────────────────
export const OBJETIVOS_SUGERIDOS = ['Conseguir mis primeros clientes', 'Vender más cada mes', 'Escalar sin depender de mí'] as const;
export const AHORA_NO = 'Ahora no';
export const CAMBIAR_NUMERO = 'Cambiar número';
export const VER_OTROS_TIPOS = 'Ver otros tipos';
const PREGUNTA_CANAL = '¿Dónde cierras la venta?';

const TOPE_RESPUESTA = 300;

/** El primer nombre, para saludar y ofrecerlo: «Martín Koncke» → «Martín». */
export function primerNombre(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] ?? '';
}

/**
 * ¿El nombre del workspace parece el de un NEGOCIO? El alta pública lo arma con el nombre de quien pagó o
 * con su email (lib/cobros.ts), así que ofrecerlo tal cual como «tu negocio» sería afirmar algo que nadie
 * dijo. Un email o el mismo nombre de la persona no se ofrecen.
 */
export function pareceNegocio(nombreWorkspace: string, nombreCuenta: string): boolean {
  const w = (nombreWorkspace || '').trim();
  if (!w || w.includes('@')) return false;
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(w) !== norm(nombreCuenta);
}

/** Una respuesta de texto libre: recortada y con tope. Vacía = no contestó. */
export function limpiarRespuesta(t: string): string {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, TOPE_RESPUESTA);
}

// ── El CRM que se propone ───────────────────────────────────────────────────
/** El tipo recomendado para cada canal (el primero de su canal en TIPOS_CRM, que ya viene ordenado así). */
export function tipoRecomendado(canal: CanalId | null): TipoCrm {
  const porCanal = canal ? TIPOS_CRM.filter((t) => t.canal === canal) : [];
  return porCanal[0] ?? TIPOS_CRM.find((t) => t.id === 'llamada') ?? TIPOS_CRM[0];
}

/**
 * Los tipos que se ofrecen: el recomendado primero y los demás de su canal; con «ver todos», los doce. El
 * marco de Offer es de alto ticket vendido por llamada (lib/offer-autores.ts), así que sin canal manda
 * «Llamada de venta».
 */
export function tiposOfrecidos(canal: CanalId | null, verTodos: boolean): { tipos: TipoCrm[]; hayMas: boolean } {
  const rec = tipoRecomendado(canal);
  const base = verTodos ? [...TIPOS_CRM] : TIPOS_CRM.filter((t) => t.canal === rec.canal);
  const tipos = [rec, ...base.filter((t) => t.id !== rec.id)];
  return { tipos, hayMas: !verTodos && tipos.length < TIPOS_CRM.length };
}

// ── El diagnóstico en modo 'plan' ───────────────────────────────────────────
export type PreguntaFase = { tipo: 'canal' } | { tipo: 'pregunta'; idx: number };

/** La próxima pregunta del diagnóstico sin contestar; la de canal va justo antes de la de volumen. */
export function siguientePreguntaFase(e: EstadoArranque): PreguntaFase | null {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !e.canal) return { tipo: 'canal' };
    if (!(Number.isInteger(resp[i]) && resp[i] >= 0)) return { tipo: 'pregunta', idx: i };
  }
  return null;
}

function textoPreguntaFase(p: PreguntaFase, canal: CanalId | undefined): { texto: string; opciones: string[] } {
  if (p.tipo === 'canal') return { texto: PREGUNTA_CANAL, opciones: CANALES.map((c) => c.label) };
  const q = PREGUNTAS[p.idx];
  if (q.id === 'volumen') {
    const v = VOLUMEN_POR_CANAL[canal ?? 'llamadas'];
    return { texto: v.texto, opciones: v.opciones };
  }
  return { texto: q.texto, opciones: q.opciones };
}

/** Las respuestas del diagnóstico completas (para guardarlo), o null si falta alguna. */
export function faseCompleta(e: EstadoArranque): number[] | null {
  if (siguientePreguntaFase(e) !== null) return null;
  return PREGUNTAS.map((_, i) => (e.faseResp ?? [])[i]);
}

const contestada = (n: number | undefined): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * El diagnóstico como lo ve el arranque en modo 'oferta': lo que contestó ACÁ manda y, si no, lo que ya
 * contestó en la conversación de la oferta. Así las preguntas que Offer ya hizo no se repiten.
 */
export function conFaseDeOffer(e: EstadoArranque, h: Pick<HechosArranque, 'faseOffer'>): EstadoArranque {
  const o = h.faseOffer;
  if (!o) return e;
  const faseResp = PREGUNTAS.map((q, i) => (contestada(e.faseResp?.[i]) ? e.faseResp![i] : (o.respuestas[q.id] ?? -1)));
  const canal = e.canal ?? o.canal ?? undefined;
  return { ...e, faseResp, ...(canal ? { canal } : {}) };
}

// ── La etapa ────────────────────────────────────────────────────────────────
/**
 * En qué etapa está la conversación. Sale de lo guardado Y de lo medido: así, si la persona cerró la
 * pestaña a la mitad, al volver sigue exactamente donde quedó, sin una marca de «paso actual» que haya que
 * acordarse de mover.
 */
export function etapaDeArranque(e: EstadoArranque, h: HechosArranque): EtapaArranque {
  if (h.terminado) return 'listo';
  if (!e.nombre) return 'nombre';
  if (!e.negocio) return 'negocio';
  if (!e.objetivo) return 'objetivo';
  if (h.modo === 'plan') {
    if (!e.queHace) return 'que_hace';
    if (!h.faseGuardada) return 'fase';
  } else {
    // El diagnóstico va adentro de la conversación de la oferta, pero Offer deja ARMAR antes de terminarlo
    // (el botón «Armar mi oferta»). Con la oferta armada y el diagnóstico sin guardar, las preguntas que
    // faltan las hace el arranque: antes se quedaba en 'oferta' para siempre, sin la pregunta en pantalla y
    // sin forma de seguir (recorrido en el ws3, 16/10/2026).
    if (!h.faseGuardada) return h.ofertaLista ? 'fase' : 'oferta';
    if (!h.puedeConcluir && !h.ofertaLista) return 'oferta';
    if (h.conCrm && !e.crmTipo) return 'crm';
  }
  if (h.conTelefono && e.telefono !== 'verificado' && e.telefono !== 'postergado') {
    return e.telefono === 'codigo' ? 'codigo' : 'telefono';
  }
  if (h.modo === 'oferta' && !h.ofertaLista) return 'armando';
  return 'cierre';
}

// ── Lo que dice MaKo ────────────────────────────────────────────────────────
/**
 * Los mensajes del arranque, partidos en dos: los de ANTES de la conversación de la oferta y los de
 * DESPUÉS. En modo 'plan' no hay oferta, así que todo va en `antes`. Sólo se dibuja hasta la etapa actual:
 * su pregunta es el último mensaje, con sus opciones.
 */
export function mensajesDeArranque(e: EstadoArranque, h: HechosArranque): { antes: MensajeArranque[]; despues: MensajeArranque[] } {
  const etapa = etapaDeArranque(e, h);
  const antes: MensajeArranque[] = [];
  const despues: MensajeArranque[] = [];
  const nombre = e.nombre ? primerNombre(e.nombre) : '';

  const preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => {
    lista.push({ id: `arr-${id}`, de: 'mako', texto, ...(respuesta === undefined && opciones?.length ? { opciones } : {}), ...(tarjeta ? { tarjeta } : {}) });
    if (respuesta !== undefined) lista.push({ id: `arr-${id}-r`, de: 'yo', texto: respuesta });
  };

  // 1. Quién es. Un nombre que es un email (las altas sin nombre guardan el email) no se ofrece.
  const sugNombre = h.nombreCuenta.includes('@') ? '' : primerNombre(h.nombreCuenta);
  preguntar(antes, 'nombre', '¡Hola! Soy MaKo. En unos minutos dejamos tu negocio listo para trabajar juntos. ¿Cómo te llamo?', e.nombre, sugNombre ? [sugNombre] : undefined);
  if (etapa === 'nombre') return { antes, despues };
  preguntar(antes, 'negocio', `Un gusto, ${nombre}. ¿Cómo se llama tu negocio?`, e.negocio,
    pareceNegocio(h.nombreWorkspace, h.nombreCuenta) ? [h.nombreWorkspace.trim()] : undefined);
  if (etapa === 'negocio') return { antes, despues };
  preguntar(antes, 'objetivo', '¿Qué quieres lograr en los próximos 90 días?', e.objetivo, [...OBJETIVOS_SUGERIDOS]);
  if (etapa === 'objetivo') return { antes, despues };

  // 2a. Modo 'plan': a qué se dedica y el diagnóstico, con las preguntas originales.
  if (h.modo === 'plan') {
    preguntar(antes, 'que-hace', '¿A qué se dedica tu negocio?', e.queHace);
    if (etapa === 'que_hace') return { antes, despues };
    if (preguntarFase(antes, e, preguntar)) return { antes, despues };
    return { antes, despues: cierre(e, h, etapa, nombre) };
  }

  // 2b. Modo 'oferta': el pase a la conversación de la oferta (sus mensajes los dibuja Offer).
  antes.push({ id: 'arr-oferta', de: 'mako', texto: 'Perfecto. Ahora lo más importante: tu oferta.' });
  if (etapa === 'oferta') return { antes, despues };

  // 2c. Lo que faltó del diagnóstico (armó la oferta antes de terminarlo, ver `etapaDeArranque`): sólo lo que
  // la conversación de la oferta no llegó a preguntar. Queda dibujado después, como parte de la historia.
  if (etapa === 'fase' || preguntoLaFase(e)) {
    const o = h.faseOffer;
    despues.push({ id: 'arr-fase', de: 'mako', texto: 'Antes de seguir, unas preguntas rápidas para saber en qué fase está tu negocio.' });
    if (preguntarFase(despues, conFaseDeOffer(e, h), preguntar, { canalYaDicho: !!o?.canal, yaContestada: (id) => o?.respuestas[id] != null })) {
      return { antes, despues };
    }
  }

  // 3. El CRM.
  if (h.conCrm) {
    const { tipos, hayMas } = tiposOfrecidos(h.canalNegocio, !!e.crmVerTodos);
    const elegido = e.crmTipo ? TIPOS_CRM.find((t) => t.id === e.crmTipo)?.label : undefined;
    const opciones = [...tipos.map((t) => t.label), ...(hayMas ? [VER_OTROS_TIPOS] : [])];
    preguntar(despues, 'crm', h.ofertaLista
      ? 'Ya tengo tu oferta. Ahora armemos tu CRM: con lo que me contaste, te propongo este.'
      : 'Ya entendí tu oferta. Mientras la termino de armar, dejemos listo tu CRM: con lo que me contaste, te propongo este.',
    elegido, opciones, 'crm');
    if (etapa === 'crm') return { antes, despues };
  }

  despues.push(...cierre(e, h, etapa, nombre));
  return { antes, despues };
}

type Preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => void;

/** ¿El arranque ya hizo alguna pregunta del diagnóstico? (En modo 'oferta' sólo las escribe él.) */
const preguntoLaFase = (e: EstadoArranque): boolean => !!e.canal || (e.faseResp ?? []).some(contestada);

/**
 * Las preguntas del diagnóstico, en orden: las contestadas con su respuesta y la que toca, con las preguntas
 * ORIGINALES. Devuelve true si quedó una abierta. En modo 'oferta' saltea lo que el dueño ya contestó en la
 * conversación de la oferta (`yaContestada`, `canalYaDicho`): esas no se dibujan ni se repiten.
 */
function preguntarFase(lista: MensajeArranque[], e: EstadoArranque, preguntar: Preguntar,
  o: { canalYaDicho?: boolean; yaContestada?: (id: string) => boolean } = {}): boolean {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !o.canalYaDicho) {
      const c = textoPreguntaFase({ tipo: 'canal' }, e.canal);
      const elegido = e.canal ? CANALES.find((x) => x.id === e.canal)?.label : undefined;
      preguntar(lista, 'fase-canal', c.texto, elegido, c.opciones);
      if (!e.canal) return true;
    }
    if (o.yaContestada?.(PREGUNTAS[i].id)) continue;
    const q = textoPreguntaFase({ tipo: 'pregunta', idx: i }, e.canal);
    const r = contestada(resp[i]) ? q.opciones[resp[i]] : undefined;
    preguntar(lista, `fase-${i}`, q.texto, r, q.opciones);
    if (r === undefined) return true;
  }
  return false;
}

/** El teléfono, la espera de la oferta y el cierre (los dos modos). */
function cierre(e: EstadoArranque, h: HechosArranque, etapa: EtapaArranque, nombre: string): MensajeArranque[] {
  const out: MensajeArranque[] = [];
  if (h.conTelefono) {
    out.push({ id: 'arr-telefono', de: 'mako', texto: 'Última cosa: ¿a qué WhatsApp te escribo con los avisos y los reportes?', ...(etapa === 'telefono' ? { opciones: [AHORA_NO], tarjeta: 'telefono' as const } : {}) });
    if (e.telefono === 'postergado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: AHORA_NO });
    else if (e.telefono === 'codigo' || e.telefono === 'verificado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: e.telefonoNumero || 'Mi WhatsApp' });
    if (etapa === 'telefono') return out;
    if (e.telefono === 'codigo' || e.telefono === 'verificado') {
      out.push({ id: 'arr-codigo', de: 'mako', texto: `Te mandé un código de 6 dígitos por WhatsApp${e.telefonoNumero ? ` al ${e.telefonoNumero}` : ''}. Escríbelo aquí.`, ...(etapa === 'codigo' ? { opciones: [CAMBIAR_NUMERO, AHORA_NO] } : {}) });
      if (etapa === 'codigo') return out;
      if (e.telefono === 'verificado') out.push({ id: 'arr-codigo-r', de: 'yo', texto: 'Listo, ya lo cargué.' });
    }
  }
  if (etapa === 'armando') {
    out.push({ id: 'arr-armando', de: 'mako', texto: 'Estoy terminando de armar tu oferta. En cuanto esté, te la dejo acá.', tarjeta: 'armando' });
    return out;
  }
  if (etapa === 'listo') {
    out.push({ id: 'arr-listo', de: 'mako', texto: `¡Listo${nombre ? `, ${nombre}` : ''}! Tu MaKo ya está armado.`, tarjeta: 'listo' });
  }
  return out;
}

// ── Las respuestas ──────────────────────────────────────────────────────────
/**
 * Una respuesta. Con una opción viaja TAMBIÉN su texto (`opcionTexto`): el índice solo se lee contra la
 * pregunta ACTUAL del server, y una pestaña vieja que todavía muestra otra pregunta mandaría «la opción 0» de
 * otra cosa (medido en la revisión del 16/10: un clic en «Llamada de venta» del CRM se leía como «Ahora no»
 * del teléfono). Si el texto no coincide, la pregunta cambió y no se anota nada.
 */
export type Respuesta = { texto?: string; opcion?: number; opcionTexto?: string };
export type ResultadoRespuesta =
  /** `fase` al completar el diagnóstico, con el canal que vale (`faseCanal`: el de acá o el de la oferta). */
  | { ok: true; patch: Partial<EstadoArranque>; fase?: number[]; faseCanal?: CanalId }
  | { ok: false; error: string; cambio?: true };

/**
 * Cómo se lee una respuesta en la etapa actual: el `patch` que se guarda y, al completar el diagnóstico del
 * modo 'plan', las respuestas para `setDiagnosticoFase`. Las etapas de tarjeta (el CRM, el teléfono) y la
 * conversación de la oferta tienen su propia acción en la ruta: acá no entran.
 */
export function leerRespuesta(e: EstadoArranque, h: HechosArranque, r: Respuesta): ResultadoRespuesta {
  const etapa = etapaDeArranque(e, h);
  const { antes, despues } = mensajesDeArranque(e, h);
  const ultimo = [...antes, ...despues].filter((m) => m.de === 'mako').pop();
  const opcion = Number.isInteger(r.opcion) && ultimo?.opciones ? ultimo.opciones[r.opcion as number] : undefined;
  if (r.opcion !== undefined && r.opcionTexto !== undefined && opcion !== r.opcionTexto) {
    return { ok: false, error: 'La pregunta cambió.', cambio: true };
  }
  const texto = limpiarRespuesta(opcion ?? r.texto ?? '');

  if (etapa === 'nombre' || etapa === 'negocio' || etapa === 'objetivo' || etapa === 'que_hace') {
    if (!texto) return { ok: false, error: 'Escríbeme tu respuesta.' };
    const campo = etapa === 'nombre' ? 'nombre' : etapa === 'negocio' ? 'negocio' : etapa === 'objetivo' ? 'objetivo' : 'queHace';
    return { ok: true, patch: { [campo]: texto } };
  }
  if (etapa === 'fase') {
    // En modo 'oferta' cuenta lo que ya contestó en la conversación de la oferta (`conFaseDeOffer`).
    const ef = h.modo === 'oferta' ? conFaseDeOffer(e, h) : e;
    const p = siguientePreguntaFase(ef);
    if (!p) return { ok: false, error: 'El diagnóstico ya está completo.' };
    const { opciones } = textoPreguntaFase(p, ef.canal);
    // Sólo con una opción: el diagnóstico se CALCULA (lib/fase-diagnostico.ts) y una respuesta libre no
    // tiene índice. Se acepta el texto si es exactamente una opción.
    const idx = Number.isInteger(r.opcion) ? (r.opcion as number) : opciones.findIndex((o) => o.toLowerCase() === texto.toLowerCase());
    if (!(idx >= 0 && idx < opciones.length)) return { ok: false, error: 'Elige una de las opciones.' };
    if (p.tipo === 'canal') {
      const canal = CANALES[idx].id;
      const siguiente: EstadoArranque = { ...ef, canal };
      return { ok: true, patch: { canal }, ...(faseCompleta(siguiente) ? { fase: faseCompleta(siguiente)!, faseCanal: canal } : {}) };
    }
    const faseResp = [...(ef.faseResp ?? PREGUNTAS.map(() => -1))];
    while (faseResp.length < PREGUNTAS.length) faseResp.push(-1);
    faseResp[p.idx] = idx;
    const siguiente: EstadoArranque = { ...ef, faseResp };
    // Lo que se guarda en el estado es sólo lo que contestó ACÁ: lo de Offer se sigue leyendo de Offer, y
    // copiarlo haría que `preguntoLaFase` dibujara como del arranque preguntas que hizo la otra conversación.
    const propias = h.modo === 'oferta' ? faseResp.map((v, i) => (contestada(e.faseResp?.[i]) || i === p.idx ? v : -1)) : faseResp;
    const completa = faseCompleta(siguiente);
    return { ok: true, patch: { faseResp: propias }, ...(completa ? { fase: completa, ...(siguiente.canal ? { faseCanal: siguiente.canal } : {}) } : {}) };
  }
  if (etapa === 'codigo') {
    if (opcion === CAMBIAR_NUMERO) return { ok: true, patch: { telefono: undefined, telefonoNumero: undefined } };
    if (opcion === AHORA_NO) return { ok: true, patch: { telefono: 'postergado' } };
    return { ok: false, error: 'Escribe el código de 6 dígitos.' };
  }
  if (etapa === 'telefono' && opcion === AHORA_NO) return { ok: true, patch: { telefono: 'postergado' } };
  if (etapa === 'crm') {
    if (opcion === VER_OTROS_TIPOS) return { ok: true, patch: { crmVerTodos: true } };
    const t = TIPOS_CRM.find((x) => x.label === opcion);
    if (!t) return { ok: false, error: 'Elige un tipo de CRM.' };
    return { ok: true, patch: { crmTipo: t.id } };
  }
  return { ok: false, error: 'Ahora no estoy esperando eso.' };
}

// ── Lo que se cierra ────────────────────────────────────────────────────────
export type PasoDelArranque = 'negocio' | 'productos' | 'fase' | 'tabs' | 'integraciones' | 'plan';

/**
 * Qué pasos del onboarding cierra el chat al terminar, y CÓMO. El teléfono y Meta se POSTERGAN cuando no se
 * hicieron —nunca se marcan hechos—: sin destino, los reportes y los avisos no le llegan a nadie, y lo
 * postergado queda como recordatorio en /general (lib/onboarding-pendientes.ts).
 */
export function cierreDePasos(
  pasosCapa: readonly string[],
  hechos: { telefonoVerificado: boolean; metaConectado: boolean },
): Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> {
  const out: Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> = [];
  for (const p of pasosCapa) {
    if (p === 'negocio' || p === 'productos' || p === 'fase' || p === 'plan') out.push({ paso: p, done: true });
    else if (p === 'tabs') out.push(hechos.telefonoVerificado ? { paso: 'tabs', done: true } : { paso: 'tabs', postergar: true });
    else if (p === 'integraciones') out.push(hechos.metaConectado ? { paso: 'integraciones', done: true } : { paso: 'integraciones', postergar: true });
  }
  return out;
}

// ── El perfil del negocio que queda escrito ─────────────────────────────────
/**
 * Un texto que lleva la marca «[completar]» (la pone `filtrarCifras` donde una cifra que el dueño no dio
 * no se puede afirmar) NO se escribe en el brief ni en el catálogo: los prompts lo leerían como un dato. Es
 * la misma regla de `ofertaDesdePropuesta`. Vacío = no se escribe.
 */
export function sinMarca(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return /\[completar\]/i.test(t) ? '' : t;
}

/**
 * Las respuestas del brief (mako.onboarding.answers) que deja la conversación. El brief es lo que leen los
 * generadores (Ads Writer, contenido, video) y el Perro Guardián: si el chat no lo escribe, escriben sin
 * conocer el negocio. Se FUNDE con lo que ya hay (`fundirBrief`): nunca pisa una respuesta que el negocio
 * ya tenía (la del Archivero o una edición en Second Brain).
 *
 * ⚠️ EL PRECIO NO VA: `oferta_ticket` es «Precio / ticket (USD)» y lo que dijo el dueño es texto libre
 * («$3k», «3 pagos de 997», «800 MXN/mes»). Pasarlo a número inventa un precio en dólares (medido en la
 * revisión del 16/10: «$3k» daba 3, «800 MXN/mes» daba 800 USD), y lib/ofertas.ts ya lo prohíbe: «EL PRECIO
 * DEL BRIEF NO SE PARSEA A NÚMERO». El precio queda en la oferta, como texto.
 */
export function briefDesdeArranque(input: {
  estado: EstadoArranque;
  piezas?: PiezasSabidas;
  propuesta?: PropuestaOferta | null;
  /** El texto de la opción que eligió en «¿Cuál es tu MAYOR cuello de botella hoy?». */
  cuello?: string | null;
}): Record<string, string> {
  const v = (k: keyof PiezasSabidas) => sinMarca(input.piezas?.[k]?.valor);
  const prop = input.propuesta ?? null;
  const out: Record<string, string> = {
    negocio_que_hace: sinMarca(input.estado.queHace) || sinMarca(prop?.frase) || v('frase') || v('resultado'),
    negocio_objetivo: sinMarca(input.estado.objetivo),
    negocio_freno: sinMarca(input.cuello) || v('problema'),
    oferta_nombre: sinMarca(prop?.nombre),
    oferta_promesa: v('resultado'),
    oferta_incluye: v('entregables'),
    oferta_garantia: v('garantia'),
    avatar_quien: v('cliente'),
    avatar_dolor: v('problema'),
    avatar_deseo: v('resultado'),
    avatar_objecion: v('objecion'),
  };
  for (const k of Object.keys(out)) if (!out[k].trim()) delete out[k];
  return out;
}

/** Funde respuestas nuevas sobre las que ya hay: sólo llena lo VACÍO. */
export function fundirBrief(previas: Record<string, string>, nuevas: Record<string, string>): Record<string, string> {
  const out = { ...previas };
  for (const [k, val] of Object.entries(nuevas)) if (!(out[k] ?? '').trim() && val.trim()) out[k] = val.trim();
  return out;
}
