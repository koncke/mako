# Relevo — Media Buyer (la tab /ads-manager)

**Escrito el 25/10/2026 por el chat «Media Buyer» (cuenta 5, `claude5`).** Rama `mediabuyer-2510` (worktree
`C:/dev/wt-mediabuyer-2510`). Lo sube el Cerebro en el tren; este chat no pushea.

## Qué es

Desde el 25/10/2026 `/ads-manager` es el **Media Buyer de MaKo**: un agente que mira la cuenta de Meta del negocio una vez
por día y deja DECISIONES (subir o bajar un presupuesto, pausar, prender, variaciones del anuncio ganador), cada una con
su porqué, la tabla de números que la disparó y su deshacer. Las lanza una persona («propone») o el piloto automático
(lo prende cada negocio). Reemplaza a la réplica de Meta Ads Manager, que se borró con sus tests.

- **La referencia** es Madgicx · AI Marketer. Capturas y mapa pantalla por pantalla: `docs/media-buyer/referencia.md`.
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
| La pantalla y el teléfono | `app/ads-manager/MediaBuyer.tsx` · `mb.css` · `mb-modelo.ts` · `app/m/ads/MediaBuyerM.tsx` |
| La API de MaKo (ver, lanzar, deshacer, descartar, analizar, modo, topes) | `lib/api-mako/areas/ads.def.ts` / `.run.ts` |
| Subir creativos nuevos a un conjunto (por Zernio) | `lib/media-buyer/subir.ts` · `creativos.ts` (puro) · el modal en `MediaBuyer.tsx` |
| Los hooks de un video ganador como guiones del Video Generator | `lib/media-buyer/hooks-video.ts` · `hooks-guion.ts` (puro) |
| Lo que trae cada plan (Esencial: 2 por día, sin piloto) | `lib/media-buyer/plan.ts` (puro) · `cupoDe` en `store.ts` · el número en `lib/topes-plan.ts` (de Planes) |

## Estado (25/10/2026)

- **Hecho y en la rama:** el motor y sus tests (rotos a propósito antes de darlos por buenos), los topes, el ejecutor, la
  corrida y el cron, la pantalla copiada de Madgicx (escritorio y teléfono), el arranque de tres pasos, las variaciones de
  texto y de hook (texto), la API de MaKo, la bitácora de `/admin/dev` y la cosecha.
- **Apagado por defecto en TODOS los negocios.** Nadie tiene el piloto automático: lo prende cada negocio.
- **MaKo Esencial (el Cerebro, 25/10):** «propone», 2 recomendaciones por día, sin piloto. Pro, entero. Sólo al Esencial que
  MaKo cobra por la pasarela. Lo fija `tests/media-buyer-plan.test.ts`. ⚠️ Hasta que Planes saque 'ads-manager' de
  `NAV_SOLO_PRO`, ese Esencial ni entra a la tab.

## Lo que falta, en orden

1. **La migración 0332** (número confirmado por el Cerebro; la revisa él antes de aplicarla): sin aplicar en producción. ⚠️ Va ANTES del deploy: el reset del
   cliente de prueba borra de estas tablas. Hasta que esté, la pantalla dice que el registro no está y nada se lanza.
2. **Conectar la cuenta publicitaria de MaKo a Zernio — ES DE MARTÍN (un clic de permisos en Facebook).** La Zernio de la
   plataforma tiene cero cuentas conectadas (medido el 25/10). El link se genera con la clave de la plataforma:
   `GET https://zernio.com/api/v1/connect/facebook/ads?profileId=6a7fdeaab2a8a0408e6c9942&loginMode=business&permissionLevel=advertise&adAccountId=act_1426493815659364&redirect_url=…`
   (contesta la ventana de Facebook). Con eso, en el Media Buyer de MaKo (ws9) poner la cuenta `act_1426493815659364` en
   Ajustes → Cuenta publicitaria (no tiene `META_AD_ACCOUNT_ID`).
   ⚠️ La pieza única de conectar (`<ConectarViaZernio>`) usa la clave DEL NEGOCIO: el ws9 no tiene una propia (la de la
   plataforma no se puede guardar como suya, `KeyDePlataformaError`), así que para la cuenta de MaKo el link sale por
   script, no por el botón.
3. **La medición de Zernio, ya escrita:** `scripts/media-buyer-medir-zernio.mts` (conectar · estado · crear --si · editar --si ·
   borrar --si), sólo sobre la cuenta de MaKo. `conectar` imprime el link de Facebook (vence a los 30 min: pedirlo con Martín
   enfrente).
4. **La prueba real, en la cuenta de MaKo:** prender el Media Buyer en «propone», «Analizar ahora», lanzar UNA decisión de
   estado sobre un anuncio en pausa de prueba, ver que Meta la refleja, deshacerla. Después, una variación de texto. La
   cuenta de MaKo no tiene medio de pago: crear anuncios en pausa se puede; que entreguen, no.
5. **Lo que quedó sin hacer:** filmar SOLO el hook nuevo (depende del puente a Flow, que corre en el navegador del cliente):
   hoy «Filmarlos en Video Generator» deja cada hook + el cuerpo del ganador como guion en la celda «Hooks del Media Buyer»
   y se filma desde ahí; `validate_only` por el token de Meta; el Stop Loss intradía; la API de MaKo para «subir creativos»
   y «hooks al video» (piden archivos o la pantalla); y borrar las rutas viejas de `app/api/ads-manager/*` que sólo usaba la
   vista borrada (`creative-signurl` SÍ se usa: la subida del Media Buyer).
6. **El nombre en la barra** sigue «Ads Manager» (`app/_components/nav.ts` es del chat Sidebar): si Martín quiere «Media
   Buyer», se lo pide el Cerebro a ese chat.

## Rojos de main que no son de esta rama

`tests/zernio-sin-respaldo.test.ts` (la clave de la plataforma para el ws de la plataforma en `lib/zernio-ads.ts`, que ya
estaba en main) y dos de `tests/operaciones.test.ts` (Ops Center). Medidos el 25/10 con la rama; las líneas que marcan
son de main.
