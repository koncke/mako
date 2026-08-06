# Tareas del plan que ya están hechas

Mapa, **no** acción. Ninguna de estas se marcó ni se cerró: el pedido del dueño fue
explícito — «mapealas todas pero no las marques, eso debería hacerlo justamente lo que
habíamos hablado antes, el bot que revisa el código o los commits».

Este archivo es el insumo de ese bot, y mientras tanto la lista para cerrarlas a mano.
Se llena a medida que avanza el barrido de detalles (`scripts/barrido-dump.ts`).

## Cómo leerlo

Cada fila trae la **evidencia verificable**: archivo:línea del repo, o el dato del
negocio que lo prueba. Si no hay evidencia dura, no entra en esta lista — «me parece que
esto ya está» no sirve para cerrar nada.

`confianza` es qué tan sólida es la evidencia:
- **alta** — el código está y hace exactamente lo que la tarea pide.
- **media** — el código está pero cubre parte, o falta verificarlo corriendo.

---

## Tablero del dueño (ws 9)

| # | Tarea | Evidencia | Confianza |
|---|---|---|---|
| 1 | Buscador en la tab Proyectos | `app/plan/board/BoardShell.tsx:1859-1880` — filtra por nombre, por pid visible y por el texto de las tareas; sin acentos; con filtro activo levanta el tope de 8 | alta |
| 2 | Evaluar uso de Gemini API para el Perro Guardián | `lib/model-registry.ts:54` — `mako-guardian` con `def: GEMINI()` y `recomendado: GEMINI()`. La evaluación se hizo y se migró: 5/5 contra 4/5 de Sonnet en el lote de ruteo | alta |
| 3 | Implementar exportación de clientes a CSV | `app/crm/leads-exportar.ts` + `app/crm/ExportarLeadsModal.tsx` + `app/crm/importar-server.ts` | media — el código está, falta probarlo con un workspace de más de 1000 leads (techo de PostgREST) |
| 4 | Permitir navegar hacia atrás en el cuestionario de onboarding | `app/chat-agent/OnboardingChatAgent.tsx:1018-1020` — `atrasLabel="Atrás"` con su `onAtras` | media — el botón está; falta confirmar que al volver la respuesta anterior sigue cargada |
| 5 | Agregar botón de ignorar en la modal del Perro Guardián | `app/plan/board/BoardShell.tsx:210-211` — `ignorarDl` e `ignorarCl` | media — cubre deadline y cierre; falta ver si alcanza para el resto de sus avisos. Y el descarte vive en localStorage, así que no viaja entre dispositivos |
| 6 | Editor de funnel + rediseño del proceso + Fathom | El propio título de la tarea dice «(hecho)». Nutrición positiva derivada, No Show por reunión (R1/R2/R3), Fathom marca asistencia solo con llamadas de VENTA | alta |
| 7 | Wizard de arranque + extracción del histórico en vivo | El propio título dice «(hecho)». Wizard bloqueante, panel en vivo reanudable, control server-side | alta — pero ojo: la extracción **no avanza sola**, eso sigue abierto en #55 |
| 8 | Zona horaria por workspace | El detalle lo describe en pasado: `tzDeWorkspace(ws)` resuelve por cliente vía setting `mako.timezone` | alta |

---

## Lo que este archivo NO reemplaza

El bot que cierra tareas solo. Hoy existe **la mitad del cliente y ninguna del código**:

- **Corriendo:** `app/api/cron/tareas-verificar/route.ts` (cron diario, todos los
  workspaces activos) cierra tareas contra 13 señales del negocio
  (`lib/plan-senales.ts:28`) y avisa una vez por día, agrupado. Cuesta cero tokens.
- **El techo, que importa:** `lib/todo-seeds.ts:103` solo mira tareas con
  `origen === 'mako'` **y que hagan match por título exacto contra el seed**. Una tarea
  que salió de una reunión, de WhatsApp o escrita a mano NUNCA se autocompleta. Y no
  mira nada del Ads Manager: ni campaña creada, ni anuncio corriendo, ni presupuesto.
- **Del código, nada:** no hay una sola referencia a git, a commits o a la API de GitHub
  en `lib/` ni en `app/api/`. Lo único que hay es el canal `cerrar` (migración 0119),
  donde MaKo propone «esto ya está hecho» con evidencia y el dueño confirma de a una en
  `/plan/revisar` — pero el que mira el código es Claude Code a mano, no un proceso.
