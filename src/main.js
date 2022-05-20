import http from 'node:http'

import { HttpProxy } from './lib/http-proxy/index.js'

const proxy = new HttpProxy({
  target: 'http://localhost:8080/',
  middlewares: {
    request: [
      function logger(req) {
        console.log(req.method, req.url)
      },
    ],
  },
})

const proxyServer = http.createServer((req, res) => {
  proxy.handleRequest(req, res)
})

proxyServer.listen(process.env.PORT || 3000)
