declare module 'pdfkit' {
  export default class PDFDocument {
    constructor(options?: { size?: [number, number]; margin?: number });
    on(event: 'data', listener: (chunk: Uint8Array) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    end(): void;
  }
}

declare module 'svg-to-pdfkit' {
  import type PDFDocument from 'pdfkit';

  export default function svgToPdf(
    doc: PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: {
      assumePt?: boolean;
      width?: number;
      height?: number;
    },
  ): void;
}
