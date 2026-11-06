# Hallazgos — Lead Magnet Generator

Lo que no se deduce leyendo el código del área (`app/lead-magnet-generator/`, `lib/lead-magnets/`). El porqué del diseño de
la tab y la fuente que se copia, en [investigacion-lead-magnets.md](investigacion-lead-magnets.md); lo que falta y lo que
decide Martín, en [relevo/nube-lead-magnets.md](relevo/nube-lead-magnets.md).

## La tab, tanda 1 (nube, 6/11/2026)

**Vive en:** `lib/lead-magnets/`, `app/lead-magnet-generator/`, `app/m/lead-magnet-generator/`,
`lib/api-mako/areas/leadmagnet.def.ts`, `app/compartido/[token]/LeadMagnetCompartido.tsx`, `lib/entregable.ts`.

### La lista de lead magnets ya existía, y manda el PRIMERO

- `mako.entregable` (`lib/entregable.ts`) es la lista viva: la leen las automatizaciones, el grafo, los guiones y la API. La
  tabla `lead_magnets` (mig 0169) existe y no la lee nadie que mande algo: no se usó.
- **`{{negocio_lead_magnet_link}}` sale del PRIMERO de la lista** (`valoresDelLeadMagnet`, `lib/variables-del-lead.ts`), no del
  que se acaba de crear. Por eso la tab tiene «Ponerlo primero» y la API `primero_magnet`: armar uno nuevo no cambia lo que
  reciben los leads hasta que se lo pone arriba. Si un día cada automatización elige SU lead magnet, la regla vive ahí.
- La lista se escribe por compare-and-set (`cambiarSettingSi`) sobre la lectura ESTRICTA: con la base caída, escribir sobre
  la tolerante borraba la lista entera.

### Un bug viejo: editar el Entregable del onboarding borraba el link

- **Síntoma (no reportado, encontrado leyendo):** cambiarle el nombre a un lead magnet en el paso Entregable dejaba a las
  automatizaciones sin link.
- **Causa:** la acción `guardar` de `app/api/onboarding/entregable/route.ts` reconstruía cada fila con `{ id, nombre, tipo, queEs,
  fomo }`, sin `enlace`. Y `generar` tiraba las filas viejas, también las que tenían un link puesto.
- **Arreglo:** `guardar` funde por id sobre lo guardado; `generar` conserva las que tienen link o pieza. Es la regla de
  AGENTS.md «Un campo nuevo en un objeto que se guarda ENTERO se busca en TODOS los que lo escriben», en un campo de agosto.

### Lo que existe para captar, medido antes de escribir

- **El formulario de una landing ya entra al CRM:** el Pixel manda el envío a `/api/track/optin`, que crea el lead
  (`createLead`). Faltaba la página: se arma con el objetivo `lead-magnet` del Web Generator y `personalizarLanding` le pone el
  nombre, apunta el formulario a la página de gracias y le da a su botón el link del lead magnet.
- **La automatización NO lo toma al instante.** El alta no inscribe a nadie: la inscripción la hace el movimiento de etapa
  (`enrolarPorEvento('etapa')`) y, para un lead que nace parado en una etapa, el barrido de `/api/cron/nutricion`. Quien
  descarga el lead magnet puede esperar hasta ese barrido para recibir el mensaje con el link. La página de gracias ya lleva
  el link en su botón, así que el lead lo tiene en el acto; lo que espera es el WhatsApp o el email. Inscribir en el alta
  cambiaría el ritmo de todas las landings de todos los negocios: queda como decisión en el relevo.
- **El link que abre un lead sin cuenta:** un recurso nuevo de `shares`, `lead-magnet`, de SOLO LECTURA. Lo dibuja el server
  sin TipTap (`LeadMagnetCompartido`), y `paginaDelShareLM` lo exige en positivo: recurso, alcance `item`, permiso `ver`, un
  id de página del Copywriter. Un link de este recurso nunca edita (eso es el recurso `copywriter`).
- **El link no sale con la guía puesta** (`guiasQueQuedan`): si una sección todavía dice lo que escribió la plantilla, la tab
  dice cuáles cambiar. Una guía compartida es un lead magnet que promete y no entrega.

### Classroom y Dashboards no son plantillas, a propósito

- **Classroom:** el acceso a un curso es para clientes que ya compraron (un lead no entra). La clase grabada se arma como una
  landing con un objetivo nuevo, `clase-grabada` (`lib/editor-landing/plantillas.ts`): se registran y la ven en la página de
  gracias. Si Martín quiere que un lead entre a Classroom, es otra puerta y se decide aparte.
- **Dashboards:** compartir un informe muestra los números del negocio. La «planilla» (una tabla en Copywriting) cubre lo que
  un dashboard de regalo prometía, sin datos de nadie.

### Trampas que costaron una vuelta

- **Un `.css` importado en un componente que dibuja un test rompe la carga en node** (`SyntaxError: Unexpected token '.'`). La
  hoja de la página pública la importa `app/compartido/[token]/page.tsx`, no el componente.
- **«El ejemplo no tiene huecos» no es «no tiene corchetes».** La plantilla de prompts lleva `[cliente]` en cada prompt: es
  su contenido. El test busca las marcas de un hueco («por completar», «[Completar…»), no cualquier corchete.
- **Los ids de la API no llevan «lead»**: `RELEVANCIA_CRM` (`lib/mako-intencion.ts`) le suma puntos a todo id con esa
  palabra y una operación rara le saca el lugar a las del CRM en el presupuesto de 12.000 caracteres. Por eso
  `armar_magnet` y no `armar_lead_magnet`.
- **La tab es sólo de la plataforma por ahora**, en TRES lugares: `adminOnly` en `nav.ts` (esconde la fila), la puerta de
  `app/lead-magnet-generator/puerta.ts` (la pantalla y la ruta) y `soloPlataforma` en la API. Abrirla a los clientes es sacar
  las tres; sacar una sola deja una puerta abierta o una fila que no lleva a nada.

## La primera revisión de la tab (nube, 6/11/2026)

**Vive en:** `lib/entregable.ts`, `lib/entregable-fundir.ts`, `lib/lead-magnets/server.ts`, `lib/lead-magnets/landing.ts`,
`app/lead-magnet-generator/reglas.ts`, `lib/api-mako/areas/leadmagnet.run.ts`.

Un revisor que no escribió el código encontró nueve cosas confirmadas. Las que enseñan algo:

- **Dos escritores de la misma lista son dos copias de la regla.** La tab y el paso Entregable del onboarding escribían
  `mako.entregable` cada uno con su compare-and-set, y uno de los dos tiraba las filas sin nombre. Ahora escribe UNO,
  `cambiarEntregables` (`lib/entregable.ts`), y el onboarding funde con `fundirDelOnboarding` (puro, con test): conserva el
  orden guardado, actualiza los textos por id y no toca la pieza ni la página que el onboarding no conoce.
- **La página de captura prometía un correo que nadie manda.** El objetivo `lead-magnet` del Web Generator decía «Revisa tu
  correo» y «Te la mandamos a tu correo en segundos», y lo que llega es el link en el botón de la página de gracias (el
  mensaje sale en el barrido de la automatización, si hay una). `SIN_PROMESA_DE_CORREO` (`lib/lead-magnets/landing.ts`)
  cambia esas frases al armarla. La regla: lo que la página promete lo tiene que hacer la página, no un proceso que puede no
  estar.
- **Cambiar el link dejaba la página de gracias con el viejo.** `conLinkNuevo` mueve el link en los botones de la página de
  gracias que llevaban el anterior (o `#`), y si la página ya no se puede tocar lo dice (`aviso`).
- **«Dejar de compartir» y «Quitar de la lista» revocan el link de solo lectura.** Quitar un lead magnet dejaba su link
  público vivo para siempre, sin ninguna pantalla desde donde cortarlo. (El orden de esas dos escrituras lo corrigió la
  segunda revisión: abajo.)
- **«Ponerlo primero» exige link.** Sin link, el primero de la lista deja a las automatizaciones mandando `{{negocio_lead_magnet_link}}`
  vacío: el renglón con el dato se borra y el mensaje sale sin lo único que prometía.
- **Una página de captura de una landing BORRADA se vuelve a armar**, y la que quedó huérfana por una carrera va a la papelera
  del Web Generator, nunca se borra.
- **El link de una pieza del Web Generator es su URL PUBLICADA**, no un share: «Falta publicarla y usar su link» hasta que
  esté en hola-mako.site.
- **La API pregunta lo mismo que la pantalla, antes del «sí»:** `link_publico_magnet` revisa la guía puesta en `preparar`
  (`revisarParaCompartir`), no después de confirmar.

## El quiz con diagnóstico, tanda 2 (nube, 6/11/2026)

**Vive en:** `lib/editor-landing/quiz.ts`, `app/web-generator/editor/nodos/QuizVista.tsx`, `lib/editor-landing/plantillas.ts`
(objetivo `quiz`), `lib/editor-landing/css.ts` (`QUIZ`), `lib/api-mako/areas/landing-editor.*` (`configurar_quiz_landing`),
`lib/lead-magnets/plantillas.ts` (`QUIZ`), `tests/quiz-landing.test.ts`.

- **Es un bloque del Web Generator, no una herramienta nueva.** Preguntas de opción única, cada opción suma puntos y el
  puntaje elige UN resultado por rango («desde N puntos»). Antes del resultado, un formulario de contacto. El flujo y las
  medidas se copiaron de SurveyJS (MIT): por qué ésa y no Typeform, en [investigacion-lead-magnets.md](investigacion-lead-magnets.md).
- **La regla del resultado vive en DOS lugares y un test los iguala.** El navegador la corre como texto adentro del script de
  la página (`ELEGIR_RESULTADO_JS`) y el server con `indiceDeResultado`. El test los corre a los dos sobre miles de casos.
  Probado rompiéndolo: cambiar `<=` por `<` en el server da 2 rojos; que el navegador elija el PRIMERO que alcanza, 3.
- **El resultado y las respuestas llegan al CRM sin tocar el Pixel.** El Pixel ya mandaba hasta 8 campos de texto que no son
  de contacto (`otrosCampos`, `lib/landing-token.ts`). El quiz llena campos de solo lectura con el resultado, el puntaje y
  hasta 6 respuestas, cada uno envuelto en una ETIQUETA con la pregunta. ⚠️ **Nunca con `aria-label`.** El Pixel decide qué
  es contacto buscando «negocio», «tel», «mail», «nombre» (y más) en name, id, placeholder y aria-label: con la pregunta en
  el `aria-label`, «¿Cuánto factura tu negocio?» llegaba como la EMPRESA del lead y «¿Tienes hotel…?» como su TELÉFONO
  (`campo()` busca por substring). La etiqueta no entra en esas pistas y es lo primero que el Pixel lee como rótulo. Lo
  encontró escribir esta cosecha, no un test: el test de antes usaba preguntas sin esas palabras. Lo fija el test
  «una pregunta que nombra el negocio, un hotel o el email…».
- **Sin el dato no sale.** Sin una pregunta completa (texto y dos opciones) y un resultado con título, `render.ts` lo saltea,
  como los bloques de venta. El editor dice qué falta.
- **Dos quizzes en una página no se pisan:** los radios llevan un `name` por quiz y por pregunta.
- **Lo que se ve sin JavaScript es la portada**, no el quiz: un visitante sin script no puede contestar, y un formulario
  suelto sin preguntas entregaría un resultado que no existe.
- **La IA no lo toca:** viaja cerrado (`CON_REF`) y vuelve igual, como los bloques de venta. Lo cambia la persona o
  `configurar_quiz_landing`.

### Trampas que costaron una vuelta

- **Un salto de línea crudo dentro de un string de TypeScript lo rompe sin que se note en el editor.** Se escribió el ejemplo
  del quiz con un script de Python y el `\n` quedó como un salto real: el archivo no compilaba. Va `\\n`.
- **Un ícono que no existe dibuja un punto** (`Icon name="borrar"`): se usa el set (`trash`, `x`), y se mira en la captura.

## La segunda revisión (nube, 6/11/2026)

**Vive en:** `lib/lead-magnets/server.ts`, `lib/entregable.ts`, `lib/entregable-fundir.ts`, `lib/editor-landing/quiz.ts`,
`lib/api-mako/areas/negocio.helpers.ts`, `lib/api-mako/areas/chatbot.helpers.ts`, `app/api/chat-agent/secuencias/route.ts`,
`app/onboarding/EntregableView.tsx`, `app/web-generator/editor/nodos/QuizVista.tsx`.

Un segundo revisor, sobre el quiz y los arreglos de la primera: siete confirmados y tres posibles. Lo que enseña:

- **`landings.abrir` devuelve también las de la PAPELERA, sin decirlo** (`LandingCompleta` no trae la marca). Una página de
  captura en la papelera no se sirve, y la tab decía «Publicada». La marca está en la LISTA (`landings.listar` →
  `papelera`): `existeLanding`, `landingsDelNegocio` y el link de una clase grabada preguntan ahí.
- **Revocar es una escritura que no se deshace: va DESPUÉS de la que sí.** `quitarDeLaLista` revocaba y después sacaba de la
  lista; si la segunda fallaba (409/503), quedaba en la lista, quizás primero, con un link que ya no abre. Ahora sale de la
  lista primero, revoca después, y si revocar falla vuelve a su lugar.
- **Una regla que vale para «Ponerlo primero» vale para todo lo que deja al primero sin link.** «Dejar de compartir» y vaciar
  su link dejaban a las automatizaciones mandando el mensaje sin él. Los dos se frenan con `ES_EL_PRIMERO`, en la pantalla, en
  la API (antes del «sí») y en el server.
- **«Dejar de compartir» sale de los links ABIERTOS, no del link que tiene.** Uno que se cambió por la API (`editar_lead_magnet`)
  dejaba el anterior abierto y sin botón. `compartidosPorPieza` los cuenta en una lectura.
- **«Un escritor» no era cierto: había cuatro más.** `regenerarLeadMagnets`, `editarLeadMagnet`, `crearLeadMagnet` (API de
  Automations) y la ruta de secuencias escribían `mako.entregable` con un `setEntregables` suelto, y la ruta lo hacía sobre la
  lectura TOLERANTE: con la base caída guardaba la lista con un solo lead magnet. Se borró `setEntregables`: ahora el
  compilador no deja escribir la lista por otro lado que `cambiarEntregables`. **La lección: «la escritura pasa por una
  puerta» se cumple borrando la otra puerta, no documentándola.**
- **Un control que no hace nada, otra vez.** El tacho del onboarding sobre una tarjeta armada en la tab: el guardado la
  conserva (está bien, se quita desde la tab) y la tarjeta volvía sola. Ahora esa tarjeta dice «En Lead Magnet» y lleva ahí.
- **Una lista sin nombre es invisible en todas las pantallas** (`getEntregables` la filtra). Vaciar el nombre de una tarjeta la
  dejaba guardada, sin forma de verla ni quitarla, y si era la primera cambiaba en silencio el link que mandan las
  automatizaciones. Ahora vaciar el nombre conserva el que tenía, y una nueva sin nombre no se guarda.
- **El foco entre pasos del quiz.** Al apretar «Siguiente» el botón queda escondido y el foco caía al `body`: el teclado y el
  lector de pantalla perdían el lugar. `enfocar(k)` lo lleva a la opción, al primer campo o al resultado.
- **Lo exportado del quiz era el resumen del editor** («desde 3 puntos», «Pregunta 2 sin escribir»). En `modo: 'exportar'`,
  la portada sola.
- **El botón de un resultado sin link de la casa desaparecía al publicar sin aviso.** `avisoDelBoton` lo dice al lado.
- ⚠️ **Las capturas «de la lista» eran la pantalla de «Nuevo».** En Create la lista vive detrás de la «←» de la tarjeta de
  MaKo, y un render estático muestra la cara inicial. Cuatro capturas idénticas con cuatro nombres distintos se leyeron como
  revisadas. Se arregló en el arnés (cambia la cara inicial) y el estado que no se veía tenía un hueco real: con `?lm=` y la
  lista sin leer, la tab mostraba «Nuevo» como si no existiera. **Antes de dar por mirada una captura, comparala con la de al
  lado: si son iguales, no miraste lo que dice el nombre.**
