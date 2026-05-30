import { getCookie, setCookie, deleteCookie } from "cookies-next";

export function setUid(value: string) {
  console.log(value);
  setCookie("uid", value, {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  });
}

export function getUid() {
  console.log(getCookie("uid")?.toString() ?? null);
  return getCookie("uid")?.toString() ?? null;
}

export function clearUid() {
  deleteCookie("uid", { path: "/" });
}
