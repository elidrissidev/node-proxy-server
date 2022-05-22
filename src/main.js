import http from 'node:http'

import { HttpProxy } from './lib/http-proxy/index.js'

const proxy = new HttpProxy({
  autoDetectTarget: true,
  timeout: 5000,
})

proxy.addResponseMiddlewares((req, res) => {
  console.log(req.method, req.url, res.statusCode)
})

const proxyServer = http.createServer((req, res) => {
  proxy.handleRequest(req, res)
})

proxyServer.listen(process.env.PORT || 3000)

// Target server for testing
const targetServer = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.write(JSON.stringify(req.headers, null, 2))
  res.end()
})

targetServer.listen(8080)
