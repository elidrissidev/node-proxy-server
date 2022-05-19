import http from 'node:http'

export class HttpProxy {
  /**
   * Build target request options from client request
   *
   * @param {http.IncomingMessage} req
   * @returns {http.RequestOptions}
   */
  #getRequestOptions(req) {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`)

    return {
      hostname: reqUrl.hostname,
      port: reqUrl.port,
      path: reqUrl.pathname,
      method: req.method,
      headers: {
        ...req.headers,
      },
    }
  }

  /**
   * Handle proxying client request to target
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleRequest(req, res) {
    const options = this.#getRequestOptions(req)
    const proxyReq = http.request(options, (proxyRes) => {
      res.statusCode = proxyRes.statusCode
      res.statusMessage = proxyRes.statusMessage

      // Copy all target response headers to client response
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
      // Stream response from target back to client
      proxyRes.pipe(res)
    })

    // Stream request from client to target
    req.pipe(proxyReq)
  }
}
