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
   *   includeForwardingHeaders?: boolean,
   *   timeout?: number
   * }} HttpProxyOptions
   * @type {HttpProxyOptions}
   */
  #options = {}

  /**
   * @typedef {(
   *   req: http.IncomingMessage,
   *   res: http.ServerResponse,
   *   reqOptions: http.RequestOptions,
   *   proxyOptions: HttpProxyOptions
   * ) => boolean} MiddlewareFunction
   * @typedef {{ request: MiddlewareFunction[], response: MiddlewareFunction[] }} HttpProxyMiddlewares
   * @type {HttpProxyMiddlewares}
   */
  #middlewares = {
    request: [addForwardingHeaders],
    response: [rewriteLocationHeader, rewriteSetCookieHeader],
  }

  /**
   * @param {HttpProxyOptions} options
   */
  constructor(options = {}) {
    this.#options = this.#validateOptions(options)
  }

  /**
   * Validate options and set defaults
   *
   * @param {HttpProxyOptions} options
   * @returns {HttpProxyOptions}
   */
  #validateOptions(options) {
    // Either `target` or `autoDetectTarget` option must be set
    if (!options.target && !options.autoDetectTarget) {
      throw new TypeError(
        'Either `target` or `autoDetectTarget` option must be set'
      )
    }

    // Convert target into a URL object if it's a string
    options.target =
      typeof options.target === 'string'
        ? new URL(options.target)
        : options.target

    // Add 'X-Forwarding-*' headers to request by default
    if (options.includeForwardingHeaders === undefined) {
      options.includeForwardingHeaders = true
    }

    if (typeof options.timeout !== 'number') {
      options.timeout = +options.timeout
    }

    return options
  }

  /**
   * Build target request options from client request
   *
   * @param {http.IncomingMessage} req
   * @param {HttpProxyOptions} proxyOptions
   * @returns {http.RequestOptions}
   */
  #getRequestOptions(req, proxyOptions) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`)
    const { target, autoDetectTarget, timeout } = proxyOptions

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
      timeout: timeout,
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
   * @param {http.RequestOptions} reqOptions
   * @param {HttpProxyOptions} proxyOptions
   * @returns {boolean}
   */
  #sendRequest(req, res, reqOptions, proxyOptions) {
    const proxyReq = http.request(reqOptions, (proxyRes) => {
      res.statusCode = proxyRes.statusCode
      res.statusMessage = proxyRes.statusMessage

      // Copy all target response headers to client response
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      for (let middleware of this.#middlewares.response) {
        // A middleware function can return a truthy value to break out of the loop
        // and stop middlewares further in the chain from running
        if (middleware(req, res, reqOptions, proxyOptions)) {
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
      // Print errors with a red text color
      console.error('\x1b[31m', 'Error:', err.message)
    })

    return true
  }

  /**
   * Add a proxy request middleware
   *
   * @param {MiddlewareFunction[]} middlewares
   */
  addRequestMiddlewares(...middlewares) {
    this.#middlewares.request.push(...middlewares)
  }

  /**
   * Add a proxy response middleware
   *
   * @param {MiddlewareFunction[]} middlewares
   */
  addResponseMiddlewares(...middlewares) {
    this.#middlewares.response.push(...middlewares)
  }

  /**
   * Handle proxying client request to target
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {HttpProxyOptions} overrideProxyOptions
   */
  handleRequest(req, res, overrideProxyOptions = {}) {
    // Create a copy of proxy options object with per-request overrides.
    // This can be used to override some options based on request variables like host for example.
    const proxyOptions = {
      ...this.#options,
      ...overrideProxyOptions,
    }

    const reqOptions = this.#getRequestOptions(req, proxyOptions)

    for (let middleware of this.#middlewares.request) {
      // A middleware function can return a truthy value to break out of the loop
      // and stop middlewares further in the chain from running
      //
      // Note: request middlewares that return true must handle sending the response
      // back to the client (i.e. calling res.end()).
      if (middleware(req, res, reqOptions, proxyOptions)) {
        return
      }
    }

    // Send the request to target
    this.#sendRequest(req, res, reqOptions, proxyOptions)
  }
}
