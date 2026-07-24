import { env } from '../../config/env'

export interface SmsProvider {
  send(phone: string, message: string): Promise<any>
}

export class DevStubProvider implements SmsProvider {
  async send(phone: string, message: string) {
    // eslint-disable-next-line no-console
    console.log(`[SMS-STUB] To=${phone} Message=${message}`)
    return { status: 'sent', id: `dev-${Date.now()}` }
  }
}

export class TwilioProvider implements SmsProvider {
  constructor(private accountSid: string, private authToken: string, private fromNumber: string) {}

  async send(phone: string, message: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
    const body = new URLSearchParams({ From: this.fromNumber, To: phone, Body: message })
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body,
    })
    if (!resp.ok) throw new Error(`Twilio error: ${resp.status} ${await resp.text()}`)
    return resp.json()
  }
}

export function getSmsProvider(): SmsProvider {
  const { accountSid, authToken, fromNumber } = env.twilio
  if (accountSid && authToken && fromNumber) {
    try {
      return new TwilioProvider(accountSid, authToken, fromNumber)
    } catch {
      return new DevStubProvider()
    }
  }
  return new DevStubProvider()
}

export function generateOtp(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10).toString()
  return code
}
