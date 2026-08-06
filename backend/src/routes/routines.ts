import { Router } from "express"
import multer from "multer"
import { uploadRoutine, getMyRoutine } from "../controllers/routines.js"
import { authenticate } from "../middlewares/auth.js"

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const router = Router()

router.post("/upload", authenticate, upload.single("file"), uploadRoutine)
router.get("/me", authenticate, getMyRoutine)

export default router
