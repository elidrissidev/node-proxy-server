import http from 'node:http'

import { HttpProxy } from './lib/http-proxy/index.js'

const proxy = new HttpProxy()

const proxyServer = http.createServer((req, res) => {
  proxy.handleRequest(req, res)
  // res.writeHead(200)
  // res.write('Hello from proxy server')
  // res.end()
})

proxyServer.listen(process.env.PORT || 3000)
