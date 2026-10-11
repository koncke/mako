# Hallazgos — el Video Editor (la copia de CapCut)

La tab Video Editor (`app/video-editor/`) es una copia de CapCut Desktop 9.3 armada sobre el motor de
OpenCut classic portado (MIT). El plano —decisiones, arquitectura, ranuras, reglas y paquetes— está en
[diseno-editor-video.md](diseno-editor-video.md); los relevamientos que lo sostienen, en
[editor-video/](editor-video/). Lo que se hizo está en el commit; acá va lo que hay que saber **antes**
de tocarlo: el síntoma, la causa, dónde vive y la regla que queda.

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| Quién lo abre | `app/video-editor/acceso.ts` | Hoy, sólo el super admin (la persona, también mirando un cliente con `?ws=`). Lo usan las dos pages y el botón de Video Generator |
| El motor | `app/video-editor/_opencut/` | OpenCut classic portado: línea de tiempo, render WebGPU, exportar con WebCodecs |
| El tema | `app/video-editor/capcut-theme.css` | La paleta medida de CapCut, encerrada en `.ce` |
| El almacenamiento | `app/video-editor/espacio.ts` | IndexedDB y OPFS con el prefijo del workspace |
| Las ranuras | `app/video-editor/ce/` | Dónde se enchufa cada función de CapCut |
| «Editar en el editor» | `app/video-editor/desde/` + `app/video-generator/editor-video.tsx` | La ref que viaja, su resolución en el server y la importación en el navegador |
