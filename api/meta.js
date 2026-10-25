// Pauta de Meta Ads en vivo para el dashboard.
//
// Variables de entorno en Vercel:
//   META_ACCESS_TOKEN   token con permiso ads_read (idealmente de un usuario del sistema)
//   META_AD_ACCOUNT_ID  opcional; por defecto la cuenta "Costa Reset"
//
// Devuelve las campañas de la cuenta y sus métricas por día de los últimos 90 días.
// El navegador filtra qué campañas son de cada proyecto (por prefijo del nombre).

const GRAPH = 'https://graph.facebook.com/v21.0';
const DEFAULT_ACCOUNT = '1356376906306947';

async function getAll(url) {
  const out = [];
  let next = url;
  for (let page = 0; next && page < 20; page++) {
    const res = await fetch(next);
    const body = await res.json();
    if (!res.ok) throw new Error((body.error && body.error.message) || `Meta respondió ${res.status}`);
    out.push(...(body.data || []));
    next = body.paging && body.paging.next;
  }
  return out;
}

const toActions = (...lists) => {
  const map = {};
  lists.flat().filter(Boolean).forEach((a) => { map[a.action_type] = (map[a.action_type] || 0) + Number(a.value || 0); });
  return map;
};

module.exports = async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'Falta configurar META_ACCESS_TOKEN en Vercel.' });
    return;
  }
  const account = `act_${process.env.META_AD_ACCOUNT_ID || DEFAULT_ACCOUNT}`;
  const auth = `access_token=${encodeURIComponent(token)}`;

  try {
    const [info, campaigns, insights] = await Promise.all([
      fetch(`${GRAPH}/${account}?fields=currency&${auth}`).then((r) => r.json()),
      getAll(`${GRAPH}/${account}/campaigns?fields=id,name,effective_status,start_time&limit=200&${auth}`),
      getAll(`${GRAPH}/${account}/insights?level=campaign&time_increment=1&date_preset=last_90d`
        + `&fields=campaign_id,spend,impressions,inline_link_clicks,actions,conversions&limit=500&${auth}`),
    ]);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      currency: info.currency || null,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.effective_status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
        start: (c.start_time || '').slice(0, 10),
      })),
      daily: insights.map((r) => ({
        date: r.date_start,
        campaignId: r.campaign_id,
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.inline_link_clicks || 0),
        actions: toActions(r.actions, r.conversions),
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
