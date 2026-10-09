# Briefings por chat del último relevo

Uno por cada chat que hay que retomar. **Se reescriben en cada relevo**; las versiones
anteriores quedan en el historial de git.

Para qué existen: la lista de chats de la app está **partida por cuenta** aunque los
transcripts sean compartidos, así que un chat de la otra cuenta **no se puede reabrir ni
mensajear** desde esta. Verificado el 27/09: `get_session` sobre las 4 sesiones de esa
mañana devuelve *not found*, y esta build no expone ninguna herramienta para crear
sesiones. El único paso que Claude no puede dar es el clic de «chat nuevo».

El flujo, entonces: Martín abre un chat con el título de siempre y pega **una línea**.

| Chat | Pegar |
|---|---|
| **Estrategia 2 CUENTAS** (el orquestador) | `Leé docs/relevo/estrategia-2-cuentas.md y decime cómo seguimos.` |
| Tareas de llamada con Mauricio | `Leé docs/relevo/tareas-llamada-mauricio.md y seguimos desde ahí.` |
| CRM | `Leé docs/relevo/crm.md y seguimos desde ahí.` |
| Chatbot | `Leé docs/relevo/chatbot.md y seguimos desde ahí.` |
| Customer Success | `Leé docs/relevo/customer-success.md y seguimos desde ahí.` |
| Integraciones | `Leé docs/relevo/integraciones.md y seguimos desde ahí.` |
| API de MaKo | `Leé docs/relevo/api-mako.md y seguimos desde ahí.` |
| Ads Manager | `Leé docs/relevo/ads-manager.md y seguimos desde ahí.` |
| Plan / Perro Guardián | `Leé docs/relevo/plan-perro-guardian.md y seguimos desde ahí.` |

Y los de ÁREA, que no tienen un chat con ese nombre pero sí briefing propio —se pegan en el
chat que toque ese código: `seguridad-aislamiento.md`, `pixel-clarity-landing.md`,
`avisos-y-whatsapp.md`, `instagram-afuera-y-curso.md`.

⚠️ **Esta tabla la editan varias sesiones a la vez y por eso choca.** Dos sesiones que
agregan su fila tocan la MISMA línea y el rebase da conflicto (pasó el 09/10 entre
`integraciones` y `api-mako`). La resolución es siempre la misma: **se quedan las dos filas**,
nunca se elige una. Si ves marcas de conflicto acá, juntá y seguí.

El estado completo de la ventana está en [`../relevo.md`](../relevo.md).
