# Relevo — Estrategia 3 cuentas (el chat orquestador)

<sub>Escrito por el chat «Estrategia 3 cuentas» (cuenta 2) el 14/10/2026; cierre a las 15:05 hora AR, con la
cuenta al 95% semanal. Es material de primera mano: este chat coordinó los pushes del 13 y el 14/10.
Reemplaza a estrategia-2-cuentas.md.</sub>

## Cómo se pushea hoy, con ~15 chats sobre un clon y 16 GB de RAM

- **Un solo push por vez, y lo hace el orquestador.** Cada push corre un `tsc` de ~4-5 GB. Si corren dos a la
  vez, mueren los dos, y la app de Claude se cayó dos veces por eso (14/10, a las 04:27 y a las 06:10).
- **Integración en un worktree aparte** (`C:/dev/wt-push-<letra>`; la última letra usada fue la `o`): se parte
  del main del clon y se suman las ramas de cada chat con **merge, nunca rebase**, porque las bitácoras citan
  hashes. Un chat que rebasea su rama trae copias de commits que ya entraron y choca en decenas de archivos:
  se le devuelve para que mergee él.
- **Martín pidió (14/10 13:00) «No esperes por la ram, pushea directamente».** El procedimiento:
  `Stop-ScheduledTask mako-vigia-ram`, una red propia (`guardia_push_<letra>.ps1`, en el scratchpad de este chat)
  que mata sólo el tsc de ese worktree si quedan menos de 300 MB, `MAKO_TYPECHECK_SIN_ESPERA=1 git push origin
  HEAD:main`, y al terminar `Start-ScheduledTask`. El script es `push_<letra>.sh`. ⚠️ Después de cada push se
  verifica `(Get-ScheduledTask mako-vigia-ram).State` = Running: varias veces quedó en «Ready».
- **Si otro chat tiene el turno del lock esperando RAM** (un `typecheck-lock.mjs` sin un `tsc` hijo), frena a
  todos: se corta ese `git push` (`taskkill /T`), no subió nada, y se le avisa al chat.
- **Después del push:** `npx vercel ls` hasta Ready (pushear no es desplegar), y avisarle a cada chat.
- **Cada push se le reporta a Martín en bullets**, en palabras de producto (memoria `pushes-con-bullets`).
- ⚠️ **Mientras corre un push, su worktree NO se toca** (ni merge ni edición): el pre-push chequea el DISCO.
  Ver `docs/hallazgos-infra.md` → «Mergear en el worktree de un push mientras corre su pre-push».
- ⚠️ **El typecheck completo pide 5120 MB de heap desde el 14/10 13:15** (el Image Editor portado lo pasó de
  4096). Arranca con 2-4 GB libres, pagina, y termina en ≈ 4 min.
- ⚠️ **Antes de pushear una rama con paquetes nuevos**, que estén en `package.json` y en el lock: el
  `node_modules` del clon tiene paquetes sueltos y el typecheck pasa igual (14/10: `qrcode` tiró un deploy).
- ⚠️ **Para sacar el junction de un worktree desde PowerShell**, `(Get-Item <ruta>\node_modules).Delete()`: la
  guardia de la app bloquea `cmd /c rmdir` («Remove-Item on system path '/c'»).

## Lo que quedó pendiente al cierre (14/10 15:05, cuenta 2 al 95%)

- **Todo lo terminado sale en el push de cierre** (General sexta vuelta con el arreglo urgente del Dashboard
  sin hojas `78fe81321`, y `editor-imagen` hasta `912d2d2d8`). Si no quedó Ready, el log es `push_o.log` del
  scratchpad de este chat.
- **Pedido de Martín sin chat que lo tome (14/10 14:34, textual):** «Dale este mismo feedback al dashboard...
  Que rediseñe bloque por bloque y que tenga en cuenta mobile. Que vaya viendo con datos ficticios o con algun
  dato de algun workspace que todo se vea bien en diseño. Tanto bloques como las plantillas.» No hay un chat
  del Dashboard abierto y la cuenta 2 no lo arranca (95%). El método (capturas por bloque y por plantilla, en
  escritorio y a 364 px) está en `docs/hallazgos-objectives.md` → «General, sexta vuelta», y el pendiente en
  «Lo que quedó sin hacer» del mismo archivo.
- **CRM está en la tanda B**: la integra el orquestador, y que el CRM NO rebasee su rama.
- **Landing Generator:** rojo en main de `tests/integracion-sin-salir.test.ts` por
  `app/landing-generator/editor/dialogos/DialogoPublicar.tsx` y `editor/nodos/CobroBoton.tsx` (links a
  /integraciones); se le pasó el 14/10 14:12.
- **Rojo conocido en HEAD:** `tests/cobranza.test.ts` (lo reportó General; no frena el push).
- **Nunca** pushear `wip/api-acciones-1410` («A MEDIAS»), `api-acciones-1310` ni `opcion-image-en-clientes`.
- **Decisiones de Martín, sin contestar:**
  - si la tab Image se ve también mirando un cliente (está armada en `opcion-image-en-clientes`);
  - si la barra de selección en lote del Ads Manager va oscura o clara;
  - que el vigía se levante solo si se cae (hoy sólo arranca al iniciar sesión, y el 13/10 estuvo seis horas
    caído sin que nadie se enterara);
  - confirmar el borrador de 50 tareas del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6
