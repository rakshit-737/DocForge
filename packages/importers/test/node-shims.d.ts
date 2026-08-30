/* Minimal typing for the one node builtin the tests use, so the package
   typechecks without pulling @types/node into its devDependencies. If the
   workspace later hoists @types/node, this merges as a compatible overload. */
declare module "node:zlib" {
  export function deflateRawSync(data: Uint8Array | string): Uint8Array;
}
