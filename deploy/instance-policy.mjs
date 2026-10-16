const instanceNames = new Set(['sink-brand', 'sink-marketing'])

/** Fail closed before migrations or uploads can touch any remote resource. */
export function applyInstancePolicy(config, env) {
  const name = env.DEPLOY_WORKER_NAME
  if (!instanceNames.has(name))
    throw new Error('DEPLOY_WORKER_NAME must be sink-brand or sink-marketing')
  if (!/^[a-f0-9]{32}$/.test(env.DEPLOY_CF_ACCOUNT_ID ?? ''))
    throw new Error('DEPLOY_CF_ACCOUNT_ID must explicitly select the verified Cloudflare account')
  if (env.DEPLOY_D1_DATABASE_NAME !== `${name}-db`)
    throw new Error('D1 database name does not match the selected instance')
  if (env.DEPLOY_ANALYTICS_DATASET !== name.replaceAll('-', '_'))
    throw new Error('Analytics dataset does not match the selected instance')
  if (env.DEPLOY_R2_BUCKET_NAME && env.DEPLOY_R2_BUCKET_NAME !== `${name}-backup`)
    throw new Error('R2 bucket name does not match the selected instance')
  if (config.routes?.length || config.route)
    throw new Error('Production domain routes require a separately reviewed configuration')
  if (config.env && Object.keys(config.env).length)
    throw new Error('Nested Wrangler environments are not supported by this deployment policy')

  config.account_id = env.DEPLOY_CF_ACCOUNT_ID
  config.name = name
  config.workers_dev = true
  config.preview_urls = false
  // AI remains opt-in; deploying a binding must not silently enable paid inference.
  if (env.DEPLOY_ENABLE_AI !== 'true')
    delete config.ai
  config.ratelimits = [{
    name: 'LINK_WRITE_LIMITER',
    namespace_id: name === 'sink-brand' ? '2026101501' : '2026101502',
    simple: { limit: 120, period: 60 },
  }]
  config.observability = {
    enabled: true,
    head_sampling_rate: 1,
    logs: { enabled: true, head_sampling_rate: 1, invocation_logs: false, persist: true },
    traces: { enabled: false },
  }
  config.vars = {
    ...config.vars,
    NUXT_DATASET: env.DEPLOY_ANALYTICS_DATASET,
    NUXT_REQUIRE_WRITE_RATE_LIMIT: 'true',
  }
  return config
}
