/** Относительные `/media/...` URL резолвятся через asset_base (renderer), в браузере остаются относительными. */
export function resolveAsset(url: string | null | undefined, base: string | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (!base) return url;
  return base.replace(/\/+$/, "") + (url.startsWith("/") ? url : `/${url}`);
}
