export const downloadFile = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.statusText}`);
  }
  return await res.json();
};

export const downloadBytes = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
};