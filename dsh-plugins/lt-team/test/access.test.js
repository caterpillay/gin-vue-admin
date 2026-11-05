import assert from 'node:assert/strict'
import test from 'node:test'
import { accessGuard, canRead, isWithin } from '../lib/access.js'

const role = { id: 'qa', workspace: '/state/roles/qa/workspace', readRoots: ['/repos/rank', '/repos/api'] }

test('read scopes include only role workspace and configured repositories', () => {
  assert.equal(isWithin('/repos/rank/src/file.go', '/repos/rank'), true)
  assert.equal(isWithin('/repos/ranking/file.go', '/repos/rank'), false)
  assert.equal(canRead(role, '/repos/api/tests/api_test.go'), true)
  assert.equal(canRead(role, 'notes/context.md'), true)
  assert.equal(canRead(role, '/repos/other/secret.txt'), false)
})

test('tool guard denies reads outside configured roots', () => {
  const guard = accessGuard(role)
  assert.equal(guard({ name: 'read', arguments: { file_path: '/repos/rank/README.md' } }), undefined)
  assert.match(guard({ name: 'grep', arguments: { path: '/repos/other' } }), /outside/)
  assert.equal(guard({ name: 'skill', arguments: { name: 'memory' } }), undefined)
})
