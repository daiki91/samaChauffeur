import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt'
import prisma from '../lib/prisma'

export type AuthUser = {
  id: number
  username: string
  phone: string
  role: 'CLIENT' | 'CHAUFFEUR' | 'ADMIN'
  language: string
  phoneVerified: boolean
  isStaff: boolean
  isActive: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/** Equivalent to DRF's IsAuthenticated + JWTAuthentication: requires a valid Bearer access token. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Authentication credentials were not provided.' })
    }
    const token = header.slice('Bearer '.length)
    let decoded
    try {
      decoded = verifyAccessToken(token)
    } catch {
      return res.status(401).json({ detail: 'Invalid or expired token.' })
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.user_id } })
    if (!user || !user.isActive) {
      return res.status(401).json({ detail: 'User not found or inactive.' })
    }
    req.user = {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role,
      language: user.language,
      phoneVerified: user.phoneVerified,
      isStaff: user.isStaff,
      isActive: user.isActive,
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Optional auth: attaches req.user if a valid token is present, otherwise continues anonymously. */
export async function authenticateOptional(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return next()
  try {
    const decoded = verifyAccessToken(header.slice('Bearer '.length))
    const user = await prisma.user.findUnique({ where: { id: decoded.user_id } })
    if (user && user.isActive) {
      req.user = {
        id: user.id,
        username: user.username,
        phone: user.phone,
        role: user.role,
        language: user.language,
        phoneVerified: user.phoneVerified,
        isStaff: user.isStaff,
        isActive: user.isActive,
      }
    }
  } catch {
    // ignore invalid token, stay anonymous
  }
  next()
}

/** Mirrors accounts.permissions.RolePermission: is_staff always passes, otherwise role must be in allowedRoles. */
export function requireRole(...allowedRoles: Array<'CLIENT' | 'CHAUFFEUR' | 'ADMIN'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return res.status(401).json({ detail: 'Authentication credentials were not provided.' })
    if (user.isStaff) return next()
    if (allowedRoles.includes(user.role)) return next()
    return res.status(403).json({ detail: 'You do not have permission to perform this action.' })
  }
}

export const requireAdmin = requireRole('ADMIN')
export const requireChauffeur = requireRole('CHAUFFEUR')
export const requireClient = requireRole('CLIENT')

/** Mirrors accounts.permissions.IsSelfOrAdmin for a given target user id. */
export function isSelfOrAdmin(req: Request, targetUserId: number): boolean {
  const user = req.user
  if (!user) return false
  if (user.isStaff || user.role === 'ADMIN') return true
  return user.id === targetUserId
}
