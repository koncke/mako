'use client';

/**
 * Documento de costos para Mauricio. Estructura pedida por el dueño:
 * conclusiones y gráficos ARRIBA, la explicación de cada punto ABAJO en
 * desplegables. Los <details> son nativos a propósito: no necesitan estado y
 * funcionan sin JS.
 *
 * Todo el ancho lo gobierna .doc (un solo max-width). Nada adentro lleva ancho
 * propio: es la regla de layout de AGENTS.md — un max-width puesto al texto
 * dentro de un contenedor más ancho deja media caja vacía a la derecha.
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

/* UN solo ancho para todo el documento */
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
.costos .pill.fijo { background: var(--accent-bg); color: var(--accent); }
.costos .pill.var { background: var(--hold-bg); color: var(--hold); }
.costos .pill.ok { background: var(--save-bg); color: var(--save); }
.costos .pill.mal { background: var(--spend-bg); color: var(--spend); }

/* barras */
.costos .bars { margin: 1.5rem 0; }
.costos .bar-row { margin-bottom: 1rem; }
.costos .bar-top { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin-bottom: .3rem; }
.costos .bar-name { font-size: .92rem; font-weight: 600; }
.costos .bar-val { font-family: var(--mono); font-size: .86rem; font-variant-numeric: tabular-nums; color: var(--muted); }
.costos .track { height: 20px; background: var(--surface-2); border-radius: 2px; overflow: hidden; display: flex; }
.costos .fill { height: 100%; }
.costos .fill.was { background: var(--spend); opacity: .85; }
.costos .fill.now { background: var(--save); }
.costos .legend { display: flex; gap: 1.25rem; font-size: .82rem; color: var(--muted);
  margin-top: .9rem; align-items: center; flex-wrap: wrap; }
.costos .swatch { display: inline-block; width: 11px; height: 11px; border-radius: 2px;
  margin-right: .35rem; vertical-align: -1px; }

/* desplegables */
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

.costos footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line);
  font-size: .85rem; color: var(--muted); }
@media (max-width: 640px) {
  .costos .sum-note { display: none; }
  .costos summary { font-size: .95rem; }
}
`;

export default function Costos() {
  return (
    <div className="costos">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="doc">

        <div className="top">
          <p className="eyebrow">Informe de costos · 13 de agosto de 2026</p>
          <h1>Qué pagamos por mes, y por qué</h1>
          <p className="lede">
            Todos los servicios que sostienen MaKo: cuánto cuesta cada uno, qué encontramos y
            arreglamos esta semana, quién está pagando qué, y cuánto esperar cada mes de acá en
            adelante.
          </p>
        </div>

        {/* ───────── CONCLUSIONES ARRIBA ───────── */}

        <div className="headline">
          <div className="hcell">
            <span className="lbl">Costaba por mes</span>
            <span className="num was">$569</span>
            <span className="sub">Agosto, si no tocábamos nada</span>
          </div>
          <div className="hcell">
            <span className="lbl">Cuesta ahora</span>
            <span className="num now">$367</span>
            <span className="sub">Con todo lo aplicado</span>
          </div>
          <div className="hcell">
            <span className="lbl">Diferencia</span>
            <span className="num dif">$202</span>
            <span className="sub">Por mes · $2.424 al año</span>
          </div>
        </div>
        <p style={{ fontSize: '.9rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
          Todos los montos en dólares por mes. Vercel y la IA salen de las facturas reales
          consultadas hoy; el resto, del detalle de cada cuenta.
        </p>

        <h2>Las tres conclusiones</h2>

        <div className="note good">
          <span className="tag">Uno</span>
          <p>
            <strong>Lo caro no eran los usuarios: era publicar la app.</strong> En 13 días, todo el
            tráfico de usuarios de MaKo costó <strong>45 centavos</strong>. Lo que costaba $115 por
            mes era la forma en que se facturaba cada publicación de una versión nueva. Ya está
            arreglado y no cambia nada del producto.
          </p>
        </div>

        <div className="note good">
          <span className="tag">Dos</span>
          <p>
            <strong>Los $65 de IA no eran $65 de trabajo.</strong> $34 fueron una sola reunión que
            el sistema releyó 8 veces por un error, y $16 fueron un precio mal anotado. El trabajo
            real del mes fueron <strong>unos $14</strong>. Septiembre proyecta <strong>$20</strong>.
          </p>
        </div>

        <div className="note warn">
          <span className="tag">Tres · lo único que sigue abierto</span>
          <p>
            <strong>El producto tiene un techo de dos clientes por día</strong> en el análisis de
            llamadas. No es un problema de plata: con 10 clientes la factura no sube, pero 8 no
            reciben el servicio y nadie se entera. Es lo que hay que arreglar antes de vender.
          </p>
        </div>

        <h2>Qué se paga, y quién lo paga</h2>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Servicio</th>
                <th className="w">Para qué</th>
                <th className="n">Antes</th>
                <th className="n">Ahora</th>
                <th>Lo paga</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Claude</strong></td>
                <td className="w">La herramienta con la que se construye MaKo</td>
                <td className="n">$200</td>
                <td className="n">$200</td>
                <td><span className="pill fijo">Mauricio</span></td>
              </tr>
              <tr>
                <td><strong>Supabase</strong></td>
                <td className="w">La base de datos de todos los clientes</td>
                <td className="n">$80</td>
                <td className="n">$64</td>
                <td><span className="pill fijo">Mauricio</span></td>
              </tr>
              <tr>
                <td><strong>Railway</strong></td>
                <td className="w">El WhatsApp de MaKo (bandeja y conexión)</td>
                <td className="n">$21</td>
                <td className="n">$21</td>
                <td><span className="pill mal">Leandro</span></td>
              </tr>
              <tr>
                <td><strong>Vercel</strong></td>
                <td className="w">Donde vive la app y se sirve a los clientes</td>
                <td className="n up">$160</td>
                <td className="n down">$20</td>
                <td><span className="pill fijo">Mauricio</span></td>
              </tr>
              <tr>
                <td><strong>IA del producto</strong></td>
                <td className="w">Lo que consume la IA trabajando dentro de MaKo</td>
                <td className="n up">$69</td>
                <td className="n down">$20</td>
                <td><span className="pill fijo">Mauricio</span></td>
              </tr>
              <tr>
                <td><strong>Fathom</strong></td>
                <td className="w">Graba y transcribe las reuniones</td>
                <td className="n">$18</td>
                <td className="n down">$0</td>
                <td><span className="pill ok">Puede ser gratis</span></td>
              </tr>
              <tr>
                <td><strong>Calendly</strong></td>
                <td className="w">La agenda y el aviso de cada reunión nueva</td>
                <td className="n">$12</td>
                <td className="n">$12</td>
                <td><span className="pill fijo">Mauricio</span></td>
              </tr>
              <tr>
                <td><strong>Panda Video</strong></td>
                <td className="w">Aloja el video de ventas</td>
                <td className="n">$9</td>
                <td className="n">$9</td>
                <td><span className="pill fijo">A medias</span></td>
              </tr>
              <tr>
                <td><strong>Resend</strong></td>
                <td className="w">Manda los emails y reportes</td>
                <td className="n">$0</td>
                <td className="n">$0</td>
                <td><span className="pill ok">Gratis</span></td>
              </tr>
              <tr className="total">
                <td>Total</td>
                <td className="w"></td>
                <td className="n">$569</td>
                <td className="n">$367</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bars">
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">Claude · la herramienta de desarrollo</span><span className="bar-val">$200 → $200</span></div>
            <div className="track"><div className="fill was" style={{ width: '100%' }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">Vercel · donde vive la app</span><span className="bar-val">$160 → $20</span></div>
            <div className="track"><div className="fill was" style={{ width: '80%' }} /><div className="fill now" style={{ width: '10%' }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">Supabase · la base de datos</span><span className="bar-val">$80 → $64</span></div>
            <div className="track"><div className="fill was" style={{ width: '40%' }} /><div className="fill now" style={{ width: '32%' }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">IA del producto</span><span className="bar-val">$69 → $20</span></div>
            <div className="track"><div className="fill was" style={{ width: '34.5%' }} /><div className="fill now" style={{ width: '10%' }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">Railway · el WhatsApp</span><span className="bar-val">$21 → $21</span></div>
            <div className="track"><div className="fill was" style={{ width: '10.5%' }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-top"><span className="bar-name">Fathom · reuniones</span><span className="bar-val">$18 → $0</span></div>
            <div className="track"><div className="fill was" style={{ width: '9%' }} /></div>
          </div>
          <p className="legend">
            <span><span className="swatch" style={{ background: 'var(--spend)' }} />Lo que costaba</span>
            <span><span className="swatch" style={{ background: 'var(--save)' }} />Lo que cuesta ahora</span>
            <span>Escala relativa a $200</span>
          </p>
        </div>

        <div className="note">
          <span className="tag">El titular</span>
          <p>
            <strong>El 54% de lo que se paga es el plan de Claude</strong>, que es la herramienta con
            la que se construye el producto, no un costo de operarlo. Todo lo que <em>sostiene</em>{' '}
            MaKo funcionando —la app, la base, el WhatsApp, la IA y las herramientas— cuesta{' '}
            <strong>$167 por mes</strong>.
          </p>
        </div>

        <h2>Qué esperar cada mes</h2>
        <p>Casi todo es fijo. Lo único que se mueve con el uso es la IA.</p>

        <div className="scroll">
          <table>
            <thead>
              <tr><th>Concepto</th><th className="n">Mínimo</th><th className="n">Esperado</th><th className="n">Máximo</th><th className="w">De qué depende</th></tr>
            </thead>
            <tbody>
              <tr><td>Claude</td><td className="n">$200</td><td className="n">$200</td><td className="n">$200</td><td className="w">No se mueve.</td></tr>
              <tr><td>Supabase</td><td className="n">$64</td><td className="n">$64</td><td className="n">$74</td><td className="w">$10 por cada tablero de cliente nuevo.</td></tr>
              <tr><td>Railway</td><td className="n">$18</td><td className="n">$21</td><td className="n">$30</td><td className="w">Volumen de mensajes de WhatsApp.</td></tr>
              <tr><td>Vercel</td><td className="n">$20</td><td className="n">$20</td><td className="n">$25</td><td className="w">Fijo salvo un pico de tráfico grande.</td></tr>
              <tr><td>IA del producto</td><td className="n">$12</td><td className="n">$20</td><td className="n">$35</td><td className="w">Cuántas reuniones y llamadas se analizan.</td></tr>
              <tr><td>Calendly</td><td className="n">$12</td><td className="n">$12</td><td className="n">$12</td><td className="w">No se mueve.</td></tr>
              <tr><td>Panda Video</td><td className="n">$9</td><td className="n">$9</td><td className="n">$18</td><td className="w">La mitad de $17,90. Sube si se pasa de ancho de banda.</td></tr>
              <tr><td>Fathom</td><td className="n">$0</td><td className="n">$0</td><td className="n">$18</td><td className="w">$0 si se pasa al plan gratuito.</td></tr>
              <tr className="total"><td>Total mensual</td><td className="n">$335</td><td className="n">$346</td><td className="n">$412</td><td className="w"></td></tr>
            </tbody>
          </table>
        </div>

        <p>
          Sumale <strong>entre $6 y $30 por cada cliente nuevo, una sola vez</strong>, cuando se le
          conecta Fathom y MaKo le analiza el histórico de llamadas.
        </p>

        <h2>Lo que hay que decidir</h2>

        <div className="scroll">
          <table>
            <thead>
              <tr><th className="w">Decisión</th><th className="n">Impacto</th><th className="w">Recomendación</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="w"><strong>Railway lo paga Leandro</strong></td>
                <td className="n">$21/mes</td>
                <td className="w">Pasarlo a la cuenta de Mauricio. Es infraestructura de MaKo, no de Leandro.</td>
              </tr>
              <tr>
                <td className="w"><strong>Fathom podría ser gratis</strong></td>
                <td className="n down">−$18/mes</td>
                <td className="w">Sí, se puede. Verificado en el código: lo que MaKo necesita es el transcript, que en el plan gratis es ilimitado.</td>
              </tr>
              <tr>
                <td className="w"><strong>Calendly, ¿se puede bajar?</strong></td>
                <td className="n">$0</td>
                <td className="w">No. En el plan gratis no existe la conexión que MaKo usa para enterarse de cada reunión agendada.</td>
              </tr>
              <tr>
                <td className="w"><strong>Los tableros de clientes en Supabase</strong></td>
                <td className="n">$39/mes</td>
                <td className="w">Es costo de servicio, no desperdicio. Vale confirmar que cada cliente lo cubra.</td>
              </tr>
              <tr>
                <td className="w"><strong>⚠️ Hay cuentas de IA sin saldo</strong></td>
                <td className="n">Urgente</td>
                <td className="w">Tres cuentas quedaron sin crédito y su análisis de llamadas viene fallando. No cuesta plata (la llamada se rechaza antes de cobrar), pero esas reuniones no se analizan. Ver el detalle abajo.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ───────── EXPLICACIONES ABAJO, EN DESPLEGABLES ───────── */}

        <h2>La explicación de cada punto</h2>
        <p>Todo lo de arriba, con el detalle de dónde salen los números.</p>

        <details>
          <summary>Vercel: pagábamos por publicar, no por usar <span className="sum-note">$160 → $20</span></summary>
          <div className="body">
            <p>
              Este era el problema grande y no tenía nada que ver con los clientes. El número que lo
              resume: <strong>en 13 días, todo el tráfico de usuarios costó 45 centavos.</strong> Se
              puede multiplicar por diez la cantidad de usuarios y casi no se mueve.
            </p>
            <p>
              Lo caro era publicar versiones nuevas de la app. Y se publica mucho —unas 46 veces por
              día— porque así se trabaja.
            </p>
            <h3>Lo que estaba pasando</h3>
            <p>
              Vercel no cobra por el tiempo que tarda en publicar. Cobra por{' '}
              <em>minuto redondeado hacia arriba × tamaño de la computadora que usa</em>. Nuestras
              publicaciones tardaban <strong>33 segundos</strong> pero se facturaban como{' '}
              <strong>un minuto entero</strong>, multiplicado por la computadora más grande que
              ofrece el proveedor. Cada publicación costaba <strong>30 minutos facturados</strong>.
            </p>
            <div className="scroll">
              <table>
                <thead><tr><th>Día</th><th className="n">Publicaciones</th><th className="n">Minutos facturados</th><th className="n">Costo</th></tr></thead>
                <tbody>
                  <tr><td>10 de agosto</td><td className="n">36</td><td className="n">1.080</td><td className="n">$3,78</td></tr>
                  <tr><td>11 de agosto</td><td className="n">56</td><td className="n">1.680</td><td className="n">$5,88</td></tr>
                  <tr><td>12 de agosto</td><td className="n">50</td><td className="n">1.500</td><td className="n">$5,25</td></tr>
                </tbody>
              </table>
            </div>
            <p>Son exactamente 30 minutos por publicación, los tres días. No es estimación: es la cuenta que hacía Vercel.</p>
            <div className="note warn">
              <span className="tag">Lo que más importa de esto</span>
              <p>
                En julio ya habíamos intentado bajar este costo acelerando la publicación: pasó de 99
                a 27 segundos. <strong>La factura subió igual</strong>, de $15 a $99. Ahora se
                entiende: si se cobra por minuto redondeado, bajar de 99 a 27 segundos casi no
                ahorra. <strong>El diagnóstico de julio era el equivocado</strong> y quedó escrito en
                el código durante un mes.
              </p>
            </div>
            <h3>Qué se hizo</h3>
            <ul>
              <li><strong>Se bajó el tamaño de la computadora de publicación</strong> en los 14 proyectos, de la más grande a la estándar. Con la estándar, publicar <strong>no se factura</strong>. Verificado: la app sigue publicando bien, ahora en 67 segundos en vez de 33.</li>
              <li><strong>Se sacó el segundo asiento.</strong> Vercel cobra $18,50 por mes por cada administrador extra. Martín pasó a un rol que igual publica pero no administra.</li>
            </ul>
          </div>
        </details>

        <details>
          <summary>Supabase: no había nada mal, había proyectos de más <span className="sum-note">$80 → $64</span></summary>
          <div className="body">
            <p>
              Acá la sorpresa fue al revés. Revisamos si la base estaba sobredimensionada y{' '}
              <strong>ya estaba en el tamaño más chico que se puede pagar</strong>, con capacidad de
              sobra: usa el 100% de su memoria como caché, tiene 9 conexiones abiertas de 60
              disponibles y ocupa 374 MB de los 8.000 que incluye el plan.
            </p>
            <p>El detalle de los $80 es otro: <strong>se pagan 5 bases de datos, no una.</strong></p>
            <div className="scroll">
              <table>
                <thead><tr><th>Proyecto</th><th className="w">Qué es</th><th className="n">Actividad (7 días)</th><th className="n">Costo</th></tr></thead>
                <tbody>
                  <tr><td><strong>MaKo</strong></td><td className="w">El producto</td><td className="n">1.134.762</td><td className="n">$9,81</td></tr>
                  <tr><td>esquer</td><td className="w">Tablero de cliente</td><td className="n">30.211</td><td className="n">$9,81</td></tr>
                  <tr><td>baja-teriyaki</td><td className="w">Tablero de cliente</td><td className="n">28.798</td><td className="n">$9,81</td></tr>
                  <tr><td>texx</td><td className="w">Tablero de cliente</td><td className="n">19.902</td><td className="n">$9,81</td></tr>
                  <tr><td>aspro</td><td className="w">Tablero de cliente</td><td className="n">957</td><td className="n">$9,81</td></tr>
                  <tr className="total"><td>Plan Pro + los 5</td><td className="w">Menos $10 de crédito incluido</td><td className="n"></td><td className="n">$64</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Los tableros de clientes cuestan $39 de los $64. <strong>No es desperdicio, es costo de
              servicio</strong> — es lo que sale atender a esos clientes. La pregunta no es técnica
              sino comercial: si cada uno cubre sus $10 por mes.
            </p>
            <p>
              <strong>aspro</strong> mueve mucho menos que los demás (957 consultas por semana contra
              30.000) pero paga lo mismo. Sigue siendo cliente activo, así que se deja como está.
            </p>
          </div>
        </details>

        <details>
          <summary>La IA de MaKo: por qué el número asusta y no debería <span className="sum-note">$69 → $20</span></summary>
          <div className="body">
            <p>
              Cuando MaKo analiza una reunión, prioriza el plan de trabajo o lee una llamada de
              venta, consume inteligencia artificial, y eso se paga por uso. La buena noticia:{' '}
              <strong>la mayoría de esas tareas ya corre en modelos gratuitos</strong> — de 1.925
              tareas del mes, 1.239 (el 64%) costaron cero.
            </p>
            <h3>Los $65 de agosto, desarmados</h3>
            <div className="scroll">
              <table>
                <thead><tr><th className="w">Concepto</th><th className="n">Monto</th><th className="w">Qué es realmente</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="w"><strong>Un error ya corregido</strong></td>
                    <td className="n up">$34,67</td>
                    <td className="w">Una sola reunión que el sistema releyó 8 veces seguidas, una por hora, los días 5 y 6. No fue trabajo: fue el mismo trabajo repetido.</td>
                  </tr>
                  <tr>
                    <td className="w"><strong>Precio mal anotado</strong></td>
                    <td className="n up">$16,00</td>
                    <td className="w">Hasta el 9 de agosto el sistema anotaba a una tarifa 50% más cara que la real. Es un error de registro: esa plata nunca se cobró.</td>
                  </tr>
                  <tr>
                    <td className="w"><strong>Trabajo real</strong></td>
                    <td className="n down">~$14</td>
                    <td className="w">Análisis de llamadas de venta. Es lo único que se paga a propósito.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="note good">
              <span className="tag">La foto real</span>
              <p>
                Del 1 al 8 de agosto el gasto promedió <strong>$7,33 por día</strong>. Del 9 al 13,{' '}
                <strong>$1,27 por día</strong>. No es casualidad: son cuatro cambios en el código que
                hicieron que las dos funciones más pesadas —el análisis de reuniones y el priorizador
                del plan— <strong>dejaran de usar el modelo pago</strong> y pasaran a uno gratuito.
              </p>
            </div>
            <p>
              Con ese ritmo, <strong>septiembre proyecta entre $12 y $35, con centro en $20.</strong>{' '}
              La cuenta ingenua (65 ÷ 13 × 30 = $150) está mal, porque supone que el error y la
              tarifa vieja siguen ahí. No siguen.
            </p>
            <h3>Cuánto cuesta cada cliente</h3>
            <ul>
              <li><strong>Al darlo de alta: entre $25 y $30, una sola vez.</strong> Cuando conecta Fathom, MaKo le analiza todo el histórico de llamadas. Con el filtro que falta implementar, esto baja a $6-8.</li>
              <li><strong>Todos los meses: entre $2 y $8.</strong> Solo las reuniones nuevas.</li>
            </ul>
            <p>Sobre un plan de $47, eso es entre el 4% y el 8%. <strong>El costo de IA no es un problema para el modelo de negocio.</strong></p>
          </div>
        </details>

        <details>
          <summary>Railway: el WhatsApp de MaKo, y lo paga Leandro <span className="sum-note">$21</span></summary>
          <div className="body">
            <p>
              En Railway corren <strong>dos piezas que son infraestructura central de MaKo</strong>,
              no experimentos:
            </p>
            <ul>
              <li><strong>Chatwoot</strong> — la bandeja de entrada donde se ven y responden todas las conversaciones de WhatsApp.</li>
              <li><strong>Evolution API</strong> — la conexión con el número de WhatsApp que no es el oficial de Meta.</li>
            </ul>
            <p>
              Sin eso, MaKo no manda ni recibe un solo mensaje de WhatsApp. <strong>No hay ninguna
              razón para que lo pague Leandro</strong>: es un costo del producto, igual que la base
              de datos.
            </p>
            <div className="note warn">
              <span className="tag">Cómo se pasa</span>
              <p>
                Es una transferencia de proyecto dentro de Railway, con la tarjeta de Mauricio. El
                punto delicado es que <strong>los dos servicios tienen que seguir respondiendo en la
                misma dirección web</strong>, porque MaKo les habla por ahí. Si cambian de dirección,
                el WhatsApp deja de funcionar hasta que se actualice la configuración.
              </p>
            </div>
          </div>
        </details>

        <details>
          <summary>Fathom: sí, puede ser gratis <span className="sum-note">−$18</span></summary>
          <div className="body">
            <p>La respuesta corta es <strong>sí</strong>, y está verificado en el código, no estimado.</p>
            <p>El plan gratuito de Fathom incluye:</p>
            <ul>
              <li><strong>Grabaciones y transcripciones ilimitadas</strong>, y almacenamiento ilimitado.</li>
              <li><strong>Acceso a la API</strong> — que es lo que usa MaKo para traerse las reuniones. No requiere plan pago.</li>
              <li>Pero solo <strong>5 resúmenes automáticos por mes</strong>.</li>
            </ul>
            <h3>Por qué no afecta</h3>
            <p>
              MaKo usa <strong>el transcript</strong>, que es ilimitado. El resumen automático de
              Fathom se usa en un solo lugar —como contexto extra al analizar una llamada de venta— y{' '}
              <strong>el código ya está escrito para funcionar sin él</strong>: si no viene, sigue
              adelante con el texto «(sin resumen de Fathom)» y analiza igual sobre el transcript
              completo.
            </p>
            <p>
              <strong>Qué se pierde:</strong> a partir de la sexta reunión del mes, el análisis de
              llamadas pierde ese resumen como contexto complementario. La fuente principal —la
              transcripción entera— sigue estando.
            </p>
            <div className="note">
              <span className="tag">Recomendación</span>
              <p>
                Bajar a gratuito y mirar un mes. Si el análisis de llamadas se nota más flojo, volver
                a Premium cuesta lo mismo que hoy. El riesgo es reversible y son $18 por mes.
              </p>
            </div>
          </div>
        </details>

        <details>
          <summary>Calendly: este no se puede bajar <span className="sum-note">$12</span></summary>
          <div className="body">
            <p>
              Calendly está en el plan Standard ($10 por mes si se paga anual, $12 mensual), y{' '}
              <strong>no puede bajar al gratuito</strong>.
            </p>
            <p>
              El motivo: MaKo no usa Calendly solo para agendar. Usa la <strong>conexión automática
              que avisa cada vez que alguien agenda o reprograma una reunión</strong> — y esa
              conexión no existe en el plan gratuito, es exclusiva de los planes pagos.
            </p>
            <div className="note warn">
              <span className="tag">Por qué importa más de lo que parece</span>
              <p>
                Ese aviso es lo que dispara toda la cadena de medición del negocio: sin él no se
                registra la reunión agendada, y sin eso no hay cohortes, ni embudo, ni seguimiento de
                ventas. <strong>Bajarlo a gratuito no ahorra $12: rompe la medición.</strong>
              </p>
            </div>
          </div>
        </details>

        <details>
          <summary>Panda Video y Resend <span className="sum-note">$9 y $0</span></summary>
          <div className="body">
            <h3>Panda Video — $17,90, a medias</h3>
            <p>
              Aloja el video de ventas de MaKo. El plan Bronze son $17,90 por mes e incluye 200 GB de
              almacenamiento y 500 GB de transferencia. Quedó acordado pagarlo a medias:{' '}
              <strong>$8,95 cada uno</strong>.
            </p>
            <p>
              A vigilar: si el video empieza a tener mucho tráfico, la transferencia extra se cobra
              aparte ($0,03 por GB). Con 500 GB incluidos hay margen amplio para el volumen actual.
            </p>
            <h3>Resend — gratis</h3>
            <p>
              Manda los emails y los reportes diarios, desde el dominio propio (hola-mako.com), que
              está verificado y funcionando. El plan gratuito cubre 3.000 emails por mes y hoy el
              volumen está muy por debajo. <strong>No hay nada que pagar</strong>, y no hay riesgo a
              la vista salvo que se empiecen a mandar campañas masivas.
            </p>
          </div>
        </details>

        <details>
          <summary>El techo de dos clientes por día <span className="sum-note">Lo que falta</span></summary>
          <div className="body">
            <p>
              Este es el único punto que no es de costos sino de producto, y es el más importante de
              todos.
            </p>
            <p>
              El proceso que analiza las llamadas de venta corre una vez por día y{' '}
              <strong>solo alcanza a atender dos clientes</strong>, siempre los mismos dos. No es una
              decisión: es un límite de tiempo del sistema que nadie puso a propósito.
            </p>
            <div className="note warn">
              <span className="tag">Qué significa en la práctica</span>
              <p>
                Con 10 clientes conectados, <strong>la factura no sube — pero 8 clientes no reciben
                su análisis de llamadas y nadie se entera</strong>. El costo hoy está controlado por
                una falla, no por un diseño. Y arreglarlo <em>sube</em> la factura, porque recién ahí
                se entrega el servicio completo.
              </p>
            </div>
            <div className="note warn">
              <span className="tag">⚠️ Encontrado el 13 de agosto, y está pasando ahora</span>
              <p>
                Revisando el sistema aparecieron <strong>37 análisis de llamadas fallando porque la
                cuenta de inteligencia artificial se quedó sin saldo</strong>, y otros 20 que
                fallaron en su momento porque faltaba cargar la clave. El último es de hoy.
              </p>
              <p>
                <strong>No cuesta plata</strong> —la llamada se rechaza antes de cobrar— pero esas
                reuniones no se analizan y nadie se entera: el sistema las reintenta todos los días
                y vuelven a fallar. Hay que <strong>cargarle saldo a esas cuentas</strong>. El
                arreglo del lado del código ya está: ahora un fallo así no consume el cupo de
                análisis del día y corta después de tres seguidos, en vez de gastar la corrida
                entera reintentando.
              </p>
            </div>
            <p>Junto a esto hay otras dos cosas que hay que resolver antes de sumar clientes:</p>
            <ul>
              <li>
                <strong>Filtrar antes de analizar.</strong> Hoy, de cada 74 llamadas, 57 se mandan
                enteras al modelo más caro para que conteste «esto no era una venta». Filtrarlas
                antes con un modelo gratuito baja el costo de alta de cada cliente de $25-30 a $6-8.
              </li>
              <li>
                <strong>La cuota gratuita es compartida.</strong> Las funciones que hoy corren gratis
                usan una sola cuenta para todos los clientes. Con muchos clientes eso se satura, y el
                efecto no es que suba la factura: es que <em>fallan</em>. La solución es que cada
                cliente aporte su propia clave.
              </li>
            </ul>
          </div>
        </details>

        <footer>
          <p>
            <strong>Sobre estos números.</strong> Los de Vercel salen de su API de facturación (junio
            $15,44 · julio $99,19 · agosto 1-13 $67,30). Los de Supabase, del detalle de la cuenta.
            Los de IA, de las 2.716 tareas que MaKo viene registrando desde junio. Railway es el
            monto del último mes; el resto, del plan contratado en cada servicio.
          </p>
          <p>
            La proyección de IA para septiembre asume que los cambios de código de esta semana no se
            revierten. Documento fechado al 13 de agosto de 2026: es una foto, no un tablero en vivo.
          </p>
        </footer>

      </div>
    </div>
  );
}
