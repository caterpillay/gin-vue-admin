import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
import test from 'node:test'
import { decodeMessage, encodeMessage, startRpcServer } from '../lib/rpc.js'

function request(path, value) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path)
    let text = ''
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write(encodeMessage(value)))
    socket.on('data', chunk => { text += chunk })
    socket.on('end', () => resolve(decodeMessage(text.trim())))
    socket.on('error', reject)
  })
}

test('private RPC server returns results and isolates handler failures', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lt-team-rpc-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'rpc.sock')
  const stop = await startRpcServer(path, input => {
    if (input.fail) throw new Error('planned failure')
    return { echo: input.value }
  })
  t.after(stop)
  assert.deepEqual(await request(path, { value: 42 }), { ok: true, result: { echo: 42 } })
  assert.deepEqual(await request(path, { fail: true }), { ok: false, error: 'planned failure' })
})
