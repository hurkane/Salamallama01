import { createCookieSessionStorage } from "@remix-run/node";
import dotenv from "dotenv";
dotenv.config();

// Environment-based configuration
const isProduction = process.env.NODE_ENV === "production";
const isSecure = process.env.SECURE_COOKIES === "true" || isProduction;

export const { getSession, commitSession, destroySession } =
createCookieSessionStorage({
  cookie: {
    name: "__session",
    secure: isSecure || false,
    secrets: [
      process.env.SESSION_SECRET || "cd4f646a200295d20ee9ba49d72ffcf20d5f33365bbe0bb55e67285acafbf0e4",
    ],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    // Use COOKIE_DOMAIN from environment, undefined for local development
    domain: process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN.split(',')[0] : undefined,
  },
});