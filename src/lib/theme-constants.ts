/** Persisted user choice. Omit key on first visit to follow system preference. */
export const STUDARA_THEME_STORAGE_KEY = "studara-theme";

export type StudaraTheme = "light" | "dark";

/** Inline before React hydrates to avoid theme flash (see root layout). */
export const STUDARA_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(STUDARA_THEME_STORAGE_KEY)};var d=document.documentElement;var s=localStorage.getItem(k);if(s==="light"||s==="dark"){d.setAttribute("data-theme",s);return;}d.setAttribute("data-theme",window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
