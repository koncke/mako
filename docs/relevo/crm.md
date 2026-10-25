# Relevo — CRM, leads y embudos

**Ventana:** del 05/10/2026 12:33 (commit `6785dc16`) al 10/10/2026 18:59 (`9862c146`).
**Escrito el 10/10/2026 a las 19:10** por la sesión de CRM (cuenta `claude2`), reescribiendo
el briefing anterior (`b5f7fb55`, 10/10 17:10) con todo verificado contra el árbol.
**Rutas de esta área:** `app/crm/**`, `lib/leads.ts`, `lib/funnel*.ts`, `lib/crm*.ts`,
`lib/lead-*.ts`, `lib/campana-*.ts`, `lib/etiquetas*.ts`, `lib/pipeline.ts`.

## 0-Ω25. 24-25/10/2026, noche (chat «CRM», cuenta `claude5` «Ananda»): los puntos 12 a 21 del 24/10

Los pedidos, TEXTUALES, en docs/feedback-24-10.md («CRM → chat CRM», puntos 12 a 21). Rama `crm-2510` en C:/dev/wt-crm-2510,
sobre origin/main 59d228ea1. Se entrega de a tandas al Cerebro (él arma el tren y sube). Lo aprendido, en hallazgos-crm
(«"Ordenar" es de cada COLUMNA…») y hallazgos-infra (restaurar de una copia al romper un test).

**Tanda 1 — puntos 13, 15 y 17:**
- 13: el «⋯» de cada columna arranca con «Nuevo lead» y «Ordenar ›» (por columna: Manual, más nuevos, más viejos, nombre,
  respondió primero, mayor monto, fecha de reunión, vence primero; lo que la columna no tiene, no se ofrece), «Cambiar nombre»,
  las flechas y «Agregar etapa» abajo, «Eliminar etapa» último. «Ordenar» salió de «Filtrar». El «⋯» de la barra y el clic
  derecho del fondo van en el mismo orden (importar, buscar prospectos, exportar · editar etapas, personalizar tarjetas); el de
  una tarjeta junta «Seleccionar» con abrir y mover.
- 15: «Asignar campañas» se fue del editor de etapas (se asignan desde el «⋯» de la columna de entrada).
- 17: «Traer de otro funnel» muestra a los que ya están, abajo, en gris y sin casilla, como en los grupos de WhatsApp.

**Sin ver en pantalla** (la PC con ~4 GB libres y 7 chats: no se levantó `next dev`): el «⋯» de una columna con «Ordenar ›»,
el ícono azul de una columna ordenada, y «Traer de otro funnel» con los grises. Se mira en el ws3 cuando esté desplegado.

**Tanda 2 — puntos 14, 16 y 21:**
- 14: las hojas de la ficha arrancan al borde (sin la sangría del nombre), sin la flechita de la tab, y las que no entran van a
  «Ver más» con «Nueva hoja» adentro. El «⋯» de al lado de «Editar» es el menú de la ficha (el del clic derecho), por
  secciones y con lo de la hoja abierta.
- 16: «A revisar» trae sólo los leads cuya casa es el CRM del tablero.
- 21: medido con la conexión de Mauricio: Meta conectada SIN Instagram (ningún permiso de Instagram, la página sin cuenta
  vinculada). La pantalla ya no pide «Conectar Meta» ahí, y el botón sale una vez. **La foto no llega**: ninguna fuente puede
  leer Instagram en esa cuenta. Fue al Ops Center la pregunta a Martín (el Instagram de MaKo + permiso, gratis; o Apify, pago).
  Sin ver en pantalla, igual que la tanda 1.

**Tanda 2, arreglo:** `b38cfd930` (dos errores de tipos de la ficha que se colaron: ver hallazgos-infra, el filtro que
escondía el «NO SE PUDO CHEQUEAR»). La pregunta de Instagram se rehízo sin Apify (Martín lo descartó el 24/10).

**Tanda 3 — puntos 19 y 20:**
- 19: «Traer», el Scraper e «Importar» se abren ENCIMA de «Nuevo lead» (la pila de la casa): cerrarlos vuelve al alta con lo
  escrito.
- 20: los tres con un molde (app/crm/MoldeTraer.tsx), **copiado del «Preview import» de Attio** (su documentación oficial,
  captura del 25/10 en el scratchpad de la sesión): de dónde arriba con un «⋯», «Entran a», el resumen con chips, la lista, y
  abajo sólo «Atrás» y la acción. El importador dejó `WizardShell`.

**Tanda 4 — punto 12:** el panel de MaKo de la ficha flota (el marco `.an` del Dashboard), y con un bloque elegido cada
fila de dato lleva su ✕ para sacarla (la captura c06 mostraba que «Datos ▾» existía y no se encontraba: el cuerpo es inerte).

**Tanda 5 — punto 18:** medido antes de tocar (hallazgos-crm, «Los grupos de WhatsApp tardan muchísimo»): la lista de
grupos abre al instante (guardada, o la base) y la completa (33 s en la línea de la plataforma) llega por detrás y se
guarda; traer va de a cuatro.

**Martín contestó la pregunta de Instagram** (25/10, por el Ops Center): sí vincular el Instagram de MaKo, y preguntó si hay
otra forma gratis. Se le contestó: no espera la verificación (cuenta propia, acceso estándar) y la forma gratis es la
extensión de MaKo leyendo Instagram con su sesión (como folk). **Pendiente:** los clics de Martín en Meta for Developers (el
caso de uso de Instagram en la app MaKo, vincular el Instagram a «Hola MaKo», token con instagram_basic) y, si dice que sí,
la lectura por la extensión.

**Ticket #10 (25/10, primero por ser un cliente roto):** la ficha de /crm/3445 se caía con React #418. No era una fecha sin
zona: el lead se llama «🧪 Martín…» y la marca de la cabecera cortaba el emoji por la mitad (`b6a7ede22`, la cosecha en
hallazgos-ui). Quedan 8 copias del mismo corte en piezas de otras tabs (la lista, ahí): no son de este chat.

**Lo que queda del pedido:** nada de los puntos 12 a 21. Mirarlo todo en pantalla cuando esté desplegado (el Chrome de
Martín ya tiene sesión; de a un chat por vez, en el Cliente de Prueba `?ws=3`). **Redirigir antes del loader (25/10, del Cerebro):** hecho
para las siete páginas de /crm, no sólo las tres que pidió (app/crm/layout.tsx; hallazgos-crm). Cuando entre el guard de
Landings, sacar las tres de su `CONOCIDAS_SIN_LAYOUT`.

**La llamada con Leandro (25/10):** f15 (WhatsApp abre el chat de MaKo, en las cuatro puertas), f12 («Completar nombres»
por la extensión: pide instalarla y arranca sola), f13 (la pregunta de «Datos de empresa» en una línea) y f11 («Completar
nombres» en el pie). f14 no se tocó: lo decide Martín con el Cerebro. **Pendiente de la extensión** (no de este chat):
reponer mako-puente.js en las pestañas abiertas en `onInstalled`, para que f12 arranque sin recargar (hallazgos-crm).

**Pendiente con Martín:** la comprobación del chip del @ de un lead con sólo Instagram en producción (el Cerebro: crear
«Prueba @ solo» en el ws3, mirarlo en kanban, lista y ficha, probar el duplicado y borrarlo). En el ws3 no hay ninguno así
(medido en la base el 25/10), y crear y borrar en producción pide su sí en el chat. El Chrome de Martín no respondía. Después: las cuotas (`c7ff7d7fc`) esperan revisión adversarial; `crm-b5-2310` (punta real
`b1c4924fd`, 17 hallazgos por arreglar) NO sube antes del lunes 26/10.

## 0-Ω24. 24/10/2026, madrugada (chat «CRM», cuenta `claude1`): la base de venta de Martín desde sus grupos

Rama `crm-grupo-completar-2410` en C:/dev/wt-crm-grupo, sobre origin/main ebcfd9eb0, pasada al tren: `5478b15a5`
(«Completar nombres» y el pie con `VistaConPie`), `8969fb722` (mover y eliminar en lote de a tandas) y `efb31037c`
(«Datos de empresa», el perfil de WhatsApp). Lo aprendido, en hallazgos-crm, hallazgos-comunicacion y hallazgos-ui.

**Después (24/10, mañana), en la misma rama, como tags (sin rama remota):**
- `respaldo/crm-grupo-2410-ext` = f6ba1c10c: la extensión 0.70.0 y «Completar desde mi WhatsApp». La extensión lee lo que
  el WhatsApp Web de Martín ya guardó (nombre de agenda, el que cada uno se puso, la empresa verificada, los grupos en común),
  sin clics y sin red. Ver docs/hallazgos-extension.md.
- `respaldo/crm-grupo-2410-cupo` = 0553eda9e: «Datos de empresa» con tope (40 por corrida, 120 por día y por línea,
  reservado en el server), recordando a quién ya consultó, con la cuenta y los minutos antes de arrancar.

**Después (24/10, tarde):** `respaldo/crm-lote-completar-2410` es el «Completar» en lote desde el tablero, más «los que ya están, en
gris abajo» en traer de un grupo, con los arreglos de una revisión adversarial que confirmó 25 problemas (el peor: el «Parar» no
aparecía). Los pedidos de diseño del CRM que siguen sin cerrar (61, medidos contra el código) están en
docs/feedback-diseno-pendiente.md, sección «El CRM, medido aparte».

**Lo que queda, en orden:**
0. Que Martín corra la 0.70 (pasos en el mensaje al Cerebro del 24/10): la pantalla da la cobertura real sobre los 221, y la
   consola, `[wa-fichas]`, qué tablas tiene su WhatsApp Web. Con eso se decide si el panel del contacto (categoría, web,
   correo, estado) tiene de dónde leerse sin abrir el chat. Abrir el chat da el «visto»: no se hace sin medir. El rubro
   filtrable depende de eso.
1. Verlo en pantalla cuando esté desplegado: un lote de 200+ movido sin F5, el pie de las dos vistas de «traer» (también en
   el teléfono), «Completar nombres», «Completar desde mi WhatsApp» y «Datos de empresa» sobre el grupo de 221 de Martín.
2. El barrido del pie en el resto de la app: 12 modales con una lista sin alto acotado y botones al final del cuerpo
   (UnificarFichas, CargarGuiones, PersonalizarTarjetas, EtapasModal, EtapasEntregaModal, VozAIStep, ElegirFoto, AreasHub,
   Busqueda, EditorInforme, DialogoAnalitica, PlantillasSemana). Hay que mirar cada uno: el workflow `wf_61c7c384-36e`
   quedó frenado por la RAM y se retoma con su caché. Los que no son del CRM van a su chat.
3. ~~Enganchar la búsqueda por Apify de Ventas~~: DESCARTADO por Martín el 24/10 («no voy a gastar 5 USD por 200 leads»);
   Ventas la sacó del tren (revert 048d3f838). Todo sale de la extensión. La búsqueda externa (Google/Instagram por nombre)
   NO se arma todavía. Si algún día se arma: por lead o por etapa, a ritmo humano, y ante un captcha para y avisa (nunca lo
   resuelve ni lo saltea).
4. «Datos de empresa» por la API de MaKo (el tope diario ya está: que la API pase por `completarPerfilesDelGrupo`, que lo
   reserva).
5. Barrer el resto de la app (fuera del CRM) buscando lotes de a uno en una sola llamada.

**La fila «zombi» de `evolution_instancias` no era la causa:** la línea de Martín se conectó a las 02:13. La segunda fila de
Código Inmobiliario (2510) es una línea a medio conectar del 13/10: no se borró, lo decide Martín o el cliente.

## 0-Ω23. 23-24/10/2026, noche (chat «CRM», cuenta `claude2`): «Unificar» dos fichas parecidas

Pedido de Martín (23/10 ~23:20 UTC, por el Cerebro; literal en la bitácora). Rama `crm-unificar-2310` en
C:/dev/wt-crm-unificar, ENCIMA de `crm-ficha-aut-2310` (9f5936f22): sale con ella o después. El bloque «Posibles
duplicados» dice en qué CRM está la otra (con su etapa), por qué se parece y desde cuándo existe, con «Abrir» y
«Unificar». «Unificar» abre la previa (qué queda de cada una, dónde queda, lo que se trae, lo que chocaba) y sólo el admin
lo confirma. Lo que no se deduce del código está en docs/hallazgos-crm.md («Unificar» dos fichas…).

**Probado en seco con el caso real** (scripts/unificar-en-seco.mts --ws 1 --a 249 --b 3099, sólo lectura): queda el 249 y
se trae la inscripción 291, 6 mensajes, 4 líneas del historial y 2 envíos, en 13 operaciones. **NO se unificaron en
producción**: el ws1 es de un cliente y es la prueba de Martín.

**Sin hacer, con el archivo:**
- Unir fichas que ya son clientes (cuotas, Customer Success, curso, comunidad): lib/leads-unificar-reglas.ts
  (`TABLAS_DE_CLIENTE`). Hoy no se arma el plan y se dice.
- `resolverLeadIdsPorTelefono` (lib/evolution-mensajes.ts:224) no ordena: es de Comunicación.
- La operación en la API de MaKo (`unificar_leads`): no se hizo. Es del chat API de MaKo, sobre `planParaUnificar` y
  `aplicarUnificar`.
- Sin ver en pantalla: el bloque y el pop-up, en el ws3 con dos fichas de prueba, después del deploy.

## 0-Ω22. 23/10/2026, noche (chat «CRM», cuenta `claude2`): los datos de cada bloque y el bloque «Automatizaciones»

Pedido de Martín (23/10 ~20:40 UTC, por el Cerebro; literal en la bitácora del CRM). Rama `crm-ficha-aut-2310` en
C:/dev/wt-crm-fichaut, sobre main 8b3333a19. Lo que no se deduce del código está en docs/hallazgos-crm.md (las dos
entradas del 23/10 de arriba).

**Pedido 1, los bloques editables a medias** (`7484a5720`): «Obligatorio» por dato en todos los bloques, «Datos ▾» en el
contacto (sacar teléfono, email o empresa, y sumar Instagram, web, LinkedIn, YouTube o la dirección) y en el setter y el
closer. La empresa nace apagada en las nueve plantillas, el contacto se quita, la R1 no repite el setter y el closer, y
«Completar datos» y el toast al mover sólo piden lo obligatorio. tests/ficha-datos-del-bloque.test.ts y
ficha-obligatorio.test.ts.

**Pedido 2, el bloque «Automatizaciones»** (`e4b324516`, el teléfono en el commit siguiente): sale de la charla a
app/crm/lead-view/ficha/resumen/automatizaciones.tsx, vuelve arriba en las plantillas del Resumen (se calla sin
automatizaciones), tiene tres diseños, y su título y el de cualquier bloque se cambian («Título» en la barra). El toast
del movimiento dice por qué no entró. tests/ficha-automatizaciones.test.ts.

**El contrato con Automations** (sesión `local_a66389ee`, mensaje del 23/10 ~21:00). Ellos hacen lib y las actions; el
bloque los lee por UNA puerta, app/crm/lead-view/ficha/resumen/automatizaciones-datos.ts:
- `automatizacionesDelLeadDetalleAction(leadId) → { zona, inscripciones: InscripcionDelLead[], noEntro: NoEntro[] }`.
  Las vivas y las terminadas de ~30 días, cada una con estado, paso (con el total), lo próximo (título y hora), el freno,
  cómo terminó, lo enviado (estado y error en palabras), la reentrada y `puede`.
- `empezarDeNuevoAction(leadId, secuenciaId) → { ok, resumen } | { ok: false, error }`, sólo admin, con la regla de
  `reactivarInscripcion`.
- `StageMoveResultado.automatizaciones = { entro, noEntro }` desde `setLeadStageAction`, `completeStageMoveAction` y
  `resolverQueHacerAction`. El toast ya lo lee (`noEntroDelMovimiento`).

**Entregado el 23/10 (aut2-aviso-vacio, af7bd0ec4, mergeado en esta rama)**, con tres diferencias que el bloque ya
respeta (`vistaDeDetalle`, app/crm/automatizacion-lead.ts): `estado` es texto (suma `handoff` y `pendiente`), lo
enviado trae el estado de `nutricion_envios` (no hay «entregado» ni «leído»: no se inventa), y el `NoEntro` trae el motivo
SIN el nombre y sin el paso (se cruza con la inscripción). La acción es `empezarDeNuevoEnAutomatizacionAction`, y
`puede.porQueNo` dice por qué no (el botón sale apagado, con el porqué).

**Sin ver en pantalla.** No se levantó la app (escribe en producción). Se mira después del deploy en el ws3 o con la
sesión del ws10, nunca en el ws1. El contacto con «Datos ▾»: sacar la empresa, el aviso se va. La R1 con «Obligatorio ▾».
Un lead en una automatización, con el bloque en «Lista», «Una línea» y «Línea de tiempo», a 1440 y a 390. El teléfono:
/m/crm/<id>.

**Sin hacer, con el archivo:**
- Elegir los campos de los bloques de Pagos (venta, suscripción, datos fiscales, servicio vendido, promesa y garantía,
  obligaciones). Son de Cobros: app/crm/lead-view/ficha/pagos/bloques-cobro.tsx y bloques-deal.tsx. Sus avisos ya son
  por dato.
- La descripción de `opcion` en cambiar_ficha_funnel (lib/api-mako/areas/crm.def.ts:471) no nombra «datos» ni
  «titulo=». Es del chat API de MaKo: se le pidió. MaKo igual lo ve en la salida de ver_ficha (`datos`, `datos_posibles`).

## 0-Ω21. 22-23/10/2026, madrugada (chat «CRM», cuenta `claude3`): «Vincular evento / cobro» e Instagram

**«Vincular evento» y «Vincular cobro»** (feedback de Martín con capturas del ws1, vía el Cerebro): rama `crm-vinc-2210` en
C:/dev/wt-crm-vinc, sobre main d0ec8904f. El nombre, el CRM › la etapa arriba, los dos pop-ups rediseñados (app/crm/vincular-etapa.ts),
lo vinculado al toque desde la base y cada cambio en su lugar, el aviso del «⋯» (lib/vinculos-de-columnas.ts) y el cobro de
Ganado por MaKo (cuatro ops al final del área crm, `plata: true` las que escriben). Pasó la revisión adversarial del cobro.
tests/crm-vincular-22-10.test.ts. **Sin hacer** (en este orden): (1) la velocidad del server de la agenda, sobre main, con el
contrato que pidió Cobros: `eventosDelProveedor(proveedor)` sigue siendo la unidad de lectura, la caché por negocio + proveedor,
el input de crear/editar como objeto y el token o la key por parámetro a lib/calendly-agenda.ts y lib/calcom.ts (Cobros mergea su
fase B, «por cuenta», encima); (2) «Traer de otro funnel» (pedido del Cerebro del 23/10: botón visible, loader, sin el texto de
«Se ven 300 de 869», el pie pegado con fondo sólido); (3) la edición completa del evento (lo que deja cada API, en
docs/hallazgos-integraciones.md) y elegir la cuenta en el pop-up; (4) las capturas del después en el ws3.

**La tanda junta** (vincular + Instagram + agenda rápida + «Traer de otro funnel»): rama `crm-tanda-2310` en
C:/dev/wt-crm-tanda, punta 44db84a2e, pasada a Integración. **La edición completa del evento y la cuenta en el pop-up**: rama
`crm-edicion-2310` en C:/dev/wt-crm-edicion, ENCIMA de la de Cobros (`cuentas-2210`, fases A y B de varias cuentas): sale
con ellos, no antes. Ahí también el cobro de Ganado toma todas las cuentas conectadas (`cuentasDePago`), no sólo la principal.

**Instagram, «Conectar Meta»**: rama `crm-ig-2210` en C:/dev/wt-crm-ig. 4487ac5d6 salió del tren 16 por `fresco` sin tope; la
punta 18146bffd le pone el tope (una cada 10 minutos por negocio, 20 por día) y no borra la pausa de un límite de Meta.

## 0-Ω20. 21-22/10/2026, noche (chat «CRM», cuenta `claude3`): el feedback de Martín de las 23:10

**22/10, 21:10, el feedback con capturas del ws1** (rama `crm-fb-2210c` en C:/dev/wt-crm-fb3, sobre main 449247716): el
«⋯» de la columna abre el menú del clic derecho, por secciones; «Tipo de etapa ›» con los tipos ahí mismo; el ícono `etapa`
es una bandera; «Tus reuniones» es una tarjeta para preparar cada reunión (app/crm/TarjetaReunion.tsx).
tests/crm-feedback-22-10-c.test.ts. **Sin ver en pantalla**: después del deploy, capturas en el ws3 (Chrome, grupo propio).

El pedido, literal, en la bitácora del CRM (hito `actor: 'martin'` del 21/10 23:10). Rama final `crm-2110-t3` en
`C:/dev/wt-crm-2110c` (lleva adentro `crm-2110-t1` y `crm-2110-t2b`). **Sin subir: la punta va a «Cerebro › Integración».**
Lo que no se deduce del código, en docs/hallazgos-crm.md («El feedback del 21/10 (noche)…») y docs/hallazgos-ui.md.

**22/10, «Vincular cobro» en Ganado** (punto 3 del feedback de Martín): rama `crm-cobro-ganado-2210` en
C:/dev/wt-crm-cobro (sobre `crm-aut-lead-2210`). El ⋯ y el clic derecho de Ganado abren app/crm/CobroDeEtapaModal.tsx:
producto con precio, una casilla por cuenta (Stripe y Mercado Pago a la vez, varias por proveedor), «+ Producto»
(catálogo o crear), «Editar» y «Quitar» con Deshacer: tests/crm-cobro-ganado.test.ts. Con las acciones de verdad de
Cobros (lib/cobro-etapa.ts y app/crm/cobro-etapa-actions.ts, su punta 81c8446e7, la mig 0326 aplicada): el stub se fue
el 22/10. Sin «Copiar link» hasta que `linkDelVinculoAction` dé el link sin un lead (Cobros avisa).

**22/10, noche, CR3 y CR4** (rama `crm-cr34-2210` en C:/dev/wt-crm-cr34, sobre main 72fd0b5bd con OC4 y OC6): el MaKo
Analyst de la ficha con el hilo y la caja del Ops Center; la estrella del CRM con el lead abierto (app/crm/lead-abierto.ts);
la estrella en el Plan y en Clientes, encima de la tarjeta abierta (`encimaDeModales`). tests/crm-estrella-cr3-cr4.test.ts.
**Sin ver en pantalla**: se mira en el ws3 cuando salga (/plan con una tarea abierta: «cerrala» desde la estrella).

**22/10, noche, el P0 del sábado (el tablero trabado con 1.050)**: en la misma rama `crm-cobro-ganado-2210`. Cada columna
dibuja 30 y suma 30 al bajar (app/crm/columna-por-tandas.ts, FinDeColumna.tsx), y el Kanban topea con `maxHeight`
(`5dc4c17b5` es el mismo arreglo, suelto, desde main). Medido con el arnés (tests/_crm-tablero-medir.mjs, con
`ARNES_CSS` = la hoja de producción): 1.169 en 8 columnas, de 14.528 nodos y 3,0–3,6 s a 3.280 y 0,4–0,9 s.
**Sin hacer:** medirlo EN PRODUCCIÓN cuando salga (el arnés va entre 1,5 y 7 veces más rápido que el Chrome de Martín): el ws1
principal y «Sprint 3 días», con `long-animation-frame` (cómo, en docs/hallazgos-crm.md).

**22/10, «está en una automatización» y «Frenar»** (Martín: «en el CRM debería indicar en la tarjeta o en algún lugar
que esos leads están en una automatización activa, y que desde el CRM también se pueda frenar»): rama `crm-aut-lead-2210` en
C:/dev/wt-crm-aut (sobre `crm-feedback-2210b`). El chip en la tarjeta, la fila en la ficha rápida, «Frenar automatización»
en el clic derecho y en la barra de lote, y «Frenar» por automatización en el bloque de la ficha:
tests/crm-automatizacion-lead.test.ts. Con las acciones de verdad de Automations desde el 22/10
(app/automations/automatizaciones-del-lead-actions.ts y lib/automatizaciones-del-lead-reglas.ts, en main en bf8c71843): el
stub se fue en a52135c9c.

**22/10, el feedback de Martín con dos capturas** (C:/dev/cerebro-herramientas/feedback-crm-martin-22-10.md): rama
`crm-feedback-2210b` en C:/dev/wt-crm-fb2210 (sobre `crm-estrella-2210`). Hechos el 1 y el 2 (el Kanban hasta el fondo),
el 4 (la casilla de la columna) y el 5 («Tus reuniones», un pop-up para todos con el bloque azul y «Ver detalle»):
tests/crm-feedback-22-10.test.ts. El 3 («Vincular cobro» en Ganado) espera las acciones de Cobros: el contrato está en las
notas compartidas (contrato-cobro-en-ganado.md), y no se crean `lib/cobro-etapa.ts` ni `app/crm/cobro-etapa-actions.ts`
(son de Cobros).

**22/10, la llamada de Martín con Mauricio (C1–C9 de docs/pedidos-crm.md), EN PRODUCCIÓN:**
- P0 (traer los 1.050 de otro producto, arrastrar una selección): `16cac1fd1`, run 230. Hecho `26c541444`.
- P1 (C3 mover sin esperar, C4 «Creando…», C5 el menú que tapaba, C7 las hojas de la ficha a la vista): `50fbb71df`,
  run 231. Hecho `6f21aa754`.
- C8 («También en: Sprint 3 días › Prospección activa» en la ficha): `8d1c1cb51`, run 233. Hecho `a4b29ca98`.
- Avisos al grupo del ws1: P0 y P1 salieron. El del C8 NO (tope de 3 por día, `TOPE_AVISOS_POR_DIA` en
  lib/aviso-arreglo.ts): su línea la manda Automations en el aviso combinado de las 09:10.
- **C6 sin reproducir** («los tres puntos de "Lead entrante" lo mandaron a otro lado»): el Chrome de Martín no estuvo
  conectado. Hipótesis en docs/hallazgos-crm.md: el «⋯» de la BARRA › «Buscar prospectos» navega.
- El VERDE de esta rama dio ROJO el 22/10 por `tests/ficha-editar-con-mako.test.ts`: `cambiar_tipo_etapa` dejaba afuera a
  `cambiar_ficha_funnel` al editar la ficha. Arreglado en la pista de «Editar» (`1a5a9d497`); por qué, en
  docs/hallazgos-api-mako.md.

**Hecho (cada uno con su test probado rompiéndolo):**
- «Kanban · Lista» juntos en un segmento, con «Kanban» y «Lista» en el tooltip: UNA pieza (app/_ui/SelectorVista.tsx) en
  el CRM, Clientes (y /admin) y el Plan. tests/crm-vista-iconos.test.ts.
- «Nuevo lead» salió del carril de cada columna y va al «⋯» de la columna (y a su clic derecho). tests/crm-feedback-21-10.test.ts.
- Clic derecho en una tarjeta → «Personalizar tarjeta»; en el fondo, «Personalizar tarjetas».
- «Asignar evento» con el calendario de línea (`evento` en app/_ui/iconos-menu.tsx), sin el logo de Meet.
- «Personalizar tarjetas» con PLANTILLAS en un pop-up de 1060 px (app/_ui/PersonalizarTarjetas.tsx, la pieza de todos los
  tableros): ocho del CRM y las propias de cada persona. tests/crm-tarjeta-personalizable.test.ts.
- «Tipo de etapa» (Etapa / Reunión / Nutrición) en el «⋯» y el clic derecho de cada columna, con lo que pasa antes de
  cambiarlo; no lo llevan la entrada, el cierre ni las terminales. tests/crm-tipo-etapa.test.ts.
- «Asignar evento»: crear (y asignar), editar nombre y duración, y conectar Calendly o Cal.com ahí mismo.
  tests/crm-eventos-crear.test.ts.
- La criatura de MaKo (la estrella) abajo a la izquierda y la barra que se abre a la izquierda, pegada a la sidebar medida.
  Desde el 22/10 (rama `crm-estrella-2210`, en C:/dev/wt-crm-estrella, que lleva la t3 adentro) es la pieza del Ops Center,
  `MakoEnLaTab`: lo escrito va al chat «Cerebro», las sugerencias van arriba del hilo y su número en la estrella. «Hacerlo»
  de una sugerencia de chat le escribe al Cerebro nombrando el CRM. `ChatMakoCrm.tsx` se borró. tests/sugerencias-crm.test.ts.
- Clientes y el Plan (con un agente, `06050cd20` y `a847aaed4`): las mismas plantillas (7 cada uno), «Personalizar
  tarjetas» en el «⋯» y el clic derecho, «Nuevo cliente» / «Nueva tarea» al «⋯» de la columna.
  tests/clientes-tarjeta-plantillas.test.ts y tests/plan-tarjeta-plantillas.test.ts.
- API de MaKo: `personalizar_tarjetas_crm`, `cambiar_tipo_etapa`, `crear_evento_agenda`, `editar_evento_agenda`,
  `ver_tarjeta_clientes`, `personalizar_tarjetas_clientes`, `ver_tarjeta_plan` y `personalizar_tarjetas_plan`.
  docs/api-mako.md y el snapshot, regenerados.

**No visto en pantalla:** el disco C: tenía 1,3 GB libres y la RAM 1,4 GB: no entra un build parcial (pide copiar
`node_modules`). Se mira al desplegar, en el ws3: /crm (el «⋯» de una columna, clic derecho en una tarjeta, «⋯» ›
«Personalizar tarjetas», «Tipo de etapa», «Asignar evento» de una reunión, la estrella abajo a la izquierda),
/customer-success y /plan (el segmento y «Personalizar tarjetas»). Tipos: el tsc acotado lo cortó el vigía de RAM.

**Sin hacer, con el archivo:**
- El server del chat propio del CRM quedó sin pantalla desde la estrella (22/10): `send`, `confirmar`, `cancelar` y
  `hilo=1` de app/api/crm/mako/route.ts, y `abrirDelCrm` / `turnoDelCrm` / `tarjetaDelCrm` de app/crm/mako-crm/chat-server.ts
  (con chat-reglas.ts). `chatDelRequest` sigue siendo la puerta de las sugerencias. Detalle en docs/hallazgos-crm.md.
- Google Calendar en «Asignar evento»: su API no expone las páginas de reserva. **Decisión de Martín** (C1 de
  docs/pedidos-crm.md): una regla por título + un barrido del calendario, o esperar a Google.
- El teléfono sigue los datos de la tarjeta pero no la forma (app/m/crm/TableroCrm.tsx dibuja filas).
- «Sin avance» en Clientes también esconde «Pago rechazado» (vive en la barra): **decisión de producto** (docs/hallazgos-customer-success.md).
- El teléfono no lee la elección en Clientes ni en el Plan (app/m/cs/CustomerSuccessM.tsx, app/m/plan/ListaPlan.tsx); la ficha
  de un cliente y /admin usan la tarjeta de siempre (FichaCliente.tsx, AdminView.tsx).
- `personalizar_tarjetas_crm` (lib/api-mako/areas/crm.run.ts) tiene su copia de la lógica; podría usar `pedidoDeTarjeta`
  (lib/plantillas-tarjeta.ts), como Clientes y el Plan.
- La Ticketera tiene «Tarjetas · Lista» como texto (app/tickets/decisiones/CambioVista.tsx): es un mazo, no un kanban; no
  se tocó.

## 0-Ω15. 17/10/2026 (chat «Pendientes B2: CRM y clientes», cuenta `claude4`): los pendientes del CRM del 17/10

Rama `pend-b2-1710` en `C:/dev/wt-pend-b2`. **Sin subir: la punta se le pasa al Cerebro.** El porqué de cada cosa, y
las trampas, en docs/hallazgos-crm.md («Los pendientes del CRM del 17/10»). Acá, qué quedó y qué falta.

**Hecho (cada uno con su test probado rompiéndolo):** `getFunnelDeLead` lee la casa del lead (y MaKo, `buscar_leads`,
dice la etapa de SU CRM); mover entre dos etapas abiertas no borra la venta (opción b del §5.3, decidida con criterio);
el «Deshacer» del historial no pisa lo que cambió otro y sus «no» llegan a la pantalla; `saveFunnelDe` no borra el
`data` con la lectura caída y es compare-and-set; un alta con funnel ajeno nace en el CRM del negocio; «Nuevo CRM» sólo
lo ve el admin y siembra sus etapas en el MISMO insert; el aviso al quitar una etapa dice cuántos leads tiene;
`pagina_registro` y `visitor_id` en «A revisar»; #856 (el «Calificado» espera el Deshacer y no se manda dos veces) y #893
(el lead que vuelve por otra campaña se suma a ese funnel); se borraron las server actions exportadas sin llamador (las
tres de ignorar a nivel lead y `crearProductoAction`); los siete bloques de la charla del Resumen (sólo lectura); el
historial de la ficha con «Volver a como estaba»; la ficha que edita MaKo se relee.

**Medido, nada que hacer:** CRM de webinar viejos (0), plazos viejos de etapa (0 funnels con `umbrales.porEtapa`).

**Sin hacer, con el archivo (para después del 20/10: el Cerebro cortó por consumo con la semana al 71%):**
- La T2 de la ficha: Reuniones y Tracking nativos (app/crm/lead-view/ficha/registro-reuniones.tsx,
  registro-tracking.tsx) y la tarjeta del kanban personalizable (app/crm/CrmBoard.tsx). Es una feature entera.
- El desplegable de hojas unificado con `MenuHojas` (app/crm/lead-view/LeadTabs.tsx): se ve en un navegador y no hubo.
- Convertir las filas viejas de `pendientes_ignorados` a la marca por dato y borrar la columna: una migración de datos
  de clientes; la lectura vieja sigue viva en el tablero.
- Los bloques de la charla con acciones (mandar, contestar): cada una es una puerta nueva a un envío.
- Mirar la ficha en producción y en un iPad: sin navegador conectado el 17/10.
- **Decisión abierta que sigue siendo de Martín: §5.1** (ganar en un producto agregado no marca ganado al lead). De ella
  depende la invitación al curso en un segundo producto (docs/relevo/customer-success.md).

## 0-Ω18. 20/10/2026, noche (chat «CRM», cuenta `claude4`): la tanda de Martín del 20/10 sobre el CRM

El pedido, literal, está en la bitácora del CRM (hito `actor: 'martin'` de las 19:11): «No veo el chat con MaKo que te
había pedido», «las columnas no sean invisibles», «las cards… personalizar», «"Tablero y lista" solo con íconos» y «¿está
asignar un evento a una etapa de reunión?». **TODO lo que Martín pidió para el CRM y su estado: docs/pedidos-crm.md**
(265 pedidos: 242 hechos, 13 parciales, 9 no hechos, 1 sin confirmar; «Lo que falta, en orden» al final).

Hecho hoy, sin subir (rama `crm-ficha-v2`):
- `dae7de4fc` · las columnas se ven: `--fondo-columna` (el 18/10 quedaron en `--surface-2`, el mismo gris que la página).
- `10fc93059` · «Tablero» y «Lista» sólo con íconos, con tooltip.
- `44f14b087` · el chat con MaKo como barra fija a la derecha (estaba DEBAJO de la sidebar abierta).
- `88daad475` + `5cb1e334a` · «Personalizar tarjetas» en el «⋯», por persona; el teléfono sigue foto, plata y canal; API
  `ver_campos_tarjeta_crm` (sólo app, sólo lectura).
- «Asignar evento» ya estaba (`c7f7b5609`, 16/10): Calendly y Cal.com, en el «⋯» de una etapa de reunión.

**No visto en pantalla** (sin RAM para el build). Se revisa en /crm: las columnas con su bloque, la barra de MaKo a la
derecha (y su pestaña plegada), los íconos de la vista y «⋯» › «Personalizar tarjetas».
**Siguiente:** cuando `app/_chat/CajaChat.tsx` (rama `chat-unico`, de Ops Center 3) llegue a main, cambiar el chat de
adentro de la barra (`PanelMakoCrm.tsx` monta `ChatMakoCrm`). El resto, en «Lo que falta» de docs/pedidos-crm.md.

Después, la misma noche (B2, 2 de 5): «Pago rechazado» / «Cuota vencida» en la tarjeta de un cliente (computadora y
teléfono, una lectura para la cartera: `app/customer-success/cobro-tarjeta.ts`) y la cara del cliente en el teléfono
(`CaraCliente`, misma cadena que la computadora). Test `tests/cs-tarjeta-cobro.test.ts`. No visto en pantalla: se revisa
en /customer-success (una tarjeta con un cobro fallido) y en /m/cs (las caras).

D4 completo (20/10, noche): las sugerencias de MaKo suman el mismo mensaje a 3 leads de una etapa (sin WhatsApp: no sabe
quién escribió), la landing o campaña sin CRM y el lead que vuelve a la landing o mira el VSL dos veces. Van por el chat
(no hay plantilla para ninguna). D5 espera a que el pedido B de Automations llegue a main (lo avisa el Cerebro).

B1, primera parte (20/10, noche): las columnas del Plan se renombran (clic en el nombre o «⋯» › «Cambiar el nombre»,
sólo el admin), por negocio, en la computadora, el teléfono y MaKo. Segunda parte, la misma noche: agregar y quitar
columnas PROPIAS desde el «⋯» (un paso dentro de un estado; la tarea guarda `columna`, mig 0317, que aplica el Cerebro
al integrar). B1 queda Hecho. No visto en pantalla: se revisa en /plan («⋯» de una columna › «Agregar columna»,
arrastrar una tarea ahí y quitarla).

## 0-Ω17. 20/10/2026 (chat «CRM», cuenta `claude4`): Chats lento, EN PRODUCCIÓN (run 165)

Lo vio Martín en la llamada con Leila del 19/10 (minuto 55:12). Arreglo `b7817fe9f` (+ `87464faa8`), VERDE `3107dbeca`.
Medido en el ws1 sólo con GET: la lista entera 17,4 → 4,1 s; la primera vista (3 páginas) ~2 s; el sondeo de 15 s ya
no relee todo. Detalle y números en docs/hallazgos-comunicacion.md. **Se revisa en /chats** (el ws3 y el ws9 no tienen
mensajes en el espejo: ahí abre rápido igual; el volumen está en los negocios con WhatsApp).

**SIGUIENTE (lo de raíz):** que la base devuelva el ÚLTIMO mensaje por conversación en vez de barrer todo el espejo
(`wa_mensajes`, 18.885 filas en el ws1): una vista o una función con `DISTINCT ON` por teléfono (los últimos 10 dígitos,
como `claveTel`), con el conteo y el `lead_id`. Es una migración: **la numera el Cerebro**. Quien lo encare reemplaza la
lectura de `getConversacionesNoOficial` (lib/evolution-mensajes.ts) y mide con el cronómetro de fetch (como se midió en
hallazgos-comunicacion). Lo que queda mientras tanto: una conversación más vieja que 3 páginas aparece con la lectura
completa, unos segundos después de abrir.

## 0-Ω16. 18/10/2026 (chat «CRM», cuenta `claude4`, al 91% semanal): el feedback del 18/10 (pts 14, 8 y 9)

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`. **Sin subir: se le pasa al Cerebro.** El pedido entero está en
docs/feedback-18-10.md (rama del Cerebro, `C:/dev/wt-push-q`).

- **Cliente roto, arreglado (`cd6a4e78b`, VERDE `5489c21a9`, sha ya pasado):** /clients mostraba la tarjeta sin estilos
  para todos los negocios. Cada componente del kit monta ahora sus estilos (hallazgos-ui).
- **Clients (pt 14, `44b4b111b`):** sin el título ni el número de clientes; sin el desplegable del servicio («Editar
  etapas» pasó a los tres puntos); la cabecera sobre el fondo de MaKo con la cuadrícula de puntos.
- **CRM (pt 8, `772ed2a14`):** la columna con un bloque de fondo visible y alto mínimo, el mismo en los tres tableros
  (`FONDO_COLUMNA`); «Próximo» plegado, lo abre el ícono del calendario (sin reunión por delante, sigue la lista).
- **Plan (pt 9, `ad2bac4b6`):** la tarjeta sin prioridad, sin origen y sin el aviso del deadline; se completa con un
  check gris a la derecha, al lado del tacho.

**No visto en pantalla** (RAM en 2 GB, un proceso pesado a la vez): nada de lo de hoy. Mirarlo al desplegar, en el ws3
o el ws9: /clients (la tarjeta con estilos, sin título ni desplegable, el fondo), /crm (columnas y «Próximo») y /plan.

**Sin hacer (con su archivo):** el nombre VIEJO del servicio («VSL FUNNEL») sigue guardado: el producto no sigue al
funnel renombrado; ya no se ve en Clients, pero el dato está mal (`productosDeLaEntrega` en `app/customer-success/entrega.ts` lee
`productos.nombre`). Crear un servicio nuevo ya no se puede desde Clients (se crea como producto en el CRM). El Plan del
TELÉFONO sigue completando con el círculo (`app/m/plan/ListaPlan.tsx`): decidir si también va al check. Las columnas
editables del Plan, después del 20/10.

## 0-Ω15. 17-18/10/2026 (chat «CRM», cuenta `claude4`, al 85% semanal): la familia de tarjetas en CRM, Clients y Plan

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2` (node_modules COPIADO de verdad, no enlace: la limpieza de disco lo había
vuelto a enlazar). **Sin subir: se le pasa al Cerebro.** Pedido de Martín del 17/10 22:40, punto 8 (prototipo
docs/prototipos/coherencia-1710.html). Commits: `de3be68bb` (CRM computadora + el kit), `3b1f3a742` (CRM teléfono +
KanbanM), `134cd221c` (Clients), `ffe362733` (Plan), `a75a5b0de` (tests) y el de la cosecha.

**Qué cambia al desplegar (todos los clientes):** las tarjetas de CRM, Clients y Plan, en computadora y teléfono, pasan a
la familia (cara con insignia, nombre, subtítulo, «Ver info»; la tarea con el círculo de prioridad que completa); «Ver
info» abre una ficha rápida con «Mover a…»; «Próximo» arriba del CRM; las etapas del teléfono con su nombre; columnas
redondas. **En el teléfono, tocar una tarjeta del CRM abre la ficha rápida** (antes, la completa).

**Sin hacer (con su archivo):** «Pago fallido» en la tarjeta de un cliente (el cobro no llega al tablero:
app/customer-success/aviso-tarjeta.ts); la foto de Instagram (no se guarda); la vista «Prioridades» del Plan
(`TarjetaPrioridad`) y el tablero de Proyectos del teléfono; la foto de un cliente en el teléfono (`ClienteCs`).
Lo de antes sigue: medir el pop-up en producción.

**Visto en el ws3** (build parcial + `next start`, sesión firmada, a 1440): el tablero del CRM con las tarjetas, la ficha
rápida y «Mover a…» (se arreglaron el paso, los rellenos y la negrita: `42358d5a8`). **No visto:** Clients (/customer-success
daba 404 en el build parcial), el Plan (pide «Migra tu Plan a la nube» en un perfil nuevo: no se tocó, escribe en
producción) y todo el teléfono (/m/crm entra en un bucle de redirecciones con un build parcial). Mirarlos en el ws3 al
desplegar. VERDE `42358d5a8`.

**18/10, ya en producción (run 137), la segunda pasada** — sin el Chrome de Martín conectado, con el build parcial y
`next start -H localhost` (con `-H 127.0.0.1` Next trata el rewrite del teléfono como externo y arma el bucle: está en
hallazgos-mobile). **En el ws9, no en el ws3**: el ws3 tiene el onboarding PENDIENTE y tapa Clients, el Plan y todo el
teléfono (también en producción); y **sin escribir nada**: el navegador cortaba todo pedido que no fuera GET, así que el
círculo del Plan se probó por el POST que intenta mandar (`/api/plan-board`, computadora; la acción de /plan, teléfono).
Visto bien: /m/crm a 390 con las píldoras por etapa, la ficha rápida y «Mover a…»; Clients del teléfono con la barra;
More con la barra CRM · Chats · Dashboard · Plan · More. **Roto y arreglado:** el círculo del Plan invisible y las
iniciales del teléfono sin color (los tokens del kit no llegaban a las piezas sueltas: hallazgos-ui). **No visto:** Clients
en la computadora (su panel pide una API que el build parcial no tiene). **De otros (no tocado):** More, en el build parcial, deja dos huecos
en blanco entre la cuenta, Ops Center y Dashboard sheets. Y en producción, los teléfonos de verdad reciben 200 en /crm,
/plan, /clients, /mas, /chats y /general (registros de Vercel, 24 h: 1.307 pedidos).

## 0-Ω14. 17/10/2026 (chat «CRM», cuenta `claude4`): las seis tarjetas de la revisión de las llamadas del 16/10

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`. **Sin subir: cada punta se le pasa al Cerebro.** El orden lo dio el
Cerebro (detalle de cada una en C:/dev/auditoria-1610.json, por `num`):
- **#854** `8c160becf`: «Calificado» se pinta al tocarlo; el aviso a Meta va de fondo (`after()` en `updateLead`).
- **#897** `2cfe12c5d`: la mitad de «Firmado» que faltaba, DESCARTADA con el porqué (docs/hallazgos-pagos.md). Lo
  principal (cada pago con su funnel, mig 0310) ya estaba en producción desde el run 87.
- **#893** `7096f40c1`: una campaña o un conjunto de Meta va a uno o varios funnels (`meta.campanas.tambien`); la celda
  «Producto» con casillas; MaKo: `ver_campanas_funnels` y `asignar_campana_funnels`.
- **#856** `5a1f4949b`: investigado con fuentes oficiales — lo enviado a Meta no se corrige (docs/hallazgos-ads.md).
- **#880** `c3f0d449e`: las plantillas del Resumen arrancan con lo esencial («Antes de la llamada» 18 → 13).
- **#844** `886318974`: el buscador de Instagram dice por qué no encuentra; por nombre no hay fuente gratis.
- Cosecha: `f0a1d5565` (docs/hallazgos-crm.md, «Lo que dejó la revisión del 16/10…»).

**Cuando el Cerebro diga que están en producción:** el «Ya está» en el chat, el hito «Hecho» en
app/admin/dev/crm/bitacora.ts (con `revisar` y `sesion`) y cerrar cada tarjeta en el Plan con su prueba.

**Sin hacer (con su archivo):** el envío a Meta que espere el «Deshacer» (lib/leads.ts); el lead que vuelve por otra
campaña no se suma a sus funnels (lib/leads.ts, rama `existing`); las plantillas de Pagos (lib/ficha/plantillas-pagos.ts,
apagar avisos es otra decisión); buscar Instagram por nombre necesita una fuente paga (app/api/crm/instagram-buscar).
**«Llevar a MaKo Partners» HECHO en la rama (17/10, tarde):** el menú de un lead en el tablero y el «⋯» de la ficha
abren la ventana de Clients (`ModalLlevarAPartners`); con `leads.cliente_ws`, «Ver en MaKo Partners» → /partners?cuenta=<ws>.
Lo decide `ofrecePartners()` (app/crm/partners-crm.ts): agencia Y su admin, la regla de /partners. Test: tests/crm-partners.test.ts.
La API ya tenía `llevar_a_partners` (área cs).

## 0-Ω13. 17/10/2026 (chat «CRM», cuenta `claude4`): el feedback del 16/10 hecho, en la rama `crm-ficha-v2`

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`, con origin/main mergeado (20b19dc5f). **Sin subir: se le pasa al Cerebro.**
Commits: `e92688cd2` (Pagos, la épica por `props.epico`), `6574b28b5` (las tabs como HOJAS), `fa9192e96` (`ver_funnel`
con `embudoId`, #898), `bdb403e7f` («Editar» con MaKo, el «⋯», el lead de ejemplo) y el de esta cosecha.

**Qué cambia para Martín y los clientes al desplegar:**
- La fila de pestañas de la ficha se fue: arriba va el nombre de la hoja con su ▾, a la altura del nombre del lead, y el
  desplegable es el del Dashboard («＋ Nueva hoja» primera, cada hoja con su ⋮). El nombre se cambia en el título.
  «Nueva hoja» crea una hoja propia del funnel (con un template de cualquier tab, con la caja de MaKo o en blanco).
- Los templates muestran la tab de verdad en chico, con los datos del lead; la plantilla de toda la ficha es otra fila
  de templates. La barra lateral de «Editar» se fue.
- «Editar» abre a la izquierda el chat de MaKo para editar la vista; el «⋯» suma «Exportar (PDF)» y «Guía de edición».
- «A revisar» sin leads: el engranaje abre un lead de ejemplo con «¿Ignorar siempre?». El modal de interruptores se borró.
- El AI Analyst a 1024 ya no aplasta la ficha.
- La API de MaKo: `cambiar_ficha_funnel` crea, borra y mueve hojas (`nueva_hoja`, `quitar_hoja`, `mover_hoja`) y
  `ver_funnel` lee las etapas de cualquier CRM con `embudoId`.

**Mirado en el ws3** (build parcial + `next start`, sesión firmada, escritorio y 390 táctil; receta y trampas en
docs/hallazgos-crm.md, «Las tabs como HOJAS…»): la cabecera con el título alineado, «A revisar» y su engranaje,
«Asignar evento» (vacío: el ws3 no tiene Calendly), el AI Analyst a 1440 y 1024, el chat del CRM a la izquierda con el
muñeco, el desplegable de hojas, «Editar» con el chat y la guía, los templates y «Nueva hoja». **No se pudo mirar**: la
ruta /crm/[id] (404 sólo en el build parcial) y nada en producción (la extensión de Chrome no conectada en la cuenta 4).

**SIN HACER, en este orden (con su archivo):**
1. **Medir el pop-up en producción** (punto 4): en local, ~1,3 s del clic a la ficha, ~1,2 s es `getLeadFullAction`
   (app/crm/actions.ts). Si en producción sigue lento, partir esa action con tiempos por lectura.
2. ~~Google Calendar en «Asignar evento»~~ (punto 3): **decidido que no**, porque la API de Google no expone las páginas
   de reserva ni de cuál viene una reserva; el modal lo dice (docs/hallazgos-crm.md, «Las tabs como HOJAS…» §6).
3. ~~#897: que cada pago guarde de qué funnel es~~ **Hecho en la rama** (mig 0310 escrita, SIN APLICAR: aditiva, da igual
   antes o después del deploy; `node scripts/apply-migration.mjs supabase/migrations/0310_pagos_funnel.sql`). Ver
   docs/hallazgos-pagos.md, «Cada pago guarda de qué funnel es».
4. **T2 de la ficha v2**: Reuniones y Tracking rehechos, y la tarjeta del lead en el kanban personalizable (§0-Ω11).
5. Los pendientes de la cosecha del 17/10 (unificar el desplegable con `MenuHojas`,
   releer la ficha cuando MaKo la cambia desde el chat, las hojas propias en el teléfono).

## 0-Ω12. FEEDBACK DE MARTÍN DEL 16/10/2026 a la tarde — LO PRIMERO PARA QUIEN SIGA

Diez puntos sobre la ficha, «A revisar», el renombrar un CRM, «Asignar evento» y el chat del CRM, textuales y con
su archivo, en **docs/feedback-16-10-crm-onboarding-second-brain.md**. Cerebro hizo lo simple (`9f595cc6f`: «Asignar campañas» con el logo de Meta, «A revisar»
con basurero rojo e «Ignorar todos», «Revisar» abre el «Ver», cabecera sin «Sin empresa» y con la foto de 88). El
resto (puntos 1, 3, 4, 5, 6, 7, 8, 9 y 10) va antes que la T2 de abajo: el 5 cambia cómo se cambia de tab (como las
hojas del Dashboard) y el 10 saca «Personalizar» y la tab «MaKo Analyst».

## 0-Ω11. CIERRE del 16/10/2026 ~12:00 (chat «CRM», cuenta `claude3`, al 96% semanal): qué quedó y cómo se retoma

Se cerró por el umbral del 95%. Ningún agente quedó corriendo; el worktree está limpio.

**EN PRODUCCIÓN (lo subió Cerebro):**
- La ficha por bloques (armador de b1) — run 30.
- El marco de la ficha v2 (galería por tab con «Sugerido», «¿Qué vas a crear hoy?» la primera vez, renombrar con
  doble clic, vista épica, `armar_tab_ficha`) — run 42, `8f8d9809c`.
- La etapa de reunión ↔ evento de Calendly/Cal.com, el MOTOR (sin pantalla: se vincula por la API de MaKo), con la
  mig 0293 aplicada — run 33.
- La tab Pagos en bloques, del chat Pagos (runs 34 a 38, mig 0295).

**LISTO PARA SUBIR, sin subir:** rama `crm-ficha-v2`, punta `38317b6bc`, en `C:/dev/wt-crm-ficha2`: el Resumen NATIVO
(§0-Ω9) y su verificación (§0-Ω10), con main mergeado. Se le pasó a Cerebro, que es el único que sube. ⚠️ Al
desplegar, el Resumen de TODOS los funnels que nadie tocó cambia de diseño (a propósito), también en el ws 1.

**SIN HACER, en este orden, con cómo se retoma:**
1. **T2 de la ficha v2: Reuniones y Tracking rehechos, y la tarjeta del lead en el kanban personalizable.** El
   script de la corrida está en el scratchpad de la sesión e86e3994 (`wf-ficha-v2-t1b-t2.js`, run
   `wf_11c85ef0-999`): relanzarlo con `resumeFromRunId` saca de caché el Resumen y la verificación T1 y sigue por
   «reuniones-y-tracking» (se cortó a los segundos de arrancar; no dejó nada). Si el scratchpad ya no está, los
   prompts se rearman con este relevo y docs/diseno-ficha-bloques.md. De a un agente (RAM).
2. **T3: la tab Pagos de Customer Success, de a dos con el chat Pagos.** CS sigue montando DealDetailsCard; cuando
   pase a bloques, se borran juntos DealDetailsCard, EditarDeal, `?edit=1` y «Completar con IA»
   (docs/hallazgos-pagos.md §4).
3. **La PANTALLA de la etapa ↔ evento de agenda** (elegir el evento en el pop-up de etapas, app/crm/EtapasModal.tsx)
   y su revisión: run `wf_03f40761-f44`, worktree `C:/dev/wt-crm-agenda` (mergear main antes). El contrato de la
   pantalla está en `app/crm/agenda-evento-actions.ts` y en la cabecera de lib/agenda-evento-etapa.ts.
4. **Avisarle al chat Pagos** que `epico` ya está en PropsBloque: puede sacar el cast `(props as { epico?: boolean })`
   de app/crm/lead-view/ficha/registro-pagos.tsx (su sesión no estaba al cerrar).
5. **Mirar con datos reales** (nadie lo hizo: no hubo RAM para `next dev`): el ws 3 con sesión de super admin, el
   pop-up y /crm/2615 y 2664 a 1440, 1024, 820 y 390, «Personalizar», la galería y la caja contra la IA de verdad, y
   el teléfono con user-agent de iPhone.
6. Lo que dejaron sin hacer los frentes, con su archivo: §0-Ω9 y §0-Ω10 (bloques del Resumen sin componente, el
   Deshacer del historial y el de CS todavía a ciegas, el setter/closer repetidos en ReunionesCard hasta la T2).
## 0-Ω10. 16/10/2026 (frente «verificación» de la tanda 1 de la ficha v2, cuenta `claude3`): mirada y revisada

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`. Con 4,8 GB libres no se levantó `next dev`: se miró en el BANCO (las dos
puertas reales con datos de mentira) a 1440, 1024×768 y 820×1180 táctiles y 390×844, el pop-up y /crm/[id]: la primera
vez (la caja y la galería con «Sugerido»), elegir, la épica, renombrar una tab, «Personalizar» con Opciones, cada bloque
del Resumen normal y épico, la tab Pagos del chat Pagos montada, y el teléfono (banco nuevo con las filas del Resumen).

**Qué cambia para Martín y los clientes al desplegar (además del 0-Ω9):**
- Ningún funnel pierde la web, el Instagram ni el ingreso estimado del Resumen: cinco plantillas de entrada (Evento,
  Formulario de Meta, Landing, Te escriben y Carrito) los habían dejado afuera al partir el contacto en bloques.
- «De dónde vino» en una línea dice también la campaña y el conjunto, no sólo el anuncio.
- «Deshacer» de un campo de la ficha no pisa lo que otra persona cambió en esos 5 segundos: avisa «Alguien ya lo cambió».
- En la tablet, el contacto pone el rótulo arriba cuando su tarjeta es angosta (el email ya no sale de a tres letras),
  los tres botones de la calificación no se cortan, y el motivo de salida entra como texto (los chips siguen eligibles).

**SIN HACER (con su archivo):**
- Mirarlo con datos reales en el ws 3, con 5 GB libres (receta en docs/hallazgos-crm.md → «La ficha por bloques MIRADA
  por primera vez»).
- El Deshacer del historial (`revertAuditChangeAction`, app/crm/actions.ts) y el guardado de InfoPrincipalCard (Customer
  Success) siguen a ciegas.
- La fila «Redes» del teléfono no sigue las Opciones del bloque (app/m/crm/ficha-bloques.ts, `resumenDelTelefono`).

## 0-Ω9. 16/10/2026 (frente «Resumen» de la ficha v2, cuenta `claude3`): el Resumen NATIVO

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`, sobre main `2f913cddc` (el marco del 0-Ω8 ya está en main). Martín,
16/10: «completamente diferente en diseño y funcionalidad... NO tengas miedo a ELIMINAR todo lo que existe hoy... Los
datos de los leads se van a guardar». Referencias: los «Highlights» y los «Record details» de Attio y la columna del
medio de HubSpot (documentación oficial; no se entró a las apps); la épica, General y MaKo Mobile v3.

**Qué cambia para Martín y los clientes al desplegar:**
- El Resumen ya no son las tarjetas de antes: cada bloque es una pieza propia que se lee de un vistazo y se corrige
  en el lugar (con «Deshacer» y su línea en el historial, los mismos campos de siempre). Arriba, los datos de un
  vistazo (calificación con tres botones, cuánto lleva en la etapa contra su plazo, el ingreso estimado); después la
  próxima reunión (día, hora, cuánto falta, «Entrar», y «¿Vino?» cuando pasó), el setter y el closer, el contacto
  como lista de propiedades o con la botonera Llamar · WhatsApp · Email, lo que contestó (ahora también lo de la
  agenda), de dónde vino, las notas y, si salió, el motivo con sus categorías.
- Bloques nuevos con datos de hoy: la siguiente acción (la reunión sin marcar, la que viene, el próximo paso de la
  llamada, lo que sigue según MaKo o los datos que faltan, con su botón), las fichas parecidas (mismo email o
  teléfono), cuánto lleva en la etapa, el setter y el closer, la página donde se registró, cómo entró por
  Instagram/Messenger, la respuesta destacada, la dirección y el sexo.
- Cada bloque tiene su versión ÉPICA (un número o una frase protagonista, sin metadata).
- La galería del Resumen: «Antes de la llamada», «Antes del evento», «Lo que contestó», «Su registro», «La charla»,
  «Para prospectar», «Si compró», «Épica», «Para llamarlo» y «Completa», con «Sugerido» la de su tipo. Un funnel sin
  tocar ve la suya (la ficha cambia de diseño para todos: a propósito).
- Personalizando, «Opciones» en la barra del bloque: qué redes van, qué fuentes de respuestas y qué pregunta se
  destaca. MaKo lo hace también (`cambiar_ficha_funnel`, cambio `opciones`).
- El teléfono suma una fila por bloque nuevo (siguiente, equipo, calificación, en la etapa, ingreso, motivo, plazo,
  redes, página, cómo entró, dirección, sexo).

**Tests:** el barrido de lo tocado (los tests del área, la API de MaKo, el teléfono y los guards que barren el repo):
5.618 de 5.620 en verde, 0 fallos (2 skipped). tests/ficha-resumen.test.ts nuevo y 15 reescritos porque leían las
tarjetas que se fueron, con sus roturas medidas. El tsc fue el ACOTADO (`scripts/tsc-acotado.mjs`, en tandas de 8 a 24
archivos: con 3 GB libres, una de 82 la mató el vigía). Mirado en un banco (las dos puertas reales con datos de
mentira) a 1440, 1024 táctil, 820×1180 táctil y 390 táctil, normal, épica y un lead perdido; «Opciones» probado de
punta a punta (manda UN cambio `opciones`).

**SIN HACER (con su archivo):**
- Los bloques del Resumen sin componente: `pase-a-humano`, `cambios-de-mako`, `charla-whatsapp` (tienen datos: son
  los siguientes), `charla-dm`, `mensaje-listo`, `automatizaciones-en-curso`, `lo-que-le-mandamos`
  (app/crm/lead-view/ficha/registro-resumen.tsx).
- Sacar de ReunionesCard el setter y el closer, el chip de la calificación y lo que contestó al agendar, que ahora
  están también en el Resumen (tanda 2, app/crm/lead-view/ReunionesCard.tsx); y el bloque `cohorte` de Reuniones
  (hoy la dibuja el contacto).
- Unificar la siguiente acción del teléfono con la de escritorio (app/m/crm/reglas.ts vs resumen/logica.ts).
- Mirarlo con datos reales (verificación de la tanda 1).

## 0-Ω8. 16/10/2026 (frente «marco» de la ficha v2, cuenta `claude3`): cada tab personalizable

Rama `crm-ficha-v2` en `C:/dev/wt-crm-ficha2`, sobre main `81b966b86`. Martín, 16/10: «Sobre todo que sea
PERSONALIZABLE, como tenemos en dashboard o general cada tab... templates para "resumen", "tracking" y todas las
tabs... cambiar el nombre de las tabs internas... que se pueda ver "epico"... Si nunca configuró una tab... que le
salten los templates y el ¿Qué vas a crear hoy?». Referencias: «Nueva hoja» del Dashboard (la caja y la galería), la
documentación de HubSpot para mirar una plantilla con un registro de verdad, y Google Sheets para renombrar con doble clic.

**Qué cambia para Martín y los clientes al desplegar:**
- Cada tab (Resumen, Tracking, Reuniones, Pagos) tiene su galería: «En blanco», la sugerida para el tipo de funnel
  con «Sugerido», una ÉPICA y las de hoy partidas por tab. Elegir una cambia SÓLO esa tab, para todo el funnel.
- La primera vez que un admin entra a una tab que nadie configuró, en su lugar sale «¿Qué vas a crear hoy?» (la caja
  de la casa: MaKo arma la tab con un pedido, con la red barata) y las plantillas. Tocar una la MIRA con los datos de
  ese lead; «Usar» la guarda; «Ahora no» deja la sugerida. Un no-admin ve la sugerida, como hasta hoy.
- Personalizando: doble clic en una pestaña la renombra (la clave `?tab=` no cambia), «Plantillas» abre la galería, y
  el panel tiene «Esta tab» (nombre, plantilla, vista épica, volver) y «Toda la ficha».
- La vista épica: un titular gigante (el nombre de la tab), dos bloques por fila como mucho en escritorio y uno en la
  tablet, más aire. Cada bloque recibe `epico` (el contrato con Pagos).
- La API de MaKo: `cambiar_ficha_funnel` suma `nombre` y `epica` y la plantilla de una tab (`plantilla` con `tab`);
  `armar_tab_ficha` (nueva) arma una tab con un pedido, con confirmación y sólo el admin.
- Un funnel que nadie tocó se ve igual que antes en Resumen, Tracking y Reuniones (la de entrada es la lista de hoy);
  en Pagos, con la plantilla de Pagos sugerida para su tipo (las del chat Pagos, que llegaron con el merge de main).

**Tests:** los de la ficha, la API y los guards que leen el fuente (1.947 en el barrido de lo tocado) en verde; dos
archivos nuevos (tests/ficha-tabs.test.ts, tests/ficha-galeria.test.ts) probados rompiéndolos. El tsc fue el ACOTADO.

**SIN HACER (con su archivo):**
- Mirarla en el ws 3 con datos reales y la caja contra la IA de verdad (en el banco la ruta iba simulada).
- La épica por dentro de cada bloque: Pagos (registro-pagos.tsx). La del Resumen, hecha (0-Ω9).
- Las plantillas de Pagos ya están (el merge de main trajo las cuatro del chat Pagos): la tab Pagos de un funnel sin
  tocar es la sugerida para su tipo. Mirarla con datos reales (registro-pagos.tsx, lib/ficha/plantillas-pagos.ts).
- La tarjeta del lead en el kanban personalizable (tanda 2).

## 0-Ω7. 16/10/2026 (chat «CRM», cuenta `claude3`): la PANTALLA de la ficha por bloques, lista para subir

Rama `crm-armador` en `C:/dev/wt-crm-armador` (el código, hasta `6b6c2ea8b`), sobre `crm-avisos-funnel` (ya en main).
Es el armador de b1 (el WIP `3eb46606a`) terminado por la corrida `wf_e3cc574c-723`, de a un agente: escritorio,
celular, navegador y revisión de lo invisible. Copia el editor del Dashboard (Looker) con su selector de dispositivo;
para «por funnel», la documentación de HubSpot (no se abrió la app).

**Qué cambia para Martín y los clientes al desplegar:**
- La ficha (pop-up y /crm/[id]) es UNA pieza, por bloques. Con la plantilla de respaldo se ve como antes; el origen
  pasa al Resumen y la cohorte a Reuniones, como decide el diseño, y los engranajes del Resumen y de «Datos sin
  marcar» se van.
- «Personalizar» (sólo admin): agregar, quitar, mover, ancho, diseño, ícono; el panel con la plantilla, el estilo y
  los avisos del funnel; guarda solo con «Deshacer»; Escritorio · Tablet · Celular. No aparece en un celular.
- Tablet: dos bloques por fila como mucho y toques de 44 px. Teléfono (/m): la ficha sigue a la del funnel y dice
  «N sin marcar» como la computadora; «Próxima llamada» y «Última llamada» se callan donde el bloque no va.
- «Información principal» pasa a una columna cuando la tarjeta es angosta (también en la ficha de CS).

**Tests:** el barrido final de la revisión, 466 archivos: 5.575/0 (1 skipped). Sin migraciones. El tsc fue el
ACOTADO; el completo lo corre el pre-push.

**SIN MIRAR con datos reales:** no hubo RAM para `next dev` (1,3 a 4,9 GB libres). Se miró en un banco (las
puertas reales con datos de mentira) a 1440, 1024, 820 y 390. Falta, en el ws3 con sesión de super admin: el pop-up
y /crm/2615 a esos tamaños, «Personalizar» de punta a punta (y al terminar, `data->'ficha'` en null en los funnels
8 y 30), el teléfono con UA de iPhone y un iPad de verdad (el arrastre con el dedo no se probó).

**SIN HACER (con su archivo):**
- Tanda B2: los bloques que no existen como tarjeta, los 12 de Pagos sueltos, la salida de «Editar deal →», CS con
  su plantilla fija, el DM desde la ficha y el coaching (app/crm/lead-view/ficha/registro-<tab>.tsx).
- `crm.resumen.campos` se quedó sin quien lo cambie (se fue ResumenModal): nadie puede prender LinkedIn, YouTube,
  dirección o sexo hasta que esos bloques tengan componente (lib/resumen-ficha-config.ts).
- Las opciones por bloque (redes, fuentes, pregunta) no se eligen en ningún lado (Armador.tsx, lib/ficha/api.ts).
- «Deshacer» no tiene op en la API y la ficha no tiene historial (hace falta una tabla).
- `saveFunnelDe` escribe `funnels.data` sin compare-and-set: puede pisar la ficha (lib/funnels.ts).
- El alta y la importación escriben el funnel que manda el navegador sin validarlo (app/crm/actions.ts).
- Clonar la configuración copia la ficha del dueño al cliente nuevo: decidir (lib/clonar-config.ts).
- En un iPad parado el panel de «Personalizar» queda debajo de la ficha, y la barra de edición se va con el scroll
  (ficha-css.ts).
## 0-Ω6. 15/10/2026, 21:30 (chat «CRM», cuenta `claude3`): la tanda B EN PRODUCCIÓN, y lo que se vio

**En main desde `24c0ad441`** (deploy Ready, lo subió el coordinador). Las migraciones, en su orden:
`0290` y `0292` aplicadas ANTES del deploy y verificadas en el catálogo (6/6 columnas, 2/2 checks); `0291`
DESPUÉS, y **tocó 0 leads**: `ig_conversaciones` sigue con 0 filas, como el 09/10. Es idempotente, así que no
hace falta volver a correrla: los leads de Instagram nuevos traen el @ desde el alta.

**La pasada en producción** (sesión de super admin de Martín en el ws9, sin ver como ningún cliente; antes,
`/api/auth/me`): la página y el panel lateral de la ficha muestran lo mismo, «N sin marcar» sigue la plantilla
del funnel (Prospección no pide «calificado» ni el deal), «Nuevo CRM» muestra los 12 tipos (abierto y
cancelado), sin errores de consola. **De la «ficha por bloques» sólo está el MOTOR**: el armador (los bloques y
«Personalizar») sigue en el WIP `3eb46606a` y la ficha se ve igual que antes. Pagos (b2) no se pudo mirar: el
ws9 no tiene leads en una etapa de cobro y no se movió ninguno para verlo.

**Arreglado en `855160673`:** el panel «Avisos de datos sin marcar» de la ficha leía y guardaba los del NEGOCIO;
ahora los del funnel del lead (docs/hallazgos-crm.md, «Lo que quedó medido de las cinco ramas»).

**SIN HACER:** el armador de b1 (`3eb46606a`, «WIP — NO INTEGRAR») y b5 (`lib/flujo-ia.ts`, de Automations).
## 0-Ω5. 15/10/2026 (chat «CRM», cuenta `claude3`): la tanda B INTEGRADA en `wt-crm-int`, lista para subir

**Punta: `8ecb233d7`** en `C:/dev/wt-crm-int` (b4, b3, b1 y b2, con main del 15/10 mergeado — merge, nunca rebase).
La sube el coordinador («Estrategia 3 cuentas»). b5 queda afuera a propósito: toca `lib/flujo-ia.ts`, que es de
Automations.

**Lo verificado antes de pasarla:**
- `asegurarLeadDelNegocio` está antes de los CINCO inserts a `pagos` (la reconciliación la tiene en `reconciliarYGuardar`,
  su único llamador; `saveCuotasAction` la llamaba dos veces seguidas y queda una). La rama de Pagos era anterior a la
  auditoría del 14/10; sin la guarda, una cuota podía escribirse en el CRM de otro cliente.
- `tests/seguridad-crm-pagos-doc.test.ts` al día sin aflojarlo (7/0, probado rompiéndolo): el hijo corre con una sesión
  del negocio A, un caso nuevo mide el corte SIN sesión, y el barrido exige la guarda en cada llamador de una función
  privada que inserta. Los cuatro rojos no eran agujeros (el detalle, en el commit `4fe929f34`).
- Los tests del área (pagos, cobros, cobranza, CRM, API de MaKo, seguridad, leads, funnel, ficha): 1064/1064. Los guards
  que barren el repo: verdes salvo uno que viene de MAIN (abajo). El apidoc: al día. El tsc completo lo corre el
  pre-push de quien sube (con 12 chats el lock no juntaba la RAM; el acotado lo cortó el vigía).

**Las migraciones, y su ORDEN (cada cabecera lo dice):**
- `0290_lead_entrada` — ANTES o junto con el deploy (si llega después no se pierde ningún lead: el alta reintenta sin
  las dos columnas).
- `0292_pagos_manual_suscripcion_cancelada` — ANTES o junto con el deploy. Era la `XXXX` de b2 y seguía sin número;
  0290 a 0292 estaban libres en todas las ramas y en los worktrees del disco.
- `0291_lead_instagram_desde_ig` — DESPUÉS del deploy (completa el @ de Instagram de los que ya entraron; idempotente).

**Lo que cambia para Martín (b2, en palabras de producto):**
- Guardar «Editar deal» ya no pasa el lead a Ganado. Ganar sigue siendo el wizard de Ganado.
- Las cuotas conservan su identidad al editarlas: su link de pago y su recordatorio no se pierden. Una cuota con un
  link sin pagar o un recordatorio corriendo no se borra (la pantalla dice cuál no tocó).
- Marcar una cuota como cobrada a mano anula sus links sin pagar: nadie la paga dos veces.
- Una cuota a la que le cambian la fecha vuelve a recibir su recordatorio de cobranza.
- Cancelar una suscripción manual guarda su plazo y reactivarla lo devuelve.
- Un pago a mano lleva moneda, concepto y método.

**Rojo que NO es del CRM:** `tests/puente-panel-copy.test.ts` (voseo) por «acá» en
`app/web-generator/diagnostico/VistaAfuera.tsx:201`, que llegó a main en `1f347b8a2` (el diagnóstico del Web Generator).
## 0-Ω4. 15/10/2026 (chat «Pagos», cuenta `claude1`): b2 COMPLETA en `05bc31391`, y lo que choca al integrarla

**`crm-bloques-b2` está en `05bc31391`** (`wtc-b2`), una sola rama, sin pushear ni mergear en `crm-bloques`:
las dos ALTAS, las seis MEDIAS y las seis BAJAS de la revisión de Pagos, cerradas (`c27eb4323` → `906c36467` →
`fca716101` del CRM; `9df9e6817` y `05bc31391` de Pagos). Integrarla lo decide Martín: tablero, ref
`crm-bloques-b2-integrar`. La migración `XXXX_pagos_manual_suscripcion_cancelada.sql` sigue SIN número y ahora
suma `leads.suscripcion_meses_antes`; se numera al integrar, ANTES o junto con el deploy.

**Lo que choca al mezclar b2 con main** (medido con `git merge-tree` contra main del 15/10, no supuesto). Nada de
código choca; son tres archivos, cada uno con su cura:
- `docs/hallazgos-crm.md`: los dos lados agregaron entradas al final. Se queda con las DOS.
- `docs/relevo/crm.md` (este archivo): se editó en main y en b2. Se queda con las dos, ordenadas por fecha.
- `tests/api-mako-http.snapshot.txt`: las dos ramas sumaron ops a la API. **NO se resuelve a mano: se regenera
  después del merge** con `node --import tsx scripts/generar-api-doc.mjs` (escribe también `docs/api-mako.md`) y se
  commitea. Resuelto a mano, la lista diría que sale por HTTP algo que no sale (o al revés), y esa guarda existe
  para que exponer una operación sea una decisión y no un descuido.
`tests/cobranza.test.ts` NO choca aunque b2 y main lo cambiaron: es el mismo cambio línea por línea (el recorte de
`marcarPago` hasta el próximo export, `b87443e9c` en main) y git lo junta solo.

## 0-Ω3. 14/10/2026 ~16:30 (chat «CRM», cuenta `claude1`): las dos ALTAS de b2, ARREGLADAS

**Al ~17:30, b2 está en `fca716101`** (`c27eb4323` → `906c36467` → `fca716101`), sin pushear ni mergear:
- `906c36467`: la segunda vuelta de la revisión de Pagos. Acortar el plan con una cuota protegida ya no duplica, y
  un ajuste del plan aplica sólo la DIFERENCIA (no pisa una cuota movida a mano ni borra una que no es del plan).
  Un lead sin plan y con cuotas a mano: el ajuste se rechaza.
- `fca716101`: tres de las seis medias: «Sin cobro» con impagas, la cuota que la pantalla no vio, y Editar deal que
  decía «guardados». **Las otras tres las toma el chat «Pagos»** en su rama `pagos-b2-medias` (sale de
  `906c36467`): el dedup de la cobranza, el link vivo de una cuota cobrada a mano y el plazo de una suscripción
  al cancelar y reactivar. Cuando pase el hash, se mergea en b2.
- Tests `pagos-campo` 19/0 (22 roturas en rojo en total), pagos/cobros/API 203/203, tsc acotado 0.

**Al mergear b5, ojo con la rama `undecima` de Automations** (`C:/dev/wt-undecima`, sin pushear al 14/10 ~17:30):
`git merge-tree` con `crm-bloques-b5` da UN conflicto, en el import de `flujo-grafo` de `lib/flujo-ia.ts`. Se resuelve
juntando las dos listas (`borrarNodo, padresDe, siguienteDe, medioDe, puedeSumarAIStep, esAnclaDespues,`).
chatbot.def/run, nutricion.ts y docs/api-mako.md se mezclan solos; docs/api-mako.md se regenera después
(`node --import tsx scripts/generar-api-doc.mjs`). Automations avisa sus hunks antes de su próxima tarea (la
«Reentrada» del CRON: EditorDisparadores, lib/disparadores.ts y la inscripción del motor).

Lo de abajo es de las 16:30:
En `crm-bloques-b2` @ `c27eb4323` (`wtc-b2`), sin pushear y sin mergear en `crm-bloques`:
- **Modo 'lista'** (wizard de Ganado, API `guardar_cuotas`): las cuotas protegidas se casan PRIMERO, así que
  ya no duplican la deuda. La API y el wizard dicen lo que no se tocó (el wizard, en el historial y en `sinTocar`;
  mostrarlo en pantalla es de B2).
- **`ajustarPlanAction`**: mezcla el parcial con el plan de la base (`ajustarSobre`) y pide el día de pago si falta.
  El Deshacer escribe el plan anterior tal cual (`planComoEstaba`).
- Tests `pagos-campo` 16/0 con 8 roturas; pagos/cobros/API 197/197; tsc acotado 0. Cosecha en el
  `docs/hallazgos-crm.md` de la rama. «Pagos» revisa el diff.

**Sigue, en el orden de abajo:** las seis medias de b2, el armador de b1 y b5, revisar b1/b5, mergear b1..b5 en
`crm-bloques` y pasárselo a Estrategia 3 cuentas.

## 0-Ω2. 14/10/2026 de madrugada (chat «CRM», cuenta `claude2`): el feedback del 14/10 03:06, EN CURSO

El pedido textual está en `app/admin/dev/crm/bitacora.ts` (hito del 14/10 03:06). Más dos mensajes después:
«Piensa en todos los bloques que un usuario, con los diferentes funnels que tenemos… podría llegar a querer ver en
las tab personalizables de pagos y resumen... Y piensa si deberíamos personalizar otras tabs también, yo creo que si»,
y «También los funnels organico, de Instagram, linkedin, DM Funnel, YouTube, lead magnet, etc... Eso es importante, y
revisa si deberíamos cambiar las configuraciones de "Nuevo CRM" para agregar más casos».

**Dónde está el trabajo.** Rama `fb1410` en `C:/Users/marti/wtcrm5` (sobre origin/main `92a2be21`). La tanda A corre en seis
worktrees, uno por frente, cada uno con su rama `fb1410-aN` encima de `fb1410` (con junction a node_modules; sacarlo con
`cmd /c rmdir` antes de borrar el worktree):
- `wtc-a1`: el reproductor de la grabación EN LÍNEA en Tracking. Causa medida: `public/replay/1/player.css` nunca se
  cargaba, y la escala quedaba en 1.
- `wtc-a2`: la etiqueta vuelve al diseño de antes de `a98318cb`, en el renglón del nombre. La primera se ve normal, «+N» con 2
  o más, y vuelve la píldora «＋ Etiqueta».
- `wtc-a3`: «A revisar» con una fila por lead (foto, número de datos), revisar azul con flecha, ignorar con X (ignora todos
  los ignorables del lead), X para cerrar, y se cierra con un clic afuera o con Escape.
- `wtc-a4`: el ⋯ del CRM sin subtítulos, sin «Avisos» ni «Resumen», y sin el interruptor del CRM automático (el MOTOR sigue:
  lo pidió Automations).
- `wtc-a5`: el clic derecho en el TABLERO (tarjeta, fila, columna, fondo, selección), con la pieza genérica
  `app/_ui/MenuContextual.tsx`. Falta el de la FICHA: va con el constructor.
- `wtc-a6`: el chat de MaKo al costado del CRM, plegado, con las sugerencias de `docs/sugerencias-mako-crm.md` («Hacerlo»
  crea la automatización pausada desde la plantilla) y la lectura `sugerencias_crm` en la API.
Workflows: tanda A `wf_d8dfde6d-689`; catálogo de bloques `wf_70de8f94-88b`, que deja `docs/diseno-ficha-bloques.md`
en wtcrm5 (los journals están en `~/.claude/projects/<proyecto>/debe2ade-…/subagents/workflows/<runId>/journal.jsonl`).
Al terminar: se revisa cada rama, se mergea en `fb1410`, se corren los tests, se cosecha y se pushea.

**CIERRE DEL 14/10 ~15:10: la cuenta claude2 llegó al 98% semanal.** Frené la tanda B1 (`wf_0132bb27-e06`) y NO se pusheó
nada de la tanda B. En producción está hasta la tanda A (fb1410, en `45fe2cb7f`, deploy Ready). Lo que devolvió cada agente
(contrato del motor, pendientes, hallazgos, revisiones) estuvo volcado en `docs/relevo/crm-tanda-b1.md`, que se borró el 17/10/2026: lo que sigue
vigente está en **docs/relevo/crm-pendientes-b1.md**, los hallazgos en `docs/hallazgos-crm.md` y el texto original en `git show 86bc162be:docs/relevo/crm-tanda-b1.md`.
Estado de cada frente; todos salen de `crm-bloques` @ `2c19b2d69`:
- **b1, motor** (`wtc-b1`, rama `crm-bloques-b1`): TERMINADO en 5 commits, de `1c930ec33` a `d04040305`: catálogo, plantillas, config por
  funnel, avisos por funnel, ops ver/cambiar_ficha_funnel y los dos ignorados. Le falta su revisión.
- **b1, armador**: A MEDIAS, en el commit `3eb46606a` («WIP — NO INTEGRAR»): armador, registros por tab, Personalizar y las dos
  puertas, y se fueron ResumenModal y resumen-actions. NO se corrieron sus tests y falta borrar AvisosDatosModal. Hay que retomarlo
  con el prompt ARMADOR de `tanda-b1.js` (scratchpad de la sesión debe2ade; se reconstruye con este relevo) y una nota de que
  lo del commit WIP es suyo.
- **b2, Pagos campo por campo** (`wtc-b2`): 5 commits, `f3a36ffa3`..`0952106fc`. **La revisión dice que NO va tal cual: dos fallas
  ALTAS de plata.** Una: `ajustarPlanAction` recibe un Partial y lo escribe como el plan entero, y borra cuotas o corre los
  vencimientos. Otra: en el modo 'lista', una cuota protegida termina en «insertar». Hay además seis medias (dedup de la cobranza
  con un id que sobrevive, un link vivo de una cuota cobrada a mano, «Sin cobro» con impagas vivas, una cuota nacida después de
  la foto, Editar deal que ignora en silencio, cancelar pisa el plazo). (Esas fallas se arreglaron: ver `docs/hallazgos-crm.md`, «Las seis bajas de b2» y las dos entradas de arriba.) Trae migración XXXX.
- **b3, «Nuevo CRM»** (`wtc-b3`): 3 commits, `54b6bde61`..`8b3392d15`: presets, el modal por tipo y las ops tipos_de_crm/crear_crm.
  No tiene revisión (no era invisible).
- **b4, captura** (`wtc-b4`): 2 commits, `6b11f7602` y `cab2e72d3`. La revisión dice que va bien, con una media: la etapa
  efectiva de MaKo se calcula contra el funnel del negocio y no contra el del lead. Trae migración XXXX (`leads.pagina_registro` y
  `entrada_social`, que va ANTES o JUNTO con el deploy).
- **b5, plantillas del CRM automático** (`wtc-b5`): las piezas en `5129d8dde`, y las plantillas, la galería y las ops A MEDIAS en
  `87889880f` («WIP — NO INTEGRAR»), sin tests corridos ni revisión. Tiene que respetar las reglas que mandó Automations (están en
  el prompt de b5).
**Orden para el que siga:**
1. Retomar el armador de b1 y b5 (o relanzar `tanda-b1.js` con `resumeFromRunId`: los frentes terminados salen del caché).
2. Arreglar las dos altas y las medias de b2.
3. Revisar b1 (motor y armador) y b5.
4. Mergear b1..b5 en `crm-bloques` (sin rebase), numerar las migraciones XXXX con la regla de AGENTS.md y correr los tests de lo
   tocado.
5. Pasarle a Estrategia 3 CUENTAS la rama y el hash: integra ella.
6. Recién después, la **tanda B2**: los bloques de cada tab sobre los registros del armador, la salida de «Editar deal», CS y el clic
   derecho dentro de la ficha.
Con claude2 al 98%, esto lo tiene que hacer otra cuenta o esperar al reinicio del 20/10.

**ESTADO AL 14/10 ~13:15. TANDA B1 CORRIENDO OTRA VEZ (`wf_0132bb27-e06`, el mismo run).** fb1410 ya está en origin/main
(`45fe2cb7f`), y `crm-bloques` mergeó origin/main sin rebase en `2c19b2d69`, la base de los cinco frentes. Uso semanal de
claude2: 88%. Antes de la B2, medir de nuevo. Lo de abajo es la historia de la pausa:
**ESTADO AL 14/10 ~12:20. TANDA B1 EN PAUSA (`wf_0132bb27-e06`), hasta que Estrategia 3 CUENTAS avise que entró su push** (la paré
a los minutos y sin cambios en los worktrees: Estrategia necesita 4 GB libres para pushear, y fb1410 va en ese push. Se
retoma con `resumeFromRunId`. La tanda B la INTEGRA Estrategia: se le pasa rama y hash, y NO se hace `pull --rebase`)
**ANTES DE RETOMAR:**
1. Con el push de Estrategia ya adentro (trae fb1410 y su choque resuelto), mergear `origin/main` en `crm-bloques`, SIN
   rebase.
2. Llevar `crm-bloques-b1..b5` al `crm-bloques` nuevo. Están vacías: `git -C C:/Users/marti/wtc-bN reset --hard crm-bloques`
   después de ver que siguen sin commits.
El chat de Automations pidió esto el 14/10: sus cambios en plantillas-automatizaciones, condiciones-catalogo, el motor
y chatbot.def/run entraron en `282173d6e`, y sin el merge volvería lo que borró. Sus reglas para b5 ya están en el
prompt de `tanda-b1.js`. (script en el scratchpad de la sesión debe2ade,
`tanda-b1.js`; con tope de 3 agentes a la vez por RAM). Martín: «Si, avanza con todo y pushea» → las 7 decisiones del
catálogo están TOMADAS (§1 de docs/diseno-ficha-bloques.md, `1f075a2b8`). Cinco frentes, cada uno en su worktree, que salen
de `crm-bloques`:
- `wtc-b1` el motor (lib/ficha/**, config por funnel, avisos por funnel, el arreglo de los dos ignorados, ops
  ver/cambiar_ficha_funnel) y después el armador (un solo armador para las dos puertas, el modo Personalizar, y se van
  ResumenModal y AvisosDatosModal).
- `wtc-b2` Pagos campo por campo (merge, cuotas por id, lo cobrado puro, la moneda).
- `wtc-b3` los tipos de «Nuevo CRM».
- `wtc-b4` la captura (el @ de IG, la primera entrada social, la página de registro, lo que lee MaKo).
- `wtc-b5` las plantillas T1/T2/T3/T6 en Automations (avisado al chat de Automations).
Si se corta: relanzar con `resumeFromRunId`. Después: revisar, mergear en `crm-bloques`, numerar las migraciones `XXXX`,
tests, y lanzar la **tanda B2**: los bloques de cada tab sobre los registros que deja b1 (Resumen, charlas, Reuniones y
Tracking, Pagos sin «Editar deal», CS). Después cosecha y push: Martín pidió pushear.

**ESTADO AL 14/10 ~11:20.** Los puntos 1 a 5 de abajo están HECHOS: `fb1410` @ `adaa18103` (tests 1478/0) está en manos
de Estrategia 3 CUENTAS, que la suma al push que sigue al de General y Automations. **No mover `fb1410`.** Los worktrees
`wtc-a1..a6` están borrados, pero sus ramas quedan. La tanda B va en la rama `crm-bloques`, en el mismo worktree `wtcrm5`.
`edcf28e3c` es el catálogo `docs/diseno-ficha-bloques.md`: 54 bloques y 8 plantillas por tipo de funnel, más el respaldo y la
de CS. Trae los tipos nuevos de «Nuevo CRM» y 7 decisiones, que están esperando la respuesta de Martín.
Corregí dos cosas a mano. El estilo de la ficha (tipografía, tarjetas y colores) lo pidió él el 13/10, así que no es una
decisión: se reusa `TemaHoja`. «Editar deal →» se va en la tanda B, al cierre.
Queda pendiente para la tanda B: la API (`ignorar_datos_sin_marcar`) escribe `pendientes_ignorados` y el panel escribe
`datos_ignorados`, así que lo que ignora MaKo no se puede volver a mostrar desde «Ver más» (docs/hallazgos-crm.md:63).

**ESTADO AL 14/10 ~06:35 (la app se cayó a las 04:27 y a las 06:10).** La tanda A TERMINÓ y está en `fb1410`
(cherry-pick de las seis ramas, sin choques): `c76f48bb2` reproductor en línea · `f52234dc3`+`fa9d5ca75` etiquetas ·
`99e0a02b5` A revisar · `43a27b56c` tres puntos · `a3496cc32` clic derecho del tablero · `b04e3d1fe` chat de MaKo
con sugerencias · `b4db1eaa7` arreglo de la revisión de A revisar (agrupación pura con test, ignorados sin tope chico).
Los resultados de los seis agentes, con sus hallazgos y pendientes, están en el journal de `wf_d8dfde6d-689`.
**Falta, en este orden:**
1. Dos arreglos de la revisión del chat de MaKo, de gravedad media. El texto de «Un Lead No Avanzó» promete el plazo de la
   etapa y la plantilla espera 3 días fijos; tiene que decir lo que hace. «Ahora no» no tiene vuelta: hace falta «Calladas (N)»
   con «Volver a mostrar». Uno bajo: al cambiar de CRM con el panel plegado, se carga el hilo, y cargar el hilo escribe.
   El agente que los hacía se cortó con la caída sin escribir nada.
2. COSECHAR los hallazgos de la tanda A en docs/hallazgos-crm.md, hallazgos-ui.md y hallazgos-landing.md (la causa del
   reproductor: player.css nunca se cargaba; maxScale 0 = sin tope; el iframe grabado va inert; el MenuContextual de la casa
   y sus guardas; las caras de A revisar sin el proxy de Evolution), y la bitácora con sus commits.
3. Correr los tests de todo lo tocado en fb1410 y pasarle la rama y el hash a Estrategia 3 CUENTAS, que pushea.
4. Retomar el catálogo `wf_70de8f94-88b` (lo frenó la guardia de RAM) y después la tanda B.
5. Borrar `C:/Users/marti/wtc-a1..a6` (primero `cmd /c rmdir` del junction de node_modules, después `git worktree remove`).

**Lo que viene después (tanda B): el CONSTRUCTOR POR BLOQUES.** Martín: «no los hagas con un modal diferente… Que replique la
edición que tenemos en "Dashboard" y "Landing Generator", que sea un constructor por bloques… con templates… que pueda
elegir que bloques poner, que diseño, tamaño». Va para Resumen, Pagos y las tabs que proponga el catálogo. Ahí mismo se
eligen los avisos de «datos sin marcar», y se borran ResumenModal, AvisosDatosModal y los engranajes. En Pagos se edita TODO
en la tab y se depreca «Editar deal →» en todos lados: EditarDeal, `?edit=1` y el «Completar con IA», que está roto en 2 de
las 3 puertas. Lo medido por el relevamiento `wf_7c6f7f1e-959`:
- la cáscara de grilla del Dashboard NO está extraída: son ~450 líneas mezcladas en `app/dashboard/EditorInforme.tsx`.
- La grilla fija de 30 px choca con tarjetas de alto variable.
- El Landing es TipTap: no sirve para la ficha.
- Las cuotas: `saveCuotasAction` cierra el lead como ganado en cada guardado (`lib/pagos.ts:224`).
- `saveDealSectionsAction` reemplaza la sección entera.
- Las dos puertas montan la ficha a mano por duplicado (hace falta UN renderer).

**Pendiente con Automations.** Martín: «elimina el botón de "CRM Automático"... Si quedó algo pendiente, llevalo como template a
automations». Mapeo medido de las reglas del motor contra las plantillas:
- **T2** (no agendó → No Agenda → Reactivación) y **T6** (perdido o no responde a los 30 días → Reactivación) se arman con las
  piezas de hoy, pero la galería no tiene cómo pedir la ETAPA DESTINO del ⚡ Mover (es obligatoria).
- **T3** (nutrición manual vencida) pierde la fecha límite por lead: no hay condición sobre ese dato.
- **T1** (no show por Fathom) no tiene piezas: una espera «N horas después de la reunión» y la condición «asistencia sin marcar».
- El motor NO se apaga hasta que esas plantillas existan (`KEY_CRM_AUTO`).

## 0-Ω. Noche del 13 al 14/10/2026 (chat «CRM», cuenta `claude2`): el feedback del detalle del lead

Martín lo pidió directo (el texto literal está en `app/admin/dev/crm/bitacora.ts`, hito del 13/10
22:57). **Nada de esto está en producción todavía:** al 14/10 01:10 los pushes de TODA la máquina
seguían trabados por RAM (el typecheck completo ya pide ≈ 5,3 GB libres: el tope del heap subió a
4096 el 14/10). Hay DOS worktrees con trabajo sin publicar:

- `C:/Users/marti/wtcrm2` (HEAD `a98318cb`): `origin/main` + los commits de todas las sesiones +
  los del CRM hasta la cabecera compacta. Un script de fondo lo pushea cuando haya RAM
  (`scratchpad/push-cuando-haya-ram.sh`; sale con 2 si `origin/main` se movió → rebasar y relanzar).
- `C:/Users/marti/wtcrm3` (HEAD `4ca15b9a`): encima de `a98318cb`, la oferta del lead
  (`81a28c18`, `4ca15b9a`) y esta cosecha. **Se pasa a la rama del push con un cherry-pick** cuando
  `wtcrm2` llegue, o se pushea desde acá si `wtcrm2` ya está en `origin`.

**CIERRE (14/10 ~03:45, pedido de Martín: «que se pushee todo y que los chats cierren lo que están
haciendo»).** Todo lo del CRM está en la rama `crm-1410` del worktree `C:/Users/marti/wtcrm4`: una copia
limpia sobre origin/main `e4c8a6d7` con los commits del CRM pasados por cherry-pick (sin choques) más los
tres bugs que encontró Automations y la hora al mover a mano. **El push lo hace Estrategia 3 CUENTAS, con
todo junto: desde acá no se pushea.** Los hashes de la bitácora y de este relevo son los de `crm-1410`.
Tests de lo tocado: 7907 verdes y 2 rojos ajenos. El de SelectorFuente lo reescribió CS en `0255c855`; el
otro es el área de `dashboard-analisis-listo`, de Automations. La referencia de la API está al día.

**Las migraciones ya están APLICADAS en prod** (0269, 0270, 0272 y 0274; todas aditivas o de datos): son de las que van antes del
deploy. Los hashes de abajo son los de DESPUÉS del rebase del 14/10.

### ✅ Hecho (commits locales, con tests probados rompiéndolos)

- «A revisar» sólo con datos sin marcar, sin la «Mk» ni «MaKo movió» (`0d07ddc8`). **El motor
  (lib/crm-auto.ts) sigue corriendo**: lo reemplazan las plantillas que se le pidieron al chat de
  Automations, y recién ahí se apaga (flag por workspace `KEY_CRM_AUTO`).
- «Nuevo CRM» arriba del desplegable, «CRM eliminados» (`0d07ddc8`).
- El CRM con nombre propio: renombrarlo ya no renombra el producto ni el curso (`ace3e61d`, mig 0269).
- La grabación de la visita: montaba en un rAF antes de que existiera el recuadro (`913966d4`).
- Datos sin marcar v2: «Ver →», solucionar que lleva al dato y lo señala, ignorar por dato, «Ver
  más», de qué avisa MaKo, «A revisar» por dato, y «¿Era calificado?» en Resumen (`42e57a6c`, mig 0270).
- El mapa de sugerencias de MaKo: `docs/sugerencias-mako-crm.md`, **esperando que Martín lo valide**.
- Autoguardado: lo que se perdía era cerrar un modal con un clic en el fondo (`862757d0`).
- Cabecera compacta: etiquetas al lado del nombre con «+N» (`a98318cb`).
- Pagos punto 1: la OFERTA del lead (desplegable, «Nueva oferta» con nombre, modelo y ticket, y
  «Analizar oferta →» que abre ESA en Offer) (`81a28c18`, `4ca15b9a`, mig 0272). Toqué tres archivos
  de Offer (`page.tsx`, `OfferApp.tsx`, `arbol.ts`) porque no había chat de Offer vivo para pedírselo.

**Sin mirar en el navegador** (la máquina sin RAM para un `next dev`): lo primero al haber deploy
es abrir una ficha con datos sin marcar y probar «Ver →», solucionar, ignorar y el engranaje.

### ⏳ Lo que falta del mismo pedido (en este orden)

1. ~~Autoguardado~~ y 2. ~~cabecera compacta~~: hechos (arriba).
3. **Tarjetas del lead personalizables** (plantillas, campos, arrastrar, vista en vivo) en los tres puntos.
4. ~~**Resumen personalizable**~~: hecho el 14/10 (mig 0274 aplicada). Falta mirarlo en el navegador.
5. ~~**CAPI**~~: revisado el 14/10 (docs/hallazgos-ads.md, «a dónde va hoy ¿Era calificado?»). La
   tarjeta ya no afirma «Meta aprende» donde no llega. **Espera a Martín**: si quiere ofrecer el
   conjunto de datos de CRM (lo que hace que Meta optimice por calificados); nadie lo tiene.
6. **Pagos**: ~~el desplegable de OFERTA~~ (hecho); falta la tab personalizable como Reuniones
   (tipografía, tamaño de tarjetas, colores). Coordinar con Integraciones (worktree
   `C:/dev/wt-pagos`, rama `pagos-pasarela`).
7. **El chat de MaKo al costado del CRM con las sugerencias**: después de que Martín valide el mapa.
8. Del lote de Estrategia: Leads Scraper (sólo fuentes legítimas) y los tipos de funnel que faltan.

### Pedidos a otros chats (13/10), y lo que contestaron el 14/10

- **Automations**: plantillas que reemplacen T1-T6 del CRM automático, revisar si hoy alcanza, y el
  EVENTO de Calendly o Cal por etapa de reunión. **Contestó (14/10):** lo tiene en
  `docs/relevo/chatbot.md` (`25e4600a`), después de tres bugs de Mauricio. Para crear desde una
  plantilla hay UNA puerta: la op `crear_automatizacion_desde_plantilla` o
  `POST /api/chat-agent/secuencias` con `action: 'crear_desde_plantilla'` (las dos terminan en
  `crearDesdePlantilla`, lib/plantilla-crear.ts). Ya existe `lead-no-avanzo` (el plazo de etapa).
  **El motor NO se apaga** hasta que avisen; se apaga por workspace con `KEY_CRM_AUTO`.
- **Customer Success**: el título del curso desde la OFERTA. Se le tocó `renombrarServicioAction`
  (un hunk: ahora renombra el producto, no el CRM). **Contestó (14/10):** lo toma, leyendo la oferta
  principal del producto; espera el hash en main (`ace3e61d`) para leer `nombreVisible`.
- **El push lo hace UNO: Estrategia 3 CUENTAS**, desde su worktree de integración (14/10 ~01:00). No se
  pushea desde acá; se le pasa el HEAD de `C:/Users/marti/wtcrm3`.

## 0-α. Al 13/10/2026 (chat «CRM», cuenta `claude2`, al reanudar lo frenado por la cuota)

Martín, vía «Estrategia 3 cuentas»: «dile a esos chats que continuen y cierren lo que ya habiamos
planificado». Lo nuevo de `mako-feedback-y-tareas.md` NO se tocó: sigue provisional.

### ✅ Cerrado (cada uno con su test probado rompiéndolo)

- **El rojo de main** (`tests/mover-etapa-validacion.test.ts`): el código validaba bien. El test
  leía 1.400 caracteres fijos y el commit de MaKo Mobile metió código en el medio. Ahora lee la
  rama de la opción.
- **Confirmar una propuesta de contactos la RECLAMA antes de crear** (§3): dos pestañas ya no
  crean dos veces. Si no escribió nada, se suelta (`soltarPropuesta`).
- **Quitar una columna pregunta aunque el filtro esconda sus leads.**
- **La nota desde el teléfono se rechaza si es larga**, con `TOPE_NOTA`, en vez de recortarse.
- **«confírmalo en Inbox» → «confírmalo abajo»**: el mismo turno corre en la ficha de escritorio.
- **Instagram: una sola regla** de qué es un usuario (la del buscador).
- **El desplegable no esconde «＋ Nueva» al buscar** (`app/components/Dropdown.tsx`).
- **La cohorte se ve en el panel del tablero**, con `cohorteDeLead`, la misma función de la ruta.
- **«A revisar» resuelve en el lugar**: lista los primeros 12 leads con datos sin marcar y abre
  su ficha encima de la página. «Ver todos» sigue llevando a la cola.
- **Las notas como los chats de MaKo**: emojis, el micrófono (ya estaba) y **adjuntos**. La
  **mig 0267 YA ESTÁ APLICADA en prod**: columnas en `lead_audit` y el bucket privado
  `lead-notas`. Verificado de punta a punta en ws3 y borrado.

**Sin mirar en el navegador.**

**El push:** al cierre, el pre-push no pudo correr el typecheck. La vigía de RAM lo mata en zona
roja y sale «hay errores de tipos» sin ninguno. Lo arregla «Fallas en la PC» en
`scripts/typecheck-lock.mjs`. Los commits se pushean cuando eso esté en main; nunca con
`--no-verify`.

### Ya estaba hecho (las notas de abajo quedaron viejas)

- **El punto 3 del quinto feedback** (desplegable de tipo en las nutriciones, arrastrar cambia el
  tipo): está en `ab720661`.
- **El duplicado del opt-in sin productos** (§3): desde el 09/10 la propuesta guarda
  `datos.funnels` y los aplica quien confirma.

### Sin hacer, con su archivo

- **El espejo etapa↔etiqueta reconoce por el NOMBRE** lo que tocó una persona
  (`lib/etiquetas-motor.ts`).
- **Los dos textos al borrar una etapa se contradicen, y ninguno es exacto.**
  - El tablero (`CrmBoard.tsx`) dice que los leads «pasan a la primera etapa».
  - El editor (`EtapasModal.tsx`) dice que «quedan fuera del embudo».
  - Lo que pasa: vuelven a la etapa que les dan sus datos (`etapaVigenteDe`), y quedan afuera
    sólo si esa etapa no existe en el funnel.
- **El lápiz (color) en las etapas de nutrición**; **la causa del título de /crm**; **los tres
  clasificadores de «Meta está limitando»**.

## 0. Al 12/10/2026, 15:30 (chat «CRM», cuenta `claude3`, al 98% semanal)

### ✅ Sexto feedback del 12/10 (14:54) y el punto 3 del quinto: HECHOS en `ab720661`

El desplegable de tipo va en todas las etapas. El tipo decide la lista y arrastrar a la otra lista cambia el tipo.
Hay un «+» entre etapas. Las secciones del editor van en cajas grises con cabecera («Editar etapas», «Asignar
campañas» con el logo de Meta, el tipo de funnel en lista). La tabla de campañas perdió «N asignadas». Sin mirar en
el navegador.

**Para la próxima:** una etapa propia marcada Nutrición SIGUE GUARDADA en `data.pipeline` (con `marcadaComo`); la saca
del recorrido `generateFunnel` (`recorridoDe`). Una nutrición de catálogo que sube entra al pipeline con SU clave y
apaga sus transiciones. Todo eso decide `cambiarTipo` en lib/etapa-banda.ts.

**SIN HACER** (en docs/hallazgos-crm.md): los prompts que describen el recorrido leen `f.pipeline` y listan las
nutriciones propias como pasos; y una nutrición de catálogo subida al recorrido sigue contando como nutrición para
`NUTRI_KEYS` (lib/leads.ts, app/crm/edit-logic.ts). Siguen sin hacer las notas como los chats de MaKo y «A revisar»
en el desplegable (§0-a).
## 0-a0. Al 12/10/2026, 14:40 (chat «CRM», cuenta `claude3`, al 97% semanal)

### ✅ Quinto feedback del 12/10 (14:10), puntos 1, 2 y 4: HECHOS en `8ed12c64`

En la tabla de campañas del editor del funnel: con lo tildado, «Asignar a este funnel» (sin desplegable); los dos
filtros son un botón «Filtrar» con el ícono de siempre (Estado y Funnel, sin «Todos»); se ven cinco y el «Ver más»
de la casa. Las etapas son tarjetas (fondo blanco, anillo, sombra, más altas). Sin mirar en el navegador.

**Ojo:** el lote ya no ofrece «Sin asignar». Quitar una campaña sigue de a una, en su columna «Funnel».

### ⛔ SIN HACER: el punto 3 (cambia el modelo; no lo arranqué al 97%)

Textual: «El desplegable de las etapas que dice "Etapa, reunión, nutrición" también lo debería tener los de
nutrición... Y si se coloca "Etapa" se desplaza automáticamente hacia arriba, y viceversa. Es decir, también si
arrastro debería cambiar ese desplegable.» El plan:

- **La UI** (`app/crm/EtapasModal.tsx`): `SelectorTipo` también en `filaNutricion`. El `onDrop` de la lista decide
  por el grupo DESTINO (hoy `grupoAgarrado` lo limita al suyo) y soltar en la otra banda es cambiar el tipo.
- **Nutrición → Etapa/Reunión:** una nutrición DERIVADA se inserta como paso del pipeline y se apagan sus ids
  derivados (`idsParaQuitarNutricion`); una propia sale de `data.nutricionesPropias` y entra al pipeline.
- **Etapa → Nutrición:** sale del pipeline y entra a un `data.nutricionesPropias` NUEVO, que `generateFunnel`
  coloca en la banda nutrición como hoy coloca `manual` (lib/pipeline.ts). Lo lee `filaAFunnel` (lib/funnel-fila.ts)
  y lo conserva `mergeFunnelData`. Si la clave es una nutrición conocida, se des-suprime en vez de crearla.
- **La clave de la etapa no cambia**, así que sus leads siguen en su columna. Entrada, pago y cierre quedan afuera
  (`puedeSerReunion`).
- **El server:** una op nueva en `OpEtapa` (`app/crm/actions.ts`), con su deshacer; y el test con su rotura.

**Siguen sin hacer** (§0-a): notas como los chats de MaKo y «A revisar» en el desplegable; y que «Marcar nutrición
manual» se apague cuando el funnel quitó esa etapa (§0-a1).
## 0-a1. Al 12/10/2026, 13:40 (chat «CRM», cuenta `claude3`, al 96% semanal)

### ✅ El editor del funnel (cuarto feedback del 12/10): HECHO en `53cf309f`

Martín pidió a las 13:11, con dos capturas del editor de VSL FUNNEL (textual en la bitácora): el tipo de funnel
arriba de las etapas, UNA opción, que se guarde al elegirla, y con anuncios las campañas de Meta en su lugar con
una flecha para volver (Prospección sin campañas); la entrada sin lápiz ni «Campañas de Meta»; «+ Agregar etapa»
arriba de todo; sin flechas, un asa para arrastrar; las de nutrición editables, arrastrables y que se puedan quitar
todas; Ganado y descartes sin pastilla y con la caja distinta; el tacho rojo. Todo hecho. Sin mirar en el navegador.

**Para la próxima:** el tipo de funnel se guarda como la ENTRADA de siempre (`TIPOS_FUNNEL`, lib/pipeline.ts), no
es un dato nuevo. «Agendan llamada» dejó de ofrecerse y se muestra elegida donde ya estaba declarada. Quitar
«Nutrición - Manual» deja sus leads fuera del tablero (lo dice el diálogo) y el «Marcar nutrición manual» de la
ficha los sigue mandando ahí: si eso molesta, que ese botón se apague cuando la etapa no está.

**Rojo previo en main, no mío:** `tests/mover-etapa-validacion.test.ts` («CABLEADO: la opción del modal de
confirmaciones…») falla sobre `lib/mako-confirmaciones.ts`, que nadie de este chat tocó.

**Siguen sin hacer** (los del tercer feedback, abajo en §0-a): notas como los chats de MaKo (3) y «A revisar» en el
desplegable (4).
## 0-a. Al 12/10/2026, 12:00 (chat «CRM», cuenta `claude3`, al 95% semanal)

### ✅ El tercer feedback del 12/10: HECHO en `40d5ba8c`, salvo dos puntos

Martín mandó ocho puntos a las 11:37 y uno más a las 11:43 (textuales en la bitácora). Hechos: el editor de
etapas en UNA lista en el orden del tablero (1), el país del alta que recuerda la última elegida y si no detecta
el de la zona horaria (2), la barra como tarjeta del ancho del kanban (5), etiquetas con lápiz, sin «Ya la tiene»
y con ✓ para crear (6), la ficha a alto completo (8) y «Campañas de Meta» en la fila de entrada del editor (el
pedido de las 11:43). El 7 (los plazos de etapa como template de Automations) se lo pasé al chat «Chatbot», como
él pidió. Sin mirar en el navegador.

**SIN HACER, por la cuota (95%):**
- **3. Las notas como los chats de MaKo** (adjuntar archivos e imágenes, emojis, y el micrófono que TRANSCRIBE en
  vez de mandar audio). Vive en `app/crm/lead-view/NotasCard.tsx`; el molde es `ComposerWhatsApp`
  (`app/whatsapp/_shared/ComposerWhatsApp.tsx`) y el dictado `transcribirNota` (`app/_components/useDictar`), que
  ya usa MaKo Analyst. Adjuntar en una nota necesita dónde guardar el archivo: hoy una nota es sólo texto.
- **4. «A revisar» sin ir a otra tab**: `app/_components/MakoConfirmGate.tsx` (`irAPendientes` hace
  `router.push('/crm?pendientes=1')`). Sólo tiene el CONTEO (`/api/datos-sin-marcar-count`): mostrar los datos en
  el desplegable pide un endpoint que devuelva la lista.
- **1, a medias**: las etapas de nutrición se renombran con un clic y se quitan con la ✕, pero no tienen el lápiz
  (color y tipo) de las propias. Si «editables como cualquier otra» era eso, falta.

## 0-a2. Al 12/10/2026, 11:00 (chat «CRM», cuenta `claude3`, al 93% semanal)

### ✅ El segundo feedback del 12/10 (once puntos): HECHO en `3e5176c9`

Martín mandó once puntos a las 10:30 sobre lo publicado esa mañana (textuales en la bitácora). Hechos: las
reuniones en un botón que late (1), el borrador del alta (2), la barra como banda (3), todas las etapas en
el editor (9) y los tres puntos de cada etiqueta (8). Contestados sin código: los filtros ya persisten con
F5 (6, confirmado por él), «¿Era calificado?» es sólo para CAPI y está bien que no aparezca (11), y el
**número de lead sigue siendo el id global** (7: «decidelo tú»; el porqué, en `docs/hallazgos-crm.md` →
«El segundo feedback del 12/10»). Sin mirar en el navegador.

**Queda para después, a pedido suyo:** por qué el buscador no encontró `@martin.koncke` (4) y la fuente
GRATIS para buscar por nombre (5: «investigar alternativas a Brave Search… que no cueste dinero»). Y le
debemos la explicación de los «plazos viejos» (10): las etapas que tenían un plazo puesto antes de que se
sacara «Ponerle un plazo» siguen mandando el aviso diario del lead quieto (`lib/lead-quieto-aviso.ts`), y
ya no hay pantalla para verlos ni quitarlos.

## 0-b. Al 12/10/2026 (chat «CRM», cuenta `claude3`, cortado al 86% semanal)

### ✅ El feedback del 12/10 (28 puntos): HECHO en `bdcee029`

Martín mandó 28 puntos entre las 02:08 y las 02:24 (textuales en la bitácora del área,
`app/admin/dev/crm/bitacora.ts`). Se hicieron en seis frentes con archivos disjuntos (etapas;
tablero, alta y teléfono; cabecera de la ficha; campos de la ficha; MaKo Analyst; Instagram)
más dos revisiones de lo invisible: una de un agente y otra de cinco lentes con tres escépticos
por hallazgo. La segunda confirmó y arregló 9 cosas que perdían o filtraban datos sin un
error. Lo aprendido está en `docs/hallazgos-crm.md` (secciones del 12/10), `hallazgos-ui.md` y
`hallazgos-mobile.md`, y las reglas nuevas en AGENTS.md («Una caché en memoria del server es
de TODOS los inquilinos», «Un control que hidrata un dato guardado no escribe si la persona no
tocó nada»).
**Verificado con:** typecheck (0 errores en lo tocado; los 2 TS2307 de `html-to-image` y
`pptxgenjs` son del `node_modules` del clon) y la suite entera. **NADA se miró en el
navegador**: lo visual lo revisa Martín.
**La migración `0258_lead_ingreso_e_instagram.sql`** (dos columnas nullable en `leads`) se
aplicó a prod ANTES del push: el `select` del tablero las pide, y sin ellas el CRM de todos los
workspaces abre vacío.

### Lo que decide Martín (nada de esto está hecho)

1. **El buscador de Instagram por NOMBRE no tiene fuente.** La Custom Search JSON API de
   Google está cerrada a clientes nuevos y se apaga el 1/1/2027. Hoy anda por @ exacto (Meta
   Business Discovery: sólo cuentas de empresa o creador, y cuando la app «MaKo» tenga
   `instagram_basic`, `instagram_manage_insights` y `pages_read_engagement`) y por el nombre
   pegado (`anaperez`, `ana.perez`, `ana_perez`). Opciones: Brave Search (plan gratis), Serper.dev
   (Google, pago por búsqueda) o ninguna. El código lee `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` del
   workspace de plataforma (`lib/instagram-buscar.ts`): cambiar de fuente es tocar ese archivo.
2. **Las bandas Activo / Nutrición / Descartado ocultas ahora se GUARDAN** con los demás filtros
   (`app/crm/filtros-guardados.ts`). Revierte su «siempre activos» del 27/09, por su regla del
   10/10 de que los filtros persisten. Confirmar.
3. **¿Número de lead por negocio (#1, #2…)?** Hoy el id es global (`leads_id_seq`): no hay
   mezcla, pero ws9 ve #2472.
4. **«¿Era calificado?» desaparece** en un funnel sin campaña y sin etapa de reunión (las
   pestañas Tracking y Reuniones dependen del funnel).
5. **Las etiquetas no tienen pantalla para renombrar, cambiar color o archivar**
   (`app/crm/EditorEtiquetas.tsx` quedó sin montar al sacar la pestaña): ¿dónde va?
6. **Los plazos viejos de etapa siguen avisando** sin un lugar donde verlos
   (`lib/lead-quieto-aviso.ts`): ¿se borran?
7. **Una nota la edita o la borra su autor o un admin**: lo decidió el frente, no él.
8. Siguen sin respuesta desde el 11/10: los tres arreglos de la §3 y la decisión 1 de la §5.

### Lo que quedó sin hacer (técnico)

- **Las nutriciones generadas no tienen pantalla para apagarlas**: se sacó la subtab Nutrición
  y `generateFunnel` sigue sumando las de `st0>noshow_r2` y `st0>nocompro` cuando aparece una
  segunda reunión.
- **`quitarColumna` cuenta los leads sobre lo que deja ver el filtro**: con un filtro puesto, una
  columna con leads escondidos se borra sin el «¿seguro?» (`app/crm/CrmBoard.tsx`). Es de antes.
- **La nota desde el teléfono sigue recortando a 4000 en silencio** (`app/m/crm/acciones.ts:80`):
  la regla nueva (`TOPE_NOTA`, rechazar en vez de recortar) no la ve.
- **«confírmalo en Inbox»** sale ahora también en la ficha de escritorio, donde Inbox no existe
  (`lib/mako-turno-app-reglas.ts:272-278`).
- **Dos reglas para «es un usuario de Instagram»**: `usuarioInstagram` (app/crm/campo-inline.ts)
  y `usuarioDeTexto` (lib/instagram-buscar.ts). Difieren en casos raros («___»).
- **El buscador de etiquetas con más de 7 esconde «＋ Nueva»** (`app/_components/etiquetas-cliente.tsx`).
- **La causa del título de /crm es una hipótesis**: `TituloTab` ahora vigila el `<head>` y repone
  «MaKo - CRM», pero nadie midió quién lo pisaba (se sospecha del `loading.tsx` de /crm).
- **Tres clasificadores distintos de «Meta está limitando»** en el repo; el del buscador ahora
  pausa con los códigos 4, 17, 32, 613, 80001 y 80002.

## 0-bis. Al 11/10/2026 18:00 (chat «CRM», cuenta `claude3`, cortado al 85% semanal)

**Medido contra el árbol, no copiado de abajo.** Desde este relevo (10/10 20:48) nadie
trabajó el CRM: los commits que tocan sus rutas son de OTRAS áreas y de pasada
(`7527b8c2` y `b21f16ab` del Dashboard en `app/crm/actions.ts` y `deal-actions.ts`;
`ef8626ce` de MaKo Mobile, que en `app/crm/revisar/[id]/acciones.ts` sólo le puso guarda a
DESCARTAR). Los tres pendientes de la §3 siguen abiertos tal cual: la cohorte del panel
(`app/crm/LeadSheet.tsx:225`), `funnelIds` en `FilaImport` (`app/crm/leads-importar.ts:211`,
ausente también en `app/crm/actions.ts`) y el `marcarAplicada` DESPUÉS de crear
(`app/crm/revisar/[id]/acciones.ts:83`). Se le ofrecieron a Martín sin respuesta todavía;
la decisión 1 de la §5 se le presentó con la (c) recomendada.

### ✅ «Producto» → «Funnel»: HECHO el 11/10 a las 16:26 (`53ba6450`, 63 archivos)

Martín contestó a las 15:55: *«Es así: funnel > oferta > productos»* (el catálogo con precio
sigue siendo «producto») y *«arrancalo ahora»*. Cambió sólo lo que se lee, donde la palabra
nombra un funnel: el CRM entero, el teléfono, «Agregar al CRM» de WhatsApp, Ads Manager, el
paso 2 del Pixel, el CRON y las condiciones de Automations, el paso «⚡ Acción», el aviso del
lead quieto y los mensajes de las acciones del CRM por MaKo. El porqué de cada frontera, en
`docs/hallazgos-crm.md` → «"Producto" → "Funnel"». **Sin verificar en el navegador**: se
verificó con tests (304 pass en los 19 archivos del área) y typecheck.

**Lo que quedó pendiente:** las descripciones de las `.def.ts` de la API de MaKo (esperan a que
`lib/api-mako` no tenga cambios ajenos, porque regeneran `docs/api-mako.md`), la dimensión
«Producto» de los gráficos (`lib/graficos-catalogo.ts`, de la sesión del Dashboard) y los prompts.
Y un rojo que NO es de esta tarea: `tests/mover-etapa-validacion.test.ts` («la opción del modal de
confirmaciones valida») falla contra `lib/mako-confirmaciones.ts`, último commit `ef8626ce`
(MaKo Mobile).

Lo de abajo es lo que se sabía ANTES de hacerlo:

Pedido de Martín, textual (11/10/2026, en el chat de la tab Offer, que la reenvió acá):
*«Las ofertas deben estar atados a los productos del CRM... Y quiero cambiar el concepto
"Producto" por "Funnel" en todos lados... Porque un mismo funnel puede tener varias
"ofertas"... Configuralo de esa manera, para que yo pueda seleccionar en que funnel analizar
o crear una nueva oferta. Mandale como tarea al CRM que lo cambie en todos lados.»*

Lo que hay que saber antes de tocar una línea:

- **En el CRM, lo que la pantalla llama «producto» YA ES un funnel por dentro**: la casa del
  lead es `leads.funnel_id`, los «otros productos» son filas de `lead_funnel`, y el nombre que
  se ve sale del producto principal del funnel (`productoDeFunnel`, `lib/funnels.ts:230`). O
  sea que el renombre CORRIGE el rótulo, no cambia el modelo.
- **Y la relación que Martín describe ya existe en la base**: `producto ──oferta_productos──>
  oferta ──funnel_ofertas──> funnel`. Un funnel con N ofertas es `funnel_ofertas`, no
  `oferta_productos`.
- ⚠️ **Hay un SEGUNDO «producto» que no es un funnel**: el catálogo de `lib/productos.ts`
  (tabla `productos`: precio, único/suscripción), que va DENTRO de una oferta y del que cuelgan
  la entrega de Customer Success, los cursos y el onboarding. Si ése también se llama
  «Funnel», la cadena se lee «funnel → oferta → funnel». Pregunta abierta a Martín.
- **El tamaño**: 40 archivos de `app/crm` nombran «producto» (incluye identificadores) y la
  palabra «Embudo» también se ve en 17 (`CrmBoard`, `EtapasModal`, `CrmToolbar`…). Default
  propuesto: «Embudo» también pasa a «Funnel», porque es la misma cosa.
- **Lo que NO se renombra** (regla de AGENTS.md, como /chatbot → /automations): tablas,
  columnas, `producto_id`/`funnel_id`, keys de settings y de onboarding, áreas y operaciones
  de la API de MaKo. Cambia lo que se LEE. Los tests que miran copy se corren antes de pushear.
- **El chat «Offer»** lee del CRM con `listProductos(true)`; se le avisó que el funnel con sus
  ofertas es `funnels` + `funnel_ofertas`. Si cambia una firma, se le avisa por ese chat.

**Qué es esta parte del producto, para quien nunca la vio.** MaKo es una plataforma de
marketing y ventas que Martín Koncke (el dueño) le vende a negocios. El CRM es la tab
`/crm`: un tablero kanban donde cada tarjeta es un **lead** (un contacto interesado) y cada
columna una **etapa** del recorrido de venta (llegó → agendó una reunión → asistió → pagó →
Ganado). El conjunto de etapas se llama **embudo** o **funnel**, y un negocio puede tener
varios: uno por producto que vende. Los leads entran solos (un formulario de Meta, la
landing del cliente, Calendly/Cal.com, WhatsApp) o importados de una planilla.

Vocabulario que se usa acá y no se explica dos veces:

- **ws1, ws11, ws13**: los negocios (workspaces) por número. **ws1 es Mauricio, un
  CLIENTE** (el primer cliente, por eso la constante se llama `OWNER_WS` — no es el dueño).
  ws11 es Leila, ws13 es Código Inmobiliario, ws3 es el Cliente de Prueba.
- **La casa de un lead**: el producto donde «vive» (`leads.funnel_id` + `leads.pipeline_stage`).
- **`funnel_id = NULL` NO es «sin producto»**: es el embudo del NEGOCIO, el que viene por
  defecto. Es la trampa número uno del área (abajo).

---

## 1. En qué quedó: lo hecho y DESPLEGADO

Todo lo de esta lista está en `main` y desplegado. Un commit por renglón, salvo donde se dice.

**El cambio de modelo de la ventana: un lead está en VARIOS productos** (`f26c0a94`, 06/10,
mig `0207_lead_funnel`). Antes un lead tenía UN solo `funnel_id`, así que ponerlo en un
segundo producto obligaba a MOVERLO —y moverlo le reseteaba la etapa y, si estaba en Ganado,
le limpiaba la venta—. Martín lo reportó textual: *«Le acabo de dar a un lead a "Mover a
prueba" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar… No se debe
"Mover" se debe agregar al otro producto»*. Ahora: la **casa** sigue en `leads.funnel_id`, y
cada otro producto es una fila de la tabla nueva `lead_funnel` con su etapa propia. «Agregar»,
nunca «mover». Entra por la ficha, el tablero, el lote, «Traer de otro producto», el alta, las
campañas y el opt-in de la landing. El detalle y sus trampas:
`docs/hallazgos-crm.md` → «Un lead en VARIOS productos».

**El tablero y la tabla.** Marca de dónde vas a soltar la tarjeta (`3faab70d`); el tablero
sigue desplazándose con el cursor fuera del kanban (`abbb7a12`); acciones en lote
(`403e9f40`); la tabla deja de ser una lista y se le arrastran las filas (`cceda0d3`,
`ef4dcab5`); la casilla de selección sale al pasar el cursor (`9dc1cf2e`); arrastrar dentro
de la misma columna la deja ahí, con «Ordenar → Manual» (`1703c786`, mig
`0200_lead_orden`).

**Campañas de Meta → producto.** Asignar campañas y conjuntos de Meta a un producto desde
«Lead entrante», para que sus leads caigan en ese tablero (`c2a02c1a`, `ebcfbad8`,
`dc8a8ae6`, `721ad387`, mig `0193_lead_campana_meta`). Y filtrar el tablero por campaña y por
creativo (`117ea2bd`).

**El filtro «Anuncio» (10/10, `686c51be`).** Martín: *«Acá al filtrar, en campaña, y en
Origen, aparece lo mismo. Y falta el filtro de ANUNCIO, para filtrar por un ad específico»*.
Eran dos causas y ninguna estaba en la atribución: (a) el `select` del tablero (`LISTA_COLS`
en `lib/leads.ts`) no pedía `utm_content`, que es donde la landing guarda el id del anuncio
—44 de los 52 leads de ws13 lo tienen, con 13 anuncios distintos—, así que la categoría
existía desde el 06/10 y se escondía sola por no tener opciones; (b) el filtro «Origen»
listaba `origenLegible`, que dice lo más específico que se sepa (anuncio → campaña → canal),
o sea las campañas otra vez. Ahora el filtro usa `canalDeLead` (`app/crm/origen-lead.ts`,
nueva) y el rótulo pasa de «Creativo» a «Anuncio». Lo hizo el chat de **Ads Manager**, no
este, porque no había un chat de CRM abierto.

**La ficha del lead.** Producto en el pop-up, campo Web, un solo WhatsApp, la cara del
contacto, sin «Reactivar» (`ee98547d`, `7f5377dc`, migs `0194_lead_web` y
`0195_lead_foto_guardada`); las fotos de WhatsApp se copian a nuestro bucket porque la URL de
WhatsApp vence a los 10 días (`0418a6ab`); la ficha dice por qué un lead no tiene grabación en
vez de inventar duraciones (`6106544d`); cada campo se edita en el lugar.

**Ganado y plata.** El paso a Ganado pregunta el monto del contrato, la tarjeta muestra la
suscripción («$X/mes») y se corrige en Deal Details (`9f9bfc57`); «Completar datos» ya no
devuelve al lead a la etapa de antes y la ficha se relee al guardar (`65ec2298`); al ganar se
puede invitar al curso, por embudo y **apagado por default** (`77279ea4`).

**Reuniones.** En el editor de etapas se marca qué etapa es una reunión (`adf1ca3d`); el
resumen muestra lo que el lead contestó en Cal.com (`0218e6ed`, `6cd9d5dd`); una reunión nueva
limpia la marca de «no asistió» (`6e75cc0c`); lo que contestó en el formulario de Meta se ve
legible en el pop-up, y su WhatsApp nace apagado (`e21003d6`).

**Etiquetas del CRM** (`f92559e0`, `3f3aadd8`, mig `0224_crm_etiquetas`). Pedido de Martín del
08/10: un CRUD de etiquetas por negocio, vinculables a etapas del CRM, que sirvan en las
condiciones de las automatizaciones, disparen CRON y se espejen en WhatsApp. El espejo
etapa↔etiqueta mira **transiciones** con una foto por workspace, no impone por barrido.

**El plazo de cada etapa y el lead quieto** (`5a4e3f04`, 09/10, tarea #800). Pastilla «Plazo»
en el editor de etapas y aviso diario `crm-lead-quieto` para los que pasaron el plazo, sin
moverlos y sin depender del CRM automático. **Nace sin efecto: nadie tiene plazos cargados
todavía.** En el mismo commit, `/crm/revisar` dejó de perder al contacto repetido de la
landing, sus productos y su campaña.

**Dos cosas de navegación.** El CRM entra directo al tablero, sin el panel de activación
delante (`713661d7`, 08/10: es una decisión más nueva de Martín que le gana a la regla
«onboarding en toda tab»). Y «¿Qué hacer ahora?» volvía a no abrir nada por dos capas en la
pila de modales para una sola pantalla (`b57a53ba`).

**Verificado ahora (10/10 19:04):** `tests/crm-orden-manual`, `crm-revisar-propuesta`,
`lead-quieto`, `crm-origen-lead` y `etiquetas-contrato` → **65 pass / 0 fail**.

---

## 2. Lo que NACIÓ en la ventana (el 05/10 no existía)

- **`lead_funnel`** (mig 0207): la tabla que permite un lead en varios productos, con
  `lib/lead-funnel.ts` (agregar, quitar —que promueve la casa—, mover, lote) y
  `lib/lead-funnel-reglas.ts` (puro, con test).
- **`lead_orden`** (mig 0200): el orden manual de cada columna del kanban. UNA fila por
  (embudo, etapa) con la lista de leads, no una posición por lead.
- **`crm_etiquetas`** (mig 0224): el catálogo de etiquetas de cada negocio y qué lead tiene
  cuál, con el espejo a las etapas y a WhatsApp.
- **`leads.meta_campaign_id`** (0193), **`leads.web`** (0194), **`leads.foto_auto_url` +
  `foto_auto_at`** (0195).
- **El plazo por etapa** y el aviso `crm-lead-quieto` (`lib/lead-quieto.ts`,
  `lib/lead-quieto-aviso.ts`).
- **Las acciones en lote del CRM** (`app/crm/AccionesLoteLeads.tsx`) y el arrastre de filas en
  la vista de tabla.
- **El filtro por campaña, creativo/anuncio** (`lib/campana-atribucion.ts`,
  `app/crm/origen-lead.ts`).
- **La asignación de campañas y conjuntos de Meta a un producto**
  (`lib/campana-asignar.ts`, `lib/campana-funnel.ts`, `lib/campana-traer.ts`,
  `app/crm/campanas-actions.ts`, `app/crm/CampanasModal.tsx`).

---

## 3. Lo que quedó a medio hacer o sin verificar, con el archivo donde vive

### ✅ El filtro «Anuncio» como ÁRBOL — TERMINADO y desplegado (lo escribe el chat de Ads Manager, que lo hizo)

A las 19:04 y 19:11 esta sección lo describía como trabajo sin commitear de otra sesión: era
el chat de **Ads Manager** (cuenta `claude2`) y ya está todo en `main`, desplegado y probado en
el navegador sobre Código Inmobiliario (ws13):

- **`bdbf3707`** — el árbol. Martín: *«No separes el filtro de Campaña y Anuncio... Que dentro
  del filtro de "Anuncio" estén las campañas primero como arbol y dentro se pueda seleccionar
  anuncios de esas camapañas»*. Una sola lista «Anuncio»: cada campaña con sus anuncios
  colgados (`arbolDeAnuncios`), cruce «O» entre los dos niveles (`pasaFiltroAnuncio`), y
  tildar/destildar en `app/crm/arbol-seleccion.ts` (puro, con test).
- **`8a39bb02`** — tres ajustes que pidió al verlo: *«El botón de desplegar debe estar a la
  derecha, no a la izquierda, siempre»*, *«quiero que se abra el desplegable cuando clickeo»*
  la campaña, y *«El ancho del desplegable debe ser más grande. Bajo ningún motivo debe tener
  scroll hacia la derecha»*. El panel pasa a 360 px y su lugar sale de `lugarDelPanel`
  (`app/crm/filtro-panel.ts`): nunca pasa el borde derecho de la ventana y nunca se mete
  debajo de la barra lateral.
- **`f531a170`** — destildar la campaña la vuelve a plegar (tildarla la despliega).
- **`0a55645e`** — se fue la fila de chips debajo de «Filtrar» y su «Limpiar»: *«No debe salir
  los chips de abajo del filtro y el botón de "limpiar" si para eso ya está la notificacion en
  filtros»*. Limpiar es «Limpiar filtros (N)» abajo del menú, igual que en el Plan.
- **`0deedbe5`** — los filtros (etapa, origen, campaña, anuncio y «Ordenar») sobreviven a un F5
  y a irse de la tab: se guardan en el navegador por cliente y por embudo.
- **`bd4251c9`** — la cosecha, en `docs/hallazgos-crm.md` («Campaña y Anuncio pasan a ser UN
  árbol…») y en la bitácora del CRM.

`tests/crm-filtro-ads.test.ts`: 17/17, cada guard probado rompiéndolo. Lo que NO se tocó: a
390 px de ancho la página del CRM ya tiene 55 px de scroll lateral ANTES de abrir el filtro
(medido el 10/10 con el panel cerrado); no es del filtro, y nadie lo pidió todavía.

### Lo demás, con su archivo

- **La COHORTE del panel lateral del lead.** El panel (`app/crm/LeadSheet.tsx:225`) no dibuja
  la cohorte que la ruta sí dibuja (`app/crm/[id]/page.tsx:207`), y hay un ⚠️ escrito en el
  archivo explicándolo: no se arregla pasando la prop, porque sale de `labelMadurez` /
  `estadoMadurezLead` en `lib/leads.ts:1980` (2.600 líneas, con dependencias de servidor) y
  `LeadSheet` es `use client`. Se calcula en el server y baja por props, como hace la ruta.
  Abierto desde el 05/10.
- **El duplicado del opt-in de la landing no lleva los productos.** Falta `funnelIds` en
  `FilaImport` (`app/crm/leads-importar.ts:211`, verificado: no está) y en el importador
  (`app/crm/actions.ts`). Hoy ese lead entra al producto del negocio y una persona lo tiene
  que agregar a mano desde la ficha.
- **Confirmar una propuesta MARCA DESPUÉS de crear**
  (`app/crm/revisar/[id]/acciones.ts:83`). El comentario de arriba lo declara a propósito
  desde el 11/08/2026 (`2d4201b2`) y afirma que «dos pestañas o un doble click crean UN solo
  lote». **Eso no lo pude verificar y la lectura del código dice que no se sostiene para dos
  pestañas simultáneas**: las dos crean y recién después una de las dos `marcarAplicada`
  devuelve false; lo que las salva es el dedup del importador, no la guarda. El molde de
  reclamar-antes-de-ejecutar ya existe en el repo: `lib/api-mako/acciones.ts:137` y
  `lib/api-mako/flujo.ts:172` (`marcarAplicada(id, { en_curso: true })` ANTES).
- **El barrido del espejo etapa↔etiqueta no lo ejecuta ningún test** (lo cubren `planEspejo`,
  que es puro, y guardas de fuente), y reconoce lo que tocó una persona por el **NOMBRE** en
  `lead_audit`: una etiqueta renombrada entre dos corridas se espeja igual. Sin medir contra
  datos reales. Vive en `lib/etiquetas-motor.ts` y en el cron
  `app/api/cron/crm-automatico/route.ts` (`conciliarEspejoEtapas`).
- **Dos leads en Ganado sin `fecha_cierre`** (uno en ws1, uno en ws13). Antes cualquier
  corrección les ponía la de hoy; ahora no se les inventa nada. Se completan a mano.
- **Ninguna de las pantallas de la ventana se miró en un navegador**, salvo el modelo de
  `lead_funnel` (verificado el 06/10 en ws4 con un producto de prueba que después se borró) y
  el grabador de sesiones. El resto —Ganado con monto, etiquetas, plazo por etapa, filtros—
  está verificado por tests y por lectura, no por ojo.
- **Las propuestas pendientes de ws11 (Leila): SIN VERIFICAR hoy.** El briefing del 09/10
  decía «5 contactos de su landing esperando en `/crm/revisar`, uno de hoy». No lo pude
  medir: requiere consultar la base. Lo que SÍ está medido y escrito en el repo es más
  viejo: `app/crm/revisar/page.tsx:15` registra **4 leads reales en `pendiente` en ws11 el
  14/08/2026** (Diana Vallin, Ibrahim Dosal, Marina Olvera, Magdiel Cortes). Si entrás,
  mirá la bandeja antes de prometerle nada a nadie.
- **Las tareas del tablero `Feature: CRM`: SIN VERIFICAR.** Vienen del briefing del 09/10 y
  viven en la base, no en el repo: **#671** («Agendar R2» necesita un Calendly conectado para
  probarlo, y sólo lo tiene el ws1), **#18** (el texto de los follow-ups), **#15** (en qué
  cliente se prende el piloto del CRM automático), **#40** (el planificador del CRM automático
  sigue en R1/R2 y necesita una migración para la reunión N) y **#20** (n8n: se apaga o se
  pasa el acceso).

---

## 4. Las trampas de esta área (esto es lo que ahorra tiempo)

**1. `funnel_id = NULL` ES el embudo del negocio, y el producto del negocio se escribe de DOS
formas.** El tablero del negocio pide sus leads con `.is('funnel_id', null)`; un `.eq()` con
null no matchea nada en Postgres (`= NULL` es NULL, no true) y pierde los leads en silencio
—1.530 al 05/10—. Y como **fila** de `lead_funnel` el producto del negocio va con su id REAL
(la FK no admite NULL). Escribir el id del default en `leads.funnel_id` deja al lead **fuera
de TODOS los tableros**, con el producto correcto escrito y sin un error. Toda escritura de la
casa pasa por `casaParaEscribir` (`lib/lead-funnel-reglas.ts`).

**2. «¿Está en este producto?» se contesta por CASA o por FILA, y hay que mirar las dos.** Los
lectores que lo preguntaban se fueron encontrando de a uno: el dedup del alta, «Traer de otro
producto», el lote, la traída de campañas, la validación del orden manual
(`app/crm/orden-actions.ts:71-77`) y el conteo por etapa — en ése, sin sumar las filas, una
etapa con gente agregada decía 0 y se borraba **sin preguntar**. El próximo lector que
pregunte por `leads.funnel_id` solo, mide la mitad.

**3. Lo que lee SÓLO la casa, a propósito (decisión v1 de Martín):** métricas, el CAPI de
Meta, el CRM automático, MaKo, la nutrición, la etiqueta de WhatsApp y Customer Success. Es lo
que hizo posible cambiar el modelo sin tocarlos. No es un olvido; está escrito en la cabecera
de `supabase/migrations/0207_lead_funnel.sql`. La consecuencia de producto está abierta y la
decide Martín (sección 5).

**4. El tablero no ve una columna que su `select` no pide.** Los mappers de `app/crm/crm-map.ts`
leen campos que `LISTA_COLS` (`lib/leads.ts`) tiene que traer. Una categoría de filtro sin
opciones **no se ofrece** (`app/crm/CrmToolbar.tsx:449`), así que una columna que falta no se
ve como un error: se ve como un filtro que no existe. Eso fue exactamente el bug del 10/10, y
el diagnóstico obvio (la atribución) era el equivocado: su test pasaba. Desde `686c51be` hay
un guard del CABLEADO, derivado del tipo `LeadAtribuible` y del cuerpo real de las funciones,
no de una lista copiada.

**5. Mover un Ganado a una etapa ABIERTA le limpia la venta.** No es un bug suelto: está
escrito y es consciente en `lib/lead-desenlace.ts:38` y `lib/leads.ts:918`. La causa es que
`setPipelineStage` manda SIEMPRE `estado_lead`, y la coerción del desenlace corre cuando el
caller tocó un campo que decide la venta. Pasar de «Facturando» a «Falta pago» entra ahí.
Es una línea para cambiarlo y la decide Martín (sección 5).

**6. La etapa que se VE no es `pipeline_stage`.** Es `pipelineStageOf`: el override o la
derivada de las fechas, y en la mayoría de los leads la columna es NULL. Agendar por Calendly,
marcar asistencia o ganar desde la ficha mueven la etapa **derivada** sin escribirla. Por eso
el espejo de etiquetas mira transiciones comparando `pipelineStageOf(antes)` contra después, y
no la columna. (El hallazgo viejo «stageMeta miente» es de esta misma familia.)

**7. El techo de 1000 filas de PostgREST.** Un `.select()` suelto anda perfecto hasta que la
tabla pasa las 1000 y desde ahí pierde datos sin un log. Ya se pagó en este área: el CRM
mostró 4 ganados de 13 (US$52.700) porque `_listLeads` no paginaba. Se lee con `leerTodo` /
`leerPorPaginas` (`lib/supabase-paginado.ts`) y con un orden que termine en una columna
ÚNICA. `.limit(2000)` no sube el techo.

**8. `docs/hallazgos-crm.md` tiene 7.771 líneas: NO se abre entero.** Se busca con `Grep` de
la ruta del archivo que vas a tocar — cada entrada trae adentro su línea `**Vive en:**`. Abrirlo
completo son decenas de miles de tokens para encontrar una cosa.

**9. El fin de línea es POR ARCHIVO en este clon.** `app/crm/[id]/page.tsx` es LF y otros del
mismo directorio son CRLF. Un script de parcheo contesta «0 coincidencias» sobre un ancla
copiada carácter por carácter del propio archivo. Y un guard con regex sobre fuente va con
`\r?\n`, nunca `\n` solo.

**10. La herramienta de búsqueda reescribe `/` como `\` en el CONTENIDO que devuelve.** Un
`//` que vuelve como `\` es la firma. `Grep` sirve para ENCONTRAR, no para CITAR: antes de
reportar un bug que depende de un carácter, releé la línea con `Read`.

**11. Hay varias sesiones sobre este MISMO clon y el árbol no tiene un estado, tiene una
hora.** Un rojo de un test puede no ser tuyo (hoy pasa: ver sección 3). Antes de acusar a
nadie: `git status --short` de los archivos que el error nombra, y `git show HEAD:<archivo>`
para saber si el bug existe en HEAD o sólo en el disco de alguien que está tipeando. Y
**nunca** `git add -A` ni `git commit` pelado: va `git commit <ruta> -F <msg>`.

**12. El próximo número de migración NO es 0225.** En disco hay hasta `0242_canales_zernio`,
y además existen **DOS archivos con el número 0223** (`0223_curso_papelera` y
`0223_flujo_grafo`), que es la colisión clásica de dos sesiones eligiendo el mismo número.
Antes de nombrar una migración nueva: `git pull` y `ls supabase/migrations/ | tail -5`.

---

## 5. Qué espera una decisión de Martín

Ninguna de estas se decide sola y ninguna se re-pregunta si ya está contestada en el chat.

1. **Ganar en un producto AGREGADO no marca al lead como ganado.** Es la v1 a propósito (manda
   la casa), y la consecuencia es que si alguien compra el segundo producto, esa venta no
   existe para Revenue, el CAPI de Meta ni Customer Success hasta que ese producto sea la casa.
   **Opciones:** (a) dejarlo así y que el equipo cambie la casa al ganar; (b) que ganar en
   cualquier producto marque al lead como ganado y la plata se sume por producto; (c) que el
   monto viva en la fila de `lead_funnel` y Revenue sume casa + filas.
2. **La casa de un opt-in de la landing con varios productos es el PRIMERO tildado** en la
   configuración. **Opciones:** (a) alcanza el orden de los tildes; (b) hace falta marcar
   explícitamente cuál es el principal.
3. **Mover entre dos etapas abiertas limpia la venta** (Facturando → Falta pago).
   **Opciones:** (a) dejarlo; (b) limpiar sólo cuando el estado CAMBIA de verdad (Ganado →
   abierta). Es una línea en `setPipelineStage`.
4. **El «Deshacer» de «Monto de cierre» sobre un lead abierto no hace nada**, porque el monto
   decide la venta y el lead no tiene `cerro`. **La pregunta:** ¿el monto puede vivir en un
   lead abierto? Hoy ya lo escriben por otro camino `lib/pagos.ts` y el editor del deal.
5. **La etiqueta que pone una ETAPA no dispara automatizaciones** (sólo dispara ponerla
   directo: la ficha, la API, un paso «⚡ Acción»). Es una decisión del constructor, tomada
   para que mover 200 leads en lote no disparara 200 WhatsApps. **Se la puede dar vuelta.**
6. **Prender en cada cliente lo que nació apagado:** la página de gracias → Ganado, invitar al
   curso al ganar, el WhatsApp de las respuestas del formulario de Meta. Nada nace prendido, a
   propósito.
7. **Los plazos por etapa están vacíos para todos.** El aviso del lead quieto existe y no
   avisa de nada hasta que alguien cargue plazos. ¿En qué cliente se arranca?
8. **Los datos mal cargados de ws11 (Leila), que son suyos y no del código:** Nadia #2605
   tiene como mensualidad 4.235,29, que es el TOTAL del contrato (con 12 cuotas de 4.235,29
   pendientes, eso infla el MRR un 85%); de Fabi #2606, ¿los 444 son USD o pesos?; y Fabi
   sigue en dos productos (Nora #2610 ya no). **Sin verificar hoy**: viene del briefing del
   08-09/10.
9. **Las tareas #671, #18, #15, #40 y #20** del tablero `Feature: CRM` (ver sección 3).

---

## 6. Correcciones al briefing anterior

Lo que el briefing previo daba por abierto y **ya no es cierto**:

- **«`AGENTS.md` sigue citando el opt-in viejo como ejemplo de "un alta que crea N filas"»** —
  **FALSO desde el 09/10.** El commit `5a4e3f04` le agregó el párrafo que lo corrige: *«⚠️ Y
  ANTES DE ESCRIBIR EL BUCLE, PREGUNTÁ SI SON N COSAS O UNA COSA EN N LUGARES. El opt-in de
  arriba ya no crea N fichas: desde el 06/10/2026 (`f26c0a94`) crea UNA y le AGREGA los otros
  productos»*. Verificado en `AGENTS.md`, sección «Un alta que pasa a crear N filas…».
  ⚠️ **`docs/hallazgos-crm.md:7086` todavía lo lista como pendiente** — ese archivo no es
  mío en esta corrida y lo dejé como está; el que lo toque, que lo saque.
- **«Hay que arreglar el filtro de anuncios» / «es una hipótesis sin medir»** — **HECHO el
  10/10 a las 17:08** (`686c51be`), con los datos medidos en ws13 (52 leads, 44 con
  `utm_content`, 13 anuncios). Y ya quedó viejo otra vez: hay un pedido posterior del mismo
  día, en curso y sin commitear (sección 3).
- **«Confirmar una propuesta no marca antes de crear» como simple pendiente** — es más matizado:
  está **decidido a propósito** desde el 11/08 con su comentario, y lo que no se sostiene es la
  afirmación de ese comentario sobre dos pestañas simultáneas (sección 3).
- **Los dos rojos de la suite que el briefing del 09/10 reportaba como ajenos**
  (`tests/curso-tareas-secciones` y `tests/inbox-agregar-al-crm`) ya no son el problema del
  momento. El único rojo que vi hoy en esta área fue `tests/crm-filtro-ads.test.ts` a las
  19:04, ajeno y transitorio: a las 19:11 ya estaba verde (sección 3). **Si lo reportás,
  fechá la lectura y volvé a medir antes de mandar el mensaje** — re-correrlo cuesta
  segundos y acusar a la sesión de al lado de romper el repo cuesta un turno de ella.

## 0-Ω19. 21/10/2026, madrugada (chat «CRM», cuenta `claude4`): Ops Center 2.1, lo que le faltaba a Chats

Cinco operaciones del área `chats` con la tarjeta (D3a: el toque en «Enviar» es la aprobación): mandar un WhatsApp
(por la cola de borradores), contestar un DM y un email, agregar un contacto al CRM y marcar leído. Test
`tests/chats-mako-envio.test.ts`; cosecha en hallazgos-comunicacion. El pedido directo depende de la 1.2 (rama
`mako-wa`); el «sí» a un ofrecimiento ya llega en main (ver la tercera revisión). No visto en el navegador.

Revisión del Cerebro sobre c2de8a159 (21/10): los 7 medios arreglados, más dos bajos (MaKo ve la columna propia; la
cartera de a tandas). Queda bajo: «Hacerlo» por el chat no calla la sugerencia en el server. Detalle en hallazgos-plan,
hallazgos-crm y hallazgos-customer-success (las tres «Lo que encontró la revisión…»).

Segunda revisión (21/10): la 2.1 rehecha. Los tres envíos sólo por la app («un envío al lead se aprueba con un toque»),
la rueda de áreas como en main, la tarjeta muestra entero lo que sale, el canal por la cosa nombrada, el bloqueo en la
puerta única, y los bajos (VSL sólo después del alta, el rechazo por su evento, MaKo y la columna propia en historial y
listas). ~~Sin la 1.2, la 2.1 no llega en la app~~: falso, ver abajo.

Tercera revisión (21/10): ⚠️ **la 2.1 llega HOY a la app** por el «sí» a un ofrecimiento (un «¿le contesto por DM…?» +
«sí, dale» trae los tres envíos); con la integración llega a producción. Arreglado: reusar sólo un borrador de texto de
la misma línea; el bloqueo por los últimos 10 dígitos en la puerta; el número con país en la tarjeta; la bandeja
/mako/pendientes con `lineasDelPayload`; mover a una columna propia por su nombre; el canal leído del pedido y no de lo
dictado; «mándale/contéstale» sólo aceptan; «no sé si salió» en un corte por tiempo; el rechazo de Clients atado a su
cobro. Queda: el borrador que vuelve a pendiente tras un corte por tiempo (puede duplicar); dos cobros con el mismo
concepto. Cosecha en hallazgos-comunicacion, hallazgos-api-mako, hallazgos-plan y hallazgos-customer-success.

Al integrar con `mako-wa` (MaKo Alert, 21/10): esa rama suma `AccionDef.aTerceros` y `tests/confirmacion-terceros.test.ts`
frena las acciones de chat que le escriben a alguien sin la marca. Los tres envíos de la 2.1 (`enviar_borrador_whatsapp`,
`contestar_dm`, `contestar_email_chat`) llevan `aTerceros: true`: lo pone la rama que entre SEGUNDA (hoy la marca no
existe en main y el tipo no la acepta).

Cuarta revisión (21/10): la media venía de PRODUCCIÓN (desde el 20/10, ws11): un bloqueado desde /chats seguía
recibiendo la secuencia, el AI Step, la rama y los recordatorios. La identidad de un bloqueo es ahora UNA regla
(`TelefonosDe` / `mismoContacto`, lib/numero-whatsapp.ts) en `estaBloqueado`, desbloquear, ocultar y las listas.
También: `lineasDelPayload` pinta las listas de objetos elemento por elemento; «respóndele sí» dicta; el canal corta en
«: » y las redes cuentan con «por»; «fetch failed» es «no sé si salió»; el reuso compara el número entero con país;
`agregar_contacto_al_crm` sólo por la app. Queda: el id del cobro en el evento del rechazo (compartir concepto es lo
normal), el «sí» a «¿le contesto por WhatsApp?», el borrador incierto que vuelve a pendiente, y MaKo-whatsapp con 9
dígitos. `aTerceros` sigue sin estar en main al 21/10 (ef0fe3464).

/crm en lista, escritorio chico (21/10, pedido de Martín vía el Cerebro, rama `crm-lista-chica`): columnas con prioridad
por el ancho medido, encabezado y etapa que recortan, Empresa a la fila. Medido con el arnés: 0 textos fuera de su celda
a 934×639 y 1024×768 (antes 5 y 4). Falta verlo en la app real.
