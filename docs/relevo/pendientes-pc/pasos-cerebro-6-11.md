> **Corrección del Cerebro, medida el 6/11/2026 ~06:00 UTC, sobre A1:** NO hay nada que corregir y el UPDATE de abajo NO se corre. El código que marca los automáticos (`1d12673f8`) ya estaba en producción antes de la migración (deploy READY `89fb69e06` y anteriores). Los 76 salientes en `false` no son automáticos mal marcados: desde las 00:40 UTC `nutricion_envios` sólo tiene 3 filas y ninguna es un texto de WhatsApp. Lo que falta es ver el primer `true` cuando salga un envío automático de WhatsApp.

# Pasos que los chats de la nube dejaron para la PC: cuáles faltan (medido 6/11/2026, ~05:15 UTC)

Método: relevos leídos con `git show origin/main` (main = 8ce367ed6, 6/11 02:02 ART). Base medida en SÓLO LECTURA (transacciones `read only`, sin imprimir claves ni datos personales). Dos scripts del repo corridos en su modo en seco (`horario-de-fabrica-prendidas`, `carruseles-biblioteca reclasificar`), ambos con la base en `read only`. Nada se aplicó, nada se mandó. «En main» no es «en producción» (compila una vez por día).

## Conteos
- Migraciones del repo posteriores a 0330 con objetos verificables: 52 → 48 aplicadas, 0 a medias, 0 ausentes, 4 «sin verificar» (0336, 0347, 0348, 0352: sólo recrean algo que ya existía, vienen de antes de 0380). TODAS las pedidas están aplicadas: 0349, 0350, 0351, 0372, 0380, 0390, 0391, 0392, 0393, 0394, 0396, 0397, 0398, 0399, 0400, 0401, 0402, 0403. (No existe 0395.) Qué NO mide el verificador: los datos que siembra una migración. Los medí aparte abajo.
- Pasos revisados: 56. Hechos y medidos: 27. Faltan o dudosos que puede correr el Cerebro: 3. Los que sólo puede Martín (sesión, claves, pantalla, decisión): 15. No medibles desde acá: 11.

## A. LO QUE FALTA (puede correr el Cerebro desde la PC)

### A1. [Cliente roto / dato mal] `wa_mensajes.automatico` (nube-codigo, migración 0396)
- La 0396 YA está aplicada (primera fila nueva con `automatico=false`: 6/11 00:40 UTC). Pero el relevo dice que va DESPUÉS del deploy del código que marca los automáticos (`lib/evolution-envio.ts`, commit 1d12673f8, en main desde el 5/11 15:34 UTC).
- Medición: desde las 00:40 UTC hay 76 salientes (`from_me`), TODOS `false` («persona»), 0 en `true`; ws 21: 58, ws 11: 12, ws 9: 3, ws 20: 2, ws 10: 1. Las filas anteriores son `null` (48.929, «no se sabe», correcto). Si ese código ya estuviera en producción, algún automático (Leila, ws 11, tiene secuencias activas) tendría `true`. Lo más probable: el deploy diario todavía no lo incluye, y lo que sale ahora de automatizaciones queda como «persona» y contaría como primer contacto humano de Código (ws 13).
- Ws 13 no tiene ningún saliente nuevo todavía (1.065 salientes, todos `null`), así que la métrica de Código aún no se contaminó.
- Qué hacer: (1) confirmar que el deploy con ese commit está «Ready» (Vercel; no lo veo desde acá). (2) Si cuando eso pase ya hay filas `false` de antes del deploy, devolverlas a «no se sabe». ESCRIBE en producción, sólo cambia datos (no estructura), y NO lo corrí. Comando exacto, a correr DESPUÉS de saber la hora del deploy (`<HORA_DEPLOY_UTC>`):
  ```sql
  -- en seco primero: select count(*) from wa_mensajes where automatico is false and from_me and created_at >= '2026-11-06T00:40:00Z' and created_at < '<HORA_DEPLOY_UTC>';
  update wa_mensajes set automatico = null where automatico is false and from_me and created_at >= '2026-11-06T00:40:00Z' and created_at < '<HORA_DEPLOY_UTC>';
  ```
  (Sólo los salientes: los entrantes también quedaron `false` por el default, pero no importan para el primer contacto.) Hay que pasar por `node scripts/...` o el SQL editor con el OK de Martín; no hay script del repo para esto.

### A2. [Plata / lo que traba] Black November de Leila: el horario de las automatizaciones prendidas (nube-black-november)
- Medido en seco: `poner 0 · marcar 1 · esperar 6 · nada 28`. Las 6 «esperar» son de negocios donde es de noche (ws 13 #264, 15 #266, 17 #703, 18 #265, 19 #698, 20 #702: «córrelo entre las 9 y las 21 de ahí»; Madrid ws 19 también). La «marcar» es ws 23 #726 (el 9 a 21 que le puso MaKo al prender: sólo se marca para que siga el horario del negocio).
- Leila (ws 11): NO tiene `mako.horario_envio` guardado en `app_settings` (sólo `mako.timezone` = America/Cancun). Su única automatización (#721) tiene horario propio. Los 10 a 20 que pidió NO están puestos.
- Comandos (se corren de DÍA; ahora es de noche en Argentina y en Cancún, el script deja «esperar»). Escriben en `app_settings` (compare-and-set, con respaldo); sólo agregan/cambian claves de horario, no borran:
  ```bash
  npx tsx scripts/horario-de-fabrica-prendidas.mts --env=C:/dev/mako-api/.env.local
  npx tsx scripts/horario-de-fabrica-prendidas.mts --env=C:/dev/mako-api/.env.local --aplicar --respaldo=$HOME/.claude/operaciones/respaldo-horario-de-fabrica.json
  npx tsx scripts/horario-de-fabrica-prendidas.mts --env=C:/dev/mako-api/.env.local --ws=11 --horario-del-negocio=10-20
  npx tsx scripts/horario-de-fabrica-prendidas.mts --env=C:/dev/mako-api/.env.local --ws=11 --horario-del-negocio=10-20 --aplicar --respaldo=$HOME/.claude/operaciones/respaldo-horario-leila.json
  ```
  (Los dos primeros son el barrido de todos; el 2.º escribe sólo la marca de ws 23 hoy, y 6 más de día. El 3.º y 4.º son Leila.) Ya medido en seco: el de Leila dice «pondría el horario del negocio en 10-20, todos los días».
- Ojo: el script se corre desde el clon con `lib/` de main; el árbol de wt-push-q es viejo (llega a 0371).

### A3. [Función] Carruseles: casi todo sin tipo (nube-carruseles, paso 2 de las correcciones)
- 0392/0393 aplicadas; biblioteca cargada: 456 cuentas (4 con referente: hormozi, victor-heras, sofia-contreras, vilma-nunez; 452 sin referente; leilahormozi está activa), 32 temas, 1.588 piezas, todas con `texto_leido_en`.
- `reclasificar` en seco: «sin tipo 1.253 → 1.253 (de 1.470 carruseles)», 0 cierres nuevos, 0 personales: no hay nada que `--de-verdad` cambie, así que ese paso está hecho y NO sirve correrlo. Lo que queda es un problema del clasificador: el 85 % sigue sin tipo, muchos son textos en portugués/alemán/inglés (`lib/carruseles/biblioteca.ts`, `reclasificacion`). 512 piezas con `parece_contenido` nulo.
- Esto es trabajo de código para el chat de la nube, no un comando.

## B. LO QUE YA ESTÁ HECHO (con la medición)

| Relevo | Paso | Evidencia |
|---|---|---|
| nube-admin | 0398 aplicada | tablas `actividad_uso` (8 filas desde el 5/11), `actividad_acciones`; `has_function_privilege('anon','sumar_actividad(...)')` = false. La medición escribe: el código ya corre en producción |
| nube-admin | Cargar noviembre de Código (lead 2474) | pagos #2 US$94 (4/11) y #3 US$144 (5/11), pagados, `es_mensualidad`, mes 2026-11, medio cripto; el pago de octubre (US$146) ya dice cripto |
| nube-suscripciones | 0401 + datos | `suscripcion_movimientos` con 6 filas: 2474 (146 desde oct, 238 desde nov día 5, 426 desde dic), 2473 y 2659 (97 desde oct); `anon` sin select; fecha de cierre 2659 = 2026-10-18, 2474 = 2026-10-21. (Extra: hay un movimiento del lead 2605, US$666, de hoy 6/11: no sale de este relevo) |
| nube-agencia-cobro | 0402 y 0403 | columna `cobra_desde`, `comprobantes_leidos.lead_id` y `media_path` admiten null, CHECK `lead_o_grupo` y origen `grupo` presentes |
| nube-agencia-cobro | Paso 3 Giselle | `agencia_clientes` ws 17: `cobra_desde` = 2026-10-28 |
| nube-agencia-cobro | Paso 4 mensualidad del 13 | `agencia.mensualidad.13.config`: desde 2026-12, entradasDesde 2026-11-06, medio Binance, prendida 6/11 02:50 UTC |
| nube-agencia-cobro | Paso 5 «Paga para entrar» | `plan.corte_por_pago` vigente (causa «entrada», agencia 13) en ws 18 y ws 22; ambos workspaces `pausado`; usuarios 15, 19 y 22 `activo`, como pide el relevo |
| nube-agencia-cobro | Paso 8 tareas del 9, 12 y 14/11 | las tres existen y están activas |
| nube-recibos | 0397, 0399, 0400, emitir_recibo cerrado | `anon` sin execute en `emitir_recibo` y `emitir_recibo_negocio`; RLS prendida en las tablas |
| nube-recibos | Cargar 0001 y 0002 | `recibos` 1 = `mensualidad:13:2026-10`, 2 = `mensualidad:13:2026-11`, emitidos, correo y WhatsApp «enviado», con PDF; 3 pagos Binance; contador en 2 |
| nube-apify / nube-aprobaciones | vigía de aprobaciones corriendo | `vigia.aprobaciones` con última vuelta 6/11 05:11 UTC (cada hora) |
| nube-approvals | tarea que lee los paneles | `vigia-paneles-diario` activa (9:35 diaria); `vigia.paneles` guardado 6/11 01:46 UTC: google-oauth aprobado, meta-verificaciones aprobado, play-cuenta «piden algo» (condición de comerciante antes de feb 2027; 0 de 12 testers), firma-windows «no pude» (SSL.com pide sesión) |
| nube-aprobaciones | «¿sigue corriendo `vigia-revisiones`?» | no hay tarea con ese nombre: queda `chequeo-revision-meta-google` (activa, 8:00 y 17:00). La carpeta vieja `vigia-revisiones-meta-google` existe pero NO está en la lista de tareas programadas |
| nube-creem-fuera | claves de Creem del negocio 9 | cero `CREEM_*` en `credenciales` de cualquier negocio. Stripe lo tienen ws 1 y 10, NO el 9, y `app/terminos` ya no lo nombra para la plataforma. `AGENTS.md` ya dice que hoy no modera nadie (Creem cerrada) |
| nube-email | 0380 | aplicada |
| nube-email | mudanza de la clave de correo | la plataforma (ws 9) ya tiene `RESEND_API_KEY` (4/11 21:02 UTC) y `resend_domain`; ws 10 y 11 tienen clave y dominio propios. No comparé valores con el ws1 (no se toca) |
| nube-funnel-coach | ticket #57 | el ws 9 tiene 2 ofertas, ambas `manual` (`desde_brief` = false): «Tu oferta ya está cargada» decía la verdad; no fue lectura caída ni oferta sembrada. `coaches.referentes`: 2 filas, ninguna ambigua `{"funnel":null,...}` |
| nube-grabar | 0390 | tablas `llamadas_grabadas` y `_partes` con RLS (0 filas), bucket `llamadas-grabadas` privado |
| nube-grupos | 0372 | tablas con RLS; 53 mensajes, 1 invitado, 3 lecturas (ya se usa) |
| nube-ops-ignorar | 0394 | columna `ignorada_at` presente (125 decisiones, 0 ignoradas) |
| nube-spy | competidor 13 del ws 11 «quedó en 12» | hoy 6/11 03:57 UTC: 257 piezas de Instagram, 106.406 seguidores, texto leído 03:59; el negocio tiene su clave de Spy. Resuelto |
| nube-spy | 0391 | aplicada |
| nube-tickets | 0364 y correos de avance | columnas `avance_email` y `avance_email_at`; 4 tickets con aviso (último 4/11 11:01 UTC), 0 fallos en `ticket_eventos`, nadie con más de uno por día |

## C. SÓLO MARTÍN (sesión, claves, pantalla, decisiones, compras)

1. Claves del vigía en Integraciones (nube-aprobaciones/approvals): faltan `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_P8` y `TIENDAS_GOOGLE_CUENTA_SERVICIO`, y `CWS_PUBLISHER_ID` (el vigía mismo lo confirma en `faltan`). `RESEND_ADMIN_API_KEY` y `MAKO_META_APP_SECRET` son variables de Vercel: no las veo.
2. Firma de Windows (SSL.com): el vigía de paneles dice «pide iniciar sesión»; iniciar sesión en el navegador de la app.
3. Play: declarar la condición de comerciante y los 12 testers (mensaje del panel).
4. Extensión que se publica sola: cuenta de servicio sumada en el panel de la Chrome Web Store + `CWS_PUBLISHER_ID`.
5. Probar en el negocio de prueba (ws 3), con su sesión: grupos de la app (7 pruebas), Funnel Coach (5), carruseles de Image (9), Grabar (4 minutos, 2 partes), «Le llegó un comprobante» y «Emitir recibo», Mes a mes de la suscripción.
6. Mirar en pantalla: Admin (Revenue MRR esperado US$432 / «Subió +US$92», Users, Errors, Activity), tarjeta «Primer contacto» de la hoja Closing en ws 13, chips de Spy/Image, Ops Center «Ignorar» en el teléfono.
7. `GET /api/admin/recibos/ejemplo` con sesión de super admin (prueba que jsPDF carga en el bundle) y mirar el primer pago real.
8. Decisiones: ¿el alta del CRM también rota claves de Apify?; qué cuenta en el MRR del negocio (4 de 5 ganadas del ws 11 no pagaron nunca); el negocio 11 con la suscripción de US$4.235 (¿pago único?) y 4 pagadas fuera de Ganado (1852, 1871, 1923, 1940); YouTube/enmienda III.L; ¿Gemini de la plataforma para YouTube sin Gemini?; tiempo al aire de Closing (estimar o buscar dato medido); ¿columna por cliente en `/agency`?; nube-iniciativa: el orden de las tabs que faltan.
9. Lo que dependía del cobro a los clientes: Pablo paga el 9/11 (14:07 UTC corre el cron del PDF de Giselle); la prueba de que el cron en seco dice lo esperado la tiene que hacer quien tenga el `CRON_SECRET` (ver D).

## D. NO PUDE MEDIR (y por qué)
- Deploy de Vercel «Ready» de cada punta: no lo veo desde acá; por eso A1 queda condicionado.
- Cron `agencia-mensualidad?dry=1`: es una llamada HTTP a producción con `CRON_SECRET`; me pidieron sólo lectura de la base, no la corrí. Comando del relevo: `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://hola-mako.com/api/cron/agencia-mensualidad?dry=1"` (en seco por diseño; debe decir nada del mes, ninguna entrada hasta el 9/11 y ninguna pausa nueva).
- `carruseles-biblioteca.mts estado` y `verificar`: llaman a Apify (crédito, gasto de unos US$0,003 por cuenta). Sofía Contreras ya está activa con su referente, así que ese paso parece hecho. El cuerpo real de «sin crédito» de Apify tampoco se mide.
- Carrera de `emitir_recibo` (dos conexiones con `begin; select emitir_recibo(...); rollback;`): escribe aunque se deshaga, no apto para sólo lectura.
- Si el número de Leila llega a sus 40/día: sus salientes totales fueron 96–260 por día (29/10–5/11) pero mezclan personas y automáticas, no se puede separar con `automatico=null`.
- Piezas de Spy sin número («3,7×»): es lo que dibuja la pantalla, no una columna.
- ws 1 (Mauricio): no consulté sus filas. El script en seco de horarios lo recorre y lo lista (3 automatizaciones, «nada»), sin escribir. Tampoco comparé su `RESEND_API_KEY`. Qué negocios tienen dominio sin clave propia: sólo vi `resend_domain` en ws 9 y 11 (ambos con clave); la fila `resend_from` de ws 1 no la toqué.
- Páginas públicas (`/aup`, política de privacidad, Creem): no corrí HTTP. Creem quedó fuera de todos modos.
- nube-dashboards, nube-gurus, nube-iniciativa, nube-multiplo: no traen pasos de base para la PC; lo que dicen es estado de despliegue o trabajo de código.

## E. Resumen de qué escribe cada migración (para el que pregunte)
Todas las del listado sólo AGREGAN tablas/columnas/funciones, salvo 0403 (cambia `comprobantes_leidos`: quita not null y reemplaza dos CHECK, no toca filas, hoy 0 filas) y 0396 (agrega `automatico`, null en las viejas y default `false` en las nuevas: ése default es el que causa A1). 0394, 0390, 0391–0393, 0397–0402: sólo agregan. Ninguna borra datos.
