// Vercel Serverless Function — runs once a day via the cron schedule in
// vercel.json. Pulls fresh Instagram + Facebook data from Windsor.ai,
// scores it, and upserts it into Supabase (table ig_dashboard_metrics).
// The live dashboard (dashboard.html) never talks to Windsor directly —
// it only ever reads the already-synced rows from Supabase.
//
// Required environment variables (set these in Vercel → Project Settings →
// Environment Variables — NEVER hardcode secrets in this file):
//   WINDSOR_API_KEY            Windsor.ai API key
//   SUPABASE_URL               https://fuuyljsewwarroiyojdw.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase service role key (bypasses RLS; needed
//                              to write — the dashboard only ever uses the
//                              public anon key to read)
//   CRON_SECRET                Optional but recommended. If set, this endpoint
//                              only runs when called with
//                              "Authorization: Bearer <CRON_SECRET>", which
//                              Vercel Cron sends automatically once this env
//                              var exists. Prevents random visitors from
//                              triggering (and burning Windsor.ai quota on)
//                              this endpoint.

const { scorePosts, groupIntoWeeks, buildCrossPlatform } = require('../lib/scoring.js');

const WINDSOR_BASE = 'https://connectors.windsor.ai';

async function windsorGet(connector, fields, extraParams) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error('Falta WINDSOR_API_KEY');
  const params = new URLSearchParams({
    api_key: apiKey,
    fields: fields.join(','),
    _renderer: 'json',
    ...extraParams,
  });
  const url = `${WINDSOR_BASE}/${connector}?${params.toString()}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || res.statusText;
    throw new Error(`Windsor ${connector} ${res.status}: ${msg}`);
  }
  // Windsor's JSON renderer returns { data: [...] } for most connectors.
  return (body && (body.data || body)) || [];
}

async function supabaseUpsert(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  if (rows.length === 0) return { upserted: 0 };

  const res = await fetch(`${url}/rest/v1/ig_dashboard_metrics?on_conflict=platform,entity_type,external_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert ${res.status}: ${text}`);
  }
  return { upserted: rows.length };
}

function row(platform, entity_type, external_id, metrics) {
  return { platform, entity_type, external_id: String(external_id), metrics };
}

// Cross-platform rows are fully recomputed on every sync (not accumulated
// like posts), so any row from a previous run that the current computation
// no longer produces would otherwise stay orphaned in the table forever —
// upsert only adds/updates, it never removes. Wipe the old set before
// writing the fresh one so the table always matches what buildCrossPlatform
// says right now.
async function supabaseDeleteCross() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(
    `${url}/rest/v1/ig_dashboard_metrics?platform=eq.cross&entity_type=eq.cross_day`,
    {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase delete cross ${res.status}: ${text}`);
  }
}

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  const report = { steps: [], errors: [] };

  try {
    // ---- Instagram: posts (last 2 years, all media) ----
    const igFields = [
      'timestamp', 'media_id', 'media_type', 'media_product_type', 'media_caption',
      'media_permalink', 'media_like_count', 'media_comments_count', 'media_reach',
      'media_views', 'media_saved', 'media_shares', 'media_engagement',
      'media_profile_visits', 'media_follows', 'media_reel_avg_watch_time',
      'media_reel_skip_rate',
    ];
    const igPostsRaw = await windsorGet('instagram', igFields, { date_preset: 'last_2years' });
    const igPostsScored = scorePosts(igPostsRaw);
    report.steps.push(`Instagram posts: ${igPostsScored.length}`);

    // ---- Instagram: account-level daily insights -> grouped into weeks ----
    const igDailyFields = [
      'date', 'reach_1d', 'likes', 'comments', 'saves', 'shares', 'views',
      'total_interactions', 'accounts_engaged', 'profile_links_taps',
    ];
    let igWeekly = [];
    try {
      const igDaily = await windsorGet('instagram', igDailyFields, { date_preset: 'last_365d' });
      igWeekly = groupIntoWeeks(igDaily);
      report.steps.push(`Instagram weekly buckets: ${igWeekly.length}`);
    } catch (e) {
      report.errors.push(`Instagram daily insights: ${e.message}`);
    }

    // ---- Instagram: account meta snapshot (followers/following/media count) ----
    let igMeta = null;
    try {
      const metaRows = await windsorGet('instagram', ['followers_count', 'follows_count', 'media_count']);
      igMeta = metaRows[0] || null;
    } catch (e) {
      report.errors.push(`Instagram account meta: ${e.message}`);
    }

    // ---- Facebook: posts ----
    const fbFields = [
      'post_created_time', 'post_id', 'type', 'permalink_url', 'post_impressions',
      'post_impressions_organic', 'post_impressions_unique', 'post_engagements',
      'post_reactions_total', 'post_comments_total', 'post_clicks', 'post_video_views',
      'post_video_avg_time_watched',
    ];
    let fbPosts = [];
    try {
      fbPosts = await windsorGet('facebook_organic', fbFields, { date_preset: 'last_2years' });
      report.steps.push(`Facebook posts: ${fbPosts.length}`);
    } catch (e) {
      report.errors.push(`Facebook posts: ${e.message}`);
    }

    // ---- Facebook: daily page insights ----
    let fbDaily = [];
    try {
      fbDaily = await windsorGet(
        'facebook_organic',
        ['date', 'page_fans', 'page_impressions', 'page_post_engagements'],
        { date_preset: 'last_365d' }
      );
      report.steps.push(`Facebook daily rows: ${fbDaily.length}`);
    } catch (e) {
      report.errors.push(`Facebook daily: ${e.message}`);
    }

    // ---- Cross-platform pairing ----
    const cross = buildCrossPlatform(igPostsRaw, fbPosts);

    // ---- Build rows for Supabase ----
    const rows = [];
    for (const p of igPostsScored) rows.push(row('instagram', 'post', p.media_id, p));
    for (const w of igWeekly) rows.push(row('instagram', 'account_week', w.week, w));
    for (const p of fbPosts) rows.push(row('facebook', 'post', p.post_id, p));
    for (const d of fbDaily) rows.push(row('facebook', 'account_day', d.date, d));
    for (const c of cross) rows.push(row('cross', 'cross_day', c._external_id, c));
    if (igMeta) {
      rows.push(
        row('instagram', 'account_meta', 'meta', {
          followers: igMeta.followers_count,
          follows: igMeta.follows_count,
          media_count: igMeta.media_count,
          username: 'berzosa.neuro',
        })
      );
    }

    // ---- TikTok: best-effort only, account had 0 videos as of 2026-08-27 ----
    try {
      const tkPosts = await windsorGet(
        'tiktok_organic',
        ['video_id', 'video_caption', 'video_duration', 'video_reach', 'video_full_watched_rate'],
        { date_preset: 'last_2years' }
      );
      for (const t of tkPosts) rows.push(row('tiktok', 'post', t.video_id, t));
      report.steps.push(`TikTok posts: ${tkPosts.length}`);
    } catch (e) {
      report.errors.push(`TikTok (no bloqueante): ${e.message}`);
    }

    await supabaseDeleteCross();
    const result = await supabaseUpsert(rows);
    report.steps.push(`Filas escritas en Supabase: ${result.upserted} (cross recalculado: ${cross.length})`);

    res.status(200).json({ ok: true, ...report, syncedAt: new Date().toISOString() });
  } catch (e) {
    report.errors.push(e.message);
    res.status(500).json({ ok: false, ...report });
  }
};
