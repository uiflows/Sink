import { HEALTH_CRONS, runHealthMonitor } from '../../monitoring/health'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const config = useRuntimeConfig()
    if (!config.healthMonitoring || !HEALTH_CRONS.includes(controller.cron))
      return
    try {
      await runHealthMonitor(env as Cloudflare.Env, config)
    }
    catch {
      console.error({ event: 'health.execution.failed' })
      throw new Error('Health monitoring failed')
    }
  })
})
