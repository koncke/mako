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
| `demos/<demo>/` | lo medido de cada demo (desde la PC): `INFORME.txt` (la entrada), `captura/pagina-1440.png` y `pagina-390.png`, `captura/valores.json` y `captura/estados/` |
| `closing/` | **Closing, copiado de Halden** (4/11/2026): `copia.html` (la copia exacta), `closing.html` (la adaptación), su propia hoja y su movimiento, y `captura/` para comparar |

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

**Lo quieto, el hover y el clic** salen de `medidor/capturar.mjs` (Playwright fuera del repo): la captura a 1440 y 390 (a 390×900,
sin emulación móvil: la copia se compara con ESE viewport), las variables, la letra, cada panel y cada control en reposo, al
pasar el cursor y al apretar.

```bash
NODE_PATH=<carpeta con playwright>/node_modules node capturar.mjs https://demo.codeandchill.store/halden/ ../demos/halden/captura --telefono
```

## Cómo se arma una hoja nueva (desde el 4/11/2026)

⚠️ **Cada hoja es la copia de SU demo, con su propia hoja de estilos y su propio movimiento.** Lo del lote 1 (`tokens.css`,
`movimiento.css`, `base.js`, una base común para todas) es lo que Martín rechazó el 4/11: *«son dashboard todos iguales»*.
El molde es `closing/`:

1. Elegir la referencia mirando las capturas lado a lado (`demos/<demo>/captura/pagina-1440.png`).
2. **La copia exacta** en `<hoja>/copia.html`, con los textos del demo, escrita desde `valores.json`, las capturas y la receta
   del INFORME (sin el código de la tienda). Se compara contra `pagina-1440.png` y `pagina-390.png` por franjas de tinta
   dentro de cada tarjeta, hasta que las páginas midan lo mismo.
3. **La adaptación** en `<hoja>/<hoja>.html`, con la MISMA hoja de estilos y el mismo movimiento: cambian los datos y los
   textos, y se sacan o se agregan piezas.
4. Lo que no se pudo copiar (lo que el INFORME no trae) se anota en el relevo, sin inventarlo.

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
