import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { asyncHandler } from '../../utils/asyncHandler'
import { authenticate, isSelfOrAdmin, requireAdmin } from '../../middleware/auth'
import { signAccessToken, signRefreshToken, validateRefreshToken, verifyRefreshTokenSignature, revokeRefreshToken } from '../../lib/jwt'
import { generateOtp, getSmsProvider } from './sms'

const router = Router()

// ---------- serializers (mirrors accounts/serializers.py) ----------

function toUserPublic(user: any) {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    role: user.role,
    language: user.language,
    phone_verified: user.phoneVerified,
  }
}

// ---------- POST /register/ ----------

const registerSchema = z.object({
  username: z.string().min(1),
  phone: z.string().min(1).max(20),
  password: z.string().min(1),
  role: z.enum(['CLIENT', 'CHAUFFEUR', 'ADMIN']).optional().default('CLIENT'),
  language: z.enum(['fr', 'wo']).optional().default('fr'),
})

router.post(
  '/register/',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data

    // Public registration endpoint must not allow creation of ADMIN users
    if (data.role === 'ADMIN') {
      return res.status(400).json({ role: ['Cannot assign ADMIN role during registration.'] })
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ phone: data.phone }, { username: data.username }] } })
    if (existing) {
      return res.status(400).json({ detail: 'A user with that phone or username already exists.' })
    }

    const hashed = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({
      data: {
        username: data.username,
        phone: data.phone,
        password: hashed,
        role: data.role,
        language: data.language,
      },
    })
    return res.status(201).json({ id: user.id, phone: user.phone })
  }),
)

// ---------- GET/PATCH /me/ ----------

router.get(
  '/me/',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    return res.json(toUserPublic(user))
  }),
)

const meUpdateSchema = z.object({
  username: z.string().min(1).optional(),
  language: z.enum(['fr', 'wo']).optional(),
})

router.patch(
  '/me/',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = meUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data })
    return res.json(toUserPublic(user))
  }),
)

// ---------- POST /token/ (login by phone + password) ----------

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
})

router.post(
  '/token/',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const { phone, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ detail: 'No active account found with the given credentials' })
    }

    const access = signAccessToken(user)
    const refresh = await signRefreshToken(user)
    return res.json({ access, refresh, role: user.role, phone: user.phone, username: user.username })
  }),
)

// ---------- POST /token/refresh/ ----------

const refreshSchema = z.object({ refresh: z.string().min(1) })

router.post(
  '/token/refresh/',
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    try {
      const { payload } = await validateRefreshToken(parsed.data.refresh)
      const user = await prisma.user.findUnique({ where: { id: payload.user_id } })
      if (!user) return res.status(401).json({ detail: 'User not found' })

      // rotate: revoke old, issue new (mirrors ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION)
      await revokeRefreshToken(payload.jti)
      const access = signAccessToken(user)
      const newRefresh = await signRefreshToken(user)
      return res.json({ access, refresh: newRefresh })
    } catch {
      return res.status(401).json({ detail: 'Token is invalid or expired' })
    }
  }),
)

// ---------- POST /logout/ ----------

router.post(
  '/logout/',
  authenticate,
  asyncHandler(async (req, res) => {
    const refresh = req.body?.refresh
    if (!refresh) return res.status(400).json({ detail: 'Refresh token required.' })
    try {
      const payload = verifyRefreshTokenSignature(refresh)
      await revokeRefreshToken(payload.jti)
      return res.status(205).end()
    } catch {
      return res.status(400).json({ detail: 'Invalid token.' })
    }
  }),
)

// ---------- POST /otp/send/ ----------

const otpSendSchema = z.object({ phone: z.string().min(1).max(20) })

router.post(
  '/otp/send/',
  asyncHandler(async (req, res) => {
    const parsed = otpSendSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const { phone } = parsed.data

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) return res.status(400).json({ detail: 'User not found. Register first.' })
    if (user.phoneVerified) return res.status(400).json({ detail: 'Phone already verified.' })

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await prisma.otp.create({ data: { phone, code, expiresAt } })

    const provider = getSmsProvider()
    await provider.send(phone, `Your SamaChauffeur OTP code is: ${code}`)

    return res.json({ detail: 'OTP sent' })
  }),
)

// ---------- POST /otp/verify/ ----------

const otpVerifySchema = z.object({ phone: z.string().min(1).max(20), code: z.string().min(1).max(6) })

router.post(
  '/otp/verify/',
  asyncHandler(async (req, res) => {
    const parsed = otpVerifySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const { phone, code } = parsed.data

    const otp = await prisma.otp.findFirst({
      where: { phone, isUsed: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) return res.status(400).json({ detail: 'No OTP found' })

    if (otp.code !== code) {
      await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      return res.status(400).json({ detail: 'Invalid code' })
    }

    if (otp.expiresAt < new Date()) {
      return res.status(400).json({ detail: 'OTP expired' })
    }

    await prisma.otp.update({ where: { id: otp.id }, data: { isUsed: true } })

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) return res.status(400).json({ detail: 'User not found. Register first.' })

    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } })

    return res.json({ detail: 'Phone verified' })
  }),
)

// ---------- GET/POST /users/  (admin) ----------

const adminUserSchema = z.object({
  username: z.string().min(1),
  phone: z.string().min(1).max(20),
  password: z.string().optional(),
  role: z.enum(['CLIENT', 'CHAUFFEUR', 'ADMIN']).optional().default('CLIENT'),
  language: z.enum(['fr', 'wo']).optional().default('fr'),
})

router.get(
  '/users/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
    return res.json(users.map(toUserPublic))
  }),
)

router.post(
  '/users/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data = parsed.data
    const hashed = data.password ? await bcrypt.hash(data.password, 10) : await bcrypt.hash(crypto.randomUUID(), 10)
    const user = await prisma.user.create({
      data: { username: data.username, phone: data.phone, password: hashed, role: data.role, language: data.language },
    })
    return res.status(201).json(toUserPublic(user))
  }),
)

// ---------- GET/PATCH/DELETE /users/:pk/ ----------

router.get(
  '/users/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    if (!isSelfOrAdmin(req, pk)) return res.status(403).json({ detail: 'Forbidden' })
    const user = await prisma.user.findUnique({ where: { id: pk } })
    if (!user) return res.status(404).json({ detail: 'Not found' })
    return res.json(toUserPublic(user))
  }),
)

const adminUserUpdateSchema = adminUserSchema.partial()

router.patch(
  '/users/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    if (!isSelfOrAdmin(req, pk)) return res.status(403).json({ detail: 'Forbidden' })
    const parsed = adminUserUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json(parsed.error.flatten())
    const data: any = { ...parsed.data }
    if (data.password) data.password = await bcrypt.hash(data.password, 10)
    else delete data.password
    const user = await prisma.user.update({ where: { id: pk }, data })
    return res.json(toUserPublic(user))
  }),
)

router.delete(
  '/users/:pk/',
  authenticate,
  asyncHandler(async (req, res) => {
    const pk = parseInt(req.params.pk, 10)
    if (!req.user!.isStaff && req.user!.role !== 'ADMIN') return res.status(403).json({ detail: 'Admin only' })
    await prisma.user.delete({ where: { id: pk } })
    return res.status(204).end()
  }),
)

export default router
