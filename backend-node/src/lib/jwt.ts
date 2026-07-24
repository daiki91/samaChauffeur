import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import ms from 'ms'
import { env } from '../config/env'
import prisma from './prisma'

export type AccessTokenPayload = {
  user_id: number
  role: string
  phone: string
  username: string
}

export type RefreshTokenPayload = {
  user_id: number
  jti: string
}

export function signAccessToken(user: { id: number; role: string; phone: string; username: string }) {
  const payload: AccessTokenPayload = {
    user_id: user.id,
    role: user.role,
    phone: user.phone,
    username: user.username,
  }
  return jwt.sign(payload, env.accessTokenSecret, { expiresIn: env.accessTokenTtl as any })
}

export async function signRefreshToken(user: { id: number }) {
  const jti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + ms(env.refreshTokenTtl))
  await prisma.refreshToken.create({
    data: { jti, userId: user.id, expiresAt },
  })
  const payload: RefreshTokenPayload = { user_id: user.id, jti }
  return jwt.sign(payload, env.refreshTokenSecret, { expiresIn: env.refreshTokenTtl as any })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.accessTokenSecret) as AccessTokenPayload
}

export function verifyRefreshTokenSignature(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.refreshTokenSecret) as RefreshTokenPayload
}

/** Validate a refresh token against the DB (must exist, not revoked, not expired). */
export async function validateRefreshToken(token: string) {
  const payload = verifyRefreshTokenSignature(token)
  const record = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } })
  if (!record || record.revoked || record.expiresAt < new Date()) {
    throw new Error('Invalid or revoked refresh token')
  }
  return { payload, record }
}

/** Revoke (blacklist) a refresh token by its jti. */
export async function revokeRefreshToken(jti: string) {
  await prisma.refreshToken.updateMany({ where: { jti }, data: { revoked: true } })
}
