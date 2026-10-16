import { HEALTH_CRONS, runHealthMonitor, scheduledHealthSettings } from '../../monitoring/health'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const settings = scheduledHealthSettings(env as Record<string, unknown>, useRuntimeConfig())
    if (!settings.enabled || !HEALTH_CRONS.includes(controller.cron))
      return
    try {
      await runHealthMonitor(env as Cloudflare.Env, settings.config)
    }
    catch {
      console.error({ event: 'health.execution.failed' })
      throw new Error('Health monitoring failed')
    }
  })
})
