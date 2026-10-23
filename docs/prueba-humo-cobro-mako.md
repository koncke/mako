# Prueba de humo: el primer cobro de un plan de MaKo

**Para Martín, apenas conecte la pasarela de MaKo** (antes de que las landings manden gente a `/planes`). Escrita el
23/10/2026 por el chat «Cobros», después de la revisión del primer cobro (docs/hallazgos-planes-y-cobro.md, «El primer
cobro real»). Vale con la tanda `cobros-lanzamiento-2310` ya en producción: si no está, los botones «Cortar la
suscripción» y «Planes en Mercado Pago» no aparecen.

Son tres vueltas: una con claves de PRUEBA (sin plata), una con Mercado Pago si vas a cobrar en pesos, y UNA compra real.
Si un paso no da lo que dice, no publiques las landings con `/planes`: pasale al Cerebro el número del paso.

---

## 0. Antes (una vez)

1. Decidí con qué cobrás: **Stripe** (tarjeta, en dólares), **Mercado Pago** (en pesos) o las dos.
2. Si vas a usar Mercado Pago, decidí el **precio en pesos** de Esencial y de Pro. MaKo no inventa la tasa.
3. En el ws9 → Automations → galería, agregá **«Entró un pago»** y fijate a qué grupo te llega: es como te enterás de
   cada venta, y de cuando una cuenta no se pudo crear.

## 1. Stripe con claves de PRUEBA (sin plata real)

Mientras haya claves de prueba conectadas, en `/planes` sólo podés comprar vos (con tu sesión de super admin): nadie
más ve la opción de pagar.

1. En Stripe, con «Test mode» prendido: Developers → API keys → copiá la **Secret key** (`sk_test_…`).
2. Entrá a **hola-mako.com/integraciones?ws=9** (con el `?ws=9`, siempre) → Stripe → pegala → Guardar.
   Tiene que decir **Modo: Prueba** y que el aviso de pagos quedó registrado.
3. Abrí **hola-mako.com/planes/esencial** con tu sesión. Poné un nombre y un **correo nuevo que no tenga cuenta en
   MaKo** (mejor si es Hotmail u Outlook: así probás también entrar sin Google).
4. Pagá con la tarjeta **4242 4242 4242 4242**, cualquier fecha futura y CVC 123.
5. En menos de 2 minutos tiene que pasar todo esto:
   - la página dice **«Pago recibido»** y que la cuenta está creada;
   - en **/admin/cobros** el cobro dice **«Pagado»** y **«Cuenta creada»**, sin ninguna nota debajo;
   - a ese correo le llega **«Tu acceso a MaKo»**;
   - te llega el aviso **«Entró un pago»** (si hiciste el paso 0.3).
6. Entrá como lo haría el cliente: hola-mako.com/login → **«o entra con tu correo»** → **«¿Olvidaste tu contraseña?»** →
   creá una con ese correo → entrás y ves MaKo con el plan Esencial.
7. Pedile al Cerebro que cuente las personas del negocio nuevo: tiene que haber **una**.
8. Limpiá: en /admin/cobros, **«Reembolsar»** con la casilla **«Cortar también la suscripción»** marcada. Tiene que
   quedar «Reembolsado» y ya sin el botón «Cortar la suscripción». Después borrá ese negocio desde /admin.
9. **Desconectá** Stripe y conectá la clave REAL (`sk_live_…`), de la misma forma. Tiene que decir **Modo: Real**.
   Al revés no se puede: MaKo no deja pegar una clave de prueba encima de una real (rompería los avisos de los pagos
   de verdad).

## 2. Mercado Pago con claves de PRUEBA (sólo si vas a cobrar en pesos)

1. En mercadopago.com/developers/panel/app → tu aplicación (Checkout Pro) → **Credenciales de prueba** → copiá el
   Access token.
2. Pegalo en **hola-mako.com/integraciones?ws=9** → Mercado Pago. Tiene que decir **Modo: Prueba** y la moneda (ARS).
3. Copiá la dirección del **recuadro amarillo, completa** (termina en `?u=` y un número). En Mercado Pago → tu
   aplicación → Webhooks → Configurar notificaciones: pegala, marcá **«Pagos»** y **«Planes y suscripciones»**, guardá,
   copiá la **clave secreta** y pegala en «Clave secreta del aviso» de la tarjeta.
4. En **/admin/cobros → «Planes en Mercado Pago»**, cargá el precio en pesos de cada plan y guardá cada uno.
5. Comprá en **/planes/esencial** con el correo del **comprador de prueba** de Mercado Pago (`test_user_…@testuser.com`):
   Mercado Pago exige que sea el mismo correo de la cuenta que paga.
6. Los pagos de prueba de Mercado Pago a veces no avisan: el cobro puede tardar **hasta 30 minutos** en quedar
   «Pagado» (MaKo lo revisa solo a los :17 y a los :47 de cada hora).
7. Los mismos chequeos del paso 1.5 a 1.8, y la misma limpieza.
8. Pasá a las credenciales **de producción** igual que en Stripe: desconectar y conectar.

## 3. UNA compra real

1. Con las claves reales conectadas, comprá **Esencial** con un correo nuevo tuyo y tu tarjeta.
2. Los mismos chequeos del paso 1.5 a 1.7.
3. Devolvela con **«Reembolsar»** y la casilla **«Cortar también la suscripción»** marcada.
4. En el panel de Stripe (o de Mercado Pago), fijate que la suscripción figure **cancelada** y el pago **devuelto**.

## Lo que conviene dejar hecho en Stripe

- Settings → Billing → Revenue recovery → **Smart Retries** prendido. Al agotar los reintentos, que la suscripción quede
  «past due» con la factura abierta: así «Pagar» le encuentra la factura al cliente.
- Settings → Billing → Subscriptions and emails: prendé los mails de **pago fallido** y de **tarjeta por vencer** (con el
  link de Stripe para cambiar la tarjeta: MaKo todavía no tiene dónde cambiarla).

## Si algo sale distinto

| Ves esto | Qué es |
|---|---|
| En /planes: «Todavía no podemos cobrar en línea» | No hay pasarela conectada, o sólo Mercado Pago sin el precio en pesos (paso 2.4), o claves de prueba y no estás con tu sesión |
| En /admin/cobros: «Ya tenía cuenta» | Ese correo ya era de MaKo: usá un correo nuevo. Si fue una venta real, el botón **«Darle el plan a su cuenta»** se la asigna |
| Nota «El mail de acceso no salió» | La cuenta está creada pero el mail no llegó: pasale vos el link de hola-mako.com/login |
| «El alta falló» | MaKo lo reintenta solo cada media hora; si sigue, avisale al Cerebro |
| Al conectar: «Ya cobras en vivo con Stripe aquí…» | Estás pegando una clave de prueba sobre la real: desconectá primero |
