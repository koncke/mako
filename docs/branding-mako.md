# La marca MaKo

Este documento no existía. La marca estaba repartida en cinco lugares que no se
hablan entre sí: el color en `app/globals.css`, el logo en
`app/_components/MakoBrand.tsx`, la voz en `lib/mako-persona.ts`, las reglas de
copy en `docs/mapa-del-proyecto.md`, y los archivos descargables en
`/conocimientos → Branding MaKo`.

⚠️ **«Branding MaKo» dentro de Conocimientos NO es un manual**: es una GALERÍA de
archivos (logos, gráficos, animaciones, íconos, videos) que vive en el bucket
privado `branding` de Storage. No tiene una sola línea sobre color, tipografía o
voz. Todo lo de acá abajo se sacó del código.

La versión con los logos y las muestras a la vista está en **`/admin/ui`**, tab
**Marca**. Este documento es la versión que se puede llevar afuera.

---

## 1 · El nombre

**MaKo.** M mayúscula, **K MAYÚSCULA en el medio**.

Nunca «Maco», «Mako», «MAKO» ni «Macko». Es la regla que más se rompe: una
transcripción de audio deja «Maco» casi siempre.

Hay una función que lo corrige —`corregirMarca()` en `lib/mako-gramatica.ts`— y
corre en la transcripción de audio, en la limpieza de tareas y en el núcleo de
los prompts. Su lista es **cerrada y con palabras completas** a propósito:
`maco`, `mako`, `macko`, `makko`. «Marco» no está — es un nombre de persona, y
convertir el nombre de alguien en el de la marca es peor que dejar un «Maco»
suelto.

**Cómo firma la IA**, un solo actor para todo el producto:

| Dónde | Cómo firma |
|---|---|
| Al final de un mensaje que sale | `— MaKo` (guion largo + espacio) |
| En el historial y las etapas | `MaKo` |
| Como setter de una nutrición | `MaKo` |

---

## 2 · Color

El sistema es **tema claro con islas oscuras**. No hay modo oscuro global y no se
está agregando uno: cuando una pantalla tiene que ser oscura se redefinen los
tokens, no las reglas.

### Los neutros (fríos)

| Token | Hex | Qué es |
|---|---|---|
| `--bg` | `#F4F6F9` | el lienzo de la página |
| `--surface` | `#FFFFFF` | las tarjetas y los paneles |
| `--surface-2` | `#F5F7FA` | la superficie de segundo nivel |
| `--border` | `#EAECF1` | la línea por defecto |
| `--border-strong` | `#DCE0E7` | la línea que separa de verdad |
| `--ink` | `#12151B` | el texto |
| `--dim` | `#5B6472` | el texto secundario |
| `--faint` | `#98A0AC` | los rótulos y la metadata |

### El dorado — el color de MaKo

| Token | Hex | Cuándo |
|---|---|---|
| `--mako` | `#F2B01E` | el dorado. Rellenos, bordes, la chispa |
| `--mako-lite` | `#F8CB63` | el alto del gradiente de marca |
| `--mako-ink` | `#8F6709` | el dorado bajado de luminosidad **para que se LEA sobre fondo claro** |
| `--mako-bg` | `#FDF4DE` | el fondo suave |

⚠️ **El dorado significa una cosa: intervino la inteligencia de MaKo.** No es un
color decorativo ni un acento de marca para usar donde quede lindo. Si aparece en
algo que no hizo la IA, deja de significar nada — y ese significado es
exactamente lo que el dorado vino a recuperar.

`--mako-ink` existe porque `--mako` sobre blanco no llega al contraste mínimo.
Sobre fondo oscuro se usa `--mako` directo.

### Los semánticos

| Token | Hex | |
|---|---|---|
| `--good` | `#1E9E57` | hecho, sano |
| `--warn` | `#B4530E` | atención |
| `--bad` | `#D0504A` | roto, vencido |
| `--primary` | `#2F6FED` | el azul de acción (links, primarios) |

### La isla oscura — el sidebar

| Token | Hex |
|---|---|
| `--sidebar` | `#14161B` |
| `--sidebar-2` | `#1E212A` |
| `--sidebar-line` | `#383D47` |
| `--sidebar-text` | `#949CAA` |

### Tres reglas de color que ya costaron un rediseño

1. **El color nunca es el único portador de significado.** Un semáforo lleva
   siempre su número o su palabra al lado.
2. **El tono se elige por lo que SIGNIFICA la pieza destacada, no por el tema de
   la sección.** Un gráfico sobre costos no es «malo» por ser sobre costos —
   pintar de rojo «el único canal que sí entra en el techo» hace que el gráfico
   afirme lo contrario del dato, y se lee antes que el texto.
3. **En una pantalla oscura se redefinen TOKENS, no reglas.** Y hay que mirar a
   mano los que existen PARA un fondo: `--mako-ink` sobre oscuro da 2,97:1, así
   que ahí apunta a `--mako`.

---

## 3 · Tipografía

**Geist**, con `system-ui, sans-serif` de respaldo. Es la única familia: las
variables `--font-display`, `--font-body`, `--font-cormorant` y `--font-dm-sans`
apuntan todas a Geist — quedaron de exportaciones anteriores.

La escala es por ROL, no por tamaño, y cambia entre densidad compacta y normal:

| Token | Compacta | Normal | Para qué |
|---|---|---|---|
| `--fs-meta` | 12 | 13 | metadata, chips, timestamps |
| `--fs-sm` | 13 | 14.5 | texto secundario |
| `--fs-md` | 14 | 16 | **el texto base de la interfaz** |
| `--fs-card` | 15.5 | 16.5 | título de tarjeta |
| `--fs-sect` | 21 | 20 | título de sección |
| `--fs-page` | 30 | 26 | título de página |
| `--fs-kpi` | 34 | 30 | el número grande de un KPI |

Los números van siempre `font-variant-numeric: tabular-nums`.

⚠️ **El wordmark grande usa Georgia serif**, que no es Geist ni un token. Está
declarado como pendiente en la tab Marca — ver §8.

---

## 4 · Las piezas gráficas

Se **montan, no se dibujan**: son componentes React en
`app/_components/MakoBrand.tsx`.

| Pieza | Qué es |
|---|---|
| `MakoStar` | la chispa de cuatro puntas. La que llevan los botones «✨ MaKo» |
| `MakoLogo` | el badge con la chispa adentro. El de la barra |
| `MakoWord` | la palabra **MaKo**, con la K en dorado |
| `MakoIntro` | el loader grande de bienvenida |

La chispa es un solo path, reusado en todas las piezas para que la marca sea
coherente:

```
M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z
```

Cuatro puntas, centrada en el origen, radio ~11.

El gradiente de marca va de `--mako-lite` a `--mako`. **Sale del único dorado del
sistema**: antes este archivo definía sus propios hex y la marca llegó a tener
cuatro dorados distintos.

El oscuro de marca es `#1A1813` — no es dorado, es el fondo sobre el que vive.

### Cuándo puede brillar

El barrido del wordmark (*shimmer*) y la animación de la estrella **se pasan a
mano y solo cuando marcan un momento**: la IA arrancando, un resultado que acaba
de llegar.

Un wordmark que brilla siempre en la barra y adentro de cada modal deja de decir
«MaKo está haciendo algo» y pasa a ser decoración.

Por eso la primitive `<Mako>` pide la estrella **apagada** para los estados en
reposo, y encendida solo para «Revisando» y «Aplicando el cambio», que son los
dos momentos de proceso reales.

---

## 5 · La voz — son DOS, y no se mezclan

### MaKo hablándole a un lead

- **Voseo rioplatense**, siempre. Es la persona de marca.
- Honestidad radical, concreto, remates de una línea.
- **Nunca termina con una pregunta**: cierra con una recomendación o un próximo
  paso.
- Hipótesis, no verdades: «el dato sugiere…», y propone un experimento.
- Nunca: humo, urgencia falsa, cifras mágicas, datos inventados.

### La interfaz

- **Español neutro profesional, sin voseo.** El producto se usa en México y el
  rioplatense se lee como descuido.
- Cada tab, botón o card **se entiende solo**. Explícito le gana a ingenioso.
- Los apodos van acompañados: «Prioridades — El Perro Guardián», nunca a secas.
- **Sin subtítulos.** La única bajada admitida es la línea de propósito del
  `PageHeader`, y si se deduce del título va vacía.
- **Cero emojis.** Los botones llevan `<Icon>`.
- **Ningún botón puede ser «Sí», «No», «Aceptar», «Cancelar» ni «Descartar» a
  secas.** Cada uno nombra su acción y su objeto, y el par de salidas resume qué
  pasa con cada una: «Enviar 340 mensajes» / «No enviar».

Los nombres de las tabs y las familias van **en inglés** —cortos y reconocibles—
y el copy en español. Es deliberado.

---

## 6 · La gramática de MaKo

Nueve estados. Cada uno tiene un rótulo fijo, una forma, un tono, y **exige** un
conjunto de datos sin los cuales no se puede pintar. Vive en
`lib/mako-gramatica.ts` y lo consumen la primitive `<Mako>`, el semáforo y el
catálogo de avisos.

| Estado | Rótulo | Forma | Tono | Exige |
|---|---|---|---|---|
| `detecto` | Algo cambió | aviso | mako | un indicador discreto · la evidencia resumida · el nivel de importancia |
| `analizando` | Revisando | curso | mako | progreso real · la fuente de datos que está leyendo |
| `explica` | Por qué pasa | aviso | mako | un título directo · la evidencia, expandible |
| `recomienda` | Sugerencia | decisión | mako | la acción · el impacto · el esfuerzo · el responsable · con qué objetivo se relaciona |
| `aprobacion` | Aprobación pendiente | decisión | warn | el alcance · los cambios previstos · la consecuencia, pegada al botón |
| `ejecuta` | Aplicando el cambio | curso | mako | un estado persistente · qué elementos toca |
| `completo` | Hecho | aviso | good | el resultado · los cambios · el próximo control |
| `vigila` | En seguimiento | aviso | mako | la condición · la frecuencia · la última revisión · el criterio de alerta |
| `sin_conclusion` | Falta un dato | decisión | neutral | qué fuente falta · cómo resolverlo |

### Las cuatro reglas que sostienen la gramática

**Los rótulos NO nombran a MaKo.** Cinco de los nueve decían «MaKo algo»: la IA
hablando de sí misma en vez de decir qué pasa. El dorado ya dice que intervino la
inteligencia; repetir el nombre es ruido.

**Un rótulo se tiene que poder leer suelto** — en un chip, en una columna de
tabla y en un filtro. Por eso es «Sugerencia» y no «Qué conviene hacer», que pide
un renglón entero.

**`aprobacion` es SOLO para lo irreversible.** Lo que se puede desandar se hace y
se ofrece `completo` con Deshacer. No es comodidad: un diálogo de confirmación
pierde poder con el uso, así que gastarlo en lo reversible lo deja sin efecto el
día que MaKo quiera borrar algo. Y «los cambios previstos» significa **el texto a
la vista** —los mensajes que se van a mandar, los nombres de la lista—, no un
resumen de cuántos son.

**`sin_conclusion` NO es un error.** Es un pedido de datos, y por eso su tono es
neutral y no `bad`.

⚠️ **El rótulo de un estado no es un prop.** Sale de `GRAMATICA` y no se puede
pasar por parámetro, a propósito: el día que se pueda, tres pantallas escriben
«Analizando…», «Pensando…» y «MaKo está trabajando» para el mismo estado.

---

## 7 · Las reglas de interfaz

Las que ya costaron un rediseño. El catálogo vivo está en `/admin/ui`.

**Layout**
- El `<main>` de una pantalla es `<Pagina>`. Una pantalla **no elige su propio
  ancho**: había 16 `maxWidth` distintos con el mismo padding.
- **El único `max-width` vive en el CONTENEDOR.** Nada adentro lleva ancho
  propio. Un `max-width` en el texto de una caja más ancha deja la mitad vacía a
  la derecha.
- Si el contenido no llega al tope, va **centrado**.

**Navegación**
- **Una barra de navegación no lleva scroll horizontal.** Si no entra, baja de
  renglón.
- **Una columna de navegación no scrollea, nunca.** Si no entra, se agrupa o se
  pliega.
- `scrollbar-width: none` está **prohibido**: no elimina el scroll, elimina la
  evidencia.
- **Plegar sí, esconder no.** Lo que se pliega lleva rótulo, ícono y chevron.

**Piezas**
- **Un grupo de cosas del mismo tipo es una lista con filete, no una pila de
  cajas.** Tres tarjetas del mismo tamaño apiladas son el contenedor perezoso: la
  caja se gana.
- Todo lo que MaKo pone en una lista es `.mk-fila`; su nombre de estado es
  `.mk-pill`.
- Adentro de una lista, **una barra de progreso es el BORDE de la fila** (2 px,
  ancho completo) o no existe.
- **Una barra de gráfico se recorta al 100%, siempre**, con `overflow: hidden` en
  el carril — y se tiene que VER que está cortada: a filo, con marca y con el
  número al lado.
- `Confirm` pregunta · `Modal` muestra el detalle · `WizardShell` conduce un
  flujo. Son tres cosas distintas, no tres tamaños de lo mismo.

**Contenido**
- **La consecuencia de lo irreversible va pegada al botón**, en tinta normal y
  antes del click. Arriba y en gris no la lee nadie.
- **Sin sombras y sin gradientes**, salvo el de marca.
- Dos gráficos que hay que comparar **comparten el orden de las filas**, fijado
  por quien llama. Un `sort` adentro de cada gráfico es el bug.

**Radios:** `--r-sm` en controles, `--r-md` en cajas, `--r-lg` en contenedores.

---

## 8 · Lo que todavía no cierra

Está declarado en la tab Marca y sigue abierto:

1. **El avatar de los grupos de WhatsApp pinta la marca con los dos dorados
   viejos** (`lib/mako-grupo.ts:55`). Genera SVG como string en el servidor, así
   que no puede usar `var()`: necesita importar los hex de un módulo único.
2. **`MakoBrand` define seis neutros cálidos propios que no son tokens** —
   `#1A1813`, `#F3F0E7`, `#2A251C`, `#171511`, `#A39E91`, `#6B675C` — y los
   neutros de la app son fríos.
3. **El wordmark grande usa Georgia serif**, que no es Geist ni un token.

---

## 9 · El material descargable

Vive en **Conocimientos → Branding MaKo**, no en el sistema de diseño: son
archivos para descargar, no piezas de interfaz.

| Sección | Qué hay |
|---|---|
| La marca | logotipo, insignia y letras, con sus animaciones, fondo transparente |
| Gráficos | los de las landings, en PNG de alta resolución |
| Animaciones | las de los VSL, en MP4 |
| Íconos y logos | los de las apps y los logos originales |
| Videos | los mini-VSL de cada funcionalidad |

Los bytes están en el bucket **privado** `branding` de Storage y se sirven con
URL firmada, nunca directa. Se comparte por link con el mecanismo de
`lib/shares.ts`: token de 256 bits del que solo se guarda el sha256, revocable de
a uno y revalidado en cada request.

⚠️ **Los archivos originales no están versionados en el repo.** Se subieron desde
el escritorio, así que Storage es la única copia durable.

---

*Fuentes: `app/globals.css` · `app/_ui/tokens.ts` · `app/_components/MakoBrand.tsx`
· `lib/mako-gramatica.ts` · `lib/mako-persona.ts` · `app/admin/ui/` ·
`app/_ui/LEEME.md` · `docs/hallazgos-ui.md` · `AGENTS.md`.*
