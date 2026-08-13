'use client';

/**
 * Documento de costos para Mauricio. Estructura pedida por el dueño:
 * conclusiones y gráficos ARRIBA, la explicación de cada punto ABAJO en
 * desplegables. Los <details> son nativos a propósito: no necesitan estado y
 * funcionan sin JS.
 *
 * DOS REGLAS DE CONTENIDO que vienen de su feedback y hay que respetar al editar:
 *  1. Se distingue SIEMPRE «MaKo» (el producto que se construye) de «la operación
 *     de Mauricio» (lo que él usa para atender a SUS clientes). Meterlo todo en un
 *     total hace creer que el producto cuesta el doble de lo que cuesta.
 *  2. NO se cuentan fallas de código ni pasos internos: qué se paga, cuánto, y qué
 *     hay que decidir. El «cómo se arregló» no le sirve para decidir nada.
 *
 * Todo el ancho lo gobierna .doc (un solo max-width). Nada adentro lleva ancho
 * propio: es la regla de layout de AGENTS.md.
 */

const CSS = `
.costos {
  --ground: #F1F4F7; --surface: #FFFFFF; --surface-2: #E8EDF3;
  --ink: #101720; --ink-soft: #34404F; --muted: #5B6878;
  --line: #D8E0E9; --line-soft: #E6ECF2;
  --save: #15654A; --save-bg: #E2F0EA;
  --spend: #96382B; --spend-bg: #F7E7E3;
  --hold: #7D5A0C; --hold-bg: #F7EEDA;
  --accent: #1B4C86; --accent-bg: #E4EBF4;
  --serif: ui-serif, Charter, "Bitstream Charter", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;

  background: var(--ground); color: var(--ink); font-family: var(--sans);
  font-size: 16.5px; line-height: 1.62; min-height: 100vh;
  padding: 0 1.25rem 5rem; -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .costos {
    --ground: #0C1119; --surface: #141B25; --surface-2: #1B2430;
    --ink: #E9EEF4; --ink-soft: #C3CDD9; --muted: #8E9CAF;
    --line: #26313F; --line-soft: #1E2833;
    --save: #52C295; --save-bg: #123028;
    --spend: #E28572; --spend-bg: #331C18;
    --hold: #D6A343; --hold-bg: #2E2410;
    --accent: #74A9DD; --accent-bg: #14243A;
  }
}
.costos *, .costos *::before, .costos *::after { box-sizing: border-box; }
.costos .doc { max-width: 54rem; margin: 0 auto; }

.costos .top { padding: 3.5rem 0 2rem; border-bottom: 1px solid var(--line); margin-bottom: 2.25rem; }
.costos .eyebrow { font-family: var(--mono); font-size: .72rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--muted); margin: 0 0 1rem; }
.costos h1 { font-family: var(--serif); font-weight: 600; font-size: clamp(2.1rem, 5.5vw, 3rem);
  line-height: 1.1; letter-spacing: -.015em; text-wrap: balance; margin: 0 0 1rem; }
.costos .lede { font-size: 1.12rem; color: var(--ink-soft); margin: 0; max-width: 40rem; }

.costos .headline { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 3px;
  overflow: hidden; margin: 0 0 .85rem; }
.costos .hcell { background: var(--surface); padding: 1.5rem 1.4rem; }
.costos .hcell .lbl { font-family: var(--mono); font-size: .7rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted); display: block; margin-bottom: .55rem; }
.costos .hcell .num { font-family: var(--serif); font-size: 2.4rem; line-height: 1;
  font-variant-numeric: tabular-nums; letter-spacing: -.02em; display: block; }
.costos .hcell .sub { font-size: .87rem; color: var(--muted); display: block; margin-top: .5rem; }
.costos .was { color: var(--spend); } .costos .now { color: var(--save); } .costos .dif { color: var(--accent); }

.costos h2 { font-family: var(--serif); font-size: 1.6rem; font-weight: 600; letter-spacing: -.01em;
  line-height: 1.25; text-wrap: balance; margin: 3.2rem 0 .9rem; padding-top: 1.5rem;
  border-top: 2px solid var(--ink); }
.costos h3 { font-size: 1.02rem; font-weight: 650; margin: 1.9rem 0 .4rem; }
.costos p { margin: 0 0 1rem; }
.costos ul { margin: 0 0 1rem; padding-left: 1.15rem; }
.costos li { margin-bottom: .5rem; }
.costos strong { font-weight: 650; }

.costos .scroll { overflow-x: auto; margin: 1.4rem 0; border: 1px solid var(--line); border-radius: 3px; }
.costos table { border-collapse: collapse; width: 100%; font-size: .93rem; background: var(--surface); }
.costos th, .costos td { text-align: left; padding: .7rem .9rem; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
.costos th { font-family: var(--mono); font-size: .68rem; letter-spacing: .09em; text-transform: uppercase;
  color: var(--muted); font-weight: 500; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.costos td.n, .costos th.n { text-align: right; font-variant-numeric: tabular-nums;
  font-family: var(--mono); font-size: .88rem; }
.costos tbody tr:last-child td { border-bottom: none; }
.costos tr.total td { font-weight: 700; background: var(--surface-2); border-top: 1px solid var(--line); }
.costos tr.sub td { background: var(--surface-2); font-weight: 650; font-size: .82rem;
  font-family: var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.costos td.w { white-space: normal; min-width: 13rem; }
.costos .up { color: var(--spend); } .costos .down { color: var(--save); }

.costos .note { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--accent);
  border-radius: 2px; padding: 1.05rem 1.2rem; margin: 1.4rem 0; }
.costos .note.warn { border-left-color: var(--hold); background: var(--hold-bg); }
.costos .note.good { border-left-color: var(--save); background: var(--save-bg); }
.costos .note p:last-child { margin-bottom: 0; }
.costos .note .tag { font-family: var(--mono); font-size: .68rem; letter-spacing: .1em;
  text-transform: uppercase; display: block; margin-bottom: .5rem; color: var(--muted); }

.costos .pill { display: inline-block; font-family: var(--mono); font-size: .68rem; letter-spacing: .05em;
  text-transform: uppercase; padding: .15rem .45rem; border-radius: 2px; white-space: nowrap; }
.costos .pill.mako { background: var(--accent-bg); color: var(--accent); }
.costos .pill.oper { background: var(--hold-bg); color: var(--hold); }
.costos .pill.ok { background: var(--save-bg); color: var(--save); }
.costos .pill.mal { background: var(--spend-bg); color: var(--spend); }

/* comparativa antes/ahora — solo lo que CAMBIO */
.costos .comp { margin: 1.5rem 0; border: 1px solid var(--line); border-radius: 3px;
  background: var(--surface); overflow: hidden; }
.costos .comp-row { display: grid; grid-template-columns: minmax(8rem, 1.1fr) 3fr minmax(6rem, auto);
  align-items: center; gap: 1rem; padding: .85rem 1.1rem; border-bottom: 1px solid var(--line-soft); }
.costos .comp-row:last-child { border-bottom: none; }
.costos .comp-name { font-size: .92rem; font-weight: 600; }
.costos .comp-name small { display: block; font-weight: 400; color: var(--muted); font-size: .78rem; }
.costos .rails { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.costos .rail { height: 13px; background: var(--surface-2); border-radius: 2px; overflow: hidden; }
.costos .rail i { display: block; height: 100%; }
.costos .rail.a i { background: var(--spend); opacity: .8; }
.costos .rail.b i { background: var(--save); }
.costos .comp-val { font-family: var(--mono); font-size: .86rem; font-variant-numeric: tabular-nums;
  text-align: right; white-space: nowrap; }
.costos .comp-val b { display: block; color: var(--save); font-weight: 700; }
.costos .comp-val s { color: var(--muted); text-decoration-color: var(--spend); }
.costos .comp-head { display: flex; gap: 1.25rem; font-size: .8rem; color: var(--muted);
  padding: .6rem 1.1rem; background: var(--surface-2); border-bottom: 1px solid var(--line);
  align-items: center; flex-wrap: wrap; }
.costos .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px;
  margin-right: .35rem; vertical-align: -1px; }

.costos details { background: var(--surface); border: 1px solid var(--line); border-radius: 3px;
  margin-bottom: .6rem; overflow: hidden; }
.costos summary { cursor: pointer; padding: .95rem 1.15rem; font-weight: 600; font-size: 1rem;
  list-style: none; display: flex; align-items: baseline; gap: .7rem; }
.costos summary::-webkit-details-marker { display: none; }
.costos summary::before { content: '+'; font-family: var(--mono); font-size: 1.1rem; color: var(--accent);
  line-height: 1; flex-shrink: 0; }
.costos details[open] > summary::before { content: '−'; }
.costos details[open] > summary { border-bottom: 1px solid var(--line-soft); }
.costos summary:hover { background: var(--surface-2); }
.costos summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.costos .body { padding: 1.15rem 1.15rem .3rem; }
.costos .body > :last-child { margin-bottom: 1rem; }
.costos .sum-note { font-weight: 400; color: var(--muted); font-size: .87rem; margin-left: auto;
  text-align: right; white-space: nowrap; }

/* el enlace a la explicación de cada sección: en el azul de acento, para que se
   lea como lo que es (algo en lo que se hace click) y no como una nota al pie */
.costos .ver { display: inline-block; margin: -.4rem 0 1.6rem; font-size: .87rem;
  color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor;
  padding-bottom: 1px; transition: opacity .15s; }
.costos .ver:hover { opacity: .7; }
.costos .ver:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 1px; }
.costos details { scroll-margin-top: 1rem; }
@media (prefers-reduced-motion: reduce) { .costos { scroll-behavior: auto; } }

.costos footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line);
  font-size: .85rem; color: var(--muted); }
@media (max-width: 640px) {
  .costos .sum-note { display: none; }
  .costos summary { font-size: .95rem; }
  .costos .comp-row { grid-template-columns: 1fr auto; }
  .costos .rails { display: none; }
}
`;

/**
 * «Ver explicación» — lleva al desplegable que sostiene los números de esta sección,
 * lo ABRE y lo deja arriba de la pantalla. Sin esto los <details> de abajo son un
 * anexo que nadie relaciona con la tabla que acaba de leer.
 */
function Ver({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      className="ver"
      href={`#${id}`}
      onClick={(e) => {
        const el = document.getElementById(id);
        if (!(el instanceof HTMLDetailsElement)) return; // sin JS/elemento, el href salta igual
        e.preventDefault();
        el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      {children}
      <span aria-hidden="true"> ↓</span>
    </a>
  );
}

/** Una fila de la comparativa. Escala fija a $160 (el renglón más grande que cambió). */
function Comp({ nombre, detalle, antes, ahora }: { nombre: string; detalle: string; antes: number; ahora: number }) {
  const esc = (v: number) => `${Math.min(100, (v / 160) * 100)}%`;
  return (
    <div className="comp-row">
      <div className="comp-name">{nombre}<small>{detalle}</small></div>
      <div className="rails">
        <div className="rail a"><i style={{ width: esc(antes) }} /></div>
        <div className="rail b"><i style={{ width: esc(ahora) }} /></div>
      </div>
      <div className="comp-val"><s>${antes}</s><b>${ahora}</b></div>
    </div>
  );
}

export default function Costos() {
  return (
    <div className="costos">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="doc">

        <div className="top">
          <p className="eyebrow">Informe de costos · 13 de agosto de 2026</p>
          <h1>Qué pagamos por mes, y por qué</h1>
          <p className="lede">
            Todos los servicios, separados en dos: lo que cuesta <strong>construir y sostener
            MaKo</strong>, y lo que cuesta <strong>tu operación diaria</strong> con tus clientes.
            Son cosas distintas y conviene no mezclarlas.
          </p>
        </div>

        <div className="headline">
          <div className="hcell">
            <span className="lbl">Costaba por mes</span>
            <span className="num was">$540</span>
            <span className="sub">Agosto, si no tocábamos nada</span>
          </div>
          <div className="hcell">
            <span className="lbl">Cuesta ahora</span>
            <span className="num now">$339</span>
            <span className="sub">Con todo lo aplicado</span>
          </div>
          <div className="hcell">
            <span className="lbl">Diferencia</span>
            <span className="num dif">$201</span>
            <span className="sub">Por mes · $2.412 al año</span>
          </div>
        </div>
        <p style={{ fontSize: '.9rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
          Todos los montos en dólares por mes, tomados de las facturas reales de cada servicio.
        </p>

        <h2>La separación que importa</h2>

        <p>
          De esos $339, la mayor parte no es «infraestructura de MaKo»: es{' '}
          <strong>el plan de Claude</strong>, que es la herramienta con la que se construye el
          producto. Separado queda así:
        </p>

        <div className="scroll">
          <table>
            <thead>
              <tr><th className="w">Concepto</th><th className="n">Por mes</th><th className="w">Qué es</th></tr>
            </thead>
            <tbody>
              <tr className="sub"><td colSpan={3}>Construir y sostener MaKo</td></tr>
              <tr>
                <td>Claude</td><td className="n">$200</td>
                <td className="w">La herramienta con la que se programa MaKo. Es el costo de <em>construirlo</em>, no de operarlo.</td>
              </tr>
              <tr>
                <td>Vercel</td><td className="n">$20</td>
                <td className="w">Donde vive MaKo y se sirve a todos los clientes.</td>
              </tr>
              <tr>
                <td>Supabase</td><td className="n">$25</td>
                <td className="w">La base de datos. Una sola para todos los clientes de MaKo: un cliente nuevo <strong>no suma nada acá</strong>.</td>
              </tr>
              <tr>
                <td>IA de MaKo</td><td className="n">$22</td>
                <td className="w">Lo que consume la inteligencia artificial trabajando dentro del producto.</td>
              </tr>
              <tr className="total"><td>Subtotal MaKo</td><td className="n">$267</td><td className="w"></td></tr>

              <tr className="sub"><td colSpan={3}>Tu operación con tus clientes</td></tr>
              <tr>
                <td>Supabase para tus clientes</td><td className="n">$39</td>
                <td className="w">Una base por cada tablero que le armaste a un cliente tuyo: esquer, texx, baja-teriyaki y aspro. $9,81 cada uno.</td>
              </tr>
              <tr>
                <td>Railway</td><td className="n">$21</td>
                <td className="w">Tu WhatsApp: la bandeja y la conexión con tu número. <strong>Hoy lo paga Leandro.</strong></td>
              </tr>
              <tr>
                <td>Calendly</td><td className="n">$12</td>
                <td className="w">Tu agenda de reuniones.</td>
              </tr>
              <tr>
                <td>Fathom</td><td className="n">$0</td>
                <td className="w">Graba y transcribe tus reuniones. Pasa al plan gratuito.</td>
              </tr>
              <tr className="total"><td>Subtotal operación</td><td className="n">$72</td><td className="w"></td></tr>

              <tr className="total"><td>Total</td><td className="n">$339</td><td className="w"></td></tr>
            </tbody>
          </table>
        </div>

        <Ver id="d-supabase">Ver por qué se pagan 5 bases de Supabase</Ver>

        <div className="note good">
          <span className="tag">El titular</span>
          <p>
            <strong>Sostener MaKo funcionando cuesta $67 por mes</strong> — servidores, base de
            datos e inteligencia artificial. Los $200 de Claude son la herramienta para
            construirlo, y los $72 restantes son tu operación diaria, que existiría con o sin
            MaKo.
          </p>
        </div>

        <h2>De dónde salió el ahorro</h2>
        <p>Cuatro servicios cambiaron. Claude, Calendly y los tableros de clientes quedaron igual.</p>

        <div className="comp">
          <div className="comp-head">
            <span><span className="sw" style={{ background: 'var(--spend)' }} />Arriba: lo que costaba</span>
            <span><span className="sw" style={{ background: 'var(--save)' }} />Abajo: lo que cuesta ahora</span>
          </div>
          <Comp nombre="Vercel" detalle="Donde vive la app" antes={160} ahora={20} />
          <Comp nombre="IA de MaKo" detalle="La inteligencia artificial del producto" antes={85} ahora={22} />
          <Comp nombre="Supabase" detalle="MaKo + los tableros de tus clientes" antes={80} ahora={64} />
          <Comp nombre="Fathom" detalle="Graba tus reuniones" antes={18} ahora={0} />
        </div>
        <Ver id="d-vercel">Ver de dónde salió cada número</Ver>

        <h2>Qué esperar cada mes</h2>
        <p>Casi todo es fijo. Lo único que se mueve con el uso es la IA.</p>

        <div className="scroll">
          <table>
            <thead>
              <tr><th>Concepto</th><th className="n">Mínimo</th><th className="n">Esperado</th><th className="n">Máximo</th><th className="w">De qué depende</th></tr>
            </thead>
            <tbody>
              <tr><td>Claude</td><td className="n">$200</td><td className="n">$200</td><td className="n">$200</td><td className="w">No se mueve.</td></tr>
              <tr><td>Supabase</td><td className="n">$64</td><td className="n">$64</td><td className="n">$74</td><td className="w">$10 por cada tablero nuevo que le armes a un cliente tuyo.</td></tr>
              <tr><td>IA de MaKo</td><td className="n">$12</td><td className="n">$22</td><td className="n">$45</td><td className="w">Cuántas llamadas de venta se analizan.</td></tr>
              <tr><td>Railway</td><td className="n">$21</td><td className="n">$21</td><td className="n">$21</td><td className="w">Tu WhatsApp. No se mueve con el volumen de mensajes.</td></tr>
              <tr><td>Vercel</td><td className="n">$20</td><td className="n">$20</td><td className="n">$25</td><td className="w">Fijo salvo un pico de tráfico grande.</td></tr>
              <tr><td>Calendly</td><td className="n">$12</td><td className="n">$12</td><td className="n">$12</td><td className="w">No se mueve.</td></tr>
              <tr className="total"><td>Total mensual</td><td className="n">$329</td><td className="n">$339</td><td className="n">$377</td><td className="w"></td></tr>
            </tbody>
          </table>
        </div>

        <Ver id="d-ia">Ver qué mueve el gasto de la IA de MaKo</Ver>

        <div className="note">
          <span className="tag">Y esto es lo importante para vender MaKo</span>
          <p>
            <strong>Un cliente nuevo de MaKo no te agrega costo.</strong> Supabase es una sola base
            para todos, Vercel ya está pago, y <strong>cada cliente conecta su propia cuenta de
            inteligencia artificial</strong>, así que su consumo lo paga él.
          </p>
          <p>
            Lo que sí te suma costo es un cliente nuevo <strong>de tu agencia</strong> al que le
            armes su propio tablero: eso son $9,81 por mes.
          </p>
        </div>

        <h2>Lo que hay que decidir</h2>

        <div className="scroll">
          <table>
            <thead>
              <tr><th className="w">Decisión</th><th className="n">Impacto</th><th className="w">Recomendación</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="w"><strong>⚠️ La cuenta de IA está sin saldo</strong></td>
                <td className="n up">Urgente</td>
                <td className="w">Está en −$0,39 y cortada. Hay 50 análisis de llamadas de venta esperando. Cargale saldo: es lo único de esta lista que hay que hacer hoy.</td>
              </tr>
              <tr>
                <td className="w"><strong>Railway lo paga Leandro</strong></td>
                <td className="n">$21/mes</td>
                <td className="w">Pasalo a tu cuenta. Si él da de baja la tarjeta, se cae el WhatsApp de todos los clientes conectados, no solo el tuyo.</td>
              </tr>
              <tr>
                <td className="w"><strong>Fathom a plan gratuito</strong></td>
                <td className="n down">−$18/mes</td>
                <td className="w">Sí. Lo que MaKo necesita —el texto de la reunión— es ilimitado en el plan gratis.</td>
              </tr>
              <tr>
                <td className="w"><strong>Hay un teléfono conectado dos veces</strong></td>
                <td className="n">$0</td>
                <td className="w">El mismo número de WhatsApp está abierto en dos sesiones a la vez. No cuesta casi nada, pero es de los patrones que más rápido hacen que Meta banee un número.</td>
              </tr>
              <tr>
                <td className="w"><strong>Los tableros de tus clientes</strong></td>
                <td className="n">$39/mes</td>
                <td className="w">Es costo de servicio, no desperdicio. Vale confirmar que cada cliente lo cubra.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Ver id="d-railway">Ver el detalle de Railway y el WhatsApp</Ver>

        <h2>La explicación de cada punto</h2>
        <p>Todo lo de arriba, con el detalle de dónde salen los números.</p>

        <details id="d-vercel">
          <summary>Vercel: pagábamos por actualizar la app, no por usarla <span className="sum-note">$160 → $20</span></summary>
          <div className="body">
            <p>
              Este era el gasto más grande y no tenía nada que ver con los clientes. El número que
              lo resume: <strong>en 13 días, todo el tráfico de usuarios de MaKo costó 45
              centavos.</strong> Se puede multiplicar por diez la cantidad de usuarios y casi no se
              mueve.
            </p>
            <p>
              Lo caro era <strong>subir a producción cada versión nueva de MaKo</strong>. Como el
              producto se mejora todos los días, eso pasa muchas veces por día —unas 46—, y el
              proveedor cobraba cada una de esas actualizaciones como si fuera un trabajo mucho más
              grande de lo que era: cobraba <strong>un minuto entero de la computadora más
              potente</strong>, aunque la actualización tardara 33 segundos.
            </p>
            <div className="scroll">
              <table>
                <thead><tr><th>Día</th><th className="n">Actualizaciones</th><th className="n">Lo que facturó</th></tr></thead>
                <tbody>
                  <tr><td>10 de agosto</td><td className="n">36</td><td className="n">$3,78</td></tr>
                  <tr><td>11 de agosto</td><td className="n">56</td><td className="n">$5,88</td></tr>
                  <tr><td>12 de agosto</td><td className="n">50</td><td className="n">$5,25</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Se cambió el tamaño de esa computadora al estándar, y con el estándar{' '}
              <strong>actualizar la app no se factura</strong>. También se sacó un segundo asiento
              de administrador que costaba $18,50 por mes. Nada de esto cambia el producto: sigue
              actualizándose igual de seguido.
            </p>
          </div>
        </details>

        <details id="d-supabase">
          <summary>Supabase: pagás 5 bases, MaKo usa 1 <span className="sum-note">$80 → $64</span></summary>
          <div className="body">
            <p>
              La base de MaKo está en el tamaño más chico que se puede pagar y le sobra capacidad:
              usa el 100% de su memoria como caché, tiene 9 conexiones abiertas de 60 disponibles y
              ocupa 374 MB de los 8.000 que incluye el plan. <strong>No hay nada que optimizar
              ahí.</strong>
            </p>
            <p>El detalle de los $64 es otro: <strong>se pagan 5 bases, no una.</strong></p>
            <div className="scroll">
              <table>
                <thead><tr><th>Base</th><th className="w">De qué es</th><th className="n">Actividad (7 días)</th><th className="n">Costo</th></tr></thead>
                <tbody>
                  <tr><td><strong>MaKo</strong></td><td className="w">El producto, con TODOS sus clientes adentro</td><td className="n">1.134.762</td><td className="n">$9,81</td></tr>
                  <tr><td>esquer</td><td className="w">Tablero de un cliente tuyo</td><td className="n">30.211</td><td className="n">$9,81</td></tr>
                  <tr><td>baja-teriyaki</td><td className="w">Tablero de un cliente tuyo</td><td className="n">28.798</td><td className="n">$9,81</td></tr>
                  <tr><td>texx</td><td className="w">Tablero de un cliente tuyo</td><td className="n">19.902</td><td className="n">$9,81</td></tr>
                  <tr><td>aspro</td><td className="w">Tablero de un cliente tuyo</td><td className="n">957</td><td className="n">$9,81</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>MaKo entero cuesta $9,81 de base de datos</strong>, con todos sus clientes
              adentro — es una sola base compartida, así que sumar clientes al producto no agrega
              nada acá. Los otros $39 son los tableros que le armaste a clientes de tu agencia: eso
              es costo de servicio.
            </p>
          </div>
        </details>

        <details id="d-ia">
          <summary>La IA de MaKo: qué cuesta y qué no <span className="sum-note">$85 → $22</span></summary>
          <div className="body">
            <div className="note good">
              <span className="tag">Lo primero, porque suele confundirse</span>
              <p>
                <strong>Transcribir las reuniones no cuesta nada.</strong> Fathom graba, transcribe
                y entrega el texto ya hecho; MaKo solo lo descarga. Todo lo que se transcribió en la
                historia del sistema costó <strong>menos de un centavo</strong>.
              </p>
              <p>
                Lo que cuesta es <strong>leer ese texto y sacarle algo</strong>: las tareas de cada
                reunión, el análisis de una llamada de venta, la priorización del plan.
              </p>
            </div>

            <h3>En qué se fue el mes</h3>
            <div className="scroll">
              <table>
                <thead><tr><th className="w">Qué hace</th><th className="n">Agosto</th><th className="w">Cuánto cuesta ahora</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="w">Sacar las tareas de cada reunión</td>
                    <td className="n">$23,44</td>
                    <td className="w down"><strong>$0 — pasó a un modelo gratuito</strong></td>
                  </tr>
                  <tr>
                    <td className="w">Analizar llamadas de venta</td>
                    <td className="n">$14,35</td>
                    <td className="w">Sigue pagándose, a propósito</td>
                  </tr>
                  <tr>
                    <td className="w">Priorizar tu plan de trabajo</td>
                    <td className="n">$7,21</td>
                    <td className="w down"><strong>$0 — pasó a un modelo gratuito</strong></td>
                  </tr>
                  <tr>
                    <td className="w">Todo lo demás junto</td>
                    <td className="n">$3,94</td>
                    <td className="w">Prácticamente gratis</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              <strong>Casi todo pasó a modelos gratuitos.</strong> Del 9 de agosto en adelante el
              gasto bajó a $1,27 por día, y de eso el 75% es una sola cosa: el análisis de llamadas
              de venta.
            </p>

            <h3>Por qué un día costó $13</h3>
            <p>
              Vale la pena entenderlo porque explica casi todo el mes. Una reunión larga se parte en{' '}
              <strong>8 pedazos</strong>; la IA lee los 8 y escribe las tareas que encontró. Una
              pasada completa cuesta <strong>$1,50</strong>. El problema fue que el sistema{' '}
              <strong>volvió a leer la misma reunión 13 veces, una por hora</strong>, porque no
              guardaba que ya la había procesado. 13 × $1,50 = $19.
            </p>
            <p>
              O sea: leer una reunión cuesta lo que tiene que costar. Lo que no correspondía era
              hacerlo 13 veces. Ya no pasa, y además esa función pasó a un modelo gratuito.
            </p>

            <div className="note warn">
              <span className="tag">El precio de que sea gratis</span>
              <p>
                Los modelos gratuitos tienen un tope diario. Cuando se agota,{' '}
                <strong>la reunión no se lee y se reintenta más tarde</strong> — no se degrada la
                calidad, simplemente se pospone. Esta semana pasó 51 veces. Con más volumen se
                resuelve sumando una segunda cuenta gratuita, o pasando a la versión paga de ese
                modelo, que para todo el volumen de agosto habría costado <strong>$7,97</strong>.
              </p>
            </div>
          </div>
        </details>

        <details id="d-llamadas">
          <summary>Análisis de llamadas de venta: el techo de dos clientes por día <span className="sum-note">Lo que falta</span></summary>
          <div className="body">
            <p>
              MaKo revisa <strong>las llamadas de venta</strong> —no las juntas de equipo ni las de
              soporte— y saca de cada una qué se hizo bien, qué se hizo mal y en qué quedó. Es la
              función más valiosa del producto y la única donde vale la pena pagar el modelo bueno:
              un análisis flojo se ve igual que uno bueno, y ahí no se ahorra.
            </p>
            <div className="note warn">
              <span className="tag">El límite que hay que levantar antes de vender</span>
              <p>
                Ese análisis corre una vez por día y{' '}
                <strong>solo alcanza a atender a dos clientes</strong>, siempre los mismos dos. Con
                10 clientes conectados, <strong>8 no reciben su análisis</strong> y la factura no
                sube — o sea que el costo bajo de hoy no es una virtud, es que el servicio no se
                está entregando completo.
              </p>
              <p>
                Ya se levantó el límite: ahora reparte el turno entre todos los clientes y rota, así
                a todos les toca. <strong>Eso hace subir la factura de IA, y está bien que suba:</strong>{' '}
                es el costo de entregar el servicio de verdad.
              </p>
            </div>
            <h3>La oportunidad más grande, y ya la estás pagando</h3>
            <p>
              De las 74 llamadas que se analizaron en agosto, <strong>51 eran juntas de entrega con
              tus clientes</strong> — no llamadas de venta. El sistema las analiza igual, gasta{' '}
              <strong>$9,89</strong>, y después descarta el resultado por no ser una venta.
            </p>
            <p>
              Para lo que estás armando en Customer Success, <strong>ese trabajo ya está pago</strong>:
              en vez de tirarlo, se guarda. Es la diferencia entre construir algo nuevo y aprovechar
              lo que ya se está haciendo.
            </p>
          </div>
        </details>

        <details id="d-railway">
          <summary>Railway: tu WhatsApp, y hoy lo paga Leandro <span className="sum-note">$21</span></summary>
          <div className="body">
            <p>En Railway corren las dos piezas de tu WhatsApp:</p>
            <ul>
              <li><strong>La bandeja de entrada</strong>, donde se ven y responden todas las conversaciones.</li>
              <li><strong>La conexión con tu número</strong>, la que se activa escaneando el QR.</li>
            </ul>
            <p>
              Es <strong>tu operación</strong>: lo usás para hablar con tus clientes y tus leads.{' '}
              <strong>No hay razón para que lo pague Leandro</strong>, y hay una razón fuerte para
              que no: si él da de baja la tarjeta, se cae el WhatsApp de <em>todos</em> los números
              conectados de golpe, no solo el tuyo. Hoy hay tres.
            </p>

            <h3>Cómo se pasa a tu cuenta</h3>
            <p>
              Es una transferencia del proyecto dentro de Railway. El único paso operativo es que{' '}
              <strong>cada número conectado tiene que volver a escanear el QR</strong> una vez —
              son dos minutos por número, y hoy son tres. Cuanto antes se haga, menos gente hay que
              coordinar.
            </p>

            <h3>Si activamos el chatbot y le escribimos a todos los leads, ¿sube?</h3>
            <p>
              <strong>Prácticamente nada: menos de 50 centavos.</strong> Railway cobra por tener el
              servicio prendido, no por mensaje. Mandarles a los 1.251 leads y recibir sus
              respuestas mueve unos 45 MB — centavos.
            </p>
            <div className="note warn">
              <span className="tag">Lo que sí hay que cuidar</span>
              <p>
                El costo de escribirle a mil personas no es la plata: <strong>es el número</strong>.
                Mil mensajes fríos seguidos desde un WhatsApp común es exactamente el patrón que
                Meta banea. Por eso el sistema tiene un tope de 40 envíos por día por cliente, y
                conviene dejarlo. Subirlo para terminar antes no lo paga Railway: lo paga tu número.
              </p>
              <p>
                Antes de prender el chatbot hay algo para corregir: <strong>hay un teléfono
                conectado dos veces</strong>, en dos sesiones simultáneas. Es de los patrones que
                más rápido hacen que Meta banee un número, y desconectar una de las dos es gratis.
              </p>
            </div>
          </div>
        </details>

        <details id="d-otros">
          <summary>Fathom y Calendly <span className="sum-note">$0 y $12</span></summary>
          <div className="body">
            <h3>Fathom — pasa a gratuito</h3>
            <p>
              Graba y transcribe tus reuniones. El plan gratuito incluye{' '}
              <strong>grabaciones y transcripciones ilimitadas</strong> y el acceso que MaKo usa para
              traerse el texto. Lo único limitado son los resúmenes automáticos (5 por mes), y MaKo
              no depende de ellos: usa el texto completo de la reunión.
            </p>
            <p>
              <strong>Al bajarlo, mirá una cosa durante la primera semana:</strong> que las reuniones
              nuevas sigan apareciendo con sus tareas en el plan. Si dejaran de aparecer, se vuelve
              al plan pago y listo — son $18 y es reversible en un click.
            </p>
            <h3>Calendly — este no se puede bajar</h3>
            <p>
              MaKo no lo usa solo para agendar: usa el aviso automático que llega{' '}
              <strong>cada vez que alguien reserva o reprograma</strong>, y ese aviso no existe en el
              plan gratuito. Sin él no se registra la reunión agendada, y sin eso no hay embudo ni
              seguimiento de ventas. <strong>Bajarlo no ahorra $12: rompe la medición.</strong>
            </p>
          </div>
        </details>

        <footer>
          <p>
            <strong>Sobre estos números.</strong> Los servidores y la IA salen de las facturas reales
            consultadas hoy; la base de datos, del detalle de la cuenta; Railway, del último mes; el
            resto, del plan contratado en cada servicio. Documento fechado al 13 de agosto de 2026.
          </p>
        </footer>

      </div>
    </div>
  );
}
