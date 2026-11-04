// =============================================================================
// tiendas-cuenta-revision — la cuenta con la que entran los revisores de Google y de Apple (3/11 y 4/11/2026)
// =============================================================================
// Uso (desde la raíz del repo; ESCRIBE en la base de .env.local, que es PRODUCCIÓN). Lo corre el Cerebro con el sí de Martín:
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision.mts --carpeta "C:/Users/marti/.mako-tiendas"           # la primera vez
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision.mts --carpeta "C:/Users/marti/.mako-tiendas" --rotar   # cambiar la contraseña
//
// Qué hace, en este orden:
//   1. Crea (o encuentra) el negocio PROPIO de la cuenta, `WS_REVISION` (lib/cuenta-revision-reglas.ts), con ese id. No es el ws 3: ahí
//      «Datos de Mau», «simular» y el Reset dejan datos de verdad.
//   2. Lo MIDE con el mismo chequeo de la entrada (`revisarNegocioDeRevision`: sin líneas de WhatsApp, sin credenciales, sin cartera de
//      agencia), más lo que sólo mira el script: sin productos, sin clases, sin `resend_from`, y sólo leads de ejemplo (@example.com).
//      Si algo no da, frena y no toca nada.
//   3. Crea (o encuentra) el usuario de `CUENTA_DE_REVISION`: closer, en ese negocio.
//   4. Escribe la contraseña nueva en un archivo NUEVO (nunca pisa uno que ya está) y recién después la guarda.
//   5. Le saca lo que sobreviviría a la rotación: su segundo factor y sus passkeys, las computadoras conectadas a su negocio
//      (`ia_pc_dispositivos`, cuyo token no mira la contraseña) y sus avisos del teléfono (`push_suscripciones`).
//   6. Si el negocio no tiene leads, le carga los de ejemplo (ficticios, con correos @example.com, sin teléfono).
//
// ⚠️ CORRERLO DE NUEVO DEJA MUERTA LA CONTRASEÑA QUE TIENEN PLAY Y APPLE: pide `--rotar`. Rotar también cierra las sesiones abiertas
//    (lib/auth.ts compara la sesión con `cambiada_at`).
// ⚠️ LA CONTRASEÑA NO SALE POR PANTALLA: queda en un archivo adentro de --carpeta. Martín la pega en Play Console y en App Store Connect.
//    Si la carpeta cae adentro de un repo o de OneDrive, no corre.
// ⚠️ NO CIERRA EL ONBOARDING: un closer no lo ve (`onboardingPendiente` sólo mira al admin), y marcar pasos hechos que nadie hizo miente.
// =============================================================================

import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const i = process.argv.indexOf('--carpeta');
const carpeta = i > 0 ? path.resolve(process.argv[i + 1] ?? '') : '';
const dentroDeUnRepo = (d: string): boolean => existsSync(path.join(d, '.git')) || (path.dirname(d) !== d && dentroDeUnRepo(path.dirname(d)));
if (!carpeta || carpeta.toLowerCase().startsWith(REPO.toLowerCase()) || /onedrive/i.test(carpeta) || dentroDeUnRepo(carpeta)) {
  console.error('⛔ Falta --carpeta, afuera de todo repo y de OneDrive: ahí queda la contraseña.');
  process.exit(1);
}
const rotar = process.argv.includes('--rotar');

const { CUENTA_DE_REVISION, WS_REVISION, DOMINIO_DE_EJEMPLO, esCorreoDeEjemplo, esCuentaDeRevision } = await imp('lib/cuenta-revision-reglas.ts');
const { WS_PRUEBAS, OWNER_WS } = await imp('lib/auth-session.ts');
if (WS_PRUEBAS.includes(WS_REVISION) || WS_REVISION === OWNER_WS) { console.error('⛔ La cuenta de revisión vive en su propio negocio, nunca en uno de prueba ni en el ws 1.'); process.exit(1); }

const { buscarUsuarioPorEmail, crearUsuario } = await imp('lib/usuarios.ts');
const { guardarContrasena, tieneContrasena } = await imp('lib/contrasena.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { crearWorkspace, getWorkspace, runWithWorkspace } = await imp('lib/workspace.ts');
const { CAPA_DEFAULT } = await imp('lib/capas.ts');
const { revisarNegocioDeRevision, contarEnRevision } = await imp('lib/cuenta-revision.ts');
const { createLead } = await imp('lib/leads.ts');
const db = getSupabaseServer();

// ── 1. Su negocio ────────────────────────────────────────────────────────────────────────────────────────────────────
let negocio = await getWorkspace(WS_REVISION);
if (!negocio) {
  negocio = await crearWorkspace('Negocio de demostración', CAPA_DEFAULT, { id: WS_REVISION });
  console.log(`✓ Negocio ${WS_REVISION} creado: «${negocio.nombre}».`);
}

// ── 2. Que esté limpio: el chequeo de la entrada, y lo que sólo mira el script ─────────────────────────────────────
const entrada = await revisarNegocioDeRevision();
const { data: remitente, error: eRem } = await db.from('app_settings').select('value').eq('workspace_id', WS_REVISION).eq('key', 'resend_from').maybeSingle();
const { data: leadsAhora, error: eLeads } = await db.from('leads').select('email').eq('workspace_id', WS_REVISION).limit(1000);
const extra = {
  productos: await contarEnRevision('productos'),
  clases: await contarEnRevision('curso_clases'),
  remitente: eRem ? null : (remitente ? 1 : 0),
  leadsQueNoSonDeEjemplo: eLeads ? null : ((leadsAhora ?? []) as Array<{ email: string | null }>).filter((l) => !esCorreoDeEjemplo(l.email)).length,
};
const falta = [
  ...(entrada.limpio ? [] : entrada.falta),
  ...Object.entries(extra).filter(([, n]) => n !== 0).map(([k, n]) => (n == null ? `no pude contar ${k}` : `${n} ${k}`)),
];
console.log(`Negocio ${WS_REVISION}: ${falta.length ? falta.join(' · ') : 'limpio (sin líneas, credenciales, cartera, productos, clases, remitente ni leads de verdad)'}`);
if (falta.length) {
  console.error('⛔ Ese negocio tiene algo que no es de ejemplo, o no se pudo contar. Un tercero va a entrar ahí: no sigo. Míralo y límpialo a mano.');
  process.exit(1);
}

// ── 3. La persona ────────────────────────────────────────────────────────────────────────────────────────────────────
let u = await buscarUsuarioPorEmail(CUENTA_DE_REVISION.email);
if (!u) {
  u = await crearUsuario({ email: CUENTA_DE_REVISION.email, nombre: 'Revisión de las tiendas', rol: 'usuario', estado: 'activo', workspace_id: WS_REVISION, rol_ws: CUENTA_DE_REVISION.rolWs });
}
if (!esCuentaDeRevision(u) || u.estado === 'suspendido') { console.error('⛔ Ya existe un usuario con ese correo, y no es la cuenta de revisión o está suspendido. No toco nada.'); process.exit(1); }
const yaTiene = await tieneContrasena(u.id);
if (yaTiene == null) { console.error('⛔ No pude leer si ya tiene contraseña. No toco nada.'); process.exit(1); }
if (yaTiene && !rotar) {
  console.error('⛔ Ya tiene contraseña, y Play y Apple tienen ésa. Para cambiarla, corre con --rotar y pégala de nuevo en las dos.');
  process.exit(1);
}

// ── 4. La contraseña: primero el archivo (nuevo, sin pisar), después la base ───────────────────────────────────────
// 20 bytes al azar: en base64url son 27 caracteres. Se le suma lo que pide la regla de contraseñas.
const contrasena = `Mk-${randomBytes(20).toString('base64url')}-9`;
mkdirSync(carpeta, { recursive: true });
const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
let archivo = path.join(carpeta, 'cuenta-revision.txt');
if (existsSync(archivo)) archivo = path.join(carpeta, `cuenta-revision-${sello}.txt`);
// `wx`: si el archivo ya existe, tira. Pisar uno guardado podría borrar la única copia de la contraseña que tienen Play y Apple.
writeFileSync(archivo, `Correo: ${u.email}\nContraseña: ${contrasena}\nCreada: ${new Date().toISOString()}\n`, { mode: 0o600, flag: 'wx' });
const r = await guardarContrasena(u.id, contrasena, u.email);
if (!r.ok) { console.error(`⛔ No pude guardar la contraseña (${r.error}). El archivo ${archivo} quedó con una que NO vale: bórralo.`); process.exit(1); }

// ── 5. Lo que sobreviviría a rotarla ─────────────────────────────────────────────────────────────────────────────────
const limpiezas: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
  ['su segundo factor', db.from('usuario_mfa').delete().eq('usuario_id', u.id)],
  ['sus passkeys', db.from('usuario_passkeys').delete().eq('usuario_id', u.id)],
  ['las computadoras conectadas a su negocio', db.from('ia_pc_dispositivos').update({ revocado_at: new Date().toISOString() }).eq('workspace_id', WS_REVISION).is('revocado_at', null)],
  ['sus avisos del teléfono', db.from('push_suscripciones').delete().eq('usuario_id', u.id)],
];
for (const [que, q] of limpiezas) {
  const { error } = await q;
  if (error) console.error(`⚠️ No pude sacar ${que}: ${error.message}. Hazlo a mano antes de dar la contraseña.`);
}

// ── 6. Los datos de ejemplo, sólo si el negocio está vacío ─────────────────────────────────────────────────────────
const LEADS_DE_EJEMPLO = [
  { nombre: 'Ana Ruiz', empresa: 'Estudio Ruiz', dias: 2 },
  { nombre: 'Carlos Méndez', empresa: 'Méndez Consultores', dias: 5 },
  { nombre: 'Lucía Torres', empresa: 'Torres Diseño', dias: null },
  { nombre: 'Diego Paredes', empresa: 'Paredes Fitness', dias: null },
  { nombre: 'Valeria Ramos', empresa: 'Ramos Inmobiliaria', dias: null },
  { nombre: 'Jorge Silva', empresa: 'Silva Marketing', dias: null },
] as const;
const { count: leads } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', WS_REVISION);
let cargados = 0;
if (!leads) {
  await runWithWorkspace(WS_REVISION, async () => {
    for (const l of LEADS_DE_EJEMPLO) {
      const correo = `${l.nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@${DOMINIO_DE_EJEMPLO}`;
      const agenda = l.dias == null ? null : new Date(Date.now() + l.dias * 86_400_000).toISOString();
      try { await createLead({ nombre: l.nombre, email: correo, empresa: l.empresa, fecha_agenda: agenda, permitirDuplicado: true }); cargados += 1; }
      catch (e) { console.error(`⚠️ No pude cargar a ${l.nombre}: ${e instanceof Error ? e.message : String(e)}`); }
    }
  });
}

console.log(`✓ Cuenta de revisión lista (usuario ${u.id}, negocio ${WS_REVISION}${cargados ? `, ${cargados} leads de ejemplo` : ''}). La contraseña quedó en ${archivo}.`);
