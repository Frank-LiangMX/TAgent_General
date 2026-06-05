const TAGENT_REPO_URL = 'https://github.com/ErlichLiu/TAgent'

let _promaVersion = '0.0.0'

export function setTAgentVersion(version: string): void {
  _promaVersion = version
}

export function getTAgentVersion(): string {
  return _promaVersion
}

export function getTAgentUserAgent(version?: string): string {
  const v = version ?? _promaVersion
  return `TAgent/${v} (+${TAGENT_REPO_URL})`
}
