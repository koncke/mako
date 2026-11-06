# Relevo — Marketing CoPilot (nube, 6/11/2026)

Pedido de Martín (6/11/2026): la tab Ads Manager pasa a ser «Marketing CoPilot»: un copiloto que propone y discute el funnel (anuncios, webinar, lead magnets, YouTube, orgánico), no sólo campañas.

## Estado por tanda

| Tanda | Estado |
|---|---|
| 2. Primera entrada | Hecha. `lib/media-buyer/copiloto.ts` (reglas y charla, puro, 14 tests en `tests/marketing-copilot-reglas.test.ts`), `app/ads-manager/PrimeraEntrada.tsx` (el marco del arranque del Media Buyer con otra charla), guardado por negocio en `app_settings` (`marketing-copilot.perfil`, sin migración), op `copiloto` de `/api/media-buyer` y dos operaciones de la API de MaKo. Se ve sólo si el negocio nunca operó el Media Buyer (sin corrida ni decisiones) y no terminó la charla; `?estrategia=1` la reabre. Capturas en `docs/marketing-copilot/` (01 a 06, a 1440 y 390; banco: `scripts/banco-copilot/`). |
| 1. Nombre y lugar | Hecha. Rótulo «Marketing CoPilot», ícono `copiloto`; key `ads-manager` y ruta `/ads-manager` sin tocar. Web Generator en Create (escritorio y móvil). |

## Autocrítica
(se completa por tanda)

## Para el Cerebro
- Nada que correr en producción en la tanda 1.
