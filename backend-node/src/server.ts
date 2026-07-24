import http from 'http'
import { createApp } from './app'
import { initRealtime } from './realtime/socket'
import { env } from './config/env'

const app = createApp()
const server = http.createServer(app)

initRealtime(server)

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`samaChauffeur API listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`)
})
