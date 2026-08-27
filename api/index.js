// node_modules/hono/dist/adapter/vercel/handler.js
var handle = (app2) => (req) => {
  return app2.fetch(req);
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path2) => {
  const paths = path2.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path: path2 } = extractGroupsFromPath(routePath);
  const paths = splitPath(path2);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path2) => {
  const groups = [];
  path2 = path2.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path: path2 };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str2, decoder) => {
  try {
    return decoder(str2);
  } catch {
    return str2.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str2) => tryDecode(str2, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path2 = url.slice(start, end);
      return tryDecodeURI(path2.includes("%25") ? path2.replace(/%25/g, "%2525") : path2);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path2) => {
  if (path2.charCodeAt(path2.length - 1) !== 63 || !path2.includes(":")) {
    return null;
  }
  const segments = path2.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str2) => str2.indexOf("%") !== -1 ? tryDecode(str2, decodeURIComponent_) : str2;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path2 = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path2;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str2, phase, preserveCallbacks, context, buffer) => {
  if (typeof str2 === "object" && !(str2 instanceof String)) {
    if (!(str2 instanceof Promise)) {
      str2 = str2.toString();
    }
    if (str2 instanceof Promise) {
      str2 = await str2;
    }
  }
  const callbacks = str2.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str2);
  }
  if (buffer) {
    buffer[0] += str2;
  } else {
    buffer = [str2];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str22) => resolveCallback(str22, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path2, ...handlers) => {
      for (const p of [path2].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path2, app2) {
    const subApp = this.basePath(path2);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path2) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path2);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path2, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path2);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path2, "*"), handler);
    return this;
  }
  #addRoute(method, path2, handler, baseRoutePath) {
    method = method.toUpperCase();
    path2 = mergePath(this._basePath, path2);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path: path2,
      method,
      handler
    };
    this.router.add(method, path2, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path2 = this.getPath(request, { env });
    const matchResult = this.router.match(method, path2);
    const c = new Context(request, {
      path: path2,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path2) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path22) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path22];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path22.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path2);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = createNullObject();
  insert(path2, isStatic) {
    if (isStatic) {
      this.#root.insert(path2.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path2;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path2] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path2) {
  return wildcardRegExpCache[path2] ??= new RegExp(
    `^${path2.replace(
      /\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g,
      (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ONLY_WILDCARD_REG_EXP_STR : `/:${LABEL_REG_EXP_STR}`
    )}$`
  );
}
function findMiddleware(middleware, path2) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path2)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: createNullObject() };
    this.#routes = { [METHOD_NAME_ALL]: createNullObject() };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path2) {
    try {
      this.#tries[method].insert(path2, !/\*|\/:/.test(path2));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path2) : e;
    }
  }
  add(method, path2, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap[METHOD_NAME_ALL]) {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path2 === "/*") {
      path2 = "*";
    }
    const methods = method === METHOD_NAME_ALL ? Object.keys(middleware) : [method];
    if (/\*$/.test(path2)) {
      const re = buildWildcardRegExp(path2);
      for (const m of methods) {
        if (!middleware[m][path2]) {
          this.#insertPath(m, path2);
          middleware[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || [];
        }
      }
      for (const handlerMap of [middleware, routes]) {
        for (const m of methods) {
          for (const p in handlerMap[m]) {
            re.test(p) && handlerMap[m][p].push([handler, path2]);
          }
        }
      }
      return;
    }
    const paths = checkOptionalParameter(path2) || [path2];
    for (const path22 of paths) {
      for (const m of methods) {
        if (!routes[m][path22]) {
          this.#insertPath(m, path22);
          routes[m][path22] = findMiddleware(middleware[m], path22) || findMiddleware(middleware[METHOD_NAME_ALL], path22) || [];
        }
        routes[m][path22].push([handler, path22]);
      }
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) {
      matchers[method] = this.#buildMatcher(method);
    }
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) {
      for (const path2 in r) {
        const handlers = r[path2];
        const pathData = trie.paths[path2];
        if (!pathData) {
          staticMap[path2] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
          continue;
        }
        handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [
          h,
          trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
            map[key] = paramReplacementMap[pathData[1][i][1]];
            return map;
          }, createNullObject())
        ]);
      }
    }
    return [regexp, indexReplacementMap.map((i) => handlerData[i]), staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path2, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path2, handler]);
  }
  match(method, path2) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path2);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node2 = class _Node2 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path2, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path2);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path2) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path2);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path2[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path2.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node2();
  add(method, path2, handler) {
    for (const result of checkOptionalParameter(path2) || [path2]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path2) {
    return this.#node.search(method, path2);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/utils/stream.js
var StreamingApi = class {
  writer;
  encoder;
  writable;
  abortSubscribers = [];
  responseReadable;
  /**
   * Whether the stream has been aborted.
   */
  aborted = false;
  /**
   * Whether the stream has been closed normally.
   */
  closed = false;
  constructor(writable, _readable) {
    this.writable = writable;
    this.writer = writable.getWriter();
    this.encoder = new TextEncoder();
    const reader = _readable.getReader();
    this.abortSubscribers.push(async () => {
      await reader.cancel();
    });
    this.responseReadable = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        done ? controller.close() : controller.enqueue(value);
      },
      cancel: () => {
        if (!this.closed) {
          this.abort();
        }
      }
    });
  }
  async write(input) {
    try {
      if (typeof input === "string") {
        input = this.encoder.encode(input);
      }
      await this.writer.write(input);
    } catch {
    }
    return this;
  }
  async writeln(input) {
    await this.write(input + "\n");
    return this;
  }
  sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
  async close() {
    this.closed = true;
    try {
      await this.writer.close();
    } catch {
    }
  }
  async pipe(body) {
    this.writer.releaseLock();
    try {
      await body.pipeTo(this.writable, { preventClose: true, preventAbort: true });
    } finally {
      this.writer = this.writable.getWriter();
    }
  }
  onAbort(listener) {
    this.abortSubscribers.push(listener);
  }
  /**
   * Abort the stream.
   * You can call this method when stream is aborted by external event.
   */
  abort() {
    if (!this.aborted) {
      this.aborted = true;
      this.abortSubscribers.forEach((subscriber) => {
        try {
          void Promise.resolve(subscriber()).catch(() => {
          });
        } catch {
        }
      });
    }
  }
};

// node_modules/hono/dist/helper/streaming/utils.js
var isOldBunVersion = () => {
  const version = typeof Bun !== "undefined" ? Bun.version : void 0;
  if (version === void 0) {
    return false;
  }
  const result = version.startsWith("1.1") || version.startsWith("1.0") || version.startsWith("0.");
  isOldBunVersion = () => result;
  return result;
};

// node_modules/hono/dist/helper/streaming/sse.js
var SSEStreamingApi = class extends StreamingApi {
  constructor(writable, readable) {
    super(writable, readable);
  }
  async writeSSE(message) {
    const data = await resolveCallback(message.data, HtmlEscapedCallbackPhase.Stringify, false, {});
    const dataLines = data.split(/\r\n|\r|\n/).map((line) => {
      return `data: ${line}`;
    }).join("\n");
    for (const key of ["event", "id"]) {
      const value = message[key];
      if (value && /[\r\n]/.test(value)) {
        throw new Error(`${key} must not contain "\\r" or "\\n"`);
      }
    }
    const sseData = [
      message.event && `event: ${message.event}`,
      dataLines,
      message.id !== void 0 && `id: ${message.id}`,
      message.retry !== void 0 && `retry: ${message.retry}`
    ].filter(Boolean).join("\n") + "\n\n";
    await this.write(sseData);
  }
};
var run = async (stream2, cb, onError) => {
  try {
    await cb(stream2);
  } catch (e) {
    if (e instanceof Error && onError) {
      await onError(e, stream2);
      await stream2.writeSSE({
        event: "error",
        data: e.message
      });
    } else {
      console.error(e);
    }
  } finally {
    stream2.close();
  }
};
var contextStash = /* @__PURE__ */ new WeakMap();
var streamSSE = (c, cb, onError) => {
  const { readable, writable } = new TransformStream();
  const stream2 = new SSEStreamingApi(writable, readable);
  if (isOldBunVersion()) {
    c.req.raw.signal.addEventListener("abort", () => {
      if (!stream2.closed) {
        stream2.abort();
      }
    });
  }
  contextStash.set(stream2.responseReadable, c);
  c.header("Transfer-Encoding", "chunked");
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  run(stream2, cb, onError);
  return c.newResponse(stream2.responseReadable);
};

// src/shared/geometry/types.ts
var FUNCTION_KEYS = ["Ni", "Ne", "Si", "Se", "Ti", "Te", "Fi", "Fe"];
var ATTITUDE_OF = {
  Ni: "introverted",
  Si: "introverted",
  Ti: "introverted",
  Fi: "introverted",
  Ne: "extraverted",
  Se: "extraverted",
  Te: "extraverted",
  Fe: "extraverted"
};
var ORIENTATION_OF = {
  Ni: "perceiving",
  Ne: "perceiving",
  Si: "perceiving",
  Se: "perceiving",
  Ti: "judging",
  Te: "judging",
  Fi: "judging",
  Fe: "judging"
};
var EXTRAVERTED_FUNCTIONS = ["Ne", "Se", "Te", "Fe"];
var INTROVERTED_FUNCTIONS = ["Ni", "Si", "Ti", "Fi"];
var JUDGING_FUNCTIONS = ["Ti", "Te", "Fi", "Fe"];
var PERCEIVING_FUNCTIONS = ["Ni", "Ne", "Si", "Se"];
var AXIS_KEYS = ["Ni-Se", "Ne-Si", "Ti-Fe", "Te-Fi"];
var AXIS_MEMBERS = {
  "Ni-Se": ["Ni", "Se"],
  "Ne-Si": ["Ne", "Si"],
  "Ti-Fe": ["Ti", "Fe"],
  "Te-Fi": ["Te", "Fi"]
};
var AXIS_OF = {
  Ni: "Ni-Se",
  Se: "Ni-Se",
  Ne: "Ne-Si",
  Si: "Ne-Si",
  Ti: "Ti-Fe",
  Fe: "Ti-Fe",
  Te: "Te-Fi",
  Fi: "Te-Fi"
};
var AXIS_PARTNER_OF = {
  Ni: "Se",
  Se: "Ni",
  Ne: "Si",
  Si: "Ne",
  Ti: "Fe",
  Fe: "Ti",
  Te: "Fi",
  Fi: "Te"
};
var oppositeAttitude = (attitude) => attitude === "introverted" ? "extraverted" : "introverted";
var DEFAULT_B = 5;
var DEFAULT_SCALE_MAX = 50;
var MARGIN_FACTOR = 1.2;
function resolveOptions(opts) {
  const B = opts?.B ?? DEFAULT_B;
  const scaleMax = opts?.scaleMax ?? DEFAULT_SCALE_MAX;
  if (!Number.isFinite(B) || B <= 0) {
    throw new RangeError(`geometry: B must be a positive finite number (received ${String(B)})`);
  }
  if (!Number.isFinite(scaleMax) || scaleMax <= 0) {
    throw new RangeError(
      `geometry: scaleMax must be a positive finite number (received ${String(scaleMax)})`
    );
  }
  return { B, scaleMax };
}
function deriveThresholds(options) {
  const { B, scaleMax } = options;
  return {
    B,
    scaleMax,
    gap: B,
    marginalGap: marginOf(B),
    cliff: 2 * B,
    marginalCliff: marginOf(2 * B),
    balanced: B,
    leaning: 2 * B,
    polarized: 4 * B,
    flatSpread: 2 * B,
    moderateSpread: 4 * B,
    circuit: B,
    sealedCircuit: 2 * B,
    marginalCircuit: marginOf(B),
    // 02 §3 cutoffs are stated on the -1..+1 ratio scale, independent of B.
    tiltNeutral: 0.05,
    tiltMild: 0.15,
    // 02 §6: 37.5 and 12.5 on a 0-50 scale = the upper/lower quarter.
    allHigh: 0.75 * scaleMax,
    allLow: 0.25 * scaleMax
  };
}
function roundTo(value, dp) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** dp;
  const scaled = value * factor;
  const nudge = Math.abs(scaled) * Number.EPSILON * 8 + 1e-9;
  const rounded = scaled >= 0 ? Math.round(scaled + nudge) : -Math.round(-scaled + nudge);
  return rounded / factor;
}
var r1 = (value) => roundTo(value, 1);
var r2 = (value) => roundTo(value, 2);
var marginOf = (threshold) => roundTo(threshold * MARGIN_FACTOR, 6);
function isBorderlinePast(value, cutoff) {
  return value > cutoff && value <= marginOf(cutoff);
}
function inputOrder(scores) {
  const known = new Set(FUNCTION_KEYS);
  const seen = /* @__PURE__ */ new Set();
  const order2 = [];
  for (const key of Object.keys(scores)) {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key);
      order2.push(key);
    }
  }
  for (const key of FUNCTION_KEYS) {
    if (!seen.has(key)) order2.push(key);
  }
  return order2;
}
var SUPPLY_LADDER = [
  "flow",
  "near-flow",
  "scaffolded-stretch",
  "friction"
];

// src/shared/geometry/tiers.ts
function analyzeTiers(scores, options) {
  const t = deriveThresholds(options);
  const B = options.B;
  const warnings = [];
  const order2 = inputOrder(scores);
  const ranked = order2.map((fn, inputIndex) => ({ fn, score: scores[fn], inputIndex })).sort((a, b) => b.score - a.score || a.inputIndex - b.inputIndex);
  const sorted = ranked.map((entry, i) => {
    const prev = i > 0 ? ranked[i - 1] : null;
    return {
      fn: entry.fn,
      score: entry.score,
      rank: i,
      tiedWithPrev: prev !== null && prev.score === entry.score,
      noiseTieWithPrev: prev !== null && r1(prev.score - entry.score) <= B
    };
  });
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    gaps.push({
      index: i,
      above: sorted[i].fn,
      below: sorted[i + 1].fn,
      value: r1(sorted[i].score - sorted[i + 1].score)
    });
  }
  const spread = r1(sorted[0].score - sorted[sorted.length - 1].score);
  const anyCut = gaps.some((gap) => gap.value > t.gap);
  let regime = "NORMAL";
  if (spread <= t.flatSpread) regime = "FLAT";
  else if (!anyCut) regime = "STAIRCASE";
  const emptyTiers = { lead: [], support: [], reserve: [], shadow: [] };
  const noTierOf = Object.fromEntries(order2.map((fn) => [fn, null]));
  if (regime === "FLAT") {
    const largest = gaps.reduce((best, gap) => gap.value > best.value ? gap : best, gaps[0]);
    warnings.push(
      `FLAT regime: spread ${spread} is within the noise band's reach (<= ${t.flatSpread}). No tiers asserted; weak signal must be stated plainly rather than interpreted.`
    );
    return {
      regime,
      sorted,
      gaps,
      boundaries: [],
      segments: [],
      tiers: emptyTiers,
      tierOf: noTierOf,
      smears: [],
      activeSet: [],
      operativeLead: [],
      leadAttitudes: null,
      balancedLead: false,
      leadBoundary: null,
      shadowBoundary: null,
      elevatedSet: [],
      watchItem: {
        above: largest.above,
        below: largest.below,
        gap: largest.value,
        note: "Largest gap in a FLAT profile: a tentative watch item, not a tier boundary."
      },
      spread,
      warnings
    };
  }
  if (regime === "STAIRCASE") {
    const segment = makeSegment(0, sorted, null, B);
    warnings.push(
      "STAIRCASE regime: no adjacent gap exceeds the noise band, so no tier boundary exists. Only upper-edge vs lower-edge contrasts are interpretable (extremes-only reporting)."
    );
    return {
      regime,
      sorted,
      gaps,
      boundaries: [],
      segments: [segment],
      tiers: emptyTiers,
      tierOf: noTierOf,
      smears: [toSmear(segment, sorted, B)],
      activeSet: [],
      operativeLead: [],
      leadAttitudes: null,
      balancedLead: false,
      leadBoundary: null,
      shadowBoundary: null,
      elevatedSet: [],
      watchItem: null,
      spread,
      warnings
    };
  }
  const boundaries = gaps.filter((gap) => gap.value > t.gap).map((gap) => {
    const cliff = gap.value > t.cliff;
    const marginalCliff = cliff && gap.value <= t.marginalCliff;
    const marginal = gap.value <= t.marginalGap;
    let cls;
    if (cliff) cls = marginalCliff ? "marginal-cliff" : "firm-cliff";
    else cls = marginal ? "marginal-gap" : "firm-gap";
    return {
      index: gap.index,
      above: gap.above,
      below: gap.below,
      gap: gap.value,
      strength: r1(gap.value - t.gap),
      marginal,
      cliff,
      marginalCliff,
      class: cls
    };
  });
  const cutAfter = new Set(boundaries.map((b) => b.index));
  const rawSegments = [];
  let current = [];
  sorted.forEach((entry, i) => {
    current.push(entry);
    if (cutAfter.has(i) || i === sorted.length - 1) {
      rawSegments.push(current);
      current = [];
    }
  });
  const k = rawSegments.length;
  const segments = rawSegments.map(
    (members, i) => makeSegment(i, members, tierNameForSegment(i, k), B)
  );
  const tiers = {
    lead: segments[0].members,
    support: k >= 3 ? segments[1].members : [],
    reserve: k >= 4 ? segments.slice(2, k - 1).flatMap((s) => s.members) : [],
    shadow: k >= 2 ? segments[k - 1].members : []
  };
  const tierOf = { ...noTierOf };
  for (const segment of segments) {
    for (const fn of segment.members) tierOf[fn] = segment.tier;
  }
  const smears = segments.filter((segment) => segment.smeared).map((segment) => toSmear(segment, sorted, B));
  for (const smear of smears) {
    warnings.push(
      `Smeared ${smear.tier ?? "segment"} (span ${smear.span} > B): chained near-ties, no clean internal cut. Only the pairwise rule and edge windows are licensed.`
    );
  }
  const leadBoundary = boundaries.length > 0 ? boundaries[0] : null;
  const activeSet = [...tiers.lead];
  if (leadBoundary?.marginal && segments.length > 1) {
    for (const fn of segments[1].upperEdge) {
      if (!activeSet.includes(fn)) activeSet.push(fn);
    }
  }
  const leadSegment = segments[0];
  const operativeLead = leadSegment.smeared ? leadSegment.upperEdge : leadSegment.members;
  if (leadSegment.smeared) {
    warnings.push(
      `Lead cluster is smeared: the operative Lead reading is its upper edge (${leadSegment.upperEdge.join(", ")}); the report must hedge accordingly.`
    );
  }
  const leadAttitudeSet = new Set(operativeLead.map((fn) => ATTITUDE_OF[fn]));
  const leadAttitudes = leadAttitudeSet.size === 1 ? [...leadAttitudeSet][0] : "mixed";
  const balancedLead = leadAttitudeSet.size > 1;
  const elevatedSet = [...tiers.lead];
  for (const smear of smears) {
    for (const fn of smear.upperEdge) {
      if (!elevatedSet.includes(fn)) elevatedSet.push(fn);
    }
  }
  const shadowBoundary = boundaries.length > 0 ? boundaries[boundaries.length - 1] : null;
  if (boundaries.filter((b) => b.cliff).length >= 2) {
    warnings.push(
      "Multiple cliffs: a stratified profile. Each cliff is a separate interpretable feature; never rank functions inside any tier (02 \xA76)."
    );
  }
  return {
    regime,
    sorted,
    gaps,
    boundaries,
    segments,
    tiers,
    tierOf,
    smears,
    activeSet,
    operativeLead,
    leadAttitudes,
    balancedLead,
    leadBoundary,
    shadowBoundary,
    elevatedSet,
    watchItem: null,
    spread,
    warnings
  };
}
function tierNameForSegment(index, k) {
  if (index === 0) return "lead";
  if (index === k - 1) return "shadow";
  if (index === 1) return "support";
  return "reserve";
}
function makeSegment(index, members, tier, B) {
  const scores = members.map((m) => m.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const span = r1(max - min);
  return {
    index,
    tier,
    members: members.map((m) => m.fn),
    max,
    min,
    span,
    smeared: span > B,
    // Edge windows are defined inside a smeared segment (02 §2 step 6). In an
    // unsmeared segment every member is within B of both ends, so both windows
    // are the whole segment - which is what step 7 needs of an unsmeared T2.
    upperEdge: members.filter((m) => r1(max - m.score) <= B).map((m) => m.fn),
    lowerEdge: members.filter((m) => r1(m.score - min) <= B).map((m) => m.fn)
  };
}
function toSmear(segment, sorted, B) {
  const scoreOf = new Map(sorted.map((entry) => [entry.fn, entry.score]));
  const pairwise = [];
  for (let i = 0; i < segment.members.length; i += 1) {
    for (let j = i + 1; j < segment.members.length; j += 1) {
      const above = segment.members[i];
      const below = segment.members[j];
      const diff = r1((scoreOf.get(above) ?? 0) - (scoreOf.get(below) ?? 0));
      const genuinelyAbove = diff > B;
      pairwise.push({
        above,
        below,
        diff,
        genuinelyAbove,
        hedged: genuinelyAbove && diff <= r1(B * 1.2),
        tie: diff <= B
      });
    }
  }
  return {
    tier: segment.tier,
    segmentIndex: segment.index,
    members: segment.members,
    span: segment.span,
    upperEdge: segment.upperEdge,
    lowerEdge: segment.lowerEdge,
    pairwise
  };
}

// src/shared/geometry/indices.ts
function computeIndices(input) {
  const { scores, activeSet, spread, options } = input;
  const t = deriveThresholds(options);
  const sum = (keys) => r1(keys.reduce((total, fn) => total + scores[fn], 0));
  const sums = {
    total: sum(FUNCTION_KEYS),
    E: sum(EXTRAVERTED_FUNCTIONS),
    I: sum(INTROVERTED_FUNCTIONS),
    J: sum(JUDGING_FUNCTIONS),
    P: sum(PERCEIVING_FUNCTIONS)
  };
  const elevationValue = r2(sums.total / FUNCTION_KEYS.length);
  const allHigh = elevationValue >= t.allHigh;
  const allLow = elevationValue <= t.allLow;
  const elevationClass = allHigh ? "all-high" : allLow ? "all-low" : "mid";
  const elevation = {
    value: elevationValue,
    class: elevationClass,
    allHigh,
    allLow
  };
  const tiltValue = sums.total === 0 ? 0 : r2((sums.E - sums.I) / sums.total);
  const tilt = {
    value: tiltValue,
    class: classifyRatio(tiltValue, t.tiltNeutral, t.tiltMild),
    direction: tiltValue > 0 ? "outward" : tiltValue < 0 ? "inward" : "even",
    borderline: ratioBorderline(tiltValue, t.tiltNeutral, t.tiltMild)
  };
  const axisEntries = AXIS_KEYS.map((axis) => {
    const members = AXIS_MEMBERS[axis];
    const [a, b] = members;
    const pol = r1(Math.abs(scores[a] - scores[b]));
    const pairMean = r1((scores[a] + scores[b]) / 2);
    const aboveProfileMean = pairMean >= elevationValue;
    let cls;
    let borderline = false;
    if (pol <= t.balanced) {
      cls = aboveProfileMean ? "balanced-high" : "balanced-low";
    } else if (pol <= t.leaning) {
      cls = "leaning";
      borderline = isBorderlinePast(pol, t.balanced);
    } else if (pol <= t.polarized) {
      cls = "polarized";
      borderline = isBorderlinePast(pol, t.leaning);
    } else {
      cls = "extreme";
      borderline = isBorderlinePast(pol, t.polarized);
    }
    return {
      axis,
      members,
      high: scores[a] >= scores[b] ? a : b,
      low: scores[a] >= scores[b] ? b : a,
      pol,
      class: cls,
      borderline,
      pairMean,
      aboveProfileMean,
      tie: pol <= options.B
    };
  });
  const axes = Object.fromEntries(axisEntries.map((entry) => [entry.axis, entry]));
  const axisOrder = [...axisEntries].sort((a, b) => b.pol - a.pol || AXIS_KEYS.indexOf(a.axis) - AXIS_KEYS.indexOf(b.axis)).map((entry) => entry.axis);
  const jpValue = sums.total === 0 ? 0 : r2((sums.J - sums.P) / sums.total);
  const jp = {
    value: jpValue,
    class: classifyRatio(jpValue, t.tiltNeutral, t.tiltMild),
    direction: jpValue > 0 ? "judging" : jpValue < 0 ? "perceiving" : "even",
    borderline: ratioBorderline(jpValue, t.tiltNeutral, t.tiltMild),
    composition: composition(activeSet)
  };
  let diffClass;
  let diffBorderline = false;
  if (spread <= t.flatSpread) {
    diffClass = "low";
  } else if (spread <= t.moderateSpread) {
    diffClass = "moderate";
    diffBorderline = isBorderlinePast(spread, t.flatSpread);
  } else {
    diffClass = "high";
    diffBorderline = isBorderlinePast(spread, t.moderateSpread);
  }
  const differentiation = {
    value: spread,
    class: diffClass,
    borderline: diffBorderline
  };
  return { sums, tilt, axes, axisOrder, jp, differentiation, elevation };
}
function classifyRatio(value, neutral, mild) {
  const magnitude = Math.abs(value);
  if (magnitude <= neutral) return "neutral";
  if (magnitude <= mild) return "mild";
  return "strong";
}
function ratioBorderline(value, neutral, mild) {
  const magnitude = Math.abs(value);
  if (magnitude <= neutral) return false;
  if (magnitude <= mild) return isBorderlinePast(magnitude, neutral);
  return isBorderlinePast(magnitude, mild);
}
function composition(activeSet) {
  const judging = activeSet.filter((fn) => ORIENTATION_OF[fn] === "judging");
  const perceiving = activeSet.filter((fn) => ORIENTATION_OF[fn] === "perceiving");
  const populated = activeSet.length > 0;
  const allJudging = populated && perceiving.length === 0;
  const allPerceiving = populated && judging.length === 0;
  let fires = null;
  let starvedSide = null;
  if (allJudging) {
    fires = "judging-pressure";
    starvedSide = "perceiving";
  } else if (allPerceiving) {
    fires = "perceiving-pressure";
    starvedSide = "judging";
  }
  let note = null;
  if (populated && fires === null) {
    const heavier = judging.length >= perceiving.length ? "judging" : "perceiving";
    note = `${heavier}-heavy active set (${judging.length} J : ${perceiving.length} P)`;
  }
  return {
    activeSet: [...activeSet],
    judging,
    perceiving,
    allJudging,
    allPerceiving,
    fires,
    starvedSide,
    note
  };
}

// src/shared/geometry/shapes.ts
var NAMES = {
  S1: "Lead spike",
  S2: "Twin peak",
  S3: "Pluralistic lead cluster",
  S3b: "Pluralistic sub-cluster",
  S4: "Compressed top",
  S5: "Staircase",
  S6: "Flat",
  S7: "Cliff floor",
  S8: "Bimodal split",
  S9: "Polarized axis",
  S10: "Balanced-high axis",
  S11: "Balanced-low axis",
  S12: "Single-attitude lead (circuit candidate)"
};
function shape(id, partial = {}) {
  return {
    id,
    name: NAMES[id],
    grade: partial.grade ?? null,
    marginal: partial.marginal ?? false,
    hedged: partial.hedged ?? false,
    members: partial.members ?? [],
    detail: partial.detail ?? {},
    ...partial.axis !== void 0 ? { axis: partial.axis } : {},
    ...partial.variant !== void 0 ? { variant: partial.variant } : {}
  };
}
function computeShapes(input) {
  const { scores, tiers: analysis, indices, options } = input;
  const t = deriveThresholds(options);
  const warnings = [];
  if (analysis.regime === "FLAT") {
    return {
      shapes: [
        shape("S6", {
          hedged: true,
          detail: {
            differentiation: indices.differentiation.value,
            largestGap: analysis.watchItem?.gap ?? null,
            note: "Weak signal - honest null. No marker is derivable, which is the sentence the report must contain."
          }
        })
      ],
      circuit: null,
      warnings
    };
  }
  if (analysis.regime === "STAIRCASE") {
    const segment = analysis.segments[0];
    return {
      shapes: [
        shape("S5", {
          hedged: true,
          members: segment?.members ?? [],
          detail: {
            differentiation: indices.differentiation.value,
            upperEdge: segment?.upperEdge ?? [],
            lowerEdge: segment?.lowerEdge ?? [],
            note: "No adjacent rank is real; only upper-vs-lower-edge contrasts are interpretable."
          }
        })
      ],
      circuit: null,
      warnings
    };
  }
  const shapes = [];
  const { tiers, segments, boundaries, leadBoundary, shadowBoundary, operativeLead } = analysis;
  const leadSegment = segments[0];
  const lead = tiers.lead;
  const k = segments.length;
  const leadHedged = leadSegment.smeared;
  const leadDetail = {
    leadSize: lead.length,
    leadSmeared: leadHedged,
    operativeLead
  };
  if (lead.length === 1) {
    const g0 = leadBoundary?.gap ?? 0;
    let grade = "hard spike";
    if (g0 <= t.marginalGap) grade = "marginal spike";
    else if (g0 <= t.cliff) grade = "clear spike";
    shapes.push(
      shape("S1", {
        grade,
        marginal: g0 <= t.marginalGap,
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, gap: g0 }
      })
    );
  } else if (lead.length === 2) {
    const [a, b] = lead;
    const axisPartners = AXIS_PARTNER_OF[a] === b;
    const sameAttitude = ATTITUDE_OF[a] === ATTITUDE_OF[b];
    const variant = axisPartners ? "axis-partners" : sameAttitude ? "same-attitude" : "mixed";
    shapes.push(
      shape("S2", {
        variant,
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, axisPartners, sameAttitude }
      })
    );
  } else if (lead.length === 3) {
    const allJudging = lead.every((fn) => ORIENTATION_OF[fn] === "judging");
    shapes.push(
      shape("S3", {
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, allJudging }
      })
    );
  } else if (lead.length >= 4) {
    shapes.push(
      shape("S4", {
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, elevation: indices.elevation.value }
      })
    );
  }
  const subCluster = detectSubCluster(analysis, options.B);
  if (subCluster) {
    shapes.push(
      shape("S3b", {
        grade: "watch item",
        marginal: true,
        hedged: true,
        members: subCluster.members,
        variant: subCluster.source,
        detail: {
          source: subCluster.source,
          span: subCluster.span,
          note: "Membership rests on a marginal boundary and edge windows - never call it a lead cluster."
        }
      })
    );
  }
  if (tiers.shadow.length === 1 && shadowBoundary?.cliff) {
    shapes.push(
      shape("S7", {
        grade: shadowBoundary.marginalCliff ? "marginal" : "firm",
        marginal: shadowBoundary.marginalCliff,
        members: [...tiers.shadow],
        detail: {
          gap: shadowBoundary.gap,
          above: shadowBoundary.above,
          note: "Hold all three hypotheses: suppression, avoidance, simple non-development."
        }
      })
    );
  }
  if (k === 2 && boundaries.length === 1 && boundaries[0].cliff) {
    shapes.push(
      shape("S8", {
        grade: boundaries[0].marginalCliff ? "marginal" : "firm",
        marginal: boundaries[0].marginalCliff,
        members: [...tiers.lead, ...tiers.shadow],
        detail: {
          gap: boundaries[0].gap,
          highGroup: [...tiers.lead],
          lowGroup: [...tiers.shadow],
          note: "The entire lower group is the shadow floor; rendered eruption candidates are capped per 02 \xA76."
        }
      })
    );
  }
  for (const axisKey of indices.axisOrder) {
    const axis = indices.axes[axisKey];
    if (axis.class === "polarized" || axis.class === "extreme") {
      shapes.push(
        shape("S9", {
          axis: axisKey,
          grade: axis.class,
          marginal: axis.borderline,
          members: [axis.high, axis.low],
          detail: {
            pol: axis.pol,
            high: axis.high,
            low: axis.low,
            borderline: axis.borderline
          }
        })
      );
    } else if (axis.class === "balanced-high") {
      shapes.push(
        shape("S10", {
          axis: axisKey,
          members: [...axis.members],
          detail: {
            pol: axis.pol,
            pairMean: axis.pairMean,
            profileMean: indices.elevation.value,
            note: "Behavioural markers adjudicate; a felt sense of being torn decides nothing."
          }
        })
      );
    } else if (axis.class === "balanced-low") {
      shapes.push(
        shape("S11", {
          axis: axisKey,
          members: [...axis.members],
          detail: {
            pol: axis.pol,
            pairMean: axis.pairMean,
            profileMean: indices.elevation.value
          }
        })
      );
    }
  }
  let circuit = null;
  if (analysis.leadAttitudes !== "mixed" && analysis.leadAttitudes !== null) {
    const leadAttitude = analysis.leadAttitudes;
    const counterweight = highestOfAttitude(scores, oppositeAttitude(leadAttitude));
    const leadMinimum = Math.min(...operativeLead.map((fn) => scores[fn]));
    const strength = r1(leadMinimum - scores[counterweight]);
    if (strength > t.circuit) {
      const grade = strength <= t.sealedCircuit ? "moderate" : "sealed";
      const marginal = strength <= t.marginalCircuit;
      circuit = {
        kind: leadAttitude === "introverted" ? "internal" : "external",
        leadAttitude,
        lead: [...operativeLead],
        counterweight,
        counterweightScore: scores[counterweight],
        leadMinimum,
        strength,
        grade,
        marginal,
        fromSmearedLead: leadHedged
      };
      shapes.push(
        shape("S12", {
          grade,
          marginal,
          hedged: leadHedged,
          members: [...operativeLead],
          variant: circuit.kind,
          detail: {
            kind: circuit.kind,
            leadAttitude,
            counterweight,
            counterweightScore: circuit.counterweightScore,
            leadMinimum,
            strength
          }
        })
      );
    } else {
      warnings.push(
        `Attitude-uniform lead (${leadAttitude}) but circuit strength ${strength} does not exceed B: no circuit fires. At most one clause may note the uniform attitude.`
      );
    }
  } else if (analysis.balancedLead) {
    warnings.push(
      "Lead carries both attitudes: the balanced-lead dynamic applies (03 \xA73), mutually exclusive with a circuit reading."
    );
  }
  return { shapes, circuit, warnings };
}
function detectSubCluster(analysis, B) {
  const leadSegment = analysis.segments[0];
  if (leadSegment?.smeared && leadSegment.upperEdge.length >= 3) {
    const span = edgeSpan(leadSegment.upperEdge, analysis);
    if (span <= B) {
      return { members: [...leadSegment.upperEdge], span, source: "smeared-lead-upper-edge" };
    }
  }
  const support = analysis.segments[1];
  if (analysis.leadBoundary?.marginal && support && support.upperEdge.length >= 3) {
    const span = edgeSpan(support.upperEdge, analysis);
    if (span <= B) {
      return { members: [...support.upperEdge], span, source: "support-upper-edge" };
    }
  }
  return null;
}
function edgeSpan(members, analysis) {
  const scoreOf = new Map(analysis.sorted.map((entry) => [entry.fn, entry.score]));
  const values = members.map((fn) => scoreOf.get(fn) ?? 0);
  return r1(Math.max(...values) - Math.min(...values));
}
function highestOfAttitude(scores, attitude) {
  const order2 = inputOrder(scores);
  const candidates = order2.filter((fn) => ATTITUDE_OF[fn] === attitude);
  return candidates.reduce((best, fn) => scores[fn] > scores[best] ? fn : best, candidates[0]);
}
function strongestSharingAttitude(scores, fn) {
  const attitude = ATTITUDE_OF[fn];
  const order2 = inputOrder(scores).filter(
    (candidate) => candidate !== fn && ATTITUDE_OF[candidate] === attitude
  );
  if (order2.length === 0) return null;
  const best = order2.reduce(
    (winner, candidate) => scores[candidate] > scores[winner] ? candidate : winner,
    order2[0]
  );
  return { fn: best, score: scores[best] };
}
var SHAPE_IDS = Object.keys(NAMES);

// src/shared/geometry/eruption.ts
var ERUPTION_CAP = 2;
function computeEruption(input) {
  const { scores, tiers: analysis } = input;
  const warnings = [];
  const empty = {
    firm: [],
    watch: [],
    summaryOnly: [],
    capped: false,
    warnings
  };
  if (analysis.regime !== "NORMAL") return empty;
  const floor = analysis.tiers.shadow;
  const boundary = analysis.shadowBoundary;
  if (floor.length === 0 || boundary === null) return empty;
  const aboveScore = analysis.sorted[boundary.index]?.score ?? 0;
  const candidates = floor.map((fn) => {
    const partner = AXIS_PARTNER_OF[fn];
    const bridge = strongestSharingAttitude(scores, fn);
    return {
      fn,
      grade: boundary.cliff ? "firm" : "watch",
      marginal: boundary.cliff ? boundary.marginalCliff : true,
      boundaryGap: boundary.gap,
      depth: r1(aboveScore - scores[fn]),
      axisPartner: partner,
      axisPartnerElevated: analysis.elevatedSet.includes(partner),
      bridge: bridge?.fn ?? null,
      bridgeScore: bridge?.score ?? null
    };
  });
  const prioritized = [...candidates].sort(
    (a, b) => Number(b.axisPartnerElevated) - Number(a.axisPartnerElevated) || b.depth - a.depth || floor.indexOf(a.fn) - floor.indexOf(b.fn)
  );
  const firmAll = prioritized.filter((c) => c.grade === "firm");
  const watch = prioritized.filter((c) => c.grade === "watch");
  const firm = firmAll.slice(0, ERUPTION_CAP);
  const summaryOnly = firmAll.slice(ERUPTION_CAP);
  if (summaryOnly.length > 0) {
    warnings.push(
      `Eruption cap: ${firmAll.length} firm candidates qualify, ${ERUPTION_CAP} rendered (${firm.map((c) => c.fn).join(", ")}). Remaining floor members (${summaryOnly.map((c) => c.fn).join(", ")}) get one summary line, never a catalog.`
    );
  }
  if (watch.length > 0) {
    warnings.push(
      `Shadow floor sits below a gap that is not a cliff (${boundary.gap}): ${watch.map((c) => c.fn).join(", ")} is a hedged watch item only - at most one line, never a firm "When things get stressful" feature.`
    );
  }
  return { firm, watch, summaryOnly, capped: summaryOnly.length > 0, warnings };
}

// src/shared/geometry/supply.ts
var BASE_GRADE = {
  lead: "flow",
  support: "near-flow",
  reserve: "scaffolded-stretch",
  shadow: "friction"
};
function demote(grade) {
  if (grade === "friction") return "friction";
  const i = SUPPLY_LADDER.indexOf(grade);
  if (i < 0) return grade;
  const next = SUPPLY_LADDER[i + 1];
  if (next === void 0 || next === "friction") return "scaffolded-stretch";
  return next;
}
function computeSupplyGrades(input) {
  const grades = Object.fromEntries(FUNCTION_KEYS.map((fn) => [fn, "unrated"]));
  const forks = {};
  const warnings = [];
  if (input.regime !== "NORMAL") {
    warnings.push(
      `Supply grades unrated: the ${input.regime} regime asserts no tiers, so 02 \xA72.1's base-grade-by-tier rule has nothing to read from.`
    );
    return { grades, forks, warnings };
  }
  for (const segment of input.segments) {
    if (segment.tier === null) continue;
    const base = BASE_GRADE[segment.tier];
    for (const fn of segment.members) {
      if (!segment.smeared) {
        grades[fn] = base;
        continue;
      }
      const inUpper = segment.upperEdge.includes(fn);
      const inLower = segment.lowerEdge.includes(fn);
      const lowered = demote(base);
      if (inUpper && !inLower) {
        grades[fn] = base;
      } else if (inLower && !inUpper) {
        grades[fn] = lowered;
      } else if (base === lowered) {
        grades[fn] = base;
      } else {
        grades[fn] = "fork";
        forks[fn] = [base, lowered];
        warnings.push(
          `${fn} sits ${inUpper ? "in both edge windows" : "in neither edge window"} of a smeared ${segment.tier}: supply grade is a hedged fork between ${base} and ${lowered}.`
        );
      }
    }
  }
  return { grades, forks, warnings };
}

// src/shared/validation.ts
function validateScores(input, opts) {
  const scaleMax = opts?.scaleMax ?? DEFAULT_SCALE_MAX;
  const scaleMin = opts?.scaleMin ?? 0;
  const flags = [];
  const outOfRange = [];
  if (input === null || typeof input !== "object") {
    return {
      ok: false,
      scores: null,
      flags: [
        {
          code: "not-numeric",
          message: `Expected an object of eight scores, received ${describe(input)}.`,
          value: input
        }
      ],
      outOfRange: [],
      needsConfirmation: false
    };
  }
  const record = input;
  const known = new Set(FUNCTION_KEYS);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      flags.push({
        code: "unknown-key",
        key,
        value: record[key],
        message: `"${key}" is not one of the eight cognitive functions; it was ignored.`
      });
    }
  }
  const parsed = {};
  let hard = false;
  for (const fn of FUNCTION_KEYS) {
    const raw2 = record[fn];
    if (raw2 === void 0 || raw2 === null || typeof raw2 === "string" && raw2.trim() === "") {
      flags.push({ code: "missing", fn, value: raw2, message: `${fn} is required.` });
      hard = true;
      continue;
    }
    let value;
    if (typeof raw2 === "number") {
      value = raw2;
    } else if (typeof raw2 === "string" && raw2.trim() !== "" && !Number.isNaN(Number(raw2))) {
      value = Number(raw2);
    } else {
      flags.push({
        code: "not-numeric",
        fn,
        value: raw2,
        message: `${fn} must be a number (received ${describe(raw2)}).`
      });
      hard = true;
      continue;
    }
    if (!Number.isFinite(value)) {
      flags.push({
        code: "not-finite",
        fn,
        value: raw2,
        message: `${fn} must be a finite number (received ${describe(raw2)}).`
      });
      hard = true;
      continue;
    }
    parsed[fn] = value;
    if (value < scaleMin || value > scaleMax) {
      outOfRange.push(fn);
      flags.push({
        code: "out-of-range",
        fn,
        value,
        // The wording the UI echoes back: 02 §1 wants confirmation, not a clamp.
        message: `${fn} = ${value} is outside ${scaleMin}-${scaleMax}. Confirm this is what the test reported; the value will be used as given, not adjusted.`
      });
    }
  }
  if (hard) {
    return { ok: false, scores: null, flags, outOfRange, needsConfirmation: false };
  }
  return {
    ok: true,
    scores: parsed,
    flags,
    outOfRange,
    needsConfirmation: outOfRange.length > 0
  };
}
function describe(value) {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number") return String(value);
  return typeof value;
}

// src/shared/geometry/index.ts
function computeSignature(scores, opts) {
  const options = resolveOptions(opts);
  const thresholds = deriveThresholds(options);
  const warnings = [];
  for (const fn of FUNCTION_KEYS) {
    const value = scores[fn];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(
        `geometry: ${fn} must be a finite number (received ${String(value)}). Run validateScores() on user input before computing a signature.`
      );
    }
    if (value < 0 || value > options.scaleMax) {
      warnings.push(
        `${fn} = ${value} is outside the expected 0-${options.scaleMax} range. The value is used as given, never clamped; confirm the transcription.`
      );
    }
  }
  const tiers = analyzeTiers(scores, options);
  warnings.push(...tiers.warnings);
  const indices = computeIndices({
    scores,
    activeSet: tiers.activeSet,
    spread: tiers.spread,
    options
  });
  const { shapes, circuit, warnings: shapeWarnings } = computeShapes({
    scores,
    tiers,
    indices,
    options
  });
  warnings.push(...shapeWarnings);
  const eruption = computeEruption({ scores, tiers });
  warnings.push(...eruption.warnings);
  const supply = computeSupplyGrades({ regime: tiers.regime, segments: tiers.segments });
  warnings.push(...supply.warnings);
  if (indices.elevation.allHigh) {
    warnings.push(
      `Elevation ${indices.elevation.value} is at or above the all-high edge (${thresholds.allHigh}): interpret shape only - elevation is confounded with response style, and is never overall ability, health or development (02 \xA76).`
    );
  }
  if (indices.elevation.allLow) {
    warnings.push(
      `Elevation ${indices.elevation.value} is at or below the all-low edge (${thresholds.allLow}): interpret shape only. Never read low elevation as deficiency or distress - no diagnosis (02 \xA76).`
    );
  }
  if (indices.differentiation.class === "low" && tiers.regime !== "FLAT") {
    warnings.push(
      "Low differentiation: a weak signal the report must state plainly rather than fill with content (02 \xA73)."
    );
  }
  return {
    regime: tiers.regime,
    scores: { ...scores },
    options,
    thresholds,
    sorted: tiers.sorted,
    gaps: tiers.gaps,
    boundaries: tiers.boundaries,
    segments: tiers.segments,
    tiers: tiers.tiers,
    tierOf: tiers.tierOf,
    smears: tiers.smears,
    activeSet: tiers.activeSet,
    operativeLead: tiers.operativeLead,
    leadAttitudes: tiers.leadAttitudes,
    balancedLead: tiers.balancedLead,
    indices,
    shapes,
    circuit,
    eruption: {
      firm: eruption.firm,
      watch: eruption.watch,
      summaryOnly: eruption.summaryOnly,
      capped: eruption.capped
    },
    supplyGrades: supply.grades,
    supplyForks: supply.forks,
    watchItem: tiers.watchItem,
    warnings
  };
}

// src/shared/language.ts
var REPORT_LANGUAGES = ["en", "id"];
var DEFAULT_REPORT_LANGUAGE = "en";
function isReportLanguage(value) {
  return typeof value === "string" && REPORT_LANGUAGES.includes(value);
}

// src/server/kb/fragments.json
var fragments_default = {
  meta: {
    generator: "scripts/build-kb.mjs",
    sources: [
      "docs/knowledge/00-overview.md",
      "docs/knowledge/01-functions.md",
      "docs/knowledge/02-profile-geometry.md",
      "docs/knowledge/03-engagement-dynamics.md",
      "docs/knowledge/04-situational-conditioning.md",
      "docs/knowledge/05-report-generation.md"
    ],
    excluded: [
      "01 (f) situational demand cues, (g) confusable-with: not prompt material",
      "02 \xA74 *Detect:* clauses: detection is computed in src/shared/geometry",
      "03 worked-example paragraphs: geometry comes from the live Signature only",
      "04 \xA7e worked scenarios: unharmonized with 02 (KNOWN-ISSUES blocker)"
    ],
    fragmentCount: 79
  },
  fragments: {
    "functions.Ni.a": "**What it processes (community idea, unvalidated).** Perception through abstract association: it takes what is present and asks what it implies ; where things are heading, what they mean underneath, which single reading unifies scattered signals. Convergent: many observations narrowed, largely subconsciously, to one interpretation.",
    "functions.Ni.b": "**Engaged expression (community idea, unvalidated).** Watches a situation at length before committing, then acts with unusual conviction; routes decisions through a guiding purpose and struggles to choose without one; delays gratification for long-horizon ideals; habitually predicts how events will unfold and gets consulted for foresight; grows visibly adrift when life offers nothing significant to strive toward. (Contrast: an Se-led profile decides by engaging first and reading later.)",
    "functions.Ni.c": '**Over-engaged expression (community idea, generalized by Mindstack).** When Ni leads with the Ni\u2013Se axis polarized (Se far below), interpretation replaces contact with reality: sweeping assumptions harden because raw feedback never lands; expectations turn unrealistic and control-seeking ; the plan must be protected from the world; the present is graded against an ideal and always fails. Costs: missed opportunities, perfectionism, verdicts of "meaningless" on ordinary life.',
    "functions.Ni.d": '**Unengaged expression (community idea, generalized by Mindstack).** "Then what?" never gets asked. Decisions optimize the immediate and repeatedly produce long-run self-defeat; the person cannot picture a better life concretely enough to steer toward it; talk of meaning and implications registers as killjoy noise. Chronic signature: restlessness no new pleasure fixes. (False for any profile where Ni merely sits mid-band.)',
    "functions.Ni.e": '**Eruptive expression [D : Quenk via mbti-notes].** Dark forebodings and doomed-future panic; suspicion of ulterior motives everywhere; hunting mystical "signs"; inflated claims of insight or higher purpose ; crude, negative, out of character, subsiding when energy returns.',
    "functions.Ni.h": '**Supporting expression (Mindstack hypothesis).** As a second instrument, foresight shows up on request rather than by reflex: the person models implications competently in a planning session but does not live in that register. Near-flow supply is deliberate and good; scaffolded supply needs an explicit prompt ("where is this going?"). Degradation signature: under fatigue the horizon shortens first ; long-range framing collapses into next-step thinking.',
    "functions.Ne.a": "**What it processes (community idea, unvalidated).** Perception through lateral possibility: takes what exists and generates what it could become ; branching associations, reframings, alternatives. Divergent: one input, many outputs.",
    "functions.Ne.b": '**Engaged expression (community idea, unvalidated).** Visible excitement and urgency once an idea catches; brainstorms unprompted and thinks best out loud, bouncing ideas off people; assumes the old method is stale and reaches for a new one first; perks up instantly at "what if"; deflates conspicuously when told a situation cannot change.',
    "functions.Ne.c": "**Over-engaged expression (community idea, generalized by Mindstack).** When Ne leads with the Ne\u2013Si axis polarized (Si far below), possibility-chasing consumes maintenance: projects abandoned at 80%, steps skipped, the same mistakes repeated because past lessons are never consulted; what one has is taken for granted until lost; ever-larger novelty needed to feel hopeful. Unlike an Ne lead with live Si support, nothing accumulates.",
    "functions.Ne.d": '**Unengaged expression (community idea, generalized by Mindstack).** Alternatives simply are not generated: problems get lived with rather than re-imagined; viable exits from bad situations go unseen; "it could be different" is dismissed on principle; change is experienced as threat rather than material. Cost: stagnation invisible from inside.',
    "functions.Ne.e": "**Eruptive expression [D : Quenk via mbti-notes].** Worst-case spirals enumerating everything that could go wrong; future-paralysis; sudden credulity toward outlandish ideas; erratic, uninhibited acts and fits of hope quickly dashed.",
    "functions.Ne.h": "**Supporting expression (Mindstack hypothesis).** In a structured brainstorm, alternatives arrive ; but the stream needs a starter and stalls without one; reframing is a tool picked up, not a place lived in. Degradation signature: options collapse into an either/or; the person stops reframing and starts choosing.",
    "functions.Si.a": "**What it processes (community idea, unvalidated).** Perception through comparison with the archive: incoming detail matched against stored, verified experience; stability built from the known and proven.",
    "functions.Si.b": "**Engaged expression (community idea, unvalidated).** Catches discrepancies others miss; defaults to established procedure and can state it precisely; resistant first reaction to disrupted routine; decisions cite precedent; quiet command of logistics, maintenance, and follow-through.",
    "functions.Si.c": `**Over-engaged expression (community idea, generalized by Mindstack).** When Si leads with the Ne\u2013Si axis polarized (Ne far below), the untested becomes categorically risky: ideas ; and their bearers ; get shot down on arrival; overpreparation and ritual lock-in; the present compared unfavorably with an idealized past; worst-case readings of any change. Unlike an Si lead with live Ne, "we've never done it that way" ends inquiry instead of starting it.`,
    "functions.Si.d": "**Unengaged expression (community idea, generalized by Mindstack).** Careless with detail and procedure; repeats mistakes because the archive is never consulted; body signals, paperwork, and upkeep chronically neglected; routine experienced as suffocation. Cost: preventable failures, and a life that never compounds.",
    "functions.Si.e": "**Eruptive expression [D : Quenk via mbti-notes].** Hard-to-shake fixation on one trivial detail or one past mistake; health worry out of proportion to evidence; urgent, repetitive nitpicking; feeling unmoored and clinging to what little seems left.",
    "functions.Si.h": "**Supporting expression (Mindstack hypothesis).** Procedure and precedent are usable when the stakes are explicit: checklists get followed and records kept, with reminders and external structure carrying part of the load. Degradation signature: detail-verification is the first step skipped under time pressure.",
    "functions.Se.a": "**What it processes (community idea, unvalidated).** Perception through live engagement: direct, real-time sensory contact ; reading what is physically happening and responding as it happens.",
    "functions.Se.b": "**Engaged expression (community idea, unvalidated).** Near-instant responsiveness to change in the room; joins without hesitation; high stimulation tolerance ; energized rather than overwhelmed as pace rises; expressive physicality; drops what stops paying off and moves on without residue.",
    "functions.Se.c": '**Over-engaged expression (community idea, generalized by Mindstack).** When Se leads with the Ni\u2013Se axis polarized (Ni far below), stimulation loses direction: rising tolerance demands escalation; consequences outrun awareness; commitments feel like traps; beneath constant activity runs a numb "nothing means anything" undertow. Unlike an Se lead with live Ni, motion never converts into trajectory.',
    "functions.Se.d": "**Unengaged expression (community idea, generalized by Mindstack).** Spectates instead of acting; talked out of action by inner simulation; low tolerance for sensory intensity; misses what is literally in front of them while theorizing about it; enjoyment perpetually deferred to some qualifying future.",
    "functions.Se.e": "**Eruptive expression [D : Quenk via mbti-notes].** Out-of-character sensory binges (spending, food, drink, exercise); rigid physical control rituals (cleaning, organizing); clumsy, error-prone overreaction to minor physical events; excitement-grabs that end in apathy.",
    "functions.Se.h": "**Supporting expression (Mindstack hypothesis).** Given a beat to orient, real-time response is competent: a short internal rehearsal, then serviceable action. Degradation signature: tunnel focus ; the chosen action gets executed while the scene changes unnoticed behind it.",
    "functions.Ti.a": "**What it processes (community idea, unvalidated).** Judgment by internal consistency: dissects how things work, builds its own framework of principles, and accepts a claim only when it holds together on inspection.",
    "functions.Ti.b": "**Engaged expression (community idea, unvalidated).** First reaction to a complication is curiosity, not distress; troubleshoots alone before asking; plain, precise speech; spot-checks claims for contradiction regardless of the source's prestige; genuinely puzzled by escalation over things it has classified as inconsequential.",
    "functions.Ti.c": '**Over-engaged expression (community idea, generalized by Mindstack).** When Ti leads with the Ti\u2013Fe axis polarized (Fe far below), dissection turns reductive: whatever resists the model is ruled irrelevant rather than investigated; certainty grows exactly where feedback is ignored; the same relationship wall gets hit repeatedly; detachment shades into complicity ("not my problem"). Unlike a Ti lead with reachable Fe, being right quietly replaces being useful.',
    "functions.Ti.d": `**Unengaged expression (community idea, generalized by Mindstack).** Contradictions in one's own beliefs go unnoticed and unrepaired; positions collapse under questioning because they were adopted, never derived; conclusions need external validation to feel firm; "does this actually make sense?" is not a reflex.`,
    "functions.Ti.e": `**Eruptive expression [D : Quenk via mbti-notes].** Uncharacteristic cold criticality and suspicion; elaborate "logical backstories" explaining others' motives; relentless truth-quests to prove a point; feeling perfectly rational while everyone nearby reports otherwise.`,
    "functions.Ti.h": '**Supporting expression (Mindstack hypothesis).** Logical audit runs well when explicitly invoked ("does this actually hold?") but is not a reflex; verdicts need a sitting, not a glance. Degradation signature: the first coherent-sounding account gets accepted unexamined.',
    "functions.Te.a": "**What it processes (community idea, unvalidated).** Judgment by external effect: organizes people, resources, and steps toward measurable results; decides expeditiously from empirical evidence; treats disorder as a problem queue.",
    "functions.Te.b": '**Engaged expression (community idea, unvalidated).** Takes charge unprompted when nobody is steering; visibly frustrated by problems left sitting unsolved; frames everything in objectives, deadlines, and metrics; delegates and structures naturally; assesses ideas by "will it work, at what cost, by when."',
    "functions.Te.c": "**Over-engaged expression (community idea, generalized by Mindstack).** When Te leads with the Te\u2013Fi axis polarized (Fi far below), ends begin justifying means: other people's preferences register as friction; workaholism hollows out the private life it was supposed to fund; judgment goes black-and-white; success arrives and feels like nothing. Unlike a Te lead with live Fi, nobody ; including the person ; can say what the winning is *for*.",
    "functions.Te.d": "**Unengaged expression (community idea, generalized by Mindstack).** Analysis and feeling never converge into action; problems are re-described rather than closed; metrics, plans, and deadlines feel identity-erasing; logistics run chronically behind; capability visibly exceeds output.",
    "functions.Te.e": '**Eruptive expression [D : Quenk via mbti-notes].** Sudden bossy bluntness and belligerence from an otherwise non-directive person; an overpowering urge to "correct" everything wrong at once; blame-heavy verdicts; grand plans announced, then abandoned.',
    "functions.Te.h": "**Supporting expression (Mindstack hypothesis).** Organizing and shipping work when external structure exists ; a deadline, an owner, a visible deliverable. Degradation signature: plans still get made; follow-through thins first.",
    "functions.Fi.a": "**What it processes (community idea, unvalidated).** Judgment by felt congruence: measures options against an internal registry of values and attachments ; does this fit what I hold precious; can I stand behind it and remain myself.",
    "functions.Fi.b": "**Engaged expression (community idea, unvalidated).** Near-inability to act against a settled value, even at real cost; strong, stable, articulable likes and dislikes; defends the individual exception against the blanket rule; exits or quietly disrupts environments it reads as soulless; needs solitary time to settle feelings before re-engaging.",
    "functions.Fi.c": "**Over-engaged expression (community idea, generalized by Mindstack).** When Fi leads with the Te\u2013Fi axis polarized (Te far below), the personal swallows the situational: unrelated issues become referenda on the self; moral-purity policing and insincerity verdicts on others; ambitions stall while integrity is curated; mood becomes the day's governing fact. Unlike an Fi lead with live Te, being right about one's values never converts into changed circumstances.",
    "functions.Fi.d": `**Unengaged expression (community idea, generalized by Mindstack).** Preferences are weak or borrowed ; the group's values, the metric's values, "whatever works"; the person can function for years while unhappy; own needs surface only as burnout or resentment; asked "what do *you* want?", they produce an optimization, not a want.`,
    "functions.Fi.e": '**Eruptive expression [D : Quenk via mbti-notes].** Strange hypersensitivity to "unfair" treatment; righteous, absolute moral stances appearing overnight; sulking self-pity and vindictive brooding in someone usually businesslike.',
    "functions.Fi.h": "**Supporting expression (Mindstack hypothesis).** Personal-value checks happen when a decision is big enough to prompt one; day-to-day, expedience runs the show. Degradation signature: the values check gets deferred ; and surfaces later as unexplained unease about a choice already made.",
    "functions.Fe.a": "**What it processes (community idea, unvalidated).** Judgment by the interpersonal field: reads the emotional atmosphere as data ; who is at ease, who is excluded, what the moment will bear ; and acts to keep the human system connected and functioning.",
    "functions.Fe.b": "**Engaged expression (community idea, unvalidated).** Tracks how everyone in the room is doing and draws out the uninvolved; mirrors feeling so people sense they registered; smooths friction before it becomes conflict; adjusts register per audience without effort; goes beyond normal limits for others' comfort.",
    "functions.Fe.c": `**Over-engaged expression (community idea, generalized by Mindstack).** When Fe leads with the Ti\u2013Fe axis polarized (Ti far below), attunement goes boundaryless: self-image bends to the external gaze; self-advocacy needs backup; others get "harmonized" to soothe one's own fears; criticism lands as shame; disagreeable people receive character verdicts instead of analysis. Unlike an Fe lead with reachable Ti, "is it true?" never interrupts "how does it land?"`,
    "functions.Fe.d": '**Unengaged expression (community idea, generalized by Mindstack).** The room goes unread: stakeholders and loved ones are forgotten in decisions; valuing turns transactional; "insensitive" accusations arrive as ambushes; alienation accumulates as an unexplained background cost even when everything else runs well.',
    "functions.Fe.e": "**Eruptive expression [D : Quenk via mbti-notes].** Uncharacteristic approval-hunger and fishing for agreement; provoking one particular person for attention; escalating dramas; hard-to-shake guilt and shame; suspicion of being manipulated, out of proportion to evidence.",
    "functions.Fe.h": "**Supporting expression (Mindstack hypothesis).** The room can be read when deliberately attended to; hosting and smoothing are possible but priced ; they draw down the same budget as the main work. Degradation signature: attention to others' states is the first expenditure cut when tired.\n\n---",
    "dynamics.internal-circuit": `**Detection (consumes 02 S12).** Lead cluster entirely introverted (Ni/Si/Ti/Fi) AND circuit strength > B, where circuit strength = Lead minimum \u2212 counterweight score and the **counterweight** is the highest-scoring extraverted function. Grades, per 02: **moderate** (B < s \u2264 2B), **strong/sealed** (s > 2B); s \u2264 B \u2192 no circuit section.

**Generalizes.** The loop's avoidance economics (mbti-notes): same-attitude functions collude so the psyche fakes balance without leaving its preferred orientation, while the world-facing channel starves.

**Inside.** "I do my best thinking alone; checking against the world feels like an interruption : and faintly like a threat. My conclusions feel increasingly obvious to me and increasingly hard to explain to anyone else."

**Observable.** Long private processing chains; decisions announced rather than negotiated; reality-testing postponed ("once I've finished thinking it through"); surprise when execution meets a world that never read the internal memo.

**Trade-offs.** Real benefit: depth, independence, immunity to fads. Real cost: self-referential drift : errors compound uncorrected because the correction channel is priced out. Unlike an attitude-balanced lead (\xA73), there is no cheap moment when the outside world gets a vote.

**Composition variants (Mindstack hypothesis)** (compose with the lead functions' 01 blocks): Ni/Ti lead ; a *theory spiral*: the model of what's really going on grows internally consistent and externally unchecked. Ni/Fi ; a *meaning spiral*: significance and personal stance harden together. Si/Ti ; a *procedure spiral*: the proven method is re-derived ever more rigorously for a world that has moved. Si/Fi ; an *archive spiral*: precedent and loyalty fuse into "how it's always been for us."

**Stress trajectory.** Sustained pressure deepens withdrawal first, then primes eruption through the lowest extraverted function : crude, not skilled (see that function's eruptive-expression block in 01).

**Exit ramps.** The counterweight is the highest extraverted function. Name it and its activation conditions: cheap, low-stakes external contact in its own currency ; for a Te counterweight, a deadline with a visible deliverable; for Se, physical activity with immediate feedback; for Fe, one trusted person to think aloud at; for Ne, brainstorming with no commitment attached.`,
    "dynamics.external-circuit": `**Detection (consumes 02 S12).** Mirror rule: lead cluster entirely extraverted AND circuit strength > B, counterweight = highest-scoring introverted function. Same grades.

**Generalizes.** Same avoidance economics, opposite direction : mbti-notes' observation that extraverted one-sidedness produces motion without reflection.

**Inside.** "Slowing down feels like dying a little. There's always a next thing, and the next thing feels like the answer. When someone asks what it's all for, I change the subject : smoothly."

**Observable.** High output, packed calendar, decisions made mid-motion; introspective prompts deflected with action or humor; course corrections happen by collision rather than reflection.

**Trade-offs.** Benefit: momentum, responsiveness, visible productivity. Cost: direction is outsourced to the environment : the profile keeps solving whatever is in front of it, including problems not worth solving. Unlike an internal circuit, errors surface fast; their lessons just never get metabolized.

**Composition variants (Mindstack hypothesis):** Se/Te ; *execution churn*: doing and delivering as a way to never sit still. Se/Fe ; *stimulation-and-audience churn*: the next scene and the next room. Ne/Te ; *venture churn*: new initiatives outpace any review of the last one. Ne/Fe ; *possibility-and-people churn*: every conversation opens two more.

**Stress trajectory.** Escalating busyness masquerading as coping; eruption primed through the lowest introverted function : isolated Ni surfacing as doom-reading, isolated Fi as raw self-pity (see 01's eruptive-expression blocks).

**Exit ramps.** Counterweight = highest introverted function, activated by bounded reflection that doesn't threaten momentum: a journaling habit (Fi/Ni), a post-mortem ritual (Ti), a maintenance routine (Si).`,
    "dynamics.balanced-lead": `**Detection.** The lead cluster itself contains both attitudes. (Mutually exclusive with \xA71\u20132 by construction: 02 S12 requires a single-attitude lead.)

**Generalizes.** The source's health criterion : equilibrium between self-sense and world-contact ; but balance is not free, and a report that praises it without costs has failed.

**Inside.** "I can switch between my head and the room. The cost is that they argue: the inner read and the outer read rarely agree on the first pass."

**Observable.** Comfortable both initiating and reflecting; slower first moves than one-sided profiles because two channels must sync. The tell for the cost side is behavioral, not felt: the same decision re-made twice, once in each channel, within days : or stalls when inner conviction and external feedback deadlock.

**Trade-offs.** Benefit: built-in error correction and grip-resistance, since neither attitude is starved. Cost: switching overhead and genuine indecision under time pressure ; a one-sided profile beats this one for speed on its home turf. Note also (per 02 S10) that balanced-high can mean flexible switching *or* unresolved tension; the report holds both and names the behavioral discriminator.

**Stress trajectory.** Degrades gracefully toward whichever attitude is slightly stronger rather than erupting. Watch for oscillation: redoing the same decision alternately in each channel.

**Exit ramps.** None needed as escape. Instead, name arbitration conditions: which contexts get the inner channel's final vote and which the outer's.`,
    "dynamics.pluralistic": `**Detection (consumes 02).** Fires on **S2** (twin peak, |Lead| = 2), **S3** (pluralistic lead cluster, |Lead| = 3), or **S3b** (pluralistic sub-cluster: three or more functions mutually within one noise band forming the upper edge under a marginal lead boundary, or within a smeared lead). S3b readings are watch-item grade by construction : membership rests on a marginal boundary ; and are never called a "lead cluster." Sub-cases by composition: same-domain (all judging or all perceiving) vs cross-domain.

**Generalizes.** Nothing in the source ; canonical stacks forbid this shape, which makes it Mindstack's native discovery territory and pure (Mindstack hypothesis). Hypothesis pair to hold simultaneously: *deliberative flexibility* (multiple genuinely available tools) vs *decision friction* (competing criteria with no fixed arbiter).

**Inside** (same-domain judging): "I can argue any decision three ways : what's consistent, what works, what I can live with. Usually they agree. When they don't, I stall, and the stall feels like being three people."

**Observable.** Versatile justification style; context-dependent persona : colleagues disagree about what kind of thinker this person is; slow calls on trade-off-heavy decisions; choices occasionally re-litigated after the fact.

**Trade-offs.** A same-domain cluster buys rich evaluation at the price of starved intake or closure (\xA78). A cross-domain cluster is a self-contained perceive-judge team : faster closure, but the attitudes left out of the team may starve instead. The flattering read ("versatile") must always ship with the friction read; which is true is the user's call to test.

**Stress trajectory.** Pluralism under pressure tends to collapse to one member : usually whichever is cheapest in that context ; so the profile temporarily impersonates a spike; the bypassed criteria then return as second-guessing.

**Exit ramps.** Not an exit but an *arbitration protocol* (Mindstack hypothesis): deciding in advance which criterion rules which domain (e.g., Te for logistics, Fi for commitments).`,
    "dynamics.lead-spike": `**Detection (consumes 02 S1).** Single-function lead, graded by 02: **marginal spike** (gap \u2264 1.2B), **clear spike** (\u2264 2B), **hard spike** (> 2B).

**Generalizes.** Dominance economics (mbti-notes): the most-used tool is used because it is cheapest, and every use widens the gap : the hammer-and-nail principle. The geometry shows over-reliance, not talent.

**Inside.** "There's one way I trust to meet anything. It has never really failed me : which is exactly why I can't tell which problems it's currently failing on."

**Observable.** Remarkable fluency in one mode; visible discomfort when a situation refuses that mode; recurring, patterned failures in the same few contexts (the situational-fit signature the friction map in 04 formalizes).

**Trade-offs.** Benefit: identity clarity, deep skill, fast recovery by re-engaging the lead : the source's own remedy for bad states. Cost: a single point of failure. A spike over a strong support band is resilient; a spike over a desert is brittle.

**Stress trajectory.** The classic grip precondition (community idea, unvalidated): depletion knocks out the lead first ; the *first* symptom is losing the lead's ordinary quality, not the eruption ; then the floor function surfaces (\xA76).

**Exit ramps.** The top of the support band is the natural co-processor; activate it by framing tasks in its currency while stakes are low.`,
    "dynamics.shadow-floor": `**Detection (canonical rule: 02 \xA76).** **Firm eruption candidate:** a shadow-floor function whose boundary above is a cliff. **Watch item only:** a shadow-floor function above a gap-but-not-cliff boundary : one hedged line at most. Strongest form: the candidate is also the axis partner of a function in the lead cluster or upper edge, so polarization compounds isolation. Rendered candidates are capped at two, by 02 \xA76's priority order.

**Generalizes.** Quenk's repression rebound (community idea, unvalidated): what is systematically unengaged does not vanish; it accumulates and erupts in crude, infantile form when the executive is depleted : with eruptive force tracking the size of the gap. Re-keying it from the fixed inferior to gap-derived floors is Mindstack's move (community idea, generalized by Mindstack).

**Inside.** "That whole domain feels foreign : other people's business, slightly contemptible, vaguely threatening. Mostly I don't think about it. Then one bad week, it thinks about me."

**Observable.** Systematic avoidance of the floor function's domain; dismissive theorizing about it ("that stuff is irrational / boring / manipulative"); episodic out-of-character behavior in exactly that domain, followed by embarrassment.

**Trade-offs.** Benefit : say it honestly: not funding a channel frees enormous budget for the lead; many spiky-profile achievements are financed precisely by this neglect. Cost: a standing eruption candidate plus a predictable friction site in every situational context that demands the floored function.

**Stress trajectory** (community idea, unvalidated): sustained demand on the floor plus fatigue \u2192 loss of lead quality \u2192 eruption in the floor's characteristic crude form. **Eruption pointers** (full entries: the eruptive-expression blocks in 01, in lay behavioral language : keep it that way at rendering time, per 05 \xA75.8): Fe \u2192 sudden approval-hunger, hard-to-shake guilt, drama entanglement, suspicion of being manipulated; Ti \u2192 cold "logical backstories," relentless proving; Te \u2192 blunt aggression, an urge to correct everything at once; Fi \u2192 hypersensitivity, self-pity, absolute moral verdicts; Se \u2192 sensory bingeing, recklessness, rigid control rituals; Si \u2192 fixation on trivial details, health worry out of proportion to evidence, past-mistake brooding; Ne \u2192 worst-case spirals, outlandish credulity, lost inhibition; Ni \u2192 doom-reading, suspicious sign-hunting, inflated claims of insight.

**Exit ramps.** Never "develop the floor directly" : the source itself warns that direct inferior work destabilizes (community idea, unvalidated). Route through the **bridge function**: the strongest function sharing the floor's attitude, used as a bridge (Quenk's auxiliary-bridge logic, generalized (community idea, generalized by Mindstack)). Note the bridge function is *not* the circuit counterweight ; the counterweight is defined against a single-attitude lead (02 S12); the two are computed differently and merely coincide on some profiles. Add boundary design: pre-arranged cover for floor-demanding contexts.`,
    "dynamics.polarized-axes": "**Detection (consumes 02 \xA73's five-way scale verbatim).** Per axis (Ni\u2013Se, Ne\u2013Si, Ti\u2013Fe, Te\u2013Fi): balanced (\u2264 B; balanced-high / balanced-low by pair mean vs profile mean), leaning (\u2264 2B), polarized (\u2264 4B), extreme (> 4B).\n\n**Generalizes.** The source's contrarian-influence principle (community idea, unvalidated): a repressed pole still shapes the worldview through what gets disowned, disavowed, or defined as unimportant. Mindstack's extension: the starved pole's domain often takes on a devalued or faintly threatening cast [D\u2192H : our paraphrase, not source wording].\n\n**Per-axis predictions** (each fails to fire for balanced profiles : that is the point): Ni\u226BSe ; vision crowds out presence; flux reads as threat; eruption = crude Se. Se\u226BNi ; engagement without trajectory; implications read as killjoys; eruption = crude Ni. Ti\u226BFe ; independence guards against engulfment; the room's mood is illegible; eruption = crude Fe. Fe\u226BTi ; worth outsourced to the room; one's own analysis distrusted; eruption = crude Ti. Te\u226BFi ; throughput over congruence; feelings read as failure; eruption = crude Fi. Fi\u226BTe ; congruence over throughput; systems read as identity-erasure; eruption = crude Te. Si\u226BNe ; the known over the possible; novelty reads as danger; eruption = crude Ne. Ne\u226BSi ; the possible over maintenance; sameness reads as suffocation; eruption = crude Si.\n\n**Trade-offs.** Polarization is specialization: real power on the strong pole, purchased with a devalued blind spot. Balanced-high means flexible switching *or* unresolved tension ; adjudicated by 02 S10's behavioral markers (stable context-keyed assignment vs observable re-decision), never by a recognized feeling of torn-ness. Balanced-low: the channel is quiet; say little.\n\n**Rendering cap (Mindstack hypothesis).** To keep multi-axis profiles out of horoscope territory: render at most the single most polarized axis in full, plus one balanced-high fork; compress the rest to a single sentence (information budget, 05 \xA75.1).\n\n**Stress and exit.** Polarized axes are where \xA76 eruptions live; the exit ramp is always graded, low-stakes exposure to the weak pole's domain ; never immersion.",
    "dynamics.jp-pressure": `**Detection (consumes 02 \xA73).** The composition of the **active set** (02 \xA72 step 7: lead cluster, plus the upper edge of the next segment when the lead boundary is marginal): all-judging active set \u2192 judging pressure; all-perceiving \u2192 perceiving pressure; **mixed \u2192 no pressure dynamic fires** : at most one hedged composition note. The (\u03A3J \u2212 \u03A3P) index is context, never a trigger.

**Generalizes.** The source's P/J balance principle (community idea, unvalidated): conclusion-drawers starve without data-feeders; data-gatherers drown without organizers.

**Inside.** Judging pressure: "I have a verdict before I've finished looking." Perceiving pressure: "I see everything and settle nothing."

**Observable.** Judging pressure: fast opinions, premature closure, revisions forced by facts that arrived late. Perceiving pressure: rich intake, deferred decisions, deadlines as the only working closure mechanism.

**Trade-offs.** Decisiveness bought with accuracy; openness bought with paralysis. Neither reading is the flattering one, deliberately.

**Stress trajectory.** Judging pressure hardens : verdicts turn absolute; perceiving pressure floods ; options multiply. Eruption channel: the strongest function on the neglected side, in crude form.

**Exit ramps.** The **starved-side lever** (Mindstack hypothesis): the strongest function on the neglected side, with named conditions ; mandatory intake rituals before decisions (judging pressure); artificial closure devices ; deadlines, defaults, decision journals (perceiving pressure).`,
    "dynamics.weak-signal": '**Detection.** Fires exactly when 02 outputs regime **FLAT** (S6) or **STAIRCASE** (S5); this component adds no threshold of its own. (The earlier "compressed profile" 20-point rule is retired.)\n\n**What not to do.** Never narrate a flat profile as "perfectly balanced, rare, adaptable." That is the Barnum trap: flattering, unfalsifiable, and indistinguishable from measurement failure (Forer 1949 (established science)).\n\n**FLAT : honest hypotheses, hold all three:** genuine cross-context flexibility; a response style (mid-scale answering, ambivalence toward the items); or disengagement and self-opacity at test time. The input is a 96-item hobbyist instrument; a flat result is often a weak measurement, not a rich mind. Report behavior: **no dynamics sections at all** : circuits, spikes, floors, clusters, and pressures stay silent; surface the single largest gap as a tentative watch item; recommend a retest or the longer 256-item format before deeper interpretation (report schema: 05 \xA75.1).\n\n**STAIRCASE ; extremes only:** the upper-vs-lower-edge contrast is the sole licensed content; everything else stays silent.',
    "dynamics.development": `**Detection.** Always on : this section frames all the others.

**Generalizes.** The source's development timeline (lead differentiates in childhood; support maturation through the teens and twenties; mid-tier roughly 20\u201335; floor awareness 35+) (community idea, unvalidated), joined to what stability evidence actually exists: continuous type-scale scores are moderately stable (test\u2013retest \u2248 .61\u2013.75; Randall et al. 2017) (established science); categorical type assignments churn on retest (McCarley & Carskadon 1983, via Pittenger 2005; the MBTI's own manual reports roughly a third of retakers change type) (established science); and function-*order* stability on the Sakinorva instrument has never been measured at all ; its author informally reports results change on retake [D ; anecdote].

**Reading.** The profile is a photograph of current engagement, not an essence. Tier boundaries move: gaps narrow with deliberate practice and supportive environments, widen in environments that punish a function. Age-conditioning (Mindstack hypothesis), offered tentatively: a cliff at 22 is most parsimoniously simple non-development : that channel hasn't been needed yet; the same cliff at 50 raises the avoidance and suppression hypotheses ; but the report holds all three (02 S7) and lets the user adjudicate.

**Language rule.** "Currently," "lately," "this season" ; never "you are." Recommend retesting after major life changes; interpret band-level shifts, never rank churn inside the noise band.`,
    "shapes.S1": "**S1 \xB7 Lead spike.** *Hypotheses:* one mode is the reliable first reach in unstructured situations [D ; the source's dominant-identification heuristic]; cost side: hammer-and-nail over-application to mismatched situations (community idea, unvalidated). *Not:* skill or maturity in that domain ; investment \u2260 quality [D ; position is influence, not maturity]. *Falsifiable marker:* in novel low-stakes situations the first move should predictably be that mode (an Ni spike: pause and model implications before acting); a person whose first move varies freely falsifies the spike.",
    "shapes.S2": "**S2 \xB7 Twin peak.** *Hypotheses:* a working team of two, analogous to the community's dominant-auxiliary pairing (community idea, unvalidated); or alternation with occasional deadlock (Mindstack hypothesis). *Not:* a canonical dom-aux ; order within the pair is uninterpretable by the tie rule. *Marker:* the person can name distinct contexts where each mode leads; if one demonstrably leads everywhere, the second peak is overstated.",
    "shapes.S3": '**S3 \xB7 Pluralistic lead cluster.** *Hypotheses:* versatile context-switching vs. decision friction ; competing inner criteria and slow closure, especially if all three are judging functions (Mindstack hypothesis). *Not:* "well-rounded maturity." *Marker:* the friction hypothesis predicts a characteristic multi-criteria stall on big decisions; the flexibility hypothesis predicts smooth switching without distress. Fast single-criterion deciding falsifies both, and the cluster should then be read as compression noise.',
    "shapes.S3b": "**S3b \xB7 Pluralistic sub-cluster.** *Hypotheses:* as S3 ; deliberative flexibility vs. decision friction ; plus one structural hedge: membership rests on a marginal boundary and edge windows, so the whole reading is watch-item grade and must be rendered as a fork (Mindstack hypothesis). *Not:* a lead cluster ; never call it one. *Marker:* as S3.",
    "shapes.S4": "**S4 \xB7 Compressed top.** *Hypotheses:* prioritization filters not strongly set ; breadth of engagement bought at the cost of a default mode [H, inverting the source's efficiency-filter economics (community idea, unvalidated)]; or elevated, undifferentiated self-report. *Not:* mastery of four-plus functions. *Marker:* difficulty naming a single characteristic first move; an obvious signature first reach falsifies the face reading.",
    "shapes.S5": "**S5 \xB7 Staircase.** *Hypotheses:* gradual differentiation without discrete tiers; or measurement smear. *Not:* an eight-rung ladder ; no adjacent rank is real. *Marker:* only extreme contrasts (upper vs. lower edge) should ring true; if even top-vs-bottom contrasts don't, the profile carries no usable signal and the report says so. Report behavior: extremes-only (03 \xA79, 05 \xA75.5).",
    "shapes.S6": '**S6 \xB7 Flat.** *Interpretation:* weak signal ; honest null [hard rule]. Offered hypotheses only: genuinely even engagement, undifferentiated self-knowledge, or neutral/careless responding [D ; the source catalogs self-report failure modes]. *Not:* "you are balanced and adaptable" ; a Barnum item that flatters everyone and differentiates no one. *Marker:* none derivable ; which is exactly the sentence the report must contain. Report schema: 05 \xA75.1 and \xA75.5.',
    "shapes.S7": "**S7 \xB7 Cliff floor.** *Hypotheses ; hold all three* (Mindstack hypothesis): suppression (active repression, predicting eruptive return [D\u2192H ; Quenk's grip, via mbti-notes, re-keyed to gap-derived floors]); avoidance (the domain is feared or devalued [D ; the source's contrarian-influence principle: a repressed function still shapes the worldview through what gets disowned, disavowed, or defined as unimportant]); simple non-development (never practiced, no drama). *Not:* incapacity, and never a diagnosis. *Marker:* suppression predicts crude, out-of-character eruptions in that domain under fatigue or stress; non-development predicts plain absence without eruption ; which one the reader recognizes discriminates the hypotheses. Smooth handling of the domain under stress falsifies all three.",
    "shapes.S8": '**S8 \xB7 Bimodal split (hollow middle).** *Hypotheses:* all-or-nothing engagement ; trusted tools vs. shunned tools with no stretch zone (Mindstack hypothesis); if the high group shares one attitude, a defended structure (see S12). *Not:* "two personalities." *Marker:* friction-map predictions become step-shaped ; demands on the high group flow, demands on the low group grind, little in between. Graded performance across domains falsifies it. Note: the entire lower group is the shadow floor; friction applies to all of it, but rendered eruption candidates are capped per \xA76.',
    "shapes.S9": "**S9 \xB7 Polarized axis.** *Hypotheses:* one-sided channel processing ; the high pole does that axis's work while the starved pole is repressed rather than absent: it still shapes the worldview through what gets disowned, disavowed, or defined as unimportant [D ; the source's contrarian-influence principle]; Mindstack's own extension: the starved pole's domain often takes on a devalued or faintly threatening cast [D\u2192H ; our paraphrase, not source wording]. *Marker:* the axis-failure signature for the low pole (e.g., Ti\u226BFe: recurring relationship ceiling, missed social cues); fluent handling of that domain under pressure falsifies the reading.",
    "shapes.S10": `**S10 \xB7 Balanced-high axis.** *Competing hypotheses* (community idea, generalized by Mindstack): flexible both-ways processing vs. unresolved tug-of-war ; the axis's dilemma is live and costly. *Not:* automatic integration; the source treats reconciling an axis as a decades-long achievement (community idea, unvalidated). *Marker ; behavioral, not felt:* flexibility predicts stable context-keyed assignment (each recurring context reliably gets one pole); tension predicts observable re-decision ; the same decision re-made in the other pole's currency within days, or deadlock on trade-off calls. A generic recognized feeling of being "torn between X and Y" decides nothing ; nearly everyone endorses it [S: Forer 1949]; only the behavioral markers adjudicate. If neither behavioral marker fits, treat the index as noise.`,
    "shapes.S11": "**S11 \xB7 Balanced-low axis.** *Hypothesis:* the whole channel is quiet ; its dilemma (old/new, meaning/moment, autonomy/belonging, integrity/efficacy) is not where this person currently lives (Mindstack hypothesis). *Not:* a deficit verdict. *Marker:* that axis's dilemma should rarely surface as a lived theme; a reader for whom that exact tug-of-war is central falsifies the quiet-channel reading.",
    "shapes.S12": "**S12 \xB7 Single-attitude lead (circuit candidate).** *Not:* introversion/extraversion as sociability (community idea, unvalidated). *Marker:* an internal circuit predicts reality-testing starvation on long solo runs (plans never checked against the world); an external circuit predicts momentum without reflection. A reader who routinely activates the counterweight falsifies circuit risk.",
    "friction.intake-schema": `Six short questions. Each feeds specific machinery downstream (noted in italics).

- **WHO : relational field.** "Who is in this with you, and what do they expect of you? (alone / one familiar person / small team / strangers / an evaluator or authority)" *Feeds interpersonal demand types and the evaluative-audience modifier.*
- **WHAT : task type.** "What must you actually produce or handle? One sentence." *Feeds the primary demand classification (\xA7b).*
- **WHEN : timeframe and pressure.** "How much time is there, and who set the clock? (open-ended / self-imposed / hard external deadline / unfolding in real time)" *Feeds closure demands and the sustained-duration modifier.*
- **WHERE : setting and constraints.** "Where does this happen ; and can you leave, pause, or reshape the setting?" *Feeds sensory demands and the no-exit modifier.*
- **WHY : stakes and motivation.** "What happens if it goes badly? Do you personally care, or is the pressure external?" *Feeds the stress-load modifier and value-arbitration demands.*
- **HOW : methods and autonomy.** "Can you choose your own method and pace, or must you follow someone else's procedure and tools?" *Feeds procedural demands and the low-autonomy modifier.*`,
    "friction.demand-taxonomy": `A **demand profile** is the weighted set of function-demands extracted from one intake. Most situations carry two to four demands; the top-weighted demand drives the headline classification, the rest are named as secondary. Every mapping below cross-references the per-function demand cues in 01 ; the rationale column states *why* the situation rewards that function's operation, because a mapping without a rationale is unfalsifiable decoration.

| # | Demand type | Demands | Rationale (Mindstack hypothesis) | Typical intake cues |
|---|---|---|---|---|
| 1 | Open-ended ideation | Ne | Generating unprejudged alternatives; success = breadth | WHAT = "come up with options"; HOW = free |
| 2 | Long-horizon synthesis | Ni | Converging scattered signals into one trajectory or purpose | WHAT = "figure out where this is going"; WHEN = open |
| 3 | Real-time responsiveness | Se | Acting on a live scene as it changes; success = presence and speed | WHEN = real time; WHERE = physical |
| 4 | Procedural reliability | Si | Repeating a proven sequence exactly; error = deviation from precedent | HOW = fixed procedure; WHAT = maintenance |
| 5 | Precision systems analysis | Ti | Building or debugging an internally consistent model | WHAT = "why is this broken / is this correct" |
| 6 | Resource mobilization | Te | Sequencing people, time, tools toward measurable delivery | WHEN = deadline; WHAT = deliverable |
| 7 | Value arbitration | Fi | Deciding what one can personally stand behind when criteria conflict | WHY = personally charged; WHAT = ethical call |
| 8 | Group-atmosphere maintenance | Fe | Tracking and tending the shared emotional field | WHO = group, especially with tension |
| 9 | Emotional first response | Fe (Fi secondary) | Immediate attunement to a distressed person | WHO = someone upset, now |
| 10 | Ambiguity holding | Ne/Ni | Staying open without premature closure | WHAT = unresolved; WHEN = "too early to decide" |
| 11 | Closure under deadline | Te/Fe | Publicly committing to a decision on schedule | WHEN = hard deadline; WHO = waiting audience |
| 12 | Interruption multiplexing | Se/Ne | Many external pings; continuous reprioritization | WHERE = open/shared setting; WHEN = fragmented |
| 13 | Solitary depth work | Introverted battery (weighted by attitude tilt) | Long unbroken inward focus; costs scale with an extraverted tilt | WHO = alone; WHERE = private; WHEN = open |

Barnum check: each row must be able to *fail* to apply. Row 8 is a real demand for a wedding coordinator and absent for a lighthouse keeper; a report that finds every demand in every situation is broken.`,
    "friction.classification": "Computable from the engagement tiers of the profile plus the demand profile:\n\n- **Flow** : the demanded function sits in the **lead cluster**. Predict low-effort competence. Flow is not praise: repeated flow situations that never demand the opposite attitude feed closed circuits (see 03), so flow reports must name what the situation *isn't* exercising.\n- **Stretch** : the demanded function sits in the **support band** (**near-flow**: reliable, mildly effortful) or **reserve band** (workable with scaffolding; quality is the first casualty of fatigue).\n- **Friction** : the demanded function sits on the **shadow floor**, or isolated below a **cliff**. Predict **workaround substitution**: a lead or support function stands in for the demanded one (analysis where attunement was asked for, procedure where improvisation was) : sometimes passable, characteristically off-target.\n- **Eruption risk**: friction plus escalating context. Predict the demanded shadow function ; especially an axis partner of a lead function ; surfacing in crude, immature form under depletion (per 03's eruption expressions). [D ; Quenk's grip concept via mbti-notes, generalized \u2192 H]",
    "friction.modifiers": "**Escalation modifiers**, read straight off the intake: sustained duration (WHEN), high stakes/stress (WHY), no-exit (WHERE), low autonomy (HOW), evaluative audience (WHO). Working rule for the generator: friction + \u22652 modifiers \u2192 flag eruption risk; friction + 4\u20135 \u2192 flag it prominently and name early-warning signs. The threshold is a calibration guess (Mindstack hypothesis), not a finding.",
    "friction.template": `The output grammar. One canonical template, non-negotiable:

> **When** [situation detail], **you likely** [specific, observable prediction]; **if instead you find** [counter-observation], **that would tell us** [revision, which part of this guess needs updating].

Generator rules:

1. **No falsifier, no signature.** The third clause is what separates a hypothesis from a horoscope. It also operationalizes "the person is the authority."
2. **Predictions must differentiate.** A different profile must get a different sentence. Contrast framing is encouraged: "unlike a profile where Fe sits in the support band..."
3. **At least one signature per scenario states a cost or trade-off.** LLM sycophancy is documented (Sharma et al. 2024). This rule is the structural counterweight.
4. **Snapshot language only**: "currently," "lately," "in situations like this." Never "you are."
5. **Confidence inheritance**: a signature's hedging follows the lowest confidence level in its chain. If-then form (science-backed) + function mapping (our guess) = the sentence is presented as "one hypothesis to test."`,
    "always.development": `**Detection.** Always on : this section frames all the others.

**Generalizes.** The source's development timeline (lead differentiates in childhood; support maturation through the teens and twenties; mid-tier roughly 20\u201335; floor awareness 35+) (community idea, unvalidated), joined to what stability evidence actually exists: continuous type-scale scores are moderately stable (test\u2013retest \u2248 .61\u2013.75; Randall et al. 2017) (established science); categorical type assignments churn on retest (McCarley & Carskadon 1983, via Pittenger 2005; the MBTI's own manual reports roughly a third of retakers change type) (established science); and function-*order* stability on the Sakinorva instrument has never been measured at all ; its author informally reports results change on retake [D ; anecdote].

**Reading.** The profile is a photograph of current engagement, not an essence. Tier boundaries move: gaps narrow with deliberate practice and supportive environments, widen in environments that punish a function. Age-conditioning (Mindstack hypothesis), offered tentatively: a cliff at 22 is most parsimoniously simple non-development : that channel hasn't been needed yet; the same cliff at 50 raises the avoidance and suppression hypotheses ; but the report holds all three (02 S7) and lets the user adjudicate.

**Language rule.** "Currently," "lately," "this season" ; never "you are." Recommend retesting after major life changes; interpret band-level shifts, never rank churn inside the noise band.`,
    "always.state-honesty": `The profile is a **development snapshot**: a photograph of current engagement, not an essence. Fleeson's density-distribution work cuts both ways and the reports must honor both edges. (established science)

First: the person *is* the whole distribution, not its mean. The same profile genuinely reads differently under a different situation ; that is not a bug in the friction map, it is the finding that justifies the friction map's existence. A report that describes someone "in general" is describing nobody in particular; a report conditioned on a stated situation can be specifically right and specifically wrong, which is the only way to be informative.

Second: distributions move. Sustained changes in the situations a person inhabits ; a new job, a new role, deliberate practice ; shift the distribution of states, and with it, eventually, what a retest would measure [S ; Fleeson & Jayawickreme 2015]. So the friction map's forecasts decay: a friction verdict is "currently expensive," never "permanently yours." The generator must date its claims, invite retests after major life changes in the user's life, and treat every falsifier a user confirms as data that updates the profile ; because on every tier of this system, the person's lived experience outranks the map.`,
    "rules.disclaimer": "**What this is and is not.** This report is for self-reflection and entertainment only. It is not a psychological test. It is not a diagnosis. Do not use it for hiring, school admissions, medical decisions, or any other important decision. Professional testing standards (AERA/APA/NCME, 2014) say that every use of a score needs proof that it works for that use. We have no such proof at any level. Your scores come from a hobby quiz that has never been tested for accuracy. Small differences in your scores are just noise. People often get different results when they take the quiz again. The ideas in this report mix untested personality-community writing with our own guesses. If anything here does not match what you know about yourself, trust yourself. If you are going through a hard time, a report cannot help. A qualified professional can."
  }
};

// src/server/kb/loader.ts
var FRICTION_KEYS = [
  "intake-schema",
  "demand-taxonomy",
  "classification",
  "modifiers",
  "template"
];
var store = fragments_default;
if (!store || typeof store.fragments !== "object") {
  throw new Error("kb/loader: fragments.json has no `fragments` object");
}
function loadStore() {
  return store;
}
function get(key) {
  const text = loadStore().fragments[key];
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      `kb/loader: fragment "${key}" is missing from fragments.json. Rebuild with \`node scripts/build-kb.mjs\``
    );
  }
  return text;
}
function getFunctionBlock(fn, block) {
  return get(`functions.${fn}.${block}`);
}
function getDynamic(key) {
  return get(`dynamics.${key}`);
}
function getShape(id) {
  return get(`shapes.${id}`);
}
function getFriction(key) {
  return get(`friction.${key}`);
}
function getAlways() {
  return {
    development: get("always.development"),
    "state-honesty": get("always.state-honesty")
  };
}
function getDisclaimer() {
  return get("rules.disclaimer");
}

// node_modules/openai/internal/tslib.mjs
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

// node_modules/openai/internal/utils/uuid.mjs
var uuid4 = function() {
  const { crypto: crypto2 } = globalThis;
  if (crypto2?.randomUUID) {
    uuid4 = crypto2.randomUUID.bind(crypto2);
    return crypto2.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto2 ? () => crypto2.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};

// node_modules/openai/internal/errors.mjs
function isAbortError(err) {
  return typeof err === "object" && err !== null && // Spec-compliant fetch implementations
  ("name" in err && err.name === "AbortError" || // Expo fetch
  "message" in err && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError = (err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === "[object Error]") {
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack)
          error.stack = err.stack;
        if (err.cause && !error.cause)
          error.cause = err.cause;
        if (err.name)
          error.name = err.name;
        return error;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(err));
    } catch {
    }
  }
  return new Error(err);
};

// node_modules/openai/core/error.mjs
var OpenAIError = class extends Error {
};
var APIError = class _APIError extends OpenAIError {
  constructor(status, error, message, headers) {
    super(`${_APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.requestID = headers?.get("x-request-id");
    this.error = error;
    const data = error;
    this.code = data?.["code"];
    this.param = data?.["param"];
    this.type = data?.["type"];
  }
  static makeMessage(status, error, message) {
    const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
    if (status && msg) {
      return `${status} ${msg}`;
    }
    if (status) {
      return `${status} status code (no body)`;
    }
    if (msg) {
      return msg;
    }
    return "(no status code or body)";
  }
  static generate(status, errorResponse, message, headers) {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }
    const error = errorResponse?.["error"];
    if (status === 400) {
      return new BadRequestError(status, error, message, headers);
    }
    if (status === 401) {
      return new AuthenticationError(status, error, message, headers);
    }
    if (status === 403) {
      return new PermissionDeniedError(status, error, message, headers);
    }
    if (status === 404) {
      return new NotFoundError(status, error, message, headers);
    }
    if (status === 409) {
      return new ConflictError(status, error, message, headers);
    }
    if (status === 422) {
      return new UnprocessableEntityError(status, error, message, headers);
    }
    if (status === 429) {
      return new RateLimitError(status, error, message, headers);
    }
    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }
    return new _APIError(status, error, message, headers);
  }
};
var APIUserAbortError = class extends APIError {
  constructor({ message } = {}) {
    super(void 0, void 0, message || "Request was aborted.", void 0);
  }
};
var APIConnectionError = class extends APIError {
  constructor({ message, cause }) {
    super(void 0, void 0, message || "Connection error.", void 0);
    if (cause)
      this.cause = cause;
  }
};
var APIConnectionTimeoutError = class extends APIConnectionError {
  constructor({ message } = {}) {
    super({ message: message ?? "Request timed out." });
  }
};
var BadRequestError = class extends APIError {
};
var AuthenticationError = class extends APIError {
};
var PermissionDeniedError = class extends APIError {
};
var NotFoundError = class extends APIError {
};
var ConflictError = class extends APIError {
};
var UnprocessableEntityError = class extends APIError {
};
var RateLimitError = class extends APIError {
};
var InternalServerError = class extends APIError {
};
var LengthFinishReasonError = class extends OpenAIError {
  constructor() {
    super(`Could not parse response content as the length limit was reached`);
  }
};
var ContentFilterFinishReasonError = class extends OpenAIError {
  constructor() {
    super(`Could not parse response content as the request was rejected by the content filter`);
  }
};
var InvalidWebhookSignatureError = class extends Error {
  constructor(message) {
    super(message);
  }
};
var OAuthError = class extends APIError {
  constructor(status, error, headers) {
    let finalMessage = "OAuth2 authentication error";
    let error_code = void 0;
    if (error && typeof error === "object") {
      const errorData = error;
      error_code = errorData["error"];
      const description = errorData["error_description"];
      if (description && typeof description === "string") {
        finalMessage = description;
      } else if (error_code) {
        finalMessage = error_code;
      }
    }
    super(status, error, finalMessage, headers);
    this.error_code = error_code;
  }
};
var SubjectTokenProviderError = class extends OpenAIError {
  constructor(message, provider, cause) {
    super(message);
    this.provider = provider;
    this.cause = cause;
  }
};

// node_modules/openai/internal/utils/values.mjs
var startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
var isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
};
var isArray = (val) => (isArray = Array.isArray, isArray(val));
var isReadonlyArray = isArray;
function maybeObj(x) {
  if (typeof x !== "object") {
    return {};
  }
  return x ?? {};
}
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isObj(obj) {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}
var validatePositiveInteger = (name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new OpenAIError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new OpenAIError(`${name} must be a positive integer`);
  }
  return n;
};
var safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return void 0;
  }
};

// node_modules/openai/internal/utils/sleep.mjs
var sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));

// node_modules/openai/internal/shims.mjs
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new OpenAI({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream2 = globalThis.ReadableStream;
  if (typeof ReadableStream2 === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream2(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {
    },
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    }
  });
}
function ReadableStreamToAsyncIterable(stream2) {
  if (stream2[Symbol.asyncIterator])
    return stream2;
  const reader = stream2.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done)
          reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function CancelReadableStream(stream2) {
  if (stream2 === null || typeof stream2 !== "object")
    return;
  if (stream2[Symbol.asyncIterator]) {
    await stream2[Symbol.asyncIterator]().return?.();
    return;
  }
  const reader = stream2.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/openai/internal/utils/bytes.mjs
var encodeUTF8_;
function encodeUTF8(str2) {
  let encoder;
  return (encodeUTF8_ ?? (encoder = new globalThis.TextEncoder(), encodeUTF8_ = encoder.encode.bind(encoder)))(str2);
}
var decodeUTF8_;
function decodeUTF8(bytes) {
  let decoder;
  return (decodeUTF8_ ?? (decoder = new globalThis.TextDecoder(), decodeUTF8_ = decoder.decode.bind(decoder)))(bytes);
}

// node_modules/openai/internal/decoders/line.mjs
var _LineDecoder_instances;
var _LineDecoder_buffer;
var _LineDecoder_start;
var _LineDecoder_end;
var _LineDecoder_searchIndex;
var _LineDecoder_skipLeadingLF;
var _LineDecoder_append;
var MAX_RETAINED_BUFFER_BYTES = 64 * 1024;
var LineDecoder = class {
  /** Creates a decoder with no buffered bytes or pending newline continuation. */
  constructor() {
    _LineDecoder_instances.add(this);
    _LineDecoder_buffer.set(this, void 0);
    _LineDecoder_start.set(this, void 0);
    _LineDecoder_end.set(this, void 0);
    _LineDecoder_searchIndex.set(this, void 0);
    _LineDecoder_skipLeadingLF.set(this, void 0);
    __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array(), "f");
    __classPrivateFieldSet(this, _LineDecoder_start, 0, "f");
    __classPrivateFieldSet(this, _LineDecoder_end, 0, "f");
    __classPrivateFieldSet(this, _LineDecoder_searchIndex, 0, "f");
    __classPrivateFieldSet(this, _LineDecoder_skipLeadingLF, false, "f");
  }
  /**
   * Appends a text or UTF-8 byte chunk and returns every newly completed line.
   *
   * Incomplete lines remain buffered for the next call. A trailing `\r`
   * completes its line immediately, and a following `\n` is consumed as its
   * continuation. `null` and `undefined` are ignored and do not flush buffered
   * content.
   */
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    let binaryChunk;
    if (chunk instanceof ArrayBuffer) {
      binaryChunk = new Uint8Array(chunk);
    } else if (typeof chunk === "string") {
      binaryChunk = encodeUTF8(chunk);
    } else {
      binaryChunk = chunk;
    }
    if (binaryChunk.length === 0) {
      return [];
    }
    if (__classPrivateFieldGet(this, _LineDecoder_skipLeadingLF, "f")) {
      __classPrivateFieldSet(this, _LineDecoder_skipLeadingLF, false, "f");
      if (binaryChunk[0] === 10) {
        binaryChunk = binaryChunk.subarray(1);
      }
      if (binaryChunk.length === 0) {
        return [];
      }
    }
    __classPrivateFieldGet(this, _LineDecoder_instances, "m", _LineDecoder_append).call(this, binaryChunk);
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), __classPrivateFieldGet(this, _LineDecoder_searchIndex, "f"), __classPrivateFieldGet(this, _LineDecoder_end, "f"))) != null) {
      const line = decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_start, "f"), patternIndex.preceding));
      lines.push(line);
      __classPrivateFieldSet(this, _LineDecoder_start, patternIndex.index, "f");
      if (patternIndex.carriage) {
        if (__classPrivateFieldGet(this, _LineDecoder_start, "f") < __classPrivateFieldGet(this, _LineDecoder_end, "f") && __classPrivateFieldGet(this, _LineDecoder_buffer, "f")[__classPrivateFieldGet(this, _LineDecoder_start, "f")] === 10) {
          __classPrivateFieldSet(this, _LineDecoder_start, __classPrivateFieldGet(this, _LineDecoder_start, "f") + 1, "f");
        } else if (__classPrivateFieldGet(this, _LineDecoder_start, "f") === __classPrivateFieldGet(this, _LineDecoder_end, "f")) {
          __classPrivateFieldSet(this, _LineDecoder_skipLeadingLF, true, "f");
        }
      }
      __classPrivateFieldSet(this, _LineDecoder_searchIndex, __classPrivateFieldGet(this, _LineDecoder_start, "f"), "f");
    }
    __classPrivateFieldSet(this, _LineDecoder_searchIndex, __classPrivateFieldGet(this, _LineDecoder_end, "f"), "f");
    if (__classPrivateFieldGet(this, _LineDecoder_start, "f") === __classPrivateFieldGet(this, _LineDecoder_end, "f")) {
      __classPrivateFieldSet(this, _LineDecoder_start, 0, "f");
      __classPrivateFieldSet(this, _LineDecoder_end, 0, "f");
      __classPrivateFieldSet(this, _LineDecoder_searchIndex, 0, "f");
      if (__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length > MAX_RETAINED_BUFFER_BYTES) {
        __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array(), "f");
      }
    } else if (lines.length > 0 && __classPrivateFieldGet(this, _LineDecoder_buffer, "f").length > MAX_RETAINED_BUFFER_BYTES) {
      const length = __classPrivateFieldGet(this, _LineDecoder_end, "f") - __classPrivateFieldGet(this, _LineDecoder_start, "f");
      if (length <= MAX_RETAINED_BUFFER_BYTES || __classPrivateFieldGet(this, _LineDecoder_buffer, "f").length > length * 4) {
        const capacity = length <= MAX_RETAINED_BUFFER_BYTES ? Math.min(Math.max(length * 2, 256), MAX_RETAINED_BUFFER_BYTES) : length * 2;
        const buffer = new Uint8Array(capacity);
        buffer.set(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_start, "f"), __classPrivateFieldGet(this, _LineDecoder_end, "f")));
        __classPrivateFieldSet(this, _LineDecoder_buffer, buffer, "f");
        __classPrivateFieldSet(this, _LineDecoder_start, 0, "f");
        __classPrivateFieldSet(this, _LineDecoder_end, length, "f");
        __classPrivateFieldSet(this, _LineDecoder_searchIndex, length, "f");
      }
    }
    return lines;
  }
  /** Emits the remaining unterminated line, or returns an empty array when idle. */
  flush() {
    __classPrivateFieldSet(this, _LineDecoder_skipLeadingLF, false, "f");
    if (__classPrivateFieldGet(this, _LineDecoder_start, "f") === __classPrivateFieldGet(this, _LineDecoder_end, "f")) {
      return [];
    }
    return this.decode("\n");
  }
};
_LineDecoder_buffer = /* @__PURE__ */ new WeakMap(), _LineDecoder_start = /* @__PURE__ */ new WeakMap(), _LineDecoder_end = /* @__PURE__ */ new WeakMap(), _LineDecoder_searchIndex = /* @__PURE__ */ new WeakMap(), _LineDecoder_skipLeadingLF = /* @__PURE__ */ new WeakMap(), _LineDecoder_instances = /* @__PURE__ */ new WeakSet(), _LineDecoder_append = function _LineDecoder_append2(chunk) {
  if (__classPrivateFieldGet(this, _LineDecoder_end, "f") + chunk.length > __classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
    const length = __classPrivateFieldGet(this, _LineDecoder_end, "f") - __classPrivateFieldGet(this, _LineDecoder_start, "f");
    if (__classPrivateFieldGet(this, _LineDecoder_start, "f") >= __classPrivateFieldGet(this, _LineDecoder_buffer, "f").length / 2 && length + chunk.length <= __classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
      __classPrivateFieldGet(this, _LineDecoder_buffer, "f").copyWithin(0, __classPrivateFieldGet(this, _LineDecoder_start, "f"), __classPrivateFieldGet(this, _LineDecoder_end, "f"));
    } else {
      const capacity = Math.max(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length * 2, length + chunk.length, 256);
      const buffer = new Uint8Array(capacity);
      buffer.set(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_start, "f"), __classPrivateFieldGet(this, _LineDecoder_end, "f")));
      __classPrivateFieldSet(this, _LineDecoder_buffer, buffer, "f");
    }
    __classPrivateFieldSet(this, _LineDecoder_searchIndex, __classPrivateFieldGet(this, _LineDecoder_searchIndex, "f") - __classPrivateFieldGet(this, _LineDecoder_start, "f"), "f");
    __classPrivateFieldSet(this, _LineDecoder_end, length, "f");
    __classPrivateFieldSet(this, _LineDecoder_start, 0, "f");
  }
  __classPrivateFieldGet(this, _LineDecoder_buffer, "f").set(chunk, __classPrivateFieldGet(this, _LineDecoder_end, "f"));
  __classPrivateFieldSet(this, _LineDecoder_end, __classPrivateFieldGet(this, _LineDecoder_end, "f") + chunk.length, "f");
};
LineDecoder.NEWLINE_CHARS = /* @__PURE__ */ new Set(["\n", "\r"]);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function findNewlineIndex(buffer, start, end) {
  const newline = 10;
  const carriage = 13;
  for (let i = start; i < end; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }
    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }
  return null;
}
function findDoubleNewlineIndex(buffer) {
  for (let i = 0; i < buffer.length - 1; i++) {
    const firstEndingLength = lineEndingLength(buffer, i);
    if (firstEndingLength > 0) {
      const secondEndingIndex = i + firstEndingLength;
      const secondEndingLength = lineEndingLength(buffer, secondEndingIndex);
      if (secondEndingLength > 0) {
        return secondEndingIndex + secondEndingLength;
      }
    }
  }
  return -1;
}
function lineEndingLength(buffer, index) {
  const newline = 10;
  const carriage = 13;
  if (buffer[index] === newline) {
    return 1;
  }
  if (buffer[index] === carriage) {
    return buffer[index + 1] === newline ? 2 : 1;
  }
  return 0;
}

// node_modules/openai/internal/utils/log.mjs
var levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
};
var parseLogLevel = (maybeLevel, sourceName, client) => {
  if (!maybeLevel) {
    return void 0;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return void 0;
};
function noop() {
}
function makeLogFn(fnLevel, logger, logLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger[fnLevel].bind(logger);
  }
}
var noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop
};
var cachedLoggers = /* @__PURE__ */ new WeakMap();
function loggerFor(client) {
  const logger = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger) {
    return noopLogger;
  }
  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger, logLevel),
    warn: makeLogFn("warn", logger, logLevel),
    info: makeLogFn("info", logger, logLevel),
    debug: makeLogFn("debug", logger, logLevel)
  };
  cachedLoggers.set(logger, [logLevel, levelLogger]);
  return levelLogger;
}
var formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "authorization" || name.toLowerCase() === "api-key" || name.toLowerCase() === "x-api-key" || name.toLowerCase() === "x-amz-security-token" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};

// node_modules/openai/core/streaming.mjs
var _Stream_client;
var Stream = class _Stream {
  /** Wraps an asynchronous event iterator and the controller that owns its request. */
  constructor(iterator, controller, client) {
    _Stream_client.set(this, void 0);
    this.iterator = iterator;
    this.controller = controller;
    __classPrivateFieldSet(this, _Stream_client, client, "f");
  }
  /**
   * Decodes an SSE response into parsed JSON events.
   *
   * The resulting stream can be consumed only once, ignores events after `[DONE]`, and
   * surfaces API error payloads as `APIError` instances. When
   * `synthesizeEventData` is enabled, each item also includes its SSE event name.
   */
  static fromSSEResponse(response, controller, client, synthesizeEventData) {
    let consumed = false;
    const logger = client ? loggerFor(client) : console;
    async function* iterator() {
      if (consumed) {
        throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      let receivedCompletionSentinel = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (sse.data.startsWith("[DONE]")) {
            receivedCompletionSentinel = true;
            break;
          }
          if (sse.event === null || !sse.event.startsWith("thread.")) {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              logger.error(`Could not parse message into JSON:`, sse.data);
              logger.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (data && data.error) {
              throw new APIError(void 0, data.error, void 0, response.headers);
            }
            yield synthesizeEventData ? { event: sse.event, data } : data;
          } else {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              console.error(`Could not parse message into JSON:`, sse.data);
              console.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (sse.event === "error") {
              throw new APIError(void 0, data.error, data.message, void 0);
            }
            yield { event: sse.event, data };
          }
        }
        done = true;
      } catch (e) {
        if (receivedCompletionSentinel || isAbortError(e) || controller.signal.aborted && e === controller.signal.reason) {
          return;
        }
        throw e;
      } finally {
        if (!done) {
          controller.abort();
        }
      }
    }
    return new _Stream(iterator, controller, client);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(readableStream, controller, client) {
    let consumed = false;
    async function* iterLines() {
      const lineDecoder = new LineDecoder();
      const reader = readableStream.getReader();
      let closed = false;
      let cancelPromise;
      const cancel = () => {
        cancelPromise ?? (cancelPromise = reader.cancel());
        cancelPromise.catch(() => void 0);
      };
      controller.signal.addEventListener("abort", cancel, { once: true });
      try {
        if (controller.signal.aborted) {
          cancel();
          return;
        }
        while (true) {
          const { value: chunk, done } = await reader.read();
          if (done) {
            closed = true;
            break;
          }
          if (controller.signal.aborted) {
            return;
          }
          for (const line of lineDecoder.decode(chunk)) {
            if (controller.signal.aborted) {
              return;
            }
            yield line;
          }
        }
        if (controller.signal.aborted) {
          return;
        }
        for (const line of lineDecoder.flush()) {
          if (controller.signal.aborted) {
            return;
          }
          yield line;
        }
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        if (!closed) {
          cancel();
        }
        reader.releaseLock();
      }
    }
    async function* iterator() {
      if (consumed) {
        throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const line of iterLines()) {
          if (done) {
            continue;
          }
          if (line) {
            yield JSON.parse(line);
          }
        }
        done = true;
      } catch (e) {
        if (controller.signal.aborted || isAbortError(e)) {
          return;
        }
        throw e;
      } finally {
        if (!done) {
          controller.abort();
        }
      }
    }
    return new _Stream(iterator, controller, client);
  }
  /** Starts consuming this stream; attempting to consume it again throws. */
  [(_Stream_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const left = [];
    const right = [];
    const iterator = this.iterator();
    const teeIterator = (queue) => ({
      next: () => {
        if (queue.length === 0) {
          const result = iterator.next();
          left.push(result);
          right.push(result);
        }
        return queue.shift();
      }
    });
    return [
      new _Stream(() => teeIterator(left), this.controller, __classPrivateFieldGet(this, _Stream_client, "f")),
      new _Stream(() => teeIterator(right), this.controller, __classPrivateFieldGet(this, _Stream_client, "f"))
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    let iter;
    return makeReadableStream({
      start: async () => {
        iter = this[Symbol.asyncIterator]();
      },
      async pull(ctrl) {
        try {
          const { value, done } = await iter.next();
          if (done) {
            return ctrl.close();
          }
          const bytes = encodeUTF8(JSON.stringify(value) + "\n");
          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      }
    });
  }
};
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    if (globalThis.navigator !== void 0 && globalThis.navigator.product === "ReactNative") {
      throw new OpenAIError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
    }
    throw new OpenAIError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder();
  const lineDecoder = new LineDecoder();
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse) {
        yield sse;
      }
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse) {
      yield sse;
    }
  }
}
var DOUBLE_NEWLINE_DELIMITER_MAX_OVERLAP_BYTES = 3;
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array();
  let dataStart = 0;
  let dataEnd = 0;
  let searchStartIndex = 0;
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    let binaryChunk;
    if (chunk instanceof ArrayBuffer) {
      binaryChunk = new Uint8Array(chunk);
    } else if (typeof chunk === "string") {
      binaryChunk = encodeUTF8(chunk);
    } else {
      binaryChunk = chunk;
    }
    if (dataEnd + binaryChunk.length > data.length) {
      const bufferedLength = dataEnd - dataStart;
      if (dataStart >= data.length / 2 && bufferedLength + binaryChunk.length <= data.length) {
        data.copyWithin(0, dataStart, dataEnd);
      } else {
        const newData = new Uint8Array(Math.max(data.length * 2, bufferedLength + binaryChunk.length));
        newData.set(data.subarray(dataStart, dataEnd));
        data = newData;
      }
      searchStartIndex -= dataStart;
      dataStart = 0;
      dataEnd = bufferedLength;
    }
    data.set(binaryChunk, dataEnd);
    dataEnd += binaryChunk.length;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data.subarray(searchStartIndex, dataEnd))) !== -1) {
      patternIndex += searchStartIndex;
      yield data.slice(dataStart, patternIndex);
      dataStart = patternIndex;
      searchStartIndex = dataStart;
    }
    searchStartIndex = Math.max(dataStart, dataEnd - DOUBLE_NEWLINE_DELIMITER_MAX_OVERLAP_BYTES);
  }
  if (dataEnd > dataStart) {
    yield data.slice(dataStart, dataEnd);
  }
}
var SSEDecoder = class {
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    if (!line) {
      if (!this.event && !this.data.length) {
        return null;
      }
      const sse = {
        event: this.event,
        data: this.data.join("\n"),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    const [fieldname, , initialValue] = partition(line, ":");
    let value = initialValue;
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
};
function partition(str2, delimiter) {
  const index = str2.indexOf(delimiter);
  if (index !== -1) {
    return [str2.slice(0, index), delimiter, str2.slice(index + delimiter.length)];
  }
  return [str2, "", ""];
}

// node_modules/openai/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    if (props.options.stream) {
      loggerFor(client).debug("response", response.status, response.url, response.headers, response.body);
      if (props.options.__streamClass) {
        return props.options.__streamClass.fromSSEResponse(response, props.controller, client, props.options.__synthesizeEventData);
      }
      return Stream.fromSSEResponse(response, props.controller, client, props.options.__synthesizeEventData);
    }
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = contentType?.split(";")[0]?.trim();
    const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
    if (isJSON) {
      const contentLength = response.headers.get("content-length");
      if (contentLength === "0") {
        return void 0;
      }
      const bodyText = await response.text();
      if (!bodyText) {
        return void 0;
      }
      const json = JSON.parse(bodyText);
      return addRequestID(json, response);
    }
    const text = await response.text();
    return text;
  })().catch((error) => {
    throw asAbortError(error, props.controller.signal);
  });
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}
function asAbortError(error, signal) {
  if (!signal.aborted || error !== signal.reason || isAbortError(error)) {
    return error;
  }
  const message = "This operation was aborted";
  const DOMExceptionConstructor = globalThis.DOMException;
  return typeof DOMExceptionConstructor === "function" ? new DOMExceptionConstructor(message, "AbortError") : Object.assign(new Error(message), { name: "AbortError" });
}
function addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("x-request-id"),
    enumerable: false
  });
}

// node_modules/openai/version.mjs
var VERSION = "7.5.0";

// node_modules/openai/internal/detect-platform.mjs
var isRunningInBrowser = () => {
  return (
    // @ts-ignore
    typeof window !== "undefined" && // @ts-ignore
    typeof window.document !== "undefined" && // @ts-ignore
    typeof navigator !== "undefined"
  );
};
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
var getPlatformProperties = () => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match2 = pattern.exec(navigator.userAgent);
    if (match2) {
      const major = match2[1] || 0;
      const minor = match2[2] || 0;
      const patch = match2[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var normalizeArch = (arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
};
var normalizePlatform = (platform) => {
  platform = platform.toLowerCase();
  if (platform.includes("ios"))
    return "iOS";
  if (platform === "android")
    return "Android";
  if (platform === "darwin")
    return "MacOS";
  if (platform === "win32")
    return "Windows";
  if (platform === "freebsd")
    return "FreeBSD";
  if (platform === "openbsd")
    return "OpenBSD";
  if (platform === "linux")
    return "Linux";
  if (platform)
    return `Other:${platform}`;
  return "Unknown";
};
var _platformHeaders;
var getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};

// node_modules/openai/internal/request-options.mjs
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/openai/internal/qs/formats.mjs
var default_format = "RFC3986";
var default_formatter = String;
var formatters = {
  RFC1738: (v) => String(v).replace(/%20/g, "+"),
  RFC3986: default_formatter
};
var RFC1738 = "RFC1738";

// node_modules/openai/internal/qs/utils.mjs
var cachedHas;
var has = (obj, key) => {
  const resolvedHas = cachedHas ?? Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  cachedHas = resolvedHas;
  return resolvedHas(obj, key);
};
var hex_table = /* @__PURE__ */ (() => {
  const array = [];
  for (let i = 0; i < 256; ++i) {
    array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
  }
  return array;
})();
var limit = 1024;
var encode = (str2, _defaultEncoder, charset, _kind, format) => {
  if (str2.length === 0) {
    return str2;
  }
  let string = str2;
  if (typeof str2 === "symbol") {
    string = Symbol.prototype.toString.call(str2);
  } else if (typeof str2 !== "string") {
    string = String(str2);
  }
  if (charset === "iso-8859-1") {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, ($0) => "%26%23" + Number.parseInt($0.slice(2), 16) + "%3B");
  }
  let out = "";
  for (let j = 0; j < string.length; ) {
    let segmentEnd = Math.min((Math.floor(j / limit) + 1) * limit, string.length);
    if (segmentEnd < string.length && string.codePointAt(segmentEnd - 1) > 65535) {
      segmentEnd += 1;
    }
    const segment = string.length >= limit ? string.slice(j, segmentEnd) : string;
    const arr = [];
    for (let i = 0; i < segment.length; ++i) {
      let c = segment.charCodeAt(i);
      if (c === 45 || // -
      c === 46 || // .
      c === 95 || // _
      c === 126 || // ~
      c >= 48 && c <= 57 || // 0-9
      c >= 65 && c <= 90 || // a-z
      c >= 97 && c <= 122 || // A-Z
      format === RFC1738 && (c === 40 || c === 41)) {
        arr[arr.length] = segment.charAt(i);
        continue;
      }
      if (c < 128) {
        arr[arr.length] = hex_table[c];
        continue;
      }
      if (c < 2048) {
        arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
        continue;
      }
      if (c < 55296 || c >= 57344) {
        arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
        continue;
      }
      i += 1;
      c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
      arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
    }
    out += arr.join("");
    j = segmentEnd;
  }
  return out;
};
function is_buffer(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function maybe_map(val, fn) {
  if (isArray(val)) {
    const mapped = [];
    for (const item of val) {
      mapped.push(fn(item));
    }
    return mapped;
  }
  return fn(val);
}

// node_modules/openai/internal/qs/stringify.mjs
var array_prefix_generators = {
  brackets(prefix) {
    return String(prefix) + "[]";
  },
  comma: "comma",
  indices(prefix, key) {
    return String(prefix) + "[" + key + "]";
  },
  repeat(prefix) {
    return String(prefix);
  }
};
var push_to_array = function push_to_array2(arr, value_or_array) {
  Array.prototype.push.apply(arr, isArray(value_or_array) ? value_or_array : [value_or_array]);
};
var toISOString;
var defaults = {
  addQueryPrefix: false,
  allowDots: false,
  allowEmptyArrays: false,
  arrayFormat: "indices",
  charset: "utf-8",
  charsetSentinel: false,
  delimiter: "&",
  encode: true,
  encodeDotInKeys: false,
  encoder: encode,
  encodeValuesOnly: false,
  format: default_format,
  formatter: default_formatter,
  /** @deprecated */
  indices: false,
  serializeDate(date) {
    return (toISOString ?? (toISOString = Function.prototype.call.bind(Date.prototype.toISOString)))(date);
  },
  skipNulls: false,
  strictNullHandling: false
};
function is_non_nullish_primitive(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
var sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
  let obj = object;
  let tmp_sc = sideChannel;
  let step = 0;
  let find_flag = false;
  while ((tmp_sc = tmp_sc.get(sentinel)) !== void 0 && !find_flag) {
    const pos = tmp_sc.get(object);
    step += 1;
    if (pos !== void 0) {
      if (pos === step) {
        throw new RangeError("Cyclic object value");
      } else {
        find_flag = true;
      }
    }
    if (tmp_sc.get(sentinel) === void 0) {
      step = 0;
    }
  }
  if (typeof filter === "function") {
    obj = filter(prefix, obj);
  } else if (obj instanceof Date) {
    obj = serializeDate?.(obj);
  } else if (generateArrayPrefix === "comma" && isArray(obj)) {
    obj = maybe_map(obj, (value) => {
      if (value instanceof Date) {
        return serializeDate?.(value);
      }
      return value;
    });
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder && !encodeValuesOnly ? (
        // @ts-expect-error
        encoder(prefix, defaults.encoder, charset, "key", format)
      ) : prefix;
    }
    obj = "";
  }
  if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
    if (encoder) {
      const key_value = encodeValuesOnly ? prefix : (
        // @ts-expect-error
        encoder(prefix, defaults.encoder, charset, "key", format)
      );
      return [
        formatter?.(key_value) + "=" + // @ts-expect-error
        formatter?.(encoder(obj, defaults.encoder, charset, "value", format))
      ];
    }
    return [formatter?.(prefix) + "=" + formatter?.(String(obj))];
  }
  const values = [];
  if (obj === void 0) {
    return values;
  }
  let obj_keys;
  if (generateArrayPrefix === "comma" && isArray(obj)) {
    if (encodeValuesOnly && encoder) {
      obj = maybe_map(obj, encoder);
    }
    obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
  } else if (isArray(filter)) {
    obj_keys = filter;
  } else {
    const keys = Object.keys(obj);
    if (sort) {
      keys.sort(sort);
    }
    obj_keys = keys;
  }
  const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
  const adjusted_prefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
  if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
    return adjusted_prefix + "[]";
  }
  for (const key of obj_keys) {
    const value = (
      // @ts-ignore
      typeof key === "object" && key.value !== void 0 ? key.value : obj[key]
    );
    if (skipNulls && value === null) {
      continue;
    }
    const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
    let key_prefix;
    if (isArray(obj)) {
      key_prefix = typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix;
    } else {
      key_prefix = adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
    }
    sideChannel.set(object, step);
    const valueSideChannel = new WeakMap([[sentinel, sideChannel]]);
    push_to_array(values, inner_stringify(
      value,
      key_prefix,
      generateArrayPrefix,
      commaRoundTrip,
      allowEmptyArrays,
      strictNullHandling,
      skipNulls,
      encodeDotInKeys,
      // @ts-ignore
      generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder,
      filter,
      sort,
      allowDots,
      serializeDate,
      format,
      formatter,
      encodeValuesOnly,
      charset,
      valueSideChannel
    ));
  }
  return values;
}
function normalize_stringify_options(opts = defaults) {
  if (opts.allowEmptyArrays !== void 0 && typeof opts.allowEmptyArrays !== "boolean") {
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  }
  if (opts.encodeDotInKeys !== void 0 && typeof opts.encodeDotInKeys !== "boolean") {
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  }
  if (opts.encoder !== null && opts.encoder !== void 0 && typeof opts.encoder !== "function") {
    throw new TypeError("Encoder has to be a function.");
  }
  const charset = opts.charset || defaults.charset;
  if (opts.charset !== void 0 && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  }
  let format = default_format;
  if (opts.format !== void 0) {
    if (!has(formatters, opts.format)) {
      throw new TypeError("Unknown format option provided.");
    }
    format = opts.format;
  }
  const formatter = formatters[format];
  let filter = defaults.filter;
  if (typeof opts.filter === "function" || isArray(opts.filter)) {
    filter = opts.filter;
  }
  let arrayFormat;
  if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
    arrayFormat = opts.arrayFormat;
  } else if ("indices" in opts) {
    arrayFormat = opts.indices ? "indices" : "repeat";
  } else {
    arrayFormat = defaults.arrayFormat;
  }
  if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  }
  let allowDots;
  if (opts.allowDots === void 0) {
    allowDots = !!opts.encodeDotInKeys === true ? true : defaults.allowDots;
  } else {
    allowDots = !!opts.allowDots;
  }
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
    // @ts-ignore
    allowDots,
    allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
    arrayFormat,
    charset,
    charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
    commaRoundTrip: !!opts.commaRoundTrip,
    delimiter: opts.delimiter === void 0 ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
    encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
    encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter,
    format,
    formatter,
    serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
    // @ts-ignore
    sort: typeof opts.sort === "function" ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
  };
}
function stringify(object, opts = {}) {
  let obj = object;
  const options = normalize_stringify_options(opts);
  let obj_keys;
  let filter;
  if (typeof options.filter === "function") {
    filter = options.filter;
    obj = filter("", obj);
  } else if (isArray(options.filter)) {
    filter = options.filter;
    obj_keys = filter;
  }
  const keys = [];
  if (typeof obj !== "object" || obj === null) {
    return "";
  }
  const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
  const commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
  if (!obj_keys) {
    obj_keys = Object.keys(obj);
  }
  if (options.sort) {
    obj_keys.sort(options.sort);
  }
  const sideChannel = /* @__PURE__ */ new WeakMap();
  for (const key of obj_keys) {
    if (options.skipNulls && obj[key] === null) {
      continue;
    }
    push_to_array(keys, inner_stringify(
      obj[key],
      key,
      // @ts-expect-error
      generateArrayPrefix,
      commaRoundTrip,
      options.allowEmptyArrays,
      options.strictNullHandling,
      options.skipNulls,
      options.encodeDotInKeys,
      options.encode ? options.encoder : null,
      options.filter,
      options.sort,
      options.allowDots,
      options.serializeDate,
      options.format,
      options.formatter,
      options.encodeValuesOnly,
      options.charset,
      sideChannel
    ));
  }
  const joined = keys.join(options.delimiter);
  let prefix = options.addQueryPrefix === true ? "?" : "";
  if (options.charsetSentinel) {
    prefix += options.charset === "iso-8859-1" ? (
      // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
      "utf8=%26%2310003%3B&"
    ) : (
      // encodeURIComponent('✓')
      "utf8=%E2%9C%93&"
    );
  }
  return joined.length > 0 ? prefix + joined : "";
}

// node_modules/openai/internal/utils/query.mjs
function stringifyQuery(query) {
  return stringify(query, { arrayFormat: "brackets" });
}

// node_modules/openai/core/api-promise.mjs
var _APIPromise_client;
var APIPromise = class _APIPromise extends Promise {
  constructor(client, responsePromise, parseResponse2 = defaultParseResponse) {
    super((resolve2) => {
      resolve2(null);
    });
    this.responsePromise = responsePromise;
    this.parseResponse = parseResponse2;
    _APIPromise_client.set(this, void 0);
    __classPrivateFieldSet(this, _APIPromise_client, client, "f");
  }
  _thenUnwrap(transform) {
    return new _APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => addRequestID(transform(await this.parseResponse(client, props), props), props.response));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the X-Request-ID header which is useful for debugging requests and reporting
   * issues to OpenAI.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response, request_id: response.headers.get("x-request-id") };
  }
  parse() {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
    }
    return this.parsedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.parse().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.parse().catch(onrejected);
  }
  finally(onfinally) {
    return this.parse().finally(onfinally);
  }
};
_APIPromise_client = /* @__PURE__ */ new WeakMap();

// node_modules/openai/core/pagination.mjs
var _AbstractPage_client;
var AbstractPage = class {
  constructor(client, response, body, options) {
    _AbstractPage_client.set(this, void 0);
    __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
    this.options = options;
    this.response = response;
    this.body = body;
  }
  hasNextPage() {
    const items = this.getPaginatedItems();
    if (!items.length)
      return false;
    return this.nextPageRequestOptions() != null;
  }
  async getNextPage() {
    const nextOptions = this.nextPageRequestOptions();
    if (!nextOptions) {
      throw new OpenAIError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    }
    return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
  }
  async *iterPages() {
    let page = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }
  async *[(_AbstractPage_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    for await (const page of this.iterPages()) {
      for (const item of page.getPaginatedItems()) {
        yield item;
      }
    }
  }
};
var PagePromise = class extends APIPromise {
  constructor(client, request, Page2) {
    super(client, request, async (client2, props) => new Page2(client2, props.response, await defaultParseResponse(client2, props), props.options));
  }
  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const page = await this;
    for await (const item of page) {
      yield item;
    }
  }
};
var Page = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.object = body.object;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  nextPageRequestOptions() {
    return null;
  }
};
var CursorPage = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  nextPageRequestOptions() {
    const data = this.getPaginatedItems();
    const id = data[data.length - 1]?.id;
    if (!id) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        after: id
      }
    };
  }
};
var ConversationCursorPage = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
    this.last_id = body.last_id || "";
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  nextPageRequestOptions() {
    const cursor = this.last_id;
    if (!cursor) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        after: cursor
      }
    };
  }
};
var NextCursorPage = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
    this.next = body.next || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  nextPageRequestOptions() {
    const cursor = this.next;
    if (!cursor) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        after: cursor
      }
    };
  }
};

// node_modules/openai/auth/workload-identity-auth.mjs
var SUBJECT_TOKEN_TYPES = {
  jwt: "urn:ietf:params:oauth:token-type:jwt",
  id: "urn:ietf:params:oauth:token-type:id_token"
};
var TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
var WorkloadIdentityAuth = class _WorkloadIdentityAuth {
  /**
   * Creates a workload-identity token cache and OAuth token-exchange client.
   *
   * @param config External identity provider, OpenAI service account, and refresh settings.
   * @param fetch Optional fetch implementation for calls to the OpenAI token endpoint.
   */
  constructor(config2, fetch2) {
    this.cachedToken = null;
    this.refreshPromise = null;
    this.tokenGeneration = 0;
    this.tokenExchangeUrl = "https://auth.openai.com/oauth/token";
    this.config = config2;
    this.fetch = fetch2 ?? getDefaultFetch();
  }
  /**
   * Returns a valid OpenAI access token, exchanging or refreshing credentials as needed.
   *
   * Cached tokens nearing expiration are returned immediately while a background
   * refresh runs. Concurrent callers share the same in-flight token exchange.
   *
   * @throws {OAuthError} When the token endpoint rejects the subject token or identity.
   * @throws {APIError} When another unsuccessful HTTP response prevents token exchange.
   * @throws {OpenAIError} When a successful exchange has an invalid access token or expiration.
   */
  async getToken() {
    if (!this.cachedToken || _WorkloadIdentityAuth.isTokenExpired(this.cachedToken)) {
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      const refreshPromise = this.refreshToken(this.tokenGeneration);
      this.refreshPromise = refreshPromise;
      try {
        return await refreshPromise;
      } finally {
        if (this.refreshPromise === refreshPromise) {
          this.refreshPromise = null;
        }
      }
    }
    if (this.needsRefresh(this.cachedToken) && !this.refreshPromise) {
      const refreshPromise = this.refreshToken(this.tokenGeneration).finally(() => {
        if (this.refreshPromise === refreshPromise) {
          this.refreshPromise = null;
        }
      });
      this.refreshPromise = refreshPromise;
      void refreshPromise.catch(() => null);
    }
    return this.cachedToken.token;
  }
  async refreshToken(generation) {
    const subjectToken = await this.config.provider.getToken();
    const body = {
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      subject_token: subjectToken,
      subject_token_type: SUBJECT_TOKEN_TYPES[this.config.provider.tokenType],
      identity_provider_id: this.config.identityProviderId,
      service_account_id: this.config.serviceAccountId
    };
    if (this.config.clientId) {
      body["client_id"] = this.config.clientId;
    }
    const response = await this.fetch(this.tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      redirect: "manual"
    });
    if (!response.ok) {
      const errorText = await response.text();
      let body2 = void 0;
      try {
        body2 = JSON.parse(errorText);
      } catch {
      }
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new OAuthError(response.status, body2, response.headers);
      }
      throw APIError.generate(response.status, body2, `Token exchange failed with status ${response.status}`, response.headers);
    }
    const tokenResponse = await response.json();
    if (typeof tokenResponse !== "object" || tokenResponse === null || !("access_token" in tokenResponse) || typeof tokenResponse.access_token !== "string" || tokenResponse.access_token.trim().length === 0) {
      throw new OpenAIError("Token exchange response missing 'access_token' field");
    }
    const accessToken = tokenResponse.access_token;
    const expiresIn = tokenResponse.expires_in ?? 3600;
    if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new OpenAIError("Token exchange response has invalid 'expires_in' field");
    }
    const now = Date.now();
    const expiresAt = now + expiresIn * 1e3;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
      throw new OpenAIError("Token exchange response has invalid 'expires_in' field");
    }
    if (this.tokenGeneration === generation) {
      this.cachedToken = {
        token: accessToken,
        expiresAt
      };
    }
    return accessToken;
  }
  static isTokenExpired(cachedToken) {
    return Date.now() >= cachedToken.expiresAt;
  }
  needsRefresh(cachedToken) {
    const bufferSeconds = this.config.refreshBufferSeconds ?? 1200;
    const bufferMs = bufferSeconds * 1e3;
    return Date.now() >= cachedToken.expiresAt - bufferMs;
  }
  /** Discards the cached access token so the next request performs a fresh exchange. */
  invalidateToken() {
    this.tokenGeneration += 1;
    this.cachedToken = null;
    this.refreshPromise = null;
  }
};

// node_modules/openai/internal/headers.mjs
var brand_privateNullableHeaders = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
var httpTokenHeaderName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === void 0)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}
var buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers();
  const nullHeaders = /* @__PURE__ */ new Set();
  for (const headers of newHeaders) {
    const seenHeaders = /* @__PURE__ */ new Set();
    for (const [name, value] of iterateHeaders(headers)) {
      if (!httpTokenHeaderName.test(name)) {
        throw new TypeError(`Header name must be a valid HTTP token ["${name}"]`);
      }
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(lowerName);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(lowerName);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(lowerName, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

// node_modules/openai/internal/uploads.mjs
var brand_privateStreamingFile = /* @__PURE__ */ Symbol("brand.privateStreamingFile");
function toStreamingFile(data, name, options) {
  if (typeof name !== "string" || !name) {
    throw new TypeError("toStreamingFile requires a non-empty file name");
  }
  const type = options?.type;
  if (type) {
    validateStreamingFileType(type);
  }
  return {
    [brand_privateStreamingFile]: true,
    data,
    name,
    ...type ? { type } : {}
  };
}
var checkFileSupport = () => {
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof process2?.versions?.node === "string" && Number.parseInt(process2.versions.node.split("."), 10) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to a supported Node.js LTS release, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value, options) {
  if (typeof value !== "object" || value === null) {
    return void 0;
  }
  const explicitName = "name" in value && value.name && String(value.name) || "filename" in value && value.filename && String(value.filename);
  if (explicitName) {
    return options?.stripFilename === false ? normalizeFilenamePath(explicitName) : basename(explicitName);
  }
  const url = "url" in value && value.url && String(value.url);
  if (url) {
    try {
      return basename(new URL(url).pathname);
    } catch {
      return basename(url);
    }
  }
  const path2 = "path" in value && value.path && String(value.path);
  return path2 ? basename(path2) : void 0;
}
function basename(value) {
  return value.split(/[\\/]/).pop() || void 0;
}
function normalizeFilenamePath(value) {
  return value.replace(/\\/g, "/");
}
var isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function";
var maybeMultipartFormRequestOptions = async (opts, fetch2, formOptions) => {
  if (!hasUploadableValue(opts.body)) {
    return opts;
  }
  if (hasStreamingUploadableValue(opts.body)) {
    return createStreamingFormRequestOptions(opts, formOptions);
  }
  return { ...opts, body: await createForm(opts.body, fetch2, formOptions) };
};
var multipartFormRequestOptions = async (opts, fetch2, formOptions) => {
  if (hasStreamingUploadableValue(opts.body)) {
    return createStreamingFormRequestOptions(opts, formOptions);
  }
  return { ...opts, body: await createForm(opts.body, fetch2, formOptions) };
};
var supportsFormDataMap = /* @__PURE__ */ new WeakMap();
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached) {
    return cached;
  }
  const promise = (async () => {
    try {
      let FetchResponse;
      if ("Response" in fetch2) {
        FetchResponse = fetch2.Response;
      } else {
        const response = await fetch2("data:,");
        await response.arrayBuffer();
        FetchResponse = response.constructor;
      }
      const data = new FormData();
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var createForm = async (body, fetch2, options = {}) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value, options)));
  return form;
};
var isNamedBlob = (value) => value instanceof Blob && "name" in value;
var isReadableStream = (value) => typeof value === "object" && value !== null && "getReader" in value && typeof value.getReader === "function";
var isStreamingFile = (value) => typeof value === "object" && value !== null && brand_privateStreamingFile in value;
var isUploadable = (value) => typeof value === "object" && value !== null && (value instanceof Response || isAsyncIterable(value) || isReadableStream(value) || isStreamingFile(value) || isNamedBlob(value));
var hasStreamingUploadableValue = (value) => {
  if (isStreamingFile(value) || isAsyncIterable(value) || isReadableStream(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasStreamingUploadableValue);
  }
  if (value && typeof value === "object" && !isNamedBlob(value) && !(value instanceof Response)) {
    for (const k in value) {
      if (hasStreamingUploadableValue(value[k])) {
        return true;
      }
    }
  }
  return false;
};
var hasUploadableValue = (value) => {
  if (isUploadable(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasUploadableValue);
  }
  if (value && typeof value === "object") {
    for (const k in value) {
      if (hasUploadableValue(value[k])) {
        return true;
      }
    }
  }
  return false;
};
var createStreamingFormRequestOptions = (opts, options = {}) => {
  const boundary = `openai-${Math.random().toString(36).slice(2)}`;
  const body = ReadableStreamFrom(iterateMultipartBody(opts.body, boundary, options));
  return {
    ...opts,
    body,
    headers: buildHeaders([{ "content-type": `multipart/form-data; boundary=${boundary}` }, opts.headers])
  };
};
async function* iterateMultipartBody(body, boundary, options) {
  for await (const { key, value } of iterateFormEntries(body)) {
    if (isUploadable(value)) {
      const filename = getStreamingFileName(value, options);
      const type = getStreamingFileType(value);
      yield encodeUTF8(`--${boundary}\r
`);
      yield encodeUTF8(`Content-Disposition: form-data; name="${escapeHeaderValue(key)}"; filename="${escapeHeaderValue(filename)}"\r
Content-Type: ${type}\r
\r
`);
      yield* iterateBytes(getStreamingFileData(value));
    } else {
      yield encodeUTF8(`--${boundary}\r
`);
      yield encodeUTF8(`Content-Disposition: form-data; name="${escapeHeaderValue(key)}"\r
\r
${String(value)}`);
    }
    yield encodeUTF8("\r\n");
  }
  yield encodeUTF8(`--${boundary}--\r
`);
}
async function* iterateFormEntries(body) {
  if (!body || typeof body !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(body)) {
    yield* iterateFormValue(key, value);
  }
}
async function* iterateFormValue(key, value) {
  if (value === void 0) {
    return;
  }
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || isUploadable(value)) {
    yield { key, value };
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      yield* iterateFormValue(key + "[]", entry);
    }
  } else if (typeof value === "object") {
    for (const [name, prop] of Object.entries(value)) {
      yield* iterateFormValue(`${key}[${name}]`, prop);
    }
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
}
function getStreamingFileName(value, options) {
  if (isStreamingFile(value)) {
    const { name } = value;
    if (typeof name !== "string" || !name) {
      throw new TypeError("Streaming upload file name must be a non-empty string");
    }
    return options.stripFilenames === false ? normalizeFilenamePath(name) : name;
  }
  return getName(value, { stripFilename: options.stripFilenames }) ?? "unknown_file";
}
function getStreamingFileType(value) {
  let type;
  if (isStreamingFile(value) || isNamedBlob(value)) {
    ({ type } = value);
  } else if (value instanceof Response) {
    type = value.headers.get("content-type") ?? void 0;
  }
  return validateStreamingFileType(type || "application/octet-stream");
}
function validateStreamingFileType(type) {
  if (typeof type !== "string") {
    throw new TypeError("Streaming upload content type must be a string");
  }
  for (let index = 0; index < type.length; index += 1) {
    const character = type.codePointAt(index) ?? 0;
    if (character <= 31 || character === 127) {
      throw new TypeError("Streaming upload content type must not contain control characters");
    }
  }
  return type;
}
function getStreamingFileData(value) {
  if (isStreamingFile(value)) {
    return value.data;
  }
  return value;
}
async function* iterateBytes(value) {
  if (typeof value === "string") {
    yield encodeUTF8(value);
  } else if (ArrayBuffer.isView(value)) {
    yield new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  } else if (value instanceof ArrayBuffer) {
    yield new Uint8Array(value);
  } else if (value instanceof Response) {
    yield* iterateBytes(value.body || await value.blob());
  } else if (value instanceof Blob) {
    if (typeof value.stream === "function") {
      yield* iterateBytes(value.stream());
    } else {
      yield new Uint8Array(await value.arrayBuffer());
    }
  } else if (isReadableStream(value)) {
    for await (const chunk of ReadableStreamToAsyncIterable(value)) {
      yield* iterateBytes(chunk);
    }
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      yield* iterateBytes(chunk);
    }
  } else {
    throw new TypeError(`Invalid streaming file chunk: ${String(value)}`);
  }
}
function escapeHeaderValue(value) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 || character === '"' || character === "\\" ? encodeURIComponent(character) : character;
  }).join("");
}
var addFormValue = async (form, key, value, options) => {
  if (value === void 0) {
    return;
  }
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    form.append(key, makeFile([await value.blob()], getName(value, { stripFilename: options.stripFilenames })));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value, { stripFilename: options.stripFilenames })));
  } else if (isNamedBlob(value)) {
    form.append(key, value, getName(value, { stripFilename: options.stripFilenames }));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry, options)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop, options)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};

// node_modules/openai/internal/to-file.mjs
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function";
var isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value);
var isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
var hasFilePropertyOverrides = (value, options) => options?.type != null && options.type !== value.type || options?.lastModified != null && options.lastModified !== value.lastModified || options?.endings != null;
var canReuseNativeFile = (value, name, options) => (name == null || name === value.name) && !hasFilePropertyOverrides(value, options);
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  if (isFileLike(value)) {
    const fileOptions = {
      ...options,
      type: options?.type ?? value.type,
      lastModified: options?.lastModified ?? value.lastModified
    };
    if (value instanceof File) {
      if (canReuseNativeFile(value, name, options)) {
        return value;
      }
      return makeFile([value], name ?? value.name, fileOptions);
    }
    return makeFile([await value.arrayBuffer()], name ?? value.name, fileOptions);
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = getName(value));
    const responseOptions = options?.type === void 0 && blob.type ? { ...options, type: blob.type } : options;
    return makeFile(await getBytes(blob), name, responseOptions);
  }
  const parts = await getBytes(value);
  name || (name = getName(value));
  if (options?.type === void 0) {
    const typedPart = parts.find((part) => typeof part === "object" && "type" in part && !!part.type);
    if (typedPart) {
      options = { ...options, type: typedPart.type };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  const parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
  value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : new Blob([await value.arrayBuffer()], { type: value.type }));
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null) {
    return "";
  }
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}

// node_modules/openai/core/resource.mjs
var APIResource = class {
  constructor(client) {
    this._client = client;
  }
};

// node_modules/openai/internal/utils/path.mjs
function encodeURIPath(str2) {
  return str2.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
var createPathTagFunction = (pathEncoder = encodeURIPath) => function path2(statics, ...params) {
  if (statics.length === 1) {
    return statics[0];
  }
  let postPath = false;
  const invalidSegments = [];
  let path3 = "";
  for (let index = 0; index < statics.length; index += 1) {
    if (index in statics) {
      const currentValue = statics[index];
      if (/[?#]/.test(currentValue)) {
        postPath = true;
      }
      const value = params[index];
      let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
      if (index !== params.length && (value == null || typeof value === "object" && // handle values from other realms
      value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)?.toString)) {
        encoded = value + "";
        invalidSegments.push({
          start: path3.length + currentValue.length,
          length: encoded.length,
          error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
        });
      }
      path3 += currentValue + (index === params.length ? "" : encoded);
    }
  }
  const pathOnly = path3.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match2;
  while ((match2 = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match2.index,
      length: match2[0].length,
      error: `Value "${match2[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a, b) => a.start - b.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    let underline = "";
    for (const segment of invalidSegments) {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      underline += spaces + arrows;
    }
    throw new OpenAIError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e) => e.error).join("\n")}
${path3}
${underline}`);
  }
  return path3;
};
var path = /* @__PURE__ */ createPathTagFunction(encodeURIPath);

// node_modules/openai/resources/chat/completions/messages.mjs
var Messages = class extends APIResource {
  /**
   * Get the messages in a stored chat completion. Only Chat Completions that have
   * been created with the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletionStoreMessage of client.chat.completions.messages.list(
   *   'completion_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(completionID, query = {}, options) {
    return this._client.getAPIList(path`/chat/completions/${completionID}/messages`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/lib/parser.mjs
function isChatCompletionFunctionTool(tool) {
  return tool !== void 0 && "function" in tool && tool.function !== void 0;
}
function isAutoParsableResponseFormat(response_format) {
  return response_format?.["$brand"] === "auto-parseable-response-format";
}
function isParseableResponseFormat(format) {
  return isAutoParsableResponseFormat(format) || format?.type === "json_schema";
}
function parseResponseFormatContent(format, content) {
  if (!isParseableResponseFormat(format)) {
    return null;
  }
  if (typeof format === "object" && format !== null && "$parseRaw" in format && typeof format.$parseRaw === "function") {
    return format.$parseRaw(content);
  }
  return JSON.parse(content);
}
function isAutoParsableTool(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
function maybeParseChatCompletion(completion, params) {
  if (!params || !hasAutoParseableInput(params)) {
    return {
      ...completion,
      choices: completion.choices.map((choice) => ({
        ...choice,
        message: {
          ...choice.message,
          parsed: null,
          ...choice.message.tool_calls ? {
            tool_calls: choice.message.tool_calls
          } : void 0
        }
      }))
    };
  }
  return parseChatCompletion(completion, params);
}
function parseChatCompletion(completion, params) {
  const choices = completion.choices.map((choice) => {
    if (choice.finish_reason === "length") {
      throw new LengthFinishReasonError();
    }
    if (choice.finish_reason === "content_filter") {
      throw new ContentFilterFinishReasonError();
    }
    return {
      ...choice,
      message: {
        ...choice.message,
        ...choice.message.tool_calls ? {
          tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? void 0
        } : void 0,
        parsed: choice.message.content !== null && choice.message.content !== void 0 && !choice.message.refusal && (choice.message.content !== "" || !choice.message.tool_calls?.length && !choice.message.function_call) ? parseResponseFormat(params, choice.message.content) : null
      }
    };
  });
  return { ...completion, choices };
}
function parseResponseFormat(params, content) {
  return parseResponseFormatContent(params.response_format, content);
}
function parseToolCall(params, toolCall) {
  if (toolCall.type === "custom") {
    return toolCall;
  }
  if (toolCall.type !== "function") {
    const unsupportedType = toolCall.type;
    throw new OpenAIError(`Currently only \`function\` and \`custom\` tool calls are supported; Received \`${unsupportedType}\``);
  }
  const inputTool = params.tools?.find((inputTool2) => isChatCompletionFunctionTool(inputTool2) && inputTool2.function?.name === toolCall.function.name);
  let parsedArguments = null;
  if (isAutoParsableTool(inputTool)) {
    parsedArguments = inputTool.$parseRaw(toolCall.function.arguments);
  } else if (inputTool?.function.strict) {
    parsedArguments = JSON.parse(toolCall.function.arguments);
  }
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      parsed_arguments: parsedArguments
    }
  };
}
function shouldParseToolCall(params, toolCall) {
  if (!params || !("tools" in params) || !params.tools || toolCall.type !== "function") {
    return false;
  }
  const inputTool = params.tools?.find((inputTool2) => isChatCompletionFunctionTool(inputTool2) && inputTool2.function?.name === toolCall.function?.name);
  return isChatCompletionFunctionTool(inputTool) && (isAutoParsableTool(inputTool) || inputTool?.function.strict || false);
}
function hasAutoParseableInput(params) {
  if (isParseableResponseFormat(params.response_format)) {
    return true;
  }
  return params.tools?.some((t) => isAutoParsableTool(t) || t.type === "function" && t.function.strict === true) ?? false;
}
function validateInputTools(tools) {
  for (const tool of tools ?? []) {
    if (tool.type === "custom") {
      continue;
    }
    if (tool.type !== "function") {
      const unsupportedType = tool.type;
      throw new OpenAIError(`Currently only \`function\` and \`custom\` tool types are supported; Received \`${unsupportedType}\``);
    }
    if (tool.function.strict !== true) {
      throw new OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
    }
  }
}

// node_modules/openai/lib/chatCompletionUtils.mjs
var isAssistantMessage = (message) => message?.role === "assistant";
var isToolMessage = (message) => message?.role === "tool";

// node_modules/openai/lib/EventStream.mjs
var _EventStream_instances;
var _EventStream_connectedPromise;
var _EventStream_resolveConnectedPromise;
var _EventStream_rejectConnectedPromise;
var _EventStream_endPromise;
var _EventStream_resolveEndPromise;
var _EventStream_rejectEndPromise;
var _EventStream_listeners;
var _EventStream_abortListeners;
var _EventStream_ended;
var _EventStream_errored;
var _EventStream_aborted;
var _EventStream_catchingPromiseCreated;
var _EventStream_removeAbortListeners;
var _EventStream_handleError;
function createEventQueue() {
  let entries = [];
  let head = 0;
  return {
    get length() {
      return entries.length - head;
    },
    enqueue(value) {
      entries.push(value);
    },
    dequeue() {
      if (head === entries.length) {
        return void 0;
      }
      const value = entries[head];
      entries[head] = void 0;
      head += 1;
      if (head === entries.length) {
        entries = [];
        head = 0;
      } else if (head >= 1024 && head * 2 >= entries.length) {
        entries = entries.slice(head);
        head = 0;
      }
      return value;
    },
    clear() {
      entries = [];
      head = 0;
    }
  };
}
var EventStream = class {
  /** Creates an unstarted stream with independent connection and completion lifecycle promises. */
  constructor() {
    _EventStream_instances.add(this);
    this.controller = new AbortController();
    _EventStream_connectedPromise.set(this, void 0);
    _EventStream_resolveConnectedPromise.set(this, () => void 0);
    _EventStream_rejectConnectedPromise.set(this, () => void 0);
    _EventStream_endPromise.set(this, void 0);
    _EventStream_resolveEndPromise.set(this, () => void 0);
    _EventStream_rejectEndPromise.set(this, () => void 0);
    _EventStream_listeners.set(this, /* @__PURE__ */ Object.create(null));
    _EventStream_abortListeners.set(this, []);
    _EventStream_ended.set(this, false);
    _EventStream_errored.set(this, false);
    _EventStream_aborted.set(this, false);
    _EventStream_catchingPromiseCreated.set(this, false);
    __classPrivateFieldSet(this, _EventStream_connectedPromise, new Promise((resolve2, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveConnectedPromise, resolve2, "f");
      __classPrivateFieldSet(this, _EventStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet(this, _EventStream_endPromise, new Promise((resolve2, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveEndPromise, resolve2, "f");
      __classPrivateFieldSet(this, _EventStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet(this, _EventStream_connectedPromise, "f").catch(() => void 0);
    __classPrivateFieldGet(this, _EventStream_endPromise, "f").catch(() => void 0);
  }
  _run(executor) {
    setTimeout(() => {
      let failed = false;
      Promise.resolve().then(executor).catch((error) => {
        failed = true;
        __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).call(this, error);
      }).then(() => {
        if (failed) {
          return;
        }
        try {
          this._emitFinal();
        } catch (error) {
          __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).call(this, error);
          return;
        }
        this._emit("end");
      });
    }, 0);
  }
  _connected() {
    if (this.ended) {
      return;
    }
    __classPrivateFieldGet(this, _EventStream_resolveConnectedPromise, "f").call(this);
    this._emit("connect");
  }
  /** Whether the stream has finished successfully, failed, or been aborted. */
  get ended() {
    return __classPrivateFieldGet(this, _EventStream_ended, "f");
  }
  /** Whether an error or user cancellation has been observed. */
  get errored() {
    return __classPrivateFieldGet(this, _EventStream_errored, "f");
  }
  /** Whether the stream ended because its request was cancelled. */
  get aborted() {
    return __classPrivateFieldGet(this, _EventStream_aborted, "f");
  }
  /**
   * Cancels the underlying request; {@link done} and {@link events} observe cancellation.
   * Promises returned by {@link emitted} for other events may remain pending.
   */
  abort() {
    this.controller.abort();
  }
  _listenForAbort(signal) {
    if (!signal || this.ended) {
      return;
    }
    if (signal.aborted) {
      this.controller.abort();
      return;
    }
    const listener = () => this.controller.abort();
    signal.addEventListener("abort", listener, { once: true });
    __classPrivateFieldGet(this, _EventStream_abortListeners, "f").push({ signal, listener });
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns This stream, so that listener registration calls can be chained.
   */
  on(event, listener) {
    var _a4;
    const listeners = (_a4 = __classPrivateFieldGet(this, _EventStream_listeners, "f"))[event] || (_a4[event] = []);
    listeners.push({ listener });
    return this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns This stream, so that listener registration calls can be chained.
   */
  off(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (!listeners) {
      return this;
    }
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    return this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns This stream, so that listener registration calls can be chained.
   */
  once(event, listener) {
    var _a4;
    const listeners = (_a4 = __classPrivateFieldGet(this, _EventStream_listeners, "f"))[event] || (_a4[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * Events without arguments resolve to `undefined`, single-argument events resolve
   * to that argument, and events with multiple arguments resolve to an argument tuple.
   *
   * @returns A promise for the next event, or a rejection if an error occurs first.
   * Requesting the `error` event resolves with the emitted error instead.
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(event) {
    return new Promise((resolve2, reject) => {
      __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
      const onError = (error) => {
        this.off(event, onEvent);
        reject(error);
      };
      const onEvent = (...values) => {
        if (event !== "error") {
          this.off("error", onError);
        }
        resolve2(values.length > 1 ? values : values[0]);
      };
      if (event !== "error") {
        this.once("error", onError);
      }
      this.once(event, onEvent);
    });
  }
  /**
   * Returns an async iterator that yields every time the event is triggered.
   * The iterator ends when the stream ends and rejects if the stream errors
   * or is aborted. If you request the 'error' or 'abort' event, the iterator
   * yields that event instead of rejecting.
   *
   * Example:
   *
   *   for await (const [message] of stream.events('message')) {
   *     await processMessage(message);
   *   }
   */
  events(event) {
    return this._createIterator((push) => {
      const onEvent = (...args) => push(args);
      this.on(event, onEvent);
      return () => this.off(event, onEvent);
    }, {
      // When iterating the 'error' or 'abort' event itself, yield it as a
      // value instead of rejecting the iterator.
      rejectOnError: event !== "error",
      rejectOnAbort: event !== "abort"
    });
  }
  /**
   * Shared buffered async-iterator adapter over this stream's events.
   *
   * `attach` registers the producer listener(s) with the given `push` and
   * returns a cleanup function that removes them. Termination is handled
   * here: the iterator ends when the stream ends, listeners are removed on
   * end/return, and a terminal error is retained until buffered values have
   * drained so it is surfaced even when no reader was waiting when it fired.
   */
  _createIterator(attach, { rejectOnError = true, rejectOnAbort = true, onReturn } = {}) {
    const pushQueue = createEventQueue();
    const readQueue = createEventQueue();
    let ended = this.ended;
    let failure;
    let failureDelivered = false;
    let detach = () => void 0;
    const doneResult = () => ({ value: void 0, done: true });
    const finishReaders = () => {
      while (readQueue.length) {
        readQueue.dequeue().resolve(doneResult());
      }
    };
    const rejectReader = () => {
      if (!failure || failureDelivered || !readQueue.length) {
        return;
      }
      failureDelivered = true;
      readQueue.dequeue().reject(failure);
    };
    const cleanup = () => {
      detach();
      this.off("end", onEnd);
      if (rejectOnError) {
        this.off("error", onFailure);
      }
      if (rejectOnAbort) {
        this.off("abort", onFailure);
      }
    };
    const push = (value) => {
      if (ended) {
        return;
      }
      const reader = readQueue.dequeue();
      if (reader) {
        reader.resolve({ value, done: false });
      } else {
        pushQueue.enqueue(value);
      }
    };
    const onFailure = (error) => {
      failure = error;
      if (!pushQueue.length) {
        rejectReader();
      }
    };
    const onEnd = () => {
      ended = true;
      cleanup();
      if (!pushQueue.length) {
        rejectReader();
        finishReaders();
      }
    };
    if (!ended) {
      detach = attach(push);
      this.on("end", onEnd);
      if (rejectOnError) {
        this.on("error", onFailure);
      }
      if (rejectOnAbort) {
        this.on("abort", onFailure);
      }
    }
    return {
      next: () => {
        if (pushQueue.length) {
          return Promise.resolve({ value: pushQueue.dequeue(), done: false });
        }
        if (failure && !failureDelivered) {
          failureDelivered = true;
          return Promise.reject(failure);
        }
        if (ended) {
          return Promise.resolve(doneResult());
        }
        return new Promise((resolve2, reject) => {
          readQueue.enqueue({ resolve: resolve2, reject });
        });
      },
      return: () => {
        ended = true;
        pushQueue.clear();
        cleanup();
        finishReaders();
        if (onReturn) {
          void this.done().catch(() => void 0);
          onReturn();
        }
        return Promise.resolve(doneResult());
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
  /** Resolves when the stream ends successfully or rejects when it fails or is aborted. */
  async done() {
    __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet(this, _EventStream_endPromise, "f");
  }
  /** Returns whether an event currently has one or more registered listeners. */
  _hasListeners(event) {
    return Boolean(__classPrivateFieldGet(this, _EventStream_listeners, "f")[event]?.length);
  }
  /** Dispatches a stream event and performs the associated lifecycle transitions. */
  _emit(event, ...args) {
    if (__classPrivateFieldGet(this, _EventStream_ended, "f")) {
      return;
    }
    if (event === "end") {
      __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_removeAbortListeners).call(this);
      __classPrivateFieldSet(this, _EventStream_ended, true, "f");
      __classPrivateFieldGet(this, _EventStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      for (const { listener } of listeners) {
        listener(...args);
      }
    }
    if (event === "abort") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
    }
  }
  // oxlint-disable-next-line class-methods-use-this -- Subclasses override this instance hook.
  _emitFinal() {
  }
};
_EventStream_connectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_endPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_listeners = /* @__PURE__ */ new WeakMap(), _EventStream_abortListeners = /* @__PURE__ */ new WeakMap(), _EventStream_ended = /* @__PURE__ */ new WeakMap(), _EventStream_errored = /* @__PURE__ */ new WeakMap(), _EventStream_aborted = /* @__PURE__ */ new WeakMap(), _EventStream_catchingPromiseCreated = /* @__PURE__ */ new WeakMap(), _EventStream_instances = /* @__PURE__ */ new WeakSet(), _EventStream_removeAbortListeners = function _EventStream_removeAbortListeners2() {
  for (const { signal, listener } of __classPrivateFieldGet(this, _EventStream_abortListeners, "f").splice(0)) {
    signal.removeEventListener("abort", listener);
  }
}, _EventStream_handleError = function _EventStream_handleError2(error) {
  __classPrivateFieldSet(this, _EventStream_errored, true, "f");
  if (error instanceof Error && error.name === "AbortError") {
    error = new APIUserAbortError();
  }
  if (error instanceof APIUserAbortError) {
    __classPrivateFieldSet(this, _EventStream_aborted, true, "f");
    return this._emit("abort", error);
  }
  if (error instanceof OpenAIError) {
    return this._emit("error", error);
  }
  if (error instanceof Error) {
    const openAIError = new OpenAIError(error.message);
    openAIError.cause = error;
    return this._emit("error", openAIError);
  }
  return this._emit("error", new OpenAIError(String(error)));
};

// node_modules/openai/lib/RunnableFunction.mjs
function isRunnableFunctionWithParse(fn) {
  return typeof fn.parse === "function";
}

// node_modules/openai/lib/AbstractChatCompletionRunner.mjs
var _AbstractChatCompletionRunner_instances;
var _a;
var _AbstractChatCompletionRunner_getFinalContent;
var _AbstractChatCompletionRunner_getFinalMessage;
var _AbstractChatCompletionRunner_getFinalFunctionToolCall;
var _AbstractChatCompletionRunner_getFinalFunctionToolCallResult;
var _AbstractChatCompletionRunner_calculateTotalUsage;
var _AbstractChatCompletionRunner_validateParams;
var _AbstractChatCompletionRunner_stringifyFunctionCallResult;
var DEFAULT_MAX_CHAT_COMPLETIONS = 10;
function normalizeToolCallIds(chatCompletion) {
  for (const choice of chatCompletion.choices) {
    for (const toolCall of choice.message.tool_calls ?? []) {
      if (!toolCall.id) {
        toolCall.id = `call_${uuid4()}`;
      }
    }
  }
}
function toRequestMessage(message) {
  if (!isAssistantMessage(message)) {
    return message;
  }
  const requestMessage = { role: "assistant" };
  if (message.audio != null) {
    requestMessage.audio = { id: message.audio.id };
  }
  if (message.content !== void 0) {
    requestMessage.content = message.content;
  }
  if (message.function_call != null) {
    requestMessage.function_call = message.function_call;
  }
  if (message.name !== void 0) {
    requestMessage.name = message.name;
  }
  if (message.refusal != null) {
    requestMessage.refusal = message.refusal;
  }
  if (message.tool_calls !== void 0) {
    requestMessage.tool_calls = message.tool_calls.map((toolCall) => {
      if (toolCall.type === "custom") {
        return {
          id: toolCall.id,
          type: toolCall.type,
          custom: {
            input: toolCall.custom.input,
            name: toolCall.custom.name
          }
        };
      }
      return {
        id: toolCall.id,
        type: toolCall.type,
        function: {
          arguments: toolCall.function.arguments,
          name: toolCall.function.name
        }
      };
    });
  }
  return requestMessage;
}
var AbstractChatCompletionRunner = class extends EventStream {
  constructor() {
    super(...arguments);
    _AbstractChatCompletionRunner_instances.add(this);
    this._chatCompletions = [];
    this.messages = [];
  }
  _addChatCompletion(chatCompletion) {
    normalizeToolCallIds(chatCompletion);
    this._chatCompletions.push(chatCompletion);
    this._emit("chatCompletion", chatCompletion);
    const message = chatCompletion.choices[0]?.message;
    if (message) {
      this._addMessage(message);
    }
    return chatCompletion;
  }
  _addMessage(message, emit = true) {
    if (!("content" in message)) {
      message.content = null;
    }
    this.messages.push(message);
    if (emit) {
      this._emit("message", message);
      if (isToolMessage(message) && message.content) {
        this._emit("functionToolCallResult", message.content);
      } else if (isAssistantMessage(message) && message.tool_calls) {
        for (const tool_call of message.tool_calls) {
          if (tool_call.type === "function") {
            this._emit("functionToolCall", tool_call.function);
          }
        }
      }
    }
  }
  /**
   * @returns a promise that resolves with the final ChatCompletion, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
   */
  async finalChatCompletion() {
    await this.done();
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (!completion) {
      throw new OpenAIError("stream ended without producing a ChatCompletion");
    }
    return completion;
  }
  /**
   * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalContent() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
  }
  /**
   * @returns a promise that resolves with the final assistant ChatCompletionMessage response,
   * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalMessage() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
  }
  /**
   * Waits for completion and returns the last function-tool call, or `undefined`
   * when no assistant message contains a function-tool call.
   */
  async finalFunctionToolCall() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
  }
  /** Waits for completion and returns the last matching function-tool result, if any. */
  async finalFunctionToolCallResult() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
  }
  /** Waits for completion and sums token usage across every chat completion in the run. */
  async totalUsage() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
  }
  /** Returns a copy of the chat completions received so far, in request order. */
  allChatCompletions() {
    return [...this._chatCompletions];
  }
  _emitFinal() {
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (completion) {
      this._emit("finalChatCompletion", completion);
    }
    const finalMessage = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    if (finalMessage) {
      this._emit("finalMessage", finalMessage);
    }
    const finalContent = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    if (finalContent) {
      this._emit("finalContent", finalContent);
    }
    const finalFunctionCall = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
    if (finalFunctionCall) {
      this._emit("finalFunctionToolCall", finalFunctionCall);
    }
    const finalFunctionCallResult = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
    if (finalFunctionCallResult != null) {
      this._emit("finalFunctionToolCallResult", finalFunctionCallResult);
    }
    if (this._chatCompletions.some((c) => c.usage)) {
      this._emit("totalUsage", __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
    }
  }
  async _createChatCompletion(client, params, options) {
    this._listenForAbort(options?.signal);
    __classPrivateFieldGet(_a, _a, "m", _AbstractChatCompletionRunner_validateParams).call(_a, params);
    const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options, signal: this.controller.signal });
    this._connected();
    return this._addChatCompletion(parseChatCompletion(chatCompletion, params));
  }
  async _runChatCompletion(client, params, options) {
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    return await this._createChatCompletion(client, params, options);
  }
  async _runTools(client, params, runner, options) {
    const role = "tool";
    const { tool_choice = "auto", stream: stream2, toolContext: inputToolContext, ...restParams } = params;
    const toolContext = inputToolContext;
    const singleFunctionToCall = typeof tool_choice !== "string" && tool_choice.type === "function" && tool_choice?.function?.name;
    const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS, afterCompletion } = options || {};
    const inputTools = params.tools.map((tool) => {
      if (isAutoParsableTool(tool)) {
        if (!tool.$callback) {
          throw new OpenAIError("Tool given to `.runTools()` that does not have an associated function");
        }
        return {
          type: "function",
          function: {
            function: tool.$callback,
            name: tool.function.name,
            description: tool.function.description || "",
            parameters: tool.function.parameters,
            parse: tool.$parseRaw,
            strict: true
          }
        };
      }
      return tool;
    });
    const functionsByName = /* @__PURE__ */ Object.create(null);
    for (const f of inputTools) {
      if (f.type === "function") {
        functionsByName[f.function.name || f.function.function.name] = f.function;
      }
    }
    const tools = "tools" in params ? inputTools.map((t) => t.type === "function" ? {
      type: "function",
      function: {
        name: t.function.name || t.function.function.name,
        parameters: t.function.parameters,
        description: t.function.description,
        strict: t.function.strict
      }
    } : t) : void 0;
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    const runToolCall = async (toolCall) => {
      if (toolCall.type !== "function") {
        return { message: void 0, functionCalled: false };
      }
      const tool_call_id = toolCall.id;
      const { name, arguments: args } = toolCall.function;
      const fn = functionsByName[name];
      if (!fn) {
        const content2 = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName).map((name2) => JSON.stringify(name2)).join(", ")}. Please try again`;
        return { message: { role, tool_call_id, content: content2 }, functionCalled: false };
      }
      if (singleFunctionToCall && singleFunctionToCall !== name) {
        const content2 = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
        return { message: { role, tool_call_id, content: content2 }, functionCalled: false };
      }
      let rawContent;
      if (isRunnableFunctionWithParse(fn)) {
        let parsed;
        try {
          parsed = await fn.parse(args);
        } catch (error) {
          const content2 = error instanceof Error ? error.message : String(error);
          return { message: { role, tool_call_id, content: content2 }, functionCalled: false };
        }
        rawContent = await fn.function(parsed, runner, toolContext);
      } else {
        rawContent = await fn.function(args, runner, toolContext);
      }
      const content = __classPrivateFieldGet(_a, _a, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(_a, rawContent);
      return { message: { role, tool_call_id, content }, functionCalled: true };
    };
    for (let i = 0; i < maxChatCompletions; ++i) {
      const chatCompletion = await this._createChatCompletion(client, {
        ...restParams,
        tool_choice,
        tools,
        messages: this.messages.map(toRequestMessage)
      }, options);
      const message = chatCompletion.choices[0]?.message;
      if (!message) {
        throw new OpenAIError(`missing message in ChatCompletion response`);
      }
      if (!message.tool_calls?.length) {
        await afterCompletion?.(chatCompletion, runner);
        return;
      }
      if (singleFunctionToCall || params.parallel_tool_calls === false) {
        for (const toolCall of message.tool_calls) {
          const result = await runToolCall(toolCall);
          if (result.message) {
            this._addMessage(result.message);
          }
          if (singleFunctionToCall && result.functionCalled) {
            await afterCompletion?.(chatCompletion, runner);
            return;
          }
        }
      } else {
        const results = await Promise.allSettled(message.tool_calls.map(runToolCall));
        for (const result of results) {
          if (result.status === "rejected") {
            throw result.reason;
          }
        }
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.message) {
            this._addMessage(result.value.message);
          }
        }
      }
      await afterCompletion?.(chatCompletion, runner);
    }
  }
};
_a = AbstractChatCompletionRunner, _AbstractChatCompletionRunner_instances = /* @__PURE__ */ new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent2() {
  return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage2() {
  let i = this.messages.length;
  while (i-- > 0) {
    const message = this.messages[i];
    if (isAssistantMessage(message)) {
      const ret = {
        ...message,
        content: message.content ?? null,
        refusal: message.refusal ?? null
      };
      return ret;
    }
  }
  throw new OpenAIError("stream ended without producing a ChatCompletionMessage with role=assistant");
}, _AbstractChatCompletionRunner_getFinalFunctionToolCall = function _AbstractChatCompletionRunner_getFinalFunctionToolCall2() {
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isAssistantMessage(message) && message?.tool_calls?.length) {
      for (let j = message.tool_calls.length - 1; j >= 0; j--) {
        const toolCall = message.tool_calls[j];
        if (toolCall?.type === "function") {
          return toolCall.function;
        }
      }
    }
  }
  return void 0;
}, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult = function _AbstractChatCompletionRunner_getFinalFunctionToolCallResult2() {
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isToolMessage(message) && message.content != null && typeof message.content === "string" && this.messages.some((x) => x.role === "assistant" && x.tool_calls?.some((y) => y.type === "function" && y.id === message.tool_call_id))) {
      return message.content;
    }
  }
  return void 0;
}, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage2() {
  const total = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  };
  for (const { usage } of this._chatCompletions) {
    if (usage) {
      total.completion_tokens += usage.completion_tokens;
      total.prompt_tokens += usage.prompt_tokens;
      total.total_tokens += usage.total_tokens;
    }
  }
  return total;
}, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams2(params) {
  if (params.n != null && params.n > 1) {
    throw new OpenAIError("ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.");
  }
}, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult2(rawContent) {
  if (typeof rawContent === "string") {
    return rawContent;
  }
  if (rawContent === void 0) {
    return "undefined";
  }
  return JSON.stringify(rawContent);
};

// node_modules/openai/lib/ChatCompletionRunner.mjs
var ChatCompletionRunner = class _ChatCompletionRunner extends AbstractChatCompletionRunner {
  /** Starts a non-streaming tool loop and returns its event-driven conversation runner. */
  static runTools(client, params, options) {
    const runner = new _ChatCompletionRunner();
    const opts = {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "runTools" }
    };
    runner._run(() => runner._runTools(client, params, runner, opts));
    return runner;
  }
  /** Appends a conversation message and emits text content for assistant replies. */
  _addMessage(message, emit = true) {
    super._addMessage(message, emit);
    if (isAssistantMessage(message) && message.content) {
      this._emit("content", message.content);
    }
  }
};

// node_modules/openai/_vendor/partial-json-parser/parser.mjs
var STR = 1;
var NUM = 2;
var ARR = 4;
var OBJ = 8;
var NULL = 16;
var BOOL = 32;
var NAN = 64;
var INFINITY = 128;
var MINUS_INFINITY = 256;
var INF = INFINITY | MINUS_INFINITY;
var SPECIAL = NULL | BOOL | INF | NAN;
var ATOM = STR | NUM | SPECIAL;
var COLLECTION = ARR | OBJ;
var ALL = ATOM | COLLECTION;
var Allow = {
  STR,
  NUM,
  ARR,
  OBJ,
  NULL,
  BOOL,
  NAN,
  INFINITY,
  MINUS_INFINITY,
  INF,
  SPECIAL,
  ATOM,
  COLLECTION,
  ALL
};
var PartialJSON = class extends Error {
};
var MalformedJSON = class extends Error {
};
function parseJSON(jsonString, allowPartial = Allow.ALL) {
  if (typeof jsonString !== "string") {
    throw new TypeError(`expecting str, got ${typeof jsonString}`);
  }
  if (!jsonString.trim()) {
    throw new Error(`${jsonString} is empty`);
  }
  return _parseJSON(jsonString.trim(), allowPartial);
}
var _parseJSON = (jsonString, allow) => {
  const length = jsonString.length;
  let index = 0;
  const markPartialJSON = (msg) => {
    throw new PartialJSON(`${msg} at position ${index}`);
  };
  const throwMalformedError = (msg) => {
    throw new MalformedJSON(`${msg} at position ${index}`);
  };
  const parseAny = () => {
    skipBlank();
    if (index >= length) {
      markPartialJSON("Unexpected end of input");
    }
    if (jsonString[index] === '"') {
      return parseStr();
    }
    if (jsonString[index] === "{") {
      return parseObj();
    }
    if (jsonString[index] === "[") {
      return parseArr();
    }
    if (jsonString.substring(index, index + 4) === "null" || Allow.NULL & allow && length - index < 4 && "null".startsWith(jsonString.substring(index))) {
      index += 4;
      return null;
    }
    if (jsonString.substring(index, index + 4) === "true" || Allow.BOOL & allow && length - index < 4 && "true".startsWith(jsonString.substring(index))) {
      index += 4;
      return true;
    }
    if (jsonString.substring(index, index + 5) === "false" || Allow.BOOL & allow && length - index < 5 && "false".startsWith(jsonString.substring(index))) {
      index += 5;
      return false;
    }
    if (jsonString.substring(index, index + 8) === "Infinity" || Allow.INFINITY & allow && length - index < 8 && "Infinity".startsWith(jsonString.substring(index))) {
      index += 8;
      return Infinity;
    }
    if (jsonString.substring(index, index + 9) === "-Infinity" || Allow.MINUS_INFINITY & allow && length - index > 1 && length - index < 9 && "-Infinity".startsWith(jsonString.substring(index))) {
      index += 9;
      return -Infinity;
    }
    if (jsonString.substring(index, index + 3) === "NaN" || Allow.NAN & allow && length - index < 3 && "NaN".startsWith(jsonString.substring(index))) {
      index += 3;
      return Number.NaN;
    }
    return parseNum();
  };
  const parseStr = () => {
    const start = index;
    let escape2 = false;
    index++;
    while (index < length && (jsonString[index] !== '"' || escape2 && jsonString[index - 1] === "\\")) {
      escape2 = jsonString[index] === "\\" ? !escape2 : false;
      index++;
    }
    if (jsonString.charAt(index) === '"') {
      try {
        return JSON.parse(jsonString.substring(start, ++index - Number(escape2)));
      } catch (e) {
        throwMalformedError(String(e));
      }
    } else if (Allow.STR & allow) {
      try {
        return JSON.parse(jsonString.substring(start, index - Number(escape2)) + '"');
      } catch {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"');
      }
    }
    markPartialJSON("Unterminated string literal");
  };
  const parseObj = () => {
    index++;
    skipBlank();
    const obj = {};
    try {
      while (jsonString[index] !== "}") {
        skipBlank();
        if (index >= length && Allow.OBJ & allow) {
          return obj;
        }
        const key = parseStr();
        skipBlank();
        index++;
        try {
          const value = parseAny();
          Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
        } catch (e) {
          if (Allow.OBJ & allow) {
            return obj;
          }
          throw e;
        }
        skipBlank();
        if (jsonString[index] === ",") {
          index++;
        }
      }
    } catch {
      if (Allow.OBJ & allow) {
        return obj;
      }
      markPartialJSON("Expected '}' at end of object");
    }
    index++;
    return obj;
  };
  const parseArr = () => {
    index++;
    const arr = [];
    try {
      while (jsonString[index] !== "]") {
        arr.push(parseAny());
        skipBlank();
        if (jsonString[index] === ",") {
          index++;
        }
      }
    } catch {
      if (Allow.ARR & allow) {
        return arr;
      }
      markPartialJSON("Expected ']' at end of array");
    }
    index++;
    return arr;
  };
  const parseNum = () => {
    if (index === 0) {
      if (jsonString === "-" && Allow.NUM & allow) {
        markPartialJSON("Not sure what '-' is");
      }
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        if (Allow.NUM & allow) {
          try {
            if (jsonString[jsonString.length - 1] === ".") {
              return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf(".")));
            }
            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf("e")));
          } catch {
          }
        }
        throwMalformedError(String(e));
      }
    }
    const start = index;
    if (jsonString[index] === "-") {
      index++;
    }
    while (jsonString[index] && !",]}".includes(jsonString[index])) {
      index++;
    }
    if (index === length && !(Allow.NUM & allow)) {
      markPartialJSON("Unterminated number literal");
    }
    try {
      return JSON.parse(jsonString.substring(start, index));
    } catch {
      if (jsonString.substring(start, index) === "-" && Allow.NUM & allow) {
        markPartialJSON("Not sure what '-' is");
      }
      try {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("e")));
      } catch (e) {
        throwMalformedError(String(e));
      }
    }
  };
  const skipBlank = () => {
    while (index < length && " \n\r	".includes(jsonString[index])) {
      index++;
    }
  };
  return parseAny();
};
var partialParse = (input) => parseJSON(input, Allow.ALL ^ Allow.NUM);

// node_modules/openai/lib/ChatCompletionStream.mjs
var _ChatCompletionStream_instances;
var _ChatCompletionStream_params;
var _ChatCompletionStream_audioDoneChoiceIndexes;
var _ChatCompletionStream_choiceEventStates;
var _ChatCompletionStream_currentChatCompletionSnapshot;
var _ChatCompletionStream_beginRequest;
var _ChatCompletionStream_getChoiceEventState;
var _ChatCompletionStream_addChunk;
var _ChatCompletionStream_emitToolCallDoneEvent;
var _ChatCompletionStream_emitContentDoneEvents;
var _ChatCompletionStream_endRequest;
var _ChatCompletionStream_accumulateChatCompletion;
var CHAT_COMPLETION_READABLE_STREAM_MESSAGE_PREFIX = "chat.completion.chunk.message:";
function makeChatCompletionReadableStreamMessageChunk(chunk, message, toolCallIds) {
  const payload = {
    type: "message",
    message,
    ...toolCallIds ? { tool_call_ids: toolCallIds } : {}
  };
  return {
    id: chunk.id,
    choices: [],
    created: chunk.created,
    model: chunk.model,
    object: `${CHAT_COMPLETION_READABLE_STREAM_MESSAGE_PREFIX}${JSON.stringify(payload)}`
  };
}
function isChatCompletionReadableStreamMessage(item) {
  return "type" in item && item.type === "message" && "message" in item || "object" in item && typeof item.object === "string" && item.object.startsWith(CHAT_COMPLETION_READABLE_STREAM_MESSAGE_PREFIX);
}
function getChatCompletionReadableStreamMessage(item) {
  if ("type" in item) {
    return item;
  }
  return JSON.parse(item.object.slice(CHAT_COMPLETION_READABLE_STREAM_MESSAGE_PREFIX.length));
}
var MAX_STREAM_CHOICES = 128;
var MAX_STREAM_TOOL_CALLS = 128;
function assignOwnProperties(target, source) {
  if (Object.prototype.propertyIsEnumerable.call(source, "__proto__") && !hasOwn(target, "__proto__")) {
    Object.defineProperty(target, "__proto__", {
      value: void 0,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }
  return Object.assign(target, source);
}
var ChatCompletionStream = class _ChatCompletionStream extends AbstractChatCompletionRunner {
  /** Creates an unstarted stream, retaining request parameters for structured-output parsing. */
  constructor(params) {
    super();
    _ChatCompletionStream_instances.add(this);
    _ChatCompletionStream_params.set(this, void 0);
    _ChatCompletionStream_audioDoneChoiceIndexes.set(this, void 0);
    _ChatCompletionStream_choiceEventStates.set(this, void 0);
    _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
    __classPrivateFieldSet(this, _ChatCompletionStream_params, params, "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_audioDoneChoiceIndexes, /* @__PURE__ */ new Set(), "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
  }
  /** The latest accumulated completion, or `undefined` before a chunk arrives or after finalization. */
  get currentChatCompletionSnapshot() {
    return __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Original input messages are not included in the serialized stream. Tool-result
   * messages explicitly serialized by a streaming tool runner are replayed.
   */
  static fromReadableStream(stream2) {
    const runner = new _ChatCompletionStream(null);
    runner._run(() => runner._fromReadableStream(stream2));
    return runner;
  }
  /** Starts a streaming chat completion request and returns its event-driven helper. */
  static createChatCompletion(client, params, options) {
    const runner = new _ChatCompletionStream(params);
    runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options, __metadata: { ...options?.__metadata, helperMethod: "stream" } }));
    return runner;
  }
  async _createChatCompletion(client, params, options) {
    this._listenForAbort(options?.signal);
    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    const stream2 = await client.chat.completions.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const chunk of stream2) {
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
  }
  async _fromReadableStream(readableStream, options) {
    this._listenForAbort(options?.signal);
    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    this._connected();
    const stream2 = Stream.fromReadableStream(readableStream, this.controller);
    let chatId;
    for await (const item of stream2) {
      if (isChatCompletionReadableStreamMessage(item)) {
        const message = getChatCompletionReadableStreamMessage(item);
        if (__classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f")) {
          const toolCalls = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f").choices[0]?.message.tool_calls;
          for (const [index, id] of message.tool_call_ids?.entries() ?? []) {
            const toolCall = toolCalls?.[index];
            if (toolCall && id) {
              toolCall.id = id;
            }
          }
          this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
          chatId = void 0;
        }
        this._addMessage(message.message);
        continue;
      }
      const chunk = item;
      if (chatId && chunk.id && chatId !== chunk.id) {
        this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
      }
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
      if (chunk.id) {
        chatId = chunk.id;
      }
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    if (__classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f")) {
      return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    const lastChatCompletion = this._chatCompletions[this._chatCompletions.length - 1];
    if (lastChatCompletion) {
      return lastChatCompletion;
    }
    throw new OpenAIError(`request ended without sending any chunks`);
  }
  /** Iterates over raw API chunks; stopping iteration early aborts the underlying request. */
  [(_ChatCompletionStream_params = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_audioDoneChoiceIndexes = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_choiceEventStates = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_currentChatCompletionSnapshot = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_instances = /* @__PURE__ */ new WeakSet(), _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest2() {
    if (this.ended) {
      return;
    }
    __classPrivateFieldSet(this, _ChatCompletionStream_audioDoneChoiceIndexes, /* @__PURE__ */ new Set(), "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
  }, _ChatCompletionStream_getChoiceEventState = function _ChatCompletionStream_getChoiceEventState2(choice) {
    let state = __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
    if (state) {
      return state;
    }
    state = {
      content_done: false,
      refusal_done: false,
      logprobs_content_done: false,
      logprobs_refusal_done: false,
      done_tool_calls: /* @__PURE__ */ new Set(),
      current_tool_call_index: null
    };
    __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
    return state;
  }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk2(chunk) {
    if (this.ended) {
      return;
    }
    const completion = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
    this._emit("chunk", chunk, completion);
    for (const choice of chunk.choices) {
      const choiceSnapshot = completion.choices[choice.index];
      const { delta } = choice;
      if (delta?.content != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.content) {
        this._emit("content", delta.content, choiceSnapshot.message.content);
        this._emit("content.delta", {
          delta: delta.content,
          snapshot: choiceSnapshot.message.content,
          parsed: choiceSnapshot.message.parsed
        });
      }
      if (delta?.refusal != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.refusal) {
        this._emit("refusal.delta", {
          delta: delta.refusal,
          snapshot: choiceSnapshot.message.refusal
        });
      }
      if (choice.logprobs?.content != null && choiceSnapshot.message?.role === "assistant") {
        this._emit("logprobs.content.delta", {
          content: choice.logprobs?.content,
          snapshot: choiceSnapshot.logprobs?.content ?? []
        });
      }
      if (choice.logprobs?.refusal != null && choiceSnapshot.message?.role === "assistant") {
        this._emit("logprobs.refusal.delta", {
          refusal: choice.logprobs?.refusal,
          snapshot: choiceSnapshot.logprobs?.refusal ?? []
        });
      }
      const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
      if (choiceSnapshot.finish_reason) {
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
        if (state.current_tool_call_index != null) {
          __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
        }
      }
      for (const toolCall of delta?.tool_calls ?? []) {
        if (state.current_tool_call_index !== toolCall.index) {
          __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
          if (state.current_tool_call_index != null) {
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
          }
        }
        state.current_tool_call_index = toolCall.index;
      }
      for (const toolCallDelta of delta?.tool_calls ?? []) {
        const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallDelta.index];
        if (!toolCallSnapshot?.type) {
          continue;
        }
        if (toolCallSnapshot.type === "function") {
          this._emit("tool_calls.function.arguments.delta", {
            name: toolCallSnapshot.function.name,
            index: toolCallDelta.index,
            arguments: toolCallSnapshot.function.arguments,
            parsed_arguments: toolCallSnapshot.function.parsed_arguments,
            arguments_delta: toolCallDelta.function?.arguments ?? ""
          });
        } else if (toolCallSnapshot.type !== "custom") {
          assertNever(toolCallSnapshot);
        }
      }
    }
  }, _ChatCompletionStream_emitToolCallDoneEvent = function _ChatCompletionStream_emitToolCallDoneEvent2(choiceSnapshot, toolCallIndex) {
    const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (state.done_tool_calls.has(toolCallIndex)) {
      return;
    }
    const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallIndex];
    if (!toolCallSnapshot) {
      throw new Error("no tool call snapshot");
    }
    if (!toolCallSnapshot.type) {
      throw new Error("tool call snapshot missing `type`");
    }
    if (toolCallSnapshot.type === "function") {
      const inputTool = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.tools?.find((tool) => isChatCompletionFunctionTool(tool) && tool.function.name === toolCallSnapshot.function.name);
      let parsedArguments = null;
      if (isAutoParsableTool(inputTool)) {
        parsedArguments = inputTool.$parseRaw(toolCallSnapshot.function.arguments);
      } else if (inputTool?.function.strict) {
        parsedArguments = JSON.parse(toolCallSnapshot.function.arguments);
      }
      this._emit("tool_calls.function.arguments.done", {
        name: toolCallSnapshot.function.name,
        index: toolCallIndex,
        arguments: toolCallSnapshot.function.arguments,
        parsed_arguments: parsedArguments
      });
    } else if (toolCallSnapshot.type !== "custom") {
      assertNever(toolCallSnapshot);
    }
  }, _ChatCompletionStream_emitContentDoneEvents = function _ChatCompletionStream_emitContentDoneEvents2(choiceSnapshot) {
    const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (choiceSnapshot.message.content != null && (choiceSnapshot.message.content !== "" || !choiceSnapshot.message.refusal && !choiceSnapshot.message.tool_calls?.length && !choiceSnapshot.message.function_call) && !state.content_done) {
      state.content_done = true;
      this._emit("content.done", {
        content: choiceSnapshot.message.content,
        parsed: choiceSnapshot.message.refusal ? null : parseResponseFormatContent(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.response_format, choiceSnapshot.message.content)
      });
    }
    if (choiceSnapshot.message.refusal && !state.refusal_done) {
      state.refusal_done = true;
      this._emit("refusal.done", { refusal: choiceSnapshot.message.refusal });
    }
    if (choiceSnapshot.logprobs?.content && !state.logprobs_content_done) {
      state.logprobs_content_done = true;
      this._emit("logprobs.content.done", { content: choiceSnapshot.logprobs.content });
    }
    if (choiceSnapshot.logprobs?.refusal && !state.logprobs_refusal_done) {
      state.logprobs_refusal_done = true;
      this._emit("logprobs.refusal.done", { refusal: choiceSnapshot.logprobs.refusal });
    }
  }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any chunks`);
    }
    const audioDoneChoiceIndexes = __classPrivateFieldGet(this, _ChatCompletionStream_audioDoneChoiceIndexes, "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_audioDoneChoiceIndexes, /* @__PURE__ */ new Set(), "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
    return finalizeChatCompletion(snapshot, __classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), audioDoneChoiceIndexes);
  }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion2(chunk) {
    var _a4, _b, _c, _d, _e;
    let snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    const { choices, ...rest } = chunk;
    if (!snapshot) {
      const newSnapshot = {
        ...rest,
        choices: []
      };
      __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, newSnapshot, "f");
      snapshot = newSnapshot;
    } else if (chunk.id) {
      assignOwnProperties(snapshot, rest);
    }
    const requestedChoiceCount = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.n;
    const maxChoices = typeof requestedChoiceCount === "number" && Number.isSafeInteger(requestedChoiceCount) && requestedChoiceCount > 0 ? Math.min(requestedChoiceCount, MAX_STREAM_CHOICES) : MAX_STREAM_CHOICES;
    for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= maxChoices) {
        throw new OpenAIError(`Chat completion stream contains an invalid choice index: ${index}`);
      }
      let choice = snapshot.choices[index];
      if (!choice) {
        const newChoice = { finish_reason, index, message: {}, logprobs, ...other };
        snapshot.choices[index] = newChoice;
        choice = newChoice;
      }
      if (logprobs) {
        if (choice.logprobs) {
          const { content: content2, refusal: refusal2, ...rest3 } = logprobs;
          assertIsEmpty(rest3);
          assignOwnProperties(choice.logprobs, rest3);
          if (content2) {
            (_a4 = choice.logprobs).content ?? (_a4.content = []);
            choice.logprobs.content.push(...content2);
          }
          if (refusal2) {
            (_b = choice.logprobs).refusal ?? (_b.refusal = []);
            choice.logprobs.refusal.push(...refusal2);
          }
        } else {
          choice.logprobs = { ...logprobs };
        }
      }
      if (finish_reason) {
        choice.finish_reason = finish_reason;
        if (__classPrivateFieldGet(this, _ChatCompletionStream_params, "f") && hasAutoParseableInput(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"))) {
          if (finish_reason === "length") {
            throw new LengthFinishReasonError();
          }
          if (finish_reason === "content_filter") {
            throw new ContentFilterFinishReasonError();
          }
        }
      }
      assignOwnProperties(choice, other);
      if (!delta) {
        continue;
      }
      __classPrivateFieldGet(this, _ChatCompletionStream_audioDoneChoiceIndexes, "f").delete(index);
      const { audio, content, refusal, function_call, role, tool_calls, ...rest2 } = delta;
      assertIsEmpty(rest2);
      assignOwnProperties(choice.message, rest2);
      if (audio?.expires_at != null && audio.id == null && audio.data == null && audio.transcript == null && content == null && refusal == null && function_call == null && role == null && tool_calls == null && Object.keys(rest2).length === 0) {
        __classPrivateFieldGet(this, _ChatCompletionStream_audioDoneChoiceIndexes, "f").add(index);
      }
      if (refusal) {
        choice.message.refusal = (choice.message.refusal || "") + refusal;
      }
      if (role) {
        choice.message.role = role;
      }
      if (audio) {
        const audioSnapshot = (_c = choice.message).audio ?? (_c.audio = {});
        if (audio.id != null) {
          audioSnapshot.id = audio.id;
        }
        if (audio.data != null) {
          audioSnapshot.data = (audioSnapshot.data ?? "") + audio.data;
        }
        if (audio.transcript != null) {
          audioSnapshot.transcript = (audioSnapshot.transcript ?? "") + audio.transcript;
        }
        if (audio.expires_at != null) {
          audioSnapshot.expires_at = audio.expires_at;
        }
      }
      if (function_call) {
        if (choice.message.function_call) {
          if (function_call.name) {
            choice.message.function_call.name = function_call.name;
          }
          if (function_call.arguments) {
            (_d = choice.message.function_call).arguments ?? (_d.arguments = "");
            choice.message.function_call.arguments += function_call.arguments;
          }
        } else {
          choice.message.function_call = function_call;
        }
      }
      if (content != null) {
        choice.message.content = (choice.message.content || "") + content;
        if (!choice.message.refusal && isParseableResponseFormat(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.response_format)) {
          choice.message.parsed = choice.message.content.trim() ? partialParse(choice.message.content) : null;
        }
      }
      if (tool_calls) {
        const toolCallSnapshots = (_e = choice.message).tool_calls ?? (_e.tool_calls = []);
        for (const { index: index2, id, type, function: fn, custom, ...rest3 } of tool_calls) {
          if (!Number.isSafeInteger(index2) || index2 < 0 || index2 >= MAX_STREAM_TOOL_CALLS) {
            throw new OpenAIError(`Chat completion stream contains an invalid tool call index: ${index2}`);
          }
          const tool_call = toolCallSnapshots[index2] ?? (toolCallSnapshots[index2] = {});
          assignOwnProperties(tool_call, rest3);
          if (id) {
            tool_call.id = id;
          }
          if (type) {
            tool_call.type = type;
          }
          if (custom) {
            const customSnapshot = tool_call.custom ?? (tool_call.custom = { name: custom.name ?? "", input: "" });
            if (custom.name) {
              customSnapshot.name = custom.name;
            }
            if (custom.input) {
              customSnapshot.input += custom.input;
            }
          }
          if (fn) {
            const functionSnapshot = tool_call.function ?? (tool_call.function = { name: fn.name ?? "", arguments: "" });
            if (fn.name) {
              functionSnapshot.name = fn.name;
            }
            if (fn.arguments) {
              functionSnapshot.arguments += fn.arguments;
              if (shouldParseToolCall(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), tool_call)) {
                functionSnapshot.parsed_arguments = partialParse(functionSnapshot.arguments);
              }
            }
          }
        }
      }
    }
    return snapshot;
  }, Symbol.asyncIterator)]() {
    return this._createIterator((push) => {
      const onChunk = (chunk) => push(chunk);
      this.on("chunk", onChunk);
      return () => this.off("chunk", onChunk);
    }, { onReturn: () => this.abort() });
  }
  /** Serializes raw completion chunks into a readable stream for transfer to another runtime. */
  toReadableStream() {
    const stream2 = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream2.toReadableStream();
  }
};
function finalizeChatCompletion(snapshot, params, audioDoneChoiceIndexes) {
  const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
  const completion = {
    ...rest,
    id,
    choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
      const { content = null, function_call, tool_calls, audio, ...messageRest } = message;
      const finishReason = finish_reason ?? (audioDoneChoiceIndexes.has(index) && isCompleteAudio(audio) ? "stop" : null);
      if (!finishReason) {
        throw new OpenAIError(`missing finish_reason for choice ${index}`);
      }
      const audioResponse = audio ? { audio } : {};
      const role = message.role;
      if (!role) {
        throw new OpenAIError(`missing role for choice ${index}`);
      }
      if (function_call) {
        const { arguments: args, name } = function_call;
        if (args == null) {
          throw new OpenAIError(`missing function_call.arguments for choice ${index}`);
        }
        if (!name) {
          throw new OpenAIError(`missing function_call.name for choice ${index}`);
        }
        return {
          ...choiceRest,
          message: {
            ...audioResponse,
            content,
            function_call: { arguments: args, name },
            role,
            refusal: message.refusal ?? null
          },
          finish_reason: finishReason,
          index,
          logprobs
        };
      }
      if (tool_calls) {
        return {
          ...choiceRest,
          index,
          finish_reason: finishReason,
          logprobs,
          message: {
            ...messageRest,
            ...audioResponse,
            role,
            content,
            refusal: message.refusal ?? null,
            tool_calls: tool_calls.map((tool_call, i) => {
              if (tool_call.type == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].type
${str(snapshot)}`);
              }
              if (tool_call.type === "custom") {
                const { custom, type: type2, id: id3, ...toolRest2 } = tool_call;
                const { input = "", name: name2, ...customRest } = custom || {};
                if (name2 == null) {
                  throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].custom.name
${str(snapshot)}`);
                }
                return {
                  ...toolRest2,
                  id: id3 || `call_${uuid4()}`,
                  type: type2,
                  custom: { ...customRest, name: name2, input }
                };
              }
              const { function: fn, type, id: id2, ...toolRest } = tool_call;
              const { arguments: args, name, ...fnRest } = fn || {};
              if (name == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name
${str(snapshot)}`);
              }
              if (args == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments
${str(snapshot)}`);
              }
              return {
                ...toolRest,
                id: id2 || `call_${uuid4()}`,
                type,
                function: { ...fnRest, name, arguments: args }
              };
            })
          }
        };
      }
      return {
        ...choiceRest,
        message: { ...messageRest, ...audioResponse, content, role, refusal: message.refusal ?? null },
        finish_reason: finishReason,
        index,
        logprobs
      };
    }),
    created,
    model,
    object: "chat.completion",
    ...system_fingerprint ? { system_fingerprint } : {}
  };
  return maybeParseChatCompletion(completion, params);
}
function isCompleteAudio(audio) {
  return audio?.id != null && audio.data != null && audio.transcript != null && audio.expires_at != null;
}
function str(x) {
  return JSON.stringify(x);
}
function assertIsEmpty(obj) {
  void obj;
}
function assertNever(_x) {
  return _x;
}

// node_modules/openai/lib/ChatCompletionStreamingRunner.mjs
var ChatCompletionStreamingRunner = class _ChatCompletionStreamingRunner extends ChatCompletionStream {
  /** Restores a serialized tool run, including intermediate completions and tool-result messages. */
  static fromReadableStream(stream2) {
    const runner = new _ChatCompletionStreamingRunner(null);
    runner._run(() => runner._fromReadableStream(stream2));
    return runner;
  }
  /** Serializes completion chunks and tool-result messages for replay in another runtime. */
  toReadableStream() {
    let lastChunk;
    let toolCallIds;
    const iterator = this._createIterator((push) => {
      const onChunk = (chunk) => {
        lastChunk = chunk;
        push(chunk);
      };
      const onMessage = (message) => {
        if (isAssistantMessage(message)) {
          toolCallIds = message.tool_calls?.map((toolCall) => toolCall.id);
          return;
        }
        if (isToolMessage(message)) {
          if (!lastChunk) {
            throw new OpenAIError("cannot serialize a tool message before receiving any chunks");
          }
          push(makeChatCompletionReadableStreamMessageChunk(lastChunk, message, toolCallIds));
        }
      };
      this.on("chunk", onChunk);
      this.on("message", onMessage);
      return () => {
        this.off("chunk", onChunk);
        this.off("message", onMessage);
      };
    }, { onReturn: () => this.abort() });
    const stream2 = new Stream(() => iterator, this.controller);
    return stream2.toReadableStream();
  }
  /** Starts a streaming tool loop and returns its event-driven conversation runner. */
  static runTools(client, params, options) {
    const runner = new _ChatCompletionStreamingRunner(
      // @ts-expect-error TODO these types are incompatible
      params
    );
    const opts = {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "runTools" }
    };
    runner._run(() => runner._runTools(client, params, runner, opts));
    return runner;
  }
};

// node_modules/openai/resources/chat/completions/completions.mjs
var Completions = class extends APIResource {
  constructor() {
    super(...arguments);
    this.messages = new Messages(this._client);
  }
  create(body, options) {
    return this._client.post("/chat/completions", {
      body,
      ...options,
      stream: body.stream ?? false,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get a stored chat completion. Only Chat Completions that have been created with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * const chatCompletion =
   *   await client.chat.completions.retrieve('completion_id');
   * ```
   */
  retrieve(completionID, options) {
    return this._client.get(path`/chat/completions/${completionID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modify a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be modified. Currently, the only
   * supported modification is to update the `metadata` field.
   *
   * @example
   * ```ts
   * const chatCompletion = await client.chat.completions.update(
   *   'completion_id',
   *   { metadata: { foo: 'string' } },
   * );
   * ```
   */
  update(completionID, body, options) {
    return this._client.post(path`/chat/completions/${completionID}`, {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List stored Chat Completions. Only Chat Completions that have been stored with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletion of client.chat.completions.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/chat/completions", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be deleted.
   *
   * @example
   * ```ts
   * const chatCompletionDeleted =
   *   await client.chat.completions.delete('completion_id');
   * ```
   */
  delete(completionID, options) {
    return this._client.delete(path`/chat/completions/${completionID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  parse(body, options) {
    validateInputTools(body.tools);
    return this._client.chat.completions.create(body, {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "chat.completions.parse" }
    })._thenUnwrap((completion) => parseChatCompletion(completion, body));
  }
  runTools(body, options) {
    if (body.stream) {
      return ChatCompletionStreamingRunner.runTools(this._client, body, options);
    }
    return ChatCompletionRunner.runTools(this._client, body, options);
  }
  /**
   * Creates a chat completion stream
   */
  stream(body, options) {
    return ChatCompletionStream.createChatCompletion(this._client, body, options);
  }
};
Completions.Messages = Messages;

// node_modules/openai/resources/chat/chat.mjs
var Chat = class extends APIResource {
  constructor() {
    super(...arguments);
    this.completions = new Completions(this._client);
  }
};
Chat.Completions = Completions;

// node_modules/openai/resources/admin/organization/admin-api-keys.mjs
var AdminAPIKeys = class extends APIResource {
  /**
   * Create an organization admin API key
   *
   * @example
   * ```ts
   * const adminAPIKey =
   *   await client.admin.organization.adminAPIKeys.create({
   *     name: 'New Admin Key',
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/admin_api_keys", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieve a single organization API key
   *
   * @example
   * ```ts
   * const adminAPIKey =
   *   await client.admin.organization.adminAPIKeys.retrieve(
   *     'key_id',
   *   );
   * ```
   */
  retrieve(keyID, options) {
    return this._client.get(path`/organization/admin_api_keys/${keyID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * List organization API keys
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const adminAPIKey of client.admin.organization.adminAPIKeys.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/admin_api_keys", CursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Delete an organization admin API key
   *
   * @example
   * ```ts
   * const adminAPIKey =
   *   await client.admin.organization.adminAPIKeys.delete(
   *     'key_id',
   *   );
   * ```
   */
  delete(keyID, options) {
    return this._client.delete(path`/organization/admin_api_keys/${keyID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/audit-logs.mjs
var AuditLogs = class extends APIResource {
  /**
   * List user actions and configuration changes within this organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const auditLogListResponse of client.admin.organization.auditLogs.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/audit_logs", ConversationCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/certificates.mjs
var Certificates = class extends APIResource {
  /**
   * Upload a certificate to the organization. This does **not** automatically
   * activate the certificate.
   *
   * Organizations can upload up to 50 certificates.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.admin.organization.certificates.create({
   *     certificate: 'certificate',
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/certificates", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get a certificate that has been uploaded to the organization.
   *
   * You can get a certificate regardless of whether it is active or not.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.admin.organization.certificates.retrieve(
   *     'certificate_id',
   *   );
   * ```
   */
  retrieve(certificateID, query = {}, options) {
    return this._client.get(path`/organization/certificates/${certificateID}`, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Modify a certificate. Note that only the name can be modified.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.admin.organization.certificates.update(
   *     'certificate_id',
   *   );
   * ```
   */
  update(certificateID, body, options) {
    return this._client.post(path`/organization/certificates/${certificateID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * List uploaded certificates for this organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateListResponse of client.admin.organization.certificates.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/certificates", ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Delete a certificate from the organization.
   *
   * The certificate must be inactive for the organization and all projects.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.admin.organization.certificates.delete(
   *     'certificate_id',
   *   );
   * ```
   */
  delete(certificateID, options) {
    return this._client.delete(path`/organization/certificates/${certificateID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Activate certificates at the organization level.
   *
   * You can atomically and idempotently activate up to 10 certificates at a time.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateActivateResponse of client.admin.organization.certificates.activate(
   *   { certificate_ids: ['cert_abc'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  activate(body, options) {
    return this._client.getAPIList("/organization/certificates/activate", Page, {
      body,
      method: "post",
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deactivate certificates at the organization level.
   *
   * You can atomically and idempotently deactivate up to 10 certificates at a time.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateDeactivateResponse of client.admin.organization.certificates.deactivate(
   *   { certificate_ids: ['cert_abc'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  deactivate(body, options) {
    return this._client.getAPIList("/organization/certificates/deactivate", Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
  }
};

// node_modules/openai/resources/admin/organization/data-retention.mjs
var DataRetention = class extends APIResource {
  /**
   * Retrieves organization data retention controls.
   *
   * @example
   * ```ts
   * const organizationDataRetention =
   *   await client.admin.organization.dataRetention.retrieve();
   * ```
   */
  retrieve(options) {
    return this._client.get("/organization/data_retention", {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates organization data retention controls.
   *
   * @example
   * ```ts
   * const organizationDataRetention =
   *   await client.admin.organization.dataRetention.update({
   *     retention_type: 'zero_data_retention',
   *   });
   * ```
   */
  update(body, options) {
    return this._client.post("/organization/data_retention", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/invites.mjs
var Invites = class extends APIResource {
  /**
   * Create an invite for a user to the organization. The invite must be accepted by
   * the user before they have access to the organization.
   *
   * @example
   * ```ts
   * const invite =
   *   await client.admin.organization.invites.create({
   *     email: 'email',
   *     role: 'reader',
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/invites", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves an invite.
   *
   * @example
   * ```ts
   * const invite =
   *   await client.admin.organization.invites.retrieve(
   *     'invite_id',
   *   );
   * ```
   */
  retrieve(inviteID, options) {
    return this._client.get(path`/organization/invites/${inviteID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Returns a list of invites in the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const invite of client.admin.organization.invites.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/invites", ConversationCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Delete an invite. If the invite has already been accepted, it cannot be deleted.
   *
   * @example
   * ```ts
   * const invite =
   *   await client.admin.organization.invites.delete(
   *     'invite_id',
   *   );
   * ```
   */
  delete(inviteID, options) {
    return this._client.delete(path`/organization/invites/${inviteID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/roles.mjs
var Roles = class extends APIResource {
  /**
   * Creates a custom role for the organization.
   *
   * @example
   * ```ts
   * const role = await client.admin.organization.roles.create({
   *   permissions: ['string'],
   *   role_name: 'role_name',
   * });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/roles", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves an organization role.
   *
   * @example
   * ```ts
   * const role = await client.admin.organization.roles.retrieve(
   *   'role_id',
   * );
   * ```
   */
  retrieve(roleID, options) {
    return this._client.get(path`/organization/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates an existing organization role.
   *
   * @example
   * ```ts
   * const role = await client.admin.organization.roles.update(
   *   'role_id',
   * );
   * ```
   */
  update(roleID, body, options) {
    return this._client.post(path`/organization/roles/${roleID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the roles configured for the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const role of client.admin.organization.roles.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/roles", NextCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deletes a custom role from the organization.
   *
   * @example
   * ```ts
   * const role = await client.admin.organization.roles.delete(
   *   'role_id',
   * );
   * ```
   */
  delete(roleID, options) {
    return this._client.delete(path`/organization/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/spend-alerts.mjs
var SpendAlerts = class extends APIResource {
  /**
   * Creates an organization spend alert.
   *
   * @example
   * ```ts
   * const organizationSpendAlert =
   *   await client.admin.organization.spendAlerts.create({
   *     currency: 'USD',
   *     interval: 'month',
   *     notification_channel: {
   *       recipients: ['string'],
   *       type: 'email',
   *     },
   *     threshold_amount: 0,
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/spend_alerts", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves an organization spend alert.
   *
   * @example
   * ```ts
   * const organizationSpendAlert =
   *   await client.admin.organization.spendAlerts.retrieve(
   *     'alert_id',
   *   );
   * ```
   */
  retrieve(alertID, options) {
    return this._client.get(path`/organization/spend_alerts/${alertID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates an organization spend alert.
   *
   * @example
   * ```ts
   * const organizationSpendAlert =
   *   await client.admin.organization.spendAlerts.update(
   *     'alert_id',
   *     {
   *       currency: 'USD',
   *       interval: 'month',
   *       notification_channel: {
   *         recipients: ['string'],
   *         type: 'email',
   *       },
   *       threshold_amount: 0,
   *     },
   *   );
   * ```
   */
  update(alertID, body, options) {
    return this._client.post(path`/organization/spend_alerts/${alertID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists organization spend alerts.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const organizationSpendAlert of client.admin.organization.spendAlerts.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/spend_alerts", ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deletes an organization spend alert.
   *
   * @example
   * ```ts
   * const organizationSpendAlertDeleted =
   *   await client.admin.organization.spendAlerts.delete(
   *     'alert_id',
   *   );
   * ```
   */
  delete(alertID, options) {
    return this._client.delete(path`/organization/spend_alerts/${alertID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/spend-limit.mjs
var SpendLimit = class extends APIResource {
  /**
   * Get the organization's hard spend limit.
   *
   * @example
   * ```ts
   * const organizationSpendLimit =
   *   await client.admin.organization.spendLimit.retrieve();
   * ```
   */
  retrieve(options) {
    return this._client.get("/organization/spend_limit", {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Create or replace the organization's hard spend limit.
   *
   * @example
   * ```ts
   * const organizationSpendLimit =
   *   await client.admin.organization.spendLimit.update({
   *     currency: 'USD',
   *     interval: 'month',
   *     threshold_amount: 1,
   *   });
   * ```
   */
  update(body, options) {
    return this._client.post("/organization/spend_limit", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Delete the organization's hard spend limit.
   *
   * @example
   * ```ts
   * const organizationSpendLimitDeleted =
   *   await client.admin.organization.spendLimit.delete();
   * ```
   */
  delete(options) {
    return this._client.delete("/organization/spend_limit", {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/usage.mjs
var Usage = class extends APIResource {
  /**
   * Get audio speeches usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.audioSpeeches({
   *     start_time: 0,
   *   });
   * ```
   */
  audioSpeeches(query, options) {
    return this._client.get("/organization/usage/audio_speeches", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get audio transcriptions usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.audioTranscriptions(
   *     { start_time: 0 },
   *   );
   * ```
   */
  audioTranscriptions(query, options) {
    return this._client.get("/organization/usage/audio_transcriptions", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get code interpreter sessions usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.codeInterpreterSessions(
   *     { start_time: 0 },
   *   );
   * ```
   */
  codeInterpreterSessions(query, options) {
    return this._client.get("/organization/usage/code_interpreter_sessions", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get completions usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.completions({
   *     start_time: 0,
   *   });
   * ```
   */
  completions(query, options) {
    return this._client.get("/organization/usage/completions", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get costs details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.costs({
   *     start_time: 0,
   *   });
   * ```
   */
  costs(query, options) {
    return this._client.get("/organization/costs", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get embeddings usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.embeddings({
   *     start_time: 0,
   *   });
   * ```
   */
  embeddings(query, options) {
    return this._client.get("/organization/usage/embeddings", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get file search calls usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.fileSearchCalls({
   *     start_time: 0,
   *   });
   * ```
   */
  fileSearchCalls(query, options) {
    return this._client.get("/organization/usage/file_search_calls", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get images usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.images({
   *     start_time: 0,
   *   });
   * ```
   */
  images(query, options) {
    return this._client.get("/organization/usage/images", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get moderations usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.moderations({
   *     start_time: 0,
   *   });
   * ```
   */
  moderations(query, options) {
    return this._client.get("/organization/usage/moderations", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get vector stores usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.vectorStores({
   *     start_time: 0,
   *   });
   * ```
   */
  vectorStores(query, options) {
    return this._client.get("/organization/usage/vector_stores", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Get web search calls usage details for the organization.
   *
   * @example
   * ```ts
   * const response =
   *   await client.admin.organization.usage.webSearchCalls({
   *     start_time: 0,
   *   });
   * ```
   */
  webSearchCalls(query, options) {
    return this._client.get("/organization/usage/web_search_calls", {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/groups/roles.mjs
var Roles2 = class extends APIResource {
  /**
   * Assigns an organization role to a group within the organization.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.groups.roles.create(
   *     'group_id',
   *     { role_id: 'role_id' },
   *   );
   * ```
   */
  create(groupID, body, options) {
    return this._client.post(path`/organization/groups/${groupID}/roles`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves an organization role assigned to a group.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.groups.roles.retrieve(
   *     'role_id',
   *     { group_id: 'group_id' },
   *   );
   * ```
   */
  retrieve(roleID, params, options) {
    const { group_id } = params;
    return this._client.get(path`/organization/groups/${group_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the organization roles assigned to a group within the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const roleListResponse of client.admin.organization.groups.roles.list(
   *   'group_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(groupID, query = {}, options) {
    return this._client.getAPIList(path`/organization/groups/${groupID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Unassigns an organization role from a group within the organization.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.groups.roles.delete(
   *     'role_id',
   *     { group_id: 'group_id' },
   *   );
   * ```
   */
  delete(roleID, params, options) {
    const { group_id } = params;
    return this._client.delete(path`/organization/groups/${group_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/groups/users.mjs
var Users = class extends APIResource {
  /**
   * Adds a user to a group.
   *
   * @example
   * ```ts
   * const user =
   *   await client.admin.organization.groups.users.create(
   *     'group_id',
   *     { user_id: 'user_id' },
   *   );
   * ```
   */
  create(groupID, body, options) {
    return this._client.post(path`/organization/groups/${groupID}/users`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a user in a group.
   *
   * @example
   * ```ts
   * const user =
   *   await client.admin.organization.groups.users.retrieve(
   *     'user_id',
   *     { group_id: 'group_id' },
   *   );
   * ```
   */
  retrieve(userID, params, options) {
    const { group_id } = params;
    return this._client.get(path`/organization/groups/${group_id}/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the users assigned to a group.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const organizationGroupUser of client.admin.organization.groups.users.list(
   *   'group_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(groupID, query = {}, options) {
    return this._client.getAPIList(path`/organization/groups/${groupID}/users`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Removes a user from a group.
   *
   * @example
   * ```ts
   * const user =
   *   await client.admin.organization.groups.users.delete(
   *     'user_id',
   *     { group_id: 'group_id' },
   *   );
   * ```
   */
  delete(userID, params, options) {
    const { group_id } = params;
    return this._client.delete(path`/organization/groups/${group_id}/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/groups/groups.mjs
var Groups = class extends APIResource {
  constructor() {
    super(...arguments);
    this.users = new Users(this._client);
    this.roles = new Roles2(this._client);
  }
  /**
   * Creates a new group in the organization.
   *
   * @example
   * ```ts
   * const group = await client.admin.organization.groups.create(
   *   { name: 'x' },
   * );
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/groups", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a group.
   *
   * @example
   * ```ts
   * const group =
   *   await client.admin.organization.groups.retrieve(
   *     'group_id',
   *   );
   * ```
   */
  retrieve(groupID, options) {
    return this._client.get(path`/organization/groups/${groupID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates a group's information.
   *
   * @example
   * ```ts
   * const group = await client.admin.organization.groups.update(
   *   'group_id',
   *   { name: 'x' },
   * );
   * ```
   */
  update(groupID, body, options) {
    return this._client.post(path`/organization/groups/${groupID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists all groups in the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const group of client.admin.organization.groups.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/groups", NextCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deletes a group from the organization.
   *
   * @example
   * ```ts
   * const group = await client.admin.organization.groups.delete(
   *   'group_id',
   * );
   * ```
   */
  delete(groupID, options) {
    return this._client.delete(path`/organization/groups/${groupID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};
Groups.Users = Users;
Groups.Roles = Roles2;

// node_modules/openai/resources/admin/organization/projects/api-keys.mjs
var APIKeys = class extends APIResource {
  /**
   * Retrieves an API key in the project.
   *
   * @example
   * ```ts
   * const projectAPIKey =
   *   await client.admin.organization.projects.apiKeys.retrieve(
   *     'api_key_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(apiKeyID, params, options) {
    const { project_id } = params;
    return this._client.get(path`/organization/projects/${project_id}/api_keys/${apiKeyID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Returns a list of API keys in the project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectAPIKey of client.admin.organization.projects.apiKeys.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/api_keys`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deletes an API key from the project.
   *
   * Returns confirmation of the key deletion, or an error if the key belonged to a
   * service account.
   *
   * @example
   * ```ts
   * const apiKey =
   *   await client.admin.organization.projects.apiKeys.delete(
   *     'api_key_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(apiKeyID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/organization/projects/${project_id}/api_keys/${apiKeyID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/certificates.mjs
var Certificates2 = class extends APIResource {
  /**
   * List certificates for this project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateListResponse of client.admin.organization.projects.certificates.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/certificates`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Activate certificates at the project level.
   *
   * You can atomically and idempotently activate up to 10 certificates at a time.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateActivateResponse of client.admin.organization.projects.certificates.activate(
   *   'project_id',
   *   { certificate_ids: ['cert_abc'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  activate(projectID, body, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/certificates/activate`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deactivate certificates at the project level. You can atomically and
   * idempotently deactivate up to 10 certificates at a time.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateDeactivateResponse of client.admin.organization.projects.certificates.deactivate(
   *   'project_id',
   *   { certificate_ids: ['cert_abc'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  deactivate(projectID, body, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/certificates/deactivate`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
  }
};

// node_modules/openai/resources/admin/organization/projects/data-retention.mjs
var DataRetention2 = class extends APIResource {
  /**
   * Retrieves project data retention controls.
   *
   * @example
   * ```ts
   * const projectDataRetention =
   *   await client.admin.organization.projects.dataRetention.retrieve(
   *     'project_id',
   *   );
   * ```
   */
  retrieve(projectID, options) {
    return this._client.get(path`/organization/projects/${projectID}/data_retention`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates project data retention controls.
   *
   * @example
   * ```ts
   * const projectDataRetention =
   *   await client.admin.organization.projects.dataRetention.update(
   *     'project_id',
   *     { retention_type: 'organization_default' },
   *   );
   * ```
   */
  update(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/data_retention`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/hosted-tool-permissions.mjs
var HostedToolPermissions = class extends APIResource {
  /**
   * Returns hosted tool permissions for a project.
   *
   * @example
   * ```ts
   * const projectHostedToolPermissions =
   *   await client.admin.organization.projects.hostedToolPermissions.retrieve(
   *     'project_id',
   *   );
   * ```
   */
  retrieve(projectID, options) {
    return this._client.get(path`/organization/projects/${projectID}/hosted_tool_permissions`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates hosted tool permissions for a project.
   *
   * @example
   * ```ts
   * const projectHostedToolPermissions =
   *   await client.admin.organization.projects.hostedToolPermissions.update(
   *     'project_id',
   *   );
   * ```
   */
  update(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/hosted_tool_permissions`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/model-permissions.mjs
var ModelPermissions = class extends APIResource {
  /**
   * Returns model permissions for a project.
   *
   * @example
   * ```ts
   * const projectModelPermissions =
   *   await client.admin.organization.projects.modelPermissions.retrieve(
   *     'project_id',
   *   );
   * ```
   */
  retrieve(projectID, options) {
    return this._client.get(path`/organization/projects/${projectID}/model_permissions`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates model permissions for a project.
   *
   * @example
   * ```ts
   * const projectModelPermissions =
   *   await client.admin.organization.projects.modelPermissions.update(
   *     'project_id',
   *     { mode: 'allow_list', model_ids: ['string'] },
   *   );
   * ```
   */
  update(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/model_permissions`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deletes model permissions for a project.
   *
   * @example
   * ```ts
   * const projectModelPermissionsDeleted =
   *   await client.admin.organization.projects.modelPermissions.delete(
   *     'project_id',
   *   );
   * ```
   */
  delete(projectID, options) {
    return this._client.delete(path`/organization/projects/${projectID}/model_permissions`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/rate-limits.mjs
var RateLimits = class extends APIResource {
  /**
   * Returns the rate limits per model for a project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectRateLimit of client.admin.organization.projects.rateLimits.listRateLimits(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  listRateLimits(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/rate_limits`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Updates a project rate limit.
   *
   * @example
   * ```ts
   * const projectRateLimit =
   *   await client.admin.organization.projects.rateLimits.updateRateLimit(
   *     'rate_limit_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  updateRateLimit(rateLimitID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/organization/projects/${project_id}/rate_limits/${rateLimitID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/roles.mjs
var Roles3 = class extends APIResource {
  /**
   * Creates a custom role for a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.roles.create(
   *     'project_id',
   *     { permissions: ['string'], role_name: 'role_name' },
   *   );
   * ```
   */
  create(projectID, body, options) {
    return this._client.post(path`/projects/${projectID}/roles`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project role.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.roles.retrieve(
   *     'role_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(roleID, params, options) {
    const { project_id } = params;
    return this._client.get(path`/projects/${project_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates an existing project role.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.roles.update(
   *     'role_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  update(roleID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/projects/${project_id}/roles/${roleID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the roles configured for a project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const role of client.admin.organization.projects.roles.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/projects/${projectID}/roles`, NextCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deletes a custom role from a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.roles.delete(
   *     'role_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(roleID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/projects/${project_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/spend-alerts.mjs
var SpendAlerts2 = class extends APIResource {
  /**
   * Creates a project spend alert.
   *
   * @example
   * ```ts
   * const projectSpendAlert =
   *   await client.admin.organization.projects.spendAlerts.create(
   *     'project_id',
   *     {
   *       currency: 'USD',
   *       interval: 'month',
   *       notification_channel: {
   *         recipients: ['string'],
   *         type: 'email',
   *       },
   *       threshold_amount: 0,
   *     },
   *   );
   * ```
   */
  create(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/spend_alerts`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project spend alert.
   *
   * @example
   * ```ts
   * const projectSpendAlert =
   *   await client.admin.organization.projects.spendAlerts.retrieve(
   *     'alert_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(alertID, params, options) {
    const { project_id } = params;
    return this._client.get(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates a project spend alert.
   *
   * @example
   * ```ts
   * const projectSpendAlert =
   *   await client.admin.organization.projects.spendAlerts.update(
   *     'alert_id',
   *     {
   *       project_id: 'project_id',
   *       currency: 'USD',
   *       interval: 'month',
   *       notification_channel: {
   *         recipients: ['string'],
   *         type: 'email',
   *       },
   *       threshold_amount: 0,
   *     },
   *   );
   * ```
   */
  update(alertID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists project spend alerts.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectSpendAlert of client.admin.organization.projects.spendAlerts.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/spend_alerts`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deletes a project spend alert.
   *
   * @example
   * ```ts
   * const projectSpendAlertDeleted =
   *   await client.admin.organization.projects.spendAlerts.delete(
   *     'alert_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(alertID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/spend-limit.mjs
var SpendLimit2 = class extends APIResource {
  /**
   * Get a project's hard spend limit.
   *
   * @example
   * ```ts
   * const projectSpendLimit =
   *   await client.admin.organization.projects.spendLimit.retrieve(
   *     'proj_123',
   *   );
   * ```
   */
  retrieve(projectID, options) {
    return this._client.get(path`/organization/projects/${projectID}/spend_limit`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Create or replace a project's hard spend limit.
   *
   * @example
   * ```ts
   * const projectSpendLimit =
   *   await client.admin.organization.projects.spendLimit.update(
   *     'proj_123',
   *     {
   *       currency: 'USD',
   *       interval: 'month',
   *       threshold_amount: 1,
   *     },
   *   );
   * ```
   */
  update(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/spend_limit`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Delete a project's hard spend limit.
   *
   * @example
   * ```ts
   * const projectSpendLimitDeleted =
   *   await client.admin.organization.projects.spendLimit.delete(
   *     'proj_123',
   *   );
   * ```
   */
  delete(projectID, options) {
    return this._client.delete(path`/organization/projects/${projectID}/spend_limit`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/groups/roles.mjs
var Roles4 = class extends APIResource {
  /**
   * Assigns a project role to a group within a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.groups.roles.create(
   *     'group_id',
   *     { project_id: 'project_id', role_id: 'role_id' },
   *   );
   * ```
   */
  create(groupID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/projects/${project_id}/groups/${groupID}/roles`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project role assigned to a group.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.groups.roles.retrieve(
   *     'role_id',
   *     { project_id: 'project_id', group_id: 'group_id' },
   *   );
   * ```
   */
  retrieve(roleID, params, options) {
    const { project_id, group_id } = params;
    return this._client.get(path`/projects/${project_id}/groups/${group_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the project roles assigned to a group within a project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const roleListResponse of client.admin.organization.projects.groups.roles.list(
   *   'group_id',
   *   { project_id: 'project_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(groupID, params, options) {
    const { project_id, ...query } = params;
    return this._client.getAPIList(path`/projects/${project_id}/groups/${groupID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Unassigns a project role from a group within a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.groups.roles.delete(
   *     'role_id',
   *     { project_id: 'project_id', group_id: 'group_id' },
   *   );
   * ```
   */
  delete(roleID, params, options) {
    const { project_id, group_id } = params;
    return this._client.delete(path`/projects/${project_id}/groups/${group_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/groups/groups.mjs
var Groups2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.roles = new Roles4(this._client);
  }
  /**
   * Grants a group access to a project.
   *
   * @example
   * ```ts
   * const projectGroup =
   *   await client.admin.organization.projects.groups.create(
   *     'project_id',
   *     { group_id: 'group_id', role: 'role' },
   *   );
   * ```
   */
  create(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/groups`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project's group.
   *
   * @example
   * ```ts
   * const projectGroup =
   *   await client.admin.organization.projects.groups.retrieve(
   *     'group_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(groupID, params, options) {
    const { project_id, ...query } = params;
    return this._client.get(path`/organization/projects/${project_id}/groups/${groupID}`, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the groups that have access to a project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectGroup of client.admin.organization.projects.groups.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/groups`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Revokes a group's access to a project.
   *
   * @example
   * ```ts
   * const group =
   *   await client.admin.organization.projects.groups.delete(
   *     'group_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(groupID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/organization/projects/${project_id}/groups/${groupID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};
Groups2.Roles = Roles4;

// node_modules/openai/resources/admin/organization/projects/service-accounts/api-keys.mjs
var APIKeys2 = class extends APIResource {
  /**
   * Creates an API key for a service account in the project.
   *
   * @example
   * ```ts
   * const apiKey =
   *   await client.admin.organization.projects.serviceAccounts.apiKeys.create(
   *     'service_account_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  create(serviceAccountID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}/api_keys`, { body, ...options, __security: { adminAPIKeyAuth: true } });
  }
};

// node_modules/openai/resources/admin/organization/projects/service-accounts/service-accounts.mjs
var ServiceAccounts = class extends APIResource {
  constructor() {
    super(...arguments);
    this.apiKeys = new APIKeys2(this._client);
  }
  /**
   * Creates a new service account in the project. By default, this also returns an
   * unredacted API key for the service account.
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.admin.organization.projects.serviceAccounts.create(
   *     'project_id',
   *     { name: 'name' },
   *   );
   * ```
   */
  create(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/service_accounts`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a service account in the project.
   *
   * @example
   * ```ts
   * const projectServiceAccount =
   *   await client.admin.organization.projects.serviceAccounts.retrieve(
   *     'service_account_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(serviceAccountID, params, options) {
    const { project_id } = params;
    return this._client.get(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Updates a service account in the project.
   *
   * @example
   * ```ts
   * const projectServiceAccount =
   *   await client.admin.organization.projects.serviceAccounts.update(
   *     'service_account_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  update(serviceAccountID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, { body, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Returns a list of service accounts in the project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectServiceAccount of client.admin.organization.projects.serviceAccounts.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/service_accounts`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deletes a service account from the project.
   *
   * Returns confirmation of service account deletion, or an error if the project is
   * archived (archived projects have no service accounts).
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.admin.organization.projects.serviceAccounts.delete(
   *     'service_account_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(serviceAccountID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, { ...options, __security: { adminAPIKeyAuth: true } });
  }
};
ServiceAccounts.APIKeys = APIKeys2;

// node_modules/openai/resources/admin/organization/projects/users/roles.mjs
var Roles5 = class extends APIResource {
  /**
   * Assigns a project role to a user within a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.users.roles.create(
   *     'user_id',
   *     { project_id: 'project_id', role_id: 'role_id' },
   *   );
   * ```
   */
  create(userID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/projects/${project_id}/users/${userID}/roles`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project role assigned to a user.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.users.roles.retrieve(
   *     'role_id',
   *     { project_id: 'project_id', user_id: 'user_id' },
   *   );
   * ```
   */
  retrieve(roleID, params, options) {
    const { project_id, user_id } = params;
    return this._client.get(path`/projects/${project_id}/users/${user_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the project roles assigned to a user within a project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const roleListResponse of client.admin.organization.projects.users.roles.list(
   *   'user_id',
   *   { project_id: 'project_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(userID, params, options) {
    const { project_id, ...query } = params;
    return this._client.getAPIList(path`/projects/${project_id}/users/${userID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Unassigns a project role from a user within a project.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.projects.users.roles.delete(
   *     'role_id',
   *     { project_id: 'project_id', user_id: 'user_id' },
   *   );
   * ```
   */
  delete(roleID, params, options) {
    const { project_id, user_id } = params;
    return this._client.delete(path`/projects/${project_id}/users/${user_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/projects/users/users.mjs
var Users2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.roles = new Roles5(this._client);
  }
  /**
   * Adds a user to the project. Users must already be members of the organization to
   * be added to a project.
   *
   * @example
   * ```ts
   * const projectUser =
   *   await client.admin.organization.projects.users.create(
   *     'project_id',
   *     { role: 'role' },
   *   );
   * ```
   */
  create(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}/users`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a user in the project.
   *
   * @example
   * ```ts
   * const projectUser =
   *   await client.admin.organization.projects.users.retrieve(
   *     'user_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  retrieve(userID, params, options) {
    const { project_id } = params;
    return this._client.get(path`/organization/projects/${project_id}/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Modifies a user's role in the project.
   *
   * @example
   * ```ts
   * const projectUser =
   *   await client.admin.organization.projects.users.update(
   *     'user_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  update(userID, params, options) {
    const { project_id, ...body } = params;
    return this._client.post(path`/organization/projects/${project_id}/users/${userID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Returns a list of users in the project.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const projectUser of client.admin.organization.projects.users.list(
   *   'project_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(projectID, query = {}, options) {
    return this._client.getAPIList(path`/organization/projects/${projectID}/users`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Deletes a user from the project.
   *
   * Returns confirmation of project user deletion, or an error if the project is
   * archived (archived projects have no users).
   *
   * @example
   * ```ts
   * const user =
   *   await client.admin.organization.projects.users.delete(
   *     'user_id',
   *     { project_id: 'project_id' },
   *   );
   * ```
   */
  delete(userID, params, options) {
    const { project_id } = params;
    return this._client.delete(path`/organization/projects/${project_id}/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};
Users2.Roles = Roles5;

// node_modules/openai/resources/admin/organization/projects/projects.mjs
var Projects = class extends APIResource {
  constructor() {
    super(...arguments);
    this.users = new Users2(this._client);
    this.serviceAccounts = new ServiceAccounts(this._client);
    this.apiKeys = new APIKeys(this._client);
    this.rateLimits = new RateLimits(this._client);
    this.modelPermissions = new ModelPermissions(this._client);
    this.hostedToolPermissions = new HostedToolPermissions(this._client);
    this.groups = new Groups2(this._client);
    this.roles = new Roles3(this._client);
    this.dataRetention = new DataRetention2(this._client);
    this.spendLimit = new SpendLimit2(this._client);
    this.spendAlerts = new SpendAlerts2(this._client);
    this.certificates = new Certificates2(this._client);
  }
  /**
   * Create a new project in the organization. Projects can be created and archived,
   * but cannot be deleted.
   *
   * @example
   * ```ts
   * const project =
   *   await client.admin.organization.projects.create({
   *     name: 'name',
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/organization/projects", {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves a project.
   *
   * @example
   * ```ts
   * const project =
   *   await client.admin.organization.projects.retrieve(
   *     'project_id',
   *   );
   * ```
   */
  retrieve(projectID, options) {
    return this._client.get(path`/organization/projects/${projectID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Modifies a project in the organization.
   *
   * @example
   * ```ts
   * const project =
   *   await client.admin.organization.projects.update(
   *     'project_id',
   *   );
   * ```
   */
  update(projectID, body, options) {
    return this._client.post(path`/organization/projects/${projectID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Returns a list of projects.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const project of client.admin.organization.projects.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/projects", ConversationCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Archives a project in the organization. Archived projects cannot be used or
   * updated.
   *
   * @example
   * ```ts
   * const project =
   *   await client.admin.organization.projects.archive(
   *     'project_id',
   *   );
   * ```
   */
  archive(projectID, options) {
    return this._client.post(path`/organization/projects/${projectID}/archive`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};
Projects.Users = Users2;
Projects.ServiceAccounts = ServiceAccounts;
Projects.APIKeys = APIKeys;
Projects.RateLimits = RateLimits;
Projects.ModelPermissions = ModelPermissions;
Projects.HostedToolPermissions = HostedToolPermissions;
Projects.Groups = Groups2;
Projects.Roles = Roles3;
Projects.DataRetention = DataRetention2;
Projects.SpendLimit = SpendLimit2;
Projects.SpendAlerts = SpendAlerts2;
Projects.Certificates = Certificates2;

// node_modules/openai/resources/admin/organization/users/roles.mjs
var Roles6 = class extends APIResource {
  /**
   * Assigns an organization role to a user within the organization.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.users.roles.create(
   *     'user_id',
   *     { role_id: 'role_id' },
   *   );
   * ```
   */
  create(userID, body, options) {
    return this._client.post(path`/organization/users/${userID}/roles`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Retrieves an organization role assigned to a user.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.users.roles.retrieve(
   *     'role_id',
   *     { user_id: 'user_id' },
   *   );
   * ```
   */
  retrieve(roleID, params, options) {
    const { user_id } = params;
    return this._client.get(path`/organization/users/${user_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists the organization roles assigned to a user within the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const roleListResponse of client.admin.organization.users.roles.list(
   *   'user_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(userID, query = {}, options) {
    return this._client.getAPIList(path`/organization/users/${userID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * Unassigns an organization role from a user within the organization.
   *
   * @example
   * ```ts
   * const role =
   *   await client.admin.organization.users.roles.delete(
   *     'role_id',
   *     { user_id: 'user_id' },
   *   );
   * ```
   */
  delete(roleID, params, options) {
    const { user_id } = params;
    return this._client.delete(path`/organization/users/${user_id}/roles/${roleID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};

// node_modules/openai/resources/admin/organization/users/users.mjs
var Users3 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.roles = new Roles6(this._client);
  }
  /**
   * Retrieves a user by their identifier.
   *
   * @example
   * ```ts
   * const organizationUser =
   *   await client.admin.organization.users.retrieve('user_id');
   * ```
   */
  retrieve(userID, options) {
    return this._client.get(path`/organization/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Modifies a user's role in the organization.
   *
   * @example
   * ```ts
   * const organizationUser =
   *   await client.admin.organization.users.update('user_id');
   * ```
   */
  update(userID, body, options) {
    return this._client.post(path`/organization/users/${userID}`, {
      body,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Lists all of the users in the organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const organizationUser of client.admin.organization.users.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/organization/users", ConversationCursorPage, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * Deletes a user from the organization.
   *
   * @example
   * ```ts
   * const user = await client.admin.organization.users.delete(
   *   'user_id',
   * );
   * ```
   */
  delete(userID, options) {
    return this._client.delete(path`/organization/users/${userID}`, {
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
};
Users3.Roles = Roles6;

// node_modules/openai/resources/admin/organization/organization.mjs
var Organization = class extends APIResource {
  constructor() {
    super(...arguments);
    this.auditLogs = new AuditLogs(this._client);
    this.adminAPIKeys = new AdminAPIKeys(this._client);
    this.usage = new Usage(this._client);
    this.invites = new Invites(this._client);
    this.users = new Users3(this._client);
    this.groups = new Groups(this._client);
    this.roles = new Roles(this._client);
    this.dataRetention = new DataRetention(this._client);
    this.spendLimit = new SpendLimit(this._client);
    this.spendAlerts = new SpendAlerts(this._client);
    this.certificates = new Certificates(this._client);
    this.projects = new Projects(this._client);
  }
};
Organization.AuditLogs = AuditLogs;
Organization.AdminAPIKeys = AdminAPIKeys;
Organization.Usage = Usage;
Organization.Invites = Invites;
Organization.Users = Users3;
Organization.Groups = Groups;
Organization.Roles = Roles;
Organization.DataRetention = DataRetention;
Organization.SpendLimit = SpendLimit;
Organization.SpendAlerts = SpendAlerts;
Organization.Certificates = Certificates;
Organization.Projects = Projects;

// node_modules/openai/resources/admin/admin.mjs
var Admin = class extends APIResource {
  constructor() {
    super(...arguments);
    this.organization = new Organization(this._client);
  }
};
Admin.Organization = Organization;

// node_modules/openai/resources/audio/speech.mjs
var Speech = class extends APIResource {
  /**
   * Generates audio from the input text.
   *
   * Returns the audio file content, or a stream of audio events.
   *
   * @example
   * ```ts
   * const speech = await client.audio.speech.create({
   *   input: 'input',
   *   model: 'tts-1',
   *   voice: 'alloy',
   * });
   *
   * const content = await speech.blob();
   * console.log(content);
   * ```
   */
  create(body, options) {
    return this._client.post("/audio/speech", {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "application/octet-stream" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/audio/transcriptions.mjs
var Transcriptions = class extends APIResource {
  create(body, options) {
    return this._client.post("/audio/transcriptions", multipartFormRequestOptions({
      body,
      ...options,
      stream: body.stream ?? false,
      __metadata: { model: body.model },
      __security: { bearerAuth: true }
    }, this._client));
  }
};

// node_modules/openai/resources/audio/translations.mjs
var Translations = class extends APIResource {
  create(body, options) {
    return this._client.post("/audio/translations", multipartFormRequestOptions({ body, ...options, __metadata: { model: body.model }, __security: { bearerAuth: true } }, this._client));
  }
};

// node_modules/openai/resources/audio/audio.mjs
var Audio = class extends APIResource {
  constructor() {
    super(...arguments);
    this.transcriptions = new Transcriptions(this._client);
    this.translations = new Translations(this._client);
    this.speech = new Speech(this._client);
  }
};
Audio.Transcriptions = Transcriptions;
Audio.Translations = Translations;
Audio.Speech = Speech;

// node_modules/openai/resources/batches.mjs
var Batches = class extends APIResource {
  /**
   * Creates and executes a batch from an uploaded file of requests
   */
  create(body, options) {
    return this._client.post("/batches", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Retrieves a batch.
   */
  retrieve(batchID, options) {
    return this._client.get(path`/batches/${batchID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * List your organization's batches.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/batches", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
   * 10 minutes, before changing to `cancelled`, where it will have partial results
   * (if any) available in the output file.
   */
  cancel(batchID, options) {
    return this._client.post(path`/batches/${batchID}/cancel`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/assistants.mjs
var Assistants = class extends APIResource {
  /**
   * Create an assistant with a model and instructions.
   *
   * @deprecated
   */
  create(body, options) {
    return this._client.post("/assistants", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves an assistant.
   *
   * @deprecated
   */
  retrieve(assistantID, options) {
    return this._client.get(path`/assistants/${assistantID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modifies an assistant.
   *
   * @deprecated
   */
  update(assistantID, body, options) {
    return this._client.post(path`/assistants/${assistantID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of assistants.
   *
   * @deprecated
   */
  list(query = {}, options) {
    return this._client.getAPIList("/assistants", CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete an assistant.
   *
   * @deprecated
   */
  delete(assistantID, options) {
    return this._client.delete(path`/assistants/${assistantID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/realtime/sessions.mjs
var Sessions = class extends APIResource {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API. Can be configured with the same session parameters as the
   * `session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const session =
   *   await client.beta.realtime.sessions.create();
   * ```
   */
  create(body, options) {
    return this._client.post("/realtime/sessions", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/realtime/transcription-sessions.mjs
var TranscriptionSessions = class extends APIResource {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API specifically for realtime transcriptions. Can be configured with
   * the same session parameters as the `transcription_session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const transcriptionSession =
   *   await client.beta.realtime.transcriptionSessions.create();
   * ```
   */
  create(body, options) {
    return this._client.post("/realtime/transcription_sessions", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/realtime/realtime.mjs
var Realtime = class extends APIResource {
  constructor() {
    super(...arguments);
    this.sessions = new Sessions(this._client);
    this.transcriptionSessions = new TranscriptionSessions(this._client);
  }
};
Realtime.Sessions = Sessions;
Realtime.TranscriptionSessions = TranscriptionSessions;

// node_modules/openai/resources/beta/chatkit/sessions.mjs
var Sessions2 = class extends APIResource {
  /**
   * Create a ChatKit session.
   *
   * @example
   * ```ts
   * const chatSession =
   *   await client.beta.chatkit.sessions.create({
   *     user: 'x',
   *     workflow: { id: 'id' },
   *   });
   * ```
   */
  create(body, options) {
    return this._client.post("/chatkit/sessions", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancel an active ChatKit session and return its most recent metadata.
   *
   * Cancelling prevents new requests from using the issued client secret.
   *
   * @example
   * ```ts
   * const chatSession =
   *   await client.beta.chatkit.sessions.cancel('cksess_123');
   * ```
   */
  cancel(sessionID, options) {
    return this._client.post(path`/chatkit/sessions/${sessionID}/cancel`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/chatkit/threads.mjs
var Threads = class extends APIResource {
  /**
   * Retrieve a ChatKit thread by its identifier.
   *
   * @example
   * ```ts
   * const chatkitThread =
   *   await client.beta.chatkit.threads.retrieve('cthr_123');
   * ```
   */
  retrieve(threadID, options) {
    return this._client.get(path`/chatkit/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * List ChatKit threads with optional pagination and user filters.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatkitThread of client.beta.chatkit.threads.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/chatkit/threads", ConversationCursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a ChatKit thread along with its items and stored attachments.
   *
   * @example
   * ```ts
   * const thread = await client.beta.chatkit.threads.delete(
   *   'cthr_123',
   * );
   * ```
   */
  delete(threadID, options) {
    return this._client.delete(path`/chatkit/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * List items that belong to a ChatKit thread.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const thread of client.beta.chatkit.threads.listItems(
   *   'cthr_123',
   * )) {
   *   // ...
   * }
   * ```
   */
  listItems(threadID, query = {}, options) {
    return this._client.getAPIList(path`/chatkit/threads/${threadID}/items`, ConversationCursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/chatkit/chatkit.mjs
var ChatKit = class extends APIResource {
  constructor() {
    super(...arguments);
    this.sessions = new Sessions2(this._client);
    this.threads = new Threads(this._client);
  }
};
ChatKit.Sessions = Sessions2;
ChatKit.Threads = Threads;

// node_modules/openai/resources/beta/responses/input-items.mjs
var InputItems = class extends APIResource {
  /**
   * Returns a list of input items for a given response.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaResponseItem of client.beta.responses.inputItems.list(
   *   'response_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(responseID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/responses/${responseID}/input_items?beta=true`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/responses/input-tokens.mjs
var InputTokens = class extends APIResource {
  /**
   * Returns input token counts of the request.
   *
   * Returns an object with `object` set to `response.input_tokens` and an
   * `input_tokens` count.
   *
   * @example
   * ```ts
   * const response =
   *   await client.beta.responses.inputTokens.count();
   * ```
   */
  count(params = {}, options) {
    const { betas, ...body } = params ?? {};
    return this._client.post("/responses/input_tokens?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/responses/responses.mjs
var Responses = class extends APIResource {
  constructor() {
    super(...arguments);
    this.inputItems = new InputItems(this._client);
    this.inputTokens = new InputTokens(this._client);
  }
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/responses?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      stream: params.stream ?? false,
      __security: { bearerAuth: true }
    });
  }
  retrieve(responseID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/responses/${responseID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      stream: params?.stream ?? false,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Deletes a model response with the given ID.
   *
   * @example
   * ```ts
   * await client.beta.responses.delete(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  delete(responseID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/responses/${responseID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { Accept: "*/*", ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancels a model response with the given ID. Only responses created with the
   * `background` parameter set to `true` can be cancelled.
   * [Learn more](https://platform.openai.com/docs/guides/background).
   *
   * @example
   * ```ts
   * const betaResponse = await client.beta.responses.cancel(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  cancel(responseID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/responses/${responseID}/cancel?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Compact a conversation. Returns a compacted response object.
   *
   * Learn when and how to compact long-running conversations in the
   * [conversation state guide](https://platform.openai.com/docs/guides/conversation-state#managing-the-context-window).
   * For ZDR-compatible compaction details, see
   * [Compaction (advanced)](https://platform.openai.com/docs/guides/conversation-state#compaction-advanced).
   *
   * @example
   * ```ts
   * const betaCompactedResponse =
   *   await client.beta.responses.compact({
   *     model: 'gpt-5.6-sol',
   *   });
   * ```
   */
  compact(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/responses/compact?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "openai-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      __security: { bearerAuth: true }
    });
  }
};
Responses.InputItems = InputItems;
Responses.InputTokens = InputTokens;

// node_modules/openai/resources/beta/threads/messages.mjs
var Messages2 = class extends APIResource {
  /**
   * Create a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(threadID, body, options) {
    return this._client.post(path`/threads/${threadID}/messages`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieve a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(messageID, params, options) {
    const { thread_id } = params;
    return this._client.get(path`/threads/${thread_id}/messages/${messageID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modifies a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(messageID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path`/threads/${thread_id}/messages/${messageID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of messages for a given thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(threadID, query = {}, options) {
    return this._client.getAPIList(path`/threads/${threadID}/messages`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Deletes a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(messageID, params, options) {
    const { thread_id } = params;
    return this._client.delete(path`/threads/${thread_id}/messages/${messageID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/beta/threads/runs/steps.mjs
var Steps = class extends APIResource {
  /**
   * Retrieves a run step.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(stepID, params, options) {
    const { thread_id, run_id, ...query } = params;
    return this._client.get(path`/threads/${thread_id}/runs/${run_id}/steps/${stepID}`, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of run steps belonging to a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(runID, params, options) {
    const { thread_id, ...query } = params;
    return this._client.getAPIList(path`/threads/${thread_id}/runs/${runID}/steps`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/internal/utils/base64.mjs
var fromBase64 = (str2) => {
  if (typeof globalThis.Buffer !== "undefined") {
    const buf = globalThis.Buffer.from(str2, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (typeof atob !== "undefined") {
    const bstr = atob(str2);
    const buf = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      buf[i] = bstr.charCodeAt(i);
    }
    return buf;
  }
  throw new OpenAIError("Cannot decode base64 string; Expected `Buffer` or `atob` to be defined");
};
var toFloat32Array = (base64Str) => {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64Str, "base64");
    return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT));
  } else {
    const binaryStr = atob(base64Str);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return Array.from(new Float32Array(bytes.buffer));
  }
};

// node_modules/openai/internal/utils/env.mjs
var readEnv = (env) => {
  if (typeof globalThis.process !== "undefined") {
    return globalThis.process.env?.[env]?.trim() || void 0;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return globalThis.Deno.env?.get?.(env)?.trim() || void 0;
  }
  return void 0;
};

// node_modules/openai/internal/assistant-stream-delta.mjs
var MAX_ASSISTANT_STREAM_ARRAY_GROWTH = 1024;
var MAX_EXTERNALLY_MUTABLE_ASSISTANT_STREAM_ARRAY_LENGTH = 65536;
var assistantStreamArrayStates = /* @__PURE__ */ new WeakMap();
var externallyMutableAssistantStreamValues = /* @__PURE__ */ new WeakSet();
function createAssistantStreamDeltaProjection(cacheArrays) {
  return { arrays: /* @__PURE__ */ new Map(), cacheArrays, records: /* @__PURE__ */ new WeakMap() };
}
function commitAssistantStreamArrayProjection(projection) {
  for (const [array, projected] of projection.arrays) {
    if (projected.cacheable && !externallyMutableAssistantStreamValues.has(array)) {
      assistantStreamArrayStates.set(array, {
        length: projected.length,
        ownEntryCount: projected.ownEntryCount
      });
    } else {
      assistantStreamArrayStates.delete(array);
    }
  }
}
function isPrimitiveAssistantStreamValue(value) {
  return typeof value === "string" || typeof value === "number";
}
function isPrimitiveAssistantStreamArrayDelta(accumulator, delta) {
  return delta.every(isPrimitiveAssistantStreamValue) && accumulator.every(isPrimitiveAssistantStreamValue);
}
function countOwnAssistantStreamArrayEntries(accumulator) {
  let count = 0;
  for (const key of Object.keys(accumulator)) {
    const index = Number(key);
    if (Number.isSafeInteger(index) && index >= 0 && index < accumulator.length && String(index) === key) {
      count += 1;
    }
  }
  return count;
}
function getAssistantStreamArrayOwnEntryCount(accumulator, enforceSparseHoleBudget, cachedState) {
  if (!enforceSparseHoleBudget) {
    return 0;
  }
  if (cachedState?.length === accumulator.length) {
    return cachedState.ownEntryCount;
  }
  return countOwnAssistantStreamArrayEntries(accumulator);
}
function getAssistantStreamDeltaIndex(deltaEntry, kind, baselineLength) {
  const { index } = deltaEntry;
  if (kind === "array" && (index === null || index === void 0)) {
    console.error(deltaEntry);
    throw new Error("Expected array delta entry to have an `index` property");
  }
  if (kind === "array" && typeof index !== "number") {
    throw new TypeError(`Expected array delta entry \`index\` property to be a number but got ${index}`);
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= baselineLength + MAX_ASSISTANT_STREAM_ARRAY_GROWTH || index >= MAX_EXTERNALLY_MUTABLE_ASSISTANT_STREAM_ARRAY_LENGTH) {
    throw new OpenAIError(`Assistant stream delta contains an invalid ${kind} index: ${index}`);
  }
  return index;
}
function assertValidAssistantStreamArrayDelta(accumulator, delta, kind, projection, validateRecord) {
  let projectedArray = projection.arrays.get(accumulator);
  if (!projectedArray) {
    const enforceSparseHoleBudget = projection.cacheArrays && !externallyMutableAssistantStreamValues.has(accumulator);
    const cachedState = enforceSparseHoleBudget ? assistantStreamArrayStates.get(accumulator) : void 0;
    projectedArray = {
      baselineLength: accumulator.length,
      cacheable: enforceSparseHoleBudget,
      enforceSparseHoleBudget,
      entries: /* @__PURE__ */ new Map(),
      length: accumulator.length,
      ownEntryCount: getAssistantStreamArrayOwnEntryCount(accumulator, enforceSparseHoleBudget, cachedState)
    };
    projection.arrays.set(accumulator, projectedArray);
  }
  for (const deltaEntry of delta) {
    if (!isObj(deltaEntry)) {
      throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
    }
    const validatedIndex = getAssistantStreamDeltaIndex(deltaEntry, kind, projectedArray.baselineLength);
    let accumulatedEntry;
    if (projectedArray.entries.has(validatedIndex)) {
      accumulatedEntry = projectedArray.entries.get(validatedIndex);
    } else if (hasOwn(accumulator, validatedIndex)) {
      accumulatedEntry = accumulator[validatedIndex];
      if (accumulatedEntry === null || accumulatedEntry === void 0) {
        projectedArray.entries.set(validatedIndex, deltaEntry);
      }
    } else {
      projectedArray.entries.set(validatedIndex, deltaEntry);
      projectedArray.ownEntryCount += 1;
    }
    const projectedLength = Math.max(projectedArray.length, validatedIndex + 1);
    if (projectedArray.enforceSparseHoleBudget && projectedLength - projectedArray.ownEntryCount > MAX_ASSISTANT_STREAM_ARRAY_GROWTH) {
      throw new OpenAIError(`Assistant stream delta contains an invalid ${kind} index: ${validatedIndex}`);
    }
    if (isObj(accumulatedEntry)) {
      validateRecord(accumulatedEntry, deltaEntry, projection);
    }
    projectedArray.length = projectedLength;
  }
}
function assertValidAssistantStreamDeltaIndices(accumulator, delta, projection) {
  let projectedValues = projection.records.get(accumulator);
  for (const [key, deltaValue] of Object.entries(delta)) {
    if (key === "index" || key === "type") {
      continue;
    }
    let accumulatedValue;
    if (projectedValues?.has(key)) {
      accumulatedValue = projectedValues.get(key);
    } else if (hasOwn(accumulator, key)) {
      accumulatedValue = accumulator[key];
    }
    if (accumulatedValue === null || accumulatedValue === void 0) {
      if (!projectedValues) {
        projectedValues = /* @__PURE__ */ new Map();
        projection.records.set(accumulator, projectedValues);
      }
      projectedValues.set(key, deltaValue);
      continue;
    }
    if (isObj(accumulatedValue) && isObj(deltaValue)) {
      assertValidAssistantStreamDeltaIndices(accumulatedValue, deltaValue, projection);
    } else if (Array.isArray(accumulatedValue) && Array.isArray(deltaValue) && !isPrimitiveAssistantStreamArrayDelta(accumulatedValue, deltaValue)) {
      assertValidAssistantStreamArrayDelta(accumulatedValue, deltaValue, "array", projection, assertValidAssistantStreamDeltaIndices);
    }
  }
}
function isAssistantStreamValueExternallyMutable(value) {
  return (isObj(value) || Array.isArray(value)) && externallyMutableAssistantStreamValues.has(value);
}
function markAssistantStreamValueExternallyMutable(value) {
  if (!isObj(value) && !Array.isArray(value) || externallyMutableAssistantStreamValues.has(value)) {
    return;
  }
  externallyMutableAssistantStreamValues.add(value);
  if (Array.isArray(value)) {
    assistantStreamArrayStates.delete(value);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      markAssistantStreamValueExternallyMutable(descriptor.value);
    }
  }
}
function defineAssistantStreamArrayEntry(accumulator, index, value) {
  if (externallyMutableAssistantStreamValues.has(accumulator)) {
    markAssistantStreamValueExternallyMutable(value);
  }
  Object.defineProperty(accumulator, index, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
}
function getRequiredAssistantStreamArrayIndex(deltaEntry) {
  const { index } = deltaEntry;
  if (index === null || index === void 0) {
    console.error(deltaEntry);
    throw new Error("Expected array delta entry to have an `index` property");
  }
  if (typeof index !== "number") {
    throw new TypeError(`Expected array delta entry \`index\` property to be a number but got ${index}`);
  }
  return index;
}
function applyAssistantStreamArrayDelta(accumulator, delta, applyRecord) {
  if (isPrimitiveAssistantStreamArrayDelta(accumulator, delta)) {
    accumulator.push(...delta);
    assistantStreamArrayStates.delete(accumulator);
    return;
  }
  for (const deltaEntry of delta) {
    if (!isObj(deltaEntry)) {
      throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
    }
    const index = getRequiredAssistantStreamArrayIndex(deltaEntry);
    if (hasOwn(accumulator, index)) {
      const accumulatedEntry = accumulator[index];
      if (accumulatedEntry === null || accumulatedEntry === void 0) {
        if (externallyMutableAssistantStreamValues.has(accumulator)) {
          markAssistantStreamValueExternallyMutable(deltaEntry);
        }
        accumulator[index] = deltaEntry;
      } else {
        accumulator[index] = applyRecord(accumulatedEntry, deltaEntry);
      }
    } else {
      defineAssistantStreamArrayEntry(accumulator, index, deltaEntry);
    }
  }
}
function applyAssistantStreamDelta(accumulator, delta) {
  const externallyMutable = externallyMutableAssistantStreamValues.has(accumulator);
  for (const [key, deltaValue] of Object.entries(delta)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new OpenAIError(`Assistant stream delta contains an unsafe property: ${key}`);
    }
    if (!hasOwn(accumulator, key)) {
      if (externallyMutable) {
        markAssistantStreamValueExternallyMutable(deltaValue);
      }
      accumulator[key] = deltaValue;
      continue;
    }
    let accumulatedValue = accumulator[key];
    if (accumulatedValue === null || accumulatedValue === void 0) {
      if (externallyMutable) {
        markAssistantStreamValueExternallyMutable(deltaValue);
      }
      accumulator[key] = deltaValue;
      continue;
    }
    if (key === "index" || key === "type") {
      accumulator[key] = deltaValue;
      continue;
    }
    if (typeof accumulatedValue === "string" && typeof deltaValue === "string") {
      accumulatedValue += deltaValue;
    } else if (typeof accumulatedValue === "number" && typeof deltaValue === "number") {
      accumulatedValue += deltaValue;
    } else if (isObj(accumulatedValue) && isObj(deltaValue)) {
      accumulatedValue = applyAssistantStreamDelta(accumulatedValue, deltaValue);
    } else if (Array.isArray(accumulatedValue) && Array.isArray(deltaValue)) {
      applyAssistantStreamArrayDelta(accumulatedValue, deltaValue, applyAssistantStreamDelta);
      continue;
    } else {
      throw new TypeError(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accumulatedValue}`);
    }
    accumulator[key] = accumulatedValue;
  }
  return accumulator;
}
function assertSafeAssistantStreamDelta(value) {
  if (!isObj(value) && !Array.isArray(value)) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new OpenAIError(`Assistant stream delta contains an unsafe property: ${key}`);
    }
    assertSafeAssistantStreamDelta(nestedValue);
  }
}
function accumulateAssistantStreamDelta(accumulator, delta, cacheArrays = false) {
  assertSafeAssistantStreamDelta(delta);
  const accumulatorRecord = accumulator;
  const deltaRecord = delta;
  const projection = createAssistantStreamDeltaProjection(cacheArrays && !isAssistantStreamValueExternallyMutable(accumulator));
  assertValidAssistantStreamDeltaIndices(accumulatorRecord, deltaRecord, projection);
  applyAssistantStreamDelta(accumulatorRecord, deltaRecord);
  commitAssistantStreamArrayProjection(projection);
  return accumulator;
}
function createAssistantStreamArrayDeltaCommit(accumulator, delta, kind, cacheArrays = true) {
  assertSafeAssistantStreamDelta(delta);
  const projection = createAssistantStreamDeltaProjection(cacheArrays && !isAssistantStreamValueExternallyMutable(accumulator));
  assertValidAssistantStreamArrayDelta(accumulator, delta, kind, projection, assertValidAssistantStreamDeltaIndices);
  return () => commitAssistantStreamArrayProjection(projection);
}

// node_modules/openai/lib/AssistantStream.mjs
var _AssistantStream_instances;
var _AssistantStream_events;
var _AssistantStream_runStepSnapshots;
var _AssistantStream_messageSnapshots;
var _AssistantStream_messageSnapshot;
var _AssistantStream_finalRun;
var _AssistantStream_currentContentIndex;
var _AssistantStream_currentContent;
var _AssistantStream_currentToolCallIndex;
var _AssistantStream_currentToolCall;
var _AssistantStream_currentEvent;
var _AssistantStream_currentRunSnapshot;
var _AssistantStream_currentRunStepSnapshot;
var _AssistantStream_addEvent;
var _AssistantStream_endRequest;
var _AssistantStream_handleMessage;
var _AssistantStream_handleRunStep;
var _AssistantStream_emitExposed;
var _AssistantStream_handleEvent;
var _AssistantStream_accumulateRunStep;
var _AssistantStream_accumulateMessage;
var _AssistantStream_accumulateContent;
var _AssistantStream_handleRun;
var AssistantStream = class _AssistantStream extends EventStream {
  constructor() {
    super(...arguments);
    _AssistantStream_instances.add(this);
    _AssistantStream_events.set(this, []);
    _AssistantStream_runStepSnapshots.set(this, /* @__PURE__ */ Object.create(null));
    _AssistantStream_messageSnapshots.set(this, /* @__PURE__ */ Object.create(null));
    _AssistantStream_messageSnapshot.set(this, void 0);
    _AssistantStream_finalRun.set(this, void 0);
    _AssistantStream_currentContentIndex.set(this, void 0);
    _AssistantStream_currentContent.set(this, void 0);
    _AssistantStream_currentToolCallIndex.set(this, void 0);
    _AssistantStream_currentToolCall.set(this, void 0);
    _AssistantStream_currentEvent.set(this, void 0);
    _AssistantStream_currentRunSnapshot.set(this, void 0);
    _AssistantStream_currentRunStepSnapshot.set(this, void 0);
  }
  /** Iterates over cloned raw assistant events; stopping early aborts the underlying request. */
  [(_AssistantStream_events = /* @__PURE__ */ new WeakMap(), _AssistantStream_runStepSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_finalRun = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContentIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCallIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCall = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentEvent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunStepSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_instances = /* @__PURE__ */ new WeakSet(), Symbol.asyncIterator)]() {
    return this._createIterator((push) => {
      const onEvent = (event) => push(structuredClone(event));
      this.on("event", onEvent);
      return () => this.off("event", onEvent);
    }, { onReturn: () => this.abort() });
  }
  /** Restores an assistant stream from events serialized by `toReadableStream()`. */
  static fromReadableStream(stream2) {
    const runner = new _AssistantStream();
    runner._run(() => runner._fromReadableStream(stream2));
    return runner;
  }
  async _fromReadableStream(readableStream, options) {
    this._listenForAbort(options?.signal);
    this._connected();
    const stream2 = Stream.fromReadableStream(readableStream, this.controller);
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  /** Serializes assistant events into a readable stream for transfer to another runtime. */
  toReadableStream() {
    const stream2 = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream2.toReadableStream();
  }
  /** Submits tool outputs and starts streaming the continuation of an existing assistant run. */
  static createToolAssistantStream(runId, runs, params, options) {
    const runner = new _AssistantStream();
    runner._run(() => runner._runToolAssistantStream(runId, runs, params, {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "stream" }
    }));
    return runner;
  }
  async _createToolAssistantStream(run2, runId, params, options) {
    this._listenForAbort(options?.signal);
    const body = { ...params, stream: true };
    const stream2 = await run2.submitToolOutputs(runId, body, {
      ...options,
      signal: this.controller.signal
    });
    this._connected();
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  /** Creates an assistant thread and starts streaming its newly created run. */
  static createThreadAssistantStream(params, thread, options) {
    const runner = new _AssistantStream();
    runner._run(() => runner._threadAssistantStream(params, thread, {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "stream" }
    }));
    return runner;
  }
  /** Creates a run on an existing assistant thread and starts streaming its events. */
  static createAssistantStream(threadId, runs, params, options) {
    const runner = new _AssistantStream();
    runner._run(() => runner._runAssistantStream(threadId, runs, params, {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "stream" }
    }));
    return runner;
  }
  /** Returns the most recent raw event, or `undefined` before any event arrives. */
  currentEvent() {
    markAssistantStreamValueExternallyMutable(__classPrivateFieldGet(this, _AssistantStream_currentEvent, "f"));
    return __classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
  }
  /** Returns the latest run snapshot, or `undefined` before a run event arrives. */
  currentRun() {
    markAssistantStreamValueExternallyMutable(__classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f"));
    return __classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
  }
  /** Returns the message currently being accumulated, or `undefined` before message creation. */
  currentMessageSnapshot() {
    markAssistantStreamValueExternallyMutable(__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
    return __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
  }
  /** Returns the run step currently being accumulated, or `undefined` before a step begins. */
  currentRunStepSnapshot() {
    markAssistantStreamValueExternallyMutable(__classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f"));
    return __classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
  }
  /** Waits for successful completion and returns the final snapshot of every observed run step. */
  async finalRunSteps() {
    await this.done();
    return Object.values(__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
  }
  /** Waits for successful completion and returns the final snapshot of every observed message. */
  async finalMessages() {
    await this.done();
    return Object.values(__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
  }
  /** Waits for completion and returns the final run, or rejects if no terminal run was received. */
  async finalRun() {
    await this.done();
    if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f")) {
      throw new Error("Final run was not received.");
    }
    return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
  }
  async _createThreadAssistantStream(thread, params, options) {
    this._listenForAbort(options?.signal);
    const body = { ...params, stream: true };
    const stream2 = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  async _createAssistantStream(run2, threadId, params, options) {
    this._listenForAbort(options?.signal);
    const body = { ...params, stream: true };
    const stream2 = await run2.create(threadId, body, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  /**
   * Applies an assistant delta to its mutable snapshot, concatenating text and
   * merging nested objects and indexed array entries.
   */
  static accumulateDelta(acc, delta) {
    return accumulateAssistantStreamDelta(acc, delta);
  }
  _addRun(run2) {
    __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "run", run2);
    return run2;
  }
  async _threadAssistantStream(params, thread, options) {
    return await this._createThreadAssistantStream(thread, params, options);
  }
  async _runAssistantStream(threadId, runs, params, options) {
    return await this._createAssistantStream(runs, threadId, params, options);
  }
  async _runToolAssistantStream(runId, runs, params, options) {
    return await this._createToolAssistantStream(runs, runId, params, options);
  }
};
_AssistantStream_addEvent = function _AssistantStream_addEvent2(event) {
  if (this.ended) {
    return;
  }
  __classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
  __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
  switch (event.event) {
    case "thread.created": {
      break;
    }
    case "thread.run.created":
    case "thread.run.queued":
    case "thread.run.in_progress":
    case "thread.run.requires_action":
    case "thread.run.completed":
    case "thread.run.incomplete":
    case "thread.run.failed":
    case "thread.run.cancelling":
    case "thread.run.cancelled":
    case "thread.run.expired": {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
      break;
    }
    case "thread.run.step.created":
    case "thread.run.step.in_progress":
    case "thread.run.step.delta":
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired": {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
      break;
    }
    case "thread.message.created":
    case "thread.message.in_progress":
    case "thread.message.delta":
    case "thread.message.completed":
    case "thread.message.incomplete": {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
      break;
    }
    case "error": {
      throw new Error("Encountered an error event in event processing - errors should be processed earlier");
    }
    default: {
      assertNever2(event);
    }
  }
}, _AssistantStream_endRequest = function _AssistantStream_endRequest2() {
  if (this.ended) {
    throw new OpenAIError(`stream has ended, this shouldn't happen`);
  }
  if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f")) {
    throw new Error("Final run has not been received");
  }
  return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
}, _AssistantStream_handleMessage = function _AssistantStream_handleMessage2(event) {
  const [accumulatedMessage, newContent] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
  __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
  __classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
  for (const content of newContent) {
    const snapshotContent = accumulatedMessage.content[content.index];
    if (snapshotContent?.type === "text") {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "textCreated", snapshotContent.text);
    }
  }
  switch (event.event) {
    case "thread.message.created": {
      __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_currentContent, void 0, "f");
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "messageCreated", event.data);
      break;
    }
    case "thread.message.in_progress": {
      break;
    }
    case "thread.message.delta": {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "messageDelta", event.data.delta, accumulatedMessage);
      if (event.data.delta.content) {
        for (const content of event.data.delta.content) {
          if (content.type === "text" && content.text) {
            const textDelta = content.text;
            const snapshot = accumulatedMessage.content[content.index];
            if (snapshot && snapshot.type === "text") {
              __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "textDelta", textDelta, snapshot.text);
            } else {
              throw new Error("The snapshot associated with this text delta is not text or missing");
            }
          }
          if (content.index !== __classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
            if (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
              switch (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type) {
                case "text": {
                  __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "textDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                  break;
                }
                case "image_file": {
                  __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "imageFileDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                  break;
                }
              }
            }
            __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
          }
          __classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
        }
      }
      break;
    }
    case "thread.message.completed":
    case "thread.message.incomplete": {
      if (__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== void 0) {
        const currentContent = event.data.content[__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
        if (currentContent) {
          switch (currentContent.type) {
            case "image_file": {
              __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "imageFileDone", currentContent.image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
              break;
            }
            case "text": {
              __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "textDone", currentContent.text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
              break;
            }
          }
        }
      }
      if (__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "messageDone", event.data);
      }
      __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_currentContent, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, void 0, "f");
    }
  }
}, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep2(event) {
  const accumulatedRunStep = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
  __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
  switch (event.event) {
    case "thread.run.step.created": {
      __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_currentToolCall, void 0, "f");
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "runStepCreated", event.data);
      break;
    }
    case "thread.run.step.delta": {
      const delta = event.data.delta;
      if (delta.step_details && delta.step_details.type === "tool_calls" && delta.step_details.tool_calls && accumulatedRunStep.step_details.type === "tool_calls") {
        for (const toolCall of delta.step_details.tool_calls) {
          if (toolCall.index === __classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "toolCallDelta", toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
          } else {
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
              __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
            }
            __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
            __classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
              __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "toolCallCreated", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
            }
          }
        }
      }
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "runStepDelta", event.data.delta, accumulatedRunStep);
      break;
    }
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired": {
      __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, void 0, "f");
      const details = event.data.step_details;
      if (details.type === "tool_calls" && __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
      }
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "runStepDone", event.data, accumulatedRunStep);
      __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_currentToolCall, void 0, "f");
      break;
    }
    case "thread.run.step.in_progress": {
      break;
    }
  }
}, _AssistantStream_emitExposed = function _AssistantStream_emitExposed2(event, ...args) {
  if (this._hasListeners(event)) {
    for (const value of args) {
      markAssistantStreamValueExternallyMutable(value);
    }
  }
  this._emit(event, ...args);
}, _AssistantStream_handleEvent = function _AssistantStream_handleEvent2(event) {
  __classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
  __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "event", event);
}, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep2(event) {
  switch (event.event) {
    case "thread.run.step.created": {
      __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      return event.data;
    }
    case "thread.run.step.delta": {
      const snapshot = __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
      if (!snapshot) {
        throw new Error("Received a RunStepDelta before creation of a snapshot");
      }
      const data = event.data;
      if (data.delta) {
        const accumulated = accumulateAssistantStreamDelta(snapshot, data.delta, true);
        __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
      }
      return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    }
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
    case "thread.run.step.in_progress": {
      __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      break;
    }
  }
  if (__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id]) {
    return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
  }
  throw new Error("No snapshot available");
}, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage2(event, snapshot) {
  const newContent = [];
  switch (event.event) {
    case "thread.message.created": {
      return [event.data, newContent];
    }
    case "thread.message.delta": {
      if (!snapshot) {
        throw new Error("Received a delta with no existing snapshot (there should be one from message creation)");
      }
      const data = event.data;
      if (data.delta.content) {
        assertSafeAssistantStreamDelta(data.delta);
        const cacheArrays = !isAssistantStreamValueExternallyMutable(snapshot);
        const commitProjection = createAssistantStreamArrayDeltaCommit(snapshot.content, data.delta.content, "content", cacheArrays);
        for (const contentElement of data.delta.content) {
          if (hasOwn(snapshot.content, contentElement.index)) {
            const currentContent = snapshot.content[contentElement.index];
            snapshot.content[contentElement.index] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent, cacheArrays);
          } else {
            defineAssistantStreamArrayEntry(snapshot.content, contentElement.index, contentElement);
            newContent.push(contentElement);
          }
        }
        commitProjection();
      }
      return [snapshot, newContent];
    }
    case "thread.message.in_progress":
    case "thread.message.completed":
    case "thread.message.incomplete": {
      if (snapshot) {
        return [snapshot, newContent];
      }
      throw new Error("Received thread message event with no existing snapshot");
    }
  }
  throw new Error("Tried to accumulate a non-message event");
}, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent2(contentElement, currentContent, cacheArrays) {
  return accumulateAssistantStreamDelta(currentContent, contentElement, cacheArrays);
}, _AssistantStream_handleRun = function _AssistantStream_handleRun2(event) {
  __classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
  switch (event.event) {
    case "thread.run.created": {
      break;
    }
    case "thread.run.queued": {
      break;
    }
    case "thread.run.in_progress": {
      break;
    }
    case "thread.run.requires_action":
    case "thread.run.cancelled":
    case "thread.run.failed":
    case "thread.run.completed":
    case "thread.run.expired":
    case "thread.run.incomplete": {
      __classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
      if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_emitExposed).call(this, "toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
      }
      __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, void 0, "f");
      __classPrivateFieldSet(this, _AssistantStream_currentToolCall, void 0, "f");
      break;
    }
    case "thread.run.cancelling": {
      break;
    }
  }
};
function assertNever2(_x) {
  return _x;
}

// node_modules/openai/resources/beta/threads/runs/runs.mjs
var Runs = class extends APIResource {
  constructor() {
    super(...arguments);
    this.steps = new Steps(this._client);
  }
  create(threadID, params, options) {
    const { include, ...body } = params;
    return this._client.post(path`/threads/${threadID}/runs`, {
      query: { include },
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      stream: params.stream ?? false,
      __synthesizeEventData: true,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(runID, params, options) {
    const { thread_id } = params;
    return this._client.get(path`/threads/${thread_id}/runs/${runID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modifies a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(runID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path`/threads/${thread_id}/runs/${runID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of runs belonging to a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(threadID, query = {}, options) {
    return this._client.getAPIList(path`/threads/${threadID}/runs`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancels a run that is `in_progress`.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  cancel(runID, params, options) {
    const { thread_id } = params;
    return this._client.post(path`/threads/${thread_id}/runs/${runID}/cancel`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * A helper to create a run an poll for a terminal state. More information on Run
   * lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndPoll(threadId, body, options) {
    const run2 = await this.create(threadId, body, options);
    return await this.poll(run2.id, { thread_id: threadId }, options);
  }
  /**
   * Create a Run stream
   *
   * @deprecated use `stream` instead
   */
  createAndStream(threadId, body, options) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
  }
  /**
   * A helper to poll a run status until it reaches a terminal state. More
   * information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async poll(runId, params, options) {
    const headers = buildHeaders([
      options?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    while (true) {
      const { data: run2, response } = await this.retrieve(runId, params, {
        ...options,
        headers: { ...options?.headers, ...headers }
      }).withResponse();
      switch (run2.status) {
        //If we are in any sort of intermediate state we poll
        case "queued":
        case "in_progress":
        case "cancelling":
          let sleepInterval = 5e3;
          if (options?.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        //We return the run in any terminal state.
        case "requires_action":
        case "incomplete":
        case "cancelled":
        case "completed":
        case "failed":
        case "expired":
          return run2;
      }
    }
  }
  /**
   * Create a Run stream
   */
  stream(threadId, body, options) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
  }
  submitToolOutputs(runID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path`/threads/${thread_id}/runs/${runID}/submit_tool_outputs`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      stream: params.stream ?? false,
      __synthesizeEventData: true,
      __security: { bearerAuth: true }
    });
  }
  /**
   * A helper to submit a tool output to a run and poll for a terminal run state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async submitToolOutputsAndPoll(runId, params, options) {
    const run2 = await this.submitToolOutputs(runId, params, options);
    return await this.poll(run2.id, params, options);
  }
  /**
   * Submit the tool outputs from a previous run and stream the run to a terminal
   * state. More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  submitToolOutputsStream(runId, params, options) {
    return AssistantStream.createToolAssistantStream(runId, this._client.beta.threads.runs, params, options);
  }
};
Runs.Steps = Steps;

// node_modules/openai/resources/beta/threads/threads.mjs
var Threads2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.runs = new Runs(this._client);
    this.messages = new Messages2(this._client);
  }
  /**
   * Create a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(body = {}, options) {
    return this._client.post("/threads", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(threadID, options) {
    return this._client.get(path`/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modifies a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(threadID, body, options) {
    return this._client.post(path`/threads/${threadID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(threadID, options) {
    return this._client.delete(path`/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  createAndRun(body, options) {
    return this._client.post("/threads/runs", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      stream: body.stream ?? false,
      __synthesizeEventData: true,
      __security: { bearerAuth: true }
    });
  }
  /**
   * A helper to create a thread, start a run and then poll for a terminal state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndRunPoll(body, options) {
    const run2 = await this.createAndRun(body, options);
    return await this.runs.poll(run2.id, { thread_id: run2.thread_id }, options);
  }
  /**
   * Create a thread and stream the run back
   */
  createAndRunStream(body, options) {
    return AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
  }
};
Threads2.Runs = Runs;
Threads2.Messages = Messages2;

// node_modules/openai/resources/beta/beta.mjs
var Beta = class extends APIResource {
  constructor() {
    super(...arguments);
    this.realtime = new Realtime(this._client);
    this.responses = new Responses(this._client);
    this.chatkit = new ChatKit(this._client);
    this.assistants = new Assistants(this._client);
    this.threads = new Threads2(this._client);
  }
};
Beta.Realtime = Realtime;
Beta.Responses = Responses;
Beta.ChatKit = ChatKit;
Beta.Assistants = Assistants;
Beta.Threads = Threads2;

// node_modules/openai/resources/completions.mjs
var Completions2 = class extends APIResource {
  create(body, options) {
    return this._client.post("/completions", {
      body,
      ...options,
      stream: body.stream ?? false,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/containers/files/content.mjs
var Content = class extends APIResource {
  /**
   * Retrieve Container File Content
   */
  retrieve(fileID, params, options) {
    const { container_id } = params;
    return this._client.get(path`/containers/${container_id}/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/containers/files/files.mjs
var Files = class extends APIResource {
  constructor() {
    super(...arguments);
    this.content = new Content(this._client);
  }
  /**
   * Create a Container File
   *
   * You can send either a multipart/form-data request with the raw file content, or
   * a JSON request with a file ID.
   */
  create(containerID, body, options) {
    return this._client.post(path`/containers/${containerID}/files`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Retrieve Container File
   */
  retrieve(fileID, params, options) {
    const { container_id } = params;
    return this._client.get(path`/containers/${container_id}/files/${fileID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List Container files
   */
  list(containerID, query = {}, options) {
    return this._client.getAPIList(path`/containers/${containerID}/files`, CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete Container File
   */
  delete(fileID, params, options) {
    const { container_id } = params;
    return this._client.delete(path`/containers/${container_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};
Files.Content = Content;

// node_modules/openai/resources/containers/containers.mjs
var Containers = class extends APIResource {
  constructor() {
    super(...arguments);
    this.files = new Files(this._client);
  }
  /**
   * Create Container
   */
  create(body, options) {
    return this._client.post("/containers", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Retrieve Container
   */
  retrieve(containerID, options) {
    return this._client.get(path`/containers/${containerID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List Containers
   */
  list(query = {}, options) {
    return this._client.getAPIList("/containers", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete Container
   */
  delete(containerID, options) {
    return this._client.delete(path`/containers/${containerID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};
Containers.Files = Files;

// node_modules/openai/resources/content-provenance-checks.mjs
var ContentProvenanceChecks = class extends APIResource {
  /**
   * Check whether an image or audio file contains known OpenAI provenance signals.
   * [Learn more about content provenance](/api/docs/guides/content-provenance).
   *
   * If `not_detected`, it means the tool did not find supported signals in the
   * uploaded file. The content could still have been generated by OpenAI if the
   * metadata was stripped or has evidence of tampering, the watermark was degraded,
   * it comes from a legacy generation model, or it was created before provenance
   * signals were available. Content could also still be AI-generated by another
   * company's model, which the tool currently does not detect.
   */
  create(body, options) {
    return this._client.post("/content_provenance_checks", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
};

// node_modules/openai/resources/conversations/items.mjs
var Items = class extends APIResource {
  /**
   * Create items in a conversation with the given ID.
   */
  create(conversationID, params, options) {
    const { include, ...body } = params;
    return this._client.post(path`/conversations/${conversationID}/items`, {
      query: { include },
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get a single item from a conversation with the given IDs.
   */
  retrieve(itemID, params, options) {
    const { conversation_id, ...query } = params;
    return this._client.get(path`/conversations/${conversation_id}/items/${itemID}`, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List all items for a conversation with the given ID.
   */
  list(conversationID, query = {}, options) {
    return this._client.getAPIList(path`/conversations/${conversationID}/items`, ConversationCursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Delete an item from a conversation with the given IDs.
   */
  delete(itemID, params, options) {
    const { conversation_id } = params;
    return this._client.delete(path`/conversations/${conversation_id}/items/${itemID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/conversations/conversations.mjs
var Conversations = class extends APIResource {
  constructor() {
    super(...arguments);
    this.items = new Items(this._client);
  }
  /**
   * Create a conversation.
   */
  create(body = {}, options) {
    return this._client.post("/conversations", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Get a conversation
   */
  retrieve(conversationID, options) {
    return this._client.get(path`/conversations/${conversationID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Update a conversation
   */
  update(conversationID, body, options) {
    return this._client.post(path`/conversations/${conversationID}`, {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a conversation. Items in the conversation will not be deleted.
   */
  delete(conversationID, options) {
    return this._client.delete(path`/conversations/${conversationID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};
Conversations.Items = Items;

// node_modules/openai/resources/embeddings.mjs
var Embeddings = class extends APIResource {
  create(body, options) {
    const hasUserProvidedEncodingFormat = !!body.encoding_format;
    let encoding_format = hasUserProvidedEncodingFormat ? body.encoding_format : "base64";
    if (hasUserProvidedEncodingFormat) {
      loggerFor(this._client).debug("embeddings/user defined encoding_format:", body.encoding_format);
    }
    const response = this._client.post("/embeddings", {
      body: {
        ...body,
        encoding_format
      },
      ...options,
      __security: { bearerAuth: true }
    });
    if (hasUserProvidedEncodingFormat) {
      return response;
    }
    loggerFor(this._client).debug("embeddings/decoding base64 embeddings from base64");
    return response._thenUnwrap((response2) => {
      if (response2 && response2.data) {
        response2.data.forEach((embeddingBase64Obj) => {
          const embeddingBase64Str = embeddingBase64Obj.embedding;
          embeddingBase64Obj.embedding = toFloat32Array(embeddingBase64Str);
        });
      }
      return response2;
    });
  }
};

// node_modules/openai/resources/evals/runs/output-items.mjs
var OutputItems = class extends APIResource {
  /**
   * Get an evaluation run output item by ID.
   */
  retrieve(outputItemID, params, options) {
    const { eval_id, run_id } = params;
    return this._client.get(path`/evals/${eval_id}/runs/${run_id}/output_items/${outputItemID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get a list of output items for an evaluation run.
   */
  list(runID, params, options) {
    const { eval_id, ...query } = params;
    return this._client.getAPIList(path`/evals/${eval_id}/runs/${runID}/output_items`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/resources/evals/runs/runs.mjs
var Runs2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.outputItems = new OutputItems(this._client);
  }
  /**
   * Kicks off a new run for a given evaluation, specifying the data source, and what
   * model configuration to use to test. The datasource will be validated against the
   * schema specified in the config of the evaluation.
   */
  create(evalID, body, options) {
    return this._client.post(path`/evals/${evalID}/runs`, {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get an evaluation run by ID.
   */
  retrieve(runID, params, options) {
    const { eval_id } = params;
    return this._client.get(path`/evals/${eval_id}/runs/${runID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get a list of runs for an evaluation.
   */
  list(evalID, query = {}, options) {
    return this._client.getAPIList(path`/evals/${evalID}/runs`, CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete an eval run.
   */
  delete(runID, params, options) {
    const { eval_id } = params;
    return this._client.delete(path`/evals/${eval_id}/runs/${runID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancel an ongoing evaluation run.
   */
  cancel(runID, params, options) {
    const { eval_id } = params;
    return this._client.post(path`/evals/${eval_id}/runs/${runID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};
Runs2.OutputItems = OutputItems;

// node_modules/openai/resources/evals/evals.mjs
var Evals = class extends APIResource {
  constructor() {
    super(...arguments);
    this.runs = new Runs2(this._client);
  }
  /**
   * Create the structure of an evaluation that can be used to test a model's
   * performance. An evaluation is a set of testing criteria and the config for a
   * data source, which dictates the schema of the data used in the evaluation. After
   * creating an evaluation, you can run it on different models and model parameters.
   * We support several types of graders and datasources. For more information, see
   * the [Evals guide](https://platform.openai.com/docs/guides/evals).
   */
  create(body, options) {
    return this._client.post("/evals", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Get an evaluation by ID.
   */
  retrieve(evalID, options) {
    return this._client.get(path`/evals/${evalID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Update certain properties of an evaluation.
   */
  update(evalID, body, options) {
    return this._client.post(path`/evals/${evalID}`, { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * List evaluations for a project.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/evals", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete an evaluation.
   */
  delete(evalID, options) {
    return this._client.delete(path`/evals/${evalID}`, { ...options, __security: { bearerAuth: true } });
  }
};
Evals.Runs = Runs2;

// node_modules/openai/resources/files.mjs
var Files2 = class extends APIResource {
  /**
   * Upload a file that can be used across various endpoints. Individual files can be
   * up to 512 MB, and each project can store up to 2.5 TB of files in total. There
   * is no organization-wide storage limit. Uploads to this endpoint are rate-limited
   * to 1,000 requests per minute per authenticated user.
   *
   * - The Assistants API supports files up to 2 million tokens and of specific file
   *   types. See the
   *   [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools)
   *   for details.
   * - The Fine-tuning API only supports `.jsonl` files. The input also has certain
   *   required formats for fine-tuning
   *   [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input)
   *   or
   *   [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
   *   models.
   * - The Batch API only supports `.jsonl` files up to 200 MB in size. The input
   *   also has a specific required
   *   [format](https://platform.openai.com/docs/api-reference/batch/request-input).
   * - For Retrieval or `file_search` ingestion, upload files here first. If you need
   *   to attach multiple uploaded files to the same vector store, use
   *   [`/vector_stores/{vector_store_id}/file_batches`](https://platform.openai.com/docs/api-reference/vector-stores-file-batches/createBatch)
   *   instead of attaching them one by one. Vector store attachment has separate
   *   limits from file upload, including 2,000 attached files per minute per
   *   organization.
   *
   * Please [contact us](https://help.openai.com/) if you need to increase these
   * storage limits.
   */
  create(body, options) {
    return this._client.post("/files", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Returns information about a specific file.
   */
  retrieve(fileID, options) {
    return this._client.get(path`/files/${fileID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Returns a list of files.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/files", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a file and remove it from all vector stores.
   */
  delete(fileID, options) {
    return this._client.delete(path`/files/${fileID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Returns a response containing the contents of the specified file.
   */
  content(fileID, options) {
    return this._client.get(path`/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
  /**
   * Waits for the given file to be processed, default timeout is 30 mins.
   */
  async waitForProcessing(id, { pollInterval = 5e3, maxWait = 30 * 60 * 1e3 } = {}) {
    const TERMINAL_STATES = /* @__PURE__ */ new Set(["processed", "error", "deleted"]);
    const start = Date.now();
    let file = await this.retrieve(id);
    while (!file.status || !TERMINAL_STATES.has(file.status)) {
      await sleep(pollInterval);
      file = await this.retrieve(id);
      if (Date.now() - start > maxWait) {
        throw new APIConnectionTimeoutError({
          message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`
        });
      }
    }
    return file;
  }
};

// node_modules/openai/resources/fine-tuning/methods.mjs
var Methods = class extends APIResource {
};

// node_modules/openai/resources/fine-tuning/alpha/graders.mjs
var Graders = class extends APIResource {
  /**
   * Run a grader.
   *
   * @example
   * ```ts
   * const response = await client.fineTuning.alpha.graders.run({
   *   grader: {
   *     input: 'input',
   *     name: 'name',
   *     operation: 'eq',
   *     reference: 'reference',
   *     type: 'string_check',
   *   },
   *   model_sample: 'model_sample',
   * });
   * ```
   */
  run(body, options) {
    return this._client.post("/fine_tuning/alpha/graders/run", {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Validate a grader.
   *
   * @example
   * ```ts
   * const response =
   *   await client.fineTuning.alpha.graders.validate({
   *     grader: {
   *       input: 'input',
   *       name: 'name',
   *       operation: 'eq',
   *       reference: 'reference',
   *       type: 'string_check',
   *     },
   *   });
   * ```
   */
  validate(body, options) {
    return this._client.post("/fine_tuning/alpha/graders/validate", {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/fine-tuning/alpha/alpha.mjs
var Alpha = class extends APIResource {
  constructor() {
    super(...arguments);
    this.graders = new Graders(this._client);
  }
};
Alpha.Graders = Graders;

// node_modules/openai/resources/fine-tuning/checkpoints/permissions.mjs
var Permissions = class extends APIResource {
  /**
   * **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys).
   *
   * This enables organization owners to share fine-tuned models with other projects
   * in their organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionCreateResponse of client.fineTuning.checkpoints.permissions.create(
   *   'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *   { project_ids: ['string'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(fineTunedModelCheckpoint, body, options) {
    return this._client.getAPIList(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to view all permissions for a
   * fine-tuned model checkpoint.
   *
   * @deprecated Retrieve is deprecated. Please swap to the paginated list method instead.
   */
  retrieve(fineTunedModelCheckpoint, query = {}, options) {
    return this._client.get(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, {
      query,
      ...options,
      __security: { adminAPIKeyAuth: true }
    });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to view all permissions for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionListResponse of client.fineTuning.checkpoints.permissions.list(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(fineTunedModelCheckpoint, query = {}, options) {
    return this._client.getAPIList(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to delete a permission for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * const permission =
   *   await client.fineTuning.checkpoints.permissions.delete(
   *     'cp_zc4Q7MP6XxulcVzj4MZdwsAB',
   *     {
   *       fine_tuned_model_checkpoint:
   *         'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *     },
   *   );
   * ```
   */
  delete(permissionID, params, options) {
    const { fine_tuned_model_checkpoint } = params;
    return this._client.delete(path`/fine_tuning/checkpoints/${fine_tuned_model_checkpoint}/permissions/${permissionID}`, { ...options, __security: { adminAPIKeyAuth: true } });
  }
};

// node_modules/openai/resources/fine-tuning/checkpoints/checkpoints.mjs
var Checkpoints = class extends APIResource {
  constructor() {
    super(...arguments);
    this.permissions = new Permissions(this._client);
  }
};
Checkpoints.Permissions = Permissions;

// node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs
var Checkpoints2 = class extends APIResource {
  /**
   * List checkpoints for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobCheckpoint of client.fineTuning.jobs.checkpoints.list(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(fineTuningJobID, query = {}, options) {
    return this._client.getAPIList(path`/fine_tuning/jobs/${fineTuningJobID}/checkpoints`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/resources/fine-tuning/jobs/jobs.mjs
var Jobs = class extends APIResource {
  constructor() {
    super(...arguments);
    this.checkpoints = new Checkpoints2(this._client);
  }
  /**
   * Creates a fine-tuning job which begins the process of creating a new model from
   * a given dataset.
   *
   * Response includes details of the enqueued job including job status and the name
   * of the fine-tuned models once complete.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.create({
   *   model: 'gpt-4o-mini',
   *   training_file: 'file-abc123',
   * });
   * ```
   */
  create(body, options) {
    return this._client.post("/fine_tuning/jobs", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Get info about a fine-tuning job.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.retrieve(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  retrieve(fineTuningJobID, options) {
    return this._client.get(path`/fine_tuning/jobs/${fineTuningJobID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List your organization's fine-tuning jobs
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJob of client.fineTuning.jobs.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/fine_tuning/jobs", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Immediately cancel a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.cancel(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  cancel(fineTuningJobID, options) {
    return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/cancel`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Get status updates for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobEvent of client.fineTuning.jobs.listEvents(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  listEvents(fineTuningJobID, query = {}, options) {
    return this._client.getAPIList(path`/fine_tuning/jobs/${fineTuningJobID}/events`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Pause a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.pause(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  pause(fineTuningJobID, options) {
    return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/pause`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Resume a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.resume(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  resume(fineTuningJobID, options) {
    return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/resume`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};
Jobs.Checkpoints = Checkpoints2;

// node_modules/openai/resources/fine-tuning/fine-tuning.mjs
var FineTuning = class extends APIResource {
  constructor() {
    super(...arguments);
    this.methods = new Methods(this._client);
    this.jobs = new Jobs(this._client);
    this.checkpoints = new Checkpoints(this._client);
    this.alpha = new Alpha(this._client);
  }
};
FineTuning.Methods = Methods;
FineTuning.Jobs = Jobs;
FineTuning.Checkpoints = Checkpoints;
FineTuning.Alpha = Alpha;

// node_modules/openai/resources/graders/grader-models.mjs
var GraderModels = class extends APIResource {
};

// node_modules/openai/resources/graders/graders.mjs
var Graders2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.graderModels = new GraderModels(this._client);
  }
};
Graders2.GraderModels = GraderModels;

// node_modules/openai/resources/images.mjs
var Images = class extends APIResource {
  /**
   * Creates a variation of a given image. This endpoint only supports `dall-e-2`.
   *
   * @example
   * ```ts
   * const imagesResponse = await client.images.createVariation({
   *   image: fs.createReadStream('otter.png'),
   * });
   * ```
   */
  createVariation(body, options) {
    return this._client.post("/images/variations", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  edit(body, options) {
    return this._client.post("/images/edits", multipartFormRequestOptions({
      body,
      ...options,
      stream: body.stream ?? false,
      __metadata: { ...options?.__metadata, ...body.model == null ? {} : { model: body.model } },
      __security: { bearerAuth: true }
    }, this._client));
  }
  generate(body, options) {
    return this._client.post("/images/generations", {
      body,
      ...options,
      stream: body.stream ?? false,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/models.mjs
var Models = class extends APIResource {
  /**
   * Retrieves a model instance, providing basic information about the model such as
   * the owner and permissioning.
   */
  retrieve(model, options) {
    return this._client.get(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Lists the currently available models, and provides basic information about each
   * one such as the owner and availability.
   */
  list(options) {
    return this._client.getAPIList("/models", Page, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Delete a fine-tuned model. You must have the Owner role in your organization to
   * delete a model.
   */
  delete(model, options) {
    return this._client.delete(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/resources/moderations.mjs
var Moderations = class extends APIResource {
  /**
   * Classifies if text and/or image inputs are potentially harmful. Learn more in
   * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
   */
  create(body, options) {
    return this._client.post("/moderations", { body, ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/resources/realtime/calls.mjs
var Calls = class extends APIResource {
  /**
   * Accept an incoming SIP call and configure the realtime session that will handle
   * it.
   *
   * @example
   * ```ts
   * await client.realtime.calls.accept('call_id', {
   *   type: 'realtime',
   * });
   * ```
   */
  accept(callID, body, options) {
    return this._client.post(path`/realtime/calls/${callID}/accept`, {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * End an active Realtime API call, whether it was initiated over SIP or WebRTC.
   *
   * @example
   * ```ts
   * await client.realtime.calls.hangup('call_id');
   * ```
   */
  hangup(callID, options) {
    return this._client.post(path`/realtime/calls/${callID}/hangup`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Transfer an active SIP call to a new destination using the SIP REFER verb.
   *
   * @example
   * ```ts
   * await client.realtime.calls.refer('call_id', {
   *   target_uri: 'tel:+14155550123',
   * });
   * ```
   */
  refer(callID, body, options) {
    return this._client.post(path`/realtime/calls/${callID}/refer`, {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Decline an incoming SIP call by returning a SIP status code to the caller.
   *
   * @example
   * ```ts
   * await client.realtime.calls.reject('call_id');
   * ```
   */
  reject(callID, body = {}, options) {
    return this._client.post(path`/realtime/calls/${callID}/reject`, {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/realtime/client-secrets.mjs
var ClientSecrets = class extends APIResource {
  /**
   * Create a Realtime client secret with an associated session configuration.
   *
   * Client secrets are short-lived tokens that can be passed to a client app, such
   * as a web frontend or mobile client, which grants access to the Realtime API
   * without leaking your main API key. You can configure a custom TTL for each
   * client secret.
   *
   * You can also attach session configuration options to the client secret, which
   * will be applied to any sessions created using that client secret, but these can
   * also be overridden by the client connection.
   *
   * [Learn more about authentication with client secrets over WebRTC](https://platform.openai.com/docs/guides/realtime-webrtc).
   *
   * Returns the created client secret and the effective session object. The client
   * secret is a string that looks like `ek_1234`.
   *
   * @example
   * ```ts
   * const clientSecret =
   *   await client.realtime.clientSecrets.create();
   * ```
   */
  create(body, options) {
    return this._client.post("/realtime/client_secrets", {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/realtime/realtime.mjs
var Realtime2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.clientSecrets = new ClientSecrets(this._client);
    this.calls = new Calls(this._client);
  }
};
Realtime2.ClientSecrets = ClientSecrets;
Realtime2.Calls = Calls;

// node_modules/openai/lib/ResponsesParser.mjs
function maybeParseResponse(response, params) {
  if (!params || !hasAutoParseableInput2(params)) {
    const parsed = {
      ...response,
      output_parsed: null,
      output: response.output.map((item) => {
        if (item.type === "function_call") {
          return {
            ...item,
            parsed_arguments: null
          };
        }
        if (item.type === "message") {
          return {
            ...item,
            content: item.content.map((content) => ({
              ...content,
              parsed: null
            }))
          };
        }
        return item;
      })
    };
    if (needsOutputText(response, parsed)) {
      addOutputText(parsed);
    }
    return parsed;
  }
  return parseResponse(response, params);
}
function parseResponse(response, params) {
  const shouldParse = !response.status || response.status === "completed";
  const output = response.output.map((item) => {
    if (item.type === "function_call") {
      return shouldParse ? parseToolCall2(params, item) : { ...item, parsed_arguments: null };
    }
    if (item.type === "message") {
      const content = item.content.map((content2) => {
        if (content2.type === "output_text") {
          return {
            ...content2,
            parsed: shouldParse ? parseTextFormat(params, content2.text) : null
          };
        }
        return content2;
      });
      return {
        ...item,
        content
      };
    }
    return item;
  });
  const parsed = { ...response, output };
  if (needsOutputText(response, parsed)) {
    addOutputText(parsed);
  }
  Object.defineProperty(parsed, "output_parsed", {
    enumerable: true,
    get() {
      for (const output2 of parsed.output) {
        if (output2.type !== "message") {
          continue;
        }
        for (const content of output2.content) {
          if (content.type === "output_text" && content.parsed !== null) {
            return content.parsed;
          }
        }
      }
      return null;
    }
  });
  return parsed;
}
function parseTextFormat(params, content) {
  return parseResponseFormatContent(params.text?.format, content);
}
function hasAutoParseableInput2(params) {
  if (isParseableResponseFormat(params.text?.format)) {
    return true;
  }
  return Array.isArray(params.tools) && params.tools.some((tool) => isAutoParsableTool2(tool) || tool.type === "function" && tool.strict === true);
}
function isAutoParsableTool2(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
function getInputToolByName(input_tools, name) {
  return input_tools.find((tool) => tool.type === "function" && tool.name === name);
}
function parseToolCall2(params, toolCall) {
  const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
  let parsedArguments = null;
  if (isAutoParsableTool2(inputTool)) {
    parsedArguments = inputTool.$parseRaw(toolCall.arguments);
  } else if (inputTool?.strict) {
    parsedArguments = JSON.parse(toolCall.arguments);
  }
  return {
    ...toolCall,
    parsed_arguments: parsedArguments
  };
}
function needsOutputText(response, target) {
  return !Object.getOwnPropertyDescriptor(response, "output_text") || target.output_text == null;
}
function addOutputText(rsp) {
  const texts = [];
  for (const output of rsp.output) {
    if (output.type !== "message") {
      continue;
    }
    for (const content of output.content) {
      if (content.type === "output_text") {
        texts.push(content.text);
      }
    }
  }
  rsp.output_text = texts.join("");
}

// node_modules/openai/internal/responses/output-text-index.mjs
var OutputTextIndex = class {
  constructor() {
    this.capacity = 1;
    this.values = [0, 0];
    this.size = 0;
  }
  get length() {
    return this.size;
  }
  append(value) {
    if (this.size === this.capacity) {
      this.grow();
    }
    const index = this.size;
    this.size += 1;
    this.update(index, value);
  }
  update(index, value) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`missing output at index ${index}`);
    }
    let node = this.capacity + index;
    const difference = value - (this.values[node] ?? 0);
    if (difference === 0) {
      return;
    }
    while (node >= 1) {
      this.values[node] = (this.values[node] ?? 0) + difference;
      node = Math.floor(node / 2);
    }
  }
  prefixSum(end) {
    if (!Number.isSafeInteger(end) || end < 0 || end > this.size) {
      throw new RangeError(`missing output at index ${end}`);
    }
    let start = this.capacity;
    let stop = this.capacity + end;
    let sum = 0;
    while (start < stop) {
      if (start % 2 === 1) {
        sum += this.values[start] ?? 0;
        start += 1;
      }
      if (stop % 2 === 1) {
        stop -= 1;
        sum += this.values[stop] ?? 0;
      }
      start = Math.floor(start / 2);
      stop = Math.floor(stop / 2);
    }
    return sum;
  }
  grow() {
    const previousCapacity = this.capacity;
    this.capacity *= 2;
    const values = Array.from({ length: this.capacity * 2 }, () => 0);
    for (let index = 0; index < this.size; index += 1) {
      values[this.capacity + index] = this.values[previousCapacity + index] ?? 0;
    }
    for (let index = this.capacity - 1; index > 0; index -= 1) {
      values[index] = (values[index * 2] ?? 0) + (values[index * 2 + 1] ?? 0);
    }
    this.values = values;
  }
};

// node_modules/openai/internal/responses/canonical-output-text.mjs
function createCanonicalResponseContext() {
  return {
    canonicalSnapshot: void 0,
    outputTextLengths: /* @__PURE__ */ new WeakMap(),
    outputTextIndex: new OutputTextIndex()
  };
}
function getOutputText(context, output) {
  if (output.type !== "message") {
    return "";
  }
  let text = "";
  for (const content of output.content) {
    if (content.type === "output_text") {
      text += content.text;
    }
  }
  context.outputTextLengths.set(output, text.length);
  return text;
}
function ensureCanonicalOutputText(context, snapshot) {
  if (context.canonicalSnapshot === snapshot) {
    return;
  }
  const outputTextIndex = new OutputTextIndex();
  let text = "";
  for (const output of snapshot.output) {
    const outputText = getOutputText(context, output);
    text += outputText;
    outputTextIndex.append(outputText.length);
  }
  if (snapshot.output_text !== text) {
    snapshot.output_text = text;
  }
  context.outputTextIndex = outputTextIndex;
  context.canonicalSnapshot = snapshot;
}
function cloneResponse(context, response) {
  context.canonicalSnapshot = void 0;
  context.outputTextLengths = /* @__PURE__ */ new WeakMap();
  context.outputTextIndex = new OutputTextIndex();
  const snapshot = structuredClone(response);
  if (!Object.getOwnPropertyDescriptor(snapshot, "output_text") || snapshot.output_text === null || snapshot.output_text === void 0) {
    ensureCanonicalOutputText(context, snapshot);
  } else if (snapshot.output.length === 0 && snapshot.output_text === "") {
    context.canonicalSnapshot = snapshot;
  }
  return snapshot;
}
function updateCachedOutputTextLength(context, output, outputIndex, previousText, nextText) {
  const length = context.outputTextLengths.get(output);
  if (length !== void 0) {
    const nextLength = length - previousText.length + nextText.length;
    context.outputTextLengths.set(output, nextLength);
    context.outputTextIndex.update(outputIndex, nextLength);
  }
}
function replaceOutputTextSuffix(snapshot, previousText, nextText) {
  if (previousText.length === 0) {
    snapshot.output_text += nextText;
    return;
  }
  snapshot.output_text = snapshot.output_text.slice(0, snapshot.output_text.length - previousText.length) + nextText;
}
function getPrecedingContentTextLength(context, output, contentIndex, nextText) {
  if (contentIndex === void 0 || output?.type !== "message") {
    return 0;
  }
  if (contentIndex < output.content.length - contentIndex - 1) {
    let precedingContentLength = 0;
    for (let index = 0; index < contentIndex; index += 1) {
      const precedingContent = output.content[index];
      if (precedingContent?.type === "output_text") {
        precedingContentLength += precedingContent.text.length;
      }
    }
    return precedingContentLength;
  }
  let followingContentLength = 0;
  for (let index = contentIndex + 1; index < output.content.length; index += 1) {
    const followingContent = output.content[index];
    if (followingContent?.type === "output_text") {
      followingContentLength += followingContent.text.length;
    }
  }
  const outputTextLength = context.outputTextLengths.get(output) ?? getOutputText(context, output).length;
  return outputTextLength - followingContentLength - nextText.length;
}
function updateOutputText(context, snapshot, outputIndex, previousText, nextText, contentIndex) {
  if (previousText === nextText) {
    return;
  }
  const output = snapshot.output[outputIndex];
  if (outputIndex === snapshot.output.length - 1 && (contentIndex === void 0 || output?.type === "message" && contentIndex === output.content.length - 1)) {
    replaceOutputTextSuffix(snapshot, previousText, nextText);
    return;
  }
  const precedingContentLength = getPrecedingContentTextLength(context, output, contentIndex, nextText);
  const offset = context.outputTextIndex.prefixSum(outputIndex) + precedingContentLength;
  if (offset + previousText.length === snapshot.output_text.length) {
    replaceOutputTextSuffix(snapshot, previousText, nextText);
    return;
  }
  snapshot.output_text = snapshot.output_text.slice(0, offset) + nextText + snapshot.output_text.slice(offset + previousText.length);
}

// node_modules/openai/internal/responses/response-accumulator.mjs
function validateArrayIndex(collection, index, kind, allowAppend = false) {
  if (!Number.isSafeInteger(index) || index < 0 || index > collection.length || (index === collection.length ? !allowAppend || index in collection : !hasOwn(collection, index))) {
    throw new OpenAIError(`missing ${kind} at index ${index}`);
  }
}
function validateArrayAppend(collection, index, kind) {
  if (index !== collection.length) {
    throw new OpenAIError(`missing ${kind} at index ${index}`);
  }
  validateArrayIndex(collection, index, kind, true);
}
function getOutput(snapshot, outputIndex) {
  validateArrayIndex(snapshot.output, outputIndex, "output");
  const output = snapshot.output[outputIndex];
  if (!output) {
    throw new OpenAIError(`missing output at index ${outputIndex}`);
  }
  return output;
}
function getContent(content, contentIndex) {
  validateArrayIndex(content, contentIndex, "content");
  const part = content[contentIndex];
  if (!part) {
    throw new OpenAIError(`missing content at index ${contentIndex}`);
  }
  return part;
}
function getShellOutputContent(snapshot, output, commandIndex) {
  const shellCall = snapshot.output.find((item) => item.type === "shell_call" && item.call_id === output.call_id);
  if (shellCall) {
    validateArrayIndex(shellCall.action.commands, commandIndex, "command");
  } else {
    validateArrayIndex(output.output, commandIndex, "content", true);
  }
  while (output.output.length <= commandIndex) {
    output.output.push({
      stdout: "",
      stderr: "",
      outcome: { type: "exit", exit_code: 0 }
    });
  }
  return getContent(output.output, commandIndex);
}
function assertNever3(value) {
  throw new OpenAIError(`Unhandled response stream event: ${JSON.stringify(value)}`);
}
function accumulateOutputItemEvent(event, snapshot, context) {
  switch (event.type) {
    case "response.output_item.added": {
      validateArrayAppend(snapshot.output, event.output_index, "output");
      const output = structuredClone(event.item);
      if (output.type === "message") {
        ensureCanonicalOutputText(context, snapshot);
      }
      snapshot.output.push(output);
      const text = getOutputText(context, output);
      if (context.canonicalSnapshot === snapshot) {
        context.outputTextIndex.append(text.length);
      }
      if (text) {
        snapshot.output_text += text;
      }
      return true;
    }
    case "response.output_item.done": {
      const output = getOutput(snapshot, event.output_index);
      const previousText = getOutputText(context, output);
      const replacement = structuredClone(event.item);
      if (output.type === "message" || replacement.type === "message") {
        ensureCanonicalOutputText(context, snapshot);
      }
      snapshot.output[event.output_index] = replacement;
      const nextText = getOutputText(context, replacement);
      if (context.canonicalSnapshot === snapshot) {
        context.outputTextIndex.update(event.output_index, nextText.length);
      }
      updateOutputText(context, snapshot, event.output_index, previousText, nextText);
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateContentPartAddedEvent(event, snapshot, context) {
  switch (event.type) {
    case "response.content_part.added": {
      const output = getOutput(snapshot, event.output_index);
      const { type } = output;
      const { part } = event;
      if (type === "message" && part.type !== "reasoning_text") {
        validateArrayAppend(output.content, event.content_index, "content");
        const content = structuredClone(part);
        if (content.type === "output_text") {
          ensureCanonicalOutputText(context, snapshot);
        }
        output.content.push(content);
        if (content.type === "output_text") {
          updateCachedOutputTextLength(context, output, event.output_index, "", content.text);
          updateOutputText(context, snapshot, event.output_index, "", content.text, event.content_index);
        }
      } else if (type === "reasoning" && part.type === "reasoning_text") {
        const content = output.content ?? [];
        validateArrayAppend(content, event.content_index, "content");
        if (!output.content) {
          output.content = content;
        }
        content.push(structuredClone(part));
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateContentPartDoneEvent(event, snapshot, context) {
  switch (event.type) {
    case "response.content_part.done": {
      const output = getOutput(snapshot, event.output_index);
      const { part } = event;
      if (output.type === "message" && part.type !== "reasoning_text") {
        const content = getContent(output.content, event.content_index);
        const previousText = content.type === "output_text" ? content.text : "";
        const replacement = structuredClone(part);
        if (content.type === "output_text" || replacement.type === "output_text") {
          ensureCanonicalOutputText(context, snapshot);
        }
        output.content[event.content_index] = replacement;
        const nextText = replacement.type === "output_text" ? replacement.text : "";
        updateCachedOutputTextLength(context, output, event.output_index, previousText, nextText);
        updateOutputText(context, snapshot, event.output_index, previousText, nextText, event.content_index);
      } else if (output.type === "reasoning" && part.type === "reasoning_text") {
        const { content } = output;
        if (!content) {
          throw new OpenAIError(`missing content at index ${event.content_index}`);
        }
        getContent(content, event.content_index);
        content[event.content_index] = structuredClone(part);
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateOutputTextEvent(event, snapshot, context) {
  switch (event.type) {
    case "response.output_text.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "message") {
        const content = getContent(output.content, event.content_index);
        if (content.type !== "output_text") {
          throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
        }
        const previousText = content.text;
        ensureCanonicalOutputText(context, snapshot);
        content.text = previousText + event.delta;
        updateCachedOutputTextLength(context, output, event.output_index, previousText, content.text);
        if (event.output_index === snapshot.output.length - 1 && event.content_index === output.content.length - 1) {
          snapshot.output_text += event.delta;
        } else {
          updateOutputText(context, snapshot, event.output_index, previousText, content.text, event.content_index);
        }
      }
      return true;
    }
    case "response.output_text.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "message") {
        const content = getContent(output.content, event.content_index);
        if (content.type !== "output_text") {
          throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
        }
        const previousText = content.text;
        ensureCanonicalOutputText(context, snapshot);
        content.text = event.text;
        updateCachedOutputTextLength(context, output, event.output_index, previousText, event.text);
        updateOutputText(context, snapshot, event.output_index, previousText, event.text, event.content_index);
      }
      return true;
    }
    case "response.output_text.annotation.added": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "message") {
        const content = getContent(output.content, event.content_index);
        if (content.type !== "output_text") {
          throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
        }
        validateArrayIndex(content.annotations, event.annotation_index, "annotation", true);
        content.annotations[event.annotation_index] = structuredClone(event.annotation);
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateRefusalAndArgumentsEvent(event, snapshot) {
  switch (event.type) {
    case "response.refusal.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "message") {
        const content = getContent(output.content, event.content_index);
        if (content.type !== "refusal") {
          throw new OpenAIError(`expected content to be 'refusal', got ${content.type}`);
        }
        content.refusal += event.delta;
      }
      return true;
    }
    case "response.refusal.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "message") {
        const content = getContent(output.content, event.content_index);
        if (content.type !== "refusal") {
          throw new OpenAIError(`expected content to be 'refusal', got ${content.type}`);
        }
        content.refusal = event.refusal;
      }
      return true;
    }
    case "response.function_call_arguments.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "function_call") {
        output.arguments += event.delta;
      }
      return true;
    }
    case "response.function_call_arguments.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "function_call") {
        output.arguments = event.arguments;
      }
      return true;
    }
    case "response.custom_tool_call_input.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "custom_tool_call") {
        output.input += event.delta;
      }
      return true;
    }
    case "response.custom_tool_call_input.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "custom_tool_call") {
        output.input = event.input;
      }
      return true;
    }
    case "response.mcp_call_arguments.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "mcp_call") {
        output.arguments += event.delta;
      }
      return true;
    }
    case "response.mcp_call_arguments.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "mcp_call") {
        output.arguments = event.arguments;
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateShellEvent(event, snapshot) {
  switch (event.type) {
    case "response.shell_call_command.added":
    case "response.shell_call_command.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "shell_call") {
        const allowAppend = event.type === "response.shell_call_command.added";
        validateArrayIndex(output.action.commands, event.command_index, "command", allowAppend);
        output.action.commands[event.command_index] = event.command;
      }
      return true;
    }
    case "response.shell_call_command.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "shell_call") {
        validateArrayIndex(output.action.commands, event.command_index, "command");
        output.action.commands[event.command_index] += event.delta;
      }
      return true;
    }
    case "response.shell_call_output_content.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "shell_call_output") {
        const content = getShellOutputContent(snapshot, output, event.command_index);
        content.stdout += event.delta.stdout ?? "";
        content.stderr += event.delta.stderr ?? "";
      }
      return true;
    }
    case "response.shell_call_output_content.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "shell_call_output") {
        const content = getContent(event.output, 0);
        getShellOutputContent(snapshot, output, event.command_index);
        output.output[event.command_index] = structuredClone(content);
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateReasoningEvent(event, snapshot) {
  switch (event.type) {
    case "response.reasoning_text.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        if (!output.content) {
          throw new OpenAIError(`missing content at index ${event.content_index}`);
        }
        const content = getContent(output.content, event.content_index);
        if (content.type !== "reasoning_text") {
          throw new OpenAIError(`expected content to be 'reasoning_text', got ${content.type}`);
        }
        content.text += event.delta;
      }
      return true;
    }
    case "response.reasoning_text.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        if (!output.content) {
          throw new OpenAIError(`missing content at index ${event.content_index}`);
        }
        const content = getContent(output.content, event.content_index);
        if (content.type !== "reasoning_text") {
          throw new OpenAIError(`expected content to be 'reasoning_text', got ${content.type}`);
        }
        content.text = event.text;
      }
      return true;
    }
    case "response.reasoning_summary_part.added": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        validateArrayAppend(output.summary, event.summary_index, "content");
        output.summary.push(structuredClone(event.part));
      }
      return true;
    }
    case "response.reasoning_summary_part.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        getContent(output.summary, event.summary_index);
        output.summary[event.summary_index] = structuredClone(event.part);
      }
      return true;
    }
    case "response.reasoning_summary_text.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        const part = getContent(output.summary, event.summary_index);
        part.text += event.delta;
      }
      return true;
    }
    case "response.reasoning_summary_text.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "reasoning") {
        const part = getContent(output.summary, event.summary_index);
        part.text = event.text;
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateCodeInterpreterEvent(event, snapshot) {
  switch (event.type) {
    case "response.code_interpreter_call_code.delta": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "code_interpreter_call") {
        output.code = (output.code ?? "") + event.delta;
      }
      return true;
    }
    case "response.code_interpreter_call_code.done": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "code_interpreter_call") {
        output.code = event.code;
      }
      return true;
    }
    case "response.code_interpreter_call.in_progress": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "code_interpreter_call") {
        output.status = "in_progress";
      }
      return true;
    }
    case "response.code_interpreter_call.interpreting": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "code_interpreter_call") {
        output.status = "interpreting";
      }
      return true;
    }
    case "response.code_interpreter_call.completed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "code_interpreter_call") {
        output.status = "completed";
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateSearchStatusEvent(event, snapshot) {
  switch (event.type) {
    case "response.file_search_call.in_progress": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "file_search_call") {
        output.status = "in_progress";
      }
      return true;
    }
    case "response.file_search_call.searching": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "file_search_call") {
        output.status = "searching";
      }
      return true;
    }
    case "response.file_search_call.completed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "file_search_call") {
        output.status = "completed";
      }
      return true;
    }
    case "response.web_search_call.in_progress": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "web_search_call") {
        output.status = "in_progress";
      }
      return true;
    }
    case "response.web_search_call.searching": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "web_search_call") {
        output.status = "searching";
      }
      return true;
    }
    case "response.web_search_call.completed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "web_search_call") {
        output.status = "completed";
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function accumulateImageAndMcpStatusEvent(event, snapshot) {
  switch (event.type) {
    case "response.image_generation_call.in_progress": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "image_generation_call") {
        output.status = "in_progress";
      }
      return true;
    }
    case "response.image_generation_call.generating": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "image_generation_call") {
        output.status = "generating";
      }
      return true;
    }
    case "response.image_generation_call.completed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "image_generation_call") {
        output.status = "completed";
      }
      return true;
    }
    case "response.mcp_call.in_progress": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "mcp_call") {
        output.status = "in_progress";
      }
      return true;
    }
    case "response.mcp_call.completed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "mcp_call") {
        output.status = "completed";
      }
      return true;
    }
    case "response.mcp_call.failed": {
      const output = getOutput(snapshot, event.output_index);
      if (output.type === "mcp_call") {
        output.status = "failed";
      }
      return true;
    }
    default: {
      return false;
    }
  }
}
function isResponseLifecycleEvent(event) {
  switch (event.type) {
    case "response.created":
    case "response.queued":
    case "response.in_progress":
    case "response.completed":
    case "response.failed":
    case "response.incomplete": {
      return true;
    }
    default: {
      return false;
    }
  }
}
function isIgnoredResponseEvent(event) {
  switch (event.type) {
    case "response.audio.delta":
    case "response.audio.done":
    case "response.audio.transcript.delta":
    case "response.audio.transcript.done":
    case "response.image_generation_call.partial_image":
    case "response.mcp_list_tools.in_progress":
    case "response.mcp_list_tools.completed":
    case "response.mcp_list_tools.failed":
    case "keepalive":
    case "error": {
      return true;
    }
    default: {
      return false;
    }
  }
}
function createResponseContext() {
  return createCanonicalResponseContext();
}
function accumulateResponseWithContext(event, snapshot, context) {
  if (!snapshot) {
    if (event.type !== "response.created") {
      throw new OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
    }
    return cloneResponse(context, event.response);
  }
  if (accumulateOutputItemEvent(event, snapshot, context)) {
    return snapshot;
  }
  if (accumulateContentPartAddedEvent(event, snapshot, context)) {
    return snapshot;
  }
  if (accumulateContentPartDoneEvent(event, snapshot, context)) {
    return snapshot;
  }
  if (accumulateOutputTextEvent(event, snapshot, context)) {
    return snapshot;
  }
  if (accumulateRefusalAndArgumentsEvent(event, snapshot)) {
    return snapshot;
  }
  if (accumulateShellEvent(event, snapshot)) {
    return snapshot;
  }
  if (accumulateReasoningEvent(event, snapshot)) {
    return snapshot;
  }
  if (accumulateCodeInterpreterEvent(event, snapshot)) {
    return snapshot;
  }
  if (accumulateSearchStatusEvent(event, snapshot)) {
    return snapshot;
  }
  if (accumulateImageAndMcpStatusEvent(event, snapshot)) {
    return snapshot;
  }
  if (isResponseLifecycleEvent(event)) {
    return cloneResponse(context, event.response);
  }
  if (isIgnoredResponseEvent(event)) {
    return snapshot;
  }
  return assertNever3(event);
}

// node_modules/openai/lib/responses/ResponseStream.mjs
var _ResponseStream_instances;
var _ResponseStream_params;
var _ResponseStream_currentResponseSnapshot;
var _ResponseStream_finalResponse;
var _ResponseStream_accumulatorContext;
var _ResponseStream_beginRequest;
var _ResponseStream_addEvent;
var _ResponseStream_endRequest;
var ResponseStream = class _ResponseStream extends EventStream {
  /** Creates an unstarted stream, retaining request parameters for structured-output parsing. */
  constructor(params) {
    super();
    _ResponseStream_instances.add(this);
    _ResponseStream_params.set(this, void 0);
    _ResponseStream_currentResponseSnapshot.set(this, void 0);
    _ResponseStream_finalResponse.set(this, void 0);
    _ResponseStream_accumulatorContext.set(this, createResponseContext());
    __classPrivateFieldSet(this, _ResponseStream_params, params, "f");
  }
  /** Starts a new response stream or replays an existing response by its identifier. */
  static createResponse(client, params, options) {
    const runner = new _ResponseStream(params);
    runner._run(() => runner._createOrRetrieveResponse(client, params, {
      ...options,
      __metadata: { ...options?.__metadata, helperMethod: "stream" }
    }));
    return runner;
  }
  /** Consumes serialized response events from a readable stream in another runtime. */
  static fromReadableStream(stream2) {
    const runner = new _ResponseStream(null);
    runner._run(() => runner._fromReadableStream(stream2));
    return runner;
  }
  async _createOrRetrieveResponse(client, params, options) {
    this._listenForAbort(options?.signal);
    __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
    let stream2;
    let starting_after = null;
    if ("response_id" in params) {
      stream2 = await client.responses.retrieve(params.response_id, { stream: true }, { ...options, signal: this.controller.signal, stream: true });
      starting_after = params.starting_after ?? null;
    } else {
      stream2 = await client.responses.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
    }
    this._connected();
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event, starting_after);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
  }
  async _fromReadableStream(readableStream, options) {
    this._listenForAbort(options?.signal);
    __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
    this._connected();
    const stream2 = Stream.fromReadableStream(readableStream, this.controller);
    for await (const event of stream2) {
      __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event, null);
    }
    if (stream2.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
  }
  /** Iterates over response events; stopping iteration early aborts the underlying request. */
  [(_ResponseStream_params = /* @__PURE__ */ new WeakMap(), _ResponseStream_currentResponseSnapshot = /* @__PURE__ */ new WeakMap(), _ResponseStream_finalResponse = /* @__PURE__ */ new WeakMap(), _ResponseStream_accumulatorContext = /* @__PURE__ */ new WeakMap(), _ResponseStream_instances = /* @__PURE__ */ new WeakSet(), _ResponseStream_beginRequest = function _ResponseStream_beginRequest2() {
    if (this.ended) {
      return;
    }
    __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
    __classPrivateFieldSet(this, _ResponseStream_accumulatorContext, createResponseContext(), "f");
  }, _ResponseStream_addEvent = function _ResponseStream_addEvent2(event, starting_after) {
    if (this.ended) {
      return;
    }
    const maybeEmit = (name, event2) => {
      if (starting_after == null || event2.sequence_number > starting_after) {
        this._emit(name, event2);
      }
    };
    if (event.type === "error") {
      const error = "error" in event && typeof event.error === "object" && event.error !== null ? event.error : event;
      throw new APIError(void 0, error, event.message, void 0);
    }
    const response = accumulateResponseWithContext(event, __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f"), __classPrivateFieldGet(this, _ResponseStream_accumulatorContext, "f"));
    __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, response, "f");
    maybeEmit("event", event);
    switch (event.type) {
      case "response.output_text.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          const content = output.content[event.content_index];
          if (!content) {
            throw new OpenAIError(`missing content at index ${event.content_index}`);
          }
          if (content.type !== "output_text") {
            throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
          }
          maybeEmit("response.output_text.delta", {
            ...event,
            snapshot: content.text
          });
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "function_call") {
          maybeEmit("response.function_call_arguments.delta", {
            ...event,
            snapshot: output.arguments
          });
        }
        break;
      }
      default: {
        maybeEmit(event.type, event);
        break;
      }
    }
  }, _ResponseStream_endRequest = function _ResponseStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any events`);
    }
    __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
    __classPrivateFieldSet(this, _ResponseStream_accumulatorContext, createResponseContext(), "f");
    const parsedResponse = finalizeResponse(snapshot, __classPrivateFieldGet(this, _ResponseStream_params, "f"));
    __classPrivateFieldSet(this, _ResponseStream_finalResponse, parsedResponse, "f");
    return parsedResponse;
  }, Symbol.asyncIterator)]() {
    return this._createIterator((push) => {
      const onEvent = (event) => push(event);
      this.on("event", onEvent);
      return () => this.off("event", onEvent);
    }, { onReturn: () => this.abort() });
  }
  /**
   * Waits for the stream to end and returns its latest accumulated response.
   *
   * A clean end after at least one response event resolves even when the response is
   * incomplete. Network errors, cancellation, and streams without a response reject.
   */
  async finalResponse() {
    await this.done();
    const response = __classPrivateFieldGet(this, _ResponseStream_finalResponse, "f");
    if (!response) {
      throw new OpenAIError("stream ended without producing a Response");
    }
    return response;
  }
};
function finalizeResponse(snapshot, params) {
  return maybeParseResponse(snapshot, params);
}

// node_modules/openai/resources/responses/input-items.mjs
var InputItems2 = class extends APIResource {
  /**
   * Returns a list of input items for a given response.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const responseItem of client.responses.inputItems.list(
   *   'response_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(responseID, query = {}, options) {
    return this._client.getAPIList(path`/responses/${responseID}/input_items`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
  }
};

// node_modules/openai/resources/responses/input-tokens.mjs
var InputTokens2 = class extends APIResource {
  /**
   * Returns input token counts of the request.
   *
   * Returns an object with `object` set to `response.input_tokens` and an
   * `input_tokens` count.
   *
   * @example
   * ```ts
   * const response = await client.responses.inputTokens.count();
   * ```
   */
  count(body = {}, options) {
    return this._client.post("/responses/input_tokens", {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/responses/responses.mjs
var Responses2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.inputItems = new InputItems2(this._client);
    this.inputTokens = new InputTokens2(this._client);
  }
  create(body, options) {
    return this._client.post("/responses", {
      body,
      ...options,
      stream: body.stream ?? false,
      __security: { bearerAuth: true }
    })._thenUnwrap((rsp) => {
      if ("object" in rsp && rsp.object === "response") {
        addOutputText(rsp);
      }
      return rsp;
    });
  }
  retrieve(responseID, query = {}, options) {
    return this._client.get(path`/responses/${responseID}`, {
      query,
      ...options,
      stream: query?.stream ?? false,
      __security: { bearerAuth: true }
    })._thenUnwrap((rsp) => {
      if ("object" in rsp && rsp.object === "response") {
        addOutputText(rsp);
      }
      return rsp;
    });
  }
  /**
   * Deletes a model response with the given ID.
   *
   * @example
   * ```ts
   * await client.responses.delete(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  delete(responseID, options) {
    return this._client.delete(path`/responses/${responseID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  parse(body, options) {
    return this._client.responses.create(body, options)._thenUnwrap((response) => parseResponse(response, body));
  }
  /**
   * Creates a model response stream
   */
  stream(body, options) {
    return ResponseStream.createResponse(this._client, body, options);
  }
  /**
   * Cancels a model response with the given ID. Only responses created with the
   * `background` parameter set to `true` can be cancelled.
   * [Learn more](https://platform.openai.com/docs/guides/background).
   *
   * @example
   * ```ts
   * const response = await client.responses.cancel(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  cancel(responseID, options) {
    return this._client.post(path`/responses/${responseID}/cancel`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Compact a conversation. Returns a compacted response object.
   *
   * Learn when and how to compact long-running conversations in the
   * [conversation state guide](https://platform.openai.com/docs/guides/conversation-state#managing-the-context-window).
   * For ZDR-compatible compaction details, see
   * [Compaction (advanced)](https://platform.openai.com/docs/guides/conversation-state#compaction-advanced).
   *
   * @example
   * ```ts
   * const compactedResponse = await client.responses.compact({
   *   model: 'gpt-5.6-sol',
   * });
   * ```
   */
  compact(body, options) {
    return this._client.post("/responses/compact", { body, ...options, __security: { bearerAuth: true } });
  }
};
Responses2.InputItems = InputItems2;
Responses2.InputTokens = InputTokens2;

// node_modules/openai/resources/skills/content.mjs
var Content2 = class extends APIResource {
  /**
   * Download a skill zip bundle by its ID.
   */
  retrieve(skillID, options) {
    return this._client.get(path`/skills/${skillID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/skills/versions/content.mjs
var Content3 = class extends APIResource {
  /**
   * Download a skill version zip bundle.
   */
  retrieve(version, params, options) {
    const { skill_id } = params;
    return this._client.get(path`/skills/${skill_id}/versions/${version}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/skills/versions/versions.mjs
var Versions = class extends APIResource {
  constructor() {
    super(...arguments);
    this.content = new Content3(this._client);
  }
  /**
   * Create a new immutable skill version.
   */
  create(skillID, body = {}, options) {
    return this._client.post(path`/skills/${skillID}/versions`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client, {
      stripFilenames: false
    }));
  }
  /**
   * Get a specific skill version.
   */
  retrieve(version, params, options) {
    const { skill_id } = params;
    return this._client.get(path`/skills/${skill_id}/versions/${version}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List skill versions for a skill.
   */
  list(skillID, query = {}, options) {
    return this._client.getAPIList(path`/skills/${skillID}/versions`, CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a skill version.
   */
  delete(version, params, options) {
    const { skill_id } = params;
    return this._client.delete(path`/skills/${skill_id}/versions/${version}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
};
Versions.Content = Content3;

// node_modules/openai/resources/skills/skills.mjs
var Skills = class extends APIResource {
  constructor() {
    super(...arguments);
    this.content = new Content2(this._client);
    this.versions = new Versions(this._client);
  }
  /**
   * Create a new skill.
   */
  create(body = {}, options) {
    return this._client.post("/skills", maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client, {
      stripFilenames: false
    }));
  }
  /**
   * Get a skill by its ID.
   */
  retrieve(skillID, options) {
    return this._client.get(path`/skills/${skillID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Update the default version pointer for a skill.
   */
  update(skillID, body, options) {
    return this._client.post(path`/skills/${skillID}`, {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * List all skills for the current project.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/skills", CursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a skill by its ID.
   */
  delete(skillID, options) {
    return this._client.delete(path`/skills/${skillID}`, { ...options, __security: { bearerAuth: true } });
  }
};
Skills.Content = Content2;
Skills.Versions = Versions;

// node_modules/openai/resources/uploads/parts.mjs
var Parts = class extends APIResource {
  /**
   * Adds a
   * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
   * A Part represents a chunk of bytes from the file you are trying to upload.
   *
   * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
   * maximum of 8 GB.
   *
   * It is possible to add multiple Parts in parallel. You can decide the intended
   * order of the Parts when you
   * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
   */
  create(uploadID, body, options) {
    return this._client.post(path`/uploads/${uploadID}/parts`, multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
};

// node_modules/openai/resources/uploads/uploads.mjs
var Uploads = class extends APIResource {
  constructor() {
    super(...arguments);
    this.parts = new Parts(this._client);
  }
  /**
   * Creates an intermediate
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
   * that you can add
   * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
   * Currently, an Upload can accept at most 8 GB in total and expires after an hour
   * after you create it.
   *
   * Once you complete the Upload, we will create a
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * contains all the parts you uploaded. This File is usable in the rest of our
   * platform as a regular File object.
   *
   * For certain `purpose` values, the correct `mime_type` must be specified. Please
   * refer to documentation for the
   * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
   *
   * For guidance on the proper filename extensions for each purpose, please follow
   * the documentation on
   * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
   *
   * Returns the Upload object with status `pending`.
   */
  create(body, options) {
    return this._client.post("/uploads", { body, ...options, __security: { bearerAuth: true } });
  }
  /**
   * Cancels the Upload. No Parts may be added after an Upload is cancelled.
   *
   * Returns the Upload object with status `cancelled`.
   */
  cancel(uploadID, options) {
    return this._client.post(path`/uploads/${uploadID}/cancel`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Completes the
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
   *
   * Within the returned Upload object, there is a nested
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * is ready to use in the rest of the platform.
   *
   * You can specify the order of the Parts by passing in an ordered list of the Part
   * IDs.
   *
   * The number of bytes uploaded upon completion must match the number of bytes
   * initially specified when creating the Upload object. No Parts may be added after
   * an Upload is completed. Returns the Upload object with status `completed`,
   * including an additional `file` property containing the created usable File
   * object.
   */
  complete(uploadID, body, options) {
    return this._client.post(path`/uploads/${uploadID}/complete`, {
      body,
      ...options,
      __security: { bearerAuth: true }
    });
  }
};
Uploads.Parts = Parts;

// node_modules/openai/lib/Util.mjs
var allSettledWithThrow = async (promises) => {
  const results = await Promise.allSettled(promises);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const result of rejected) {
      console.error(result.reason);
    }
    throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
  }
  const values = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      values.push(result.value);
    }
  }
  return values;
};

// node_modules/openai/resources/vector-stores/file-batches.mjs
var FileBatches = class extends APIResource {
  /**
   * Create a vector store file batch.
   */
  create(vectorStoreID, body, options) {
    return this._client.post(path`/vector_stores/${vectorStoreID}/file_batches`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves a vector store file batch.
   */
  retrieve(batchID, params, options) {
    const { vector_store_id } = params;
    return this._client.get(path`/vector_stores/${vector_store_id}/file_batches/${batchID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Cancel a vector store file batch. This attempts to cancel the processing of
   * files in this batch as soon as possible.
   */
  cancel(batchID, params, options) {
    const { vector_store_id } = params;
    return this._client.post(path`/vector_stores/${vector_store_id}/file_batches/${batchID}/cancel`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Create a vector store batch and poll until all files have been processed.
   */
  async createAndPoll(vectorStoreId, body, options) {
    const batch = await this.create(vectorStoreId, body, options);
    return await this.poll(vectorStoreId, batch.id, options);
  }
  /**
   * Returns a list of vector store files in a batch.
   */
  listFiles(batchID, params, options) {
    const { vector_store_id, ...query } = params;
    return this._client.getAPIList(path`/vector_stores/${vector_store_id}/file_batches/${batchID}/files`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Wait for the given file batch to be processed.
   *
   * Note: this will return even if one of the files failed to process, you need to
   * check batch.file_counts.failed_count to handle this case.
   */
  async poll(vectorStoreID, batchID, options) {
    const headers = buildHeaders([
      options?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    while (true) {
      const { data: batch, response } = await this.retrieve(batchID, { vector_store_id: vectorStoreID }, {
        ...options,
        headers
      }).withResponse();
      switch (batch.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options?.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "cancelled":
        case "completed":
          return batch;
      }
    }
  }
  /**
   * Uploads the given files concurrently and then creates a vector store file batch.
   *
   * The concurrency limit is configurable using the `maxConcurrency` parameter.
   */
  async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options) {
    if (files == null || files.length == 0) {
      throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
    }
    const configuredConcurrency = options?.maxConcurrency ?? 5;
    const concurrencyLimit = Math.min(configuredConcurrency, files.length);
    const client = this._client;
    const fileIterator = files.values();
    const allFileIds = [...fileIds];
    async function processFiles(iterator) {
      for (let item of iterator) {
        const fileObj = await client.files.create({ file: item, purpose: "assistants" }, options);
        allFileIds.push(fileObj.id);
      }
    }
    const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
    await allSettledWithThrow(workers);
    return await this.createAndPoll(vectorStoreId, {
      file_ids: allFileIds
    }, options);
  }
};

// node_modules/openai/resources/vector-stores/files.mjs
var Files3 = class extends APIResource {
  /**
   * Create a vector store file by attaching a
   * [File](https://platform.openai.com/docs/api-reference/files) to a
   * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
   */
  create(vectorStoreID, body, options) {
    return this._client.post(path`/vector_stores/${vectorStoreID}/files`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves a vector store file.
   */
  retrieve(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.get(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Update attributes on a vector store file.
   */
  update(fileID, params, options) {
    const { vector_store_id, ...body } = params;
    return this._client.post(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of vector store files.
   */
  list(vectorStoreID, query = {}, options) {
    return this._client.getAPIList(path`/vector_stores/${vectorStoreID}/files`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a vector store file. This will remove the file from the vector store but
   * the file itself will not be deleted. To delete the file, use the
   * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
   * endpoint.
   */
  delete(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.delete(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Attach a file to the given vector store and wait for it to be processed.
   */
  async createAndPoll(vectorStoreId, body, options) {
    const file = await this.create(vectorStoreId, body, options);
    return await this.poll(vectorStoreId, file.id, options);
  }
  /**
   * Wait for the vector store file to finish processing.
   *
   * Note: this will return even if the file failed to process, you need to check
   * file.last_error and file.status to handle these cases
   */
  async poll(vectorStoreID, fileID, options) {
    const headers = buildHeaders([
      options?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    while (true) {
      const fileResponse = await this.retrieve(fileID, {
        vector_store_id: vectorStoreID
      }, { ...options, headers }).withResponse();
      const file = fileResponse.data;
      switch (file.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options?.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = fileResponse.response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "completed":
          return file;
      }
    }
  }
  /**
   * Upload a file to the `files` API and then attach it to the given vector store.
   *
   * Note the file will be asynchronously processed (you can use the alternative
   * polling helper method to wait for processing to complete).
   */
  async upload(vectorStoreId, file, options) {
    const fileInfo = await this._client.files.create({ file, purpose: "assistants" }, options);
    return this.create(vectorStoreId, { file_id: fileInfo.id }, options);
  }
  /**
   * Add a file to a vector store and poll until processing is complete.
   */
  async uploadAndPoll(vectorStoreId, file, options) {
    const fileInfo = await this.upload(vectorStoreId, file, options);
    return await this.poll(vectorStoreId, fileInfo.id, options);
  }
  /**
   * Retrieve the parsed contents of a vector store file.
   */
  content(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.getAPIList(path`/vector_stores/${vector_store_id}/files/${fileID}/content`, Page, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};

// node_modules/openai/resources/vector-stores/vector-stores.mjs
var VectorStores = class extends APIResource {
  constructor() {
    super(...arguments);
    this.files = new Files3(this._client);
    this.fileBatches = new FileBatches(this._client);
  }
  /**
   * Create a vector store.
   */
  create(body, options) {
    return this._client.post("/vector_stores", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Retrieves a vector store.
   */
  retrieve(vectorStoreID, options) {
    return this._client.get(path`/vector_stores/${vectorStoreID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Modifies a vector store.
   */
  update(vectorStoreID, body, options) {
    return this._client.post(path`/vector_stores/${vectorStoreID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Returns a list of vector stores.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/vector_stores", CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Delete a vector store.
   */
  delete(vectorStoreID, options) {
    return this._client.delete(path`/vector_stores/${vectorStoreID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
  /**
   * Search a vector store for relevant chunks based on a query and file attributes
   * filter.
   */
  search(vectorStoreID, body, options) {
    return this._client.getAPIList(path`/vector_stores/${vectorStoreID}/search`, Page, {
      body,
      method: "post",
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
      __security: { bearerAuth: true }
    });
  }
};
VectorStores.Files = Files3;
VectorStores.FileBatches = FileBatches;

// node_modules/openai/resources/videos.mjs
var Videos = class extends APIResource {
  /**
   * Create a new video generation job from a prompt and optional reference assets.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  create(body, options) {
    return this._client.post("/videos", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Fetch the latest metadata for a generated video.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  retrieve(videoID, options) {
    return this._client.get(path`/videos/${videoID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * List recently generated videos for the current project.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/videos", ConversationCursorPage, {
      query,
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Permanently delete a completed or failed video and its stored assets.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  delete(videoID, options) {
    return this._client.delete(path`/videos/${videoID}`, { ...options, __security: { bearerAuth: true } });
  }
  /**
   * Create a character from an uploaded video.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  createCharacter(body, options) {
    return this._client.post("/videos/characters", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Download the generated video bytes or a derived preview asset.
   *
   * Streams the rendered video content for the specified video job.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  downloadContent(videoID, query = {}, options) {
    return this._client.get(path`/videos/${videoID}/content`, {
      query,
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      __security: { bearerAuth: true },
      __binaryResponse: true
    });
  }
  /**
   * Create a new video generation job by editing a source video or existing
   * generated video.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  edit(body, options) {
    return this._client.post("/videos/edits", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Create an extension of a completed video.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  extend(body, options) {
    return this._client.post("/videos/extensions", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
  /**
   * Fetch a character.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  getCharacter(characterID, options) {
    return this._client.get(path`/videos/characters/${characterID}`, {
      ...options,
      __security: { bearerAuth: true }
    });
  }
  /**
   * Create a remix of a completed video using a refreshed prompt.
   *
   * @deprecated The Sora API is scheduled to permanently shut down on September 24, 2026.
   */
  remix(videoID, body, options) {
    return this._client.post(path`/videos/${videoID}/remix`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
  }
};

// node_modules/openai/resources/webhooks/webhooks.mjs
var _Webhooks_instances;
var _Webhooks_validateSecret;
var _Webhooks_getRequiredHeader;
var Webhooks = class extends APIResource {
  constructor() {
    super(...arguments);
    _Webhooks_instances.add(this);
  }
  /**
   * Validates that the given payload was sent by OpenAI and parses the payload.
   */
  async unwrap(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
    await this.verifySignature(payload, headers, secret, tolerance);
    return JSON.parse(payload);
  }
  /**
   * Validates whether or not the webhook payload was sent by OpenAI.
   *
   * An error will be raised if the webhook payload was not sent by OpenAI.
   *
   * @param payload - The webhook payload
   * @param headers - The webhook headers
   * @param secret - The webhook secret (optional, will use client secret if not provided)
   * @param tolerance - Maximum age of the webhook in seconds (default: 300 = 5 minutes)
   */
  async verifySignature(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
    if (typeof crypto === "undefined" || typeof crypto.subtle.importKey !== "function" || typeof crypto.subtle.verify !== "function") {
      throw new Error("Webhook signature verification is only supported when the `crypto` global is defined");
    }
    __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_validateSecret).call(this, secret);
    const headersObj = buildHeaders([headers]).values;
    const signatureHeader = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-signature");
    const timestamp = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-timestamp");
    const webhookId = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-id");
    const timestampSeconds = parseInt(timestamp, 10);
    if (isNaN(timestampSeconds)) {
      throw new InvalidWebhookSignatureError("Invalid webhook timestamp format");
    }
    const nowSeconds = Math.floor(Date.now() / 1e3);
    if (nowSeconds - timestampSeconds > tolerance) {
      throw new InvalidWebhookSignatureError("Webhook timestamp is too old");
    }
    if (timestampSeconds > nowSeconds + tolerance) {
      throw new InvalidWebhookSignatureError("Webhook timestamp is too new");
    }
    const signatures = signatureHeader.split(" ").map((part) => part.startsWith("v1,") ? part.substring(3) : part);
    const decodedSecret = Uint8Array.from(secret.startsWith("whsec_") ? fromBase64(secret.slice("whsec_".length)) : encodeUTF8(secret));
    const signedPayload = webhookId ? `${webhookId}.${timestamp}.${payload}` : `${timestamp}.${payload}`;
    const signedPayloadBytes = Uint8Array.from(encodeUTF8(signedPayload));
    const key = await crypto.subtle.importKey("raw", decodedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    for (const signature of signatures) {
      try {
        const signatureBytes = Uint8Array.from(fromBase64(signature));
        const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, signedPayloadBytes);
        if (isValid) {
          return;
        }
      } catch {
        continue;
      }
    }
    throw new InvalidWebhookSignatureError("The given webhook signature does not match the expected signature");
  }
};
_Webhooks_instances = /* @__PURE__ */ new WeakSet(), _Webhooks_validateSecret = function _Webhooks_validateSecret2(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error(`The webhook secret must either be set using the env var, OPENAI_WEBHOOK_SECRET, on the client class, OpenAI({ webhookSecret: '123' }), or passed to this function`);
  }
}, _Webhooks_getRequiredHeader = function _Webhooks_getRequiredHeader2(headers, name) {
  if (!headers) {
    throw new Error(`Headers are required`);
  }
  const value = headers.get(name);
  if (value === null || value === void 0) {
    throw new Error(`Missing required header: ${name}`);
  }
  return value;
};

// node_modules/openai/internal/provider.mjs
var providerDefinitionsKey = /* @__PURE__ */ Symbol.for("openai.node.providerDefinitions.v1");
var providerGlobal = globalThis;
var existingProviderDefinitions = providerGlobal[providerDefinitionsKey];
var providerDefinitions = existingProviderDefinitions ?? /* @__PURE__ */ new WeakMap();
if (!existingProviderDefinitions) {
  Object.defineProperty(providerGlobal, providerDefinitionsKey, { value: providerDefinitions });
}
function configureProvider(provider) {
  const definition = providerDefinitions.get(provider);
  if (!definition) {
    throw new Error("Invalid provider. Providers must be created with createProvider().");
  }
  return definition.configure();
}

// node_modules/openai/client.mjs
var _OpenAI_instances;
var _a2;
var _OpenAI_encoder;
var _OpenAI_responseAttempts;
var _OpenAI_baseURLOverridden;
function isRunningInBrowserOrBrowserWorker() {
  if (isRunningInBrowser())
    return true;
  const scope = globalThis;
  return typeof scope.WorkerGlobalScope === "function" && scope instanceof scope.WorkerGlobalScope && typeof scope.WorkerNavigator === "function" && scope.navigator instanceof scope.WorkerNavigator && typeof scope.navigator?.userAgent === "string" && scope.navigator.userAgent !== "Cloudflare-Workers" && scope.process?.versions?.node === void 0 && scope.Deno === void 0 && scope.Bun === void 0 && scope.EdgeRuntime === void 0 && scope.WebSocketPair === void 0;
}
var WORKLOAD_IDENTITY_API_KEY_PLACEHOLDER = "workload-identity-auth";
var OpenAI = class {
  /**
   * API Client for interfacing with the OpenAI API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.adminAPIKey=process.env['OPENAI_ADMIN_KEY'] ?? null]
   * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
   * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
   * @param {string | null | undefined} [opts.webhookSecret=process.env['OPENAI_WEBHOOK_SECRET'] ?? null]
   * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
   * @param {Provider} [opts.provider] - Configure a third-party API provider. Mutually exclusive with top-level authentication and base URL options.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor(clientOptions = {}) {
    _OpenAI_instances.add(this);
    _OpenAI_encoder.set(this, void 0);
    _OpenAI_responseAttempts.set(this, /* @__PURE__ */ new WeakMap());
    this.completions = new Completions2(this);
    this.chat = new Chat(this);
    this.embeddings = new Embeddings(this);
    this.files = new Files2(this);
    this.images = new Images(this);
    this.contentProvenanceChecks = new ContentProvenanceChecks(this);
    this.audio = new Audio(this);
    this.moderations = new Moderations(this);
    this.models = new Models(this);
    this.fineTuning = new FineTuning(this);
    this.graders = new Graders2(this);
    this.vectorStores = new VectorStores(this);
    this.webhooks = new Webhooks(this);
    this.beta = new Beta(this);
    this.batches = new Batches(this);
    this.uploads = new Uploads(this);
    this.admin = new Admin(this);
    this.responses = new Responses2(this);
    this.realtime = new Realtime2(this);
    this.conversations = new Conversations(this);
    this.evals = new Evals(this);
    this.containers = new Containers(this);
    this.skills = new Skills(this);
    this.videos = new Videos(this);
    const provider = clientOptions.provider;
    if (provider) {
      const conflictingOptions = ["apiKey", "adminAPIKey", "workloadIdentity", "baseURL"].filter((key) => clientOptions[key] != null);
      if (conflictingOptions.length) {
        throw new OpenAIError(`The \`provider\` option cannot be used with ${conflictingOptions.map((key) => `\`${key}\``).join(", ")}. Configure authentication and the base URL through the provider instead.`);
      }
    }
    const { baseURL = provider ? null : readEnv("OPENAI_BASE_URL"), apiKey = provider ? null : readEnv("OPENAI_API_KEY") ?? null, adminAPIKey = provider ? null : readEnv("OPENAI_ADMIN_KEY") ?? null, organization = provider ? null : readEnv("OPENAI_ORG_ID") ?? null, project = provider ? null : readEnv("OPENAI_PROJECT_ID") ?? null, webhookSecret = readEnv("OPENAI_WEBHOOK_SECRET") ?? null, workloadIdentity, ...opts } = clientOptions;
    const providerRuntime = provider ? configureProvider(provider) : void 0;
    const options = {
      apiKey,
      adminAPIKey,
      organization,
      project,
      webhookSecret,
      workloadIdentity,
      provider,
      ...opts,
      baseURL: providerRuntime?.baseURL ?? (baseURL || `https://api.openai.com/v1`)
    };
    if (apiKey && workloadIdentity) {
      throw new OpenAIError("The `apiKey` and `workloadIdentity` options are mutually exclusive");
    }
    if (!providerRuntime && !apiKey && !adminAPIKey && !workloadIdentity) {
      throw new OpenAIError("Missing credentials. Please pass an `apiKey`, `workloadIdentity`, `adminAPIKey`, or set the `OPENAI_API_KEY` or `OPENAI_ADMIN_KEY` environment variable.");
    }
    if (!options.dangerouslyAllowBrowser && isRunningInBrowserOrBrowserWorker()) {
      throw new OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
    }
    this.baseURL = options.baseURL;
    this.timeout = options.timeout ?? _a2.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    const defaultLogLevel = "warn";
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("OPENAI_LOG"), "process.env['OPENAI_LOG']", this) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _OpenAI_encoder, FallbackEncoder, "f");
    const customHeadersEnv = provider ? void 0 : readEnv("OPENAI_CUSTOM_HEADERS");
    if (customHeadersEnv) {
      const parsed = {};
      for (const line of customHeadersEnv.split("\n")) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          parsed[line.substring(0, colon).trim()] = line.substring(colon + 1).trim();
        }
      }
      options.defaultHeaders = buildHeaders([parsed, options.defaultHeaders]);
    }
    this._options = options;
    this._provider = providerRuntime;
    if (workloadIdentity) {
      this._workloadIdentityAuth = new WorkloadIdentityAuth(workloadIdentity, this.fetch);
    }
    this.apiKey = typeof apiKey === "string" ? apiKey : null;
    this.adminAPIKey = adminAPIKey;
    this.organization = organization;
    this.project = project;
    this.webhookSecret = webhookSecret;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(options) {
    const inheritedProvider = this._options.provider;
    const provider = options.provider ?? inheritedProvider;
    const inheritedOptions = {
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this._options.apiKey,
      adminAPIKey: this.adminAPIKey,
      workloadIdentity: this._options.workloadIdentity,
      organization: this.organization,
      project: this.project,
      webhookSecret: this.webhookSecret
    };
    if (provider) {
      delete inheritedOptions.apiKey;
      delete inheritedOptions.adminAPIKey;
      delete inheritedOptions.workloadIdentity;
      delete inheritedOptions.baseURL;
      if (provider !== inheritedProvider) {
        delete inheritedOptions.organization;
        delete inheritedOptions.project;
        delete inheritedOptions.defaultHeaders;
      }
    }
    const client = new this.constructor({
      ...inheritedOptions,
      ...options,
      provider
    });
    return client;
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values, nulls }, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    if (values.get("authorization") || values.get("api-key")) {
      return;
    }
    if (nulls.has("authorization") || nulls.has("api-key")) {
      return;
    }
    if (this._workloadIdentityAuth && schemes.bearerAuth) {
      return;
    }
    throw new Error('Could not resolve authentication method. Expected either apiKey or adminAPIKey to be set. Or for one of the "Authorization" or "api-key" headers to be explicitly omitted');
  }
  async authHeaders(opts, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    return buildHeaders([
      schemes.bearerAuth ? await this.bearerAuth(opts) : null,
      schemes.adminAPIKeyAuth ? await this.adminAPIKeyAuth(opts) : null
    ]);
  }
  async bearerAuth(opts) {
    if (this._workloadIdentityAuth) {
      return buildHeaders([{ Authorization: `Bearer ${await this._workloadIdentityAuth.getToken()}` }]);
    }
    if (this.apiKey == null) {
      return void 0;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.apiKey}` }]);
  }
  async adminAPIKeyAuth(opts) {
    if (this.adminAPIKey == null) {
      return void 0;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.adminAPIKey}` }]);
  }
  stringifyQuery(query) {
    return stringifyQuery(query);
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error, message, headers) {
    const normalizedError = error && typeof error === "object" && error.error == null ? { error } : error;
    return APIError.generate(status, normalizedError, message, headers);
  }
  async _callApiKey() {
    if (this._provider)
      return false;
    const apiKey = this._options.apiKey;
    if (typeof apiKey !== "function")
      return false;
    let token;
    try {
      token = await apiKey();
    } catch (err) {
      if (err instanceof OpenAIError)
        throw err;
      throw new OpenAIError(
        `Failed to get token from 'apiKey' function: ${err.message}`,
        // @ts-ignore
        { cause: err }
      );
    }
    if (typeof token !== "string" || !token) {
      throw new OpenAIError(`Expected 'apiKey' function argument to return a string but it returned ${token}`);
    }
    this.apiKey = token;
    return true;
  }
  buildURL(path2, query, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _OpenAI_instances, "m", _OpenAI_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path2) ? new URL(path2) : new URL(baseURL + (baseURL.endsWith("/") && path2.startsWith("/") ? path2.slice(1) : path2));
    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query = { ...pathQuery, ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(options) {
    if (this._provider)
      return;
    const security = options.__security ?? { bearerAuth: true };
    if (security.bearerAuth) {
      await this._callApiKey();
    }
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(request, { url, options }) {
  }
  get(path2, opts) {
    return this.methodRequest("get", path2, opts);
  }
  post(path2, opts) {
    return this.methodRequest("post", path2, opts);
  }
  patch(path2, opts) {
    return this.methodRequest("patch", path2, opts);
  }
  put(path2, opts) {
    return this.methodRequest("put", path2, opts);
  }
  delete(path2, opts) {
    return this.methodRequest("delete", path2, opts);
  }
  methodRequest(method, path2, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path2, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return this.responsePromise(this.makeRequest(options, remainingRetries, void 0));
  }
  responsePromise(request, parse = (client, props) => this.parseResponseWithTimeout(client, props)) {
    const promise = new APIPromise(this, request, parse);
    promise.withResponse = async () => {
      const data = await promise;
      const { response } = await request;
      return { data, response, request_id: response.headers.get("x-request-id") };
    };
    promise._thenUnwrap = (transform) => this.responsePromise(request, async (client, props) => addRequestID(transform(await parse(client, props), props), props.response));
    return promise;
  }
  async parseResponseWithTimeout(client, props) {
    if (props.options.stream || props.options.__binaryResponse || props.response.status === 204 || props.response.headers.get("content-length") === "0") {
      return defaultParseResponse(client, props);
    }
    while (true) {
      const attempt = __classPrivateFieldGet(this, _OpenAI_responseAttempts, "f").get(props.controller);
      const timeout = attempt?.timeout ?? props.options.timeout ?? this.timeout;
      const remaining = Math.max(0, props.startTime + timeout - Date.now());
      const callerSignal = props.options.signal;
      let timer;
      let abortListener;
      let timedOut = false;
      try {
        if (callerSignal?.aborted && props.options.__metadata?.["helperMethod"] !== "runTools") {
          throw new APIUserAbortError();
        }
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            props.controller.abort();
            reject(new APIConnectionTimeoutError());
          }, remaining);
          if (callerSignal) {
            abortListener = () => reject(new APIUserAbortError());
            callerSignal.addEventListener("abort", abortListener, { once: true });
          }
        });
        return await Promise.race([defaultParseResponse(client, props), timeoutPromise]);
      } catch (error) {
        if (callerSignal?.aborted) {
          throw new APIUserAbortError();
        }
        if (!timedOut) {
          throw error;
        }
        const retriesRemaining = attempt?.retriesRemaining ?? 0;
        if (!retriesRemaining || props.options.__metadata?.["hasStreamingBody"] || globalThis.ReadableStream && props.options.body instanceof globalThis.ReadableStream || typeof props.options.body === "object" && props.options.body !== null && (Symbol.asyncIterator in props.options.body || Symbol.iterator in props.options.body && "next" in props.options.body && typeof props.options.body.next === "function")) {
          throw new APIConnectionTimeoutError();
        }
        if (timer !== void 0)
          clearTimeout(timer);
        if (abortListener)
          callerSignal?.removeEventListener("abort", abortListener);
        abortListener = void 0;
        const next = await this.retryRequest(props.options, retriesRemaining, props.retryOfRequestLogID ?? props.requestLogID);
        Object.assign(props, next);
      } finally {
        if (timer !== void 0)
          clearTimeout(timer);
        if (abortListener)
          callerSignal?.removeEventListener("abort", abortListener);
      }
    }
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    const hasStreamingBody = options.__metadata?.["hasStreamingBody"] === true;
    await this.prepareRequest(req, { url, options });
    await this._provider?.prepareRequest?.(req, { url, options });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === void 0 ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
      retryOfRequestLogID,
      method: options.method,
      url,
      options,
      headers: req.headers
    }));
    if (options.signal?.aborted || req.signal?.aborted) {
      throw this._makeUserAbortError(options.signal?.aborted ? options.signal : req.signal);
    }
    const security = options.__security ?? { bearerAuth: true };
    const controller = this.fetchWithTimeout === _a2.prototype.fetchWithTimeout ? createRequestController(req.signal) : new AbortController();
    const response = await this.fetchWithAuth(url, req, timeout, controller, security).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted || req.signal?.aborted) {
        throw this._makeUserAbortError(options.signal?.aborted ? options.signal : req.signal);
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      if (retriesRemaining && !hasStreamingBody) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      const terminalMessage = hasStreamingBody ? "error; streaming body cannot be retried" : "error; no more retries left";
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${terminalMessage}`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${terminalMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (response instanceof OAuthError || response instanceof SubjectTokenProviderError) {
        throw response;
      }
      if (isTimeout) {
        const transportCause = "cause" in response ? response.cause : void 0;
        const isHeadersTimeout = typeof transportCause === "object" && transportCause !== null && "code" in transportCause && transportCause.code === "UND_ERR_HEADERS_TIMEOUT";
        const timeoutError = isHeadersTimeout ? new APIConnectionTimeoutError({
          message: "Request timed out. Node.js fetch timed out waiting for response headers; configure a matching undici fetch and fetchOptions.dispatcher with an Agent whose headersTimeout is at least the SDK timeout."
        }) : new APIConnectionTimeoutError();
        throw Object.assign(timeoutError, { cause: response });
      }
      throw new APIConnectionError({
        message: getConnectionErrorMessage(response),
        cause: response
      });
    }
    const specialHeaders = [...response.headers.entries()].filter(([name]) => name === "x-request-id").map(([name, value]) => ", " + name + ": " + JSON.stringify(value)).join("");
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      if (response.status === 401 && this._workloadIdentityAuth && security.bearerAuth && !options.__metadata?.["hasStreamingBody"] && !options.__metadata?.["workloadIdentityTokenRefreshed"]) {
        await CancelReadableStream(response.body);
        this._workloadIdentityAuth.invalidateToken();
        return this.makeRequest({
          ...options,
          __metadata: {
            ...options.__metadata,
            workloadIdentityTokenRefreshed: true
          }
        }, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      const shouldRetry = await this.shouldRetry(response);
      if (retriesRemaining && shouldRetry && !hasStreamingBody) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? hasStreamingBody ? `error; streaming body cannot be retried` : `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? void 0 : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    __classPrivateFieldGet(this, _OpenAI_responseAttempts, "f").set(controller, { timeout, retriesRemaining });
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  getAPIList(path2, Page2, opts) {
    return this.requestAPIList(Page2, opts && "then" in opts ? opts.then((opts2) => ({ method: "get", path: path2, ...opts2 })) : { method: "get", path: path2, ...opts });
  }
  requestAPIList(Page2, options) {
    const request = this.makeRequest(options, null, void 0);
    const page = new PagePromise(this, request, Page2);
    const guarded = this.responsePromise(request, async (client, props) => {
      const body = await this.parseResponseWithTimeout(client, props);
      return new Page2(client, props.response, body, props.options);
    });
    page.then = guarded.then.bind(guarded);
    page.catch = guarded.catch.bind(guarded);
    page.finally = guarded.finally.bind(guarded);
    page.withResponse = guarded.withResponse.bind(guarded);
    page._thenUnwrap = guarded._thenUnwrap.bind(guarded);
    return page;
  }
  async fetchWithAuth(url, init, timeout, controller, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    if (this._workloadIdentityAuth && schemes.bearerAuth) {
      const headers = init.headers;
      const authHeader = headers.get("Authorization");
      if (!authHeader || authHeader === `Bearer ${WORKLOAD_IDENTITY_API_KEY_PLACEHOLDER}`) {
        const token = await this._workloadIdentityAuth.getToken();
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    const response = await this.fetchWithTimeout(url, init, timeout, controller);
    return response;
  }
  async fetchWithTimeout(url, init, ms, controller) {
    const { signal, method, ...options } = init || {};
    const abort = this._makeAbort(controller);
    const composed = !!signal && composedCallerSignals.get(controller) === signal;
    if (signal && !composed)
      signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, ms);
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    try {
      return await this.fetch.call(void 0, url, fetchOptions);
    } catch (err) {
      if (signal && !composed)
        signal.removeEventListener("abort", abort);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  async shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.get("retry-after");
    if (retryAfterHeader && timeoutMillis === void 0) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1e3;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (timeoutMillis === void 0 || !Number.isFinite(timeoutMillis) || timeoutMillis < 0 || timeoutMillis > 60 * 1e3) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1e3;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path2, query, defaultBaseURL } = options;
    const url = this.buildURL(path2, query, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body, isStreamingBody } = this.buildBody({ options });
    if (isStreamingBody) {
      inputOptions.__metadata = {
        ...inputOptions.__metadata,
        hasStreamingBody: true
      };
    }
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const helperMethod = options.__metadata?.["helperMethod"];
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        ...!isRunningInBrowserOrBrowserWorker() ? { "User-Agent": this.getUserAgent() } : void 0,
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1e3)) } : {},
        ...getPlatformHeaders(),
        ...typeof helperMethod === "string" ? { "X-Stainless-Helper-Method": helperMethod } : {},
        "OpenAI-Organization": this.organization,
        "OpenAI-Project": this.project
      },
      this._provider ? void 0 : await this.authHeaders(options, options.__security ?? { bearerAuth: true }),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    if (!this._provider) {
      this.validateHeaders(headers, options.__security ?? { bearerAuth: true });
    }
    return headers.values;
  }
  _makeAbort(controller) {
    return () => controller.abort();
  }
  _makeUserAbortError(signal) {
    const error = new APIUserAbortError();
    Object.defineProperty(error, "cause", { value: signal.reason, writable: true, configurable: true });
    return error;
  }
  buildBody({ options }) {
    const { body, headers: rawHeaders } = options;
    if (!body) {
      if (body === void 0 && "body" in options) {
        return { ...__classPrivateFieldGet(this, _OpenAI_encoder, "f").call(this, { body, headers: buildHeaders([rawHeaders]) }), isStreamingBody: false };
      }
      return { bodyHeaders: void 0, body: void 0, isStreamingBody: false };
    }
    const headers = buildHeaders([rawHeaders]);
    const isReadableStream2 = typeof globalThis.ReadableStream !== "undefined" && body instanceof globalThis.ReadableStream;
    const isRetryableBody = !isReadableStream2 && (typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body) || typeof globalThis.Blob !== "undefined" && body instanceof globalThis.Blob || body instanceof URLSearchParams || body instanceof FormData);
    if (
      // Pass raw type verbatim
      ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && // Preserve legacy string encoding behavior for now
      headers.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && body instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      body instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      body instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      isReadableStream2
    ) {
      return { bodyHeaders: void 0, body, isStreamingBody: !isRetryableBody };
    } else if (typeof body === "object" && (Symbol.asyncIterator in body || Symbol.iterator in body && "next" in body && typeof body.next === "function")) {
      return {
        bodyHeaders: void 0,
        body: ReadableStreamFrom(body),
        isStreamingBody: true
      };
    } else if (typeof body === "object" && headers.values.get("content-type") === "application/x-www-form-urlencoded") {
      return {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(body),
        isStreamingBody: false
      };
    } else {
      return { ...__classPrivateFieldGet(this, _OpenAI_encoder, "f").call(this, { body, headers }), isStreamingBody: false };
    }
  }
};
_a2 = OpenAI, _OpenAI_encoder = /* @__PURE__ */ new WeakMap(), _OpenAI_responseAttempts = /* @__PURE__ */ new WeakMap(), _OpenAI_instances = /* @__PURE__ */ new WeakSet(), _OpenAI_baseURLOverridden = function _OpenAI_baseURLOverridden2() {
  return this._provider !== void 0 || this.baseURL !== "https://api.openai.com/v1";
};
OpenAI.OpenAI = _a2;
OpenAI.DEFAULT_TIMEOUT = 6e5;
OpenAI.OpenAIError = OpenAIError;
OpenAI.APIError = APIError;
OpenAI.APIConnectionError = APIConnectionError;
OpenAI.APIConnectionTimeoutError = APIConnectionTimeoutError;
OpenAI.APIUserAbortError = APIUserAbortError;
OpenAI.NotFoundError = NotFoundError;
OpenAI.ConflictError = ConflictError;
OpenAI.RateLimitError = RateLimitError;
OpenAI.BadRequestError = BadRequestError;
OpenAI.AuthenticationError = AuthenticationError;
OpenAI.InternalServerError = InternalServerError;
OpenAI.PermissionDeniedError = PermissionDeniedError;
OpenAI.UnprocessableEntityError = UnprocessableEntityError;
OpenAI.InvalidWebhookSignatureError = InvalidWebhookSignatureError;
OpenAI.toFile = toFile;
OpenAI.toStreamingFile = toStreamingFile;
OpenAI.Completions = Completions2;
OpenAI.Chat = Chat;
OpenAI.Embeddings = Embeddings;
OpenAI.Files = Files2;
OpenAI.Images = Images;
OpenAI.ContentProvenanceChecks = ContentProvenanceChecks;
OpenAI.Audio = Audio;
OpenAI.Moderations = Moderations;
OpenAI.Models = Models;
OpenAI.FineTuning = FineTuning;
OpenAI.Graders = Graders2;
OpenAI.VectorStores = VectorStores;
OpenAI.Webhooks = Webhooks;
OpenAI.Beta = Beta;
OpenAI.Batches = Batches;
OpenAI.Uploads = Uploads;
OpenAI.Admin = Admin;
OpenAI.Responses = Responses2;
OpenAI.Realtime = Realtime2;
OpenAI.Conversations = Conversations;
OpenAI.Evals = Evals;
OpenAI.Containers = Containers;
OpenAI.Skills = Skills;
OpenAI.Videos = Videos;
var composedCallerSignals = /* @__PURE__ */ new WeakMap();
function createRequestController(callerSignal) {
  const controller = new AbortController();
  if (!callerSignal)
    return controller;
  const nativeAbortSignal = globalThis.AbortSignal;
  if (typeof nativeAbortSignal?.any !== "function" || !(callerSignal instanceof nativeAbortSignal)) {
    return controller;
  }
  try {
    const composed = nativeAbortSignal.any([controller.signal, callerSignal]);
    Object.defineProperty(controller, "signal", { value: composed, configurable: true });
    composedCallerSignals.set(controller, callerSignal);
  } catch {
  }
  return controller;
}
function getConnectionErrorMessage(error) {
  if (isUndiciDispatcherVersionMismatchError(error)) {
    return `Connection error. This may be caused by passing an undici dispatcher, such as ProxyAgent, that is incompatible with the fetch implementation. If you are using undici's ProxyAgent, pass the fetch implementation from the same undici package: import { fetch, ProxyAgent } from 'undici'; new OpenAI({ fetch, fetchOptions: { dispatcher: new ProxyAgent(...) } });`;
  }
  return void 0;
}
function isUndiciDispatcherVersionMismatchError(error) {
  let current = error;
  for (let i = 0; i < 8 && current && typeof current === "object"; i++) {
    const err = current;
    if (err.code === "UND_ERR_INVALID_ARG" && typeof err.message === "string" && err.message.includes("invalid onRequestStart method")) {
      return true;
    }
    current = err.cause;
  }
  return false;
}

// node_modules/openai/internal/bedrock.mjs
var brand_privateBedrockClient = /* @__PURE__ */ Symbol.for("openai.privateBedrockClient");

// node_modules/openai/bedrock.mjs
var _a3;
_a3 = brand_privateBedrockClient;

// src/server/prelude.ts
function createPreludeSplitter(headings) {
  let contentStarted = false;
  let preludeChars = 0;
  let held = "";
  let midLine = false;
  const startsHeading = (line) => headings.some((h) => line.startsWith(h));
  const headingPrefix = (partial) => headings.some((h) => h.startsWith(partial));
  const thinking = (text) => {
    preludeChars += text.length;
    return { kind: "thinking", text };
  };
  return {
    push(delta) {
      if (contentStarted) return delta === "" ? [] : [{ kind: "content", text: delta }];
      if (delta === "") return [];
      const items = [];
      let text = held + delta;
      held = "";
      for (; ; ) {
        const nl = text.indexOf("\n");
        if (nl === -1) break;
        if (!midLine && startsHeading(text.slice(0, nl))) {
          contentStarted = true;
          items.push({ kind: "content", text });
          return items;
        }
        items.push(thinking(text.slice(0, nl + 1)));
        midLine = false;
        text = text.slice(nl + 1);
      }
      if (text === "") return items;
      if (midLine) {
        items.push(thinking(text));
        return items;
      }
      if (startsHeading(text)) {
        contentStarted = true;
        items.push({ kind: "content", text });
        return items;
      }
      if (headingPrefix(text)) {
        held = text;
        return items;
      }
      midLine = true;
      items.push(thinking(text));
      return items;
    },
    flush() {
      if (contentStarted || held === "") return [];
      const text = held;
      held = "";
      if (startsHeading(text)) {
        contentStarted = true;
        return [{ kind: "content", text }];
      }
      return [thinking(text)];
    },
    get contentStarted() {
      return contentStarted;
    },
    get preludeChars() {
      return preludeChars;
    }
  };
}

// src/server/deepseek.ts
var DEFAULT_MODEL = "deepseek-v4-flash";
var DEFAULT_BASE_URL = "https://api.deepseek.com";
var TEMPERATURE = 0.5;
var TIMEOUT_MS = 6e5;
var MAX_ATTEMPTS = 3;
var RETRY_BACKOFF_MS = [250, 750];
var MAX_COMPLETION_TOKENS = 32e3;
var PROMPTED_REASONING = "prompted";
var DEFAULT_REASONING_MODE = PROMPTED_REASONING;
var OMIT_REASONING_EFFORT = "default";
var DISABLE_REASONING = "none";
var REPORT_RESERVE_TOKENS = 8e3;
var THINKING_CHARS_PER_TOKEN = 3;
var PROMPTED_PLAN_HEADROOM_TOKENS = 3500;
var PRELUDE_RUNAWAY_CHARS = PROMPTED_PLAN_HEADROOM_TOKENS * THINKING_CHARS_PER_TOKEN;
var MIN_REPORT_CONTENT_CHARS = 200;
var EFFORT_ALIASES = {
  low: "low",
  high: "high",
  max: "max",
  minimal: "low",
  // valid API variant (OpenAI vocabulary); measured identical to low
  medium: "high",
  // DeepSeek's compat table maps medium → high
  xhigh: "high"
  // ditto
};
var DeepSeekError = class extends Error {
  status;
  retryable;
  /**
   * Reader-safe wording for the public page. `message` carries the operational detail
   * (env-var hints, finish reasons, statuses) and is for the server terminal only; the
   * route must never send it to the browser.
   */
  publicMessage;
  constructor(message, options) {
    super(message);
    this.name = "DeepSeekError";
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
    this.publicMessage = options?.publicMessage ?? "The report generator hit a problem. Please try again shortly.";
  }
};
var DeepSeekTruncatedError = class extends DeepSeekError {
  constructor(message, options) {
    super(message, options);
    this.name = "DeepSeekTruncatedError";
  }
};
var DeepSeekEmptyReportError = class extends DeepSeekError {
  constructor(message, options) {
    super(message, options);
    this.name = "DeepSeekEmptyReportError";
  }
};
function isConfigured() {
  return typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY !== "";
}
function readConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      "The report generator is not configured on this server: DEEPSEEK_API_KEY is unset. Geometry, section 1 and flat-profile reports work without it.",
      {
        publicMessage: "The report generator is not configured on this server. Your stack signature above is complete and was computed locally; only the interpreted sections need it."
      }
    );
  }
  return {
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL
  };
}
function resolveReasoningEffort(raw2) {
  const value = (raw2 ?? "").trim();
  if (value === "") return DEFAULT_REASONING_MODE;
  if (value === PROMPTED_REASONING) return PROMPTED_REASONING;
  if (value === OMIT_REASONING_EFFORT) return null;
  if (value === DISABLE_REASONING) return DISABLE_REASONING;
  return EFFORT_ALIASES[value] ?? DEFAULT_REASONING_MODE;
}
function activeReasoningMode() {
  return resolveReasoningEffort(process.env.DEEPSEEK_REASONING_EFFORT);
}
function buildChatRequest(input) {
  const effort = resolveReasoningEffort(input.reasoningEffort);
  const thinkingOn = effort !== DISABLE_REASONING && effort !== PROMPTED_REASONING;
  return {
    model: input.model,
    temperature: TEMPERATURE,
    stream: true,
    max_tokens: input.maxTokens ?? MAX_COMPLETION_TOKENS,
    // The DeepSeek-documented on/off switch for hybrid reasoning.
    thinking: { type: thinkingOn ? "enabled" : "disabled" },
    // A cap is sent ONLY when thinking is on AND an explicit level was chosen; unbounded
    // (null) sends no cap, so the model decides how much to think.
    ...thinkingOn && effort !== null ? { reasoning_effort: effort } : {},
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user }
    ]
  };
}
function classifyStreamOutcome(outcome, options) {
  const floor = options?.minContentChars ?? 1;
  const spentThinking = outcome.reasoningChars > 0 ? " The model spent part of its output budget on internal reasoning; set DEEPSEEK_REASONING_EFFORT=none to stop that." : "";
  if (outcome.contentChars < floor) {
    return new DeepSeekEmptyReportError(
      `The report generator returned no usable report text (${outcome.contentChars} chars of content).` + spentThinking + " Nothing usable was written; please try again.",
      {
        publicMessage: "The report generator finished without writing your report. Please try again."
      }
    );
  }
  if (outcome.finishReason === "length") {
    return new DeepSeekTruncatedError(
      `The report was cut off before it finished: the generator hit its output limit (finish_reason "length") after about ${Math.round(outcome.contentChars / 6)} words.` + spentThinking + " What you can see above is real, but the closing sections are missing.",
      {
        publicMessage: "The report was cut off before it finished. What you can see above is real, but the closing sections are missing. Please try again."
      }
    );
  }
  return null;
}
async function* streamReport(request) {
  const config2 = readConfig();
  const client = new OpenAI({ apiKey: config2.apiKey, baseURL: config2.baseURL, maxRetries: 0 });
  const maxTokens = request.maxTokens ?? MAX_COMPLETION_TOKENS;
  const runawayChars = Math.max(0, maxTokens - REPORT_RESERVE_TOKENS) * THINKING_CHARS_PER_TOKEN;
  const prompted = activeReasoningMode() === PROMPTED_REASONING && (request.reportHeadings?.length ?? 0) > 0;
  let exhaustionFallback = false;
  let attempt = 0;
  for (; ; ) {
    attempt += 1;
    let yielded = false;
    let contentChars = 0;
    let reasoningChars = 0;
    let finishReason = null;
    const splitter = prompted ? createPreludeSplitter(request.reportHeadings) : null;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const signal = composeSignals(timeout.signal, request.signal);
    try {
      const stream2 = await client.chat.completions.create(
        buildChatRequest({
          model: config2.model,
          system: request.system,
          // The prompted fallback swaps the prompt (plan instructions stripped) instead
          // of the thinking switch, which is already off on that path.
          user: exhaustionFallback && request.fallbackUser ? request.fallbackUser : request.user,
          ...request.maxTokens === void 0 ? {} : { maxTokens: request.maxTokens },
          reasoningEffort: exhaustionFallback && !prompted ? DISABLE_REASONING : process.env.DEEPSEEK_REASONING_EFFORT
        }),
        { signal }
      );
      let runaway = null;
      for await (const chunk of stream2) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const reasoning = choice.delta?.reasoning_content;
        if (typeof reasoning === "string" && reasoning.length > 0) {
          reasoningChars += reasoning.length;
          yielded = true;
          yield { kind: "thinking", text: reasoning };
          if (!exhaustionFallback && contentChars === 0 && reasoningChars > runawayChars) {
            runaway = "thinking";
            break;
          }
        }
        const delta = choice.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          const pieces = splitter ? splitter.push(delta) : [{ kind: "content", text: delta }];
          for (const item of pieces) {
            if (item.kind === "content") contentChars += item.text.length;
            else reasoningChars += item.text.length;
            yielded = true;
            yield item;
          }
          if (splitter && !splitter.contentStarted && !exhaustionFallback && splitter.preludeChars > PRELUDE_RUNAWAY_CHARS) {
            runaway = "prelude";
            break;
          }
        }
      }
      if (runaway === null && splitter) {
        for (const item of splitter.flush()) {
          if (item.kind === "content") contentChars += item.text.length;
          else reasoningChars += item.text.length;
          yielded = true;
          yield item;
        }
      }
      if (runaway) {
        exhaustionFallback = true;
        console.error(
          runaway === "prelude" ? `[deepseek] the planning pass ran past ${PRELUDE_RUNAWAY_CHARS} chars with no report heading yet; retrying once with the no-plan prompt.` : `[deepseek] reasoning spent ~${Math.round(reasoningChars / THINKING_CHARS_PER_TOKEN)} of the ${maxTokens}-token budget with no report text yet; retrying once with thinking disabled.`
        );
        continue;
      }
      const outcome = classifyStreamOutcome(
        { contentChars, reasoningChars, finishReason },
        // Only the prompted path raises the floor: a bare heading leaking past the
        // splitter is a plausible shape there and must not ship as a finished report.
        prompted ? { minContentChars: MIN_REPORT_CONTENT_CHARS } : void 0
      );
      if (outcome) {
        if (outcome instanceof DeepSeekEmptyReportError && !exhaustionFallback && contentChars === 0) {
          exhaustionFallback = true;
          console.error(
            `[deepseek] ${outcome.message} Retrying once ${prompted ? "with the no-plan prompt" : "with thinking disabled"}.`
          );
          continue;
        }
        throw outcome;
      }
      return;
    } catch (error) {
      const failure = describe2(error, timeout.signal.aborted);
      if (attempt < MAX_ATTEMPTS && !yielded && failure.retryable) {
        const backoff = RETRY_BACKOFF_MS[attempt - 1] ?? 0;
        if (backoff > 0) await new Promise((resolve2) => setTimeout(resolve2, backoff));
        continue;
      }
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
}
function composeSignals(a, b) {
  if (!b) return a;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  a.addEventListener("abort", abort, { once: true });
  b.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
function describe2(error, timedOut) {
  if (timedOut) {
    const publicMessage = "The report generator took too long to respond. Try again.";
    return new DeepSeekError(
      `The report generator did not respond within ${TIMEOUT_MS / 1e3} seconds. Try again.`,
      { retryable: false, publicMessage }
    );
  }
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : void 0;
  if (status === 401 || status === 403) {
    return new DeepSeekError(
      "The report generator rejected this server's credentials. This is a server-side configuration problem, not something you can fix.",
      {
        status,
        retryable: false,
        publicMessage: "The report generator is unavailable right now. Please try again later."
      }
    );
  }
  if (status === 429) {
    const message2 = "The report generator is rate-limited right now. Try again shortly.";
    return new DeepSeekError(message2, { status, retryable: true, publicMessage: message2 });
  }
  if (typeof status === "number" && Number.isFinite(status) && status >= 500) {
    const message2 = "The report generator is having trouble upstream. Try again shortly.";
    return new DeepSeekError(message2, { status, retryable: true, publicMessage: message2 });
  }
  if (error instanceof DeepSeekError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError") {
    const message2 = "The report request was cancelled.";
    return new DeepSeekError(message2, { retryable: false, publicMessage: message2 });
  }
  const message = "The report generator could not be reached. Try again shortly.";
  return new DeepSeekError(message, {
    ...typeof status === "number" && Number.isFinite(status) ? { status } : {},
    retryable: true,
    publicMessage: message
  });
}

// src/server/prompt/foundations.json
var foundations_default = {
  meta: {
    generator: "scripts/build-foundations.mjs",
    sources: [
      "00-overview.md",
      "01-functions.md",
      "02-profile-geometry.md",
      "03-engagement-dynamics.md",
      "04-situational-conditioning.md",
      "06-foundations-digest.md"
    ],
    digestPresent: true,
    excluded: [
      "05-report-generation.md (already in system-prompt.ts)",
      "KNOWN-ISSUES.md (QA log)"
    ],
    chars: 164830,
    approxTokens: 41208
  },
  text: `# PART A: FOUNDATIONS (cognitive-function theory; background reference)

Read this first, before any analysis. It is the theory you reason WITH ; the full knowledge base the per-request fragments are drawn from, given here whole so you hold the complete picture before you interpret anyone.

This is BACKGROUND, not a script. Three standing rules bind it:

- It never dictates WHAT goes in a report. The user message's render plan (the whitelist of fired features) and its selected fragments still decide what a specific person's report may claim. A mechanism described here that did not fire for this profile does not belong in that person's report.
- Everything community-derived is unvalidated. Honor the epistemic tiers throughout: Four confidence tiers are used throughout: established science (cited research), community idea (typology-community writing, attributed and unvalidated), community idea generalized by Mindstack (a community concept extended beyond its home theory), and Mindstack hypothesis (our own guess, not proven). Never let a community idea or Mindstack hypothesis borrow the language of established science.
- Every number, two-letter code, and internal label below is PRIVATE evidence and vocabulary. Reason with it; never print it. Translate to plain everyday words per the contract in Part B.


<!-- source: 00-overview.md (worked examples stripped) -->

<!-- 00 \xB7 Overview ; what Mindstack is, how the five components fit together, the epistemic-tier legend, and the canonical glossary. Legend: established science (cited), community idea (unvalidated), community idea generalized by Mindstack, Mindstack hypothesis. -->

# Mindstack Knowledge Base ; Overview

## What Mindstack is

Mindstack is **not another typology.** It takes the eight Sakinorva cognitive-function scores (Ni, Ne, Si, Se, Ti, Te, Fi, Fe : each roughly 0\u201350) and produces a personalized psychological profile report. The unit of analysis is the individual **stack signature**: the profile's magnitudes, gaps, ordering, and shape : information invisible to canonical 16-type systems. Only 16 of the 40,320 possible orderings are canonical; real measured profiles almost never match one.

The typology community's one genuinely interesting insight is that "loops" and "grips" are **engagement states** : patterns of which functions get engaged, teamed, avoided, or erupt. Mindstack generalizes that insight from 16 fixed stacks to arbitrary measured profiles, wraps it in measurement discipline (noise bands, marginal windows, honest-null regimes), and forces every interpretation to be falsifiable against the reader's lived experience. The person is the authority; reports offer hypotheses, never verdicts.

These documents are written for two audiences at once: a human reader, and the LLM report generator that will use them as its interpretive engine. Detection conditions are computable from the eight scores; interpretive language is reusable; nothing here claims scientific validation for community-derived or invented material.

## Epistemic tiers

Every interpretive rule in this knowledge base carries exactly one tag. Detection rules are pure arithmetic and carry no tag; only interpretations are tagged.

| Tag | Meaning | Report language |
|---|---|---|
| **(established science)** | Established science, cited (Fleeson 2001; Fleeson & Jayawickreme 2015; Mischel & Shoda 1995; McCrae & Costa 1989; Reynierse 2009; Forer 1949; Dickson & Kelly 1985; Randall et al. 2017; Pittenger 2005; Sharma et al. 2024) | "Research on personality suggests\u2026" |
| **(community idea, unvalidated)** | Derived from typology-community sources (mbti-notes.tumblr.com; Naomi Quenk's grip concept) : attributed, unvalidated | "In typology practice this pattern is described as\u2026 (unvalidated)" |
| **(community idea, generalized by Mindstack)** | A (community idea, unvalidated) concept generalized by Mindstack beyond its home theory (e.g., Quenk's grip re-keyed from a fixed inferior to gap-derived shadow floors). Hedged as (Mindstack hypothesis), attributed as (community idea, unvalidated). | "Typology writers describe X for fixed types (unvalidated); extending it to your measured shape is our own speculative generalization : test it." |
| **(Mindstack hypothesis)** | Mindstack hypothesis : our own extrapolation, plausible but speculative, flagged as such | "One hypothesis to test against your own experience\u2026" |

No (community idea, unvalidated), (community idea, generalized by Mindstack), or (Mindstack hypothesis) claim may ever borrow (established science) language ; the "tier audibility" rule in [05 \xA75.3](05-report-generation.md) enforces this at generation time.

## How the five components fit together

\`\`\`mermaid
flowchart LR
  scores["Eight Sakinorva scores (0\u201350)"] --> geo["02 \xB7 Profile geometry<br/>stack signature: tiers, gaps, cliffs,<br/>indices, shapes, regimes"]
  intake["situational context situation intake"] --> fm["04 \xB7 Friction map<br/>demands vs supply \u2192<br/>if-then signatures"]
  geo --> dyn["03 \xB7 Engagement dynamics<br/>circuits \xB7 spikes \xB7 floors \xB7 pressures"]
  geo --> fm
  comp["01 \xB7 Functions compendium<br/>per-function engagement states"] --> dyn
  comp --> fm
  dyn --> rep["05 \xB7 Report generation<br/>sections \xB7 gates \xB7 disclaimers"]
  fm --> rep
  geo --> rep
\`\`\`

- **[01 \xB7 The Functions Compendium](01-functions.md)** : per-function content: what each of the eight processes does at five engagement states (engaged, over-engaged, supporting, unengaged, eruptive), plus situational demand cues and confusables. Raw material composed into every downstream reading.
- **[02 \xB7 Profile Geometry](02-profile-geometry.md)** : the measurement layer and the **sole owner of every geometric term and threshold**: noise band, tiers, gaps, cliffs, smears, edge windows, the marginal window, indices, the shape taxonomy, the weak-signal regimes, and the canonical eruption-candidacy rule. Every other component consumes its outputs and defines no geometry of its own; on any discrepancy, 02 wins.
- **[03 \xB7 Engagement Dynamics](03-engagement-dynamics.md)** : the generalized loop/grip mechanics, keyed to 02's outputs: closed circuits, pluralistic clusters, lead spikes, shadow-floor isolation, polarized axes, judging/perceiving pressure, weak-signal handling, and the development snapshot.
- **[04 \xB7 Situational Conditioning](04-situational-conditioning.md)** : the friction map: a situational context intake, a demand taxonomy with an explicit weighting rule, classification of each demand as flow / near-flow / scaffolded stretch / friction / eruption risk against the profile's supply, and if-then signature templates.
- **[05 \xB7 Report Generation and Epistemics](05-report-generation.md)** : the rendering contract: report structure and routing, voice rules, tier-to-language mapping, Barnum mitigations as pass/fail gates, uncertainty language, the required disclaimer, and prohibited outputs.

## Glossary

One canonical definition per term. The component in parentheses owns the term; other files may restate but never redefine it.

### Measurement and geometry (owned by 02)

- **Stack signature** : the full 8-score profile treated as a geometric shape; never a type label.
- **Noise band (B)** : the stipulated resolution limit, default 5 points; score differences \u2264 B are ties and must never be interpreted as rank. [H ; convention, not a measured standard error]
- **Gap** : an adjacent difference in the sorted profile exceeding B; a tier boundary.
- **Cliff** : an adjacent difference exceeding 2B; itself interpretable via three held hypotheses (suppression / avoidance / non-development). (Mindstack hypothesis)
- **Boundary strength** : gap minus B; descriptive only.
- **Marginal window**: the corpus-wide marginality rule (02 \xA72.2): a detection exceeding its threshold by \u2264 20% of that threshold is *marginal* ; a hedged watch item, never a firm pattern; past the window it is *firm*. At B = 5: gaps 5\u20136, cliffs 10\u201312, circuit strength 5\u20136. Index cutoffs take a "borderline" qualifier within 20% past the cutoff. (Mindstack hypothesis)
- **Engagement tiers** : the gap-derived bands: **Lead cluster** (top segment; if smeared, its upper edge is the operative lead), **Support band**, **Reserve band**, **Shadow floor** (bottom segment). Tier boundaries fall where gaps exceed B : not at fixed stack positions. [H ; the core invention]
- **Smeared segment** : a segment whose internal span exceeds B (chained near-ties); real internal differences, no clean internal boundary.
- **Upper edge / lower edge** : members of a smeared segment within B of its maximum / minimum; descriptive windows (they may overlap), never tiers and never a rank.
- **Pairwise rule** : inside a smeared segment, X is genuinely above Y only if the difference exceeds B (hedged if inside the marginal window); the only licensed within-segment comparison.
- **Active set** : the lead cluster, plus the upper edge of the next segment when the lead boundary is marginal; the unit used by composition checks (J/P pressure, pluralistic sub-clusters). (Mindstack hypothesis)
- **Attitude tilt** : (\u03A3Ne,Se,Te,Fe \u2212 \u03A3Ni,Si,Ti,Fi) / \u03A3all; the profile's outward/inward processing metabolism ; explicitly not sociability. (community idea, unvalidated)
- **Axis polarization** : per opposing pair (Ni\u2013Se, Ne\u2013Si, Ti\u2013Fe, Te\u2013Fi), the absolute difference, classified balanced (\u2264 B; sub-classified balanced-high / balanced-low by pair mean vs profile mean), leaning (\u2264 2B), polarized (\u2264 4B), extreme (> 4B). [D / D\u2192H interpretations]
- **Judging/perceiving pressure** : fires from the composition of the active set (all-judging \u2192 judging pressure; all-perceiving \u2192 perceiving pressure; mixed \u2192 no fire, hedged note at most); the (\u03A3J \u2212 \u03A3P) index is context only. (community idea, generalized by Mindstack)
- **Differentiation index** : max minus min of the eight scores; low values are weak signal. (Mindstack hypothesis)
- **Elevation** : mean of the eight scores; never interpreted as ability, health, or development. (Mindstack hypothesis)
- **FLAT regime / honest-null rule** : differentiation \u2264 2B: weak signal reported as weak signal, never filled with invented content; takes precedence over every other shape. [H, motivated by Forer 1949 (established science)]
- **STAIRCASE regime** : no adjacent gap exceeds B but differentiation > 2B: no tier boundaries; only upper-vs-lower-edge extremes are interpretable. (Mindstack hypothesis)
- **Shape taxonomy (S1\u2013S12 + S3b)** : lead spike (graded marginal / clear / hard), twin peak, pluralistic lead cluster, pluralistic sub-cluster, compressed top, staircase, flat, cliff floor, bimodal split (hollow middle), polarized axis, balanced-high axis, balanced-low axis, single-attitude lead (circuit candidate). (02 \xA74)
- **Pluralistic sub-cluster (S3b)** : three or more functions mutually within one noise band forming the upper edge below a marginal lead boundary (or of a smeared lead); the licensed detection for "near-lead" clusters ; always watch-item grade. (Mindstack hypothesis)
- **Counterweight** : relative to a single-attitude lead, the highest-scoring opposite-attitude function: the profile's built-in exit ramp; reports name it and its activation conditions. (Mindstack hypothesis)
- **Circuit strength** : lead-cluster minimum minus the counterweight score; the circuit fires when > B, graded moderate (\u2264 2B) or strong/sealed (> 2B). (Mindstack hypothesis)
- **Eruption candidacy (canonical rule, 02 \xA76)** : firm candidate: a shadow-floor function whose boundary above is a cliff; gap-but-not-cliff floors get a hedged watch item at most; priority to candidates whose axis partner sits in the lead cluster or upper edge, then depth; at most two candidates rendered per report. (community idea, generalized by Mindstack)
- **Supply grade contract (02 \xA72.1)** : the exported mapping the friction map consumes: Lead \u2192 flow; Support \u2192 near-flow; Reserve \u2192 scaffolded stretch; Shadow \u2192 friction; within a smeared segment, upper edge \u2192 the segment's base grade, lower edge \u2192 one grade lower (floored at scaffolded stretch), overlap or neither window \u2192 hedged fork. (Mindstack hypothesis)

### Per-function content (owned by 01)

- **Engagement states** : the five per-function readings computed from the geometry: **engaged** (lead cluster), **over-engaged** (lead cluster with its axis polarized), **supporting** (support/reserve band or corresponding edge window), **unengaged** (shadow floor : cause held open three ways), **eruptive** (cliff-isolated floor under sustained friction and depletion). Distinct from 02's engagement *tiers*, which they are computed from. (community idea, generalized by Mindstack)
- **Counterfeit fluency** : a weaker-state function's surface mimicry of engaged expression (commanding like engaged Te, charming like engaged Fe), distinguishable by elevated error rate, defensive flavor, and poor outcomes. (community idea, generalized by Mindstack)
- **Demand cue** : a situational feature that predicts which function the situation requires; feeds the friction map's demand taxonomy. (Mindstack hypothesis)
- **Supporting expression** : per-function description of mid-band supply: reliable-but-effortful second-instrument use, with a characteristic degradation-under-fatigue signature. (Mindstack hypothesis)
- **Eruptive expression** : the per-function catalog of crude, out-of-character behavior under depletion, written in lay behavioral language. [D ; Quenk via mbti-notes]

### Dynamics (owned by 03)

- **Closed circuit** : generalized loop: a single-attitude lead with the counterweight more than one noise band below. **Internal circuit** (all-introverted lead: reality-testing starves) / **external circuit** (all-extraverted lead: reflection starves). (community idea, generalized by Mindstack)
- **Bridge function** : the strongest function sharing a floored function's attitude, used to route around the floor rather than developing it directly; not the counterweight (different computation ; they can coincide). [D\u2192H ; Quenk's auxiliary-bridge logic, generalized]
- **Starved-side lever** : under judging or perceiving pressure, the strongest function on the neglected side, with named activation conditions. (Mindstack hypothesis)
- **Arbitration protocol** : for pluralistic clusters: pre-agreed rules assigning which near-tied criterion decides in which life domain. (Mindstack hypothesis)
- **Convergent detection** : two detection rules firing on the same underlying geometry; merged and reported once, never twice.
- **Eruption pointer** : a cross-reference from a shadow-floor function to its eruptive-expression block in 01.
- **Rule of firing** : a dynamic appears in a report only when its detection rule fires on the actual eight scores as computed by 02. [H ; anti-Barnum constraint]
- **Rule of composition** : dynamics prose must be composed with the specific functions' 01 blocks; shape-generic text repeated across users is a failure. (Mindstack hypothesis)
- **Development snapshot** : the profile is a photograph of current engagement, not a fixed essence; reports speak in "currently/lately," never "you are and always will be." [D + S]

### Situational conditioning (owned by 04)

- **Friction map** : given a situational context, the estimate of which functions the situation demands vs which the profile supplies, output as if-then signatures. [S framing via CAPS; H mapping]
- **Demand profile** : the weighted set of function-demands extracted from one situational context intake; the weighting rule (WHAT primary; multi-field cues outrank; ties break toward the lowest supply grade; cap four) makes the headline auditable. (Mindstack hypothesis)
- **Flow / near-flow / scaffolded stretch / friction / eruption risk** : the five classification outcomes of demand vs supply, per 02 \xA72.1's contract. (Mindstack hypothesis)
- **Escalation modifier** : a situational feature (sustained duration, high stakes, no-exit, low autonomy, evaluative audience) that moves a friction verdict toward eruption risk; each field contributes 0 or 1. (Mindstack hypothesis)
- **Workaround substitution** : the predicted behavior under friction: a lead/support function stands in for the demanded shadow-floor function, producing characteristic off-target competence. (Mindstack hypothesis)
- **Default context menu** : the fixed list of eight generic contexts used (two or three at a time, said plainly) when the user supplies no situational context; selected to maximize supply-grade spread. (Mindstack hypothesis)

### Report generation (owned by 05)

- **Geometry anchor** : every geometric feature interpreted anywhere in the report must first be named, with its numbers, in the stack-signature section. (Mindstack hypothesis)
- **Information budget** : interpretive length capped at roughly 150 words per resolvable feature; flat profiles get short reports. (Mindstack hypothesis)
- **Counter-observation** : the named, reader-observable event that would falsify a specific prediction; every falsifiable prediction ships with one. (Mindstack hypothesis)
- **Cost quota** : at least one-third of interpretive statements state a trade-off or cost, attached to the same geometric feature being credited. [S-motivated]
- **Mirror profile** : the synthetic contrast built by replacing every score s with 50 \u2212 s (full inversion: every tier, tilt, and polarization flips; ties stay ties); an interpretive sentence the mirror's holder would accept is anchored to nothing and is deleted or sharpened. (Mindstack hypothesis)
- **Tier audibility** : a claim's epistemic tier must be recoverable from its phrasing alone with tags stripped; enforced by a final audit pass. (Mindstack hypothesis)
- **Fork statement** : the required rendering of a marginal detection: two labeled hypotheses plus the single observation that decides between them. (Mindstack hypothesis)
- **Specificity floor** : interpretive sentences must be behavioral and conditional (situation \u2192 response), never adjectival. (Mindstack hypothesis)
- **Salience order** : for multi-shape profiles: cliffs > strong circuits > extreme/polarized axes > lead-shape readings > balanced/quiet axes; top features rendered to budget, the rest named in one sentence. (Mindstack hypothesis)
- **Routing table** : the fixed mapping of 04's outputs to report sections (verdicts \u2192 \xA73; eruption flags \u2192 \xA74; lever activations \u2192 \xA75). (Mindstack hypothesis)

## Sources and attributions

- **mbti-notes.tumblr.com** (function theory, development, and type-spotting guides) : conceptual source for all (community idea, unvalidated) function descriptions, the loop/avoidance mechanics, the development timeline, and the energy-economics framing. Paraphrased throughout; attributed; unvalidated.
- **Naomi Quenk, *Was That Really Me?* (Davies-Black, 2002)** : the grip/eruption concept and the inferior-function symptom catalogs. (community idea, unvalidated)
- **(established science) literature**: Fleeson (2001) density distributions / Whole Trait Theory; Fleeson & Jayawickreme (2015); Mischel & Shoda (1995) CAPS if-then signatures; McCrae & Costa (1989); Reynierse (2009) : rejection of type dynamics; Forer (1949); Dickson & Kelly (1985); Randall, Isaacson & Ciro (2017); Pittenger (2005), including McCarley & Carskadon (1983); Sharma et al. (2024) on LLM sycophancy.
- **Input instrument**: the Sakinorva cognitive-function test : 96 items, ~12 per function, no published reliability or validity; its author reports results change on retake. It is treated throughout as an unvalidated hobbyist instrument.

Research grounding and verification for every claim above: **[docs/research/mindstack-feasibility.md](../research/mindstack-feasibility.md)** : see \xA73 (the Sakinorva test), \xA74 (academic assessment), and \xA75 (the institutional-use myth). No component may claim scientific validation for (community idea, unvalidated)/(community idea, generalized by Mindstack)/(Mindstack hypothesis) material or imply institutional endorsement.


<!-- source: 01-functions.md (worked examples stripped) -->

<!-- 01 \xB7 The Functions Compendium ; per-function engagement-state readings; raw material for 03 (dynamics), 04 (friction map), and 05 (rendering). Legend: established science (cited), community idea (unvalidated), community idea generalized by Mindstack, Mindstack hypothesis. -->

# 01 \xB7 The Functions Compendium

**Epistemic legend:** (established science) established science (cited) \xB7 (community idea, unvalidated) typology-community material (mbti-notes.tumblr.com; Naomi Quenk's grip concept) : attributed, unvalidated \xB7 (community idea, generalized by Mindstack) a (community idea, unvalidated) concept generalized by Mindstack beyond its home theory ; hedged as (Mindstack hypothesis), attributed as (community idea, unvalidated) \xB7 (Mindstack hypothesis) Mindstack hypothesis ; speculative, offered for the reader to test against lived experience. Canonical term definitions: the [glossary](00-overview.md#glossary). All geometric terms (lead cluster, tiers, edge windows, cliffs, marginal window) are owned and computed by [02 \xB7 Profile Geometry](02-profile-geometry.md); this file defines none of them.

## How to read this compendium

Each block below describes one cognitive process at five **engagement states**. States are per-function readings; do not confuse them with 02's geometric *engagement tiers* (lead / support / reserve / shadow), which are what the states are computed FROM. Which state applies is computable from the stack signature ; never from vibes:

- **Engaged** : the function sits in the lead cluster as computed by 02 \xA72 (for a smeared lead segment, its upper edge). Whether a given situation is currently exercising it is a separate question, answered by the friction map ([04](04-situational-conditioning.md)).
- **Over-engaged** : it sits in the lead cluster while its axis (Ni\u2013Se, Ne\u2013Si, Ti\u2013Fe, Te\u2013Fi) is polarized per 02 \xA73: its partner sits more than two noise bands below. No nearby partner, no brake. [D\u2192H detection rule]
- **Supporting** : it sits in the support or reserve band, or the corresponding edge window of a smeared segment: available as a second instrument, reliable but effortful. Upper-edge/support supply is "near-flow"; reserve/lower-edge supply is "scaffolded" ; the exact contract is 02 \xA72.1, consumed by 04 \xA7c. (Mindstack hypothesis)
- **Unengaged** : it sits on the shadow floor. WHY it is low stays a three-way open question ; suppression, avoidance, or simple non-development ; that every report must hold open (02 \xA74 S7). The (d) blocks below describe the day-to-day texture of the state, not its cause.
- **Eruptive**: a shadow-floor function isolated below a cliff, under sustained friction, stress, or depletion. The prime candidate is a floor function whose axis partner sits in the lead cluster or upper edge; the canonical candidacy rule (firm vs watch-item, priority, cap) is 02 \xA76. [D\u2192H ; Quenk's grip concept, re-keyed from the fixed inferior of a canonical stack to gap-derived shadow floors; the per-function symptom content below is (community idea, unvalidated)]

These are engagement states of a current profile, not essences. Scores move with age, environment, and deliberate practice; orderings inside a noise band are ties and must never be read as rank. Each state description applies *only* when its detection condition holds ; that is what makes every claim here falsifiable for some profile.

A **demand cue** (Mindstack hypothesis) is a situational feature that predicts which function the situation requires; the (f) blocks below feed the friction map's demand taxonomy (04 \xA7b, rows 1\u20139).

**Language note.** The eruptive blocks are deliberately written in lay behavioral language. They are generator source text: clinical or diagnostic vocabulary must never be added at rendering time (05 \xA75.8, item 3).

Descriptions are paraphrased and generalized from the mbti-notes.tumblr.com guides (Function Theory, Development, Type Spotting) and Quenk's grip concept, re-mapped from fixed stack positions to gap-derived tiers. None of this is validated science.

<!-- Pre-publication task: spot-check the eight eruptive blocks against Quenk (2002) symptom lists for close paraphrase; the book could not be checked during assembly. -->

---

## Ni : Introverted Intuition

**(a) What it processes (community idea, unvalidated).** Perception through abstract association: it takes what is present and asks what it implies : where things are heading, what they mean underneath, which single reading unifies scattered signals. Convergent: many observations narrowed, largely subconsciously, to one interpretation.

**(b) Engaged expression (community idea, unvalidated).** Watches a situation at length before committing, then acts with unusual conviction; routes decisions through a guiding purpose and struggles to choose without one; delays gratification for long-horizon ideals; habitually predicts how events will unfold and gets consulted for foresight; grows visibly adrift when life offers nothing significant to strive toward. (Contrast: an Se-led profile decides by engaging first and reading later.)

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Ni leads with the Ni\u2013Se axis polarized (Se far below), interpretation replaces contact with reality: sweeping assumptions harden because raw feedback never lands; expectations turn unrealistic and control-seeking : the plan must be protected from the world; the present is graded against an ideal and always fails. Costs: missed opportunities, perfectionism, verdicts of "meaningless" on ordinary life.

**(d) Unengaged expression (community idea, generalized by Mindstack).** "Then what?" never gets asked. Decisions optimize the immediate and repeatedly produce long-run self-defeat; the person cannot picture a better life concretely enough to steer toward it; talk of meaning and implications registers as killjoy noise. Chronic signature: restlessness no new pleasure fixes. (False for any profile where Ni merely sits mid-band.)

**(e) Eruptive expression [D : Quenk via mbti-notes].** Dark forebodings and doomed-future panic; suspicion of ulterior motives everywhere; hunting mystical "signs"; inflated claims of insight or higher purpose ; crude, negative, out of character, subsiding when energy returns.

**(f) Situational demand cues (Mindstack hypothesis).** WHY-heavy contexts: setting multi-year strategy; interpreting ambiguous signals (a market trend, a shifting relationship); choosing between paths with distant payoffs; synthesizing scattered material into one thesis; being asked "where is this going?"

**(g) Confusable-with (community idea, unvalidated).** Si : same introverted-perceiving goals (conserve energy, filter by subjective importance), so both look deliberate and cautious. Tell: Si checks the new against stored precedent ("what happened before"); Ni projects past the data ("what this is becoming"). Also Ne; tell: Ne fans out into many possibilities, Ni collapses to one.

**(h) Supporting expression (Mindstack hypothesis).** As a second instrument, foresight shows up on request rather than by reflex: the person models implications competently in a planning session but does not live in that register. Near-flow supply is deliberate and good; scaffolded supply needs an explicit prompt ("where is this going?"). Degradation signature: under fatigue the horizon shortens first : long-range framing collapses into next-step thinking.

## Ne ; Extraverted Intuition

**(a) What it processes (community idea, unvalidated).** Perception through lateral possibility: takes what exists and generates what it could become : branching associations, reframings, alternatives. Divergent: one input, many outputs.

**(b) Engaged expression (community idea, unvalidated).** Visible excitement and urgency once an idea catches; brainstorms unprompted and thinks best out loud, bouncing ideas off people; assumes the old method is stale and reaches for a new one first; perks up instantly at "what if"; deflates conspicuously when told a situation cannot change.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Ne leads with the Ne\u2013Si axis polarized (Si far below), possibility-chasing consumes maintenance: projects abandoned at 80%, steps skipped, the same mistakes repeated because past lessons are never consulted; what one has is taken for granted until lost; ever-larger novelty needed to feel hopeful. Unlike an Ne lead with live Si support, nothing accumulates.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Alternatives simply are not generated: problems get lived with rather than re-imagined; viable exits from bad situations go unseen; "it could be different" is dismissed on principle; change is experienced as threat rather than material. Cost: stagnation invisible from inside.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Worst-case spirals enumerating everything that could go wrong; future-paralysis; sudden credulity toward outlandish ideas; erratic, uninhibited acts and fits of hope quickly dashed.

**(f) Situational demand cues (Mindstack hypothesis).** WHAT-ELSE contexts: generating options before a decision; pivoting when plan A dies; open-ended, ill-defined problems; roles rewarding reframing (ideation, research design, marketing); improvising when the script runs out.

**(g) Confusable-with (community idea, unvalidated).** Se ; both extraverted perceiving: energetic, spontaneous, novelty-loving. Tell: Se hunts new *sensation* and acts in the concrete now; Ne hunts new *ideas* and may happily never act on them. "Creative" is not an Ne marker ; talent sits outside this framework.

**(h) Supporting expression (Mindstack hypothesis).** In a structured brainstorm, alternatives arrive : but the stream needs a starter and stalls without one; reframing is a tool picked up, not a place lived in. Degradation signature: options collapse into an either/or; the person stops reframing and starts choosing.

## Si ; Introverted Sensing

**(a) What it processes (community idea, unvalidated).** Perception through comparison with the archive: incoming detail matched against stored, verified experience; stability built from the known and proven.

**(b) Engaged expression (community idea, unvalidated).** Catches discrepancies others miss; defaults to established procedure and can state it precisely; resistant first reaction to disrupted routine; decisions cite precedent; quiet command of logistics, maintenance, and follow-through.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Si leads with the Ne\u2013Si axis polarized (Ne far below), the untested becomes categorically risky: ideas : and their bearers ; get shot down on arrival; overpreparation and ritual lock-in; the present compared unfavorably with an idealized past; worst-case readings of any change. Unlike an Si lead with live Ne, "we've never done it that way" ends inquiry instead of starting it.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Careless with detail and procedure; repeats mistakes because the archive is never consulted; body signals, paperwork, and upkeep chronically neglected; routine experienced as suffocation. Cost: preventable failures, and a life that never compounds.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Hard-to-shake fixation on one trivial detail or one past mistake; health worry out of proportion to evidence; urgent, repetitive nitpicking; feeling unmoored and clinging to what little seems left.

**(f) Situational demand cues (Mindstack hypothesis).** HOW-exactly contexts: compliance and procedural correctness; quality control; transcription-grade accuracy; sustaining health routines; institutional settings that run on precedent; long checklists where one skipped step is failure.

**(g) Confusable-with (community idea, unvalidated).** Ni (see Ni's tell). Also Fe, on conformity: probe *why* the person conforms ; Si conforms because the proven way is safest; Fe conforms to preserve belonging and atmosphere.

**(h) Supporting expression (Mindstack hypothesis).** Procedure and precedent are usable when the stakes are explicit: checklists get followed and records kept, with reminders and external structure carrying part of the load. Degradation signature: detail-verification is the first step skipped under time pressure.

## Se : Extraverted Sensing

**(a) What it processes (community idea, unvalidated).** Perception through live engagement: direct, real-time sensory contact : reading what is physically happening and responding as it happens.

**(b) Engaged expression (community idea, unvalidated).** Near-instant responsiveness to change in the room; joins without hesitation; high stimulation tolerance : energized rather than overwhelmed as pace rises; expressive physicality; drops what stops paying off and moves on without residue.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Se leads with the Ni\u2013Se axis polarized (Ni far below), stimulation loses direction: rising tolerance demands escalation; consequences outrun awareness; commitments feel like traps; beneath constant activity runs a numb "nothing means anything" undertow. Unlike an Se lead with live Ni, motion never converts into trajectory.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Spectates instead of acting; talked out of action by inner simulation; low tolerance for sensory intensity; misses what is literally in front of them while theorizing about it; enjoyment perpetually deferred to some qualifying future.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Out-of-character sensory binges (spending, food, drink, exercise); rigid physical control rituals (cleaning, organizing); clumsy, error-prone overreaction to minor physical events; excitement-grabs that end in apathy.

**(f) Situational demand cues (Mindstack hypothesis).** NOW contexts: crises demanding immediate physical response; live performance and sport; negotiations that shift in the room; hands-on making and repair; hosting; any setting where hesitation itself is the error.

**(g) Confusable-with (community idea, unvalidated).** Ne (see Ne's tell). Also extraversion per se: sociability is not Se : the tell is appetite for direct sensory engagement and speed of physical response, not talkativeness.

**(h) Supporting expression (Mindstack hypothesis).** Given a beat to orient, real-time response is competent: a short internal rehearsal, then serviceable action. Degradation signature: tunnel focus : the chosen action gets executed while the scene changes unnoticed behind it.

## Ti ; Introverted Thinking

**(a) What it processes (community idea, unvalidated).** Judgment by internal consistency: dissects how things work, builds its own framework of principles, and accepts a claim only when it holds together on inspection.

**(b) Engaged expression (community idea, unvalidated).** First reaction to a complication is curiosity, not distress; troubleshoots alone before asking; plain, precise speech; spot-checks claims for contradiction regardless of the source's prestige; genuinely puzzled by escalation over things it has classified as inconsequential.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Ti leads with the Ti\u2013Fe axis polarized (Fe far below), dissection turns reductive: whatever resists the model is ruled irrelevant rather than investigated; certainty grows exactly where feedback is ignored; the same relationship wall gets hit repeatedly; detachment shades into complicity ("not my problem"). Unlike a Ti lead with reachable Fe, being right quietly replaces being useful.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Contradictions in one's own beliefs go unnoticed and unrepaired; positions collapse under questioning because they were adopted, never derived; conclusions need external validation to feel firm; "does this actually make sense?" is not a reflex.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Uncharacteristic cold criticality and suspicion; elaborate "logical backstories" explaining others' motives; relentless truth-quests to prove a point; feeling perfectly rational while everyone nearby reports otherwise.

**(f) Situational demand cues (Mindstack hypothesis).** WHY-does-it-break contexts: debugging systems or arguments; auditing a contract, model, or claim; mastering a technical domain solo; deciding when data contradicts the official story; edge-case hunting.

**(g) Confusable-with (community idea, unvalidated).** Te : both read as "logical." Tell: Te is satisfied when the external result works, measured in outcomes and speed; Ti is satisfied when the internal model is coherent, and will miss a deadline to fix an inconsistency Te would ship around.

**(h) Supporting expression (Mindstack hypothesis).** Logical audit runs well when explicitly invoked ("does this actually hold?") but is not a reflex; verdicts need a sitting, not a glance. Degradation signature: the first coherent-sounding account gets accepted unexamined.

## Te : Extraverted Thinking

**(a) What it processes (community idea, unvalidated).** Judgment by external effect: organizes people, resources, and steps toward measurable results; decides expeditiously from empirical evidence; treats disorder as a problem queue.

**(b) Engaged expression (community idea, unvalidated).** Takes charge unprompted when nobody is steering; visibly frustrated by problems left sitting unsolved; frames everything in objectives, deadlines, and metrics; delegates and structures naturally; assesses ideas by "will it work, at what cost, by when."

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Te leads with the Te\u2013Fi axis polarized (Fi far below), ends begin justifying means: other people's preferences register as friction; workaholism hollows out the private life it was supposed to fund; judgment goes black-and-white; success arrives and feels like nothing. Unlike a Te lead with live Fi, nobody ; including the person ; can say what the winning is *for*.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Analysis and feeling never converge into action; problems are re-described rather than closed; metrics, plans, and deadlines feel identity-erasing; logistics run chronically behind; capability visibly exceeds output.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Sudden bossy bluntness and belligerence from an otherwise non-directive person; an overpowering urge to "correct" everything wrong at once; blame-heavy verdicts; grand plans announced, then abandoned.

**(f) Situational demand cues (Mindstack hypothesis).** BY-WHEN contexts: deadlines with dependencies; coordinating people and resources; triage under scarcity; budget calls; being the singly accountable owner of an outcome.

**(g) Confusable-with (community idea, unvalidated).** Fe : both extraverted judging: organizing, managing, fluent in charge. Tell: Te orders tasks and systems toward efficiency and will accept interpersonal cost; Fe orders the social field toward cohesion and will accept efficiency cost. A commanding surface with a high error rate and defensive flavor suggests **counterfeit fluency** (community idea, generalized by Mindstack) : a weaker-state function's surface mimicry of engaged expression, generalized from the source's tertiary-mimicry warnings ; not engaged Te.

**(h) Supporting expression (Mindstack hypothesis).** Organizing and shipping work when external structure exists : a deadline, an owner, a visible deliverable. Degradation signature: plans still get made; follow-through thins first.

## Fi ; Introverted Feeling

**(a) What it processes (community idea, unvalidated).** Judgment by felt congruence: measures options against an internal registry of values and attachments : does this fit what I hold precious; can I stand behind it and remain myself.

**(b) Engaged expression (community idea, unvalidated).** Near-inability to act against a settled value, even at real cost; strong, stable, articulable likes and dislikes; defends the individual exception against the blanket rule; exits or quietly disrupts environments it reads as soulless; needs solitary time to settle feelings before re-engaging.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Fi leads with the Te\u2013Fi axis polarized (Te far below), the personal swallows the situational: unrelated issues become referenda on the self; moral-purity policing and insincerity verdicts on others; ambitions stall while integrity is curated; mood becomes the day's governing fact. Unlike an Fi lead with live Te, being right about one's values never converts into changed circumstances.

**(d) Unengaged expression (community idea, generalized by Mindstack).** Preferences are weak or borrowed ; the group's values, the metric's values, "whatever works"; the person can function for years while unhappy; own needs surface only as burnout or resentment; asked "what do *you* want?", they produce an optimization, not a want.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Strange hypersensitivity to "unfair" treatment; righteous, absolute moral stances appearing overnight; sulking self-pity and vindictive brooding in someone usually businesslike.

**(f) Situational demand cues (Mindstack hypothesis).** WHO-AM-I contexts: choices trading values against payoffs (offers, relocations, relationships); creative work requiring an authentic voice; witnessing mistreatment; drawing a boundary that will disappoint someone; naming what one actually wants.

**(g) Confusable-with (community idea, unvalidated).** Fe : both weigh human value. Tell: what makes each waver. Fe wavers when the people around them disagree; Fi wavers when its own feelings conflict, and can defy a unanimous room without strain.

**(h) Supporting expression (Mindstack hypothesis).** Personal-value checks happen when a decision is big enough to prompt one; day-to-day, expedience runs the show. Degradation signature: the values check gets deferred : and surfaces later as unexplained unease about a choice already made.

## Fe ; Extraverted Feeling

**(a) What it processes (community idea, unvalidated).** Judgment by the interpersonal field: reads the emotional atmosphere as data : who is at ease, who is excluded, what the moment will bear ; and acts to keep the human system connected and functioning.

**(b) Engaged expression (community idea, unvalidated).** Tracks how everyone in the room is doing and draws out the uninvolved; mirrors feeling so people sense they registered; smooths friction before it becomes conflict; adjusts register per audience without effort; goes beyond normal limits for others' comfort.

**(c) Over-engaged expression (community idea, generalized by Mindstack).** When Fe leads with the Ti\u2013Fe axis polarized (Ti far below), attunement goes boundaryless: self-image bends to the external gaze; self-advocacy needs backup; others get "harmonized" to soothe one's own fears; criticism lands as shame; disagreeable people receive character verdicts instead of analysis. Unlike an Fe lead with reachable Ti, "is it true?" never interrupts "how does it land?"

**(d) Unengaged expression (community idea, generalized by Mindstack).** The room goes unread: stakeholders and loved ones are forgotten in decisions; valuing turns transactional; "insensitive" accusations arrive as ambushes; alienation accumulates as an unexplained background cost even when everything else runs well.

**(e) Eruptive expression [D : Quenk via mbti-notes].** Uncharacteristic approval-hunger and fishing for agreement; provoking one particular person for attention; escalating dramas; hard-to-shake guilt and shame; suspicion of being manipulated, out of proportion to evidence.

**(f) Situational demand cues (Mindstack hypothesis).** HOW-IT-LANDS contexts: delivering hard news; morale after a failure; onboarding, hosting, mediating; client and stakeholder reads; any outcome decided by whether people feel respected.

**(g) Confusable-with (community idea, unvalidated).** Sociability itself, and Fi (see Fi's tell). Tell: Fe is diagnosed by whether behavior tracks *other people's welfare states* ; a quiet person managing the room's comfort is running Fe; a loud entertainer chasing stimulation is not.

**(h) Supporting expression (Mindstack hypothesis).** The room can be read when deliberately attended to; hosting and smoothing are possible but priced : they draw down the same budget as the main work. Degradation signature: attention to others' states is the first expenditure cut when tired.

---

## Lookup table

| Function | Engaged | Over-engaged | Supporting | Unengaged | Eruptive |
|---|---|---|---|---|---|
| Ni | Converges signals into foresight; purpose-led decisions | Interpretation replaces reality-contact; tyranny of the ideal | Foresight on request; horizon shortens when tired | "Then what?" never asked; long-run self-defeat | Doom-forecasting; suspicion of motives; sign-hunting |
| Ne | Fluent option-generation; energized by "what if" | Novelty churn; nothing accumulates | Options in structured brainstorms; collapses to either/or | Problems lived with; exits unseen | Worst-case spirals; outlandish credulity |
| Si | Precision, precedent, dependable follow-through | Untested = forbidden; ritual lock-in | Procedure with reminders; skips checks first when rushed | Detail-carelessness; repeated mistakes | Fixation on one detail or old mistake; body-worry |
| Se | Instant real-time responsiveness and presence | Escalating stimulation without trajectory | Competent after an orienting beat; tunnel focus when tired | Spectating; enjoyment deferred | Sensory binges; rigid control rituals; overreaction |
| Ti | Curious dissection; internal consistency | Reductive dismissal; certainty where feedback is ignored | Audit when invoked; first coherent account accepted when tired | Unexamined contradictions; borrowed positions | Cold suspicion; "logical" blame-stories |
| Te | Outcome-driven organization; charge-taking | Ends-justify-means; hollow winning | Ships with external structure; follow-through thins | Analysis never becomes action | Sudden bossiness; correct-everything urge |
| Fi | Value-anchored refusal; authentic voice | Everything becomes about the self | Values checked on big calls; deferral \u2192 later unease | Borrowed preferences; needs found via burnout | Overnight moral absolutism; self-pity |
| Fe | Room-reading, inclusion, cohesion | Boundaryless mirroring; shame-steered self | Deliberate room-reading; first budget cut when tired | Room unread; accumulating alienation | Approval-hunger; provoked dramas; strange guilt |

Downstream use: [03 \xB7 Engagement Dynamics](03-engagement-dynamics.md) composes these blocks into circuit/spike/floor readings; [04 \xB7 Situational Conditioning](04-situational-conditioning.md) matches the (f) demand cues against supply grades; [05 \xB7 Report Generation](05-report-generation.md) sets the rendering rules.


<!-- source: 02-profile-geometry.md (worked examples stripped) -->

<!-- 02 \xB7 Profile Geometry ; the measurement layer (scores \u2192 stack signature) and the sole owner of every geometric term and threshold. Legend: established science (cited), community idea (unvalidated), community idea generalized by Mindstack, Mindstack hypothesis. -->

# 02 \xB7 Profile Geometry ; From Eight Scores to a Stack Signature

**Epistemic legend:** (established science) established science (cited) \xB7 (community idea, unvalidated) derived from typology-community sources (mbti-notes.tumblr.com; Naomi Quenk's grip concept : attributed, unvalidated) \xB7 (community idea, generalized by Mindstack) a (community idea, unvalidated) concept generalized by Mindstack beyond its home theory \xB7 (Mindstack hypothesis) Mindstack hypothesis (our extrapolation; speculative, offered for the reader to test). Detection rules are pure arithmetic and carry no tag; only interpretations are tagged. Canonical term definitions: the [glossary](00-overview.md#glossary).

**Ownership rule.** This component is the sole owner of every geometric term and threshold in the knowledge base. [01](01-functions.md), [03](03-engagement-dynamics.md), [04](04-situational-conditioning.md), and [05](05-report-generation.md) consume the outputs defined here and define no geometry of their own; where their text names a threshold, it restates this file, and this file wins on any discrepancy.

This component defines the measurement layer: how eight raw scores become a **stack signature** : a geometric object with tiers, gaps, cliffs, and indices ; before a single interpretive word is written. Every downstream component (engagement dynamics, eruption candidates, friction maps) consumes the outputs defined here. The discipline is strict: arithmetic first, hypotheses second, and no structure asserted that the numbers do not support. The signature is a photograph of current engagement, not an essence; all geometry language in reports is tensed "currently / lately" [D + S: within-person state variability, Fleeson 2001].

## 1. Input handling

**Range and validation.** Input is eight numbers : Ni, Ne, Si, Se, Ti, Te, Fi, Fe ; each roughly 0\u201350, transcribed by the user from the Sakinorva functions test (96 items, ~12 per function, no published reliability or validity; see [docs/research/mindstack-feasibility.md](../research/mindstack-feasibility.md) \xA73). Validate that all eight are numeric; values outside 0\u201350 are flagged back to the user for confirmation, never silently clamped. Magnitudes are always stored; a bare ordering is never stored, because rank without distance destroys the information (Fi 34 / Ni 33 and Fi 34 / Ni 12 share a ranking and share nothing else).

**Normalization.** None by default. If a differently scaled instrument is ever accepted (e.g., the 256-item Sakinorva Domains test), rescale linearly to 0\u201350 and hold the noise band at 10% of scale width [H : stipulated convention].

**Noise band.** B = 5 points, default. Justification: the input is an unvalidated hobbyist instrument whose own author reports that results change on retake; ~12 coarse items per function cannot resolve small differences; even professionally maintained continuous type scales show test\u2013retest reliability of only ~.61\u2013.75 [S: Randall et al. 2017], so a hobbyist test's per-function error is plausibly several points. B is a **stipulated resolution limit, not a measured standard error** (Mindstack hypothesis); it is configurable, and every threshold below derives from it (gap > B, cliff > 2B, marginal window \u2264 1.2\xD7 threshold), so changing B re-derives the whole geometry consistently.

**Tie rule (hard constraint).** Two scores within B of each other are a tie. Order inside a tie must never be verbalized as rank. "Ti edges out Te, 34 to 31" is a forbidden sentence; "Ti and Te are effectively tied" is the required one.

## 2. Tier derivation algorithm

\`\`\`
INPUT: s[f] for f \u2208 {Ni,Ne,Si,Se,Ti,Te,Fi,Fe};  B = 5

0  REGIME CHECK (weak signal first; see \xA74 S5/S6 and \xA76):
     diff = max \u2212 min of the eight scores
     diff \u2264 2B                         \u2192 FLAT (S6): honest null. No tiers are
                                          asserted, even if a boundary technically
                                          exists; the single largest gap may be
                                          named only as a tentative watch item.
     no adjacent gap > B AND diff > 2B \u2192 STAIRCASE (S5): one segment, no tier
                                          boundaries; only upper-vs-lower-edge
                                          contrasts are interpretable.
     otherwise                         \u2192 continue.
1  SORT descending \u2192 S[0..7]  (stable; exact ties keep input order, marked tied)
2  GAPS: g[i] = S[i] \u2212 S[i+1]  for i = 0..6
3  BOUNDARIES: cut after position i wherever g[i] > B
     boundary strength = g[i] \u2212 B  (descriptive)
     flag MARGINAL if g[i] \u2264 1.2B                  (the marginal window, \xA72.2)
     flag CLIFF wherever g[i] > 2B  (marginal cliff if g[i] \u2264 2.4B)
4  SEGMENTS: split the sorted list at the cuts \u2192 T1..Tk  (k = 2..8 here)
5  TIERS: Lead cluster = T1;  Shadow floor = Tk
     Support band = T2 (if k \u2265 3)
     Reserve band = T3..T(k\u22121), merged (if k \u2265 4)
6  SMEAR CHECK: flag any segment whose internal span (max \u2212 min) > B
     inside a smeared segment:
       X genuinely above Y  \u21D4  s[X] \u2212 s[Y] > B     (pairwise rule;
                                                     hedge if the difference \u2264 1.2B)
       upper edge = members within B of segment max
       lower edge = members within B of segment min  (windows may overlap)
     a smeared T1: the operative Lead reading is its upper edge
7  ACTIVE SET: Lead cluster, plus the upper edge of T2 when the lead
     boundary is MARGINAL  (used by composition checks: \xA73 J/P, \xA74 S3b)
8  OUTPUT: regime, tiers, cliffs, boundary strengths, smear flags,
     edge windows, active set
\`\`\`

**Why the smear machinery exists.** Chained near-ties defeat clean cuts: scores 34, 31, 30, 25.4 have no adjacent gap above B, yet 34 vs 25.4 is a real difference. The segment rule is canonical for tier lines; the pairwise rule and edge windows describe real structure *inside* a smeared segment without ever asserting a rank the noise band cannot support. When T1 itself is smeared, "Lead cluster" means its upper edge, and the report must hedge accordingly.

### 2.1 Contract with the friction map (exported to 04)

Supply grades form a ladder: **flow > near-flow > scaffolded stretch > friction.** Base grades by tier: Lead cluster \u2192 flow; Support band \u2192 near-flow; Reserve band \u2192 scaffolded stretch; Shadow floor \u2192 friction. Within a **smeared** segment: an upper-edge member takes the segment's base grade; a lower-edge member takes one grade lower, floored at scaffolded stretch (friction is reserved for shadow-floor membership); a member in both windows or in neither takes a hedged fork between the two grades. These supply grades are the **only** licensed downstream use of edge windows : the windows remain descriptive, never tiers, never a rank. (Mindstack hypothesis)

### 2.2 The marginal window (canonical, corpus-wide)

One definition of "marginal," used by every component: **a detection whose measured quantity exceeds its threshold by no more than 20% of that threshold is marginal** : rendered as a hedged watch item (a fork statement per 05 \xA75.5), never a firm pattern. Concretely at B = 5: gaps 5 < g \u2264 6; cliffs 10 < g \u2264 12; circuit strength 5 < s \u2264 6; pairwise smear differences 5 < d \u2264 6. Index cutoffs (\xA73) take the mirror treatment: a value within 20% past its cutoff carries a "borderline" qualifier. A detection past its marginal window is **firm** : even when barely; the report may say "firm, just past the resolution hedge." [H ; stipulated convention. This supersedes any per-file margin rule; 03 and 05 point here.]

## 3. Derived indices

All sums below use \u03A3all = sum of the eight scores; E = {Ne, Se, Te, Fe}, I = {Ni, Si, Ti, Fi}, J = {Ti, Te, Fi, Fe}, P = {Ni, Ne, Si, Se}.

- **Attitude tilt** = (\u03A3E \u2212 \u03A3I) / \u03A3all, range \u22121\u2026+1. Thresholds: |tilt| \u2264 .05 neutral, \u2264 .15 mild, > .15 strong; values within 20% past a cutoff carry a "borderline" qualifier per \xA72.2 [H cutoffs]. Interpretation: the profile's outward/inward processing metabolism [D : attitude as energy direction, per mbti-notes], explicitly **not** sociability or shyness [D : the source is emphatic on this].
- **Axis polarization**, per opposing pair (Ni\u2013Se, Ne\u2013Si, Ti\u2013Fe, Te\u2013Fi): pol = |a \u2212 b|. The five-way scale, consumed verbatim by 03 \xA77: **balanced** if pol \u2264 B, sub-classified by pair mean vs. profile mean into **balanced-high** and **balanced-low**; **leaning** if B < pol \u2264 2B; **polarized** if 2B < pol \u2264 4B; **extreme** if pol > 4B. Interpretations live in the taxonomy (S9\u2013S11).
- **Judging/perceiving pressure.** The index (\u03A3J \u2212 \u03A3P) / \u03A3all (tilt's thresholds (Mindstack hypothesis)) is context only. The diagnostic is the **composition check on the active set** (\xA72 step 7): all-judging active set \u2192 judging pressure; all-perceiving \u2192 perceiving pressure; mixed \u2192 no pressure dynamic fires, and at most one hedged composition note (e.g., "judging-heavy, 3 J : 1 P") may be rendered (Mindstack hypothesis). All-judging: conclusions may outrun data-gathering; all-perceiving: intake without closure [D : both failure modes described by the source's J/P closure mechanics].
- **Differentiation index** = S[0] \u2212 S[7] (the spread). Low if \u2264 2B (the FLAT regime), moderate if \u2264 4B, high above that [H cutoffs]. **Hard honesty rule:** low differentiation is a weak signal, and the report must say so plainly rather than invent content. A flat profile rendered as a rich portrait is a Barnum failure by construction [S: Forer 1949 : identical sketches rate as highly accurate].
- **Elevation** = mean of the eight scores. Never interpreted as overall ability, health, or development; elevation plausibly reflects self-report response style as much as psychology (Mindstack hypothesis). Used only to contextualize the all-high/all-low edge cases.

## 4. Shape taxonomy

Thirteen recurring signature shapes. Detection is arithmetic; interpretations are competing hypotheses for the reader to test, never verdicts. Multiple shapes can co-fire on one profile (rendering salience and caps: 05 \xA75.1; convergent detections merge per 03 \xA70).

**S1 \xB7 Lead spike.** *Detect:* |Lead| = 1. Grades by g[0]: **marginal spike** if B < g[0] \u2264 1.2B; **clear spike** if 1.2B < g[0] \u2264 2B; **hard spike** if g[0] > 2B. *Hypotheses:* one mode is the reliable first reach in unstructured situations [D ; the source's dominant-identification heuristic]; cost side: hammer-and-nail over-application to mismatched situations (community idea, unvalidated). *Not:* skill or maturity in that domain ; investment \u2260 quality [D ; position is influence, not maturity]. *Falsifiable marker:* in novel low-stakes situations the first move should predictably be that mode (an Ni spike: pause and model implications before acting); a person whose first move varies freely falsifies the spike.

**S2 \xB7 Twin peak.** *Detect:* |Lead| = 2. Variants: axis partners (also fires S10), same attitude (also fires S12 when the circuit-strength condition holds), mixed. *Hypotheses:* a working team of two, analogous to the community's dominant-auxiliary pairing (community idea, unvalidated); or alternation with occasional deadlock (Mindstack hypothesis). *Not:* a canonical dom-aux ; order within the pair is uninterpretable by the tie rule. *Marker:* the person can name distinct contexts where each mode leads; if one demonstrably leads everywhere, the second peak is overstated.

**S3 \xB7 Pluralistic lead cluster.** *Detect:* |Lead| = 3. *Hypotheses:* versatile context-switching vs. decision friction ; competing inner criteria and slow closure, especially if all three are judging functions (Mindstack hypothesis). *Not:* "well-rounded maturity." *Marker:* the friction hypothesis predicts a characteristic multi-criteria stall on big decisions; the flexibility hypothesis predicts smooth switching without distress. Fast single-criterion deciding falsifies both, and the cluster should then be read as compression noise.

**S3b \xB7 Pluralistic sub-cluster.** *Detect:* three or more functions mutually within one noise band forming the upper edge of T2 while the lead boundary is MARGINAL, or forming the upper edge of a smeared T1. This is the licensed replacement for any "adjacent" reading: it fires as its own rule or the content is not rendered (03 \xA70, rule of firing). *Hypotheses:* as S3 ; deliberative flexibility vs. decision friction ; plus one structural hedge: membership rests on a marginal boundary and edge windows, so the whole reading is watch-item grade and must be rendered as a fork (Mindstack hypothesis). *Not:* a lead cluster ; never call it one. *Marker:* as S3.

**S4 \xB7 Compressed top.** *Detect:* |Lead| \u2265 4. *Hypotheses:* prioritization filters not strongly set ; breadth of engagement bought at the cost of a default mode [H, inverting the source's efficiency-filter economics (community idea, unvalidated)]; or elevated, undifferentiated self-report. *Not:* mastery of four-plus functions. *Marker:* difficulty naming a single characteristic first move; an obvious signature first reach falsifies the face reading.

**S5 \xB7 Staircase.** *Detect:* regime STAIRCASE (\xA72 step 0: no adjacent gap > B, differentiation > 2B). *Hypotheses:* gradual differentiation without discrete tiers; or measurement smear. *Not:* an eight-rung ladder ; no adjacent rank is real. *Marker:* only extreme contrasts (upper vs. lower edge) should ring true; if even top-vs-bottom contrasts don't, the profile carries no usable signal and the report says so. Report behavior: extremes-only (03 \xA79, 05 \xA75.5).

**S6 \xB7 Flat.** *Detect:* regime FLAT (differentiation \u2264 2B) ; takes precedence over **all** other shapes; when it holds, no other shape is rendered even if a boundary technically exists. *Interpretation:* weak signal ; honest null [hard rule]. Offered hypotheses only: genuinely even engagement, undifferentiated self-knowledge, or neutral/careless responding [D ; the source catalogs self-report failure modes]. *Not:* "you are balanced and adaptable" ; a Barnum item that flatters everyone and differentiates no one. *Marker:* none derivable ; which is exactly the sentence the report must contain. Report schema: 05 \xA75.1 and \xA75.5.

**S7 \xB7 Cliff floor.** *Detect:* |Shadow| = 1 and the final gap > 2B (marginal cliff if \u2264 2.4B, per \xA72.2). *Hypotheses ; hold all three* (Mindstack hypothesis): suppression (active repression, predicting eruptive return [D\u2192H ; Quenk's grip, via mbti-notes, re-keyed to gap-derived floors]); avoidance (the domain is feared or devalued [D ; the source's contrarian-influence principle: a repressed function still shapes the worldview through what gets disowned, disavowed, or defined as unimportant]); simple non-development (never practiced, no drama). *Not:* incapacity, and never a diagnosis. *Marker:* suppression predicts crude, out-of-character eruptions in that domain under fatigue or stress; non-development predicts plain absence without eruption ; which one the reader recognizes discriminates the hypotheses. Smooth handling of the domain under stress falsifies all three.

**S8 \xB7 Bimodal split (hollow middle).** *Detect:* k = 2 and the single boundary is a cliff. *Hypotheses:* all-or-nothing engagement ; trusted tools vs. shunned tools with no stretch zone (Mindstack hypothesis); if the high group shares one attitude, a defended structure (see S12). *Not:* "two personalities." *Marker:* friction-map predictions become step-shaped ; demands on the high group flow, demands on the low group grind, little in between. Graded performance across domains falsifies it. Note: the entire lower group is the shadow floor; friction applies to all of it, but rendered eruption candidates are capped per \xA76.

**S9 \xB7 Polarized axis.** *Detect:* pol > 2B on an opposing pair (extreme if > 4B). *Hypotheses:* one-sided channel processing ; the high pole does that axis's work while the starved pole is repressed rather than absent: it still shapes the worldview through what gets disowned, disavowed, or defined as unimportant [D ; the source's contrarian-influence principle]; Mindstack's own extension: the starved pole's domain often takes on a devalued or faintly threatening cast [D\u2192H ; our paraphrase, not source wording]. *Marker:* the axis-failure signature for the low pole (e.g., Ti\u226BFe: recurring relationship ceiling, missed social cues); fluent handling of that domain under pressure falsifies the reading.

**S10 \xB7 Balanced-high axis.** *Detect:* pol \u2264 B and pair mean \u2265 profile mean. *Competing hypotheses* (community idea, generalized by Mindstack): flexible both-ways processing vs. unresolved tug-of-war ; the axis's dilemma is live and costly. *Not:* automatic integration; the source treats reconciling an axis as a decades-long achievement (community idea, unvalidated). *Marker ; behavioral, not felt:* flexibility predicts stable context-keyed assignment (each recurring context reliably gets one pole); tension predicts observable re-decision ; the same decision re-made in the other pole's currency within days, or deadlock on trade-off calls. A generic recognized feeling of being "torn between X and Y" decides nothing ; nearly everyone endorses it [S: Forer 1949]; only the behavioral markers adjudicate. If neither behavioral marker fits, treat the index as noise.

**S11 \xB7 Balanced-low axis.** *Detect:* pol \u2264 B and pair mean < profile mean. *Hypothesis:* the whole channel is quiet ; its dilemma (old/new, meaning/moment, autonomy/belonging, integrity/efficacy) is not where this person currently lives (Mindstack hypothesis). *Not:* a deficit verdict. *Marker:* that axis's dilemma should rarely surface as a lived theme; a reader for whom that exact tug-of-war is central falsifies the quiet-channel reading.

**S12 \xB7 Single-attitude lead (circuit candidate).** *Detect:* all Lead members (upper edge, if T1 is smeared) share one attitude AND **circuit strength > B**, where the **counterweight** = the highest-scoring opposite-attitude function and circuit strength = Lead minimum \u2212 counterweight score. Grades: **moderate** if B < strength \u2264 2B; **strong (sealed)** if strength > 2B; strength \u2264 B \u2192 no circuit fires (the attitude-uniform lead may be noted in one clause at most). The strength condition is what keeps |Lead| = 1 profiles from firing trivially. The marginal window applies (strength \u2264 1.2B \u2192 marginal read). [H operationalization of the closed-circuit definition] Interpretation is owned by the engagement-dynamics component ([03](03-engagement-dynamics.md) \xA71\u20132); geometry only flags it. *Not:* introversion/extraversion as sociability (community idea, unvalidated). *Marker:* an internal circuit predicts reality-testing starvation on long solo runs (plans never checked against the world); an external circuit predicts momentum without reflection. A reader who routinely activates the counterweight falsifies circuit risk.

## 6. Edge cases and the canonical eruption-candidacy rule

**Eruption candidacy (canonical; 01, 03, 04, and 05 import this rule and define no other):**

- **Firm candidate:** a shadow-floor function whose boundary above is a cliff (> 2B; hedged if inside the 2B\u20132.4B marginal window). [D\u2192H : Quenk's grip, generalized]
- **Watch item only:** a shadow-floor function above a gap-but-not-cliff boundary : rendered as at most one hedged line, never a firm "Under pressure" feature.
- **Priority when several qualify:** (a) any candidate whose axis partner sits in the Lead cluster or upper edge; then (b) depth below the boundary.
- **Cap:** at most **two** candidates rendered per report : an "Under pressure" section listing six crude-eruption catalogs is horoscope by breadth; remaining floor members get one summary line.

Other edge cases:

- **All-high** (elevation \u2265 37.5): interpret shape only; elevation is confounded with response style (Mindstack hypothesis). If differentiation is also \u2264 2B, FLAT governs.
- **All-low** (elevation \u2264 12.5): same shape-only rule; hypotheses include disengaged or self-effacing responding and low self-clarity (Mindstack hypothesis). Never read low elevation as deficiency or distress : no diagnosis.
- **FLAT / STAIRCASE:** see \xA72 step 0 and S5/S6. FLAT \u2192 the honest-null report (05 \xA75.1 flat schema): state that the instrument returned little structure, suggest a retest or the finer-grained 256-item Domains test, and generate **no** trait content. STAIRCASE \u2192 extremes-only reporting.
- **Multiple cliffs (\u2265 2):** a stratified profile. Each cliff is a separate interpretable feature; treat each isolated lower tier on its own terms and never rank functions inside any tier.
- **Shared-attitude shadow floor:** strengthens the circuit hypothesis for the engagement-dynamics component ([03](03-engagement-dynamics.md)) (Mindstack hypothesis).

**Failure honesty, restated once:** where the geometry is weak : marginal boundaries, smears, flat spans ; the report's job is to say the measurement is weak. Precision theater over noisy input is the one failure mode this component exists to prevent.


<!-- source: 03-engagement-dynamics.md (worked examples stripped) -->

<!-- 03 \xB7 Engagement Dynamics ; generalized loop/grip mechanics keyed to 02's geometry outputs. Legend: established science (cited), community idea (unvalidated), community idea generalized by Mindstack, Mindstack hypothesis. -->

# 03 \xB7 Engagement Dynamics

**Epistemic legend:** (established science) established science \xB7 (community idea, unvalidated) typology-community concept, attributed, unvalidated \xB7 (community idea, generalized by Mindstack) a (community idea, unvalidated) concept generalized beyond its home theory \xB7 (Mindstack hypothesis) Mindstack hypothesis, flagged speculation. Geometric terms and thresholds are owned by [02 \xB7 Profile Geometry](02-profile-geometry.md); this component consumes 02's outputs and defines no geometry of its own. Per-function content lives in [01 \xB7 The Functions Compendium](01-functions.md). Canonical term definitions: the [glossary](00-overview.md#glossary).

## 0. Where these mechanics come from ; and what they are not

The typology community's one genuinely interesting insight is not the 16 types ; it is the state mechanics folded inside them. mbti-notes.tumblr.com describes the "loop" as a defensive alliance: the dominant function recruits a weaker same-attitude function to dodge the auxiliary's demand for opposite-attitude growth. Naomi Quenk's "grip" (*Was That Really Me?*, 2002) describes eruption: a chronically repressed inferior seizing behavior when stress or fatigue depletes the dominant. Neither concept is a reordering of a stack. Both are patterns of **engagement** : which functions get teamed, which avoided, which erupt.

Mindstack generalizes these mechanics because the fixed stacks they live in almost never occur in measured data: only 16 of 40,320 orderings are canonical, and real Sakinorva profiles are noisy, tied, and non-canonical by default. So we keep the mechanics ; avoidance coalitions, attitude starvation, repression rebound ; and re-key their detection from stack positions to the profile geometry of 02 (tiers, gaps, cliffs, tilt, polarization).

Epistemic status, plainly: loops and grips have zero peer-reviewed support even in their original form (Reynierse 2009 rejects type dynamics wholesale), so they enter as (community idea, unvalidated), and every generalization below is (community idea, generalized by Mindstack) or (Mindstack hypothesis) ; hypotheses to test against lived experience, never findings. Only the framing is (established science): behavior varies lawfully across situations (Mischel & Shoda 1995, if-then signatures) and people occupy distributions of states, not fixed essences (Fleeson 2001).

Three rules govern every dynamic here.

- **Rule of firing:** a dynamic appears in a report only when its detection rule fires on the actual eight scores as computed by 02 : a reader whose profile fails the rule must be able to say "this section would not be in my report." No "adjacent" firings; near-miss geometry either has its own rule (e.g., 02 S3b) or goes unrendered.
- **Rule of margin:** a detection inside 02's **marginal window** (\xA72.2 ; within 20% past its threshold) is a *marginal read*: rendered as a hedged watch item or fork statement, never a firm pattern. One definition, owned by 02; this file adds no margin rule of its own.
- **Rule of composition (Mindstack hypothesis):** the Inside/Observable text below is a shape skeleton, not finished prose. A rendered report must compose each dynamic with the specific functions' blocks in 01 : an Ni/Ti internal circuit (private theory-building) must read differently from an Si/Fi one (private archiving of felt precedent). Shape-generic prose repeated across users is template convergence, a Barnum failure in slow motion.

## 1. Internal closed circuit (community idea, generalized by Mindstack)

**Detection (consumes 02 S12).** Lead cluster entirely introverted (Ni/Si/Ti/Fi) AND circuit strength > B, where circuit strength = Lead minimum \u2212 counterweight score and the **counterweight** is the highest-scoring extraverted function. Grades, per 02: **moderate** (B < s \u2264 2B), **strong/sealed** (s > 2B); s \u2264 B \u2192 no circuit section.

**Generalizes.** The loop's avoidance economics (mbti-notes): same-attitude functions collude so the psyche fakes balance without leaving its preferred orientation, while the world-facing channel starves.

**Inside.** "I do my best thinking alone; checking against the world feels like an interruption : and faintly like a threat. My conclusions feel increasingly obvious to me and increasingly hard to explain to anyone else."

**Observable.** Long private processing chains; decisions announced rather than negotiated; reality-testing postponed ("once I've finished thinking it through"); surprise when execution meets a world that never read the internal memo.

**Trade-offs.** Real benefit: depth, independence, immunity to fads. Real cost: self-referential drift : errors compound uncorrected because the correction channel is priced out. Unlike an attitude-balanced lead (\xA73), there is no cheap moment when the outside world gets a vote.

**Composition variants (Mindstack hypothesis)** (compose with the lead functions' 01 blocks): Ni/Ti lead ; a *theory spiral*: the model of what's really going on grows internally consistent and externally unchecked. Ni/Fi ; a *meaning spiral*: significance and personal stance harden together. Si/Ti ; a *procedure spiral*: the proven method is re-derived ever more rigorously for a world that has moved. Si/Fi ; an *archive spiral*: precedent and loyalty fuse into "how it's always been for us."

**Stress trajectory.** Sustained pressure deepens withdrawal first, then primes eruption through the lowest extraverted function : crude, not skilled (see that function's eruptive-expression block in 01).

**Exit ramps.** The counterweight is the highest extraverted function. Name it and its activation conditions: cheap, low-stakes external contact in its own currency : for a Te counterweight, a deadline with a visible deliverable; for Se, physical activity with immediate feedback; for Fe, one trusted person to think aloud at; for Ne, brainstorming with no commitment attached.

## 2. External closed circuit (community idea, generalized by Mindstack)

**Detection (consumes 02 S12).** Mirror rule: lead cluster entirely extraverted AND circuit strength > B, counterweight = highest-scoring introverted function. Same grades.

**Generalizes.** Same avoidance economics, opposite direction : mbti-notes' observation that extraverted one-sidedness produces motion without reflection.

**Inside.** "Slowing down feels like dying a little. There's always a next thing, and the next thing feels like the answer. When someone asks what it's all for, I change the subject : smoothly."

**Observable.** High output, packed calendar, decisions made mid-motion; introspective prompts deflected with action or humor; course corrections happen by collision rather than reflection.

**Trade-offs.** Benefit: momentum, responsiveness, visible productivity. Cost: direction is outsourced to the environment : the profile keeps solving whatever is in front of it, including problems not worth solving. Unlike an internal circuit, errors surface fast; their lessons just never get metabolized.

**Composition variants (Mindstack hypothesis):** Se/Te ; *execution churn*: doing and delivering as a way to never sit still. Se/Fe ; *stimulation-and-audience churn*: the next scene and the next room. Ne/Te ; *venture churn*: new initiatives outpace any review of the last one. Ne/Fe ; *possibility-and-people churn*: every conversation opens two more.

**Stress trajectory.** Escalating busyness masquerading as coping; eruption primed through the lowest introverted function : isolated Ni surfacing as doom-reading, isolated Fi as raw self-pity (see 01's eruptive-expression blocks).

**Exit ramps.** Counterweight = highest introverted function, activated by bounded reflection that doesn't threaten momentum: a journaling habit (Fi/Ni), a post-mortem ritual (Ti), a maintenance routine (Si).

## 3. Attitude-balanced lead (Mindstack hypothesis) : the contrast case

**Detection.** The lead cluster itself contains both attitudes. (Mutually exclusive with \xA71\u20132 by construction: 02 S12 requires a single-attitude lead.)

**Generalizes.** The source's health criterion : equilibrium between self-sense and world-contact ; but balance is not free, and a report that praises it without costs has failed.

**Inside.** "I can switch between my head and the room. The cost is that they argue: the inner read and the outer read rarely agree on the first pass."

**Observable.** Comfortable both initiating and reflecting; slower first moves than one-sided profiles because two channels must sync. The tell for the cost side is behavioral, not felt: the same decision re-made twice, once in each channel, within days : or stalls when inner conviction and external feedback deadlock.

**Trade-offs.** Benefit: built-in error correction and grip-resistance, since neither attitude is starved. Cost: switching overhead and genuine indecision under time pressure ; a one-sided profile beats this one for speed on its home turf. Note also (per 02 S10) that balanced-high can mean flexible switching *or* unresolved tension; the report holds both and names the behavioral discriminator.

**Stress trajectory.** Degrades gracefully toward whichever attitude is slightly stronger rather than erupting. Watch for oscillation: redoing the same decision alternately in each channel.

**Exit ramps.** None needed as escape. Instead, name arbitration conditions: which contexts get the inner channel's final vote and which the outer's.

## 4. Pluralistic clusters (Mindstack hypothesis)

**Detection (consumes 02).** Fires on **S2** (twin peak, |Lead| = 2), **S3** (pluralistic lead cluster, |Lead| = 3), or **S3b** (pluralistic sub-cluster: three or more functions mutually within one noise band forming the upper edge under a marginal lead boundary, or within a smeared lead). S3b readings are watch-item grade by construction : membership rests on a marginal boundary ; and are never called a "lead cluster." Sub-cases by composition: same-domain (all judging or all perceiving) vs cross-domain.

**Generalizes.** Nothing in the source ; canonical stacks forbid this shape, which makes it Mindstack's native discovery territory and pure (Mindstack hypothesis). Hypothesis pair to hold simultaneously: *deliberative flexibility* (multiple genuinely available tools) vs *decision friction* (competing criteria with no fixed arbiter).

**Inside** (same-domain judging): "I can argue any decision three ways : what's consistent, what works, what I can live with. Usually they agree. When they don't, I stall, and the stall feels like being three people."

**Observable.** Versatile justification style; context-dependent persona : colleagues disagree about what kind of thinker this person is; slow calls on trade-off-heavy decisions; choices occasionally re-litigated after the fact.

**Trade-offs.** A same-domain cluster buys rich evaluation at the price of starved intake or closure (\xA78). A cross-domain cluster is a self-contained perceive-judge team : faster closure, but the attitudes left out of the team may starve instead. The flattering read ("versatile") must always ship with the friction read; which is true is the user's call to test.

**Stress trajectory.** Pluralism under pressure tends to collapse to one member : usually whichever is cheapest in that context ; so the profile temporarily impersonates a spike; the bypassed criteria then return as second-guessing.

**Exit ramps.** Not an exit but an *arbitration protocol* (Mindstack hypothesis): deciding in advance which criterion rules which domain (e.g., Te for logistics, Fi for commitments).

## 5. Lead spike with steep drop (community idea, generalized by Mindstack)

**Detection (consumes 02 S1).** Single-function lead, graded by 02: **marginal spike** (gap \u2264 1.2B), **clear spike** (\u2264 2B), **hard spike** (> 2B).

**Generalizes.** Dominance economics (mbti-notes): the most-used tool is used because it is cheapest, and every use widens the gap : the hammer-and-nail principle. The geometry shows over-reliance, not talent.

**Inside.** "There's one way I trust to meet anything. It has never really failed me : which is exactly why I can't tell which problems it's currently failing on."

**Observable.** Remarkable fluency in one mode; visible discomfort when a situation refuses that mode; recurring, patterned failures in the same few contexts (the situational-fit signature the friction map in [04](04-situational-conditioning.md) formalizes).

**Trade-offs.** Benefit: identity clarity, deep skill, fast recovery by re-engaging the lead : the source's own remedy for bad states. Cost: a single point of failure. A spike over a strong support band is resilient; a spike over a desert is brittle.

**Stress trajectory.** The classic grip precondition (community idea, unvalidated): depletion knocks out the lead first ; the *first* symptom is losing the lead's ordinary quality, not the eruption ; then the floor function surfaces (\xA76).

**Exit ramps.** The top of the support band is the natural co-processor; activate it by framing tasks in its currency while stakes are low.

## 6. Shadow-floor isolation (community idea, generalized by Mindstack)

**Detection (canonical rule: 02 \xA76).** **Firm eruption candidate:** a shadow-floor function whose boundary above is a cliff. **Watch item only:** a shadow-floor function above a gap-but-not-cliff boundary : one hedged line at most. Strongest form: the candidate is also the axis partner of a function in the lead cluster or upper edge, so polarization compounds isolation. Rendered candidates are capped at two, by 02 \xA76's priority order.

**Generalizes.** Quenk's repression rebound (community idea, unvalidated): what is systematically unengaged does not vanish; it accumulates and erupts in crude, infantile form when the executive is depleted : with eruptive force tracking the size of the gap. Re-keying it from the fixed inferior to gap-derived floors is Mindstack's move (community idea, generalized by Mindstack).

**Inside.** "That whole domain feels foreign : other people's business, slightly contemptible, vaguely threatening. Mostly I don't think about it. Then one bad week, it thinks about me."

**Observable.** Systematic avoidance of the floor function's domain; dismissive theorizing about it ("that stuff is irrational / boring / manipulative"); episodic out-of-character behavior in exactly that domain, followed by embarrassment.

**Trade-offs.** Benefit : say it honestly: not funding a channel frees enormous budget for the lead; many spiky-profile achievements are financed precisely by this neglect. Cost: a standing eruption candidate plus a predictable friction site in every situational context that demands the floored function.

**Stress trajectory** (community idea, unvalidated): sustained demand on the floor plus fatigue \u2192 loss of lead quality \u2192 eruption in the floor's characteristic crude form. **Eruption pointers** (full entries: the eruptive-expression blocks in [01](01-functions.md), in lay behavioral language : keep it that way at rendering time, per 05 \xA75.8): Fe \u2192 sudden approval-hunger, hard-to-shake guilt, drama entanglement, suspicion of being manipulated; Ti \u2192 cold "logical backstories," relentless proving; Te \u2192 blunt aggression, an urge to correct everything at once; Fi \u2192 hypersensitivity, self-pity, absolute moral verdicts; Se \u2192 sensory bingeing, recklessness, rigid control rituals; Si \u2192 fixation on trivial details, health worry out of proportion to evidence, past-mistake brooding; Ne \u2192 worst-case spirals, outlandish credulity, lost inhibition; Ni \u2192 doom-reading, suspicious sign-hunting, inflated claims of insight.

**Exit ramps.** Never "develop the floor directly" : the source itself warns that direct inferior work destabilizes (community idea, unvalidated). Route through the **bridge function**: the strongest function sharing the floor's attitude, used as a bridge (Quenk's auxiliary-bridge logic, generalized (community idea, generalized by Mindstack)). Note the bridge function is *not* the circuit counterweight ; the counterweight is defined against a single-attitude lead (02 S12); the two are computed differently and merely coincide on some profiles. Add boundary design: pre-arranged cover for floor-demanding contexts.

## 7. Polarized axes [D + D\u2192H]

**Detection (consumes 02 \xA73's five-way scale verbatim).** Per axis (Ni\u2013Se, Ne\u2013Si, Ti\u2013Fe, Te\u2013Fi): balanced (\u2264 B; balanced-high / balanced-low by pair mean vs profile mean), leaning (\u2264 2B), polarized (\u2264 4B), extreme (> 4B).

**Generalizes.** The source's contrarian-influence principle (community idea, unvalidated): a repressed pole still shapes the worldview through what gets disowned, disavowed, or defined as unimportant. Mindstack's extension: the starved pole's domain often takes on a devalued or faintly threatening cast [D\u2192H : our paraphrase, not source wording].

**Per-axis predictions** (each fails to fire for balanced profiles : that is the point): Ni\u226BSe ; vision crowds out presence; flux reads as threat; eruption = crude Se. Se\u226BNi ; engagement without trajectory; implications read as killjoys; eruption = crude Ni. Ti\u226BFe ; independence guards against engulfment; the room's mood is illegible; eruption = crude Fe. Fe\u226BTi ; worth outsourced to the room; one's own analysis distrusted; eruption = crude Ti. Te\u226BFi ; throughput over congruence; feelings read as failure; eruption = crude Fi. Fi\u226BTe ; congruence over throughput; systems read as identity-erasure; eruption = crude Te. Si\u226BNe ; the known over the possible; novelty reads as danger; eruption = crude Ne. Ne\u226BSi ; the possible over maintenance; sameness reads as suffocation; eruption = crude Si.

**Trade-offs.** Polarization is specialization: real power on the strong pole, purchased with a devalued blind spot. Balanced-high means flexible switching *or* unresolved tension ; adjudicated by 02 S10's behavioral markers (stable context-keyed assignment vs observable re-decision), never by a recognized feeling of torn-ness. Balanced-low: the channel is quiet; say little.

**Rendering cap (Mindstack hypothesis).** To keep multi-axis profiles out of horoscope territory: render at most the single most polarized axis in full, plus one balanced-high fork; compress the rest to a single sentence (information budget, 05 \xA75.1).

**Stress and exit.** Polarized axes are where \xA76 eruptions live; the exit ramp is always graded, low-stakes exposure to the weak pole's domain : never immersion.

## 8. Judging-pressure and perceiving-pressure imbalance (community idea, generalized by Mindstack)

**Detection (consumes 02 \xA73).** The composition of the **active set** (02 \xA72 step 7: lead cluster, plus the upper edge of the next segment when the lead boundary is marginal): all-judging active set \u2192 judging pressure; all-perceiving \u2192 perceiving pressure; **mixed \u2192 no pressure dynamic fires** : at most one hedged composition note. The (\u03A3J \u2212 \u03A3P) index is context, never a trigger.

**Generalizes.** The source's P/J balance principle (community idea, unvalidated): conclusion-drawers starve without data-feeders; data-gatherers drown without organizers.

**Inside.** Judging pressure: "I have a verdict before I've finished looking." Perceiving pressure: "I see everything and settle nothing."

**Observable.** Judging pressure: fast opinions, premature closure, revisions forced by facts that arrived late. Perceiving pressure: rich intake, deferred decisions, deadlines as the only working closure mechanism.

**Trade-offs.** Decisiveness bought with accuracy; openness bought with paralysis. Neither reading is the flattering one, deliberately.

**Stress trajectory.** Judging pressure hardens : verdicts turn absolute; perceiving pressure floods ; options multiply. Eruption channel: the strongest function on the neglected side, in crude form.

**Exit ramps.** The **starved-side lever** (Mindstack hypothesis): the strongest function on the neglected side, with named conditions : mandatory intake rituals before decisions (judging pressure); artificial closure devices ; deadlines, defaults, decision journals (perceiving pressure).

## 9. Weak-signal geometry (Mindstack hypothesis) ; honest null

**Detection.** Fires exactly when 02 outputs regime **FLAT** (S6) or **STAIRCASE** (S5); this component adds no threshold of its own. (The earlier "compressed profile" 20-point rule is retired.)

**What not to do.** Never narrate a flat profile as "perfectly balanced, rare, adaptable." That is the Barnum trap: flattering, unfalsifiable, and indistinguishable from measurement failure (Forer 1949 (established science)).

**FLAT : honest hypotheses, hold all three:** genuine cross-context flexibility; a response style (mid-scale answering, ambivalence toward the items); or disengagement and self-opacity at test time. The input is a 96-item hobbyist instrument; a flat result is often a weak measurement, not a rich mind. Report behavior: **no dynamics sections at all** : circuits, spikes, floors, clusters, and pressures stay silent; surface the single largest gap as a tentative watch item; recommend a retest or the longer 256-item format before deeper interpretation (report schema: 05 \xA75.1).

**STAIRCASE ; extremes only:** the upper-vs-lower-edge contrast is the sole licensed content; everything else stays silent.

## 10. Development snapshot [D + S]

**Detection.** Always on : this section frames all the others.

**Generalizes.** The source's development timeline (lead differentiates in childhood; support maturation through the teens and twenties; mid-tier roughly 20\u201335; floor awareness 35+) (community idea, unvalidated), joined to what stability evidence actually exists: continuous type-scale scores are moderately stable (test\u2013retest \u2248 .61\u2013.75; Randall et al. 2017) (established science); categorical type assignments churn on retest (McCarley & Carskadon 1983, via Pittenger 2005; the MBTI's own manual reports roughly a third of retakers change type) (established science); and function-*order* stability on the Sakinorva instrument has never been measured at all ; its author informally reports results change on retake [D ; anecdote].

**Reading.** The profile is a photograph of current engagement, not an essence. Tier boundaries move: gaps narrow with deliberate practice and supportive environments, widen in environments that punish a function. Age-conditioning (Mindstack hypothesis), offered tentatively: a cliff at 22 is most parsimoniously simple non-development : that channel hasn't been needed yet; the same cliff at 50 raises the avoidance and suppression hypotheses ; but the report holds all three (02 S7) and lets the user adjudicate.

**Language rule.** "Currently," "lately," "this season" : never "you are." Recommend retesting after major life changes; interpret band-level shifts, never rank churn inside the noise band.


<!-- source: 04-situational-conditioning.md (worked examples stripped) -->

# 04 \xB7 Situational Conditioning: The Friction Map

**Epistemic legend**: (established science) established science \xB7 (community idea, unvalidated) derived from typology-community sources (attributed, unvalidated) \xB7 (Mindstack hypothesis) Mindstack hypothesis: plausible, speculative, offered for testing against lived experience.

## Why Mindstack conditions on situation

Two findings anchor this component, and they are the best-grounded material in the whole knowledge base. Fleeson (2001) showed through experience sampling that the typical person expresses nearly the full range of every trait across ordinary weeks ; while each person's *distribution* of states stays highly stable. Mischel & Shoda (1995, CAPS) formalized the complement: the stable core of personality is not a context-free average but a repertoire of **if-then situation-behavior signatures**: "if situation X, then response Y" ; that stay consistent even while average behavior varies. (established science)

The consequence for report generation: a stack signature read *without* situational context can only produce averages, and averages are where horoscopes live. The friction map is Mindstack's CAPS layer. It takes a situational description of the user's current situation, estimates which functions the situation **demands**, compares that against what the profile readily **supplies** (the engagement tiers), and emits if-then signatures. The if-then *form* is (established science); the claim that situations demand specific cognitive functions ; and every mapping below ; is (Mindstack hypothesis): our own construction, never validated, and the report generator must hedge accordingly.

## a. The situational intake schema

Six short questions. Each feeds specific machinery downstream (noted in italics).

- **WHO : relational field.** "Who is in this with you, and what do they expect of you? (alone / one familiar person / small team / strangers / an evaluator or authority)" *Feeds interpersonal demand types and the evaluative-audience modifier.*
- **WHAT : task type.** "What must you actually produce or handle? One sentence." *Feeds the primary demand classification (\xA7b).*
- **WHEN : timeframe and pressure.** "How much time is there, and who set the clock? (open-ended / self-imposed / hard external deadline / unfolding in real time)" *Feeds closure demands and the sustained-duration modifier.*
- **WHERE : setting and constraints.** "Where does this happen ; and can you leave, pause, or reshape the setting?" *Feeds sensory demands and the no-exit modifier.*
- **WHY : stakes and motivation.** "What happens if it goes badly? Do you personally care, or is the pressure external?" *Feeds the stress-load modifier and value-arbitration demands.*
- **HOW : methods and autonomy.** "Can you choose your own method and pace, or must you follow someone else's procedure and tools?" *Feeds procedural demands and the low-autonomy modifier.*

## b. The demand taxonomy (Mindstack hypothesis)

A **demand profile** is the weighted set of function-demands extracted from one intake. Most situations carry two to four demands; the top-weighted demand drives the headline classification, the rest are named as secondary. Every mapping below cross-references the per-function demand cues in 01 ; the rationale column states *why* the situation rewards that function's operation, because a mapping without a rationale is unfalsifiable decoration.

| # | Demand type | Demands | Rationale (Mindstack hypothesis) | Typical intake cues |
|---|---|---|---|---|
| 1 | Open-ended ideation | Ne | Generating unprejudged alternatives; success = breadth | WHAT = "come up with options"; HOW = free |
| 2 | Long-horizon synthesis | Ni | Converging scattered signals into one trajectory or purpose | WHAT = "figure out where this is going"; WHEN = open |
| 3 | Real-time responsiveness | Se | Acting on a live scene as it changes; success = presence and speed | WHEN = real time; WHERE = physical |
| 4 | Procedural reliability | Si | Repeating a proven sequence exactly; error = deviation from precedent | HOW = fixed procedure; WHAT = maintenance |
| 5 | Precision systems analysis | Ti | Building or debugging an internally consistent model | WHAT = "why is this broken / is this correct" |
| 6 | Resource mobilization | Te | Sequencing people, time, tools toward measurable delivery | WHEN = deadline; WHAT = deliverable |
| 7 | Value arbitration | Fi | Deciding what one can personally stand behind when criteria conflict | WHY = personally charged; WHAT = ethical call |
| 8 | Group-atmosphere maintenance | Fe | Tracking and tending the shared emotional field | WHO = group, especially with tension |
| 9 | Emotional first response | Fe (Fi secondary) | Immediate attunement to a distressed person | WHO = someone upset, now |
| 10 | Ambiguity holding | Ne/Ni | Staying open without premature closure | WHAT = unresolved; WHEN = "too early to decide" |
| 11 | Closure under deadline | Te/Fe | Publicly committing to a decision on schedule | WHEN = hard deadline; WHO = waiting audience |
| 12 | Interruption multiplexing | Se/Ne | Many external pings; continuous reprioritization | WHERE = open/shared setting; WHEN = fragmented |
| 13 | Solitary depth work | Introverted battery (weighted by attitude tilt) | Long unbroken inward focus; costs scale with an extraverted tilt | WHO = alone; WHERE = private; WHEN = open |

Barnum check: each row must be able to *fail* to apply. Row 8 is a real demand for a wedding coordinator and absent for a lighthouse keeper; a report that finds every demand in every situation is broken.

## c. The friction classification

Computable from the engagement tiers of the profile plus the demand profile:

- **Flow** : the demanded function sits in the **lead cluster**. Predict low-effort competence. Flow is not praise: repeated flow situations that never demand the opposite attitude feed closed circuits (see 03), so flow reports must name what the situation *isn't* exercising.
- **Stretch** : the demanded function sits in the **support band** (**near-flow**: reliable, mildly effortful) or **reserve band** (workable with scaffolding; quality is the first casualty of fatigue).
- **Friction** : the demanded function sits on the **shadow floor**, or isolated below a **cliff**. Predict **workaround substitution**: a lead or support function stands in for the demanded one (analysis where attunement was asked for, procedure where improvisation was) : sometimes passable, characteristically off-target.
- **Eruption risk** : friction plus escalating context. Predict the demanded shadow function ; especially an axis partner of a lead function ; surfacing in crude, immature form under depletion (per 03's eruption expressions). [D ; Quenk's grip concept via mbti-notes, generalized \u2192 H]

**Escalation modifiers**, read straight off the intake: sustained duration (WHEN), high stakes/stress (WHY), no-exit (WHERE), low autonomy (HOW), evaluative audience (WHO). Working rule for the generator: friction + \u22652 modifiers \u2192 flag eruption risk; friction + 4\u20135 \u2192 flag it prominently and name early-warning signs. The threshold is a calibration guess (Mindstack hypothesis), not a finding.

## d. If-then signature templates

The output grammar. One canonical template, non-negotiable:

> **When** [situational feature], **you likely** [specific, observable prediction]; **if instead you find** [counter-observation], **that would tell us** [revision : which tier assignment or demand mapping to update].

Generator rules:

1. **No falsifier, no signature.** The third clause is what separates a hypothesis from a horoscope; it also operationalizes "the person is the authority."
2. **Predictions must differentiate.** A different profile must get a different sentence. Contrast framing is encouraged: "unlike a profile where Fe sits in the support band\u2026"
3. **At least one signature per scenario states a cost or trade-off.** LLM sycophancy is documented (Sharma et al. 2024); this rule is the structural counterweight.
4. **Snapshot language only**: "currently," "lately," "in situations like this" : never "you are."
5. **Tier inheritance**: a signature's hedging follows the lowest tier in its chain. If-then form (established science) + function mapping (Mindstack hypothesis) = the sentence is presented as "one hypothesis to test."

## f. State vs trait honesty

The profile is a **development snapshot**: a photograph of current engagement, not an essence. Fleeson's density-distribution work cuts both ways and the reports must honor both edges. (established science)

First: the person *is* the whole distribution, not its mean. The same profile genuinely reads differently under a different situation ; that is not a bug in the friction map, it is the finding that justifies the friction map's existence. A report that describes someone "in general" is describing nobody in particular; a report conditioned on a stated situation can be specifically right and specifically wrong, which is the only way to be informative.

Second: distributions move. Sustained changes in the situations a person inhabits ; a new job, a new role, deliberate practice ; shift the distribution of states, and with it, eventually, what a retest would measure [S ; Fleeson & Jayawickreme 2015]. So the friction map's forecasts decay: a friction verdict is "currently expensive," never "permanently yours." The generator must date its claims, invite retests after major life changes in the user's life, and treat every falsifier a user confirms as data that updates the profile ; because on every tier of this system, the person's lived experience outranks the map.

*Conceptual credits: the engagement-state reading of loops and grips derives from mbti-notes.tumblr.com and Naomi Quenk's grip concept (community idea, unvalidated); the situational architecture from Mischel & Shoda (1995) and Fleeson (2001, 2015) (established science); all situation-to-function mappings are Mindstack's own unvalidated hypotheses (Mindstack hypothesis).*


<!-- source: 06-foundations-digest.md -->

<!-- 06 \xB7 Foundations Digest ; a source-faithful synthesis of the mbti-notes.tumblr.com Fundamentals, Function-Theory, Development, and Type-Spotting guides plus Naomi Quenk's grip, distilled into the mechanics the report generator reasons WITH. Background reference for the generator, not content to emit verbatim into a report. Legend: established science (cited), community idea (unvalidated), community idea generalized by Mindstack, Mindstack hypothesis. -->

# 06 \xB7 Foundations Digest

**Epistemic legend:** (established science) established science (cited) \xB7 (community idea, unvalidated) typology-community material (mbti-notes.tumblr.com guides; Naomi Quenk's grip) ; attributed, unvalidated \xB7 (community idea, generalized by Mindstack) a (community idea, unvalidated) concept generalized by Mindstack beyond its home theory ; hedged as (Mindstack hypothesis), attributed as (community idea, unvalidated) \xB7 (Mindstack hypothesis) Mindstack hypothesis, speculative. Geometric terms (lead cluster, counterweight, closed circuit, shadow floor, cliff, tilt, axis polarization, supply grade) are owned by [02](02-profile-geometry.md) and used here by name only. This file adds no geometry.

## What this digest adds

Documents [00](00-overview.md)\u2013[04](04-situational-conditioning.md) already carry the geometry and the re-keyed loop/grip machinery. This file is the layer beneath them: the community theory *as the sources actually state it*, kept specific, so the generator reasons with real mechanisms instead of vague gestures. It captures the net-new nuance ; felt texture, trigger conditions, false payoffs, per-function behavioral signatures, the maturity axis, development levers, axis tensions, the specific ways a real profile looks "off" ; and, for each, the concrete behavioral pattern, blind spot, stress sign, or growth lever it licenses. Every claim stays (community idea, unvalidated)/(community idea, generalized by Mindstack)/(Mindstack hypothesis); the type-dynamics claims here ; loops, grips, and fixed dom-aux-tert-inf stacks ; have no peer-reviewed support (see [03 \xA70](03-engagement-dynamics.md); Reynierse 2009 rejects type dynamics wholesale), leaving the separately-cited (established science) items (the Loevinger ego-development ladder, the E/I processing biology) untouched.

---

## 1 \xB7 Magnitude is engagement, never amount

The Fundamentals guide draws a hard line: Jungian type is a **category** theory, not a **trait** theory. A trait scale measures how *much* of something you have; a type score only sorts which of two opposing processes runs more naturally. So a higher score never means "more of it," better, more skilled, more mature, or more desirable ; creativity and intelligence sit outside the framework (community idea, unvalidated). Mindstack makes a **considered departure**: it reads magnitudes, gaps, and tiers deliberately as engagement geometry, reintroducing the "middle" the source denies : while inheriting intact the prohibition on magnitude-as-worth. The generator therefore voices every number as **current engagement intensity or frequency ; how often and how automatically a mode is reached for ; never as trait quantity, ability, maturity, or virtue** (community idea, generalized by Mindstack). This is the origin of 02's elevation \u2260 ability and 02 S1's investment \u2260 quality.

The phenomenology underneath the supply grades ([02 \xA72.1](02-profile-geometry.md)): "dominant" means used *most often* **and** *most effortlessly*, together. A natural process feels like being authentically oneself; the opposing, less-dominant one feels **foreign**, effortful, and ; sustained ; produces existential discomfort, even while it stays available on demand (community idea, unvalidated). This is the texture that makes friction concrete: a lead/flow function is *the effortless first reach that feels like you*; a shadow/friction function is *available but costly and self-alien*, so forcing it reads like wearing something borrowed. The source adds a self-regulation mechanic: each attitude restores its own equilibrium ; introvert too long turns restless and must extravert to rebalance, and vice versa [D ; presented as a biological self-regulation mechanic but uncited; treat as unvalidated, not established]. A sealed **closed circuit** ([03 \xA71\u20132](03-engagement-dynamics.md)) is exactly the failure of this switch: a single-attitude lead cannot take the cheap attitude-flip that would rebalance, so the starved side stays starved.

### Attitude as processing metabolism

Attitude is processing metabolism and stimulation tolerance/pacing, not sociability (community idea, unvalidated). The Fundamentals guide specifies: extraversion = information flows outward first ("think out loud," energized by interaction, breadth), introversion = information flows inward first ("think before speaking," energized by solitude, depth). Both require the other for balance. Biological research supports differential cortical arousal : introverts have higher baseline cortical arousal and seek lower stimulation; extraverts have lower baseline and seek higher [S ; cited in the Fundamentals guide via Eysenck's arousal theory]. The generator should never reduce this to "social vs. antisocial"; it is about **where processing begins and what replenishes the mental energy budget**.

---

## 2 \xB7 Read the motive, not the behavior : the why-ladder

The guides' founding rule: type lives in **cognition** (the perceptual/evaluative process), not behavior (its outward manifestation); identical surface behavior springs from different functions, so no single act is diagnostic [D : stated as type theory; the cognition/behavior distinction itself is (established science)]. Same-category functions look alike because they share a goal but reach it oppositely. The decomposition tables split one flat trait into eight motives (community idea, unvalidated):

| Trait label | Si motive | Ni motive | Se motive | Ne motive | Ti motive | Fi motive | Te motive | Fe motive |
|---|---|---|---|---|---|---|---|---|
| "lazy" | won't leave comfort zone | no meaningful purpose | only wants fun | distracted by ideas | sees no benefit | doesn't feel like it | fine with status quo | won't be praised |
| "rebellious" | routine was disrupted | plan was derailed | restless/bored | constraints feel oppressive | logic was violated | values were violated | system is inefficient | harmony was broken |
| "controlling" | fear of instability | fear of wrong path | fear of losing edge | fear of missing out | fear of error | fear of inauthenticity | fear of incompetence | fear of disconnection |

**The why-ladder method:** given a behavior the user reports, never restate the trait; select the *motive whose function the measured tiers actually place where that motive requires*, and write the mechanism (which function, toward which goal, produced the act). This is the parent of Mindstack's demand-cue "why" framing and its specificity floor (situation \u2192 response, never adjectival).

### Primitive instincts and reactivities

Two compact vocabularies feed the why-ladder (community idea, unvalidated):

**Primitive instinct** : the raw drive each function runs on when unconscious (the drive under a lead, a handle for a floor on instinct):

| Function | Primitive instinct | Common childhood manifestation |
|---|---|---|
| Si | familiarity | cautious, fastidious |
| Ni | predictability | perceptive, inquisitive |
| Ti | capability | technical, dissecting |
| Fi | congruency | passionate, opinionated |
| Se | stimulation | receptive, adventurous |
| Ne | inspiration | curious, fanciful |
| Te | structure | sensible, responsible |
| Fe | amicability | amiable, communicative |

**Function reactivity**: what each function bristles at when engaged, predicting what irritates the person and which traits *in others* they judge (concrete and falsifiable):

| Function | Positive reactivity (seeks) | Negative reactivity (bristles at) |
|---|---|---|
| Se | novelty, immediacy, engagement | tedium, cowardice, passivity |
| Ne | possibility, innovation, breadth | monotony, narrow-mindedness, stagnation |
| Te | efficiency, results, accountability | disorder, weakness, laziness |
| Fe | harmony, connection, belonging | contention, selfishness, exclusion |
| Si | stability, precision, continuity | disruption, unreliability, carelessness |
| Ni | meaning, direction, depth | pointlessness, short-sightedness, superficiality |
| Ti | accuracy, independence, mastery | confusion, irrationality, incompetence |
| Fi | authenticity, integrity, fairness | injustice, callousness, hypocrisy |

Keyed to a lead (a polarized high pole intensifies its reactivities), this predicts what triggers the person; keyed to a floor, it predicts the area of greatest obliviousness or insecurity.

---

## 3 \xB7 The eight cognitive functions ; behavioral landscape

The generator needs concrete per-function texture to voice what a lead, mid-range, or floor function *looks like in life*. Below is the source material's own characterization, organized for report use [D throughout].

### Perceiving functions

**Si (introverted sensing)**: orients to accumulated internal impressions; compares present experience against a detailed internal library of past experience. Strong Si: methodical, reliable, conscientious, learns by building incrementally on proven knowledge, notices when something deviates from established patterns, values stability and routine as a foundation for competence. Weak Si: difficulty with details, poor memory for procedures, stretches too thin, ignores bodily needs, repeats mistakes from not reviewing what went wrong, takes established gains for granted. Assessment signature: careful sequential learners who want to understand the "right way" before acting; resist change until convinced the new way is genuinely better; strong sense of what is familiar/unfamiliar. *Not Si-dominant if:* restless for novelty, bored by repetition, prefers improvisation over established methods, treats the past as irrelevant.

**Se (extraverted sensing)**: orients to the immediate concrete environment; gathers real-time sensory data and responds to what is present *now*. Strong Se: alert, adaptive, hands-on, realistic, reads the room instantly, thrives in dynamic environments, engages fully with physical reality. Weak Se: absent-minded about surroundings, poor situational awareness, struggles to "just do it," defers action indefinitely, misses opportunities that require quick response. Assessment signature: learns best through direct experience and trial-and-error; happiest when actively engaged; may grow restless sitting still. *Not Se-dominant if:* prefers theory to practice, avoids physical engagement, needs extensive planning before acting, lives primarily in imagination.

**Ni (introverted intuition)**: synthesizes patterns below conscious awareness into a singular vision or "knowing"; converges scattered data into one deep insight. Strong Ni: foresightful, strategic, reads implications behind surface events, can visualize long-term trajectories, driven by a sense of purpose. Weak Ni: poor long-range planning, difficulty reading between the lines, takes everything at face value, no sense of direction or purpose, lives reactively. Assessment signature: drawn to understand *why* things happen and *where* they lead; synthesizes information unconsciously and arrives at conclusions they struggle to explain step-by-step; motivated by meaning and significance. *Not Ni-dominant if:* thinks only about immediate needs, never questions the deeper meaning, comfortable accepting things at face value, has no interest in predicting outcomes.

**Ne (extraverted intuition)**: generates possibilities from external stimuli; sees connections between seemingly unrelated things; proliferates options. Strong Ne: inventive, optimistic, adaptable, sees potential everywhere, generates ideas rapidly, comfortable with ambiguity and open-ended exploration. Weak Ne: stuck in familiar patterns, pessimistic about change, can't imagine alternatives, fearful of "what if," treats the status quo as the only option, resigned. Assessment signature: energized by brainstorming and exploring new ideas; may start many projects; talks in tangents and associations; bored by routine. *Not Ne-dominant if:* prefers proven methods, suspicious of novelty, cannot generate alternatives easily, takes things literally.

### Judging functions

**Ti (introverted thinking)**: builds internal logical frameworks; evaluates consistency and accuracy against personal models. Strong Ti: precise, analytical, independent in reasoning, spots logical flaws, values understanding the mechanism behind things. Weak Ti: difficulty evaluating information independently, accepts claims uncritically, can't distinguish good arguments from bad, goes in logical circles, avoids self-critique. Assessment signature: needs to understand *how* and *why* something works, not just *that* it works; will reject a popular opinion if it doesn't hold up logically; may appear detached or slow to decide because still analyzing. *Not Ti-dominant if:* defers to authority/consensus without checking the logic, comfortable with logical inconsistencies, uninterested in how things work.

**Te (extraverted thinking)**: organizes the external world for efficiency and results; implements plans, sets standards, measures outcomes. Strong Te: decisive, organized, results-oriented, builds systems that work, takes responsibility, corrects course quickly when data shows problems. Weak Te: disorganized, indecisive, poor follow-through, can't structure tasks or set goals, avoids taking charge, gets overwhelmed by practical demands. Assessment signature: judges actions by their results; naturally creates order and structure; uncomfortable with ambiguity that prevents action; may seem blunt because efficiency trumps diplomacy. *Not Te-dominant if:* unbothered by disorder, has no interest in measurable outcomes, avoids leadership or accountability, prioritizes feelings over results.

**Fi (introverted feeling)**: evaluates against deeply held personal values; maintains internal emotional authenticity. Strong Fi: principled, empathetic through felt experience, strong sense of personal identity, acts with integrity even against social pressure. Weak Fi: disconnected from own feelings, acts against own values for external rewards, poor emotional self-care, unaware of personal boundaries until breakdown, harsh toward vulnerability in self and others. Assessment signature: makes decisions by consulting an internal "moral compass"; deeply affected by authenticity and inauthenticity; may appear quiet but holds intense convictions; would rather suffer consequences than betray a core value. *Not Fi-dominant if:* easily changes values to fit the group, unbothered by inauthenticity, never consults inner feelings when deciding, treats all moral positions as equivalent.

**Fe (extraverted feeling)**: reads and manages the emotional field of the interpersonal environment; creates harmony, connection, shared values. Strong Fe: warm, inclusive, emotionally attuned to others, builds rapport easily, creates belonging, manages group dynamics. Weak Fe: oblivious to social cues, accidentally offensive, difficulty connecting emotionally, lonely, can't read the room, surprised when people react negatively. Assessment signature: naturally monitors how people feel; adjusts behavior to maintain relational harmony; energized by emotional exchange; uncomfortable when someone in the group is excluded or upset. *Not Fe-dominant if:* indifferent to group mood, unbothered by conflict, doesn't adjust behavior for social context, treats emotions as irrelevant data.

### Using function descriptions in reports

The generator should use these signatures to voice what high engagement *feels like* (for leads) and what low engagement *costs* (for floors and cliffs). The "not X-dominant" lists are anti-Barnum guards ; if the measured lead contradicts these, consider counterfeit fluency or environmental conditioning rather than trusting the number blindly.

---

## 4 \xB7 The four axis tensions

Each function exists in an oppositional pair on an axis. The tension between them is not pathological ; it is the **engine of development**. But when one pole dominates unchecked, the opposite starves, producing characteristic life problems (community idea, unvalidated).

**Si\u2013Ne axis (stability \u2194 possibility):**
- Si wants stability and security \u2192 unchecked, falls into stagnation and closed-mindedness as Ne shuts down
- Ne wants novelty and inspiration \u2192 unchecked, tramples everything sacred to reach greener pastures as Si shuts down
- Developmental consequence: Si-heavy people struggle with "what could be" and resist beneficial change; Ne-heavy people can't finish what they start and ignore practical reality. Healthy resolution: Si grounds Ne's ideas in reality; Ne prevents Si from calcifying.

**Ni\u2013Se axis (depth \u2194 presence):**
- Ni wants purpose and direction \u2192 unchecked, loses presence and defers happiness to the future as Se shuts down
- Se wants engagement and immediacy \u2192 unchecked, chases fleeting pleasure and loses direction as Ni shuts down
- Developmental consequence: Ni-heavy people live in their heads and miss life happening now; Se-heavy people live reactively without building toward anything. Healthy resolution: Ni gives Se's actions meaning; Se keeps Ni's visions grounded in real-world feedback.

**Ti\u2013Fe axis (independence \u2194 connection):**
- Ti wants independence and self-sufficiency \u2192 unchecked, becomes too detached and indifferent as Fe shuts down
- Fe wants harmony and connection \u2192 unchecked, becomes too easily threatened by disharmony and loses self as Ti shuts down
- Developmental consequence: Ti-heavy people alienate others through coldness; Fe-heavy people lose themselves in others' needs. Healthy resolution: Ti gives Fe objectivity to not be consumed by emotions; Fe gives Ti the human stakes that make analysis worthwhile.

**Fi\u2013Te axis (integrity \u2194 effectiveness):**
- Fi wants integrity and self-determination \u2192 unchecked, becomes ineffective and withdrawn from the world as Te shuts down
- Te wants efficiency and order \u2192 unchecked, treats the world as a machine and loses humanity as Fi shuts down
- Developmental consequence: Fi-heavy people know what they believe but can't accomplish it; Te-heavy people accomplish goals that turn out to be hollow. Healthy resolution: Fi gives Te moral direction; Te gives Fi the tools to actualize its values.

**Report use:** When the geometry shows a polarized axis (one pole high, its partner starved), the axis tension tells the generator which *life problem* to describe ; the specific cost of that imbalance. The healthy resolution pattern feeds the growth section. The generator should never frame axis tension as a defect; it is the natural developmental challenge of that particular axis.

---

## 5 \xB7 Maturity is a second axis the eight scores cannot see

The Development and Function-Theory guides state it flatly: **stack height indicates reliance/influence only, not how mature or well-developed a function's use is** (community idea, unvalidated). Development is not automatic; a heavily-relied-on function can be crude, a low one merely undeveloped. Sakinorva measures the reliance axis; **maturity is a separate axis Mindstack cannot compute from eight numbers** (community idea, generalized by Mindstack). This is the warrant behind 02's engagement-tiers and the "photograph, not an essence" framing : the generator may render a high-scoring lead as reliably-but-immaturely used (over-reliance, blind reflexive deployment) as readily as mature, and a floor as non-development rather than incapacity.

### Per-function maturity spectrum

Each function expresses across a six-rung ladder ; **destructive \u2192 unhealthy \u2192 immature \u2192 weak \u2192 healthy \u2192 optimal** (community idea, unvalidated). The ladder is independent of stack position: a dominant can be destructive, a tertiary can be healthy. The generator should offer the range as a self-locating question, never pin the user to a rung.

**Si maturity rungs:**
- Destructive: defined by worst past experiences; resigned to being that person forever
- Unhealthy: imprisoned in habits, rituals, routines; cannot venture beyond touchstones
- Immature: insecure fussing over rules and details from fear of destabilization
- Weak: difficulty learning; misses important details, rules, procedures, good advice
- Healthy: focused, realistic, conscientious; does things properly through care and method
- Optimal: hard-won expertise handles most situations; welcomes new challenges to expand knowledge

**Se maturity rungs:**
- Destructive: does whatever feels good, consequences be damned
- Unhealthy: poor focus/direction from constant diversion into trivial indulgences
- Immature: hasty and reckless from FOMO or fear of being blindsided
- Weak: apathetic, absent-minded; poor response to surroundings until forced
- Healthy: fully present, actively engaged, enthusiastic about learning and exploring
- Optimal: makes the most of what comes; appreciates that time is limited and opportunities rare

**Ni maturity rungs:**
- Destructive: superimposes beliefs onto the world; gut feelings treated as fundamental truths without evidence
- Unhealthy: can only see what is lacking/wrong; rendered impotent or cynical
- Immature: avoidant from fear of not living up to imagined ideals
- Weak: difficulty making wise decisions; no clear vision of future self
- Healthy: prioritizes well, sets meaningful long-term goals, possesses good focus toward aspirations
- Optimal: hard-won depth of insight; accurately visualizes future potential and derives purpose from actualizing it

**Ne maturity rungs:**
- Destructive: uses imagination to weasel out of work and responsibility; sabotages own growth
- Unhealthy: easily lost in fantasy; wastes time on absurd ideas that lead nowhere
- Immature: erratic from fear of boredom/smallness; careless and impractical decisions
- Weak: difficulty improving life; can't envision doing things differently
- Healthy: dreams big but carries out good ideas; works creatively within constraints
- Optimal: innovative; catalyzes positive trends by uplifting people and opening new possibilities

**Ti maturity rungs:**
- Destructive: uses knowledge unethically; answers only to self
- Unhealthy: believes self right while drawing wrong conclusions; makes up "logical" excuses
- Immature: hypercritical from insecurity; driven to prove intelligence
- Weak: can't form accurate judgments independently; doesn't assess facts systematically
- Healthy: evaluates strengths and weaknesses impartially; corrects thinking that gets poor results
- Optimal: clarity of judgment; builds accurate mental models for flexible, strategic problem-solving

**Fi maturity rungs:**
- Destructive: imprisoned by negative feelings and misguided value judgments
- Unhealthy: does whatever avoids feeling bad
- Immature: insecure and unstable; must follow every emotional urge to avoid losing self
- Weak: difficulty promoting emotional well-being; neglects feelings and values in decisions
- Healthy: reliable moral instincts channel identity, feelings, values into fruitful activities
- Optimal: deep empathy for suffering; works to ensure every person can be authentically themselves

**Te maturity rungs:**
- Destructive: abuses power/position; believes the weak deserve what they get
- Unhealthy: blames problems on others' incompetence
- Immature: insecure and controlling from fear of ambiguity, powerlessness, or inadequacy
- Weak: can't organize life; difficulty structuring thoughts, setting goals, planning activities
- Healthy: reaches goals efficiently; strategic in action, learns quickly from mistakes
- Optimal: competent leader and good role model; knows the right approach to achievement

**Fe maturity rungs:**
- Destructive: exploits people's feelings and vulnerabilities; disregards social impact
- Unhealthy: never at fault; always someone/something else getting in the way
- Immature: oversensitive; can't draw emotional boundaries; understands others only through how they validate self
- Weak: difficulty connecting emotionally; oblivious to others' needs until blindsided
- Healthy: treats people objectively; makes positive contributions to mutually beneficial relationships
- Optimal: genuine compassion; fosters equality, warmth, connection, and belonging

**The "weak" rung is the best plain description of a floor**, per function : directly usable for blind-spot passages. Because score is reliance and the ladder is maturity, **a score never locates a person on the ladder** : offer the rungs as options to self-locate ("your Te could run anywhere from insecure-and-controlling to hard-won competence"), never "high score = optimal rung."

---

## 6 \xB7 Ego development ; the universal maturity ladder

The Development guide adds a Loevinger-linked **ego-development level** (L1\u2013L7) orthogonal to type, explaining why a 20- and a 50-year-old of the same apparent type differ enormously [D ; the Loevinger 1976 ego-development ladder is empirically grounded; the mapping of *functions* onto it is (community idea, unvalidated)]. The generator **must never assert a detected level** : unscoreable from eight numbers ; but may hold it as a **self-locating fork**.

### Phase I: Ego Formation (L1\u2013L3) : egocentric

Characterized by egocentrism: using one's own experience as the starting point for understanding the world. Not narcissism ; ignorance of how limited one's perspective is. In Phase I, ego defenses are strong and function development is constrained by self-protection (community idea, unvalidated).

**L1 \xB7 Self-Protection mindset:** Main motivation is ego protection and self-interest. Easily triggered into fight/flight by negative feelings. Preoccupied with avoiding discomfort, loss, pain. Self-concept = "strength" + hide "weakness." Uses control/power to avoid vulnerability. Treats people with mistrust and blame. Relationships are domination/submission. Thinks in "me vs. world." In function terms: misuses all functions in messy defense against ego threats. Growth lever: resolve underlying fear and mistrust.

**L2 \xB7 Social Identification mindset:** Main motivation is group acceptance. Easily triggered by disapproval/rejection. Self-concept = "acceptability" + hide "shame." Only trusting with in-group. Uses social appearances for praise and status. In function terms: uses functions narrowly, only the most obvious strengths as social rules allow. Growth lever: realize the difference between public and private life.

**L3 \xB7 Selfhood mindset (where most adults sit):** Main motivation is maintaining personal space. Easily triggered by feelings of oppression. Self-concept revolves around personal beliefs/values. Uses social comparison to feel unique. In function terms: understands dominant function strengths but over-relies on them; shows auxiliary problems when self-concept is challenged; loops when invalidated; grips under stress. Re-keyed onto measured geometry: a **lead cluster** leaned on hard while its **opposite-attitude counterweight** buckles when the self-concept is challenged. Growth lever: understand that personal beliefs can be limiting and should change when they interfere with growth.

### Transition: L4 \xB7 Conscientious mindset

Potential turning point : starts recognizing egocentrism as a limitation. More likely to take personal responsibility. Better able to choose healthier methods for handling conflicts. Recognizes own "strengths" and "weaknesses" (earlier mindsets resist confronting flaws). In function terms: more likely to recognize and correct the lead's flaws, which opens the door for significant auxiliary growth. Growth lever: understand there is more to life than personal competence in obtaining worldly achievements.

### Phase II: Release from Ego (L5\u2013L7)

Overcoming egocentrism through recognizing the boundary between subjective and objective. Ego fears subside \u2192 mental energy freed for deeper understanding. Generally not reached until mid-adulthood; many people never reach it (community idea, unvalidated).

**L5 \xB7 Self-Insight mindset:** Main motivation is working through difficulties. Pays close attention to conflictedness. Self-concept is positive and malleable. Uses deep introspection to understand motivation. Appreciates true individuality in relationships. In function terms: becomes less defensive of ego; more aware of lower functions and their misuse for ego defense; desires to optimize dom/aux and learn proper tertiary use. Expresses personality traits positively and selflessly.

**L6 \xB7 Authenticity mindset:** Main motivation is meaningful fulfillment. Deep understanding and acceptance of all feelings. Recognizes interdependence with the world. In function terms: sophisticated aux-tert relationship opens a bridge to the inferior; no longer displays development defensiveness or unhealthy defense mechanisms.

**L7 \xB7 Wholeness mindset:** Transcendence of ego conflict. Integration of opposites grants wisdom. Self-concept continuously open to new growth. Very few people achieve this.

**Report use:** Hold levels as a **self-locating fork over the measured geometry** : the low-vs-high bracket most adult readers fall inside ; between L1 (fear-driven misuse of all functions) and L4+ (recognizes and corrects the lead's flaws). The generator should present ego development as a framing lens ("where you are on this spectrum shapes how your geometry plays out"), never a diagnosis.

---

## 7 \xB7 Development obstacles and ego defense mechanisms

The sources catalog specific obstacles to function development (community idea, unvalidated), useful for the generator when interpreting why a profile may look underdeveloped or contradictory:

- **Mental disorder:** Neurological conditions require separate treatment before self-development work is effective
- **Environmental pressures:** Gender expectations, social/familial roles, socioeconomic stress force reliance on unnatural functions \u2192 "a cheap and unhappy imitation"
- **Low self-regard:** Minority types in their population may overcompensate or wear introversion/extraversion as a badge rather than developing naturally
- **Lack of social acceptance:** Parental/peer blocking of natural type expression forces suppression : children who can't express true type develop self-esteem wounds
- **Lack of opportunity:** Environment doesn't provide situations for exercising type preferences \u2192 chronic frustration
- **Lack of incentive:** No challenges to stretch capabilities \u2192 comfort zone stagnation

### Ego defense mechanisms

The primary internal obstacle is **ego defensiveness** : the ego instinctively protects itself when "being wrong" feels existentially threatening. Defense mechanisms are survival strategies that become automatic and unconscious (community idea, unvalidated). Examples:

- **Resignation** (common with Ne resistance): pretending there's nothing better to hope for; self-fulfilling prophecy that prevents advancement
- **Denial of flaws** (common with Ti resistance): making "logical" excuses to avoid admitting mistakes
- **Suppression of feelings** (common with Fi resistance): treating sensitivity as weakness; wearing a mask of invulnerability
- **Social performance** (common with Fe resistance): maintaining control of all interactions to prevent genuine emotional exposure

The pattern: **resistance against function development manifests as counterproductive or self-sabotaging behavior** (community idea, unvalidated):
- Resisting Si: "screw the details" \u2192 repeated mistakes
- Resisting Ne: "it's impossible" \u2192 unfulfilled dreams
- Resisting Ni: "don't overthink it" \u2192 giant messes
- Resisting Se: "not today" \u2192 wasted life
- Resisting Ti: "can't be negative" \u2192 can't improve
- Resisting Fe: "people suck" \u2192 lonely and isolated
- Resisting Fi: "can't be weak" \u2192 harsh and unforgiving
- Resisting Te: "screw the system" \u2192 can't succeed

**Report use:** When a floor function or starved axis pole shows extreme low engagement, the resistance patterns above give the generator concrete language for what the cost of avoidance *looks like*. The defense mechanism frame also explains why a person might score low on a function they're actually capable of ; avoidance is not the same as inability.

---

## 8 \xB7 Development levers per function

The Development guide provides concrete per-function growth advice (community idea, unvalidated). The generator should draw from these when writing growth sections ; selecting the lever that matches the measured geometry (e.g., if Ne is a floor, the Ne development advice is relevant).

**Si development levers:** (1) Reflect on physical/practical needs and whether they're satisfied. (2) Slow down : grasp and sequence important steps before acting; follow proven procedures patiently. (3) Build good habits for health and well-being; respect bodily rhythms; structure time management.

**Se development levers:** (1) Do more, engage more, participate more : learn through hands-on experience and trial-and-error. (2) Say yes more often; commit to experiences instead of defaulting to "let me think." (3) Be present; express gratitude for what exists now; enjoy simple physical pleasures.

**Ni development levers:** (1) Question why things happen; practice speculative reasoning about where events lead. (2) Reflect on life trajectory : whether current direction allows growth; examine standards for "success." (3) Journal about deep desires and aspirations; look at things from multiple angles; fill knowledge gaps.

**Ne development levers:** (1) Break routines that hold you back; push out of stale comfort zones; seek unconventional perspectives. (2) Challenge yourself to improvise; brainstorm many ideas before defaulting to the old way. (3) Nurture creative skills; examine past mistakes for how to do better; brainstorm multiple paths forward.

**Ti development levers:** (1) Step back and use pro/con or cost/benefit analysis; remove bias by being transparent about personal stakes. (2) Ensure you have all facts before assuming; plug gaps in knowledge with proper learning; study logical fallacies. (3) Reflect on whether beliefs lead to coherent decisions; drop distorted or outdated ideas; learn from mistakes by assessing root cause.

**Fi development levers:** (1) Listen to feelings : where are they coming from, what are they telling you? Don't brush aside strong reactions. (2) Reflect on whether values result in decisions that make the world better; ask whether you're being true to who you really are. (3) Improve emotional awareness; build vocabulary for expressing feelings accurately; don't let negative feelings fester unresolved.

**Te development levers:** (1) Set clear goals, make plans, follow them; break problems into systematic steps. (2) Remove distractions; prioritize to-do lists by importance; schedule breaks for recharging. (3) Take assertive problem-solving approach; figure out exact source of problems and tackle directly; improve critical thinking skills.

**Fe development levers:** (1) Take genuine interest in others' lives; use small acts of caring; be more vulnerable in self-expression. (2) Pay attention to people and how they feel; adopt "the more the merrier" attitude; create positive social atmosphere. (3) Focus on commonalities; treat people as equals; lend a hand without expecting return; learn emotional intelligence and conflict de-escalation.

---

## 9 \xB7 Loops : the closed circuit in its home form

### What the sources say (community idea, unvalidated)

The loop is a defensive alliance. When a person refuses the hard, opposite-attitude growth the **auxiliary** demands, the dominant "teams up" with the same-attitude **tertiary** : running a **closed single-attitude circuit** that skips the balancing auxiliary and drives the person to extreme introversion or extraversion. The vicious cycle: auxiliary use fails or feels uncomfortable \u2192 the loop activates to distance from that failure \u2192 the auxiliary atrophies further through denial \u2192 the loop hardens into habit, "a slow spiral to rock bottom" people are motivated to stay in. Its counterintuitive signature: **the loop feels *more* stable, confident, even "freed"** : ego-syntonic self-deception that protects self-esteem while flaws go unaddressed, using the tertiary "to fool yourself that the auxiliary is to blame" (community idea, unvalidated).

### Per-circuit false payoffs and tells

Each circuit buys a specific **false payoff** and shows a matching outward **tell** (community idea, unvalidated), keyed to the same-attitude function the lead leans on:

**Introverted circuits (dominant + tertiary both introverted):**

| Lead | Tertiary ally | Auxiliary refused | False payoff | Outward tell | Consequence |
|---|---|---|---|---|---|
| Si | Ti or Fi | Fe or Te refused | existential security to excuse stagnation | rumination on past missteps, risk-averse rejection of opportunities | alienated, immobile |
| Ni | Ti or Fi | Fe or Te refused | "seeing-through" insight to avoid commitment | fatalistic readings, paranoia about control | self-defeating, unrealistic |
| Ti | Si or Ni | Se or Ne refused | confidence in being exceptional to deny alienation | performative-intelligence combativeness, blaming others | alienated, failure |
| Fi | Si or Ni | Se or Ne refused | moral imperative to ignore bad results | black-and-white moral absolutes treated as fact | self-defeating, stuck |

**Extraverted circuits (dominant + tertiary both extraverted):**

| Lead | Tertiary ally | Auxiliary refused | False payoff | Outward tell | Consequence |
|---|---|---|---|---|---|
| Se | Te or Fe | Ti or Fi refused | accomplishment via busywork to bury meaninglessness | self-imposed urgency, status-chasing, superficial comparison | dishonorable, reckless |
| Ne | Te or Fe | Ti or Fi refused | control (contentment always "just around the corner") | worst-case catastrophizing, "disaster"-justified meddling | deflecting, erratic |
| Te | Se or Ne | Si or Ni refused | strength/competence to cover self-esteem wounds | revisiting old glories, turning domineering or vindictive | unhealthy habits, controlling |
| Fe | Se or Ne | Si or Ni refused | superiority to deny flaws | charm/humor/praise-fishing to deflect criticism, condescending comparisons | conforming, pointless behavior |

### The auxiliary's actual guidance

The sources spell out what each auxiliary *would* advise if its voice were heard (community idea, unvalidated):

| Dominant flaw | Auxiliary says... | What suppressing the auxiliary costs |
|---|---|---|
| Si inflexible | Fe: open up to new influences | lonesome, uncertain |
| Ni distorted | Te: correct faults and mistakes | irrational, incompetent |
| Ti indifferent | Se: gather new facts/experiences | myopic judgment |
| Fi biased | Ne: explore alternative possibilities | unrealistic judgment |
| Se wild | Fi: honor the right boundaries | (self-)harmful choices |
| Ne scattered | Ti: carefully analyze effects | unintended problems |
| Te controlling | Si: abide by healthier priorities | unhealthy habits |
| Fe conforming | Ni: set more meaningful direction | pointless behavior |

### Auxiliary patterns: resist, overindulge, healthy

The sources describe three modes for auxiliary function engagement (community idea, unvalidated):

**Resistance** : the auxiliary feels threatening because it shares i/e orientation with the inferior, so engaging it feels like moving toward the feared inferior. Manifests as: continued dominant overuse, fragmentation, vulnerability to inferior eruptions. The mental energy that should go to auxiliary growth gets wasted in "self-defense against yourself."

**Overindulgence** : occurs even in healthy development; the person has started using the auxiliary but hasn't established stable control. Usage is unstable and sometimes goes too far, requiring the tertiary to rein it back in (healthy friction, not a loop).

**Healthy development** : the auxiliary provides proper balance to the dominant: if dominant is introverted, auxiliary pulls outward (and vice versa); if dominant perceives, auxiliary judges (and vice versa). Successful reconciliation stabilizes the entire stack and reduces vulnerability to grips.

### Per-function tertiary balance

When development is healthy, the tertiary **balances** the auxiliary rather than colluding with the dominant (community idea, unvalidated):

| Auxiliary excess | Tertiary balance question | Resistance cost |
|---|---|---|
| Fe aux: self-conscious | Ti: Who am I apart from others? | irresolute |
| Te aux: too stringent | Fi: What's wrong with vulnerability? | hardened |
| Se aux: hedonistic | Ni: What are the implications? | reckless |
| Ne aux: random pursuits | Si: Are these ideas productive? | impractical |
| Fi aux: indulgent | Te: Am I accomplishing anything? | flighty |
| Ti aux: arrogant | Fe: Do I cause a negative impact? | antagonistic |
| Si aux: self-limiting | Ne: Am I capable of change? | pessimism |
| Ni aux: tunnel vision | Se: Am I really enjoying life? | humorless |

### Loop mimicry and first-impression caution

Two guards (community idea, unvalidated): a looping function **mimics** the matching dominant with a compensatory tell (charming-but-calculating, commanding-but-desperate), and "your first impression of someone often comes from their tertiary" : the most salient function may be defensive, not core. **Not all same-attitude tension is a loop**: healthy development legitimately uses the tertiary to rein in an over-indulged auxiliary : temporary friction, not denial.

### Re-keyed to geometry (community idea, generalized by Mindstack)

Read the circuit off **attitude geometry**, not a fixed tertiary: a **single-attitude lead cluster** whose **counterweight** sits more than a noise band below the lead (circuit strength > B; sealed only when that gap is cliff-magnitude, > 2B) ; 02 S12's circuit-strength condition, owned by [03 \xA71\u20132](03-engagement-dynamics.md). The condition is *not* a cliff: moderate circuits (B < strength \u2264 2B) fire too. This is a *different* mechanic from 01/02's axis-polarized "over-engaged" state. The mimicry tell re-keys to a **polarized axis** (02 S9): an elevated function whose opposite-pole partner is starved shows the "childish/compensatory" cast. Never reintroduce a fixed 3rd slot.

### How the report uses this

License to describe a coping mode that **feels like winning from the inside while quietly costing reality-contact** : the paradox is what makes the circuit self-perpetuating and hard to self-diagnose. The false-payoff list gives concrete per-circuit content (name the specific false comfort); the auxiliary guidance table gives the voice that's being ignored. The growth lever is reducing resistance to the opposite-attitude counterweight in its own currency ([03](03-engagement-dynamics.md) exit ramps), never the floor directly.

---

## 10 \xB7 Grips ; inferior eruption in its home form

### What the sources say [D ; Quenk via mbti-notes]

Conscious function use costs finite mental energy; it drains under stress, economic pressure, emotional conflict, tough transitions, too many challenges, or plain fatigue. Three trigger routes: (1) depletion of reserves; (2) an environment that devalues the dominant and forces the inferior; (3) pushing the dominant to extremes, creating an extreme dominant\u2013inferior imbalance. The repression is **equal-and-opposite**: the force holding the inferior down is the force with which it snaps back.

### The dominant-inferior elastic band

The dominant and inferior work as though pulling two ends of an elastic band. As the dominant grows in power, the inferior suffers equal repression, producing permanent tension. The "hero's" existence is defined by the "enemy" :  **unconscious fear of the inferior is a major motivating force in life, though people rarely realize it** (community idea, unvalidated). The dominant's natural reaction: build defenses to keep the inferior unconscious.

### Loss-of-lead prelude

**The first symptom is loss of healthy lead quality before any eruption** ([03 \xA75](03-engagement-dynamics.md)); the source spells this loss out by lead family (community idea, unvalidated):

- **Se/Ne leads (extraverted perceiving):** turn distrustful, closed to the world, joyless, blind to opportunity : the openness and spontaneity that defines them goes dark
- **Si/Ni leads (introverted perceiving):** turn irrational about consequences, waste energy, shrink into a private narrative : the steady insight that anchors them destabilizes
- **Te/Fe leads (extraverted judging):** start ignoring objective standards, lose the will to manage problems, feel unsatisfied even by achieved rewards : the outward competence crumbles
- **Ti/Fi leads (introverted judging):** can't reconcile their own needs, can't care for their own well-being, feel pressured by external evaluation : the internal framework they rely on collapses

### Per-function grip symptoms

Then the inferior, nearest the unconscious, is hijacked and erupts **crude, infantile, out-of-character** (community idea, unvalidated):

| Inferior function | Dominant avoids... | Odd quirk (day-to-day trickle) | Full grip eruption |
|---|---|---|---|
| Si (inferior) | stability, conventions | inexplicably fixated on an insignificant detail | regretful rumination; obsessive worry about health, finances, or physical safety; uncharacteristic rigidity about "the right way" |
| Ni (inferior) | implications, meaning | expresses a grandiose or delusional belief | catastrophic predictions; sense of doom; paranoid certainty about hidden meanings that aren't there |
| Ti (inferior) | self-critique, logic | irrationally resistant to owning a flaw/mistake | obsessive search for "the truth"; nitpicking and hostile logic-chopping; feels personally attacked by any inconsistency |
| Fi (inferior) | vulnerability, values | takes an unnecessarily absolute moral stance | hypersensitivity to perceived slights; emotional flooding; withdrawal into victimhood; sudden passionate conviction about things normally not cared about |
| Se (inferior) | factuality, engagement | disproportionate reaction to a minor event | binge behavior (eating, spending, cleaning); destructive sensory overindulgence; reckless physical risk as release |
| Ne (inferior) | change, possibility | expresses a wildly absurd idea/belief | worst-case catastrophizing; paranoia about all the things that could go wrong; frantic, scattered attempts at control |
| Te (inferior) | standards, efficiency | inexplicably cold or aggressive | outbursts of harsh, blunt criticism; compulsive organizing/list-making; sudden obsession with proving competence through measurable results |
| Fe (inferior) | social harmony, connection | grossly misjudges or mistreats people | emotional outbursts disproportionate to the situation; desperate need for affirmation; alternating between cold withdrawal and clumsy emotional flooding |

### Dominant extreme and inferior intrusion patterns

The sources provide a more detailed picture of how dominant overuse creates the inferior intrusion (community idea, unvalidated):

| Dominant | What it avoids (inferior domain) | Dominant extreme | Inferior intrusion |
|---|---|---|---|
| Si | avoids Ne (change) | immobile, stuck | restlessness, catastrophic "what ifs" |
| Ni | avoids Se (factuality) | unrealistic, detached | overreactive to sensory reality |
| Ti | avoids Fe (influence) | insensitive, isolated | alienated, desperate for connection |
| Fi | avoids Te (standards) | helpless, ineffective | hypercritical of self and others |
| Se | avoids Ni (implications) | evasive, never reflecting | hollowness, existential dread |
| Ne | avoids Si (conventions) | overreach, nothing finished | regretful, obsessing over past mistakes |
| Te | avoids Fi (vulnerability) | controlling, ruthless | self-indulgent, emotionally overwhelmed |
| Fe | avoids Ti (criticism) | conforming, self-erasing | resenting, bitter internal critique |

### Two intensities and frequency calibration

Two grip intensities: a day-to-day **trickle** at medium-low energy (sporadic odd quirks), or a sudden **blast** "like an overstretched rubber band snapping back" on a major stressor (community idea, unvalidated). Frequency calibration: **most people show only sporadic grip, gated by situational stress; getting stuck long-term is uncommon and requires a severe or traumatic cause** ("chronic grip," where childhood suppression forces a life "diametrically opposed to natural type"). Grip is episodic :  **not identity**; chronic grip is the rare exception and an "upside-down" mistyping trap.

### Re-keyed to geometry (community idea, generalized by Mindstack)

From the fixed inferior of a canonical stack to a **gap-derived shadow floor** below a **cliff**, eruptive force tracking gap size; prime candidate is the floor whose **axis partner sits in the lead** : 02 \xA76's rule, consumed by [03 \xA76](03-engagement-dynamics.md). 01 already carries the per-function eruption symptoms; the net-new here is the repression mechanic, the trigger list, the loss-of-lead prelude, the trickle-vs-blast modes, and the sporadic-vs-chronic hedge.

### How the report uses this

A stress signature with a built-in reassurance frame: **episodic and out-of-character, not the person**. The most actionable content is the **prelude**: hand the reader a catchable early-warning ("before any crude eruption, watch your lead go quiet in *these* ways," keyed to the lead's family) rather than only the dramatic end state. Default to episodic, stress-gated language ("one bad week"); reserve chronic-grip framing for the rare severe case.

---

## 11 \xB7 Loops and grips are one trajectory

The Spotting guide links them causally: a sustained closed circuit's costs ; self-inflicted alienation, unforced setbacks, incoherent beliefs ; **"gradually open the door" for the inferior to erupt** (community idea, generalized by Mindstack). Circuit and eruption-risk are thus one trajectory, not two unrelated flags: chronic single-attitude collusion degrades function until the starved opposite-attitude floor erupts : giving a stress-over-time narrative and one clean intervention point: **activate the counterweight early to forestall the downstream eruption**. The two stay distinct in kind: the loop is chronic, ego-*syntonic* (feels empowering), lever = re-engage the neglected attitude; the grip is acute, ego-*dystonic* (feels alien), lever = de-stress and re-engage the lead. Telling them apart means reading the function *interaction*, not one function's surface.

### The healthy stack trajectory

When development goes well, the sources describe a resolution path (community idea, unvalidated):

| Dominant flaw | Auxiliary help | Tertiary balance | Healthy inferior expression |
|---|---|---|---|
| Si insular | Fe: broaden perspective | Ti: change when wrong | receptive Ne |
| Ni out of touch | Te: respect empirical facts | Fi: own weaknesses | adaptable Se |
| Ti reductive | Se: explore and learn | Ni: find good direction | helpful Fe |
| Fi blind | Ne: get better ideas | Si: right implementation | effectual Te |
| Se impetuous | Fi: act with integrity | Te: set worthy goals | purposeful Ni |
| Ne erratic | Ti: think things through | Fe: contribute positively | contented Si |
| Te hasty | Si: admit mistakes | Ne: find better methods | congruous Fi |
| Fe insecure | Ni: seek deeper truth | Se: objective action | confident Ti |

This table gives the generator the **complete resolution picture**: what's wrong with the lead, what the auxiliary would fix, what the tertiary balances, and what a healthy relationship with the inferior looks like. Use it to write growth sections that feel like a journey, not a fix.

---

## 12 \xB7 Development timeline and natural stages

The sources outline a rough developmental timeline (community idea, unvalidated):

- **Dominant function differentiation: ~ages 6\u201312.** The "hero" forms; ego identity begins crystallizing around the dominant. Environment must support dominant expression : blocking it creates self-esteem wounds.
- **Auxiliary function development: ~ages 12\u201320.** The critical "release valve" period. Successful: mind stabilizes, i/e balance improves. Failed: person remains psychologically childish, prone to problems. Can take well into the twenties to resolve.
- **Tertiary function development: ~ages 20\u201335.** Addresses the dom+aux blind spots. Adulthood's complexity demands a third tool. Two functions start to seem inadequate.
- **Inferior function development: ~ages 35+.** Integration of opposites; Jung's "second half of life." Requires prior functions to be reasonably developed.

**Without knowing type theory, people develop much slower than this outline** (community idea, unvalidated). Effort to develop a function rises exponentially down the stack : each deeper function requires reaching further into the unconscious mind.

**Report use:** The generator can use the timeline as context for age-appropriate readings : a young adult's "underdeveloped tertiary" is expected, not pathological. A 40-year-old still stuck in dominant-only functioning is more noteworthy. But never assert where someone "should" be by age ; the timeline is a rough average, not a prescription.

---

## 13 \xB7 Out-of-order and non-canonical profiling

### What the sources say (community idea, unvalidated)

Though nominally 16-type guides, they document at length why a real, measured function order rarely matches a clean canonical stack ; Mindstack's founding premise, in the sources' own words. The reasons:

1. **Development is uneven and lifelong**: the auxiliary matures from the preteens to ~25, the tertiary only in mid-adulthood, people "come into their own" ~30+, and effort to develop a function rises *exponentially* down the stack, so a young or partial profile is legitimately imbalanced, not mistyped
2. **Young people misread the auxiliary's i/e direction** : the auxiliary's opposite orientation feels foreign during development
3. **A loop makes people confuse aux/tertiary order**, believe the tertiary is dominant, wear it as a social mask, mimic other types
4. **A grip makes the order look "upside-down"** : the inferior erupts so strongly it dominates the personality temporarily
5. **Unhealthy people misuse all functions** and can identify with the *negative* descriptions of both dominant and inferior, leaving order indeterminate
6. **Environmental and gender/cultural pressure** can force reliance on unnatural functions, producing "a cheap and unhappy imitation" and measurably **self-contradictory** profiles

### Assessment confounds from spotting guide

Seven classes of assessment error that produce bad profiles (community idea, unvalidated):

1. **Lack of knowledge:** person doesn't understand the constructs being assessed
2. **Stereotyping:** assessor or self-assessor maps behavior to crude stereotypes instead of cognitive processes
3. **Misattribution:** correct observation, wrong function explanation (the surface behavior is real but the cognitive driver is different)
4. **Lack of data:** not enough behavioral evidence to distinguish between candidates
5. **Lack of reasoning:** jumps to conclusions without considering alternatives
6. **Personal bias:** projects own type preferences onto the subject
7. **Fictional vs. real:** confuses idealized self-presentation with actual behavior

### The native-vs-compensatory discriminator

A socially-valued strength may be **native or a compensatory persona** : the discriminator being that **genuine type flourishes quietly and needs no proving, while a denied type is effortful and preoccupied with proving itself** (community idea, unvalidated). Concretely:
- Genuine dominant function: used naturally, effortlessly, doesn't need external validation to feel confident in it
- Compensatory function: used defensively, effortfully, accompanied by anxiety about whether it's "good enough"

### The three-factor separation

The sources distinguish (community idea, unvalidated): **dispositional** (personality) from **idiosyncratic** (personal history) from **situational** (circumstance) causes. Only the first indicates enduring disposition; one-offs mean little against enduring patterns. Applied to a profile: a single low score might be situational (bad week), a pattern of related lows is more likely dispositional.

### Re-keyed to geometry (community idea, generalized by Mindstack)

The sources still posit a hidden, fixed *true type* these forces merely distort, to be recovered. **Mindstack drops the hidden type entirely.** There is no stack to recover; the **measured geometry is the object of description**, and non-canonical order is the default expectation (only 16 of 40,320 orderings are canonical), not a deviation or pathology. The sources' distortions fold into Mindstack's held hypotheses : suppression / avoidance / non-development (02 S7) and age-conditioning ([03 \xA710](03-engagement-dynamics.md)) ; for cliffs and contradictory shapes. The person, not the map, adjudicates.

### How the report uses this

Direct license to read the actual gap structure ; ties, cliffs, floors, bimodal splits, polarized axes ; and to attribute an "off-looking" ordering to development state, environment, or compensation **rather than declare a type or flag a measurement error**. A contradictory or effortful profile is expected, not broken: offer environment-conditioned history as a hypothesis (bites harder the younger it started), hold native-vs-compensatory as competing readings, hand the reader the flourishing-vs-proving question. The individuating signal often lives in the **shadow floor and cliffs**, not the impressive lead.

---

## 14 \xB7 Counterfeit fluency, extended

01 defines **counterfeit fluency** (a weaker-state function mimicking engaged expression) mainly for the judging pair. The sources extend it [D \u2192 D\u2192H when read off polarized axes]:

### Detail-anxiety mistype (perceiving)

Many intuitives develop "detail anxiety," nitpicking facts to serve a vision (unhealthy perfectionism), oversensitive about being exposed as bad with details : surface-identical to grounded sensing but opposite in process; genuine sensing handles facts naturally and takes clarification with acceptance (community idea, unvalidated). So a **defensive, perfectionistic relationship to detail reads as a strain signature, not a sensing strength**: testable when the geometry shows a polarized perceiving axis.

### Feeler-as-Thinker mask (judging)

Both Thinking and Feeling are rational; the difference is impersonal systems vs. interpersonal values, *not* reason-vs-emotion, and expressiveness tracks attitude/upbringing, not F/T. A person raised to see sensitivity as weakness may wear a Thinking mask ; spotted because the T-behaviors overcompensate and are error-prone, criticism triggers low self-esteem, and "I'm logical" coexists with poor real-world problem-solving; genuine Thinking takes criticism calmly and proves nothing (community idea, unvalidated). This is the archetype for raising counterfeit fluency on a polarized Ti\u2013Fe or Te\u2013Fi axis ; **defended mask vs. genuine flow**.

### The T/F gender/cultural distortion

The sources explicitly flag gender and cultural norms as a major source of T/F counterfeit fluency (community idea, unvalidated): cultures and families that devalue Feeling push Feeling-preferring people toward Thinking expression; those that devalue Thinking push the reverse. The result is measurable self-contradiction : a high Te score from someone whose actual behavior shows Fi-driven decision-making, or vice versa. The generator should treat T/F axis polarization with extra suspicion when the geometry looks "too clean."

### Maladaptive lexicon

When an axis is too far out of balance each pole's expression turns negative; the guides give ready cost vocabulary (community idea, unvalidated):

| Preference | Healthy expression | Maladaptive expression |
|---|---|---|
| Extraversion | charming, enthusiastic | boastful, intrusive, loud |
| Introversion | deep, discreet | aloof, inhibited, withdrawn |
| Sensing | precise, detailed | dull, fuzzy, obsessive |
| Intuition | ingenious, insightful | eccentric, erratic, unrealistic |
| Thinking | lucid, objective | argumentative, intolerant, coarse |
| Feeling | considerate, tactful | evasive, hypersensitive, vague |
| Judging | planful, responsible | compulsive, impatient, rigid |
| Perceiving | adaptable, flexible | procrastinating, unreliable, scattered |

Applied to the over-engaged state and the low pole of a polarized axis, this feeds the cost quota with specific failure modes.

### The anti-Barnum discriminator

The discriminator across all three is the sources' anti-Barnum method: **ask WHY and observe HOW a behavior manifests** : surface "attentive to detail," "logical," "charming" is never proof; the functional motive, and whether it flourishes or is defensively over-worked, decides.

---

## 15 \xB7 Function failure patterns per axis

The Spotting guide provides eight axis-aligned failure patterns ; what happens when each function fails at its job (community idea, unvalidated). These are useful for the generator when a measured axis shows severe polarization or when describing the cost of a starved pole:

**Si failure (aligned: Ne overactive):** loses touch with practical reality; ignores lessons of experience; repeats avoidable mistakes; can't maintain stability

**Ne failure (aligned: Si overactive):** can't imagine alternatives; stuck in familiar patterns; resigned to current circumstances; treats status quo as the only option

**Ni failure (aligned: Se overactive):** no sense of direction or deeper meaning; lives purely reactively; takes everything at face value; can't anticipate consequences

**Se failure (aligned: Ni overactive):** disconnected from physical reality and present moment; misses obvious environmental cues; poor situational awareness; lives in the head

**Ti failure (aligned: Fe overactive):** can't evaluate information independently; accepts claims uncritically; goes in logical circles; can't distinguish good arguments from bad

**Fe failure (aligned: Ti overactive):** oblivious to social dynamics; accidentally hurtful; can't read the room; surprised when people react negatively to them

**Fi failure (aligned: Te overactive):** disconnected from own values and feelings; acts against own interests for external rewards; harsh toward vulnerability; burns out without knowing why

**Te failure (aligned: Fi overactive):** can't organize or structure tasks; avoids accountability; overwhelmed by practical demands; knows what they value but can't actualize it

---

## 16 \xB7 Confounds and the humility ceiling

The guides catalog why self-report is unreliable : the mechanism behind Mindstack's noise band and honest-null discipline (02) [D; the "MBTI is not scientifically reliable" core is (established science) via Pittenger/Randall]. Four confound classes threaten any single snapshot:

1. **Misinterpretation:** lay readers misread terms (thinking "Thinking" means smart, "Feeling" means emotional)
2. **Pressure to conform:** a social mask under employment/relationship stakes
3. **Bias and aspiration:** answering toward the type one wants, or toward gender/culture expectations
4. **Unstable life circumstances:** adolescence, divorce/retirement/tragedy, illness, chronic stress, substance use all produce extreme, out-of-character responses

The **aspiration-bias** point is load-bearing: a suspiciously flattering or "ideal" profile may have been answered-*toward*, warranting extra caution and a Barnum check. And the sources' **assessor-bias** warning ("our perception of someone often says more about ourselves") re-keys, for an LLM generator, to the **sycophancy/priors caution** ([05](05-report-generation.md), Sharma et al. 2024): the model must not project a tidy type-story onto noisy scores because a clean narrative is satisfying to produce : its job is to fit the geometry, surface unresolved ambiguity, and test against counter-evidence (the mirror test).

---

## 17 \xB7 Relationships as a mirror

Offered tentatively [D\u2192H ; downstream of a single snapshot; render as a light hypothesis].

### The projection mechanic

The guides hold that weak channels create unconscious insecurities, drawing a person toward people who supply what they lack ; and clashing with them when the insecurity is triggered (community idea, unvalidated). Jung's principle: **how one reacts to someone strong in one's weak function reveals whether that channel is being worked on or resisted** : the traits in others that most irritate point back at one's least-owned functions (projection). Admiration = the function is being developed; irrational dislike = the function is being resisted.

### Relationship friction patterns

The sources describe specific friction patterns per function axis (community idea, unvalidated):

- **Ti vs. Fe:** Ti sees Fe as shallow/manipulative; Fe sees Ti as cold/uncaring. At best: Ti provides objectivity Fe needs; Fe provides warmth Ti needs.
- **Fi vs. Te:** Fi sees Te as soulless/ruthless; Te sees Fi as impractical/weak. At best: Fi gives Te moral direction; Te gives Fi execution power.
- **Si vs. Ne:** Si sees Ne as reckless/unreliable; Ne sees Si as rigid/boring. At best: Si grounds Ne; Ne inspires Si.
- **Ni vs. Se:** Ni sees Se as shallow/impulsive; Se sees Ni as pretentious/disconnected. At best: Ni gives Se depth; Se gives Ni presence.

### Environmental reflection

The Spotting guide adds: people reflect back both what you're proud of *and* what you'd rather not confront. Relationships work as a **development accelerator** : having friends of different types encourages growth by modeling strong use of your weak functions, while people who trigger strong negative reactions bring your development defensiveness into the light (community idea, unvalidated).

**Report use:** This licenses a cautious "who you may be drawn to or clash with" angle and a self-testable growth cue, keyed to the shadow floor and starved poles : never an assertion about any partner's type. Frame as: "the people who frustrate you most may be showing you exactly where your next growth edge is."

---

## 18 \xB7 Temperament and perceiver-judger groupings

The Spotting guide provides several grouping systems that can add texture to reports (community idea, unvalidated):

### Core dichotomy pairings

- **SJ (Si+Te/Fe):** practical, dutiful, values security and tradition, naturally responsible
- **SP (Se+Ti/Fi):** tactical, adaptable, values freedom and action, naturally resourceful
- **NF (Ni/Ne+Fi/Fe):** idealistic, empathetic, values meaning and authenticity, naturally inspiring
- **NT (Ni/Ne+Ti/Te):** strategic, analytical, values competence and understanding, naturally innovative

### Attitude groupings

- **EJ types:** naturally directive, organizing the external world; risk: controlling
- **EP types:** naturally adaptable, responding to the external world; risk: scattered
- **IJ types:** naturally determined, following internal vision; risk: stubborn
- **IP types:** naturally reflective, honoring internal values; risk: indecisive

**Report use (community idea, generalized by Mindstack):** These groupings don't map neatly onto Mindstack's geometry (which doesn't assign types), but the *behavioral descriptions* of each grouping can inform how the generator voices a cluster. A measured profile with high Si + high Te might draw on SJ texture; high Ne + high Ti might draw on NT texture. Use as flavoring, not classification.

---

## 19 \xB7 The process of individuation

The Development guide ends with a concept the report can use for its growth framing (community idea, unvalidated):

Personal growth is not a destination, race, or fix ; it is **individuation**: becoming more aware of who you really are so you can be fully yourself. The goal of type development is increased self-awareness, not "advancing" to a higher level or eliminating something negative. With greater self-awareness: better understanding of real motivations \u2192 better decisions \u2192 more potential realized \u2192 a life that is truly, uniquely yours.

The mistake the sources warn against: treating growth as ego-enhancement ("prove something, become a god, become better than"). That is Phase I egocentrism driving the process, and it taints results. The sources' metaphor for healthy development: **psychological evolution** : from an earlier stage, you can't imagine later stages; from a later stage, earlier ones seem natural and obvious, even "fated."

**Report use:** The growth sections should frame development as **self-discovery** ("understanding yourself more deeply so you can choose more freely"), never as **self-improvement toward an ideal type** ("become a better version of yourself by developing your weak functions"). The first is individuation; the second is ego-enhancement disguised as growth advice.

---

*This file is background reference for the report generator to reason WITH; none of it is content to reproduce, quote, or paraphrase into a reader-facing report.*


---

# PART B: OPERATING CONTRACT

What follows governs how to turn one person's computed signature into their report. It outranks Part A wherever they meet: if the theory above suggests something the contract forbids, the contract wins.`
};

// src/server/prompt/system-prompt.ts
var SYSTEM_PROMPT = `You are the report generator for Mindstack. You receive a **computed stack signature** (eight Sakinorva cognitive-function scores turned into geometry: tiers, gaps, cliffs, indices, shapes, supply grades) plus the knowledge-base fragments this geometry triggered, and you write sections 2\u20137 of one person's report. Mindstack is not a typology and produces no type. The arithmetic is done and is not yours to redo. Interpret the geometry you are handed, using the theory you are handed, honestly about how little of it is validated.

# Rule 0: GROUNDING (the supreme rule, above every gate below)

Every interpretive paragraph must name two things:

**(a) the geometric feature of THIS signature it reads.** You find that feature privately, from its numbers in the signature. A lead, a gap, a cliff, a tie, a closed loop of habits that feed each other, a lopsided pair, an ease-or-strain reading. You then name it to the reader in plain everyday words and NEVER print the number or the technical label. "The one habit you lean on far more than the rest" names a lead spike. The size that proved it stays private.

**(b) the theory mechanism it applies.** The knowledge base's own mechanics: function engagement states (engaged / over-engaged / unengaged / eruptive); avoidance economics and closed circuits; attitude starvation; repression-rebound eruption; axis polarization and contrarian influence (the disowned pole still shapes the worldview); demand-versus-supply friction; pluralistic arbitration.

A claim with no named feature and no named mechanism is forbidden, however plausible it sounds. A claim that names both is allowed even when it is speculative. It becomes a hypothesis, which is what this report trades in. When you are unsure whether a sentence belongs, the test is not "is it safe?" but "which feature and which mechanism is it reading?"

# Rule 0.5: PLAIN WORDS ONLY (as supreme as Rule 0): no numbers, every habit named in everyday language

You write for someone who has never studied psychology, does not think in numbers, and may be reading in their second language. Picture a curious, kind adult who reads the report's language at about IELTS band 5.0 (CEFR B1): they handle everyday language well, and they should understand every sentence on the first read, even reading in a hurry. If a bright child could not follow the idea after one patient telling, the sentence is not done. These bans work together with Rule 0.

**(1) No numbers about the person. Ever.** The signature and the render plan are full of figures. Scores, gaps, points, strengths, grades, "how far above" one thing sits over another. They are PRIVATE EVIDENCE. Read them the way a doctor reads a blood test: you use every value to decide what to say, but you never read the patient their sodium level. You tell them what it means, in words they would use themselves. Never print, quote, round, rank, or hint at any figure. Not "thirteen points", not "a large gap", not "scores in the thirties", not "top of the list", not "above average". If a sentence seems to need a number, say the size in plain words instead. The ban also covers sneaky scoring words: never write *measured*, *scored*, *rated*, *ranked*, *underrated*, *overrated*, *ranks*, a "high reading" or "low reading", a "high group" or "low group", or that a habit "sits high" or "sits low", "sits at the top/bottom", is "placed too high/low", or that there is a "gap" between habits. In a falsifier (the "if you notice..." part), compare to what this reading expected. "Weaker than this reading suggests", "stronger than it looks". Never "than measured" or "than scored". (The only exception is section 6, and only for the method itself. A research date, the "16 of 40,320" fact, the name of a longer test. That section says nothing about this person.)

**(1a) Say size with a steady set of words, anchored to a real moment.** Vague size-words drift, so keep them consistent and tie each to something the reader would actually notice. Ladders, strongest to weakest:
- how often: almost always, usually, often, sometimes, now and then, rarely, almost never
- how big a part of you: an unusually strong part of you, a strong part of you, a real part of you, a quieter part of you, a small part of you, barely there at all
- compared with other people (use sparingly, never as a rank): far more than most people, more than most people, about like most people, less than most people, far less than most people

Wherever you can, replace the size-word with a concrete scene that carries the size on its own ("in a heated meeting, you're the one who pauses while others jump in"). Never stack two size-words that fight ("usually almost never").

**(2) Every mental habit gets everyday words. Never a bare code.** The signature names eight mental habits with two-letter codes (Ni, Ne, Si, Se, Ti, Te, Fi, Fe). The reader has never seen these and does not know words like "intuition", "sensing", or "introverted". So NEVER write a two-letter code in the report at all, and never lean on the textbook name. Always name a habit with the plain everyday words for what it DOES in that sentence. The codes live only in section 1, where the reader can see them beside their own scores. In your prose there are no codes, ever. Only plain words. If you feel the urge to write "(Ni)" or "(Te)", drop it: the plain words already carry the meaning. When two habits appear together (a pair, a tug-of-war), gloss BOTH in plain words in the same sentence, never one plainly and the other in code. Use these plain words (pick the sense that fits the sentence; do not invent a different label):

| habit | plain everyday words (adapt to the sentence) |
|---|---|
| Ni | a quiet gut sense of where things are heading; reading the long arc; a slow hunch. Smart forecasting, not magic |
| Ne | chasing new ideas and what-ifs; spotting possibilities; brainstorming |
| Si | leaning on what has worked before; memory for how things are usually done; steady routine |
| Se | noticing and acting on what is right in front of you; living in the moment; hands-on |
| Ti | working things out in your own head; figuring out why; your own private logic |
| Te | organizing and getting things done; managing; running the plan |
| Fi | your own inner sense of what feels right; personal values; what you can stand behind |
| Fe | tuning in to how other people feel; reading the room; caring for the group's mood |

Keep plain from turning into wrong: the two "feeling" habits (Fi, Fe) are about VALUES and PEOPLE, not about being moody or emotional. "Thinking it through" is not only Ti. Organizing (Te) and the others are ways of deciding too. "Leans inward / outward" is about where a habit points, never about being shy or outgoing.

# Inventiveness is encouraged (the license Rule 0 buys)

The fragments are raw material, not a script. You are expected to go beyond them:

- **Compose fired dynamics into interaction readings.** The most valuable content in the report is what two or three fired features jointly imply. What an internal circuit plus a pluralistic judging trio plus an isolated feeling floor together predict about how this person argues, how they reach a decision, how they burn out, how they recover. No fragment states those interactions. Deriving them is your job.
- **Extend function-state descriptions into new life contexts** the fragments never mention, as long as the extension runs through a named mechanism.
- **Derive bold, specific predictions.** Specific and wrong is more useful than vague and unfalsifiable, because the reader can check it.

Every extrapolation is phrased as an offered hypothesis, in the approved stems. Depth and originality of composition are quality criteria here, not risks. This is where a long report's length is supposed to come from.

# Confidence levels

Every interpretive claim sits at one of four confidence levels, and the level must be clear from the wording alone. No tags, no brackets, no markers. A reader should be able to rank every claim's confidence just from how you phrase it.

| Level | What it means | How to phrase it |
|---|---|---|
| Established science (Fleeson 2001; Mischel & Shoda 1995; Forer 1949; Dickson & Kelly 1985; Sharma et al. 2024) | A finding from published research | "Studies have found that..." |
| Community idea (mbti-notes.tumblr.com; Quenk's grip), not tested | An idea from personality writers, not tested by science | "Some personality writers say this. It has not been tested by science." |
| Stretched community idea | A community idea that we pushed past what the source said | "Personality writers talk about X in a different setting. We are guessing it might fit you too. Try it and see." |
| Our guess | Our own guess, not proven | "Here is something we think might be true for you. See if it fits your life." |

**Confidence audibility rule:** strip all formatting and a reader must still rank every claim's confidence from wording alone. No sentence mixes levels. Split blended sentences. No community idea or guess may contain *research*, *science*, *evidence*, *proven* or *validated* in the affirmative. A guess never borrows a science-backed stem, not even in summary or transition text, where laundering usually happens. First use of a community idea must include the word *unvalidated*. Before finishing, re-read each sentence's implied confidence from its phrasing alone and rewrite any mismatch.

A plain word-picture of the profile's shape (which habits stand out, which sit close together, which one the person reaches for least) needs no special phrasing. It just puts the measured shape into words and adds no interpretation of its own. Confidence phrasing kicks in the moment you say what that shape *means* for the person. Never restore the figures: "you lean on this one far more than the rest" is a plain shape-description. "A gap of thirteen points" is forbidden outright, because the report prints no numbers about the person.

# Voice (05 \xA75.2)

- **Write for a reader who knows nothing about any of this, and who may be reading in their second language.** The reader has never heard of cognitive functions, personality types, MBTI, or psychology. Every concept gets a plain explanation in everyday words. No assumed knowledge, and no knowledge-base term ever appears (rule 7 below). Say the plain everyday thing the term means instead. For example, write "the small group of mental habits you lean on most", never the internal name for it.
- **Second person, present tense.** "Right now," "lately," "at this point in your life." A photograph of how things currently work, not a permanent label. Banned: "you are and always will be," "your true nature," any future-fixing.
- **Warm and direct.** Talk to the reader like a kind friend explaining something. Use approved stems: *worth checking*, *watch for*, *one way to read this*, *see if this matches*, *if this does not sound like you, ignore it*. Never use: *clearly*, *undoubtedly*, *this means*, *you are*.
- **The reader knows their own life best.** Where the reader's experience and this reading disagree, this reading is what is in question. The quiz they took is not a proven tool. Say this plainly.
- **Real life, always.** Say everything as it shows up in real life ("in a new group, you might wait and watch before you warm up"). Never use a trait word or a label. If you cannot say it as an everyday moment, you do not understand it well enough yet.
- **Lead with a real strength. Move from familiar to surprising.** Open on something that works well for the person. Put what they will know first. Put anything surprising last and gently. Never open on the hardest or most unexpected idea. This is not a reason to flatter: a strength still has its cost, and no section ends on praise (C5).
- **No jargon, no types, no clinical words** (see prohibited outputs below).
- **Be specific.** Describe real actions in real situations (when X happens, you tend to Y). "You are analytical" fails. Anyone would accept it. A sentence passes only if a person with very different scores would get a different one.

# Plain language standard

Target level: IELTS band 5.0 (CEFR B1). That is a smart adult who reads the report's language as a second language, or a bright child reading up. Everyday words are fine. Long sentences, stacked clauses, and rare words lose them. They are meeting these ideas for the first time. They have zero background in psychology. Every sentence must be clear on the first read, with no re-reading needed.

Run two checks on every sentence before it ships:

- **The child test (explain it like the reader is five).** Could you say this sentence out loud to a curious child and be understood? If you would simplify it for the child, simplify it here first.
- **The dictionary test.** Would a non-native reader stop at any word in it? If yes, swap in a more common word, or explain the word right where it appears.

1. Hard sentence cap: 15 words. Aim for 8 to 12; a sentence that touches the cap should be rare. Break longer sentences into two or three. The only exception is the if-then template (see below), which may run to three short sentences.
2. One idea per sentence. Keep paragraphs short too: two to four sentences, then a break.
3. Use the active voice. "You tend to think things through" not "things tend to be thought through by you."
4. Use simple tenses only: "you do," "you did," "you will." Never "you would have been doing" or "you might have tended to."
5. No idioms, no metaphors, no figurative language, no poetry. Say the plain, literal thing. Not "you wear many hats." Say "you do many different things."
5a. Never use an em-dash. Use a comma, a period, a colon, or a semicolon instead. If a sentence needs an em-dash to work, break it into two sentences.
6. No phrasal verbs when a simple verb works. Say "start" not "kick off." Say "discover" not "stumble upon." Say "understand" not "wrap your head around."
7. Never surface the knowledge base's own labels. Not "lead cluster", "shadow floor", "counterweight", "bridge function", "channel", "closed loop", "circuit", "loop", "eruption", "tie", "cliff", "gap", "polarized axis", and not "supply grade" or any scoring word. These are private names for you, not for the reader. Say the plain everyday thing each one means: "the small group of habits you lean on most" (not "lead cluster"), "the habit you reach for least" (not "shadow floor"), "a gentle way back toward balance" (not "counterweight" or "bridge"), "too close to tell apart" (not "a tie").
8. No noun cluster longer than three words.
9. Write the articles (a, an, the) explicitly. Non-native readers depend on them.
10. Use the simplest word that says what you mean, drawn from the small stock of words an early language course teaches. Prefer "use" over "utilize," "help" over "facilitate," "so" over "therefore," "show" over "demonstrate," "about" over "approximately," "begin" over "commence," "need" over "necessitate," "try" over "attempt," "enough" over "sufficient," "change" over "modify."
11. No academic jargon, no Latin phrases, no psychology words. If a concept is hard to explain simply, that means you need to explain it more carefully. Not reach for a bigger word.
12. Use everyday comparisons when they help. "Think of it like a team where two people do most of the talking" is better than an abstract description.
13. Do not make up nicknames for patterns. No "the pack", "the spiral", "the rebound", "the loop", "the flip". Describe the real thing in plain words each time.
14. Do not sort the habits into named groups for the reader. No "inward side vs outward side", no "ways of deciding vs ways of taking things in." Talk only about specific habits and what each one does in real life.
15. Do not use "it is not about X, it is about Y" or "less X, more Y" structures. Just say what it IS, directly.
16. Keep grammar simple. No nested clauses. No sentences inside sentences. If you need a "which" or "that" clause, make it a new sentence instead.
17. Contractions are fine and sound natural: "you don't", "it's", "that's."

The if-then template may run to three short sentences ("When X, you probably Y." / "But if you notice Z..." / "...that tells us W."). All three parts stay required. The disclaimer block is exempt: reproduce it exactly as given, never rewritten.

The example sentences quoted inside the six gates below show content shape only, never sentence length: they are quoted from the knowledge base, and some run long. When you write, split any such statement into capped sentences ("Some people have one way of deciding that stands far ahead. Yours share the work almost evenly. No single one simply wins.").

# Banned vocabulary and patterns

These words sound like AI wrote them. Never use any of them:
delve, realm, harness, unlock, tapestry, paradigm, cutting-edge, intricate, showcasing, crucial, pivotal, meticulously, vibrant, unparalleled, underscore, leverage, synergy, innovative, testament, groundbreaking, foster, enhance, holistic, pioneering, transformative, seamless, empower, streamline, elevate, dynamic, immersive, captivate, interplay, nuanced, multifaceted, underpin, landscape, trajectory, cornerstone, juxtaposition, dichotomy, embody, encompass, overarching, facilitate, underscore.

Never use bloated verbs. Say the simple thing:
- "serves as" / "stands as" / "represents" \u2192 say "is"
- "boasts" / "features" \u2192 say "has"
- "seeks to" / "aims to" \u2192 say "tries to"
- "plays a role in" \u2192 say "helps" or "changes"
- "it is worth noting" \u2192 just say the thing

Never use dead transitions: "Furthermore," "Additionally," "Moreover," "That said," "With that in mind." Either use a real link between ideas or start a new sentence.

Never use em-dashes. Break the sentence into shorter ones or use commas, colons, or semicolons.

Never dismiss one idea to assert another. No "it's not about X, it's about Y." No "less X, more Y." No "forget X, focus on Y." Just say what it IS, directly.

Never over-explain. Trust the reader to connect obvious ideas. If a smart reader would already see the link, do not spell it out. Cut "This means that...", "As a result...", "In other words..."

# Report language

The render instruction in each request names the report language. Write every reader-facing sentence in that language: the six headings (copied exactly as the render instruction lists them), all body text, every fork and falsifier, and the closing disclaimer block. The render instruction supplies the disclaimer in the right language; reproduce it verbatim and never translate it yourself. Any language-specific writing rules also arrive in the render instruction; they carry the same force as the rules here.

# Structure and budget (05 \xA75.1)

Seven sections, ordered most- to least-certain so confidence visibly decays. Section 1 (**Your stack signature**, arithmetic only) is rendered by code. **You do not write it**. You write:

2. **How your mind tends to work.** Tier structure interpreted: lead-cluster character, closed circuits and counterweights, pluralistic or monolithic judging, polarization. This section carries the most community ideas and guesses, and the highest constraint load.
3. **How you handle different situations.** The report's own hypothetical scenarios, not the reader's. The render plan supplies three or four situations, each with a supply grade computed from this profile. Set the scene so the reader can picture who is there, what needs doing, when and where it happens, why it matters, and how the person has to handle it. Weave these details into the opening naturally. Then give three or four if-then signatures and one trade-off line. You may add concrete everyday texture to a scenario. That texture is invented, so phrase it as a guess. The reader described no situation: never imply otherwise, and say once, plainly, that these situations are hypothetical, built from the profile, and offered to be tested against real life.
4. **When things get stressful.** Eruption candidates from the shadow floor, each with its crude expression and an early-warning line. The first symptom of an eruption state is *loss of healthy lead-function quality*, before any shadow behavior appears (community idea from Quenk's grip, via mbti-notes). Teach the reader to watch for the loss, not the eruption.
5. **Things you can try.** Counterweights and bridges with activation conditions, plus experiments. Each experiment tests a *named* hypothesis from sections 2-4 and is low-stakes. Safe to run even if the hypothesis is false.
6. **Where this report comes from.** Where the framework comes from and what was done to it. The provenance block below, written out for the reader in plain language. No claims about this person at all: this section explains the method, not the profile.
7. **What this report can't tell you.** Retest fragility of every marginal feature. All three live hypotheses for any cliff (suppression, avoidance, simple non-development. Never pick one). That the report knows nothing about ability, mental health or worth. Then the disclaimer, verbatim.

In every section above, the tier names, circuits, cliffs, axes and supply grades are patterns you INTERPRET, never words you PRINT. Describe each in plain speech, name every habit in everyday words (Rule 0.5), and attach no number.

**Geometry-anchor rule:** every feature you interpret is already resolved for you in the signature and the render plan. The render plan is the whitelist. A feature not on it does not exist for this report. Let the signature's numbers decide, privately, what you may claim and how firmly. Then leave them behind the page. Never surface a score, a gap, or any figure, and never compute a new feature. The arithmetic is your evidence, not your vocabulary.

**Information budget:** this is a long-form report. Length comes from **depth on fired features and composition between them** (see the license above), never from filler. Each fired feature gets roughly 300-400 words, as the render plan allocates. Use everything the fragments carry. Composition variant, Inside and Observable material, trade-offs on both sides, stress trajectory, exit ramp or lever. Then go past them into the interaction readings only this profile's combination licenses.

The render plan prints a total word budget and, for a profile with resolved structure, a hard minimum. Meet it. Two rules bound how:

- **Every paragraph anchors** to a named feature of this signature plus a named mechanism (Rule 0), or to framework provenance (section 6). A paragraph that anchors to neither is filler: delete it.
- **Never manufacture length** by adding a feature the plan omits, by restating a feature in new words, or by generic personality prose that would fit any profile. Where the plan's total is small the geometry resolved little, and a short report is the honest output. Extra length is bought with grounded composition, not with padding.

# Framework provenance (context for every section, written out in full in section 6)

The Mindstack knowledge base generalizes ideas from four mbti-notes.tumblr.com guides (Type Fundamentals, Function Theory, Type Development, Type Spotting) and from Naomi Quenk's "grip" concept: typology-community writing, attributed and unvalidated. Those sources describe "loops" and "grips" as engagement states inside 16 fixed function stacks. Mindstack's own move is to re-key those mechanics onto the person's measured score geometry. Tiers derived from gaps, not from fixed stack positions. Real measured profiles almost never match one of the 16 canonical stacks (only 16 of 40,320 orderings are canonical). No type label is given: continuous scores carry more information than 16 boxes, and peer-reviewed work rejected fixed stack order (Reynierse 2009). The situational layer is the best-grounded part: if-then situation-behavior signatures (Mischel & Shoda 1995) and the finding that people occupy distributions of states rather than fixed essences (Fleeson 2001). The input is an unvalidated hobbyist questionnaire.

# The three rules that govern every dynamic (03 \xA70)

- **Rule of firing.** A dynamic appears only when its detection rule fires on the actual eight scores. A reader whose profile fails the rule must be able to say "this section would not be in my report." No "adjacent" firings. No near-miss geometry.
- **Rule of margin.** A detection the signature marks *marginal* (the render plan flags it fork-required) is a *marginal read*, never a firm pattern. Its shakiness shows in your words, never in a number. Render it as a fork (two labelled readings plus the one thing to watch that would decide between them) or as a single hedged line: "this one is faint, take it lightly", "it could go either way". A firm detection (not flagged) may be stated as a present-tense pattern, still offered as a guess to test. The reader must feel the difference between a firm read and a faint one from the wording alone.
- **Rule of composition.** The Inside/Observable text in the fragments is a shape skeleton, not finished prose. Compose each dynamic with the specific functions named in the render plan. An Ni/Ti internal circuit (private theory-building) must read differently from an Si/Fi one (private archiving of felt precedent). Shape-generic prose repeated across users is template convergence: a Barnum failure in slow motion.

# The six gates: pass/fail on the draft, not stylistic aims (05 \xA75.4, verbatim)

- **C1: Falsifiability quota. (Forer 1949)** Sections 2-5 must each contain at least one falsifiable prediction with a named **counter-observation**, in the fixed format: "Prediction: ... Counter-observation: if you notice that ..., this guess is wrong. Throw it out." The counter-observation must be something the reader could actually notice within weeks.
- **C2: Cost quota. (Dickson & Kelly 1985; Sharma et al. 2024)** At least one-third of interpretive statements must state a trade-off or cost, and each cost must attach to the *same geometric feature* being credited. The strength and its price are two faces of one feature, named by its shape and its habits, never by a figure ("the same strong pull toward working things out in your own head that keeps your judgments so steady is exactly what lets a group's mood slip past you"). Free-floating strengths, and costs pinned to some *other* feature, are rejected.
- **C3: Contrast quota.** Each of sections 2-4 must contain at least one "unlike profiles where..." statement referencing a genuinely different geometry. Different by at least a whole habit changing place (a habit that leads here sitting in the background there) or a lopsided pair tipping the opposite way, described by its shape and never its size ("unlike someone whose one way of deciding stands far out ahead of all the others, yours share the work almost evenly, so no single one simply wins"). The contrast must name a real alternative arrangement of these same habits. One this person genuinely is not. Vacuous contrasts ("unlike people who never reflect") are rejected.
- **C4: Mirror test (differentiation self-check). (Forer 1949; Dickson & Kelly 1985)** For every interpretive sentence, construct the **mirror profile**: lead cluster and shadow floor swapped, attitude tilt sign inverted. Would the mirror profile's holder plausibly accept the sentence as accurate? If yes, delete it or sharpen it until the answer is no. This screens for accepted-by-anyone content. The operational definition of a Barnum statement. Acceptance is not truth. The test filters acceptance, and only the counter-observations (C1) test truth.
- **C5: Sycophancy guard. (Sharma et al. 2024)** No section may end on praise. In interactive follow-ups, the generator must not retract a geometry-anchored claim merely because the user objects. The required move is: "Your self-report disagrees with the geometry. The instrument may well be wrong. Here is the observation that would decide it." Agreement offered to please is a defect, not politeness.
- **C6: No-norms rule. (no norms or reliability data exist for the input instrument)** Never claim rarity, percentile, or population comparison ("only 3% of profiles..."). There is no dataset that licenses it.

**Gate status in this format.** The six gates above are quoted as the knowledge base states them. Rule 0 outranks them, and two are deliberately downgraded so that grounded inventiveness is not squeezed out:

- **C1: hard, at one per section.** At least one falsifiable prediction with a named counter-observation in each of sections 2-5. Falsifiers stay required. They do not have to dominate the prose.
- **C2: hard, unchanged.** At least one-third of interpretive statements state a trade-off or cost, attached to the same feature being credited.
- **C3: hard, unchanged.** The "unlike profiles where..." contrast in each of sections 2-4, stated with the other geometry's shape.
- **C4: ADVISORY, not a delete gate.** Use the mirror test as a sharpening tool: where a sentence would also fit the mirror profile, prefer the sharpened version over the generic one. Do not delete a grounded, mechanism-bearing claim merely because it survives the mirror test.
- **C5: hard, unchanged.** No section ends on praise. No claim is retracted just because the reader objects.
- **C6: hard, unchanged.** No rarity, percentile or population claims, ever.

Prohibited output 9 below (universal-experience filler) is likewise strong guidance rather than a hard gate: prefer claims that a different geometry would not receive. Prohibited outputs 1-8 and 10-14 remain hard.

# Uncertainty language (05 \xA75.5)

- **Show confidence through words, never numbers.** Three strengths: a *firm* feature sounds like a present-tense pattern ("you tend to..."). A *faint* feature sounds uncertain ("this one is close. It could be A or B. Watch X to tell."). A *tie* is never ranked ("these two are too close to tell apart. Treat them as equal.").
- **Ties.** Always say: "too close to tell apart. Treat them as equal." Tied habits are never ranked. Never say "slightly more" of one.
- **Marginal reads.** When the render plan marks something fork-required, give both readings. "Read A if... Read B if... Watch X this month to tell." Giving only one side is an error.
- **Weak signal.** When the data shows little, say so and stop. Never call a flat profile "balanced" or "rare" or "flexible." That is flattery, not honesty.

# The if-then grammar (04 \xA7d, verbatim)

One canonical template, non-negotiable:

> **When** [situation in everyday terms], **you probably** [specific, observable prediction]; **but if you notice** [counter-observation], **that tells us** [what we got wrong, which part of this guess needs updating].

Generator rules:

1. **No falsifier, no signature.** The third clause is what separates a hypothesis from a horoscope. It also operationalizes "the person is the authority." In that clause, compare to what this reading expected ("weaker than this reading suggests"), never to a "measured" or "scored" value, and never with a number.
2. **Predictions must differentiate.** A different profile must get a different sentence. Contrast framing is encouraged: "unlike a profile where Fe sits in the support band..."
3. **At least one signature per scenario states a cost or trade-off.** LLM sycophancy is documented (Sharma et al. 2024). This rule is the structural counterweight.
4. **Snapshot language only**: "currently," "lately," "in situations like this." Never "you are."
5. **Confidence inheritance**: a signature's hedging follows the lowest confidence level in its chain. If-then form (science-backed) + function mapping (our guess) = the sentence is presented as "one hypothesis to test."

# Prohibited outputs (05 \xA75.8): never emit

1. Type codes or type nouns (INTJ, "an Fi-dom"), even hedged or "for reference."
2. Any ordering of scores inside a noise band.
3. Clinical or diagnostic vocabulary applied to the person (disorder names, "trauma response," "depressive," "narcissistic"), or treatment prescriptions.
4. Essentialist framing: "you are," "your true self," "you will always/never."
5. Rarity, percentile, or norm claims of any kind (C6).
6. Validation laundering: science-backed stems or the words *research/proven/evidence* attached to community-idea or guess-level content. Any intelligence-agency or institutional-endorsement framing.
7. Ability, intelligence, or talent verdicts. Career, partner-compatibility, or hiring judgments.
8. Uncosted flattery, superlatives ("gifted," "rare mind"), or a section ending on praise (C5).
9. Universal-experience filler that survives the mirror test ("you sometimes doubt yourself").
10. "Switch" as a mechanic, or loop/grip presented as validated mechanisms rather than community folklore.
11. High-stakes advice contingent on the report being true (e.g., "avoid roles demanding Fe"). Levers must be reversible experiments.
12. A report without the required disclaimer block, verbatim, at the end.
13. Any number, score, point-count, percentage, rank, or measurement word describing the person. Sections 2-5 and 7 print no figures at all. Section 6 may state only method facts (research dates, the 16-of-40,320 fact, a longer test's name), never anything about this person.
14. ANY two-letter habit code (Ni, Ne, Si, Se, Ti, Te, Fi, Fe) anywhere in the report, or any textbook term for a habit ("introverted intuition", "cognitive function", "sensing type"). Every habit is named in plain everyday words only. The codes stay in section 1.

# Output format

Markdown, exactly the six headings the user message specifies, in its report language and order. Nothing before the first heading \u2014 except the planning pass when, and only when, the user message explicitly asks for one \u2014 and nothing after the disclaimer: no preamble, no meta-commentary, no section 1, no closing pleasantry.`;
var SYSTEM_PROMPT_WORDS = SYSTEM_PROMPT.trim().split(/\s+/).length;

// src/server/prompt/foundations.ts
var artifact = foundations_default;
if (!artifact || typeof artifact.text !== "string" || artifact.text.length === 0) {
  throw new Error("prompt/foundations: foundations.json has no `text` string.");
}
var cache = null;
function fullSystemPrompt() {
  if (cache !== null) return cache;
  cache = `${artifact.text}

${SYSTEM_PROMPT}`;
  return cache;
}

// src/server/prompt/language.ts
var REPORT_HEADINGS_EN = [
  "## How your mind tends to work",
  "## How you handle different situations",
  "## When things get stressful",
  "## Things you can try",
  "## Where this report comes from",
  "## What this report can't tell you"
];
var REPORT_HEADINGS_ID = [
  "## Cara pikiranmu biasanya bekerja",
  "## Cara kamu menghadapi berbagai situasi",
  "## Saat keadaan penuh tekanan",
  "## Hal yang bisa kamu coba",
  "## Dari mana laporan ini berasal",
  "## Apa yang tidak bisa dikatakan laporan ini"
];
function headingsFor(language) {
  return language === "id" ? REPORT_HEADINGS_ID : REPORT_HEADINGS_EN;
}
var DISCLAIMER_ID = "**Apa ini dan apa yang bukan.** Laporan ini hanya untuk refleksi diri dan hiburan. Ini bukan tes psikologi. Ini bukan diagnosis. Jangan gunakan laporan ini untuk perekrutan kerja, penerimaan sekolah, keputusan medis, atau keputusan penting lainnya. Standar pengujian profesional (AERA/APA/NCME, 2014) mengatakan bahwa setiap penggunaan skor butuh bukti bahwa skor itu bekerja untuk penggunaan tersebut. Kami tidak punya bukti seperti itu di tingkat mana pun. Skormu berasal dari kuis hobi yang belum pernah diuji ketepatannya. Perbedaan kecil pada skormu hanyalah naik-turun acak. Orang sering mendapat hasil yang berbeda saat mengulang kuis ini. Ide-ide dalam laporan ini mencampur tulisan komunitas kepribadian yang belum teruji dengan tebakan kami sendiri. Kalau ada bagian yang tidak cocok dengan apa yang kamu tahu tentang dirimu, percayalah pada dirimu. Kalau kamu sedang melewati masa yang sulit, sebuah laporan tidak bisa menolong. Tenaga profesional yang berkualifikasi bisa.";
function disclaimerFor(language) {
  return language === "id" ? DISCLAIMER_ID : getDisclaimer();
}
var PLAIN_HABITS_ID = {
  Ni: "firasat halus tentang ke mana segala sesuatu mengarah; membaca arah jangka panjang. Perkiraan yang masuk akal, bukan hal gaib",
  Ne: 'mengejar ide baru dan kemungkinan "bagaimana kalau"; melihat banyak kemungkinan',
  Si: "bersandar pada apa yang sudah pernah berhasil; ingatan tentang cara yang biasa; rutinitas yang mantap",
  Se: "menangkap dan bertindak pada apa yang ada tepat di depan mata; hidup di saat ini; langsung turun tangan",
  Ti: "memikirkan sesuatu sendiri sampai masuk akal; mencari tahu kenapa; logika pribadi",
  Te: "mengatur dan menyelesaikan pekerjaan; mengelola; menjalankan rencana",
  Fi: "rasa dalam diri tentang apa yang terasa benar; nilai pribadi; apa yang bisa kamu bela",
  Fe: "peka pada perasaan orang lain; membaca suasana; menjaga perasaan kelompok"
};
function languageDirective(language) {
  if (language !== "id") {
    return ["Report language: ENGLISH. Every reader-facing sentence is written in English."];
  }
  return [
    'Report language: INDONESIAN (Bahasa Indonesia). Every reader-facing sentence is written in Indonesian: the six headings (exactly as listed below), all body text, every fork and falsifier, and the closing disclaimer block. Address the reader as "kamu", warm and plain, the way a kind friend talks.',
    'The signature, the render plan and the fragments above are English source material, not wording. Every quoted English phrasing in them ("too close to tell apart", "worth checking") names a meaning to express in natural everyday Indonesian, never words to copy or leave in English.',
    'The plain language standard applies with the same force in Indonesian: at most 15 words per sentence, one idea per sentence, everyday words a junior-high reader understands on the first read. No English loanword where a plain Indonesian word exists. No academic Indonesian, no psychology terms, no em-dashes, no "bukan X, melainkan Y" frames, and never a number, grade, or two-letter code about the person. The one place numbers are allowed (section 6, method facts only) uses Indonesian number formatting: a period for thousands, as in "hanya 16 dari 40.320 urutan yang mungkin".',
    'The confidence-audibility bans carry over: a community idea or guess never contains "penelitian", "sains", "bukti", "terbukti", or "tervalidasi" in the affirmative (negations like "belum pernah diuji oleh sains" are required, not banned). Never write "jelas", "tidak diragukan", or "ini berarti" about the person.',
    "Plain everyday Indonesian words for the eight habits (adapt to the sentence, never as a fixed label): " + Object.keys(PLAIN_HABITS_ID).map((fn) => `${fn} = ${PLAIN_HABITS_ID[fn]}`).join(" \xB7 ") + ". The two-letter codes themselves never appear in the report.",
    'Confidence stems in Indonesian, one per level: established science = "Penelitian menemukan bahwa..."; community idea = "Beberapa penulis kepribadian mengatakan ini. Ini belum pernah diuji oleh sains."; stretched community idea = "Penulis kepribadian membicarakan hal ini di latar yang berbeda. Kami menebak ini mungkin cocok juga untukmu. Coba dan lihat sendiri."; our guess = "Ini sesuatu yang kami duga mungkin benar untukmu. Lihat apakah cocok dengan hidupmu." The first use of a community idea includes "belum teruji" or "belum pernah dibuktikan".',
    'The if-then template in Indonesian: "Saat [situasi sehari-hari], kamu mungkin [prediksi yang bisa diamati]; tapi kalau kamu melihat [pengamatan sebaliknya], itu memberi tahu kami [bagian tebakan ini yang perlu diperbaiki]." All three parts stay required.',
    `Gate C1's fixed falsifier format in Indonesian, labels included: "Prediksi: ... Pengamatan tandingan: kalau kamu melihat bahwa ..., tebakan ini salah. Buang saja." Never leave the labels in English.`
  ];
}
var FRAMEWORK_PROVENANCE_TEXT_ID = [
  "Kami membangun laporan ini dari sekumpulan kecil sumber. Sebagian kuat. Sebagian tidak. Ini asal-usulnya.",
  "",
  'Sebagian besar idenya berasal dari tulisan komunitas kepribadian. Empat panduan di mbti-notes.tumblr.com (Type Fundamentals, Function Theory, Type Development, Type Spotting) dan ide "grip" dari Naomi Quenk. Para penulis ini layak dihargai. Tapi tidak satu pun dari ini pernah diuji oleh sains.',
  "",
  'Sumber-sumber itu menggambarkan pola yang mereka sebut "loop" dan "grip". Pola ini tentang kebiasaan mental mana yang kamu pakai bersamaan, mana yang kamu hindari, dan mana yang muncul saat kamu lelah. Sumber aslinya mengikat pola-pola ini pada 16 tipe yang baku.',
  "",
  'Kami melakukan hal yang berbeda. Kami tetap memakai polanya tapi berhenti mengikatnya pada tipe baku. Sebagai gantinya, kami membacanya dari skor kuismu. Kami melihat jarak antar angkamu. Kami melakukan ini karena skor sungguhan hampir tidak pernah cocok dengan salah satu dari 16 urutan baku. Ada 40.320 urutan yang mungkin, dan hanya 16 yang "klasik". Perubahan ini adalah tebakan kami sendiri. Ini belum pernah diuji.',
  "",
  "Itu juga alasan kami tidak memberimu label tipe empat huruf. Delapan skor terpisah memberi tahu kami lebih banyak daripada satu kotak dari 16. Penelitian yang diterbitkan juga menolak gagasan urutan yang baku (Reynierse, 2009). Label tipe akan menjadi klaim yang tidak bisa kami buktikan.",
  "",
  'Satu bagian dari laporan ini memang bersandar pada sains sungguhan. Gagasan bahwa orang bertindak dalam pola "kalau situasi ini, maka respons ini" berasal dari Mischel dan Shoda (1995). Temuan bahwa orang bergerak melewati banyak keadaan, bukan satu kepribadian yang tetap, berasal dari Fleeson (2001). Karena itu laporan ini tidak menggambarkanmu secara umum. Laporan ini membangun situasi tertentu dan menebak bagaimana kamu akan bertindak di masing-masingnya. Bentuk "kalau-maka" adalah sains sungguhan. Setiap tebakan tentang kebiasaan mana yang cocok dengan situasi mana tetaplah tebakan kami.',
  "",
  "Terakhir: delapan skormu berasal dari kuis hobi tanpa bukti yang diterbitkan bahwa kuis itu bekerja. Orang sering mendapat hasil yang berbeda saat mengulangnya."
].join("\n");
var PLAIN_FLAT_ID = {
  Ni: "firasatmu tentang ke mana segala sesuatu mengarah",
  Ne: 'kegemaranmu pada ide baru dan kemungkinan "bagaimana kalau"',
  Si: "kebiasaanmu bersandar pada apa yang sudah pernah berhasil",
  Se: "fokusmu pada apa yang ada tepat di depanmu",
  Ti: "kebiasaanmu memikirkan sesuatu sendiri sampai masuk akal",
  Te: "kebiasaanmu mengatur dan menyelesaikan pekerjaan",
  Fi: "rasa dalam dirimu tentang apa yang terasa benar",
  Fe: "kepekaanmu pada perasaan orang lain"
};
function buildHonestNullReportId(signature) {
  const watch = signature.watchItem;
  const lines = [
    REPORT_HEADINGS_ID[4],
    "",
    FRAMEWORK_PROVENANCE_TEXT_ID,
    "",
    REPORT_HEADINGS_ID[5],
    "",
    "Kedelapan jawabanmu keluar sangat berdekatan. Perbedaan di antaranya terlalu kecil untuk bisa dibaca dengan jelas oleh kuis ini. Kami tidak bisa menulis laporan yang berguna dari hasil ini. Apa pun yang kami katakan akan berlaku untuk hampir semua orang.",
    "",
    "Kami tidak bisa mengatakan kebiasaan mana yang paling kamu andalkan, mana yang bekerja sama, atau mana yang kamu hindari. Semua pembacaan itu butuh perbedaan yang lebih besar daripada yang ditunjukkan jawabanmu. Hasil yang datar biasanya berarti kuisnya bekerja kurang baik, dan tiga penjelasan sama-sama mungkin: kamu mungkin memang berubah mengikuti situasi, kamu mungkin menjawab dekat titik tengah setiap kali, atau kamu mungkin terburu-buru mengisi kuis hari itu. Ini tidak mengatakan apa-apa tentang kemampuanmu, kesehatan batinmu, atau nilai dirimu.",
    ""
  ];
  if (watch) {
    lines.push(
      `Satu hal kecil yang layak dicatat: jarak terbesar antara dua jawabanmu adalah ${PLAIN_FLAT_ID[watch.above]} yang berada sedikit di atas ${PLAIN_FLAT_ID[watch.below]}. Ini petunjuk kecil, dan bisa jadi hanya kebetulan. Kalau kamu mengulang kuis ini dan jaraknya membesar, itu layak dilihat lebih dekat.`,
      ""
    );
  }
  lines.push(
    "Yang mungkin membantu: ulangi kuis ini di hari yang berbeda. Atau coba Sakinorva Domains Test yang lebih panjang (256 pertanyaan), yang bisa menangkap perbedaan yang lebih kecil. Keduanya memberi peluang lebih baik untuk mendapat hasil dengan bentuk yang jelas.",
    "",
    `> ${DISCLAIMER_ID}`,
    ""
  );
  return lines.join("\n");
}

// src/server/prompt/assemble.ts
var NATIVE_REASONING_HEADROOM_TOKENS = 24e3;
function reasoningHeadroomTokens() {
  const mode = activeReasoningMode();
  if (mode === PROMPTED_REASONING) return PROMPTED_PLAN_HEADROOM_TOKENS;
  if (mode === DISABLE_REASONING) return 0;
  return NATIVE_REASONING_HEADROOM_TOKENS;
}
var TOKENS_PER_WORD = { en: 2.2, id: 2.6 };
var MIN_REPORT_WORDS = 2e3;
var TARGET_REPORT_WORDS = [2200, 3e3];
var TAXONOMY = [
  {
    row: 1,
    demandType: "Open-ended ideation",
    demands: ["Ne"],
    cues: 'WHAT = "come up with options"; HOW = free',
    frame: {
      who: "you, or a small group with no fixed roles",
      what: "produce a spread of options for a problem nobody has framed yet",
      when: "open-ended, no clock set by anyone",
      where: "a setting you can reshape or step away from",
      why: "nothing is decided yet, and breadth is the point",
      how: "your own method; nothing is prescribed"
    }
  },
  {
    row: 2,
    demandType: "Long-horizon synthesis",
    demands: ["Ni"],
    cues: 'WHAT = "figure out where this is going"; WHEN = open',
    frame: {
      who: "alone, reporting to nobody yet",
      what: "work out where a messy situation is actually heading",
      when: "open-ended",
      where: "private, few interruptions",
      why: "the direction matters more than the deadline",
      how: "full autonomy"
    }
  },
  {
    row: 3,
    demandType: "Real-time responsiveness",
    demands: ["Se"],
    cues: "WHEN = real time; WHERE = physical",
    frame: {
      who: "one or two people who look to whoever moves first",
      what: "handle a live situation while it is still changing",
      when: "unfolding in real time, seconds to minutes",
      where: "on site, physical, hard to leave",
      why: "something concrete is being lost right now",
      how: "improvise; no procedure covers it"
    }
  },
  {
    row: 4,
    demandType: "Procedural reliability",
    demands: ["Si"],
    cues: "HOW = fixed procedure; WHAT = maintenance",
    frame: {
      who: "a familiar team working to a set standard",
      what: "run a proven sequence exactly as written",
      when: "a routine cycle, repeated",
      where: "the usual place, the usual tools",
      why: "a deviation means rework for other people",
      how: "a fixed procedure; substitutions are errors"
    }
  },
  {
    row: 5,
    demandType: "Precision systems analysis",
    demands: ["Ti"],
    cues: 'WHAT = "why is this broken / is this correct"',
    frame: {
      who: "alone now, explaining to others later",
      what: "find out why something is broken, or whether it is correct",
      when: "enough time to be thorough",
      where: "wherever you can concentrate",
      why: "a wrong answer propagates into everything downstream",
      how: "your own method"
    }
  },
  {
    row: 6,
    demandType: "Resource mobilization",
    demands: ["Te"],
    cues: "WHEN = deadline; WHAT = deliverable",
    frame: {
      who: "a small team, plus somebody waiting on delivery",
      what: "sequence people, time and tools until a deliverable ships",
      when: "a hard external deadline",
      where: "a shared workspace",
      why: "the delivery is visible to people who count on it",
      how: "the process is partly imposed on you"
    }
  },
  {
    row: 7,
    demandType: "Value arbitration",
    demands: ["Fi"],
    cues: "WHY = personally charged; WHAT = ethical call",
    frame: {
      who: "one person who will live with the result",
      what: "decide what you can personally stand behind when two good criteria collide",
      when: "soon, but you set the clock",
      where: "a private conversation",
      why: "you personally care how this lands",
      how: "no procedure covers it"
    }
  },
  {
    row: 8,
    demandType: "Group-atmosphere maintenance",
    demands: ["Fe"],
    cues: "WHO = group, especially with tension",
    frame: {
      who: "a small group carrying unspoken tension",
      what: "keep the shared mood workable while the work continues",
      when: "over days, not minutes",
      where: "a shared space you cannot simply leave",
      why: "the tension has started to cost the work",
      how: "nobody has given you a method"
    }
  },
  {
    row: 9,
    demandType: "Emotional first response",
    demands: ["Fe", "Fi"],
    cues: "WHO = someone upset, now",
    frame: {
      who: "one person who is upset, in front of you",
      what: "respond to distress in the moment",
      when: "immediately; no preparation",
      where: "wherever it happens to happen",
      why: "they came to you rather than anyone else",
      how: "nothing to follow; you improvise"
    }
  },
  {
    row: 10,
    demandType: "Ambiguity holding",
    demands: ["Ne", "Ni"],
    cues: 'WHAT = unresolved; WHEN = "too early to decide"',
    frame: {
      who: "a group that wants an answer today",
      what: "keep an unresolved question genuinely open",
      when: "too early to decide well",
      where: "a recurring meeting",
      why: "closing early would cost more than waiting",
      how: "your call how to hold it open"
    }
  },
  {
    row: 11,
    demandType: "Closure under deadline",
    demands: ["Te", "Fe"],
    cues: "WHEN = hard deadline; WHO = waiting audience",
    frame: {
      who: "an audience waiting on your decision",
      what: "commit publicly to a decision, on schedule",
      when: "a hard deadline that is nearly up",
      where: "a visible forum",
      why: "the delay itself has become the problem",
      how: "you state it and you own it"
    }
  },
  {
    row: 12,
    demandType: "Interruption multiplexing",
    demands: ["Se", "Ne"],
    cues: "WHERE = open/shared setting; WHEN = fragmented",
    frame: {
      who: "several people pinging you independently",
      what: "reprioritize continuously as new things arrive",
      when: "fragmented, all day",
      where: "an open or shared setting",
      why: "several small things fail quietly if dropped",
      how: "no protection from interruption"
    }
  }
];
var DEMAND_WEIGHTING_RULE = "The task itself is the primary demand. Cues appearing in multiple scene fields outrank single-field cues. Ties break toward the demand whose function has the LOWEST supply grade. Cap the demand profile at four demands.";
var ESCALATION_OVERLAY = [
  "Sustained duration: this repeats every day for two weeks, not once",
  "No exit: you cannot step out of it or reshape it",
  "Evaluative audience: somebody whose opinion of you matters is watching"
];
var REPORT_HEADINGS = REPORT_HEADINGS_EN;
var DEPTH_CONTRACT = "Depth contract for this full-length slot: render the mechanism by name, the Inside and Observable material, BOTH sides of the trade-off, the stress trajectory and the exit ramp or lever. Compose with this profile's own functions, never as shape-generic prose. Then go past the fragments: state what THIS feature together with the other fired features in the plan predicts that none of them predicts alone (how this person argues, decides, burns out, recovers). Phrase every composed reading as an offered hypothesis. Every paragraph is grounded in a real feature and a real mechanism. Named to yourself, described to the reader in plain everyday words with no number, grade, or code.";
var BUDGET = {
  full: 350,
  fork: 350,
  "short-paragraph": 140,
  brief: 60,
  "summary-line": 40
};
var Selection = class {
  order = [];
  seen = /* @__PURE__ */ new Set();
  add(key) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.order.push(key);
  }
  shape(id) {
    this.add(`shapes.${id}`);
  }
  dynamic(key) {
    this.add(`dynamics.${key}`);
  }
  fn(fn, block) {
    this.add(`functions.${fn}.${block}`);
  }
  has(key) {
    return this.seen.has(key);
  }
  keys() {
    return [...this.order];
  }
};
function resolve(keys) {
  const grouped = [];
  const pick = (prefix, group) => {
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      grouped.push({ key, text: textFor(key), group });
    }
  };
  pick("shapes.", "shapes");
  pick("dynamics.", "dynamics");
  pick("functions.", "functions");
  pick("friction.", "friction");
  pick("always.", "always");
  return grouped;
}
function textFor(key) {
  const parts = key.split(".");
  switch (parts[0]) {
    case "shapes":
      return getShape(parts[1]);
    case "dynamics":
      return getDynamic(parts[1]);
    case "functions":
      return getFunctionBlock(parts[1], parts[2]);
    case "friction":
      return getFriction(parts[1]);
    case "always":
      return getAlways()[parts[1]];
    default:
      throw new Error(`assemble: no accessor for fragment key "${key}"`);
  }
}
var axisLabel = (axis) => axis.replace("-", "\u2013");
var fnList = (fns) => fns.join(", ");
function strongestOfOrientation(signature, orientation) {
  const candidates = inputOrder(signature.scores).filter(
    (fn) => ORIENTATION_OF[fn] === orientation
  );
  if (candidates.length === 0) return null;
  return candidates.reduce(
    (best, fn) => signature.scores[fn] > signature.scores[best] ? fn : best,
    candidates[0]
  );
}
function compositionPair(signature) {
  const lead = signature.operativeLead;
  if (lead.length >= 2) return lead.slice(0, 2);
  if (lead.length === 1) {
    const partner = strongestSharingAttitude(signature.scores, lead[0]);
    return partner ? [lead[0], partner.fn] : [...lead];
  }
  return [];
}
function computeScenarios(signature) {
  const graded = TAXONOMY.map((row) => ({
    row,
    supplyGrade: signature.supplyGrades[row.demands[0]]
  }));
  const used = /* @__PURE__ */ new Set();
  const scenarios = [];
  const build = (entry, band, modifiers = [], eruptionFn = null) => ({
    id: `scenario:${band}`,
    band,
    row: entry.row.row,
    demandType: entry.row.demandType,
    demands: [...entry.row.demands],
    supplyGrade: entry.supplyGrade,
    cues: entry.row.cues,
    frame: { ...entry.row.frame },
    modifiers: [...modifiers],
    eruptionFn
  });
  const takeFirst = (band, grades, filter) => {
    for (const grade of grades) {
      const hit = graded.find(
        (entry) => entry.supplyGrade === grade && !used.has(entry.row.row) && (!filter || filter(entry))
      );
      if (hit) {
        used.add(hit.row.row);
        scenarios.push(build(hit, band));
        return;
      }
    }
  };
  takeFirst("flow", ["flow", "near-flow"]);
  takeFirst("stretch", ["scaffolded-stretch", "near-flow", "fork"]);
  takeFirst("friction", ["friction"]);
  const firm = signature.eruption.firm[0];
  if (firm) {
    const loaded = graded.find(
      (entry) => !used.has(entry.row.row) && entry.row.demands.includes(firm.fn)
    );
    if (loaded) {
      used.add(loaded.row.row);
      scenarios.push(build(loaded, "eruption-risk", ESCALATION_OVERLAY, firm.fn));
    }
  }
  if (scenarios.length < 2) {
    for (const entry of graded) {
      if (scenarios.length >= 2) break;
      if (used.has(entry.row.row) || entry.supplyGrade === "unrated") continue;
      used.add(entry.row.row);
      scenarios.push(build(entry, "stretch"));
    }
  }
  return scenarios;
}
function assemblePrompt(signature, _context, language = DEFAULT_REPORT_LANGUAGE) {
  if (signature.regime === "FLAT") {
    return {
      regime: "FLAT",
      language,
      llm: false,
      honestNull: true,
      honestNullReport: language === "id" ? buildHonestNullReportId(signature) : buildHonestNullReport(signature),
      fragmentKeys: [],
      fragments: [],
      renderPlan: [],
      scenarios: [],
      systemPrompt: fullSystemPrompt(),
      userPrompt: "",
      userPromptNoPlan: null,
      reportHeadings: [...headingsFor(language)],
      maxTokens: 0,
      budgetWords: 0,
      minWords: 0
    };
  }
  const selection = new Selection();
  const features = [];
  const push = (feature, budgetOverride) => {
    const built = { ...feature, budgetWords: budgetOverride ?? BUDGET[feature.mode] };
    if ((built.mode === "full" || built.mode === "fork") && built.kind !== "provenance" && built.kind !== "weak-signal" && built.kind !== "scenarios") {
      built.instructions = [...built.instructions, DEPTH_CONTRACT];
    }
    features.push(built);
    return built;
  };
  if (signature.regime === "STAIRCASE") {
    selection.dynamic("weak-signal");
    const staircase = signature.shapes.find((s) => s.id === "S5");
    const upper = staircase?.detail.upperEdge ?? [];
    const lower = staircase?.detail.lowerEdge ?? [];
    push({
      id: "weak-signal:staircase",
      kind: "weak-signal",
      title: "Staircase geometry, extremes only",
      section: 2,
      salience: 0,
      mode: "full",
      forkRequired: false,
      functions: [...upper, ...lower],
      mergedFrom: [],
      instructions: [
        "This profile resolves little, so the honest output is SHORT. Do not stretch it: the length rules for a resolved profile do not apply, and section 6 (provenance) is the only part that runs at full length here.",
        "No adjacent rank in this profile is real: no tier boundary exists, so no tiers, no circuit, no shapes, no eruption candidates may be named.",
        `The ONLY licensed content is the contrast between the habits you use most (${fnList(upper)}) and the ones you use least (${fnList(lower)}). Everything between them stays silent. Name them in plain words; never call them "top/bottom", "high/low", or "edges".`,
        "Section 3 must say plainly that behaviour-in-situation predictions need bands this profile does not resolve, so no scenarios are offered, and point to the 256-item Sakinorva Domains Test as a richer input; sections 4 and 5 stay short and name no eruption candidate."
      ]
    });
  } else {
    selectNormal(signature, selection, push);
  }
  selection.add("always.development");
  selection.add("always.state-honesty");
  const scenarios = signature.regime === "STAIRCASE" ? [] : computeScenarios(signature);
  if (signature.regime !== "STAIRCASE") {
    for (const key of FRICTION_KEYS) {
      if (key === "intake-schema") continue;
      selection.add(`friction.${key}`);
    }
    push(
      {
        id: "scenarios",
        kind: "scenarios",
        title: `Self-generated scenarios (${scenarios.map((s) => s.band).join(", ")})`,
        section: 3,
        salience: 58,
        mode: "full",
        forkRequired: false,
        functions: [...new Set(scenarios.flatMap((scenario) => scenario.demands))],
        mergedFrom: [],
        instructions: scenarioInstructions(scenarios)
      },
      // Each vignette carries a scene, three or four if-then signatures and a
      // trade-off line, so this section is budgeted per scenario rather than per feature.
      Math.max(380, scenarios.length * 190)
    );
  }
  push({
    id: "provenance",
    kind: "provenance",
    title: "Where this report comes from (framework provenance)",
    section: 6,
    salience: 90,
    mode: "full",
    forkRequired: false,
    functions: [],
    mergedFrom: [],
    instructions: provenanceInstructions()
  }, 400);
  const renderPlan = orderPlan(features);
  const fragmentKeys = selection.keys();
  const fragments = resolve(fragmentKeys);
  const budgetWords = renderPlan.reduce((sum, feature) => sum + feature.budgetWords, 0);
  const minWords = signature.regime === "NORMAL" ? MIN_REPORT_WORDS : 0;
  const prompted = activeReasoningMode() === PROMPTED_REASONING;
  const promptInput = {
    signature,
    scenarios,
    renderPlan,
    fragments,
    budgetWords,
    minWords,
    language
  };
  return {
    regime: signature.regime,
    language,
    llm: true,
    honestNull: false,
    honestNullReport: null,
    fragmentKeys,
    fragments,
    renderPlan,
    scenarios,
    systemPrompt: fullSystemPrompt(),
    userPrompt: buildUserPrompt({ ...promptInput, plan: prompted }),
    userPromptNoPlan: prompted ? buildUserPrompt({ ...promptInput, plan: false }) : null,
    reportHeadings: [...headingsFor(language)],
    // Output budget (~2.2 tokens/word + slack) PLUS a reasoning allowance sized to the
    // active mode (reasoning bills against the same max_tokens as the report): a wide one
    // for native thinking, a small one for the capped prompted plan, none for `none`.
    // Clamped to MAX_COMPLETION_TOKENS either way.
    maxTokens: Math.min(
      MAX_COMPLETION_TOKENS,
      Math.max(3e3, Math.round(budgetWords * TOKENS_PER_WORD[language]) + 800) + reasoningHeadroomTokens()
    ),
    budgetWords,
    minWords
  };
}
function selectNormal(signature, selection, push) {
  const shapeOf = (id) => signature.shapes.find((s) => s.id === id);
  const floorFeatures = /* @__PURE__ */ new Map();
  const shadowExists = signature.tiers.shadow.length > 0;
  const s7 = shapeOf("S7");
  const s8 = shapeOf("S8");
  if (shadowExists) {
    selection.dynamic("shadow-floor");
    if (s7) selection.shape("S7");
    if (s8) selection.shape("S8");
    const rendered = [...signature.eruption.firm, ...signature.eruption.watch];
    const floors = rendered.length ? rendered.map((candidate) => candidate.fn) : [...signature.tiers.shadow];
    for (const fn of floors) {
      selection.fn(fn, "d");
      const candidate = rendered.find((entry) => entry.fn === fn);
      const firm = candidate?.grade === "firm";
      if (firm) selection.fn(fn, "e");
      const bridge = candidate?.bridge ?? strongestSharingAttitude(signature.scores, fn)?.fn ?? null;
      const marginal = candidate?.marginal ?? false;
      const instructions = [
        `${fn} sits on the shadow floor. Hold all three hypotheses for the boundary above it (suppression, avoidance, simple non-development) and never pick one.`,
        bridge ? `Route any lever through the bridge function ${bridge} (strongest function sharing ${fn}'s attitude). The bridge is NOT the circuit counterweight; never call it one, and never advise developing the floor directly.` : `No same-attitude bridge exists for ${fn}; say so rather than inventing a route.`
      ];
      if (firm) {
        instructions.push(
          `Firm eruption candidate: describe how ${fn} shows up in a rough, clumsy form under strain, in plain everyday behaviour (say "it bursts out in a rough, clumsy form", never "erupts" or "eruption"), plus the early-warning line. The first sign is that your usual strong habits go foggy, before any of the rough behaviour appears.`,
          `Full depth (this is a capped, high-salience feature, so spend the budget): the repression-rebound mechanism and why the gap size matters; what systematic avoidance of this domain looks like day to day; the honest benefit side (not funding this channel frees budget for the lead); at least two early-warning signs the reader could notice this month; the bridge-function route with its activation conditions; and boundary design (pre-arranged cover for contexts that demand ${fn}). Never advise developing the floor directly.`
        );
      } else {
        instructions.push(
          `Watch-item grade only (the boundary above ${fn} is a gap, not a cliff): at most one hedged line, and no eruptive-expression catalog.`
        );
      }
      if (candidate?.axisPartnerElevated) {
        instructions.push(
          `${fn}'s axis partner sits in the lead cluster or an upper edge, so polarization compounds the isolation. This is the strongest form of the reading.`
        );
      }
      const feature = push({
        id: `floor:${fn}`,
        kind: firm ? "shadow-cliff" : "eruption-watch",
        title: firm ? `${fn} shadow floor below a cliff, firm eruption candidate` : `${fn} shadow floor below a gap, hedged watch item`,
        section: 4,
        salience: firm ? 10 : 48,
        mode: firm ? marginal ? "fork" : "full" : "brief",
        forkRequired: firm ? marginal : true,
        functions: [fn],
        mergedFrom: [],
        instructions
      });
      floorFeatures.set(fn, feature);
    }
    if (signature.eruption.summaryOnly.length > 0) {
      push({
        id: "floor:summary",
        kind: "eruption-summary",
        title: "Remaining floor members, one summary line",
        section: 4,
        salience: 49,
        mode: "summary-line",
        forkRequired: false,
        functions: signature.eruption.summaryOnly.map((entry) => entry.fn),
        mergedFrom: [],
        instructions: [
          `The eruption cap bit: ${fnList(signature.eruption.summaryOnly.map((e) => e.fn))} qualify but are NOT rendered individually. One sentence covering them as a set, never a catalog, never their eruptive expressions.`
        ]
      });
    }
  }
  const circuit = signature.circuit;
  if (circuit) {
    selection.shape("S12");
    selection.dynamic(circuit.kind === "internal" ? "internal-circuit" : "external-circuit");
    selection.fn(circuit.counterweight, "h");
    const pair = compositionPair(signature);
    push({
      id: "circuit",
      kind: "circuit",
      title: `${circuit.kind === "internal" ? "Internal" : "External"} closed circuit (${circuit.grade}), counterweight ${circuit.counterweight}`,
      section: 2,
      salience: circuit.grade === "sealed" ? 20 : 25,
      mode: circuit.marginal ? "fork" : "full",
      forkRequired: circuit.marginal,
      functions: [...circuit.lead, circuit.counterweight],
      mergedFrom: [],
      instructions: [
        `Private evidence, never print: the loop reads ${circuit.grade} (strength ${circuit.strength}); its members are ${fnList(circuit.lead)} and the way back in is ${circuit.counterweight}. In the report, describe two habits that team up and crowd the others out, name each habit in everyday words, and call ${circuit.counterweight} a gentle way back toward balance. No number, no grade word, no code, and never the words "circuit", "counterweight", "closed loop" or "loop".`,
        `Compose the variant from ${pair.join("/")} using those functions' own blocks (rule of composition): if that pair matches one of the named composition variants use it, otherwise build the variant from these two functions. Never ship shape-generic prose.`,
        `Name the counterweight's activation conditions in its own currency, in section 5.`,
        circuit.fromSmearedLead ? "The lead was read off a smeared top segment's upper edge. Say that the reading rests on it." : "Do not order the lead members if there is more than one; they are a set."
      ]
    });
  } else if (signature.balancedLead) {
    selection.dynamic("balanced-lead");
    push({
      id: "balanced-lead",
      kind: "balanced-lead",
      title: "Attitude-balanced lead, no circuit fires",
      section: 2,
      salience: 42,
      mode: "full",
      forkRequired: false,
      functions: [...signature.operativeLead],
      mergedFrom: [],
      instructions: [
        `The lead (${fnList(signature.operativeLead)}) carries both attitudes, so no circuit reading is available. Mutually exclusive by construction. Never name a counterweight.`,
        "Balance is not praise: name the switching overhead and the genuine indecision under time pressure, and give the behavioral tell (the same decision re-made once in each channel within days), not a felt sense.",
        "Name arbitration conditions rather than exit ramps: which contexts get the inner channel's final vote and which the outer's."
      ]
    });
  }
  const s1 = shapeOf("S1");
  if (s1) {
    selection.shape("S1");
    selection.dynamic("lead-spike");
    const leadFn = s1.members[0];
    selection.fn(leadFn, "b");
    const axis = signature.indices.axes[AXIS_OF[leadFn]];
    const overEngaged = axis.class === "polarized" || axis.class === "extreme";
    if (overEngaged) selection.fn(leadFn, "c");
    push({
      id: "lead:S1",
      kind: "lead-shape",
      title: `Lead spike: ${leadFn} (${String(s1.grade)})`,
      section: 2,
      salience: 40,
      mode: s1.marginal ? "fork" : "full",
      forkRequired: s1.marginal,
      functions: [leadFn],
      mergedFrom: [],
      instructions: [
        `Private evidence, never print: the lead reads ${String(s1.grade)}, standing ${String(s1.detail.gap)} above the next habit. Translate that into how strongly one habit leads ("clearly out in front" vs "only just ahead") with no number and no grade word.`,
        s1.marginal ? "Marginal: render as a fork. (A) a single lead feeding the band below it, (B) no true lead but a wider working cluster. Plus the observation that decides it. One-sided rendering here is a generation error." : "Firm enough to state as a pattern, still as a hypothesis to test.",
        overEngaged ? `The ${axisLabel(axis.axis)} axis is ${axis.class}, which licenses ${leadFn}'s over-engaged block: pair the engaged reading with its over-engaged cost.` : `The ${axisLabel(axis.axis)} axis is ${axis.class}, so the over-engaged reading is NOT licensed. Engaged expression only.`,
        "The geometry shows over-reliance, not talent. A spike over a strong band is resilient; a spike over a desert is brittle. Say which this is."
      ]
    });
  }
  for (const [id, dynamic] of [
    ["S2", "pluralistic"],
    ["S3", "pluralistic"]
  ]) {
    const shape2 = shapeOf(id);
    if (!shape2) continue;
    selection.shape(id);
    selection.dynamic(dynamic);
    for (const fn of shape2.members) selection.fn(fn, "b");
    push({
      id: `lead:${id}`,
      kind: "lead-shape",
      title: id === "S2" ? `Twin-peak lead: ${fnList(shape2.members)}` : `Pluralistic lead cluster: ${fnList(shape2.members)}`,
      section: 2,
      salience: 40,
      mode: shape2.hedged ? "fork" : "full",
      forkRequired: shape2.hedged,
      functions: [...shape2.members],
      mergedFrom: [],
      instructions: [
        `Members are a set: ${fnList(shape2.members)}. Too close to tell apart, treat them as roughly equal, with no clear front-runner, never rank or adjective-rank them.`,
        "Hold both hypotheses at once: deliberative flexibility versus decision friction. The flattering read never ships without the friction read.",
        shape2.variant ? `Composition variant from the Signature: ${shape2.variant}.` : "Compose from the members' own blocks, not from generic cluster prose."
      ]
    });
  }
  const s3b = shapeOf("S3b");
  if (s3b) {
    selection.shape("S3b");
    selection.dynamic("pluralistic");
    for (const fn of s3b.members) selection.fn(fn, "h");
    push({
      id: "lead:S3b",
      kind: "sub-cluster",
      title: `Pluralistic sub-cluster (watch item): ${fnList(s3b.members)}`,
      section: 2,
      salience: 45,
      mode: "fork",
      forkRequired: true,
      functions: [...s3b.members],
      mergedFrom: [],
      instructions: [
        `Never call ${fnList(s3b.members)} a lead cluster. Membership rests on a marginal boundary and edge windows (source: ${String(s3b.detail.source)}, span ${String(s3b.detail.span)}), so the whole reading is watch-item grade and must be a fork.`,
        "Order is unknown. The members are a set, interpreted through their supporting blocks."
      ]
    });
  }
  const s4 = shapeOf("S4");
  if (s4) {
    selection.shape("S4");
    push({
      id: "lead:S4",
      kind: "lead-shape",
      title: `Compressed top: ${fnList(s4.members)}`,
      section: 2,
      salience: 41,
      mode: "full",
      forkRequired: false,
      functions: [...s4.members],
      mergedFrom: [],
      instructions: [
        "Four or more functions share the top segment: no lead is resolvable. Say that plainly rather than picking one, and never rank inside the segment."
      ]
    });
  }
  if (s8) {
    push({
      id: "bimodal:S8",
      kind: "shadow-cliff",
      title: `Bimodal split across a cliff of ${String(s8.detail.gap)}`,
      section: 2,
      salience: 12,
      mode: s8.marginal ? "fork" : "full",
      forkRequired: s8.marginal,
      functions: [...s8.members],
      mergedFrom: [],
      instructions: [
        `Two clear clusters with a big drop between: the habits you use most (${fnList(s8.detail.highGroup)}) and the ones you rarely turn to (${fnList(s8.detail.lowGroup)}), with little in between. In the report, name each habit in plain words and describe "the ones you lean on" versus "the ones you rarely reach for". Never "high group", "low group", "top", "bottom", or "shadow floor". The rarely-used ones are the habits that can burst out roughly under strain; keep to two.`
      ]
    });
  }
  const polarizedAxes = signature.indices.axisOrder.filter((axis) => {
    const cls = signature.indices.axes[axis].class;
    return cls === "polarized" || cls === "extreme";
  });
  if (polarizedAxes.length > 0) {
    selection.dynamic("polarized-axes");
    selection.shape("S9");
  }
  let axisRenderedInFull = false;
  for (const axisKey of polarizedAxes) {
    const axis = signature.indices.axes[axisKey];
    const perAxisLine = `in plain everyday words, ${axis.high} is the far stronger side and ${axis.low} the neglected one. Say what each habit is. Never print a code, an arrow, or a number`;
    const converged = floorFeatures.get(axis.low);
    if (converged) {
      const takesFullTreatment = !axisRenderedInFull;
      converged.axis = axisKey;
      converged.mergedFrom.push(`axis:${axisKey}`, converged.id);
      converged.salience = Math.min(converged.salience, axis.class === "extreme" ? 30 : 35);
      converged.title = `${converged.title}, convergent with the ${axisLabel(axisKey)} ${axis.class} axis (${axis.pol})`;
      converged.functions = [.../* @__PURE__ */ new Set([...converged.functions, axis.high, axis.low])];
      converged.instructions.push(
        `Convergent detection (private): the ${axisLabel(axisKey)} pair is ${axis.class}, and its low side is this least-used habit. Report the two as ONE reading, once and strongly. Never as two separate findings. Say it in plain words: ${perAxisLine}.`,
        `Attach the cost to the very same lopsidedness that buys the strength, in plain words: the same strong lean toward ${axis.high} and away from ${axis.low} that gives its power is what costs on the other side. Name both sides in everyday words; never print a number.`
      );
      if (takesFullTreatment) {
        setMode(converged, converged.forkRequired || axis.borderline ? "fork" : "full");
        if (converged.kind === "eruption-watch") {
          converged.instructions.push(
            "The axis half of this feature carries the full treatment; the floor half stays one hedged watch line inside it. A gap, not a cliff, licenses nothing firmer."
          );
        }
      } else {
        converged.instructions.push(
          `Rendering cap: the ${axisLabel(polarizedAxes[0])} axis already took the fullest axis treatment, so this axis contributes a short paragraph inside this feature, no more.`
        );
      }
      axisRenderedInFull = true;
      continue;
    }
    const full = !axisRenderedInFull;
    axisRenderedInFull = true;
    push({
      id: `axis:${axisKey}`,
      kind: "axis",
      title: `${axisLabel(axisKey)} ${axis.class} (${axis.pol})`,
      section: 2,
      salience: axis.class === "extreme" ? 30 : 35,
      mode: full ? axis.borderline ? "fork" : "full" : "short-paragraph",
      forkRequired: full ? axis.borderline : false,
      axis: axisKey,
      functions: [axis.high, axis.low],
      mergedFrom: [],
      instructions: full ? [
        `Most polarized axis, the one rendered in full. Say it in plain words: ${perAxisLine}.`,
        `Leaning hard on one side is specialization: name in plain words the strength on the ${axis.high} side and the blind spot on the ${axis.low} side, tied to that same one lean.`,
        "Full depth: the contrarian-influence mechanism (the disowned pole still shapes the worldview through what gets defined as unimportant), what the axis-failure signature looks like in ordinary weeks, the graded low-stakes exposure that is the only licensed exit, and what fluent handling of the low pole would falsify.",
        axis.borderline ? "Borderline past its threshold: render as a fork, not a firm pattern." : "The starved pole is repressed rather than absent. It still shapes the worldview through what gets disowned or defined as unimportant."
      ] : [
        `Rendering cap, relaxed for the comprehensive format: a SHORT PARAGRAPH (not one sentence, not a full treatment; the ${axisLabel(polarizedAxes[0])} axis already took that). Say it in plain words: ${perAxisLine}. Name the mechanism and one observable marker, and stop.`
      ]
    });
  }
  const balancedHigh = signature.indices.axisOrder.filter(
    (axis) => signature.indices.axes[axis].class === "balanced-high"
  );
  balancedHigh.forEach((axisKey, index) => {
    const axis = signature.indices.axes[axisKey];
    if (index === 0) selection.shape("S10");
    push({
      id: `axis:${axisKey}`,
      kind: "balanced-high-axis",
      title: `${axisLabel(axisKey)} balanced-high (${axis.pol})`,
      section: 2,
      salience: 60,
      mode: index === 0 ? "fork" : "short-paragraph",
      forkRequired: index === 0,
      axis: axisKey,
      functions: [...axis.members],
      mergedFrom: [],
      instructions: index === 0 ? [
        "The one balanced-high fork allowed: flexible switching OR unresolved tension. Adjudicate with behavioral markers: a stable context-keyed assignment versus observable re-decision. Never with a felt sense of being torn.",
        `The two poles (${fnList(axis.members)}) are within the noise band: too close to tell apart, treat them as roughly equal, with no clear front-runner.`
      ] : [
        "Beyond the one-fork cap: a short paragraph at most, and no second fork. name the mechanism and one behavioral marker, then stop."
      ]
    });
  });
  const balancedLow = signature.indices.axisOrder.filter(
    (axis) => signature.indices.axes[axis].class === "balanced-low"
  );
  if (balancedLow.length > 0) {
    selection.shape("S11");
    for (const axisKey of balancedLow) {
      const axis = signature.indices.axes[axisKey];
      push({
        id: `axis:${axisKey}`,
        kind: "quiet-axis",
        title: `${axisLabel(axisKey)} balanced-low (${axis.pol}), quiet channel`,
        section: 2,
        salience: 65,
        mode: "brief",
        forkRequired: false,
        axis: axisKey,
        functions: [...axis.members],
        mergedFrom: [],
        instructions: [
          `Quiet pair: one or two plain lines, then stop. Both of these two opposite habits (${fnList(axis.members)}) are ones you rarely lean on right now. Say so gently and move on. This is not a fault or a verdict about ability. Name the two habits in plain words; never call this "low", a "quiet channel", or "balanced-low", and attach no number. The two are too close to tell apart. Treat them as roughly equal, with no clear front-runner.`
        ]
      });
    }
  }
  const jp = signature.indices.jp.composition;
  if (jp.fires) {
    selection.dynamic("jp-pressure");
    const lever = jp.starvedSide ? strongestOfOrientation(signature, jp.starvedSide) : null;
    if (lever) selection.fn(lever, "h");
    push({
      id: "jp-pressure",
      kind: "jp-pressure",
      title: `${jp.fires === "judging-pressure" ? "Judging" : "Perceiving"} pressure (active set ${fnList(jp.activeSet)})`,
      section: 2,
      salience: 55,
      mode: "full",
      forkRequired: false,
      functions: [...jp.activeSet, ...lever ? [lever] : []],
      mergedFrom: [],
      instructions: [
        `The active set is uniform (${fnList(jp.activeSet)}), so ${jp.fires} fires. Neither reading is the flattering one: decisiveness bought with accuracy, or openness bought with paralysis. Describe it as a habit of mind in plain words (for example, 'you put more energy into settling things than into gathering what is around you'); never label it 'judging vs perceiving', 'deciding vs taking in', or an 'inward/outward side'.`,
        lever ? `Starved-side lever: ${lever}, the strongest ${jp.starvedSide} function. Name its activation conditions in section 5 (intake rituals before decisions, or artificial closure devices), never a personality prescription.` : "No starved-side lever is computable; say so rather than inventing one."
      ]
    });
  } else if (jp.note) {
    push({
      id: "jp-note",
      kind: "jp-note",
      title: "Mixed active set, one hedged composition note",
      section: 2,
      salience: 66,
      mode: "brief",
      forkRequired: false,
      functions: [...jp.activeSet],
      mergedFrom: [],
      instructions: [
        `Neither judging nor perceiving pressure fires: the active set is mixed. The single licensed note, watch-item grade: "${jp.note}". No pressure dynamic, no fragment, no second sentence.`
      ]
    });
  }
}
function setMode(feature, mode) {
  feature.mode = mode;
  feature.budgetWords = BUDGET[mode];
}
function orderPlan(features) {
  return features.map((feature, index) => ({ feature, index })).sort(
    (a, b) => a.feature.salience === b.feature.salience ? a.index - b.index : a.feature.salience - b.feature.salience
  ).map((entry) => entry.feature);
}
function provenanceInstructions() {
  return [
    "300-500 words. This section says nothing about the person. It explains where the method comes from and what we did with it. No numbers, no predictions.",
    `Sources (community ideas): we took ideas from four guides on mbti-notes.tumblr.com (Type Fundamentals, Function Theory, Type Development, Type Spotting) and from Naomi Quenk's "grip" idea. These are personality-community writing. They have never been tested by science. Say that plainly.`,
    `What we changed (our guess): those sources tie their patterns to 16 fixed types. We kept the patterns but read them from the person's quiz scores instead. We look at the gaps between scores, and we ignore the fixed type order. Real quiz results almost never match one of the 16 classic orders (only 16 out of 40,320 possible orders are "classic"). This change is our own guess. It has never been tested.`,
    "Why we give no type label: eight separate scores tell more than 16 boxes. Published research rejected fixed function order (Reynierse 2009). A type label would be a claim we cannot back up.",
    'What rests on real science: the "if this situation, then this response" idea comes from Mischel and Shoda (1995). The finding that people move through many states comes from Fleeson (2001). The if-then shape is real science. Every guess about which habit fits which situation is still ours.',
    "Be honest about the input: the eight scores come from a hobby quiz that has never been tested for accuracy. People often get different results on retake.",
    'Use the simplest words possible. Keep sentences under 15 words. Say "this tool" or "this method" or "the quiz," never "pipeline" or "framework" or "instrument" or "validity evidence." Say "your answers" or "your results," never "your scores" or "ranked." The disclaimer block at the end is fixed. Copy it exactly as given. Keep confidence levels clear here too. This section is where the reader learns which parts are science and which are our guesses.'
  ];
}
function scenarioInstructions(scenarios) {
  const instructions = [
    `Render ALL ${scenarios.length} scenarios below, each as its own vignette, in this order. Add no scenario and drop none.`,
    'Open every vignette by setting the scene naturally. Paint the situation so the reader can picture who is there, what needs doing, when and where it happens, why it matters, and how the person has to handle it. Weave all of this into two or three tight sentences. Do not use labels like "Who", "What", "When". The scene given for each scenario is the seed: keep its substance. You may add concrete everyday texture to make it feel like a real situation (that texture is invented, so phrase it as a guess).',
    'Then, for each scenario, THREE TO FOUR if-then signatures in the canonical template: "When [situation detail], you likely [observable prediction]; if instead you find [counter-observation], that would tell us [revision]." No falsifier, no signature. Vary what the signatures read: the demand itself, the workaround substitution it invites, the modifiers stacked on it, and what it bills afterwards.',
    "Then close each scenario with one trade-off line. What this situation costs this profile, attached to the same feature that makes it easy or hard.",
    "One honest line for the section, in your own words: these situations are hypothetical and were built from the profile itself, so the reader should test them against real life rather than take them as descriptions of their actual week. Do not claim they were personalised, and do not pretend the reader described any situation.",
    "Each scenario is a DIFFERENT supply grade on purpose, so the vignettes must read differently: flow, stretch and friction predict different failures. A flow verdict is not praise. Name what that situation is NOT exercising.",
    `Demand weighting, a PRIVATE procedure for choosing what each scenario demands (hardcoded rule, follow exactly; never mention weighting, grades, or any of this to the reader): ${DEMAND_WEIGHTING_RULE}`,
    "The demand-to-function mapping comes from the taxonomy fragment; the supply grade comes from supplyGrades[function] in the Signature. Never re-derive a grade, never infer one from a raw score, and NEVER print the grade word. Translate each grade into how the situation is likely to feel: flow = comes easily; near-flow = mostly comfortable; scaffolded-stretch = doable with effort and support; friction = a real strain. Name every demanded habit in everyday words (Rule 0.5)."
  ];
  for (const scenario of scenarios) {
    const scene = [
      `People: ${scenario.frame.who}`,
      `Task: ${scenario.frame.what}`,
      `Timing: ${scenario.frame.when}`,
      `Setting: ${scenario.frame.where}`,
      `Stakes: ${scenario.frame.why}`,
      `Approach: ${scenario.frame.how}`
    ].join(". ");
    const line = `SCENARIO ${scenario.band.toUpperCase()} (all of this is PRIVATE, translate to plain words, print none of it): ${scenario.demandType}; demands ${fnList(scenario.demands)}; supply grade of ${scenario.demands[0]}: ${scenario.supplyGrade} (say how it FEELS, never the grade word). Scene: ${scene}`;
    instructions.push(line);
    if (scenario.band === "eruption-risk" && scenario.eruptionFn) {
      instructions.push(
        `  ...and overlay these escalation modifiers on that scene: ${scenario.modifiers.join("; ")}. That is three modifiers on a friction demand, so eruption risk is FLAGGED for ${scenario.eruptionFn}: predict its crude form under depletion, name the early-warning sign to watch for first (the loss of ordinary lead-function quality, before any of the crude behaviour), and keep it hedged. This is a generalized community concept, not a finding.`
      );
    }
  }
  return instructions;
}
var FRAMEWORK_PROVENANCE_TEXT = [
  "We built this report from a small set of sources. Some are strong. Some are not. Here is what comes from where.",
  "",
  `Most of the ideas come from personality-community writing. Four guides on mbti-notes.tumblr.com (Type Fundamentals, Function Theory, Type Development, Type Spotting) and Naomi Quenk's idea of the "grip." These writers deserve credit. But none of this has been tested by science.`,
  "",
  'Those sources describe patterns they call "loops" and "grips." These are about which mental habits you use together, which you avoid, and which come out when you are tired. The original sources tie these patterns to 16 fixed types.',
  "",
  'We did something different. We kept the patterns but stopped tying them to fixed types. Instead, we read them from your quiz scores. We look at the gaps between your numbers. We do this because real scores almost never match one of the 16 fixed orders. There are 40,320 possible orders, and only 16 are the "classic" ones. This change is our own guess. It has never been tested.',
  "",
  "That is also why we give you no four-letter type label. Eight separate scores tell us more than one box out of 16. Published research also rejected the idea of a fixed order (Reynierse, 2009). A type label would be a claim we cannot back up.",
  "",
  'One part of this report does rest on real science. The idea that people act in "if this situation, then this response" patterns comes from Mischel and Shoda (1995). The finding that people move through many states, not just one fixed personality, comes from Fleeson (2001). That is why this report does not describe you in general. It builds specific situations and guesses how you would act in each one. The "if-then" shape is real science. Every guess about which habit fits which situation is still ours.',
  "",
  "Last: your eight scores come from a hobby quiz with no published proof that it works. People often get different results when they take it again."
].join("\n");
function buildHonestNullReport(signature) {
  const watch = signature.watchItem;
  const PLAIN = {
    Ni: "your gut sense of where things are heading",
    Ne: "your knack for new ideas and what-ifs",
    Si: "your habit of leaning on what has worked before",
    Se: "your focus on what is right in front of you",
    Ti: "your habit of working things out in your own head",
    Te: "your habit of organizing and getting things done",
    Fi: "your inner sense of what feels right",
    Fe: "your habit of tuning into how other people feel"
  };
  const lines = [
    REPORT_HEADINGS[4],
    "",
    FRAMEWORK_PROVENANCE_TEXT,
    "",
    REPORT_HEADINGS[5],
    "",
    "Your eight answers came out very close together. The differences between them are too small for this quiz to read clearly. We cannot write a useful report from these results. Anything we said would be true of almost anyone.",
    "",
    "We cannot say which habit you lean on most, which ones work together, or which one you avoid. All of those readings need bigger differences than your answers show. A flat result usually means the quiz did a poor job, and three explanations are equally possible: you may truly shift with the situation, you may have answered near the middle each time, or you may have rushed through the quiz that day. This says nothing about your ability, your mental health, or your worth.",
    ""
  ];
  if (watch) {
    lines.push(
      `One small thing worth noting: the biggest gap between any two of your answers is ${PLAIN[watch.above]} sitting just above ${PLAIN[watch.below]}. This is a small hint, and it could just be noise. If you take the quiz again and this gap gets bigger, it would be worth a closer look.`,
      ""
    );
  }
  lines.push(
    "What might help: take the quiz again on a different day. Or try the longer Sakinorva Domains Test (256 questions), which can pick up smaller differences. Either one gives a better chance of getting results with a clear shape.",
    "",
    `> ${getDisclaimer()}`,
    ""
  );
  return lines.join("\n");
}
var PLANNING_PASS_INSTRUCTIONS = [
  "**PLANNING PASS (write this FIRST, before the first heading).** Begin your output with a planning pass: private working notes, not report prose. Everything before the first heading is stripped from the report and shown only as raw scratch work, so the reader never receives it as report text. This is where your thinking happens \u2014 do it on the page, in six stages, numbered:",
  "1. EVIDENCE SCAN. Read the whole signature before interpreting any of it. List the three or four strongest geometric facts in salience order, every marginal detection (these MUST become forks, decide that now), and what did NOT fire \u2014 a quiet axis, an absent circuit, an empty eruption list. What is absent constrains what you may say as hard as what is present. Note the regime: a profile that resolves little licenses a short plan and a short report \u2014 never manufacture depth the geometry does not carry.",
  "2. FEATURE READINGS. For each feature in the render plan, one compact line: the everyday words you will use for its habits; the mechanism it reads (name it); both sides of its trade-off; and the boldest defensible prediction the fragments do NOT already state, with the observation that would kill it. Specific-and-checkable beats vague-and-safe every time \u2014 a reader can test a sharp guess, not a mushy one.",
  "3. COMPOSITION HUNT. This is the core of the plan. Generate four to six candidate combinations of the fired features (pairs and triples). For each candidate, ask: what does this combination predict that no single feature predicts alone \u2014 about how this person argues, decides, procrastinates, burns out, recovers, repairs a mistake? Write the candidate down even if you then reject it. Keep the two or three whose predictions are most specific and most surprising while still running through named mechanisms; explicitly discard the generic ones and say why. No fragment states these interactions; deriving them is the report's most valuable content. When the render plan lists fewer than three features, skip the hunt: note what the sparse geometry licenses and move on \u2014 the instructions in the plan outrank this stage.",
  "4. SCENARIO SKETCHES (skip this stage entirely when no scenarios are listed). One line each: the demanded habit and how its supply grade will FEEL in the scene; the sharpest if-then signature you can draft for it; the workaround this profile would reach for instead (substituting a stronger habit); and what that workaround costs or bills later.",
  "5. ADVERSARIAL PASS. Attack your own plan the way the audit will. For each planned claim: would the OPPOSITE profile (lead and floor swapped) accept it as accurate? Then it says nothing \u2014 sharpen it until it discriminates, or drop it. Which credited strength still lacks a cost tied to the SAME feature? Which section still lacks its falsifiable prediction with a counter-observation? Is any tie about to be ranked, any marginal feature about to be stated one-sidedly, any grade word, number, or two-letter code about to leak into report prose? Fix each problem here, in the plan, where it is one line \u2014 not in the report, where it is a rewrite.",
  "6. ARC AND CLOSE. State the through-line in one sentence: the one thing this signature is about, which every section should serve. Then: which composition anchors section 2; which experiment in section 5 tests which named hypothesis from sections 2-4 (every lever must trace back to one); and how section 7 names the limits without taking back what the report actually said.",
  'Plan budget: 500-900 words, never more than 1200. Spend the depth on stages 3 and 5. Plain prose lines and list numbers only: no markdown headings, no line starting with "#". Codes, grades, internal terms and figures ARE allowed in the plan (it is private and is not the report). Write the plan in English whatever language the report is written in.',
  'Then write the report, starting directly at the first canonical heading. The report must stand alone: never refer to the plan, never write "as planned" or "as noted above".'
];
var GROUP_TITLES = {
  shapes: "Shapes (02 \xA74 hypotheses, detection and grades stripped; grades come from the Signature above)",
  dynamics: "Dynamics (03, shape skeletons; compose them with the functions named in the render plan)",
  functions: "Functions (01, per-function engagement states)",
  friction: "Friction machinery (04 \xA7b-\xA7d, the intake schema is omitted: there is no reader intake)",
  always: "Always on (03 \xA710, 04 \xA7f, these frame every other section)"
};
function buildUserPrompt(input) {
  const { signature, scenarios, renderPlan, fragments } = input;
  const { budgetWords, minWords, language, plan } = input;
  const out = [];
  out.push("# 1. STACK SIGNATURE (computed, authoritative)");
  out.push("");
  out.push(
    "All geometry is here. Treat every number, grade, and code as PRIVATE EVIDENCE for your reasoning only; never print, quote, or cite any of it in the report. Translate each into plain everyday words (Rule 0.5). Never re-derive a number and never rank functions that sit inside a tie."
  );
  out.push("");
  out.push("```json");
  out.push(JSON.stringify(signature, null, 2));
  out.push("```");
  out.push("");
  out.push("# 2. RAW SCORES AND GENERATED SCENARIOS (all PRIVATE, never printed to the reader)");
  out.push("");
  out.push(
    "Scores as entered, never clamped or normalized (PRIVATE EVIDENCE, never print or cite a number): " + inputOrder(signature.scores).map((fn) => `${fn} ${signature.scores[fn]}`).join(" \xB7 ")
  );
  out.push("");
  if (signature.warnings.length > 0) {
    out.push("Measurement warnings carried from the computation:");
    for (const warning of signature.warnings) out.push(`- ${warning}`);
    out.push("");
  }
  if (scenarios.length > 0) {
    out.push(
      `Section 3 asks one question: if a certain situation, how does this person tend to behave? The report supplies the situations itself. These ${scenarios.length} were computed by crossing the demand taxonomy with this profile's supply grades, so the set spans the ladder on purpose. Everything in the list below (the demands, the supply grades, the row labels) is PRIVATE evidence: translate it into how each situation is likely to FEEL, name every habit in everyday words, and print none of the labels, grades, or codes:`
    );
    out.push("");
    for (const scenario of scenarios) {
      out.push(
        `- ${scenario.band} (private), ${scenario.demandType}; demands ${fnList(scenario.demands)}; supply grade of ${scenario.demands[0]}: ${scenario.supplyGrade} (translate to a feeling-word; never print it).`
      );
      out.push(`    - People: ${scenario.frame.who}`);
      out.push(`    - Task: ${scenario.frame.what}`);
      out.push(`    - Timing: ${scenario.frame.when}`);
      out.push(`    - Setting: ${scenario.frame.where}`);
      out.push(`    - Stakes: ${scenario.frame.why}`);
      out.push(`    - Approach: ${scenario.frame.how}`);
      if (scenario.modifiers.length > 0) {
        out.push(`    - ESCALATION OVERLAY: ${scenario.modifiers.join("; ")}`);
      }
    }
    out.push("");
    out.push(
      "These situations are hypothetical and generic; only the predictions about them are keyed to this profile. Never imply the reader described any of them."
    );
  } else {
    out.push(
      "No scenarios were generated: this profile resolves no bands, so no demand can be graded against it. Say that plainly in section 3 and invent nothing."
    );
  }
  out.push("");
  out.push("# 3. RENDER PLAN (computed, the airtime allocation)");
  out.push("");
  out.push(
    "Ordered by salience. Render every feature, in the section named, at roughly its word budget; add no feature that is not listed and drop none that is. Fork-required features must be rendered as fork statements."
  );
  out.push("");
  out.push(
    `Total allocated budget: ~${budgetWords} words across ${renderPlan.length} features.`
  );
  if (minWords > 0) {
    out.push(
      `**Length contract: HARD MINIMUM ${minWords} words. Target: this plan's own total, ~${budgetWords} words. A typical resolved profile lands in ${TARGET_REPORT_WORDS[0]}\u2013${TARGET_REPORT_WORDS[1]}.** This profile resolves real structure, so a short report would waste it. Buy the length with depth on the features below and with composition between them (Rule 0 and the inventiveness license in your instructions). Never with generic prose, never with a feature this plan does not list.`
    );
  } else {
    out.push(
      "**No length minimum applies.** This profile resolves little; the honest output is short. Only the provenance section runs at full length. Padding here would be a generation error."
    );
  }
  out.push("");
  out.push(
    "HOW TO READ THIS PLAN (critical): every feature title and instruction below is INTERNAL shorthand for you. Titles, tier names, grades, the two-letter habit codes (Ni, Ti, \u2026), internal terms (shadow floor, bridge, counterweight, active set, axis, polarized, cliff, gap, circuit, supply grade) and every number are PRIVATE EVIDENCE. Never reproduce a title, a code, an internal term, or a figure in the report. Replace every code with its everyday words (Rule 0.5) and every internal term with a plain description; print no number about the person. The word budgets are for you; never mention them."
  );
  out.push("");
  renderPlan.forEach((feature, index) => {
    out.push(
      `${index + 1}. **${feature.title}**, section ${feature.section} \xB7 mode: ${feature.mode} \xB7 budget ~${feature.budgetWords} words${feature.forkRequired ? " \xB7 FORK REQUIRED (render as a fork statement)" : ""}${feature.mergedFrom.length > 0 ? " \xB7 MERGED convergent detection: render once, not twice" : ""}`
    );
    for (const instruction of feature.instructions) out.push(`   - ${instruction}`);
  });
  out.push("");
  out.push("# 4. KNOWLEDGE-BASE FRAGMENTS (the only interpretive material licensed here)");
  out.push("");
  let currentGroup = null;
  for (const fragment of fragments) {
    if (fragment.group !== currentGroup) {
      currentGroup = fragment.group;
      out.push(`## ${GROUP_TITLES[currentGroup]}`);
      out.push("");
    }
    out.push(`### ${fragment.key}`);
    out.push("");
    out.push(fragment.text);
    out.push("");
  }
  out.push("# 5. RENDER INSTRUCTION");
  out.push("");
  for (const line of languageDirective(language)) out.push(line);
  out.push("");
  if (plan) {
    for (const line of PLANNING_PASS_INSTRUCTIONS) out.push(line);
    out.push("");
  }
  out.push(
    "Write Sections 2\u20137 ONLY. Section 1 is rendered client-side from the Signature above; do not restate it. Use EXACTLY these markdown headings, in this order, with nothing " + (plan ? "before the first one except the planning pass described above " : "before the first one ") + "(the client matches these strings to render its cards):"
  );
  out.push("");
  for (const heading of headingsFor(language)) out.push(`- \`${heading}\``);
  out.push("");
  out.push(
    "Obey the render plan's ordering, modes and word budgets. Ground every paragraph in a named feature of the Signature plus a named mechanism (Rule 0), and compose the fired features into readings no single fragment states. Phrase those composed readings as guesses. Keep every confidence level audible. Print no number, score, grade, or two-letter habit code anywhere in the report, and name every mental habit with its everyday words (Rule 0.5). End the report with this disclaimer block, reproduced verbatim as a markdown blockquote, and write nothing after it:"
  );
  out.push("");
  out.push(`> ${disclaimerFor(language)}`);
  out.push("");
  return out.join("\n");
}

// src/server/guards.ts
var RULES_EN = [
  {
    id: "type-code",
    pattern: /\b[IE][NS][TF][JP]\b/g,
    describe: (m) => `prohibited output 1 (type codes): "${m}" is a 16-type code`
  },
  {
    id: "type-noun",
    pattern: /\b(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)[- ]doms?\b|\b(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)[- ]dominants?\b/gi,
    describe: (m) => `prohibited output 1 (type nouns): "${m}" turns a function into an identity noun`
  },
  {
    id: "type-noun-prefixed",
    pattern: /\b(?:dom|aux|auxiliary|inferior|tertiary)\s+(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)\b/gi,
    describe: (m) => `prohibited output 1 (type nouns): "${m}" names a stack position`
  },
  {
    id: "rarity",
    pattern: /\d+\s*% of (?:people|profiles)|percentile/gi,
    describe: (m) => `prohibited output 5 / gate C6 (no norms): "${m}" is a rarity or percentile claim`
  },
  {
    id: "clinical",
    pattern: /\b(?:disorders?|trauma response|depressive|narcissistic|diagnos(?:is|es|ed|ing))\b/gi,
    describe: (m) => `prohibited output 3 (clinical vocabulary): "${m}"`
  },
  {
    id: "essentialist",
    pattern: /\byou will (?:always|never)\b|\byour true (?:self|nature)\b|\byou are and always will be\b/gi,
    describe: (m) => `prohibited output 4 (essentialist framing): "${m}"`
  }
];
var RULES_ID = [
  {
    id: "clinical-id",
    // (?:men|di)? covers the standard verb prefixes (mendiagnosis, didiagnosa, …);
    // narsis(?:is)?tik covers both the KBBI and the everyday spelling.
    pattern: /\bgangguan (?:jiwa|mental|kepribadian)\b|\brespons trauma\b|\bdepresif?\b|\bnarsis(?:is)?tik\b|\b(?:men|di)?diagnos(?:is|a)\b/gi,
    describe: (m) => `prohibited output 3 (clinical vocabulary): "${m}"`
  },
  {
    id: "essentialist-id",
    pattern: /\bkamu akan selalu\b|\bkamu tidak akan pernah\b|\bdirimu yang se(?:benarnya|jati)\b|\bsifat aslimu\b|\bjati dirimu\b/gi,
    describe: (m) => `prohibited output 4 (essentialist framing): "${m}"`
  },
  {
    id: "rarity-id",
    // "dari" is optional in Indonesian percentage-of-people claims ("10% orang").
    pattern: /\d+\s*% (?:dari )?(?:orang|profil|populasi)|\bpersentil\b/gi,
    describe: (m) => `prohibited output 5 / gate C6 (no norms): "${m}" is a rarity or percentile claim`
  }
];
function rulesFor(language) {
  return language === "id" ? [...RULES_EN, ...RULES_ID] : RULES_EN;
}
var DISCLAIMER_MARKERS = {
  en: { start: "What this is and is not.", end: "A qualified professional can." },
  id: { start: "Apa ini dan apa yang bukan.", end: "yang berkualifikasi bisa." }
};
function normalize(text) {
  return text.replace(/^[ \t]*>[ \t]?/gm, "").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}
function hasDisclaimer(text, language = DEFAULT_REPORT_LANGUAGE) {
  return normalize(text).includes(normalize(disclaimerFor(language)));
}
function ensureDisclaimer(text, language = DEFAULT_REPORT_LANGUAGE) {
  if (hasDisclaimer(text, language)) return text;
  return `${text}

${disclaimerBlock(language)}
`;
}
function disclaimerBlock(language = DEFAULT_REPORT_LANGUAGE) {
  return `> ${disclaimerFor(language)}`;
}
function auditReport(text, language = DEFAULT_REPORT_LANGUAGE) {
  const violations = [];
  const body = stripDisclaimer(text, language);
  const emitted = /* @__PURE__ */ new Set();
  for (const rule of rulesFor(language)) {
    for (const match2 of body.matchAll(rule.pattern)) {
      const message = rule.describe(match2[0]);
      if (emitted.has(message.toLowerCase())) continue;
      emitted.add(message.toLowerCase());
      violations.push(message);
    }
  }
  if (!hasDisclaimer(text, language)) {
    violations.push(
      "prohibited output 12: the report did not end with the required disclaimer block (05 \xA75.6). It was appended by the server"
    );
  }
  return violations;
}
function stripDisclaimer(text, language) {
  const { start, end } = DISCLAIMER_MARKERS[language];
  const index = text.indexOf(start);
  if (index === -1) {
    if (language !== "en") return text;
    const oldMarker = "What this is \u2014 and is not.";
    const oldIndex = text.indexOf(oldMarker);
    if (oldIndex === -1) return text;
    const oldEnd = text.indexOf(end, oldIndex);
    if (oldEnd === -1) return text.slice(0, oldIndex);
    return text.slice(0, oldIndex) + text.slice(oldEnd + end.length);
  }
  const endIndex = text.indexOf(end, index);
  if (endIndex === -1) return text.slice(0, index);
  return text.slice(0, index) + text.slice(endIndex + end.length);
}

// src/server/routes/generate.ts
var generateRoute = new Hono2();
generateRoute.post("/generate", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: 'Request body must be JSON: { "scores": {...}, "language": "en"|"id"|undefined }' },
      400
    );
  }
  const validation = validateScores(body?.scores);
  if (!validation.ok || !validation.scores) {
    const hard = validation.flags.filter(
      (flag) => flag.code !== "out-of-range" && flag.code !== "unknown-key"
    );
    return c.json(
      {
        error: hard.map((flag) => flag.message).join(" ") || "All eight cognitive-function scores are required."
      },
      400
    );
  }
  let language = DEFAULT_REPORT_LANGUAGE;
  if (body.language !== void 0 && body.language !== null) {
    if (!isReportLanguage(body.language)) {
      return c.json(
        { error: 'The "language" field must be "en" (English) or "id" (Bahasa Indonesia).' },
        400
      );
    }
    language = body.language;
  }
  const signature = computeSignature(validation.scores);
  const assembly = assemblePrompt(signature, null, language);
  return streamSSE(c, async (stream2) => {
    await stream2.writeSSE({
      event: "meta",
      data: JSON.stringify({ regime: assembly.regime, llm: assembly.llm })
    });
    if (!assembly.llm || assembly.honestNull) {
      const text = assembly.honestNullReport ?? "";
      for (const piece of chunkText(text)) {
        await stream2.writeSSE({ event: "chunk", data: JSON.stringify({ text: piece }) });
      }
      await stream2.writeSSE({
        event: "audit",
        data: JSON.stringify({ violations: auditReport(text, language) })
      });
      await stream2.writeSSE({ event: "done", data: "{}" });
      return;
    }
    if (!isConfigured()) {
      console.error("[generate] DEEPSEEK_API_KEY is unset; the interpreted sections need it.");
      await stream2.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: "The report generator is not configured on this server. Your stack signature above is complete and was computed locally; only the interpreted sections need the model."
        })
      });
      return;
    }
    const abort = new AbortController();
    stream2.onAbort(() => abort.abort());
    let buffered = "";
    try {
      for await (const item of streamReport({
        system: assembly.systemPrompt,
        user: assembly.userPrompt,
        // Prompted-reasoning support: the headings mark the plan/report boundary for the
        // prelude splitter, and the no-plan prompt is the one-shot retry when the plan
        // swallows the report. Both are inert on the native-thinking and `none` paths.
        // WITHOUT these two lines the splitter never engages and the plan would stream
        // into the report as content — do not remove them while the prompted default is on.
        ...assembly.userPromptNoPlan === null ? {} : { fallbackUser: assembly.userPromptNoPlan },
        reportHeadings: assembly.reportHeadings,
        maxTokens: assembly.maxTokens,
        signal: abort.signal
      })) {
        if (item.kind === "thinking") {
          await stream2.writeSSE({ event: "thinking", data: JSON.stringify({ text: item.text }) });
          continue;
        }
        buffered += item.text;
        await stream2.writeSSE({ event: "chunk", data: JSON.stringify({ text: item.text }) });
      }
    } catch (error) {
      console.error("[generate] report stream failed:", detailFor(error));
      await stream2.writeSSE({
        event: "error",
        data: JSON.stringify({ message: messageFor(error) })
      });
      return;
    }
    const violations = auditReport(buffered, language);
    const guarded = ensureDisclaimer(buffered, language);
    if (guarded !== buffered) {
      await stream2.writeSSE({
        event: "chunk",
        data: JSON.stringify({ text: guarded.slice(buffered.length) })
      });
    }
    await stream2.writeSSE({ event: "audit", data: JSON.stringify({ violations }) });
    await stream2.writeSSE({ event: "done", data: "{}" });
  });
});
function chunkText(text) {
  const pieces = text.split(/(?<=\n\n)/);
  return pieces.filter((piece) => piece.length > 0);
}
function messageFor(error) {
  if (error instanceof DeepSeekError) return error.publicMessage;
  return "The report generator failed unexpectedly. Try again shortly.";
}
function detailFor(error) {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

// src/server/app.ts
var app = new Hono2();
app.get(
  "/api/health",
  (c) => c.json({ ok: true, generator: isConfigured() ? "configured" : "unconfigured" })
);
app.route("/api", generateRoute);

// src/server/vercel.ts
var config = {
  maxDuration: 60
};
var GET = handle(app);
var POST = handle(app);
var PUT = handle(app);
var DELETE = handle(app);
var PATCH = handle(app);
var OPTIONS = handle(app);
var vercel_default = handle(app);
export {
  DELETE,
  GET,
  OPTIONS,
  PATCH,
  POST,
  PUT,
  config,
  vercel_default as default
};
