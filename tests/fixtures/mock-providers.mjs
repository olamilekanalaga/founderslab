// This preload runs only inside the disposable integration-test server.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? input));
  if (url.hostname === "api.telegram.org") {
    if (url.pathname !== "/bot123:integration-fixture/sendMessage")
      throw new Error("Unexpected Telegram test request");
    return realFetch(process.env.TEST_TELEGRAM_ENDPOINT, options);
  }
  if (url.hostname === "api.stripe.com") {
    return realFetch(process.env.TEST_STRIPE_ENDPOINT + url.pathname, options);
  }
  return realFetch(input, options);
};
