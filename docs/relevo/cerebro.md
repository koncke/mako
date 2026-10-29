# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 29/10/2026 ~00:55, relevo final de la cuenta 4 (claude4)

**Si sos una cuenta NUEVA**, Martín te escribe «Hola, eres la Nª cuenta… Continúa con todo» y con eso alcanza. No
preguntes: hacé esto en orden.

1. **La cuenta:** `claude<N>` en `~/.claude/cuenta-activa.txt`; su línea en `~/.claude/cuentas.tsv`; `get_usage` →
   `uso-semanal.txt` y `uso-cinco.txt` con la cuenta en el 4º campo. El reset semanal prueba que es otra cuenta.
2. **El Runner, y probado de punta a punta** (Martín, 27/10: «siempre, al abrir una cuenta nueva, asegurate de que esté
   bien la conexión con el Ops Center»):
   - `node ~/.claude/operaciones/cartero.mjs cartero claude<N> app ~/.claude` y `… carpeta <uuid> claude<N>`;
   - `start_session` «Runner», `claude-haiku-5-5`, esfuerzo bajo, con `INSTRUCCIONES_RUNNER` (lib/runner.ts) como
     encargo + «hacé una vuelta ya»; después `detach_session`;
   - ⚠️ **EN BYPASS, como los chats.** En «auto», la app RETIENE los mensajes entre sesiones de modos distintos y el
     cartero los acusa «ok» igual: el 27/10 Martín escribió tres veces y nadie contestó (docs/hallazgos-operaciones.md).
     Si lo abrís en auto para no mostrar una tarjeta, subilo con `set_session_permission_mode` (desde bypass no pide nada);
   - **El ciclo se prueba con el reloj:** `medido` de `~/.claude/operaciones/uso/<cuenta>.json` cambia DOS veces seguidas
     (cada 2 min). Después, un mensaje de prueba de Martín desde el Ops Center tiene que llegar al Cerebro.
   - ⚠️ Un reinicio de la app se lleva el CronCreate del Runner, y el Runner NO lo re-arma si se lo pide el Cerebro
     (es config persistente): se abre uno nuevo en un turno de Martín.
3. **Este chat se llama «Cerebro».** Los de área se abren EN EL TURNO de Martín (un turno que arrancó con el mensaje de
   otra sesión no puede abrir chats), cada uno con su worktree `C:/dev/wt-<área>-<fecha>`.
4. **El estado de la cuenta anterior se VERIFICA con git, no se copia** (lectores Sonnet sobre la cronología + git).
5. **La ronda anti-trabas, cada hora** (Martín, 28/10: «Revisa que otras cosas quedaron trabadas, eso no puede pasar»).
   Un CronCreate en este chat (`17 * * * *`) y a mano al arrancar:
   - ListAgents: un chat «waiting on a human» o «pending» por más de 30 min, o uno local idle con trabajo, se destraba;
   - `git ls-remote origin 'refs/heads/nube/*' 'refs/tags/nube/*'` contra main: lo que no entró va al tren;
   - los tickets abiertos, cada uno con un chat dueño vivo.
   El 28/10 había cinco chats de la nube 13 horas sin entregar (esperaban aprobaciones que nadie vio), tres ramas
   `nube/*` sin integrar y el ticket #15 de Leila sin dueño. Un chat de la nube NO le avisa al Cerebro: se lo mira.

## Integración — los TRENES de claude3 (29/10 desde ~02:30 ART; lo arma el chat «Cerebro › Integración»)

Integración arma y chequea cada tren en `C:/dev/wt-push-q` y lo sube con `node C:/dev/revisiones/subir-tren.mjs <log>`
(`SUBIR_ARBOL` cambia el árbol; `SUBIR_UN_LUGAR=1` no espera el segundo lugar de tests). El Cerebro de claude3 es
`local_428051c1`. Esto vale por encima del estado de claude4 de más abajo.
- **AHORA (29/10 17:03): main = `ff908e645`, tren-ac. READY 17:07: hola-mako.com sirve `mako-8g8vtn7tv`
  (dpl_ioqDqJGw…).** Avisados el Cerebro (que le escribe a Leandro por el #29) y Zernio. Los demás dueños estaban
  archivados.
  - **Qué trae:**
    - El ticket #29 de Leandro (Automations `38c39d067` + `50b7ff798`): «Ya te sigo» vuelve a entregar el recurso, porque
      pregunta a Zernio con `refresh=true`.
    - Pagos `7f79a4e6c` y la tabla de planes `90a760e4b` (Web Generator).
    - Zernio con varias claves por negocio (`7b7d1ca2b`), más LinkedIn, X, Threads y Google Business. Pasó la revisión de
      privacidad.
  - **Rojos del chequeo, arreglados en el tren:** tres tests de otras áreas que leen `lib/zernio.ts` (`606f2dcef` y
    `27ba51334`). Cosechado en `docs/hallazgos-integraciones.md`.
  - **El grupo compartido 2/2 murió con la RAM en 0:** «0 tests» y 388 rojos. Re-corrido solo dio 3755 tests, con sólo los
    rojos conocidos (alta-cliente-conducta, que pasa sola, y el `todo` de chats-mako-envio).
  - **⏸ PAUSA «reunión de Martín», prendida a las 17:03 por pedido del Cerebro:** no arrancar el tren-ad ni ningún barrido
    hasta que el Cerebro la levante. Un proceso de Integración la refresca cada 20 min mientras diga eso, porque a los 90
    min se da por olvidada.
- **tren-ad (sin armar; espera la pausa):**
  - **Lleva:**
    - AI Avatar para todos los planes: `ai-avatar-todos-2910` en `4d66a5703`, que trae mergeada la landing hasta
      `abfe143ed`.
    - El Web Generator: `landing-high-ticket-2910` en `7511f5f14`, que suma sólo un comentario.
    - Zernio, «Publicar» desde el Video Editor, el Image Editor y el Copywriter: `zernio-token-2910` en `77cf7a90b` (merge de main `ff908e645`)
      (`C:/dev/wt-zernio-2510`). Va por el camino del Calendario y ningún editor importa Zernio. Toca archivos de los
      editores y del Copywriter. Queda pendiente el tsc del Image Editor, que lo avisa Zernio.
  - Toca los planes (`planes-mako`, `topes-plan`, `planes-comparacion`), así que antes de subir pasa por una revisión
    adversarial de plata.
  - NO subir `ai-avatar-abrir-pro-2910` ni `ai-avatar-para-todos-2910`.
- **Antes: el tren grande (tren-ab), main `1cf06eba9`, Ready 14:29.** 128 commits, con las 3 tandas de tipos en 0.
  - **Qué trae:**
    - Create entero: el shell, el Copywriter en Notion con la mudanza re-verificada, AI Avatar y el «Cómo conectarla».
    - MaKo en WhatsApp (`ac593ce1d`): las 6 fallas de Leandro, la ALTA 2 y los tickets al Cerebro (cartero 1.23.0).
    - Pagos por tramos (`805afb460` + `d9ad67553`): tickets #13 y #26.
    - CRM: el documento fiscal (`ba0c6c4b3`) y la difusión de Leila con la papelera y su cron.
    - La landing High Ticket (`213952a92`) y Zernio #28 (`59db6b0eb`: Meta en la pestaña de Zernio).
  - **Antes:** el hotfix #27 de Joan (`3648cedb8`, Ready 12:52) y tren-z (`9f8216dc8`, Ready 10:27).
  - **Al estar Ready:**
    - El Cerebro corre `node scripts/operaciones/cartero.mjs instalar` desde main, para el Runner 1.23.0.
    - Avisar a los dueños.
  - **Tablas APLICADAS el 29/10 (el Cerebro, con el sí de Martín):** 0340, 0342, 0343 y 0347 (la diferencia en pesos de
    Pagos). Esperan: 0344 (el Image Editor) y 0346 (MaKo sin conexión).
- **⚠️ BlockNote y Mantine no están en el node_modules COMÚN** (el junction de casi todos los worktrees de C:/dev, al clon
  principal). Desde ahora main los importa: hasta que el clon principal los tenga, un test o un tsc de un chat que toque el
  Copywriter va a fallar con «Cannot find module». `C:/dev/wt-push-q/node_modules` apunta hoy a
  `C:/dev/wt-copywriter-notion/node_modules`. Lo que falta, con la app tranquila y sin tests corriendo, es pasar el clon
  principal a origin/main y correr `npm install` (NO `npm ci`, que borra el node_modules de todos mientras instala).
- **Tren grande EN PRODUCCIÓN: `mako-obai8j5oz`, Ready 14:29.** Avisados el Cerebro y los dueños no archivados.
- **0348 APLICADA (29/10, el Cerebro con el sí de Martín):** el CHECK de `red` del Calendario acepta las 8 redes.
- **Zernio, varias claves (`7b7d1ca2b`):** Martín lo dio vuelta el 29/10 16:40 UTC (audio en el grupo de SuperAdmin). Subió
  en tren-ac. La revisión de privacidad está en `C:/dev/revisiones/2910-verificacion-zernio-varias-claves-7b7d1ca2b.md`.
- **Lo que quedó para el tren siguiente:**
  - ~~Pagos `7f79a4e6c`~~: re-verificado, entra en tren-ac.
  - `tren-aa` (`C:/dev/wt-push-aa`): quedó VIEJO, todo lo suyo subió en tren-ab. Se puede borrar el worktree.
  - `ai-avatar-abrir-pro-2910` (`4912250c6`): NO subir (abre AI Avatar a Pro; espera la prueba con un avatar real).
- **tren-y SUBIDO: main = `eab9c62e1` (29/10 05:46).** Trae los docs de claude4 y el P0 de Martín, la foto de Replicar
  (`22b4b75c4`, rama `web-generator-foto-2910`). Tests del tren verdes (la tanda de 43 re-corrida de a 6: 608/608), las
  guardas, la batería y las 3 tandas de tipos en 0. Al estar Ready: avisarles al Web Generator (`local_12107aea`) y al
  Cerebro, que se lo dice a Martín y cierra su ticket (ws9, /web-generator/68). **READY 05:50: hola-mako.com sirve
  `mako-mf08d4332` (dpl_46nkYU9H…); avisados el Cerebro y el Web Generator.**
  - Fuera de tren-y: `d413ad03b` del Web Generator (las copias idénticas en el editor). Es otra pieza y necesita su VERDE.
- **tren-z (rama `tren-z` de `C:/dev/wt-push-q`, sin subir): main `eab9c62e1` + Zernio + Planes `4b6acf1c0` (merge
  `4e9a099d9`) + Web Generator `c3c6849bc` (las copias idénticas en el editor, merge `d45a0665f`).** Choques sólo de docs;
  `docs/api-mako.md` regenerado. Los guiones del refutador de Planes sobre `4b6acf1c0` (salidas en
  `C:/dev/revisiones/scratch-4b6a/`): en todos los casos de SEPA, tarjeta y segundo voucher queda UNA cuota, y sub_A se cancela
  antes de armar B.
  - **Más Automations `f8a13def3`** (merge `ff8ec04b6`; lo de Leandro). La primera re-verificación de `0265924c6`
    (`C:/dev/revisiones/2910-reverificacion-automations-0265924c6.md`) halló una regresión: el primer DM de quien ya estaba en
    una automatización de comentario quedaba sin respuesta (`tomadas` contaba cualquier inscripción pausada). La arregló
    `b3d734055`, que pasa a `contestada`. Con el mismo arnés (`C:/dev/revisiones/scratch-f8a1/`), el primer DM se contesta, el
    doble sigue cerrado y «Volver a probar» sale entero.
  - **Rojos del chequeo, arreglados en el tren.** Tres tests del editor que fijaban el JSX sin la escala: los arregló el Web
    Generator (`9e73cfb2b`). Dos de Zernio los hizo Integración (`2f9f2ab98`), porque su chat estaba ARCHIVADO: los avisos de
    publicar con «Reportar a Soporte», y `keyDeSeguimiento` otra vez con la key PROPIA. `tests/zernio-sin-respaldo.test.ts` de
    la rama pedía `cfg(ws)` y `tests/condiciones-instagram.test.ts` pedía la propia: se contradecían. Ganó la decisión de
    Martín del 28/10 («NO a la cuenta de MaKo»), en `75a6ff630`.
  - **Chequeo final: 9351 tests de 961 archivos en verde**, con la referencia de la API al día.
- **Pagos por tramos `9fc4030dd`: NO entra.** Verificación adversarial en
  `C:/dev/revisiones/2910-verificacion-pagos-tramos-9fc4030dd.md` (guiones en `scratch-9fc4/`). Dos ALTAS de plata. A1: una
  cuota en pesos que se cobra a medias y se deja vacío «en dólares» queda pagada entera. A2: el anticipo quitado o devuelto
  vuelve al guardar sin tocar nada. Además tres medias y cinco bajas. No hay cruces de negocio. Devuelto al chat
  (`local_9b34bb88`).
- **WhatsApp `450677f90` (wa-fallas-2710): NO trae lo de Leandro.** Sus 6 fallas están en `152cfcd27`, sin VERDE, y la
  ALTA 2 de su verificación sigue abierta: `pideAlgoAMaKo` calla los pedidos reales mientras hay una pregunta del equipo
  viva, una REGRESIÓN contra producción. Se le preguntó al Cerebro si entra igual o espera a `152cfcd27`.
- **aut-2510 `0265924c6`: VERDE, sin re-verificar todavía.** El árbol es `C:/dev/verif-0265924c6` y los scripts del
  refutador de 69b49a31c, con la ruta cambiada, están en `C:/dev/revisiones/scratch-0265/`. Se corren de a uno por con-turno.
  Le faltan además las 710 barredoras.
- **Zernio + Planes: VERDE `4b6acf1c0`** (zernio-2510; el chat arregló las tres ALTAS de Planes). El diff lo leí yo y no
  encontré hueco nuevo; queda una baja: un admin que invita el email de otro cliente que pagó se saca los topes de la prueba.
  Siguen sin hacer la media del 429 de Resend (el aviso de vencimiento se repite) y las bajas del plan a mano. La 0341 ya
  está aplicada (28/10). La 0342 NO, y el código anda sin ella (publicar desde el Calendar avisa que falta). El árbol es
  `C:/dev/verif-4b6acf1c0`.
- **Zernio `8d48ef4c3` + `df3f9bebf`: sus arreglos PASAN** (re-corrí el refutador de la verificación sobre `df3f9bebf`, en
  `C:/dev/verif-df3f9bebf`; scripts y salida en `C:/dev/revisiones/scratch-df3f/`). Las dobles publicaciones de «Reintentar»
  (R1a-d, también con el replay `{existingPost}`), los 4xx (R2), el «Deshacer» (R5) y la carrera (R6) dejan UN post o frenan;
  la clave cambiada (R7) dice «Ya lo resolví en Zernio». R3b deja dos posts sólo si la persona aprieta «No quedó programada»
  sabiendo que quedó: ahora tiene el botón correcto. `resolverEnZernio` escribe con `getTenantDb` y con la condición.
- **⛔ Pero Zernio NO entra todavía:** lleva Planes hasta `d15b4ec1d`, con la MEDIA «un pago OXXO, Boleto o SEPA que falló no se
  puede reintentar» (regresión de d15b4ec1d, `C:/dev/revisiones/2810-verificacion-a196d5a93.md:193`) y MAU-10. El arreglo
  está en Planes `ddfa645d4`, que dio NO con TRES ALTAS (SEPA de suscripción que arma otra sin cancelar la primera, dos
  casos; el plan a mano `ya_tenia_cuenta` sin alta). No hay chat de Planes en claude3: se le propuso al Cerebro dárselas al
  chat Zernio (`local_4a831c28`). Los dos rojos de Zernio (puente-panel-copy y cobro-lanzamiento) los arreglan `a196d5a93` y
  `94633ec58`, de Planes: entran solos al mezclar Planes.
  **Decidido (Cerebro, 29/10):** el chat Zernio mezcla Planes `ddfa645d4` en zernio-2510 sobre `df3f9bebf` y arregla las
  tres ALTAS con los scripts del refutador; su VERDE llega a Integración y entra TODO junto (Zernio + Planes).
- **ORDEN de la fila (Cerebro, 29/10 ~03:05, por un cliente roto: MaKo le contesta mal a Leandro en su grupo):** 1) el P0 de
  Replicar (tren-y); 2) `wa-fallas-2710` (`C:/dev/wt-conex-2510`), con el VERDE del chat «MaKo en WhatsApp: lo que le contestó mal a
  Leandro» (`local_cf058ed5`); 3) `aut-2510` SOLO (el filtro por palabra clave, la respuesta pública y «Volver a probar»): al
  estar Ready, el Cerebro le escribe a Leandro; 4) `crm-difusion-2910` y Zernio + Planes. Cada uno Ready → avisar al Cerebro.
- **La difusión de Leila llega como UNA rama, `crm-difusion-2910`** (crm-lote-2810 + aut-2510 + el enganche del «⋯» de la
  columna): se toma esa y no las dos sueltas. La 0340 ya está en la base.
- **⚠️ Choque de número 0340:** `motion-imagen-2610` (Video/Image Editor) trae otra `0340_image_editor_propuestas.sql`. Al
  entrar esa rama, la que se RENUMERA al siguiente libre es la del Image Editor: la del CRM es la que está en la base.
- **Cómo se sube (cambió el 29/10, 04:20):** la pausa NO se prende para el push (con con-turno traba el lock de tipos:
  docs/hallazgos-infra.md, «La pausa TRABA el push»). Se espera la fila de tipos vacía y RAM ≥ 5,2 GB (si falta, se cierra
  Chrome con `taskkill` sin /F) y `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=4608 MAKO_TIPOS_RAM_MIN_GB=4.8 git push origin
  HEAD:main` en segundo plano. Lo hace solo el guion del scratchpad de Integración `subir-cuando-libre.ps1` (copia en
  `C:/dev/revisiones/subir-cuando-libre.ps1`). La
  rama `integracion` NO avanza main (sin Actions): el push de docs de claude4 a las 01:40 quedó ahí (`5d36f97d5`).

## Estado al escribir — RELEVO FINAL de claude4 (29/10 ~00:55 ART, semana al 95 %; la cuenta arrancó el 27/10 20:33)

**Si Martín te escribe «Continua»:** la regla del 97% (28/10) deja a cada chat con su relevo commiteado y anota dónde en
`~/.claude/relevos-cuenta/claude4.tsv` (carpeta, rama, transcript). Leé eso, este estado y el relevo de cada chat.

- **`main` = `7f36fa9c6` (28/10 23:57), EN PRODUCCIÓN y verificado.** Desde que arrancó la cuenta subieron:
  - tren-w (`c17134274`): las horas del CRM, las cajas de chat, la pausa del Cerebro, el corte del 97 %;
  - el editor, con los subtítulos de Leandro (`004a4ae57`, ticket cerrado y avisado);
  - el Web Generator en blanco (`7f63046be`);
  - MaKo inteligente: el Second Brain en el turno, sin la plata para los closers (`7f36fa9c6`).
- **La rama `tren-x` de `C:/dev/wt-push-q` = main + sólo docs** (este relevo y hallazgos). **NO entraron a main:** el
  pre-push no tuvo RAM para los tipos (3,0 GB con el workflow corriendo; «no es un error de tipos»). Copia en origin, en la
  rama `relevo-cerebro-claude4`. Entran con el próximo tren: no hace falta otro push sólo para esto.
- **TERMINÓ al cortar: `wf_2f472ad6-193`, la verificación de Zernio `254856316` y Planes `ddfa645d4`. Los DOS: NO.**
  Informe entero, con los scripts que reproducen cada caso: `C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md`.
  **SIN MANDAR a sus chats** (la cuenta cortó al 95 %): mandárselo es lo primero del punto 2.
  - **Zernio:** la privacidad quedó arreglada (ninguna puerta a otro negocio) y el orgánico y los tests, bien. Sobrevive
    una MEDIA: «Reintentar» repite el x-request-id fuera de la ventana de ~5 min y deja DOS posts públicos (los 4 min
    se cuentan desde la última anotación, no desde el primer envío; `lib/calendario-publicar.ts`). Y tres bajas: un 4xx
    en el reintento borra la duda, dos estados sin salida y la carrera G al revés. El refutador tiró la de «Deshacer».
  - **Planes:** `be95f7555` sí cierra el voucher doble. Sobreviven TRES ALTAS: una suscripción con SEPA arma una
    segunda y nunca cancela la primera (dos veces); y el plan a mano, si el negocio paga por /planes con el email de su
    cuenta, queda `ya_tenia_cuenta` sin `alta_ws`. Además dos medias (el aviso de vencimiento le llega a quien ya paga, y
    se repite si el mail a Martín da 429) y dos bajas. La venta externa de Stripe (MAU-10) viene en esta rama: no entra
    hasta que Planes pase.
  - Árboles: `C:/dev/verif-254856316` y `C:/dev/verif-ddfa645d4`; los scripts del informe corren ahí. Sacar el junction
    de node_modules con `cmd /c rmdir` antes de borrarlos. Journal: `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/wf_2f472ad6-193/journal.jsonl`.
- **LO QUE SIGUE, en este orden:**
  1. **P0, el ticket de Martín: «Replicar» no saca la foto de la página.** SIN EMPEZAR (el chat cortó al 95 %). Todo está
     en la sección 0 de `docs/relevo/web-generator-replicar.md`, en `C:/dev/wt-replica-editable` (rama
     `replica-editable-2810`, `f59354ec3`, sin subir). Va ANTES que la réplica editable (`a72620aa3`, a medias).
     **La página que probó Martín es https://100ads.ai/** (lo dijo después, 29/10 ~00:55): reproducir con esa.
  1b. **Pedido nuevo de Martín (29/10, textual):** «Los tickets de bugs asi, siempre deben traer las acciones que hizo el
     usuario». Su ticket guardó pantalla, error y hora, pero no la URL que pegó. «Reportar a Soporte» (y el ticket que
     MaKo abre solo) tiene que llevar los pasos: qué tocó, qué escribió o pegó, en qué orden. Dueño: el chat de soporte
     y tickets (MaKo en WhatsApp). Regla en la memoria `ticketera-usuarios`.
  2. **Zernio y Planes: mandarle a cada chat su parte del informe de `wf_2f472ad6-193`** (los dos NO, arriba), y
     verificar lo que devuelvan. Planes trae la venta externa de Stripe (`5a27268bc`). Desplegada esa, escribirle a Mauricio en su grupo (el +…8122 ES él) para que conecte su Stripe. Prender
     `cobros.ventas_externas` en ws1 pide el sí de Martín EN EL CHAT.
  3. **La tienda de Chrome: la 0.74.3 está EN REVISIÓN** (29/10 ~01:35, subida por el Cerebro con un Chrome aparte por
     CDP; ver docs/hallazgos-extension.md). Cuando Google apruebe: `node scripts/version-en-tienda.mjs` y mezclar
     `tienda-cws-2710`. Volver a crear la credencial de la API para que la próxima sea un comando. Ver
     docs/hallazgos-extension.md («La subida por API murió sin avisar»).
  4. **La fila de verificación** (más abajo): CRM `cc47d841d`, Copywriter `7eef753da`, WhatsApp, Automations, el plan a
     mano de Planes y las tres ramas `nube/*`.
  5. **Los pedidos nuevos** (más abajo): pagos por tramos, Classroom, Zernio con varias claves. Y los 70 perdidos de
     `docs/relevo/pedidos-perdidos-2810.md`.
- **Cómo se sube un tren:** `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=4608 MAKO_TIPOS_RAM_MIN_GB=4.8 git push origin
  HEAD:main`, en segundo plano y con `node scripts/pausa-cerebro.mjs prender|apagar`. **El deploy se confirma** con `npx
  vercel ls --scope mbustos-4239s-projects -m githubCommitSha=<sha ENTERO>` y `vercel inspect hola-mako.com`.
- **⭐ PEDIDO NUEVO DE MARTÍN, el más importante para la próxima cuenta (29/10, ~00:45, en el chat del Cerebro), textual:**
  «Y no me gusta que Leila te tenga que estar respondiendo esas cosas de plan de pagos por ahí, eso refleja lo mal
  construido que esta la tab de pagos... No tiene libertad o diversidad de tipos de cobros».
  - **Hoy:** el «plan libre» del 27/10 (`fechasDelPlan`, `lib/pagos-campo.ts`; `app/crm/lead-view/ficha/pagos/bloques-cobro.tsx`)
    hace quincena, semana, más de 6 cuotas y días del 29 al 31, pero con TODAS las cuotas del mismo monto. «6 meses de
    12.000 y luego 10.000» (Nadia, de Leila) no entra.
  - **Lo pedido:** el plan por TRAMOS (monto, frecuencia, cantidad o fin y moneda por tramo), el anticipo y las cuotas
    editables una por una. Lo arma el CLIENTE solo en la ficha del lead. Se COPIA de una app que ya lo resolvió: las fases
    de los «subscription schedules» de Stripe, o los planes de pago de ThriveCart o Kajabi. Regla en la memoria
    `pagos-libertad-de-tipos`.
  - **Dueño sugerido:** CRM y Chats (la ficha y los pagos), o un chat «Pagos» nuevo. El de Nadia NO se carga a mano: con
    la herramienta nueva lo arma Leila. Hasta entonces, su respuesta a la pregunta del 29/10 queda en el buffer.
- **Martín, 28/10: «todas mis cuentas son x20».** claude5 se suma a `CUENTAS_DEL_CREDITO` en la tanda A de WhatsApp (ya
  avisado).
- **⭐ PEDIDO NUEVO DE MARTÍN, para la próxima cuenta (29/10, ~00:10, escrito en el chat del Cerebro), textual:** «En
  "Classroom" unifica la tab de clients con members, es literal los botones de kanban o lista que tenemos en el crm».
  - **Hoy:** `/classroom` tiene las sub-tabs Clients · Community · Classroom · Calendar · Members · Leaderboards · About
    (`app/classroom/ClientsShell.tsx`, `lib/clients-rutas.ts` → `seccionesDe`).
  - **Lo pedido:** UNA sola sub-tab con el selector Kanban / Lista del CRM. Kanban es el tablero de clientes por etapa de
    entrega; Lista, los miembros. Se copia el control del CRM tal cual. La ruta vieja de la que se va se redirige con su
    query (AGENTS.md → «Retirar una RUTA…»).
  - **Dueño sugerido:** un chat «Classroom» nuevo, o CRM y Chats, que tiene el selector Kanban / Lista. No se arrancó: la
    cuenta estaba al 92%.
- **⭐ LOS PEDIDOS PERDIDOS (terminó a las 22:30): `docs/relevo/pedidos-perdidos-2810.md`.** Son 362 pedidos desde el
  22/10; 70 PERDIDOS y 21 esperan a Martín. Arriba de todo, «Lo urgente», y abajo las fuentes que nadie leyó. Se
  repartió a los chats con dueño vivo lo urgente de cliente (ver ese documento); lo demás queda en su lista, con el
  dueño sugerido.
  - 22:40, repartido:
    - **Zernio:** el aviso del corte de Meta del 03/11 (arma el texto y lo manda el Cerebro) y las campañas de Joan.
    - **MaKo en WhatsApp**, después de la tanda A: Mauricio sin mensajes desde el 04/10, los dos pedidos de Joan, el
      dominio inventado, el Fathom de Leila y los tres audios de Leandro.
    - **CRM**, después de las horas: Fabi Pedraza y las cifras de Joan.
  - **SIN repartir**, porque el tope de mensajes por turno de Martín dejaba a la reserva: los «perdidos» de Automations,
    Web Generator, Editor, Copywriter, Planes y MaKo inteligente. Están en el documento, cada uno con su dueño
    sugerido.
  - **29/10 ~00:50 ART, P0: Martín no pudo replicar una landing** («No pude sacar la foto de la página», su ticket desde
    /web-generator/68, ws9, 00:38). Lo encontré en el código y lo pasé al chat Web Generator, ANTES que la réplica editable.
    Replicar.tsx:215 recibe ok sin `foto`. En lector-script.ts hay dos caminos mudos: el tope de `arrancar()` (TOPE+500, 40 s
    con foto) que dispara `terminar(true)` antes de la instantánea, y el `catch` que deja `foto = null` y pierde el motivo.
    Hecho = foto aunque llegue el tope y el motivo en pantalla. El ticket no trae la URL: la busca el chat. Al desplegar:
    cerrar el ticket con el aviso a Martín.
  - **29/10 ~00:40 ART (03:40 UTC), ronda y tres respuestas de Martín** (cierres mandados; semana al 94 %):
    - **P2P:** el aviso del corte de Meta se lo manda Martín por su WhatsApp. El texto le quedó en el cierre. Regla en
      la memoria `contestar-clientes-sin-preguntar`.
    - **El 8122 ES Mauricio.** NO se le escribió todavía: la venta externa de Stripe (`5a27268bc`, MAU-10) no está en
      main, va con Planes (verificación `wf_2f472ad6-193`, viva a las 00:36). Cuando esté desplegada: pedirle en su grupo
      que conecte su Stripe y que su link del Sprint vuelva a la página de gracias; prender `cobros.ventas_externas` en
      ws1 pide el sí de Martín EN EL CHAT.
    - **La tienda de Chrome:** sigue en 0.39.1. La API murió (`deleted_client`) y el panel pide la contraseña de
      martinkoncke@gmail.com (la cuenta dueña; `authuser=1` en el perfil de Claude). La pestaña quedó en «Verify it's
      you». Martín no entendió la primera pregunta: se le explicó en el cierre. Cuando diga «listo»: subir el zip de
      feedback/chrome-web-store/, la descripción, las 5 capturas y el mosaico, y mandar a revisión.
    - **Ronda:** los tickets abiertos tienen dueño vivo (Leila en bloque → CRM `cc47d841d`; Leandro, el filtro de
      comentarios → Automations; el video de Leila → Video Editor; Nadia → pagos por tramos) y ninguno está resuelto
      en producción. Las tres ramas `nube/*` siguen fuera de main, en la fila. Los cinco chats de la nube «waiting»
      ya no tienen trabajo: los archiva Martín desde la barra.
  - **23:30, las respuestas de Martín** (desde el Centro; los cierres ya se mandaron):
    - **Decisiones que valen así:**
      - Zernio: NO a la cuenta de MaKo, cada negocio con la suya.
      - No se borran los datos de las visitas de Código Inmobiliario ni de P2P.
      - Stripe de Mauricio: «Pídeselo a Mauricio». Espera la respuesta sobre el 8122.
      - Los chats de la nube se archivan si no les queda nada: no aparecen en mi lista, así que los archiva él.
    - **Esperan su sí ESCRITO EN EL CHAT** (el Centro no alcanza para la base de producción):
      - la tabla nueva de MaKo sin conexión (0346) y la de publicar desde el Calendar (0342), cada una cuando su revisión
        salga limpia;
      - los dos cambios del Sprint de Mauricio;
      - la espera y el recordatorio de Brigitte.
      - Se le pidió con un renglón para copiar.
    - Martín no entendía «aplicar la migración»: regla en la memoria `migracion-en-palabras`.
    - **Avisos del corte de Meta ENVIADOS a Pablo, Sergio y Patricia.** Sin «no tienes anuncios activos», que no se pudo
      comprobar. Sólo falta P2P, que espera a Martín.
    - **Joan: le contesté sus dos pedidos** (las 9 llamadas sin marcar con nombre y las cifras corregidas, más los 10
      links de Meet de la semana pasada; 3EB0C29D3599EBBA993B12).
  - **01:40, verificaciones:**
    - **Automations `69b49a31c`: NO.** La ALTA (un DM de Instagram recibía DOS respuestas del AI Step) quedó ARREGLADA en `5e67180c7` (aut-2510; probado rompiéndolo, sin barrido nuevo). Las medias y bajas siguen, en docs/relevo/automations.md (`f8e74a9f5`), para la próxima cuenta, y sin ellas no entra. Siete medias:
      «Volver a probar» reusa las Idempotency-Key, la mudanza rechaza «social_tope», la difusión sale dos veces sin
      idempotencia, el goteo de Instagram pasa la ventana de 24 h, HojaDifusion no está montada, y un setter puede
      difundir por el grupo. Más bajas. Informe en `C:/dev/revisiones/2910-verificacion-automations-69b49a31c.md`, ya
      mandado al chat.
    - **Zernio `254856316` + Planes `ddfa645d4`: corriendo**, en `wf_2f472ad6-193` (task `w1bp45jj0`). Los árboles son
      `C:/dev/verif-254856316` y `C:/dev/verif-ddfa645d4`. Su journal está en
      `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/wf_2f472ad6-193/journal.jsonl`.
    - Queda en fila: el CRM `cc47d841d`, Copywriter `7eef753da`, las tres ramas de la nube y WhatsApp (cuando lleguen
      sus arreglos).
  - **01:25 — EN PRODUCCIÓN (verificado):** el Web Generator en blanco (`7f63046be`; deploy de `ed8c965d1` Ready a las
    23:58). Martín tiene que probarlo entrando por el menú. **MaKo inteligente** (`7f36fa9c6`, merge de `935e3c574`),
    subido a las 00:00, EN PRODUCCIÓN (deploy mako-nmbwa0pgu Ready, lo sirve el dominio). **main = `7f36fa9c6`.** La rama del próximo tren sale de ahí.
  - **01:10, el Web Generator en blanco (el P0 de Martín):** `11a0e8211` ACEPTADO (el Cerebro revisó que los controles de
    acceso corren antes del corte en los cuatro layouts) y mergeado en tren-x (`7f63046be`). Push en curso (task
    `bum9dxj9y`, log `push-blanco.log`). Cuando esté Ready, avisarle a Martín que lo pruebe entrando por el menú.
  - **01:12: VERDE de MaKo inteligente `dfbd0e922`** (b2c19c445 + cfab5c33a + dfbd0e922, mako-inteligente-2710-c4). La
    ALTA (el objetivo de facturación a un closer) se arregló con `VE_SIN_PLATA` en positivo. **Para verificarlo:** volver a
    correr `C:/dev/revisiones/scratch-b2c1/mi-refuta/r1-objetivo.ts` apuntado a `C:/dev/wt-mako-inteligente-c4`, y leer
    `sinLaPlata`.
  - **01:00: VERDE del CRM `cc47d841d`** (crm-lote-2810, sobre `23b329b5e`): las acciones en bloque del tablero, los
    tickets de Leila (eliminar → PAPELERA de 30 días, pasar a otro funnel, descalificar o perder en bloque, la columna
    entera sin el corte de 1.000) y 5 operaciones de la API.
    - **La tabla 0340 (`leads_papelera` y 5 funciones) YA ESTÁ APLICADA (29/10, el Cerebro de claude3 con el sí de Martín en
      su chat, desde crm-lote-2810 @ 77679ed63: leads sigue en 3017, RLS prendido, sólo service_role ejecuta las 5).** El cron
      nuevo (`app/api/cron/leads-papelera`, `45 10 * * *`) entra con su código en vercel.json.
    - Sin verificar. Como borra y recupera datos, se mira primero que no se pierda nada.
  - **FILA DE VERIFICACIÓN al 01:00** (Automations `69b49a31c` corriendo en `wf_a92bf13a-ec9`):
    1. Zernio `854a6fda0` + Planes `ddfa645d4`, juntos;
    2. CRM `cc47d841d`;
    3. Copywriter `7eef753da`;
    4. WhatsApp: c358 + tanda A, cuando lleguen los arreglos que faltan;
    5. MaKo inteligente, cuando lleguen sus arreglos;
    6. las tres ramas de la nube.
  - **Los sí de Martín EN EL CHAT que destraban cosas** (la base de producción): la tabla de MaKo sin conexión (0346),
    la de publicar desde el Calendar (0342), ~~la papelera del CRM (0340)~~ (APLICADA el 29/10), los dos cambios del Sprint de
    Mauricio y lo de Brigitte. Cada uno se aplica cuando su verificación sale limpia.
  - **00:55, los límites de Zernio (pedido de Martín): DISEÑADOS, sin código** (`35df0c483`, docs/relevo/zernio-capi.md).
    La «salida gratis» (conectar otra cuenta de Zernio) NO se puede decir hoy: un negocio tiene UNA clave, y pegar otra
    reemplaza la anterior y pierde las redes de la vieja. Va después de las varias claves (punto 3), y antes se revisan
    los términos de Zernio. Para el punto 1 queda el texto propuesto, sin Analytics hasta volver a medirlo. Del punto 4
    (el aviso antes de los 10.000 mensajes), falta medir de dónde sale el conteo de mensajes enviados del mes.
  - **00:50: VERDE de Zernio `854a6fda0`** (zernio-2510; encima, `254856316`: la salida gratis que existe HOY en el aviso de la 3.ª red, «desconecta en zernio.com una que ya no uses»), con los arreglos de su verificación: la cuenta validada contra
    las del negocio, las publicaciones «dudosas» en vez de «fallo», la huella de la clave, las escrituras condicionadas, la
    REST en verde y el orgánico en la zona del negocio. ⚠️ **Lleva adentro diez commits de planes-2710** (hasta
    `d15b4ec1d`, merge `042e10323`), así que **Zernio y Planes (`ddfa645d4`) se verifican y entran JUNTOS**. El rojo
    de «Mirá» en `lib/cobros-webhook.ts` lo corrige `a196d5a93`, de Planes. Además, la tabla nueva 0342 (con
    `publicacion_intento`, `publicacion_clave` y el estado «dudosa») espera el sí de Martín en el chat.
  - **00:40, WhatsApp:**
    - **La tanda A tiene su VERDE (`9b5fc9ad4`, wa-credito-grupos-2810).** Trae el crédito de Claude de los grupos para N
      cuentas (una lista única: `CUENTAS_DEL_CREDITO`) y la corrección del dominio inventado (`conElDominioDeMaKo`). Lleva
      adentro c358fd0c4, así que entra JUNTO con sus arreglos, y se verifica todo junto.
    - De c358 ya están arreglados: el aviso de arreglo (`c6d63791a`), el acuse después de la cita (`78543b7dd`) y la lectura
      estricta (`450677f90`). Faltan la ALTA de `pideAlgoAMaKo`, la MEDIA del cierre de la ventana y la BAJA de la firma.
    - **Decidido por el Cerebro:** el banco de nivel 2 con modelo (gasta crédito) queda para la próxima cuenta, chico.
    - claude5 ya está en `CUENTAS_DEL_CREDITO` (`646eae966`; Martín: «todas mis cuentas son x20»). **Al desplegarse, Martín pega `ANTHROPIC_CREDITO_CUENTA5` en SuperAdmin › Uso › API** (se puede vincular desde el 31/10). La ALTA de `pideAlgoAMaKo` queda para la próxima cuenta (es diseño).
  - **00:35, ronda: el plan de Nadia de Leila.** Leila YA había contestado en su grupo el 28/10 a las 18:11 UTC (buffer
    324): «Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000». Le llegó a MaKo, no al equipo: la falla
    que arregla WhatsApp. Se le pidió confirmar si los 12.000 son por mes (6.000 por quincena, días 1 y 15) y hasta cuándo
    sigue el de 10.000 (3EB015B3DB5E089D9A764E). **Su respuesta se lee en `mako_doer_buffer` del ws11**, porque también le
    va a llegar a MaKo. Después, CRM y Chats carga el plan, con el sí de Martín en el chat (escritura en producción, ws11).
  - **00:30 (29/10): tren-w EN PRODUCCIÓN.** Lo subí yo (`c17134274`); alguien más subió encima tres commits de docs
    del relevo, hasta `b59d14943`, que es el deploy que sirve el dominio (Ready a las 23:19). **tren-x** (el editor,
    ticket 23: `004a4ae57`) **subido**, en PRODUCCIÓN (Ready a las 23:33). **Ticket de Leandro (subtítulos) CERRADO** y aviso mandado
    a su grupo (3EB0050E870B3AA0C5E540).
    - **La verificación de Automations `69b49a31c` está corriendo:** `wf_a92bf13a-ec9` (task `w48pws0wo`), con tres
      verificadores (Instagram de Leandro, topes y avisos, difusión) y el árbol `C:/dev/verif-69b49a31c`.
    - **Fila de verificación detrás:** Copywriter `7eef753da` (la puerta pública que escribe, primero) y Planes
      `ddfa645d4` (el plan a mano). Después, los arreglos de WhatsApp y de MaKo inteligente cuando lleguen.
  - **00:05 (29/10), el push de tren-w está EN CURSO** (task `bca7muwun`, log en el scratchpad: `push-tren-w.log`), con
    la pausa prendida. Sube: las cajas de chat, las horas del CRM (`f13f8bbad`, verificado por el Cerebro con el script del
    refutador y mergeado en `c17134274`), el corte del 97%, la pausa, tsc-acotado con lock y `cambiarSettingSi`.
    - **Para el tren siguiente:** el editor, ticket 23 (`d867f8bbc`, editor-leila-2810): leí el diff y está aceptado.
      Falta mergearlo y correr tests/video-editor-chat sobre el árbol mezclado. Al desplegarse, se cierra el ticket de
      Leandro con su aviso.
    - **Planes:** el cobro doble está arreglado en `be95f7555` (verificado con el script del refutador: una cuota y
      ya_pagado). Pero la rama trae el plan a mano con vencimiento (`55542d446`) SIN verificar: necesita su workflow, y
      queda para cuando haya RAM o para la próxima cuenta.
    - **Motion:** no arranca (cuenta al 91%). Los dos rojos del typecheck C/D están en el relevo del editor. La trampa del
      CRLF está cosechada (`76e261c3e`). El chat del editor cerró por hoy.
    - **VERDEs SIN verificar, en este orden** (cada uno necesita su workflow de verificador y refutador):
      1. Automations `69b49a31c` (aut-2510);
      2. Copywriter `7eef753da` (copywriter-2810, 11 commits y 75 .ts). Trae una puerta PÚBLICA que escribe
         (`/api/compartido/guion` en PUBLICOS_ESCRITURA), así que la seguridad va primero;
      3. el plan a mano de Planes `55542d446` (con `be95f7555`, ya comprobado).
      Después, los arreglos de WhatsApp y de MaKo inteligente cuando lleguen, y las tres ramas de la nube.
  - **23:45, Zernio:**
    - **Pedido de Martín:** advertir los límites en la conexión, y varias claves de Zernio por negocio, como en Gemini,
      para conectar más redes sin pagar. Va con el aviso antes de la 3.ª red. Pasado al chat Zernio: los límites y el
      aviso ahora; las varias claves, diseñadas para la próxima cuenta.
    - **Límites, de zernio.com/pricing (leído a las 23:40):** 2 cuentas gratis (página, Instagram y anuncios cuentan una
      cada una); de la 3.ª a la 10.ª, US$6 por mes; 10.000 mensajes ENVIADOS gratis por mes, y sin tarjeta los envíos se
      frenan hasta el mes siguiente (con tarjeta, US$1 cada 10.000); comentarios gratis, sin contar como mensaje; 500
      anuncios gestionados gratis; Analytics «incluido» según la página, aunque medimos un 402. Los términos de Zernio dan
      404: no se sabe si permiten varias cuentas gratis.
    - **Leandro: le contesté su audio de los límites** (3EB0FEEE89B0FEC6BCD81E): «el aviso antes del tope lo estamos
      armando». Lo arma Zernio con Automations.
    - **Planes `e6fd6d88d`: NO.** Alta: un segundo voucher (OXXO o SEPA) deja armar otra sesión y se cobra dos veces.
      Informe en `C:/dev/revisiones/2810-verificacion-planes-e6fd6d88d.md`, ya mandado.
  - **23:30, verificaciones:**
    - **WhatsApp `c358fd0c4`: NO.** Dos altas: `pideAlgoAMaKo` calla los pedidos reales, y el aviso de arreglo de un
      ticket abre la ventana para todos. Dos medias: el «dale» como acuse y la ventana que se cierra con el primer
      mensaje. Informe en `C:/dev/revisiones/2810-verificacion-wa-c358fd0c4.md`, ya mandado.
    - **MaKo inteligente `b2c19c445`: NO.** Alta: un closer recibe el objetivo de facturación por el nodo `objetivo`.
      Informe en `…-mi-b2c19c445.md`, ya mandado; arregla encima de `cfab5c33a`.
    - **VERDE de Automations `69b49a31c`** (aut-2510, todo desde 7f7e404d9): SIN verificar todavía (RAM y cuota). Después
      del deploy, con el «dale» del Cerebro: la config del 680, «Volver a probar» en los leads 5425 y 5426, y la fila del
      ws 9 de social_tope.
    - Planes `e6fd6d88d`: verificación en curso (`wf_4ecaf858-5ac`).
  - **Audios de Leandro, transcriptos:** el 316 y el 318 son la respuesta pública a comentarios (ya en el VERDE de
    Automations). El 327 es NUEVO: los límites de Instagram y Zernio, y que MaKo le avise antes de quedarse sin, «lo que
    menos me gustaría… que se pare la automatización… y que Maco no me avise nada». **SIN REPARTIR:** es de Automations
    (tiene el tope) y de Zernio.
  - **22:55, Mauricio sin mensajes:** WhatsApp midió que la entrada NO está rota. En su grupo no escribe nadie desde el
    08/10, y MaKo le manda ~15 mensajes por día. Los tres participantes son el personal de Martín, MaKo y un +…8122 (la
    línea `mako_ws1`). Le pregunté a Martín si el 8122 es Mauricio: si no lo es, Mauricio no recibe nada. Cosecha en
    `0d61fcbe2` (wa-credito-grupos-2810). La tanda A está en `bea18e257`, esperando su barrido.
  - **22:50, el corte de Meta del 03/11:**
    - Zernio armó los cinco avisos, que están en `C:/dev/revisiones/2810-avisos-token-0311.md`.
    - **Joan: ENVIADO** a su grupo (3EB08A864B795B4A50C001).
    - **Pablo (ws18), Sergio (ws20) y Patricia (ws22) esperan** la respuesta de Martín a «¿prendo la cuenta de Zernio de
      MaKo?»: si la prende, no se les pide una clave propia.
    - A Sergio hay que sacarle «no tienes anuncios activos» o medirlo.
    - **P2P (ws14) no tiene grupo:** le pregunté a Martín por dónde le llega.
    - Florencia (ws21) nunca conectó Meta: por eso Joan no ve sus campañas.
  - **Tres aprobaciones más a Martín** (`cartero preguntar`): los dos cambios del Sprint de Mauricio, la espera y el
    recordatorio de Brigitte, y borrar nombre y email en ~670 visitas de Código Inmobiliario y P2P.
- **Dos workflows corrían al escribir esto.** Otra cuenta no los reanuda, pero puede leer lo que devolvieron en
  `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/<runId>/journal.jsonl`:
  - `wf_fbaed0b3-099`, **los pedidos perdidos.** Martín: «Revisa todos los pedidos de absolutamente todos lados, a ver si
    no se perdieron otras cosas», y «No frenes la investigación... me sirve para la próxima cuenta». Lo que devuelva se
    reparte a los chats y se le reporta a él.
  - `wf_750ef430-595`, **la verificación de Zernio y de las horas del CRM: TERMINÓ, las dos con defectos.** No entran al
    tren. Informes: `C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md` y `…-crm-horas-b799f7ed4.md`.
    - Zernio: programaba en el Instagram de OTRO negocio, entre otros. Ya se los mandé.
    - CRM (`crm-horas-2810`, chat CRM y Chats): ALTA. En el chat de la app, `listar_horarios_reunion` convierte el `startIso` y
      `proponer_agendar_reunion` no lo encuentra: la reserva falla siempre. Más dos bajas: claves `_utc` con hora local, y
      el «inicio» de un evento de comunidad al lado de otra zona. **SIN MANDAR al chat** (tope de 10 mensajes): va en cuanto
      Martín escriba.
- **VERDEs que faltan verificar** (cada uno con verificador + refutador; informes en `C:/dev/revisiones/`):
  - **MaKo en WhatsApp, urgente.** Cuatro altas:
    - un «?» dentro de un link cuenta como pregunta;
    - la ventana de 6 h silencia todo;
    - no lee el mensaje citado que viene en `contextInfo`;
    - ante un audio citado que falta, pide «conectá tu OpenAI».
  - **Replicar landings: P0, el Web Generator en blanco** (cuenta de super admin, desde cualquier dispositivo). Después,
    que la réplica sea editable entera. Las cinco copias de prueba (#68–#72, ws9) van a la papelera cuando cierre el P0.
  - **MaKo sin conexión.** T1 arreglada: `desktop-offline-2810` = `6ef621b24` + `813101f75`. T2:
    `desktop-offline-t2-2810` = `3e6a0dddf` + `746633c96`. La migración 0346 necesita el sí de Martín.
  - **Planes, medias:**
    - el reintento de OXXO;
    - el trial del día 8 que falla y queda detrás del tope de 50.
  - **Automations:**
    - ALTA `ef1c248b4`;
    - ticket 19 `e90bae7d1`;
    - topes `c6f78deb4` y `0c121ab4b`;
    - la difusión desde el CRM que pidió Leila;
    - las medias.
  - **Copywriter**, y **MaKo inteligente** `809887ac9`.
  - **Tres ramas de la nube:** clic derecho `419d11e90`, media buyer `54e13e9cc`, video generator `9012f6070`.
  - **Editor, ticket 23 (subtítulos de Leandro).** El OK al arreglo está dado: `generarSubtitulos` devuelve
    `{ok|motivo}` y el chat dice la causa real. Desplegado eso, se cierra el ticket con el aviso a Leandro.
  - **CRM: acciones en lote y papelera** (tickets 21 y 22 de Leila). Necesita una migración; el SQL va a Martín.
- **Después de subir tren-w:**
  - el aviso a Leila (la confirmación del plan de Nadia, que está retenida);
  - el aviso a Leandro (las keywords);
  - la config del 680, aplicada con el «dale» de Automations;
  - la prueba de Instagram en Fiesta Music, coordinada con Leandro después del deploy de Zernio;
  - la migración 0342, con el sí de Martín.
- **Hecho hoy en producción, fuera del tren:**
  - contestado el audio citado de Leandro;
  - corregido el lead «ganado» que tenía la tarjeta en Perdido (la verdad era Perdido);
  - 13 réplicas malas, a la papelera;
  - Leila avisada de que puede usar el editor en vez de CapCut.
- **La app se cayó a las 18:34 con todos los chats adentro:** tres tsc a la vez. Desde entonces lo pesado de los chats
  pasa por `node C:/dev/con-turno.mjs …`, con dos filas: tipos y tests, una a la vez cada una. Sin turno en 30 min, no
  corre (sale con 99).
- **Chats vivos (claude4, bypass)**, cada uno con su relevo en su carpeta:

  | Chat | Sesión |
  |---|---|
  | Web Generator: replicar landings | `local_1dd40ee7` |
  | MaKo en WhatsApp | `local_216acd59` |
  | MaKo inteligente | `local_4f7b9970` |
  | Planes, pagos y Partners | `local_46497093` |
  | CRM y Chats | `local_61bd6f00` |
  | Zernio | `local_b48d54c4` |
  | Video Editor de Leila | `local_c698e704` |
  | Copywriter | `local_ce7663bd` |
  | Automations | `local_ea2a6e6a` |

- **Cuota a las 20:42 ART:** 5 h al 87% (se renueva 21:30 ART), semanal al 80% (se renueva el 3/11 17:00 ART).
- **21:15 ART: el corte del 97% saltó en el Cerebro (ventana de 5 h), el primero real después de prenderlo.** Negó un
  Bash y anotó la sesión en `~/.claude/relevos-cuenta/claude4.tsv`: anda. Lo que quedó a medias en ese momento:
  - **21:33, HECHO: la fila de tests de `C:/dev/con-turno.mjs` tiene DOS lugares** (`mako-tests.lock` y
    `mako-tests-2.lock`) y espera hasta 90 min; la de tipos sigue de a uno con 30 min. Era cola, no un cuelgue: siete
    chats para un lugar, y el que esperaba 30 min salía con 99. Probado con tres trabajos (dos a la vez, el tercero espera)
    y dos de tipos (de a uno). Respaldo: `C:/dev/con-turno.mjs.antes-2-lugares`.
  - **21:35, después de la renovación:** los nueve chats recibieron «seguí desde tu relevo» con lo suyo. El CRM recibió
    los defectos de las horas y Automations la explicación de la cola.
  - **21:45: VERDEs de WhatsApp `c358fd0c4`** (wa-fallas-2710; van también `c1b3d3a2a` y el merge `c465a407b`; relevo
    `a949fef12`) **y de MaKo inteligente `b2c19c445`** (mako-inteligente-2710-c4, sobre `c659dc0f4`, ya en main).
    Verificación en curso: `wf_930af84b-003` (task `wfduhtfbm`). Los árboles de sólo lectura son
    `C:/dev/verif-c358fd0c4` y `C:/dev/verif-b2c19c445`; antes de borrarlos, sacar el junction con `cmd /c rmdir`. Si sale
    limpio, va a tren-w; WhatsApp es lo urgente.
  - **Ronda de las 21:46:**
    - Los chats locales quietos esperan sus tests (dos lugares). WhatsApp sigue con la tanda A (el crédito Max para
      los grupos).
    - Los nueve tickets abiertos tienen dueño vivo y ninguno está resuelto en producción.
    - Cuatro chats de la nube (Planes, Automations, Landings y Motion) esperan desde AYER una aprobación que sólo
      Martín puede dar en la nube.
    - Sus tres ramas siguen fuera de main: `nube/clic-derecho-2710` (`419d11e90`, el clic derecho en siete listas),
      `nube/media-buyer-2710` (`54e13e9cc`) y `nube/video-generator-2710` (`9012f6070`, el estudio copiado de Arcads).
      Están sobre un main viejo: se verifican DESPUÉS de WhatsApp y MaKo inteligente, para el tren siguiente.
  - **21:52: cinco aprobaciones a Martín por el bloque de preguntas** (`cartero preguntar`; los archivos están en el
    scratchpad, en `aprobaciones/`). Las respuestas llegan como mensajes a este chat:
    1. la migración 0346 de MaKo sin conexión, cuando su revisión salga limpia;
    2. la migración 0342 de publicar desde el Calendar, cuando Zernio pase su revisión;
    3. prender la cuenta de Zernio de MaKo (la recomendada es NO: cada negocio con la suya);
    4. las ventas externas de Stripe en la cuenta de Mauricio (la clave la pega él);
    5. archivar los cuatro chats de la nube (Planes, Automations, Landings y Motion). Su trabajo pasó a la PC el 28/10:
       NO necesitan su aprobación, y en la ronda de las 21:46 se le dijo mal que sí.
  - **22:25: VERDE de MaKo inteligente `cfab5c33a`**, encima de `b2c19c445`: las funciones de MaKo entran al turno sólo si
    la pregunta es de producto (`esPreguntaDeProducto` + `sinFunciones`; «¿cuál es mi meta?» ya no trae Ads Manager). Se
    verifica el delta `b2c19c445..cfab5c33a` cuando vuelva la verificación de b2c19c445.
  - **22:15: VERDE de Planes `e6fd6d88d`** (planes-2710, sobre `a196d5a93`): arregla la verificación de a196d5a93 (el
    diferido fallido, las pruebas detrás del tope, el seguro de 500 con reloj, la unidad mínima, el código libre de
    Partners y la compra doble a Meta). La guardia de RAM no la dejó lanzar a las 22:15 (2,1 GB libres); **lanzada a las 22:27**: `wf_4ecaf858-5ac` (task `wvdwkngpi`).
    El script está en `workflows/scripts/verificar-planes-e6fd6d88d.js` de esta sesión, y el árbol en
    `C:/dev/verif-e6fd6d88d`. Se lanza apenas termine otro workflow.
  - **22:20, Planes y lo de Teo:** hechos los dos chicos (`0fa4bbe0d`: /planes ya no le promete AI Avatar a Pro, y en
    Partners dice «Ganar el primer mes…»), y corriendo sus tests-afectados para que vayan con `e6fd6d88d`.
    - **Decidido por el Cerebro:** un plan a mano que vence NO pausa al negocio mientras el corte general siga apagado
      (`CORTE_DE_ACCESO_PRENDIDO = false`, decisión de Martín). Avisa a Martín y a la persona. Lo hace Planes.
    - **Para la PRÓXIMA cuenta:** la comunidad cobrada por mes. Toca Classroom y `app/crm/curso-al-ganar-actions.ts`, y
      son varias horas. Lo medido está en `docs/relevo/planes-pagos-partners.md` (rama planes-2710).
  - **El workflow de pedidos perdidos llegó al 100% con 12 de sus 21 agentes cortados** («session limit»). Se reanudó a
    las 21:32 en esta sesión (task `wz8f0619h`, mismo runId `wf_fbaed0b3-099`): los 9 que terminaron vienen de la caché.
    Su resultado parcial (lo juntado por fuente y lo que no se pudo leer) está en
    `C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\6ea62e88-206b-49e4-b5fe-e446feb70ded\tasks\wu4kb7spy.output`
    y en su journal.
  - **Los VERDEs en camino**, todos esperando turno de tests:
    - MaKo inteligente `b2c19c445`: 65 tests, roturas y tipos ok;
    - Planes `1e6bd27e8`: tipos ok;
    - Automations, la difusión: tipos ok;
    - WhatsApp;
    - Copywriter, con su relevo en `fe73b1ac7`;
    - el editor, con el ticket 23.
  - Zernio puso su relevo en `8b3af7652` (`zernio-2510`). Replicar espera su turno para medir el blanco.

## Lo que NO se vuelve a discutir

- **Nunca `--no-verify`.** El 24/10 el hook de pre-push frenó un tren con 5 errores de tipos.
- **Un chequeo que decide si se sube NO se pipea:** `cmd > salida 2>&1; rc=$?; tail -6 salida; [ "$rc" -eq 0 ] && git push`.
- **Vercel SÍ guarda el commit, pero lo encuentra sólo con el sha ENTERO** (`git rev-parse <corto>`); con el corto contesta
  «No deployments found» sobre un despliegue vivo. El relevo anterior decía lo contrario y estaba mal (medido el 24/10 a
  las 21:00; `docs/hallazgos-infra.md`). La prueba de producción es el despliegue que SIRVE el dominio
  (`vercel inspect hola-mako.com`).
- **El tren se arma ANTES de pushear,** y dos pushes a `main` en paralelo se traban en el candado del typecheck: de a uno.
- **Una rama entregada al tren NO se rebasa.** Para poner commits a salvo, una etiqueta `refs/tags/respaldo/<nombre>`,
  no una rama (las ramas en origin disparan builds de preview).
- **Nunca `AskUserQuestion`:** traba el turno y Martín no puede contestar desde el teléfono. Se pregunta con
  `cartero preguntar <archivo.json>` y se termina el turno.
- **El `tsc` entero no entra en la PC:** cae al respaldo de 3 tandas (`scripts/tipos-respaldo-push.mjs`, ~6 min).
- **Un pedido viejo de diseño no se hace por antigüedad:** se busca en `docs/hallazgos-<área>.md` y se compara con lo
  que Martín pidió después.
- **Un lector que mira un worktree a mitad del checkout ve el índice VACÍO** (18.900 «borrados»): se vuelve a medir antes
  de alarmar a nadie.

## Trabado esperando a Martín

- **Del 29/10:** archivar desde la barra los cinco chats de la nube: la herramienta
   de archivar no los encuentra, ni por nombre ni por id. **P2P es un cliente FANTASMA** (Martín, 29/10): no se le manda
   nada.
0. **Del 28/10:** quién paga la cuenta de Zernio de la plataforma; las migraciones 0342 (Calendar) y 0346 (sin conexión) (la 0340 de la papelera del CRM: APLICADA el 29/10); las decisiones de la revisión de Teo.
1. **Su sí EN ESTE CHAT para:** leer la Ticketera de producción (el clasificador la niega); activar los avisos al grupo
   (lead de formulario y agenda) en ws15, ws18, ws20 y ws22 de Joan; subir los 21 audios de Makito a un bucket.
2. **Decisiones de plata:** cuánto se le cobra a Joan (2 de 5 clientes pagan), el precio del Acelerador (en la llamada
   con Aaron habló de 2.000 en 4 cuotas con un año de Pro; lo vigente es 1.500 en 3) y un segundo nivel de Partners.
3. **Compras suyas:** el certificado de Windows (SSL.com IV con eSigner) y el Apple Developer ID; sin eso Chrome sigue
   marcando el instalador como malware.
4. **Las landings:** no se publica ninguna hasta que diga los cambios.
5. **Las lecturas de producción** de la versión de la extensión de Leandro (chat CRM) y las de MaKo inteligente, MaKo en
   WhatsApp y Grabadores.
6. **La RAM a 32 GB** (memoria `pc-de-martin-hardware`), o minutos de Actions.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
