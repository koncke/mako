# Cobrar con MaKo: lo que falta para el lanzamiento, y la prueba

**Al 24/10/2026, el día antes del lanzamiento.** Hoy MaKo **no puede cobrar en línea**: el espacio de MaKo no tiene ninguna
pasarela conectada (ni Stripe ni Mercado Pago) y no hay ningún cobro. Quien entra a hola-mako.com/planes/esencial ve
«Todavía no cobramos en línea. Agenda una llamada y te damos de alta». Todo lo demás está listo y probado (abajo). Lo único
que falta es de Martín, porque son sus cuentas: nadie más puede sacar esas claves ni pegarlas.

---

## Lo tuyo, Martín (5 minutos)

**Primero, con qué cobrás.** Stripe cobra en dólares con tarjeta, pero **no abre cuentas a negocios radicados en
Argentina**. Mercado Pago cobra en pesos, pero necesita el **precio en pesos** de cada plan, y ese precio lo decidís vos:
MaKo no inventa la tasa de cambio.
- **Si MaKo tiene cuenta de Stripe:** seguí con Stripe (pasos 1 a 4). Mercado Pago es opcional.
- **Si no tiene:** el único camino es Mercado Pago, y **sin el precio en pesos nadie puede pagar en línea**. Hacé los pasos
  con Mercado Pago (más abajo) y cargá el precio en pesos sí o sí.

1. **Stripe, con claves de prueba.** En stripe.com prendé **«Test mode»** (arriba a la derecha) → **Developers → API keys**
   → copiá la **Secret key** (empieza con `sk_test_`). En MaKo abrí **hola-mako.com/integraciones?ws=9** (así, con el
   `?ws=9`: es el espacio de MaKo) → tarjeta **Stripe** → pegala → **Guardar**. Tiene que decir **«Modo: Prueba: los pagos no
   son reales»** y **«Aviso de pagos: Registrado por MaKo»**.
2. **Una compra de prueba.** Abrí **hola-mako.com/planes/esencial** (con tu sesión: con claves de prueba nadie más puede
   pagar). Poné un nombre y un **correo que nunca haya entrado a MaKo** (mejor Hotmail u Outlook). Pagá con la tarjeta
   **4242 4242 4242 4242**, vencimiento **12/30**, CVC **123**.
3. **Avisale al Cerebro.** Desde ahí sigue el chat «Cobros»: los chequeos con captura, la devolución y la limpieza.
4. **Recién después, la clave real.** En la misma tarjeta tocá **Desconectar**, y con «Test mode» APAGADO copiá la Secret key
   real (`sk_live_`), pegala y guardá. Tiene que decir **«Modo: Real»**. (Al revés no se puede: una clave de prueba encima de
   la real rompería los avisos de los pagos de verdad.)

**Con Mercado Pago** (si no hay Stripe, o además): en mercadopago.com/developers/panel/app → tu aplicación → **Credenciales
de prueba** → copiá el Access token y pegalo en la tarjeta **Mercado Pago** de hola-mako.com/integraciones?ws=9. Copiá
completa la dirección del **recuadro amarillo** de esa tarjeta (termina en `?u=` y un número), pegala en Mercado Pago →
Webhooks → Configurar notificaciones, marcá «Pagos» y «Planes y suscripciones», y pegá la clave secreta que te da en «Clave
secreta del aviso». Cargá el precio en pesos de cada plan en **hola-mako.com/admin/cobros → «Planes en Mercado Pago»**. Para
la compra de prueba, Mercado Pago pide un comprador de prueba (se crea en tu aplicación, en «cuentas de prueba») y que el
correo de la compra sea el suyo.

## Qué pasa con los pesos (decidido el 24/10)

Mientras no haya un precio en pesos, Mercado Pago **no se ofrece**: con Stripe conectado se cobra con tarjeta en dólares (la
página dice «US$ 47 por mes» y Stripe acepta tarjetas de cualquier país); sin Stripe, la página manda a agendar una llamada.
Nunca llega alguien al pago sin forma de pagar, y nunca se cobra con una tasa que no decidiste. Mercado Pago aparece solo,
sin tocar nada más, el día que cargues el precio en pesos.

## Lo que ya está verificado, sin pasarela (24/10)

| Qué | Cómo se verificó |
|---|---|
| Al pagarse, el alta crea la cuenta **y la persona**, y si el mail de acceso no sale la cuenta queda igual y se avisa | Ejecutando el alta de verdad con la base simulada (tests/alta-cliente-conducta.test.ts) |
| El mail de acceso y la página de después de pagar dicen cómo entrar sin Google (correo y «¿Olvidaste tu contraseña?») | Leído en producción |
| La deuda y la mora se calculan de lo que cobró la pasarela, y quien paga no ve una deuda falsa | Ejecutando las reglas con datos (tests/plan-acceso.test.ts) |
| Suspender sólo pausa el negocio: no borra nada, y pagar lo reabre | Leído en el código (lib/plan-acceso.ts) |
| El **corte de acceso está APAGADO**: la deuda se ve y nadie se pausa. Se decide prenderlo con el primer impago real | Leído en el código |
| La baja ofrece el descuento de retención (50% por 2 meses, una vez) y lo aplica en la pasarela | Leído en el código (tests/retencion-y-deuda-rutas.test.ts). Aplicarlo de verdad necesita la pasarela |
| Crear un cobro con la pasarela a medio camino no pierde el link ni deja un cobro mudo, y anular cierra el link en la pasarela | Ejecutando con la base fallando (tests/cobro-checkout-cierre.test.ts) |
| Los reintentos de un cobro que falla | Los hace la pasarela, no MaKo: ver «En Stripe» abajo |

77 tests de estas piezas, todos verdes en main el 24/10.

## Lo que corre «Cobros» cuando avises (con captura de cada uno)

1. La página dice **«Pago recibido»** y la cuenta creada.
2. En **hola-mako.com/admin/cobros**, la compra dice **«Pagado»** y **«Cuenta creada»**, sin nota abajo.
3. Al correo de la compra le llega **«Tu acceso a MaKo»**, y te llega el aviso **«Entró un pago»** (si la automatización
   está agregada en el espacio de MaKo: Automations → galería → «Entró un pago»).
4. Entrar como el cliente, sin Google: **«o entra con tu correo» → «¿Olvidaste tu contraseña?»** → crear una → ver el plan.
5. **Contar la persona:** en **hola-mako.com/admin**, el negocio nuevo tiene que decir **«1 miembro»** (sale de contar las
   personas guardadas, no de lo que respondió el alta). Con «0 miembros» se frena: es una cuenta pagada sin nadie adentro.
6. **Devolver y cortar:** «Reembolsar» con **«Cortar también la suscripción»** marcada → queda «Reembolsado», y en Stripe la
   suscripción cancelada, el pago devuelto y el link cerrado.
7. Si conectaste Mercado Pago: que **sin precio en pesos** la página no lo ofrezca, y que con precio sí.
8. Borrar el negocio de prueba.

## En Stripe, dejar hecho

- **Settings → Billing → Revenue recovery → Smart Retries**: prendido. Son los reintentos de un cobro que falla. Al agotarlos,
  que la suscripción quede «past due» con la factura abierta: así el botón «Pagar» de MaKo le encuentra la factura al cliente.
- **Settings → Billing → Subscriptions and emails**: prendé los mails de **pago fallido** y de **tarjeta por vencer**.

## Si algo sale distinto

| Ves esto | Qué es y qué hacer |
|---|---|
| En /planes: «Todavía no cobramos en línea» | No hay pasarela que sirva: falta conectar Stripe (o sólo está Mercado Pago sin precio en pesos, o claves de prueba y no estás con tu sesión) |
| En /admin/cobros: «Ya tenía cuenta» | Ese correo ya era de MaKo: probá con otro. En una venta real, «Darle el plan a su cuenta» se la asigna |
| Nota «El mail de acceso no salió» | La cuenta está creada pero el mail no llegó: mandale vos el link hola-mako.com/login |
| «El alta falló» | MaKo lo reintenta sola cada media hora; si a la hora sigue igual, avisale al Cerebro |
| El negocio nuevo con «0 miembros» | Una cuenta pagada sin nadie adentro: frená y avisale al Cerebro |
| Al conectar: «Ya cobras en vivo con Stripe aquí…» | Estás pegando una clave de prueba sobre la real: primero Desconectar |
