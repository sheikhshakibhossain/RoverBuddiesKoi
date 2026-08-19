import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { config } from "./config/index.js"
import { AppError } from "./utils/errors.js"

import authRoutes from "./routes/auth.js"
import memberRoutes from "./routes/members.js"
import routineRoutes from "./routes/routines.js"
import skillRoutes from "./routes/skills.js"
import heatmapRoutes from "./routes/heatmap.js"
import aiRoutes from "./routes/ai.js"
import semesterRoutes from "./routes/semesters.js"
import teamRoutes from "./routes/teams.js"
import projectRoutes from "./routes/projects.js"

const app = express()

// Enable trust proxy for Vercel / serverless reverse proxies / Cloudflare
app.set("trust proxy", 1)

// 1. Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
)

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
)

// Handle preflight requests
app.options("*", cors())

// 2. Rate Limiter (Optimized for mobile CGNAT and serverless proxying)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Generous limit to accommodate cellular carrier CGNAT shared IPs
  message: { error: "Too many requests from this network, please try again later." },
  validate: { xForwardedForHeader: false, default: false },
  skip: (req) => req.method === "OPTIONS" || req.path === "/health",
})
app.use("/api", limiter)

// 3. Body Parsers
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// 4. Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RoverBuddiesKoi API",
    timestamp: new Date().toISOString(),
  })
})

// 5. API Routes
app.use("/api/auth", authRoutes)
app.use("/api/members", memberRoutes)
app.use("/api/routines", routineRoutes)
app.use("/api/skills", skillRoutes)
app.use("/api/heatmap", heatmapRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/semesters", semesterRoutes)
app.use("/api/teams",    teamRoutes)
app.use("/api/projects", projectRoutes)

// 6. 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" })
})

// 7. Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Error:", err)

  const statusCode = typeof err.statusCode === "number" ? err.statusCode : (err instanceof AppError ? err.statusCode : 500)
  const message = err.message || "Internal server error"

  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ error: message, message })
  }

  res.status(500).json({
    error: config.NODE_ENV === "production" ? (err.message || "Internal server error") : err.message || "Unknown error",
    message: err.message || "Internal server error",
  })
})

// 8. Start server listener
const PORT = process.env.PORT || config.PORT || 5000

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`RoverBuddiesKoi API running at http://localhost:${PORT}`)
  })
}

export default app
