/** Where each part of Settings lives: the list at /settings, and the page
 *  each of its rows opens. Actions send the traveller back to the page they
 *  were on. */
export const SETTINGS = {
  home: "/settings",
  personal: "/settings/personal",
  password: "/settings/password",
  appearance: "/settings/appearance",
  privacy: "/settings/privacy",
  deleteAccount: "/settings/delete",
  admin: "/settings/admin",
} as const;
