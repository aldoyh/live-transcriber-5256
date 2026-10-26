export function encodeWav(samples: Float32Array, sampleRate: number): string {
  const count = Math.floor((samples.length * 16000) / sampleRate);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * sampleRate) / 16000),
      end = Math.max(start + 1, Math.floor(((i + 1) * sampleRate) / 16000));
    let total = 0;
    for (let j = start; j < Math.min(end, samples.length); j++) total += samples[j];
    const sample = Math.max(-1, Math.min(1, total / (end - start)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
