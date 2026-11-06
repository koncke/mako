# Relevo: Approvals, los paneles sin API y la extensión que se publica sola (5/11/2026, nube)

Lo escribió el chat «Approvals» en la nube (`Claude-Cuenta: nube`). Desde la nube no se le puede escribir al Cerebro: lo que le
tocaba decirle está acá. La nube no ve la base, ni `.env.local`, ni los paneles: nada de esto se corrió contra producción.
Lo de antes del vigía (las claves, los comandos), en [nube-aprobaciones.md](nube-aprobaciones.md).

## Lo pedido

Martín, por el Cerebro: «todo deberías poder revisarlo tú, no hay nada que debería hacerlo yo a mano» y «si hay cosas que
publicar... automáticamente». Tres cosas, en este orden: una pestaña Approvals, que ninguna fila diga «a mano», y que la extensión
se publique sola en la Chrome Web Store.

## Lo hecho

Todo por `punta/approvals`, en tres tandas. Creem rechazó la tienda de MaKo el 5/11 y es definitivo (docs/creem-retiros.md): su fila
es un hecho registrado (`definitivo` en `ITEMS`), rechazada, sin panel que mirar y sin «a mano».

| Tanda | Qué cambia para Martín |
|---|---|
| 1 | **Approvals** en el menú de su foto (computadora y teléfono): cada aprobación con su estado, desde cuándo, cuándo se leyó, la nota, qué falta y el link. Lo que pide algo va arriba |
| 2 | Ninguna fila dice «a mano»: lo que no tiene API se lee de su panel (lo guarda una tarea del Cerebro). Lo que falta se dice exacto, con «Cargarla» para las claves |
| 3 | La extensión se publica sola: cuando main tiene una versión más nueva que la tienda, el vigía la sube y la manda a revisión |

Declarado en la API de MaKo:
- `ver_aprobaciones_pendientes`: devuelve lo mismo que la pestaña, con el orden, «viejo» y lo que falta en palabras.
- `anotar_lectura_de_panel` (nueva, confirmación por chat, sólo la plataforma): «Google ya aprobó la app» lo anota MaKo, igual que la tarea.
- Publicar la extensión no es una operación: lo hace el cron solo. Su estado sale en la fila de la extensión de `ver_aprobaciones_pendientes`.

## Lo que le toca al Cerebro: la tarea programada que lee los paneles

Una tarea programada en la PC, con el navegador de Martín y su sesión iniciada en cada panel. Una vez por día alcanza (una
lectura vale 24 horas). Sin ella, esas cuatro filas dicen «Sin leer». Si deja de correr, a las 24 horas pasan a «no pude
leerlo» y Martín recibe UN aviso. Esa es la red: el silencio de la tarea lo mide el servidor.

**Por cada panel:**
1. Abrir la URL.
2. Mirar lo que dice la tabla de abajo.
3. Guardar lo que diga, desde el clon de la PC (lee `.env.local`):

   ```bash
   npx tsx --conditions=react-server scripts/vigia-paneles.mts --guardar <id> <estado> <nota>
   ```

   - `<estado>` es uno de `aprobado`, `en_revision`, `rechazado`, `piden_algo`, `sin_enviar` o `sin_publicar`.
   - Con `auto` en lugar del estado, la nota es el texto del panel y el script lo traduce con la tabla. Si el texto no está en
     la tabla, lo guarda como «no pude leerlo» con el texto literal, para corregir la tabla.
   - Si la página no se pudo leer (pide login, cambió):

     ```bash
     npx tsx --conditions=react-server scripts/vigia-paneles.mts --no-pude <id> <motivo>
     ```

     Así queda dicho, y el estado guardado no se toca.

**Para ver lo que hay guardado o imprimir esta tabla desde el código:** `--ver` muestra lo guardado; `--lista` imprime la tabla,
que es la fuente de verdad (`ITEMS[].panel` en `lib/vigia-aprobaciones.ts`).

| id | URL | Qué mirar | Si dice… → estado |
|---|---|---|---|
| `play-cuenta` | https://play.google.com/console/developers | El cartel de arriba de la página de inicio y «Verificación de identidad» en los detalles de la cuenta | «rechaz» → rechazado · «se requiere una acción» / «verifica tu identidad» → piden_algo · «estamos verificando» / «en revisión» → en_revision · «solicitar acceso a producción» → sin_enviar · «se verificó tu identidad» / «identidad verificada» → aprobado |
| `meta-verificaciones` | https://developers.facebook.com/apps/2586146911825340/settings/basic/ | La verificación del negocio y la de acceso. Si una está aprobada y la otra no, manda la que no | «rechaz» → rechazado · «se requiere una acción» / «action required» → piden_algo · «en revisión» / «in review» → en_revision · «iniciar verificación» / «no verificado» / «not verified» → sin_enviar · «verificado» / «verified» → aprobado |
| `google-oauth` | https://console.cloud.google.com/auth/verification?project=mako-500317 | El estado arriba del «Centro de verificación» | «rechaz» → rechazado · «se necesita una acción» / «action needed» → piden_algo · «en revisión» / «pending» → en_revision · «sin verificar» / «not verified» → sin_enviar · «verificación completada» / «verified» → aprobado |
| `firma-windows` | https://secure.ssl.com/certificate_orders | El estado del pedido del certificado de firma de código en «Orders» | «rejected» / «canceled» → rechazado · «documents required» / «action required» → piden_algo · «validating» / «pending» → en_revision · «issued» → aprobado |

⚠️ Los textos son los esperados, no medidos. La nube no ve los paneles. Creem no está: rechazó la tienda y es definitivo. La primera vez que la tarea lea cada uno, conviene
`--guardar <id> auto "<texto del panel>"`: lo que no esté en la tabla vuelve como «no pude» con el texto, y se corrige la tabla en
`lib/vigia-aprobaciones.ts` (`panel.traduccion`; el orden importa: lo negado va antes de lo aprobado, y un test lo cuida).

⚠️ No la arma la nube a propósito. Un cron de sesión no es infraestructura (AGENTS.md). Acá no hay otra forma, porque los
paneles piden la sesión de Martín. Por eso la red es del servidor: la regla 6 de `lib/vigia-aprobaciones.ts`.

## Lo que espera a Martín (sin cambios de fondo)

1. Las claves de [nube-aprobaciones.md](nube-aprobaciones.md), en Integraciones. Desde hoy, en Approvals cada fila que las
   necesita tiene un botón «Cargarla» que abre esa tarjeta ahí mismo.
2. **Para que la extensión se publique sola**, la cuenta de servicio de Google tiene que estar sumada en el panel de la Chrome
   Web Store (sección «Cuenta») con permiso para publicar, y `CWS_PUBLISHER_ID` cargado. Sin eso la fila de la extensión dice
   «se manda sola apenas estén las claves», y no falla nada.

## Lo que no se midió

- **La API V2 de la Chrome Web Store, de verdad.** Las formas son las del repo y la documentación; la nube no llega.
  - La primera publicación real va a decir si el cuerpo de `:upload` y `:publish` es el que espera Google.
  - Si no lo es, la fila de la extensión dice el motivo (el status y el mensaje de Google).
  - A los tres intentos pasa a «piden algo» y avisa una vez.
  - Si eso pasa, se corrige en `lib/extension-publicar.ts` (`subir`, `publicar`), con su test.
- **Que el zip llegue a la función del cron.** Va por `outputFileTracingIncludes` en `next.config.ts`. Sin él la fila diría «no
  encontré el zip de la 0.76.0 en este deploy».
- **La pestaña en un navegador.** La nube no levanta la app con la sesión de Martín. Se miró en tests: el orden, los textos, el
  teléfono y las rutas.

## Dónde está todo

- La pestaña: `app/admin/approvals/` y `app/m/approvals/`; el menú, `app/_components/nav.ts` (`SUPERADMIN_MENU`); el teléfono,
  `lib/movil-rutas.ts`.
- Las reglas: `lib/vigia-aprobaciones.ts` (la lista, los paneles, la regla 6) y `lib/extension-publicar.ts` (las seis reglas de la
  publicación).
- El cableado: `lib/vigia-aprobaciones-server.ts` y `app/api/cron/vigia-aprobaciones/route.ts` (180 s).
- Los scripts: `scripts/vigia-paneles.mts` (los paneles) y `scripts/vigia-aprobaciones.mts` (la lista y `--probar`).
  - ⚠️ `--correr` también publica la extensión si hace falta.
  - `scripts/publicar-extension.mjs` quedó retirado: habla la API V1, que se apagó.
- La cosecha: [docs/hallazgos-operaciones.md](../hallazgos-operaciones.md), «Approvals: la pestaña, los paneles sin API…».
