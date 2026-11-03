# Las apps de MaKo para las tiendas (nativo/)

Las dos son la PWA de `hola-mako.com` dentro de un envoltorio. **No tienen pantallas propias**: la app es `/m`, y lo nativo
sólo suma capacidades del aparato. El plan entero, con las decisiones de Martín y las fuentes: [docs/tiendas-play-appstore.md](../docs/tiendas-play-appstore.md).
Las cuentas son PERSONALES: Play a nombre de Martín y Apple a nombre de Leandro Tejado (3/11/2026). El id de las dos es `com.holamako.app` y **no se cambia
nunca** (T2).

## Android — `nativo/android` (Trusted Web Activity con Bubblewrap)

Se versiona `twa-manifest.json`: el id, `startUrl: /inicio`, los colores claros y oscuros de la app, el push delegado
(`enableNotifications`) y las huellas. El proyecto de Gradle **se genera** con `generar.mjs` (lo mismo que
`bubblewrap update`, sin pedir el JDK) y no va al repo. La plantilla de Bubblewrap 1.27.0 ya apunta a la API 36, la que exige
Play desde el 31/08/2026.

```
cd nativo/android
npm ci
node generar.mjs
```

**Compilar** (pide el JDK 17 y el Android SDK, unos 600 MB, que van a `~/.bubblewrap` la primera vez). Gradle usa unos 2 GB de RAM:
correrlo en una ventana de RAM. `bubblewrap build` hace preguntas en la consola, así que esto hace lo mismo sin preguntar. El flag es la
aceptación de los términos del SDK, y es de Martín:

```
node compilar.mjs --acepto-terminos-android-sdk
```

- **La clave de firma (`upload.keystore`) NUNCA va al repo.** `compilar.mjs` la crea una vez en `~/.mako-tiendas`, con su contraseña al lado y sin
  mostrarla, y deja ahí el `.aab`. Martín guarda una copia. Con Play App Signing, perderla no es fatal: Google rota la de subida.
- **Las huellas SHA-256 van DOS** en `public/.well-known/assetlinks.json`: la de esta clave de subida
  (`keytool -list -v -keystore upload.keystore`) y la de Play App Signing (Play Console → Integridad de la app), que existe
  recién después del primer AAB. Si la app abre con la barra de la URL, falta una de las dos.
- **Hecho cuando** el `.aab` instalado en el Samsung de Martín abre sin barra de URL y «Probar avisos» de `/m/cuenta` llega
  con el ícono de MaKo.

## iPhone — `nativo/ios` (Capacitor 8, sólo iOS)

`capacitor.config.json` carga `https://hola-mako.com/inicio`, con `www/sin-conexion.html` sin red (`errorPath`) y el agente
`MaKoApp-iOS` (el «modo iOS» del paso 3 del plan lo lee para esconder el botón de Google y lo «en camino»). El proyecto de
Xcode (`ios/`) se versiona: es Swift Package Manager, sin CocoaPods, y **se arma en Windows** (`npx cap add ios --packagemanager SPM`
corrió acá el 23/10).

Lo que ya trae el proyecto:
- sólo iPhone (`TARGETED_DEVICE_FAMILY = 1`) y sólo vertical;
- los permisos en español: micrófono, cámara y guardar en Fotos; `ITSAppUsesNonExemptEncryption = NO` (sólo HTTPS);
- `App.entitlements`: el push por APNs y los dominios asociados `applinks:` y `webcredentials:hola-mako.com`;
- el token de APNs pasado a Capacitor en `AppDelegate.swift`;
- los plugins del plan (pasos 8 y 9): push, links (`@capacitor/app`), hápticos, compartir y guardar archivos;
- el micrófono se pide UNA vez: Capacitor ya concede la captura dentro del WebView (`WebViewDelegationHandler`);
- el ícono de 1024 sin transparencia y la pantalla de arranque, dibujados por `scripts/gen-iconos-tiendas.mjs`.

```
cd nativo/ios
npm ci
npx cap sync ios
```

**Compilar NO se puede sin una Mac**: lo hace Codemagic (`codemagic.yaml` en la raíz del repo, a mano, sin Actions) y lo sube a
TestFlight. Necesita la cuenta de Apple (a nombre de Leandro Tejado) y la API key de App Store Connect.

## Lo que falta, y de quién depende

| Qué | Depende de |
|---|---|
| La clave de subida, el primer `.aab` y la prueba cerrada de 14 días | Una ventana de RAM (Gradle), los términos del Android SDK y la cuenta de Play de Martín |
| Las dos huellas en `assetlinks.json` (`node scripts/tiendas-asociar.mjs --huella AA:BB:…`) | La clave de subida y el primer AAB en Play |
| El Team ID en `apple-app-site-association` (`node scripts/tiendas-asociar.mjs --team ABCDE12345`): lo que vende queda afuera de los links | La cuenta de Apple, a nombre de Leandro Tejado |
| La primera corrida de `codemagic.yaml` (es un borrador) | La cuenta de Apple, la API key y la app creada en App Store Connect |
| La clave de los avisos (Integraciones › Apple Push) | La cuenta de Apple, a nombre de Leandro Tejado |
| Mirar en TestFlight: guardar un video, los códigos, un link de WhatsApp, un aviso, modo avión | La cuenta de Apple y un iPhone prestado |

**Lo de la web para iOS ya está** (3/11/2026): el modo iOS en `lib/tienda.ts`; guardar, compartir, los links universales, los hápticos y el token de APNs en `lib/nativo.ts` (usa `window.Capacitor.Plugins`: la web no importa los plugins); el envío en `lib/push-apns.ts`.
