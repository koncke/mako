# Lo que Martín pidió para el CRM, y su estado

**20/10/2026, ~19:45.** Estado medido sobre la rama `crm-ficha-v2` en `5cb1e334a`, con `origin/main` en `ff9cc4da7`.
Se armó leyendo `docs/feedback-16-10-crm-onboarding-second-brain.md`, `docs/feedback-18-10.md` (pts 8, 9 y 14),
`docs/feedback-20-10.md` (el pt 12 está en la copia de `C:/dev/wt-push-q`; la de este worktree llega hasta el pt 7), las memorias del CRM, `docs/relevo/crm.md` y los hitos de Martín y de Claude en
`app/admin/dev/crm/bitacora.ts`. Para cada pedido se buscó el síntoma en el código (`app/crm`, `app/m/crm`, `lib/`) y su
commit con `git log`; donde un relevo decía «hecho» y el código no lo mostraba, no cuenta como hecho. Las filas que sólo
se apoyan en el commit y la bitácora (lo anterior al 12/10) lo dicen: «según commit».

## En números

Cuento **pedidos**: cada número de las listas de Martín es uno (las filas que agrupan puntos dicen «N puntos»).

| | Hecho | Parcial | No hecho | Sin confirmar | Total |
|---|---|---|---|---|---|
| Del 13/10 al 20/10 (tablas A, B, C, D e I) | 80 | 7 | 8 | 0 | 95 |
| Hasta el 12/10 (tablas E, F, G y H) | 164 | 4 | 1 | 1 | 170 |
| **Todo** | **244** | **11** | **9** | **1** | **265** |

- **No hecho (9):** A1 (el chat con la pieza única del Ops Center), B1 (columnas editables del Plan), B2 (cinco cosas del
  prototipo de tarjetas), C1 (Google Calendar en «Asignar evento») y H1, que ya no aplica (Chatwoot se borró). O sea, 8
  que cuentan.
- **Parcial (11):** B3, B4, C2, C3, D2, D4, D5, E1, F1, F2 y H2.
- **Sin confirmar (1):** E2, el título «MaKo - CRM» de la pestaña (no se midió en un navegador).
- En filas: 69 Hecho, 11 Parcial, 5 No hecho y 1 Sin confirmar (86 filas).
- De los 5 puntos que Martín mandó hoy, 4 se cerraron hoy (A2, A3, A4 y A5) y el quinto (A6, la etapa de reunión con su
  evento) ya estaba hecho desde el 16/10. Lo que sigue abierto de hoy es A1 (la pieza única del chat); la otra mitad
  del pedido de las cards (D1: diseños, arrastrar y vista en vivo) se hizo esa misma noche.

## Por qué Martín dice «muchos cambios que te había pedido aún no están»

1. **Dos cosas estaban hechas y él no las veía, por fallas nuestras, no suyas.** Las **columnas** se «hicieron» el 18/10 con
   el color `--surface-2`, que en el tema claro es #F5F7FA sobre una página #F4F6F9: el mismo color, invisibles. Y el
   **chat con MaKo** existe desde el 14/10, pero su botón (a 88 px del borde) quedaba **debajo de la sidebar abierta**
   (244 px, z 60). El diagnóstico obvio («ya está hecho») era el equivocado. Las dos se corrigieron hoy (A2, A3).
2. **Lo que de verdad no está** es poco y está en la última sección: la pieza única del chat del Ops Center, las
   plantillas de diseño y el arrastre de campos de la tarjeta, Reuniones y Tracking
   por bloques, las sugerencias de las clases 2 y 4 y las plantillas que reemplazan al «CRM automático».
3. **Lo de hoy no está subido.** Los 5 commits del 20/10 (`dae7de4fc`, `10fc93059`, `44f14b087`, `88daad475`,
   `5cb1e334a`) están sólo en esta rama. Todo lo anterior está en `origin/main`; «desplegado» no se puede ver desde el
   repo, así que sólo lo afirmo cuando la bitácora dice «en producción (run N)». Nada de esto se miró en pantalla hoy.

## Cómo leer las tablas

- **Estado:** `Hecho` (el síntoma está en el código y hay commit) · `Parcial` (una parte sí, la otra se dice) ·
  `No hecho` · `Sin confirmar` (no lo pude comprobar en el código).
- Dentro de cada tabla van primero los `No hecho` y `Parcial`.
- Si el mismo pedido aparece en dos fuentes, hay una sola fila y se citan las dos.

---

## A. 20/10 — el punto 12 de `docs/feedback-20-10.md` (hito de las 19:11)

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| A1 | El chat del CRM con la pieza única del chat del Ops Center (20/10 pt 12 y la regla «un solo chat» del 18/10, pts 1, 5, 7, 11, 12 y 15) | No hecho | La pieza es `app/_chat/CajaChat.tsx` (`7237af372`) y vive en la rama `chat-unico`, sin mergear aquí | El chat del CRM sigue siendo `app/crm/mako-crm/ChatMakoCrm.tsx` (con `HiloMako` y su propia caja). Lo migra el chat Ops Center 3: «después, cada chat de área migra la suya». El AI Analyst de la ficha (`MakoAnalystLead.tsx`) está en el mismo caso. |
| A2 | «No veo el chat con MaKo que te había pedido» | Hecho | `44f14b087` (hoy, sin subir) · `app/crm/mako-crm/PanelMakoCrm.tsx`. Antes: `b04e3d1f` (14/10), `c52533e94` y `2eb7b00e3` y `8db1e3cbc` (16/10) | El panel está montado en `app/crm/page.tsx` (`<PanelMakoCrm />`) desde el 14/10 (en producción con la tanda A, `45fe2cb7f`). Con la sidebar abierta el botón quedaba debajo. Ahora es una barra fija a la derecha: abre sola en pantalla ancha, recuerda si la plegaste y, plegada, es una pestaña en el borde derecho. Cambia de lado respecto del 16/10: ver C4. No visto en pantalla. |
| A3 | «Muchos cambios… aún no están, como que las columnas no sean invisibles» (también 18/10 pt 8: «la columna con su bloque de fondo») | Hecho | `dae7de4fc` (hoy, sin subir) · `lib/tarjeta-kanban.ts` (`FONDO_COLUMNA`), `app/globals.css` (`--fondo-columna`), `app/m/m.css`, `app/customer-success/KanbanEntrega.tsx` | Hecho pero Martín dice que no se ve (20/10): el 18/10 (`772ed2a14`, en producción run 144) la columna quedó en `--surface-2`, el color de la página. Hoy tiene su tono propio en claro y oscuro, en CRM, Clients, Plan y teléfono; el test mezcla la columna con la página y exige que se separe (con el color de antes daba «se separa 1,7»). No visto en pantalla. |
| A4 | «Las cards, las debería poder personalizar también, por si el usuario quiere más o menos info» | Hecho | `88daad475` y `5cb1e334a` (hoy, sin subir) · `app/crm/CamposTarjetaModal.tsx`, `lib/tarjeta-kanban.ts` (`CAMPOS_TARJETA_LEAD`), `app/crm/tarjeta-campos-actions.ts` | En el «⋯» → «Personalizar tarjetas»: una casilla por dato y «Más info» (empresa, teléfono, campaña, fecha de alta). Se guarda por persona, no por funnel. El teléfono sólo sigue foto, plata y canal. La otra mitad del pedido del 13/10 (plantillas de diseño y arrastrar campos) sigue abierta: D1. |
| A5 | «Los botones de "Tablero y lista" solo con íconos debería estar» | Hecho | `10fc93059` (hoy, sin subir) · `app/crm/CrmToolbar.tsx` (`VistaSelector`) | El nombre queda en el tooltip y en el `aria-label`. Test `tests/crm-vista-iconos.test.ts`. |
| A6 | «El tema de asignar en una etapa de reunión y vincularla a un evento de Calendar, Calendly o Cal, ¿está eso?» (también 13/10 y 16/10 04:31) | Hecho | `c7f7b5609` (16/10) · `app/crm/EventosDeEtapaModal.tsx`; el motor, `27800220e` (mig 0293) | Sí está, desde el 16/10: en el «⋯» de la columna → «Asignar evento», **sólo en las etapas de tipo Reunión** (`c.kind === 'reunion'` en `CrmBoard.tsx`), con Calendly y Cal.com. Google Calendar no (C1). Nadie lo probó con un Calendly real. |

## B. 18/10 y 17/10 — tarjetas, Clients y Plan (`docs/feedback-18-10.md` pts 8, 9 y 14)

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| B1 | Plan: «columnas editables como en el CRM» (18/10 pt 9) | No hecho | `app/plan/board/BoardShell.tsx` (no hay renombrar ni editar columna) | El registro del 18/10 lo dejó «después del 20/10». |
| B2 | Lo del prototipo de tarjetas que no entró (17/10 22:40, pt 8): «Pago fallido» en la tarjeta de un cliente, la foto de Instagram, la vista «Prioridades» del Plan, el tablero de Proyectos del teléfono y la foto del cliente en el teléfono (5 puntos) | No hecho | `app/customer-success/aviso-tarjeta.ts:10` (verificado: «Pago fallido» no está); el resto, según `docs/relevo/crm.md` §0-Ω15 | Prototipo `docs/prototipos/coherencia-1710.html`. El cobro no viaja al tablero; la foto de Instagram no se guarda. |
| B3 | Clients: «el desplegable dice "VSL Funnel" con el nombre viejo» (18/10 pt 14) | Parcial | `44b4b111b` quitó el desplegable · `productosDeLaEntrega` en `app/customer-success/entrega.ts` | El desplegable ya no está («Editar etapas» pasó al ⋯), pero el producto sigue guardado con el nombre viejo: no sigue al funnel renombrado. Crear un servicio nuevo ya no se puede desde Clients. |
| B4 | Plan: «el check gris a la derecha, al lado de la basura» (18/10 pt 9) | Parcial | `ad2bac4b6` (computadora) · `app/m/plan/ListaPlan.tsx` (teléfono) | En la computadora está. El Plan del teléfono sigue completando con el círculo; falta que Martín diga si también va el check. |
| B5 | Plan: la tarjeta «sin Prioridad, sin Origen y sin el aviso de falta deadline» (3 puntos) | Hecho | `ad2bac4b6` | En producción según la bitácora (run 144). |
| B6 | CRM: «"Próximo" plegado por defecto, se abre con el ícono del calendario en vez del pop-up» (18/10 pt 8) | Hecho | `772ed2a14` · `app/crm/CrmBoard.tsx` (`BotonReuniones`, «arranca PLEGADO») | En producción según la bitácora (run 144). |
| B7 | Clients: «las tarjetas, rotas», «sin el título "Clients"», «el fondo, el de MaKo, con cuadrícula» (18/10 pt 14, 3 puntos) | Hecho | `cd6a4e78b` y `75abd774b` (tarjeta con estilos), `44b4b111b` (título y fondo) | Era el «cliente roto». En producción según la bitácora (runs 137 a 144). |
| B8 | Una misma familia de tarjetas para CRM, Clients y Plan, en computadora y teléfono (17/10 22:40, pt 8) | Hecho | `de3be68bb` (CRM), `3b1f3a742` (CRM teléfono), `134cd221c` (Clients), `ffe362733` (Plan) · `lib/tarjeta-kanban.ts`, `app/_ui/TarjetaKanban.tsx` | En producción según la bitácora (runs 137 a 144). En el teléfono, tocar una tarjeta abre la ficha rápida («Ver info», «Mover a…»). |

## C. 16/10 — `docs/feedback-16-10-crm-onboarding-second-brain.md` (el número es el de Martín)

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| C1 | #3 Google Calendar, además de Calendly y Cal.com, en «Asignar evento» | No hecho | `app/crm/EventosDeEtapaModal.tsx:18`; `fda277870` deja dicho por qué | Lo decidió el chat, no Martín: la API de Google no lista las páginas de reserva ni dice de cuál viene una reserva. Martín escribió «Calendly o Cal o Calendar». |
| C2 | #3 «Que tenga la opción ahí mismo de crear un nuevo evento para asignarse a esa etapa» | Parcial | `c7f7b5609` | «Crear un evento en Calendly / Cal.com» abre su página en otra pestaña y «Actualizar» lo trae. Las APIs de Calendly y Cal.com no crean tipos de evento desde afuera. |
| C3 | #4 «Primero mejora la eficiencia al abrir el detail de un lead, tarda un montón» | Parcial | `f808b91d0` · `getLeadFullAction` en `app/crm/actions.ts` | Cinco lecturas pasaron a correr en paralelo (~1,3 s en local). Nunca se midió contra producción; si sigue lento, mirar `leerInsumosDatosLead`, `getTrackingEvents` y `replayDeLead`. |
| C4 | #8 «El botón de MaKo siempre a la izquierda, no a la derecha» | Hecho | `c52533e94` (16/10, izquierda) → `44f14b087` (20/10, derecha) | Lo pisó la regla del 18/10, más nueva y de Martín («Editar = el patrón de Web Generator: el chat con MaKo como barra fija a la derecha»), que el Cerebro aplicó al CRM el 20/10; a la izquierda, además, quedaba debajo de la sidebar. Si Martín lo quiere a la izquierda en el CRM, es cambiar el lado en `PanelMakoCrm.tsx` (la pestaña y la barra). El AI Analyst de la ficha sigue abriendo a la izquierda (`588c1ffec`). |
| C5 | #8 «En lugar de la estrella de MaKo, el muñequito de cada tab» y el chat «con la cara del Second Brain» (2 puntos) | Hecho | `2eb7b00e3` (muñeco), `8db1e3cbc` (hilo y caja con micrófono que dicta) · `ChatMakoCrm.tsx`, `app/_chat/HiloMako.tsx` | El muñeco ya está también en Automations, el Dashboard y el Second Brain; las demás tabs son de sus chats. La caja única del Ops Center: A1. |
| C6 | #1 Renombrar un CRM: «lo que cambio se queda» | Hecho | `4e9411a71` · `embudoEnDetalleAction` en `app/crm/actions.ts` | `tests/crm-renombrar-16-10.test.ts`. |
| C7 | #2 El «⋯» de «Lead entrante» dice «Asignar campañas» con el logo de Meta | Hecho | `9f595cc6f` · `app/crm/CrmBoard.tsx` | |
| C8 | #4 «Elimina la opción de "Vista previa" y la de "Ahora no"» | Hecho | `f0c8f0da0` · `app/crm/lead-view/ficha/GaleriaTab.tsx` | |
| C9 | #4 La ficha en edición sin la sidebar: el Nombre en el título, «Templates», «Estilo de la hoja» como el del Dashboard (4 puntos) | Hecho | `6574b28b5`, `b1de6bcef`, `f0c8f0da0` · `ficha/EstiloDeLaHoja.tsx` | `PanelFicha.tsx` ya no existe. |
| C10 | #4 «Obligatorio» en cada bloque, en vez de la lista de interruptores | Hecho | `7ce7578ee` · `ficha/Armador.tsx` | Es el mismo `op: 'aviso'` de siempre, por funnel. |
| C11 | #4 «También en los otros lugares mejora ese desplegable de estilos, ya que quedó limitado» | Hecho | `98a4a19d2` (Dashboard), `4398b2078` (ficha) | Según commit; el Dashboard lo lleva su chat. |
| C12 | #5 Templates con miniaturas propias por tab y cambiar de hoja con el desplegable del título, como el Dashboard (2 puntos) | Hecho | `6574b28b5` · `LeadTabs.tsx`, `ficha/MiniaturaFicha.tsx`, `ficha/GaleriaTab.tsx` | En producción desde el run 86; mirado en el ws3 a 1440 y 1024. El desplegable es una copia de `MenuHojas` del Dashboard, no un import (unificarlo quedó anotado). |
| C13 | #6 El «Ver» de datos sin marcar de la ficha, con la fila de «A revisar» (ícono del bloque, basurero rojo, flecha azul) | Hecho | `7c0d07b9d` · `app/crm/lead-view/DatosSinMarcarCard.tsx` | |
| C14 | #6 «Elegir qué datos te avisa MaKo» abre un lead con «Datos sin marcar» abierto y el basurero pregunta «¿Ignorar siempre?» | Hecho | `0c51fcf1c`, `bdb403e7f` · `ficha/FichaDeEjemplo.tsx` | Con leads abre el primero de verdad; sin leads, uno de ejemplo. El modal de interruptores se borró. |
| C15 | #7 «Ver todos» pasa a «Ignorar todos», «Revisar» abre el «Ver» y se borra la vista `/crm?pendientes=1` (3 puntos) | Hecho | `9f595cc6f`, `f777d1d4f` · `app/_components/MakoConfirmGate.tsx` | |
| C16 | #9 Cabecera de la ficha: foto de 88, sin «Sin empresa ·», nombre pegado a la cara, y el desplegable alineado al nombre (2 puntos) | Hecho | `9f595cc6f`, `6574b28b5` · `app/crm/lead-view/CabeceraLead.tsx` | Mirado en el ws3 el 17/10. |
| C17 | #10 «Editar» en azul y un «⋯» con «AI Analyst» (panel a la izquierda que corre la ficha), sin «Personalizar» ni la pestaña «MaKo Analyst» (3 puntos) | Hecho | `8cd7447e6`, `588c1ffec` · `ficha/FichaPorBloques.tsx` | `?tab=insights` y «Ver análisis» abren el panel. |
| C18 | #10 En el «⋯»: exportar la hoja, compartir y el tutorial de cómo editar (3 puntos) | Hecho | `0e45837fd` («Exportar (CSV)»), `bdb403e7f` («Exportar (PDF)» y «Guía de edición»), `588c1ffec` («Copiar el link») | Los tres textos están en `FichaPorBloques.tsx`. |
| C19 | #10 «Al momento de EDITAR, también debería salir automáticamente este modal… para editar la vista» | Hecho | `bdb403e7f` | |
| C20 | Pedido aparte: la galería no se abre sola, y en los ws que ya tienen leads no sale el «¿Qué vas a crear hoy?» (2 puntos) | Hecho | `5863e9734` | |

## D. 13 y 14/10 — el feedback del detalle del lead (13/10 22:57) y el del 14/10 03:06

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| D1 | 13/10: «Personalizable la tarjeta del lead… varios diseños template… arrastrar campos, acomodarlos… en tiempo real» | Hecho | `88daad475` (elegir datos) y el commit de D1 del 20/10 noche · `app/crm/CamposTarjetaModal.tsx`, `lib/tarjeta-kanban.ts` (`DISENOS_TARJETA`, `prefsTarjetaDe`, `moverCampo`), `app/crm/CrmBoard.tsx` (`propsDeTarjeta`) | Tres diseños (Completa, Compacta y Con avance, la de Clients con la barra del paso); los datos se arrastran (y ↑ ↓) para acomodarlos; arriba del pop-up, la tarjeta de un lead del tablero en vivo, armada por la misma función que el tablero. Por persona. No visto en pantalla. |
| D2 | 14/10: Reuniones y Tracking «personalizables» bloque por bloque, como el Dashboard | Parcial | `app/crm/lead-view/ficha/registro-reuniones.tsx`, `registro-tracking.tsx` | Resumen y Pagos sí están partidos en bloques (D11, D14). Reuniones y Tracking son UN bloque cada una: la tarjeta vieja entera (`ReunionesCard`, `ComportamientoCard`). |
| D3 | 14/10: «implementa el click derecho en todo el CRM para diferentes acciones» | Hecho | `a3496cc3` (tablero y lista) y el commit de D3 del 20/10 noche (la ficha) · `app/_ui/MenuContextual.tsx`, `app/crm/menu-contextual-crm.ts`, `app/crm/lead-view/ficha/menu-contextual-ficha.ts` | En el tablero y la lista (tarjeta, fila, columna, fondo, selección) y en la ficha: las del «⋯» de la ficha más WhatsApp y copiar teléfono o email. Sobre un campo, un link o texto seleccionado queda el menú del navegador. No visto en pantalla. |
| D4 | 13/10 pts 2 y 3: sugerencias de MaKo «inteligentes y personalizadas», mapeando todas las que se te ocurran | Parcial | `b04e3d1f`, `b34838dd` · `lib/sugerencias-crm.ts`, `docs/sugerencias-mako-crm.md` | El mapa tiene cuatro clases de disparo. El motor cubre la 1 («armas el CRM») y la 3 («el tablero llega a un estado»). Faltan la 2 («repites un gesto»: 5 movimientos de A a B, el mismo mensaje a 3 leads) y la 4 («llega algo nuevo»: el primer lead de un formulario, el primer DM). No hay registro de que Martín validara el mapa. |
| D5 | 14/10: sacar el botón de «CRM Automático» y llevar lo que quedó pendiente a Automations como template | Parcial | `43a27b56` (botón fuera) · motor `lib/crm-auto.ts`, cron `/api/cron/crm-automatico` | El botón no está, pero el motor sigue corriendo (se apaga por negocio con `crm_auto_enabled`). La galería de Automations no tiene la etapa destino para mover (T2 y T6, según el relevo del 14/10): en `lib/plantillas-automatizaciones.ts` no hay una plantilla de «reactivación» por antigüedad, sólo `reactivar-sin-cierre`. |
| D6 | 13/10 pt 1: datos sin marcar con «Ver →», solucionar que lleva al dato (sin pop-up), ignorar, «Ver más» y elegir de qué avisa MaKo (5 puntos) | Hecho | `42e57a6c` (14/10, mig 0270), `7ce7578ee`, `0c51fcf1c` · `DatosSinMarcarCard.tsx` | |
| D7 | 13/10 pt 2: «A revisar» sólo con datos sin marcar, sin la «Mk» ni «MaKo movió 6 leads» (2 puntos) | Hecho | `0d07ddc8` | El motor que movía leads sigue vivo (D5). |
| D8 | 14/10: «A revisar» que se cierra al tocar otra cosa, una fila por lead con su número, la foto antes del nombre, revisar azul con flecha, ignorar con X y cerrar con X (6 puntos) | Hecho | `99e0a02b`, `b4db1eaa` | |
| D9 | 13/10 pt 4 y 14/10: ficha más compacta; etiquetas al lado del título, con «+N» desde la segunda (2 puntos) | Hecho | `a98318cb` → `f52234dc` | La segunda vuelve al diseño de antes, como pidió el 14/10. |
| D10 | 13/10 pt 5: «si doy click afuera de ese editable, ya debería guardarse» | Hecho | `862757d0` · `app/_components/EditableInline.tsx`, `lead-view/CampoEditable.tsx` (`onBlur`) | La causa real era cerrar un modal con un clic en el fondo. |
| D11 | 13/10 Resumen pt 1: el Resumen personalizable y con mejor diseño | Hecho | `6bae3751` (14/10), y el Resumen nativo en bloques (16/10) · `ficha/registro-resumen.tsx` | En `origin/main`. |
| D12 | 13/10 Resumen pt 2: «¿Era calificado?» en el Resumen, no en Tracking, y revisar cómo se alimenta CAPI | Hecho | `e541ff32` · `ficha/resumen/calificacion.tsx` | Sigue también en `ReunionesCard.tsx:171` (duplicado a retirar en la T2). Decisión abierta de Martín: ofrecer el conjunto de datos de CRM de Meta (tutorial en `07540703`). |
| D13 | 13/10 Pagos pt 1: asignar una oferta desde un desplegable, crear una nueva ahí mismo y «Analizar oferta» que lleva a Offer | Hecho | `81a28c18`, `4ca15b9a` (mig 0272) | |
| D14 | 13/10 Pagos pt 2 y 14/10: la tab Pagos más sencilla, personalizable, editable en la misma tab y sin «Editar deal →» en ningún lado (3 puntos) | Hecho | `8390f47ad` (bloques), `4a21adca1` (Customer Success) · `ficha/registro-pagos.tsx` | «Editar deal» sólo aparece en comentarios; `?edit=1` y `EditarDeal` se borraron el 17/10. En producción en los runs 34 a 38 (mig 0295). |
| D15 | 14/10: «todos los personalizables… un constructor por bloques como Dashboard y Landing Generator, con templates», y «piensa en todos los bloques» (2 puntos) | Hecho | `bdeca4755` (15/10), `6574b28b5`, `3983685bd` · `docs/diseno-ficha-bloques.md` | Catálogo de 54 bloques y plantillas por tipo de funnel. Ver también C12 y D2. |
| D16 | 14/10: el «⋯» del CRM sin subtítulos y sin «Avisos» ni «Resumen» (3 puntos) | Hecho | `43a27b56` · `app/crm/CrmToolbar.tsx` | |
| D17 | 14/10 (y 13/10): el reproductor de la grabación roto y «cargando eternamente»; que viva dentro de «Grabación de su visita» (2 puntos) | Hecho | `913966d4`, `c76f48bb` · `lead-view/ComportamientoCard.tsx` | La causa: `player.css` nunca se cargaba. |
| D18 | 14/10: los tipos de funnel que faltaban en «Nuevo CRM» (orgánico, Instagram, LinkedIn, DM funnel, YouTube, lead magnet…) | Hecho | `54b6bde61`, `8b3392d15` · `TIPOS_CRM` en `lib/pipeline.ts` | Test `tests/tipos-crm.test.ts`. |
| D19 | 13/10: que el desplegable diga «Nuevo CRM», arriba de todo, y que cada CRM tenga nombre propio (2 puntos) | Hecho | `0d07ddc8`, `ace3e61d` | Desde el 17/10 «Nuevo CRM» sólo lo ve el admin. |
| D20 | 14/10 02:20: «si se mueve a mano, se pregunte la hora» | Hecho | `46890b96` | Lo pasó el chat de Automations. |

## E. 12/10 — cinco mensajes sobre la ficha, el tablero, el alta y el editor del funnel

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| E1 | 02:21, 02:24 y 10:30 (#4 y #5): Instagram «un buscador real de todos los usuarios… con las fotos de perfil»; «piensa la mejor manera»; «investigar alternativas a Brave» | Parcial | `bdcee029`, `886318974` · `lib/instagram-buscar.ts`, `app/crm/new/InstagramBuscador.tsx` | Anda por @ exacto (Meta Business Discovery: sólo cuentas de empresa o creador) y por el nombre pegado. Por nombre no hay fuente gratis y oficial (medido el 17/10: Google Custom Search cerrado a clientes nuevos, Bing apagado, Brave sin plan gratis) y la pantalla lo dice. Pagar una fuente es decisión de Martín. |
| E2 | 02:08 #2: «Todas las tabs tienen su nombre al lado de "MaKo", también debe tenerlo la de CRM» | Sin confirmar | `app/_components/TituloTab.tsx` (vigila el `<head>` y repone «MaKo - CRM») | La causa es una hipótesis: /crm es la única ruta con `loading.tsx`. Se buscó el arreglo en el código y está, pero nadie midió en un navegador que la pestaña diga «MaKo - CRM». |
| E3 | 02:08, los otros 19 puntos: renombrar al cerrar, fuera las tabs Nutrición y Etiqueta, fuera «Ponerle un plazo», lada con banderas, fuera las fechas del alta, clic en la tarjeta para editar, el circulito de las etapas nuevas, el funnel como árbol, portada y foto del lead, «Borrar lead» en rojo, Reuniones sólo con etapa de reunión, ficha más ancha, sin «Guardar y completar después», tabs fijas, Notas sin redimensionar y con dictado, MaKo Analyst, sin «Cancelar» (19 puntos) | Hecho | `bdcee029` · verificado con grep: «Borrar lead» en `LeadSheet.tsx:259`, `resize: 'none'` en `NotasCard.tsx:58`, tabs `sticky` en `LeadTabs.tsx:124`, el circulito en `lib/pipeline.ts:94`. | Del #6 («agrega el paso de poner su sitio web») el alta quedó de 4 campos (E6) y la web se carga en la ficha. El #10 (IDs de leads) se midió: sale de una secuencia global, no se mezclan negocios. |
| E4 | 02:12: un «Ingreso estimado» por lead y el total estimado arriba de cada columna (2 puntos) | Hecho | `bdcee029` (mig 0258) · `app/crm/total-columna.ts` | |
| E5 | 02:17: la barra de arriba del tablero — sin el título «CRM», topbar arriba, el desplegable de funnels a la izquierda con el cubo, Activo/Nutrición/Descartado dentro de filtros, los tres puntos a la derecha (5 puntos) | Hecho | `bdcee029`, `3e5176c9` (la banda), `40d5ba8c` (la barra como tarjeta del ancho del kanban) · `CrmToolbar.tsx` | |
| E6 | 02:18 y 02:21: «Nuevo lead» simple, con cuatro campos (nombre, email, teléfono, Instagram), y que al crear abra la ficha (2 puntos) | Hecho | `bdcee029` · `app/crm/new/NewLeadForm.tsx` | |
| E7 | 10:30 (8 puntos): las reuniones cercanas en un botón de calendario que late, el borrador del alta, la topbar más gruesa, los filtros que persisten con F5, las opciones de cada etiqueta, todas las etapas en el editor, «¿Era calificado?» sólo para CAPI y el número de lead (lo dejó a nuestro criterio: queda el id global) | Hecho | `3e5176c9`, `0deedbe5` (filtros) | Los «plazos viejos» (#10) se midieron el 17/10: 0 funnels con plazos, nada que borrar. |
| E8 | 11:37 (8 puntos): etapas en una sola lista, el país del alta que recuerda y se detecta, las notas como los chats de MaKo, «A revisar» sin ir a otra tab, la barra con el ancho del kanban, etiquetas con ✓ y lápiz, los plazos a Automations, la ficha a alto completo | Hecho | `40d5ba8c`, `23615d974` (adjuntos de las notas, mig 0267), `99e0a02b` («A revisar» en el lugar) | El plazo de una etapa pasó a la plantilla «Un Lead No Avanzó» (`lead-no-avanzo` en `lib/plantillas-automatizaciones.ts`). |
| E9 | 11:43: «un desplegable para asignar campañas», el de «Lead entrante», dentro del editor del funnel | Hecho | `40d5ba8c` | |
| E10 | 13:11 (4 puntos): «+ Agregar etapa» arriba de todo; nutriciones editables, arrastrables y que se puedan quitar todas; el tipo de funnel arriba con UNA opción que se guarda al elegir y las campañas de Meta en su lugar; etapas con asa de arrastre, sin chips y con tacho rojo | Hecho | `53cf309f` · `app/crm/EtapasModal.tsx` | |
| E11 | 14:10 (4 puntos): «Asignar a este funnel» sin desplegable, el filtro de siempre, cinco campañas con «Ver más», etapas en tarjetas | Hecho | `8ed12c64` | |
| E12 | 14:54 (9 puntos): el desplegable de tipo en todas las etapas, el «+» entre etapas, el editor en cajas grises con «Asignar campañas» (logo de Meta) y «Editar etapas», el tipo de funnel en lista | Hecho | `ab720661` | Según commit; sin mirar en navegador. |

## F. 28/09 al 11/10 — el editor del funnel, los filtros y «Producto» → «Funnel»

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| F1 | 30/09 pt 9: que los datos de un lead en varios funnels se diferencien (por qué campaña y anuncio entró a cada uno, qué % del VSL vio en cada uno) | Parcial | `f26c0a942` (mig 0207) · `supabase/migrations/0207_lead_funnel.sql` | El lead está en varios funnels y la ficha sigue la del funnel, pero `lead_funnel` no tiene columnas de atribución ni de VSL y `leads.visitor_id` es uno solo: el recorrido por funnel no se guarda. Medido el 30/09: 750 visitantes ya miraron más de una landing. |
| F2 | 11/10: «cambiar el concepto "Producto" por "Funnel" en todos lados» (y «funnel > oferta > productos») | Parcial | `53ba6450` | Cambió todo lo que se lee en pantalla. Quedaron las descripciones de la API de MaKo (`lib/api-mako/areas/crm.def.ts` todavía dice «el producto del CRM»), la dimensión «Producto» de los gráficos y los prompts. |
| F3 | 28/09: sacar la ruta `/funnel` y editar todo en un pop-up del CRM, con los tres puntos «...» (2 puntos) | Hecho | `897f82d9b` · `app/funnel/page.tsx` (es un redirect a `/crm`) | |
| F4 | 29/09 20:10: nutrición en el pop-up, modal más ancho, eliminar y renombrar funnels con copia de seguridad, no mostrar etapas no editables, editar etapas, fuera textos de más, y sacar `/onboarding?tab=funnel` (8 puntos, contando el 1, que era un bug: `/onboarding` se rompía entero) | Hecho | `3de3d7337`, `b9651f07d` (el bug) | Verificado: `FunnelEditor` ya no se monta en `/onboarding` (sólo en `app/crm`). El resto, según commit. |
| F5 | 29/09 23:40: once cosas del pop-up (un solo cerrar, sin líneas, eliminar sin fricción con «deshacer» de 5 s, etapas que se arrastran, loader…), cuatro del alta y tres del desplegable (18 puntos) | Hecho | `9a1e38cf2` | Según commit. |
| F6 | 30/09 01:20: sin líneas divisorias, abrir rápido, «Lead entrante» primera y fija, y «Nuevo producto» en pasos (4 puntos) | Hecho | `51843f27c` | Hoy es «Nuevo CRM · N de M» (`CrmToolbar.tsx:962`). Según commit. |
| F7 | 30/09 05:40, los otros 9 puntos (1 a 8 y 10): desplegables, hover en todos los botones, columnas arrastrables y con título que se renombra, menú sin opciones en gris, aviso de «MaKo movió» acotado al funnel, sin recuadro vacío, placeholder «Nuevo lead», un solo «Importar leads», traer leads de otro funnel con aviso de duplicado (9 puntos) | Hecho | `b05f11c0e`, `ebffce034` | Verificado con grep: «Importar leads» en `CrmToolbar.tsx` y «＋ Nuevo lead» en `CrmBoard.tsx`. El interruptor «CRM automático» que pidió ahí se sacó el 14/10 (D5). La primera mitad del 9 (el desplegable de funnels en la ficha) es hoy la `CabeceraLead`; la segunda mitad es F1. |
| F8 | 30/09 11:33 (5 puntos): el editor de nutrición como el de Etapas, la línea bajo «Nuevo producto», los tres puntos sin la palabra «mover», que no se vea «Funnel principal» donde el desplegable dice otro nombre | Hecho | `f0117f0e0` | Las nutriciones pasaron a ser una etapa más el 12/10 (E3). |
| F9 | 06/10: un lead en varios funnels se AGREGA, nunca se mueve; la campaña asignada trae todos sus leads a la primera etapa; guardar las fotos de WhatsApp (3 puntos) | Hecho | `f26c0a942` (mig 0207), `0418a6abc` | Decisiones de Martín del 06/10. |
| F10 | 10/10: el filtro «Anuncio» (Origen repetía Campaña), como árbol con la flecha a la derecha, que se abra al tocar, más ancho, que destildar pliegue, sin chips debajo y que los filtros sobrevivan al F5 (8 puntos) | Hecho | `686c51bef`, `bdbf3707`, `8a39bb02`, `f531a170`, `0a55645e`, `0deedbe5` | En producción según el relevo (probado en el ws13). |

## G. 1 al 5/10 — lo que salió de la llamada con Leila

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| G1 | 01/10: borrar «Nutrición No Show R1» «no se pudo… creo que hay un error» | Hecho | `78108a084` | El menú de una columna sólo ofrece borrar lo que el servidor sabe borrar. |
| G2 | 04/10 y 05/10: en Tracking, los clics y la grabación del scroll en la misma ficha (sin ir a Clarity), «Ponles nombre» en un pop-up, replicar Clarity, el mapa de calor en Landing Analyst y el dataset de Meta con su tutorial (5 puntos) | Hecho | `99d89e07`, `07540703` · `lead-view/ComportamientoCard.tsx`, `NombrarVideosModal.tsx`, `app/landing-analyst/MapaDeCalor.tsx` | El replay propio está; Clarity tampoco muestra el VSL (documentado por Microsoft). |
| G3 | 04/10: que el Pixel se asigne a un funnel y el lead caiga en ese CRM; que se detecten duplicados en todas las etapas; el análisis de la llamada en la ficha; guardar lo que Meta borra (4 puntos) | Hecho | `865dffb4`, `640785a5` | El «cruce por etapa» que Martín suponía no existía: el duplicado era el teléfono comparado por dígitos completos. |

## H. Antes — julio a septiembre

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| H1 | 04/07: detectar al closer desde la asignación de Chatwoot («Asignado a X por Y») | No hecho | `lib/chatwoot.ts` (cascarón) | No se hace: Chatwoot salió del producto el 09/10 (memoria `chatwoot-apagado`). No cuenta como trabajo pendiente. |
| H2 | 27/09 «sacar la fricción del CRM», por tandas con sus pasos de prueba | Parcial | `50df1cb2`, `eb572aad`, `c72966b5`, `b6aaee05` · `/admin/friccion` | Todo lo que era código está hecho. El 27/09 cuatro filas marcadas «aplicadas» no lo estaban y se corrigieron. Siguen sin decidir las 3 preguntas a Mauricio y qué hacer con los 1.057 leads cuya etapa el embudo ya no tiene. |
| H3 | 11/08 «debe terminar en un LINK que se confirma DENTRO de MaKo», con la misma tabla del importador | Hecho | `c03b7e59`, `2d4201b2` · `app/crm/TablaRevisionLeads.tsx` | Según commit. |
| H4 | 03/07 «ficha v5» (15 puntos): wizard de MaKo, Hubo R1/R2, deshacer y restaurar, Deal Details, Tracking granular, Insights, «Automático primero» y el resto | Hecho | `4acbc8404`, `b4623e38c`, `aa2006d1a`, `85bf28997`, `10b9c2213`, `328f2fd08`, `8df586a6f`, `46ca4da56` | Según commit. Los nombres en inglés (Overview, Meetings, Deal Details) los superó el orden de tabs que decidió Martín el 27/09 y el 05/10, y Deal Details lo reemplazó Pagos en bloques. |
| H5 | 04/07 «segundo lote» (19 puntos): Google Calendar como tercera fuente, cuotas, Closer/Setter con foto, formularios y el resto | Hecho | `2c8bb6143`, `1a6a85718` y los de `docs/relevo/crm.md` · `lib/google-calendar.ts` | 19 de los 20 puntos, según commit. El que falta: detectar el closer desde la asignación de Chatwoot; ya no aplica, Chatwoot se borró el 09/10 (H1). |

## I. Teléfono (`/m/crm`)

| # | Pedido | Estado | Dónde / commit | Nota |
|---|---|---|---|---|
| I1 | 17/10: «rediseña las actuales de CRM, Plan… siempre copia de otras apps» (el CRM del teléfono copiando Pipedrive y HubSpot) | Hecho | `a3ac916e4` · `app/m/crm/` | En `origin/main` (VERDE `b158658e2`). Después: las etapas en píldoras y «Próximo» (`3b1f3a742`, B8) y, hoy, las tarjetas que siguen «Personalizar tarjetas» (`5cb1e334a`, A4). |
| I2 | 13/10: «el CRM no funciona» en el teléfono (abría vacío con 13 leads) | Hecho | `7b82bcdef` | Según commit. |

`/m/crm` no monta el chat con MaKo del CRM: el teléfono tiene el suyo en MaKo. No encontré un pedido de Martín para tenerlo ahí.

---

## Lo que falta, en orden

Del pedido más reciente al más viejo. Entre paréntesis, lo que depende de una decisión de Martín.

1. **A1** · El chat del CRM con la pieza única del Ops Center: `app/crm/mako-crm/ChatMakoCrm.tsx` y `PanelMakoCrm.tsx`, cuando `app/_chat/CajaChat.tsx` (rama `chat-unico`) llegue a `main`.
2. **D2** · Reuniones y Tracking partidos en bloques: `ficha/registro-reuniones.tsx`, `ficha/registro-tracking.tsx`, `lead-view/ReunionesCard.tsx`, `lead-view/ComportamientoCard.tsx`.
3. **D4** · Sugerencias de las clases 2 («repites un gesto») y 4 («llega algo nuevo»): `lib/sugerencias-crm.ts` y `lib/sugerencias-crm-server.ts`.
4. **D5** · Las plantillas de Automations que reemplacen al «CRM automático» (T1 a T6) y recién entonces apagar el motor: `lib/plantillas-automatizaciones.ts`, `lib/crm-auto.ts`.
5. **B1** · Columnas editables en el Plan: `app/plan/board/BoardShell.tsx`.
6. **B3** · El producto de Clients que conserva el nombre viejo del funnel: `app/customer-success/entrega.ts` (`productosDeLaEntrega`).
7. **B4** · Plan del teléfono con el check gris en vez del círculo (si Martín lo quiere): `app/m/plan/ListaPlan.tsx`.
8. **B2** · «Pago fallido» en la tarjeta de un cliente, foto de Instagram, vista «Prioridades» del Plan, Proyectos del teléfono y foto del cliente en el teléfono: `app/customer-success/aviso-tarjeta.ts`, `app/plan/`, `app/m/plan/`.
9. **C3** · Medir el pop-up de la ficha en producción y partir `getLeadFullAction` si sigue lento: `app/crm/actions.ts`.
10. **C1** y **C2** · Google Calendar en «Asignar evento» (decidido que no por la API de Google; decide Martín) y crear el evento desde MaKo en vez de abrir Calendly o Cal.com: `app/crm/EventosDeEtapaModal.tsx`.
11. **E1** · Buscar Instagram por nombre (decide Martín si se paga una fuente): `lib/instagram-buscar.ts`, `app/api/crm/instagram-buscar/route.ts`.
12. **E2** · Mirar en un navegador que la pestaña diga «MaKo - CRM»: `app/_components/TituloTab.tsx`.
13. **F1** · Atribución y VSL por funnel en un lead que está en varios: `lib/lead-funnel.ts`, `supabase/migrations/0207_lead_funnel.sql` (una migración nueva).
14. **F2** · Los restos de «Producto» → «Funnel»: `lib/api-mako/areas/crm.def.ts`, `lib/graficos-catalogo.ts` y los prompts.
15. **H2** · Las 3 preguntas a Mauricio y los 1.057 leads fuera del embudo (decide Mauricio o Martín): `docs/friccion-crm.md`, `/admin/friccion`.

**Esperan una decisión de Martín** (no son pedidos suyos, pero frenan filas de arriba):
- **E1**: ¿se paga una fuente para buscar Instagram por nombre?
- **C1**: Google Calendar no se puede por la API de Google; ¿se deja así?
- **D12**: ¿se ofrece el conjunto de datos de CRM de Meta (lo que hace que optimice por calificados)?
- **H2**: las 3 preguntas a Mauricio y los 1.057 leads fuera del embudo.
- La §5 de `docs/relevo/crm.md` (ganar en un funnel agregado no marca ganado al lead, entre otras).

**No cuenta como pendiente:** H1 (Chatwoot ya no existe).

## Qué no pude comprobar

- Nada se miró en pantalla (la máquina no tiene RAM para `next dev`) y no consulté producción: «Hecho» es «en el código».
- Las filas marcadas «según commit» (C11, E12, F3 a F6, F8, H3 a H5, I2) se apoyan en el commit y la bitácora, no en un grep del síntoma.
- Los 5 commits de hoy son de este mismo chat (el CRM); este documento se midió en `5cb1e334a` y lo sumó en el commit siguiente.
