# Diseño: los chats de MaKo en toda la app (plan para después del 20/10)

> **El pedido** (Martín, 17/10/2026 19:31, punto 5): «Todo estos chats, el diseño y la funcionalidad deberían estar en
> TODA la app donde haya instancias de MaKo, siempre este modelo de chats... que los chats también funcionen, porque
> algunos son de análisis y otros de edición, ya falló con Mauricio, al estar en VISTA del dashboard debería asesorar,
> no modificar el dashboard... Y todo siempre guardarse en chats en el Ops Center e ir guardándose en el grafo del
> Second Brain».

Este plan va ARRIBA de docs/diseno-mako-ai-native.md (la pieza única, el mapa tab por tab y el grafo como proyección)
y no lo repite: suma la regla de análisis/edición y dónde queda cada conversación. Sin implementar: sólo el arreglo del
Dashboard y General va en la rama de este plan (ver «La regla»), y el resto es para después del 20/10.

## La regla, que desde el 17/10 rige en el Dashboard y en General

**Un MaKo en vista asesora. Sólo edita quien está editando, y lo decide el SERVER.** No el prompt ni el botón. En el
Dashboard, la ruta `/api/graficos/editar` no arma cambios sin `modo: 'editar'`, `editando: true` y el id de esa hoja
(`permisoEdicionMako`, lib/graficos-ia-edicion.ts). Mirando, el botón de MaKo abre el AI Analyst. Cada chat de edición
de abajo se pasa a la MISMA forma: la ruta exige el modo y la entidad que se edita, y en modo «analizar» el turno corre
con las LECTURAS del registro de la API de MaKo, sin las acciones.

## Dónde está MaKo hoy

| Dónde (ruta) | Pieza | Tipo | Dónde guarda hoy |
|---|---|---|---|
| Dashboard y General (`/dashboard`, `/general`) | `PanelAnalista` (el informe, a la izquierda); el botón de cada gráfico pregunta a la ESTRELLA (`MakoEnLaTab`, hoja como entidad, «analizar»; 22/10, TB3) | análisis | el Cerebro de la persona (antes `chart_chats` `dashboard:<hoja>:<gráfico>`, que quedan como «de antes») |
| Dashboard y General, editando | `PanelEditarMako`, «Pídeselo» (`NuevaHoja`) | edición | `chart_chats` (`dashboard:<hoja>`, desde el 22/10 por /api/hilo-de-tab) |
| Ads Manager (`/ads-manager`) | `app/_components/ChartIA.tsx`, por entidad | análisis | `chart_chats` |
| Chats / WhatsApp (`/whatsapp`) | `WhatsAppAdvisor.tsx`, con la caja y el hilo únicos (22/10, TB3; no va a la estrella: su «Usar →» escribe en la caja de ESE lead) | análisis (redacta un borrador, no envía) | `chart_chats` (`wa-advisor:<grupo>`) |
| CRM (`/crm`) | `crm/mako-crm/ChatMakoCrm.tsx`, `MakoAnalystLead` | los dos (`turnoApp`, confirma en el chat) | `chart_chats` vía `turnoApp` |
| Second Brain (`/second-brain`, `/m/second-brain`, `/m/mako`) | `ChatSecondBrain.tsx`, `m/mako/ChatMako.tsx` | los dos (`turnoApp`) | `chart_chats` (`mako-movil:<persona>`) |
| Automations (`/automations`) | `automations/ChatMako.tsx`, `MakoRedacta`, `BarraPideselo` | edición | a medir |
| Offer y onboarding (`/offer`, `/onboarding`) | `ChatOffer.tsx`, `ChatArranque.tsx` (`lib/offer-ia.ts`) | análisis que crea la oferta y el PDF | `offer_sesiones` |
| Web Generator (`/web-generator`) | `PanelAgente` | edición | `chart_chats` (`landing:<id>`, desde el 22/10 por /api/hilo-de-tab) |
| Image Editor (`/image-editor`) | `image-editor/mako/chat/PanelMakoIA.tsx` | edición | `image_editor_chats` (medido el 22/10: guarda) |
| Video Editor (`/video-editor`) | `_opencut/chat` (`PanelChat`) | edición | `video_editor_chats` (medido el 22/10: guarda) |
| WhatsApp del grupo | el doer (`mako_doer_conv`) | los dos (propone, la persona confirma) | `mako_doer_conv` |
| Ops Center (`/admin/operaciones`, super admin) | la pieza de la que se copia todo | Claude Code | `lib/centro-mensajes-db.ts` |

«A medir» es eso: no se midió en este trabajo. Desde el 22/10/2026 (TB3) Editar con MaKo, el chat de gráficos con sesiones (`MakoChat`), el asesor, los dos editores y el agente del Web Generator usan `CajaChat` y `HiloMako`, cada uno con su motor.

## Cómo pasan todas al chat del Ops Center

1. **Una pieza**: `Conversacion.tsx` (caja y cabecera), `Hilo.tsx`, `Pregunta.tsx`, `Muneco.tsx`, `Microfono.tsx` y el
   riel de `Avance.tsx` («Lo que hizo»), de app/admin/operaciones. Lo que es sólo del super admin entra por slots
   (docs/diseno-mako-ai-native.md, sección a). El Dashboard ya usa el muñeco y el micrófono: falta el resto.
2. **Cada instancia declara su modo y su entidad**: `{ tab, entidad, modo: 'analizar' | 'editar' }`. En la cabecera va
   «Analizar · Editar» (`ModosMako.tsx`) SÓLO donde la pantalla tiene un estado de edición, y el modo lo pone la
   pantalla (vista → analizar), no la persona con un clic.
3. **El server lo cumple**: un helper común, la generalización de `permisoEdicionMako`, en la puerta de cada ruta de
   edición y en `turnoApp`, que en «analizar» filtra las acciones del registro.
4. **El orden**: primero los de edición que ya escriben (Web Generator, Automations, Image/Video Editor), porque ahí un
   análisis puede tocar algo del cliente. Después los de análisis, que sólo cambian de cara.

## Cada conversación queda en el Ops Center y en el grafo

- **Un almacén**: `chart_sessions`/`chart_chats`, con la clave `<tab>:<entidad>` (como `dashboard:<hoja>:<gráfico>`).
  Los que guardan en el navegador o en memoria (Editar con MaKo, Web Generator) pasan ahí. Los que tienen tabla propia
  (Offer, Image/Video Editor, el doer) NO se copian: los lee el índice (`lib/chat-mako-indice.ts`).
- **En el Ops Center**: la barra jefe › sub, con jefe = la tab y sub = la entidad. Sale del índice, no de una lista a mano.
- **En el grafo** (hecho el 23/10/2026): `lib/cerebro-chats.ts` le pasa a `construirCerebro` los chats de quien mira, con
  las MISMAS lecturas de la lista del Ops Center, y `lib/cerebro-chats-tabs.ts` les pone su tab y su entidad. Va un nodo por
  chat jefe (`tabchat:<tab>`, «MaKo en CRM»), nunca uno por charla, con una arista a cada entidad de sus charlas que esté en el
  mapa (el funnel de las del CRM, el cliente o los leads de una ficha); sin ninguna, a la raíz. Una hoja, una landing por id,
  una automatización y un diseño no son nodos del mapa. Nada se copia a markdown: el grafo es una proyección. Falta medirlo con
  `scripts/medir-grafo.mjs` en pantalla (docs/hallazgos-second-brain.md, 23/10).

## Lo que no se sabe todavía

- ~~Dónde guardan Automations y el asesor de WhatsApp, y si el Video Editor ya guarda.~~ Medido el 22/10: Automations en
  app_settings (`automatizacion.chat:<id>`, OC5), el asesor en chart_sessions (`wa-advisor:<grupo>`, sin origen en
  `origenDeClave`: no se agrupa en el Ops Center ni entra al grafo) y los dos editores en sus tablas (TB2).
- Si el teléfono (`/m/dashboard`) necesita el modo «editar», porque hoy no tiene el panel.

*17/10/2026, claude4 (agente del Cerebro, rama `dash-mako-vista-1710`).*
