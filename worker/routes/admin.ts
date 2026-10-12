import { extractBearerToken } from '../middleware/auth'
import { iconAuthReceipt } from '../lib/iconCopyMetadata'
import { Hono } from 'hono'
import { ErrCode } from '../../shared/types'
import { getAdminData } from '../lib/db'
import { fail, ok } from '../lib/response'
import type { HonoEnv } from '../types'

export const adminRoutes = new Hono<HonoEnv>()

// 不再有 isolate 内的短 TTL 聚合缓存：前端每次请求都带 no-cache 绕过它，缓存从未被读到，
// 却要求每个写路由记得失效。后台聚合始终直读一次 D1 batch。
adminRoutes.get('/data', async (c) => {
  try {
    const receipt = await iconAuthReceipt(extractBearerToken(c.req.header('Authorization'))!, c.get('sessionExpiresAt'))
    const data = await getAdminData(c.env.DB)
    return c.json(ok({ ...data, auth_receipt: receipt }), 200, {
      'Cache-Control': 'no-store',
    })
  } catch {
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to load admin data'))
  }
})

export default adminRoutes
