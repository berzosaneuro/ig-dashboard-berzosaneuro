// Pure, dependency-free scoring logic — kept separate from the Vercel handler
// so it can be unit tested without any network access.
//
// Percentile-rank formula and score weights reverse-derived from, and verified
// against, the original hand-built dataset (post reach=18, engagement=9 ->
// engagement_rate 0.5, engagement_rate_pct 0.95, reach_pct 0.5, save_rate_pct 0.45,
// share_rate_pct 0.45, comment_rate_pct 0.95, like_rate_pct 0.95 -> score 71.0):
//   pct(x) = (avgRank(x) + 0.5) / n   where avgRank uses 0-indexed ascending rank,
//            ties get the average rank of the tied group
//   score  = reach_pct*20 + engagement_rate_pct*30 + save_rate_pct*15 +
//            share_rate_pct*15 + comment_rate_pct*10 + like_rate_pct*10
// 20+30+15+15+10+10 = 100, and each pct is in [0,1], so score lands in [0,100].

function percentileRanks(values) {
  const n = values.length;
  const ranks = new Array(n);
  if (n === 0) return ranks;
  if (n === 1) { ranks[0] = 1; return ranks; }

  const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
    const avgRank = (i + j) / 2; // 0-indexed
    const pct = (avgRank + 0.5) / n;
    for (let k = i; k <= j; k++) ranks[order[k]] = pct;
    i = j + 1;
  }
  return ranks;
}

function safeDiv(a, b) {
  if (!b) return 0;
  return a / b;
}

// posts: array of raw Windsor instagram media rows (field names as returned by
// the API — media_id, media_reach, media_engagement, media_saved, media_shares,
// media_comments_count, media_like_count, media_reel_skip_rate, ...).
// Returns a new array of enriched post objects, same shape as the dashboard's
// original POSTS array (data_embed.js), safe to store directly as `metrics`.
function scorePosts(posts) {
  const enriched = posts.map((p) => {
    const reach = p.media_reach || 0;
    const engagement_rate = safeDiv(p.media_engagement, reach);
    const save_rate = safeDiv(p.media_saved, reach);
    const share_rate = safeDiv(p.media_shares, reach);
    const comment_rate = safeDiv(p.media_comments_count, reach);
    const like_rate = safeDiv(p.media_like_count, reach);
    const completion_proxy =
      p.media_reel_skip_rate === null || p.media_reel_skip_rate === undefined
        ? null
        : Math.round((1 - p.media_reel_skip_rate) * 1000) / 1000;
    return {
      ...p,
      engagement_rate: Math.round(engagement_rate * 10000) / 10000,
      save_rate: Math.round(save_rate * 10000) / 10000,
      share_rate: Math.round(share_rate * 10000) / 10000,
      comment_rate: Math.round(comment_rate * 10000) / 10000,
      like_rate: Math.round(like_rate * 10000) / 10000,
      completion_proxy,
    };
  });

  const reachPct = percentileRanks(enriched.map((p) => p.media_reach || 0));
  const engRatePct = percentileRanks(enriched.map((p) => p.engagement_rate));
  const savePct = percentileRanks(enriched.map((p) => p.save_rate));
  const sharePct = percentileRanks(enriched.map((p) => p.share_rate));
  const commentPct = percentileRanks(enriched.map((p) => p.comment_rate));
  const likePct = percentileRanks(enriched.map((p) => p.like_rate));

  return enriched.map((p, i) => {
    const media_reach_pct = Math.round(reachPct[i] * 100) / 100;
    const engagement_rate_pct = Math.round(engRatePct[i] * 100) / 100;
    const save_rate_pct = Math.round(savePct[i] * 100) / 100;
    const share_rate_pct = Math.round(sharePct[i] * 100) / 100;
    const comment_rate_pct = Math.round(commentPct[i] * 100) / 100;
    const like_rate_pct = Math.round(likePct[i] * 100) / 100;
    const score =
      Math.round(
        (media_reach_pct * 20 +
          engagement_rate_pct * 30 +
          save_rate_pct * 15 +
          share_rate_pct * 15 +
          comment_rate_pct * 10 +
          like_rate_pct * 10) *
          10
      ) / 10;
    return {
      ...p,
      media_reach_pct,
      engagement_rate_pct,
      save_rate_pct,
      share_rate_pct,
      comment_rate_pct,
      like_rate_pct,
      score,
    };
  });
}

// dailyRows: array of {date, reach_1d, likes, comments, saves, shares, views,
// total_interactions, accounts_engaged, profile_links_taps}. Groups into ISO
// weeks (YYYY-Www), matching the dashboard's WEEKLY shape.
function isoWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function groupIntoWeeks(dailyRows) {
  const buckets = new Map();
  for (const row of dailyRows) {
    const week = isoWeekLabel(row.date);
    if (!buckets.has(week)) {
      buckets.set(week, {
        week,
        reach_1d: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        views: 0,
        total_interactions: 0,
        accounts_engaged: 0,
        profile_links_taps: 0,
      });
    }
    const b = buckets.get(week);
    b.reach_1d += row.reach_1d || 0;
    b.likes += row.likes || 0;
    b.comments += row.comments || 0;
    b.saves += row.saves || 0;
    b.shares += row.shares || 0;
    b.views += row.views || 0;
    b.total_interactions += row.total_interactions || 0;
    b.accounts_engaged += row.accounts_engaged || 0;
    b.profile_links_taps += row.profile_links_taps || 0;
  }
  return [...buckets.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
}

// Pairs IG posts and FB posts that were published on the same calendar date —
// but ONLY on dates with exactly one IG post and one FB post that day. On a
// date with multiple posts on either side (e.g. several reels published the
// same day) there is no reliable way to know which IG post corresponds to
// which FB post, so pairing every combination would fabricate relationships
// that aren't actually known. Those ambiguous dates are skipped rather than
// guessed at.
function buildCrossPlatform(igPosts, fbPosts) {
  const dateOf = (iso) => (iso || '').slice(0, 10);
  const igByDate = new Map();
  for (const ig of igPosts) {
    const d = dateOf(ig.timestamp);
    if (!d) continue;
    if (!igByDate.has(d)) igByDate.set(d, []);
    igByDate.get(d).push(ig);
  }
  const fbByDate = new Map();
  for (const fb of fbPosts) {
    const d = dateOf(fb.post_created_time);
    if (!d) continue;
    if (!fbByDate.has(d)) fbByDate.set(d, []);
    fbByDate.get(d).push(fb);
  }

  const rows = [];
  for (const [d, igMatches] of igByDate) {
    const fbMatches = fbByDate.get(d);
    if (!fbMatches || igMatches.length !== 1 || fbMatches.length !== 1) continue;
    const ig = igMatches[0];
    const fb = fbMatches[0];
    rows.push({
      date: d,
      ig_reach: ig.media_reach || 0,
      ig_engagement: ig.media_engagement || 0,
      ig_permalink: ig.media_permalink,
      fb_impressions: fb.post_impressions || 0,
      fb_engagement: fb.post_engagements || 0,
      fb_permalink: fb.permalink_url,
      _external_id: `${fb.post_id}_${ig.media_id}`,
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// rows: raw Windsor tiktok_organic video rows. Windsor returns one row per
// (video, day) while metrics are still moving, so the same video_id can appear
// several times — collapse to one row per video (keep the highest view count,
// i.e. the most recent snapshot) before scoring. Score is a lightweight analogue
// of the Instagram one: views 40, engagement-rate 40, full-watched-rate 20.
function scoreTikTok(rows) {
  const byId = new Map();
  for (const r of rows || []) {
    const id = r.video_id;
    if (!id) continue;
    const prev = byId.get(id);
    const views = r.video_views_count || 0;
    if (!prev || views >= (prev.video_views_count || 0)) byId.set(id, r);
  }
  const videos = [...byId.values()].map((v) => {
    const views = v.video_views_count || 0;
    const likes = v.video_likes || 0;
    const comments = v.video_comments || 0;
    const shares = v.video_shares || 0;
    const engagement = likes + comments + shares;
    return {
      ...v,
      engagement,
      engagement_rate: Math.round(safeDiv(engagement, views) * 10000) / 10000,
      like_rate: Math.round(safeDiv(likes, views) * 10000) / 10000,
    };
  });

  const viewsPct = percentileRanks(videos.map((v) => v.video_views_count || 0));
  const engPct = percentileRanks(videos.map((v) => v.engagement_rate));
  const fullPct = percentileRanks(videos.map((v) => v.video_full_watched_rate || 0));

  return videos
    .map((v, i) => {
      const views_pct = Math.round(viewsPct[i] * 100) / 100;
      const engagement_rate_pct = Math.round(engPct[i] * 100) / 100;
      const full_watched_pct = Math.round(fullPct[i] * 100) / 100;
      const score =
        Math.round((views_pct * 40 + engagement_rate_pct * 40 + full_watched_pct * 20) * 10) / 10;
      return { ...v, views_pct, engagement_rate_pct, full_watched_pct, score };
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = { percentileRanks, scorePosts, scoreTikTok, groupIntoWeeks, isoWeekLabel, buildCrossPlatform };
