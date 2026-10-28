# Relevo para el chat de la NUBE — Zernio reemplaza la API de Meta + CAPI y píxel («Zernio y CAPI») (27/10/2026, cuenta claude4)

Escrito por el Cerebro con un lector que verificó con git la cronología del chat de la cuenta 5, cortado por cuota el 27/10 ~20:15 ART.

## Cómo trabajás en la nube
- Arrancás desde la etiqueta `respaldo/zernio-2710-nube` (ya tiene lo que el chat dejó sin commitear, como commit WIP). `git fetch origin tag respaldo/zernio-2710-nube && git checkout -b zernio-nube-2710 respaldo/zernio-2710-nube`.
- ENTREGÁS POR ETIQUETA, nunca por rama: cuando una tanda está lista y con sus tests en verde, `git tag nube/zernio-2710-<n> && git push origin refs/tags/nube/zernio-2710-<n>`. Una rama en origin dispara un build de Vercel (cuesta plata).
- No pushees a main ni a integracion. El Cerebro mezcla tus etiquetas al tren.
- Commit por ruta explícita (nunca git add -A), firmado con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: claude4` pegados.
- Corré tus tests y los que barren el repo (tests/puente-panel-copy si tocás copy; tests/fuentes-leads-webhooks si tocás credenciales; `node scripts/rutas-windows-en-tests.mjs`; `node --import tsx scripts/generar-api-doc.mjs` si tocás lib/api-mako). No corras el tsc entero.
- Producción (Supabase, migraciones, mensajes a clientes) NO se toca desde la nube: anotalo en «Para el Cerebro» al final de este archivo y commitealo.

## Estado al cortarse
**Último encargo:** Del Cerebro (Martín firmó el 27/10 18:22, que fue lo que activó la corrección «ya no existe TOKEN de Meta, todo por Zernio con un simple login de Facebook»), y a las 19:57 el Cerebro confirmó: «armala vos» la pieza 1 de MAU-10 (la venta de un Payment Link propio entra como cobro pagado al CRM), con event_id = purchase:<cs_>. A las 20:07 ART estaba escribiendo esa pieza 1: ya había hecho las reglas puras, el escritor registrarVentaExterna, la rama del webhook, el origen «stripe», la guardia de T2 y dos tests nuevos, y a las 20:07 lanzó la tanda de 72 archivos de test que tocan cobros/Stripe/CAPI/crm-auto; a las 20:12 lo cortó la cuota. Todo eso está SIN commitear. Quedaron por hacer: el commit, anotar el event_id en el diseño, la cosecha, y mirar dos rojos de esa tanda.

## Brief

Sos el sucesor del chat «Zernio reemplaza la API de Meta + CAPI y píxel», en la cuenta claude4 (el anterior era claude5 y lo cortó la cuota de 5 horas a las ~20:12 ART del 27/10). Respondé en español con voseo, sin relleno.

LO PRIMERO (en este orden, antes de cualquier otro pedido; memoria al-iniciar-cuenta-nueva):
1) Medir el uso de la cuenta con get_usage y comparar con ~/.claude/cuenta-activa.txt (si no cuadra, reescribirlo).
2) Dejar el Runner de la cuenta andando para que el uso aparezca en el Ops Center y los mensajes de Martín te lleguen. Ese arranque es del Cerebro. Si ya está, solo verificá que escribió en ~/.claude/operaciones/uso/<cuenta>.json.
3) Recién ahí, el trabajo. Medí el uso otra vez cada tanto: el corte al 97% está apagado, pero un reset o un corte se avisa.

TU TRABAJO: terminar MAU-10 («la venta de un Payment Link propio de Mauricio entra como cobro pagado al CRM, con el id de la sesión de Stripe cs_... para que Meta no cuente dos veces»), pieza 1.

QUÉ ESTÁ HECHO (verificado con git el 27/10 ~20:35):
- La rama es zernio-2510, worktree C:/dev/wt-zernio-2510. Trabajá SOLO ahí. NO rebases ni reescribas nada de lo entregado: b4df14b42 y todo lo anterior YA ESTÁ en tren-o (entró por el merge 71ed58b8c); origin/main sigue en bbb459f33 y todavía no los tiene.
- Lo que ya está en tren-o: aviso antes de conectar la 3.ª cuenta de Zernio (US$6), YouTube sin clave, tutorial del token que avisa el corte del 03/11, MaKo ya no habla de token ni manda a abrir=meta (la respuesta a Joan), onboarding «Conectar Meta con tu Facebook (Zernio)», Purchase por CAPI del Payment Link propio (749086da2), Purchase del navegador en el Pixel v28 (6bead23a0) y MAU-14.
- UNA punta NO está en tren-o: 761061085 (HEAD de zernio-2510). Corrige que la compra va solo al píxel del sitio y nunca en modo prueba de Stripe. Tiene tests en verde (130/130 y 11/11). Esa es «su última punta que entra en el tren siguiente»: pasásela al Cerebro/Integración como VERDE sin tipos apenas puedas, SIN esperar la pieza 1.

QUÉ ESTÁ SIN COMMITEAR en C:/dev/wt-zernio-2510 (el trabajo en curso; no lo borres, no hagas git checkout ni stash): modificados app/crm/lead-view/ficha/resumen/logica.ts, app/crm/origen-lead.ts, lib/cobros-webhook.ts, lib/cobros.ts, lib/crm-auto-plan.ts, lib/crm-auto.ts, lib/stripe-api.ts, tests/compra-payment-link.test.ts; nuevos lib/cobros-externos-reglas.ts, tests/cobros-externos-reglas.test.ts, tests/venta-externa-no-toca-mako.test.ts. Es la pieza 1 siguiendo docs/diseno-venta-externa-stripe.md (7 pasos, código de plata): registrarVentaExterna (reclama la venta insertando el cobro con el cs_, después lead por email/teléfono, después aplicarPagoAprobado), la rama del webhook que solo corre cuando cobroStripe dice «no es un cobro de MaKo», el origen de lead «stripe», la guardia de T2 (quien pagó no pasa a «No agenda») y el corte de reembolsar/cancelar para los cobros externos. Releé el diseño antes de seguir.

QUÉ HACER, EN ORDEN:
a) Correr los tests de lo tocado: el grupo CAPI+Stripe (los que mencionan cobros-webhook, lib/cobros, cobros-externos, crm-auto, origen-lead, stripe-api, meta-capi) con --test-concurrency=1. La última corrida dejó 2 rojos sin diagnosticar: tests/pago-link-anulado.test.ts («anular cierra el link también en Mercado Pago, DESPUÉS de marcarlo anulado en la base») y tests/sin-instagram.test.ts. No se sabe si son de tu cambio o rojos viejos de main/tren-o: corrélos también contra tren-o limpio. Si son tuyos, arreglalos; si no, dejalo dicho en el reporte.
b) Probar rompiendo los tests nuevos (la regla de la casa: un test no vale hasta que lo rompés y da rojo), y restaurar el código.
c) Commitear por ruta explícita (NUNCA git add -A) con Claude-Cuenta: claude4 pegado a Co-Authored-By.
d) Anotar en docs/diseno-venta-externa-stripe.md la decisión del event_id = purchase:<cs_> (el diseño original decía pi_/in_) y cosechar en docs/hallazgos-pagos.md (el área es dónde vive el código) con su entrada en docs/hallazgos.md en el MISMO commit.
e) Pasar la punta al Cerebro/Integración.

QUÉ ES «HECHO»: pieza 1 commiteada con tests verdes y probada rompiéndola, y la cosecha en el repo. Todavía faltaría, y se lo pedís al Cerebro: la prueba en el negocio de prueba (ws3) con Stripe en modo prueba, y el sí de Martín para conectar el Stripe de Mauricio (ws1). El interruptor del negocio cobros.ventas_externas arranca APAGADO; no lo prendas en ningún cliente real.

REGLAS DE ENTREGA (de Martín):
- Tu punta va «VERDE sin tipos» al Cerebro: los chats NO corren tsc ni el VERDE completo. Corré tus tests, y los que barren el repo (puente-panel-copy, fuentes-leads-webhooks, historico-al-conectar) si tocás copy o credenciales. Los tipos los corre el tren. Ver memoria tren-de-pushes.
- Commitear por ruta explícita, nunca git add -A; firmar con Claude-Cuenta: claude4 pegado a Co-Authored-By.
- No pushees: sube el Cerebro.
- Código de plata: es del chat de Pagos. Ya te lo devolvieron («armala vos») y el Cerebro confirmó que la armás vos; no pelees ahí.
- Si hay poca RAM, el vigía frena los comandos pesados: esperá o corré de a uno.

DECISIONES DE MARTÍN / DEL CEREBRO QUE DEBÉS RESPETAR:
- No existe más el token de Meta: todo es por Zernio con el login de Facebook. Ningún texto, link ni respuesta de MaKo puede mandar a abrir=meta ni decir «token» para conectar. El corte del token es el 03/11/2026.
- El event_id del Purchase es purchase:<cs_ de la sesión de Stripe> (lo decidió el Cerebro).
- El texto de corrección para Joan (grupo «MaKo <> Código Inmobiliario», ws13) y los avisos para Pablo Chávez, Sergio Arriata y Patricia Contreras están escritos en las notas del Cerebro (zernio-aviso-joan-27-10.md y zernio-capi-mau10-mau14-plan.md, en %APPDATA%/Claude/side-session-notes/local_3f1a66d3-.../); mandarlos necesita el sí de Martín. NO los mandes.
- NO reenviar el reclamo del testCode a Zernio (salió el 26/10 por mail del Cerebro).
- Todo arreglo de un cliente va a su grupo de WhatsApp (MaKo Alert); producción y terceros: el sí va en el chat, no en el Centro.
- Varias claves de Zernio por negocio: NO lo hagas. Está planeado en docs/relevo/zernio-capi.md y toca el canal de mensajes y los anuncios.

NO TOQUES: la rama zernio-2510 de lo ya entregado (no la reescribas), el worktree wt-push-q (es del Cerebro), landing-token.ts salvo necesidad (Landings puede estar tocando SNIPPET_VERSION; hoy tren-o está en v28, origin/main en v27), ni nada de Meta/Zernio en producción sin el sí de Martín. Dejá una nota en docs/relevo/zernio-capi.md con el estado final al terminar.

## Pendientes, en orden
1. MAU-10 pieza 1 (sin commitear, ver arriba): diagnosticar los 2 rojos de la última tanda: tests/pago-link-anulado.test.ts, «anular cierra el link también en Mercado Pago, DESPUÉS de marcarlo anulado en la base» (lee el cuerpo de anularCobro en lib/cobros.ts, y la rama MP sigue en la línea 1292, así que no es obvio que sea de este cambio), y tests/sin-instagram.test.ts (falló el archivo entero). NO se sabe si son de la rama o rojos viejos de main; hay que correrlos contra tren-o limpio para saber. Si son de la rama, arreglarlos; si no, dejarlo dicho.
2. MAU-10: después, probar rompiendo los tests nuevos (cobros-externos-reglas y venta-externa-no-toca-mako) y commitear por ruta explícita.
3. MAU-10: anotar en docs/diseno-venta-externa-stripe.md la decisión del event_id = purchase:<cs_> (el diseño decía pi_/in_) y cosechar en docs/hallazgos-pagos.md (el área es dónde vive el código; el índice docs/hallazgos.md en el mismo commit).
4. MAU-10: la prueba en el negocio de prueba (ws3, Stripe en modo prueba) NO se hizo. Un Payment Link de prueba y un pago por la API de Stripe, sin tarjeta en un formulario. Ojo con el interruptor cobros.ventas_externas, que es por negocio y arranca apagado.
5. MAU-10: para que el Purchase del navegador ande con Mauricio, su Payment Link del Sprint tiene que volver a la página de gracias con ?session_id={CHECKOUT_SESSION_ID} (hoy no lo hace, medido el 24/10). Se cambia en Stripe, no en el código. Sin eso, si su página de gracias manda su propio Purchase, Meta lo puede contar dos veces.
6. MAU-10: conectar el Stripe de Mauricio (ws1) a MaKo necesita el sí de Martín; lo pide el Cerebro.
7. Pixel v28: la rama lo subió de v27 a v28. En origin/main sigue v27 y en tren-o ya es v28. Si el chat de Landings también tocó SNIPPET_VERSION, puede chocar: chequear antes de tocar landing-token.ts.
8. Tipos: ningún tsc de a98443d30 en adelante se corrió. Los corre el tren/red, no el chat.
9. Varias claves de Zernio por negocio (pedido de Leila 27/10): NO se hizo a propósito. Cada clave es otro equipo de Zernio, con su propio webhook y secreto de firma. El plan de 4 pasos está en docs/relevo/zernio-capi.md (sección «Varias claves de Zernio en un negocio»); medir con dos cuentas de Zernio reales antes de prenderlo.
10. MAU-14: «la opción se movió y no la encontraba» (Mauricio): no se pudo ubicar qué opción buscaba. Las otras dos partes de MAU-14 están hechas.
11. Tanda C de la deprecación del token (en docs/relevo/zernio-capi.md): editar el público de un conjunto, crear campaña y conjunto, barrido de leads (pollMetaLeads), reproductor del anuncio, crear públicos. Sin tocar.
12. Corte del token de Meta: CORTE_TOKEN_META = '2026-11-03' (lib/zernio-meta-cuerpo.ts). Está a una semana.

## Decisiones de Martín que se respetan

## Lo que espera a Martín (no lo hagas vos)
- Su sí para mandar la corrección a Joan en el grupo «MaKo <> Código Inmobiliario» (ws13); el texto ya está listo en las notas del Cerebro.
- Su sí para el aviso a Pablo Chávez, Sergio Arriata y Patricia Contreras (tienen el token cargado pero no pautan desde MaKo; Sergio y Patricia no tienen píxel). Texto en zernio-aviso-joan-27-10.md.
- Su sí para conectar el Stripe de Mauricio (ws1) a MaKo (lo pide el Cerebro).
- Que el Payment Link del Sprint de Mauricio vuelva a la página de gracias con ?session_id={CHECKOUT_SESSION_ID}: se cambia en Stripe (Después del pago, redirigir), no en el código.

## Dudas que el lector no pudo verificar
- Los 2 rojos de la última tanda (pago-link-anulado y sin-instagram): no se sabe si son del cambio sin commitear o viejos. Lo único que se vio es la salida filtrada de un grep, sin el mensaje de error.
- El relevo del chat (docs/relevo/zernio-capi.md en tren-o) es de antes de las piezas de MAU-10 y MAU-14: no las menciona (solo la sección «Varias claves de Zernio»). No hay un relevo al día de MAU-10.
- No se verificó que el tren-o actual (2f6ae9abf) esté verde con el contenido de estas puntas: solo se verificó por git que b4df14b42 está dentro y 761061085 no.
- El Pixel v28 puede chocar con Landings si ese chat también subió SNIPPET_VERSION.
- No se pudo ver si el chat llegó a pedirle algo más al Cerebro después de las 19:57 ART (el último SendMessage fue la pregunta por la pieza 1, ya contestada).
- Quién tiene la nota «tanda de Pagos»: el chat de Pagos devolvió la pieza 1 («armala vos»); por si cambió de idea, consultalo antes de tocar lib/cobros.ts.

## Para el Cerebro
(anotá acá lo que necesita producción o una decisión)
