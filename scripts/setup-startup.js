const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
const shortcutPath = path.join(startupDir, 'ScmTowerNotifier.lnk')
const targetVbs = path.resolve(__dirname, 'run-notifier-hidden.vbs')
const projectDir = path.resolve(__dirname, '..')

const vbsFile = path.resolve(__dirname, '_temp_shortcut.vbs')
const vbsContent = `
Set ws = CreateObject("WScript.Shell")
Set lnk = ws.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
lnk.TargetPath = "wscript.exe"
lnk.Arguments = """${targetVbs.replace(/\\/g, '\\\\')}"""
lnk.WorkingDirectory = "${projectDir.replace(/\\/g, '\\\\')}"
lnk.Save
`

fs.writeFileSync(vbsFile, vbsContent, 'utf8')
try {
  execSync(`cscript //nologo "${vbsFile}"`)
  console.log('STARTUP_SHORTCUT_CREATED:', fs.existsSync(shortcutPath))
} finally {
  if (fs.existsSync(vbsFile)) fs.unlinkSync(vbsFile)
}
