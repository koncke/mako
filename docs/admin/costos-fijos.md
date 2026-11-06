# Costos fijos de MaKo: todo lo que se paga para que funcione

Armado el 6/11/2026 a pedido de Martín: «agrega todas las suscripciones de todo lo que estemos pagando... incluso los pagos de 1 vez, o los de 1 vez al año».

**Regla del documento:** un monto sin respaldo queda en «sin monto». Nada se estimó para llenar un casillero. La columna **De dónde salió** dice si el número es un recibo, algo que dijo Martín o una medición del repo. Un recibo pesa más que lo que dijo alguien; lo que dijo alguien pesa más que una estimación.

**Lo que se miró:** el Gmail de Martín (12 meses; recibos, facturas y avisos de cobro), la memoria de Martín, `~/.claude/cuentas.tsv` y `docs/hallazgos-infra.md`, `docs/tiendas-play-appstore.md`, `docs/hallazgos-ia.md`, `docs/hallazgos-comunicacion.md`. No se miró ningún panel de proveedor ni ningún banco. **Lo que no está en el Gmail de Martín** (porque lo paga otra persona o con otro correo) sólo puede salir de esas personas.

## 1. Mensuales

| Servicio | Para qué | Monto | Moneda | Ciclo | Último cobro / próximo | Quién paga | De dónde salió |
|---|---|---|---|---|---|---|---|
| Claude Max, 5 cuentas (`claude1` a `claude5`) | Los chats que desarrollan MaKo, y el crédito de API que se vincula a la plataforma | 200 por cuenta (1.000 las cinco) | USD | mes | Último y próximo: sin dato (no hay recibo en este Gmail: se compraron con los correos de cada titular) | **Sin saber** (ver dudas 1 y 2) | Monto: `docs/hallazgos-ia.md` («US$200 por mes cada uno») y memoria `decisiones-ia-plataforma-22-10`. Cantidad: `cuentas.tsv`. El 16/10, con 4 cuentas, Martín dijo en la reunión «800 dólares en cuentas» (resumen de Fathom) |
| Vercel (equipo `mbustos-4239`) | Hosting y deploy de MaKo | Plan y asientos US$20 cada uno; la factura en curso va en **US$278,03** (panel, 6/11 11:32 UTC; período hasta el 16/11, ya sin el asiento extra). Objetivo con el cambio de ese día: **~US$47** | USD | mes (período 16 al 16) | Próximo: 16/11. Las dos facturas anteriores fueron de US$40 | **Mauricio** (la cuenta dueña del equipo es de Mauricio; Martín es miembro) | `docs/hallazgos-infra.md` («El gasto de Vercel», 6/11). Gmail: avisos de Vercel del 15/10 donde `mbustos@...` le da a Martín el rol de miembro. **No es un recibo**: es la lectura del panel de ese día |
| Supabase (organización «Mauricio Bustos Business», plan Pro) | Base de datos de todos los negocios | **64,06** = 25 de plan + 49,06 de cinco computes − 10 de crédito. De esos, 9,81 son de MaKo y ~39 son de tableros de clientes de Mauricio | USD | mes | Sin dato | **Mauricio** (Martín fue invitado a la organización el 25/10, Gmail) | `docs/hallazgos-infra.md` (13/8/2026, leído con la API de Supabase). Martín hablaba de ~US$80: no cierra con 64,06 y el repo no explica la diferencia |
| Railway | Evolution (el WhatsApp no oficial) y Chatwoot, que sigue prendido | 40 | USD | mes | Sin dato | **Sin saber** (Martín escribió «estoy pagando» el 1/9, pero no dice a nombre de quién está el proyecto) | Memoria (pedido del 1/9) y `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md` (2.5, «sin verificar»). El repo da otro número: «los US$21 son de agosto, con 3 líneas; hoy son 10» (`hallazgos-infra.md`). Railway cobra por uso: el monto cambia con las líneas |
| Panda Video, plan Bronze | El video del VSL | 14,90 | USD | mes | Renovación pedida el 20/10. **Los cobros están fallando**: avisos de pago rechazado el 20/9, 22/9, 24/9, 25/9, 20/10 y 22/10 | Martín (los avisos llegan a su Gmail) | Gmail: «$14.90 payment to Panda Videos Inc was unsuccessful» y «subscription for Bronze will automatically renew on October 20, 2026» |
| ElevenLabs | Voz del avatar (speech to speech) | 22 | USD | mes | **Cobros rechazados** 25/8, 2/9, 8/9 y 12/9. El 12/9 hay una nota de crédito sobre una factura: probablemente se anuló. Estado hoy: sin saber | Martín (Gmail) | Gmail: «$22.00 payment to Eleven Labs Inc. was unsuccessful again» |
| Canva Pro | Diseño | 8.500 | **ARS** | mes | 16/10/2026 (factura 05036-43265381). También hay factura del 16/9 sin leer el monto | **Leandro** (se pagó con su Mercado Pago, no con el de Martín) | Gmail: «Tu factura de Canva» |
| Google AI Pro | Avatares y video con Google (Flow, Veo) | Sin monto | USD | mes | Sin dato | Martín (es suscriptor, según los avisos de Google One) | Gmail: aviso de beneficios para suscriptores. No hay recibo con monto |
| GitHub Actions | Pruebas y guardas de cada push | Sin monto | USD | mes (variable) | Sin dato | Sin saber | `hallazgos-infra.md`: «US$60-128 por mes según corridas, sin factura a la vista». Pendiente de Martín: el tope de US$130 (`pedidos-otras-cuentas-6-11.md`, 2.4). No hay factura de GitHub en el Gmail |

## 2. Anuales

| Servicio | Para qué | Monto | Moneda | Ciclo | Último cobro / próximo | Quién paga | De dónde salió |
|---|---|---|---|---|---|---|---|
| Apple Developer Program (cuenta individual a nombre de Leandro Tejado) | Publicar MaKo en la App Store y firmar MaKo Desktop | 99 | USD | año | Aprobada el 3/11/2026. Próximo: alrededor del 3/11/2027 (**estimado**, no hay recibo) | **Sin saber** (la cuenta es de Leandro «a propósito»; la memoria dice «pagada» sin decir quién) | `docs/tiendas-play-appstore.md` y memoria `tiendas-play-appstore`. No hay recibo en el Gmail de Martín |
| Dominio `hola-mako.com` (Porkbun) | Dominio principal | 11,08 | USD | año | 4/8/2026. Renovación estimada por Porkbun: 11,08 | Martín (recibo a su Gmail) | Gmail: Porkbun, pedido 11222867 |
| Dominio `makodigital.app` (Porkbun) | Dominio anterior, sigue registrado | 8,75 el primer año; renovación estimada 14,93 | USD | año | 1/8/2026 | Martín | Gmail: Porkbun, pedido 11189982 |
| Dominio `hola-mako.site` (Porkbun) | Sin uso conocido en el repo | 1,96 el primer año; renovación estimada **28,84** | USD | año | 14/10/2026, pagado hasta el 14/10/2027 | Martín | Gmail: Porkbun, pedido 12113586. Ver duda 7: conviene decidir antes de que renueve a 28,84 |

## 3. Pagos de una sola vez

| Servicio | Para qué | Monto | Moneda | Fecha | Quién paga | De dónde salió |
|---|---|---|---|---|---|---|
| Google Play Console, cuenta de desarrollador | Publicar MaKo en Play | 25 | USD | 3/11/2026 (22:10 UTC, «Developer Registration Fee») | Martín, con tarjeta a su nombre | Gmail: recibo de Google Payments. **Confirmado con recibo.** Es una vez: no renueva |

## 4. Gratis hoy, pero con tope (no suman, pero se pueden volver mensuales)

| Servicio | Para qué | Qué pasa | De dónde salió |
|---|---|---|---|
| Zernio | Conexión con Meta, Instagram y TikTok | Plan gratis de 2 cuentas sociales; el 1/11 avisó que se llegó al límite y pide tarjeta. La conexión de cada negocio va con su propia cuenta de Zernio (decisión del 28/10) | Gmail: «You've reached your free account limit» |
| Fathom | Resúmenes de reuniones | Plan gratis (los correos ofrecen Premium). Joan debe abrir una cuenta para su closer | Gmail, resúmenes |

## 5. Variables (no son fijos, pero se pagan)

| Qué | Monto conocido | De dónde salió |
|---|---|---|
| Pauta de Meta de MaKo | Hay recibo de anuncios del 4/11 (no se leyó el monto) | Gmail |
| IA por API de la plataforma | US$93,50 en 41 días (2.249 llamadas), medidos; hoy sale del crédito de las cuentas Max | `docs/estado-del-arte.md` |
| WhatsApp, API oficial (si se usara) | US$6 a 60 por mes según el escenario; ninguno está en uso | `docs/hallazgos-comunicacion.md` |
| Binance | No es costo: es por donde cobra Martín (Código Inmobiliario paga ahí) | `cobro-agencia-codigo` |

## 6. Lo que se buscó y no apareció

Sin recibo, factura ni mención de pago en el Gmail de Martín, ni en la memoria ni en el repo: **Resend, Apify, Cal.com, SSL.com, Replicate, Fal, Twilio, Hetzner, Contabo, Codemagic y la cuenta de Anthropic de API.** Que no aparezcan no quiere decir que sean gratis: quiere decir que el cobro va a otro correo, a otra tarjeta, o no existe. En el repo, Apify se usa sólo para el espía de competidores, y Hetzner sólo está como alternativa evaluada (~€10), no contratada.

## 7. Totales que se pueden afirmar hoy

No se suma todo en un solo número, porque la mitad no está confirmada.

- **Con respaldo de recibo:** Google Play US$25 (una vez); dominios US$21,79 (11,08 + 8,75 + 1,96, ya pagados); Canva ARS 8.500 por mes.
- **Con monto, pero sin recibo (dicho por Martín o medido en el repo):** Claude Max US$200 por cuenta, Railway US$40 por mes, Panda US$14,90 por mes, ElevenLabs US$22 por mes (si sigue), Apple US$99 por año.
- **De Mauricio (no sale de la plata de MaKo, si se confirma):** Vercel (~US$47 por mes si el cambio del 6/11 funciona) y Supabase (US$64,06 por mes, de los cuales US$9,81 son de MaKo).

## Dudas que sólo Martín puede contestar

1. **¿Quién paga cada cuenta de Claude?** Hoy dijiste que una la paga Mauricio. Pero `cuentas.tsv` dice que «las cinco son de Martín Koncke: las paga y las usa él», y la memoria dice que `claude1` se compró con el correo de Mauricio. Hace falta saber cuál es la de Mauricio y si las otras cuatro son las tuyas (4 × 200 = 800, que es lo que dijiste en la reunión del 16/10).
2. **¿Son cinco cuentas a US$200 hoy?** La quinta (Ananda) entró el 24/10. ¿Todas Max de US$200, o alguna es de otro plan?
3. **Vercel:** ¿US$278 o US$291,94? El repo midió 291,94 el 6/11. Y cuando se cierre el período (16/11), ¿baja a ~US$47? Eso se confirma en el panel, no hoy.
4. **Railway:** ¿el proyecto está en tu cuenta o en la de Mauricio? ¿Sigue en US$40 con las 18 líneas de Evolution?
5. **Apple Developer:** ¿quién pagó los US$99, vos o Leandro? ¿Con qué tarjeta se renueva en 2027?
6. **Panda Video y ElevenLabs:** los cobros fallan. ¿Querés mantenerlos? Si no, se cancelan antes de que sigan los intentos.
7. **Dominios:** `hola-mako.site` y `makodigital.app`, ¿se usan? El `.site` renueva a US$28,84.
8. **Canva Pro** lo paga Leandro: ¿entra como costo de MaKo?
9. **Google AI Pro, GitHub y Resend:** ¿cuánto pagás y con qué correo? No hay forma de sacarlo de acá.
10. **TBPremium LLC** (US$29, cobros rechazados del 4 al 12/9): no sé qué es. Si es de MaKo, falta en la tabla.
