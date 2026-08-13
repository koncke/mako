// =============================================================================
// alerta-critica-texto — QUÉ dice la alerta. Sin `server-only`, a propósito.
// =============================================================================
// Vive separado de `alerta-critica.ts` (que hace el trabajo sucio: leer la base,
// decidir la cadencia, emitir) por la regla de la casa: lo que hay que poder
// TESTEAR va en un módulo que un test pueda importar. Un mensaje que se manda
// cada 10 minutos hasta que alguien pague es exactamente lo que no se puede
// escribir a ciegas.
//
// DOS PEDIDOS DEL DUEÑO, y el segundo corrige al primero:
//
//   1. «Que sea más dramático, usá más emojis (⚠️🚨)».
//   2. «Y también que el mensaje sea CLARO. Que diga "Tu cuenta publicitaria
//      está SUSPENDIDA por falta de pago" o algo así. No simplemente que está
//      frenada».
//
// El segundo es el que importa y es una corrección de fondo, no de estilo:
// «dejó de entregar» describe el SÍNTOMA y esconde la CAUSA. Con el síntoma no
// se sabe qué hacer; con «suspendida por falta de pago» se sabe exactamente.
// Un mensaje urgente que no dice qué hacer es solo ansiedad.
//
// Por eso el titular se arma desde `account_status` REAL de Meta y no de una
// frase genérica: cada estado tiene su causa y su acción, y son distintas.
// =============================================================================

/** El estado del incidente, tal como lo guarda `service_incidents`. */
export type IncidenteTexto = {
  /** `accountStatusLabel()` de lib/meta-health.ts: «Saldo impago», «Deshabilitada»… */
  statusLabel: string | null;
  /** `disableReasonLabel()`: por qué la deshabilitaron, cuando aplica. */
  disableReason: string | null;
  entregaFrenada: boolean;
};

/**
 * De un estado de Meta al TITULAR y al QUÉ HACER, en castellano de persona.
 *
 * ⚠️ Las claves son EXACTAMENTE los valores de `ACCOUNT_STATUS` en
 * lib/meta-health.ts. Si allá se agrega o se renombra un estado, acá cae al
 * default —que dice la verdad pero sin la acción— y hay que sumarlo. El test
 * `alerta-critica.test.ts` compara las dos listas y falla cuando se separan:
 * un titular que se queda viejo es peor que uno genérico, porque suena exacto.
 */
const CAUSA: Record<string, { titular: string; queHacer: string }> = {
  'Saldo impago': {
    titular: 'Tu cuenta publicitaria está *SUSPENDIDA POR FALTA DE PAGO*',
    queHacer: 'Pagá el saldo que debés en el Business Manager de Meta.',
  },
  'Deshabilitada': {
    titular: 'Meta *DESHABILITÓ* tu cuenta publicitaria',
    queHacer: 'Entrá al Business Manager y pedí la revisión de la cuenta.',
  },
  'En revisión de riesgo': {
    titular: 'Meta puso tu cuenta *EN REVISIÓN DE RIESGO*',
    queHacer: 'No toques nada estos días: ni presupuestos ni anuncios nuevos.',
  },
  'Pendiente de liquidación': {
    titular: 'Tu cuenta quedó *PENDIENTE DE LIQUIDACIÓN*',
    queHacer: 'Meta está esperando que se salde la cuenta. Revisá el método de pago.',
  },
  'En período de gracia': {
    titular: 'Tu cuenta está *EN PERÍODO DE GRACIA*: se frena en cualquier momento',
    queHacer: 'Regularizá el pago AHORA, antes de que corte.',
  },
  'Pendiente de cierre': {
    titular: 'Tu cuenta publicitaria está *POR CERRARSE*',
    queHacer: 'Entrá ya al Business Manager: si se cierra, se pierde el historial.',
  },
  'Cerrada': {
    titular: 'Tu cuenta publicitaria está *CERRADA*',
    queHacer: 'Hay que apelar en el Business Manager o abrir una cuenta nueva.',
  },
};

/** Titular + acción. Sin match, se dice el estado crudo y NO se inventa la acción. */
export function causaDe(i: IncidenteTexto): { titular: string; queHacer: string | null } {
  const c = i.statusLabel ? CAUSA[i.statusLabel] : undefined;
  if (c) return c;
  const estado = i.statusLabel?.trim();
  return {
    titular: estado
      ? `Tu cuenta publicitaria está *${estado.toUpperCase()}*`
      : 'Tu cuenta publicitaria está *CAÍDA*',
    // Inventar el paso a seguir para un estado que no conocemos es peor que no
    // decirlo: manda a hacer algo que quizá no arregla nada.
    queHacer: null,
  };
}

/** Los estados que este módulo sabe explicar (lo consume el test de sincronía). */
export const ESTADOS_CON_CAUSA = Object.keys(CAUSA);

export const horasYMinutos = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/**
 * Un párrafo es un array de líneas; los bloques vacíos se descartan enteros. Así
 * una línea opcional desaparece sin dejar un renglón en blanco de más.
 */
const parrafos = (bloques: string[][]): string =>
  bloques.map((b) => b.filter(Boolean).join('\n')).filter(Boolean).join('\n\n');

/**
 * El mensaje. Sube de tono con el tiempo y NUNCA repite el mismo texto: un
 * mensaje idéntico cada 15 minutos se vuelve papel tapiz y se deja de leer.
 *
 * La primera vez dice la causa, qué se pierde y qué hacer. De ahí en adelante lo
 * que crece es el COSTO ACUMULADO —cuánto hace que está caída, cuántas veces se
 * avisó—, que es el dato que empuja a resolverlo.
 */
export function textoAlerta(i: IncidenteTexto, minAbierto: number, veces: number, link: string): string {
  const cuanto = horasYMinutos(minAbierto);
  const { titular, queHacer } = causaDe(i);
  // El motivo de Meta es una SEGUNDA capa (por qué la deshabilitaron) y solo se
  // muestra cuando agrega algo: repetido debajo del titular es ruido.
  const motivo = i.disableReason && i.disableReason !== i.statusLabel
    ? `⚠️ Motivo de Meta: *${i.disableReason}*.`
    : '';
  // «No corre un solo anuncio» es un HECHO verificado (entrega_frenada), no una
  // forma de decir. Si Meta no lo confirma, no se afirma.
  const consecuencia = i.entregaFrenada
    ? `🛑 Hace *${cuanto}* que no corre un solo anuncio.`
    : `🕐 Hace *${cuanto}* que está así.`;

  if (veces === 0) {
    return parrafos([
      ['🚨🚨🚨 *PARÁ TODO* 🚨🚨🚨'],
      [`⛔ ${titular}.`, consecuencia, motivo],
      ['💸 *Cada minuto que pasa es plata tirada:*', '❌ No entra *ningún* lead nuevo.', '❌ El día perdido no se recupera.'],
      queHacer ? [`✅ *QUÉ HACER:* ${queHacer}`] : [],
      ['👉 *RESOLVELO YA:*', link],
      ['🔁 Te voy a seguir avisando hasta que esté arreglado. — MaKo'],
    ]);
  }

  // A partir de la segunda, la primera línea es el CONTADOR: en el celular es lo
  // único que se lee sin abrir, así que ahí va el tiempo perdido.
  const insistencia = veces === 1
    ? '🔁 Te lo repito porque sigue exactamente igual.'
    : `🔁 Es la *${veces + 1}ª vez* que te aviso y sigue igual.`;
  // La escalada aparece sola con el tiempo, sin tener que reescribir el texto.
  const grave = minAbierto >= 6 * 60 ? '🆘 *Esto ya es medio día de leads perdido.*' : '';

  return parrafos([
    [`🚨⚠️ *${cuanto.toUpperCase()} SIN ENTREGAR* ⚠️🚨`],
    [`⛔ ${titular}.`, motivo, insistencia, grave],
    ['💸 Seguís sin recibir un solo lead.'],
    queHacer ? [`✅ ${queHacer}`] : [],
    ['👉 ' + link],
    ['— MaKo'],
  ]);
}

/** El de «ya está», que es la contracara obligatoria de haber insistido. */
export function textoRecuperada(): string {
  return parrafos([
    ['✅✅ *LISTO, YA ESTÁ ENTREGANDO* ✅✅'],
    ['🟢 Tu cuenta publicitaria volvió a la normalidad.', '🔕 Dejo de insistir.'],
    ['— MaKo'],
  ]);
}
