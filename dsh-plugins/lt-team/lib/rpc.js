import { chmod, lstat, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import net from 'node:net'

export function encodeMessage(value) { return `${JSON.stringify(value)}\n` }

export function decodeMessage(line) {
  const value = JSON.parse(line)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('lt-team request must be a JSON object')
  return value
}

async function removeStaleSocket(path) {
  try {
    const stat = await lstat(path)
    if (!stat.isSocket()) throw new Error(`lt-team refuses to replace non-socket path ${path}`)
    await unlink(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export async function startRpcServer(path, handler, options = {}) {
  const maxBytes = options.maxBytes ?? 1_048_576
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await removeStaleSocket(path)
  const sockets = new Set()
  const server = net.createServer(socket => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    let buffered = Buffer.alloc(0)
    let handled = false
    const reply = value => { if (!socket.destroyed) socket.end(encodeMessage(value)) }
    socket.on('data', chunk => {
      if (handled) return
      buffered = Buffer.concat([buffered, chunk])
      if (buffered.length > maxBytes) { handled = true; reply({ ok: false, error: `request exceeds ${maxBytes} bytes` }); return }
      const newline = buffered.indexOf(10)
      if (newline < 0) return
      handled = true
      Promise.resolve().then(() => handler(decodeMessage(buffered.subarray(0, newline).toString('utf8'))))
        .then(result => reply({ ok: true, result }), error => reply({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    })
    socket.on('error', () => {})
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(path, () => { server.off('error', reject); resolve() })
  })
  await chmod(path, 0o600)
  let closed = false
  return async () => {
    if (closed) return
    closed = true
    for (const socket of sockets) socket.destroy(new Error('lt-team is stopping'))
    await new Promise(resolve => server.close(resolve))
    await removeStaleSocket(path)
  }
}
