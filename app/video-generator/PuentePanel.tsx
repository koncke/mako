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
import { Button, Alert, Status, MONO } from '@/app/_ui';
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
import { EXTENSION_VERSION } from '@/lib/extension-version';
// ⚠️ `esMasVieja`, el hook y el aviso VIVÍAN ACÁ, y por eso el wizard no los
// tenía. Se mudaron enteros: el aviso hacía falta en dos pantallas y la copia
// habría sido la tercera de una función que ya está duplicada en la extensión.
import {
  esMasVieja, useExtensionInstalada, AvisoExtensionVieja,
} from './extension-instalada';
import { rehabilitarPuenteAction } from './puente-actions';

const FLOW_URL = 'https://labs.google/fx/tools/flow';


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
 * Cuánto vale la última señal del puente antes de dejar de creerle.
 *
 * La extensión llama cada 15 s (`chrome.alarms` con `periodInMinutes: 0.25`), así
 * que dos minutos son ocho ciclos: si en todo eso no llamó, no está.
 */
const VIVO_MS = 2 * 60 * 1000;

/**
 * Un reloj que avanza, para que «hace cuánto» se pueda evaluar sin recargar.
 *
 * Sin esto, `Date.now()` queda congelado en el momento del render: una pantalla
 * abierta dice «conectado» para siempre, porque la comparación que lo desmiente
 * nunca se vuelve a hacer.
 *
 * Arranca en `null` y NO en `Date.now()`: el server no tiene el mismo reloj que el
 * navegador, y una rama decidida en el primer render con dos relojes distintos es
 * un mismatch de hidratación. Mientras es `null` no se afirma nada.
 */
function useAhora(cadaMs = 15000): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(t);
  }, [cadaMs]);
  return ahora;
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

/**
 * Un paso: el número, el título, la acción, y UNA línea de ayuda debajo.
 *
 * ⚠️ La ayuda ERA una caja gris con cejilla «CÓMO SE HACE» y tres renglones de
 * prosa. Cuatro de esas cajas son lo que convertía a esto en una pared —el dueño:
 * «elimina todo esto… todo minimalista»—. La regla de la skill que las pedía
 * sigue en pie y no es la caja: es que la ACCIÓN va primero y el contexto abajo.
 * Eso se cumple igual con una línea tenue, y se lee.
 */
function Paso({
  n, titulo, hecho, activo, children, ayuda,
}: {
  n: number; titulo: string; hecho: boolean; activo: boolean;
  children?: ReactNode; ayuda?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '13px 0',
      borderTop: n === 1 ? 'none' : '1px solid var(--border)',
      opacity: hecho || activo ? 1 : 0.5,
    }}>
      <span style={{
        flex: 'none', width: 22, height: 22, borderRadius: 999, display: 'grid',
        placeItems: 'center', fontSize: 11.5, fontWeight: 700,
        background: hecho ? 'var(--good-bg)' : activo ? 'var(--primary-bg)' : 'var(--surface-2)',
        color: hecho ? 'var(--good)' : activo ? 'var(--primary)' : 'var(--faint)',
        border: hecho || activo ? 'none' : '1px solid var(--border-strong)',
      }}>
        {hecho ? <Icon name="check" size={12} /> : n}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{titulo}</div>
        {children && <div style={{ marginTop: 8 }}>{children}</div>}
        {ayuda && (
          <div style={{
            fontSize: 'var(--fs-sm)', color: 'var(--faint)',
            lineHeight: 1.55, marginTop: 7,
          }}>{ayuda}</div>
        )}
      </div>
    </div>
  );
}

/**
 * QUÉ LE PASA AL NAVEGADOR, en una frase. UN solo juicio.
 *
 * ⚠️ Lo miran DOS pantallas —la fila plegada y el aviso del catálogo— y por eso
 * está acá y no adentro del render. Medido antes de unificarlo: el aviso decía
 * «tu navegador no está conectado» mientras la fila, tres bloques más abajo,
 * decía «falta abrir Google Flow». Las dos hablaban del mismo hecho, la segunda
 * tenía razón, y la primera mandaba a reinstalar una extensión que ya estaba.
 *
 * Es la regla del repo sobre dos números que se comparan en pantalla, aplicada a
 * dos frases: si se leen juntas, salen del mismo juicio o se contradicen.
 */
export function estadoDelPuente(
  p: EstadoPruebaOut['puente'] | null,
  ahora: number | null,
): { tono: 'good' | 'warn' | 'bad'; txt: string; anda: boolean; vivo: boolean } {
  if (!p) return { tono: 'warn', txt: 'Sin conectar', anda: false, vivo: false };
  const desde = ahora != null && p.ultimoVisto ? ahora - new Date(p.ultimoVisto).getTime() : null;
  // Mientras no se sabe (primer render, sin reloj todavía) se conserva lo que el
  // server trajo: parpadear a «desconectado» un instante es peor que esperar.
  const vivo = desde == null ? !!p.ultimoVisto : desde < VIVO_MS;

  if (p.estado === 'marcada') return { tono: 'bad', txt: 'Google marcó esta sesión', anda: false, vivo };
  if (!vivo) return { tono: 'warn', txt: 'Sin conectar', anda: false, vivo };
  if (p.estado !== 'listo') return { tono: 'warn', txt: 'Falta abrir Google Flow', anda: false, vivo };
  return { tono: 'good', txt: 'Listo', anda: true, vivo };
}

/** El `id` del desplegable. `AvisoPuente` lo abre por acá. */
export const ID_PUENTE = 'mk-puente';

/**
 * Abre la configuración del navegador y la trae a la vista.
 *
 * Vive suelta —y no como prop— porque la llaman dos pantallas que no son padres
 * de ésta: el catálogo y el estudio. Pasarles un callback obligaría a subir el
 * estado del `<details>` hasta el ancestro común, que es toda la tab.
 */
export function abrirPuente() {
  const el = document.getElementById(ID_PUENTE) as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function PuentePanel({ inicial, saldo, onEstado }: {
  inicial: EstadoPruebaOut['puente'];
  /** El saldo GUARDADO, para que la línea diga algo antes de comprobar nada. */
  saldo?: { creditos: number | null } | null;
  /**
   * Le cuenta hacia arriba cada estado nuevo.
   *
   * Este panel es el ÚNICO que re-pregunta por el puente, así que lo que averigua
   * no puede quedarse acá adentro: quien decide si se puede empezar un anuncio
   * vive afuera, y sin esto seguía mirando el snapshot de la carga.
   */
  onEstado?: (p: EstadoPruebaOut['puente']) => void;
}) {
  const [puente, setPuente] = useState(inicial);
  const instalada = useExtensionInstalada();
  const puedeInstalar = usePuedeInstalar();
  const ahora = useAhora();
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

  // Hechos, no checkboxes — y hechos CON FECHA.
  //
  // ⚠️ La frescura se calculaba ACÁ, con su propio plazo y su propia comparación
  // de fecha, y otra vez en el juicio compartido. Dos copias de la misma regla:
  // el día que el plazo cambie en una, la fila y los tilditos de al lado
  // contestan cosas distintas sobre el mismo navegador.
  //
  // El plazo existe porque `!!puente.ultimoVisto` medía «alguna vez llamó»: el
  // dueño desinstaló la extensión y los pasos 2 y 3 siguieron en verde con una
  // última señal de 35 horas antes. Un campo con fecha usado como booleano deja
  // de medir el presente y pasa a medir el pasado.
  const juicio = estadoDelPuente(puente, ahora);

  const llamo = juicio.vivo;
  const conSesion = juicio.vivo && puente.estado === 'listo';
  const probado = prueba?.estado === 'listo';

  // ── Volver a preguntar mientras alguien está mirando ──────────────────────
  // El reloj de `useAhora` hace que la señal vieja se apague, pero `ultimoVisto`
  // llega en un snapshot del server: sin refrescarlo, a los dos minutos TODO se
  // apagaría aunque el puente esté llamando cada 15 s. Las dos piezas van juntas
  // o la frescura se convierte en un temporizador que miente al revés.
  //
  // Tres límites, y los tres salen de un poll que ya se fue de las manos una vez
  // en este mismo archivo:
  //   · Solo con la pestaña VISIBLE. Nadie necesita esto de fondo.
  //   · Cada 15 s, el mismo pulso que la extensión. Más rápido no informa más.
  //   · Se corta al ocultarse, y se pregunta una vez al volver — que es cuando la
  //     respuesta de verdad cambió.
  useEffect(() => {
    let vivo = true;
    let t: number | undefined;

    const preguntar = async () => {
      if (!vivo || document.visibilityState !== 'visible') return;
      try {
        const out = await estadoPruebaAction(null);
        if (vivo && out?.puente) setPuente(out.puente);
      } catch { /* la próxima vuelta reintenta */ }
    };

    const arrancar = () => {
      window.clearInterval(t);
      if (document.visibilityState !== 'visible') return;
      void preguntar();
      t = window.setInterval(() => void preguntar(), 15000);
    };

    arrancar();
    document.addEventListener('visibilitychange', arrancar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', arrancar);
    };
  }, []);

  const conectar = useCallback(async () => {
    setBusyCodigo(true); setError(null);
    try {
      const out = await conectarPuenteAction('Mi navegador');
      if (!out.ok) { setError(out.error); return; }
      // ⚠️ YA NO HAY PEGADO A MANO. El popup de la extensión perdió su campo
      // —el dueño: «elimina todo esto»— así que mostrar un código para pegar
      // apuntaría a una pantalla que ya no existe.
      //
      // Y el arreglo real de los dos casos en que el apretón falla —extensión
      // recién instalada sin recargar, extensión vieja— nunca fue pegar el
      // código: es recargar o actualizar, y las dos cosas ya tienen su botón.
      if (await entregarToken(out.token)) { setCiclos(0); return; }
      setError('No pude conectarla. Recarga la página y vuelve a intentar.');
    } finally { setBusyCodigo(false); }
  }, [instalada]);

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

  // Un solo punto de salida, y colgado del ESTADO y no de cada `setPuente`.
  // Hay tres lugares que lo escriben (el poll de 15 s, el tick de la prueba, el
  // snapshot inicial) y avisar en cada uno es garantizar que el cuarto se olvide.
  useEffect(() => { onEstado?.(puente); }, [puente, onEstado]);

  const [rehabilitando, setRehabilitando] = useState(false);

  /** «Ya hice lo que decía el aviso»: la salida explícita del estado de contención. */
  const rehabilitar = useCallback(async () => {
    setRehabilitando(true);
    try {
      const out = await rehabilitarPuenteAction();
      if (out.ok) window.location.reload();
    } finally {
      setRehabilitando(false);
    }
  }, []);

  const volverAMirar = useCallback(() => { setCiclos(0); }, []);

  // ── EL ESTADO, EN UNA LÍNEA ───────────────────────────────────────────────
  // Es lo único que se ve sin abrir, y es lo que decide si vale la pena abrir.
  // El saldo VIVO —el que acaba de traer la prueba— le gana al guardado, que es
  // el que la página trajo del server y puede tener horas.
  const saldoVivo = leerSaldo(prueba?.resultado);
  const creditos = saldoVivo.creditos != null
    ? saldoVivo.etiqueta
    : saldo?.creditos != null
      ? `${saldo.creditos.toLocaleString('es-MX')} créditos`
      : null;

  // El saldo es lo ÚNICO que esta pantalla le agrega al juicio compartido: la
  // recompensa del paso 4 es el número real, no un tilde.
  const estado = juicio.anda && creditos ? { ...juicio, txt: `Listo · ${creditos}` } : juicio;

  return (
    // ⚠️ DESPLEGABLE Y CERRADO. El dueño: «elimina todo esto, debería vivir
    // dentro del desplegable de la página… todo minimalista».
    //
    // Se abre solo la primera vez —cuando el navegador NUNCA llamó—, que es la
    // única en que alguien viene a esta tab a configurar algo. Después es una
    // fila: quien entra a hacer un anuncio no tiene por qué volver a leer cómo se
    // instala una extensión que ya instaló. Lo que avisa si se cayó no es esto
    // sino `AvisoPuente`, que aparece en el camino.
    //
    // El `id` es cómo lo abre ese aviso. Con `<details>` nativo eso es tocar el
    // DOM, y es a propósito: subir el abierto/cerrado a un estado de React para
    // algo que pasa una vez cada tanto costaría el prop en tres pantallas.
    //
    // ⚠️ `open` SALE DE `inicial`, el dato del server, y NO del estado vivo.
    // Con el estado vivo esto era `open={!llamo}` y fallaba de dos formas a la
    // vez: mismatch de hidratación —el server pinta con el snapshot y el cliente
    // re-pregunta a los milisegundos—, y sobre todo, como el valor CAMBIABA
    // entre renders, React volvía a escribir el atributo cada 15 segundos: el
    // panel que la persona acababa de abrir se cerraba solo al primer poll.
    //
    // Colgado de un valor que nunca cambia, React no lo vuelve a tocar nunca y
    // el abierto/cerrado queda donde tiene que estar: en manos de quien mira.
    <details id={ID_PUENTE} className="mk-plegable" open={!inicial.ultimoVisto}>
      <summary className="mk-plegable__resumen">
        <span className="mk-plegable__chev"><Icon name="chevron" size={15} /></span>
        Tu navegador
        <span className="mk-plegable__estado">
          <span className="mk-plegable__punto" data-tono={estado.tono} />
          {estado.txt}
        </span>
      </summary>

      <div style={{ paddingBottom: 10, maxWidth: 620 }}>
        {error && <Alert tono="bad">{error}</Alert>}

        {agotado && hayQueEsperar && (
          <Alert tono="warn">
            Dejé de revisar para no consumir de más.
            <div style={{ marginTop: 8 }}>
              <Button size="sm" variant="secondary" onClick={volverAMirar}>Volver a revisar</Button>
            </div>
          </Alert>
        )}

        {/*
          La sesión marcada es un estado de CONTENCIÓN: no se levanta solo, a
          propósito. El botón es la salida explícita — sin él la tab quedaba
          muerta aunque el problema estuviera resuelto.
        */}
        {puente.estado === 'marcada' && (
          <Alert tono="bad">
            Google marcó esta sesión como automatizada y dejó de aceptar generaciones. Espera un
            rato, borra las cookies de google.com y labs.google, y vuelve a entrar a Flow.
            Reintentar sin hacer eso solo empeora la marca.
            <div style={{ marginTop: 9 }}>
              <Button size="sm" variant="secondary" onClick={rehabilitar} loading={rehabilitando}>
                Ya lo hice, volver a habilitar
              </Button>
            </div>
          </Alert>
        )}

        <AvisoExtensionVieja instalada={instalada} />

        {/*
          El HECHO le gana a la corazonada: si la extensión contestó que está
          instalada, este navegador la pudo instalar. Y se pinta sólo con la
          certeza `'no'` — decirle «tu navegador no sirve» a un Chrome de verdad
          (pasa en `http://` por IP de LAN) le niega la función a quien la tiene.
        */}
        {instalada === false && puedeInstalar === 'no' && (
          <div style={{ marginBottom: 12 }}>
            <Alert tono="warn">
              <strong>Este navegador no puede instalar la extensión.</strong> Abre MaKo en
              Chrome, Edge, Brave u Opera y conéctalo ahí. Después puedes seguir usando MaKo
              en este navegador: la extensión trabaja desde donde la instalaste.
            </Alert>
          </div>
        )}

        <Paso
          n={1}
          titulo="Instala la extensión"
          hecho={!!instalada}
          activo={!instalada}
          ayuda={EXTENSION_EN_TIENDA
            ? 'Chrome, Edge, Brave y Opera.'
            : <>Descomprímela en una carpeta, abre <code style={{ fontFamily: MONO, fontSize: 12 }}>chrome://extensions</code>, activa el <strong>Modo de desarrollador</strong> y usa <strong>Cargar descomprimida</strong>.</>}
        >
          {instalada ? (
            <Status tono="good">
              Instalada{typeof instalada === 'string' ? ` · v${instalada}` : ''}
            </Status>
          ) : EXTENSION_EN_TIENDA ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(EXTENSION_URL_TIENDA, '_blank', 'noopener')}
                icon={<Icon name="descargar" size={14} />}
              >
                Añadir a Chrome
              </Button>
              {/*
                La instalación pasa en OTRA pestaña, y al volver acá el content
                script no está: Chrome no lo inyecta hacia atrás. Sin este botón
                el paso queda trabado sobre algo que sí está instalado.
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
              size="sm"
              onClick={() => { window.location.href = EXTENSION_URL_ZIP; }}
              icon={<Icon name="descargar" size={14} />}
            >
              Descargar
            </Button>
          )}
        </Paso>

        <Paso
          n={2}
          titulo="Conéctala con tu cuenta"
          hecho={llamo}
          activo={!!instalada && !llamo}
          ayuda="Un clic: MaKo le pasa la llave sola."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void conectar()}
            loading={busyCodigo}
            disabled={instalada === false}
          >
            {llamo ? 'Volver a conectar' : 'Conectar'}
          </Button>
        </Paso>

        <Paso
          n={3}
          titulo="Abre Google Flow"
          hecho={conSesion}
          activo={llamo && !conSesion}
          ayuda="Deja esa pestaña abierta mientras generas: de ahí sale el permiso para usar tu cuenta. Necesitas una suscripción de Google que incluya Flow."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(FLOW_URL, '_blank', 'noopener')}
            icon={<Icon name="web" size={14} />}
          >
            Abrir Google Flow
          </Button>
        </Paso>

        <Paso
          n={4}
          titulo="Comprueba tus créditos"
          hecho={probado}
          activo={conSesion && !probado}
          ayuda="No genera ningún video ni gasta créditos: solo le pregunta a Google cuántos te quedan."
        >
          <Button
            variant="secondary"
            size="sm"
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
                  Tu cuenta tiene <strong>{leerSaldo(prueba.resultado).etiqueta}</strong>.
                </Alert>
              ) : prueba.estado === 'fallido' ? (
                <Alert tono="bad">
                  <strong>No funcionó.</strong> {prueba.error || 'sin detalle'}
                </Alert>
              ) : (
                <Alert tono="info">
                  {/*
                    Este texto NO puede enumerar posibles causas. La versión
                    anterior mandaba a revisar tres cosas y en el caso real que lo
                    puso a prueba las tres estaban bien: el motivo real llega
                    clasificado y se muestra arriba, en la rama `fallido`.
                  */}
                  Esperando a tu navegador. Deja abierta la pestaña de Google Flow.
                </Alert>
              )}
            </div>
          )}
        </Paso>
      </div>
    </details>
  );
}

/**
 * EL AVISO, para el resto de MaKo.
 *
 * El dueño: «dentro de MaKo simplemente mostrar un aviso cuando esté
 * desconectado. Y claro que no te deje avanzar».
 *
 * Una línea y un botón que abre la configuración. No repite los pasos —eso vive
 * en el desplegable, en un solo lugar— y no intenta adivinar cuál de los cuatro
 * falta: el que abre lo ve marcado ahí.
 */
export function AvisoPuente({ puente, ahora, compacto = false }: {
  puente: EstadoPruebaOut['puente'] | null;
  ahora: number | null;
  compacto?: boolean;
}) {
  const { txt } = estadoDelPuente(puente, ahora);
  return (
    <Alert tono="warn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          <strong>{txt}.</strong>
          {/* La consecuencia, y sólo donde hay lugar: es lo que convierte un
              estado en un motivo para hacer algo. */}
          {!compacto && ' Sin eso no se pueden producir los videos.'}
        </span>
        {/* ⚠️ El rótulo dice lo que el botón HACE: abre la configuración. Decía
            «Conectar», que es sólo uno de los cuatro pasos de adentro — y en el
            caso más común (falta abrir Flow) nombraba justo el que ya está
            hecho. Este repo ya pagó un botón que decía una cosa y hacía otra. */}
        <Button size="sm" variant="secondary" onClick={abrirPuente}>Configurar</Button>
      </div>
    </Alert>
  );
}
