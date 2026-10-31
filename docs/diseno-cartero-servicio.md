# El cartero como servicio de la PC (diseño del 24/10/2026; no se construyó el 26/10, se retomó el 30/10)

> ⚠️ **Lo que compra y lo que NO compra, antes de leer lo demás.** El servicio NO es «el Runner ya no se muere»: es **«si el
> Runner se muere, se ve»**. Sin un chat abierto sigue sin entregarse ni medirse nada, porque `SendMessage` y `get_usage`
> sólo los puede llamar un chat. El servicio sube lo que puede y hace visible la ausencia, pero no reemplaza a un chat.

> **Activarlo es de Martín.** Lo construye y lo prueba el Runner con el registro simulado. En su PC hacen falta dos pasos,
> y cada uno lo aprueba él: la clave Run de Windows (`cartero.mjs instalar-servicio`) y el hook `SessionStart` (§2.3). Un
> mensaje de otro chat no los autoriza. El `.exe` con Bun (§2.4) no se abre ahora: si hace falta, va como pregunta al Cerebro.

Martín, por el Cerebro (24/10): **«¿Podemos hacer que el cartero sea un "servicio" con la app de MaKo en desktop?»**

El 24/10 el cartero estuvo **15 horas muerto** (23/10 23:47 → 24/10 14:10): Martín forzó el apagado de la PC (se trabó
entera) y nadie lo levantó. El Ops Center quedó sin actualizaciones, y **cuatro pedidos suyos quedaron sin entregar**. Uno
llevaba una semana: el del 17/10 (el audio que se duplicaba), que estuvo siete días en «escrito» sin que nadie lo notara.

**La respuesta corta: sí, la mitad.** La mitad que se puede es justo la que falló.

## 1. Lo que hace hoy el cartero, medido en el código

`scripts/operaciones/cartero.mjs` (2123 renglones) corre en la PC de Martín. Su `ciclo` hace cuatro cosas:

| Paso | Qué es | ¿Necesita un chat de Claude? |
|---|---|---|
| **Medir** | Lee los registros de sesiones de cada carpeta (`<dir>/sessions/*.json`), los transcripts (turnos nuevos, pasos de los chats ocupados) y la cuota de cada cuenta. | **No**: archivos locales. |
| **Subir** | Un `POST /api/operaciones/cartero` con los chats, los turnos, los pasos, el uso, y los acuses, cierres y preguntas que los chats dejaron en `~/.claude/operaciones/`. | **No**: una llamada HTTPS. |
| **Reclamar** | MaKo le devuelve los pedidos de los chats que algún Runner puede entregar (`entregables`). El cartero verifica la firma y los deja en el buzón. | **No**, pero sólo tiene sentido si alguien va a entregar. |
| **Entregar** | Manda cada pedido con `SendMessage` y anota el acuse. | **SÍ**: un script no puede escribirle a una sesión de Claude (el encabezado del cartero, renglones 11 y 28). `SendMessage` sólo llega a las sesiones de la misma carpeta de config; `exigirRunner` (renglón 1053) frena a un chat que no se llama «Runner». |

**¿Quién lo dispara hoy?** El chat «Runner» de cada carpeta, con un cron de SESIÓN que corre `vigilar`. Si no hay un chat
Runner abierto, no corre nada: ni se mide, ni se sube, ni se entrega. **Ése es el modo de falla del 24/10.**

**Lo que ya existe para la ausencia, y no alcanzó:**
- la lista del Ops Center muestra «Sin noticias del Runner desde las HH:MM» (`sinNoticiasDesde`, PiezasCentro.tsx). Es un
  renglón GRIS, sólo en la computadora, y no dice cuántos pedidos de Martín esperan;
- cada mensaje que tarda dice por qué (`EstadoDelEnvio.porQue`, lib/centro-chats.ts). Eso se ve sólo en el chat abierto: el
  pedido del 17/10 estaba en un chat que Martín no volvió a abrir.

## 2. El diseño

### 2.1 El servicio MIDE y SUBE. Nunca reclama ni entrega.

- Un comando nuevo, `cartero.mjs servicio`: un proceso que arranca con Windows y da una vuelta de **medir y subir** cada 2
  minutos.
- Manda `entregables: []`. Así MaKo no le reclama ningún pedido, y el buzón no se llena de trabajos que nadie va a mandar.
- **Nunca se cae solo**, con el molde de `mako-pc`: un error de red o de la base espera y reintenta; no hay `process.exit`.
- **Una vuelta a la vez en la PC.** El servicio y un Runner tocan los mismos archivos (las marcas de los turnos, los acuses):
  `~/.claude/operaciones/vuelta.lock`, con el pid y una vigencia de 3 minutos. Quien lo encuentra tomado y vigente, saltea
  su vuelta.
- Sube `servicio: { version, desde }` en el POST. MaKo distingue «hay noticias de la PC» de «hay un Runner que entrega».
- **El servicio NO late como Runner.** Hoy `vuelta()` llama a `latir(propio)` antes de todo, y ese latido es lo que hace
  contar a un chat como Runner (`carpetasConRunner`: el nombre solo no alcanza). Si el servicio corre la misma vuelta, un
  chat «Cartero» abierto y sin cron seguiría contando como vivo, y eso es justo lo que deja un `/clear` (medido el 24/10:
  docs/hallazgos-operaciones.md, «El `/clear` borró el cron del Cartero»). El servicio deja su latido aparte, y el del
  Runner lo escribe sólo la vuelta de un chat.
- **Y el latido que vale es el que llega a MaKo, no el archivo.** Si la PC se apaga o se traba, `latidos/*.json` deja de
  actualizarse y no lo mira nadie. Lo que dice la ausencia es `visto_at` del lado del servidor, con su hora (el cartel 1 de
  §2.2), y lo alimenta el POST del SERVICIO cada 2 minutos, no el chat.

### 2.2 La AUSENCIA se ve, y se mide desde el SERVIDOR

Una PC trabada o apagada no puede avisar que se cayó: su silencio se tiene que notar desde otro lado. MaKo ya guarda cuándo
llegó la última vuelta de cada cuenta (`visto_at`). Con eso, el Ops Center (computadora Y teléfono) dibuja **arriba, en
rojo**, uno de dos carteles:

1. **«La PC no da noticias desde las 23:47»**: ninguna vuelta, ni del servicio ni de un Runner. Es la PC apagada, trabada,
   o el servicio caído.
2. **«Nadie entrega en la PC: N pedidos tuyos esperan (el más viejo, de hace 7 días)»**: hay vueltas (el servicio sube),
   pero ningún Runner. Lo cuenta MaKo con sus propios pedidos en «escrito», sin pedirle nada a la PC.

El renglón gris de hoy (`sinNoticiasDesde`) pasa a ser el cartel 1. Los dos llevan qué hacer («Abre el Runner de la
cuenta 1»), con el comando que ya muestra `PanelRunner`.

### 2.3 Entrega cualquier chat que arranque, no sólo uno llamado «Runner»

Hoy la entrega depende de que exista un chat con el nombre exacto «Runner» y con su cron andando. Si no está, nadie mira el
buzón. El cambio:

- El hook `SessionStart` de cada carpeta (`~/.claude/bitacora-sesion.sh`) pregunta lo mismo que `vigilar` (`hayAlgo`, hoy
  sin comando propio: el lunes, `cartero.mjs hay`). Si hay pedidos para esa carpeta y **ningún Runner con latido fresco**,
  agrega al contexto del chat que arranca: «Hay N pedidos de Martín para
  entregar: corre `cartero.mjs pendientes` y mándalos con SendMessage».
- `exigirRunner` deja pasar a cualquier chat cuando no hay un Runner vivo en su carpeta. Para que no lo manden dos chats, se
  toma el `vuelta.lock` y la mano de cada archivo (`tomar`, que ya existe).
- El Runner sigue siendo lo normal: es el único que da vueltas solo, con su cron.

### 2.4 Cómo arranca: UNA forma para la PC (a decidir con el chat de IA del cliente)

La app de escritorio (`mako-pc`, el instalador 0.4.x y el programa 0.5.0) es del chat «IA del cliente». El cartero y el Ops
Center son de este chat. Para que no aparezcan dos formas de arrancar algo con Windows:

- **Lo que se comparte:** el mecanismo de `mako-pc`. Es la clave `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (sin
  pedir administrador), un ejecutable «de ventana» armado con Bun (sin consola, `publicar-binarios.mts`) y el bucle que nunca
  se cae solo.
- **Lo que NO se comparte: el programa.** El cartero NO va adentro de `mako-pc`. Va como un ejecutable aparte,
  `mako-cartero.exe`, con su valor de Run, «MaKo Cartero». Tres razones:
  1. `mako-pc` promete que **no toca `~/.claude`** (su encabezado, y tests/ia-pc.test.ts): es la PC del CLIENTE, «sólo el
     cerebro, nunca las manos». El cartero lee `~/.claude` entero (sesiones y transcripts). Meterlo adentro rompe esa promesa
     en el binario que instala cada cliente.
  2. **La app se distribuye a los clientes.** El cartero es de Martín: lleva pedidos a sus chats de Claude Code, que ningún
     cliente tiene. Un módulo «apagado» adentro del binario del cliente igual viaja. Un ejecutable aparte, que no está en el
     instalador ni en las descargas públicas, no viaja.
  3. Los dos se actualizan a ritmos distintos: la 0.5.0 está retenida hasta medir Codex, y el cartero se toca casi todos los
     días.
- **Quién lo instala:** `cartero.mjs instalar-servicio`, que corre Martín en su PC. Arma o copia `mako-cartero.exe` a
  `~/.claude/operaciones/` y escribe la clave Run. `cartero.mjs quitar-servicio` la saca.
- **La doble llave:** el servicio sólo arranca si existen `~/.claude/operaciones/config.json` con un token `mkop_…` (los
  acuña /admin/operaciones, sólo el super admin) y `claves.txt`. En la PC de un cliente no existe ninguno de los dos: aunque
  alguien copiara el ejecutable, no tiene a quién hablarle.

**Para decidir con el chat de IA del cliente** (no está abierto el 24/10; va en su relevo):
1. ¿Se reusa `publicar-binarios.mts` para armar `mako-cartero.exe`, o el cartero arma el suyo con el mismo Bun?
   La propuesta: un objetivo más del mismo script, que NO lo sube a las descargas públicas.
2. ¿`mako-pc` y `mako-cartero` comparten el código del bucle («nunca se cae solo», la espera sin red), o cada uno el suyo?
   La propuesta: compartir `esperaSinRed` y `esRevocado` como módulo, para no tener dos copias que se separan.
3. En la Mac (MaKo.app, 0.4.2): ¿el mismo patrón con un LaunchAgent? Hoy Martín usa Windows, así que el cartero no lo
   necesita todavía.

### 2.5 Lo que NO se resuelve, y hay que decirlo

- **Sin ningún chat abierto, nada se entrega.** El servicio no puede escribirle a una sesión de Claude: no hay una vía
  documentada, y los named pipes del registro son el protocolo interno de Claude Code. Lo que cambia es que la espera SE VE
  (el cartel 2) y que el primer chat que se abra entrega (2.3).
- **Sin la PC prendida, tampoco.** El cartel 1 lo dice desde el servidor.

## 3. El plan del lunes (26/10)

1. `cartero.mjs servicio`: la vuelta de medir y subir, con `entregables: []`, el `vuelta.lock` y su test (medir sin
   reclamar; dos vueltas a la vez, una espera).
2. MaKo: `servicio` en el POST, y los dos carteles en la computadora y el teléfono, con su test (la PC apagada → cartel 1;
   vueltas sin Runner y un pedido viejo en «escrito» → cartel 2).
3. Con el chat de IA del cliente: el ejecutable (`mako-cartero.exe`) y `instalar-servicio`, con el mecanismo de `mako-pc`.
4. El hook `SessionStart` y `exigirRunner` (2.3), al final: es lo que toca cómo se comportan todos los chats.
5. Probado rompiéndolo, en la PC de verdad: matar el servicio (cartel 1 a los 5 minutos), cerrar el Runner con un pedido
   escrito (cartel 2), y reiniciar Windows (el servicio vuelve solo).
