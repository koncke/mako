# Relevo — chat «Dashboard» (la tab Dashboard y el editor de General)

<sub>Escrito el 17/10/2026 ~10:30 (hora de Argentina) por la cuenta 4 (claude4), desde el chat que hizo el trabajo. Se pisa
en cada relevo. Los anteriores están en el historial: `git log -p -- docs/relevo/dashboard.md`.</sub>

> **Para después del 20/10 (17/10, B5):** «Publicar en Creaciones» desde el ⋮ de la hoja está HECHO y SIN SUBIR en la rama
> `pend-b5-publicar-dash` (`cc07af5ea`). Antes de mergearla: 2 fallos de `tests/api-mako-rest.test.ts` en esa rama, sin
> mirar, y un antes-de-subir. El porqué de cada decisión, en docs/hallazgos-creaciones.md de esa rama.

## Cómo se trabaja acá

- Rama `dashboard-bloques`, worktree `C:/dev/wt-dashboard`. Se MEZCLA origin/main (nunca rebase) y se commitea por ruta
  explícita, con `Claude-Cuenta` pegado a `Co-Authored-By` (también en los merges). ⚠️ Si el merge sale fast-forward no
  hay commit tuyo que enmendar (AGENTS.md, «Nunca `--amend`…»).
- **La punta va al «Cerebro»**, que la sube a main en runs numerados. Este chat no pushea. Las migraciones las numera él.
- Sin `next dev` ni tsc completo (la RAM): `node scripts/tsc-acotado.mjs --rama`. ⚠️ Si tocaste app/dashboard/EditorInforme.tsx,
  entra por arrastre app/conocimientos/Compartir.tsx con dos rojos de `<style jsx>`: no son tuyos (el tsc acotado no carga
  el tipo de styled-jsx); contá los rojos sin ese archivo.
- ⚠️ Un regex escrito por Bash (`node -e`, heredoc) pierde las barras y ejecuta los backticks: los tests se editan con la
  herramienta Edit o con un script en el scratchpad.
- Para probar contra la base sin navegador (sólo leyendo): un script en el scratchpad con
  `node --conditions=react-server --import tsx`, los imports como `file:///C:/dev/wt-dashboard/…` y `runWithWorkspace(ws)`.
- Arnés de capturas FUERA del repo, `C:/Users/marti/arnes-dashboard/` (modos `plantillas`, `galeria`, `crear`, `editar`).
- La barra y el menú del teléfono son del chat «Sidebar»: lo que haya que cambiar ahí se le pasa por SendMessage.

## Dónde está (17/10)

**En main** (runs 81, 83, 84 y 85): los OKR y los KPIs del CRM con uno o varios funnels; «Estilo de la hoja» con ajustes
encima de la plantilla; «Editar con MaKo» con el muñeco de la tab; el cubo del CRM como ícono único de funnel. **Y en el
run 103** (punta 33d11eaae): #876, #872, #857, #858 y Experiments. Los cierres propuestos para el Plan, con su prueba, en
la carpeta de notas del Cerebro (`dashboard-cierres-run103.json`).

**Uno por pedido, en el orden del Cerebro del 17/10 (por impacto: #876, #872, #857, … y Experiments al final;
Experiments ya estaba casi hecho y entró primero). De #859 en adelante, entregados y sin subir:**
- **#876** — el pop-up de un anuncio de Ads Analyst se quedaba sin números: Meta guarda 37 meses y «Todo» le pedía desde
  2020 (#3018). `timeRangeMeta` (lib/meta-rango.ts) en las tres lecturas con período libre (docs/hallazgos-ads.md).
- **#872** — General en el celular con varias hojas: el segmentado de hojas en /m/hoy, con la URL de escritorio
  `/general?hoja=` (docs/hallazgos-mobile.md).
- **#857** — una plantilla entra al instante y se ajusta por detrás; la ajustada reemplaza sólo si nadie la tocó
  (docs/hallazgos-graficos.md).
- **#858** — General vuelve a tener la búsqueda y el filtro de fecha (revierte el 14/10); el período mueve los gráficos,
  no los bloques (docs/hallazgos-graficos.md).
- **#859** — la portada y lo relleno de los bloques de General toman el color de «Estilo de la hoja»
  (docs/hallazgos-graficos.md). Va en un commit DESPUÉS de la punta que ya tiene el Cerebro.
- **#860** — los anuncios ganadores en póster vertical y con ▶ que reproduce el video en la hoja (el `embed_html` del
  video; la vista previa del anuncio no carga sin sesión de Facebook: docs/hallazgos-ads.md). Sin mirar en un navegador.
- **#862** — MaKo en la hoja con dos modos, «Analizar · Editar»; un análisis pedido en Editar no toca la hoja (el código
  descarta los cambios que vienen con `analizar`) y ofrece pasar a Analizar (docs/hallazgos-graficos.md).
- **#886, la mitad del Dashboard** — el mapa de calor lleva «Analizar la estructura →» al diagnóstico del Web Generator
  de esa página (`?analizar=<url>`). La otra mitad (las métricas dentro del diagnóstico) es del chat Web Generator.
- **#896** — `diagnosticar_funnel` de la API de MaKo mide uno o varios funnels (`getFunnelEtapas` con `funnels`); dos con
  etapas distintas no se suman (el ws1 tiene ese caso) y lo de Meta es de toda la cuenta (docs/hallazgos-api-mako.md).
- **La red por bloque** (pedido del Cerebro tras el crash de General en el celular, 6b922f7e3) — cada bloque de General y
  cada gráfico o elemento del editor va adentro de `RedDeBloque` (app/dashboard/RedDeBloque.tsx): uno roto dice «Este
  bloque no cargó» y la hoja sigue. `dibujar` corre ADENTRO de la red (docs/hallazgos-graficos.md). Sin mirar en pantalla.
- **Experiments se retiró y vive en el Dashboard:**
  - «probemos X» en «Editar con MaKo» agrega a la hoja un elemento «Experimento» (app/dashboard/ElementoExperimento.tsx):
    propuesta → «Arrancar» (mide el baseline) → antes/ahora en vivo → «Concluir» (veredicto y aprendizaje de MaKo).
  - El experimento se ata al elemento por `config.elemento`; la ruta es app/api/experimentos/route.ts (puerta `graphics`).
  - /experimentos, /m/experimentos y /analisis redirigen (un link viejo con hipótesis abre el panel con «Probemos: …»).
    Se borraron las sub-tabs, la Retro, el Análisis y la pantalla del teléfono. El «Probarlo» de Offer va al Dashboard
    (en el teléfono se sacó).
  - Lo aprendido: `docs/hallazgos-graficos.md` («Experiments se retiró…» y su «Lo que quedó sin hacer»).

## Lo que falta

- **Del orden del Cerebro (17/10) quedan cabos**: `ver_serie_funnel_semanal` sigue midiendo el funnel principal
  (`getFunnelSeries`, lib/queries.ts, tiene sus propias lecturas y va por `cachedRead`: la clave de caché tendría que llevar
  los funnels); la mitad del Web Generator de #886. El detalle de cada pedido, en C:/dev/auditoria-1610.json por su número.
- **Los «Ya está»**: los del run 103 se escribieron en este chat el 17/10. Faltan los de #859, #860, #862, #886, #896 y la
  red por bloque, cuando el Cerebro confirme que subieron (cada uno con su ruta en el ws3).
- **El chat Sidebar** dejó la key `experimentos` viva (ítem sin fila, sección oculta del teléfono), así que las dos
  redirecciones conservan su puerta. Si la saca, se van esas dos líneas y entra en `RETIRADAS` (tests/tabs-retiradas.test.ts).
  ⚠️ Su rama y la mía cambian tests/analisis-mudada.test.ts: al mezclar, mi versión más su parte de Offer/Analyze. Avisado.
- **Los experimentos de antes, y los que crea la API, no se ven en ninguna pantalla**: falta que «Editar con MaKo» los
  conozca para agregarlos a una hoja (`experimento: { id: N }` ya se guarda).
- **Nada de Experiments se miró en pantalla**. Después del deploy: ws3, /dashboard, «Editar con MaKo» → «Probemos un
  anuncio con testimonio» → «Arrancar».
- **La ficha del CRM puede prender los ajustes del estilo** cuando su op `tema` (lib/ficha/config.ts) los copie (avisado).
- **Los pedidos sueltos fallan en tres casos** (hallazgos-ia, 17/10), en lib/mako-pedidos.ts: pasado al Cerebro.
- **Lo de antes que sigue abierto**: el filtro «Producto» de los LEADS mira sólo la casa; el hilo de «Editar con MaKo» no
  se guarda; `claudePausado` debería decir «Conecta tu Claude»; cinco temas sin mirar por tipo; que Martín decida si se
  borran `PulsoPaginas.tsx` y `ScriptsBrowser`/`GuionesFull`. El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó
  sin hacer».
