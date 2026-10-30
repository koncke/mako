# Create: un solo diseño para todas las tabs (29/10/2026)

**El pedido** (Martín, 29/10/2026, textual en lo central): «para todas las secciones de "create" no quiero otras tabs...
Revisa que en las secciones de CREATE hay muchas cosas mal... Y que podríamos deprecar completamente... No quiero "paja",
prefiero deprecar antes que conservar. Por ejemplo en editor, hay una tab de "Reels" que literalmente es de guiones... En
todo caso estará en "Copywriting" pero no como tab, sino como template... Quiero que en las tabs de Editor e Image, pongas
los colores de MaKo... En todas las tabs el mismo diseño de la barra lateral del chat de MaKo SIEMPRE abierto a la
izquierda, y que los diferentes proyectos sean todos como en "Web generator"... con la flecha para ver a todos y que se pueda
crear una nueva... En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear hoy?».

## La pantalla: `app/_crear/PantallaCrear.tsx`

Es la tarjeta izquierda del Web Generator (`app/web-generator/editor/EditorLanding.tsx`, `.gma-izq`) sacada a una pieza.

| Lugar | Qué hay |
|---|---|
| Tarjeta izquierda (flota, 340 px, **no se cierra**) | El chat de MaKo: la conversación «Cerebro» (`ConversacionCerebro`, `app/_chat/MakoEnLaTab.tsx`, la misma del Ops Center). Una tab con un chat que edita lo abierto lo pasa en `chat` (el Video Editor, el Image Editor). |
| La «←» del chat | Da vuelta la tarjeta a la LISTA, sin navegar: buscar, la estrella para volver, «Nuevo …» primero, los proyectos con su «⋯» (`menu`). |
| Centro | La pieza abierta (`children`) o «¿Qué vas a crear hoy?» (la caja `CajaPedido` de siempre) con las PLANTILLAS de la tab. Sin pieza abierta, la portada ES eso. «Nuevo …» la trae encima sin desmontar la pieza. |
| Teléfono (≤ 760 px) | Arriba el interruptor «MaKo \| <tab>»: se ve una columna por vez. |
| Barra de arriba | Nada: Create no tiene `secciones` en `nav.ts` (lo fija `tests/crear-pantalla.test.ts`). |

Lo escrito en la caja va al Cerebro (que crea y reparte) salvo que la tab lo tome (`onPedido`). Sin onboarding: la
plantilla es el arranque. Las reglas puras (buscar, qué ocupa el centro, el marco de una plantilla) en `app/_crear/reglas.ts`.

## Inventario (29/10/2026) y qué se hizo

| Tab (barra) | Tenía | Quedó |
|---|---|---|
| **Video** | 3 pestañas: Video Editor · Video Generator · Reels (super admin). Colores de CapCut, oscuro forzado. Chat a la derecha que se cerraba. | UN ítem (`video-editor`). Reels **retirada** (guion = plantilla del Copywriter). Video Generator: plantilla «Generar con IA» de «Nuevo video» (su ítem pasó a `SIN_FILA`: la key la usan la API, las creaciones y /m/video). Colores de MaKo. |
| **Image** | 4 pestañas: Image Editor · Image Generator («pronto») · Thumbnails («pronto») · Carousels. Colores de Canva. | UN ítem (`image-editor`). Image Generator y Thumbnails **retiradas** (nunca pasaron de «pronto»). Carousels **retirada**: «Carrusel de Instagram» es una plantilla de «Nuevo diseño». Colores de MaKo. |
| **Copywriting** | 6 pestañas: Ideas («pronto») · Ads Writer · YouTube Writer («pronto») · Stories · el método de redacción · las bibliotecas de guiones. Onboarding propio. **29/10/2026, Martín: sin ninguna mención** de esas dos últimas (redirigen a /copywriter; docs/diseno-copywriter.md, D15). | Lo hace el chat «Copywriter = Notion» (`/copywriter`, mila.gg + Notion): un ítem, Reels/Stories/YouTube como plantillas (`?nuevo=<tipo>`). Anotado en `FALTAN_SIN_SECCIONES`. |
| **AI Avatar** | 4 pestañas: Create video · Avatars · Voices · Templates (super admin). | Lo hace el chat «AI Avatar = Higgsfield» con esta pantalla. Anotado en `FALTAN_SIN_SECCIONES` y `PAGINAS_CREATE`. |
| **Offer** (Marketing, sumado el 29/10) | 3 pestañas (Offer · Strategy · Playbook, las dos últimas del super admin), un desplegable en árbol arriba (funnel → ofertas → conversaciones), el chat al medio y un riel de casillas «8/20». | UN ítem (`offer`). La tarjeta izquierda es SU chat; la «←» lista las conversaciones; «Nueva oferta» trae una plantilla por funnel (crear) y por oferta (analizar); el centro es la oferta ARMÁNDOSE (`DocumentoVivo`), sin «falta». Strategy y Playbook, al pie de la lista para el super admin. El onboarding (el mismo OfferApp en `arranque`) no cambia. |

Rutas retiradas (AGENTS.md, «Retirar una RUTA…»: se redirigen, no se borran, porque alguien de afuera las pudo guardar):

| Ruta | Va a | Por qué ahí |
|---|---|---|
| `/reels`, `/m/reels` | `/copywriter?nuevo=reel` | El guion de un reel es la plantilla Reel del Copywriter. ⚠️ Depende de la rama del Copywriter. |
| `/carousels`, `/m/carousels` | `/image-editor`, `/m/image-editor` | La portada de Image ES «¿Qué vas a crear hoy?» con «Carrusel de Instagram». |
| `/image-generator`, `/thumbnails` | `/image-editor` | Nunca tuvieron backend. |

El motor que escribía Reels y Carousels (`lib/ig-writer.ts`) sigue: lo usa la API de MaKo.

## Lo que queda (con dónde vive)

- Image: lo está terminando su agente en esta misma rama (`app/image-editor/**`): colores de MaKo y la pantalla única.

- Copywriting y AI Avatar sin pestañas y con `PantallaCrear`: los chats dueños (`tests/crear-pantalla.test.ts` falla cuando
  terminen y no se borren de la lista).
- Stories, Ideas y YouTube Writer: del chat del Copywriter (proponer el mismo retiro que Reels).
- Capturas de producción antes/después con Claude in Chrome: el 29/10 la extensión no estaba conectada.
