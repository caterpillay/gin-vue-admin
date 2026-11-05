import { realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

const READ_PATH = new Map([
  ['read', 'file_path'],
  ['read_image', 'file_path'],
  ['glob', 'path'],
  ['grep', 'path'],
])

export const ROLE_TOOLS = Object.freeze([
  'read', 'read_image', 'glob', 'grep', 'web_search', 'web_fetch', 'skill',
  'lt_team_memory_list', 'lt_team_memory_add', 'lt_team_memory_promote', 'lt_team_memory_forget',
])

function canonical(path) {
  const absolute = resolve(path)
  try { return realpathSync.native(absolute) } catch { return absolute }
}

export function isWithin(path, root) {
  const child = canonical(path)
  const parent = canonical(root)
  const rest = relative(parent, child)
  return rest === '' || (!rest.startsWith('..') && !rest.includes(`..${process.platform === 'win32' ? '\\' : '/'}`))
}

export function canRead(role, path) {
  if (!isAbsolute(path)) return false
  return role.readRoots.some(root => isWithin(path, root))
}

export function accessGuard(role) {
  return ({ name, arguments: input }) => {
    const field = READ_PATH.get(name)
    if (!field) return undefined
    const args = input && typeof input === 'object' ? input : {}
    const value = args[field]
    const path = typeof value === 'string' && value.trim() ? value : role.workspace
    return canRead(role, path) ? undefined
      : `lt-team role ${role.id} may read only its configured repository roots; ${path} is outside them`
  }
}
