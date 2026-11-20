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
import { MARCA, conMarca, marcaIntegracion, marcaSettings } from '../tutoriales/marcas';

/** Una marca del motor: dónde tocar, con su tarjeta. */
export type MarcaReto = { sel: string; titulo: string; texto: string; haz: string; lado?: 'arriba' | 'abajo' | 'izquierda' | 'derecha'; libre?: boolean;
  /** Sin clic: la marca muestra y espera este botón («Entendido»), como la foto del perfil de la maqueta (d24-20). */
  listo?: string;
  /** Con su propio texto aunque sea la última (`marcasDeLaTarea` le pone el de la tarea a las demás): la integración que le toca (d24-05). */
  propia?: true };

export type TareaReto = {
  id: string;
  titulo: string;
  /** Dónde se hace, con palabras («En CRM», «En Settings › Integraciones»). */
  donde: string;
  detalle: string;
  /** Los lugares que se tocan, en orden (la barra, el menú de la foto, una sección): el motor los marca de a uno. */
  marcas: MarcaReto[];
  /** Hecha desde el principio, sin nada que hacer ni marcar: «Tu onboarding» (el reto empieza al terminarlo; D1-14). */
  siempre?: true;
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
  // La última marca que se TOCA: una con «Entendido» (`listo`, la foto del perfil) no se toca.
  return d.tareas.filter((t) => { const u = [...t.marcas].reverse().find((m) => !m.listo); return !!u && norm(u.sel).some((x) => tocado.includes(x)); }).map((t) => t.id);
}

export const DIAS_RETO: readonly DiaReto[] = [
  {
    // DOS TAREAS, EN ORDEN (18/11/2026; Martín, 15/11: «al terminar el onboarding, Oferta y Funnel Coach en DOS chats separados»): la
    // oferta con el Offer Coach y después el sistema para conseguir clientes con el Funnel Coach. La marca lleva de uno al otro: la
    // fila de cada coach (app/second-brain/ChatSecondBrain.tsx, `sb-offer` y `sb-funnel`). El reto es del onboarding V2, y con él
    // están los dos coaches (el mismo interruptor). ⚠️ El id de la segunda sigue siendo 'funnel': lo guardado antes (`1:funnel`) vale.
    // Los textos, de la maqueta (20/11, auditoría D1-14). «Tu onboarding» va primero y ya hecha: el reto empieza al terminarlo
    // (`siempre`: no hay nada que leer ni que marcar).
    n: 1, titulo: 'Tu onboarding, tu oferta y tu sistema de adquisición', video: 'reto-dia-1',
    mensaje: 'Hoy es tu día 1. Tu onboarding ya está; ahora tu oferta, con Offer Coach, y tu sistema de adquisición de clientes, con Funnel Coach. Empecemos por tu oferta.',
    tareas: [
      { id: 'onboarding', titulo: 'Tu onboarding', donde: 'En el Ops Center', detalle: 'Lo hiciste al entrar.', marcas: [], siempre: true },
      { id: 'offer', titulo: 'Tu oferta, con Offer Coach', donde: 'En el Ops Center', detalle: 'Con su diagnóstico y el PDF.',
        marcas: [{ sel: '[data-recorrido="sb-offer"]', titulo: 'Tu día 1 sigue en Offer Coach', texto: 'Ahí armamos tu oferta.', haz: 'Haz clic en Offer Coach', lado: 'derecha' }] },
      { id: 'funnel', titulo: 'Tu sistema de adquisición, con Funnel Coach', donde: 'En el Ops Center', detalle: 'Elige tu funnel.',
        marcas: [{ sel: '[data-recorrido="sb-funnel"]', titulo: 'Ahora, Funnel Coach', texto: 'Ahí armas tu sistema de adquisición de clientes.', haz: 'Haz clic en Funnel Coach', lado: 'derecha' }] },
    ],
  },
  {
    n: 2, titulo: 'Conecta todo: la app, la extensión y tus integraciones', video: 'reto-dia-2',
    mensaje: 'Día 2: conectamos todo. Dale play: te muestro la app, la extensión y tus integraciones.',
    tareas: [
      // Martín, 18/11: «MaKo con tu teléfono» no se entiende, «pareciera que está hablando de MaKo con WhatsApp otra vez… es la
      // aplicación de MaKo en tu teléfono». Se nombra la APP, aparte de MaKo por WhatsApp.
      { id: 'app', titulo: 'Instala la app de MaKo en tu teléfono', donde: en('Settings › Instalar la app'), detalle: 'Escanea el QR del día 2. Es aparte de MaKo por WhatsApp.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tu cuenta', texto: 'Lo de tu cuenta está en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'Todo lo de tu cuenta y tu negocio.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          { sel: conMarca(marcaSettings('instalar')), titulo: 'Instalar la app', texto: 'Ahí está el QR para tu teléfono.', haz: 'Haz clic en Instalar la app', lado: 'derecha' },
        ] },
      { id: 'extension', titulo: 'La extensión de MaKo para Chrome', donde: en('Settings › Instalar la app'), detalle: 'MaKo a mano mientras navegas: tus leads, tus chats y tus anuncios.',
        marcas: [{ sel: conMarca(marcaSettings('instalar')), titulo: 'La extensión', texto: 'En la misma sección, la extensión para Chrome.', haz: 'Haz clic en Instalar la app', lado: 'derecha' }] },
      { id: 'integraciones', titulo: 'Las integraciones de lo que elegiste', donde: en('Settings › Integraciones'), detalle: 'Las que pide lo que elegiste con Offer Coach y Funnel Coach. Se conectan en Settings, en Integraciones.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tus integraciones', texto: 'Están en Settings, en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'Todo lo de tu cuenta y tu negocio.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          { sel: conMarca(marcaSettings('integraciones')), titulo: 'Integraciones', texto: 'Aquí conectas lo que necesita tu funnel.', haz: 'Haz clic en Integraciones', lado: 'derecha' },
        ] },
      { id: 'perfil', titulo: 'Tu perfil y tu foto', donde: en('Settings › Perfil'), detalle: 'Lo que me contaste ya quedó guardado; ahí subes tu foto.',
        marcas: [
          { sel: conMarca(MARCA.barraFoto), titulo: 'Tu perfil', texto: 'Está en Settings, en el menú de tu foto.', haz: 'Haz clic en tu foto', lado: 'derecha', libre: true },
          { sel: '#user-menu a[href^="/perfil"]', titulo: 'Settings', texto: 'La primera sección es tu perfil.', haz: 'Haz clic en Settings', lado: 'derecha', libre: true },
          // 19/11: la última marca es la sección Perfil (la que marca el video del día 2, `tour-settings-info`). Con Settings como
          // última, tocar Settings en el video cerraba «Tu perfil y tu foto» antes de llegar al perfil, y tocar Perfil no cerraba nada.
          { sel: conMarca(marcaSettings('info')), titulo: 'Perfil', texto: 'Tu nombre y tu foto: lo que contaste en el chat ya está guardado.', haz: 'Haz clic en Perfil', lado: 'derecha' },
          // 20/11 (d24-20, la maqueta): la última es el botón de la foto (app/perfil/InformacionPersonal.tsx, `MARCA.settingsFoto`), con «Entendido».
          // Con SU texto (`propia`): sin eso, `marcasDeLaTarea` le ponía el de la tarea (la maqueta, onboarding.html:20185-20198).
          { sel: conMarca(MARCA.settingsFoto), titulo: 'Tu foto', texto: 'Súbela aquí. Tu nombre, tu WhatsApp y tu negocio ya están guardados.', haz: 'Entendido', lado: 'derecha', listo: 'Entendido', propia: true },
        ] },
    ],
    whatsapp: { texto: 'Dile a MaKo a qué hora te escribe sobre el reto: le escribes tú primero, así WhatsApp no frena sus mensajes.', ejemplo: '«Hola MaKo, prefiero que me escribas a las 9:00 sobre el reto.»', escrito: 'Hola MaKo, prefiero que me escribas a las {hora} sobre el reto.' },
  },
  {
    // Martín, 18/11: «no lo llamaría el día 3 de difusión de WhatsApp, porque hay muchos que no usan WhatsApp y hacen sus mensajes
    // por Instagram, otros por email… tu primera automatización de mensajes o de respuestas a clientes». Sin atarla a un canal.
    n: 3, titulo: 'Tus contactos y tu primera automatización', video: 'reto-dia-3',
    mensaje: 'Día 3: tus contactos y tu primera automatización. Dale play: te muestro dónde va todo.',
    tareas: [
      { id: 'contactos', titulo: 'Carga tus clientes en el CRM', donde: 'En CRM', detalle: 'Con un CSV, aunque vengan de otro sistema.',
        // 19/11: decía «si ya usas otro CRM, lo integramos», que promete un equipo. Lo que hay es importar un CSV (app/crm/ImportarLeadsModal.tsx).
        // 20/11 (f24-05, la maqueta): después de CRM, el «⋮» de su barra, donde está «Importar leads» (app/crm/CrmToolbar.tsx).
        marcas: [enLaBarra('/crm', 'CRM', 'Tus clientes van a tu CRM. Los cargas tú, como prefieras.'),
          { sel: '[data-recorrido="crm-mas"]', titulo: 'Carga tus clientes', texto: 'Si quieres, cárgalos con un CSV: aquí, en «Importar leads».', haz: 'Haz clic aquí', lado: 'abajo' }] },
      { id: 'automatizacion', titulo: 'Tu primera automatización de mensajes', donde: 'En Automations', detalle: 'Que MaKo atienda solo a tus clientes, por el canal que usas: WhatsApp, Instagram o email.',
        marcas: [
          enLaBarra('/automations', 'Automations', 'Aquí armas tu primera automatización de mensajes.'),
          // «Atiende MaKo» de Chats es sólo un filtro (las charlas que ya atiende MaKo): la respuesta automática se arma aquí.
          { sel: 'aside[aria-label="Tus automatizaciones"] button.chb-nueva', titulo: 'Nueva automatización', texto: 'Pídesela a MaKo con tus palabras: qué responder y por qué canal.', haz: 'Haz clic en Nueva automatización', lado: 'derecha' },
        ] },
      { id: 'calendar', titulo: 'Conecta Google Calendar', donde: 'En Calendar', detalle: 'Las llamadas que agenden caen en tu calendario.',
        marcas: [enLaBarra('/calendario', 'Calendar', 'Conecta tu calendario: las llamadas caen en tu agenda.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: mándale a MaKo un audio pidiéndole que cargue un lead a tu CRM.', ejemplo: '«MaKo, carga a Juan Pérez en mi CRM: me escribió por Instagram y quiere el programa.»', audio: true },
  },
  {
    n: 4, titulo: 'Copia lo que le funciona a tu competencia', video: 'reto-dia-4',
    mensaje: 'Día 4: copiamos lo que ya le funciona a tu competencia. Dale play.',
    tareas: [
      { id: 'spy', titulo: 'Agrega 3 competidores en Competitor Spy', donde: 'En Competitor Spy', detalle: 'Mira lo que más tiempo llevan activo.',
        marcas: [enLaBarra('/competitor-spy', 'Competitor Spy', 'Agrega a 3 competidores y mira lo que más les funciona.')] },
      { id: 'web', titulo: 'Replica una página que ya vende', donde: 'En Web Generator', detalle: 'En Web Generator: pegas su página y la replica con tu oferta.',
        marcas: [enLaBarra('/web-generator', 'Web Generator', 'Pegas su página y la replica con tu oferta.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: pregúntale a MaKo qué le está funcionando a tu competencia.', ejemplo: '«¿Qué le está funcionando a mi competencia?»', escrito: '¿Qué le está funcionando a mi competencia?' },
  },
  {
    n: 5, titulo: 'Tu carrusel y tu guion', video: 'reto-dia-5',
    mensaje: 'Día 5: tu carrusel y tu guion, replicando lo que ya funcionó. Dale play.',
    tareas: [
      { id: 'carrusel', titulo: 'Tu carrusel', donde: 'En Image', detalle: 'En Image: replicas un carrusel que ya funcionó.',
        marcas: [enLaBarra('/image-editor', 'Image', 'Replica un carrusel que ya funcionó, con tu oferta.')] },
      { id: 'guion', titulo: 'Tu guion', donde: 'En Copywriting', detalle: 'En Copywriting, replicando a tu referente.',
        marcas: [enLaBarra('/copywriter', 'Copywriting', 'Tu guion, replicando a tu referente.')] },
    ],
    whatsapp: { texto: 'Pruébalo por WhatsApp: mándale a MaKo un audio con la idea de tu guion y te lo escribe.', ejemplo: '«Quiero un guion sobre por qué las dietas fallan…»', audio: true },
  },
  {
    n: 6, titulo: 'Tu video con IA', video: 'reto-dia-6',
    // 20/11: el clip de 10 segundos de regalo EXISTE (la tarjeta del chat, app/second-brain/reto/ClipDelReto.tsx; AI Avatar lo hace por
    // ApiMart): vuelven los textos de la maqueta. «AI Avatar» sigue sin ser una tab: es «Tu personaje con IA», en Video › Crear desde cero.
    mensaje: 'Día 6: tu video con IA, sin grabarte. El clip de 10 segundos va de regalo. Dale play.',
    tareas: [
      { id: 'personaje', titulo: 'Tu personaje con IA', donde: en('Video › Tu personaje con IA'), detalle: 'Con una foto tuya.',
        // 20/11 (R57-18): Video, «Crear desde cero» y la tarjeta «Tu personaje con IA» (app/video-editor/plantillas-crear.ts), que abre
        // el estudio del personaje con su propio tutorial.
        marcas: [enLaBarra('/video-editor', 'Video', 'Tu personaje con IA está en Video.'),
          { sel: 'a[href="/video-editor?ver=crear"]', titulo: 'Crear desde cero', texto: 'Ahí está «Tu personaje con IA».', haz: 'Haz clic en Crear desde cero', lado: 'abajo' },
          { sel: 'button.cr-plantilla[aria-label="Usar la plantilla Tu personaje con IA"]', titulo: 'Tu personaje con IA', texto: 'Con una foto tuya.', haz: 'Haz clic en Tu personaje con IA', lado: 'derecha' }] },
      // El regalo se pide en la tarjeta del chat (app/second-brain/reto/ClipDelReto.tsx): la marca muestra esa tarjeta.
      { id: 'clip', titulo: 'Tu clip de 10 segundos, de regalo', donde: 'Aquí, en el chat', detalle: 'Con el gancho de tu guion.',
        marcas: [{ sel: '[data-recorrido="sb-reto-dia-6-clip"]', titulo: 'Tu clip de regalo', texto: 'Escribe el gancho de tu guion y pídelo aquí.', haz: 'Entendido', lado: 'derecha', listo: 'Entendido' }] },
    ],
  },
  {
    n: 7, titulo: 'Tu Marketing CoPilot', video: 'reto-dia-7',
    mensaje: 'Día 7, el último: tu Marketing CoPilot revisa todo y arma tu semana. Dale play.',
    tareas: [
      { id: 'copilot', titulo: 'Abre tu Marketing CoPilot', donde: 'En Marketing CoPilot', detalle: 'Revisa todo lo que armaste en la semana.',
        marcas: [enLaBarra('/ads-manager/copiloto', 'Marketing CoPilot', 'Revisa todo lo que armaste y te dice qué hacer cada semana.')] },
      { id: 'semana', titulo: 'Tu semana, en tu Plan', donde: 'En Plan', detalle: 'El CoPilot te deja las tareas de cada semana.',
        marcas: [enLaBarra('/plan', 'Plan', 'Ahí te deja las tareas de cada semana.')] },
    ],
    whatsapp: { texto: 'Cuéntale a MaKo cómo te fue con el reto: mándale un audio por WhatsApp. Lo escucha Martín.', ejemplo: '«Me sirvió mucho el día 4…»', audio: true },
  },
];

// ── «¿Qué hacemos ahora?» (20/11/2026, auditoría D1-02 y V3) ─────────────────────────────────────────────────────────────
// Lo acordado (memoria onboarding-16-11-decisiones: «Si elige algo, arranca el tutorial de eso, uno por función, con su video»; la
// maqueta, INTERES_YA, MUESTRA y MUESTRA_FIN): después del saludo, MaKo nombra lo que la persona eligió en «¿Qué te gustaría que MaKo
// resuelva primero?» (hasta 3, lib/onboarding-arranque.ts → INTERESES_V2) y pregunta «¿Qué hacemos ahora?», con «Empezar mi día 1»
// (recomendada) y un «Muéstrame {pestaña}» por cada una. Cada una corre el tutorial de esa pestaña con su video.
export type MuestraReto = { pestana: string; nombre: string; hacer: string };
export const MUESTRA_DE_INTERES: Readonly<Record<string, MuestraReto>> = {
  'Conseguir clientes con anuncios': { pestana: 'copilot', nombre: 'Marketing CoPilot', hacer: 'conseguir clientes con anuncios' },
  'Armar mi landing': { pestana: 'web', nombre: 'Web Generator', hacer: 'armar tu landing' },
  'Espiar lo que le funciona a mi competencia': { pestana: 'spy', nombre: 'Competitor Spy', hacer: 'espiar a tu competencia' },
  'Guiones y carruseles que venden': { pestana: 'copywriting', nombre: 'Copywriting', hacer: 'armar tus guiones y carruseles' },
  // La tab AI Avatar se cerró el 14/11: el personaje está en Video.
  'Videos con IA y con mi avatar': { pestana: 'video', nombre: 'Video', hacer: 'hacer tus videos con IA' },
  'Que WhatsApp e Instagram respondan solos': { pestana: 'automations', nombre: 'Automations', hacer: 'que WhatsApp e Instagram respondan solos' },
  'Ordenar mis ventas en un CRM': { pestana: 'crm', nombre: 'CRM', hacer: 'ordenar tus ventas en el CRM' },
  'Ver mis números en un tablero': { pestana: 'dashboard', nombre: 'Dashboard', hacer: 'ver tus números en un tablero' },
  'Armar o mejorar mi oferta': { pestana: 'offer', nombre: 'Offer', hacer: 'armar tu oferta' },
  'Mi curso y mi comunidad': { pestana: 'classroom', nombre: 'Classroom', hacer: 'armar tu curso y tu comunidad' },
  'Organizar mi plan y mi equipo': { pestana: 'plan', nombre: 'Plan', hacer: 'organizar tu plan' },
};
/** Lo elegido que tiene su pestaña para mostrar, en orden y sin repetir (hasta 3). */
export const muestrasDe = (intereses: readonly string[] | null | undefined): MuestraReto[] =>
  [...new Set(intereses ?? [])].map((i) => MUESTRA_DE_INTERES[i]).filter((m): m is MuestraReto => !!m).slice(0, 3);
const enLista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
export const RETO_EMPEZAR_DIA1 = 'Empezar mi día 1';
export const RETO_INTERES_YA = (ms: readonly MuestraReto[]) => `Me dijiste que lo primero que quieres es ${enLista(ms.map((m) => m.hacer))}. ¿Te muestro cómo hacerlo ahora, o empezamos tu día 1? Si lo resuelves primero, no te preocupes: tu reto te espera aquí.`;
export const RETO_MUESTRA = (m: MuestraReto) => `Te muestro dónde ${m.hacer}, en ${m.nombre}. Dale play.`;
// La maqueta dice «Cuando quieras lo armamos juntos»: «juntos» marca género (la regla de los textos neutros).
export const RETO_MUESTRA_FIN = (m: MuestraReto) => `Listo: ya sabes dónde ${m.hacer}. Cuando quieras, lo armamos; tu reto te espera.`;

// ── Los videos del catálogo «Tutoriales de MaKo» que son del onboarding y del reto (20/11, V1): [key del manifiesto, título] ──
export const VIDEOS_PARA_EMPEZAR: ReadonlyArray<[string, string]> = [['onboarding-bienvenida', 'Bienvenida a MaKo'], ['onboarding-whatsapp', 'Tu WhatsApp con MaKo'], ['recorrido', 'Tu recorrido por MaKo']];
export const VIDEOS_DEL_RETO: ReadonlyArray<[string, string]> = [['offer-coach', 'Día 1 · Offer Coach'], ['funnel-coach', 'Día 1 · Funnel Coach'], ...[1, 2, 3, 4, 5, 6, 7].map((n): [string, string] => [`reto-dia-${n}`, `Día ${n} del reto`])];

// ── Los días 4 a 6, según el funnel (20/11/2026, auditoría d24-14 y R57-01) ─────────────────────────────────────────────────
// Martín, 15/11: «el reto tiene que servir a CADA funnel». La tabla es la de la maqueta (C:/dev/artefactos-onboarding/cuerpo.html,
// POR_FUNNEL): qué mira en Competitor Spy, qué página arma, qué carrusel y qué guion, y para qué es el clip. Los funnels de la app
// (lib/funnel-plan.ts, FUNNELS) van a su columna; «prospección en frío» no está en la maqueta y va con la de WhatsApp, la más
// parecida (le escribe a la gente y la conversación sigue por chat). Sin funnel elegido, los días de siempre.
type PorFunnel = { spy: string; web: string; carrusel: string; guion: string; clip: string };
const POR_FUNNEL: Readonly<Record<'whatsapp' | 'vsl' | 'formulario' | 'instagram' | 'youtube', PorFunnel>> = {
  whatsapp: { spy: 'Mira sus anuncios que más tiempo llevan activos.', web: 'Tu página, con el botón a tu WhatsApp', carrusel: 'Tu anuncio en carrusel, que abre el chat', guion: 'El guion de tu anuncio en video', clip: 'Con el gancho de tu anuncio.' },
  vsl: { spy: 'Mira sus anuncios y la página de su video de venta.', web: 'Tu página con tu video de venta y la agenda', carrusel: 'Tu anuncio en carrusel, que lleva a tu página', guion: 'El guion de tu video de venta', clip: 'Con el gancho de tu anuncio.' },
  formulario: { spy: 'Mira sus anuncios con formulario que más duran.', web: 'Tu página de gracias, con tu agenda', carrusel: 'Tu anuncio en carrusel, con formulario', guion: 'El guion de tu anuncio en video', clip: 'Con el gancho de tu anuncio.' },
  instagram: { spy: 'Mira sus reels con más vistas y la palabra que piden comentar.', web: 'La página del link de tu bio', carrusel: 'Tu carrusel, con la palabra para comentar', guion: 'El guion de tu reel', clip: 'Con el gancho de tu reel.' },
  youtube: { spy: 'Mira sus videos con más vistas.', web: 'La página del link de tu descripción, con la agenda', carrusel: 'Tu carrusel, que lleva a tu canal', guion: 'El guion de tu video largo', clip: 'Un short que lleva a tu canal.' },
};
const COLUMNA_DEL_FUNNEL: Readonly<Record<string, keyof typeof POR_FUNNEL>> = {
  'anuncios-a-whatsapp': 'whatsapp', 'anuncios-a-vsl': 'vsl', anuncios: 'formulario', organico: 'instagram', youtube: 'youtube', 'prospeccion-en-frio': 'whatsapp',
};

// ── Las integraciones del día 2, según lo que eligió (20/11/2026, auditoría d24-05; la maqueta, INTEGRA_POR) ───────────────────────
// Lo acordado el 16/11: «sólo las de lo que eligió». Hasta 3, sin repetir, con su «para». Con las claves de lib/integraciones-catalogo.ts
// (la tarjeta de cada una en Settings › Integraciones lleva `marcaIntegracion(clave)`). Google Calendar no va: es la tarea del día 3.
export type IntegracionReto = { key: string; nombre: string; para: string };
/** El mensaje de MaKo antes del perfil, el último paso del día 2 (la maqueta, D2_PERFIL). */
export const RETO_D2_PERFIL = 'Último paso del día 2: tu perfil. Lo que me contaste ya quedó guardado en Settings; ahí subes tu foto.';
/** El mensaje de MaKo antes de la extensión, en el día 2 en pasos (la maqueta, D2_EXT; d24-08). */
export const RETO_D2_EXT = 'Ahora la extensión de MaKo para Chrome: te acompaña mientras navegas.';
/** El mensaje de MaKo antes de la tarjeta «Te falta integrar esto» (la maqueta, D2_INT). */
export const RETO_D2_INT = 'Por lo que elegiste con Offer Coach y Funnel Coach, te falta integrar esto. Se conecta en Settings, en Integraciones: te muestro dónde.';
const NOMBRE_INTEGRACION: Readonly<Record<string, string>> = {
  meta: 'Meta Ads', whatsapp: 'WhatsApp', zernio: 'Instagram (Zernio)', panda: 'Tu reproductor de video (Panda Video u otro)', youtube: 'YouTube',
};
const INTEGRA_POR_FUNNEL: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  'anuncios-a-whatsapp': [['meta', 'tus anuncios a WhatsApp'], ['whatsapp', 'los chats que llegan de tus anuncios']],
  'anuncios-a-vsl': [['panda', 'el video de venta de tu página'], ['meta', 'tus anuncios']],
  anuncios: [['meta', 'tus anuncios con formulario']],
  organico: [['zernio', 'tu funnel de Instagram']],
  youtube: [['youtube', 'tu canal']],
  'prospeccion-en-frio': [['whatsapp', 'escribirle a tus prospectos']],
};
/** Las del funnel principal y los otros que eligió, en ese orden. Sin funnel, Meta (la de la maqueta). */
export function integracionesDelReto(funnels: ReadonlyArray<string | null | undefined>): IntegracionReto[] {
  const vistas = new Set<string>(), out: IntegracionReto[] = [];
  for (const f of funnels) {
    for (const [key, para] of (f ? INTEGRA_POR_FUNNEL[f] : undefined) ?? []) {
      if (vistas.has(key) || out.length >= 3) continue;
      vistas.add(key); out.push({ key, nombre: NOMBRE_INTEGRACION[key] ?? key, para });
    }
  }
  return out.length ? out : [{ key: 'meta', nombre: NOMBRE_INTEGRACION.meta, para: 'tus anuncios' }];
}
/** La tarea del día 2 con SUS integraciones: el detalle las nombra y la última marca baja hasta la tarjeta de la primera (si está
 *  escondida detrás de «Mostrar más integraciones», marca ese botón: la tarjeta va antes en la página, y gana la primera que esté). */
function tareaDeIntegraciones(t: TareaReto, ints: readonly IntegracionReto[]): Partial<TareaReto> {
  const [p] = ints;
  if (!p) return {};
  return {
    detalle: `${enLista(ints.map((i) => i.nombre))}: lo que pide lo que elegiste. Se conectan en Settings, en Integraciones.`,
    marcas: [...t.marcas, { sel: `${conMarca(marcaIntegracion(p.key))}, ${conMarca(MARCA.integracionesMas)}`, titulo: p.nombre,
      texto: `La necesitas para ${p.para}. Conéctala cuando quieras.`, haz: 'Entendido', lado: 'arriba', listo: 'Entendido', propia: true }],
  };
}

/** Los 7 días del negocio: los 4 a 6 armados para el funnel elegido en Funnel Coach (el principal), y las integraciones del día 2 para lo
 *  que eligió (`integraciones`: las que manda /api/reto; sin ellas, las del funnel principal). Los ids de las tareas no cambian. */
export function diasDelReto(funnel?: string | null, integraciones: readonly IntegracionReto[] = integracionesDelReto([funnel])): readonly DiaReto[] {
  const col = funnel ? COLUMNA_DEL_FUNNEL[funnel] : undefined;
  const F = col ? POR_FUNNEL[col] : null;
  const t2 = DIAS_RETO[1].tareas.find((t) => t.id === 'integraciones')!;
  const cambia: Record<number, Record<string, Partial<TareaReto>>> = { 2: { integraciones: tareaDeIntegraciones(t2, integraciones) } };
  if (F) {
    cambia[4] = { spy: { detalle: F.spy }, web: { titulo: F.web } };
    cambia[5] = { carrusel: { titulo: F.carrusel }, guion: { titulo: F.guion } };
    cambia[6] = { clip: { detalle: F.clip } };
  }
  return DIAS_RETO.map((d) => (cambia[d.n] ? { ...d, tareas: d.tareas.map((t) => ({ ...t, ...(cambia[d.n][t.id] ?? {}) })) } : d));
}

// ── En qué día va ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que se guarda por negocio (`app_settings` → `reto.estado`). */
export type EstadoReto = { v: 1; inicio: string; adelantado: number; hechas: Record<string, string>; horaWa?: string;
  /**
   * Cuándo adelantó por última vez (20/11, auditoría d24-01 y R57-06). Lo acordado: «si el lunes adelanta el día 2 y el 3, el
   * martes ya tiene el día 4». Sin esto, el calendario se contaba desde el INICIO y, después de adelantar, pasaban días sin que se
   * abriera uno nuevo. El día que sigue al adelantado se abre el día de calendario siguiente a ese momento, a su hora.
   */
  adelantadoEn?: string;
  /**
   * Lo que MaKo LEYÓ al dar cada tarea por hecha (20/11, lib/reto/senales.ts): { "3:contactos": "Leí 134 contactos en tu CRM." }.
   * Desde el 20/11 una tarea queda hecha sólo así; las `hechas` de antes (por tocar la pestaña) no traen lectura y se vuelven a leer.
   */
  leidas?: Record<string, string>;
  /** Cuándo eligió «Empezar mi día 1» (D1-02): hasta ahí, el chat pregunta «¿Qué hacemos ahora?» y no muestra los días. */
  dia1Desde?: string;
  /** Las pestañas que ya le mostró por «Muéstrame…» (`MuestraReto.pestana`). */
  muestras?: string[];
  /** Las tareas que dejó con «Lo hago después» (claves «3:calendar»; 20/11, R57-F1): el día termina igual, y quedan marcadas. */
  despues?: string[];
  /** Eligió «Mañana» al terminar el día N-1: guarda N (20/11, D1-06): la respuesta queda en el chat. */
  manana?: number;
  /** Lo de Pro que el reto le abrió una vez en la prueba (lib/reto/pro-del-reto.ts): cuándo, para sumar su gasto. */
  pro?: Partial<Record<string, { desde: string; hasta: string }>>;
  /** El último día del que salió el correo «Día N del reto de MaKo», de antes del 20/11. Ya no se escribe: lo que sale va en
   *  `reto.avisos` (lib/reto/avisos.ts), que arranca desde éste. */
  avisado?: number;
  /**
   * La zona horaria de la persona (la del navegador al empezar, IANA: «America/Mexico_City»; 20/11, auditoría R57-20). Cada día se
   * abre a SU hora en SU zona. Sin zona (un reto de antes), la de Argentina. Se guarda sólo al empezar: cambiarla a mitad del reto
   * podría cerrar un día ya abierto.
   */
  zona?: string;
  /** Cuándo se vio abierto cada día por primera vez («3» → ISO; 20/11, R57-F3): la fecha que lo separa en el hilo. */
  abiertoEl?: Record<string, string>;
  /** El reto ya está en el Plan, como proyecto con una tarea por día (20/11, d24-22: lib/reto/plan.ts). */
  enElPlan?: true };

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
  const adelantadoEn = typeof e.adelantadoEn === 'string' && !Number.isNaN(Date.parse(e.adelantadoEn)) ? e.adelantadoEn : undefined;
  const zona = typeof e.zona === 'string' && zonaValida(e.zona) ? e.zona : undefined;
  const abiertoEl: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.abiertoEl && typeof e.abiertoEl === 'object' ? e.abiertoEl : {})) if (/^[1-7]$/.test(k) && typeof v === 'string' && !Number.isNaN(Date.parse(v))) abiertoEl[k] = v;
  const leidas: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.leidas && typeof e.leidas === 'object' ? e.leidas : {})) if (/^\d:[a-z-]+$/.test(k) && typeof v === 'string' && v) leidas[k] = v.slice(0, 200);
  // Sin `leidas` es un reto de antes del 20/11: sus «hechas» salían de tocar la pestaña y no prueban nada. Se vuelven a leer.
  const confiables = e.leidas && typeof e.leidas === 'object' ? Object.fromEntries(Object.entries(hechas).filter(([k]) => leidas[k])) : {};
  const dia1Desde = typeof e.dia1Desde === 'string' && !Number.isNaN(Date.parse(e.dia1Desde)) ? e.dia1Desde : undefined;
  const muestras = Array.isArray(e.muestras) ? [...new Set(e.muestras.filter((x): x is string => typeof x === 'string' && /^[a-z-]{2,30}$/.test(x)))].slice(0, 11) : [];
  const despues = Array.isArray(e.despues) ? [...new Set(e.despues.filter((x): x is string => typeof x === 'string' && /^\d:[a-z-]+$/.test(x)))] : [];
  const manana = Number.isInteger(e.manana) ? Math.max(2, Math.min(7, Number(e.manana))) : undefined;
  const pro: Record<string, { desde: string; hasta: string }> = {};
  for (const [k, v] of Object.entries(e.pro && typeof e.pro === 'object' ? e.pro : {})) {
    const u = v as { desde?: unknown; hasta?: unknown } | undefined;
    if (/^[a-z-]{2,30}$/.test(k) && typeof u?.desde === 'string' && typeof u?.hasta === 'string' && !Number.isNaN(Date.parse(u.desde)) && !Number.isNaN(Date.parse(u.hasta))) pro[k] = { desde: u.desde, hasta: u.hasta };
  }
  return { v: 1, inicio: e.inicio, adelantado, hechas: confiables, leidas, ...(dia1Desde ? { dia1Desde } : {}), ...(muestras.length ? { muestras } : {}),
    ...(despues.length ? { despues } : {}), ...(manana ? { manana } : {}), ...(Object.keys(pro).length ? { pro } : {}), ...(horaWa ? { horaWa } : {}), ...(avisado ? { avisado } : {}), ...(adelantadoEn ? { adelantadoEn } : {}), ...(zona ? { zona } : {}), ...(Object.keys(abiertoEl).length ? { abiertoEl } : {}), ...(e.enElPlan === true ? { enElPlan: true as const } : {}) };
}

/** La hora de Argentina (la de MaKo), UTC−3: la de un reto sin zona. */
const HORA_AR = -3;
const FORMATOS = new Map<string, Intl.DateTimeFormat>();
function formatoDe(zona: string): Intl.DateTimeFormat {
  let x = FORMATOS.get(zona);
  if (!x) { x = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }); FORMATOS.set(zona, x); }
  return x;
}
/** ¿Es una zona horaria que el navegador y el server entienden? (IANA: «America/Bogota»). */
export function zonaValida(z: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+){0,2}$/.test(z) || z.length > 60) return false;
  try { formatoDe(z); return true; } catch { return false; }
}
/** Cuántas horas está la zona respecto de UTC en ese instante (con su horario de verano). Sin zona, Argentina. */
export function desfaseHoras(ms: number, zona?: string): number {
  if (!zona) return HORA_AR;
  try {
    const p = Object.fromEntries(formatoDe(zona).formatToParts(ms).map((x) => [x.type, x.value]));
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    return (local - Math.floor(ms / 60_000) * 60_000) / 3_600_000;
  } catch { return HORA_AR; }
}
/** El día de calendario de un instante en esa zona (días desde 1970). */
const diaEn = (ms: number, zona?: string) => Math.floor((ms + desfaseHoras(ms, zona) * 3_600_000) / 86_400_000);
/** La hora (con minutos, en horas) de un instante en esa zona. */
const horaEn = (ms: number, zona?: string) => (((ms + desfaseHoras(ms, zona) * 3_600_000) % 86_400_000) + 86_400_000) % 86_400_000 / 3_600_000;

/** La fecha de un día del hilo (la maqueta, R57-F3): «Hoy», «Ayer» o «Jueves 19 de noviembre», en SU zona. */
export function rotuloDelDia(t: number, ahora: number, zona?: string): string {
  const d = diaEn(ahora, zona) - diaEn(t, zona);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  const x = new Date(t).toLocaleDateString('es', { timeZone: zona ?? 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return x.charAt(0).toUpperCase() + x.slice(1);
}

/** El día 1 del reto es el primero de la prueba (20/11, auditoría R57-19): la prueba cobra el día 8, así el día 7 y su audio caen
 *  justo antes del cobro, aunque el chat del reto se abra días después. `cobro`: el del primer cobro (`estadoDePrueba().hasta`). */
export const DIAS_DE_PRUEBA = 7;
export function inicioConLaPrueba(ahora: number, cobro: string | null | undefined): number {
  const c = cobro ? Date.parse(cobro) : NaN;
  return Number.isFinite(c) ? Math.min(ahora, c - DIAS_DE_PRUEBA * 86_400_000) : ahora;
}
const horaDe = (h: string | undefined) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h ?? '9:00'); return m ? Number(m[1]) + Number(m[2]) / 60 : 9; };

/** Cuántos días se abrieron por calendario desde un momento: uno por cada día de calendario siguiente, a la hora del aviso. */
function abiertosDesde(desde: number, horaWa: string | undefined, ahora: number, zona?: string): number {
  const pasados = diaEn(ahora, zona) - diaEn(desde, zona);
  return pasados <= 0 ? 0 : pasados - (horaEn(ahora, zona) < horaDe(horaWa) ? 1 : 0);
}

/**
 * El último día ABIERTO: el día 1 se abre al empezar; cada uno de los que siguen, al día de calendario siguiente a la hora de su
 * aviso (la que eligió por WhatsApp, o las 9:00), o antes si lo adelantó. Después de adelantar, el calendario sigue desde el día
 * adelantado (`adelantadoEn`): adelantar el 2 y el 3 el lunes abre el 4 el martes.
 */
export function diaAbierto(e: EstadoReto, ahora: number): number {
  const porCalendario = 1 + abiertosDesde(Date.parse(e.inicio), e.horaWa, ahora, e.zona);
  const desdeAdelanto = e.adelantado + (e.adelantadoEn ? abiertosDesde(Date.parse(e.adelantadoEn), e.horaWa, ahora, e.zona) : 0);
  return Math.max(1, Math.min(7, Math.max(porCalendario, desdeAdelanto)));
}

export const claveTarea = (dia: number, id: string) => `${dia}:${id}`;
/** La marca de una tarea lleva la TAREA, no la pestaña (20/11, f24-04 y R57-F2: «Carga tus clientes en el CRM / Con un CSV…»): la
 *  última marca (el lugar donde se hace) toma su título y su detalle; las del camino (la foto, Settings) quedan como están. */
export const marcasDeLaTarea = (t: TareaReto): MarcaReto[] => t.marcas.map((m, i) => (i === t.marcas.length - 1 && !m.propia ? { ...m, titulo: t.titulo, texto: t.detalle } : m));
/** ¿La dejó para después? (R57-F1) */
export const tareaDespues = (e: EstadoReto, dia: number, id: string) => !!e.despues?.includes(claveTarea(dia, id));
/** ¿Terminó el día? Todas sus tareas hechas o dejadas para después (20/11, D1-06, d24-13, R57-07): recién ahí, «¿Adelantas…?». */
export const diaTerminado = (e: EstadoReto, d: DiaReto) => d.tareas.every((t) => tareaHecha(e, d.n, t.id) || tareaDespues(e, d.n, t.id));

/** El cierre de cada día (la maqueta, FIN_DIA y FIN_DIA1). `falta`: lo que dejó para después. Sin «te escribo»: el aviso por WhatsApp
 *  de cada mañana todavía no existe (auditoría D1-04, es del chat de WhatsApp); lo cierto es que el día se abre a esa hora, aquí. */
/** Lo que falta, dicho para «te falta…» (la maqueta, `falta` de cada tarea): el título es una orden («Conecta tu calendario»). */
/** Lo que sigue al cierre del reto (la maqueta, PILOTO): según su funnel, cuándo se prende el piloto automático. */
const FUNNELS_CON_ANUNCIOS: ReadonlySet<string> = new Set(['anuncios', 'anuncios-a-vsl', 'anuncios-a-whatsapp']);
export const RETO_PILOTO = (funnel?: string | null): string => (FUNNELS_CON_ANUNCIOS.has(funnel ?? '')
  ? 'El piloto automático lo prendemos cuando tus anuncios estén corriendo: te aviso.'
  : 'El piloto automático lo prendemos cuando publiques tu primera semana: te aviso.');
const FALTA_TAREA: Readonly<Record<string, string>> = {
  app: 'instalar la app de MaKo en tu teléfono', extension: 'la extensión de MaKo para Chrome', onboarding: 'tu onboarding', offer: 'tu oferta', funnel: 'tu sistema de adquisición', integraciones: 'conectar tus integraciones',
  perfil: 'tu perfil y tu foto', contactos: 'cargar tus clientes en el CRM', automatizacion: 'tu primera automatización',
  calendar: 'conectar tu calendario', spy: 'agregar a tus competidores', web: 'tu página', carrusel: 'tu carrusel', guion: 'tu guion',
  personaje: 'tu personaje con IA', clip: 'tu clip de regalo', copilot: 'abrir tu Marketing CoPilot', semana: 'tu semana en el Plan',
};
/** `falta`: los ids de las tareas que dejó para después (el día 7: todo lo que quedó sin hacer del reto, para nombrarlo). */
export function finDelDia(d: DiaReto, siguiente: DiaReto | undefined, hora: string, nombre: string, falta: string[]): string {
  // El cierre del reto (20/11, auditoría R57-08; la maqueta, FIN_RETO): al terminar el día 7, aunque quede algo, y lo nombra.
  if (d.n === 7) {
    const queda = falta.length ? ` Te queda pendiente ${enLista(falta.map((id) => FALTA_TAREA[id] ?? id))}: lo retomas cuando quieras.` : '';
    return `¡Terminaste tu reto de 7 días${nombre ? `, ${nombre}` : ''}! Tu negocio ya está armado en MaKo.${queda}`;
  }
  if (d.n === 1) return `¡Terminaste tu día 1${nombre ? `, ${nombre}` : ''}! Tu oferta y tu sistema de adquisición ya están. El día 2 es conectar todo: si quieres, lo adelantas ahora.`;
  const sigue = siguiente ? ` Mañana a las ${hora} sigue el día ${siguiente.n}: ${siguiente.titulo.charAt(0).toLowerCase()}${siguiente.titulo.slice(1)}.` : '';
  return falta.length ? `Tu día ${d.n} quedó casi listo: te falta ${falta.map((id) => FALTA_TAREA[id] ?? id).join(' y ')}.${sigue}` : `¡Listo tu día ${d.n}!${sigue}`;
}
/** Las tareas hechas desde el principio (`siempre`): no se leen ni se marcan. */
const SIEMPRE_HECHAS: ReadonlySet<string> = new Set(DIAS_RETO.flatMap((d) => d.tareas.filter((t) => t.siempre).map((t) => claveTarea(d.n, t.id))));
export const tareaHecha = (e: EstadoReto, dia: number, id: string) => SIEMPRE_HECHAS.has(claveTarea(dia, id)) || !!e.hechas[claveTarea(dia, id)];

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
 * reto de MaKo", y lo mismo en todos los días»). Corto: qué toca hoy y el link al chat del reto. Lo manda lib/reto/avisos-salida.ts.
 */
export function correoDelDia(n: number, link: string, dias: readonly DiaReto[] = DIAS_RETO): { asunto: string; preheader: string; cuerpo: string } {
  // `dias`: los del negocio (`diasDelReto(funnel)`), así lo que toca los días 4 a 6 es lo de SU funnel (20/11/2026).
  const d = dias.find((x) => x.n === n) ?? dias[0];
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
