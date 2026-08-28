'use client';

// =============================================================================
// PuentePanel — los cuatro pasos para dejar el navegador listo
// =============================================================================
// La versión anterior era un párrafo y dos botones. El dueño: «no queda para
// nada claro para el usuario lo que tiene que hacer dentro de la app». Tenía
// razón, y el problema era de fondo: todo lo necesario para conectarse —bajar la
// extensión, instalarla, abrir Flow— estaba explicado en un chat conmigo, no en
// el producto. Un botón que dice «Conectar mi navegador» no le sirve a alguien
// que no sabe que existe una extensión.
//
// Ahora son pasos numerados con el molde de la skill `tab-onboarding`: título
// que se entiende solo, la ACCIÓN primero, y el contexto abajo — nadie lee un
// párrafo antes de poder tocar algo.
//
// El estado de cada paso es VIVO, no recordado. Y se DERIVA de hechos, no de
// checkboxes que alguien marcó:
//
//   1+2 ✓ cuando el navegador LLAMÓ (`ultimoVisto`): eso prueba a la vez que la
//         extensión está instalada y que tiene el código. Un solo hecho cierra
//         los dos pasos, y no hay forma de fingirlo.
//     3 ✓ cuando el puente reporta `listo`: hay sesión de Flow abierta.
//     4 ✓ cuando la prueba volvió con el saldo real de la cuenta.
//
// El paso 4 devuelve un DATO de su cuenta (cuántos créditos tiene, en qué plan
// está), no un tilde. Es lo que la skill pide: la recompensa es el dato real.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Section, Button, Alert, Status, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import {
  conectarPuenteAction, probarPuenteAction, estadoPruebaAction,
  type EstadoPruebaOut,
} from './puente-actions';
import {
  EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP,
} from '@/lib/extension-tienda';
import { puedeInstalarExtension, type PuedeInstalar } from '@/lib/navegador';
import { leerSaldo } from '@/lib/flow-protocolo';

const FLOW_URL = 'https://labs.google/fx/tools/flow';

/**
 * ¿Está la extensión instalada en ESTE navegador?
 *
 * Lo dice el atributo que su content script pone en `<html>` al cargar la página.
 * No se usa `externally_connectable` —que sería lo obvio— porque ese mecanismo
 * necesita el ID de la extensión, y el ID CAMBIA cuando se publica en la Chrome
 * Web Store: Google asigna el suyo. Por el DOM funciona igual instalada a mano o
 * desde la tienda.
 */
function useExtensionInstalada(): string | false | null {
  // null = todavía no se sabe. Importa: mostrar «no la tenés» durante un
  // instante a alguien que sí la tiene es peor que no mostrar nada.
  //
  // Devuelve la VERSIÓN y no un booleano, porque el content script ya la escribe
  // en el atributo y tirarla costó caro: al arreglar un bug de la extensión no
  // había forma de saber si el cliente estaba corriendo el arreglo o la versión
  // vieja, así que «sigue igual» era indistinguible de «no lo recargaste». Se
  // diagnosticó a ciegas tres veces.
  const [instalada, setInstalada] = useState<string | false | null>(null);

  useEffect(() => {
    const mirar = () => document.documentElement.getAttribute('data-mako-puente');
    const v = mirar();
    if (v) { setInstalada(v); return; }
    // El content script corre en `document_start`, pero una recarga con la
    // extensión recién instalada puede llegar tarde: se mira un rato antes de
    // afirmar que no está.
    let n = 0;
    const t = window.setInterval(() => {
      const w = mirar();
      if (w) { setInstalada(w); window.clearInterval(t); return; }
      if (++n >= 6) { setInstalada(false); window.clearInterval(t); }
    }, 250);

    // Y se vuelve a mirar cuando la pestaña recupera el foco.
    //
    // Con el zip esto no hacía falta: instalar era un desvío por
    // `chrome://extensions` que terminaba en una recarga. Desde la tienda el
    // camino natural es «clic → pestaña nueva → instalar → volver acá», y al
    // volver la respuesta seguía siendo la de hace un minuto. El content script
    // NO se inyecta hacia atrás en pestañas ya abiertas, así que el atributo
    // tampoco aparece solo: lo único honesto que se puede hacer al detectar el
    // regreso es ofrecer la recarga, no simularla.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      const w = mirar();
      if (w) setInstalada(w);
      else setInstalada((antes) => (antes === false ? false : antes));
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return instalada;
}

/**
 * ¿Este navegador puede instalar la extensión?
 *
 * Es una CORAZONADA, no un hecho: no existe ninguna API que lo conteste (ver
 * lib/navegador.ts). Por eso vale menos que `useExtensionInstalada`, que observa
 * un hecho — y por eso el aviso que cuelga de acá va subordinado a aquél.
 *
 * Va en `useEffect` y no en el render por la misma razón que el otro: el server
 * no tiene `navigator`, así que decidir una rama durante la hidratación produce
 * un mismatch. El primer pintado es el del server, y en el del server esto es
 * `null` y no dibuja nada.
 */
function usePuedeInstalar(): PuedeInstalar | null {
  const [puede, setPuede] = useState<PuedeInstalar | null>(null);
  useEffect(() => { setPuede(puedeInstalarExtension(navigator)); }, []);
  return puede;
}

/**
 * Le pasa el token a la extensión y espera el acuse.
 *
 * Sin el acuse no se puede distinguir «lo guardó» de «no escuchó», y la pantalla
 * terminaría afirmando que conectó sobre algo que no pasó.
 */
function entregarToken(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ok = () => { window.removeEventListener('MAKO_PUENTE_TOKEN_OK', ok); resolve(true); };
    window.addEventListener('MAKO_PUENTE_TOKEN_OK', ok);
    window.dispatchEvent(new CustomEvent('MAKO_PUENTE_TOKEN', { detail: { token } }));
    window.setTimeout(() => {
      window.removeEventListener('MAKO_PUENTE_TOKEN_OK', ok);
      resolve(false);
    }, 3000);
  });
}

function Paso({
  n, titulo, hecho, activo, children, contexto,
}: {
  n: number; titulo: string; hecho: boolean; activo: boolean;
  children?: ReactNode; contexto?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 0',
      borderTop: n === 1 ? 'none' : '1px solid var(--border)',
      opacity: hecho || activo ? 1 : 0.55,
    }}>
      <span style={{
        flex: 'none', width: 24, height: 24, borderRadius: 999, display: 'grid',
        placeItems: 'center', fontSize: 12, fontWeight: 700,
        background: hecho ? 'var(--good-bg)' : activo ? 'var(--primary-bg)' : 'var(--surface-2)',
        color: hecho ? 'var(--good)' : activo ? 'var(--primary)' : 'var(--faint)',
        border: hecho || activo ? 'none' : '1px solid var(--border-strong)',
      }}>
        {hecho ? <Icon name="check" size={13} /> : n}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{titulo}</div>
        {/* La acción primero. El contexto va abajo de todo: nadie lee un párrafo
            antes de poder tocar algo. */}
        {children && <div style={{ marginTop: 9 }}>{children}</div>}
        {contexto && (
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '11px 13px', marginTop: 10, textAlign: 'left',
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '.08em',
              textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6,
            }}>
              Cómo se hace
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>{contexto}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PuentePanel({ inicial }: { inicial: EstadoPruebaOut['puente'] }) {
  const [puente, setPuente] = useState(inicial);
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const instalada = useExtensionInstalada();
  const puedeInstalar = usePuedeInstalar();
  const [trabajoId, setTrabajoId] = useState<number | null>(null);
  const [prueba, setPrueba] = useState<EstadoPruebaOut['prueba']>(null);
  const [busyCodigo, setBusyCodigo] = useState(false);
  const [busyPrueba, setBusyPrueba] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ciclos, setCiclos] = useState(0);
  const timer = useRef<number | null>(null);

  // El poll tiene TECHO. Sin esto, alguien que genera el código y no instala la
  // extensión deja una pestaña pegándole al server cada 3 s para siempre —
  // esperar algo que depende de una acción humana no es esperar, es un loop.
  // Al llegar al tope se para y aparece un botón para volver a mirar.
  const TOPE_CICLOS = 40; // 2 minutos

  // Hechos, no checkboxes.
  const llamo = !!puente.ultimoVisto;
  const conSesion = puente.estado === 'listo';
  const probado = prueba?.estado === 'listo';
  const listo = llamo && conSesion && probado;

  const conectar = useCallback(async () => {
    setBusyCodigo(true); setError(null);
    try {
      const out = await conectarPuenteAction('Mi navegador');
      if (!out.ok) { setError(out.error); return; }
      // Con la extensión presente, el token se le entrega solo. El código en
      // pantalla queda como salida de emergencia: si el apretón de manos falla
      // —una versión vieja de la extensión, un content script que no cargó—,
      // todavía se puede pegar a mano en vez de quedar sin camino.
      if (instalada && (await entregarToken(out.token))) {
        setCiclos(0);
        return;
      }
      setToken(out.token);
    } finally { setBusyCodigo(false); }
  }, [instalada]);

  const copiar = useCallback(() => {
    if (!token) return;
    navigator.clipboard.writeText(token).then(
      () => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1800); },
      () => { /* sin portapapeles: el código está en pantalla para seleccionarlo */ },
    );
  }, [token]);

  const probar = useCallback(async () => {
    setBusyPrueba(true); setError(null); setPrueba(null);
    try {
      const out = await probarPuenteAction();
      if (!out.ok) { setError(out.error); return; }
      setTrabajoId(out.trabajoId);
    } finally { setBusyPrueba(false); }
  }, []);

  // ⚠️ El poll SOLO corre mientras hay algo concreto que esperar, y la condición
  // se evalúa ANTES del primer tick — no después.
  //
  // La primera versión polleaba siempre: sin token generado no hay nada que
  // pueda cambiar solo, y aun así pegaba cada 3 s por cada pestaña abierta. Se
  // vio en el log del server (`estadoPruebaAction(null)` en loop), no en la
  // pantalla, que es como se ven estos: no rompen nada, solo consumen.
  const esperandoPrueba = trabajoId != null && prueba?.estado !== 'listo' && prueba?.estado !== 'fallido';
  const esperandoNavegador = puente.emparejado && puente.estado !== 'listo';
  const hayQueEsperar = esperandoPrueba || esperandoNavegador;

  const agotado = ciclos >= TOPE_CICLOS;

  useEffect(() => {
    if (!hayQueEsperar || agotado) return;
    let vivo = true;
    const tick = async () => {
      const out = await estadoPruebaAction(trabajoId);
      if (!vivo) return;
      setPuente(out.puente);
      setPrueba(out.prueba);
      setCiclos((c) => c + 1);
      timer.current = window.setTimeout(tick, 3000);
    };
    timer.current = window.setTimeout(tick, 3000);
    return () => {
      vivo = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [hayQueEsperar, agotado, trabajoId]);

  const volverAMirar = useCallback(() => { setCiclos(0); }, []);

  // Con todo listo, esto deja de ser un instructivo y pasa a ser una línea.
  if (listo) {
    // El SALDO es el dato, y esta vista se lo estaba comiendo: decía «listo para
    // generar» sobre una prueba que había vuelto con el número de créditos de la
    // cuenta adentro. Un tilde verde no es una recompensa; el saldo real sí, y es
    // además la única forma de saber cuánto se puede producir antes de empezar.
    const saldo = leerSaldo(prueba?.resultado);
    return (
      <Section titulo="Tu navegador">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Status tono="good">Listo para generar</Status>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            {saldo.creditos != null
              ? <>Tu cuenta de Google Flow tiene <strong>{saldo.etiqueta}</strong>.</>
              : 'Los videos se generan en tu navegador, con tu cuenta de Google Flow.'}
          </span>
          <Button size="sm" variant="tertiary" onClick={() => void probar()} loading={busyPrueba}>
            Volver a probar
          </Button>
        </div>
      </Section>
    );
  }

  return (
    <Section titulo="Prepara tu navegador">
      {error && <Alert tono="bad">{error}</Alert>}

      {agotado && hayQueEsperar && (
        <Alert tono="warn">
          Dejé de revisar para no consumir de más. Cuando termines los pasos de abajo,
          vuelve a mirar.
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="secondary" onClick={volverAMirar}>Volver a revisar</Button>
          </div>
        </Alert>
      )}

      {puente.estado === 'marcada' && (
        <Alert tono="bad">
          Google marcó esta sesión como automatizada y dejó de aceptar generaciones. Espera un
          rato, borra las cookies de google.com y labs.google, y vuelve a entrar a Flow.
          Reintentar sin hacer eso solo empeora la marca.
        </Alert>
      )}

      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.65, marginBottom: 6 }}>
        Tus videos se generan en <strong>tu</strong> computadora, con <strong>tu</strong> cuenta
        de Google Flow y tus créditos. MaKo escribe el guion y arma cada toma; tu navegador la
        produce. Se configura una vez.
      </div>

      {/*
        El HECHO le gana a la corazonada, y por eso el orden de esta condición no
        es decorativo: si la extensión contestó que está instalada, este navegador
        la pudo instalar — no importa lo que infiera el sniff. Solo queda la
        ventana en que ya sabemos que NO está y además sabemos que no puede estar.

        Y se pinta únicamente con la certeza `'no'`: ni con `'no-se-sabe'`, ni con
        `null`. Decirle «tu navegador no sirve» a un Chrome de verdad —pasa en
        `http://` por IP de LAN, donde `userAgentData` no existe— le niega la
        función a quien la tiene y no tiene vuelta atrás dentro de la pantalla. No
        avisarle a un Safari le cuesta medio minuto, y es lo que ya pasa hoy.
      */}
      {instalada === false && puedeInstalar === 'no' && (
        <div style={{ marginBottom: 12 }}>
          <Alert tono="warn">
            <strong>Este navegador no puede instalar la extensión.</strong> Abre MaKo en
            Chrome, Edge, Brave u Opera y completa ahí estos cuatro pasos. Después puedes
            seguir usando MaKo en este navegador: la extensión trabaja desde donde la
            instalaste, no desde donde escribes.
          </Alert>
        </div>
      )}

      <Paso
        n={1}
        titulo="Instala la extensión de MaKo"
        hecho={!!instalada}
        activo={!instalada}
        contexto={
          EXTENSION_EN_TIENDA ? (
            <>
              Se instala desde la tienda de Chrome con un clic. Funciona en Chrome, Edge,
              Brave y Opera.
            </>
          ) : (
            <>
              Descarga el archivo y descomprímelo en una carpeta. Después abre{' '}
              <code style={{ fontFamily: MONO, fontSize: 12 }}>chrome://extensions</code>, activa
              el <strong>Modo de desarrollador</strong> arriba a la derecha, y usa{' '}
              <strong>Cargar descomprimida</strong> apuntando a esa carpeta.
              <div style={{ marginTop: 6 }}>
                Funciona en Chrome, Edge, Brave y Opera.
              </div>
            </>
          )
        }
      >
        {instalada ? (
          <Status tono="good">
            Ya está instalada en este navegador{typeof instalada === 'string' ? ` (v${instalada})` : ''}
          </Status>
        ) : EXTENSION_EN_TIENDA ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => window.open(EXTENSION_URL_TIENDA, '_blank', 'noopener')}
              icon={<Icon name="descargar" size={14} />}
            >
              Añadir a Chrome
            </Button>
            {/*
              La instalación pasa en OTRA pestaña, y al volver acá el content
              script no está: Chrome no lo inyecta hacia atrás en una página que
              ya estaba abierta. Sin este botón el paso queda trabado diciendo que
              no está instalada sobre algo que sí lo está — y el usuario no tiene
              cómo saber que lo único que falta es un F5.
            */}
            {instalada === false && (
              <Button variant="tertiary" size="sm" onClick={() => window.location.reload()}>
                Ya la instalé
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => { window.location.href = EXTENSION_URL_ZIP; }}
            icon={<Icon name="descargar" size={14} />}
          >
            Descargar la extensión
          </Button>
        )}
      </Paso>

      <Paso
        n={2}
        titulo="Conecta la extensión con tu cuenta"
        hecho={llamo}
        activo={!!instalada && !llamo}
        contexto="Un clic y listo: MaKo le pasa la llave a la extensión sin que tengas que copiar nada. Si algo falla, aparece el código para pegarlo a mano."
      >
        {token ? (
          // Salida de emergencia: el apretón de manos no funcionó (extensión
          // vieja, content script que no cargó). Se puede pegar a mano.
          <>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginBottom: 8 }}>
              No pude pasárselo solo. Copia este código y pégalo en la extensión, haciendo
              clic en su ícono.
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 12.5, padding: 10, wordBreak: 'break-all',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
            }}>{token}</div>
            <div style={{ marginTop: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={copiar}
                icon={<Icon name={copiado ? 'check' : 'copy'} size={13} />}
              >
                {copiado ? 'Copiado' : 'Copiar el código'}
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void conectar()}
            loading={busyCodigo}
            disabled={instalada === false}
          >
            {llamo ? 'Volver a conectar' : 'Conectar'}
          </Button>
        )}
      </Paso>

      <Paso
        n={3}
        titulo="Abre Google Flow e inicia sesión"
        hecho={conSesion}
        activo={llamo && !conSesion}
        contexto="Deja esa pestaña abierta mientras generas videos: de ahí sale el permiso para usar tu cuenta. Si la cierras, MaKo espera y retoma cuando la vuelvas a abrir. Necesitas una suscripción de Google que incluya Flow."
      >
        <Button
          variant="secondary"
          onClick={() => window.open(FLOW_URL, '_blank', 'noopener')}
          icon={<Icon name="web" size={14} />}
        >
          Abrir Google Flow
        </Button>
      </Paso>

      <Paso
        n={4}
        titulo="Comprueba que todo funciona"
        hecho={probado}
        activo={conSesion && !probado}
        contexto="Esta prueba no genera ningún video ni gasta créditos: solo le pregunta a Google cuántos te quedan. Si responde, ya puedes crear anuncios."
      >
        <Button
          variant="mako"
          onClick={() => void probar()}
          loading={busyPrueba}
          disabled={!puente.emparejado}
        >
          Comprobar
        </Button>

        {prueba && (
          <div style={{ marginTop: 10 }}>
            {prueba.estado === 'listo' ? (
              <Alert tono="good">
                <strong>Todo funciona.</strong> Tu navegador le preguntó a Google:{' '}
                tu cuenta tiene <strong>{leerSaldo(prueba.resultado).etiqueta}</strong>.
                {/* El JSON crudo queda a mano pero no de entrada: el dato es el
                    saldo, no la estructura de la respuesta. */}
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>
                    Ver la respuesta completa
                  </summary>
                  <div style={{
                    fontFamily: MONO, fontSize: 'var(--fs-meta)', marginTop: 8, padding: 10,
                    background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>{JSON.stringify(prueba.resultado, null, 2)}</div>
                </details>
              </Alert>
            ) : prueba.estado === 'fallido' ? (
              <Alert tono="bad">
                <strong>No funcionó.</strong> {prueba.error || 'sin detalle'}
              </Alert>
            ) : (
              <Alert tono="info">
                {/*
                  Este texto NO puede enumerar posibles causas. La versión anterior
                  mandaba a revisar tres cosas —extensión instalada, código pegado,
                  pestaña de Flow abierta— y en el caso real que lo puso a prueba las
                  tres estaban bien: la falla era otra, y el mensaje mandó a buscar
                  donde no era. Cuando el trabajo falla de verdad, el motivo llega
                  clasificado y se muestra arriba, en la rama `fallido`.
                */}
                Esperando a tu navegador. Deja abierta la pestaña de Google Flow; la respuesta
                aparece acá en unos segundos.
              </Alert>
            )}
          </div>
        )}
      </Paso>
    </Section>
  );
}
