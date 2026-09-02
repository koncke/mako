// =============================================================================
// tab-onboarding-catalogo — QUÉ pasos tiene el onboarding de cada tab
// =============================================================================
//
// ⚠️ SIN `server-only`, Y ES EL MISMO CRITERIO QUE `onboarding-orden`.
//
// Vivía adentro de `tab-onboarding-state.ts`, que sí lo tiene — así que el
// catálogo no lo podía importar ningún test. Y este catálogo tiene DOS reglas
// que fallan en silencio y que ya se cometieron:
//
//   · El PREFIJO de las keys. `contexto`/`ensayo` pelados colisionan vía
//     `KEY_PASOS_COMPARTIDOS` entre tabs: terminar el ensayo de una marca el de
//     otra como hecho. Está documentado en tres entradas del catálogo porque ya
//     pasó dos veces.
//   · El ORDEN. La regla de la skill —lo aburrido al final, salvo lo que
//     bloquea— vive hoy en la prosa de cada comentario y en ningún control.
//
// Acá no hay nada de ningún workspace: son los pasos que ofrecemos. Lo que sí
// es del inquilino —qué pasos cerró— sigue en `tab-onboarding-state.ts`, con su
// `server-only` puesto.

/** Definición del onboarding de UNA tab: sus pasos, en orden. */
export type TabOnboardingDef = {
  key: string;          // 'setting' — la key del nav
  titulo: string;       // "Dejemos tu setting listo"
  /**
   * `opcional`: el paso se muestra y se puede hacer, pero NO bloquea la tab. El
   * método oficial de WhatsApp y el email son mejoras, no requisitos — obligar a
   * pasar por ellos dejaba a un cliente con su número ya vinculado sin poder
   * entrar a su propio inbox.
   */
  pasos: Array<{ key: string; label: string; opcional?: boolean }>;
  /**
   * Tabs que DEPENDEN de esta: entrar ahí sin haber terminado este onboarding
   * no tiene sentido, así que se las manda acá. Ej.: /whatsapp y /email no
   * necesitan su propio onboarding — su configuración (canal probado, voz,
   * secuencias) se hace entera en /setting. Una sola puerta de entrada en vez
   * de tres recorridos que piden lo mismo.
   */
  cubre?: string[];
  /** Href al que se manda (default `/${key}`). */
  href?: string;
};

/**
 * Catálogo de onboardings por tab. Agregar una tab = agregar una entrada acá
 * (mismo espíritu que lib/tab-activacion.ts y lib/capas.ts: el dato manda, no
 * un `if` desparramado).
 */
export const TAB_ONBOARDINGS: Record<string, TabOnboardingDef> = {
  // ── WhatsApp: conectar y probar los dos métodos ──
  // Vive en su tab porque es donde el cliente llega buscando WhatsApp. Los
  // mismos pasos aparecen dentro del Chat Agent cuando elige "configurar todo":
  // no se repiten, se comparten (ver PASOS_COMPARTIDOS).
  whatsapp: {
    key: 'whatsapp',
    titulo: 'Configuración de WhatsApp',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      // Lo que NO bloquea, al final: se puede dejar para después.
      { key: 'wa_oficial', label: 'WhatsApp oficial', opcional: true },
      { key: 'wa_oficial_plantilla', label: 'Tu primera plantilla', opcional: true },
      { key: 'wa_oficial_prueba', label: 'Verificación del oficial', opcional: true },
    ],
  },

  // ── Email: el canal de los que no contestan por WhatsApp ──
  email: {
    key: 'email',
    titulo: 'Configuración del email',
    // Acá NO son opcionales: son los únicos pasos de la tab. Lo son dentro del
    // Chat Agent, donde el email es una mejora sobre un canal que ya funciona.
    pasos: [
      { key: 'email_conectar', label: 'Tu email' },
      { key: 'email_prueba', label: 'Verificación del email' },
    ],
  },

  // ── Chat Agent: la cabeza. Necesita al menos un canal vivo ──
  // ORDEN (regla en .claude/skills/tab-onboarding): lo aburrido al final,
  // EXCEPTO lo que bloquea. El WhatsApp de empresa sí bloquea: el paso de
  // contexto lee las conversaciones reales de ese número, así que sin él no hay
  // nada que leer.
  setting: {
    key: 'setting',
    titulo: 'Configuración del Chat Agent',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      { key: 'contexto', label: 'Tu forma de escribir' },
      { key: 'voz', label: 'Tus audios' },
      { key: 'ensayo', label: 'Ensayo de conversación' },
      { key: 'aprobar', label: 'Tus secuencias de mensajes' },
      { key: 'wa_oficial', label: 'WhatsApp oficial', opcional: true },
      { key: 'wa_oficial_plantilla', label: 'Tu primera plantilla', opcional: true },
      { key: 'wa_oficial_prueba', label: 'Verificación del oficial', opcional: true },
      { key: 'email_conectar', label: 'Tu email', opcional: true },
      { key: 'email_prueba', label: 'Verificación del email', opcional: true },
    ],
    href: '/chatbot',
  },

  // ── Instagram: decidir la cuenta de Zernio, conectar, contexto y ensayo ──
  // ORDEN: acá lo aburrido (Zernio y el OAuth) va PRIMERO porque bloquea de
  // verdad — sin la decisión de Zernio tomada no hay API con la que hablar, y
  // sin cuenta conectada el inbox y el compositor no tienen nada que mostrar
  // (la excepción prevista por la regla de la skill). Los dos primeros pasos NO
  // se marcan a mano: se derivan de señales reales (estado vivo, no recordado) —
  // `zernio` de la key BYOK propia o de la fila en zernio_workspace, `conectar`
  // de los facts de la cuenta que devuelve Zernio. El contexto no pide nada
  // nuevo: muestra lo que la app ya sabe del negocio. El ensayo previsualiza el
  // borrador del chatbot con un DM simulado.
  instagram: {
    key: 'instagram',
    titulo: 'Configuración de Instagram',
    pasos: [
      { key: 'zernio', label: 'Conexión con Zernio' },
      { key: 'conectar', label: 'Tu cuenta de Instagram' },
      { key: 'contexto', label: 'Contexto del negocio' },
      { key: 'ensayo', label: 'Ensayo de respuesta' },
    ],
  },

  // ── Carousels (Content Machine): escribir no necesita la cuenta conectada ──
  // Orden estándar de la skill (lo aburrido al final… y acá ni siquiera al
  // final): conectar Instagram NO bloquea —los guiones se escriben igual y la
  // cuenta recién hace falta al PUBLICAR, que vive en /instagram— así que el
  // paso es opcional y la tab solo lo muestra como aviso con link. El ensayo se
  // marca solo desde la primera pieza generada (patrón landing-an: la tab se
  // configura usándola).
  // ⚠️ Keys con prefijo `carousels_` a propósito: 'contexto'/'ensayo' a secas
  // COLISIONAN vía KEY_PASOS_COMPARTIDOS con el Chat Agent y con Instagram
  // (gotcha conocido, ver el def de instagram) — un paso que NO es la misma
  // configuración no comparte key.
  carousels: {
    key: 'carousels',
    titulo: 'Configuración de Carousels',
    pasos: [
      { key: 'carousels_instagram', label: 'Tu cuenta de Instagram', opcional: true },
      { key: 'carousels_contexto', label: 'Contexto del negocio' },
      { key: 'carousels_ensayo', label: 'Tu primer carrusel' },
    ],
  },

  // ── Reels: el writer de guiones se configura usándose ──
  // ORDEN (regla de la skill): el valor primero, la plomería al final. Escribir
  // guiones NO exige la cuenta conectada, así que `conectar` es OPCIONAL y va
  // último: es el MISMO paso de la tab instagram (registro compartido) — si la
  // cuenta ya se conectó allá, acá aparece hecho, y publicar el borrador es lo
  // único que la necesita. Los otros dos pasos van con keys namespaced
  // (`reels_*`) a propósito: las keys peladas `contexto`/`ensayo` ya COLISIONAN
  // entre instagram y setting vía el registro compartido (gotcha conocido) y no
  // son la misma configuración que esta tab.
  // `reels_contexto` se deriva del perfil del negocio (estado vivo, lo marca la
  // page al detectarlo); `reels_ensayo` lo marca la primera pieza generada.
  reels: {
    key: 'reels',
    titulo: 'Configuración de Reels',
    pasos: [
      { key: 'reels_contexto', label: 'Contexto del negocio' },
      { key: 'reels_ensayo', label: 'Tu primer guion' },
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
    ],
  },

  // ── Video Generator: la cara, la voz, el navegador y el primer anuncio ──
  //
  // ORDEN (regla de la skill): lo aburrido AL FINAL, excepto lo que bloquea. Acá
  // lo aburrido es el navegador con Flow —instalar una extensión y emparejarla—
  // y bloquea de verdad: sin puente no se genera NADA, ni siquiera las imágenes
  // que son gratis. Por eso va anteúltimo, pegado a lo único que bloquea (el
  // ensayo) y después de los tres pasos que sí se pueden hacer sin él.
  //
  // Los tres primeros son los que deciden si el anuncio se parece a la persona:
  // su cara (sin foto no hay identidad y el avatar sale siendo otro), su acento
  // y sus muletillas. Ninguno se REDACTA: la cara se sube, y el acento y las
  // muletillas se eligen de una lista — con el acento ya pre-marcado por la
  // inferencia de la zona horaria, que es lo que se venía usando en silencio.
  //
  // ⚠️ Keys con prefijo `vg_` a propósito: `contexto`/`ensayo` pelados COLISIONAN
  // vía KEY_PASOS_COMPARTIDOS con el Chat Agent y con Instagram (gotcha ya
  // documentado arriba) — un paso que no es la misma configuración no comparte
  // key.
  'video-generator': {
    key: 'video-generator',
    titulo: 'Configuración del generador de video',
    pasos: [
      { key: 'vg_cara', label: 'Tu cara' },
      { key: 'vg_acento', label: 'Cómo hablas' },
      { key: 'vg_muletillas', label: 'Tus muletillas' },
      // ⚠️ OPCIONAL, y la decisión no es de comodidad. `marcarPasoTab` recalcula
      // el `status` contra el catálogo ACTUAL: agregar un paso NO opcional
      // devuelve a «pendiente» a todos los que ya tenían la tab cerrada, y les
      // reabre el wizard encima de un anuncio a medio hacer.
      //
      // Y además clonar la voz no puede ser un requisito: sin clon el anuncio se
      // monta igual, con la voz que genera Flow. Lo que se pierde es que suene a
      // la persona, no que funcione.
      { key: 'vg_voz', label: 'Tu voz', opcional: true },
      { key: 'vg_puente', label: 'Tu navegador con Flow' },
      { key: 'vg_ensayo', label: 'Tu primer escenario' },
    ],
  },

  // ── Landing Analyst: la única tab que se configura USÁNDOLA ──
  // No hay credencial que pedir ni contexto que redactar: el funnel y el perfil
  // ya están cargados, y el "ensayo" ES el primer análisis. Por eso el paso que
  // bloquea es analizar una página, y se marca solo desde analizarLanding().
  // El seguimiento es opcional a propósito: sin él MaKo diagnostica el copy
  // igual — lo que suma es poder cruzarlo con lo que hace la gente.
  'landing-an': {
    key: 'landing-an',
    titulo: 'Configuración del Landing Analyst',
    pasos: [
      { key: 'analizar', label: 'Tu primera página analizada' },
      { key: 'seguimiento', label: 'Seguimiento puesto en la landing', opcional: true },
    ],
    href: '/landing-analyst',
  },

  // ── Landing Generator: se prende escribiendo la primera página ──
  'landing-writer': {
    key: 'landing-writer',
    titulo: 'Configuración del Landing Generator',
    pasos: [
      { key: 'generar', label: 'Tu primera versión escrita' },
      { key: 'guardar', label: 'Una versión guardada', opcional: true },
    ],
    href: '/landing-generator',
  },

  // ── Stories: el writer de secuencias de stories ──
  // `conectar` es OPCIONAL a propósito: escribir el guion de un día de stories
  // no necesita la cuenta de Instagram — publicarlo sí, y eso pasa en
  // /instagram. Y es EL MISMO paso `conectar` de la tab instagram (registro
  // compartido de KEY_PASOS_COMPARTIDOS): si la cuenta ya se conectó allá, acá
  // aparece hecho solo — es la misma cuenta, no dos configuraciones. Esta tab
  // NUNCA lo marca por su cuenta (se deriva del estado vivo de /instagram).
  // Los otros dos pasos van namespaced (stories_*) adrede: unos `contexto` /
  // `ensayo` pelados colisionarían vía el registro compartido con instagram y
  // con el Chat Agent, y terminar el ensayo de Stories marcaría «Ensayo de
  // conversación» del Chat Agent como hecho (el gotcha ya documentado de
  // KEY_PASOS_COMPARTIDOS).
  stories: {
    key: 'stories',
    titulo: 'Configuración de Stories',
    pasos: [
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
      { key: 'stories_contexto', label: 'Contexto del negocio' },
      { key: 'stories_ensayo', label: 'Tu primera secuencia' },
    ],
  },
};
