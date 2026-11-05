import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

export const DEFAULT_ROLES = Object.freeze([
  Object.freeze({
    id: 'product-manager',
    kind: 'product-manager',
    name: '产品经理',
    responsibility: '负责 rank、api 相关需求澄清、范围与优先级、验收标准和跨业务协调。',
    readRoots: Object.freeze([]),
  }),
  Object.freeze({
    id: 'qa',
    kind: 'qa',
    name: 'QA',
    responsibility: '负责 rank、api 相关测试策略、回归范围、发布风险和验收验证。',
    repository: '',
    writeRoot: '',
    readRoots: Object.freeze([]),
  }),
  Object.freeze({
    id: 'rank-programmer',
    kind: 'programmer',
    name: 'rank 程序员',
    responsibility: '负责 rank 仓库的实现方案、代码变更建议和技术问题处理。',
    repository: 'rank',
    writeRoot: '',
    readRoots: Object.freeze([]),
  }),
  Object.freeze({
    id: 'api-programmer',
    kind: 'programmer',
    name: 'api 程序员',
    responsibility: '负责 api 仓库的实现方案、代码变更建议和技术问题处理。',
    repository: 'api',
    writeRoot: '',
    readRoots: Object.freeze([]),
  }),
])

const ROLE_ID = /^[a-z][a-z0-9-]{1,31}$/
const ROLE_KINDS = new Set(['product-manager', 'qa', 'programmer'])
const CORE_ROLES = new Map(DEFAULT_ROLES.map(role => [role.id, { kind: role.kind, repository: String(role.repository ?? '') }]))

export function defaultStateDir(env = process.env) {
  const home = env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(home, 'state', 'superagent')
}

function requiredText(value, field) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`lt-team ${field} must not be empty`)
  return text
}

function absolutePath(value, field) {
  const text = requiredText(value, field)
  if (!isAbsolute(text)) throw new Error(`lt-team ${field} must be an absolute path`)
  return resolve(text)
}

function normalizeRole(input, stateDir) {
  const id = requiredText(input.id, 'role id')
  if (!ROLE_ID.test(id)) throw new Error(`lt-team role id ${id} must match ${ROLE_ID}`)
  const kind = requiredText(input.kind, `role ${id} kind`)
  if (!ROLE_KINDS.has(kind)) throw new Error(`lt-team role ${id} kind must be product-manager, qa, or programmer`)
  const repository = String(input.repository ?? '').trim()
  if (kind === 'programmer' && !repository) throw new Error(`lt-team programmer role ${id} must name its repository`)
  const writeRoot = String(input.writeRoot ?? '').trim()
  if (writeRoot) throw new Error(`lt-team role ${id} writeRoot must stay empty until programmer repository isolation is enabled`)
  const roots = [...new Set((input.readRoots ?? []).map((item, index) => absolutePath(item, `role ${id} readRoots[${index}]`)))]
  const roleDir = join(stateDir, 'lt-team', 'roles', id)
  return {
    id,
    kind,
    name: requiredText(input.name, `role ${id} name`),
    responsibility: requiredText(input.responsibility, `role ${id} responsibility`),
    repository,
    writeRoot,
    readRoots: roots,
    roleDir,
    memoryFile: join(roleDir, 'memory.json'),
    sessionId: `worker-${id}`,
  }
}

export function normalizeConfig(input = {}, env = process.env) {
  const stateDir = absolutePath(input.stateDir || defaultStateDir(env), 'stateDir')
  const roles = (input.roles?.length ? input.roles : DEFAULT_ROLES).map(role => normalizeRole(role, stateDir))
  const ids = new Set()
  for (const role of roles) {
    if (ids.has(role.id)) throw new Error(`lt-team role id ${role.id} is duplicated`)
    ids.add(role.id)
  }
  const expectedIds = [...CORE_ROLES.keys()]
  if (roles.length !== expectedIds.length || expectedIds.some(id => !ids.has(id))) {
    throw new Error(`lt-team roles must contain exactly: ${expectedIds.join(', ')}`)
  }
  for (const role of roles) {
    const expected = CORE_ROLES.get(role.id)
    if (!expected || role.kind !== expected.kind || role.repository !== expected.repository) {
      throw new Error(`lt-team role ${role.id} must match the fixed core role kind and repository`)
    }
  }
  return {
    stateDir,
    roles,
    shortMemoryDays: Number.isInteger(input.shortMemoryDays) && input.shortMemoryDays > 0 ? input.shortMemoryDays : 14,
    maxMemoryEntries: Number.isInteger(input.maxMemoryEntries) && input.maxMemoryEntries >= 10 ? input.maxMemoryEntries : 200,
  }
}
