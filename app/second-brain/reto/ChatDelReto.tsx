'use client';
// =============================================================================
// EL CHAT «RETO DE 7 DÍAS» DEL OPS CENTER (18/11/2026)
// =============================================================================
// Martín, 18/11: «el chat "Onboarding" queda sólo para el onboarding. Se abre OTRO chat, "Reto de 7 días", y ahí van los
// comunicados de cada día, el desplegable del reto y los videos tutoriales». Sólo para quien ve el onboarding V2
// (lib/onboarding-v2/revision.ts). Lo que es cada día vive en lib/reto/dias.ts; lo hecho, en /api/reto.
//
//   · Arriba, en la cabecera: el desplegable del reto (qué es, cuántos días van, los 7 con su estado en palabras y el de hoy abierto
//     con su video y su lista). «Mejora significativamente… que se entienda fácil».
//   · En el chat, cada día abierto: el mensaje de MaKo, su video (el del manifiesto, o su lugar marcado en la revisión), lo que te
//     toca (cada tarea dice DÓNDE: sin botones de atajo) y su prueba por WhatsApp, con la persona escribiendo primero.
//   · Lo que falta se marca con el motor de los tutoriales: la pantalla se oscurece y se señala dónde tocar (`senalarDondeTocar`).
// =============================================================================
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useBajarAlUltimo } from '@/app/_chat/useBajarAlUltimo';
import { MS_PAUSA_PIEZA, useColaDeSalida, type FilaDeCola } from '@/app/_chat/useColaDeSalida';
import { LlegadaAlReto } from '@/app/second-brain/LlegadaAlReto';
import { useRecorrido } from '@/app/_ui/Recorrido';
import { ID_RECORRIDO } from '@/lib/onboarding-v2/llegada';
import { intercalar } from './hilo-por-hora';
import { useChatCliente } from '../useChatCliente';
import { CajaDelCliente, HiloDelCliente } from '../PiezasCliente';
import { ORIGEN_RETO, TAB_RETO, type ElegidoChat } from '@/lib/chat-mako-reglas';
import type { Desde } from '@/lib/chat-desde';
import { tutorialDe } from '@/lib/tutoriales';
import { BotonTutoriales, CatalogoTutoriales, CSS_CATALOGO } from './CatalogoTutoriales';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_APP_MAKO } from '@/lib/centro-munecos';
import { linkWaMe } from '@/lib/verificacion-entrante';
import { PARA_TODOS } from '@/lib/onboarding-v2/revision';
import {
  HORAS_WA, RETO_HOLA, RETO_SUB, RETO_TITULO, mensajeEscrito, tareaHecha,
  type DiaReto, type EstadoDia, type EstadoReto, type MarcaReto, type TareaReto,
} from '@/lib/reto/dias';
import { mostrarTutorial, reproducirFlotante, senalAhora, senalarDondeTocar, useEsRevision, useSenal } from '@/app/_ui/tutorial/store';
import { verEnSuMensaje } from '@/app/_ui/tutorial/VideosDelChat';
import { BarraFijados } from '@/app/admin/operaciones/MensajeWA';
import { Icon } from '@/app/_components/icons';
import { FAMILIAS, itemsDe } from '@/app/_components/nav';
import { anotarTutorialVisto, mostrarEnSuPestana } from './enSuPestana';
import { RETO_D2_RECORDATORIO, dejaParaDespues } from '@/lib/reto/dias';
import { useManifiestoListo, useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { cerrarDalePlay, dalePlayCerrado, tituloDalePlay } from '@/app/_ui/tutorial/entrada';
// V5 (20/11): la entrada de cada día (el velo y MaKo escribiendo) y el «dale play», las piezas del chat del onboarding (no otras).
import { EntradaEscribiendo, useEntrada } from '@/app/_ui/tutorial/EntradaEscribiendo';
import { CSS_REPRODUCTOR, VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useDalePlay } from '@/app/_ui/tutorial/useDalePlay';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { guardarRetoDelEnsayo, retoDelEnsayo, useEnsayo, vistoEnEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { claveTarea, diaAbierto, diasDelReto, estadoDeLosDias, tutorialDelDia } from '@/lib/reto/dias';
import { RETO_EMPEZAR_DIA1, RETO_INTERES_YA, RETO_MUESTRA, RETO_MUESTRA_FIN, muestrasDe, type MuestraReto } from '@/lib/reto/dias';
import { DIAS_RETO, RETO_D2_EXT, RETO_D2_PERFIL, RETO_MANANA, RETO_PILOTO, cuandoSeAbrio, proximaApertura, diaTerminado, finDelDia, marcasDeLaTarea, rotuloDelDia, tareaDespues } from '@/lib/reto/dias';
import { NOTA_PRO_UNA_VEZ, TAREA_PRO } from '@/lib/reto/pro-del-reto';
import { Burbuja, DeLaPersona } from './Burbuja';
import { SeguirEnPc } from '@/app/onboarding/SeguirEnPc';
import { esTelefono } from '@/lib/telefono';
import { ClipDelReto } from './ClipDelReto';
import { RETO_EN_TU_PLAN } from '@/lib/reto/plan-reglas';
import { TarjetaIntegraciones, TarjetaQrApp, type IntegracionConEstado } from './TarjetasDia2';
import { RETO_D2_HORA } from '@/lib/reto/dias';
import { diaDelPaso, idEnElDia, pasosEnElDia, type QueEnElDia } from '@/lib/reto/en-el-dia';


type DatosReto = { ve: boolean; estado: EstadoReto | null; abierto: number; dias: EstadoDia[]; hechos: number; linea: string | null;
  /** El funnel que eligió en Funnel Coach: arma los días 4 a 6 (`diasDelReto`, 20/11). */
  funnel?: string | null;
  /** Con el día 2 abierto (d24-05 y d24-06): las integraciones de lo que eligió, con su estado, y el QR de la app mientras no esté. */
  integraciones?: IntegracionConEstado[];
  qrApp?: string | null;
  /** Lo que eligió en «¿Qué te gustaría que MaKo resuelva primero?» (D1-02). */
  intereses?: string[];
  /** Una prueba de MaKo Essential: lo de Pro de los días 4 a 6 se usa una vez (R57-03). */
  proUnaVez?: boolean };

/** Lo del ensayo «desde cero» (app/_ui/tutorial/desde-cero.ts): el mismo cálculo que /api/reto, con el estado en el navegador. */
function datosDelEnsayo(base: DatosReto | null, e: EstadoReto | null): DatosReto {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  return { ve: true, linea: base?.linea ?? null, estado: e, abierto, dias, hechos };
}
function hacerEnEnsayo(e: EstadoReto | null, c: { accion?: unknown; dia?: unknown; id?: unknown; hora?: unknown }): EstadoReto | null {
  const ahora = Date.now();
  if (c.accion === 'empezar') return e ?? { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {} };
  if (!e) return e;
  if (c.accion === 'adelantar' && Number(c.dia) === diaAbierto(e, ahora) + 1) return { ...e, adelantado: Number(c.dia), adelantadoEn: new Date(ahora).toISOString() };
  if (c.accion === 'hecha') return { ...e, hechas: { ...e.hechas, [claveTarea(Number(c.dia), String(c.id))]: new Date(ahora).toISOString() } };
  if (c.accion === 'hora' && (HORAS_WA as readonly string[]).includes(String(c.hora))) return { ...e, horaWa: String(c.hora) };
  if (c.accion === 'despues') return { ...e, despues: [...new Set([...(e.despues ?? []), claveTarea(Number(c.dia), String(c.id))])] };
  if (c.accion === 'manana') return { ...e, manana: Number(c.dia) };
  if (c.accion === 'dia1') return { ...e, dia1Desde: e.dia1Desde ?? new Date(ahora).toISOString() };
  if (c.accion === 'muestra') return { ...e, muestras: [...new Set([...(e.muestras ?? []), String((c as { pestana?: unknown }).pestana ?? '')])] };
  return e;
}

/** El reto del negocio, de /api/reto (en el ensayo «desde cero», del navegador: no se escribe nada). */
export function useReto(activo = true) {
  const ensayo = useEnsayo();
  const [d, setD] = useState<DatosReto | null>(null);
  const leer = useCallback(async () => {
    const r = await fetch('/api/reto', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) return;
    setD(ensayo.activo && r.ve ? datosDelEnsayo(r as DatosReto, retoDelEnsayo()) : (r as DatosReto));
  }, [ensayo.activo]);
  useEffect(() => { if (activo) void leer(); }, [activo, leer]);
  const hacer = useCallback(async (cuerpo: Record<string, unknown>) => {
    if (ensayo.activo) {
      const e = hacerEnEnsayo(retoDelEnsayo(), cuerpo);
      guardarRetoDelEnsayo(e);
      setD((prev) => datosDelEnsayo(prev, e));
      return { ok: true };
    }
    const r = await fetch('/api/reto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).then((x) => x.json()).catch(() => null);
    if (r && r.ok) setD(r as DatosReto);
    return r;
  }, [ensayo.activo]);
  return { d, leer, hacer };
}

// LO VISTO EN ESTE NAVEGADOR, POR DÍA (verificación del 20/11, d24-11 y V5): la entrada de un día (el velo con MaKo escribiendo) sale
// la PRIMERA vez que se ve, no en cada carga de la página; y el «dale play» del video, mientras ese video no se vio.
const VISTO = 'mako.reto.visto.';
// DE QUÉ RETO ES LO VISTO (20/11, ~13:00, Martín probando en Lalaland como administrador): las claves eran del NAVEGADOR, no del
// reto. Lo que vio en otro negocio (o en un reto de antes) salía de una, sin sus puntitos: el saludo, «Me dijiste que…» y la pregunta
// llegaban juntos, y el día sin su entrada. Ahora llevan el inicio del reto (uno por negocio y por reto; el ensayo «desde cero» tiene
// el suyo). Lo fija el chat del reto al dibujarse, antes que sus mensajes (`fijarAmbitoDelReto`).
let ambito = '';
export function fijarAmbitoDelReto(inicio: string | null | undefined): void { ambito = inicio ? `${inicio}|` : ''; }
/** Una clave de este reto (la entrada del día y su «dale play» en el motor, app/_ui/tutorial/entrada.ts). */
export const delReto = (k: string): string => `${k}@${ambito}`;
export const yaVisto = (k: string) => { try { return !!localStorage.getItem(VISTO + ambito + k); } catch { return false; } };
export const anotarVisto = (k: string) => { try { localStorage.setItem(VISTO + ambito + k, new Date().toISOString()); } catch { /* sin storage */ } };

/** El ícono de la pestaña de una tarea (R57-15; la maqueta, `mq-cx__ico`): el de su fila en la barra; lo de Settings, la tuerca. */
export function iconoDeTarea(t: TareaReto): string | null {
  const ruta = /a\[href\^="([^"]+)"\]/.exec(t.marcas.find((m) => m.sel.startsWith('aside[data-sidebar] '))?.sel ?? '')?.[1];
  if (ruta) for (const fa of FAMILIAS) { const it = itemsDe(fa).find((x) => x.href === ruta); if (it) return it.icon; }
  if (/Settings/.test(t.donde)) return 'tuerca';
  if (t.id === 'clip') return 'videogen';
  return null;
}

/** El lugar del video de un día en su mensaje (VideoDelDia): ahí lo dibuja el motor mientras se ve (V4). */
export const lugarDelDia = (dia: DiaReto): string => `[data-video-lugar="${dia.video}"]`;

/**
 * Ver el video de un día. Con marcas (los días 2 a 7), EN SU MENSAJE con las marcas del motor encima (20/11, la segunda verificación
 * de V4 y R57-21; decidido por el Cerebro: «sin excepción»): el motor lo dibuja sobre el lugar del mensaje mientras se ve, y en la
 * esquina sólo al scrollear o navegar (app/_ui/tutorial/lugarDelVideo.ts). Antes un botón lo mandaba directo al video chico de 300 px.
 * Sin marcas (el día 1), en su mensaje si está en el chat o, si no, en la esquina (D1-08).
 */
export function verVideoDelDia(dia: DiaReto, conMarcas: boolean, titulo: string, o: { alTocar?: (sel: string) => void; alTerminar?: () => void } = {}): void {
  anotarVisto(`video:${dia.n}`);
  cerrarDalePlay(conMarcas ? delReto(dia.video) : dia.video);
  if (conMarcas) {
    document.querySelector(lugarDelDia(dia))?.scrollIntoView({ block: 'center' });
    mostrarTutorial(tutorialDelDia(dia), { video: dia.video, directo: true, lugar: lugarDelDia(dia), ...(o.alTocar ? { alTocar: o.alTocar } : {}), alTerminar: () => o.alTerminar?.() });
    return;
  }
  if (!verEnSuMensaje(dia.video)) reproducirFlotante(dia.video, titulo, 0);
}

/** Marca uno por uno los lugares de una tarea (la barra, el menú de la foto, la sección) y la da por hecha al tocar el último. */
export function marcarTarea(marcas: readonly MarcaReto[], alTerminar: () => void, alDejar?: () => void): void {
  const [m, ...resto] = marcas;
  if (!m) { alTerminar(); return; }
  senalarDondeTocar({ sel: m.sel, titulo: m.titulo, texto: m.texto, haz: m.haz, lado: m.lado },
    () => (resto.length ? window.setTimeout(() => marcarTarea(resto, alTerminar, alDejar), 350) : alTerminar()),
    { alOmitir: alDejar, libre: m.libre, ...(m.listo ? { listo: m.listo } : {}), ...(m.pasar ? { pasar: true } : {}) });
}

// LO VISTO DE CADA MENSAJE DEL RETO (20/11, D1-10 y d24-11; con el ámbito de ESTE reto): lo que ya salió en este navegador sale de una
// la próxima vez (la cola de salida lo recibe como historial). Las claves, con el inicio del reto delante.
const VISTOS = 'mako.reto.vistos';
const leerVistos = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(VISTOS) ?? '[]') as string[]); } catch { return new Set(); } };
const anotarVistoEnCola = (k: string): void => {
  try { const v = leerVistos(); if (v.has(k)) return; v.add(k); localStorage.setItem(VISTOS, JSON.stringify([...v].slice(-300))); } catch { /* sin storage: igual se ve */ }
};

const YA_MARCADA = 'mako.reto.marcada.';
/** La marca de Plan del final del día 3 (d24-22): sin clic, con «Entendido». */
const MARCA_PLAN: MarcaReto = { sel: 'aside[data-sidebar] a[href^="/plan"]', titulo: 'Tu Plan', texto: 'Tu reto está aquí, como proyecto: cada día se cierra solo.', haz: 'Entendido', lado: 'derecha', listo: 'Entendido' };
/** Cada cuánto relee el chat mientras espera la app del QR del día 2. */
const CADA_MS_QR = 10_000;
/** La tarjeta de Video plegada (app/_crear/PantallaCrear.tsx, `clavePlegada('Video')`). */
export const PLEGADA_VIDEO = 'mk-crear-plegada:Video';
/** La tarea del perfil del día 2 (la misma en todo funnel) y cuánto espera después de su mensaje para marcarla sola (OD-11). */
const TAREA_PERFIL = DIAS_RETO.find((x) => x.n === 2)?.tareas.find((t) => t.id === 'perfil');
const MS_ANTES_DEL_PERFIL = 1200;
const sinSuscribir = () => () => {};

/** El reto en un teléfono (R57-F5): «Sigamos en tu computadora», el MISMO componente del onboarding, con su correo si se sabe. */
function RetoEnElTelefono({ nombre }: { nombre: string }) {
  const [email, setEmail] = useState('');
  useEffect(() => {
    let vivo = true;
    void fetch('/api/auth/me', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { email?: unknown } | null) => { if (vivo && typeof j?.email === 'string') setEmail(j.email); });
    return () => { vivo = false; };
  }, []);
  return <SeguirEnPc nombre={(nombre ?? '').trim().split(/\s+/)[0] ?? ''} email={email} para="reto" maqueta />;
}
// Exportadas para el paso de Offer Coach a Funnel Coach (./usePasoAlFunnel.ts): la misma tarea se marca una vez por visita, la
// marque este chat o el Offer Coach.
export const yaMarcada = (k: string) => { try { return !!sessionStorage.getItem(YA_MARCADA + k); } catch { return false; } };
export const anotarMarcada = (k: string) => { try { sessionStorage.setItem(YA_MARCADA + k, '1'); } catch { /* sin storage */ } };

export function ChatDelReto({ nombre, onVolver }: { nombre: string; onVolver: () => void }) {
  const { d, leer, hacer } = useReto();
  const ensayo = useEnsayo();
  const hilo = useRef<HTMLDivElement>(null);
  // La hora se guarda cuando ella manda el WhatsApp (lib/reto/respuestas.ts): al volver de WhatsApp, se relee para mostrar la confirmación.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void leer(); };
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.removeEventListener('focus', alVolver); document.removeEventListener('visibilitychange', alVolver); };
  }, [leer]);
  const [menu, setMenu] = useState(false);
  // LA CAJA DEL RETO (20/11, auditoría D1-09 y R57-13; decisión del Cerebro): le escribe al MaKo del Ops Center con el contexto del
  // reto (app/api/mako/chat/route.ts → `contextoDelChat`, lib/reto/contexto.ts), con adjuntos y voz como toda caja (CajaDelCliente,
  // lib/cajas-de-chat.ts). La charla va en SU conversación (TAB_RETO), debajo de los mensajes del reto.
  const campo = useRef<HTMLTextAreaElement>(null);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${TAB_RETO}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: { id: number } | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, []);
  // «Escribe a Reto de 7 días» (d24-17), como todo chat: la caja lleva el nombre del chat.
  const quienMako = useMemo(() => ({ nombre: RETO_TITULO, aspecto: ASPECTO_APP_MAKO }), []);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja: campo, desde: DESDE_RETO, tab: TAB_RETO, quien: quienMako, offerDirecto: false });
  // El catálogo «Tutoriales de MaKo» (V1, D1-07): el ícono de videos cambia los mensajes por todos los videos, con «Volver al chat».
  const [catalogo, setCatalogo] = useState(false);
  const [hora, setHora] = useState<string | null>(null);

  // Al abrirlo por primera vez, el reto empieza (el día 1, ahora).
  const empezo = useRef(false);
  useEffect(() => {
    if (!d || !d.ve || d.estado || empezo.current) return;
    empezo.current = true;
    // La zona del navegador (R57-20): cada día se abre a su hora en SU zona.
    void hacer({ accion: 'empezar', zona: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })() });
  }, [d, hacer]);

  // Lo que falta, marcado DESPUÉS del video del día (20/11, auditoría D1-03, d24-09 y R57-12): antes, a los 0,9 s de abrir el chat
  // se oscurecía la pantalla y se marcaba la próxima tarea, tapando el mensaje y el video. Lo acordado: cada día empieza con su
  // video; mientras corre, el video marca dónde tocar; recién al terminar (o al cerrarlo) se marca lo que quedó, una vez por visita.
  // Tocar lo marcado sólo LLEVA al lugar: la tarea queda hecha cuando MaKo lee que se hizo (/api/reto, lib/reto/senales.ts).
  const e = d?.estado ?? null;
  fijarAmbitoDelReto(e?.inicio);
  // Corre las marcas de una tarea. «Lo hago después» la deja guardada y SIGUE con la próxima del día (R57-F1, la maqueta: «sigue con la
  // próxima»); un «Entendido» que deja el paso para después (`despues`: las integraciones, la extensión, la foto) también (d24-05).
  const correr = useCallback((t: TareaReto, n: number, seguir?: () => void) => {
    const dejar = () => { void hacer({ accion: 'despues', dia: n, id: t.id }).then(() => seguir?.()); };
    // El personaje (R57-18): con el chat de Video plegado, su «←» queda en una sección escondida y la marca esperaría para siempre.
    // Se despliega antes, como `desplegarCrear('Video')` (app/_crear/PantallaCrear.tsx, misma clave), sin traer ese componente acá.
    if (t.id === 'personaje') { try { localStorage.setItem(PLEGADA_VIDEO, 'no'); } catch { /* sin storage: no se plegó */ } }
    // El día 1 sin «Lo hago después» (auditoría F1: la maqueta no lo tiene); los demás días sí.
    marcarTarea(marcasDeLaTarea(t), dejaParaDespues(t) ? dejar : () => { void leer(); }, n === 1 ? undefined : dejar);
  }, [leer, hacer]);
  const marcarLoQueFalta = useCallback(function marcar(dia: DiaReto, saltar: readonly string[] = [], siempre = false) {
    if (!e || senalAhora()) return;
    // Lo dejado para después no se vuelve a marcar en la misma visita: sigue la próxima (`saltar` lleva lo que se dejó recién).
    // El perfil del día 2 espera la hora (verificación OD-11; la maqueta): la cadena terminaba las integraciones y seguía con el perfil
    // con la tarjeta de la hora pendiente y sin el mensaje del perfil. Arranca solo después de RETO_D2_PERFIL (`perfil2`, abajo).
    const esperaLaHora = (x: TareaReto) => dia.n === 2 && x.id === 'perfil' && !e.horaWa && !tareaDespues(e, 2, 'hora');
    const t = dia.tareas.find((x) => !tareaHecha(e, dia.n, x.id) && !tareaDespues(e, dia.n, x.id) && !saltar.includes(x.id) && !esperaLaHora(x));
    // `siempre`: al terminar el video, aunque ya se haya marcado en esta pestaña (la llamada con Leila: «cada vez»).
    if (!t || (!siempre && yaMarcada(`${dia.n}:${t.id}`))) return;
    // Sólo con su primer lugar en la pantalla (D1-03): el video del día 1 que termina en la esquina con la persona en otra pestaña no
    // deja una marca esperando algo que no está (y el motor ocupado). Al volver al reto, la marca `tocaHoy` (abajo).
    const primera = marcasDeLaTarea(t)[0];
    if (primera && !document.querySelector(primera.sel)) return;
    anotarMarcada(`${dia.n}:${t.id}`);
    correr(t, dia.n, () => window.setTimeout(() => marcar(dia, [...saltar, t.id]), 400));
  }, [e, correr]);
  // AL TERMINAR EL VIDEO DEL DÍA, SIEMPRE SE MARCA LO QUE FALTA (20/11, la llamada con Leila: «Acá debería marcarme que tengo que
  // irme al chat de Hormozi»). El video avisa que terminó con su propia señal todavía puesta, y `marcar` cortaba con el motor
  // ocupado: no se marcaba nada. Y en la misma pestaña tampoco (`yaMarcada`, en sessionStorage). Ahora el fin queda anotado y
  // corre apenas el motor se libera (`useSenal`), cada vez que termina el video.
  const senal = useSenal();
  const [finDelVideo, setFinDelVideo] = useState<DiaReto | null>(null);
  useEffect(() => {
    if (!finDelVideo || senal) return;
    setFinDelVideo(null);
    marcarLoQueFalta(finDelVideo, [], true);
  }, [finDelVideo, senal, marcarLoQueFalta]);


  // Los días 4 a 6, armados para su funnel (20/11, auditoría d24-14 y R57-01).
  const abiertos = d && e ? diasDelReto(d.funnel, d.integraciones).filter((x) => x.n <= d.abierto) : [];
  // El QR del día 2 dice «Sigo solo cuando estén» (d24-06): mientras está, relee cada 10 s con la pestaña a la vista.
  const esperaLaApp = !!d?.qrApp && !!e && !tareaHecha(e, 2, 'app') && !tareaDespues(e, 2, 'app');
  useEffect(() => {
    if (!esperaLaApp) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void leer(); }, CADA_MS_QR);
    return () => window.clearInterval(t);
  }, [esperaLaApp, leer]);
  // «¿Qué hacemos ahora?» (20/11, D1-02 y V3): lo que eligió en el onboarding, con su «Muéstrame…», antes del día 1. Un reto que ya
  // venía andando (con algo hecho o pasado el día 1) no vuelve a preguntar.
  const muestras = muestrasDe(d?.intereses);
  const vistas = muestras.filter((m) => e?.muestras?.includes(m.pestana));
  const quedan = muestras.filter((m) => !e?.muestras?.includes(m.pestana));
  // Sin nada elegido, la pregunta igual (verificación OD-06; la maqueta la hace con sólo «Empezar mi día 1»): nunca el día 1 de golpe.
  const empezo1 = !!d && !!e && (!!e.dia1Desde || d.abierto > 1 || Object.keys(e.hechas).length > 0);
  // EL FIN DEL DÍA (20/11, D1-06, d24-13, R57-07): recién cuando el día abierto terminó (todo hecho o dejado para después), su
  // cierre (FIN_DIA) y, en el recuadro de opciones, «¿Adelantas el día N?». «Mañana» queda guardado y su respuesta, en el chat.
  const actual = abiertos[abiertos.length - 1];
  const siguiente = actual ? diasDelReto(d?.funnel, d?.integraciones).find((x) => x.n === actual.n + 1) : undefined;
  const termino = !!e && !!actual && empezo1 && diaTerminado(e, actual);
  // El día 7 cierra el reto (R57-08): nombra TODO lo que quedó sin hacer, de cualquier día.
  const falta = !e || !actual ? [] : actual.n === 7
    ? abiertos.flatMap((x) => x.tareas.filter((t) => !tareaHecha(e, x.n, t.id)).map((t) => t.id))
    : actual.tareas.filter((t) => !tareaHecha(e, actual.n, t.id) && tareaDespues(e, actual.n, t.id)).map((t) => t.id);
  const cierre = termino && actual?.n === 7;
  // El día 3 termina contando que el reto está en el Plan, y marca Plan en la barra (d24-22; la maqueta, EN_TU_PLAN). Sólo con el
  // proyecto creado (`enElPlan`): si no, sería mentira.
  const enElPlan3 = termino && actual?.n === 3 && !!e?.enElPlan;
  const eligioManana = !!e && !!siguiente && e.manana === siguiente.n;
  const pregunta = termino && !!siguiente && !eligioManana;
  // «Empezar mi día 1» (D1-03 y D1-15, verificación del 20/11): llega el día 1 con su entrada, su mensaje y su video, y la marca de
  // Offer Coach sale recién AL TERMINAR el video (onFinVideo → marcarLoQueFalta). Antes salía a los 600 ms, debajo de la entrada, y
  // su velo tapaba el mensaje y el video del día 1.
  const empezarDia1 = () => { void hacer({ accion: 'dia1' }); };
  // «Muéstrame {pestaña}» (D1-02 y V3, verificación del 20/11): MaKo manda «Te muestro dónde…» con el video de la pestaña; al darle
  // play, la barra marca la pestaña y, al entrar, su video corre AHÍ con sus marcas (./enSuPestana.ts). Recién al terminarlo queda
  // vista (y en el chat, «Listo: ya sabes dónde…» y otra vez «¿Seguimos?»): antes salía a los 2,4 s, con el video corriendo.
  const [enCurso, setEnCurso] = useState<MuestraReto | null>(null);
  const muestraPendiente = enCurso && !vistas.some((m) => m.pestana === enCurso.pestana) ? enCurso : null;
  // LA ENTRADA (memoria, onboarding-16-11-decisiones, «20/11, ~13:00»): lo primero del chat es la LLEGADA, con el video del recorrido
  // general (LlegadaAlReto, la pieza del chat del onboarding). Recién cuando ese video termina o se omite (el recorrido visto) sale lo
  // del reto: el saludo, «Me dijiste que…» y la pregunta, de a uno y con sus puntitos.
  const recorrido = useRecorrido(ID_RECORRIDO, { autoabrir: false });
  const recorridoVisto = ensayo.activo ? vistoEnEnsayo(ID_RECORRIDO) : recorrido.visto === true;
  const [llegadaMostrada, setLlegadaMostrada] = useState(false);
  const puerta = llegadaMostrada && recorridoVisto;
  // LA COLA DE SALIDA (auditoría de chats del 20/11, reto-3, reto-4 y reto-8; app/_chat/useColaDeSalida.ts): cada mensaje del reto
  // sale de a uno, con puntitos que duran según su largo (`msEscribiendo`), y lo que trae (el recuadro, la tarjeta del audio) sale
  // después del texto, con su pausa. Antes useAparicion escalonaba sólo sus globos, con 1,2 s fijos: el recuadro salía con el mensaje y
  // la muestra pedida, de golpe. Un día entra con su propia entrada (el velo y MaKo escribiendo: `Dia`); la persona, ya.
  const faltaDe = (x: DiaReto): string[] => !e ? [] : x.n === 7
    ? abiertos.flatMap((y) => y.tareas.filter((t) => !tareaHecha(e, y.n, t.id)).map((t) => t.id))
    : x.tareas.filter((t) => !tareaHecha(e, x.n, t.id) && tareaDespues(e, x.n, t.id)).map((t) => t.id);
  const todosLosDias = diasDelReto(d?.funnel, d?.integraciones);
  const hora0 = e?.horaWa ?? '9:00';
  const filas: FilaDeCola[] = !d || !e ? [] : [
    { id: 'hola', de: 'mako', texto: RETO_HOLA(nombre) },
    ...(muestras.length ? [{ id: 'interes', de: 'mako', texto: RETO_INTERES_YA(muestras) }] : []),
    ...vistas.flatMap((m) => [{ id: `muestra:${m.pestana}`, de: 'mako', texto: RETO_MUESTRA(m) }, { id: `muestrafin:${m.pestana}`, de: 'mako', texto: RETO_MUESTRA_FIN(m) }]),
    // La que pidió recién, con su clave desde el clic (reto-4): al quedar vista no vuelve a salir.
    ...(muestraPendiente ? [{ id: `muestra:${muestraPendiente.pestana}`, de: 'mako', texto: RETO_MUESTRA(muestraPendiente) }] : []),
    ...(!empezo1 && !muestraPendiente ? [{ id: `pregunta:${vistas.length}`, de: 'mako', texto: vistas.length ? '¿Seguimos?' : '¿Qué hacemos ahora?' }] : []),
    ...(!empezo1 ? [] : abiertos.flatMap((x): FilaDeCola[] => {
      const sig = todosLosDias.find((y) => y.n === x.n + 1);
      const fin: FilaDeCola[] = !diaTerminado(e, x) ? [] : [
        { id: `fin:${x.n}`, de: 'mako', texto: finDelDia(x, sig, hora0, nombre, faltaDe(x)) },
        ...(x.n === 3 && e.enElPlan ? [{ id: 'plan', de: 'mako', texto: RETO_EN_TU_PLAN }] : []),
        ...(x.n === 7 ? [{ id: 'piloto', de: 'mako', texto: RETO_PILOTO(d.funnel), pieza: !!x.whatsapp }] : []),
        ...(sig && e.manana === sig.n ? [{ id: `yo-manana:${sig.n}`, de: 'yo', texto: 'Mañana' }, { id: `manana:${sig.n}`, de: 'mako', texto: RETO_MANANA(hora0, sig.n) }] : []),
      ];
      // LO DE ADENTRO DEL DÍA, POR LA COLA (20/11, el Cerebro; lib/reto/en-el-dia.ts): la extensión, las integraciones, la hora, el
      // perfil, la prueba por WhatsApp, «¡Hiciste todo…!» y el clip del día 6, cada uno con sus puntitos y su tarjeta después del
      // texto. Antes entraban de golpe apenas /api/reto daba una tarea por hecha.
      const enDia = pasosEnElDia(x, e, { hoy: x.n === d.abierto, integraciones: d.integraciones ?? [] })
        .map((p): FilaDeCola => ({ id: p.id, de: 'mako', texto: p.texto, pieza: p.pieza }));
      return [{ id: `dia:${x.n}`, de: 'dia', texto: '' }, ...enDia, ...fin];
    })),
    ...(pregunta && siguiente ? [{ id: `adelantar:${siguiente.n}`, de: 'mako', texto: `¿Adelantas el día ${siguiente.n}?` }] : []),
  ];
  // Lo ya visto de ESTE reto sale de una: apenas llega el reto, la cola lo recibe (`mostrarYa`); hasta ahí, nada sale. También lo de
  // los días anteriores al de hoy (sus cierres no tenían clave antes de reto-6: no se vuelven a escribir).
  const amb = e?.inicio ? `${e.inicio}|` : '';
  const [historia, setHistoria] = useState<string | null>(null);
  // Lo de adentro de un día espera a que el día mostró su mensaje y su tarjeta (`Dia` avisa con `onListo`): sus puntitos empiezan ahí,
  // no mientras corre la entrada del día.
  const [diasListos, setDiasListos] = useState<ReadonlySet<number>>(() => new Set());
  const diaListo = useCallback((n: number) => setDiasListos((s) => (s.has(n) ? s : new Set([...s, n]))), []);
  const esperaSuDia = (id: string) => { const n = diaDelPaso(id); return n != null && !diasListos.has(n); };
  const cola = useColaDeSalida(filas, {
    historial: () => [],
    retenido: (id) => historia !== amb || !amb || !puerta || esperaSuDia(id),
    alMostrar: (id) => { if (amb) anotarVistoEnCola(amb + id); },
  });
  const mostrarYa = cola.mostrarYa;
  // Lo de los días anteriores al de hoy ya se vio: sale de una al cargar (sus cierres no tenían clave antes de reto-6) y también si
  // aparece después (una tarea de un día pasado que se termina hoy no escribe en el medio del hilo, tapando lo de hoy).
  const hoyN = abiertos[abiertos.length - 1]?.n ?? 1;
  const deAntes = (id: string) => { const m = /^(?:dia|fin):(\d)$/.exec(id); const enN = diaDelPaso(id); return id === 'plan' ? hoyN > 3 : m ? Number(m[1]) < hoyN : enN != null ? enN < hoyN : /^(?:yo-)?manana:(\d)$/.test(id) && Number(id.slice(-1)) <= hoyN; };
  useEffect(() => {
    if (!amb || historia === amb || !d || !e) return;
    const vistos = leerVistos();
    mostrarYa(filas.filter((x) => vistos.has(amb + x.id) || deAntes(x.id)).map((x) => x.id));
    setHistoria(amb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amb, !!d]);
  const visibles = new Set(cola.visibles.map((x) => x.id));
  const ver = (id: string) => visibles.has(id);
  const listo = historia === amb && !!amb;
  const atrasados = listo ? filas.filter((x) => deAntes(x.id) && !ver(x.id)).map((x) => x.id).join('|') : '';
  useEffect(() => { if (atrasados) mostrarYa(atrasados.split('|')); }, [atrasados, mostrarYa]);
  const vePlan = enElPlan3 && ver('plan');
  useEffect(() => {
    if (!vePlan || yaMarcada('plan-dia-3') || senalAhora()) return;
    anotarMarcada('plan-dia-3');
    const t = window.setTimeout(() => marcarTarea([MARCA_PLAN], () => {}), 600);
    return () => window.clearTimeout(t);
  }, [vePlan]);
  const verMuestra = (m: MuestraReto) => {
    const t = tutorialDe(m.pestana);
    const vista = () => { void hacer({ accion: 'muestra', pestana: m.pestana }); };
    if (t && mostrarEnSuPestana(t, { texto: `Aquí ${m.hacer}.`, alTerminar: vista })) return;
    // Sin la pestaña en la barra (una pantalla angosta): el video ahí mismo, como antes.
    if (t) { anotarTutorialVisto(t); mostrarTutorial(t, { video: m.pestana, directo: true, alTerminar: vista }); } else vista();
  };
  // SIN «TU SIGUIENTE PASO» ARRIBA DE LA CAJA (20/11, la llamada con Leila, 00:29:00; decidido por el Cerebro con las palabras de
  // Martín: «Acá debería marcarme que tengo que irme al chat de Hormozi, no ponerme acá abajo Tu siguiente paso»). Lo que sigue lo
  // marca la barra: al terminar el video del día (`finDelVideo`, arriba) y cada paso que aparece (`tocaHoy`, abajo).
  // CADA PASO QUE APARECE, CON SU MARCA (auditoría de chats, reto-9; la maqueta marca sola cada tarea que sigue, cuerpo.html
  // :2031-2093). Antes se marcaba sólo la primera, después del video; hecha ésa, la que seguía había que ir a tocarla. Ahora, la que
  // toca HOY se marca sola una vez por visita, con el motor libre, recién después del video del día (D1-03) y con su fila ya en el hilo.
  // También el perfil del día 2 después de la hora (OD-11) y Offer Coach del día 1 si el video ya se vio y recarga (reto-5, c).
  const tocaHoy = (() => {
    if (!e || !actual || !empezo1 || termino) return null;
    const esperaLaHora = (x: TareaReto) => actual.n === 2 && x.id === 'perfil' && !e.horaWa && !tareaDespues(e, 2, 'hora');
    return actual.tareas.find((x) => !x.siempre && !tareaHecha(e, actual.n, x.id) && !tareaDespues(e, actual.n, x.id) && !esperaLaHora(x)) ?? null;
  })();
  const claveToca = tocaHoy && actual ? `${actual.n}:${tocaHoy.id}` : '';
  // La tarjeta de un paso del día sale por la cola, después de sus puntitos y su texto: la marca la espera (se vuelve a mirar cuando sale).
  const enDiaVisto = filas.filter((x) => diaDelPaso(x.id) != null && ver(x.id)).map((x) => `${x.id}${cola.conPieza(x.id) ? '+' : ''}`).join('|');
  useEffect(() => {
    const t = tocaHoy, n = actual?.n;
    if (!t || !n || yaMarcada(claveToca) || !yaVisto(`video:${n}`)) return;
    const id = window.setTimeout(() => {
      if (senalAhora() || yaMarcada(claveToca)) return;
      if (n > 1 && !document.querySelector(`[data-tarea="${claveToca}"]`)) return;
      const primera = marcasDeLaTarea(t)[0];
      if (primera && !document.querySelector(primera.sel)) return;
      anotarMarcada(claveToca);
      correr(t, n);
    }, MS_ANTES_DEL_PERFIL);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveToca, correr, enDiaVisto]);
  // EL DÍA QUE SE ABRE, CON EL CHAT ABIERTO (reto-7): se relee el reto a la hora en que se abre el que sigue. Antes llegaba recién al
  // cambiar de pestaña y volver.
  const proxima = e ? proximaApertura(e, Date.now()) : null;
  useEffect(() => {
    if (proxima == null) return;
    const t = window.setTimeout(() => { void leer(); }, Math.min(Math.max(proxima - Date.now() + 3000, 1000), 2_000_000_000));
    return () => window.clearTimeout(t);
  }, [proxima, leer]);
  // La hora CONFIRMADA (verificación R57-F3): la de las burbujas, el cierre del día y «mañana a las…». La del selector, sólo en su
  // tarjeta: antes, tocar otra hora sin confirmarla cambiaba la hora de todos los mensajes.
  const horaWa = e?.horaWa ?? '9:00';
  const horaElegida = hora ?? horaWa;
  // LAS PIEZAS DEL RETO, CADA UNA CON SU HORA (reto-2 y reto-6): cada día abierto y, debajo, su cierre si terminó. Antes el cierre
  // («¡Terminaste tu día…!», «Tu reto está en tu Plan», «Perfecto: mañana…») miraba sólo el último día abierto: al adelantar
  // desaparecía del hilo. El del día de HOY llega con sus puntitos (la cola de salida); los de antes, ya vistos, quedan como están.
  type Pieza = { t: number; key: string; nodo: ReactNode };
  const piezas: Pieza[] = [];
  if (d && e && empezo1) {
    const ahoraMs = Date.now();
    const todos = diasDelReto(d.funnel, d.integraciones);
    for (const dia of abiertos) {
      if (!ver(`dia:${dia.n}`)) continue;
      const tDia = dia.n === 1 ? Date.parse(e.dia1Desde ?? e.inicio) : (cuandoSeAbrio(e, dia.n, ahoraMs) ?? ahoraMs);
      piezas.push({ t: tDia, key: `dia:${dia.n}`, nodo: (
        <>
          {/* Lo que eligió en «¿Adelantas el día N?», como su mensaje (verificación D1-06; la maqueta, `yo(rt, r.v)`). */}
          {e.adelantados?.includes(dia.n) && <DeLaPersona texto={`Adelantar al día ${dia.n}`} />}
          <Dia dia={dia} e={e} linea={d.linea} hora={horaWa} horaElegida={horaElegida} proUnaVez={!!d.proUnaVez} hoy={dia.n === d.abierto}
            deAntes={dia.n === d.abierto ? abiertos.filter((x) => x.n < dia.n).flatMap((x) => x.tareas.filter((t) => !tareaHecha(e, x.n, t.id)).map((t) => ({ n: x.n, t }))) : []}
            onHora={(h) => setHora(h)}
            onConfirmarHora={() => { if (ensayo.activo) void hacer({ accion: 'hora', hora: horaElegida }); }}
            onMarcar={(t, n = dia.n) => correr(t, n, () => window.setTimeout(() => marcarLoQueFalta(abiertos.find((x) => x.n === n) ?? dia, [t.id]), 400))}
            onTocadoEnVideo={() => { void leer(); }}
            onClipListo={() => { void leer(); }}
            qrApp={d.qrApp ?? null} integraciones={d.integraciones ?? []}
            onDespues={(id) => { void hacer({ accion: 'despues', dia: dia.n, id }); }}
            onDespuesDe={(n, id) => { void hacer({ accion: 'despues', dia: n, id }); }}
            onFinVideo={() => setFinDelVideo(dia)}
            ver={ver} conPiezaDe={cola.conPieza} onListo={diaListo} />
        </>
      ) });
      if (!diaTerminado(e, dia)) continue;
      const esHoy = dia.n === actual?.n;
      const verFin = (k2: string) => !esHoy || ver(k2);
      const sig = todos.find((x) => x.n === dia.n + 1);
      const faltaDia = faltaDe(dia);
      const mananaDia = !!sig && e.manana === sig.n;
      // Terminó cuando se hizo lo último (lo dejado para después no guarda la hora: entonces, al abrirse).
      const tFin = Math.max(tDia, ...dia.tareas.map((t) => Date.parse(e.hechas[claveTarea(dia.n, t.id)] ?? '') || 0)) + 1;
      piezas.push({ t: tFin, key: `fin:${dia.n}`, nodo: (
        <>
          {verFin(`fin:${dia.n}`) && <Burbuja><p>{finDelDia(dia, sig, horaWa, nombre, faltaDia)}</p></Burbuja>}
          {dia.n === 3 && !!e.enElPlan && verFin('plan') && <Burbuja><p>{RETO_EN_TU_PLAN}</p></Burbuja>}
          {/* El cierre del reto (R57-08): el piloto según su funnel y, recién después, la tarjeta del audio para Martín. */}
          {dia.n === 7 && verFin('piloto') && <Burbuja><p>{RETO_PILOTO(d.funnel)}</p></Burbuja>}
          {dia.n === 7 && verFin('piloto') && dia.whatsapp && cola.conPieza('piloto') && <TarjetaPrueba p={dia.whatsapp} linea={d.linea} hora={horaWa} hecha={e.pruebas?.['7'] ?? null} />}
          {/* «Mañana» queda como su mensaje, y MaKo contesta lo de la maqueta con SU hora (verificación D1-06; cuerpo.html, MANANA). */}
          {mananaDia && sig && verFin(`yo-manana:${sig.n}`) && <DeLaPersona texto="Mañana" />}
          {mananaDia && sig && verFin(`manana:${sig.n}`) && <Burbuja><p>{RETO_MANANA(horaWa, sig.n)}</p></Burbuja>}
        </>
      ) });
    }
  }
  const hiloPorHora = intercalar(piezas, k.items);
  const ultimoTramo = hiloPorHora.reduce((u, x, i) => ('tramo' in x ? i : u), -1);
  // EL CHAT BAJA AL ÚLTIMO (reto-1 y reto-10, con el gancho común app/_chat/useBajarAlUltimo.ts): con cada pieza o mensaje nuevo, con
  // los puntitos, al cerrar el catálogo, y con lo que CRECE (el video, la tarjeta) mientras la persona está abajo. Antes bajaba sólo con
  // el día o un día completo: al montar el día, con la entrada, las tareas sueltas o lo escrito en la caja, quedaba arriba.
  // La clave es la de la ÚLTIMA FILA dibujada, nunca una cuenta (el chat del onboarding, 20/11: con una cuenta, la auditoría encontró
  // que no baja): los puntitos, el último mensaje del reto que ya se ve, la última pieza (un día, con lo que ya salió adentro: sus tareas
  // hechas o para después y la hora) o el último mensaje de la charla, la muestra pedida y el catálogo.
  const seguirHilo = useCallback(() => hilo.current, []);
  const ultimaFila = hiloPorHora[hiloPorHora.length - 1];
  const delDia = (n: number) => !e ? '' : `${Object.keys(e.hechas).filter((x) => x.startsWith(`${n}:`)).sort().join(',')}/${(e.despues ?? []).filter((x) => x.startsWith(`${n}:`)).sort().join(',')}/${e.horaWa ?? ''}`;
  const claveUltimaFila = catalogo ? 'catalogo' : !d || !e ? 'carga' : [
    cola.escribiendo ? 'escribe' : '',
    cola.visibles[cola.visibles.length - 1]?.id ?? '',
    // Su tarjeta, que sale después del texto (la de un paso del día: la extensión, el perfil…).
    cola.visibles.length && cola.conPieza(cola.visibles[cola.visibles.length - 1].id) ? 'pieza' : '',
    !ultimaFila ? '' : 'pieza' in ultimaFila ? `${ultimaFila.pieza.key}#${delDia(Number(ultimaFila.pieza.key.split(':')[1]))}` : `charla:${ultimaFila.tramo[ultimaFila.tramo.length - 1]?.id ?? ''}`,
    k.enCurso ? 'trabaja' : '',
    muestraPendiente?.pestana ?? '',
  ].join('|');
  useBajarAlUltimo(seguirHilo, claveUltimaFila);
  // LOS PUNTITOS DE LA CARGA, SÓLO LA PRIMERA VEZ (reto-11; decidido por el Cerebro): mientras carga /api/reto, con nada visto todavía en
  // este navegador. Con historia, nada mientras carga y después todo de una (antes, cada visita empezaba con «MaKo está escribiendo»).
  const primeraVez = useSyncExternalStore(sinSuscribir, () => { try { return !localStorage.getItem(VISTOS); } catch { return true; } }, () => false);
  // EL TELÉFONO (verificación R57-F5; decidido por el Cerebro): el reto SIEMPRE dice «Sigamos en tu computadora», con el mismo
  // componente del onboarding. También con la cookie «Versión completa», que abre este Ops Center de escritorio en el teléfono.
  const telefono = useSyncExternalStore(sinSuscribir, () => esTelefono(navigator.userAgent), () => false);
  if (telefono) return <RetoEnElTelefono nombre={nombre} />;
  return (
    <PanelDeChat hilo={hilo}
      cabecera={{ clave: 'reto-7-dias', titulo: RETO_TITULO, aspecto: ASPECTO_APP_MAKO, animo: 'despierto', onVolver,
        // Al lado del desplegable, lo fijado del chat y los tutoriales (D1-17 y d24-17; la maqueta, pinsHtml): sus mensajes y sus videos,
        // a la DERECHA (margin-left: auto). EL ÍCONO DE VIDEOS, LO ÚLTIMO (20/11, la llamada con Leila, 00:31:46: «el icono de video
        // siempre a la derecha»): gana sobre el orden de la maqueta, que lo ponía antes del pin.
        acciones: d && e ? <span className="rt-acciones"><DesplegableReto d={d} abierto={menu} onAbrir={setMenu} /><PinDelReto dias={empezo1 ? abiertos : []} fijados={k.marcas.fijados.length} /><BotonTutoriales activo={catalogo} onClick={() => setCatalogo((x) => !x)} /></span> : undefined }}
      arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={RETO_TITULO} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
      caja={<>{d && e && !empezo1 && !muestraPendiente && ver(`pregunta:${vistas.length}`)
        ? <QueHacemos titulo={vistas.length ? '¿Seguimos?' : '¿Qué hacemos ahora?'} quedan={quedan} onDia1={empezarDia1} onMostrar={(m) => setEnCurso(m)} />
        : pregunta && siguiente && ver(`adelantar:${siguiente.n}`)
        ? <AdelantarDia n={siguiente.n} onAdelantar={() => void hacer({ accion: 'adelantar', dia: siguiente.n })} onManana={() => void hacer({ accion: 'manana', dia: siguiente.n })} />
        : null}<div className="co-caja"><CajaDelCliente k={k} campo={campo} seguir={() => hilo.current} /></div></>}
      estado="">
      <style>{CSS_RETO + CSS_CATALOGO}</style>
      {/* LA COLUMNA, A TODO EL ANCHO (20/11, la captura de Martín: los puntitos de la carga salían CENTRADOS arriba del chat). El panel
          ya envuelve el hilo en .co-hilo__col; ésta, adentro, con su margin-inline: auto, se achicaba a lo que tenía y quedaba al
          medio: con mensajes largos no se notaba, con la burbuja corta de la carga sí. .rt-hilo la estira como una fila de mensaje. */}
      <div className="co-hilo__col rt-hilo" data-recorrido="sb-reto-hilo">
        {/* Mientras llegan los datos (o arranca el reto la primera vez), MaKo escribiendo: los tres puntitos y no «Cargando tu reto…» ni
            «Empezando tu reto…» (20/11, la verificación de OD-09). */}
        {catalogo && d ? <CatalogoTutoriales diaAbierto={d.abierto} onVolver={() => setCatalogo(false)} /> : !d || !e ? (primeraVez ? <Burbuja><span className="co-escribiendo" role="status" aria-label="MaKo está escribiendo" data-reto-carga=""><span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></span></Burbuja> : null) : (
          <>
            {/* LA LLEGADA, SIEMPRE PRIMERO (la pieza del chat del onboarding): el video del recorrido general. Lo del reto sale después. */}
            <LlegadaAlReto nombre={nombre} listo={listo} onMostrada={() => setLlegadaMostrada(true)} />
            {ver('hola') && <Burbuja><p>{RETO_HOLA(nombre)}</p></Burbuja>}
            {muestras.length > 0 && ver('interes') && <Burbuja><p>{RETO_INTERES_YA(muestras)}</p></Burbuja>}
            {vistas.map((m) => (
              <Fragment key={m.pestana}>
                {ver(`muestra:${m.pestana}`) && <Burbuja ancho><VideoDeMuestra m={m} onPlay={() => verMuestra(m)} /><p className="rt-dia__msj">{RETO_MUESTRA(m)}</p></Burbuja>}
                {ver(`muestrafin:${m.pestana}`) && <Burbuja><p>{RETO_MUESTRA_FIN(m)}</p></Burbuja>}
              </Fragment>
            ))}
            {/* La que pidió recién: su mensaje con el video, hasta que lo vea en la pestaña (y quede en `vistas`). */}
            {muestraPendiente && ver(`muestra:${muestraPendiente.pestana}`) && (
              <Burbuja ancho><VideoDeMuestra m={muestraPendiente} onPlay={() => verMuestra(muestraPendiente)} /><p className="rt-dia__msj">{RETO_MUESTRA(muestraPendiente)}</p></Burbuja>
            )}
            {/* Los días, sus cierres y lo que le escribió a MaKo en la caja, en UN hilo por hora (reto-2 y reto-6). */}
            {hiloPorHora.map((x, i) => ('pieza' in x
              ? <Fragment key={x.pieza.key}>{x.pieza.nodo}</Fragment>
              // Cada tramo, con SU parte de la charla; sólo el último lleva «MaKo está escribiendo» (HiloDelCliente, sin cambios).
              : <HiloDelCliente key={`charla-${x.desde}`} k={{ ...k, items: x.tramo, enCurso: i === ultimoTramo && k.enCurso }} />))}
            {cola.escribiendo && <Burbuja><span className="co-escribiendo" role="status" aria-label="MaKo está escribiendo"><span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></span></Burbuja>}
          </>
        )}
      </div>
    </PanelDeChat>
  );
}

/** «¿Qué hacemos ahora?»: el recuadro de opciones del Ops Center (las clases de PreguntaChat), arriba de la caja (D1-02). */
export function QueHacemos({ titulo, quedan, onDia1, onMostrar }: { titulo: string; quedan: readonly MuestraReto[]; onDia1: () => void; onMostrar: (m: MuestraReto) => void }) {
  return (
    <div className="co-preg co-preg--chat rt-preg" role="group" aria-label={titulo} data-recorrido="sb-reto-que-hacemos">
      {/* «Tu siguiente paso» (la maqueta, `tema` del recuadro; verificación D1-02), con la clase de los temas de PreguntaChat. */}
      <p className="co-preg__temas"><span className="co-preg__tema">Tu siguiente paso</span></p>
      <p className="co-preg__texto">{titulo}</p>
      <ol className="co-preg__ops">
        <li><button type="button" className="co-preg__op" onClick={onDia1}><span className="co-preg__num" aria-hidden>1</span>
          <span className="co-preg__op-txt"><span className="co-preg__titulo">{RETO_EMPEZAR_DIA1}<span className="co-preg__rec"> (Recomendada)</span></span></span></button></li>
        {quedan.map((m, i) => (
          <li key={m.pestana}><button type="button" className="co-preg__op" onClick={() => onMostrar(m)}><span className="co-preg__num" aria-hidden>{i + 2}</span>
            <span className="co-preg__op-txt"><span className="co-preg__titulo">Muéstrame {m.nombre}</span></span></button></li>
        ))}
      </ol>
    </div>
  );
}

/** «¿Adelantas el día N?», en el recuadro de opciones (D1-06, d24-13, R57-07): sólo al día 2 se le recomienda «Adelantar»; desde
 *  el 3, «Mañana» va primero y sin recomendada. */
export function AdelantarDia({ n, onAdelantar, onManana }: { n: number; onAdelantar: () => void; onManana: () => void }) {
  const ops = n === 2 ? [{ t: `Adelantar al día ${n}`, rec: true, f: onAdelantar }, { t: 'Mañana', rec: false, f: onManana }]
    : [{ t: 'Mañana', rec: false, f: onManana }, { t: `Adelantar al día ${n}`, rec: false, f: onAdelantar }];
  return (
    <div className="co-preg co-preg--chat rt-preg" role="group" aria-label={`¿Adelantas el día ${n}?`} data-recorrido="sb-reto-adelantar">
      {/* El tema «Tu reto» (verificación D1-06; la maqueta, `preguntar(…, { tema: 'Tu reto' })`). */}
      <p className="co-preg__temas"><span className="co-preg__tema">Tu reto</span></p>
      <p className="co-preg__texto">¿Adelantas el día {n}?</p>
      <ol className="co-preg__ops">
        {ops.map((o, i) => (
          <li key={o.t}><button type="button" className="co-preg__op" onClick={o.f}><span className="co-preg__num" aria-hidden>{i + 1}</span>
            <span className="co-preg__op-txt"><span className="co-preg__titulo">{o.t}{o.rec && <span className="co-preg__rec"> (Recomendada)</span>}</span></span></button></li>
        ))}
      </ol>
    </div>
  );
}


const siempre = () => true;

export function Dia({ dia, e, linea, hora, horaElegida, proUnaVez = false, hoy = true, onHora, onConfirmarHora, onMarcar, onTocadoEnVideo, onFinVideo, onClipListo, qrApp = null, integraciones = [], onDespues, onDespuesDe, deAntes = [], ver = siempre, conPiezaDe = siempre, onListo }: { dia: DiaReto; e: EstadoReto; linea: string | null; hora: string;
  /** La cola de salida del chat (lib/reto/en-el-dia.ts): si la fila de un paso del día ya salió, y si su tarjeta también. Sin cola,
   *  todo de una (las capturas). `onListo`: el mensaje del día y su tarjeta ya se ven (lo de adentro puede empezar sus puntitos). */
  ver?: (id: string) => boolean; conPiezaDe?: (id: string) => boolean; onListo?: (n: number) => void;
  /** La hora que tocó en el selector del día 2 y todavía no confirmó: sólo para su tarjeta (R57-F3). Sin ella, `hora`. */
  horaElegida?: string; proUnaVez?: boolean; hoy?: boolean; onHora: (h: string) => void; onConfirmarHora?: () => void; onMarcar: (t: TareaReto, n?: number) => void; onTocadoEnVideo: (sel: string) => void; onFinVideo?: () => void; onClipListo?: () => void; qrApp?: string | null; integraciones?: readonly IntegracionConEstado[]; onDespues?: (id: string) => void;
  /** «Lo hago después» de la tarea que toca, en la tarjeta (R57-15, d24-08): también una de un día anterior. */
  onDespuesDe?: (n: number, id: string) => void;
  /** El día de HOY: lo que quedó sin hacer de los días anteriores, que va primero con «Del día N» (d24-21). */
  deAntes?: ReadonlyArray<{ n: number; t: TareaReto }> }) {
  const p = dia.whatsapp;
  // LO DE ADENTRO DEL DÍA, POR LA COLA (lib/reto/en-el-dia.ts: qué sale y en qué orden, lo mismo que arma la cola): cada paso, recién
  // cuando su fila salió (después de sus puntitos), y su tarjeta, recién cuando salió su pieza.
  const pasos = pasosEnElDia(dia, e, { hoy, integraciones });
  const sale = (q: QueEnElDia) => pasos.some((x) => x.que === q) && ver(idEnElDia(dia.n, q));
  const suTarjeta = (q: QueEnElDia) => conPiezaDe(idEnElDia(dia.n, q));
  // EL DÍA 2 EN SU ORDEN (20/11, auditoría d24-19 y D1-18; memoria onboarding-16-11-decisiones): el QR, la extensión, las integraciones,
  // la hora de WhatsApp y, ÚLTIMO, el perfil. El perfil sale de la tarjeta del día y va después de la hora.
  const ultimo = dia.n === 2 ? dia.tareas.find((t) => t.id === 'perfil') : undefined;
  const primeras = ultimo ? dia.tareas.filter((t) => t !== ultimo) : dia.tareas;
  // EL DÍA 2 EN PASOS (20/11, auditoría d24-08; la maqueta: «no los nombra todos juntos»). El día de HOY va de a uno: la app (el QR, con
  // el video), la extensión con su mensaje, las integraciones con el suyo, y recién con esos tres hechos o para después, la hora de
  // WhatsApp y el perfil. Un día 2 que ya pasó se ve entero.
  // La fecha del día en el hilo (R57-F3): «Hoy», «Ayer», «Jueves 19 de noviembre». La de cuando se ABRIÓ (segunda verificación: no la
  // de cuando se vio; lo guardado por /api/reto o, sin eso, la cuenta de `cuandoSeAbrio`).
  const abrio = cuandoSeAbrio(e, dia.n, Date.now());
  const fecha = abrio != null ? rotuloDelDia(abrio, Date.now(), e.zona) : null;
  // El paso en que va el día 2 de HOY (`paso2`, `llega2`) vive en lib/reto/en-el-dia.ts, con lo que sale.
  const pasos2 = dia.n === 2 && hoy;
  // Los días 3 y 4 de HOY también van de a una tarea (d24-08): las hechas o dejadas para después, y la que sigue.
  const deAUna = hoy && (dia.n === 3 || dia.n === 4);
  const iSigue = primeras.findIndex((t) => !tareaHecha(e, dia.n, t.id) && !tareaDespues(e, dia.n, t.id));
  const enLaTarjeta = pasos2 ? primeras.filter((t) => t.id === 'app') : deAUna && iSigue >= 0 ? primeras.slice(0, iSigue + 1) : primeras;
  const tarea2 = (id: string) => dia.tareas.find((t) => t.id === id);
  // `n`: el día de la tarea (una de un día anterior va en la tarjeta de hoy con «Del día N», d24-21).
  // La que toca (R57-15 y d24-08): la primera sin hacer ni dejada para después. Lleva «Lo hago después» en la tarjeta (el día 1 no).
  const toca = hoy && dia.n > 1 ? [...deAntes.map((x) => ({ n: x.n, t: x.t })), ...dia.tareas.map((t) => ({ n: dia.n, t }))].find((x) => !tareaHecha(e, x.n, x.t.id) && !tareaDespues(e, x.n, x.t.id)) : undefined;
  const fila = (t: TareaReto, n: number = dia.n) => {
    const ok = tareaHecha(e, n, t.id);
    const ico = iconoDeTarea(t);
    const esLaQueToca = !!toca && toca.n === n && toca.t.id === t.id;
    // Hecha, dice lo que MaKo LEYÓ (20/11, auditoría d24-12: «Leí 134 contactos en tu CRM.»), no el detalle de la tarea.
    const leido = ok ? e.leidas?.[claveTarea(n, t.id)] : undefined;
    // En una prueba de Essential, lo de Pro se usa una vez y se dice sin vender (R57-03): ningún botón que venda el plan acá.
    const pro = TAREA_PRO[claveTarea(n, t.id)];
    const nota = !ok && proUnaVez && pro && !(e.pro?.[pro] && Date.now() > Date.parse(e.pro[pro]!.hasta)) ? NOTA_PRO_UNA_VEZ : null;
    return (
      <li key={`${n}:${t.id}`} className="rt-tarea" data-ok={ok ? '' : undefined} data-tarea={`${n}:${t.id}`}>
        <span className="rt-tarea__check" aria-hidden>{ok ? '✓' : ''}</span>
        {ico && <span className="rt-tarea__ico" aria-hidden><Icon name={ico} size={16} /></span>}
        <span className="rt-tarea__txt"><b>{n !== dia.n && <span className="rt-tarea__de">Del día {n} · </span>}{t.titulo}</b><small>{leido ?? t.detalle}</small>{nota && <small className="rt-tarea__pro">{nota}</small>}</span>
        {/* Sin «Hacerlo» (18/11): dice DÓNDE es, y tocarlo marca ese lugar con el tutorial (no lleva a ningún lado). */}
        {ok ? <span className="rt-tarea__ok">Listo</span>
          : tareaDespues(e, n, t.id) ? <button type="button" className="rt-tarea__donde" onClick={() => onMarcar(t, n)} title="Te marco dónde está">◐ Después</button>
          : <span className="rt-tarea__ops">
              <button type="button" className="rt-tarea__donde" onClick={() => onMarcar(t, n)} title="Te marco dónde está">{t.donde}</button>
              {esLaQueToca && onDespuesDe && <button type="button" className="rt-tarea__luego" onClick={() => onDespuesDe(n, t.id)}>Lo hago después</button>}
            </span>}
      </li>
    );
  };
  // V5 (20/11, auditoría V5, d24-11 y R57-12): la primera vez que se abre el día de HOY, el velo con MaKo escribiendo y recién después
  // su mensaje con el video, marcado con «dale play» mientras está quieto (el motor lo marca sólo a la vista y con el motor libre).
  // Lo visto se recuerda POR DÍA en este navegador (d24-11): antes vivía en la memoria de la página y volvía en cada carga.
  const [nuevo] = useState(() => !yaVisto(`entrada:${dia.n}`));
  const fase = useEntrada(delReto(`reto-dia-${dia.n}`), hoy && nuevo);
  useEffect(() => { if (hoy && nuevo) anotarVisto(`entrada:${dia.n}`); }, [hoy, nuevo, dia.n]);
  // El recordatorio del QR (d24-07; la maqueta, RECORDATORIO): al volver al chat otro rato con la app todavía sin instalar.
  const [qrDeAntes] = useState(() => yaVisto('qr-app'));
  const esperaApp = dia.n === 2 && !!qrApp && !tareaHecha(e, 2, 'app') && !tareaDespues(e, 2, 'app');
  useEffect(() => { if (esperaApp) anotarVisto('qr-app'); }, [esperaApp]);
  // LO QUE TRAE EL DÍA, DESPUÉS DE SU MENSAJE (auditoría de chats, reto-3; decidido por el Cerebro: el QR del día 2 NO sale junto con el
  // video): la tarjeta del día, el QR y lo que sigue salen con su pausa (MS_PAUSA_PIEZA, la de la cola de salida) después del mensaje.
  const [conPieza, setConPieza] = useState(() => !(hoy && nuevo));
  useEffect(() => {
    if (conPieza || fase !== 'listo') return;
    const t = window.setTimeout(() => setConPieza(true), MS_PAUSA_PIEZA);
    return () => window.clearTimeout(t);
  }, [conPieza, fase]);
  useEffect(() => { if (conPieza) onListo?.(dia.n); }, [conPieza, onListo, dia.n]);
  if (fase === 'escribe') {
    return (
      <>
        <p className="co-dia">Día {dia.n} de 7{fecha ? ` · ${fecha}` : ''}</p>
        <EntradaEscribiendo foto={<Muneco titulo="MaKo" aspecto={ASPECTO_APP_MAKO} animo="despierto" size={26} />} quien="MaKo" />
      </>
    );
  }
  return (
    <>
      <p className="co-dia">Día {dia.n} de 7{fecha ? ` · ${fecha}` : ''}</p>
      {/* El video primero y el texto abajo, con la hora del mensaje (f24-07): desde el día 2, la que eligió (o 9:00). */}
      <Burbuja ancho hora={dia.n > 1 ? hora : null}>
        <VideoDelDia dia={dia} onTocado={onTocadoEnVideo} onFin={onFinVideo} dalePlay={hoy} />
        <p className="rt-dia__msj">{dia.mensaje}</p>
      </Burbuja>
      {conPieza && <>
      {/* El QR de la app, después del mensaje del día 2 (d24-06; reto-3), mientras la app no esté y no la dejó para después. */}
      {esperaApp && qrApp && <TarjetaQrApp qr={qrApp} onDespues={() => onDespues?.('app')} />}
      {esperaApp && hoy && qrDeAntes && <Burbuja><p>{RETO_D2_RECORDATORIO}</p></Burbuja>}
      {/* El día 1 sin tarjeta (F2; la maqueta: el mensaje y la marca sobre Offer Coach). Sus tareas están en el desplegable. */}
      {dia.n !== 1 && <Burbuja ancho>
        <div className="rt-tarjeta" data-recorrido={`sb-reto-dia-${dia.n}`}>
          {/* La cabecera de la maqueta (diaHtml, verificación f24-03): «Día N de 7» y el título del día. Sin «Lo que te toca hoy». */}
          <p className="rt-tarjeta__cab"><span className="rt-tarjeta__n">Día {dia.n} de 7</span><span className="rt-tarjeta__t">{dia.titulo}</span></p>
          <ol className="rt-tareas">
            {deAntes.map((x) => fila(x.t, x.n))}
            {enLaTarjeta.map((t) => fila(t))}
          </ol>
        </div>
      </Burbuja>}
      {/* Las integraciones de lo que eligió, con su estado (d24-05). «Te muestro dónde» corre las marcas de la tarea. */}
      {/* El día 2 en pasos: la extensión, con su mensaje (d24-08). */}
      {sale('ext') && tarea2('extension') && (
        <>
          <Burbuja><p>{RETO_D2_EXT}</p></Burbuja>
          {suTarjeta('ext') && <Burbuja ancho><div className="rt-tarjeta" data-recorrido="sb-reto-dia-2-extension"><ol className="rt-tareas">{fila(tarea2('extension')!)}</ol></div></Burbuja>}
        </>
      )}
      {sale('int') && (integraciones.length > 0
        ? <TarjetaIntegraciones ints={integraciones} onMostrar={() => { const t = tarea2('integraciones'); if (t) onMarcar(t); }}
            despues={tareaDespues(e, 2, 'integraciones')} onDespues={hoy ? () => onDespues?.('integraciones') : undefined} conTarjeta={suTarjeta('int')} />
        : tarea2('integraciones') && <Burbuja ancho><div className="rt-tarjeta"><ol className="rt-tareas">{fila(tarea2('integraciones')!)}</ol></div></Burbuja>)}
      {sale('clip') && <ClipDelReto onListo={onClipListo} />}
      {/* La prueba por WhatsApp va al FINAL del día (f24-02); la hora del día 2 es un paso del día: su tarjeta (wa-08, TarjetaHora).
          Guardada, su mensaje queda y la confirmación llega con sus puntitos. */}
      {p && (sale('hora') || sale('hora-ok')) && <TarjetaHora p={p} guardada={e.horaWa ?? null} linea={linea} hora={horaElegida ?? hora} onHora={onHora} onConfirmar={onConfirmarHora ?? (() => {})}
            onDespues={pasos2 && !tareaDespues(e, 2, 'hora') ? () => onDespues?.('hora') : undefined}
            conMensaje={sale('hora')} conTarjeta={suTarjeta('hora')} confirmada={sale('hora-ok')} />}
      {p && sale('prueba') && <TarjetaPrueba p={p} linea={linea} hora={hora} hecha={e.pruebas?.[String(dia.n)] ?? null} />}
      {/* El perfil, último paso del día 2: el mensaje de MaKo (la maqueta, D2_PERFIL) y su tarjeta. Recién con la hora guardada (o
          dejada para después): la maqueta lo manda después del WhatsApp de la hora (d24-08, «uno a la vez»). */}
      {ultimo && sale('perfil') && (
        <>
        <Burbuja><p>{RETO_D2_PERFIL}</p></Burbuja>
        {suTarjeta('perfil') && <Burbuja ancho>
          <div className="rt-tarjeta" data-recorrido="sb-reto-dia-2-perfil">
            <ol className="rt-tareas">{fila(ultimo, dia.n)}</ol>
          </div>
        </Burbuja>}
        </>
      )}
      {/* Lo que hizo durante el video ya cuenta (el Cerebro, 18/11): si hizo todo, la felicita (sólo el día 2, R57-F4). */}
      {sale('todo') && <Burbuja><p>¡Hiciste todo lo del día {dia.n}!</p></Burbuja>}
      </>}
    </>
  );
}

/** La prueba por WhatsApp del día (el audio del día 7 va después del cierre del reto, R57-08). */
function TarjetaPrueba({ p, linea, hora, hecha = null }: { p: NonNullable<DiaReto['whatsapp']>; linea: string | null; hora: string;
  /** MaKo ya la contestó por WhatsApp (lib/reto/pruebas.ts, d24-16 y R57-10): «✓ Hecho» y lo que hizo. */
  hecha?: { leido?: string } | null }) {
  const link = linkWaMe(linea, mensajeEscrito(p, hora));
  if (hecha) return <Burbuja ancho><div className="rt-tarjeta rt-wa" data-ok=""><p className="rt-tarjeta__t">{p.texto}</p><p className="rt-wa__ej">✓ Hecho{hecha.leido ? `: ${hecha.leido}` : ''}</p></div></Burbuja>;
  return (
    <Burbuja ancho>
      <div className="rt-tarjeta rt-wa">
        <p className="rt-tarjeta__t">{p.texto}</p>
        <p className="rt-wa__ej">Por ejemplo: {p.ejemplo}</p>
        {link
          ? <a className="rt-wa__btn" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
          : <p className="rt-wa__ej">No tengo el número de MaKo a mano: vuelve a intentarlo en un rato.</p>}
      </div>
    </Burbuja>
  );
}

/**
 * LA HORA DE MaKo (el día 2; la maqueta, `tarjeta('hora')`; la auditoría del 20/11, wa-08 y D1-12). Tocar una hora sólo la ELIGE: se
 * guarda cuando ella manda el mensaje por WhatsApp, y MaKo le contesta (lib/reto/respuestas.ts). Desde ahí MaKo le escribe cada mañana a
 * esa hora (lib/reto/avisos.ts). Guardada, queda la confirmación. En el ensayo «desde cero» no hay WhatsApp: «Confirmar» la guarda ahí.
 */
function TarjetaHora({ p, guardada, linea, hora, onHora, onConfirmar, onDespues, conMensaje = true, conTarjeta = true, confirmada = true }: {
  p: NonNullable<DiaReto['whatsapp']>; guardada: string | null; linea: string | null; hora: string; onHora: (h: string) => void; onConfirmar: () => void;
  /** «Lo hago después» (d24-08: cada paso del día 2 lo lleva): sigue el perfil. */
  onDespues?: () => void;
  /** Por la cola de salida (lib/reto/en-el-dia.ts): el mensaje, la tarjeta (después del texto) y la confirmación, cada uno cuando sale. */
  conMensaje?: boolean; conTarjeta?: boolean; confirmada?: boolean;
}) {
  const mensaje = conMensaje && <Burbuja><p>{RETO_D2_HORA}</p></Burbuja>;
  if (guardada) return <>{mensaje}{confirmada && <Burbuja><p>✓ MaKo te escribe cada día a las {guardada}, por WhatsApp.</p></Burbuja>}</>;
  const link = linkWaMe(linea, mensajeEscrito(p, hora));
  if (!conTarjeta) return <>{mensaje}</>;
  return (
    <>
      {mensaje}
      <Burbuja ancho>
        <div className="rt-tarjeta rt-wa" data-tarea="2:hora">
          <p className="rt-tarjeta__t">¿A qué hora te escribe MaKo sobre el reto?</p>
          <p className="rt-wa__ej">Al confirmar se abre tu WhatsApp con el mensaje ya escrito: lo mandas tú y MaKo te contesta.</p>
          <div className="rt-horas" role="radiogroup" aria-label="La hora">
            {HORAS_WA.map((h) => <button key={h} type="button" role="radio" aria-checked={h === hora} className="rt-hora" onClick={() => onHora(h)}>{h}</button>)}
          </div>
          <p className="rt-wa__ej">MaKo te escribe cada día a las {hora}.</p>
          {link
            ? <a className="rt-wa__btn" href={link} target="_blank" rel="noopener noreferrer" onClick={onConfirmar}>Confirmar y abrir WhatsApp</a>
            : <p className="rt-wa__ej">No tengo el número de MaKo a mano: vuelve a intentarlo en un rato.</p>}
          {onDespues && <button type="button" className="rt-tarea__donde" onClick={onDespues}>Lo hago después</button>}
        </div>
      </Burbuja>
    </>
  );
}

/** El video del día: el del manifiesto (`reto-dia-<n>`), o en la revisión su lugar marcado. Nunca otro video. */
function VideoDelDia({ dia, onTocado, onFin, dalePlay = false }: { dia: DiaReto; onTocado?: (sel: string) => void; onFin?: () => void; dalePlay?: boolean }) {
  const v = useVideoTutorial(dia.video);
  const raiz = useRef<HTMLDivElement>(null);
  const conMarcas = !!v?.frases?.some((f) => f.sel);
  // La placa de abajo, sólo en la revisión de Martín y con el manifiesto ya leído (20/11, la verificación de V10 y F1): no en todo
  // el Cliente de Prueba, ni mientras carga.
  const revision = useEsRevision();
  const listo = useManifiestoListo();
  // ¿Lo está pasando el motor ahora? (en su lugar o en la esquina)
  const senal = useSenal();
  const corre = senal?.tipo === 'tutorial' && senal.video === dia.video;
  // El «dale play» con el TÍTULO DEL VIDEO (segunda verificación de V5: decía «Día 2: dale play»; la maqueta, «Día 2: conecta todo:
  // dale play»), mientras nadie lo tocó y sólo si ese video todavía no se vio en este navegador (V5).
  const [visto] = useState(() => yaVisto(`video:${dia.n}`));
  const titulo = v ? tituloDelVideo(v, dia.n) : `Día ${dia.n}`;
  useDalePlay(raiz, { clave: delReto(dia.video), titulo, activo: dalePlay && conMarcas && !visto && !corre });
  // CERRAR EL «DALE PLAY» DEL DÍA 1 CON SU X (auditoría de chats, reto-5 a; decidido por el Cerebro, D1-03: «o cuando la persona lo
  // cierra»): sin darle play, la invitación se va y Offer Coach no se marcaba nunca. Se ve desde aquí, sin tocar useDalePlay: la marca
  // «{título}: dale play» de este video se fue, quedó cerrada y el video no arrancó.
  const arranco = useRef(false);
  const invitaba = useRef(false);
  const esLaInvitacion = !conMarcas && senal?.tipo === 'marca' && !!senal.invita && senal.paso.titulo === tituloDalePlay(titulo);
  useEffect(() => {
    if (esLaInvitacion) { invitaba.current = true; return; }
    if (!invitaba.current) return;
    invitaba.current = false;
    const t = window.setTimeout(() => { if (!arranco.current && dalePlayCerrado(dia.video)) { anotarVisto(`video:${dia.n}`); onFin?.(); } }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esLaInvitacion]);
  // UN DÍA SIN VIDEO NO ESPERA UN VIDEO QUE NO EXISTE (D1-03, decidido por el Cerebro: «Sin video, “abre Offer Coach” marca la fila real
  // de la barra»). Lo hacía la tarjeta «Tu siguiente paso», que salió con la llamada con Leila (20/11): con el manifiesto leído y sin el
  // video de hoy, lo que falta se marca igual, como al terminarlo, una vez. Sin anotarlo como visto: un manifiesto que no llegó también
  // viene vacío y «listo», y la persona perdería su «dale play» para siempre por un error pasajero.
  const sinVideo = listo && !v && dalePlay;
  useEffect(() => {
    if (sinVideo) onFin?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinVideo]);
  // Con frases que marcan lugares (los días 2 a 7), EN SU MENSAJE (V4 y R57-21): este es su lugar; el video lo pasa el motor encima
  // (marca cada lugar cuando la voz lo nombra y pausa hasta el clic) y lo baja a la esquina al scrollear o navegar.
  if (v && conMarcas) {
    const ver = () => verVideoDelDia(dia, true, titulo, { alTocar: onTocado, alTerminar: onFin });
    return (
      <div ref={raiz} className="mk-vmom rt-vlugar" data-video-lugar={dia.video} data-estado={corre ? 'reproduciendo' : 'quieto'}>
        <style>{CSS_REPRODUCTOR}</style>
        <div className="mk-vmom__pantalla" onClick={corre ? undefined : ver}>
          {v.poster && <img className="mk-vmom__portada" src={v.poster} alt="" />}
          {corre
            ? <span className="mk-vmom__esquina" role="status">Se está viendo en la esquina ↘</span>
            : <button type="button" className="mk-vmom__play" onClick={(x) => { x.stopPropagation(); ver(); }} aria-label={`Reproducir: ${titulo}`} title={titulo}><Icon name="play" size={28} /></button>}
        </div>
        <div className="mk-vmom__ctrl">
          <button type="button" className="mk-vmom__btn" onClick={ver} disabled={corre} aria-label="Reproducir"><Icon name="play" size={16} /></button>
          <span className="mk-vmom__tiempo">0:00 / {mmss(v.duracion_s) || '0:00'}</span>
          <div className="mk-vmom__pista" aria-hidden><span className="mk-vmom__hecho" style={{ width: 0 }} /></div>
          <button type="button" className="mk-vmom__vel" disabled title="Velocidad">1×</button>
        </div>
      </div>
    );
  }
  // Sin marcas (el día 1): el reproductor de la maqueta (V14), que sigue en la esquina si se navega y marca «dale play» (V5). La marca de
  // Offer Coach sale al terminar, en el chat O en la esquina, o al cerrarlo ahí (segunda verificación de D1-03; decidido por el Cerebro).
  const alFin = () => { anotarVisto(`video:${dia.n}`); onFin?.(); };
  if (v) return <VideoDelMomento clave={dia.video} titulo={titulo} revision={false} onTermina={alFin} onTerminaFuera={alFin} onEmpieza={() => { arranco.current = true; }} dalePlay={dalePlay && !visto} />;
  if (PARA_TODOS || !revision || !listo) return null;
  return <div className="rt-video rt-video--lugar" role="note"><b>Tu video del día {dia.n}</b><span>Todavía no está grabado: va aquí.</span></div>;
}

/** Desde dónde escribe la caja del reto: el servidor arma con esto el contexto del reto (`contextoDelChat`). */
const DESDE_RETO: Desde = { tab: ORIGEN_RETO, entidad: null, modo: null };

/** El título del desplegable (la maqueta, RETO_T; auditoría D1-14, d24-18 y R57-F6). El chat sigue llamándose «Reto de 7 días». */
const RETO_TITULO_DESPLEGABLE = 'El reto de 7 días de MaKo';
const mmss = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** El video de un día, en el desplegable (20/11, auditoría V2, D1-08 y R57-14): su título y su duración, y lo reproduce como en el
 *  chat: con sus marcas en los días que las tienen. Sin video en el manifiesto, nada (nunca un hueco). */
function VideoEnElMenu({ dia, hoy }: { dia: DiaReto; hoy: boolean }) {
  const v = useVideoTutorial(dia.video);
  const [visto] = useState(() => yaVisto(`video:${dia.n}`));
  if (!v) return null;
  // Hoy, sin verlo todavía (V2, la maqueta): «Su video sale cuando lo abres» — el del chat, con su entrada.
  if (hoy && !visto) return <p className="rt-menu__luego">Su video sale cuando lo abres.</p>;
  // El título del video (la maqueta: «Día 2: conecta todo»), el del manifiesto sin «Reto · ».
  const titulo = tituloDelVideo(v, dia.n);
  const conMarcas = !!v.frases?.some((f) => f.sel);
  return (
    <button type="button" className="rt-menu__video" onClick={() => verVideoDelDia(dia, conMarcas, titulo)}>
      <span className="rt-menu__play" aria-hidden>▶</span>
      <span><b>{titulo}</b><small>Video{v.duracion_s ? ` · ${mmss(v.duracion_s)}` : ''}</small></span>
    </button>
  );
}

/** El título de un video del reto (el del manifiesto, «Reto · Día 2: conecta todo», sin «Reto · »). */
const tituloDelVideo = (v: object, n: number): string => ((v as { pestana?: string }).pestana ?? '').replace(/^Reto · /, '') || `Día ${n}`;

/** El video de la pestaña en el mensaje «Te muestro dónde…» (D1-02 y V3; la maqueta, el mensaje de video de MUESTRA). */
function VideoDeMuestra({ m, onPlay }: { m: MuestraReto; onPlay: () => void }) {
  const v = useVideoTutorial(m.pestana);
  // Con su «dale play», como el video de cada día (auditoría de chats, reto-9): «Te muestro dónde… Dale play.» lo dejaba sin velo.
  const boton = useRef<HTMLButtonElement>(null);
  useDalePlay(boton, { clave: delReto(`muestra-${m.pestana}`), titulo: m.nombre, activo: !!v });
  return (
    <button ref={boton} type="button" className="rt-video rt-video--pasos" onClick={() => { cerrarDalePlay(delReto(`muestra-${m.pestana}`)); onPlay(); }} style={v?.poster ? { backgroundImage: `url(${v.poster})` } : undefined}
      aria-label={`Ver el video de ${m.nombre}: te llevo a la pestaña`} data-recorrido={`sb-reto-muestra-${m.pestana}`}>
      <span className="rt-video__play" aria-hidden>▶</span><span className="rt-video__dice">{m.nombre}{v?.duracion_s ? ` · ${mmss(v.duracion_s)}` : ''}: te llevo a la pestaña</span>
    </button>
  );
}

/**
 * LO FIJADO DEL CHAT, en la cabecera (D1-17 y d24-17; la maqueta, pinsHtml: «Videos y mensajes fijados», el pin con su número): los
 * videos de los días ya abiertos y cuántos mensajes fijó (los mensajes, en la barra de fijados de arriba del hilo, BarraFijados).
 */
function PinDelReto({ dias, fijados }: { dias: readonly DiaReto[]; fijados: number }) {
  const [abierto, setAbierto] = useState(false);
  const n = dias.length + fijados;
  if (!n) return null;
  return (
    <span className="rt-pin">
      <button type="button" className="rt-btn rt-btn--ico" aria-expanded={abierto} aria-label={`Videos y mensajes fijados: ${n}`} title="Videos y mensajes fijados" onClick={() => setAbierto((x) => !x)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="rt-pin__n">{n}</span>
      </button>
      {abierto && (
        <div className="rt-pin__lista" role="menu">
          <p className="rt-pin__t">Fijados</p>
          {dias.map((dia) => <PinVideo key={dia.n} dia={dia} onVer={() => setAbierto(false)} />)}
          {fijados > 0 && <p className="rt-pin__msj">{fijados === 1 ? 'Un mensaje fijado' : `${fijados} mensajes fijados`}: arriba del chat.</p>}
        </div>
      )}
    </span>
  );
}
function PinVideo({ dia, onVer }: { dia: DiaReto; onVer: () => void }) {
  const v = useVideoTutorial(dia.video);
  if (!v) return null;
  const titulo = tituloDelVideo(v, dia.n);
  return (
    <button type="button" role="menuitem" className="rt-pin__item" onClick={() => { onVer(); verVideoDelDia(dia, !!v.frases?.some((f) => f.sel), titulo); }}>
      <span className="rt-menu__play" aria-hidden>▶</span><span><b>{titulo}</b><small>Video{v.duracion_s ? ` · ${mmss(v.duracion_s)}` : ''}</small></span>
    </button>
  );
}

/** EL DESPLEGABLE DEL RETO, en la cabecera del chat. */
export function DesplegableReto({ d, abierto, onAbrir }: { d: DatosReto; abierto: boolean; onAbrir: (si: boolean) => void }) {
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);
  const actual = Math.max(1, d.abierto);
  const ver = diaAbierto ?? actual;
  const hora = d.estado?.horaWa ?? '9:00';
  const ESTADO: Record<EstadoDia, string> = { hecho: 'Listo', medias: 'A medias', hoy: 'Hoy', luego: '' };
  return (
    <div className="rt-btn-wrap">
      <button type="button" className="rt-btn" aria-expanded={abierto} aria-haspopup="dialog" onClick={() => onAbrir(!abierto)} data-recorrido="sb-reto">
        <svg className="rt-btn__ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span className="rt-btn__txt"><b>{RETO_TITULO}</b><span className="rt-segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</span></span>
        {/* «Completo» al cerrar el día 7 (verificación R57-08; la maqueta, `sig > 7`): aunque quede algo de otro día, como el cierre del chat. */}
        <span className="rt-btn__dia">{d.hechos === 7 || (!!d.estado && actual === 7 && diaTerminado(d.estado, diasDelReto(d.funnel, d.integraciones)[6])) ? 'Completo' : `Día ${actual} de 7`}</span>
        <svg className="rt-btn__flecha" viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && (
        <div className="rt-menu" role="dialog" aria-label={RETO_TITULO}>
          <header className="rt-menu__cab"><div><p className="rt-menu__t">{RETO_TITULO_DESPLEGABLE}</p><p className="rt-menu__sub">{RETO_SUB}</p></div><span className="rt-menu__cuenta"><b>{d.hechos}</b> de 7</span></header>
          <div className="rt-menu__segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</div>
          <p className="rt-menu__ley"><span><i data-e="hecho" />Listo</span><span><i data-e="hoy" />Hoy</span><span><i data-e="medias" />A medias</span><span><i />Por venir</span></p>
          <ol className="rt-menu__lista">
            {diasDelReto(d.funnel, d.integraciones).map((dia, i) => {
              const est = d.dias[i];
              const futuro = est === 'luego';
              const etiqueta = ESTADO[est] || (dia.n === actual + 1 ? `Mañana, a las ${hora}` : `Día ${dia.n}`);
              const abre = dia.n === ver;
              return (
                <li key={dia.n} className="rt-menu__dia" data-e={est} data-abierto={abre ? '' : undefined}>
                  <button type="button" className="rt-menu__fila" aria-expanded={abre} onClick={() => setDiaAbierto(abre ? 0 : dia.n)}>
                    <span className="rt-menu__n" aria-hidden>{est === 'hecho' ? '✓' : dia.n}</span>
                    <span className="rt-menu__q"><b>{dia.titulo}</b><small>{etiqueta}</small></span>
                    {/* La flecha de cada fila (D1-17; la maqueta, mq-retom__flecha). */}
                    <svg className="rt-menu__flecha" viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {abre && (
                    <div className="rt-menu__cuerpo">
                      {futuro && <p className="rt-menu__luego">Su video llega {dia.n === actual + 1 ? `mañana a las ${hora}` : `ese día a las ${hora}`}. Si quieres, adelántalo al terminar el día de hoy.</p>}
                      {!futuro && <VideoEnElMenu dia={dia} hoy={dia.n === actual} />}
                      <p className="rt-menu__rot">Lo que te toca</p>
                      <ol className="rt-menu__tareas">
                        {dia.tareas.map((t) => {
                          const ok = !!d.estado && tareaHecha(d.estado, dia.n, t.id);
                          // Las del día 1, sin «En el Ops Center» (F2: no tienen pestaña; la maqueta, sin `tab`).
                          return <li key={t.id} data-ok={ok ? '' : undefined}><span className="rt-tarea__check" aria-hidden>{ok ? '✓' : ''}</span><span>{t.titulo}{dia.n !== 1 && <small>{t.donde}</small>}</span></li>;
                        })}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
export const CSS_RETO = `
.rt-md p { margin: 0; }
.rt-md p + p, .rt-md p + .rt-video, .rt-md .rt-opciones { margin-top: 8px; }
.rt-preg { margin: 0 12px 10px; }
.rt-caja { margin: 0; padding: 10px 14px; font-size: var(--fs-meta); color: var(--dim); text-align: center; }
.rt-opciones { display: flex; flex-wrap: wrap; gap: 8px; }
.rt-video { display: block; width: min(420px, 100%); aspect-ratio: 16 / 9; margin-top: 8px; border-radius: var(--r-md); background: #0E1219; }
.rt-video--lugar { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #fff; border: 1.5px dashed rgba(255,255,255,.4); text-align: center; padding: 8px; box-sizing: border-box; }
.rt-video--lugar span { font-size: var(--fs-meta); opacity: .75; }
.rt-video--pasos { position: relative; border: 0; padding: 0; cursor: pointer; background-size: cover; background-position: center; color: #fff; overflow: hidden; }
.rt-video--pasos::after { content: ""; position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(0,0,0,.65)); }
.rt-video__play { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center; background: rgba(0,0,0,.55); font-size: 20px; z-index: 1; }
.rt-video__dice { position: absolute; left: 12px; right: 12px; bottom: 10px; font-size: var(--fs-meta); font-weight: 650; text-align: left; z-index: 1; }
.rt-tarjeta { display: flex; flex-direction: column; gap: 8px; }
.rt-tarjeta__t { margin: 0; font-weight: 650; font-size: var(--fs-sm); color: var(--ink); }
.rt-vlugar .mk-vmom__pantalla { cursor: pointer; }
.rt-vlugar .mk-vmom__btn:disabled, .rt-vlugar .mk-vmom__vel:disabled { opacity: .6; cursor: default; }
.rt-tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rt-tarea { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--border); }
.rt-tarea__check { flex: none; width: 18px; height: 18px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff; box-shadow: inset 0 0 0 1.5px var(--border-strong); }
.rt-tarea[data-ok] .rt-tarea__check, .rt-menu__tareas li[data-ok] .rt-tarea__check { background: var(--good); box-shadow: none; }
.rt-tarea__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-tarea__txt b { font-size: var(--fs-sm); color: var(--ink); }
.rt-tarea__txt small { font-size: var(--fs-meta); color: var(--dim); }
.rt-tarea[data-ok] .rt-tarea__txt b { color: var(--dim); text-decoration: line-through; }
.rt-tarjeta__cab { margin: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-tarjeta__n { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--dim); }
.rt-tarea__pro { color: var(--ink) !important; font-weight: 600; }
.rt-tarea__ok { font-size: var(--fs-meta); font-weight: 700; color: var(--good); }
.rt-tarea__donde { flex: none; border: 0; background: none; padding: 4px 0; font: inherit; font-size: var(--fs-meta); font-weight: 650; color: var(--dim); cursor: pointer; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; }
.rt-tarea__donde:hover { color: var(--ink); }
.rt-wa__ej { margin: 0; font-size: var(--fs-meta); color: var(--dim); line-height: 1.45; }
.rt-wa__btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 10px; background: #25D366; color: #08321A; font-weight: 700; font-size: var(--fs-sm); text-decoration: none; }
.rt-qr .rt-tarea__donde { align-self: flex-start; }
.rt-tarea__ico { flex: none; display: flex; color: var(--dim); margin-top: 2px; }
.rt-tarea__ops { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.rt-tarea__luego { border: 0; background: none; padding: 2px 0; font: inherit; font-size: var(--fs-meta); color: var(--dim); cursor: pointer; }
.rt-tarea__luego:hover { color: var(--ink); }
.rt-menu__flecha { flex: none; margin-left: auto; color: var(--dim); transition: transform .15s; }
.rt-menu__dia[data-abierto] .rt-menu__flecha { transform: rotate(180deg); }
.rt-pin { position: relative; display: inline-flex; }
.rt-pin__n { font-size: 11px; font-weight: 700; margin-left: 2px; }
.rt-pin__lista { position: absolute; top: calc(100% + 6px); right: 0; z-index: 30; width: 260px; padding: 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 8px 24px rgba(0,0,0,.14); }
.rt-pin__t { margin: 0 0 4px; font-size: 11px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: .04em; }
.rt-pin__item { display: flex; gap: 8px; align-items: center; width: 100%; padding: 6px; border: 0; border-radius: 8px; background: none; font: inherit; text-align: left; cursor: pointer; color: var(--ink); }
.rt-pin__item:hover { background: var(--surface-2, rgba(0,0,0,.05)); }
.rt-pin__item small { display: block; color: var(--dim); font-size: 11px; }
.rt-pin__msj { margin: 6px 0 0; font-size: 12px; color: var(--dim); }
@media (max-width: 520px) { .rt-tarea > .rt-tarea__ops { margin-left: 28px; flex-direction: row; align-items: center; gap: 14px; } }
.rt-md .rt-dia__msj { margin-top: 8px; }
.rt-hilo { width: 100%; margin-inline: 0; }
.rt-tarea__de { font-weight: 600; color: var(--dim); }
/* En una pantalla angosta, «dónde» y «Listo» van abajo del texto (20/11): al lado, el texto quedaba en una columna de tres palabras. */
@media (max-width: 520px) { .rt-tarea { flex-wrap: wrap; row-gap: 2px; } .rt-tarea__txt { flex-basis: calc(100% - 28px); } .rt-tarea > .rt-tarea__donde, .rt-tarea > .rt-tarea__ok, .rt-tarea > .rt-int__falta { margin-left: 28px; } }
.rt-qr__img { display: block; align-self: center; border-radius: 8px; background: #fff; padding: 6px; }
.rt-int__falta { flex: none; font-size: var(--fs-meta); font-weight: 650; color: var(--warn); }
.rt-int__ver { align-self: flex-start; text-align: left; }
.rt-clip__frase { width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px; max-height: 220px; field-sizing: content; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); line-height: 1.45; }
.rt-clip__frase:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.rt-clip__cuenta { margin: -2px 0 0; font-size: var(--fs-meta); color: var(--dim); font-variant-numeric: tabular-nums; }
.rt-clip__cuenta[data-pasada] { color: var(--warn); font-weight: 600; }
.rt-clip__btn { align-self: flex-start; height: 38px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--ink); color: var(--surface); font: inherit; font-size: var(--fs-sm); font-weight: 700; cursor: pointer; }
.rt-clip__btn:disabled { opacity: .45; cursor: default; }
.rt-clip__video { display: block; width: min(240px, 100%); aspect-ratio: 9 / 16; border-radius: var(--r-md); background: #0E1219; }
.rt-clip__error { margin: 0; font-size: var(--fs-meta); color: var(--bad, #C2410C); line-height: 1.45; }
.rt-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; }
.rt-hora { height: 38px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; }
.rt-hora[aria-checked="true"] { border-color: var(--primary); background: var(--primary-bg); color: var(--primary-strong, var(--primary)); box-shadow: inset 0 0 0 1px var(--primary); }
.rt-btn-wrap { position: relative; }
.rt-btn { display: inline-flex; align-items: center; gap: 10px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
.rt-btn[aria-expanded="true"] { background: var(--surface-2); }
.rt-btn__txt { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; line-height: 1; }
.rt-btn__txt b { font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.rt-btn__dia { font-size: 12px; font-weight: 700; color: var(--dim); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rt-segs { display: flex; gap: 2px; }
.rt-segs i, .rt-menu__segs i, .rt-menu__ley i { display: block; width: 11px; height: 4px; border-radius: 2px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border); }
.rt-segs i[data-e="hecho"], .rt-menu__segs i[data-e="hecho"], .rt-menu__ley i[data-e="hecho"] { background: var(--good); box-shadow: none; }
.rt-segs i[data-e="hoy"], .rt-menu__segs i[data-e="hoy"], .rt-menu__ley i[data-e="hoy"] { background: var(--mako, #F2B01E); box-shadow: none; }
.rt-segs i[data-e="medias"], .rt-menu__segs i[data-e="medias"], .rt-menu__ley i[data-e="medias"] { background: var(--warn); box-shadow: none; }
.rt-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 60; width: min(420px, calc(100vw - 24px)); max-height: min(620px, calc(100vh - 140px)); overflow: auto; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); box-shadow: 0 18px 44px rgba(23,21,17,.18); }
@media (max-width: 640px) { .rt-menu { position: fixed; top: 64px; left: 12px; right: 12px; width: auto; max-height: calc(100vh - 80px); } }
/* Angosto (375): las acciones a la derecha no entraban con el título. El «Reto de 7 días» del botón se esconde a la vista (el lector lo
   sigue leyendo) y quedan «Día N de 7», el catálogo y los fijados; el título del chat se corta con sus puntos. */
@media (max-width: 480px) { .rt-btn__txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } .rt-acciones { gap: 6px; } .rt-btn { padding: 0 10px; gap: 8px; } }
.rt-menu__cab { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 0; }
.rt-menu__t { margin: 0; font-weight: 700; font-size: var(--fs-card, 15px); }
.rt-menu__sub { margin: 4px 0 0; font-size: var(--fs-meta); line-height: 1.45; color: var(--dim); }
.rt-menu__cuenta { margin-left: auto; flex: none; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); font-size: 12px; color: var(--dim); white-space: nowrap; }
.rt-menu__cuenta b { font-size: 15px; color: var(--ink); }
.rt-menu__segs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 14px 16px 0; }
.rt-menu__segs i { width: auto; height: 8px; border-radius: 4px; }
.rt-menu__ley { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 8px 16px 6px; font-size: 11.5px; color: var(--dim); }
.rt-menu__ley span { display: inline-flex; align-items: center; gap: 6px; }
.rt-menu__ley i { width: 14px; height: 6px; }
.rt-menu__lista { list-style: none; margin: 0; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.rt-menu__dia { border-radius: 12px; }
.rt-menu__dia[data-abierto] { background: var(--surface-2); }
.rt-menu__fila { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 8px; border: 0; border-radius: 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rt-menu__n { flex: none; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; background: var(--surface); color: var(--dim); box-shadow: inset 0 0 0 1.5px var(--border-strong); }
.rt-menu__dia[data-e="hecho"] .rt-menu__n { background: var(--good); color: #fff; box-shadow: none; }
.rt-menu__dia[data-e="hoy"] .rt-menu__n { background: var(--mako, #F2B01E); color: #1a1405; box-shadow: none; }
.rt-menu__dia[data-e="medias"] .rt-menu__n { background: var(--warn); color: #fff; box-shadow: none; }
.rt-menu__q { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-menu__q b { font-size: var(--fs-sm); font-weight: 600; line-height: 1.3; }
.rt-menu__q small { font-size: 11.5px; font-weight: 600; color: var(--dim); }
.rt-menu__dia[data-e="hecho"] .rt-menu__q small { color: var(--good); }
.rt-menu__dia[data-e="medias"] .rt-menu__q small { color: var(--warn); }
.rt-menu__cuerpo { padding: 0 10px 12px 48px; display: flex; flex-direction: column; gap: 8px; }
.rt-btn__ico, .rt-btn__flecha { flex: none; color: var(--dim); }
.rt-btn[aria-expanded="true"] .rt-btn__flecha { transform: rotate(180deg); }
.rt-menu__video { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.rt-menu__video:hover { border-color: var(--border-strong); }
.rt-menu__video b { display: block; font-size: 12.5px; }
.rt-menu__video small { display: block; font-size: 11px; color: var(--dim); }
.rt-menu__play { flex: none; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: var(--ink); color: var(--surface); font-size: 10px; }
.rt-menu__luego { margin: 0; font-size: 12px; line-height: 1.45; color: var(--dim); }
.rt-menu__rot { margin: 2px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--faint); }
.rt-menu__tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rt-menu__tareas li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.35; }
.rt-menu__tareas li > span:last-child { display: flex; flex-direction: column; }
.rt-menu__tareas small { font-size: 11px; color: var(--faint); }
.rt-menu__tareas li[data-ok] > span:last-child { color: var(--dim); text-decoration: line-through; }
`;
