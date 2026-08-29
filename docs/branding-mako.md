# La marca MaKo

Este documento no existía. La marca estaba repartida en cinco lugares que no se
hablan entre sí: el color en `app/globals.css`, las medidas en `app/_ui/tokens.ts`,
el logo en `app/_components/MakoBrand.tsx`, la voz en `lib/mako-persona.ts` y
`lib/mako-prompts.ts`, y los archivos descargables en `/conocimientos → Branding
MaKo`.

⚠️ **«Branding MaKo» dentro de Conocimientos NO es un manual**: es una GALERÍA de
archivos que vive en un bucket privado de Storage. No tiene una sola línea sobre
color, tipografía o voz — el propio repo ya lo tiene anotado como trampa en
`docs/hallazgos-ui.md:108`. Todo lo de acá abajo se sacó del código.

La versión con los logos y las muestras a la vista está en **`/admin/ui`**, tab
**Marca**. Ésta es la que se puede llevar afuera.

⚠️ **Dos bloques de este documento los escribe un script**, porque una copia a
mano se queda vieja: la regla del nombre y la tabla de los nueve estados salen de
`lib/mako-gramatica.ts`. Van entre marcadores y el pre-push falla si difieren.
No los edites acá.

---

## 1 · El nombre

<!-- REGLA-MARCA:INICIO — generado por scripts/sync-gramatica-doc.mjs, NO editar a mano -->

El nombre es **MaKo**. Ésta es la regla tal cual viaja adentro de los prompts, desde
`lib/mako-gramatica.ts`:

> CÓMO SE ESCRIBE LA MARCA: **MaKo** — M mayúscula, K MAYÚSCULA en el medio. Nunca "Maco", "Mako", "MAKO" ni "Macko". Si te llega escrito de otra forma (una transcripción de audio suele dejar "Maco"), corrígelo al escribirlo tú.

<!-- REGLA-MARCA:FIN -->

Es la regla que más se rompe: una transcripción de audio deja «Maco» casi
siempre. Por eso tiene **dos capas, y las dos hacen falta** — la regla en el
prompt, para lo que la IA escribe de cero, y una corrección determinista para lo
que entra transcripto, donde el prompt no llega.

La determinista es `corregirMarca()`, y su lista es **cerrada y con palabras
completas** a propósito: `maco`, `mako`, `macko`, `makko`. «Marco» no está —es un
nombre de persona, y convertir el nombre de alguien en el de la marca es peor que
dejar un «Maco» suelto— y sin los límites de palabra se rompería «makoto». Las
dos cosas están testeadas.

Corre en la transcripción de audio (`lib/ai-cheap.ts`), en el saneo de tareas del
plan (`lib/plan-propuesta.ts`) y dentro de `MAKO_NUCLEO`, que lee toda la IA.

**Cómo firma la IA** — un solo actor para todo el repo:

| Dónde | Cómo firma | Quién lo pone |
|---|---|---|
| Al final de un mensaje que sale | `— MaKo` (guion largo + espacio) | el texto del mensaje |
| En el historial y las etapas | `MaKo` | `AUTOR_SISTEMA` · `lib/etapa-historial.ts` |
| Como setter de una nutrición | `MaKo` | `MAKO_SETTER` · `lib/pipeline.ts` |

El chip del historial y el setter de las nutriciones automáticas hablan del mismo
MaKo. Y si le preguntan qué es, contesta que es *una versión IA entrenada con la
forma de pensar de Martín, no Martín en vivo*.

---

## 2 · Color

### La regla maestra

Está escrita en el encabezado de `:root`, y es lo primero que hay que respetar:

> **UN SOLO SIGNIFICADO POR COLOR.** Cada color dice UNA cosa. Si el mismo color
> significa cinco cosas, no significa ninguna. Esta es la regla completa, y no se
> negocia por pantalla.

| Color | Significa | Y nada más |
|---|---|---|
| **DORADO** | MaKo | La marca (logo, chispa) **y** «acá intervino la inteligencia»: detectó, analizó, recomienda, ejecutó |
| **AZUL** | vos actuás | Botones, links, foco, selección, confirmar algo no destructivo |
| **VERDE** | resultado favorable o completado | |
| **NARANJA** | warning | Deliberadamente ANARANJADO para que no se confunda con el dorado |
| **ROJO** | riesgo, error o destrucción | |

Con tres corolarios que el código tiene que cumplir:

- El **estado activo de la navegación no usa dorado**. Se hace con contraste de
  superficie + indicador lateral + peso tipográfico.
- Los **colores de categoría** (proyectos, etapas, canales) nunca compiten con los
  semánticos: viven en `--tag-*`.
- **Nadie define su propio hex dorado.** Si lo necesitás, es `var(--mako)`.

### El dorado — un solo hex

| Token | Claro | Oscuro | Qué es |
|---|---|---|---|
| `--mako` | `#F2B01E` | *(hereda)* | el dorado. Rellenos, bordes, la chispa |
| `--mako-lite` | `#F8CB63` | *(hereda)* | el alto del gradiente de marca |
| `--mako-ink` | `#8F6709` | `#F2B01E` | el dorado que se LEE sobre fondo claro |
| `--mako-bg` | `#FDF4DE` | `#2E2614` | la superficie de «esto lo dijo MaKo» |
| `--mako-border` | `#EFDCA9` | `#4E4020` | su borde |

`#F2B01E` es el del logo entregado y el de la landing `/vsl`. **Antes había cuatro
dorados para una misma marca** —`#C8870C`, `#F0C60A`, y el par `#F6D365`/`#EF9F27`
que `MakoBrand.tsx` definía por su cuenta—. Los otros cuatro tokens son derivados.

`--mako-ink` no es un capricho: `#F2B01E` sobre blanco da **2,0:1** y es ilegible;
el bajado de luminosidad da 5,2:1. En oscuro se invierte —`#8F6709` ahí da 2,97:1—
y por eso `--mako-ink` apunta al dorado original. **No se inventa un quinto
dorado.**

⚠️ **El dorado de MaKo no admite texto blanco.** Es un amarillo de luminancia
alta; lo que va encima es tinta oscura.

### Los neutros — fríos, no cálidos

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#F4F6F9` | `#22262E` |
| `--surface` | `#FFFFFF` | `#2A2F39` |
| `--surface-2` | `#F5F7FA` | `#333944` |
| `--border` | `#EAECF1` | `#383D47` |
| `--border-strong` | `#DCE0E7` | `#4A5160` |
| `--ink` | `#12151B` | `#F3F5F8` |
| `--dim` | `#5B6472` | `#A8B0BD` |
| `--faint` | `#98A0AC` | `#7C8492` |

Blanco y gris azulado, para el mismo look limpio de la landing `/vsl`.

### Acción y semánticos

| Token | Claro | Oscuro |
|---|---|---|
| `--primary` | `#2F6FED` | `#7FA6F8` |
| `--primary-strong` | `#245FD6` | `#9DBBF5` |
| `--primary-bg` | `#EAF1FE` | `#26324A` |
| `--primary-weak` | `#9DBBF5` | `#4B6693` |
| `--good` / `--good-bg` | `#1E9E57` / `#E7F5EC` | `#4FC98A` / `#17301F` |
| `--warn` / `--warn-bg` | `#B4530E` / `#FDEEE1` | `#EFA05A` / `#33230F` |
| `--warn-fill` | `#EE7B1C` | *(no se redefine)* |
| `--bad` / `--bad-bg` | `#D0504A` / `#FBEAEA` | `#EF8B85` / `#351C1B` |

El azul de acción también sale de `/vsl`. En oscuro sube porque `#2F6FED` ahí da
3,3:1. `--warn` es el legible (texto y borde) y `--warn-fill` el relleno.

### La isla oscura — el sidebar

`--sidebar #14161B` · `--sidebar-2 #1E212A` · `--sidebar-line #383D47` ·
`--sidebar-text #949CAA` · `--on-sidebar #F3F5F8`. No se redefinen en tema oscuro.

⚠️ **`--sidebar-line` es un color OPACO, no un gris bajado de opacidad.** Sale del
grafo del Second Brain: una arista con `opacity` sobre un gris claro se ve lavada
y sucia. Obsidian usa un opaco a dos escalones del fondo (#3f3f3f sobre #1e1e1e) y
por eso se lee limpio.

El hover de una fila es `rgba(255,255,255,.055)` y vive en CSS, no en un estilo en
línea, para que pueda ganarle al color base.

### Canales

`--wa #1E9E57` · `--wa-bubble #DDF3E4` · `--auto-bubble #FBEFCF` ·
`--wa-noof #5B6BD6` · `--wa-noof-bubble #E7E9FB`.

El canal **no oficial** (Evolution) va en índigo, para distinguirlo del verde
oficial sin romper la paridad de diseño (cinta + chip + burbuja).

### Los seis tonos, que es lo que consume el código

Ninguna pieza elige colores sueltos: elige un tono, y el tono trae su paleta de
cuatro. El tipo es cerrado — es lo que hace que un warning se vea igual en el CRM
y en el Ads Manager.

| Tono | Significa | ink | fill | bg | border |
|---|---|---|---|---|---|
| `mako` | intervino la inteligencia | `--mako-ink` | `--mako` | `--mako-bg` | `--mako-border` |
| `info` | el usuario puede actuar | `--primary` | `--primary` | `--primary-bg` | `--primary-weak` |
| `good` | favorable o completado | `--good` | `--good` | `--good-bg` | `--good` |
| `warn` | cuidado (naranja, NO dorado) | `--warn` | `--warn-fill` | `--warn-bg` | `--warn-fill` |
| `bad` | riesgo, error, destrucción | `--bad` | `--bad` | `--bad-bg` | `--bad` |
| `neutral` | sin carga semántica | `--dim` | `--faint` | `--surface-2` | `--border-strong` |

Los únicos donde `ink ≠ fill` son `mako` y `warn`, por la misma razón: el legible
y el saturado no pueden ser el mismo color.

### El tema oscuro

No hay modo oscuro global ni `prefers-color-scheme`. Hay **una pantalla** que se
pinta oscura —`/second-brain`— marcando `<html data-tema="oscuro">` y
**redefiniendo tokens, no reglas**: todo lo que ya consume `var(--surface)` se da
vuelta solo. El inventario contó 40 usos en tres archivos; tocarlos uno por uno
era garantizar que el próximo se olvidara.

**La regla para agregar tokens ahí:** en oscuro las superficies **suben** de
luminosidad. `--sidebar-2` (#1E212A) es *más oscuro* que ese fondo y da 1,06:1: no
sirve como superficie elevada. Y las líneas van con un color opaco a dos escalones
del fondo.

⚠️ **El tema oscuro va contra la dirección estética elegida, y está escrito para
que el que venga no crea que fue un descuido.** El §12 del documento de rediseño
dice «navegación oscura estable, ÁREA OPERATIVA CLARA» y lista como antipatrón
«interfaz de cripto o casino por exceso de negro y dorado». El dueño lo pidió
explícito para el mapa. La defensa contra el antipatrón es que el dorado sigue
reservado a UNA cosa —«tu Norte»— y no se agrega ni un borde dorado más.

El fondo es `#22262E` y no `#14161B` para que la navegación no se funda con la
página: un escalón por encima mantiene el rail más oscuro, que es la jerarquía
correcta.

---

## 3 · Tipografía

**Geist** para todo, **Geist Mono** para números, códigos y etiquetas en mayúscula
con tracking — nunca prosa. Se carga por CDN de Google: Geist en 400/500/600/700 y
Geist Mono en 400/500/600.

Hay cuatro variables más —`--font-display`, `--font-body`, `--font-cormorant`,
`--font-dm-sans`— y **las cuatro apuntan a la misma cadena**. Los dos últimos
nombres son heredados y no cargan Cormorant ni DM Sans.

### La escala — por ROL, no por tamaño

| Token | Desktop | Mobile ≤820px | Para qué |
|---|---|---|---|
| `--fs-meta` | 12 | 13 | metadata, chips, timestamps |
| `--fs-sm` | 13 | 14.5 | texto secundario |
| `--fs-md` | 14 | 16 | **el texto base** |
| `--fs-card` | 15.5 | 16.5 | título de tarjeta |
| `--fs-sect` | 21 | 20 | título de sección |
| `--fs-page` | 30 | 26 | título de página |
| `--fs-kpi` | 34 | 30 | el número grande de un KPI |

Esa media query es **la única del sistema**: los primitives leen las variables, así
que ninguna pantalla escribe la suya. Fijate que `--fs-sect` y `--fs-page` **bajan**
en mobile mientras el resto sube — un título de página de 30 px en un teléfono es
un cartel, no un título.

**Pesos:** `normal: 500` · `medium: 600` · `bold: 700`. El «normal» es 500, no 400.
600 es «título/activo»; 700 se reserva para acciones y números.

Los números van siempre `font-variant-numeric: tabular-nums`.

⚠️ **No hay token por debajo de 12 px, a propósito.** El documento reserva el 10-11
para «información excepcionalmente secundaria», y hoy hay 2.392 de 3.815 `fontSize:`
en línea por debajo de 14: si el token existiera, se usaría.

⚠️ **No existe ningún token de letter-spacing.** Cero en `app/_ui` y en
`globals.css`, contra **564 `letterSpacing` escritos a mano** en las pantallas. Si
hace falta una regla de tracking, hoy no está escrita en ninguna parte.

---

## 4 · Forma y medida

| Qué | Valor |
|---|---|
| Radios | `--r-sm 8` · `--r-md 11` · `--r-lg 14` · `--r-xl 18` · `pill 999` |
| Espaciado | `4 · 8 · 12 · 16 · 24 · 32` — múltiplos de 4 |
| Padding de card | `--card-pad 28` (18 en mobile) |
| Gap de sección | `--sect-gap 22` (16 en mobile) |
| Ancho de página | `--pagina-max 1280` |
| Área táctil | `--touch 40` (44 en mobile) |
| Transición | `.14s ease` en fondo, borde, color y sombra |

Los nombres del espaciado **son tamaños, no lugares**: `space.md` es una medida, no
«el gap de las cards».

Cambiar un radio acá lo cambia en los 1.158 botones, que es el punto. El área táctil
se alcanza **con padding**, no agrandando el ícono.

**Sombras — solo tres niveles**, y el rgb de las tres es `--ink` en decimal:

```
card   0 1px 2px    rgba(18,21,27,.05)
pop    0 16px 40px  rgba(18,21,27,.22)
modal  0 30px 70px  rgba(18,21,27,.35)
```

Fuera de eso, **sin sombras y sin gradientes**, salvo el de marca.

### El anillo de foco

```
--focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary)
```

Uno solo para toda la app. ⚠️ **SÓLIDO, no un glow translúcido.** Era
`rgba(47,111,237,.28)`, que compuesto sobre blanco da `#C5D7FA`: **1,45:1** contra
el fondo de al lado, contra el 3:1 que pide WCAG 1.4.11.

Y acá **el diagnóstico obvio era el equivocado**: una prueba automatizada confirma
que el `box-shadow` está —la aserción pasa— y aun así el que navega con teclado no
ve dónde está parado. **Que exista no es que se vea.** El halo interno de 2 px en
color de superficie no es decoración: es lo que despega el anillo del fondo del
control cuando el control tiene relleno.

En tema oscuro el halo es `var(--bg)`, no `var(--surface)`, o pinta un aro blanco
puro. Y hay un bloque global para Alto contraste de Windows.

---

## 5 · Las piezas gráficas

Se **montan, no se dibujan**: son componentes React en
`app/_components/MakoBrand.tsx`.

| Pieza | Qué es |
|---|---|
| `MakoStar` | la chispa de cuatro puntas. La que llevan los botones «✨ MaKo» |
| `MakoLogo` | el badge con la chispa adentro. El de la barra |
| `MakoWord` | la palabra **MaKo**, con la K en dorado |
| `MakoIntro` | el loader grande de bienvenida |

⚠️ **El logo no es un archivo.** `public/mako.svg` es el viejo y además no es
vector de verdad: lleva un PNG en base64 adentro. No usarlo.

La chispa es un solo path, reusado en todas las piezas:

```
M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z
```

Va en `viewBox="-12 -12 24 24"`, con un `<circle r="1.6">` en `(8.5, -8.5)` que es
el destello chico. El gradiente va de `var(--mako-lite)` a `var(--mako)` — son
variables, no hex: un `var()` funciona igual dentro de un `stop-color` de SVG, así
que no hace falta duplicar nada.

El badge es un `rect` de 45×45 con `rx=13` sobre un gradiente `#2A251C → #171511`,
con borde `--mako` al 35% de opacidad. El oscuro de marca es `#1A1813`.

Cada pieza genera sus propios ids de gradiente y nombres de keyframes a partir de
`useId()`, así que se pueden montar varias en la misma pantalla sin pisarse.

### Cuándo puede brillar

> El barrido se pasa a mano y solo cuando **marca un momento**: la IA arrancando,
> un resultado que acaba de llegar. Un wordmark que brilla siempre en la barra y
> adentro de cada modal deja de decir «MaKo está haciendo algo» y pasa a ser
> decoración — que es justo el significado que el dorado viene a recuperar.

Vale igual para la estrella: en un botón brilla porque el botón es una invitación
a activarla; en una tarjeta que ya está ahí, quieta, no. La primitive `<Mako>` la
pide **apagada** para los estados en reposo y encendida solo para «Revisando» y
«Aplicando el cambio», que son los dos momentos de proceso reales.

El shimmer del wordmark está apagado por defecto. El de la estrella sigue en `true`
para no cambiarle el brillo a los botones que ya existen.

---

## 6 · La voz — son DOS, y no se mezclan

> La UI va en **español neutro profesional** (de «tú» o impersonal): el producto se
> usa en México y el tono rioplatense se lee como descuido. La **única** excepción
> es la voz de MaKo cuando le escribe a un lead — ahí sí vosea, porque es la
> persona de marca.

### MaKo hablándole a un lead

Se define así: *«Sos MaKo, el consultor IA de Martín Koncke. Hablás en español
rioplatense, voseo siempre. Amable pero MUY directo. Cálido sin vueltas, de igual a
igual, nunca desde un pedestal ni tratando al otro de tonto.»*

Los siete rasgos, textuales:

- **Honestidad radical.** Decís lo que nadie dice.
- **Reformulás:** «El problema no es X. Tampoco Y. El problema real es Z.»
- **Concreto siempre:** números, ejemplos, próximos pasos. Nada de teoría flotando.
- **Remates cortos y contundentes**, de una línea, para clavar la idea.
- **Ritmo de oralidad:** frases que respiran. Escribís como hablás, no como un manual.
- **Muletillas con medida**, no todas juntas: «Mirá…», «Ojo con esto», «Y acá está
  la clave», «No te voy a vender humo».
- **Podés putear suave y con criterio** cuando suma confianza. Picante argentino, no
  vulgaridad.

Y lo prohibido: *vender humo, urgencia falsa, prometer cifras mágicas, hablar
«marketinero» genérico, ni inventar datos que no estén.*

En qué cree, que es lo que guía sus conclusiones:

1. **El orden importa más que las tácticas**: primero oferta, después adquisición,
   después sistematización, después escala.
2. **Facturación ≠ vanidad.** Lo que importa es la capacidad de convertir y la
   rentabilidad real.
3. **No hay método ganador universal**: existe el correcto para ESTE negocio, en
   ESTE momento.
4. **Velocidad, facilidad y honestidad: solo se eligen dos.** Acá elegimos
   velocidad y honestidad → es real, no fácil.

### El núcleo que lee TODA la IA

`MAKO_NUCLEO` se antepone a los prompts de cada feature y **no se edita desde la
UI**:

- Markdown con **negritas** para lo clave. Nada de muros de texto.
- El primer mensaje breve e impactante (2-4 líneas): lo más importante, no un
  resumen de todo.
- **REGLA DURA: nunca termines con una pregunta.** Cerrá con una afirmación,
  recomendación o próximo paso concreto.
- No inventes datos que no estén; si algo no se puede concluir, decilo.
- La regla de cómo se escribe la marca.
- **HIPÓTESIS, NO VERDADES.** Nunca declares una relación causa-efecto como
  conclusión cerrada. Enmarcá tus lecturas como hipótesis («el dato sugiere…») y
  cerrá proponiendo iniciar un experimento.

Encima de eso hay **seis modos** editables desde `/configuraciones`: persona,
analista, comparador, guiones, consultor y closer.

Todos los prompts de feature abren con la misma fórmula — «Sos MaKo, …» + el oficio
concreto: *el «perro guardián» de las prioridades*, *analista de guiones
publicitarios*, *el copiloto de marketing del dueño de un negocio*. ⚠️ Se repite en
~40 templates pero **no está declarada como regla en ningún módulo**: es un patrón
observado, no un contrato.

### La interfaz

- **Español neutro, sin voseo.**
- Cada tab, botón o card **se entiende solo**. Explícito le gana a ingenioso.
- Los apodos van acompañados: «Prioridades — El Perro Guardián», nunca a secas.
- **Sin subtítulos.** La única bajada admitida es la línea de propósito del
  `PageHeader`, y si se deduce del título va vacía.
- **Cero emojis.** Los botones llevan `<Icon>`.
- **Ningún botón puede ser «Sí», «No», «Aceptar», «Cancelar» ni «Descartar» a
  secas.** Cada uno nombra su acción y su objeto, y el par de salidas resume qué
  pasa con cada una: «Enviar 340 mensajes» / «No enviar».
- Vocabulario obligatorio: **Exportar/Importar** es la acción, **«Descargar ↓»** el
  botón. «Bajar» está prohibido.

Los nombres de tabs y familias van **en inglés** —cortos y reconocibles— y el copy
en español. Es deliberado.

Y dos frases fijas, porque un nombre propio no explica nada solo. Van **siempre**
que el nombre aparezca por primera vez en una pantalla:

- **Second Brain** — «Analiza todo tu negocio, conecta las señales y encuentra qué
  mover.»
- **Perro Guardián** — «Vigila riesgos, compromisos y resultados para que nada
  importante se pierda.»

---

## 7 · La gramática de MaKo

Nueve estados. Cada uno tiene un rótulo fijo, una de tres formas, un tono, y
**exige** un conjunto de datos sin los cuales no se puede pintar. Lo consumen la
primitive `<Mako>`, el semáforo y el catálogo de avisos.

Las tres formas salen de las tres preguntas que se hace el usuario frente a una
pantalla:

| Forma | La pregunta | Cómo se ve |
|---|---|---|
| `decision` | ¿tengo que decidir algo? | tarjeta con salidas explícitas |
| `curso` | ¿está pasando algo? | una línea con progreso y fuente |
| `aviso` | ¿me estoy enterando? | tarjeta tranquila, sin acciones |

Nueve tratamientos visuales fue el error de la primera versión: nadie distingue
nueve cajas. Linear usa cinco tipos para sus agentes y Copilot tres.

<!-- GRAMATICA-MAKO:INICIO — generado por scripts/sync-gramatica-doc.mjs, NO editar a mano -->

Sale de `lib/mako-gramatica.ts`. **No la edites acá**: si cambia allá, cambia sola.

| Estado | Rótulo | Forma | Tono | Qué comunica | Exige |
|---|---|---|---|---|---|
| `detecto` | Algo cambió | aviso | mako | Encontró una señal que merece atención. Todavía no dice qué hacer. | un indicador discreto · la evidencia resumida · el nivel de importancia |
| `analizando` | Revisando | curso | mako | Está trabajando ahora. El usuario tiene que poder ver sobre qué. | progreso real · la fuente de datos que está leyendo |
| `explica` | Por qué pasa | aviso | mako | Traduce lo que encontró. Es el estado que construye confianza. | un título directo · la evidencia, expandible |
| `recomienda` | Sugerencia | decision | mako | Propone una acción concreta. Sin los cinco campos es un consejo genérico. | la acción · el impacto esperado · el esfuerzo · el responsable · con qué objetivo se relaciona |
| `aprobacion` | **Aprobación pendiente** | decision | warn | Solo para lo que no se puede deshacer. Nada se mueve hasta tu sí. | el alcance · los cambios previstos · la consecuencia, pegada al botón |
| `ejecuta` | Aplicando el cambio | curso | mako | Está haciendo el cambio. Sobrevive a que cierres la pantalla. | un estado persistente · qué elementos toca |
| `completo` | Hecho | aviso | good | Terminó. Si la acción se puede desandar, aquí va el Deshacer. | el resultado · los cambios · el próximo control |
| `vigila` | En seguimiento | aviso | mako | Quedó una guardia puesta. Es el estado del Perro Guardián. | la condición · la frecuencia · la última revisión · el criterio de alerta |
| `sin_conclusion` | Falta un dato | decision | neutral | Le falta información. NO es un error: es un pedido de datos. | qué fuente falta · cómo resolverlo |

El orden es el CICLO, no el alfabeto: detecta, analiza, explica, propone, pide permiso, actúa, cierra y queda vigilando. Los dos últimos son las salidas. En negrita, el único estado con `bloquea` — nada se mueve hasta que el usuario conteste.

El semáforo, para los canales sin CSS (WhatsApp y email, nunca la interfaz): 🟢 verde · 🟡 ambar · 🔴 rojo · ⚪ gris.

<!-- GRAMATICA-MAKO:FIN -->

### Las cuatro reglas que la sostienen

**Los rótulos NO nombran a MaKo.** Cinco de los nueve decían «MaKo algo»: la IA
hablando de sí misma en vez de decir qué pasa. El dorado ya dice que intervino la
inteligencia; repetir el nombre es ruido.

**Un rótulo se tiene que poder leer suelto** — en un chip, en una columna de tabla
y en un filtro. Por eso es «Sugerencia» y no «Qué conviene hacer», que pide un
renglón entero.

**`aprobacion` es SOLO para lo irreversible.** Lo que se puede desandar se hace y
se ofrece `completo` con Deshacer. No es comodidad: *«if you warn people too much,
they stop paying attention»* (NN/g), así que gastar la confirmación en lo
reversible la deja sin efecto el día que MaKo quiera borrar algo. Y «los cambios
previstos» significa **el texto a la vista** —los mensajes que se van a mandar, los
nombres de la lista—, no un resumen de cuántos son.

**`sin_conclusion` NO es un error.** Es un pedido de datos, y por eso su tono es
neutral. Un error se reintenta; esto se arregla conectando algo o cargando un dato.

### Qué gobierna `bloquea`

Tres cosas y nada más: la fila arranca abierta, su botón es el único lleno, y es el
único naranja de la pantalla.

⚠️ Antes se llamaba `esperaAlUsuario` y lo tenían **dos** estados. Ahí estaba el
error de raíz del diseño viejo: agrupaba por «¿tiene botones?» cuando la pregunta
que importa es **qué pasa si el usuario no hace nada**. Y son cosas opuestas: si
ignorás una aprobación, el envío queda congelado y vos sos el cuello de botella; si
ignorás «falta un dato», no hay nada esperando.

### El semáforo

Un solo tipo —`verde | ambar | rojo | gris`— que mapea a los tonos `good | warn |
bad | neutral`. Eran dos tipos incompatibles: una pantalla usaba `ambar`/`gris` y
otra `amarillo`/`na`.

⚠️ **El ámbar del semáforo es NARANJA, no el dorado de marca.** Mientras «cuidado»
y «MaKo» compartan tono, quien ve algo dorado no puede saber si es una advertencia
o una intervención de la inteligencia.

Los emojis existen **solo para WhatsApp y email**, donde no hay CSS y el color
tiene que viajar dentro del texto. En la interfaz va `<Mako>`, que además pone el
rótulo: un color solo deja afuera a quien no lo distingue.

⚠️ **El rótulo de un estado no es un prop.** Sale de `GRAMATICA` y no se puede
pasar por parámetro, a propósito: el día que se pueda, tres pantallas escriben
«Analizando…», «Pensando…» y «MaKo está trabajando» para el mismo estado.

---

## 8 · Las reglas de interfaz

Las que ya costaron un rediseño. El catálogo vivo está en `/admin/ui`, con el
historial de por qué cada cosa quedó así.

**Layout**
- El `<main>` de una pantalla es `<Pagina>`. Una pantalla **no elige su propio
  ancho**: había 16 con el mismo padding y topes de 720, 980, 1000, 1100 y 1200. El
  `style` de `Pagina` está tipado **sin** `maxWidth`, `width` ni `margin`: el
  compilador rechaza el ancho.
- **El único `max-width` vive en el CONTENEDOR.** Nada adentro lleva ancho propio.
  Medido: 603 px de contenido en una caja de 1134. Si hay que cuidar la medida de
  lectura, va en el párrafo (`Lectura`, 70ch), nunca en la página — un `max-width`
  en el `<main>` también angosta las tablas.
- Si el contenido no llega al tope, va **centrado**.

**Navegación**
- **Una barra de navegación no lleva scroll horizontal.** Si no entra, baja de
  renglón.
- **Una columna de navegación no scrollea, nunca.** Es la regla más dura porque el
  eje no perdona: una barra que no entra envuelve; una columna o scrollea o corta.
  Si no entra, se agrupa (`NavGrupo`) o se pliega.
- `scrollbar-width: none` está **prohibido en los dos ejes**: no elimina el scroll,
  elimina la evidencia.
- **Plegar sí, esconder no.** Lo que se pliega lleva rótulo, ícono y chevron.
- El scroll lateral sigue bien donde lo que se corre es **contenido** (`.mk-scroll-x`).
- Máximo **seis tabs**: más de seis es que falta una decisión de arquitectura. La
  tab viaja en `?tab=` leída en el server.

**Piezas**
- **Un grupo de cosas del mismo tipo es una lista con filete, no una pila de
  cajas.** Tres tarjetas del mismo tamaño apiladas son el contenedor perezoso.
- Todo lo que MaKo pone en una lista es `.mk-fila`; su nombre de estado es `.mk-pill`.
- Adentro de una lista, **una barra de progreso es el BORDE de la fila** (2 px,
  ancho completo) o no existe.
- **Una barra de gráfico se recorta al 100%, siempre**, con `overflow: hidden` — y
  se tiene que VER que está cortada: a filo, con marca y con el número al lado. Un
  valor 14× por encima del tope se dibujó con `width: 1468%` y llevó el documento a
  7.656 px de ancho.
- `Confirm` pregunta (440) · `Modal` muestra el detalle (600) · `WizardShell`
  conduce un flujo. Son tres cosas distintas, no tres tamaños de lo mismo.
- Un modal tiene **largo fijo, scrollea por dentro y nunca crece**. Nunca dos
  visibles a la vez, y cerrar devuelve al anterior sin descartar el trabajo a medias.
- **Nunca un `zIndex` literal** en una pieza que se apila.
- Los desplegables son el `Dropdown` propio, con su comportamiento.
- **Sin kicker**: el rótulo del estado no va en monospace arriba del título.

**Contenido**
- **La consecuencia de lo irreversible va pegada al botón**, en tinta normal y
  antes del click. Arriba y en gris no la lee nadie.
- **Sin sombras y sin gradientes**, salvo el de marca.
- Dos gráficos que hay que comparar **comparten el orden de las filas**, fijado por
  quien llama. Un `sort` adentro de cada gráfico es el bug.
- El tono de una barra destacada **se elige por lo que significa esa barra**, no por
  el tema de la sección.
- **Un número hardcodeado en un copy es una mentira con fecha de vencimiento.**
- Todo lo que tarda muestra loader, y el loader **cuenta qué está haciendo**.
- Todo cambio persiste solo, avisa, se deshace 5 segundos y queda en el historial.
  ⚠️ **El toast no reemplaza al historial.**

---

## 9 · El material descargable

Vive en **Conocimientos → Branding MaKo**, y no es parte del sistema de diseño: son
archivos para descargar.

| Sección | Qué hay |
|---|---|
| La marca | el logotipo, la insignia y las letras — con sus animaciones de fondo transparente para montar sobre cualquier video |
| Gráficos | los hechos a mano para las landings, en PNG de alta resolución |
| Animaciones | las de los VSL, en MP4 |
| Íconos y logos | los de las apps en sus variantes, y los logos originales |
| Videos | los mini-VSL de cada funcionalidad |

Los bytes están en el bucket **privado** `branding` de Storage (límite explícito de
200 MB por archivo, porque entran `.mov` de marca) y la ficha de cada pieza en la
tabla `branding_assets`. **En el repo no hay ni un archivo.**

Nada se sirve directo: todo pasa por URL firmada de 120 segundos. Se comparte
afuera sin login con el mecanismo de `lib/shares.ts` —token de 256 bits del que
solo se guarda el sha256, revocable de a uno— en dos modos: «cualquiera con el
enlace» o invitados por email con link personal. Un share de branding **nunca**
puede escribir.

⚠️ **Los archivos originales no están versionados.** Los scripts los leían del
escritorio, así que Storage es la única copia durable.

⚠️ **El «179 piezas» de la portada está escrito a mano**, no contado. Los
contadores de cada tab sí se calculan. El script de limpieza borró gráficos y sumó
13 piezas de marca después de que ese número se escribiera: el real solo lo sabe la
base.

---

## 10 · Lo que todavía no cierra

**De la tab Marca**, sin resolver:

1. **El avatar de los grupos de WhatsApp pinta la marca con los dos dorados
   viejos** (`lib/mako-grupo.ts:55`). Genera SVG como string en el servidor, así que
   no puede usar `var()`: necesita importar los hex de un módulo único.
2. **`MakoBrand` define seis neutros cálidos propios que no son tokens** —
   `#1A1813`, `#F3F0E7`, `#2A251C`, `#171511`, `#A39E91`, `#6B675C` — y los de la
   app son fríos.
3. **El wordmark grande usa Georgia serif**, que no es Geist ni un token.
4. **La alternancia de color letra por letra** (M dorada, a oscura, K dorada, o
   oscura) solo vive en un render: es una regla de marca sin escribir.
5. **El tipo `BrandingSeccion` no incluye «marca»**, que es la sección que abre por
   defecto. No rompe hoy porque hay un cast.

> La regla «un solo hex dorado» está escrita y se cumple en `MakoBrand.tsx`. La
> unificación del resto quedó a medias.

**Encontrado al escribir este documento:**

6. ⚠️ **Hay una segunda fuente de marca viva que contradice a la primera.** El curso
   `/conocimientos → Reglas para crear tu VSL` manda que la marca de agua del video
   lleve «estrella dorada (#F6D365→#EF9F27)» — que son exactamente **dos de los
   cuatro dorados que `globals.css` declara eliminados**. La galería pública ya usa
   el nuevo (`#F2B01E`). Ese curso es el único lugar de Conocimientos con reglas de
   marca escritas, así que no alcanza con corregir el hex: hay que decidir si es
   fuente de verdad o si sus reglas se mudan acá.
7. **La fórmula «Sos MaKo, …»** abre ~40 prompts de features y no está declarada
   como regla en ningún módulo.
8. **La paleta del portal `/conocimientos` no es la de la app**, y su fallback
   hardcodeado (`#C8F169`) tampoco coincide con su propio token (`#CDF13B`).
9. **No hay ningún token de letter-spacing**, contra 564 usos escritos a mano.
10. Los puntos 3 y 4 de la tab Marca **citan números de línea desfasados**. Los
    textos son correctos; las referencias, viejas.

---

*Fuentes: `app/globals.css` · `app/_ui/tokens.ts` · `app/_ui/LEEME.md` ·
`app/_components/MakoBrand.tsx` · `lib/mako-gramatica.ts` · `lib/mako-persona.ts` ·
`lib/mako-prompts.ts` · `app/admin/ui/` · `app/conocimientos/` · `AGENTS.md` ·
`docs/hallazgos-ui.md` · `docs/mapa-del-proyecto.md`.*
