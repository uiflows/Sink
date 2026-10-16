import { readHealthState } from '../../../monitoring/health'

export default eventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const state = await readHealthState(event.context.cloudflare.env)
  return { configured: !!useRuntimeConfig(event).healthMonitoring, stale: !state || Date.now() - Date.parse(state.checkedAt) > 30 * 60_000, state }
})
