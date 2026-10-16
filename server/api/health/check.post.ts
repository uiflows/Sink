import { runHealthMonitor } from '../../../monitoring/health'

export default eventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.healthMonitoring)
    throw createError({ statusCode: 409, statusMessage: 'Health monitoring is not configured' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await runHealthMonitor(event.context.cloudflare.env, config)
})
