/* Minimal typing for the node builtins the parity test uses, so the package
   typechecks without pulling @types/node into its devDependencies. If the
   workspace later hoists @types/node, these merge as compatible overloads. */
declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
  export function existsSync(path: string): boolean;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}
declare const process: { env: Record<string, string | undefined>; cwd(): string };
