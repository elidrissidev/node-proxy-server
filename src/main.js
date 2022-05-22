import http from 'node:http'

import { HttpProxy } from './lib/http-proxy/index.js'

const proxy = new HttpProxy({
  target: 'http://openmage.localhost/',
  includeForwardingHeaders: false,
  timeout: 5000,
})

proxy.addResponseMiddlewares((req, res) => {
  console.log(req.method, req.url, res.statusCode)
})

const proxyServer = http.createServer((req, res) => {
  proxy.handleRequest(req, res)
})

proxyServer.listen(process.env.PORT || 3000)
