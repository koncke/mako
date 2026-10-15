# Hallazgos — Centro de Operaciones

El Centro (`/admin/operaciones`, `scripts/operaciones/cartero.mjs`) deja pedidos firmados para los chats
de Claude Code de la PC de Martín. El diseño, con lo que no puede hacer, en
[diseno-centro-de-operaciones.md](diseno-centro-de-operaciones.md). Acá va lo que costó y no se deduce
del código.

---

## Un script no le puede escribir a una sesión; un chat sí, menos a sí mismo (15/10/2026)

No hay una vía documentada para que un proceso le mande un mensaje a una sesión de Claude Code. Cada
sesión se anota en `<config dir>/sessions/<pid>.json` con un named pipe (`messagingSocketPath`,
`peerProtocol: 1`) y un `.key` que lo autentica: es el protocolo INTERNO de la versión 2.1.295, y
apoyarse en él rompe con cualquier actualización de la app (que se actualiza sola). Lo que entrega es
un CHAT que llama a `SendMessage` con la dirección `uds:<messagingSocketPath>`: es inequívoca, porque los
nombres se repiten entre cuentas y dentro de una.

⚠️ **Y `SendMessage` no deja que un chat se escriba a sí mismo** («is this session itself»). Medido en la
primera prueba de punta a punta: el pedido iba al mismo chat que hacía de Cartero. Por eso el cartero no
ofrece como destino un chat que se llame «Cartero…» (`esElCartero`), y el pedido de esa prueba quedó «No
se pudo» con su motivo, que es el camino del error funcionando.

**Vive en:** `scripts/operaciones/cartero.mjs` · *chat «Centro de Operaciones», 15/10/2026*

## «Un pedido se entrega una vez» necesita DOS candados

El compare-and-set en la base (`update … where estado = 'escrito'`) evita que dos carteros o un
reintento se lleven el mismo pedido. Pero el que decide el estado es el servidor, y un servidor
comprometido puede volver a poner un pedido viejo en `escrito`: con la firma intacta, se entregaría de
nuevo. El segundo candado vive en la PC: `entregados.json` guarda los ids que salieron, y el cartero
rechaza un id que vuelve («Ya se había entregado: no sale dos veces»). El test corre el cartero real
contra un servidor HTTP falso que miente.

Lo mismo con el texto: **el servidor no arma ni reconstruye el texto firmado**. Lo guarda como llegó y
lo devuelve como está; el cartero verifica la firma sobre ese string y entrega lo que dice. Así no hay
dos implementaciones de una «canonicalización» que tengan que coincidir. Lo que sí está duplicado es
el VALIDADOR del pedido (TS en `lib/operaciones-reglas.ts`, JS en el cartero, que corre sin
dependencias), y lo ata un test diferencial sobre una batería de 17 textos.

**Vive en:** `lib/operaciones.ts` (`cicloCartero`) · `scripts/operaciones/cartero.mjs` (`ciclo`,
`leerFirmable`) · `tests/operaciones.test.ts`

## WebCrypto firma en r||s; Node verifica en DER si no se le dice

`crypto.subtle.sign` con ECDSA P-256 devuelve la firma en el formato IEEE P1363 (`r||s`, 64 bytes).
`crypto.verify` de Node espera DER por defecto, y con una firma P1363 **contesta `false` sin error**: se
lee como «la firma no es válida» sobre una firma perfecta. Va `dsaEncoding: 'ieee-p1363'` en los dos
lados de Node (el servidor, que sólo chequea coherencia, y el cartero, que decide). El test firma con
Node en ese mismo formato para imitar al navegador.

**Vive en:** `lib/operaciones.ts` (`firmaCoincide`) · `scripts/operaciones/cartero.mjs` (`quienFirmo`)

## Cada chat pesa lo mismo en la app que en la terminal

Medido el 15/10 sobre los 17 chats vivos: cada uno es un proceso de Claude Code (`claude.exe`), con
**~520 MB de memoria comprometida** (mediana; de 466 a 778) y entre 86 y 338 MB residentes. Con esos 17
quedaban 4,3 GB libres de 15,7. Una sesión de terminal es el mismo proceso, así que **lo que pesa es la
cantidad de chats, no la cuenta en la que corren**: repartirlos entre tres cuentas reparte la cuota, no
agrega RAM.

## Tres cuentas a la vez: lo que no estaba armado (15/10/2026)

Martín decidió que las tres cuentas corran juntas, la de la app y dos en terminal. Medido ese día:

- **Cada directorio de configuración tiene su propio registro de sesiones.** Un chat de la app no ve
  las sesiones de terminal de otra cuenta, y no está medido si `SendMessage` puede cruzar de un
  directorio a otro. Por eso hay **un cartero por cuenta**, que entrega adentro de la suya.
- **`~/.claude-martin` (cuenta 2) nunca se logueó por terminal** y sus `settings.json` tienen `hooks: {}`:
  una sesión ahí corre sin bitácora, sin guardia de RAM, sin relevo tras caída y sin avisos de cuota.
- **El marcador de cuenta es UNO** (`~/.claude/cuenta-activa.txt`, ruta fija en `bitacora-sesion.sh`):
  con tres en paralelo, dos firmarían con la cuenta equivocada. Una sesión de terminal sabe su cuenta
  por `CLAUDE_CONFIG_DIR`; la app, por su carpeta ([dos-cuentas.md](dos-cuentas.md)).
- **`get_usage` es una herramienta de la APP**: en la terminal no existe, así que la cuota de las
  cuentas de terminal no se mide como hoy (etapa 2).

## La prueba de punta a punta: lo que pasa al levantarla

- **`next dev` desde un worktree con el `node_modules` enlazado** se levanta desde un worktree DENTRO
  del clon (`.claude/worktrees/<id>`) con `turbopack.root` apuntando al clon, sólo para esa prueba
  (AGENTS.md). Al desarmarlo, `.next/dev/node_modules/` tenía dos enlaces más (`postcss-…`, `sharp-…`)
  que se sacaron con `rmdir` antes del `worktree remove`.
- **El vigía de RAM lo mató a mitad** (3,7 GB privados con 683 MB libres): es la guardia haciendo su
  trabajo. Lo que ya había pasado quedó en la base, y ahí se verificó: el pedido al chat «Estrategia 3
  cuentas» en `entregado`. La pantalla con «Entregado» no llegó a capturarse; se mira en producción.
- **`getByRole('button', { name: 'Copiar' })` de Playwright también encuentra «Copiar clave»**: el
  nombre matchea por substring. Con `exact: true`. Y como el token se muestra una sola vez, el primero
  se perdió y hubo que acuñar otro.
- **La sesión de prueba se firmó a mano** con el `AUTH_SECRET` del `.env.local`, por 30 minutos y sin
  salir de la PC: la de `/api/auth/dev-login` es `sub: 'dev'`, y el Centro la rechaza a propósito.

## La primera pantalla se rechazó por diseñada de memoria; la segunda copia GitHub Actions (15/10/2026)

**Síntoma.** Martín vio `/admin/operaciones` y la rechazó («horrible»). Lo que se veía: un cartel ámbar a
lo ancho de la página, un desplegable muerto («Ningún cartero subió chats todavía»), «Sólo esto» en azul
lleno al lado de «Y de ahora en más» en texto, un «Firmar y mandar» dorado, gigante y apagado, y tres
secciones apiladas del mismo peso con un hueco en el medio.

**Causa.** No era un detalle de estilo: la pantalla se dibujó sin abrir ninguna referencia. De ahí salió
la regla de AGENTS.md «NINGUNA pantalla se diseña de cero: se COPIA de una app que ya resolvió eso».

**Lo que se copió, y de dónde.** La pestaña Actions de github.com/vercel/next.js (la lista, un workflow
y una corrida, abiertas el 15/10 con Chrome sin sesión) y, para el panel de «Run workflow» —que sólo se
ve con sesión—, la guía oficial «Manually running a workflow». El mapa:

| GitHub Actions | Centro |
|---|---|
| «All workflows» + la lista de workflows a la izquierda | «Todos los pedidos» + los chats, agrupados por cuenta |
| Caches / Deployments, abajo de la columna | Carteros (con la clave del dispositivo y el token) |
| Caja «N workflow runs» con filtros Event · Status · Branch · Actor | Caja «N pedidos» con filtros Cuenta · Estado |
| Fila: ícono de estado, título, «workflow #N: …», rama, fecha y duración, «…» | Fila: ícono de estado, texto del pedido, «chat #N: firmado por Martín», alcance, fecha y «llegó en», «…» |
| Franja «This workflow has a workflow_dispatch trigger» + «Run workflow ▾» | Franja del chat («Lo entrega el cartero de la cuenta 3») + «Nuevo pedido ▾» |
| El panel: «Use workflow from Branch», los inputs, «Run workflow» | El panel: «Alcance: Sólo esto», el pedido, «Firmar y mandar» |
| La corrida: volver, título #N, Triggered · Status · Duration, el grafo de jobs | El pedido: volver, título #N, Firmado · Estado · Tardó · Destino, el recorrido Firmado → Tomado → Entregado → Hecho |

Dos decisiones que salen de copiar y no de gusto: «Nuevo pedido» sólo aparece con un chat elegido (en
GitHub, «Run workflow» sólo está en un workflow), y por eso no hay desplegable de chats que pueda quedar
muerto; y lo que falta (un cartero sin señal, un chat cerrado) se dice en la franja de ese chat, no en
un cartel de página.

**La propuesta, viva:** `docs/prototipos/centro-operaciones.html` (también publicada como página para que
Martín la valide). Computadora y celular, con tokens de la casa.

**Vive en:** `app/admin/operaciones/CentroOperaciones.tsx` (lo que se reemplaza) ·
`docs/prototipos/centro-operaciones.html` (lo propuesto)

## La Ticketera no avisaba: `chat` es un NOMBRE, no una sesión (15/10/2026)

**Síntoma.** Martín: «Y ya respondí todas esas tarjetas y al parecer no te llegó... No sirve de nada la
ticketera si no te llega». Medido a las 05:50 contra producción: **30 tarjetas abiertas, 30 contestadas,
29 sin `recogida_at`**, y `operaciones_carteros` **vacía**. El coordinador las repartió a mano a nueve chats.

**Causa.** La respuesta quedaba en la base y nadie la empujaba: el chat que preguntó tenía que correr
`decisiones.ts contestadas` por las dudas. Y aunque algo la empujara, **no había a quién**: la tarjeta
guarda `chat`, un nombre para la pantalla («2FA», «Pricing · Strategy», «Plan») que en varios casos no es
el título de ningún chat, y dos chats pueden llamarse igual («Customer Success» y «Ads Manager» aparecían
dos veces en la lista de sesiones). El diagnóstico obvio («falta un cron que mire») era la mitad: el bug
de fondo era que la tarjeta no sabía quién preguntó.

**Lo que quedó.** Lo empuja el cartero que ya existía, en su misma vuelta (sin máquina nueva):

- `admin_decisiones.destino` (mig 0288) guarda la sesión que pregunta, y la pone quien publica. Sin
  destino, el servidor busca UN chat con ese título entre los de todos los carteros; con cero o con dos,
  no adivina (`destinoDeDecision`, lib/decisiones-aviso.ts).
- Se avisa una vez por RESPUESTA: `aviso_de` es el `respondida_at` avisado. Si Martín la cambia, se avisa
  de nuevo. Lo que no llegó (o no se sabe) se reintenta hasta 5 veces, y un reclamo sin acuse vence a las 2 h.
- El reclamo es compare-and-set sobre la respuesta y el intento anterior, y el acuse viaja con el mismo
  formato de id que el de un pedido. Si el chat está cerrado, la tarjeta espera a la vuelta en que se abra.
- El mensaje lo arma el cartero con un texto fijo y el `ref` validado (`mensajeAviso`): no viaja texto de
  la base, así que no necesita firma. Que el aviso lleve la respuesta adentro necesita firmarla al
  contestar (fase 2).
- `decisiones.ts contestadas <ref>` dice en qué anda el aviso de cada una («avisada», «espera a que se
  abra el chat», «sin cartero corriendo», «Hay 2 chats que se llaman…»).

**Probado contra producción** (05:58-06:07, con el cartero real y las sesiones reales de esta PC; el
servidor fue `cicloCartero` corriendo local, con un token temporal): una tarjeta de prueba dirigida al
coordinador se reclamó, se le entregó por SendMessage, el acuse la dejó `entregado` y la vuelta siguiente
no la repitió; con la respuesta cambiada se volvió a reclamar. La tarjeta, la fila del cartero y el token se
borraron después: antes no existían.

**Dos trampas del arnés que no son del código:** `execFileSync` del cartero desde el mismo proceso que hace
de servidor se traba hasta el timeout (el servidor no puede contestar), y los paquetes de un script del
scratchpad no se resuelven (no hay `node_modules`): va `createRequire` apuntando al repo.

**Vive en:** `lib/decisiones-aviso.ts` · `lib/operaciones.ts` (`avisosParaElCartero`) ·
`scripts/operaciones/cartero.mjs` (`mensajeAviso`) · `scripts/decisiones.ts` ·
`supabase/migrations/0288_decisiones_aviso.sql` · `tests/decisiones-aviso.test.ts`

## «No veo el botón del Centro en mobile»: faltaba la pantalla, no la puerta (15/10/2026)

**Síntoma.** Martín no encontraba el Centro en el teléfono. El primer diagnóstico (del coordinador) fue que
More no podía ofrecer una tab de super admin: `SECCIONES_MAS` → `puedeVerKey` no conoce `ADMIN_FAMILIAS`.

**Causa real.** More YA tenía una sección «Super admin», con la Ticketera, desde el 14/10
(`app/m/mas/page.tsx`); ese diagnóstico miró `SECCIONES_MAS` y no la página. Lo que faltaba era la
PANTALLA del Centro en `/m`: sin ella, un botón llevaba a la cubierta de «se usa en la computadora».
Y lo de super admin **no va en `SECCIONES_MAS` a propósito**: de ahí sale también la barra del rol, y
una tab de plataforma podría subir a la barra de alguien que no es super admin.

**Lo que quedó.** `/m/operaciones` sólo para mirar, copiado de la lista de GitHub Actions en el teléfono
(una fila por pedido con su estado, el detalle en una hoja), con el mismo guard que escritorio
(`puedeOperar`). Su puerta, en «Super admin» al lado de la Ticketera, y la sección entera se apaga
mientras el super admin mira a un cliente (`!ctx.impersonando`), como el Sidebar.

**Vive en:** `app/m/operaciones/` · `app/m/mas/page.tsx` · `lib/movil-rutas.ts` (`rutaMovil`,
`rutaEscritorio`) · `tests/operaciones.test.ts`

## Lo que creí medido y no estaba al día

- **`soloPlataforma` ya existía en el registro de la API** (lo sumó el 2FA obligatorio el 14/10, por
  CAPA en `vistaDe`). El relevamiento leyó un árbol anterior y el diseño decía que faltaba: se
  corrigió. Las lecturas del Centro lo usan.
- **`docs/api-mako.md` documenta lo que sale por HTTP**: un área sin `'http'`, como ésta, no aparece
  ahí, y el generador dice «al día» con razón.

## Lo que quedó sin hacer

- **Que el aviso de la Ticketera ande de verdad necesita instalar el cartero**: el token (lo crea Martín
  en /admin/operaciones con su 2FA), `cartero claude1 app ~/.claude` y `carpeta 68eda2ab-… claude1`, y un
  chat «Cartero» con un cron que corra `ciclo`, mande lo de `pendientes` y anote `acuse`. Los avisos no
  necesitan la clave del dispositivo.
- **La Ticketera no muestra si el aviso llegó**: el dato está (`aviso_estado`), la pantalla no lo dibuja.
- **Fase 2 del aviso**: firmar la respuesta al contestar, para que el aviso la lleve adentro.
- **Implementar el rediseño** de `docs/prototipos/centro-operaciones.html` en
  `app/admin/operaciones/CentroOperaciones.tsx`: espera la validación de Martín (15/10). La lógica de
  firma, las acciones y el cartero no cambian; cambia la pantalla.
- **Instalar el cartero de verdad** (`instalar`, el token, las claves, `cartero claude1 app ~/.claude`
  y las carpetas) y abrir el chat «Cartero» con su cron: va después del deploy, contra producción.
- **Las cuentas de terminal**: el `/login` de cada una (lo hace Martín), su marcador por directorio y
  sus hooks, y un chat Cartero en cada una. Hasta entonces, sólo entrega el cartero de la app.
- **La opción C** (un hook con `asyncRewake` en la carpeta del Cartero, que lo despierta sin gastar
  turnos): documentado que despierta a una sesión ociosa; no probado con `Stop`. Necesita el OK de
  Martín porque es configuración.
- **El teléfono, para MANDAR**: desde el 15/10 `/m/operaciones` deja mirar (la cola, cada pedido, los
  carteros) y tiene su puerta en More → «Super admin». Mandar desde ahí necesita la clave DEL teléfono
  cargada en la PC, y no se planifica: es un extra. Si se hace, se verifica en su iPhone de verdad.
- **Etapa 2 (la cuota)** y **etapa 3 (el señalador)**.
- **Proponer un pedido desde un chat de MaKo** con `confirmacion: 'pantalla'` (se firma en la pantalla):
  no está en el registro.
