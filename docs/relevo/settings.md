# Relevo — Settings (chat «Settings», cuenta 5, 25/10/2026)

Pedido de Martín (25/10 ~12:00): rediseñar TODAS las pestañas de Settings, en diseño y en función, copiando cómo lo hacen
otras apps y sin textos de sobra. Rama `settings-2510` (worktree `C:/dev/wt-settings-2510`), sin pushear: la sube el Cerebro.

## Qué quedó

**Referencia: los ajustes de Linear** (docs/settings/referencia.md, capturas en docs/settings/referencias/). El molde es
app/_ui/Ajustes.tsx + ajustes.css: índice a la izquierda, columna centrada, título sin bajada, secciones de nombre + tarjeta
con filas (`FilaAjustes`: nombre a la izquierda, control a la derecha; `ancho` baja el control debajo en el teléfono),
`PuntoEstado`, `SELECT_AJUSTES` para los selects, todo guarda al instante.

| Pestaña | Commit | Qué cambió de función |
|---|---|---|
| Perfil | tanda 1 | Campos en la fila que guardan al salir; zona horaria con la lista entera; Tema; «Empresa» fuera para el admin |
| Notificaciones | tanda 1 | Canales (En la app · Celular · WhatsApp · Email) con estado y detalle; «Enviar prueba» en cada uno; el celular desde la computadora; «No molestar» (respetado por lib/push.ts) |
| Seguridad | tanda 2 | Estado de cada forma de entrar a la derecha; el cartel general sólo si falta algo; detalles sin párrafos |
| Instalar la app | tanda 2 | Sólo textos (la descarga de escritorio es del chat MaKo Desktop) |
| General | tanda 2 | Horario de envío en filas (`HorarioEnvioPanel filas`); Criterio en su tarjeta |
| Equipo | tanda 3 | «Invitar» en un modal; filas con rol y «⋯»; buscar con más de 5 |
| Identidades fiscales | tanda 3 | Moneda en una fila; razones sociales con «⋯»; alta y edición en un modal |
| Método | tanda 3 | La lista de servicios con su estado y un detalle por servicio, en vez del asistente de 20 pasos |
| Integraciones | tanda 3 | Sólo el marco (sin bajada). El tablero, Meta y CAPI son de otros chats |

## La API

Todo lo que Settings deja ver o cambiar está en la API de MaKo (área `equipo`), con la tabla pestaña por pestaña y lo que NO
va (cambiar la seguridad, las credenciales de Método, la foto, el tema) en docs/settings/referencia.md, «La API». Once
operaciones nuevas; test: tests/api-mako-settings.test.ts. La tuerca del índice es `IconoMenu configurar` (la dibuja la rama
del Ops Center).

## Cómo se miró

Un banco con los componentes reales (esbuild) y las APIs simuladas, en Chrome headless, a 1280 y 390, con clics (guardar en
el lugar, Escape, prueba de aviso, «No molestar», invitar, «⋯», detalle de Método). El «antes» con los archivos de
origin/main y los mismos datos (docs/hallazgos-ui.md). Capturas: carpeta de notas del Cerebro, `settings-capturas/`.
**No se miró en la app levantada** (sin RAM para un build): falta recorrerlo en producción después del deploy.

## Pendiente (detalle en docs/hallazgos-ajustes.md, «SIN HACER»)
- Seguridad › cerrar las demás sesiones: pide una migración (la sesión es un JWT sin estado).
- Integraciones: el tablero entero, cuando Zernio termine con Meta y CAPI.
- La tuerca en el título del índice: espera el nombre del ícono del chat Ops Center.
- Recorrer las nueve en producción (1280 y 390) apenas se despliegue.
