# Mapa del Ops Center · pagos-cuenta

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** Pagos es el jefe del área: cobros, cuotas, productos, «a quién cobrar», el plan de MaKo y el Billing de Martín. Ticketera lleva los tickets y la IA del cliente (el modal sin IA y la key de Claude del negocio, 25f9bbca6). Lo transversal va a Ops Center 3: los bloques en el hilo, confirmar adentro lo que hoy va a /mako/revisar y el bloque «Tus cuentas de IA». El ruteo de frases a herramientas va a MaKo en WhatsApp: el clasificador lib/mako-intencion.ts es suyo y lo usa el mismo turno. Equipo, Perfil y Configuración no tienen un chat propio que yo haya encontrado: van con Pagos, salvo lo de la sección «Tu cuenta», que sigue la pieza única de Ops Center 3.

**Tabs:**
- Pagos: la tab de la ficha del lead (app/crm/lead-view/ficha/pagos/*, app/crm/[id]/deal-actions.ts, cobros-actions.ts, pagos-campo-actions.ts). La misma tab se monta en Clients
- General › Cobranza: «A quién cobrarle» (app/general/Cobranza.tsx; en el teléfono, app/m/dashboard/CobranzaM.tsx)
- Productos: el catálogo con precio (Onboarding › app/onboarding/ProductosView.tsx + /api/onboarding/productos)
- Integraciones (/integraciones: IntegracionesBoard, ServicioConfigForm, /api/integraciones/credencial, Costo de MaKo)
- Configuración del negocio › General (/configuraciones: horario de envío y criterio de reuniones; hoy sólo la ve el super admin)
- Configuración del negocio › Notificaciones (/configuraciones/notificaciones)
- Configuración del negocio › Identidades fiscales y moneda (/configuraciones/fiscal)
- Configuración del negocio › Tu plan (/configuraciones/plan: ver el plan y Darme de baja)
- Equipo (/equipo, /api/equipo)
- Tu cuenta: Información personal, Seguridad, Notificaciones e Instalar (/perfil, /perfil/seguridad, /perfil/notificaciones, /perfil/instalar)
- Reportar problema (/tickets, app/tickets/TicketsCliente.tsx)
- Sólo Martín: Billing (/admin/cobros), la Ticketera dentro del Centro (/admin/operaciones?ticketera=tickets), Uso de las cuentas (app/admin/operaciones/Uso.tsx) y AI Models (/modelos-ia)

**Hoy:** 77 acciones · sí 16 · parcial 13 · no 46 · sin verificar 2.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Ver a quién cobrarle: la próxima cuota de cada cliente, con las vencidas primero | a_quien_cobrar (metricas, admin) | parcial | herramienta, bloque, motor | Lista «A quién cobrar»: la inicial en un círculo del color de su urgencia, el nombre, cuánto debe, cuándo vence o venció, y «Marcar cobrada» con Deshacer. Reusa app/general/Cobranza.tsx con `limite` y un «Ver todas» | M |
| Ver las cuotas vencidas y las que vencen pronto | cuotas_pendientes (metricas, admin) | no | herramienta, bloque | La misma lista «A quién cobrar», filtrada por vencidas o por vencer | S |
| Marcar una cuota cobrada, con fecha de hoy en la zona del negocio | marcar_pago_cobrado (crm) | si | bloque | Después de confirmar, la tarjeta del estado de cuenta del lead actualizada, con Deshacer | S |
| Desmarcar una cuota (deshacer el cobro) | marcar_pago_cobrado (pagado=false) | si | nada |  | S |
| Cobro de menos: la diferencia queda pendiente o es un descuento | marcar_pago_cobrado (montoUsd, resto) | parcial | bloque | Pregunta con dos chips en el hilo: «Queda pendiente» o «Es descuento» | S |
| Registrar un cobro en otra moneda («me pagó 500 mil pesos») | marcar_pago_cobrado (moneda, montoOriginal) | si | nada |  | S |
| Marcar cobrada con el comprobante: la IA lee el monto, la fecha y la hora | null | sin_verificar | herramienta, bloque | Tarjeta de confirmación con el monto, la fecha y la miniatura del comprobante, para corregir antes de confirmar | M |
| Registrar un pago fuera del plan | registrar_pago_suelto (crm) | si | nada |  | S |
| Ver el estado de cuenta de un lead: cuánto debe, cuánto pagó y sus cuotas | cobranza_lead (crm) | no | herramienta, bloque | Tarjeta del estado de cuenta del lead: qué debe, qué pagó y qué hacer ahora (lib/pagos-vistazo.ts + cobradoDelLead), con Marcar cobrada, Cobrar con link y Registrar pago, y «Abrir la ficha» para lo demás | M |
| Cobrar con un link de pago de un producto del catálogo | crear_link_pago (cobros) | si | bloque | Tarjeta del link creado: el monto, la pasarela, «Copiar» y el estado (pendiente o pagado), que se actualiza sola | S |
| Link de pago por un monto libre o de suscripción, sin producto del catálogo | null | no | herramienta, confirmacion | El asistente «Cobrar con link» (CobrarConLink, pagos/cobrar.tsx) en miniatura dentro del hilo: qué se cobra, cuánto, en qué moneda y cada cuánto | M |
| Cobrar UNA cuota con un link | crear_link_cuota (cobros) | si | bloque | Tarjeta del link, con Copiar | S |
| Anular un link que todavía no se pagó | anular_link_pago (cobros) | si | nada |  | S |
| Ver los cobros de Stripe y Mercado Pago y el detalle de cada uno | listar_cobros / ver_cobro (cobros) | si | bloque | Lista de cobros con un chip de estado (pendiente, pagado, fallido, reembolsado, anulado), como CobrosM.tsx | S |
| Reembolsar un cobro pagado (entero) | reembolsar_cobro (cobros, pantalla, admin) | parcial | confirmacion, bloque | Revisión adentro del hilo: el cobro, el monto, el motivo editable, «No se puede deshacer» pegado al botón y doble confirmación | M |
| Cancelar una suscripción de la pasarela | cancelar_suscripcion (cobros, pantalla, admin) | parcial | confirmacion, bloque | La misma revisión adentro del hilo, que dice desde cuándo se deja de cobrar | M |
| Cancelar o reactivar una suscripción manual | estado_suscripcion_manual (cobros, admin) | si | nada |  | S |
| Armar el plan de cuotas (cuántas, de cuánto y desde cuándo) | guardar_plan_pagos (crm, pantalla) | no | herramienta, confirmacion, bloque | Mini editor del plan dentro del hilo: el calendario de cuotas calculado (fecha y monto de cada una), editable, con «Confirmar plan» | M |
| Agregar o quitar una cuota suelta | guardar_cuotas (crm, pantalla) | no | herramienta, confirmacion | El mismo mini editor de cuotas | S |
| Editar una cuota: monto o vencimiento | editar_cuota (cobros) | si | nada |  | S |
| Cortar el recordatorio de cobro de una cuota | cortar_recordatorio_cuota (cobros) | si | nada |  | S |
| Baja del cliente: deja de cobrarse lo que falta | baja_del_cliente (cobros) | no | herramienta | Tarjeta de confirmación con lo que deja de cobrarse y lo ya cobrado | S |
| Cambiar la venta del lead: pago único, suscripción o becado (sacarlo de «Sin cobro»), monto y plazo | editar_venta_lead (cobros) | no | herramienta |  | S |
| Editar los datos del deal (servicio, promesa, obligaciones) | editar_dato_deal / editar_obligacion_deal / guardar_deal_details (pantalla) | no | herramienta |  | S |
| Subir el contrato y «Leer con IA», que llena sólo lo vacío | null | no | herramienta, bloque | Tarjeta «Esto leí del contrato»: los campos que llenaría, para aceptar o corregir | M |
| Documento fiscal leído por IA y «Facturado por» | null | no | herramienta |  | S |
| Ver y descargar el comprobante o el contrato | null | no | herramienta, bloque | Miniatura del documento con «Descargar» | S |
| Ver y cambiar la moneda del negocio | ver_moneda_negocio / cambiar_moneda_negocio (cobros, admin) | parcial | herramienta |  | S |
| Ver el MRR de las suscripciones activas | ver_mrr_activo (metricas, admin) | no | herramienta, bloque | Número grande con la variación del mes y «Ver suscripciones» | S |
| Ver cuánto se cobró este mes | metricas_negocio | si | nada |  | S |
| Ver el catálogo de productos (precio, tipo, plazo) | listar_productos (crm) | no | herramienta, bloque | Grilla de productos: nombre, tipo (único o suscripción), precio y plazo, con «Editar» y «Cobrar con link» en cada una | S |
| Crear o editar un producto (nombre, tipo, precio en USD, plazo, promesa, qué incluye, garantía) | guardar_producto (crm, pantalla, admin) | no | herramienta, confirmacion, bloque | Tarjeta del producto editable en el lugar, como ProductosView: un campo por línea y «Guardar» | M |
| Que MaKo arme el catálogo con el brief y El Archivero | sugerir_productos (negocio, pantalla) | no | confirmacion, bloque | Tres o cuatro productos propuestos como tarjetas para elegir, editar o descartar, con «Guardar los elegidos» | M |
| Borrar un producto | borrar_producto (negocio, pantalla) | parcial | confirmacion |  | S |
| Ver el estado de las integraciones y lo que requiere atención | ver_integraciones (integraciones, admin) | si | bloque | Tarjeta del estado: un chip por servicio (conectado, falta o con problema) y «Conectar» en cada uno, que abre el modal ahí mismo | S |
| Probar la conexión de una integración | probar_conexion_integracion | parcial | herramienta |  | S |
| Conectar un servicio pegando su credencial (Stripe, Mercado Pago, Resend, Fathom, Calendly, Zernio, Hotmart, Apify, ElevenLabs…) | link_configurar_integracion (sólo devuelve un link) | no | herramienta, bloque | Botón «Conectar <servicio>» que abre el MISMO ServicioModal en el hilo (app/_chat/ConectarDelAviso.tsx + BotonIntegracion ya existen para el aviso sin IA): pegar, Probar conexión, Guardar | M |
| Conectar Meta (OAuth) y Google Calendar, o desconectar Google Calendar | ver_estado_google_calendar (lectura). Desconectar: null | no | bloque | El mismo botón que abre el modal de ese servicio (autorizar o desconectar) | S |
| Quitar una credencial (desconectar un servicio) o revelarla | null | no | bloque | El modal del servicio | S |
| Pegar una API key en el chat | null | no | motor, bloque | Aviso «Tapé tu clave: pégala aquí» con el botón Conectar del servicio que se detectó | S |
| Ver qué le falta a una tab para funcionar | ver_activacion_tab | no | herramienta, bloque | Checklist de lo que falta, con Conectar en el lugar | S |
| Ver el gasto de IA del mes, por proveedor y por proceso | ver_gasto_ia (integraciones, admin) | no | herramienta, bloque | «Costo de MaKo» en miniatura: el gasto por proveedor y el saldo restante, con «Ver operaciones» | S |
| Ver la cuota gratis de IA de hoy | ver_cuotas_ia | no | herramienta |  | S |
| Cargar el saldo de un proveedor de IA (lo que el cliente lee en su consola) | null | no | herramienta, bloque | Campo de saldo en la tarjeta de gasto | S |
| Ver la salud de la cuenta de Meta y el historial de problemas | ver_salud_cuenta_meta (ads) | no | herramienta |  | S |
| Conectar Claude como conector (la skill con su token) y ver si está conectado | ver_estado_agente_claude (lectura). Acuñar, rotar o revocar el token: null | parcial | herramienta, bloque | Dos caminos para elegir: «Con tu API key» (abre el modal de anthropic) o «MaKo dentro de tu Claude» (TutorialAgente con el token y los pasos) | M |
| Conectar SUS suscripciones de Claude y GPT, varias cuentas (decidido el 20/10) | null | no | motor, bloque, confirmacion | «Tus cuentas de IA»: copia de ListaUso (app/admin/operaciones/Uso.tsx): cada cuenta con su plan, su % usado (5 h y semana) y Conectar otra | L |
| Fijar la zona horaria del negocio | fijar_zona_horaria_workspace (equipo, admin) | si | nada |  | S |
| Horario en que MaKo puede escribirle a alguien | null | no | herramienta, permiso |  | S |
| Criterio de reuniones (qué entra al tablero) | null | no | herramienta, permiso |  | S |
| Ver a quién le llegan los reportes y los avisos | ver_destinatarios_notificaciones (admin) | si | nada |  | S |
| Sumar o sacar un destinatario de los reportes | agregar_destinatario_notificaciones (pantalla) / quitar_destinatario_notificaciones | no | herramienta, confirmacion | Lista de destinatarios por canal (DestinatariosCanal) con quitar y agregar | S |
| Prender o apagar un reporte y elegir sus secciones | configurar_reporte / configurar_seccion_reporte | parcial | herramienta |  | S |
| Ver un reporte sin mandarlo | generar_reporte (admin) | si | bloque | Vista previa del reporte como llega por WhatsApp o por correo (BandejaEmail renderiza el HTML real) | S |
| Prender o apagar un aviso de WhatsApp | configurar_aviso_whatsapp | no | herramienta |  | S |
| Mandar a aprobar la plantilla de WhatsApp del reporte | asegurar_plantilla_reporte (pantalla) | sin_verificar | confirmacion |  | S |
| Identidades fiscales: cargar, editar, borrar y elegir la predeterminada | listar_identidades_fiscales / guardar_identidad_fiscal (pantalla) / borrar_identidad_fiscal (pantalla) / hacer_default_identidad_fiscal | no | herramienta, confirmacion, bloque | Tarjeta de la identidad fiscal editable, que se llena desde la constancia adjunta (/api/extract-fiscal) | M |
| Ver los miembros del equipo | listar_equipo / buscar_miembro_equipo (admin) | parcial | herramienta, bloque | Tarjeta de miembros: avatar, rol, estado y acciones en el «⋯» | S |
| Invitar a alguien con su email y su rol (admin, closer o setter) | invitar_miembro_equipo (pantalla, admin) | no | herramienta, confirmacion, bloque | Mini formulario en el hilo: el email y tres chips de rol, con «Invitar». Después dice si el mail salió | S |
| Cambiar el rol de un miembro | cambiar_rol_miembro (pantalla) | parcial | herramienta, confirmacion |  | S |
| Reenviar el mail de acceso | reenviar_invitacion | no | herramienta |  | S |
| Suspender o reactivar a un miembro | suspender_miembro | no | herramienta |  | S |
| Eliminar a un miembro | eliminar_miembro (pantalla) | no | herramienta, confirmacion |  | S |
| Ver mi perfil | ver_perfil / quien_soy | no | herramienta |  | S |
| Editar mi nombre, mi teléfono y mi foto | null | no | herramienta, bloque | Tarjeta del perfil editable, con la foto que se adjunta en el chat | S |
| Seguridad: 2FA (app, passkey o código), contraseña, códigos de recuperación y revocar un dispositivo | null | no | bloque | Botón que abre SeguridadCuenta en el lugar (sheet), sin salir del chat | S |
| Pop-up y sonido de mis notificaciones, y las notificaciones push | ver_notificaciones_inapp (lectura). Escribir: null | no | herramienta |  | S |
| Instalar la app en el celular | null | no | bloque | Pasos para instalar, con un QR | S |
| Ver mi plan de MaKo y su estado | ver_mi_plan (negocio, admin) | no | herramienta, bloque | PlanPanel embebido: el plan, el monto por mes, el estado y «Darme de baja» | S |
| Darme de baja de MaKo (al final del mes pagado) | dar_de_baja_mi_plan (negocio, pantalla, admin) | no | herramienta, confirmacion | El ConfirmDialog de PlanPanel adentro del hilo, que dice qué pasa, y el código de baja | S |
| Levantar un ticket (bug, pedido o pregunta) | levantar_ticket (mako) | parcial | herramienta | La tarjeta del ticket propuesto: tipo, título, detalle editable y «Enviar al equipo» | S |
| Ver mis tickets y en qué anda cada uno | mis_tickets (mako) | no | herramienta, bloque | Lista de tickets: número, título, estado en palabras del cliente y la última novedad | S |
| Contestar un ticket que «Espera tu respuesta» | null | no | herramienta, bloque | La conversación del ticket en el hilo, con un campo para contestar | S |
| (Martín) La bandeja de la Ticketera: aprobar, corregir el tipo, la prioridad, el auto-arreglo y cuántos esperan | null | parcial | herramienta |  | M |
| (Martín) Vender un plan de MaKo: el link de pago del plan, con alta automática al pagar | null | no | herramienta, bloque, confirmacion | Tarjeta «Vender un plan»: el plan, el precio sugerido de la grilla vigente, la pasarela y el email, con el link para copiar | M |
| (Martín) Los cobros de MaKo: listar, anular y reembolsar, y el precio por cliente de agencia | null | no | herramienta, confirmacion |  | M |
| (Martín) Elegir el modelo de IA de cada proceso (AI Models) | null | no | herramienta |  | S |

## La inteligencia del chat de esta área

QUÉ TIENE QUE SABER Y LEER ANTES DE ACTUAR (en este orden, con lecturas que ya existen):
1) Quién pide y qué puede: quien_soy y su rol. a_quien_cobrar, reembolsar, cancelar_suscripcion, la moneda, el equipo y el plan de MaKo son de un admin. Un closer o un setter no ve montos del negocio.
2) Con qué cobra el negocio: ver_integraciones dice qué pasarelas tiene (Stripe, Mercado Pago, o las dos) y si están en prueba o en real. ver_moneda_negocio dice su moneda. Si no hay pasarela, el link no existe: lo que se ofrece es el botón Conectar.
3) Qué vende: listar_productos, con precio en USD, tipo y plazo. El precio de un link sale SIEMPRE del catálogo.
4) Cómo está el lead: cobranza_lead (cuotas, lo cobrado, lo devuelto, la baja y lo que protege cada cuota: un recordatorio en curso, un link ya pagado) y listar_cobros (el cobroId no es el pagoId de una cuota).
5) Qué día es en la zona del negocio (ver_zona_horaria_workspace): la fecha de un cobro es HOY en esa zona.
6) Para conectar algo: ver_integraciones, ver_activacion_tab, ver_estado_agente_claude, y si el negocio tiene una IA propia (iaPropiaDelTurno, faltaIADelNegocio).
7) Second Brain: el brief, El Archivero y la oferta (productos.user ya los junta) antes de proponer productos o precios.

QUÉ PREGUNTA EN VEZ DE INVENTAR (una pregunta, con opciones para tocar):
- Un plan de cuotas: cuántas, de cuánto, la fecha de la primera y cada cuánto. Si falta algo, NO lo completa por defecto. Es el caso del 20/10 («todos los martes a las 3 a todo el funnel», y MaKo armó otra cosa con pasos por defecto). Antes de confirmar muestra el calendario calculado.
- Un cobro de menos: «¿queda pendiente o es descuento?».
- Un pago en otra moneda: cuánto en su moneda, nunca convertido a ojo.
- Una cuota: cuál, si hay varias impagas.
- La pasarela: Stripe o Mercado Pago, si tiene las dos y el producto no lo define.
- Una suscripción: si es de la pasarela o manual (son dos herramientas distintas).
- Un reembolso parcial: no existe. Lo dice y ofrece el ticket.
- Un link por un monto que no está en el catálogo: hoy no se puede. Ofrece crear el producto o abrir la ficha.
- Una invitación: el email y el rol, nunca supuestos.
- Sacar a alguien: «¿lo suspendo o lo elimino?».
- Un aviso o un reporte: por qué canal y a quién.
- Conectar: qué servicio exacto (Meta Ads, Instagram o Messenger por Zernio, WhatsApp).
- Darse de baja de MaKo: dice la consecuencia («lo sigues usando hasta el fin del mes pagado») antes del botón.

QUÉ NO HACE NUNCA:
- Escribir, copiar o inventar un link de pago (lo agrega el sistema al confirmar).
- Inventar un precio, una moneda o una fecha.
- Confirmar por el chat lo que mueve plata (reembolso, cancelar una suscripción de la pasarela, dar de baja el plan): hasta que Martín decida otra cosa, va con revisión.
- Desmarcar a mano una cuota que cobró la pasarela, o contar como deuda una cuota devuelta o de baja (noEsDeuda, lib/pagos-baja.ts).
- Pedir o aceptar una API key por el chat. Abre el modal del servicio, y si alguien pega una key, la tapa (hoy no se tapa: pieza 2).
- Tocar la seguridad de la cuenta (2FA, contraseña, dispositivos): abre el panel y lo hace la persona.
- Mandar cobros o datos de clientes a la red gratis (turnoParaLaRed corta el turno: cobros, crm, metricas y equipo son datosDeClientes=true).
- Usar el token de la suscripción de Claude o GPT del cliente.
- Crear una tarea o un borrador de un pedido de cobro que no entendió: en la duda, pregunta.

LO QUE SE REUSA (no se reescribe):
- Recetas: RECETA_COBROS en lib/doer-recetas.ts. Hay que sumarle una RECETA_PAGOS con lo de arriba.
- Reglas de plata: lib/pagos-vistazo.ts, lib/cobrado-lead.ts, lib/pagos-diferencia.ts, lib/pagos-baja.ts, lib/cobros.ts (cuotaParaLink, decidirCobro), lib/cobros-reglas.ts y lib/pagos-campo.ts.
- Prompts del registro (lib/prompt-registry.ts): productos.system y productos.user (sugerir_productos), ofertas.system y ofertas.user, contracts.extract_payment_plan.user (el contrato) y contracts.extract_receipt.user (el comprobante). El de la constancia fiscal (/api/extract-fiscal) no lo encontré en el registro: sin verificar.
- Tickets: lib/tickets-reglas.ts (errorParaTicket; el triage sin IA).
- IA: lib/ia-keys.ts (POR_QUE_IA_DE_MAKO) y avisoSinIA / faltaIADelNegocio en lib/mako-turno-app-reglas.ts.
- Piezas de pantalla: app/_chat/ConectarDelAviso.tsx, app/_components/ConectarIntegracion (BotonIntegracion + ServicioModal), app/general/Cobranza.tsx, app/crm/lead-view/ficha/pagos/* (bloques-cobro, cobrar = CobrarConLink), app/configuraciones/plan/PlanPanel.tsx, app/equipo/EquipoView.tsx, app/perfil/seguridad/SeguridadCuenta.tsx, app/_components/TutorialAgente.tsx, app/admin/operaciones/Uso.tsx (ListaUso no tiene hooks) y app/_chat/TarjetaAccion.tsx.

TRAMPAS MEDIDAS EL 20/10, para cosechar en docs/hallazgos-pagos.md, hallazgos-integraciones.md y hallazgos-agente.md:
(a) El clasificador no reconoce como imperativo «conectá», «invitá», «suspendé», «sacá», «reportá», «levantá», «cargá», «armale», «agregale», «reenviale» ni «creá». Esos pedidos caen en capturar, dudosa, y el turno lleva SÓLO ver_plan y listar_pendientes.
(b) «productos» rutea al área negocio, y listar_productos es del área crm.
(c) «plan» es el tablero de tareas: «mi plan de MaKo» y «el plan de pagos de Juan» traen las herramientas del Plan, no ver_mi_plan ni cobranza_lead.
(d) La regex del área mako no tiene «ticket»: mis_tickets nunca viaja, y levantar_ticket viaja sólo en actuar.
(e) «moneda», «fiscal», «MRR», «cobranza» y «me debe» no son palabras de ningún área.
(f) ver_gasto_ia queda afuera del presupuesto de 12.000 caracteres cuando la frase también nombra métricas.
(g) crear_link_pago viaja con «link de suscripción de 200», pero sólo cobra productos del catálogo.
(h) leerAQuienCobrar lee sólo las cuotas impagas: una suscripción sin cuotas no aparece.
(i) El chat no tapa una key pegada.
(j) Las 16 acciones de esta área con confirmacion «pantalla» sacan a la persona a /mako/revisar.
(k) Del entorno: el scratchpad lo comparten los subagentes de la misma corrida. Otro agente pisó mi dump.mts a mitad de la medición. Los scripts van con nombres propios (los míos quedaron en scratchpad/pagos-area/).

## Bloques nuevos

- Lista «A quién cobrar»: nombre, monto, vence o venció, Marcar cobrada con Deshacer (reusa app/general/Cobranza.tsx)
- Tarjeta del estado de cuenta del lead: qué debe, qué pagó, qué hacer ahora, con Marcar cobrada, Cobrar con link y Registrar pago, y «Abrir la ficha»
- Tarjeta del link de pago: monto, pasarela, Copiar y un estado que se actualiza solo
- Asistente «Cobrar con link» en miniatura: concepto, monto, moneda, único o suscripción
- Mini editor del plan de cuotas: el calendario calculado, editable, y «Confirmar plan»
- Tarjeta de un comprobante leído: monto, fecha y miniatura, corregibles antes de confirmar
- Tarjeta «Esto leí del contrato» o de la constancia fiscal: los campos que llenaría
- Grilla de productos editable, con Cobrar con link en cada uno, y tres productos propuestos por MaKo para elegir
- Botón «Conectar <servicio>» que abre el ServicioModal en el hilo (ConectarDelAviso + BotonIntegracion)
- Elegir cómo conectar Claude: con tu API key, o MaKo dentro de tu Claude (TutorialAgente con el token)
- «Tus cuentas de IA»: cada cuenta con su plan y su % usado, el gasto de las keys y la cuota gratis (copia de ListaUso)
- Aviso «Tapé tu clave» con el botón Conectar del servicio detectado
- Revisión adentro del hilo para las acciones «pantalla»: campos editables, la consecuencia pegada al botón y doble confirmación si mueve plata
- Tarjeta del equipo: miembros con rol y estado, e invitar con el email y tres chips de rol
- PlanPanel embebido: el plan de MaKo, su estado y Darme de baja con su confirmación
- Tarjeta de un ticket: estado, respuesta del equipo y Contestar, más la lista «Tus tickets»
- Panel de Seguridad que se abre en el lugar (sheet de SeguridadCuenta)
- Vista previa de un reporte, tal como llega por WhatsApp o por correo
- Tarjeta del estado de integraciones: un chip por servicio y Conectar en cada uno

## Decisiones para Martín (las de esta área)

- Lo que mueve plata (reembolsar, cancelar una suscripción de Stripe o Mercado Pago, darse de baja de MaKo): ¿se confirma ADENTRO del chat con doble confirmación y el monto a la vista, o sigue en una pantalla aparte? Hoy el registro lo manda a /mako/revisar a propósito.
- ¿El chat puede crear un link de pago por un monto libre o una suscripción sin producto del catálogo? Hoy la API lo prohíbe a propósito («un monto libre se carga desde la ficha»), aunque la ficha lo permite.
- ¿Dónde corre el Claude o el GPT de cada cliente: su computadora, un servidor de MaKo o las routines de su nube? Sigue abierto del 20/10, y de esto depende el bloque «Tus cuentas de IA».
- Horario de envío y criterio de reuniones: hoy sólo los ve el super admin. ¿Un cliente los puede cambiar pidiéndoselo al chat?
- Seguridad de la cuenta (2FA, contraseña, dispositivos): la propuesta es que el chat sólo abra el panel y lo haga la persona, nunca la IA. ¿De acuerdo?
- La Gemini gratis con datos de cobros sigue abierta del debate: sin una IA propia, el chat corta todo lo de cobros (datosDeClientes). ¿Se le pide al cliente su Claude, o se corta la Gemini gratis?
- El plan de 500 sigue sin decidir, y lo necesita «Vender un plan» desde tu Ops Center.

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1 · Que el pedido llegue: ruteo del área en el clasificador. A los imperativos se suman conectá, invitá, suspendé, sacá, reportá, levantá, cargá, creá, agregale, armale y reenviale. Áreas: cobranza, «me debe», vencid, MRR y moneda van a cobros y metricas; «productos» trae listar_productos; conectar más el nombre del servicio, el gasto de IA, la IA gratis y «salud de mi cuenta de Meta» van a integraciones; invitar, suspender, closer y rol van a equipo; ticket, reportá, «no anda», «no carga» y «pedir una función» van a mako; «mi plan de MaKo» y «darme de baja de MaKo» van a negocio y no al Plan. ver_gasto_ia tiene que entrar en el presupuesto | Un test nuevo (tests/ops-center-area-pagos.test.ts) pasa las 90 frases medidas el 20/10 por clasificarIntencion + herramientasDelChat con la vista del chat de la app (admin), y cada una lleva su herramienta. Hoy pasan 29 de 90. Las frases de cobros que ya andaban siguen igual (tests/api-mako-cobros.test.ts y agenda-whatsapp en verde) | nada; lo hace MaKo en WhatsApp (dueño del clasificador) | M |
| 2 · Nunca una key en el chat. turnoApp tapa los secretos antes del modelo y del historial, con los patrones de lib/agente-redaccion.ts y los prefijos de lib/metodo-catalogo.ts (sk-ant-, sk-, AIza, rk_, APP_USR-, re_…), y contesta con el botón Conectar del servicio que detectó | Test: un mensaje con una key se guarda tapado en chart_chats, el modelo recibe «[clave tapada]» y la respuesta trae conectar=<servicio>. Probado rompiéndolo: sin el tapado, el test falla | nada | S |
| 3 · El bloque «Conectar» en el hilo. link_configurar_integracion devuelve el servicio para `conectar` en vez de una URL, y HiloMako dibuja ConectarDelAviso (BotonIntegracion abre el MISMO ServicioModal). «quiero conectar mi Claude» ofrece dos caminos: API key (el modal de anthropic) o «MaKo dentro de tu Claude» (TutorialAgente con el token) | En /second-brain, «conectá mi Stripe», «conectá Meta» y «quiero conectar mi Claude» abren el modal ahí mismo, y probar y guardar andan sin salir. Ninguna respuesta del área trae un link a /integraciones (test que lo barre) | 1 | M |
| 4 · El bloque «A quién cobrar» y el motor de suscripciones. La tarjeta reusa app/general/Cobranza.tsx (con límite y «Ver todas»), con Marcar cobrada y Deshacer en el hilo. leerAQuienCobrar y a_quien_cobrar suman las suscripciones manuales activas sin la cuota del mes. La alerta «Cuota por cobrar» nombra al cliente | «¿quién me debe plata?» dibuja la lista con nombre, monto y vencimiento, y un clic marca cobrada con marcarPagoAction. Un test de leerAQuienCobrar con una suscripción manual sin cuotas la muestra. El título de la alerta lleva el nombre | 1 | M |
| 5 · La tarjeta del estado de cuenta del lead: lo que debe, lo que pagó y qué hacer ahora (lib/pagos-vistazo.ts + cobradoDelLead), con Marcar cobrada, Cobrar con link (CobrarConLink chico) y Registrar pago, que proponen en el mismo hilo. Con un comprobante adjunto, extract_receipt prepara marcar_pago_cobrado con el monto y la fecha leídos | «¿cuánto me debe Juan?» muestra lo mismo que la tab Pagos (un test compara el vistazo de las dos). Una foto de un comprobante más «es de Juan» deja la tarjeta lista para confirmar, con los datos corregibles | 1, 4 | M |
| 6 · La receta de pagos (la inteligencia). RECETA_PAGOS en lib/doer-recetas.ts: leer antes la moneda, las pasarelas, el catálogo y cobranza_lead; preguntar cuotas, monto, primera fecha y frecuencia, pendiente o descuento, de la pasarela o manual, y cuál pasarela; nunca un precio, una fecha ni un plan por defecto | Test de recetas: con guardar_plan_pagos, editar_cuota o marcar_pago_cobrado en el turno, el system lleva la receta. «armale a Juan un plan de 3 cuotas de 500» sin fecha ni frecuencia termina en UNA pregunta y no en una propuesta (test del turno con el modelo simulado) | 1 | S |
| 7 · Herramientas que faltan, sobre server actions que ya existen. Link por monto libre o de suscripción (crearCobroAction), contestar_ticket, editar_mi_perfil (nombre y teléfono; la foto por adjunto), las notificaciones de la persona en la app, leer el contrato o la constancia fiscal desde un adjunto (completarConDocumentoAction, /api/extract-fiscal), y horario_envio y criterio_reuniones (con el gating que Martín decida) | Cada una está en lib/api-mako/areas/*.def.ts y *.run.ts con su test de registro (tests/api-mako-*.test.ts) y viaja con su frase en el test de la pieza 1. El link por monto libre se confirma con su resumen (monto, moneda, tipo) en la tarjeta | 1; el link por monto libre y el horario, de la decisión de Martín | M |
| 8 · Confirmar adentro lo que hoy va a /mako/revisar. Las 16 acciones «pantalla» del área (reembolsar_cobro, cancelar_suscripcion, guardar_plan_pagos, guardar_cuotas, guardar_deal_details, guardar_producto, sugerir_productos, borrar_producto, dar_de_baja_mi_plan, invitar_miembro_equipo, cambiar_rol_miembro, eliminar_miembro, guardar_identidad_fiscal, borrar_identidad_fiscal, agregar_destinatario_notificaciones y asegurar_plantilla_reporte) se revisan en el hilo con los mismos campos editables de /mako/revisar. La consecuencia va pegada al botón, y lo que mueve plata lleva doble confirmación | Las 16 se revisan y confirman sin salir del chat, y sus respuestas no traen ningún link a /mako/revisar (test que barre el registro). El gating se vuelve a mirar al confirmar (gatingOk) | decisión 1 de Martín; el marco lo hace Ops Center 3 | L |
| 9 · Bloques chicos del área. Equipo (miembros con rol y estado; invitar con el email y tres chips de rol). Tu plan (PlanPanel embebido con su ConfirmDialog). Ticket (estado, respuesta del equipo y Contestar). Productos (grilla editable con Cobrar con link). Seguridad (abre SeguridadCuenta en el lugar) | Cada pedido de esta área que hoy contesta sólo con texto muestra su tarjeta en /second-brain y en el teléfono (app/m/mako), con las mismas piezas | 1, 8 | M |
| 10 · «Tus cuentas de IA»: cada cliente conecta sus cuentas de Claude y GPT (decidido el 20/10). El bloque copia ListaUso (cada cuenta con su plan y su % usado) y suma el gasto de las keys (ver_gasto_ia) y la cuota gratis (ver_cuotas_ia) | Un cliente conecta una cuenta desde el chat y ve su uso en el mismo bloque. El turno del Ops Center de ese cliente corre con su cuenta, y MaKo nunca guarda el token de la suscripción | decisión 3 de Martín (dónde corre) | L |
| 11 · Martín vende MaKo por su Ops Center: vender_plan_mako (el link de un plan, con alta automática), listar_cobros_mako, anular y reembolsar, el precio por cliente de agencia y la bandeja de la Ticketera por chat (aprobar, prioridad). Todo con gating soloPlataforma | En /admin/operaciones, «armale el link del plan a juan@x.com» propone la tarjeta y, al confirmar, deja el link. Un cliente nunca ve esas operaciones (test de visible() con plataforma=false) | 1; el plan de 500 sigue sin decidir | M |
