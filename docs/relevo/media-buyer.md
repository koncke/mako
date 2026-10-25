# Relevo — Media Buyer (la tab /ads-manager)

**Escrito el 25/10/2026 por el chat «Media Buyer» (cuenta 5, `claude5`).** Rama `mediabuyer-2510` (worktree
`C:/dev/wt-mediabuyer-2510`). Lo sube el Cerebro en el tren; este chat no pushea.

## Qué es

Desde el 25/10/2026 `/ads-manager` es el **Media Buyer de MaKo**: un agente que mira la cuenta de Meta del negocio una vez
por día y deja DECISIONES (subir o bajar un presupuesto, pausar, prender, variaciones del anuncio ganador), cada una con
su porqué, la tabla de números que la disparó y su deshacer. Las lanza una persona («propone») o el piloto automático
(lo prende cada negocio). Reemplaza a la réplica de Meta Ads Manager, que se borró con sus tests.

- **La referencia** es Madgicx · AI Marketer. Capturas y mapa pantalla por pantalla: `docs/media-buyer/referencia.md`.
  ⚠️ **Copiar de la app por dentro (`referencias/madgicx/vivo-*.jpg`), NO de la imagen de la landing**: son pantallas
  distintas (la app es clara, con pestañas y «Ver detalles»).
  **Desde el 25/10:** la estructura, la limpieza, las medidas (tomadas de la captura) y TODAS las funciones de Madgicx;
  los colores, los de MaKo (`app/ads-manager/mb-paleta.css`, todo token de la casa). Antes de tocar la pantalla, mirar la
  captura de Madgicx: lo que MaKo suma va dentro de un lugar que Madgicx ya tiene (la tuerca, «Pedirle más a MaKo», el
  saludo con globos), nunca como un botón o un cartel más.
- **Lo que se mide y lo que costó:** `docs/hallazgos-ads.md` → «El Media Buyer reemplaza al Ads Manager».
- **El encuadre de seguridad** viene del Autopilot del 13-14/10: `docs/diseno-ads-autopilot.md`.

## Dónde vive

| Qué | Archivo |
|---|---|
| Las tácticas (Surf, Sunsetting, Stop Loss, Revive, Calidad, Ganador) — puro, con test | `lib/media-buyer/motor.ts` |
| Los topes (subida por día, presupuesto máximo, interruptor) — puro, con test | `lib/media-buyer/topes.ts` |
| Leer la cuenta (Meta o Zernio) y el CRM por cohorte | `lib/media-buyer/datos.ts` · `senales.ts` (puro) |
| Lanzar y deshacer (lectura en vivo, topes, reclamo antes de escribir) | `lib/media-buyer/ejecutar.ts` |
| Una corrida (cron 14:30 UTC, «Analizar ahora», la API) | `lib/media-buyer/corrida.ts` · `app/api/cron/media-buyer/route.ts` |
| Variaciones con la IA del negocio | `lib/media-buyer/variaciones.ts` · `variaciones-prompt.ts` (puro) |
| Config y registro (tablas de la 0332) | `lib/media-buyer/store.ts` · `supabase/migrations/0332_media_buyer.sql` |
| Lo que escribe por Zernio | `lib/zernio-ads.ts` (la parte del 25/10) |
| La pantalla y el teléfono | `app/ads-manager/MediaBuyer.tsx` · `mb.css` · `mb-paleta.css` (los colores de Madgicx) · `mb-modelo.ts` · `app/m/ads/MediaBuyerM.tsx` |
| La API de MaKo (ver, lanzar, deshacer, descartar, analizar, modo, topes) | `lib/api-mako/areas/ads.def.ts` / `.run.ts` |
| Subir creativos nuevos a un conjunto (por Zernio) | `lib/media-buyer/subir.ts` · `creativos.ts` (puro) · el modal en `MediaBuyer.tsx` |
| Los hooks de un video ganador como guiones del Video Generator | `lib/media-buyer/hooks-video.ts` · `hooks-guion.ts` (puro) |
| Los Ajustes (la página «AI Marketer settings») | `app/ads-manager/Ajustes.tsx` (`/ads-manager/ajustes`) |
| Las tácticas como automatizaciones (estado, umbrales, campañas) — puro, con test | `lib/media-buyer/tacticas.ts` · la pantalla `app/ads-manager/Automatizaciones.tsx` (`/ads-manager/automatizaciones`) |
| Lo que trae cada plan (Esencial: 2 por día, sin piloto) | `lib/media-buyer/plan.ts` (puro) · `cupoDe` en `store.ts` · el número en `lib/topes-plan.ts` (de Planes) |

## Estado (25/10/2026)

- **Hecho y en la rama:** el motor y sus tests (rotos a propósito antes de darlos por buenos), los topes, el ejecutor, la
  corrida y el cron, la pantalla copiada de Madgicx (escritorio y teléfono), el arranque de tres pasos, las variaciones de
  texto y de hook (texto), la API de MaKo, la bitácora de `/admin/dev` y la cosecha.
- **Apagado por defecto en TODOS los negocios.** Nadie tiene el piloto automático: lo prende cada negocio.
- **Automatizaciones (25/10, el «Automation Overview» de Madgicx):** cada táctica apagada / propone / automática, con sus
  umbrales (el recomendado es el que el motor usó siempre) y las campañas que cubre. El modo general de la tuerca es el
  valor de las que no eligieron otro. El piloto lanza SÓLO lo de las tácticas automáticas, y una sola puerta niega
  «automática» sin plan (`guardarConfig`). En la API: `ver_automatizaciones_media_buyer` y `automatizacion_media_buyer`.
- **MaKo Esencial (el Cerebro, 25/10):** «propone», 2 recomendaciones por día, sin piloto. Pro, entero. Sólo al Esencial que
  MaKo cobra por la pasarela. Lo fija `tests/media-buyer-plan.test.ts`. ⚠️ Hasta que Planes saque 'ads-manager' de
  `NAV_SOLO_PRO`, ese Esencial ni entra a la tab.

## Lo que falta, en orden

1. **Hecho el 25/10/2026:** la 0332 aplicada en producción (el Cerebro, con `tacticas`); la cuenta de MaKo conectada a
   Zernio (cuenta de Zernio `6ade25185b6c93612b7cc6a1`); **la medición que escribe**: una decisión real lanzada por Zernio,
   recortada por el tope, leída en Meta y deshecha (`docs/hallazgos-ads.md` → «La medición que escribe, en la cuenta de
   MaKo»). El Media Buyer de MaKo (ws9) quedó **prendido en «propone»** con `act_1426493815659364` en Ajustes. Sin piloto.
2. **Medir lo del ANUNCIO — ES DE MARTÍN: cargar un método de pago en la cuenta de MaKo.** Sin él Meta no deja crear un
   anuncio, ni en pausa (subcode 1359188). Con el pago cargado: `crear --si` (todo en pausa), `editar --si` (prender, pausar
   y una variación de texto), `borrar --si`, con `scripts/media-buyer-medir-zernio.mts`. El script pide `--si` en cada
   escritura y guarda su estado fuera del repo (`C:/dev/cerebro-herramientas/media-buyer-prueba.json`).
   ⚠️ Prender o pausar una campaña SIN anuncios no se puede por Zernio (404; el endpoint no acepta `accountId`): con un
   anuncio adentro sí.
3. **Lo que quedó sin hacer:** filmar SOLO el hook nuevo (depende del puente a Flow, que corre en el navegador del cliente):
   hoy «Filmarlos en Video Generator» deja cada hook + el cuerpo del ganador como guion en la celda «Hooks del Media Buyer»
   y se filma desde ahí; `validate_only` por el token de Meta; el Stop Loss intradía; la API de MaKo para «subir creativos»
   (los archivos los sube el navegador al staging: anotado en `FALTA` de `tests/media-buyer-api.test.ts`); y borrar las rutas viejas de `app/api/ads-manager/*` que sólo usaba la
   vista borrada (`creative-signurl` SÍ se usa: la subida del Media Buyer).
4. **El nombre en la barra** sigue «Ads Manager» (`app/_components/nav.ts` es del chat Sidebar): si Martín quiere «Media
   Buyer», se lo pide el Cerebro a ese chat.

## Rojos de main que no son de esta rama

`tests/zernio-sin-respaldo.test.ts` (la clave de la plataforma para el ws de la plataforma en `lib/zernio-ads.ts`, que ya
estaba en main) y dos de `tests/operaciones.test.ts` (Ops Center). Medidos el 25/10 con la rama; las líneas que marcan
son de main.
