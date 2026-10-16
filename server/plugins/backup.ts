/// <reference path="../../worker-configuration.d.ts" />

import { BACKUP_CRON } from '../../monitoring/health'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (event) => {
    if (event.controller.cron !== BACKUP_CRON)
      return

    const config = useRuntimeConfig()

    if (config.disableAutoBackup) {
      console.info('[backup] Auto backup is disabled by configuration')
      return
    }

    const env = event.env as Cloudflare.Env
    try {
      const result = await backupLinksToR2(env)
      if (!result.completed)
        throw new Error('Backup did not complete')
    }
    catch {
      console.error({ event: 'backup.scheduled.failed' })
      throw new Error('Scheduled backup failed')
    }
  })
})
