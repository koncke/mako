# Relevo: Integraciones (cuenta 2, 09/10/2026, tarde; puesto al día el 13/10/2026)

De primera mano: lo escribió el chat que hizo el trabajo. Antes de actuar sobre algo de acá,
medilo contra `main` (puede haber cambiado).

> ⚠️ **Medido el 14/10/2026 a las 15:57 AR (claude1, producción, sólo lectura), y corrige lo que se venía
> repitiendo («faltan repegar 4, 11, 13 y 14»).** Versión actual del Pixel: **v23**; el aviso pide **v22** (`PIXEL_MINIMO_AVISO`).
> - **ws11 (Leila) y ws13 (Código Inmobiliario) YA repegaron** (v22: 134 y 271 visitas en 7 días). A Leila le quedan
>   `que-es-lidermente.netlify.app` (v15) y `/guia-cuello-de-botella` (v18).
> - **ws13 está en v22 y tiene CERO grabaciones** (ws1: 104, ws11: 39). El server contesta `rec` a toda visita v22
>   (`app/api/track/vsl/route.ts`, muestreo 100). **Causa medida:** su sitio sirve una copia reescrita del Pixel
>   (`/mako-tracking.js`) que manda la sesión como el texto "replaySesion();", y el receptor tira todos los lotes
>   («sesion invalida»). Se arregla pegando la línea de la v23. Detalle en `docs/hallazgos-landing.md`.
> - **Reportes por WhatsApp:** el feed y el mail (diario y semanal) siguen saliendo. Lo perdido es el WhatsApp: el
>   reporte por hora del ws1 (48 reportes en el feed en 5 días) iba SÓLO por WhatsApp. Los clientes sólo
>   tienen el semanal en el feed (12/10), y todos con el mail prendido para ese reporte.
> - **ws14 (P2P) sigue en v15** (29 visitas, la última hoy) y no tiene canal: el aviso semanal no le llega.
> - ws4: v21, sin páginas ni visitas en 7 días. ws 9, 10, 15 y 17: nunca pegaron el Pixel.
> - **Rojo en `main`:** `tests/integracion-sin-salir.test.ts`, por dos links a /integraciones del Landing Generator
>   (`DialogoPublicar.tsx:541` y `CobroBoton.tsx:110`, los dos para Stripe), archivos que también cambia la rama `landing-t6`.

## Lo que quedó hecho y en producción

| Qué | Commit | Dónde se lee el porqué |
|---|---|---|
| La agenda de Google no pasa por ninguna IA | `3ce63c82` | `docs/hallazgos-ia.md` |
| Rotar de proveedor ya no duplica pendientes | `cf365907` | `docs/hallazgos-ia.md` |
| El Pixel se puede bajar como archivo (los clientes de Joan) | `6a43d32e` | `docs/hallazgos-landing.md` |
| Qué protege hoy cada credencial (sólo medición) | `08e1f8f4` | `docs/hallazgos-seguridad.md` |
| La agenda por WhatsApp: crear, mover, cambiar y cancelar, con o sin lead | `6d8655ca` | `docs/hallazgos-api-mako.md` |
| Chatwoot APAGADO, código en la etiqueta `archivo/chatwoot-2026-10-09` | `2375d53a` | `docs/hallazgos-comunicacion.md` |
| Las vistas de cohortes cerradas a la clave pública (mig 0231, aplicada) | `70d52565` | `docs/hallazgos-seguridad.md` |
| /whatsapp sin número ya no pide Chatwoot: muestra la bandeja con su QR | `c09e16ad` | `docs/hallazgos-comunicacion.md` |
| El token de la API por hash + pista, **convertido en producción** (ws1, ws9, ws11) | `dc25a921`, `0f12fe27` | `docs/hallazgos-seguridad.md` |
| El Pixel en UNA línea (`/m.js`), v23 sin `var TOKEN` | `3a0ec23c`, `75e32327` | `docs/hallazgos-landing.md` |
| Chatwoot borrado, tanda 1 (`lib/chatwoot.ts` queda en cascarón); credenciales de ws1/ws4/ws13 borradas | `99246cff` … `0fa33a30` | `docs/hallazgos-comunicacion.md` |
| Los dos casos de agenda por WhatsApp | `5561c1db`, `c3572358` | `docs/hallazgos-api-mako.md` |
| La key de Resend de la plataforma con `envCred` | `3677e675` | `docs/hallazgos-comunicacion.md` |
| El remitente de Resend dice «falta»; la ayuda de un campo es «Cómo configurarlo» (puntos 13 y 15 de Customer Success) | `e0692c54` | `docs/hallazgos-integraciones.md` |
| 13/10: el Pixel pegado dos veces ya no cuenta doble (sin subir la versión, a propósito) | rama `cierre-integraciones` | `docs/hallazgos-landing.md` |
| 13/10: el «opcional» de un tutorial se comprueba en los 19 servicios; el recuadro amarillo y las slides caben en 120 | rama `cierre-integraciones` | `docs/hallazgos-integraciones.md` |
| 23/10: el puente de leads de Meta por Make o Zapier (armado y RETIRADO el mismo día por decisión de Martín: «ya resolvimos todo con Zernio»; el retiro, con su guard) | `4e661df70` a `93a7baf00` (se armó) y la rama `integ-quitar-puente-2310` (se retira), sin pushear | `docs/hallazgos-integraciones.md`, `docs/archivo/guia-leads-por-zapier.md` |

⚠️ **No se vuelve a un deploy anterior a `dc25a921`**: los tokens ya están en hash y el código viejo
no los sabe leer (las tres skills instaladas dejarían de autenticar).

## Lo que espera una decisión de Martín

1. ~~**`cambiar_fecha_tarea_plan` por WhatsApp.**~~ **HECHO con criterio el 17/10/2026 (B5):** existe en main con todos los
   canales y confirmación de chat (una persona dice «sí»); no toca el Quarter ni una tarea que se repite. Lo de antes:
   **`cambiar_fecha_tarea_plan` por WhatsApp.** Hoy es sólo HTTP; a «movela al viernes» → «la
   tarea», el turno sabe que no tiene con qué cambiarle la fecha.
2. **Los reportes por WhatsApp ya no salen.** Salían por Chatwoot (texto libre dentro de la ventana
   que abría la plantilla `reporte_mako`); con el borrado volvieron a `wa: 'no'` (`dae6b3b4`). Falta
   decidir si van por la línea de MaKo (Evolution).
3. ~~**Las slides de «MaKo IA (Anthropic)»**~~ **DECIDIDO con criterio el 17/10/2026 (B5), sin Martín:** la tarjeta promete
   lo que corre: «Con tu llave, MaKo usa Claude donde hace falta. No es necesaria para empezar» y «Claude entra sólo donde
   está permitido» (el veto, lib/veto-claude.ts). Sin Opus/Sonnet ni «MaKo no piensa». Si Martín quiere otra cosa, es
   cambiar dos renglones de lib/servicio-slides.ts. Lo de antes:
   **Las slides de «MaKo IA (Anthropic)»** (`lib/servicio-slides.ts`) dicen «Sin esta llave, MaKo no piensa» y
   «Opus para el análisis pesado, Sonnet para lo conversacional»: lo contrario del veto de Claude. Qué se le
   promete al cliente en esa tarjeta lo decide él (13/10).
4. **Los tutoriales acortados el 12/10**: falta que Martín mire Meta, Resend, Cal.com y Fathom. Lo que se cayó al
   acortar está listado en `docs/hallazgos-integraciones.md`.

## Lo que quedó a medias, con su archivo

- **Verificación de Google (OAuth, proyecto mako-500317): TRABADA.** El Chrome conectado sólo tiene la
  cuenta de Mauricio (con `authuser=1` Search Console abre la de mbustos@…). Hace falta que Martín entre
  con martinkoncke@gmail.com en ese Chrome; después: dominio por TXT en Porkbun, sacar los dominios
  viejos y sus 3 redirect URIs, declarar los permisos, grabar el video (en inglés, con el client_id
  visible, sin audio), subirlo a YouTube como no listado y enviar. Martín autorizó grabar y enviar.
  Paso a paso en `docs/verificacion-google.md`.
- **El punto 14 de Customer Success** (conectar el correo con Google/Gmail, como el QR del WhatsApp):
  espera esa verificación.
- **Chatwoot tanda 2 (17/10/2026, medido): el cascarón `lib/chatwoot.ts` SIGUE, con 2 importadores en vez de 5.**
  La razón de esperar a `wip/api-acciones-0910` ya no es cierta: esa rama es del 09/10: tiene 2 commits «WIP (sin terminar, NO
  pushear)» con 222 archivos tocados, y la API de MaKo que sirve vive hoy en main. Salieron de la lista `app/crm/actions.ts` (dos llamadas que contestaban
  `null`), `lib/nutricion.ts` (el paso por el oficial queda en fallo con su porqué, sin llamar a nada) y `lib/meta-templates.ts`
  (su `getWabaConfig` local tira lo mismo que tiraba). **Quedan `lib/api-mako/areas/whatsapp.helpers.ts` y
  `whatsapp.run.ts`**: 8 operaciones del REGISTRO de la API de MaKo que sólo existen para el WhatsApp oficial
  (`listar_conversaciones_whatsapp_oficial`, `hilo_contacto_whatsapp_oficial`, `contacto_chatwoot_por_telefono`,
  `salud_webhook_chatwoot`, `marcar_leido_whatsapp_oficial`, `crear_contacto_chatwoot_lead`, `reparar_webhook_chatwoot`,
  `bloquear_contacto_whatsapp_oficial`) y que contestan «no hay canal oficial» desde el 09/10. Retirarlas es cambiar el contrato
  de la API (su def, `rest.ts`, `docs/api-mako*.md`, `tests/api-mako-http.snapshot.txt`, `tests/editor-acciones.test.ts`) y
  **es del chat de la API de MaKo**, no se hizo desde Infra. Cuando salgan, `lib/chatwoot.ts` se borra entero (el test
  `tests/sin-chatwoot.test.ts` falla con «ya no lo importa» hasta que se saque de `IMPORTADORES`). Y `'lead.wa_entrante'`
  (`lib/flujos-tipos.ts`) quedó sin emisor.
- **La columna `crm_etiquetas.chatwoot_label` (mig 0224): migración escrita, SIN APLICAR.**
  `supabase/migrations/0314_quitar_crm_etiquetas_chatwoot_label.sql` (`drop column if exists`; la 0313 era la más alta en main y en
  todos los worktrees al 17/10 — **renumerarla si el Cerebro ya dio la 0314**). Antes se midió que nadie la lee ni la escribe:
  `lib/etiquetas.ts` pide sus columnas por nombre sin ella, y `lib/datos-mau.ts` ya la OMITE al copiar. Tenía 2 filas con valor
  (`docs/hallazgos-comunicacion.md`): se pierden a propósito. **No se corrió contra producción.** Aplicarla:
  `node scripts/apply-migration.mjs supabase/migrations/0314_quitar_crm_etiquetas_chatwoot_label.sql`; después sacar
  `'chatwoot_label'` del `omitir` de `lib/datos-mau.ts` y de la lista de `tests/sin-chatwoot.test.ts`.
- **Verlo con clics**: el formulario de integraciones nuevo (ws3).
- ~~**El puente de leads por Zapier (23/10/2026)**~~: RETIRADO el mismo día (decisión de Martín: «ya resolvimos todo con Zernio»). Lo que
  falta es de Zernio: que su webhook escuche `lead.received` (hoy `EVENTOS_WEBHOOK` no lo tiene) para traer los formularios de Meta.
- ~~Un uso real de una skill después de convertir los tokens~~: medido el 13/10 en sólo lectura
  (`app_settings.api_tokens_uso`). La skill del ws11 autenticó el 11/10 a las 23:25 UTC, dos días después de la
  conversión (09/10, ~17:40 UTC): el token clásico por hash anda. La del ws1 no se usa desde el 09/10 a las 03:02
  UTC, ANTES de la conversión, así que su silencio no dice nada (un fallo de autenticación no escribe uso).

## Una trampa del clon compartido

- **Después de actualizar el clon, `npx next typegen`**: la tanda 1 de Chatwoot borró rutas y
  `.next/types/validator.ts` las sigue nombrando (deja rojo el typecheck de todas las sesiones).
- El `main` local del clon está muy atrás de `origin/main` y tiene trabajo sin commitear de Customer
  Success: no se actualizó desde acá.
