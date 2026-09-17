export class Unauthorized extends Error {
  constructor() {
    super("Sign in to continue.");
  }
}
export class NotFound extends Error {
  constructor() {
    super("This item is unavailable.");
  }
}
