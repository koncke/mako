// MaKo: el `onnxruntime-web` instalado (1.22.0-dev, el que trae @huggingface/transformers) no declara tipos
// para el subpath `./wasm`; su API es la de onnxruntime-common (env, InferenceSession, Tensor), que sí trae tipos.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-common'
}
