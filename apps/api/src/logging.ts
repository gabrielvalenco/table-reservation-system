/** A URL pode ter o segredo do link (/manage/:token) ou uma busca com nome (?q=): nenhum dos dois vai para o log. */
export function safeUrl(url: string) {
  return url.split("?")[0]!.replace(/\/manage\/[^/]+/, "/manage/:token");
}

export const loggerOptions = {
  serializers: {
    req: (request: { method: string; url: string }) => ({ method: request.method, url: safeUrl(request.url) }),
  },
  redact: { paths: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'], censor: "[removido]" },
};
