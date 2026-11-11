# Relevo — Landings por función copiadas de la competencia (sesión en la nube, 11/11/2026)

Escrito por el chat que hizo el trabajo, en la rama `punta/landings-competencia` (también `claude/fervent-rubin-7vocz5`).

## Lo que pidió Martín (11/11/2026)

> «Fíjate si no me faltan más… investigues a la competencia de absolutamente todas las funcionalidades que tenemos en MaKo,
> así podemos sacar sus ángulos de comunicación mejores» y «Algo que es muy hot dentro de MaKo es AI Avatar y no encontré
> competencia, pero tú puedes buscarla».

El encargo: competencia de cada función (3 a 6 por función, primero LATAM/español que venden con anuncios y high ticket),
una ganadora por función, todo en un documento, y una landing de MaKo por función con la estructura de la ganadora y la cara
de `/vsl`, empezando por AI Avatar.

## Lo hecho

| Qué | Dónde | Commit |
|---|---|---|
| La investigación entera: 21 funciones, sus competidores, la ganadora de cada una y por qué, las 9 páginas que encontró Martín y los competidores que le faltaban | `docs/competencia/landings-por-funcion.md` | `d5b1fac7c`, y la tabla final en el commit de este relevo |
| Landing de **AI Avatar** (nueva), copiada de la página en español de HeyGen para anuncios UGC | `/vsl/ai-avatar` | `ae45fe837` |
| Landing de **Automations / setter con IA**, copiada de SetSmart | `/vsl/seguimiento` (rehecha) | `ae45fe837` |
| Landing de **Chats**, copiada de Leadsales | `/vsl/whatsapp` (rehecha) | el de este relevo |
| Landing del **CRM**, copiada de GoHighLevel | `/vsl/crm` (rehecha) | el de este relevo |
| Landing del **Dashboard**, copiada de Reportei | `/vsl/dashboard` (rehecha) | el de este relevo |
| El molde para las que faltan (bloques tipados, el dibujo con la cara de `/vsl`, el test) | `app/vsl/_competencia/`, `tests/vsl-landings-competencia.test.ts` | los dos |

Cada landing dice en sus primeras líneas qué referencia copia (URL y fecha), qué se cambió de ella y por qué. Lo que afirma
sale del código (`lib/funciones-mako.ts` y los catálogos de cada tab); los números de AI Avatar se cuentan del código y el
test los fija.

## Segunda tanda (11/11/2026, tarde): 14 landings más

Martín: «¿Pero por qué hiciste de tan pocas si justamente tenías ejemplos de un montón de otras? Por ejemplo, también me
interesa tener la de video… La de la espía de la competencia. El copilot. Podemos generar otras… Y muéstrame».

| Landing | Ruta | Copia de | Quién |
|---|---|---|---|
| Video | `/vsl/video` (nueva) | Cherry Studio | este chat |
| Competitor Spy | `/vsl/competitor-spy` (nueva) | Foreplay | este chat |
| Marketing CoPilot | `/vsl/ads` (rehecha) | Master Ads | este chat |
| Image | `/vsl/image` (nueva) | PostNitro | ayudante |
| Copywriting | `/vsl/copywriting` (nueva) | The Copy Machine | ayudante |
| Web Generator | `/vsl/web-generator` (nueva) | HighLevel AI Studio | ayudante |
| Offer | `/vsl/offer` (nueva) | Atlas AI (DFY) | ayudante |
| Agenda | `/vsl/agenda` (nueva) | iClosed | ayudante |
| Ops Center | `/vsl/mako` (rehecha) | Holo | ayudante |
| Plan | `/vsl/prioridades` (rehecha) | Motion | ayudante |
| Ads Analyst | `/vsl/script` (rehecha) | Gethookd | ayudante |
| Funnels | `/vsl/funnel` (rehecha) | Hyros | ayudante |
| Email | `/vsl/email` (rehecha) | beehiiv | ayudante |
| Cobranza | `/vsl/cobranza` (rehecha) | Rebill | ayudante |

Las funciones sin gráfico en `/vsl` llevan un visual propio (`app/vsl/_competencia/visuales-propios/`, registrado en su `index.tsx`).
Las 19 están en `registro.ts` y pasan `tests/vsl-landings-competencia.test.ts`. Capturas a 1440 y 375 de las 14, sin scroll
horizontal; lo que se vio, más abajo.

## Lo que falta

- **Closing**: sin ganadora (nadie en español analiza llamadas de venta); `/vsl/closing` sigue como estaba.
- **Classroom**: la portada de Skool no se pudo leer sin sesión.
- Las capturas mostraron tres portadas para mejorar, y quedan para la próxima vuelta:
  - **`/vsl/mako`** usa el gráfico viejo del media buyer («¿Apago la campaña…?», «Escala el presupuesto»): es real, pero es el
    ángulo del CoPilot, no el del Ops Center. Pide un visual propio.
  - **`/vsl/cobranza`** usa el gráfico viejo con rótulos en inglés («Sold Revenue», «Cash Collected», «Ad Spend»).
  - **`/vsl/funnel`** muestra su mini-VSL de Panda, que en este entorno se ve negro (igual que `/vsl/crm`).

**Cómo se hace una:** `app/vsl/_competencia/<slug>.ts` con su cabecera de referencia y sus bloques en el orden de la
ganadora, sumarla a `registro.ts`, y cambiar la `page.tsx` que ya existe para esa función (o crearla). Si la función no tiene
gráfico en `/vsl`, su visual va en `visuales-propios/<slug>.tsx` y se registra en `visuales-propios/index.tsx`. Antes de elegir un gráfico,
listar los grupos por índice (ver la trampa en `docs/hallazgos-landing.md`, entrada del 11/11).

## Lo que no se pudo probar

- **El motor de AI Avatar en vivo.** El puente a Flow que lo genera nunca se midió de punta a punta (hallazgos del 29/10) y la
  landing de avatares estaba pausada desde el 23/10. **Antes de mandarle anuncios a `/vsl/ai-avatar`, alguien genera un
  avatar real.**
- El mini-VSL de Panda en el hero de `/vsl/crm`: este entorno no llega a su CDN y se ve negro en las capturas.
- Motionads y ManyChat (los tapa Cloudflare; no se evade) y Skool (vacía sin sesión): se miran desde el Chrome de Martín.

## Lo que decide Martín

1. **¿Va una imagen real de un avatar en `/vsl/ai-avatar`?** Hoy el hero dibuja una escena con una silueta. Desde el 11/11
   main trae una imagen por preset (`public/formatos/presets/`), hechas con la cara de Martín: se pueden poner en el hero si
   él lo aprueba.
2. **¿Qué plan incluye AI Avatar ahora?** El 29/10 quedó en los tres planes (`lib/topes-plan.ts`), y el 11/11 pasó a usarse
   desde Video, que es sólo de Pro (`TABS_SOLO_PRO`). La landing dice «en todos los planes» porque el código lo sigue
   diciendo; si Esencial ya no lo trae, esa respuesta se cambia.
3. **¿AI Avatar entra a la grilla de funcionalidades de `/vsl`?** Hoy no está (serían 25 tarjetas); se llega por su link.
4. **El caso de Mauricio en `/vsl/offer`** dice «Sin cambiar la oferta. Sin cambiar el funnel.», en una landing que vende
   trabajar la oferta. Va porque es la prueba de todas las landings; si se lee en contra, se saca de ésa.
5. **¿Las landings nuevas entran a la grilla de funcionalidades de `/vsl`?** Hoy se llega a cada una por su link.

## Cómo seguir desde la nube

- Entorno con los hosts de la competencia permitidos: `mako-competencia`. `WebFetch` no sirve: se lee con Chromium de
  Playwright y `proxy: { server: process.env.HTTPS_PROXY }`.
- Tests: `node --import tsx --test tests/vsl-landings-competencia.test.ts`.
- **`.next/dev` crece sin parar** (llegó a 21 GB en esta sesión y llenó el disco: la máquina se reinició tres veces). Si la
  app se cae o la máquina se reinicia, `du -sh .next/dev`; se borra sin miedo, es caché. Tipos: `node scripts/tsc-acotado.mjs --heap=7000 …`.
- Veredicto y push con Node 24: `export PATH="$(sh scripts/node24.sh):$PATH"`, `node scripts/veredicto.mjs sacar`,
  `git push origin HEAD:punta/landings-competencia`.
