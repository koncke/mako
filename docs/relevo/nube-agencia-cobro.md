# Relevo — el cobro automático de las agencias (nube, 6/11/2026)

> Lo escribió la sesión de la nube que lo construyó (cuenta `nube`, sesión `cli_72e438bf-f295-5e72-888d-863b786b03a4`), sobre lo que
> había dejado en main la sesión `cli_6296ebf3…` (la mensualidad del acuerdo del 30/10, apagada). **Esta sesión no vio la base ni
> producción**: lo «medido» es en la nube (tests y tipos). Entrega por **`punta/agencia-cobro-2`**. Lo que no se ve en el código, en
> [docs/hallazgos-agencias.md](../hallazgos-agencias.md) → «La segunda vuelta».
>
> **Fecha que manda: lunes 9/11.** Pablo arranca campañas y paga su entrada ese día; Giselle vence el 11/11. Los pasos de abajo tienen que
> estar hechos ANTES del lunes, y el paso 4 antes del 9/11 a las 14:07 UTC (el cron que le manda a Código el PDF de la entrada de Giselle).

## Para decirle a Martín, con estas palabras

- **La mensualidad de Código ya corre sola**, por el grupo de MaKo con la agencia, nunca con sus clientes:
  - **el 1 de cada mes**, el PDF con la mensualidad renglón por renglón (diciembre: **US$ 426** con los siete);
  - **dos días antes de que un cliente empiece**, el PDF de su entrada: sus días hasta el próximo 5, sin contar ese 5. Pablo, si entra el 9/11:
    **26 días, US$ 40,73**; Giselle el 11/11: **US$ 37,60**; Marcela el 13/11: **US$ 34,47**; Patricia, **US$ 1,5667 por día** desde que entre.
- **Mandan la captura de Binance al grupo y MaKo la anota sola**, saca el recibo y contesta ahí. Un pago menor queda a cuenta y MaKo dice
  cuánto falta. **Lo dudoso te llega a ti** (al grupo de SuperAdmin), y a ellos MaKo les dice que lo revisa el equipo.
- **«Paga para entrar», sola:** el cliente que no paga su entrada a tiempo queda en pausa y su cliente ve «Contacta a tu agencia», sin montos.
  **El día 6 sin la mensualidad**, la agencia y todos sus clientes. **Pagado, vuelven a entrar solos.** No se toca nada de Meta. Si la base falla,
  no se pausa a nadie.
- **Lo que tienes que hacer tú:** nada, salvo cuando MaKo te mande un comprobante para revisar. Ahí le dices a MaKo «marcá pagada la entrada de
  Pablo con la orden …» (o la mensualidad), y sale el recibo.

## Lo que tiene que hacer el Cerebro, en este orden

1. **Las migraciones** (sólo agregan; el código tolera que falten, pero sin la 0403 el comprobante del grupo no deja su lectura guardada):

   ```bash
   node scripts/apply-migration.mjs supabase/migrations/0402_agencia_cobra_desde.sql
   ```

   ```bash
   node scripts/apply-migration.mjs supabase/migrations/0403_comprobantes_del_grupo.sql
   ```

   La 0402 puede estar aplicada ya (era el paso 1 del relevo anterior): es idempotente. La 0403 se eligió barriendo main (llega a 0402) y
   todas las ramas y etiquetas de origin el 6/11: si el chat de Admin tomó la 0403 antes, se renombra el archivo (el código no la nombra).
2. **El deploy:** la punta `punta/agencia-cobro-2` llega a main con el verde de `punta.yml`; «en producción» es el deploy de Vercel en «Ready».
3. **La fecha de Giselle (negocio 17) al 2026-10-28**, si no se hizo: en `/agency?ws=13` → su cuenta → «Corregir fecha», o por MaKo
   `corregir_reloj_mensualidad` (agenciaWs 13, clienteWs 17, dia 2026-10-28). Sin esto cuenta desde el 12/10 y no paga entrada.
4. **Prender la mensualidad del 13, desde diciembre, con las entradas desde hoy:** por MaKo `prender_mensualidad_agencia` con agenciaWs 13,
   desde 2026-12, entradasDesde = el día que se prende (ej. 2026-11-07), medio Binance. (El botón de `/agency?ws=13` hace lo mismo: prende desde el
   mes siguiente y las entradas desde hoy.) Noviembre se cobró a mano: no se avisa ni se exige. Brigitte, Natalia y Sergio, cuyos 14 días
   terminaron antes, cuentan como «de antes» y no pagan entrada.
5. **Pablo, Patricia y el usuario 15 a «Paga para entrar».** Hoy están suspendidos a mano (`usuarios.estado='suspendido'`). Primero en seco:

   ```bash
   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/agencia-paga-para-entrar.mts --usuarios 19,22,15
   ```

   Mirar lo que lista (de qué cuenta es cada uno, de qué agencia, cómo está). Si está bien, lo mismo con `--aplicar`. Pausa la CUENTA con el corte
   `paga-para-entrar` (causa `entrada`) y recién después reactiva a la persona: nunca hay un momento en que entre sin pagar. ⚠️ Si alguno es de la
   agencia misma, o de una cuenta que no es cliente aprobado de una agencia con la mensualidad prendida, lo lista y NO lo toca: eso lo decide
   Martín. Necesita el paso 4 antes (si la mensualidad está apagada, no toca a nadie).
6. **El cron en seco**, y mirar qué saldría y a quién pausaría:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://hola-mako.com/api/cron/agencia-mensualidad?dry=1"
   ```

   El 7 u 8/11 tiene que decir: nada del mes (diciembre se avisa el 1/12), ninguna entrada todavía (Giselle sale el 9/11) y ninguna pausa nueva
   (Pablo y Patricia ya están). El 9/11: «Entrada de Giselle: US$ 37,60».
7. **Mirar `/agency?ws=13`** (el super admin): la tarjeta de diciembre en US$ 332 proyectado (Pro, Brigitte, Natalia, Sergio, Giselle y Marcela;
   Pablo y Patricia entran cuando paguen), «Entradas por pagar» con Pablo y Patricia en lo de hoy, y «En pausa: Pablo · Patricia».
8. **Las tres tareas programadas** (`codigo-diferencial-*`, 9/11, 12/11 y 14/11) avisan y no escriben: pueden quedar o apagarse.

## Qué se construyó

| Pieza | Dónde | Qué hace |
|---|---|---|
| Las reglas | `lib/agencia-mes-reglas.ts` | el ciclo del 5 al 5, `diferencialDe`, en qué está cada cliente, la mensualidad de un mes, `asignarPago` (exacto, combinación, parcial, de más, ambiguo), `quienVaEnPausa`, `pasoDePausa`, los textos y las tablas |
| La pausa | `lib/agencia-mes-pausas.ts` | aplica «Paga para entrar» con la base inyectada; una lectura que falla no pausa ni reabre |
| El servidor | `lib/agencia-mes.ts` | lee el libro y las cuentas (estricto), los PDF al grupo (copia al hilo de la app antes, `anotarLoDelEquipo` después), aplica un pago, el recibo de lo completo (`mensualidad:<ag>:<mes>`, `diferencial:<ag>:<cliente>:<ciclo>`), la corrida del cron |
| El comprobante | `lib/agencia-mes-comprobante.ts` + `lib/mako-doer-in.ts` | una foto o PDF de una persona en el grupo de una agencia con la mensualidad prendida se lee ANTES del turno de MaKo; si es un comprobante, se atiende y el turno no corre |
| El PDF | `lib/agencia-mes-pdf.ts` | el aviso de cobro, con el aspecto del recibo, determinista |
| El corte | `lib/plan-acceso-reglas.ts`, `lib/workspace.ts` | el motivo `paga-para-entrar`: corta aunque el corte general esté apagado; /cuenta-pausada dice «Contacta a tu agencia» (a la agencia: el comprobante al grupo) |
| La migración | `supabase/migrations/0403_comprobantes_del_grupo.sql` | `comprobantes_leidos` acepta la fila del grupo sin lead (`origen='grupo'`) y `aplicado_a` |
| El script | `scripts/agencia-paga-para-entrar.mts` | los usuarios suspendidos a mano, al estado nuevo |
| La pantalla | `app/agency/Mensualidad.tsx`, `AgencyApp.tsx`, `actions.ts` | el mes con lo que entró y lo que falta, «Entradas por pagar» con «Marcar pagada», quién está en pausa |
| La API de MaKo | `lib/api-mako/areas/cobros.*` | **nueva:** `marcar_entrada_pagada`; `marcar_mensualidad_pagada` con `orden` (y monto) saca el recibo; `prender_mensualidad_agencia` con `entradasDesde`; `ver_mensualidades_agencias` y `ver_mensualidad_agencia` con lo que se debe hoy y quién está en pausa. Las que escriben, en `NO_EN_FLUJOS`; ninguna por HTTP |

## Decisiones que tomé (con su porqué)

- **El que entra un día 5 paga su ciclo entero como entrada y no está en esa mensualidad** («hasta el próximo 5, sin contar ese 5»: el 5 no
  es su «próximo 5»). El que entra del 1 al 4 paga esos días y SÍ está en la mensualidad de ese mes.
- **La mensualidad de un mes se recalcula** (alguien entra, alguien se va). Si cambia del 1 al 5 y no está pagada, sale el PDF de nuevo
  («actualizado»). El día 6 se exige lo que se le dijo (o el total de hoy, si bajó): nunca más de lo avisado.
- **Sin el PDF, no hay pausa.** Sin el aviso del mes o sin el de la entrada de un cliente, no se pausa: no se puede pedir que se pague lo que no
  se pidió. Si el grupo de Código no existe o WhatsApp no anda, el aviso queda en el hilo de la app y cuenta como dado.
- **Un pago parcial** se anota a cuenta (completa en orden lo que alcanza) y MaKo dice cuánto falta; no reabre a nadie hasta cubrir.
- **Un comprobante que calza exacto con dos cosas distintas** (Pablo y Patricia, en pausa el mismo día, deben lo mismo) **va a Martín**:
  el comprobante no dice de quién es.
- **La IA que lee el comprobante es la de la plataforma** (es el cobro de MaKo). Va a Martín: lo dudoso, otra moneda (sólo USD, USDT, USDC),
  una orden que no tiene 18 dígitos, de más, nada pendiente, o cualquier falla nuestra.
- **Reactivar a mano se respeta:** si el super admin reactiva una cuenta que la mensualidad pausó, no se vuelve a pausar por la misma causa
  (`perdonadas`); sí por una nueva.
- **Apagar la mensualidad no reabre a nadie:** las cuentas en pausa quedan así hasta reabrirlas a mano.

## Lo que NO está verificado

- **Nada contra la base ni producción.** Ni un comprobante real de Binance leído, ni un PDF mandado al grupo de Código, ni una pausa real.
- **La lectura de un PDF de comprobante** (WhatsApp lo guarda como documento): sólo se probó la de una foto en los tests de la tarjeta.
- **jsPDF dentro del bundle de Next** con este PDF (mismo caso que los recibos: `serverExternalPackages: ['jspdf']`).
- **Que el grupo de MaKo de Código exista** (`mako.grupo_jid` del 13). Sin grupo, el PDF queda en el hilo de la app.
- **Un comprobante que llega por el grupo de la APP** (no por WhatsApp) no se lee: sólo el de WhatsApp.
- **El recibo cuando una sola orden completa la entrada de un cliente y la mensualidad a la vez**: sale un recibo con las dos cosas
  (`mensualidad:<ag>:<mes>`); no se probó contra `emitir_recibo` de verdad.

## 9/11/2026 — la entrada de Patricia Contreras (cuenta 22), pedida por Martín

> Lo escribió un chat abierto por el Cerebro (cuenta claude4). Estado al 9/11 23:25 UTC: **HECHA. Entrada pagada, cuenta 22 activa, recibo N.º 0003 enviado y avisado en el grupo.**

- **El pedido**, textual: «pasarle al grupo de código inmobiliario el alta para el cliente de Patricia… le cobramos como un diferencial de
  aquí hasta el próximo periodo del 5… cuando pague, ahí ya directamente dale de alta. A esa cuenta». Se leyó como la cuenta de
  **Patricia Contreras (22)**: es la única Patricia de la cartera del 13 y está en «Paga para entrar» desde el 6/11. En el grupo no había
  ningún mensaje nuevo sobre ella. (La «Parricia» de `siritpatricia@gmail.com` que agendó el 10/11 es un lead de Código, no una cuenta.)
- **La cuenta, del sistema** (`diferencialDe('2026-11-09', 47)`, la misma que da `mensualidadDeAgencia(13)`): del 9/11 al 4/12 son
  **26 días × US$ 1,5667** (47 ÷ 30 días del ciclo del 5/11 al 5/12) = **US$ 40,73**. Se cuenta desde el día que pagan: el 10/11 serían
  25 días, US$ 39,17.
- **Mandado el 9/11 a las 19:02 UTC** al grupo «MaKo <> Codigo Inmobiliario», por WhatsApp (`canal: whatsapp`) y al hilo de la app, con
  el PDF del sistema (`tablaDeEntradas` + `pdfDelCobro`, por `mandarPdfAlGrupoDeLaAgencia`). Se les pidió que aclaren que el comprobante
  es el de Patricia.
- ⚠️ **Por qué hay que aclararlo:** Pablo (18) también está en «Paga para entrar» desde el mismo día, así que **los dos deben exactamente
  lo mismo cada día**. Un comprobante de US$ 40,73 solo es `ambiguo` para `asignarPago`: MaKo contesta «Lo revisa el equipo» y se lo
  pasa a Martín. Ahí se marca a mano con la orden: `marcar_entrada_pagada` (agenciaWs 13, clienteWs 22, `pagadoEl` = el día de la orden
  de Binance). Eso reabre la cuenta (`revisarPausasDeAgencia`) y saca el recibo (N.º 0003 en adelante).
- ⚠️ **Marcarlo otro día que el del pago cuenta desde el día en que se marca**: `marcarEntradaPagada` arma lo pendiente con `ahora`, y
  la API no le pasa la fecha del pago. Si se marca al día siguiente, la entrada queda desde ese día y por un día menos de lo que pagaron.
  Hay que pasarle `ahora` = el día de la orden (lo hace el script de uso único de este chat, `C:/dev/wt-codigo-patricia/scripts/_entrada-patricia.mts`,
  que no está en main).
- **Hallazgo:** Pablo y Patricia pasaron a «Paga para entrar» con `scripts/agencia-paga-para-entrar.mts` el 6/11, y **nunca les salió el
  PDF de su entrada**: `avisarPausasNuevas` sólo avisa las pausas que hace el cron, y en el libro no hay ningún `pausa.18.*` ni
  `pausa.22.*`. Lo único que se les dijo fue el mensaje a mano del 5/11 («Patricia: US$1,5667 por día, desde el día que entre»).
- **9/11 21:31 UTC, Joan: «listo», sin comprobante.** No entró ninguna imagen ni documento a la línea ese día (medido en el store de
  Evolution). Y la base tampoco lo vio, porque el webhook de la línea estuvo caído de 12:10 a 22:35 UTC. A las 22:40 UTC el equipo le
  pidió el comprobante con la orden a la vista. **Un «listo» no es el pago:** la cuenta 22 sigue en pausa hasta ver el comprobante.
  ⚠️ **Mientras el webhook está caído, `grupo_mensajes` no muestra nada y parece que no escribieron.** La verdad la tiene Evolution:
  `POST /chat/findMessages/<instancia>` con `where.key.remoteJid = <grupo>`. El grupo del 13 es `120363429866357487@g.us`, en la línea
  `mako_superadmin_muylqv8r`. Si el comprobante llega otro día, pero la orden es del 9/11, se marca `--el 2026-11-09` con US$ 40,73.
- **9/11 23:14 UTC, el comprobante** (una foto de Juan Francisco en el grupo): Binance, «Pago completado», **40 USDT** a «Martin-Koncke
  68725667», orden **464765031875870720**, sin fecha en la captura. MaKo lo mandó a revisar por «no se visualiza la fecha». Lo que se
  verificó: no hay acceso al Binance de Martín, así que la prueba es el comprobante con la orden, igual que en el camino automático.
  La fecha sale de la propia orden (ver abajo): 9/11 a las 18:30:54 de Buenos Aires, el mismo minuto del «listo».
- **Marcado el 9/11 23:20 UTC** con `marcarEntradaPagada` (`pagadoEl` y `ahora` = 2026-11-09), monto 40 USDT. Resultado: entrada
  pagada (US$ 40,73), `workspaces` 22 y usuaria 22 `activo`, recibo **N.º 0003** (detalle US$ 40,73, recibido 40 USDT; por correo
  a codigoinmobiliarioia@gmail.com y al grupo) y el «Listo… su cuenta ya está activa» en el grupo.
- **Faltaron US$ 0,73** (pagaron 40 contra 40,73). Se dio el alta igual: es redondeo, y hay antecedente al revés (21/10 pagaron 146
  contra 144 y Martín dijo «no lo tomes en cuenta»). No se les dijo nada en el grupo. Si Martín los quiere, van a mano en diciembre: la
  mensualidad automática no arrastra saldos.
- 🔎 **La fecha de una orden de Binance Pay está en su número:** `orden / 2^31` = segundos desde el 1/1/2020 UTC. Se midió contra las tres
  órdenes conocidas de Código (21/10, 4/11 y 5/11), con 0 a 20 s de desvío. Sirve cuando la captura no muestra la fecha (la del lado de
  quien paga no la muestra): `new Date((Number(BigInt(orden) >> 31n) + 1577836800) * 1000)`.
- ⚠️ **`marcarEntradaPagada` pierde la foto del comprobante:** arma el pago sin `comprobante` (`lib/agencia-mes.ts`, la llamada a
  `aplicarPagoDeAgencia`), mientras que `marcarMesPagado` sí lo pasa (`...p.pago`). Por eso el recibo 0003 salió sin la página 2. La foto
  quedó subida en `plataforma/recibos/comprobantes/a9004e0c-dda6-48db-9cdb-e67a9aea154e.jpg`, sin atar a nada. **Sin hacer:** pasar
  `comprobante: p.pago?.comprobante ?? null` en `marcarEntradaPagada`.
- **Sin hacer:** la entrada de Pablo (18) sigue sin pagar y su cuenta en pausa (US$ 40,73 si paga el 9/11). No era parte de este pedido.
- **Regla de Martín, 9/11: en cobros, PDF y WhatsApp, sólo los dólares, sin pesos ni cotización** («Binance paga una cotización mucho más
  alta»; memoria `cobros-sin-cotizacion`). Medido ese día: el PDF de la mensualidad y de las entradas (`lib/agencia-mes-pdf.ts`), sus
  textos (`lib/agencia-mes-reglas.ts`) y el recibo (`lib/recibo-pdf.ts`, cada pago en su moneda: «238 USDT») no agregan ninguna. Un
  cambio que la sume en esos tres lugares rompe la regla.
