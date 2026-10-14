# Relevo — Image Editor (el Canva de MaKo), 14/10/2026 tarde

Chat: «Image Editor» (cuenta claude1). Antes: «Canva en Content Machine» (claude2). Lo escribe el chat que hizo el trabajo.

## El pedido

> «Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual, copialo todo, tanto en
> diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo. Dejalo en "Content
> Machine" en una tab que sea "Image"»

Y sobre la base: **«Copia a Doory, y luego lo modificamos completamente para que sea original de MaKo,
pero quiero la plantilla para ir trabajando».** El 14/10 a la tarde, por el orquestador: cerrar lo
pendiente que no dependa de Martín y dejarle en una línea las opciones de lo que sí.

## Dónde quedó

- **Rama `editor-imagen`, worktree `C:/dev/wt-canva`.** Tandas 1 y 2 en main desde el 14/10 13:26
  (`353c81a8`). Encima: `c7a77fcb` (la vista del presentador) y `5136c1ce` (tanda 3, la base), más la
  cosecha. Si abajo no dice «en main», no se pusheó.
- **Tanda 3 hecha:** diseños, «Subidos» y miniaturas en Supabase (mig **0278, ya aplicada en prod**: sólo
  agrega dos tablas y el bucket `image-editor`). Lo que la etapa 1 dejó en el navegador de alguien sube solo
  la primera vez que abre el editor, con su mismo enlace. Plano: `docs/diseno-editor-imagen.md`.
- **Verificado:** el editor andando en un banco (esbuild + Chrome sin ventana, sin dev server: pasa los 5 GB)
  — crear, texto, plantilla, imagen, guardar y reabrir, PNG y PDF, presentador; el server contra la base
  real en el ws 3 (23 pasos, limpiando todo al final); 887 tests de los que barren el árbol en verde.
- **NO verificado:** la cáscara de MaKo alrededor (la tab, la barra, el `?ws=`) en producción. El Chrome con
  Claude in Chrome no estaba conectado para claude1. Qué mirar con la sesión de Martín: crear un diseño,
  subir una imagen, cerrar y abrir desde otra pestaña (tiene que estar), descargar PNG, el crédito de Doory al pie.

## Lo que decide Martín (en una línea cada una)

- **¿«Image» también mirando un cliente (`?ws=`)?** A) Sí: la fila te aparece a vos también adentro de un
  cliente; ya está hecho en `opcion-image-en-clientes` (`8cd57c7e`) y arregla su «no veo la tab» · B) No, como
  hoy. Un admin de cliente no lo ve en ninguna.
- **¿Le escribimos a Siam (autor de Doory) pidiendo MIT?** Sin eso el cartel se queda y no se abre a clientes.
- **¿Fotos de Unsplash con una key de MaKo?** ¿Y un modelo para quitar fondo de objetos?
- **¿La API del editor ya, con un gating nuevo «sólo plataforma», o el día que se abre a clientes?** Hoy
  declararla con `gating.tab` la abre por token a cualquier cliente completo/agencia.
- **Una pestaña de Canva** (`canva.com/design/DAHX-ICTUd4`) en el grupo de los agentes: si se creó en su cuenta, papelera.

## Lo que sigue (no depende de él)

1. Las 10 plantillas con el texto del lienzo en español y sus miniaturas redibujadas (el banco sirve).
2. Tanda 5: lo de Canva que Doory no trae (lista en `docs/hallazgos-editor-imagen.md`, al final).
3. Tanda 4: alojar las fuentes (hoy jsDelivr). Marca, versiones, compartir y comentarios con tablas propias.
4. `docs/editor-imagen/relevamiento-canva-funciones.md` (el agente se cortó con la caída del 14/10).

## Para retomar

`Leé docs/relevo/image-editor.md y docs/hallazgos-editor-imagen.md y seguimos.`
