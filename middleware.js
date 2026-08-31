// Protege el dashboard (todo excepto /api/* y /.well-known/*) con dos formas
// de acceso, ambas a nivel de servidor (no un candado en JS del navegador):
//
// 1. Usuario/contraseña fijos (DASHBOARD_USER / DASHBOARD_PASS) — para ti.
// 2. Enlaces temporales de un solo destinatario (?t=TOKEN), para compartir
//    el dashboard con alguien (p. ej. un familiar) sin darle tus credenciales
//    permanentes. El token caduca solo, sin que tengas que acordarte de
//    quitarle el acceso después.
//
// Los tokens se guardan como filas en la misma tabla ig_dashboard_metrics
// que ya usa el sync (platform='system', entity_type='access_token') — no
// hace falta ninguna tabla nueva. Se leen con la misma clave anónima de
// Supabase que ya usa bootstrap.js (de solo lectura, pública por diseño).

export const config = {
  matcher: '/((?!api/|\\.well-known/).*)',
};

const SUPABASE_URL = 'https://fuuyljsewwarroiyojdw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1dXlsanNld3dhcnJvaXlvamR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk0NjgsImV4cCI6MjEwMjcxNTQ2OH0.vhwrorp8jwcTnUzAb44P6PPhjBi8WDKByfEvAGwNfUg';

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Deterministic, non-reversible fingerprint of the owner credentials. Set as a
// long-lived cookie the first time the owner authenticates, so the browser
// stops asking for user/password on every session. Rotating DASHBOARD_PASS
// invalidates every old cookie automatically.
async function ownerCookieValue(user, pass) {
  const data = new TextEncoder().encode(`${user}:${pass}:owner-v1`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkToken(token) {
  if (!token) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ig_dashboard_metrics?platform=eq.system&entity_type=eq.access_token&external_id=eq.${encodeURIComponent(token)}&select=metrics`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    if (!rows.length) return false;
    const { expires_at, revoked } = rows[0].metrics || {};
    if (revoked) return false;
    if (!expires_at || new Date(expires_at) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  // 1a. Cookie persistente del dueño — no vuelve a pedir usuario/contraseña
  //     una vez autenticado (válida ~1 año, o hasta que se cambie la contraseña).
  if (user && pass) {
    const ownerCookie = getCookie(request, 'dash_owner');
    if (ownerCookie && ownerCookie === (await ownerCookieValue(user, pass))) return;
  }

  // 1b. Usuario/contraseña del dueño (HTTP Basic). Al acertar, deja la cookie
  //     persistente puesta y redirige para quitar el prompt en adelante.
  const auth = request.headers.get('authorization');
  if (user && pass && auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const sep = decoded.indexOf(':');
      if (decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
        const value = await ownerCookieValue(user, pass);
        const res = Response.redirect(new URL(request.url), 302);
        res.headers.append(
          'Set-Cookie',
          `dash_owner=${value}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`
        );
        return res;
      }
    }
  }

  // 2. Token temporal — por query string la primera vez, luego por cookie
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('t');
  const cookieToken = getCookie(request, 'dash_t');
  const token = queryToken || cookieToken;

  if (token && (await checkToken(token))) {
    if (queryToken) {
      // Limpia el token de la URL visible y lo guarda en cookie (7 días de
      // margen en el navegador; la validez real la sigue marcando Supabase
      // en cada visita, así que si el token ya caducó, deja de funcionar
      // igual aunque la cookie siga viva).
      const clean = new URL(url);
      clean.searchParams.delete('t');
      const res = Response.redirect(clean, 302);
      res.headers.append('Set-Cookie', `dash_t=${encodeURIComponent(token)}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
      return res;
    }
    return;
  }

  // Sin credenciales configuradas: no bloquear (evita dejar el sitio
  // inaccesible por error de configuración).
  if (!user || !pass) return;

  return new Response('Autenticación requerida', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Dashboard Berzosa Neuro"' },
  });
}
