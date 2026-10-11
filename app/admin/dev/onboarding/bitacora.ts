// =============================================================================
// Onboarding — el registro de construcción del área
// =============================================================================
// Alcance: el wizard de alta del cliente y el hub de 10 tabs (Diagnóstico/las 5
// fases, El Archivero, Oferta, Lead Magnet, Persona, Personalidad, Avatares,
// Razones, Ángulos, Matriz, El funnel) + Productos.
// Vive en: app/onboarding/, lib/onboarding-state.ts, lib/tab-onboarding-state.ts,
// lib/archivero.ts, lib/capas.ts, app/api/onboarding/*.
//
// De dónde salió esto: los `pedido` son textuales, sacados de los turnos del
// dueño; el índice de sesiones está en docs/chats.md; las trampas y lo que quedó
// sin hacer, en docs/hallazgos-ui.md (sección «Onboarding») y en
// docs/hallazgos-crm.md; fecha, hora y commits, de `git log` sobre esas rutas.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El wizard bloqueante', detalle: 'Dos pantallas · una pregunta por vez · sin salida hasta terminarlo · el dueño también lo hace', estado: 'hecha' },
  { titulo: 'Las 5 fases (Diagnóstico)', detalle: 'El norte del negocio · marco de Andrea adaptado a VSL por anuncios · hito para pasar de fase', estado: 'hecha' },
  { titulo: 'El Archivero', detalle: 'Un botón para soltar todo · la IA rellena internamente · solo los huecos se preguntan, de a uno', estado: 'hecha' },
  { titulo: 'La fábrica: avatares, razones y matriz', detalle: 'Avatar × razón de compra = 9 ángulos a testear · las razones NO son hooks', estado: 'hecha' },
  { titulo: 'Persona y Personalidad', detalle: 'La cara (fotos que MaKo describe) y la voz (tono, muletillas) de la marca', estado: 'hecha' },
  { titulo: 'Onboarding por tab', detalle: 'Conectar → Contexto → Ensayo · el estado alimenta a MaKo · lo aburrido va al final', estado: 'hecha' },
  { titulo: 'Productos / Ofertas', detalle: 'MaKo los arma con lo que ya cargó el cliente · falta decidir dónde vive dentro del hub', estado: 'sigue' },
  { titulo: 'El funnel que sale del negocio', detalle: 'Hoy se aplica FUNNEL_TEMPLATES[0] a todos, sin mirar el canal declarado', estado: 'cola' },
  { titulo: 'Las capas / oferta cebolla', detalle: 'Vender MaKo por partes · la capa existe, el catálogo de ofertas nunca se cerró', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── junio ──────────────────────────────────────────────────────────────────
  {
    fecha: '21 jun', hora: '02:16', chat: 'MaKo en los gráficos + contexto y onboarding', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El formulario largo se reemplaza por un template que se sube',
    pedido: 'No me gusta el diseño del input, instala algun plugin o mejora de alguna manera eso. Parece un input de los años 2010. El diseño minimalista.\n\nPara que el form sea de a 1 pregunta o la menor cantidad posible, lo que quiero hacer es hacer que descarguen el TEMPLATE sugerido a rellenar de cada fase y lo vuelvan a subir. Normalmente los infoproductores completan templates así todo el tiempo, es natural que ya tengan de esos sobre su oferta, su avatar, etc…\n\nPor eso, al subir el template quiero que se lea la info y se completen todos los campos posibles.\n\nSi rellenaron el template sugerido, serán todos los campos, si subieron el suyo y hay cosas sin responder, no los dejará avanzar a la siguiente sección.',
    puntos: [
      'Acá nace la idea que después se llamó **El Archivero**, y con ella la regla de fondo del área: **el usuario no redacta, entrega un artefacto que ya tiene**. En junio la forma era un template descargable; en julio se convirtió en «soltá todo lo que tengas».',
      'La segunda mitad del pedido —«si hay cosas sin responder, no los dejará avanzar»— es el gate del wizard, y su contracara terminó siendo el bug más caro del área: un guard que se traba por un error de infraestructura **encierra** al usuario (ver 29 de julio).',
      'El contexto se inyecta **de forma aditiva**: si una pieza del onboarding está vacía, MaKo se comporta igual que antes. Sin eso, cada campo nuevo del brief sería una forma nueva de romper al agente.',
    ],
    commits: [
      { sha: '83ff402', msg: 'MaKo contexto: Conocimiento (RAG) + Fases + Prompts + Onboarding, enchufado al agente', lineas: 974, archivos: 17 },
      { sha: '2383abc', msg: 'Onboarding: template por fase (descargar/subir + autocompletar) e inputs minimalistas', lineas: 409, archivos: 6 },
    ],
  },

  // ── julio: el wizard ───────────────────────────────────────────────────────
  {
    fecha: '17 jul', hora: '00:17', chat: 'Onboarding del cliente y oferta cebolla', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Dos pantallas, y la API del super admin para el efecto WOW',
    pedido: 'Vamos primero a concluir el onboarding y luego seguimos con la oferta.\nPrimero quisiera que me des como te imaginas el formulario, teniendo en cuenta como ya venimos haciendoló, simple y miniamlista, y pregunta por vez.\nPor otro lado, no creo que conectar WhatsApp NO oficial sea una gran fricción en el onboarding principal, ya que solo es escanear el QR, como todos ya lo saben hacer. Lo que si es fricción es conectarle las API de Claude o de Groq para que MaKo responda, pero para ello, puedo tener una API de Groq como SuperAdmin y que MaKo utilice esa durante el onboarding… para que el usuario tenga el efecto WOW me está diciendo por WhatsApp lo que pasa en mi funnel.\n\nPor otro lado, me imagino el onboarding dividio en 2 pantallas.\nLa pantalla de la derecha el form simple, y en la izquierda que salgan "animaciones" con funcionalidades "wow" dentro de la app, como un carrusel.',
    puntos: [
      'El molde de las dos pantallas (form a la derecha, panel negro con carrusel a la izquierda) es el que después heredaron **todas** las tabs del hub y los onboardings por tab. Vive en `app/_components/WizardShell.tsx`.',
      'La distinción que ordenó todo: **escanear un QR no es fricción, conectar una API sí**. De ahí sale la regla «lo aburrido va al final», y el que la agencia preste su key durante el onboarding para que el WOW llegue antes de que el cliente conecte nada.',
      'En el mismo tramo aparecen las **capas**: «Leila y Leandro utilizarán el modo de Project Manager… Tal vez deberíamos ver diferentes onboarding para esos casos». La capa es un atributo del cliente, no un flag global — por eso `lib/capas.ts` es lo que define qué pasos ve cada uno.',
    ],
  },
  {
    fecha: '17 jul', hora: '11:43', chat: 'Onboarding del cliente y oferta cebolla', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un solo onboarding: el wizard de 4 pasos murió',
    puntos: [
      'Había **dos** onboardings vivos (el viejo de 4 pasos y el nuevo por capas) y el dueño cortó por lo sano: «El onboarding general ese como está, justamente ya no debería existir. Esto lo reemplazará». Dos caminos para lo mismo garantizan que uno quede viejo.',
      'El diagnóstico de FASE entró acá con el marco de Andrea Estratega: **es lo primero que hay que saber del negocio**, porque de la fase salen la meta, el hito y qué le sugiere MaKo después.',
      '⚠️ **La trampa del `status: done`.** El wizard marcaba terminado comparando contra el literal `body.step === \'retro\'`. Cualquier capa que no termine en `retro` quedaba `in_progress` **para siempre** y `guardOnboarding` devolvía al usuario al wizard en loop infinito, aunque lo hubiera completado entero. El último paso sale de `pasosDeCapaActual()`, nunca de un literal.',
      'Los atajos de agencia (saltar, simular, salir) son solo para probar, y con una condición: **el wizard tiene que verse exactamente igual que el del cliente**, o probarlo no prueba nada.',
      'Cuatro días después el gate se volvió duro: sin onboarding completo no se entra al dashboard. Son **8 líneas** (`d6af690`) y son las que sostienen todo lo demás del área.',
    ],
    commits: [
      { sha: 'dedc0c0', msg: 'Capas: vender MaKo por partes, empezando por Project Manager', lineas: 466, archivos: 44 },
      { sha: '4317f6c', msg: 'Onboarding PM: una pregunta por vez, en dos pantallas', lineas: 375, archivos: 16 },
      { sha: '9788027', msg: 'Un solo onboarding: el wizard de 4 pasos murió', lineas: 364, archivos: 4 },
      { sha: 'e4c2e1e', msg: 'Onboarding: diagnóstico de FASE del negocio (marco Andrea Estratega)', lineas: 525, archivos: 7 },
      { sha: '7a00b56', msg: 'Onboarding: atajos de agencia para probar (saltar, simular, salir)', lineas: 97, archivos: 3 },
      { sha: 'd6af690', msg: 'Onboarding OBLIGATORIO: sin completarlo, no se entra al dashboard', lineas: 8, archivos: 2 },
    ],
    archivos: [
      'lib/capas.ts — qué pasos ve cada tipo de cliente. Es la fuente de qué es «el último paso»',
      'lib/onboarding-state.ts — el estado del wizard principal',
      'app/onboarding/OnboardingWizard.tsx — el wizard, con el modo agencia arriba',
      'app/onboarding/DiagnosticoView.tsx · FaseUI.tsx — las 5 fases',
      '⚠️ Quedó vivo: dar «atrás» en la primera pregunta te saca al dashboard sin haber completado el onboarding',
    ],
  },

  // ── julio: El Archivero ────────────────────────────────────────────────────
  {
    fecha: '26 jul', hora: '10:58', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«El archivero»: que tiren todo y MaKo lo organice',
    pedido: '1. Me gusta lo de tener mapeado la cantidad de datos que MaKo luego podrá matchear para enriquecer los angulos, pero primero quiero hacerlo tipo onboarding de alguien en 0. Que recién se está conectando a MaKo por primera vez. Eso nos facilita la experiencia de usuario para el 100% de los casos, y luego los casos que encima tengan más data lo enriquece. No hay que hacerlo al revés.\n[…]\n3. Pienso que tal vez sería bueno comenzar esto como un onboarding… Sobre todo me imagino que tiene mucho valor las "FASES" que pusimos en el onboarding, que catalogan en que instancia del negocio está cada usuario. Luego también se me ocurrió poner un paso en el onboarding que sea "El archivero" o "El recipiente" o "El contenedor" o algo así, verás, el 100% de mis clientes siempre tienen documentos sueltos de AVATAR, OFERTA, NICHO, PRODUCTO, ETC ETC… Mi idea es que lo "tiren" todo ahí, y MaKo lo organice, entonces eso es valioso para crear los angulos…',
    puntos: [
      '«Onboarding de alguien en 0, no al revés» es la decisión de arquitectura del área entera: se diseña para el cliente sin datos, y el que tiene historia lo **enriquece**. Al revés, el 100 % de los casos se rompe.',
      'El Archivero no es un repositorio de archivos: es **el paso que rellena el brief del negocio**, y ese brief es lo que después alimenta avatares, razones, ángulos y guiones. Si el Archivero falla, falla toda la cadena de abajo.',
    ],
  },
  {
    fecha: '26 jul', hora: '17:40', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Archivero, y el hub se muda a su propia tab',
    puntos: [
      '**El PDF no se leía por lo obvio.** La extracción devolvía vacío no porque el prompt fuera malo, sino porque nadie estaba leyendo **la capa de texto del PDF**: se le mandaba a la IA un binario. Ese fix (`6586d30`) es el que hizo que el paso existiera de verdad.',
      'Segunda trampa el mismo día: la key se leía del entorno en vez de `credWs`, así que en el workspace de un cliente el Archivero «no tenía IA» sin decir por qué. Todo lo que consume IA en esta área pasa por la credencial **del workspace**.',
      'La mudanza: «Quiero que elimines Telefonos y Etiquetas. Y "Funnel" + "Archivero" + "Angulos y avatares" se vayan a una nueva tab que se acceda desde la foto de perfil que se llame "Onboarding"». De ahí sale el hub de tabs que hoy vive en `OnboardingTabs.tsx`.',
      'El alcance se recortó a propósito: el Archivero resuelve **el brief de ángulos**, no «todo el negocio». Un paso que promete todo no termina nunca.',
    ],
    commits: [
      { sha: '57205d9', msg: 'El Archivero: paso de onboarding que ordena los docs del cliente en su brief', lineas: 345, archivos: 6 },
      { sha: 'b5a86bd', msg: 'El Archivero: rediseño por FASES (un botón al inicio, resumen en tarjeta, huecos de a 1)', lineas: 163, archivos: 1 },
      { sha: 'd0a8dae', msg: 'El Archivero: fix de key (usa credWs), intake grande con cola+preview, y mudanza a "Onboarding"', lineas: 136, archivos: 7 },
      { sha: '6586d30', msg: 'El Archivero: leer la capa de texto del PDF (fix extracción) + tabs píldora + sin subtítulos', lineas: 58, archivos: 7 },
      { sha: '4624585', msg: 'El Archivero: alcance solo "brief de ángulos" + marco del wizard (panel negro + card)', lineas: 48, archivos: 3 },
    ],
    archivos: [
      'lib/archivero.ts — la lógica del repositorio y el brief efectivo',
      'app/onboarding/Archivero.tsx — el paso: dropzone, cola, panorama y huecos',
      'app/onboarding/OnboardingTabs.tsx — el hub, accesible desde la foto de perfil',
      '⚠️ Vivo: `procesarLink` corre la extracción sobre CUALQUIER URL pegada y `computeEffective` itera con «el último pisa» — pegar la web de un competidor le reescribe los 11 campos del brief al cliente (docs/mapa-del-proyecto.md §Estado real)',
    ],
  },
  {
    fecha: '26 jul', hora: '18:31', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Organicemos el onboarding: primero las FASES, porque son el NORTE',
    pedido: 'Organicemos el onboarding…\n\n1. Primero tienen que ir las FASES, porque es el NORTE del negocio. De allí salen el resto de las preguntas.\n2. ¿Por qué le pedimos "Conectá WhatsApp (Chatwoot)" en el onboarding? Eso no lo entiendo, es necesario pedirselo allí?\n3. Yo creo que el primer paso en el onboarding debería ser las fases, luego el archivero, con esas 2 cosas ya sacamos mucha info. Como tercer paso conectar Meta…\n4. Primero metería las fases porque es un DEFAULT que no tiene IA. Como segundo paso le pediría al usuario ingresar su token de Gemini, con eso que es gratis, vamos a hacer todos los procesos de IA de su onboarding, como el archivero, etc. Luego del token viene el archivero y luego Meta.\n[…]\n6. No creo que deberíamos preguntarle "¿Cuál es tu meta del mes?" debería ser algo parecido al perro guardian, que sea auto impuesto… Porque si ya tenemos las FASES, y vamos a catalogar a cada usuario dentro de una fase, la meta clara está en lo que tiene que lograr para pasar a la próxima fase, punto.\n7. Volví a subir el mismo PDF y "Esto entendí de tu negocio" sigue siendo EXACTAMENTE igual que antes, cuando le di mucha info valiosa con ese doc.',
    puntos: [
      'El punto 4 es el criterio de orden que quedó: **primero lo que no necesita IA** (las fases son un default puro), después la key gratis que va a pagar todos los procesos del onboarding, y recién ahí lo que consume IA. Cualquier otro orden deja al cliente trabado en el paso 1 esperando una credencial.',
      'El punto 6 borró una pregunta entera del formulario: **si ya sabés la fase, la meta se deriva** (el hito para pasar a la siguiente). Es el mismo criterio que después se escribió como regla: preguntá hechos, no acciones.',
      'El punto 7 es el síntoma que tardó **cuatro días** en resolverse, y el diagnóstico obvio (el parser del JSON) era el equivocado dos veces seguidas.',
    ],
  },
  {
    fecha: '26 jul', hora: '21:34', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El orden del wizard, y las 5 fases rehechas para VSL por anuncios',
    puntos: [
      'Orden nuevo: **Fases → Gemini → Archivero → Meta → funnel → Retro**. WhatsApp salió del onboarding principal: no bloquea nada, y pedirlo ahí solo alargaba el camino al primer WOW.',
      'Las 5 fases se renumeraron 1 a 5 y se reescribieron desde la metodología de Andrea adaptada a **VSL por anuncios**: preguntas de inversión diaria en Meta y de creativos por mes, contenido profundo por fase y el hito de salida.',
      'Se agregó Gemini a la cascada de extracción y —más importante— **un aviso explícito cuando no hay ninguna IA disponible**. Antes, sin key, el paso devolvía un panorama vacío que se leía como «tu documento no decía nada».',
    ],
    commits: [
      { sha: 'd0e1f81', msg: 'Onboarding: reordenar el wizard (Fases → Gemini → Archivero → Meta → funnel → Retro)', lineas: 78, archivos: 4 },
      { sha: '11091ee', msg: 'El Archivero: fix extracción (Gemini en la cascada + aviso si no hay IA) + sacar WhatsApp del onboarding + avisos de doc', lineas: 44, archivos: 5 },
      { sha: '3c62f95', msg: 'Fases 1-5: rediseño VSL-ads (preguntas, contenido profundo, dimensiones, P4 por canal)', lineas: 414, archivos: 4 },
    ],
  },
  {
    fecha: '27 jul', hora: '12:24', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El fix REAL de la extracción: no era el parser, era el modelo',
    puntos: [
      '**El diagnóstico obvio era el equivocado, dos veces.** Primero se culpó al parser del JSON (`6ab70f6`, «parse robusto»), después a la lectura del PDF. Los dos eran bugs reales y ninguno era la causa del síntoma que él reportaba: el modelo de la cascada **no daba** para leer un documento largo y devolvía un resumen genérico, idéntico corriera con el PDF que corriera. Por eso subir el mismo doc dos veces daba exactamente lo mismo.',
      'La regla que queda: cuando una extracción devuelve algo **plausible pero constante**, sospechá del modelo antes que del parseo. Un parser roto da vacío o excepción; un modelo corto da relleno.',
      'El «¿seguro?» con insight: en vez de aceptar y seguir, MaKo dice qué entendió y **pide el documento que falta** por nombre («veo que subiste el de Avatar, ¿tenés el de Oferta?»). Es lo que convierte un dropzone en un paso que conversa.',
      'El panorama quedó **editable inline y por secciones desplegables**, y en español neutro: el copy del onboarding lo lee el cliente, no el dueño.',
    ],
    commits: [
      { sha: '5a86c47', msg: 'Archivero: fix REAL de extracción (modelo capaz) + insight detallado + form paso a paso', lineas: 114, archivos: 4 },
      { sha: 'faa9e0a', msg: 'Archivero v4: insight con tipeo, "¿seguro?" pide el doc que falta, panorama por secciones editable', lineas: 251, archivos: 4 },
      { sha: 'd049d98', msg: 'Archivero: panorama completo + fade escalonado, edición inline, insight en cajas', lineas: 104, archivos: 3 },
      { sha: '759d93e', msg: "Archivero: español neutro, fade más lento, WOW corto, slide '¿otro doc?' pulido", lineas: 43, archivos: 3 },
      { sha: 'a7e1413', msg: 'Archivero al 100%: docs-first, panorama libre, huecos como preguntas cerradas 1x1', lineas: 252, archivos: 5 },
    ],
  },

  // ── julio: la fábrica ──────────────────────────────────────────────────────
  {
    fecha: '28 jul', hora: '20:23', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las razones no son hooks, y aparece la Persona',
    pedido: '1. En "El Gancho" no me hizo preguntas… Tal vez el usuario ya tiene un elemento tangible claro para incorporarlo. Y sería bueno llamar a la sección "Entregable".\n2. Separar las "Razones" de la "Matriz 3x3" en otra tab.\n3. Siento que la parte de las razones no queda claro… Hoy en día lo veo más como un generador de hooks… Lo cierto es que un avatar tiene diferentes razones de comprar un producto… El ejemplo que utiliza Jan es para un curso de ingles, un avatar lo compra porque quiere un mejor salario, otro porque se va de vacaciones, etc… Creo que deberíamos profundizar más en eso.\n4. Sería bueno que elimines todo lo de Mauricio así lo vuelvo a hacer. Y que cuando alguien no tenga el onboarding, no me salte todas las tabs para poder ingresar. De hecho que no me salte ninguna tab. Que me salte el modal con todas las preguntas, seguidas, para completarlo. Y al finalizar recién puedo acceder a todas las tabs.\n5. Agreguemos ya el apartado de "Persona" para cargar las fotos, etc… No es solamente la foto, recuerda como lo tiene Claudio, es una descripción de la persona, eso luego le sirve a la IA para generar las imagenes.\n6. Creo que lo mejor es que la parte de "Resumen" se vaya dentro del archivero. Y en el lugar donde está Resumen lo ocupe la matriz 3x3…',
    puntos: [
      'El punto 3 es la corrección conceptual que más se repitió después: **una razón de compra no es un hook y no es dolor/deseo**. Es el motivo por el que ESE avatar compra ESE producto. Está escrito en el glosario de `docs/mapa-del-proyecto.md` justamente porque se confundía todo el tiempo.',
      'De ahí sale la Matriz: **avatar × razón = 9 celdas**, y cada celda es un ángulo a testear. Es la salida de la fábrica de creativos, no una tabla decorativa.',
      'El punto 4 endureció el gate: no se muestran tabs a medias, se muestra el wizard. La versión final de eso es `guardOnboarding`.',
      'El punto 5 define Persona como **descripción, no foto**: lo que le sirve a la IA generativa después es el texto que describe a la persona, y ese texto lo escribe MaKo mirando las fotos.',
    ],
  },
  {
    fecha: '28 jul', hora: '22:49', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La fábrica: avatares, razones, matriz, Entregable y Persona',
    puntos: [
      'El hub pasó a tener una tab por concepto en vez de un acordeón: Diagnóstico · Archivero · Oferta · Lead Magnet · Persona · Personalidad · Avatares · Razones · Ángulos · Matriz · El funnel.',
      '**La subida se rompía por Vercel, no por el código.** Los documentos pasaban por el route y morían en 413. La subida se hizo **directa a Supabase Storage** con URL firmada: el límite del body de la plataforma no es un problema que se resuelva comprimiendo.',
      'Meta se movió al final del wizard (la matriz va antes) y Gemini dejó de re-pedirse si ya estaba cargada: dos pasos que hacían releer al cliente algo que ya había hecho.',
      '⚠️ **Dos formas de perder datos que el server reporta como éxito**, encontradas en la review de esta corrida: (a) el route de fotos saltea cualquier archivo >15 MB, lo acumula en `warnings` y responde `{ok:true}` — el cliente hace `if (j.ok) setEst(j)` y **nunca lee warnings**, así que la foto no aparece y no hay mensaje; (b) los routes de entregables y razones hacen `.filter(x => x.nombre)` al guardar: si el usuario selecciona-todo el nombre para reescribirlo y hace blur antes de tipear, **el server le borra la tarjeta entera**, sin confirmación ni undo.',
    ],
    commits: [
      { sha: '2d78e15', msg: 'Avatares + matriz 3x3 de ángulos (metodología de Jan)', lineas: 529, archivos: 11 },
      { sha: '7fc9858', msg: 'Rediseño del hub de onboarding + avatares segmentables (feedback Mauricio)', lineas: 770, archivos: 13 },
      { sha: 'e1e873e', msg: 'Fábrica de creativos v2: Gancho, Ángulos=formatos, Razones-tabla, afinar, auto-cascada', lineas: 1079, archivos: 14 },
      { sha: '1f6fa84', msg: 'Fábrica v3: Entregable, Razones=motivaciones, Matriz+pop-up, Persona, gating', lineas: 1007, archivos: 17 },
      { sha: '3657cf7', msg: 'Gating: el DUEÑO también hace onboarding (el wizard le carga)', lineas: 19, archivos: 3 },
      { sha: '6939be5', msg: 'Archivero: subida DIRECTA a Supabase (sin límite de Vercel)', lineas: 120, archivos: 3 },
      { sha: '145d6b4', msg: 'Wizard: no re-pedir Gemini si ya está; Meta al final (matriz antes)', lineas: 42, archivos: 3 },
    ],
    archivos: [
      'app/onboarding/AvataresView.tsx · RazonesView.tsx · MatrizView.tsx — la fábrica',
      'app/onboarding/EntregableView.tsx — el Lead Magnet',
      'app/onboarding/PersonaView.tsx · PersonalidadView.tsx — la cara y la voz',
      'app/api/onboarding/persona|entregable|razones/route.ts — los tres con el bug del descarte silencioso (docs/hallazgos-ui.md)',
    ],
  },
  {
    fecha: '30 jul', hora: '18:36', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Esas preguntas nefastas»: el paso pregunta lo que ya sabe',
    pedido: '2. En el entregable le puse "Si lo tengo claro" y no me preguntó de que es el entregable o no me pidió que lo suba, eso esta mal. Ya dimos muchas vueltas con esto, por favor, corrobora que todo funcione bien de una vez, así tengas que lanzar multiagente…\n3. En avatares me sigue haciendo esas preguntas nefastas, decime por el amor de dios que carajos tiene que ver con el cliente que me compra más rapido si es frio o ya me conocia, cuando en un primer lugar la respuesta es OBVIA, por dios, soluciona eso, ya dimos muchas vueltas. Y supuestamente tenia 4 preguntas, respondí 1 y ya directamente me generó los avatares… MUY mal.\n4. Tanto en el resumen del archivero, como en los desplegables del analisis de las fotos, siempre el primer desplegable que venga ya desplegado, el resto, todo plegado.',
    puntos: [
      '**Las preguntas eran fijas y el contador mentía.** Se generaban de una lista estática, no de lo que faltaba en el brief, así que preguntaban cosas obvias o ya respondidas; y el paso avanzaba después de la primera respuesta aunque declarara cuatro. Pasaron a ser **dinámicas, cerradas y de a una**, calculadas contra los huecos reales.',
      'Se sacó el botón **«Saltar» de todos los formularios** («Que no exista esa opción nunca») y se agregó vuelta atrás en todos.',
      'Persona: se eliminó el campo «Descripción de la persona». La descripción la escribe MaKo mirando las fotos (mínimo 5), porque ese texto es el que después consume la IA generativa. El usuario no redacta lo que el sistema puede deducir.',
      '⚠️ **El 504 que encerraba al usuario.** La ruta de preguntas del Archivero corre IA con `maxDuration 60`; un timeout de plataforma devuelve **HTML**, no JSON, así que `res.json()` lanzaba y caía a un catch que no marcaba `huecosRevisados`. Como el guard de «Siguiente» es `if (gaps.length > 0 && !huecosRevisados) return true`, **cada click se consumía y no pasaba nada**. La regla: el catch de un `fetch().json()` dentro de un wizard tiene que ser fail-open — ahí no estás atrapando el error del backend, sino el de la infraestructura.',
    ],
    commits: [
      { sha: 'e3c2a8b', msg: 'Onboarding: preguntas dinámicas de a una en Entregable/Avatares, sin "Saltar" en ningún lado', lineas: 373, archivos: 7 },
      { sha: '60dbe10', msg: 'Onboarding: 10 ajustes de UX/contenido tras feedback de Martín', lineas: 373, archivos: 14 },
      { sha: '4c9994a', msg: 'Onboarding: nombres de fase (Validación/Conversión/Automatización/Equipo/Escala) + descripción de Persona en secciones', lineas: 90, archivos: 4 },
      { sha: '800c7dd', msg: 'Onboarding: Archivero flujo un-solo-botón + Entregable con preguntas + Persona por IA', lineas: 255, archivos: 7 },
      { sha: '0ac543a', msg: 'Archivero: fixes de la review (fail-open de preguntas + no perder cola al avanzar)', lineas: 10, archivos: 1 },
      { sha: '12e1bbe', msg: 'Onboarding · Archivero: links (webs), dropzone compacto, gating de huecos; +fix ayuda Gemini', lineas: 180, archivos: 3 },
    ],
    archivos: ['app/onboarding/Archivero.tsx:259-262 — el catch fail-open, con el porqué escrito arriba'],
  },

  // ── agosto ─────────────────────────────────────────────────────────────────
  {
    fecha: '1 ago', hora: '19:05', chat: 'Chat Agent: onboarding, nutrición y datos de Mauricio', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Toda tab tiene su propio onboarding, y su estado alimenta a MaKo',
    puntos: [
      'La decisión de producto: **ninguna tab se entrega sin onboarding**, y siempre con las mismas tres etapas — **Conectar** (con prueba de vida real) → **Contexto** (pedir un artefacto que ya existe, nunca que el usuario redacte) → **Ensayo** (MaKo hace de cliente). El caso testigo fue una tab con 19 jugadas que nadie podía prender.',
      'El estado por tab (hecho / no hecho) **es un dato que MaKo lee**: si algo no se optimizó, sabe que fue por onboarding incompleto y lo dice, en vez de inventar una explicación.',
      '«Todo lo que sea aburrido tipo conectar API, configuraciones, etc, esté siempre al final de los onboarding. A excepción de que si o si debamos pedir algo antes porque eso impide avanzar» — y de ahí también: solo el onboarding **principal** va sin sidebar; las demás tabs la conservan, «si por error entré ahí no tengo forma de salir».',
      'Hay tabs que dependen de otras: /whatsapp y /email mandan a la configuración del Chat Agent en vez de pedir lo mismo dos veces.',
      '⚠️ **`marcarPasoTab` pisa la pegajosidad.** `getEstadoTab` respeta el `done` guardado a propósito, para que agregar pasos no re-encierre a nadie; pero `marcarPasoTab` **recalcula duro contra el catálogo actual y persiste**: si el catálogo ganó un paso obligatorio nuevo, el `done` viejo se pierde en el primer clic. Si agregás un paso NO opcional a `TAB_ONBOARDINGS`, asumí que todos los que ya la tenían cerrada vuelven a pendiente — y **nunca renombres una key existente**.',
      '⚠️ Gemelo: el escape de un onboarding de tab apuntaba a `router.refresh()`, que re-corre el guard del server y devuelve el mismo wizard. **Un onboarding de tab se cierra con estado de cliente.** Antes de reabrir uno, verificá que tenga salida.',
    ],
    commits: [
      { sha: '55f2680', msg: "feat: estado de onboarding POR TAB + curso 'Buenas prácticas para construir una App'", lineas: 438, archivos: 7 },
      { sha: '9296221', msg: 'fix+feat(onboarding de tab): no tapa el sidebar, y lo aburrido va al FINAL', lineas: 210, archivos: 4 },
      { sha: 'c4ef882', msg: 'feat(onboarding): tabs que dependen de otras — /whatsapp y /email mandan a /setting', lineas: 67, archivos: 4 },
      { sha: '1c9b35a', msg: 'Chat Agent, onboarding por canal, y el reset del cliente de prueba', lineas: 545, archivos: 18 },
      { sha: '7eadf92', msg: 'El gate del onboarding deja de depender de que alguien se acuerde', lineas: 99, archivos: 9 },
    ],
    archivos: [
      'lib/tab-onboarding-state.ts:214-236 — `getEstadoTab` vs `marcarPasoTab`, el desacuerdo que borra el `done`',
      '.claude/skills/tab-onboarding — el molde de las 3 etapas, para no reinventarlo en cada tab',
    ],
  },
  {
    fecha: '6 ago', hora: '00:38', chat: 'CRM: funnel, validaciones y ficha del lead', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Productos: aprovechar la info, no pedirla de nuevo',
    pedido: '6. También tenes que trabajar mucho mejor "Producto", por empezar que JAMÁS debes crear formularios como el que hiciste, todas las preguntas juntas en lugar de 1 por slide, y lo peor son las preguntas abiertas, ya sabes como hacer las cosas bien, y si no lo sabes revisa las buenas practicas que hemos escrito… Y sobre todo, en el negocio de Mauricio, creaste un producto Negocio que Escala, pero está muy incompleto, le falta info, y toda esa info ya la tienes con todo lo que se cargó en onboarding y lo que los usuarios cargan… La idea justamente es APROVECHAR la info, que la IA haga el trabajo, no hacer que el usuario cargue todo nuevamente.',
    puntos: [
      'El pedido tiene dos mitades y la segunda es la importante: no es solo «una pregunta por slide», es que **el paso arranca con lo que MaKo ya sabe** y solo pregunta lo que ningún dato del onboarding resolvió. Un paso que le pide al cliente algo que ya cargó es un paso que le dice que el sistema no lo escuchó.',
      'Productos alimenta al CRM (suscripciones, MRR, qué se le vendió a cada lead), así que un catálogo incompleto no se queda quieto: ensucia el funnel río abajo.',
      '⚠️ **Quedó SIN cerrar:** el catálogo de Productos/Ofertas sigue a medias y **falta decidir dónde vive dentro del hub** — hoy la tab «Oferta» y Productos se pisan conceptualmente. Vive en `app/onboarding/ProductosView.tsx`.',
    ],
    commits: [{ sha: '1544a67', msg: 'Productos: paso del onboarding que MaKo arma solo (no un form para tipear)', lineas: 489, archivos: 8 }],
  },
  {
    fecha: '7 ago', hora: '12:23', chat: 'Dos cuentas de Claude en paralelo', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que este área dejó escrito, y lo que sigue roto',
    puntos: [
      '**El funnel del cliente no dice nada de su negocio.** `app/api/onboarding/route.ts` aplica `FUNNEL_TEMPLATES[0]` **hardcodeada**, sin mirar el canal declarado. Verificado en prod: ws1, ws3, ws10 y ws11 tienen exactamente el mismo pipeline. Consecuencia: leer `funnel_config` como evidencia de cómo vende un cliente («tiene etapa Agenda R2, entonces hace dos llamadas») es un **falso positivo** — le cayó por default. Para saber cómo vende hay que mirar `negocio.fase.diagnostico` y el panorama del Archivero.',
      '**El Archivero acepta cualquier URL.** `procesarLink` extrae del HTML de cualquier link pegado y `computeEffective` resuelve con «el último pisa»: pegar la web de un competidor le reescribe los 11 campos del brief, y ese brief alimenta avatares, razones y guiones.',
      'La regla del área, la que más veces se rompió y más veces se repitió (al menos cinco entre julio y agosto): **una pregunta por pantalla, cerrada, sin «Saltar», con vuelta atrás y guardando dónde ibas**. Si un form no está así, se modifica antes de seguir. Está escrita entera en `docs/hallazgos-ui.md`, con las citas y las fechas.',
      'Y la que gobierna el orden: **primero archivos, después preguntas.** Un botón para que suelten todo, la IA rellena internamente y solo lo que ningún documento resolvió se pregunta, de a uno.',
    ],
    commits: [{ sha: 'f315269', msg: 'Cosecha retroactiva: 134 de 260 corridas no habian escrito nada', lineas: 2574, archivos: 11 }],
    archivos: [
      'docs/hallazgos-ui.md — sección «Onboarding»: los bugs vivos y las decisiones de producto',
      'docs/hallazgos-crm.md — el funnel con plantilla 0 y lo que arrastra',
      'docs/mapa-del-proyecto.md §6 «Estado real» — qué funciona, qué está a medias y qué no existe',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "9 ago", hora: "09:43", chat: "—", cuenta: "claude1",
    actor: "claude", tipo: "implementacion",
    titulo: "El funnel dejó de ser FUNNEL_TEMPLATES[0] para todos",
    puntos: [
      "El wizard preguntaba cómo vende el cliente, guardaba la respuesta en onboarding.funnel_tipos y después sembraba la plantilla 0 igual para todos: un grep de esa clave daba dos resultados y los dos eran utilidades de clonado — el dato se escribía y no lo leía nadie. Ahora el funnel sale del canal declarado, se agregó plantilla para 'conversaciones' (que no tenía) y 'llamadas' arranca en `simple` por decisión del dueño. Se arregló además el gemelo: el bloque pisaba el funnel SIN CONDICIÓN en cada guardado del diagnóstico, así que un cliente que volviera atrás en el wizard se comía su propio funnel editado. Y las 13 etapas del funnel entraron al grafo del Second Brain.",
      "Cierra de frente el ítem que la propia bitácora tiene en PARTES como 'cola' («Hoy se aplica FUNNEL_TEMPLATES[0] a todos») y el primer punto de la cosecha del 7 ago — que hoy quedó falso y nadie lo sabe leyendo el registro. La decisión que hay que no perder: lo único que se consume de una plantilla es cuántas etapas kind:'reunion' tiene, y sobre-pedir NO es el lado seguro — con dos reuniones el wizard exige fecha, asistencia y Fathom de una R2 que no existe, o sea que el cliente no puede cerrar un lead sin inventarla; sub-pedir se arregla con un click. Y la trampa que impide reparar el pasado: highticket ES DEFAULT_PIPELINE, así que un funnel sembrado por el bug y uno elegido a mano son idénticos byte a byte y no hay historial de funnel en ningún lado — no hay migración posible, solo se verificó contra prod que el pasivo era cero.",
    ],
    commits: [
      { sha: "42fd13ba", msg: "El funnel sale del canal que el cliente declaró, y entra al grafo", lineas: 646, archivos: 8 },
    ],
  },
  {
    fecha: "10 ago", hora: "23:32", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El onboarding se daba por cerrado sin estarlo, en el wizard y en las tabs",
    puntos: [
      "Dos caras del mismo error, el mismo día. (a) El paso `productos` estaba en el tipo y en el orden de la capa pero no en OnboardingState.steps ni en el union del endpoint: cerrarlo era `undefined.done = true` → 500, y como el wizard no miraba `ok`, el cliente avanzaba igual y al volver aterrizaba SIEMPRE ahí. Las cuatro listas paralelas se colapsaron en PASOS_ONBOARDING (lib/capas.ts) como fuente única. (b) Con una clienta delante, el onboarding del Chatbot quedó `done` marcando `ensayo` y `aprobar` con diez segundos de diferencia y sin un solo audio grabado: marcarPasoTab aceptaba cualquier clave del def, así que marcar el ÚLTIMO paso cerraba el recorrido entero. De paso entró el merge campo a campo de Productos (la IA pisaba lo que el cliente había escrito a mano, porque recibía solo nombre y precio y hacía UPDATE de todas las columnas) y se cableó seedProductosDesdeOferta, que no tenía un solo call-site desde la 0117.",
      "Es el hallazgo #1 de docs/hallazgos-onboarding.md («el paso productos revienta en silencio y el cliente queda varado ahí para siempre») dejando de estar vivo, y el registro sigue diciendo que lo está. Las dos reglas que quedan: agregar un paso al onboarding tocaba CUATRO listas paralelas mantenidas a mano —el antipatrón que garantizaba que el paso quince naciera con el mismo bug— y ahora es una sola con el tipo derivado y el endpoint validando en positivo; y el fail-closed que nadie escribe solo: ChatAgentApp mostraba el dashboard ante CUALQUIER respuesta que no fuera ok, y si no se pudo saber si el onboarding está completo, mostrar el dashboard es AFIRMAR que lo está. El guard vive en lib/onboarding-orden.ts sin server-only, para que un test lo pueda importar.",
    ],
    commits: [
      { sha: "97f98ba8", msg: "El paso de Productos por fin cierra, y /email deja de escribir para Mauricio", lineas: 268, archivos: 13 },
      { sha: "073d606b", msg: "onboarding: no se puede saltear un paso, y sin saber no se muestra el dashboard", lineas: 136, archivos: 4 },
    ],
  },
  {
    fecha: "16 ago", hora: "09:48", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Dejar un paso pendiente y seguir: el wizard bloqueante por fin tiene salida",
    puntos: [
      "Un cliente contestó nueve pantallas, quedó trabado en el paso de Meta —que se resuelve en la consola de Meta, no acá— y por eso NUEVE DÍAS tampoco pudo entrar a usar el resto de la app, que no dependía de Meta para nada. De los cuatro clientes reales, los dos que no terminaron el wizard murieron en un paso de conexión; ninguno en uno de contenido. Ahora se posterga UN paso, y solo los que se cierran en un sistema de afuera (PASOS_POSTERGABLES: integraciones y verificación del teléfono). Después vinieron las dos mitades que faltaban: el retomar aterrizaba una pantalla ANTES de donde el cliente había quedado (una función cuenta() que recopiaba a mano la lista de pantallas y se desfasó), un paso postergado no contaba como cerrado al retomar —así que el cliente volvía a caer justo en la pantalla que acababa de declinar—, y «Seguir sin Meta» posponía el mismo muro tres pantallas: la Retro declaraba `servicio:'meta'` para heredar los slides y ese mismo campo elegía la decoración Y bloqueaba el avance, con lo cual le dibujaba adentro el formulario del token en una pantalla que no es postergable.",
      "Es la respuesta a los hallazgos #4 y #6 del documento del área («los clientes reales no abandonan en los pasos de contenido: abandonan en los de conexión» y «no existe el paso opcional»), y con eso cae el diseño de julio que la bitácora sostiene entero: el wizard bloqueante. Lo que había antes era peor que nada: 'skipped' existía en el endpoint, la UI nunca lo mandaba, y aunque lo hubiera mandado onboardingPendiente() rebotaba igual — tres piezas que por separado se leen completas y juntas no hacen nada. Cuatro reglas: quien decide qué se posterga es el SERVER contra el catálogo; el cierre pregunta «¿están TODOS cerrados?» y ya no «¿cerraste el último?» (con una salida en el medio dejan de coincidir, y quien postergara el último paso quedaba in_progress para siempre); un servicio postergado NO puede volver a bloquear río abajo —un botón que ofrece salida y después no la da es peor que no ofrecerla—; y postergar tampoco esconde el formulario, porque si vuelve a conectar tiene que poder. Y el gemelo de «cada pregunta, su campo»: `exige` es un campo nuevo y es lo único que bloquea. gemini NO es postergable, porque seis pasos posteriores lo consumen.",
    ],
    commits: [
      { sha: "eb6e39fc", msg: "Dejar un paso pendiente y seguir: la salida del onboarding", lineas: 515, archivos: 8 },
      { sha: "289ef79c", msg: "Retomar el wizard pregunta por la pantalla, no la cuenta", lineas: 61, archivos: 2 },
      { sha: "7cfa876b", msg: "«Seguir sin Meta» posponía el mismo muro tres pantallas, y ahí no había salida", lineas: 93, archivos: 2 },
    ],
  },
  {
    fecha: "16 ago", hora: "11:03", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "«Bienvenido a MaKo»: la pantalla que se ve antes de la primera pregunta",
    puntos: [
      "Pedido del dueño: antes de la primera pregunta va una pantalla sola, con título, una frase y un botón de comenzar, con la forma de Opal. La frase final rota escribiéndose y borrándose letra por letra, y las cinco frases no son adjetivos: son las cinco cosas que MaKo hace de verdad. Se muestra UNA vez y el que se acuerda es el server (status 'pending' → 'in_progress'), no sessionStorage. Alrededor de eso se pagó una tanda larga de detalles que solo aparecen mirando la pantalla: el clip de intro (ojo → zoom → neuronas), el chip de «tema en prueba» que se dibujaba encima de lo primero que ve un cliente, y 444 avisos de React por carga porque los cinco pilares del mapa comparten id con las áreas del catálogo real.",
      "La lección que gobernó toda la tanda y se pagó cuatro rondas seguidas: MEDIR UNA PROPIEDAD NO ES VER. Se midieron opacidades y clases del DOM cuatro veces, las cuatro dieron «bien», y al grabar la pantalla con screencast se vio lo que el dueño reportaba — el ojo limpio duraba UN cuadro y un abanico de fibras SVG lo tapaba cuatro segundos. Misma familia: los 25 <text> del grafo SIEMPRE estuvieron en el DOM con su caja y su posición, no se pintaban porque la pantalla no montaba <TemaOscuro> y --ink seguía siendo el del tema claro (negro sobre negro); y sondeando con CDP se reportó «0 nodos, SVG 0x0» midiendo un viewBox de 24x24 — un ícono, no el grafo. Dos trampas más que quedan escritas: dos animaciones que tocan transform en el MISMO elemento se pisan y la segunda gana (ya pagado en /second-brain con los nodos que «no flotaban», 0,03 px medidos), y el corte del video va por `currentTime` y nunca por setTimeout — el temporizador mide el reloj de pared y el video el suyo. Y la licencia: la cláusula que decide no es «uso comercial», es la standalone de Pixabay, más que no hay model release; queda en public/onboarding/CREDITOS.md con el aviso de que si algún día se usa pelado hay que volver a mirarlo.",
    ],
    commits: [
      { sha: "1367e118", msg: "Bienvenido a MaKo: la pantalla que se ve antes del wizard", lineas: 359, archivos: 2 },
      { sha: "29cb78d2", msg: "La frase que se escribe sola, rotando lo que MaKo hace de verdad", lineas: 88, archivos: 1 },
      { sha: "9e13410a", msg: "El ojo real: video de Pexels + zoom a la pupila + neuronas + flash", lineas: 151, archivos: 5 },
      { sha: "cc1224b2", msg: "La bienvenida, rehecha después de MIRARLA cuadro por cuadro", lineas: 159, archivos: 2 },
      { sha: "57c26faf", msg: "El clip correcto: ojo, zoom entrando, y neuronas. Un solo archivo", lineas: 84, archivos: 6 },
      { sha: "fde028b5", msg: "La barra de agencia se dibuja adentro, y el botón vuelve al sistema", lineas: 195, archivos: 4 },
      { sha: "c0aa1dc2", msg: "444 errores por carga que nadie veía: dos nodos del mapa con el mismo id", lineas: 33, archivos: 2 },
      { sha: "6ac48b05", msg: "La primera frase se borraba antes de poder leerla", lineas: 20, archivos: 1 },
    ],
  },
  {
    fecha: "16 ago", hora: "12:03", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El mapa de la bienvenida: ficción o Grafo real, cuatro idas y vueltas",
    puntos: [
      "El mapa que se arma bajo el dedo del cliente cambió de premisa cuatro veces, cada una con un pedido textual del dueño: «el grafo no lo inventes, utiliza el real, que sea interactivo, desde el primer nodo» → se montó el Grafo de /second-brain; «justamente esto es ficción, es un grafo sin info» → volvió a datos inventados con todo controlado nodo por nodo; «no seas extremista... haz que se comporte igual que nuestro grafo, solo que CONTROLA qué sí y qué no» → datos de ficción con el movimiento portado de Grafo.tsx con sus números exactos; y al final «mejor vuelve a la versión que estaba antes y simplemente vamos paso a paso», que revirtió la última vuelta porque resolvía tres reclamos trayendo dos viejos («avanzamos 1 paso y retrocedemos 3»).",
      "El argumento que cierra la discusión es un DATO medido, no una preferencia: el cerebro real de un cliente recién reseteado son 25 nodos y casi todos son etapas de un funnel que él no armó — mostrarle eso es mostrarle el negocio de otro. Pero la forma y el comportamiento sí son los de verdad, y lo que sale del catálogo real (la paleta --grafo-* y los nombres de las once áreas) tiene un test que falla si alguien los copia a mano, para que el día que llegue a su Second Brain reconozca lo que vio el primer día. Tres cosas que quedan aunque el código haya vuelto atrás: montar el Grafo real destapó un bug VIVO de /second-brain (el efecto del bucle de pintado tenía `pintar` en las dependencias, así que FILTRAR reiniciaba t0 y relanzaba el mapa entero); lib/bienvenida-cerebro.ts quedó escrito, con test y con la forma MEDIDA contra los cuatro umbrales de cerebro-grafo.ts, sin usar todavía — cuando el mapa vuelva a montarse sobre el Grafo real esa mitad ya está resuelta y no hay que rediscutirla; y las aserciones en negativo de los tests miran el código SIN comentarios, porque los comentarios nombran a propósito lo que no hay que hacer y un test que se dispara con la prosa que explica el bug es un test que se aprende a ignorar.",
    ],
    commits: [
      { sha: "d0f7d6f0", msg: "La bienvenida monta el grafo REAL, y el texto toma la forma de Opal", lineas: 348, archivos: 4 },
      { sha: "47c54dd6", msg: "La bienvenida monta el Grafo REAL y lo revela por clicks", lineas: 311, archivos: 5 },
      { sha: "da7bbec1", msg: "El mapa vuelve a ser ficción, y todo lo suyo se controla a mano", lineas: 303, archivos: 5 },
      { sha: "e892d3cc", msg: "El cerebro se arma con las manos del usuario, no se muestra", lineas: 281, archivos: 4 },
      { sha: "ed941238", msg: "El movimiento es el del grafo real; lo que se controla es CUÁNDO", lineas: 128, archivos: 2 },
      { sha: "e4a8f9c3", msg: "La bienvenida monta el Grafo REAL: se arrastra, se clickea, y las líneas siguen", lineas: 324, archivos: 4 },
      { sha: "36326492", msg: "Volver a la versión estable de la bienvenida, y hacerlo paso a paso", lineas: 417, archivos: 4 },
      { sha: "7c2a3edb", msg: "Las líneas siguen a los nodos, y el click hace zoom a la sección", lineas: 228, archivos: 2 },
    ],
  },
  {
    fecha: "16 ago", hora: "20:14", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La cuota que encerraba al cliente: la salida existía en UNA sola pantalla",
    puntos: [
      "Pedido del dueño con un cliente trabado en vivo: «no puede ser que se exceda la quota durante el onboarding, y en dicho caso debería ahí mismo saltar la opción de dejarle otra key, como ya tenemos configurado». Estaba configurado: ConectarIA vivía enchufado en MatrizView y en ningún otro lado, así que en el Archivero y en la cara de marca el cliente veía el error crudo de Google y cero botones — justo cuando todavía tiene una sola key. Se creó la pieza ErrorIA (error + salida juntos), la usan las tres pantallas y hay guarda que falla si alguna deja de importarla.",
      "Dos fallas encadenadas que se tapaban entre sí, y la segunda es la que cuesta encontrar: aunque el componente hubiera estado puesto, no se habría dibujado nunca — el detector era un regex suelto en MatrizView que buscaba «cuota» y lo que Google manda es «quota». Ahora `esErrorDeIA` vive en lib/ia-mensajes.ts (puro, testeable) con el error TEXTUAL que vio el cliente como test. Y el diagnóstico de fondo, que solo apareció al leer el error completo en vez de esconderlo: `limit: 20, model: gemini-3.7-flash` — el free tier de ese modelo son VEINTE requests, y un onboarding con 6 documentos y varias fotos se lo come solo. No es un cliente que usa de más, es el modelo equivocado para el trabajo; por eso la rotación de modelo se extendió al camino de VISIÓN (leerDocumentoIA), que es el que falló acá porque la cara de marca son fotos.",
    ],
    commits: [
      { sha: "740bc35f", msg: "La salida para cargar otra key estaba configurada. En UNA sola pantalla", lineas: 349, archivos: 7 },
    ],
  },
  {
    fecha: "10 oct", hora: "21:43", chat: "Onboarding", cuenta: "claude3",
    actor: "martin", tipo: "prompt",
    titulo: "Revisar el proyecto del Onboarding y dejarlo en Runway",
    pedido: "Revisa el proyecto del plan \"ONBOARDING\" y ponlo todo en Runway... Revisa según nuestro criterio si no hay que repriorizar o eliminar directamente tareas innecesarias",
    puntos: [
      "Llegó después de medir el estado del área, que no tenía briefing: el último chat «Onboarding» era del 05/09 y desde entonces el área se había tocado desde Chatbot, CRM y Customer Success.",
    ],
  },
  {
    fecha: "10 oct", hora: "21:43", chat: "Onboarding", cuenta: "claude3",
    actor: "claude", tipo: "implementacion",
    titulo: "La depuración del proyecto: 5 se quedan, 10 se posponen, 4 se cierran y 1 se borra",
    puntos: [
      "Las 20 abiertas de «Feature: Onboarding» se midieron una por una contra el código y la base, con el criterio de la etapa 3 («Onboarding + el video») y la poda del 03/10. Se quedan #734 (la cuota de Gemini frena el arranque), #171 (el histórico de Meta nunca llega: una línea en lib/onboarding-extract.ts:67), #737 (el video tutorial), #801 (el Ads Manager sin onboarding; el Offer Analyst salió con P2) y #201 (Instagram «leída» vacía). Cuatro de las pospuestas eran para la versión gratis y se posponen, no se borran: la versión gratis se postergó, no se descartó.",
      "Lo que no se ve en el diff: la depuración del 25/09 ya había mandado abajo #614, #652 y #706, y el 01/10 volvieron a subir. No fue el reparto diario sino `applyGuardian`, la re-priorización del navegador que corre cuando cambia el conjunto de abiertas y pisa score y base de todas. Por lo que se lee en el código tampoco mira `score_manual`. Esta depuración escribió la base sin fijarlas, y fijarlas lo decide Martín.",
    ],
    commits: [
      { sha: "dae23ffa", msg: "Runway: la depuración del Onboarding, con la misma tabla que el CRM", lineas: 456, archivos: 5 },
    ],
    archivos: [
      "app/admin/runway/datos.ts — ONB_VEREDICTOS, ONB_ELIMINADAS y ONB_TE_TOCA: el veredicto de cada tarjeta",
      "app/admin/runway/page.tsx — TablaVeredictos y ListaPendientes, que ahora usan el CRM y el Onboarding",
      "app/admin/runway/tareas.ts — PROYECTO_ONBOARDING",
      "docs/hallazgos-onboarding.md — «La depuración del proyecto del tablero»",
      "docs/hallazgos-plan.md — «Una depuración de prioridades dura hasta que alguien cierra una tarjeta»",
    ],
  },
];
