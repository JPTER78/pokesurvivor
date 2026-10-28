/* Explicit local development only. Production keeps G private and all hooks absent. */
G.Dev = Object.freeze({ enabled: !G.BUILT &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) &&
  /(?:\?|&)debug=1(?:&|$)/.test(location.search) });
