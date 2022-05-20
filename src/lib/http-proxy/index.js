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
        // Let the target server know who the client is by sending the standard forwarding headers.
        // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling#forwarding_client_information_through_proxies
        // TODO: Chain the headers with the ones from the request if they exist (i.e. if the request was from another proxy).
        'x-forwarded-for': req.socket.remoteAddress,
        'x-forwarded-host': reqUrl.hostname,
        'x-forwarded-port': reqUrl.port,
        'x-forwarded-proto': reqUrl.port.replace(':', ''),
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
