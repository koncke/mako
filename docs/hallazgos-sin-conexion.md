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
- **T2:** hecha el mismo día (abajo, «T2: escribir sin conexión…»).
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

---

## T2: escribir sin conexión y subirlo con el OK de la persona (28/10/2026, rama desktop-offline-t2-2810)

**El pedido** (Cerebro, 28/10): «escribir sin red con la cola de cambios, y al volver la conexión subirla pidiendo el OK de
la persona, con los conflictos campo por campo».

**Trampas del entorno:**
- **La subida no puede ser una ruta de la API, como decía el diseño.** Las acciones del teléfono (`notaLeadAction`,
  `moverEtapaAction`, `moverTareaAction`) llaman a `refresh()`, que sólo vale dentro de una server action. La subida es
  una server action (`app/_sin-conexion/acciones.ts`) que las reusa: las mismas puertas, con la sesión de la persona.
- **Ninguna alta de tarea entra directo al Plan** (lib/api-mako/areas/plan.run.ts). Una tarea escrita sin conexión sube
  como BORRADOR.
  - `crearPropuesta` ya trae `ref` anti-duplicado, que sirve de idempotencia del alta.
  - Ojo: con un `ref` que ya existe y un borrador DESCARTADO, `crearPropuesta` lo revive. Por eso la tabla de
    idempotencia se mira antes, y un cambio subido no vuelve a llamarla.
- **La consecuencia de mover de etapa** (una automatización que le escribe al lead):
  - `secuenciasDeEtapa` es pura, pero `ambitoDeFunnel` (lib/nutricion.ts) no está exportada.
  - Se arma con `ambitoDeSecuencia` y una lectura de `funnels.es_default`, sin tocar lib/nutricion.ts, que la usan otros
    chats.
  - Pide el OK de más a propósito: un agregado que el motor no inscribiría igual lo pide. Si no se puede revisar, también.
- **La copia guardada NO se toca al escribir.** Lo pendiente se aplica encima al dibujar (`conLoPendiente`). Si se
  escribiera en la copia, la renovación con conexión (cada 10 min) borraría lo escrito antes de subirlo.
- **Una copia vencida (30 días) con cambios sin subir ya no se borra.** Perder lo escrito es peor que mostrar una copia
  vieja.
- **IndexedDB pasa a la versión 2** (suma `cola`). La base de la T1 se actualiza sola al abrirla.
- **Antes de escribir se reserva el id** (una fila «en-curso»; la llave única frena a otra ventana que suba lo mismo).
  - Un rechazo de la puerta (sin permiso, el lead ya no está) la suelta: se puede reintentar.
  - Un error que TIRA a mitad la deja, porque no se sabe si la escritura quedó. A los 10 min es «incierta», y la persona
    elige «Subirlo igual» o «Ya quedó». Nunca un segundo intento a ciegas.
- **Si se rota `CREDENCIALES_SECRET` con cambios en la cola,** con conexión no se pueden leer (`otra-llave`) y el panel lo
  dice. Sin conexión, con la clave, sí se ven, pero el cascarón no sube nada.

**Las reglas que quedan:**
- **Nada sale solo al volver.** El panel aparece como una tarjeta chica, se abre con el clic y sube con «Subir».
- Lo que tiene consecuencias empieza SIN marcar («Espera tu OK»). Sin marcar no se manda, y el servidor lo frena igual
  (`espera-ok`) si llega sin el OK.
- **El cascarón no le habla al servidor:** escribe sólo en la cola cifrada. Lo fija el test 6 de los dos archivos.
- **Campo por campo:**
  - igual al «antes» se aplica;
  - igual al «después» ya estaba, y también se guarda como hecho;
  - otro valor es conflicto: no se pisa sin «Aplicar el mío».
- **Desvíos del diseño, decididos:**
  - el texto en conflicto se COPIA, no se guarda solo como nota (una escritura que la persona no eligió no sale);
  - el título de una tarea queda para la T3 (el tablero del dueño sólo se guarda con la fila entera).

**Lo que quedó SIN hacer:**
- **La migración 0346** (`sin_conexion_aplicadas`) se aplica ANTES del deploy. Sin ella, todo cambio vuelve
  «reintentar» y no se escribe nada.
- **La subida contra la app de verdad.** El arnés de CDP no corre server actions: cubre escribir sin conexión y leer la
  cola con conexión. La subida está probada con un servidor de mentira (tests/sin-conexion-cola.test.ts, 5a-5f).
- **Subir desde el cascarón** cuando vuelve la red con la clave abierta (útil si se rotó el secreto): T3.

**Probado rompiéndolo** (28/10/2026, base: 11 de 11 en tests/sin-conexion-cola.test.ts y 16 de 16 en
tests/sin-conexion.test.ts). Cada rotura, restaurada por sha256, la cazó al menos un test. Los resultados están en
C:/dev/revisiones/sin-conexion-t2-roturas.json.

| Rotura | Lo que la cazó |
|---|---|
| R28. El email comparado con mayúsculas | 2 |
| R29. Sin idempotencia | 5a, 5f |
| R30. El conflicto se pisa | 5b |
| R31. Sin «Espera tu OK» | 5c |
| R32. El rechazo no suelta la reserva | 5d |
| R33. Un error a mitad suelta la reserva | 5d |
| R34. Otro negocio pasa | 5e |
| R35. El borrador sin `ref` | 5f |
| R36. Cualquier campo de contacto | 1, 6 |
| R37. Lo pendiente toca la copia | 3 |
| R38. La cola sin tope | 4 |
| R39. La cola sin la persona en el AAD | 4 |
| R40. Vencida borra aunque haya cola | 4 |
| R41. El panel sube solo al montar | 6 |
| R42. Lo de consecuencias viene marcado | 6 |
| R43. La nota sin la puerta del teléfono | 6 |
| R44. El cascarón sube por su cuenta | 6 (de la T1: el `app.js` quedó viejo) |

- **Un test inestable que cazaron las roturas, no el código:** el 5d fallaba sólo bajo carga. El reloj de mentira se leía
  ANTES de crear la reserva con el reloj de verdad, y unos milisegundos dejaban la edad apenas por debajo de los 10 min.
  Ahora salta con margen (+1 min). En la corrida de las 17 roturas aparecía en casi todas, y solo con cada una no aparecía.

**De punta a punta** (C:/dev/revisiones/sin-conexion-t1/, el mismo arnés con los pasos T2):
- Con MaKo caído: la nota, la etapa, el email, la tarea nueva y la tarea movida se ven encima, con «Se sube al volver» y
  «5 cambios esperan la conexión» (capturas 7 y 8).
- Al salir y volver a entrar siguen ahí. En la base son 5 cambios cifrados, sin nada en claro.
- Con conexión, la app los lee en orden con la llave del servidor, y Beto no ve la cola de Ana.

**Lo que cazaron las barredoras** (tests-afectados sobre la T2: las 6 tandas en verde con 499 tests; las barredoras,
2.561 tests con un rojo):
- **Una tabla nueva con `workspace_id` va a `TABLAS_DE_INQUILINO`** (lib/tablas-de-inquilino.ts), para que vaciar o borrar
  un negocio se la lleve. Como no se lee con `getTenantDb()`, va también a `FUERA_DEL_PROXY`, con su porqué
  (tests/tenant-tables-contract.test.ts, INVERSO 1 y 2). Arreglado. Los 30 tests que leen esa lista dan 453/453.
## La verificación de 90d6410eb (Cerebro, 28/10/2026): 2 medias y 7 bajas, todas arregladas

**Lo que NO era lo que parecía:**
- **`listarFunnels()` nunca falla.** Si la base no contesta, devuelve `[]`, que se lee igual que «no hay otros funnels»:
  la copia guardaba sólo el funnel del negocio y no lo decía. Para saber si FALLÓ se usa `leerFunnels()`, que en ese
  caso devuelve `null`. El `.catch(() => [])` de la copia no atrapaba nada: el error ya venía tragado de adentro.
- **`.limit(3000)` no levanta el techo de PostgREST** (1000 por pedido, sin avisar). En un negocio con más de 1000 notas,
  un lead con notas viejas salía «Sin notas guardadas». Ahora las notas se leen por tandas de 200 leads y de a una página,
  con ORDER BY único (`lib/sin-conexion/notas-copia.ts`), y con un tope que se dice (`notasRecortadas`).
- **Una renovación a medias pisaba la última copia buena**, justo cuando MaKo se degrada antes de caerse. `armarCopia`
  dice qué partes no leyó (`huecos`: un funnel, las notas, la lista de funnels), y `conLoDeAntes` (reglas.ts) las toma
  de la copia anterior. `deAntes` guarda de cuándo es cada parte, y el cascarón lo muestra: «No se pudo actualizar el
  CRM: lo que ves es de…».
- **Una escucha de `fetch` con un `return` adentro NO es «no tocar el pedido»**: el navegador despierta al service worker
  en cada pedido igual. Medido: 0 de 6 navegaciones antes, 6 de 6 después. En el teléfono la escucha no se registra; el
  test 5c exige `handlers.fetch === undefined`, no sólo «sin respondWith».
- **Una variable global del service worker no dura**: el navegador lo apaga a los ~30 s sin eventos y la variable vuelve
  a 0. La regla de «renovar cada 30 min» se cumplía en cada arranque (4 pedidos por carga). La hora va al caché
  (`MARCA_RENOVADO`).
- **Limitar los intentos de la clave en el cascarón no protege nada**: quien tiene el perfil copia la IndexedDB y prueba
  sin el cascarón. Lo único que sirve es la fuerza de la clave: mínimo de 8 caracteres, la lista `CLAVES_COMUNES` y nada
  repetido.
- **«Un hash del email más una sal» no se puede**: el cascarón tiene que encontrar la base sin red, así que la sal viviría
  en el mismo perfil que quien mira. Otra cuenta SÍ ve qué emails lo activaron (`indexedDB.databases()`), pero no puede
  abrir nada. Lo que sí se tapa es el tiempo: sin base, el cascarón espera lo mismo que con una clave mala (un PBKDF2 de
  relleno).

**Lo demás:**
- La copia trae el email de la sesión que la armó (`persona.email`). `guardarCopia` no la cifra si es de otra cuenta: la
  cookie podía cambiar entre el pedido de la llave y el de la copia.
- Cada copia vence por su `hecha`, no sólo por `vistoServidor`. Si no, el negocio que la persona perdió no vencía nunca
  mientras entrara a otro.
- Después de un fallo, se espera `CADA_MS` (`tocaGuardar`, con la hora del último intento). Antes cada vuelta a la
  pestaña volvía a pedir la copia entera, la lectura pesada, justo cuando el servidor andaba mal.
- «Borrar lo guardado» saca también el caché del cascarón. El service worker queda, porque es el de los avisos.
- «Probar» usa la precarga y no sale dos veces.

**Probado rompiéndolo** (base: tests/sin-conexion.test.ts 22/22 y push-cableado 11/11; cada rotura sola, restaurada por
sha256 y con el cascarón re-armado): las 23 cazadas.

| Rotura | La cazó |
|---|---|
| R45. Las notas sin paginar · R46. Sin `recortado` · R47. El orden de las notas al revés | 8a |
| R48. Lo de antes no vuelve · R50. Lo cubierto sigue «faltando» | 8b, 8c |
| R49. La hora siempre la de la anterior · R51. Otro negocio presta lo suyo · R52. `listarFunnels` de nuevo · R53. Las notas que fallan no avisan | 8b |
| R54. Guardar pisa · R67. El cascarón no dice de cuándo | 8c |
| R55. La copia de otra sesión se guarda · R56. La copia no vence por su fecha · R59. Sin el PBKDF2 de relleno | 8d |
| R57. La clave de 6 · R58. Las comunes pasan | 2c |
| R60. El teléfono escucha los pedidos | 5c |
| R61. La hora de renovar en una variable | 5, 5a, 5a2, 5d |
| R62. Renueva sin caché · R63. «Probar» sale dos veces · R64. «Borrar» deja el caché | 5a2 |
| R65. El fallo no espera · R66. El fallo no se anota | 8e |

**Sin hacer:** la lista de computadoras con «Desconectar» sigue en la T3. Hoy la ruta de la llave nunca contesta
`desconectada`.
