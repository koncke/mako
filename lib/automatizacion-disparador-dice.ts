// =============================================================================
// automatizacion-disparador-dice — lo que dice una automatización contra la etapa que la dispara (30/10/2026)
// =============================================================================
// La #264 de Código Inmobiliario avisa «🎯 *Nuevo agendado*» y se dispara en dos etapas: Agenda y Lead. Su equipo recibe el aviso
// con cada lead nuevo, aunque no haya agendado nadie. La configuración es del cliente y no se toca por detrás: se le muestra.
//
// ⚠️ EL NOMBRE SOLO NO ALCANZA, MEDIDO: esa automatización se llama «Nueva automatización», y «agendado» está en el TEXTO DEL AVISO.
// Se lee el nombre y el primer renglón de cada aviso al equipo. NO los mensajes al lead: «Agenda tu llamada» en la etapa Lead es
// justo lo correcto, y avisaría a cada rato. Y «lead» no cuenta como evidencia: «Un Lead Agendó Llamada» habla de la agenda.
//
// Puro: lo leen la pantalla y el test.
// =============================================================================

type Etapa = { value: string; label: string };
/** Lo mínimo de un paso que se mira. */
type PasoConAccion = { accion?: { operacion?: unknown; params?: { mensaje?: unknown } | null } | null };

export type DisparadorDice = {
  /** De dónde salió: se llama así, o lo dice su aviso. */
  fuente: 'nombre' | 'aviso';
  /** Las palabras tal como están escritas. */
  dice: string;
  /** Las etapas que dispara y lo escrito no nombra. */
  otras: string[];
  /** Además dispara en la que nombra (si no, dispara SÓLO en otra). */
  ademas: boolean;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Lo que no dice de qué etapa se habla: «lead» está en casi todos los títulos. */
const GENERICAS = new Set(['lead', 'leads', 'etapa', 'nuevo', 'nueva', 'nuevos', 'nuevas', 'cliente', 'clientes', 'funnel', 'entrante', 'entrantes']);
const LARGO_RAIZ = 5;

/** Las raíces que identifican a una etapa, de su rótulo: «Agenda R1» → `agend`. Una palabra corta («R1», «No») no identifica nada. */
function raices(label: string): string[] {
  return norm(label).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !GENERICAS.has(p)).map((p) => p.slice(0, LARGO_RAIZ));
}

/** El primer renglón de un aviso, sin sus datos (`{{nombre}}`) ni sus marcas: lo que se lee como título. */
function primerRenglon(texto: string): string {
  return (texto.split(/\r?\n/).find((l) => l.trim()) ?? '').replace(/\{\{[^}]*\}\}/g, ' ').replace(/[*_~:]/g, ' ').replace(/\p{Extended_Pictographic}/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Las etapas de `etapas` que el texto nombra. */
function nombradas(texto: string, etapas: readonly Etapa[]): Etapa[] {
  const palabras = norm(texto).split(/[^a-z0-9]+/).filter(Boolean);
  return etapas.filter((e) => raices(e.label).some((r) => palabras.some((p) => p.startsWith(r))));
}

/**
 * ¿Dice una etapa y se dispara además (o en cambio) en otra? null = coherente, o no hay de dónde saberlo: sin ninguna etapa
 * nombrada no se opina, y una automatización que no arranca por etapa no pasa por acá (`disparan` vacío).
 */
export function disparadorQueNoDice(a: {
  nombre: string; pasos: readonly PasoConAccion[]; disparan: readonly string[]; etapas: readonly Etapa[];
}): DisparadorDice | null {
  const disparan = a.etapas.filter((e) => a.disparan.includes(e.value));
  if (!disparan.length) return null;
  const textos: Array<{ fuente: DisparadorDice['fuente']; dice: string }> = [
    { fuente: 'nombre', dice: a.nombre.trim() },
    ...a.pasos.flatMap((p) => (p.accion?.operacion === 'avisar_al_equipo' && typeof p.accion.params?.mensaje === 'string'
      ? [{ fuente: 'aviso' as const, dice: primerRenglon(p.accion.params.mensaje) }] : [])),
  ];
  for (const t of textos) {
    const nombra = nombradas(t.dice, a.etapas);
    if (!nombra.length) continue;
    const otras = disparan.filter((e) => !nombra.includes(e)).map((e) => e.label);
    return otras.length ? { fuente: t.fuente, dice: t.dice, otras, ademas: otras.length < disparan.length } : null;
  }
  return null;
}

const lista = (xs: readonly string[]) => xs.map((x) => `«${x}»`).join(' y ');

/** La línea de la pantalla. */
export function avisoDisparadorQueNoDice(d: DisparadorDice): string {
  const dispara = `se dispara ${d.ademas ? 'también ' : ''}en ${lista(d.otras)}`;
  return d.fuente === 'aviso'
    ? `Tu aviso dice «${d.dice}» y ${dispara}: tu equipo lo recibe con esos leads.`
    : `Se llama «${d.dice}» y ${dispara}.`;
}
