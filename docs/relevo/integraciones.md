# Relevo: Integraciones (cuenta 2, 09/10/2026, tarde)

De primera mano: lo escribió el chat que hizo el trabajo. Antes de actuar sobre algo de acá,
medilo contra `main` (puede haber cambiado).

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

⚠️ **No se vuelve a un deploy anterior a `dc25a921`**: los tokens ya están en hash y el código viejo
no los sabe leer (las tres skills instaladas dejarían de autenticar).

## Lo que espera una decisión de Martín

1. **`cambiar_fecha_tarea_plan` por WhatsApp.** Hoy es sólo HTTP; a «movela al viernes» → «la
   tarea», el turno sabe que no tiene con qué cambiarle la fecha.
2. **Los reportes por WhatsApp ya no salen.** Salían por Chatwoot (texto libre dentro de la ventana
   que abría la plantilla `reporte_mako`); con el borrado volvieron a `wa: 'no'` (`dae6b3b4`). Falta
   decidir si van por la línea de MaKo (Evolution).

## Lo que quedó a medias, con su archivo

- **Verificación de Google (OAuth, proyecto mako-500317): TRABADA.** El Chrome conectado sólo tiene la
  cuenta de Mauricio (con `authuser=1` Search Console abre la de mbustos@…). Hace falta que Martín entre
  con martinkoncke@gmail.com en ese Chrome; después: dominio por TXT en Porkbun, sacar los dominios
  viejos y sus 3 redirect URIs, declarar los permisos, grabar el video (en inglés, con el client_id
  visible, sin audio), subirlo a YouTube como no listado y enviar. Martín autorizó grabar y enviar.
  Paso a paso en `docs/verificacion-google.md`.
- **El punto 14 de Customer Success** (conectar el correo con Google/Gmail, como el QR del WhatsApp):
  espera esa verificación.
- **Chatwoot tanda 2: borrar el cascarón** `lib/chatwoot.ts` cuando entre la rama
  `wip/api-acciones-0910` (worktree `C:/dev/mako-api`), que tiene cambiados los archivos que lo
  importan. Y `'lead.wa_entrante'` (`lib/flujos-tipos.ts`) quedó sin emisor.
- **Verlo con clics**: el formulario de integraciones nuevo (ws3) y un uso real de una skill después de
  convertir los tokens (se lee en `app_settings.api_tokens_uso`).
- **La guarda del snippet contra correr dos veces** (`lib/landing-token.ts`): hoy lo cuida sólo el texto.

## Una trampa del clon compartido

- **Después de actualizar el clon, `npx next typegen`**: la tanda 1 de Chatwoot borró rutas y
  `.next/types/validator.ts` las sigue nombrando (deja rojo el typecheck de todas las sesiones).
- El `main` local del clon está muy atrás de `origin/main` y tiene trabajo sin commitear de Customer
  Success: no se actualizó desde acá.
