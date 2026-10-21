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

## Ops Center: editar videos desde el chat (20/10/2026)

*Rama `video-ops-center`, worktree `C:/dev/wt-video-ops`. El plan: `docs/ops-center-principal.md`
(§2.4 a 2.7, §4.10 y §5) y `docs/ops-center-principal/mapa-video-imagen.md`.*

**Ola 1, hecho:** la 1.14 del lado del editor (el `?propuesta=` abre ESA propuesta) y la 1.15 (las
recetas de video, Generator, AI Avatar e imagen en `lib/doer-recetas.ts`). Las frases para la 1.2
están en la carpeta compartida del Cerebro (`frases-video-imagen-1-2.json`), pasadas a MaKo Alert.

**Ola 1, falta:**
1. **La tarjeta G4 «Original | Modificado» en el hilo**, con «Aceptar en el editor». La API ya
   devuelve el link y las filas (`extra.cambios`, `lib/api-mako/areas/video.run.ts`); falta que el
   turno lo pase como bloque. La forma del bloque es de la 1.7 (Ops Center 3): se le preguntó el
   20/10. Mirarlo de punta a punta en el navegador con las migraciones 0298 a 0302 aplicadas.
2. **«cortá el principio del video» llega a su herramienta** cuando la 1.2 (MaKo Alert) esté: el
   `todo` de `tests/doer-recetas-video-imagen.test.ts` pasa a ser un test común.

**Ola 2 (del mapa):**
- **2.22** Crear y abrir proyectos desde el chat: `abrir_en_editor_video` (anuncio, toma o montaje,
  por `/video-editor/nuevo?desde=`) y `proyecto_nuevo_video` (vacío o con plantilla y huecos).
  «armame un video con la plantilla de testimonio» termina en un proyecto con los textos dictados.
- **2.24** Los bloques de video e imagen: galería de proyectos y diseños, reproductor 9:16, tarjeta
  de costo, tarjeta del puente Flow, antes y después con miniatura, mini línea de tiempo. Salen de
  un campo estructurado y se ven igual en la computadora y en Android.
- **2.25** Exportar y descargar: el botón abre el editor con la exportación lista (`?exportar=`).
- **2.26** El Video Generator por el chat: el plan de tomas, editar una toma, el escenario, filmar
  UNA toma con la tarjeta de costo, releer el saldo. Nunca más de una toma por confirmación.

**Decisiones D7 (de Martín, las pregunta Debate):** material en la nube y render en el servidor, o
aceptar y exportar en el editor embebido (a); confirmar el gasto de Flow por toma o por anuncio (c);
el Image Editor aplica directo o primero el historial (d); audios adjuntos para clonar la voz (e);
Image Generator con Flow (f); música con catálogo propio (g). **La D7b («¿se despliega el worker de
montaje?») ya no hace falta**: desde el 20/10 la cola la atiende un cron de Vercel
(`app/api/cron/montaje`, rama `montaje-cola`), sin worker.
