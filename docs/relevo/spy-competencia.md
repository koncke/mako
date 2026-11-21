# Relevo — Spy de Content Machine con TODA la competencia (chat hijo del Cerebro, claude5)

Actualizado: 21/11/2026 ~12:50 UTC. Cuenta claude5 reiniciada por Martín (seguir con todo).

## Qué es
Llenar la tab **Spy** de Content Machine (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz) con todo lo de la competencia de
Martín, clasificado por tipo (avatar-ia, animacion, a-camara, carrusel). Este chat NO publica la página: escribe documentos
`spy/<cuenta>-<código>` en la base del artefacto y sube los medios al almacén (contrato: `docs/hallazgos-contenido.md` →
«Contrato de la colección spy», en `punta/serie-avatar-ia`; campos extra: `cta`, y en la biblioteca `laminas_total`,
`laminas_pendientes`, `fuente`). La página la publica sólo el chat «Videos con avatar de IA» (local_fc754a71-…).

## ⛔ Regla de carga (la laptop se apagó por temperatura el 21/11 07:27 UTC)
UN solo proceso pesado a la vez (bajar, transcribir, ffmpeg o subir); `tools/procesar-suave.py` para bajar (ffmpeg 2 hilos,
4 s entre reels, 150 s cada 25 min); pausa de 2-3 min cada 20-30 min de trabajo pesado. Si la PC se pone lenta, parar y avisar.

## Dónde está todo (fuera del repo)
- Herramientas en `C:/dev/referentes-videos/tools/`: `procesar-suave.py` (bajar + whisper + hoja de cuadros), `spy.py`
  (reels, carruseles, ocr, rehacer, armar), `spy-lotes.py` (lotes de subida y de escritura), `ocr-windows.ps1`,
  `leer-biblioteca.mjs` (producción, sólo GET) y `spy-biblioteca.py` (bajar, armar).
- Datos en `C:/dev/referentes-videos/spy/`: `grilla-21-11.txt` (las publicaciones de cada cuenta), `criterio-tipos.md` (criterio
  de los subagentes), `base-leida/` (la colección como estaba al empezar) y por cuenta `spy/<cuenta>/`: `medios/`, `piezas/`,
  `clasificar/` (hojas de 10 reels × 8 cuadros), `clasificacion*.json`, `assets-lineas.txt` («archivo id»), `assets.json`,
  `listos/` (lo que se escribe) y `escribir-NN.json`.
- La copia para subir va en `<scratchpad de la sesión>/sub/<cuenta>/` (`Artifact` sube de a 25 sólo desde el scratchpad o la
  carpeta de trabajo). Si se cambia de sesión, `spy-lotes.py preparar <cuenta> <scratchpad nuevo>/sub/<cuenta>` la rehace.

## Cómo se hace una cuenta
1. `python -I tools/procesar-suave.py <cuenta>=<cuenta>/urls-spy.txt [<otra>=…]` (de fondo, sola).
2. `python -I tools/spy.py reels <cuenta>` → recortes de 25-35 s a 480 px, pósteres, gancho, `cta` y hojas para clasificar.
3. `spy.py carruseles <cuenta>` y `spy.py ocr <cuenta>` (láminas enteras, texto por OCR de Windows).
4. Subagentes Sonnet clasifican las hojas (≤10 hojas cada uno) con `spy/criterio-tipos.md` → `clasificacion-a.json`, `-b.json`.
5. `spy-lotes.py preparar` → un subagente Haiku por ≤10 lotes sube y anota «archivo id» → `spy-lotes.py mapa`.
6. `spy.py armar <cuenta>` → `spy-lotes.py escrituras <cuenta>` → `ArtifactData batch` con cada `escribir-NN.json`.

## Cuentas (criterio v2: avatar-ia con escena a-camara|sketch, animacion, carrusel)
| Cuenta | En la base | Pendiente |
|---|---|---|
| Carrizo | 103: 49 avatar IA a cámara, 37 animación, 17 carruseles de fotos | — |
| Doglio | 207: 137 a cámara, 60 animación, 10 carruseles (me gusta ocultos: sin N×) | — (videos ya en recorte de 15 s) |
| Collado | 89: 39 a cámara, 10 animación, 40 carruseles | 3 reels restringidos no bajan |
| Dakota Hermes (@dakota.hermes) | 415: 218 a cámara, 7 sketch, 125 animación, 58 carruseles (más 7 reels que entraron después) | — (relevo en `docs/series/referentes/dakota-hermes.md`) |
| Rama | 84 viejas reclasificadas | 102 reels por bajar (14 ya bajados), 71 carruseles |
| Heras Media | (en las viejas) | 191 reels por bajar (15 no bajan desde el 19/11), 2 carruseles |
| Víctor | (en las viejas) | 161 reels por bajar, 11 carruseles (con láminas enteras) |
| Hormozi | (en las viejas) | 114 reels por bajar (lista de 162 del 21/11), ~57 publicaciones |
| Biblioteca de MaKo | — | 893 carruseles: portadas a 600 px + láminas enteras de los 150 mejores (bajado a medias antes del apagón: `spy-biblioteca.py bajar` saltea lo que ya está; después `armar`). Resto con `laminas_pendientes: true`: al «Elegir», subir sus láminas y avisar a Content Machine |
| Julián Alborna | — | en espera: Martín tiene que pasar el usuario |

Las piezas viejas (104) ya tenían `comentarios`; se les sumó `cta` (72 por este chat, 16 de tema por Content Machine).

## ⛔ Almacén de 1 GB (21/11)
Se llenó subiendo Dakota. Los videos de Doglio y Dakota se reemplazaron por recortes de 15 s a 480 px (`tools/spy-reemplazo.py`:
fase A con `video: null` → borrar los viejos → subir → fase B) y se liberaron ~250 MB. Todo lo nuevo va en ese formato
(`spy-reemplazo.py clips <cuenta>` hace los recortes de 15 s; `spy.py reels` todavía hace los de 25-35 s: usar los de 15).
Si vuelve a faltar lugar: lo mismo con Collado y Carrizo. Nunca borrar lo de Content Machine.

## Tendencias (pedido del chat «Tendencias del mercado por sector», local_b76382ea-…)
137 referentes con `datos: "bajar"` en `C:/dev/tendencias/referentes.json`, SÓLO metadatos de los últimos 90 días (desde el
23/08/2026) a `C:/dev/tendencias/<usuario>/`, no al artefacto. Orden: Anuncios, IA (4 subsectores), Closing, YouTube, High ticket,
Low ticket, Nicho, Viral, Mentalidad. Instagram: la lista sale del Chrome (procedimiento en
`C:/dev/tendencias/herramientas/listar-ig.md`, con la fecha sacada del código) y después
`herramientas/bajar-metadatos.py <claves…>` (info.json con comentarios; YouTube con los 60 comentarios más nuevos de los 10
videos más comentados). **Bloqueado:** la extensión Claude in Chrome se desconectó tras el apagón; sin ella no hay lista de
Instagram. YouTube de Anuncios bajando (`C:/dev/tendencias/bajada.log`). Avisar al chat de tendencias al terminar cada sector.
