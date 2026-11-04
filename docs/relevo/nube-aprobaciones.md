# Relevo: el vigía de las aprobaciones (4/11/2026, nube)

Lo escribió el chat «Vigía de aprobaciones» en la nube (`Claude-Cuenta: nube`). Desde la nube no se le puede escribir al Cerebro:
lo que le iba a decir está acá. La nube no ve la base ni `.env.local`: nada de esto se corrió contra producción.

## Lo pedido

Martín, 4/11/2026, textual: «crea un script que me vaya avisando de todas las notficaciones de aprobaciones pendientes que tenemos
de las diferentes apps que vamos creando... En Meta, la extensión, playstore, appstore, google, etc...». Y el mismo día: nada de
avisos de rutina.

## Lo hecho

| Punta | Qué cambia | Estado |
|---|---|---|
| `punta/vigia-aprobaciones` | Un vigía que revisa cada hora diez aprobaciones y le avisa a Martín sólo cuando algo pasa a aprobado, rechazado o «piden algo», por la bandeja de avisos y el teléfono. Martín pide la lista a MaKo en el Ops Center. Suma dos tarjetas a Integraciones para las claves. | La corrida 172 dio verde en tests (714 archivos), tipos y guardas, y chocó al llevarla a main: main sumó hitos a la misma bitácora mientras corría. Se mezcló main y se volvió a subir: mirar la corrida siguiente de `punta.yml` y el deploy en «Ready» |

- **Dónde corre:** en el servidor, `/api/cron/vigia-aprobaciones`, a los :11 de cada hora (`vercel.json`). No usa la PC ni el Runner,
  así que no gasta tokens de Claude ni depende de un chat abierto.
- **Qué vigila:**
  - la app de iPhone;
  - la de Android: la prueba cerrada, producción y la cuenta de Play Console;
  - la extensión de Chrome;
  - los permisos de la app de Meta y las verificaciones de Meta;
  - la app de Google;
  - los dominios de correo de MaKo en Resend;
  - el certificado de Windows.

  El inventario está en `lib/vigia-aprobaciones.ts` (`ITEMS`).
- **Cómo avisa:** una fila en la bandeja de avisos del workspace de la plataforma y un push a sus admin (`avisoSoloEnLaApp`). Es UN
  mensaje por vuelta, con lo que pide algo primero.
- **La primera vuelta** manda un solo mensaje con lo que hay que mirar a mano (lo que no tiene API o le falta la clave). Después,
  sólo novedades.
- **La lista cuando él la pida:** en el Ops Center, «¿qué aprobaciones siguen pendientes?». La lee `ver_aprobaciones_pendientes`, en
  el área operaciones, sólo para la plataforma y sin HTTP.
- **También se arregló** `scripts/version-en-tienda.mjs`: la 0.75.0 cambió la descripción de la extensión y la lectura del manifest
  iba a quedar muda el día que se publique.

## El comando exacto

No hace falta correr nada para que avise: el cron arranca solo con el deploy. Para mirar sin esperar la hora, desde el clon de la
PC (lee la base de `.env.local`, que es producción):

```bash
npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts
```

Muestra la lista guardada y no lee nada afuera.

```bash
npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts --probar
```

Lee cada fuente ahora y dice qué contesta. No guarda ni avisa: sirve para probar las claves recién cargadas.

```bash
npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts --correr
```

Una vuelta de verdad, igual que el cron: guarda y, si algo cambió, Martín recibe el aviso.

## Las claves que faltan (por nombre)

Las carga Martín en Integraciones, en el workspace de la plataforma. Las dos tarjetas nuevas sólo las ve el super admin. Ningún
chat ve las claves en texto.

| Clave | Tarjeta | Para qué | Sin ella |
|---|---|---|---|
| `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_P8` | App Store Connect | Leer si Apple aprobó, rechazó o pide algo de la app de iPhone | Sólo se sabe si ya está en la tienda (búsqueda pública) |
| `TIENDAS_GOOGLE_CUENTA_SERVICIO` (el JSON) | Google Play y Chrome Web Store | Leer la revisión de Play (prueba cerrada y producción) y de la extensión | Producción y la extensión, por la ficha pública; la prueba cerrada, a mano |
| `CWS_PUBLISHER_ID` | La misma | Leer la revisión de la extensión | La versión publicada, por la ficha pública |
| `RESEND_ADMIN_API_KEY` (variable de Vercel, la misma que ya pide `lib/resend-dominios.ts`) | — | Leer los dominios de MaKo en Resend | «Míralo a mano» |
| `MAKO_META_APP_SECRET` (ya está en Vercel: es la del callback de «Conectar con Meta») | — | Leer qué permisos de Meta quedaron aprobados | — |

Cómo se sacan, en orden. Los pasos están también en el tutorial de cada tarjeta:

1. **App Store Connect:** Usuarios y acceso › Integraciones › App Store Connect API › Claves del equipo › «+», nombre «MaKo vigía»,
   acceso «Developer», Generar, y bajar el `.p8`. ⚠️ No se midió que «Developer» alcance para leer las versiones: si «Probar
   conexión» dice que la clave no tiene acceso a la app, se crea con «App Manager».
2. **Google:** en Google Cloud, proyecto `mako-500317`:
   - crear la cuenta de servicio «MaKo vigía» y bajar su clave en JSON;
   - habilitar las APIs «Google Play Android Developer» y «Chrome Web Store»;
   - invitar su email en Play Console › Usuarios y permisos, sólo para ver la app;
   - sumarla en el panel de la Chrome Web Store › Cuenta;
   - el `CWS_PUBLISHER_ID` sale de ese mismo panel.

   Play Console recién deja invitarla cuando la cuenta pase la verificación de identidad.

## Lo que no se midió

- **Ninguna API real.** Las formas salen de la documentación oficial leída el 4/11 (`docs/hallazgos-operaciones.md`, «El vigía de
  las aprobaciones») y los tests las imitan. El proxy de la nube no deja llegar a iTunes, Play ni la Chrome Web Store.
- **El prefijo del estado de Play** (`RELEASE_LIFECYCLE_STATE_`): la documentación lo muestra con y sin prefijo, y se aceptan las dos
  formas. Un estado desconocido da «no pude leer», nunca «aprobado».
- **La pista de la prueba cerrada se lee como `alpha`**, que es la pista cerrada por defecto. Si Martín crea una con otro nombre, hay
  que cambiarla en `leerPlayPruebaCerrada`.
- **El link de App Store Connect** (`/apps/6830383006/distribution`) no se abrió.
- **El aviso en el teléfono de Martín:** la fila y el push salen por la misma puerta que el bot (`avisoSoloEnLaApp`), pero no se vio
  llegar.

## Lo que espera a Martín

1. Cargar las claves de arriba, cuando quiera. Sin ellas el vigía igual avisa lo que se puede leer de las fichas públicas, de Meta y
   de Resend.
2. Decir si en la PC sigue corriendo un `vigia-revisiones/`, fuera de git, que menciona `docs/hallazgos-ads.md` (24/10). Si hace lo
   mismo, se apaga para que no avise dos veces.

## Dónde está todo

- **El inventario y las reglas:** `lib/vigia-aprobaciones.ts`.
- **Las fuentes:** `lib/vigia-aprobaciones-fuentes.ts`.
- **El cableado:** `lib/vigia-aprobaciones-server.ts`, `app/api/cron/vigia-aprobaciones/route.ts` y `scripts/vigia-aprobaciones.mts`.
- **Las tarjetas:** `lib/metodo-catalogo.ts`, `lib/integraciones-catalogo.ts`, `lib/metodo-verificar.ts` y `app/_components/ServicioVisual.tsx`.
- **Los tests:** `tests/vigia-aprobaciones.test.ts` y `tests/vigia-aprobaciones-fuentes.test.ts`. Son 26 casos y 12 roturas,
  cada una en rojo.
- **Un ítem nuevo** se suma en `ITEMS` y en `LECTORES`; el test falla si uno no tiene al otro.
