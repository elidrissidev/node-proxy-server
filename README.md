# node-proxy-server

A simple and extensible Node.js forward proxy server.

## Installation

The first step is to clone the repository:

```sh
git clone https://github.com/elidrissidev/node-proxy-server.git
```

After that install the dependencies and start the server:

```sh
cd node-proxy-server
yarn install
yarn start # or yarn dev for the development server with auto-reloading
```

The proxy server should now be running on [http://localhost:3000](http://localhost:3000).

## Setup

There are two ways to use the proxy:

- First, and the default way, is to proxy all your HTTP traffic by [configuring it in your device's proxy settings](https://www.wikihow.com/Connect-to-a-Proxy-Server#) (use `localhost` as the address and `3000` as the port number). The proxy server will then infer the host you're trying to access from the request's `Host` header that browsers send by default.

```js
const proxy = new HttpProxy({
  autoDetectTarget: true,
})
```

- The second way is to specify a target server you want to proxy your HTTP requests to via the `target` option. If you follow this method you should _not_ add the proxy to your device's proxy settings , but rather you access it directly at `http://localhost:3000/`.

See below for more available options.

**Note: Only HTTP proxying is supported at this point.**

## Options

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `target` | `string` (must be parsable by `URL` class), or a `URL` object | ❌ | Required if `autoDetectTarget` is not set. | The target server to proxy requests to. |
| `autoDetectTarget` | `boolean` | ❌ | Required if `target` is not set | Whether to infer the target from request's `Host` header (useful if proxy is configured in OS network settings). |
| `includeForwardingHeaders` | `boolean` | `true` | ❌ | Whether to include `X-Forwarded-*` headers in the proxied requests. |
| `timeout` | `number` | ❌ | ❌ | Timeout in milliseconds for the proxied requests. Will respond with `504 Gateway Timeout` if target does not return a response in time. |

## Middlewares

Middlewares are simple javascript functions used to extend the functionality of the proxy server, they can be added to run during request phase using `proxy.addRequestMiddlewares()`, or during response phase using `proxy.addResponseMiddlewares()`.

These functions are invoked with a few parameters:

- `req`: The client's request object. Can be used to get informations about the request such as headers and path.
- `res`: The client's response object. Can be used to manipulate the headers sent by the target server, or writing data to the response.
- `reqOptions`: The options object that was used to send the request to target.
- `proxyOptions`: The proxy options object that. Can be used to do something based on provided options.

Middlewares may return a truthy value to stop the request (e.g. when blacklisting requests), if that's the case, the middleware function is responsible for sending the response by calling `res.end`.

Example of adding a middleware that logs responses from target server:

```js
proxy.addResponseMiddlewares((req, res) => {
  console.log(req.method, req.url, res.statusCode)
})
```

Note: middlewares are executed by the order in which they were added.
