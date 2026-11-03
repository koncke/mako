# Lo pendiente al 3/11/2026 (auditoría del Cerebro, cuenta 5)

Salió de leer los pedidos de Martín del 27/10 al 3/11, las ramas sin subir y los tickets abiertos (workflow
`wf_f709de0d-bec`). Es una foto: antes de actuar, se re-mide contra `origin/main`. Nadie corrió tipos ni tests para armarla.
Lo repartido ese día está en `docs/relevo/cerebro.md` → «3/11, ~12:00».

## Subir ya

Medido contra `origin/main` = `12dc54318` (3/11). Nadie corrió tsc ni tests: los verdes citados son lo que dicen los relevos o commits.

**Traba:** el tsc de `brain-docs-0311` y `gurus-0311` no corrió. La guardia de RAM midió 2,9 GB libres con Chrome cerrado y pide 3. Hay que re-medir y correr `node scripts/tsc-acotado.mjs --rama --heap=4096`.

1. **`brain-docs-0311`** (cliente roto, #44). Espera el tsc.
   - **Por qué primero:** el #44 ya figura `arreglado` con «Ya puedes cargar documentos…» y la función no está en prod.
   - **Conflictos:** `lib/funciones-mako.ts` y `app/admin/dev/second-brain/bitacora.ts`. Son agregados de los dos lados: quedan ambos.
   - **Tests:** sumar-documento-second-brain, ops-center-clasificador-app, mako-no-puedo-falsos, ops-center-bateria, api-mako-http, api-mako-rest, archivero-web-leida, onboarding-red-plataforma, ia-pc-segunda-revision, ficha-editar-con-mako.
   - **Después del deploy:** el cron cierra el #44, pero ese negocio no tiene regla de aviso y el ticket no trae hilo. El aviso va a mano.
2. **`guarda-video-fallas-3110`** (17 acciones que no abrían ticket con la base caída). El commit dice tsc sin errores en lo tocado, así que no espera a la RAM.
   - **Conflictos:** `hallazgos-api-mako.md` y el índice, quedan los dos.
   - **Tests:** guarda-por-defecto, no-pude-server.
3. **`runner-servicio-3010`** (traba a Martín).
   - **Orden:** el informe de ramas lo ponía al final porque el cliente no lo ve. Lo adelanto porque hoy a las 14:01 el Runner se negó a armar el cron (`840d77b9`) y los mensajes del Ops Center pueden no estar llegando. Ningún informe dice que esta rama arregle esa negativa: esa sesión hay que mirarla aparte.
   - **Antes de subir:** medir si la 0355 está aplicada y aplicarla si falta.
   - **Sin cubrir:** los tipos de `useCentro.ts` quedaron para Actions (el acotado dio 99) y nadie lo vio en pantalla.
   - **Tests:** cartero-servicio, centro-estado-pc, limbo-al-cerebro, centro-limbo, centro-uso, avisar-antes-de-firmar, cartero-medir, chat-en-el-acto, feedback-2710-tanda1, ops-center-decisiones, preguntas-cadena-y-ask, turnos-enteros, centro-abrir, centro-largos, operaciones.
4. **`gurus-0311`** (#16, #17, #18). Espera el tsc. Conflicto solo en `docs/hallazgos.md`. No se miró en la app.
   - **Tests:** cerebro-referente, second-brain-chat-mako, second-brain-turno, d6b-rutas.
5. **`diseno-web-3110`**. Espera el tsc. Sin conflictos.
   - **Tests:** web-generator-valores, landing-valores-tilvo, editor-web-ui-25-10.
6. **Casi solo docs:**
   - `aut-2510`: a mano, 2 choques en docs. Evita repetir una escritura en producción: main dice que las 8 inscripciones siguen sin reparar y se repararon el 30/10.
   - `crm-bajas-3010`: su relevo trae un pendiente de cliente (ver chat 3).
   - `tickets-leila-0311`: antes actualizar el relevo, dice que falta el tsc y el código ya está en main.
   - `spy-rehecho-3110`: choca en docs, trivial.
   - `pricing-bloqueantes-3010`: tests pricing-modelo, barrido-sexta-datos, sin-chatwoot.
   - `landing-high-ticket-2910`: choca en docs. Test portada-high-ticket.

**No subir** (ya en main o muertas): `crm-ticket39`, `respaldo/crm-ticket39`, `planes-y-regalo-3010`, `ai-avatar-abrir-pro-2910`, `ai-avatar-para-todos-2910`, `limbo-cartel-wip-3010`, `nube/clic-derecho-2710`, `nube/dedupe-indice-hallazgos`, `tren-ai-con-calendario`, `tren-ah-con-agency`, `tren-ae-con-wa`, `wa-fallas-2710`, `mako-inteligente-2710-c4`, `crm-lote-2810`, `origin/infra-tests-afectados`, etiqueta `agencia-avisos-3110`.

**Riesgo de pérdida:** solo existen en esta PC gurus, brain-docs, tickets-leila, runner, diseno-web, guarda-video, spy-rehecho, crm-bajas, pricing, motion, replica-editable, newsletter, desktop-offline y landing-high-ticket. Lo de pagos ni siquiera está en un commit.

## Chats a abrir

**Antes de abrir, para no duplicar:** a las 14:16 el Cerebro ya repartió cuatro cosas, sin entrega todavía:
- Agenda de Código Inmobiliario (#42)
- Grupo y menciones de Leila (#40)
- «mbustos» (#41)
- «No pude copiar» (#36)

El cruce con los tickets lo hice por el nombre. Si esos chats siguen vivos, mandarles el tramo de abajo en lugar de abrir otro.

### 1. Cobros: cuotas (PC)
**PC porque:** el trabajo solo existe sin commitear en esta máquina.

**Brief:**
- **Partida:** worktree `C:/dev/wt-pagos-tramos`, 16 archivos y 302 líneas sin commitear desde el 29/10. Nada está en main. Commiteá antes de cualquier otra cosa.
- **Qué trae:**
  - el «sí» dado 2 horas después ya no pisa una cuota editada a mano en la ficha
  - se rechazan las propuestas de la versión anterior
  - el resumen ya no dice «faltan 300 USD» cuando la diferencia queda en pesos
- **Relevo:** seis defectos de la tercera revisión arreglados. Si el VERDE no salió, faltan el tsc y mandarlo a Integración.
- **Pasos:**
  1. Commit.
  2. Traer `origin/main` (`cobros.run.ts` difiere +27/−64).
  3. `node scripts/tsc-acotado.mjs --rama --heap=4096`.
  4. Tests pagos-tramos y api-mako-plan-tramos.
- **No decidas:** una cuota en pesos cobrada entera, declarada a otra tasa, deja US$100 que la cobranza le reclama a quien ya pagó. Eso es de Martín: dejalo escrito en el relevo.
- **Listo:** commit con main traído, tsc y tests verdes, y en cola de Integración.

### 2. Seguridad, extensión y plugin (PC)
**PC porque:** hay que leer credenciales de producción y publicar con las cuentas de Martín. Si publicar necesita su Chrome, va después de los tsc del tren: los cerró para liberar RAM.

**Brief, tramo A: seguridad.** Partida `origin/claude/stoic-cray-oadprg`. No tiene relevo, el detalle está en `docs/hallazgos-seguridad.md` de la rama. Se hizo en la nube y nada se midió contra la base ni Vercel.
- **Qué trae:**
  - un token sin usuario real deja de valer como super admin en producción
  - cambiar la contraseña cierra las otras sesiones
  - el descifrado exige el tag GCM completo
  - se cierra el SSRF de «crear anuncio desde un link»
  - extensión 0.74.5, que solo atiende a MaKo
  - guarda de claves en el push
- **Pasos:**
  1. Renombrar `0360_sesiones_desde` a 0366: repite número con `0360_spy_miniatura`, sin conflicto de texto.
  2. Listar las credenciales del negocio dueño que queden fuera de `puedeHidratarse`. Desde el próximo arranque dejan de llegar al entorno con un solo `console.warn`.
  3. Dejar `leerSesion` como hoy y subir el resto. El «falla cerrada» invierte una decisión escrita a propósito: con un bache de Supabase todos los clientes quedan sin sesión, y suma una consulta por pedido sin caché.
- **Tests:** sesiones-revocadas, cripto-tag-y-hidratacion, proxy-api-con-extension, extension-origen, claves-en-el-diff, anuncio-link-ssrf, landing-analisis-ssrf, editor-landing-origen, editor-landing-dominios, wa-extraer-072.

**Tramo B: extensión.** Martín: «Publica tu la extension» y «Borra eso de "lo hace martin"» (2/11).
- La tienda está en 0.74.3, el repo en 0.74.4, la rama en 0.74.5.
- El cliente OAuth de Google fue borrado (`deleted_client`).
- Medí si la vuelta a MaKo del scraper (`d69b9c73c`) salió en la 0.74.4: si fue así, no le llega a quien instala desde la tienda.

**Tramo C: plugin, #41.** Martín: «Pusiste "mbustos" donde lo ven todos los usuarios, revisa en toda la app», y que el autor sea MaKo, en su cuenta.
- **Visible para clientes:** `app/_components/TutorialAgente.tsx:45` y `:49`.
- **Pasos:**
  1. Publicar el plugin bajo la cuenta de Martín (procedimiento en `docs/hallazgos-infra.md`).
  2. Cambiar `TutorialAgente.tsx`, `scripts/generar-plugin.mjs` y `plugin/README.md`, y regenerar `plugin/`.
  3. Sacar «Mauricio Bustos» de `public/vsl-assets/mako-cs.html`, `lib/ads-analyst.ts:229,973` y `lib/closing.ts:319`.
- **No borres** `mbustos-digital/mako-plugin`: hay gente que ya lo instaló.

**Listo:**
- seguridad en cola con tests verdes y la lista de credenciales escrita
- extensión publicada, o el bloqueo de OAuth dicho con su paso exacto
- los dos comandos nuevos del plugin instalan y ningún cliente lee «mbustos»

### 3. IA de MaKo: tickets de clientes (PC)
**PC porque:** hay que leer la base (`app_settings`, `mako_doer_conv`).

**Brief.** Partida `origin/main`. Los tickets se cierran con el hito `tickets: [n]` en la bitácora: en el mensaje de un commit no cierra nada.

**#45, Leila Fittipaldi (ws 11).** «Activa la función "Aprende solo" en el Second Brain». MaKo contestó que no existe.
- **El diagnóstico obvio está mal:** `1efb12f08` corrigió `hace[]` en `lib/funciones-mako.ts`, pero eso solo se usa en `lib/cerebro-funciones.ts:71` (capa exclusiva de la plataforma, `lib/cerebro-para-chat.ts:146`) y en `/admin/docs`. `listar_capacidades_mako` no lo devuelve (`lib/api-mako/areas/mako.run.ts:304-308`). Encima, `lib/recomendaciones-senales.ts:427` le recomienda prenderlo.
- **Hacé:** sumar la capacidad con su link en `lib/mako-capacidades.ts` y una familia en `lib/mako-intencion-app.ts`. Opcional: una herramienta para prenderlo con confirmación, reusando la puerta de admin de `app/second-brain/recolector-actions.ts`.
- **Listo:** la frase literal, en un negocio que no es la plataforma, trae la herramienta y MaKo dice dónde está. Test probado rompiéndolo.

**#42, grupo de Código Inmobiliario (ws 13).** «si tenes acceso al google calendar… esa respuesta que diste esta mal». `crear_evento_google` existe (`calendario.def.ts:56`) y solo hay tests de canal app.
- **Primero medí** `google.calendar.refresh_token` en `app_settings` y el rol del que escribe (la herramienta pide admin).
- **Listo:** en el grupo, «crea un evento en mi Google Calendar mañana a las 9» lo propone y, con el sí, queda en Google. Sin conexión o sin rol, dice cuál de las dos falta. Test en canal whatsapp.

**#40, grupo de Leila (ws 11).** «deberías tener acceso a todos los mensajes anteriores y saber cuando un usuario hace mención a un mensaje».
- **Hoy:** memoria de 12 turnos en 14 h más hechos de 7 días (`lib/mako-doer-in.ts:1537`). `citaDelMensaje` solo decide si es respuesta al equipo (línea 933), `textoCitado` no tiene quien lo use y solo entra el audio citado.
- **Hacé:** meter el texto citado al turno y, si WhatsApp no lo trae, buscarlo por `wa_message_id`. Sumar una lectura de búsqueda en el hilo sobre `hiloDelGrupo`, solo de ese grupo y nunca hacia la red gratis.
- **Listo:** citar un mensaje de hace 10 días y que MaKo conteste sobre él.

**Código Inmobiliario, sin ticket.** `crm-bajas-3010` deja escrito: 21 fallos y 10 borradores, «puede ser error nuestro». Investigar y decir qué pasó.

**#43, agencia (ws 13), solo con #44 en main y la decisión de Martín.** «cargar un archivo al second brain de mi cliente marcela»; «Si, una agencia si puede. Inspeccionando» (2/11). El plan está en `brain-docs-0311:docs/relevo/brain-docs.md`.
- **Hacé:** parámetro `negocio` en `sumar_documento_second_brain` con la guarda de `carteraDeAgencia` en el runner, ingesta corriendo como el cliente, lectura de adjuntos de WhatsApp, y tests de aislamiento entre negocios probados rompiéndolos.
- **Listo:** desde el grupo de la agencia se confirma y la fila queda en el negocio del cliente.

**Cosecha de este chat:**
- `docs/hallazgos-ia.md`: `hace[]` no le llega a ningún cliente
- `docs/hallazgos-ticketera.md`: el hito de commit no cierra, y `arreglado` puede quedar antes del deploy
- `docs/hallazgos-comunicacion.md`: el texto citado no entra al turno

### 4. Ops Center (nube)
**Brief.** Partida `origin/main`, después de que entren `gurus-0311` y `runner-servicio-3010`: el primero toca Nuevo chat y el segundo `useCentro.ts`.
- **#36, «No pude copiar».** Causa probable, sin reproducir: `copiar` (`app/admin/operaciones/mandar.ts:177`) solo usa `navigator.clipboard`, y el reporte viene del navegador de Claude. Dale el camino alternativo de `copiarTexto` (`app/m/copywriting/api.ts:77`). Lo heredan `useCentro.ts`, `ChatsMovil.tsx` y `useChatCliente.ts`.
- **Clic en un coach.** «no me tiene que redirigir a ningún lado» y «ya no debería existir la ruta de offer» (2/11). `f353bcbce` sacó el redirect, pero `ElegidoChat` solo admite `{coach:'funnel'}` (`lib/chat-mako-reglas.ts:266`): sin conversación previa el clic no hace nada, y `/offer` sigue entera. `gurus-0311` no lo arregla.
- **Barra.** «Saca Offer y Ads Manager» (2/11). `nav.ts` sigue sin `fueraDeLaBarra`. Martín aceptó dejarla solo si rompía, y ya no rompe. Según la memoria, `nav.ts` lo toca solo el chat Sidebar: si ese chat vive, esto va por él.
- **Nombre.** «ya no se llama cerebro» (1/11). `lib/centro-chats.ts:294` sigue con `'Cerebro'`.

**Listo:**
- con `writeText` rechazado copia igual, y si fallan los dos el aviso dice «cópialo a mano»
- el clic abre el coach sin conversación previa y sin redirigir
- `/offer` no existe
- los tests de esto están probados rompiéndolos y la rama queda lista para Integración

### 5. Spy: el modal (nube)
**Brief.** Partida `origin/main`. Martín, hoy: «sigue horrible en diseño… no me salta el desplegable» y «no tiene absoluto sentido la tab interna de "Pegar un dato"» (3/11).
- `SpyApp.tsx:633` sigue con las dos pestañas y nadie tocó el modal después de que él lo dijo. El #8 figuraba como HECHO por error: corregilo.
- El desplegable está en main (`0aafde481`). Nadie midió por qué no salta: medilo antes de arreglarlo.
- De paso: `podarLecturasCompartidas` existe y no la llama ningún cron (`lib/spy-compartido-db.ts:98`). Es la poda de 30 días del caché compartido.

**Listo:**
- modal sin la pestaña
- desplegable que salta, con la causa escrita
- cron llamando a la poda
- la rama lista para Integración, avisando si no se pudo mirar en pantalla

### 6. Promesas a Thiago (nube)
**Brief.** Partida `origin/main`. Reunión: jueves 5/11, 17 h. Martín: «a ver si prometi algo» (29/10). Fuente: `docs/promesas/2910-llamada-thiago.md`. Su estado es del 30/10 y nadie lo re-midió: empezá re-midiendo.
- **Según ese documento no existen:**
  - «Guardar en MaKo» desde perfiles
  - guía de migrar CRM con token de agencia
  - «Usar en un anuncio» y variar el CTA
  - anuncio y email enlazados en Calendario
  - reservas de Google como etapa
- Thiago no tiene cuenta. Esa alta escribe en producción: no la hagas, avisala.

**Listo, antes del jueves:** una tabla por promesa con «hecha» y su commit, o «no llega» y por qué, y lo hecho en una rama lista para Integración.

### No entran hoy
- **`replica-editable-2810`** («Es super importante»): es la primera cuando se libere un chat. Está a medias y 976 commits atrás. Tiene color y fondo sin efecto en dos secciones. Falta medir íconos, videos y fondos, mirar capturas y probar el chat de punta a punta en tres copias. Tests replica-editable, api-mako-landing-contenido.
- **Emails de avance:** «se le envíe por email los avances» (Joan, 2/11). `lib/tickets-avance.ts` no lo importa nadie, falta el envío por Resend.
- **Ramas con chat pendiente:** `newsletter-2910`, `desktop-offline-t2-2810`, `motion-imagen-2610` (preguntar primero si Motion sigue en pie).
- **Spy con Flow y extensión:** caricatura por competidor y las 50 publicaciones (usan la cuenta o el Chrome de Martín).
- **Resto de producto del informe de pedidos:** AI Avatar, 10 gurús faltantes, onboarding, rediseño, precio en pesos, lista de la llamada con Leila.
- **Esperan a Martín:**
  - aprobar las 4 primeras hojas de Dashboard (frena las 15 restantes)
  - instalar el servicio del Runner
  - portada con valores de Fitlo (aplicarla es publicar)
  - consentimiento de suscriptos de Newsletter
  - webhooks de Mercado Pago y Creem (registro del 31/10, sin re-medir)
  - pago real de prueba y política de reembolso
  - link de Fastlane

## Tickets a cerrar y avisar

Los dos se cierran a mano: el cron no los toma.

**#38, Martín.** Hecha solo la investigación (`docs/funnel-coach.md` §9, `2a31f80c5`). Antes de cerrar, ver si el «link de Fastlane» del reparto de las 14:16 es este mismo pedido.

> Martín, ya investigué Fastlane. Lo que vale copiar para el Funnel Coach: aprender la marca de un solo link, una memoria de lo que funcionó, un catálogo de formatos con nombre, métricas por creativo contra el promedio de la cuenta y una biblioteca de contenido pago y orgánico. Lo que no: cuentas calentadas e influencers de IA. Quedó escrito en el documento del Funnel Coach. Todavía no se construyó nada.

**#39, Brigitte Eberlin (ws 15).** `8f19b1229` arregló la alarma, no la causa: no se reprodujo. El copy dice «falsa alarma» y «no afecta tus datos», y nadie leyó `errores_app` de este ticket. Leerlo antes de mandar. Tampoco se sabe si ese negocio tiene grupo.

> Hola, Brigitte. Si viste el aviso «La pantalla CRM se rompió», era una falsa alarma: la pantalla se volvió a dibujar sola al abrir, pudiste seguir trabajando y no afecta tus datos. Ya corregimos ese aviso. No tienes que hacer nada. Si te vuelve a pasar algo raro, escríbenos por aquí.

**Contestar sin cerrar: #45, Leila.** El informe de pedidos lo da por resuelto («#45–#48 en main»). El de tickets muestra que el arreglo no le llega. Queda abierto hasta el chat 3.

> Leila, tenías razón: «Aprende solo» sí existe y MaKo se equivocó al decirte que no. Lo prendes tú: en el Second Brain, en el Mapa, arriba a la derecha, toca «Aprende solo» y luego «Prender». Aprende de tus conversaciones de WhatsApp con leads y usa tu IA. Ahí mismo ves de qué fuentes aprende y cuánto entró. Estamos corrigiendo a MaKo para que te lo diga en el chat.

**Solo después del deploy de `brain-docs-0311`: #43, agencia.**

> Para cargarle un documento al Second Brain de Marcela: entra a su cuenta desde tu cartera, abre el chat del Second Brain, pega o adjunta el documento y pídele a MaKo «súmalo al Second Brain». Te muestra una tarjeta y, cuando dices que sí, queda guardado. Por WhatsApp todavía no se puede.

## Decisiones que sólo Martín puede tomar

1. **Claves del Estudio.** `docs/hallazgos-seguridad.md` dice que el `.env` de producción quedó publicado en GitHub (`.en-7`, repo `estudio-video`) con ocho claves a rotar. Main no lo menciona y nadie verificó si se rotaron.
   - a) Ya se rotaron: Martín o Leandro lo confirman.
   - b) No se rotaron o no se sabe: rotarlas hoy con Leandro.
2. **Cuota en pesos cobrada entera, declarada a otra tasa.** Deja US$100 que la cobranza le reclama a quien ya pagó.
   - a) Se da por saldada y no se reclama.
   - b) Se sigue reclamando la diferencia.
3. **#43: ¿el documento de un cliente puede pasar por la IA de la agencia?** Mientras tanto, tras el deploy se le contesta «inspeccioná y pegalo».
   - a) Sí, con la IA de la agencia.
   - b) No, solo con la IA del negocio del cliente.

## No se pudo leer

- **Base de producción:**
  - si están aplicadas 0346, 0351 y 0355. Para la 0351, el commit dice que no y `cerebro.md` dice que sí
  - credenciales fuera de la hidratación
  - Google y rol en ws 13
  - `mako_doer_conv`
  - `errores_app` del #39
  - si ws 15 y ws 23 tienen grupo
  - de quién es el número del #43
- **Sin verificar:**
  - nada se miró en pantalla, `/tickets` incluido
  - no se corrieron tsc ni tests
  - #36, #40 y #45 son lectura de código, sin reproducir
  - que cierto número sea de Martín es inferencia
- **Repos:**
  - `estudio-video` no se abrió
  - `koncke/mako` da 404 sin sesión, así que un `koncke/mako-plugin` privado no se vería
- **Chats de la nube:** el canal es de ida. No hay ramas nuevas para lo repartido el 2/11 (#15, #16, #13, #44), pero no se puede afirmar que no hicieron nada.
- **#15:** la frase original puede referirse a Spy, que ya se rehízo.
- **Pedidos:**
  - capturas sin texto (5 en `4eb065fe`, 31/10)
  - llamada del 30/10 a la noche, sin evidencia de análisis
  - 70 «perdidos» del 28/10 (`docs/relevo/pedidos-perdidos-2810.md`, incluye promesas a Teo), no re-medidos uno por uno
- **Git y disco:**
  - 124 ramas locales sin mergear, solo se miraron las recientes
  - `C:/dev/revisiones/` y `side-session-notes`
  - worktrees sucios viejos, solo tamaño y fecha: `wt-ops-2510`, `wt-ops-fotos`, `wt-api-diseno`, `wt-landings-av`, `wt-recomienda`, tres `wf_2927dff7-760-*`, `wt-crm-2510`
  - `wt-ag2` (`tsc-acotado.mjs` modificado, +8/−1, sin abrir)
  - `wt-push-q`, no se miró su árbol, por regla

## Cosecha sin escribir

Ningún informe escribió nada. Lo de IA, ticketera y comunicación va con el chat 3. Esto no tiene dueño:

- **`docs/hallazgos-infra.md`:**
  - `git cherry` con `+` no prueba que falte: `37b1f13e9` da `+` y su contenido ya está en main.
  - Medir por ramas no ve lo sin commitear ni una rama remota sin relevo. Así pasaron 5 días los arreglos de cobros y 2 los de seguridad.
  - El índice `docs/hallazgos.md` causa la mayoría de los «CHOCA»: un `merge=union` evitaría casi todos.
  - Dos migraciones con el mismo número no dan conflicto. Pasó otra vez con la 0360.
- **Sin documento asignado en el informe:**
  - El extractor pierde mensajes: `ultimo-de-chat.py` y cualquier filtro por `type=user` no ven `attachment.queued_command`. En `e680c815` son 266 en cola contra 183 de tipo `user`.
  - «Entregado» o «Repartido» no significa hecho.
  - `git diff --stat` con triple punto infla los archivos en ramas viejas: sirve más `git log main..rama --no-merges` junto con `git merge-tree`.
