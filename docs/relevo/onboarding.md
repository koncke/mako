# Onboarding: el arranque del cliente nuevo y el onboarding de cada tab

## ⚠️ Actualización del 16/10/2026: el wizard ya no existe

<sub>Escrito el 16/10/2026 por el chat «Onboarding» (claude3), sobre lo suyo. Main `9f89a5004`. Lo de abajo
(10/10) describe el wizard: sirve como historia, no como mapa.</sub>

- **El onboarding es el chat de Offer** (Martín: «el onboarding será ese chat de offer»). Lo lleva el chat
  Offer: `/onboarding` dibuja `ChatArranque.tsx`, el cierre pasa por UNA puerta (`cerrarPasosOnboarding`,
  lib/onboarding-state.ts) y la regla del cierre es `aplicarCambiosDePaso` (lib/onboarding-contrato.ts).
  `OnboardingWizard.tsx`, `Bienvenida.tsx` y `Listo.tsx` se borraron. Las cuatro redirecciones a /onboarding
  siguen igual.
- **El crédito de Claude de la plataforma** (dos planes Max de Martín) sólo durante el onboarding, y sólo para
  `'offer'`, `'El Archivero'` y `'onboarding-extract'` (`CREDITO_HABILITADO_PARA`, lib/veto-claude.ts). Sumar
  algo lo decide Martín.
- **El histórico (Meta, Fathom, YouTube, Panda) arranca al CONECTAR la integración**, por cualquier puerta
  (`arrancarHistoricoEnSegundoPlano(ws, servicio)`, lib/onboarding-extract.ts), y lo corre el cron de cada 15
  minutos, que recorre a quien tenga cualquiera de las cuatro. Antes lo arrancaba sólo el wizard.
- **Toda escritura del estado lee estricto** (`getEstadoOnboardingEstricto`): la tolerante, con la base caída,
  reabría onboardings terminados.
- Las trampas y lo medido, en `docs/hallazgos-onboarding.md` → «Si el onboarding deja de ser el wizard».
  Tests: `historico-al-conectar`, `onboarding-escritura-estricta`, `veto-claude-credito-plataforma`.
- **Queda abierto:** los comentarios de otras áreas que nombran al wizard como vivo (lib/capas.ts,
  lib/paises.ts, app/onboarding/FaseUI.tsx, OnboardingForm.tsx, app/automations/*) son historia y no
  rompen nada. Y la ruta /api/onboarding/extraccion queda sin llamadores en la app: sirve para pedir un
  `tick` o un `retry` a mano.

---

<sub>Escrito el 10/10/2026 por el chat «Onboarding» (cuenta claude3), sobre lo que hizo ese
mismo chat. Es el primer briefing de esta área: no había ninguno, y no hubo un chat
«Onboarding» desde el 05/09 (el del prototipo conversacional). Cubre hasta el commit
`dae23ffa` (10/10/2026 21:43).</sub>

## Qué es esta parte del producto

Dos cosas distintas que se llaman igual:

- **El wizard del cliente nuevo** (`/onboarding`, `app/onboarding/OnboardingWizard.tsx`). El
  alta deja al workspace en `pending` y `guardOnboarding` lo manda acá antes que a cualquier
  tab. Los pasos los elige la capa (`lib/capas.ts`): en `completo` y `agencia` son seis —
  fase, llave de IA (`gemini`), Archivero, productos, teléfono (`tabs`) y Meta
  (`integraciones`)—. Los dos últimos se pueden dejar para después (`PASOS_POSTERGABLES`).
  Al terminar, MaKo escribe el plan del cliente (`/api/onboarding/plan-arranque`,
  `lib/todo-seed-ia.ts`) y lo deja como borrador.
- **El onboarding de cada tab** (`lib/tab-onboarding-catalogo.ts`, estado en
  `lib/tab-onboarding-state.ts`). Regla de agosto: toda tab tiene uno. Dos excepciones
  decididas por Martín: Automations (ex /chatbot) entra por su estado vacío, el QR de
  WhatsApp si no hay línea (05/10), y el CRM entra directo, sin panel (08/10).

Para probar se usa el **Cliente de Prueba (ws3)**: está sin empezar (sin fila de
`onboarding.state`). Nunca ws1, que es Mauricio, un cliente.

## Qué se hizo en esta ventana

Martín pidió revisar el proyecto «Feature: Onboarding» del tablero con el criterio de la
casa, repriorizar o borrar lo innecesario, y dejarlo en Runway. Se aplicó en el tablero
(ws9) y está a la vista en **/admin/runway#onboarding**:

| | Tareas |
|---|---|
| **Se quedan** (etapa 3, que vencía el 9/10) | #734 la cuota de Gemini frena el arranque · #171 el histórico de leads de Meta nunca llega · #737 el video tutorial · #801 el onboarding del Ads Manager · #201 Instagram figura «leída» vacía |
| **Se posponen** (abajo, en A FUTURO) | #614 #652 #607 #608 (eran para la versión gratis) · #532 #164 #699 #214 #213 #743 |
| **Se cerraron**, con la prueba en el historial | #372 #309 #706 #707 |
| **Se borró** | #625 (reiniciar el onboarding de Leila: se prueba en ws3) |

El respaldo de las 20 filas y del proyecto, tomado antes de escribir:
`dashboard-marketing-main/backups/onboarding-depuracion-2026-10-10.json` (fuera del repo).
El detalle del proyecto se reescribió: su «Qué falta» nombraba tarjetas que ya eran del CRM.

## Lo que quedó a medias, y dónde vive

- **Las cinco que se quedan están sin empezar y sin fecha.** Por dónde arrancar:
  - **#171 es una línea**: `lib/onboarding-extract.ts:67` lee `getSetting('meta_page_id')`,
    que no escribe nadie. Va `credWs('META_PAGE_ID')` con el mismo respaldo fail-closed de
    `lib/meta-leads.ts`.
  - **#734**: la red de plataforma (`provsGratisDePlataforma`) no la usa ningún camino del
    arranque. El Archivero lee con `leerDocumentoIA` y los productos con `chatCheapCascade`
    sobre `CASCADA_DOCS`, sólo con las keys del cliente. Y `app/onboarding/ProductosView.tsx:242`
    pinta el error sin el botón para sumar otra key (la pieza `ErrorIA` ya existe).
  - **#801**: el Ads Manager no tiene entrada ni en `lib/tab-onboarding-catalogo.ts` ni en
    `lib/tab-activacion.ts`. El Offer Analyst ya no va: P2 se eliminó el 03/10.
  - **#201**: `app/api/onboarding/archivero/route.ts` no tiene guarda de host para Instagram,
    y cuenta como «leída» una web de la que no sacó ningún campo.
  - **#737** no es código: lo graba Martín.
- **Las prioridades nuevas pueden deshacerse solas**: la re-priorización del navegador
  (`applyGuardian`) pisa `score` y `score_base` de todas las abiertas cuando alguien crea,
  borra o completa una tarjeta con /plan abierto. Así se deshizo la depuración del 25/09.
  Detalle en `docs/hallazgos-plan.md`, la entrada del 10/10.

## Lo que espera una decisión de Martín

1. **¿Las fijo a mano?** La regla de la casa es que `score_manual` lo pone una persona. Si
   Martín quiere que esta depuración no se mueva, es suya la decisión. (Y ojo: por lo que se
   lee en el código, `applyGuardian` tampoco respeta las fijadas; no se midió en el navegador.)
2. **Las fechas de las cinco que quedan.** Propuesta: #734 y #171 primero.

## Ventana del 13/10: el prototipo conversacional, ahora contra el flujo real

<sub>Agregado por el chat de Claude Design (cuenta claude2). No toca producción: todo vive en
el canvas publicado y en el scratchpad. Cambia lo que el área SABE, no lo que corre.</sub>

El prototipo del onboarding-como-chat (el que menciona el encabezado, del 05/09) se retomó y
pasó de **5 turnos a 28**, escritos esta vez **leyendo el wizard**, no de memoria: las 6
preguntas del quiz más la de canal que cambia el enunciado y los tramos de la siguiente, la
devolución del diagnóstico en cuatro turnos, el paso de la llave de IA, el Archivero con su
espera y su devolución documento por documento, las preguntas de los huecos, el catálogo, el
email + WhatsApp + código, y la cascada de Meta.

Lo que el prototipo aporta como DECISIÓN de producto, y que `docs/onboarding-nuevo.md` no
tenía resuelto:

- **El orden es una afirmación.** El paso que muestra lo leído de Meta iba ANTES de conectar
  Meta. Se reordenó, y saltear Meta ahora saltea también la pantalla que la enseña: el mapa
  queda con 14 piezas de 16 y la consecuencia se ve.
- **La espera es un turno, no un spinner.** «Estoy leyendo tus documentos» merece pantalla.
- **Un turno que depende de algo que no pasó no se muestra vacío: no se muestra.**

Dónde está: `https://claude.ai/code/artifact/6d5c12ad-f582-4e80-be3b-0eb1a89c3231`. El
generador y las pruebas, en el scratchpad de esa sesión (`scratchpad/dc/`): `build-main.mjs`
construye el componente, `probar-orden.mjs` comprueba que ningún paso muestre un dato que no
se consiguió, y `probar-grafo.mjs` que ningún nodo del mapa nazca de un padre apagado en
ninguna de las 16 ramas. **Si el prototipo se retoma, esos tres archivos valen más que el
HTML**: el HTML es generado.

### Lo que esto encontró del wizard REAL

- **El checklist «Qué hacer ahora» del diagnóstico no se guarda.** `app/onboarding/FaseUI.tsx:121`
  es `useState<Set<number>>` local: se tilda, se dibuja (`:191`) y se pierde al recargar. No hay
  ningún endpoint ni setting que lo reciba. El usuario marca lo que ya hizo y MaKo no se entera.
- **La pregunta de canal se puede pasar sin tocarla y queda `llamadas` por default**
  (`OnboardingWizard.tsx:629` la excluye de `esFaseQuiz` a propósito, y el default viene
  marcado). Eso define el enunciado y los tramos de la pregunta siguiente **y siembra la
  plantilla de funnel de ese canal**. La exclusión es deliberada y está comentada; que el
  efecto lateral corra con un default sin tocar es lo que no está decidido.

⚠️ **Y una advertencia sobre auditar producción con agentes.** De tres cosas que la corrida
marcó como defecto del wizard, **dos eran decisiones deliberadas ya comentadas en el código**
(el `FasePanel` que no se dibuja lo explica `OnboardingWizard.tsx:792`, y la exclusión del
canal, `:429`). Se verificaron una por una antes de escribir acá; sin ese paso, dos
«hallazgos» hubieran mandado a alguien a deshacer algo que estaba decidido.

## Ventana del 13/10 a la noche: tres de las cinco ALTA, cerradas

<sub>Mismo chat que la sección de arriba (cuenta claude2), ya sobre producción. La tanda se
cortó a pedido de Martín (~20:00) para liberar RAM: lo que quedó a medias está nombrado abajo
con su archivo.</sub>

| Tarea | Estado | Commit |
|---|---|---|
| **#171** el histórico de leads de Meta no llegaba nunca | cerrada, con guard probado rompiéndolo (5 roturas, 5 cazadas) y la suite entera en verde | `4da4b720` |
| **#201** Instagram figuraba «leída» vacía | cerrada, con guard probado rompiéndolo (7 de 7) | `3ea8f2bf` |
| **#734** la cuota de Gemini frenaba el arranque | código cerrado; **test probado rompiéndolo el 15/10** (7 de 7, ver abajo) | `26b8eabe` · `fa6a2ac3` |
| **#801** el Ads Manager sin onboarding | sin empezar | — |
| **#737** el video tutorial | no es código: lo graba Martín | — |

### #171 — dos fuentes de verdad que no se hablaban

`jobAplica` leía la setting `meta_page_id` (minúscula, que nadie escribe desde que el page id
vive como credencial) y `pollMetaLeads` la credencial `META_PAGE_ID`. El job quedaba `skipped`
con «Falta token de página o ID de página» en un workspace donde la ingesta andaba perfecto:
sin error, con el paso en verde, y el CRM del cliente nuevo vacío. Ahora la pregunta se
contesta UNA vez, en `credencialesDeLeads()` (`lib/meta-leads.ts`), y la llaman los dos. De
paso se cerró la segunda divergencia del mismo gate: pedía el token a secas y el ingestor
además rechaza un `PENDING…`.

### #201 — una web pegada sólo cuenta si se aprendió algo

Las tres preguntas viven en `lib/archivero-webs.ts` (sin `server-only`, para que los tests las
ejecuten) y las usa `app/api/onboarding/archivero/route.ts`. **Medido con nuestro propio
User-Agent**: instagram 991 caracteres de muro, facebook **4**, tiktok 14, x 1.385 — y
**linkedin 13.159 de contenido real**, así que LinkedIn no entra en ninguna lista por
parecerse a las otras. El defecto era más grande que Instagram: una página de cuatro
caracteres pasaba el `!texto.trim()` y se guardaba como documento leído, y ese texto le daba
de comer al panorama, que es el perfil del negocio.

### #734 — verificada el 15/10

El código está: la red de plataforma llega a `chatCheapCascade` y al camino de VISIÓN
(`leerDocumentoIA`), encendida en los 11 puntos del arranque, con los errores de nuestras keys
en lista aparte y `chatCheap` aceptando `wsKey`. `npx tsc --noEmit` devolvió cero errores.

**El 15/10 (chat «Onboarding», claude3) se corrieron la base y las siete roturas**, restaurando
de memoria: base 8/0, y seis de las siete caían 7/1 de entrada. La séptima —«`chatCheap` deja de
pasar `wsKey`», o sea la red reintentando con la key del cliente— daba **8/0**: el assert leía
`lib/ai-cheap.ts` entero y la misma línea vive en `chatCheapTools`. Ahora mira el cuerpo de
`chatCheap` y cae 7/1. Commit `fa6a2ac3`, en la rama `onboarding-734-verificacion` (la sube el
coordinador). Los números quedaron en el encabezado del test.

### Lo que sigue sin hacer, con su archivo

- **#801**: el Ads Manager no tiene entrada ni en `lib/tab-onboarding-catalogo.ts` ni en
  `lib/tab-activacion.ts`. Sin empezar.
- **El checklist «Qué hacer ahora» no se guarda**: `app/onboarding/FaseUI.tsx:121` sigue siendo
  un `useState` local. Es el defecto real que encontró el prototipo y NO se tocó.
- **Una decisión de Martín**: la pregunta de canal avanza con su default marcado
  (`OnboardingWizard.tsx:632`) y ese valor siembra la plantilla de funnel del canal. ¿Se exige
  elegir, o queda el default?
- **`lib/entregable.ts`** quedó sin red de plataforma a propósito: no es del arranque.

## Ventana del 15/10 a la noche: el arranque sin API

<sub>Chat «Onboarding», cuenta claude3, por pedido del coordinador sobre la decisión de Martín en la
Ticketera (`clientes-usan-su-claude`, opción A). Commit `7f0ced90f`.</sub>

- **El paso de la IA del wizard es OPCIONAL** («Tu propia IA (opcional)»). Ya no frena: lo que viene
  después en las dos capas que lo tienen (El Archivero, Productos y el plan de arranque) corre con la
  red de la plataforma. El plan de arranque (`lib/todo-seed-ia.ts`) no la tenía y se le sumó. Lo fija
  `tests/onboarding-sin-api.test.ts` (6 roturas, 6 cazadas).
- **La guía del crédito de Claude Max** vive en la ficha de Anthropic (`lib/metodo-catalogo.ts`, el
  tutorial del servicio y el «?» del campo), y el paso del wizard abre ese modal ahí mismo.
- **La clave de Anthropic del negocio ya mueve sus funciones de texto** (16/10, commit `a488757c`): el
  coordinador contestó que la decisión A de Martín ya lo cubría. Es la segunda puerta del veto
  (`lib/veto-claude.ts`), nunca con una clave de la plataforma ni en el Plan; el detalle, en
  `docs/hallazgos-ia.md`.
- **16/10: El Archivero cortaba a los clientes sin keys** antes de la red (tres `docsIADisponible()`), y
  con el paso de la IA opcional ya en main, un cliente sin keys se trababa ahí. Arreglado (`daebfcc89`, y
  sólo el arreglo en la rama `onboarding-archivero-fix`).
- **16/10: la red se extendió a la primera semana** de un cliente sin API: Ads Writer, Offer, crear landing,
  crear automatización y buscar en el Second Brain (`tests/red-primera-semana.test.ts`). La capacidad y el
  porqué, en `docs/hallazgos-ia.md`.
- **Lo que NO está hecho y no es mío decidir** (se lo pasé al coordinador):
  - el análisis del lead: manda datos personales de los leads por las keys de la agencia, y no se sabe
    si están en el plan gratis de Google (que entrena). Es una decisión de privacidad de Martín;
  - el resto de las llamadas sin red, en el orden que diga el coordinador sobre `docs/mapa-ia-24h.md`;
  - sin mirar en el navegador: no se levantó la app (RAM). Falta ver el paso en escritorio y celular
    cuando esté desplegado.

## Dónde leer más

- `docs/hallazgos-onboarding.md`: la última entrada (10/10) y, antes, las del 05 y 06/10
  (Automations y «Tu forma de escribir»).
- `docs/onboarding-nuevo.md`: la propuesta de rediseño (el mapa, la promesa, el revelado).
  De sus fases sólo se hizo la salida de Meta (16/08); el resto quedó atado a la versión
  gratis, igual que las cuatro tarjetas pospuestas.
- En la memoria: `regla-onboarding-por-tab`, `onboarding-cliente-wizard`,
  `plan-arranque-generado` y `personalidad-quiz`.
