// =============================================================================
// Las preguntas frecuentes del sitio, UNA sola lista (14/11/2026)
// =============================================================================
// Martín, 14/11/2026: «si vas a poner en otros lugares preguntas frecuentes, tienen que ser siempre las mismas que están en la landing
// principal». Las leen la portada (Portada.tsx), /planes (app/planes/Vitrina.tsx) y cada landing por función: el registro
// (app/vsl/_competencia/registro.ts) le pone ESTAS a todo bloque `preguntas`. Vive aparte de datos.ts porque datos.ts importa el
// registro, y el registro necesita esto: juntos serían un círculo.
// =============================================================================

import { STACK_TIPICO } from './reemplaza';
import { NOMBRE_PLAN_CON_PRUEBA, PRUEBA_DIAS } from '@/lib/planes-mako';
import { TOPES } from '@/lib/topes-plan';

const precioDe = (nombre: string): string => { const x = STACK_TIPICO.find((y) => y.app.nombre === nombre); return x ? x.precioUsd.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(x.precioUsd) ? 0 : 2, maximumFractionDigits: 2 }) : '?'; };
// Martín, 14/11/2026: «me gusta que sean algunas objeciones, pero piensa en cosas más generales… como "¿y si la IA contesta mal un
// cliente y lo pierdo?" son objeciones demasiado específicas… también puedes poner preguntas realmente frecuentes». Lo que se
// pregunta cualquiera antes de entrar: para quién es, si hace falta saber, qué reemplaza, cuánto sale, cómo se prueba, cómo se
// paga, cómo se empieza con lo que ya tiene, quién ayuda y qué pasa con los datos. Se fueron la IA que contesta mal, la venta
// por llamada, los setters y closers, y «vendo por WhatsApp».
export const PREGUNTAS_SITIO: readonly { p: string; r: string }[] = [
  { p: '¿Para quién es MaKo?', r: 'Para quien vende servicios, programas o mentorías de ticket alto: coaches, infoproductores, agencias e inmobiliarias. Vendas por anuncios, por Instagram, por WhatsApp o en una llamada, MaKo ordena el camino entero: desde que alguien te descubre hasta que te paga.' },
  { p: '¿Necesito saber de marketing o de tecnología?', r: 'No. Le cuentas a MaKo qué vendes y a quién, y te arma la oferta, las páginas y los mensajes: tú revisas y apruebas. Si prefieres que lo armemos contigo, está el Acelerador.' },
  // La objeción de GoHighLevel, «muy bien presentada» (el audio de feedback que pasó Martín, 14/11/2026: «es uno de los competidores
  // principales»). Los precios, de STACK_TIPICO (./reemplaza.ts, con su fuente).
  { p: 'Ya pago GoHighLevel, ManyChat y un editor de video. ¿Para qué cambiar?', r: `Porque con lo que hoy pagas sólo por GoHighLevel (US$${precioDe('GoHighLevel')} por mes, su plan Starter) tienes MaKo Pro, y además dejas de pagar ManyChat (US$${precioDe('ManyChat')}) y tu editor de video (CapCut, US$${precioDe('CapCut')}). GoHighLevel ordena tus contactos y tus páginas de venta; MaKo hace eso y además te muestra lo que le funciona a tu competencia, replica sus páginas de venta, sus carruseles y sus guiones con tu oferta, edita tus videos y hace tus anuncios con tu avatar, con una IA que conoce tu negocio. En «Comparaciones» ves, trabajo por trabajo, qué app reemplaza.` },
  { p: '¿Cuánto me va a salir en total?', r: 'El plan, más lo que consuma tu propia IA (Claude, ChatGPT o Gemini), que pagas directo a tu proveedor: MaKo no le pone recargo. Con Gemini puedes empezar gratis, con un tope por día.' },
  { p: '¿Cómo es la prueba gratis?', r: `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: pones tu tarjeta y no se te cobra nada hasta el día ${PRUEBA_DIAS + 1}. Si te das de baja antes, no pagas nada. Y no hay permanencia: te das de baja cuando quieras.` },
  { p: '¿Puedo pagar en pesos?', r: 'Desde Argentina pagas en pesos, con Mercado Pago. Desde otro país, en dólares, con tu tarjeta.' },
  { p: 'Ya tengo mis contactos y mi equipo. ¿Empiezo de cero?', r: `No. Subes la lista de contactos que ya tienes (un CSV o hasta un PDF) y MaKo te muestra cada uno antes de sumarlo. Tu equipo entra con su propio acceso: en MaKo Pro, hasta ${TOPES.agencia['equipo.usuarios']} personas.` },
  { p: '¿Quién me ayuda si algo falla?', r: 'Personas de verdad. Lo reportas desde la app, el equipo de MaKo lo arregla y te avisa por WhatsApp.' },
  { p: '¿Qué pasa con los datos de mis clientes?', r: 'Son tuyos. MaKo no entrena modelos con tus datos: lo que la IA necesita pasa por tu propia cuenta de Claude, ChatGPT o Gemini.' },
];
