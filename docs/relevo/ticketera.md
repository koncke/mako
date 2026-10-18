# Retomar: Ticketera (los tickets de los usuarios y los errores de la app)

**Chat jefe:** «Ticketera», cuenta 4 (claude4), abierto por el Cerebro el 17/10/2026.
**Rama:** `ticketera` (worktree `C:/dev/wt-ticketera`, node_modules por junction). Las puntas las sube el Cerebro.

**Qué es esto**, para quien nunca lo vio: un cliente levanta un ticket al equipo de MaKo (desde el chat de MaKo o en
«Reportar problema», /tickets). El triage decide: un bug evidente va solo al Cerebro y se arregla; algo nuevo espera a
Martín en la Ticketera de Ops Center (`?ticketera=tickets`, estilo Linear Triage). Además, los ERRORES de la app (una
pantalla rota, el servidor, lo que falla de MaKo en un chat) abren solos un ticket de bug, uno por huella. El ticket se
cierra solo cuando el deploy trae el hito de la bitácora con `tickets: [n]`, y al cliente le llega el aviso.

## 1. Los pedidos

- 17/10: «La ticketera desde ahora será exclusiva para los tickets levantados por los usuarios… un bug evidente… debe
  solucionarse automáticamente, pero si alguien pide implementar algo nuevo, eso sí depende de mi decisión».
- 17/10 09:36: «lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app… Y todo lo
  solucionas automáticamente».
- 18/10 (del Cerebro, por los tickets #5 y #6 de Mauricio): un negocio SIN IA conectada no es un bug; MaKo le dice que
  conecte la suya, sin salir de la tab.

## 2. En qué quedó (todo en producción salvo lo del punto 3)

| Pieza | Dónde |
|---|---|
| El ticket y su historial (mig 0311) | lib/tickets-db.ts, lib/tickets-reglas.ts |
| El triage (sin IA: reglas + el error que vio el código) | `clasificar`, lib/tickets-reglas.ts |
| «Reportar problema» del cliente | app/tickets/ |
| La bandeja de Martín y «Aprobar» firmado al Cerebro | app/tickets/bandeja/ |
| El bug al Cerebro por el Runner (cartero 1.15.0) | lib/tickets-runner.ts, lib/tickets-aviso.ts |
| Los errores de la app, por huella (mig 0313) | lib/errores-app.ts, lib/errores-app-reglas.ts, /api/errores, instrumentation.ts |
| El cierre y el aviso (chat, push, grupo con la prueba del deploy) | lib/tickets-cierre.ts, /api/cron/tickets |
| Lo que usa el Cerebro | scripts/tickets.ts (`ver`, `pendientes`, `reclasificar`, `arreglado`) |

## 3. Lo que sigue

- **El negocio sin IA conectada** (pedido del 18/10): en producción no abre ticket y el chat pide «Conectar tu IA».
- **El ws1 separado de las keys de IA de la plataforma** (Martín, 18/10: «separá el ws1 de las claves de la plataforma»):
  `wsDelEntorno` en lib/credenciales.ts. La IA sale de la plataforma (`wsSuperAdmin()`) y el resto sigue saliendo del
  ws1. ANTES de que arranque ese código hay que correr `scripts/ia-del-ws1-a-la-plataforma.mts --aplicar` (copia a la
  plataforma las keys de IA del ws1 que no tiene; es aditivo). En qué quedó: la bitácora del área.
  **Lo que NO se movió**, y queda para otra decisión (detalle en docs/hallazgos-integraciones.md → «El ws1 no puede tener
  una IA propia»):
  - lo que no es IA de la fila del ws1 (Meta, Calendly, Fathom, Resend, Panda, YouTube…), que sigue siendo el entorno;
  - las settings de plataforma en el ws1: `mako.modelos`, `mako.claude.pausa`, el canal de MaKo, los guiones, el método
    de copywriting, el grupo de MaKo y el Plan (`runWithWorkspace(OWNER_WS, …)`);
  - el gasto de Claude con la key de la plataforma anotado al ws1 (lib/anthropic-usage.ts) y `claudePropio` del ws1
    (lib/api-mako/areas/integraciones.run.ts);
  - la Cerebras del ws1, que no coincide con ninguna de la plataforma: no se copió, y con el código nuevo cuenta como suya.
- **La Ticketera en el teléfono**: hay una tarjeta propuesta, «Ticketera › Teléfono».
- **Sacar las preguntas de los chats del mazo** (`?ticketera=tarjetas|lista`) cuando el formulario de Ops Center ande
  en producción. Es de la Ticketera.

## 4. Lo que no se ve en el código

docs/hallazgos-ticketera.md (el cierre lo dice el código desplegado; un bug sin firma no llega a la PC; la huella sin el
stack; un 400 no es un bug). El diseño: docs/diseno-ticketera-usuarios.md. La regla: AGENTS.md → «Un ticket de un
cliente».
