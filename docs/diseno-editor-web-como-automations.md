# El editor web como Automations, una sola barra, y el relevo del chat unificado (PLAN, 24/10/2026)

> Pedidos de Martín del 24/10/2026, por el Cerebro, textuales:
> 1. «Hay muchas cosas mal en el editor web... Primero que los botones se superponen como ves en la captura... Luego, 2
>    veces el titulo, no tiene sentido» (hola-mako.com/web-generator/32: el tooltip «Opciones · arrastra para reordenar las
>    secciones» tapa los controles de la izquierda del bloque; el título sale en la barra y en la cabecera del chat).
> 2. «Que sea el mismo sistema de "Automations" con el chat flotando y con la flecha para atras para ver las otras landing...
>    Pero que no me redirija, que solo se vaya para atras la sidebar del chat, tal cual como en Automations, para elegir
>    otra... Ese "panel" principal, solo sale si un usuario no ha creado nunca ninguna landing».
> 3. «Hay 2 topbar de edición, debería haber solo 1... La barra de "Guardado, compartir, publicar, y los 3 puntitos" deberían
>    estar todo en una sola barra, fijate como en diseño que entre todo bien, por ejemplo pienso que "Compartir y exportar"
>    podrían ser el mismo botón, pero fijate como lo hacen otras apps».
> 4. «si le doy a "Nueva landing" cuando le doy atras en la sidebar del chat de MaKo, ahí si salta el "¿Qué vas a crear
>    hoy?" con las plantillas».
> 5. «no pusiste en todos lados las funcionalidades que tenemos en el chat de MaKo, haz un relevo para UNIFICAR todo, por
>    ejemplo, en Automations o Web Generator, si le doy click derecho, no hace nada... Y ya de por si, en el lienzo de Web
>    tambien debería funcionar el click derecho, como en otros editores».
>
> Chat «Landings de MaKo en Web Generator» (claude1). El estado de cada punto, al pie.

## El molde: Automations, medido en producción (24/10/2026)

Una sola TARJETA flotante a la izquierda (borde redondeado, sombra, sobre el fondo del lienzo) con dos vistas:
- **la lista**: buscar, «Nueva automatización» como primer renglón, los ítems, y la criatura de MaKo arriba a la derecha que
  abre el chat;
- **el chat**: cabecera «← · MaKo · en línea» (la `←` vuelve a la lista SIN navegar: `antes` de `CabeceraDeChat`,
  app/admin/operaciones/PanelChat.tsx), el hilo, Discutir/Editar y la caja.

Arriba del lienzo, píldoras flotantes (el título, ajustes, Métricas; a la derecha Probar); abajo a la derecha, Activar y
Publicar. No hay una barra de ancho completo.

## Lo que se decide para el editor web

- **La tarjeta izquierda es UNA, con dos vistas:** el chat de MaKo y la lista de landings. La `←` de la cabecera del chat
  pasa a la lista (no navega); un renglón abre esa landing; la criatura vuelve al chat. Reemplaza a la «casa» de la cabecera
  del chat y a la de la barra, que llevaban al Panel.
- **El título de la landing sale UNA vez:** en la barra. La cabecera del chat dice «MaKo», como en Automations.
- **«Nueva landing»** (primer renglón de la lista) abre el Panel con el cuadro «¿Qué vas a crear hoy?» y sus plantillas.
- **El Panel deja de ser la entrada:** `/web-generator` sin nada en la URL lleva a la última landing si el negocio tiene
  alguna; el Panel sale si no tiene ninguna, o con `?panel=1` / un pedido en la URL (crear, analizar, diagnóstico). La lista
  de la tarjeta trae al pie «Ver todo en el Panel»: el Diagnóstico, Analizar y Replicar siguen a un clic.
- **Una sola barra:** la de herramientas absorbe la de arriba. Izquierda: el título y el guardado; al medio, las
  herramientas (deshacer, agregar bloque, animar, el formato); a la derecha, los dispositivos, **Compartir**, Publicar ▾ y ⋯.
  Se van la casa y el avatar (la app ya tiene el suyo en la barra lateral).
- **Compartir y Exportar, un solo botón**, como lo hacen Gamma (Share → pestaña Export), Canva (Compartir → Descargar) y
  Google Docs: el diálogo de Compartir suma «Exportar» adentro; el ⋯ lo sigue teniendo.
- **Los tooltips de la columna del bloque** (agarre, editar con IA, notas) pasan del `title` nativo —que sale abajo del cursor
  y tapa los botones de abajo— al tooltip de la casa (`gma-tip`) hacia la izquierda.

## 5. El relevo del chat: qué tiene el del Ops Center que los embebidos NO

**La causa del «clic derecho no hace nada», medida en el código:** el menú del mensaje vive en `MensajeWA`
(app/admin/operaciones/MensajeWA.tsx), que se activa con `ContextoWA`. Lo proveen sólo la conversación del Ops Center
(app/admin/operaciones/Conversacion.tsx:249), la del teléfono (app/m/operaciones/ChatsMovil.tsx:463) y el Second Brain en
algunos casos (app/second-brain/PiezasCliente.tsx:88). Los chats embebidos dibujan con `HiloMako` (app/_chat/HiloMako.tsx), que
importa de MensajeWA sólo la cita y las marcas: **ningún embebido tiene el menú.**

Lo que tiene el del Ops Center (lib/centro-mensajes.ts → `opcionesDelMensaje`): clic derecho y mantener apretado (en el
teléfono, la hoja de WhatsApp); la fila de reacciones; Responder (con la cita en la caja, `CitaCaja`, y deslizar para
responder); Reenviar a otro chat; Copiar; Info; Destacar; Fijar (con `BarraFijados`); Eliminar para mí.

Los embebidos, uno por uno (todos con `HiloMako`): Automations (app/automations/ChatMakoVista.tsx), Web Generator
(app/web-generator/editor/paneles/ChatAgente.tsx), Offer (app/offer/ChatOffer.tsx), Dashboard
(app/dashboard/PanelEditarMako.tsx), Image Editor (app/image-editor/mako/chat/PanelMakoIA.tsx), Video Editor
(app/video-editor/_opencut/chat/PanelChat.tsx), la ficha del lead (app/crm/lead-view/MakoAnalystLead.tsx), Second Brain
(app/second-brain/ChatDelSecondBrain.tsx y PiezasCliente.tsx) y Soporte (app/tickets/soporte/PiezasSoporte.tsx).

**El plan para unificar:** `HiloMako` acepta un `ContextoWA` opcional y, si no se lo dan, provee uno MÍNIMO —Copiar y
Responder (la cita a la caja de ese chat)—, que es lo que tiene sentido en un chat con MaKo; Reenviar, Fijar, Destacar y las
reacciones necesitan donde guardarse y quedan para los chats que tienen conversación guardada (Ops Center, Second Brain).
Así el clic derecho anda en los 11 de una vez, sin tocar cada pantalla. ⚠️ Ojo (lo avisó Automations): el lienzo de al lado
tiene su propio menú contextual (app/_components/Lienzo.tsx, app/automations/FlujoLienzo.tsx) y los eventos de React suben
por los portales: el menú del mensaje frena la propagación (docs/hallazgos-chatbot.md, «Métricas con UNA barra»).

**El clic derecho en el lienzo del editor web:** como Gamma y Canva, sobre una sección abre las acciones que hoy están en su
menú de ⋯ (duplicar, mover arriba/abajo, ocultar, borrar, editar con IA), con `MenuContextual` (app/_ui/MenuContextual.tsx),
el de la casa. Las opciones las arma una función pura con test, como `opcionesCrm`.

## Estado (24/10/2026)

| Punto | Estado |
|---|---|
| 403 en Offer, Diagnóstico y Replicar (lib/landing-fetch.ts) | **hecho**, c3af56f7b |
| 1. Tooltips de la columna del bloque | ver el commit de esta tanda |
| 1. El título dos veces | ver el commit de esta tanda |
| 2. La tarjeta lista ↔ chat, el Panel sólo sin landings | ver el commit de esta tanda |
| 3. Una sola barra, Compartir con Exportar | ver el commit de esta tanda |
| 4. «Nueva landing» abre las plantillas | ver el commit de esta tanda |
| 5. El menú mínimo en `HiloMako` y el clic derecho del lienzo | **sin hacer**: el plan está arriba |
