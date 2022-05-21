import http from 'node:http'

import { HttpProxy } from './lib/http-proxy/index.js'

const proxy = new HttpProxy({
  target: 'http://openmage.localhost/',
  timeout: 5000,
  middlewares: {
    response: [
      function logger(req, res) {
        console.log(req.method, req.url, res.statusCode)
      },
    ],
  },
})

const proxyServer = http.createServer((req, res) => {
  proxy.handleRequest(req, res)
})

proxyServer.listen(process.env.PORT || 3000)
