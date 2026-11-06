> **Correcciones del Cerebro, medidas el 6/11/2026 ~06:00 UTC:**
> - **1.2:** la clave de correo ya está en la plataforma (ws 9) desde el 4/11. Falta sólo avisarle a Mauricio, y eso lo hace el Cerebro con Martín.
> - **2.1:** el asiento de `koncke` ya salió y `desplegar-ya` corrió (READY, `4d095e319`). Falta comprobar el cron y medir en el panel.
> - **1.1:** hace falta el email de Brigitte: no está en la base. Es de Martín o de Joan, no de código.
> - El «ojito» (3.6) no se reabre: es una decisión de seguridad.

# Pedidos de Martín en otras cuentas: qué quedó sin hacer (6/11/2026)

Medido contra `origin/main` = `4d095e319` (6/11 00:30), con `git grep` y `git show`. No se corrió la app. Los pedidos están agrupados por tema, así que los conteos son aproximados (cada lote agrupó a su manera).

## Cobertura
- **Chats leídos: 106 de 106.** Los 106 digests se leyeron completos, repartidos en 7 lotes. Dos son solo un título («Dashboard» `e8b1dfde`, «General» `cad2e195`) y no traen pedidos.
- `auditoria-pedidos-5-11.md` no está en `origin/main`, solo en `origin/punta/pendientes-pc`. Se leyó de ahí.
- Los HECHO se confirmaron en su mayoría por las bitácoras (`app/admin/dev/<área>/bitacora.ts`) y los relevos, que copian la frase de Martín. No se leyó el código de cada pantalla. HECHO no es «mirado en pantalla».

## Conteos (suma de los 7 lotes)
| Estado | Aprox. |
|---|---|
| Pedidos agrupados | ~600 |
| HECHO (no se listan) | ~480 |
| REEMPLAZADO (no se listan) | ~76 |
| FALTA | 11 |
| A MEDIAS | 29 |
| Sin verificar | ~60 (la mayoría, de dueño ajeno) |
| Con DUEÑO de otra área (aparte) | ~60 |

Reemplazados con más peso: Creem, Paddle y la LLC de Stripe (quedó MP + Creem); Apify (volvió solo para Spy); Chatwoot (borrado el 9/10); Clarity (replay propio); Offer Coach (se unió a Funnel Coach); referidos con créditos (solo plata); onboarding «épico» con animación de grafo (lo reemplazó el chat de arranque del 16/10); Ads Writer, Content Machine y Copywriter (un solo camino); Leads Scraper (retirado el 25/10); kanban por bandas (reemplazado el 5/10); plan Free (lo pisó la prueba de 7 días con tarjeta).

---

## 1. CLIENTE ROTO

**1.1 Brigitte (ws15) no puede acceder a su espacio** · A MEDIAS
- «No se le envió la invitación a Brigitte, ella no puede acceder» (9/10, Customer Success `63c156e8`).
- El código se arregló. Falta su email en la base y que Martín la sume o apruebe el pedido de Joan. Evidencia: `docs/hallazgos-customer-success.md:5335`.
- Archivos: mantener `63c156e8` hasta confirmar que `invitacion_enviada_at` quedó escrito.

**1.2 Mudanza de la clave de correo de MaKo (ws1 a plataforma) y aviso a Mauricio** · A MEDIAS, sin verificar en producción
- «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako» (4/11, Cerebro `0ee425c6`).
- El código está en main; la mudanza de producción no consta como corrida. `docs/relevo/nube-email.md:12` y `:48-51`.
- Archivos: mantener `0ee425c6`.

**1.3 La agencia de Joan no entra sola a los grupos de WhatsApp de sus clientes nuevos** · A MEDIAS
- «cuando crea el grupo automáticamente que le invite a las personas del usuario agencia» (3/11, `0ee425c6` y `d6eb2cc0`).
- El bug de Notificaciones (#49) está arreglado (`lib/ajustes-secciones.ts`). El alta automática quedó APAGADA por el freno anti-ban (`mako.grupos.automatico`); prenderla es decisión de Martín. `docs/hallazgos-comunicacion.md:372`.
- Archivos: archivar `d6eb2cc0` (solo brief); mantener `0ee425c6`.

**1.4 Opt-in con lead duplicado pierde el `visitor_id`** · A MEDIAS
- «en la etapa de Leads entrantes podríamos ya visualizar la grabación…» (6/10, IA del cliente `07395d64`).
- La cookie ya lleva `domain=` (`lib/landing-token.ts:165`). Falta que el `visitor_id` pase de la propuesta duplicada a la ficha: `git grep visitor_id` sin resultados en `lib/leads-duplicados.ts` ni `app/crm/leads-importar.ts`. `docs/hallazgos-landing.md:3441`.
- Archivos: mantener `07395d64`.

**1.5 Cruce de datos entre workspaces en el video generator** · sin verificar
- «Revisa que el resto de workspace no tengan problema de que se crucen datos» (31/8, Content Machine `869b21b3`).
- `docs/relevo/seguridad-aislamiento.md` trata el aislamiento en general; nada específico de `flow_puentes` ni de las colas de video.
- Archivos: mantener `869b21b3`.

**1.6 Vista previa del PDF en el chat de MaKo** · sin verificar
- «la preview del PDF se bugea… ni siquiera debería sacarme de la tab» (18/10, Cerebro `9bc46b5e`).
- `app/chats/Hilo.tsx:281` abre el documento en pestaña nueva, sin visor embebido. No se sabe si el pedido era sobre este chat.
- Archivos: mantener `9bc46b5e` hasta confirmar.

**1.7 Nombres y fotos de contactos de Evolution en el onboarding del Chat Agent** · sin verificar
- «Aún no me trae los nombres de los contactos… los estas trayendo por ID no por el numero» (2/8, Automations `899c848a`).
- Las fotos ya se guardan en el bucket; falta mirar en pantalla. `docs/hallazgos-comunicacion.md:1720-1730`.
- Archivos: archivar `899c848a`.

## 2. PLATA

**2.1 Vercel: bajar el gasto a ~US$40 y sacar el asiento extra** · A MEDIAS
- «Vamos por 1 por días… encargate de quitar el asiento extra» (6/11 03:21, Cerebro `4d1a09d4`).
- Código en main: `vercel.json:244` (cron `desplegar-main`), `app/api/cron/desplegar-main/route.ts`, `scripts/desplegar-ya.mjs`; `docs/hallazgos-infra.md:87-120`. Faltan pasos fuera del repo (memoria `vercel-costo-builds`): sacar a `koncke` de los miembros, correr `desplegar-ya`, correr el cron una vez, confirmar el asiento en el panel. Sin medición del ahorro.
- Archivos: mantener `4d1a09d4`.

**2.2 Cuota en pesos cobrada entera con dólares declarados a otra tasa** · A MEDIAS (decisión de Martín abierta)
- Brief de «Cobros: cuotas» (3/11, `c059d635`), no es cita directa.
- B8 a B13 ya en main. Falta decidir: A) los pesos enteros saldan la cuota (recomendada), o B) dejar como está. Hoy la cobranza le reclama US$100 a quien ya pagó. `docs/relevo/pagos.md:60-67`. Ya figura en `pendientes-0311`, chat 1.
- Archivos: archivar `c059d635`; la decisión vive en `pagos.md`.

**2.3 Precio en pesos al dólar blue, actualizado** · A MEDIAS
- «Ponlo al dolar blue de hoy, y lo puedes ir modificando» (31/10, Cerebro `e680c815`).
- Los precios están fijos al blue del 31/10 ($73.555 y $151.805). `git grep blue|dolarapi|bluelytics` sin resultados en `lib/`. Falta decidir cada cuánto se actualiza. `docs/pendientes.md:111`.
- Archivos: mantener `e680c815`.

**2.4 Tope de GitHub Actions a US$130** · sin verificar
- «Por que actions subió tanto?» (4/11, `0ee425c6`). Es paso de Martín: `docs/relevo/cerebro.md` («Esperan a Martín»).

**2.5 Railway a US$40/mes: decidir si se queda** · sin verificar
- «Estoy pagando un costo de 40usd al mes por railway… ¿es necesario?» (1/9, `acb50596`).
- Respondido en el hallazgo (Evolution corre ahí; mudarlo obliga a re-escanear el QR). No hay decisión registrada. `docs/hallazgos-comunicacion.md:1687-1717`. Archivos: archivar `acb50596`.

**2.6 Pesos MX a dólares en el artifact 17add1de** · sin verificar
- «Pon esto dentro de MaKo y reemplaza todos los pesos MX a dólares» (9/9, `ab7509dc`). No se abrió el artifact. Archivos: archivar `ab7509dc` si el artifact ya está dentro de MaKo.

**2.7 Protección contra DDoS (captcha, Cloudflare, balanceador)** · A MEDIAS
- «si no lo trabajó, dejalo registrado para la próxima cuenta» (15/10, `e680c815`).
- Tope por IP en rutas públicas hecho el 17/10. Captcha y Cloudflare son decisión de Martín; el balanceador se mide antes de comprar. `docs/relevo/ciberseguridad.md`, `docs/pendientes.md:290-291`. Ya registrado.

## 3. LO QUE TRABA A MARTÍN

**3.1 «Nada por detrás»: quedan envíos fuera de las automatizaciones** · A MEDIAS
- «depreca absolutamente todos los mensajes que corren por detrás» (16/10, Cerebro `a8f8993e`; la regla viene de Automations `461dd390`, 14/10).
- `docs/inventario-nada-por-detras.md:15-16`: 59 envíos fuera. Lotes 1 a 3 hechos (`:51-81`). Faltan `lead-no-confirmo`, `voz-mako-caida-email`, los `store-flujo-*`, `insistencias-drenar` y las familias cursos/CS, CRM, pagos, reportes y mensajes al lead (`:92-94`). Antes de prender `reunion_tareas_al_plan`, excluir al ws13.
- Archivos: mantener `461dd390`.

**3.2 Corte de grupos de WhatsApp y que MaKo nunca escriba primero (bot 1 a 1)** · A MEDIAS
- «MaKo nunca envíe mensajes primero… ya no cree grupos por ahí» (3/11 20:57, `0ee425c6`).
- Grupos dentro de la app en producción desde el 4/11 (`nube-grupos.md`). La rama `avisos-bot-corte-0311` no está en main; `git grep "grupos.corte|corte-grupos"` sin resultados. El bot 1 a 1 sigue apagado; no se prende sin el sí de Martín. `lib/mako-bot-reglas.ts:26`, `docs/relevo/cerebro.md:132`.
- Archivos: mantener `0ee425c6`.

**3.3 Aviso por la línea secundaria cuando se cae la principal** · A MEDIAS
- «si llega a pasar tengo mi linea secundaria para avisarme a mi mismo» (3/11, `0ee425c6`).
- Hoy el aviso sale por mail; no probado con caída real. `docs/hallazgos-comunicacion.md:368`.

**3.4 Generación de video de punta a punta nunca probada en vivo** · A MEDIAS
- «QUIERO ya, ahora mismo hacer funcionar end to end la generación de video» (6/9, Content Machine `869b21b3`).
- `docs/hallazgos-ai-avatar.md:299-309`: `ai-avatar.looks` vacío en todos los workspaces; el ws3 nunca vinculó la extensión. `docs/relevo/video-generator.md:59-61`: «Medir en vivo» sigue como paso 1.
- Archivos: mantener `869b21b3`.

**3.5 Velocidad del acomodo del guion en tomas** · sin verificar
- «se demora increíblemente mucho» (1/9, `869b21b3`). La cola ya la atiende un cron (`docs/relevo/video-generator.md:107`); sin medición posterior.

**3.6 Superadmin no puede ver su propia credencial (el ojito)** · sin verificar, probablemente deliberado
- «intenté ingresar en superadmin y darle al ojito y me dice "Solo el admin de este espacio puede ver una credencial"» (30/7, CURSOS `e8ba820e`).
- `app/api/integraciones/credencial/route.ts:115-119` (`puedeRevelar`) exige ser admin del workspace dueño; el comentario `:108-113` y `:155` muestra que cerrar la lectura ajena fue decisión de seguridad. Estado 'cola' en `app/admin/dev/credentials-vault-byok/bitacora.ts:29`. No reabrir sin confirmar con Martín.

**3.7 Aviso de Google «no verificó esta app» en el login** · A MEDIAS, ya cubierto
- «Me salió el aviso de google de "Esta app está en prueba"» (6/8, CRM `c82dcecc`).
- Publicada el 7/10; sigue «no verificada» por scopes sin declarar y «Uso Limitado»; `www.hola-mako.com` no está en las redirect URIs (`docs/hallazgos-integraciones.md` ~495-540). Sin código nuevo.

**3.8 Uso del Runner con tokens de API de las cuentas** · sin verificar
- «¿no conviene que el runner también corra de vez en cuando con tokens de API?» (20/10, `9bc46b5e`). Es decisión; sin registro en `guardia-del-runner` ni `corte-al-97`.

**3.9 Acciones de producción o disco, no código** · sin verificar
- Habilitar 200 tokens de API del Ops Center de Mauricio (22/10, `4d1a09d4`); apertura del Sprint a 65 por día de 9 a 21 (23/10, `d3a50e3f`); Pixel y UUID en `sprint.mauriciobustos.com` (24/10, `d3a50e3f`; solo `docs/hallazgos-landing.md:4519-4527`); borrar carpeta de C: (22/10, `4d1a09d4`); sacar la key de Martín del ws de Mauricio (15/8, `ac4871f9`); reiniciar al cliente de Juanfran (18/8, `9035e991`).
- Archivos: mantener `4d1a09d4` y `d3a50e3f`; `ac4871f9` y `9035e991` se dan por cerrados solo si Martín confirma.

**3.10 Pasos que son de Martín, no código** · pendientes
- Resend (clave y plan de Mauricio), clave de Apple Push, correos de testers, prueba del aviso en su Android, tiendas. `docs/relevo/cerebro.md` («Esperan a Martín»).

## 4. FUNCIONES (FALTA o A MEDIAS)

**4.1 Aviso por WhatsApp cuando un proveedor cambia algo (ej. Google corta keys gratis), con cron diario** · FALTA
- «Debemos crear un flujo de avisos por WhatsApp cuando pasen estas cosas… un cron revisándolo diario» (14/8, IA del cliente `a6e5d973`).
- Grep sin resultados en `lib`, `app/api/cron`, `hallazgos-ia/infra/integraciones`. Los crons de `vercel.json` (vigia-grupos, media-buyer-vigia, vigia-lineas-mako, vigia-aprobaciones) no lo cubren. Ojo: WhatsApp saliente de MaKo se está cortando (3.2); el canal habría que redefinirlo.

**4.2 Muapi como segundo motor de video** · FALTA
- «Muapi… podríamos implementarla también, para tener flow y esa alternativa» (30/10, `e680c815`).
- Hay diseño (`459bd7c0f`, `docs/diseno-ai-avatar-estudios.md:53`); `git grep -i muapi` sin resultados en `lib/` ni `app/`.

**4.3 Generar anuncios «en cantidad» (100 en menos de 1 hora)** · FALTA
- «Una app que te genera 100 anuncios en menos de 1 hora para testear en Meta» (13/10, Perro Guardián `518fbd28`).
- `git grep` sin resultados en `lib/image-editor`, `lib/video-generator`, `app/image-generator`, `app/video-generator`, `app/image-editor`. Solo `docs/como-venden-otros.md:146`.

**4.4 Creador de formatos** · FALTA
- «Quiero que crees un "CREADOR DE FORMATOS"…» (1/9, `869b21b3`).
- `docs/hallazgos-generativa.md:4622`; `app/video-generator/formatos-datos.ts` nadie lo importa; `docs/api-mako-inventario.md:1868`.

**4.5 Historial de decisiones de Martín en el detalle de «progreso», con aviso al chat si cambia de opinión** · FALTA
- «se manda como un prompt que el usuario cambió de opinión» (16/10, `a8f8993e`). Grep sin resultados en `app/admin/operaciones`, `lib/operaciones*`, `lib/centro*`.

**4.6 Focus Tracker (Toggl por BYOK) y Productivity Analyst** · FALTA
- «cargalo en el plan» (10/8, Pricing MaKo `7a704394`). `git grep` de «Focus Tracker» y «toggl» sin resultados en `app lib docs`. Puede estar como tarea en la base del `/plan`; no verificable acá.

**4.7 VSL Generator completo** · FALTA, prioridad BAJA
- «quiero terminar completamente la funcionalidad de VSL Analyst y VSL Generator» (5/8, `e491f6d6`).
- 5 entradas en 'cola' en `app/admin/dev/vsl-generator/bitacora.ts:28-32`; `app/_components/nav.ts:474` con `comingSoon`.

**4.8 Conectar Google Drive (clientes pasan links, MaKo los lee)** · FALTA
- «Podemos hacer que se conecte a Drive?» (26/10, `0ee425c6`). Solo existe bajar un link público (`lib/api-mako/areas/ads.run.ts:896`); scopes de Google solo Calendar y vigía (`lib/google-calendar.ts:37,43`).

**4.9 Hook generator** · FALTA, backlog explícito
- «Otra funcionalidad buena es el Hook generator… Lo dejo como backlog» (31/7, CURSOS `e8ba820e`). Grep sin resultados.

**4.10 Imagen y video por celda de la matriz del Ads Writer** · A MEDIAS
- «dentro de cada pop-up debería estar la imagen generada» (28/7, `e8ba820e`). `app/admin/dev/ads-writer/bitacora.ts:37` en 'cola'.

**4.11 Búsqueda avanzada del CRM como la del plan** · A MEDIAS
- «tampoco la busqueda avanzada en el CRM… Te lo pedí» (7/8, `c82dcecc`).
- ID, acentos y orden libre están (`app/crm/CrmToolbar.tsx:351-362`, `lib/buscar-texto.ts`). Falta elegir campos, búsqueda con IA y la flechita; el `Buscador` es un input simple.

**4.12 Onboarding para inmobiliarias (sin closer, sin R1/R2)** · A MEDIAS
- «Implementar onboarding y algunas configuraciones personalizadas para INMOBILIARIAS» (28/9, CRM `debe2ade`). Sin resultados para «inmobil» o «closer» en `lib/onboarding*` ni `app/onboarding`. `lib/onboarding-crm.ts:1-12`.

**4.13 TikTok en Automations: solo está la fase 0** · A MEDIAS
- «El botón de TikTok en el CRON como siempre, al lado del de IG» (14/10, `461dd390`). Fase 0 en `lib/nutricion.ts:155`; falta el disparador (`docs/diseno-tiktok-linkedin.md`: solo contestar, tope 10 mensajes en 48 h).

**4.14 Acciones de Calendly crear o editar eventos** · A MEDIAS, probablemente límite externo
- «falta configurar ACCIONES para crear eventos de Calendly» (16/10, `a8f8993e`). Solo existe «Cancelar su reunión» (`app/admin/dev/chatbot/bitacora.ts:1903`). Decide Martín: cerrar como imposible.

**4.15 Second Brain con «absolutamente todos» los datos del cliente** · A MEDIAS
- «No creo que este tomando ABSOLUTAMENTE todos los datos» (3/9, `e0d3329b`). `app/admin/dev/second-brain/bitacora.ts:33`: `construirCerebro()` hace 21 lecturas sobre ~70 tablas; brief por 4 listas fijas. Lo mismo, pedido 28/10: Second Brain de SuperAdmin conozca todas las funciones (`6ea62e88`; capa en `lib/cerebro-para-chat.ts:146`, cobertura sin verificar).

**4.16 2FA por correo y varias formas activas** · A MEDIAS
- «Activar 2FA de varias maneras…» (13/10, `518fbd28`). `lib/mfa-reglas.ts:163` (`CANALES_CODIGO = []`); WhatsApp nunca sale de MaKo (decisión 4/11, ban; `:166-174`). No existen las preguntas de verificación.

**4.17 Compromisos de Mauricio (criterio de extracción de reuniones)** · A MEDIAS
- «Armá el plan de implementación, pero no quiero romper lo que tanto nos costó armar» (8/9, `518fbd28`). Cadena construida (memoria `criterio-extraccion-mauricio`). Falta responderle la fecha y medirla contra dos reuniones con notas manuales (hay una).

**4.18 Cursos completos en Conocimientos (recursos y módulos)** · A MEDIAS
- «No quiero que quede nada. Todas las clases, todos los recursos» (22/8, `e8ba820e`). `docs/hallazgos-conocimiento.md:2555` (401 recursos faltan en 10 cursos), `:3489` (2342 sin publicar), `:3525-3533`. Relacionado: transcripciones que se resumen y piso de 400 B/s que rechazó diez clases sanas (`app/admin/dev/conocimientos/bitacora.ts:41`). Archivos: mantener `e8ba820e`.

**4.19 Réplica de landing tal cual (diseño y copy) y borrar las que salieron mal** · sin verificar
- «Enfocate primero en replicar tal cual» (28/10, `6ea62e88`). `docs/hallazgos-editor-landing.md:3442-3541`: la «adaptada» seguía nombrando a la competencia 11 y 22 veces. Borrar réplicas es borrado en producción: pedir el sí de Martín antes.

**4.20 Curva de retención por video** · A MEDIAS, prioridad baja
- «Que todos los vídeos se puedan medir» (14/8, `debe2ade`). `app/admin/dev/vsl-tracking/bitacora.ts:34`: `curvaRetencion` acepta `videoId` y nadie lo pasa.

**4.21 Ganar en un segundo producto no dispara la invitación al curso** · A MEDIAS, ya cubierto
- (14/10, Customer Success `7a6bc4be`). Hoy no afecta: ningún negocio tiene `crm.curso_al_ganar`. Depende de una decisión del CRM. `docs/hallazgos-customer-success.md:5693`.

**4.22 Usar ganadores de Ads Analyst y etiquetar anuncios externos al generar guiones** · sin verificar
- (6/8, `23edf4e1`). Existen `lib/avatares-ganados.ts` y `lib/etiquetas-motor.ts`; no se vio que el Copywriter los consuma.

**4.23 Migrar la landing de Mauricio de Lovable a Vercel** · sin verificar
- (16/8, `debe2ade`). Sin resultados en docs, lib o app.

**4.24 Logo real de Meet** · A MEDIAS
- «muchos logos… no son los logos reales» (1/11, `e680c815`). `LogoMeet` dibujado a mano, `docs/hallazgos-integraciones.md:55`.

**4.25 Branding MaKo: animaciones crudas aparte y preview de PNG** · sin verificar
- (27/7, `4d6acb52`). `BrandingMaKo.datos.ts` no lista las variantes sin texto.

**4.26 Plan: filtros agrupados en 4 desplegables; popup de tareas creadas sin chocar con otros** · sin verificar
- (22/7 y 26/7, `a5bc0d5c`). Falta mirar la pantalla. Otros detalles de pantalla del archivero, diagnóstico y Plan: `app/admin/dev/plan/bitacora.ts:27` («falta verlos en escritorio y teléfono»).

**4.27 Otros por mirar en pantalla** · sin verificar
- Grupos en la app en el ws3 (`docs/relevo/nube-grupos.md`); pantallas de Competitors Spy con un competidor real (`nube-spy.md`); Web Generator andando en el navegador (`landing-generator/bitacora.ts:27`); tab sin nombre «no se entiende nada» (25/10, `0ee425c6`, falta la captura); estrella de MaKo flotante; «Image» visible en todos los workspaces; cartel «MaKo no pudo leerla»; tarjeta Automatizaciones en el ws de Mauricio; opciones del Pixel más allá de Flow; MaKo Mobile en super admin (`446d15e3`); uso medido en el Ops Center; porcentaje de VSL y atribución en leads reales (`c82dcecc`: `TrackingTimelineCard.tsx:52-54`, `lib/leads.ts:2631`); verificar la app en Meta (`93cf74d7`, depende de Meta); animaciones propias en cada landing de feature (`ecead78a`); investigar «Grockbot» (`841877e6`); archivo «Feedback Chatbot.txt» (`36f4eb6c`, no legible).

**4.28 Higiene: índice de hallazgos con filas duplicadas** · FALTA
- «Juntar las filas duplicadas del índice de hallazgos» (31/10, `33dcaf5b`). `docs/hallazgos.md` tiene `| Ads |` 5 veces (líneas 145, 163, 164, 180, 303) y `| AI Avatar |` 3 veces (181, 188, 302). Se puede hacer en una pasada.

---

## 5. CON DUEÑO HOY (anotados, sin repartir)
- **Marketing CoPilot y Ads Manager:** los 8 pedidos de Ads Manager `b1c92d31` (filtros, tabla, selección múltiple, productos múltiples); los 6 de `2da0bd61` (subir creativos a campaña existente, aviso de seguridad de Meta, nomenclatura, guardar transcripción del anuncio); `d443439d` (error al publicar, cerrar tareas del proyecto, vista previa de hola-mako.com, estado de la app de Meta); publicación y códigos postales (28/9, `debe2ade`); copiar interfaz de Madgicx y foto de perfil tipo AdAmigo (`0ee425c6`).
- **Admin:** pestaña Clientes del 27/9 (`48dddbc4`: card «Nuevo cliente», buscador, tabla, filtros); links de Conocimientos (`f5ac3121`); sidebar de Dev con «Regresar a Admin» (18/8); tarjetas «Está pasando algo» / «Tenés que decidir» (`c0fe8466`, dev tab «El semáforo»); pestaña de pagos de una suscripción e ingresos por suscripción en SuperAdmin (5/11, `4d1a09d4`; ya en main la tarjeta Pagos `app/automations/FlujoLienzo.tsx:1112`, `EditorRecibo.tsx`, MRR `app/admin/AdminView.tsx:177`).
- **Carruseles:** raspar topcarousels.com, multiplicador de rendimiento tipo 3.7x, filtro CTA, carruseles editables, botón «hacer el mío», rediseñar la pestaña (5/11 y 6/11, `4d1a09d4`; 4/11, `0ee425c6`).
- **Dashboards:** los 8 puntos de `fad4ba8a` (hojas, estilo de página, controles, «Nuevo Dashboard», datos de MaKo); todo `75b4ca34` (replicar 20 dashboards); copiar dashboards con token (`36f4eb6c`); «Continúa con todos los dashboards pendientes» (6/11, `4d1a09d4`); rediseño de plantillas y animaciones de codeandchill (31/10 al 1/11); Graphics a clic derecho en la tab (hecho, `874ba09a`).
- **Video Editor (subtítulos, B-roll, clips):** subtítulos que se superponen (24/8, `7ab22c11`; sin verificar); réplica de CapCut (`eb5e2cd4`); edición automática con música y cortes al final de la generación (1/9, `869b21b3`; A MEDIAS: `app/video-generator/editor-video.tsx`, `editor-cortes.ts`, `PasoMontaje.tsx`); chat de MaKo en las tabs de Video e Imagen (27/10).
- **Plantillas:** plantillas del Dashboard y de Super Admin.
- **Cobro de agencias:** automatización de pagos de Código Inmobiliario (PDF desglosado, recordatorios del 1 al 5, suspensión el día 6), prorrata de Giselle y Marcela, factura de octubre (5/11, `4d1a09d4`). Ya en main las ramas `agencia-cobro` y `agencia-cobro-2`.
- **Promesas a Thiago, Lead Magnet Generator, `docs/recorrido-visual-30-10.md`:** ningún lote encontró pedidos nuevos fuera de lo ya medido.

---

## 6. Archivos del digest

**Mantener (hay ítem vivo):** `4d1a09d4`, `0ee425c6`, `e680c815`, `a8f8993e`, `461dd390`, `debe2ade`, `869b21b3`, `518fbd28`, `9bc46b5e`, `e8ba820e`, `63c156e8`, `07395d64`, `a6e5d973`, `d3a50e3f`, `446d15e3`, `5a0c8b8c`, `a5bc0d5c`, `7a704394`, `4d6acb52`, `e491f6d6`, `33dcaf5b`.
**Con dueño (entregar al dueño):** `b1c92d31`, `d443439d`, `2da0bd61`, `fad4ba8a`, `75b4ca34`, `eb5e2cd4`, `48dddbc4`.
**Archivar (cubierto, reemplazado o sin pedidos):** `7a6bc4be`, `b2eaaa6e`, `0224ed73`, `aacc9d59`, `8284facc`, `142124af`, `411f5a24`, `99ded638`, `08eca526`, `153a499a`, `f3876a09`, `2b1a6e5d`, `e0d3329b`, `0c10d18a`, `0f348b16`, `d015d583`, `2e6ff450`, `aba897f4`, `89722f57`, `4eb065fe`, `c059d635`, `23edf4e1`, `c0fe8466`, `88457d97`, `47333ad9`, `ecead78a`, `deda8ade`, `2ebb8895`, `93cf74d7`, `d9b4ca87`, `1186b401`, `5b7313e9`, `4eaa90c7`, `899c848a`, `76363c1b`, `e86e3994`, `acb50596`, `d6eb2cc0`, `be5a2ec8`, `753afd6e`, `f5ac3121`, `39ee24f8`, `aa226a15`, `8f83ea88`, `9dbe8779`, `5e43450b`, `4e34dbaa`, `36f4eb6c`, `4f96b813`, `35b66220`, `1ff6b1b4`, `3fdbd9ba`, `219f097b`, `841877e6`, `c82dcecc` (salvo 4.11 y 3.7), `7ab22c11`, `6ea62e88` (salvo 4.15 y 4.19), `47b54f41`, `cef88e33`, `526feec1`, `9b5c7e42`, `b8862985`, `ad90083c`, `3abe07a9`, `ab7509dc`, `840d77b9`, `2c9f54d9`, `aca2b6d2`, `29f3f683`, `23445d18`, `9035e991`, `ac4871f9`, `874ba09a`, `837eee8d`, `df9af405`, `ce288bac`, `e8b1dfde`, `cad2e195`.

## 7. Aviso de seguridad
Credenciales pegadas en texto plano en estos digests: `debe2ade` (API de Clarity, dos tokens de GitHub), `869b21b3` (Client Secret de Google OAuth), `23edf4e1` (tokens de Replicate y Fal), `a6e5d973` (claves de Supabase), `4f96b813` (Porkbun, Resend, secreto de webhook de Fathom), `c82dcecc` (clave y secreto de Fathom), `4d1a09d4` (token de Apify). No se copiaron a este documento. Conviene no versionar esos digests y rotar las que sigan vivas.

## 8. Cosecha
Nada se escribió en `docs/hallazgos-*.md` (este trabajo era solo de lectura). Si se quiere cosechar: 1.4 en `docs/hallazgos-landing.md`, 2.3 en `docs/hallazgos-planes-y-cobro.md`, 4.2 en `docs/hallazgos-ai-avatar.md`, 4.28 en `docs/hallazgos.md`.
