export async function downloadJsonFile(filename: string, data: unknown) {
  const pretty = JSON.stringify(data, null, 2);
  const blob = new Blob([pretty], { type: 'application/json' });

  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      const canShareFiles = (navigator as Navigator & {
        canShare?: (payload: { files?: File[] }) => boolean;
      }).canShare?.({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Frame input export',
        });
        return;
      }
    } catch {
      // Fallback to direct download if share is cancelled or unavailable.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
