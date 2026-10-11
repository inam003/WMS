import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { DialogTitleWithClose } from './DialogTitleWithClose';

interface BarcodeLabelButtonProps {
  title: string;
  subtitle: string;
  barcode: string | null;
}

export function BarcodeLabelButton({
  title,
  subtitle,
  barcode,
}: BarcodeLabelButtonProps) {
  const [open, setOpen] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open || !barcode || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 62,
        width: 1.65,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate this barcode label.';
      window.requestAnimationFrame(() => setGenerationError(message));
    }
  }, [barcode, open]);

  return (
    <>
      <Button
        size="small"
        startIcon={<PrintOutlinedIcon />}
        disabled={!barcode}
        onClick={() => {
          setGenerationError(undefined);
          setOpen(true);
        }}
      >
        Label
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitleWithClose onClose={() => setOpen(false)}>Printable barcode label</DialogTitleWithClose>
        <DialogContent>
          {generationError ? (
            <Typography color="error">{generationError}</Typography>
          ) : (
            <Stack
              id="barcode-label-print"
              spacing={0.5}
              sx={{
                alignItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                textAlign: 'center',
                '& svg': { maxWidth: '100%', height: 62 },
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="body2">{subtitle}</Typography>
              <svg ref={svgRef} aria-label={`Barcode ${barcode ?? ''}`} />
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {barcode}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintOutlinedIcon />}
            disabled={!barcode || Boolean(generationError)}
            onClick={() => window.print()}
          >
            Print label
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
