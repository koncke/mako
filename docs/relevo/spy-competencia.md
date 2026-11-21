# Relevo — Spy de Content Machine con TODA la competencia (chat hijo del Cerebro, claude5)

Actualizado: 21/11/2026 ~08:45 UTC. Cuenta claude5 en 94 % (al 97 % se guarda todo y se corta).

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
| Doglio | 207: 137 a cámara, 60 animación, 10 carruseles (me gusta ocultos: sin N×) | — |
| Collado | 89: 39 a cámara, 10 animación, 40 carruseles | 3 reels restringidos no bajan |
| Dakota Hermes (@dakota.hermes) | — | PRIORIDAD de Martín. 357 reels (`dakota/lista-ig-21-11.txt`, con vistas) bajando con procesar-suave; 58 carruseles en la grilla (hay códigos de 39 caracteres). Después: `spy.py reels/carruseles/ocr dakota`, clasificar con `criterio-tipos-v2.md`, subir, armar, escribir, avisar a Content Machine (foto de perfil en el filtro) y relevo en `docs/series/referentes/dakota-hermes.md` |
| Rama | 84 viejas reclasificadas | 102 reels por bajar (14 ya bajados), 71 carruseles |
| Heras Media | (en las viejas) | 191 reels por bajar (15 no bajan desde el 19/11), 2 carruseles |
| Víctor | (en las viejas) | 161 reels por bajar, 11 carruseles (con láminas enteras) |
| Hormozi | (en las viejas) | 114 reels por bajar (lista de 162 del 21/11), ~57 publicaciones |
| Biblioteca de MaKo | — | 893 carruseles: portadas a 600 px + láminas enteras de los 150 mejores (bajado a medias antes del apagón: `spy-biblioteca.py bajar` saltea lo que ya está; después `armar`). Resto con `laminas_pendientes: true`: al «Elegir», subir sus láminas y avisar a Content Machine |
| Julián Alborna | — | en espera: Martín tiene que pasar el usuario |

Las piezas viejas (104) ya tenían `comentarios`; se les sumó `cta` (72 por este chat, 16 de tema por Content Machine).
