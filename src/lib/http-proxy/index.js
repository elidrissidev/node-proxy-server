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
      },
      (proxyRes) => {
        // Stream response from target back to client
        proxyRes.pipe(res)
      }
    )

    // Stream request from client to target
    req.pipe(proxyReq)
  }
}
