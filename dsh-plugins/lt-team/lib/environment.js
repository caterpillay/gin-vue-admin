import { mkdir, rename, writeFile } from 'node:fs/promises'
import { delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKER = '# Written by lt-team; edits are replaced while the plugin is active.'
const quote = value => `'${value.replaceAll("'", "'\\''")}'`

export async function installCliEnvironment(config) {
  await mkdir(config.binDir, { recursive: true, mode: 0o700 })
  const cli = fileURLToPath(new URL('../cli.js', import.meta.url))
  const file = config.cliPath
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `#!/bin/sh\n${MARKER}\nexec ${quote(process.execPath)} ${quote(cli)} "$@"\n`, { mode: 0o755 })
  await rename(temporary, file)

  const previousPath = process.env.PATH
  const previousSocket = process.env.LT_TEAM_SOCKET
  const nextPath = [config.binDir, previousPath].filter(Boolean).join(delimiter)
  process.env.PATH = nextPath
  process.env.LT_TEAM_SOCKET = config.socketPath
  return () => {
    if (process.env.PATH === nextPath) {
      if (previousPath === undefined) delete process.env.PATH
      else process.env.PATH = previousPath
    }
    if (process.env.LT_TEAM_SOCKET === config.socketPath) {
      if (previousSocket === undefined) delete process.env.LT_TEAM_SOCKET
      else process.env.LT_TEAM_SOCKET = previousSocket
    }
  }
}
