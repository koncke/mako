# Copywriter — diseño (28/10/2026)

> **El pedido de Martín (28/10/2026), textual:** «Quiero que implementes mila.gg combinado con notion en "copywriter" y que
> allí se puedan crear los guiones de ads, de reels, de stories, de youtube... Que tenga una interfaz similar a la de web
> generator, con la sidebar de mako y el editor a la derecha».

Una tab nueva, **Copywriter** (`/copywriter`), adentro del grupo Copywriting. Un DOCUMENTO por guion, como una página de
Notion; MaKo al costado, como en mila.gg, escribiendo EN el documento. La ve sólo el super admin hasta que Martín la valide.

## Las fuentes y qué se copia de cada una (regla «NINGUNA pantalla se diseña de cero»)

Se abrieron el 28/10/2026 en el navegador:

| Fuente | Qué se miró | Qué se copia |
|---|---|---|
| **mila.gg** (`/`, `/spec`, `/spec/documents`, `/spec/api-mcp`) + la investigación del 06/08 (memoria «mako-ia-nativa-mila», sacada de sus bundles) | La app pide cuenta: se usó su spec y la investigación anterior. | **El mismo componente de chat en cada documento**, con su charla guardada por documento. **`@` para referenciar** («Plan, research, or @ to reference files»). **El agente escribe por herramientas**, y el juego de herramientas es el de su servidor MCP: `list_documents`, `get_document`, `create_document`, `update_document`, `append_to_document`, `delete_document` → las operaciones de la API de MaKo (D8). **La caja grande del inicio** («Create a doc about whales»): el vacío de la tab es esa caja. |
| **Notion** (`/help/writing-and-editing-basics`, `/help/notion-ai-faqs`, `/product/docs`) | Documentación oficial y la captura del editor de su página de producto. | **El editor por bloques**: «/» abre el menú de bloques y lo escrito lo filtra; el **+** y el asa **⋮⋮** en el margen izquierdo al pasar el cursor (arrastrar mueve el bloque; tocar abre Convertir en · Duplicar · Eliminar); los **bloques básicos** (Texto, Título 1-3, Viñetas, Numerada, Tareas, Desplegable, Cita, Separador, Destacado con emoji, Tabla); los **atajos markdown** («# », «- », «1. », «[] », «> », «---»). La **página**: el ícono grande, el título enorme, las **propiedades** debajo (tipo, ángulo, estructura, duración) y una línea antes del cuerpo. El **árbol de páginas** en una columna gris a la izquierda, que se pliega con «». Y **la IA en el documento**: «cuando Notion AI crea o edita, se puede ACEPTAR, DESCARTAR o pedirle que lo INTENTE DE NUEVO». |
| **El Web Generator** (la casa, copiado de Gamma) | `app/web-generator/**`, `lib/editor-landing/**` | El armazón: el editor a pantalla completa sin `Pagina`, **el chat de MaKo a la izquierda** con el panel único del Ops Center (`PanelDeChat`, `HiloMako`, `CajaChat`, `SelectorIntencion` «Discutir · Editar», la nota de voz en el acto, los adjuntos, el bloqueo sin la app de escritorio) y **el editor a la derecha**. El motor del «/» (`extensiones/barra.ts`, parametrizado para otro catálogo). El camino de la IA (`chatClaude` con su feature, Gemini por defecto, Claude vetado, `errorDeCascada`, `REGLA_NO_EXISTE`). La charla guardada por documento (`lib/hilo-de-tab-*`). |

Lo que NO se copia, y por qué:
- De Notion: bases de datos, menciones de personas, comentarios, compartir, plantillas de la galería, el modo de ancho
  completo. No son de un guion.
- De mila: hojas, presentaciones, «Servers», el selector de modelos y la búsqueda web con fuentes (MaKo no tiene una
  búsqueda web para los chats: si hace falta, es otro trabajo).

## D1 · La tab y sus rutas

- `/copywriter` → el último guion abierto; sin ninguno, **el vacío de mila**: una caja grande «¿Qué guion escribimos?» con
  los cuatro tipos debajo (Ad · Reel · Story · YouTube).
- `/copywriter/<id>` → el editor de ese guion.
- nav.ts: `{ key: 'copywriter', adminOnly: true, label: 'Copywriter', href: '/copywriter' }`, PRIMERA sección del grupo
  Copywriting. ⚠️ `adminOnly` sólo esconde la fila: la PUERTA es `app/copywriter/acceso.ts` (`getSesionAdmin`, el molde
  de AI Avatar), en cada página, en la ruta /api y en el teléfono. El día que Martín la abra, se cambia ESA función.
- El teléfono: `app/m/copywriter` (la misma ruta, `RUTAS_CREACION`), **un paso por pantalla**: la lista de guiones (el
  árbol) → el guion → MaKo (`Guion · MaKo` arriba, el segmentado del teléfono).

## D2 · La pantalla

```
[barra de la app] [ MaKo (chat, 360) ] [ árbol (240, «) ] [ barra: ruta · guardado · ⋯                    ]
                                                           [        📣                                     ]
                                                           [        Título enorme                          ]
                                                           [        Tipo  Ad   Ángulo  Dolor   Estructura… ]
                                                           [        ─────────────────────────────────────  ]
                                                           [        ## Gancho                              ]
                                                           [        …                                      ]
```

- El chat de MaKo es el del Web Generator: no se cierra; su «←» no existe acá (la lista es el árbol, que ya está a la vista).
- El documento mide lo de Notion (708 px de texto, centrado); el árbol se pliega con «» y vuelve con ».
- El CSS vive limitado a `.nt` (`app/copywriter/notion.css`), con los VALORES de Notion en tokens propios y su modo
  oscuro redefiniendo tokens. Los portales (el menú «/», el del asa) se montan adentro de la raíz `.nt`.

## D3 · El documento

- **El contenido es JSON de ProseMirror** (TipTap 3, sin dependencias nuevas): `paragraph`, `heading` (1-3), `bulletList`,
  `orderedList`, `taskList`, `blockquote`, `horizontalRule`, `table` y dos nodos propios, `callout` (destacado con emoji)
  y `toggle` (desplegable). Se SANEA en el server antes de guardarse (`sanearContenido`, lib/copywriter/doc.ts).
- **Cada bloque de primer nivel lleva un id estable** (`attrs.bid`, lo pone una extensión al crearse): la IA apunta a un
  bloque por su id, nunca por su posición (AGENTS.md, «Un chat que edita lo abierto»).
- **Una sección del guion es un Título 2 con su etiqueta** (`attrs.seccion = 'GANCHO'`) y los bloques que le siguen hasta
  el próximo. El texto se lee «Gancho» (como Notion), la etiqueta es la del contrato de `lib/guion-estructuras.ts`.
  Exportar a texto escribe la etiqueta en MAYÚSCULA en su renglón: lo mismo que entiende `parsearSecciones`.
- **Las propiedades** (Notion): `tipo` (ad · reel · story · youtube), `angulo` (id de la biblioteca), `estructura` (id),
  `duracion` (segundos). Viven al lado del contenido, no adentro.

## D4 · Dónde se guarda

En `app_settings` del negocio, como los guiones del Ads Writer (`mako.razones`): **no hay migración**.
- `mako.copywriter.indice` → la lista de páginas: `{ id, titulo, emoji, tipo, padre, orden, actualizado, papelera? }`.
- `mako.copywriter.doc.<id>` → `{ v, version, props, contenido }`.
- **Concurrencia optimista**: guardar manda la `version` que abrió; el server compara y escribe con `cambiarSettingSi`.
  Si otro guardó en el medio, 409 y la pantalla ofrece recargar: nunca pisa. ⚠️ Un guion y su índice son valores LARGOS:
  la tanda 1 salió con `cambiarSettingSi` comparando el valor entero en la URL, y desde ~6-8 KB PostgREST no la acepta
  (docs/hallazgos-infra.md); la verificación del Cerebro lo encontró (desde ~900 palabras un guion no se guardaba más; desde
  ~40 guiones el árbol se congelaba). El Cerebro lo arregló en la raíz (f92b74992): con un valor largo, `cambiarSettingSi`
  compara en el server y filtra por `updated_at` (lib/settings-cas.ts). tests/copywriter-guardar.test.ts lo fija.
- **Borrar es la Papelera** (`papelera` en el índice), con «Restaurar». No hay «borrar para siempre» en esta versión.
- ⚠️ Si un negocio llega a cientos de guiones con versiones, esto se muda a una tabla (`copy_docs`, con su migración y sus
  tres registros). Hoy no hace falta: un guion de YouTube de 10 minutos son ~15 KB, y el índice de 100 guiones, ~20 KB.

## D5 · MaKo escribiendo en el documento (tanda 2)

- **«Discutir»** contesta en el chat y no toca nada. **«Editar»** devuelve operaciones de un catálogo CERRADO (las
  «herramientas» de mila): `escribir_seccion`, `reemplazar_bloque`, `insertar_despues`, `borrar_bloque`, `titulo`,
  `propiedades`. Se validan en el server y otra vez en el navegador; una operación sobre un id que ya no existe se
  descarta con su motivo.
- **Se ve construyéndose** (AGENTS.md, 28/10): el navegador aplica las operaciones de a una, con el texto apareciendo por
  partes (fracciones de segundo por bloque, segundos en total), marcadas como propuestas. Con «reducir movimiento», de una.
  «Saltear» lo muestra entero.
- **Proponer, no aplicar** (AGENTS.md) **a la Notion**: lo escrito queda marcado y el editor no deja tocarlo hasta que la
  persona elige **Aceptar · Descartar · Reintentar** (la tarjeta en el chat). Descartar vuelve EXACTAMENTE a la foto de
  antes; Aceptar la deja y guarda; Reintentar descarta y vuelve a pedir lo mismo. Mientras hay una propuesta, el
  autoguardado no escribe.
- **El contexto del negocio sale del Second Brain**, sólo los nodos que hacen falta: `contextoDelNegocio` (lib/copywriter)
  pide `recuperar(grafo, { pregunta, presupuesto })`. ⚠️ **Punto de enganche**: hoy el grafo es `construirCerebro()`;
  cuando `grafoParaChat` (rama mako-inteligente-2710-c4) llegue a main, se cambia esa UNA línea.
- Más el paquete del ángulo (`instruccionesTexto`), la guía de la estructura y, para reel y story, la metodología de
  `lib/ig-formatos.ts`. Lo que escribe es texto que DICE el cliente: lleva su bloque de idioma (sin voseo), y
  `marcasDeVoseo` lo mira a la salida.
- **`@`** en la caja abre la lista de lo que se puede citar: otros guiones, «La oferta» (el perfil del negocio) y los
  archivos de El Archivero. Lo citado viaja como datos (`contenidoNoConfiable`).

## D6 · Los tipos y sus estructuras (tanda 3)

- `EstructuraGuion` suma `tipos` (los formatos a los que calza). Las siete de antes, sin el campo, son de **Ad**. Se suman
  las de **Reel** (`reel-viral`: Gancho → Historia → Moraleja → CTA; `reel-nicho`: Hook → Problema → Solución → CTA) y la
  de **Story** (`story-dia`: Gancho → Contexto → Moraleja → CTA), sacadas de `METODOLOGIA_REEL` y `METODOLOGIA_STORY`
  (lib/ig-formatos.ts, los cursos que ya usa MaKo). ⚠️ **YouTube NO tiene estructura**: no hay fuente en el repo (YouTube
  Writer era «pronto»), y por la regla de copiar no se inventa: un guion de YouTube ofrece las de anuncios y lo dice
  («Todavía no hay de YouTube»). Pendiente de Martín: de qué curso o referencia sale la de YouTube.
- La biblioteca sigue siendo UNA (`/admin/guiones`, que suma «Para: Ad · Reel · Story · YouTube»). El Ads Writer lee sólo
  las de anuncios (`getEstructurasGuion`); el Copywriter y el editor del super admin, todas (`getEstructurasTodas`). Un
  override guardado antes recibe las de orgánico nuevas al final; para sacar una, se apaga.
- Elegir el tipo y la estructura arma las secciones del documento (un Título 2 por etiqueta) si el cuerpo está vacío; una
  página nueva de un tipo nace con la primera estructura de ese tipo.

## D7 · La mudanza de lo viejo (tanda 3)

Mientras Martín no valide el Copywriter, NADA se apaga: lo viejo sigue andando y lleva al Copywriter a quien ya lo ve.

| Hoy | Qué pasa ahora | El día que Martín lo valide |
|---|---|---|
| **Ads Writer** (`/ads-writer`, la matriz avatar × motivación) | **Se queda**. El lector de cada guion suma «Abrir en Copywriter» (lo COPIA a un documento Ad con su ángulo y su estructura). | Sigue: la matriz es OTRA cosa (qué anuncios faltan) y la usan los clientes. |
| **YouTube Writer** (`/youtube-writer`, «pronto», sólo super admin) | Quien ve el Copywriter va a `/copywriter?nuevo=youtube`; los demás, «pronto». | La fila sale de la barra (`SIN_FILA`, lo hace el jefe Sidebar). |
| **Stories** (`/stories`, sólo super admin) | Sigue andando; la secuencia generada suma «Abrir en Copywriter» (un documento Story, un frame por Encabezado 3). | Su ruta lleva a `/copywriter?nuevo=story` y la fila sale de la barra; su metodología ya vive en la estructura Story. |
| **Ángulos y Estructuras** (`/admin/guiones`) | Se queda: es la biblioteca. Suma «Para». | Igual. |

`/copywriter?nuevo=<tipo>` abre la caja grande con ese tipo elegido: nada se crea por abrir un link.

## D8 · La API de MaKo (tanda 2)

En el área `contenido`, archivo propio (`copywriter.def.ts` + `.run.ts`), al final del área, con las palabras propias
(«documento», «copywriter») para no sacarle el lugar a las de los guiones del Ads Writer. Copia el juego de mila:

| mila | MaKo | Tipo |
|---|---|---|
| `list_documents` | `listar_documentos_copywriter` | lectura |
| `get_document` | `leer_documento_copywriter` | lectura |
| `create_document` | `crear_documento_copywriter` | acción (chat) |
| `append_to_document` | `agregar_al_documento_copywriter` | acción (chat) |
| `update_document` | `reemplazar_documento_copywriter` (pantalla) y `renombrar_documento_copywriter` (chat) | acción |
| `delete_document` | `papelera_documento_copywriter` (+ `restaurar_documento_copywriter`) | acción (chat), reversible |
| — | `enlaces_documento_copywriter`, `compartir_documento_copywriter`, `revocar_enlace_copywriter` (D9) | lectura y acciones (chat) |

Mientras la tab sea sólo del super admin, la API también: cada runner pregunta `veCopywriterEnApi`
(lib/copywriter/puerta-api.ts: sólo el negocio de la plataforma). Se abre junto con la pantalla.

Lo que escribe con IA (escribir un guion entero) NO va por la API en esta versión: lo hace el chat de la tab, que muestra
la propuesta antes de aceptarla.

## D9 · Compartir para editar (tanda 4)

Lo que Martín le prometió a Teo (28/10/2026): «Tu cliente entra y edita lo que le presentás». Fuentes: el «Share → Can
edit» de Notion (un link que edita, sin cuenta si es público) y el modal «Compartir» de la casa (Conocimientos y el
Dashboard: link abierto o invitados por mail, «quién tiene acceso», copiar, rotar y revocar).

- **El link** es una fila de `shares` (lib/shares.ts) con `recurso: 'copywriter'`, `alcance: 'item'`,
  `permiso: 'editar'` y el id del guion en `recurso_id`, en el workspace del guion. Sin migración: la tabla ya tenía el
  permiso de editar (mig 0126) y nadie lo usaba.
- **Quién lo crea:** el menú ⋯ del guion → «Compartir para editar», el MISMO modal (`app/conocimientos/Compartir.tsx`,
  variante `app`). /api/compartir suma una TERCERA puerta (`guion`: quien ve el Copywriter, sobre el workspace de la
  pestaña); el alcance y el permiso los pone el server, y sólo de un guion vivo.
- **Quien lo abre** (`/compartido/<token>`) ve el MISMO editor de la tab en modo `compartido`: el título, el cuerpo con
  «/» y el asa; las propiedades a la vista y sin cambiar (son del método); sin el árbol, sin MaKo, sin la Papelera.
  Arriba, «Tu nombre» (se recuerda en ese navegador) o «Editas como …» si entró con su link personal.
- **Lo que guarda** va a `/api/compartido/guion` con el token en el CUERPO (PUBLICOS_ESCRITURA, por nombre exacto): el id
  del guion sale de la fila, corre en el workspace del link, mira el Origin y corta por IP. Nunca va a /api/copywriter:
  quien abre el link puede tener SU sesión de MaKo abierta. La misma concurrencia de la tab (versión, 409 «recarga»).
- **La marca de quién editó:** la propiedad «Última edición» (la «Last edited by» de Notion): «Ana con el link · 28 oct,
  17:05». Si fue alguien de afuera, el dueño la ve en azul hasta que alguien del equipo vuelve a guardar. El nombre de un
  link abierto lo escribe la persona y no está verificado (por eso «con el link»); el de un invitado sale de su invitación.
- **Lo que viaja** al navegador de afuera: el guion sin su lugar en el árbol, y de la biblioteca SÓLO el ángulo y la
  estructura de ese guion. La pestaña dice «Guion compartido» (ni el título ni el negocio en la tarjeta de un chat).
- Un guion en la **Papelera** no abre por el link (404); si se restaura, vuelve a andar. Para cortar: revocar.
- **API de MaKo:** `enlaces_documento_copywriter` (lectura), `compartir_documento_copywriter` (crea el link abierto y lo
  devuelve) y `revocar_enlace_copywriter`. Invitar por mail queda en la pantalla.
- **En el teléfono** el dueño todavía no tiene «Compartir para editar» (la vista del guion del teléfono no tiene el menú
  ⋯); quien abre el link desde el teléfono sí edita, con la página a lo ancho.

## Qué queda para después

- «Compartir para editar» desde el teléfono del dueño (D9).
- La búsqueda web con fuentes de mila.
- Varias personas editando a la vez (Notion lo tiene; no hay presencia en la casa).
- Versiones guardadas (hoy: deshacer, y la foto de «antes de la IA» mientras hay una propuesta).
