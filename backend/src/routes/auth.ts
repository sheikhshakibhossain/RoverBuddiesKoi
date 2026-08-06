import { Router } from "express"
import multer from "multer"
import { register, login, refreshToken, logout, getMe, forgotPassword, deleteAccount } from "../controllers/auth.js"
import { authenticate } from "../middlewares/auth.js"

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const router = Router()

router.post("/register", upload.single("file"), register)
router.post("/login", login)
router.post("/refresh", refreshToken)
router.post("/logout", logout)
router.get("/me", authenticate, getMe)
router.delete("/me", authenticate, deleteAccount)
router.post("/forgot-password", forgotPassword)

export default router
