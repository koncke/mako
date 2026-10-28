# Relevo para el chat de la NUBE — Planes, pagos y Partners (27/10/2026, cuenta claude4)

Escrito por el Cerebro con un lector que verificó con git la cronología del chat de la cuenta 5, cortado por cuota el 27/10 ~20:15 ART.

## Cómo trabajás en la nube
- Arrancás desde la etiqueta `respaldo/planes-2710-nube` (ya tiene lo que el chat dejó sin commitear, como commit WIP). `git fetch origin tag respaldo/planes-2710-nube && git checkout -b planes-nube-2710 respaldo/planes-2710-nube`.
- ENTREGÁS POR ETIQUETA, nunca por rama: cuando una tanda está lista y con sus tests en verde, `git tag nube/planes-2710-<n> && git push origin refs/tags/nube/planes-2710-<n>`. Una rama en origin dispara un build de Vercel (cuesta plata).
- No pushees a main ni a integracion. El Cerebro mezcla tus etiquetas al tren.
- Commit por ruta explícita (nunca git add -A), firmado con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: claude4` pegados.
- Corré tus tests y los que barren el repo (tests/puente-panel-copy si tocás copy; tests/fuentes-leads-webhooks si tocás credenciales; `node scripts/rutas-windows-en-tests.mjs`; `node --import tsx scripts/generar-api-doc.mjs` si tocás lib/api-mako). No corras el tsc entero.
- Producción (Supabase, migraciones, mensajes a clientes) NO se toca desde la nube: anotalo en «Para el Cerebro» al final de este archivo y commitealo.

## Estado al cortarse
**Último encargo:** Lo abrió el Cerebro hoy 27/10 ~17:54 ART con el feedback de las llamadas de Martín (Leila, Fathom 876470842, y Aaron, 876825880), 5 puntos en orden: (1) cobrar con Stripe fuera de Argentina y MP sólo en su país, (2) tabla de /planes entendible y con el scraper, (3) scraper y alta de Partner sólo en Pro, (4) recursos para revender en Partners, (5) código de referido editable. Hizo los 5 y commiteó f60462016 a las 19:49. Corrió `antes-de-subir --rapido` (19:52 a 20:07): ROJO en 6 tests (3549 tests, 339 archivos). A las 20:08 arregló 5 (sin commitear) y a las 20:09 re-corrió 8 tests: 68 de 69 pasan, queda rojo tenant-tables-contract. A las 20:10 lo cortó la cuota («session limit, resets 9:30pm»). Nunca le pasó el sha al Cerebro (en la cronología no hay mensaje al Cerebro; sólo le contestó a Zernio sobre lib/cobros.ts).

## Brief

Sos el chat «Planes, pagos y Partners» de MaKo (Martín Koncke). Retomás en la cuenta claude4 lo que claude5 dejó cortado por la cuota a las 20:10 ART del 27/10/2026. Hablás español, voseo, corto y en listas.

LO PRIMERO, antes de tocar nada:
1. Medí el uso de la cuenta (get_usage; escribí ~/.claude/uso-cinco.txt y ~/.claude/uso-semanal.txt como hizo claude5 a las 17:58: «% reset-ISO ahora-ISO cuenta») y confirmá que el Runner está andando (memorias al-iniciar-cuenta-nueva y corte-al-97: tras un corte o reset, el Runner primero). Releé la primera línea de ~/.claude/cuenta-activa.txt: tiene que decir claude4. Hacé esto siempre, no sólo hoy.
2. Entrá al worktree C:/dev/wt-planes-2710 (rama planes-2710). NO crees otro: es el tuyo. Si falta el junction node_modules, es un Junction hacia el node_modules del clon principal (dashboard-marketing-main/dashboard-marketing); está presente hoy.
3. Verificá el estado con git: `git log --oneline -2` tiene que dar f60462016 arriba de bbb459f33, y `git status --short` tiene que mostrar 6 archivos modificados (los de abajo). Si no coincide, no sigas: avisale al Cerebro.

QUÉ ES TU PUNTA
- f60462016 («Planes y Partners › fuera de Argentina con Stripe, la tabla clara, scraper y Partners sólo en Pro, recursos y código editable»), padre bbb459f33 = origin/main (tren-n del 26/10). NO está en tren-o (2f6ae9abf, el tren que el Cerebro está armando) ni en main. Nunca se le pasó al Cerebro.
- Trae: (1) Stripe cobra fuera de Argentina con prueba de 7 días (trial_period_days, huella de tarjeta, activación al volver o por cron) y Mercado Pago sólo en su país (x-vercel-ip-country; sin país, las dos); causa real del bug: /planes nunca ofrecía Stripe porque PASARELAS_CON_PRUEBA era sólo MP desde el 25/10, no es que Stripe no anduviera. (2) Tabla de /planes sin jerga y con el scraper (lib/planes-comparacion.ts). (3) Scraper de grupos de WhatsApp y alta de Partner sólo en Pro (FUNCIONES_SOLO_PRO): candado en las 8 acciones de app/crm/grupo-wa-actions.ts, en la API, en hacermePartner y en /partners (compu y teléfono); quien ya era partner sigue. (4) «Para recomendar MaKo»: PDF de venta con jsPDF en el navegador (con su link y código) y 5 mensajes para copiar. (5) Código de partner editable con mig 0340 (aditiva, SIN aplicar) y API cambiar_codigo_partners; los links y códigos viejos siguen acreditando. La cosecha ya está escrita y en el índice dentro del commit (docs/hallazgos-planes-y-cobro.md, docs/hallazgos-partners.md, docs/hallazgos.md); no hay que rehacerla, sólo sumar si descubrís algo nuevo.

DÓNDE QUEDÓ: ROJO, a medias.
- antes-de-subir --rapido sobre f60462016 dio ROJO en 6 de 3549 tests: cobro-lanzamiento, migraciones-funciones-cerradas, agencia-cobro, reportar-a-soporte, tenant-tables-contract (los 5 son de esta punta) y pago-link-anulado (claude5 dice que es un rojo previo del 25/10 y que no toca anularCobro; NO está verificado: comprobá que falla igual en origin/main o tren-o antes de afirmarlo).
- claude5 arregló los 5 a las 20:08 y NO alcanzó a commitear. Están en el worktree: supabase/migrations/0340_partner_codigo_editable.sql, lib/tablas-de-inquilino.ts, app/partners/RecursosPartner.tsx, app/partners/PanelPartner.tsx, tests/agencia-cobro.test.ts, tests/cobro-lanzamiento.test.ts. Revisalos con `git diff` (son chicos) y conservalos.
- A las 20:09 corrió 8 tests: 68 de 69 pasan. Queda UN rojo: tests/tenant-tables-contract.test.ts dice «partner_codigos_anteriores no está en TENANT_TABLES ni en FUERA_DEL_PROXY». Arreglo: agregarla al mapa FUERA_DEL_PROXY (~línea 112-115, con su porqué, copiando el estilo de partner_codigos: la lee y escribe lib/partners-programa.ts con el cliente de servicio y el ws de la sesión; /r/<código> busca por código). Ojo: tablas-de-inquilino.ts ya la tiene en TABLAS_DE_INQUILINO, pero el contrato exige además una de las dos listas del test.

QUÉ HACER, EN ORDEN
a) Medir uso y Runner (arriba).
b) Arreglar tenant-tables-contract como se dijo.
c) Correr: cobro-lanzamiento, migraciones-funciones-cerradas, agencia-cobro, reportar-a-soporte, tenant-tables-contract, partners-recursos, partners-codigo-editable, partners-solo-plata, y los de la punta (planes-stripe-afuera, prueba-plan, stripe-api, compra-plan, planes-sin-pasarela, planes-tres-bloques, media-buyer-en-esencial, scraper-partners-solo-pro) con `node --import tsx --test tests/<x>.test.ts`. La RAM de la PC es justa (16 GB, el chequeo completo bajó a 0.4 GB libres): si falta RAM, esperá o corré de a pocos; el Cerebro reservó RAM para su tren a las 18:58 y los tests se demoraron.
d) Commit NUEVO encima de f60462016 con esos 7 archivos, por ruta explícita.
e) Pasarle la punta nueva al Cerebro (local_0ee425c6… «Cerebro»): sha, qué entra en palabras de producto, y los avisos de abajo.

REGLAS QUE TENÉS QUE CUMPLIR
(a) Tu punta va «VERDE sin tipos» al Cerebro: NO corras tsc ni el VERDE/antes-de-subir completo (ya se corrió una vez entero y costó 14 minutos). Corré tus tests y los que barren el repo leyendo fuente porque tocaste copy o credenciales (migraciones-funciones-cerradas, tenant-tables-contract, reportar-a-soporte, cobro-lanzamiento, agencia-cobro). Lo que el Cerebro verifica con tipos lo verifica él en el tren (memorias tren-de-pushes y verde-sin-tipos-tsc-acotado).
(b) Commits por ruta explícita, JAMÁS `git add -A`. Nunca --no-verify. Firma al pie del mensaje, pegadas sin línea en blanco: `Co-Authored-By: <tu modelo> <noreply@anthropic.com>` y justo debajo `Claude-Cuenta: claude4`.
(c) Trabajás sólo en tu worktree C:/dev/wt-planes-2710. En el clon principal no se commitea nada. C:/dev/wt-push-q (rama tren-o) es del Cerebro: no lo toques.
(d) No rebasar ni reescribir f60462016 ni nada que ya esté en el tren: sin rebase, sin amend, sin reset. Sumás commits encima. Fusionar con tren-o lo hace el Cerebro. Avisale de antemano que docs/hallazgos.md (el índice) conflictúa por texto con tren-o (hay que conservar las dos filas); los otros 5 archivos compartidos (app/crm/TraerDeGrupoWA.tsx, docs/api-mako.md, lib/api-mako/rest.ts, lib/stripe-api.ts, tests/api-mako-http.snapshot.txt) fusionan limpio según git merge-tree. Si tren-o cambia docs/api-mako.md o el snapshot de la API, se regeneran con node --import tsx scripts/generar-api-doc.mjs y scripts/generar-plugin.mjs, no se resuelven a mano.
(e) Lo primero que hacés es lo de arriba (medir uso, Runner, verificar el estado del worktree), no escribir código.

AVISOS PARA EL CEREBRO AL ENTREGAR
- La mig 0340 hay que aplicarla ANTES del deploy y necesita el sí de Martín en el chat (un sí del Centro no alcanza; toda escritura en producción o migración la pide el Cerebro). Razón: partner_codigos_anteriores ahora está en TABLAS_DE_INQUILINO, y el reset del cliente de prueba o el borrado de un negocio dan error si la tabla no existe. Sin la migración, «Cambiar» el código dice «todavía no se puede» y no rompe nada más. El número 0340 está libre (tren-o llega a 0339).
- Zernio (local_a910bf8b…) va a escribir la venta externa por Stripe y toca lib/cobros-webhook.ts; claude5 ya le avisó: desde esta punta la prueba gratis de un plan por Stripe llega como checkout.session.completed con payment_status = no_payment_required y SÍ es un cobro de MaKo, así que su rama (no es de MaKo + payment_link + pagada) no debe tocarla. Esta punta toca en lib/cobros.ts: crearCobro (validación de inicioAt), crearCheckout, urlParaPagar y activarPruebaSiAutorizo (partida en pruebaAutorizadaMp / pruebaAutorizadaStripe).
- Sin medir: si Stripe está conectada y en modo real en el ws9 (la lectura de producción la frenó el clasificador). Hay que pedírsela al Cerebro o a Martín; no la intentes por tu cuenta contra producción.

DESPUÉS DE ENTREGAR (si hay cuota)
- Mirar /planes, /planes/<plan>, /partners y /m/partners en el navegador (nunca se vieron; sólo se revisó el PDF generado en Node). Respetá boot-local-escribe-prod (bootear local ESCRIBE en producción) y recorrer-local-build-parcial.
- Listar el material que falta para Partners (audios y videos que graba Martín); la lista está en docs/hallazgos-partners.md.

NO TOCAR sin decisión de Martín (la pregunta el Cerebro): el precio del Acelerador (hoy US$1.500 en 3 cuotas de 500 con Pro y grupal 3 meses; en la llamada con Aaron habló de 2.000 en 4 cuotas con un año de Pro) y un segundo nivel de Partners (10% desde el 2º mes).

DECISIONES DE MARTÍN A RESPETAR
- Fuera de Argentina se cobra con Stripe; Mercado Pago sólo para Argentina (memoria cobrar-mako-argentina-directo: Argentina directo, Paraguay/Brasil/LLC no convienen).
- Scraper de grupos de WhatsApp y alta de Partner sólo en Pro, decidido en la llamada con Leila (876470842-15). Quien ya era partner no pierde el alta.
- Prueba gratis de 7 días con tarjeta (25/10), sin garantía; una prueba por negocio, email y tarjeta.
- Partners paga SÓLO PLATA (25/10 tarde): 100% del primer mes a precio de lista, sin Acelerador ni meses de crédito.
- Tabla de /planes: texto dibujado corto, sin jerga (nada de «media buyer», «topes», «embudo»), cada fila dice lo que consigue la persona.
- Nada de lo interno (tickets de Leandro, etc.) pide aprobación, pero producción, migraciones y mensajes a terceros sí piden el sí de Martín en el chat.

AL TERMINAR: respondé corto con el sha final, qué quedó verde, qué falta, y dónde quedó cosechado lo nuevo (docs/hallazgos-<área>.md con su línea en docs/hallazgos.md, en el mismo commit).

## Pendientes, en orden
1. Agregar 'partner_codigos_anteriores' al mapa FUERA_DEL_PROXY de tests/tenant-tables-contract.test.ts (~línea 112-115, con su porqué, igual que partner_codigos: «los códigos que un partner dejó de usar: lib/partners-programa.ts con el cliente de servicio y el ws de la sesión; /r/<código> los busca por código»). Es el único rojo que quedó. No está editado todavía.
2. Commitear los 6 archivos sin commitear más el test anterior, por ruta explícita, en un commit NUEVO encima de f60462016 (sin amend, sin rebase).
3. Re-correr los 6 tests que dieron rojo más los 8 de la punta y avisar al Cerebro el sha final. pago-link-anulado: el chat lo da como rojo previo documentado el 25/10 (no toca anularCobro) pero NO se verificó en esta lectura: confirmar que falla igual en origin/main o tren-o antes de decirlo.
4. Pasarle al Cerebro (local_0ee425c6…, «Cerebro») el sha y qué entra: el chat nunca lo hizo. Avisarle que docs/hallazgos.md (índice) va a conflictuar con tren-o y que hay que resolverlo a mano (conservar las dos filas).
5. La mig 0340 (supabase/migrations/0340_partner_codigo_editable.sql, aditiva, sin aplicar) la aplica el Cerebro con el sí de Martín en el chat, ANTES del deploy: ahora partner_codigos_anteriores está en TABLAS_DE_INQUILINO y el reset del cliente de prueba o borrar un negocio da error si la tabla no existe. Número libre: tren-o llega a 0339 y ninguna otra rama tiene 0340 (verificado); si el Cerebro arma otra antes, renumerar.
6. Medir si Stripe está conectada y en modo real en el ws9 (la lectura de producción la frenó el clasificador a las 18:00). Sin esa medición no se sabe si el primer cobro fuera de Argentina funciona de punta a punta.
7. /planes y /partners NO se miraron en el navegador (el chat leyó las reglas de verificación pero no abrió la pantalla). Sólo se generó y revisó el PDF de venta en Node (una hoja, acentos y link bien). Mirar /planes (con país distinto de AR si se puede), /planes/<plan>, /partners y /m/partners según las reglas de recorrer-local-build-parcial y boot-local-escribe-prod.
8. Material que tiene que grabar Martín para Partners (audios y videos): la lista está en docs/hallazgos-partners.md, sección «Recursos para revender…». Sólo hay PDF y mensajes.
9. Zernio (local_a910bf8b…) va a armar la venta externa por Stripe en lib/cobros-webhook.ts; el chat le avisó que la prueba gratis de un plan por Stripe llega como checkout.session.completed con payment_status = no_payment_required y SÍ es un cobro de MaKo: su rama (no es de MaKo + payment_link + pagada) no debe tocarla. Si choca, coordinar con ese chat.

## Decisiones de Martín que se respetan
- Fuera de Argentina se cobra con Stripe; Mercado Pago sólo para Argentina (llamada con Leila, 876470842-18).
- Scraper de grupos de WhatsApp y alta de Partner sólo en Pro (876470842-15, ya decidido).
- Prueba gratis de 7 días con tarjeta, sin garantía (25/10); una prueba por negocio, email y tarjeta.
- Partners paga sólo plata: 100% del primer mes a precio de lista, sin Acelerador (25/10 tarde).
- Texto de /planes corto y sin jerga; cada fila dice lo que consigue la persona.
- No tocar sin decisión de Martín: precio del Acelerador (1.500/3 cuotas vs 2.000/4 con un año de Pro) ni el segundo nivel de Partners (10% desde el 2º mes).
- Producción, migraciones y mensajes a terceros: el sí de Martín va en el chat vía el Cerebro.
- Medir el uso de la cuenta y verificar el Runner al iniciar y siempre (pedido de Martín de hoy).

## Lo que espera a Martín (no lo hagas vos)
- Sí para aplicar la mig 0340 en producción antes del deploy (lo pide el Cerebro en el chat).
- Decidir el precio del Acelerador (US$1.500 en 3 cuotas vs 2.000 en 4 con un año de Pro).
- Decidir si hay segundo nivel de Partners (10% desde el 2º mes).
- Grabar los audios y videos para los Partners (la lista está en docs/hallazgos-partners.md).
- Confirmar o medir que Stripe está conectada y en modo real en su cuenta (ws9) para el primer cobro fuera de Argentina.

## Dudas que el lector no pudo verificar
- pago-link-anulado: el chat dice que es un rojo previo del 25/10 que no tocó; no lo verifiqué (no corrí tests).
- No corrí los tests: el 68/69 de las 20:09 sale del transcript del chat, no de una medición mía.
- No hay en la cronología ningún mensaje al Cerebro con el sha f60462016; es posible que el Cerebro lo haya visto en la nota compartida (side-session-notes/local_3f1a66d3-.../planes-claude5-27-10.md, escrita 19:52) pero no está confirmado que la haya leído.
- El conflicto de docs/hallazgos.md con tren-o lo vi con git merge-tree (sólo lectura) contra tren-o 2f6ae9abf de hoy; tren-o se sigue moviendo, hay que volver a mirarlo.
- Si Stripe está o no en modo real: el chat no pudo medirlo (el clasificador frenó la lectura de producción a las 18:00).
- /planes y /partners no se vieron en pantalla; que el diseño se vea bien no está verificado.
- El uso medido por claude5 a las 17:58 fue 32% de la cuota de 5 horas y 9% semanal; no es un dato vigente, hay que remedir en claude4.

## Para el Cerebro
(anotá acá lo que necesita producción o una decisión)
