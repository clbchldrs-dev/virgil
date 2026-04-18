/**
 * Strips Next.js `basePath` from a pathname so route checks match logical paths
 * (e.g. `/virgil/chat/x` → `/chat/x` when `basePath` is `/virgil`).
 */
export function pathnameWithoutBasePath(
  pathname: string,
  basePath: string
): string {
  if (!basePath) {
    return pathname;
  }
  if (pathname === basePath) {
    return "/";
  }
  if (pathname.startsWith(`${basePath}/`)) {
    const rest = pathname.slice(basePath.length);
    return rest.length > 0 ? rest : "/";
  }
  return pathname;
}

export function isChatSurfacePath(logicalPath: string): boolean {
  return logicalPath === "/" || /^\/chat\/[^/]+$/.test(logicalPath);
}

/** Resolves `chatId` from the URL whether or not `pathname` includes a Next.js `basePath`. */
export function extractChatIdFromPathname(
  pathname: string | null | undefined,
  basePath: string
): string | null {
  if (!pathname) {
    return null;
  }
  const logical = pathnameWithoutBasePath(pathname, basePath);
  const match = /^\/chat\/([^/]+)$/.exec(logical);
  return match ? match[1] : null;
}
