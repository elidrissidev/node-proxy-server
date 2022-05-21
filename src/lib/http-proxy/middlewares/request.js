/**
 * Let the target server know who the client is by sending the standard forwarding headers.
 * Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling#forwarding_client_information_through_proxies
 * TODO: Chain the headers with the ones from the request if they exist (i.e. if the request was from another proxy).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {import('http').RequestOptions} options
 */
export function addForwardingHeaders(req, res, options) {
  options.headers['x-forwarded-for'] = req.socket.remoteAddress
  options.headers['x-forwarded-host'] = options.hostname
  options.headers['x-forwarded-port'] = options.port
  options.headers['x-forwarded-proto'] = options.protocol.replace(':', '')
}

/**
 * Rewrite Location header's host to be the same as the proxy's.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {import('http').RequestOptions} options
 */
export function rewriteLocationHeader(req, res) {
  // Response does not contain a Location header, so there's nothing to do
  if (!res.getHeader('location')) {
    return
  }

  // Replace the Location URL host with the one from the request
  const locationUrl = new URL(res.getHeader('location'))
  locationUrl.host = req.headers.host

  res.setHeader('location', locationUrl.toString())
}

/**
 * Rewrite Set-Cookie header's domain to be the same as the proxy's. This is very
 * important as the target server may explicitly set the "domain" attribute on the header,
 * in which case cookies will not be sent on the upcoming requests due to unmatching hosts.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function rewriteSetCookieHeader(req, res) {
  // Response does not contain a Set-Cookie header, so there's nothing to do
  if (!res.getHeader('set-cookie')) {
    return
  }

  const cookies = res.getHeader('set-cookie').map((cookie) => {
    // Only rewrite if cookie has a domain attribute
    if (cookie.match(/domain=.+?;/i)) {
      return cookie.replace(
        /domain=.+?;/i,
        `domain=${req.headers.host.replace(/:\d+$/, '')};`
      )
    }
    return cookie
  })

  res.setHeader('set-cookie', cookies)
}
