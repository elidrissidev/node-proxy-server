import http from 'node:http'

const proxyServer = http.createServer((req, res) => {
  res.writeHead(200)
  res.write('Hello from proxy server')
  res.end()
})

proxyServer.listen(process.env.PORT || 3000)
