import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import {
  getLocationByBarcode,
  getProductByBarcode,
} from '../lib/api';
import type { Location, Product } from '../lib/api';
import { DialogTitleWithClose } from './DialogTitleWithClose';

type ScanTarget = 'product' | 'location';
type ScanValue = Product | Location;

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

interface BarcodeScannerButtonProps {
  target: ScanTarget;
  onResolved: (value: ScanValue) => void;
  label?: string;
  size?: 'small' | 'medium';
  startIcon?: ReactNode;
}

export function BarcodeScannerButton({
  target,
  onResolved,
  label = 'Scan barcode',
  size = 'small',
  startIcon = <QrCodeScannerOutlinedIcon />,
}: BarcodeScannerButtonProps) {
  const [open, setOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error' | 'info'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const lastCodeRef = useRef('');
  const lookupLockRef = useRef(false);
  const cameraRunningRef = useRef(false);

  const stopCamera = useCallback(() => {
    cameraRunningRef.current = false;
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const close = () => {
    stopCamera();
    setOpen(false);
    setFeedback(undefined);
    setCameraError(undefined);
    lastCodeRef.current = '';
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const lookup = useCallback(async (value: string) => {
    const code = value.trim();
    if (!code || lookupLockRef.current || lastCodeRef.current === code) {
      return;
    }

    lookupLockRef.current = true;
    lastCodeRef.current = code;
    setBusy(true);
    setFeedback(undefined);
    try {
      const entity = target === 'product'
        ? await getProductByBarcode(code)
        : await getLocationByBarcode(code);
      if (!entity) {
        setFeedback({
          severity: 'error',
          text: `No ${target} was found for barcode “${code}”.`,
        });
        return;
      }

      setFeedback({
        severity: 'success',
        text: target === 'product'
          ? `Recognized ${'sku' in entity ? entity.name : ''} (${'sku' in entity ? entity.sku : ''}).`
          : `Recognized location ${'warehouseId' in entity ? entity.name : ''} (${'warehouseId' in entity ? entity.code : ''}).`,
      });
      onResolved(entity);
      setBarcode('');
      stopCamera();
    } catch (error) {
      lastCodeRef.current = '';
      setFeedback({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Barcode lookup failed.',
      });
    } finally {
      lookupLockRef.current = false;
      setBusy(false);
    }
  }, [onResolved, stopCamera, target]);

  const startCamera = async () => {
    setCameraError(undefined);
    const detectorApi = (window as Window & {
      BarcodeDetector?: BarcodeDetectorConstructor;
    }).BarcodeDetector;
    if (!detectorApi || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera barcode scanning is not supported by this browser. Use a scanner or enter the barcode below.');
      return;
    }

    setCameraBusy(true);
    try {
      const formats = await detectorApi.getSupportedFormats?.();
      const supportedFormats = ['code_128', 'ean_13', 'ean_8', 'qr_code']
        .filter((format) => !formats || formats.includes(format));
      const detector = new detectorApi({ formats: supportedFormats });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      cameraRunningRef.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }

      const scanFrame = async () => {
        if (!cameraRunningRef.current || !videoRef.current) return;
        try {
          const detections = await detector.detect(videoRef.current);
          const detectedValue = detections.find((result) => result.rawValue)?.rawValue;
          if (detectedValue) {
            await lookup(detectedValue);
          }
        } catch (error) {
          setCameraError(
            error instanceof Error
              ? `Camera scanning failed: ${error.message}`
              : 'Camera scanning failed.',
          );
          stopCamera();
          return;
        }

        if (cameraRunningRef.current) {
          timerRef.current = window.setTimeout(() => void scanFrame(), 180);
        }
      };
      void scanFrame();
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in the browser, or use a scanner or manual entry.'
        : error instanceof Error
          ? error.message
          : 'The camera could not be started.';
      setCameraError(message);
      stopCamera();
    } finally {
      setCameraBusy(false);
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void lookup(barcode);
  };

  return (
    <>
      <Button size={size} startIcon={startIcon} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitleWithClose onClose={close}>Scan {target} barcode</DialogTitleWithClose>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Use a keyboard-style USB/Bluetooth scanner, the camera when supported, or enter a barcode manually.
            </Typography>
            <Box
              component="form"
              onSubmit={submitManual}
              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
            >
              <TextField
                autoFocus
                fullWidth
                label="Barcode"
                value={barcode}
                onChange={(event) => {
                  setBarcode(event.target.value);
                  lastCodeRef.current = '';
                  setFeedback(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lookup(barcode);
                  }
                }}
              />
              <Button type="submit" variant="contained" disabled={busy || !barcode.trim()}>
                {busy ? <CircularProgress size={20} color="inherit" /> : 'Find'}
              </Button>
            </Box>
            <Button
              variant="outlined"
              onClick={() => void startCamera()}
              disabled={cameraBusy || cameraActive}
            >
              {cameraBusy ? 'Starting camera…' : 'Use camera'}
            </Button>
            {cameraError && <Alert severity="warning">{cameraError}</Alert>}
            {feedback && <Alert severity={feedback.severity}>{feedback.text}</Alert>}
            <Box
              component="video"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Camera barcode preview"
              sx={{
                display: cameraActive ? 'block' : 'none',
                width: '100%',
                maxHeight: 280,
                bgcolor: 'common.black',
                borderRadius: 1,
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
