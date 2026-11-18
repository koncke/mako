# Relevo del chat «Pestañas» (18/11/2026, 21 UTC, cuenta claude2 al 96%)

Lo que hace este chat: dibuja las pestañas de la app en HTML estático para la maqueta del onboarding (el artefacto
https://claude.ai/artifact/KGn9GUek4GRqKm6M1Q345M, archivos `app-*.html`), y desde el 18/11 los tutoriales de la app real
(lib/tutoriales). Publica SÓLO sus archivos; nunca `index.html`, `onboarding.html` ni las páginas del sitio.

## Dónde vive cada fuente

- **El kit de dibujo** (no es un repo): `C:/dev/artefactos-pestanas`. Su manual es `LEEME.md` (cómo se dibuja, se arma, se mira y se publica).
  - `dibujar.tsx` dibuja con los componentes REALES del repo (`renderToStaticMarkup`). Se corre desde el repo:
    `cd C:/dev/wt-pestanas && node --import file:///C:/dev/artefactos-pestanas/herramientas/registrar.mjs --import tsx C:/dev/artefactos-pestanas/dibujar.tsx [pestaña …]`
  - `pestanas/*.tsx`: una por pestaña, con sus datos de mentira (Nutri Vale, Valentina) y su versión de teléfono (`rutaMovil` + `dibujarMovil`).
  - `parches.ts`: los estados que un componente lee al montar. OJO: las claves van en minúscula.
  - `armar.mjs` arma `publicar/` y `archivos.json`; `mirar.cjs [pestaña]` saca capturas a 1440 y 390 (`capturas/`).
  - `preparar-publicacion.mjs <index vivo> <carpeta>` arma la carpeta para publicar: antes se baja el `index.html` vivo del artefacto.
- **Los tutoriales**: `lib/tutoriales/` (34 pestañas), las marcas en los componentes (`data-recorrido`, `lib/tutoriales/marcas.ts`),
  la regla en AGENTS.md y lo aprendido en docs/hallazgos-ui.md.
- **El nombre del plan que ve el cliente**: lib/plan-visible.ts y lib/plan-visible-reglas.ts (docs/hallazgos-planes-y-cobro.md).
- Rama: `punta/tutoriales-app`. Todo lo de este chat está en main (último: 6a56a4925).

## Qué está dibujado (34 páginas, `archivos.json`: 34 dibujadas, 0 sin dibujar)

Con versión de TELÉFONO (a 390 se ve la pantalla de MaKo Mobile):
CRM, Plan, Offer, Automations, Dashboard, Classroom (/m/curso), Marketing CoPilot (/m/ads), AI Avatar, Copywriting, Competitor Spy,
Web Generator (/m/landing), Settings › Perfil (/m/cuenta), Integraciones, Tu plan, MaKo Partners (/m/partners).

SIN versión de teléfono: a 390 se ve la página de computadora con el riel, angosta. Son Ops Center, Ticketera, Calendar, Chats,
Video, Image, Equipo, Seguridad, Notificaciones, Instalar, Identidades fiscales, Reportar, Agency, API, y las sub-pestañas de
Classroom (Community, Clients, Calendar, Leaderboards, About).

## Lo que falta o quedó a medias

- **El teléfono de las pestañas de la lista de arriba.** Partners se rompía por esto (la calculadora se pisaba a 390) y se arregló
  sumándole `/m/partners`. Las demás pueden tener el mismo problema: dibujarles su `/m/…` con el patrón de `pestanas/settings.tsx`.
- **Las capturas a 1440 a veces salen sin el logo de la barra.** No es la página: es el tiempo de `mirar.cjs`. Con 2,5 s más se ve.
  Darle más espera a `mirar.cjs`.
- **El panel del partner** (`MK_ADENTRO=1`, app/partners/PanelPartner.tsx) no se publica. El Cerebro dijo que por ahora no hace falta.
- **Los tutoriales:** no se midieron los de pantallas internas (`estado`), y faltan medidas de teléfono de varias pestañas. El paso de
  reuniones del CRM se saltea en el teléfono: habría que usar la lista en el manifiesto.
- **Partners cambió cuatro veces el 18/11.** Lo vigente, dibujado desde 7b7dd54f5: el partner cobra SIEMPRE el 30% y la calculadora
  tiene un solo interruptor. Si el Sitio vuelve a tocar `app/mako-partners/`, redibujar `partners` cuando entre a main, nunca antes.
- **«Tu plan» sin pago directo** (versión 85): la propuesta de transferencia o Binance se sacó porque Martín volvió a Mercado Pago y
  pasarela a 97 y 47.

## Cómo se publica sin pisar a los otros chats

1. Bajar el `index.html` vivo: Artifact `read` con `path: index.html`.
2. `node preparar-publicacion.mjs <ese index> <carpeta>`.
3. Publicar con `files` = sólo los archivos tocados.
4. Si dice «versión más nueva», revisar que el index vivo sea el mismo y volver a publicar dos veces (la segunda pasa).
