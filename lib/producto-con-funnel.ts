import 'server-only';
import { templateDeCanal } from '@/lib/pipeline';

// =============================================================================
// producto-con-funnel — dar de alta un producto Y su tablero, de una
// =============================================================================
// El desplegable del CRM elige el PRODUCTO que dibuja el tablero, y su última
// opción es «Nuevo producto». Hasta el 27/09/2026 esa opción navegaba a
// /second-brain?area=oferta — o sea, sacaba a la persona del CRM para que armara
// la oferta en otra pantalla y volviera. El pedido fue textual: «no tiene sentido
// que al apretar nuevo producto me lleve al second brain, todo se debe resolver
// dentro del CRM».
//
// ⚠️ POR QUÉ ES MÁS DE UN INSERT, Y NO SE PUEDE SIMPLIFICAR. En el modelo de la
// 0169-0171 producto↔funnel **no tiene tabla propia a propósito** (lo dice el
// comment de la vista): se deriva de `funnel_ofertas ⋈ oferta_productos`. O sea
// que para que un producto aparezca en el desplegable del CRM hace falta la
// cadena entera:
//
//     producto ──oferta_productos──> oferta ──funnel_ofertas──> funnel
//
// Cada pieza ya tenía su función (`upsertProducto`, `upsertOferta`,
// `ligarProducto`, `crearFunnel`, `ligarOfertaAFunnel`) y ninguna sabía de las
// otras: lo que faltaba era el pegamento, y vivía repartido entre el onboarding y
// el second brain. Acá está una vez, y lo llaman los dos.
//
// ⚠️ Y LA OFERTA SE CREA SOLA, con el nombre del producto. No se le pregunta a
// nadie: «la oferta es cómo presentás el producto», así que al nacer el producto
// la oferta es «este producto, tal cual». Preguntarla acá sería pedir una decisión
// que todavía no existe — y dejarla sin crear rompería la cadena, o sea que el
// producto nuevo no aparecería en el desplegable que lo acaba de crear.

import { upsertProducto } from './productos';
import { upsertOferta, ligarProducto, ligarOfertaAFunnel } from './ofertas';
import { crearFunnel, FUNNEL_DEFAULT_NOMBRE } from './funnels';

export type ProductoNuevo = { productoId: number; ofertaId: number; funnelId: number };

/**
 * Un producto nuevo con su tablero listo para usar.
 *
 * ⚠️ EL FUNNEL NACE CON SUS ETAPAS, y hasta el 28/09/2026 nacía sin ninguna. El
 * comentario que había acá decía que eso era deliberado —«el tablero dibuja las columnas
 * genéricas y se ajusta después en /funnel»— y esa decisión produjo el síntoma exacto que
 * Martín reportó tres veces: creó «Sistema DOS», «Prueba 2» y «Prueba 3» y los tres le
 * mostraron lo mismo que el funnel del negocio.
 *
 * Por qué eran indistinguibles, medido: un funnel sin pipeline cae a `DEFAULT_PIPELINE`,
 * y en ese workspace `DEFAULT_PIPELINE` es EXACTAMENTE el pipeline declarado del funnel
 * del negocio — las mismas cinco claves, en el mismo orden. O sea que «ajustarlo después»
 * no era un paso pendiente: era una pantalla que no se distinguía de la anterior.
 *
 * Ahora se pregunta CÓMO SE VENDE ese producto y se siembra la plantilla de ese canal
 * (`templateDeCanal`). Es una pregunta por un HECHO del negocio, no por una
 * configuración: quien crea un producto sabe si lo vende por llamada o por carrito.
 * Sin canal se cae a la genérica, que sigue siendo mejor que una pantalla en blanco.
 */
export async function crearProductoConFunnel(nombreCrudo: string, canal?: string | null): Promise<ProductoNuevo> {
  const nombre = (nombreCrudo ?? '').trim();
  if (!nombre) throw new Error('El funnel necesita un nombre.');
  // El nombre del funnel reservado es el que la migración 0170 le puso a todos:
  // dejar crear otro con el mismo nombre haría que el desplegable muestre dos
  // renglones idénticos y no se pueda saber cuál es cuál.
  if (nombre.toLowerCase() === FUNNEL_DEFAULT_NOMBRE.toLowerCase()) {
    throw new Error(`«${FUNNEL_DEFAULT_NOMBRE}» es el nombre del tablero que ya existe. Ponle otro.`);
  }

  // El orden importa y es el de la cadena: sin producto no hay qué ligar, y sin
  // oferta el funnel no tiene por dónde llegar al producto.
  const productoId = await upsertProducto({
    nombre,
    // Lo mínimo que la tabla exige. El precio y el tipo se completan en el
    // catálogo de productos: acá se está eligiendo qué tablero mirar, no
    // cerrando el modelo de negocio.
    tipo: 'unico',
    monto_usd: null,
    suscripcion_meses: null,
    activo: true,
  });

  const ofertaId = await upsertOferta({ nombre });
  await ligarProducto(ofertaId, productoId, 'principal');

  // La plantilla del canal declarado. `templateDeCanal` falla cerrado: con un canal que
  // no está en el catálogo devuelve null y el funnel nace con la genérica.
  const tpl = templateDeCanal(canal);
  const funnelId = await crearFunnel({
    nombre,
    esDefault: false,
    canal: canal ?? null,
    plantilla: tpl?.id ?? null,
    pipeline: tpl?.pipeline,
  });
  await ligarOfertaAFunnel(funnelId, ofertaId, true);

  return { productoId, ofertaId, funnelId };
}
