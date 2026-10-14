# Relevo — Estrategia 3 cuentas (el chat orquestador)

<sub>Escrito por el chat «Estrategia 3 cuentas» (cuenta 2) el 14/10/2026 a las 10:40 hora AR. Es material
de primera mano: este chat coordinó los pushes del 13 y el 14/10. Reemplaza a estrategia-2-cuentas.md.</sub>

## Cómo se pushea hoy, con ~15 chats sobre un clon y 16 GB de RAM

- **Un solo push por vez, y lo hace el orquestador.** Cada push corre un `tsc` de ~4 GB. Si corren dos a la
  vez, mueren los dos, y la app de Claude se cayó dos veces por eso (14/10, a las 04:27 y a las 06:10).
- **Integración en un worktree aparte** (`C:/dev/wt-push-<letra>`): se parte del main del clon y se suman
  las ramas de cada chat con **merge, nunca rebase**, porque las bitácoras citan hashes. Un chat que rebasea
  su rama trae copias de commits que ya entraron, y eso choca en decenas de archivos: se le devuelve para
  que mergee él.
- **Martín autorizó pausar el vigía de RAM durante un push.** El procedimiento: `Stop-ScheduledTask
  mako-vigia-ram`, una red propia (`guardia_push.ps1`, en el scratchpad de este chat) que mata sólo ese tsc
  si quedan menos de 300 MB, `MAKO_TYPECHECK_SIN_ESPERA=1 git push`, y al terminar `Start-ScheduledTask`.
  ⚠️ Dos veces el script terminó con el vigía apagado: después de cada push hay que verificar
  `(Get-ScheduledTask mako-vigia-ram).State` = Running.
- **Con poca RAM, el push espera solo**: `push_final_<letra>.sh` (también en el scratchpad) espera 4 GB
  libres, trae el main del clon y origin, y pushea.
- **Cada push se le reporta a Martín en bullets**, en palabras de producto (memoria `pushes-con-bullets`).

- ⚠️ **Mientras corre un push, su worktree NO se toca** (ni merge ni edición): el pre-push chequea el DISCO y
  un merge en el medio le hace leer un árbol mezclado (14/10 12:49, 13 errores falsos). Ver
  `docs/hallazgos-infra.md` → «Mergear en el worktree de un push mientras corre su pre-push».

- ⚠️ **El typecheck completo pide 5120 MB de heap desde el 14/10 13:15** (el Image Editor portado lo pasó
  de 4096). Con «no esperes RAM» de Martín se pushea con `MAKO_TYPECHECK_SIN_ESPERA=1`; el chequeo arranca
  con 2-4 GB libres y pagina, pero terminó (≈ 4 min).

## Lo que quedó pendiente al 14/10 13:30 (semanal de la cuenta 2 al 89%)

- **Todo lo terminado está en origin/main `353c81a84`**: CRM tanda A, Landing tandas 3-5, General, el
  Image Editor (tandas 1 y 2) y el relevo de Automations. Las tres migraciones de «nada por detrás» corrieron
  (la 3ª, 8 automatizaciones, verificada por Automations).
- **CRM arranca la tanda B**: la integra el orquestador, y que el CRM NO rebasee su rama.
- **Nunca** pushear `wip/api-acciones-1410` («A MEDIAS») ni `api-acciones-1310`.
- **Rojo conocido en HEAD:** `tests/cobranza.test.ts` (lo reportó General; no frena el push).
- **Martín tiene que confirmar el borrador de 50 tareas** del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6
- **Decisión de Martín, sin contestar:** si la barra de selección en lote del Ads Manager va oscura o clara.
- **Decisión de Martín, sin contestar:** que el vigía se levante solo si se cae (hoy sólo arranca al
  iniciar sesión, y el 13/10 estuvo seis horas caído sin que nadie se enterara).
