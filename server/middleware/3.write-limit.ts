import { enforceWriteRateLimit } from '../utils/write-rate-limit'

export default eventHandler(async (event) => {
  if (event.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(event.method))
    await enforceWriteRateLimit(event)
})
