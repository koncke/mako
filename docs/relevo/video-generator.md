# Relevo — Video Generator (el puente a Google Flow)

*17/10/2026, cuenta 4 (claude4). Rama `video-flow-ui`, worktree `C:/dev/wt-flow-ui`.*

## Dónde quedó

La extensión **0.69.0** genera apretando los botones reales de Flow en la pestaña del cliente
(motor por interfaz) en vez de repetir pedidos de BOQ aprendidos. La extensión **no se depreca**:
es lo único que corre en el navegador de cada cliente con su cuenta; flow-mcp sirve para una PC
con Claude, no para la app. El porqué y las trampas: `docs/hallazgos-generativa.md` → «El motor por
interfaz reemplaza al replay de BOQ».

Hecho y probado por test (11 tests nuevos, cada guarda rota a propósito): el clic en «Start
generation» sale una sola vez y con `salio` escrito antes; un trabajo pagado nunca se re-aprieta;
se entrega el video nuevo y no el último terminado; el tope de créditos; el route renueva los
trabajos en curso para que el rescate de 10 min no los reparta de nuevo.

## Lo que falta (en este orden)

1. **Medir en vivo, sin gastar**: en el Chrome de Martín, con la extensión desempaquetada al día
   (`node scripts/sync-extension-local.mjs` desde este worktree, recargar la extensión y la
   pestaña de Flow dentro de un proyecto), correr la sonda. Desde la consola del service worker:
   `chrome.tabs.query({url:'https://flow.google.com/*'}, t => chrome.tabs.sendMessage(t[0].id, {tipo:'INTERFAZ_SONDA'}, console.log))`.
   Mirar: `rotulos` (cada uno ≥ 1), `opciones` del selector con `data-media-id`, `inputsArchivo`.
2. **Una imagen** desde el Video Generator (0 créditos): sale con la cara y se ve en MaKo.
3. **Un clip** (≈ 12 créditos, Omni 8 s 720p): sale con la cara de la escena y se ve en MaKo.
4. Si la cara guardada no está en el proyecto (`SIN_REFERENCIA`): que se vuelva a subir sola
   (`caraEnFlow` en `app/video-generator/video-action.ts`).

El server sólo manda pedidos de interfaz a extensiones ≥ 0.69.0: Mauricio sigue en el camino viejo
hasta que actualice. No hay migración.
