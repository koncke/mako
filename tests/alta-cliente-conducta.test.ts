// =============================================================================
// El alta de un cliente se EJECUTA (lib/alta-cliente.ts con lib/usuarios.ts de verdad): crea a la persona, y un mail caído no la deshace
// =============================================================================
// tests/alta-cliente.test.ts fija el ORDEN leyendo el fuente. Acá se corre. Lo que preocupa el 25/10/2026, primer cobro real de un plan:
//   · el 28/09 una agencia quedó «aprobada» con CERO usuarios: el alta tiene que dejar una fila en `usuarios` (la fila ES la invitación);
//   · si esa fila no se puede crear, no queda un workspace huérfano y no sale ningún mail;
//   · si el cobro entra y el MAIL no sale —se devuelve o TIRA— el alta queda firme y se dice (`invitacion.enviado: false`).
// El módulo es server-only (se neutraliza el marcador) y la base es un doble en memoria con la forma que usa el código real:
// `from(t).select().order()`, `.insert(fila).select().single()` y `.delete().eq()`. Se reemplazan workspace, settings, onboarding e
// invitaciones (el mail), NO usuarios.ts: el `throw` de `crearUsuario` ante un error de la base es parte de lo que se prueba.
// Probado ROMPIÉNDOLO (23/10/2026): ver el pie del archivo.
// Correr: node --import tsx --test tests/alta-cliente-conducta.test.ts

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Fila = Record<string, unknown>;
const eventos: string[] = [];
let usuarios: Fila[] = [];
let workspaces: Fila[] = [];
let fallaInsertUsuario: string | null = null;
let mail: 'sale' | 'rebota' | 'tira' = 'sale';
const mailsPedidos: Fila[] = [];

/** El cliente de Supabase mínimo: lo que usan listarUsuarios, crearUsuario y el rollback. */
const base = {
  from(tabla: string) {
    const filas = () => (tabla === 'usuarios' ? usuarios : workspaces);
    return {
      select: () => ({ order: async () => ({ data: [...filas()], error: null }) }),
      insert: (fila: Fila) => ({
        select: () => ({
          single: async () => {
            if (tabla === 'usuarios' && fallaInsertUsuario) return { data: null, error: { message: fallaInsertUsuario } };
            const nueva = { id: filas().length + 1, ...fila };
            filas().push(nueva);
            if (tabla === 'usuarios') eventos.push('usuario');
            return { data: nueva, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async (col: string, v: unknown) => {
          const resto = filas().filter((f) => f[col] !== v);
          if (tabla === 'workspaces') { workspaces = resto; eventos.push('workspace-borrado'); }
          else usuarios = resto;
          return { error: null };
        },
      }),
    };
  },
};

type Cargador = (pedido: string, padre: { filename?: string } | null, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const original = M._load;
const falsos: Record<string, unknown> = {
  './workspace': {
    crearWorkspace: async (nombre: string, capa: string) => {
      const ws = { id: 50 + workspaces.length, nombre, capa };
      workspaces.push(ws);
      eventos.push('workspace');
      return ws;
    },
    runWithWorkspace: async (_ws: number, f: () => Promise<unknown>) => f(),
  },
  './settings': { setSetting: async () => undefined },
  './onboarding-state': { estadoInicial: () => ({}), setEstadoOnboarding: async () => undefined },
  './invitaciones': {
    invitarPorEmail: async (u: Fila) => {
      eventos.push('mail');
      mailsPedidos.push(u);
      if (mail === 'tira') throw new Error('no pude leer el workspace de la plataforma');
      return mail === 'sale'
        ? { enviado: true, enlace: 'https://x/inicio' }
        : { enviado: false, error: 'Resend rechazó el envío', enlace: 'https://x/inicio' };
    },
  },
};
M._load = ((pedido: string, padre: { filename?: string } | null, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  const desde = padre?.filename ?? '';
  if (pedido === './supabase' && /(alta-cliente|usuarios)\.ts$/.test(desde)) return { getSupabaseServer: () => base };
  if (/alta-cliente\.ts$/.test(desde) && falsos[pedido]) return falsos[pedido];
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;

beforeEach(() => {
  eventos.length = 0; mailsPedidos.length = 0; usuarios = []; workspaces = [];
  fallaInsertUsuario = null; mail = 'sale';
});

const pedido = { nombre: 'Ana Pérez', capa: 'completo', adminEmail: ' Ana@Hotmail.com ', adminNombre: 'Ana Pérez', invitadoPor: 'pago:stripe' };

async function alta(a: Fila = {}) {
  const { darDeAltaCliente } = await import('../lib/alta-cliente');
  return darDeAltaCliente({ ...pedido, ...a } as Parameters<typeof darDeAltaCliente>[0]);
}

test('el alta CREA A LA PERSONA: una fila de admin del negocio nuevo, y recién después sale el mail', async () => {
  const r = await alta();
  assert.equal(r.ok, true);
  assert.equal(usuarios.length, 1, 'un alta sin usuarios es el caso del 28/09');
  assert.equal(usuarios[0].email, 'ana@hotmail.com');
  assert.equal(usuarios[0].rol_ws, 'admin');
  assert.equal(usuarios[0].estado, 'invitado');
  assert.equal(usuarios[0].invitado_por, 'pago:stripe');
  assert.equal(usuarios[0].workspace_id, workspaces[0].id, 'la persona entra al negocio que se creó, no a otro');
  assert.deepEqual(eventos, ['workspace', 'usuario', 'mail'], 'el mail sólo sale con la fila ya creada');
  assert.equal(mailsPedidos[0].workspace, 'Ana Pérez');
});

test('si la base NO deja crear a la persona: no queda el negocio huérfano y no sale ningún mail', async () => {
  fallaInsertUsuario = 'duplicate key value violates unique constraint "usuarios_email_key"';
  const r = await alta();
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 500);
  assert.match(r.ok === false ? r.error : '', /No se pudo crear el admin del cliente/);
  assert.equal(workspaces.length, 0, 'el workspace se borra: un negocio sin una sola persona nadie lo limpia');
  assert.equal(usuarios.length, 0);
  assert.deepEqual(eventos, ['workspace', 'workspace-borrado'], 'sin mail a quien no existe');
});

test('el cobro entra y el mail REBOTA: el alta queda firme y se dice que el mail no salió', async () => {
  mail = 'rebota';
  const r = await alta();
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.invitacion.enviado, false);
  assert.equal(r.ok && !r.invitacion.enviado && r.invitacion.error, 'Resend rechazó el envío');
  assert.equal(usuarios.length, 1);
  assert.equal(workspaces.length, 1);
  assert.ok(!eventos.includes('workspace-borrado'), 'un mail que no salió no deshace un alta buena');
});

test('el cobro entra y el mail TIRA: tampoco sube como excepción (el alta ya está firme y el aviso del pago no la repite)', async () => {
  mail = 'tira';
  const r = await alta();
  assert.equal(r.ok, true, 'una excepción acá deja el cobro «pendiente» con la cuenta ya creada');
  assert.equal(r.ok && r.invitacion.enviado, false);
  // `error` es opcional en ResultadoInvitacion, así que acá se AFIRMA que vino antes de mirarlo:
  // si algún día el mail que tira vuelve sin motivo, el test lo dice en vez de medirse contra ''.
  const motivo = r.ok && !r.invitacion.enviado ? r.invitacion.error : undefined;
  assert.ok(typeof motivo === 'string', 'un mail que tiró tiene que decir POR QUÉ: sin motivo, quien da el alta no sabe qué pasó');
  assert.match(motivo, /no pude leer el workspace/);
  assert.equal(usuarios.length, 1);
  assert.equal(workspaces.length, 1);
});

test('quien ya tiene cuenta: no se crea otro negocio ni se manda nada', async () => {
  usuarios.push({ id: 1, email: 'ana@hotmail.com', workspace_id: 3 });
  const r = await alta();
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.yaExiste, true);
  assert.equal(workspaces.length, 0);
  assert.deepEqual(eventos, []);
});

// Probado ROMPIENDO lib/alta-cliente.ts (23/10/2026), una rotura por vez y restaurando de memoria. Con el código como está: 5 pases, 0 fallos.
// Rota (pases / fallos):
//   · sin el rollback del workspace cuando falla crearUsuario                  → 4 / 1
//   · sin el try/catch del mail (el `throw` sube hasta el aviso del pago)       → 4 / 1
//   · la persona se crea sin `workspace_id` (no entra a su negocio)             → 4 / 1
//   · la persona se crea sin `rol_ws: 'admin'`                                  → 4 / 1
//   · un mail que no salió revierte el alta                                     → 3 / 2
