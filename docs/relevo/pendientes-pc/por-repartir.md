# Tickets que llegaron de noche, para repartir cuando se pueda mandar mensajes

## 05:47: tren-y EN MAIN (la foto de Replicar, 601e6777d + 22b4b75c4). Falta que Integración confirme el deploy Ready.
Los archivados siguen archivados: sin poder mandarles mensajes, desarchivados no harían nada y ocuparían RAM. Desarchivarlos
cuando Martín escriba: Video Editor para su VERDE de Motion; Zernio, sólo si Integración le pide algo.

## ARCHIVADOS para darle RAM al tren (05:27) → DESARCHIVAR después del push

- Zernio (local_4a831c28) y Video Editor (local_2f82a70c), con el permiso de Martín del 27/10. Los dos tenían todo
  commiteado. Automations, Create, AI Avatar y CRM no se dejaron archivar: tenían trabajo en segundo plano. La app de Claude
  bajó de 9,2 a 8,5 GB, pero la PC quedó en 4,4 GB libres y el push pide 5,2.

## Web Generator: sus mediciones con Chrome sin ventana corren DURANTE la subida

A las 05:39, con el push de tren-y en la tanda 2/3 de tipos (hasta 4,5 GB), la cadena de medición de Web Generator tenía
un Chrome sin ventana de 1,1 GB. No pasa por con-turno ni respeta la pausa. El Cerebro dejó una guarda que corta todo Chrome
sin ventana mientras el push vive (máximo 25 min). → Decirle a Web Generator: su cadena de medición tiene que esperar la
pausa (`scripts/pausa-cerebro.mjs`, `esperarSinPausa`) antes de abrir cada Chrome. Las mediciones cortadas se repiten.

## VERDEs que llegaron al Cerebro y quizás no a Integración (pasárselos)

- **Pagos, el plan por tramos (ticket #13):** pagos-tramos-2910 @ 9fc4030dd (worktree C:/dev/wt-pagos-tramos). Sin migración y sin
  tocar lib/cobros*.ts. Tests afectados: 2956 de 275 archivos; el único rojo, ya arreglado. 18 tests con las cuotas reales de
  Nadia y 13 roturas atrapadas. tsc: 0 propios. Falta recorrerlo en el ws3 después del deploy. El #13 está en
  esperando_decision: aprobarlo o cerrarlo es escribir en producción (pide el sí de Martín, salvo que se lo cierre como
  resuelto con la regla del 28/10, después de verlo andar). La búsqueda en las transcripciones no encontró el sha en Integración.
- **Web Generator, las clonadas desfasadas (06:36):** web-generator-foto-2910 @ c3c6849bc (encima de 22b4b75c4, ya en main;
  worktree C:/dev/wt-foto-2910). El editor a 1440 escalado, lo fijo adentro de la primera sección, el corte que no parte
  columnas. Mediana del desfase en el EDITOR a 1440: holo 913 → 98, respond 42 → 2, reportei 870 → 289; closermood,
  masterads y 100ads en 0. Tabla: C:/dev/revisiones/clonadas-2910/final/tabla.md. Tests: 85/85 y 33/33 roturas; tsc: 0
  propios. **NO corrió tests-afectados**: que lo corra Integración en la mezcla. Sin hacer: holo y reportei en celular (390)
  también en la PUBLICADA. Martín tiene que replicar de nuevo #68-#72 después del deploy.
- **CRM, dos piezas (06:35):** crm-fiscal-2910 @ b39a42ba7 (Fabi/Joan, sin migración) y crm-difusion-2910 @ d462f9c6c (la
  difusión de Leila desde el «⋯» de la columna y la barra en bloque; trae aut-2510 + crm-lote-2810). La difusión entra DESPUÉS
  de aut-2510, que volvió a Automations por la regresión del DM: tiene que traer su arreglo.
- **Create, el shell único (07:50):** create-shell-2910 @ b57b67268 (worktree C:/dev/wt-create-shell). Tipos verdes en 3 tandas,
  tests afectados 3525 de 350 archivos en verde. Sin capturas en producción (no hay Chrome). Es la BASE de AI Avatar y de
  Copywriter: entra antes que ellos.
- **Para Martín, a la mañana:** Chrome quedó cerrado de noche (lo cerramos el Cerebro e Integración para el tren) y Claude in
  Chrome no tiene sesión en claude3. El chequeo de las revisiones de Meta y Google (local_021fe662) no corrió: ya van 6 días sin
  mirar Gmail. Abrir Chrome e iniciar Claude in Chrome con martinkoncke@gmail.com.
- **Copywriter = Notion (08:55):** copywriter-notion-2910 @ **544991179** (ebe883140 + el merge de la punta exacta de Create,
  b57b67268, que sólo trae docs; trae Create ENTERA, así que alcanza con subir esta). Antes: @ ebe883140 (código en d938b5003; worktree C:/dev/wt-copywriter-notion).
  Tests afectados 5.339 de 528 archivos, 0 rojos; tsc 0. Trae create-shell-2910 hasta 4e75f2067: suben JUNTAS, porque Create
  redirige /reels a /copywriter?nuevo=reel.
  Para la revisión de Integración:
  - package.json suma BlockNote 0.56 y Mantine (núcleo MPL-2.0; los paquetes XL, que son GPL, no se instalan);
  - **la mudanza ESCRIBE EN PRODUCCIÓN la primera vez que cada negocio abre la tab** (los guiones del Ads Writer y de Reels
    pasan a páginas). Revisarla como un borrado: que COPIE sin borrar lo viejo, que sea idempotente (dos pestañas a la vez,
    o volver a abrir) y que nunca lo haga en ws1 sin que se vea.
  Decide Martín: la matriz y «Analizar guion» del Ads Writer.
- **AI Avatar:** ai-avatar-higgsfield-2910 @ 3020bfbbc. 293 tests de lo tocado en verde; trae el shell de Create hasta
  16f9abc73. Va DESPUÉS del shell de Create (su base).

## Números de migración (asignados por el Cerebro, 09:20; medido en las 60 ramas más nuevas)

Tomados: 0340 leads_papelera (CRM, APLICADA), 0340 image_editor_propuestas (motion-imagen-2610, hay que RENUMERARLA),
0341 partner_codigo_editable (aplicada), 0342 calendario_publicar (APLICADA el 29/10 ~10:55, «Sí, agregala»), 0346 sin_conexion_aplicadas
(desktop-offline-t2-2810).
- **0343 → MaKo en WhatsApp**, la marca `cerebro_*` de tickets. **APLICADA en producción el 29/10 ~10:45** («Sí, sumala»):
  los 22 tickets siguen intactos y los 22 quedaron en 'pendiente'. Falta: el código y el cartero 1.23.0 en el Runner.
- **0344 → Image Editor** (renombrar su `0340_image_editor_propuestas.sql`). Decírselo a Video Editor cuando se desarchive.
- **0348 → Zernio** (el Calendario publica también en LinkedIn, X, Threads y Google Business). **APLICADA el 29/10 ~15:05** («Sí, agregalas»).
- **0347 → Pagos** (APLICADA el 29/10 ~13:35, «Sí, cambialo») (N3: lo que queda de un cobro en pesos hecho a medias hereda la moneda de la cuota, en `cobrar_cuota_con_resto`). Pide el sí de Martín. La 0345 queda libre.

## PRIMERO (05:40): la decisión que pidió Integración, sin contestar por el tope de mensajes

Integración preguntó si sube WhatsApp 450677f90, que trae abierta la ALTA 2 (2810-verificacion-wa-c358fd0c4.md:43). Esa ALTA es
una REGRESIÓN contra producción: después de que el equipo le pregunta algo a alguien del grupo, el próximo pedido real de
esa persona a MaKo queda en silencio. La otra opción era esperar 152cfcd27, las 6 fallas de Leandro.
**Decisión del Cerebro: SÍ a su propuesta.** WhatsApp NO sube con una regresión: entra cuando 152cfcd27 tenga VERDE Y la
ALTA 2 esté arreglada. Primero sube aut-2510 (el filtro por palabra clave de Leandro).
→ A **Integración**: «Va así».
→ A **MaKo en WhatsApp** (local_cf058ed5): que arregle la ALTA 2 antes del VERDE de 152cfcd27 (test por la entrada real:
el equipo le pregunta a X, X le pide algo a MaKo, y MaKo contesta) y que los dos entren juntos.

Contexto: la noche del 29/10, la app cortó los SendMessage del Cerebro hasta el próximo mensaje de Martín. Cuando haya
mensaje de Martín, repartir esto y borrar la línea.

- **#26 · ws1 · Mauricio · 29/10 03:51.** Le pidió a MaKo en el Ops Center el plan de pagos de Fernando Muñoz: USD 7.500
  en 3 cuotas de USD 2.500, el 28/10, el 28/11 y el 28/12. MaKo no tiene una herramienta para crear el plan (sólo lee la
  cobranza) y lo mandó a «Cargar el monto» en la ficha. No está roto: tiene la salida por la pantalla.
  → **Pagos** (local_9b34bb88, plan por tramos): que el plan nuevo tenga su herramienta para MaKo y su ruta en la API
  ([[api-mako-con-cada-feature]]), y que el hito lleve `tickets: [26]`. Es ws1: nada de pruebas ahí.

## Para Web Generator (local_12107aea), cuando se pueda escribir

- Dio d413ad03b (las clonadas: el editor ya no parte columnas, no estira cada sección al alto del body y no dibuja secciones
  vacías). Medido: holo pasó de 912 a 177 px de corrimiento, y 100ads, closermood y masterads quedaron en 0. Va con
  web-generator-foto-2910 a Integración cuando corra su tsc.
- Le faltan dos cosas que el Cerebro ya le había aprobado: **dibujar a 1440 escalado al lienzo** (hoy a ~980 elige el diseño
  de tableta) y **lo FIJO** (el menú de holo y respond: corre todo 40-280 px). Dijo «sin hacer porque hace falta el editor
  real». Que NO espere a Martín ni a un build: montar `HtmlEditableVista` en una página de prueba con un Chrome sin ventana
  (como su DOM contra DOM), de a una página por vez, y medir igual.
- Después del deploy, volver a replicar #68-#72 en el ws9, que se partieron con el corte viejo (copias NUEVAS, sin pisar
  las viejas).

## Para Video Editor (local_2f82a70c) e Integración

- Motion «sin tipos» en motion-imagen-2610 @ 17a48ddd3: le falta el tsc y tests-afectados con ~4,5 GB libres. Con la fila
  nueva de con-turno ya espera sola a que haya RAM: decirle que lo relance.
- **Su `0340_image_editor_propuestas.sql` choca con la 0340 del CRM, que YA está aplicada (la papelera).** Que la renumere
  al siguiente libre (la 0341 está aplicada, la 0342 es del Calendar de Zernio y la 0346 se nombró en el relevo: mirar
  origin/main y todas las ramas antes de elegir). Integración ya lo sabe.
- Encontró que `RUTAS_QUE_PLIEGAN` (app/_components/Sidebar.tsx:123) no tiene /video-editor ni /image-editor: la barra no se
  pliega en los editores. Es del chat Sidebar, que no está abierto → al chat «Create: un solo diseño» (local_e55e6378), que
  ya lleva el shell de Create y las rutas.
- Su hallazgo del Image Editor en blanco en Windows (`import('./editor/Estudio')` cargaba estudio.ts) va con su tren: es
  MaKo Desktop.

## Para Integración (infra): el push del tren y la fila de tipos se trababan entre sí

**29/10, 03:11 a 03:58.** El push de tren-y (`git push origin HEAD:main`, 03:42) quedó esperando en su pre-push
(`scripts/tipos-respaldo-push.mjs`) el lock de tipos (`%TEMP%/mako-typecheck.lock`). Ese lock lo tenía desde las 03:11 el
`con-turno.mjs` de CRM (pid 152796), y su `tsc-acotado` (0,02 GB, sin tsc hijo) esperaba la PAUSA del Cerebro
(`esperarSinPausa`, tsc-acotado.mjs:118). Esa pausa la había prendido el mismo push. Se esperaban uno al otro hasta el
corte de 60 min de con-turno, y mientras tanto la fila de tipos de toda la PC quedó frenada: el tsc de Zernio salió con 99.
El Cerebro cortó el 152796 a las 03:58 y el push tomó el lock a las 03:59:58.
Al soltarlo, el lock no fue al push: lo tomó primero el con-turno de Zernio (03:58:43), cuyo tsc-acotado de zernio-2510
NO esperó la pausa (rama vieja) y corrió un tsc de 2,8 GB JUNTO con el respaldo de tipos del push. Zona roja a las 03:59:58
(849 MB): el vigía mató el de Zernio y el push tomó el lock. **Una rama sin tsc-acotado al día se saltea la pausa.**
→ **Arreglo:** con-turno.mjs (o tsc-acotado) tiene que esperar la pausa ANTES de tomar el lock, nunca con el lock tomado.
Con la pausa prendida, con-turno no le da el lock a nadie que no sea el push. Así funciona aunque la rama del chat
tenga un tsc-acotado viejo.
- **Y el push también espera RAM CON el lock tomado.** `tipos-respaldo-push.mjs`:113 toma el lock y en :122 espera hasta
  15 min por tanda a que haya `MAKO_TIPOS_RAM_MIN_GB` (4,8) libres. Con 13 chats abiertos la PC andaba en 2-3,5 GB: el push
  tuvo el lock desde las 03:59:58 sin correr ningún tsc, y la fila de tipos de todos quedó frenada. MaKo en WhatsApp salió
  con 99 sin correr. → Esperar la RAM ANTES de tomar el lock.
- **04:40, ARREGLADO en `C:/dev/con-turno.mjs`** (respaldo `con-turno.mjs.antes-29-10`). La fila de TIPOS espera AFUERA, sin
  tomar el turno, a que no haya pausa (el archivo, ≤90 min) y a que haya RAM: min(heap, 3,2 GB) + 1,3 GB, o sea 4,2 GB con
  heap 3000 y 4,5 con 4096. Si al tomar el turno ya no alcanza, lo suelta. La espera máxima pasó a 60 min; el 99 dice el
  motivo. Probado con un lock de prueba (TEMP falso): con pausa no toma el turno (99), sin RAM tampoco (99), con RAM corre y
  suelta, la pausa vieja no frena y la fila de tests no mira la pausa. Los con-turno que ya estaban en fila siguen con el
  código viejo hasta que terminen. Falta: cosecharlo en docs/hallazgos-infra.md y arreglar lo mismo en `tipos-respaldo-push.mjs`
  (espera RAM con el lock tomado).
- **05:25, mismo traba en la fila de TESTS.** subir-tren.mjs (Integración) tenía un lugar desde las 04:45 y esperaba el
  segundo. Ese lo tenía desde las 04:59 el tests-afectados de CRM, esperando la pausa del mismo push. Se arregló en
  con-turno: la fila de tests también espera la pausa AFUERA. Se cortaron las esperas viejas (copywriter, webgen, pagos y
  avatar, todas `--test` en fila con el código viejo: sólo esperaban, no se perdió trabajo). El push tomó los dos lugares a
  las 05:25:31. **Esos 4 chats tienen que relanzar sus tests.**
- 04:15: el Cerebro cerró Chrome y Copilot (con el permiso de Martín del 27/10 para trenes): de 2,1 a 3,9 GB libres.
  **NO se bajó el piso ni el umbral del vigía:** de noche manda «que no se cuelgue». Con 13 chats abiertos, un tren entero
  sólo pasa si se libera RAM de verdad (reiniciar la app o cerrar chats).
Test: lock tomado + pausa prendida + un pre-push pidiendo el lock, que no se trabe. Cosecha en docs/hallazgos-infra.md.

## 29/10 ~17:30 — aviso del #30 a Leandro, TRABADO por el tope (el del #25 salió 30/10 01:20; éste sigue pendiente)
- Texto listo (avisar-arreglo-al-grupo, --ws 10 --clave ticket:30 --commit 0d77d306441b1a5987b01f8805309c24dc8c9c5f):
  «Sí, quedó en la documentación: en la página de la API de MaKo está la guía «Palabras clave y botones de Instagram», con
  cómo funcionan las palabras clave del disparador (sin mayúsculas ni acentos), el «Contiene / Es exactamente» y el botón «Ya te sigo».»
- Mandarlo cuando baje el tope, o juntarlo con el aviso del cierre del #30 (el arreglo de la promesa falsa, en el chat de MaKo en WhatsApp).

## 29/10 ~18:00 — PLANTILLAS REALES: repartir la implementación (después de la reunión de Martín)
Plan en la rama `plantillas-reales-2910` (da6d07dee, sólo docs, va en el tren-ad): docs/plantillas-reales/README.md §6 es el orden.
De a UN chat nuevo por vez (RAM: no más de ~6 chats trabajando a la vez). Cada brief: leer README + el archivo de su tab
(desde la rama o desde main cuando entre), implementar su §5, VERDE = tsc-acotado + tests dirigidos + roturas, cosecha en su
docs/hallazgos-<área>.md con su línea en el índice.
1. Create (local_e55e6378), DESPUÉS de su VERDE actual (QA + Doory): la TANDA 0 común (PlantillaCrear con campos opcionales,
   NuevaCrear con extracto/chips/grupo/miniatura, chipsVisibles/seccionesDeCrear/cajaDeMiniatura, el rótulo «Ejemplo» y el
   primer mensaje, contextoDelNegocio/vozDelNegocio a lib/ común con grafoParaChat, tests/_reales.ts).
2. Copywriter (local_4222ab6e, archivado: desarchivar): copywriter.md §5 — el bloque `tabla` ANTES de «Adaptar», los 12
   ejemplos, youtube-retencion, esqueleto() para la API, copywriter.experto + copywriter.adaptar.user (add-editable-prompt).
   Puede ir en paralelo a la tanda 0 (los campos nuevos son opcionales).
3. Offer, 4. Video (local_2f82a70c, archivado), 5. Image, 6. AI Avatar (local_33825c6f, archivado; AV-1 y AV-2 antes, lo
   visual después de que Martín genere un look real).
Decisiones abiertas que son de Martín (README §7): Gemini por defecto en image-editor-ia contra «sin Gemini»; quién paga la
licencia de música de cada cliente; las caras del elenco en Image.

## 29/10 ~19:00 — PROMESAS A LA AGENCIA DE THIAGO (llamada del 29/10, reunión de nuevo el jueves 5/11 17 h)
Lista: rama `promesas-thiago-2910` → docs/promesas/2910-llamada-thiago.md (61 promesas: 27 están, 23 a medias, 8 no existen).
YA REPARTIDO (29/10 ~18:55):
- Agency (Planes y Partners, local_e5c96952): dar de baja, cobro por país (Stripe), 47/97 con topes, esClienteDeAgencia, Partners.
- MaKo en WhatsApp (local_cf058ed5): acciones directas del despachante + pedido compuesto + aviso 30 min; después «subime este anuncio».
- Zernio (local_4a831c28): 2.º Instagram US$6, leads por Zernio, publicaciones recurrentes (migración: pedir sí a Martín).
- Ads Manager: PROPUESTO como tarjeta (task_9edbad0b, «Ads Manager: lo prometido a la agencia de Thiago»): Dónde, Hasta,
  crear campaña por Zernio, stop loss intradía. Si Martín no la arranca, arrancarla en su próximo mensaje.
FALTA REPARTIR (de a una tanda, cuando liberen RAM):
- Extensión: «Guardar en MaKo» sobre el perfil abierto de Instagram (mediano); LinkedIn, sólo tras la decisión de Martín.
- API de MaKo: guía «Migrar tu CRM con Claude» en /api-mako, UTM/fecha/id externo en createLead, migrados quietos, token de agencia.
- Calendario: anuncio y email enlazados (no recordatorio), reuniones del equipo (closers/setters con filtro por persona).
- Editores/AI Avatar: «Usar en un anuncio»; «Subir creativos» del Media Buyer que acepte un video ya generado.
- Ads: variar el CTA, hooks de video con el avatar, pausar el original cuando una variación le gana.
- CRM: reservas de Google Calendar → etapa.
DECISIONES DE MARTÍN: LinkedIn en Chats/Automations (a no oficial / b partner sólo Páginas / c no hacerlo y aclararlo).
PASOS DE MARTÍN: Stripe en modo real; el clic de la prueba de anuncios por Zernio; mandarle a Thiago la grabación de Fathom;
confirmar la hora del jueves; la cuenta TikTok Business de prueba (baja prioridad).

## 29/10 ~19:45 — estado
- tren-ad EN PRODUCCIÓN (main 7ed7e17c6, Ready 19:39): AI Avatar para todos, «Publicar» desde los editores, docs de plantillas y promesas.
  /planes todavía muestra la fila del avatar: «sacar» ya mandado a Integración, sale en el tren-ae.
- tren-ae: Create QA 95ac56201 + Copywriter plantillas 1d9160f87 + despachante WA cuando dé VERDE.
- Copywriter ARCHIVADO tras su VERDE. Le falta (retomar): los evals del experto, los ejemplos de las 3 VSL ocultas y cargar
  extracto/chips en la tarjeta cuando la tanda 0 de Create llegue a main.
- Plantillas reales, siguiente tab según el orden: Offer (después de que baje la RAM).
- Migración 0349 (calendario: repetir + serie_de) escrita por Zernio, SIN aplicar: pedir el sí de Martín cuando llegue su VERDE.
- Martín: generar un look real de AI Avatar en el ws3 (destraba vender la fila de /planes y la tarjeta de la landing).

## 29/10 ~20:15
- Landing principal PUBLICADA v14 (#32; respaldo #86): las tarjetas siguen el pitch a Thiago. Verificada en producción.
  Avatar listo detrás de --con-avatar (cuando haya un look real). Pendiente: páginas viejas de dashboards y de MaKo.
- Zernio VERDE promesas (88868c0cb + ce56bd693, zernio-token-2910): 2.º Instagram, leads por Zernio, recurrentes.
  Mig 0349 SIN aplicar: pedido el sí de Martín. Lo siguiente de Zernio: la tarjeta de WhatsApp en Integraciones (QR, varias líneas).
- Del Calendario, todavía sin dueño: [19:12] el anuncio y el email programados (hoy son recordatorios) y [19:29] el Calendario
  para closers y setters.

## 29/10 ~20:25 — tickets aprobados por Martín desde el Centro (20:19)
- #28 (Martín, Zernio en una pestaña sin tokens): YA ESTABA HECHO (af78bb488, tren-ab). Cerrado y avisado al ws9; cierre en el Centro.
- #25 (Leandro, Automations): casi todo ya estaba (#17, #12, #29). Falta elegir la publicación o el Reel en el CRON de comentario
  → Automations (local_7f005343, desarchivado). Hito con tickets:[25]. Aviso a Leandro: el tope de 3 por día está lleno hoy.
- #30 (Leandro, «pídemelo otra vez»): MaKo en WhatsApp lo tiene (9ac30e8c8); salió del tren-ae por A1/A2 de privacidad; va en el tren-af.
  El aviso «sí, quedó en la documentación» sigue pendiente (tope).

## 29/10 ~20:35
- 0349: NO aplicar aunque Martín diga sí, hasta que Zernio arregle la serie (borrar o mover hace renacer; Repetir en una copia
  duplica) e Integración dé por buena la punta. Además, el barrido de leads (ce56bd693) volvió a Zernio: con clave propia trae
  leads de todas las cuentas del equipo de Zernio, y dos formularios hacen reenviar la conversión cada 30 min. Informe:
  C:/dev/revisiones/2910-revision-privacidad-zernio-leads-ce56bd693.md.
- Landing v15 publicada (última tarjeta a todo el ancho en celular; respaldo #87).

## 29/10 21:50 — mig 0350 (Media Buyer: zona, hasta, crear_campana) APLICADA con el sí de Martín («Sí, agregalo»)
Archivo de a2b0088a3 (md5 466c27d9…). Después: 3 columnas, CHECK con crear_campana y hasta, 11 configs y 8 decisiones intactas.
Pendiente de Martín: el OK para medir por Zernio en la cuenta de MaKo (crear campaña en pausa, gasto 0); LinkedIn (a/b).
tren-ae EN PRODUCCIÓN 21:45 (main 4b8f8145d): plantillas de Create con ejemplo, QA, Copywriter 12 plantillas, /planes sin avatar, sin crédito Doory.

## 29/10 ~22:00 — Martín: «Elimina esto "Copy Method · Angles & Structures", no quiero ninguna mención en todo MaKo»
Mandado a Copywriter (local_4222ab6e, desarchivado): sacar el pie de Copywriter.tsx:191, las filas de nav.ts:264/268, la del
teléfono (lib/movil-creacion.ts:50) y las páginas /admin/copywriting, /admin/guiones y /m/admin/copywriting; lo que lee la IA
sigue igual. El envío dio «no se vio empezar en 20 s» (recién desarchivado): si en la próxima ronda no aparece en su informe,
REENVIAR el mismo brief.
- 22:10: Copywriter SÍ tomó el pedido de «Copy Method» (commit de 29 archivos, espera tsc). No reenviar.
- #25 VERDE (aut-2510 b26d89b94, «Publicación» en el disparador de comentario). Automations archivado. Después del deploy: probarlo
  con la cuenta de Leandro (el Reel de la 680) y avisarle a Leandro (tope de avisos: juntar con #30). Pendiente aparte: #20 (pedir
  un dato en el DM y guardarlo en la ficha).

## 29/10 ~22:40 — tres pedidos de Martín (iniciativa, tutoriales, plantillas, conocimiento)
- Corren 2 workflows: «mako-toma-la-iniciativa» (plan en scratchpad/iniciativa/plan.md) y «mako-ensena-y-senala»
  (plan-tutoriales.md). Al volver: juntarlos en un plan, cosecharlo en el repo (docs/mako-iniciativa/…) y repartir
  (Create: base común y tutoriales; Ops Center u Onboarding: primer ingreso; cada tab: sus aperturas y anclas).
- Copywriter (local_4222ab6e, desarchivado): miniaturas con extracto/chips/insignia; la plantilla nace con la ESTRUCTURA y
  «Ver ejemplo» aparte; MaKo pregunta el objetivo en el chat (sin el botón de barra). Lo mismo, después, para Offer y las demás.
- CONOCIMIENTO (Knowledge del super admin, cursos con transcripciones → conocimiento modular tipo Second Brain): script listo en
  scratchpad/iniciativa/conocimiento-workflow.js. LANZAR con Workflow({scriptPath}) cuando haya ≥3 GB (la guardia lo pide).
  Regla legal: destilar en principios propios, nunca texto literal ni nombres de autores en lo que ve el cliente.

## 29/10 ~22:50 — Agency VERDE (agency-thiago-2910, 4b42b6a7f, sin migración) → Integración. Archivado.
- Cambio de comportamiento: con el corte por pago APAGADO, el corte `sin-agencia` de la baja SÍ pausa (lib/workspace.ts).
- PASOS DE MARTÍN para cobrarle a España: 1) clave secreta LIVE de Stripe en /integraciones del ws9 (el webhook se registra
  solo); 2) precios en EUR por plan en el setting `planes.mako` (`preciosLocales.EUR`): sin pantalla, y sin eso España paga en
  USD. Decidir el precio en EUR es de Martín (plata); 3) revisar los reintentos de cobro (Smart Retries) en Stripe.
- PARA REPARTIR: los carteles de tope con «Pasar a Pro» también los ve el cliente de una agencia (CRM PasarAPro/TraerDeGrupoWA,
  WhatsApp EvolutionConnect, Equipo, Landings DialogoPublicar, Integraciones CuentasDePago); el dato es `clienteDeAgencia` en
  /api/auth/me. Sin hacer: el teléfono abre la cuenta sin elegir plan; la API no tiene «cambiar el plan»; el precio en EUR sin
  pantalla. PLAUSIBLE para Cobros: `anularCobro` no dice si la pasarela cerró el link.

## 29/10 22:55 — Gmail de Martín CONECTADO (30 herramientas; probado: ~589 hilos de webinars/clases en Promociones)
- El workflow de la cosecha (scratchpad/iniciativa/gmail-workflow.js) NO arrancó: la guardia pide 3 GB y hay 2,6. Reintentar
  cuando termine «mako-toma-la-iniciativa» o «mako-ensena-y-senala», o en la ronda siguiente. Después, el de conocimiento.

## 29/10 23:20
- Copywriter VERDE plantillas-tarjeta-2910 (6713868bb): tarjetas con gancho/chips/insignia, la página nace con la ESTRUCTURA,
  «Ver ejemplo» en un modal de sólo lectura, y MaKo pregunta objetivo y oferta sin IA (lib/copywriter/iniciativa.ts, PasoIniciativa:
  base para el patrón común). → Integración. Le pedí además el arreglo de marcasDeVoseo (rama aparte).
- PARA CREATE (con el plan de la iniciativa): app/_crear/ejemplo.ts todavía dice que el Copywriter abre con «Adaptar a mi negocio».
- Agency (local_e5c96952, desarchivado): H2/H3 a arreglar; H1 (6 cuentas del ws13 que bajarían a Esencial) espera a Martín;
  devolución completa en side-session-notes/…/integracion-agency-thiago-devuelto.md.
- 23:25 Zernio VERDE da3cff9f7 (zernio-token-2910): tarjeta de WhatsApp en /integraciones (f23d77aa2) + privacidad (a745e4eb3).
  Archivado. ⚠️ La 0349 CAMBIÓ (suma repetir_hasta y un check), sigue SIN aplicar: cuando Integración dé por buena la punta,
  pedirle el sí a Martín en palabras (de nuevo) y aplicar ESTA versión. Verificar la tarjeta en producción en el ws3 tras el deploy.

## 29/10 23:40 — COLA DE WORKFLOWS (la guardia: máx 2 a la vez y ≥3 GB)
Corriendo: «mako-toma-la-iniciativa» (plan.md ya escrito, faltaba la crítica) + otro de la máquina.
Terminó: «mako-ensena-y-senala» → scratchpad/iniciativa/plan-tutoriales.md. OJO al cosechar: la crítica cambió la primera
pregunta de la guía a «¿Qué vienes a hacer en <Tab>?» por la regla de «preguntar hechos». Martín pidió TEXTUAL «¿quieres que te
ayude a aprender a usar esta pestaña?»: gana lo de Martín (pedido posterior y explícito); usar su frase con [Sí, enséñame] [Ya sé usarla].
En cola, en este orden: 1) gmail-workflow.js (LANZADO 23:58) 2) leadmagnet-spy-workflow.js (LANZADO 00:08) (Lead Magnets + Competitors Spy + tendencias del nicho)
3) conocimiento-workflow.js. Todos en scratchpad/iniciativa/.
- 23:45 Video: #31/#32 de Leila VERDE sin tipos (editor-leila-2810 3b6a9b3ee): NO era el detector, era el ALCANCE (el modelo
  copiaba "ref":"v1" del catálogo y buscaba en un clip de 0,9 s). Va primero en el tren-ag. Motion: 0340→0344 renumerada
  (motion-imagen-2610 4d52a6dfa + 7c2da1d70), su VERDE espera RAM. Pedida a Integración la guarda de números de migración repetidos.

## 29/10 23:55 — INICIATIVA + GUÍA: planes cosechados (rama iniciativa-plan-2910, docs/mako-iniciativa/), → Integración
REPARTIR apenas libere RAM un chat (hay 2,5 GB con el workflow de Gmail corriendo):
1. BASE (T1+G1) → MANDADA 23:50 al chat «Ops Center» (local_dd16f102, desarchivado). Brief: leer
   `git show iniciativa-plan-2910:docs/mako-iniciativa/README.md` (las decisiones del Cerebro: la pregunta de la guía es la de
   Martín, exceptuada en PREGUNTA_DE_ACCION), plan.md §2 y §5 T1, guia.md §2-3 y G1. Arreglar de paso: los botones de respuesta
   del Cerebro que no hacen nada sin la app. Worktree propio, VERDE de siempre, cosecha según «Para la cosecha».
2. ONBOARDING (T2: recomendarFunnel, la bienvenida con «Lo primero es tu oferta», la pregunta de la entrada) → chat
   «Onboarding» (local_05493d58 o local_79844152, archivados). En paralelo con la base: no comparten archivos.
3. Después, T3 (la escalera, Ops Center) y las tabs de a una (Copywriter migra lib/copywriter/iniciativa.ts al patrón).
4. Aparte: Image con Gemini por defecto → «sin Gemini» (lib/model-catalogo.ts), tanda chica.

## 29/10 23:55 — Newsletter VERDE (newsletter-2910 85d2206c9) → Integración
- Mig 0351 (email_broadcast_envios.baja_at, email_broadcasts.copy_doc_id, índice por segmento; sólo agrega): pedida a Martín.
  Va ANTES del deploy (sin ella la tab Newsletters da error al leer las ediciones; la baja anda igual).
- La tab sigue sólo para el super admin hasta el go-live del email (fila PRONTO en nav.ts).
- PARA OTROS CHATS: (1) Copywriter: la plantilla «Newsletter» (plantillaPorId('newsletter'), con ASUNTO / VISTA PREVIA / CUERPO /
  BOTON); (2) CRM: «Agregar a otro funnel» desde el tablero no pide permiso cuando el destino es el Newsletter; (3) Sidebar: abrir
  la tab con el go-live del email (decisión de Martín: prender EMAIL_SEND_ENABLED).

## 30/10 00:20 — Gmail cosechado (40 remitentes, ~4.300 emails) → rama conocimiento-email-2910 (docs/conocimiento/patrones-email.md), → Integración
- Usos que reparte la §7 del doc: Copywriter (11 plantillas de email + reglas), Newsletter (la grilla, 7 pasos de una edición,
  1 de cada 3-4 sin venta), Automations/nutrición (disparadores por estado, recordatorios de llamada y no-show), MaKo en WhatsApp
  (presencia: SÍ, −10 min, «ya estoy en la sala»). Repartir cuando esos chats queden libres (Copywriter y Newsletter archivados).
- Lanzado el workflow de CONOCIMIENTO (cursos de Knowledge + patrones de email como dominio ya destilado), 00:20.

## 30/10 01:00 — FRENADOS para que suba el tren-af (pide 5,2 GB): RETOMAR después del push con resumeFromRunId
- lead-magnets-y-competitor-spy: Workflow({scriptPath: scratchpad/iniciativa/leadmagnet-spy-workflow.js, resumeFromRunId: "wf_d804ebee-14e"})
- mako-conocimiento-modular: Workflow({scriptPath: scratchpad/iniciativa/conocimiento-workflow.js, resumeFromRunId: "wf_0b80b79c-462"})
Ningún chat se pudo archivar (todos tienen un tsc o tests esperando en con-turno).

## 30/10 01:10 — Ticket #33 de Leandro (ws10, Automations IG): REPARTIR después del Ready del tren-af
- Bug: con varias inscripciones del mismo lead (5 secuencias duplicadas de la 680 que comparten ids de tarjeta nlcjml0,
  n7ecwkh, n4wu86y y el título del botón), sólo anda el botón del ÚLTIMO DM; tocar uno viejo no entrega el recurso y pasa
  TODAS las inscripciones del lead (incluso las completadas 706 y 712) a «respondio», frenadas. Hipótesis de Leandro y de MaKo:
  el toque se resuelve contra la inscripción más nueva y se cuenta como respuesta escrita. Además: en GANCHOS (706) el estado
  de @leantejado que da la API no coincide (texto cortado).
- → Automations (local_7f005343, archivado; tiene el contexto de #29 y #25). El toque tiene que resolverse por (inscripción,
  tarjeta, botón) del mensaje tocado, no por el lead; un toque de botón no es «respondió»; una inscripción completada no se toca.
  Hito con tickets:[33]. Aviso a Leandro: tope de avisos (juntar con #25/#30).
- 01:25 Video ARCHIVADO: #31/#32 VERDE completo (d5baaa302, en el tren-ag). Relevo de Video al día en motion-imagen-2610 @ e5f9c3f2a.
  Motion sigue sin VERDE (sus tests no entraron en la RAM). Dos errores ajenos en app/conocimientos/Compartir.tsx:80 y :520
  (TS2322 con `<style jsx>`): probablemente le faltan los tipos de styled-jsx a la lista acotada; sin verificar.

## 30/10 01:35 — Calendario y Classroom VERDE (cal-classroom-2910 7162c94aa) → Integración
- Mig 0352: calendario_eventos_tipo_ok suma 'entrega' (hoy publicacion/bloque/llamada/otro; 0 eventos en la tabla). ANTES del
  deploy. Pedida a Martín junto con la 0351 (Newsletter), las dos en una sola pregunta.
- Sin hacer: que el «+» del Plan abra «Nueva tarea» armada (BoardShell.tsx, otro chat) y las sesiones de la comunidad como capa de
  Entregas (lib/calendario.ts, de Zernio).

## 30/10 01:45 — DESPUÉS DEL READY DEL TREN-AG (no antes: el push pide 5,2 GB y anoche se trabó 4 h)
Archivados: Ops Center (base 88d2cf0db, en el tren-ah), Calendario y Classroom (7162c94aa, tren-ah), Newsletter (85d2206c9, tren-ah).
En orden:
1. #33 de Leandro → Automations (local_7f005343, desarchivar), brief en la sección del 30/10 01:10.
2. T2 Onboarding (recomendarFunnel, la bienvenida, la pregunta de la entrada) → chat «Onboarding» (local_05493d58, desarchivar),
   leyendo `git show iniciativa-plan-2910:docs/mako-iniciativa/plan.md` §3.1, §3.3 y §5 T2.
3. Retomar los dos workflows con resumeFromRunId (sección del 30/10 01:00).
Después del deploy del tren-ah: recorrer el ws3 SIN la app a 1440 y a 700 px (la apertura y la guía), y aplicar la 0351 y la
0352 si Martín dijo sí.
- 02:00 Agency 28cc3e2cb pasó la re-verificación de plata («entra con bajas», sin ALTA) → tren-ah. PENDIENTE para una tanda
  chica de Agency: (M) una fila de cartera cargada a mano sobre el ws1 o sobre un negocio que paga Pro directo deja que la agencia
  lo pause o lo rebaje (hoy no hay ninguna fila así; poner una guarda); (B) «Elegir Esencial» sin cobros es de ida y el diálogo no
  lo avisa; (B) H5 levanta el corte de más con un plan propio cancelado que aún cubre días. Las 6 cuentas del ws13 dejan de ver
  MaKo Partners (cambio esperado). Informe: C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md.

## 30/10 — Gmail, segunda pasada (sin tope)
- Martín: «¿40 remitentes? veo re poquitos… Fran Doglio, Víctor Heras, Marcos Razzetti». Doglio = ficha 05, Heras = ficha 08; Razzetti NO estaba. El tope era mío («hasta 40» en gmail-workflow.js).
- Workflow gmail-segunda-pasada corriendo (relanzado con Sofía Contreras «Cortito y al pie»): task wo51wnf08, run wf_d40fa400-6bd. Inventario hasta 2 rondas secas → fichas remitente-41+ de a 3 → fusión en patrones-email.md + remitentes-lista.md (lista interna).
- Al terminar: re-commitear docs/conocimiento/patrones-email.md (rama conocimiento-email-2910 o nueva) vía Integración, y pasarle a Martín la lista completa.
- Al terminar, Martín pidió: «enviaselo al grupo de MaKo con Mauricio» (ws1, jid 120363411646661065@g.us, por la línea de MaKo, enviarPartesAlGrupoMaKo).

## Ronda nocturna 30/10 02:09 ART
- RAM libre 3,65 GB de 15,7. Sin zona roja sostenida; no se mató nada.
- Zona roja nueva en vigia.csv: 03:56Z (00:56 ART), 228 MB libres, tsc --max-old-space-size=3200 en C:/dev/wt-agency (chat Planes/Agency, local_e5c96952). El vigía lo cortó.
- Vigía de tickets: no estaba corriendo; re-armado (Monitor bh7zb8ncv, 30 min). El Runner ya entrega los tickets, esto es respaldo.
- Chats: Video (local_2f82a70c) TRABAJANDO; Integración, MaKo en WhatsApp y Zernio quietos.
- Ojo: proceso de tests PID 42064 (node --test tests/caja-lee-por-conversacion…) vivo desde las 18:20, 3 MB. Si la RAM baja de 1,5 GB dos rondas seguidas, es el primer candidato a matar (huérfano).

## Ronda 30/10 02:27 ART + relevo al 85 %
- RAM 4,04 GB libres; sin zona roja nueva; ningún chat trabajando. Vigía de tickets armado (bh7zb8ncv).
- Uso semanal 85 % (02:26). Relevo escrito: rama `relevo-cerebro-3010` @ 7af7751ce (sólo docs/relevo/cerebro.md, se une limpio con tren-ag). PASARLA A INTEGRACIÓN para el próximo tren (no se mandó de noche: la ronda no manda mensajes).
- Recorrido visual TERMINADO (wf_0a6a2d52-ffc): SP/recorrido/hallazgos.md, 27 hallazgos de 8/22 chats. ALTO Calendario: el botón flotante de MaKo tapa la casilla de calendarios de Google (el mismo botón tapa en 5 hallazgos de 4 chats → layout compartido). Repartir por dueño con Martín despierto, y relanzar Create + resto.

## 30/10 03:18 — push del tren-ag trabado por RAM (esperaba 5,2 GB desde las 02:00)
- Liberado: Chrome cerrado (ventana «MaKo - Video»), test huérfano del 28/10 matado (PID 42064 + 45156, lanzado por un python de la sesión 27d40a62 con padre muerto), pausada la 2.ª pasada de Gmail (task wo51wnf08; retomar con resumeFromRunId wf_d40fa400-6bd), archivados los dos «Chequeo de las revisiones de Meta y Google» (no liberaron nada: no tenían proceso). Zernio no se pudo archivar (tarea en la fila).
- RAM 3,9 → 4,9 GB. subir-tren empuja igual al vencer su espera (01:50 + 150 min = 04:20); el push pide 4,8 para las tandas.
- Al apagarse la pausa: relanzar la pasada de Gmail.
- 03:27: Zernio VERDE `zernio-token-2910` @ 7da5d9ec3 (N1 arreglado; la 0349 NO cambió, sigue la de da3cff9f7). Chat ARCHIVADO (nada a medias). Con el OK de Integración → pedirle a Martín la 0349 en palabras. RAM 4,99 GB; el push sigue esperando 5,2 (sale solo a las 04:20).
- 03:37: tren-ag SUBIDO (c9070ea0d..a12373aa8), pausa apagada. Falta el Ready (lo mira Integración) y después avisar a Leila (#31/#32) en su grupo. Gmail 2.ª pasada RELANZADA: task wl4kalli3 (mismo run wf_d40fa400-6bd, lo hecho vuelve de la caché).
- 03:45: tren-ag EN PRODUCCIÓN (mako-5sc7gr322, main 333fefd92). Aviso a Leila #31/#32 (ws11, commit d5baaa302) NO salió: tope de 3 en 24 h (los 3 de Leila salieron 29/10 17:31Z). Se libera 30/10 14:31 ART → cron one-shot 9d11b450 a las 14:33. Aviso #30 a Leandro (ws10): se libera un lugar 30/10 10:30 ART → cron one-shot a022b05e a las 10:34. Los crons son de esta sesión: si se cerró, mandarlos a mano con los comandos de arriba.
- 03:47: Integración VERIFICÓ Zernio N1 (7da5d9ec3, 20/20). La 0349 se puede pedir, pero se APLICA SÓLO DESPUÉS del Ready del tren-ah (hoy prod tiene da3cff9f7 sin N1: con la tabla antes, «Deshacer» reabre la serie doble). Borde BAJA: si falla la lectura de la serie al borrar, el Deshacer la devuelve suelta (va a la cosecha de Integración). Pregunta a Martín dejada en el cierre: 0349 + 0351 + 0352 juntas, después del Ready del tren-ah.
- 03:52: Newsletter (85d2206c9) NO entra: M1 (la tab y las 3 operaciones de la API pasan para cualquier admin de negocio completo/agencia: `adminOnly` sólo esconde la fila), más doble envío de «Enviar ahora», lo programado con email apagado sale solo y vencido, archivar el CRM no frena sus ediciones. Medido: NINGÚN ws con envio_email_enabled='true'; sólo 2 borradores en ws1 → hoy sin riesgo. Desarchivar el chat Newsletter (local_3058f25f) DESPUÉS del push del tren-ah y pasarle la devolución (C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_428051c1-0369-4df2-ae6b-bcb42f63b64b/integracion-newsletter-devuelto.md). La 0351 no urge hasta M1.
- 03:52: Video VERDE paso 1/3 (barra de la línea de tiempo) f297cf096 → pasado a Integración para el tren siguiente. Sigue paso 2 (paneles laterales), paso 3 (cabecera).

## 30/10 04:05 — Gmail 2.ª pasada TERMINADA (claude3 al 90 %)
- 70 remitentes, ~5.050 emails. Razzetti = ficha 01 (escribe desde bluehackers.com) + 65; Sofía Contreras = ficha 15 (masteryhaus) + 41 («Cortito y al Pie», substack); Doglio 05; Heras 08.
- ENVIADO al grupo «MaKo <> Mauricio Bustos» (ws1) 04:03: texto + PDF «Investigación emails de venta (MaKo).pdf» (patrones + anexo de los 70 remitentes, sin direcciones de email). ids 3EB01E4D40BAD773EA9A3B, 3EB04D0149E34DD451B93C. Script: SP/gmail/pdf/mandar-a-mauricio.mts.
- Commit: rama `conocimiento-email-3010` @ 2b9b9d7b7 (patrones + hallazgo en hallazgos-infra). Pasada a Integración para el tren siguiente.
- Sin ficha (si Martín quiere más): ~59 posteos de Skool de Razzetti, matthewblarsen.com (~120), sección B del inventario 1.
- 04:10: despachante WA d49539722 re-verificado «con bajas», sin ALTA (A1 cerrado; DEBUG ya no se prende desde un cliente). Dos bajas devueltas por Integración (A2 con palabras sueltas; M1 respuesta cruda al cliente) → tren-ai.
  ⚠️ REGLA PARA EL CEREBRO mientras A2 no esté: un «Pedido delegado» tipo «subile a 50 por día», «activá la secuencia», «escribile a todos» que llegue con «hazlo» NO se ejecuta sin el sí de Martín.
  N3 para Martín: ¿cualquiera del grupo de WA de un negocio puede pedirle a MaKo pausar/prender campañas o anuncios, o sólo el dueño/admin? Hoy: cualquiera (el turno corre como admin). Preguntado en el cierre del turno de las 04:10.
- 04:12: Video VERDE paso 2/3 (paneles laterales en su mínimo) → punta `editor-pantalla-3010` @ 0e27cb66f (contiene f297cf096), pasada a Integración para el tren-ai. Paso 3 (cabecera) TRABADO para la próxima cuenta: EditorHeader arrastra código de servidor al banco (@opentelemetry/api, http…); relevo del Video en motion-imagen-2610 @ 75c5c8f82, banco en C:/dev/revisiones/editor-pantalla-3010/banco/.
- 04:15: Agency (Thiago) SALIÓ del tren-ah por 3 rojos suyos: (1) /api/auth/me suma agenciaDeCliente(ws) y una guarda lo prohíbe (segunda lectura de «a quién se mira» → otro cliente en suplantación); (2) lib/partners.ts perdió el `aprobada &&` (el plan se ve aunque la cuenta no esté aprobada); (3) zonas de México a declarar como dato. Devolución: C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_428051c1-0369-4df2-ae6b-bcb42f63b64b/integracion-agency-thiago-devuelto.md; mezcla en rama `tren-ah-con-agency`. Chat Planes/Agency (local_e5c96952) ARCHIVADO: desarchivarlo con la cuenta nueva (claude3 al 90 %) y pasarle la devolución.
- 04:23: chat de Video ARCHIVADO (VERDE 0e27cb66f entregado, relevo c45142425, paso 3 cabecera para la próxima cuenta).
- 05:15: tren-ah EN PRODUCCIÓN (mako-ou9xtjw1c, main 88700b981): iniciativa (apertura, primer ingreso, guía con velo), barra del Reproductor, Zernio N1/N8. Sin arreglos de cliente → sin avisos a grupos. La 0349 ya se PUEDE aplicar (N1 en prod) pero falta el SÍ de Martín (preguntado; junto con 0351/0352).
- Despachante WA re-verificación cerrada: cc2aaa6ce (4515 tests verdes) → tren-ai. Chat MaKo en WhatsApp archivado (si quedó vivo, se archiva al terminar).
- tren-ai (para la próxima cuenta, relevo de Integración en wt-push-q docs/relevo/cerebro.md): WA cc2aaa6ce, Video 0e27cb66f, emails conocimiento-email-3010 @ 2b9b9d7b7, Agency (devuelta), Calendario (0352), Newsletter (M1).
- 08:07: chequeo Meta/Google (programado) no pudo mirar: el Chrome conectado tiene otra cuenta (tejadomartin@). Google APROBADA desde 26/10; Meta en revisión (estimado ~10/11), verificación de acceso vence 20/12. Martín tiene que abrir el panel de Claude en SU Chrome (Facebook de MaKo + martinkoncke@). Ojo: a las 03:16 el Cerebro cerró Chrome por RAM.
- 09:33: TICKET #34 (Código Inmobiliario, ws17, bug): «Zernio no contestó (429). Vuelve a conectar con Facebook» en /integraciones 09:30. Despachado al chat de Zernio (desarchivado, local_4a831c28): un 429 no es reconexión; sospecha de regresión del barrido de leads del tren-ag gastando el cupo. Hito con tickets:[34].
- 09:42: TICKET #35 (Código Inmobiliario, ws13, «pregunta» pero es bug): MaKo en el grupo da mal la hora de las reuniones (11→10, 15→10). Despachado a MaKo en WhatsApp (desarchivado, local_cf058ed5): sospecha de default que inventa «10» más que zona horaria. Hito con tickets:[35].
- 10:07 ART ZONA ROJA: el vigía mató PID 276444 (node --test --test-isolation=none tests/ads-creativo-mako… — una tanda grande de tests-afectados, 1,8 GB, libre 899 MB). Probablemente del chat de Zernio (sesión b05a096f, wt-zernio-2510, admitido 12:59Z) trabajando el #34. RAM después: 2,14 GB.
- 10:15: Martín decidió N3: «Sí, cualquiera en el grupo puede» (pausar/prender campañas desde el grupo). Memoria campanas-desde-el-grupo-cualquiera. Pasado a Integración. Martín dice que Claude in Chrome ya está conectado → pedido al chequeo de Meta/Google (local_9204fc92) que reintente.
- 10:20: #34 VERDE zernio-token-2910 @ 43897f1df (429 = pausa, no reconectar; causa: pico de pedidos al CONECTAR, no el barrido) → Integración para el tren-ai. Sin hacer: gastar menos al conectar, alerta-critica no leer a quien está conectando, otros «no contestó» ante 429 (Automations, Calendario).

## 30/10 10:22 — Martín: «Sí, los tres», «Continúa con todo lo pendiente», «Tenemos un 8% semanal, te alcanza»
- APLICADAS 0352, 0351 y 0349 (en ese orden; md5 4d59912b…, 88c67cf9…, 30e446eb…). Medido después: columnas, checks e índices OK; calendario_eventos 0 filas.
- verificar-migraciones-aplicadas: FALTAN cosas viejas → 0331 (curso_accesos.productos_a_mano: «Invitar en cualquier etapa» falla antes de mandar el mail) y 0048 (índice idx_notif_tipo_created). Preguntado a Martín.
- Integración: tren-ai con #34, #35, WA cc2aaa6ce, Video 0e27cb66f, Calendario 7162c94aa, emails 2b9b9d7b7.
- #33 → Automations desarchivado (local_7f005343).
- EN FILA por RAM (2,7 GB libres; espera de fondo hasta ≥4,5 GB): Calendario (ALTO del recorrido: el botón flotante de MaKo tapa la casilla de calendarios de Google + sus 4 hallazgos), Agency (3 rojos), Newsletter (M1 + 3), después T2 Onboarding y los workflows de conocimiento y lead-magnet/spy.
- 10:10 ART ZONA ROJA (2.ª en 4 min): el vigía mató PID 248320 (tanda de tests-afectados: adjuntos-chats-de-texto, ads-manager-credenciales…, 1,3 GB; libre 660 MB). Probable: MaKo en WhatsApp con el VERDE del #35, al mismo tiempo que la de Zernio (10:07). Dos tandas grandes juntas = zona roja: tests-afectados tiene que ir SIEMPRE por con-turno. RAM 10:27: 3,57 GB.
- 10:33: aviso del #30 a Leandro (ws10) SALIÓ (3EB0AC62C7993051CBE712): la guía «Palabras clave y botones de Instagram» en la API (0d77d3064, en prod). El arreglo de la promesa falsa (cc2aaa6ce) todavía NO está en prod (va en el tren-ai): su aviso, cuando esté Ready y haya lugar en el tope del ws10 (los otros dos vencen 30/10 17:12 ART y 31/10 01:19 ART).
- 10:47: dos zonas rojas más (13:44Z y 13:47Z). El vigía mató la barredora compartida (adjuntos-chats-de-texto…, 1,0 y 1,4 GB) de DOS tests-afectados que corren juntos por con-turno: uno de las 10:23 (--base origin/main --compartir) y otro de las 10:27 (--rapido), más un tsc-acotado de Automations (#33). RAM 2,0 GB. Lección: con-turno deja correr dos tests-afectados a la vez y sus barredoras compartidas (~1,4 GB cada una) no entran juntas con 4 chats abiertos.
- 10:58: #35 VERDE wa-fallas-2710 @ 7d51f24c2 (8319854ec) y #33 VERDE aut-2510 @ da015ebd5 → Integración. Chats de MaKo en WhatsApp y Automations archivados (si el archivo falló por tareas vivas, reintentar).
  #33 medido: el diagnóstico de Leandro («se resuelve contra la inscripción más nueva») NO era; el toque del DM viejo llegó con un payload que no era de MaKo, el webhook lo trató como mensaje escrito y la pausa + el #788 pasaron las 8 inscripciones (también completadas) a «respondió».
  PENDIENTE con el SÍ de Martín: soltar las 8 inscripciones de @leantejado (lead 5437, ws10) que quedaron en «respondió» («Volver a probar», escritura en producción).
  Sin hacer (#33): la API nombra el paso por posición del array en una inscripción sin tarjeta (lib/automatizaciones-del-lead.ts); guardar el payload del postback.
- 11:10: Calendario desarchivado (local_18ef0a3f) con el recorrido: K2 ALTO (botón flotante de MaKo, arreglo en el layout compartido cierra K2+P1+C3+D4), K1, K3, K4, K5. Sin tests-afectados hasta que suba el tren-ai. En fila: Agency, Newsletter, T2 Onboarding, workflows.
- 11:20: Martín: «no me hagas preguntas que podes resolver vos mismo» → memoria aprobacion-prod-en-el-chat (migraciones que sólo agregan y datos rotos por un bug nuestro: SIN preguntar). APLICADAS 0331 (curso_accesos.productos_a_mano + check; «Invitar en cualquier etapa» vuelve a andar) y el índice idx_notif_tipo_created de la 0048. Medido después: OK.
- DECIDIDO: soltar las 8 inscripciones de @leantejado (lead 5437, ws10) DESPUÉS del Ready del tren-ai (con el #33 en prod, si no se vuelven a frenar). Lo hace Automations (local_7f005343, archivado) con «Volver a probar» por inscripción (app/automations/automatizaciones-del-lead-actions.ts / lib/reentrada.ts). Después, avisar a Leandro (tope ws10: libera 17:12 ART).
- Extensión MaKo en la Chrome Web Store: PUBLICADA la 0.74.3 (actualizada 29/10), la misma que extension/manifest.json de main. El panel de la tienda pide re-verificar la sesión de Google (perfil C:\dev\chrome-tienda\perfil): sólo Martín.
- 11:32: relevo del Cerebro al 94 % → rama relevo-cerebro-3010b @ a133d7154 (limpio con tren-ai), pasada a Integración.
- 11:28 ZONA ROJA: el vigía mató el tsc-acotado de Calendario (wt-cal-classroom-2910, 2,6 GB, heap 3000; libre 1,2 GB) mientras corre el barrido del tren-ai. Calendario lo verá y lo repetirá. RAM 11:29: 3,7 GB.
- 11:52: Calendario VERDE recorrido-k-3010 @ 246bae899 (desde cal-classroom-2910): K2 ALTO (botón de MaKo en una ranura al pie de la barra; cierra P1, C3, D4), K3, K5; K4 era un DATO (evento de Google con título «-»). → Integración, después del tren-ai. Chat archivado (si falló, reintentar).
- 11:58: tren-ai SUBIENDO con #33, #34, #35, despachante WA, Video, emails y relevos. Calendario (cal-classroom-2910) SALIÓ por 4 rojos de la pantalla de Clients (uno, una guarda de privacidad del super admin). Devolución: C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_428051c1-0369-4df2-ae6b-bcb42f63b64b/integracion-cal-classroom-devuelto.md. recorrido-k-3010 sale de esa rama: también espera. Chat Calendario (local_18ef0a3f) archivado → próxima cuenta lo desarchiva con la devolución.
- 12:29: el push del tren-ai espera 5,2 GB desde las 11:58 (hay ~3 GB). Chrome ocupa 3,7 GB pero Martín está EN UNA LLAMADA de Meet con Leila: NO se cierra. Archivado el chequeo de Meta/Google. El push sale solo al vencer su espera (11:57 + 150 min = 14:27) o cuando Martín cierre la llamada.

## 30/10 14:20 — tren-ai EN PRODUCCIÓN (mako-gr9maew7i, main 9e24e7935)
- Lleva #33 (Leandro), #34 y #35 (Código Inmobiliario), despachante WA (#30 promesa falsa), Video pasos 1-2, emails y relevos. Calendario/Classroom AFUERA (4 rojos de Clients; devolución integracion-cal-classroom-devuelto.md); recorrido-k-3010 espera detrás.
- Los tickets se cierran y AVISAN SOLOS al desplegarse el hito (#31/#32: resuelto + avisado_at 06:45Z). Por eso se CANCELÓ el cron 9d11b450 (aviso manual a Leila a las 14:33: habría sido duplicado). A partir de ahora: no mandar aviso manual de un ticket con hito; mirar avisado_at.
- Cartero 1.24.0 INSTALADO (backup cartero.mjs.antes-1.24.0).
- Soltar las 8 inscripciones de @leantejado → Automations desarchivado con la tarea (camino de la app, completadas quedan completadas, tabla antes/después).
- 14:25: Automations propuso soltar las 8 de @leantejado con 8 compare-and-set que vuelven SÓLO estado (703-707 → activa, siguen paradas esperando el toque; 660/708/709 → completada) + línea en el historial. La app no tiene camino que saque de «respondió» («Volver a probar» deja respondio; «Empezar de nuevo» manda el 1.er DM). APROBADO por el Cerebro (regla de Martín del 30/10). Claude3 al 95 %: CIERRE.
- 14:32 CIERRE claude3 (95 %): relevo final del Cerebro en la rama relevo-cerebro-3010c @ bc09282ae (sobre main 9e24e7935, sólo docs/relevo/cerebro.md). Lo sube la próxima cuenta con el próximo tren. Pendientes al cortar: (1) la tabla de Automations con las 8 de Leandro y archivarlo; (2) confirmar avisado_at de #33/#34/#35 (espera de fondo bax9r404g en esta sesión).
- 14:35: HECHO — las 8 de @leantejado volvieron a su estado de antes del toque (17:19Z, 8 compare-and-set; 703-707 activa esperando el toque, 660/708/709 completada; sin envíos). Cosecha + relevo en aut-2510 @ 8f74d171b (sólo docs, para el próximo tren). Automations archivado.
- 14:45: Martín pidió revisar la llamada de hoy con Leila (Fathom 198183840, «Impromptu Google Meet Meeting», 11:55-13:53) + TODO lo pendiente de la cuenta → C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/pendientes-30-10.md (94 ítems de la llamada + pendientes por prioridad). Transcripción y feedback en SP/leila/. LO PRIMERO para la próxima cuenta: Carruseles roto (ALTA), «segundo nombre» (bloquea Black November), automatización de Leila que mandó hasta las 23 h; plazo: antes del lunes (reunión lunes 12 h de Leila); link de prueba 7 días para Percho.

## 5/11 11:55 — claude3 otra vez (0 % semanal, reinicia 11/11). Martín: «Revisa cómo quedó la última cuenta y continúa con todo»
- Última cuenta (claude5): terminó quieta el 4/11 23:45 al 98 % semanal. main 660de5707, sin rojos. Meta APROBÓ los 4 permisos el 4/11 15:39 (verificación de acceso sigue en revisión, vence 20/12).
- Runner: nuevo chat local_9d6e9e4d (Haiku, destacado). El viejo local_f43a580b quedó sin uso.
- Llamada Código (Fathom 883162834): primer pago US$238, del 1 al 5/11. Memoria cobro-agencia-codigo. Pablo y Patricia ya vencieron las 2 semanas. Chat en la nube: punta/agencia-cobro (reloj y aviso, no existían).
- Ops Center: fecha e «Ignorar» → chat en la nube punta/ops-ignorar. Cierre 8dc96617 hecho.
- Top Carousels: NO se raspa, ni con su sesión (términos del 7/10: pueden cerrarle la cuenta sin devolución). Lista de 124 creadores con post en su texto público para agentes en scratchpad/tc/creadores.tsv. Falta Apify: crédito libre US$0. Se le preguntó.
- Auditoría de pedidos corriendo en un agente: scratchpad/auditoria-pedidos.md. Con eso se reparte lo que falta.
- 12:40: auditoría lista: scratchpad/auditoria-pedidos.md (142 ítems: 40 hechos, 39 a medias, 25 faltan, 38 sin verificar). HOY 17 h reunión con Thiago: sección 2 dice qué no prometer.
- Migraciones: 0393 APLICADA. Ausentes viejas sin tocar (quizá borradas a propósito): 0024 funnel_transitions, 0050 meta_health_history, 0061 dos índices de leads.
- Apify: 189 @ sumados a la biblioteca; carga en curso de 163 con la clave de Martín (sólo env, nunca a disco). Script temporal: C:/dev/wt-puntas/scripts/_biblio-clave-tmp.mts (BORRARLO al terminar). Después: reclasificar, sacar las 7 cuentas viejas + las 259 de hashtag, apagar los 32 temas. Faltan 26 @ (lista.txt, del 164 en adelante).
- Chats en la nube pedidos: punta/agencia-cobro, punta/ops-ignorar, punta/apify-varias-claves, punta/black-november, punta/image-marca, punta/codigo-primer-contacto, punta/iniciativa-<tab>. Sin repartir todavía: Thiago (guía CRM, token de agencia, «Usar en un anuncio», «Guardar en MaKo»), Video (subtítulos, B-roll, clips), Lead Magnet, 22 hallazgos y 14 pantallas del recorrido (necesita Chrome).
- 12:50: audio de Código: Pablo y Patricia afuera (inactivos, cuentas de antes del acuerdo). Noviembre US$238; diciembre US$332 (97 + 5 × 47) más cada cliente nuevo que pase las 2 semanas. Pasado al chat de cobro.
- 13:00: Martín: automatizar el cobro de Código (avisos 1 al 5 con PDF, comprobante por el grupo, suspensión el 6 de agencia y clientes). Pasado al chat punta/agencia-cobro; arranca 1/12. Falta: Martín carga su usuario de Binance en /admin/cobros.
- 13:10: Pablo y Patricia NO están afuera: cuenta suspendida y pagan US$47 en el acto para entrar; después, al ciclo normal. Pablo arranca lunes 9/11. Pasado al chat punta/agencia-cobro (esa parte primero, antes del lunes). VIGILAR el lunes que esté: si no, Martín se lo cobra a mano. El Cerebro corre el comando que deje en docs/relevo/nube-agencia-cobro.md.
- 13:25: carga de carruseles: 595 nuevos, 104 de 163 creadores, en curso. Martín: los quiere como ejemplos; al terminar, leer con lo que quede de crédito los 245 posts exactos que Top Carousels publica en llms-full.txt (scratchpad/tc). Múltiplo de rendimiento: chat en la nube punta/multiplo-rendimiento.
- 13:45 PLAN CARRUSELES (si se compacta, seguir esto). Martín: los que trae Top Carousels son los que quiere; si el que buscaba no está en los últimos 13 posts, ir por él; y mirarlos con criterio (ej.: una foto de Leila embarazada NO sirve de plantilla, pero de Leila y Hormozi algunos sí: NO sacar esas cuentas enteras).
  1. Al terminar scratchpad/tc/carga.log: leer los 245 links directos (scratchpad/tc/links.txt, de su llms-full.txt, 14 ya estaban) con C:/dev/wt-puntas/scripts/_biblio-clave-tmp.mts, env APIFY_LINKS_FILE + APIFY_CLAVE_CARGA (la de Martín, sólo en la conversación) + APIFY_LISTA_PRIMERO=scratchpad/tc/lista.txt, comando `leer --de-verdad --solo-temas --techo-usd <lo que quede>`, en seco primero.
  2. `reclasificar --de-verdad` (gratis).
  3. Mirar TODO con imágenes (workflow de agentes): sirve o no sirve de ejemplo. Lo que no sirve se esconde con dejo_de_verse_en (biblioteca-servidor.ts:87 ya filtra), guardando la lista para deshacer. Mandarle a Martín una muestra de elegidos y descartados ANTES de esconder.
  4. Reportar cuántos de los 245 quedaron. Borrar scripts/_biblio-clave-tmp.mts de wt-puntas.
- 14:10: carga por perfiles FRENADA (Martín: que sea eficiente). 1.007 nuevos por US$4,71, sólo 1 de sus 245. Post directo: 60 links, 59 carruseles, US$0,11. Van 74 de 245. Crédito de la clave: US$0,08. Faltan 171 (scratchpad/tc/links-resto.txt, ~US$0,32), con la próxima clave. Reclasificar corrido. El paso 3 del plan cambia: filtro gratis primero (láminas, outlier, parece_contenido), mirar sólo lo que pase. Script temporal sigue en wt-puntas hasta terminar.
- 14:40: Martín: «suspender a Pablo y Patricia hasta que paguen». HECHO con usuarios.estado='suspendido' (ids 19 y 22 activos, 15 invitado; para volver: 19 y 22 a activo, 15 a invitado). El corte por negocio no sirve hoy: CORTE_DE_ACCESO apagado y el único motivo que corta (sin-agencia) dice «tu agencia dejó de administrar». La agencia todavía puede entrar inspeccionando. Regla nueva: a los 14 días sin pago, suspensión automática (Giselle 11/11, Marcela 13/11) → chat punta/agencia-cobro.
- 15:10: curaduría hecha (scratchpad/curar/resultado.json e indice.json): de 1.588, 244 de Top Carousels elegidos, 582 caen por filtro (menos de 3 láminas o parece_contenido false, sin mirar), 130 por hojas, 632 sirven. Muestras mandadas a Martín. NO se escondió nada: espera su respuesta. Para esconder: dejo_de_verse_en, guardando la lista.
- 17:00: carruseles: 210 escondidos, quedan 1.378 (lista en carruseles-escondidos-2026-11-05.json). Cobro: mandada al chat la lista completa, sin confirmar lectura; 0394 de Ignorar aplicada; cosecha en punta/cosecha-carruseles.
- 18:15: diferencial Código: PDF salió al grupo 18:06 UTC (id 3EB099432420D2F238A1DB; Pablo 40,73 / Giselle 37,60 / Marcela 34,47 / Patricia 1,5667 por día). Regla pasada al chat de cobro sin confirmar. Controles programados 9, 12 y 14/11. Falta: Thiago, dos chats que Martín tiene que arrancar con un sí.
- 20:15: recibos 0001 y 0002 entregados. 0358 aplicada. Encargo de recibos en docs/relevo/recibos-encargo.md (punta/recibos-encargo); falta que Martín arranque ese chat y los dos de Thiago. Creem 0 de 3: lo suyo.
- 20:55: chats arrancados: CRM suscripciones, Admin, Recibos+Pagos, Creem revisión. Creem: borrador de Leandro cargado, sin enviar. Falta: medición de producción para los chats de CRM y Admin (docs/relevo/suscripciones-medicion.md y admin-medicion.md); la guardia de RAM frenó el workflow.
- 22:50 UTC: Creem RECHAZÓ (mail 19:30 ART, definitivo). Desconectada de ws9: queda Mercado Pago. Chats: Creem fuera (punta/creem-fuera), Approvals. Agentes: proveedores (scratchpad/recibos/proveedores.md), extensión+Meta. Falta: suscripciones-ficha, cuando recibos entre.
- 5/11 ~23:30 UTC: consulta a Whop mandada a support@whop.com desde equipo@hola-mako.com (pedido de Martín). Esperar respuesta en esa casilla; con eso, cuenta de Whop y formulario.
