// =============================================================================
// VSL Tracking — el registro de construcción del área
// =============================================================================
// Alcance: el Pixel de MaKo. El snippet que el cliente pega en SU landing
// (`lib/landing-token.ts`), el beacon público que recibe lo que ese snippet
// manda (`app/api/track/vsl` y `app/api/track/optin`), el probador que le
// demuestra al cliente que su página mide, la curva de retención por video
// (`lib/vsl-retencion.ts`), Clarity como capa opcional de grabaciones, y los
// crons que avisan cuando una landing quedó vieja o dejó de mandar.
//
// De dónde salió esto: los mensajes de commit de este repo son largos y explican
// el porqué — son la fuente principal de cada hito, junto con las trampas ya
// cosechadas en docs/hallazgos-landing.md (secciones «Tracking y beacon»,
// «Retención del VSL» y las de videos). Fecha, hora, sha y tamaño salen de
// `git log` sobre las rutas del `vive` del área; la cuenta, del trailer
// `Claude-Cuenta:` de cada commit. Los `pedido` son textuales y están citados
// dentro de los mensajes de commit — no hay ninguno inventado.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado. Y este
// área tiene mucho de eso: casi todo lo que se reportó como «no funciona» era en
// realidad «funciona y no hay forma de enterarse».

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El beacon público y el token', detalle: 'CORS abierto · fail-closed por token · responde 200 aunque descarte el evento, para no tumbar la página del cliente', estado: 'hecha' },
  { titulo: 'El snippet versionado (Pixel de MaKo)', detalle: 'El código queda CONGELADO el día que se pega · `sv` viaja en cada evento y el cron avisa qué se está perdiendo', estado: 'hecha' },
  { titulo: 'El probador de la landing', detalle: 'Elegí tu página → pegá el código → comprobá que mide · marcador de prueba tipo test_event_code + ventanita encima de la landing', estado: 'hecha' },
  { titulo: 'Un estado por VIDEO, no por página', detalle: 'El snippet medía UN video: el segundo no salía «mezclado», salía MAL · nombre, tipo y curva por video', estado: 'hecha' },
  { titulo: 'El embudo completo: clic, opt-in y AGENDÓ', detalle: 'Entre «vio» y «dejó sus datos» no había ningún punto · Calendly avisa por postMessage y eso sí se puede escuchar', estado: 'hecha' },
  { titulo: 'El ciclo de vida de la página', detalle: 'salió · volvió (con los segundos afuera) · cierre — distinguen la interrupción del abandono en un VSL de 23 minutos', estado: 'hecha' },
  { titulo: 'Clarity: grabaciones y mapas de calor', detalle: 'BYOK por workspace, dentro del MISMO snippet · identify por visitor_id · cron que cuida la cuota de 10 requests/día', estado: 'hecha' },
  { titulo: 'La curva de retención POR video', detalle: '`curvaRetencion` acepta `videoId` hace meses y nadie se lo pasa; el `exit` con el % exacto no lo consume ningún query', estado: 'sigue' },
  { titulo: 'El beacon acepta cualquier `landing_url`', detalle: 'Texto arbitrario de un desconocido que después decide qué baja el Landing Analyst y qué se paga en IA · falta exigir dominio del workspace', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 13-14 ago: el código que se pega, y la prueba de que anda ───────────────
  {
    fecha: '13 ago', hora: '21:06', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El código que se pega deja de ser mudo, y el probador deja de adivinar',
    puntos: [
      'La corrección de producto que abre el área: **si el opt-in necesita que alguien le pase un snippet por chat, la feature no existe**. La captura del formulario entra DENTRO del mismo código que /integraciones ya entrega con su token, y no en un segundo script — un segundo script es un script que la mitad no va a pegar. Se cuelga del submit en fase de captura y **nunca hace `preventDefault`**: la página del cliente sigue redirigiendo como siempre, y el envío va con `keepalive` para sobrevivir a la navegación.',
      '⚠️ **La trampa que gobierna todo lo demás del área: el snippet queda CONGELADO en el HTML del cliente el día que lo copia.** Mejorar el código no le llega nunca a quien ya lo tenía puesto, y **no hay ningún síntoma** — los eventos del código viejo siguen llegando, así que la integración queda en VERDE. Ya había costado 18 días de medición muerta sin que nadie se enterara. De ahí sale `SNIPPET_VERSION` viajando como `sv` en cada evento y `NOVEDADES`: el aviso dice **qué se está perdiendo**, no «actualizá», porque una tarea sin motivo no la hace nadie cuando lo que tiene puesto parece funcionar.',
      '⚠️ **Regresión propia, en producción, el mismo día.** Al meter la línea de la versión, una sustitución REEMPLAZÓ en vez de insertar y `var TOKEN = \'${token}\'` quedó como `var TOKEN = \'\'`: el snippet salía vacío el 100% de las veces, para todos los workspaces. Con el token vacío el beacon descarta fail-closed y el opt-in rechaza con 400 — quien copió el código en esas horas se llevó una landing que no medía ni capturaba nada. **Lo dejó pasar el test escrito en ESE MISMO commit**, que exigía que viajara la VERSIÓN y nunca que viajara el TOKEN. La regla que queda: lo que no se afirma es lo próximo que se rompe.',
      '**La versión se PREGUNTA, no se infiere.** El chequeo «el código es el nuevo» decidía por la AUSENCIA de `segundos` en los eventos: una landing sin video nunca manda segundos, así que le decía «tenés el código viejo» para siempre a alguien que lo tenía al día. Y con código viejo el probador ahora **no deja probar**: los chequeos nuevos van a fallar SIEMPRE porque ese código no manda esos eventos, y la persona sale creyendo que su landing está rota.',
    ],
    commits: [
      { sha: '8e41bed3', msg: 'landing: el snippet que la app entrega ya captura el formulario', lineas: 75, archivos: 3 },
      { sha: '562f8962', msg: 'landing: el snippet se versiona y MaKo avisa cuando quedó viejo', lineas: 132, archivos: 5 },
      { sha: '7b59ac95', msg: 'landing: arregla el token que rompí, y el aviso pasa a ser accionable', lineas: 175, archivos: 6 },
      { sha: 'bccefd70', msg: 'landing: la prueba verifica el formulario, y la versión deja de adivinarse', lineas: 71, archivos: 3 },
      { sha: '4e1f26d3', msg: 'landing: la prueba se corre sobre una página elegida, y no arranca con código viejo', lineas: 148, archivos: 4 },
    ],
    archivos: [
      'lib/landing-token.ts — el snippet, `SNIPPET_VERSION`, `NOVEDADES` y `snippetDesactualizado()`, que consumen el cron Y la pantalla (un solo lugar, a propósito)',
      'app/api/track/optin/route.ts — la puerta server-side del formulario',
      'app/integraciones/ProbarTracking.tsx — el panel de la prueba',
    ],
  },

  // ── 14 ago: un video no es «el» video, y una URL no es «la» página ──────────
  {
    fecha: '14 ago', hora: '12:14', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El estado del player era UNO para toda la página: el segundo video no salía mezclado, salía MAL',
    puntos: [
      'Arrancó como una pregunta de producto —«una landing puede tener muchos videos, ¿cuál es el VSL?»— y al abrir el snippet el problema era otro: `yaPlay`, `hitos`, `dur`, `pct` y `seg` eran **variables globales de la página**. Con dos videos eso no promedia dos mediciones, **rompe la segunda**: solo el PRIMER video mandaba `play`, el 25% del segundo se suprimía porque el primero ya había mandado `p25`, la duración la pisaba el último que reportara, y el `exit` era uno solo. Un VSL de 20 minutos al lado de un testimonio de 40 segundos medía el testimonio como si durara 20 minutos.',
      '⚠️ **El síntoma era «la retención da raro», que no apunta a ningún lado.** Por eso el test nuevo afirma la ESTRUCTURA —que nada mutable del player viva fuera del estado por video— y no un caso: un contraejemplo pide una landing con dos players reales, y para cuando se arma, el dato ya salió mal.',
      '**Un umbral pensado para un VSL de 20 minutos aplicado a uno de 10 segundos mide exactamente cero.** El primer escalón de la escalera de avance era 15 s, así que un video corto —de los que más se miran enteros— no marcaba NUNCA un avance y la pantalla decía «solo llega el arranque». Arranca en 3 s. Sigue siendo una escalera y no un tick por segundo: un evento por segundo son ~1.200 requests por persona en un VSL largo, para una curva que con estos puntos queda igual.',
      '⚠️ **La bomba que encontró el mapeo y no estaba buscando:** `durDe` en `lib/leads.ts` caía a «la única duración conocida» SIN CONDICIÓN. Con un video es correcto; con dos, le aplica al testimonio de 40 s la duración del VSL de 20 minutos, su avance da ~0% para siempre **y se ve idéntico a un porcentaje correcto**. La regla: un respaldo que asume «hay uno solo» tiene que CHEQUEAR que haya uno solo — si no se sabe de qué video es la duración, va `null` y la pantalla muestra «—», que es la verdad.',
      'Y el corolario en la ficha del lead: **un número correcto mal ATRIBUIDO es peor que ningún número.** «Vio el 80%» era el máximo sobre todos los videos y se leía como que casi terminó la oferta. Los eventos que no se pueden atribuir van a su propio balde («Video sin identificar»): descartarlos perdería mediciones reales, fundirlos contamina una curva sin que se note.',
    ],
    commits: [
      { sha: 'cad8ec38', msg: 'landing: la barra plegada vuelve a una linea, y la escalera mide videos cortos', lineas: 99, archivos: 4 },
      { sha: '67cc2882', msg: 'landing v5: el snippet medía UN video por página, no varios', lineas: 98, archivos: 2 },
      { sha: '0333a2ca', msg: 'videos: cada uno con su nombre, y la retencion separada en la ficha del lead', lineas: 900, archivos: 12 },
    ],
    archivos: [
      'lib/landing-token.ts — `est(id)`, `quien()`, `alSalir()`: el estado por video',
      'lib/leads.ts — `resolverDuracion`, `videosDe`, `getVslEngagement`',
      'lib/landing-videos.ts — nombre y tipo por video; el nombre ES la respuesta a «cuál es el VSL»',
      'app/crm/lead-view/ComportamientoCard.tsx — el desglose por video en la ficha',
    ],
  },
  {
    fecha: '14 ago', hora: '14:04', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Una página no es una URL: los previews de deploy repartían la retención entre siete renglones',
    puntos: [
      '**El síntoma («se guardan un montón de URLs iguales») apuntaba al guardado, y el guardado estaba bien:** no se estaba guardando ninguna, todas decían «detectada». Lo roto era CONTARLAS como distintas. Son los previews de deploy de Netlify —cada deploy recibe una URL inmutable con el id adelante— y el snippet mide en todas: publicando varias veces por día, siete renglones de la misma página **con la retención repartida entre los siete**, sin que nada lo dijera.',
      '⚠️ **El colapso es deliberadamente angosto y no se debe ampliar «por prolijidad»:** solo cuando el prefijo es inconfundiblemente un id de deploy (20+ hex). Los deploys por rama —`staging--sitio`, `preview--sitio`— SÍ son lugares distintos y fundirlos mezclaría producción con pruebas. Vercel arma sus previews con guiones simples, sin separador propio: ahí no se puede distinguir un preview de un proyecto que se llama así, y adivinar sería peor que dejarlos separados.',
      '**Y la decisión que NO era la obvia, un día después, con los previews del editor de Lovable:** un preview de deploy ES el sitio real, y por eso se colapsa. El del EDITOR no — ese tráfico es de quien está construyendo la página, así que fundirlo con producción habría metido sesiones de desarrollo adentro de la tasa de conversión: **cambiar un problema visible (renglones de más) por uno invisible (un número de negocio mal)**. Se excluye. Y la exclusión también es angosta: un cliente sin dominio propio publica de verdad en `<proyecto>.lovable.app`, y esa SÍ es su landing.',
      '**Un parámetro que habla de la VISITA no identifica una PÁGINA.** Los UTM, los click-ids, el marcador de prueba y los `__lovable_*` se sacan al normalizar. Lo que NO va en esa lista: uno que cambia el contenido (`?plan=pro`), porque borrarlo fundiría dos páginas distintas.',
    ],
    commits: [
      { sha: '37ec8683', msg: 'landing: editar/borrar en cada renglon, y las 7 URLs iguales eran previews de deploy', lineas: 187, archivos: 6 },
      { sha: '094c8d35', msg: 'Los previews del editor de Lovable se EXCLUYEN del desplegable, no se colapsan', lineas: 171, archivos: 6 },
    ],
    archivos: ['lib/landing-paginas.ts — `normalizarUrl`, `mismaPagina`, `esPreviewDeEditor`, `PARAMS_DE_MEDICION`'],
  },

  // ── 14 ago: el opt-in ──────────────────────────────────────────────────────
  {
    fecha: '14 ago', hora: '14:34', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Envié el formulario y no se registró, eso es gravísimo»',
    pedido: 'envie el formulario y no se registro, eso es gravisimo\n\nme marca con un check que todo esta bien, eso esta muy mal',
    puntos: [
      '⚠️ **El diagnóstico obvio era el exactamente contrario.** Se fue a la base de producción antes de tocar nada: había **OCHO propuestas de lead en `pendiente`** en el workspace de la clienta, cuatro de gente real con nombre y teléfono. El opt-in funcionaba, la captura funcionaba y el check verde decía la verdad. **Lo que no existía era la forma de enterarse:** la pantalla de revisión era `/crm/revisar/<id>` —por id, sin lista— y nadie emitía ese link.',
      '**Un formulario de landing NO TIENE CANAL DE VUELTA.** Para WhatsApp o Claude el link vuelve por la misma conversación, así que nadie lo pensó dos veces; quien completa un formulario ve la página de gracias del cliente y el dueño no recibe nada. `propuestasPendientes()` vivía en `lib/propuestas.ts` desde el día uno con **cero call-sites**. Ocho personas dejaron su teléfono y a ninguna le escribió nadie.',
      '**Un aviso es un EVENTO; una bandeja es un ESTADO,** y lo que se pierde siempre es lo que solo era un evento. El primer arreglo —el aviso con link al más reciente— tapaba el problema a medias: a los otros siete no se llegaba por ningún lado. La bandeja es `/crm/revisar`, y marca en rojo lo que lleva más de 24 h esperando, porque en una lista ordenada por fecha el que se está enfriando es justo el que queda abajo.',
      '**El check verde no mentía: mentía por OMISIÓN, que es distinto y peor de ver.** Decía «llegó al menos un formulario ✓» y era cierto — le faltaba el segundo verbo: llegó ¿y **entró**? Cuando midas un proceso con un paso humano en el medio, el estado sale del paso que FALTA, no del que se cumplió.',
      '**Y la llave de idempotencia era el teléfono crudo.** `landing:${telefono}` con lo que la persona tipeó, así que «998 136 1529» y «9981361529» son dos llaves distintas: la misma persona creaba dos propuestas, justo lo que la idempotencia venía a evitar.',
    ],
    commits: [
      { sha: '417c539d', msg: 'landing: los 8 leads SI habian entrado — lo que faltaba era que alguien se enterara', lineas: 158, archivos: 5 },
      { sha: '3b525e11', msg: 'crm: la bandeja de contactos para revisar — no existia, y por eso se perdian', lineas: 165, archivos: 4 },
    ],
    archivos: [
      'app/crm/revisar/page.tsx — la bandeja que no existía',
      'app/api/track/optin/route.ts — la captura y su clave de idempotencia',
    ],
  },
  {
    fecha: '14 ago', hora: '14:39', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'v6 y v7: los clics, el marcador de prueba, y el player que nunca fue un Panda',
    puntos: [
      '**Entre «visitó» y «dejó sus datos» no había NINGÚN punto intermedio.** El snippet emitía `pageview`, `play`, `pNN`, `sNN` y `exit`, nunca un clic — y para la landing de la clienta el CTA es un ancla y el cierre es un link de WhatsApp, así que una página que convierte mal no se podía distinguir de una que nadie mira. Escucha en captura y **nunca frena el clic**: lo que la persona quería hacer tiene que pasar igual aunque el envío falle. El DESTINO manda sobre el texto (dos botones distintos pueden ir al mismo lado, y lo que se cuenta es adónde va la gente).',
      '⚠️ **El player nunca fue un Panda.** «Le di PLAY y no me apareció», «Nadie reprodujo el video en 24 h», «nunca me dejó configurar si ese video es un VSL o un testimonio»: tres síntomas que no se parecen entre sí, **un solo hueco**. Se bajó el HTML de la landing en vez de suponer y el único «pandavideo» de esa página era NUESTRO propio snippet — su video es un `<video controls>` común, y el snippet escuchaba solo mensajes `panda_*`. No era un bug intermitente: era imposible que registrara algo, y la afirmación «nadie reprodujo el video» iba a ser cierta **para siempre**. La regla: antes de dar por bueno «el player está enganchado», verificá QUÉ player usa el cliente — un integrador que soporta una sola tecnología y no lo dice se ve idéntico a uno roto, y encima su mensaje de error culpa al usuario.',
      '⚠️ **Filtrar la prueba por HORA no alcanzaba, y es la parte que importa:** dejaría afuera los eventos viejos pero NO los de otra gente visitando la página en ese momento, y esa landing tiene tráfico real. **Un probador que te muestra la visita de un desconocido como si fuera tuya es PEOR que uno que muestra de más:** te hace creer que tu código anda cuando lo que anda es el de la visita ajena. El marcador va como `?mko_test=<id>` en `sessionStorage` —tiene que sobrevivir a navegar dentro de la pestaña y morir al cerrarla; en una cookie contaminaría el tráfico real durante un año—, mismo mecanismo que el `test_event_code` de Meta.',
      '⚠️ **El propio probador generaba los duplicados de landing:** cada corrida abría un `?mko_test=` distinto y eso entraba como una página nueva. Y el hash va SIEMPRE al final al armar la URL: `pagina.com/#registro?mko_test=x` deja el parámetro ADENTRO del hash y `location.search` no lo ve nunca — justo la landing que se estaba probando usa `#registro`.',
      '**Los chequeos van en el orden del EMBUDO** (llegar → ver → clicquear → dejar datos), y la VERSIÓN va primera de todo aunque no sea un paso: si el código está viejo, todo lo demás mide otra cosa. Y en una prueba no se contesta con una estadística del día («nadie en 24 h»): la persona acaba de apretar play.',
    ],
    commits: [
      { sha: '663b32e7', msg: 'landing v6: se miden los clicks — el CTA y el link de WhatsApp eran invisibles', lineas: 131, archivos: 5 },
      { sha: '345fa3da', msg: 'landing: el probador muestra SOLO tu prueba, y las dos cosas que quedaron abiertas', lineas: 241, archivos: 8 },
      { sha: '031366a6', msg: 'landing v7: el video de Leila NUNCA se pudo medir — es un <video>, no un Panda', lineas: 211, archivos: 3 },
      { sha: 'e385a064', msg: 'cosecha: el player que no era Panda y los cuatro dedups que no se hablan', lineas: 123, archivos: 2 },
    ],
    archivos: [
      'lib/landing-token.ts — el listener de clics, `engancharNativos`, `idDeVideo`, `enPrueba`',
      'supabase/migrations/0133_vsl_events_detalle.sql — columna propia para «qué se clicqueó», no reusar `vsl_titulo`',
      'supabase/migrations/0134_marcador_de_prueba.sql',
    ],
  },

  // ── 14 ago noche: el nombre y el puente al lead ─────────────────────────────
  {
    fecha: '14 ago', hora: '21:22', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Todo medido y nada atable a la persona; y el Pixel pasa a llamarse igual en los ocho lugares',
    puntos: [
      '⚠️ **`createLead()` DESCARTABA el `visitor_id`.** Estaba en `LeadCreateInput` y nunca llegaba al insert, así que el lead que entra desde la landing nacía sin el identificador de la visita — y la tab Tracking de su ficha, que se busca POR `visitor_id`, quedaba vacía. La visita, el play, los clics y el formulario estaban TODOS medidos en la base y no se podían atar a la persona, **que es exactamente lo único que el tracking existe para hacer**. Se iban igual `origen_lead` y los UTM: sin eso, un lead de landing es indistinguible de uno cargado a mano.',
      '**Para poder NOMBRAR un video hacía falta un dato que no viajaba: dónde está.** La URL empieza a viajar en el evento `play`, en las dos clases de player (`currentSrc` del `<video>` nativo y `src` del iframe de Panda) — si solo la mandara uno, la mitad de los clientes tendría el botón y la otra mitad no. Y viaja en `detalle`, la columna del clic: **eso NO es meter dos cosas en un campo**, la pregunta es una sola («¿a qué apunta este evento?») contestada por cada tipo con lo suyo.',
      '**Un botón que no puede abrir nada es peor que ninguno:** promete y falla, y quien lo aprieta no sabe si el roto es el video o la app. Por eso «Ver este video» aparece solo si sabemos dónde está.',
      '⚠️ **Un bloque puesto después del primer `return` es código INALCANZABLE, y no deja ni un error.** El lápiz de «Tus videos» no hacía nada: el estado cambiaba y la pantalla no. Es el mismo patrón que después se repitió dos veces más en esa pantalla — cambiar un estado que se renderiza en una rama que no se está mostrando — y por eso los tests de ahí afirman **las dos ramas**: un arreglo que mueve el aviso en vez de sumarlo rompe el otro lado.',
      '**Y esa misma noche, el nombre.** «Landing / VSL» hacía que cada pantalla lo llamara distinto —«el código», «el snippet», «la landing»— y no había manera de saber que hablaban de lo mismo. Pasa a **Pixel de MaKo** en los ocho lugares vivos. ⚠️ Los avisos de WhatsApp SÍ se tocaron acá, a diferencia del pase a español neutro: **el nombre de un producto tiene que ser el mismo en todos lados o son dos productos**; la VOZ rioplatense del catálogo de avisos no se movió, porque mezclar dos voces en el mismo hilo sería peor que cualquiera de las dos.',
      '⚠️ **Un script de reemplazos que escribe al final convierte un fallo parcial en CERO cambios, y el log dice «ok».** El script abortó al primer patrón que no encontró y falló ANTES de escribir `ProbarTracking.tsx`: ninguno de los cinco renombres de esa pantalla se aplicó —incluido el que se había pedido textual— y el commit salió diciendo que sí. Lo que se lee es el resumen, no lo que quedó en disco. Reportado: *«te dije explícitamente lo de "Probar que el código funciona" y aún no está»*.',
      '**El título dice el RESULTADO, no el mecanismo** («Se mide cuánto ve» → «Se mide el tiempo de retención»), **los avisos de error terminan en una acción** (primero qué hacer, después qué ganás), y el vocabulario es el del producto y no el nuestro: «instalado» y no «pegado», «reproductor» y no «player». Todo el copy que ve el cliente pasa a español neutro; los comentarios del código no se tocan.',
    ],
    commits: [
      { sha: '5d125365', msg: 'leads: el visitor_id no llegaba al insert, y los webhooks ya no fusionan callados', lineas: 178, archivos: 8 },
      { sha: '91d21cad', msg: 'landing v8: un botón para VER el video que te estoy pidiendo que nombres', lineas: 72, archivos: 4 },
      { sha: 'a2620ef5', msg: 'copy: todo a español neutro, y los títulos que se entienden de una', lineas: 91, archivos: 6 },
      { sha: 'd2e28fff', msg: 'Pixel de MaKo: se llama igual en los 8 lugares donde aparecía distinto', lineas: 67, archivos: 8 },
      { sha: '3490e7d7', msg: 'Pixel de MaKo: los renombres que NO se habían aplicado, y el test que lo cuida', lineas: 40, archivos: 4 },
    ],
  },

  // ── 15 ago: Clarity y el rediseño por pasos ────────────────────────────────
  {
    fecha: '15 ago', hora: '10:35', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Clarity: grabaciones y mapas de calor sin una segunda cosa para pegar',
    puntos: [
      '**Clarity es una integración propia aunque comparta el `<script>`.** Son dos preguntas distintas: el Pixel siempre está (es nuestro, no se apaga) y Clarity es opcional y con la cuenta del cliente. Fundirlos haría que apagar uno apague el otro, y que el semáforo de la medición propia dependa de una credencial ajena. **El bloque va dentro del snippet que ya pega** —el cliente pega UNA cosa— en `try/catch` y después del Pixel: Clarity caído no puede romper la medición propia.',
      '⚠️ **Y va PRIMERO en el modal, que no es una decisión estética: su bloque se arma cuando se GENERA el snippet.** Conectarlo después de pegar el código deja al cliente con un código que no lo trae y sin nada que se lo diga — el mismo modo de falla que ya costó 18 días de medición muerta.',
      '**`clarity("identify", visitorId)` es lo que ata todo.** Sin el identify el panel muestra miles de sesiones anónimas; con él, la ficha del lead linkea directo a la grabación de esa persona. ⚠️ **Se linkea, no se embebe:** Clarity no permite meter su reproductor en un iframe, y un marco vacío es peor que un link honesto.',
      '⚠️ **La cuota es de 10 requests por proyecto POR DÍA:** si la consultara una pantalla, tres personas abriendo la tab dos veces la agotan antes del mediodía y queda en blanco sin que nada lo explique. Por eso hay cron propio que cachea, y **un error de Clarity NO pisa el caché**: lo de ayer sigue siendo cierto y es mejor que una pantalla vacía. El 402 (cuota) y el 401 (token) tienen mensajes distintos, porque «falló» a secas manda a revisar el token, que es justo lo que no está mal.',
      '**El token pasó de opcional a obligatorio**, dando vuelta la decisión del día anterior: sin token no hay resumen, y sin resumen MaKo no puede saber cuándo se vencen las grabaciones — el aviso de «esto se borra en 4 días» **no puede existir**. Conectar a medias una integración que a medias no sirve es peor que no conectarla. El margen del aviso son cinco días y solo por leads: al día 29 ya no hay tiempo de marcarla favorita, y al día 10 nadie sabe todavía si ese lead importa.',
      '⚠️ **Una barra de credencial reimplementada «parecida» no es un detalle estético.** La primera versión copió dos `<Input>` y un botón: sin semáforo por campo, sin «?», sin ojo, sin probar, sin editar. Es una pantalla donde el usuario no sabe si lo que pegó quedó bien. Se renderiza `ServicioConfigForm`, la misma pieza que usan Meta y Chatwoot — y de paso desaparecen los textos que existían solo porque a esa barra le faltaban botones.',
    ],
    commits: [
      { sha: 'd89d2538', msg: 'clarity: integración BYOK, dentro del mismo Pixel, con el link por lead', lineas: 299, archivos: 9 },
      { sha: '1d853612', msg: 'clarity: se configura DENTRO del modal del Pixel, como primer paso opcional', lineas: 140, archivos: 5 },
      { sha: '52dfd9c3', msg: 'pixel: tres pasos separados, y Clarity usa la MISMA barra de credencial que el resto', lineas: 98, archivos: 2 },
      { sha: '517200d1', msg: 'clarity: el cron que cachea el resumen y avisa antes de que se borre la grabación', lineas: 227, archivos: 6 },
    ],
    archivos: [
      'lib/clarity.ts — `resumenClarity()`, `urlSesionesDePrueba()` y el aviso de vencimiento',
      'app/api/cron/clarity-vigilante/route.ts · app/api/cron/prueba-grabacion/route.ts',
    ],
  },
  {
    fecha: '15 ago', hora: '15:13', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'v9 a v12: los primeros segundos, AGENDÓ, el autoplay, y cada evento diciendo en CUÁL página pasó',
    puntos: [
      '⚠️ **Con un video largo no se registraba NADA durante el primer minuto.** Cuando se conocía la duración, el snippet tomaba el camino del porcentaje y SALÍA (`if (dur > 0) { …; return; }`): con un video de 23 minutos el primer hito de 5% cae a los **71 segundos**. Y no es un problema de la prueba — un visitante real que mira 40 segundos y se va se registraba como si no hubiera visto nada. **Justo el tramo donde se pierde a la mayoría era el que no se medía.**',
      '⚠️ **AGENDÓ era el evento que faltaba, y para quien vende por llamada es EL evento.** Lo que pasa dentro del iframe de Calendly es de otro dominio y no se puede espiar, pero Calendly **avisa al padre por `postMessage`**: su embudo terminaba en «vio el video» y la conversión ocurría dentro de un marco que no mirábamos. Solo la reserva CONFIRMADA (`calendly.event_scheduled`) — contar todos los eventos del ciclo convertiría «agendó» en «miró el calendario», que es justo la diferencia que importa.',
      '**Un `play` no es una intención cuando el player arranca solo.** El snippet marca `auto` si no hubo una sola interacción antes, y el chequeo se parte en dos: «se detectó el reproductor» lo contesta cualquier play, «alguien quiso verlo» solo el manual. Y el `pause` del navegador **también dispara al TERMINAR** el video, y el segundo `play` es RETOMAR y no otra reproducción: contarlo como play haría ver dos personas donde hay una.',
      '**Aparece el estado «no aplica».** La landing del dueño no tiene botones propios (es un Calendly embebido) y no recibe leads por formulario porque no vende así: con la lista anterior le quedaban dos puntos en rojo PARA SIEMPRE, **que es como se entrena a alguien a ignorar la lista entera**. Y el veredicto cuenta solo los aplicables: «3 de 6» sobre una página que solo puede cumplir cuatro se lee como que faltan dos y nunca van a llegar.',
      '⚠️ **Todo el estado de la landing vivía a nivel WORKSPACE, y con dos páginas eso miente.** `landing.snippet_version` guarda una sola versión —la del último evento, venga de donde venga—, así que el aviso «Pixel desactualizado» podía mandar a repegar el código en la página que ya estaba al día. La versión pasa a salir de `landing_visits.sv`, por página. Y elegir la landing pasa a ser el **PASO 1** que gobierna todo lo de abajo: el código que se copia, si Clarity está conectado, si el Pixel está al día y qué pasos tiene la prueba son DISTINTOS en cada página. Los pasos 2, 3 y 4 no se dibujan hasta que hay una elegida.',
      '⚠️ **Y `vsl_events` no sabía en qué página pasó cada cosa.** `landing_visits` tenía `landing_url` desde la mig 0061 y los eventos no: se sabía a qué página ENTRÓ alguien, no dónde HIZO cada cosa, así que «reproduce tu video» podía darse por cumplido con un play de OTRA página del mismo workspace. La URL viaja desde `enviar()`, el único punto por donde pasan todos los eventos — colgarla de cada llamada garantizaba que el próximo evento nuevo naciera sin página. Los eventos anteriores traen NULL y **el filtro los deja pasar**: no se puede atribuir lo que no se sabe, y descartarlos pintaría en rojo el chequeo de alguien que tiene el Pixel funcionando y solo lo tiene viejo.',
    ],
    commits: [
      { sha: '9deaf038', msg: 'pixel v9: la prueba se adapta a la landing, y los primeros segundos del video se miden', lineas: 78, archivos: 3 },
      { sha: '7446ae25', msg: 'pixel: elegir la landing es el PASO 1, y los otros tres dependen de esa elección', lineas: 153, archivos: 4 },
      { sha: 'fd14a5be', msg: 'avisos: «Pixel desactualizado» ahora dice CUÁL de tus páginas', lineas: 59, archivos: 2 },
      { sha: 'e5213d77', msg: 'pixel v10: AGENDÓ, y el ciclo de vida del video (pausa, retoma, fin)', lineas: 94, archivos: 4 },
      { sha: '18fb7a8f', msg: 'pixel: el paso 4 usa la landing del paso 1, y cambiar de landing tira el estado viejo', lineas: 32, archivos: 1 },
      { sha: '2a5c338e', msg: 'pixel v11: el autoplay no cuenta como play, y todo se acota a la landing elegida', lineas: 675, archivos: 14 },
      { sha: 'cd06362e', msg: 'pixel v12: cada evento dice en CUAL pagina paso, no solo la visita', lineas: 95, archivos: 4 },
    ],
    archivos: [
      'supabase/migrations/0135_landing_visits_sv.sql · 0136_vsl_events_auto.sql · 0137_vsl_events_landing_url.sql',
      'app/api/cron/tracking-vigilante/route.ts — ⚠️ corre SIN sesión, así que no puede usar `getLandingsAction` (pide el permiso de la tab): lee el setting directo',
    ],
  },

  // ── 15 ago: el campo mal ubicado ───────────────────────────────────────────
  {
    fecha: '15 ago', hora: '21:24', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un campo en la tabla equivocada: dejaron de guardarse los pageviews, con tráfico pago corriendo',
    puntos: [
      '⚠️ **Bug vivo en producción y con pérdida de datos.** `auto` —la marca de autoplay de la v11— se agregó al insert de `landing_visits`, pero la migración creó esa columna en `vsl_events`. Postgres **rechaza la fila entera** por una columna que no existe, así que dejaron de guardarse los pageviews sobre una landing con tráfico pago corriendo en ese mismo momento. Y la otra mitad del mismo error: `auto` nunca llegaba a `vsl_events`, o sea que la feature que motivó la v11 no medía nada. **Los dos síntomas de un solo campo mal ubicado.**',
      '⚠️ **Por qué no lo agarró nada, y esto vale para todo el beacon:** el typecheck no conoce el esquema de Supabase, el build pasa, y **el beacon loguea con `console.error` y devuelve 200 a propósito** —para no tumbar la página del cliente—, así que desde afuera se ve igual que si anduviera. Lo delató un síntoma indirecto: plays entrando sin una sola visita. **Todo lo que se agregue al beacon necesita su test estructural**, porque el compilador no puede verlo: el nuevo parte el archivo en los dos inserts y exige que `auto` esté solo en el de `vsl_events`, con `sv` de control (esa sí está en las dos).',
    ],
    commits: [
      { sha: '56d97d4f', msg: 'fix: `auto` estaba en el insert de landing_visits y su columna vive en vsl_events', lineas: 49, archivos: 2 },
    ],
    archivos: ['app/api/track/vsl/route.ts — los DOS inserts, que se parecen y no son el mismo'],
  },

  // ── 15-16 ago: los videos y el redirect huérfano ───────────────────────────
  {
    fecha: '15 ago', hora: '22:07', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Nombrar un video obligaba a conseguir que alguien lo mirara, y ahí apareció el redirect que fugaba el embudo',
    puntos: [
      '⚠️ **`.limit(2000)` devolvió 1000 filas, y las 1000 equivocadas.** Reportado dos veces («aún no me muestra el video»). El botón, el texto y la condición estaban bien: la consulta **no tenía `order`**, y sin `ORDER BY` PostgREST devuelve las filas en el orden físico —las más viejas— y el servidor corta en 1000 aunque se pidan 2000 (`db-max-rows`: responde 200 con menos filas, **sin avisar**). La URL del video viaja en `detalle` solo desde la v8, así que en esas 1000 filas viejas no había una sola que la trajera. El mismo tope mentía por otro lado: la pantalla decía «1000 eventos» —redondo, se lee como un dato real— al lado de un video con 6.489. **Todo `.limit()` necesita su `.order()`, y un conteo se pregunta, nunca se deriva de las filas que vinieron.**',
      '**La pantalla estaba al revés: para poder NOMBRAR un video había que conseguir primero que alguien lo mirara.** La URL viajaba solo en el `play`. Ahora sale de dos lados que existen antes de cualquier visita: el catálogo de Panda por API y el HTML de la propia página (`<video>` nativo, YouTube y Vimeo). ⚠️ Y la regla del id vive DOS veces —en TS y adentro del snippet, que no puede importar nada— y lo único que lo protege es un test que corre las dos.',
      '⚠️ **EL HALLAZGO: el VSL tenía `config.videoRedirect` en Panda apuntando a un video viejo de OTRA persona**, resto de una playlist de prueba borrada meses antes. Cada visitante que terminaba de ver la oferta pasaba solo a un video que no tiene nada que ver. **No se ve en la página, no se ve en los eventos, y nadie lo mira hasta que los leads llegan confundidos.** La API pública de Panda no lo puede borrar: `PUT /videos/{id}` contesta textual «must NOT have additional properties: config» y se probaron nueve rutas.',
      '**La salida, y la regla que queda: si su API pública se niega pero su PANEL sí puede, el bundle del panel dice con qué endpoint lo hace.** Es JavaScript público. Entre los 361 chunks del dashboard de Panda estaba `POST /player/?type=video { video_id, videoRedirect }`, sin documentar — y con el id **INTERNO** del video (con el externo da «video not found», y ese detalle es el que decide) contestó 200 y lo limpió.',
      '**Y esconder no es borrar.** El video al que mandaba el redirect siguió apareciendo en la lista: dejó 11 eventos mientras estuvo activo y esos eventos son un HECHO —ese video SÍ se reprodujo en esa página—, así que arreglar el origen no borra el pasado. Se puede marcar como ajeno, se dice cuántos hay marcados y se vuelven a ver de un clic. ⚠️ Va en su PROPIA lista y no como un campo de `VideoLanding` aunque parezca el lugar obvio: esa estructura exige nombre y deja UN solo VSL, y meterlo ahí obligaba a aflojar el «sin nombre no entra».',
      '**Se mostraba un UUID donde tenía que ir un título.** El único título disponible salía del atributo `title` del iframe, que es de la PÁGINA y no del video: los dos videos de esa landing se llamaban igual. **Un dato que está y no discrimina se ve igual que uno bueno.** Panda sí los distingue.',
    ],
    commits: [
      { sha: '5d17ad5a', msg: 'fix: la lista de videos leia las 1000 filas mas VIEJAS, que son las que no tienen URL', lineas: 93, archivos: 3 },
      { sha: 'af50d1a0', msg: 'videos: titulo de verdad, y verlos sin esperar a que alguien los reproduzca', lineas: 196, archivos: 5 },
      { sha: '70e18dcd', msg: 'videos: verlos sin depender de un play, el redirect que fuga el embudo, y el mapa de calor en la ficha', lineas: 396, archivos: 12 },
      { sha: '05f37e94', msg: 'cosecha: el redirect invisible de Panda, y por que la URL de un video no puede depender de un play', lineas: 101, archivos: 2 },
      { sha: '76dab820', msg: 'cosecha: el redirect huerfano de Panda, RESUELTO — y como se encuentra un endpoint que no esta documentado', lineas: 33, archivos: 1 },
      { sha: '58512884', msg: 'videos: poder decir «este no es de mi pagina», sin borrar la medicion', lineas: 155, archivos: 7 },
    ],
    archivos: [
      'lib/panda.ts — `catalogoPanda()`, cacheado 5 minutos por workspace; sin Panda configurado devuelve un mapa vacío y nunca lanza',
      'lib/landing-analisis.ts — `videosDeHtml()` / `idNativo()`',
      'lib/landing-token.ts — `videosDetectados()`, el chequeo del redirect',
    ],
  },

  // ── 16 ago: el analizador, la página que se va, y la ventana de 25 ─────────
  {
    fecha: '16 ago', hora: '01:30', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'v13 y v14: pausa y fin nunca existieron para Panda, y salir de la página no es abandonar el video',
    puntos: [
      '⚠️ **La v10 anunció pausa, retoma y fin, y solo los cableó para el `<video>` nativo.** El manejador de mensajes escuchaba `allData`, `play` y `timeupdate`, nada más. Medido: **658 plays y 606 exits en 7 días, y CERO pausa/retoma/fin.** No fallaban: no estaban. Es el modo de falla más caro del área, porque una feature que no existe se ve exactamente igual que una que nadie usó.',
      '⚠️ **El analizador se estaba leyendo A SÍ MISMO.** Decía que la landing tenía un `<video>` nativo y botones propios, y no tiene ninguno de los dos: el `<video>` salía de los COMENTARIOS de nuestro propio snippet inline y el `<button>` era el de cerrar del badge del hosting. Con `botones` en true, el chequeo de clics se le pedía para siempre a una página cuyo único CTA es un Calendly embebido. Y en una SPA el HTML es un `<div id="root">` vacío, así que **«no sé» se trataba como «no tiene»**: ahora también lee el bundle, pero solo las piezas que se identifican por un DOMINIO (`calendly.com`, `wa.me`, `player-vz-`) — lo que depende de una etiqueta no sobrevive a la minificación.',
      '**`exit` no contesta qué pasó con la PÁGINA.** Mide el punto de abandono del VIDEO y se dispara igual si la persona se fue a otra pestaña o si cerró todo. Los tres nuevos: `salio`, `volvio` (con los segundos que estuvo afuera, que es el dato que distingue una interrupción de 20 segundos de una de media hora) y `cierre`. ⚠️ **Al cerrar una pestaña llegan LOS DOS** —el navegador dispara primero `visibilitychange` y después `pagehide`—: no se puede saber de antemano cuál va a pasar, así que **no se adivina**; se manda lo que ocurrió y la lectura ordena. Tope de 10 idas y vueltas, porque a partir de ahí el dato no agrega nada y tapa el resto de la lista.',
      '**Un chequeo con la configuración mal puesta de un cliente adentro no va en el guion que ve todo el mundo.** El chequeo del redirect se sacó de los pasos de la prueba —con el título del video de otra persona en el texto convertía un instructivo genérico en el informe de un caso particular—; la detección queda, lo que se fue es su lugar ahí.',
      '**Y el indicador de carga estaba puesto y no se veía**, reportado dos veces sobre algo que ya estaba en producción: las barras usaban `--surface-2`, casi el mismo color que el fondo blanco del modal, y la consulta tarda tan poco que el hueco aparecía y desaparecía sin llegar a verse. Se le puso un piso de 450 ms, **al revés de lo habitual** (lo normal es retrasar un loader para que no parpadee). ⚠️ Y no aparece cuando no hay ninguna página cargada: ahí la pelota está del lado del usuario, y un indicador de carga sobre algo que no está cargando es una promesa falsa que además gira para siempre.',
    ],
    commits: [
      { sha: '3290e5fb', msg: 'pixel v13: pausa/fin en Panda, el analizador deja de leerse a si mismo, y fuera el chequeo del redirect', lineas: 259, archivos: 5 },
      { sha: '91693742', msg: 'pixel: un esqueleto debajo del paso 1 mientras se resuelve cual es la landing', lineas: 100, archivos: 4 },
      { sha: '7930ea3a', msg: 'pixel: el indicador de carga estaba puesto y no se veia', lineas: 86, archivos: 4 },
      { sha: '6d2c4e96', msg: 'pixel v14: salir de la pagina, volver y cerrar son tres eventos distintos', lineas: 93, archivos: 4 },
    ],
  },
  {
    fecha: '16 ago', hora: '17:41', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El probador decidía si tu landing anda mirando una lista de 25, y el opt-in lo buscaba en la tabla equivocada',
    puntos: [
      '⚠️ **Dos chequeos que se contradecían en pantalla:** «aún no llega la visita» y dos renglones más abajo «ya se puede calcular la retención», con el pageview guardado en la base. Los chequeos se calculaban sobre la **misma lista que se dibuja**, cortada en 25 para que el feed sea legible — y el `pageview` y el `play` son los PRIMEROS eventos de cualquier prueba, o sea los primeros en caerse del corte. **Nació el día que el snippet empezó a mandar más eventos por visita** (clics, salió, volvió): antes 25 alcanzaba. La regla: **el corte es para la pantalla; lo que decide mira la lista completa.** Queda anotado que la misma trampa vive un escalón más arriba, en el `limit(40)` de `vsl_events`.',
      '⚠️ **El chequeo del formulario buscaba en `propuestas`, y una propuesta se crea ÚNICAMENTE cuando el contacto choca con uno existente.** El camino normal escribe el lead directo, así que ese renglón **solo podía ponerse verde si el lead era DUPLICADO**. El opt-in funcionaba —comprobado mandando uno con el token real: `{ok:true, lead:2246, creado:true}`—; lo roto era la pregunta. Es el mismo tipo de error que el de arriba: **un chequeo que mide otra cosa que la que dice medir.**',
      '**La ventana de la prueba se abre PRIMERO, aunque tenga que quedar arriba.** Es la única cuyo bloqueo se puede detectar (la landing va con `noopener` y devuelve `null` siempre), y si el navegador la bloquea no se abre nada: **dejar la landing midiendo algo que nadie puede mirar es peor que no empezar.** Y cerrar la ventana de la landing NO termina la prueba: eso es parte de la prueba —es el evento `cierre` de la v14— y tomarlo como fin apagaría la medición justo cuando más está midiendo.',
      '**Al terminar sale un WhatsApp** («recibí tu prueba, N eventos, la grabación se está procesando»), distinto del de la grabación lista que llega 45 minutos después: sin este, quien termina cierra la ventana y se queda sin ninguna señal de que quedó registrado. Verificado contra las dos pruebas reales del día: los siete chequeos en verde.',
    ],
    commits: [
      { sha: 'bcdf096d', msg: 'El probador miraba una lista de 25 para decidir si tu landing anda', lineas: 53, archivos: 2 },
      { sha: '7008cf60', msg: 'prueba del Pixel: los chequeos miraban una ventana de 25 eventos, y el opt-in la tabla equivocada', lineas: 247, archivos: 5 },
    ],
    archivos: [
      'lib/landing-token.ts — `landingDiagnostico`, el bloque `eventosVisibles`',
      '⚠️ Sigue vivo: `curvaRetencion`, `avancePorPersona` e `histogramaAbandono` aceptan `videoId` y nadie se lo pasa; y su condición exige que `ev.video_id` sea truthy, así que un evento sin video entra en la curva de CUALQUIER video (lib/vsl-retencion.ts:115 y :212)',
      '⚠️ Sigue vivo: el beacon guarda `landing_url` como texto arbitrario de un desconocido, y eso decide después qué baja el Landing Analyst (docs/hallazgos-landing.md → «Un tercero elige qué páginas baja»)',
    ],
  },
  {
    fecha: '22 sep', hora: '11:01', chat: 'CRM', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La retención del VSL no anda, y el reproductor no es Panda ni YouTube',
    // Textual, de un audio del grupo de WhatsApp «Makito» (22/09, 11:01). Llegó al
    // repo el 27/09, cuando Martín exportó los audios del teléfono: los del grupo se
    // descartaban en el webhook y la media de Evolution caduca a los ~30 días.
    pedido: 'Y lo último que me queda es que no está trackeando bien el tema del, ¿cómo se dice?, del VSL, de la reproducción, de la retención del VSL, porque ustedes no lo tienen en Panda Video o YouTube, lo tienen en otro, no me acuerdo ahora cómo se llama, y tengo que hacer la conexión con ese.',
    puntos: [
      '**El diagnóstico del pedido era el equivocado, y por eso vale guardarlo entero.** «Tengo que hacer la conexión con ese» daba por hecho que faltaba soporte del reproductor — y el soporte había entrado siete días antes (v16, 15/09). Los eventos ya estaban llegando. Lo que fallaba era la IDENTIDAD del video, no la medición.',
      'La regla que queda: cuando alguien reporta que algo «no se mide», la primera pregunta es si llegan eventos, no si existe el integrador. Son dos preguntas y la barata contesta primero.',
    ],
  },
  {
    fecha: '27 sep', hora: '20:10', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El mismo video vivía bajo TRES ids, y ninguna pantalla lo decía',
    puntos: [
      '⚠️ **Dos enganches midiendo el mismo elemento.** La rama propia del reproductor (lo reconoce por su FORMA: `mediaId` + `percentWatched`) y el enganche genérico `hostDeMedia` (cualquier custom element con API de media, id = etiqueta + `media-id`) escuchan los mismos `play`/`pause`/`time-update` **en captura sobre `document`**. Medido en producción: **348 plays con `w:<id>` y 348 con `wistia-player:<id>`, los 348 pares dentro de 2 segundos**; igual pausa (286/286), exit (288/286) y todos los `pNN`. Reproducciones al doble y la curva de retención partida entre dos videos que la pantalla no sabía que eran el mismo.',
      '**Gana la rama propia, y no es un empate:** mide la escalera de segundos que el genérico no tiene (270 eventos contra 0) y sabe armar la URL pública del embed. El genérico se abstiene ANTES de registrar; alcanza con cortar de un lado porque la pertenencia se decide por la FORMA del elemento y no por quién llegó primero.',
      '⚠️ **El comentario de esa rama YA advertía del doble conteo… contra el `<video>` nativo.** La colisión que faltaba era con el genérico, escrito después y para la misma clase de elemento. Un guard contra UNA fuente de duplicados no protege de la siguiente, y el que lo escribió no tenía forma de saber que iba a haber otra.',
      '⚠️ **Y el tercer id: el VSL marcado apuntaba a la nada.** `landing.videos` decía `wistia:<id>` y ningún evento trajo nunca ese prefijo — cero cruces, curva vacía en toda pantalla que habla de «el VSL». El id de un video es una CLAVE: cruza exacto o no cruza. Encima el id BUENO estaba en `landing.videos_ocultos`: alguien escondió el verdadero creyendo que era el repetido.',
      '**La pantalla decía «sin actividad reciente», que afirma de más.** Suena a video tranquilo cuando lo que pasa es que ese id no es de ningún video. Son dos estados distintos y ahora tienen dos frases: el huérfano dice «ningún evento con ese id».',
      '**Se busca con una consulta, no con una intuición:** agrupar `vsl_events` por el SUFIJO del `video_id` y quedarse con los sufijos que tengan más de un prefijo. Al 27/09 daba exactamente un caso en todo el producto.',
      '⚠️ **Sigue pendiente:** las 1.303 filas de `wistia-player:` inflan el histórico de ese workspace. Son un duplicado estricto (todo lo que tienen lo tiene el id bueno, y les falta la escalera entera), así que borrarlas no pierde nada — pero es un DELETE en producción y lo decide Martín. Y el cliente no se cura solo: hasta que repegue el código sigue en v16 mandando los dos ids.',
    ],
    commits: [
      { sha: 'a2228687', msg: 'Pixel v18: el VSL se medía DOS VECES y el VSL marcado apuntaba a un id que no existe', lineas: 152, archivos: 5 },
    ],
    archivos: [
      'lib/landing-token.ts — `hostDeMedia` se abstiene con `wisHost(t)`; SNIPPET_VERSION 18 y su renglón de NOVEDADES',
      'app/integraciones/NombrarVideos.tsx — el video nombrado cuyo id no cruza nada deja de decir «sin actividad reciente»',
      'tests/landing-snippet-emitido.test.ts — el guard va ANTES de registrar (probado rompiéndolo: 4/1 en las dos roturas)',
      '⚠️ El test de atribución clavaba `SNIPPET_VERSION = 17`, así que fallaba con cualquier cambio del snippet ajeno a él. Pasa a exigir 17 o más: un test que pinta el número de hoy se «arregla» tocando el test.',
    ],
  },
  {
    fecha: '22 sep', hora: '20:13', chat: 'CRM', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'De que anuncio vino la agenda, y por que todos dicen «organico manual»',
    // Dos audios del grupo «Makito», textuales (22/09 20:13 y 20:18). Los mando Joan Dowd,
    // que es quien usa MaKo para sus clientes; llegaron al repo el 27/09, cuando Martin los
    // exporto del telefono: los mensajes de grupo se descartaban en el webhook y la media de
    // Evolution caduca a los ~30 dias.
    pedido: 'Tincho, como va? Buenas noches. Che, te hago una pregunta. En el CRM, MaKo, donde puedo ver? Porque se que debe estar por algun lado, pero no lo debo estar viendo. Donde puedo ver la trazabilidad inversa para saber de que anuncio, de que creativo llego la agenda?\n\nCreo que te refieres ahi, me aparece organico manual, todos me aparecen como organico manual y todos estos vinieron del VSL Funnel. No se si esta bien ahi lo que te comparti, si deberia aparecer ahi o mas abajo me aparece el historial de la actividad registrada en el VSL, retencion de video, etcetera, pero lo de la campana no, no lo veo.',
    puntos: [
      '**«Todos me aparecen como organico manual» era el mas CHICO de cuatro bugs, y el unico que el podia ver.** El dato del canal estaba bien guardado desde siempre: faltaba el `case` de la ficha. Por eso vale guardar el pedido entero — su segunda mitad («lo de la campana no, no lo veo») apunta a los otros tres, que viven en el camino de datos.',
      'La pantalla NUNCA fue el problema: dibuja Campana > Conjunto > Anuncio con deep-link y resuelve los nombres. El id 120251610513950661 resuelve a «Agentes 2 | 15/09» de la campana «VSL FUNNEL inmobiliarios CI», que es justo el VSL funnel que el nombro.',
    ],
  },
  {
    fecha: '27 sep', hora: '21:24', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Arreglar el snippet no arregla a nadie: el duplicado volvio a nacer la misma noche',
    puntos: [
      '⚠️ **La leccion que mas cuesta de esta area, y salio de un fracaso.** Con la v18 commiteada, DESPLEGADA y el historico duplicado borrado, el id duplicado volvio a nacer esa misma noche: 5 filas de `wistia-player:` a las 23:51, **dos visitantes distintos**, trafico pago real de Instagram (utm_source=ig con fbclid), con **6 ms** entre el play de un id y el del otro.',
      '**El porque se mide en una consulta:** `landing_visits.sv` dice que version corre cada cliente, y al 27/09 ninguno corria la v17 ni la v18 — ws1 en la **v14** con 3.304 visitas, ws13 en la **v16** con 607, ws14 en la v15. Y la v16 es exactamente el commit (3319ab20) que introdujo las dos ramas que chocan. **El snippet va PEGADO en la pagina del cliente: arreglarlo tiene alcance CERO hasta que cada uno repegue, uno por uno.**',
      '**LA REGLA: si el arreglo tiene que llegarle a alguien que ya instalo una copia de nuestro codigo, va en el SERVIDOR.** El snippet se arregla igual, como defensa en profundidad, pero el que manda es el que RECIBE.',
      '**Son TRES nacederos, no uno.** El beacon (la unica linea del repo que escribe `vsl_events.video_id`, que tenia un trim+slice y nada mas), `lib/landing-videos.ts` (por ahi pasan las dos pantallas del catalogo y las tres operaciones de la API de MaKo — va adentro del saneo del id, no en los llamadores) y `videosDeHtml`, que pare ids leyendo el HTML y **nunca toca el beacon**: de ahi salia el tercer id.',
      '⚠️ **Y el lector de prefijos estaba roto en los DOS lugares que lo hacian.** `hostDeVideoId` devolvia null para `wistia:` —prefijo que su propio archivo emitia doce lineas mas abajo— y `lib/leads.ts` preguntaba con un regex que contesta **false** para `wistia-player:`, `mux-player:` y `lite-youtube:` (el guion no es [a-z] y el prefijo pasa de 6). Con false, esos ids caian al respaldo «la unica duracion conocida» —la de Panda— y **se les calculaba el avance con la duracion de otro video**, que es justo lo que el comentario de esa funcion dice que no puede pasar.',
      '⚠️ **Canonizar al LEER rompe lo que estaba escrito.** El ws13 tenia `wistia-player:<id>` en `landing.videos_ocultos`, que canonizado resuelve a `w:<id>` — **el VSL**. O sea que el propio arreglo le escondia el VSL al cliente. El backfill va en el mismo commit y no renombra a ciegas: fila por fila pregunta si existe la gemela canonica (mismo visitante, mismo tipo, <2 s); si existe se BORRA, porque renombrar daria dos filas para un hecho. Las 5 tenian gemela.',
      '**El control no comprueba el caso, comprueba que no se pueda repetir:** escanea el snippet y falla si aparece un prefijo literal que `lib/video-id.ts` no declare, **y** si aparece una forma NUEVA de armar un id sin prefijo literal. Hoy hay dos, y una de ellas (el nombre de la etiqueta) es exactamente de donde salio este bug.',
    ],
    commits: [
      { sha: '1d0d6d57', msg: 'Un video, UN id: la canonicalizacion va en el SERVIDOR, no en el snippet', lineas: 509, archivos: 8 },
    ],
    archivos: [
      'lib/video-id.ts — nuevo, sin server-only: la tabla de alias EN POSITIVO con el porque de cada uno, canonizarVideoId, esIdPosicional, idDeclaraHost',
      'app/api/track/vsl/route.ts — el choke point del que todo depende',
      'tests/landing-analisis.test.ts — el test FIJABA la doble identidad de Wistia. No estaba mal escrito: reflejaba la decision contraria. Ahora exige la unica, y su comentario lo dice',
      '⚠️ Queda abierto: cinco ramas del snippet caen a un id POR POSICION (iframe0, v:pos0, <etiqueta>:pos0, vimeo:iframe) que no identifica nada, y hoy entran a videosDetectados como un video nombrable. esIdPosicional ya lo sabe distinguir y todavia no lo consume nadie',
    ],
  },
  {
    fecha: '27 sep', hora: '21:33', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La atribucion del lead: cuatro bugs en cuatro capas, y sin backfill no se veia ninguno',
    puntos: [
      '**1) El case que faltaba.** El opt-in escribe origen_lead: landing desde que existe, asi que el dato siempre estuvo bien. Medido: **27 leads en todo el producto**, 19 de un solo cliente (19 de sus 21). Ya habia pasado con Cal.com, con el comentario al lado — una lista de cases que crece cuando alguien se queja va a volver a fallar, asi que el test lee que valores ESCRIBE el opt-in y exige que cada uno tenga el suyo. **Un default que afirma «llego solo» no es un fallback: es una afirmacion falsa.**',
      '**2) El tope de 300 se comia la mitad de los anuncios.** La URL de aterrizaje pasaba por `txt()`, el saneador de CAMPOS DE FORMULARIO. Meta pone el fbclid PRIMERO (150-250 caracteres) y los utm_* DESPUES, asi que utm_content= arranca cerca del caracter 298 y su valor de 18 digitos queda entero afuera. Medido sobre 822 visitas con utm_content: **427 lo perdian completo (52%)**, 8 de 18 leads. Lo delataba que el MISMO dato estuviera entero en landing_visits, que guarda la URL con tope 500. **Una URL no es un campo de texto:** el tope de un nombre aplicado a una URL le corta la parte que mas informa, que en una URL de tracking esta al final.',
      '**3) Y el corte adentro del numero mandaba al anuncio EQUIVOCADO.** adIdDeLead aceptaba cualquier numero de 6 digitos o mas, asi que un id mutilado de 10 pasaba y se convertia en el deep-link a un anuncio que existe y no es el de ese lead. **Un null dice «no se»; esto afirma con confianza.** Los ad_id de Meta tienen 15-18 digitos y ese largo es parte de la validacion.',
      '⚠️ **Esa funcion vivia detras de server-only** y ningun test la podia importar — lo unico sin red justo donde se decide a que anuncio apunta la ficha de un lead. Se mudo a lib/atribucion-url.ts y queries.ts la re-exporta para no tocar los cuatro llamadores. Misma regla que exigirClienteDePrueba.',
      '**4) Sin backfill el arreglo es invisible.** El camino de escritura solo alcanza a los leads NUEVOS, y en un CRM la mayoria de las filas no se vuelve a tocar nunca. El dato estaba en landing_visits.landing_url: se cruza por visitor_id y se parsea con la MISMA funcion de la ruta, escribiendo solo columnas en null con coalesce. **El ws13 paso de 0 a 18 de 21 leads con su anuncio y su campana**, los 18 con un ad_id valido. Los 3 que no: 2 de Cal.com sin visitor_id, y 1 con SOLO fbclid.',
      '⚠️ **Y el fbclid es cableado muerto:** el snippet lo manda, el tipo lo declara, conAtribucion lo devuelve y hayAtribucion lo cuenta — y la tabla leads **no tiene columna fbclid** (un grep sobre lib/leads.ts no lo encuentra ni una vez). 857 de las 1.284 visitas de ese cliente lo traen. Es «escribir la salida no es ofrecerla» en su forma mas cara: cinco lugares que lo pasean, cero que lo guardan. **Queda ABIERTO** — o se le agrega la columna y se persiste (sirve para la API de conversiones de Meta), o se saca de los cinco lugares que hacen creer que el dato se guarda.',
    ],
    commits: [
      { sha: 'e5a09a06', msg: 'Atribucion de leads: eran CUATRO bugs en cuatro capas, y el que se veia era el mas chico', lineas: 250, archivos: 6 },
    ],
    archivos: [
      'app/crm/lead-view/OrigenCard.tsx — el case que faltaba',
      'app/api/track/optin/route.ts — urlTxt (tope 2.000) en vez del saneador de campos',
      'lib/atribucion-url.ts — recibe resolverAdIdPorNombre y adIdDeLead, que salieron de detras de server-only',
      '⚠️ Al commitear aparecio otra, y vale para cualquier sesion de este clon: el vecino tenia SU trabajo ya en el indice, asi que un git add <mis rutas> + git commit se llevo 20 archivos ajenos adentro de mi commit. Con un indice ajeno sucio va git commit -F msg -- <rutas>, que es un commit PARCIAL: ignora el indice y lo deja intacto',
    ],
  },
];
