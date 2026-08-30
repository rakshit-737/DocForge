/* Minimal typings for the node builtins the tests use, so the package
   typechecks without pulling @types/node into its devDependencies. If the
   workspace later hoists @types/node, these merge as compatible overloads. */
declare module "node:buffer" {
  export class Buffer extends Uint8Array {
    static from(data: ArrayBuffer | Uint8Array | string, encoding?: string): Buffer;
    static alloc(size: number): Buffer;
    static concat(list: Uint8Array[]): Buffer;
    readUInt16LE(offset: number): number;
    readUInt32LE(offset: number): number;
    writeUInt16LE(value: number, offset: number): number;
    writeUInt32LE(value: number, offset: number): number;
    toString(encoding?: string, start?: number, end?: number): string;
    subarray(start?: number, end?: number): Buffer;
    equals(other: Uint8Array): boolean;
  }
}
declare module "node:zlib" {
  import { Buffer } from "node:buffer";
  const zlib: {
    inflateRawSync(data: Uint8Array): Buffer;
  };
  export default zlib;
}
