const { copyFile, mkdir, readFile, rm, writeFile } = require('fs/promises')
const os = require('os')
const path = require('path')

const test = require('ava')

const { getLegacyPathInHome, getPathInHome } = require('../lib/settings')

const getGlobalConfig = require('./get-global-config')

const configPath = getPathInHome(['config.json'])
const legacyConfigPath = getLegacyPathInHome(['config.json'])
const tmpConfigBackupPath = path.join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

test.before('backup current user config if exists', async () => {
  try {
    await copyFile(configPath, tmpConfigBackupPath)
  } catch {}
})

test.after.always('cleanup tmp directory and legacy config', async () => {
  try {
    // Restore user config if exists
    await mkdir(getPathInHome([]), { recursive: true })
    await copyFile(tmpConfigBackupPath, configPath)
    // Remove tmp backup if exists
    await rm(tmpConfigBackupPath, { recursive: true, force: true })
  } catch {}
  // Remove legacy config path
  await rm(getLegacyPathInHome([]), { recursive: true, force: true })
})

test.beforeEach('recreate clean config directories', async () => {
  // Remove config dirs
  await rm(getPathInHome([]), { recursive: true, force: true })
  await rm(getLegacyPathInHome([]), { recursive: true, force: true })
  // Make config dirs
  await mkdir(getPathInHome([]), { recursive: true })
  await mkdir(getLegacyPathInHome([]), { recursive: true })
})

// Not running tests in parallel as we're messing with the same config files

test.serial('should use legacy config values as default if exists', async (t) => {
  const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
  const newConfig = { overrideMe: 'newValue' }
  await writeFile(legacyConfigPath, JSON.stringify(legacyConfig))
  await writeFile(configPath, JSON.stringify(newConfig))

  const globalConfig = await getGlobalConfig()
  t.is(globalConfig.get('someOldKey'), legacyConfig.someOldKey)
  t.is(globalConfig.get('overrideMe'), newConfig.overrideMe)
})

test.serial('should not throw if legacy config is invalid JSON', async (t) => {
  await writeFile(legacyConfigPath, 'NotJson')
  await t.notThrowsAsync(getGlobalConfig)
})

test.serial("should create config in netlify's config dir if none exists and store new values", async (t) => {
  // Remove config dirs
  await rm(getPathInHome([]), { recursive: true, force: true })
  await rm(getLegacyPathInHome([]), { recursive: true, force: true })
  const globalConfig = await getGlobalConfig()
  globalConfig.set('newProp', 'newValue')
  const configFile = JSON.parse(await readFile(configPath, 'utf-8'))
  t.deepEqual(globalConfig.all, configFile)
})
