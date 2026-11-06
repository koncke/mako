# Hallazgos — Lead Magnet Generator

Lo que no se deduce leyendo el código del área (`app/lead-magnet-generator/`, `lib/lead-magnets/`). El porqué del diseño de
la tab y la fuente que se copia, en [investigacion-lead-magnets.md](investigacion-lead-magnets.md); lo que falta y lo que
decide Martín, en [relevo/nube-lead-magnets.md](relevo/nube-lead-magnets.md).

## La tab, tanda 1 (nube, 6/11/2026)

**Vive en:** `lib/lead-magnets/`, `app/lead-magnet-generator/`, `app/m/lead-magnet-generator/`,
`lib/api-mako/areas/leadmagnet.def.ts`, `app/compartido/[token]/LeadMagnetCompartido.tsx`, `lib/entregable.ts`.

### La lista de lead magnets ya existía, y manda el PRIMERO

- `mako.entregable` (`lib/entregable.ts`) es la lista viva: la leen las automatizaciones, el grafo, los guiones y la API. La
  tabla `lead_magnets` (mig 0169) existe y no la lee nadie que mande algo: no se usó.
- **`{{negocio_lead_magnet_link}}` sale del PRIMERO de la lista** (`valoresDelLeadMagnet`, `lib/variables-del-lead.ts`), no del
  que se acaba de crear. Por eso la tab tiene «Ponerlo primero» y la API `primero_magnet`: armar uno nuevo no cambia lo que
  reciben los leads hasta que se lo pone arriba. Si un día cada automatización elige SU lead magnet, la regla vive ahí.
- La lista se escribe por compare-and-set (`cambiarSettingSi`) sobre la lectura ESTRICTA: con la base caída, escribir sobre
  la tolerante borraba la lista entera.

### Un bug viejo: editar el Entregable del onboarding borraba el link

- **Síntoma (no reportado, encontrado leyendo):** cambiarle el nombre a un lead magnet en el paso Entregable dejaba a las
  automatizaciones sin link.
- **Causa:** la acción `guardar` de `app/api/onboarding/entregable/route.ts` reconstruía cada fila con `{ id, nombre, tipo, queEs,
  fomo }`, sin `enlace`. Y `generar` tiraba las filas viejas, también las que tenían un link puesto.
- **Arreglo:** `guardar` funde por id sobre lo guardado; `generar` conserva las que tienen link o pieza. Es la regla de
  AGENTS.md «Un campo nuevo en un objeto que se guarda ENTERO se busca en TODOS los que lo escriben», en un campo de agosto.

### Lo que existe para captar, medido antes de escribir

- **El formulario de una landing ya entra al CRM:** el Pixel manda el envío a `/api/track/optin`, que crea el lead
  (`createLead`). Faltaba la página: se arma con el objetivo `lead-magnet` del Web Generator y `personalizarLanding` le pone el
  nombre, apunta el formulario a la página de gracias y le da a su botón el link del lead magnet.
- **La automatización NO lo toma al instante.** El alta no inscribe a nadie: la inscripción la hace el movimiento de etapa
  (`enrolarPorEvento('etapa')`) y, para un lead que nace parado en una etapa, el barrido de `/api/cron/nutricion`. Quien
  descarga el lead magnet puede esperar hasta ese barrido para recibir el mensaje con el link. La página de gracias ya lleva
  el link en su botón, así que el lead lo tiene en el acto; lo que espera es el WhatsApp o el email. Inscribir en el alta
  cambiaría el ritmo de todas las landings de todos los negocios: queda como decisión en el relevo.
- **El link que abre un lead sin cuenta:** un recurso nuevo de `shares`, `lead-magnet`, de SOLO LECTURA. Lo dibuja el server
  sin TipTap (`LeadMagnetCompartido`), y `paginaDelShareLM` lo exige en positivo: recurso, alcance `item`, permiso `ver`, un
  id de página del Copywriter. Un link de este recurso nunca edita (eso es el recurso `copywriter`).
- **El link no sale con la guía puesta** (`guiasQueQuedan`): si una sección todavía dice lo que escribió la plantilla, la tab
  dice cuáles cambiar. Una guía compartida es un lead magnet que promete y no entrega.

### Classroom y Dashboards no son plantillas, a propósito

- **Classroom:** el acceso a un curso es para clientes que ya compraron (un lead no entra). La clase grabada se arma como una
  landing con un objetivo nuevo, `clase-grabada` (`lib/editor-landing/plantillas.ts`): se registran y la ven en la página de
  gracias. Si Martín quiere que un lead entre a Classroom, es otra puerta y se decide aparte.
- **Dashboards:** compartir un informe muestra los números del negocio. La «planilla» (una tabla en Copywriting) cubre lo que
  un dashboard de regalo prometía, sin datos de nadie.

### Trampas que costaron una vuelta

- **Un `.css` importado en un componente que dibuja un test rompe la carga en node** (`SyntaxError: Unexpected token '.'`). La
  hoja de la página pública la importa `app/compartido/[token]/page.tsx`, no el componente.
- **«El ejemplo no tiene huecos» no es «no tiene corchetes».** La plantilla de prompts lleva `[cliente]` en cada prompt: es
  su contenido. El test busca las marcas de un hueco («por completar», «[Completar…»), no cualquier corchete.
- **Los ids de la API no llevan «lead»**: `RELEVANCIA_CRM` (`lib/mako-intencion.ts`) le suma puntos a todo id con esa
  palabra y una operación rara le saca el lugar a las del CRM en el presupuesto de 12.000 caracteres. Por eso
  `armar_magnet` y no `armar_lead_magnet`.
- **La tab es sólo de la plataforma por ahora**, en TRES lugares: `adminOnly` en `nav.ts` (esconde la fila), la puerta de
  `app/lead-magnet-generator/puerta.ts` (la pantalla y la ruta) y `soloPlataforma` en la API. Abrirla a los clientes es sacar
  las tres; sacar una sola deja una puerta abierta o una fila que no lleva a nada.
