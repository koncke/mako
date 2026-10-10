# Las fuentes que viven FUERA del repo

Los audios y las llamadas que fijan el **Norte del negocio** no están versionados: viven
sueltos en `dashboard-marketing-main\` (la carpeta padre, que **no es un repo**) y en
`~\Downloads`. Están ahí a propósito — son material del negocio de Martín y de Mauricio,
no código — pero eso crea un agujero: **existen y ningún archivo versionado los nombraba.**

Medido el 05/10/2026, con `grep` sobre `docs/` y `AGENTS.md`:

| Archivo | ¿Lo nombra alguien del repo? |
|---|---|
| `llamada-leila-01oct-transcripcion.txt` | Sí — `hallazgos-plan.md`, `chatbot-leila-01oct.md`, `panorama-03oct.md` |
| `audio-mau-04oct.txt` | **NADIE** |
| `audios-22-sep-transcripcion.md` | **NADIE** |

Este documento es ese índice. Es el mismo modo de falla que
[AGENTS.md → «Una ruta que apunta a la nada»](../AGENTS.md), pero al revés: no es una ruta
sin archivo, es un **archivo sin ruta que lo nombre**. Una sesión nueva no puede buscar lo
que no sabe que existe, y de ahí sale el error caro de dar algo por perdido y rehacerlo
(pasó el 16/09 con `entrega-martin.md`: estaba en Descargas y se bloquearon cuatro tareas
por nada).

---

## Las fuentes del Norte (audios y llamadas)

Todas en `dashboard-marketing-main\`, al lado del repo:

| Archivo | Qué es | De dónde salió |
|---|---|---|
| `audio-referidos-10oct-transcripcion.md` (27 KB, 10/10) | El audio del 10/10: **el sistema de referidos y el plan agencia** (47/97/200, «cada 5 clientes 3 meses gratis», 100% del primer mes vs. comisión recurrente). Dos voces — Martín proponiendo, su socio refutando. Transcrito con Groq `whisper-large-v3`; el original es `~/Downloads/WhatsApp Audio 2026-10-10 at 15.54.50.mp4` | **Es la fuente de [`referidos.md`](referidos.md)** |
| `audio-mau-04oct.txt` (7,7 KB, 04/10) | El audio del 04/10: pasarela de pagos, vender MaKo 47 o el grupal. Dos voces — Martín proponiendo, Leandro refutando | **Es la fuente de [`proyeccion-04oct.md`](proyeccion-04oct.md)** |
| `llamada-leila-01oct-transcripcion.txt` (86,7 KB, 01/10) | La llamada con Leila que cerró **las cinco etapas** y bajó el tope al 4/11 | Citado por `hallazgos-plan.md` y `panorama-03oct.md` |
| `audios-22-sep-transcripcion.md` (36,9 KB, 25/09) | Los audios del 22/09 con Leandro: **las tres fases** y qué incluye cada una. ⚠️ No estaban transcritos; se transcribieron el 25/09 con Groq `whisper-large-v3` | La memoria `mako-once-proyectos` sale de acá. **Superados** por las cinco etapas del 01/10 |
| `accionables-mako-20-sep.html` (297 KB, 23/09) | «Los accionables de MaKo»: cubre las grabaciones **15-18 del 20/09**. ⚠️ NO cubre los audios del 22/09 | Consolidado de esa tanda |
| `tareas-reuniones-mauricio-8-y-9-sep.md` (156 KB, 19/09) | Las **83 tareas** de las llamadas del 8 y 9/09, ya validadas y repartidas a los chats | La primera entrega del cerebro repartidor |
| `reporte-reuniones-mauricio.html` (17,7 KB, 19/09) | El reporte legible de esas mismas dos llamadas | Idem |
| `friccion-crm-25-sep.md` (21 KB, 25/09) | Los **32 frenos** del CRM relevados el 25/09 | La memoria `friccion-crm-por-tandas` sale de acá |
| `briefs-para-pegar-video-generator-y-email.md` (5,2 KB, 17/09) | Los dos briefs que **no se pudieron entregar** por `send_message` (el chat destino no existía o rechazó) | Quedaron para pegar a mano |

Y en `~\Downloads`:

| Archivo | Qué es |
|---|---|
| `entrega-martin.md` (15 KB, 09/09) | **El criterio de extracción de Mauricio.** No se commitea a propósito: es material de su negocio. Al 30/09 además está **cargado en `app_settings` del ws1** y se edita en /configuraciones → «Criterio de reuniones» |
| `Guiones Mau.md` | Guiones de Mauricio |
| ~27 `WhatsApp Audio/Ptt *.ogg/.mpeg/.mp4` (21/08 → 04/10) | **El material crudo.** El último es `WhatsApp Ptt 2026-10-04 at 21.29.34.ogg` |

⚠️⚠️ **LOS AUDIOS DE WHATSAPP CADUCAN A LOS ~30 DÍAS** (ver la memoria `grupo-makito-feedback`).
Los `.ogg` de Descargas son la copia local y ya no se pueden volver a bajar del chat. **Si
hace falta volver a una fuente, es ese archivo o nada.** Lo que se transcribe sobrevive; lo
que no, se pierde en silencio y sin aviso.

## Salidas de barridos, no fuentes

Están al lado y se confunden con lo anterior. No son material de negocio:

`jerga.txt` (barrido de tokens/costo de IA) · `voseo2.txt` (barrido del guard de voseo) ·
`vered.txt` (el veredicto del panel sobre subtítulos y música) · `vsl-*.html` (cuatro
versiones del VSL) · `vered.txt` y `cortes.json`.

## La regla

**Lo que se decide sobre un audio se escribe en el repo el mismo día, con el nombre del
archivo que lo originó.** El audio puede caducar, la carpeta puede no sincronizar y la
sesión que lo escuchó se cierra; lo único que sobrevive es lo versionado. Y al escribirlo,
la línea «sale de X» no es decorativa: es lo único que permite volver a la fuente cuando
el análisis se discute.

Si aparece una fuente nueva, va en la tabla de arriba **en el mismo commit** que el análisis.
