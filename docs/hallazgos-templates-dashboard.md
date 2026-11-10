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

## 10. Las 20 hojas en producción (4/11/2026, chat en la nube): lo que costó

Martín: *«Haz todo lo de los dashboards… subelas a producción directo y los reviso allí. Y no solo 4, haz todo»*.
Cada hoja es una punta (`punta/dash-<hoja>`); qué hay en cada una y qué mirar, en
[relevo/nube-dashboards.md](relevo/nube-dashboards.md).

**Vive en:** `lib/graficos-frase.ts`, `lib/graficos-destinos.ts`, `lib/graficos-portadas.ts`, `lib/general-plantillas.ts`,
`lib/graficos-plantillas.ts`, `lib/graficos-plantillas-analysts.ts`, `lib/graficos-plantillas-generales.ts`

- **Los gestos de las referencias se copiaron como PIEZAS, no como hojas.** La frase de apertura (Orvel, Pane, Noria) es un
  tipo de gráfico (`frase`), el «Ver … →» del pie es un campo de cualquier gráfico (`ir`, contra un catálogo cerrado de
  destinos) y el subtítulo de un panel ya no se borra al acomodar. Así lo hereda cualquier hoja, también la que arma MaKo
  por la API. Una frase pierde el tramo que no se pudo leer en vez de decir «falta».
- ⚠️ **«Invertida» NO es «la mala noticia»: es el ANCLA, el número que contesta la pregunta de la hoja.** Lo escribí mal en
  tres mensajes de commit (Por cobrar, Deuda vencida, Costo por mil) antes de leer el comentario de `invertida` en
  `lib/graficos-catalogo.ts`; en dos de las tres el ancla elegida además no contestaba la pregunta. Antes de elegirla:
  ¿este número es la respuesta a la pregunta de la tabla de §7.3?
- ⚠️ **El `motivo` de la cartera es el de la SEÑAL, no el de una baja.** `filasCartera` lo saca de
  `MOTIVO_DE_REGLA[c.senal.regla]`. Una barra «Por qué se van» filtrada por estado «Baja» habría mostrado la regla que
  prendió la señal de esos clientes, con cara de motivo de baja. La hoja dice «Por qué piden atención»; el motivo de baja
  sigue sin guardarse (§7.4).
- **Cada `comparar` en la VSL es otra lectura de los eventos del video**, lo más pesado del Dashboard (`hallazgos-graficos.md`,
  «La hoja Landing tardaba 51 s»). Su frase va sin «que el período anterior».
- **Las vistas del VSL (YouTube y Panda) las tiene UN cliente.** `negocio.vistas_vsl` sale de una tabla que hoy llena uno
  solo; para los demás esos dos números quedan sin dato. Está escrito en la cabecera de la plantilla.
- **El test de «cada dato una vez» de General no mira la fecha.** «Clientes en entrega hoy» y «Avanzaron de etapa» (la misma
  métrica con otra fecha) cuentan como el mismo dato. Se cambió una de las dos piezas, no el test: en la referencia tampoco
  se repite.
- **«Ninguna forma domina» medía la primera fila, y con la frase todas abrían igual.** Ahora mira la estructura debajo de la
  frase (`tests/graficos-corbel.test.ts`). Pasó al agregar la frase número 15: las anteriores seguían dando 4 aperturas.
- **Las coordenadas crudas de una plantilla de Analysts no se pueden pisar aunque `comoDenso` las rehaga.**
  `tests/graficos-analysts.test.ts` mira el `armar` crudo: una frase en `y: 0` corre todo lo de abajo tres filas.
- **«Pendientes del CRM» no va en ninguna plantilla** (decisión del 1/11, `tests/general-editor.test.ts`): Operación diaria
  quería «Te está esperando» y usa «Lo que vence».
- **Ads Analyst se partió en dos sin cambiar de id.** «Anuncio ganador» sigue siendo `ads-analyst` (lo nombran
  `/ads-analyst`, `lib/mako-capacidades.ts`, `lib/retro-reporte.ts` y la migración v5) y «Hooks y retención» es una hoja
  nueva. Igual «Instagram y redes» (`instagram`) y «VSL y YouTube» (`vsl-analyst`): renombrar el id rompía links guardados.
- **Las puntas se subieron EN CADENA**: cada una lleva las anteriores, porque todas tocan las mismas listas (`PORTADAS_GENERAL`,
  `portadasDashboard`, los colores) en líneas vecinas y en paralelo chocaban al mezclar main. Si una llega antes que la de
  atrás, lleva a las de atrás con ella; si una da rojo, las de adelante también.
- **Los tests de `api-mako-*` que cargan el registro con `--conditions=react-server` fallan en el contenedor de la nube**
  («does not provide an export named MAKO_ACCION_TOOLS»), también sobre `main` sin cambios: es el entorno, no el código.

## 10 bis. ⚠️ El diagnóstico equivocado: creer que «todas iguales» era eficiencia (4/11/2026)

Martín rechazó las 20 hojas el mismo día: *«son dashboard todos iguales, horribles… agarraste un template y lo estandarizaste
para todos»*. El pedido era otro desde el principio: **cada hoja es la COPIA EXACTA de un demo** (como la maqueta de Focus, que
copiaba a Pane con su letra, sus colores, su grilla y su movimiento) **y recién después la adaptación** a los datos de MaKo.

- **La base común fue el error, no un detalle de cada hoja.** Una frase, un ancla oscura, el «Ver … →» y la misma grilla de
  `comoDenso` en todas hacen que veinte referencias distintas salgan con la misma cara. Lo que se comparte es el DATO (los
  conjuntos, la API); la apariencia, nunca.
- **Copiar «el gesto» no es copiar.** §7.2 de la propuesta listaba doce gestos sueltos de veintisiete demos; llevarlos a todas
  las hojas fue lo contrario de lo que pedía la regla de la casa (AGENTS.md: una referencia de estilo se copia con sus valores).
- **La vara es la maqueta de Focus** (`docs/diseno/mockups-dashboard/focus-pane.html`, commit `ee224623`): su propia letra
  (Urbanist), su paleta oscura, sus tiles, sus dos columnas iguales con gap 14, medidas del demo.
- **Sin el demo a la vista no hay copia.** Esta sesión no llega a `demo.codeandchill.store` (403 del proxy). Lo destrabó la
  PC midiendo los demos (`demos/<demo>/`: INFORME, capturas, `valores.json` y estados), y desde ahí se copió Closing (§12).

## 12. Copiar un demo hasta el píxel: cómo se mide la copia (4/11/2026, Closing ← Halden)

**Vive en:** docs/diseno/mockups-dashboard/closing/ (copia.html, closing.html, closing.css, closing.js)

- **Se compara por FRANJAS de tinta dentro de cada tarjeta, relativas a su borde de arriba**, no a ojo ni por coordenadas
  absolutas. Una diferencia de 3 px arriba se arrastra a todas las filas de abajo y parece que todo está mal; medido contra el
  borde de cada tarjeta, se ve qué bloque es el que sobra. Con eso la copia de Halden quedó con las dos páginas del mismo alto
  (1440×959 y 390×2627) y cada bloque a 0-2 px.
- ⚠️ **Lo que parece la punta de una barra puede ser la flechita de su etiqueta.** El escaneo dio el martes «a 501» y eran los 4 px
  de la flecha del tooltip, 19 px arriba de la barra: la copia salió con la barra más alta del gráfico. Antes de creerle a un
  borde, mirar qué otra cosa se dibuja arriba.
- ⚠️ **`capturar.mjs` mide el teléfono a 390×900 SIN emulación móvil.** Comparar con un viewport de 844 o con `isMobile` mueve todo
  lo fijo (la barra de abajo cae en otro lugar de la página entera) y no se parece a nada. Se compara con el MISMO viewport.
- **Halden esconde en la compu las filas que no entran** (la 5.ª de la lista, la 3.ª del asistente) y el teléfono las muestra: una
  copia de una sola captura pierde lo que la otra muestra.
- **Lo que se ubica sobre algo que está entrando se mide con `offsetLeft`/`offsetTop`, no con `getBoundingClientRect`**: la tarjeta y
  la barra todavía tienen su `transform` de partida y la etiqueta quedaba al pie de la barra, adonde la barra arrancaba.
- **El INFORME corta las líneas largas** (`....`): lo que viene después del corte no está medido. Se copia hasta ahí y lo demás se
  anota como no copiado (la entrada del título, `bo`, no figura entre los helpers; la cuota y el reloj no tienen entrada).

## 13. Llevar la copia al Dashboard: tres trampas que la maqueta no tenía (4/11/2026, Closing)

- **«Nueva hoja» poda los gráficos que hoy dan vacío** (`podarSinDatos`, regla de Martín del 13/10: «no crear un montón de
  gráficos vacíos»). En la grilla está bien; en un diseño propio no: el bloque se dibuja igual, y sin su gráfico no se llena
  nunca, aunque mañana haya datos. Un Closing creado en una semana sin llamadas perdía «Llamadas de esta semana» para
  siempre. Ahora la poda no toca las piezas del diseño **ni lo que leen sus cajas de MaKo** (la caja de Closing lee un
  gráfico que no es pieza: sin eso, se iba igual). Lo fija `tests/dashboard-diseno-closing.test.ts` (9).
- **El reset de la hoja copiada le ganaba a sus propias clases.** `.hc button{background:none}` (0,1,1) le gana a
  `.hc-btn--primary` (0,1,0): el botón principal salía blanco y los links negros. En la maqueta no pasaba porque el reset
  era `button{}` suelto. Va `.hc :where(button)` (0,1,0, y el orden decide). Al limitar una hoja copiada a una clase raíz,
  los resets por etiqueta van con `:where()`.
- **El ancho del medio no está en el demo.** Halden se capturó a 1440 y 390, y el lienzo real del Dashboard (con la barra y
  la lista de hojas) en una ventana de 1024 mide ~780: ahí las tres columnas no entran (el reloj se cortaba, los títulos
  iban palabra por palabra). Se agregó un paso a dos columnas, y se dice que es nuestro. Una copia nueva se mide también en
  el ancho del lienzo, no sólo en el de la ventana.
- **Lo que el diseño necesita se busca primero en lo que la plantilla YA tiene.** Sumar un gráfico por bloque dejó la plantilla
  en 16 paneles y con dos frases (`tests/graficos-corbel.test.ts`: una frase, que abre, y 14 paneles como mucho). «Cómo
  terminaron» salió de dos columnas más en la tabla del equipo (sus totales cuentan todas las filas, no sólo las que se ven), y
  el anillo que contaba lo mismo se fue. Una tabla ordena por su primera métrica: «las últimas» no puede salir de una tabla
  ordenada por score, y por eso tiene la suya.
- **Un texto de MaKo es más largo que el del demo**: «7 de 18 llamadas de cierre terminaron en venta» partía en dos columnas
  en el teléfono. Se mira cada texto adaptado en 390 antes de darlo por copiado.

## 14. «Nueva hoja» se trababa y la miniatura de Closing no se parecía (4/11/2026, chat en la nube)

- **Síntoma → causa.** «Al abrir ese modal se traba todo»: el modal montaba las 21 miniaturas y, en cuanto se veían, sus gráficos (≈241
  tarjetas, 33 gráficos a la vista, animados en bucle). Armar las hojas de muestra eran 15 ms: el diagnóstico obvio («arma las 21 hojas») era
  el equivocado. Medido con el componente de verdad en un arnés: 0,4–0,5 s y una tarea larga de 0,2–0,3 s; con la CPU 4× más lenta, 1,9 s.
- **La miniatura dibujaba la GRILLA** de la plantilla y la hoja se mira con su DISEÑO: dos cosas distintas con el mismo nombre. Una plantilla
  con `diseno` se dibuja con su componente (`DisenoEnMiniatura`), quieto.
- **Los números de muestra de una tarjeta de grilla no sirven para un diseño:** un «puntaje» de muestra salía 50 (la escala es de 0 a 10) y
  una llamada de 2,5 h. El diseño lleva los suyos, con la forma que lee.
- **Una etiqueta no es una fecha.** La columna `dia` de una tabla llega como «03/11» (`etiquetaTiempo`): ordenarla como texto mezcla los
  meses. Y el test pasaba porque le daba ISO: **un test se arma con la forma que da el agregador, no con la que espera el lector.**
- **Lo que se ofrece se deriva del dato** (`esPlantillaOfrecida`: trae su diseño), no de una lista: lo viejo sigue para quien lo tiene.

## 15. Cobranza: un nombre de archivo que engaña y un chequeo de tipos que no terminó (4/11/2026, chat en la nube)

- **`lib/graficos-plantillas-generales.ts` NO es General.** Sus plantillas («las del resto de MaKo, una por área») entran a
  `PLANTILLAS_HOJA`, o sea al DASHBOARD; las de General son `lib/general-plantillas.ts`. Se enchufó el saludo de Cobranza en
  `FocusDeGeneral.tsx` y el test lo cazó buscando la plantilla en `PLANTILLAS_GENERAL` (`undefined`). Antes de montar el diseño de una hoja,
  `grep -n "PLANTILLAS_GENERALES" lib/graficos-plantillas.ts` dice de qué informe es. **Vive en:** app/dashboard/page.tsx (el saludo de las dos hojas con diseño).
- **«NO SE PUDO CHEQUEAR (código undefined)» de `scripts/tsc-acotado.mjs` era el tope de heap, no un rojo:** con `EditorInforme.tsx` adentro
  arrastra media app y no entra en los 2560 MB por defecto. En la nube (15 GB libres, sin otros chats) se corre con `--heap=6000` y da verde.
  En la PC compartida no se sube a ojo: ahí manda el lock. **Vive en:** scripts/tsc-acotado.mjs.
- **Copiar un `<a>` de la maqueta como `<button>`** (las filas que abren su cuota) trae `text-align: center`: las clases de esas filas llevan
  `text-align:left` (la regla de AGENTS.md, «Cambiar la ETIQUETA de un elemento»). Y donde no hay a dónde ir (la pieza no está), va un `div`: un
  botón que no hace nada se lee como roto. **Vive en:** app/dashboard/disenos/HojaCobranza.tsx (`Toque`).

## 16. Focus: una regla de la hoja copiada que le pega a un componente de adentro, y una palabra que frenó una punta (4/11/2026, chat en la nube)

- **`.fp-big span` le pegó a la cifra que cuenta.** En la maqueta, «9 vencen esta semana» es `<b>9</b><span>vencen…</span>`, y la regla del
  `span` (15 px, gris) estaba bien. En el componente el 9 es `<b><Cuenta/></b>`, y `Cuenta` dibuja su propio `<span>`: el 9 salió en 15 px.
  Leyendo el CSS no se ve; lo encontró poner la captura del componente al lado de la de la maqueta. **Al pasar una hoja copiada a React, una
  regla por etiqueta que tenga un componente adentro va con `>`** (`.fp-big>span`). **Vive en:** app/dashboard/disenos/focus-css.ts.
- **Las clases de una hoja copiada llevan el prefijo de la hoja, todas.** Pane se llama `.card`, `.btn`, `.grid`, `.chip`, `.dot`, `.bar`, y la
  casa usa los mismos nombres. Envolver en `.fp` no alcanza: una regla de la casa con más especificidad le gana igual. **Vive en:**
  app/dashboard/disenos/focus-css.ts.
- **La guarda del voseo no corre en el filtro chico del pre-push, y frenó la punta de Cobranza por un «acá».** Es una barredora: en GitHub corre
  siempre y en la PC el filtro elige por lo que cambió. Antes de subir un texto nuevo de pantalla se corre
  `node --import tsx --test tests/puente-panel-copy.test.ts` (3 s). **Vive en:** app/dashboard/disenos/HojaCobranza.tsx.
- **Y ese mismo archivo trae otro guard que una hoja copiada pisa: todo `var(--fs-*)` tiene que ser un token de la casa.** La variable propia
  del título de Pane se llamaba `--fs-title` y daba rojo aunque estaba definida adentro de `.fp`: una variable de una hoja copiada lleva el
  prefijo de la hoja (`--fp-title`). Lo encontró correr las barredoras sueltas: en esta máquina (node 22) los grupos compartidos de
  `tests-afectados` no corren y la herramienta dice «SIN CHEQUEAR». **Vive en:** app/dashboard/disenos/focus-css.ts.
- **Una hoja que dibuja varios bloques en uno necesita los datos de General enteros, no los de una pieza.** El contexto de General prestaba
  `dibujar`, `muestra` y `variables` por bloque; ahora presta también `datos`, y la hoja Focus arma lo suyo con un modelo puro
  (`vistaFocus`). El control de la meta (Trimestre · Año) de la maqueta no se pasó: con una sola meta no cambia nada. **Vive en:**
  app/dashboard/ElementoGeneral.tsx, lib/focus-diseno.ts.
- **Desde una sesión de la nube no se le puede escribir al Cerebro** si la sesión no puede llegar a las otras de Martín: el mensaje vuelve
  rechazado y pide un permiso que no se pide por un pedido de otra sesión. El estado va arriba del relevo (`docs/relevo/nube-dashboards.md`).

## 17. «Mi día» (Lumora): el mes que no cabía en cinco semanas y un prefijo que no tocaba las clases compuestas (4/11/2026, chat en la nube)

- **Un mes en grilla de lunes a domingo puede tocar SEIS semanas.** El modelo cortaba en 35 días y noviembre de 2026 (empieza domingo, termina
  lunes) quedaba con el 30 afuera. Lo encontró el test al ejecutar el modelo con la fecha de hoy. Lo que decide si va una fila más es si esa
  fila ARRANCA en el mes siguiente, no un número de días. **Vive en:** lib/mi-dia-diseno.ts (`mesDe`).
- **Al prefijar las clases de una hoja copiada, las compuestas cuentan.** El primer intento usaba una regex que no tocaba lo que viene pegado a
  otra clase (`.ribbon__it.is-now` quedaba `.ld-ribbon__it.is-now`): la regla nunca coincidía y el bloque «Ahora» salía sin su borde. Se prefija
  todo `.nombre` fuera de los comentarios. **Vive en:** app/dashboard/disenos/mi-dia-css.ts.
- **«La próxima llamada» es la que todavía no empezó.** Con «la que no terminó», la que está corriendo aparecía como próxima en la tarjeta de la IA,
  en el número y en los recordatorios, al lado de la cinta que la marcaba «Ahora». **Vive en:** lib/mi-dia-diseno.ts.
- **Una cinta que se corre sola sólo lo hace si lo que importa quedó fuera de la vista.** Correrla siempre hasta el ahora cortaba el primer bloque
  aunque entrara todo. **Vive en:** app/dashboard/disenos/HojaMiDia.tsx.
- **Un id de diseño con guion va entre comillas en la tabla de miniaturas,** y el test que buscaba la clave sin comillas daba rojo. Se buscan las dos
  formas. **Vive en:** tests/dashboard-plantillas-ofrecidas.test.ts.
- **Un bloque de General que se agrega a mano no va en una plantilla.** `pendientes`, `kpis` y `mes` están en esa lista a propósito, y
  `tests/general-editor.test.ts` lo frena. **Vive en:** lib/general-plantillas.ts.

## 18. General (Orvel): un corte del medio que le ganaba al del teléfono y un tsc acotado que se quedaba sin memoria (4/11/2026, chat en la nube)

- **Dos `@container` que se pisan los decide el ORDEN, no el ancho.** El corte del medio («≤ 1040: las filas de tres pasan a dos») iba en la cola,
  DESPUÉS del corte del teléfono («≤ 760: una columna»). A 390 los dos coinciden, gana el de abajo, y la página medía 505 px de ancho en una
  pantalla de 390. Lo encontró el arnés midiendo `scrollWidth`, no la captura a 1440. Cada corte más chico repite lo suyo DESPUÉS del más
  grande. **Vive en:** app/dashboard/disenos/general-css.ts.
- **Un botón de más en una cabecera medida parte la frase en dos renglones.** «Ver todo en la grilla» como botón de texto bajó la cabecera de 100 a
  125 px y corrió todo lo de abajo. Va como el botón de ícono de la barra de arriba de Orvel (con su `aria-label`): las nueve cajas vuelven al
  mismo píxel de la maqueta. **Vive en:** app/dashboard/disenos/HojaGeneral.tsx.
- **Una etiqueta del eje con plata de verdad es más ancha que la del demo.** Con el margen medido en Orvel (35 px), «US$10k» quedaba encima de la
  curva. El primer punto cae, como mínimo, a la derecha de la etiqueta más ancha. **Vive en:** app/dashboard/disenos/HojaGeneral.tsx (`Grafico`).
- **`tsc-acotado` sobre algo que importa `DatosGeneral` necesita más heap que el de por defecto** (2560 MB): salía con 99 («no se pudo chequear»,
  el proceso muerto por memoria), que NO es un verde. Con `--heap=8000` dio 0. **Vive en:** scripts/tsc-acotado.mjs.
- **«Te deben» usa las cuentas de Cobranza, no unas nuevas.** La pieza nueva de la plantilla es la misma consulta que «Cuánto hace que esperan» y
  el modelo llama a `debenDe`: dos cuentas de lo mismo dirían dos números en dos hojas. **Vive en:** lib/general-diseno.ts, lib/general-plantillas.ts.
- **La entrada de la página de Orvel no está en su INFORME** (sólo la del armazón). No se inventó: las tarjetas quedan quietas. **Vive en:**
  app/dashboard/disenos/HojaGeneral.tsx (cabecera).
- **Un link de la MUESTRA de la miniatura también es un link de la app.** La miniatura de General llevaba un ejemplo con `href: '/integraciones'`
  y `tests/integracion-sin-salir.test.ts` frenó la punta en el veredicto: el guard barre `app/` entero y no sabe que es una muestra. La muestra
  lleva a una pantalla que no sea /integraciones (`/ads-manager`). **Vive en:** app/dashboard/disenos/DisenoEnMiniatura.tsx.

## 19. «Operación diaria» (Moorly): una clase que vivía en el armazón y una marea que se medía, no se adivinaba (4/11/2026, chat en la nube)

- **Sacar el armazón del CSS copiado se puede llevar una clase que usa la PÁGINA.** El círculo de las iniciales (`.av`) estaba definido en la parte
  del armazón de `moorly.css` (lo usa el avatar de la barra de arriba) y lo usan también las llamadas y la espera. Al dejar sólo la página, los
  círculos salían sin forma. Antes de cortar el armazón, buscar en el HTML de la página cada clase que se define en la parte que se saca.
  **Vive en:** app/dashboard/disenos/operacion-css.ts (la cola: `.mo-av`).
- **La marea de las llamadas se mide en el demo, no se deduce del dibujo.** Las barras de Moorly tienen 119 px de alto útil, cuatro líneas
  punteadas cada 30 px y la más alta llega a la MITAD (el tope es el doble del máximo). Con un tope igual al máximo, la barra más alta tocaba el
  borde y no se parecía en nada. **Vive en:** app/dashboard/disenos/HojaOperacion.tsx (`Marea`, `escalaOperacion`).
- **La copia a 390 medía más que la pantalla.** Las pestañas del gráfico (Cobrado · Agendas · Cierres) iban en el mismo renglón que el título y no
  bajaban. En el teléfono, el título y las pestañas van en dos renglones, como en el demo de Moorly a ese ancho. Lo encontró el arnés midiendo
  `scrollWidth` a 390. **Vive en:** docs/diseno/mockups-dashboard/operacion-moorly/moorly.css y app/dashboard/disenos/operacion-css.ts.
- **«Te está esperando» tiene un orden, y el test lo fija.** Primero lo vencido (cuotas y tareas), después los leads por marcar, después lo que vence
  pronto. Una de las seis roturas que el test caza es poner los leads antes que las tareas vencidas. **Vive en:** lib/operacion-diseno.ts.
- **Lo que Moorly tiene y MaKo no hace no se inventa:** la caja para agregar un pendiente y la plata de cada etapa del funnel. La entrada de la
  página tampoco está en su INFORME, igual que en Orvel. **Vive en:** lib/operacion-diseno.ts (cabecera).

## 20. Comercial (Selvar): una frase que perdía dos métricas sin avisar y un tope de 14 paneles (4/11/2026, chat en la nube)

- **El saneo de una pieza RECORTA las métricas en silencio.** Una frase lleva hasta 4 (`maxMetricas` del tipo, lib/graficos-catalogo.ts):
  la plantilla declaraba seis para la apertura y la hoja creada salía con las primeras cuatro, sin un error. El diseño se quedaba sin «no
  vinieron» y la barra de Selvar mentía. Lo cazó el test del cableado (`tests/dashboard-diseno-comercial.test.ts`), que instancia la
  plantilla y mira las métricas que QUEDARON, no las declaradas. **Vive en:** lib/graficos-plantillas.ts (COMERCIAL).
- **Una hoja del Dashboard lleva entre 8 y 14 paneles y una sola frase** (`tests/graficos-corbel.test.ts`). Las piezas que pide un diseño
  entran en ese tope: lo que se puede calcular (el costo por agenda, el retorno) se calcula en el modelo y no se pide como otra pieza, y
  «por mes» reusa la Tendencia que ya estaba. **Vive en:** lib/comercial-diseno.ts (`vistaComercial`).
- **Un atajo de la adaptación con el mismo peso que el del teléfono le gana.** `.dl__row.fila { padding: 0 8px }` (para que la fila que
  se toca tenga su hover) le pisaba el `padding: 12px 0` del teléfono por especificidad: en la maqueta las filas quedaban pegadas. Va con
  `padding-left` y `padding-right`, nunca el atajo. **Vive en:** docs/diseno/mockups-dashboard/comercial-selvar/selvar.css.
- **`.card__h > div { flex: 1 }` también estiraba el selector de Semanas · Meses.** En la captura a media escala se veía bien; medido, el
  selector ocupaba media tarjeta. Va `:first-child`. **Vive en:** app/dashboard/disenos/comercial-css.ts.
- **La entrada de la página de Selvar no está en su INFORME** (sólo la del armazón), como en Orvel y Moorly. No se inventó.

## 21. Marketing (Kestrel): la letra que en MaKo es otra, el borde que delataba un ancho, y un test que daba por fijo un orden (4/11/2026, chat en la nube)

- **«Geist» en MaKo es Urbanist.** `app/globals.css` declara la familia «Geist» con los archivos de Urbanist (desde el 31/10). Una copia que
  usa Geist de verdad (Kestrel) no puede pedir «Geist» ni cargar la hoja de Google de Geist: lo primero da Urbanist en silencio, y lo segundo
  le cambia la letra a TODA la app mientras el Dashboard está abierto (la hoja con `precedence` se queda en el head). Va `@font-face` con un
  nombre propio («Kestrel Geist») y los archivos de gstatic. **Vive en:** app/dashboard/disenos/marketing-css.ts.
- **Un borde de 1 px se mide por lo de ADENTRO, no por la tarjeta.** Las cajas de las tarjetas daban bien y los recuadros de adentro medían
  260 contra los 258 de Kestrel: la tarjeta tiene un borde. Mirar sólo los paneles de `valores.json` no lo muestra. **Vive en:**
  docs/diseno/mockups-dashboard/marketing-kestrel/kestrel.css.
- **Con la segunda plantilla sugerida para el mismo canal, «la primera» deja de ser fija.** `tests/plantillas-sugeridas.test.ts` esperaba
  a Closing primera para quien vende por llamada; con Comercial ofrecida (también para «llamadas», y antes en la galería) la primera es
  Comercial. Era un rojo de verdad del test, no del código: ahora compara contra lo que calcula la galería (`ordenarConSugeridas`). Una hoja
  nueva que se ofrezca para un canal que ya tiene una sugerida puede volver a mover ese orden.
- **El `align-items` del medio se hereda en el teléfono.** El medio (761-1040) pone la columna de la derecha en grilla con `align-items:
  start`; el teléfono la vuelve `flex` en columna, y con `start` la tarjeta se achicaba a su contenido (289 de 366). Va `stretch`.
- **Una frase de un renglón no repite lo que dice un número.** «…cada una costó US$91, US$4 menos que el período anterior» pasaba a dos
  renglones y empujaba toda la hoja; el cambio del costo ya está en su número (el primero de los seis). **Vive en:** lib/marketing-diseno.ts.
- **La entrada de la página SÍ está en el INFORME de Kestrel** (a diferencia de Selvar, Orvel y Moorly): la tarjeta, el número que cuenta,
  la línea que se dibuja, la tinta de las pestañas. Dos demoras no están (la de cada número y la del anillo) y se tomaron de la tarjeta y
  del medidor; lo dice el relevo.
- **Los conteos chicos dan líneas en serrucho** en una tendencia de a 7 días (1 o 2 agendas por día). Con datos reales va a pasar; el
  modelo no los suaviza (sería inventar), la muestra sí es pareja.

## 22. Landing (Corbel): el armador que no prefijaba dos clases juntas, la hora del negocio y el día a medias (4/11/2026, chat en la nube)

- **El armador de las hojas copiadas no le ponía el prefijo a una clase pegada a otra** (`.col.is-now`, `.delta.is-down`): el patrón exigía
  que antes del punto no hubiera una letra, y en una clase encadenada siempre la hay. La regla quedaba escrita y no aplicaba nunca, sin un
  error: la columna de hoy de Landing salía rayada como las demás. **Y el mismo armador ya había dejado tres reglas muertas en Comercial, en
  producción:** las llamadas que ya pasaron no se apagaban y las filas que se tocan perdían su margen. Se arregló el patrón (toda clase que no
  sigue a un dígito) y las tres reglas de `comercial-css.ts`. Se busca con `grep -nE '\.[a-z]{2}-[a-z0-9_-]+\.[a-z]'` en cada hoja: lo que
  aparece sin su prefijo después del segundo punto no aplica. **Vive en:** app/dashboard/disenos/comercial-css.ts y landing-css.ts.
- **La hora de una visita es la del negocio, no la de la app.** El lector de datos fecha todo con `fechaTj` (Tijuana); la franja horaria de
  «Cuándo entran» con esa zona le corre las franjas a un negocio de Buenos Aires cinco horas. El día y la franja salen con `tzActual()` (la
  zona del negocio, que nunca tira); la FECHA sigue con la de siempre, que es otra decisión. **Vive en:** lib/visitas-momento.ts y
  `filasVisitas` (lib/graficos-datos.ts).
- **El día de hoy está a medias, y contra uno entero el cambio miente.** La burbuja de Corbel compara el mes con el del año anterior; la
  nuestra comparaba hoy (23 visitas a media tarde) con ayer entero: «−45%». Para la columna de ahora dice «en curso». **Vive en:**
  app/dashboard/disenos/HojaLanding.tsx.
- **Un anillo que repite el número de al lado no dice nada.** El de Corbel es el avance contra una meta, que MaKo no tiene; el de «Llegan al
  final» es una proporción medida: de los que llegan a la mitad, cuántos siguen hasta el final (llegaron_100 ÷ llegaron_50).
- **Un desglose con valores fijos llega en el orden del agregador, con las claves en su forma de clave:** «Cuándo entran» ubica cada día por
  su nombre normalizado, nunca por la posición (un día sin visitas no viene donde uno espera).
- **El lienzo de MaKo al lado de la barra lateral mide ~1100-1200 px**, que no es ni la captura de 1440 ni la de 390: los cuatro números de
  Corbel ahí se apretaban («2.3 pt» en dos renglones). Hace falta un corte propio (1240) además del medio de 1040.

## 23. Chat Analyst (Parley): la hoja del setter, la meta que ya existía y un ancho que mide el padding (4/11/2026, chat en la nube)

- **Chat Analyst es la hoja del SETTER** (`HOJA_DE_ROL`): sus conjuntos son sólo `whatsapp`, `conversaciones`, `envios` e
  `inscripciones`. Una pieza nueva del diseño sale de ahí o el setter recibe un 403 en esa tarjeta; el test lo recorre pieza por pieza.
- **La «meta» de 15 minutos no se inventó: es la de MaKo.** Parley tiene un presupuesto («$420 of $600»); la barra del tiempo de respuesta
  es la mediana contra los 15 minutos de `rapidos_15` («Respondidos en 15 min»), que es el corte que el catálogo ya usa. Un número de
  referencia nuevo en una pantalla se busca primero en el catálogo.
- **Un promedio de tiempos de respuesta mentiría** (ws1: mediana 3 min y p90 71 h): la tarjeta lleva la mediana y el p90, en palabras («el
  10% más lento: 5.2 h»), nunca el promedio.
- **Un elemento con `position: absolute` mide su alto en porcentaje contra el PADDING-box de su contenedor**, no contra el contenido: la
  columna rayada de Parley (la proyección, detrás de la barra) salía 10 px más alta que la barra de al lado, que sí descuenta el padding. Va
  `calc((100% - <padding>) * x)`.
- **Una parte se calcula sobre el TOTAL del período, no sobre las filas que llegaron:** el gráfico recorta (`limite`), y la suma de lo que se
  ve no es el total. El test lo distingue con un total mayor que la suma de las filas.
- **La leyenda al lado del título no entra en el teléfono junto al selector**: va debajo de la cabecera, con un margen negativo que la deja
  donde Parley la tiene a 1440.

## 24. Automatizaciones (Noria): los 14 días de cada una salen de dos cruces, y un «no está» no siempre es un cero (4/11/2026, chat en la nube)

- **Un cruce (`desglose`) es de la PRIMERA métrica y sus columnas se ordenan por ella**, de a ocho más «Otros» (`MAX_COLUMNAS_DESGLOSE`,
  lib/graficos-agregar.ts). Para saber qué parte salió bien cada día y por automatización hacen falta los envíos Y los fallos: son dos piezas
  (`envios-dia` y `fallos-dia`, dimensión día, desglose automatización). Con una sola razón («salieron bien») las columnas se ordenarían por
  el porcentaje y las que más fallan caerían en «Otros»: justo las que hay que ver.
- **El cruce de los fallos se ordena por los fallos, así que no tiene las mismas columnas que el de los envíos.** Una automatización que no
  está entre las columnas de los fallos **no falló nada si el cruce no tiene «Otros»** (están todas las que fallaron); si lo tiene, no se sabe:
  la casilla queda gris y la fila sin porcentaje, nunca un «sin fallas» inventado. Lo fija el test (con y sin «Otros»).
- **«Salieron bien» es lo que salió sobre lo que se INTENTÓ** (salió o falló): un borrador, un simulado o una acción no son ni éxito ni
  fallo. En las casillas, en cambio, el denominador es todo lo que la automatización hizo (`envios`): el cruce no trae lo intentado.
- **La línea de «una semana antes» sale de las mismas filas** (el mismo día, siete días antes): las primeras siete columnas del período no
  tienen con qué compararse y la línea arranca en la octava. No hace falta una lectura del período anterior por día, que el gráfico no da
  (`anterior` es sólo de los totales).
- **El pulso de Noria es por HORA; las automatizaciones se leen por día** (`envios` no tiene la hora): la hoja va por día con «7 días ·
  30 días», y «Hoy» marca la columna que todavía corre.

## 25. CS Analyst (Mender): la etapa de cada cliente sale del CRUCE, el orden de las etapas viene aparte, y un número que React actualiza no se cuenta (4/11/2026, chat en la nube)

- **Una columna extra de una tabla (`tabla.columnas`) no sirve para algo que puede valer dos cosas por fila.** Si las filas de un grupo dicen
  varios valores, `textoExtra` (lib/graficos-agregar.ts) devuelve «los dos más frecuentes, +N» juntos en un texto: un cliente de dos servicios
  trae «Arranque, Entrega», que no se puede partir (el nombre de una etapa puede tener una coma). La etapa de cada cliente sale del CRUCE de
  una pieza `barras_apiladas` (dimensión cliente, desglose etapa): una celda por etapa, y el cliente va en los dos carriles.
- **Una categoría que no es una escala se ordena por la métrica** (`ordenarGrupos`): las etapas de la entrega salen de la que más clientes tiene
  a la que menos, y un tablero por etapas tiene que ir en el orden del servicio. Ese orden no está en ningún Resultado: lo lee la página aparte
  (`etapasDeLaEntregaEnOrden`, lib/cs-diseno-server.ts, el catálogo de etapas de cada servicio) y viaja en los extras del diseño. Sin poder
  leerlo, el de la pieza: nunca se inventa uno. En un link compartido no viaja (la página compartida no lee los extras).
- **Contar un número desde cero escribe `textContent` y le saca a React su nodo de texto.** Si ese número después cambia por un estado de
  React (acá, el conteo de cada carril al cambiar de pestaña), React escribe en el nodo viejo y la pantalla se queda con el número de antes.
  Se cuenta sólo lo que no cambia sin remontar, o se le da una `key` que cambie con el valor (el total del anillo, que cambia con «Motivos ·
  Señal», va con `key`).
- **`limite` de una pieza es 50 como mucho** (`entero(o.limite, 3, 50, 10)`, lib/graficos-catalogo.ts): un tablero con más de 50 clientes
  muestra los primeros y dice cuántos quedaron afuera (`fuera`), con el link a Clients. El conteo de cada carril sale de la pieza de las
  etapas, que cuenta a todos.
- **Los tamaños propios de una copia no se llaman `--fs-*`** (lo pagó Automatizaciones, el mismo día): tests/puente-panel-copy.test.ts exige que
  todo `var(--fs-*)` de `app/` y `lib/` exista en app/globals.css, y un `--fs-base` declarado adentro de `.nor` parece uno de la casa que no
  existe. El armador lo renombra (`--nor-fs-*`) y el de Mender falla si aparece uno.
- **En la nube, el `tsc` acotado sobre EditorInforme y la página no entra en 2,5 GB** (se arrastra media app): sale «NO SE PUDO CHEQUEAR» con el
  heap lleno. Con `--max-old-space-size=7000` (la nube tiene la RAM) da 0.

## 26. Productividad (Fernly): una regla de la copia que pierde contra una más específica no da error, y una lista en grilla se ensancha sola (4/11/2026, chat en la nube)

- **Una clase sola pierde contra `.contenedor etiqueta`.** En la copia, `.pill` (0,1,0) perdía contra `.tlist span` (0,1,1): la pastilla del
  estado salía con el tamaño y el gris del texto de al lado, 10 px más ancha que la de Fernly, sin un solo error. Lo mismo el círculo de las
  iniciales de arriba, que heredaba `display: block` de `.me span` y dejaba las letras afuera. Lo encontró leer el estilo calculado
  (`getComputedStyle`) de la pieza que no calzaba, no releer la hoja. La cura es escribir la regla del texto con su propia clase
  (`.tlist__txt span`), no subir la especificidad de la pastilla a ciegas.
- **Una lista en `display: grid` sin `grid-template-columns: minmax(0, 1fr)` se ensancha con el texto que no se corta.** Sus filas son
  `min-width: auto`: un renglón con `white-space: nowrap` hace la fila tan ancha como su texto y empuja la pastilla 4 px afuera de la tarjeta;
  en el teléfono la página quedó de 394 de ancho. `minmax(0, 1fr)` deja que el texto se corte con «…».
- **Un `@container` intermedio de la adaptación no puede pisar el `display: contents` del teléfono.** La copia pone `.left`, `.right` y `.row`
  en `display: contents` a 700 px para reordenar las tarjetas; un paso de 1000 px que les da `display: grid`, sin límite de abajo, lo pisa en el
  teléfono porque va después. Va `(min-width: 701px) and (max-width: 1000px)`.
- **Una marca encima de la columna más alta pisa el título.** La columna llena todo el alto y la marca sale 38 px arriba: en Fernly va sobre una
  columna más baja. En la adaptación la más alta llega al 78 % (`ALTO_MAX`).
- **Las columnas de Fernly a 390 miden el 78 % de las de 1440** (las siete, medidas en la captura): las alturas son una fracción de un máximo
  (`--h` por columna y 175 o 136 px), no píxeles fijos.

## 27. Contenido e IA (Orrery): un script que corta un template literal en su primera comilla invertida se lleva la cabecera, y dos juegos de rótulos van cada uno con su clase (4/11/2026, chat en la nube)

- **Cinco adaptaciones guardadas tenían basura al principio de su `<style>`.** El script que guarda `mako.html` cortaba la hoja de
  estilos del `.ts` en la PRIMERA comilla invertida, y la cabecera del archivo nombra las clases entre comillas invertidas: el `<style>` de
  Fernly, Noria, Parley, Mender y Corbel arrancaba con 1.300 a 1.460 caracteres de comentario, que el navegador leía como un selector roto y
  con eso descartaba la primera regla (una de las `@font-face`). No da error y la página se ve casi igual. Va cortado en la línea
  `export const CSS_… = ` y no en un carácter que también puede estar en un comentario. Medido el 4/11/2026: las cinco arregladas.
- **Dos juegos de rótulos de un eje (seis en la computadora, cuatro en el teléfono) no se eligen uno del otro.** Elegir los cuatro del
  teléfono entre los seis que ya se dibujan los deja disparejos («6 oct, 18 oct, 23 oct, 4 nov»), y elegirlos sobre los 30 días deja sólo
  dos (los que coinciden). Se dibuja la unión, y cada rótulo que es de un solo juego lleva su clase, que el otro esconde.
- **Un número que cuenta desde cero conserva sus decimales.** El cuentanúmeros de Fernly toma la primera tira de dígitos y deja el
  resto como sufijo: con «US$0.0061» contaría el «0» de adelante y no se movería nada. El de Orrery lee cuántos decimales trae el texto y
  cuenta con ésos (`contar`, app/dashboard/disenos/HojaContenido.tsx).
- **Antes de «corregir» una letra de la copia, se lee el estilo calculado.** En la captura de Orrery «$981» parece la letra normal, y es la
  monoespaciada (`getComputedStyle` lo dice): con números cortos casi no se nota, y con «US$26.40» sí. Se dejó la de la copia.
- **Un botón de una hoja que lleva a /integraciones lo frena `tests/integracion-sin-salir.test.ts`** (lo cazó el veredicto, no el test
  de la hoja). Si conecta algo, va con el modal ahí mismo (`BotonIntegracion`); «Tus cuentas de IA» no se abre suelto (`ia` está en
  `SIN_MODAL_SUELTO`), así que va en la lista de la guarda con su porqué.
- **«No hay» y «no pude leer» no se escriben igual en una tarjeta.** «Sin pedidos a Flow» salía también con la lectura caída; ahora sale
  sólo cuando lo pedido es cero.

## 28. Curso o comunidad (Vitrea): un envoltorio que agrega el JavaScript toma las reglas de su etiqueta, y un eje se reparte con un paso fijo (5/11/2026, chat en la nube)

- **El número grande de la copia salía chico, y nadie lo había tocado.** El cuentanúmeros de la copia (`vitrea.js`) envolvía el texto
  en un `<span>` para contarlo, y la regla `.big span` (la del texto gris de al lado: 13,5 px) lo agarró: «$888,310» salía en 13,5 px y
  gris en lugar de 34 px. No da error, y la captura de la copia lo muestra. Un elemento que agrega el JavaScript entra en las reglas
  por etiqueta que ya había: antes de envolver, se mira qué regla le cae. En la copia ya se cuenta el elemento mismo cuando sólo tiene
  el número; en MaKo el `<b>` lleva el número sin envoltorio.
- **Los rótulos de un eje repartidos con redondeo quedan disparejos.** Elegir doce de treinta días con `Math.round` deja huecos de dos y
  de tres días, y el eje se lee torcido («17 oct, 19 oct, 22 oct»). Vitrea pone un rótulo por mes, a la misma distancia. Van con un paso
  fijo contado desde el último día (hoy): `marcasDelEje`, lib/curso-diseno.ts.
- **El período de la hoja es un título, no un pedazo de frase.** «en {período}» daba «en últimos 30 días», y estaba igual en Contenido e
  IA (ya en producción). Va por `enElPeriodo` (lib/marketing-diseno.ts), en las dos.
- **Una hoja de General no siempre tiene los datos de General.** El diseño de Curso dibuja sus piezas con o sin ellos; las dos
  tarjetas del Calendario dicen «No pude leer tu Calendario» cuando no llegan (un link compartido no los trae), nunca «nada agendado».
- **Una plantilla que pasa a ofrecerse cambia la referencia de la API.** `docs/api-mako.md` lista los ids de las plantillas de
  General que se ofrecen (el parámetro `plantilla` de la hoja nueva): al darle su diseño a «curso», `tests/api-mako-registro.test.ts`
  dio rojo en el veredicto. Se regenera en el mismo commit (`node --import tsx scripts/generar-api-doc.mjs`).
- **Medido:** la copia mide 1.653 a 1440 (como la captura) y 3.603 contra 3.605 a 390; la adaptación cae en las mismas cajas a 1360 (871×396,
  427×396, 1314×266 y tres de 427×534).

## 29. Agencia o servicio (Sunrow): un arco que dice lo que queda se corta por su largo, y una tarjeta con datos de General dice cuál no llegó (5/11/2026, chat en la nube)

- **El punto de un arco va por su LARGO, no por el parámetro de la curva.** El arco de Sunrow es una curva de Bézier, y el parámetro `t`
  no avanza parejo: en las puntas corre y arriba se frena. Para que «a las 11:10 de un día de 9 a 18» caiga donde tiene que caer, el
  punto sale de una tabla de largos (`tDeFraccion`) y el tramo hecho es la misma curva cortada en ese `t` (de Casteljau): así el
  final del tramo y el punto caen siempre en el mismo lugar.
- **«No pude leerlo» sólo si algo falló.** La primera versión lo ponía en todo número sin valor, también cuando la pieza no trajo nada
  (una hoja recién armada, un negocio sin cartera): ahí decía que falló algo que no falló. Va sólo con `problemas.numeros`.
- **Una hoja de General con tres fuentes de General dice cuál no llegó, una por una.** Sin los datos de General (un link compartido no
  los trae) el Calendario, el Plan y el Semáforo dicen «No pude leer…» cada uno en su tarjeta, nunca «nada agendado» ni «todo en
  orden». Lo demás (las piezas) se dibuja igual.
- **Un cambio de piezas de una plantilla vale también para la grilla.** «Avanzaron, por semana» pasó a mirar los últimos 90 días (las
  semanas del mes eran dos o tres puntos, y la curva de Sunrow no se lee con dos) y «Quién te necesita hoy» trae seis: las hojas nuevas
  los ven así también en «Ver la grilla». Una hoja ya guardada no cambia: la plantilla sólo arma hojas nuevas.
- **Medido:** la copia mide 2.657 a 1440 (la captura, 2.656) y 5.789 a 390 (5.777); la adaptación cae en las mismas cajas (el saludo de 983
  con la tarjeta de 337, las tarjetas de 484 y la columna de 315, a 1360) y no desborda a 1100, 900 ni 390.

## 30. Instagram y redes (Murmura): una pieza que nunca pudo tener datos se ve recién al dibujarla con datos (5/11/2026, chat en la nube)

**Vive en:** `lib/general-plantillas.ts` (la plantilla «instagram»), `lib/instagram-diseno.ts`, `lib/graficos-audiencia.ts`.

- **Síntoma:** al pasar la muestra por la hoja, «Alcance en Instagram» salía vacío aunque la muestra lo traía. **Causa:** el alcance es
  `sinTotal` (Meta lo da por fila y no se suma: la misma persona está en dos edades), y un número sin desglose sólo tiene el total, así que
  `agregar` devuelve null SIEMPRE (medido con una fila de 60 de alcance: `totales: [null]`). La pieza llevaba desde el 15/10 en la
  plantilla dibujando un guion. **El diagnóstico obvio era el equivocado:** se pensó en la muestra, y la pieza estaba bien escrita y
  no podía funcionar. El alcance de Instagram sale ahora de la fila de Instagram de «Instagram contra Facebook» (`dimension:
  'plataforma'`), que lo trae tal cual, y el número se fue de la plantilla.
- **La misma familia, otra pieza:** «Agendan por región» pedía las agendas por región, y con `breakdowns=region` Meta no manda ninguna
  conversión de afuera de Meta (está escrito en la cabecera de `lib/graficos-audiencia.ts` desde octubre: la fila no trae la clave). Esa
  barra no tuvo nunca un valor. Pasó a vistas («Dónde te ven»).
- **La regla que queda:** una pieza nueva de una plantilla se pasa por `agregar` con una fila de ejemplo ANTES de ofrecerla. Un
  catálogo dice qué métricas EXISTEN, no qué combinación de métrica y dimensión da un número: `sinTotal` sin desglose y una conversión
  con el desglose que no la trae se escriben y compilan igual.
- **Lo medido de la copia:** 2.342 a 1440 (la captura, 2.334) y 5.393 en el teléfono (5.383). La captura del teléfono de Murmura se tomó con
  la barra de desplazamiento puesta (15 px): el contenido mide 375, no 390, y la copia se compara a 375 (con 390 todo daba 15 px más ancho).
- **El INFORME de Murmura no trae la línea de tiempo de la página**, sólo la librería de recetas y el armazón: qué pieza entra con cuál
  receta y a qué demora es un supuesto, y está anotado en el relevo y en la cabecera del componente.
- **Un paso intermedio en el ancho del Dashboard de verdad:** con la barra lateral, el lienzo mide ~1200, y la cabecera de Murmura (el
  saludo, tres números y el botón en una fila) no entra ahí: el tercer número se montaba con el botón. Va hasta 1320 px con el saludo en su
  renglón. ⚠️ Y una regla de la copia que fija una columna (`grid-column: 5` del botón) rompe el paso que cambia las columnas: hay que
  soltarla en el paso y volver a fijarla en el teléfono, porque lo de la adaptación va después de los @container de la copia y los pisa.

## 31. Anuncio ganador (Prism): el saneo de la hoja tira lo que no entra, y una muestra armada a mano no pasa por él (5/11/2026, chat en la nube)

**Vive en:** `lib/graficos-plantillas-analysts.ts` (ADS), `lib/graficos-catalogo.ts` (`PIEZA_DISENO`, el `anillo`), `lib/anuncio-diseno.ts`.

- **Síntoma 1:** en el arnés, «Sin retorno» salía con «—» y la muestra lo traía. **Causa:** la pieza del diseño se llamaba `sinRetorno`, y
  `PIEZA_DISENO` (`/^[a-z][a-z0-9-]{0,29}$/`) sólo acepta minúsculas: el saneo la sacó del diseño sin un error, y `vistaAnuncio` buscaba
  una pieza que ya no estaba. Va `sinretorno`.
- **Síntoma 2, la misma familia:** «qué parte de lo invertido va a los que conviene escalar» leía lo invertido de la pieza del veredicto
  (un anillo), con `metricas: ['guiones', 'gasto']`. El anillo lleva UNA métrica (`t('anillo', …, 1, 1, …)`), y el saneo se quedó con la
  primera. **La muestra de la miniatura daba bien** porque ponía el gasto en ese resultado a mano: sin pasar por el saneo, la muestra
  contesta lo que uno le escribe. Lo cazó el test del cableado, que arma la hoja con `instanciarPlantilla` (que sanea). Lo invertido por
  veredicto va en su pieza («Lo invertido en cada veredicto», barras).
- **La regla que queda:** lo que lee un diseño se prueba sobre la hoja SANEADA (`instanciarPlantilla`), nunca sobre el objeto que arma la
  plantilla: el saneo tira en silencio un nombre de pieza que no cumple su forma y la métrica que un tipo de gráfico no lleva.
- **Síntoma 3, el veredicto:** el primer veredicto dio rojo en `tests/graficos-corbel.test.ts` («ads-analyst: 18 paneles»), con los 13
  tests del diseño en verde. Las piezas nuevas se sumaron a una plantilla que ya tenía 12, y el tope de 14 vive en OTRO test (la regla
  del §20, escrita para Comercial). **Se arregló sin subir el tope:** lo que se puede calcular se calcula en el modelo (cuántos guiones
  hay para escalar es la fila «Escalar» del veredicto; las semanas, la suma de los días por su lunes), y la grilla perdió las agendas por
  US$1.000 por ángulo y por formato. **Antes de sumarle piezas a una plantilla, contá sus paneles contra 14**: el test de su diseño no lo
  mira. **Vive en:** `lib/anuncio-diseno.ts` (`escalarDe`, `semanasDe`, `lunesDe`).
- **Lo medido de la copia:** a 1440, las doce tarjetas caen EXACTAS en las cajas de la captura (la última fila, a 1 px). En el teléfono,
  a ≤3 px hasta los números de «Key metrics»; **de ahí para abajo la captura está en negro** (el medidor sacó la foto antes de que se
  dibujaran), así que el teléfono de abajo es un supuesto, escrito en la copia y en el relevo.
- **El INFORME de Prism trae las recetas de la cabecera, las tarjetas, las barras de Revenue, la latencia, los números, el rango, el reloj,
  el ticker y el «Refresh»**, no el tiempo de cada tarjeta ni cómo crecen los anillos, las campañas, el medidor y las columnas: eso es
  supuesto. Tampoco se ve qué dicen los dos últimos botones del «Feed» (los tapa el cartel de la tienda): la copia los deja sin rótulo.

## 32. Hooks y retención (Ondra): la referencia de la propuesta ya estaba usada, y el filtro tapado se lee en el teléfono (5/11/2026, chat en la nube)

**Vive en:** `lib/hooks-diseno.ts`, `app/dashboard/disenos/HojaHooks.tsx`, `docs/diseno/mockups-dashboard/hooks-ondra/`.

- **La propuesta le daba a Hooks «Vitrea · Murmura», y las dos ya eran copias** (Curso o comunidad e Instagram y redes). Copiar una de esas
  otra vez dejaba dos hojas del mismo producto con la misma cara. Se copió Ondra, que estaba sin usar, y cada parte se adaptó a la pregunta
  de Hooks. **Antes de copiar la referencia de una fila de la propuesta, mirá si otra hoja ya la usa** (la columna «Estado» lo dice).
- **Lo que tapa el cartel de la tienda a un ancho puede leerse en el otro.** A 1440, el quinto filtro del embudo de Ondra está debajo del
  cartel «BUY THIS TEMPLATE»; a 390 se lee «Orga…» con el punto verde del canal Organic. Antes de escribir «no se ve, no se inventa», se
  mira la otra captura.
- **Una curva se lee de la captura día por día** (la altura de la línea en la x de cada día, con los colores de la línea): así la forma de
  la copia es la del demo y no una ola inventada. Funcionó con la línea sólida; la punteada se cruza con los lanzamientos y hay que cuidar
  esos tres días.
- **El demo tiene un defecto a 390: los rótulos de la curva pisan la leyenda** (la caja de la curva mide 224 y los rótulos salen de ella).
  La copia lo reproduce porque es lo que se ve; la adaptación mide la caja y no lo repite.
- **La curva del período anterior día por día no existe en MaKo**: el `anterior` de una pieza es un TOTAL. La línea punteada de la
  adaptación es el promedio del período anterior, y la leyenda lo dice («Promedio del período anterior»), no «Period before».
- **El tope de 14 paneles (§31) se miró antes de tocar la plantilla:** Hooks no suma piezas; las que el diseño pide de más (lo que llega al
  llamado y el ThruPlay por gancho, los guiones por avatar) van como métricas de las piezas que ya estaban.

## 33. VSL y YouTube (Pelago): un armador de CSS que no ve una clase compuesta, y un efecto que no se entera de que llegaron los datos (6/11/2026, chat en la nube)

**Vive en:** `lib/vsl-diseno.ts`, `app/dashboard/disenos/HojaVsl.tsx`, `docs/diseno/mockups-dashboard/vsl-pelago/`.

- **El armador que prefija las clases (`.x` → `.pel-x`) no veía la segunda clase de un selector compuesto** (`.col.is-hi`): el regex
  saltaba la que venía pegada a otra. La hoja salía sin el estado «elegido» y nada fallaba. El regex va con `(?<!\d)\.` (cualquier punto
  que no siga a un dígito: `1.5px` no es una clase).
- **El gráfico del teléfono tiene que arrancar en el final** (como el demo): el efecto que lo corre dependía del ancho y de la métrica, y
  cuando llegaban los datos ninguna de las dos cambiaba. Va con `listo` en las dependencias, y un `requestAnimationFrame`.
- **Dos roturas no las cazaba el test** (la pila sin tope en los leads y una fuga donde no se sabe la caída): se sumaron los casos. Es la
  regla de siempre: una rotura que da verde es un caso que falta, no un test que sobra.
- **El veredicto corre sobre el árbol de trabajo**: tocar un archivo mientras corre el tsc lo contamina. Y en la nube el clon viene
  superficial (`git fetch --unshallow origin main` una vez).

## 34. Inmobiliaria (Torque): Lintel quedó sin medir completa, y una plantilla general no pasa de 12 piezas (6/11/2026, chat en la nube)

**Vive en:** `lib/inmobiliaria-diseno.ts`, `app/dashboard/disenos/HojaInmobiliaria.tsx`, `docs/diseno/mockups-dashboard/inmobiliaria-torque/`.

- **La referencia de la propuesta (Lintel) tiene cuatro tarjetas vacías en la captura y el demo da 403 desde la nube.** Se copió Torque
  (un taller: sus bahías son tus proyectos, su tablero de trabajos son tus interesados por etapa). Si la PC mide Lintel completa y Martín
  la prefiere, se puede rehacer.
- **Una plantilla GENERAL pasa por la misma puerta que la IA y no lleva más de 12 piezas** (`TOPE_COMPONENTES_IA`,
  `tests/graficos-ia.test.ts`); el tope de 14 paneles (§31) es otro, el de la hoja con su sección y su portada. Sumar el tablero de
  interesados dejaba 13: salió el mapa «De dónde te buscan» (las visitas a las páginas, que no son de la visita a la compra), y la tarjeta
  de actividad de Torque pasó a «Los que avanzan» (los del tablero que compraron o agendaron).
- **«Los que avanzan» es una MUESTRA del tablero** (hasta 50 interesados), no la lista entera: la cabecera de la tarjeta dice cuántos
  compraron en el período, de la apertura. Ordenar el tablero por agendas metía a todos los agendados y dejaba vacías las primeras
  columnas: se dejó el orden de siempre.
- **Un rótulo al lado del título de una tarjeta lo corta** («Los que ava…»): va corto y con `white-space: nowrap; flex: none`.
- **⚠️ Un archivo de test SIN tests da verde, y así llegó a commitearse.** Un script que reescribía el pie cortó el archivo desde la
  PRIMERA aparición de «// Probado rompiéndolo (6/11/2026), cada rotura sola», que también estaba en la cabecera: el test quedó con 26
  renglones de comentarios. Las corridas de los afectados y el veredicto dieron verde (cero tests, cero fallos) y lo frenó la guarda de
  módulos del pre-push (`scripts/modulos-ts.mjs`: un .ts sin `import`). Se rearmó y las 17 roturas dieron lo mismo. Al reescribir un pedazo
  de un archivo, el ancla es única (`rindex`, o un texto que sólo esté en ese pedazo), y antes de commitear un test se cuenta cuántos
  `test(` tiene.

## 35. Cold Calling (Corvane): la entrada de la página no está en el INFORME, y «No contestó» no se calcula restando (6/11/2026, chat en la nube)

**Vive en:** `lib/cold-calling-diseno.ts`, `app/dashboard/disenos/HojaColdCalling.tsx`, `docs/diseno/mockups-dashboard/cold-calling-corvane/`.

- **Cold Calling no estaba en la lista de la propuesta** (es del 4/11) y no se ofrecía: tenía sus piezas y le faltaba el diseño. Se copió
  Corvane, un panel de pagos: el gráfico grande son las llamadas día por día, «Needs you» es lo que sigue después de llamar, el feed en vivo
  es a quién llamaste, las barras son quién llamó y el dinero repartido es cómo terminan.
- **Los controles del medidor de Corvane se tomaron con la barra lateral PLEGADA**: el control n.º 1 la plegó al apretarlo, y desde ahí las
  cajas están corridas 160 px. Las cajas buenas son las de «paneles» (se midieron antes).
- **La entrada de la página «Overview» vive en un chunk que el INFORME no muestra** (como Orvel, §General del relevo). No se inventó: las
  tarjetas quedan quietas; lo medido (el punto que late, la píldora que corre .28 s con rebote, los hover) está.
- **«No contestaron» no es llamadas menos contestaron**: eso suma las «Sin marcar», y la fuente dice que nunca cuentan ahí. El número
  sale de «Cómo terminan»; el tercer número de la fila pasó a «Agendan, de los que contestan» (con el mínimo de 5 de `tasa_agenda`).
- **El botón «Grabar llamada» de la hoja abre la misma grabadora de la ficha** (`GrabarEnFrio`) y al cerrarla la hoja vuelve a leer
  (`refrescar` del editor). En el arnés de captura la grabadora se reemplaza: trae acciones del servidor que no se empaquetan en el navegador.

## 36. «Se rompen en edición»: una hoja con dos caras, y las trampas de partir un diseño en bloques (6/11/2026, chat en la nube)

**Síntoma:** Martín, 6/11: «se rompen todos en la vista de EDICIÓN y hay algunos que los botones no son funcionales».
**Causa real:** no era una hoja rota, eran DOS hojas: mirando se dibujaba el diseño copiado entero (`HojaX`), y editando la grilla de las
piezas de donde ese diseño leía, que nunca se había diseñado para verse. Arreglar la grilla de cada una era arreglar 22 cosas que nadie
mira. **Lo que quedó:** cada tarjeta de un diseño es un elemento de la grilla (`tipo: 'diseno'`) que se dibuja con el mismo componente;
la hoja guardada se migra al leerse (piezas plegadas en «Todas las piezas», con sus ids).
**Vive en:** lib/disenos-partes.ts, app/dashboard/disenos/BloqueDeDiseno.tsx, app/dashboard/disenos/DisenoVivo.tsx, lib/graficos-catalogo.ts

Las trampas, medidas:
- **El diseño elige su versión de teléfono por el ancho de SU página (`@container`).** Dentro de un bloque esa página mide lo que la
  tarjeta: una tarjeta de 4 columnas se dibujaba como en un celular. La hoja de estilos del bloque le saca el contenedor
  (`container-type: normal`) en la grilla y lo deja en la pila del celular.
- **Aplanar el armazón con `:has([data-parte])` necesita `!important`:** las reglas de cada diseño (`.hc .hc-grid {…}`) ganan por
  especificidad, y escribir un selector por diseño es 22 reglas que se desincronizan.
- **Una tarjeta que no tiene qué mostrar** (la de «Primer contacto» para quien no ve leads, una de General sin sus datos) dejaba un hueco
  gris del alto de la tarjeta. Mirando, la grilla le saca el lugar (h = 1 y oculta); editando se dice qué bloque es. Lo que sólo se ve con
  un dato que no viene de las piezas va declarado en el catálogo (`soloSi`), el resto se detecta en el DOM.
- **Una tarjeta de la biblioteca no puede ser un `<button>`:** la vista previa es la tarjeta de verdad y trae sus botones; un botón adentro
  de otro no es HTML (React lo avisa al hidratar).
- **Un saneo que agrega piezas cambia el ORDEN de sus campos** (los bloques nacen con `x, y, w, h` antes de `diseno`, el saneo después):
  la API compara la hoja consigo misma para decir «ya está así», y dejaba de decirlo. Lo que agrega la migración vuelve a pasar por
  `sanearComponente`.
- **Las guardas viejas contaban `componentes.length`** (14 paneles, «el saneo no se comió nada», «la frase abre la hoja»). En el modelo
  de bloques esas cuentas se hacen sobre `panelesALaVista` (lo que se ve) y `sinBloquesDeDiseno` (lo que la plantilla escribió): la
  protección es la misma y el número no miente.
- **Un modo oscuro que dependa de `:root` o `html` lo rechaza la guarda de cada hoja** («todo adentro de su raíz»): la forma que sirve es
  `.raiz:where([data-tema="oscuro"] *)`, que empieza por la raíz y tiene su misma especificidad.
- **La guarda del modo mide colores opacos:** un brillo `#ffffff14` sobre fondo oscuro «parece» blanco si se ignora el alfa; y un diseño
  en `oklch` (Operación) se lee por su L al cubo.
- **El servidor de desarrollo no entra en el contenedor de la nube:** Turbopack llega a 13 GB con el Dashboard y el kernel lo mata (con
  cuatro agentes corriendo tests, antes). Webpack no compila este repo (`node:crypto` en el grafo del cliente). Las capturas largas van de
  a una hoja por arranque, o desde una sesión local.

- **Sí entra, con dos condiciones** (segunda vuelta, misma noche): `MAKO_DEV_SIN_LOGIN=1` (sin eso, cada página es el cartel «Falta
  AUTH_SECRET», y una captura de ese cartel se lee como una hoja vacía) y `NODE_OPTIONS=--max-old-space-size=6144`, sin otros procesos
  pesados. Así salieron 15 capturas seguidas, de a una por contexto, con el servidor en ~10 GB. Y el modo oscuro de la persona lo aplica el
  layout SÓLO con sesión: el banco simula la elección con `localStorage['mako.modo'] = 'oscuro'` antes de cargar.
- **Un test de «está en la galería» que mira la lista equivocada.** «Velocidad de llamada» se escribió, pasó su test («está en la galería
  del Dashboard», sobre `PLANTILLAS_HOJA`) y NO se ofrecía: lo que ven «Nueva hoja» y la API es `PLANTILLAS_OFRECIDAS`, que exigía
  `Hoja.diseno`, y una hoja hecha de tarjetas de TRES diseños no tiene uno propio. Lo vio el banco, no un test. Ahora la regla es
  `traeDisenoCopiado` (el diseño entero o bloques copiados) y los dos tests miran la lista que se ofrece; probado rompiéndolo (2 rojos).
  **Al probar que algo «se ofrece», se busca en la lista que lee la pantalla, nunca en el catálogo entero.**
- **Un banco sin commitear en `app/` lo barre un test del disco**: `tests/zona-negocio.test.ts` contó las zonas de
  `app/zz-banco-dash/BancoDash.tsx` y el veredicto dio rojo, y después el `tsc` entero falló por `.next/dev/types`, que el servidor de
  desarrollo deja nombrando la ruta del banco. Antes de sacar el veredicto: el banco afuera del repo y `.next/dev` borrado.
- **El «1 Issue» del servidor de desarrollo con el modo oscuro** es de antes y no es del Dashboard: el script de arranque pone
  `data-tema` en `<html>` antes de hidratar, y React avisa que el atributo no estaba en el HTML del server. En producción no hace nada.

Lo que quedó SIN hacer: borrar los bloques de General viejos (sólo con el sí de Martín: tienen opciones que las tarjetas no tienen; la
tabla de candidatos está en docs/relevo/nube-dashboards.md).

## 37. «No son editables» y la hoja de Código: lo que tapaba el costado, textos que viven en el JSX, y un dashboard que es por persona (9/11/2026)

**Síntoma:** Martín, 9/11: «los dashboard hoy no son editables… que esté 100 % finalizado», y el dashboard especial para los clientes de
Código Inmobiliario («cuánto tarda cada inmobiliario en contactar a un lead», con el botón de grabar).

**Lo medido en producción (Chrome de Martín, superadmin, ws 3):** mover, agrandar por la esquina, duplicar, borrar y deshacer
ANDABAN. Lo que no: (a) el cuadradito del medio de cada costado creaba una flecha en vez de agrandar, y (b) el título y los textos de
una tarjeta de diseño no se podían cambiar (el panel no tenía campos). «No son editables» era esas dos cosas, no la grilla.

- **⚠️ El diagnóstico obvio era el equivocado: no era react-resizable ni el CSS de los tiradores de tamaño.** Era OTRO módulo
  encima: los cuatro tiradores de unir con flecha (`.lk-tirador`, app/dashboard/Conectores.tsx, z-index 6) van en el MEDIO de cada
  lado de la tarjeta elegida, exactamente encima del cuadradito de agrandar (z-index 3). Se agarraba el tirador. Ahora van afuera
  del borde (`puntoDelTirador`, lib/graficos-conectores.ts: el disco entero fuera de la tarjeta y dentro del hueco de 16 px, así no
  pisa la vecina). **Antes de tocar un gesto que «no anda», mirar qué elemento recibe el puntero ahí (`elementsFromPoint`).**
- **Los textos de una tarjeta copiada están escritos en el JSX del diseño** (22 componentes): no hay un `titulo` que editar. Lo que
  quedó: el bloque guarda `diseno.textos` = { original → nuevo } (lib/disenos-textos.ts) y la tarjeta lo aplica en el DOM
  (app/dashboard/disenos/textos-de-bloque.ts); dos toques sobre un texto, editando, abren un campo encima (TapaDeDiseno.tsx).
  - Por el TEXTO y no por la posición: si el diseño suma una fila, el cambio sigue en su texto.
  - **No contentEditable:** escribir dentro de un nodo de React le rompe la reconciliación. El campo va encima.
  - **React reescribe `nodeValue` cuando llega otro dato:** el bloque recuerda (WeakMap) qué puso en cada nodo; si lo que hay no es
    lo que puso, eso es el original nuevo y se vuelve a aplicar (MutationObserver con `characterData`).
  - Fuera quedan `svg` (los gráficos), `tbody` (las filas son datos) y las cifras (`esTextoEditable`).
  - **El saneo de la hoja tira lo que no conoce:** sin sumar `textos` a `sanearComponente`, el cambio se veía y se perdía al recargar.
- **En los clientes de Código casi todos los leads salen «Sin contactar»** (Natalia 123 de 126, Brigitte 41 de 41; la 0396 ya estaba
  aplicada). La métrica dice la verdad: llaman desde el celular sin grabar, y lo que su línea de WhatsApp manda va a otros chats, no
  a los leads. Sin explicarlo parece que nadie llamó. Ahora la tarjeta «Primer contacto» lo dice cuando la mayoría sale sin contactar
  (`faltaGrabar`, lib/primer-contacto.ts) y trae el botón «Grabar llamada» (la grabadora de la ficha) en el lugar de la lista de los
  más lentos —cabe en la tarjeta sin agrandarla—. «Velocidad de llamada» suma, a la vista, la tabla «Cada lead nuevo» (conjunto
  `primer_contacto`, por lead, con el tramo y el canal).
- **El Dashboard es POR PERSONA** (`app_settings`, `graficos.tablero.<sub>`): «instalar una hoja para un cliente» es escribir una fila
  por cada usuario de cada negocio. Lo que nadie guardó se resuelve en el CÓDIGO: `HOJA_DE_AGENCIA` (lib/graficos-plantillas.ts) pone
  «Velocidad de llamada» en el negocio de cada cliente aprobado de la agencia 13, sin escribir nada. Sólo quien ya guardó el suyo
  necesita que se le escriba (con el sí de Martín).
- **⚠️ El diagnóstico obvio equivocado, otra vez: «alcanza con ponerla en el informe inicial».** Se desplegó así y en producción la
  pantalla de Giselle (ws 17) siguió EN BLANCO: desde el 12/10 quien nunca guardó no ve el inicial («que no le salga ninguna
  página», app/dashboard/page.tsx, `sinPaginas`); el inicial viaja por dentro. Lo que la muestra es la página: `esHojaDeAgencia`
  la saca del inicial y la pone en la tira y como hoja, SIN `agregar` (que guarda al abrir). **Antes de cambiar el informe inicial,
  mirar si la pantalla lo muestra: el inicial y lo que se ve no son lo mismo.**
- **Mirar «como el cliente» con `?ws=` NO muestra el Dashboard del cliente:** el superadmin ve SU informe en ese negocio (su `sub`).
  Coinciden sólo mientras ninguno de los dos guardó; para ver el de una persona hay que leer su fila.
- **⛔ 10/11: Martín rechazó la hoja «Velocidad de llamada» tal como quedó («la más fea de todas»).** Estaba armada con tarjetas de
  tres diseños ya copiados (Cold Calling, Closing y la tabla de Marketing), más una tabla y textos propios: el aviso de grabar, el
  título de «Cada lead nuevo». Pasaba el test de «trae diseño copiado» y era inventar igual. La rehace un chat en la nube copiando UN
  demo entero (Tend, rama `punta/velocidad-tend`), y la regla quedó arriba de todo en AGENTS.md («PROHIBIDO INVENTAR»). De esta
  sección sigue valiendo lo que es MECANISMO: el costado, los textos editables, el Dashboard por persona, que el inicial no se ve y
  `esHojaDeAgencia`. Lo que es CONTENIDO de la hoja (las piezas, el aviso y sus textos, la tabla) no se reusa. El pedido de Martín
  del 9/11 («que diga que salen sin contactar porque no graban, y cómo grabar») sigue vivo: si el demo no tiene dónde, decide él.

**Vive en:** lib/graficos-conectores.ts, app/dashboard/Conectores.tsx, lib/disenos-textos.ts, app/dashboard/disenos/textos-de-bloque.ts,
app/dashboard/disenos/TapaDeDiseno.tsx, lib/primer-contacto.ts, app/dashboard/disenos/HojaClosing.tsx, lib/graficos-plantillas.ts
(`VELOCIDAD_LLAMADA`, `HOJA_DE_AGENCIA`), lib/graficos-tablero.ts. Tests: graficos-conectores, dashboard-textos-de-bloque,
dashboard-velocidad-codigo.

**Lo que quedó SIN hacer:** la API de MaKo (lib/api-mako/areas/dashboard.run.ts:167, sin persona) sigue leyendo el inicial sin la hoja
de la agencia; una vista de la AGENCIA con una fila por cliente (lo literal de Juanfran: «cada inmobiliario») no existe todavía; los
Dashboards ya guardados en los negocios de Código (los lista docs/relevo/dashboards-codigo.md) reciben la hoja sólo con el sí de Martín.

## 11. Lo que quedó SIN hacer

- **Ninguna hoja se vio dibujada con datos reales**: esta sesión no tiene producción. Se verificó la composición (qué
  pieza va dónde, con un script sobre `componentesDe`), los tests y los tipos. Lo que hay que mirar está en el relevo.
- **Seis mediciones que MaKo no tiene** (§7.4 de la propuesta), y por eso las hojas no las prometen: retención por SEGUNDO
  del video (Hooks y VSL van por cuartiles), confianza estadística de un A/B (Anuncio ganador usa la confianza por muestra),
  cohortes M0–M5 (Curso y CS), motivos de baja contados (CS), el tiempo de foco por tarea (Focus no tiene el temporizador
  de Pane) y las horas que ahorra una automatización.
- **«¿Cada cliente va en fecha?»** (Agencia o servicio) pide una fecha comprometida por etapa de la entrega, que no se guarda:
  la hoja mide cuándo llegó cada uno a su etapa.
- **Las sugeridas no tienen eje de rubro**: Inmobiliaria no se sugiere sola, se encuentra por nombre.
- **Sin medir**: el hover y el clic de las plantillas (los `:hover` de cada demo están en el `INFORME.txt` del medidor, que
  es temporal). Para Closing ya están copiados (§12).
- **Closing sin probar contra la base de un cliente**: el diseño está en la punta `dash-closing-producto` (§13); falta
  crearlo en el ws3 y el ws1 y mirarlo con datos reales.

## El índice decía que faltaba trabajo que estaba HECHO (7/11/2026)

**El síntoma, y por qué nadie lo vio antes:** `docs/diseno/mockups-dashboard/index.html` anunciaba
**«6 de 21»** y dibujaba quince hojas atenuadas, sin click, como si no existieran. En el disco había
**dieciocho** construidas. Cada una se fue haciendo en su carpeta (`<hoja>/mako.html`) y nadie volvió al
índice a marcarla.

**Por qué importa tanto acá:** esta galería no es un listado interno. Su propio README dice que es donde
Martín aprueba las hojas **«antes de que nada vaya al código»**. Así que doce hojas terminadas eran
invisibles justo para la única persona que tiene que verlas — y lo que subía era «faltan quince
dashboards», que es falso y además desalienta: parece que el trabajo no avanzó en una semana.

**Y había una segunda capa, peor:** las seis que SÍ se veían apuntaban a los archivos **sueltos de la raíz**
(`general.html`, `comercial.html`, `landing.html`…), que son los del lote 1 y quedaron atrás. Landing pesa
**12 KB** ahí contra **46 KB** en `landing-corbel/mako.html`. O sea que de las seis visibles se estaba
mirando la versión **anterior**, creyendo que era la actual.

**El estado real, medido:** 18 construidas de 22 carpetas. Faltan cuatro, y son las que no tienen ninguna
adaptación —sólo la copia de la referencia—: **Hooks y retención** (`hooks-ondra`), **VSL y YouTube**
(`vsl-pelago`), **Inmobiliaria** (`inmobiliaria-torque`) y **Cold calling** (`cold-calling-corvane`). Las
cuatro ahora abren su `copia.html` en vez de quedar muertas: la referencia copiada es lo único que hay de
ellas y antes no se podía ni mirar.

### La regla, que es lo que vale más que el arreglo

**Un índice escrito a mano se desincroniza EN SILENCIO, y su modo de falla es el peor que existe: decir que
falta trabajo que está hecho.** Nada falla, nada se pone rojo, no hay excepción ni log — simplemente no se
ve. Y la conclusión que produce («esto no avanzó») es la contraria de la verdad, así que además dispara
trabajo repetido.

Es exactamente la misma familia que `docs/hallazgos.md` y su índice, que por eso se tocan **en el mismo
commit**. La diferencia es que allá la regla es una costumbre y acá no alcanzaba: lo vigila
`tests/mockups-dashboard-indice.test.ts`, que falla si una hoja construida no figura como hecha, si una
marcada como hecha apunta a un archivo que no existe, si una carpeta del disco no aparece en ninguna fila
(trabajo invisible), o si alguien vuelve a apuntar a los sueltos viejos de la raíz.

**La trampa de verificación que lo dejó pasar tanto tiempo:** mirar la galería y contar lo que se ve
CONFIRMA el índice, no lo contradice — la pantalla y el índice son la misma fuente. Lo que lo descubrió fue
contar las **carpetas del disco** y cruzarlas contra la lista. Cuando una pantalla se dibuja a partir de una
lista, mirar la pantalla no verifica la lista.

**Vive en:** `docs/diseno/mockups-dashboard/index.html` · `tests/mockups-dashboard-indice.test.ts` ·
las hojas, en `docs/diseno/mockups-dashboard/<hoja>/`.

**Y un cabo suelto que conviene saber:** la rama `dashboard-denso-0111` (2/11, 3.498 líneas, sólo `docs/`)
sigue fuera de `main` y **está SUPERADA**: trae la estructura plana vieja y main ya tiene la de carpetas, más
desarrollada. Traerla haría retroceder el área. Se revisó el 7/11 y se decidió no mergearla; el README de la
carpeta todavía describe la estructura plana y conviene actualizarlo cuando alguien lo toque.
