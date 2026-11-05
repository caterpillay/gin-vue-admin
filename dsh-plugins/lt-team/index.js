import s from '@deepseek-ai/schemastery'
import { DEFAULT_ROLES, defaultStateDir, normalizeConfig } from './lib/config.js'
import { RoleDecorator } from './lib/roles.js'

const RoleConfig = s.object({
  id: s.string().description('Stable lowercase role id matching the dsh-superagent core catalog.'),
  kind: s.string().description('product-manager, qa, or programmer.'),
  name: s.string().description('Display name.'),
  responsibility: s.string().description('The business responsibility this permanent role owns.'),
  repository: s.string().default('').description('Repository label owned by a programmer role, such as rank or api.'),
  writeRoot: s.string().default('').description('Reserved writable repository path; keep empty until write isolation is enabled.'),
  readRoots: s.array(s.string()).default([]).description('Absolute read-only repository roots. Relative paths are refused.'),
})

export const Config = s.object({
  stateDir: s.string().default(defaultStateDir()).description('Persistent lt-team memory state; defaults beside dsh-superagent state.'),
  roles: s.array(RoleConfig).default(DEFAULT_ROLES.map(role => ({ ...role, readRoots: [] }))).description('Fixed core-managed role Sessions to decorate.'),
  shortMemoryDays: s.number().min(1).max(365).step(1).default(14).description('Default TTL of short-memory entries.'),
  maxMemoryEntries: s.number().min(10).max(5000).step(1).default(200).description('Maximum entries per memory class and role.'),
})

export const name = 'lt-team'
export const inject = ['agents', 'tools', 'systemPrompt', 'skills']

export async function apply(ctx, rawConfig) {
  const decorator = new RoleDecorator(ctx, normalizeConfig(rawConfig))
  try { await decorator.start() }
  catch (error) { decorator.dispose(); throw error }
  ctx.effect(() => () => decorator.dispose())
}

export { normalizeConfig } from './lib/config.js'
export { MemoryStore, renderMemorySkills } from './lib/memory.js'
export { accessGuard, canRead, isWithin } from './lib/access.js'
