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
