class SanitizedIpc {
  #funcs = new WeakMap();

  getOr (fn) {
    let sanitizedFn = this.#funcs.get(fn);

    if (sanitizedFn) {
      return sanitizedFn;
    } else {
      const sanitizedFn = ((...args) => {
        const [ _, ...rest ] = args;

        return fn(...rest);
      }).bind(undefined);

      this.#funcs.set(fn, sanitizedFn);

      return sanitizedFn;
    }
  }
}

module.exports = {
  SanitizedIpc,
};
