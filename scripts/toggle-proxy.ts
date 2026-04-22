// toggle-proxy.ts
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Compatible with ES module __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const configPath = path.resolve(__dirname, '../src/config.ts')
const proxyPath = path.resolve(__dirname, '../src/pages/api/proxy.ts')
const backupPath = path.resolve(__dirname, '../src/pages/api/proxy.ts.bak')
const astroConfigPath = path.resolve(__dirname, '../astro.config.ts')

// Read config.ts content
const configContent = fs.readFileSync(configPath, 'utf-8')

// Use regex to extract linkCard config (assuming the format does not change)
const match = configContent.match(/linkCard:\s*(true|false)/)
if (!match) {
  console.error('linkCard config not found')
  process.exit(1)
}
const linkCardEnabled: boolean = match[1] === 'true'

function setLineCommented(lines: string[], index: number, comment: boolean) {
  if (index === -1) return
  const line = lines[index]
  const trimmed = line.trim()
  if (comment) {
    if (!trimmed.startsWith('//')) {
      const indent = line.match(/^\s*/)?.[0] ?? ''
      lines[index] = indent + '// ' + trimmed
    }
  } else {
    if (trimmed.startsWith('//')) {
      const indent = line.match(/^\s*/)?.[0] ?? ''
      const rest = trimmed.replace(/^\/\/\s?/, '')
      lines[index] = indent + rest
    }
  }
}

// Comment/uncomment Vercel or Netlify adapter in astro.config.ts (static output + prerender: false on API routes)
function toggleAstroAdapter(comment: boolean, mustExist: boolean) {
  const astroConfig = fs.readFileSync(astroConfigPath, 'utf-8').split('\n')

  const importIndex = astroConfig.findIndex(
    (line) =>
      line.trim().includes('import') &&
      (line.includes('netlify') || line.includes('vercel')) &&
      line.includes('@astrojs/')
  )

  const adapterIndex = astroConfig.findIndex(
    (line) =>
      line.trim().includes('adapter:') &&
      (line.includes('netlify') || line.includes('vercel'))
  )

  if (importIndex === -1 || adapterIndex === -1) {
    if (mustExist) {
      console.error(
        'Could not find SSR adapter lines in astro.config.ts (commented import from @astrojs/vercel or @astrojs/netlify, and adapter line). See README deploy section, or set linkCard: false in src/config.ts.'
      )
      process.exit(1)
    }
    return
  }

  setLineCommented(astroConfig, importIndex, comment)
  setLineCommented(astroConfig, adapterIndex, comment)

  fs.writeFileSync(astroConfigPath, astroConfig.join('\n'), 'utf-8')
}

if (!linkCardEnabled) {
  // If linkCard is disabled, rename proxy.ts and comment adapter
  if (fs.existsSync(proxyPath)) {
    fs.renameSync(proxyPath, backupPath)
    console.log('🟡 proxy.ts disabled')
  }
  toggleAstroAdapter(true, false)
  console.log('🟡 adapter config disabled')
} else {
  // If linkCard is enabled, restore proxy.ts and uncomment adapter
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, proxyPath)
    console.log('🟢 proxy.ts enabled')
  }
  toggleAstroAdapter(false, true)
  console.log('🟢 adapter config enabled')
}
