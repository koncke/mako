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
function useExtensionInstalada(): boolean | null {
  // null = todavía no se sabe. Importa: mostrar «no la tenés» durante un
  // instante a alguien que sí la tiene es peor que no mostrar nada.
  const [instalada, setInstalada] = useState<boolean | null>(null);

  useEffect(() => {
    const mirar = () => document.documentElement.hasAttribute('data-mako-puente');
    if (mirar()) { setInstalada(true); return; }
    // El content script corre en `document_start`, pero una recarga con la
    // extensión recién instalada puede llegar tarde: se mira un rato antes de
    // afirmar que no está.
    let n = 0;
    const t = window.setInterval(() => {
      if (mirar()) { setInstalada(true); window.clearInterval(t); return; }
      if (++n >= 6) { setInstalada(false); window.clearInterval(t); }
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  return instalada;
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
    return (
      <Section titulo="Tu navegador">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Status tono="good">Listo para generar</Status>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            Los videos se generan en tu navegador, con tu cuenta de Google Flow.
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

      <Paso
        n={1}
        titulo="Instala la extensión de MaKo"
        hecho={instalada === true}
        activo={instalada !== true}
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
        {instalada === true ? (
          <Status tono="good">Ya está instalada en este navegador</Status>
        ) : EXTENSION_EN_TIENDA ? (
          <Button
            variant="secondary"
            onClick={() => window.open(EXTENSION_URL_TIENDA, '_blank', 'noopener')}
            icon={<Icon name="descargar" size={14} />}
          >
            Añadir a Chrome
          </Button>
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
        activo={instalada === true && !llamo}
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
                <strong>Todo funciona.</strong> Tu navegador le preguntó a Google y respondió:
                <div style={{
                  fontFamily: MONO, fontSize: 'var(--fs-xs)', marginTop: 8, padding: 10,
                  background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>{JSON.stringify(prueba.resultado, null, 2)}</div>
              </Alert>
            ) : prueba.estado === 'fallido' ? (
              <Alert tono="bad">
                <strong>No funcionó.</strong> {prueba.error || 'sin detalle'}
              </Alert>
            ) : (
              <Alert tono="info">
                Esperando a tu navegador. Revisa que la extensión esté instalada, que tenga el
                código pegado, y que la pestaña de Google Flow esté abierta.
              </Alert>
            )}
          </div>
        )}
      </Paso>
    </Section>
  );
}
