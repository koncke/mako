# Relevo del Cerebro, 4/11/2026 ~06:00 ART

**Cómo se sube ahora:** cada rama va a `punta/<nombre>` (`.github/workflows/punta.yml`) y llega sola a main con verde. Lo que no lee producción se delega a chats en la nube; se les escribe con SendMessage por su título y no contestan: dejan `docs/relevo/nube-<área>.md`. Un rojo: `node ~/.claude/guardia/vigia-ci.mjs estado`; si es de un chat, se le pasa el error y `visto <id>`.

**Chats en la nube corriendo:** Spy (búsqueda, detalle, anuncios; ya recibió el análisis del video), Chequeo eficiente, Ops Center gurús, Dashboard, Grabar llamadas, Commits sin subir (etiquetas `rescate/*`), Tickets (fijo: se le pasa cada ticket por mensaje), WhatsApp anti-ban, Email de Mauricio, Tiendas (cuenta de revisión, Partners, privacidad).

**Local:**
- Grupos en la app (Joan): rearmado sobre main en `punta/grupos-app` por la nube (4/11), con la 0372 ya aplicada. Falta probarlo en producción, en el ws3: docs/relevo/nube-grupos.md. Después, la rama `avisos-bot-corte-0311`, con el sí de Martín.
- Runner: su chat recibió el pedido de quedar siempre activo y detectar la cuenta; `runner-servicio-3010` a `punta/runner-servicio`. Lo que corre Martín se lo pide ahí, en un comando.
- `punta/tickets-0411` (#50 a #53): tres veces chocó con una bitácora. Si vuelve a chocar: `git merge origin/main` y separar los dos hitos. Datos a reparar en ws11, a confirmar con Leila: leads 1713, 1871, 2634, 1712.

**Play:** prueba interna publicada sólo para Martín, https://play.google.com/apps/internaltest/4701620396507126219. En su Chrome, Play Console es `/u/1/`. Falta: cuenta de revisión → App access → Público objetivo → enviar Data safety (sumar «Device or other IDs») → capturas → prueba cerrada con 12 testers, 14 días. Sube archivos con Claude in Chrome (`file_upload`) desde una carpeta de la sesión.

**Esperan a Martín:** subir el tope de Actions a US$130; correos de 12 a 15 testers; clave de Resend y plan para Mauricio; pegar la clave de Apple Push; prototipo del chat móvil; prueba del aviso en su Android.

**Sin hacer:** la auditoría completa de los pedidos de Martín (workflow frenado por RAM); medir minutos de Actions del día.

---

# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⚠️ ANTES DE TODO: ¿DE QUÉ CUENTA SOS? El marcador MIENTE, y medirlo mal miente igual

**`~/.claude/cuenta-activa.txt` y el hook de arranque son una FOTO de la cuenta ANTERIOR.** Al cambiar de cuenta siguen
diciendo la vieja y no dan ningún error. Martin, 30/10/2026: «deja registrado siempre checkear eso».

**La huella de una cuenta es el `resetsAt` SEMANAL de `get_usage`. Se compara contra TODAS las cuentas**
(`~/.claude/operaciones/uso/claude*.json`), **nunca contra `uso-semanal.txt` solo**.

- ⚠️ **`uso-semanal.txt` guarda la última medición de CUALQUIER cuenta**, no de la tuya.
- ⚠️ **Un reset avanza 7 días EXACTOS.** Sin sumarlos, toda cuenta vieja parece nueva.
- La lista de chats es por cuenta: si los que ves son de una fecha vieja, es esa cuenta vieja.
- Si no cierra, **preguntale a Martin y gana él**. Después reescribí el marcador, el `.tsv`, `uso-semanal.txt`,
  `uso-cinco.txt` y `operaciones/uso/<cuenta>.json`.

**El 30/10 me equivoqué en las DOS direcciones en diez minutos**, y las dos cuestan caro:
1. Le creí al marcador («claude3, 95 %») en una cuenta que estaba al **8 %**, y estuve por cerrar el día.
2. Al medirlo, comparé sólo contra `uso-semanal.txt` —que tenía los números de claude3— y la declaré cuenta nueva
   («claude6»). Era **claude1**: reseteaba el 28/10 09:59:59.973Z y medía 04/11 10:00:00.302Z, siete días justos.

**Lo primero que falla al estrenar o retomar una cuenta** (Martin lo pidió el 30/10): el **Runner** tiene que arrancar
para que la cuenta quede medida. Si `~/.claude/operaciones/uso/<cuenta>.json` no existe, nadie la midió y el Uso del
SuperAdmin no la ve. ⚠️ **Si el chat no tiene `start_session`, el Cerebro NO puede abrir el Runner**: lo abre Martin,
y mientras tanto se escribe ese JSON a mano con lo que da `get_usage`.

## ⏩ 3/11, ~17:30, cuenta 5 (Ananda): WhatsApp baneó el …2605

- La voz de MaKo está en el número personal de Martín (`mako.voz.instancia = mako_ws9`, pedido textual suyo); el canal sigue en el …2605. El botón para apagarla está en /agencia. Si WhatsApp devuelve el …2605, al reconectar la voz vuelve sola.
- MaKo está muda en 8 de 14 grupos (ws 15, 17, 18, 19, 20, 21, 22, 23): el personal no está adentro. Rehacerlos es de Martín.
- Lo oficial, costos y qué se pierde: docs/hallazgos-comunicacion.md, entrada del 03/11.

## ⏩ 3/11, ~12:00, cuenta 5 (Ananda): lo último

- **Producción:** sirve `12dc54318`; los deploys de la noche ya no fallan. El tren `tren-0311` (`C:/dev/wt-push-q`) está en
  `integracion` (`9e693a5bd`, por Actions, ~40 min): referencia de la API regenerada, el desplegable de Instagram que no
  salía nunca (la ruta cortaba a los 15 s y Apify tarda 20), el aviso del CRM de Brigitte, el estudio de video.
- **Lo pendiente entero:** `docs/relevo/pendientes-0311.md`.
- **El Runner NO armó su cron:** a un pedido de otro chat contesta «sólo si vos me lo pedís directamente». Lo tiene que pedir
  Martín en el chat Runner. Sin eso, lo del Centro no llega.
- **Chats en la nube, sin avisar al terminar (se miran con `git ls-remote origin 'refs/tags/nube/*'`):** gurus-0311,
  brain-docs-0311, dashboard-0311, tickets-0311, spy-modal-0311, extension-tienda-0311, thiago-0311, ops-center-0311. Las
  bases están en las etiquetas `nube-base/*`. Local: «Cobros: cuotas» y «Seguridad y plugin».
- **Sin subir de ramas locales:** `runner-servicio-3010` (medir antes la 0355), `diseno-web-3110`, `spy-rehecho-3110`,
  `aut-2510`, `crm-bajas-3010`, `pricing-bloqueantes-3010`, `landing-high-ticket-2910`.
- **Publicar la extensión 0.74.4 en la tienda:** la API está muerta (`deleted_client`); va por el panel con el Chrome aparte
  (`docs/hallazgos-extension.md`). Mientras, el chat de la extensión hace que nadie vea más «Descargar».

## 🔚 RELEVO FINAL DE claude1 — 3/11/2026 ~00:50, al 98 %

## ✅ El ticket #45 ya está commiteado y en `main` (`1efb12f08`)

Quedó resuelto después de escribirse este relevo. **No hay nada sin commitear en `C:/dev/wt-push-q`.**

**Qué es:** Leila Fittipaldi (ws 11) pidió «activa la función "Aprende solo" en el Second Brain» y
**MaKo le contestó que eso no existe. Es falso**: existe desde el 25/10 y es el botón de la cabecera
del Mapa (`app/second-brain/AprendeSolo.tsx`).

**La causa:** el catálogo de funciones (`lib/funciones-mako.ts`) la nombraba **«Aprender solo»**, en
infinitivo, y la búsqueda es por palabras: nunca emparejó con lo que ella escribió. Ya está con el
nombre textual de pantalla.

⚠️ **La regla que queda, y vale para todo el catálogo: se usa el nombre que la persona LEE en la
pantalla, no una forma parecida. Si no, MaKo NIEGA lo que sí tiene, que es peor que no tenerlo.**

⚠️ El ticket venía clasificado como «pedido de algo que MaKo todavía no tiene». **No lo era.** Al
cerrarlo, el hito «Hecho» lleva `tickets: [45]`.

## 🔴 EL DEPLOY, ESTADO AL CORTAR (3/11 ~03:25) — EL ERROR CAMBIÓ DOS VECES

**1. Tamaño de función (250 MB): RESUELTO.** `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` ya está creada en
el proyecto `mako` (production, preview y development) con
`node --env-file=C:/dev/mako-api/.env.local scripts/vercel-funciones-grandes.mjs` (idempotente).

**2. Apareció OTRO error, distinto: espacio en la máquina de build.** El deploy de las 02:57 ya no
se queja del tamaño de la función —pasó esa barrera— sino del disco. Lo que Vercel lista como más
pesado:

| | |
|---|---|
| `node_modules/onnxruntime-node/.../libonnxruntime_providers_cuda.so` | **327 MB** |
| `.git/objects/pack/*.pack` | **236 MB** |
| `@next/swc-linux-x64-gnu` (DOS copias) | **124 MB** c/u |

⚠️ **Las dos primeras son deuda vieja y valen más que este incidente:** se está copiando **el
historial de git entero** a la máquina de build, y hay un **ONNX con proveedor CUDA** que en Vercel
no sirve para nada porque no hay GPU. Entre las dos, **más de 500 MB de disco** por build.

**3/11 ~04:25 — CÓMO SIGUIÓ, y la causa está encontrada.** Los builds de `be38d9156` cerraron en
`ERROR` por `ENOSPC`, y el log dice exactamente dónde: **`Build Completed in /vercel/output [4m]` y
después muere en «Deploying outputs...»**. O sea que **el build anda; lo que no entra es la salida**
(2001 MB, con `node_modules` en 1847 MB).

**El peso lo mete una dependencia que usa SÓLO el navegador.** `@huggingface/transformers` arrastra
`onnxruntime-node`, y nadie lo usa del lado del servidor: lo importa un único archivo,
`app/video-editor/_opencut/services/transcription/worker.ts`, que es un **Web Worker** (Whisper
transcribe en la máquina del usuario). Entraba al bundle por ser dependencia, no por uso.

**Subido a `integracion`, `31dd88629..5fdfd90ba`** (y `93668a39d` commiteado, esperando que ese run
cierre para no cancelarlo):
- `next.config.ts` → `outputFileTracingExcludes` lo saca del bundle de **todas** las funciones.
- `scripts/sacar-cuda-de-onnx.mjs`, enganchado como **`prebuild`**, lo borra del **disco** del
  contenedor. Son dos cosas distintas: excluirlo del trazado no lo saca de `node_modules`.
- `tests/build-excluye-ia-del-navegador.test.ts` lo sostiene, y encontró la trampa **antes** de
  pushear: la clave que la doc de Next presenta como «global», `'/*'`, **no empareja la ruta `'/'`**.
  La home se quedaba con los 500 MB y el patrón parecía correcto. Va `'/**'`.

⚠️ **Y la salida que sugiere el propio error de Vercel no existe:** remata con «consider enabling
Enhanced Builds», y medido por API el proyecto ya construye en **`buildMachineType: "turbo"`** con
concurrencia elástica. La máquina ya pasó la que recomienda. **Cuando un error sugiere pagar más, se
mide en qué máquina corre hoy antes de pasarle la decisión a Martín.**

**Lo que falta saber:** si con eso alcanza. Se mira con
`node --env-file=C:/dev/mako-api/.env.local scripts/ver-deploy-vercel.mjs`. Si vuelve a dar `ENOSPC`,
ahora el reporte del contenedor **sí** va a traer los tamaños: quedó puesta
`VERCEL_BUILD_SYSTEM_REPORT=1` (antes devolvía `unknown` justo en «Input source code» y «Build
cache»). El `buildCommand` del proyecto es `null`, o sea `npm run build`, que es lo que hace correr
el `prebuild`: si alguien lo cambia a `next build` a secas, el borrado deja de correr sin avisar.

⚠️ **Y lo que NO hay que volver a tocar:** todo Competitors Spy ya está en `main` —el desplegable que
busca por nombre (`0aafde481`), la vista previa del modal (`f74e6930e`), el caché compartido entre
negocios (`cde75a8b6`)—. Que Martín no lo vea es el deploy, no el código.

**Si vuelven a fallar por disco, los dos caminos son de la cuenta de Martín:** *Enhanced Builds*
(más disco y memoria, lo sugiere el propio error) o sacar esas dos dependencias del build.

⚠️ **Producción NO está caída**: sigue sirviendo `59353f806` (2/11 23:14). Le falta lo nuevo.

## ⛔ (anterior) el deploy y la variable

**Estado al cortar (3/11 ~02:40):** `be38d9156` salió **VERDE en Actions** y **ERROR en Vercel**.
Producción sigue sirviendo el último build bueno (`59353f806`, 23:14): **la app NO está caída**, le
falta lo nuevo.

**El diagnóstico real, y NO era el que yo creía al principio:**

```
'/admin/docs': ['./docs/**/*.md', './AGENTS.md']    ← next.config.ts:56
```

Esa función **empaqueta TODOS los `.md` del repo — 19,6 MB en 314 archivos** — porque la pantalla
renderiza la documentación desde el repositorio en vez de tener copia propia. **Ya estaba al borde
de los 250 MB desde antes.** Mi import del catálogo de cursos sumó ~7 MB y la pasó a **281**; el
arreglo (`be38d9156`) la bajó a **274** — real, pero **insuficiente**.

⚠️ **RECORTAR MARKDOWN NO ALCANZA:** sacando todos los `hallazgos-*.md` quedaría en ~264 MB, igual
por encima. Está medido, no estimado.

**La salida, que la dice el propio error de Vercel:**

```
VERCEL_SUPPORT_LARGE_FUNCTIONS=1      (el proyecto YA está habilitado: «your project is eligible»)
```

Es un ajuste de la cuenta de Martín, así que **espera su sí**. Se pone en Settings → Environment
Variables y se redespliega. Con `VERCEL_ANALYZE_BUILD_OUTPUT=1` se ve el detalle de qué pesa.

⚠️ **Y HAY ALGO QUE APAGUÉ Y HAY QUE VOLVER A PRENDER:** el corte del 99 %. Creé
`~/.claude/guardia/sin-corte` porque me bloqueaba hasta leer el estado del deploy con producción
rota, y Martín lo pidió explícitamente («hazlo tú, no importa el 99 %»). **Se vuelve a prender
borrando ese archivo.** Mientras exista, ningún chat corta y la cuenta puede llegar al 100 % de
golpe.

## 🔴 ACTIONS EN VERDE ≠ DEPLOY SANO

**El 3/11 ~01:30 Martín avisó «hay errores en vercel». Hacía DOS HORAS que el deploy estaba roto y
Actions había estado en verde todo ese tiempo.** Tres deploys fallaron seguidos sin que ninguna de
mis señales lo dijera.

El error, medido con la API de Vercel (`VERCEL_API_TOKEN` en `C:/dev/mako-api/.env.local`):

```
The Vercel Function "admin/docs" is 281.43mb uncompressed which exceeds the
maximum uncompressed size limit of 250mb.
```

**La causa fue mía:** el cableado del Second Brain del gurú hizo que `lib/cerebro-para-chat.ts`
importara `@/app/conocimientos/catalogo`, y ese catálogo **arrastra los 100+ archivos de cursos**.

⚠️ **LA REGLA, Y ES LA QUE MÁS VA A AHORRAR:** **CI corre `tsc` y la suite; NO corre `next build`
ni el empaquetado de funciones.** Un verde en Actions no dice nada sobre el tamaño de un bundle.
**Cuando un cambio haga que `lib/` importe algo de `app/` —sobre todo un catálogo o un índice—, el
riesgo es el tamaño y SÓLO se ve en Vercel.**

**Cómo mirarlo sin entrar a la web:**
`node --env-file=C:/dev/mako-api/.env.local scripts/ver-deploy-vercel.mjs`
Lista los últimos deploys con su commit y su estado, y del primero en ERROR saca el error de verdad
—que está al final, tapado por el listado de rutas—.

**Arreglado en `be38d9156`**: un índice de **99 KB** con las 1.158 clases de los 12 referentes
(`lib/asesores/clases-de-referentes.json`, regenerable con
`scripts/generar-clases-de-referentes.mjs`). ⚠️ **Falta confirmar en VERCEL que el deploy salga
READY**, no sólo que Actions esté verde: es exactamente la distinción que costó esta noche.

⛔ **LO PRIMERO AL RETOMAR, Y SON TRES COSAS:**

1. **Hay un run corriendo: `f74e6930e`** (run `41553250011`). Lleva TODO el cierre de Competitors
   Spy. `origin/main` está en `59353f806`; si ese run sale verde, main salta solo.
2. **Hay UN commit local sin pushear: el del relevo.** No se pusheó a propósito — cancelaría ese
   mismo run. En cuanto cierre, `MAKO_SIN_ANTES_DE_SUBIR=1 git push origin HEAD:integracion`.
3. **Un rojo ahora SE ANUNCIA SOLO**: `git fetch && git rev-parse --verify origin/ci-ultimo-rojo`
   dice cuál fue el último commit que puso rojo a Actions. Lo explica todo más abajo.
   ⚠️ **ESA RAMA ES «EL ÚLTIMO ROJO», NO «EL ESTADO DE AHORA», y confundirlo cuesta una hora.**
   Al cerrar apunta a `849e9ec42`, que fue un rojo YA ARREGLADO hace varios commits. La marca sólo
   sirve comparada contra la cabeza que se pusheó: si `ci-ultimo-rojo` **es** esa cabeza, el run
   falló; si apunta a algo anterior, es historia y no dice nada del run en vuelo.

⚠️ **Y DOS REGLAS DE LA CASA QUE CAMBIÉ ESTA NOCHE, a pedido de Martín**, porque quien retome se las
va a encontrar y tiene que saber por qué:
· `~/.claude/bitacora-sesion.sh` — **el cierre pasó del 95 % al 98 %**. El 95 % decía «no arranques
  nada más» y yo se lo contesté a Martín una y otra vez cuando él me había pedido explícitamente lo
  contrario. Su frase: «si estás llegando al final —98, 99— guardes contexto y yo lo sigo con la
  próxima cuenta».
· `~/.claude/guardia/corte-97.mjs` — **el corte duro pasó de 97 a 99**, porque con 97 el chat moría
  ANTES del umbral de cierre del 98 y el aviso no llegaba a dispararse nunca.

## (anterior) RELEVO — 2/11/2026 ~21:15, al 95 % de cuota

**`origin/main` = `7eea250f5`** (runs #364 y #365 verdes). **Todo Competitors Spy está desplegado y
verificado en producción**, mirando hola-mako.com/competitor-spy: las tarjetas tiran de
`/asesores/grandes/`, sin carteles, con la animación `spy-flota` activa.

⛔ **AL CERRAR HAY UN RUN SIN CONFIRMAR: `6d6b53fb3`** (run `41533037191`, corriendo a las 21:58).
Lleva lo último de la noche:
· **el mapa de qué curso es de cada gurú** (`lib/asesores/cursos.ts`, los DOCE, verificados abriendo
  los archivos) — era el eslabón que faltaba entre un asesor y su Second Brain;
· **Offer fuera de la barra** (Martín: «la de offer no la quiero»; Ads Manager NO se tocó);
· **las dos decisiones de Martín** que destraban dos ítems (abajo).

⚠️ **EL RUN ANTERIOR (`b82fb0935`) SALIÓ ROJO Y EL ERROR ERA MÍO:** al reescribir la línea de Offer
perdí `starts('/admin/offer-playbook')` del `match`, y `tests/offer-en-create.test.ts` lo exigía con
razón. **El `match` no se recorta aunque el ítem no se dibuje**: lo usan el título de la pestaña y
las rutas viejas. Ya está restituido y en verde (26/0) dentro de este run.

## ✅ COMPETITORS SPY QUEDÓ CERRADO (3/11/2026 ~00:45, en `f74e6930e`)

Martín: «que se cierre absolutamente todo lo de competitor spy». Lo que entró en la última tanda:

| | Qué |
|---|---|
| **Buscar por NOMBRE, sin @** | actor `apify~instagram-scraper`. **US$1,50 / 1.000 resultados → US$0,012 la búsqueda**, tope diario de 40 ⇒ US$0,48/día por negocio. **PROBADO contra el actor de verdad** |
| **Desplegable mientras se escribe** | se REUSÓ el del alta de un lead (`app/crm/new/InstagramBuscador.tsx`), no se hizo otro |
| **YouTube en la caché compartida** | ahí se ahorra cuota de la API, no plata del negocio |
| **Poda a 30 días** | escrita. ⚠️ **NO hay cron que la llame todavía** |
| **Caricatura por Flow** | `lib/spy-caricatura-flow.ts`, sobre la cuenta de Martín, con el prompt aprobado literal |
| **El modal** | la vista previa pasa a la anatomía de la tarjeta: la imagen manda |

⚠️ **EL HALLAZGO QUE MÁS VALE DE TODA LA NOCHE, y sólo apareció al probar de verdad:** buscando
«leila hormozi» el actor devolvió **7 candidatos y sólo 1 traía `username`**. Los otros 6 venían con
`error: 'no_items'` («Empty or private data») porque el actor BUSCA y después intenta scrapear cada
perfil. **El @ estaba igual, en `url`**, y mi primera versión los descartaba: la lista habría salido
casi vacía y habría parecido que el actor no sirve. **Los tipos compilaban perfecto.** Se repite con
`node --env-file=C:/dev/mako-api/.env.local scripts/probar-busqueda-apify.mjs 9 "leila hormozi"`.

**Lo que queda de Spy depende de otros:** la extensión (consentimiento OAuth de Martín) y subir el
límite de Meta (no hay credencial de Business Discovery para medirlo). Y los duplicados que ya
existen se borran a mano desde la tarjeta.

## ✅ DOS DECISIONES DE MARTÍN QUE LA PRÓXIMA CUENTA PUEDE EJECUTAR DIRECTO

1. **El gasto está aprobado y lo elige quien trabaje:** «no tengo problema… tú determínalo y me vas
   diciendo cuánto va a ser el gasto… pero impleméntalo ya». Destraba el **ítem 10** (el desplegable
   de varios perfiles: hace falta un actor de BÚSQUEDA de Apify). ⚠️ **No es un cheque en blanco:
   hay que MEDIR el costo por búsqueda y decírselo antes de prenderlo**, y ponerle tope por día.
2. **El puente de Google Flow corre sobre SU cuenta y aprueba generar con ella.** Destraba la
   **caricatura de un competidor que no es referente** — era la única pregunta abierta. Va como
   trabajo aparte de la lectura, con tope, y la tarjeta muestra la foto mientras tanto.

## ✅ CÓMO SABER SI ACTIONS SALIÓ ROJO — RESUELTO, pero leé esto antes de confiar

Martín se enteró de **tres** rojos antes que yo. La causa era una **asimetría**: el verde escribe en
git (avanza `main`) y el rojo **no escribía nada**, así que un vigía hecho con git veía lo MISMO en
«rojo» que en «corriendo». Y git es lo único que hay: **`gh` no está instalado en esta máquina.**

**El arreglo está en `.github/workflows/integracion.yml`:** un paso con `if: failure()` que pushea
la cabeza que falló a la rama **`ci-ultimo-rojo`**. Ahora un `git fetch` ve el rojo:

```
git fetch origin --quiet
git rev-parse --verify --quiet origin/ci-ultimo-rojo   # el último commit que puso rojo a Actions
git log origin/ci-ultimo-rojo -1                        # qué se estaba subiendo
```

✅ **PROBADO, Y FUNCIONÓ EN EL MISMO RUN QUE LO INCORPORÓ.** Yo había anotado que recién correría en
el siguiente y **me equivoqué**: Actions usa el workflow del commit que se está corriendo, así que
el paso corrió en `ae30f14f5`, dejó la marca, y el vigía detectó el rojo solo — sin reloj y sin que
Martín tuviera que avisar, que es lo que fallaba tres veces.

⚠️ **Y lo primero que cazó fue a sí mismo:** `tests/integracion-ci.test.ts` prohibía `--force` en
TODO el workflow y la marca lo usa. **El guard se afinó, no se aflojó** — ahora exige que ninguna
línea que empuje a `main` lleve un forzado (en sus tres formas) y que el ÚNICO forzado del archivo
sea el de `ci-ultimo-rojo`. Probado rompiéndolo tres veces.

⚠️ **Y NO REPITAS MI ERROR:** antes de esto intenté adivinar por tiempos —«un rojo muere en 5–12
min»— y con esa regla ensanché el vigía a 48 minutos justo antes de que un run muriera a los ~15.
**Cuatro datos no son una distribución, y una heurística sobre el síntoma no arregla una
asimetría.** Si la marca no estuviera disponible, lo correcto es mirar el run a los ~8 minutos y no
delegarle la primera mirada a nada.

⚠️ **Offer se sacó SIN borrar su entrada, y eso no es un detalle.** Hay un flag nuevo,
`fueraDeLaBarra`, chequeado en `puedeVerItem` (`lib/nav-visibilidad.ts`), que es la puerta
compartida por la barra y el móvil. **La key `offer` es contrato con la base**: la resuelven con
`itemNav('offer')` los permisos por capa (`navKeys`, lib/capas.ts), el onboarding por tab, el móvil
y el catálogo de la API. Borrar la entrada les devuelve `undefined` a todos — y el daño no es un
renglón que falta, es **un negocio que pierde el permiso de una tab porque su key dejó de existir**.
Eso fue lo que rompió los seis tests del intento anterior. **Si alguien vuelve a intentar «sacar una
tab», que use el flag.**

✅ Antes de eso, los runs `1bb35642c`, `abe7dfe0e` y los anteriores cerraron **verdes**: el nombre
real en la tarjeta, las reglas del email de avance y el mapa de cursos ya están en `main`.

⚠️ **Para el próximo rojo, porque es lo que más tiempo me costó:** los nombres de los tests están en
el **LOG DEL JOB**, en la línea «Rojos:». El resumen del run sólo dice `afectados: NNN s (código 1)`
y no sirve. Y **no se pushea mientras un run corre**: un push lo cancela, y eso pasó diez veces.

### Lo que quedó DESPLEGADO esta noche

Competitors Spy entero: las 22 caricaturas en las tarjetas (emparejadas por nombre comparable, sin
tabla de @), imagen a sangre sin cartel, 600 px, flote con arranque propio por tarjeta, «Su web»,
deduplicación por referente (no más dos Hormozi), el link de la bio como landing, el @ andando en el
CRM, YouTube con videos largos, las miniaturas guardadas de verdad, y el link de progreso en el
ticket. Más el modal de difusión del CRM, que vino de la sesión «Automations».

### ⏳ Lo que queda a medias, CON SU ARCHIVO

Las tres tienen la base hecha, con test probado rompiéndolo, y **las dos migraciones YA están
aplicadas en producción**. Lo que falta de cada una es el cableado, y está escrito paso por paso en
`docs/pendientes-martin.md`.

| ítem | qué está | qué falta, y dónde |
|---|---|---|
| **13** — compartir el análisis entre negocios | migración `0363` (tabla global `spy_lecturas_canal`) + `lib/spy-compartido.ts` | que `mirarCompetidor` (`lib/spy.ts:514`) reciba el MOTIVO y consulte/refresque. Sin el motivo no se puede cumplir la regla de que «Revisar ahora» nunca sirve la lectura de otro |
| **17/18** — Second Brain por gurú | `lib/cerebro-referente.ts` (capa, un nodo por clase, SIN tope) + `lib/cerebro-referente-server.ts` (lector, memoizado) | colgarla con `conCapa` en `lib/cerebro-para-chat.ts` → `armar()`. ⚠️ **NO lleva el heurístico de Knowledge**: se cuelga cuando el chat TIENE ese referente, y el servidor ya lo sabe |
| **email de avance del ticket** | migración `0364` + `lib/tickets-avance.ts` | el envío con Resend. ⚠️ **La consulta de `avisarPendientes` NO sirve**: filtra sólo los estados finales, que son justo los que no son avance |

### ⛔ Lo que NO se puede hacer desde acá, y por qué

| | por qué |
|---|---|
| **Los 10 gurús que faltan** (ítem 14) | **~2,3 millones de tokens**, medido por la sesión «Ops Center»: cada ficha costó 175–285 mil. Necesita cuenta nueva. El brief está escrito |
| **#8, el rediseño del modal** de nuevo competidor | está en `punta/spy` (`fdde379b4`, 3/11). Falta mirarlo en producción: lo primero, que la foto salga en las filas |
| **#10, el desplegable** de varios perfiles | hace falta elegir un actor de BÚSQUEDA de Apify. Martín ya dijo que paga |
| **Caricatura de quien no es gurú** | falta medir **sobre qué cuenta de Google corre el puente de Flow**: si es la de Martín, le gasta a él |
| **#20, la extensión** | consentimiento OAuth de la cuenta de Google de Martín. No es código |

### 💸 Una decisión de plata que Martín puede querer revertir

**El alta del CRM ahora puede gastar la clave de Apify del negocio** (`APIFY_CLAVE_DE_SPY`). Hasta
el 1/11 la regla era «Apify: sólo Spy» y un guard la hacía cumplir. Gana el pedido posterior del
2/11, pero está escrito en `tests/leads-scraper-retirado.test.ts` con la fecha, la cita y cómo se
revierte en una línea.

### 🤝 Qué se repartió y qué volvió

| sesión | ítem | volvió |
|---|---|---|
| `Automations` (local) | modal de difusión del CRM | ✅ hecho y ya desplegado |
| `Replicar los 20 dashboards` (local) | los 20 dashboards | 5 de 20; su rama **ya está a salvo** en `origin/dashboard-denso-0111` |
| `Ops Center` (local) | los 10 gurús | se frenó con razón: misma cuenta, 2,3 M de tokens |
| 4 sesiones en la nube | #13, ticket #44, #2+#16, #15 | **nada volvió**: el canal es de ida |

⚠️ **Repartir NO agrega cuota.** Las 17 sesiones corren sobre `claude1`. Al 95 %, pasar un ítem a
otro chat acelera el corte en vez de evitarlo. **Para seguir hace falta otra cuenta.**

### ⚠️ Los CINCO rojos de la noche fueron todos del mismo tipo, y conviene saberlo antes de tocar

Ninguno fue un bug del producto: **todos eran tests que fijaban un texto o una lista EXACTOS** y que
se pusieron rojos por cambios que sí queríamos.

| run | test | qué fijaba |
|---|---|---|
| #360 | `instagram-perfil-fuentes`, `ficha-datos-del-deal` | la lista exacta `['meta-plataforma','apify']` |
| #362 | `leads-scraper-retirado` | que el alta del CRM **no** pudiera gastar la clave de Apify de Spy |
| #362 | `clase-del-grupo` | la frase del ticket anclada con `$` al final |
| #363 | `puente-panel-copy` | el **voseo**: escribí «Mirá cómo va acá» y MaKo habla de tú |

**La lección de método, que me costó cuatro ciclos de media hora:** antes de pushear, buscar con
`grep` en `tests/` **todos** los literales que uno cambió (una frase, una lista, una ruta de
archivo), en vez de descubrirlos de a uno por run. Y `node scripts/tests-afectados.mjs --listar`
dice qué tests toca el cambio: en este tren eran ~640, de los cuales 210 **barren el repo** y son
los que muerden un archivo NUEVO.

### ⚠️ Dos cosas que rompí yo y están arregladas, para no repetirlas

1. **Backtick dentro del template literal del CSS** de `SpyApp.tsx` — el hook de pre-push lo caza
   como «Parsing error: ',' expected». Los comentarios del bloque CSS van con comillas angulares.
2. **`Get-Content -Raw` + `Set-Content` para editar un archivo del repo**: PowerShell lee el UTF-8
   con la codepage ANSI y deja el archivo doble-codificado («Relevo â€” Cerebro»). **Texto del repo
   se edita con Edit/Write; PowerShell sólo para git y mediciones.**
3. **Un Monitor que sólo mira el caso bueno se queda mudo en el malo.** El primero vigilaba si
   `main` avanzaba: con un rojo no decía nada y Martín se enteró antes que yo. El que está armado
   ahora **también late cada 12 min sin novedad**, que es lo que obliga a ir a mirar.

**Lo desplegado y verde quedó en el #359 (`22b8d9d6f`).** El #360 salió ROJO por dos tests que fijaban
en un regex la lista exacta de fuentes de Apify; ya están arreglados y van en el #361.

### Lo que Martín pidió esta noche y en qué quedó

| pedido | estado |
|---|---|
| las 22 caricaturas en la tarjeta de Spy | hecho, empareja por nombre comparable, sin tabla de @ |
| que no haya dos Alex Hormozi | hecho, el referente es la tercera llave de deduplicación |
| sin «Inspirado en», imagen a sangre, «Su web» | hecho |
| que las tarjetas tengan movimiento | hecho: flotan, cada una con su propio arranque |
| las caras se ven borrosas al agrandar | hecho: eran **200×200**, ahora 600. ⚠️ NO se regeneran: Martín las aprobó tras ocho vueltas |
| el @ en el CRM | hecho |
| el link de la bio como landing | hecho |
| que el ticket diga cómo va | hecho el link; **falta el email de avance** |
| compartir el análisis entre negocios (#13) | **PENDIENTE, y es lo que más pidió** |
| el rediseño del modal de nuevo competidor | **PENDIENTE** (lo marqué HECHO por error) |

⚠️ **Martín, textual:** «no quiero que me vuelvas a decir no arranco sobre nada de Competitor Spy,
arranca todo. Si ves que estás llegando al límite semanal cerca del 100 %, guarda contexto y yo
continúo con la próxima cuenta.» O sea: **no frenar por prudencia de cuota; frenar al 97 % guardando
todo.**

⚠️ **NUNCA EDITAR UN ARCHIVO DEL REPO CON `Get-Content -Raw` + `Set-Content`.** Lo hice con este
mismo relevo a las 21:30 y lo dejé ilegible: `Get-Content` lee el UTF-8 con la codepage ANSI del
sistema, así que «Relevo — Cerebro» quedó «Relevo â€” Cerebro» en todo el archivo, más un BOM, y el
commit salió con 766 inserciones y 785 borrados sobre un cambio de treinta líneas. Se revirtió con
`git reset --hard HEAD~1` (el commit era local) y se rehízo con la herramienta Edit, que escribe
UTF-8. **Para texto del repo: Edit/Write; PowerShell sólo para git y mediciones.**

⚠️ **La RAM corta Bash por debajo de 3 GB** y estuvo entre 1,6 y 2,7 toda la noche. Read/Edit/Write
no pasan por el guardia; PowerShell tampoco.

## (anterior) ESTADO AL 2/11 ~19:45 — CUOTA AL 93 %, EL TREN CORRIENDO, Y EL PRÓXIMO PUSH RETENIDO

⛔ **LO PRIMERO AL RETOMAR: MIRAR ACTIONS, NO PUSHEAR.** El run **#359** corre con 13 commits y lleva
más de una hora. **No está colgado necesariamente**: el #358 corrió 30m19s antes de que lo cancelaran,
y éste tiene el doble de tests afectados. Arriba hay **cuatro commits listos y RETENIDOS a propósito**,
la punta en `4ad25d54d`:

| commit | qué es |
|---|---|
| `c85e10ec2` | ítem 9 — el @ del CRM pedía la clave de Apify que no existe |
| `ffd616b47` | el tablero: por qué el push queda retenido |
| `8238f1af8` | este relevo |
| `4ad25d54d` | ítem 10 a medias — el link de la bio ya no se tira a la basura |

Pushear mientras el #359 corre lo cancela, que es exactamente lo que pasó diez veces hoy. Cuando el
#359 cierre, se juntan **con las dos ramas que también esperan** — `difusion-modal-0211`
(`6bf0a40a8`, el modal de difusión) y `dashboard-denso-0111` (`a4fb06dba`, 5 de 20 dashboards)— y se
manda **UN** push.

⚠️ **Lo que NO se pudo correr, y hay que decirlo así:** la tanda de tests vecinos de Spy
(`spy-alta-duplicados`, `spy-miniaturas`, `spy-youtube-largos`) **no corrió**: el guardia de RAM la
cortó con 2,5 GB libres. Los dos tests nuevos sí corrieron y están en verde, probados rompiéndolos
(`crm-instagram-clave-de-spy` 4/0, `spy-canal-de-la-bio` 7/0). O sea que de los vecinos **responde
Actions, no yo**.

**`origin/main` = `63d66d8f3`.** Encima hay **12 commits** que vivían sólo en `tren-chico` y que
estoy subiendo a `integracion` ahora: Puigrredón, Alborna, las miniaturas de YouTube que ahora se
GUARDAN (antes se dibujaban desde la URL de YouTube y no estaban en ningún lado), Instagram de 25 a
100 por Apify, la vista previa del modal de alta, la cara en la tarjeta del competidor y la
corrección de la extensión (Google dice `deleted_client`, no faltaban credenciales).

⚠️ **LOS SUBO SIN CHEQUEO DE TIPOS LOCAL, Y HAY QUE SABERLO.** `node scripts/tsc-acotado.mjs
--heap=2048` sobre los 9 `.ts/.tsx` cambiados salió **99 = no se pudo chequear**: lo mató el guardia
de RAM, con **2,73 GB libres de 15,71**. Un 99 no es un verde. O sea que **el único chequeo de tipos
de este tren es el de Actions**, y si sale rojo los nombres están en el LOG del job, en la línea
«Rojos:», no en el resumen.

⚠️ **REPARTIR NO AGREGA CUOTA, y ésa es la corrección de la tarde.** Las 17 sesiones —locales y de
la nube— corren sobre la MISMA cuenta `claude1`. Al 93 % pasar un ítem a otro chat **acelera el
corte en vez de evitarlo**. `Ops Center` y `Replicar los 20 dashboards` lo vieron antes que yo y se
frenaron solas; `Ops Center` midió que una ficha de referente cuesta 175–285 mil tokens, o sea
~2,3 millones por los diez. **Para seguir hace falta que Martín pase a otra cuenta.** Los briefs
sirven tal cual cuando la haya: están en el tablero.

⚠️ **Puse a salvo trabajo de otro chat que podía borrarse:** `dashboard-denso-0111` (3.430 líneas,
5 de 20 hojas) vivía sólo en el worktree `C:/dev/wt-dashboard-3110`, sin remoto y con el working
tree limpio — o sea que el barrido de worktreees la habría leído como «limpia» y borrada. Ya está en
`origin/dashboard-denso-0111`. **Subir una rama que no es `integracion` no dispara Actions**, así
que salvar el trabajo de otro chat es gratis (`docs/hallazgos-infra.md`).

**El tablero vivo es `docs/pendientes-martin.md`** — ahí está la lista de los 21 pedidos con su
estado, y arriba de todo el aviso de por qué nada se desplegó. Esto de acá es el resumen.

### Lo que hay que hacer PRIMERO al retomar

1. **Mirar si hay algo sin desplegar**: `git fetch && git rev-list --count origin/main..origin/integracion`.
   Si da 0, no hay nada que destrabar y se puede ir directo al tablero
   (`docs/pendientes-martin.md`). Si da más, mirar el último run en
   `github.com/koncke/mako/actions/workflows/integracion.yml`.
2. ⚠️ **EL RESUMEN DEL RUN NO NOMBRA LOS TESTS ROJOS; EL LOG DEL JOB SÍ.** Esto me costó tres
   runs: el resumen sólo dice `afectados: 298 s (código 1)`. Hay que abrir el job y buscar
   **«Rojos:»** — ahí está la lista completa de archivos y la línea para repetirlos solos. Correr
   `tests-afectados.mjs` acá tarda más de 10 minutos y encima corta en otra tanda, así que da una
   lista DISTINTA: a mí me señaló dos tests lentos (`chat-trabajos`, `chatbot-lista-nueva`) que no
   tenían nada que ver y que pasan solos.
3. **NO pushear por ítem.** `concurrency: integracion` cancela el run anterior con cada push: yo
   pusheé nueve veces seguidas y maté nueve chequeos, por eso se acumularon 15 commits sin
   desplegar. Se junta, se pushea UNA vez y se espera.
4. ⚠️ **SACAR UNA TAB DE LA BARRA NO ES BORRAR UNA LÍNEA DE `nav.ts`.** Sacar `offer` y
   `ads-manager` rompió SEIS tests, porque esas keys las nombran el catálogo de funciones de la
   API de MaKo, las rutas del móvil, los módulos de Knowledge, Create y Estrategia
   (`tests/funciones-mako.test.ts`: «ninguna función nombra una key que no existe»). Se
   revirtieron para desatascar el resto; el pedido sigue pendiente como trabajo propio.

### Lo HECHO esta noche, todo en `integracion` (10 ítems)

| Ítem | Commit |
|---|---|
| Spy visible para todos (sacar `adminOnly` de la barra) | `91bcafb09` |
| Offer y Ads Manager fuera de la barra | `91bcafb09` + `dd1ef0d08` |
| Miniaturas de IG: `referrerPolicy` (el CDN de Meta da 403 desde otro dominio) | `91bcafb09` |
| YouTube trae los videos LARGOS (paginar + cupo) | `e2d9d265e` |
| La miniatura se BAJA y se guarda (bucket, migración 0361) | `c88359abb` |
| La lista en tarjetas con la cara + borrar ahí (migración 0362) | `eb5720c61` |
| El alta deja de duplicar a la misma persona | `bcce42131` |
| Spy funciona para todo el equipo; borrar sólo el admin | `ee9cdf490` |

⚠️ **Las migraciones 0360, 0361 y 0362 YA ESTÁN APLICADAS en producción** (verificadas contra
`leads=3071`). Las migraciones NO corren solas en el deploy: se aplican a mano con
`node --env-file=C:/dev/mako-api/.env.local scripts/apply-migration.mjs <archivo>`.

### Las tres trampas de la noche, que son lo que más tiempo ahorra

1. **Un guard que busca un IDENTIFICADOR encuentra la declaración, no el uso.** Me pasó dos veces
   en una hora: `/PAGINAS_MAX/` pasó en verde con `PAGINAS_MAX = 1`, que es el bug. Un guard de
   código busca la FORMA DEL USO, y **se prueba rompiendo lo que vigila** antes de confiar en él.
2. **Un grep vacío no es un hecho.** Tres veces dije «no está en Knowledge» y las tres estaba:
   `Puigrredón` con tilde, `Maffia` con dos efes, y Vilma Núñez renombrada por el mapa `TITULO`.
3. **Sacar una tab de la barra toca más de un lugar**: `nav.ts`, las acciones del servidor (que
   pedían admin y dejaban la tab muerta) y `SIN_GUIA_TODAVIA` en `tests/guia-catalogo.test.ts`.

## 📋 TODO LO PENDIENTE DE MARTÍN — inventario verificado contra el código (2/11/2026 ~01:00)

Martín: «Revisá TODOS los pedidos que te hice y que siguen pendientes». Cada línea se comprobó
abriendo el archivo, no de memoria. **Nada de esto está empezado salvo donde se diga.**

### A. Pedidos NUEVOS del 2/11 (sin empezar)

| # | Qué | Dónde vive | Verificado |
|---|---|---|---|
| A1 | **La lista de competidores en TARJETAS con caricatura**, no en tabla | `app/competitor-spy/SpyApp.tsx` → `TablaCompetidores` | hoy es una `<table>` |
| A2 | **Poder borrar un competidor DESDE LA LISTA.** Martín tiene tres «Sofia Contreras» repetidas | ídem | «Dejar de mirarlo» existe pero SÓLO adentro de la ficha, en el `⋯` (`SpyApp.tsx:1124`) |
| A3 | **Rediseñar el modal de «Mirar a alguien más»** | `SpyApp.tsx` → `ModalAlta` | — |
| A4 | **Con el @ y Apify, traer el perfil** (foto, nombre, seguidores) al escribirlo. **Y lo mismo en el CRM** | `lib/instagram-perfil-server.ts` ya lee perfiles con Apify | la clave de Apify existe pero NUNCA se probó punta a punta |
| A5 | **Rediseñar el modal de «mensaje de difusión» del CRM**, con el formato de cada red, como en Automations | `app/crm/AccionesLoteLeads.tsx` · `app/crm/seleccion-difusion.ts` | — |

⚠️ **A1 y A2 son el MISMO trabajo**: la tarjeta tiene que traer su propia acción de borrar. Y las
tres «Sofia Contreras» salen de que el alta no deduplica: hay que mirar eso también, o las tarjetas
nuevas van a mostrar el duplicado más lindo.

### B. Pedidos ANTERIORES que siguen sin hacer

| # | Qué | Verificado |
|---|---|---|
| B1 | **Sacar Offer y Ads Manager de la sidebar** (Ads Manager pasa a ser Funnel Coach y Offer lo toma Hormozi, los dos adentro del Ops Center) | **SIGUEN**: `app/_components/nav.ts:371` (`offer`) y `:373` (`ads-manager`) |
| B2 | **Los 12 referentes nuevos** | los 12 cursos YA están localizados (ver más abajo); faltan las 12 fichas y las 12 caricaturas |
| B3 | **Elegir un gurú desde «nuevo chat»** | no existe: `IdCoach` sólo tiene `funnel` y `offer` |
| B4 | **Base de conocimiento por gurú** (la transcripción de su curso) | sin empezar |
| B5 | **Botón de Second Brain por gurú**, para ver su grafo | sin empezar. La pieza ya existe: `app/second-brain/Grafo.tsx` y `lib/cerebro-knowledge.ts` |
| B6 | **La página de instalar la extensión no debe ofrecer NINGUNA descarga**, sólo la tienda | **SIGUE OFRECIÉNDOLA**: `app/extension/instalar/Pasos.tsx:76-83` tiene el botón de descarga |
| B7 | **Probar punta a punta que la clave de Apify de ws 9 lee un Instagram** | nunca se probó |

### A-bis. Pedidos del 2/11 ~01:10, de mirar la tab YA DESPLEGADA (sin empezar)

| # | Qué | Verificado / cómo |
|---|---|---|
| A6 | **La miniatura se DESCARGA Y SE GUARDA.** Martín: «no quiero que se vea texto. Si tenemos que descargar la imagen y guardarla, lo hacemos». | ⚠️ **Esto REVIERTE el diseño de 0359**, que a propósito no guardaba la imagen porque la URL de Meta vence. Guardar los bytes es la respuesta correcta y Martín la acaba de autorizar: bucket de storage + guardar al leer. El respaldo de texto que puse el 2/11 es un parche, NO la solución. |
| A7 | **Con UN dato, traer todas sus redes.** Del @ de IG o del canal de YouTube, buscar por un motor de búsqueda las demás redes; y de la bio de IG / la descripción del canal, sacar el link a su landing o su funnel. | sin empezar |
| A8 | **Y VALIDARLO CON EL USUARIO**: «¿este es el YouTube de esta persona?» antes de guardarlo, para no traer a otro. | sin empezar. Es la misma trampa que ya pagamos resolviendo gurús por búsqueda en vez de por `@handle`. |
| A9 | **Pasar de 50 publicaciones.** Una vista con TODAS, y/o usar la extensión de MaKo para ir al perfil de Instagram, elegir publicaciones a dedo y sumarlas a MaKo. | el tope es `piezasPorVuelta: 50` en `lib/spy-reglas.ts:479` |
| A10 | ~~¿Trae sólo Reels?~~ **NO: ya trae todo.** | VERIFICADO: `lib/spy.ts:429` mapea todo lo que no es `REELS` a `publicacion`, y la captura de Martín muestra «Reels 7 · Publicaciones 5». **No hay nada que arreglar acá.** |

### A-ter. SPY COMPARTIDO ENTRE USUARIOS — la decisión, porque toca el aislamiento

Martín, 2/11: «que esta tab sea compartida por todos los usuarios. No tiene sentido que uno analice
a Alex Hormozi y luego otro vuelva a analizar al mismo».

**Hoy es por negocio:** `spy_competidores` tiene `workspace_id not null` y `unique (workspace_id,
nombre)` (`supabase/migrations/0359_competitors_spy.sql:67,94`).

**Compartir TODO entre workspaces le mostraría a cada cliente la lista de competidores de los
demás**, que es exactamente lo que todos los guards de este repo impiden. Así que la decisión —y es
la que cumple lo que Martín pide sin filtrar nada:

> **Se comparte lo CARO, no lo privado.** Lo que se lee de un canal público (las piezas de
> `@leilahormozi`) va a una caché GLOBAL por `ref` de canal, que cualquier negocio puede aprovechar:
> nadie paga dos veces por leer a Hormozi. **A quién mira cada negocio sigue siendo suyo.**

De ahí sale sola la regla de borrado que Martín pedía: **un usuario saca al competidor de SU lista;
la lectura compartida no se toca.** Y si más adelante hay competidores sembrados por nosotros, van
marcados y el cliente no los puede borrar — sólo dejar de verlos.

### C. Lo que tiene OTRO chat (no duplicar)

- **Los 20 dashboards del editor de informes.** La propuesta está en
  `docs/templates-dashboard-propuesta.md`. Martín preguntó «dónde quedó eso»: quedó en ese chat.

### D. A verificar antes de tocar

- **«El modal de los gurús sigue roto en producción».** El arreglo (`f378981ea`) recién llegó a
  `main` el 2/11 ~00:45 dentro de la tanda `e63050081..8a60cd310`. **Antes de eso NO estaba
  desplegado**, así que lo que Martín vio es la versión vieja. Hay que mirarlo DESPUÉS de recargar;
  si sigue roto es otro problema y hace falta la captura.

## ⏩ LEER PRIMERO — 2/11/2026 ~01:30 ART, el Cerebro de claude1 (`e680c815`, semana al 90 %)

**Esto pisa lo de abajo donde choque.** Rama de trabajo: `tren-chico` en `C:/dev/wt-push-q`.
`origin/main` estaba en `e63050081` al empezar y no se movió.

### Lo que quedó COMMITEADO y esperando el chequeo (NO está en main todavía)

| commit | qué | estado |
|---|---|---|
| `6ff74c641` | **Integraciones: los trece logos que no eran los de la empresa** | commiteado, chequeo sin terminar |
| `6a91c1c97` | **Ops Center: seis referentes nuevos, destilados de Knowledge** | commiteado, chequeo sin terminar |
| `f378981ea` | **Modal de referentes: de 3 scrolls a 1, y de 640 a 1040 de ancho** | commiteado |
| `0688bce47` | **Los videos de Instagram llegan a la tarjeta** (+ migración 0360) | commiteado |
| `82d1d96e0` | **Sin voseo en las fichas nuevas** (lo había puesto ROJO el guard de copy) | commiteado |
| `b02f5b0e9` | Spy: 7 filas → 5 | **superado por `20dc651fd`** |
| `0aa925c28` | Spy: los tokens medidos | **superado por `20dc651fd`** |
| `20dc651fd` | **⭐ COMPETITORS SPY REHECHA copiando una referencia** | commiteado, **tests VERDES** |
| `3b1bc0864` | Este relevo | commiteado |
| `55a677a0e` | **Que anden todos los botones** (+ guard nuevo) | commiteado, **verde y probado rompiéndolo** |
| `17e591b16` | **Spy: la cabecera entera pasa a ser una miga** + el nombre de Jordi Segués | **EN `integracion`, Actions corriendo** |

⚠️ **El push NO pasó: se quedó esperando RAM, no es rojo.** `antes-de-subir` corrió 45 tandas y a partir de
la 7 empezó a bajar tandas por RAM (0,7-1,1 GB libres contra 1,3 que pide). Cada vez suelta el candado y
vuelve a hacer fila. Las dos salidas están en `~/.claude/antes-de-subir/2026-11-01T23-42-50-6a91c1c97/`.
**Lo que hay que hacer:** o cerrar chats y reintentar `git push origin HEAD:integracion` desde
`C:/dev/wt-push-q`, o dejarle el chequeo a Actions. Los dos commits ya están verificados a mano:
`tests/zernio-todas-las-redes.test.ts` (10/10, y el guard nuevo probado rompiéndolo),
`tests/integracion-tres-registros.test.ts` (5/5), `tests/coaches-ops-center.test.ts` (11/11) y
`tests/offer-playbook.test.ts` (15/15, por el renombre de Higuera).

### 1. Los logos de /integraciones (pedido de Martín del 1/11)

«Muchos logos, como por ejemplo el de Appify, no son los logos reales de esas empresas.» **Eran 13 de 45.**
Seis dibujados a ojo (Apify, Groq, Gemini, ElevenLabs, YouTube, la «G» de Google) y siete con letter-mark
«porque no hay vector» (Creem, tl;dv, Fireflies, Otter, Read AI, bunny.net, Google Business — que mostraba
la «G» de Google, o sea el logo de otro producto).

- `IconDef` gana `img` (archivo oficial en `public/logos/`) y `lleno` (el archivo ES el tile).
- El guard de las redes acepta `img` y **afirma que el archivo existe**.
- Todo el porqué y el orden de búsqueda: `docs/hallazgos-integraciones.md`.
- **Sin hacer:** `LogoMeet` en `ServicioVisual.tsx` sigue siendo un dibujo propio (su comentario lo dice).
  Es la cámara al lado de «Asignar evento», no un tile; el mark oficial ya está como `ic-googlemeet`.

### 2. Los seis referentes nuevos del Ops Center (pedido de Martín del 1/11)

De los **130 cursos** de `app/conocimientos/curso-*.ts` entran seis: Felipe Vergara (anuncios), Jaime
Higuera (socio de crecimiento), Adrià Solà Pastor (comunicación), Augusto Bianchi (llamadas de ticket
alto), Tino Mossu (objeciones y seguimiento) y Jordi Seguís (TikTok). Fichas destiladas de las
transcripciones de verdad, caricaturas en el estilo aprobado.

- **El criterio y los descartados, con el motivo de cada uno:** `docs/hallazgos-ops-center.md`. Ahí quedó
  también **el prompt aprobado de las caricaturas**, que vivía sólo adentro de las llamadas a la
  herramienta y hubo que sacarlo de un transcript de 173 MB.
- ⚠️ **«Jaime Jiguera» no existe: es HIGUERA.** Corregido en los cinco archivos que lo traían mal.
- **Candidatos medidos que NO entraron por falta de tiempo, no por criterio** (si Martín quiere más, estos
  son los siguientes y ya están triados): **Javi Rodríguez**, «HIT» (122 clases) — eventos presenciales,
  llenar escenarios, vender un negocio de formación; es el hueco más claro que queda. Y **Andy Landa**,
  «ManyChat Master Instagram» (25) — DMs de Instagram, que pega con Automations.
- Las fotos de referencia y los scripts quedaron en el scratchpad de esta sesión
  (`.../e680c815-.../scratchpad/refs2/` y `bajar_caras.py`, `guardar_caras.py`): se resuelven por
  `youtube.com/@handle`, nunca por búsqueda.

### 3. ✅ COMPETITORS SPY REHECHA — `20dc651fd`. Falta correr los tests y que Martín la mire.

**Esto reemplaza lo que decía abajo.** La tab se rehizo copiando una referencia, que es lo que Martín
pidió CUATRO veces y cuatro veces no recibió.

- **La trampa, y es la que más tiempo ahorra:** las tres vueltas anteriores sí tocaron la tab y las
  tres se rechazaron. Las tres abrieron primero `SpyApp.tsx`. Partiendo de la pantalla propia sólo se
  le puede cambiar la superficie —filas de lugar, tokens— y el esqueleto, que es lo que se ve, queda
  intacto. **Si el primer archivo que abriste es el tuyo, no estás copiando.** Medir no lo salva: las
  dos vueltas malas daban mejores números que el original.
- **La referencia se elige por la FORMA, no por el rubro.** Spy es «un catálogo que se filtra», así que
  la que sirvió fue una TIENDA DE ROPA (`demo.codeandchill.store/fitlo/#/shop/all`). El análisis no
  entra en un catálogo, así que el riel salió de otra (`merrin`). Dos referencias, una por pieza.
- Medidas, reglas CSS y el mapeo a los tokens de la casa: **`docs/diseno/referencia-spy.md`**.
  El hallazgo de método: `docs/hallazgos-competitors-spy.md`, última sección.
- **Tests: VERDES.** spy-reglas 18/18 · spy-vista 13/13 · spy-orden 8/8 · spy-apify 5/5 ·
  puente-panel-copy 9/9. Hubo que correrlos **de a un archivo**: la guardia de RAM pide 3 GB y había
  2,1-2,3, pero un solo archivo entra. Es la salida cuando la guardia traba un lote.
- **Cómo verla sin Next:** `scratchpad/spy_ref.py` dibuja la tab con el CSS del propio componente y
  el `:root` real de `app/globals.css`, y la sirve el `http.server` del 4899.

### 3-bis-NUEVO. LO PUSHEADO Y LO QUE FALTA — 2/11 ~02:40

**En `origin/integracion` está `17e591b16`** (15 commits). `origin/main` sigue en `e63050081`:
lo avanza Actions por fast-forward cuando da verde. **Esto es lo que hay que mirar primero al
volver:** si Actions se puso roja, el rojo está ahí y no en la notebook.

⚠️ **EL PUSH A `main` NO SE HACE A MANO.** El hook corre el tsc COMPLETO local (pide 6,3 GB y la
PC llega a 6,1), así que se cuelga sin terminar nunca. El camino es `git push origin
HEAD:integracion` y, si falta RAM para `antes-de-subir`, `MAKO_SIN_ANTES_DE_SUBIR=1` adelante —
esa variable **sólo vale para `integracion`**, en `main` la ignora. Perdí ~15 min por esto.

**La cabecera minimalista (pedido de Martín del 2/11), hecha:** la referencia fue la FICHA DE
PRODUCTO de fitlo, no la grilla. Ahí la cabecera es `nav.crumbs--page` de 18 px y nada más; el
nombre y las acciones viven en la columna de al lado. 5 bandas → 3, y 370 px → **218 px** hasta
la primera pieza.

**⛔ LO QUE FALTA Y ES LO MÁS GRANDE: LOS 12 REFERENTES.** Martín los pidió el 1/11 y **ninguno
está cargado** (verificado uno por uno contra `lib/asesores/catalogo.ts` el 2/11): Juan Carrizo,
Emilio Puigrredon, Vilma Núñez, Julián Alborna, Andy Landa, Romuald Fons, Mateo Mafia, Sergio
Begueria, Álvaro Luque, Francisco Doglio, Gonzalo Seré, Samuel Albaa. **Hoy hay 20 y tendrían que
ser 32.** Cada uno necesita las dos cosas (lo dice la cabecera del catálogo): su ficha destilada
del curso real y su caricatura en `public/asesores/<id>.png` con el prompt aprobado, que está
textual en `docs/hallazgos-ops-center.md`.

  ⚠️ **El nombre se lee de `app/conocimientos/catalogo.ts`, NUNCA del nombre de la carpeta del
  curso.** Van dos errores por esto: «Jaime Jiguera» por Higuera, y «Jordi Sigues» por **Jordi
  Segués** (corregido en `17e591b16`). Y Vilma Núñez SÍ está en Knowledge: el mapa de
  `catalogo.ts` la renombra, por eso un grep sobre los `curso-*.ts` no la encuentra.

**Otras dos cosas que Martín pidió y están sin hacer:**
  · «No veo que los botones sean cliqueables» — en la app lo son; lo que él miraba era la vista
    previa estática. Queda ver la afordancia real una vez desplegado.
  · Verlo en la app local **no se puede desde este worktree**: `C:/dev/wt-push-q/node_modules` es
    un *junction* a la carpeta de OneDrive, y Turbopack lo rechaza («Symlink … points out of the
    filesystem root») y webpack resuelve los paquetes como cliente y se cae en `require("http")`.
    Haría falta un `npm install` propio adentro del worktree (~1 GB). La vista previa estática
    (`scratchpad/spy_ref.py`, puerto 4899) usa el CSS y los tokens REALES del repo.

### 3-quater. LOS 12 REFERENTES: el curso de cada uno, ya buscado (2/11 ~00:40)

Esto es lo que más tarda de la tarea y ya está hecho. **Cada nombre verificado contra el campo
`titulo:` del archivo del curso**, que es la fuente, NO contra el nombre de la carpeta (el nombre
de la carpeta ya me costó dos errores: «Jaime Jiguera» por Higuera y «Jordi Sigues» por Segués).

| Lo que pidió Martín | Curso en Knowledge | Archivo |
|---|---|---|
| Juan Carrizo | Aumenta tu valor y ATV ADVANTAGE | `curso-aumenta-tu-valor-y-atv-advantage.ts` |
| Vilma Núñez | Certificación en Marketing Digital potenciada por IA (Convierte Más) | slug `certificacion-marketing-digital-ia` ⚠️ **el nombre lo pone el mapa `TITULO` de `catalogo.ts`, no el archivo** |
| Julián Alborna | Inteligencia Viral 2026 | `curso-inteligencia-viral-2026.ts` |
| Andy Landa | ManyChat Master - Instagram | `curso-manychat-master-instagram.ts` |
| Romuald Fons | Bigseo Academy | `curso-bigseo-academy.ts` |
| Sergio Begueria | Instituto De Marca Personal | `curso-instituto-de-marca-personal.ts` |
| Álvaro Luque | The perfect launch | `curso-the-perfect-launch.ts` |
| Francisco Doglio | ARCADIA | `curso-arcadia.ts` |
| Gonzalo Seré | Growing Content Specialist | `curso-growing-content-specialist.ts` |
| Samuel Albaa | Growing Closer (con Agustín Nievas) | `curso-growing-closer-agustin-nievas-samuel-albaa.ts` |
| Emilio Puigrredón | Social Funnel | `curso-social-funnel.ts` |
| Mateo Maffia | BYF | `curso-mateo-maffia-byf.ts` ⚠️ el mapa `TITULO` lo renombra a **«BYF»** a secas |

**Dos avisos para el que lo escriba:**

- **Samuel Albaa comparte curso con Agustín Nievas, que YA es referente.** Para que no salga un
  duplicado, su ficha tiene que destilar SU parte: el *appointment setter* —manejar la conversación
  y conseguir la llamada—, que es distinto del cierre, que es lo que ya tiene Nievas. Lo dice la
  descripción del curso en `catalogo.ts` («convertirte en un appointment setter desde cero»).
- ⚠️ **ESTÁN LOS 12. La primera búsqueda dijo que dos no estaban y era MENTIRA**, por la ortografía:
  es **Puigrredón** con tilde (grep sin tilde no lo encuentra) y **Maffia** con dos efes (Martín lo
  escribió «Mafia»). **La regla: buscar por el pedazo más corto e inequívoco del apellido —`Puig`,
  `Maffi`— y recién después confirmar contra el `titulo:` del archivo.** Un grep por el nombre tal
  como lo escribió quien pidió la tarea devuelve «no está» con total seguridad.

**Falsos positivos que ya descarté, para no volver a abrirlos:** `curso-creator-club` menciona a
Alborna pero es de NXTGEN Academia; `curso-bootcamp-de-cierre-de-ventas-ia` y `curso-master-en-ia`
mencionan a Romuald Fons sin ser suyos. Y buscar «Seré» con grep trae `.tsx` por el futuro del verbo
ser — hay que mirar el `titulo:`, no el grep.

**Lo que falta por cada uno (lo dice la cabecera de `lib/asesores/catalogo.ts`):** su entrada en
`ASESORES`, su `IdAsesor`, su `lib/asesores/ficha-<id>.ts` destilada de la transcripción (≤ 5.200
caracteres, en español neutro con «tú» — el voseo pone ROJO a `tests/puente-panel-copy.test.ts`), y
su caricatura en `public/asesores/<id>.png` con el prompt aprobado que está textual en
`docs/hallazgos-ops-center.md`.

### 3-ter. «Que anden todos los botones» — `55a677a0e`, hecho y con guard

Martín, 2/11, después de mostrárselo a Emilio en la staff. El barrido dio **74 botones sin `onClick`
y 73 eran mentira**; el detalle de las cuatro clases de ruido está en `docs/hallazgos-ui.md`, y lo
que más tiempo ahorra es la primera: **el `<button>` dibujado en un comentario de documentación**,
que casi todo componente base tiene y era la mitad de la lista.

- **El único muerto de verdad:** la muestra del color propio en
  `app/web-generator/editor/paneles/EstiloSeccion.tsx`. Arreglado.
- **El guard:** `tests/ningun-boton-muerto.test.ts`, verde y probado rompiéndolo.
- **El barrido a mano, por si hace falta repetirlo fuera del test:**
  `scratchpad/botones_muertos.py` (misma lógica, imprime el detalle).
- **Sin hacer:** el barrido mira `<button>` y `<a href="#">`. **No mira los `<div onClick>` ni los
  `role="button"`**, que son clicables y no salen en la lista.

### 3-bis. Lo que decía antes (histórico)

Martín lo pidió el 1/11 y **sigue pendiente**: «no solamente quiero que funcione y que traiga datos, sino
que también el diseño esté bueno. O sea, fíjate que la cantidad de botones arriba, texto, eso no me gusta»,
y «mucho mejor si puedes copiar de alguno de estos dashboards el diseño para que se vea muy competitiva a
nivel de diseño esta tab». Después dijo **«Hazlo tu, confio»** y yo me fui a los logos y a los referentes.

- **Lo último que se tocó de la tab es de ayer y es OTRA cosa**: `d5f8b5179` (el componente de la animación
  de orden) y `e41c629e1` (las piezas en carpetas + Instagram con la clave de Apify del negocio).
- **Lo que hay que cambiar** está en `app/competitor-spy/SpyApp.tsx` (905 líneas): entre la barra fija
  (Zona 0, línea 653), las migas e identidad (Zona 1, 693) y las pestañas (Zona 2, 748) **hay siete filas de
  controles antes de que se vea una pieza**. El plan medido era copiar **Vitrea** (la grilla de «Your apps»
  y su banda de tres números) para la ficha del competidor y **Murmura** (alcance, interacción, guardados,
  mejor publicación) para cómo se muestra una pieza, y bajar esas siete filas a unas tres.
- ⚠️ **No tocar sin leer la cabecera del archivo**: la tab se REHIZO el 31/10 copiando once productos de la
  categoría y Martín rechazó la versión anterior. El relevamiento está en
  `docs/hallazgos-competitors-spy.md`. Las reglas de producto (un contador ausente no es cero; la etapa es
  nuestro criterio; nada de «vs») las vigila `tests/spy-reglas.test.ts`.
- **Apify SÍ está conectado** y la clave del ws9 existe (46 caracteres, `apify_api…`). Lo que **no** se
  probó nunca de punta a punta es leer el Instagram de un competidor con esa clave puesta: el botón está en
  la ficha del competidor, «Instagram · Agregar».
- ⚠️ Dos cosas que reporté MAL de Apify y que no hay que volver a medir: la tarjeta **no** está oculta (leí
  `/integraciones` a mitad de renderizar: contaba 13 conectadas y son 14), y **sí** hay clave (usé
  `credWs` cuando el código usa **`credDelCliente(APIFY_CLAVE_DE_SPY, ws)`**).

### 4. Los 20 dashboards del editor de informes: los tiene OTRO chat

`task_a3b08be8`, con el brief completo (los valores medidos de las animaciones y mis cinco errores de
método). **No duplicar ese trabajo.** La propuesta vive en `docs/templates-dashboard-propuesta.md`.

### 5-bis. ACTUALIZADO 1/11 ~21:30 — lo que se hizo después, y el ROJO que frenó el push

**El push de los dos primeros commits SALIÓ ROJO, y el rojo era mío:** `tests/puente-panel-copy.test.ts`
(«ninguna pantalla del repo le habla al cliente de vos»). Las seis fichas nuevas estaban escritas en
VOSEO porque los cursos están dictados así. **La ficha no es la voz del instructor: es la voz de MaKo,
y MaKo habla español neutro con «tú».** Arreglado en `82d1d96e0` con los 112 reemplazos que da el
propio guard. ⚠️ Las formas con «tú» son más largas: una ficha se pasó del tope de 5.200 por 3
caracteres y hubo que recortarla. Si se agregan referentes, escribir en «tú» desde el principio.
⚠️ Y además de ese rojo, 30 archivos NO CORRIERON por RAM (0,6 GB libres): esa lista puede estar
incompleta, así que el próximo push puede traer otro rojo distinto.

**Competitors Spy, que es lo que Martín dijo que más le importa — HECHO:**
- `0688bce47` **los videos de Instagram entran con su imagen.** La cadena estaba cortada en TRES
  lugares y ninguno era Meta: `lib/instagram-perfil.ts` ya leía `thumbnail_url`, pero el mapeo a
  `PiezaVista` la tiraba, el tipo no tenía el campo y `miniaturaDePieza` sólo sabía armar la de
  YouTube. Migración **0360**. ⚠️ Guarda una URL que VENCE, lo que choca con una decisión ya escrita
  (la foto de perfil rota que Martín marcó dos veces): no se esquivó, se EXTENDIÓ ese guard a todas
  las migraciones del spy y se afirmó en un test que la miniatura se reescribe en cada lectura.
  Probado rompiéndolo.
- `b02f5b0e9` **el rediseño: de siete filas a cinco.** Migas + identidad → una cabecera; «Qué vende y
  qué ataca» al ⋯; la Banda arranca PLEGADA (arrancaba abierta y empujaba la primera pieza fuera de
  la pantalla); las pestañas sin fila propia. **Para llegar a TRES falta**: meter las pestañas adentro
  de `spy-herramientas` —hoy no se puede sin esconderlas cuando no hay piezas, porque esa fila sólo se
  dibuja con piezas— y subir la frase de una línea de la Banda a la cabecera.
- **SIN HACER de Spy:** la ficha del competidor y la de una pieza con el lenguaje de Vitrea/Murmura
  (la grilla tipo «Your apps» y la banda de tres números), y probar de punta a punta que la clave de
  Apify del ws 9 lee el Instagram de un competidor.
- ⚠️ **Un comentario con acentos invertidos adentro del template literal del CSS de SpyApp.tsx cierra
  el string** y el error sale 600 líneas más abajo. Verificar con esbuild (`transformSync`, loader
  `tsx`) es mucho más liviano que `tsc` y la guardia de RAM lo deja pasar.

**El modal de elegir gurú:** `f378981ea` (tres barras de scroll → una, 640 → 1040 de ancho).

**Ticket #42 (ws 13, Código Inmobiliario) — ANOTADO, NO ARREGLADO: es del área de la IA, no de Spy.**
El cliente tiene razón: es un «no puedo» FALSO. `crear_evento_google` existe
(`lib/api-mako/areas/calendario.def.ts:56`) y crea el evento de verdad; y la respuesta se contradice
sola («no tengo acceso» y dos líneas después «yo lo creo en tu Google Calendar»). El diagnóstico
completo está en la nota del ticket. ⚠️ Para medir si un negocio tiene Google conectado NO se usa
`credDelCliente` (el catálogo le pone `envs: []`): es `app_settings` con la clave
`google.calendar.refresh_token` (`lib/google-calendar.ts:55`). Yo pregunté por la puerta equivocada
primero — el mismo error que ya pagué hoy con Apify.

### 5. Lo que Martín pidió el 1/11 a la noche y QUEDÓ SIN HACER

Llegaron cinco pedidos encadenados. Hecho: sólo el primero.

**a) ✅ El modal de elegir gurú (HECHO, `f378981ea`).** Tenía tres barras de scroll y era chico.
Las tres salían de heredar el armado de `ElegirMuneco`, hecho para cuatro caritas SIN texto.
Medido con el CSS real: ahora scrollea una sola caja. 1040 de ancho, cinco fichas por fila.

**b) ⛔ Doce gurús más, con su curso como base de conocimiento, y un botón de Second Brain con el
grafo adentro de cada chat.** Es el pedido más grande y el que más cambia de tamaño al medirlo:

- **Los doce TIENEN curso en Knowledge** (medido). Juan Carrizo → «Aumenta tu valor y ATV ADVANTAGE»
  (247 clases) · Álvaro Luque → «The perfect launch» (237) · **Vilma Núñez → «Certificación en
  Marketing Digital potenciada por IA» (153)** · Romuald Fons → «Bigseo Academy» (137) · Sergio
  Begueria → «Instituto De Marca Personal» (92) · Gonzalo Seré → «Growing Content Specialist» (92) ·
  Samuel Albaa → «Growing Closer» (66, lo da junto con Nievas, que ya es referente) · Julián Alborna
  → «Inteligencia Viral 2026» (41) · Mateo Maffia → «BYF» (33) · Andy Landa → «ManyChat Master
  Instagram» (25) · Francisco Doglio → «ARCADIA» (24) · Emilio Puigrredón → «Social Funnel» (11).
- ⚠️ **EL TÍTULO DE UN CURSO VIVE EN DOS LUGARES Y EL DEL ARCHIVO PUEDE NO TENER AL AUTOR.**
  `app/conocimientos/curso-<slug>.ts` dice `titulo: '… - Convierte Más'` y
  **`app/conocimientos/catalogo.ts:836` lo RENOMBRA** a «… - Vilma Núñez (Convierte Más)». El segundo
  es el que se ve en la app. Yo grepeé sólo el primero, dije «no está en Knowledge» y Martín me lo
  corrigió con una captura. **El mapa de `catalogo.ts` es el que manda.** Y el mismo error me hizo
  descartar ese curso en la primera tanda por «no tiene autor con nombre».
- ⚠️ **«Base de conocimiento con la transcripción» NO es la ficha de hoy.** La ficha son 5.200
  caracteres que entran enteros al system. Las transcripciones son 60-130 KB **por clase**, y el curso
  de Carrizo tiene 247. Eso no entra en un prompt.
- ✅ **PERO EL MOTOR YA ESTÁ, y esto es lo que más ahorra:** `lib/cerebro-knowledge.ts` (31/10) ya
  cuelga Knowledge como CAPA del Second Brain (`conCapa`, lib/cerebro-union.ts), con un nodo por
  módulo, y `lib/cerebro-recuperar.ts` recupera del grafo **sin IA y con presupuesto**. El componente
  del grafo también existe: `app/second-brain/Grafo.tsx`, que recibe
  `cerebro = { nodos, aristas, cuenta, posiciones, encuadre }`.
- **Lo que falta, entonces, es cableado:** (1) una capa por REFERENTE —curso → módulos (`grupo`) →
  clases, que ya es un grafo natural y no necesita embeddings—; (2) el botón en el chat del gurú que
  abre `Grafo` con esa capa; (3) las doce fichas y caricaturas.
- **El molde de una ficha y de una caricatura está probado**: ver el punto 2 de este relevo y
  `docs/hallazgos-ops-center.md` (el prompt aprobado, y que el nombre se verifica contra el mundo).

**c) ⛔ La extensión no debe ofrecer NINGUNA descarga** (Martín, con captura de
hola-mako.com/extension/instalar: «dijimos que ya no se descarga nada, solo por el instalador de
extensiones de chrome»). Medido y sin tocar:
- La Chrome Web Store publica HOY la **0.74.3**; el repo sirve la **0.74.4**.
- `lib/extension-tienda.ts` tiene `VERSION_EN_TIENDA = '0.39.1'`: **quedó vieja desde el 27/10**, y por
  eso la página cae al zip. Actualizarla a 0.74.3 NO alcanza: el flag se deriva de
  `!esMasVieja(tienda, repo)` y 0.74.3 < 0.74.4 sigue dando false.
- **No se puede publicar la 0.74.4 desde este worktree**: faltan `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`
  y `CWS_REFRESH_TOKEN` en `.env.local`.
- Los cinco consumidores del flag: `next.config.ts:181`, `app/extension/instalar/page.tsx:49`,
  `app/perfil/instalar/page.tsx:35`, `app/video-generator/puente-avisos.tsx:150`,
  `app/mako-puente.zip/route.ts:36`.
- ⚠️ `tests/extension-sin-zip-con-tienda.test.ts` afirma la FORMA del código (pide que exista la línea
  `const desdeLaTienda = EXTENSION_EN_TIENDA;` y la forma exacta del redirect): hay que reescribirlo
  junto con la política, no después.
- ⚠️ Y leer el comentario largo de `lib/extension-tienda.ts` antes de tocar: el flag existe para que
  sea IMPOSIBLE mandar a un cliente a una versión vieja de la tienda. La decisión de Martín no se
  implementa tirando esa protección: se implementa cambiando lo que ve el cliente cuando la tienda va
  atrás (hoy: un instructivo de descomprimir un zip; debería ser: decirlo).

**d) ⛔ Sacar «Ads Manager» y «Offer» de la sidebar.** Martín: «Ads Manager pasaría a llamarse Funnel
Coach y Offer sería tomado por Alex Hormozi y todo estaría dentro de OpsCenter. No hace falta que
tengan su propia ruta, su tab aparte». Sin medir todavía. Lo que hay que medir ANTES de borrar: qué
hace hoy `app/ads-manager/` y `app/offer/` que el chat del Ops Center NO haga, y todos los links
internos que apunten ahí (href, router.push, redirects, la API de MaKo, los avisos, el onboarding) —
un link a una ruta muerta es un 404 para un cliente. Distinguir «sacar de la sidebar» (barato) de
«borrar la ruta» (caro). La nav está en `app/_components/nav.ts`.

**e) ⛔ Elegir gurú desde «nuevo chat».** Martín: «no tengo en claro cómo poder chatear con algún gurú
cuando le doy a nuevo chat, no me aparece la opción de poder seleccionar alguno de ellos». Hoy el
referente sólo se elige para DOS coaches (`IdCoach = 'funnel' | 'offer'`, lib/asesores/catalogo.ts) y
se guarda en app_settings con la clave `coaches.referentes`. La pantalla es
`app/second-brain/ElegirReferente.tsx` y se abre desde el chat del coach, no desde «nuevo chat».

**f) ⛔ El rediseño de Competitors Spy** sigue igual que en el punto 3 de este relevo.

### Orden propuesto para el que siga

1. **(c) la extensión** — es lo único que un cliente ve HOY mal y es chico.
2. **(b) la capa por referente + el botón del grafo** — el motor ya está; es el mejor rendimiento por
   hora de todo lo que queda.
3. **(b) las doce fichas y caricaturas** — caro por gurú (hay que leer transcripciones de verdad), se
   puede hacer de a tandas.
4. **(e) elegir gurú en un chat nuevo**, que se apoya en lo de (b).
5. **(d) la sidebar** y **(f) Spy**.

### Decisiones abiertas de Martín (sin tocar)

- Si Competitors Spy se abre a los clientes (`adminOnly: true`, `app/_components/nav.ts:378`).
- Si las páginas de venta pasan al tema nuevo.
- Rehacer las 24 hojas guardadas del Dashboard.

## El ritual de una cuenta nueva — 29/10/2026 ~00:55, de la cuenta 4 (claude4); sigue valiendo

**Si sos una cuenta NUEVA**, Martín te escribe «Hola, eres la Nª cuenta… Continúa con todo» y con eso alcanza. No
preguntes: hacé esto en orden.

1. **La cuenta:** `claude<N>` en `~/.claude/cuenta-activa.txt`; su línea en `~/.claude/cuentas.tsv`; `get_usage` →
   `uso-semanal.txt` y `uso-cinco.txt` con la cuenta en el 4º campo. El reset semanal prueba que es otra cuenta.
2. **El Runner, y probado de punta a punta** (Martín, 27/10: «siempre, al abrir una cuenta nueva, asegurate de que esté
   bien la conexión con el Ops Center»):
   - `node ~/.claude/operaciones/cartero.mjs cartero claude<N> app ~/.claude` y `… carpeta <uuid> claude<N>`;
   - `start_session` «Runner», `claude-haiku-5-5`, esfuerzo bajo, con `INSTRUCCIONES_RUNNER` (lib/runner.ts) como
     encargo + «hacé una vuelta ya»; después `detach_session`;
   - ⚠️ **EN BYPASS, como los chats.** En «auto», la app RETIENE los mensajes entre sesiones de modos distintos y el
     cartero los acusa «ok» igual: el 27/10 Martín escribió tres veces y nadie contestó (docs/hallazgos-operaciones.md).
     Si lo abrís en auto para no mostrar una tarjeta, subilo con `set_session_permission_mode` (desde bypass no pide nada);
   - **El ciclo se prueba con el reloj:** `medido` de `~/.claude/operaciones/uso/<cuenta>.json` cambia DOS veces seguidas
     (cada 2 min). Después, un mensaje de prueba de Martín desde el Ops Center tiene que llegar al Cerebro.
   - ⚠️ Un reinicio de la app se lleva el CronCreate del Runner, y el Runner NO lo re-arma si se lo pide el Cerebro
     (es config persistente): se abre uno nuevo en un turno de Martín.
3. **Este chat se llama «Cerebro».** Los de área se abren EN EL TURNO de Martín (un turno que arrancó con el mensaje de
   otra sesión no puede abrir chats), cada uno con su worktree `C:/dev/wt-<área>-<fecha>`.
4. **El estado de la cuenta anterior se VERIFICA con git, no se copia** (lectores Sonnet sobre la cronología + git).
5. **La ronda anti-trabas, cada hora** (Martín, 28/10: «Revisa que otras cosas quedaron trabadas, eso no puede pasar»).
   Un CronCreate en este chat (`17 * * * *`) y a mano al arrancar:
   - ListAgents: un chat «waiting on a human» o «pending» por más de 30 min, o uno local idle con trabajo, se destraba;
   - `git ls-remote origin 'refs/heads/nube/*' 'refs/tags/nube/*'` contra main: lo que no entró va al tren;
   - los tickets abiertos, cada uno con un chat dueño vivo.
   El 28/10 había cinco chats de la nube 13 horas sin entregar (esperaban aprobaciones que nadie vio), tres ramas
   `nube/*` sin integrar y el ticket #15 de Leila sin dueño. Un chat de la nube NO le avisa al Cerebro: se lo mira.

## Integración — los TRENES de claude3 (29/10 desde ~02:30 ART; lo arma el chat «Cerebro › Integración»)


- **⛔ CIERRE DE INTEGRACIÓN AL 95% (30/10 ~14:20 hora del log, claude3). Lo que sigue es para la próxima cuenta.**
  - **Producción:** main = `9e24e7935` (tren-ai, `mako-gr9maew7i`), más este cierre de docs. Ningún workflow ni agente de
    Integración queda corriendo.
  - **Árbol del tren:** `C:/dev/wt-push-q`. Se sube con `node C:/dev/revisiones/subir-tren.mjs <log> 150`, SIN `SUBIR_UN_LUGAR`
    (ver hallazgos-infra, 30/10). Un worktree nuevo necesita la junction de `node_modules` a `C:/dev/wt-copywriter-notion/node_modules`.
  - **El próximo tren (tren-aj). Entra cada pieza cuando su chat la arregle:**
    1. **Calendario y Classroom** (`cal-classroom-2910` en `7162c94aa`): cuatro rojos de Clients, uno es una guarda del super
       admin. La devolución está en `integracion-cal-classroom-devuelto.md`. Su recorrido visual (`recorrido-k-3010` en
       `246bae899`) va detrás y no corrió tests-afectados.
    2. **Agency de Thiago** (`agency-thiago-2910` en `28cc3e2cb`): tres rojos, uno es una guarda de `/api/auth/me`. La
       devolución está en `integracion-agency-thiago-devuelto.md`. La re-verificación de plata ya dio «entra con bajas».
    3. **Newsletter** (`newsletter-2910` en `85d2206c9`): cerrar M1, porque la tab y la API las pasa cualquier admin. La
       devolución está en `integracion-newsletter-devuelto.md`. La 0351 ya está aplicada.
    Las tres devoluciones están en la carpeta compartida del Cerebro:
    `C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_428051c1-0369-4df2-ae6b-bcb42f63b64b/`.
    Los chats de las tres estaban archivados.
  - **Ramas de respaldo:** `tren-ah-con-agency` y `tren-ai-con-calendario` (la mezcla ya resuelta) y `tren-ae-con-wa`. Las
    ramas viejas `tren-ab` a `tren-ai` se pueden borrar cuando main las tenga.
  - **Abierto, sin dueño:**
    - que `subir-tren.mjs` no suelte la pausa cuando el push falla por RAM;
    - la BAJA de N1 en Zernio: si al borrar falla la lectura de la serie, el «Deshacer» la devuelve suelta;
    - la BAJA del despachante: «plan» está en `DELEGADO_SEGURO`.

Integración arma y chequea cada tren en `C:/dev/wt-push-q` y lo sube con `node C:/dev/revisiones/subir-tren.mjs <log>`
(`SUBIR_ARBOL` cambia el árbol; `SUBIR_UN_LUGAR=1` no espera el segundo lugar de tests). El Cerebro de claude3 es
`local_428051c1`. Esto vale por encima del estado de claude4 de más abajo.
- **AHORA (29/10 19:35): main = `7ed7e17c6`, tren-ad. READY 19:39: hola-mako.com sirve `mako-d84v86v9d`
  (dpl_HvtuD89v…).** Avisados el Cerebro y los dueños no archivados.
  - **Qué trae:**
    - AI Avatar para todos los planes (`4d66a5703`), con «Antes de generar» paso a paso.
    - La tarjeta del Avatar en la landing (`7511f5f14`). El script la corre el Cerebro a mano. ⚠️ Su comentario espera a la
      rama vieja `ai-avatar-para-todos-2910`, pero la que subió es `ai-avatar-todos-2910`.
    - El «Publicar» desde el Video Editor, el Image Editor y el Copywriter (Zernio `77cf7a90b`), por el camino del Calendario.
    - Del Cerebro, sólo docs: las plantillas reales (`da6d07dee`) y lo prometido a la agencia de Thiago (`534d0496e`).
  - **Chequeo:** 7482 tests en verde y las guardas; el delta de docs, 243 barredoras en verde; las tres tandas de tipos del
    push en 0.
  - **Revisión de plata** (`C:/dev/revisiones/2910-revision-plata-ai-avatar-todos-4d66a5703.md`): «entra con bajas».
    - Sin ALTA: la puerta no abre nada más y MaKo no paga IA.
    - MEDIA: la fila de /planes y el «y tu avatar con IA» de Esencial venden un motor que nunca generó un look en producción,
      y no dicen que se paga con Google Flow del cliente.
    - **El Cerebro dijo «sacar»:** salió en el tren-ae (`AI_AVATAR_SE_VENDE = false`).
    - Cosechado en `docs/hallazgos-planes-y-cobro.md` y `docs/hallazgos-ai-avatar.md`.
- **tren-ae SUBIDO: main = `4b8f8145d` (29/10 21:42). READY 21:45: hola-mako.com sirve `mako-gv9vfmoz3`
  (dpl_E2uWxgoB…).** Avisado el Cerebro; Create y el Copywriter estaban archivados.
- **tren-af SUBIDO: main = `c9070ea0d` (30/10 01:11). READY 01:15: hola-mako.com sirve `mako-bcacs3b3m`.** Subió al tercer intento: el primero se rindió por RAM (ver hallazgos-infra, 30/10).
  - **Lleva:**
    - El Media Buyer de Thiago (`b4ee3c411`): dónde, hasta, y «lánzame una campaña», que nace en PAUSA y se relee. La mig 0350
      está APLICADA (21:50).
    - Automations #25 de Leandro (`b26d89b94`): el CRON de comentario elige la publicación o el Reel.
    - El Copywriter sin ninguna mención a Copy Method (`bf7e86c27`).
  - **Revisión de plata del Media Buyer:** «entra con bajas», sin ALTA. La baja y M1, M5 y M6 están hechas. Cosechado en
    `docs/hallazgos-ads.md`. El vigía apagado sólo mira fechas, y ninguna configuración de producción tiene fechas.
  - **Arreglado por Integración** (el chat de Ads estaba archivado):
    - `revisar-fijo`: los ids con que se arma la campaña quedan fijos al revisar (`c9d23904c`);
    - el aviso de la campaña creada lleva «Reportar a Soporte» (`13562c8a8`).
  - **Chequeo:** 9351 tests, más el delta, más las guardas. Los únicos rojos fueron los `todo` de siempre.
- **⏩ RELEVO AL 87% DE LA SEMANAL (30/10 06:06, claude3).** Quien siga lee esto primero. Si la cuenta corta, el que retome
  arranca por el estado del push del tren-ag: `git -C C:/dev/wt-push-q fetch && git log -1 origin/main`. Si main es
  `3076925cf` o posterior, el tren-ag subió y queda confirmar el Ready.
- **tren-ag SUBIDO: main = `333fefd92` (30/10). READY 03:39 (hora del log): hola-mako.com sirve `mako-5sc7gr322`.** Avisados el Cerebro y Video.
  - **Lleva:**
    - PRIORIDAD, cliente roto: los tickets #31 y #32 de Leila (`d5baaa302`; el tsc encontró un error real que arregló el chat).
    - El Copywriter: las tarjetas con la guía y «Ver ejemplo», y el detector de voseo con el generador del guard (`85119f019`,
      que contiene `6713868bb`).
    - Zernio `da3cff9f7`: leads filtrados en memoria, las publicaciones que se repiten (inertes sin la 0349) y la tarjeta de
      WhatsApp. La re-verificación dio «entra con bajas».
    - Del Cerebro, sólo docs: `iniciativa-plan-2910` y `conocimiento-email-2910`.
    - La guarda `tests/migraciones-numero-unico.test.ts` (`f71bb1a63`).
  - **Rojo del barrido, arreglado en el tren:** el guard de voseo leía el léxico de `lib/voseo.ts` (`512f49af5`).
  - **Al estar Ready, avisar:** al Cerebro (Leila primero) y al chat de Video (`local_2f82a70c`).
  - ⚠️ **La 0349 sigue SIN aplicar:** N1 (deshacer el borrado de una vez de la serie le saca `serie_de` y vuelve a abrir A2).
    El chat de Zernio estaba archivado cuando se le devolvió. El Cerebro se la pide a Martín recién cuando Integración la dé
    por buena.
- **tren-ah SUBIDO: main = `88700b981` (30/10). READY 05:16 (hora del log): hola-mako.com sirve `mako-ou9xtjw1c`.** Avisado el Cerebro: ya puede aplicar la 0349 si Martín dijo sí.
  - **Lleva:**
    - la iniciativa del Ops Center (`88d2cf0db`);
    - la barra del Reproductor (`d121a5e6f`);
    - Zernio N1 y N8 (`7da5d9ec3`), verificado con el código y `calendario-recurrentes` 20/20;
    - el relevo del Cerebro (`7af7751ce`).
  - **Barrido:** 6475 tests en verde, con 3 flaky que pasan aislados. Las guardas en verde.
  - **La 0349 se aplica DESPUÉS del Ready del tren-ah.** Antes no: en producción está `da3cff9f7`, sin N1.
  - **Agency SALIÓ del tren-ah** por tres rojos suyos. Uno es una guarda de `/api/auth/me` (`agenciaDeCliente`). La mezcla
    está en la rama `tren-ah-con-agency`, y la devolución en la carpeta del Cerebro (`integracion-agency-thiago-devuelto.md`).
- **tren-ai SUBIDO: main = `9e24e7935` (30/10). READY 14:16 (hora del log): hola-mako.com sirve `mako-gr9maew7i`.** Avisado el Cerebro (#33, #34 y #35).
  - **Lleva, los clientes primero:**
    - el #34 de Código Inmobiliario (Zernio `43897f1df`): un 429 es una pausa, no una conexión rota;
    - el #35 de Código Inmobiliario (`7d51f24c2`): la ficha del lead trae la hora de la reunión;
    - el #33 de Automations (`da015ebd5`): el botón de un DM viejo y el postback que no va a la pausa;
    - el despachante de MaKo en WhatsApp (`cc2aaa6ce`, el #30 de Leandro).
      - Control de Integración: la guarda del «hazlo» quedó al revés (`DELEGADO_SEGURO` más vetos de plata, envío y borrado, más el
        permiso de admin).
      - BAJA: «plan» está en la lista segura, y «cambiá mi plan» depende del veto de plata.
      - Después del deploy: `cartero.mjs instalar` (1.24.0).
    - Video, pasos 1 y 2 (`0e27cb66f`);
    - los emails del Cerebro (`2b9b9d7b7`).
  - **NO lleva:**
    - (el #35 ya ENTRÓ: `7d51f24c2`, la hora de la reunión en la zona del negocio)
    - Agency y Newsletter: volvieron a sus chats.
    - **Calendario y Classroom (`7162c94aa`): SALIÓ** por cuatro rojos suyos en la pantalla de Clients. Son `curso-invitar`, `cs-cartera-columnas`,
      `cs-kanban-ficha-ui` (una GUARDA: «el super admin sin impersonar no tiene fichas de leads») y `customers` (el redirect del
      super admin a /customers). La mezcla está en la rama `tren-ai-con-calendario`. Su chat (`local_18ef0a3f`) tiene que
      arreglarlo, y después entra junto con su recorrido visual (`recorrido-k-3010` en `246bae899`, que SALE de 7162c94aa: va
      después de Calendario, y no corrió tests-afectados).
- **N3 lo decidió Martín (30/10 ~10:15):** «Sí, cualquiera en el grupo puede». Pausar o prender campañas y anuncios desde el grupo de
  un negocio lo puede pedir cualquiera, con la confirmación de siempre y sobre la cuenta de ese negocio. Está en memoria como
  `campanas-desde-el-grupo-cualquiera`.
- **Migraciones aplicadas el 30/10 por el Cerebro, con el sí de Martín:** 0349, 0351 y 0352.
- **La 0331 (`curso_accesos.productos_a_mano`) y el índice de la 0048 ya están APLICADOS** (el Cerebro, 30/10).
- **Para quien siga:**
  - Lo que aprendió esta tanda está cosechado en `docs/hallazgos-infra.md`, en la entrada «Un número por migración, y el push
    que falla por RAM…».
  - Cuando el push falla por RAM, se reintenta enseguida SIN `SUBIR_UN_LUGAR`.
  - Antes de cada push, el Cerebro frena sus workflows.
- **Detalle del tren-ae:**
  - **Lleva:**
    - Create: la QA visual (`95ac56201`) y la base de las plantillas reales (`390229c3d`, que la contiene).
    - Las plantillas del Copywriter (`1d9160f87`). El test de los ejemplos lee `REALES` de `tests/_reales.ts`, porque Create
      la mudó ahí (`837d7f377`).
    - La tabla de planes no vende AI Avatar (`b8c9c7a78`).
  - **Chequeo:** 6658 tests en verde, salvo el rojo de las dos ramas cruzadas, ya arreglado; `alta-cliente-conducta` fue
    flaky. Las guardas en verde. Después del arreglo, los tests que leen `docs/` y los del Copywriter: 71/71.
- **Devueltos a su chat (NO entran hasta el sha nuevo):**
  - **El despachante de MaKo en WhatsApp** (`wa-fallas-2710`, `85a0d9ead`; el #30 de Leandro). Dos ALTA de privacidad:
    - un hito de la bitácora con tickets de dos negocios se le mostraba entero a uno;
    - el pedido delegado dice «hazlo» sin respetar el triage.

    Informe: `C:/dev/revisiones/2910-revision-privacidad-wa-despachante-85a0d9ead.md`. La mezcla con main ya resuelta quedó en la
    rama `tren-ae-con-wa` (`bc74bd07f`).
  - **Zernio, los leads por barrido y las publicaciones que se repiten** (`zernio-token-2910`, `ce56bd693`):
    - el filtro de cuentas va sólo en la URL;
    - una clave «propia» trae los leads de otros negocios;
    - el lead con dos formularios alterna cada 30 minutos;
    - la papelera se lee sin paginar;
    - la serie hace renacer la vez borrada.

    Informe: `C:/dev/revisiones/2910-revision-privacidad-zernio-leads-ce56bd693.md`.
    - ⚠️ **La 0349 NO se aplica**, aunque Martín diga que sí, hasta que Integración dé por buena la punta nueva (acordado con
      el Cerebro).
    - El interruptor `zernio.cuenta_de_la_plataforma` sigue apagado.
- **Antes: tren-ac, main `ff908e645`, READY 17:07 (`mako-8g8vtn7tv`, dpl_ioqDqJGw…).** Avisados el Cerebro (que le
  escribe a Leandro por el #29) y Zernio. Los demás dueños estaban archivados.
  - **Qué trae:**
    - El ticket #29 de Leandro (Automations `38c39d067` + `50b7ff798`): «Ya te sigo» vuelve a entregar el recurso, porque
      pregunta a Zernio con `refresh=true`.
    - Pagos `7f79a4e6c` y la tabla de planes `90a760e4b` (Web Generator).
    - Zernio con varias claves por negocio (`7b7d1ca2b`), más LinkedIn, X, Threads y Google Business. Pasó la revisión de
      privacidad.
  - **Rojos del chequeo, arreglados en el tren:** tres tests de otras áreas que leen `lib/zernio.ts` (`606f2dcef` y
    `27ba51334`). Cosechado en `docs/hallazgos-integraciones.md`.
  - **El grupo compartido 2/2 murió con la RAM en 0:** «0 tests» y 388 rojos. Re-corrido solo dio 3755 tests, con sólo los
    rojos conocidos (alta-cliente-conducta, que pasa sola, y el `todo` de chats-mako-envio).
  - La pausa «reunión de Martín» (17:03–18:23) la levantó el Cerebro. El proceso que la refrescaba se cerró solo.
  - NO subir `ai-avatar-abrir-pro-2910` ni `ai-avatar-para-todos-2910`: quedaron viejas.
- **Antes: el tren grande (tren-ab), main `1cf06eba9`, Ready 14:29.** 128 commits, con las 3 tandas de tipos en 0.
  - **Qué trae:**
    - Create entero: el shell, el Copywriter en Notion con la mudanza re-verificada, AI Avatar y el «Cómo conectarla».
    - MaKo en WhatsApp (`ac593ce1d`): las 6 fallas de Leandro, la ALTA 2 y los tickets al Cerebro (cartero 1.23.0).
    - Pagos por tramos (`805afb460` + `d9ad67553`): tickets #13 y #26.
    - CRM: el documento fiscal (`ba0c6c4b3`) y la difusión de Leila con la papelera y su cron.
    - La landing High Ticket (`213952a92`) y Zernio #28 (`59db6b0eb`: Meta en la pestaña de Zernio).
  - **Antes:** el hotfix #27 de Joan (`3648cedb8`, Ready 12:52) y tren-z (`9f8216dc8`, Ready 10:27).
  - **Al estar Ready:**
    - El Cerebro corre `node scripts/operaciones/cartero.mjs instalar` desde main, para el Runner 1.23.0.
    - Avisar a los dueños.
  - **Tablas APLICADAS el 29/10 (el Cerebro, con el sí de Martín):** 0340, 0342, 0343 y 0347 (la diferencia en pesos de
    Pagos). Esperan: 0344 (el Image Editor) y 0346 (MaKo sin conexión).
- **⚠️ BlockNote y Mantine no están en el node_modules COMÚN** (el junction de casi todos los worktrees de C:/dev, al clon
  principal). Desde ahora main los importa: hasta que el clon principal los tenga, un test o un tsc de un chat que toque el
  Copywriter va a fallar con «Cannot find module». `C:/dev/wt-push-q/node_modules` apunta hoy a
  `C:/dev/wt-copywriter-notion/node_modules`. Lo que falta, con la app tranquila y sin tests corriendo, es pasar el clon
  principal a origin/main y correr `npm install` (NO `npm ci`, que borra el node_modules de todos mientras instala).
- **Tren grande EN PRODUCCIÓN: `mako-obai8j5oz`, Ready 14:29.** Avisados el Cerebro y los dueños no archivados.
- **0348 APLICADA (29/10, el Cerebro con el sí de Martín):** el CHECK de `red` del Calendario acepta las 8 redes.
- **Zernio, varias claves (`7b7d1ca2b`):** Martín lo dio vuelta el 29/10 16:40 UTC (audio en el grupo de SuperAdmin). Subió
  en tren-ac. La revisión de privacidad está en `C:/dev/revisiones/2910-verificacion-zernio-varias-claves-7b7d1ca2b.md`.
- **Lo que quedó para el tren siguiente:**
  - ~~Pagos `7f79a4e6c`~~: re-verificado, entra en tren-ac.
  - `tren-aa` (`C:/dev/wt-push-aa`): quedó VIEJO, todo lo suyo subió en tren-ab. Se puede borrar el worktree.
  - `ai-avatar-abrir-pro-2910` (`4912250c6`): NO subir (abre AI Avatar a Pro; espera la prueba con un avatar real).
- **tren-y SUBIDO: main = `eab9c62e1` (29/10 05:46).** Trae los docs de claude4 y el P0 de Martín, la foto de Replicar
  (`22b4b75c4`, rama `web-generator-foto-2910`). Tests del tren verdes (la tanda de 43 re-corrida de a 6: 608/608), las
  guardas, la batería y las 3 tandas de tipos en 0. Al estar Ready: avisarles al Web Generator (`local_12107aea`) y al
  Cerebro, que se lo dice a Martín y cierra su ticket (ws9, /web-generator/68). **READY 05:50: hola-mako.com sirve
  `mako-mf08d4332` (dpl_46nkYU9H…); avisados el Cerebro y el Web Generator.**
  - Fuera de tren-y: `d413ad03b` del Web Generator (las copias idénticas en el editor). Es otra pieza y necesita su VERDE.
- **tren-z (rama `tren-z` de `C:/dev/wt-push-q`, sin subir): main `eab9c62e1` + Zernio + Planes `4b6acf1c0` (merge
  `4e9a099d9`) + Web Generator `c3c6849bc` (las copias idénticas en el editor, merge `d45a0665f`).** Choques sólo de docs;
  `docs/api-mako.md` regenerado. Los guiones del refutador de Planes sobre `4b6acf1c0` (salidas en
  `C:/dev/revisiones/scratch-4b6a/`): en todos los casos de SEPA, tarjeta y segundo voucher queda UNA cuota, y sub_A se cancela
  antes de armar B.
  - **Más Automations `f8a13def3`** (merge `ff8ec04b6`; lo de Leandro). La primera re-verificación de `0265924c6`
    (`C:/dev/revisiones/2910-reverificacion-automations-0265924c6.md`) halló una regresión: el primer DM de quien ya estaba en
    una automatización de comentario quedaba sin respuesta (`tomadas` contaba cualquier inscripción pausada). La arregló
    `b3d734055`, que pasa a `contestada`. Con el mismo arnés (`C:/dev/revisiones/scratch-f8a1/`), el primer DM se contesta, el
    doble sigue cerrado y «Volver a probar» sale entero.
  - **Rojos del chequeo, arreglados en el tren.** Tres tests del editor que fijaban el JSX sin la escala: los arregló el Web
    Generator (`9e73cfb2b`). Dos de Zernio los hizo Integración (`2f9f2ab98`), porque su chat estaba ARCHIVADO: los avisos de
    publicar con «Reportar a Soporte», y `keyDeSeguimiento` otra vez con la key PROPIA. `tests/zernio-sin-respaldo.test.ts` de
    la rama pedía `cfg(ws)` y `tests/condiciones-instagram.test.ts` pedía la propia: se contradecían. Ganó la decisión de
    Martín del 28/10 («NO a la cuenta de MaKo»), en `75a6ff630`.
  - **Chequeo final: 9351 tests de 961 archivos en verde**, con la referencia de la API al día.
- **Pagos por tramos `9fc4030dd`: NO entra.** Verificación adversarial en
  `C:/dev/revisiones/2910-verificacion-pagos-tramos-9fc4030dd.md` (guiones en `scratch-9fc4/`). Dos ALTAS de plata. A1: una
  cuota en pesos que se cobra a medias y se deja vacío «en dólares» queda pagada entera. A2: el anticipo quitado o devuelto
  vuelve al guardar sin tocar nada. Además tres medias y cinco bajas. No hay cruces de negocio. Devuelto al chat
  (`local_9b34bb88`).
- **WhatsApp `450677f90` (wa-fallas-2710): NO trae lo de Leandro.** Sus 6 fallas están en `152cfcd27`, sin VERDE, y la
  ALTA 2 de su verificación sigue abierta: `pideAlgoAMaKo` calla los pedidos reales mientras hay una pregunta del equipo
  viva, una REGRESIÓN contra producción. Se le preguntó al Cerebro si entra igual o espera a `152cfcd27`.
- **aut-2510 `0265924c6`: VERDE, sin re-verificar todavía.** El árbol es `C:/dev/verif-0265924c6` y los scripts del
  refutador de 69b49a31c, con la ruta cambiada, están en `C:/dev/revisiones/scratch-0265/`. Se corren de a uno por con-turno.
  Le faltan además las 710 barredoras.
- **Zernio + Planes: VERDE `4b6acf1c0`** (zernio-2510; el chat arregló las tres ALTAS de Planes). El diff lo leí yo y no
  encontré hueco nuevo; queda una baja: un admin que invita el email de otro cliente que pagó se saca los topes de la prueba.
  Siguen sin hacer la media del 429 de Resend (el aviso de vencimiento se repite) y las bajas del plan a mano. La 0341 ya
  está aplicada (28/10). La 0342 NO, y el código anda sin ella (publicar desde el Calendar avisa que falta). El árbol es
  `C:/dev/verif-4b6acf1c0`.
- **Zernio `8d48ef4c3` + `df3f9bebf`: sus arreglos PASAN** (re-corrí el refutador de la verificación sobre `df3f9bebf`, en
  `C:/dev/verif-df3f9bebf`; scripts y salida en `C:/dev/revisiones/scratch-df3f/`). Las dobles publicaciones de «Reintentar»
  (R1a-d, también con el replay `{existingPost}`), los 4xx (R2), el «Deshacer» (R5) y la carrera (R6) dejan UN post o frenan;
  la clave cambiada (R7) dice «Ya lo resolví en Zernio». R3b deja dos posts sólo si la persona aprieta «No quedó programada»
  sabiendo que quedó: ahora tiene el botón correcto. `resolverEnZernio` escribe con `getTenantDb` y con la condición.
- **⛔ Pero Zernio NO entra todavía:** lleva Planes hasta `d15b4ec1d`, con la MEDIA «un pago OXXO, Boleto o SEPA que falló no se
  puede reintentar» (regresión de d15b4ec1d, `C:/dev/revisiones/2810-verificacion-a196d5a93.md:193`) y MAU-10. El arreglo
  está en Planes `ddfa645d4`, que dio NO con TRES ALTAS (SEPA de suscripción que arma otra sin cancelar la primera, dos
  casos; el plan a mano `ya_tenia_cuenta` sin alta). No hay chat de Planes en claude3: se le propuso al Cerebro dárselas al
  chat Zernio (`local_4a831c28`). Los dos rojos de Zernio (puente-panel-copy y cobro-lanzamiento) los arreglan `a196d5a93` y
  `94633ec58`, de Planes: entran solos al mezclar Planes.
  **Decidido (Cerebro, 29/10):** el chat Zernio mezcla Planes `ddfa645d4` en zernio-2510 sobre `df3f9bebf` y arregla las
  tres ALTAS con los scripts del refutador; su VERDE llega a Integración y entra TODO junto (Zernio + Planes).
- **ORDEN de la fila (Cerebro, 29/10 ~03:05, por un cliente roto: MaKo le contesta mal a Leandro en su grupo):** 1) el P0 de
  Replicar (tren-y); 2) `wa-fallas-2710` (`C:/dev/wt-conex-2510`), con el VERDE del chat «MaKo en WhatsApp: lo que le contestó mal a
  Leandro» (`local_cf058ed5`); 3) `aut-2510` SOLO (el filtro por palabra clave, la respuesta pública y «Volver a probar»): al
  estar Ready, el Cerebro le escribe a Leandro; 4) `crm-difusion-2910` y Zernio + Planes. Cada uno Ready → avisar al Cerebro.
- **La difusión de Leila llega como UNA rama, `crm-difusion-2910`** (crm-lote-2810 + aut-2510 + el enganche del «⋯» de la
  columna): se toma esa y no las dos sueltas. La 0340 ya está en la base.
- **⚠️ Choque de número 0340:** `motion-imagen-2610` (Video/Image Editor) trae otra `0340_image_editor_propuestas.sql`. Al
  entrar esa rama, la que se RENUMERA al siguiente libre es la del Image Editor: la del CRM es la que está en la base.
- **Cómo se sube (cambió el 29/10, 04:20):** la pausa NO se prende para el push (con con-turno traba el lock de tipos:
  docs/hallazgos-infra.md, «La pausa TRABA el push»). Se espera la fila de tipos vacía y RAM ≥ 5,2 GB (si falta, se cierra
  Chrome con `taskkill` sin /F) y `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=4608 MAKO_TIPOS_RAM_MIN_GB=4.8 git push origin
  HEAD:main` en segundo plano. Lo hace solo el guion del scratchpad de Integración `subir-cuando-libre.ps1` (copia en
  `C:/dev/revisiones/subir-cuando-libre.ps1`). La
  rama `integracion` NO avanza main (sin Actions): el push de docs de claude4 a las 01:40 quedó ahí (`5d36f97d5`).

## Estado al escribir — RELEVO FINAL de claude4 (29/10 ~00:55 ART, semana al 95 %; la cuenta arrancó el 27/10 20:33)

**Si Martín te escribe «Continua»:** la regla del 97% (28/10) deja a cada chat con su relevo commiteado y anota dónde en
`~/.claude/relevos-cuenta/claude4.tsv` (carpeta, rama, transcript). Leé eso, este estado y el relevo de cada chat.

- **`main` = `7f36fa9c6` (28/10 23:57), EN PRODUCCIÓN y verificado.** Desde que arrancó la cuenta subieron:
  - tren-w (`c17134274`): las horas del CRM, las cajas de chat, la pausa del Cerebro, el corte del 97 %;
  - el editor, con los subtítulos de Leandro (`004a4ae57`, ticket cerrado y avisado);
  - el Web Generator en blanco (`7f63046be`);
  - MaKo inteligente: el Second Brain en el turno, sin la plata para los closers (`7f36fa9c6`).
- **La rama `tren-x` de `C:/dev/wt-push-q` = main + sólo docs** (este relevo y hallazgos). **NO entraron a main:** el
  pre-push no tuvo RAM para los tipos (3,0 GB con el workflow corriendo; «no es un error de tipos»). Copia en origin, en la
  rama `relevo-cerebro-claude4`. Entran con el próximo tren: no hace falta otro push sólo para esto.
- **TERMINÓ al cortar: `wf_2f472ad6-193`, la verificación de Zernio `254856316` y Planes `ddfa645d4`. Los DOS: NO.**
  Informe entero, con los scripts que reproducen cada caso: `C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md`.
  **SIN MANDAR a sus chats** (la cuenta cortó al 95 %): mandárselo es lo primero del punto 2.
  - **Zernio:** la privacidad quedó arreglada (ninguna puerta a otro negocio) y el orgánico y los tests, bien. Sobrevive
    una MEDIA: «Reintentar» repite el x-request-id fuera de la ventana de ~5 min y deja DOS posts públicos (los 4 min
    se cuentan desde la última anotación, no desde el primer envío; `lib/calendario-publicar.ts`). Y tres bajas: un 4xx
    en el reintento borra la duda, dos estados sin salida y la carrera G al revés. El refutador tiró la de «Deshacer».
  - **Planes:** `be95f7555` sí cierra el voucher doble. Sobreviven TRES ALTAS: una suscripción con SEPA arma una
    segunda y nunca cancela la primera (dos veces); y el plan a mano, si el negocio paga por /planes con el email de su
    cuenta, queda `ya_tenia_cuenta` sin `alta_ws`. Además dos medias (el aviso de vencimiento le llega a quien ya paga, y
    se repite si el mail a Martín da 429) y dos bajas. La venta externa de Stripe (MAU-10) viene en esta rama: no entra
    hasta que Planes pase.
  - Árboles: `C:/dev/verif-254856316` y `C:/dev/verif-ddfa645d4`; los scripts del informe corren ahí. Sacar el junction
    de node_modules con `cmd /c rmdir` antes de borrarlos. Journal: `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/wf_2f472ad6-193/journal.jsonl`.
- **LO QUE SIGUE, en este orden:**
  1. **P0, el ticket de Martín: «Replicar» no saca la foto de la página.** SIN EMPEZAR (el chat cortó al 95 %). Todo está
     en la sección 0 de `docs/relevo/web-generator-replicar.md`, en `C:/dev/wt-replica-editable` (rama
     `replica-editable-2810`, `f59354ec3`, sin subir). Va ANTES que la réplica editable (`a72620aa3`, a medias).
     **La página que probó Martín es https://100ads.ai/** (lo dijo después, 29/10 ~00:55): reproducir con esa.
  1b. **Pedido nuevo de Martín (29/10, textual):** «Los tickets de bugs asi, siempre deben traer las acciones que hizo el
     usuario». Su ticket guardó pantalla, error y hora, pero no la URL que pegó. «Reportar a Soporte» (y el ticket que
     MaKo abre solo) tiene que llevar los pasos: qué tocó, qué escribió o pegó, en qué orden. Dueño: el chat de soporte
     y tickets (MaKo en WhatsApp). Regla en la memoria `ticketera-usuarios`.
  2. **Zernio y Planes: mandarle a cada chat su parte del informe de `wf_2f472ad6-193`** (los dos NO, arriba), y
     verificar lo que devuelvan. Planes trae la venta externa de Stripe (`5a27268bc`). Desplegada esa, escribirle a Mauricio en su grupo (el +…8122 ES él) para que conecte su Stripe. Prender
     `cobros.ventas_externas` en ws1 pide el sí de Martín EN EL CHAT.
  3. **La tienda de Chrome: la 0.74.3 está EN REVISIÓN** (29/10 ~01:35, subida por el Cerebro con un Chrome aparte por
     CDP; ver docs/hallazgos-extension.md). Cuando Google apruebe: `node scripts/version-en-tienda.mjs` y mezclar
     `tienda-cws-2710`. Volver a crear la credencial de la API para que la próxima sea un comando. Ver
     docs/hallazgos-extension.md («La subida por API murió sin avisar»).
  4. **La fila de verificación** (más abajo): CRM `cc47d841d`, Copywriter `7eef753da`, WhatsApp, Automations, el plan a
     mano de Planes y las tres ramas `nube/*`.
  5. **Los pedidos nuevos** (más abajo): pagos por tramos, Classroom, Zernio con varias claves. Y los 70 perdidos de
     `docs/relevo/pedidos-perdidos-2810.md`.
- **Cómo se sube un tren:** `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=4608 MAKO_TIPOS_RAM_MIN_GB=4.8 git push origin
  HEAD:main`, en segundo plano y con `node scripts/pausa-cerebro.mjs prender|apagar`. **El deploy se confirma** con `npx
  vercel ls --scope mbustos-4239s-projects -m githubCommitSha=<sha ENTERO>` y `vercel inspect hola-mako.com`.
- **⭐ PEDIDO NUEVO DE MARTÍN, el más importante para la próxima cuenta (29/10, ~00:45, en el chat del Cerebro), textual:**
  «Y no me gusta que Leila te tenga que estar respondiendo esas cosas de plan de pagos por ahí, eso refleja lo mal
  construido que esta la tab de pagos... No tiene libertad o diversidad de tipos de cobros».
  - **Hoy:** el «plan libre» del 27/10 (`fechasDelPlan`, `lib/pagos-campo.ts`; `app/crm/lead-view/ficha/pagos/bloques-cobro.tsx`)
    hace quincena, semana, más de 6 cuotas y días del 29 al 31, pero con TODAS las cuotas del mismo monto. «6 meses de
    12.000 y luego 10.000» (Nadia, de Leila) no entra.
  - **Lo pedido:** el plan por TRAMOS (monto, frecuencia, cantidad o fin y moneda por tramo), el anticipo y las cuotas
    editables una por una. Lo arma el CLIENTE solo en la ficha del lead. Se COPIA de una app que ya lo resolvió: las fases
    de los «subscription schedules» de Stripe, o los planes de pago de ThriveCart o Kajabi. Regla en la memoria
    `pagos-libertad-de-tipos`.
  - **Dueño sugerido:** CRM y Chats (la ficha y los pagos), o un chat «Pagos» nuevo. El de Nadia NO se carga a mano: con
    la herramienta nueva lo arma Leila. Hasta entonces, su respuesta a la pregunta del 29/10 queda en el buffer.
- **Martín, 28/10: «todas mis cuentas son x20».** claude5 se suma a `CUENTAS_DEL_CREDITO` en la tanda A de WhatsApp (ya
  avisado).
- **⭐ PEDIDO NUEVO DE MARTÍN, para la próxima cuenta (29/10, ~00:10, escrito en el chat del Cerebro), textual:** «En
  "Classroom" unifica la tab de clients con members, es literal los botones de kanban o lista que tenemos en el crm».
  - **Hoy:** `/classroom` tiene las sub-tabs Clients · Community · Classroom · Calendar · Members · Leaderboards · About
    (`app/classroom/ClientsShell.tsx`, `lib/clients-rutas.ts` → `seccionesDe`).
  - **Lo pedido:** UNA sola sub-tab con el selector Kanban / Lista del CRM. Kanban es el tablero de clientes por etapa de
    entrega; Lista, los miembros. Se copia el control del CRM tal cual. La ruta vieja de la que se va se redirige con su
    query (AGENTS.md → «Retirar una RUTA…»).
  - **Dueño sugerido:** un chat «Classroom» nuevo, o CRM y Chats, que tiene el selector Kanban / Lista. No se arrancó: la
    cuenta estaba al 92%.
- **⭐ LOS PEDIDOS PERDIDOS (terminó a las 22:30): `docs/relevo/pedidos-perdidos-2810.md`.** Son 362 pedidos desde el
  22/10; 70 PERDIDOS y 21 esperan a Martín. Arriba de todo, «Lo urgente», y abajo las fuentes que nadie leyó. Se
  repartió a los chats con dueño vivo lo urgente de cliente (ver ese documento); lo demás queda en su lista, con el
  dueño sugerido.
  - 22:40, repartido:
    - **Zernio:** el aviso del corte de Meta del 03/11 (arma el texto y lo manda el Cerebro) y las campañas de Joan.
    - **MaKo en WhatsApp**, después de la tanda A: Mauricio sin mensajes desde el 04/10, los dos pedidos de Joan, el
      dominio inventado, el Fathom de Leila y los tres audios de Leandro.
    - **CRM**, después de las horas: Fabi Pedraza y las cifras de Joan.
  - **SIN repartir**, porque el tope de mensajes por turno de Martín dejaba a la reserva: los «perdidos» de Automations,
    Web Generator, Editor, Copywriter, Planes y MaKo inteligente. Están en el documento, cada uno con su dueño
    sugerido.
  - **29/10 ~00:50 ART, P0: Martín no pudo replicar una landing** («No pude sacar la foto de la página», su ticket desde
    /web-generator/68, ws9, 00:38). Lo encontré en el código y lo pasé al chat Web Generator, ANTES que la réplica editable.
    Replicar.tsx:215 recibe ok sin `foto`. En lector-script.ts hay dos caminos mudos: el tope de `arrancar()` (TOPE+500, 40 s
    con foto) que dispara `terminar(true)` antes de la instantánea, y el `catch` que deja `foto = null` y pierde el motivo.
    Hecho = foto aunque llegue el tope y el motivo en pantalla. El ticket no trae la URL: la busca el chat. Al desplegar:
    cerrar el ticket con el aviso a Martín.
  - **29/10 ~00:40 ART (03:40 UTC), ronda y tres respuestas de Martín** (cierres mandados; semana al 94 %):
    - **P2P:** el aviso del corte de Meta se lo manda Martín por su WhatsApp. El texto le quedó en el cierre. Regla en
      la memoria `contestar-clientes-sin-preguntar`.
    - **El 8122 ES Mauricio.** NO se le escribió todavía: la venta externa de Stripe (`5a27268bc`, MAU-10) no está en
      main, va con Planes (verificación `wf_2f472ad6-193`, viva a las 00:36). Cuando esté desplegada: pedirle en su grupo
      que conecte su Stripe y que su link del Sprint vuelva a la página de gracias; prender `cobros.ventas_externas` en
      ws1 pide el sí de Martín EN EL CHAT.
    - **La tienda de Chrome:** sigue en 0.39.1. La API murió (`deleted_client`) y el panel pide la contraseña de
      martinkoncke@gmail.com (la cuenta dueña; `authuser=1` en el perfil de Claude). La pestaña quedó en «Verify it's
      you». Martín no entendió la primera pregunta: se le explicó en el cierre. Cuando diga «listo»: subir el zip de
      feedback/chrome-web-store/, la descripción, las 5 capturas y el mosaico, y mandar a revisión.
    - **Ronda:** los tickets abiertos tienen dueño vivo (Leila en bloque → CRM `cc47d841d`; Leandro, el filtro de
      comentarios → Automations; el video de Leila → Video Editor; Nadia → pagos por tramos) y ninguno está resuelto
      en producción. Las tres ramas `nube/*` siguen fuera de main, en la fila. Los cinco chats de la nube «waiting»
      ya no tienen trabajo: los archiva Martín desde la barra.
  - **23:30, las respuestas de Martín** (desde el Centro; los cierres ya se mandaron):
    - **Decisiones que valen así:**
      - Zernio: NO a la cuenta de MaKo, cada negocio con la suya.
      - No se borran los datos de las visitas de Código Inmobiliario ni de P2P.
      - Stripe de Mauricio: «Pídeselo a Mauricio». Espera la respuesta sobre el 8122.
      - Los chats de la nube se archivan si no les queda nada: no aparecen en mi lista, así que los archiva él.
    - **Esperan su sí ESCRITO EN EL CHAT** (el Centro no alcanza para la base de producción):
      - la tabla nueva de MaKo sin conexión (0346) y la de publicar desde el Calendar (0342), cada una cuando su revisión
        salga limpia;
      - los dos cambios del Sprint de Mauricio;
      - la espera y el recordatorio de Brigitte.
      - Se le pidió con un renglón para copiar.
    - Martín no entendía «aplicar la migración»: regla en la memoria `migracion-en-palabras`.
    - **Avisos del corte de Meta ENVIADOS a Pablo, Sergio y Patricia.** Sin «no tienes anuncios activos», que no se pudo
      comprobar. Sólo falta P2P, que espera a Martín.
    - **Joan: le contesté sus dos pedidos** (las 9 llamadas sin marcar con nombre y las cifras corregidas, más los 10
      links de Meet de la semana pasada; 3EB0C29D3599EBBA993B12).
  - **01:40, verificaciones:**
    - **Automations `69b49a31c`: NO.** La ALTA (un DM de Instagram recibía DOS respuestas del AI Step) quedó ARREGLADA en `5e67180c7` (aut-2510; probado rompiéndolo, sin barrido nuevo). Las medias y bajas siguen, en docs/relevo/automations.md (`f8e74a9f5`), para la próxima cuenta, y sin ellas no entra. Siete medias:
      «Volver a probar» reusa las Idempotency-Key, la mudanza rechaza «social_tope», la difusión sale dos veces sin
      idempotencia, el goteo de Instagram pasa la ventana de 24 h, HojaDifusion no está montada, y un setter puede
      difundir por el grupo. Más bajas. Informe en `C:/dev/revisiones/2910-verificacion-automations-69b49a31c.md`, ya
      mandado al chat.
    - **Zernio `254856316` + Planes `ddfa645d4`: corriendo**, en `wf_2f472ad6-193` (task `w1bp45jj0`). Los árboles son
      `C:/dev/verif-254856316` y `C:/dev/verif-ddfa645d4`. Su journal está en
      `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/wf_2f472ad6-193/journal.jsonl`.
    - Queda en fila: el CRM `cc47d841d`, Copywriter `7eef753da`, las tres ramas de la nube y WhatsApp (cuando lleguen
      sus arreglos).
  - **01:25 — EN PRODUCCIÓN (verificado):** el Web Generator en blanco (`7f63046be`; deploy de `ed8c965d1` Ready a las
    23:58). Martín tiene que probarlo entrando por el menú. **MaKo inteligente** (`7f36fa9c6`, merge de `935e3c574`),
    subido a las 00:00, EN PRODUCCIÓN (deploy mako-nmbwa0pgu Ready, lo sirve el dominio). **main = `7f36fa9c6`.** La rama del próximo tren sale de ahí.
  - **01:10, el Web Generator en blanco (el P0 de Martín):** `11a0e8211` ACEPTADO (el Cerebro revisó que los controles de
    acceso corren antes del corte en los cuatro layouts) y mergeado en tren-x (`7f63046be`). Push en curso (task
    `bum9dxj9y`, log `push-blanco.log`). Cuando esté Ready, avisarle a Martín que lo pruebe entrando por el menú.
  - **01:12: VERDE de MaKo inteligente `dfbd0e922`** (b2c19c445 + cfab5c33a + dfbd0e922, mako-inteligente-2710-c4). La
    ALTA (el objetivo de facturación a un closer) se arregló con `VE_SIN_PLATA` en positivo. **Para verificarlo:** volver a
    correr `C:/dev/revisiones/scratch-b2c1/mi-refuta/r1-objetivo.ts` apuntado a `C:/dev/wt-mako-inteligente-c4`, y leer
    `sinLaPlata`.
  - **01:00: VERDE del CRM `cc47d841d`** (crm-lote-2810, sobre `23b329b5e`): las acciones en bloque del tablero, los
    tickets de Leila (eliminar → PAPELERA de 30 días, pasar a otro funnel, descalificar o perder en bloque, la columna
    entera sin el corte de 1.000) y 5 operaciones de la API.
    - **La tabla 0340 (`leads_papelera` y 5 funciones) YA ESTÁ APLICADA (29/10, el Cerebro de claude3 con el sí de Martín en
      su chat, desde crm-lote-2810 @ 77679ed63: leads sigue en 3017, RLS prendido, sólo service_role ejecuta las 5).** El cron
      nuevo (`app/api/cron/leads-papelera`, `45 10 * * *`) entra con su código en vercel.json.
    - Sin verificar. Como borra y recupera datos, se mira primero que no se pierda nada.
  - **FILA DE VERIFICACIÓN al 01:00** (Automations `69b49a31c` corriendo en `wf_a92bf13a-ec9`):
    1. Zernio `854a6fda0` + Planes `ddfa645d4`, juntos;
    2. CRM `cc47d841d`;
    3. Copywriter `7eef753da`;
    4. WhatsApp: c358 + tanda A, cuando lleguen los arreglos que faltan;
    5. MaKo inteligente, cuando lleguen sus arreglos;
    6. las tres ramas de la nube.
  - **Los sí de Martín EN EL CHAT que destraban cosas** (la base de producción): la tabla de MaKo sin conexión (0346),
    la de publicar desde el Calendar (0342), ~~la papelera del CRM (0340)~~ (APLICADA el 29/10), los dos cambios del Sprint de
    Mauricio y lo de Brigitte. Cada uno se aplica cuando su verificación sale limpia.
  - **00:55, los límites de Zernio (pedido de Martín): DISEÑADOS, sin código** (`35df0c483`, docs/relevo/zernio-capi.md).
    La «salida gratis» (conectar otra cuenta de Zernio) NO se puede decir hoy: un negocio tiene UNA clave, y pegar otra
    reemplaza la anterior y pierde las redes de la vieja. Va después de las varias claves (punto 3), y antes se revisan
    los términos de Zernio. Para el punto 1 queda el texto propuesto, sin Analytics hasta volver a medirlo. Del punto 4
    (el aviso antes de los 10.000 mensajes), falta medir de dónde sale el conteo de mensajes enviados del mes.
  - **00:50: VERDE de Zernio `854a6fda0`** (zernio-2510; encima, `254856316`: la salida gratis que existe HOY en el aviso de la 3.ª red, «desconecta en zernio.com una que ya no uses»), con los arreglos de su verificación: la cuenta validada contra
    las del negocio, las publicaciones «dudosas» en vez de «fallo», la huella de la clave, las escrituras condicionadas, la
    REST en verde y el orgánico en la zona del negocio. ⚠️ **Lleva adentro diez commits de planes-2710** (hasta
    `d15b4ec1d`, merge `042e10323`), así que **Zernio y Planes (`ddfa645d4`) se verifican y entran JUNTOS**. El rojo
    de «Mirá» en `lib/cobros-webhook.ts` lo corrige `a196d5a93`, de Planes. Además, la tabla nueva 0342 (con
    `publicacion_intento`, `publicacion_clave` y el estado «dudosa») espera el sí de Martín en el chat.
  - **00:40, WhatsApp:**
    - **La tanda A tiene su VERDE (`9b5fc9ad4`, wa-credito-grupos-2810).** Trae el crédito de Claude de los grupos para N
      cuentas (una lista única: `CUENTAS_DEL_CREDITO`) y la corrección del dominio inventado (`conElDominioDeMaKo`). Lleva
      adentro c358fd0c4, así que entra JUNTO con sus arreglos, y se verifica todo junto.
    - De c358 ya están arreglados: el aviso de arreglo (`c6d63791a`), el acuse después de la cita (`78543b7dd`) y la lectura
      estricta (`450677f90`). Faltan la ALTA de `pideAlgoAMaKo`, la MEDIA del cierre de la ventana y la BAJA de la firma.
    - **Decidido por el Cerebro:** el banco de nivel 2 con modelo (gasta crédito) queda para la próxima cuenta, chico.
    - claude5 ya está en `CUENTAS_DEL_CREDITO` (`646eae966`; Martín: «todas mis cuentas son x20»). **Al desplegarse, Martín pega `ANTHROPIC_CREDITO_CUENTA5` en SuperAdmin › Uso › API** (se puede vincular desde el 31/10). La ALTA de `pideAlgoAMaKo` queda para la próxima cuenta (es diseño).
  - **00:35, ronda: el plan de Nadia de Leila.** Leila YA había contestado en su grupo el 28/10 a las 18:11 UTC (buffer
    324): «Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000». Le llegó a MaKo, no al equipo: la falla
    que arregla WhatsApp. Se le pidió confirmar si los 12.000 son por mes (6.000 por quincena, días 1 y 15) y hasta cuándo
    sigue el de 10.000 (3EB015B3DB5E089D9A764E). **Su respuesta se lee en `mako_doer_buffer` del ws11**, porque también le
    va a llegar a MaKo. Después, CRM y Chats carga el plan, con el sí de Martín en el chat (escritura en producción, ws11).
  - **00:30 (29/10): tren-w EN PRODUCCIÓN.** Lo subí yo (`c17134274`); alguien más subió encima tres commits de docs
    del relevo, hasta `b59d14943`, que es el deploy que sirve el dominio (Ready a las 23:19). **tren-x** (el editor,
    ticket 23: `004a4ae57`) **subido**, en PRODUCCIÓN (Ready a las 23:33). **Ticket de Leandro (subtítulos) CERRADO** y aviso mandado
    a su grupo (3EB0050E870B3AA0C5E540).
    - **La verificación de Automations `69b49a31c` está corriendo:** `wf_a92bf13a-ec9` (task `w48pws0wo`), con tres
      verificadores (Instagram de Leandro, topes y avisos, difusión) y el árbol `C:/dev/verif-69b49a31c`.
    - **Fila de verificación detrás:** Copywriter `7eef753da` (la puerta pública que escribe, primero) y Planes
      `ddfa645d4` (el plan a mano). Después, los arreglos de WhatsApp y de MaKo inteligente cuando lleguen.
  - **00:05 (29/10), el push de tren-w está EN CURSO** (task `bca7muwun`, log en el scratchpad: `push-tren-w.log`), con
    la pausa prendida. Sube: las cajas de chat, las horas del CRM (`f13f8bbad`, verificado por el Cerebro con el script del
    refutador y mergeado en `c17134274`), el corte del 97%, la pausa, tsc-acotado con lock y `cambiarSettingSi`.
    - **Para el tren siguiente:** el editor, ticket 23 (`d867f8bbc`, editor-leila-2810): leí el diff y está aceptado.
      Falta mergearlo y correr tests/video-editor-chat sobre el árbol mezclado. Al desplegarse, se cierra el ticket de
      Leandro con su aviso.
    - **Planes:** el cobro doble está arreglado en `be95f7555` (verificado con el script del refutador: una cuota y
      ya_pagado). Pero la rama trae el plan a mano con vencimiento (`55542d446`) SIN verificar: necesita su workflow, y
      queda para cuando haya RAM o para la próxima cuenta.
    - **Motion:** no arranca (cuenta al 91%). Los dos rojos del typecheck C/D están en el relevo del editor. La trampa del
      CRLF está cosechada (`76e261c3e`). El chat del editor cerró por hoy.
    - **VERDEs SIN verificar, en este orden** (cada uno necesita su workflow de verificador y refutador):
      1. Automations `69b49a31c` (aut-2510);
      2. Copywriter `7eef753da` (copywriter-2810, 11 commits y 75 .ts). Trae una puerta PÚBLICA que escribe
         (`/api/compartido/guion` en PUBLICOS_ESCRITURA), así que la seguridad va primero;
      3. el plan a mano de Planes `55542d446` (con `be95f7555`, ya comprobado).
      Después, los arreglos de WhatsApp y de MaKo inteligente cuando lleguen, y las tres ramas de la nube.
  - **23:45, Zernio:**
    - **Pedido de Martín:** advertir los límites en la conexión, y varias claves de Zernio por negocio, como en Gemini,
      para conectar más redes sin pagar. Va con el aviso antes de la 3.ª red. Pasado al chat Zernio: los límites y el
      aviso ahora; las varias claves, diseñadas para la próxima cuenta.
    - **Límites, de zernio.com/pricing (leído a las 23:40):** 2 cuentas gratis (página, Instagram y anuncios cuentan una
      cada una); de la 3.ª a la 10.ª, US$6 por mes; 10.000 mensajes ENVIADOS gratis por mes, y sin tarjeta los envíos se
      frenan hasta el mes siguiente (con tarjeta, US$1 cada 10.000); comentarios gratis, sin contar como mensaje; 500
      anuncios gestionados gratis; Analytics «incluido» según la página, aunque medimos un 402. Los términos de Zernio dan
      404: no se sabe si permiten varias cuentas gratis.
    - **Leandro: le contesté su audio de los límites** (3EB0FEEE89B0FEC6BCD81E): «el aviso antes del tope lo estamos
      armando». Lo arma Zernio con Automations.
    - **Planes `e6fd6d88d`: NO.** Alta: un segundo voucher (OXXO o SEPA) deja armar otra sesión y se cobra dos veces.
      Informe en `C:/dev/revisiones/2810-verificacion-planes-e6fd6d88d.md`, ya mandado.
  - **23:30, verificaciones:**
    - **WhatsApp `c358fd0c4`: NO.** Dos altas: `pideAlgoAMaKo` calla los pedidos reales, y el aviso de arreglo de un
      ticket abre la ventana para todos. Dos medias: el «dale» como acuse y la ventana que se cierra con el primer
      mensaje. Informe en `C:/dev/revisiones/2810-verificacion-wa-c358fd0c4.md`, ya mandado.
    - **MaKo inteligente `b2c19c445`: NO.** Alta: un closer recibe el objetivo de facturación por el nodo `objetivo`.
      Informe en `…-mi-b2c19c445.md`, ya mandado; arregla encima de `cfab5c33a`.
    - **VERDE de Automations `69b49a31c`** (aut-2510, todo desde 7f7e404d9): SIN verificar todavía (RAM y cuota). Después
      del deploy, con el «dale» del Cerebro: la config del 680, «Volver a probar» en los leads 5425 y 5426, y la fila del
      ws 9 de social_tope.
    - Planes `e6fd6d88d`: verificación en curso (`wf_4ecaf858-5ac`).
  - **Audios de Leandro, transcriptos:** el 316 y el 318 son la respuesta pública a comentarios (ya en el VERDE de
    Automations). El 327 es NUEVO: los límites de Instagram y Zernio, y que MaKo le avise antes de quedarse sin, «lo que
    menos me gustaría… que se pare la automatización… y que Maco no me avise nada». **SIN REPARTIR:** es de Automations
    (tiene el tope) y de Zernio.
  - **22:55, Mauricio sin mensajes:** WhatsApp midió que la entrada NO está rota. En su grupo no escribe nadie desde el
    08/10, y MaKo le manda ~15 mensajes por día. Los tres participantes son el personal de Martín, MaKo y un +…8122 (la
    línea `mako_ws1`). Le pregunté a Martín si el 8122 es Mauricio: si no lo es, Mauricio no recibe nada. Cosecha en
    `0d61fcbe2` (wa-credito-grupos-2810). La tanda A está en `bea18e257`, esperando su barrido.
  - **22:50, el corte de Meta del 03/11:**
    - Zernio armó los cinco avisos, que están en `C:/dev/revisiones/2810-avisos-token-0311.md`.
    - **Joan: ENVIADO** a su grupo (3EB08A864B795B4A50C001).
    - **Pablo (ws18), Sergio (ws20) y Patricia (ws22) esperan** la respuesta de Martín a «¿prendo la cuenta de Zernio de
      MaKo?»: si la prende, no se les pide una clave propia.
    - A Sergio hay que sacarle «no tienes anuncios activos» o medirlo.
    - **P2P (ws14) no tiene grupo:** le pregunté a Martín por dónde le llega.
    - Florencia (ws21) nunca conectó Meta: por eso Joan no ve sus campañas.
  - **Tres aprobaciones más a Martín** (`cartero preguntar`): los dos cambios del Sprint de Mauricio, la espera y el
    recordatorio de Brigitte, y borrar nombre y email en ~670 visitas de Código Inmobiliario y P2P.
- **Dos workflows corrían al escribir esto.** Otra cuenta no los reanuda, pero puede leer lo que devolvieron en
  `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/<runId>/journal.jsonl`:
  - `wf_fbaed0b3-099`, **los pedidos perdidos.** Martín: «Revisa todos los pedidos de absolutamente todos lados, a ver si
    no se perdieron otras cosas», y «No frenes la investigación... me sirve para la próxima cuenta». Lo que devuelva se
    reparte a los chats y se le reporta a él.
  - `wf_750ef430-595`, **la verificación de Zernio y de las horas del CRM: TERMINÓ, las dos con defectos.** No entran al
    tren. Informes: `C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md` y `…-crm-horas-b799f7ed4.md`.
    - Zernio: programaba en el Instagram de OTRO negocio, entre otros. Ya se los mandé.
    - CRM (`crm-horas-2810`, chat CRM y Chats): ALTA. En el chat de la app, `listar_horarios_reunion` convierte el `startIso` y
      `proponer_agendar_reunion` no lo encuentra: la reserva falla siempre. Más dos bajas: claves `_utc` con hora local, y
      el «inicio» de un evento de comunidad al lado de otra zona. **SIN MANDAR al chat** (tope de 10 mensajes): va en cuanto
      Martín escriba.
- **VERDEs que faltan verificar** (cada uno con verificador + refutador; informes en `C:/dev/revisiones/`):
  - **MaKo en WhatsApp, urgente.** Cuatro altas:
    - un «?» dentro de un link cuenta como pregunta;
    - la ventana de 6 h silencia todo;
    - no lee el mensaje citado que viene en `contextInfo`;
    - ante un audio citado que falta, pide «conectá tu OpenAI».
  - **Replicar landings: P0, el Web Generator en blanco** (cuenta de super admin, desde cualquier dispositivo). Después,
    que la réplica sea editable entera. Las cinco copias de prueba (#68–#72, ws9) van a la papelera cuando cierre el P0.
  - **MaKo sin conexión.** T1 arreglada: `desktop-offline-2810` = `6ef621b24` + `813101f75`. T2:
    `desktop-offline-t2-2810` = `3e6a0dddf` + `746633c96`. La migración 0346 necesita el sí de Martín.
  - **Planes, medias:**
    - el reintento de OXXO;
    - el trial del día 8 que falla y queda detrás del tope de 50.
  - **Automations:**
    - ALTA `ef1c248b4`;
    - ticket 19 `e90bae7d1`;
    - topes `c6f78deb4` y `0c121ab4b`;
    - la difusión desde el CRM que pidió Leila;
    - las medias.
  - **Copywriter**, y **MaKo inteligente** `809887ac9`.
  - **Tres ramas de la nube:** clic derecho `419d11e90`, media buyer `54e13e9cc`, video generator `9012f6070`.
  - **Editor, ticket 23 (subtítulos de Leandro).** El OK al arreglo está dado: `generarSubtitulos` devuelve
    `{ok|motivo}` y el chat dice la causa real. Desplegado eso, se cierra el ticket con el aviso a Leandro.
  - **CRM: acciones en lote y papelera** (tickets 21 y 22 de Leila). Necesita una migración; el SQL va a Martín.
- **Después de subir tren-w:**
  - el aviso a Leila (la confirmación del plan de Nadia, que está retenida);
  - el aviso a Leandro (las keywords);
  - la config del 680, aplicada con el «dale» de Automations;
  - la prueba de Instagram en Fiesta Music, coordinada con Leandro después del deploy de Zernio;
  - la migración 0342, con el sí de Martín.
- **Hecho hoy en producción, fuera del tren:**
  - contestado el audio citado de Leandro;
  - corregido el lead «ganado» que tenía la tarjeta en Perdido (la verdad era Perdido);
  - 13 réplicas malas, a la papelera;
  - Leila avisada de que puede usar el editor en vez de CapCut.
- **La app se cayó a las 18:34 con todos los chats adentro:** tres tsc a la vez. Desde entonces lo pesado de los chats
  pasa por `node C:/dev/con-turno.mjs …`, con dos filas: tipos y tests, una a la vez cada una. Sin turno en 30 min, no
  corre (sale con 99).
- **Chats vivos (claude4, bypass)**, cada uno con su relevo en su carpeta:

  | Chat | Sesión |
  |---|---|
  | Web Generator: replicar landings | `local_1dd40ee7` |
  | MaKo en WhatsApp | `local_216acd59` |
  | MaKo inteligente | `local_4f7b9970` |
  | Planes, pagos y Partners | `local_46497093` |
  | CRM y Chats | `local_61bd6f00` |
  | Zernio | `local_b48d54c4` |
  | Video Editor de Leila | `local_c698e704` |
  | Copywriter | `local_ce7663bd` |
  | Automations | `local_ea2a6e6a` |

- **Cuota a las 20:42 ART:** 5 h al 87% (se renueva 21:30 ART), semanal al 80% (se renueva el 3/11 17:00 ART).
- **21:15 ART: el corte del 97% saltó en el Cerebro (ventana de 5 h), el primero real después de prenderlo.** Negó un
  Bash y anotó la sesión en `~/.claude/relevos-cuenta/claude4.tsv`: anda. Lo que quedó a medias en ese momento:
  - **21:33, HECHO: la fila de tests de `C:/dev/con-turno.mjs` tiene DOS lugares** (`mako-tests.lock` y
    `mako-tests-2.lock`) y espera hasta 90 min; la de tipos sigue de a uno con 30 min. Era cola, no un cuelgue: siete
    chats para un lugar, y el que esperaba 30 min salía con 99. Probado con tres trabajos (dos a la vez, el tercero espera)
    y dos de tipos (de a uno). Respaldo: `C:/dev/con-turno.mjs.antes-2-lugares`.
  - **21:35, después de la renovación:** los nueve chats recibieron «seguí desde tu relevo» con lo suyo. El CRM recibió
    los defectos de las horas y Automations la explicación de la cola.
  - **21:45: VERDEs de WhatsApp `c358fd0c4`** (wa-fallas-2710; van también `c1b3d3a2a` y el merge `c465a407b`; relevo
    `a949fef12`) **y de MaKo inteligente `b2c19c445`** (mako-inteligente-2710-c4, sobre `c659dc0f4`, ya en main).
    Verificación en curso: `wf_930af84b-003` (task `wfduhtfbm`). Los árboles de sólo lectura son
    `C:/dev/verif-c358fd0c4` y `C:/dev/verif-b2c19c445`; antes de borrarlos, sacar el junction con `cmd /c rmdir`. Si sale
    limpio, va a tren-w; WhatsApp es lo urgente.
  - **Ronda de las 21:46:**
    - Los chats locales quietos esperan sus tests (dos lugares). WhatsApp sigue con la tanda A (el crédito Max para
      los grupos).
    - Los nueve tickets abiertos tienen dueño vivo y ninguno está resuelto en producción.
    - Cuatro chats de la nube (Planes, Automations, Landings y Motion) esperan desde AYER una aprobación que sólo
      Martín puede dar en la nube.
    - Sus tres ramas siguen fuera de main: `nube/clic-derecho-2710` (`419d11e90`, el clic derecho en siete listas),
      `nube/media-buyer-2710` (`54e13e9cc`) y `nube/video-generator-2710` (`9012f6070`, el estudio copiado de Arcads).
      Están sobre un main viejo: se verifican DESPUÉS de WhatsApp y MaKo inteligente, para el tren siguiente.
  - **21:52: cinco aprobaciones a Martín por el bloque de preguntas** (`cartero preguntar`; los archivos están en el
    scratchpad, en `aprobaciones/`). Las respuestas llegan como mensajes a este chat:
    1. la migración 0346 de MaKo sin conexión, cuando su revisión salga limpia;
    2. la migración 0342 de publicar desde el Calendar, cuando Zernio pase su revisión;
    3. prender la cuenta de Zernio de MaKo (la recomendada es NO: cada negocio con la suya);
    4. las ventas externas de Stripe en la cuenta de Mauricio (la clave la pega él);
    5. archivar los cuatro chats de la nube (Planes, Automations, Landings y Motion). Su trabajo pasó a la PC el 28/10:
       NO necesitan su aprobación, y en la ronda de las 21:46 se le dijo mal que sí.
  - **22:25: VERDE de MaKo inteligente `cfab5c33a`**, encima de `b2c19c445`: las funciones de MaKo entran al turno sólo si
    la pregunta es de producto (`esPreguntaDeProducto` + `sinFunciones`; «¿cuál es mi meta?» ya no trae Ads Manager). Se
    verifica el delta `b2c19c445..cfab5c33a` cuando vuelva la verificación de b2c19c445.
  - **22:15: VERDE de Planes `e6fd6d88d`** (planes-2710, sobre `a196d5a93`): arregla la verificación de a196d5a93 (el
    diferido fallido, las pruebas detrás del tope, el seguro de 500 con reloj, la unidad mínima, el código libre de
    Partners y la compra doble a Meta). La guardia de RAM no la dejó lanzar a las 22:15 (2,1 GB libres); **lanzada a las 22:27**: `wf_4ecaf858-5ac` (task `wvdwkngpi`).
    El script está en `workflows/scripts/verificar-planes-e6fd6d88d.js` de esta sesión, y el árbol en
    `C:/dev/verif-e6fd6d88d`. Se lanza apenas termine otro workflow.
  - **22:20, Planes y lo de Teo:** hechos los dos chicos (`0fa4bbe0d`: /planes ya no le promete AI Avatar a Pro, y en
    Partners dice «Ganar el primer mes…»), y corriendo sus tests-afectados para que vayan con `e6fd6d88d`.
    - **Decidido por el Cerebro:** un plan a mano que vence NO pausa al negocio mientras el corte general siga apagado
      (`CORTE_DE_ACCESO_PRENDIDO = false`, decisión de Martín). Avisa a Martín y a la persona. Lo hace Planes.
    - **Para la PRÓXIMA cuenta:** la comunidad cobrada por mes. Toca Classroom y `app/crm/curso-al-ganar-actions.ts`, y
      son varias horas. Lo medido está en `docs/relevo/planes-pagos-partners.md` (rama planes-2710).
  - **El workflow de pedidos perdidos llegó al 100% con 12 de sus 21 agentes cortados** («session limit»). Se reanudó a
    las 21:32 en esta sesión (task `wz8f0619h`, mismo runId `wf_fbaed0b3-099`): los 9 que terminaron vienen de la caché.
    Su resultado parcial (lo juntado por fuente y lo que no se pudo leer) está en
    `C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\6ea62e88-206b-49e4-b5fe-e446feb70ded\tasks\wu4kb7spy.output`
    y en su journal.
  - **Los VERDEs en camino**, todos esperando turno de tests:
    - MaKo inteligente `b2c19c445`: 65 tests, roturas y tipos ok;
    - Planes `1e6bd27e8`: tipos ok;
    - Automations, la difusión: tipos ok;
    - WhatsApp;
    - Copywriter, con su relevo en `fe73b1ac7`;
    - el editor, con el ticket 23.
  - Zernio puso su relevo en `8b3af7652` (`zernio-2510`). Replicar espera su turno para medir el blanco.

## Lo que NO se vuelve a discutir

- **Nunca `--no-verify`.** El 24/10 el hook de pre-push frenó un tren con 5 errores de tipos.
- **Un chequeo que decide si se sube NO se pipea:** `cmd > salida 2>&1; rc=$?; tail -6 salida; [ "$rc" -eq 0 ] && git push`.
- **Vercel SÍ guarda el commit, pero lo encuentra sólo con el sha ENTERO** (`git rev-parse <corto>`); con el corto contesta
  «No deployments found» sobre un despliegue vivo. El relevo anterior decía lo contrario y estaba mal (medido el 24/10 a
  las 21:00; `docs/hallazgos-infra.md`). La prueba de producción es el despliegue que SIRVE el dominio
  (`vercel inspect hola-mako.com`).
- **El tren se arma ANTES de pushear,** y dos pushes a `main` en paralelo se traban en el candado del typecheck: de a uno.
- **Una rama entregada al tren NO se rebasa.** Para poner commits a salvo, una etiqueta `refs/tags/respaldo/<nombre>`,
  no una rama (las ramas en origin disparan builds de preview).
- **Nunca `AskUserQuestion`:** traba el turno y Martín no puede contestar desde el teléfono. Se pregunta con
  `cartero preguntar <archivo.json>` y se termina el turno.
- **El `tsc` entero no entra en la PC:** cae al respaldo de 3 tandas (`scripts/tipos-respaldo-push.mjs`, ~6 min).
- **Un pedido viejo de diseño no se hace por antigüedad:** se busca en `docs/hallazgos-<área>.md` y se compara con lo
  que Martín pidió después.
- **Un lector que mira un worktree a mitad del checkout ve el índice VACÍO** (18.900 «borrados»): se vuelve a medir antes
  de alarmar a nadie.

## Trabado esperando a Martín

- **Del 29/10:** archivar desde la barra los cinco chats de la nube: la herramienta
   de archivar no los encuentra, ni por nombre ni por id. **P2P es un cliente FANTASMA** (Martín, 29/10): no se le manda
   nada.
0. **Del 28/10:** quién paga la cuenta de Zernio de la plataforma; las migraciones 0342 (Calendar) y 0346 (sin conexión) (la 0340 de la papelera del CRM: APLICADA el 29/10); las decisiones de la revisión de Teo.
1. **Su sí EN ESTE CHAT para:** leer la Ticketera de producción (el clasificador la niega); activar los avisos al grupo
   (lead de formulario y agenda) en ws15, ws18, ws20 y ws22 de Joan; subir los 21 audios de Makito a un bucket.
2. **Decisiones de plata:** cuánto se le cobra a Joan (2 de 5 clientes pagan), el precio del Acelerador (en la llamada
   con Aaron habló de 2.000 en 4 cuotas con un año de Pro; lo vigente es 1.500 en 3) y un segundo nivel de Partners.
3. **Compras suyas:** el certificado de Windows (SSL.com IV con eSigner) y el Apple Developer ID; sin eso Chrome sigue
   marcando el instalador como malware.
4. **Las landings:** no se publica ninguna hasta que diga los cambios.
5. **Las lecturas de producción** de la versión de la extensión de Leandro (chat CRM) y las de MaKo inteligente, MaKo en
   WhatsApp y Grabadores.
6. **La RAM a 32 GB** (memoria `pc-de-martin-hardware`), o minutos de Actions.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
