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
