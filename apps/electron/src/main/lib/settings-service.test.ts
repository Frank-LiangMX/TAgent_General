import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const settingsPath = 'C:/tagent-streaming-setting-test/settings.json'

const fsMocks = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}

vi.mock('node:fs', () => fsMocks)

vi.mock('./config-paths', () => ({
  getSettingsPath: () => settingsPath,
}))

const { getSettings, isAgentStreamingEnabled, updateSettings } = await import('./settings-service')

describe('streaming output setting', () => {
  beforeEach(() => {
    fsMocks.existsSync.mockReturnValue(false)
    fsMocks.readFileSync.mockReset()
    fsMocks.writeFileSync.mockReset()
  })

  test('keeps the current ribbon presence as the default', () => {
    expect(getSettings().assistantPresenceStyle).toBe('ribbon')
    expect(getSettings().assistantPresenceMotion).toBe('rich')
  })

  test('restores reduced presence motion and normalizes unknown legacy values', () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValueOnce(
      JSON.stringify({ themeMode: 'dark', assistantPresenceMotion: 'reduced' })
    )
    expect(getSettings().assistantPresenceMotion).toBe('reduced')

    fsMocks.readFileSync.mockReturnValueOnce(
      JSON.stringify({ themeMode: 'dark', assistantPresenceMotion: 'system' })
    )
    expect(getSettings().assistantPresenceMotion).toBe('rich')
  })

  test('restores fluid presence and normalizes unknown legacy values', () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValueOnce(
      JSON.stringify({ themeMode: 'dark', assistantPresenceStyle: 'fluid' })
    )
    expect(getSettings().assistantPresenceStyle).toBe('fluid')

    fsMocks.readFileSync.mockReturnValueOnce(
      JSON.stringify({ themeMode: 'dark', assistantPresenceStyle: 'unknown' })
    )
    expect(getSettings().assistantPresenceStyle).toBe('ribbon')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('defaults to enabled for new and legacy settings', () => {
    expect(getSettings().agentStreaming).toBe(true)
    expect(isAgentStreamingEnabled({})).toBe(true)
    expect(isAgentStreamingEnabled({ agentStreaming: false })).toBe(false)
  })

  test('persists an explicit disabled value through updateSettings', () => {
    fsMocks.existsSync.mockReturnValue(false)

    const updated = updateSettings({ agentStreaming: false })

    expect(updated.agentStreaming).toBe(false)
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      settingsPath,
      expect.stringContaining('"agentStreaming": false'),
      'utf-8'
    )
  })
})
