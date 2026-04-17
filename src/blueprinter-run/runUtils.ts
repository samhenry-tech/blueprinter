export const downloadFile = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.statusText}`);
  }
  return await res.json();
}