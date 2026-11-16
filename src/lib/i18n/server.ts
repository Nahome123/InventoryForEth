import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, THEME_COOKIE, type Lang, type Theme } from "./lang";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === "am" ? "am" : "en";
}

/** Light unless the person picked dark with the toggle. */
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
