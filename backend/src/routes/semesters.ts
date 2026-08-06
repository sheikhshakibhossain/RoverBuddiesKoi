import { Router } from "express"
import { getSemesters, createSemester } from "../controllers/semesters.js"
import { authenticate } from "../middlewares/auth.js"
import { authorize } from "../middlewares/rbac.js"
import { Role } from "@prisma/client"

const router = Router()

router.get("/", authenticate, getSemesters)
router.post("/", authenticate, authorize([Role.ORG_OWNER]), createSemester)

export default router
