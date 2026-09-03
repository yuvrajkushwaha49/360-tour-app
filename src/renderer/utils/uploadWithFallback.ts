/**
 * Upload with Fallback Confirmation Utility
 * Prompts the user with a sleek confirmation popup whenever AWS S3 cloud storage
 * is unavailable or fails, before saving to the local server disk.
 */

// Custom animated modal confirmation dialog
export function showFallbackConfirmModal(
  customMessage?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    // Remove any previous leftover modal
    const existing = document.getElementById('fallback-confirm-modal-root');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'fallback-confirm-modal-root';
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.backgroundColor = 'rgba(3, 4, 10, 0.85)';
    container.style.backdropFilter = 'blur(12px)';
    (container.style as any).webkitBackdropFilter = 'blur(12px)';
    container.style.padding = '1.5rem';
    container.style.animation = 'fadeIn 0.25s ease';

    const card = document.createElement('div');
    card.style.maxWidth = '460px';
    card.style.width = '100%';
    card.style.background = 'linear-gradient(155deg, rgba(28, 20, 52, 0.95) 0%, rgba(12, 10, 26, 0.98) 100%)';
    card.style.border = '1px solid rgba(168, 85, 247, 0.4)';
    card.style.borderRadius = '1.5rem';
    card.style.padding = '2rem';
    card.style.boxShadow = '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.25)';
    card.style.color = '#ffffff';
    card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    card.style.textAlign = 'center';

    card.innerHTML = `
      <div style="font-size: 2.8rem; margin-bottom: 0.75rem; line-height: 1;">☁️</div>
      <h3 style="font-size: 1.35rem; font-weight: 700; margin: 0 0 0.6rem 0; color: #ffffff;">
        Cloud Storage Notice
      </h3>
      <p style="font-size: 0.92rem; color: #cbd5e1; line-height: 1.5; margin: 0 0 1.75rem 0;">
        ${
          customMessage ||
          'AWS S3 Cloud Storage is currently unavailable or encountered an error. Would you like to save this file directly to the local server disk as a fallback?'
        }
      </p>
      <div style="display: flex; gap: 0.85rem; justify-content: center;">
        <button id="fallback-btn-cancel" style="
          flex: 1;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        ">Cancel</button>
        <button id="fallback-btn-confirm" style="
          flex: 1.2;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          border: none;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f59e0b 100%);
          color: #ffffff;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
          transition: all 0.2s ease;
        ">Yes, Save to Server</button>
      </div>
    `;

    container.appendChild(card);
    document.body.appendChild(container);

    const btnCancel = card.querySelector('#fallback-btn-cancel') as HTMLButtonElement;
    const btnConfirm = card.querySelector('#fallback-btn-confirm') as HTMLButtonElement;

    const cleanup = (result: boolean) => {
      container.remove();
      resolve(result);
    };

    btnCancel?.addEventListener('click', () => cleanup(false));
    btnConfirm?.addEventListener('click', () => cleanup(true));
  });
}

/**
 * Upload single file with automated fallback prompt
 */
export async function uploadFileWithFallback(
  url: string,
  formData: FormData,
  headers?: Record<string, string>
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers || {},
    body: formData
  });

  const data = await response.json();

  // If server reports that S3 is unavailable and fallback confirmation is needed
  if (response.status === 409 || data.fallbackRequired) {
    const userConfirmed = await showFallbackConfirmModal(data.message);

    if (!userConfirmed) {
      throw new Error('Upload cancelled: Cloud storage unavailable and server fallback rejected.');
    }

    // User confirmed yes -> retry with allowFallback flag
    formData.set('allowFallback', 'true');
    const retryResponse = await fetch(url, {
      method: 'POST',
      headers: headers || {},
      body: formData
    });

    const retryData = await retryResponse.json();
    if (!retryResponse.ok) {
      throw new Error(retryData.error || 'Fallback server upload failed.');
    }

    return retryData;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload file.');
  }

  return data;
}

/**
 * Upload batch files with automated fallback prompt
 */
export async function uploadBatchWithFallback(
  url: string,
  formData: FormData,
  headers?: Record<string, string>
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers || {},
    body: formData
  });

  const data = await response.json();

  if (response.status === 409 || data.fallbackRequired) {
    const userConfirmed = await showFallbackConfirmModal(data.message);

    if (!userConfirmed) {
      throw new Error('Batch upload cancelled: Cloud storage unavailable and server fallback rejected.');
    }

    formData.set('allowFallback', 'true');
    const retryResponse = await fetch(url, {
      method: 'POST',
      headers: headers || {},
      body: formData
    });

    const retryData = await retryResponse.json();
    if (!retryResponse.ok) {
      throw new Error(retryData.error || 'Fallback batch upload failed.');
    }

    return retryData;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload files.');
  }

  return data;
}
