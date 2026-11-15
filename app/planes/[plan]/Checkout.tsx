// =============================================================================
// El marco del checkout de un plan: la estructura de Stripe Checkout, con los colores y la letra de MaKo (12/11/2026)
// =============================================================================
// Martín: «Puedes hacer absolutamente todo el diseño de la pasarela de pago». La referencia (la eligió el Cerebro) es Stripe
// Checkout, copiada en estructura: a la izquierda el resumen, a la derecha el formulario, y en el teléfono el resumen arriba y
// plegable. Vive aparte de page.tsx para poder dibujarlo solo (scripts de revisión visual). Los estilos: ../estilo.ts.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { NOMBRE_PASARELA, type Pasarela } from '@/lib/cobros-tipos';
import { MESES_GRATIS_ANUAL, PRUEBA_DIAS } from '@/lib/planes-mako';
import { listaCorta } from '../Tarjetas';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { CSS_PLANES } from '../estilo';

/** Lo que dice el resumen de la izquierda (Stripe Checkout): sólo datos del plan, nada inventado. */
export type Resumen = {
  /** «Suscribirte a MaKo Esencial»: lo de arriba del precio. */
  etiqueta: string;
  nombre: string;
  /** El precio grande y, al lado, el período. */
  precio: string;
  periodo?: string;
  /** Otras formas de pagarlo (otra moneda). */
  otros?: string[];
  /** Debajo del nombre, en el renglón del plan. */
  detalle?: string;
  /** El precio del renglón del plan (sin él, no hay renglón de precio). */
  precioRenglon?: string;
  incluye: readonly string[];
  /** Subtotal, descuento y total de hoy. */
  totales?: Array<{ concepto: string; monto: string; tipo?: 'descuento' | 'total' }>;
  nota?: string;
};

/**
 * LO QUE EL CHECKOUT DICE QUE INCLUYE: LA MISMA LISTA QUE LA COLUMNA (14/11/2026). La fuente de verdad es `listaCorta`
 * (app/planes/Tarjetas.tsx), lo que la columna de /planes DIBUJA; acá sólo se aplana, porque el resumen del checkout tiene una
 * sola lista de ✓ y la columna reparte lo mismo en tres partes (los MaKo Tokens, los topes y los checks).
 *
 * ⚠️ POR QUÉ. Martín, 14/11/2026, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la
 *    idea es que cada uno se sienta único». Hasta hoy el checkout tenía su propia lista y el ANUAL leía una tercera
 *    (`PLANES_MAKO_DEFAULT[].incluye`, que todavía dice «Todo lo de Esencial, sin tope de leads, landings ni automatizaciones»):
 *    el visitante leía la columna nueva, tocaba «Anual» y le aparecía otra verdad del mismo plan, con la fórmula que Martín
 *    mandó sacar. Dos listas para un plan son dos promesas, y la que se cumple es una sola.
 * ⚠️ DEPENDE DE LA CAPA, NO DEL id, igual que la columna (§1.5 de docs/relevo/planes-que-incluye-cada-columna.md): un plan nuevo
 *    del setting `planes.mako` con capa `agencia` dice lo de Pro sin tocar código, y ningún id nuevo cae en una lista vieja.
 * ⚠️ Y NO SE ESCRIBE NADA ACÁ: si hay que cambiar un renglón, se cambia en `listaCorta` y lo dicen las dos pantallas. Escribirlo
 *    acá es volver a tener dos verdades.
 */
export function incluyeDeLaColumna(capa: string): readonly string[] {
  const l = listaCorta(capa);
  // El orden de la columna: los MaKo Tokens, los topes y después las funciones. Sin cupo decidido para esa capa, la columna no
  // habla de tokens y el checkout tampoco (nunca un número inventado). La ceja («MaKo lo hace, tú apruebas») NO entra: es el
  // título de la lista, y con un ✓ adelante se leería como una función más.
  // 15/11/2026: `l.topes` se fue — los topes ahora son checks, así que ya vienen en `l.items` (app/planes/Tarjetas.tsx,
  // `ListaDeColumna`). El checkout sigue diciendo EXACTAMENTE lo mismo que la columna sin que haya que tocarlo de nuevo.
  return [...(l.tokens ? [l.tokens] : []), ...l.items.map((x) => `${x.fuerte ?? ''}${x.texto}`)];
}

/**
 * EL RESUMEN DEL ANUAL (14/11/2026). El anual NUNCA pasa por la pasarela (el checkout cobra por mes): se pide y se da de alta a
 * mano, así que no lleva totales ni fecha del primer cobro — sólo el precio por año y los dos meses gratis.
 *
 * ⚠️ VIVE ACÁ Y NO EN LA PÁGINA, por lo mismo que `resumenDelPlan`: lo que el checkout DICE se decide en un solo lugar y se
 *    puede dibujar solo para mirarlo. Armado a mano adentro de page.tsx, se quedó con la lista vieja hasta hoy y ningún test
 *    podía renderizarlo sin levantar media app (tests/checkout-misma-lista-que-la-columna.test.ts).
 */
export function resumenDelAnual(p: { nombre: string; capa: string; precioAnualUsd: number }): Resumen {
  return {
    etiqueta: `Pedir ${p.nombre}, anual`,
    nombre: `${p.nombre}, anual`,
    precio: `US$ ${p.precioAnualUsd.toLocaleString('es-AR')}`,
    periodo: 'por año',
    otros: [`${MESES_GRATIS_ANUAL} meses gratis frente al pago mensual`],
    detalle: 'Un pago por año',
    incluye: incluyeDeLaColumna(p.capa),
  };
}

/**
 * El resumen del plan que se paga: el precio de la primera pasarela que se ofrece (la de su país) y, si hay otra, cuánto es con
 * ella. Con el 50% del primer mes, el total de hoy es el del primer mes; con la prueba gratis, hoy no se cobra nada.
 */
export function resumenDelPlan(p: {
  nombre: string; incluye: readonly string[]; precioUsd: number;
  pasarelas: ReadonlyArray<{ pasarela: Pasarela; moneda: string; monto: number }>;
  conPromo: boolean; conPrueba: boolean; conPrimerMes: (monto: number) => number; precio: string;
}): Resumen {
  const [una, ...resto] = p.pasarelas;
  if (!una) return { etiqueta: `Suscribirte a ${p.nombre}`, nombre: p.nombre, precio: p.precio, incluye: p.incluye };
  const mes = formatoMonto(una.monto, una.moneda);
  const primero = p.conPromo ? p.conPrimerMes(una.monto) : una.monto;
  // Sin «o US$97 por mes con Mercado Pago» debajo del precio (14/11/2026, noche, Martín: «Repetiste lo mismo, no tiene sentido»): el
  // precio de arriba ya lo dice. Las otras pasarelas no llevan renglón propio.
  void resto;
  const otros: string[] = [];
  // Sin «Subtotal» (14/11/2026, noche, Martín: «No me hace sentido que esté»).
  const totales: NonNullable<Resumen['totales']> = [];
  if (p.conPromo && primero < una.monto) totales.push({ concepto: 'Descuento del primer mes', monto: `−${formatoMonto(Math.round((una.monto - primero) * 100) / 100, una.moneda)}`, tipo: 'descuento' });
  totales.push({ concepto: 'Total de hoy', monto: formatoMonto(p.conPrueba ? 0 : primero, una.moneda), tipo: 'total' });
  // CUÁNDO EMPIEZA EL COBRO, CON SU FECHA (12/11/2026, Martín: «eso tiene que estar con que se indique que, como toda
  // suscripción, recién va a empezar el cobro a los 7 días»): como el «Total after trial» de Stripe Checkout.
  const fecha = new Date(Date.now() + PRUEBA_DIAS * 86_400_000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  if (p.conPrueba) totales.push({ concepto: `Desde el ${fecha}`, monto: `${mes} por mes` });
  return {
    etiqueta: p.conPrueba ? `Empezar ${p.nombre} con ${PRUEBA_DIAS} días gratis` : `Suscribirte a ${p.nombre}`,
    nombre: p.nombre,
    precio: p.conPrueba ? formatoMonto(0, una.moneda) : formatoMonto(primero, una.moneda),
    periodo: p.conPrueba ? `hoy; después ${mes} por mes` : p.conPromo ? `el primer mes; después ${mes} por mes` : 'por mes',
    otros,
    // Martín, 14/11/2026: «no pongas abajo "se cobra por mes luego". Pon "suscripción recurrente"… cuidado con cómo usas las palabras».
    detalle: 'Suscripción recurrente',
    precioRenglon: mes,
    incluye: p.incluye,
    totales,
    // Sin nota debajo de los totales (Martín, 14/11/2026: «elimina el texto… "el primer cobro es el día 8…". Se entiende con el texto
    // de arriba, desde el 20 de noviembre, 97 por mes»): el renglón «Desde el <fecha>» ya lo dice.
    nota: undefined,
  };
}

/** El detalle del resumen: el renglón del plan, qué incluye y los totales (abierto en la computadora, plegable en el teléfono). */
function Detalle({ r }: { r: Resumen }) {
  return (
    <div className="ck-detalle">
      <div className="ck-item">
        <span className="ck-item-icono" aria-hidden="true"><MakoLogo size={44} animate={false} /></span>
        <div><b>{r.nombre}</b>{r.detalle && <small>{r.detalle}</small>}</div>
        {r.precioRenglon && <span className="ck-item-precio">{r.precioRenglon}</span>}
      </div>
      {r.incluye.length > 0 && <ul className="ck-incluye" aria-label="Qué incluye">{r.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
      {r.totales && (
        <dl className="ck-totales">
          {r.totales.map((t) => <div key={t.concepto} className={t.tipo ? `ck-${t.tipo}` : undefined}><dt>{t.concepto}</dt><dd>{t.monto}</dd></div>)}
        </dl>
      )}
      {r.nota && <p className="ck-nota-res">{r.nota}</p>}
    </div>
  );
}

/**
 * EL MARCO DEL CHECKOUT (12/11/2026): la estructura de Stripe Checkout, con los colores y la letra de MaKo (app/planes/estilo.ts).
 * A la izquierda el resumen, a la derecha el formulario; en el teléfono el resumen va arriba y plegado («Ver detalle»), sin
 * JavaScript (`<details>`). El pie dice quién procesa el pago y lleva a las condiciones.
 */
export function Ficha({ resumen: r, pasarelas = [], children }: { resumen: Resumen; pasarelas?: readonly Pasarela[]; children: ReactNode }) {
  const procesa = [...new Set(pasarelas)].map((x) => NOMBRE_PASARELA[x]);
  // SIN la barra del sitio (14/11/2026, Martín: «es importante que esa página de checkout no tenga la top bar de arriba, porque el
  // checkout justamente tiene que ser protagonista… y que no haya scroll»). Reemplaza a la del 12/11 («la top bar jamás debe
  // desaparecer»): la marca y la flecha para volver están en la columna del resumen, como en Stripe Checkout.
  return (
    <>
    <main className="planes-root ck-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="ck">
        <section className="ck-resumen" aria-label="Resumen de tu compra">
          <div className="ck-col">
            <header className="ck-marca">
              <Link className="ck-volver" href="/planes" aria-label="Volver a los planes">←</Link>
              <MakoLogo size={28} animate={false} />
              <span>MaKo</span>
            </header>
            <div className="ck-abierto">
              <p className="ck-etiqueta">{r.etiqueta}</p>
              <div className="ck-precio">{r.precio}{r.periodo && <small>{r.periodo}</small>}</div>
              {r.otros?.map((x) => <p key={x} className="ck-otros">{x}</p>)}
              <Detalle r={r} />
            </div>
            <details className="ck-plegable">
              <summary>
                <span className="ck-etiqueta">{r.etiqueta}</span>
                <span className="ck-precio">{r.precio}{r.periodo && <small>{r.periodo}</small>}</span>
                {r.otros?.map((x) => <span key={x} className="ck-otros">{x}</span>)}
                <span className="ck-ver"><span className="ck-ver-abrir">Ver detalle</span><span className="ck-ver-cerrar">Ocultar</span></span>
              </summary>
              <Detalle r={r} />
            </details>
          </div>
        </section>
        <section className="ck-form" aria-label="Tus datos y el pago">
          <div className="ck-col ck-formulario">{children}</div>
        </section>
        <footer className="ck-pie">
          <div className="ck-col">
            {procesa.length > 0 && <span className="ck-procesa">Pagos procesados por <b>{procesa.join(' y ')}</b></span>}
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/reembolsos">Reembolsos</Link>
          </div>
        </footer>
      </div>
    </main>
    </>
  );
}
