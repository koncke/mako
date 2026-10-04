// =============================================================================
// CRM — qué le falta a cada tarea abierta del tablero (auditoría del 30/09/2026)
// =============================================================================
// Las 25 abiertas de «Feature: CRM» revisadas contra el código por un lector
// independiente cada una, con refutación adversarial sobre cualquiera que se
// propusiera cerrar. Resultado: NINGUNA es cerrable — 19 a medias y 6 sin empezar.
//
// ⚠️ ESTO NO ES EL TABLERO: es la línea que le falta al tablero. El título, el
// score y el deadline salen de `plan_tareas` en cada carga; lo único que vive
// acá es el veredicto medido, que ninguna consulta puede derivar.
//
// ⚠️ Y ES UNA FOTO CON FECHA. Vale mientras el código no se mueva: el día que
// alguien arregle una de éstas, la línea queda mintiendo. Por eso la pantalla la
// dibuja con su fecha al lado y no como un estado del sistema — y por eso la
// entrada se BORRA de acá cuando la tarea se cierra, en vez de corregirse.
//
// ⚠️ Y EL 03/10 SE LA REMIDIÓ CONTRA HEAD, con el runway encima: seis veredictos
// cambiaron. Dos de estas filas ya no son ciertas —#37 y #698 están hechas— y la de
// #623 describe lo contrario de lo que hace el código. Gana la más NUEVA:
// docs/depuracion-crm-03oct.md dice qué entra, qué se posterga y qué se va del
// tablero. Esta foto queda como el estado del 30/09 y se borra fila por fila a
// medida que Martín decida.
//
// El detalle largo de cada una, con archivo:línea, está en
// docs/auditoria-crm-30sep.md (se lee en /admin/docs).

import type { Auditoria } from '../_registro/tipos';

export const AUDITORIA: Auditoria = {
  fecha: '30/09/2026',
  doc: 'auditoria-crm-30sep',
  filas: {
    // ── A medias: una mitad hecha de verdad ──
    6: { estado: 'medias', falta: 'Las respuestas del formulario de Meta se tiran, y no hay tabla donde ponerlas' },
    697: { estado: 'medias', falta: 'Asienta la cuota IMPAGA, y el guardado descarta toda cuota marcada como pagada' },
    702: { estado: 'medias', falta: 'Las tres altas siguen sin estampar el origen, y la tabla no lo muestra' },
    671: { estado: 'medias', falta: 'Falta el botón en la ficha: hoy sólo se agenda desde el tablero y con la reunión ya pasada' },
    696: { estado: 'medias', falta: 'Si nadie tildó «landing» como entrada, el lead se descarta sin dejar rastro' },
    701: { estado: 'medias', falta: 'Los clics se descartan una línea antes de la pantalla, y el scroll no se mide' },
    37: { estado: 'medias', falta: 'El tracking recorta 120 filas antes de filtrar el video, y devuelve vacío si falla' },
    627: { estado: 'medias', falta: 'Las métricas de conversión siguen siendo del workspace, no del producto' },
    621: { estado: 'medias', falta: 'El parser de CSV no busca ninguna columna «Apellido»' },
    698: { estado: 'medias', falta: 'El aviso sutil ya está; falta el interruptor de «este negocio no factura»' },
    39: { estado: 'medias', falta: 'Faltan el asignado de Chatwoot y el relleno retroactivo de los leads viejos' },
    174: { estado: 'medias', falta: 'R1 y R2 siguen opcionales, el descarte es mudo y el copy dice que la key no se usa' },
    332: { estado: 'medias', falta: 'Nada completa las respuestas del formulario con lo que salió en la llamada' },
    623: { estado: 'medias', falta: 'Detecta el duplicado y lo omite: el dato nuevo se pierde en silencio' },
    689: { estado: 'medias', falta: 'El lead sin email no engancha su grabación, y el fallo devuelve cero sin avisar' },
    18: { estado: 'medias', falta: 'Falta escribir y prender la tanda de «No Compró»' },
    40: { estado: 'medias', falta: 'La línea de tiempo y el motor siguen clavados en R1 y R2' },
    15: { estado: 'medias', falta: 'Falta la regla que lee el contrato, y correr el piloto' },
    626: { estado: 'medias', falta: 'Los webhooks de Meta, Calendly y Cal.com comparan el teléfono exacto' },

    // ── Sin empezar ──
    38: { estado: 'sin', falta: 'La R2 pisa el link de la R1, y el buscador no lee las grabaciones' },
    798: { estado: 'sin', falta: 'Las ocho etapas del tablero siguen escritas a mano' },
    19: { estado: 'sin', falta: 'El motor no lee la tabla de pagos, y falta decidir la cadencia' },
    800: { estado: 'sin', falta: 'No hay plazo por etapa ni marca de cuándo el lead entró a la suya' },
    622: { estado: 'sin', falta: 'El importador lee cuatro columnas y el alta no puede nacer en «ganado»' },
    20: { estado: 'sin', falta: 'De las tres promesas del «listo cuando» no hay ninguna' },
  },
};
