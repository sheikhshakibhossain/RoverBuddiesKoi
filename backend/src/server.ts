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

// 1. Security Middlewares
app.use(helmet())
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

// 2. Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: "Too many requests from this IP, please try again later." },
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

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  res.status(500).json({
    error: config.NODE_ENV === "production" ? "Internal server error" : err.message || "Unknown error",
  })
})

// 8. Export app for Vercel serverless / Local start
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(config.PORT, () => {
    console.log(`RoverBuddiesKoi API running at http://localhost:${config.PORT}`)
  })
}

export default app
