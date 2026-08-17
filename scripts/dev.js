import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

console.log("🚀 Starting RoverBuddiesKoi (Backend + Frontend)...")

const isWindows = process.platform === "win32"
const npmCmd = isWindows ? "npm.cmd" : "npm"

const backend = spawn(npmCmd, ["run", "dev"], {
  cwd: path.join(rootDir, "backend"),
  stdio: "inherit",
  shell: true,
})

const frontend = spawn(npmCmd, ["run", "dev"], {
  cwd: path.join(rootDir, "frontend"),
  stdio: "inherit",
  shell: true,
})

function shutdown() {
  console.log("\n🛑 Shutting down RoverBuddiesKoi servers...")
  backend.kill()
  frontend.kill()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
