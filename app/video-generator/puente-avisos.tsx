'use client';

// =============================================================================
// Lo único del puente que queda en la web: un aviso
// =============================================================================
// El dueño: «esto tiene que ir DENTRO del desplegable de la extensión de MaKo. Y
// dentro de MaKo simplemente mostrar un aviso cuando esté desconectado. Y claro
// que no te deje avanzar. Todo minimalista».
//
// Los cuatro pasos se mudaron al popup. Acá quedan SOLO las dos cosas que la
// extensión no puede hacer por definición, y las dos son botones:
//
//   · Instalarla. Tautología: el popup es una página de la extensión y no existe
//     antes de instalarla. Y el hecho lo mide `data-mako-puente`, que lo pone el
//     content script, que tampoco existe antes.
//   · Levantar la marca de Google. `rehabilitarPuenteAction` hace un UPDATE y un
//     DELETE sobre el historial del workspace; dárselo al token del puente sería
//     un borrado repetible cada 15 s, sin rate-limit y sin registro.
//
// El resto es una frase sin botón, a propósito: una página web NO puede abrir el
// popup de una extensión (`chrome.action.openPopup` solo corre en contexto de
// extensión), así que un botón que prometiera eso no podría cumplirlo — y este
// repo ya pagó un botón que decía una cosa y hacía otra.

import { useEffect, useState } from 'react';
import { Alert, Button } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { rehabilitarPuenteAction } from './puente-actions';
import type { Puente } from '@/lib/flow-cola';
import { estaVivo } from '@/lib/flow-puente-frescura';
import { puedeInstalarExtension, type PuedeInstalar } from '@/lib/navegador';
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP } from '@/lib/extension-tienda';

/** El id del aviso. Es lo que `resaltarAviso()` busca cuando un clic choca contra el gate. */
export const ID_AVISO_PUENTE = 'mk-aviso-puente';

/**
 * ¿Este navegador puede instalar la extensión?
 *
 * Es una CORAZONADA, no un hecho: no existe ninguna API que lo conteste. Por eso
 * vale menos que el atributo del DOM, que observa un hecho — y por eso el aviso
 * que cuelga de acá va subordinado a aquél.
 *
 * Va en `useEffect` y no en el render porque el server no tiene `navigator`.
 */
function usePuedeInstalar(): PuedeInstalar | null {
  const [v, setV] = useState<PuedeInstalar | null>(null);
  useEffect(() => { setV(puedeInstalarExtension(navigator)); }, []);
  return v;
}

/**
 * QUÉ LE PASA AL NAVEGADOR, en una frase. UN solo juicio.
 *
 * ⚠️ Lo miran DOS cosas que se leen juntas —el aviso y el gate que decide si se
 * puede empezar un anuncio— y por eso está acá y no adentro de un render. Medido
 * antes de unificarlo: el aviso decía «tu navegador no está conectado» mientras
 * otra parte de la misma pantalla decía «falta abrir Google Flow». Hablaban del
 * mismo hecho, la segunda tenía razón, y la primera mandaba a reinstalar una
 * extensión que ya estaba puesta.
 */
export function estadoDelPuente(
  p: Puente | null,
  ahora: number | null,
): { tono: 'good' | 'warn' | 'bad'; txt: string; anda: boolean; vivo: boolean } {
  if (!p) return { tono: 'warn', txt: 'Sin conectar', anda: false, vivo: false };
  const vivo = estaVivo(p.ultimoVisto, ahora);
  if (p.estado === 'marcada') return { tono: 'bad', txt: 'Google pausó tu sesión de Flow', anda: false, vivo };
  if (!vivo) return { tono: 'warn', txt: 'Tu navegador no está conectado', anda: false, vivo };
  if (p.estado !== 'listo') return { tono: 'warn', txt: 'Falta abrir Google Flow', anda: false, vivo };
  return { tono: 'good', txt: 'Listo', anda: true, vivo };
}

/**
 * El envoltorio que lleva el `id`.
 *
 * `Alert` no acepta `id`, y agregárselo al kit compartido por UN consumidor es
 * ensanchar una primitiva para un caso. El ancla vive afuera.
 */
function Caja({ tono, children }: { tono: 'warn' | 'bad'; children: React.ReactNode }) {
  return <div id={ID_AVISO_PUENTE}><Alert tono={tono}>{children}</Alert></div>;
}

/** Dónde se resuelve todo lo que este aviso NO puede resolver. */
const EN_LA_EXTENSION = 'Ábrela desde el ícono de MaKo.';

export function AvisoPuente({ puente, ahora, instalada, compacto = false }: {
  puente: Puente | null;
  ahora: number | null;
  /** `false` = medido y no está · `null` = todavía no se sabe · string = su versión. */
  instalada: string | false | null;
  compacto?: boolean;
}) {
  const puedeInstalar = usePuedeInstalar();
  const [rehabilitando, setRehabilitando] = useState(false);

  // Una rama a la vez, de lo más bloqueante a lo menos: arreglar lo de abajo no
  // sirve mientras lo de arriba siga.

  // ⚠️ Solo con la certeza `'no'`: ni con `'no-se-sabe'` ni con `null`. Decirle
  // «tu navegador no sirve» a un Chrome de verdad —pasa en `http://` por IP de
  // LAN, donde `userAgentData` no existe— le niega la función a quien la tiene, y
  // no tiene vuelta atrás dentro de la pantalla.
  if (instalada === false && puedeInstalar === 'no') {
    return (
      <Caja tono="warn">
        <strong>Este navegador no puede instalar la extensión.</strong> Abre MaKo en
        Chrome, Edge, Brave u Opera y conéctalo ahí. Después puedes seguir usando MaKo
        en este navegador: la extensión trabaja desde donde la instalaste, no desde
        donde escribes.
      </Caja>
    );
  }

  if (instalada === false) {
    return (
      <Caja tono="warn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            <strong>Falta la extensión de MaKo.</strong>
            {!compacto && ' Es la que produce los videos, con tu cuenta de Google Flow.'}
          </span>
          {EXTENSION_EN_TIENDA ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.open(EXTENSION_URL_TIENDA, '_blank', 'noopener')}
              icon={<Icon name="descargar" size={13} />}
            >
              Añadir a Chrome
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { window.location.href = EXTENSION_URL_ZIP; }}
              icon={<Icon name="descargar" size={13} />}
            >
              Descargar
            </Button>
          )}
        </div>
      </Caja>
    );
  }

  // La sesión marcada es un estado de CONTENCIÓN: no se levanta solo, a
  // propósito. El botón es la salida explícita — sin él la tab quedaba muerta
  // aunque el problema estuviera resuelto.
  if (puente?.estado === 'marcada') {
    return (
      <Caja tono="bad">
        <strong>Google pausó tu sesión de Flow.</strong> Espera un rato, borra las cookies
        de google.com y labs.google, y vuelve a entrar a Flow. Reintentar sin hacer eso
        solo empeora la marca.
        <div style={{ marginTop: 9 }}>
          <Button
            size="sm"
            variant="secondary"
            loading={rehabilitando}
            onClick={async () => {
              setRehabilitando(true);
              try {
                const out = await rehabilitarPuenteAction();
                if (out.ok) window.location.reload();
              } finally { setRehabilitando(false); }
            }}
          >
            Ya lo hice, volver a habilitar
          </Button>
        </div>
      </Caja>
    );
  }

  // Lo que queda no tiene ningun boton que esta pagina pueda ofrecer: se resuelve
  // en el popup. Asi que en vez de una cinta mas, es un PUNTERO a donde hay que ir.
  const { txt } = estadoDelPuente(puente, ahora);
  return <PunteroALaExtension texto={txt} />;
}

/**
 * El cartel que SEÑALA la barra del navegador.
 *
 * Martin: «que dentro de MaKo detecte donde esta el icono de la extension y
 * señale con una flecha a ese aviso… y que el mensaje este conectado a esa
 * flecha».
 *
 * ⚠️ NO SE PUEDE DETECTAR LA POSICION DEL ICONO, y conviene decirlo acá antes de
 * que alguien lo intente: no existe ninguna API. Una pagina no ve la barra del
 * navegador, y la extension tampoco sabe donde la anclaron —`chrome.action` no
 * expone coordenadas—. Lo unico medible desde acá es el borde de la ventana.
 *
 * Lo que SI es un hecho, y alcanza: la barra esta arriba y los iconos se apilan
 * contra el borde DERECHO. El puntero se ancla a esa esquina —que es la misma en
 * todos los navegadores— y la flecha sale del mensaje hacia alli. Se lee como
 * «alla arriba», que es verdad, y no como un pin que pretende saber mas.
 *
 * El mensaje viaja PEGADO a la flecha, que era el pedido: un cartel abajo y una
 * flecha arriba son dos cosas, y hay que unirlas con la mirada.
 */
function PunteroALaExtension({ texto }: { texto: string }) {
  return (
    <>
    {/* ⚠️ EL HUECO. Un `position: fixed` sale del flujo por definición, así que el
        puntero caía justo ENCIMA de «Crear mi anuncio», que es la acción de la
        pantalla. El espacio hay que pedirlo, y se pide donde el flujo existe.
        Un separador acá y no un `padding` en el `<main>`: ese `<main>` es
        `Pagina`, que lo escribe INLINE, y una regla de hoja pierde contra un
        estilo inline — quedaría un `!important` para ganarle a la primitiva. */}
    <div aria-hidden="true" style={{ height: 76 }} />
    <div className="mk-puntero" id={ID_AVISO_PUENTE} role="status">
      {/* La flecha nace en la caja y termina arriba a la derecha, contra la barra.
          Curva y no recta: una recta vertical se lee como un subrayado; la curva
          dice «sali de aca y anda alla». */}
      <svg
        className="mk-puntero__flecha"
        width="86"
        height="46"
        viewBox="0 0 86 46"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 44C8 26 22 8 74 5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M62 2.5L75 5L67.5 15"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mk-puntero__caja">
        <strong>{texto}.</strong> {EN_LA_EXTENSION}
      </div>
    </div>
    </>
  );
}
