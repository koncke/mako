# Pedidos perdidos: relevamiento del 28/10/2026 (Cerebro, claude4)

Martín, 28/10: «Revisa todos los pedidos de absolutamente todos lados, a ver si no se perdieron otras cosas», y después
«No frenes la investigación de pedidos perdidos, porque cuando se acabe la cuota justamente eso me sirve para la próxima
cuenta». Esto es lo que encontró. **La cuenta que entre con «Continua» arranca por la sección «Lo urgente».**

**Cómo se midió:** workflow `wf_fbaed0b3-099` (21 agentes; terminó a las 22:30):
- seis colectores (chats, Ops Center, tickets y grupos de WhatsApp, documentos, bitácoras y memoria), cada pedido desde
  el 22/10;
- once comprobadores, uno por área, contra main, las ramas y la base;
- un crítico de completitud.

Los datos crudos están en `C:/dev/revisiones/pedidos-2810/`: `estado.jsonl`, `martin-full.jsonl`, `despachos.jsonl` y
los filtrados de docs. El resultado entero está en el `journal.jsonl` del workflow, en
`~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/wf_fbaed0b3-099/`.

**Conteo, 362 pedidos:**

| Estado | Pedidos |
|---|---|
| En producción | 208 |
| Hechos en una rama sin subir | 32 |
| En curso con dueño | 27 |
| **Esperan una decisión de Martín** | **21** |
| **PERDIDOS (nadie los tiene)** | **70** |
| Descartados | 4 |

⚠️ El crítico marcó como **dudosos** algunos «perdidos». No son perdidos o hay que confirmarlos antes de repartirlos:
- el vigía de los grupos: venció el 27/10 y hay que recrearlo;
- el cartero como servicio: está cumplido;
- «todo lo pendiente del CRM»: tiene dueño;
- los tickets de Mauricio sin respuesta: el problema real es que Mauricio no tiene NINGÚN mensaje desde el 04/10;
- las iniciales con emoji.

## Lo urgente: cliente trabado y fechas

1. **El corte del token de Meta es el 03/11.** P2P Consulting nunca recibió el aviso. Joan (Código Inmobiliario)
   necesita la corrección, y Pablo Chávez, Sergio Arriata y Patricia Contreras el aviso. El chat Zernio arma el texto
   con lo que esté EN PRODUCCIÓN, y el Cerebro lo manda con `scripts/mensaje-equipo-al-grupo.mts`.
2. **Mauricio no tiene un solo mensaje en su grupo desde el 04/10.** Puede ser que no escriba o que la entrada esté rota.
   Es el cliente más activo, así que se mide primero (MaKo en WhatsApp).
3. **Joan pidió dos cosas en su grupo que nadie contestó:**
   - nombre y apellido de las llamadas sin marcar, y las cifras se contradicen;
   - los links de las llamadas de la semana pasada.

   El cálculo es de MaKo en WhatsApp y del CRM; la respuesta la manda el Cerebro.
4. **MaKo mandó al grupo de Código Inmobiliario un link con un dominio inventado** («hola-malo.com/crm/2761»). Va el
   saneo de la salida (MaKo en WhatsApp).
5. **Leila:**
   - el panel de Vida Poderosa dice que Ana Gómez no tiene datos de Fathom;
   - el Closing tiene entre 168 y 193 análisis en error porque se le acabó el crédito de Claude;
   - Fabi Pedraza: los datos fiscales, y la constancia adjunta desde el chat.
6. **Brigitte (ws15):** devolverle la espera de 1 h y el recordatorio en «Un Lead Entró 2». Es una escritura en
   producción y necesita el sí de Martín.
7. **Joan:** Ads Manager no le funcionaba y no ve las campañas de tres de sus clientes (Zernio).
8. **Ocho audios sin transcribir:** cinco de Martín y tres de Leandro (buffer 316, 318 y 327). Su contenido es justo lo
   que nunca se contestó. El de Leandro del 28/10 13:25 se perdió cuando Gemini se cortó por tiempo.

## Las fuentes que NADIE leyó (trabajo para la próxima vuelta)

Ver la crítica completa abajo. Las primeras:
- el reparto del 27/10 (workflow `wf_1f30be35-c5e`, con los MAU, los MK y las llamadas de Leandro, Leila y Aaron);
- `docs/feedback-22-10.md`;
- la llamada con Mauricio del 22/10;
- el WhatsApp personal de Martín con los clientes;
- los chats de los clientes dentro de la app que no terminaron en ticket;
- los mensajes del Ops Center que el Runner no levantó el 27/10;
- las capturas;
- el correo `equipo@hola-mako.com`.


# La lista (por estado y área, con el dueño sugerido)

## PERDIDO
### Automations (8)
- Advertencia al activar una automatización, porque el goteo está escondido y pueden salir muchos mensajes de golpe — quién: Martín · dueño sugerido: Automations · fuente: ops_pedidos 393f357a (respuesta a D3b, → chat «Debate» local_752add17), 25/10 02:11 UTC
- MAU-17: sacar de la #289 los avisos de cada respuesta al grupo de Mauricio — quién: Mauricio · dueño sugerido: Automations (el Cerebro pide el sí de Martín junto con MAU-07/08) · fuente: docs/relevo/automations-nube-2710.md:14, :64
- «Activa: empieza a las 9:00 (Tijuana)» al activar con el horario cerrado (y el nombre arriba de Configuraciones) — quién: Martín (pendiente del Cerebro del 23/10, tras la prueba en vivo) · dueño sugerido: Automations · fuente: memory/estado-23-10-madrugada.md:20-24 · memory/feedback-ui-22-10-noche.md:24-34
- «Completa el disparador» que no queda guardado al recargar (ítem 2 de la tanda del 27/10) — quién: tanda de 12 del 27/10 (demo) · dueño sugerido: Automations (el Cerebro pide el sí para el ws3) · fuente: docs/relevo/automations-nube-2710.md:68, :85
- Devolverle a Brigitte (ws15) la espera de 1 h y el recordatorio en «Un Lead Entró 2» (#266) — quién: Brigitte (clienta de Joan) · dueño sugerido: Cerebro (pedir el sí a Martín) → Automations (aplicarlo) · fuente: docs/relevo/automations-nube-2710.md:69, :86
- Que el prendido/apagado de un aviso que hace MaKo (configurar_aviso_whatsapp) se guarde donde mira el envío — quién: hallazgo del chat Automations (26/10), no es pedido textual de Martín · dueño sugerido: Automations · fuente: ops_pedidos c196f0a9 (contexto) · docs/hallazgos-comunicacion.md:426, :450
- Asistente por WhatsApp que avisa «cobrale a tal, tenés la visita» (agenda del día) — quién: Martín (promesa a Teo) · dueño sugerido: Chat nuevo «Asistente por WhatsApp», como decidió el Cerebro (o Automations para el disparador sin lead) · fuente: revisiones/2810-promesas-teo.md:58 · docs/relevo/automations.md:21-22
- Acción de automatización «Agendar llamada» en el primer hueco libre — quién: Martín (promesa a Teo) · dueño sugerido: Automations (sobre la reserva del CRM, proponer_agendar_reunion) · fuente: revisiones/2810-promesas-teo.md:94
### CRM (6)
- Lead Fabi Pedraza: dice que faltan datos fiscales y al cargarlos sólo salen SETTER y CLOSER; además adjuntar la constancia fiscal a la ficha desde el chat — quién: Leila · dueño sugerido: CRM y Chats (la pantalla) + MaKo en WhatsApp (los ofrecibles en WhatsApp) · fuente: doer_buffer 302-303 · doer_conv 1601, 1603 · revisiones/2710-leila-leila.md:95-101 · revisiones/2810-mi-tandaA-y-base.md:106
- Que nada pida R1/R2 si el negocio no las usa: sacar el «Tipo de evento de R1» obligatorio al conectar Calendly (X19) — quién: Martín / Mauricio · dueño sugerido: CRM y Chats (el ruteo de Calendly desde los eventos vinculados: lib/calendly-aviso-reglas.ts, lib/metodo-catalogo.ts) · fuente: docs/pedidos-crm.md:53,:72-73 · docs/relevo/crm.md:54-55
- El panel «Qué escribir» tarda: medir por qué (X17) — quién: Martín / Mauricio · dueño sugerido: CRM y Chats · fuente: docs/relevo/crm.md:53-54 · docs/pedidos-crm.md:57-58
- Asignar evento y Conectar Cal tardan mucho — quién: Martín · dueño sugerido: CRM y Chats · fuente: 4d1a09d4 L21745 p.1
- Implementar todo lo pendiente del CRM (61 de 341 pedidos de diseño) — quién: Martín · dueño sugerido: CRM y Chats (volver a medir los 61 contra main y sumarlos a su orden) · fuente: turnos local_94ec0e46 56bd65b3 p.20
- Scraper que trabaje con los DMs de Instagram y perfiles nuevos (y Google Maps / LinkedIn) — quién: Martín (promesa a Teo) · dueño sugerido: CRM y Chats (DMs de IG en lote); Martín decide la fuente para Maps y LinkedIn · fuente: revisiones/2810-promesas-teo.md:41-43
### Chats (1)
- Chats en el teléfono (/m/chats): el super admin no puede cambiar entre su número y el de MaKo (resto sin hacer del pedido del 24/10) — quién: Martín · dueño sugerido: CRM y Chats · fuente: e680c815 L21131 p.1 («que simplemente pueda cambiar entre mi número y el de MaKo») · dev/chats/bitacora.ts:118
### Copywriter (2)
- Los guiones publicitarios del negocio de Sergio Arriata (ws20) — quién: Joan Dowd (grupo del ws20) · dueño sugerido: Copywriter (los guiones de ws20); el aviso a Joan, por el Cerebro · fuente: doer_buffer 269, 271 · doer_conv 1503-1508 · revisiones/grupos-2810/ws20.txt:4
- El chat de MaKo en Carousels — quién: Teo · dueño sugerido: Copywriter (no hay chat vivo del grupo Image, donde vive Carousels: nav.ts:408-417) · fuente: revisiones/2810-promesas-teo.md:113
### Infra (4)
- Revisión de eficiencia de toda la app (Automations, Configuraciones, Second Brain, CRM, Dashboard lentos) — quién: Martín · dueño sugerido: Chat nuevo de Rendimiento/Infra (medir el Dashboard en producción) · fuente: d3a50e3f L2113 p.1 · dev/mako-ux-ui/bitacora.ts:268, :281
- App de escritorio con MaKo entero (todas las tabs), login en el navegador, Mac y Linux — quién: Martín (y Leandro, f04) · dueño sugerido: Web Generator: replicar landings (local_1dd40ee7), como T3 de sin conexión · fuente: e680c815 L25314 p.10 · docs/pendientes.md:21 (P3) · docs/relevo/mako-desktop.md:92-104
- Velocidad con mucha información (prueba de carga) — quién: Teo · dueño sugerido: Chat nuevo de Infra/Rendimiento · fuente: revisiones/2810-promesas-teo.md:64, :151
- Que la app de escritorio cubra con la suscripción también landings, reels, copies, anuncios y automatizaciones (D6b) — quién: Martín (promesa a Teo) · dueño sugerido: MaKo Desktop / IA del cliente, preguntándole antes a Martín si se extiende D6b o se corrige lo que se dice en la venta · fuente: revisiones/2810-promesas-teo.md:73
### Ops Center (7)
- El cartero como servicio de la app de escritorio (mientras, el chat visible desde la app); dejarlo registrado para la cuenta siguiente — quién: Martín · dueño sugerido: CRM y Chats, que es hoy el dueño de hecho del Ops Center y del cartero (hizo las versiones 1.21.0 y 1.22.0), junto con el chat que lleva MaKo Desktop («Web Generator: replicar landings» hizo MaKo sin conexión) · fuente: e680c815 L23586, L23868, L25314 p.16 · turnos local_94ec0e46 56bd65b3 p.16 · docs/feedback-24-10.md:43 · docs/pendientes.md:25 (P7) · docs/diseno-cartero-servic
- El Second Brain bien y funcional en el teléfono (punto 6 del 17/10) — quién: Martín · dueño sugerido: CRM y Chats (hoy /m/second-brain es el Ops Center del cliente en el teléfono); que lo mida en un Android y lo compare con otras apps · fuente: e680c815 L23982 · dev/centro-operaciones/bitacora.ts:1480, :1489 · dev/mako-mobile/bitacora.ts:224
- Mensajes desde el Ops Center al Cerebro no llegan o no responde («trabajando»): runner siempre activo y que toda cuenta nueva los reciba — quién: Martín · dueño sugerido: CRM y Chats (lib/runner.ts y el cartero); el ritual del Runner lo sigue el Cerebro · fuente: 0ee425c6 L26273 · 9bc46b5e L38061, L38805 · 6ea62e88 L388, L695
- Medir el tiempo de cada ticket, con alerta a las 24 h — quién: Martín (promesa a Teo) · dueño sugerido: CRM y Chats, que lleva la Ticketera (Soporte y bandeja: hizo 1ceabd85d y la caja de Soporte) · fuente: revisiones/2810-promesas-teo.md:83
- (Hallado al comprobar, no estaba en la lista) El Ops Center elige modelo y esfuerzo por fase (Sonnet para explorar, Opus para ejecutar), con el consumo medido antes y después — quién: Martín (por Aaron, ticket 876825880-11) · dueño sugerido: CRM y Chats (heredó el trabajo del Ops Center) · fuente: 0ee425c6 L25595 (punto 7) · 6ea62e88 ~L480 (pendientes del Ops Center de claude5)
- (Hallado al comprobar, no estaba en la lista) ChatGPT por suscripción en la PC del cliente: probarlo de punta a punta con Codex y habilitarlo, o dejar «Pronto» con el porqué — quién: Martín · dueño sugerido: CRM y Chats (heredero del Ops Center), y antes pedirle a Martín la cuenta de ChatGPT de prueba · fuente: 0ee425c6 L25595 (punto 6) · revisiones/2810-promesas-teo.md:87
- (Hallado al comprobar, no estaba en la lista) La app de escritorio como MaKo entero — quién: Leandro (ticket 874749710-04) · dueño sugerido: El chat que lleva MaKo Desktop (hoy «Web Generator: replicar landings», que hizo MaKo sin conexión), después de pasarle a Martín la decisión Tauri o Electron · fuente: 0ee425c6 L25595 (punto 9) · docs/relevo/mako-desktop.md ~95-104
### Planes/cobros (1)
- Que Leila deje de pagar lo que MaKo reemplaza: migrar su GoHighLevel con la API y bajar su comunidad de Skool (CapCut, Canva y Gamma también en su lista) — quién: Martín (para Leila) · dueño sugerido: CRM y Chats (importar contactos, etapas y automatizaciones por la API; ya existe app/crm/leads-importar.ts), o el chat «Migraciones» que el reparto del 27/10 pensaba abrir · fuente: 0ee425c6 L23420 · memory/leila-apps-y-pro-97.md:16-18 · revisiones/2810-promesas-teo.md:115
### Video/Image Editor (5)
- Editar un video pedido por chat: renderizar en un servidor de MaKo y aprovechar también MaKo Desktop — quién: Martín · dueño sugerido: «Video Editor: el ruido y los silencios de Leila» (local_c698e704), que sigue con Motion. La parte de MaKo Desktop, con el chat «MaKo Desktop: que funcione sin conexión» · fuente: ops_pedidos 73d536f9 (respuesta a D7a, → Debate local_752add17)
- La sugerencia «Quita las muletillas» tiene que andar en un video sin subtítulos (generarlos primero) — quién: Leila · dueño sugerido: «Video Editor: el ruido y los silencios de Leila» (local_c698e704) · fuente: revisiones/2710-leila-leila.md:85-91, :144
- Terminar de copiar CapCut: que sea un CapCut real (faltan 40 de 158 funciones y música de biblioteca) — quién: Martín; Teo · dueño sugerido: «Video Editor: el ruido y los silencios de Leila» (local_c698e704), después de Motion. La música, con la decisión D7g de Martín · fuente: docs/feedback-diseno-pendiente.md:28 · docs/editor-video/inventario-copia-capcut.md · revisiones/2810-promesas-teo.md:98, :158
- Almacenamiento: los proyectos del Video Editor viven en el navegador y no hay tope por plan — quién: Teo · dueño sugerido: local_c698e704 (Motion). El tope por plan, con «Planes, pagos y Partners» (local_46497093) · fuente: revisiones/2810-promesas-teo.md:152
- Que el Image Editor reemplace Canva: fotos de stock, plantillas de carrusel, Image Generator — quién: Martín (promesa a Teo) · dueño sugerido: local_c698e704 (Motion e Image Editor), con la decisión D7f de Martín · fuente: revisiones/2810-promesas-teo.md:99
### Web Generator/landings (5)
- Landing principal (#32) con la frase nueva «El mejor SaaS para ventas High Ticket, de punta a punta», sin «VSL Funnel» y con el scraper, como borrador sin publicar — quién: Martín · dueño sugerido: Web Generator: replicar landings (es escribir el documento #32 por la API o el editor, sin publicar). El Cerebro tiene que mandárselo. · fuente: ops_pedidos c250f453 · landings-2510-b:docs/relevo/landings-nube-2710.md (Brief A, Pendientes 1) · 6ea62e88 L5131 · REST landing_docs?id=eq.32
- Pixel: un VSL POR PÁGINA (marcar el VSL de la landing nueva no debe desmarcar el de la vieja; parte del pedido del «video viejo») — quién: Martín (lo bajó a pedido el Cerebro) · dueño sugerido: Web Generator: replicar landings (o quien retome el Pixel); terminar y commitear lo de C:/dev/wt-landings-av · fuente: d3a50e3f L7267 · git -C C:/dev/wt-landings-av diff · git grep origin/main lib/landing-videos.ts
- Réplica de landing con sus animaciones — quién: Leila (ticket 876825880-07) · dueño sugerido: Cerebro (pedirle la dirección a Leila por su grupo o ticket); después, Web Generator: replicar landings · fuente: landings-2510-b:docs/relevo/landings-nube-2710.md:36, :67, :75 · main:docs/hallazgos-editor-landing.md:3302
- Landing AI que haga pruebas A/B solo: detectar la sección que nadie ve y generar variaciones del hook y los copies — quién: Martín · dueño sugerido: Web Generator: replicar landings (o un chat Landings nuevo) · fuente: 0ee425c6 L8881 · main:docs/relevo/landing-generator.md:11-23 · main:docs/diseno-pruebas-ab.md:57-58
- Que la landing de «diseño + objetivo» salga con los copies de la oferta — quién: Martín (promesa a Teo) · dueño sugerido: Web Generator: replicar landings · fuente: C:/dev/revisiones/2810-promesas-teo.md:97 · git grep origin/main lib/editor-landing/plantillas.ts
### WhatsApp/MaKo en el grupo (7)
- Guardia (vigía) de MaKo en todos los grupos de WhatsApp detectando bugs — quién: Martín · dueño sugerido: Cerebro (VIGIA_GRUPOS=seco en Vercel, mirar el conteo, después on) con MaKo en WhatsApp · fuente: e680c815 L20328
- (Parte de F3, sin dueño) Cuando Brigitte contesta «Ya contesté» o «Si contacte Eli» al «¿lo contactaron?», MaKo registra el contacto en ese lead y corta su recordatorio — quién: Martín (por Brigitte, ws15) · dueño sugerido: MaKo en WhatsApp (o Automations, dueño de insistencias y flujos) · fuente: revisiones/2810-diagnostico-mako-whatsapp.md:75, :179-182, :318-321
- (Parte de F3, sin dueño) Corregir o sacar los links con un dominio inventado que MaKo manda al grupo («hola-malo.com/crm/2761») — quién: Código Inmobiliario (diagnóstico del Cerebro) · dueño sugerido: MaKo en WhatsApp (saneo de la salida al grupo) · fuente: doer_conv 1502 · revisiones/2810-diagnostico-mako-whatsapp.md:183, :332, :826
- Tickets #5 y #6: MaKo no le contesta a Mauricio en su grupo (Claude vetado; «sin proveedor gratis») — quién: Mauricio (detectado por el sistema) · dueño sugerido: MaKo en WhatsApp (test del ws1 en la tanda A y reabrir #5/#6 hasta probarlo con un mensaje real) · fuente: tickets #5, #6 · ops_pedidos 1e5ca526, 6e5ee912 · docs/pendientes.md:20 (P2)
- Joan pidió nombre y apellido de las llamadas que quedaron sin marcar (y las cifras se contradicen: 25 vs 28 no-shows, 14 vs 10 sin marcar) — quién: Joan Dowd (Código Inmobiliario, ws13) · dueño sugerido: Cerebro (contestarle a Joan con scripts/mensaje-equipo-al-grupo.mts); las cifras, CRM y Chats · fuente: doer_buffer 292 · doer_conv 1583-1584, 1574, 1580
- Joan pidió los links de las llamadas de la semana pasada (creía que MaKo estaba conectado a su Loom) — quién: Joan Dowd (ws13) · dueño sugerido: MaKo en WhatsApp (que devuelva los links de grabación de los leads) y Cerebro (contestarle a Joan) · fuente: doer_buffer 288 · doer_conv 1575-1576
- (Resto del aviso de Zernio) P2P Consulting (ws14) nunca recibió el aviso del corte del token de Meta del 03/11 — quién: Martín · dueño sugerido: Zernio y CAPI (por email o por el teléfono del dueño) / Cerebro · fuente: operaciones/avisos/aviso-token-meta-2710.json · app_settings ws14
### Zernio/Instagram/Calendar (6)
- Tanda C de la deprecación del token: editar el público de un conjunto, crear campaña y conjunto, barrido de leads (pollMetaLeads) por Zernio, reproductor del anuncio, crear públicos y alcance — quién: Martín · dueño sugerido: Zernio y CAPI («Zernio, CAPI y la venta externa de Mauricio») · fuente: 0ee425c6 L7798, L12363 · docs/relevo/zernio-nube-2710.md:71-72 · docs/relevo/zernio-capi.md:136-151 (main) · memory/zernio-reemplaza-api-meta.md:19
- Mandar a Joan la corrección en el grupo «MaKo <> Código Inmobiliario» (ws13): «ya no es así, Meta se conecta con tu Facebook por Zernio». Mismo caso: el aviso a Pablo Chávez, Sergio Arriata y Patricia Contreras antes del corte del 03/11 — quién: Martín · dueño sugerido: Cerebro: mandarlo con scripts/mensaje-equipo-al-grupo.mts --ws 13, y lo mismo para ws de Pablo, Sergio y Patricia; el chat Zernio y CAPI revisa el texto · fuente: 0ee425c6 L26423 (27/10 18:25), L27324 · docs/relevo/zernio-nube-2710.md:53, :77-78 (rama zernio-2510)
- Plantillas de Instagram en el Dashboard (Reels, Historias, DMs) y plantilla «Reporte de agencia» (compartir una hoja, PDF) sobre la fuente orgánica — quién: Martín (promesa a Teo) · dueño sugerido: Zernio y CAPI (tiene la fuente lib/zernio-organico.ts), cuando la fuente pase la verificación; las plantillas van en PLANTILLAS_HOJA del Dashboard · fuente: revisiones/2810-promesas-teo.md:33, :79 · docs/relevo/zernio-capi.md:35, :248 (rama zernio-2510)
- Varias claves de Zernio en un negocio (de distintos emails), eligiendo cuál usa cada red — quién: Leila · dueño sugerido: Zernio y CAPI; antes, el Cerebro decide si va y le contesta a Leila en su grupo · fuente: docs/relevo/zernio-capi.md:151-162 (main) · docs/hallazgos-integraciones.md:2107 · ops 876470842-23 (27/10)
- MAU-14: la opción del Pixel de MaKo «se movió» y Mauricio no la encontraba — quién: Mauricio · dueño sugerido: Landings (dueño del Pixel; la lista lo marca «parcial landings»), después de preguntarle a Mauricio en su grupo qué opción buscaba · fuente: docs/relevo/zernio-nube-2710.md:70 · 0ee425c6 (tareas MAU: «MAU-14 parcial landings»)
- Calendario: la grilla se ve muy de Google, personalizarla — quién: Martín · dueño sugerido: Planes (Calendario), coordinando con Zernio, que hoy toca app/calendario/CalendarioApp.tsx · fuente: dev/calendario/bitacora.ts:120, :134 (main) · docs/feedback-24-10.md:202 (f07)
### otra (18)
- Joan: Ads Manager no le funcionaba y no ve en MaKo las campañas de tres de sus clientes — quién: Joan (vía Martín) · dueño sugerido: Zernio, CAPI y la venta externa de Mauricio (volver a medir y conectar ws21); el Cerebro, el mensaje a Joan · fuente: d3a50e3f L2106 · dev/ads-manager/bitacora.ts:546
- Revisión completa de la API de MaKo (faltan acciones), empezando por dar y quitar el acceso a un curso — quién: Martín · dueño sugerido: Por área: Automations (P0-7), Web Generator: replicar landings (P0-9), Copywriter (P0-10 y P0-11) · fuente: d3a50e3f L2546 · ops_pedidos 68285fda · dev/api-mako/bitacora.ts:320-461
- Otros grabadores de reuniones (Loom, Read AI, Google Meet, Grain, MeetGeek, Avoma, Granola, Krisp) y que el Plan y todo lo que lee de Fathom lea de todos — quién: Martín · dueño sugerido: MaKo inteligente · fuente: 0ee425c6 L18338 p.4 · turnos local_62f6ff43 643ecacb · docs/pendientes.md:28 (P13) · docs/hallazgos-integraciones.md:125 · memory/grabadores-reuniones.md:17
- Sacar a un alumno del producto y de todos los cursos: los sacados de antes siguen con el curso abierto y volver a invitar lo reabre — quién: Leandro (f32, f33) · dueño sugerido: CRM y Chats · fuente: docs/feedback-24-10.md:195-196 · docs/hallazgos-customer-success.md:5882-5891 · dev/customer-success/bitacora.ts:1124
- Que todo lo que MaKo arma por prompt se vea construyéndose (replicar, Automations, editor, dashboards), en toda la app — quién: Martín · dueño sugerido: Automations (lienzo nodo por nodo); Video Editor (Image Editor) · fuente: 6ea62e88 L1503 · memory/construir-a-la-vista.md:8, :12
- Las iniciales con emoji que rompen pantallas (React #418) en otras tabs — quién: ticket #10 · dueño sugerido: CRM y Chats · fuente: docs/hallazgos-ui.md:139-146, :221-228 · docs/relevo/landings-nube-2710.md:37 · docs/relevo/automations-nube-2710.md:72
- Quitar «Cliente de Diseño», que comparte píxel y tokens con Mauricio (separar la cuenta ws1/ws4) — quién: Martín · dueño sugerido: Zernio, CAPI y la venta externa de Mauricio · fuente: e680c815 L25314 p.6 · turnos local_94ec0e46 56bd65b3 p.6 · docs/feedback-24-10.md:34 · docs/hallazgos-comunicacion.md (rama aut-2510)
- Publicar la extensión en la Chrome Web Store sin pedir permiso (0.74.3, y la versión con el píxel), con la descripción rediseñada; los usuarios la instalan desde la tienda, no descargándola — quién: Martín · dueño sugerido: Cerebro (subirla desde el Chrome de Martín); CRM y Chats (mezclar tienda-cws-2710 cuando Google apruebe) · fuente: 0ee425c6 L27424, L27516 · turnos local_3f1a66d3 aa2dfdc9, ff50d010 · docs/pedidos-crm.md:31 · revisiones/2810-promesas-teo.md:93 · memory/aprobacion-prod-en-el-
- Onboarding para todos los nichos (no por cliente) que no deja avanzar sin el setup (app de escritorio, extensión, Meta con login), detectando lo ya hecho — quién: Martín · dueño sugerido: Planes, pagos y Partners · fuente: 0ee425c6 L27516 · turnos local_3f1a66d3 ff50d010
- Offer: al analizar muchos documentos, decir «los analizo y te aviso» y avisar al terminar por el grupo de WhatsApp (O9) — quién: Mauricio · dueño sugerido: MaKo en WhatsApp · fuente: docs/feedback-22-10.md:45 · docs/hallazgos-offer.md:1050-1052
- Revisar las 3 últimas llamadas, el grupo Makito (Joan y Juanfran), los tickets y los grupos de MaKo en WhatsApp — quién: Martín · dueño sugerido: Cerebro (volver a repartir lo que fue a los chats de la cuenta 5) · fuente: 0ee425c6 L25122
- Revisar los chats de WhatsApp de Martín con Leila y Mauricio, que pidieron cosas — quién: Leila y Mauricio (vía Martín) · dueño sugerido: MaKo inteligente (MAU-03) · fuente: 0ee425c6 L25453
- Conectar Google Drive para leer links — quién: Martín · dueño sugerido: CRM y Chats (las cajas de chat que leen adjuntos) · fuente: 0ee425c6 L25040
- El panel de Vida Poderosa dice que Ana Gómez no tiene datos de Fathom, aunque tiene sesión con ella todos los lunes — quién: Leila · dueño sugerido: MaKo en WhatsApp (F2f) · fuente: doer_buffer 293 · doer_conv 1585
- Fathom no puede analizar la llamada tras 4 intentos: el Closing de Leila tiene 168-193 análisis en error porque su Claude se quedó sin crédito; dueños de tareas mal puestos por Fathom — quién: Leila · dueño sugerido: MaKo en WhatsApp (F2f) · fuente: doer_buffer 301 · doer_conv 1565, 1599-1600 · docs/relevo/cerebro-historia.md:38-39 · docs/hallazgos-closing.md:92-97 · revisiones/2810-diagnostico-mako-whatsap
- Que MaKo recuerde o corrija un dato del perfil desde el chat (LíderMente es de 7:30 a 9:30) — quién: Leila · dueño sugerido: MaKo inteligente · fuente: revisiones/2710-leila-leila.md:105-111
- Código de verificación por email — quién: Martín (promesa a Teo) · dueño sugerido: Planes, pagos y Partners · fuente: revisiones/2810-promesas-teo.md:60
- Tutoriales: recorridos en Plan, Chats, Offer, Video, Image, Copywriting y Ads Manager, y videos cortos — quién: Martín (promesa a Teo) · dueño sugerido: El Cerebro lo reparte por tab: CRM y Chats (Chats), Video Editor (Video e Image), Copywriter (Copywriting), Zernio (Ads Manager) · fuente: revisiones/2810-promesas-teo.md:61, :153
## ESPERA_DECISION
### Automations (4)
- MAU-07: en la automatización del Sprint, «Si responde» → mover a «seguimientos» — quién: Mauricio · dueño sugerido: Automations (con el sí de Martín) · fuente: docs/relevo/automations-nube-2710.md:14, :62, :100-106
- MAU-08: etiqueta «SPRINT 3 DÍAS» al entrar al Sprint, y en lote a los que ya pasaron — quién: Mauricio · dueño sugerido: Automations (con el sí de Martín) · fuente: docs/relevo/automations-nube-2710.md:14, :63, :107-109
- Después de «Ganado»: el link del grupo de WhatsApp y la nutrición en el grupo hasta el evento (A7) — quién: Mauricio · dueño sugerido: Automations (y pedirle el link a Mauricio) · fuente: docs/feedback-22-10.md:62
- Avisos al grupo de lead de formulario y de reserva (ítem 1 de la tanda del 27/10) — quién: tanda de 12 del 27/10 (llamadas y grupo Makito) · dueño sugerido: Automations; Cerebro · fuente: docs/relevo/automations-nube-2710.md:68, :85 · docs/relevo/cerebro.md:99
### CRM (2)
- Plan de pagos de Nadia H Tremari (lead 2605): figura $4.235,29 x 12 cuotas día 8 y es quincenal (días 1 y 15); la herramienta no permitía quincenas (ticket #13) — quién: Leila · dueño sugerido: Cerebro (mandar la repregunta) → Leila confirma → CRM y Chats carga el plan · fuente: tickets #13 · ops_pedidos 070d66ad, c1c13cad · docs/relevo/crm.md:49-52 · docs/pedidos-crm.md:28-29 · dev/crm/bitacora.ts:3796 · revisiones/2710-leila-leila.md:
- Vista previa con foto de perfil en el buscador de IG: vincular el IG de MaKo y, mientras, traer la info por scraping (motores de búsqueda o extensión) — quién: Martín · dueño sugerido: Martín (Meta y la fuente paga) → CRM y Chats · fuente: 4d1a09d4 L16969 · e680c815 L27672 p.21 · 981e3af7 L3911 · ops_pedidos 81263f7c · dev/crm/bitacora.ts:3309
### Infra (6)
- Subir MaKo a la Play Store y a la App Store — quién: Martín · dueño sugerido: ? · fuente: 4d1a09d4 L16183 · ops_pedidos c2a612dc · memory/tiendas-play-appstore.md
- Firma del instalador: qué comprar y pagar la más barata; mientras, publicar sin firmar; medir si un camino a leads usa la PC del cliente — quién: Martín · dueño sugerido: ? · fuente: 0ee425c6 L8109 · ops_pedidos 781ed2b6, 66773ea9, 6cc1ad2b
- GPT y Gemini también en la PC — quién: Martín · dueño sugerido: ? · fuente: d3a50e3f L5094 · e680c815 L20223
- Deprecar Railway (Evolution) y llevarlo dentro de MaKo — quién: Martín · dueño sugerido: Infra (que el Cerebro lo anote como trabado a Martín) · fuente: d3a50e3f L2840 · ops_pedidos 384828b4
- Si se cae un servidor, pasar solo a otro (réplica de Supabase, segunda región, segunda Evolution) — quién: Martín (promesa a Teo) · dueño sugerido: ? · fuente: revisiones/2810-promesas-teo.md:39
- Correr en la nube los chats de implementación para ahorrar RAM — quién: Martín · dueño sugerido: ? · fuente: memory/chats-en-la-nube.md:23, :28
### Planes/cobros (1)
- Garantía: devolver el dinero si no funciona — quién: Martín (promesa a Teo) · dueño sugerido: Martín · fuente: revisiones/2810-promesas-teo.md:40
### Video/Image Editor (2)
- Ticket #15: el Video Editor no le importa un mp4 («ESP_Fabi sentada_limpio.mp4») — quién: Leila · dueño sugerido: local_c698e704 cuando llegue el nuevo reporte. Cerrar el ticket: el Cerebro · fuente: tickets #15 · ops_pedidos (turnos local_3f1a66d3 27/10 21:33; local_c698e704 28/10 20:05) · docs/relevo/motion-nube-2710.md:39 · dev/video-editor/bitacora.ts:27
- Submagic y VidIQ al 100% dentro de MaKo para el 09/11, para que Leila deje de pagarlos — quién: Martín (compromiso con Leila) · dueño sugerido: Motion (local_c698e704) cuando Martín lo diga · fuente: 0ee425c6 L23420, L26799 · docs/relevo/motion-nube-2710.md:88, :101 · docs/relevo/cerebro-historia.md:38-39 · memory/leila-apps-y-pro-97.md:17-18, :38
### Web Generator/landings (2)
- Landings nuevas de MaKo: investigar cómo venden los que más venden (no SaaS), landing principal y 12 por función/cliente, cierre con planes y prueba gratis, verlas antes de publicar — quién: Martín · dueño sugerido: Web Generator: replicar landings, cuando Martín diga los cambios · fuente: ops_pedidos 742c0d5d, 2c620a42, b1fca173 · tren-w:docs/relevo/cerebro.md:182 · REST landing_docs?workspace_id=eq.9
- Código Inmobiliario manda nombre y email en la URL: borrar los datos guardados en las visitas (CI y P2P, ~670) y avisarle a la agencia — quién: Martín · dueño sugerido: Martín (que lo corra); el Cerebro tiene que sumarlo a «Trabado esperando a Martín» · fuente: ops_pedidos 3fcf71eb, af96b761 · main:docs/relevo/landing-generator.md:101-104 · REST vsl_events/landing_visits (conteos)
### WhatsApp/MaKo en el grupo (1)
- (Resto del aviso de Zernio) Corrección a Joan en su grupo y aviso a Pablo Chávez, Sergio Arriata y Patricia Contreras — quién: Martín · dueño sugerido: Cerebro (decidir si sale sin preguntar o preguntarle a Martín) · fuente: docs/relevo/zernio-nube-2710.md:77-78
### Zernio/Instagram/Calendar (1)
- Conectar Instagram y Facebook en el onboarding sin pegar la clave de Zernio (cuenta de Zernio de la plataforma con un perfil por negocio) — quién: Martín (promesa a Teo) · dueño sugerido: ? · fuente: revisiones/2810-promesas-teo.md:75 · docs/relevo/zernio-capi.md:26, :32-34, :249-251 (rama zernio-2510)
### otra (2)
- Deprecar Fathom, replicarlo en MaKo y el Closing Script en vivo (para más tarde) — quién: Martín · dueño sugerido: ? · fuente: 0ee425c6 L12363 · docs/feedback-25-10-tarde.md:13 · docs/pendientes.md:29 (P12) · memory/feedback-25-10-tarde.md:16
- Idea: el Media Buyer pasa a gestor de todas las plataformas (Meta, Reels, YouTube, emails, landings); opinión y nombre, sin implementar — quién: Martín · dueño sugerido: ? · fuente: 5dabbb04 L614 → 6ea62e88 L878 · ops_pedidos 9110bf80

# La crítica de completitud (textual)

**Crítica de completitud del relevamiento de pedidos (desde el 22/10)**

Verifiqué cuatro dudas puntuales, todo en modo lectura:
- Leí `C:/dev/wt-push-q/docs/feedback-24-10.md`, que se modificó por última vez el 24/10 a las 23:22.
- Leí `C:/dev/wt-push-q/docs/feedback-25-10-tarde.md`.
- Revisé los tickets en `C:/dev/revisiones/pedidos-2810/tickets-grupos/tickets.json`.
- Revisé la memoria `vigia-mako-grupos.md`.

## 1. Fuentes que nadie miró o que se miraron a medias

1. **El reparto del 27/10.** Es el workflow `wf_1f30be35-c5e`, guardado en el scratchpad de la sesión 0ee425c6 y en `side-session-notes/local_3f1a66d3.../`. Ahí están los MAU-xx, los MK-xx y los ítems de las llamadas de Leandro, Leila y Aaron, y la mayoría no se nombra en ningún otro lado. Es exactamente donde viviría un «se lo paso yo» que no se pasó. Es la prioridad número uno.
2. **Los documentos de feedback del repo, que no eran fuente de nadie.** Los revisé:
   - En `feedback-24-10.md`, los puntos 1, 2 y 24 sí están en el resultado.
   - De la llamada con Leandro faltan ítems marcados «pendiente» que no figuran en el resultado:
     - **f11:** que la opción de completar datos se descubra sola.
     - **f18:** si el usuario pregunta en «Editar» algo que era de «Discutir», que MaKo responda la pregunta.
     - **f19:** el ícono equivocado en la respuesta de MaKo.
     - **f22:** MaKo inventa un bloque de Instagram que no existe.
     - **f30:** el contexto de MaKo sigue diciendo «Customer Success › Curso», en `lib/api-mako/areas/curso.def.ts` y en `cs.def.ts`.
     - **f34:** la criatura se esconde detrás de la sidebar.
   - En `feedback-25-10-tarde.md` faltan:
     - El punto 16: «No veo bien las capturas, ponmelas en tabs».
     - El pedido inicial: el link para cargar su tarjeta en la cuenta de MaKo y probar Zernio.
   - `feedback-22-10.md` (76 líneas): no lo leyó nadie.
3. **La llamada con Mauricio del 22/10** (`C:/dev/cerebro-herramientas/llamada-mau-22-10.txt`): sin leer. Los puntos C3, C4 y C5 no aparecen con su número en ningún lado.
4. **El WhatsApp personal de Martín** con Leila, Mauricio y los demás clientes, y lo que Martín o el equipo escribió en los grupos: `mako_doer_buffer` no tiene ningún mensaje con fromMe=true. El caso que disparó la revisión, la difusión de Leila «vía Martín», es de este tipo. El propio resultado anota «Revisar los chats de WhatsApp de Martín con Leila y Mauricio» como PERDIDO, y aun así nadie los leyó.
5. **Los chats de los clientes dentro de la app**: el Ops Center del cliente, Soporte, el chat de MaKo en cada tab y el hilo 52 del Second Brain. Sólo entraron los que terminaron en ticket. Los tickets #21 y #22 (los 394 leads de Leila) existen únicamente porque MaKo dijo «no puedo». Cuando MaKo responde con un rodeo, no se abre ticket y el pedido no queda en ningún lado.
6. **Mauricio (negocio 1)** no tiene ningún mensaje en el buffer ni en la conversación desde el 04/10, y los negocios 9, 18 y 22 no tienen nada desde el 22/10. Es el cliente más activo. Nadie lo explicó: puede ser que no escriban o que la ingesta esté rota, y en ese caso se perdieron todos sus pedidos.
7. **Los mensajes del Ops Center que el Runner no levantó** (27/10 18:23 y 22:18). `operaciones_pedidos` se leyó completa, pero nadie cruzó esas dos horas contra la base. Además, el pedido 34458d6f («La PC esta bugeada…», 28/10 21:31) quedó «incierto» y no figura en el resultado.
8. **Las decisiones de la ticketera** (`admin_decisiones`) devolvieron 0 filas desde el 21/10 con la columna `creada_at`. Si el nombre real de la columna es otro, ese «vacío» es un error disfrazado. No lo verifiqué.
9. **Los turnos del Centro**: unos 3.600 de rol «el» y unos 780 de rol «otro» se leyeron sólo por búsqueda. Lo que Martín escribió directo en un chat y ya salió de la ventana guardada no se ve. A eso se suman nueve briefs del Cerebro guardados truncados, que pueden cortar el textual de Martín.
10. **Canales que no se miraron**:
    - El correo `equipo@hola-mako.com`.
    - Las llamadas de Fathom desde el 22/10 que no sean las de Leandro, Leila, Aaron, Teo y Mauricio, por ejemplo con Joan, Florencia o Natalia.

## 2. Tipos de pedido que pudieron escaparse

- **Audios sin transcribir:**
  - Cinco `.ogg` de Martín: dos del 22/10, el del 23/10 («Tambien revisa esto»), el del 15/10 y el de Florencia del 25/10.
  - Tres de Leandro, en el buffer con ids 316, 318 y 327.
  - El ticket #18 confirma que la nota de voz de Leandro del 28/10 a las 13:25 se perdió porque Gemini se cortó por tiempo. Se cerró como «resuelto» cambiando cómo se transcriben los audios, pero lo que pedía ese audio nunca se recuperó.
- **Pedidos que sólo están en una captura:**
  - d3a50e3f L5836 (Zernio).
  - 0ee425c6 L2942.
  - 6ea62e88 L8671.
  - La imagen de Leila, buffer id 300.
- **Pedidos dichos en llamadas sin desglosar:** Mauricio C3 a C5, los MAU y MK sin nombrar, y los ítems del 27/10.
- **Pedidos de clientes que MaKo «resolvió» con un rodeo dentro de la app**, sin abrir ticket.
- **Prompts directos en chats** que salieron de la ventana de turnos, y textuales cortados en los briefs truncados.

## 3. Estados dudosos

**Marcados PERDIDO que probablemente no lo son:**
- **Vigía de MaKo en los grupos:** existe desde el 17/10 (MaKo Alert, `scripts/vigia-mako-grupos.mts`). Su cron (job 0d49a804) se borra al cerrarse la sesión y vencía el 27/10. Lo correcto es «venció el 27/10 y no consta que se haya recreado», no «nunca se pasó».
- **El cartero como servicio:** Martín pidió sólo «dejalo registrado», y quedó en `docs/diseno-cartero-servicio.md` (punto 16 del 24/10). Está cumplido.
- **«Implementar todo lo pendiente del CRM»:** el punto 20 del 24/10 dice «EN CURSO, 11 tandas en producción». Tiene dueño.
- **«Revisar las 3 últimas llamadas, el grupo Makito y los tickets»:** el reparto del 27/10 lo hizo. Lo que no se leyó es su resultado, así que el estado es desconocido, no perdido.
- **Tickets #5 y #6 (MaKo no le contesta a Mauricio):** los dos figuran «resuelto» el 18/10. El problema real es el silencio total de Mauricio desde el 04/10 (punto 1.6).
- **«Las iniciales con emoji rompen otras tabs»:** quien leyó los documentos dice que comparó «las iniciales» contra origin/main. Hay que confirmar antes de darlo por perdido.

**Estados que no se pueden probar:**
- **Los 6 pedidos del 24/10, marcados EN_PRODUCCION:** el punto 7 del 24/10 dice «SIN HACER», y la bitácora sólo los cuenta (2 cerrados, 2 repartidos, 2 en verificación) sin decir cuáles son.
- **Los 3 audios de Leandro, marcados EN_RAMA_SIN_SUBIR:** nadie sabe qué piden. Su estado real es «contenido desconocido».

**Duplicados con estados que se contradicen:**
- La corrección a Joan y el aviso a Pablo, Sergio y Patricia aparecen como PERDIDO en un lugar y ESPERA_DECISION en otro.
- «App de escritorio con MaKo entero» aparece tres veces: en Infra, en Ops Center y como D6b.
- Los 394 leads de Leila están en CRM y además en los tickets #21 y #22.

# Lo que cada colector declaró NO haber leído

- chats: Audios .ogg que Martín adjuntó y que no transcribí; sólo leí el texto que los acompaña: WhatsApp Ptt 2026-10-15 23.21.16, 2026-10-22 18.31.07 y 2026-10-22 18.29.37 (4d1a09d4.jsonl L22578), 2026-10-23 09.32.00 (d3a50e3f.jsonl L1226, 'Tambien revisa esto') y 2026-10-25 12.27.32 (audio de Florencia, 0ee425c6.jsonl L8982). Los pedidos que estén sólo dentro de esos audios no figuran en la lista.
- chats: No abrí las imágenes ni las capturas que vienen con los mensajes ni los adjuntos que bajó el Runner (C:/Users/marti/.claude/operaciones/adjuntos/...). Hay mensajes cuyo pedido está sólo en la captura y quedaron sin contenido: d3a50e3f.jsonl L5836 ('Tambien revisa eso e implementalo con Zernio'), 0ee425c6.jsonl L2942 ('Te mando estos adjuntos'), 6ea62e88.jsonl L8671 ('No puede andar tan mal esto...') y M150, firmado el 17/10.
- chats: Los mensajes del Ops Center que el Runner nunca levantó no quedan en ninguna sesión. Martín avisó que no llegaban el 27/10 a las 18:23 y a las 22:18. Hay que mirarlos en la base del Centro de Operaciones. Dos que el Runner sí levantó pero no pudo entregar (27/10 23:07 y 23:18, 5dabbb04.jsonl) los recuperé del tool_result y están en la lista.
- chats: 6ea62e88.jsonl L1415: el mensaje de Martín llega cortado en el transcript ('...para que lo corrijas y midas y pruebes si realmente').
- chats: No leí las transcripciones de subagentes ni de workflows (carpetas subagents/): no son mensajes de Martín.
- chats: El estado_en_fuente sale de buscar palabras clave en los despachos entre chats (SendMessage, start_session, send_message, Workflow, Agent) dentro de los 5 días siguientes a cada pedido. Muestra a quién se pasó, no si se hizo. 'Sin envío hallado' puede ser una paráfrasis que la búsqueda no encontró. Para M167, que es del 24/10, lo comprobé a mano contra los briefs del 24/10 20:37, que remiten a docs/feedback-24-10.md.
- chats: En el Runner 840d77b9, L2672 y L2756, hay una contraseña y un token que Martín pegó, y en 4d1a09d4.jsonl L18708 una clave de Apify. No son pedidos y no los copié.
- chats: Recorrí los 85 archivos por streaming con 0 líneas malas (C:/dev/revisiones/pedidos-2810/sesiones-martin/extraer.mjs, extra.mjs, despachos.mjs y estado.mjs). Los 425 mensajes de Martín y los relevos del Centro están en martin-full.jsonl, el estado por pedido en estado.jsonl y los despachos en despachos.jsonl, todo en esa misma carpeta.
- ops-center: operaciones.turnos.* (app_settings) guarda sólo una ventana de los últimos turnos de cada chat, no la conversación entera. Por ejemplo, no hay ningún prompt directo de Martín en el Cerebro claude3 (local_428051c1) del 22-23/10, ni los «24 puntos» que mandó al Cerebro claude1 el 24/10 cerca de las 23:00 (según el Cerebro, están textuales en docs/feedback-24-10.md). Lo que Martín escribió directo en un chat y ya salió de esa ventana no lo vi.
- ops-center: Textos guardados TRUNCADOS en la propia fuente: varios briefs del Cerebro que traen el textual de Martín se cortan a mitad (Planes 23/10 15:22, Cobros 23/10 15:22, Rendimiento y loaders 23/10 18:26, CRM 23/10 20:32, Planes y Automations 24/10 23:38, Clients 25/10 01:57, Agencias 25/10 20:13, MaKo inteligente 26/10 04:56, CRM y Chats 27/10 21:17). También se cortan los cierres de c1c13cad, fb449cf5 y b45f723f.
- ops-center: De los turnos leí completos los 63 de rol «yo» desde el 22/10, más el Cerebro claude1 del 24/10 de 19:00 a 24:00 y el Video Editor del 28/10 desde las 17:40. De los otros ~3.600 turnos «el» y ~780 «otro» sólo leí lo que encontré por búsqueda dirigida. Un «hecho» que no aparece en esa búsqueda no está descartado.
- ops-center: Adjuntos: no abrí ninguna captura (jpg/png de ~/.claude/operaciones/adjuntos/ ni de los pedidos) ni el txt «Charla de RAM_261026_010013.txt». Los pedidos con captura los cito sólo por su texto.
- ops-center: admin_decisiones (las decisiones de la ticketera) devolvió 0 filas desde el 21/10 (columna creada_at). No sé si dejó de usarse o si las decisiones viven en otro lado.
- ops-center: No leí los textuales de Martín que citan los briefs y viven en el repo o en worktrees: C:/dev/wt-push-q/docs/feedback-22-10.md, feedback-24-10.md, feedback-25-10-tarde.md, docs/pendientes.md y C:/dev/revisiones/2810-promesas-teo.md.
- ops-center: El pedido 34458d6f (28/10 21:31, «La PC esta bugeada, no funciona nada...») quedó «incierto»: el Runner se cerró a mitad de la entrega.
- ops-center: Las carpetas locales del cartero no guardan contenido: claude1..claude5/buzon y /acuses están vacías, entregados/ son marcadores de 0 bytes y cierres/ está vacía. Todo sale de Supabase (operaciones_pedidos desde el 21/10: 113 filas, 101 desde el 22/10, leídas completas). Crucé los ids del cartero.log desde el 22/10 contra la base: todos están, salvo 2eb71d44, que es del 17/10.
- tickets-grupos: Audios de Leandro (negocio 10) sin transcripción: 3 audios, en mako_doer_buffer id 316 (28/10 13:21 UTC), 318 (13:24) y 327 (19:24). No tienen turno en mako_doer_conv y su contenido es justo lo que nunca se contestó.
- tickets-grupos: Audios de los demás negocios: SÍ los leí. mako_doer_conv guarda la transcripción por wa_message_id: los 11 del negocio 13 y los 5 del negocio 11 están transcriptos y entran en esta revisión. Total de audios desde el 22/10: negocio 13 = 11, negocio 11 = 5, negocio 10 = 3 (sin leer).
- tickets-grupos: Imagen sin pie del negocio 11 (Leila), mako_doer_buffer id 300, 26/10 19:59 UTC: no la vi. MaKo contestó que no puede ver imágenes. De la otra imagen (id 304) sólo leí el pie.
- tickets-grupos: Mensajes de Martín y del equipo en los grupos: mako_doer_buffer no tiene ningún mensaje con fromMe=true desde el 22/10. Lo que Martín o el equipo escribió en los grupos de clientes no está en esta fuente.
- tickets-grupos: Negocio 1 (Mauricio): no tiene mensajes del cliente en mako_doer_buffer ni en mako_doer_conv desde el 04/10, y no pude distinguir si no escribe o si sus mensajes no entran. Los negocios 9, 18 y 22 tampoco tienen filas desde el 22/10.
- tickets-grupos: Chats web (Second Brain hilo 52, Ops Center y Soporte) donde nacieron los tickets #13, #21 y #22: no eran mi fuente. Sólo leí lo que quedó copiado en el ticket.
- tickets-grupos: No verifiqué en producción los tickets que figuran «resuelto» (#7, #8, #9, #10, #11, #14 y #16): sólo leí lo que dicen sus eventos.
- documentos: docs/hallazgos-*.md (unos 10 MB): no los leí enteros. Sólo filtré las entradas fechadas del 22 al 28/10 por «Sin hacer», «Falta», «Pendiente» y por derivaciones («es de», «se lo pasé», «del chat X»). Las listas de «Sin hacer» técnicas que no nombran a quién lo pidió no las convertí en pedidos. Lo filtrado está en C:/dev/revisiones/pedidos-2810/docs-repo/sinhacer-main.txt y fuertes.txt
- documentos: docs/hallazgos-video-editor.md: no leí entera la sección «Lo que quedó SIN hacer» (línea 1439, del 15/10, fuera de la ventana)
- documentos: docs/relevo/crm.md: leí hasta la línea 300 (secciones 0-Ω21 a 0-Ω30). docs/relevo/cerebro-historia.md: leí hasta la línea 200 (relevos del 24 al 27/10)
- documentos: docs/relevo/chatbot.md, centro-operaciones.md, landing-generator.md, settings.md, mako-desktop.md, ads-manager.md, offer.md, customer-success.md, pagos.md, suscripcion.md, integraciones.md, api-mako.md, ia-del-cliente.md y general-y-calendario.md: sólo las secciones fechadas del 22/10 en adelante, filtradas por marcadores (C:/dev/revisiones/pedidos-2810/docs-repo/relevo-recientes.txt). No los leí enteros
- documentos: docs/pendientes.md: sólo la capa del 24/10 (líneas 1-46). La foto del 17/10 (296 pendientes, línea 48 en adelante) es anterior a la ventana
- documentos: docs/feedback-diseno-pendiente.md: lo leí entero, pero sólo tomé las filas del 22/10 en adelante. La excepción es el pedido de CapCut del 15/10, por la pregunta de Martín sobre el editor
- documentos: El reparto del 27/10 de las llamadas de Leandro (874749710), Leila (876470842) y Aaron (876825880), del grupo Makito y de la Ticketera (workflow wf_1f30be35-c5e) vive en el scratchpad de la sesión 0ee425c6 del Cerebro y en side-session-notes/local_3f1a66d3.../ (automations-tanda-27-10.md, planes-claude5-27-10.md, crm-chats-claude5-27-10.md, zernio-aviso-joan-27-10.md y los LEEME). No son documentos del repo y no los leí. Los docs sólo nombran MAU-01, 02, 04, 07, 08, 10, 14, 17, 19 y 33; MK-01, 02, 03, 06, 12, 15 y 19; y de las llamadas, 876470842-14, 15, 16, 18, 23, 25 y 27, 876825880-01, 04, 06 y 07, y 874749710-11, 12, 14, 18 y 19. Del resto de los MAU-xx, MK-xx y de los ítems de esas llamadas no hay una sola línea en ningún doc: no los pude contrastar
- documentos: Las capturas del feedback del 24/10 (transcript del Cerebro de claude1) y el transcript de la llamada de Mauricio del 22/10 (C:/dev/cerebro-herramientas/llamada-mau-22-10.txt): no los leí
- documentos: Las ramas que no están entre las 40 más recientes (por ejemplo crm-b5-2310 y crm-cuotas-espera-revision): no miré sus docs
- documentos: Contra el código de origin/main verifiqué sólo algunas cosas: si ciertos commits están en main, las iniciales, /admin/cobros y /admin/agente, NAV_SOLO_PRO y /admin/estrategia. No verifiqué qué está DESPLEGADO en producción. Los demás estados son lo que dice la fuente
- bitacoras: Las 58 bitácoras de tren-w (C:/dev/wt-push-q, 629e72ef) las leí enteras. También leí las versiones más nuevas en las ramas aut-2510 (chatbot), crm-horas-2810 (api-mako), motion-imagen-2610 (video-editor e image-editor), desktop-offline-2810 y desktop-offline-t2-2810 (mako-mobile) y chatnuevo-adjuntos-2810 (centro-operaciones). Ninguna de las otras 40 ramas cambia una bitácora sin haberse juntado, y no hay cambios sin commitear en los worktrees. Scripts y salidas: C:/dev/revisiones/pedidos-2810/bitacoras/ (extraer.cjs, hitos-desde-2210.json, detalle.txt).
- bitacoras: app/admin/dev/centro-operaciones/ sólo tiene bitacora.ts. La cola de pedidos del Ops Center vive en la base y no la leí: no la doy por cubierta.
- bitacoras: docs/feedback-24-10.md (los 24 puntos de la noche y los f01 a f3x de la llamada con Leandro) no es mi fuente. Las bitácoras citan los puntos 3 a 23 y los f02, f03, f07, f08, f09, f11 a f15, f19, f22, f25, f26, f30 y f31. Los puntos 1, 2 y 24 y el resto de los f no aparecen en ninguna bitácora: NO los doy por cubiertos.
- bitacoras: docs/feedback-25-10-tarde.md: las bitácoras citan del 1 al 8 (Partners), el 9 (Agency, del chat «Agencias y clientes», sin hito; en git hay commits del 25 al 27/10) y el 11, 13, 14 y 15 (Classroom/navegación). Los puntos 10 y 12, y los que haya del 16 en adelante, no aparecen en ninguna bitácora.
- bitacoras: El punto 2 del pedido del 23/10 19:40 sobre el Second Brain no está citado: la bitácora sólo copia el 1 y el 3.
- bitacoras: Los seis pedidos de Martín del 24/10 que fueron al Cerebro cerrado de la cuenta 2: la bitácora sólo los cuenta (2 cerrados, 2 repartidos, 2 en verificación). No dice cuáles son.
- bitacoras: La llamada con Teo del 28/10: la única bitácora que la nombra es la del trabajo sin conexión («por ejemplo»). Lo demás de esa llamada no aparece.
- bitacoras: La llamada con Mauricio del 22/10 (C1 a C6): se citan C1, C2 y C6. C3, C4 y C5 no se nombran con su número.
- bitacoras: Tickets #11 y #12: ninguna bitácora los cierra, aunque el #7 al #10 y el #13 al #18 sí tienen hito. Su contenido no está en las bitácoras.
- bitacoras: La difusión desde el CRM que pidió Leila (el caso que disparó esta revisión) no aparece en ninguna bitácora, ni en esta ventana ni antes. Busqué «difusión» y «broadcast».
- bitacoras: Aviso para la pregunta del editor: la sección PARTES de la bitácora del Video Editor dice «Abrirlo a los clientes: cola (sólo el super admin)», pero app/video-editor/acceso.ts dice «Abierto a todos el 12/10/2026». Lo de Leila (ruido, silencios, ticket #15) está en origin/main. El chat de MaKo al costado del editor está sólo en la rama motion-imagen-2610, sin subir y sin mirar en un navegador.
- memoria: C:/dev/revisiones/2610-*.md: no existe ningún archivo con ese prefijo en C:/dev/revisiones (sólo 2710-* y 2810-*)
- memoria: C:/dev/revisiones/2810-verificacion-*.md (22 archivos, ~500 KB): leí sólo los títulos y las secciones, y busqué con grep pedido/pidió/Leila/Leandro/Mauricio/Teo/Martín. No los leí enteros: son verificaciones de código, y sólo saqué los pedidos que nombran (Leila 1 y 2, el anuncio de Teo, el Copywriter, sin conexión, la venta externa de Mauricio)
- memoria: C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md: leí 1-255 y 700-760; no leí 256-699 (reglas del prompt, cómo se prueba, crítica, lecturas de modelo/prompts/contexto) ni 761-853
- memoria: C:/dev/revisiones/2810-second-brain-relevamiento.md: leí 1-30, los títulos y lo que dio el grep; no lo leí entero
- memoria: C:/dev/revisiones/2710-leila-ticket.md: leí el resumen (1-14), el brief (125-175), «No pude verificar» (262-275) y la línea 337; no leí los hallazgos 15-124, el resto del brief 176-261 ni el refutador
- memoria: C:/dev/revisiones/2710-leila-ruido.md: leí 1-30 y 104-160; no leí los hallazgos 2-7 en detalle (30-104) ni el final del refutador
- memoria: C:/dev/revisiones/2710-leila-leila.md: leí 1-172; no leí el refutador (173 en adelante)
- memoria: C:/dev/revisiones/2810-closing-teo.md: leí 1-6 y 112-160; la parte 7-111 (feedback de closing) sólo por títulos
- memoria: C:/dev/revisiones/2710-chat-en-el-acto-928bdde0d.md, 2710-crm-*.md, 2710-wa-*.md, 2710-mi-34b0687f0.md, 2810-crm-1f02dd813.md, 2810-replicar-45a8e5234.md, 2810-ticketera-046d9e028.md, 2810-chats-unificados.md, 2810-mi-tandaA-y-base.md: son revisiones adversariales de código; leí resúmenes, títulos y grep, no enteros
- memoria: Memoria: no leí los archivos modificados antes del 22/10 (por fecha no pueden tener entradas de la ventana), salvo video-editor-capcut.md e image-editor-canva.md. De los técnicos de la ventana (verificar-en-navegador, cuenta-claude-como-saberlo, heredoc-come-backslash, pc-techo-ram-chrome, guardia-ram-relevo, sesiones-paralelas-git-add, minutos-github-actions, tren-de-pushes, subir-a-main-sin-traba, multi-tenant-workspaces, martinkoncke-plan-cockpit, meta-oauth-app-review, usuarios-admin-metodo, angulos-venta y otros parecidos) sólo busqué palabras de pendiente y citas de Martín fechadas del 22 al 28/10; no los leí enteros
- memoria: Docs del repo que la memoria cita como el lugar del estado o del reparto, fuera de mi fuente y sin leer: docs/feedback-25-10-tarde.md, docs/pendientes.md (P12, P13), docs/feedback-diseno-pendiente.md, docs/hallazgos-*.md, docs/relevo/*.md y C:/dev/cerebro-herramientas/*. Varios estados «sin cierre en la memoria» pueden estar resueltos ahí
- memoria: No pude confirmar qué abarcaba exactamente «lo del editor de Leila» (memory/nada-trabado.md:11): la memoria no lo detalla. Lo reconstruí con los diagnósticos del 27/10 (silencios, ruido, muletillas), el ticket #15 y el compromiso de VidIQ/Submagic
