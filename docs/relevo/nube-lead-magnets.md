# Relevo — Lead Magnet Generator (nube, 6/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_a7d6638b-0aff-5cb9-a16a-98377f9db136`). Es de primera mano sobre
> lo que se escribió y se probó acá. Lo de producción NO se midió: desde la nube no hay base ni claves.

## Lo pedido (por el Cerebro, 6/11; el pedido de Martín es del 29/10)

Martín, 29/10/2026: «me lo imagino como una o varias plantillas... compartir un Notion con prompts, una guía, un checklist; un
quiz (preguntas que llevan a un diagnóstico)... con el Web Generator; si la landing no lo permite, que el editor permita
agregar formularios, enviar emails, conectarlo con el CRM o las automatizaciones; una clase grabada o un curso, que ya está
Classroom... pensá qué más, por ejemplo dashboards».

El «Cómo» del Cerebro, en seis puntos: (1) armar con lo que ya existe, la tab es plantillas y un camino simple, no un editor
nuevo; (2) lo que falte para captar: formulario al CRM, entrega por email o WhatsApp y disparador en Automations, medido
antes; (3) quiz con diagnóstico, con tests que lo rompan; (4) MaKo lo propone desde la oferta y Competitors Spy, cada negocio
con su IA y sin gurús en la galería; (5) copiar el flujo de UNA app real; (6) sus operaciones en la API de MaKo. Escritorio y
teléfono, por `punta/lead-magnets`, en tandas que anden solas. No tocar `app/ads-manager`.

## Dónde está

Rama `punta/lead-magnets` (y la de la sesión, `claude/amazing-johnson-fp86gs`). GitHub la lleva a main con el verde de
`punta.yml`; a producción, el cron del día. **Sin mirar desde la nube:** si la corrida dio verde.

## Tanda 1: la tab (hecha)

- **Cinco plantillas** (`lib/lead-magnets/plantillas.ts`): guía, checklist y prompts para copiar (en Copywriting), planilla
  (una tabla en Copywriting) y clase grabada (una landing del Web Generator, con el objetivo nuevo «Clase grabada»). Cada una
  nace con su ESTRUCTURA y la guía de cada sección; «Ver ejemplo» muestra un negocio ficticio del elenco y nunca entra a la
  pieza.
- **La lista de lead magnets es la de siempre** (`mako.entregable`): cada fila suma dónde vive su pieza, su plantilla y su
  página de captura. La tab la muestra con lo que le falta a cada uno para llegarle a un lead.
- **La página que lo pide:** una landing con formulario (entra al CRM) y su página de gracias con el link. Nace como borrador.
- **El link público:** de solo lectura, para la página de Copywriting (`/compartido/<token>`). No sale con la guía puesta.
- **«Ponerlo primero»:** las automatizaciones mandan el link del primero de la lista.
- **API de MaKo, área `leadmagnet`:** `ver_plantillas_magnet`, `armar_magnet`, `pagina_captura_magnet`,
  `link_publico_magnet`, `primero_magnet`. La lista y su edición ya estaban en `negocio` (`listar_lead_magnets`,
  `editar_lead_magnet`). Ninguna entra a una automatización.
- **Teléfono:** `/lead-magnet-generator` en el teléfono (`app/m/lead-magnet-generator/`), en More para el super admin.
- **De paso:** el paso Entregable del onboarding borraba el link al guardar; arreglado.

Tests: `tests/lead-magnets.test.ts`, y los del registro de la API, el nav, el teléfono y el Web Generator actualizados.

## Tanda 2: el quiz con diagnóstico (hecha)

- **Un bloque nuevo del Web Generator, «Quiz»** (`lib/editor-landing/quiz.ts`): preguntas de opción única con puntos, y el
  puntaje elige un resultado por rango («desde N puntos»). Antes del resultado piden nombre y correo (y el WhatsApp, si se
  marca): entran al CRM por el Pixel, con el resultado, el puntaje y hasta 6 respuestas como datos del lead.
- **Un objetivo de landing nuevo, «Quiz con diagnóstico»** (galería del Web Generator, categoría «Captar contactos»), y la
  plantilla «Quiz» en la tab Lead Magnet.
- **El editor** (`app/web-generator/editor/nodos/QuizVista.tsx`): título, qué van a saber, el botón para empezar, preguntas con
  sus puntos, el contacto y los resultados. Dice qué falta para que se muestre y qué botón no va a salir.
- **API de MaKo:** `configurar_quiz_landing` (área `landing`, al final del área).
- **La regla del resultado vive en el server y en el navegador**, y un test los iguala sobre miles de casos.
- **El flujo y las medidas se copiaron de SurveyJS** (MIT): por qué, en `docs/investigacion-lead-magnets.md`.

Tests: `tests/quiz-landing.test.ts` (11, probados rompiéndolos) y `tests/lead-magnets.test.ts` (11).

## Dos revisiones de quien no escribió el código

La primera (sobre la tab) encontró nueve cosas y la segunda (sobre el quiz y los arreglos) diez. Todas se arreglaron; el
detalle, en `docs/hallazgos-lead-magnets.md`. Lo más importante:

- Las respuestas del quiz se guardaban como la **empresa** o el **teléfono** del lead si la pregunta decía «negocio» u «hotel».
- Una página de captura en la **papelera** se seguía mostrando como publicada.
- Había **cuatro lugares más** que escribían la lista de lead magnets sin protección; uno la vaciaba con la base caída. Ahora
  hay una sola puerta y la otra se borró.
- «Dejar de compartir» o vaciar el link del **primero** dejaba a las automatizaciones mandando el mensaje sin link.

## Autocrítica

Capturas a escala 2 en `docs/diseno/lead-magnets/captura/` (arnés en `out/arnes-lm/`, fuera de git: dibuja los componentes
reales con datos de ejemplo y abre el quiz publicado en Chromium).

**Lo que cambié por mirarla como cliente:**
- **El detalle de un lead magnet pasó a filas con UN solo botón principal** (la pieza, su link, su página, cómo le llega). La
  primera versión tenía cuatro botones del mismo peso y no se sabía por dónde empezar. Ver `tab-abierto-sin-link-1440.png`.
- **La página de captura ya no promete un correo** que nadie manda («Revisa tu correo»): ahora dice lo que pasa (el botón abre
  el lead magnet).
- **El teléfono tiene lo mismo que la computadora** (`m-abierto-390.png`): la primera versión no dejaba crear el link ni la
  página desde el teléfono.
- **Con `?lm=` y la lista sin leer, la tab mostraba «Nuevo»** como si no existiera: ahora lo dice
  (`tab-error-abierto-1024.png`). El mensaje salía repetido y el botón ocupaba todo el ancho: corregido al mirar la captura.
- **El quiz:** el rótulo de cada respuesta lleva su número; el foco va al paso nuevo; exportado, la portada sola.

- **«MaKo te propone» es un botón y no corre al entrar**: cada pedido gasta la IA del negocio. Al entrar se ve la última
  propuesta guardada (`tab-propone-1024.png`); sin ninguna, sólo el título y el botón (`tab-propone-sin-propuestas-1440.png`).
- **Las propuestas van en una lista con filete, no en tarjetas como las plantillas**: son tres ideas para elegir una, y con el
  mismo peso que las plantillas competían con ellas.

**Lo que descarté, y por qué:**
- **Mostrar en la lista de la izquierda cuál es el primero (el que mandan las automatizaciones).** La lista es la pieza
  compartida de Create (`app/_crear/PantallaCrear.tsx`) y no tiene un lugar para un rótulo por renglón; agregarlo es tocar las
  cinco tabs de Create. El detalle de cada uno ya lo dice («Cómo le llega»). Queda para quien rediseñe Create.
- **Un editor de quiz propio en la tab.** El quiz es un bloque del Web Generator: un segundo editor sería la segunda
  implementación de lo mismo.
- **Inscribir al lead en su automatización al instante.** Cambia el ritmo de todas las landings de todos los negocios: es
  decisión de Martín (abajo).

**Lo que no pude mirar desde la nube:** la tab corriendo con una base de verdad (no hay claves), el quiz publicado en
hola-mako.site y el Pixel mandando a `/api/track/optin` de producción. Lo probé con el Pixel real en un navegador simulado
(jsdom) y con Chromium sobre el HTML que genera el editor.

## Lo que pide producción

- **Ninguna migración.** Nada que aplicar.
- **Nada que configurar.** «MaKo te propone» usa la IA conectada del negocio (la plataforma, la suya). La tab se ve sólo desde la plataforma (el super admin sin mirar a un cliente). El bloque Quiz y el
  objetivo «Quiz con diagnóstico» del Web Generator los ve todo negocio que use el Web Generator.

## Lo que decide Martín

1. **¿Se abre a los clientes?** Hoy es sólo de la plataforma. Abrirla es sacar `adminOnly` (nav.ts), la puerta
   (`app/lead-magnet-generator/puerta.ts`) y `soloPlataforma` (`lib/api-mako/areas/leadmagnet.def.ts`), las tres juntas.
2. **¿El mensaje con el link sale al instante?** Hoy el lead del formulario entra al CRM en el acto y su automatización lo toma
   en el barrido de `/api/cron/nutricion`. El lead ya tiene el link en el botón de la página de gracias; lo que espera es el
   WhatsApp o el email. Inscribirlo al alta cambiaría el ritmo de todas las landings de todos los negocios. Recomendación: no
   tocarlo hasta que un negocio lo pida.
3. **¿Un lead puede entrar a Classroom?** Hoy un curso es para clientes que ya compraron. La clase grabada va como landing.
4. **¿El quiz se parece a Typeform?** Se copió de SurveyJS (código abierto) porque Typeform no se abre desde la nube. Si
   quiere otra referencia, se mide en su Chrome.

## Tanda 3: MaKo propone el lead magnet (hecha)

- **En «Nuevo lead magnet», arriba de las plantillas, «MaKo te propone»**: un botón pide hasta 3 propuestas desde la oferta del
  negocio y lo que hace su competencia en Competitors Spy, con la IA del negocio. Cada una dice su plantilla, su nombre, por qué y
  de dónde sale, y «Armar este» la crea como una tarjeta de la galería. La última propuesta queda guardada.
- **En el teléfono**, lo mismo en la hoja de «Nuevo».
- **API de MaKo:** `proponer_magnet` (lectura, cuesta la IA del negocio, no guarda nada).
- **El prompt es editable** en /configuraciones (grupo «Lead Magnet (MaKo propone)»), y lo que el código descarta no depende del
  texto.

Tests: `tests/lead-magnets-propuesta.test.ts` (8, cada regla probada rompiéndola). Un tercer revisor la leyó: encontró, entre otras,
que un apellido o el nombre de un curso pasaban, y que un número inventado no tenía chequeo. Arreglado; el detalle en
`docs/hallazgos-lead-magnets.md`.

## Lo que sigue

- Nada pedido queda sin hacer. Lo que espera una decisión, arriba.
