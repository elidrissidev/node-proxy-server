import http from 'node:http'

import { addForwardingHeaders } from './middlewares/request.js'
import {
  rewriteLocationHeader,
  rewriteSetCookieHeader,
} from './middlewares/response.js'

export class HttpProxy {
  /**
   * @typedef {{
   *   target: URL|string,
   *   autoDetectTarget?: boolean,
   *   timeout?: number,
   *   middlewares?: {
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
    this.#options.middlewares.request.push(addForwardingHeaders)
    this.#options.middlewares.response.push(
      rewriteLocationHeader,
      rewriteSetCookieHeader
    )
  }

  /**
   * Validate options and set defaults
   *
   * @param {HttpProxyOptions} options
   * @returns {HttpProxyOptions}
   */
  #validateOptions(options) {
    // Either `target` or `autoDetectTarget` option must be set
    if (!options.target && options.autoDetectTarget === undefined) {
      throw new TypeError(
        'Either `target` or `autoDetectTarget` option must be set'
      )
    }

    // Convert target into a URL object if it's a string
    options.target =
      typeof options.target === 'string'
        ? new URL(options.target)
        : options.target

    if (typeof options.timeout !== 'number') {
      options.timeout = +options.timeout
    }

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
    const { target, autoDetectTarget } = this.#options

    // `autoDetectTarget` option allows infering host from Host request header for
    // when you wish to proxy all device traffic. e.g: when setting up the proxy in OS settings.
    //
    // Note: `autoDetectTarget` option takes precedence over `target`
    return {
      hostname: autoDetectTarget ? requestUrl.hostname : target.hostname,
      port: autoDetectTarget ? requestUrl.port : target.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      protocol: requestUrl.protocol,
      method: req.method,
      timeout: this.#options.timeout,
      headers: {
        ...req.headers,
        host: autoDetectTarget ? requestUrl.host : target.host,
      },
    }
  }

  /**
   * Performs the actual request to the target server.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {http.RequestOptions} options
   * @returns {boolean}
   */
  #sendRequest(req, res, options) {
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

    // Set socket timeout handler
    proxyReq.on('timeout', () => {
      // Abort the request
      proxyReq.destroy(new Error('Request timed out'))

      // Send 504 Gateway Timeout error to the client
      res.writeHead(504)
      res.end()
    })

    // Listen for errors and log them to the console
    proxyReq.on('error', (err) => {
      console.error('Error:', err.message)
    })

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
      //
      // Note: request middlewares that return true must handle sending the response
      // back to the client (i.e. calling res.end()).
      if (middleware(req, res, options)) {
        return
      }
    }

    // Send the request to target
    this.#sendRequest(req, res, options)
  }
}
