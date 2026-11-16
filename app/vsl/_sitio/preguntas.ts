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
import { TOPES, TOPES_PRUEBA } from '@/lib/topes-plan';
import { AI_AVATAR_SE_VENDE } from '@/lib/planes-comparacion';
import { PAQUETES } from '@/lib/mako-tokens-paquetes';

const precioDe = (nombre: string): string => { const x = STACK_TIPICO.find((y) => y.app.nombre === nombre); return x ? x.precioUsd.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(x.precioUsd) ? 0 : 2, maximumFractionDigits: 2 }) : '?'; };
// EL VIDEO CON AVATAR DE IA, FUERA DE LA PROMESA DE LA PRUEBA (14/11/2026). Esta respuesta prometía «1 video con avatar de IA» a
// toda prueba gratis, y hoy es mentira para la mitad: los DOS planes arrancan con los 7 días (`PLANES_CON_PRUEBA`,
// lib/planes-mako.ts) y la prueba vale EL PLAN ELEGIDO desde el primer día («el negocio en prueba tiene los topes de su plan
// desde el primer día», lib/plan-esencial.ts → `capaVendidaDe`), así que quien arranca la prueba del de 47 es «Essential por la
// pasarela» (`esEsencialPorPasarela`: `alta_capa` completo + capa completo) y en /ai-avatar le sale el cartel de Pro, no el
// estudio (`candadoDeAiAvatar`, app/ai-avatar/acceso.ts). Martín, 14/11/2026: «el de 97 ya podés generar avatares de IA… el de
// 47 debería estar bien limitado y restrictivo».
// ⚠️ `prueba.avatares` NO ERA UNA PROMESA DE LA PRUEBA, y por eso el tope no se toca: es el TECHO de lo que se puede llevar
//    quien YA tiene la función por su plan (hoy, la prueba de Pro), y lo sigue haciendo cumplir `frenoDePrueba`
//    (app/ai-avatar/actions.ts). Lo que estaba mal era prometerlo a toda prueba.
// Se saca de la promesa en vez de aclarar «en Pro» porque el sitio NO vende el avatar hasta que ande de punta a punta
// (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts): la misma razón por la que no tiene fila en la tabla de /planes, ni renglón
// en las tarjetas, ni fila en /vsl/crm. El día que se venda, la línea vuelve sola — y ⚠️ ESE DÍA tiene que decir que es la
// prueba de MaKo Pro, porque en Essential sigue con candado.
const AVATAR_EN_LA_PRUEBA = AI_AVATAR_SE_VENDE ? `${TOPES_PRUEBA['prueba.avatares']} video con avatar de IA, ` : '';
// Martín, 14/11/2026: «me gusta que sean algunas objeciones, pero piensa en cosas más generales… como "¿y si la IA contesta mal un
// cliente y lo pierdo?" son objeciones demasiado específicas… también puedes poner preguntas realmente frecuentes». Lo que se
// pregunta cualquiera antes de entrar: para quién es, si hace falta saber, qué reemplaza, cuánto sale, cómo se prueba, cómo se
// paga, cómo se empieza con lo que ya tiene, quién ayuda y qué pasa con los datos. Se fueron la IA que contesta mal, la venta
// por llamada, los setters y closers, y «vendo por WhatsApp».
export const PREGUNTAS_SITIO: readonly { p: string; r: string }[] = [
  { p: '¿Para quién es MaKo?', r: 'Para quien vende servicios, programas o mentorías de ticket alto: coaches, infoproductores, agencias e inmobiliarias. Vendas por anuncios, por Instagram, por WhatsApp o en una llamada, MaKo ordena el camino entero: desde que alguien te descubre hasta que te paga.' },
  { p: '¿Necesito saber de marketing o de tecnología?', r: 'No. Le cuentas a MaKo qué vendes y a quién, y te arma la oferta, las páginas y los mensajes: tú revisas y apruebas. Si prefieres que lo armemos contigo, está el Accelerator.' },
  // La objeción de GoHighLevel, «muy bien presentada» (el audio de feedback que pasó Martín, 14/11/2026: «es uno de los competidores
  // principales»). Los precios, de STACK_TIPICO (./reemplaza.ts, con su fuente).
  { p: 'Ya pago GoHighLevel, ManyChat y un editor de video. ¿Para qué cambiar?', r: `Porque con lo que hoy pagas sólo por GoHighLevel (US$${precioDe('GoHighLevel')} por mes, su plan Starter) tienes MaKo Pro, y además dejas de pagar ManyChat (US$${precioDe('ManyChat')}) y tu editor de video (CapCut, US$${precioDe('CapCut')}). GoHighLevel ordena tus contactos y tus páginas de venta; MaKo hace eso y además te muestra lo que le funciona a tu competencia, replica sus páginas de venta, sus carruseles y sus guiones con tu oferta, edita tus videos y hace tus anuncios con tu avatar, con una IA que conoce tu negocio. En «Comparaciones» ves, trabajo por trabajo, qué app reemplaza.` },
  // 14/11/2026, Martín: «no aclares lo que consume tu propia IA… Ahora sí puedes aclarar de que sí se pueden comprar MaKo tokens
  // dentro». El precio del minuto suelto sale de lib/mako-tokens-paquetes.ts (el mismo que usa la calculadora de /planes).
  // 15/11/2026: el precio se dice por PAQUETE DE TOKENS y no por minuto de video, por dos razones.
  //   · Decía «un minuto de video sale US$21.6». Ese número salía de multiplicar el clip por la tarifa y es exactamente lo
  //     que Martín pidió que no pase: «no me gusta que sea un número que no sea redondo». El paquete es redondo en las dos
  //     unidades (US$10 → 2.500 MaKo Tokens, `PAQUETES` en lib/mako-tokens-paquetes.ts).
  //   · Y desde hoy el cupo paga TAMBIÉN los guiones, las transcripciones y el análisis de la competencia, así que decirle
  //     «un minuto de video» a quien se quedó sin tokens escribiendo copys le describe mal lo que va a comprar.
  { p: '¿Cuánto me va a salir en total?', r: `El precio de tu plan, nada más. Tu plan trae MaKo Tokens cada mes para lo que hagas con IA; si un mes necesitas más, los compras dentro de MaKo cuando quieras, desde US$${PAQUETES[0].usd} (${PAQUETES[0].mt.toLocaleString('es-AR')} MaKo Tokens).` },
  // Los topes de la prueba, de la MISMA tabla que los hace cumplir (lib/topes-plan.ts, `TOPES_PRUEBA`; tests/prueba-topes.test.ts): /planes
  // los decía en su propia pregunta y, desde que usa éstas (14/11/2026), los dice acá, en todas las páginas.
  { p: '¿Cómo es la prueba gratis?', r: `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: pones tu tarjeta y no se te cobra nada hasta el día ${PRUEBA_DIAS + 1}. Si te das de baja antes, no pagas nada. En la prueba, lo que se crea con IA tiene tope: hasta ${TOPES_PRUEBA['prueba.videos']} videos armados, ${AVATAR_EN_LA_PRUEBA}${TOPES_PRUEBA['prueba.imagenes']} imágenes y ${TOPES_PRUEBA['web.landings_publicadas']} página publicada; exportar en masa se habilita con el primer cobro. Y no hay permanencia: te das de baja cuando quieras.` },
  { p: '¿Puedo pagar en pesos?', r: 'Desde Argentina pagas en pesos, con Mercado Pago. Desde otro país, en dólares, con tu tarjeta.' },
  { p: 'Ya tengo mis contactos y mi equipo. ¿Empiezo de cero?', r: `No. Subes la lista de contactos que ya tienes (un CSV o hasta un PDF) y MaKo te muestra cada uno antes de sumarlo. Tu equipo entra con su propio acceso: en MaKo Pro, hasta ${TOPES.agencia['equipo.usuarios']} personas.` },
  { p: '¿Quién me ayuda si algo falla?', r: 'Personas de verdad. Lo reportas desde la app, el equipo de MaKo lo arregla y te avisa por WhatsApp.' },
  { p: '¿Qué pasa con los datos de mis clientes?', r: 'Son tuyos. MaKo no entrena modelos con tus datos: lo que la IA necesita pasa por tu propia cuenta de Claude, ChatGPT o Gemini.' },
];
