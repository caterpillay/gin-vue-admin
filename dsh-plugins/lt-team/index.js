import s from '@deepseek-ai/schemastery'
import { DEFAULT_ROLES, defaultStateDir, normalizeConfig } from './lib/config.js'
import { installCliEnvironment } from './lib/environment.js'
import { bindWorkerSkill, RoleManager } from './lib/roles.js'
import { startRpcServer } from './lib/rpc.js'

const RoleConfig = s.object({
  id: s.string().description('Stable lowercase role id.'),
  kind: s.string().description('product-manager, qa, or programmer.'),
  name: s.string().description('Display name.'),
  responsibility: s.string().description('The business responsibility this permanent role owns.'),
  repository: s.string().default('').description('Repository label owned by a programmer role, such as rank or api.'),
  writeRoot: s.string().default('').description('Reserved absolute writable repository path; keep empty until isolation is enabled.'),
  readRoots: s.array(s.string()).default([]).description('Absolute repository roots this read-only role may inspect.'),
})

export const Config = s.object({
  stateDir: s.string().default(defaultStateDir()).description('Persistent lt-team state; defaults beside dsh-superagent state.'),
  agentPreset: s.string().default('dsh-superagent-worker').description('DSH preset used to create role Sessions.'),
  roles: s.array(RoleConfig).default(DEFAULT_ROLES.map(role => ({ ...role, readRoots: [] }))).description('Fixed permanent roles.'),
  shortMemoryDays: s.number().min(1).max(365).step(1).default(14).description('Default TTL of short-memory entries.'),
  maxMemoryEntries: s.number().min(10).max(5000).step(1).default(200).description('Maximum entries per memory class and role.'),
  maxRequestChars: s.number().min(1000).max(500000).step(1).default(100000).description('Maximum characters in one role request.'),
})

export const name = 'lt-team'
export const inject = ['agents', 'sessionController', 'sessionPersistence', 'permissionPresets', 'tools', 'systemPrompt', 'skills']

export async function apply(ctx, rawConfig) {
  if (process.platform === 'win32') throw new Error('lt-team 0.1 uses a private Unix-domain socket and does not yet support Windows')
  const config = normalizeConfig(rawConfig)
  const manager = new RoleManager(ctx, config)
  const workerSkills = new Map()
  const bind = async agent => {
    if (!agent.id.startsWith('worker-') || workerSkills.has(agent)) return
    workerSkills.set(agent, await bindWorkerSkill(agent, config.cliPath))
  }
  const created = ctx.on('agent/created', async ({ agent }) => { await bind(agent); return undefined })
  const disposed = ctx.on('agent/disposed', ({ agent }) => {
    void workerSkills.get(agent)?.()
    workerSkills.delete(agent)
  })

  let restoreEnvironment = () => {}
  let stopRpc = async () => {}
  try {
    restoreEnvironment = await installCliEnvironment(config)
    await manager.start()
    for (const agent of ctx.agents.list()) await bind(agent)
    stopRpc = await startRpcServer(config.socketPath, request => {
      if (request.command === 'roles') return manager.list()
      if (request.command === 'ask') return manager.ask(String(request.role ?? ''), String(request.requestId ?? ''), String(request.task ?? ''))
      throw new Error('lt-team command must be roles or ask')
    })
  } catch (error) {
    created(); disposed(); await manager.dispose(); restoreEnvironment()
    await stopRpc().catch(() => {})
    throw error
  }

  ctx.effect(() => async () => {
    await stopRpc()
    restoreEnvironment()
    created(); disposed()
    await Promise.allSettled([...workerSkills.values()].map(dispose => dispose()))
    workerSkills.clear()
    await manager.dispose()
  })
}

export { normalizeConfig } from './lib/config.js'
export { MemoryStore, renderMemorySkills } from './lib/memory.js'
export { accessGuard, canRead, isWithin } from './lib/access.js'
