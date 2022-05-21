import http from 'node:http'

import {
  addForwardingHeaders,
  rewriteLocationHeader,
} from './middlewares/request.js'

export class HttpProxy {
  /**
   * @typedef {{
   *   target: URL|string,
   *   middlewares: {
   *     request?: ((req: http.IncomingMessage, res: http.ServerResponse, options: http.RequestOptions) => boolean)[],
   *     response?: ((req: http.IncomingMessage, res: http.ServerResponse, options: http.RequestOptions) => boolean)[],
   *   }
   * }} HttpProxyOptions
   * @type {HttpProxyOptions}
   */
  #options = {}

  /**
   * @param {HttpProxyOptions} options
   */
  constructor(options = {}) {
    this.#options = this.#validateOptions(options)

    // Add default middlewares
    this.#options.middlewares.request.push(
      addForwardingHeaders,
      // sendRequest should be the last middleware in the chain
      this.#sendRequest
    )
    this.#options.middlewares.response.push(rewriteLocationHeader)
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

    // Setup middlewares
    if (!options.middlewares) {
      options.middlewares = {
        request: [],
        response: [],
      }
    }
    if (!Array.isArray(options.middlewares.request)) {
      options.middlewares.request = []
    }
    if (!Array.isArray(options.middlewares.response)) {
      options.middlewares.response = []
    }

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
    const { target } = this.#options
    return {
      hostname: target.hostname,
      port: target.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      protocol: requestUrl.protocol,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.hostname,
      },
    }
  }

  /**
   * Performs the actual proxying of the request to the target server.
   * Note: This method needs to be an arrow function to have access to `this.#options`.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {http.RequestOptions} options
   * @returns {boolean}
   */
  #sendRequest = (req, res, options) => {
    const proxyReq = http.request(options, (proxyRes) => {
      res.statusCode = proxyRes.statusCode
      res.statusMessage = proxyRes.statusMessage

      // Copy all target response headers to client response
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      for (let middleware of this.#options.middlewares.response) {
        // A middleware function can return a truthy value to break out of the loop
        // and stop middlewares further in the chain from running
        if (middleware(req, res, options)) {
          break
        }
      }

      // Stream response from target back to client
      proxyRes.pipe(res)
    })

    // Stream request from client to target
    req.pipe(proxyReq)

    return true
  }

  /**
   * Handle proxying client request to target
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleRequest(req, res) {
    const options = this.#getRequestOptions(req)

    for (let middleware of this.#options.middlewares.request) {
      // A middleware function can return a truthy value to break out of the loop
      // and stop middlewares further in the chain from running
      if (middleware(req, res, options)) {
        break
      }
    }
  }
}
