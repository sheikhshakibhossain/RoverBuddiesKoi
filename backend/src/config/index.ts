import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/roverbuddies?schema=public"),
  JWT_SECRET: z.string().default("super_secret_jwt_access_token_key_roverbuddies_2026"),
  JWT_REFRESH_SECRET: z.string().default("super_secret_jwt_refresh_token_key_roverbuddies_2026"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error("Invalid environment variables:", _env.error.format())
  throw new Error("Invalid environment variables")
}

export const config = _env.data
