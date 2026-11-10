# Video Editor de punta a punta — 10/11/2026

Pedido de Martín (10/11, noche): probar la tab «Video Editor» como la usaría cada persona y arreglar lo roto. Lo probó el
chat «Video Editor» (claude4) en producción (`hola-mako.com`, despliegue 9818c63cb) en dos tandas:

- **Tarde, en Chrome** (ws9, el negocio de Martín, que es el que tiene IA): proyecto «1110», dos clips de teléfono de 24 fps con voz.
- **Noche, en el navegador de la app**: ws3 («Cliente de Prueba», sin IA) y ws9, proyecto «1110» (otro), a 1440 y a 375 px.

Lo arreglado vive en `punta/video-editor-1011`. Los lotes 1 y 2 ya están en main y salen con el despliegue del 11/11 a las
08:05 UTC; el lote 3 está en la punta. Las capturas están en [video-editor-10-11/](video-editor-10-11/).

**Resultado:** 38 casos. Pasan 20. Fallaban 12: arreglé 10 y 2 quedan sin hacer (casos 3 y 33). Hay 3 revisados por código
o por una decisión de producto, 2 que no se pudieron medir y 1 mejora (caso 38); y en dos casos que pasan (29 y 35) también
anoto una mejora.

## Los casos

| # | Caso | Resultado | Captura |
|---|------|-----------|---------|
| 1 | Portada «Encuentra tu siguiente OUTLIER» | Pasa | — |
| 2 | «Crear desde cero»: plantillas, «Replicar un outlier» | Pasa | — |
| 3 | La lista de proyectos en otro navegador | **Falla, sin hacer**: dice «Todavía no hay ninguno» y ws9 tiene 6 en la base. El proyecto vive en el navegador donde se editó | 01 |
| 4 | Plantilla «Reel o TikTok» → editor | Pasa (~11 s en abrir) | — |
| 5 | Importar y «+» de la miniatura a la línea de tiempo | Pasa | — |
| 6 | La regla con clips de 24 fps | **Arreglado (lote 1)**: decía «15f, 6f, 21f…» y nunca un segundo | 02 |
| 7 | «Sí, en el feed» (MaKo propone subtítulos) | **Arreglado (lote 1)**: ~2 min sin nada en el chat; el progreso estaba sólo en el panel | 03, 04 |
| 8 | El % del panel de Subtítulos mientras genera | **Arreglado (lote 1)**: «Generando subtítulos… 0…» cortaba el número | 04 |
| 9 | Subtítulos automáticos | Pasa (~2 min la primera vez) | — |
| 10 | «Los subtítulos en amarillo y en Bebas Neue» | Pasa: una tarjeta, vuelve a partir los renglones (arreglo del 9/11) | 06 |
| 11 | El ícono de los mensajes del chat | **Arreglado (lote 1)**: era la criatura «Video Editor» (triángulo rosa), no la estrella de MaKo | 05 |
| 12 | «sí, hazlo» y «dale» escritos | Pasan (arreglo del 9/11) | — |
| 13 | «Poné todo el video un poco más rápido» | **Arreglado (lote 1)**: los subtítulos se corrían en bloque sin reescalarse (2 s de negro con texto al final, frases 1,3 s tarde) y MaKo decía «se ajustan solos» | 07 |
| 14 | Exportar (el modal) | Pasa. No bajé el archivo (pide permiso) | 08 |
| 15 | Modo oscuro (portada y editor) | Pasa | 09 |
| 16 | Edición automática: la lista de agentes | **Arreglado (lote 2)**: el rol se leía «S…», «E…» (8 px) | 10, 11 |
| 17 | Edición automática: los cursores de los agentes | Pasa: van al video y a los paneles, «en vivo · paso 6 de 10» | 12 |
| 18 | Edición automática con la ventana baja (674 px) | **Arreglado (lote 2)**: «Editar con MaKo» tapaba el registro | 13 |
| 19 | Abrir un proyecto con tres pistas | **Arreglado (lote 2)**: cada cabecera al lado de la pista equivocada hasta mover la rueda | 14 |
| 20 | Menú (nuevo, renombrar, eliminar, atajos) | Pasa | — |
| 21 | «Modificar» (nombre, proporción, resolución, fps) | Pasa | — |
| 22 | Publicar («Exportar y publicar» al Calendario) | Pasa el modal. No publiqué | 15 |
| 23 | Pestañas Texto, Efectos, Transiciones, Stickers y Audio | Pasan | — |
| 24 | Audio › Música | Sin biblioteca con licencia, lo dice bien. Es una decisión de producto, derivada el 9/11 | — |
| 25 | «Ver ejemplo» de una plantilla (Testimonio) | Pasa | — |
| 26 | Celular desde Chrome | No medible: la ventana de la extensión no se achica y la app no se deja enmarcar | — |
| 27 | ws3 (negocio sin IA): el chat | Pasa: pide «Instalar MaKo» (así está pensado: sin IA propia, la del cliente por la app) | 16 |
| 28 | «Cortá el video en el segundo 3» | Pasa | — |
| 29 | «Borrá los silencios» | Pasa: 7 de 7, de 21 a 15 s, con el armado en vivo. **Mejora**: la tarjeta repite «Se quita» debajo de «Se quita» y no dice cuánto | 18 |
| 30 | «Poné los subtítulos con el estilo de Hormozi» | **Arreglado (lote 3)**: armaba karaoke y salto sin la plantilla «Hormozi» de la galería (Anton, mayúsculas, contorno) y decía que resaltaba palabras clave sin proponerlo | 19 |
| 31 | La biblioteca a 1440 px con el chat abierto | **Arreglado (lote 3)**: la barra desbordaba y la sección se corría 32 px («a-clip4.mp4», «) Importar») | 17 |
| 32 | «Agregale B-roll al video» | No medible en el navegador de la app (quedó «Trabajando»: corre en segundo plano). Pendiente en Chrome | — |
| 33 | Reabrir el proyecto en el navegador de la app | **Falla, sin hacer**: biblioteca vacía y reproductor negro. La metadata de los dos videos está, pero sus archivos no están en OPFS. En Chrome no pasó. Hay que investigarlo (ver abajo) | — |
| 34 | Celular 375 px: Video, «Nuevo video», el proyecto | Pasa | 20 |
| 35 | Celular: abrir el proyecto (Dividir, Eliminar, Deshacer, Exportar) | Pasa. **Mejora**: en el teléfono no hay chat de MaKo para editar | — |
| 36 | Plan Esencial | Por código: el Video Editor es de Pro; Esencial lo ve con candado y «Pasar a Pro» (`lib/plan-esencial-reglas.ts`) | — |
| 37 | Roles | Por código: lo abre el rol admin del negocio (cliente o agencia); closer y setter no (`app/video-editor/acceso.ts`). No hay forma de «ver como» un miembro sin crear una cuenta | — |
| 38 | Accesibilidad en el celular | **Mejora**: el botón «Nuevo video» y el link del proyecto no tienen nombre accesible | — |

## Pendiente (necesita el turno de Chrome)

El navegador de la app no sirve para lo que se anima. Esta sesión no está abierta en ninguna ventana, así que el panel queda
oculto, la página corre en segundo plano, la importación se cuelga en «Importando…» y los cursores no se animan.

- B-roll y «Otra», Pexels; motion y fotogramas clave; usar una plantilla de video por chat; edición automática pedida desde
  el chat; rango I/O; «Quita las muletillas».
- Exportar de verdad (baja un archivo: pide permiso) y mandar al feed en ws3.
- Después del despliegue del 11/11 (08:05 UTC), mirar en producción los arreglos de los lotes 1 y 2 (lista en las notas
  compartidas, `video-editor-recorrido-1011.md`).

## Lo que queda sin hacer

- **Los proyectos en otro navegador** (caso 3). Para verlos en otra computadora hay que pasar los proyectos y sus videos al
  servidor: es trabajo grande.
- **Los archivos que faltan al reabrir** (caso 33). La metadata se guarda DESPUÉS de escribir el archivo
  (`services/storage/service.ts`, `saveMediaAsset`), así que el archivo se escribió y después desapareció. Los que borran
  medios (`deleteMediaAsset`, `deleteProjectMedia`) borran también la metadata, así que no fueron ellos. Un archivo de prueba
  en OPFS sobrevivió a la recarga. Sin causa todavía. Aunque la causa sea del entorno, el editor no debería mostrar una
  biblioteca vacía y un video negro sin avisar: CapCut marca el medio perdido.
- **La API** acepta sólo los presets de la marca en `usar_preset_subtitulos`. Las plantillas de fábrica («Hormozi») van sólo
  por el chat (`lib/api-mako/areas/video.run.ts` busca en los presets del negocio).
- **El Image Editor** firma el hilo con su criatura (`app/image-editor/mako/chat/PanelMakoIA.tsx`, `QUIEN`). No es de esta tab.

## Cómo se mejoraría

- La tarjeta de «borrar silencios» debería decir cuánto se va a cortar por clip, no «Se quita» dos veces.
- En el teléfono, el chat de MaKo para editar por pedido. Hoy dice «lo demás, en la computadora».
- Un aviso de medio perdido en la línea de tiempo y la biblioteca (rojo, «Volver a importar»), como CapCut.
