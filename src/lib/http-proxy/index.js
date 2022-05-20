import http from 'node:http'

/**
 * @property {HttpProxyOptions} options
 */
export class HttpProxy {
  /**
   * @typedef {{ target: URL|string }} HttpProxyOptions
   * @param {HttpProxyOptions} options
   */
  constructor(options = {}) {
    this.options = this.#validateOptions(options)
  }

  /**
   * Validate options and set defaults
   *
   * @param {HttpProxyOptions} options
   * @returns {HttpProxyOptions}
   */
  #validateOptions(options) {
    if (!options.target) {
      throw new Error('Target URL is required')
    }

    // Convert target into a URL object if it's a string
    options.target =
      typeof options.target === 'string'
        ? new URL(options.target)
        : options.target

    return options
  }

  /**
   * Build target request options from client request
   *
   * @param {http.IncomingMessage} req
   * @returns {http.RequestOptions}
   */
  #getRequestOptions(req) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`)
    const { target } = this.options
    return {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: req.method,
      headers: {
        ...req.headers,
        // Let the target server know who the client is by sending the standard forwarding headers.
        // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling#forwarding_client_information_through_proxies
        // TODO: Chain the headers with the ones from the request if they exist (i.e. if the request was from another proxy).
        'x-forwarded-for': req.socket.remoteAddress,
        'x-forwarded-host': requestUrl.hostname,
        'x-forwarded-port': requestUrl.port,
        'x-forwarded-proto': requestUrl.protocol.replace(':', ''),
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
