# Deploy MaKo Customer Success to new route

`2026-07-08 19:51` → `2026-07-08 19:54` · 2 mensajes de Martín · 4 respuestas de Claude · sesión `550e13d3`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-08 19:51`

@"C:\Users\marti\Downloads\MaKo Customer Success.html"
Pon esto, sin modificar absolumante nada, en una nueva ruta /vsl/mako-cs

### Claude

Ahora el rewrite:

### Claude

Estándar. Aplico el rewrite:

### Claude

Listo y pusheado a `main`.

- Copié el archivo tal cual (299,887 bytes, sin tocar un byte) a [public/vsl-assets/mako-cs.html](dashboard-marketing/public/vsl-assets/mako-cs.html).
- Agregué un rewrite en [next.config.ts:18](dashboard-marketing/next.config.ts:18): `/vsl/mako-cs` → `/vsl-assets/mako-cs.html`.

Lo serví como estático en vez de una page de Next porque el export de Claude Design es un documento HTML completo (`<html>`, `<head>`, bundle JS inline) — meterlo en un componente React habría obligado a modificarlo. Así queda idéntico al original.

`/vsl` y `/vsl-assets` ya están en la lista de rutas públicas de [proxy.ts:28](dashboard-marketing/proxy.ts:28), así que no pide login. No verifiqué en browser (no levanto el preview salvo que lo pidas).


---

## Martín

`2026-07-08 19:54`

Dame la ruta total de como quedó https://dashboard-marketing-six.vercel.app/ que va despues?

### Claude

https://dashboard-marketing-six.vercel.app/vsl/mako-cs

(Después de que Vercel termine de desplegar el commit `1913085`.)

