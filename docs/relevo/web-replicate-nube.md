# Relevo: Web Replicate — los varios mouse (nube, desde el 9/11/2026)

Pegar en un chat nuevo: `Leé docs/relevo/web-replicate-nube.md y seguimos desde ahí.`

**El pedido, textual (Martín, 9/11/2026, por el Cerebro):** «PARA WEB REPLICATE, COPIAR ESTO:
https://www.instagram.com/reel/DfZFAfzs3Ng/ … Sobre todo la animación de los multiples mouse actuando».

El reel está bajado en la rama `referencias/reels-0911` (`web-replicate.mp4`):
`git fetch origin referencias/reels-0911 && git show origin/referencias/reels-0911:web-replicate.mp4 > reel.mp4`.

⚠️ **No toqué `lib/editor-landing/lector-script.ts`** (el arreglo pendiente de «No pude sacar la foto de la página» con
100ads.ai es de otro chat, docs/relevo/web-generator-replicar.md, sección 0).

## Estado

| Tanda | Qué | Rama | Estado |
|---|---|---|---|
| 1 | Los varios mouse mientras se replica, atados a los eventos reales | `punta/web-replicate-0911` | VERDE sin tipos — sha en el commit de esta tanda (ver `git log origin/punta/web-replicate-0911`) |
| 2 | El anillo y los cursores también en el paso 1 («Leer») | — | sin empezar |
| 3 | La página real (no un wireframe) dentro de cada caja | — | sin empezar |

## El reel, cuadro por cuadro (39,4 s, 1080×1920, una notebook filmada con el teléfono a oscuras)

Fotogramas sacados con ffmpeg cada 0,25 s en el arranque y cada 0,1 s en los tirones; recortes ampliados para leer las
etiquetas. Un cuadro por segundo: `docs/web-replicate/capturas/reel-un-cuadro-por-segundo.jpg`.

- **0,0–0,4 s, el arranque.** Fondo azul casi negro. Al centro, un anillo de 12 puntos de colores (uno por agente) que gira
  alrededor de un punto naranja; abajo, en monoespaciada mayúscula y espaciada, «BOOTING AGENTS 12/12». Pie: «© 2026 JAI
  MANJHI» a la izquierda y «BUILT BY 12 AGENT SWARM · CENTRAL INDIA» a la derecha.
- **0,4–0,5 s, la salida.** Los 12 cursores salen disparados del anillo y en ~0,1 s ya están repartidos por la pantalla
  (frenado fuerte al llegar). Aparece la barra de abajo, centrada y redonda: «● 12 AGENTS LIVE | ⏸ | ⏻ AGENTS ON | ■ STOP»
  (el STOP es un botón naranja).
- **1,0–1,4 s, el trazado.** Los cursores trazan cajas: borde azul fino, asas blancas cuadradas en las cuatro esquinas y una
  etiqueta azul arriba a la izquierda con el agente y las medidas («Section · 1440 × 860», «QA · 400 × 16»). El cursor
  arrastra la esquina de abajo a la derecha. Las cajas se llenan de azul translúcido: la página entera como wireframe.
- **1,4–2,0 s, el contenido.** Aparece adentro de las cajas: «JAI», la foto, «Hello, I'm JAI MANJHI.», y «PORTFOLIO» gigante
  en rojo se escribe letra por letra. La capa azul se va.
- **2,0–4,5 s, el tecleo.** Cada bloque con su etiqueta: «Copy · typing», «Lint · typing», «Index · placing». El texto se
  escribe con las últimas 4 o 5 letras a medio aparecer. El botón «VIEW WORK ↗» se coloca.
- **4,5–8 s, los tirones.** Los cursores sin tarea se mueven de a saltos cortos (50 a 100 px), frenan al llegar y esperan de
  medio segundo a un segundo y medio. Algunos se quedan quietos varios cuadros. Nunca un deslizamiento continuo.
- **8–33 s, la página baja.** Scroll suave hacia abajo; en cada sección nueva se repite: cajas en lo vacío, títulos («WORK
  THAT SHIPS.», «BUILT FAST. SHIPPED REAL. 40.», «NOT JUST CODE. CODE THAT SHIPS.»), números y párrafos. Algunos agentes se
  quedan atrás, en la sección anterior.
- **33–39 s, el final.** Última sección («LET'S WORK TOGETHER.» y el contacto); los 12 se juntan abajo a la derecha,
  alrededor de un botón redondo naranja «↗», en un racimo de pastillas.
- **El cursor:** flecha clásica del color del agente, con borde oscuro; abajo a la derecha, una pastilla del mismo color
  (radio ~5 px) con un robotito oscuro (cara, dos ojos, antena) y el nombre en monoespaciada oscura.
- **Los nombres leídos:** Scout (azul), Layout (ámbar), Typeset (menta), Copy (cian), Lint (blanco), Index (verde), Palette
  (amarillo), Images (lima), Render (lavanda), Motion (rosa), QA (violeta), Deploy (naranja), Review (salmón). Son 13 sobre
  12: uno está mal leído (Render o Review).
- **Lo que NO es de la página:** las copias fantasma de los cursores rápidos son del teléfono que filma (1/30 s de exposición
  sobre una pantalla de más hercios). No se copiaron. El círculo «N» abajo a la izquierda es el indicador de Next en
  desarrollo.

## Tanda 1: lo que se hizo

Mientras MaKo replica (paso 2, «Replicar»), arriba de las fases aparece el escenario del reel: el anillo «Leyendo la página»,
los 12 cursores que salen disparados, una caja azul trazada por sección con su etiqueta («Textos · 690 × 140»), el título que
se escribe letra por letra («· escribiendo»), Colores, Imágenes y Fuentes pintando con el color de la original, la página que
baja sola y, al terminar, los 12 juntos abajo al lado de la barra. El editor se abre 2,4 s después de que se ve todo.

- **Atado a lo que pasa:** las cajas salen del evento `esquema` (los títulos reales); una caja se escribe sólo si su sección
  llegó Y ya se reveló con la cadencia de `ArmadoEnVivo` (la misma que la cuenta «N de 8»); el diseño se pinta con el evento
  `diseno` y después de verlo todo escrito; se juntan con el `fin` ok. Lo único que no mide nada son los tirones de los
  cursores sin tarea.
- **Los nombres, en castellano y de lo que hace MaKo al replicar:** Lector, Estructura, Títulos, Textos, Revisor, Botones,
  Colores, Imágenes, Fuentes, Animación, Calidad, Armado, con los colores del reel.
- **Dos cosas del reel que no se copiaron, a propósito:** «12 AGENTS LIVE» dice «MaKo en vivo» y la fase real («Escribiendo ·
  3 de 8»): afirmar 12 agentes trabajando sería inventar. Y el botón naranja no es «STOP» (la réplica sigue en el servidor y
  se paga: un STOP que no frena miente) sino «Ver todo», que muestra de una lo que ya llegó. El «⏸ / AGENTS ON» tampoco.
- **«Reducir movimiento» del sistema:** sin bucle; cada caja y cada cursor quietos en su estado final.
- **Teléfono (390 px):** la barra se queda con el punto, la fase y el botón (`@container`); al final, tres por fila.
- **En la API de MaKo:** nada nuevo, y no corresponde. Es cómo se VE una réplica en la pantalla; replicar ya está declarado
  (`replicar_landing`, en los tres formatos) y no cambió.

**Autocrítica (lo que cambié mirándolo en el navegador):**
1. La cámara seguía los trazos: bajaba hasta el final mientras arriba se escribía, y volvía. Ahora los trazos no la mueven;
   manda lo que se escribe (y lo que se pinta). Las capturas del después, en `docs/web-replicate/capturas/` (`replicar-1100.jpg`:
   2,5 s, 3,1 s, 4,7 s, 7 s, 9,8 s y 12,5 s; `replicar-390.jpg`: el teléfono). El antes no quedó guardado.
2. Al final las pastillas se pisaban (52 px entre columnas para pastillas de ~90): ahora 100 px, y menos columnas si es angosto.
3. Sin tarea se amontonaban: cada uno tiene su lugar en una grilla de 4 × 3 y salta alrededor.
4. La etiqueta azul pisaba el borde de la caja de arriba: más aire entre cajas (24 px).
5. Descarté: dibujar el «⏸ / AGENTS ON» y el «STOP» del reel (sin función real), y las estelas (son de la cámara).

**Archivos:**
- `app/_ui/enjambre.ts` — los 12, el azar determinista, el tirón (suavizado exponencial), los tirones sin tarea y el tecleo.
- `app/_ui/CursorAgente.tsx` — la flecha y la pastilla con el robotito (se mueve por ref).
- `lib/editor-landing/replicar-escena.ts` — de los eventos a la escena: las cajas, sus estados en el tiempo, la etiqueta,
  adónde va cada cursor y la cámara.
- `app/web-generator/crear/EscenarioReplica.tsx` — el escenario (un `requestAnimationFrame` que escribe por ref).
- `app/_ui/ArmadoEnVivo.tsx` — `escena`: le da al escenario la misma cadencia que la cuenta, y con escenario no repite la lista.
- `app/web-generator/crear/Replicar.tsx` — el enchufe.
- `tests/web-replicate-agentes.test.ts` — 10 tests que ejecutan el código; probado rompiéndolo (22 roturas, todas en rojo;
  renombrar una variable, verde). `tests/web-generator-replicar-partes.test.ts` (7): la espera fija de 600 ms pasó a
  `ESPERA_FINAL_MS`, y ahora el test mide lo que cuida.

**Verificación:** tests 158/158 en los 12 archivos vecinos; tsc acotado de los 6 archivos sin errores (con `--heap=4096`: con
el default de 2.560 MB muere en la nube y sale «código undefined»). Visto en Chromium con un arnés que monta la pieza real
con la línea de tiempo de una réplica (lee, esquema de 8, tres tandas fuera de orden, diseño, fin): a 1100 y 390 px y con
«reducir movimiento», sin un error en la consola. **NO visto:** en la app de verdad con una réplica de punta a punta (esta
nube no tiene la base ni la IA del negocio).

## Lo que sigue (tandas 2 y 3)

- **El paso 1 («Leer») todavía muestra el giro de siempre** («Leyendo la página: su estructura, sus ángulos y su diseño…»). En
  el reel el arranque es el anillo. Para llevar el anillo ahí hay que ver qué eventos da la lectura (`useLeerParaReplicar`):
  hoy sólo «leyendo» y «leída», sin progreso.
- **Las cajas son un wireframe con la forma de cada sección** (la de la lectura cuando son las mismas secciones). En el reel
  se ve la página real. Con la copia idéntica hay foto (el HTML de cada sección): se podría pintar la sección de verdad al
  escribirse, en un iframe con sandbox como el editor. Es HTML ajeno: las reglas de «Servir contenido de AFUERA» de AGENTS.md.
- **El final del reel recorre la página terminada;** acá se abre el editor.
