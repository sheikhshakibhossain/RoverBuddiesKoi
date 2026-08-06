import { Router } from "express"
import { getTeams, getOrgMeta } from "../controllers/teams.js"
import { authenticate } from "../middlewares/auth.js"

const router = Router()

router.get("/", authenticate, getTeams)
router.get("/meta", authenticate, getOrgMeta)

export default router
