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
import { CEJA_LISTA, CEJA_NO_INCLUYE, listaCorta, type ItemLista } from '../Tarjetas';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { CSS_PLANES } from '../estilo';
import { LogoMercadoPago, LogoStripe } from './MarcasDePago';

/** Lo que cambia con la moneda de la pasarela elegida: el precio grande, su período, el del renglón del plan y los totales. */
export type PrecioDeLaPasarela = {
  pasarela: Pasarela;
  precio: string;
  periodo?: string;
  precioRenglon?: string;
  totales?: Array<{ concepto: string; monto: string; tipo?: 'descuento' | 'total' }>;
};

/** Lo que dice el resumen de la izquierda (Stripe Checkout): sólo datos del plan, nada inventado. */
export type Resumen = {
  /** «Suscribirte a MaKo Essential»: lo de arriba del precio. */
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
  /**
   * LA LISTA COMO LA DIBUJA LA COLUMNA (16/11/2026): los renglones con su negrita y, si el plan la tiene, «No incluye» con su ✗. Con
   * ella el resumen dibuja ESTO en vez de `incluye` (que queda como el texto plano de lo mismo). Sale de `listaDelCheckout`.
   */
  lista?: ListaDelCheckout;
  /** Subtotal, descuento y total de hoy. */
  totales?: Array<{ concepto: string; monto: string; tipo?: 'descuento' | 'total' }>;
  nota?: string;
  /**
   * EL PRECIO DE CADA PASARELA, cuando se ofrece más de una (16/11/2026). Martín: «si se cambia de Mercado Pago o tarjeta de crédito
   * o débito, debería cambiar de pesos a dólares… si pongo tarjeta de crédito, debería decirme dólares. Y si pongo Mercado Pago,
   * debería decirme los pesos correspondientes». El resumen decía SIEMPRE el precio de la primera (Mercado Pago, en pesos, desde
   * Argentina) y con la tarjeta elegida seguía en pesos. Ahora el servidor arma los dos y la página muestra el de la fila elegida
   * con `:has()` (`CSS_PLANES`, «LA MONEDA DE LA PASARELA ELEGIDA»): sin JavaScript y sin recargar. El primero es el de la
   * pasarela que se ofrece primero, que es el que se ve mientras no se elige ninguna.
   */
  porPasarela?: readonly PrecioDeLaPasarela[];
};

/** La lista del resumen: «Incluye» con sus ✓ y, en el plan que la tiene, «No incluye» con sus ✗ (la de la columna, tal cual). */
export type ListaDelCheckout = { titulo: string; items: readonly ItemLista[]; tituloNo?: string; noIncluye?: readonly ItemLista[] };

/**
 * LO QUE EL CHECKOUT DICE QUE INCLUYE: LA MISMA LISTA QUE LA COLUMNA (14/11/2026). La fuente de verdad es `listaCorta`
 * (app/planes/Tarjetas.tsx), lo que la columna de /planes DIBUJA; acá sólo se aplana, porque el resumen del checkout tiene una
 * sola lista de ✓ y la columna reparte lo mismo en tres partes (los MaKo Tokens, los topes y los checks).
 *
 * ⚠️ POR QUÉ. Martín, 14/11/2026, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la
 *    idea es que cada uno se sienta único». Hasta hoy el checkout tenía su propia lista y el ANUAL leía una tercera
 *    (`PLANES_MAKO_DEFAULT[].incluye`, que todavía dice «Todo lo de Essential, sin tope de leads, landings ni automatizaciones»):
 *    el visitante leía la columna nueva, tocaba «Anual» y le aparecía otra verdad del mismo plan, con la fórmula que Martín
 *    mandó sacar. Dos listas para un plan son dos promesas, y la que se cumple es una sola.
 * ⚠️ DEPENDE DE LA CAPA, NO DEL id, igual que la columna (§1.5 de docs/relevo/planes-que-incluye-cada-columna.md): un plan nuevo
 *    del setting `planes.mako` con capa `agencia` dice lo de Pro sin tocar código, y ningún id nuevo cae en una lista vieja.
 * ⚠️ Y NO SE ESCRIBE NADA ACÁ: si hay que cambiar un renglón, se cambia en `listaCorta` y lo dicen las dos pantallas. Escribirlo
 *    acá es volver a tener dos verdades.
 */
export function incluyeDeLaColumna(capa: string): readonly string[] {
  // El orden de la columna: los MaKo Tokens, los topes y después las funciones. Sin cupo decidido para esa capa, la columna no
  // habla de tokens y el checkout tampoco (nunca un número inventado). La ceja («MaKo lo hace, tú apruebas») NO entra: es el
  // título de la lista, y con un ✓ adelante se leería como una función más.
  // 15/11/2026: `l.topes` se fue — los topes ahora son checks, así que ya vienen en `l.items` (app/planes/Tarjetas.tsx,
  // `ListaDeColumna`). El checkout sigue diciendo EXACTAMENTE lo mismo que la columna sin que haya que tocarlo de nuevo.
  // 16/11/2026: es el texto plano de `listaDelCheckout`, que es lo que se dibuja (con la negrita y el «No incluye»).
  return listaDelCheckout(capa).items.map((x) => `${x.fuerte ?? ''}${x.texto}`);
}

/**
 * LA LISTA DEL CHECKOUT CON LAS MISMAS ✓ Y ✗ DE LA COLUMNA (16/11/2026). Martín, del resumen de MaKo Essential: «los checks que
 * tienen deberían ser iguales a los checks que tenemos en la columna de los planes, exactamente iguales, con el mismo diseño, con
 * el mismo color… O las cruces». El resumen tenía su propio tilde (la letra «✓» dorada en un círculo celeste de 16 px) y no decía
 * lo que el plan NO trae. Ahora son los renglones de `listaCorta` con su negrita, y el «No incluye» de la columna con su ✗, en el
 * mismo orden; los signos los dibuja `CSS_PLANES` con los de app/planes/signos.ts, que son los de la columna.
 * Los MaKo Tokens van primero, como en la columna, en un renglón (la columna los desglosa en lo que alcanzan: eso queda allá).
 */
export function listaDelCheckout(capa: string): ListaDelCheckout {
  const l = listaCorta(capa);
  return {
    titulo: CEJA_LISTA,
    // Los MaKo Tokens en negrita, como en las dos columnas (su renglón es «<b>24.000 MaKo Tokens al mes:</b>»).
    items: [...(l.tokens ? [{ fuerte: l.tokens, texto: '' }] : []), ...l.items],
    ...(l.noIncluye?.length ? { tituloNo: CEJA_NO_INCLUYE, noIncluye: l.noIncluye } : {}),
  };
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
    lista: listaDelCheckout(p.capa),
  };
}

/**
 * El resumen del plan que se paga, con el precio en la moneda de CADA pasarela que se ofrece (`porPasarela`, desde el 16/11/2026):
 * el de la primera (la de su país) es el que se ve mientras no se elige ninguna. Con el 50% del primer mes, el total de hoy es el
 * del primer mes; con la prueba gratis, hoy no se cobra nada.
 * `capa`: la del plan, para dibujar la lista con la negrita y el «No incluye» de su columna (`listaDelCheckout`). La página la pasa.
 */
export function resumenDelPlan(p: {
  nombre: string; incluye: readonly string[]; precioUsd: number; capa?: string;
  pasarelas: ReadonlyArray<{ pasarela: Pasarela; moneda: string; monto: number }>;
  conPromo: boolean; conPrueba: boolean; conPrimerMes: (monto: number) => number; precio: string;
}): Resumen {
  const lista = p.capa ? listaDelCheckout(p.capa) : undefined;
  const [una] = p.pasarelas;
  if (!una) return { etiqueta: `Suscribirte a ${p.nombre}`, nombre: p.nombre, precio: p.precio, incluye: p.incluye, ...(lista ? { lista } : {}) };
  // CUÁNDO EMPIEZA EL COBRO, CON SU FECHA (12/11/2026, Martín: «eso tiene que estar con que se indique que, como toda
  // suscripción, recién va a empezar el cobro a los 7 días»): como el «Total after trial» de Stripe Checkout.
  const fecha = new Date(Date.now() + PRUEBA_DIAS * 86_400_000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  // Una por pasarela, cada una en SU moneda: lo mismo que antes se armaba sólo con la primera.
  const variantes: PrecioDeLaPasarela[] = p.pasarelas.map((x) => precioDeLaPasarela(x, { ...p, fecha }));
  const v = variantes[0];
  return {
    etiqueta: p.conPrueba ? `Empezar ${p.nombre} con ${PRUEBA_DIAS} días gratis` : `Suscribirte a ${p.nombre}`,
    nombre: p.nombre,
    precio: v.precio,
    periodo: v.periodo,
    // Sin «o US$97 por mes con Mercado Pago» debajo del precio (14/11/2026, noche, Martín: «Repetiste lo mismo, no tiene sentido»):
    // el precio de arriba ya lo dice. Desde el 16/11 el precio de arriba ES el de la pasarela elegida.
    otros: [],
    // Martín, 14/11/2026: «no pongas abajo "se cobra por mes luego". Pon "suscripción recurrente"… cuidado con cómo usas las palabras».
    detalle: 'Suscripción recurrente',
    precioRenglon: v.precioRenglon,
    incluye: p.incluye,
    ...(lista ? { lista } : {}),
    totales: v.totales,
    // Sin nota debajo de los totales (Martín, 14/11/2026: «elimina el texto… "el primer cobro es el día 8…". Se entiende con el texto
    // de arriba, desde el 20 de noviembre, 97 por mes»): el renglón «Desde el <fecha>» ya lo dice.
    nota: undefined,
    porPasarela: variantes,
  };
}

/** El precio, el período y los totales de UNA pasarela, en su moneda. */
function precioDeLaPasarela(una: { pasarela: Pasarela; moneda: string; monto: number }, p: { conPromo: boolean; conPrueba: boolean; conPrimerMes: (monto: number) => number; fecha: string }): PrecioDeLaPasarela {
  const mes = formatoMonto(una.monto, una.moneda);
  const primero = p.conPromo ? p.conPrimerMes(una.monto) : una.monto;
  // Sin «Subtotal» (14/11/2026, noche, Martín: «No me hace sentido que esté»).
  const totales: NonNullable<Resumen['totales']> = [];
  if (p.conPromo && primero < una.monto) totales.push({ concepto: 'Descuento del primer mes', monto: `−${formatoMonto(Math.round((una.monto - primero) * 100) / 100, una.moneda)}`, tipo: 'descuento' });
  totales.push({ concepto: 'Total de hoy', monto: formatoMonto(p.conPrueba ? 0 : primero, una.moneda), tipo: 'total' });
  if (p.conPrueba) totales.push({ concepto: `Desde el ${p.fecha}`, monto: `${mes} por mes` });
  return {
    pasarela: una.pasarela,
    precio: p.conPrueba ? formatoMonto(0, una.moneda) : formatoMonto(primero, una.moneda),
    periodo: p.conPrueba ? `hoy; después ${mes} por mes` : p.conPromo ? `el primer mes; después ${mes} por mes` : 'por mes',
    precioRenglon: mes,
    totales,
  };
}

/**
 * Lo que cobra HOY cada pasarela, ya escrito («US$ 47», «$ 75.000 ARS»): el botón del formulario lo dice cuando no hay prueba
 * («Suscribirme por …»). Sale de los mismos totales del resumen, así el botón y el total no pueden decir dos cosas distintas.
 */
export function totalDeHoyPorPasarela(r: Resumen): Partial<Record<Pasarela, string>> {
  const de = (t: Resumen['totales']) => t?.find((x) => x.tipo === 'total')?.monto;
  const out: Partial<Record<Pasarela, string>> = {};
  for (const v of r.porPasarela ?? []) { const m = de(v.totales); if (m) out[v.pasarela] = m; }
  return out;
}

/**
 * Lo que depende de la moneda, una vez por pasarela: con una sola, tal cual; con varias, cada una en su envoltorio `data-ck-moneda`
 * (`display: contents`, así el envoltorio no cambia el armado de su caja) y `CSS_PLANES` deja ver el de la fila elegida o, sin
 * elegir, el de la primera (`data-ck-primera`).
 */
function SegunPasarela({ r, como = 'span', children }: { r: Resumen; como?: 'span' | 'div'; children: (v: Omit<PrecioDeLaPasarela, 'pasarela'>) => ReactNode }) {
  const vs = r.porPasarela ?? [];
  if (vs.length < 2) return <>{children(r)}</>;
  const Envoltorio = como;
  return <>{vs.map((v, i) => <Envoltorio key={v.pasarela} data-ck-moneda={v.pasarela} data-ck-primera={i === 0 ? '' : undefined}>{children(v)}</Envoltorio>)}</>;
}

/** Un renglón de la lista, como el de la columna: el arranque en negrita y lo que le sigue. */
const Renglon = ({ x }: { x: ItemLista }) => <li><span>{x.fuerte ? <b>{x.fuerte}</b> : null}{x.texto}</span></li>;

/** Qué incluye (y, en el plan que lo tiene, qué no): la lista de la columna con sus ✓ y sus ✗, o el texto plano si no hay lista. */
function Lista({ r }: { r: Resumen }) {
  const l = r.lista;
  if (!l) return r.incluye.length > 0 ? <ul className="ck-incluye" aria-label="Qué incluye">{r.incluye.map((x) => <li key={x}><span>{x}</span></li>)}</ul> : null;
  return (
    <div className="ck-lista">
      <p className="ck-lista-t">{l.titulo}</p>
      <ul className="ck-incluye" aria-label="Qué incluye">{l.items.map((x) => <Renglon key={`${x.fuerte ?? ''}${x.texto}`} x={x} />)}</ul>
      {l.noIncluye?.length ? (
        <>
          <p className="ck-lista-t ck-lista-t-no">{l.tituloNo}</p>
          <ul className="ck-incluye ck-no-incluye" aria-label="Qué no incluye">{l.noIncluye.map((x) => <Renglon key={`${x.fuerte ?? ''}${x.texto}`} x={x} />)}</ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * CON Y SIN LA PRUEBA (16/11/2026, una prueba por persona): si la ruta dice que el email o el WhatsApp ya la usaron, la compra sigue
 * sin ella y el formulario se marca (`data-ck-sin-prueba`, ./CompraPlan.tsx). Lo que cambia —la etiqueta, el precio grande y los
 * totales— se dibuja dos veces y `CSS_PLANES` deja ver uno con `:has()`, igual que la moneda: sin JavaScript de este lado y sin
 * recargar (la lista de lo que incluye es la misma y va una vez). Sin versión sin prueba, tal cual.
 */
function SegunPrueba({ r, sin, como = 'span', children }: { r: Resumen; sin?: Resumen; como?: 'span' | 'div'; children: (r: Resumen) => ReactNode }) {
  if (!sin) return <>{children(r)}</>;
  const Envoltorio = como;
  return <><Envoltorio data-ck-prueba="con">{children(r)}</Envoltorio><Envoltorio data-ck-prueba="sin">{children(sin)}</Envoltorio></>;
}

/** El detalle del resumen: el renglón del plan, qué incluye y los totales (abierto en la computadora, plegable en el teléfono). */
function Detalle({ r, sin }: { r: Resumen; sin?: Resumen }) {
  return (
    <div className="ck-detalle">
      <div className="ck-item">
        <span className="ck-item-icono" aria-hidden="true"><MakoLogo size={44} animate={false} /></span>
        <div><b>{r.nombre}</b>{r.detalle && <small>{r.detalle}</small>}</div>
        {r.precioRenglon && <span className="ck-item-precio"><SegunPasarela r={r}>{(v) => v.precioRenglon}</SegunPasarela></span>}
      </div>
      <Lista r={r} />
      <SegunPrueba r={r} sin={sin} como="div">{(x) => x.totales ? (
        <SegunPasarela r={x} como="div">{(v) => v.totales ? (
          <dl className="ck-totales">
            {v.totales.map((t) => <div key={t.concepto} className={t.tipo ? `ck-${t.tipo}` : undefined}><dt>{t.concepto}</dt><dd>{t.monto}</dd></div>)}
          </dl>
        ) : null}</SegunPasarela>
      ) : null}</SegunPrueba>
      {r.nota && <p className="ck-nota-res">{r.nota}</p>}
    </div>
  );
}

/** El precio grande con su período, en la moneda de la pasarela elegida. */
const PrecioGrande = ({ r }: { r: Resumen }) => <SegunPasarela r={r}>{(v) => <>{v.precio}{v.periodo && <small>{v.periodo}</small>}</>}</SegunPasarela>;

/**
 * EL MARCO DEL CHECKOUT (12/11/2026): la estructura de Stripe Checkout, con los colores y la letra de MaKo (app/planes/estilo.ts).
 * A la izquierda el resumen, a la derecha el formulario; en el teléfono el resumen va arriba y plegado («Ver detalle»), sin
 * JavaScript (`<details>`). El pie dice quién procesa el pago y lleva a las condiciones.
 */
export function Ficha({ resumen: r, sinPrueba: sin, pasarelas = [], children }: {
  resumen: Resumen;
  /** El mismo resumen SIN la prueba, cuando la página se dibuja con ella: lo que se ve si la ruta dice que ya se usó (`SegunPrueba`). */
  sinPrueba?: Resumen;
  pasarelas?: readonly Pasarela[];
  children: ReactNode;
}) {
  const procesa = [...new Set(pasarelas)];
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
              <p className="ck-etiqueta"><SegunPrueba r={r} sin={sin}>{(x) => x.etiqueta}</SegunPrueba></p>
              <div className="ck-precio"><SegunPrueba r={r} sin={sin}>{(x) => <PrecioGrande r={x} />}</SegunPrueba></div>
              {r.otros?.map((x) => <p key={x} className="ck-otros">{x}</p>)}
              <Detalle r={r} sin={sin} />
            </div>
            <details className="ck-plegable">
              <summary>
                <span className="ck-etiqueta"><SegunPrueba r={r} sin={sin}>{(x) => x.etiqueta}</SegunPrueba></span>
                <span className="ck-precio"><SegunPrueba r={r} sin={sin}>{(x) => <PrecioGrande r={x} />}</SegunPrueba></span>
                {r.otros?.map((x) => <span key={x} className="ck-otros">{x}</span>)}
                <span className="ck-ver"><span className="ck-ver-abrir">Ver detalle</span><span className="ck-ver-cerrar">Ocultar</span></span>
              </summary>
              <Detalle r={r} sin={sin} />
            </details>
          </div>
        </section>
        <section className="ck-form" aria-label="Tus datos y el pago">
          <div className="ck-col ck-formulario">{children}</div>
        </section>
        {/* EN UN RENGLÓN, CON LOS LOGOS (16/11/2026, Martín: «en la parte de abajo no me gustaría que tenga doble salto de línea en
            pagos procesados por Mercado Pago y Stripe, términos privados y reembolso… en lugar de poner la palabra Mercado Pago y
            Stripe, poner los logos»). Con los nombres escritos no entraba en un renglón (478 px en una columna de 400: «Reembolsos»
            chocaba con la línea del formulario) y se partió en dos; con los logos entra en uno, de 320 a 1440 (medido; la letra se
            achica un poco en el teléfono angosto, `CSS_PLANES`). Creem no tiene logo acá: va su nombre. */}
        <footer className="ck-pie">
          <div className="ck-col">
            {procesa.length > 0 && (
              // «Pagos con» en el teléfono angosto (`CSS_PLANES`): con «Pagos procesados por» no entra en un renglón a 320 px.
              <span className="ck-procesa"><span className="ck-procesa-largo">Pagos procesados por</span><span className="ck-procesa-corto">Pagos con</span>{procesa.map((x) => (
                <span key={x} className="ck-procesa-logo">{x === 'mercadopago' ? <LogoMercadoPago alto={15} etiqueta={NOMBRE_PASARELA[x]} />
                  : x === 'stripe' ? <LogoStripe size={16} etiqueta={NOMBRE_PASARELA[x]} /> : <b>{NOMBRE_PASARELA[x]}</b>}</span>
              ))}</span>
            )}
            <span className="ck-legales">
              <Link href="/terminos">Términos</Link>
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/reembolsos">Reembolsos</Link>
            </span>
          </div>
        </footer>
      </div>
    </main>
    </>
  );
}
