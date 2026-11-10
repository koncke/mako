// =============================================================================
// El motor del Centro: lo que vive mientras se mira, sin la pantalla (17/10/2026)
// =============================================================================
// Martín (17/10/2026, de madrugada): «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el
// Second Brain». La tanda 5 de docs/diseno-mako-ai-native.md («el Centro como adaptador de la pieza»): los chats de
// Claude Code (el Cerebro y cada jefe) se escriben desde /second-brain igual que desde /admin/operaciones. Para que
// sea EL MISMO Centro y no una copia, lo que el Centro hace mientras está abierto vive acá, y lo montan tres pantallas:
//   · app/admin/operaciones/CentroApp.tsx (el Centro de siempre),
//   · app/second-brain/ChatSecondBrain.tsx (la sección «Claude Code» de la barra, sólo para quien `puedeOperar`),
//   · app/m/operaciones/CentroAppMovil.tsx y app/m/second-brain/SecondBrainCentroM.tsx (el teléfono).
//
// Lo que hace: la cola y los Runners que se refrescan cada 8 s con la pestaña a la vista; los pushes de Vercel
// DESPUÉS de dibujar; la Ticketera de cada chat; el borrador de la caja (que nunca se pierde); mandar (por mandar.ts, el ÚNICO
// camino firmado); y el «⋯» de cada chat (Renombrar, que también es un trabajo firmado, y Cambiar su muñeco).
//
// ⚠️ SIN 'use client' A PROPÓSITO, como mandar.ts: es un hook que sólo importan componentes de cliente.
// ⚠️ LA GUARDA NO VIVE ACÁ: los datos de entrada los lee el servidor DESPUÉS de `puedeOperar` (las dos páginas del
//    Centro y la del Second Brain, tests/operaciones.test.ts), y cada acción la vuelve a pedir (acciones.ts).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  DESTINO_NUEVO, DESTINO_RE, MAX_TEXTO, MAX_TEXTO_LARGO, aceptaAbrir, aceptaAdjuntos, aceptaAdjuntosEnNuevo, aceptaAdjuntosGrandes, aceptaTextoLargo, problemaDeAdjuntosCaja, problemaDeNombreNuevo, tipoDeElegidoCentro, type AdjuntoPedido, type TurnoChat,
} from '@/lib/operaciones-reglas';
import { tieneTerminal } from '@/lib/runner';
import { ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { idLocal } from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/achicar-imagen';
import { ERROR_SUBIDA, enMemoria } from './leer-adjunto';
import {
  claveParaUrl, estadoDeLaPc, comoSale, completarChats, enQueTrabaja, estadoDeApertura, esperasPorChat, hayEnCamino, historialDelChat, nombreValido, primerMensajeNuevo, preguntaDeChatCerrado, textoDeEnvio, textoDeRenombre, vistaPrevia,
  type ChatCentro, type DecisionEspera, type Envio, type LineaChat, type TrabajoP, type VistaPrevia,
  avisosDe, esperaCheck, esperaDe, esperasSinDormidos, incidenteSinVer, sinElRunner, turnosParaLaLista, ultimoYaEsta, vigiaCallado, type TabDelIndice, type VistosDeChats, type YaVistos,
} from '@/lib/centro-chats';
import { pedidosQueFaltan, type PedidoP } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { aspectoDe, elegidoPara, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';
import { respuestasDelChat } from '@/lib/centro-preguntas';
import { esperaAMartin, type AccionDeshacer, type AccionResponder } from '@/app/admin/runway/decisiones';
import { AUTOMATICO, aceptaModelo, cuentasDelChat, destinoDe, sesionAutomatica, type Esfuerzo, type Modelo } from '@/lib/centro-cuentas';
import { desconectarComputadoraAction, contestarPreguntaAction, creditoDelNegocioAction, ignorarDecisionAction, ignorarPreguntaAction, guardarAliasCuentaAction, guardarBorradorAction, guardarMunecoAction, marcarMensajeAction, marcarYaVistoAction, type pedidosDelChatAction, type turnosCentroAction, type FotoCentro } from './acciones';
// Las LECTURAS van por GET y no por acción (23/10/2026): ver ./lectura-centro.ts.
import { leerCentro } from './lectura-centro';
import type { CuentasConNombre } from '@/lib/centro-titulares';
import type { LecturaCredito } from '@/lib/credito-api';
import { pasosDelChat, type PasoDelTurno, type PasosPorChat } from '@/lib/centro-pasos';
import { claveDeLinea, estabilizarLista, minutoDe, mismoValor } from '@/lib/centro-estable';
import { SIN_MARCAS, TOPE_REENVIO, aplicarMarca, armarConCita, armarReenvio, type CambioMarca, type Cita, type MarcasChat } from '@/lib/centro-mensajes';
import { ESPERA_LOCAL_MS, ESPERA_REMOTA_MS, borradorQueVale, claveDeBorrador, leerBorrador, notaQueSale, textoParaMandar, type Borrador } from '@/lib/centro-caja';
import { guardarAdjuntos, leerAdjuntosGuardados } from './adjuntos-guardados';
import { barrerEnviadasViejas, recordarEnviadas, verFotosLocales } from './fotos-enviadas';
import { recordarVozEnviada, verVozLocal } from './voces-enviadas';
import type { NotaGrabada } from '@/app/_chat/nota-que-se-manda';
import { prepararNota } from '@/app/_chat/preparar-nota';
import { conLoQueSale, enviosEnCurso, escucharEnvios, idDeEnvioLocal, ponerEnCamino, sinEnvios, type EnvioLocal } from './envios-en-curso';
import { textoDeRespuesta, type PreguntaChat } from '@/lib/centro-preguntas-chat';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import { TEXTO_SOLO_ADJUNTOS, copiar, problemaAntesDeMandar, subirAdjuntos, useFirma } from './mandar';
import { NO_PUDE_COPIAR } from '@/lib/copiar-texto';

const REFRESCO_MS = 8000;
/** Una lista vacía que no cambia entre renders: las piezas memorizadas comparan por identidad. */
const SIN_TAREAS: TareaDelChat[] = [];
const SIN_PASOS: PasoDelTurno[] = [];
/** Los mismos turnos (por su uuid y su texto, que es lo que se dibuja). */
const mismosTurnos = (a: readonly TurnoChat[] | undefined, b: readonly TurnoChat[]) =>
  !!a && a.length === b.length && a.every((x, i) => x.uuid === b[i].uuid && x.texto.length === b[i].texto.length);
/** Con algo en camino (escrito o tomado), la pantalla mira más seguido: sale en segundos y tiene que verse (17/10/2026). */
const REFRESCO_APURADO_MS = 2500;

/** Lo que el servidor lee para el Centro, DESPUÉS de `puedeOperar`. Viaja entero de la página a la pantalla. */
export type DatosCentro = {
  /** La mitad de la lista que sale de las bitácoras (lib/centro-chats.ts → chatsDeBitacoras). */
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  /** Las tarjetas de la Ticketera, enteras; null si no se pudieron leer. */
  decisionesIniciales: DecisionEspera[] | null;
  /** Los muñecos que Martín eligió, por nombre (lib/centro-munecos-db.ts). */
  munecosIniciales: MunecosElegidos;
  /** Cuántas preguntas espera cada sesión (lib/centro-preguntas-chat-db.ts → leerAbiertas). */
  preguntasAbiertasIniciales?: Record<string, number>;
  /** El nombre y el email de cada cuenta (la G, lib/centro-titulares-db.ts). */
  cuentasIniciales?: CuentasConNombre;
  /** Lo último de cada chat, por sesión, para la lista (lib/centro-turnos-db.ts → leerUltimosTurnos). */
  ultimosIniciales?: Record<string, TurnoChat[]>;
  /** El ✓ de cada «Completado» (lib/centro-ya-vistos-db.ts), leído con la carga: sin él, el primer cuadro no tenía los avisos
   *  y el refresco los prendía segundos después (23/10/2026, Martín: «me decía que Cerebro estaba apagado y luego de unos segundos
   *  se prendió»). null = no se pudo leer. */
  yaVistosIniciales?: YaVistos | null;
  pedidos: PedidoP[];
  ahora: number;
  sub: string;
  /** Los nombres de las tabs: el jefe de un chat se llama como una (tabs.ts). */
  tabs: readonly string[];
  /** De qué tab es cada nombre (tabs.ts → indiceDeTabs, 10/11/2026): la lista se agrupa por tab y el «Completado» dice la suya. Sin
   *  esto, la lista se agrupa como antes (por el nombre del jefe). */
  indiceTabs?: readonly TabDelIndice[];
  /** Las acciones de la Ticketera (app/admin/runway/acciones.ts): contestar acá es contestar allá. */
  responder: AccionResponder;
  deshacer?: AccionDeshacer;
};

/** Un archivo elegido (o pegado) en la caja, con su vista previa local. `estado`: lo que la miniatura dice mientras no
 *  está listo (la caja del Web Generator lo LEE antes de mandar, app/web-generator/editor/adjuntos-agente.ts). */
export type AdjuntoCaja = { id: string; file: File; tipo: 'image' | 'document'; url: string; estado?: 'leyendo' | 'error' };
/** Una captura chica va tal cual (el texto de una captura se lee mejor en PNG); una foto grande se achica (Vercel corta
 *  un POST de más de ~4,5 MB). */
const TAL_CUAL_BYTES = 1_500_000;

/** Cómo avisa cada pantalla (el Toast de escritorio, el del teléfono). */
export type Avisar = (texto: string, tono: 'good' | 'bad') => void;

/** Lo de la cola que dibuja un chat. */
const trabajoDe = (p: Pedido): TrabajoP => ({
  id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at,
  texto: p.texto, estado: p.estado, motivo: p.motivo, entregado_at: p.entregado_at, cerrado_at: p.cerrado_at, cierre: p.cierre,
  ...(p.adjuntos?.length ? { adjuntos: p.adjuntos } : {}),
  ...(p.fotos?.length ? { fotos: p.fotos } : {}),
  ...(p.voz ? { voz: p.voz } : {}),
});


export function useCentro(d: DatosCentro, avisar: Avisar) {
  const { base, sub, tabs, responder, deshacer } = d;
  const indiceTabs = d.indiceTabs;
  // Los pedidos: los de la carga (lo sin terminar y lo terminado reciente) más los terminados viejos de cada chat que se abrió,
  // que se piden al abrirlo (23/10/2026, lib/progreso-reglas.ts → pedidosDeLaCarga). Se suman una vez: un pedido terminado no cambia.
  const [viejos, setViejos] = useState<PedidoP[]>([]);
  const pedidos = useMemo(() => (viejos.length ? [...d.pedidos, ...viejos] : d.pedidos), [d.pedidos, viejos]);
  const pedidosRef = useRef<ReadonlySet<string>>(new Set());
  pedidosRef.current = new Set(pedidos.map((p) => p.id));
  const pidiendo = useRef(new Set<string>());
  const [cola, setCola] = useState<Pedido[]>(d.colaInicial ?? []);
  // Las miniaturas que este navegador guardaba antes del 23/10 y ya no tienen burbuja (fotos-enviadas.ts): una vez por carga.
  useEffect(() => { void barrerEnviadasViejas(cola.map((p) => p.id)); }, [cola]);
  // Lo recién mandado se ve enseguida; cuando el refresco lo trae de la cola, se usa el de la cola.
  const [locales, setLocales] = useState<TrabajoP[]>([]);
  const [estado, setEstado] = useState<EstadoCarteros | null>(d.carterosIniciales);
  const [decisiones, setDecisiones] = useState<DecisionEspera[]>(d.decisionesIniciales ?? []);
  const [decisionesOk, setDecisionesOk] = useState(d.decisionesIniciales != null);
  const [ahora, setAhora] = useState(d.ahora);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [munecos, setMunecos] = useState<MunecosElegidos>(d.munecosIniciales);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  // ── El borrador nunca se pierde (17/10/2026, la B) ──────────────────────────────────────────────────────────
  // Uno por chat, por su DIRECCIÓN (la sesión: no cambia al renombrarlo). Se guarda mientras se escribe en el navegador
  // (localStorage) y, con más espera, en MaKo (cruza al teléfono); vuelve al abrir el chat (`cargarBorrador`, el más
  // nuevo de los dos) y se borra sólo cuando el mensaje SALIÓ (`limpiarBorrador`). `editado`: cuándo se tocó acá por
  // última vez, para que uno que llega de MaKo más viejo no pise lo que se está escribiendo.
  const editado = useRef<Record<string, number>>({});
  const relojes = useRef<Record<string, { local?: number; remota?: number }>>({});
  const guardarLocal = (dir: string, b: Borrador) => { try { window.localStorage.setItem(claveDeBorrador(dir), JSON.stringify(b)); } catch { /* es una comodidad */ } };
  const cargarBorrador = useCallback((c: ChatCentro, remoto: Borrador | null | undefined) => {
    const dir = claveParaUrl(c);
    let local: Borrador | null = null;
    try { local = leerBorrador(JSON.parse(window.localStorage.getItem(claveDeBorrador(dir)) ?? 'null')); } catch { /* sin localStorage */ }
    const vale = borradorQueVale(local, remoto ?? null);
    if (!vale || (editado.current[c.clave] ?? 0) >= vale.at) return;
    editado.current[c.clave] = vale.at;
    setBorradores((b) => (b[c.clave] === vale.texto ? b : { ...b, [c.clave]: vale.texto }));
  }, []);
  /** La cuenta elegida para cada chat (ausente = «Automático»): se recuerda mientras la pantalla está abierta. */
  const [cuentaDe, setCuentaDe] = useState<Record<string, string>>({});
  /** El modelo y el esfuerzo del próximo trabajo (null = «Automático»): vuelven a Automático después de mandar. */
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [esfuerzo, setEsfuerzo] = useState<Esfuerzo | null>(null);
  // Ya no hay «mandando» que frene la caja (27/10/2026): lo que sale se dibuja en el acto y sale por detrás
  // (envios-en-curso.ts). Queda en false para las pantallas que lo leen.
  const enviando = false;
  /** Los archivos elegidos (o pegados) en la caja de cada chat. El ref los tiene al día para sumar sin esperar un render. */
  const [adjuntos, setAdjuntos] = useState<Record<string, AdjuntoCaja[]>>({});
  const adjuntosRef = useRef(adjuntos);
  const ponerAdjuntos = (clave: string, xs: AdjuntoCaja[]) => {
    adjuntosRef.current = { ...adjuntosRef.current, [clave]: xs };
    setAdjuntos(adjuntosRef.current);
  };
  // El «⋯» de una fila (o el clic derecho): dónde abre y de qué chat es.
  const [menu, setMenu] = useState<{ x: number; y: number; clave: string } | null>(null);
  const [renombrando, setRenombrando] = useState<{ clave: string; texto: string; error: string | null; mandando: boolean } | null>(null);
  const [eligiendo, setEligiendo] = useState<{ clave: string; aspecto: Aspecto; guardando: boolean } | null>(null);
  const firma = useFirma(sub);
  // ── Lo que se dijo en el chat abierto (sus turnos, del transcript: «los chats no se entienden», 17/10/2026) ──
  // Se piden sólo para el chat que se mira (al abrirlo y en cada refresco): los demás no viajan.
  const [turnos, setTurnos] = useState<Record<string, TurnoChat[]>>({});
  // Y sus preguntas (17/10/2026, el formulario de su conversación): viajan con los turnos.
  const [preguntas, setPreguntas] = useState<Record<string, PreguntaChat[]>>({});
  // Y sus tareas del Plan (la C y la D): las que armaron su «Voy a trabajar en…» y su «Ya está».
  const [tareas, setTareas] = useState<Record<string, TareaDelChat[]>>({});
  const [abiertas, setAbiertas] = useState<Record<string, number>>(d.preguntasAbiertasIniciales ?? {});
  // Lo ÚLTIMO de todos los chats (17/10/2026): sin esto, la fila de un chat que no se abrió nunca sabía que su último mensaje era
  // un «Ya está», y el aviso del «Completado» sin ver no salía. Llega con cada refresco; no es la conversación (texto recortado).
  const [ultimos, setUltimos] = useState<Record<string, TurnoChat[]>>(d.ultimosIniciales ?? {});
  const ultimosFirma = useRef('');
  // Lo de WhatsApp en cada mensaje (17/10/2026, lib/centro-mensajes.ts): las marcas de Martín, guardadas en MaKo, y la cita
  // de la caja de cada chat (responder a un mensaje), que viaja en el texto firmado.
  const [marcas, setMarcas] = useState<Record<string, MarcasChat>>({});
  const [nombresCuentas, setNombresCuentas] = useState<CuentasConNombre>(d.cuentasIniciales ?? {});
  // Lo que están haciendo AHORA los chats ocupados (la E): llega con cada refresco.
  const [pasos, setPasos] = useState<PasosPorChat>({});
  /** El nombre que Martín le pone a una cuenta en el Uso (la G): devuelve el error, o null. */
  const renombrarCuenta = async (cuenta: string, alias: string): Promise<string | null> => {
    const r = await guardarAliasCuentaAction(cuenta, alias).catch(() => null);
    if (!r) return 'No pude guardarlo: vuelve a intentarlo.';
    if (!r.ok) return r.error;
    setNombresCuentas(r.cuentas);
    return null;
  };
  /** El crédito de API de los planes Max, para la sección «API» del Uso (UsoCredito.tsx): se pide al abrirla. */
  const leerCreditoApi = async (): Promise<LecturaCredito> =>
    (await leerCentro<LecturaCredito>('credito').catch(() => null)) ?? { ok: false, error: 'No pude leer el crédito: vuelve a intentarlo.' };
  /** El interruptor del crédito de Claude de un negocio (el ws1): devuelve la lectura nueva de la sección. */
  const cambiarCreditoDelNegocio = async (ws: number, prendido: boolean): Promise<LecturaCredito> =>
    (await creditoDelNegocioAction(ws, prendido).catch(() => null)) ?? { ok: false, error: 'No pude cambiarlo: vuelve a intentarlo.' };
  const [citas, setCitas] = useState<Record<string, Cita | null>>({});
  const mirado = useRef<ChatCentro | null>(null);
  const pedirTurnos = useCallback(async (c: ChatCentro) => {
    const locales = c.miembros.filter((m) => DESTINO_RE.test(m));
    if (!locales.length) return;
    // Por GET (23/10/2026): corre en cada refresco del chat abierto, y como acción hacía cola con las demás (lectura-centro.ts).
    const r = await leerCentro<Awaited<ReturnType<typeof turnosCentroAction>>>('turnos', { l: locales, dir: claveParaUrl(c) }).catch(() => null);
    if (r?.ok) {
      // Si no cambió nada, se queda el MISMO arreglo: así la conversación memorizada no se vuelve a dibujar en cada refresco.
      setTurnos((t) => (mismosTurnos(t[c.clave], r.turnos) ? t : { ...t, [c.clave]: r.turnos }));
      // Las preguntas, las tareas y las marcas, igual: un objeto nuevo de lo mismo rehacía el historial de TODOS los chats.
      setPreguntas((q) => { const v = mismoValor(q[c.clave], r.preguntas ?? []); return v === q[c.clave] ? q : { ...q, [c.clave]: v }; });
      setTareas((x) => { const v = mismoValor(x[c.clave], r.tareas ?? []); return v === x[c.clave] ? x : { ...x, [c.clave]: v }; });
      if (r.marcas) { const m = r.marcas; setMarcas((x) => { const v = mismoValor(x[c.clave], m); return v === x[c.clave] ? x : { ...x, [c.clave]: v }; }); }
      // El borrador de MaKo: el del teléfono, si es más nuevo que lo de acá.
      cargarBorrador(c, r.borrador ?? null);
    }
  }, [cargarBorrador]);
  /** La conversación avisa qué chat se está mirando (o null al cerrarla). */
  // ── Los «Completado» sin ver (17/10/2026, Martín: «un aviso en la tarjeta del chat cuando trae un "Ya está"») ──────
  // Como el globito de no leídos de WhatsApp, por dispositivo (localStorage): un chat que se abrió después de su «Ya está»
  // ya no lo avisa. `desde` es la primera vez que este navegador abrió el Ops Center: lo de antes no se avisa (si no, todos
  // los chats saldrían con aviso el primer día).
  const [vistos, setVistos] = useState<VistosDeChats | null>(null);
  /** El ✓ de cada «Completado», guardado en MaKo (18/10/2026): llega con cada refresco, así cruza al teléfono. */
  const [yaVistos, setYaVistos] = useState<YaVistos | null>(d.yaVistosIniciales ?? null);
  const [mirando, setMirando] = useState<string | null>(null);
  // Antes de pintar (useLayoutEffect): leído en un efecto, el primer cuadro contaba los avisos sin lo visto en este navegador y
  // el siguiente los cambiaba (23/10/2026).
  useLayoutEffect(() => { setVistos(leerVistos(Date.now())); }, []);
  const verChat = useCallback((clave: string) => {
    setVistos((v) => { const n = { desde: v?.desde ?? Date.now(), chats: { ...v?.chats, [clave]: Date.now() } }; guardarVistos(n); return n; });
  }, []);
  const mirar = useCallback((c: ChatCentro | null) => {
    // El que se deja también queda visto: lo que llegó mientras estaba abierto ya se vio.
    if (mirado.current && mirado.current.clave !== c?.clave) verChat(mirado.current.clave);
    mirado.current = c;
    setMirando(c?.clave ?? null);
    if (!c) return;
    verChat(c.clave);
    // Lo que quedó escrito en este navegador vuelve en el acto; lo de MaKo llega con los turnos.
    cargarBorrador(c, null);
    void pedirTurnos(c);
    // Sus pedidos terminados viejos, si faltan (los dibuja su conversación): una vez por pedido.
    const faltan = pedidosQueFaltan(c.pedidos, { has: (id) => pedidosRef.current.has(id) || pidiendo.current.has(id) });
    if (faltan.length) {
      faltan.forEach((id) => pidiendo.current.add(id));
      void leerCentro<Awaited<ReturnType<typeof pedidosDelChatAction>>>('trabajos', { id: faltan })
        .then((r) => { if (r.ok && r.pedidos.length) setViejos((v) => [...v, ...r.pedidos.filter((p) => !pedidosRef.current.has(p.id))]); })
        .catch(() => { faltan.forEach((id) => pidiendo.current.delete(id)); });
    }
    // Y los archivos que quedaron sin mandar (IndexedDB), si la caja está vacía.
    if (!(adjuntosRef.current[c.clave]?.length)) {
      void leerAdjuntosGuardados(claveParaUrl(c)).then((fs) => {
        if (!fs.length || adjuntosRef.current[c.clave]?.length) return;
        adjuntosRef.current = { ...adjuntosRef.current, [c.clave]: fs.map((f): AdjuntoCaja => ({ id: idLocal('a'), file: f, tipo: tipoDeElegidoCentro(f, true) === 'image' ? 'image' : 'document', url: URL.createObjectURL(f) })) };
        setAdjuntos(adjuntosRef.current);
      });
    }
  }, [pedirTurnos, cargarBorrador]);
  const turnosDe = (c: ChatCentro): TurnoChat[] => turnos[c.clave] ?? [];
  const preguntasDe = (c: ChatCentro): PreguntaChat[] => preguntas[c.clave] ?? [];
  const tareasDe = (c: ChatCentro): TareaDelChat[] => tareas[c.clave] ?? SIN_TAREAS;
  const marcasDe = (c: ChatCentro): MarcasChat => marcas[c.clave] ?? SIN_MARCAS;
  /** Una marca de Martín (reaccionar, destacar, fijar, eliminar para él): se ve en el acto y se guarda en MaKo. Si no se
   *  pudo guardar, vuelve atrás y lo dice. */
  const marcar = async (c: ChatCentro, cambio: CambioMarca) => {
    const antes = marcas[c.clave] ?? SIN_MARCAS;
    setMarcas((x) => ({ ...x, [c.clave]: aplicarMarca(x[c.clave] ?? SIN_MARCAS, cambio) }));
    const r = await marcarMensajeAction(claveParaUrl(c), cambio).catch(() => null);
    if (r?.ok) setMarcas((x) => ({ ...x, [c.clave]: r.marcas }));
    else { setMarcas((x) => ({ ...x, [c.clave]: antes })); avisar(r?.error ?? 'No pude guardarlo', 'bad'); }
  };
  const citaDe = (clave: string): Cita | null => citas[clave] ?? null;
  const citar = (clave: string, cita: Cita | null) => setCitas((x) => ({ ...x, [clave]: cita }));


  // Lo que está saliendo (envios-en-curso.ts) vive fuera de React: volver a esta pantalla lo vuelve a mostrar.
  const enCurso = useSyncExternalStore(escucharEnvios, enviosEnCurso, sinEnvios);
  const trabajos = useMemo(() => {
    const deCola = cola.map(trabajoDe);
    return conLoQueSale([...locales.filter((l) => !deCola.some((w) => w.id === l.id)), ...deCola], enCurso);
  }, [cola, locales, enCurso]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  // Lo que espera a Martín en cada sesión: las tarjetas de la Ticketera y las preguntas del formulario de su chat.
  const esperas = useMemo(() => {
    const m = { ...esperasPorChat(decisiones, carteros) };
    for (const [local, n] of Object.entries(abiertas)) m[local] = (m[local] ?? 0) + n;
    return m;
  }, [decisiones, carteros, abiertas]);
  // Sin el Runner (17/10/2026, Martín: «El chat de "Runner" no tiene sentido que esté visible en el Center»): sigue trabajando
  // por detrás y su estado está en «Uso y Runners». Se saca ACÁ, no en `completarChats`: la PC lo sube marcado (`esRunner`) y de
  // esa marca sale que no se le entrega nada (tests/centro-runner-nube.test.ts).
  // El reloj de la lista, AL MINUTO: `completarChats` lo usa para `viejo` (4 min). Con el de cada refresco se rehacían todos los
  // chats cada 2,5 s aunque nada cambiara. Y cada chat que vale lo mismo es el de antes (la fila y el hilo no se redibujan).
  const ahoraLista = minutoDe(ahora);
  const chatsAntes = useRef<readonly ChatCentro[] | undefined>(undefined);
  const conVigia = useMemo(() => {
    const v = estabilizarLista(chatsAntes.current, sinElRunner(completarChats(base, { carteros, trabajos, ahora: ahoraLista, pasos })), (c) => c.clave);
    chatsAntes.current = v;
    return v;
  }, [base, carteros, trabajos, ahoraLista, pasos]);
  // «MaKo en WhatsApp» (el vigía: un cron que dice «Sin incidentes nuevos» cada rato) sale de la lista mientras está callado y
  // vuelve, avisando como «Espera tu respuesta», cuando deja un incidente de verdad (Martín, 17/10/2026). Con lo último que
  // trajo el refresco: abrirlo no hace falta para saberlo.
  const esperasConVigia = useMemo(() => {
    // Un chat dormido hace días (10/11/2026, lib/centro-chats.ts → chatDormido) no deja nada esperando a Martín: ni globito, ni «Espera
    // tu respuesta», ni el primer lugar de la lista.
    const m = { ...esperasSinDormidos(esperas, conVigia, ahoraLista) };
    for (const c of conVigia) {
      const local = c.miembros.find((k) => DESTINO_RE.test(k));
      if (local && incidenteSinVer(c, turnosParaLaLista(c, turnos, ultimos, false), vistos?.chats[c.clave] ?? vistos?.desde ?? Infinity)) m[local] = (m[local] ?? 0) + 1;
    }
    return m;
  }, [conVigia, esperas, turnos, ultimos, vistos, ahoraLista]);
  const chats = useMemo(
    () => conVigia.filter((c) => !vigiaCallado(c, turnosParaLaLista(c, turnos, ultimos, false), esperaDe(c, esperasConVigia), mirando === c.clave)),
    [conVigia, turnos, ultimos, esperasConVigia, mirando],
  );
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  // La conversación de cada chat, una vez: de ella salen el segundo renglón y en qué está trabajando.
  // Y cada línea que vale lo mismo es la de antes (por su turno, su pedido, su trabajo): el hilo memorizado sólo dibuja la nueva.
  const lineasAntes = useRef(new Map<string, readonly LineaChat[]>());
  const lineasDe = useMemo(() => {
    const m = new Map<string, LineaChat[]>(chats.map((c) => [c.clave, estabilizarLista(lineasAntes.current.get(c.clave),
      historialDelChat(c, porId, trabajos, respuestasDelChat(c, decisiones, carteros), turnosParaLaLista(c, turnos, ultimos, mirando === c.clave), preguntas[c.clave]),
      claveDeLinea) as LineaChat[]]));
    lineasAntes.current = m;
    return m;
  }, [chats, porId, trabajos, decisiones, carteros, turnos, ultimos, mirando, preguntas]);
  const previas = useMemo(() => new Map<string, VistaPrevia | null>([...lineasDe].map(([k, l]) => [k, vistaPrevia(l)])), [lineasDe]);
  // Los pasos en vivo de cada chat (la E), una vez por refresco: el hilo memorizado compara por identidad.
  const pasosPorChat = useMemo(() => new Map<string, PasoDelTurno[]>(chats.map((c) => [c.clave, pasosDelChat(c, pasos)])), [chats, pasos]);
  // En qué está: el paso que está dando AHORA, si la PC lo subió; si no, el título de lo que tiene en curso.
  const enCursos = useMemo(() => new Map<string, string | null>([...lineasDe].map(([k, l]) => [k, pasosPorChat.get(k)?.at(-1)?.texto ?? enQueTrabaja(l)])), [lineasDe, pasosPorChat]);
  const pasosDe = (c: ChatCentro): PasoDelTurno[] => pasosPorChat.get(c.clave) ?? SIN_PASOS;
  // Los borradores guardados en este navegador, de TODOS los chats y no sólo del abierto (17/10/2026, Martín: «un borrador
  // sin mandar se ve en la lista de chats», como WhatsApp): se leen una vez por chat, al aparecer en la lista.
  const conBorradorLeido = useRef(new Set<string>());
  const clavesDeChats = chats.map((c) => c.clave).join('\n');
  useEffect(() => {
    for (const c of chats) if (!conBorradorLeido.current.has(c.clave)) { conBorradorLeido.current.add(c.clave); cargarBorrador(c, null); }
  }, [clavesDeChats]); // eslint-disable-line react-hooks/exhaustive-deps
  /** El renglón del borrador de un chat para su fila («Borrador: …»); null = no tiene. */
  const borradorDeLista = (clave: string): string | null => {
    const t = (borradores[clave] ?? '').split('\n').map((x) => x.trim()).find(Boolean);
    return t ? t.replace(/^• /, '') : null;
  };
  /** Los chats cuyo último «Ya está» espera el ✓ de Martín (lib/centro-chats.ts → esperaCheck): aunque lo haya abierto y aunque
   *  el chat haya escrito algo después (18/10/2026, pedido 1d15877a). Antes era por dispositivo y se apagaba al abrirlo. */
  const yaSinVer = useMemo(() => new Set([...lineasDe].filter(([k, l]) => esperaCheck(ultimoYaEsta(l), yaVistos, k)).map(([k]) => k)), [lineasDe, yaVistos]);
  /** El ✓ de un «Completado»: al toque en pantalla, y en MaKo; si no se pudo guardar, vuelve atrás y lo dice. */
  const marcarYaVisto = useCallback(async (clave: string, instante: number) => {
    let antes: YaVistos | null = null;
    setYaVistos((v) => { antes = v; return { ...(v ?? {}), [clave]: Math.max(v?.[clave] ?? 0, instante) }; });
    const r = await marcarYaVistoAction(clave, instante).catch(() => null);
    if (r?.ok) setYaVistos(r.yaVistos);
    else { setYaVistos(antes); avisar(r?.error ?? 'No pude guardarlo', 'bad'); }
  }, [avisar]);
  /** Cuánto avisa cada chat en su fila: lo que espera a Martín MÁS un «Completado» sin ver (es el mismo aviso, 17/10/2026). Del
   *  globito de la criatura y del orden de la lista. */
  const avisos = useMemo(() => (c: ChatCentro) => avisosDe(esperaDe(c, esperasConVigia), yaSinVer.has(c.clave)), [esperasConVigia, yaSinVer]);

  const refrescar = useCallback(async () => {
    // ⚠️ UN REFRESCO QUE FALLA NO CAMBIA LO DIBUJADO (22/10/2026): un 503 hace que la acción TIRE (Next: «An unexpected response
    // was received from the server»). Queda lo último que se vio, sin tocar ninguna fila, y el intervalo reintenta.
    // Por GET (23/10/2026): una acción hacía cola con las demás y frenaba la Ticketera y el Uso (lectura-centro.ts).
    const f = await leerCentro<FotoCentro>('foto').catch(() => null);
    // ⚠️ CADA COSA CAMBIA SÓLO SI CAMBIÓ (23/10/2026, un chat trabajando trababa 0,7–3,6 s en cada vuelta de 2,5 s): con un
    // arreglo nuevo de lo mismo se rehacían todos los chats y su historial, y se volvía a dibujar la lista y el hilo enteros.
    // `mismoValor` devuelve el de antes si vale lo mismo (lib/centro-estable.ts).
    if (f?.ok) {
      setCola((x) => mismoValor(x, f.pedidos)); setEstado((x) => mismoValor(x, f.carteros)); setAbiertas((x) => mismoValor(x, f.preguntasAbiertas ?? {}));
      if (f.ultimos) { const firma = JSON.stringify(f.ultimos); if (firma !== ultimosFirma.current) { ultimosFirma.current = firma; setUltimos(f.ultimos); } }
      if (f.cuentas) { const c = f.cuentas; setNombresCuentas((x) => mismoValor(x, c)); }
      setPasos((x) => mismoValor(x, f.pasos ?? {}));
      if (f.yaVistos) { const v = f.yaVistos; setYaVistos((x) => mismoValor(x, v)); }
      if (f.decisiones) { const d = f.decisiones; setDecisiones((x) => mismoValor(x, d)); setDecisionesOk(true); }
    }
    if (mirado.current) void pedirTurnos(mirado.current);
    setAhora(Date.now());
  }, [pedirTurnos]);
  const apurado = hayEnCamino(trabajos, ahora);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, apurado ? REFRESCO_APURADO_MS : REFRESCO_MS);
    const volver = () => { if (document.visibilityState === 'visible') refrescar(); };
    document.addEventListener('visibilitychange', volver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', volver); };
  }, [refrescar, apurado]);
  // Vercel, después de dibujar.
  // Por GET (23/10/2026): como acción, sus hasta 8 s esperando a Vercel dejaban en la cola a todas las demás.
  useEffect(() => { let vivo = true; leerCentro<LecturaPushes>('pushes').then((p) => { if (vivo) setPushes(p); }).catch(() => {}); return () => { vivo = false; }; }, []);

  // ── Las preguntas de cada chat (la Ticketera de ESE chat, arriba de su caja) ──────────────────────
  // Contestar acá o en la Ticketera guarda lo mismo; lo de acá se ve en el acto (el refresco trae la verdad).
  const anotarRespuesta = (id: number, clave: string | null, texto: string) => setDecisiones((ds) => ds.map((x) => (x.id !== id ? x : {
    ...x, respuesta: clave, respuestaTexto: clave ? texto.trim() || null : null, respondidaAt: clave ? new Date().toISOString() : null, recogidaAt: null,
  })));
  const responderAca: AccionResponder = async (prev, fd) => {
    const r = await responder(prev, fd);
    if (r.ok) anotarRespuesta(Number(fd.get('id')), String(fd.get('clave') ?? ''), String(fd.get('texto') ?? ''));
    return r;
  };
  const deshacerAca: AccionDeshacer = async (fd) => {
    if (!deshacer) return { ok: false, error: 'Deshazlo desde la Ticketera.', yaRecogida: false };
    const r = await deshacer(fd);
    if (r.ok) anotarRespuesta(Number(fd.get('id')), null, '');
    return r;
  };
  const pendientesTicketera = decisiones.filter((x) => esperaAMartin(x) && x.urgencia !== 'aviso').length;

  // ── La caja ────────────────────────────────────────────────────────────────────────────────────
  const claveFirma = firma.clave === undefined ? undefined : firma.clave?.id ?? null;
  // ── La cuenta (Martín, 17/10/2026: «Si no selecciono nada que lo decida solo, pero debería poder seleccionar») ──
  const cuentaElegida = (clave: string) => cuentaDe[clave] ?? AUTOMATICO;
  const elegirCuenta = (clave: string, cuenta: string) => setCuentaDe((m) => ({ ...m, [clave]: cuenta }));
  /** A qué sesión va lo que se escribe en la caja de ESTE chat (la cuenta elegida, o la automática). */
  const destinoDeChat = (c: ChatCentro) => destinoDe(c, cuentaElegida(c.clave), carteros, ahora);
  /** Las cuentas del chat para el selector, y cuál elegiría «Automático». */
  const cuentasDe = (c: ChatCentro) => ({ opciones: cuentasDelChat(c, carteros, ahora), automatica: sesionAutomatica(c, carteros, ahora)?.cuenta ?? null });
  const envioDe = (c: ChatCentro): Envio => comoSale(destinoDeChat(c), carteros, claveFirma, ahora);
  const borradorDe = (clave: string) => borradores[clave] ?? '';
  const direccionDe = (clave: string) => { const c = chats.find((x) => x.clave === clave); return c ? claveParaUrl(c) : null; };
  const ponerBorrador = (clave: string, t: string) => {
    setBorradores((b) => ({ ...b, [clave]: t }));
    const dir = direccionDe(clave);
    if (!dir) return;
    const at = Date.now();
    editado.current[clave] = at;
    const e = relojes.current[clave] ?? (relojes.current[clave] = {});
    window.clearTimeout(e.local); window.clearTimeout(e.remota);
    e.local = window.setTimeout(() => guardarLocal(dir, { texto: t, at }), ESPERA_LOCAL_MS);
    e.remota = window.setTimeout(() => { void guardarBorradorAction(dir, t, at).catch(() => null); }, ESPERA_REMOTA_MS);
  };
  /** Después de que el mensaje SALIÓ: la caja vacía, acá, en MaKo (en el acto, sin espera) y sus archivos guardados. */
  const limpiarBorrador = (clave: string) => {
    setBorradores((b) => ({ ...b, [clave]: '' }));
    const dir = direccionDe(clave);
    const e = relojes.current[clave];
    if (e) { window.clearTimeout(e.local); window.clearTimeout(e.remota); }
    if (!dir) return;
    const at = Date.now();
    editado.current[clave] = at;
    guardarLocal(dir, { texto: '', at });
    void guardarBorradorAction(dir, '', at).catch(() => null);
    void guardarAdjuntos(dir, []);
  };

  /**
   * La caja se vacía A LA VISTA al mandar, pero lo GUARDADO (el borrador y los adjuntos, acá y en MaKo) se borra recién cuando
   * el mensaje quedó firmado (revisión de 928bdde0d, media): lo que está en camino vive en memoria, y si la pestaña se recarga
   * o el envío falla, el texto vuelve a la caja al abrirla. Devuelve lo que hay que llamar cuando salió; si mientras tanto se
   * escribió otra cosa en la caja, no la pisa.
   */
  const vaciarCajaHastaQueSalga = (clave: string): (() => void) => {
    setBorradores((b) => ({ ...b, [clave]: '' }));
    const e = relojes.current[clave];
    if (e) { window.clearTimeout(e.local); window.clearTimeout(e.remota); }
    const desde = Date.now();
    editado.current[clave] = desde;
    return () => { if ((editado.current[clave] ?? 0) <= desde) limpiarBorrador(clave); };
  };

  /** Lo que se acaba de mandar, para que se vea en su chat mientras llega el refresco. */
  const anotarEnviado = (t: TrabajoP) => { setLocales((l) => [t, ...l]); refrescar(); };

  // ── «Nuevo chat» con un clic (17/10/2026, docs/diseno-nuevo-chat-un-clic.md) ──────────────────────────────────
  // Martín: «un clic + el permiso de la PC», nunca pegar un comando en PowerShell. Es un trabajo firmado con
  // `destino: 'nuevo'`, por el MISMO camino que todo lo demás (mandar.ts); lo abre la PC (cartero.mjs → `abrir`).
  /** ¿Se abre un chat en esa cuenta desde acá? Una terminal, y su Runner con el cartero que abre (1.11.0). */
  const puedeAbrirEn = (cuenta: string) => tieneTerminal(cuenta) && carteros.some((k) => k.cuenta === cuenta && aceptaAbrir(k.version));
  /** Cómo va el último que se pidió abrir (un trabajo `nuevo` no es de ningún chat de la lista). */
  const apertura = estadoDeApertura(trabajos);
  /** ¿Lleva adjuntos un chat NUEVO (cartero 1.22.0, 28/10/2026)? En esa cuenta, o sin cuenta en alguna de las que abren. */
  const adjuntaEnNuevo = (cuenta?: string) => carteros.some((k) => (!cuenta || k.cuenta === cuenta) && puedeAbrirEn(k.cuenta) && aceptaAdjuntosEnNuevo(k.version));
  async function abrirChat(b: { nombre: string; cuenta: string; texto?: string; archivos?: readonly File[] }): Promise<boolean> {
    const nombre = b.nombre.replace(/\s+/g, ' ').trim();
    if (problemaDeNombreNuevo(nombre)) { avisar('Sólo letras y números', 'bad'); return false; }
    if (!puedeAbrirEn(b.cuenta)) { avisar('Todavía no abre chats', 'bad'); return false; }
    // Los archivos del primer mensaje (28/10/2026): firmados con él, los baja la PC antes de abrir el chat (cartero 1.22.0).
    const archivos = b.archivos ?? [];
    if (archivos.length && !adjuntaEnNuevo(b.cuenta)) { avisar('Ese Runner todavía no lleva archivos a un chat nuevo', 'bad'); return false; }
    const texto = b.texto?.trim() || (archivos.length ? TEXTO_SOLO_ADJUNTOS : primerMensajeNuevo(nombre));
    let subidos: AdjuntoPedido[] = [];
    if (archivos.length) {
      const s = await subirAdjuntos(archivos, carteros.some((k) => k.cuenta === b.cuenta && aceptaAdjuntosGrandes(k.version)));
      if (!s.ok) { avisar(s.error, 'bad'); return false; }
      subidos = s.adjuntos;
    }
    const r = await firma.mandar({ sesion: DESTINO_NUEVO, cuenta: b.cuenta, titulo: nombre }, texto, 'solo_esto', {}, subidos);
    if (!r.ok) { avisar(r.error, 'bad'); return false; }
    anotarEnviado({
      id: r.id, destino: DESTINO_NUEVO, destino_titulo: nombre, destino_cuenta: b.cuenta, created_at: r.creado, texto, estado: 'escrito', motivo: null, cierre: null,
      ...(subidos.length ? { adjuntos: subidos.map((a) => a.nombre) } : {}),
    });
    avisar('Se abre en 2 minutos', 'good');
    return true;
  }

  /**
   * Mandar un texto a un chat que YA existe sin pasar por su caja: el «Nuevo chat» sin modal decidió, con el primer mensaje, que va
   * a ese chat (17/10/2026). Sale por el mismo camino firmado que la caja (`firma.mandar`) y se anota igual en su conversación.
   * Con los archivos del primer mensaje (28/10/2026), como los manda la caja de ese chat: con su Runner y sus topes.
   */
  async function mandarTextoA(c: ChatCentro, texto: string, archivos: readonly File[] = []): Promise<boolean> {
    const d = destinoDeChat(c);
    const envio = envioDe(c);
    if (!d.sesion || !envio.puede) { avisar(textoDeEnvio(envio) ?? 'No recibe ahora', 'bad'); return false; }
    let subidos: AdjuntoPedido[] = [];
    if (archivos.length) {
      const grandes = grandesDe(c);
      const problema = puedeAdjuntar(c) ? problemaDeAdjuntosCaja(archivos.map((f) => f.size), grandes) : 'Ese chat todavía no recibe archivos';
      if (problema) { avisar(problema, 'bad'); return false; }
      const s = await subirAdjuntos(archivos, grandes);
      if (!s.ok) { avisar(s.error, 'bad'); return false; }
      subidos = s.adjuntos;
    }
    const r = await firma.mandar({ sesion: d.sesion, cuenta: d.cuenta, titulo: c.titulo, tope: topeDe(c) }, texto, 'solo_esto', {}, subidos);
    if (!r.ok) { avisar(r.error, 'bad'); return false; }
    // Las fotos se ven en su conversación, como las que salen de su caja.
    if (subidos.length) recordarEnviadas(r.id, archivos, subidos);
    anotarEnviado({
      id: r.id, destino: d.sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: r.creado, texto, estado: 'escrito', motivo: null, cierre: null,
      ...(subidos.length ? { adjuntos: subidos.map((a) => a.nombre) } : {}),
    });
    return true;
  }

  // ── Los adjuntos de la caja (17/10/2026): fotos y PDF, también pegando una captura con Ctrl+V ─────────────
  const adjuntosDe = (clave: string) => adjuntos[clave] ?? [];
  /** ¿Baja adjuntos el Runner de la cuenta a la que sale? Con un cartero de antes de la 1.9.0 el trabajo llegaría SIN
   *  los archivos y nadie lo diría: la caja no ofrece adjuntar. */
  const puedeAdjuntar = (c: ChatCentro) => {
    const { cuenta } = destinoDeChat(c);
    return carteros.some((k) => (!cuenta || k.cuenta === cuenta) && aceptaAdjuntos(k.version));
  };
  /** Cuánto texto acepta el Runner de la cuenta a la que sale (18/10/2026): uno de antes de la 1.15.8 rechaza más de 8000. */
  const topeDe = (c: ChatCentro) => {
    const { cuenta } = destinoDeChat(c);
    return carteros.some((k) => (!cuenta || k.cuenta === cuenta) && aceptaTextoLargo(k.version)) ? MAX_TEXTO_LARGO : MAX_TEXTO;
  };
  /** ¿El Runner de la cuenta a la que sale baja archivos grandes (1.16.0, 18/10/2026)? Con él: hasta 20 archivos de hasta
   *  100 MB, subidos directo al storage y TAL CUAL (no se achican). Con uno de antes, los topes de siempre (4 y 4 MB). */
  const grandesDe = (c: ChatCentro | undefined) => {
    if (!c) return false;
    const { cuenta } = destinoDeChat(c);
    return carteros.some((k) => (!cuenta || k.cuenta === cuenta) && aceptaAdjuntosGrandes(k.version));
  };
  /** `conGrandes`: la caja que no es de ningún chat de la lista (la del chat nuevo) dice ella si van los topes grandes. */
  const sumarAdjuntos = async (clave: string, lista: readonly File[], conGrandes?: boolean) => {
    if (!lista.length) return;
    const grandes = conGrandes ?? grandesDe(chats.find((x) => x.clave === clave));
    // Fotos y PDF siempre; Word, Excel, PowerPoint y texto, con un Runner 1.16.0 (18/10/2026). Nunca un ejecutable.
    const validos = lista.filter((f) => tipoDeElegidoCentro(f, grandes) != null);
    if (validos.length < lista.length) avisar(grandes ? 'Solo fotos, PDF, Word, Excel, PowerPoint o texto.' : ERROR_ADJUNTO.formato, 'bad');
    const listos: File[] = [];
    for (const f of validos) {
      // Lo que la PC acepta tal cual no se toca; lo demás (un HEIC, una foto enorme con un Runner de antes) se achica.
      const tipoOk = /^image\/(png|jpeg|webp|gif)$|^application\/pdf$/.test(f.type);
      const talCual = tipoOk && (grandes || f.size <= TAL_CUAL_BYTES);
      let listo: File;
      try { listo = talCual ? f : await achicarImagen(f); } catch (e) { avisar(e instanceof Error ? e.message : 'No pude leer esa imagen.', 'bad'); continue; }
      // LEÍDO YA, no al mandar (ticket #8, 25/10/2026): en Android, un archivo de la galería o de la cámara deja de poder
      // leerse si la app pasa a segundo plano, y al «Firmar y mandar» salía «No pude subir los adjuntos» (./leer-adjunto.ts).
      try { listos.push(await enMemoria(listo)); } catch { avisar(ERROR_SUBIDA.leer(f.name), 'bad'); }
    }
    if (!listos.length) return;
    const antes = adjuntosRef.current[clave] ?? [];
    const problema = problemaDeAdjuntosCaja([...antes.map((a) => a.file.size), ...listos.map((f) => f.size)], grandes);
    if (problema) { avisar(problema, 'bad'); return; }
    const todos = [...antes, ...listos.map((f): AdjuntoCaja => ({
      id: idLocal('a'), file: f, tipo: tipoDeElegidoCentro(f, grandes) === 'image' ? 'image' : 'document', url: URL.createObjectURL(f),
    }))];
    ponerAdjuntos(clave, todos);
    const dir = direccionDe(clave);
    if (dir) void guardarAdjuntos(dir, todos.map((a) => a.file));
  };
  const quitarAdjunto = (clave: string, id: string) => {
    const antes = adjuntosRef.current[clave] ?? [];
    const a = antes.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    const quedan = antes.filter((x) => x.id !== id);
    ponerAdjuntos(clave, quedan);
    const dir = direccionDe(clave);
    if (dir) void guardarAdjuntos(dir, quedan.map((x) => x.file));
  };
  /** Después de mandar: la caja queda vacía. */
  // La nota de voz que la caja grabó y transcribió (26/10/2026): sale como nota (VozEnviada.tsx), con su texto.
  const notas = useRef<Record<string, NotaGrabada>>({});
  const notaGrabada = (clave: string, n: NotaGrabada) => { notas.current[clave] = n; };

  const vaciarAdjuntos = (clave: string) => {
    for (const a of adjuntosRef.current[clave] ?? []) URL.revokeObjectURL(a.url);
    ponerAdjuntos(clave, []);
  };
  /** Lo que se había tomado de la caja vuelve a ella TAL CUAL, delante de lo que haya (el chat nuevo, cuando la nota con la
   *  que salía no se entendió: 28/10/2026). Ya pasó por `sumarAdjuntos`: no se vuelve a validar ni a achicar. */
  const devolverAdjuntos = (clave: string, xs: readonly AdjuntoCaja[]) => {
    if (!xs.length) return;
    const todos = [...xs, ...(adjuntosRef.current[clave] ?? [])];
    ponerAdjuntos(clave, todos);
    const dir = direccionDe(clave);
    if (dir) void guardarAdjuntos(dir, todos.map((a) => a.file));
  };

  /**
   * Mandar lo de la caja SIN ESPERAR NADA (27/10/2026, Martín: «tarda un montón en verse en el chat. Debe ser automático; si
   * hay procesos por detrás, se tiene que enviar igual»). Se dibuja en el acto con su reloj y la caja queda libre; subir los
   * archivos, firmar y encolar corren por detrás, en la cola de ESTE chat (envios-en-curso.ts). Lo que ya se sabe que no
   * sale (sin Token, una clave pegada, muy largo) se dice en el acto y la caja no se vacía.
   */
  function mandar(c: ChatCentro) {
    // Lo que sale es Markdown de verdad: las viñetas de la caja («• ») vuelven a ser «- » (lib/centro-caja.ts).
    // Con la cita arriba si responde a un mensaje (lib/centro-mensajes.ts → armarConCita): la PC entrega sólo lo firmado.
    const texto = armarConCita(citas[c.clave] ?? null, textoParaMandar(borradorDe(c.clave)));
    const archivos = (adjuntosRef.current[c.clave] ?? []).map((a) => a.file);
    const nota = notaQueSale(notas.current[c.clave], borradorDe(c.clave));
    delete notas.current[c.clave];
    const d = destinoDeChat(c);
    if (!d.sesion || !envioDe(c).puede || (!texto.trim() && !archivos.length)) return;
    const tope = topeDe(c);
    const antes = problemaAntesDeMandar(!!firma.clave, texto, archivos.length > 0, tope);
    if (antes) { avisar(antes, 'bad'); return; }
    // El modelo y el esfuerzo sólo viajan a un chat de la app (lib/centro-cuentas.ts → aceptaModelo).
    const como = aceptaModelo(d.sesion) ? { modelo, esfuerzo } : {};
    const voz = nota ? { segundos: Math.max(1, Math.round(nota.segundos)) } : null;
    const grandes = grandesDe(c);
    const sesion = d.sesion;
    const id = idDeEnvioLocal();
    const queSale = texto.trim() || TEXTO_SOLO_ADJUNTOS;
    // Las fotos y la nota se ven en el acto, con el id local (fotos-enviadas.ts, voces-enviadas.ts).
    verFotosLocales(id, archivos);
    if (nota) verVozLocal(id, nota.audio);
    const w: EnvioLocal = {
      id, destino: sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: new Date().toISOString(), texto: queSale,
      estado: 'escrito', motivo: null, cierre: null, ...(archivos.length ? { adjuntos: archivos.map((f) => f.name) } : {}), ...(voz ? { voz } : {}),
      local: { fase: 'enviando', clave: c.clave },
    };
    const mandarFirmado = firma.mandar;
    const salio = vaciarCajaHastaQueSalga(c.clave);
    ponerEnCamino(w, async () => {
      // Primero los archivos: el trabajo se firma con el `ref` de cada uno y el sha256 que calculó este navegador.
      let subidos: AdjuntoPedido[] = [];
      if (archivos.length) {
        const s = await subirAdjuntos(archivos, grandes);
        if (!s.ok) return s;
        subidos = s.adjuntos;
      }
      const r = await mandarFirmado({ sesion, cuenta: d.cuenta, titulo: c.titulo, tope }, texto, 'solo_esto', como, subidos, voz);
      if (!r.ok) return r;
      // La nota y las fotos, con el id de verdad: su MP3 y sus miniaturas suben para verlas en otro dispositivo.
      if (nota) recordarVozEnviada(r.id, nota.audio);
      if (subidos.length) recordarEnviadas(r.id, archivos, subidos);
      salio();
      refrescar();
      return {
        ok: true, trabajo: {
          id: r.id, destino: sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: r.creado, texto: queSale, estado: 'escrito',
          motivo: null, cierre: null, ...(subidos.length ? { adjuntos: subidos.map((a) => a.nombre) } : {}), ...(voz ? { voz } : {}),
        },
      };
    });
    vaciarAdjuntos(c.clave);
    citar(c.clave, null);
    setModelo(null);
    setEsfuerzo(null);
  }

  /**
   * La nota de voz SALE EN EL ACTO (27/10/2026, Martín: «Apenas envío el audio... se debe enviar automáticamente; yo puedo
   * reproducirlo. Si tarda unos segundos después en leerlo, eso es un proceso interno»). La caja la da apenas se grabó
   * (CajaChat → `onGrabada`); acá se dibuja con su reproductor y, por detrás, se pasa a MP3, se transcribe y se firma. La PC
   * recibe la transcripción, como siempre; si la transcripción falla, la burbuja lo dice y ofrece reintentar.
   */
  function mandarNota(c: ChatCentro, audio: Blob, segundos: number) {
    const d = destinoDeChat(c);
    const sale = envioDe(c);
    if (!d.sesion || !sale.puede) { avisar(textoDeEnvio(sale) ?? 'No recibe ahora', 'bad'); return; }
    if (!firma.clave) { avisar('Crea tu Token para comenzar a chatear', 'bad'); return; }
    const cita = citas[c.clave] ?? null;
    const como = aceptaModelo(d.sesion) ? { modelo, esfuerzo } : {};
    const voz = { segundos: Math.max(1, Math.round(segundos)) };
    const sesion = d.sesion;
    const tope = topeDe(c);
    const id = idDeEnvioLocal();
    verVozLocal(id, audio);
    const mandarFirmado = firma.mandar;
    let preparada: { mp3: Blob; texto: string } | null = null;
    ponerEnCamino({
      id, destino: sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: new Date().toISOString(), texto: '', estado: 'escrito',
      motivo: null, cierre: null, voz, local: { fase: 'transcribiendo', clave: c.clave },
    }, async (fase) => {
      // Reintentar no vuelve a transcribir lo que ya se transcribió (revisión de 928bdde0d, baja): si falló la firma, sólo firma.
      if (!preparada) {
        const p = await prepararNota(audio);
        if ('error' in p) return { ok: false, error: p.error };
        preparada = p;
      }
      const p = preparada;
      fase('enviando');
      const texto = armarConCita(cita, p.texto);
      const r = await mandarFirmado({ sesion, cuenta: d.cuenta, titulo: c.titulo, tope }, texto, 'solo_esto', como, [], voz);
      if (!r.ok) return r;
      recordarVozEnviada(r.id, p.mp3);
      refrescar();
      return { ok: true, trabajo: { id: r.id, destino: sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: r.creado, texto, estado: 'escrito', motivo: null, cierre: null, voz } };
    });
    citar(c.clave, null);
    setModelo(null);
    setEsfuerzo(null);
  }

  /** Reenviar un mensaje a otros chats (lo de WhatsApp, 17/10/2026): a cada uno le sale un trabajo FIRMADO con «↪ Reenviado
   *  de «…»» arriba, por el mismo camino que la caja. Devuelve cuántos salieron. */
  async function reenviar(origen: ChatCentro, texto: string, destinos: readonly ChatCentro[]): Promise<number> {
    const sale = armarReenvio(origen.titulo, texto);
    let ok = 0;
    for (const c of destinos.slice(0, TOPE_REENVIO)) {
      const d = destinoDeChat(c);
      if (!d.sesion || !envioDe(c).puede) { avisar(`${c.titulo}: ${textoDeEnvio(envioDe(c)) ?? 'no recibe ahora'}`, 'bad'); continue; }
      const r = await firma.mandar({ sesion: d.sesion, cuenta: d.cuenta, titulo: c.titulo, tope: topeDe(c) }, sale, 'solo_esto');
      if (!r.ok) { avisar(r.error, 'bad'); continue; }
      ok += 1;
      anotarEnviado({ id: r.id, destino: d.sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: r.creado, texto: sale, estado: 'escrito', motivo: null, cierre: null });
    }
    if (ok) avisar(ok === 1 ? 'Reenviado' : `Reenviado a ${ok} chats`, 'good');
    return ok;
  }

  // El estado de la PC, para el Uso (31/10/2026, Martín: «Si, ponlo pero en USO»): con lo mismo, sin pedirle nada a la PC.
  const estadoPc = useMemo(() => estadoDeLaPc(carteros, cola, ahora), [cola, carteros, ahora]);

  // ── Contestar una pregunta del chat (17/10/2026, el formulario de su conversación) ──────────────────────────────
  // Primero sale FIRMADA por mandar.ts (el único camino a la PC: la PC recibe lo firmado), y recién con ese trabajo en la
  // cola el servidor la marca contestada (acciones.ts → contestarPreguntaAction). Devuelve el error, o null.
  /** La línea de la tarjeta si el chat de esa pregunta está cerrado (se dice ANTES de firmar). null = la respuesta sale. */
  const avisoDePregunta = (c: ChatCentro, p: PreguntaChat): string | null =>
    preguntaDeChatCerrado(p.local, c.sesiones.find((s) => s.sesion === p.local)?.cuenta ?? c.cuenta, carteros, ahora);
  async function contestarPregunta(c: ChatCentro, p: PreguntaChat, elegidas: number[], otra: string): Promise<string | null> {
    const cuenta = c.sesiones.find((s) => s.sesion === p.local)?.cuenta ?? c.cuenta;
    const sale = comoSale({ sesion: p.local, cuenta, estado: c.estado }, carteros, claveFirma, ahora);
    if (!sale.puede) return textoDeEnvio(sale) ?? 'No puedo mandarla todavía.';
    const cerrado = avisoDePregunta(c, p);
    if (cerrado) return cerrado;
    const texto = textoDeRespuesta(p, elegidas, otra.trim() || null);
    const r = await firma.mandar({ sesion: p.local, cuenta, titulo: c.titulo }, texto, 'solo_esto');
    if (!r.ok) return r.error;
    anotarEnviado({ id: r.id, destino: p.local, destino_titulo: c.titulo, destino_cuenta: cuenta, created_at: r.creado, texto, estado: 'escrito', motivo: null, cierre: null });
    const m = await contestarPreguntaAction({ local: p.local, id: p.id, elegidas, otra, trabajo: r.id }).catch(() => null);
    // Ignorada en otro dispositivo (5/11/2026): su respuesta se canceló y no llega. Se dice, y no se la da por contestada.
    if (m && !m.ok && m.ignorada) return m.error;
    // Salió firmada aunque no se haya podido marcar: el chat la recibe igual. Se ve contestada acá, y el refresco trae la verdad.
    const contestada: PreguntaChat = m?.ok ? m.pregunta : { ...p, respuesta: { elegidas, otra: otra.trim() || null, at: new Date().toISOString(), trabajo: r.id } };
    setPreguntas((q) => ({ ...q, [c.clave]: (q[c.clave] ?? []).map((x) => (x.id === p.id ? contestada : x)) }));
    setAbiertas((a) => { const n = (a[p.local] ?? 0) - 1; const out = { ...a }; if (n > 0) out[p.local] = n; else delete out[p.local]; return out; });
    return null;
  }

  // ── Ignorar una pregunta o una decisión (5/11/2026, Martín: «un botón de ignorar») ────────────────────────────────────────
  // Se ve en el acto (sale del bloque y del globito) y se guarda en MaKo; si no se pudo, vuelve atrás y lo dice. No se le firma
  // nada al chat: es una marca de Martín. Devuelve el error, o null.
  async function ignorarPregunta(c: ChatCentro, p: PreguntaChat, ignorar: boolean): Promise<string | null> {
    const poner = (x: PreguntaChat) => setPreguntas((q) => ({ ...q, [c.clave]: (q[c.clave] ?? []).map((y) => (y.id === p.id ? x : y)) }));
    const contar = (d: number) => setAbiertas((a) => { const n = (a[p.local] ?? 0) + d; const out = { ...a }; if (n > 0) out[p.local] = n; else delete out[p.local]; return out; });
    const { ignorada: _i, ...sinMarca } = p;
    poner(ignorar ? { ...p, ignorada: new Date().toISOString() } : sinMarca);
    contar(ignorar ? -1 : 1);
    const r = await ignorarPreguntaAction({ local: p.local, id: p.id, ignorar }).catch(() => null);
    if (r?.ok) { poner(r.pregunta); return null; }
    poner(p);
    contar(ignorar ? 1 : -1);
    const error = r?.error ?? 'No pude guardarlo';
    avisar(error, 'bad');
    return error;
  }
  async function ignorarDecision(d: DecisionEspera, ignorar: boolean): Promise<string | null> {
    const poner = (ignoradaAt: string | null) => setDecisiones((ds) => ds.map((x) => (x.id === d.id ? { ...x, ignoradaAt } : x)));
    poner(ignorar ? new Date().toISOString() : null);
    const r = await ignorarDecisionAction({ id: d.id, ignorar }).catch(() => null);
    if (r?.ok) { poner(r.ignoradaAt); return null; }
    poner(d.ignoradaAt ?? null);
    const error = r?.error ?? 'No pude guardarlo';
    avisar(error, 'bad');
    return error;
  }

  // Los avisos dicen qué hacer, cortos (Martín, 15/10/2026: «Jamás pongas mensajes no claros»). Después de crear el
  // Token, el paso siguiente (pegárselo al Runner) ya lo dice la caja.
  const copiarConAviso = async (t: string, aviso: string) => {
    if (await copiar(t)) avisar(aviso, 'good'); else avisar(NO_PUDE_COPIAR, 'bad');
  };
  const crearClave = async () => {
    const c = await firma.crear();
    if (!c) { avisar('No pude crear tu Token', 'bad'); return; }
    avisar('Token creado', 'good');
  };
  const copiarClave = () => { if (firma.clave) void copiarConAviso(firma.clave.spki, 'Copiado: pégalo en el Runner'); };

  // ── El «⋯» de cada chat: Renombrar y Cambiar su muñeco ─────────────────────────────────────────
  const abrirMenu = (clave: string, x: number, y: number) => setMenu({ x, y, clave });
  const delMenu = menu ? chats.find((c) => c.clave === menu.clave) ?? null : null;
  const deRenombre = renombrando ? chats.find((c) => c.clave === renombrando.clave) ?? null : null;
  const deMuneco = eligiendo ? chats.find((c) => c.clave === eligiendo.clave) ?? null : null;
  const abrirMuneco = (c: ChatCentro) => setEligiendo({ clave: c.clave, aspecto: aspectoDe(c.titulo, elegidoPara(munecos, c.titulo)), guardando: false });
  const elegirEnMenu = (id: string) => {
    const c = delMenu;
    setMenu(null);
    if (!c) return;
    if (id === 'renombrar') setRenombrando({ clave: c.clave, texto: c.titulo, error: null, mandando: false });
    if (id === 'muneco') abrirMuneco(c);
  };
  // El nombre lo cambia cada sesión del chat (en todas sus cuentas): se le manda a cada una un trabajo firmado que se lo
  // pide (lib/centro-chats.ts → textoDeRenombre). La que está cerrada lo recibe cuando se abre.
  // Lo usan la ventana «Renombrar» de la fila y el título de la cabecera, que se renombra EN EL LUGAR (17/10/2026, Martín:
  // «tocar el título deja renombrarlo en el lugar»), en la computadora y en el teléfono. Devuelve el error, o null si salió.
  async function renombrarChat(c: ChatCentro, texto: string): Promise<string | null> {
    const v = nombreValido(texto);
    if (!v.ok) return v.error;
    if (v.nombre === c.titulo) return null;
    const sale = envioDe(c);
    if (!sale.puede) return textoDeEnvio(sale);
    let mal: string | null = null;
    for (const s of c.sesiones) {
      const r = await firma.mandar({ sesion: s.sesion, cuenta: s.cuenta, titulo: c.titulo }, textoDeRenombre(v.nombre), 'solo_esto');
      if (!r.ok) mal = r.error;
    }
    if (mal) return mal;
    // El muñeco elegido se guarda por nombre: viaja con el nombre nuevo, o el chat renombrado lo perdería.
    const suyo = elegidoPara(munecos, c.titulo);
    if (suyo) { const g = await guardarMunecoAction(v.nombre, suyo); if (g.ok) setMunecos(g.munecos); }
    avisar('Renombre enviado', 'good');
    refrescar();
    return null;
  }
  async function renombrar() {
    if (!renombrando || !deRenombre) return;
    setRenombrando({ ...renombrando, mandando: true, error: null });
    const mal = await renombrarChat(deRenombre, renombrando.texto);
    if (mal) { setRenombrando({ ...renombrando, mandando: false, error: mal }); return; }
    setRenombrando(null);
  }
  async function guardarElegido(aspecto: Aspecto | null) {
    if (!eligiendo || !deMuneco) return;
    setEligiendo({ ...eligiendo, guardando: true });
    const r = await guardarMunecoAction(deMuneco.titulo, aspecto);
    if (!r.ok) { setEligiendo({ ...eligiendo, guardando: false }); avisar(r.error, 'bad'); return; }
    setMunecos(r.munecos);
    setEligiendo(null);
    avisar('Criatura guardada', 'good');
  }

  return {
    chats, carteros, trabajos, porId, esperas: esperasConVigia, decisiones, decisionesOk, ahora, pushes, estado, munecos, setMunecos, tabs, indiceTabs, firma, pedidos,
    turnosDe, preguntasDe, tareasDe, contestarPregunta, ignorarPregunta, ignorarDecision, avisoDePregunta, estadoPc, mirar,
    marcasDe, marcar, citaDe, citar, reenviar, nombresCuentas, renombrarCuenta, leerCreditoApi, cambiarCreditoDelNegocio, pasosDe,
    lineasDe, previas, enCursos, yaSinVer, yaVistos, marcarYaVisto, avisos, pendientesTicketera, refrescar, responderAca, deshacerAca,
    envioDe, borradorDe, borradorDeLista, ponerBorrador, limpiarBorrador, enviando, mandar, mandarNota, anotarEnviado, copiarConAviso, crearClave, copiarClave,
    adjuntosDe, puedeAdjuntar, sumarAdjuntos, quitarAdjunto, vaciarAdjuntos, devolverAdjuntos, notaGrabada,
    /** Se pegó una imagen en un chat que todavía no recibe adjuntos. */
    sinAdjuntos: () => avisar('Este chat aún no recibe imágenes', 'bad'),
    /** «Pegar» del «+» sin nada que pegar (20/10/2026). */
    sinImagen: (puedeLeer: boolean) => avisar(puedeLeer ? 'No hay una imagen copiada' : 'Este navegador no deja pegar', 'bad'),
    puedeAbrirEn, adjuntaEnNuevo, apertura, abrirChat, mandarTextoA,
    cuentaElegida, elegirCuenta, cuentasDe, destinoDeChat, modelo, setModelo, esfuerzo, setEsfuerzo,
    menu, delMenu, abrirMenu, cerrarMenu: () => setMenu(null), elegirEnMenu,
    renombrando, setRenombrando, deRenombre, renombrar, renombrarChat,
    eligiendo, setEligiendo, deMuneco, abrirMuneco, guardarElegido,
  };
}

export type Centro = ReturnType<typeof useCentro>;

// Los «Completado» vistos, en este navegador (una comodidad: sin localStorage, ningún aviso queda pegado para siempre:
// `desde` es ahora y nada viejo avisa).
const CLAVE_VISTOS = 'ops-center:vistos';
function leerVistos(ahora: number): VistosDeChats {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE_VISTOS) ?? 'null') as Partial<VistosDeChats> | null;
    if (v && typeof v.desde === 'number' && v.chats && typeof v.chats === 'object') return { desde: v.desde, chats: v.chats };
  } catch { /* sin localStorage */ }
  const nuevo = { desde: ahora, chats: {} };
  guardarVistos(nuevo);
  return nuevo;
}
function guardarVistos(v: VistosDeChats) { try { window.localStorage.setItem(CLAVE_VISTOS, JSON.stringify(v)); } catch { /* es una comodidad */ } }

