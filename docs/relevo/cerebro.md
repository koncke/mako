# Relevo — Cerebro y «Cerebro › Integración»

<sub>Esta sección se PISA en cada relevo y no pasa de ~60 líneas. Lo viejo, tal cual se escribió, está en
`docs/relevo/cerebro-historia.md` (ahí quedó también el relevo del 21/10 noche de la cuenta claude4).</sub>

## ⏩ LEER PRIMERO — 21/10/2026 noche, cuenta claude3

**El Cerebro son dos chats (pedido de Martín, 21/10 noche):** **«Cerebro»** reparte y habla con Martín; **«Cerebro ›
Integración»** (sub-chat del Cerebro en el Ops Center) es el ÚNICO que integra y sube, y le reporta al Cerebro. Las
puntas van a Integración; los pedidos y preguntas, al Cerebro. A los dos se les escribe por NOMBRE (ListAgents), no por
id: cada cuenta los abre de nuevo. Lo de abajo es, sobre todo, de Integración.

**Al iniciar una cuenta nueva, primero esto (regla de Martín del 21/10), en orden:** 1) medir la cuenta (`get_usage`);
2) abrir el Runner, así el uso sale en el Ops Center y los mensajes llegan; 3) archivar los chats viejos de esa cuenta;
4) abrir el Cerebro y su Integración frescos desde este relevo; 5) abrir los jefes de a uno, cuando tienen trabajo (los
abre el Cerebro, o Integración con su visto bueno; el brief dice «VERDE sin pushear, avisale a Cerebro › Integración»).

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
5. «Ya está» a cada chat cuando su punta llega a producción; al Cerebro, los bullets en palabras de producto (él se los
   pasa a Martín). Un arreglo de un cliente, además, a su grupo de MaKo (lo manda MaKo Alert).
6. Migraciones: `node C:/dev/wt-push-q/scripts/apply-migration.mjs <sql>` corrido DESDE `dashboard-marketing/`.
Lo visual entra sin revisión adversarial; plata, privacidad, sesión y herramientas que usan todos, siempre con revisión.

**Migraciones del 21/10:** 0317, 0322 (APLICADA; NO se vuelve a correr — desde 60f2aba52 su backfill ya no confirma
pendientes, pero igual no), 0323 (idempotente).

**Estado al escribir (22/10):** en producción hasta el run 228 (`43b0c2625`, Automations: la prospección del Sprint;
226 y 227 fueron Infra, la 0322 segura y este método). Subiendo: el Ops Center en la computadora, el teléfono sin
«Reload», el hito de Automations y `docs/feedback-22-10.md`. El 22/10 se quitaron 51 worktrees integrados (el disco
estaba en 1,3 GB; quedó en 26): `docs/hallazgos-infra.md`, «Limpiar worktrees».

**En curso / por abrir:**
- **Onboarding, Florencia ws21, punto 1 (cliente roto):** tarjeta `task_8d15785e`, espera el clic de Martín. Rama
  `onboarding-arranque` (C:/dev/wt-onboarding-arranque): guardar las preguntas del arranque y reconstruir las de ella.
- **Nube, los abre el Cerebro con el OK de Martín** (briefs en `side-session-notes/local_428051c1…/briefs-nube-21-10.md` y
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

**⚠️ GitHub Actions SIN MINUTOS desde el 22/10, 07:17 UTC** (plan Free; se reinicia el 1/11). GitHub dice: «The job was not
started because recent account payments have failed or your spending limit needs to be increased». Mientras tanto se sube
DIRECTO a `main` (e `integracion` al mismo sha) con el chequeo local completo en verde: tests afectados, tsc acotado,
guardas y la rotura de lo nuevo. Se juntan puntas y se verifica el Ready. Cuando Martín ponga un medio de pago, se re-corre
la última corrida de `integracion` como red (docs/hallazgos-infra.md, «Sin minutos de Actions»). ⚠️ El hook del push a
`main` pide 6,3 GB libres y esta PC no pasa de 6,1, así que **`87365c830` salió con `--no-verify`** (22/10, ~09:30): Martín lo
autorizó para ESE lote, contestando la pregunta a6967bef de Integración desde el Centro. Lo que se había corrido: los tests
afectados de cada punta, el tsc acotado de lo tocado, las guardas y los tipos de todo el repo en 3 tandas, con 0 errores.
**Al volver los minutos, re-correr en Actions la corrida de `integracion` de `87365c830`** (o la última que lo contenga).
**Desde el 22/10, permiso PERMANENTE de Martín** (escrito por él en el chat del Cerebro): «Si, que avance siempre, no quiero
limitaciones, me estas sacando tiempo valioso con restricciones». Cada lote que pasó el chequeo local completo (tests afectados,
tsc acotado y guardas) sube a `main` sin preguntarle. Las 3 tandas de INF1 son la red cuando hay RAM, no una traba. Como el
permiso llegó por el Cerebro, Integración le pasa el sha verificado y el Cerebro hace el push `--no-verify`. Si Martín se lo
escribe a Integración en su chat, sube Integración directo. Memoria: `subir-a-main-sin-traba`. Así salió `f6bd295e7`
(22/10): el chequeo local completo lo hizo Integración, y el push `--no-verify` lo hizo el Cerebro, con el deploy Ready. Ese
lote traía AU1, OF1, OF2, los arreglos de los chats del Ops Center e INF1, y desde ahí el hook de INF1 está instalado en
`.git/hooks/pre-push`. **Falta:** la prueba de punta a punta de INF1 con un error plantado en la tanda 3 (no hubo RAM), y
re-correr en Actions `87365c830` y `f6bd295e7` cuando vuelvan los minutos.

**La llamada del 22/10 con Mauricio:** `docs/feedback-22-10.md` (lo P0 va antes que todo: reunión de validación HOY; los mensajes salen desde el sáb 24/10).

**Espera a Martín:** `resumen-cerebro-21-10.md` en la carpeta del proyecto en OneDrive (2FA, ejecutables 0.3.2, pedido
9a143455, el script del ws21 con `--meses=6` o `--mensual`, las claves del ws1, Leila ws11, lectura de producción para Infra).
