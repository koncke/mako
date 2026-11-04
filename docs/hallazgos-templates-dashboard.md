# Hallazgos — las plantillas del Dashboard (copiar el movimiento de codeandchill)

Lo que aprendimos replicando los 20 templates del Dashboard sobre los demos de
`demo.codeandchill.store`. **No es el changelog**: eso está en el commit. Acá va lo que
hay que saber antes de tocar esto, y sobre todo los casos en que el diagnóstico obvio
era el equivocado.

El mapa de qué referencia le toca a cada hoja está en
[templates-dashboard-propuesta.md](templates-dashboard-propuesta.md).
Los mockups viven en `docs/diseno/mockups-dashboard/`.

---

## 1. La familia tiene DOS generaciones, y el documento viejo describe sólo una

`docs/diseno/movimiento-codeandchill.md` (31/10) concluye: **«No hay animaciones de
entrada que copiar. Nada aparece, se desliza ni escalona al entrar.»**

Eso es **cierto para fitlo y merrin** —que animan con View Transitions y `@keyframes`—
y **falso para pane, lumora, corbel, coffer, kestrel, halden, fernly, orrery y el
resto**, que animan con **GSAP** y tienen entradas escalonadas, letra por letra, con
staggers de 20 a 80 ms.

Las dos mediciones están bien hechas; miran plantillas distintas. La trampa es que el
documento no dice de qué generación habla, así que leerlo entero lleva a no copiar
nada. **Antes de concluir que una plantilla no anima, hay que mirar si trae GSAP.**

## 2. GSAP es invisible para todos los instrumentos obvios

GSAP escribe **estilos en línea por `requestAnimationFrame`**. No aparece en:
`@keyframes` · `Element.animate` · `getAnimations()` · el estilo computado en reposo ·
un hook sobre `Element.prototype.animate`.

**Un cero medido con el vocabulario equivocado no es un cero.** El único método que
funciona es leer el bundle:

1. Bajar el HTML del demo con `curl` — declara su bundle en `<script src>`.
2. Del bundle salen los chunks lazy: `grep -oE 'assets/[\w.-]+\.js'`. **No hace falta
   el navegador para nada de esto**, y es lo que hace la medición escalable a 24 demos.
3. Buscar las `function X(...)` cuyo cuerpo tenga `.fromTo(` → ésa es la librería, con
   sus duraciones, easings y staggers literales.
4. Cruzar `export{local as Exportado}` del bundle con `import{Exportado as local}` del
   chunk para saber **qué helper es cada alias**.
5. Leer la función de entrada del chunk → el ORDEN y los delays.

El medidor está en `docs/diseno/mockups-dashboard/` (ver el README de esa carpeta).

## 3. ⚠️ El diagnóstico obvio equivocado: «corbel casi no anima»

El extractor daba **18 helpers** y los principales «no se llamaban nunca». Parecía que
Corbel definía una librería y la usaba a medias.

**Era el extractor.** Buscaba el cuerpo de la función con `src.find('{', fin_del_nombre)`,
y en un bundle minificado eso cae en el **parámetro destructurado**:

```js
function xi(e,{y:t=26,stagger:n=.07}={}){ return q.fromTo(...) }
//           ^ el find('{') ingenuo toma ESTE objeto por cuerpo
```

El «cuerpo» resultante no contiene `.fromTo(`, así que la función no entra en la
librería y sus llamadas quedan sin resolver. Con el parser balanceado aparecen **25**.

**La regla: para hallar el cuerpo de una función minificada hay que saltar los
argumentos balanceando paréntesis, nunca buscar la primera llave.** Y vale el principio
general: cuando una cuenta exhaustiva da menos de lo esperado, sospechar del
instrumento antes que del objeto.

## 4. Lo que de verdad separa a una plantilla de otra

**Todas comparten la misma librería de entradas.** Lo que cambia es (a) los valores y
(b) **a qué SELECTORES se la aplica** — y eso segundo es lo que hay que medir.

Pane tiene en su librería el helper de tarjetas de Lumora (rotación ±3) y **no lo llama
ni una vez**. Corbel les aplica a sus tarjetas el helper de *tiles*. Adivinar qué
animación le toca a cada elemento, en vez de buscar la llamada, fue el error más caro
de la primera corrida: le puso a Pane la receta de Lumora tres veces seguidas.

| | título | tarjetas | tiles/KPI |
|---|---|---|---|
| **Pane** | `yPercent:115 rot:6` .85 power4.out stg .022 | iris: `clipPath inset(36%)→inset(0)` .9 expo.out | escalan desde `.6` |
| **Lumora** | igual que Pane | `y:40 rot:±3 scale:.94` .8 **back.out(1.4)** | `y:34 scale:.985` .9 power3.out |
| **Corbel** | `yPercent:110 rot:5` **.8** stg **.02** | el helper de TILES: `y:26 scale:.985` .9 **expo.out** stg .07 | `y:14` .6 power3.out stg .08 |
| **Coffer** | `yPercent:115` **sin rotación** .85 stg .022 | `y:30 rot:±1` .9 power3.out | `y:34 scale:.985` stg .06 |
| **Orvel** | — | `y:30 scale:.97` .6 **back.out(1.5)** | — |
| **Prism** | `yPercent:100 opacity:0` .45 power3.out | `y:16` .75 power3.out | `scale:1.08` .7: entra **achicándose** |

## 5. La entrada es más corta cuando ya estuviste ahí

Lo repite toda la familia y es el detalle que más se nota sin poder nombrarlo:

- Corbel: `r = primeraVez ? 1 : .6` y `delayBase = primeraVez ? .15 : .05` — al volver,
  la entrada corre **al 60 %** y empieza antes.
- Coffer: `y: cambiandoDePagina ? 14 : 34` — la misma animación, menos distancia.

Una entrada que dura lo mismo la décima vez que la primera se siente lenta aunque esté
bien medida.

## 6. Gestos que ninguna de nuestras hojas tenía

- **El bloque «te está esperando»**, con el motivo al lado y el botón que lo resuelve
  (Orvel, Moorly, Murmura, Noria, Coffer). Es lo que convierte un informe en una
  herramienta.
- **Cada bloque termina en un link al lugar donde se TRABAJA ese número** (Corbel:
  `Ver órdenes`, `Ver analytics`). Ésa es la respuesta a «¿tabs dentro del Dashboard?»:
  no hacen falta, hace falta que cada bloque sepa a qué tab de MaKo te manda.
- **La línea del gráfico se DIBUJA**: `strokeDasharray 100 100, offset 100 → 0`, 1,3 s
  `power3.inOut`; el área aparece a +0,6 s y el punto hace `scale 0 → 1` con
  `back.out(3)` a +1,15 s.
- **El promedio entra ÚLTIMO**, a 1,45 s, cuando todo lo demás ya está quieto.
- **El ícono del tema gira**: `{rotation:-90, scale:.6}` → .6 s `back.out(2)`.
- **El número que flota y se va** (`float-up`) cuando algo cambió por una acción tuya.
- **El error escrito como instrucción** (Corvane): «£704,85 volvió — cuenta cerrada.
  Confirmá sus datos bancarios y reintentá», con el botón al lado.
- **La tarjeta que avisa que NO obedece al filtro de fecha** (Prism: «Vista larga · no
  filtrada por rango»). Honestidad del dato.
- **El único elástico de la familia** es el sacudón del error: `elastic.out(1, .3)`.

## 7. Trampas de CSS al pasar GSAP a hojas de estilo

**El atajo `animation:` pisa `animation-delay`.** Una regla global
`[data-mk]{animation-delay:calc(…)}` queda anulada en cuanto una regla más específica
usa el atajo, porque `animation:` incluye el delay y lo pone en 0. Resultado: **toda la
entrada deja de estar escalonada y pasa a ser simultánea**. Se lee perfecto en el CSS y
se ve mal en la pantalla. El delay va DENTRO del atajo:
`animation:nombre .6s var(--p3) var(--paso) both`.

**El índice del escalonado se cuenta por contenedor de grupo, no por padre inmediato.**
Una barra suele ser hija única de su columna: agrupar por padre le da índice 0 a las
doce y entran todas juntas. Hay que buscar el ancestro `[data-grupo]`.

**El título se parte por PALABRA y después por letra** (así lo hace Coffer). Partir sólo
por letra deja que el salto de línea corte una palabra al medio. Y **cada letra necesita
su máscara con `overflow:hidden`**: sin eso se ven todas desde el primer cuadro y el
gesto se pierde — sólo «flotan».

**Volver a disparar la entrada no puede hacer `style.animation = ''`**: ese atajo borra
el `animation-delay` que cada letra lleva en línea, y al repetir entran todas juntas,
distinto que al recargar. Hay que replayar la animación declarada
(`a.cancel(); a.play()`), sin tocar ningún estilo.

## 8. ⚠️ La pestaña en segundo plano: el error que ya nos costó dos veces

Con el panel del navegador oculto, la página corre como *background page*: `rAF` no se
ejecuta y **las animaciones quedan congeladas en el primer fotograma**, que en una
entrada es `opacity:0`. La captura sale **en blanco** y el DOM mide perfecto. Medir
«opacity = 0 después de 3 segundos» ahí no dice nada sobre el CSS.

Dos instrumentos que sí sirven con el panel oculto:

1. `document.getAnimations().forEach(a => a.finish())` y medir el estado final: no
   depende del reloj ni de la visibilidad.
2. Leer `animationName / Duration / TimingFunction / Delay` del estilo computado, que
   son estáticos.

**Y es un problema de producto, no sólo de medición:** si la pestaña se abre en segundo
plano, la persona vuelve y encuentra la pantalla vacía. GSAP lo disimula porque su
ticker se pone al día; el CSS no. La guarda está en `base.js`: si `document.hidden` al
cargar, la entrada se posterga hasta el `visibilitychange`.

## 9. Trampas del entorno (no son de este proyecto, pero cuestan igual)

- **Un backtick literal rompe un heredoc de bash** aunque el delimitador esté entre
  comillas (`<<'PYEOF'`): el archivo se escribe truncado y sin error claro. En un script
  de Python que parsea bundles de JS —llenos de backticks— hay que escribir el archivo
  con la herramienta de archivos, o generar el carácter con `chr(96)`.
- **`python -I` implica `-E`**, así que `PYTHONIOENCODING=utf-8` **no tiene efecto**. La
  consola de Windows es cp1252 y un `→` en un `print` mata el script con
  `UnicodeEncodeError`. Hay que hacer `sys.stdout.reconfigure(encoding='utf-8')` dentro
  del script.

## 10. Lo que quedó SIN hacer

- **15 de las 20 hojas.** Hechas: General, Comercial, Cobranza, Landing y Focus (en dos
  variantes). El mapa de las que faltan, con su referencia, está en
  [templates-dashboard-propuesta.md](templates-dashboard-propuesta.md) §7.3 y en la
  galería `docs/diseno/mockups-dashboard/index.html`.
- **Las 4 hojas nuevas no tienen referencia todavía**: «Anuncio ganador», «Hooks y
  retención», «VSL y YouTube» y la de Ads Analyst que se partió en dos. Martín autorizó
  buscar plantillas afuera. ⚠️ **La licencia se verifica abriendo el LICENSE, no la
  etiqueta de GitHub**: ya pasó que `NOASSERTION` escondía un MIT y que un repo de Meta
  era propietario.
- **Seis mediciones que MaKo no tiene** y sin las cuales esas hojas nacen vacías:
  retención por segundo del video, confianza estadística de un A/B, cohortes M0–M5,
  motivos de baja contados, alcance y CTR antes del clic, y tiempo de foco por tarea.
- **Nada de esto está conectado a datos reales**: los mockups son HTML con números de
  ejemplo. Falta la pasada de llevarlos al modelo de hojas del Dashboard.
- **Sin medir**: el hover y el clic de las plantillas que todavía no se construyeron
  (los `:hover` de cada demo sí están extraídos en `demos/<slug>/INFORME.txt` de la
  corrida, que es temporal: si se necesitan, se vuelven a bajar con el medidor).
