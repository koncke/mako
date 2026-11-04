# Relevo — los 20 templates del Dashboard (2/11/2026)

> ⚠️ **Corrección medida el 4/11/2026 (chat en la nube):** la rama `dashboard-denso-0111` YA está en el remoto, y todo su
> código ya estaba en `main` (el diff de `app/dashboard` y `lib/graficos-*` entre las dos daba vacío). Lo único que faltaba
> eran estos documentos y los mockups, que entraron con `punta/dash-base`. Las 20 hojas se construyeron en producción desde
> ahí: el estado de cada una está en [nube-dashboards.md](nube-dashboards.md). Lo de abajo es el relevo tal como se escribió.

Chat que replica los 20 templates del Dashboard copiando los dashboards de
`demo.codeandchill.store`. Martín: *«que implemente absolutamente todos los dashboards,
que siga esta metodología, que se asegure al 100%… que cada animación de entrada, clic
y hover estén correctas»*.

## ⚠️ DÓNDE ESTÁ EL TRABAJO (no está en main)

| | |
|---|---|
| Carpeta | `C:/dev/wt-dashboard-3110` |
| Rama | `dashboard-denso-0111` |
| Commit | `ee2246231` — *«Dashboard: las 4 primeras hojas y el movimiento leído del bundle de cada referencia»* |
| Pusheado | **NO.** La rama no tiene upstream y el commit no está en ninguna rama remota. |

**Esto es lo primero a resolver al retomar.** El trabajo son 3.430 líneas que viven en
un worktree y en ningún otro lado. La regla de limpieza de worktrees mira «limpio, sin
uso 24 h»: este worktree está limpio (el commit ya se hizo), así que un barrido lo
puede borrar y llevarse el commit. Hay que pushear la rama o moverlo.

No se pusheó a propósito: el Cerebro avisó que cada push a `integracion` cancela el run
anterior de Actions, y Martín pidió aprobar cada hoja antes de subir nada.

## En qué quedó

**Hechas 5 de 20** (`docs/diseno/mockups-dashboard/`, galería en `index.html`):
General, Comercial, Cobranza, Landing y Focus en dos variantes (Pane y Lumora).

**Falta construir 15.** El mapa de cuál sale de qué referencia está en
[`../templates-dashboard-propuesta.md`](../templates-dashboard-propuesta.md) §7.3:
Operación diaria, Marketing, Anuncio ganador, Hooks y retención, VSL y YouTube,
Instagram y redes, Chat Analyst, Closing, Automatizaciones, CS Analyst, Agencia o
servicio, Curso o comunidad, Productividad, Contenido e IA, Inmobiliaria.

**Lo que ya no hay que volver a hacer:** los 24 demos están medidos y el medidor quedó
en el repo (`docs/diseno/mockups-dashboard/medidor/`). Una hoja nueva es HTML con
`data-mk` + `data-grupo`; las animaciones salen de `movimiento.css`, que ya tiene la
librería de las seis familias (corbel, coffer, orvel, pane, lumora, prism).

**Cómo se mide y por qué así**:
[`../hallazgos-templates-dashboard.md`](../hallazgos-templates-dashboard.md).
Lo corto: animan con **GSAP**, que es invisible para `@keyframes`, `Element.animate`,
`getAnimations()` y el estilo computado en reposo. Se lee el bundle con `curl`, sin
navegador. Un cero medido con el vocabulario equivocado no es un cero.

## Lo que falta decidir con Martín

1. **Si la dirección de las 4 primeras está bien** — se las mostré el 1/11 y no alcanzó
   a contestar. Corregir el criterio en 4 hojas es barato; en 19 no.
2. **Las 4 hojas nuevas no tienen referencia todavía** (Anuncio ganador, Hooks y
   retención, VSL y YouTube, y lo que era Ads Analyst). Martín autorizó buscar afuera.
   ⚠️ La licencia se verifica abriendo el LICENSE, no la etiqueta de GitHub.
3. **Seis mediciones que MaKo no tiene** y sin las cuales esas hojas nacen vacías:
   retención por segundo del video, confianza de un A/B, cohortes M0–M5, motivos de
   baja contados, alcance y CTR antes del clic, y tiempo de foco por tarea.

## Para verlos

```bash
cd C:/dev/wt-dashboard-3110/docs/diseno/mockups-dashboard && python -m http.server 4900 --bind 127.0.0.1
```

Y abrir `http://127.0.0.1:4900/index.html`. ⚠️ Con el panel del navegador **oculto** la
página corre como background page: las animaciones se congelan en el primer fotograma
(que es `opacity:0`) y la captura sale **en blanco** con el DOM perfecto. No se verifica
con una foto: se adelanta cada animación con
`document.getAnimations().forEach(a => a.finish())` y se mide ahí.
