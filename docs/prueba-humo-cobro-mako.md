# Prueba de humo: el primer cobro de un plan de MaKo

**Para Martín, apenas conecte la pasarela de MaKo** y ANTES de que las landings manden gente a `/planes`. La escribió el
chat «Cobros» el 23/10/2026, después de la revisión del primer cobro (docs/hallazgos-planes-y-cobro.md, «El primer cobro
real»), y la reescribió el 24/10 para poder seguirla sin nadie al lado.

**Cómo hacerla:** en la computadora, con tu sesión de super admin abierta en hola-mako.com. Lleva unos 30 minutos. Son tres
vueltas: una con Stripe de PRUEBA (sin plata), una con Mercado Pago de prueba (sólo si vas a cobrar en pesos) y UNA compra
real. Si un paso no da lo que dice, frená y no publiques las landings con `/planes`: pasale al Cerebro el número del paso.

---

## 0. Antes de empezar (una vez)

1. Decidí con qué vas a cobrar: **Stripe** (tarjeta, en dólares), **Mercado Pago** (en pesos) o las dos.
2. Si vas a usar Mercado Pago, decidí el **precio en pesos** de Esencial y de Pro. MaKo no inventa la tasa de cambio.
3. En MaKo, entrá al espacio de la plataforma → **Automations** → galería → agregá **«Entró un pago»** y fijate a qué grupo
   te llega. Es como te enterás de cada venta, y de cuando una cuenta no se pudo crear.

## 1. Stripe con claves de PRUEBA (sin plata real)

Mientras haya claves de prueba conectadas, en `/planes` sólo podés comprar vos, con tu sesión: nadie más ve el botón de
pagar.

1. En stripe.com, prendé **«Test mode»** (arriba a la derecha). Andá a **Developers → API keys** y copiá la **Secret key**:
   empieza con `sk_test_`.
2. En MaKo, abrí **hola-mako.com/integraciones?ws=9** (con el `?ws=9` al final, siempre) → tarjeta **Stripe** → pegá la
   clave → **Guardar**. En el recuadro de la tarjeta tiene que decir **«Modo: Prueba: los pagos no son reales»** y **«Aviso
   de pagos: Registrado por MaKo»**.
3. Abrí **hola-mako.com/planes/esencial**. Escribí un nombre cualquiera y un **correo que nunca haya entrado a MaKo**
   (mejor si es de Hotmail u Outlook: así probás también entrar sin Google).
4. En la pantalla de pago de Stripe usá la tarjeta **4242 4242 4242 4242**, cualquier fecha futura (por ejemplo 12/30) y
   CVC **123**.
5. En menos de 2 minutos tiene que pasar todo esto:
   - la página dice **«Pago recibido»** y que la cuenta está creada;
   - en **hola-mako.com/admin/cobros**, esa compra dice **«Pagado»** y **«Cuenta creada»**, sin ninguna nota abajo;
   - al correo que usaste le llega un mail **«Tu acceso a MaKo»**;
   - te llega el aviso **«Entró un pago»** (si hiciste el paso 0.3).
6. Entrá como lo haría el cliente, en una ventana de incógnito: **hola-mako.com/login** → **«o entra con tu correo»** →
   **«¿Olvidaste tu contraseña?»** → escribí el correo de la compra → abrí el mail que llega → creá una contraseña →
   entrás a MaKo y ves el plan **Esencial**.
7. **Contá la persona de la cuenta nueva.** En **hola-mako.com/admin**, buscá el negocio nuevo (se llama como el nombre que
   pusiste en el paso 3): tiene que decir **«1 miembro»**. Si dice **«0 miembros»**, FRENÁ: es una cuenta pagada sin nadie
   adentro (ya pasó una vez, con una agencia, el 28/09). Avisale al Cerebro antes de seguir.
8. Limpiá la prueba: en **/admin/cobros**, en esa compra, tocá **«Reembolsar»**. En la ventana que se abre, dejá MARCADA la
   casilla **«Cortar también la suscripción»** y confirmá. Tiene que quedar **«Reembolsado»** y desaparecer el botón
   «Cortar la suscripción». Después borrá ese negocio de prueba desde **/admin**.
9. Pasá a la clave real: en la tarjeta Stripe de **/integraciones?ws=9**, tocá **Desconectar**. Después, en stripe.com con
   «Test mode» APAGADO, copiá la Secret key real (empieza con `sk_live_`), pegala y guardá. Tiene que decir **«Modo: Real»**.
   (Al revés no se puede: MaKo no deja pegar una clave de prueba encima de una real, porque rompería los avisos de los pagos
   de verdad. Por eso primero se desconecta.)

## 2. Mercado Pago con claves de PRUEBA (sólo si vas a cobrar en pesos)

1. En **mercadopago.com/developers/panel/app**, entrá a tu aplicación (tipo «Checkout Pro»). En **Credenciales de prueba**,
   copiá el **Access token**.
2. En la misma aplicación, buscá las **cuentas de prueba** y creá una de tipo **comprador**. Anotá su correo (termina en
   `@testuser.com`) y su contraseña: con ella vas a pagar en el paso 6.
3. En **hola-mako.com/integraciones?ws=9** → tarjeta **Mercado Pago** → pegá el token → Guardar. Tiene que decir **«Modo:
   Prueba: los pagos no son reales»** y la **Moneda** (ARS).
4. En la misma tarjeta hay un **recuadro amarillo** con una dirección. Copiala **completa**: termina en `?u=` y un número.
   En Mercado Pago → tu aplicación → **Webhooks** → **Configurar notificaciones**: pegala, marcá **«Pagos»** y **«Planes y
   suscripciones»** y guardá. Mercado Pago te muestra una **clave secreta**: copiala y pegala en **«Clave secreta del
   aviso»** de la tarjeta de MaKo.
5. En **hola-mako.com/admin/cobros**, en el recuadro **«Planes en Mercado Pago»**, escribí el precio en pesos de cada plan
   (sólo el número, sin «$»; el punto de miles vale) y tocá **Guardar** en cada uno.
6. Abrí **hola-mako.com/planes/esencial** y comprá con el **correo del comprador de prueba** del paso 2. Mercado Pago exige
   que sea el mismo correo de la cuenta que paga. Para pagar, entrá a Mercado Pago con ese comprador de prueba.
7. Los pagos de prueba de Mercado Pago a veces no avisan al momento: la compra puede tardar **hasta 30 minutos** en quedar
   «Pagado» en /admin/cobros (MaKo revisa sola a los :17 y a los :47 de cada hora). Esperá a que pase antes de seguir.
8. Repetí los chequeos del paso **1.5 a 1.8** (la página, /admin/cobros, el mail, entrar sin Google, «1 miembro», la
   limpieza).
9. Pasá a las credenciales **de producción** igual que en Stripe: Desconectar, y conectar con el Access token de
   «Credenciales de producción». El número del final de la dirección cambia: volvé a copiar la del recuadro amarillo y
   pegala en la «URL de producción» del Webhook (y la clave secreta, si Mercado Pago te muestra otra).

## 3. UNA compra real

1. Con las claves reales conectadas, comprá **Esencial** con un correo nuevo tuyo y tu tarjeta (o tu Mercado Pago).
2. Repetí los chequeos del paso **1.5 a 1.7**.
3. Devolvela con **«Reembolsar»** y la casilla **«Cortar también la suscripción»** marcada.
4. En el panel de Stripe (o de Mercado Pago), fijate que la suscripción figure **cancelada** y el pago **devuelto**.

Si las tres vueltas dieron lo que dicen, ya se puede publicar `/planes` en las landings.

## Lo que conviene dejar hecho en Stripe

- **Settings → Billing → Revenue recovery → Smart Retries**: prendido. Al agotar los reintentos, que la suscripción quede
  «past due» con la factura abierta: así el botón «Pagar» de MaKo le encuentra la factura al cliente.
- **Settings → Billing → Subscriptions and emails**: prendé los mails de **pago fallido** y de **tarjeta por vencer** (con
  el link de Stripe para cambiar la tarjeta: MaKo todavía no tiene dónde cambiarla).

## Si algo sale distinto

| Ves esto | Qué es y qué hacer |
|---|---|
| En /planes: «Todavía no podemos cobrar en línea» | No hay pasarela conectada; o sólo Mercado Pago sin el precio en pesos (paso 2.5); o claves de prueba y no estás con tu sesión |
| En /admin/cobros: «Ya tenía cuenta» | Ese correo ya era de MaKo: probá con otro. Si fue una venta real, el botón **«Darle el plan a su cuenta»** se la asigna |
| Nota «El mail de acceso no salió» | La cuenta está creada pero el mail no llegó: mandale vos el link hola-mako.com/login |
| «El alta falló» | MaKo lo reintenta sola cada media hora; si a la hora sigue igual, avisale al Cerebro |
| En /admin, el negocio nuevo con «0 miembros» | Una cuenta pagada sin nadie adentro: frená y avisale al Cerebro |
| Al conectar: «Ya cobras en vivo con Stripe aquí…» | Estás pegando una clave de prueba sobre la real: primero Desconectar |
| En «Planes en Mercado Pago»: «Ese precio no se entiende» | Escribí sólo el número, sin «$» (el punto de miles vale) |
