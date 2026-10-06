'use client';

// =============================================================================
// ProbarTracking — el "Test Events" de MaKo para la landing
// =============================================================================
// El equivalente al Pixel Helper de Meta. El botón "Verificar" de antes solo
// decía si ALGUNA VEZ llegó un evento — y estuvo en verde tres semanas mientras
// el VSL no medía nada, porque llegaban los plays pero ningún avance.
//
// Esto abre una sesión de prueba: mientras está prendida consulta cada 3s y
// muestra los eventos ENTRANDO, más los chequeos que dicen qué anda y qué no
// (incluido si la landing tiene el código VIEJO, que es el error más común: se
// pega una vez y queda congelado ahí para siempre).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SesionDeLead } from '@/lib/replay-ficha';
import { enumerar, haceCuanto, nombresDe, type Cambios } from '@/lib/landing-snapshot';
import { Button, Input, Select } from '@/app/_ui';
import { IconBtn } from './ServicioConfigForm';
import { Icon } from '@/app/_components/icons';
import { mismaPagina } from '@/lib/landing-paginas';
import type { VideoLanding } from '@/lib/landing-videos';
import { NombrarVideos, type VideoDetectado } from './NombrarVideos';
import { borrarPaginaAction, getPaginasAction, guardarPaginaAction } from './landing-actions';
import { analizarLandingAction } from './landing-config-actions';
import { finPruebaAction } from './landing-actions';
import { leadDePruebaAction } from './prueba-lead-actions';
import { conWs, wsDeBusqueda } from '@/lib/ws-tab';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Evento = { ts: string; tipo: string; porcentaje: number | null; segundos: number | null; detalle: string | null; auto?: boolean };
type Chequeo = { id: string; label: string; estado: 'ok' | 'falta' | 'viejo' | 'na'; detalle: string; paso?: boolean; accion?: { texto: string; href: string } };
type Diag = {
  eventos: Evento[]; chequeos: Chequeo[]; veredicto: string; urls: string[]; codigoViejo: boolean; ultima: string | null;
  /** Los videos que el sistema VIO en los eventos, y los que el negocio nombró. */
  videosDetectados: VideoDetectado[]; videos: VideoLanding[];
  /** Los que el negocio marcó como «no son de mi página». */
  videosOcultos?: string[];
  /** La grabación propia de ESTA prueba, o null si todavía no llegó. */
  grabacion?: SesionDeLead | null;
};

const hora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es-MX', { hour12: false }); };

/** Cómo se lee cada evento crudo. Los tipos técnicos no se muestran pelados. */
function legible(e: Evento): { texto: string; color: string } {
  if (e.tipo === 'pageview') return { texto: 'Visitó tu página', color: 'var(--dim)' };
  // ⚠️ El play automático se NOMBRA distinto. Los dos son plays y uno vale mucho
  // menos: con Panda arrancando solo, la lista se llenaba de «Reprodujo el video»
  // sin que nadie hubiera tocado nada, y eso hace dudar del resto de la lista.
  if (e.tipo === 'play') return e.auto
    ? { texto: 'El video arrancó solo (autoplay)', color: 'var(--dim)' }
    : { texto: 'Reprodujo el video', color: 'var(--primary)' };
  if (e.tipo === 'exit') return { texto: e.porcentaje != null ? `Salió en el ${e.porcentaje}%` : 'Salió del video', color: 'var(--bad)' };
  const m = /^p(\d+)$/.exec(e.tipo);
  if (m) return { texto: `Llegó al ${m[1]}% del video`, color: 'var(--good)' };
  const s = /^s(\d+)$/.exec(e.tipo);
  if (s) return { texto: `Vio ${s[1]} segundos`, color: 'var(--good)' };
  // Un opt-in NO es un evento de tracking: vive en `propuestas`. Aparece igual en
  // esta lista porque la instrucción dice «completá tu propio formulario», y sin
  // esto ese formulario entraba perfecto sin producir un solo renglón — que es
  // exactamente cómo se lee «el formulario no se registró».
  // ⚠️ AGENDÓ es el evento más importante de una landing que vende por llamada, y
  // por eso va en verde y con el peso visual de una conversión: es el final del
  // embudo, no un paso más.
  if (e.tipo === 'agendo') return { texto: 'Agendó una llamada', color: 'var(--good)' };
  if (e.tipo === 'pausa') return { texto: e.segundos != null ? `Pausó a los ${Math.round(e.segundos)}s` : 'Pausó el video', color: 'var(--warn)' };
  if (e.tipo === 'retoma') return { texto: 'Retomó el video', color: 'var(--primary)' };
  if (e.tipo === 'fin') return { texto: 'Terminó el video', color: 'var(--good)' };
  // De la PÁGINA, no del video. Se nombran en términos de lo que hizo la persona
  // —«se fue a otra pestaña»— y no del evento del navegador, que no le dice nada
  // a nadie.
  if (e.tipo === 'salio') return { texto: 'Se fue a otra pestaña', color: 'var(--warn)' };
  if (e.tipo === 'volvio') return { texto: e.segundos != null ? `Volvió a tu página (estuvo ${Math.round(e.segundos)}s afuera)` : 'Volvió a tu página', color: 'var(--primary)' };
  if (e.tipo === 'cierre') return { texto: e.segundos != null ? `Cerró la página (estuvo ${Math.round(e.segundos)}s)` : 'Cerró la página', color: 'var(--bad)' };
  if (e.tipo === 'optin') return { texto: e.detalle ? `Completó el formulario: ${e.detalle}` : 'Completó el formulario', color: 'var(--good)' };
  // ⚠️ EL QUE NO EXISTÍA, Y ES EL QUE MÁS DUELE. Un opt-in que llega y se
  // descarta porque el negocio no declaró la landing en /funnel no dejaba NADA:
  // ni fila, ni log. Se veía igual que «no llegó», que es la conclusión
  // exactamente opuesta a la verdadera. Va en rojo y nombra al culpable.
  if (e.tipo === 'optin_bloqueado') return {
    texto: e.detalle === 'agenda'
      ? 'Agendó — pero NO entró al CRM: falta activar la landing en Funnel'
      : 'Dejó sus datos — pero NO entraron al CRM: falta activar la landing en Funnel',
    color: 'var(--bad)',
  };
  // El click trae su destino en `detalle`, y eso es lo que hay que mostrar: «hizo
  // click» sin decir en qué no distingue el botón de WhatsApp del de arriba.
  if (e.tipo === 'click') return { texto: e.detalle ? `Hizo clic en: ${e.detalle}` : 'Hizo clic', color: 'var(--primary)' };
  // ⚠️ SIN EL `detalle`, y no es por ahorrar: en un clic al vacío ese campo trae la
  // etiqueta cruda del elemento («vacio: DIV»), que no le dice nada a nadie. Y lleva
  // rótulo propio porque el feed cae al default —que pinta el nombre interno del
  // tipo— y ahí se leería literalmente «clic_vacio», que parece que algo se rompió.
  if (e.tipo === 'clic_vacio') return { texto: 'Clic fuera de un botón', color: 'var(--dim)' };
  // ⚠️ «desconocido» NO es un evento: es lo que el beacon escribe cuando le llega
  // un tipo que no sabe clasificar (código viejo o modificado). Mostrarlo crudo
  // hacía aparecer la palabra «desconocido» en la lista, que se lee como que algo
  // se rompió — cuando lo que dice es que ese evento no se pudo interpretar.
  if (e.tipo === 'desconocido') return { texto: 'Evento no reconocido (Pixel desactualizado o modificado)', color: 'var(--warn)' };
  return { texto: e.tipo, color: 'var(--dim)' };
}

// 'na' = no aplica a ESTA página. No es un problema por resolver: es que ese
// paso no existe en este negocio (una landing sin video, un CTA que es un
// Calendly embebido). Se pinta apagado y con un guion, no con el círculo de
// «todavía no» — que se lee como algo pendiente.
const ICONO: Record<string, string> = { ok: '✓', falta: '○', viejo: '!', na: '–' };
const COLOR: Record<string, string> = { ok: 'var(--good)', falta: 'var(--faint)', viejo: 'var(--warn)', na: 'var(--border-strong)' };

/**
 * Qué le pedimos a la persona por cada chequeo que todavía no está en verde.
 *
 * Es lo que convierte la lista de chequeos en una instrucción. `pageview` no está
 * a propósito: la visita se registra sola al abrir la pestaña, así que pedirla
 * sería pedir algo que ya pasó. `profundidad` tampoco: se cumple sola dejando el
 * video corriendo, y nombrarla al lado de «reproduce el video» son dos frases
 * para una sola acción. `optin` cambia de texto según cómo capte ese negocio, y
 * por eso se resuelve aparte.
 */
const QUE_HACER: Record<string, string> = {
  play: 'reproduce el video unos segundos',
  click: 'haz clic en tus botones',
};

/** La landing elegida para probar. Se recuerda para no volver a tipearla. */
const URL_KEY = 'mako.landing.url_prueba';
/** Valor centinela de la última opción del desplegable. */
const NUEVA = '__nueva__';

/**
 * @param pruebaInicial  Marcador de una prueba YA arrancada. Con esto el panel
 *   entra directo a «escuchando» — es lo que renderiza la ventana de prueba que
 *   se abre encima de la landing. Se reusa el MISMO componente a propósito: una
 *   segunda copia del panel es una copia que se queda vieja, y este ya tiene el
 *   poll, los chequeos y la traducción de cada evento.
 */
export function ProbarTracking({ pruebaInicial, landingFija }: { pruebaInicial?: string; landingFija?: string | null } = {}) {
  const [activo, setActivo] = useState(!!pruebaInicial);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState(landingFija ?? '');
  const [previo, setPrevio] = useState<Diag | null>(null); // estado ANTES de arrancar
  const [bloqueo, setBloqueo] = useState(false); // apretó "probar" con el código viejo
  // El navegador bloqueó la ventana de la prueba. No es un detalle: sin ella no
  // hay dónde mirar los eventos mientras se usa la landing.
  const [sinPermiso, setSinPermiso] = useState(false);
  // La ventana de la prueba, para saber cuándo la cierran.
  const ventana = useRef<Window | null>(null);
  // ⚠️ El marcador de ESTA prueba, como el `test_event_code` de Meta. Sin él, el
  // panel traía las últimas 24 h enteras y aparecían horarios de la mañana entre
  // los de recién: no había forma de saber cuáles eran los propios.
  const [prueba, setPrueba] = useState<string | null>(pruebaInicial ?? null);
  // La verificación de LA PÁGINA elegida. El botón vivía al lado del código y
  // contestaba por el workspace entero: «¿llegó algún evento alguna vez?». Al lado
  // del desplegable la pregunta es otra y es la útil — «¿la página que estoy por
  // probar está midiendo, y con qué versión?». Un cliente con dos landings
  // publicadas tenía una sola respuesta para las dos.
  const [verif, setVerif] = useState<{ url: string; instalada: boolean; vieja: boolean; texto: string } | null>(null);
  const [verificando, setVerificando] = useState(false);
  // ⚠️ EL PASO. «¿Qué es cada video?» ya no vive siempre a la vista: es una
  // pregunta que solo hace falta cuando falta la respuesta. Colgada del panel
  // permanentemente era una tarea abierta que nadie iba a cerrar —está ahí desde
  // que entrás, y nada dice para qué sirve contestarla— mientras que preguntada
  // JUSTO ANTES de la prueba tiene contexto: lo que estás por hacer es mirar los
  // eventos de esos videos.
  const [paso, setPaso] = useState<'inicio' | 'videos'>('inicio');
  // Qué piezas tiene ESTA landing. Se analiza una vez y se reenvía en cada
  // consulta: bajar el HTML del cliente en cada refresco del poll sería una
  // request a su página cada 3 segundos.
  const [piezas, setPiezas] = useState<string[]>([]);
  // ⚠️ QUÉ CAMBIÓ EN LA PÁGINA desde la última vez que la miramos. Lo calcula el
  // server (mirarLanding), no el cliente: acá no hay «antes» —el componente se
  // monta de cero en cada apertura— y la ventana de la prueba es un montaje
  // nuevo cada vez. Viene vacío cuando no hay con qué comparar Y cuando la
  // lectura falló, así que este renglón no puede mentir por un timeout.
  const [cambios, setCambios] = useState<Cambios | null>(null);
  // Los videos que la PÁGINA tiene, con su URL. Salen del mismo análisis y son lo
  // que permite mostrar un video que todavía nadie reprodujo.
  const [videosPagina, setVideosPagina] = useState<Array<{ id: string; url: string }>>([]);
  const [eligiendoNueva, setEligiendoNueva] = useState(false); // eligió "Otra página…"
  const [paginas, setPaginas] = useState<string[]>([]);        // las GUARDADAS del workspace
  const [ocultas, setOcultas] = useState<string[]>([]);        // las que sacó de la lista a mano
  const [editando, setEditando] = useState<string | null>(null); // la que se está corrigiendo
  const [errPagina, setErrPagina] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Mientras se resuelve el lead PRUEBA con el que se mira la grabación. Va
  // aparte de `ocupado` —que es el de editar la lista de páginas— porque son
  // dos botones distintos y apagar el otro no significa nada acá.
  const [abriendoFicha, setAbriendoFicha] = useState(false);
  // Sin esquema también vale: «tu-pagina.com» es lo que la gente escribe, y el
  // server lo normaliza. Acá solo se pide que tenga un punto.
  const urlValida = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}/i.test(url.trim());
  // ⚠️ NORMALIZADO en las dos puntas. Comparar los strings crudos hacía
  // desaparecer los botones justo después de guardar: la lista queda con
  // «https://x.com» y el estado con lo que se tipeó, «x.com».
  const guardadaElegida = paginas.some((p) => mismaPagina(p, url));
  // Detectadas por los eventos: ni guardadas ni escondidas a mano.
  const detectadas = (previo?.urls ?? []).filter(
    (u) => !paginas.some((p) => mismaPagina(p, u)) && !ocultas.some((o) => mismaPagina(o, u)),
  );
  // ⚠️ Los botones van sobre CUALQUIER página elegida, no solo sobre una
  // guardada. La versión anterior los gateaba en `guardadaElegida` con el
  // argumento de que una detectada «todavía no es de nadie» — y el resultado fue
  // que quien nunca guardó una a mano (todas detectadas, que es el caso normal)
  // no veía un solo botón y la función entera era invisible. Una página
  // detectada SÍ es suya: la diferencia es cómo nos enteramos, no de quién es.
  const hayElegida = !!url.trim() && !eligiendoNueva;

  // Los videos que el sistema vio y que todavía nadie nombró. Es lo que decide si
  // la prueba pregunta primero — «no le he cargado de qué se trata» y «se
  // agregaron nuevos» son el mismo estado: hay un video sin respuesta.
  const detectadosVideo = previo?.videosDetectados ?? [];
  const videosGuardados = previo?.videos ?? [];
  // ⚠️ UN VIDEO OCULTO NO CUENTA COMO «sin nombre». Si no, el paso que pide
  // identificarlos vuelve a saltar cada vez que se arranca una prueba por un video
  // que el negocio ya dijo que no es suyo — y la única forma de callarlo sería
  // ponerle un nombre, o sea reconocerlo como propio para poder ignorarlo.
  // Ocultar tiene que ser una respuesta tan válida como nombrar.
  const ocultosVideo = previo?.videosOcultos ?? [];
  // ⚠️⚠️ LOS VIDEOS DE LA PÁGINA TAMBIÉN ABREN ESTA PUERTA, y no abrirla fue el
  // reporte del dueño: «la funcionalidad que ya habíamos construido para
  // seleccionar de qué es cada video no me apareció en ningún momento».
  //
  // `videosDetectados` sale de los EVENTOS (los `video_id` que llegaron), así que
  // en una página cuyos videos no mandan ninguno la lista queda vacía y la pantalla
  // no se abre NUNCA — ni sola al apretar «Probar», ni por el lápiz, que miraba lo
  // mismo. Medido en el ws14: el analizador ve sus 16 videos de YouTube, la página
  // tiene 163 eventos en su historia y CERO `video_id`.
  //
  // Y `NombrarVideos` ya sabía mostrarlos: suma las filas de `enLaPagina` desde el
  // 25/08. Lo único que faltaba era que contaran para DECIDIR si hay algo que
  // preguntar. La puerta mira las dos fuentes; el orden pone primero lo que tiene
  // eventos, que es lo que más probablemente sea el VSL.
  const deLaPagina: VideoDetectado[] = videosPagina
    .filter((p) => !detectadosVideo.some((d) => d.id === p.id))
    .map((p) => ({ id: p.id, titulo: null, eventos: 0, url: p.url, pagina: null }));
  const candidatosVideo = [...detectadosVideo, ...deLaPagina];
  const sinNombre = candidatosVideo.filter(
    (d) => !videosGuardados.some((v) => v.id === d.id) && !ocultosVideo.includes(d.id),
  );
  const hayVideos = candidatosVideo.length > 0 || videosGuardados.length > 0;

  const aplicar = (r: { paginas: string[]; ocultas: string[] }) => { setPaginas(r.paginas); setOcultas(r.ocultas); };

  const verificarEsta = async () => {
    const u = url.trim();
    if (!u) return;
    setVerificando(true); setVerif(null);
    try {
      const r = await fetch(`/api/integraciones/landing/estado?verificar=${encodeURIComponent(u)}`, { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok && r.verificacion) setVerif(r.verificacion);
      else setErrPagina(r?.error ?? 'No se pudo verificar');
    } catch { setErrPagina('No se pudo verificar'); }
    finally { setVerificando(false); }
  };

  const guardar = async () => {
    setOcupado(true); setErrPagina(null);
    const r = await guardarPaginaAction(url, editando);
    setOcupado(false);
    if (!r.ok) { setErrPagina(r.error); return; }
    aplicar(r);
    // Se queda seleccionada la que se acaba de guardar: si el desplegable
    // volviera a vacío, guardar se sentiría como que no pasó nada. Se busca por
    // comparación normalizada, no por `includes` de substring —que hacía match
    // con cualquier URL que contuviera a esta como prefijo.
    setUrl(r.paginas.find((u) => mismaPagina(u, url)) ?? url.trim());
    setEligiendoNueva(false);
    setEditando(null);
  };

  const borrar = async (cual?: string) => {
    const u = cual ?? url;
    setOcupado(true); setErrPagina(null);
    const r = await borrarPaginaAction(u);
    setOcupado(false);
    if (!r.ok) { setErrPagina(r.error); return; }
    aplicar(r);
    // Solo se deselecciona si se borró LA elegida: quitar otra de la lista no
    // tiene por qué hacerte perder la que estabas por probar.
    if (mismaPagina(u, url)) setUrl('');
  };

  /**
   * Corregir y quitar, DENTRO de cada renglón del desplegable.
   *
   * Los mismos dos botones están afuera y actúan sobre la elegida; estos actúan
   * sobre el renglón. No es redundancia: hacerlo solo desde afuera obliga a
   * SELECCIONAR una página para poder sacarla — o sea, a elegir justo lo que
   * querés que desaparezca. Con siete renglones de la misma landing, eso es el
   * caso normal, no el raro.
   */
  const accionesDe = (u: string) => [
    { icono: <Icon name="pen" size={14} />, title: 'Corregir esta dirección', onClick: () => { setUrl(u); setEditando(paginas.some((p) => mismaPagina(p, u)) ? u : null); setEligiendoNueva(true); } },
    { icono: <Icon name="trash" size={14} />, title: 'Quitarla de la lista', tone: 'bad' as const, onClick: () => { void borrar(u); } },
  ];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const traer = useCallback(async (guardarEn?: (d: Diag) => void, pr?: string | null) => {
    try {
      const r = await fetch(`/api/integraciones/landing/estado?diag=1${pr ? `&prueba=${encodeURIComponent(pr)}` : ''}${landingFija ? `&landing=${encodeURIComponent(landingFija)}` : ''}${piezas.length ? `&piezas=${encodeURIComponent(piezas.join(','))}` : ''}`, { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) {
        const d: Diag = { eventos: r.eventos ?? [], chequeos: r.chequeos ?? [], veredicto: r.veredicto ?? '', urls: r.urls ?? [], codigoViejo: !!r.codigoViejo, ultima: r.ultima ?? null, videosDetectados: r.videosDetectados ?? [], videos: r.videos ?? [], videosOcultos: r.videosOcultos ?? [], grabacion: r.grabacion ?? null };
        (guardarEn ?? setDiag)(d);
        setErr(null);
      } else setErr(r?.error ?? 'No se pudo consultar');
    } catch { setErr('No se pudo consultar'); }
    finally { setCargando(false); }
  }, [landingFija, piezas]);

  // Antes de arrancar se consulta UNA vez: hace falta saber si el código está
  // viejo (para no dejar probar) y qué landings ya mandaron eventos (para poder
  // ofrecerlas en vez de pedir que las tipee).
  useEffect(() => {
    if (activo) return;
    traer(setPrevio);
    // Las guardadas viven en el WORKSPACE, no en este navegador: si vivieran en
    // localStorage, cambiar de máquina o de sesión las perdería, y no serían
    // «mis páginas» sino «las páginas de esta compu».
    getPaginasAction().then(aplicar).catch(() => { /* sin lista, se puede agregar */ });
  }, [activo, traer]);

  // ⚠️ LA ÚLTIMA PÁGINA PROBADA SOLO SE RESTAURA CUANDO EL PANEL LA ELIGE.
  //
  // Con `landingFija` la página ya está decidida en el paso 1 y el desplegable ni
  // se pinta. Restaurar acá lo que hubiera en ESTE navegador pisaba esa decisión:
  // en toda cuenta que nunca usó el panel suelto —o sea, TODO cliente nuevo—
  // `localStorage` está vacío, `url` quedaba en '' y «Probar» se deshabilita con
  // `url` inválida. Botón muerto y NADA en pantalla para revivirlo, porque lo
  // único que escribe `url` en este modo es el selector que está escondido.
  // Del lado de acá no se notaba: quien ya había probado alguna vez tenía la
  // clave puesta y el botón le andaba siempre.
  //
  // Y con una clave vieja era peor que muerto: el botón andaba y probaba OTRA
  // página, sin decirlo, mientras el panel arriba nombra la landing correcta.
  //
  // Va en su PROPIO efecto y corre una sola vez: colgado del de arriba se
  // relanzaba con cada identidad nueva de `traer` y le pisaba la elección a quien
  // acababa de elegir en el desplegable.
  useEffect(() => {
    if (landingFija) return;
    try { setUrl(localStorage.getItem(URL_KEY) ?? ''); } catch { /* sin storage */ }
  }, [landingFija]);

  // ⚠️ EL ANÁLISIS VA SOLO, y depende ÚNICAMENTE de la landing. Colgado del
  // efecto de arriba se relanzaba a sí mismo para siempre: `piezas` es una
  // dependencia de `traer`, `traer` lo es del efecto, y el efecto escribe
  // `piezas` — un array nuevo en cada vuelta, así que la comparación por
  // referencia nunca corta. Se veía como la página del cliente pidiéndose sola
  // varias veces por segundo.
  useEffect(() => {
    if (!landingFija) { setPiezas([]); setVideosPagina([]); setCambios(null); return; }
    let vivo = true;
    // Falla hacia «no sé» —lista vacía— y entonces se ofrecen TODOS los pasos:
    // esconder un chequeo porque no se pudo leer el HTML es peor que mostrarlo
    // de más, porque el que falta no deja rastro de que faltó.
    analizarLandingAction(landingFija)
      .then((a) => { if (vivo) { setPiezas(a.piezas); setVideosPagina(a.videos ?? []); setCambios(a.cambios ?? null); } })
      .catch(() => { if (vivo) { setPiezas([]); setVideosPagina([]); setCambios(null); } });
    return () => { vivo = false; };
  }, [landingFija]);

  // ⚠️ CERRAR LA VENTANA DE LA PRUEBA ES TERMINARLA. Antes quedaba corriendo: el
  // marcador seguía vivo, el panel de atrás seguía poleando, y el aviso de cierre
  // —el que dice «recibí tu prueba, la grabación viene»— no salía nunca. Cerrar
  // una ventana ES una forma de decir «terminé», y la más común.
  //
  // Cerrar la pestaña de MaKo también termina, y eso lo cubre `pagehide`.
  //
  // ⚠️ NO cuenta cerrar la pestaña de la LANDING: eso es parte de la prueba —
  // justamente el evento «cerró la página» que se agregó en la v14—, así que
  // tomarlo como fin apagaría la prueba en el momento en que más está midiendo.
  const cerrar = useCallback((p: string | null) => {
    if (p) void finPruebaAction(p);
    setActivo(false);
    setPrueba(null);
    ventana.current = null;
  }, []);

  useEffect(() => {
    if (!activo || !prueba) return;
    const t = setInterval(() => {
      if (ventana.current && ventana.current.closed) { clearInterval(t); cerrar(prueba); }
    }, 1000);
    const alSalir = () => { void finPruebaAction(prueba); };
    window.addEventListener('pagehide', alSalir);
    return () => { clearInterval(t); window.removeEventListener('pagehide', alSalir); };
  }, [activo, prueba, cerrar]);

  // Mientras la prueba está prendida, consulta cada 3s. Se apaga sola al cerrar
  // el modal (cleanup) para no dejar un poll corriendo de fondo.
  useEffect(() => {
  
  if (!activo) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    setCargando(true);
    // ⚠️ El marcador viaja en CADA consulta, incluida la del intervalo. Con
    // `setInterval(traer, 3000)` a secas, el primer argumento que recibe `traer`
    // es el contador del timer —no un marcador— y el filtro se perdía en cada
    // refresco: la lista arrancaba limpia y a los 3 segundos volvían las 24 h.
    const consultar = () => { void traer(undefined, prueba); };
    consultar();
    timer.current = setInterval(consultar, 3000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [activo, traer, prueba]);

  const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', padding: 16, fontFamily: SANS };

  // ⚠️ CON EL CÓDIGO VIEJO NO SE PRUEBA. Probar sobre un snippet desactualizado
  // da un resultado que no significa nada: los chequeos nuevos van a fallar
  // SIEMPRE —el código que está pegado no manda esos eventos— y la persona sale
  // creyendo que su landing está rota cuando lo único que pasa es que hay que
  // volver a pegar el código.
  //
  // El aviso aparece al APRETAR, no en lugar del panel: esconder el botón deja la
  // sección sin su acción y sin explicar qué la reemplazó. La persona viene a
  // probar; lo que corresponde es dejarla intentar y decirle ahí por qué todavía no.
  const arrancar = async () => {
    // ⚠️ SE VUELVE A PREGUNTAR, no se le cree a lo que se leyó al abrir el modal.
    // El caso real: la persona actualiza el código, recarga su landing y aprieta
    // «Probar» — pero el `previo` es de cuando abrió la pantalla, así que le
    // seguía diciendo «tenés el código viejo» sobre algo que ya había arreglado.
    // Un estado que gobierna un bloqueo se relee en el momento de bloquear.
    setOcupado(true);
    let viejo = previo?.codigoViejo ?? false;
    try {
      const r = await fetch('/api/integraciones/landing/estado?diag=1', { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) { viejo = !!r.codigoViejo; setPrevio((p) => (p ? { ...p, codigoViejo: viejo, urls: r.urls ?? p.urls } : p)); }
    } catch { /* sin respuesta, vale lo último que sabíamos */ }
    setOcupado(false);
    if (viejo) { setBloqueo(true); return; }

    // Si hay videos sin nombre, esa es la primera pantalla — no los pasos de la
    // prueba. Se pregunta UNA vez por corrida: `paso` ya en 'videos' significa
    // que la persona vino de ahí y apretó Siguiente, con o sin contestar.
    if (paso !== 'videos' && sinNombre.length > 0) { setPaso('videos'); return; }

    const u = url.trim();
    // Probar una página la GUARDA. Si no, la próxima vez hay que volver a
    // elegirla de las detectadas o a escribirla — y el desplegable dice
    // «se guarda al probarla», así que tiene que cumplirlo.
    if (!guardadaElegida) void guardarPaginaAction(u).then((r) => { if (r.ok) aplicar(r); });
    try { localStorage.setItem(URL_KEY, u); } catch { /* sin storage */ }
    // El marcador de ESTA prueba, pegado a la URL que se abre. El snippet lo
    // guarda en sessionStorage de esa pestaña y lo devuelve en cada evento, así
    // que lo que se ve acá es lo que hiciste vos — no las visitas del día ni las
    // de otra gente que esté en la página en este momento.
    const id = `p${Math.random().toString(36).slice(2, 10)}`;
    setPrueba(id);
    const sep = u.includes('?') ? '&' : '?';
    // El hash va SIEMPRE al final: `pagina.com/#registro?mko_test=x` deja el
    // parámetro adentro del hash y `location.search` no lo ve nunca.
    const [base, hash] = u.split('#');
    // ⚠️ LA VENTANA DE MaKo SE ABRE PRIMERO, Y SI NO ABRE NO HAY PRUEBA.
    //
    // Antes se abría la landing y después esta, y si el navegador bloqueaba las
    // emergentes la prueba arrancaba igual: la landing quedaba abierta midiendo y
    // la persona sin ningún lado donde ver los eventos. Terminaba mirando el panel
    // de atrás, que es justo lo que la ventana vino a evitar —apretar en una
    // pestaña y mirar en otra es alternar a ciegas—.
    //
    // Se abre primero para poder DETECTAR el bloqueo: la landing va con
    // `noopener`, que devuelve `null` siempre, así que con ella no se puede saber.
    // Y como el foco se le devuelve al final, sigue quedando arriba.
    const alto = Math.min(760, Math.max(420, window.screen.availHeight - 120));
    const chico = window.open(
      // La landing va con el marcador: sin ella la ventana arma los chequeos a
      // ciegas. Ver el comentario en escuchando/page.tsx.
      //
      // ⚠️ Y EL `?ws=` TAMBIÉN, que faltaba. El workspace de una pestaña viaja
      // ÚNICAMENTE por la URL —no hay cookie que lo cubra, a propósito: una
      // cookie es del navegador y le cambiaría el contexto a todas las pestañas
      // abiertas (ver lib/ws-tab.ts)—. Abriendo la ventana sin él, el super
      // admin que está mirando a un cliente con `?ws=13` recibía una ventana
      // resuelta a SU propio workspace: la prueba de un cliente, con los datos
      // de otro, y sin nada que lo dijera. Es justo el flujo con el que se miran
      // las pruebas de los clientes.
      conWs(`/integraciones/escuchando?p=${id}&l=${encodeURIComponent(u)}`, wsDeBusqueda(window.location.search)),
      'mako_prueba',
      `width=440,height=${alto},left=${Math.max(0, window.screen.availWidth - 470)},top=60,noopener=no`,
    );
    if (!chico) {
      // No se abre la landing: dejarla abierta midiendo una prueba que nadie
      // puede mirar es peor que no empezar.
      setSinPermiso(true);
      setPrueba(null);
      return;
    }
    ventana.current = chico;
    window.open(`${base}${sep}mko_test=${id}${hash ? `#${hash}` : ''}`, '_blank', 'noopener');

    // Y ENCIMA, una ventana de prueba de MaKo. Para verificar que un click se
    // registra hay que hacerlo EN la landing y mirar el resultado EN MaKo: con dos
    // pestañas eso es alternar a ciegas — apretás, cambiás de pestaña, y para
    // cuando mirás ya no sabés si lo que ves es de ese click o del anterior.
    //
    // La pestaña de atrás NO cambia: sigue mostrando la misma prueba. Un panel que
    // se reemplaza por «esto está corriendo en otro lado» obliga a volver para
    // enterarse de que no hay nada que ver acá.
    //
    // ⚠️ Se abre DESPUÉS de la landing, a propósito: la última ventana que se abre
    // queda arriba, y la que tiene que quedar arriba es esta.
    //
    // Sin `noopener`: acá se necesita la referencia para saber si el navegador la
    // bloqueó. Y se le da nombre para que dos pruebas seguidas REUSEN la misma
    // ventana en vez de sembrar la pantalla de ventana de pruebas huérfanas.
    setPaso('inicio');
    try { chico?.focus(); } catch { /* algunos navegadores no lo permiten */ }
    setActivo(true);
  };

  const avisoPermiso = sinPermiso && (
    <div style={{ marginTop: 12, padding: '13px 15px', borderRadius: 11, border: '1px solid var(--warn)', background: 'var(--warn-bg)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Permite las ventanas emergentes</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.55 }}>
        Tu navegador bloqueó la ventana de la prueba, y sin ella no hay dónde ver los eventos
        mientras usas tu página. <b>No empezamos la prueba</b> para no dejarte una pestaña abierta
        midiendo algo que no puedes mirar.
        <br />
        En Chrome: el ícono con la ventanita tachada, a la derecha de la barra de direcciones →
        <b> Permitir siempre</b> → vuelve aquí y aprieta Probar.
      </div>
    </div>
  );

  const avisoViejo = bloqueo && (
    <div style={{ marginTop: 12, padding: '13px 15px', borderRadius: 11, border: '1px solid var(--warn)', background: 'var(--warn-bg)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Primero actualiza el Pixel</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.55 }}>
        El que tienes instalado es de una versión anterior, así que la prueba no diría nada útil:
        las verificaciones nuevas fallarían porque ese Pixel todavía no las envía.
        <b> Copia el código de arriba, reemplázalo en tu página y vuelve aquí.</b>
      </div>
    </div>
  );

  /**
   * Abre la grabación de esta prueba en la ficha de su lead PRUEBA.
   *
   * ⚠️ VA ACÁ ARRIBA, en el cuerpo de la función y antes de los dos `return`
   * tempranos: adentro del `if (paso === 'videos')` sólo existiría en esa rama,
   * y el botón que la llama se dibuja en la otra.
   *
   * ⚠️ Y NAVEGA EN ESTA MISMA PESTAÑA, a propósito. `window.open` después de un
   * `await` lo bloquea el navegador —el click ya no cuenta como gesto del
   * usuario—, y lo que queda es un botón que no hace nada. Se pierde de vista la
   * prueba, que a esta altura ya está contestada.
   *
   * Y lleva el `?ws=`: es la cuarta forma de navegar de la casa (un
   * `window.location`), así que sin eso el super admin que está mirando a un
   * cliente aterriza en SU propio CRM.
   */
  const verLaGrabacion = async () => {
    if (!prueba) return;
    setAbriendoFicha(true);
    setErr(null);
    const r = await leadDePruebaAction(prueba).catch(() => null);
    if (!r || !r.ok) {
      setAbriendoFicha(false);
      setErr(r && r.ok === false ? r.error : 'No pude abrir la grabación.');
      return;
    }
    // El `setAbriendoFicha(false)` no va acá: la navegación ya salió y volver a
    // «Ver la grabación» mientras la página se va es un botón que parpadea.
    window.location.href = conWs(`/crm/${r.leadId}`, wsDeBusqueda(window.location.search));
  };

  // ── PASO: ¿qué es cada video? ─────────────────────────────────────────────
  // ⚠️ VA ANTES DEL `if (!activo)`, y no es un detalle de orden: puesto después
  // era código INALCANZABLE. El primer `return` se disparaba siempre y el lápiz
  // de «Tus videos» cambiaba el estado sin que la pantalla cambiara — un botón
  // que no hacía nada, sin ningún error que lo delatara.
  //
  // Aparece antes de los pasos de la prueba cuando hay algún video sin nombre, y
  // también a pedido desde el renglón de abajo. «Siguiente» NO exige contestar:
  // un paso que bloquea sobre algo opcional convierte la prueba en un trámite, y
  // la pregunta vuelve sola la próxima vez porque el dato sigue faltando.
  if (paso === 'videos') {
    return (
      <div style={box}>
        <NombrarVideos
          enLaPagina={videosPagina}
          detectados={detectadosVideo}
          videos={videosGuardados}
          onCambio={(v) => setPrevio((p) => (p ? { ...p, videos: v } : p))}
          ocultos={previo?.videosOcultos ?? []}
          onOcultos={(ids) => setPrevio((p) => (p ? { ...p, videosOcultos: ids } : p))}
        />
        {sinNombre.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 14, lineHeight: 1.5 }}>
            Puedes dejarlo para después: la retención se mide igual, pero sin saber a qué video corresponde.
          </p>
        )}
        {/* ⚠️ EL AVISO DEL PIXEL VIEJO TAMBIÉN VA ACÁ. `arrancar()` prende
            `bloqueo` y el aviso solo se pintaba en el panel de inicio: apretar
            «Probar» desde este paso cambiaba el estado y la pantalla no decía
            NADA — quedaba quieta, como si el botón estuviera roto.
            Es el mismo error que dejó muerto el lápiz de «Tus videos»: cambiar un
            estado que se renderiza en una rama que no se está mostrando. */}
        {avisoViejo}
        {avisoPermiso}
        {/* ⚠️ LOS DOS EN LA MISMA FILA Y DEL MISMO ALTO. «Volver» colgaba abajo,
            centrado y en `size="sm"`: tres diferencias para decir una sola cosa
            —que es la salida y no la acción— y el resultado era un botón más
            chico, en otro renglón, que se leía como de otra pieza. La jerarquía
            ya la dice la variante (primario contra secundario) y el ancho: el
            principal se estira, la salida ocupa lo que mide su palabra. */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <Button variant="secondary" onClick={() => setPaso('inicio')} style={{ flex: 'none' }}>Volver</Button>
          <Button variant="primary" onClick={() => void arrancar()} loading={ocupado} style={{ flex: 1 }}>
            Probar
          </Button>
        </div>
      </div>
    );
  }

  if (!activo) {
    return (
      <div style={box}>
        <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Probar que el Pixel de MaKo funcione</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
          {landingFija
            ? <>Probamos <b>{landingFija}</b>. La abrimos en otra pestaña y aquí ves llegar los eventos en vivo.</>
            : <>Elige la página que quieres probar. La abrimos en otra pestaña y aquí ves llegar los eventos en vivo.</>}
        </div>

        {/* ⚠️ EL SELECTOR SOLO APARECE SI NADIE ELIGIÓ ANTES. Desde que elegir la
            landing es el PASO 1, preguntarlo otra vez acá es preguntar dos veces
            lo mismo — y peor: deja que las dos respuestas difieran, así que el
            código de arriba sería de una página y la prueba de otra.
            El desplegable sigue existiendo para cuando este panel se usa suelto. */}
        {!landingFija && (
        <>
        {/* UN desplegable, no un desplegable AL LADO de un input. Las páginas que
            ya mandaron eventos las conoce el sistema; la última opción es la
            salida para una nueva, y recién ahí aparece dónde escribirla. Dos
            campos que hacen lo mismo obligan a elegir cuál usar antes de poder
            contestar la pregunta.
            Y es el `Select` de la casa: el <select> nativo está prohibido —no se
            puede estilar igual en todos los navegadores— y además este se
            renderiza en portal, así que el scroll del modal no lo recorta. */}
        <div style={{ marginTop: 14 }}>
          {/* Las GUARDADAS primero, después las que se detectaron solas por los
              eventos. La distinción importa: una guardada se puede corregir y
              borrar; una detectada es una observación, y elegirla la adopta. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                ariaLabel="Página a probar"
                value={eligiendoNueva ? NUEVA : url}
                onChange={(v) => { setUrl(v === NUEVA ? '' : v); setEligiendoNueva(v === NUEVA); setEditando(null); setVerif(null); }}
                placeholder="Elige una página…"
                options={[
                  ...paginas.map((u) => ({ value: u, label: u, acciones: accionesDe(u) })),
                  ...detectadas.map((u) => ({ value: u, label: u, sub: 'detectada — se guarda al probarla', acciones: accionesDe(u) })),
                  { value: NUEVA, label: 'Otra página…', sub: 'escribe la dirección' },
                ]}
              />
            </div>
            {/* Corregir y quitar, sobre la que esté elegida sea guardada o
                detectada. Al corregir una detectada, guardarla la ADOPTA — que
                es justo lo que hace falta cuando lo que llegó por los eventos es
                una URL de preview con un hash adelante y no la página real.
                `editando` solo viaja si estaba guardada: para una detectada no
                hay entrada previa que reemplazar, y mandarla haría que el server
                buscara algo que no está. */}
            {hayElegida && (
              <>
                {/* Verificar ESTA página. Vive acá y no al lado del código porque
                    la respuesta depende de cuál elegiste: es la misma distancia
                    física, pero la pregunta que contesta es otra. */}
                <IconBtn name="plug" title="Verificar si el Pixel está instalado en esta página" disabled={verificando} onClick={() => void verificarEsta()} />
                <IconBtn name="pen" title="Corregir esta dirección" onClick={() => { setEditando(guardadaElegida ? url : null); setEligiendoNueva(true); }} />
                <IconBtn name="trash" title="Quitar de la lista" tone="bad" disabled={ocupado} onClick={() => void borrar()} />
              </>
            )}
          </div>

          {/* El campo aparece solo cuando hace falta: escribir una nueva o
              corregir una que ya está. Un campo vacío al lado del desplegable es
              una pregunta de más en el 90% de los casos. */}
          {eligiendoNueva && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-pagina.com" inputMode="url" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && urlValida) void guardar(); }} />
              </div>
              <IconBtn name="check" title={editando ? 'Guardar el cambio' : 'Guardar esta página'} tone="good" disabled={!urlValida || ocupado} onClick={() => void guardar()} />
            </div>
          )}
          {verif && (
            <div style={{ marginTop: 9, padding: '11px 13px', borderRadius: 10, lineHeight: 1.5, fontSize: 12.5,
              border: `1px solid ${verif.instalada && !verif.vieja ? 'var(--good)' : 'var(--warn)'}`,
              background: verif.instalada && !verif.vieja ? 'var(--good-bg)' : 'var(--warn-bg)', color: 'var(--ink)' }}>
              {verif.texto}
            </div>
          )}
          {errPagina && <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--bad)' }}>{errPagina}</div>}
        </div>

        </>
        )}

        {/* UN solo botón. Siempre abre la página en otra pestaña: si la prueba
            depende de que la persona se acuerde de abrirla, la prueba no arranca. */}
        <div style={{ marginTop: 14 }}>
          <Button variant="primary" onClick={() => void arrancar()} loading={ocupado} disabled={!urlValida} style={{ width: '100%' }}>Probar</Button>
        </div>

        {avisoViejo}
        {avisoPermiso}

        {/* La salida para corregirse, y nada más que eso: un renglón que NOMBRA lo
            que ya está declarado y ofrece cambiarlo. No es el formulario abierto
            —eso vuelve a ser la tarea colgada que se acaba de sacar— sino la
            respuesta actual a la vista, que es lo único que permite darse cuenta
            de que uno se equivocó. */}
        {hayVideos && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {videosGuardados.length > 0
                ? <>Tus videos: {videosGuardados.map((v) => v.nombre).join(' · ')}</>
                : <>{candidatosVideo.length} {candidatosVideo.length === 1 ? 'video sin identificar' : 'videos sin identificar'} en tu página</>}
            </span>
            <IconBtn name="pen" title="Cambiar la identificación de cada video" onClick={() => setPaso('videos')} />
          </div>
        )}
      </div>
    );
  }


  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--good)', animation: 'pt-latido 1.4s infinite', flex: 'none' }} />
          <span style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Escuchando… {diag ? `· ${diag.veredicto}` : ''}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => {
          // En la ventana de prueba, «Terminar» la CIERRA: volver al desplegable
          // de páginas dentro de una ventana de 440 px no lleva a ningún lado, y
          // dejarla abierta y muda es peor que cerrarla.
          if (pruebaInicial) { window.close(); return; }
          cerrar(prueba);
        }}>Terminar</Button>
      </div>
      <style>{'@keyframes pt-latido{0%,100%{opacity:1}50%{opacity:.25}}'}</style>

      {/* ⚠️ QUÉ CAMBIÓ DESDE LA ÚLTIMA VEZ. El pedido del dueño fue textual: «una
          landing puede NO tener VSL en un principio y luego que los dueños le
          agreguen un VSL, MaKo debería en todo momento saber eso… y también al
          iniciar una prueba medir los nuevos datos o incluso dejar de medir
          datos que se sacaron».

          Sin esto, los chequeos cambiaban solos entre una prueba y la siguiente
          y nadie decía por qué: aparecían dos pasos nuevos, o desaparecían, y la
          persona quedaba pensando que el panel es inestable. Lo que cambió es
          una NOTICIA, y las noticias se cuentan.

          La frase de «sacaste» es asimétrica a propósito: aclara que los leads
          que ya entraron por ahí siguen estando. Sacar una pieza de la página no
          borra lo que esa pieza produjo, y sin esa línea el mensaje se lee como
          una amenaza. */}
      {cambios && (cambios.nuevas.length > 0 || cambios.sacadas.length > 0) && (() => {
        const nuevas = nombresDe(cambios.nuevas);
        const sacadas = nombresDe(cambios.sacadas);
        if (!nuevas.length && !sacadas.length) return null;
        const cuando = haceCuanto(cambios.desde);
        return (
          <div style={{
            fontSize: 12.5, lineHeight: 1.55, marginBottom: 12, padding: '10px 12px',
            borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-3, var(--surface-2))',
          }}>
            <b>Tu página cambió{cuando ? ` desde que la miré ${cuando}` : ''}.</b>{' '}
            {nuevas.length > 0 && <>Le agregaste <b>{enumerar(nuevas)}</b>, así que ya lo estoy midiendo{sacadas.length > 0 ? '. ' : '.'}</>}
            {sacadas.length > 0 && <>Sacaste <b>{enumerar(sacadas)}</b>, así que dejo de pedírtelo — lo que ya se registró por ahí sigue en tu CRM.</>}
          </div>
        );
      })()}

      {/* La instrucción cubre las DOS cosas que el código hace. Hasta el 14/08 solo
          hablaba del video, y para un negocio cuya landing es un formulario —el
          caso que destapó esto— la prueba entera parecía no ser para él.

          ⚠️ Y AHORA PIDE SOLO LO QUE ESA PÁGINA TIENE. Era una lista fija —«reproduce
          el video, haz clic en tus botones y completa tu formulario»— y al cliente
          del 24/08 le pedía DOS cosas que su landing no tiene: no tiene video y no
          tiene formulario, vende por una agenda embebida. Es la misma queja que
          los chequeos 2 y 3, en el renglón de arriba: no alcanza con apagar los
          pasos si la instrucción sigue mandando a hacer lo imposible.
          Sale de los chequeos que el server ya calculó, así que no hay una segunda
          lista que mantener al día — que es como esta se quedó vieja. */}
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 12 }}>
        Abrimos tu página en otra pestaña. {(() => {
          const pedir = (diag?.chequeos ?? [])
            .filter((c) => c.estado !== 'ok' && c.estado !== 'na')
            .map((c) => QUE_HACER[c.id] ?? (c.id === 'optin' ? (/agenda/i.test(c.label) ? 'reserva un horario en tu calendario' : 'completa tu formulario') : null))
            .filter((x): x is string => !!x);
          // Sin diagnóstico todavía, o con todo en verde, va la lista completa: es
          // mejor pedir de más que dejar la instrucción muda mientras carga.
          const lista = pedir.length ? pedir : ['reproduce el video unos segundos', 'haz clic en tus botones', 'completa tu formulario'];
          return (
            <>Prueba allí {lista.length > 1 ? 'lo que uses' : 'esto'}: {lista.map((t, i) => (
              <span key={t}>{i > 0 && (i === lista.length - 1 ? ' y ' : ', ')}<b>{t}</b></span>
            ))}.</>
          );
        })()} Los eventos aparecen
        aquí en unos segundos, y <b>solo se muestran los de esta prueba</b>: no las visitas del día ni
        las de otras personas que estén en tu página ahora.
      </div>

      {/* Los chequeos: qué anda y qué no, en criollo. El total lo dice el server
          (), no un número escrito acá: estuvo diciendo «de 4» cuando ya
          eran cinco. */}
      {/* ⚠️ LOS QUE NO APLICAN SALEN DE LA LISTA. Estaban mezclados con los demás,
          en gris y con su explicación entera, y eso convertía «esto no existe en
          tu página» en un renglón del mismo peso que «esto está fallando». El
          pedido fue textual: «su landing NO tiene video… que no aparezca el punto
          2 y 3, de última en algún otro lugar el mensaje de "no hay video"».
          Así que bajan a UN renglón al pie, que es donde va lo que no hay que
          hacer: sigue estando —esconderlo del todo dejaría a alguien buscando por
          qué su video no se mide— pero deja de ocupar el lugar de una tarea. */}
      {diag && (() => {
        const aplican = diag.chequeos.filter((c) => c.estado !== 'na');
        const noAplican = diag.chequeos.filter((c) => c.estado === 'na');
        // El número se pone acá y no en el label: sacando el 2 y el 3, un número
        // escrito a mano dejaba la lista en «1, 4, 5». Se cuentan solo los pasos
        // del embudo que de verdad se están pidiendo.
        let n = 0;
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {aplican.map((c) => {
            const num = c.paso ? ++n : null;
            return (
            <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: COLOR[c.estado] }}>{ICONO[c.estado]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: c.estado === 'ok' ? 'var(--ink)' : 'var(--dim)' }}>{num ? `${num}. ` : ''}{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, lineHeight: 1.45 }}>{c.detalle}</span>
                {/* El href lo arma el SERVER con el id real de la propuesta. Un
                    chequeo que dice «tenés 8 sin revisar» y no lleva a ningún
                    lado deja la misma tarea sin hacer que no decir nada. */}
                {c.accion && (
                  <a href={c.accion.href} style={{ display: 'inline-block', marginTop: 4, fontSize: 12.5, fontWeight: 650, color: 'var(--primary)' }}>{c.accion.texto} →</a>
                )}
              </span>
            </div>
            );
          })}

          {noAplican.length > 0 && (
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 3, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--faint)' }}>–</span>
              <span style={{ minWidth: 0, fontSize: 12, color: 'var(--faint)', lineHeight: 1.45 }}>
                No aplican a tu página: <b style={{ fontWeight: 650 }}>{noAplican.map((c) => c.label.toLowerCase()).join(' · ')}</b>.
                {/* ⚠️ Los motivos van SIN REPETIR. Los dos pasos de video comparten
                    razón —«tu página no tiene video»— y concatenados a secas la
                    frase salía dos veces seguidas, palabra por palabra, que se lee
                    como un error de la pantalla y no como una explicación. */}
                {' '}{[...new Set(noAplican.map((c) => c.detalle))].join(' ')}
              </span>
            </div>
          )}
        </div>
        );
      })()}

      {/* Los eventos crudos, como el Test Events de Meta. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', maxHeight: 260, overflowY: 'auto' }}>
        {cargando && !diag && <div style={{ padding: 16, fontSize: 13, color: 'var(--faint)' }}>Conectando…</div>}
        {diag && diag.eventos.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--faint)', lineHeight: 1.55 }}>
            Aún no llega nada de esta prueba. Navega un poco por la pestaña que abrimos: si no aparece nada, el Pixel no está instalado o esa página no se publicó.
          </div>
        )}
        {diag?.eventos.map((e, i) => {
          const l = legible(e);
          return (
            <div key={`${e.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{hora(e.ts)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: l.color, flex: 1, minWidth: 0 }}>{l.texto}</span>
              {e.segundos != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{Math.round(e.segundos)}s</span>}
            </div>
          );
        })}
      </div>

      {/* ⚠️ LA GRABACIÓN DE ESTA PRUEBA, que ahora es PROPIA. Antes esto era un
          link al panel de Clarity y una advertencia de que tardaba entre 30
          minutos y 2 horas. El estado de si llegó lo dice el chequeo «Grabación
          de la sesión», que sale del server junto con los demás; acá queda el
          renglón que cambia mientras se mira y el botón para verla.

          ⚠️ Y EL BOTÓN NO ABRE UN REPRODUCTOR ACÁ: crea (o reusa) el lead PRUEBA
          de ese producto y lleva a su ficha, que es donde el reproductor ya vive
          (app/crm/lead-view/GrabacionModal.tsx). Pedido de Martín el 06/10/2026,
          textual: «que simplemente se cree un lead de PRUEBA en el CRM en ese
          producto. Con el nombre de PRUEBA. Y allí se podrá ver esa grabación.»
          El porqué, en app/integraciones/prueba-lead-actions.ts.

          ⚠️ Y SÓLO CUANDO SE PUEDE VER. Con `lista: false` la grabación llegó y
          todavía no se selló el cuerpo (el cron corre cada 10 minutos): la
          ficha se abriría con la sesión en la lista y sin nada que reproducir, o
          sea un botón que lleva a una pantalla que no cumple. Se dice cuánto
          falta y el botón aparece solo. */}
      {diag?.grabacion && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5, flex: '0 1 auto' }}>
            {diag.grabacion.lista
              ? `Grabé esta prueba: ${Math.round(diag.grabacion.segundos)}s.`
              : `Grabé esta prueba: ${Math.round(diag.grabacion.segundos)}s. Se termina de guardar en unos minutos.`}
          </div>
          {diag.grabacion.lista && (
            <Button variant="secondary" size="sm" disabled={abriendoFicha} onClick={() => { void verLaGrabacion(); }}>
              {abriendoFicha ? 'Abriendo…' : 'Ver la grabación'}
            </Button>
          )}
        </div>
      )}
      {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
