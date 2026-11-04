# Los mockups de los 20 templates del Dashboard

Réplicas de los dashboards de `demo.codeandchill.store` con los tokens de MaKo, para
que Martín los apruebe **antes** de que nada vaya al código.

**Para verlos:** servir esta carpeta y abrir `index.html`, que es la galería con las
20 hojas (las hechas se abren, las que faltan están atenuadas con su referencia).

```bash
python -m http.server 4900 --bind 127.0.0.1
```

## Los archivos

| Archivo | Qué es |
|---|---|
| `index.html` | la galería de las 20 hojas |
| `tokens.css` | la paleta mono de MaKo y el esqueleto de una hoja (de `../tokens-corbel.json`) |
| `movimiento.css` | **la librería de entradas, leída del bundle de cada demo** |
| `base.js` | el título letra por letra, el escalonado, los contadores y el cambio de tema |
| `general.html` `comercial.html` `cobranza.html` `landing.html` | las hojas del lote 1 |
| `focus-pane.html` `focus-lumora.html` | Focus en sus dos variantes (traen su propio CSS) |
| `comun.css` `comun.js` | la base vieja, que sólo usan los dos Focus |
| `medidor/` | el medidor que lee el movimiento del código fuente de los demos |

## Cómo se mide una referencia nueva

**Leyendo el bundle, no mirando la pantalla.** Estas plantillas animan con GSAP, que
escribe estilos en línea por `requestAnimationFrame`: no aparece en `@keyframes`, ni en
`Element.animate`, ni en `getAnimations()`, ni en el estilo computado en reposo. El
porqué completo está en [`../../hallazgos-templates-dashboard.md`](../../hallazgos-templates-dashboard.md).

```bash
cd medidor
python -I medir-demo.py corbel dashboard   # demo y la página que interesa
python -I medir-demo.py halden -           # '-' = sólo la librería y el armazón
python -I tabla.py corbel coffer orvel     # la tabla comparativa de recetas
```

`medir-demo.py` baja el HTML, saca el bundle, baja los chunks lazy, encuentra las
funciones con `.fromTo(`, cruza las tablas `export`/`import` para resolver **qué helper
es cada alias** y escribe `demos/<slug>/INFORME.txt`. Maneja las dos arquitecturas de
la familia: las vanilla (`page = {mount, enter}`) y las de React (GSAP dentro de
`useLayoutEffect`, donde no hay librería que resolver por alias).

## Cómo se arma una hoja nueva

1. Medir su referencia con el medidor y anotar a qué **selectores** llama cada helper
   (eso es lo que separa una plantilla de otra, no los valores).
2. Copiar un HTML del lote 1, poner `data-estilo` con la familia de entrada que
   corresponda (`corbel`, `coffer`, `orvel`, `pane`, `lumora`, `prism`).
3. Marcar cada pieza con `data-mk` (`kpi`, `card`, `fila`, `glbar`, `chip`, `sello`…) y
   envolver cada grupo escalonado en un `[data-grupo]`. El índice del stagger lo pone
   `base.js`; el HTML no lleva delays.
4. Los números que cuentan desde cero llevan `data-cuenta="1.3"` (la duración medida).
5. **Cada bloque termina en un link a la tab de MaKo donde se trabaja ese número.**

## Cómo se verifica

Con el panel del navegador **oculto** la página corre como background page: `rAF` no
corre, las animaciones se congelan en el primer fotograma (que es `opacity:0`) y la
captura sale **en blanco** aunque el DOM esté perfecto. Entonces no se verifica mirando
una foto ni esperando el reloj:

```js
document.getAnimations().forEach(a => a.finish());   // adelantar al final
[...document.querySelectorAll('[data-mk)')]          // y recién ahí medir
```

Y para el movimiento en sí, lo que se lee es el estilo computado, que es estático:
`animationName`, `animationDuration`, `animationTimingFunction`, `animationDelay`.
