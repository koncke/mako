# Hallazgos de la UI

Las piezas de `app/_ui`, `app/_components` y `app/components` las usan **todas** las tabs:
un cambio acá tiene 20+ llamadores. Esto es lo que hay que saber antes de tocar
`WizardShell`, la pila de modales, el `Dropdown` propio o el progreso de un formulario.
**No es un changelog.** Acá también viven las reglas de UI que el dueño repitió hasta
cansarse: si una pantalla nueva las rompe, vuelve rebotada.

⚠️ **Parte de este material es de segunda mano.** Sale de los journals de las 261 corridas
multi-agente de junio a agosto de 2026 —134 de 260 nunca escribieron nada en el repo— y de
minar 1038 mensajes del dueño, no de releer el código de hoy. Cada entrada dice de qué
corrida y fecha viene; antes de actuar sobre una, verificá contra el código: varias ya
están arregladas. El registro de corridas está en [corridas-multiagente.md](corridas-multiagente.md).

## Lo que más muerde acá

- **El dorado no significa «MaKo», significa «destacado»**: en ~25 superficies marca la tab
  activa, un KPI, un avatar sin foto y hasta la burbuja del **humano** en el chat. Por eso
  la marca se siente a IA — si el color no distingue, la chispa queda sola haciendo todo el
  trabajo → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Un overlay que elige su propio `zIndex` queda **debajo** del backdrop: confirmás y la
  pantalla no se mueve, sin error ni spinner → [Modales y capas](#modales-y-capas).
- `.mk-scroll-x` clipea en los **dos** ejes: cualquier popover `absolute` adentro es
  invisible para todo usuario, en cualquier ancho → [Primitives y sistema visual](#primitives-y-sistema-visual).
- El `Dropdown` de la casa **no** hace clickeable al `placeholder`: migrar un `<select>`
  con `<option value="">` pierde la opción de vaciar → [Primitives y sistema visual](#primitives-y-sistema-visual).
- `router.refresh()` no remonta componentes cliente ni re-corre sus efectos: la pantalla
  se queda vieja y el wizard trabado → [Estado y datos en el cliente](#estado-y-datos-en-el-cliente).
- Una pieza que acepta dos formas de recibir el mismo dato contesta distinto en cada modo:
  "Último paso (7)" con el botón diciendo "Siguiente →" → [Wizards y formularios](#wizards-y-formularios).
- Un `<Icon name>` mal escrito o un `<use>` sin su `<symbol>` **no rompen**: pintan un
  puntito gris o un cuadrado liso, sin error, sin warning → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Una fila de tabs con `overflowX: auto` **y** la scrollbar escondida por CSS borra los
  últimos destinos sin dejar ni una pista → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Que una pantalla no llegue al borde no lo causa ninguna regla: de 44 `<main>`, **solo 3
  centraban** y había 5 topes distintos → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Una guarda que prohíbe una palabra en pantalla engancha identificadores del código y no ve
  el texto que vive en los DATOS: falla donde no importa y calla donde sí →
  [El texto de la UI](#el-texto-de-la-ui).
- El preflight de Tailwind hace `svg { display: block }`: un ícono **no** se centra con el
  `textAlign: 'center'` del padre — queda pegado a la izquierda mientras los textos de abajo
  sí se centran → [Primitives y sistema visual](#primitives-y-sistema-visual).

---

## Primitives y sistema visual

### ⚠️ Una barra de navegación con scroll horizontal esconde destinos, y la scrollbar oculta los borra

**Síntoma:** en la ficha del lead, las últimas tabs no existen para el usuario. No hay
flecha, no hay corte visible, no hay barra de scroll: la fila simplemente termina.

**Causa:** dos decisiones que por separado parecen razonables. `LeadTabs` ponía
`overflowX: 'auto'` en el `role="tablist"` («las tabs scrollean en horizontal si no
entran, nunca doble fila»), y `globals.css` escondía la barra por estética
(`.lead-tabs-scroll { scrollbar-width: none }`). Juntas, el único indicio de que hay más
tabs desaparece.

**Regla de la casa:** una barra de **navegación** no lleva scroll horizontal. Si no
entran, bajan de renglón (`flex-wrap: wrap`). Esto contradice al §19.2 del documento de
rediseño («las tabs deben soportar scroll horizontal en mobile») y gana la regla de la
casa: esconder destinos detrás de un gesto lateral es esconderlos. El scroll lateral
sigue siendo correcto donde lo que se corre es **contenido** —una tabla, una fila de
filtros, un bloque de código—, no el mapa de a dónde se puede ir; para eso está
`.mk-scroll-x`.

**Sin arreglar:** `app/whatsapp/EmojiPicker.tsx:261` (las pestañas de categoría) y
`app/onboarding/OnboardingWizard.tsx:544` (la barra superior del modo agencia, donde el
botón «Salir de la vista» puede quedar detrás del scroll).

**Vive en:** app/_ui/Tabs.tsx · app/crm/lead-view/LeadTabs.tsx:47 (usada por
app/crm/[id]/LeadDetailBody.tsx, app/crm/[id]/EditLeadForm.tsx y app/crm/LeadSheet.tsx) ·
regla en AGENTS.md y app/_ui/LEEME.md · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ El ancho de una pantalla no lo achica ninguna regla: lo achica quien la escribe

**Síntoma:** una pantalla nueva «no llega al borde» y queda una franja muerta a la
derecha. Se busca la regla que la está achicando y no existe.

**Causa:** cada pantalla escribía su propio `<main>`, así que cada una elegía su tope por
separado. Medido sobre `app/`: de 44 `<main>`, **solo 3 centraban**; 16 valores de
padding distintos; topes de 720, 980, 1000, 1100 y 1200 según quién la escribió. Copiar
la pantalla de al lado propagaba el número. No hay nada que «arreglar» en el layout: hay
que sacar la decisión de la mano de cada pantalla.

**Regla:** el `<main>` es `Pagina` (`app/_ui/Pagina.tsx`), el tope es el token
`--pagina-max` y el contenido va **centrado** — un `maxWidth` pegado a la izquierda es lo
que deja la franja. Su prop `style` está tipada sin `maxWidth`, `width` ni `margin`: el
compilador rechaza el ancho, así que la regla no depende de que alguien se acuerde.
`ancho="completo"` para tablas y tableros. Si lo que necesita tope es **texto**, va en el
párrafo (`Lectura`, 70ch), nunca en la página: un `maxWidth` en el `<main>` también
angosta las tablas.

**Vive en:** app/_ui/Pagina.tsx · app/globals.css (`--pagina-max`) · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ Un catálogo que DIBUJA la pieza en vez de montarla no sirve para revisar nada

**Síntoma:** la sección «la barra» de `/admin/ui` no se parecía a la barra de la app. El
dueño lo dijo así: «no se ve para nada igual».

**Causa:** estaba dibujada a mano — una lista de divs que imitaba el aspecto. Dos códigos
distintos para la misma cosa: no había forma de que coincidieran, y cualquier cambio en la
barra real las separaba más.

**Regla:** en el catálogo se **monta** la pieza, no se dibuja. Si el componente real no se
puede montar tal cual, se extraen sus partes y las comparten los dos. Acá el `Sidebar`
entero no se puede montar y **el motivo no es el obvio**: no es que `usePathname()`
devuelva la ruta equivocada (eso también), es que `adminShell = rol === 'admin' &&
!impersonando` hace que para el super-admin la barra pinte `ADMIN_NAV` en vez de las
familias. O sea: la tab que documenta la barra mostraría otra barra.

**Vive en:** app/_components/BarraPreview.tsx (usa `Marca`, `Familia`, `NavLink`,
`Identidad`, `panelStyle` exportados de app/_components/Sidebar.tsx) · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ «Branding MaKo» no es un manual de marca, y las reglas que sí existen están en cinco lugares

**El diagnóstico obvio era el equivocado.** Buscar el material de marca en
`/conocimientos → Branding MaKo` parece lo correcto por el nombre. No hay nada ahí: es una
**galería de archivos descargables** (logos, gráficos, animaciones, íconos, videos) que
vive en el bucket privado `branding` de Storage, con el catálogo en la tabla
`branding_assets` (migraciones 0098 y 0100). Cero líneas sobre color, tipografía o voz.

**Dónde están de verdad:** el dorado y los neutros en `app/globals.css`; las medidas en
`app/_ui/tokens.ts`; el logo y el wordmark en `app/_components/MakoBrand.tsx`; la voz de la
IA en `lib/mako-persona.ts` + `lib/mako-prompts.ts`; las reglas de copy de la UI en
`docs/mapa-del-proyecto.md`; cómo firma la IA en `lib/pipeline.ts` (`MAKO_SETTER`) y
`lib/etapa-historial.ts`.

**Desde el 2026-08-11 los cinco lugares están juntos en `docs/branding-mako.md`**, que es la
versión que se puede llevar afuera (`/admin/ui` → Marca sigue siendo la que tiene los logos
a la vista). Ese documento es DERIVADO: la gramática de los nueve estados y la regla del
nombre las escribe `scripts/sync-gramatica-doc.mjs` desde `lib/mako-gramatica.ts`, con el
pre-push como guarda. No editar esos dos bloques a mano.

⚠️ **Y hay una SEGUNDA fuente de marca viva que contradice a la primera.**
`app/conocimientos/curso-vsl.ts:72` manda que la marca de agua del video lleve «estrella
dorada (#F6D365→#EF9F27)» — los mismos dos dorados que `globals.css:106-116` declara
eliminados. Es el único lugar de Conocimientos con reglas de marca ESCRITAS (color, Geist
bold, voz impersonal, «dinero» y no «plata», todo en «tú»), así que no alcanza con
corregir el hex: hay que decidir si es fuente de verdad o si sus reglas se mudan al manual.
La galería pública ya usa el nuevo (`app/compartido/[token]/Galeria.tsx:31`, `#F2B01E`).

**Lo que quedó SIN hacer** (está listado en `/admin/ui` → Marca → «Lo que todavía no cierra»):

- `lib/mako-grupo.ts:55` todavía pinta la marca con los dos dorados que `globals.css`
  declara eliminados (`#F6D365`/`#EF9F27`). Genera SVG como string en el servidor, así que
  no puede usar `var()`: necesita importar los hex de un módulo único.
- `MakoBrand.tsx` define seis neutros **cálidos** propios que no son tokens
  (`#1A1813`, `#F3F0E7`, `#2A251C`, `#171511`, `#A39E91`, `#6B675C`), y `globals.css` dice
  que los neutros de la app son fríos.
- El wordmark grande usa Georgia serif, que no es la tipografía de la app ni un token.
- La alternancia de color letra por letra (M dorada, a oscura, K dorada, o oscura) es una
  regla de marca que solo vive en un render.
- `lib/branding.ts:17` — el tipo `BrandingSeccion` no incluye `'marca'`, que es la sección
  que abre por defecto. No rompe hoy porque hay un `as`, pero cualquier `switch` exhaustivo
  va a estar incompleto.
- `public/mako.svg` es el logo **viejo** y además no es vector de verdad: lleva PNG en
  base64 adentro. El logo vivo es SVG en línea en `MakoBrand.tsx`.
- Los archivos originales del material de marca **no están versionados**: los scripts los
  leían del escritorio. Storage es la única copia durable.
- **No existe ningún token de letter-spacing.** Cero en `app/_ui` y en `globals.css`,
  contra **564 `letterSpacing` escritos a mano** en `app/**/*.tsx`. Si hace falta una regla
  de tracking, hoy no está escrita en ninguna parte — y con 564 usos sueltos, escribirla
  después es caro.
- **La paleta del portal `/conocimientos` no es la de la app** (lima sobre papel, no
  dorado sobre gris azulado), y su fallback hardcodeado no coincide con su propio token:
  `var(--al-accent, #C8F169)` contra `--lime: #CDF13B`.
- La fórmula **«Sos MaKo, …»** abre ~40 prompts de features y **no está declarada como
  regla en ningún módulo**: es un patrón observado, no un contrato. Un prompt nuevo que la
  omita no rompe nada y nadie se entera.
- `app/conocimientos/BrandingMaKo.tsx:24` — el «179 piezas» está escrito a mano, no
  contado, y quedó viejo cuando el script de limpieza borró gráficos y sumó 13 piezas de
  marca. Los contadores de cada tab sí se calculan.

**Vive en:** app/admin/ui/Marca.tsx · docs/branding-mako.md ·
scripts/sync-gramatica-doc.mjs · app/conocimientos/curso-vsl.ts ·
*2026-08-07 ~ui-tab-siete-puntos · ampliado 2026-08-11 ~branding-mako-fuentes (5 agentes)*

### ⚠️ El dorado no significa «MaKo»: significa «destacado». Y por eso la marca se siente a IA

**El diagnóstico obvio era el equivocado — y es el hallazgo más caro de esta área.** El
dueño dijo «la marca se siente muy IA» y todo apuntaba al mismo sospechoso: la chispa de
cuatro puntas, el ícono que usa media industria. La conclusión natural era cambiar el
símbolo, o el dorado, o los dos.

El inventario de **148 superficies verificadas una por una** (13 agentes, cada afirmación
con archivo:línea reabierto) dice otra cosa. El dorado aparece en 79 superficies y la
chispa en 84, pero **en ~25 de ellas el dorado no marca a MaKo**: marca la tab activa
(`ConfigTabs.tsx:41`), el ícono de encabezado de casi toda pantalla —el uso más repetido de
la app— (`AdminView.tsx:110`), el avatar de una persona sin foto (`AdminView.tsx:58`), el
número grande de un KPI (`comercial/page.tsx:404`), un link de texto
(`MarkdownDoc.tsx:316`), el ON de un toggle (`NotificacionesPanel.tsx:55`), el paso MEDIO
de un semáforo (`crm/lead-view/ComportamientoCard.tsx:15`), la barra destacada de un
gráfico (`pricing/Piezas.tsx:72`), chips de rol y pertenencia (`AdminView.tsx:311`), el
borde de «esta card es tuya» (`ClientesApp.tsx:307`), un spinner genérico de fetch
(`PlantillasView.tsx:83`) y «tu Norte» (`Grafo.tsx:500`, `general/page.tsx:291`).

**La rotura más cara:** en `MakoChat.tsx:192`, la pantalla donde MaKo habla, el dorado
pinta la burbuja del **humano**. Y en `/funnel` las «Automatizaciones de MaKo» se pintan de
**azul**, que en `globals.css:33` es el color declarado de «vos actuás». La marca está
invertida en las dos superficies donde más se nota.

**Causa:** `globals.css:116` declara `--accent` y `--accent-soft` como el mismo dorado con
otro nombre y **sin la restricción semántica**. El comentario de `:122-124` dice «no
agregues usos nuevos», pero `var(--accent)` es hoy el token dorado más usado de la app. Un
alias sin regla es una puerta abierta: nadie que escribe `var(--accent)` está pensando en
MaKo, está pensando «resaltá esto».

**Consecuencia en cadena, y es la que explica el síntoma.** Si el color no distingue a
MaKo, la única señal que queda es la chispa. Una chispa sola, repetida en cada superficie,
sin un color que signifique algo — eso *es* el aspecto de IA genérica. **El problema no era
que MaKo se anunciara demasiado: era que se anunciaba con una sola señal porque la otra ya
no servía.**

**La marca está copiada de oído, no importada.** Contados en el inventario:

- **21 hexes dorados/ámbar distintos** vivos en el repo. `globals.css:106-116` declara
  eliminados a `#F6D365`, `#EF9F27`, `#F0C60A` y `#C8870C` — y los cuatro siguen escritos a
  mano en `experimentos/ui.tsx:19` (tres copias de la chispa), `lib/mako-grupo.ts:53` (SVG
  generado en el servidor, no puede usar `var()`), `ServicioVisual.tsx:83` (gradiente
  `mkGold`), `NotificacionesPanel.tsx:55` y `general/page.tsx:291` (seis apariciones).
  `ScriptsBrowser.tsx:71` inventa un `#A8770F` para decir «Media».
- **6 glifos de estrella distintos**: la chispa vectorial de `MakoBrand.tsx:25`, el carácter
  `✦` (`AvisoFlotante.tsx:50`, `BuscadorTareas`), el emoji `✨` (`EmailApp.tsx:405`,
  `VozGuia`, `WhatsAppAdvisor`), `★` (`CrearTareaModal.tsx:863`), `🌟` (el primer mensaje
  de bienvenida por WhatsApp) y una de **cinco puntas dibujada a mano**
  (`CrearTareaModal.tsx:182`). Y en `BoardShell.tsx:1703` la chispa está pintada de azul,
  conviviendo en la misma pantalla con la dorada de `:984`.
- **`app/compartido/[token]/TareaCliente.tsx:437` redeclara el dorado como `--oro`** porque
  la pantalla se scopea bajo `.cd` para no heredar el chrome. Es la pantalla que ve el
  cliente, y si `--mako` cambia, no se entera.

**Regla que queda:** un color de marca necesita un **alias único y con restricción**, o se
diluye solo. Antes de tocar un hex de marca hay que arreglar `--accent`, o el rebranding
repinta 21 hexes y a los tres meses hay 22. Y la señal de una IA no puede depender de un
símbolo solo: si el color no distingue, el símbolo tiene que hacer todo el trabajo y ahí es
donde empieza a verse genérico.

**Vive en:** app/globals.css:106-126 · app/_components/MakoBrand.tsx ·
app/_components/MakoChat.tsx:164,192 · app/_components/ServicioVisual.tsx:83 ·
app/experimentos/ui.tsx:19 · lib/mako-grupo.ts:53 · app/compartido/[token]/TareaCliente.tsx:437 ·
*2026-08-13 ~inventario-superficies-mako (13 agentes, 148 superficies verificadas)*

### ⚠️ `<Mako>` tiene UN call-site de producción, y ese incumple el contrato de su propio estado

**Síntoma:** la primitive `app/_ui/Mako.tsx` y su gramática de nueve estados
(`lib/mako-gramatica.ts`) parecen el sistema vivo de la marca. Tienen catálogo
(`/admin/ui?tab=mako`), documento derivado con guarda de pre-push, y tres rondas de
rediseño encima.

**Causa:** en producción se usa **una sola vez**, en
`app/crm/[id]/resumen/AnalizarLlamada.tsx:79`. Todo el resto de las apariciones son el
catálogo (`Gramatica.tsx`). Y ese único call-site pasa `estado`, `titulo`, `fuente` y
`datos` pero **no pasa `progreso`** — que `Mako.tsx:178` declara obligatorio para
`analizando`. Verificado en el código: sin `progreso`, `Mako.tsx:333` deja el riel en null y
`Mako.tsx:383` no renderiza la barra. O sea que la única vez que un cliente ve el estado
«Revisando», lo ve **sin progreso real** — exactamente el spinner eterno que
`mako-gramatica.ts:174` prohíbe con la palabra «progreso real». Dispara el `console.warn` de
`Mako.tsx:235` y nadie lo lee.

**Regla:** un primitive sin call-sites no está terminado, está propuesto. Antes de
rediseñarlo otra vez hay que enchufarlo — si no, cada ronda de diseño se valida contra el
catálogo, que es la única pantalla donde se cumplen todos los contratos.

**Vive en:** app/_ui/Mako.tsx:178,235,333,383 · lib/mako-gramatica.ts:174 ·
app/crm/[id]/resumen/AnalizarLlamada.tsx:79 ·
*2026-08-13 ~inventario-superficies-mako*

### ⚠️ Los avisos de MaKo salen por CINCO pop-ups en cuatro esquinas, y cada uno se marca distinto

**Síntoma:** «los avisos de MaKo salen con un pop-up abajo al costado» describe bien lo que
se ve y mal lo que hay. Son cinco piezas independientes, en cuatro posiciones de pantalla,
con cinco criterios distintos de cómo se marca la autoría:

| Pieza | Dónde | Cómo se marca que es MaKo |
|---|---|---|
| `IaUsageToast.tsx:134` | abajo a la **derecha** | señal triple: chispa + dorado + la palabra |
| `AvisoFlotante.tsx:36` | abajo a la **izquierda** | el carácter `✦` en `--accent-soft` — **no** es la chispa de marca |
| `Toast.tsx:43` | abajo al **centro** | ninguna |
| `NotificationsProvider.tsx:515` y `:539` | arriba a la **derecha** | ninguna, a propósito (son de WhatsApp) |
| `MakoConfirmGate.tsx:113` | modal bloqueante | un badge con las letras «MaKo», sin chispa |

**Causa:** cada una se escribió para su caso y ninguna se escribió contra las otras. No hay
un choke point de presentación equivalente al que sí existe para el texto
(`lib/avisos.ts:73` → `emitirAviso`, con 53 mensajes en `lib/avisos-catalogo.ts`).

**Y el motor no tiene pantalla.** `emitirAviso` escribe la fila y **ninguna vista la lee**:
el badge del sidebar (`Sidebar.tsx:54-64`) cuenta otra cosa. Ya está anotado abajo en «El
feed de notificaciones existe en la base y no lo muestra nadie».

**Regla:** la autoría de MaKo se decide en **un** lugar, como el texto. Mientras haya cinco
componentes decidiendo por su cuenta si ponen chispa, cualquier cambio de marca toca cinco
archivos y se olvida de uno.

**Vive en:** app/_components/IaUsageToast.tsx:134 · app/_components/AvisoFlotante.tsx:36 ·
app/_ui/Toast.tsx:43 · app/_components/NotificationsProvider.tsx:515,539 ·
app/_components/MakoConfirmGate.tsx:113 · lib/avisos.ts:73 · lib/avisos-catalogo.ts:136 ·
*2026-08-13 ~inventario-superficies-mako*

### ⚠️ Una lista blanca de UNO se lee como regla; de DOS, se lee como excepción

**El contexto:** `exigirClienteDePrueba` protegía un solo workspace (`WS_PRUEBA = 3`) y ya
había fallado una vez en su versión negativa (`ws !== OWNER_WS`, que dejaba el botón de
vaciar dentro de **todos** los clientes reales). Al sumar el Cliente de Diseño hubo que
pasar de un número a una lista.

**Por qué es el momento peligroso, aunque el cambio sea correcto:** con un solo id, la
igualdad estricta se defiende sola — cualquiera que la lea entiende que enumerar es el
punto. Con dos, aparece la tentación de «esto se está volviendo incómodo, mejor pregunto
si NO es un cliente real», que es literalmente el bug anterior reescrito. El riesgo no
está en pasar de 1 a 2: está en pasar de 2 a 3.

**La regla, y cómo se hace cumplir:** la lista se enumera (`WS_PRUEBAS`) y **un test fija
su largo**. No es ceremonia — es lo que obliga a que un tercer workspace pase por el test
y se justifique en vez de colarse en un `push`:

```ts
assert.deepEqual([...WS_PRUEBAS].sort(), [WS_PRUEBA, WS_DISENO].sort());
assert.equal(WS_PRUEBAS.length, 2);
```

Y el test que importa de verdad no es el que prueba que el de prueba pasa: es el que
prueba que **los clientes reales siguen sin pasar**, con varios ids a la vez para que no
alcance con excluir uno a mano.

**Cómo se verifica en la pantalla, que es donde se ve el agujero:** entrar a un cliente
REAL y contar los botones peligrosos. Si aparece uno, el guard del server puede estar bien
y la UI ya está ofreciendo lo que no debe. Medido acá sobre ws 5: cero temas, cero «Datos
de Mauricio», cero Reset.

**Vive en:** lib/auth-session.ts · tests/reset-workspace.test.ts · app/api/datos-mau/route.ts ·
app/_components/PanelAgencia.tsx · *2026-08-16 ~cliente-diseno*

### ⚠️ Un `transition` sobre una custom property no se ve, y por eso el cambio de tema salta

**Síntoma:** se prende un tema candidato en `/admin/ui?tab=temas` y el cambio de color
tenía que ser gradual (400 ms, como el de nordtheme.com). Con la transición declarada en
`:root` sobre `--bg`, `--surface` y compañía, el cambio es **instantáneo**. No hay error:
simplemente salta.

**Causa:** una custom property no pinta nada por sí misma. Lo que se ve es el
`background-color` de CADA elemento que la consume, y ese es el que hay que animar. Una
transición sobre la variable anima un valor que nadie mira.

**Regla:** la transición va en los **elementos**, no en la variable:

```css
[data-tema-candidato] *,
[data-tema-candidato] *::before,
[data-tema-candidato] *::after {
  transition: background-color 400ms ease-in-out, border-color 400ms ease-in-out,
              color 400ms ease-in-out, fill 400ms ease-in-out, stroke 400ms ease-in-out;
}
```

Es exactamente lo que hace el sitio de Nord —lo declara componente por componente— y se
verificó leyendo el CSS que sirve. **Cómo se comprueba sin ojímetro:** clickear, esperar
200 ms y leer `getComputedStyle(...).backgroundColor`. Si devuelve un valor **intermedio**
(medido: `rgb(160,165,175)` entre `#3B4252` y `#ECEFF4`), la transición corre. Si devuelve
uno de los dos extremos, saltó.

**Vive en:** app/globals.css (bloque «Temas candidatos») · app/_components/TemaCandidato.tsx ·
*2026-08-16 ~tab-temas*

### ⚠️ Un preview global que se apaga a medias deja la app de un color que nadie eligió

**Síntoma:** se sale del preview de temas y la app queda en **modo oscuro** (`--bg`
`#22262E`), sin tema candidato y sin ningún control a la vista para volver.

**Causa:** el preview maneja DOS atributos en `<html>` —`data-tema-candidato` para el tema
y `data-tema` para el modo— y al limpiar solo se sacaba el primero. La rama estaba escrita
`else if (id) raiz.removeAttribute('data-tema')`, o sea que **con `id === null` no corría
ninguna de las dos ramas**.

**Regla, y vale para cualquier modo de prueba global:** el que prende dos cosas apaga dos
cosas, y el apagado se prueba explícitamente — no alcanza con ver que prender funciona. El
test de aceptación es que después de salir, los tokens vuelvan a los valores de fábrica
(`#F4F6F9` / `#8F6709`), no simplemente que «se vea normal».

**Y el corolario que ya está aplicado:** mientras el preview está puesto, un chip fijo lo
dice y ofrece la salida desde **cualquier** pantalla. Si el único lugar donde se apaga
fuera la tab que lo prende, quien se lo olvide puesto ve la app de otro color en todas las
pantallas sin saber por qué — la misma regla de AGENTS.md sobre la salida que vive adentro
de una pantalla condicional.

**Vive en:** app/_components/TemaCandidato.tsx · *2026-08-16 ~tab-temas*

### ⚠️ `.mk-scroll-x` recorta en los DOS ejes: ningún popover `absolute` puede vivir adentro

**Síntoma:** en /ads-writer, tab «Guiones», tocás «Filtrar» y no aparece nada (a lo sumo
asoma una scrollbar vertical en la barra). Los filtros de ángulo, avatar y fecha quedan
inalcanzables para todo usuario, en cualquier ancho.

**Causa:** `.mk-scroll-x` declara solo `overflow-x: auto` y deja `overflow-y` en `visible`;
por spec, si un eje es `auto` el otro `visible` computa a `auto`, así que la caja clipea en
los dos. Medido en navegador real: `getComputedStyle(scroller).overflowY === 'auto'`,
`clientHeight=41px` contra `scrollHeight=308px`, y el popover (`top: calc(100% + 6px)`)
arranca 1px debajo del content box: cero píxeles visibles. El `zIndex` no salva nada — el
clipping de overflow no se saltea con z-index. `overflow-x: clip` sí preservaría
`overflow-y: visible`, pero mata el scroll táctil, que es para lo que existe la clase.

**Regla:** cualquier menú dentro de `.mk-scroll-x` (incluido el slot `filtros` de
`PageHeader`) va en portal `fixed` posicionado por `getBoundingClientRect()` — que es
exactamente lo que hace `app/components/Dropdown.tsx` y por lo que existe.

**Vive en:** app/_ui/ui.css:445-449 (`.mk-scroll-x`) · app/ads-writer/GuionesGlobal.tsx:156,348-352 · patrón correcto en app/components/Dropdown.tsx:114-133 · *2026-08-06 ~review-adversarial-content-machine*

### ⚠️ El placeholder del Dropdown no es una opción: por eso no se puede des-asignar nada

**Síntoma:** en /admin no había manera de dejar a un usuario sin workspace. En el picker de
plantilla de WhatsApp, una vez elegida una plantilla ya no había forma de volver a «sin
plantilla», solo cambiar a otra. Mismo bug, dos pantallas.

**Causa:** el diagnóstico obvio («el backend no soporta null») era el equivocado —
`actualizarUsuario` acepta `workspace_id: null` y la columna es nullable a propósito (mig
0054). La causa real es el `Dropdown` propio: solo emite valores presentes en `options`, y
el `placeholder` es **texto del botón** cuando `value` no matchea, NUNCA un ítem
clickeable. Al migrar un `<select>` nativo que tenía `<option value="">Elegí…</option>`,
esa opción de limpiar se pierde en silencio. Y aunque llegara vacío, `Number('') === 0`
pasa el chequeo `typeof body.workspace_id === 'number'` del route y escribiría workspace 0.

**Regla:** si un campo admite «vacío», va como opción explícita `{ value: '', label: '…' }`
y el onChange manda `v ? Number(v) : null`.

**Vive en:** app/components/Dropdown.tsx:112,121 · app/admin/AdminView.tsx:429-435 · app/api/admin/usuarios/route.ts:121 · app/whatsapp/WhatsAppApp.tsx (picker de plantilla) · *2026-07-02 map-admin-clientes + 2026-07-13 ~review-commits-funnel-dropdowns*

### ⚠️ Un ícono que no existe no rompe: pinta un puntito gris o un cuadrado de color

**Síntoma (a):** un nombre mal escrito en `<Icon name>` se ve como un círculo de 3px y
nadie se entera. **Síntoma (b):** en el onboarding del Chat Agent, el ícono de WhatsApp era
un cuadrado verde liso.

**Causa:** `Icon` resuelve `PATHS[name] ?? PATHS.dot`, sin error ni warning. Para (b) la
hipótesis natural era el gradiente o el CSS, y era falsa: el símbolo usa `fill="#fff"`
plano. Lo que pasaba es que nadie montaba `<BrandDefs />` en ese árbol, así que el
`<symbol id="ic-whatsapp">` no existía en el documento, el `<use href="#ic-whatsapp">` de
`SvcIcon` no resolvía a nada, y lo único pintado era el `<span>` contenedor con background
`#25D366`. El mecanismo no es «gradiente ausente → color plano», es **«símbolo ausente → no
se dibuja NADA y se ve el fondo del tile»**. Falla 100% silenciosa: sin error de tipos, sin
warning de React, sin consola.

**Regla:** el componente que consume íconos de marca monta sus propios defs en vez de
esperar que lo haga el llamador (montarlo dos veces no rompe: el `<use>` toma el primero);
`PanelMarketing.tsx` ya lo hace. Hoy montan `BrandDefs` /integraciones, /onboarding y el
board del plan; **Configuraciones NO**. Detalle de contrato: `Icon` no acepta `color`,
`className` ni `style` — el color se hereda, hay que envolverlo en un `<span style={{color}}>`.

**Vive en:** app/_components/icons.tsx:209 · app/_components/ServicioVisual.tsx (BrandDefs + SvcIcon) · app/_components/PanelMarketing.tsx · *2026-08-01 mako-onboarding-copy-y-bugs + 2026-08-06 rediseno-notificaciones*

### ⚠️ El preflight de Tailwind hace `display:block` a todo `<svg>`: un ícono NO se centra con `textAlign: 'center'`

**Síntoma:** en el dropzone de /video-generator el ícono salía pegado a la izquierda mientras
los dos textos de abajo salían centrados. El dueño lo vio. El div tenía `textAlign: 'center'`
y todo lo demás adentro se centraba bien.

**Causa:** `node_modules/tailwindcss/preflight.css` (línea ~209) declara
`img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle }`.
`text-align` alinea el contenido **inline** de una caja; a una caja de **bloque** no la mueve.
`<Icon>` (app/_components/icons.tsx:281) y `GuardianIcon` no declaran `display` — heredan el
`block` del preflight — y `MakoLogo` pone `display:'block'` explícito. Los tres son bloques.

**El diagnóstico obvio era el equivocado:** «el padre ya está centrado, algo le pisa el estilo
al ícono». No lo pisa nada: el ícono nunca estuvo en el juego del `text-align`.

**Lo que NO es el bug** (barrido de 226 usos de `<Icon>`/`<svg>` contra 244 `textAlign:'center'`
en `app/`): un ícono adentro de un `display:'inline-flex'` **sí** queda centrado, porque el que
se alinea es el span inline-flex, no el svg — es el envoltorio que usa medio repo. Igual de sanos
un `display:flex` con `justifyContent:'center'`, un `flexDirection:'column'` con
`alignItems:'center'`, un `margin:'0 auto'` y la clase `.mk-state` (app/_ui/ui.css:341, la que
usan EmptyState/NoResults/ErrorState). Eso son 44 de los 55 candidatos: falsa alarma.

**El patrón roto real es siempre el mismo:** un ícono de bloque **solo, arriba de textos**, dentro
de una caja que se centra con `text-align`. Aparece en dos formas repetidas: la tarjeta de estado
vacío (`{...card, padding:40, textAlign:'center'}` con `<MakoLogo size={54}/>` arriba del título)
y la pantalla «MaKo está pensando…» de los modales del Perro (`<GuardianIcon/>` arriba del texto).
Once sitios en ocho archivos, todos copiados del mismo molde.

**Regla:** un ícono se centra envolviéndolo, nunca con el `textAlign` del padre:
`<div style={{ display: 'flex', justifyContent: 'center' }}><Icon .../></div>`.

**NO se arregla en `Icon`.** Ponerle `display:'inline-block'` al svg de `icons.tsx` arregla estos
once y le cambia el flujo a los ~215 usos restantes: reaparece el hueco de baseline de los inline
y se corren las filas flex que hoy funcionan. El riesgo es mucho más grande que el bug — se arregla
en el call-site.

**Vive en:** app/_components/icons.tsx:281 · app/plan/board/GuardianIcon.tsx ·
app/_components/MakoBrand.tsx:101 · arreglados: video-generator/CargarGuiones.tsx:224,
carousels/CarouselsApp.tsx:234, stories/StoriesApp.tsx:168, landing-analyst/LandingAnalystApp.tsx:368,
landing-generator/LandingWriterApp.tsx:234, plan/board/CrearProyecto.tsx:65+67,
plan/board/MakoProyecto.tsx:51+53, plan/board/EliminarModal.tsx:97+182,
plan/board/CrearTareaModal.tsx:74 · *2026-08-28 auditoría svg-block*

### ⚠️ El dorado de MaKo no admite texto blanco

Blanco sobre el gradiente `#F2A516 → #E0870A` da **2,06:1 y 2,75:1** — no llega ni al piso
de 3:1, y los labels son de 10,5-14 px (uppercase/bold), o sea texto chico que necesita
4,5:1. Verificado recalculando la luminancia. El resto del documento ya usa la solución
correcta (ámbar oscuro sobre dorado claro: `#C77E08` sobre `#FBEBCB`, `#9A6207` sobre
`#FEF6E4`), así que los badges blancos son el outlier. Oscurecer el gradiente **no
alcanza** (el extremo claro queda en ~3,3:1): la salida que pasa AA es texto casi negro
ámbar (`#3A2604`, ~5,2:1 y ~7:1) manteniendo el dorado brillante.

**Vive en:** app/vsl/estrategia/Estrategia.tsx (.s-tier-ribbon, .s-diff-seg-3, .s-ch-lever .s-ch-id, .s-rung-1 .s-rung-n) · *2026-07-19 ~revision-landing-estrategia-vsl*

### ⚠️ El gris de de-énfasis de una barra no es `--border-strong`: da 1,23:1 y es invisible

**Síntoma:** en un gráfico de barras se ve la barra destacada y nada más. Las otras no se
leen flojo — no están. Como el valor va en texto al lado, la pantalla igual «dice» los
números y el gráfico parece correcto; lo que falta es la comparación, que es para lo que
existe el gráfico.

**Causa:** el gris recesivo era `--border-strong` (#DCE0E7) y el carril de fondo es
`--surface-2` (#F5F7FA). Son dos grises clarísimos a un escalón uno del otro: **1,23:1**.
`--border-strong` es el token de una **línea de 1px sobre el fondo del lienzo**, no el de
un área de 22-26px sobre una superficie que ya es gris. Con `--faint` (#98A0AC) da
**2,46:1**. Medido, no razonado — el validador del método:
`scripts/validate_palette.js "#1E9E57,#98A0AC" --mode light --surface "#F5F7FA"`.

**Los dos siguen abajo de 3:1**, así que el valor TIENE que estar en texto al lado, que es
la regla que el repo ya tiene («el color nunca es el único portador»). 2,46:1 no vuelve
legible la barra sola: la vuelve **visible como masa**, que es exactamente lo que se le
pide a un elemento recesivo. En oscuro el par es `--border-strong` #4A5160 → **1,46:1** y
`--faint` #7C8492 → **3,08:1**, o sea que ahí sí pasa el piso.

**Y el que aparece al arreglarlo: el acento se puede volver MENOS visible que lo
recesivo.** `tono="mako"` pinta la barra destacada con `--mako` (#F2B01E), que contra el
carril da **1,78:1**. Con el gris recesivo en 1,23:1 la jerarquía se sostenía de casualidad;
subirlo a 2,46:1 la **invierte** — las barras que no importan se ven más que la que sí. La
salida ya existe y es un token: `--mako-ink` (#8F6709) da **4,76:1**, y en oscuro
`--mako-ink` ya apunta al dorado brillante (#F2B01E, 6,08:1), así que sirve en los dos
temas sin un cuarto dorado. Los otros tres tonos ya pasaban: `bad` 3,97 · `good` 3,22 ·
`info` 4,24 en claro.

**La regla que queda:** un color de de-énfasis se **mide contra el fondo sobre el que se
apoya**, no contra el lienzo; y cada vez que se toca el gris recesivo hay que volver a
mirar el acento, porque lo que importa es la DISTANCIA entre los dos.

**Verificado en el navegador** sobre las cinco partes a la vez (`?tab=analisis`, con
`PARTES_VISIBLES` abierto a mano): 29 barras en 9 gráficos, 21 recesivas a 2,46:1, cero a
1,23:1, y las 29 filas con su valor en texto.

**Vive en:** app/admin/dev/pricing/Piezas.tsx → `Barras` (el gris y el acento) y `Riel`
(el de `DosMonedas`, que ya nacía con `--faint`) · tokens en app/globals.css ·
*2026-08-10 ~pricing-dos-monedas*

### ⚠️ «La barra de admin no se parece a la del producto» no era un problema de estilos: eran dos JSX

**Síntoma:** la sidebar del super admin no tenía secciones desplegables y se veía distinta de la de
cualquier workspace, por más que compartieran tokens, colores y clases.

**Causa:** el `Sidebar` tenía **dos ramas**. El shell de producto pintaba `<Familia>` —con su
chevron, su caja y su rail—, y el de admin tenía su propio bloque de JSX: un `<div>` con el título
de la sección y una lista de `<NavLink>` abajo. Compartían el archivo y hasta la función de estilo
de fila, así que parecía el mismo componente. No lo era.

**Regla:** **si dos cosas tienen que verse igual, tienen que ser el mismo componente.** Mientras
sean dos ramas de JSX vuelven a divergir a la tercera edición, y el síntoma aparece meses después
como «esto no quedó igual». La forma de arreglarlo no fue estilar la rama de admin: fue borrarla y
convertir sus secciones en `NavFamilia`, de modo que hereden gratis lo que se le agregue a la barra
después.

Corolario del mismo caso: **un `key` de tipo unión hay que ensancharlo antes de agregar variantes**
(`NavFamilia['key']` era `'operate' | 'analyze' | 'create' | 'content'`). El compilador te avisa —es
lo bueno de tenerlo tipado— pero solo si las secciones nuevas son del mismo tipo que las viejas.

**Vive en:** app/_components/Sidebar.tsx · app/_components/nav.ts (`ADMIN_FAMILIAS`) · *2026-08-08 rediseño de la barra de super admin*

### ⚠️ Una tab que «redirige a otra» puede ser la única puerta a una feature

**Síntoma:** un item «MaKo» en la barra de super admin que, al tocarlo, te dejaba en Clientes. Se
lee como un link roto y da ganas de borrarlo.

**Causa, doble:** apuntaba a `/admin?tab=copy`, y ese `?tab=` lo lee un `useEffect` **de montaje**.
Estando ya en `/admin`, la navegación del cliente no remonta nada, así que el efecto no vuelve a
correr y te quedás en la tab que estabas. Solo funcionaba entrando de cero. Y detrás de ese
parámetro vivía una pantalla entera —el cerebro de copywriting de MaKo— que **no tenía ningún otro
acceso**: el tab bar de `/admin` solo mostraba Clientes y Super Admins.

**Regla:** antes de borrar una tab «que no hace nada», seguí a dónde apunta. Un deep-link por query
string no es una puerta: es un atajo que depende de cómo llegaste. Si una pantalla solo se alcanza
así, no está enlazada — está escondida, y el día que alguien limpie el nav desaparece sin que nada
lo note.

**Vive en:** app/admin/AdminView.tsx (`TabCopywriting`, el `useEffect` del `?tab=`) · *2026-08-08*

### ⚠️ El «Semáforo» eran DOS tipos incompatibles, y por eso no lo encontraba nadie

**Síntoma:** ninguno. Ése es el punto. Todo compilaba, nada rompía, y en algún lado se
pintaba un color que no correspondía.

**Causa:** el mismo concepto estaba declarado dos veces, con dos vocabularios:
`Semaforo` (`lib/meta-health-ui.ts`) decía `rojo | ambar | verde | gris`, y
`SemaforoAviso` (`lib/avisos-catalogo.ts`) decía `rojo | amarillo | verde | na`. **No
coincidían en dos de los cuatro valores.** Un `switch` sobre el tipo equivocado es código
perfectamente válido: TypeScript no puede saber que quisiste decir el otro, así que cae al
`default` y pinta gris donde iba ámbar. 158 usos en 22 archivos.

**Regla:** un concepto con nombre propio se declara UNA vez, y si ya está duplicado, el
que sobrevive es el del consumidor más grande. Los valores viejos no se renombran de una:
siguen escritos en los DATOS (las ~48 filas de `CATALOGO_AVISOS`), así que la salida es una
función que acepta las dos escrituras (`normalizarSemaforo`) y una migración aparte para
las filas. Renombrar el tipo y dejar los datos viejos es cambiar un bug silencioso por otro.

Corolario que vale para cualquier color de estado: `colorDeSemaforo`/`bgDeSemaforo` ahora
derivan de la paleta de tonos (`TONO`), no de una lista de `var(--…)` escrita al lado. Es
lo único que impide que el ámbar del semáforo y el warning de un botón vuelvan a separarse.

**Vive en:** lib/mako-gramatica.ts · lib/meta-health-ui.ts · lib/avisos-catalogo.ts · *2026-08-08 rediseño Parte 3*

### ⚠️ Un estado azul en una lista de estados dorados rompe la regla de color justo donde más se mira

**Síntoma:** «MaKo está ejecutando» se veía distinto de los otros ocho estados y nada
explicaba por qué.

**Causa:** al elegir el tono de cada estado, «está pasando algo» tienta a usar el azul de
acción. Pero en la regla de la casa **azul es «VOS actuás» y dorado es «intervino MaKo»** —
y ejecutar es MaKo actuando. Leído de a un estado por vez, el azul parecía razonable; el
error solo apareció **con los nueve renderizados uno debajo del otro**, que es la única
vista donde se ve que ocho comparten significado y uno no.

**Regla:** un sistema de estados no se revisa de a un estado. El catálogo vivo
(`/admin/ui`) no está para documentar: está para poder mirarlos juntos, que es donde
aparecen estas cosas. Si vas a agregar una familia de piezas, renderizala entera antes de
darla por buena.

**Vive en:** lib/mako-gramatica.ts (`GRAMATICA.ejecuta`) · app/admin/ui/Gramatica.tsx · *2026-08-08 rediseño Parte 3*

### Una guarda que grita en falso deja de ser una guarda

`<Mako>` avisa por consola, en desarrollo, cuando a un estado le faltan los campos que el
documento le exige. La primera versión también avisaba en la variante **compacta** — que
por diseño no muestra esos campos. Resultado: nueve advertencias imposibles de resolver en
la pantalla del catálogo, y en una tabla de 40 filas habrían sido 40.

El chip es una **referencia** a un estado («esta fila está en aprobación»), no su
presentación; las obligaciones las debe el lugar donde el estado se muestra entero. La
lección no es sobre este componente: **una guarda con falsos positivos se ignora a la
semana**, y a partir de ahí tampoco avisa de los verdaderos. Antes de agregar un aviso
automático, hay que saber en qué casos NO corresponde.

**Vive en:** app/_ui/Mako.tsx (`useAvisoDeDesarrollo`, `REQUIERE`) · *2026-08-08 rediseño Parte 3*

### ⚠️ «Campos obligatorios» no quiere decir «campos siempre visibles» — y confundirlo cuesta tres rediseños

**Síntoma:** el dueño rechazó la misma pantalla **tres veces seguidas** con las mismas
palabras («está cargado», «muy fea», «no es intuitivo»). Las tres rondas de arreglos
tocaron cómo se veían los elementos y ninguna preguntó **por qué estaban ahí**. Medido:
de 25 elementos de texto se bajó a 21, y dos de las tres tarjetas no se movieron.

**Causa:** el catálogo declara `exige: ['el impacto esperado', 'el esfuerzo', …]` para que
una recomendación no sea un consejo genérico. Eso se leyó como **instrucción de layout**,
así que la tarjeta se dibujaba como un formulario —etiqueta gris, valor, etiqueta gris,
valor— y encima con un `<details>` cuyo `summary` era el **índice de las etiquetas que
había adentro** («Esfuerzo · Responsable · Objetivo · Se revisa»). Se le sacaban filas al
formulario y seguía siendo un formulario.

El agravante, que lo vuelve un defecto y no una cuestión de gusto: **lo que quedaba a la
vista se elegía por POSICIÓN** (`const [primero, ...resto] = datos`). En la aprobación eso
dejaba arriba «A quiénes: 340 contactos» y escondía «Qué reciben» detrás de un click,
mientras el botón que manda los 340 mensajes irreversibles estaba siempre visible. **Se
podía aprobar un envío sin haber visto nunca qué se enviaba.**

**Regla:** un contrato de datos dice qué tiene que TENER una pieza, nunca qué tiene que
MOSTRAR de entrada. El corte entre el primer y el segundo nivel se define por **frecuencia
de uso**, y lo que queda arriba se elige a mano, nunca por el índice de un array — elegir
por posición no es elegir.

**Vive en:** app/_ui/Mako.tsx (`Decision`, props `consecuencia` y `advertencia`) ·
lib/mako-gramatica.ts (`exige`) · *2026-08-09 rediseño de las filas de decisión*

### ⚠️ El rótulo en monospace arriba del título es un «kicker», y está prohibido

**Síntoma:** cada tarjeta de MaKo abría con una palabra chiquita en monospace («Qué
conviene hacer», «Falta un dato») arriba del título. Se defendía como «el estado se tiene
que llamar igual en las cuatro tabs».

**Causa:** es el patrón que la guía de oficio que usamos lista entre lo que **no se
negocia**: *«A kicker or eyebrow above a heading. This one is a ban, not a default: no
brief earns it back. The heading carries its own weight»*. Y en la misma lista: *«Monospace
as a costume for "technical" rather than for code, data, or measurement»*. Encima era
redundante en los tres casos — el rótulo decía «Falta un dato» y el campo de abajo se
llamaba «Falta».

De la misma fuente salió el otro diagnóstico: *«Same-size cards of icon plus heading plus
text as the page structure. **Cards are the lazy container**»*. Tres tarjetas iguales
apiladas era, literalmente, lo que teníamos.

**Regla:** el rótulo del estado sigue viviendo en `GRAMATICA` —el contrato de que se llame
igual en todos lados no se toca— pero **se pinta donde aporta**: en el chip, en una columna
de tabla, y adentro del panel abierto. Arriba del título, no. Y un grupo de cosas del mismo
tipo es una **lista con filete**, no una pila de cajas.

**Vive en:** app/_ui/Mako.tsx (`Decision`) · app/_ui/ui.css (`.mk-dec`) ·
app/admin/ui/Gramatica.tsx · *2026-08-09*

### ⚠️ El punto de color de `<Mako>` nunca se dibujó: medía 0×0, y tres rondas lo ajustaron igual

**Síntoma:** en los estados que no son de tono dorado, la marca de la izquierda era un
hueco. Nadie lo notó porque un espacio vacío de 16 px no se lee como un error.

**Causa:** `<span className="mk-dot">` solo tiene tamaño por la regla
`.mk-status .mk-dot { width:7px; height:7px }` — **descendiente de `.mk-status`**, una clase
que dentro de `<Mako>` no existe. Fuera de `Status` el span medía 0×0.

Lo que hace que valga escribirlo: en `ui.css` había **quince renglones de comentario**
explicando cómo se alinean «una estrella de 14 px y un punto de 7 px» para que las nueve
pastillas tengan la misma geometría, y se hicieron **tres rondas de ajuste fino de
centrado** sobre esa premisa. Todo eso era razonamiento sobre un elemento que no se
dibujaba.

**Regla:** un selector descendiente (`.a .b`) es un contrato con el ancestro. Si la pieza
`.b` se va a usar fuera de `.a`, su tamaño no puede depender de `.a` — y si un comentario
describe una geometría, la geometría hay que **medirla** una vez, no deducirla.

**Vive en:** app/_ui/ui.css (`.mk-mako__marca .mk-dot`) · app/_ui/Mako.tsx (`marca`) ·
*2026-08-09*

### ⚠️ Cinco «piezas» eran una pieza con cuatro juegos de números

**Síntoma:** rediseñada la fila de decisión, el dueño marcó que las otras cuatro secciones
seguían feas. Y no era que faltara aplicarles el mismo estilo: era que **no tenían por qué
existir por separado**.

Convivían cinco tratamientos para lo que MaKo pone en pantalla: una fila para las decisiones,
una línea con una barra suelta para el trabajo en curso, una tarjeta con caja para los avisos,
una caja crema para la sugerencia pegada a un campo, y una pastilla aparte para la tabla.

**Causa:** los cuatro primeros **ya tenían la misma anatomía** —marca de 16 px, columna de
texto que se estira, riel derecho— y se diferenciaban sólo en tres cosas: el relleno, el
separador y qué iba en el riel. Cada uno se escribió en una sesión distinta resolviendo su
caso, y ninguno miró al de al lado.

**Lo que quedó — dos piezas:**

| Antes | Ahora |
|---|---|
| `.mk-dec` (decisión) · `.mk-mako--curso` · `.mk-mako` (tarjeta de aviso) | **`.mk-fila`**, con el modal como su segunda capa |
| `.mk-dec__pill` · `.mk-mako--chip` | **`.mk-pill`**, con un modificador para la marca |
| `.mk-mako--inline` | `.mk-inline` — el único que no vive en una lista, y por eso el único con otro separador |

Lo único que cambia entre los tres usos de la fila es qué va en el riel y si hay chevron:
decisión → cuándo, abre · en curso → el porcentaje, no abre · aviso → importancia y cuándo,
abre. Y **el rótulo es siempre la píldora al final del título**: antes el aviso lo pintaba como
kicker arriba, el curso en gris antes del título, y la decisión como píldora — tres
tratamientos para el mismo dato.

**Regla:** antes de estilar una pieza «parecida» a otra, poné las dos anatomías una al lado de
la otra. Si comparten el esqueleto y difieren en tres números, no son dos piezas: es una con
dos configuraciones, y mantenerlas separadas garantiza que diverjan.

**Vive en:** app/_ui/Mako.tsx (`Fila`, `Pill`) · app/_ui/ui.css · *2026-08-09*

### ⚠️ Una barra de progreso suelta al lado del texto no la usa nadie

**Síntoma:** la fila de «está pasando algo» medía 1134 px y usaba ~500: el texto a la izquierda
y una barra de 220 px flotando al lado, con el resto vacío.

**Causa:** se trató la barra como un elemento más de la fila. Medido sobre el DOM real de tres
productos, ninguno hace eso:

- **GitHub Actions** no dibuja **ninguna** barra, ni en la lista ni en el detalle del run. Un
  anillo de 16 px girando a la izquierda, y en el riel derecho el texto ocupa **el mismo slot
  que la duración** cuando termina — el estado no se suma, reemplaza.
- **Uppy** pone la barra como un elemento absoluto de **2 px pegado al borde de la fila**, a
  ancho completo: no ocupa altura de layout, no tiene track visible, **es** el borde. Lo único
  que cambia es su `width`.
- **Vercel Geist** lo dice textual: *«the bar alone doesn't say what's progressing»*, y el paso
  va al lado, unido con punto medio: `Step 2 of 4 · Building`. Y nunca un porcentaje pelado.

**Regla:** dentro de una lista, la barra es el borde de la fila o no existe. Una barra con
ancho propio adentro de una fila ancha reintroduce el mismo hueco muerto de siempre. Y el
porcentaje va en el riel derecho, con la fuente y el avance en la segunda línea.

**Vive en:** app/_ui/ui.css (`.mk-fila__barra`) · app/_ui/Mako.tsx · *2026-08-09*

### ⚠️ Un `max-width` adentro de una caja ancha no acota: deja la mitad vacía

**Síntoma:** el dueño lo describió como tres cosas distintas —«textos que se cortan al medio
de la card», «cards que llegan al final del ancho y la info se queda aplastada a la
izquierda», «textos desordenados, sueltos, volando»— y era **un solo defecto**.

**Medido:** el contenido ocupaba **603 px dentro de una caja de 1134**. El 47% de la tarjeta
vacío a la derecha. Lo causaban cuatro topes puestos con buena intención: `max-width: 620px`
en la rejilla de campos, `70ch` en los párrafos y en la evidencia, y un `maxWidth: 460` suelto
en una sección del catálogo. Cada uno se agregó para «que no se lea como una tabla», y el
comentario que lo justificaba decía «acotada, la tarjeta vuelve a leerse como una tarjeta».

**La regla, que ya estaba escrita en AGENTS.md y se violó igual:** «un maxWidth pegado a la
izquierda es lo que deja la franja muerta».

**Lo que hay que hacer en su lugar** —verificado en el código fuente de tres sistemas:

- **El único ancho máximo vive en el CONTENEDOR.** En shadcn/Radix el único `max-width` está
  en `DialogContent` y adentro no hay ninguno: todos los hijos van al 100%. En Notion el
  `max-width` de la página se APAGA al entrar al peek.
- **Si hay que acotar la medida de lectura, se acota con `margin-inline: auto`** —el sobrante
  se reparte a los dos lados— o con un padding PORCENTUAL, que es lo que hace Carbon
  (`padding-inline-end: calc(20% - 32px)` en los párrafos, y **solo** en los párrafos: «anything
  besides text/p spans full width»). Un porcentaje se achica solo cuando se achica la caja; un
  `max-width` en px, no.
- Y Linear cuenta en su changelog que tuvo este mismo problema y lo resolvió **centrando** el
  contenido cuando la ventana crece, no dejando el hueco de un lado.

Por eso el detalle de una decisión se mudó a un modal de 600 px: ahí el texto llena su renglón
por construcción, sin que nadie le ponga un tope.

**Vive en:** app/_ui/Modal.tsx · app/_ui/ui.css (`.mk-modal`, `.mk-det__*`) · *2026-08-09*

### ⚠️ La barra de progreso pintaba 1% cuando el dato decía 62%

**Síntoma:** las dos líneas de «está pasando algo» mostraban una barra visualmente vacía. Se le
ajustó el ancho **tres veces** —incluido un `flex: 0 0 220px` con su propio comentario
explicando por qué `maxWidth` no servía— y ninguna miró el número.

**Causa:** desajuste de unidades entre dos contratos que nadie cruzó. `MakoProps.progreso` está
declarado **de 0 a 1**; `Progress.value` está declarado **de 0 a 100**. Con `0.62` la barra
renderizaba `width: 1%`, y con `0.33`, `0%`. El `aria-valuenow` mentía igual.

**Regla:** cuando un valor cruza de un componente a otro, el rango es parte del tipo y
TypeScript no lo ve — los dos son `number`. Si dos APIs vecinas usan escalas distintas para lo
mismo, la conversión va explícita y comentada en el punto de cruce, o se unifica la escala.
El corolario que duele: **si algo se ve mal y ya lo ajustaste tres veces, el problema no es el
estilo — es el dato.**

**Vive en:** app/_ui/Mako.tsx (rama `curso`) · app/_ui/Feedback.tsx (`Progress`) · *2026-08-09*

### ⚠️ Una página que NO hidrata se ve perfecta, y `<details>` te tapa que no hidrata

**Síntoma:** el rediseño de las filas de decisión se «verificó» con Playwright durante toda una
ronda —abrían con clic, abrían con Enter, el caret rotaba, el foco se veía— y al cambiar el
`<details>` por un modal de React **nada respondía al clic**.

**Causa:** el árbol de la app nunca hidrataba. Lo que hacía funcionar la versión anterior era
que `<details>`/`<summary>` **abre y cierra sin una línea de JavaScript**: es comportamiento
nativo del navegador. Toda la evidencia de que «funciona» era evidencia de que el HTML estaba
bien, no de que React estuviera vivo.

**Cómo se detecta, en una línea.** Un nodo hidratado tiene claves de fiber; uno sin hidratar no:

```js
Object.keys(document.querySelector('.mi-clase')).filter(k => k.startsWith('__react'))
// [] → no hidrató. Los onClick no existen.
```

Ojo con el falso positivo: el overlay de desarrollo de Next (`<nextjs-portal>`) **sí** tiene
fiber aunque la app no hidrate, así que preguntar «¿hay React en la página?» da que sí. Hay que
preguntarlo sobre **un nodo de la app**.

**Qué lo causaba, acotado a fuerza de descartar:** **`next dev` no hidrata en este proyecto;
`next build` + `next start` sí.** El camino hasta ahí, porque cada paso descarta una hipótesis
que parecía obvia:

| Se probó | Resultado |
|---|---|
| El dev server de la otra sesión | ❌ no hidrata |
| Un worktree limpio, `npm ci` propio, dev server propio | ❌ tampoco |
| `/inicio`, `/plan`, `/vsl` — páginas que nadie tocó | ❌ tampoco |
| Producción (`hola-mako.com`) | ✅ `__reactFiber$`, `__reactProps$` |
| **Build de producción LOCAL (`next start`)** | ✅ **hidrata y el clic funciona** |

O sea: no era el código, no era la otra sesión, no era el entorno de la máquina. Es el modo
desarrollo. Ni una petición fallaba, ni un error en consola, ni nada en el overlay de Next: la
página se servía entera y muda. El único síntoma lateral era el WebSocket de HMR caído
(`ERR_INVALID_HTTP_RESPONSE`), que el matcher de `proxy.ts` explica —no excluye
`_next/webpack-hmr`, así que el upgrade pasa por el gate de auth— pero excluirlo **no** devolvió
la hidratación, así que no es la causa raíz.

**Cómo verificar una interacción mientras esto siga así**, que es lo único accionable:

```bash
npx next build && npx next start -p 3215
```

Y para entrar, `/api/auth/dev-login` **no sirve**: devuelve 404 en producción a propósito. Se
firma una cookie con el mismo secret y se la inyecta en el navegador:

```ts
import { crearToken, SESSION_COOKIE } from '@/lib/auth-session';
crearToken({ sub: 'dev', email: 'dev@local', nombre: 'Dev (local)', rol: 'admin' })
// node --import tsx --env-file=.env.local … y ctx.addCookies([...])
```

**Regla:** verificar una interacción es verificar que **el handler de React corrió**, no que el
DOM cambió. Si lo que probás puede funcionar sin JavaScript —`<details>`, un `<a href>`, un
`<label for>`, un formulario nativo— la prueba no dice nada sobre tu código.

**Vive en:** cualquier verificación con navegador · `app/api/auth/dev-login/route.ts` ·
`proxy.ts` (el matcher) · *2026-08-09*

### ⚠️ `nota` y `placeholder` del catálogo de credenciales son texto muerto

`ServicioConfigForm` trae `nota` del API y la tipa (l.46) pero **no la pinta en ningún
lado**, y el `placeholder={sem.placeholder}` (l.488) no sale del catálogo: sale de
`semaforo()` (l.93), que devuelve 'Pendiente' / 'Opcional' / '••••1234'. O sea que «Con el
prefijo act_», «Token de usuario de sistema (no expira). Permisos: ads_read,
ads_management, business_management» y las demás notas de `metodo-catalogo.ts` NUNCA se ven
en la pantalla donde se pega la credencial: las pistas de formato solo existen si el
cliente abre el '?'. Costo real: el cliente pega el ad account sin `act_` y el guardado
falla. Es el mismo patrón que las features de la landing — un campo del catálogo que nadie
renderiza.

**Vive en:** app/integraciones/ServicioConfigForm.tsx (nota 46, semaforo 93, placeholder 488) · lib/metodo-catalogo.ts (nota/placeholder por servicio) · *2026-07-31 auditoria-tokens-meta*

### En un grid, el eje vertical también necesita `minmax(0,1fr)`

Ponerle alto fijo a un modal de dos columnas y `overflow:auto` a la columna que scrollea
**no alcanza**: si el grid no declara `grid-template-rows`, la fila implícita es `auto` con
`min-height:auto`, o sea que no deja que los hijos se achiquen por debajo de su contenido —
la fila crece, desborda el alto fijo y el `overflow:auto` no hace absolutamente nada. Hay
que agregar `grid-template-rows: minmax(0,1fr)` y `height:100%` en el grid (un hijo grid no
hereda el alto de un padre `display:block`). Es el mismo truco que ya está en el eje
horizontal de `.mk-svc-modal` y que todos olvidan replicar en el vertical. Ojo también con
el media query de apilado: al pasar a 1 columna se generan 2 filas implícitas y hay que
resetear el `grid-template-rows`.

**Vive en:** app/globals.css:205-208 (.mk-svc-modal) y :214-227 · app/integraciones/IntegracionesBoard.tsx:492-493 (ModalShell) · *2026-07-16 integraciones-modal-v2-investigar*

### `flex:none` + `width:100%` junto a un label `nowrap` desborda siempre

En una fila flex con gap, una barra con `flex:none` y `width:100%` inline se come todo el
ancho del contenedor y no puede encogerse; el label hermano tiene `white-space:nowrap`, así
que su min-content es el texto entero y tampoco encoge. Barra(100 %) + gap + label excede
la fila **siempre** — es independiente del ancho real de la card. Solo desbordaba el primer
paso del embudo (los de 50 % y 24 % dejaban lugar), y el `overflow-x:hidden` de la raíz lo
escondía cortando justo el número. Arreglo: la barra va dentro de un track `flex:1;
min-width:0` y el label `flex:none`, para que el `width:X%` se mida contra el espacio que
sobra.

**Vive en:** app/vsl/estrategia/Estrategia.tsx (.s-fbar-row / .s-fbar / .s-fbar-lbl) · *2026-07-19 ~revision-landing-estrategia-vsl*

### El placeholder animado no cuesta renders: cuesta el NOMBRE del control

La pregunta natural ante un placeholder que se escribe y se borra es «¿cuánto cuesta un
setState por letra?». Se midió en navegador real: escribir el atributo `placeholder` cuesta
**1,2 µs**, o sea nada. El diagnóstico obvio era el equivocado. El daño real es otro: el
algoritmo de nombre accesible cae al placeholder como ÚLTIMO recurso, así que un input sin
label toma su nombre del placeholder, y rotarlo cada 3 segundos le cambia el nombre al
control cada 3 segundos — rompe el control por voz (el usuario dice «hacé clic en X» y para
cuando termina la frase ya es otro) y JAWS/NVDA siguen anunciando el viejo.

**Regla:** animar el placeholder solo es aceptable si el input YA tiene un nombre accesible
fijo que no sea el placeholder (label real conectado por `htmlFor`, como documenta
`app/_ui/Field.tsx`). Dato empírico del mismo barrido: v0, Perplexity, Claude y Linear NO
rotan el placeholder — ponen la animación en el titular y los ejemplos como chips
clickeables.

**Vive en:** app/_ui/Field.tsx (el label conectado por id) · aplica a cualquier input nuevo de captura (/ideas) · *2026-08-07 ideas-content-machine*

### Un componente declarado DENTRO del render remonta todo el subárbol en cada tecla

**Síntoma:** un input dentro de una lista perdía el scroll y el foco con cada tecla, y las
61 opciones se volvían a montar enteras — parecía un problema de virtualización o de `key`.
**Causa:** el componente estaba declarado dentro del render del padre, así que React lo
trata como un TIPO nuevo en cada pasada y remonta el subárbol completo. **Solución:** una
función que devuelve el elemento, no un componente anidado.

**Vive en:** app/crm/SelectorHora.tsx · *2026-08-07 contexto-mako-md*

### `getComputedStyle` con la pane oculta devuelve valores viejos

Verificar por el style inline o por un `data-*`, nunca por el estilo computado de algo que
todavía no se mostró.

**Vive en:** UI general · *cosecha 08/2026*

### Regla: antes de inventar un componente, copiar el molde que ya existe

El dueño lo pidió una y otra vez, y siempre por el mismo motivo: lo reescrito a mano sale
peor y con features faltantes. Vale para el contenedor, el modal, el pop-up de detalle, el
filtro, la barra de búsqueda, el chat de clientes, el resumen del archivero y el botón azul
de subir.

- «debería ser EXACTAMENTE igual al contenedor que ya hicimos… Esa lógica ya la construiste
  en el detail, copiala tal cual» (2026-08-05)
- «NO debe ser un detalle diferente al de siempre, debe ser exactamente el mismo pop-up»
  (2026-06-23)
- «No construyas nada nuevo, replica todo… Cuando construyes un chat nuevo, hay muchas
  cosas que te saltas y omites» (2026-07-14)
- Al replicar una vista para otro rol o ruta: se copia la vista **completa**, no un
  resumen, ni se reconstruye la funcionalidad de nuevo. «Debería ser igual, y con el mismo
  diseño que está en super admin. Solo tienes que copiar lo mismo, no inventar nada nuevo»
  (2026-07-29)
- Al replicar una sección/vista/curso: **tal cual**, mismo orden, mismo copy, misma
  animación. «Tampoco los copy están exactamente iguales… Les agregaste cosas innecesarias»
  (2026-07-23)
- Si pasa una imagen de referencia, se copia hasta que sea igual, no se aproxima. «La llave
  sigue sin parecerse. Copiala bien» (2026-07-01)
- Y antes de construir de cero algo grande, buscar un open source que ya lo tenga y
  copiarle diseño y features: «podemos COPIAR código de proyectos open source como este:
  github.com/TryGhost/Ghost… Eso nos ahorrará muuucho trabajo» (2026-08-06)

**Vive en:** app/_ui (el catálogo vivo está en /admin/ui) · [app/_ui/LEEME.md](../app/_ui/LEEME.md)

### Regla: los desplegables son el `Dropdown` propio, con su comportamiento

Nada de `<select>` nativo ni de listas planas. El comportamiento pedido, junto:

- Diseño propio, no plano; se abre al pasar el cursor y se cierra solo al elegir una opción
  («trabaja en el diseño de todos los desplegables… Que esté así de plano es muy feo»,
  2026-06-22).
- Se abren **a la derecha**, no hacia abajo («Prefiero que todos los desplegables se abran
  a la derecha», 2026-07-01).
- Ninguno empuja la app hacia abajo ni se corta en la topbar: si no entra, **abre hacia
  arriba** («ningún desplegable debería comportarse de esa manera, en donde desplaza a toda
  la app hacia abajo» / «El desplegable se pone solo en la top bar y no se puede ver, omg,
  es básico eso», 2026-06-29).
- En listas de bloques desplegables, **el primero viene abierto y el resto plegados**
  (2026-07-30).

**Vive en:** app/components/Dropdown.tsx · *memoria [[dropdown-custom]]*

### Regla: filtros y ordenamiento tienen una sola forma

- Los filtros y las opciones múltiples van **siempre en un desplegable** (con capas si hace
  falta), a la derecha de la searchbar. Nunca botones acumulados uno al lado del otro,
  nunca filtros debajo. «los filtros deberían ser un desplegable, como siempre… como ya
  habíamos dicho antes» (2026-07-13).
- Si son muchos, se **agrupan** detrás de un solo botón, no se apilan en una lista con
  scroll: «hay que hacer un scroll muy grande para ir abajo del todo. Tienes que agruparlos
  en 4» (2026-07-26).
- El ordenamiento es el clásico de **dos clicks** (asc/desc) y va **antes** que el resto de
  los controles: «apretás una vez se ordena para atrás, apretás otra vez, se ordena para
  adelante. Más simple» (2026-07-26).
- Si él ya definió una forma de ver los filtros, se respeta tal cual: «Diseñé a propósito
  una forma de ver los filtros y lo hiciste como quisiste…» (2026-07-15).

**Vive en:** el slot `filtros` de `PageHeader` (ojo con `.mk-scroll-x`, ver arriba)

### Regla: editar es hacer click sobre el texto

Sin botón de editar, sin que cambie la disposición y sin que aparezca un recuadro
(«Prefiero que no exista el botón de editar… que no cambie en nada la disposición»,
2026-07-27). Cuando sí hace falta un botón, hay **uno solo por pantalla**: nada de un botón
de editar adentro de otro botón de editar («solo hay 1 botón de editar y es el mismo
siempre», 2026-07-04). Y una **preview es preview**: se ve linda y de solo lectura, nada
editable por default; si se puede editar, va un botón de editar/guardar **por caja** («NO
debería ser editable el texto», sobre avatares y razones, 2026-07-27).

---

## Modales y capas

### ⚠️ Un `zIndex` literal en una pieza que se apila queda debajo del backdrop

**Síntoma:** confirmás, la pantalla **no se mueve** y nada explica por qué. Ni error, ni
spinner, ni cartel.

**Causa:** el loader y el cartel final «Datos actualizados» tenían `zIndex: 100`
hardcodeado, y la pila de modales (`useCapaModal`) arranca en **130**. Estaban pintados,
debajo del backdrop. Dos síntomas idénticos, dos literales distintos, el mismo error.

**Regla:** una pieza que se monta apilada **no elige su z**: lo hereda de la capa
(`capa.z`), o se pinta **dentro** de la tarjeta con `position: absolute` sobre un
contenedor `relative` — así hereda el z que la capa ya le dio. Un número literal en un
overlay es una apuesta contra el orden de montaje. Del mismo arreglo: la cortina del loader
usa `var(--surface)` en una capa propia y no un `rgba(255,255,255,.78)` fijo, que en tema
oscuro era un flash blanco. **Ningún color fijo en un overlay.**

**Vive en:** app/_components/pila-modales.ts (`useCapaModal`) · app/_components/WizardShell.tsx

### El loader tiene que tapar también el header y el footer

Es donde están los botones que no hay que tocar: ✕, Atrás, Siguiente/Confirmar y el click
en el backdrop. Tapar solo el cuerpo deja la salida abierta a mitad de una escritura. El
dueño lo pidió más fuerte todavía: toda operación larga **bloquea** el cierre del modal, la
navegación y el refresh, con aviso — «NO debería dejarme cerrar ese modal ni hacer nada.
Incluso si me quiero salir de la tab o refrescar, impedírmelo con un aviso» (2026-07-30).

**Vive en:** app/_components/WizardShell.tsx

### Regla: el modal tiene largo fijo y scrollea por dentro — nunca crece

Jamás se agranda según el contenido ni según la tab, y jamás se sale de la pantalla:
aparece scroll adentro. Desplegar un bloque de contexto tampoco lo agranda.

- «jamás se debe agrandar el modal, debe aparecer un scroll… Se rompe y no se puede leer ni
  apretar el botón de siguiente» (2026-08-05)
- «está muy largo, se sale de la pantalla. Debería tener scroll, pero no salirse»
  (2026-07-15)

**Vive en:** app/_components/WizardShell.tsx · el `ModalShell` de app/integraciones/IntegracionesBoard.tsx:492-493

### Regla: nunca dos modales visibles a la vez, y cerrar devuelve al anterior

Hay un orden. El de abajo **se esconde** y vuelve al cerrarse el de arriba; cerrar el de
arriba **no cierra la pila entera**. Y un modal de trabajo se cierra solo por la ✕, no por
click afuera.

- «había otros atrás, es muy molesto ver 2 modales al mismo tiempo. Siempre tiene que haber
  un orden» (2026-07-19)
- «Te pedí explícitamente que los pop-up no se superpongan y sí lo hacen…» (2026-07-22)
- «no me debe cerrar todo, me debe volver al modal de todas las reuniones, eso como regla
  siempre, es experiencia de usuario» (2026-08-02)
- **Un solo pop-up por flujo:** nada de un modal que abre otro modal para completar el
  mismo paso. «Sigue saltando un pop-up previo donde hay que subir los creativos. No quiero
  que hayan 2 pop-up. Quiero que sea uno solo» (2026-06-30)

**Vive en:** app/_components/pila-modales.ts · *memoria [[pila-de-modales]], [[cerrar-vuelve-al-anterior]]*

### Regla: cerrar un modal no descarta el trabajo a medias

Al salir de un pop-up o de un flujo, el borrador se conserva —incluidos adjuntos y audios
grabados sin enviar—, el modal se vuelve a abrir por el mismo botón, y lo ya extraído queda
guardado para siempre. Si hay un proceso corriendo, sigue corriendo o queda en borrador:
nunca obligarlo a re-analizar ni a reescribir.

- «Al salir del pop-up, debo conservar el borrador, porque sino tengo que empezar todo
  nuevamente» (2026-06-30)
- «si una importación está pendiente y yo cierro el modal, eso debería seguir trabajando
  allí o quedándose en borrador» (2026-08-06)

### Regla: confirmar es un modal de la app que PREVISUALIZA lo que va a pasar

Nunca el `confirm()` nativo del navegador («nunca el típico de HTML que salta arriba,
siempre un pop-up nativo», 2026-07-12). Y toda acción irreversible o generada por IA pasa
por ese modal mostrando exactamente el resultado: «antes me confirmes que hay un modal de
"confirmación" en donde pueda previsualizar todas las tareas que le está por mandar a
evaluar con el perro. Porque de lo contrario, se van a crear muchas tareas que pueden estar
mal» (2026-07-17).

### Un «no volver a mostrar» nunca puede esconder su propia vía de reapertura

`DatosConfirm` decía textual «Podés reabrirlo cuando quieras desde el ícono ⚠ del plan», y
el botón que lo reabría estaba gateado por `!datosOff` — o sea que desaparecía exactamente
cuando el usuario aceptaba apagarlo, dejando la feature de deadlines/checklists inalcanzable
para siempre hasta limpiar localStorage. Agravante del mismo caso: el auto-open era
agnóstico de vista, pero el botón de reapertura solo se renderizaba en kanban, y la vista
por defecto es 'prioridades'.

**Regla:** el copy de un diálogo es un **contrato**; si promete una vía de vuelta, esa vía
tiene que existir en TODAS las vistas donde el diálogo puede aparecer.

**Vive en:** app/plan/board/BoardShell.tsx · app/plan/board/DatosModal.tsx · *2026-07-19 ~review-datosmodal-plan-board*

---

## Wizards y formularios

### ⚠️ `WizardShell` llama a `useCapaModal` pero nunca engancha `capa.refScroll`

La pila de modales promete que al cerrar el de arriba, el de abajo vuelve con el scroll
exactamente donde estaba. **En los wizards no funciona en ninguno:** `WizardShell` usa
`useCapaModal` para el z-index y la visibilidad, pero no le pasa `capa.refScroll` al
contenedor que scrollea. Volvés de un modal apilado y estás arriba de todo. Engancharlo es
un cambio de comportamiento para los **24 llamadores**: merece su propia pasada.

Esto rompe además una regla del dueño que vale para toda la app: volver atrás **por
cualquier vía** devuelve al punto exacto donde estabas (scroll incluido) y a la pantalla
anterior, no a la raíz de la tab («Si vuelvo para atrás de la manera que sea, me tiene que
deslizar al punto en el que estaba antes», 2026-07-22).

**Vive en:** app/_components/WizardShell.tsx · app/_components/pila-modales.ts · *2026-08-07 contexto-mako-md*

### ✅ Una pregunta tipo 'escala' con opciones de texto se contesta con un 3 que no significa nada

**RESUELTO el 2026-08-08.** Se documentó acá el 2026-08-05, con el fix correcto ya escrito
abajo, nadie lo ejecutó, y volvió a la pantalla del dueño tres días después: «¿Cuál es el
deadline para tener los ángulos listos?» con botones del 1 al 5. *Eso* es lo que hay que
recordar de esta entrada — **un hallazgo escrito y no ejecutado no protege de nada**.

Lo que pasaba: los dos renderers pintaban 1..5 pelados cuando `tipo==='escala'` y
**descartaban** `q.opciones`. Y no era un mistype raro: el prompt de reuniones ordenaba
«CERRADAS SIEMPRE: cada pregunta con 2-4 opciones concretas» y metía 'escala' en el enum
**sin definir nunca qué significa**, así que `{tipo:'escala', opciones:['15 de agosto','Fin
de mes']}` era la salida ESPERADA. El saneo se quedaba con el token y tiraba las fechas; al
Perro le llegaba «la pregunta → 3».

Cómo se cerró: el contrato entero (tipos + saneo + el texto que leen los modelos) se mudó a
`lib/preguntas-contrato.ts`, los dos renderizadores se fusionaron en `PreguntaCampo`, y hay
16 tests. La causa de fondo no era el prompt sino que **no existía código que lo validara**
— ver «Una regla en un prompt no es una regla» en AGENTS.md. Detalle completo en
[hallazgos-plan.md](hallazgos-plan.md).

**Vive en:** lib/preguntas-contrato.ts · app/plan/board/guardian-form.tsx (PreguntaCampo) · tests/preguntas-contrato.test.ts · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense · resuelto 2026-08-08*

### ⚠️ El loader de un paso de WizardShell va en la PIEZA: un overlay propio queda por debajo

`TareasRecibidasModal` tiene dos `return`. El overlay con el spinner y el «no cierres ni
refresques» estaba en el segundo (la lista de tareas); cuando `paso === 'preguntas'` la
función corta antes y **no se renderiza nunca**. O sea que al confirmar desde la última
pregunta —el camino normal de una reunión de Fathom— lo único que pasaba en pantalla era
que el botón cambiaba a «Guardando…», con el cuerpo de la pregunta intacto detrás. Crear
las tareas y que el Perro las puntúe tarda minutos: se lee como que la app se colgó.

La salida NO es mover el overlay: uno con z-index propio queda **por debajo** del modal
cuando hay dos abiertos (ya está documentado en el loader de `WizardShell`, que va
`position:absolute` dentro de la tarjeta justo por eso). Para esto existe la prop
`cargando`, que además traba Atrás y el cierre mientras dura; se amplió de `string` a
`ReactNode` para que entrara la segunda línea que explica la espera.

Dos vicios más del mismo overlay, los dos contra reglas que el propio `WizardShell`
documenta: el velo era `rgba(255,255,255,.86)` —un flash en tema oscuro— y estaba aplicado
con `opacity` sobre el contenedor, que apaga también el spinner y el texto. El velo va en
su propia capa y sale de `--surface`.

**Vive en:** app/plan/board/TareasRecibidasModal.tsx (rama `paso === 'preguntas'`) · app/_components/WizardShell.tsx (prop `cargando`) · *2026-08-08*

### ⚠️ Un `?? lista[0]` para un índice fuera de rango convierte «terminaste» en «volvé a empezar»

`const esc = escenarios[escIdx] ?? escenarios[0]`. Al apretar «Terminar el ensayo»,
`siguienteEscenario()` deja `escIdx === escenarios.length`, el `??` cae en el escenario 0 y
el efecto lo **reabre** con semilla nueva, con todos los puntos de progreso apagados y sin
cartel de cierre — la única pista de que terminó es que el «Siguiente» del footer se
habilitó en silencio.

**Regla:** el fallback de un índice fuera de rango es `null` (y una pantalla de cierre),
nunca el primer elemento.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:597 y :1237 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

### Dos modos de la misma pieza tienen que contestar igual

**Síntoma:** el wizard pinta **«Último paso (7)»** y justo abajo el botón dice
**«Siguiente →»**.

**Causa:** `WizardShell` acepta el progreso de dos formas —`pasos` + `pasoActual` (el mapa)
o `total` + `idx` (dos números)— y respondían **distinto al mismo estado**. Con la cuenta en
cero y `enUltimo` en `false`, el modo `total` decía «faltan pasos» (bien) y el modo `pasos`
se creía en el final.

**El diagnóstico obvio era el equivocado.** Parecía inalcanzable: en el único llamador del
modo nuevo, el resumen siempre era el último del mapa. Se volvió alcanzable **al migrar el
onboarding**, cuyo mapa son **secciones** y tiene varias pantallas por sección. O sea: el
bug latente lo activa la migración siguiente, no el código que lo contiene. El orden de las
dos tareas importaba y nadie lo había mirado.

**Regla escrita ahí: `enUltimo` gana en las dos direcciones.** Si dice que es el último, no
hay cola; si dice que no lo es y la cuenta da cero, la que miente es **la cuenta**. Y cuando
una pieza acepta dos formas de recibir lo mismo, la aritmética vive en **una** función pura
que las dos llaman — si no, el segundo modo es el que se queda viejo.

**Vive en:** app/_components/wizard-progreso.ts (la aritmética, pura y con tests) · app/_components/WizardShell.tsx

### Los dots mienten si `total` no es confiable

La posición actual siempre es verdad; la **cola solo existe si se puede contar**.
`futuros = -1` (faltan, cantidad desconocida) pinta tres puntitos de 4px, no puntos-paso.
Colapsa cuatro casos: `total` desconocido, `idx >= total`, `enUltimo` con `total` mayor, y
**salto hacia adelante** — si el wizard se saltea pantallas, `total` deja de servir.

Ese estado se marca **en render, no con `useEffect`**: con efecto, el primer frame del salto
sigue mostrando la fila vieja, que es justo la mentira que se quería sacar.

En el modo `pasos` la cuenta es **exacta** mientras el mapa no se mueva; si el mapa cambia
estando a la vista, pasa a «faltan pasos» y se queda ahí (pegajoso). **Los cambios de mapa
mientras la pieza está trabada por `cargando` no cuentan**: ahí el mapa se está armando y el
usuario no pudo leer ninguna promesa. La comparación mira también el `trabado` del render
**anterior**, porque la respuesta que apaga el loader trae el mapa nuevo en el mismo commit.

**Vive en:** app/_components/wizard-progreso.ts

### El chrome forkeado es donde vuelven los bugs ya arreglados

El wizard con ramas de verdad (`app/crm/StageMoveDialog.tsx`) tenía su **propia copia** del
header, los puntitos, el footer y el loader — ~60 líneas. Ahí vivía un bug de z-index que la
pieza compartida no tiene, y ahí no llegaba ninguna mejora del progreso.

**Regla:** el marco se importa; lo que se queda en el llamador es el **contenido** y la
**navegación** (qué pasos hay, cuándo se puede avanzar). Si el llamador necesita algo que el
marco no da, se le agrega al marco como modo — con la aritmética compartida.

**Detalle de contrato** que se descubrió al migrar: el prop `error` es **una línea de
texto**. Una lista de faltantes con un botón «Completar lo que falta →» va como último hijo
del cuerpo, no ahí.

**Vive en:** app/crm/StageMoveDialog.tsx · app/_components/WizardShell.tsx

### Un fetch gateado por paso muere cuando el wizard REANUDA en un paso posterior

El ensayo pintaba «Tu nota de voz (no disponible)» con los 3 audios grabados. Causa: la
biblioteca de audios se hidrataba solo con `pasoKeyRef.current === 'voz'`, y `cargar()`
aterriza en el **primer paso no hecho** — con 'voz' ya completo eso es 'ensayo', así que
nunca se pasaba por 'voz'. En el recorrido secuencial NO fallaba: el bug aparece solo al
**retomar**, que es lo que hace todo el que no termina de una sentada. Y el fix obvio no
alcanzaba: mover la carga al montaje solo convertía la falla determinista en una carrera,
porque el escenario se abre UNA sola vez (`msgs.length > 0`) y nadie vuelve a mirar los
audios — hizo falta además `if (audios === null) return;` con `audios` en las deps.

**Regla:** antes de gatear un loader por paso, preguntá **en qué paso puede montar la
pantalla**.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:460 (viejo), :467 y :632 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

### El error normal viene en JSON; el 504 de la plataforma viene en HTML, y ahí revienta el `.json()`

En el paso Archivero del onboarding, el route de preguntas devuelve `{ok:false}` ante un
error normal y el cliente lo manejaba bien. Lo que trababa al usuario era el otro camino: la
ruta llama a la IA con `maxDuration 60`, y un timeout de plataforma devuelve una **página
HTML** de error, así que `res.json()` LANZA y cae al catch — que solo hacía
`setVista('archivos')` sin marcar `huecosRevisados`. Como el guard de «Siguiente» es
`if (gaps.length > 0 && !huecosRevisados) return true`, cada click se consumía y el usuario
quedaba **encerrado en el paso para siempre**.

**Regla:** el catch de un `await (await fetch()).json()` dentro de un wizard tiene que ser
**fail-open** (marcar revisado + avisar), porque ahí no estás atrapando el error del backend
sino el de la infraestructura.

**Vive en:** app/onboarding/Archivero.tsx:259-262 (ya corregido con fail-open explícito) · *2026-07-29 ~auditoria-archivero-onboarding*

### Regla: una pregunta por pantalla, cerrada, sin «Saltar» y con vuelta atrás

Es la regla que más veces repitió —al menos cinco entre julio y agosto— y la que más veces
se rompió. Si un form no está así, se modifica antes de seguir.

- **Una sola pregunta por slide**, minimalista y centrada. Nunca dos preguntas en el mismo
  paso, nunca todas juntas en una pantalla. «Prefiero preguntas concretas, mejor si es 1
  sola pregunta, en el medio de la pantalla, modo minimalista» (2026-06-21) · «hoy viven las
  2 preguntas dentro del mismo paso, cuando dijimos que los formularios se crean de a 1
  pregunta por slide» (2026-08-05) · «JAMÁS debes crear formularios como el que hiciste,
  todas las preguntas juntas en lugar de 1 por slide, y lo peor son las preguntas abiertas»
  (2026-08-05)
- **Preguntas cerradas con opciones pre-escritas.** Las abiertas son el último recurso, y en
  MaKo están directamente prohibidas: si hace falta un dato libre, se convierte en opción
  múltiple o multi-select. «vi que la personalidad al final me dio una pregunta abierta,
  cuando dijimos que está prohibido. Si quiere preguntarme de muletillas, me puede poner
  múltiples opciones con multiple select» (2026-07-31)
- **Variar el formato** según lo que se pregunta: multi-select, escala lineal, puntuación
  1..X, comparación. No todo multiple choice. «TODAS las preguntas siguen siendo multiple
  choice…» (2026-07-22)
- **Sin botón «Saltar».** «Elimina la opción de 'Saltar' de toooodos los formularios. Que no
  exista esa opción nunca» (2026-07-30)
- **Siempre se puede volver atrás** a corregir una respuesta ya dada (2026-07-30).
- **Se guarda dónde ibas.** «Me salí del form y al volver a entrar estaba en la pregunta 1,
  debe guardar el historial» (2026-07-23)
- **Primero archivos, después preguntas:** un solo botón para que suelten TODO, la IA
  rellena internamente, y solo lo que ningún doc resolvió se pregunta. «el archivero es
  TOTALMENTE lo contrario a simple… Lo llenaste de preguntas abiertas, es una tremenda
  fricción… debería ser UN solo botón como siempre hacemos en nuestros forms… Y que rellene
  INTERNAMENTE esas preguntas… ahí sí se le pregunta, DE A 1 PREGUNTA» (2026-07-26)
- **Preguntá hechos, no acciones:** la pantalla 1 es el hecho real; la etapa se **deriva**
  del funnel, no se pregunta. *memoria [[form-preguntar-hechos-no-acciones]]*

**Vive en:** app/_components/WizardShell.tsx (el molde) · app/onboarding/* · *memoria [[minimizar-config-usuario]]*

### Regla: el «Siguiente» se bloquea si el paso anterior no está completo

«aún puedo darle al botón "Siguiente" sin haber definido el entregable, revisa MUY BIEN eso,
NO debería poder avanzar jamás si lo anterior no está listo» (2026-07-30). Ojo con la
contracara: un guard que se traba por un error de infraestructura encierra al usuario (ver
el 504 del Archivero, arriba).

### Regla: cada paso declara PARA QUÉ existe

No alcanza con decir qué hace. «No puede ser simplemente "Leeré tus conversaciones" pero
¿PARA QUÉ?» (2026-08-01). Lo mismo antes de pedir un dato: contextualizá por qué se lo pedís,
y al recibir un archivo demostrá que lo analizaste antes de pedir más — «primero me debe
decir "Veo que este documento trata de X cosa" y ser detallista, para que se note que se
analizó» (2026-07-27). El resultado se muestra en secciones desplegables, como en el resto
de la app.

### El molde de los modales y formularios tiene que estar escrito

No es un detalle: el dueño se cansó de repetirlo ronda tras ronda. «No sé cómo hacer que
guardes los registros de cómo armamos estos modales para que lo hagas bien» (2026-08-01).
Este documento es ese registro — si aparece una variante nueva del molde, se escribe acá
antes de mergearla.

---

## Onboarding

### ⚠️ `marcarPasoTab` pisa la pegajosidad: una tab terminada vuelve a «pendiente»

**Síntoma:** un cliente que ya había cerrado el onboarding de una tab reabre el wizard, toca
cualquier paso y queda encerrado otra vez.

**Causa:** `getEstadoTab` respeta el estado guardado
(`parsed.status === 'done' || todo ? 'done' : 'pendiente'`) justamente para que agregar
pasos no re-encierre a nadie, pero `marcarPasoTab` **recalcula duro contra el catálogo
actual y persiste el resultado**: si el catálogo ganó un paso obligatorio nuevo, el `done`
viejo se pierde para siempre en el primer clic.

**Regla:** si agregás un paso NO opcional a `TAB_ONBOARDINGS`, asumí que todos los
workspaces que ya la tenían cerrada vuelven a pendiente — decidilo antes de desplegar, no
con clientes adentro. Y **no renombres una key existente**: el wizard retoma en el primer
paso incompleto, así que una key nueva aterriza en ese paso a todo el que ya había terminado.

**Vive en:** lib/tab-onboarding-state.ts:214-236 (getEstadoTab vs marcarPasoTab) · *2026-08-02 ~investigar-onboarding-chat-agent*

### ⚠️ El server responde `ok:true` y descarta en silencio: dos formas de perder datos

**(1)** El route de fotos salta cualquier archivo >15 MB, acumula el motivo en `warnings` y
responde igual `{ ok: true, warnings, ...estado }`; el cliente hace `if (j.ok) setEst(j)` y
**nunca lee warnings**, así que la foto no aparece y no hay ningún mensaje. Encima el filtro
del cliente solo mira `type.startsWith('image/')`, no el tamaño, así que el archivo SÍ se
sube.

**(2)** Los routes de entregables y razones hacen `.filter(x => x.nombre)` al guardar: si el
usuario selecciona-todo el nombre para reescribirlo y hace blur antes de tipear, el update
optimista mantiene la tarjeta un instante y la respuesta del server **la borra entera**, con
su `queEs`/`fomo` o su copy y guion. Sin confirmación, sin undo y sin recuperación (el
getter reaplica el mismo filtro).

**Regla:** si el server descarta algo, o falla, o el cliente TIENE que pintar el warning.

**Vive en:** app/api/onboarding/persona/route.ts + app/onboarding/PersonaView.tsx · app/api/onboarding/entregable/route.ts + EntregableView.tsx · app/api/onboarding/razones/route.ts + RazonesView.tsx · *2026-07-28 ~review-onboarding-fabrica-creativos*

### ⚠️ Sin ninguna fuente conectada, /general declara «El negocio está sano»

El semáforo arma `alertas = []` cuando no hay datos y cae al `else` final, que dice «El
negocio está sano · Sin focos activos. Buen momento para empujar volumen». La card de
pendientes con 0 leads afirma «datos al día — el tablero es confiable». Un cliente que gastó
plata en ads y ve luz verde con 0 cierres se lleva un tablero que no sabe de qué habla.

Falta el **cuarto estado, el gris**: «sin datos suficientes para opinar». El sistema para
distinguir *apagado* de *cero* ya existe (`lib/sources.ts`, se usa internamente en
/marketing) y el componente que lo mostraría, `SourceStrip`, existe pero está **desmontado**:
ninguna página monta `DashboardHeader`. Esto es la contracara de la regla del dueño: una tab
que depende de una conexión **no muestra pantalla vacía ni datos inventados**, muestra el
onboarding partido pidiendo esos datos («al entrar NO debería mostrar nada, debería salir la
misma pantalla dividida del onboarding y pedirle esos datos», 2026-07-17).

**Vive en:** app/general/page.tsx:411-415, :441-442 y :477 · lib/sources.ts · app/_components/DashboardHeader.tsx (sin consumidores) · *2026-07-16 mako-onboarding-solo-meta*

### Nada del onboarding puede asumir que los pasos son los de la capa `completo`

El status 'done' del wizard estuvo clavado a `body.step === 'retro'`. Cualquier capa que no
termine en retro quedaba `in_progress` para siempre y `guardOnboarding` devolvía al usuario
al wizard en **loop infinito**, aunque lo hubiera terminado. El último paso sale de
`pasosDeCapaActual()`, nunca de un literal.

Gemelo del mismo subsistema: el escape del onboarding de una tab apuntaba a
`router.refresh()`, que re-corre el guard del server y devuelve el mismo wizard — un
onboarding de tab se cierra con **estado de cliente**. Antes de reabrir un onboarding,
verificá que tenga salida.

**Vive en:** app/api/onboarding/route.ts · lib/onboarding-state.ts · lib/tab-onboarding-state.ts · *2026-08-07 contexto-mako-md*

### Poner una `nota` en un ámbito de Datos de Mau pinta el toast de ÉXITO en rojo

**Síntoma:** los ámbitos con `nota` (perfil, setting, crm, integraciones, whatsapp) muestran
SIEMPRE el aviso en tono error aunque la copia haya salido perfecta.

**Causa real:** el cliente empuja al mismo array `detalle` los errores reales Y los `avisos`
informativos que devuelve el server (`avisos.unshift(def.nota)`), y después decide el tono
con `tono: detalle.length ? 'error' : 'info'`. Un texto explicativo se cuenta como si fuera
una falla.

**Regla:** no mezclar canales — un aviso informativo y un error viajan en campos distintos, o
el tono se decide por el `ok` de cada llamada, nunca por el largo de una lista que acumula
las dos cosas. Mientras no se arregle, agregar un ámbito nuevo con `nota` es garantizar que
su toast salga rojo.

**Vive en:** app/_components/PanelAgencia.tsx:134-139 · app/_components/DatosDeMau.tsx:68-78 · lib/datos-mau.ts (las 5 entradas con `nota`) · *2026-08-02 ~investigar-onboarding-chat-agent*

### Decisiones de producto del onboarding

- **Toda tab, sin excepción, arranca con un onboarding propio** (Conectar → Contexto →
  Ensayo), y su estado (hecho / no hecho) alimenta a MaKo: si algo no se optimizó, MaKo sabe
  que fue por onboarding incompleto. «sin excepción, todas las tabs van a requerir cierta
  configuración» (2026-08-01). Se dispara al entrar por primera vez a WhatsApp, Email,
  Closing Analyst, etc.; hay tabs que dependen de otras (Email/WhatsApp mandan a Setting).
- **Es bloqueante y sin atajos:** ningún usuario sin el onboarding completo entra al
  dashboard, ni siquiera el super admin (solo puede rellenar con los datos de Mauricio desde
  la topbar), y el wizard tiene que verse EXACTAMENTE igual que el del cliente para poder
  probarlo de verdad (2026-07-21, 2026-08-01). Al resetear el cliente de prueba se lo manda
  directo al onboarding.
- **Solo el onboarding principal va sin sidebar**; todas las demás tabs la conservan. «Si
  por error entré ahí no tengo forma de salir» (2026-08-01).
- **Dos pantallas:** form simple a la derecha, carrusel de animaciones «wow» a la izquierda.
  Durante el onboarding MaKo usa la API de Groq del super admin para dar el efecto WOW antes
  de que el usuario conecte las suyas — conectar Claude/Groq es la fricción real; escanear un
  QR no lo es (2026-07-16).
- **Lo aburrido va al final:** conectar APIs y configuración se dejan para el cierre; solo se
  adelanta lo que bloquea el avance (2026-08-01). Onboarding general **corto** +
  mini-onboardings por tab: «quiero el efecto WOW lo antes posible» (2026-07-16).
- **Se llena subiendo un template** descargable (Oferta, Avatar, Personaje de Marca) que la
  IA lee y completa; si faltan campos, no deja avanzar. «Normalmente los infoproductores
  completan templates así todo el tiempo» (2026-06-21).
- **Bajar la fricción con soluciones creativas nuestras:** pedir ejemplos, capturas o
  conectar su WhatsApp en vez de hacerle escribir todo; MaKo propone las secuencias y simula
  escenarios tipo chat. «como regla siempre buscamos soluciones creativas nosotros, para que
  al usuario no le cueste cargar todo eso» (2026-08-01).
- **Todo se configura con prompts y botones**, nada de configuración manual en ninguna
  feature: el usuario no tiene que aprender a configurar un software (2026-06-30).
- **Si el sistema puede detectarlo solo, no se pregunta** ni se pide confirmar: verificar el
  QR, disparar la simulación, resolver un dato faltante. «Elimina la parte de "ya lo escaneé,
  verificar", eso debería hacerlo automático» (2026-08-01). Y el paso se resuelve **donde
  está**: nada de mandar al usuario a otra tab («NO me debe redireccionar a otra tab, la de
  WhatsApp… Me debe aparecer directamente allí el botón para generar el QR», 2026-08-01).
- **Ningún dato cargado a mano es ley:** si llega un documento con mejor data, se sobrescribe
  (2026-07-27).

**Vive en:** lib/capas.ts · lib/onboarding-state.ts · lib/tab-onboarding-state.ts · app/onboarding/* · skill `tab-onboarding` · *memoria [[regla-onboarding-por-tab]], [[onboarding-cliente-wizard]]*

---

## Estado y datos en el cliente

### ⚠️ `router.refresh()` no vuelve a correr los efectos de los componentes cliente

El bug de Gemini tenía una segunda causa que el diagnóstico no vio y que hacía insuficiente
el parche: aunque la copia funcionara, **la pantalla no se enteraba**. `DatosDeMau` se
montaba SIN prop `onListo`, y sin ella hace `router.refresh()`, que re-renderiza server
components pero **no remonta componentes cliente ni re-corre sus efectos**. La tarjeta del
servicio carga su estado en un `useEffect` con deps `[servicioKey]` (una vez por montaje),
así que seguía vacía, `geminiConectada` seguía false y `puedeAvanzar` dejaba el wizard
trabado.

**Regla:** si el dato que cambiaste lo lee un fetch dentro de un `useEffect` de un componente
cliente, refrescar la ruta no alcanza — hay que llamar al recargador explícito o remontar con
un `key` que cambie. (Y del lado del dueño, la regla es más simple: **nunca hace falta
recargar la página** para ver el estado nuevo; refrescar toda la página es un bug de UX, no
una solución — 2026-08-01.)

**Vive en:** app/_components/DatosDeMau.tsx · app/onboarding/OnboardingWizard.tsx · app/integraciones/ServicioConfigForm.tsx · *2026-08-01 mako-onboarding-copy-y-bugs*

### ⚠️ Un callback opcional que nadie pasa es código muerto que el typecheck no ve

`ServicioConfigForm` declaraba `onEstado?: (conectada: boolean) => void` y lo invocaba en
cada carga y en cada guardado; el único call-site del repo lo montaba **sin la prop**. Con
optional chaining eso es un no-op silencioso: `calcConectada()` se calculaba y el booleano se
tiraba, sin error de compilación.

**Síntoma:** la app se contradecía a sí misma en un solo viewport — la fila decía «✓
Guardada» en verde y, a centímetros, el chip del mismo modal seguía en «Por configurar», el
tile ámbar y el contador quieto.

**El fondo es de Next:** el array `integraciones` baja como prop de un server component y el
POST va por `fetch` a un route handler — no es Server Action, no vuelve payload RSC, y
`force-dynamic`/`revalidate = 0` rigen el render **del servidor**, no el estado del cliente
ya montado. Hace falta un `router.refresh()` explícito (hoy cableado como `onCambio`).

**Vive en:** app/integraciones/ServicioConfigForm.tsx:260-262 y :351 · app/integraciones/IntegracionesBoard.tsx:1107 y :381 · *2026-07-16 ~auditoria-refactor-integraciones*

### ⚠️ Un efecto con deps `[]` que lee `pathname` deja las preferencias en null para toda la sesión

El efecto que carga las prefs in-app tiene `deps: []` pero adentro hace
`if (pathname.startsWith('/login') || isPublicLandingPath(pathname)) return;`. Si el provider
monta con /login (bookmark, URL tipeada), sale **antes** del fetch y **antes** de registrar
el listener, y como el root layout no se desmonta en navegaciones soft (verificado contra
Next 16.2.6: el router sigue el 307 sin caer a MPA), nunca vuelve a correr.
`inAppActivo(null,…)` es fail-open, así que el sonido y los toasts salen aunque estén
apagados, y guardar en Configuraciones no cambia nada hasta un F5.

**Regla:** si la guarda de un efecto lee algo, ese algo va en las deps — o derivá un booleano
(`enPublico`) y usalo como dep.

**Vive en:** app/_components/NotificationsProvider.tsx:331-344 (y el efecto gemelo de :301) · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### ⚠️ Las preferencias en localStorage sangran entre inquilinos: el origin es el mismo

Al impersonar clientes en el mismo navegador, las keys sin namespace muestran datos del
anterior: borradores de WhatsApp, el wizard de Nueva Campaña a medio llenar, marcas de leído,
drafts del plan y el board v9. Son **12 keys**: `mako-wa-drafts`,
`mako-wa-empresa-drafts/leido`, `mako-wa-leido`, `mako.nuevaCampana.draft.v2`,
`mako.adsTable.cols.*`, `mako_draft_proyecto`, `mako_draft_tarea`, `mako.revisar.*`,
`mako_ia_last_seen_at`, `mako-wa-tpl-*`, `mako_plan_v9`.

`BoardShell` ya lo resolvió con ``dlKey(base) = `${base}_${scope}` `` — verificado que las
suyas están scopeadas y que `mako-wa-drafts` sigue pelada. Ese es el patrón a copiar. Además,
tras cualquier reset de workspace hay que **barrer las keys `mako*` del navegador** o la app
sigue pareciendo llena.

**Vive en:** app/whatsapp/WhatsAppApp.tsx:280 · app/plan/board/BoardShell.tsx (dlKey, el patrón correcto) · app/ads-manager/NuevaCampanaModal.tsx · *2026-08-01 mako-cliente-prueba-diagnostico*

### ⚠️ Dos copias del mismo estado + un guardado que postea el documento ENTERO = borrado silencioso

**Síntoma:** escribís un guion desde la matriz, se ve bien; después editás o borrás CUALQUIER
otro guion desde la galería y el primero desaparece de la base, sin error y sin aviso.

**Causa:** `MatrizView` tiene su propio estado y guarda contra la API sin avisarle al padre,
mientras el shell `AdsWriterApp` carga UNA sola vez (`useCallback` con deps `[]`) y sus
mutaciones postean el array `celdas` **capturado en el closure** como la matriz COMPLETA
(`action:'guardar'`), y el route hace `setRazones(limpio)` reemplazando todo. La
sincronización quedó de una sola dirección (galería→matriz), así que la copia vieja pisa la
nueva.

**Regla:** si un endpoint reemplaza el documento entero, ningún componente puede tener una
segunda copia del estado sin un canal hijo→padre; y las mutaciones postean desde el updater
funcional (`setX(prev => …)`), nunca desde el array del closure. Efecto secundario del mismo
bug: el contador de cobertura y «Escribir el próximo guion» siguen viendo la celda como vacía
y generan un duplicado.

**Vive en:** app/ads-writer/AdsWriterApp.tsx:49-61,118-127 · app/onboarding/MatrizView.tsx:74,120-124 · app/api/onboarding/razones/route.ts:135-151 · *2026-08-06 ~review-adversarial-content-machine*

### ⚠️ El progreso de una tarea es DERIVADO de la checklist: generarla pisa el avance a 0

`setChecklist` recalcula `progress = round(hechos/total*100)` cada vez que la lista no está
vacía. Una tarea 'alta' con 70% puesto a mano y sin checklist califica para el botón «MaKo
arma la checklist» (el filtro solo pide `checklist.length===0 && progress<100`), y al
generarla todos los ítems nacen en `done:false` → el 70% se va a 0 sin aviso. Y el undo es
**lossy**: la entrada de historial 'ia' solo captura la checklist, así que deshacer restaura
`checklist=[]` y deja `progress` en 0.

**Regla:** si un campo es derivado, cualquier acción que reescriba la fuente tiene que
capturar el derivado en el snapshot de undo.

**Vive en:** app/plan/board/useBoard.ts (setChecklist / undoHist) · app/plan/board/BoardShell.tsx (generarChecklist) · *2026-07-19 ~review-datosmodal-plan-board*

### ⚠️ Una URL firmada guardada en el estado se rompe de dos formas opuestas, y ninguna avisa

Dos corridas distintas encontraron los dos extremos del mismo patrón.

**(a) Congelada:** `abrirEscenario` mete la URL firmada dentro de `msgs` y nadie la refresca;
subir el TTL de 1 h a 12 h corre el acantilado, no lo saca — pasado el plazo el navegador
pinta un reproductor inerte en 0:00.
**(b) Refrescada de más:** la bandeja de empresa re-firma cada media en cada poll de **8 s**,
así que la URL cambia de identidad, las imágenes se re-descargan y reasignar `src` en
`<audio>`/`<video>` **resetea la reproducción** — una nota de voz de más de 8 s es imposible
de escuchar.

En los dos casos el síntoma es mudo: `ChatHilo` no tiene `onError` en `<audio>`, `<img>` ni
`<video>`, así que una URL muerta es indistinguible de un archivo roto.

**Regla:** la URL firmada se resuelve al renderizar (o se mergea por id preservando la
anterior), **nunca se persiste en estado**; y todo medio servido por URL firmada lleva
`onError`.

**Vive en:** app/whatsapp/_shared/ChatHilo.tsx:208-212 · lib/setting-audios.ts:107 · lib/evolution-mensajes.ts:191 · app/whatsapp/EmpresaInbox.tsx:64-69 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent + 2026-07-09 ~auditoria-espejo-evolution-inbox*

### ⚠️ El componente hermano ya resolvió esto: la bandeja de empresa no copió sus dos guardas

`EmpresaInbox` y `WhatsAppApp` son las dos bandejas de la misma pantalla, y la segunda ya
tiene resueltos dos peligros que la primera no.

1. **Race:** `loadMsgs` hace `setMsgs(j.mensajes)` sin verificar que el chat siga
   seleccionado — un fetch en vuelo del chat A resuelve después de cambiar al B y pinta los
   mensajes privados de un lead bajo el nombre de otro. `WhatsAppApp` lo evita con
   `if (selIdRef.current === selId)`.
2. **Autoscroll:** el efecto `[msgs]` fuerza scroll al fondo en cada poll de 8 s (el array es
   nuevo aunque el contenido sea idéntico), así que leer historial es imposible.
   `WhatsAppApp` lo gatea con `stickBottomRef`.

**Regla:** cuando existan dos componentes que hacen lo mismo, la revisión **empieza por
diffear sus guardas**.

**Vive en:** app/whatsapp/EmpresaInbox.tsx:56-71 vs app/whatsapp/page.tsx (WhatsAppApp):447-450 y :501 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

### ⚠️ Un MediaRecorder pausado no está 'recording': el cleanup lo deja colgado con el micrófono abierto

El cleanup al cambiar de chat solo cancela `if (mediaRecRef.current.state === 'recording')`,
pero `pauseRec()` deja el recorder en `'paused'`. Grabar → pausar → cambiar de chat saltea la
cancelación: el stream del micrófono **no se libera** (el indicador del navegador queda
prendido), `recording` sigue en true y `startRec()` hace early-return, así que no se puede
grabar de nuevo hasta desmontar la página. Y el `onstop` capturó el destino del chat
**original** en el closure, así que si de algún modo se reanuda, el audio se manda al contacto
equivocado. La condición correcta es `state !== 'inactive'` (un recorder pausado igual emite
`onstop` al llamar `.stop()`).

**Vive en:** app/whatsapp/page.tsx:387 · *2026-06-23 ~auditoria-inbox-whatsapp-chatwoot*

### Regla: todo cambio persiste solo, avisa, se puede deshacer 5 segundos y queda en el historial

Las cuatro cosas van juntas y no tienen excepción:

- **No hay botón «Guardar»:** cada cambio persiste solo y se avisa con el toast. «la
  metodología de guardar está bien, pero esa confirmación de guardar se debe dar en cada
  cambio» (2026-06-21).
- **Cartel de modificación + pop-up de 5 segundos para deshacer**, en toda acción destructiva
  o cambio de estado. «TODOS estos cambios debe saltar el botón de deshacer de 5 segundos,
  siempre» (2026-07-13) · «Tiene que salir un cartel de modificación como siempre, y el
  pop-up de los 5 segundos para deshacer» (2026-07-12).
- **Historial de cambios siempre**, sin demora y con el actor: si lo hizo la IA, firma
  **MaKo** con ícono de IA, no con foto de usuario ni «vos». «has marcado como check de
  finalizado, pero no aparece en el historial, debería aparecer, y que justamente la IA o
  MaKo hizo esos cambios» (2026-07-14) · «No actualizaste el HISTORIAL de cambios en cada
  tarea o proyecto… Eso es muy grave… Eso tiene que ser regla siempre» (2026-07-17).

**Vive en:** *memoria [[historial-mako-siempre]]*

### Regla: el estado sobrevive al cambio de pestaña

Borradores escritos y datos ya cargados no se pierden ni se recargan al ir y volver. «si
escribo un mensaje largo y me voy de pestaña y vuelvo, ese mensaje que había escrito ya no
está más» (2026-06-23). Y todo el feedback y los aprendizajes se guardan para reusarlos en
las próximas piezas y en todos los orígenes; no se pierden en el chat (2026-07-22).

### Regla: «Ver más» carga un lote más, nunca todo de golpe

Él lo dijo con la palabra *regla*: «siempre debe cargar una cierta cantidad más, no
absolutamente todo» (2026-08-05). Las previews muestran pocos ítems con «Ver más» u otra
ruta; nunca una lista con scroll infinito («haz que se cargue un "Ver más" en el historial de
la tab de proyectos… Que sino, tiene un scroll infinito», 2026-08-05).

### Regla: si MaKo puede resolverlo, lo resuelve

Solo pregunta cuando NO encuentra la respuesta: «Si lo puede hacer MaKo, siempre debería,
solo me debe preguntar en caso de NO encontrar respuesta» (2026-07-19). Y el server decide
crear/ampliar/ignorar por su cuenta — *memoria [[nunca-duplicar-nunca-preguntar-bajas]]*.

---

## Layout, sidebar y tabs

### ⚠️ Una pantalla que se abre desde WhatsApp tiene que APAGAR el chrome, y el sidebar es lo de menos

La app **no tiene tratamiento móvil**: el sidebar es un riel de ancho fijo, sin `@media`, sin
colapso por viewport. Cualquier pantalla pensada para leerse en el celular —y las que MaKo
linkea por WhatsApp lo son por definición— arranca con ese ancho comido.

**Pero lo que de verdad la rompe no es el sidebar: es `MakoConfirmGate`**, que dispara un modal
**bloqueante y no cerrable** en TODO `/crm*`. Una pantalla nueva bajo `/crm` nace tapada por un
modal que pide resolver confirmaciones del CRM automático, justo con la reunión por empezar. No
hay forma de verlo leyendo el archivo de la pantalla: el gate vive en el layout raíz y matchea
por prefijo de ruta.

**Regla:** antes de colgar una pantalla de un prefijo existente, buscá qué se monta por ESE
prefijo en `app/layout.tsx` y en los gates globales. Y si la pantalla es para el celular,
sumala a `esVistaSinChrome` (`app/_components/PublicRouteGate.tsx`).

**Ojo con el predicado que se reusa:** `isPublicLandingPath` responde «¿la puede ver alguien de
afuera?» y es lo que apaga los pollers de notificaciones (sin sesión devolverían 401 en bucle).
`esVistaSinChrome` responde «¿esta pantalla se dibuja sola?». Toda landing pública cumple las
dos, pero al revés no: el resumen del lead exige sesión y aun así va limpio. Meter la ruta en el
primero para conseguir el efecto del segundo es un nombre que miente, y el próximo que lea la
lista va a creer que esa ruta es pública.

**Y un gotcha de verificación, no de código:** con el panel del navegador oculto la página no
compone frames, así que `getBoundingClientRect()` devuelve **0 en todo** aunque el texto se
extraiga perfecto. Los ceros no son un layout roto. Lo que sí sirve sin panel visible:
`document.documentElement.scrollWidth` vs `window.innerWidth` (desborde horizontal),
`getComputedStyle` y `read_page`.

**Vive en:** app/_components/PublicRouteGate.tsx · app/_components/MakoConfirmGate.tsx ·
app/crm/[id]/resumen/page.tsx · *2026-08-11*

### ⚠️ En una lista de matchers, el genérico que va primero anula la exclusión del específico

`nav.ts` se toma el trabajo explícito de separar 'Clientes' (matchea `/admin` pero **no**
`/admin/guiones`) de 'Guiones' (matchea `/admin/guiones`). `titulo-tab.ts` arma `TODOS` con
`...USER_NAV` **antes** que `...ADMIN_NAV`, y USER_NAV tiene un `starts('/admin')` a secas:
`TODOS.find()` corta ahí y las dos pestañas dicen «MaKo - Admin», que es justo lo que el
módulo existe para evitar. Verificado ejecutando el módulo real.

**Segundo filo del mismo archivo:** el fallback `desdeLaRuta()` capitaliza el primer segmento
sin validar nada, así que un 404 (`/crmm`, `/graficos`) pinta «MaKo - Crmm» e inventa una
sección que no existe.

**Vive en:** lib/titulo-tab.ts:45-46 y :50 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### El `<main>` de una pantalla es `Pagina`, y una pantalla no elige su ancho

Está escrito en [AGENTS.md](../AGENTS.md) y se repite acá porque es el error de layout más
copiado: cada pantalla escribía su propio `<main>` con su `maxWidth` (16 con el mismo padding,
7 variantes sueltas, topes de 1000, 1100 y 1200 según quién la escribió), y copiar la pantalla
de al lado propagaba el número. El `style` de `Pagina` está tipado
`Omit<CSSProperties, 'maxWidth' | 'width'>`: el compilador rechaza el ancho. Si lo que necesita
tope es **texto**, el tope va en el párrafo (`Lectura`, 70ch), nunca en la página.

**Vive en:** app/_ui (Pagina, Lectura) · [app/_ui/LEEME.md](../app/_ui/LEEME.md) · catálogo vivo en /admin/ui

### Regla: la sidebar JAMÁS se scrollea

Si no entra, se resuelve de otra forma —reorganizando o plegando—, nunca con scroll. Está
inspirada en la de Meta, y las notificaciones salen de ahí.

⚠️ **Se violó el 2026-08-11 y el diagnóstico obvio era el equivocado.** El reclamo fue «la
sidebar se ve horrible con esa barra de scroll», así que la primera reacción fue arreglar
**la barra** —adelgazarla y teñirla con `.mk-scroll-oscuro`— y el problema siguió igual. La
barra fea no era el problema: **era el testigo**. Lo roto era que la familia Dev pasó de 10
a 13 filas en 24 horas (Products & Offers, Pricing, Customer Success) y es la única familia
larga que NO usaba el mecanismo de colecciones que el resto de la barra ya tiene — Analyze
esconde siete Analysts en una fila, Content Machine tiene tres grupos. Trece contra las
cinco de Operate. El arreglo real es un `NavGrupo`, no CSS.

**Por qué se volvió a violar una regla que estaba escrita:** era inencontrable por el método
que prescribe AGENTS.md. Su línea «Vive en:» apuntaba a `lib/nav.ts`, **un archivo que no
existe desde el rediseño**, así que grepear la ruta real (`app/_components/nav.ts`) en
`docs/` no devolvía nada. Una ruta muerta en un «Vive en:» no rompe nada y no la ve el
compilador: solo hace que la regla no se encuentre, y entonces cada sesión vuelve a proponer
«le pongo scroll» o «le escondo la barra». Corregidas las tres que había.

**Tres trampas del arreglo, todas verificadas:**

- **El rail PLEGADO desborda ~14 px antes que el expandido**, porque la fila colapsada es más
  alta (`filaStyle(false)` usa `padding: '8px 0'` sobre un ícono de 19). Medir solo con la
  barra abierta subestima el problema — y el rail es el estado por defecto.
- **El flyout hereda el fallo.** Tenía `overflow: 'hidden'` y ningún `maxHeight`: el `alto`
  que calcula `abrirFlyout` solo clampea el `top`. Mover filas ahí sin tocarlo mudaba el
  mismo corte silencioso de la columna al desplegable.
- **La fila del grupo NO lleva contador.** `Contador` pinta sobre `--bad` —rojo de
  notificación— y la regla del catálogo reserva los números a la familia que notifica. La
  pista de que hay más adentro es el chevron, no un número.

**Y lo que NO hay que hacer, con el motivo:** `scrollbar-width: none` no elimina el scroll,
elimina la evidencia — y como el contenedor corta con `overflow: hidden`, el síntoma queda en
exactamente cero: ni degradado, ni media fila. Lo que desaparecía desde abajo era Customer
Success → Pricing → Products & Offers → El semáforo; tres de ésas se habían agregado ese
mismo día, y «Pricing» es literalmente la fila del hallazgo de más abajo.

**Vive en:** `app/_components/nav.ts` (familias, bloques y grupos) ·
`app/_components/Sidebar.tsx` (el flyout y su techo) · `app/_ui/ui.css` (`.mk-scroll-oscuro`) ·
`tests/dev-areas.test.ts` · *2026-08-11*

- «La sidebar se puede scrollear, eso NO debe ser posible NUNCA. Jamás se debe poder
  scrollear en la sidebar» (2026-07-01)
- «Ya hay muchas tabs, no debo scrollear en la barra lateral» (2026-07-01)

Las **secciones** de la sidebar no pueden tener el mismo diseño que las tabs: jerarquías
distintas se ven distintas de un vistazo, para que sea intuitivo.

**Vive en:** app/_components/nav.ts (fuente de verdad de la navegación) · *memoria [[sidebar-nav-estructura]]*

### Regla: las tabs van en UNA fila, sin scroll y sin reacomodar la topbar

- «las tabs se desplazan en doble fila, no debería pasar» / «Las tabs cuando se genera el
  guion tienen SCROLL, no pueden tener scroll las tabs» (2026-07-04). Si no entran, se
  **reorganiza la información**, no se apila ni se scrollea.
- Los botones y controles de una topbar **se quedan en el mismo lugar** al cambiar de tab: si
  en una tab hay buscador o filtro, no se reacomoda todo lo demás. «hay tabs donde aparece la
  barra de búsqueda o el filtro y se desorganizan los botones. Haz que tenga coherencia»
  (2026-08-05).

### Regla: nada desparejo, nada en segunda línea, nada flotando

- Tarjetas del mismo alto, cuadros comparativos a la misma altura, **botones nunca en segunda
  línea**: «Hay botones que se van abajo, en la segunda línea, no debería pasar, todo siempre
  arriba» (2026-08-05).
- **Grillas parejas:** nunca 3+1 ni 5+1. «si hay 3 en una fila y 1 debajo, mejor que sean 2 y
  2. Y mucho peor si hay 5 en una fila y 1 en otra» (2026-07-04). Y los datos van **dentro**
  del recuadro gris, nunca flotando.
- Los **botones de acción van centrados**, nunca alineados a la izquierda: «debería estar en
  el medio. No alineado a la izquierda, ya te lo dije, y como regla» (2026-08-01).
- Las **jerarquías se ven distintas**: proyectos altos, tareas planas y anchas. «las task son
  más planas y anchas, y los proyectos son más altos. Es fácil diferenciarlos» (2026-07-19).
- ⚠️ `flex:1` mata `height:100vh` en el `<main>`: el contenedor colapsa y el loader queda
  diminuto. *memoria [[layout-flex-height-100vh]]*

### Regla: sin opciones ni caminos redundantes

El camino normal es el **default** y no se duplica una acción que ya existe en otro lado de la
misma pantalla: «No debe existir la opción de "completar", normalmente todas las personas
entran en "completar"» (2026-06-21). Lo mismo a nivel navegación: **no se crea una tab o un
chat nuevo para algo que ya existe** — la IA vive DENTRO de la tab donde se trabaja, como
funcionalidad, no como pantalla aparte («una nueva tab con un nuevo chat, cuando ya existía un
"Pregúntale a MaKo"», 2026-07-10).

### Decisiones de navegación

- **Sidebar en secciones (familias)**, con renombres: *Content Machine* reemplaza a *Ads
  Writer*, se agrega *Second Brain*, y *Market Analyst* pasa a *Competitor Spy*. La ruta
  **siempre coincide con el nombre**. Empezaron siendo tres (Operate / Create / Analyze) y
  terminaron en **cuatro**: Content Machine se separó como familia propia el 7/8, porque no es
  UNA herramienta sino un taller con secciones por canal (2026-08-06 → 2026-08-07).
- ⚠️ **Una familia se distingue por su SUPERFICIE, no por su tipografía.** Se pidió cuatro
  veces («haz bien esto de una vez») y las tres primeras fallaron por lo mismo: se intentó
  diferenciarla con tamaño y color de texto, que es exactamente lo que hace un item activo —
  así que en vez de separarlas, las confundía. Lo que funcionó: franja apenas más clara
  cuando está desplegada, pastilla alrededor del ícono en el rail plegado, y el rótulo en
  versalitas mono. **Regla: dos cosas de jerarquía distinta no pueden diferenciarse con el
  mismo recurso visual que ya usa otro estado.** Cerrado el 2026-08-08.
  *Vive en: app/_components/Sidebar.tsx · app/_components/nav.ts · app/_ui/ui.css (`.mk-navrow`)*
- En el sidebar rediseñado, **«Create» pasa a «Sales Machine»**: Landing/VSL/Lead Magnet
  Generator · Chatbot/Sales Email/Newsletters · Closing Script/Sales Roleplay (2026-08-07).
- **«Graphich» pasa a llamarse «Dashboard»** en sidebar, título, landing y ruta: «Dashboard es
  como normalmente todo el mundo conoce ese tablero de métricas». Las features de la landing
  quedan sueltas, no agrupadas en 5 categorías (2026-07-26).
- **Se agrega «Reportar problema»** con ruta `/tickets`, y un **«Chat Analyst»** antes de
  Closing Analyst (2026-08-06).
- **Se elimina Teléfonos y Etiquetas**; Funnel + Archivero + Ángulos y avatares se mudan a una
  tab «Onboarding» accesible desde la foto de perfil — agrupar la configuración fuera del uso
  diario (2026-07-26).
- **Perfil y Notificaciones viven dentro de Configuraciones**, con reportes diarios/por hora
  de lo urgente por WhatsApp y semanales por WhatsApp y email: quiere enterarse de lo que pasa
  sin entrar a mirar (2026-06-30). **Telegram se saca de toda la app** (2026-07-26).
- **La app arranca en modo simple por defecto**, con un botón «Encender modo Avanzado» que
  devuelve todas las tabs y gráficos actuales. El usuario es un infoproductor que ejecuta: «es
  probable que como está hoy la app, no usen el 80% de funcionalidades. NO porque no estén
  buenas, sino porque es mucho» (2026-07-09).
- **/conocimientos se puede compartir por link público**, sin login: «que yo le pueda pasar un
  link a cualquiera y pueda acceder a eso» (2026-07-27).
- La estética general de la app se alinea a la de la landing `/vsl` (2026-07-01).

**Vive en:** app/_components/nav.ts · app/_components/Sidebar.tsx · *memoria [[sidebar-nav-estructura]], [[rediseno-direccion-estetica]]*

### Una tab que existe y no se ve no da ningún síntoma

**Síntoma.** «No veo la tab en la sidebar», sobre un área de `/admin/dev` recién escrita.
La página existía, funcionaba, tenía su Roadmap y su Change History — y no había forma de
llegar salvo tecleando la URL.

**Causa.** El bloque de registros de la familia Dev en `app/_components/nav.ts` es una lista
**escrita a mano**, y la fila nueva no estaba. No era una: **`pricing` llevaba días igual**,
con bitácora completa y sin entrada, y nadie lo había notado.

**Por qué sobrevive tanto.** Es el modo de falla más silencioso que hay: no rompe, no
loguea, no lo ve el typecheck, y no aparece en ningún test porque *nada* pasa. Solo se
descubre cuando una persona la busca — y si nadie la busca, el trabajo queda enterrado.

**Regla.** La lista del nav NO se puede derivar de `registros.ts` (importaría las ocho
bitácoras enteras, ~1.500 líneas de prosa, al bundle del cliente para armar ocho links).
Entonces son dos listas de lo mismo, y eso exige las **dos capas** de siempre: la lista, y
una guarda determinista que falle cuando divergen. Vale para cualquier catálogo que se
duplique por una razón legítima de bundle — la razón justifica la copia, no la falta de
guarda.

**Vive en:** `app/_components/nav.ts` (bloque de registros de `ADMIN_FAMILIAS`) ·
`app/admin/dev/registros.ts` (`REGISTROS_SLUGS`) · `tests/dev-areas.test.ts` (la guarda)

---

## El texto de la UI

### Regla: cero texto de más — sin subtítulos, sin bajadas, sin relleno

Es la corrección que más repitió. Título corto y descriptivo, como mucho un subtítulo corto.
**NUNCA un párrafo explicativo debajo del título**: el contexto va abajo del todo, sin
interrumpir la acción. Él mismo lo llamó regla.

- «es un texto aburrido de leer, que nadie lo lee… va abajo del todo, no interrumpiendo la
  acción» (2026-08-01)
- «no metas texto de más, te lo pedí explícitamente» (2026-07-19)
- «SIEMPRE… NO pongas subtítulos innecesarios» (2026-06-23) · «En general elimina todos los
  subtítulos, todos» (2026-07-23)
- «Elimina "¿Por qué este número?", eso es texto paja» (2026-08-01)
- Ni dos títulos que dicen lo mismo. **Auditá los textos antes de entregar.**

**Vive en:** toda la UI · *memoria [[no-subtitulos-innecesarios]]*

### Regla: nombres explícitos, cero jerga interna

El nombre se entiende **solo**, sin contexto. Nada de apodos nuestros, tecnicismos ni
identificadores de código visibles al usuario. Y no se inventan nombres: se usa el que ya
existe, y el nombre de la tab coincide con la ruta.

- «Es muy importante no caer en jerga interna que solo entendemos nosotros y ningún usuario
  sin contexto entiende… Eso como REGLA… Porque eso vuelve MUY junior la app» (2026-07-26)
- «los textos como 'mako-doer-in' no tienen sentido para el usuario, el cliente jamás
  entenderá qué significa eso» (2026-07-15)
- «Que no ponga "La fábrica de creativos"» · «"Vieron tus videos", nuevamente no se entiende.
  ¿Qué videos? ¿mis reels? ¿mis ads? Sería: vieron tus **anuncios**» · «Baja a tierra a un
  lenguaje simple… no quiero tecnicismos como la matriz 3x3» (2026-06-30)
- «no inventes nombres de etapas, simplemente pon los nombres exactos… No inventes nuevos
  nombres, vamos a confundir» (2026-06-22)
- Los títulos son **descriptivos y neutros**, no informales ni preguntas coloquiales: «El
  título no debería ser ese, debería ser "Verificación de seguridad", un título descriptivo,
  no informal» (2026-08-01)

**Vive en:** toda la UI · *memoria [[nombres-explicitos-sin-jerga]], [[copy-neutro-y-modales]]*

### Regla: íconos profesionales y logos reales, nunca emojis

Las acciones (renombrar, pinear, archivar, eliminar) se nombran por **texto**.

- «no quiero EMOJIS, siempre utiliza iconos, que se vean profesionales, no un mono…»
  (2026-07-10) · «Recuerda no utilizar emojis, mejor los íconos que tenemos en el otro
  WhatsApp» (2026-07-10)
- «con un emoji horrible en lugar de usar un ícono elegante… Ponle correctamente los logos
  siempre» (2026-08-01)
- **Logos reales de la marca** (Fathom, WhatsApp, Meta, Calendly, Panda Video, Resend), sin
  fondo y del mismo tamaño óptico, nunca inventados: «Tienen que ser los mismos logos de la
  empresa, no los inventes» · «es importante que ningún logo tenga fondo… O le sacas el fondo
  o buscas el logo sin fondo por la web» (2026-07-16)
- El **logo de MaKo es solo la estrella**, sin ningún agregado (2026-07-01).

**Vive en:** app/_components/icons.tsx · app/_components/ServicioVisual.tsx (BrandDefs)

### Regla: simple y visual — nunca un bloque de texto plano

Los datos se presentan con contenedores, negritas, bullets y gráficos. Pero **no todo bullet
points**: se varían los recursos con criterio, y el contexto secundario va englobado en un
bloque gris desplegable (que al abrirse **no agranda el modal**: aparece scroll).

- «que se vea simple, que se vea visual, que se entienda rápido, que no sea un texto enorme
  aburrido de leer. Ya sabes esto» (2026-07-30)
- «lo peor es que ahora hiciste que TODO sea bullet points, cuando podés ir variando»
  (2026-08-01)
- «Recuerda nuestro lema para todo: que se vea SIMPLE, entendible… Si quiero acceder a más
  info, sí se debería poder, pero en una primera instancia, siempre SIMPLE» (2026-07-01)
- **Estado vacío = mensaje que explica**, nunca un cuadro con los campos vacíos: «qué feo se
  ven los cuadros de Comportamiento… cuando NO hay datos que traer… en lugar de dejar eso,
  poner un mensaje correspondiente» (2026-07-03)
- **El error sale debajo del campo que lo causó**, no apilado al final de la pantalla: «no
  deben salir al final del todo, deben salir abajo de esa misma key» (2026-07-16)
- **Saltos de línea en los chats de MaKo** — pedido de 2026-06-24, sin cerrar.

### Regla: todo lo que tarda muestra loader, y el loader cuenta qué está haciendo

La UI **nunca** queda inmóvil, nunca muestra la pantalla vieja antes de cargar, nunca un botón
que cambia de texto sin spinner, nunca un estado 'desconectado' mientras carga, nunca una
preview fea antes de tener datos.

- «SIEMPRE un loader… No se tiene que quedar inmóvil nunca, eso da la sensación de que algo
  falló» (2026-08-01)
- «siempre debe aparecer un loader ahí y en todas esas secciones de IA o lo que sea que tarde,
  porque si no, parece que se trabó» (2026-07-30)
- El loader va **describiendo/variando** lo que está haciendo, y en operaciones largas bloquea
  el cierre (ver [Modales y capas](#modales-y-capas)).

### Regla: MaKo tiene acento argentino solo cuando ASESORA

Todo lo que produce **para** el cliente —guiones, copy de anuncios, textos de la app,
onboarding— va en **español plano**. «Está bien que MaKo tenga el acento argentino al asesorar,
pero no al crear cosas para el cliente» · «Cambia todos los textos a español plano, no
argentino. No pongas "¿Tenés algún otro documento para sumar?"» · «No utilices acento
argentino, a veces no se te entiende… ¿A qué te referís con que los tableros "banquen"?»
(2026-06-30). En el chat con el dueño: español neutro, sin voseo (*memoria
[[hablar-espanol-neutro]]*).

### Gráficos y datos: claridad antes que creatividad

- **Un gráfico NUNCA lleva título** (2026-07-23). Los principios completos, en *memoria
  [[graficos-claridad-principios]]*.
- Las **tendencias se miden hasta el día anterior a hoy y por mes**, no por semana: el dato de
  hoy suele estar en 0 no porque sea 0 sino porque todavía no cargó, y eso ensucia la
  tendencia (2026-06-20).
- Antes de llenar una vista con datos reales se hace un **TEMPLATE** de cómo debería verse: el
  diseño venía saliendo mal cuando se armaba sobre la marcha con el análisis ya hecho
  (2026-07-01).
- **Nunca se maquilla un dato.** Si queda feo o sesgado, se revisa el parámetro de medición:
  «(Pero tampoco quiero mentir con los datos.)» (2026-06-25).
- **No poner límites arbitrarios:** ni horas de agenda, ni ventana de días de un público, ni
  cantidad de resultados. El tope lo pone la API, no nosotros. «no limites las horas, que se
  pueda agendar a la madrugada si quieren» (2026-08-07).
- En vez de muchos gráficos por tab, mostrar la **conclusión/insight** que corre un prompt
  sobre toda la tab, y automatizar lo que hoy depende de que el usuario apriete ejecutar: la
  app quedó «Thinker» y tiene que ser «Doer» (2026-07-09). *memoria [[doer-rediseno-norte]]*
- **Experiments** se estructura en Retro → Experiments → Conclusions / Planning, con MaKo
  leyendo todas las demás tabs para generar la Retro — replicar el método SIMPLE de «Nueva
  campaña»; «hoy parece una app barata y mal desarrollada» (2026-07-01).

---

### Exportar/Importar es la ACCIÓN; «Descargar ↓» es el botón. Nunca «Bajar»

**Vive en:** `app/plan/board/ExportarModal.tsx` · `app/crm/ExportarLeadsModal.tsx` ·
`app/crm/CrmToolbar.tsx` · `app/plan/board/ImportarModal.tsx`

El patrón ya estaba cerrado en cuatro pantallas y tiene **dos niveles**, que es la parte
que se saltea el que llega nuevo:

| Nivel | Palabra | Dónde |
|---|---|---|
| La acción, en el header o el menú | **Exportar** / **Importar** | `BoardShell.tsx:727,927`, `CrmToolbar.tsx:149,152` |
| El botón que dispara la descarga, ya adentro del modal | **Descargar ↓** | `ExportarModal.tsx:214`, `ExportarLeadsModal.tsx:334` |

/second-brain decía «BAJAR ↓» en el header y «Bajar tu segundo cerebro» en el modal: la
única pantalla del repo que no usaba ninguna de las dos palabras.

**Y el motivo de fondo por el que «Bajar» está prohibido no es la consistencia: es que
YA SIGNIFICA OTRA COSA en esta app.** `app/conocimiento/ConocimientoView.tsx:164` tiene
un botón «Bajar a tierra ↓» que **no descarga nada** —internaliza un curso— y cuyo
propio label de progreso dice «Importando…». Un usuario que pasó por esa pantalla lee
«BAJAR» como «traer a tierra».

**La prueba sin navegador**, que conviene correr al tocar cualquier pantalla con
entrada o salida de datos:

```bash
grep -rn "Bajar\|Bajás\|te llevás" app/ --include=*.tsx
```

### Un número hardcodeado en un copy es una mentira con fecha de vencimiento

**Vive en:** `lib/cerebro-modelo.ts` (los `que` de `AREAS`)

Las descripciones de las áreas del segundo cerebro decían «los **TRES** segmentos que se
pueden targetear en Meta» y «lo que MaKo entendió del negocio, en sus **SEIS** planos».
Los dos números estaban escritos a mano. Un cliente con cuatro avatares leía un texto
que le mentía, y el del panorama era peor: hay un hallazgo registrado de que el parser
llegó a descartar 5 de 6 secciones, así que ese «seis» afirmaba justo lo que el bug
desmentía.

Y estos `que` en particular son user-facing **por partida doble** —subtítulo de cada
opción en el modal de exportación y renglón de cada carpeta en el README del ZIP—, así
que parecían comentarios internos y no lo eran.

**La regla:** si el copy nombra una cantidad, o sale del dato o no se escribe.

### ⚠️ Una guarda de texto sobre el fuente engancha identificadores, no sólo texto

**Síntoma:** la guarda que impedía que la palabra «techo» —jerga— volviera a la pantalla de
pricing daba **rojo por cosas que no se ven**: `techoIa`, una función importada de otro
módulo, y `a.techo`, un campo de dato. Ninguno de los dos se pinta, y renombrarlos era otro
alcance.

**Causa:** grepear `/techo/i` sobre `Pricing.tsx` con los comentarios sacados sigue mirando
**código**. Un `.tsx` tiene el texto y el programa en el mismo archivo, y la palabra
prohibida vive legítimamente en los dos.

**Regla:** una guarda sobre lo que se LEE mira sólo dos cosas, y las dos **sin las llaves**:
los string literals y el texto suelto de JSX (lo que va entre `>` y `<`). La resta previa
pesa tanto como el match: fuera los comentarios de bloque y de línea, y **fuera los bloques
`import`**, que son puros nombres traídos de otro módulo. Y adentro de `{}` hay expresiones,
no texto — `{usd(techoIa(PRO))}` está entre `>` y `<` y es una llamada.

**Vive en:** `tests/pricing-modelo.test.ts` (`textoEnPantalla`) ·
`app/admin/dev/pricing/Pricing.tsx` · *2026-08-10 cac-dos-monedas*

### ⚠️ Una guarda sobre la pantalla que sólo mira el componente cubre la mitad

**Síntoma:** la guarda de arriba daba verde sobre `Pricing.tsx` y la palabra prohibida
**seguía en pantalla**: la decían **14 strings de `modelo.ts`** que el `.tsx` pinta —
`ECONOMIA`, `CUARTO_PLAN`, `PLAN_MES_1`, cinco meses de `PROYECCION_24`, `RESULTADO_24`,
`TOPE_PAUTA` y `OFERTA_ANUAL`.

**Causa:** en esta pantalla el texto no vive en el JSX, vive en los **DATOS**. El `.tsx` es
el molde y los párrafos son campos de constantes exportadas. Una guarda sobre el componente
mide dónde está el archivo, no dónde está el texto.

**Regla:** la guarda recorre los valores de **los mismos exports que el componente importa**,
y la lista de exports sale **del propio `import`** del archivo leído como texto — así no se
queda vieja cuando alguien agrega uno; una lista escrita a mano al lado de lo que enumera se
separa siempre. Lo que se importa pero no se pinta va en una lista explícita y chica
(`NO_SE_PINTAN`: los `id` que son claves de React y un par de campos de respaldo), con el
comentario de que si alguno empieza a pintarse sale de ahí.

**Vive en:** `tests/pricing-modelo.test.ts` (`stringsDe`, `NO_SE_PINTAN`) ·
`app/admin/dev/pricing/modelo.ts` · *2026-08-10 cac-dos-monedas*

### ⚠️ Con conclusión arriba y conclusiones por sección, la duplicación es el modo de falla por defecto

**Síntoma:** el bloque de conclusión general **copiaba** la conclusión de su parte en vez de
resumirla. Ya había pasado sin guarda adentro de la parte 3, donde el titular repetía palabra
por palabra la frase que estaba sesenta píxeles más abajo — ese caso está en
[hallazgos-ia.md](hallazgos-ia.md) → «La conclusión escrita a mano no se entera de que el
dato de al lado cambió».

**Causa:** no es un descuido. El que escribe el resumen de arriba tiene delante la frase de
abajo, y esa frase es la mejor que hay: copiarla es el camino de menor resistencia, y cada
reescritura de una parte vuelve a abrir la puerta.

**Y enganchó a su propio autor.** La guarda —tramo textual compartido de menos de 40
caracteres contra la conclusión de la parte— se verificó por mutación, como manda
[hallazgos-infra.md](hallazgos-infra.md) → «Un test que nunca viste fallar no sabés si
sirve». Lo que atrapó no fue un texto viejo: fue **el primer borrador del agente que la
estaba escribiendo**, con 44 caracteres textuales. Hubo que reescribir el texto, no aflojar
el tope.

**Regla:** la duplicación entre dos niveles de resumen se ataca con una guarda, no con
revisión — la revisión la hace el mismo que acaba de copiar. Cuando dos capas resumen lo
mismo, la de arriba se queda con el veredicto y la de abajo cuenta lo que sigue.

**Vive en:** `tests/pricing-modelo.test.ts` (`tramoCompartido`, «la conclusión general resume
su parte, no la copia») · `app/admin/dev/pricing/modelo.ts` (`CONCLUSION_GENERAL`) ·
*2026-08-10 cac-dos-monedas*

### ⚠️ Un matcher de números que arranca en `[\d.,]` se come el punto final de la oración

**Síntoma:** el test que exige que ningún número de la conclusión general aparezca si no está
en su parte daba **rojo por un dato que estaba bien**. La conclusión cerraba «…por 62.» y la
parte decía «…por 62, porque».

**Causa:** el matcher era `[\d.,]+`, así que capturaba `"62."` **con el punto** y buscaba esa
cadena en la parte, donde el mismo número termina en coma. Lo único distinto entre los dos
textos era dónde termina la oración.

**Regla:** un matcher de números arranca en dígito (`/\d[\d.,]*/`) y descarta la puntuación
final (`.replace(/[.,]+$/, '')`). Si no, la aserción valida la **redacción** en vez del dato
y falla justo cuando el dato es correcto — el peor rojo posible, porque empuja a cambiar el
texto que estaba bien.

**Vive en:** `tests/pricing-modelo.test.ts` («la conclusión general no dice ningún número que
su parte no diga») · *2026-08-10 cac-dos-monedas*

## Entregar una pantalla

### Regla: todo lo que se construye para el dueño se construye para los clientes, en la misma pasada

La vista de super admin y la del cliente son **la misma pantalla**. Nunca razonar «esto es
solo para el dueño».

- «todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo; hoy
  en los clientes sigue igual que antes» (2026-07-12)
- «los cambios que hacemos tienen que impactar siempre para clientes también» (2026-07-22)
- «no entiendo por qué la vista de superadmin y cliente son diferentes en la tab de Plan,
  deben ser lo mismo» (2026-07-13)

*memoria [[cambios-impactan-clientes]]*

### Regla: verificá en el navegador antes de decir que está listo

No se declara hecho lo que no se ve en la app. Hay **permiso permanente de preview** (Chrome /
Claude in Chrome): usalo.

- «no veo que se haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el fallo
  está de tu lado» (2026-07-14) — si él dice que falla, el fallo es nuestro hasta que se
  pruebe lo contrario.
- «Hay muchos gráficos que están mal, te invito a que hagas Claude in Chrome para verificarlo»
  (2026-07-19)
- «El botón de desconectar está muy pegado a la sección… Nuevamente fallo en el diseño, no sé
  por qué no lo revisas antes de publicar» · «El loader sigue viéndose arriba del todo,
  exactamente como la captura anterior… No puede ser que no sepas solucionar esto»
  (2026-08-01)
- **Probá vos**, no le devuelvas la prueba al usuario: mandá los mensajes, mové un lead y
  devolvelo, cambiá el nombre de una campaña pausada. «No funciona… Por favor, prueba tú»
  (2026-07-20)
- Las pruebas que salgan hacia afuera van **siempre** a martinkoncke@gmail.com y
  **+5493764673479** (2026-07-14).

### Regla: resolver en una pasada, con multiagente si hace falta

Gastar tokens sin arreglar lo pedido es la queja que más se repite al final del período.
Prefiere que gastes recursos antes que entregar algo a medias.

- «Realmente no entiendo en qué te estás gastando tantos tokens y aún no solucionas las cosas
  que te pedí… ¿cuántos prompts más para que lo arregles?» (2026-08-07)
- «si tienes que correr 10000 mil multi agentes para hacer esto bien, o de la manera que se te
  ocurra, pero hazlo bien» (2026-07-22)
- «ya dimos muchas vueltas, no sé qué tengas que hacer, si tienes que lanzar multi agente o lo
  que sea, pero soluciónalo» (2026-07-30) — cuando algo ya se corrigió dos veces y sigue mal,
  no vuelvas con otro parche.
- «corre un multi agente y haz bien esta vista… puedes utilizar la preview de Chrome, los
  multi agentes, todo» (2026-06-30)
- Antes de construir algo grande, **contale cómo lo vas a presentar** para que lo apruebe:
  «antes de hacer el onboarding, dime cómo lo piensas presentar, así te lo apruebo»
  (2026-07-10). Decisión relacionada: instalar skills que obliguen a pensar antes de
  desarrollar —brainstorming, writing-plans, grill-me— porque «no creo que estemos haciendo
  las cosas bien doer o simples» (2026-07-10).

### Regla: la documentación se escribe para que la lea ÉL

No solo para otro agente: depurada, con títulos, ordenada y visible en super admin
(`/admin/docs`). «si yo lo puedo entender fácil, eso me habilita a darle mejores prompts al
otro Claude» (2026-08-07). Este documento se rige por eso.

---

## Pendientes

Cosas escritas y no cableadas, o pedidas y no hechas. Verificá contra el código antes de
tomar una: algunas pueden haberse cerrado.

### ⚠️ El feed de notificaciones existe en la base y no lo muestra nadie

La tabla `notificaciones` se llena y `/api/notificaciones` responde, pero **ningún componente
lo consume**: el badge del sidebar viene de WhatsApp/Evolution, no de este feed. Y cada
reporte que se despacha escribe un link a `/perfil?tab=notificaciones`, una tab que ya no
existe. Es el mismo modo de falla que el resto de este lote: se escribe bien y no se lee.
Contradice lo que dice la memoria [[perfil-notificaciones-reportes]] sobre la campanita
in-app: al 2026-07-19 el feed está escrito y no se ve en ninguna pantalla.

Pendiente relacionado del dueño: **mapear todas las notificaciones existentes** en
Configuraciones → Notificaciones para activarlas/desactivarlas por canal (in-app pop-up y
sonido **por separado**, WhatsApp, email) — 2026-08-06.

**Vive en:** app/api/notificaciones · lib/reportes.ts (link a /perfil?tab=notificaciones) · *2026-07-19 ~landing-24-features-auditoria*

### ⚠️ La tab Teléfonos de /configuraciones no existe: el panel está escrito y nunca se montó

`app/configuraciones/TelefonosPanel.tsx` no lo importa nadie: `ConfigInnerTabs` solo lista
notif · fiscal · equipo. Esto **deroga** lo que dice la memoria [[telefonos-workspace]], que
la da por viva junto con Integraciones. En la misma pasada: `/api/admin/mako-grupo` no tiene
ningún caller en la UI, y `ConfigInnerTabs` arranca fijo en 'notif' **sin leer query params** —
el link `?tab=notif` que usan todos los avisos funciona por coincidencia con el default, y el
día que cambie el default se rompen los 49 avisos a la vez.

**Vive en:** app/configuraciones/TelefonosPanel.tsx · app/configuraciones/ConfigInnerTabs.tsx:18 y :24 · lib/avisos.ts:81 · *2026-08-06 rediseno-notificaciones*

### ⚠️ Entregable y Persona funcionan en el hub de onboarding pero son huérfanos del wizard

Los dos tienen su View, su route (GET/POST/DELETE) y aparecen como tabs del hub — pero el hub
vive en `/onboarding` y solo se desbloquea cuando el onboarding está 'done', así que un
cliente nuevo, durante el alta bloqueante, **nunca los ve**. No es un flag apagado: no están
cableados. Falta (a) sumarlos al union `PasoOnboarding` de `lib/capas.ts`, que es la fuente de
verdad de qué pasos existen; (b) meterlos en el array `onboarding` de la capa 'completo'; (c)
actualizar el `type Paso` **local** del wizard, que duplica el union y hay que tocar en
paralelo; y (d) agregarles rama en el builder de pantallas — sin la rama, aunque estén en el
array de la capa no se genera ninguna pantalla y el paso desaparece en silencio. Ojo: el hub
**no** está en /configuraciones (esa ruta no tiene nada de onboarding).

**Vive en:** lib/capas.ts:24 y :110 · app/onboarding/OnboardingWizard.tsx:48, :243-299, :484-491 · lib/onboarding-state.ts:56-67,82-93 · app/onboarding/OnboardingTabs.tsx:89-100 (el orden canónico) · *2026-07-28 mapear-onboarding-ajustes*

### ⚠️ El título de la pestaña del navegador siempre dice «MaKo»

Debería decir «MaKo - CRM» o el nombre de la tab donde está parado (2026-08-06). Ojo que el
módulo que lo resuelve tiene los dos bugs de matchers descritos en
[Layout, sidebar y tabs](#layout-sidebar-y-tabs).

**Vive en:** lib/titulo-tab.ts

### La ficha del lead tiene una TERCERA copia, en /whatsapp, y es de solo lectura

[hallazgos-crm.md](hallazgos-crm.md) dice que la ficha vive en dos árboles (el modal
`LeadDetail` del CRM y la página `/leads/[id]`). Hay un tercero: `/whatsapp` no reusa ninguno
de los dos — tiene su propio pop-up inline (page.tsx 777-881) alimentado por
`/api/whatsapp/lead/[id]`, que devuelve un resumen liviano (`getLead` + `getVslEngagement`)
distinto del `CrmLead`. Resultado: desde el inbox la ficha es SOLO LECTURA y con secciones
propias, y su footer manda a `/leads/{id}` para poder editar. El wrapper reusable ya existe y
no hace falta tocar `LeadDetail` (que es controlado): `LeadEditModal` se monta solo con
`leadId` y ya está probado montado dinámico con `ssr:false` en `app/_components/Desglose.tsx:24`.

**Vive en:** app/whatsapp/page.tsx (fichaOpen/abrirFicha 207-210 y 454-469, markup 777-881) · app/api/whatsapp/lead/[id]/route.ts · app/leads/LeadEditModal.tsx · *2026-06-23 wa-inbox-recon*

### 21 llamadores siguen en el modo `total`/`idx` de `WizardShell`

No es deuda por sí sola (ver el descarte de abajo), pero cada uno que tenga el mapa en la mano
y lo aplane a dos números es un `indexOf` duplicado.

**Vive en:** app/** · app/_components/WizardShell.tsx

### Pedidos del dueño sin cerrar

- **Los 5 puntos que él mismo listó como faltantes** (2026-07-01): anidar Onboarding /
  Notificaciones / Funnel dentro de Configuraciones · mover el editor de prompts a «Contexto
  de MaKo» · Perfil con más campos y foto · historial de estados negativos de Meta ·
  recomendaciones de Meta en español.
- **Ruta propia (deep link) para cada entidad que hoy vive en sub-tabs**: cada llamada de
  ventas analizada, cada anuncio ganador, cada retro, cada task/proyecto. Pidió mapear todo lo
  que se está quedando sin ruta (2026-07-15).
- **/conocimientos:** que un recurso ligado a una clase aparezca en la vista general, y que
  los embeds de video de Drive salgan **verticales** (hoy salen horizontales y cortados) —
  2026-07-21.
- **En la vista de Mauricio siguen apareciendo tabs que deberían estar ocultas** cuando está
  todo vacío (2026-07-28).
- **Los íconos tardan en cargar** cada vez que entra a la app (2026-06-29).
- **El botón «Completar con los datos de Mau» sigue apareciendo** en el modal del onboarding
  «cuando ya dijimos que no debe estar ahí» (2026-08-02).
- **Saltos de línea en los chats de MaKo** (2026-06-24).

### Descartado a propósito (no volver a «arreglarlo»)

- **Migrar `app/chat-bot/SecuenciaWizard.tsx` al modo `pasos`.** Se revisó y **no duplica
  nada**: su `idx` es un índice de estado real, no un `pasos.indexOf(...)` recalculado. Es
  exactamente el caso para el que existe `total`/`idx`. El criterio para migrar es *«¿el
  llamador tiene el mapa y está recalculando la posición?»*, no *«¿existe un mapa?»*.
