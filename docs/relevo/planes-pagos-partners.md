# Relevo — Planes, pagos y Partners (cuenta claude4, al día 28/10/2026)

Chat «Planes, pagos y Partners» en la PC. Worktree **C:/dev/wt-planes-2710**, rama **planes-2710** (sin push: la sube el Cerebro).
Este archivo reemplaza a docs/relevo/planes-nube-2710.md (el relevo de la nube del 27/10, que queda como historia).

## Cómo sigue quien retome
- Entrá al mismo worktree; si falta node_modules, Junction a C:\dev\wt-push-q\node_modules. No toques C:/dev/wt-push-q.
- Lo pesado va por `node C:/dev/con-turno.mjs …` (tsc acotado y tests-afectados), un proceso por vez y con ≥3 GB libres.
- Entregás al Cerebro con SendMessage: «VERDE sin tipos <sha>» y la lista de .ts. Él verifica con un refutador, sube y aplica
  migraciones con el sí de Martín.
- Commits por ruta, firmados `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Cuenta: <head -1 ~/.claude/cuenta-activa.txt>`.

## Lo pedido (en palabras de Martín o del Cerebro)
1. Feedback de las llamadas con Leila y Aaron (27/10): «fuera de Argentina se cobra con Stripe; Mercado Pago sólo en su país»;
   la tabla de /planes entendible y con el scraper; scraper y alta de Partner sólo en Pro; recursos para revender en Partners;
   código de referido editable.
2. Que el cron recupere el cobro del día 8 de una prueba de Stripe si se pierde el aviso (el Cerebro).
3. Unir la punta de Zernio (venta externa por Payment Link) y verificar los dos lados (el Cerebro).
4. Arreglar lo que encontró la verificación de 3ca2d8328 y después la de a196d5a93 (el Cerebro; informes en
   C:/dev/revisiones/2810-verificacion-3ca2d8328.md y 2810-verificacion-a196d5a93.md).
5. EN COLA, después de cobros — lo que Martín le prometió a Teo (C:/dev/revisiones/2810-promesas-teo.md):
   - «La comunidad la cobrás por mes o en un solo pago, conectando Stripe o Mercado Pago» (00:30:41): ponerle precio a la
     comunidad desde Classroom, cortar el acceso al cancelar o al no pagar, devolverlo al volver a pagar, mostrar quién está al día;
   - «Te doy 7 días de prueba» (01:03:00): un plan a mano con vencimiento en Customers, que vence solo y con los topes de la prueba;
   - Partners: aclarar en la pantalla que el 100% es del primer mes;
   - /planes: sumar lo que falta y no prometer «videos con avatar» a Pro mientras AI Avatar sea sólo del super admin
     (lib/planes-comparacion.ts:45 y :77).

## Lo hecho (todo en planes-2710)
- f60462016 (claude5) y 464df5f34: los 5 puntos de las llamadas; migración del código editable renumerada a **0341**.
- 3a5c73e35: el cron recupera el cobro del día 8 de una prueba de Stripe.
- 822cc631e, a27348240: mezcla de Zernio (5a27268bc y 5e7d316eb). De su rama entra sólo hasta 5e7d316eb; después la usa para otra tarea.
- 3ca2d8328: test de que la prueba de MaKo y la venta externa no se cruzan.
- a5f61f0c8: un Payment Link con el token de un cobro de MaKo ya no lo marca pagado (sesionDelCobro + ticket «cobro-ajeno»).
- 803d09175: el cron lee las pruebas aparte, sin el tope de 50.
- d15b4ec1d: la sesión vieja se expira antes de armar otra; la prueba sólo con tarjeta; el ?ref= de nadie no se guarda.
- 94633ec58, a196d5a93, 11ac177cd: tests al día, voseo, cosecha de infra.
- **1e6bd27e8** (la verificación de a196d5a93): el pago diferido fallido se puede reintentar; la prueba `fallido` entra al cron,
  de la más vieja a la más nueva y con reloj; el monto en unidad mínima y la misma regla en el cron; Partners no deja elegir ni
  heredar un código que ya trajo compras; con la base caída vale la cookie; el cron espera 10 min antes de mandar la compra a Meta.
- En producción (lo hizo el Cerebro con el sí de Martín): la **0341 aplicada** (28/10).
- Lo de Teo, los dos chicos (28/10, noche): /planes ya no le promete a Pro la tab AI Avatar (cerrada, sólo super admin;
  `TABS_TODAVIA_CERRADAS` en lib/planes-comparacion.ts), y la fila de Partners dice «el primer mes de cada negocio». El resto de
  Partners (panel, teléfono, landing, API) ya lo decía. Commit: el que sigue a e6fd6d88d.

## Lo de Teo
- **Plan a mano con vencimiento: HECHO** (28/10, noche). Decisión del Cerebro (de una de Martín): al vencer NO se pausa
  mientras `CORTE_DE_ACCESO_PRENDIDO = false`; avisa a la persona y a Martín. En Customers, el diálogo del plan: 7, 14 o 30
  días o sin vencimiento. Detalle en docs/hallazgos-planes-y-cobro.md («El plan dado a mano con vencimiento»).
- **La comunidad cobrada por mes: PARA LA PRÓXIMA CUENTA** (el Cerebro, 28/10: «no la arranques»). Precio en la comunidad
  desde Classroom, cortar el acceso del alumno al cancelar o no pagar, devolverlo al volver a pagar, «quién está al día».
  Toca Classroom y el «invitar al curso al ganar» del CRM (app/crm/curso-al-ganar-actions.ts). Hoy se arma a mano en cuatro
  lugares (pasarela, producto, pago, invitar al ganar) y al dejar de pagar el alumno sigue adentro. Varias horas.

## Estado de la entrega
- Último VERDE mandado: 3ca2d8328 → verificado; a196d5a93 → verificado con 2 medias y bajas, arregladas en 1e6bd27e8.
- **1e6bd27e8** (28/10, 21:10): tsc acotado sobre los 63 .ts de la unión, limpio (sólo los 14 de `_opencut`). Los tests de cada
  arreglo, de a uno, verdes, con su rojo-verde por los scripts del refutador y 12 roturas. tests-afectados (22:10): 4309 tests de
  405 archivos, un solo rojo (tests/agencia-cobro.test.ts fijaba la primera línea del lazo de pagados, donde ahora va el reloj),
  arreglado en el commit siguiente y corrido solo: 12/0. VERDE mandado al Cerebro con esa punta; espera su verificación.

## Lo que falta verificar
- /planes, /planes/<plan>, /partners y /m/partners nunca se miraron en pantalla (piden build parcial; el Cerebro frenó lo pesado).
- Si Stripe está conectada y con claves reales en el negocio de MaKo: lo mide el Cerebro en producción.

## La verificación de e6fd6d88d (28/10, noche)
- ALTA arreglada: la sesión nueva de `urlParaPagar` vuelve el cobro a `pendiente` (lib/cobros.ts); sin eso, un segundo voucher
  en curso armaba una tercera sesión y se cobraba dos veces. v1-segunda-sesion.ts: antes dos cuotas, ahora una.
- Bajas SIN HACER (agrandaban; el Cerebro: «si no entran sin agrandar, anotadas»):
  · el reloj de `reconciliarCobros` no recuerda dónde cortó: con ~400 `fallido` viejas, una prueba nueva del día 8 no se asienta
    nunca (lib/cobros.ts; hace falta guardar dónde quedó la vuelta o leer las pruebas antes que la lista general);
  · un código de Partner de un negocio borrado que todavía no trajo compras lo toma otro y se queda con su link
    (lib/partners-programa.ts, `codigoConCompras` sólo mira compras);
  · la compra a Meta sale dos veces si el reintento de Stripe llega pasados 10 min con el cron corriendo, o con dos crons a la
    vez (lib/cobros-externos-meta.ts: hace falta un reclamo antes de mandar).
- Falta medir: una suscripción común con SEPA cuya primera factura falla, que armaría una SEGUNDA suscripción.
- be95f7555 (28/10, ~23:20): el Cerebro confirmó la alta con su script. tests-afectados de la punta: VERDE, 4376 tests de 415
  archivos. tsc acotado: el de be95f7555 lo cortó el vigía de RAM (salida 99, sin resultado); el de 55542d446 (los mismos 71
  archivos, una línea antes) dio sólo los 14 de `_opencut`.
- **Espera revisión del Cerebro (no entra al tren de hoy): 5905eeb7d (lo chico de Teo) y 55542d446 (el plan a mano con
  vencimiento).** Si la cuenta corta antes, queda para la próxima.

## La verificación de ddfa645d4 (29/10): las tres ALTAs, cerradas por el chat de Zernio en `zernio-2510`

En la cuenta claude3 no había chat de Planes: el Cerebro se las pasó al de Zernio, que ya traía Planes mezclado (8d48ef4c3).
Merge de ddfa645d4 en zernio-2510 (sin rebase) y encima los arreglos (informe:
C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md, desde la línea 67):
1. **El fallo tardío de la sesión o la suscripción vieja** ya no devuelve el cobro a `fallido` (lib/cobros-webhook.ts,
   `suscripcionVigente`; `aplicarPagoFallido` con compare-and-set por la sesión).
2. **sub_A se cancela al armar B** (`urlParaPagar`), su aviso de cancelación no cancela el cobro, y un pago tardío de la vieja no
   es cuota: abre un ticket (`avisarFacturaDeOtraSuscripcion`).
3. **El plan a mano** se apaga con un `ya_tenia_cuenta` pagado con el email de un admin (lib/prueba-uso.ts), y el aviso al vencer
   se saltea a quien ya no está en prueba (lib/plan-a-mano.ts; cierra también la MEDIA del aviso a quien ya paga).
Los guiones del refutador (c2-reintentos, v1-segunda-sesion, p1-plan-a-mano) corridos sobre zernio-2510: UNA cuota y UNA
suscripción viva en todos. c2 quedó versionado como tests/cobro-reintento.test.ts. **Siguen sin hacer** la otra MEDIA (el 429 de
Resend repite el aviso a la persona) y las BAJAS (la fecha en hora de Argentina, la carrera de «más días», «termina hoy»).

## Sin hacer (con el archivo donde vive)
- La compra a Meta: si la línea del historial no se escribe NUNCA, cada vuelta del cron la vuelve a mandar (lib/cobros-externos-meta.ts, de Zernio).
- La RPC `cambiar_codigo_partner` no mira cobros.ref_codigo: el chequeo está en TS (lib/partners-programa.ts).
- Una cookie de un código muerto en /r tapa el link del partner vigente (app/r/[codigo]/route.ts, preexistente).
- Una prueba de Mercado Pago autorizada más de 2 días después sin volver a la página la activa recién su primer cobro (lib/cobros.ts, preexistente).
- Una renovación de Stripe (mes 2+) con el aviso perdido no tiene cron (lib/cobros.ts, `reconciliarCobros` sólo mira pendientes).

## Lo que espera a Martín
- Precio del Acelerador (US$1.500 en 3 cuotas vs 2.000 en 4 con un año de Pro).
- Segundo nivel de Partners (10% desde el 2º mes).
- Grabar los audios y videos para Partners (lista en docs/hallazgos-partners.md).
- Abrir AI Avatar a Pro o sacarlo de /planes (es parte de lo de Teo).

## Cosecha
docs/hallazgos-planes-y-cobro.md · docs/hallazgos-pagos.md · docs/hallazgos-partners.md · docs/hallazgos-infra.md, con sus filas
en docs/hallazgos.md; reglas en AGENTS.md («releer no alcanza», «una guarda extendida a todos se decide estado por estado», el
número de migración se barre también por etiquetas).
