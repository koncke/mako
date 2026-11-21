# Relevo — Spy de Content Machine con TODA la competencia (chat hijo del Cerebro, claude5)

Actualizado: 21/11/2026 ~07:00 UTC. Cuenta claude5 (92 % de la semana; al 97 % se guarda todo y se corta).

## Qué es
Llenar la tab **Spy** de Content Machine (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz) con todo lo de la competencia de
Martín, clasificado por tipo (avatar-ia, animacion, a-camara, carrusel). Este chat NO publica la página: escribe documentos
`spy/<cuenta>-<código>` en la base del artefacto y sube los medios al almacén (contrato: `docs/hallazgos-contenido.md` →
«Contrato de la colección spy», en `punta/serie-avatar-ia`). La página la publica sólo el chat «Videos con avatar de IA».

## Dónde está todo (fuera del repo)
- `C:/dev/referentes-videos/tools/spy.py` (reels, carruseles, ocr, armar), `tools/spy-lotes.py` (lotes de subida y de escritura),
  `tools/ocr-windows.ps1` (texto de las láminas con el OCR de Windows).
- `C:/dev/referentes-videos/spy/`: `grilla-21-11.txt` (las publicaciones de cada cuenta, leídas del Chrome de Martín),
  `criterio-tipos.md` (el criterio de los subagentes), `base-leida/` (la colección spy como estaba), y por cuenta
  `spy/<cuenta>/`: `medios/` (recortes, pósteres y láminas), `piezas/` (documento parcial), `clasificar/` (hojas para los
  subagentes), `clasificacion.json`, `assets-lineas.txt` («archivo id» de cada subida), `assets.json`, `listos/` (lo que se escribe).
- Los reels bajados (video, whisper, hoja de cuadros) siguen en `C:/dev/referentes-videos/<cuenta>/<código>/` (tools/procesar.py).

## Cómo se hace una cuenta
1. `python -I tools/procesar.py <cuenta> <cuenta>/urls-spy.txt` (de fondo, ~20 s por reel).
2. `python -I tools/spy.py reels <cuenta>` → recortes de 25-35 s a 480 px, pósteres, gancho y hojas de 10 reels × 8 cuadros.
3. `python -I tools/spy.py carruseles <cuenta>` y `python -I tools/spy.py ocr <cuenta>`.
4. Un subagente Sonnet clasifica las hojas con `spy/criterio-tipos.md` → `spy/<cuenta>/clasificacion.json`.
5. `python -I tools/spy-lotes.py preparar <cuenta> <scratchpad>/sub/<cuenta>` → un subagente sube los lotes de 25 y anota
   «archivo id» en `assets-lineas.txt` → `spy-lotes.py mapa <cuenta>`.
6. `spy.py armar <cuenta>` → `spy-lotes.py escrituras <cuenta>` → `ArtifactData batch` con cada `escribir-NN.json`.

## Cuentas
| Cuenta | Reels para Spy | Carruseles | Estado |
|---|---|---|---|
| Carrizo | 86 (1 no bajó) | 17 (fotos de su vida, sin texto) | clasificado: 83 a cámara, 2 animación, 1 avatar IA; subiendo |
| Doglio | 197 (168 de la pestaña + 29 sólo en la grilla) | 10 + 1 imagen | bajando |
| Collado | 49 | 40 | en cola |
| Rama | 116 que faltan | 71 | en cola |
| Heras Media | 191 que faltan | 2 | en cola |
| Víctor | 161 que faltan | 11 (había 11 con láminas recortadas) | en cola |
| Hormozi | 114 que faltan (lista de 162 del 21/11) | ~57 | en cola |
| Julián Alborna | — | — | en espera: Martín tiene que pasar el usuario |
