# Onboarding: el arranque del cliente nuevo y el onboarding de cada tab

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

## Dónde leer más

- `docs/hallazgos-onboarding.md`: la última entrada (10/10) y, antes, las del 05 y 06/10
  (Automations y «Tu forma de escribir»).
- `docs/onboarding-nuevo.md`: la propuesta de rediseño (el mapa, la promesa, el revelado).
  De sus fases sólo se hizo la salida de Meta (16/08); el resto quedó atado a la versión
  gratis, igual que las cuatro tarjetas pospuestas.
- En la memoria: `regla-onboarding-por-tab`, `onboarding-cliente-wizard`,
  `plan-arranque-generado` y `personalidad-quiz`.
