# Hallazgos — Marketing CoPilot (la tab que antes era Ads Manager)

Área: `app/ads-manager/` y `lib/media-buyer/`. Pedido de Martín, 6/11/2026. Relevo: `docs/relevo/nube-marketing-copilot.md`.

## Renombrar una tab: el rótulo se cambia, la key no

- **Síntoma:** al llamarla «Marketing CoPilot» el primer intento rompía `guia-catalogo` («Entra a Ads Manager» en `lib/mako-capacidades.ts`), `sidebar-nueva` y las listas de More.
- **Causa:** `ads-manager` es una key que viven la base (capas, permisos, onboarding), la API y el móvil. La ruta `/ads-manager` la abren links guardados.
- **Regla:** se cambian `label` e `icon` en `app/_components/nav.ts` y `lib/movil-rutas.ts`; la key y la ruta NO. Los textos que le dicen a la persona dónde ir (`mako-capacidades.ts`, `lib/api-mako/tipos.ts`) llevan el nombre nuevo, y la API se regenera (`scripts/generar-api-doc.mjs`).
- **Trampa:** mover una tab de familia (Web Generator, de Marketing a Create) toca seis listas escritas a mano en tests (`sidebar-nueva`, `movil-mas-secciones`, `movil-rutas`) y el orden de More en `lib/movil-rutas.ts`, que debe seguir el de la barra.

## El agente se arma con reglas puras adelante, no con confianza en el modelo

- **Dónde:** `lib/media-buyer/copiloto.ts` (qué funnel conviene, `recomendarFunnel` / `evaluarFunnel`) y `lib/media-buyer/copiloto-contexto.ts` (lo que viaja al system).
- **Regla:** lo que se puede decidir con números (ticket, presupuesto, quién llama) lo decide el módulo puro y llega al system YA decidido («EL FUNNEL ELEGIDO NO LE SIRVE: …»). El modelo lo discute, no lo calcula. Un umbral se cambia en `UMBRALES` y los tests lo frenan en el borde exacto.
- **Las fuentes no se nombran:** `docs/conocimiento/anuncios-high-ticket.md` es de uso interno (casi todas las fuentes venden algo, ninguna cifra está auditada). El destilado (`copiloto-conocimiento.ts`) dice «un practicante de EE. UU., 2026», nunca el nombre; un test cruza la lista de nombres contra el documento para que no quede vieja.
- **Trampa del peso:** cada ficha de `lib/asesores` son ~5.000 caracteres en CADA mensaje. El CoPilot lleva a lo sumo dos (el referente elegido y una por tipo de funnel). Un test fija el tope.
- **Trampa de la tab:** el chat de una tab sólo toma su contexto propio si `MakoEnLaTab` declara `tab="Marketing CoPilot"` y la ruta lo mira (`desde.tab`). Cambiar el nombre en un lado y no en el otro lo deja hablando como el Ops Center, sin error. Un test lee los dos.
- **Una pantalla nueva con `<CajaChat>` entra en la lista de `tests/app-de-escritorio-todos-los-chats.test.ts`:** se pasó por alto en la primera entrega y lo cazó el test, no la revisión.

## Campañas: «un producto por columna» no escala; la columna es lo que hay que hacer

- **Síntoma:** con un solo producto en el CRM (el caso de Mauricio) todas las campañas caían en una columna; con seis, las de más bajaban de fila y perdían su rama.
- **Causa:** la columna era una dimensión del CRM y no de la decisión. El producto sirve para filtrar; lo que le importa a quien mira es qué hacer con cada campaña.
- **Dónde vive:** `lib/media-buyer/campanas-grupos.ts` (puro). Funcionan / En prueba / Para revisar, con la vara del negocio (su objetivo; si no lo puso, el que MaKo calculó; si tampoco, el promedio de la cuenta). **Poco dato no decide:** menos de 3 resultados espera; sin resultados se revisa sólo si ya gastó lo que cuesta uno.
- **Trampa:** la vara se mide con TODAS las visibles; sacar las pausadas antes la movería y con ella la columna de cada campaña.
- **Trampa de CSS:** una columna vacía en el teléfono ocupa una pantalla entera; `data-vacia` la esconde ahí y se deja en la computadora (ver que no hay nada para revisar es información).
- **Regla:** el color del costo en la tarjeta (`tono`, del backend) y la columna (acá) usan la misma tolerancia (20%); si una cambia, cambia la otra (`TOLERANCIA_CARO`).

## El filtro del push no corre lo que no se tocó

- **Síntoma:** dos tests cayeron DESPUÉS de subir (`movil-shell` decía «Ads Manager»; el inventario de cajas de MaKo no tenía la pantalla nueva).
- **Regla:** tras renombrar una tab o sumar una pantalla con `<CajaChat>`, correr a mano `tests/movil-*`, `sidebar-nueva`, `app-de-escritorio-todos-los-chats` y `media-buyer-*` antes de subir.

## La ficha del referente manda sobre el negocio si nadie la corrige (revisión del agente, 6/11)

- **Síntoma:** simulando 14 conversaciones con SÓLO el contexto del turno (unos 20.700 caracteres), el agente fallaba en 8: con US$20 por día aplicaba la ficha de anuncios (cinco campañas de venta, tres públicos por cuatro creativos, fases 10/70/10/10); a un coach con poco tiempo en YouTube le llegaba la ficha de canales automatizados que viven del CPM (40 videos, nichos, canales en inglés); y en Google/LinkedIn y en «garantía» no había nada, así que improvisaba.
- **Causa real (no la obvia):** el conocimiento de anuncios estaba bien; lo que desbarataba era la ficha de `lib/asesores`, que se pega sin saber del presupuesto ni del tipo de negocio. Y `planOrganico` (el reparto de piezas) existía pero NO llegaba al agente: contestaba «cuánto publico» de memoria.
- **Dónde vive:** `lib/media-buyer/copiloto-contexto.ts` → `REGLAS_DEL_COPILOTO` (3, 6, 8, 9, 10) y `negocioDelCopiloto` (TAMAÑO DE LA CUENTA, TODAVÍA NO SABES, reparto orgánico, YOUTUBE PARA ESTE NEGOCIO). Cada una la fija `tests/marketing-copilot-agente.test.ts` (conversaciones 7 a 14).
- **Regla:** todo lo que el código ya calculó (reparto, veredicto, cuántos conjuntos caben) viaja al agente; lo que no se calcula, no se le deja a la memoria del modelo. Una ficha nueva que pida estructura debe poder achicarse por presupuesto.
- **Sin hacer:** Google Ads y LinkedIn Ads no tienen cifras (el documento de anuncios los marca como pendientes, línea 176): el agente sólo da criterio. El perfil no guarda país ni «tiene casos»: se pregunta cada vez. Los montos del bloque del negocio salen como «$3,000» y el conocimiento escribe «US$3.000»: mezcla de separadores en español.

## Dos chats hicieron la misma tarea a la vez (6/11, segunda sesión de la nube)

- **Síntoma:** una sesión de la nube armó el Marketing CoPilot entero (agente, primera entrada, Campañas en tres columnas, Ajustes, el teléfono) y, al ir a subir, `main` ya lo tenía: otro chat (cuenta 3) recibió el MISMO pedido, lo empezó después y lo subió primero (`6dba2d56..7db26c61`, de 05:54 a 07:50).
- **Causa:** el pedido se repartió dos veces. Mi base (`4d095e31`, 00:30) era la buena al arrancar, así que «medir el árbol contra la rama del brief» no lo cazaba: llegó durante el trabajo.
- **Regla:** si el brief nombra su punta (`punta/<nombre>`), `git ls-remote origin 'refs/heads/punta/<nombre>'` al empezar y antes de cada tanda grande. Si ya existe y no es tuya, otro chat está en lo mismo: se para y se pregunta, o se suma a lo suyo.
- **Qué se hizo con lo duplicado:** se descartó entero y se sumó sólo lo que a `main` le faltaba (la sección de abajo). Lo de la otra sesión que podría servir, sin portarlo todavía: una operación de la API que propone la estrategia por canal sin pasar por la charla (`recomendar_estrategia_marketing`) y reglas de criterio de dos repos abiertos (`coreyhaines31/marketingskills`, MIT; `AgriciDaniel/claude-ads`, MIT), parafraseadas: fatiga con frecuencia de 7 días mayor a 3 (grave a 4) y CTR un 20 % abajo; escalar de a 20 % cada 3 a 5 días; landing con 5 % o más de conversión, si no, formulario; un webinar se paga en frío recién cuando anduvo en orgánico. Si alguna se suma, va a `REGLAS_DEL_COPILOTO`, con su licencia en el commit.

## El teléfono no hablaba con el CoPilot (6/11, segunda sesión)

- **Síntoma:** en el teléfono, «Pídele algo a MaKo» y «Pregúntale» de una tarjeta abrían `/m/mako`. Eso redirige al Second Brain, que no manda `desde`, así que el turno caía en el contexto general y MaKo no hablaba como CoPilot. La computadora sí manda `desde.tab = 'Marketing CoPilot'` (la estrella, `MakoEnLaTab`).
- **Dónde vive:** `app/m/ads/HojaDelCopiloto.tsx`: el Cerebro (`entrarAlCerebro`, la misma conversación que la estrella) con `desdeDelCopiloto` (`lib/media-buyer/copiloto.ts`), en la hoja de MaKo Mobile como la del Funnel Coach.
- **Segundo hueco, del mismo lado:** «Cambiar mi estrategia» es `/ads-manager?estrategia=1`, y el desvío al teléfono (`rutaMovil`) devolvía `/m/ads` pelado: la query se perdía y la página del teléfono tampoco la leía. Ahora viaja (`QUERY_DE_SECCION.ads`) y `app/m/ads/page.tsx` reabre la charla.
- **Tercero:** con un funnel de anuncios, el Plan sólo estaba en la computadora. El teléfono suma «Hoy | Plan» (`seccionesDelTelefono`, puro): Campañas y Biblioteca siguen en la computadora.
- **Regla:** un chat de una tab en el teléfono manda el MISMO `desde` que su estrella en la computadora; mandar a `/m/mako` pierde el contexto sin un error. Y un link que lleva query a una pantalla que existe en los dos lados se mira con `rutaMovil`: si la query decide algo, va en `QUERY_DE_SECCION`.
- **Trampa del banco:** la caja del chat del teléfono sale sin estilo si el contenedor no tiene `data-m` (`operaciones.css` lo pide; lo pone `app/m/layout.tsx`). `scripts/banco-copilot/telefono.tsx` lo pone.

