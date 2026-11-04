# Relevo — Gurús · 3/11/2026, claude5

Rama `gurus-0311` en `C:/dev/wt-gurus`, **sin pushear** (sube el Cerebro). Con origin/main adentro.

## Hecho (los cinco puntos de Martín)
1. **«Nuevo chat» muestra los gurús**: `GaleriaDeGurus.tsx`, en las cuatro puertas, sin modal.
2. **Hormozi abre su chat ahí mismo**: `queAbreElOfferCoach`, `abrirGuru`. Sin conversación previa ni cambio de ruta.
3. **Contesta con su curso**: `CURSO_DE_REFERENTE` tenía 3 de 22, ahora los 22 (`docs/hallazgos-ops-center.md`). También una
   conversación de Offer, con menos presupuesto.
4. **Su cara y su nombre**: `quien` en `useChatCliente` (burbuja, y de paso el Funnel Coach), fila con `guru`, `HojaDelGuru.tsx`
   en el teléfono, historial debajo de los coaches (`?gurusConCharla=1`).
5. **Su Second Brain**: `SuSecondBrain.tsx`, en el chat del gurú, el Funnel Coach y una conversación de Offer; en el teléfono,
   adentro de la hoja.

## Verificado
Ver el último commit de la rama y el mensaje al Cerebro: ahí está qué corrió y qué no.

## Falta
- **#15** sin tocar: confirmar `f378981ea` en producción antes de nada.
