# Relevo — Gurús del Ops Center (sesión en la nube, 4/11/2026)

Pedido de Martín, textual: «En Ops Center, faltan un montón de gurus que nos habia quedado por la mitad que ya habiamos hecho
sus caricaturas... Y en lugar de "Su Second Brain" que diga "Second Brain de NOMBRE DEL GURU" y que esté alineado a la derecha
del todo... Cuando le doy click no debe abrirse un modal, sino que debe reemplazar lo que está en el chat para mostar su second
brain, y en el botón de "Second Brain de..." que esté "Volver al chat". Y dentro revisa la sidebar de cada second brain, estan
bastante mal organizadas... Y los nodos son todos iguales, no esta bien diseñado como el que ya hicimos, que tienen diferentes
colores, tamaños y que los titulos van apareciendo y desapareciendo por "sección", no esta bien organizado eso...».

**Estado: TODO EN `main`** (punta `gurus-segundo-cerebro`, corrida 56 verde, `003115dfa`). La corrida 40 había dado rojo sólo
por un error de tipos en un test (`children` de `PanelDeChat`, arreglado en `e377ebe86`); los 7014 tests ya estaban verdes.
Sin base ni claves: no se aplicó nada en producción y no hay migraciones.

## Hecho

| Punto | Qué quedó | Dónde |
|---|---|---|
| 2 · el botón | «Second Brain de <gurú>», a la derecha del todo de la cabecera. Al tocarlo el grafo **reemplaza** la conversación (sin modal) y el botón dice «Volver al chat». La conversación queda montada: al volver sigue donde estaba. En los tres chats con gurú (el suyo, el Funnel Coach, una conversación de Offer) y en el teléfono (la hoja del gurú). | `app/second-brain/SuSecondBrain.tsx`, `PanelChat.tsx` → `reemplazo` |
| 3 · la barra lateral | Decía «453 cosas que MaKo sabe · 453 de MaKo · 0 tuyas» con una sola sección. Ahora: «Curso de <autor>», el nombre del curso, «N clases · M módulos» y los **módulos** en el orden del curso, con su color y su conteo (tocar uno filtra y vuela a él). El filtro ofrece sólo «Módulo», el buscador dice «Buscar una clase» y no ofrece «Buscar con MaKo» (que mira el negocio). El detalle de una clase: «Cómo empieza», Clase N de M, Módulo, Duración y con qué se conecta. | `app/second-brain/Grafo.tsx` (modo `curso`), `FiltroMapa.tsx`, `BuscadorCerebro.tsx` |
| 4 · los nodos | El mismo `Grafo` del negocio, con la forma del del negocio: la raíz es el curso, cada módulo es una sección de nivel 1 (su título queda de lejos, las clases aparecen al acercarse), un color por módulo, y tamaños distintos (raíz > módulo > clase, y una clase larga más grande que una corta). Clases de módulos distintos que comparten una palabra propia del título quedan unidas. | `lib/cerebro-referente-vista.ts`, `peso` en `lib/cerebro-modelo.ts` |
| índice | El índice de clases ahora trae el módulo de cada clase. Y arreglé un error: en 18 de 31 cursos la primera clase se llamaba como el subtítulo del curso («33 clases, 2 módulos…»). | `scripts/generar-clases-de-referentes.mjs` |

Verificado: tests nuevos (`tests/cerebro-referente-vista.test.ts`, `tests/gurus-en-espera.test.ts`) probados rompiendo el
código; el arnés de Chromium dibujó el grafo real de Hormozi, Alborna y Tino Mossu a 1280/1440 y a 390 (teléfono), con el
botón, la barra lateral, una clase tocada y el filtro. **Sin ver:** la app corriendo con sesión (la nube no tiene base), y
el retrato del gurú en la cabecera (el arnés no sirve `public/`).

## Los gurús: cuáles quedaron y cuáles no

**En la galería: los 22 que tienen caricatura.** Ninguno de los 22 retratos de `public/asesores/` estaba afuera.

**Los diez que faltan NO tienen caricatura en el repo**: busqué en todas las ramas y etiquetas
(`git log --all -- '*<apellido>*.png'`) y no hay ninguna. Las caricaturas se hacen con Canva desde la PC (prompt aprobado en
`docs/hallazgos-ops-center.md`); la nube no tiene Canva. Si Martín ya las hizo, están en Canva o en la PC, no acá.

Su FICHA sí se escribe en la nube, y **las diez están escritas** en `lib/asesores/en-espera.ts` (`EN_ESPERA`), listas para
entrar. Cada una sale de leer de 8 a 12 clases de método de su curso; lo que el curso enseña y el chat no repite (escasez o
urgencia inventada, promesas de ingresos, pedir un crédito para pagar, comprar enlaces) está en su «⚠️ NO SE TRASLADA».
**Lo que falta para que entren es sólo su cara** (y que Martín lea la ficha si quiere: no la revisó nadie más).

| Gurú | Curso | Ficha |
|---|---|---|
| Juan Carrizo | Aumenta tu valor y ATV ADVANTAGE | **escrita** («Oferta y valor», `ficha-juan-carrizo.ts`) |
| Vilma Núñez | Certificación en Marketing Digital potenciada por IA | **escrita** («Marketing y crecimiento», `ficha-vilma-nunez.ts`) |
| Samuel Albaa | Growing Closer (su parte: la práctica del closer; el curso no enseña *setter*, la nota de antes lo suponía) | **escrita** («Práctica del closer», `ficha-samuel-albaa.ts`) |
| Álvaro Luque | The perfect launch | **escrita** («Lanzamientos», `ficha-alvaro-luque.ts`) |
| Sergio Begueria | Instituto De Marca Personal | **escrita** («Marca personal y video», `ficha-sergio-begueria.ts`) |
| Romuald Fons | Bigseo Academy | **escrita** («SEO», `ficha-romuald-fons.ts`) |
| Mateo Maffia | BYF | **escrita** («Video corto que vende», `ficha-mateo-maffia.ts`) |
| Francisco Doglio | ARCADIA | **escrita** («Equipo comercial y webinars», `ficha-francisco-doglio.ts`) |
| Andy Landa | ManyChat Master - Instagram | **escrita** («Automatizaciones de Instagram», `ficha-andy-landa.ts`) |
| Gonzalo Seré | Growing Content Specialist | **escrita** («Estrategia de contenido», `ficha-gonzalo-sere.ts`) |

Andrew Tate no entra (pedido explícito).

**Cómo entra uno cuando llega su cara** (una sesión local con Canva): subir `public/asesores/<id>.png` y
`public/asesores/grandes/<id>.png`, pasar su fila de `EN_ESPERA` a `ASESORES` (y su id a `IdAsesor`) en
`lib/asesores/catalogo.ts`, y su ficha a `FICHAS` en `lib/asesores/fichas.ts`. `tests/gurus-en-espera.test.ts` lo pide
solo en cuanto ve el PNG, y `tests/gurus-ops-center.test.ts` cuenta los de la galería (hoy 22: hay que subirlo).

## Rojos que ya estaban en `main` (no son de esta rama)

Medidos en un worktree limpio de `origin/main`, en Linux:
- 23 archivos de tests (`mako-no-puedo-falsos`, `ops-center-estrella-desde`, `mako-turno-app`, `agenda-whatsapp`,
  `automatizacion-whatsapp`, `api-mako-cobros`, …): importan `lib/mako-doer-acciones.ts` (o `lib/landing-token.ts`) como ESM
  y node contesta que no exporta `MAKO_ACCION_TOOLS` (que sí exporta). Iguales en esta rama y en `main`.

## Lo que quedó sin hacer

- **El encuadre del grafo del NEGOCIO** puede cortar un título pegado al borde: en el de un curso se arregló (`ajustar` en
  `Grafo.tsx` deja la mitad del título más largo a los costados); en el del negocio no se tocó.
- Sin migraciones.
