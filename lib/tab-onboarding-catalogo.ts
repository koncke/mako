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
   * El nombre CORTO de la tab, para cuando hay que nombrarla dentro de una frase
   * ("Te falta configurar: Copy Generator · Video Generator · WhatsApp").
   *
   * ⚠️ EXISTE PORQUE RECORTARLE EL PREFIJO AL `titulo` NO ALCANZA. Se probó con un
   * regex que sacaba "Configuración del/de la/de" y el resultado, medido contra el
   * catálogo real, era una lista con dos nombres rotos en minúscula: «generador de
   * video» y «email». Un nombre de producto no se deriva de una frase — se declara.
   *
   * Ausente = se usa el `titulo` tal cual, que es feo pero nunca es incorrecto.
   */
  nombre?: string;
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
  /**
   * La tab que hay que configurar ANTES que esta. Distinto de `cubre`, y la
   * diferencia importa: `cubre` es «esta tab no tiene recorrido propio, el mío la
   * cubre»; `requiere` es «los dos tienen recorrido, y el mío va segundo».
   *
   * El caso que lo trajo: el Video Generator filma un guion, y el guion se escribe
   * en el Copy Generator. Alguien que llega al Video Generator sin haber pasado por
   * el Copy no tiene NADA que filmar — la tab lo recibe con una lista vacía y ningún
   * cartel que explique de dónde salen los guiones. Decisión de Martín, textual:
   * «primero va el guion y luego el video… si no está hecho el primero, no debería
   * dejarte hacer el segundo».
   *
   * ⚠️ SE MIRA ANTES QUE EL PROPIO (ver `onboardingRequeridoPara`). Mirarlo después
   * sería no mirarlo nunca: la tab de atrás siempre tiene su propio onboarding
   * pendiente también, así que el propio ganaría siempre y el requisito no ataría nada.
   */
  requiere?: string;
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
  // mismos pasos aparecen dentro del Chatbot cuando elige "configurar todo":
  // no se repiten, se comparten (ver PASOS_COMPARTIDOS).
  whatsapp: {
    key: 'whatsapp',
    titulo: 'Configuración de WhatsApp',
    nombre: 'WhatsApp',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      // Los tres pasos del OFICIAL se fueron con la tarea #832: Meta cobra por mensaje y
      // el no oficial no tiene esa restricción, así que el producto deja de ofrecerlo.
      // Quien ya lo tenga conectado lo sigue viendo; nadie nuevo lo configura.
    ],
  },

  // ── Email: el canal de los que no contestan por WhatsApp ──
  email: {
    key: 'email',
    titulo: 'Configuración del email',
    nombre: 'Email',
    // Acá NO son opcionales: son los únicos pasos de la tab. Lo son dentro del
    // Chatbot, donde el email es una mejora sobre un canal que ya funciona.
    pasos: [
      { key: 'email_conectar', label: 'Tu email' },
      { key: 'email_prueba', label: 'Verificación del email' },
    ],
  },

  // ── Chatbot: la cabeza. Necesita al menos un canal vivo ──
  // ORDEN (regla en .claude/skills/tab-onboarding): lo aburrido al final,
  // EXCEPTO lo que bloquea. El WhatsApp de empresa sí bloquea: el paso de
  // contexto lee las conversaciones reales de ese número, así que sin él no hay
  // nada que leer.
  setting: {
    key: 'setting',
    titulo: 'Configuración del Chatbot',
    nombre: 'Chatbot',
    // ⚠️ UN SOLO PASO, Y ES EL QR. La tab dejó de ser un wizard: es el lienzo donde se
    // dibujan las secuencias, y lo único que hay que tener antes es la línea vinculada
    // (Martín, 05/10: «esa pestaña ya no requeriría un onboarding al menos que no tengas
    // vinculado WhatsApp todavía; lo único que tiene que salir es el QR»).
    //
    // Dónde fue a parar cada paso viejo, para que nadie lo busque:
    //  · «Verificación» — la pantalla del QR detecta sola cuando engancha.
    //  · «Tus audios» — el editor graba el audio DE CADA PASO (`PasoAudioControl`).
    //  · «Ensayo» — el simulador vive adentro de la tab.
    //  · «Tus secuencias» — Publicar y Activar están en el lienzo.
    //  · «WhatsApp oficial» ×3 — el oficial salió del producto (tarea #832).
    //  · «Tu email» ×2 — /email tiene su propia tab y su propio onboarding.
    //  · «Tu forma de escribir» — es el único que produce un dato sin otra casa (la guía
    //    de voz). Decisión de Martín: no va al entrar, va la primera vez que se enciende
    //    la IA en una tarjeta del lienzo. Hasta que esa opción exista, la pantalla sigue
    //    en `OnboardingChatAgent.tsx`, sin montar.
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
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
    nombre: 'Instagram',
    pasos: [
      { key: 'zernio', label: 'Conexión con Zernio' },
      { key: 'conectar', label: 'Tu cuenta de Instagram' },
      // ⚠️ CON PREFIJO `ig_`, Y ESTO ERA UNA COLISIÓN VIVA.
      //
      // Eran `contexto` y `ensayo` a secas, las MISMAS keys que usa el Chat
      // Agent. Y el registro compartido no distingue de qué tab vino un paso: un
      // workspace que terminaba el onboarding de /chatbot llegaba a /instagram con
      // los dos ya en verde, sin haber visto ninguna de las dos pantallas.
      //
      // Lo caro es el segundo: el ensayo de Instagram previsualiza el borrador de
      // un DM, y saltearlo enciende el auto-respondedor sin que nadie haya leído
      // una sola respuesta. Que es exactamente lo que un ensayo existe para
      // impedir.
      //
      // Medido el 03/09/2026: el ws11 tiene `instagram.contexto` con el timestamp
      // 2026-08-10T20:36:51.948Z, y el `contexto` del Chatbot con
      // 2026-08-10T20:36:52.603Z — 0,6 s después. Lo marcó /chatbot. El ws13 está
      // igual.
      //
      // El def de `carousels` de acá abajo ya había esquivado esta trampa y la dejó
      // escrita; este quedó atrás. Es «una regla aplicada en un lugar de dos no está
      // implementada, está documentada».
      { key: 'ig_contexto', label: 'Contexto del negocio' },
      { key: 'ig_ensayo', label: 'Ensayo de respuesta' },
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
  // COLISIONAN vía KEY_PASOS_COMPARTIDOS con el Chatbot y con Instagram
  // (gotcha conocido, ver el def de instagram) — un paso que NO es la misma
  // configuración no comparte key.
  carousels: {
    key: 'carousels',
    titulo: 'Configuración de Carousels',
    nombre: 'Carousels',
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
    nombre: 'Reels',
    pasos: [
      { key: 'reels_contexto', label: 'Contexto del negocio' },
      { key: 'reels_ensayo', label: 'Tu primer guion' },
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
    ],
  },

  // ── Copy Generator: la FÁBRICA DE CREATIVOS, que antes vivía en el onboarding global ──
  //
  // Estos cinco pasos estaban en `lib/capas.ts` → capa 'completo', o sea que se le
  // pedían a todo cliente nuevo antes de dejarlo entrar a nada. Salieron de ahí (ver el
  // comentario largo en ese archivo) y aterrizan acá, que es la tab donde se USAN: la
  // matriz avatar × razón es literalmente la entrada del Copy Generator.
  //
  // ORDEN, y es el encadenamiento de la fábrica, no una preferencia de lectura:
  //   entregable → qué se ofrece a cambio del contacto (el lead magnet).
  //   avatares   → A QUIÉN se le habla (los 3 subnichos).
  //   persona    → la CARA de la marca (fotos + descripción).
  //   personalidad → CÓMO habla (el quiz de voz del creador).
  //   angulos    → la MATRIZ, que es el producto de los cuatro anteriores.
  //
  // Por eso `angulos` es el ensayo de esta tab y va último: es la única pantalla donde
  // el cliente VE salir algo, y sale de lo que acaba de contestar. Ninguno es opcional
  // —cada uno alimenta al siguiente, y la matriz sin avatares es una grilla vacía.
  //
  // ⚠️ Keys con prefijo `cg_` a propósito, igual que `vg_` y `carousels_`: las peladas
  // colisionan vía KEY_PASOS_COMPARTIDOS (gotcha documentado tres veces en este archivo).
  //
  // ⚠️ `cg_persona` y `vg_cara` se PARECEN y no son el mismo paso: acá se define la cara
  // de la marca (quién aparece y cómo se lo describe, que es material de copy); allá se
  // suben las fotos con las que se arma el avatar del video. No comparten key a
  // propósito — si mañana se decide fundirlos, es una decisión, no un renombre.
  'ads-writer': {
    key: 'ads-writer',
    titulo: 'Configuración del Copy Generator',
    nombre: 'Copy Generator',
    pasos: [
      { key: 'cg_entregable', label: 'Tu lead magnet' },
      { key: 'cg_avatares', label: 'Tus avatares' },
      { key: 'cg_persona', label: 'La cara de tu marca' },
      { key: 'cg_personalidad', label: 'Tu personalidad' },
      { key: 'cg_angulos', label: 'Tu matriz de anuncios' },
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
  // vía KEY_PASOS_COMPARTIDOS con el Chatbot y con Instagram (gotcha ya
  // documentado arriba) — un paso que no es la misma configuración no comparte
  // key.
  'video-generator': {
    key: 'video-generator',
    titulo: 'Configuración del generador de video',
    nombre: 'Video Generator',
    // PRIMERO EL GUION, DESPUÉS EL VIDEO. Sin el Copy Generator configurado no hay
    // guiones que filmar, y esta tab abre con una lista vacía que no explica nada.
    requiere: 'ads-writer',
    pasos: [
      // ⚠️ EL ORDEN DE ESTA LISTA ES UNA GUARDA, no una preferencia de lectura.
      //
      // `marcarPasoTab` no deja marcar un paso si falta uno ANTERIOR de acá, así
      // que este array y el `PASOS` de la pantalla tienen que decir lo mismo. El
      // 02/09/2026 se movió el puente al primer lugar en la pantalla y no acá: el
      // paso 1 quedó pidiendo «antes falta completar Tu cara», que es el paso 2.
      // Con un cliente delante, y sin forma de avanzar.
      //
      // El puente va primero porque hay que bajar e instalar la extensión: es lo
      // único con espera propia, y ponerlo al arranque deja que se instale
      // mientras la persona contesta lo demás.
      { key: 'vg_puente', label: 'Instala la extensión de MaKo' },
      { key: 'vg_cara', label: 'Tus fotos' },
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
    nombre: 'Landing Analyst',
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
    nombre: 'Landing Generator',
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
  // con el Chatbot, y terminar el ensayo de Stories marcaría «Ensayo de
  // conversación» del Chatbot como hecho (el gotcha ya documentado de
  // KEY_PASOS_COMPARTIDOS).
  stories: {
    key: 'stories',
    titulo: 'Configuración de Stories',
    nombre: 'Stories',
    pasos: [
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
      { key: 'stories_contexto', label: 'Contexto del negocio' },
      { key: 'stories_ensayo', label: 'Tu primera secuencia' },
    ],
  },
};
