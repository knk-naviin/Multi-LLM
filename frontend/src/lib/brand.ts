/**
 * ─── Brand Configuration ───
 * Central place to change app name, logo, theme gradient colors.
 * Update values here and they propagate across the entire UI.
 */

/* ─── App Identity ─── */
export const BRAND_NAME = "Swastik Ai";
export const BRAND_TAGLINE = "Multi-LLM AI Router";

/* ─── Logo ─── */
export const BRAND_LOGO = "/finallogo.svg"; // Place your logo at frontend/public/finallogo.svg
export const BRAND_LOGO_SIZE = 100; // px — used in Navbar
export const BRAND_FAVICON = "/finallogo.svg"; // browser tab icon

/* ─── Gradient ─── */
export const BRAND_GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6)";
export const BRAND_GRADIENT_HOVER = "linear-gradient(135deg, #4f46e5, #7c3aed)";

/* ─── Theme Colors ─── */
// Light theme
export const THEME_LIGHT = {
  brand: "#6366f1",
  brandHover: "#4f46e5",
  brandText: "#4f46e5",
};

// Dark theme
export const THEME_DARK = {
  brand: "#818cf8",
  brandHover: "#6366f1",
  brandText: "#a5b4fc",
};
