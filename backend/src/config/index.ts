import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.string().default("production"),
  DATABASE_URL: z.string().default("postgresql://neondb_owner:npg_OrEUGz6MFR4t@ep-dry-paper-axhvj3pr-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"),
  JWT_SECRET: z.string().default("roverbuddies_production_jwt_access_secret_2026_key"),
  JWT_REFRESH_SECRET: z.string().default("roverbuddies_production_jwt_refresh_secret_2026_key"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().default("https://roverbuddieskoi.vercel.app"),
})

const _env = envSchema.safeParse(process.env)

export const config = _env.success ? _env.data : envSchema.parse({})
