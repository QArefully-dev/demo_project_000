import { useState } from 'react';
import { exportAccountData } from '@/api/accountExport';
import { Button } from '@/components/ui/button';

export function DataExportSection() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setError(null);
    setSuccess(false);
    setDownloading(true);
    try {
      const data = await exportAccountData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qarefully-account-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Unable to download your export',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="data-export-heading" className="mt-6 rounded-lg border p-6">
      <h2 id="data-export-heading" className="text-base font-medium">
        Your data
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Download a JSON copy of your account data.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-3 text-sm text-green-700">
          Your export has downloaded. A copy has also been delivered to your mailbox.
        </p>
      )}
      <Button type="button" className="mt-4" onClick={() => void download()} disabled={downloading}>
        {downloading ? 'Preparing download…' : 'Download'}
      </Button>
    </section>
  );
}
