# Medición: suscripciones en producción y vista de edición de la ficha (5/11/2026)

Medido el 5/11/2026 contra producción, sólo lectura (`begin('read only')`), y contra el código de `origin/main` del mismo día. Respuesta al encargo `docs/relevo/suscripciones-ficha-encargo.md`. Sin correos, teléfonos, textos ni nombres de leads de otros negocios. Marco cada cosa como **MEDIDO** (salió de la base o del código leído) o **DEDUCIDO** (lo concluyo yo).

## 1. Todas las suscripciones de producción, por negocio (MEDIDO, 5/11/2026)

Producción tiene 3.125 leads: 3.108 `unico`, **15 `suscripcion`**, 2 `sin_cobro`. La tabla `pagos` entera tiene **66 filas** (49 pagadas), desde el 17/6/2026: no es una tabla grande, el volumen de suscripciones es de dedos de la mano. Hay 18 negocios; suscripciones sólo en el 9 y el 11. En `cobros` no hay ninguna suscripción de pasarela cobrada: sólo 2 `pendiente` de Mercado Pago (negocio 9, leads que no son de tipo suscripción, 31/10).

| | Negocio 9 (plataforma) | Negocio 11 |
|---|---|---|
| Suscripciones | 3 | 12 |
| Indefinidas / plazo fijo | 3 / 0 | 11 / 1 (12 meses) |
| Monto mensual vacío | **3 (todas)** | 0 |
| Canceladas | 0 | 0 |
| En Ganado | 3 | 5 (de las otras 7: 4 abiertas y 3 perdidas) |
| Sin ningún pago pagado | 0 | 7 (6 sin fila alguna, 1 con una cuota impaga) |
| Suma de `suscripcion_monto_usd` | null | US$5.079,29 |
| `total_cobrado_usd` = suma de `pagos` pagados | US$340 = 340 | US$200 = 200 |

- **Pagos por suscripción:** 0 pagos pagados en 7, **exactamente 1 en las otras 8**. Ninguna tiene más de uno. Por eso, hoy: **0 suscripciones con más de un pago en un mes, 0 con huecos de meses, 0 con montos que cambian.** El caso «sube, baja, dos pagos en el mes» que describe Martín no existe todavía en la base: está sólo en su cabeza y en el banco de Código (ver sección 2).
- **`total_cobrado_usd` vs `pagos`:** coincide en TODOS los leads con plata (ws1: 15 leads, ws9: 3, ws11: 10; cero diferencias). No hay deriva. Lo de Código (US$238 de noviembre) no es un desfase: **no está cargado** (3 filas en `pagos` para el negocio 9, ninguna de noviembre; `total_cobrado_usd` de Juanfran = 146).
- **`es_mensualidad`:** 4 pagos en toda la base, los 4 de suscripciones; los otros 5 pagos de suscripciones (todos del negocio 11) son `false`. Ningún pago de un lead que no sea suscripción lo tiene.
- **`metodo`:** en toda la tabla, 57 de 66 están en `null`, 8 `transferencia`, 1 `deposito`. En suscripciones: 4 sin método (negocio 11), 3 `transferencia`, 1 `deposito`. **Los 66 pagos tienen `moneda` en null**: nadie cargó nunca un pago en otra moneda; todo es USD. Los métodos posibles son 6 (`lib/pagos-campo.ts:827`: transferencia, efectivo, tarjeta, depósito, cheque, otro): Binance no existe como opción.
- Todos los pagos de suscripción son a mano: 0 con `proveedor`, 0 con comprobante.
- **Los tres de Código/plataforma** (MEDIDO): leads 2473, 2474, 2659, Ganado, `suscripcion_monto_usd`/`meses`/`cancelada_at` en null. Cada uno tiene 1 pago «Mensualidad», `transferencia`, `es_mensualidad`: Leila 97 (26/10), Juanfran 146 (21/10), Florencia 97 (18/10). Los tres tienen `fecha_cierre` = **26/10/2026**, con `updated_at` del 26/10 22:48-23:33 UTC. DEDUCIDO: esa fecha es el día en que se cargaron, no el de la venta (Juanfran y Florencia ya habían pagado el 21 y el 18).

## 2. Qué se ve hoy en la ficha para esos casos

Cuenta hecha a mano con `cobradoDelLead` (`lib/cobrado-lead.ts`), `estadoDeCuenta` (`lib/pagos-vistazo.ts`) y los bloques de `app/crm/lead-view/ficha/pagos/`, con hoy = 5/11/2026 y los datos de la sección 1. DEDUCIDO (no abrí la pantalla).

**Leila (2473), Juanfran (2474), Florencia (2659)**, los tres igual salvo el monto cobrado:

| Lo que pide Martín | Lo que muestra hoy |
|---|---|
| Estado | Estado de cuenta: «**Al día**», verde (`pagos-vistazo.ts:144`). Bloque Suscripción: «Activa». |
| Cuánto paga hoy | «**$—/mes**» en el bloque, «**$0/mes**» en el detalle (`montoDeTarjeta`, `venta-tipo.ts:117-119`). Nunca los 97 / 146 / 97 que pagaron. |
| Próximo cobro | «próxima el 26 de noviembre» para los tres: se proyecta desde `fecha_cierre` (26/10), `cobrado-lead.ts:309-319`. Es real para Leila; **para Florencia debería ser ~18/11 y para Juanfran (que pagó 21/10, y 4 y 5/11) ~4/12**. |
| Total cobrado | «$97 cobrado», «$146 cobrado», «$97 cobrado» (sin barra: no hay total). Coincide con `total_cobrado_usd`. **Para Juanfran es US$384 en el mundo real** (146 + 238, según el encargo; no medible desde la base): le faltan los 2 pagos de noviembre. |
| MRR | **0** de los tres: `getMrrActivo` salta todo monto vacío (`lib/queries.ts:818`). `activas` = 0. |

Con el monto cargado y los pagos de noviembre cargados, DEDUCIDO: Juanfran se vería «Al día» con «próxima el 26 de noviembre» mientras su ciclo real corre del 5 al 4.

**Negocio 11** (mismo código, datos reales): una suscripción de 12 meses por US$4.235,29 dice «$0 cobrado de $50.823» (`cobrado-lead.ts:336`, monto × meses) y «Falta registrar 1 mes»; otra de US$444 sin ningún pago: «Falta registrar 1 mes»; una de US$40 con cierre del 15/9: «Falta registrar 2 meses»; la de cierre 10/8: «Falta registrar 3 meses» (`cobrado-lead.ts:325-330`).

### Lista de fallas

1. **Un monto vacío da MRR 0 aunque haya pagos.** `queries.ts:818` (`if (monto <= 0) continue`). `getMrrActivo` no mira `pagos`: ignora lo cobrado. Caso: los tres del negocio 9 (US$340 cobrados, MRR 0).
2. **`getMrrActivo` deja afuera lo que paga y suma lo que no.** Exige `estado_lead='ganado'` (`queries.ts:812`): 4 suscripciones del negocio 11 que **pagaron** (1852, 1871, 1923, 1940: perdidas o abiertas) no suman; y de las 5 Ganadas que sí suman (US$4.799,29) **4 no tienen ningún pago** (sólo 2632, de US$40, tiene uno). Cash real de las 5 Ganadas: US$40 contra MRR declarado US$4.799.
3. **Una sola suscripción hace el 88% del MRR del negocio 11** (US$4.235,29 de US$4.799,29): es la de plazo fijo de 12 meses. La bitácora (`app/admin/dev/crm/bitacora.ts:3799`) ya dice que ese lead debía pasar a «Pago único» con quincenas: es un pago único guardado como suscripción. Un monto × meses de un cierre inflado entra como mensualidad (`queries.ts:823-826`).
4. **No hay lugar para cambiar el monto desde una fecha.** El monto es UNA columna (`leads.suscripcion_monto_usd`) editada en el lugar (`bloques-cobro.tsx:755-756`): sube o baja y **reescribe el pasado**; el único rastro es el Deshacer y el historial del lead. Caso: Juanfran 146 → 238 → 426.
5. **El monto mensual y lo cobrado son dos mundos.** «Registrar el mes cobrado» sugiere `lead.suscripcion_monto_usd` (`cobrar.tsx:68,146`): con el monto vacío, el modal arranca en blanco (los tres de ws9). Cobrar no escribe el monto.
6. **La próxima fecha sale del cierre, no del último pago.** `cobrado-lead.ts:309-319`: sólo la pasarela usa su último cobro como ancla; la manual usa `fecha_cierre`, que en los 3 de ws9 es una fecha de carga. Ciclo irregular (Juanfran: paga el 21, luego el 4-5) imposible de expresar.
7. **Dos pagos en un mes cuentan como dos meses.** `mesesDeUnaCobrada` (`cobrado-lead.ts:197-205`): sin mensualidad cargada devuelve 1 por cada fila; con ella, la seña de 144 sobre 94 da `max(1, floor(1,53))` = 1. Los 94 + 144 de noviembre sumarían 2 meses cubiertos y taparían un mes sin pagar más adelante (`sinRegistrar`, líneas 322-330).
8. **«Cambiar el plan» convierte la suscripción en pago único.** Está siempre visible en Cuotas (`bloques-cobro.tsx:371`) y al guardar hace `tipo: 'unico'` y borra monto y plazo (`:492-498`). En una ficha de suscripción es una trampa; el aviso es de un comentario, no del botón.
9. **Sin comprobante ni método real.** 6 métodos posibles (`pagos-campo.ts:827`); Juanfran pagó por Binance y quedó «transferencia». 0 de los 9 pagos de suscripción tienen comprobante.
10. **Las tres fuentes del monto no se hablan:** `suscripcion_monto_usd` (lead), `pagos.monto_usd` (cobrado) y `cobros.monto_usd` (pasarela, sólo para leads que NO son de suscripción: `queries.ts:848`). Si un lead de suscripción cobra por pasarela, su mensualidad se cuenta por la columna del lead, nunca por el cobro.
11. **Fecha de cierre = fecha de carga.** Los tres de ws9 tienen 26/10; sacar a un lead de Ganado la borra (`cobrado-lead.ts:331-334`) y entonces no hay nada que contar («Sin fecha de cierre»).
12. **Pago de noviembre de Código no cargado.** No hay forma en la ficha de «cargar una fecha pasada con un monto que cambia» sin abrir «Registrar un pago» a mano dos veces; nadie lo hizo.

## 3. La vista de edición de la ficha

**Dónde se guarda** (MEDIDO en código): por embudo, en `funnels.data.ficha` (jsonb) y su rastro en `funnels.data.fichaHistorial` (últimas 20 acciones, con la ficha de antes). Tipos y saneo: `lib/ficha/config.ts`, `lib/ficha/config-server.ts`, `lib/ficha/historial.ts`. De respaldo, `app_settings`: `crm.resumen.campos` y `crm.datos_aviso.apagados`. El historial existe desde el 17/10/2026; lo que se hizo antes no tiene rastro.

**Qué se tocó de verdad** (MEDIDO, 5/11/2026): 40 embudos en 18 negocios. **32 embudos nunca se tocaron; 8 sí (en 7 negocios)**. Quedan sin tocar 11 de los 18 negocios, entre ellos los de más leads fuera de ws1: ws3 (430 leads), ws4 (300), ws9 (233), ws19 (117).

| Negocio (leads) | Qué tiene guardado | Acciones en historial |
|---|---|---|
| 1 (1.173) | Resumen 7 bloques, **Pagos 9 bloques (el único que tocó Pagos)**, 1 hoja propia de 14 bloques (creada el 5/11) | 3: poner, mover, crear hoja |
| 10 (227) | Resumen 13 bloques, densidad «Compacta» | 8: 6 por la vista épica (prender/apagar, en un mismo minuto), 1 quitar, 1 tarjetas |
| 11 (495), 2 embudos | Resumen de 13 y de 12 bloques | 5 y 1: «Estado de cuenta» quitado, **Obligatorio** prendido/apagado 2 veces, 1 quitar |
| 13 (94) | sólo la plantilla de Resumen «completa» | 0 |
| 15 (46) | Resumen 8 bloques, plantilla «evento» | 12 (10 quitar, 2 mover) |
| 17 (1 lead) | Resumen 4 bloques | 14 (12 quitar, 2 poner) |
| 20 (3 leads) | Resumen 4 bloques | 15 (12 quitar, 2 poner, 1 mover) |

Por opción, qué usa alguien hoy:
- **Quitar bloques:** 36 de 58 acciones. Los 12 bloques quitados son prácticamente los mismos en tres embudos (Siguiente acción, Posibles duplicados, Estado de cuenta, Tiempo en la etapa, Próxima reunión, Ingreso estimado, Redes y web, Setter y closer, Motivo de salida, Plazo de nutrición, Lo que le mandamos, Automatizaciones). DEDUCIDO: ws17 y ws20 tienen 1 y 3 leads y terminaron con **los mismos 4 bloques** (Contacto, Notas, Lo que contesto, Calificación): parecen cuentas de prueba o recién creadas, y la poda de ws15 del 4/11 es de un solo pase.
- **Plantillas del embudo / de la tab:** 2 embudos (ws13 «resumen-completa», ws15 «resumen-evento»); 0 de Pagos, Reuniones o Tracking.
- **Pestañas renombradas, ocultas o creadas:** renombradas **0**, ocultas 0 (no existe), creadas **1** (la hoja de ws1).
- **«Obligatorio»:** 4 acciones, todas en un embudo del negocio 11 el 19/10 (2 «Avisar», 2 «No avisar» sobre «Fecha de la Reunión 1 y 2»), **ninguna queda vigente** (`avisos` está vacío en todos los embudos).
- **Estilo:** tema 0, ajustes de fondo/esquinas/borde/sombra 0; **densidad 1 vez** (ws10, «Compacta»); **vista épica 6 veces en un negocio, ninguna vigente**.
- **Título, ícono, ancho, diseño de un bloque, «Opciones» de un bloque:** historial con 0 «título», 0 «ícono», 0 «diseño», 1 «ancho completo». Hay opciones vigentes: `fuentes` en 4 embudos y `redes` en 3 (DEDUCIDO: son lo que guarda cuando se cambia la plantilla, no una elección de la persona; el guardado repite los datos de la plantilla y no se puede separar sin el catálogo).
- **Duplicar, mover hoja, eliminar, Volver a su template, Datos ▾, Pregunta:** 0 en el historial.
- Mover un bloque: 4. Poner un bloque: 5.

**Qué hay en «Editar»** (MEDIDO en código, contado):
- Barra de la hoja (`FichaPorBloques.tsx:430-451`): Deshacer, Agregar bloque ▾ (57 bloques en el catálogo: 26 Resumen, 16 Pagos, 8 Reuniones, 5 Tracking, 2 de CS), Templates, selector de dispositivo (3), Estilo de la hoja ▾ (`EstiloDeLaHoja.tsx`). 
- Estilo de la hoja: Vista épica (1), Tarjetas (3 densidades), plantilla de estilo (6), color, letra (varias fuentes) y **8 ajustes** (fondo, esquinas, borde, sombra, títulos, valores, leyenda, cuadrícula; `graficos-temas.ts:56-65`; 3 de ellos, de gráficos, no aplican a una ficha).
- Barra de CADA bloque (`Armador.tsx:324-397`): mover, hasta 4 anchos, Diseño ▾ (152 diseños en total en el catálogo), Opciones ▾ (sólo 3 bloques), Datos ▾ (5 bloques), Obligatorio o Obligatorio ▾, Título, Ícono (~70 del set), Quitar: **9 controles por bloque**.
- Hojas (⋮ y ⋯, `FichaPorBloques.tsx:350-381`, `menu-contextual-ficha.ts`): Renombrar, Templates, Duplicar, Mover izq/der, Volver a su template, Eliminar, Nueva hoja. Plantillas: 9 de embudo y 16 de tab (10 Resumen, 4 Pagos, 1 Reuniones, 1 Tracking).
- Más el chat de MaKo en modo edición.

**Se usa:** quitar bloque, poner bloque, mover, templates de Resumen. **Casi nadie, o nadie:** Estilo (8 ajustes + color + letra: 0 usos; sólo la densidad una vez), Título, Ícono, Diseño, Obligatorio (4 usos, todos deshechos), Renombrar, Duplicar, Mover hoja, dispositivo (no se guarda), plantillas de Pagos/Reuniones/Tracking, Vista épica (6 toques, ninguno vigente). Aviso: son 6 negocios que tocaron algo con historial, y al menos 2 son cuentas casi vacías; la muestra es chica y yo no sé qué usan en el dashboard o en otras pestañas (el editor del Dashboard no lo medí).

## 4. Lo que me sorprendió y no estaba en el encargo (todo MEDIDO salvo lo marcado)

- **El 88% del MRR del negocio 11 es un pago único mal clasificado** (falla 3). Cualquier MRR nuevo que arregle sólo el monto vacío va a seguir mostrando 4.799 cuando el cobrado real de las Ganadas es 40.
- **4 suscripciones del negocio 11 pagaron y no cuentan** (1852, 1871, 1923, 1940) por no estar Ganadas; una de ellas 1852 pagó el 20/8 una cuota con vencimiento 21/9.
- **La fecha de cierre de los tres de ws9 es la de carga (26/10)**, no la de venta; de ahí sale la «próxima». El `fecha_cierre` no es una fecha confiable para proyectar nada.
- **Ningún pago de toda la base tiene `moneda`** y 57 de 66 no tienen `metodo`: el sistema de monedas por pago está construido y sin un solo uso. Y los pagos de tipo `pagos.fecha_pago` con más de uno en el mes son 2 en TODA la base, ambos de 2025-12 y 2026-02 (leads 50 y 65, ws1), ninguno suscripción.
- **Una suscripción con una cuota impaga vencida:** el lead 1885 (negocio 11, abierto) tiene una cuota de US$40 impaga con vencimiento 14/9, vencida hace 7 semanas. La ficha dice «Cuota vencida»: el modelo mensual no contempla una cuota suelta dentro de una suscripción. Y en 1852 y 1871 el día del pago y el vencimiento caen en meses distintos (20/8 contra 21/9; 18/9 contra 14/9): el «mes» de un pago no está definido.
- **Las acciones de «Obligatorio» son 4 en 5 semanas y no quedó ninguna vigente**, pero el botón aparece en la barra de CADA bloque que cubre un dato (`Armador.tsx:369-386`).

## Lo que no pude medir

- Lo que se ve en pantalla: lo calculé leyendo el código, no abrí la ficha. Las zonas horarias del negocio 9 no las medí; usé 5/11/2026 como «hoy».
- Los pagos de noviembre de Código (94 y 144) y el método real (Binance): no están en la base. Los US$384 salen del encargo.
- Qué bloques son «añadidos» o «quitados» respecto de su plantilla vigente: sólo lo sé por el historial (desde el 17/10) y por la lista guardada; no corrí la plantilla.
- El uso del editor del Dashboard, y de «Editar» en la ficha del teléfono (`app/m/crm`): no los medí.
- Si los negocios 17 y 20 son de prueba: es una deducción por tener 1 y 3 leads.
