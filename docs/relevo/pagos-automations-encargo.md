# Encargo: la tarjeta Pagos de Automations, con lector de comprobantes y recibos (5/11/2026)

Lo escribió el Cerebro. Es para la sesión de la nube que lo construya, que no vio la conversación ni ve producción ni la memoria de Martín. Lo que hace falta de ellas está acá. **Va después de los recibos de la plataforma, en la misma sesión: `docs/relevo/recibos-encargo.md`.** Primero eso, porque esta tarjeta reusa su plantilla y su PDF.

## El pedido, textual

Martín: «sería bueno de que puedas implementar dentro de una tarjeta nueva de automations que sea un lector de comprobantes de pago o recibos de pago y por otro lado también tal vez una tarjeta que se llame pagos, ¿no? Y que dentro de esa tarjeta haya tanto para leer comprobantes que vienen como para emitir factura y tal vez que hayan varios templates de factura que nosotros podemos crear y que el usuario pueda elegir qué template de factura quiere enviar. Eso sería bueno que lo implementes. Por favor, si también nosotros lo utilizamos con nuestros propios clientes.»

## Lo que hay que entregar

**Una tarjeta «Pagos» en el lienzo de Automations, con dos acciones: leer un comprobante que llega y emitir un recibo.** Martín dudó entre una o dos tarjetas: decidí con lo que mejor se lea en el lienzo, y dejalo dicho. Antes de crear, mirá si lo que hay ya lo expresa: no se agregan tarjetas por agregar.

- **Leer un comprobante:** de una imagen o PDF que llega por el canal del flujo. Saca monto, moneda, fecha, medio, destinatario y número de operación. Lo que encuentra queda como datos del flujo, y siguen con una CONDITION: si coincide con lo que debía pagar, si el número de operación ya se usó, si no se pudo leer.
- **Nunca marca algo como pagado con dudas:** un comprobante dudoso va a una persona. Un pago parcial no salda el total. Un número de operación repetido no cuenta dos veces.
- **Emitir un recibo:** arma el PDF con el template elegido y lo manda por el canal que diga la tarjeta, al lead o al grupo.
- **Templates:** varios, hechos por nosotros, en la galería de la tarjeta, con miniatura que muestre contenido real; nunca un rectángulo vacío. El usuario elige cuál manda. Sale de la misma plantilla de los recibos de la plataforma, con su modelo copiado de los recibos 0001 y 0002 (descripción en `recibos-encargo.md`).
- **Plantillas de flujo:** por lo menos una en la galería de Automations, «Le llegó un comprobante», y otra «Emitir recibo al cobrar». Ningún negocio arranca con una automatización creada.
- **También para nosotros:** tiene que servir en el negocio de la plataforma con sus propios clientes: es el caso de Código Inmobiliario, que manda su comprobante de Binance por el grupo.

## Lo que ya existe, para reusar

- `app/api/extract-receipt/route.ts`: lee un comprobante de una cuota con `leerDocumentoIA` y `RECEIPT_EXTRACT_DEFAULT`. `app/crm/lead-view/ficha/pagos/recibo-leido.ts` y `comprobante-del-chat.ts`.
- La clase de CRON «Pagos» en Automations: `app/automations/EditorDisparadores.tsx`, `IconosDisparador.tsx`, `FlujoLienzo.tsx`. Es un disparador, ya existe, y no es esta tarjeta.
- `lib/plantillas-automatizaciones.ts` (galería), `lib/condiciones-catalogo.ts` (condiciones).
- «Facturado por»: identidades fiscales propias de cada negocio, en `leads.facturado_por_id`, configurables. **Son los datos del emisor de cada negocio.** Mirá si sirven antes de crear otra cosa.

## Decisiones de Martín que no se reabren

- **Nada por detrás:** lo que pase con un comprobante se ve en el lienzo y se decide con CONDITION. Una regla escondida en el motor es un bug.
- **Sale como el negocio, nunca como MaKo:** un correo a SUS clientes sale de SU dominio; sin dominio no sale y se dice por qué. El WhatsApp sale por SU línea.
- **La IA la paga cada negocio.** Nunca el plan de MaKo. Y **la computadora del cliente nunca atiende a un lead sola:** una tarjeta que corre sola va por clave de API o por crédito, nunca por la PC (`tests/ia-pc-nunca-a-leads.test.ts`).
- **Todo por la API de MaKo:** la tarjeta, sus condiciones y sus plantillas se pueden leer y editar por la API, en el mismo commit o en el siguiente (`lib/api-mako/areas/`, `docs/api-mako.md`, snapshot y `plugin/`). Leé en AGENTS.md la regla de capacidades nuevas.
- **Crear con IA** tiene que conocer la tarjeta: el catálogo manda.
- **Todo como plantilla:** lo que un negocio haga con un hecho nuevo lo arma en Automations.
- **Interfaz:** texto corto, español neutro con «tú», sin voseo; nombres en inglés; nunca el `<select>` nativo; escritorio y celular.

## Lo que hay que decirle a Martín

- **No inventar lo fiscal.** Es un recibo de pago, y dice que no es una factura fiscal, salvo que el negocio haya cargado sus datos y el template corresponda. Si llega a llamarse «factura», es sólo cuando el negocio lo elige: la obligación es de cada país y de cada negocio. Dejalo dicho en tu relevo.
- **El WhatsApp no le escribe primero a una persona:** los límites de la línea siguen valiendo (`docs/hallazgos-comunicacion.md`).

## Con quién no chocar

- **El comprobante de Código por el grupo:** lo pide también `punta/agencia-cobro`. Debería usar este lector. Medí su punta antes de escribirlo dos veces, y dejá en tu relevo cómo se engancha.
- **La pantalla de cobros de SuperAdmin:** la rehace el chat «Admin» (`docs/relevo/admin-encargo.md`, `punta/admin`). Vos entregás `RecibosMako.tsx` como componente propio, y él lo monta. Mirá `origin/punta/admin` antes de tocar `app/admin/cobros/Contenido.tsx`.
- **La pestaña Pagos de la ficha:** la rehace otro chat (`docs/relevo/suscripciones-ficha-encargo.md`). No la toques.

## Cómo se entrega

- Los recibos, por `punta/recibos`. La tarjeta, por `punta/automations-pagos`, en tandas chicas. Las dos llegan solas a main con verde.
- Deja `docs/relevo/nube-recibos.md` con lo que le toca al Cerebro: migraciones sin aplicar, el script de carga de 0001 y 0002, qué mirar en producción.
- No podés escribirle al Cerebro. Él te escribe a vos.
- Tests probados rompiéndolos. Bitácora del área y cosecha en `docs/hallazgos-chatbot.md` y `docs/hallazgos-planes-y-cobro.md`, con el índice en el mismo commit.
