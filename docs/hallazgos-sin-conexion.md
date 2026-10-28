# Hallazgos — MaKo sin conexión (la app de escritorio sin red o con MaKo caído)

El diseño entero, con por qué la PWA y no Electron, Tauri ni mako-pc: [diseno-mako-desktop-sin-conexion.md](diseno-mako-desktop-sin-conexion.md).
El código vive en `lib/sin-conexion/`, `public/sw.js`, `public/sin-conexion/`, `app/api/sin-conexion/`,
`app/_components/CopiaSinConexion.tsx` y la fila «Sin conexión» de `app/perfil/instalar/`.

---

## T1: leer el CRM y el Plan sin conexión (28/10/2026, rama desktop-offline-2810)

**El pedido.** Martín, 28/10: «revisa las implementaciones que salieron con la llamada de Teo, por ejemplo lo de que el
servidor se caiga y que la app desktop funcione offline». En la llamada le había dicho a Teo: «si se llega a caer tenés tu
aplicación de desktop, que eso funciona siempre» (00:42:00).

**El diagnóstico obvio era el equivocado: «MaKo Desktop» NO es `mako-pc`.**
- `mako-pc` sólo contesta los turnos de la IA. Su regla es «la PC es sólo el cerebro, nunca las manos», y su token es el de
  la IA de esa PC.
- Lo que la gente abre como «la app de escritorio» es la app web instalada (Chrome o Edge en su ventana), más el acceso
  «MaKo» del instalador, que abre el navegador (`mako-pc abrir`, con `?app=1`).
- Por eso lo de sin conexión vive en el service worker y en IndexedDB del navegador, no en `mako-pc`. Ponerlo en `mako-pc`
  le daba los datos del negocio a un token pensado para otra cosa, y no llegaba al teléfono.

**Trampas del entorno:**
- **El layout raíz lee la sesión** (`getUsuarioActual`). Ninguna página de Next puede ser el cascarón: saldría con el
  sidebar y los datos de quien la pidió, y el service worker se lo serviría a otro.
  - El cascarón es estático, en `public/sin-conexion/`.
  - El JS se arma con esbuild (`scripts/sin-conexion/armar.mjs`) y se COMMITEA: el build de Vercel no lo arma.
  - El test 6 lo rearma y frena si quedó viejo.
- **El matcher del proxy excluye `.js` y `.css`, pero no `.html`.** `/sin-conexion/index.html` pasa por el proxy.
  - El service worker lo pide sin cookies. Sin `/sin-conexion` en `PUBLICOS`, el proxy devolvía un 307 al login, y el
    login quedaba guardado como cascarón.
  - Doble guarda: `PUBLICOS`, más `!r.redirected` antes de guardar.
- **`navigationPreload` duplica las navegaciones que el service worker no contesta.** La precarga se tira y el navegador
  pide de nuevo.
  - Por eso las de afuera del cascarón (`/api/`, `/l/`, `/compartido/`, `/r/`) se contestan con la precarga, sin tocarlas.
  - **`navigationPreload.enable()` sobrevive al service worker.** Si una versión futura saca el `fetch`, tiene que llamar
    a `disable()` en su `activate`.
- **`sw.js` no cambia de bytes con cada deploy.** El navegador no lo reinstala, así que el cascarón no se renovaría solo.
  - Se renueva por tiempo: cada `RENOVAR_CADA_MS` (30 min), después de una navegación que anduvo.
  - Si cambia la LISTA de archivos, se sube el número de `CASCARON` y `activate` borra el caché viejo.
- **Un 500 no es «MaKo caído».** Es el error de una página, y se deja pasar.
  - El cascarón sale sin red, pasados 25 s sin respuesta, o con 502, 503 o 504 (lo que devuelve Vercel con la función
    caída).
  - **El plazo era de 15 s y era poco:** una página sin `loading.tsx` no manda los encabezados hasta terminar de armarse, y
    el CRM llegó a tardar 10 s (docs/hallazgos-mobile.md). Una página lenta habría mostrado «MaKo no responde». Un MaKo
    caído contesta rápido: conexión rechazada o un 5xx.
- **El pin viejo «sw.js sin handler fetch»** (tests/push-cableado.test.ts, 5) se cambió por la regla de fondo: un solo
  `cache.put`, el de la lista fija, sin cookies. `tests/sin-conexion.test.ts` (5a-5d) corre el service worker de verdad en
  una `vm`.
- **El teléfono tiene un service worker registrado** (los avisos push), pero todavía no tiene cascarón.
  - `ES_TELEFONO` deja el `fetch` sin tocar nada ahí. Es la misma regla que `esTelefono` de lib/app-escritorio-reglas.ts.

**Las reglas que quedan:**
- El service worker **nunca** guarda una respuesta del servidor.
- El cascarón **nunca** le pide nada al servidor: anda sin red. Lo fija el test 6, sin `fetch(` en `app.js`.
- Los datos se dibujan con `textContent`, nunca con `innerHTML`.
- **El mismo mensaje** para un email sin nada guardado y para una clave equivocada: otra cuenta no se entera de qué hay.
- **El vencimiento (30 días) se mira DESPUÉS de la clave.** Si no, quien prueba un email ajeno borraba lo de otro, o se
  enteraba de que existía.
- **La llave es de la PERSONA** (`usuarioPropio`, que ignora la impersonación), no del negocio que mira. **La copia no se
  arma mirando a otro** (`estaImpersonando`): lo de un cliente nunca queda en la PC de quien lo inspecciona.
- **El AAD lleva el email y el negocio.** Aunque el servidor les diera la misma llave a dos personas, la copia de una no
  abre como de la otra (test 2b).
- La copia se arma con las MISMAS lecturas del teléfono (`tableroCrm` con `conContacto` y el tope de la copia,
  `leerPlanHoyConTablero`). Sin `op`, el teléfono sigue con sus 40 tarjetas.
- **Si se rota `CREDENCIALES_SECRET`, el servidor da OTRA llave.** Esa llave no es la que la clave envolvió.
  - Sin la huella, la copia nueva se guardaba con la llave nueva y, sin conexión, no abría. El cascarón decía «es de una
    versión anterior: abrí MaKo con conexión», y abrirla con conexión no lo arreglaba.
  - Ahora la llave guardada lleva su huella (SHA-256). Si no coincide, no se guarda (`otra-llave`), y Perfil dice «La copia
    dejó de renovarse: elegí la clave de nuevo» (test 2d).

**Lo que mira la verificación del Cerebro** (28/10/2026), y dónde queda probado:
- **Cerrar sesión, o cambiar de cuenta o de negocio, no deja la llave en memoria:**
  - la DEK vive sólo dentro de `guardarCopia` y de `abrir`, nunca en una variable del módulo (6b);
  - lo guardado no tiene la llave ni la clave en claro (2f);
  - el componente que renueva la copia depende del email de la sesión: otra cuenta, otro ciclo.
- **La base de una cuenta no abre con la llave de otra, ni con el mismo email en otro negocio:** 2b y 2e.
- **El cascarón nunca muestra la sesión anterior antes de la clave:**
  - arranca siempre en la pantalla de la clave;
  - `pagehide`, volver del historial (`pageshow` con `persisted`), «Salir» y 15 minutos sin uso la vuelven a pedir;
  - no guarda nada en localStorage, ni siquiera el último email (6b).
- **Lo que tiene consecuencias nunca sale solo al volver:** en T1 el cascarón no escribe ni le pide nada al servidor (6 y 6b:
  sin `fetch`, `XMLHttpRequest` ni `sendBeacon`). «Espera tu OK» se prueba en la T2, que es la que escribe.

**Lo que cazaron las barredoras de `tests-afectados`, y no los tests propios:**
- **El texto en voseo** («Entrá», «mirás», «Volvé», «Abrí»). La interfaz va en español neutro, porque el producto se usa en
  México (tests/puente-panel-copy.test.ts). El cascarón también cuenta, aunque sea un `.ts` que se arma aparte.
- **«Perfil › Instalar la app».** La tab se llama **Settings** (tests/mako-nombres-de-tabs.test.ts): toda ruta «X › Y»
  del código empieza por un `label` de app/_components/nav.ts.
- **Un error con `role="alert"` sin `<ReportarASoporte />`** (tests/reportar-a-soporte.test.ts).
- **La trampa de la medición:** la tanda de `tipos-por-tandas` tarda 4,5 min con 5 GB libres y pasa los 10 min (y se mata)
  con menos de 1 GB, con cuatro corridas de otros chats a la vez. Ese rojo es de la carga, no del cambio. Y una PAUSA del
  Cerebro corta las corridas a mitad (salen con 127 y sin resultado): no cuentan como verdes ni como rojos.

**Probado rompiéndolo** (28/10/2026, base: 16 de 16 en tests/sin-conexion.test.ts). Cada rotura, restaurada por sha256, la
cazó al menos un test. Los resultados están en C:/dev/revisiones/sin-conexion-t1-roturas-*.json.

| Rotura | Lo que la cazó |
|---|---|
| R1. El AAD de la copia sin el email | 1, 2b |
| R2. El vencimiento antes de la clave | 2c |
| R3. «Desconectada» no borra | 2c |
| R4. El service worker guarda la respuesta de una navegación | 5a, 5d |
| R5. El cascarón pedido con cookies | 5a, 5d |
| R6. Sin el 502/503/504 | 5b |
| R7. Sin el plazo | 5b (con `timeout`: sin él, el test colgaba) |
| R8. La API recibe el cascarón | 5c |
| R9. El teléfono también | 5c |
| R10. `innerHTML` en el cascarón | 6 |
| R11. `app.js` viejo | 6 |
| R12. La copia mirando a otro | 7 |
| R13. La llave por negocio | 7 |
| R14. El layout sin `!vista` | 7 |
| R15. El teléfono con todas las tarjetas | 7 |
| R16. La cinta en UTC | 3 |
| R17. La llave sin la persona | 4 |
| R18. `/sin-conexion` no público | 7 |
| R19. Un script en línea en el cascarón | 6 |
| R20. La clave sin mínimo | 2c |
| R21. Sin la huella de la llave | 2d |
| R22. El AAD de la copia sin el negocio | 1, 2e |
| R23. Sin el `pagehide` (volver del historial mostraba lo abierto) | 6b |
| R24. La llave guardada en una variable del módulo | 6b |
| R25. La DEK cruda en la base | 2f |
| R26. Abrir sin el reloj de la inactividad | 6b |
| R27. El cascarón recuerda el último email | 6b |

- **La trampa de la prueba:** las anclas del script de roturas fallaban en silencio en `public/sw.js` y
  `lib/rutas-publicas.ts`, porque el worktree los tiene con CRLF. El script ahora convierte el ancla al fin de línea del
  archivo, y un ancla que no aparece se informa como «ANCLA 0», nunca como cazada.

**Medido el 28/10/2026, sólo leyendo:**
- El negocio más grande: 1.173 leads, con unos 455 bytes por fila.
- El Plan más grande: 630 tareas, con unos 2,4 KB por fila.
- Una copia entera pesa menos de 3 MB. Por eso se guarda todo el tablero, no las 40 tarjetas del teléfono.
- El cascarón armado pesa 21 KB.

**Lo que quedó SIN hacer:**
- **T2:**
  - escribir sin conexión;
  - la cola con su id, y la tabla `sin_conexion_aplicadas`;
  - los conflictos campo por campo;
  - «Espera tu OK».
- **T3:**
  - Calendar, el Second Brain y los documentos;
  - Windows Hello (PRF);
  - `mako-pc abrir` en una ventana propia (`--app=`);
  - el teléfono: la TWA y el iPhone con `WKAppBoundDomains`;
  - la lista de computadoras, con «Desconectar». Hoy la ruta de la llave nunca contesta `desconectada`: no hay tabla de
    computadoras.
- **Sin probar:** con la app de verdad, en producción, con el ws3 y el wifi cortado.
- **Lo que sí se probó de punta a punta** (C:/dev/revisiones/sin-conexion-t1/, LEEME y capturas):
  - un Chrome sin ventana corrió el `sw.js` y el cascarón de la rama, con las funciones de la app, contra una API de
    prueba;
  - activar y guardar, con dos cuentas en el mismo navegador;
  - MaKo con 503 y MaKo apagado;
  - sin red, emulada por CDP;
  - Beto con la clave de Ana;
  - «Salir» y volver del historial;
  - el teléfono a 390 px.
  - **La trampa del arnés:** `node --import tsx` busca `tsx` desde la CARPETA DEL SCRIPT. Desde el scratchpad no lo
    encuentra: se corre con el worktree como carpeta de trabajo.
- **Tanda posterior:**
  - lo de que la app gasta los tokens de la suscripción del cliente (00:12:40). Hoy cubre sólo los chats con MaKo.
