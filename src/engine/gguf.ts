export interface GgufMetadata {
  architecture: string;
  quantization: string;
  parameterCount: string;
  contextLength: number;
  totalLayers: number;
  name: string;
  fileSize: number;
}

export async function readGgufMetadata(
  url: string,
  token?: string
): Promise<GgufMetadata> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Fetch first 64KB to read the header
  const res = await fetch(url, {
    headers: { ...headers, Range: 'bytes=0-65535' },
    redirect: 'follow',
  });

  if (!res.ok && res.status !== 206) {
    throw new Error(`Failed to fetch GGUF header: ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const view = new DataView(buffer);

  // GGUF magic number
  const magic = view.getUint32(0, true);
  if (magic !== 0x46554747) { // "GGUF" in little-endian
    throw new Error('Not a valid GGUF file');
  }

  const version = view.getUint32(4, true);
  const nMetadata = view.getUint32(8, true);

  // Parse metadata key-value pairs
  const metadata: Record<string, any> = {};
  let offset = 12;

  for (let i = 0; i < nMetadata && offset < buffer.byteLength - 8; i++) {
    try {
      const keyLen = view.getUint32(offset, true);
      offset += 4;
      if (keyLen > 256 || offset + keyLen > buffer.byteLength) break;

      const keyBytes = new Uint8Array(buffer, offset, keyLen);
      const key = new TextDecoder().decode(keyBytes);
      offset += keyLen;

      const valueType = view.getUint32(offset, true);
      offset += 4;

      let value: any;
      switch (valueType) {
        case 0: // UINT8
          value = view.getUint8(offset);
          offset += 1;
          break;
        case 1: // INT8
          value = view.getInt8(offset);
          offset += 1;
          break;
        case 2: // UINT16
          value = view.getUint16(offset, true);
          offset += 2;
          break;
        case 3: // INT16
          value = view.getInt16(offset, true);
          offset += 2;
          break;
        case 4: // UINT32
          value = view.getUint32(offset, true);
          offset += 4;
          break;
        case 5: // INT32
          value = view.getInt32(offset, true);
          offset += 4;
          break;
        case 6: // FLOAT32
          value = view.getFloat32(offset, true);
          offset += 4;
          break;
        case 7: // BOOL
          value = view.getUint8(offset) !== 0;
          offset += 1;
          break;
        case 8: { // STRING
          const strLen = Number(view.getBigUint64(offset, true));
          offset += 8;
          const strBytes = new Uint8Array(buffer, offset, Math.min(strLen, buffer.byteLength - offset));
          value = new TextDecoder().decode(strBytes);
          offset += strLen;
          break;
        }
        case 10: // UINT64
          value = Number(view.getBigUint64(offset, true));
          offset += 8;
          break;
        case 11: // INT64
          value = Number(view.getBigInt64(offset, true));
          offset += 8;
          break;
        case 12: // FLOAT64
          value = view.getFloat64(offset, true);
          offset += 8;
          break;
        default:
          // Unknown type, skip remaining metadata
          i = nMetadata;
          break;
      }

      metadata[key] = value;
    } catch {
      break; // parsing error, use what we have
    }
  }

  const arch = metadata['general.architecture'] || 'unknown';
  const quantVal = metadata['general.file_type'];
  const quantMap: Record<number, string> = {
    0: 'F32', 1: 'F16', 2: 'Q4_0', 3: 'Q4_1', 7: 'Q8_0',
    8: 'Q5_0', 9: 'Q5_1', 10: 'Q2_K', 11: 'Q3_K_S', 12: 'Q3_K_M',
    13: 'Q3_K_L', 14: 'Q4_K_S', 15: 'Q4_K_M', 16: 'Q5_K_S', 17: 'Q5_K_M',
    18: 'Q6_K',
  };

  // Try to get parameter count from tensor info
  const nParams = metadata[`${arch}.block_count`]
    ? `~${metadata[`${arch}.block_count`]} layers`
    : 'unknown';

  const totalLayers = metadata[`${arch}.block_count`] || 0;

  return {
    architecture: arch,
    quantization: quantMap[quantVal] || `type_${quantVal}`,
    parameterCount: nParams,
    contextLength: metadata[`${arch}.context_length`] || 2048,
    totalLayers,
    name: metadata['general.name'] || '',
    fileSize: parseInt(res.headers.get('content-range')?.split('/').pop() || '0', 10) || 0,
  };
}
