# Relevo — Pagos: la pasarela (Stripe y Mercado Pago), los cobros de MaKo y la tab Pagos del lead

**Al 17/10/2026, ~02:30 AR (cuenta 4, `claude4`).** El chat jefe «Pagos». Lo aprendido vive en
[hallazgos-pagos.md](../hallazgos-pagos.md) (la tab y las cuotas) y en
[hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «La pasarela» (Stripe, Mercado Pago, el plan de MaKo y
el cliente de agencia). La historia de cada cambio está en `git log`.

## 29/10/2026 · el plan por TRAMOS (chat «Pagos», cuenta `claude3`, ticket #13 de Leila)

Rama `pagos-tramos-2910`, worktree `C:/dev/wt-pagos-tramos` (desde origin/main 7f36fa9c6). Lo aprendido:
docs/hallazgos-pagos.md → «El plan por TRAMOS». Sin migración. Copiado de las fases de Stripe y del plan de pagos de Kajabi.

- **Hecho:** «Armar el plan» de la ficha es por tramos (hasta 10: monto, moneda, cada mes/quincena/semana, cuántas o hasta
  cuándo), con anticipo y cada cuota editable antes de guardar; abre con el plan que ya hay; en una suscripción también (la
  pasa a «Pago único»); Deshacer. Una cuota en pesos se recuerda, se marca pagada y se cobra por link en pesos.
- **Probado:** tests/pagos-tramos.test.ts (18, con las cuotas reales de Nadia; 13 roturas atrapadas) y el editor dibujado con
  su ficha (tests/_plan-tramos-hijo.ts). **No recorrido en el navegador** (sin build por la RAM): va en el ws3 después del deploy.
- **Para retomar:** si el VERDE no salió, falta el tsc acotado (`node C:/dev/con-turno.mjs node scripts/tsc-acotado.mjs …`
  sobre los archivos de `git diff --name-only origin/main`) y `tests-afectados --rapido` por con-turno; después, el sha al
  Cerebro y a Integración.
- **No hecho a propósito:** el plan de Nadia (lead 2605) lo arma Leila; nadie le escribió. El ticket #13 está en
  «esperando_decision»: el cron no lo cierra con el hito hasta que alguien lo apruebe.
- **La revisión de Integración sobre 9fc4030dd (29/10): NO ENTRABA.** Dos altas de plata (A1: cobrar a medias una cuota en
  pesos con los dólares vacíos la tomaba entera; A2: el anticipo quitado o devuelto volvía al abrir y guardar) y tres medias
  (M1 «tal cual» en la protegida reasignada, M2 la moneda en los cambios a mano, M3 dos pestañas duplicaban). Arregladas las
  cinco, más B4 (tope con el anticipo) y B5 (el total en dos monedas). Informe: C:/dev/revisiones/2910-verificacion-pagos-tramos-9fc4030dd.md;
  lo aprendido, en hallazgos-pagos.md → «La revisión adversarial de 9fc4030dd». B1, B2 y B3 quedan anotadas como «sin hacer».
  **Para retomar:** si el VERDE nuevo no salió, falta correr tests/pagos-tramos.test.ts, el tsc acotado y tests-afectados por
  con-turno, commitear y mandar el sha a Integración (que re-verifica con sus guiones de C:/dev/revisiones/scratch-9fc4/).
- **Ticket #26 (Mauricio, ws1, pedido del Cerebro el 29/10):** MaKo no podía armar un plan desde el Ops Center («7500 dolares
  en 3 pagos, primer pago 28 de octubre…»). Se sumó `armar_plan_por_tramos` (área cobros, por chat, `plata`) con su ruta
  `PUT /cobros/ventas/{leadId}/plan`: la misma regla que la ficha (`planPorTramosDelServer`, lib/pagos-campo.ts) y la misma
  escritura (`guardarPlanPorTramos`, lib/pagos.ts). Probado de punta a punta en tests/api-mako-plan-tramos.test.ts con el caso
  del ticket en el ws de prueba. **Para retomar:** medir que la frase del ticket le traiga la herramienta al Ops Center
  (scratchpad `medir-turno.ts`, después una fila en tests/ops-center-clasificador-app.test.ts), regenerar docs/api-mako.md, el
  snapshot y plugin/ (`node --import tsx scripts/generar-api-doc.mjs`, `node scripts/generar-plugin.mjs`), y el VERDE con
  `tickets: [13, 26]` a Integración y al Cerebro. Nada en el ws1.
- **Hecho (29/10, mediodía):** todo lo de arriba, con `origin/main` mergeado. VERDE a Integración y al Cerebro con tsc limpio,
  los tests dirigidos y las 18 roturas atrapadas; el tests-afectados después del merge NO se corrió (el Cerebro: lo corre
  Integración sobre el tren). Queda: recorrerlo en el navegador del ws3 después del deploy, y que Leila (#13) y Mauricio (#26)
  armen sus planes; los dos tickets siguen en «esperando_decision».
- **29/10, tarde:** 805afb460 entró al tren. Su chequeo dio un rojo mío (tests/mako-no-puedo-falsos.test.ts, caso 2): la
  definición larga de `armar_plan_por_tramos` le sacaba el lugar a `editar_cuota`. El arreglo va en la rama aparte
  `pagos-tramos-fix-2910` (d9ad67553, worktree C:/dev/wt-pagos-fix), mergeada acá. Encima, la re-verificación (N1 a N4, B6 y B7)
  y la **migración 0347, APLICADA en producción el 29/10** (el Cerebro, con el sí de Martín: «Sí, cambialo»): la diferencia de un
  cobro a medias queda en la moneda de la cuota. VERDE de la punta 1e491702e mandado; va al tren siguiente, después de que
  Integración la re-verifique con sus guiones de C:/dev/revisiones/scratch-805a/.
- **29/10, 15 h:** el plan por tramos y `armar_plan_por_tramos` están EN PRODUCCIÓN (main 1cf06eba9); los hitos [13, 26]
  cierran los tickets. 7f79a4e6c entró en el tren-ac. La tercera vuelta de Integración
  (C:/dev/revisiones/2910-reverificacion-pagos-tramos-7f79a4e6c.md) dejó seis bajas, B8 a B13, arregladas encima en esta rama
  (lo aprendido, en docs/hallazgos-pagos.md, «La tercera vuelta»). Se quedó sin commitear: sigue en el 3/11, abajo.
- **3/11/2026 (chat «Cobros: cuotas», cuenta `claude5`):** B8 a B13 sólo vivían en esta PC; commiteados (32d93c59c) y con
  origin/main traído (752 commits; sólo chocó la fila de Pagos de docs/hallazgos.md). Nada de esto está en main: la punta la sube el
  Cerebro. Lo aprendido, en docs/hallazgos-pagos.md, «El rescate de la tercera vuelta».
  **Corrido:** los 4 que toca el cambio, los 160 que nombran un archivo cambiado y 22 de los que lo importan, de a uno. **Sin correr:**
  las 197 barredoras y los otros 321 que importan: los corre el tren (`tests-afectados --listar` da 704 de 2045).
  **Rojos que no son de esta punta** (ninguno de sus archivos está en el diff contra main; no se corrieron sobre main):
  tests/api-mako-registro.test.ts (el título de `listar_capacidades_mako`, y docs/api-mako.md viejo en Ads),
  tests/leads-scraper-retirado.test.ts (lib/spy-otras-redes.ts) y tests/progreso.test.ts (tres hitos de «Tickets de Leila» sin `sesion`).
- **DECISIÓN DE MARTÍN, SIN TOMAR. Una cuota en pesos cobrada entera, ¿queda saldada aunque los dólares declarados den menos?**
  Caso: cuota de MXN 12.000 (US$600); entran los 12.000 y se declaran US$500 porque la tasa se movió. Hoy queda una cuota nueva de
  US$100 en dólares, y entra a lo pendiente y a la cobranza de alguien que pagó lo pactado. El aviso de fábrica va al grupo del
  negocio; al cliente le llega si el negocio editó ese flujo o si el dueño le cree al aviso. Sin medir: cuántas filas así hay hoy.
  - **A. Los pesos enteros saldan la cuota.** Sin diferencia y sin migración: se toca `cobrarCuota` (lib/pagos.ts), el resumen de
    `marcar_pago_cobrado` (lib/api-mako/areas/crm.run.ts) y el «Faltan» del modal (piezas.tsx). Lo cobrado en dólares queda en
    US$500, y el historial tiene que decir «diferencia de tasa», no «descuento». Es lo que recomienda este chat: el cliente cumplió.
  - **B. Como está.** Quien cobra elige en cada caso: «Quedan pendientes» o «Es un descuento». Por la API, sin aclarar, queda pendiente, y
    el resumen lo dice antes del «sí». Sirve si el negocio realmente cobra en dólares y los pesos son sólo el medio de pago.
  Se le pregunta a Martín por el Cerebro; no hay código escrito para ninguna de las dos.

## 23/10/2026 · el primer cobro real, antes del lanzamiento (chat «Cobros», cuenta `claude1`)

Rama `cobros-lanzamiento-2310` (worktree `C:/Users/marti/wtp-lanz`), pasada al Cerebro para el tren. Lo aprendido:
docs/hallazgos-planes-y-cobro.md → «El primer cobro real de un plan de MaKo», con la tabla de lo que falta (lo de
noviembre va antes de la primera renovación, ~25/11). **La prueba de humo para Martín:** [docs/prueba-humo-cobro-mako.md](../prueba-humo-cobro-mako.md),
apenas conecte la pasarela y ANTES de que las landings manden a /planes.

En /admin/cobros: «Cortar la suscripción», la casilla de cortar al reembolsar, «Darle el plan a su cuenta» y «Planes en
Mercado Pago» (el precio en pesos). En /planes, las claves de prueba sólo para el super admin. En /integraciones, la
dirección del aviso de MP con `?u=` y una clave de prueba de Stripe que ya no pisa a la real.

**En producción el 23/10/2026** (`309c54ef4`, con `630c44b4e` de Planes que la contiene): la tanda `ac21e6b4b` y la punta del alta
(`33c44d41e`, chat «Cobros», cuenta `claude2`). Medido ese día: el acceso sin Gmail ya lo dicen el mail y /listo (correo y
contraseña, «¿Olvidaste tu contraseña?»); el «Vincular cobro» de Stripe ya lee los productos en vivo (`51c89251b`, sin medir con
clave real: la primera lectura real es la de Mauricio); y el alta se prueba ejecutándola (tests/alta-cliente-conducta.test.ts),
con un mail que tira ya no tumbando el alta. **No hay botón para reenviar el mail de acceso a la MISMA dirección** (solo
«cambiar el email»); no urge porque la fila de usuario ya autoriza el ingreso. **Lo único que falta para cobrar es de Martín:**
conectar la pasarela, el precio en pesos, la automatización «Entró un pago» y la prueba de humo. Detalle y lo sin hacer:
hallazgos-planes-y-cobro.md → «Quien paga sin Gmail…».

## 17/10/2026 · los pendientes B4 (rama `pend-b4-1710`, agente «Pendientes B4: Ads y plata»)

Lo aprendido: `docs/hallazgos-pagos.md` §5 y `docs/hallazgos-planes-y-cobro.md` → «Quien deja de pagar deja de entrar».

| Qué | Dónde |
|---|---|
| **Quien deja de pagar su lugar deja de entrar**: el cron de la pasarela pausa el negocio cuando se terminó lo pagado (+5 días) y lo reabre al pagar; un negocio pausado va a /cuenta-pausada y la API contesta 403 | lib/plan-acceso{,-reglas}.ts · lib/workspace.ts · app/cuenta-pausada |
| Marcar a mano una cuota cuyo link ya se cobró no cuenta la plata dos veces | lib/pagos.ts · lib/cobros.ts (`asentarLinkPagadoDeCuota`) |
| El cartel «no está en tu plan» y el corte de la API por plan | lib/tab-access.ts · lib/api-tab.ts |
| Identidades fiscales sólo del admin; la moneda del negocio con pantalla | app/crm/[id]/deal-actions.ts · app/configuraciones/MonedaNegocioPanel.tsx |
| La cobranza lee todas las cuotas (cortaba en 1.000); la renovación desde el último cobro; «De baja» en el Dashboard | lib/pagos.ts · lib/cobrado-lead.ts · lib/graficos-datos.ts |

**Medido** (sólo lectura): el `in` sobre `ctx->>cuotaId` no traba guardar cuotas ni cerrar en Ganado. **0 cobros en
producción** el 17/10: el corte por falta de pago no toca a nadie hoy.

### ⚠️ APAGADOS por la revisión adversarial del 17/10 (para después del 20/10): se prenden SÓLO con su arreglo y su revisión

La revisión de 65e299c2e confirmó 9 defectos reales, todos en tres cambios que quedaron en el código con un interruptor en
`false` (el informe: scratchpad/revision-b4.md de la sesión del Cerebro del 17/10):

| Interruptor | Qué apaga | Los defectos que hay que arreglar antes de prenderlo |
|---|---|---|
| `CORTE_DE_ACCESO_PRENDIDO` (lib/plan-acceso-reglas.ts) | El cron que pausa y reabre por falta de pago, y que un negocio pausado no se abra (/cuenta-pausada, el 403 de la API) | (alta) el cron sólo ve los cobros con `alta_ws`: un plan nuevo vendido a una cuenta que ya existía (`ya_tenia_cuenta`) queda afuera y la pausa no se levanta aunque pague · (media) un primer pago DEVUELTO con la suscripción activa da «vencido» y pausa a quien paga (un reembolso no cancela la suscripción) · (media/baja) las cuotas de los lugares se leen sin paginar (`plan-acceso.ts:84`) · (baja) el tope de 5 y el orden de los pasos |
| `CORTE_POR_PLAN_PRENDIDO` (lib/api-tab.ts) | El corte de la API por plan y el cartel «no está en tu plan» (`requireCapa` vuelve al redirect a la casa del plan) | (baja, de cara al cliente) un negocio con capa `pm` entra por /inicio a /general y ve «No está en tu plan»: el repartidor de /inicio manda a una tab que esa capa no tiene |
| `MIRAR_LINK_ANTES_DE_MARCAR` (lib/pagos.ts) | Preguntarle a la pasarela antes de marcar una cuota a mano | (alta) con un link en estado «pagado», `asentarLinkPagadoDeCuota` (lib/cobros.ts) da la cuota por cobrada aunque `aplicarPagoAprobado` no marque nada: una cuota destildada por error (ws1) ya no se puede volver a marcar y queda IMPAGA para siempre, y cada intento repite «Entró un pago» · (media) el paso 1 tiene que exigir que la cuota NO esté asentada por ese pago, no sólo que el cobro esté pagado |

Con los tres en `false` el producto se comporta como antes del 17/10 en esas tres cosas (marcar a mano vuelve a poder contar
dos veces un link pagado sin asentar; quien no paga sigue entrando). Los tests que dependen de ellos fijan que están
apagados (tests/plan-acceso.test.ts, tests/api-tab.test.ts, tests/pagos-link-ya-pagado.test.ts).

**Lo que quedó SIN hacer, con el porqué (para después del 20/10: corte de consumo del Cerebro, 17/10):**
- **Precios en moneda local en el catálogo** (`lib/productos.ts`, `lib/api-mako/areas/cobros.run.ts`): pide una columna
  nueva en `productos` (migración) y su pantalla; no entró en esta corrida.
- **Los bloques de Pagos que no se dibujan** (`confirmacion-de-pago`, `recordatorios-de-cobro`, `excepciones`,
  `cliente-en-cs`, app/crm/lead-view/ficha/reglas-pagos.ts): cada uno necesita su lectura, y los recordatorios por lead
  piden la columna `lead_id` (mig 0186). No entró.
- **Mirar en el ws3** la tab Pagos, la «Baja del cliente» y la tarjeta del cliente de agencia (leads 2739 y 2740), y
  /cuenta-pausada: no hubo RAM para un build.
- **Que el corte avise**: hoy queda en el log del cron y en el chip «pausado» de /admin. Un aviso a Martín (y al cliente)
  sería un Evento de MaKo del catálogo de avisos, que es del chat de Automations.

## Lo de esta sesión (rama `pagos-agencia-clientes`, en `C:/dev/wt-pagos`; pasada al Cerebro, sin pushear)

| Commit | Qué |
|---|---|
| `88be542a5` | **#871 «Baja del cliente»** en las cuotas: lo que no pagó deja de ser deuda en todos lados y lo cobrado queda. Mig **0307** (`pagos.baja_at`, `pagos.baja_vencia`). Botón en el bloque `cuotas`, «Deshacer la baja», y la API `baja_del_cliente` |
| `05f288bac` | La baja tolera una base sin la 0307 (lecturas con `*`), pedido del Cerebro |
| `b6dd0a6be` | **#866 y #867, el cliente de una agencia**: al abrirle la cuenta, el link de Mercado Pago de su primer mes; pagarlo lo habilita solo; su mes corre desde que termina el onboarding, y ahí nace la suscripción mensual (`start_date`). Mig **0308** (columnas en `cobros`). Precio en `/admin/cobros`. API `ver_pagos_clientes_agencia` |
| `344503de7` | **#891**: «Quitar» una cuota se ve en el acto (la confirmación se cierra al confirmar, el renglón dice «Quitando…»). No falló la primera vez: tardó sin decir nada. **#890** verificado leyendo el ws1: es un DATO (la cuota 3 de Adrián Medina está sin cobrar), no un bug de General; su cierre está propuesto en /plan/revisar/propmvc7x28lhhqis |

Las dos migraciones las aplica el Cerebro ANTES del deploy que las lee.

## 20/10/2026 · el aviso de la cuota y las suscripciones (en producción), y los bloques de Pagos en el chat (2.27 y 2.28)

| Commit / rama | Qué |
|---|---|
| `908d73d9f` (run 172, en producción) | El aviso de una cuota dice de quién es, cuánto y cuándo venció, y lleva a la ficha (lista, push y correo). «Clientes por cobrar» suma las suscripciones: General, el teléfono, el Dashboard y la API |
| rama `pagos-bloques` (**en producción el 21/10**: 83d0c1ddb, run 209) | **2.27:** «A quién cobrar» se DIBUJA en el chat (la lista de General, viva, con «Cobrada» y las suscripciones). **2.28:** el estado de cuenta de un lead en el chat (la pieza de la tab Pagos) y el comprobante adjunto que «Marcar pagada» lee solo. Para eso, una LECTURA puede dibujar: `ctx.aDibujar` (hallazgos-second-brain.md) |

~~**La rama `pagos-bloques` espera a que `ola1` entre en main**~~: la ola 1 ya está en main (21/10) y la rama la tiene.
La revisión del Cerebro (21/10) frenó tres medios del comprobante del chat; arreglados en la misma rama: va atado a su
cuota y al lead que dice el modelo (`comprobante: true` en `cobranza_lead`), y el monto del recibo llega al formulario.
El detalle, en hallazgos-pagos («La revisión de los bloques»). **Sin hacer:** /api/extract-receipt guarda el
comprobante al leerlo, no al guardar el pago.

## 21/10/2026 · el cobro a prueba de fallas (cinco revisiones adversariales)

- En producción: marcar un cobro dos veces no lo cambia, «hoy» es el día del negocio (4559998ab), y la escritura del cobro es
  condicional (0f55e9abd). Y `pagos-cobro-bordes` (5f433c96b, run 193, con la 0318 aplicada antes).
- Rama `pagos-plan-sueltos` (quinta revisión): lo cobrado suelto se cuenta por plata (`mesesDePlata`) en el asistente y en
  la ficha, qué es un plan lo dice `pagosPrevios`, el plan uniforme no se arma encima de una seña, y lo que gana con el
  plan lleva su fecha de cierre. El detalle, en hallazgos-pagos («La quinta revisión»).
- Rama `pagos-cobro-bordes` (ya en producción): el cobro de menos va en una transacción, la **mig 0318** (`cobrar_cuota_con_resto`), que
  **se aplica ANTES del deploy**. Sin ella, un cobro por menos no se guarda y lo dice; el cobro entero sigue igual.
  Además: el asistente de Ganado no rehace un plan, la primera cuota es el día del cierre, la pasarela cura su «ya estaba»
  y el día de cierre es el del negocio. El detalle, en hallazgos-pagos («La tercera revisión»).
- Cuarta revisión, en la misma rama: el plan del asistente lo decide `planDelAsistente` (los pagos sueltos ya cobrados
  son las primeras cuotas; nunca nace una cuota por un mes cobrado), lo que no se hizo se muestra, y la 0318 lleva su
  revoke/grant y el `order by id`. El detalle, en hallazgos-pagos («La cuarta revisión»).
- ~~**Sin hacer:** medir las suscripciones corridas un mes y las que recibieron cuotas encima de meses sueltos.~~ Medido
  en producción el 21/10 (sólo lectura): ninguna con cuotas encima de meses cobrados, ninguna ganada con plan y sin
  cierre, y UNA corrida un mes: **ws 11, lead 2605** (12 cuotas desde el 08/11, cierre el 08/10, nada cobrado). Decide
  Martín con el cliente si octubre se cobró; no se toca sin su OK.
- ~~**Sin hacer:** la 0318 no ve si el MONTO de la cuota cambió entre la lectura y la toma.~~ En la rama
  `pagos-plan-sueltos` (revisión de 7524ec1c9): la **mig 0323** (`p_original` y `pagos.resto_de`, la marca de la
  diferencia de un cobro por menos) **se aplica ANTES del deploy**; la aplica el Cerebro cuando la rama pase la revisión.
  Sin ella, un cobro por menos no se guarda y lo dice («falta la migración 0323»). Qué es cuota del plan lo dice
  `esCuotaDelPlan`, y lo cobrado se cuenta de a una cobrada (`mesesDeUnaCobrada`). El detalle, en hallazgos-pagos.

## Lo que sigue, en orden

0. **Mirar los bloques del chat en el ws3** cuando estén en producción: «mostrame el dashboard de cobranza: a quién le
   falta pagar» (dibuja la lista; «¿quién me debe plata?» todavía no llega a `a_quien_cobrar`, eso es la 1.2) y un recibo
   adjunto con «¿cuánto me debe Francisco?» (lead 2739: el estado de cuenta, y «Cobrar la cuota» con el recibo leído).
   Y arreglar el «hoy» en UTC de la ficha (hallazgos-pagos.md §4).

1. **Que Martín conecte la Mercado Pago de MaKo** en `/integraciones?ws=9` y cargue el **precio en pesos** del cliente de
   agencia en `/admin/cobros`. El 17/10 el ws9 tenía 0 claves de pasarela y 0 cobros. Sin las dos cosas, abrir la
   cuenta de un cliente de agencia queda como antes (espera la aprobación) y no sale ningún link.
2. **Medir con claves de PRUEBA** que MP acepte `start_date` en una suscripción sin plan y no cobre al autorizarla. Va
   con el resto de lo que espera esas claves (tabla de abajo).
3. **Mirarlo en el navegador, en el ws3 (nunca ws1)**: la tab Pagos con un ganado con cuotas, una suscripción y un lead
   abierto; la «Baja del cliente» sobre un ganado con cuotas vencidas; y la tarjeta de un cliente de agencia («Pagar su
   mes», «Activar renovación»). No se pudo: no hubo RAM para `next dev` (receta en docs/hallazgos-crm.md).
   **Casos cargados en el ws3 el 17/10** (no había ningún ganado con cuotas ni suscripción): el lead **2739** «Francisco
   (prueba de Pagos)», US$6.000 con US$4.000 cobrados y dos cuotas vencidas, y el **2740** «Suscripción (prueba de
   Pagos)», US$800 por mes con un mes sin registrar. El lead abierto es el 2664.
4. **La T3 (Customer Success en bloques) va con el CRM, al final.** Al pasarla, se borran juntos DealDetailsCard,
   EditarDeal, `?edit=1`, «Completar con IA», `saveDealSectionsAction` y `saveCuotasAction`.
5. **`pagos-mexico-guarda` (a075e1ae5) NO se integra** hasta que Martín conteste `cobrar-mako-en-mexico` en la Ticketera.

Hechos y tachados: `PlantillaTab` (ya importa lib/ficha/plantillas-tab.ts) y el cast de `epico` (lo sacó el CRM, e92688cd2).
Queda un ajuste chico: marcar a mano una cuota cuyo link ya se pagó pero no se asentó cuenta la plata dos veces
(lib/pagos.ts, `cobrarCuota`; hallazgos-pagos.md §4).

## Decisiones de Martín (no se re-preguntan)

- Al pagar un plan de MaKo, **alta automática** (workspace + mail de acceso).
- Cada cliente conecta su pasarela **pegando sus claves** (BYOK), no OAuth/Connect.
- En Automations, **«Pagos» es un botón propio** del CRON.
- **Cliente de agencia** (16/10, llamada con Código Inmobiliario): **US$47 por cliente y US$97 la suscripción de
  agencia**; el link al cargarlo, sin que él apruebe; y el mes corre desde el fin del onboarding (lo aceptó Joan).
- **Baja del cliente** (16/10, llamada con Mauricio): una opción en las cuotas que conserva lo cobrado.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Datos | mig 0255 (`cobros`, `pasarela_eventos`), 0295 (`nacio_cobrada`, un link vivo por cuota), 0307 (la baja), 0308 (el cliente de agencia) |
| El servicio (crear, aplicar, reembolsar, reconciliar, alta) | `lib/cobros.ts` · lo puro en `lib/cobros-reglas.ts`, `lib/cobros-tipos.ts`, `lib/pasarela-moneda.ts` |
| Proveedores y firmas | `lib/stripe-api.ts`, `lib/mercadopago-api.ts`, `lib/pasarela-firma.ts` |
| Webhooks y cron | `app/api/webhooks/{stripe,mercadopago}`, `lib/cobros-webhook.ts`, `lib/cobros-eventos.ts`, `app/api/cron/cobros-reconciliar` (también corre las renovaciones de agencia) |
| La tab Pagos del lead | `app/crm/lead-view/ficha/{reglas-pagos.ts, registro-pagos.tsx, pagos/}` · lo que dice: `lib/pagos-vistazo.ts` · lo cobrado: `lib/cobrado-lead.ts` |
| La baja del cliente | `lib/pagos-baja.ts` (el único que escribe `baja_at`) · `noEsDeuda` en lib/cobrado-lead.ts |
| El cliente de agencia | `lib/agencia-cobro.ts` (link, renovación, lo que ve la agencia) · `lib/agencia-cobro-reglas.ts` (puro) · `lib/agencia-habilitar.ts` (el pago aprueba; el aviso que comparte con la firma del super admin) · `app/partners/PartnersApp.tsx` (lo que ve la agencia, en /partners desde el 17/10/2026) |
| Páginas públicas | `app/pagar/[token]`, `/listo`, `app/api/pagar/email`, `app/reembolsos`, `/terminos` §8 |
| API de MaKo | área `cobros` (`lib/api-mako/areas/cobros.*`, con `baja_del_cliente`) y `ver_pagos_clientes_agencia` en el área `cs` |
| Super admin | `/admin/cobros` (vender un plan, el precio del cliente de agencia, cada alta) |

## Lo que está QUIETO, y qué lo destraba

| Qué | Lo destraba | Dónde |
|---|---|---|
| Si `rk_` lee `GET /v1/account`; si la `notification_url` de MP llega firmada; si MP respeta el vencimiento de una preferencia anulada; `coverage_applied` de un contracargo de MP; el estado de una suscripción de MP al llegar su `end_date`; **que MP acepte `start_date` y no cobre al autorizar**; un pago de punta a punta | las claves de PRUEBA de Martín | `lib/cobros-conexion.ts`, `lib/mercadopago-api.ts`, `app/api/webhooks/mercadopago/route.ts` |
| Vender planes de MaKo a México | Martín, Ticketera `cobrar-mako-en-mexico`. Con la A, se integra `pagos-mexico-guarda` (a075e1ae5) | `lib/cobros.ts` (`crearCobro`), `lib/cobros-reglas.ts` |
| La garantía del programa grupal | Martín, Ticketera `garantia-grupal` | `app/reembolsos/page.tsx` |
| ~~Cortar el acceso a quien no paga~~ **Hecho el 17/10/2026 (B4)**: el cron de la pasarela pausa y reabre (lib/plan-acceso.ts) | — | docs/hallazgos-planes-y-cobro.md, «Quien deja de pagar deja de entrar» |

## Para que Martín lo use

1. Conectar la Stripe o la Mercado Pago **de MaKo** desde `/integraciones?ws=9` (con el `?ws=9`: si no, la clave queda en
   el workspace que esté mirando). En Mercado Pago, pegar en su panel la URL que muestra la tarjeta.
2. Vender un plan: `/admin/cobros` → «Vender un plan». El link es `hola-mako.com/pagar/<token>`.
3. Cliente de agencia: `/admin/cobros` → «Cliente de agencia», el monto en pesos de los US$47.
4. El aviso en el grupo: Automations → galería → «Aviso de pago recibido».
