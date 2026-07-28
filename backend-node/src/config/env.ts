import dotenv from 'dotenv'
dotenv.config()

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing environment variable: ${name}`)
    return ''
  }
  return v
}

export const env = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseProjectRef: required('SUPABASE_PROJECT_REF'),
  supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  supabaseJwksUrl: required('SUPABASE_JWKS_URL'),

  accessTokenSecret: required('ACCESS_TOKEN_SECRET', 'dev-access-secret'),
  refreshTokenSecret: required('REFRESH_TOKEN_SECRET', 'dev-refresh-secret'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '60m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
}
