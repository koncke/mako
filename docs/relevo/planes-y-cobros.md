# Relevo — Planes y cobros (cuenta claude4, 11/11/2026)

Chat «Planes y cobros» (antes «Planes, pagos y Partners»). Worktree **C:/dev/wt-planes-1111**, rama **planes-1111**, desde
origin/main b1bec3396 (sin push: la sube el Cerebro). Lo de antes (hasta el 28/10) ya está en main; su relevo es
docs/relevo/planes-pagos-partners.md.

## Lo pedido (Martín, 11/11, por el Cerebro)
1. «Stripe, con la cuenta de Leila Fittipaldi, que se la prestó para cobrar MaKo.» La clave la conecta él en
   hola-mako.com/integraciones del negocio de MaKo. Dejar listo y probado el cobro con el diseño acordado; probar primero en
   modo de prueba de Stripe con sus tarjetas de prueba; nunca un cobro real sin Martín.
2. «Whop, y después las otras pasarelas»: la solicitud con MaKo tal cual es, sin before/after, con la función y no el
   riesgo. Lo que no se quiera declarar se apaga antes. Se manda sólo con el OK del Cerebro al texto final, desde la cuenta
   de Martín.
3. Ninguna pregunta técnica a Martín.

## Lo hecho
- Medido (sólo lectura): Stripe no está en el negocio de MaKo (sólo Mercado Pago) ni en el ws 3; sí en los ws 1 y 10.
  Cobros: 2 de Mercado Pago, pendientes. La moderación no corre desde el 5/11.
- **La prueba de humo desde Argentina:** la Stripe de prueba del super admin quedaba tapada por la regla del país. Arreglado
  (`pasarelasParaOfrecer`, lib/compra-plan-reglas.ts y lib/compra-plan.ts), con tests/prueba-de-humo-pasarela.test.ts (rojo
  0/4 → verde 4/0, tres roturas) y dos tests viejos al día (cobro-lanzamiento, planes-stripe-afuera).
- **Whop:** el texto final y lo que hay que apagar antes, en docs/proveedores-de-cobro.md, sección 10.
- Cosecha: docs/hallazgos-planes-y-cobro.md («Stripe con la cuenta de Leila»), con sus filas en docs/hallazgos.md.

## Lo que espera a Martín (lo pide el Cerebro, sin preguntas técnicas)
- Pegar la clave de PRUEBA de Stripe (`rk_test_`) de la cuenta de Leila en /integraciones del negocio de MaKo y hacer la
  compra de prueba con la tarjeta 4242 (los pasos, en hallazgos-planes-y-cobro.md). Después, borrar la cuenta de prueba que se
  crea y pegar la clave real.
- Saber que cobrar con la cuenta de Stripe de otra persona puede violar el contrato de Stripe (sin verificar).
- Whop: si la importación de grupos de WhatsApp y la lectura de Instagram de otros se apagan o se declaran; a nombre de quién
  va la solicitud; y el OK al texto final.

## Antes de mandar la solicitud a Whop (de otro chat)
- La home (Web Generator del negocio de MaKo, chat Landings): sacar la cifra de antes y después («De meses por debajo de $10k
  USD a más de $70k USD…») y los testimonios con cifras, «con goteo para que no te baneen» y, según lo que decida Martín,
  «toca «Extraer»…».

## Sin verificar
- La prueba de humo con Stripe de verdad (necesita la clave de prueba).
- El contrato de Stripe sobre cobrar por otro negocio.
- tests-afectados de la rama: no se corrió en la PC (regla: en la PC sólo el test tocado; lo corre GitHub).

## Whop: lo que hay que dejar FUERA del producto cobrado ANTES de la primera venta, si aprueban (lista interna, 11/11/2026)
Decisión de Martín por el Cerebro (11/11): la solicitud describe sólo la versión que se vende por Whop; esto no se menciona.
Si aprueban, se cumple antes de la primera venta:
1. La importación de contactos de grupos de WhatsApp («Extraer», app/crm/grupo-wa-actions.ts y su tab) fuera del plan
   cobrado por Whop.
2. La lectura de Instagram de otras cuentas de Competitor Spy (Apify, lib/spy.ts) fuera del plan cobrado por Whop.
3. La home (Web Generator del negocio de MaKo, chat Landings): sin la cifra de antes y después («De meses por debajo de $10k
   USD…»), sin testimonios con cifras, sin «con goteo para que no te baneen» y sin «toca «Extraer»…».
4. El Acelerador (asesoría humana) no se cobra por Whop.
5. Si vuelve la moderación de imágenes, recién ahí se puede decir que existe.
Texto a mandar (TODAVÍA NO SALIÓ: espera el sí de Martín en el chat de Planes y cobros): docs/proveedores-de-cobro.md, sección 10, «El texto FINAL para mandar».

## Whop, 11/11 (cont.)
- Titular: **Leandro** (decisión de Martín por el Cerebro), como Creem y dLocal: la solicitud sale desde la cuenta de Whop de
  Leandro, con su verificación de identidad.
- No salió. Falta: el sí de Martín escrito en este chat (un relevo de otra sesión no alcanza para mandarle algo a un
  tercero), y una sesión de Whop de Leandro abierta en un navegador (no se crean cuentas ni se escriben contraseñas).
- 11/11, después: Martín dio el sí en este chat («Sí, mandala»). Medido: el navegador de la app no tiene sesión de Whop; el
  Chrome de la extensión tiene la cuenta **«scrubsoul0c»** (Ingeniero Pablo Nogués, AR; alta en julio de 2026; ningún negocio
  creado). No se sabe de quién es: el chat con el soporte de Whop del 6/11 salió de «la cuenta de Martín». En Whop no hay
  formulario aparte: la solicitud es crear el negocio en esa cuenta, y el KYC lo hace el titular.
- 11/11, Martín en este chat: «Sí, es de Leandro» → «scrubsoul0c» es la cuenta de Whop de Leandro. Al ir a mandarla, la
  extensión de Chrome se desconectó (Chrome abierto, `list_connected_browsers` vacío durante ~8 min) y antes la tenía ocupada
  otro chat. **No salió**: espera que la extensión vuelva a conectarse. Lo que falta hacer, en la cuenta «scrubsoul0c»:
  «Create a business», nombre MaKo, el texto final de docs/proveedores-de-cobro.md §10; KYC y banco los carga Leandro.
