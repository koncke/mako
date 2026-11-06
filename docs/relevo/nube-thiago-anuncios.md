# Relevo — Lo prometido a la agencia de Thiago: anuncios desde Create, «Guardar en MaKo» y el Media Buyer (6/11/2026, nube)

Lo escribe la sesión de la nube que hizo el trabajo (cuenta `nube`, sesión `cli_bf66b858-af9b-52bd-97de-5d68c180abe6`).
**Esta sesión no puede escribirle al Cerebro:** todo lo que hace falta está acá. La nube no ve producción, la base ni las claves:
nada de esto se probó contra Meta, Zernio, Instagram ni LinkedIn de verdad. Lo de abajo corre con las funciones REALES y dobles
de la base y de los proveedores.

## El pedido

Las promesas de la llamada del 29/10 (docs/promesas/2910-llamada-thiago.md), medidas como faltantes en main el 6/11:

1. «Usar en un anuncio» en los editores (Video, Image, Copywriter) y en AI Avatar, al lado de «Publicar en redes», que lleve la
   pieza a `proponer_crear_campana`; lanzar sigue pidiendo confirmación. «Subir creativos» del Media Buyer acepta un video ya
   generado.
2. «Guardar en MaKo» en la extensión: sobre el perfil abierto de Instagram y de LinkedIn, de a uno, a la vista y con un toque de la
   persona, nunca en segundo plano. Crea el lead en el CRM. Subir la versión del manifest (la publicación la hace el Cerebro).
3. Ads: variar el CTA, hooks de video con el avatar, y pausar el original cuando una variación le gana, con la regla en
   `lib/media-buyer/` y tests que la rompen.

Con dos condiciones: `ZERNIO_ANUNCIOS_PROBADO` sigue en `false` (la pantalla lo dice) y **`app/ads-manager` no se toca** (lo rehace
el chat Marketing CoPilot: lo que haga falta ahí está abajo).

## Lo hecho

| Qué | Dónde |
|---|---|
| **Pausar el original cuando una variación le gana**: el «relevo», dentro de la táctica Ganador. Mira las variaciones LANZADAS (las decisiones aplicadas con `creados` y `anuncioBase`): pasados 7 días, con 3 resultados y 20 % menos de costo por resultado que el original (o el original sin resultados habiendo gastado su objetivo), propone pausar el original. Una vez por original; Revive no lo vuelve a prender. Los tres números se cambian en Automatizaciones (`relevoDias`, `relevoResultados`, `relevoMargenPct`). | `lib/media-buyer/motor.ts` (`relevos`, `previaDeDecision`), `lib/media-buyer/tacticas.ts`, `corrida.ts`, `vigia.ts` |
| **Variar el botón (CTA)**: a las variaciones del ganador se suma una con el mismo texto y otro botón (tabla, sin IA). Sale por Zernio con `cta_type`. | `lib/media-buyer/variacion-boton.ts`, `variaciones.ts`, `ejecutar.ts`, `lib/zernio-ads.ts` |
| **Hooks de video con el avatar**: el AI Avatar ofrece «Hooks ganadores» (los ganchos que el Media Buyer dejó en el Video Generator) para usar de guion. | `lib/media-buyer/hooks-guion.ts` (`hooksParaAvatar`), `app/ai-avatar/actions.ts`, `app/ai-avatar/Estudio.tsx` |
| **«Usar en un anuncio»** en el Copywriter, el Image Editor, el Video Editor y el AI Avatar (el video nuevo y los de antes, de una toma): la pieza va a `/anuncio/nuevo`, que arma la campaña (objetivo, presupuesto, fecha, dónde, texto) y la PROPONE; se confirma en /mako/revisar. Con el aviso de Zernio sin probar. | `lib/anuncio-desde-pieza.ts`, `app/anuncio/nuevo/`, `app/api/anuncio-desde-pieza/route.ts`, `app/_crear/usar-en-anuncio.ts`, los tres editores |
| **`proponer_crear_campana` acepta un archivo o un video de MaKo** (`creativoTipo: 'archivo' | 'generado'`), con el archivo y la ref fijos al revisar. | `lib/api-mako/areas/ads.def.ts`, `ads.run.ts`, `lib/media-buyer/campana.ts` (`datosParaNuevaCampana`) |
| **«Subir creativos» acepta un video que MaKo generó** (`ref` en vez de path) y el anuncio que viene a relevar (`original`), por la API y por `/api/media-buyer` (`subir_preparar` devuelve `generados`). | `lib/media-buyer/subir.ts`, `creativos.ts`, `app/api/media-buyer/route.ts` |
| **«Guardar en MaKo» en la extensión 0.77.0**: el desplegable lo ofrece sobre un perfil de Instagram o LinkedIn; el primer toque lee el perfil y MaKo dice qué entendió y si ya está (sin guardar); «Guardar en mi CRM» crea el lead con el nombre que la persona corrige, su @ o su LinkedIn, su origen (`perfil_instagram` / `perfil_linkedin`) y la foto de Instagram. Sin permisos nuevos. Política de privacidad al 6/11. | `extension/perfil-reglas.js`, `perfil-leer.js`, `popup.js`, `lib/perfil-captura.ts`, `lib/perfil-captura-db.ts`, `app/api/crm/extension/route.ts`, `app/crm/origen-lead.ts`, `lib/leads.ts`, `app/privacidad/extension/page.tsx` |

**Commits:** `97495f3b` (anuncios y Media Buyer) y `39e48790` (la extensión). **Rama:** `punta/thiago-anuncios` (y la de la
sesión, `claude/laughing-meitner-yuqvk9`). **Sin migración.**

**Pruebas** (cada una con sus roturas medidas en la cabecera): `tests/media-buyer-relevo.test.ts` (15),
`tests/media-buyer-variacion-boton.test.ts` (9), `tests/media-buyer-subir-generado.test.ts` (6), `tests/usar-en-anuncio.test.ts` (9),
`tests/perfil-extension.test.ts` (11). Se ajustaron `tests/media-buyer-subir-api.test.ts` (los parámetros fijos suman `original`),
`tests/spy-captura-pagina.test.ts` (pedía la versión EXACTA 0.76.0; ahora que no sea más vieja) y `tests/wa-fichas-extension.test.ts`
(la fecha de la política).

## Para el chat Marketing CoPilot (la pantalla de `app/ads-manager`, que esta sesión no tocó)

1. **«Subir creativos»**: listar los `generados` que ya devuelve `subir_preparar` y mandar su `ref` (y, si el creativo viene a
   relevar un anuncio, el `original`). Hoy la pantalla sólo sube archivos del disco: el video de MaKo sale sólo por la API.
2. **La decisión del relevo** es `tactica: 'ganador'` + `tipo: 'pausar'`: `rotuloDe` y `POR_TACTICA` (`mb-modelo.ts`) la pintan
   como «Anuncio ganador» / «probar textos nuevos». Necesita su rótulo («Pausar el original»). No se sumó una táctica nueva
   porque `Record<Tactica, …>` de esa pantalla no compilaba.
3. **`Autopilot.tsx` no pinta `v.cta`** de una variación: la del botón se distingue por su `gancho` («Mismo texto, botón X»).
4. **Automatizaciones** ya muestra los tres números nuevos del Ganador (salen de `TACTICAS`): conviene mirarlos en pantalla.

## Lo que falta verificar (en producción, después del deploy diario)

1. **La extensión en el Chrome de Martín**, con un perfil de Instagram y uno de LinkedIn: que el botón aparezca, que el nombre
   salga bien (sale del título y de las etiquetas «og:»; si no, el campo queda vacío y se escribe a mano) y que el lead nazca
   con su foto. Nadie lo vio en una página real. Después, publicar la 0.77.0 (lo hace el Cerebro).
2. **«Usar en un anuncio»** en el ws 3: exportar en el Image Editor, abrir `/anuncio/nuevo`, proponer y ver la propuesta en
   /mako/revisar. Confirmarla publica en Meta por Zernio, y eso sigue detrás de la prueba de Martín (`ZERNIO_ANUNCIOS_PROBADO`).
3. **El relevo** necesita una variación lanzada hace 7 días con resultados: la primera vez que salga, mirar que el original
   pausado sea el correcto (el título lo nombra).

## Lo que espera una decisión de Martín

- El tutorial de LinkedIn para importar el Connections.csv (prometido junto con el botón): no se escribió.
- LinkedIn como canal de contacto del CRM (hoy no lo es: el lead nace sin email ni teléfono).
