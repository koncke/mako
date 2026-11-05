# Encargo: la suscripción en la ficha del lead y la vista de edición (5/11/2026)

Lo escribió el Cerebro. Es para la sesión de la nube que lo construya, que no vio la conversación ni ve producción ni la memoria de Martín. Lo que hace falta de ellas está acá.

## El pedido, textual

Martín: «estoy vendiendo yo una suscripción y fíjate todas las fallas que hay en el CRM con respecto a esto. O sea, la suscripción es suben, bajan, en el caso de Joan y Juanfran, en otros casos se mantienen, otros casos hay cortes, etcétera. Pero la pestaña de pagos dentro de lo que sería una venta de suscripción es algo que quisiera cambiarlo completamente. Sería muy bueno que puedas investigar cómo lo hacen otras personas, cómo lo hacen otras aplicaciones, incluso en estos dashboards si tenemos algo específicamente para suscripciones. Que lo puedas implementar. Para el detail. Porque sí creo de que es muy complejo lo que está hoy en día. Y quiero que hagas una investigación completa de cómo hacerlo.»

«Lo mismo pasa con el resto de las pestañas dentro del detail de un lead. Creo que poder editar o tener una vista de edición tal vez un poco complejo. No quiero perder que los usuarios puedan tener la personalización, porque evidentemente hay usuarios que prefieren una cosa u otra. Pero no sé si hay una forma más sencilla de hacerlo, tal vez quitar opciones dentro de la vista de editar.»

## Lo medido en producción (5/11/2026), que desde la nube no se ve

- **Los tres clientes con suscripción del CRM de la plataforma (negocio 9) tienen vacío el monto mensual:** `venta_tipo='suscripcion'`, `suscripcion_monto_usd` y `suscripcion_meses` en null, en Ganado. Son Leila Fittipaldi (lead 2473), Juanfran Marquez de Código Inmobiliario (2474) y Florencia Ayelen Carballo (2659). `getMrrActivo` suma ese campo, así que su MRR da nada aunque hayan pagado.
- **Cobrado y cargado:** un solo pago cada uno, «Mensualidad», método `transferencia`, `es_mensualidad`: Leila US$97 el 26/10, Juanfran US$146 el 21/10, Florencia US$97 el 18/10. Juanfran pagó por Binance, no por transferencia: el método no se puede elegir bien o se carga solo.
- **Lo de noviembre de Código no está cargado.** Pagó US$238 en dos pagos (94 el 4/11 y 144 el 5/11). El CRM no lo refleja: `total_cobrado_usd` sigue en 146.
- **El negocio de Leila (11) tiene 12 suscripciones,** 0 canceladas, US$5.079 de suma mensual. Es el otro caso real para probar.

## El caso real que tiene que entrar sin explicar nada

Código Inmobiliario paga una mensualidad que cambia mes a mes porque le suma clientes:

| Mes | Monto | Cómo |
|---|---|---|
| Octubre | US$146 | un pago el 21/10 |
| Noviembre | US$238 | dos pagos, 94 el 4/11 y 144 el 5/11, y hasta el 4/12 |
| Diciembre | US$426 esperado | con los 7 clientes |

Además hay pagos sueltos fuera del mes (el diferencial de un cliente nuevo: sus días hasta el próximo 5), y un cliente que entra, se corta y vuelve. También: el que paga siempre lo mismo; el que paga tarde; el que pagó dos veces en un mes para completar; el que se corta y vuelve; el que baja el plan.

## Lo que hay que entregar, en este orden

**1. La investigación, en `docs/investigacion-suscripciones.md`.** Completa y corta de leer. Cómo muestran una suscripción en la ficha de un cliente las apps que ya lo resolvieron: Stripe (la página del cliente y la de la suscripción), Chargebee, Recurly, Paddle, Whop, Kajabi, ThriveCart, HubSpot, Baremetrics y ChartMogul (los movimientos: nuevo, sube, baja, corte, vuelve). Y lo que tengamos en los dashboards del repo para suscripciones (`docs/diseno/mockups-dashboard/`, `app/dashboard/`). De cada una: qué muestra primero, cómo se cambia el monto, cómo se corta y se retoma, cómo se ve el historial, con capturas o enlaces. **Termina eligiendo UNA para copiar, y por qué.** Las fallas del CRM con cada caso real, una por una, también van ahí. Sin pedirle a Martín que elija: AGENTS.md dice que ninguna pantalla se diseña de cero, y él pide decidir con criterio.

**2. La pestaña Pagos de una venta de suscripción, nueva por completo.** Lo que tiene que quedar: en qué estado está, cuánto paga hoy, cuándo le toca, cuánto pagó en total, y su historia mes a mes; cambiar el monto desde una fecha (sube, baja); cortar y retomar; registrar un pago con su comprobante, varios en un mismo mes, con el medio real. Los montos que cambian dejan rastro: no se reescribe el pasado. Un pago de una suscripción sigue sumando al cash real. El MRR va aparte y nunca infla lo cerrado, como ya decidió Martín. Sólo cambia la suscripción: el pago único y el plan por tramos siguen como están (`docs/hallazgos-pagos.md`), con el mismo lenguaje visual.

Que un dato faltante no rompa los números: `suscripcion_monto_usd` en null no puede dar MRR 0 cuando hay pagos. Y los tres clientes de arriba tienen que verse bien: si hace falta un dato suyo, dejá en tu relevo qué tiene que cargar o reparar el Cerebro.

**3. La vista de edición de la ficha, en todas las pestañas, más simple.** La personalización se queda: cada usuario tiene que poder armar su ficha. Lo que sobra son opciones. Medí qué hay en «Editar» (hoy `app/crm/lead-view/ficha/`), mirá cómo lo resuelven Notion, Attio, HubSpot y el editor del Dashboard, y sacá o escondé lo que casi nadie usa. Los datos de uso reales van a llegar en el documento de medición de abajo.

## Decisiones de Martín que no se reabren

- **Plan por tramos (29/10):** ya existe, hasta 10 tramos, con anticipo. Pidió «libertad» de tipos de cobro: si un cliente tiene que explicarnos su plan para que se lo carguemos, la herramienta falló.
- **Suscripción (8/2026):** plazo fijo (N meses) o indefinida. MRR aparte del high-ticket, sin inflar lo cerrado.
- **Guardar nunca bloquea (17/9):** mover de etapa y cambiar un dato se guardan siempre. Lo que falta queda pendiente, sin frenar.
- **Ficha por bloques (14-16/10):** las pestañas son hojas como las del Dashboard, con templates con miniatura, «Editar» azul y «⋯». Decisiones en `docs/diseno-ficha-bloques.md`.
- **Moneda:** por negocio, y cada pago guarda la suya. Nunca una tasa inventada.
- **Interfaz:** texto corto, en español neutro con «tú», sin voseo. Nombres de tabs en inglés. Nunca el `<select>` nativo. Modal sobre modal: el de abajo se esconde y vuelve con su scroll. Un paso por pantalla en lo que pregunta. Escritorio y celular, los dos. Al sumar algo a una pantalla, mirala entera: dos elementos del mismo rango con distinto estilo ya son una señal.
- **Minimizar configuración:** primero un default sano, después plantillas y sugerencias de MaKo; lo manual, último recurso.
- **Todo por la API de MaKo:** lo nuevo se declara en el registro (`lib/api-mako/areas/`), y MaKo lo puede operar. Si un plan lo dicta una persona, MaKo propone y la persona confirma.

## Con quién no chocar

- **`app/admin/`, `app/customers/` y los ingresos de SuperAdmin:** los toca otro chat («Admin», `docs/relevo/admin-encargo.md`). Vos le dejás bien los datos; la pantalla es suya. Si le cambiás el modelo de la suscripción, escribí en tu relevo cómo leerlo.
- **`lib/cobros.ts`, recibos y Automations:** otro chat (`docs/relevo/recibos-encargo.md`, `punta/recibos`). No toques `aplicarPagoAprobado`.
- **`lib/agencia-mes*.ts`:** el chat de cobro a agencias (`punta/agencia-cobro`).

## Cómo se entrega

- Por `punta/suscripciones-ficha`, en tandas chicas que lleguen solas a main con verde. Deja `docs/relevo/nube-suscripciones.md` con lo que le toca al Cerebro: migraciones sin aplicar, datos a reparar, qué mirar en producción.
- No podés escribirle al Cerebro. Él te escribe a vos y puede dejarte más datos en el repo.
- **Más medición de producción en camino:** `docs/relevo/suscripciones-medicion.md`. Hacé `git fetch origin main` y miralo antes de cerrar el diseño y antes de la vista de edición. Si no llegó, seguí y dejá dicho qué supusiste.
- Si necesitás una migración, barré main y las ramas para el número, y avisá que se confirma al aplicar: ya hubo dos veces el mismo número.
- Tests probados rompiéndolos. Bitácora del área y cosecha en `docs/hallazgos-crm.md` o `docs/hallazgos-pagos.md`, con el índice en el mismo commit.
