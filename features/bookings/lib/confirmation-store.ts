export const subscribeBrowser = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener("hashchange", fn);
    window.removeEventListener("storage", fn);
  };
};
export const noopSubscribe = () => () => {};
