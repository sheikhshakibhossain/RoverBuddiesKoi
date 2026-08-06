import { Router } from "express"
import { processAIChat } from "../controllers/ai.js"
import { authenticate } from "../middlewares/auth.js"

const router = Router()

router.post("/chat", authenticate, processAIChat)

export default router
