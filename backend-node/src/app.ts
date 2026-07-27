import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env'

import authRoutes from './modules/auth/auth.routes'
import chauffeursRoutes from './modules/chauffeurs/chauffeurs.routes'
import tripsRoutes from './modules/trips/trips.routes'
import pricingRoutes from './modules/pricing/pricing.routes'
import clientsRoutes from './modules/clients/clients.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import garesRoutes from './modules/gares/gares.routes'
import ticketsRoutes from './modules/tickets/tickets.routes'

export function createApp() {
  const app = express()

  app.use(cors({ origin: env.corsOrigin, credentials: true }))
  app.use(express.json({ limit: '5mb' }))
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // Same URL prefixes as the original Django config/urls.py
  app.use('/api/auth', authRoutes)
  app.use('/api/chauffeurs', chauffeursRoutes)
  app.use('/api/trips', tripsRoutes)
  app.use('/api/pricing', pricingRoutes)
  app.use('/api/clients', clientsRoutes)
  app.use('/api/payments', paymentsRoutes)
  app.use('/api/gares', garesRoutes)
  app.use('/api/tickets', ticketsRoutes)

  app.use((req, res) => res.status(404).json({ detail: 'Not found' }))

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err)
    if (err?.name === 'ZodError') return res.status(400).json(err.flatten())
    res.status(err?.status || 500).json({ detail: err?.message || 'Internal server error' })
  })

  return app
}
