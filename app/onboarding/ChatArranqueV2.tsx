'use client';

// =============================================================================
// ChatArranqueV2 — EL ONBOARDING V2: el de la maqueta, en la app (19/11/2026)
// =============================================================================
// La especificación es la maqueta del artefacto (C:/dev/artefactos-onboarding/cuerpo.html → `capaOnboarding`, `filaMako`, `tarjeta`,
// `recuadro`, `caja`): el chat adentro de un BLOQUE (el del Ops Center) con la estrellita, «MaKo · Tu onboarding», el sol y la luna a
// la derecha y su barra de progreso; las preguntas con opciones en el recuadro de arriba de la caja; los errores rojos arriba de la
// caja. Martín, 19/11, probándolo en producción: «no está para nada igual… primero te pide el WhatsApp en lugar de preguntarte cómo te
// llamas… la criatura… es un circulito en lugar de la estrella… está el botón de ahora no… la barra de chat abajo… está como muy alta…
// si vas a poner varios videos tutoriales, mejor que sea uno solo, el que aparece al principio de todo, y si voy scrolleando… que se
// ponga chiquitito abajo a la derecha… apenas inicias MaKo… dale clic para iniciar, ahí nuevamente debería aparecer la animación de
// tipo tutorial donde se pone opaco y MaKo con los 3 puntitos… y ahí el primer mensaje que te envía es el video».
// Así queda:
//   · la entrada de siempre (./EntradaMako.tsx, «Hola, soy MaKo»: tócame para empezar) y, al tocarla, la pantalla se OSCURECE salvo
//     MaKo escribiendo (los tres puntitos); su primer mensaje es el VIDEO de bienvenida, UNO solo (al bajar, sigue chiquito abajo a la
//     derecha: VideoDelMomento → useVideoQueFlota);
//   · las preguntas y sus textos, los de la maqueta (lib/onboarding-arranque.ts → mensajesDeArranqueV2), en su orden: el nombre, el
//     WhatsApp con su código (sin «Ahora no»), el contacto de MaKo, el negocio, cómo llegó y qué resolver primero (hasta 3);
//   · la caja de escribir es la del Ops Center (app/_chat/CajaChat.tsx): una línea, con los emojis y el micrófono.
// Las reglas viven en lib/onboarding-arranque.ts; esto sólo dibuja. Lo usa app/onboarding/page.tsx cuando `vista.v2`.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { InterruptorModo } from '@/app/_components/InterruptorModo';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { CajaChat } from '@/app/_chat/CajaChat';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { CLAVE_ENTRADA_MOVIL } from '@/app/m/_ui/entrada';
import { AVISO_WHATSAPP_ABIERTO, E_TELEFONO_INCOMPLETO, RUTA_AL_RETO, avisoOtroNumero, codigoDeLoEscrito, primerNombre, reenviarAbreWhatsapp, type EtapaArranque, type MensajeArranque } from '@/lib/onboarding-arranque';
import type { VistaArranque } from '@/lib/onboarding-arranque-server';
import { EntradaMako } from './EntradaMako';
import { CriaturaMako, type Reaccion } from './CriaturaMako';
import { SeguirEnPc } from './ChatArranque';
import { tarjetaConNumero } from './arranque-ui';
import { iniciales } from '@/lib/unicode-seguro';
import { TarjetaContactoMako } from './TarjetaContactoMako';
import { esconderLaBarra } from '@/app/_ui/tutorial/barra-oculta';
import { senalAhora, senalarDondeTocar, soltarSenal } from '@/app/_ui/tutorial/store';
import { MS_SIN_PLAY, useMensajeDelVideo } from '@/app/_ui/tutorial/useMensajeDelVideo';
import { useBajarAlUltimo } from '@/app/_chat/useBajarAlUltimo';
import { useColaDeSalida, type FilaDeCola } from '@/app/_chat/useColaDeSalida';
import { MOMENTO_AGENDADO, MOMENTO_CODIGO, MOMENTO_NOMBRE } from '@/lib/onboarding-v2/momentos';
import { ejemploDe } from '@/lib/onboarding-v2/saltar';
import { senalConTope } from '@/lib/senal-con-tope';

type Respuesta = { ok?: boolean; error?: string; vista?: VistaArranque; aviso?: string; enCurso?: boolean; whatsapp?: VistaArranque['whatsapp'] };

async function llamar(cuerpo: Record<string, unknown>): Promise<Respuesta> {
  try {
    const r = await fetch('/api/onboarding/arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return (await r.json()) as Respuesta;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme. Prueba de nuevo.' };
  }
}

/** El orden de los pasos, para la barra de progreso (la maqueta: `PASOS_ONB`). */
const PASOS: readonly EtapaArranque[] = ['nombre', 'telefono', 'codigo', 'agendado', 'negocio', 'origen', 'interes', 'cierre', 'listo'];
/** Lo que dice la caja en cada paso (la maqueta: el `ph` de cada `pedir`). */
const PH: Partial<Record<EtapaArranque, string>> = {
  nombre: 'Tu nombre', telefono: 'Tu WhatsApp, con el código de país', codigo: 'El código de 6 números', agendado: 'Sí o no',
  negocio: 'El nombre de tu negocio', origen: 'Cómo llegaste', interes: 'Elige hasta 3 o escríbelo con tus palabras', cierre: 'Un momento…',
};
/** Cuánto dura la pantalla oscura con MaKo escribiendo, antes de su primer mensaje (el video). */
const MS_ESCRIBE = 1800;
// Los puntitos antes de un mensaje que espera su video, la espera sin video y sin play: app/_ui/tutorial/useMensajeDelVideo.ts.
/** Con los 6 números en el campo del código, cuánto se espera para confirmarlo solo (la maqueta, `programarCodigo`). */
const MS_CODIGO_SOLO = 900;
/** La clave del video de bienvenida (public/tutoriales, el chat de los videos). */
const VIDEO_BIENVENIDA = 'onboarding-bienvenida';
/** El del WhatsApp: la segunda mitad del video de bienvenida, que se cortó en dos (19/11), con su primera frase nueva
 *  («Tu WhatsApp es por donde MaKo…»; scripts/tutorial-animado/pantallas-onboarding/frase-nueva.mjs).
 *  Va como mensaje de MaKo justo antes del paso del código, donde está «Abrir WhatsApp». No es `onboarding-whatsapp` (el de la pantalla vieja). */
const VIDEO_WHATSAPP = 'onboarding-bienvenida-whatsapp';
const MENSAJE_DEL_CODIGO = MOMENTO_CODIGO.mensaje;
const MENSAJE_AGENDADO = MOMENTO_AGENDADO.mensaje;
/** El video del WhatsApp, un mensaje más de la cola: antes del mensaje del código. */
const FILA_VIDEO_WHATSAPP = 'arr-video-whatsapp';
/** Una fila de la cola de salida: un mensaje del onboarding, o el video del WhatsApp (`m` null). */
type FilaV2 = FilaDeCola & { m: MensajeArranque | null };
/** Lo que ya salió, por persona y en este navegador (onboarding-6: al recargar, la pregunta del nombre se dibuja de una). */
const huellaDe = (s: string): string => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const leerSalidos = (clave: string): string[] => { try { return (localStorage.getItem(clave) ?? '').split(',').filter(Boolean); } catch { return []; } };
const anotarSalido = (clave: string, id: string): void => {
  try { const ya = leerSalidos(clave); if (!ya.includes(id)) localStorage.setItem(clave, [...ya, id].slice(-40).join(',')); } catch { /* sin storage */ }
};
/** «Abrir WhatsApp», marcado con el velo del tutorial cuando llega su mensaje (el Cerebro, 20/11: «igual que en el recorrido»). */
const SEL_ABRIR_WHATSAPP = '[data-abrir-whatsapp]';
const PASO_ABRIR_WHATSAPP = {
  sel: SEL_ABRIR_WHATSAPP, titulo: 'Abrir WhatsApp', lado: 'derecha' as const, haz: 'Toca «Abrir WhatsApp»',
  texto: 'Manda el mensaje que ya va escrito: MaKo te contesta con un código y lo pegas aquí.',
};

const horaDe = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });

export function ChatArranqueV2({ inicial, seguirEnPc = false, persona, ejemplos = false }: {
  inicial: VistaArranque;
  /** LA REVISIÓN (20/11/2026): las respuestas de ejemplo de la maqueta, un toque y avanza. Lo decide la PÁGINA con la puerta
   *  (`puedeVerLaRevision`: alguien de MaKo en un negocio de prueba); sin ella, nada. Nunca a un cliente. */
  ejemplos?: boolean;
  /** En un teléfono: el primer paso acá y «Continuar el onboarding desde la PC» al final (18/11). Lo decide la página. */
  seguirEnPc?: boolean;
  persona?: { nombre: string; email: string };
}) {
  const [vista, setVista] = useState<VistaArranque>(inicial);
  // EL TELÉFONO (18/11: la PC es obligatoria para lo que sigue): lo dice la página o, si no lo supo, el ancho de la pantalla (la maqueta
  // decide por el ancho). Se mide después de montar, para no dibujar distinto que el servidor.
  const [enTelefono, setEnTelefono] = useState(seguirEnPc);
  useEffect(() => {
    if (seguirEnPc) return;
    try { if (window.matchMedia('(max-width: 640px)').matches) setEnTelefono(true); } catch { /* sin matchMedia: la PC */ }
  }, [seguirEnPc]);
  // EL VIDEO DE BIENVENIDA, sólo si existe de verdad (public/tutoriales, su manifiesto). Nunca un «no está grabado» en su lugar.
  const videoBienvenida = useVideoTutorial(VIDEO_BIENVENIDA);
  const videoWhatsapp = useVideoTutorial(VIDEO_WHATSAPP);
  // La entrada va UNA vez, al principio de todo; después, la pantalla oscura con MaKo escribiendo y su primer mensaje: el video.
  const empieza = !inicial.introVista && inicial.etapa === 'nombre';
  const [fase, setFase] = useState<'intro' | 'escribe' | 'chat'>(empieza ? 'intro' : 'chat');
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gesto, setGesto] = useState<Reaccion | null>(null);
  const [enPc, setEnPc] = useState(false);
  const gestoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reaccionar = (r: Reaccion, ms: number) => {
    setGesto(r);
    if (gestoTimer.current) clearTimeout(gestoTimer.current);
    gestoTimer.current = setTimeout(() => setGesto(null), ms);
  };
  useEffect(() => () => { if (gestoTimer.current) clearTimeout(gestoTimer.current); }, []);

  const aplicar = (r: Respuesta): boolean => {
    if (r.vista) setVista(r.vista);
    if (r.ok === false) { setError(r.error ?? 'No se pudo guardar. Prueba de nuevo.'); return false; }
    setAviso(r.aviso ?? null);
    return true;
  };
  const releer = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/onboarding/arranque')).json()) as Respuesta;
      if (j.vista) setVista(j.vista);
    } catch { /* la próxima respuesta la trae */ }
  }, []);

  // ── Lo que se manda ──────────────────────────────────────────────────────
  const etapa = vista.etapa;
  const mensajes = vista.antes;
  const ultimoMako = useMemo(() => [...mensajes].reverse().find((m) => m.de === 'mako') ?? null, [mensajes]);
  const pregunta = ultimoMako?.texto;

  const accion = async (cuerpo: Record<string, unknown>, mostrar: string | null = null): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    setError(null);
    setAviso(null);
    setPendiente(mostrar);
    cola.empezoLaEspera();
    try {
      const salio = aplicar(await llamar(cuerpo));
      reaccionar(salio ? 'contenta' : 'duda', salio ? 1200 : 1600);
      return salio;
    } finally {
      setOcupado(false);
      setPendiente(null);
    }
  };
  const responder = (cuerpo: Record<string, unknown>, mostrar: string | null) => accion({ action: 'responder', ...cuerpo, ...(pregunta ? { pregunta } : {}) }, mostrar);

  // «REENVIAR EL CÓDIGO» FUERA DE LAS 24 H (20/11, wa-f3): MaKo ya no puede escribirle, así que abre WhatsApp con el mensaje ya escrito
  // (la maqueta, `abrirWhatsapp()`). Se sabe recién con la respuesta: desde ahí, «Reenviar» es el link mismo (`reescribir`). Si el
  // navegador frena la ventana (se abre después del pedido), «Abrir WhatsApp» se marca y el error dice qué tocar.
  const [reescribir, setReescribir] = useState(false);
  const [resaltarWa, setResaltarWa] = useState(false);
  const reenviar = async () => {
    if (ocupado) return;
    const link = vista.whatsapp?.link ?? null;
    setOcupado(true);
    setError(null);
    setAviso(null);
    setResaltarWa(false);
    try {
      const r = await llamar({ action: 'reenviar' });
      if (r.ok === false && reenviarAbreWhatsapp(r.error) && link) {
        if (r.vista) setVista(r.vista);
        setReescribir(true);
        const ventana = window.open(link, '_blank');
        if (ventana) { try { ventana.opener = null; } catch { /* otra ventana */ } setAviso(AVISO_WHATSAPP_ABIERTO); }
        else { setResaltarWa(true); setError(r.error ?? null); }
        return;
      }
      reaccionar(aplicar(r) ? 'contenta' : 'duda', 1400);
    } finally {
      setOcupado(false);
    }
  };

  // La respuesta de ejemplo de la pregunta que se escribe (el nombre, el negocio), sólo en la revisión: un toque la manda.
  const ejemplo = ejemplos ? ejemploDe(etapa) : null;
  const mandarEjemplo = (t: string) => {
    if (ocupado || etapa === 'listo' || etapa === 'cierre') return;
    primeroListo();
    cola.mostrarYa([MOMENTO_NOMBRE.mensaje]);
    void responder({ texto: t }, t);
  };

  const mandarTexto = () => {
    const t = texto.trim();
    if (!t || ocupado || etapa === 'listo' || etapa === 'cierre') return;
    setTexto('');
    // Contestó antes de que saliera la pregunta: la pregunta queda dibujada, sin puntitos.
    primeroListo();
    cola.mostrarYa([MOMENTO_NOMBRE.mensaje]);
    // El teléfono y el código escritos en la caja valen igual que los de su tarjeta (la ruta los reconoce).
    void responder({ texto: t }, t).then((ok) => { if (!ok) setTexto(t); });
  };

  // ── Lo que pasa solo ─────────────────────────────────────────────────────
  // La pantalla oscura con MaKo escribiendo, y su primer mensaje: el video.
  useEffect(() => {
    if (fase !== 'escribe') return;
    const t = window.setTimeout(() => setFase('chat'), MS_ESCRIBE);
    return () => window.clearTimeout(t);
  }, [fase]);
  // ¿LLEGÓ DE OTRO NÚMERO? (20/11, wa-04): como el V1 (ChatArranque.tsx), mientras espera se pregunta cada 4 s, con la pestaña a la
  // vista. El código lo confirma ella; esto sólo trae el estado del WhatsApp (el 'otro-numero' que anota el servidor).
  const esperandoWhatsapp = etapa === 'codigo' && (vista.whatsapp?.estado === 'esperando' || vista.whatsapp?.estado === 'otro-numero');
  useEffect(() => {
    if (!esperandoWhatsapp) return;
    let vivo = true;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      void llamar({ action: 'whatsapp' }).then((r) => {
        if (!vivo) return;
        if (r.vista) setVista(r.vista);
        else if (r.whatsapp !== undefined) setVista((v) => ({ ...v, whatsapp: r.whatsapp ?? null }));
      });
    }, 4000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [esperandoWhatsapp]);
  // El centro del barrido: la fila de MaKo escribiendo (OA-13).
  const velo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (fase !== 'escribe') return;
    const fila = document.querySelector<HTMLElement>('.arr-v2 .arr-v2__resalte');
    const v = velo.current;
    if (!fila || !v) return;
    const r = fila.getBoundingClientRect();
    v.style.setProperty('--iris-x', `${Math.round(r.left + 22)}px`);
    v.style.setProperty('--iris-y', `${Math.round(r.top + r.height / 2)}px`);
  }, [fase]);
  // EL PRIMER MENSAJE, A SU TIEMPO (Martín, 19/11: «no está bueno de que apenas se me manda el video y automáticamente se me manda el
  // mensaje de abajo… que salga cuando corresponda, con los tres puntitos»). Al empezar, el video va solo. Quien vuelve a mitad del
  // onboarding lo ve todo de una; quien vuelve con el nombre TODAVÍA sin contestar, igual que la primera vez (OA-02).
  // TODO MENSAJE QUE NOMBRA ALGO DEL VIDEO SALE CUANDO LA VOZ LLEGA AHÍ (20/11, tarde: el Cerebro, con lo que vio Martín; la regla y sus
  // desvíos en app/_ui/tutorial/useMensajeDelVideo.ts, los momentos en lib/onboarding-v2/momentos.ts). Con MaKo escribiendo antes; y
  // si el video no corre (sin play a los MS_SIN_PLAY, pausado, terminado, con error o sin video), sale igual:
  //   · la primera pregunta, cuando la bienvenida dice «unas preguntas cortas…» (tocar la caja también la suelta);
  //   · el mensaje del código, cuando el video del WhatsApp dice «toca Abrir WhatsApp» (antes salía junto con el video);
  //   · «¿Guardaste el contacto de MaKo?», si el video sigue corriendo, cuando dice «guarda el contacto» (si no corre, enseguida).
  const filaBienvenida = useRef<HTMLDivElement>(null);
  const filaWhatsapp = useRef<HTMLDivElement>(null);
  const yaEstaba = (id: string) => inicial.antes.some((m) => m.id === id);
  const { fase: primero, soltar: soltarPrimero, listo: primeroListo } = useMensajeDelVideo({
    lugar: filaBienvenida, activo: fase === 'chat', inicial: inicial.etapa === 'nombre' ? 'espera' : 'listo',
    clave: VIDEO_BIENVENIDA, dice: MOMENTO_NOMBRE.dice, esperaPlay: MS_SIN_PLAY,
  });
  // El momento del código se espera con el video del WhatsApp ya dibujado (sale por la cola, con sus puntitos): antes, su fila no
  // existe y no hay a quién oír. Sin video en el manifiesto, se espera sin él (sale a los MS_SIN_VIDEO).
  const [conVideoWa, setConVideoWa] = useState(() => yaEstaba(MENSAJE_DEL_CODIGO));
  const { fase: codigoFase } = useMensajeDelVideo({
    lugar: filaWhatsapp, activo: mensajes.some((m) => m.id === MENSAJE_DEL_CODIGO) && (conVideoWa || !videoWhatsapp), inicial: yaEstaba(MENSAJE_DEL_CODIGO) ? 'listo' : 'espera',
    clave: VIDEO_WHATSAPP, dice: MOMENTO_CODIGO.dice, esperaPlay: MS_SIN_PLAY,
  });
  const { fase: agendadoFase } = useMensajeDelVideo({
    lugar: filaWhatsapp, activo: mensajes.some((m) => m.id === MENSAJE_AGENDADO), inicial: yaEstaba(MENSAJE_AGENDADO) ? 'listo' : 'espera',
    clave: VIDEO_WHATSAPP, dice: MOMENTO_AGENDADO.dice, esperaPlay: 0,
  });
  // LA COLA DE SALIDA (20/11, la auditoría de los chats, onboarding-3 y 4: app/_chat/useColaDeSalida.ts). Los mensajes de MaKo salen de a
  // uno, con puntitos según su largo (contando lo que tardó el servidor), y su tarjeta, recuadro o botón después de una pausa. El
  // video del WhatsApp es un mensaje más, antes del código. Lo que ya estaba al abrir se dibuja de una; la pregunta del nombre, también
  // si ya había salido en este navegador (onboarding-6, decidido: al recargar, lo ya mostrado se dibuja de una).
  const filas = useMemo<FilaV2[]>(() => {
    const out: FilaV2[] = [];
    for (const m of mensajes) {
      if (m.id === MENSAJE_DEL_CODIGO && videoWhatsapp) out.push({ id: FILA_VIDEO_WHATSAPP, de: 'mako', texto: '', m: null });
      out.push({ id: m.id, de: m.de, texto: m.texto, pieza: m.de === 'mako' && (!!m.tarjeta || !!m.opciones?.length), m });
    }
    return out;
  }, [mensajes, videoWhatsapp]);
  const claveSalidos = `mk-onb-salidos:${huellaDe(persona?.email || '')}`;
  const cola = useColaDeSalida(filas, {
    historial: () => {
      const ids = inicial.antes.map((m) => m.id).filter((id) => !(inicial.etapa === 'nombre' && id === MOMENTO_NOMBRE.mensaje));
      return yaEstaba(MENSAJE_DEL_CODIGO) ? [...ids, FILA_VIDEO_WHATSAPP] : ids;
    },
    // Lo que espera su momento del video: sin puntitos hasta que la voz llega ahí (o se suelta por un desvío).
    retenido: (id) => (id === MOMENTO_NOMBRE.mensaje && primero !== 'listo') || (id === MENSAJE_DEL_CODIGO && codigoFase !== 'listo')
      || (id === MENSAJE_AGENDADO && agendadoFase !== 'listo'),
    alMostrar: (id) => { if (id === MOMENTO_NOMBRE.mensaje) anotarSalido(claveSalidos, id); },
  });
  // Al recargar con la pregunta del nombre ya salida en este navegador: de una (el servidor no lo sabe; por eso, después de hidratar).
  useEffect(() => {
    if (inicial.etapa !== 'nombre' || !leerSalidos(claveSalidos).includes(MOMENTO_NOMBRE.mensaje)) return;
    primeroListo();
    cola.mostrarYa([MOMENTO_NOMBRE.mensaje]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cola.visibles.some((f) => f.id === FILA_VIDEO_WHATSAPP)) setConVideoWa(true); }, [cola.visibles]);
  // Con el mensaje del código, el velo del tutorial marca «Abrir WhatsApp» (como en el recorrido). Sólo cuando llega ahora (quien vuelve
  // ya lo vio) y sólo si el botón está: sin link va «Volver a intentarlo», y una marca sin lugar espera para siempre. Se va al tocarlo,
  // con «Lo hago después», o cuando el paso termina.
  const marcaWa = useRef(0);
  const codigoEnVivo = useRef(!yaEstaba(MENSAJE_DEL_CODIGO));
  const tarjetaDelCodigo = cola.conPieza(MENSAJE_DEL_CODIGO);
  useEffect(() => {
    if (!tarjetaDelCodigo || etapa !== 'codigo' || !codigoEnVivo.current) return;
    const r = window.requestAnimationFrame(() => {
      if (!codigoEnVivo.current || !document.querySelector(SEL_ABRIR_WHATSAPP)) return;
      codigoEnVivo.current = false;
      const fuera = () => { marcaWa.current = 0; };
      marcaWa.current = senalarDondeTocar(PASO_ABRIR_WHATSAPP, fuera, { alOmitir: fuera });
    });
    return () => window.cancelAnimationFrame(r);
  }, [tarjetaDelCodigo, etapa]);
  useEffect(() => {
    if (etapa === 'codigo' || !marcaWa.current) return;
    soltarSenal(marcaWa.current);
    marcaWa.current = 0;
  }, [etapa]);
  useEffect(() => () => { if (marcaWa.current) soltarSenal(marcaWa.current); }, []);
  // Con todo contestado, se cierra el onboarding (por detrás, como siempre).
  const cerrando = useRef(false);
  useEffect(() => {
    if (etapa !== 'cierre' || cerrando.current) return;
    cerrando.current = true;
    void (async () => {
      const r = await llamar({ action: 'cerrar' });
      if (r.enCurso) { window.setTimeout(() => { cerrando.current = false; void releer(); }, 3000); return; }
      if (!aplicar(r)) { cerrando.current = false; return; }
      void fetch('/api/onboarding/plan-arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    })();
  }, [etapa, releer]);

  // ENTRAR (20/11, Martín, en producción): al Ops Center con el chat «Reto de 7 días» ya elegido. La llegada (el video del recorrido con su
  // «dale play») es el primer mensaje de ese chat (app/second-brain/LlegadaAlReto.tsx). El chat «Onboarding» se sigue creando: guarda la
  // conversación.
  const ws = useWs();
  const [entrando, setEntrando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const entrar = useCallback(async () => {
    if (entrando) return;
    setEntrando(true);
    // El chat «Onboarding» con la conversación (lo crea la ruta; si falla, se entra igual).
    await fetch('/api/onboarding/arranque', {
      // `senalConTope` y no AbortSignal.timeout (20/11, el inventario): un Safari de antes del 16 no lo tiene, tiraba antes del fetch y el
      // botón quedaba en «Entrando…» para siempre.
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hilo' }), signal: senalConTope(20_000),
    }).catch(() => null);
    setSaliendo(true);
    // Un video del onboarding que sigue corriendo NO pasa flotando al Ops Center (20/11, OD-13): flotaba, y el recorrido no arrancaba.
    for (const v of Array.from(document.querySelectorAll<HTMLVideoElement>('.arr-v2 video'))) v.pause();
    // Y el que YA flotaba en la esquina (20/11, tarde, la segunda verificación de OD-13): vive en un portal a <body>, fuera de `.arr-v2`,
    // y la pausa de arriba no lo toca. Se cierra su señal: si no, seguía flotando en el Ops Center.
    const flotando = senalAhora();
    if (flotando?.tipo === 'video') soltarSenal(flotando.id);
    // La barra lateral, escondida hasta que el recorrido la presente (Martín, 19/11: app/_ui/tutorial/barra-oculta.ts).
    esconderLaBarra();
    // ⚠️ NAVEGACIÓN ENTERA, NUNCA router.push (20/11/2026, el bucle de «Entrar a MaKo» en producción, reproducido por el Cerebro): con
    // el onboarding pendiente, algo de esta página prefetcheó /second-brain, el servidor contestó «a /onboarding» y eso quedó en el Router
    // Cache del navegador. router.push lo reusaba (aunque cambien los parámetros) y la app y el onboarding se mandaban uno al otro ~5
    // minutos, hasta que vencía el prefetch. Una carga entera no mira ese caché.
    window.location.assign(conWs(RUTA_AL_RETO, ws));
  }, [entrando, ws]);

  // ── El hilo ──────────────────────────────────────────────────────────────
  // La hora de cada mensaje: la de cuando apareció en esta pantalla.
  const horas = useRef(new Map<string, string>());
  const horaDel = (id: string) => {
    if (!horas.current.has(id)) horas.current.set(id, horaDe(new Date()));
    return horas.current.get(id) ?? '';
  };
  const hilo = useRef<HTMLDivElement>(null);
  const seguirHilo = useCallback(() => hilo.current, []);
  // SIEMPRE AL ÚLTIMO MENSAJE (Martín, 20/11: «para que el usuario sepa dónde están las cosas»). Por la CLAVE de la última fila dibujada
  // (la auditoría, onboarding-1: con una cuenta, al contestar entraban dos mensajes y se iban los puntitos y lo pendiente en el mismo
  // render, y el hilo no bajaba), sin animación y la primera vez antes de pintar (onboarding-7). Lo que crece o se achica (la tarjeta, el
  // recuadro o el error arriba de la caja) lo sigue el ResizeObserver mientras está abajo (app/_chat/useBajarAlUltimo.ts).
  const ultimaFila = cola.visibles[cola.visibles.length - 1];
  const escribe = ocupado || cola.escribiendo || etapa === 'cierre';
  useBajarAlUltimo(seguirHilo, `${fase}|${ultimaFila?.id ?? ''}|${ultimaFila && cola.conPieza(ultimaFila.id) ? 'pieza' : ''}|${pendiente ?? ''}|${escribe ? 'escribe' : ''}`);

  // La inicial con `iniciales` (lib/unicode-seguro.ts): la primera letra suelta de «🔥 Alex» es media pieza de un emoji y tira la pantalla al hidratar.
  const letra = iniciales(persona?.nombre || vista.nombre, 1, '·');
  const estrella = (r: Reaccion = 'escucha') => <span className="arr-v2__foto" aria-hidden="true"><CriaturaMako size={26} reaccion={r} /></span>;
  const filaMako = (key: string, cuerpo: ReactNode, o: { conHora?: boolean; resaltar?: boolean; lugar?: Ref<HTMLDivElement> } = {}) => (
    <div key={key} ref={o.lugar} className={`co-el-wa co-wa${o.resaltar ? ' arr-v2__resalte' : ''}`}>
      <div className="co-el">{estrella()}<div className="co-el__cuerpo">{cuerpo}{o.conHora !== false && <p className="co-el__rotulo" suppressHydrationWarning>{horaDel(key)}</p>}</div></div>
    </div>
  );
  const filaYo = (key: string, t: string) => (
    <div key={key} className="co-yo co-wa co-wa--yo">
      <div className="ch-plegable"><p className="co-burbuja">{t}<span className="co-burbuja__pie" suppressHydrationWarning>{horaDel(key)}</span></p></div>
      <span className="co-mifoto arr-v2__mifoto" aria-hidden="true"><span>{letra}</span></span>
    </div>
  );
  const escribiendo = (key: string, resaltar = false) => filaMako(key,
    <span role="status" aria-label="MaKo está escribiendo" className="of-escribiendo"><i /><i /><i /></span>, { conHora: false, resaltar });

  const tarjeta = (m: MensajeArranque): ReactNode => {
    // El contacto de MaKo (con el WhatsApp ya confirmado) es parte de la conversación: queda, aunque MaKo siga hablando.
    if (m.tarjeta === 'contacto') return <TarjetaContactoMako />;
    if (m.id !== ultimoMako?.id) return null;
    if (m.tarjeta === 'telefono') return <TarjetaTelefono inicial={vista.telefonoDelPago} ocupado={ocupado}
      onSeguir={(tel, visible) => void accion({ action: 'telefono', telefono: tel, visible }, visible)} onIncompleto={() => setError(E_TELEFONO_INCOMPLETO)} />;
    if (m.tarjeta === 'codigo') {
      return <TarjetaCodigo vista={vista} ocupado={ocupado}
        onConfirmar={(c) => responder({ texto: c }, null)}
        onCambiar={() => void accion({ action: 'cambiar-numero' })}
        onReenviar={() => void reenviar()} reescribir={reescribir} resaltarWa={resaltarWa}
        onAbrioWhatsapp={() => { setError(null); setResaltarWa(false); setAviso(AVISO_WHATSAPP_ABIERTO); }}
        onUsarOtro={() => void accion({ action: 'usar-otro-numero' })}
        onReintentar={() => void accion({ action: 'telefono' })} />;
    }
    if (m.tarjeta === 'listo') {
      return (
        <div className="arr-links">
          {enTelefono
            ? <button type="button" onClick={() => setEnPc(true)} className="arr-link arr-link--principal">Continuar el onboarding desde la PC</button>
            : <button type="button" onClick={() => void entrar()} disabled={entrando} className="arr-link arr-link--principal">{entrando ? 'Entrando…' : 'Entrar a MaKo'}</button>}
        </div>
      );
    }
    return null;
  };

  const progreso = Math.max(0, PASOS.indexOf(etapa)) / (PASOS.length - 1);
  // El recuadro, con su mensaje y después de su pausa (la cola: onboarding-3).
  const enRecuadro = fase === 'chat' && !ocupado && ultimoMako?.opciones?.length && ultimoMako.recuadro && cola.conPieza(ultimoMako.id) ? ultimoMako : null;
  // Lo marcado y lo escrito de cada pregunta, aquí y no en el recuadro: se desmonta mientras envía, y si el envío falla vuelve con esto.
  const borradores = useRef(new Map<string, Borrador>());
  const guardarBorrador = (id: string) => (b: Borrador) => { borradores.current.set(id, b); };
  // La segunda pregunta del contacto («Guárdalo cuando puedas…») no se contesta con sí o no (20/11, OA-F2: la maqueta, «Ya lo guardé»).
  const enAgendadoNo = etapa === 'agendado' && mensajes.some((m) => m.id === 'arr-agendado-no');
  const placeholder = etapa === 'listo' ? (enTelefono ? 'Toca «Continuar el onboarding desde la PC»' : 'Toca «Entrar a MaKo»') : enAgendadoNo ? 'Ya lo guardé' : PH[etapa] ?? 'Escribe a MaKo';

  return (
    <div className={`arr-capa arr-v2${saliendo ? ' arr-capa--sale' : ''}`}>
      <style>{CSS_V2}</style>
      {/* El nombre que contestó en el chat, no el de la cuenta (20/11, OA-11). */}
      {enPc && <SeguirEnPc nombre={primerNombre(vista.nombre || persona?.nombre || '')} email={persona?.email ?? ''} maqueta />}
      <main className="arr-cuerpo">
        <div className="arr-v2__bloque">
          <header className="arr-v2__cab">
            <span data-mako-foto="" className="arr-foto" style={{ opacity: fase === 'intro' ? 0 : 1 }}>
              <CriaturaMako size={36} reaccion={ocupado ? 'piensa' : gesto ?? 'escucha'} />
            </span>
            <span className="arr-titulos"><span className="arr-nombre">MaKo</span><span className="arr-sub">Tu onboarding</span></span>
            <span className="arr-v2__der" style={{ visibility: fase === 'intro' ? 'hidden' : 'visible' }}><InterruptorModo variante="sitio" /></span>
          </header>
          <div className="arr-v2__prog" role="progressbar" aria-label="Cuánto falta de tu onboarding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)} data-listo={progreso >= 1 ? '' : undefined}>
            <i style={{ width: `${Math.max(3, Math.round(progreso * 100))}%` }} />
          </div>
          <div className="co-hilo" ref={hilo}>
            <div className="co-hilo__col">
              <span className="co-dia">Hoy</span>
              {fase === 'escribe' && escribiendo('arr-escribe', true)}
              {fase === 'chat' && (
                <>
                  {/* UN solo video, el de la bienvenida, como primer mensaje (Martín, 19/11). Al bajar, sigue chiquito abajo a la derecha. */}
                  {videoBienvenida && filaMako('arr-video', <VideoDelMomento clave={VIDEO_BIENVENIDA} titulo="Bienvenida a MaKo" revision={false} dalePlay />, { lugar: filaBienvenida })}
                  {/* Lo que salió por la cola (app/_chat/useColaDeSalida.ts): de a uno, con sus puntitos, y la pieza después de su pausa. El
                      video del WhatsApp, su propio mensaje antes del código (Martín, 19/11: «que tenga cortes como los pasos»), con su «dale
                      play» (ya no sale junto a la tarjeta del código: la tarjeta llega cuando la voz nombra el botón). */}
                  {cola.visibles.map((f) => {
                    if (f.id === FILA_VIDEO_WHATSAPP) return filaMako(f.id, <VideoDelMomento clave={VIDEO_WHATSAPP} titulo="Tu WhatsApp con MaKo" revision={false} dalePlay />, { lugar: filaWhatsapp });
                    const m = f.m!;
                    if (m.de === 'yo') return filaYo(m.id, m.texto);
                    const t = cola.conPieza(m.id) ? tarjeta(m) : null;
                    // La tarjeta del contacto de MaKo es SU mensaje (20/11/2026: en su propia burbuja): sin el texto, sólo la tarjeta.
                    if (m.tarjeta === 'contacto') return t ? filaMako(m.id, <div className="arr-v2__en-mensaje">{t}</div>) : null;
                    return filaMako(m.id, <><div className="ch-md"><p>{m.texto}</p></div>{t && <div className="arr-v2__en-mensaje">{t}</div>}</>);
                  })}
                  {pendiente && filaYo('arr-pendiente', pendiente)}
                  {escribe && escribiendo('arr-pensando')}
                </>
              )}
            </div>
          </div>
          <div className="co-caja-wrap">
            {error && (
              <div className="arr-v2__error" role="alert">
                <span className="arr-v2__error-ico" aria-hidden="true">!</span>
                <span className="arr-v2__error-t">{error}</span>
                <button type="button" onClick={() => setError(null)} aria-label="Cerrar el aviso">✕</button>
                <ReportarASoporte />
              </div>
            )}
            {aviso && !error && <p className="arr-v2__aviso" role="status">{aviso}</p>}
            {enRecuadro && <Recuadro key={enRecuadro.id} m={enRecuadro} ocupado={ocupado}
              inicial={borradores.current.get(enRecuadro.id)} onBorrador={guardarBorrador(enRecuadro.id)}
              onUna={(i) => void responder({ opcion: i, opcionTexto: enRecuadro.opciones![i] }, enRecuadro.opciones![i])}
              onVarias={(vs) => void responder({ opciones: vs }, vs.join(' · '))}
              onOtra={(t) => void responder({ texto: t }, t)} />}
            {ejemplo && fase === 'chat' && !ocupado && (
              <div className="arr-v2__ejemplos" role="group" aria-label="Respuesta de ejemplo de la revisión">
                <span>Revisión · respuesta de ejemplo:</span>
                <button type="button" className="arr-v2__ejemplo" onClick={() => mandarEjemplo(ejemplo)}>{ejemplo}</button>
              </div>
            )}
            {/* La caja del Ops Center, la de una línea (Martín, 19/11: «la barra de chat abajo… está como muy alta»). */}
            <div className={`co-caja${etapa === 'listo' && enTelefono ? ' arr-v2__caja--dos' : ''}`} onFocusCapture={soltarPrimero} onPointerDownCapture={soltarPrimero}>
              <CajaChat texto={texto} onTexto={(v) => { setError(null); setTexto(v); }} onMandar={mandarTexto} placeholder={placeholder} enterManda
                ocupado={ocupado} apagado={fase !== 'chat' || etapa === 'listo' || etapa === 'cierre'} sinAdjuntos onErrorMic={(m) => setError(m)} />
            </div>
          </div>
        </div>
      </main>
      {/* La pantalla oscura del tutorial, salvo MaKo escribiendo (Martín, 19/11: «se pone opaco y MaKo con los 3 puntitos»). */}
      {fase === 'escribe' && <div ref={velo} className="arr-v2__velo" aria-hidden="true" />}
      {fase === 'intro' && <EntradaMako onFin={() => {
        setFase('escribe');
        try { sessionStorage.setItem(CLAVE_ENTRADA_MOVIL, '1'); } catch { /* sin storage */ }
        void llamar({ action: 'intro' });
      }} />}
    </div>
  );
}

/** El WhatsApp, con su lada (la maqueta: el campo de la app y «Seguir» negro, de lado a lado). */
function TarjetaTelefono({ inicial, ocupado, onSeguir, onIncompleto }: {
  inicial: string; ocupado: boolean; onSeguir: (telefono: string, visible: string) => void; onIncompleto: () => void;
}) {
  const [lada, setLada] = useState(() => tarjetaConNumero(inicial).lada);
  const [numero, setNumero] = useState(() => tarjetaConNumero(inicial).numero);
  // «Seguir» SIEMPRE activo (20/11, OA-15: la maqueta): con menos dígitos, el error rojo dice qué falta, en vez de un botón apagado.
  const seguir = () => {
    if (ocupado) return;
    if (numero.replace(/\D/g, '').length < 6) { onIncompleto(); return; }
    // Lo que se manda va en dígitos; la burbuja lo muestra como lo escribió, con la lada y sus espacios (OA-F1).
    onSeguir(`${lada}${numero.replace(/\D/g, '')}`.replace(/\D/g, ''), `${lada} ${numero.trim()}`);
  };
  return (
    <div className="arr-tarjeta">
      {/* Sin un ejemplo fijo (20/11, el inventario): era argentino con México por defecto; TelefonoConPais lo arma por país. */}
      <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={setNumero} onEnter={seguir} inputStyle={CAMPO} />
      <Button variant="primary" size="sm" full disabled={ocupado} loading={ocupado} onClick={seguir}>Seguir</Button>
    </div>
  );
}

/**
 * EL CÓDIGO (la maqueta, `tarjeta('codigo')`): «Abrir WhatsApp» en el verde de WhatsApp abre su chat con MaKo con el pedido escrito;
 * MaKo le contesta con el código y lo pega acá. Debajo, cambiar el número o pedir que se lo reenvíe. Sin «Pega aquí el código» ni
 * «Pegar» (Martín, 19/11: «elimina también, pega aquí el código… elimina el botón que dice pegar»): el mensaje de arriba ya lo dice.
 */
function TarjetaCodigo({ vista, ocupado, reescribir, resaltarWa, onConfirmar, onCambiar, onReenviar, onAbrioWhatsapp, onUsarOtro, onReintentar }: {
  vista: VistaArranque; ocupado: boolean;
  /** MaKo ya no puede escribirle (pasaron 24 h): «Reenviar» abre WhatsApp. `resaltarWa`: el navegador frenó la ventana. */
  reescribir: boolean; resaltarWa: boolean;
  onConfirmar: (codigo: string) => Promise<boolean>; onCambiar: () => void; onReenviar: () => void; onAbrioWhatsapp: () => void;
  onUsarOtro: () => void; onReintentar: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  /** El código que ya se mandó solo: no se manda dos veces el mismo (se vuelve a mandar con «Confirmar»). */
  const solo = useRef('');
  // «Confirmar» SIEMPRE activo (20/11, OA-06): con menos de 6 números, el servidor dice «Faltan números» (antes, un botón apagado).
  const confirmar = useCallback(() => { if (!ocupado) void onConfirmar(codigo).then((ok) => { if (ok) setCodigo(''); }); }, [codigo, ocupado, onConfirmar]);
  // Con los 6 números, se confirma SOLO a los 0,9 s (20/11, OA-07: la maqueta, `programarCodigo`).
  useEffect(() => {
    if (codigo.length !== 6 || ocupado || solo.current === codigo) return;
    const t = window.setTimeout(() => { solo.current = codigo; confirmar(); }, MS_CODIGO_SOLO);
    return () => window.clearTimeout(t);
  }, [codigo, ocupado, confirmar]);
  const w = vista.whatsapp;
  // Vencido NO esconde «Abrir WhatsApp» (20/11, OA-08): escribirle de nuevo a MaKo le trae un código nuevo, y el error de vencido
  // manda a «Reenviar el código». Sólo sin el link (no se pudo armar el mensaje) va «Volver a intentarlo».
  const sinLink = !w || !w.link;
  // Le escribió desde otro WhatsApp (wa-04): lo dice arriba, con las dos salidas. Mandarlo desde el suyo sigue abajo.
  const otro = w?.estado === 'otro-numero' && w.otroNumero ? avisoOtroNumero(w.otroNumero, w.telefono) : null;
  return (
    <div className="arr-tarjeta arr-v2__cod">
      {otro && (
        <div className="arr-v2__otro" role="status" data-otro-numero="">
          <b>{otro.titulo}</b>
          <span>{otro.texto}</span>
          <div className="arr-v2__otro-botones">
            <Button variant="primary" size="sm" disabled={ocupado} loading={ocupado} onClick={onUsarOtro}>{otro.usar}</Button>
            <Button variant="secondary" size="sm" disabled={ocupado} onClick={onCambiar}>Cambiar número</Button>
          </div>
        </div>
      )}
      {sinLink
        ? <><span className="arr-tarjeta__nota">No pude armar el mensaje.</span>
          <Button variant="primary" size="sm" loading={ocupado} disabled={ocupado} onClick={onReintentar}>Volver a intentarlo</Button></>
        : <a className={`arr-v2__wa${resaltarWa ? ' arr-v2__wa--resalta' : ''}`} href={w.link!} target="_blank" rel="noopener noreferrer" data-abrir-whatsapp=""><Icon name="whatsapp" size={18} />Abrir WhatsApp</a>}
      {/* Su mensaje llegó y MaKo no pudo contestarle (20/11, wa-04; el servidor es del chat de WhatsApp: lib/verificacion-entrante.ts →
          avisoDelPedidoV2): una nota arriba del campo, debajo de «Abrir WhatsApp» (nunca encima). Se va sola cuando MaKo le contesta. */}
      {w?.aviso && <p className="arr-v2__aviso-wa" role="status" data-aviso-wa="">{w.aviso}</p>}
      <div className="arr-v2__cod-fila">
        {/* Lo pegado: el grupo de 6 números seguidos (el mensaje de MaKo entero trae la hora y otras cifras); si no hay, sus números. */}
        <input id="arr-v2-codigo" className="arr-v2__cod-campo" inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
          aria-label="El código de 6 números" value={codigo} onChange={(e) => setCodigo(codigoDeLoEscrito(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }} />
        <Button variant="primary" size="sm" disabled={ocupado} loading={ocupado} onClick={confirmar}>Confirmar</Button>
      </div>
      <div className="arr-v2__cod-pie">
        {!otro && <button type="button" className="arr-v2__link" onClick={onCambiar} disabled={ocupado}>Cambiar número</button>}
        {/* Pasadas las 24 h, «Reenviar» es el link de WhatsApp con el mensaje escrito: lo abre el mismo toque (wa-f3). */}
        {reescribir && w?.link
          ? <a className="arr-v2__link" href={w.link} target="_blank" rel="noopener noreferrer" onClick={onAbrioWhatsapp}>Reenviar el código</a>
          : <button type="button" className="arr-v2__link" onClick={onReenviar} disabled={ocupado}>Reenviar el código</button>}
      </div>
    </div>
  );
}

/**
 * EL RECUADRO DE OPCIONES de arriba de la caja: el del Ops Center (app/admin/operaciones/PreguntasDelChat.tsx, centro.css
 * .co-preg--arriba), con el tema a la izquierda, como la maqueta (`recuadro`). Varias a la vez con números en caja y «Responder»;
 * una lista larga en dos columnas, numerada de arriba hacia abajo; «Escribe otra cosa» al final.
 */
type Borrador = { marcadas: string[]; otra: string };

function Recuadro({ m, ocupado, onUna, onVarias, onOtra, inicial, onBorrador }: {
  m: MensajeArranque; ocupado: boolean; onUna: (i: number) => void; onVarias: (vs: string[]) => void; onOtra: (t: string) => void;
  /** Lo marcado y lo escrito de antes (20/11/2026, el inventario de botones): el recuadro se desmonta mientras envía, y si el envío
   *  falla vuelve con esto, no vacío. */
  inicial?: Borrador; onBorrador: (b: Borrador) => void;
}) {
  const q = m.recuadro!;
  const ops = m.opciones ?? [];
  const [plegado, setPlegado] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>(inicial?.marcadas ?? []);
  const [otra, setOtra] = useState(inicial?.otra ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { onBorrador({ marcadas, otra }); }, [marcadas, otra, onBorrador]);
  const varias = q.varias ?? 0;
  // La pregunta del recuadro, sin el nombre, también plegado y en su aria-label (20/11, la verificación de OA-18).
  const pregunta = q.pregunta ?? m.texto;
  if (plegado) {
    return (
      <button type="button" className="co-preg co-preg--arriba co-preg--plegada" onClick={() => setPlegado(false)} aria-expanded={false}>
        <span>{pregunta}</span><span className="co-preg__flecha" aria-hidden="true">▴</span>
      </button>
    );
  }
  // LO QUE SE MANDA ES LO QUE SE VE (20/11/2026, el inventario): con opciones marcadas Y texto escrito, «Responder» mandaba sólo el
  // texto sin avisar. Ahora marcar borra lo escrito, y escribir desmarca.
  const marcar = (o: string) => {
    setAviso(null);
    setOtra('');
    setMarcadas((v) => {
      if (v.includes(o)) return v.filter((x) => x !== o);
      if (v.length >= varias) { setAviso(`Puedes elegir hasta ${varias}. Saca uno para sumar otro.`); return v; }
      return [...v, o];
    });
  };
  const filas = Math.ceil(ops.length / 2);
  return (
    <div className={`co-preg co-preg--arriba arr-v2__preg${ops.length > 6 ? ' arr-v2__preg--larga' : ''}`} role="group" aria-label={`Pregunta: ${pregunta}`}>
      <div className="co-preg__cab">
        <span className="arr-v2__tema">{q.tema}</span>
        <button type="button" className="co-preg__plegar" onClick={() => setPlegado(true)} aria-expanded aria-label="Ocultar las opciones" title="Ocultar"><span aria-hidden="true">▾</span></button>
      </div>
      <p className="co-preg__texto">{pregunta}</p>
      {q.ayuda && <p className="arr-v2__ayuda">{aviso ?? q.ayuda}</p>}
      <ol className="co-preg__ops arr-v2__lista" style={{ '--filas': filas } as CSSProperties}>
        {ops.map((o, i) => {
          const elegida = marcadas.includes(o);
          return (
            <li key={o}>
              <div role="button" tabIndex={0} className="co-preg__op" aria-pressed={varias ? elegida : undefined} data-elegida={elegida ? 'true' : undefined}
                onClick={() => { if (ocupado) return; if (varias) marcar(o); else onUna(i); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ocupado) return; if (varias) marcar(o); else onUna(i); } }}>
                <span className={`co-preg__num${varias ? ' co-preg__num--caja' : ''}`} aria-hidden="true">{i + 1}</span>
                <span className="co-preg__op-txt"><span className="co-preg__titulo">{o}</span></span>
              </div>
            </li>
          );
        })}
      </ol>
      {q.libre && (
        <ol className="co-preg__ops arr-v2__otra" start={ops.length + 1}>
          <li>
            <label className="co-preg__op co-preg__op--otra">
              <span className="co-preg__num" aria-hidden="true">{ops.length + 1}</span>
              <input className="co-preg__campo" value={otra} maxLength={1000} placeholder="Escribe otra cosa" aria-label="Escribe otra respuesta"
                onChange={(e) => { setOtra(e.target.value); if (e.target.value.trim()) setMarcadas([]); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && otra.trim() && !ocupado) { e.preventDefault(); onOtra(otra.trim()); } }} />
            </label>
          </li>
        </ol>
      )}
      {(varias > 0 || otra.trim()) && (
        <div className="co-preg__pie co-preg__pie--chat">
          <span className="co-preg__ayuda">{marcadas.length ? `${marcadas.length} elegido${marcadas.length > 1 ? 's' : ''}` : ''}</span>
          <button type="button" className="co-chip co-chip--primario" disabled={ocupado || (!otra.trim() && !marcadas.length)}
            onClick={() => { if (otra.trim()) onOtra(otra.trim()); else if (marcadas.length) onVarias(marcadas); }}>Responder</button>
        </div>
      )}
    </div>
  );
}

const CAMPO = {
  width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
};

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md). Copiado de la maqueta (cuerpo.html, «EL ONBOARDING: una
// pantalla con el chat en un bloque…»), con los nombres de la app.
const CSS_V2 = `
.arr-capa { position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; left: 0; z-index: 100; display: flex; flex-direction: column; font-family: 'Geist', sans-serif; color: var(--ink); }
.arr-capa--sale { opacity: 0; transition: opacity .4s ease; }
.arr-v2.arr-capa { background: var(--surface); }
/* LA LETRA (16/11, Martín: «fíjate que los mensajes de MaKo no queden tan chiquititos»): la escala grande de la app, como la maqueta. */
.arr-v2 { --fs-meta: 13px; --fs-sm: 14.5px; --fs-md: 16px; --fs-card: 16.5px; }
.arr-v2 .co-el__cuerpo .ch-md, .arr-v2 .co-burbuja { font-size: var(--fs-md); line-height: 1.5; }
.arr-v2 .arr-cuerpo { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px max(16px, calc((100vw - 960px) / 2)); }
.arr-v2__bloque { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden;
  background: var(--bg); border: 1px solid var(--border-strong); border-radius: 18px;
  box-shadow: 0 1px 2px rgba(18, 21, 27, .04), 0 14px 36px rgba(18, 21, 27, .08); }
[data-tema="oscuro"] .arr-v2__bloque { box-shadow: 0 14px 36px rgba(0, 0, 0, .45); }
.arr-v2__cab { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
.arr-v2 .arr-foto { display: inline-flex; transition: opacity .2s ease; }
.arr-v2 .arr-titulos { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.arr-v2 .arr-nombre { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.arr-v2 .arr-sub { font-size: 13.5px; color: var(--ink); line-height: 1.2; }
.arr-v2__der { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--ink); }
.arr-v2__prog { position: relative; flex: none; height: 4px; background: var(--surface-2); }
.arr-v2__prog i { display: block; height: 100%; background: var(--ink); border-radius: 0 2px 2px 0; transition: width .5s cubic-bezier(.16, .84, .34, 1); }
.arr-v2__prog[data-listo] i { background: var(--good); }
.arr-v2 .co-hilo { flex: 1; min-height: 0; overflow-y: auto; background: var(--bg); padding-inline: clamp(14px, 3vw, 28px); padding-top: 16px; }
.arr-v2 .co-caja-wrap { flex: none; background: var(--bg); padding: 0 clamp(12px, 2.5vw, 24px) 14px; }
.arr-v2__foto { flex: none; display: inline-flex; width: 26px; height: 26px; margin-top: 4px; }
.arr-v2__mifoto { width: 28px; height: 28px; }
.arr-v2 .ch-md p { margin: 0; }
.arr-v2__en-mensaje { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 2px; }
.arr-v2 .arr-tarjeta { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); min-width: min(320px, 100%); }
.arr-v2 .arr-tarjeta__nota { font-size: 13px; color: var(--dim); line-height: 1.4; }
.arr-v2 .arr-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.arr-v2 .arr-link { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font-size: var(--fs-sm); font-weight: 700; text-decoration: none; font-family: inherit; cursor: pointer; }
.arr-v2 .arr-link--principal { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.arr-v2 .arr-link:disabled { opacity: .6; cursor: default; }
/* En el teléfono, al final, la caja muestra entero «Toca «Continuar el onboarding desde la PC»», en dos renglones (la maqueta). */
.arr-v2__caja--dos .co-caja__campo textarea { min-height: calc(2 * var(--fs-md) * 1.5 + 18px); }
/* Los errores, ROJOS y arriba de la caja (16/11, Martín: «no en amarillo, sino que en rojo»). */
.arr-v2__error { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; max-width: 760px; margin: 0 auto 10px; padding: 10px 12px; border-radius: 12px;
  background: var(--bad-bg); border: 1px solid color-mix(in srgb, var(--bad) 45%, transparent); color: var(--ink); font-size: var(--fs-sm); line-height: 1.45; }
.arr-v2__error-ico { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--bad); color: #fff; display: grid; place-items: center; font: 800 12px/1 'Geist', system-ui, sans-serif; margin-top: 1px; }
.arr-v2__error-t { flex: 1; min-width: 0; }
.arr-v2__error > button { flex: none; border: 0; background: none; color: var(--dim); cursor: pointer; font: inherit; padding: 0 2px; }
.arr-v2__ejemplos { max-width: 760px; margin: 0 auto 8px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; font-size: var(--fs-meta); color: var(--faint); }
.arr-v2__ejemplo { border: 1px dashed var(--border-strong); border-radius: 999px; padding: 4px 12px; background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
.arr-v2__ejemplo:hover { background: var(--surface-2); }
.arr-v2__aviso { max-width: 760px; margin: 0 auto 8px; font-size: var(--fs-sm); color: var(--dim); text-align: center; }
/* La tarjeta del código. */
.arr-v2__wa { display: inline-flex; align-items: center; justify-content: center; gap: 8px; align-self: flex-start; height: 42px; padding: 0 18px; border-radius: 999px; border: 0;
  background: #25D366; color: #fff; font: 700 15px/1 'Geist', system-ui, sans-serif; text-decoration: none; cursor: pointer; box-shadow: 0 2px 8px rgba(37, 211, 102, .3); }
.arr-v2__wa:hover { background: #1EBE5A; }
.arr-v2__wa svg { flex: none; }
.arr-v2__cod-fila { display: flex; gap: 8px; align-items: stretch; }
.arr-v2__cod-campo { flex: 1; min-width: 0; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink);
  font: 600 18px/1.2 'Geist', system-ui, sans-serif; letter-spacing: .32em; text-align: center; font-variant-numeric: tabular-nums; }
.arr-v2__cod-campo:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.arr-v2__cod-campo::placeholder { color: var(--faint); letter-spacing: .32em; }
.arr-v2__cod-pie { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; }
.arr-v2__link { border: 0; background: none; padding: 2px 0; color: var(--dim); font: inherit; font-size: var(--fs-sm); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.arr-v2__link:hover { color: var(--ink); }
.arr-v2__aviso-wa { margin: 0; padding: 10px 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent); background: var(--warn-bg); color: var(--ink); font-size: var(--fs-sm); line-height: 1.45; }
.arr-v2__otro { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent); background: var(--warn-bg); }
.arr-v2__otro b { font-size: var(--fs-sm); color: var(--ink); }
.arr-v2__otro span { font-size: 13px; color: var(--dim); line-height: 1.4; }
.arr-v2__otro-botones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
/* «Abrir WhatsApp» marcado: el navegador frenó la ventana de «Reenviar» y hay que tocarlo. */
.arr-v2__wa--resalta { box-shadow: 0 0 0 3px color-mix(in srgb, #25D366 35%, transparent); }
/* El recuadro de opciones: el del Ops Center, con el tema a la izquierda; una lista larga en dos columnas, numerada hacia abajo. */
.arr-v2__preg .co-preg__cab { justify-content: space-between; }
.arr-v2__tema { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--surface-2); color: var(--ink); font-size: var(--fs-meta); font-weight: 600; white-space: nowrap; }
.arr-v2__preg .co-preg__plegar { margin-left: auto; }
.arr-v2__preg .co-preg__op:hover { background: var(--velo-hover); }
.arr-v2__ayuda { margin: 0 4px 8px; font-size: var(--fs-sm); color: var(--dim); }
.arr-v2__preg .arr-v2__otra { margin-top: 2px; }
@media (min-width: 900px) {
  .arr-v2__preg--larga .co-preg__ops.arr-v2__lista { display: grid; grid-template-columns: 1fr 1fr; grid-auto-flow: column; grid-template-rows: repeat(var(--filas, 5), auto); column-gap: 6px; }
}
/* Los tres puntitos de MaKo escribiendo (los de Offer: app/offer/estilos.ts). */
.arr-v2 .of-escribiendo { display: inline-flex; align-items: center; gap: 4px; padding: 6px 2px; color: var(--dim); }
.arr-v2 .of-escribiendo i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: arr-v2-escribe 1.2s ease-in-out infinite; }
.arr-v2 .of-escribiendo i:nth-child(2) { animation-delay: .15s; }
.arr-v2 .of-escribiendo i:nth-child(3) { animation-delay: .3s; }
@keyframes arr-v2-escribe { 0%, 60%, 100% { opacity: .25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
/* LA PANTALLA OSCURA DEL TUTORIAL, salvo MaKo escribiendo. */
/* EL BARRIDO DEL SOL Y LA LUNA (20/11, OA-13: la maqueta, «iris»): el velo entra como un círculo de luz que se cierra hacia MaKo
   escribiendo (--iris-x/--iris-y, medidos sobre su fila), en .72 s. Con menos movimiento, sin animación: el velo entero de una. */
@property --arr-iris { syntax: '<length>'; inherits: false; initial-value: 0px; }
.arr-v2__velo { position: fixed; inset: 0; z-index: 5; background: rgba(18, 21, 27, .62); pointer-events: none;
  -webkit-mask: radial-gradient(circle at var(--iris-x, 50%) var(--iris-y, 50%), transparent var(--arr-iris), #000 calc(var(--arr-iris) + 1px));
  mask: radial-gradient(circle at var(--iris-x, 50%) var(--iris-y, 50%), transparent var(--arr-iris), #000 calc(var(--arr-iris) + 1px));
  animation: arr-v2-iris .72s cubic-bezier(.65, 0, .35, 1) both; }
@keyframes arr-v2-iris { from { --arr-iris: 150vmax; } to { --arr-iris: 0px; } }
.arr-v2__resalte { position: relative; z-index: 6; }
.arr-v2__resalte .co-el { padding: 6px 12px 6px 8px; border-radius: 999px; background: var(--bg); box-shadow: 0 0 0 2px var(--ink), 0 10px 30px rgba(0, 0, 0, .25); width: max-content; }
@media (prefers-reduced-motion: reduce) { .arr-v2__velo, .arr-v2 .of-escribiendo i, .arr-capa--sale { animation: none; transition: none; } }
@media (max-width: 640px) {
  .arr-v2 .arr-cuerpo { padding: 8px; }
  .arr-v2__bloque { border-radius: 16px; }
  .arr-v2__cab { padding: 8px 10px 8px 14px; }
  .arr-v2__preg .co-preg__op { padding: 6px 8px; }
  .arr-v2__preg .arr-v2__lista { max-height: min(36vh, 300px); overflow-y: auto; }
}
`;
