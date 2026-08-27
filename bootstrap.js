// ---------- Live data loader ----------
// Reads real, previously-synced metrics from Supabase (table ig_dashboard_metrics),
// reshapes them into the same POSTS/WEEKLY/FB_POSTS/FB_DAILY/CROSS arrays the
// rest of the dashboard (app.js) already expects, then boots the app.
// This table is only ever written by the scheduled sync function (service role
// key), never by this page. This page reads with the public anon key, allowed
// only for SELECT by the RLS policy on the table.

const SUPABASE_URL = "https://fuuyljsewwarroiyojdw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1dXlsanNld3dhcnJvaXlvamR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk0NjgsImV4cCI6MjEwMjcxNTQ2OH0.vhwrorp8jwcTnUzAb44P6PPhjBi8WDKByfEvAGwNfUg";

function showBootMessage(html) {
  document.getElementById('root').innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">' +
    '<div style="max-width:420px;text-align:center;color:#94A3B8;font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.6;">' +
    html + '</div></div>';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

(async function boot() {
  showBootMessage('Cargando datos reales desde Supabase…');

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  } catch (e) {
    showBootMessage('No se pudo cargar la librería de Supabase. Revisa tu conexión y recarga la página.');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb
    .from('ig_dashboard_metrics')
    .select('platform, entity_type, external_id, metrics, fetched_at');

  if (error) {
    showBootMessage('No se pudieron cargar los datos: ' + error.message);
    return;
  }

  if (!data || data.length === 0) {
    showBootMessage(
      'Todavía no hay datos sincronizados en Supabase.<br><br>' +
      'La sincronización automática se ejecuta una vez al día. Si la acabas de configurar, ' +
      'espera a la primera ejecución o pide que se lance manualmente.'
    );
    return;
  }

  const rowsOf = (platform, entityType) =>
    data.filter(r => r.platform === platform && r.entity_type === entityType).map(r => r.metrics);

  window.POSTS = rowsOf('instagram', 'post');
  window.WEEKLY = rowsOf('instagram', 'account_week').sort((a, b) => a.week < b.week ? -1 : 1);
  window.FB_POSTS = rowsOf('facebook', 'post');
  window.FB_DAILY = rowsOf('facebook', 'account_day').sort((a, b) => a.date < b.date ? -1 : 1);
  window.CROSS = rowsOf('cross', 'cross_day');

  const metaRow = data.find(r => r.platform === 'instagram' && r.entity_type === 'account_meta');
  const meta = metaRow ? metaRow.metrics : {};
  window.IG_FOLLOWERS = meta.followers ?? 0;
  window.IG_FOLLOWS = meta.follows ?? 0;
  window.IG_MEDIA_COUNT = meta.media_count ?? window.POSTS.length;
  window.IG_USERNAME = meta.username ?? 'berzosa.neuro';

  const lastSync = data.reduce((a, r) => (r.fetched_at > a ? r.fetched_at : a), data[0].fetched_at);
  window.LAST_SYNC_AT = lastSync;

  if (window.POSTS.length === 0) {
    showBootMessage('Se conectó a Supabase pero todavía no hay publicaciones de Instagram sincronizadas.');
    return;
  }

  document.getElementById('root').innerHTML = '';

  try {
    await loadScript('app.js');
  } catch (e) {
    showBootMessage('Se cargaron los datos pero falló el renderizado del dashboard: ' + e.message);
  }
})();
