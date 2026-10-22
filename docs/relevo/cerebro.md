# Relevo — Cerebro (el chat orquestador: reparte, integra y sube)

<sub>Esta sección se PISA en cada relevo y no pasa de ~60 líneas. Lo viejo, tal cual se escribió, está en
`docs/relevo/cerebro-historia.md` (ahí quedó también el relevo del 21/10 noche de la cuenta claude4).</sub>

## ⏩ LEER PRIMERO — 21/10/2026 noche, cuenta claude3

**Al Cerebro se le escribe por NOMBRE** («Cerebro», con ListAgents), no por id: cada cuenta lo abre de nuevo.

**Al iniciar una cuenta nueva, primero esto (regla de Martín del 21/10), en orden:** 1) medir la cuenta (`get_usage`);
2) abrir el Runner, así el uso sale en el Ops Center y los mensajes llegan; 3) archivar los chats viejos de esa cuenta;
4) abrir el Cerebro fresco desde este relevo; 5) abrir los jefes de a uno, cuando tienen trabajo.

**Cómo se abren los chats (medido hoy):** `start_session` sólo arranca con palabras de Martín en el turno. En un turno
que empezó otro chat sale como TARJETA (`own_initiative`) que él toca, y una sesión en la NUBE con repositorio ni
siquiera se puede proponer: se le pide el OK con un botón («Arrancá …»). Va LOCAL lo que lee la base o usa su Chrome;
el resto, a la nube (`repository: hola-mako/dashboard-marketing`; el remoto real es github.com/koncke/mako). Una rama
local que un chat de la nube necesita se sube antes a origin. A lo sumo ~8 chats abiertos: un jefe con su punta en
producción y su relevo commiteado se archiva, y se reabre desde `docs/relevo/<área>.md` cuando vuelve a tener trabajo.

**Herramientas** (`C:/dev/cerebro-herramientas/`): `esperar-deploy.sh <sha>` (run + Vercel, en segundo plano),
`esperar-run.sh`, `nota-revision.cjs`, `unir-filas.cjs` (índice de hallazgos tras un `checkout -m`), y el relevamiento
del 21/10 (`relevamiento-21-10.md`, `worktrees-21-10.tsv`). Las notas de revisión van a la carpeta de notas de la
sesión que inició al Cerebro (hoy `side-session-notes/local_428051c1…`).

**Cómo se integra** (en `C:/dev/wt-push-q`; ningún otro chat commitea ahí):
1. `git merge --no-edit <sha>`, nunca rebase. Si la punta trae su VERDE, su sha es ancestro y el merge no chocó, NO se
   repiten sus tests: alcanza con los de lo que choca.
2. Tests: `MAKO_TESTS_SIN_ESPERA=1 node scripts/tests-afectados.mjs --base <HEAD de antes> --cortar --concurrencia 2 --tanda 100 --compartir`.
3. Tipos: si una punta vino «sin tipos», `node scripts/tsc-acotado.mjs <archivos>`; si el vigía lo mata, con menos archivos.
4. `MAKO_SIN_ANTES_DE_SUBIR=1 git push origin HEAD:refs/heads/integracion`, y `esperar-deploy.sh` en segundo plano.
5. «Ya está» a cada chat cuando su punta llega a producción; a Martín, en bullets de producto. Un arreglo de un
   cliente, además, a su grupo de MaKo (lo manda MaKo Alert).
6. Migraciones: `node C:/dev/wt-push-q/scripts/apply-migration.mjs <sql>` corrido DESDE `dashboard-marketing/`.
Lo visual entra sin revisión adversarial; plata, privacidad, sesión y herramientas que usan todos, siempre con revisión.

**Migraciones del 21/10:** 0317, 0322 (APLICADA; NO se vuelve a correr — desde 60f2aba52 su backfill ya no confirma
pendientes, pero igual no), 0323 (idempotente).

**Estado al escribir:** `integracion` = `382a9cdb1` (las puntas de Infra: el candado que no se retiene esperando RAM y
«Tipos» = tsc entero con tandas de respaldo «OK PARCIAL»), run corriendo. En wt-push-q, encima, para el próximo lote:
`60f2aba52` (la 0322 segura) y este relevo.

**En curso / por abrir:**
- **Onboarding, Florencia ws21, punto 1 (cliente roto):** tarjeta `task_8d15785e`, espera el clic de Martín. Rama
  `onboarding-arranque` (C:/dev/wt-onboarding-arranque): guardar las preguntas del arranque y reconstruir las de ella.
- **Nube, esperan el OK de Martín** (briefs en `side-session-notes/local_428051c1…/briefs-nube-21-10.md` y
  `brief-infra-chequeo-modular.md`): **Infra** (integra `origin/infra-tests-afectados` y arma el chequeo modular),
  **Ticketera** (la guarda D6b por handler), **Pagos** («A quién cobrar» paginado y `resto_de` en 'lista'/'porId': es
  plata, va con revisión) y **Ops Center 1.2** (`origin/mako-wa` a main, con `aTerceros` en los tres envíos de la 2.1).
- **Después:** CRM, sus bajas (cuando la 1.2 esté en main); Verificación (`wsDeVuelta` en las salidas de error); la cola
  de prioridad 5 en el orden de `relevamiento-21-10.md`; Infra, el script «Sin integrar» (`git cherry` sobre todos los
  worktrees) y quitar los 64 worktrees ya integrados (primero `cmd /c rmdir` de la junction de node_modules, sin /s;
  después `git worktree remove` sin --force).
- **MaKo Alert no corre en claude3:** hay que abrirlo (el vigía y el aviso al grupo de Florencia). Su script
  (`scripts/vigia-mako-grupos.mts`) vive en `mako-wa` hasta que la 1.2 entre a main.

**DECISIÓN DE MARTÍN (21/10, 21:45): modularizar el chequeo de GitHub.** Un cambio chico tardó 10-15 min en salir
(«antes salían antes»). Vía rápida para lo chico o urgente; el resto, sólo los tests y tipos de lo afectado; lo que va a
`main` no puede dar un OK falso, y un chequeo completo nocturno queda de red. Es de Infra.

**Espera a Martín:** `resumen-cerebro-21-10.md` en la carpeta del proyecto en OneDrive (2FA, ejecutables 0.3.2, pedido
9a143455, el script del ws21 con `--meses=6` o `--mensual`, las claves del ws1, Leila ws11, lectura de producción para Infra).
