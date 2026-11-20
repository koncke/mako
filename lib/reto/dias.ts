// =============================================================================
// EL RETO DE 7 DÍAS: qué tiene cada día y en qué día va la persona (18/11/2026)
// =============================================================================
// La especificación es la maqueta del onboarding (C:/dev/artefactos-onboarding, «La 10.ª vuelta» de su LEEME) con las decisiones
// de Martín del 16 al 18/11 (la memoria `onboarding-16-11-decisiones`). Puro, sin base: lo usan la API (app/api/reto/route.ts),
// el chat «Reto de 7 días» del Ops Center y su desplegable, y los tests.
//
//   · Cada día: su título, su mensaje, su video (la key del manifiesto de public/tutoriales: `reto-dia-<n>`) y sus tareas.
//   · Una tarea NO tiene botón de atajo (Martín, 18/11: «ese tipo de botones jamás»): trae dónde se toca (`marcas`, en orden) y el
//     motor de los tutoriales oscurece la pantalla y lo señala (app/_ui/tutorial). La hace la persona.
//   · La prueba por WhatsApp de cada día: SIEMPRE escribe ella primero (así WhatsApp no frena a MaKo), y prueba otra función.
//   · Nada invasivo: el día 3 no pide la lista de clientes por WhatsApp («súper invasivo y da desconfianza»); la carga la hace la
//     persona en el CRM.
// =============================================================================

// Las marcas de la barra y de Settings son las del chat de las pestañas: importadas, para que un cambio de nombre no deje al reto
// señalando algo que ya no existe (pasó el 18/11: la foto pasó de `tour-sidebar-perfil` a `tour-barra-foto`).
import { MARCA, conMarca, marcaSettings } from '../tutoriales/marcas';

/** Una marca del motor: dónde tocar, con su tarjeta. */
export type MarcaReto = { sel: string; titulo: string; texto: string; haz: string; lado?: 'arriba' | 'abajo' | 'izquierda' | 'derecha'; libre?: boolean };

export type TareaReto = {
  id: string;
  titulo: string;
  /** Dónde se hace, con palabras («En CRM», «En Settings › Integraciones»). */
  donde: string;
  detalle: string;
  /** Los lugares que se tocan, en orden (la barra, el menú de la foto, una sección): el motor los marca de a uno. */
  marcas: MarcaReto[];
};

export type PruebaWhatsApp = {
  /** Lo que dice la tarjeta. */
  texto: string;
  /** Un ejemplo de lo que puede mandarle. */
  ejemplo: string;
  /** El mensaje que va escrito al abrir WhatsApp (sin él, se abre el chat para grabar el audio). */
  escrito?: string;
  audio?: boolean;
};

export type DiaReto = { n: number; titulo: string; mensaje: string; video: string; tareas: TareaReto[]; whatsapp?: PruebaWhatsApp };

/** La pestaña de la barra (app/_components/Sidebar.tsx: cada fila es un link a su ruta). */
const enLaBarra = (ruta: string, nombre: string, texto: string): MarcaReto => ({
  sel: `aside[data-sidebar] a[href^="${ruta}"]`, titulo: nombre, texto, haz: `Haz clic en ${nombre}`, lado: 'derecha',
});

export const RETO_TITULO = 'Reto de 7 días';
/** Martín, 18/11, textual. */
export const RETO_SUB = 'Cada día un video para que avances con tu negocio. Puedes adelantar días cuando quieras.';
export const RETO_HOLA = (nombre: string) => `¡Hola${nombre ? `, ${nombre}` : ''}! Éste es tu reto de 7 días. ${RETO_SUB}`;

/** «En X › Y»: la ruta va aparte para que empiece por la tab de la barra (tests/mako-nombres-de-tabs.test.ts). */
const en = (ruta: string): string => `En ${ruta}`;

/**
 * El video de un día del reto como TUTORIAL (Martín, 18/11: «que el video del día 2 pause en cada cosa que pide»): sus pasos son las
 * marcas de sus tareas, en orden. Con frases con `sel` en el manifiesto, el motor marca cada lugar cuando la voz lo nombra y pausa
 * hasta el clic (app/_ui/tutorial/MotorTutorial.tsx); el video corre en el cuadrito de abajo a la derecha, que sigue al navegar.
 */
export function tutorialDelDia(d: DiaReto): import('@/lib/tutoriales').TutorialPestana {
  return {
    pestana: d.video, nombre: `Día ${d.n}`, ruta: '/second-brain', intro: d.mensaje,
    // `libre` viaja con el paso (20/11): sin él, el motor tapaba la página alrededor de «Settings» y el menú de la foto se cerraba.
    pasos: d.tareas.flatMap((t) => t.marcas.map((m) => ({ sel: m.sel, titulo: m.titulo, texto: m.texto, ...(m.lado ? { lado: m.lado } : {}), ...(m.libre ? { libre: true as const } : {}) }))),
  };
}

/**
 * Las tareas del día que cierra tocar ese lugar: las que tienen ESE lugar como su última marca (el Cerebro, 18/11: «lo que la persona
 * ya hizo tocando lo marcado durante el video cuenta como HECHO en la lista del día… nunca pide dos veces lo mismo»).
 */
export function tareasQueCierra(d: DiaReto, sel: string): string[] {
  const norm = (x: string) => x.split(',').map((y) => y.replace(/\s+/g, ' ').trim());
  const tocado = norm(sel);
  return d.tareas.filter((t) => { const u = t.marcas[t.marcas.length - 1]; return !!u && norm(u.sel).some((x) => tocado.includes(x)); }).map((t) => t.id);
}

export const DIAS_RETO: readonly DiaReto[] = [
  {
    // DOS TAREAS, EN ORDEN (18/11/2026; Martín, 15/11: «al terminar el onboarding, Oferta y Funnel Coach en DOS chats separados»): la
    // oferta con el Offer Coach y después el sistema para conseguir clientes con el Funnel Coach. La marca lleva de uno al otro: la
    // fila de cada coach (app/second-brain/ChatSecondBrain.tsx, `sb-offer` y `sb-funnel`). El reto es del onboarding V2, y con él
    // están los dos coaches (el mismo interruptor). ⚠️ El id de la segunda sigue siendo 'funnel': lo guardado antes (`1:funnel`) vale.
    n: 1, titulo: 'Tu oferta y tu sistema de adquisición', video: 'reto-dia-1',
    mensaje: 'Hoy es tu día 1. Tu onboarding ya está; ahora tu oferta, con Offer Coach, y después tu sistema para conseguir clientes, con Funnel Coach.',
    tareas: [
      { id: 'offer', titulo: 'Tu oferta, con Offer Coach', donde: 'En el Ops Center', detalle: 'Te pregunta como un coach y te deja el diagnóstico de tu oferta.',
        marcas: [{ sel: '[data-recorrido="sb-offer"]', titulo: 'Tu día 1 sigue en Offer Coach', texto: 'Ahí armamos tu oferta.', haz: 'Haz clic en Offer Coach', lado: 'derecha' }] },
      { id: 'funnel', titulo: 'Tu sistema para conseguir clientes, con Funnel Coach', donde: 'En el Ops Center', detalle: 'Con tu oferta ya hecha, elige contigo tu funnel y su plan.',
        marcas: [{ sel: '[data-recorrido="sb-funnel"]', titulo: 'Ahora, Funnel Coach', texto: 'Ahí armas tu sistema para conseguir clientes.', haz: 'Haz clic en Funnel Coach', lado: 'derecha' }] },
    ],
  },
  {
    n: 2, titulo: 'Conecta todo: la app, la extensión y tus integraciones', video: 'reto-dia-2',
    mensaje: 'Día 2: conectamos todo, de a un paso. Primero la app de MaKo en tu teléfono; después la extensión para Chrome y tus integraciones.',
    tareas: [
      // Martín, 18/11: «MaKo con tu teléfono» no se entiende, «pareciera que está hablando de MaKo con WhatsApp otra vez… es la
      // aplicación de MaKo en tu teléfono». Se nombra la APP, aparte de MaKo por WhatsApp.
      { id: 'app', titulo: 'La app de MaKo en tu teléfono', donde: en('Settings › Instalar la app'), detalle: 'Escanea el QR e instala la app de MaKo: los avisos de tu negocio, al instante. Es aparte de MaKo por WhatsApp.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tu cuenta', texto: 'Lo de tu cuenta está en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'Todo lo de tu cuenta y tu negocio.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          { sel: conMarca(marcaSettings('instalar')), titulo: 'Instalar la app', texto: 'Ahí está el QR para tu teléfono.', haz: 'Haz clic en Instalar la app', lado: 'derecha' },
        ] },
      { id: 'extension', titulo: 'La extensión para Chrome', donde: en('Settings › Instalar la app'), detalle: 'MaKo a mano mientras navegas.',
        marcas: [{ sel: conMarca(marcaSettings('instalar')), titulo: 'La extensión', texto: 'En la misma sección, la extensión para Chrome.', haz: 'Haz clic en Instalar la app', lado: 'derecha' }] },
      { id: 'integraciones', titulo: 'Las integraciones de lo que elegiste', donde: en('Settings › Integraciones'), detalle: 'Sólo las de tu funnel: no se conectan aquí.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tus integraciones', texto: 'Están en Settings, en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'Todo lo de tu cuenta y tu negocio.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          { sel: conMarca(marcaSettings('integraciones')), titulo: 'Integraciones', texto: 'Aquí conectas lo que necesita tu funnel.', haz: 'Haz clic en Integraciones', lado: 'derecha' },
        ] },
      { id: 'perfil', titulo: 'Tu perfil y tu foto', donde: en('Settings › Perfil'), detalle: 'Lo que contaste en el chat ya está guardado.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tu perfil', texto: 'Está en Settings, en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'La primera sección es tu perfil.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          // 19/11: la última marca es la sección Perfil (la que marca el video del día 2, `tour-settings-info`). Con Settings como
          // última, tocar Settings en el video cerraba «Tu perfil y tu foto» antes de llegar al perfil, y tocar Perfil no cerraba nada.
          { sel: conMarca(marcaSettings('info')), titulo: 'Perfil', texto: 'Tu nombre y tu foto: lo que contaste en el chat ya está guardado.', haz: 'Haz clic en Perfil', lado: 'derecha' },
        ] },
    ],
    whatsapp: { texto: 'Dile a MaKo a qué hora te escribe sobre el reto: le escribes tú primero, así WhatsApp no frena sus mensajes.', ejemplo: '«Hola MaKo, prefiero que me escribas a las 9:00 sobre el reto.»', escrito: 'Hola MaKo, prefiero que me escribas a las {hora} sobre el reto.' },
  },
  {
    // Martín, 18/11: «no lo llamaría el día 3 de difusión de WhatsApp, porque hay muchos que no usan WhatsApp y hacen sus mensajes
    // por Instagram, otros por email… tu primera automatización de mensajes o de respuestas a clientes». Sin atarla a un canal.
    n: 3, titulo: 'Tus contactos y tu primera automatización', video: 'reto-dia-3',
    mensaje: 'Día 3: tus contactos y tu primera automatización. Cargas tus clientes en el CRM y dejas a MaKo respondiendo por el canal que usas: WhatsApp, Instagram o email.',
    tareas: [
      { id: 'contactos', titulo: 'Carga tus clientes en el CRM', donde: 'En CRM', detalle: 'Con un CSV, aunque vengan de otro sistema.',
        // 19/11: decía «si ya usas otro CRM, lo integramos», que promete un equipo. Lo que hay es importar un CSV (app/crm/ImportarLeadsModal.tsx).
        marcas: [enLaBarra('/crm', 'CRM', 'Ahí cargas tus clientes con un CSV, aunque vengan de otro sistema.')] },
      { id: 'automatizacion', titulo: 'Tu primera automatización de mensajes', donde: 'En Automations', detalle: 'Que MaKo atienda solo a tus clientes, por el canal que usas: WhatsApp, Instagram o email.',
        marcas: [
          enLaBarra('/automations', 'Automations', 'Aquí armas tu primera automatización de mensajes.'),
          // «Atiende MaKo» de Chats es sólo un filtro (las charlas que ya atiende MaKo): la respuesta automática se arma aquí.
          { sel: 'aside[aria-label="Tus automatizaciones"] button.chb-nueva', titulo: 'Nueva automatización', texto: 'Pídesela a MaKo con tus palabras: qué responder y por qué canal.', haz: 'Haz clic en Nueva automatización', lado: 'derecha' },
        ] },
      { id: 'calendar', titulo: 'Conecta tu calendario', donde: 'En Calendar', detalle: 'Las llamadas que agenden caen en tu agenda.',
        marcas: [enLaBarra('/calendario', 'Calendar', 'Conecta tu calendario: las llamadas caen en tu agenda.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: mándale a MaKo un audio pidiéndole que cargue un lead a tu CRM.', ejemplo: '«MaKo, carga a Juan Pérez en mi CRM: me escribió por Instagram y quiere el programa.»', audio: true },
  },
  {
    n: 4, titulo: 'Copia lo que le funciona a tu competencia', video: 'reto-dia-4',
    mensaje: 'Día 4: lo que ya le funciona a tu competencia, y tu página con esa estructura.',
    tareas: [
      { id: 'spy', titulo: 'Agrega 3 competidores', donde: 'En Competitor Spy', detalle: 'Mira lo que más tiempo llevan activo.',
        marcas: [enLaBarra('/competitor-spy', 'Competitor Spy', 'Agrega a 3 competidores y mira lo que más les funciona.')] },
      { id: 'web', titulo: 'Replica una página que ya vende', donde: 'En Web Generator', detalle: 'Pegas su página y la arma con tu oferta.',
        marcas: [enLaBarra('/web-generator', 'Web Generator', 'Pegas su página y la replica con tu oferta.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: pregúntale a MaKo qué le está funcionando a tu competencia.', ejemplo: '«¿Qué le está funcionando a mi competencia?»', escrito: '¿Qué le está funcionando a mi competencia?' },
  },
  {
    n: 5, titulo: 'Tu carrusel y tu guion', video: 'reto-dia-5',
    mensaje: 'Día 5: una semana de contenido, sin hoja en blanco, replicando lo que ya funcionó.',
    tareas: [
      { id: 'carrusel', titulo: 'Tu carrusel', donde: 'En Image', detalle: 'Replicas un carrusel que ya funcionó, con tu oferta.',
        marcas: [enLaBarra('/image-editor', 'Image', 'Replica un carrusel que ya funcionó, con tu oferta.')] },
      { id: 'guion', titulo: 'Tu guion', donde: 'En Copywriting', detalle: 'Replicando a tu referente.',
        marcas: [enLaBarra('/copywriter', 'Copywriting', 'Tu guion, replicando a tu referente.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: mándale a MaKo un audio con la idea de tu guion y te lo escribe.', ejemplo: '«Quiero un guion sobre por qué las dietas fallan…»', audio: true },
  },
  {
    n: 6, titulo: 'Tu video con IA', video: 'reto-dia-6',
    // 19/11: decía «el clip de 10 segundos va de regalo», y en la app no hay clip de regalo: la prueba deja hacer un video con el
    // personaje (`prueba.avatares`, lib/topes-plan.ts). Y «AI Avatar» ya no es una tab: es «Tu personaje con IA», en Video › Crear desde cero.
    mensaje: 'Día 6: tu video con IA, sin grabarte: tu personaje y tu primer clip.',
    tareas: [
      { id: 'personaje', titulo: 'Tu personaje con IA', donde: en('Video › Tu personaje con IA'), detalle: 'Con una foto tuya.',
        marcas: [enLaBarra('/video-editor', 'Video', 'Tu personaje con IA está en Video, con una foto tuya.')] },
      { id: 'clip', titulo: 'Tu primer clip con tu personaje', donde: en('Video › Tu personaje con IA'), detalle: 'Con el gancho de tu guion.',
        marcas: [enLaBarra('/video-editor', 'Video', 'Tu primer clip, con el gancho de tu guion.')] },
    ],
  },
  {
    n: 7, titulo: 'Tu Marketing CoPilot', video: 'reto-dia-7',
    mensaje: 'Día 7, el último: tu CoPilot revisa todo lo que armaste y te deja tu semana en el Plan.',
    tareas: [
      { id: 'copilot', titulo: 'Abre tu Marketing CoPilot', donde: 'En Marketing CoPilot', detalle: 'Revisa tu oferta, tu página y tu contenido.',
        marcas: [enLaBarra('/ads-manager/copiloto', 'Marketing CoPilot', 'Revisa todo lo que armaste y te dice qué hacer cada semana.')] },
      { id: 'semana', titulo: 'Tu semana, en tu Plan', donde: 'En Plan', detalle: 'El CoPilot te deja las tareas de cada semana.',
        marcas: [enLaBarra('/plan', 'Plan', 'Ahí te deja las tareas de cada semana.')] },
    ],
    whatsapp: { texto: 'Cuéntale a MaKo cómo te fue con el reto: mándale un audio por WhatsApp. Lo escucha Martín.', ejemplo: '«Me sirvió mucho el día 4…»', audio: true },
  },
];

// ── En qué día va ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que se guarda por negocio (`app_settings` → `reto.estado`). */
export type EstadoReto = { v: 1; inicio: string; adelantado: number; hechas: Record<string, string>; horaWa?: string;
  /** El último día del que salió el correo «Día N del reto de MaKo» (lib/reto/correos.ts): uno por día, una vez. */
  avisado?: number };

export const CLAVE_RETO = 'reto.estado';
export const HORAS_WA = ['8:00', '9:00', '10:00', '12:00', '15:00', '18:00', '20:00'] as const;

/** Lo guardado, validado (algo raro = sin reto). */
export function leerEstado(crudo: unknown): EstadoReto | null {
  let x: unknown = crudo;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return null; } }
  if (!x || typeof x !== 'object') return null;
  const e = x as Partial<EstadoReto>;
  if (typeof e.inicio !== 'string' || Number.isNaN(Date.parse(e.inicio))) return null;
  const hechas: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.hechas && typeof e.hechas === 'object' ? e.hechas : {})) if (/^\d:[a-z-]+$/.test(k) && typeof v === 'string') hechas[k] = v;
  const adelantado = Number.isInteger(e.adelantado) ? Math.max(1, Math.min(7, Number(e.adelantado))) : 1;
  const horaWa = typeof e.horaWa === 'string' && (HORAS_WA as readonly string[]).includes(e.horaWa) ? e.horaWa : undefined;
  const avisado = Number.isInteger(e.avisado) ? Math.max(1, Math.min(7, Number(e.avisado))) : undefined;
  return { v: 1, inicio: e.inicio, adelantado, hechas, ...(horaWa ? { horaWa } : {}), ...(avisado ? { avisado } : {}) };
}

/** La hora de Argentina (la de MaKo), UTC−3. */
const HORA_AR = -3;
/** El día de calendario de Argentina de un instante (días desde 1970). */
const diaAr = (ms: number) => Math.floor((ms + HORA_AR * 3_600_000) / 86_400_000);
/** La hora (con minutos, en horas) de Argentina de un instante. */
const horaAr = (ms: number) => (((ms + HORA_AR * 3_600_000) % 86_400_000) + 86_400_000) % 86_400_000 / 3_600_000;
const horaDe = (h: string | undefined) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h ?? '9:00'); return m ? Number(m[1]) + Number(m[2]) / 60 : 9; };

/**
 * El último día ABIERTO: el día 1 se abre al empezar; cada uno de los que siguen, al día de calendario siguiente a la hora de su
 * aviso (la que eligió por WhatsApp, o las 9:00), o antes si lo adelantó.
 */
export function diaAbierto(e: EstadoReto, ahora: number): number {
  const ini = Date.parse(e.inicio);
  const pasados = diaAr(ahora) - diaAr(ini);
  const porCalendario = pasados <= 0 ? 1 : 1 + pasados - (horaAr(ahora) < horaDe(e.horaWa) ? 1 : 0);
  return Math.max(1, Math.min(7, Math.max(porCalendario, e.adelantado)));
}

export const claveTarea = (dia: number, id: string) => `${dia}:${id}`;
export const tareaHecha = (e: EstadoReto, dia: number, id: string) => !!e.hechas[claveTarea(dia, id)];

// ── El paso de Offer Coach a Funnel Coach (18/11/2026) ────────────────────────────────────────────────────────────────────────
// Martín, sobre la maqueta: «me manda la oferta con el PDF para descargar… pero apenas me la manda automáticamente ya sale el botón
// para hacer clic en Funnel Coach. Eso no tiene sentido… mínimo déjame verla». La marca de la segunda tarea del día 1 sale desde el
// Offer Coach (app/second-brain/reto/usePasoAlFunnel.ts) recién cuando la persona VIO la oferta: hizo algo con ella (descargó el
// PDF, bajó hasta el final o escribió) o pasó un tiempo de lectura. Nunca en el acto, nunca con MaKo escribiendo.

/** Lo que tarda en leerse una oferta entregada antes de marcar Funnel Coach sin que la persona haga nada. */
export const LECTURA_DE_LA_OFERTA_MS = 20_000;

/** ¿Ya se marca Funnel Coach? `entregadaEn`: cuándo se entregó la oferta (null = no se entregó en esta visita). */
export function marcaAlFunnelYa(p: { entregadaEn: number | null; ahora: number; gesto: boolean; ocupado: boolean }): boolean {
  if (p.entregadaEn == null || p.ocupado) return false;
  return p.gesto || p.ahora - p.entregadaEn >= LECTURA_DE_LA_OFERTA_MS;
}

/** La oferta del Offer Coach, como la cuenta para saber si se acaba de entregar (lib/funnel-plan.ts → OfertaDelCoach). */
type OfertaVista = { estado: 'hay'; nombre: string; de: string } | { estado: 'no-hay' } | { estado: 'no-se' };

/**
 * ¿Se acaba de entregar una oferta? Lo que había al abrir el chat contra lo que hay después de un turno: una oferta que aparece o
 * cambia (otro nombre, o pasó de armada a guardada). La del perfil no cuenta (nadie la armó), y «no se sabe» nunca es una entrega.
 */
export function ofertaRecienEntregada(antes: OfertaVista | null, ahora: OfertaVista | null): boolean {
  if (!antes || !ahora || ahora.estado !== 'hay' || ahora.de === 'perfil' || antes.estado === 'no-se') return false;
  return antes.estado !== 'hay' || antes.nombre !== ahora.nombre || antes.de !== ahora.de;
}

export type EstadoDia = 'hecho' | 'medias' | 'hoy' | 'luego';

/** Cómo está cada día: hecho (todas sus tareas), a medias (pasó y falta algo), hoy (el abierto) o luego. */
export function estadoDeLosDias(e: EstadoReto | null, ahora: number): { abierto: number; dias: EstadoDia[]; hechos: number } {
  if (!e) return { abierto: 0, dias: DIAS_RETO.map(() => 'luego'), hechos: 0 };
  const abierto = diaAbierto(e, ahora);
  const dias = DIAS_RETO.map((d): EstadoDia => {
    const todas = d.tareas.every((t) => tareaHecha(e, d.n, t.id));
    if (d.n > abierto) return 'luego';
    if (todas) return 'hecho';
    return d.n === abierto ? 'hoy' : 'medias';
  });
  return { abierto, dias, hechos: dias.filter((x) => x === 'hecho').length };
}

/** La próxima tarea que falta (la del día más viejo primero: lo pendiente pasa primero). */
export function proximaTarea(e: EstadoReto, ahora: number): { dia: DiaReto; tarea: TareaReto } | null {
  const abierto = diaAbierto(e, ahora);
  for (const d of DIAS_RETO) {
    if (d.n > abierto) break;
    const t = d.tareas.find((x) => !tareaHecha(e, d.n, x.id));
    if (t) return { dia: d, tarea: t };
  }
  return null;
}

/** El mensaje escrito de la prueba por WhatsApp, con la hora elegida. */
export const mensajeEscrito = (p: PruebaWhatsApp, hora = '9:00') => (p.escrito ? p.escrito.replace('{hora}', hora) : '');

// ── El correo de cada día ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * EL CORREO «DÍA N DEL RETO DE MaKo» (Martín, 18/11: «el asunto "Martín MaKo · Día 3 tu video de hoy" no tiene sentido. Va "Día 3 del
 * reto de MaKo", y lo mismo en todos los días»). Corto: qué toca hoy y el link al chat del reto. Lo manda lib/reto/correos.ts.
 */
export function correoDelDia(n: number, link: string): { asunto: string; preheader: string; cuerpo: string } {
  const d = DIAS_RETO.find((x) => x.n === n) ?? DIAS_RETO[0];
  return {
    asunto: `Día ${d.n} del reto de MaKo`,
    preheader: d.titulo,
    cuerpo: [
      `Ya está tu día ${d.n}: ${d.titulo.toLowerCase()}.`,
      '',
      d.mensaje,
      '',
      'Lo que te toca hoy:',
      ...d.tareas.map((t) => `· ${t.titulo} (${t.donde.replace(/^En /, 'en ')})`),
      '',
      'Tu video y todo lo del día, en el chat «Reto de 7 días» de MaKo:',
      link,
    ].join('\n'),
  };
}

/** ¿Toca mandar el correo de un día? El del día abierto, si todavía no salió (el día 1 no lleva: se empieza adentro de MaKo). */
export function diaParaAvisar(e: EstadoReto, ahora: number): number | null {
  const abierto = diaAbierto(e, ahora);
  return abierto > 1 && abierto > (e.avisado ?? 1) ? abierto : null;
}
