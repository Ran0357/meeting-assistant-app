// public/pcm-processor.js

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0];
      // ここでメインスレッドに Float32Array データを送信
      this.port.postMessage(channelData);
    }
    return true; // true を返すと処理が継続される
  }
}

registerProcessor('pcm-processor', PCMProcessor);
