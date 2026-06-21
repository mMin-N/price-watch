type ToastListener = (message: string, variant: "success" | "error") => void;

let listener: ToastListener | null = null;

export function registerToastListener(next: ToastListener | null) {
  listener = next;
}

export function showToast(message: string, variant: "success" | "error" = "success") {
  listener?.(message, variant);
}
