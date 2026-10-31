# Relevo — Video Generator (el puente a Google Flow)

## El estudio copiado de Arcads (27/10/2026, sesión en la nube) — LEER PRIMERO

*Etiqueta `nube/video-generator-2710` (sin rama: la integra «Cerebro › Integración»). Pedido de Martín, por el Cerebro:
«implementar Video Generator, que nos quedó a medias... Tiene una cantidad de pestañas absurdas, el diseño, que se parezca a
una app que tomemos de referencia». El porqué y las trampas: docs/hallazgos-generativa.md → «El estudio de video copiado de
Arcads».*

**Hecho (con test, cada uno probado rompiéndolo: 19 tests, 17 roturas):**
- `/video-generator` es UN estudio de tres columnas (`app/video-generator/estudio/`): los anuncios a la izquierda, el anuncio
  en el centro, MaKo a la derecha. Abrir o crear un anuncio no cambia de ruta (`?plan=`, con el `?ws=`).
- El anuncio nuevo es una pantalla: guion, formato, lugar y un botón. Si el lugar se eligió al crear, el wizard no lo vuelve a
  preguntar (`lugarEnElAlta`).
- El chat es el de la app (como el del Second Brain), una conversación por persona; en el Ops Center sale en «Video Generator».
- 21 operaciones nuevas en la API (`lib/api-mako/areas/video-estudio.def.ts` y `.run.ts`): cada botón se puede pedir por el
  chat, con la misma acción que el botón. El inventario botón ↔ operación: `app/video-generator/estudio/inventario.ts`.
- Los colores son los tokens de MaKo (sin el negro forzado de Flow), en la computadora y en el teléfono.

**Para probar en vivo (en la PC de Martín, en el ws3, nunca en el ws1).** Antes: la tab del ws3 con su onboarding hecho, la
extensión 0.74 conectada y una pestaña de Google Flow abierta dentro de un proyecto.
1. Abrir `/video-generator?ws=3`. Se ven las tres columnas. Achicar la ventana: debajo de 1180 px el chat pasa a un botón
   «MaKo»; debajo de 760 px, los anuncios pasan a «Tus anuncios». Cambiar claro/oscuro con el interruptor de la barra.
2. «Nuevo anuncio»: elegir un guion (o «Pegar un guion»), un formato y un lugar → «Generar anuncio». Esperado: el anuncio
   aparece en «En curso», el centro abre en el escenario 1 (sin preguntar el lugar) y la URL suma `?plan=…`, sin recargar.
3. Tocar otro anuncio de la barra y volver a «Nuevo anuncio»: la ruta no cambia y el `?ws=3` sigue.
4. En el chat, con un anuncio abierto: «¿En qué anda este anuncio?» (contesta sin tarjeta) y «Reescribe la toma 1 más corta»
   (tarjeta → «Sí» → el centro muestra la toma nueva sin recargar).
5. «Genera la imagen del escenario 1» → tarjeta → la imagen llega de Flow (0 créditos). «Aprueba el escenario 1».
6. «Filma la toma 1»: MaKo deja el link a la pantalla de confirmar, con lo que cuesta y lo que queda. Confirmar UNA vez:
   la toma pasa a «Filmando…» (≈12 créditos). Pedirla otra vez tiene que contestar que ya se está filmando.
7. Con el anuncio nuevo abierto: «Arma un anuncio con mi último guion en <un formato>» → tarjeta → «Sí» → el anuncio nuevo
   se abre solo en el centro.
8. En el Ops Center (`/second-brain?ws=3`), la conversación sale en el grupo «Video Generator».

**Lo que falta, con su archivo:**
- Los escenarios y las tomas siguen siendo una pantalla por escenario y por toma dentro del anuncio abierto
  (`WizardAnuncio.tsx`, 3.200 líneas): juntarlos en una vista de línea de tiempo como la de Arcads es el siguiente corte.
- Por el chat no se puede subir un archivo (un Word o PDF con el guion, una imagen propia de escenario): motivo escrito en
  el inventario. El texto pegado y un link sí.
- En el teléfono, `/m/video` sigue siendo de sólo mirar; las operaciones se le pueden pedir al chat de MaKo del teléfono.
- Medir en vivo lo de arriba: la nube no tiene la base ni el puente.

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
1. **La tarjeta G4 «Original | Modificado» en el hilo**, con «Aceptar en el editor». La API ya la
   devuelve armada en `extra.bloque` (`lib/editor-video/propuesta-bloque.ts`, forma del G4 de la
   rama ola1, probada contra su `sanearBloque`). Falta que el turno la cuelgue del mensaje de MaKo
   y la dibuje al llegar: es la 1.8 de Ops Center 3. Mirarlo de punta a punta en el navegador con
   las migraciones 0298 a 0302 aplicadas.
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
