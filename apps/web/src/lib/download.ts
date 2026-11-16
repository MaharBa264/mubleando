/** Descarga un archivo generado en el navegador (sin pasar por ningún servidor). */
export function downloadBlob(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari necesita que la URL siga viva un momento después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
