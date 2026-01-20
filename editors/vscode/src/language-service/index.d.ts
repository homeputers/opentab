export interface Diagnostic {
  message: string;
  line: number;
  startCol: number;
  endCol: number;
  severity: "error" | "warning";
}

export function validate(text: string): Diagnostic[];
export function format(text: string): string;
