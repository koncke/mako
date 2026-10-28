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
- **Concurrencia optimista**: guardar manda la `version` que abrió; el server compara y escribe con `cambiarSettingSi`
  (compare-and-set sobre el valor entero). Si otro guardó en el medio, 409 y la pantalla ofrece recargar: nunca pisa.
- **Borrar es la Papelera** (`papelera` en el índice), con «Restaurar». No hay «borrar para siempre» en esta versión.
- ⚠️ Si un negocio llega a cientos de guiones con versiones, esto se muda a una tabla (`copy_docs`, con su migración y sus
  tres registros). Hoy no hace falta: un guion son pocos KB.

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

- `EstructuraGuion` suma `tipos` (los formatos a los que calza). Las siete de hoy son de **Ad**. Se suman las de **Reel**
  (Gancho → Historia → Moraleja → CTA, y la de nicho Hook → Problema → Solución → CTA: `METODOLOGIA_REEL`), **Story**
  (Gancho → Contexto → Moraleja → CTA: `METODOLOGIA_STORY`) y **YouTube**. ⚠️ YouTube no tiene fuente en el repo (YouTube
  Writer es «pronto»): su estructura se le avisa a Martín antes de darla por buena.
- Elegir el tipo y la estructura en las propiedades arma las secciones vacías del documento (un Título 2 por etiqueta, con
  la guía de la estructura como texto gris de ayuda).
- La biblioteca sigue siendo UNA (`/admin/guiones`): el Copywriter la lee, no la copia.

## D7 · La mudanza de lo viejo (tanda 3)

| Hoy | Qué pasa | Por qué |
|---|---|---|
| **Ads Writer** (`/ads-writer`, la matriz avatar × motivación) | **Se queda**. Cada guion suma «Abrir en Copywriter» (lo copia a un documento Ad). | La matriz es OTRA cosa (qué anuncios faltan) y la usan los clientes. El Copywriter es sólo del super admin hasta validarlo. |
| **YouTube Writer** (`/youtube-writer`, «pronto», sólo super admin) | Su ruta lleva a `/copywriter` con un guion YouTube nuevo; sale de la barra (`SIN_FILA`). | No tenía nada: el Copywriter es su versión. |
| **Stories** (`/stories`, sólo super admin) | Su ruta lleva a `/copywriter` con un guion Story nuevo; sale de la barra (`SIN_FILA`). Su metodología queda en la estructura Story. | Ya era sólo del super admin; su historial no se guardaba. |
| **Ángulos y Estructuras** (`/admin/guiones`) | Se queda: es la biblioteca. Suma el campo «Tipos». | Una cosa, un lugar. |

## D8 · La API de MaKo (tanda 2)

En el área `contenido`, archivo propio (`copywriter.def.ts` + `.run.ts`), al final del área, con las palabras propias
(«documento», «copywriter») para no sacarle el lugar a las de los guiones del Ads Writer. Copia el juego de mila:

| mila | MaKo | Tipo |
|---|---|---|
| `list_documents` | `listar_documentos_copywriter` | lectura |
| `get_document` | `leer_documento_copywriter` | lectura |
| `create_document` | `crear_documento_copywriter` | acción (chat) |
| `append_to_document` | `agregar_al_documento_copywriter` | acción (chat) |
| `update_document` | `cambiar_documento_copywriter` | acción (pantalla) |
| `delete_document` | `papelera_documento_copywriter` (+ `restaurar_documento_copywriter`) | acción (chat), reversible |

Lo que escribe con IA (escribir un guion entero) NO va por la API en esta versión: lo hace el chat de la tab, que muestra
la propuesta antes de aceptarla.

## Qué queda para después

- La búsqueda web con fuentes de mila.
- Varias personas editando a la vez (Notion lo tiene; no hay presencia en la casa).
- Versiones guardadas (hoy: deshacer, y la foto de «antes de la IA» mientras hay una propuesta).
