import http from 'node:http'

export class HttpProxy {
  /**
   * Handle proxying client request to target
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleRequest(req, res) {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`)

    const proxyReq = http.request(
      {
        hostname: reqUrl.hostname,
        port: reqUrl.port,
        path: reqUrl.pathname,
        method: req.method,
        headers: {
          ...req.headers,
        },
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode
        res.statusMessage = proxyRes.statusMessage

        // Copy all target response headers to client response
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })
        // Stream response from target back to client
        proxyRes.pipe(res)
      }
    )

    // Stream request from client to target
    req.pipe(proxyReq)
  }
}
