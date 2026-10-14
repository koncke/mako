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

## Lo que quedó pendiente al 14/10 10:40

- **El push de GENERAL, en cola** (`C:/dev/wt-push-k`, main del clon d135c882): General con los bloques
  rediseñados, las tarjetas del Plan, los OKRs, el editor sin la barra en blanco, conectar integraciones sin
  salir de la tab, y el Calendario con lo que se repite, agendar llamadas y cobros.
- **Automations (`undecima` a18d39240) NO se puede subir: tiene 5 errores de tipos** de su merge
  (`PasoGrafo` duplicado en lib/flujo-ia-crear.ts, `ContextoControl` en
  tests/automations-condicion-contesto.test.ts y `si_contesta` en tests/motor-carril-recordatorio.test.ts).
  Ya se le pidió que los arregle. Después del deploy de esa rama va **la 3ª migración**
  (`scripts/migrar-contesto-condicion.ts --apply`, 8 automatizaciones). Las dos primeras ya corrieron.
- **CRM** sigue con un feedback nuevo de Martín, en las ramas `fb1410*` (C:/Users/marti/wtcrm5 y wtc-a1..a6),
  sin pushear.
- **Martín tiene que confirmar el borrador de 50 tareas** del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6
- **Decisión de Martín, sin contestar:** que el vigía se levante solo si se cae (hoy sólo arranca al
  iniciar sesión, y el 13/10 estuvo seis horas caído sin que nadie se enterara).
