import { Router } from "express"
import { getHeatmap, computeSnapshot, cronComputeAllSnapshots, getSnapshots } from "../controllers/heatmap.js"
import { authenticate } from "../middlewares/auth.js"

const router = Router()

// Live computed heatmap
router.get("/", authenticate, getHeatmap)
// History snapshots
router.get("/snapshots", authenticate, getSnapshots)
// Manually trigger a snapshot (Org Owner only)
router.post("/compute", authenticate, computeSnapshot)
// Cron endpoint — called every 12 hours (no auth, uses secret key)
router.get("/cron", cronComputeAllSnapshots)

export default router
