# Relevo — Marketing CoPilot (nube, 6/11/2026)

Pedido de Martín (6/11/2026): la tab Ads Manager pasa a ser «Marketing CoPilot»: un copiloto que propone y discute el funnel (anuncios, webinar, lead magnets, YouTube, orgánico), no sólo campañas.

## Estado por tanda

| Tanda | Estado |
|---|---|
| 3. El agente | Hecha. El chat de la tab (`desde.tab = 'Marketing CoPilot'`) arma su contexto en `app/api/mako/chat/route.ts` con `lib/media-buyer/copiloto-contexto.ts`: las 10 reglas, lo que respondió el negocio con el veredicto de las reglas puras, `docs/conocimiento/anuncios-high-ticket.md` destilado SIN nombrar a nadie (`copiloto-conocimiento.ts`) y a lo sumo dos fichas de `lib/asesores` según el funnel (Instagram: Otálora y Collado; YouTube: Chamizo; webinar: Doglio; lead magnets: Contreras; anuncios: Juan ADS). Cuatro herramientas fijas. Seis conversaciones en `docs/marketing-copilot/conversaciones.md`, fijadas por `tests/marketing-copilot-agente.test.ts`. **El modelo no se corrió**: los tests prueban lo que llega al system, no lo que contesta; falta probarlo en vivo (ver «Para el Cerebro»). |
| 2. Primera entrada | Hecha. `lib/media-buyer/copiloto.ts` (reglas y charla, puro, 14 tests en `tests/marketing-copilot-reglas.test.ts`), `app/ads-manager/PrimeraEntrada.tsx` (el marco del arranque del Media Buyer con otra charla), guardado por negocio en `app_settings` (`marketing-copilot.perfil`, sin migración), op `copiloto` de `/api/media-buyer` y dos operaciones de la API de MaKo. Se ve sólo si el negocio nunca operó el Media Buyer (sin corrida ni decisiones) y no terminó la charla; `?estrategia=1` la reabre. Capturas en `docs/marketing-copilot/` (01 a 06, a 1440 y 390; banco: `scripts/banco-copilot/`). |
| 1. Nombre y lugar | Hecha. Rótulo «Marketing CoPilot», ícono `copiloto`; key `ads-manager` y ruta `/ads-manager` sin tocar. Web Generator en Create (escritorio y móvil). |

## Autocrítica
(se completa por tanda)

## Para el Cerebro
- Probar en el ws 3 (nunca el 1) las seis conversaciones de `docs/marketing-copilot/conversaciones.md` contra el chat de la tab, y mirar si cada «Debe» y cada «No debe» se cumple. Es lo único que los tests no cubren.
- Si la tab no llega a `desde.tab` con el nombre «Marketing CoPilot» (un chat viejo abierto antes del deploy), el chat cae al contexto del Ops Center: recargar la página.
- Nada que correr en producción en la tanda 1.
