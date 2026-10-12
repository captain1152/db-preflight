/** An error that prevents producing a valid result. Always maps to exit code 2. */
export class DbpError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DbpError";
    this.code = code;
  }
}
