// AD SOUTHERN SMART POS — Camera Barcode Scanner (Module 3B)
// src/components/CamBarcodeScanner.js
//
// QuaggaJS camera barcode scanner.
// Lazy-loaded by BillingPOS to avoid loading QuaggaJS until needed.
// Usage: <CamBarcodeScanner onDetected={fn} onClose={fn} />

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * CamBarcodeScanner
 * @param {function} onDetected  - called with the barcode string when detected
 * @param {function} onClose     - called when user dismisses the scanner
 */
export default function CamBarcodeScanner({ onDetected, onClose }) {
  const scannerRef  = useRef(null);   // div that QuaggaJS draws into
  const lastCode    = useRef('');     // debounce duplicate scans
  const quaggaRef   = useRef(null);   // Quagga instance
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef(null);     // MediaStream for torch control

  /* ── Init QuaggaJS ── */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Dynamic import — only loads when component mounts
        const Quagga = (await import('quagga')).default;
        quaggaRef.current = Quagga;

        if (!scannerRef.current) return;

        Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: scannerRef.current,
              constraints: {
                facingMode: 'environment',   // rear camera
                width:  { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            locator: {
              patchSize:    'medium',
              halfSample:   true,
            },
            numOfWorkers:  navigator.hardwareConcurrency > 2 ? 2 : 1,
            frequency:     10,
            decoder: {
              readers: [
                'code_128_reader',
                'ean_reader',
                'ean_8_reader',
                'code_39_reader',
                'upc_reader',
                'upc_e_reader',
                'codabar_reader',
              ],
            },
            locate: true,
          },
          (err) => {
            if (!mounted) return;
            if (err) {
              setError('Camera ආරම්භ කිරීම අසාර්ථකයි: ' + (err.message || err));
              return;
            }
            Quagga.start();
            setReady(true);

            // Save stream ref for torch
            const video = scannerRef.current?.querySelector('video');
            if (video?.srcObject) streamRef.current = video.srcObject;
          },
        );

        /* Detection handler */
        Quagga.onDetected((result) => {
          const code = result?.codeResult?.code;
          if (!code) return;

          // Ignore duplicates within 1.5 s
          if (code === lastCode.current) return;
          lastCode.current = code;
          setTimeout(() => { lastCode.current = ''; }, 1500);

          // Beep
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gn  = ctx.createGain();
            osc.connect(gn); gn.connect(ctx.destination);
            osc.frequency.value = 1760;
            gn.gain.setValueAtTime(0.3, ctx.currentTime);
            gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
          } catch { /* audio context unavailable */ }

          onDetected(code);
        });

        /* Draw laser-line overlay on processed frame */
        Quagga.onProcessed((result) => {
          const canvas = Quagga.canvas?.dom?.overlay;
          const ctx2d  = Quagga.canvas?.ctx?.overlay;
          if (!canvas || !ctx2d) return;
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          if (result?.box) {
            Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, ctx2d, { color: '#f59e0b', lineWidth: 2 });
          }
          if (result?.codeResult?.code) {
            Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, ctx2d, { color: '#10b981', lineWidth: 3 });
          }
        });

      } catch (e) {
        if (mounted) setError('QuaggaJS load error: ' + e.message);
      }
    })();

    return () => {
      mounted = false;
      try {
        quaggaRef.current?.offDetected();
        quaggaRef.current?.offProcessed();
        quaggaRef.current?.stop();
      } catch { /* cleanup */ }
    };
  }, [onDetected]);

  /* ── Torch toggle ── */
  const toggleTorch = async () => {
    try {
      const stream = streamRef.current;
      if (!stream) { toast.error('Camera stream නොමැත'); return; }
      const track = stream.getVideoTracks()[0];
      if (!track?.getCapabilities) { toast.error('Torch supported නැත'); return; }
      const caps = track.getCapabilities();
      if (!caps.torch) { toast.error('Torch supported නැත'); return; }
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      toast.error('Torch error: ' + e.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 460, padding: '1.25rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div className="modal-title" style={{ margin: 0 }}>
            📷 Camera Barcode Scan
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        {/* Info */}
        <div style={styles.infoBox}>
          Barcode Camera ඉදිරිපිට ස්ථානගත කරන්න. Auto-detect වේ.
        </div>

        {/* Error state */}
        {error ? (
          <div style={styles.errorBox}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📷</div>
            <div style={{ fontWeight: 600, color: 'var(--clr-danger)', marginBottom: '0.35rem' }}>Camera Error</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>{error}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-dim)', marginTop: '0.5rem' }}>
              Browser Settings → Camera Permission Allow කරන්න
            </div>
          </div>
        ) : (
          <>
            {/* Scanner viewport */}
            <div style={styles.viewportWrap}>
              <div
                ref={scannerRef}
                style={styles.viewport}
              />

              {/* Crosshair overlay */}
              {ready && (
                <div style={styles.crosshair}>
                  <div style={styles.crosshairLine} />
                </div>
              )}

              {/* Loading spinner */}
              {!ready && !error && (
                <div style={styles.loadingOverlay}>
                  <div className="animate-spin" style={spinnerStyle} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: '0.5rem' }}>
                    Camera ආරම්භ වෙනවා...
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            {ready && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  className={`btn ${torchOn ? 'btn-accent' : 'btn-ghost'} btn-sm`}
                  onClick={toggleTorch}
                  title="Flashlight toggle"
                >
                  {torchOn ? '🔦 Torch Off' : '🔦 Torch On'}
                </button>
                <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--clr-text-dim)', display: 'flex', alignItems: 'center' }}>
                  Barcode detect වූ විට automatic ලෙස Add වේ
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const spinnerStyle = {
  display: 'inline-block', width: 32, height: 32,
  border: '2px solid var(--clr-border)',
  borderTopColor: 'var(--clr-primary)',
  borderRadius: '50%',
};

const styles = {
  infoBox: {
    background: 'rgba(59,130,246,0.06)',
    border: '1px solid rgba(59,130,246,0.15)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--clr-text-muted)',
    marginBottom: '0.85rem',
  },
  errorBox: {
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.06)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    textAlign: 'center',
  },
  viewportWrap: {
    position: 'relative',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: '#000',
    minHeight: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    width: '100%',
    // QuaggaJS injects <video> and <canvas> here
  },
  crosshair: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  crosshairLine: {
    width: '60%',
    height: 2,
    background: 'rgba(245,158,11,0.7)',
    borderRadius: 1,
    boxShadow: '0 0 6px rgba(245,158,11,0.6)',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
  },
};
