# Marketing CoPilot: qué ve cada camino (6/11/2026)

Pedido de Martín: «si ahora vamos a hacer diferentes funnels, y al final tú me entregas la misma pantalla que hoy en día, que tiene una
tag que se llama campañas, es decir, campañas para un funnel orgánico, no tiene sentido. Entonces, ahí ver cómo lo colocarías, si lo
sacarías, si lo meterías en otro lado, cómo sería esa parte, si directamente sería otra lógica».

## La decisión

**«Campañas» sólo existe donde hay una cuenta de anuncios que mirar.** Es otra lógica, no la misma pantalla con una pestaña de menos:
con anuncios, la pantalla sigue siendo el Media Buyer (mira la cuenta una vez por día y deja decisiones); sin anuncios no hay cuenta ni
decisiones, y lo que hay es *qué hacer esta semana, dónde, y qué medir*. Todo lo que se hace sale a la pantalla de MaKo donde ya existe
(Calendario, Copywriting, Carruseles, Lead Magnet, Web Generator, Competitor Spy): se enlaza, no se rehace.

Lo decide `lib/media-buyer/copiloto.ts → conCampanas / seccionesDe`, con tests (`tests/marketing-copilot-reglas.test.ts`).

## Qué ve cada camino

| Funnel | ¿Campañas? | Secciones | Qué hay en cada una |
|---|---|---|---|
| Anuncios a un VSL con llamada | Sí, siempre | Hoy · Plan · Campañas · Biblioteca | Hoy: lo que hizo el Media Buyer. Plan: la propuesta aceptada y sus pasos. Campañas: la cuenta por producto. Biblioteca: los mejores anuncios |
| Anuncios a mensajes | Sí | Hoy · Plan · Campañas · Biblioteca | Igual |
| Anuncios a un formulario | Sí | Hoy · Plan · Campañas · Biblioteca | Igual |
| Anuncios a compra directa | Sí | Hoy · Plan · Campañas · Biblioteca | Igual |
| Webinar | Sólo si puso presupuesto | Con plata: como los de anuncios. Sin plata: Esta semana · Plan · Qué medir | Esta semana: la página de registro (Web Generator), los correos (Copywriting) y la fecha en vivo (Calendario) |
| Lead magnets | Sólo si puso presupuesto | Igual que el webinar | Esta semana: el regalo (Lead Magnet), la página (Web Generator) y la secuencia de correos (Copywriting) |
| YouTube | Nunca | Esta semana · Plan · Qué medir | Esta semana: N videos con su guion (Copywriting), un próximo paso en cada uno (Lead Magnet) y el Calendario |
| Orgánico en Instagram | Nunca | Esta semana · Plan · Qué medir | Esta semana: el reparto de reels y carruseles que cabe en el ritmo que eligió, las stories y el Calendario. Si el objetivo es viralidad pesan los reels; si es ventas, los carruseles y los mensajes |
| Sin funnel elegido (un negocio de antes) | Sí | Hoy · Campañas · Biblioteca | Lo de siempre: su pantalla no cambia |

«Qué medir» lleva el número que manda de cada camino: costo por llamada calificada en anuncios; conversaciones calificadas por semana en
orgánico de ventas; gente nueva en orgánico de viralidad; el próximo paso de cada video en YouTube; agendas tras el webinar. Las cifras de
referencia (webinar) dicen que son de otros negocios y no una meta.

## Por qué no las otras opciones

- **Dejar la pestaña y que salga vacía:** un cartel «no hay campañas» en un funnel orgánico dice que algo falta cuando no falta nada.
- **Esconder sólo la pestaña y dejar Hoy:** Hoy es la lista de decisiones del Media Buyer sobre la cuenta de Meta. Sin cuenta, o está vacía o
  pide conectar Facebook a quien nunca va a anunciar.
- **Meter el plan de contenido dentro de Campañas:** mezcla dos cosas que no se parecen (plata en una cuenta, y horas de una persona).

## La primera entrada

Quien nunca operó el Media Buyer (sin corrida, sin decisiones, sin piloto) y no terminó la charla ve SÓLO la charla (`PrimeraEntrada.tsx`),
sin otras tabs. Quien ya operaba no la ve: su pantalla no cambia. `?estrategia=1` la reabre en la propuesta («Cambiar mi estrategia» en Plan).

## Lo que no se hizo

- **El teléfono con anuncios no tiene la sección Plan:** `app/m/ads/MediaBuyerM.tsx` sigue con su pantalla de siempre; sólo el funnel sin
  anuncios y la primera entrada tienen su versión de teléfono. Se llega a «Cambiar mi estrategia» desde la computadora.
- **«Esta semana» no marca lo hecho:** son atajos a las pantallas, sin estado guardado. Si Martín lo quiere con checks, hay que guardar por
  semana (no hay migración: puede ir en `app_settings`).
