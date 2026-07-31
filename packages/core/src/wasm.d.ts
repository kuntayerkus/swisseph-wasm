/**
 * Emscripten çıktısı için tip bildirimi.
 *
 * ../wasm/swisseph.mjs bir build artefaktı — derleme anında var olmayabilir,
 * ve emcc kendi .d.ts'ini üretmiyor. Burada yalnızca gerçekten kullandığımız
 * yüzeyi bildiriyoruz; eksik bir alan eklemek gerekirse emcc'nin
 * EXPORTED_RUNTIME_METHODS listesine de eklenmeli
 * (bkz. tools/build-wasm.mjs), yoksa çalışma anında undefined olur.
 */
declare module '*/wasm/swisseph.mjs' {
  export interface SwissEphWasmModule {
    _malloc(size: number): number;
    _free(ptr: number): void;

    /** C fonksiyonunu JS'ten çağrılabilir hale getirir. */
    cwrap(
      name: string,
      returnType: 'number' | 'string' | null,
      argTypes: Array<'number' | 'string'>,
    ): (...args: any[]) => any;

    ccall(
      name: string,
      returnType: 'number' | 'string' | null,
      argTypes: Array<'number' | 'string'>,
      args: any[],
    ): any;

    getValue(ptr: number, type: 'i8' | 'i16' | 'i32' | 'i64' | 'float' | 'double'): number;
    setValue(
      ptr: number,
      value: number,
      type: 'i8' | 'i16' | 'i32' | 'i64' | 'float' | 'double',
    ): void;

    UTF8ToString(ptr: number, maxBytesToRead?: number): string;
    stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
    lengthBytesUTF8(str: string): number;

    /** Emscripten sanal dosya sistemi. .se1 dosyalarını buraya yazıyoruz. */
    FS: {
      mkdir(path: string): void;
      writeFile(path: string, data: Uint8Array | string): void;
      readFile(path: string): Uint8Array;
      unlink(path: string): void;
      analyzePath(path: string): { exists: boolean };
    };

    HEAPF64: Float64Array;
    HEAPU8: Uint8Array;
  }

  /**
   * emcc'nin kabul ettiği kurulum alanlarından kullandıklarımız.
   *
   * `print` ve `printErr` verilmezse üretilen glue bunları
   * `console.log` / `console.error`'a bağlıyor — yani WASM'in stdout'u
   * sürecin stdout'u oluyor. Bkz. instance.ts, createSwissEphModule çağrısı.
   */
  export interface SwissEphWasmOptions {
    print?: (text: string) => void;
    printErr?: (text: string) => void;
  }

  const createSwissEphModule: (
    options?: SwissEphWasmOptions,
  ) => Promise<SwissEphWasmModule>;
  export default createSwissEphModule;
}
