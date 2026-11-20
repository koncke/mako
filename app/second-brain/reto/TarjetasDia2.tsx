'use client';

// =============================================================================
// LO DEL DÍA 2 EN EL CHAT DEL RETO: el QR de la app y «Te falta integrar esto» (20/11/2026, auditoría d24-06 y d24-05)
// =============================================================================
// · El QR (d24-06; Martín: «no salía hasta que terminaba el video»): se ve desde que llega el video del día 2, con «Lo hago después».
//   El chat relee cada 10 s mientras está (ChatDelReto.tsx): la tarea «Instala la app» se cierra sola cuando MaKo lee el teléfono con
//   los avisos (lib/reto/senales.ts, `2:app`), y ahí la tarjeta se va.
// · Las integraciones (d24-05): sólo las de lo que eligió (`integracionesDelReto`, lib/reto/dias.ts), cada una con su «para» y su
//   estado, y «Te muestro dónde», que corre las marcas de la tarea (la última baja hasta la tarjeta de la que le toca).
// El QR lo arma /api/reto (el link único de la app, como el paso de los avisos del onboarding).
// =============================================================================

import { RETO_D2_INT, RETO_D2_INT_LISTAS, type IntegracionReto } from '@/lib/reto/dias';
import { Burbuja } from './Burbuja';

export type IntegracionConEstado = IntegracionReto & { conectada: boolean };

export function TarjetaQrApp({ qr, onDespues }: { qr: string; onDespues: () => void }) {
  return (
    <Burbuja ancho>
      <div className="rt-tarjeta rt-qr" data-recorrido="sb-reto-qr">
        <p className="rt-tarjeta__t">La app de MaKo en tu teléfono</p>
        <p className="rt-wa__ej">Los avisos de tu negocio, al instante. Aparte de MaKo por WhatsApp.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- el QR viene armado del server, como en /perfil/instalar */}
        <img className="rt-qr__img" src={qr} alt="QR para instalar la app de MaKo en tu teléfono" width={168} height={168} />
        <p className="rt-wa__ej">Escanéalo con tu teléfono. Instala MaKo y activa los avisos. Sigo solo cuando estén.</p>
        <button type="button" className="rt-tarea__donde" onClick={onDespues}>Lo hago después</button>
      </div>
    </Burbuja>
  );
}

export function TarjetaIntegraciones({ ints, onMostrar, despues = false, onDespues, conTarjeta = true }: { ints: readonly IntegracionConEstado[]; onMostrar: () => void;
  /** «Lo hago después» en la tarjeta (verificación del 20/11, d24-05 y d24-08): el día sigue sin conectarlas ahora. */
  despues?: boolean; onDespues?: () => void;
  /** La tarjeta, después del texto (la cola de salida del chat del reto, lib/reto/en-el-dia.ts). */
  conTarjeta?: boolean }) {
  const todas = ints.every((i) => i.conectada);
  return (
    <>
      {/* «Te falta integrar esto» sólo si falta algo (verificación d24-05: salía aunque estuvieran todas). */}
      <Burbuja><p>{todas ? RETO_D2_INT_LISTAS : RETO_D2_INT}</p></Burbuja>
      {conTarjeta && <Burbuja ancho>
        <div className="rt-tarjeta rt-int" data-recorrido="sb-integra" data-tarea="2:integraciones">
          <p className="rt-tarjeta__t">{todas ? 'Tus integraciones' : 'Te falta integrar esto'}</p>
          <ol className="rt-tareas">
            {ints.map((i) => (
              <li key={i.key} className="rt-tarea" data-ok={i.conectada ? '' : undefined}>
                <span className="rt-tarea__check" aria-hidden>{i.conectada ? '✓' : ''}</span>
                <span className="rt-tarea__txt"><b>{i.nombre}</b><small>Para {i.para}.</small></span>
                {i.conectada ? <span className="rt-tarea__ok">Conectada</span> : <span className="rt-int__falta">Falta integrar</span>}
              </li>
            ))}
          </ol>
          {!todas && <button type="button" className="rt-tarea__donde rt-int__ver" onClick={onMostrar}>Se conectan en Settings › Integraciones. Te muestro dónde</button>}
          {!todas && (despues ? <p className="rt-wa__ej">◐ Las conectas después: el día sigue.</p>
            : onDespues && <button type="button" className="rt-tarea__donde" onClick={onDespues}>Lo hago después</button>)}
        </div>
      </Burbuja>}
    </>
  );
}
