# Copywriter — diseño (28/10/2026)

> **El pedido de Martín (28/10/2026), textual:** «Quiero que implementes mila.gg combinado con notion en "copywriter" y que
> allí se puedan crear los guiones de ads, de reels, de stories, de youtube... Que tenga una interfaz similar a la de web
> generator, con la sidebar de mako y el editor a la derecha».

Una tab nueva, **Copywriter** (`/copywriter`), adentro del grupo Copywriting. Un DOCUMENTO por guion, como una página de
Notion; MaKo al costado, como en mila.gg, escribiendo EN el documento. La ve sólo el super admin hasta que Martín la valide.

> **29/10/2026, «Copywriter = Notion» (D11–D14).** Martín, textual: «quiero que trabajes en "Copywriter", quiero que sea una
> réplica de Notion, busca inspiraciones de la web o un repo que sea copia, y replícalo. Quiero que tenga la barra lateral de
> MaKo para que se pueda pedir cosas por allí y NO quiero otras tabs internas que hoy aparecen en la topbar ni nada de
> ONBOARDING». Desde ahí: la tab **Copywriting** de todos los negocios ES el Copywriter (sin tabs internas, sin onboarding),
> el cuerpo de cada página es **BlockNote**, «Nueva» abre los **templates** y lo que había se **muda** a páginas.

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
  **Cerrado el 29/10/2026 (D16):** `youtube-retencion` (Gancho → Intro → Bloques → CTA medio → Regancho → Cierre), de
  claude-youtube (MIT, aviso en lib/avisos/LICENSE-CLAUDE-YOUTUBE), sin sus metas numéricas.
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

## D11 · El editor es BlockNote, la copia de Notion (29/10/2026)

Se buscó la mejor base open source de un editor tipo Notion en React (29/10/2026, el registro de npm y los repos):

| Base | Versión y fecha | Licencia | Motor | Por qué sí o por qué no |
|---|---|---|---|---|
| **BlockNote** (TypeCellOS/BlockNote) | 0.56.0, 14/10/2026 | **MPL-2.0** el núcleo (core, react, mantine); los paquetes **XL son GPL-3.0** (y comerciales) | TipTap 3 / ProseMirror | **Elegida.** Es la copia de Notion: el «+» y el asa ⋮⋮ en el margen, arrastrar bloques, el «/» que filtra, la barra al seleccionar, Tab para anidar, listas, desplegables, tablas, y el diccionario en español. Usa la MISMA TipTap 3 que ya tiene la casa (3.31). |
| Novel (steven-tey/novel) | 1.0.2, 18/01/2025 | Apache-2.0 | TipTap **2** | Parado desde enero de 2025 y en TipTap 2 (chocaría con la 3 de la casa). |
| Plate (udecode/plate) | 53.3.18, 18/10/2026 | MIT | Slate | Muy completo, pero es un armador de piezas (shadcn) y otro motor: dos editores distintos en la casa. |
| Docmost | — | **AGPL-3.0** | TipTap | No: AGPL dentro del producto. |
| Outline | — | BSL 1.1 | ProseMirror | No: no es open source para un producto. |

⚠️ **La licencia.** MPL-2.0 es copyleft POR ARCHIVO: usar los paquetes sin cambiarlos no obliga a nada con el código de
MaKo; si algún día se modifica un archivo de BlockNote, ESE archivo se publica. Los paquetes XL (`@blocknote/xl-*`, la IA
de BlockNote, exportar a .docx/.pdf) son GPL y NO se instalan: la IA es la de MaKo. Las dependencias nuevas que trae
(Mantine 8.3.18, @floating-ui/react, emoji-mart, react-number-format…) son MIT.

- **Lo que se guarda NO cambió:** el JSON de ProseMirror de D3 (`bid` por bloque, el saneo, las secciones, las operaciones
  de MaKo, la API). `lib/copywriter/notion-bloques.ts` traduce en los dos sentidos: `aBloques` (lo guardado → BlockNote,
  una lista son N ítems, cada uno con su id) y `deBloques` (BlockNote → lo guardado: los ítems seguidos del mismo tipo son
  UNA lista con el `bid` del primero; lo que el formato no anida, como un párrafo con hijos, sale a continuación). Un id de
  BlockNote (uuid) da SIEMPRE el mismo `bid` (`bidDe`): MaKo apunta por id. La sección del guion (`attrs.seccion` de un
  Título 2) viaja aparte, en un mapa id → etiqueta. Lo fija tests/copywriter-notion.test.ts (ida y vuelta de todos los
  bloques, un punto fijo).
- **El esquema del editor es EXACTAMENTE lo que se guarda** (`app/copywriter/editor/esquema.tsx`): Texto, Encabezados 1-3,
  las tres listas, Lista desplegable (también anidada: el saneo ya no la tira), Cita, Divisor, Tabla con fila de encabezado,
  y el «Texto destacado» propio (`createReactBlockSpec`, el molde del Alert de BlockNote). Sin imágenes, código,
  encabezados 4-6, encabezados desplegables, colores ni alineación: lo que se ofrece y no se guarda se pierde al recargar.
- **El «/»** es el catálogo de `app/copywriter/editor/bloques.ts` (los nombres y descripciones de Notion en español, más
  «Secciones del guion» y «Pedirle a MaKo»); cada bloque básico usa la acción y el ícono de BlockNote. **La barra de la
  selección**: Convertir en · negrita, cursiva, subrayado, tachado, código · enlace · **«Preguntar a MaKo»** (el «Ask AI» de
  Notion: lo seleccionado entra como cita en la caja del chat y el selector pasa a «Editar»). **El asa**: Eliminar ·
  Duplicar (y «Fila de encabezado» en una tabla). En el teléfono no hay asa (no hay cursor que pase por el margen).
- **Los colores** son los de la casa: el tema de BlockNote apunta a los tokens (`var(--ink)`…), así el oscuro sale solo.
  Los estilos de Mantine que trae `@blocknote/mantine/style.css` son sólo de sus componentes (sin el «baseline» global).
- **MaKo escribe por `DocVivo`** (`app/copywriter/editor/propuesta.ts`): leer y poner el documento guardado, sin conocer al
  editor. Lo que pone va fuera del historial (`addToHistory: false`) y no se manda a guardar como un cambio de la persona;
  aceptar es la foto de antes + el resultado en UN paso de deshacer. Las marcas de la propuesta son CSS por id de bloque.

## D12 · «Nueva»: los templates de «¿Qué vas a crear hoy?» (29/10/2026)

- **Cada documento es una página.** A los cuatro tipos de guion se suman `vsl`, `email`, `post` y `pagina` (al final de
  `TIPOS_GUION`). Los tipos con método (`TIPOS_CON_METODO`: ad, reel, story, youtube, vsl) muestran Ángulo, Estructura y
  Duración; un email, un post o una página en blanco sólo el Tipo (Notion no muestra propiedades en una página suelta).
- **«Nueva»** (arriba de la barra de páginas; en el teléfono, el botón de abajo) abre `/copywriter?nueva`: «¿Qué vas a crear
  hoy?», la caja de MaKo (lo escrito es el primer pedido en la página nueva) y los templates en tarjetas por grupo
  (`lib/copywriter/plantillas.ts`). El «+» de una página crea una subpágina en blanco, como Notion.
- **Ningún template se inventó** (la fuente de cada uno, en la cabecera de plantillas.ts): Guion de anuncio (la estructura
  de Ad por defecto), Copy de anuncio (los textos del Media Buyer: texto principal, título, botón y link), Guion de Reel (la
  tab Reels del Editor que se retira: gancho con frase/título/visual, escenas con locución y cámara, moraleja, CTA con
  palabra clave y caption), Stories del día (story-dia y los frames de `PiezaStory`), Post en carrusel (`PiezaCarrusel`),
  Email (el broadcast de Email Marketing: asunto, vista previa, cuerpo, botón), un VSL por estructura de
  `lib/vsl-estructuras.ts`, Guion de YouTube (sin estructura, D6) y Página en blanco.
- **Los VSL** entran a la biblioteca del Copywriter con `conVsl` (lib/copywriter/catalogos.ts) sin escribirse en el override
  del super admin: la página VSL tiene su selector y MaKo su guía.

## D13 · Sin tabs internas, sin onboarding, abierto a todos (29/10/2026)

- **nav.ts:** la fila Copywriting tiene la key de su pantalla (`copywriter`), lleva a `/copywriter` y NO tiene `secciones`.
  Ads Writer, Stories y YouTube Writer dejan la barra con su key viva en `SIN_FILA` (las piden sus rutas, la API y las
  capas). El método de redacción y la biblioteca de guiones siguen en el menú del super admin (ADMIN_NAV).
- **La puerta se abrió:** `veCopywriter` es toda persona con sesión (el rol y la capa los mira la tab) y la API también
  (`veCopywriterEnApi`). Si hubiera que volver a cerrarlo, son esas dos funciones.
- **Sin onboarding:** `/copywriter` no tiene puerta de onboarding; el template es el arranque. `/stories` redirige a
  `/copywriter?nuevo=story` y `/youtube-writer` a `?nuevo=youtube` (ya lo hacía). El Ads Writer sigue andando por su ruta
  (la matriz, «Analizar guion» con Meta y los links de MaKo): deja la barra, no se borra.
- **El teléfono:** la fila Copywriting abre `/m/copywriter` (key `copywriter`); `/ads-writer` sigue yendo a su pantalla
  del teléfono con su `?tab=`.
- **La API de MaKo:** `listar_plantillas_copywriter`, `plantillaId` al crear, y `editar_documento_copywriter`: MaKo escribe
  EN la página con IA («mejora el gancho», «agrega una sección»), con las MISMAS herramientas del chat; se prepara con la IA
  (la propuesta va en el resumen) y al confirmar se aplica sobre lo de AHORA, por id.

## D14 · La mudanza de lo que ya había (29/10/2026)

- La primera vez que un negocio abre el Copywriter (escritorio o teléfono), `mudarLoDeAntes` (lib/copywriter/mudanza.ts)
  COPIA a páginas: cada guion del Ads Writer (`mako.razones`) como una página de Ad debajo de «Guiones del Ads Writer», con
  su ángulo y su estructura si siguen en la biblioteca y el texto partido en secciones por sus etiquetas; y cada pieza del
  historial de Reels (`reels.historial`) como una página de Reel debajo de «Reels», con el template del Reel lleno. Lo
  original queda donde estaba.
- UNA vez por negocio: la marca `mako.copywriter.mudanza` se toma por compare-and-set ANTES de escribir (dos pestañas no
  mudan dos veces) y vence a los 10 minutos si quedó «en curso». «No pude leer» no es «no hay»: si una lectura falla, la
  próxima apertura lo vuelve a intentar. Nunca frena la pantalla. Tope: 300 páginas y el lugar que deja el índice.
- Las páginas se crean con `crearVarias` (lib/copywriter/server.ts): cada documento con su compare-and-set, de a 6, y el
  índice en UNA escritura.
- **Se puede cortar y repetir** (verificación del Cerebro de 544991179, C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md):
  - cada página tiene el id de su origen (`idDeMudanza`: el negocio, la celda y el guion, o el Reel). `crearVarias`
    saltea lo que ya está en el índice, adopta el documento de una corrida cortada y no borra nada si el índice falla;
  - la marca queda «hecha» sólo si no faltó nada (un documento que no se escribió, una hija sin su padre): si no, vence a
    los 10 minutos y la próxima apertura muda lo que faltó. Lo que el árbol no acepta (el tope, un padre en la Papelera)
    no se reintenta;
  - los Reels van primero (no tienen otra pantalla), y el lugar se cuenta sin lo ya mudado: el reintento elige las
    mismas páginas que la primera corrida;
  - la celda de antes del multi-guion (sólo `guion`) se muda como «General», como la muestra la matriz.
  - tests/copywriter-mudanza.test.ts corre la mudanza real con cortes en cada pedido.

## D15 · El shell único de Create (29/10/2026)

El chat «Create: un solo diseño» armó UNA pantalla para todas las tabs de Create (`app/_crear/PantallaCrear.tsx`, rama
create-shell-2910, mergeada acá en 2b62724ea): la tarjeta izquierda de la casa (la del Web Generator), siempre abierta.
El Copywriter la usa así (app/copywriter/Copywriter.tsx), y reemplaza al armazón de D2 (MaKo · árbol · página):
- `chat` = PanelMaKo, el chat que edita la página abierta, con la «←» del shell en su cabecera (`volver`).
- La «←» da vuelta la tarjeta a la LISTA de páginas: «Nueva página» primero, las páginas en el orden del árbol (las
  subpáginas debajo de la suya, con «↳»), su ⋯ (Agregar una página adentro · Mover a la Papelera) y la Papelera al pie.
- «Nueva página» (o `?nueva`, o `?nuevo=<tipo>`) muestra «¿Qué vas a crear hoy?» con la caja de la casa y los templates de
  D12 (sin la grilla agrupada de antes: la tarjeta del shell, con el marco del formato de cada tipo). Lo escrito en la caja
  crea una página en blanco que MaKo escribe (`onPedido`).
- La página va a la derecha (`children`), dentro de `<Pagina style={ESTILO_PAGINA_CREAR}>` como Video y Offer.
- ⚠️ **Lo que se perdió del árbol de Notion:** arrastrar para reordenar y anidar (la lista del shell es plana). Las migas de
  la página siguen navegando el árbol, y una subpágina se crea desde el ⋯.
- **Las herramientas del super admin** (el método de redacción, /admin/copywriting, y las bibliotecas de ángulos y
  estructuras, /admin/guiones) fueron pestañas de Copywriting y, por unas horas, dos links al pie de la lista.
  **29/10/2026, Martín: sin ninguna mención** («Elimina esto […], no quiero ninguna mención en todo MaKo»): ni fila, ni
  link, ni título, ni pantalla del teléfono. Las dos rutas de la computadora redirigen a /copywriter y la del teléfono se
  borró (como /m/reels). Lo que la IA lee de ellas sigue
  igual, con los overrides ya guardados: la metodología y el swipe (lib/copywriting-metodo.ts) y los ángulos y las
  estructuras (lib/guion-angulos-store.ts, lib/guion-estructuras-store.ts). tests/barra-sin-dev.test.ts (el 5) barre
  app/, lib/ y components/ para que el nombre no vuelva.
- **El teléfono:** `?nuevo=<tipo>` viaja a /m/copywriter (lib/movil-creacion.ts) y abre la hoja de templates con los de
  ese tipo primero, como en la computadora. YouTube Writer sigue «pronto» en el teléfono (key con `comingSoon`), como
  /ideas: retirarlos va con /m/stories.

## D16 · Plantillas con ejemplo y el experto (29/10/2026)

Martín: «Los templates tienen que ser reales… deben ser ejemplos reales» y «agentes expertos en guiones de ads, de
YouTube… así MaKo al entrar te da el template y te puede ir ayudando a crearlo». El plan entero:
[plantillas-reales/copywriter.md](plantillas-reales/copywriter.md).
- **12 plantillas con un ejemplo completo** de un negocio ficticio del elenco (lib/copywriter/plantillas-ejemplos.ts,
  leído por `docDeEjemplo`), más «Página en blanco». `contenido()` es el ejemplo y `esqueleto()` sus secciones vacías.
  Las tres VSL sin ejemplo salen de la galería (`visible: false`) y siguen resolviendo por id.
- **La API de MaKo y «Solo la estructura» usan el esqueleto**: un agente externo nunca deja el negocio ficticio.
  `listar_plantillas_copywriter` muestra el ejemplo como texto, marcado ficticio.
- **Cada plantilla fija su estructura** (`pas`, `gancho-historia-cta`, `reel-viral`, `story-dia`, las VSL,
  `youtube-retencion`): si el super admin la cambió, la página nace con el ejemplo y sin estructura.
- **La página recuerda su plantilla** (`props.plantilla`, sólo las que traen ejemplo). Con ella:
  - el primer mensaje de MaKo es LOCAL («Es un ejemplo de <negocio>, un negocio ficticio. ¿Lo adapto a tu negocio?»),
    con «Adaptar a mi negocio» y «Solo la estructura»;
  - una franja en la página dice cuánto queda del ejemplo y cuántos `[DATO:` faltan, y «Copiar el texto» lo avisa.
- **El experto** (`copywriter.experto`, lib/copywriter/experto.ts): el método de un director de respuesta directa
  (marketingskills, Profound y claude-youtube, MIT), antepuesto a REGLA_NO_EXISTE en «Discutir» y en «Editar».
  **«Adaptar»** es `editar` con `copywriter.adaptar.user`: pregunta como máximo tres datos que el negocio no tiene, de a
  uno, y después reescribe la pieza entera como propuesta, con `[DATO: …]` donde falte. Keys nuevas: ningún slot nuevo
  en los prompts de antes.
- **MaKo escribe tablas** (el bloque `tabla` de las operaciones): sin eso, adaptar el Reel, las Stories, el Carrusel o
  los Ganchos las volvía párrafos.
- **Falta** (hallazgos-copywriter, «Qué quedó»): los evals del experto. (La tarjeta con el extracto y los chips: D17.)
- **Cambiado el 29/10/2026 (D17):** la página ya no nace con el ejemplo, y el primer mensaje y sus dos botones se fueron.

## D17 · La página nace con la estructura; el ejemplo se ve aparte y MaKo pregunta (29/10/2026)

Martín: «al crear un template ya te crea un guion de ejemplo; eso es confuso porque el usuario piensa que es el guion que
MaKo le creó para su negocio. Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"… Y automáticamente,
cuando se crea un copy, MaKo le pregunta: "¿cuál es el objetivo de esto? ¿quieres que lo adapte?"». Y: «las miniaturas de
todos los templates reflejen de manera visual y fácilmente lo que estoy a punto de crear. No pueden haber miniaturas en
blanco».
- **La página nace con el esqueleto** (`plantilla.esqueleto()`): las secciones del ejemplo y, debajo de cada título, una
  guía corta en itálica (lib/copywriter/plantillas-guias.ts, `GUIAS`). Lo mismo en el teléfono (ListaGuionesM).
- **«Ver ejemplo»** está en la franja de la página (EditorGuion): abre el ejemplo en un Modal que dice «Negocio
  ficticio», de solo lectura. Al documento entra sólo con «Usar como base», en un paso de deshacer y con «Deshacer» en el
  aviso. «Adaptar con MaKo» y «Solo la estructura» se fueron de la página y del chat.
- **MaKo toma la iniciativa** (lib/copywriter/iniciativa.ts, PanelMaKo): con el chat vacío, «¿Para qué es este guion?»
  (los `OBJETIVOS` de la plantilla, o lo que escriba) y «¿Lo adapto a tu oferta? ¿A cuál?» (las ofertas activas del
  negocio, la principal primero, hasta 4; sin ofertas, «¿Lo adapto a tu negocio?»), siempre con «No, lo escribo yo». Las
  preguntas se arman sin IA; la última respuesta pide «adaptar» con «Es para: … Adáptalo a mi oferta «…».». En el
  teléfono, la página recién creada abre en la vista de MaKo (`?mako`).
- **La IA recibe el ejemplo aparte**: como la página ya no lo trae, va dentro del slot `estructura` de
  `copywriter.adaptar.user`, marcado «sólo la forma, ningún dato» (ningún slot nuevo).
- **Las tarjetas** llevan el gancho real del ejemplo (`extractoDe`), las secciones (`chipsDe`), la insignia, el grupo, la
  cinta «Ejemplo» y la descripción como `title`. «Página en blanco» muestra su descripción: ninguna queda vacía.
- **Para mudar al patrón común**: los pasos son datos (`PasoIniciativa`: pregunta, botones, si acepta texto) y el pedido
  sale de una función de las respuestas. La pantalla sólo dibuja pasos.


## D18 · Los outliers de copy: la portada «Encuentra tu siguiente OUTLIER» (11/11/2026)

Martín (11/11/2026, por el Cerebro): «lo mismo que te acabo de decir con web generator, aplícalo para copywriting, me gustaría
traer outliers. Tenemos la transcripción de un montón de cosas, tanto de anuncios como de carruseles, como de reels, y videos de
YouTube… podríamos mantener templates con ciertas estructuras, pero también traer los outliers».

**La referencia es UNA: la portada de outliers de Image** (`app/image-editor/carruseles/ExplorarCarruseles.tsx`, que copia a Top
Carousels), la misma que copió Video (`app/video-editor/OutliersVideo.tsx`). Con SUS clases (`explorar.module.css`):
- la cabecera «Encuentra tu siguiente OUTLIER» con sus botones;
- la fila de filtros, con el segmento y el orden;
- la grilla;
- la tarjeta de Image tal cual: la imagen arriba, y abajo el «×», el gancho, la cuenta, hace cuánto y los números. «Replicar» va
  donde Image pone «Editar»;
- el modal abierto de Image (`CarruselAbierto`): a la izquierda el TEXTO del original (lo que en Image son las láminas), a la
  derecha el panel con el múltiplo, «Replicar» grande y «Ver original».

Nada que la referencia no tenga.

| Ruta | Qué muestra |
|---|---|
| `/copywriter` | la portada de outliers (como `/image-editor` y `/video-editor`) |
| `/copywriter?nueva` (o `?nuevo=<tipo>`) | «Crear desde cero»: las plantillas de siempre (D16-D17), que QUEDAN |
| `/copywriter?ver=guiones` | «Mis guiones»: la última página tocada (lo que antes hacía `/copywriter`) |
| `/m/copywriter` | la misma portada en el teléfono; `?ver=guiones` es la lista de siempre |

**De dónde salen** (fuentes enchufables, el contrato de Video: `lib/copywriter/outliers.ts`, puro, y `outliers-servidor.ts`).
Lo que se midió en producción el 11/11 (el ws 3):

| Fuente | Qué texto trae | Su número |
|---|---|---|
| Competitors Spy: reels, publicaciones y videos de YouTube de las cuentas que sigue el negocio (`spy_piezas`) | el pie o la descripción; el guion, si ya se transcribió al abrir su detalle en Spy (`spy.transcripcion.*`) | el «×» de toda la app (`multiplosDe`); YouTube no tiene (falta la enmienda) |
| Competitors Spy: anuncios (`canal = 'anuncios'`) | el copy del anuncio (texto y título) | días al aire |
| La biblioteca de carruseles de la plataforma (`carruseles_biblioteca_piezas`, para todos) | el pie | el «×» de su cuenta |

⚠️ **Lo que NO hay**, y no se promete:
- No hay transcripción masiva. En el ws 3 hay 0 guiones de Spy, y en toda la base, 11 (todos de otro negocio).
- Las láminas de un carrusel no tienen su texto guardado (sólo las imágenes).
- Los videos de Thumbnails no tienen descripción ni transcripción.

La tarjeta dice qué texto es (el pie, el guion, la descripción o el copy del anuncio). La primera tanda no transcribe nada nuevo.
Los anuncios propios (`ad_transcripts` + `script_analyses`, con su veredicto) son la fuente que sigue.

**Replicar** (`POST /api/copywriter`, `accion: 'replicar'`):
- se crea una página del tipo del original: anuncio → Ad, reel → Reel, carrusel → Post, YouTube → YouTube;
- la página guarda `props.outlier` (el id), que no se ve en las propiedades;
- el cuerpo arranca vacío: lo escribe MaKo, a la vista, como propuesta (D5);
- MaKo toma la iniciativa como con una plantilla (D17), con UNA pregunta con botones: «¿Lo replico para tu oferta? ¿Para cuál?»;
- la respuesta le pide escribirlo con la estructura, el tipo de gancho y el ritmo del original, con la oferta elegida;
- el original le llega a MaKo como una referencia `@` del server (`tipo: 'outlier'`, lib/copywriter/referencias.ts), en CADA
  pedido de esa página: no entra al documento, así MaKo no puede pisarlo;
- la barra de la página ofrece «Ver el original», como «Ver ejemplo» con una plantilla.

**API de MaKo**: `outliers_copywriter` (lectura) y `replicar_outlier_copywriter` (acción, chat).

## Qué queda para después

- Borrar lo que quedó sin entrada: StoriesApp/OnboardingStories (D13) y el Ads Writer del teléfono cuando Martín decida
  qué hacer con la matriz y «Analizar guion».

- «Compartir para editar» desde el teléfono del dueño (D9).
- La búsqueda web con fuentes de mila.
- Varias personas editando a la vez (Notion lo tiene; no hay presencia en la casa).
- Versiones guardadas (hoy: deshacer, y la foto de «antes de la IA» mientras hay una propuesta).
