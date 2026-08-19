import { Router } from "express"
import multer from "multer"
import { uploadRoutine, getMyRoutine, addCustomSlot, deleteSlot, updateSlot } from "../controllers/routines.js"
import { authenticate } from "../middlewares/auth.js"

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const router = Router()

router.post("/upload", authenticate, upload.single("file"), uploadRoutine)
router.get("/me", authenticate, getMyRoutine)
router.post("/custom-slot", authenticate, addCustomSlot)
router.delete("/slot/:id", authenticate, deleteSlot)
router.put("/slot/:id", authenticate, updateSlot)

export default router
