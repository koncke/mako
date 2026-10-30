# Plan final: MaKo te enseña cada pestaña (la guía)

29/10/2026, 23:05. Medido contra `origin/main` `4b8f8145d` (29/10, 20:55), leído con `git show` en `C:/dev/wt-push-q` sin tocar
el árbol. Junta los dos diseños (`diseno-tutoriales-catalogo.md` y `diseno-tutoriales-tarea.md`) sobre los dos mapas.
**`iniciativa/plan.md` apareció a las 23:11** con base `diseno-estado.md` (la `Apertura` y `AperturaMako`): este plan se calza
con él; los once choques y cómo quedan, en §3.4. Revisado adversarialmente a las 23:20 (las correcciones, en el cuerpo).

> **Martín, textual (29/10):** «te voy a pedir que Mako tenga la funcionalidad de poder guiar al usuario a través de tutoriales
> mediante los tutoriales que ya tenemos armado, como por ejemplo los tutoriales que tenemos armado en OpsCenter, o en otros
> lugares, pero que esos tutoriales puedan ser personalizados por Mako. Es decir, que se siga viendo la barra lateral donde está
> el chat, y que Mako le pueda ir señalizando diferentes lugares de ya sea el lienzo, la edición, el dashboard, etcétera, y que
> le pueda ir dando tutoriales personalizados. Entonces, lo que te pido es que reemplaces los tutoriales de hoy en día para que
> esos tutoriales incluso puedan ser personalizados. Y esto, que se aplique en todas las tabs […]. Y básicamente cada vez que un
> usuario entra por primera vez a una tab, Mako le puede preguntar, hey, ¿quieres que te ayude a aprender a utilizar esta
> pestaña? Mira, y ahí que no sea un tutorial predefinido con pasos, sino de que si el usuario ya quiere utilizarlo, que lo pueda
> empezar a utilizar, y que si tiene preguntas, bueno, que pueda Mako señalarle que la pestaña se ponga un poco opaca por detrás.»

---

## 0. En diez renglones

1. **Cada tab declara su catálogo**: las partes que se pueden señalar (anclas) y 2 a 4 **objetivos** cortos («Leer tus
   números»), de 1 a 3 toques cada uno. No hay «Siguiente», ni «2 de 7», ni «Omitir»: se avanza **usando** lo señalado.
2. **Un velo nuevo** «un poco opaco» (40%) con **huecos**: el lugar señalado y el chat. No se come ningún clic: con la guía
   puesta se puede usar la tab y escribirle a MaKo.
3. **El chat se sigue viendo**: el velo le deja un hueco a todo `[data-mako-chat]` (las cinco formas del chat).
4. **Sin IA anda todo**: la pregunta de la primera vez, los objetivos y las preguntas rápidas son botones armados por el
   código. Lo personalizado sin IA sale de los **hechos** de la tab (sin gráficos → «Agregar un gráfico» va primero).
5. **Con IA (su Claude o su ChatGPT)**: la herramienta `senalar_en_pantalla` elige anclas SÓLO del catálogo y escribe una
   frase para ESA persona. Sólo para preguntas libres. Prompt `mako.senalar`, editable en /configuraciones.
6. **Habla con la pieza de la iniciativa**: su pregunta y sus botones son una `Apertura`, con las mismas respuestas rápidas.
   La guía no arma un lugar propio en el chat.
7. **Primera vez por persona y por tab**: marca `guia-<key de nav.ts>` en `usuarios.perfil.recorridos` (existe, sin migración).
   «¿Qué vienes a hacer en <Tab>?» → [<objetivo> ★] [<otro>] [Otra cosa] [Ya sé usarla]. Un hecho, no «¿te ayudo…?»: así lo
   exige `plan.md` a toda apertura (§3.4, choque 2); la frase literal de Martín queda como alternativa (§8).
8. **Los 8 recorridos de hoy pasan a catálogos**. `Recorrido.tsx` y `Senalar.tsx` se borran. El diagnóstico del Web Generator,
   los tutoriales de conexión y el onboarding de configuración **no se tocan**.
9. **El teléfono no ve la página de escritorio**: el proxy le sirve `/m` en la misma URL (`lib/movil-desvio.ts`,
   `MOVIL_ACTIVO`), sin estrella; su guía es G7 y va en paralelo, no al final. En una ventana angosta de computadora (≤ 760 px)
   el chat **se aparta** mientras se señala (modo globo) y vuelve solo.
10. **Tandas**: el núcleo con el Ops Center → Dashboard, IA, Create y teléfono en paralelo → cada tab con su dueño → limpieza.

---

## 1. La base, y lo que se tomó del otro

**Base: el diseño por catálogo.** Es el que resuelve más casos del mecanismo (huecos que se unen, ancla dentro del chat,
`antes` automático, todos los casos de «no está») y su herramienta sigue la regla del registro de la API: «NADA DEL CATÁLOGO
COMO `enum` […] Se valida en el runner y el error trae `disponibles`» (`lib/api-mako/areas/dashboard.def.ts`). El de la tarea
pedía un `enum` por tab: choca con esa regla.

Del diseño por tarea se toma: **el botón recomendado lleva el objetivo** («Leer tus números ★», una pantalla menos) · **la
IA escribe la frase de cada paso** para esa persona (lo «personalizado por MaKo») · **`hecho: { aparece }`** · **quien hizo el
recorrido viejo no recibe la pregunta**, y tres «Ya sé usarla» la apagan en las demás tabs · **el velo fuera de la pila de
modales** y **sin `color-mix`** · **las anclas del chat sólo dentro de su chat**, la primera visible · **la operación en los
motores con IA propia** · **tocar fuera = pausa**, no «se terminó».

**Medido ahora, y los dos diseños (y los dos mapas) lo tenían mal:** Plan, Dashboard y Clientes **ya se corren** con el
panel de MaKo (`BoardShell.tsx:230`, `dashboard/editor-css.ts:28`, `ClientesApp.tsx:949`): las 6 tabs con estrella se corren.
Correrse sólo hace falta en las que estrenan estrella (Chats, Curso, Comunidad, Integraciones, Settings, API, MaKo Partners,
Agency Dashboard).

---

## 2. El mecanismo

### 2.1 Las piezas

| Pieza | Archivo (nuevo) | Qué hace |
|---|---|---|
| Tipos y reglas puras | `lib/guia/{tipos,reglas}.ts` | `debePreguntar`, `recomendado`, `queHacerConElToque`, `validarSenal`, `preguntaDeUso`. Con test |
| Índice | `lib/guia/catalogo.ts` | junta los catálogos; `anclaDelCatalogo(id)` (lo usa el server); el tipo `IdAncla` |
| Buscar sin marca | `lib/guia/donde.ts` | `Buscar` + `marcar`/`soltar`, sacados de `DONDE` de Automations |
| Geometría | `lib/guia/huecos.ts` | unión de huecos, `posicionFrase`; reusa `recorteDe`, `necesitaScroll`, `posicionTarjeta` |
| Primera vez | `lib/guia/primera-vez.ts` | ids `guia-<key>`, `YA_VISTO_POR`, las tres «Ya sé usarla» |
| Prompt | `lib/guia/prompt.ts` | `GUIA_TEMPLATE` (key `mako.senalar` en `lib/prompt-registry.ts`) |
| Estado | `app/_ui/guia/store.ts` | objetivo y paso en curso, chat dueño, pausa (`useSyncExternalStore`). No escribe en la base |
| Velo | `app/_ui/guia/VeloGuia.tsx` | montado UNA vez en `app/layout.tsx` |
| Gancho | `app/_ui/guia/useGuiaDeLaTab.ts` | `useGuiaDeLaTab(key, { listo, hechos })`: lo único que llama una tab |
| Marca | `app/_ui/guia/ancla.ts` | `ancla('dash-editar')` → `data-recorrido`; un id mal escrito no compila |
| Lo visto | `app/_ui/useVisto.ts` | la mitad «visto» de `useRecorrido` |
| Globo de la estrella | `app/_chat/GloboDeLaEstrella.tsx` | la apertura con el chat cerrado (el `corto` de la iniciativa, desplegado) |
| Señal de la IA | `mako.def.ts`/`mako.run.ts`, `lib/chat-bloques.ts` (`senal`), `app/_chat/bloques/SenalHilo.tsx` | herramienta, bloque y chip |

La API en el navegador: `guia.ofrecer(objetivo?)` · `guia.senalar(pasos)` · `guia.cerrar()`.
`lib/recorridos.ts` y `app/api/recorridos/route.ts` **no cambian**.

### 2.2 El catálogo y las anclas

```ts
// lib/guia/tipos.ts — puro: lo importan la pantalla, el server y los tests
type Ancla = {
  id: string;          // 'dash-editar': el data-recorrido, la clave que nombra el modelo. Prefijo de la tab
  nombre: string;      // 'Editar' (≤ 24)
  para: string;        // 'Agrega gráficos y filtros.' (≤ 60, de tú): la frase por defecto del globo
  antes?: string;      // otra ancla que la hace aparecer (un menú, el modo Editar): se señala sola primero
  pregunta?: string;   // la respuesta rápida sin IA: '¿Cómo cambio un gráfico?'
  donde?: Buscar[];    // sólo si no se puede marcar a mano: selectores escritos por el CÓDIGO + `vive`
  enElChat?: true;     // se busca sólo adentro del chat dueño (mk-escribir, mk-instalar)
  sinScroll?: true;    // vive en un lienzo con overflow: hidden: nunca scrollIntoView
  dibujo?: true;       // canvas o iframe: se señala el panel entero
  movil?: false;       // no existe en angosto
};
type Paso = { ancla: string; frase?: string; hecho?: 'toque' | { aparece: string } };
type Objetivo = { id: string; titulo: string /* ≤ 24 */; pasos: Paso[] /* 1 a 3 */; si?: (h: Hechos) => boolean; roles?: Rol[] };
type GuiaDeTab = { key: string /* de nav.ts */; nombre: string; href: string; soloComputadora?: true; anclas: Ancla[]; objetivos: Objetivo[] /* 2 a 4 */ };
```

- **Dónde vive cada catálogo: al lado de su tab** (`app/dashboard/guia-dashboard.ts`, `app/second-brain/guia-ops-center.ts`…),
  puro, sin `'use client'`, sin React, sin `server-only`. Cada dueño toca sólo su carpeta; `lib/` ya importa módulos puros de
  `app/` (`crm.run.ts`, `curso.run.ts`). `lib/guia/catalogo.ts` sólo los junta.
- **`antes` no cuenta en los 3 pasos**: el código lo inserta («Primero abre este menú»). Así la IA nombra el destino y nada más.
- **`tests/guia-catalogo.test.ts`** (uno para todas): cada id está en el fuente como `ancla()`/`data-recorrido`, o trae
  `donde` y su `css` sigue en su `vive`; ids únicos con prefijo de tab (los de hoy se quedan; `ayuda` sólo del curso; comunes
  `mk-`, Create `cr-`); textos cortos, de tú, sin voseo, «Toca» y no «Haz clic»; **toda tab de `nav.ts` que ve un cliente
  tiene catálogo** (falla con una tab nueva sin guía). Cuáles son: las de `FAMILIAS`, `MAKO_NAV` y `USER_NAV` sin `soloSeccion`
  (también **API, MaKo Partners, Agency Dashboard y Report a problem**, que un admin de negocio ve); de `SIN_FILA`, las que abren
  pantalla propia (WhatsApp, Email, Ads Writer, Video Generator) traen catálogo o una línea en `SIN_GUIA` con el porqué; las que
  sólo redirigen (General, Experiments, Stories, YouTube Writer, Ideas) no. Las del super admin (`ADMIN_NAV`, Dev) quedan fuera:
  sin catálogo no pregunta.
- **Una marca por control o por bloque**, no por elemento chico; **nunca un `aria-label` como ancla** (va en `donde`).

### 2.3 El velo con huecos (`VeloGuia`)

- **SVG a pantalla completa con `<mask>`**: un rectángulo negro redondeado por hueco; dos huecos que se pisan se UNEN (el
  `box-shadow 200vmax` de hoy da uno solo). **Huecos**: el ancla, cada `[data-mako-chat]` visible y el globo; si el ancla
  está adentro del chat, sólo el aro.
- **«Un poco opaca»**: `fill: var(--scrim)` (`rgba(0, 0, 0, .4)`, el velo de la casa en `app/globals.css`; el de los recorridos
  es `--sidebar` al 66%, casi negro). **No `var(--sidebar)`**: en el tema candidato `true-north` vale `#E5E9F0` y el velo
  aclararía en vez de oscurecer. Se ajusta mirándolo con Martín.
- **`pointer-events: none` en toda la capa**: sin `aria-modal`, sin atrapar el Tab, sin robar el foco.
- **Fuera de la pila de modales**, z fijo `Z_PISO_RECORRIDO` (400): debajo del toast y del «¿seguro?». Escape, en captura,
  sólo si no hay un modal abierto.
- **Aro y latido** de hoy (quietos con `prefers-reduced-motion`); **la frase** (≤ 60) al lado del ancla, nunca encima del
  chat, y la misma en una región `aria-live` del chat.
- **Re-mide en cada cuadro** mientras está: abrir MaKo mueve el ancla sin cambiar el DOM.

### 2.4 El chat se sigue viendo

El chat no sube de z-index (la tarjeta de Create está en el flujo): **el velo le deja un hueco**. Cada contenedor lleva `data-mako-chat`.

| Forma | Quién lleva `data-mako-chat` | Qué hace la guía |
|---|---|---|
| A. Estrella (Plan, CRM, Dashboard, Calendario, Clientes, Ads Manager) | `.ch-tab-panel` y `.ch-tab-mako` (`MakoEnLaTab.tsx`) | «Sí» abre el panel; las 6 ya se corren |
| B. Tarjeta de Create (Video, Image, Copywriting, AI Avatar, Offer) | `section.cr-tarjeta` y `.cr-riel` (`PantallaCrear.tsx`) | plegada: la despliega mientras guía y la vuelve a plegar |
| C. Chat de un editor | Automations (`aside[data-panel-automations]`, en sus dos valores), Web Generator (`section.gma-izq[data-panel="agente"]`), ficha (`aside.fb-mako-panel`), «Editar con MaKo», el Analista | nada más, si el chat está a la vista (abajo) |
| D. El chat es la pantalla | Ops Center `section.co-panel`; Report a problem (`app/tickets/soporte/PiezasSoporte.tsx`) | el velo tapa la lista, no la conversación |
| E. Sin chat (Chats, Curso, Comunidad, Integraciones, Settings, API, MaKo Partners, Agency Dashboard) | se monta la estrella (`MakoEnLaTab`); `tests/chat-unico.test.ts` no deja otra caja | la tab se corre con `--ancho-panel-mako` en su tanda |

Con dos chats a la vez (la estrella y el Analista del lead), el hueco y la apertura van en el ÚLTIMO que se abrió.

**Si el chat de la tab no está a la vista, la pregunta no va a un hilo escondido.** Automations entra en la LISTA (`enLaLista`
arranca en `true`, `SimuladorWhatsApp.tsx:413`): el chat aparece recién al elegir una automatización, y sin ninguna no hay chat.
Ahí la pregunta va en el globo de la estrella que los dos candidatos de la iniciativa le montan a la lista (`diseno-estado.md`
3.11, `diseno-guion.md` 3.11); si la tanda de Automations llega antes, la monta ella, una sola vez. El hueco es el `aside` de la
lista. Lo mismo en cualquier pantalla con su chat cerrado: el globo, junto a la puerta de ese chat.

### 2.5 Señalar SIN IA (siempre)

Todo son aperturas con botones, armadas por el código con el catálogo:

```
① ¿Qué vienes a hacer en <Tab>?   [<recomendado> ★] [<otro>] [Otra cosa] [Ya sé usarla]                  (sólo la primera vez)
② ¿Qué quieres hacer?                           [objetivo] [objetivo] [Dónde está…]                       («Otra cosa» o el «?»)
③ (la frase al lado del ancla; en el chat, sólo «Salir»)                                              (se avanza usándola)
④ Listo. ¿Algo más?                              [objetivo] [objetivo] [No, gracias]
```

- **Lo personalizado sin IA**: los **hechos** que la tab ya tiene cargados (`si`: sin gráficos, «Agregar un gráfico» va
  primero), **lo que está en pantalla** (un objetivo cuya primera ancla no está y no tiene `antes` no se ofrece), el **rol**
  (lo que un closer no ve no está en su DOM) y los hechos de negocio que pasa la iniciativa («oferta sin cargar»).
- **Sin la app** (la caja dice «Instala MaKo para escribir»), «Conectar tu IA» (`mk-instalar` → `mk-conectar`) va primero.
- **«Dónde está…» sin IA**: las `pregunta` de las anclas presentes, de a 3 con «Otras»; cada una señala su ancla con su `para`.
- **Nada de esto pasa por el turno ni se guarda en el hilo**: son aperturas locales.
- **Sin «Seguir» mientras se guía** (sería el «Siguiente» de siempre): «Seguir: <objetivo>» sale sólo después de una pausa (§2.8).
- **«Recomendado» no es una recomendación**: ordena qué enseñar primero con hechos de la pantalla y no pasa por
  `lib/recomendaciones*.ts` (AGENTS.md lo exige a «toda pantalla que sugiera algo»). La diferencia se escribe en AGENTS.md con la
  regla de §9, como lo pide también `diseno-guion.md` (trampa 4).

### 2.6 Señalar CON IA (sólo preguntas libres)

1. **La herramienta** `senalar_en_pantalla` en `lib/api-mako/areas/mako.def.ts`: `tipo: 'lectura'`, `canales: ['app']`,
   `costo: 'gratis'`. Parámetros: `titulo?` (≤ 24) y `pasos` (1 a 3 de `{ ancla, frase }`, frase ≤ 60). El runner valida cada
   id con `anclaDelCatalogo` y que sean del catálogo de la tab; si no, devuelve el error con `disponibles`. Si está bien:
   `{ content: 'Señalado: Editar, Filtros.', bloque: { t: 'senal', guia, titulo, pasos }, siSeDibuja: 'La persona ya lo ve
   señalado: no describas dónde está.' }` por `ctx.aDibujar` (ya existe: `lib/api-mako/ejecutar.ts:93`).
2. **Lo que viaja**: `Desde` suma `senalable: { tab, anclas }` (la key de `nav.ts` y los ids presentes, ≤ 40; nunca texto de la
   pantalla), saneado en `lib/chat-desde.ts`. **No se llama `guia`**: `diseno-guion.md` (1.6) proponía `Desde.guia` para otra cosa
   (lo contestado en una apertura), en el mismo archivo. La herramienta va en `deSiempre` (`lib/mako-turno-app.ts:661`)
   cuando hay `desde.senalable`; la lista de
   anclas va al system **sólo** si el texto pregunta cómo o dónde (`preguntaDeUso`) o sale de una apertura de la guía, con la
   **pista ADELANTE** (el chat elige herramientas antes de leer el contexto, `docs/hallazgos-crm.md`, 17/10). Si el regex
   falla, el error con `disponibles` lo arregla. Costo: ~400 caracteres por turno en una tab, ~250 a 900 más en esas preguntas.
3. **El bloque** se guarda con la respuesta. `SenalHilo`: si llegó en esta visita y en esta tab, señala solo; recargado, queda
   el chip «Ver dónde»; desde otra tab, «Ir a <Tab>» con `?guia=`.
4. **El prompt, editable** (skill `add-editable-prompt`): key `mako.senalar`, slots `{{tab}}` y `{{anclas}}`, default en
   `lib/guia/prompt.ts`. No `mako.guia`: el diseño «guion» proponía `mako.guia.contexto` en el mismo registro.
   ```
   GUÍA DE LA PESTAÑA {{tab}}.
   Si la persona pregunta cómo se hace algo aquí o dónde está algo:
   1. Contesta en UNA línea, con UNA pregunta como mucho.
   2. Señálalo con senalar_en_pantalla: hasta 3 pasos, en el orden en que los va a tocar, con una frase corta para cada
      uno (de tú, 60 caracteres o menos, con los nombres de su negocio si ayudan). No los numeres ni digas dónde están.
   3. Usa SOLO estos ids. Los que tienen • están en pantalla; los otros aparecen al tocar el que dicen.
   {{anclas}}
   4. Si no está en la lista, dilo en una línea y no señales. Si es de otra herramienta (su web, Meta), usa buscar_tutorial.
   5. Si quiere que lo hagas tú, hazlo con tus herramientas: señalar es para enseñar.
   ```
5. **Los chats con IA propia** (Video, Image, Copywriter, Offer, Web Generator, Automations) suman la operación
   `senalar_en_pantalla` (mismos campos) al catálogo de su motor (p. ej. `lib/editor-video/chat-catalogo.ts`), y el código
   agrega `mako.senalar` como **sección aparte**, nunca como `{{slot}}` en su prompt.
6. **En el mismo commit**: la entrada de `lib/funciones-mako.ts` (AGENTS.md) y la regla 4 de `lib/hechos-mako.ts` («si es de
   MaKo, manda el link de la tarjeta») suma «y si estás en la app, señálalo».

### 2.7 Si el ancla no está

| Caso | Qué hace |
|---|---|
| Fuera de la vista | `scrollIntoView` sólo si `necesitaScroll`; con `sinScroll`, nunca (corrió un lienzo 330 px) |
| Detrás de algo cerrado (menú, modo Editar, otra sub-pestaña) | señala su `antes` («Primero toca Editar»); al tocarlo espera 2 s y sigue |
| En otra tab | «Ir a <Tab>» con `?guia=`; la tab destino la toma al quedar `listo` y limpia el parámetro |
| No aparece en 1,5 s (vacío, permiso, rol) | **sin velo**; una línea: «No lo veo en esta pantalla». Nunca oscurecer para señalar la nada |
| Caja de alto cero (escondida por CSS) | cuenta como «no está» (trampa del curso, `docs/hallazgos-customer-success.md`) |
| Debajo de un modal de la tab | no señala: «Cierra esta ventana primero» |
| Iframe (lienzo del Web Generator) o canvas (vista previa del Video) | se señala el contenedor (`dibujo`) |
| Debajo del chat, o ventana ≤ 760 px | modo globo (§2.9) |

### 2.8 Cómo se sale

| Gesto | Qué pasa |
|---|---|
| Toca el ancla | paso hecho: sigue el próximo o «Listo. ¿Algo más?» |
| Escribe o toca adentro del chat | **nada** (hoy `Senalar` se apaga con la primera letra) |
| Toca otra parte de la tab | **pausa**: se va el velo, el toque llega igual; en el chat queda «Seguir: <objetivo>» por esta visita. MaKo no insiste |
| Escape (sin modal abierto) o × del globo | pausa |
| «Salir» / «No, gracias» | termina |
| Cambia de tab | termina (salvo «Ir a <Tab>») |

### 2.9 Teléfono y ventana angosta

- **Un teléfono nunca ve lo de abajo**: el proxy le sirve la página de `/m` en la MISMA URL (`decidirDesvio`,
  `lib/movil-desvio.ts`, `MOVIL_ACTIVO = true`), o «Esta pantalla se usa en la computadora». Lo de abajo es la computadora con la
  ventana angosta (y la tableta, que se queda en escritorio).
- **≤ 760 px el chat y la tab no conviven** (panel a pantalla completa; Create de a uno). Al señalar, el chat **se aparta sin
  desmontarse** (`MakoEnLaTab` con estado `apartado`; `PantallaCrear` con `setMovil('pieza')`), el globo va abajo, en la zona
  del pulgar (botones de 44 px), con la frase y «Volver al chat». Al usar el ancla vuelve solo.
- **El teléfono es `/m/*`** (`app/m/_ui/ShellM.tsx`, sin estrella): su tanda (G7) pone la pregunta como hoja de abajo y
  catálogos `m-*`. Sólo sin IA al principio. **No espera a G6**: arranca junto con G3 (la regla es computadora Y teléfono).
- **Lo que exige computadora** (Video Editor en una ventana angosta, `soloComputadora`): ahí no pregunta. El teléfono tiene
  `/m/video-editor`: lo cubre G7.

---

## 3. La primera vez en cada tab

### 3.1 La marca

- **Por persona**: `guia-<key de nav.ts>` (`guia-mako` para el Ops Center del cliente y del super admin, `guia-graphics`,
  `guia-crm`, `guia-video-editor`…) en `usuarios.perfil.recorridos`, por `/api/recorridos`. Pasa `idRecorridoValido` y cabe en
  el tope de 100 (~25 tabs, sus `guia-sabe-*` y las 8 viejas: menos de 60). Sin migración.
- **`YA_VISTO_POR`**: quien vio `sb-inicio` no recibe `guia-mako`; `dashboard`/`dashboard-edicion` → `guia-graphics`;
  `automations` → `guia-setting`; `cs-curso`/`cs-curso-leccion` → `guia-customer-success`; `crm-ficha-edicion` → `guia-crm`.
- **Tres «Ya sé usarla»** → `guia-ninguna`: no pregunta más en ninguna tab (ya sabe moverse). Sin ajuste nuevo en
  /configuraciones. El «?» sigue andando. **Cómo se cuentan**: `/api/recorridos` guarda un id con su fecha (`POST { id }`), no la
  respuesta; por eso «Ya sé usarla» marca además `guia-sabe-<key>`, y con tres `guia-sabe-*` se marca `guia-ninguna`. Sin tocar
  la ruta ni la base.
- El super admin «viendo como cliente» marca SU fila, como hoy (a propósito).

### 3.2 Cuándo pregunta (`debePreguntar`, con test)

Todas a la vez: el server ya contestó (`visto === null` no pregunta: si no, se le muestra un instante a quien ya contestó) ·
la tab dice `listo` (datos cargados; Dashboard con la hoja dibujada y no en blanco; Automations sin MaKo armando un flujo, el
feedback del 13/10) · ningún modal ni menú abierto · el turno de «una apertura por pantalla» está libre · no está en su
onboarding sin terminar (lo dice `TAB_ONBOARDINGS` de `lib/tab-onboarding-catalogo.ts` para su key, con su `cubre` y su
`requiere`: Automations, Calendario, Web Generator, Ads Manager, Offer, Classroom, WhatsApp, Email, Ads Writer, Video Generator;
nunca una lista a mano), ni con el candado
de Esencial, ni en un link compartido, ni en `/onboarding`, ni en el portal del alumno · no es `soloComputadora` en angosto ·
pasaron **1,2 s** desde `listo` (que mire primero).

### 3.3 El mensaje y qué pasa con cada respuesta

**«¿Qué vienes a hacer en <Tab>?»** — un hecho (a qué viene la persona), corto y de tú. La frase de Martín («¿quieres que te
ayude a aprender a utilizar esta pestaña?») pregunta una acción, y `plan.md` ya pasó su otra frase literal de acción a un hecho
con un test que lo exige (§3.4, choque 2); si Martín prefiere la suya, es cambiar este texto y exceptuar `guia:*` del test (§8).
Con el chat a la vista va como apertura en su hilo; con la estrella cerrada, en el **globo junto a la estrella** (no tapa la tab).

| Respuesta | Qué pasa | Marca |
|---|---|---|
| **<objetivo recomendado> ★** o el otro | abre el chat si estaba cerrado y señala el primer paso | vista |
| **Otra cosa** | «¿Qué quieres hacer?» con los demás objetivos y «Dónde está…»; con IA, además la caja con «Pregúntame sobre <Tab>» | vista |
| **Ya sé usarla** | MaKo se calla; queda el «?». Cuenta para las tres | vista |
| No contesta y usa la tab | el globo se pliega al numerito de la estrella por esta visita. «Si ya lo quiere usar, que lo use» | vista |
| No contesta y se va | nada | no: pregunta la próxima |
| Escribe una pregunta (con IA) | un turno normal: una línea y la señal | vista |

**Después**, el «?» de cada tab abre «¿Qué quieres hacer?» sin repreguntar (`guia.ofrecer()`): `.co-ayuda` del Ops Center,
`ayuda` del curso, `au-ayuda` de Automations, «Guía» del ⋮ del Dashboard (las dos entradas quedan en una), «Guía de edición» de
la ficha (abre su objetivo). Las tabs sin «?» suman `BotonGuia` (el `BotonRecorrido` de hoy, renombrado).

### 3.4 Cómo calza con «MaKo toma la iniciativa»

- **Misma pieza**: la pregunta y los botones de la guía son una `Apertura` (id `guia:<key>`, botones `respuesta`/`callar`,
  `.of-pill`, la primera recomendada) dibujada por `AperturaMako`. Lo único que la guía le suma a esa pieza (AGENTS.md: «se le
  suma a la pieza, y lo tienen todas»): el hilo toma la apertura de la guía del `store` cuando la tab no le pasa una propia.
  Así sale en todos los chats sin tocar cada pantalla.
- **Una apertura por pantalla, en este orden**: la primera visita a una tab con su onboarding hecho (o sin onboarding) la habla
  **la guía**; contestada, sigue la de la iniciativa (como un form: «respondo 1 y va a la siguiente»). **Con el onboarding
  pendiente habla la iniciativa** (`diseno-estado.md` 1.3: la primera visita con el onboarding pendiente abre el panel, una vez)
  y la guía espera (§3.2). Lo que frena (sin la app) no compite: es el objetivo recomendado
  de la guía («Conectar tu IA ★»), que en el Ops Center coincide con el paso «su IA» de la escalera.
- **Mientras haya una señal activa, ninguna apertura nueva sale**, y viceversa.
- **La iniciativa elige QUÉ, la guía muestra DÓNDE**: un hecho de negocio de la iniciativa sube el objetivo que lo resuelve.
- **El globo de la guía y el `corto` de la estrella son la misma pieza** (en `diseno-guion.md`, el globo `invita`). En la
  primera visita con el onboarding hecho, la iniciativa no abre el panel sola: habla el globo de la guía.
- **Las reglas de silencio de la iniciativa** (14 días, una vez por día) **no se aplican a la guía**: la guía es una vez por
  persona y por tab.

**Choques con `plan.md`** (apareció a las 23:11, base `diseno-estado.md`), y cómo quedan. Los dos planes tocan los mismos
archivos; donde dicen cosas distintas, esto es lo que se hace:

| # | `plan.md` dice | Esta guía | Cómo queda |
|---|---|---|---|
| 1 | La pieza es `Apertura` + `AperturaMako`; `callar` sólo con «Ahora no», «Lo hago yo», «Lo edito yo», «Lo escribo yo» (§2.2) | usa esa pieza | T1 suma `'Ya sé usarla'` a la unión de `callar`. La apertura `guia:<key>` no entra a `lib/aperturas/catalogo.ts`: sale del `store` |
| 2 | La primera pregunta es un hecho y `tests/aperturas.test.ts` lo exige (`PREGUNTA_DE_ACCION`); su frase literal de acción la pasó a hecho (§1) | preguntaba «¿Te ayudo…?» con excepción | **Sin excepción**: «¿Qué vienes a hacer en <Tab>?» (§3.3). `tests/guia-reglas.test.ts` le corre los mismos topes (160, 28, voseo) importándolos de `lib/aperturas/reglas.ts` |
| 3 | `sb-inicio` sigue y T3 edita su paso 3; «cuando se cierra el recorrido, la escalera» (§3.2, 16-17) | borra `sb-inicio` | El mismo dueño (Ops Center) ordena: si G1 llega antes, T3 no toca `recorrido-inicio.ts`; si llega después, G1 lo borra igual. La escalera arranca cuando la guía no tiene nada en pantalla, no «al cerrarse el recorrido». El caso bloqueado es el objetivo «Conectar tu IA» |
| 4 | «Nada mientras corre un recorrido (su velo tapa el chat)» (§2.7, trampa 11) | el velo ya no tapa el chat | La regla queda, leída del `store` de la guía (señalando o preguntando), no de `Recorrido` |
| 5 | La estrella se abre sola la primera visita con el onboarding pendiente (D3) | la guía espera al onboarding | Arriba: con onboarding pendiente habla la iniciativa; hecho, la guía |
| 6 | T1 escribe en AGENTS.md «Una GUÍA de MaKo no es una recomendación…» | «guía» es esta pieza (`lib/guia`) | T1 escribe «Una APERTURA de MaKo…»; dos cosas con el mismo nombre en AGENTS.md es lo que el próximo confunde |
| 7 | Automations: «[WhatsApp ★] (señala el QR que ya está)» y la estrella en la lista (T8, `SimuladorWhatsApp.tsx:879`) | la guía usa esa estrella | Señalar el QR es `guia.senalar([{ ancla: 'au-qr' }])` (ancla nueva, la marca la tanda de Automations), no un señalador propio |
| 8 | «Chats y WhatsApp no van a la estrella», «Configuración y el curso son formularios» (§4) | monta la estrella en Chats, Curso, Settings… | No chocan: ahí no hay apertura de la iniciativa; la estrella es la de la guía (Martín: «en todas las tabs») |
| 9 | `InstalarMaKo.tsx` «se reusa sin tocarlo» | le pone `mk-instalar`/`mk-conectar` | Sólo dos marcas; se avisa al dueño |
| 10 | Memoria en `usuarios.perfil.aperturas` con el workspace en la clave | `perfil.recorridos`, sin workspace | A propósito: aprender una pestaña es de la persona, no del negocio |
| 11 | T10 toca `EditorInforme.tsx` («Editar» abre el panel); T16 toca `/m` | G3 y G7 tocan los mismos archivos | Mismo dueño en cada caso: va primero la tanda de la iniciativa y la guía re-mide sus anclas (`dash-editar`) |

`plan.md` no suma `Desde.guia` ni `mako.guia.contexto` (eran del guion, que no ganó); `Desde.senalable` y `mako.senalar` se
quedan igual: no chocan con nada.

---

## 4. Qué pasa con cada tutorial de hoy

| Hoy | Destino |
|---|---|
| `sb-inicio`, Ops Center (3 pasos, sólo con `?recorrido=sb-inicio`) | **Se reemplaza** por `guia-ops-center.ts`. `rutaDelHilo` deja de poner `recorrido=`: la primera vez la decide la marca, entre por donde entre (hoy por el menú nunca se abría) |
| `automations` (13 pasos + `PASOS_DEL_LIENZO`) | **Anclas**: las marcables pasan al JSX (`au-lista`, `au-nueva`, `au-config`, `au-probar`, `au-publicar`, `au-activar`); el lienzo sigue por `donde`. Objetivos «Armar tu primera automatización», «Probarla», «Activarla». Se van `RecorridoAutomations.tsx` y `vioVacio` |
| `dashboard` y `dashboard-edicion` | **Anclas**: las `dash-*` se quedan, los textos de hoy son el `para`. `guia-dashboard.ts` reemplaza a `recorridos-dashboard.ts` |
| `crm-ficha-edicion` | **Anclas** del catálogo del CRM (`fb-*`, con `antes` = abrir el lead / «Editar»). Ya no se abre sola al entrar a «Editar» |
| `cs-curso` y `cs-curso-leccion` | **Anclas** del catálogo de Classroom; se monta la estrella en el curso; el «?» `ayuda` se queda |
| `Senalar` («Solucionar» un dato de la ficha) | **Se reemplaza** por `guia.senalar([{ ancla: marcaDato(id) }])`; gana que escribirle a MaKo ya no lo apaga. Se borra `app/_ui/Senalar.tsx` |
| `Recorrido`, `BotonRecorrido`, `useRecorrido` | **Se borran** cuando nadie los importe (G8); `useVisto` queda aparte |
| `lib/recorridos.ts`, `/api/recorridos` | **Se quedan** (marca, recorte, scroll, tabla de z) |
| Diagnóstico del Web Generator (`RecorridoDiagnostico`) | **No se toca**: son los comentarios de un análisis adentro de un iframe |
| Onboarding de cada tab (Conectar → Contexto → Ensayo) | **No se toca**: es configurar, no aprender. La guía espera a que termine. La skill `tab-onboarding` suma un renglón |
| Tutoriales de conexión (`lib/metodo-catalogo.ts`), `TutorialAgente`, `buscar_tutorial` | **No se tocan**: explican cosas de afuera de MaKo |
| Bienvenida del Plan, `EntradaOps`, `ChecklistCurso`, `ChecklistClientes` (y el onboarding de Comunidad, `onboarding-comunidad.ts`) | **Se quedan**; la guía espera a que no estén a la vista |
| `app/stories/OnboardingStories.tsx` (sin entrada), `docs/dev-tabs-mapa.md:224` (`TutorialAprobacionMeta`, ya no existe) | **Se borra** el primero y se corrige el renglón |

Cada tanda borra SU recorrido en el mismo cambio que pone su guía: nunca dos tutoriales a la vez en una pantalla. Ojo:
«recorrido» también es «el recorrido del lead» en el CRM; se busca por `useRecorrido`, `<Recorrido`, `PASOS_` y `data-recorrido`.

---

## 5. Tres ejemplos

### 5.1 Ops Center (`ChatSecondBrain.tsx`, forma D)

Anclas: `sb-chats` (ya), `sb-nuevo` (`NuevoChatCentro`), `sb-buscar`, `sb-ticketera` (la del cliente no está con
`fueraDelPlan`), `sb-uso` (`PieCentro` del super admin y `UsoDelCliente` del cliente), y del chat `mk-escribir`, `mk-hilo` (al lado
de `sb-*` en `app/admin/operaciones/PanelChat.tsx:149,153`), `mk-instalar`, `mk-conectar` (en `AppPrimero.tsx` **y en
`InstalarMaKo.tsx`**: el mismo botón en las cajas con motor propio —Video, Image, Copywriter, Offer, Web Generator, Automations—;
sin él, «Conectar tu IA» no se señala en ninguna de esas seis).

| Objetivo | Si | Pasos |
|---|---|---|
| Conectar tu IA | sin la app | `mk-instalar` «Toca aquí y se descarga MaKo» → `mk-conectar` (aparece) «Ábrela y toca aquí» |
| Pedirle algo a MaKo | con la app | `mk-escribir` «Escríbeme lo que necesitas» |
| Empezar otro tema | — | `sb-nuevo` → `mk-escribir` |
| Ver tus reportes | — | `sb-ticketera` |

- **Recién salido del onboarding, sin la app**: «¿Qué vienes a hacer en Ops Center?» [Conectar tu IA ★] [Ver tus reportes]
  [Otra cosa] [Ya sé usarla]. El primero oscurece la lista, la conversación sigue clara, late «Instalar MaKo» → lo toca y se descarga →
  aparece «Ya lo instalé: conectar» y late → lo toca → «Listo. ¿Algo más?». Después sigue la escalera de la iniciativa.
- **Con IA**: «¿dónde veo lo que me contestaron del error de pagos?» → «En la Ticketera.» + `sb-ticketera` con «Ahí está tu
  reporte de pagos».

### 5.2 Dashboard (`EditorInforme.tsx`, forma A + «Editar con MaKo»)

| Objetivo | Si | Pasos |
|---|---|---|
| Leer tus números | hay gráficos | `dash-controles` «Elige el período aquí» → `dash-grafico` «Toca una barra para ver el detalle» → `dash-mako` |
| Agregar un gráfico | no es de sólo lectura | `dash-editar` → `dash-anadir-grafico` «Elige el tipo de gráfico» → `dash-componente` «Arrástralo donde quieras» |
| Armar otra hoja | — | `dash-hojas` → `dash-nueva-hoja` |
| Compartir la hoja | admin | `dash-compartir` (nueva, en `CompartirInforme.tsx`, `antes: 'dash-ayuda'`) |

- **Primera vez**: con la hoja dibujada y sin menú abierto, a los 1,2 s sale el globo junto a la estrella. «Leer tus
  números ★» abre el panel (la tab ya se corre), velo con dos huecos (panel + filtros) → elige un período → late el gráfico →
  … → «Listo. ¿Algo más?». Mientras tanto puede escribirle a MaKo sin que el velo se vaya.
- **Con IA**: «¿cómo la comparto con Ana?» → «Desde el menú de la hoja.» + `senalar_en_pantalla({ titulo: 'Compartir con
  Ana', pasos: [{ ancla: 'dash-compartir', frase: 'Toca Compartir y mándale el link a Ana' }] })`; el código señala antes el ⋮.
- **No pregunta** en una hoja compartida, en la de una automatización, ni en General (redirige al Dashboard).

### 5.3 Video (`/video-editor`, forma B plegable)

| Objetivo | Si | Pasos |
|---|---|---|
| Hacer tu primer video | sin proyectos | `cr-plantillas` «Elige una plantilla de Reel» (hecho: aparece `ve-linea`) → `ve-importar` «Trae tu video» (hecho: aparece `ve-clip`) → `ve-subtitulos` «Ponle subtítulos» |
| Cortar un clip | hay clips | `ve-clip` «Toca el clip» → `ve-dividir` |
| Exportar y publicar | hay clips | `ve-publicar` → `ve-exportar-publicar` |

- Anclas nuevas en `_opencut`: `ve-biblioteca`/`ve-<categoría>` en `tabbar.tsx` (al lado de `data-pestana`), `ve-vista`
  (`dibujo`), `ve-linea`, `ve-publicar`; los dos botones que hoy comparten `data-publicar-video` llevan cada uno su ancla.
- **Primera vez**: la tarjeta de MaKo (abierta en «Nuevo video») pregunta; si estaba plegada, se despliega mientras guía.
  Después habla la apertura del video de la iniciativa («¿Lo van a ver sin sonido?»).
- **Con IA**: «¿cómo le pongo música?» → el chat del editor devuelve la operación `senalar_en_pantalla` con `ve-audio` «Elige
  una canción aquí» y `ve-linea` «Arrástrala debajo de tu video».
- **< 1024 px** (ventana de computadora): `soloComputadora`, no pregunta. El teléfono ve `/m/video-editor` (G7).

---

## 6. Las tandas, por chat dueño

Cada tanda llega VERDE (tests afectados + `tsc` acotado + `tests/aperturas.test.ts` de `plan.md`) a Integración, que arma el
tren; se recorre en el navegador a 1440 y a 700 px de ventana con una persona nueva del ws3 antes de darla por hecha (**sin
emular un teléfono**: con su UA el proxy sirve `/m` y lo tocado no se ve; el teléfono lo recorre G7); deja su cosecha en el mismo
commit. Orden:
**T0 → G1 (+G2 en el mismo tren) → G3 ∥ G4 ∥ G5 ∥ G7 → G6 (en paralelo por dueño) → G8.**

| # | Dueño | Qué | Listo cuando |
|---|---|---|---|
| **T0** | Ops Center | **De la iniciativa, no de este plan**: la T1 de `plan.md` (`Apertura`, `AperturaMako`, una apertura por pantalla), con `'Ya sé usarla'` en `callar` y su regla de AGENTS.md diciendo «APERTURA», no «GUÍA» (§3.4). La guía no arranca sin ella | la apertura de prueba se ve sin la app y sus botones andan |
| **G1** | **Ops Center** | El núcleo sin IA + el Ops Center como primera tab + la estrella. Nuevos: §2.1 (salvo prompt y señal), `app/second-brain/guia-ops-center.ts`. Toca: `app/layout.tsx`, `MakoEnLaTab.tsx` (`data-mako-chat`, globo, `apartado`), `AperturaMako` (la apertura del `store`), `app/admin/operaciones/PanelChat.tsx`, `AppPrimero.tsx` + `InstalarMaKo.tsx` (`mk-instalar`, `mk-conectar`), `ChatSecondBrain.tsx` (fuera `Recorrido`; `.co-ayuda` → `guia.ofrecer`), `PiezasCentro.tsx`, `app/second-brain/pagina.tsx`, `Recorrido.tsx` (sacar `useVisto`), `recorrido-automations.ts` (re-exporta `donde`), `lib/funciones-mako.ts`. Borra `recorrido-inicio.ts` y su test (`tests/second-brain-tutorial-inicio.test.ts`), ordenado con la T3 de `plan.md` (§3.4, choque 3). Tests `guia-catalogo`, `guia-reglas`, `guia-huecos`, `guia-primera-vez`. La regla en AGENTS.md; este plan como `docs/diseno-guia-mako.md` | una persona nueva entra al Ops Center por el MENÚ, sin la app: la pregunta sale una vez; «Conectar tu IA» oscurece la lista, la conversación sigue clara y late «Instalar MaKo»; con la app, escribir no apaga el velo; Escape pausa; recargar no repregunta; en una ventana de 700 px el chat se aparta y vuelve; `chat-unico` y `aperturas` verdes |
| **G2** | Onboarding | `rutaDelHilo` sin `?recorrido=` (`lib/onboarding-arranque.ts:282`, `ChatArranque.tsx:190`, `tests/onboarding-hilo.test.ts`). Junto con la tanda de la salida del onboarding de la iniciativa (mismo archivo) | salir del onboarding lleva al Ops Center sin parámetro y la pregunta sale igual |
| **G3** | **Dashboard** | La primera tab con estrella. `guia-dashboard.ts` (reemplaza `recorridos-dashboard.ts`), `EditorInforme.tsx` (fuera los dos `Recorrido`; ⋮ → una «Guía»), `CompartirInforme.tsx` (`dash-compartir`), `PanelEditarMako.tsx` (`data-mako-chat`). `tests/dashboard-recorridos.test.ts` → `guia-catalogo` | en /dashboard sale el globo a ~1,2 s; «Leer tus números» abre el panel y señala con dos huecos; «Agregar un gráfico» pasa por «Editar» sola; no pregunta en una hoja compartida |
| **G4** | **API de MaKo** | La IA señala: `mako.def.ts`/`mako.run.ts`, `lib/chat-bloques.ts` (`senal` + saneo), `lib/chat-desde.ts` (`senalable`), `lib/mako-turno-app.ts` (`deSiempre` + sección), `lib/guia/prompt.ts` + `lib/prompt-registry.ts` (`mako.senalar`), `lib/hechos-mako.ts`, `lib/funciones-mako.ts`; y dos de `app/_chat` (avisar al Ops Center): `BloqueHilo.tsx` + `bloques/SenalHilo.tsx`. Tests: saneo, id inventado, `preguntaDeUso`, el selector con frases reales («¿cómo filtro por campaña?», «no encuentro las hojas»), `verify-prompt-registry-sync` | en el Dashboard, con la IA de la PC, «¿cómo filtro por campaña?» da una línea y señala `dash-editar` → `dash-filtro`; recargado queda el chip; un id inventado vuelve con `disponibles`; desde el Ops Center el chip dice «Ir a Dashboard»; **medido** que un turno de la PC (`lib/ia-pc.ts`) dibuja los bloques de `aDibujar` |
| **G5** | **Create** | El shell para las cinco tabs: `PantallaCrear.tsx` (`data-mako-chat` en `.cr-tarjeta` y `.cr-riel`, desplegar al guiar, `setMovil` al señalar, anclas `cr-plantillas`, `cr-nuevo`, `cr-lista`), `tests/crear-pantalla.test.ts` | con un catálogo de prueba, la tarjeta plegada se despliega al señalar y vuelve a plegarse; en una ventana de 700 px pasa a la pieza y vuelve |
| **G6** | cada dueño, en paralelo (los de Create después de G5) | Su catálogo al lado de la tab, sus marcas con `ancla()`, `useGuiaDeLaTab` con `listo` y `hechos`, su «?», y si tiene IA propia, la operación + la sección `mako.senalar`. Borra SU recorrido. Ver la tabla de abajo | su tab pregunta una vez, señala cada objetivo con el chat a la vista, borra su tutorial viejo y `guia-catalogo` la cubre |
| **G7** | MaKo Mobile (también dueño de la T16 de `plan.md`) | **Lo que ve TODO teléfono**, en paralelo con G3: sólo necesita el núcleo de G1. `/m/*`: `ShellM.tsx` (hoja de abajo, globo arriba de `nav.m-barra`), catálogos `m-*`, `lib/movil-rutas.ts`, el chip de la señal en el hilo del teléfono (`HiloMako` → `BloqueHilo`) con «Ir a …» | en un Android de verdad, la primera vez en /m/crm pregunta en una hoja de abajo y señala en la zona del pulgar |
| **G8** | Ops Center | Limpieza: `Recorrido.tsx` (+ `BotonRecorrido`), `tests/recorrido.test.ts`, la navegación de pasos de `lib/recorridos.ts` si quedó sin uso, `OnboardingStories.tsx`, `docs/dev-tabs-mapa.md:224`; cosecha final | ningún archivo importa `Recorrido`; `guia-catalogo` cubre todas las tabs de `nav.ts` (§2.2) y las secciones de `lib/movil-rutas.ts` |

**G6, tab por tab:**

| Tab | Dueño | Archivos (origin/main) | Además |
|---|---|---|---|
| CRM: tablero y ficha | CRM | `CrmBoard.tsx`, `CrmToolbar.tsx`, `mako-crm/PanelMakoCrm.tsx`, `lead-view/ficha/FichaPorBloques.tsx`, `menu-contextual-ficha.ts` | `recorrido-ficha.ts` y `Senalar.tsx` se van; «Solucionar» por `guia.senalar` |
| Automations | Automations | `ChatAgentApp.tsx`, `SimuladorWhatsApp.tsx`, `SecuenciaPerfil.tsx`, `ConfiguracionesBoton.tsx`, `ChatMakoVista.tsx` | anclas fijas donde se pueda, `donde` en el lienzo; los dos tests de recorrido → `guia-catalogo`; la operación en su motor; en la LISTA la pregunta va al globo de la estrella de la T8 de `plan.md` (§2.4); `au-qr` |
| Classroom (curso, comunidad, clientes) | Clients | `curso/CursoApp.tsx`, `app/_cursos/CursoUgc.tsx` y `app/_ui/EditorRico.tsx` (ahí viven `marca`, `modulo`, `portada`, `nuevo-modulo`, `editor-barra`…; `CursoUgc` también lo dibujan el portal del alumno y /conocimientos), `app/_comunidad/*`, `ClientesApp.tsx` | estrella en curso y comunidad (y correrse); `recorridos-curso.ts` se va; espera a `ChecklistCurso`/`ChecklistClientes` |
| Plan | Plan / Perro Guardián | `plan/board/BoardShell.tsx` | anclas nuevas (`plan-nueva-tarea`, `plan-vistas`, `plan-filtrar`…); la bienvenida pide el turno antes |
| Calendario | General y Calendario | `calendario/CalendarioApp.tsx` | — |
| Chats | Chats | `chats/ChatsApp.tsx`, `ListaChats.tsx`, `VentanaChat.tsx`, `Composer.tsx` | **montar la estrella** y correrse |
| Ads Manager | Media Buyer | `ads-manager/MediaBuyer.tsx` | `listo = false` durante `ArranqueMediaBuyer` |
| Offer | Offer | `offer/OfferApp.tsx`, `DocumentoVivo.tsx`, `PiezasRail.tsx`, `ChatOffer.tsx` | `listo = false` durante el arranque; la operación en `ChatOffer` |
| Web Generator | Web Generator | `web-generator/editor/EditorLanding.tsx`, `paneles/ChatAgente.tsx` | el lienzo es iframe: se señala `.gma-lienzo`; el diagnóstico no se toca |
| Copywriting | Copywriter | `copywriter/Copywriter.tsx`, `editor/EditorGuion.tsx`, `PanelMaKo.tsx` | la operación en `PanelMaKo` |
| Video | Video Editor | `_opencut/editor-page.tsx`, `…/panels/assets/tabbar.tsx`, `…/timeline/components/index.tsx`, `…/editor/export-button.tsx`, `…/export/dialogo-exportar.tsx`, `_opencut/chat/PanelChat.tsx`, `lib/editor-video/chat-catalogo.ts` | §5.3; `soloComputadora` |
| Image | Image Editor | `image-editor/ImageEditorCliente.tsx`, `mako/chat/PanelMakoIA.tsx` | anclas por `donde` sobre sus `data-testid` estables |
| AI Avatar | Video Generator y AI Avatar | `ai-avatar/Estudio.tsx` | usa el Cerebro: ya tiene la herramienta (G4) |
| Integraciones y Settings | Integraciones / Settings | `integraciones/IntegracionesBoard.tsx` (`#svc-<key>`), `app/_ui/Ajustes.tsx` (`data-activa`) | **montar la estrella** en `AjustesPagina` y correrse |
| API | API de MaKo | `app/api-mako/ApiMako.tsx`, `Tokens.tsx` | **montar la estrella**; la ve sólo el admin del negocio |
| MaKo Partners y Agency Dashboard | Planes y Partners | `app/partners/*`, `app/agency/AgencyApp.tsx` | **montar la estrella**; sólo el admin |
| Report a problem | Ops Center (Ticketera de usuarios) | `app/tickets/soporte/PiezasSoporte.tsx` | el chat es la pantalla (forma D); la ven todos los roles |
| WhatsApp, Email, Ads Writer, Video Generator (sin fila) | Chats / Copywriter / Video Generator | `app/whatsapp/*`, `app/email/EmailApp.tsx`, `app/ads-writer/AdsWriterApp.tsx`, `app/video-generator/*` | catálogo propio o una línea en `SIN_GUIA` con el porqué; esperan su onboarding (`TAB_ONBOARDINGS`) |

---

## 7. Trampas

1. **El velo de hoy tapa el chat y se come los clics**; **`Senalar` se apaga con la primera tecla**, también la del chat →
   máscara con huecos, `pointer-events: none`, y el toque decidido por `queHacerConElToque`, que excluye `[data-mako-chat]`.
2. **`selectorDe` toma el primer nodo del DOM** y `sb-hilo`/`sb-escribir` están en TODO `PanelDeChat` → anclas del chat sólo
   adentro del chat dueño; la primera VISIBLE.
3. **No preguntar mientras no se sabe** (`visto === null`): si no, aparece y desaparece en cada entrada.
4. **El clasificador elige herramientas antes de leer el contexto** → `deSiempre` y la pista adelante.
5. **Nada del catálogo como `enum` en la API** → validar en el runner con `disponibles`. **Un slot nuevo en un prompt ya
   editado nunca llega** → `mako.senalar` como sección aparte.
6. **`scrollIntoView` corre lienzos con `overflow: hidden`** (330 px medidos) → `necesitaScroll` y `sinScroll`.
7. **`color-mix` en Safari < 16.2 borra el velo entero** → SVG con `fill: var(--scrim)` (un `rgba`, sin `color-mix`).
8. **Si el velo entra a la pila de modales**, la estrella del Plan y de Clientes se sube como sobre un modal
   (`MakoEnLaTab.tsx:111,141`) y `debePreguntar` lee mal `profundidadModales()` → afuera.
9. **El hueco se mueve sin cambiar el DOM** al abrir MaKo → `requestAnimationFrame`, no sólo un observer.
10. **En un diálogo de Radix el chat no se toca** (clics del `body` apagados) → la frase va al lado del ancla.
11. **Un mensaje guardado en el Cerebro sale en todas las tabs** → la guía no escribe mensajes; sólo el bloque `senal` de la IA.
12. **El texto de la pantalla lo escriben los leads** → `desde.senalable.anclas` lleva ids validados, nunca texto del DOM.
13. **Los ids son la clave de lo visto y lo que nombra el modelo** → no se renombran. **Un `aria-label` como ancla se rompe
    en silencio** → va en `donde` con su `vive`, o no va. **Los catálogos son puros** (sin `'use client'`).
14. **La hoja del velo es un template literal** → ni un backtick adentro (`tests/recorrido.test.ts`).
15. **Los mapas decían que Plan, Dashboard y Clientes no se corren con el panel: ya se corren** (§1). Medir antes de «arreglar».

---

## 8. Lo que queda sin hacer o abierto

- **El calce con `plan.md`**: los once choques de §3.4. Los de T1 (`'Ya sé usarla'` en `callar`, «APERTURA» en AGENTS.md) y
  el orden T3 ↔ G1 hay que decírselos al dueño de la iniciativa: este plan no puede escribir en el otro.
- **La pregunta de la primera vez**: va «¿Qué vienes a hacer en <Tab>?» (un hecho). Si Martín quiere su frase literal
  («¿quieres que te ayude a aprender a utilizar esta pestaña?»), es cambiar el texto y exceptuar `guia:*` de
  `PREGUNTA_DE_ACCION`: una línea cada uno.
- **La opacidad (40%)** y si el super admin recibe la pregunta en sus pantallas (por defecto sí, una vez): a mirar con Martín en G1.
- **Si un turno de la PC dibuja los bloques de `aDibujar`**: no está medido (`lib/ia-pc.ts` no los nombra). Lo mide G4.
- **Anclas de pasos sin botón medido** (el «Generar» de Subtítulos, «Dividir» de la línea, la parte del Calendario de
  «Publicar»): las define cada dueño leyendo su pantalla, en G6.
- **La IA en el teléfono**: G7 es sin IA. Falta decidir si el globo lleva caja o manda a /m/second-brain con la pregunta escrita.
- **Dos chats a la vez** (la estrella y el Analista): gana el último que se abrió; si confunde en la prueba, una prop en la pieza.
- **Nada se vio en el navegador**: es lectura de código. G1 se recorre a 1440 y 700 px de ventana, incluido escribir con el
  velo puesto, abrir el panel a mitad de un objetivo y abrir un modal de Radix a mitad de otro; el teléfono, en G7.
- **Montar la estrella en API, MaKo Partners y Agency Dashboard** sigue «en todas las tabs»; si Martín no la quiere ahí, esas
  tres van a `SIN_GUIA` y no preguntan.

---

## 9. Para la cosecha (en el commit de la tanda que lo confirme)

- `docs/hallazgos-ui.md` (vive en `app/_ui`): el `box-shadow 200vmax` da un solo hueco (máscara SVG); `Senalar` se apagaba con
  la primera letra escrita en el chat; el velo no entra a la pila de modales.
- `docs/hallazgos-chat.md`: el chat no se sube de z-index para quedar arriba de un velo: se le deja un hueco con `data-mako-chat`.
  Y los mapas daban a Plan, Dashboard y Clientes como «no se corren»: ya se corrían (el diagnóstico obvio era el equivocado).
- `docs/hallazgos-mobile.md`: **un teléfono nunca ve la página de escritorio angosta**: el proxy le sirve `/m` en la misma URL
  (`lib/movil-desvio.ts`). Probar «el teléfono» con la ventana a 390 px y sin su UA mide una pantalla que ningún teléfono abre
  (el diagnóstico obvio era el equivocado); con su UA, se ve `/m` y no lo tocado.
- `AGENTS.md`, la regla para código nuevo: **toda tab trae su catálogo de guía al lado y llama `useGuiaDeLaTab`; una marca se
  pone con `ancla()`; nunca un `aria-label` como ancla; «recomendado» de la guía no es una recomendación
  (`lib/recomendaciones*.ts`).** Y la skill `tab-onboarding`: «la guía de uso es otra cosa».
- `docs/hallazgos.md`: el índice, en el mismo commit.
