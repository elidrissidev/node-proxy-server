import http from 'node:http'

export class HttpProxy {
  /**
   * Handle proxying client request to target
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleRequest(req, res) {
    const proxyReq = http.request(
      {
        hostname: 'openmage.localhost',
        port: 80,
        path: '/',
        method: 'GET',
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
