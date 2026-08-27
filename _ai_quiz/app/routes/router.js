// 极简路由：支持 /:param 路径参数；匹配失败返回 false（落到静态托管）
function createRouter() {
  const routes = [];
  return {
    add(method, path, handler) {
      const keys = [];
      const pattern = path.replace(/\/:(\w+)/g, (m, k) => { keys.push(k); return '/([^/]+)'; });
      const re = new RegExp('^' + pattern + '$');
      routes.push({ method, keys, re, handler });
    },
    async dispatch(req, res, ctx) {
      const url = new URL(req.url, 'http://local');
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        await r.handler(req, res, ctx, params, url);
        return true; // 已命中路由（handler 自行完成响应）
      }
      return false;
    },
  };
}
module.exports = { createRouter };
