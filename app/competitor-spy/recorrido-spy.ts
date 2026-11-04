// =============================================================================
// El recorrido de la ficha de un competidor: lo nuevo, señalado (4/11/2026)
// =============================================================================
// Martín: «Si puedes poner la animación que ya tenemos tipo tutorial, donde se pone opaco y va señalando las cosas del feedback». El
// Cerebro: «reusá la animación existente, no armes otra». Es el Recorrido de la casa (app/_ui/Recorrido.tsx): se oscurece, una tarjeta
// señala cada cosa, con «Siguiente» y «Omitir». Acá sólo van los pasos, como datos.
//
// ⚠️ EL ID LLEVA LA FECHA: es la clave de «ya lo vio». Uno nuevo para lo nuevo; el de antes no se reusa, o quien vio el viejo no ve
// éste. Un paso cuyo objetivo no está en pantalla (sin pestaña Funnel, sin «Lo que mejor le fue») se saltea solo.
// =============================================================================

import type { PasoRecorrido } from '@/lib/recorridos';

export const RECORRIDO_SPY = 'spy-ficha-0411';

export const PASOS_SPY: PasoRecorrido[] = [
  { objetivo: 'spy-volver', titulo: 'Tus competidores', texto: 'Vuelve a todos, o cambia a otro desde acá.', lado: 'abajo' },
  { objetivo: 'spy-acciones', titulo: 'Más acciones', texto: 'Suma una de sus redes o deja de mirarlo.', lado: 'abajo' },
  { objetivo: 'spy-mejores', titulo: 'Lo que mejor le fue', texto: 'Sus piezas que más rindieron contra su mediana.', lado: 'izquierda' },
  { objetivo: 'spy-grilla', titulo: 'Todo lo que publica', texto: 'También sus anuncios, de a una página.', lado: 'arriba' },
  { objetivo: 'spy-tab-funnel', titulo: 'Su funnel', texto: 'Qué funnel usa y por qué, su oferta y sus páginas.', lado: 'abajo' },
  { objetivo: 'spy-recorrido', titulo: 'Vuelve a verlo', texto: 'Desde acá, cuando quieras.', lado: 'abajo' },
];
