# Hallazgos — Plantillas en toda la app (propias, compartidas, con ranking, y las reales de Create)

**Vive en:** `lib/plantillas-propias-reglas.ts`, `lib/plantillas-propias.ts`, `lib/creaciones.ts`,
`lib/creaciones-reglas.ts`, `lib/creaciones-enchufes.ts`, `lib/creaciones-guion.ts`, `lib/creaciones-diseno.ts`,
`app/creaciones/` (galería, ranking, `PublicarCreacion`, `usePlantillasPropias`, `plantillas-tarjeta.ts`),
`supabase/migrations/0407_plantillas_propias.sql`, `lib/offer-plantillas.ts`, `lib/ai-avatar/plantillas-venta.ts`,
`lib/editor-video/plantillas-ejemplos.ts`, `lib/image-editor/plantillas-reales.ts`.

Los pedidos, textuales:
- Leila (30/10/2026): plantillas propias, que se guarden para su negocio o se compartan con la comunidad, con estrellas.
- Martín (13/10/2026, las estrellas): «para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles».
- Martín (29/10/2026, Create): «Los templates tienen que ser reales…» y «Poné la estructura, la misma, y en algún lado un
  botón de "ver ejemplo"».

El plan de las plantillas reales: [plantillas-reales/README.md](plantillas-reales/README.md). Lo de las estrellas, antes
de esto: [hallazgos-creaciones.md](hallazgos-creaciones.md).

## Una plantilla propia ES una creación privada, no una tabla nueva (6/11/2026)

La tentación era una tabla `plantillas_propias` por tab. Ya existía el mecanismo de las estrellas (`creaciones`, mig 0273)
con su enchufe por tipo, y «compartir con la comunidad» es exactamente «publicar». Se sumó un estado: `privada` (mig
0407). Una privada la ve y la usa sólo su negocio (`puedeVer`, `puedeUsar`), no recibe estrellas y lleva la definición TAL
CUAL (sus precios y sus links son lo que la hace útil). La galería, el ranking y la API son los de siempre.

- **Compartir una privada NO la convierte: crea su copia pública** (`compartirCreacion`). Convertirla le borraba al negocio
  su versión con sus datos, que es la que usa.
- **Sin la 0407, la privada choca con el check de la 0273** (23514): se dice «Falta la migración 0407» y compartir sigue
  andando. El nombre del check lo puso Postgres (`creaciones_estado_check`) porque el de la 0273 es inline.

## Lo público nunca lleva datos del negocio: dos capas, y la foto va antes que el texto

`definicionParaTodos` (lib/plantillas-propias-reglas.ts) en un paso: lo que NO es texto afuera (el `paraPublico` del
enchufe), cada texto limpio (`limpiarTextos`: nombre del negocio, su gente, emails, teléfonos, links, @ y precios pasan a
`[DATO: …]`) y la red (`fugasDe`): si queda algo, el server no comparte y lo dice. Probado con centinelas de un negocio
inventado y rompiendo cada capa (tests/plantillas-propias*.test.ts).

- **Una FOTO no es un texto para la limpieza: es un link al storage del negocio.** Sin el paso del enchufe, la limpieza la
  dejaba como `src: "[DATO: link]"`: «limpia» para la red y rota para el editor. Por eso cada foto del diseño pasa ANTES a
  un marco vacío del mismo tamaño (con su escala aplicada) y un fondo con foto a blanco (`disenoParaPublico`). El test
  pregunta por el `src`, no por el link.
- **El negocio se nombra corto.** «Estudio Brújula Norte» aparece como «Brújula Norte» en el título de una página: se
  buscan también la forma sin la palabra genérica de adelante ni la forma legal de atrás, si queda algo de 2 palabras o 6
  letras («Dental» suelto no es el negocio).
- **El título y la descripción de una pública también se limpian:** el título nace del nombre de la cosa, que suele traer el
  del negocio. La FIRMA no: es lo que quien comparte eligió mostrar.
- **Lo que parece un teléfono y no es:** dos años («2024-2025») y una fecha («2026-11-06») tienen 8 dígitos con guiones.
- ⚠️ **«soles» (la moneda) es voseo para el guard** (la forma de «soler»): en una regex va `s[o]les`.

## «Guardar como plantilla» existía en el Web Generator: era falso

El pedido lo daba por hecho. `app/web-generator/editor/MenuDocumento.tsx` dice en su cabecera que NO lo ofrece a propósito
(Gamma lo tiene con su infraestructura; acá sería un ítem que no hace nada). Lo que sí había: las plantillas de TARJETA del
CRM, el Plan y Clients (por persona, en `usuarios.perfil`), que son otra cosa y no se tocaron.

## Los enchufes de hoy, y por qué Video no

- `guion`: una página del Copywriter (server: `app_settings`). Para compartir se sacan los links (la marca `link`).
- `formato_imagen`: un diseño del Image Editor (`image_disenos`). Para compartir, las fotos a marcos vacíos. El id del tipo
  no cambió (ya estaba en filas); su título pasó a «Diseños».
- `formato_video` queda en `POR_ENCHUFAR` con el dueño «Video Editor»: el proyecto vive en el NAVEGADOR (IndexedDB) y el
  server sólo tiene una copia para leer, sin los archivos. Su enchufe necesita que el editor arme la plantilla.

## El ranking cuenta las estrellas que SIGUEN puestas

`rankear` (lib/creaciones-reglas.ts): en la semana o el mes manda lo recibido en ese período (`creacion_estrellas.created_at`),
y lo que no recibió ninguna no entra (un ranking de la semana con ceros es la galería con otro nombre). Los empates comparten
el puesto. ⚠️ Sacar una estrella BORRA su fila y volver a darla le pone fecha nueva: el período cuenta las que siguen, no un
historial. Las de la semana se cuentan en memoria de a páginas (`leerPorPaginas`): el techo de 1000 de PostgREST no avisa.

## Las plantillas reales: la estructura en la tarjeta, el ejemplo aparte

Los documentos de docs/plantillas-reales/ (29/10) dicen que la pieza nace con el ejemplo lleno. Esa misma tarde Martín lo
cambió en el Copywriter («la estructura, la misma, y un botón de "ver ejemplo"») y es la regla de todas las tabs. Lo que eso
cambia al implementar:

- **La cinta «Ejemplo» y el botón «Ver ejemplo» van en la MISMA esquina** de la tarjeta (`crear.css`): una tarjeta con
  `verEjemplo` no lleva `ejemplo`.
- **Offer arranca la conversación con la forma dicha en el primer mensaje** (`mensajeDePlantilla`), no con un slot nuevo
  en un prompt: un slot nuevo no llega a un prompt que alguien ya editó en /configuraciones.
- **Image: 3 de las 12 ya existían** como tipos de carrusel (`lista`, `mito`, `caso`, con los mismos negocios): no se
  duplicaron.
- **Video no tocó el catálogo del editor** (lo trabaja su chat): el ejemplo se ajustó a los huecos de hoy y lo que no entró
  quedó escrito en la cabecera de lib/editor-video/plantillas-ejemplos.ts. El diálogo de «Ver ejemplo» no carga el motor.
- **Image no mostraba nada propio de la plantilla en la tarjeta:** la miniatura de un diseño se dibuja en SVG desde el
  MISMO documento que se crea (`MiniaturaDiseno`), sin el motor de Fabric (no viaja a la portada). Sin pedir las fuentes, un
  «Anton 260» cae a la del sistema y el texto se sale del marco: la miniatura las pide al catálogo del editor
  (`mako/fuentes.ts`) y las suma a `document.fonts` una vez por familia y peso.
- **Image: las 10 de Doory salieron de «Nuevo diseño», no del repo.** Bodas, conciertos y currículums no le sirven a un
  negocio; borrarlas toca el panel del editor y la API, que trabaja otro chat (relevo). **Hecho el 6/11/2026** (encargos
  155 y 548): tocó siete archivos de test, y los dos que este documento nombraba ya estaban adaptados — el detalle y las
  reglas, en [hallazgos-editor-imagen.md](hallazgos-editor-imagen.md), «Sacar las de Doory tocó SIETE archivos de test».
- **AI Avatar:** los 5 presets nuevos entran a la galería al final de `PLANTILLAS_AVATAR`, desde su módulo (import de valor
  en una dirección, de tipo en la otra: sin ciclo en runtime).
- **Un bug que quedó sin arreglar en Offer:** `precioDe` no lee «USD 1,200 al mes» (devuelve null, y `nivelDeOferta` con
  él). Los ejemplos se escribieron «USD 1,200 mensuales»; un dueño que escriba «al mes» lo va a sufrir.

## Las trampas del entorno (la nube)

- **`node scripts/tsc-acotado.mjs` en la nube contesta «NO SE PUDO CHEQUEAR (código undefined)»**: el `tsc` muere por
  memoria con el tope de 2560. Con `--heap=5120` corre. No es un verde ni un rojo.
- **Con el Node 22 de la nube**, tests/ops-center-clasificador-app.test.ts falla al cargar («does not provide an export
  named MAKO_ACCION_TOOLS»); con el Node 24 de Actions da 48/0. Es el rojo de mentira que AGENTS.md ya avisa.
- **Un guard puede leer el nombre de una prop como otra cosa:** tests/image-editor-chat.test.ts (24) prohíbe `onCerrar` en
  ImageEditorCliente (es contra un chat que se cierre); el modal de «Guardar como plantilla» va por `ModalGuardarPlantilla`
  con `alSalir`.
- **Un `acá` en un archivo NUEVO pasa el guard de voseo hasta el `git add -N`** (lee `git ls-files`).
- **El Chromium de la nube no baja nada de jsDelivr** (403 del proxy): para mirar una miniatura con sus fuentes de verdad,
  los `.woff2` salen de los paquetes `@fontsource/*` del registro de npm, que sí se alcanza.
- **La migración nació 0404 y `main` tomó la 0404 mientras se trabajaba** (`0404_carruseles_laminas_cta`); la 0405 la tenía
  `punta/thiago-migrar`, y la 0406 la tomó otra rama una hora después (`0406_calendario_email_enlazado`). Quedó 0407,
  barriendo `refs/remotes/origin/*` y no sólo main, justo antes de subir. Desde la nube no hay Cerebro a quien pedirle el
  número: el que la aplique lo confirma antes.
- **El veredicto dio rojo por un TEST, no por el código:** `assert.ok(!('meta' in d.doc))` estrecha el tipo a `never` y la
  línea siguiente no compila (TS2339). El acotado lo caza; no se había corrido sobre los archivos de test. Al cerrar una
  tanda, el acotado va sobre los tests nuevos también.
- **Una operación nueva al final de un área choca con los tests que fijan la cola de esa área** (knowledge-modulos y
  sumar-documento-second-brain para `negocio`, doer-recetas-video-imagen para `video`): se suma a su lista, como piden.
- **El motor guarda la fuente como pila CSS** (`"Anton", sans-serif`): buscarla por nombre en el catálogo da «no está»
  siempre. `familiaPrincipal` toma la primera; tests/image-plantillas-reales-crear.test.ts (3b) lo fija.

## Lo que quedó sin hacer

- **Plantillas propias:** los enchufes de Video (necesita al editor), Offer, AI Avatar, Web Generator y Dashboard; «Tus
  plantillas» en el teléfono (hoy sólo en la computadora); el ítem en la barra de /creaciones.
- **El super admin** (app/admin, lo rehace otro chat): una vista para moderar lo publicado (retirar ya existe en el server,
  `puedeRetirar` con la plataforma) y sembrar las «de MaKo». Detalle en docs/relevo/nube-plantillas.md.
- **Offer:** el experto `offer.experto`, «Ver ejemplo» adentro de la conversación y el teléfono (`app/m/offer`).
- **Video:** los 6 templates nuevos, retirar dos, los clips de Pexels y la miniatura dibujada (chat de Video).
- **AI Avatar:** el Director (AV-3), los retratos, pósters y loops, y la guarda de `crearVideoAction` con las marcas.
- **Image:** las fotos de muestra del ejemplo y las preguntas al crear (docs/relevo/nube-plantillas.md). Borrar las 10
  de Doory del editor y la API se hizo el 6/11/2026; el bloque «creado» del chat quedó sin miniatura (eran las únicas
  con WebP) y el panel «Diseño» quedó vacío a propósito, esperando las plantillas propias.
- **La migración 0407, sin aplicar.**
