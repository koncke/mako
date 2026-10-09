# Relevo: Integraciones (cuenta 2, cerrado el 09/10/2026 con la cuota en 98 %)

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

## Lo que espera una decisión de Martín (no se tocó)

1. **Las vistas `v_cohortes_semanales` / `v_cohortes_mensuales`** dan la facturación por semana
   de TODOS los clientes a la clave pública de Supabase, que viaja al navegador. El arreglo es
   una migración de dos líneas por vista (`security_invoker = on` + `revoke all … from anon,
   authenticated`); el server lee con la service role y no cambia. El guard
   (`tests/funnel-declarado.test.ts`, `YA_FILTRADAS`) dice que lo decide él. Recomendado: sí.
2. **El token de la API de MaKo (`agente_token`)** se guarda en claro en `app_settings` y
   `webhook_routing`. Guardar sólo el hash obliga a mostrarlo una vez (como los tokens con
   nombre de `/api/v1`).
3. **Chatwoot:** borrar el código dormido (122 archivos) por tandas, y si se borran las
   credenciales de ws1, ws4 y ws13 (siguen en la base).
4. **El Pixel:** renombrar `TOKEN` en el snippet (obliga a subir la versión) o un cargador de una
   línea que evite pegar 2.226 líneas.

## Lo que quedó a medias, con su archivo

- **Verificación de Google (OAuth, proyecto mako-500317):** faltan los pasos de consola (verificar
  hola-mako.com por TXT en Porkbun, sacar dominios viejos, declarar permisos), el video demo
  (lo graba Martín) y el envío final (lo confirma Martín). Paso a paso en
  `docs/verificacion-google.md`. La ventana de Chrome oculta no dibujaba los diálogos de Search
  Console: hace falta una visible.
- **La agenda por WhatsApp no se probó contra una agenda real** (la del ws13 es de un cliente):
  la primera prueba es el próximo pedido de Joan. Quedan dos casos: «movela al viernes» suelto
  (sin pendiente ni agenda abierta) y un «Agendar reunión con…» dentro de una lista.

## Una trampa del clon compartido

El `main` local del clon tiene `cc066887` y `ccb850af` (el Pixel y su bitácora), que en el
remoto están como `6a43d32e` y `c2f85ac6`. Un `pull --rebase` ahí salta el primero y choca en
una línea de `app/admin/dev/vsl-tracking/bitacora.ts`: hay que quedarse con la del remoto
(`sha: '6a43d32e'`).
