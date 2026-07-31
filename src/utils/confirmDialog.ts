type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

const splitMessage = (message: string) =>
  message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const confirmAction = ({
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default"
}: ConfirmDialogOptions) => {
  if (typeof document === "undefined") {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-dialog-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = `confirm-dialog ${tone === "danger" ? "danger" : ""}`;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);

    const heading = document.createElement("h2");
    heading.textContent = title;

    const body = document.createElement("div");
    body.className = "confirm-dialog-body";
    for (const line of splitMessage(message)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      body.appendChild(paragraph);
    }

    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ghost-button";
    cancelButton.textContent = cancelLabel;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = `primary-button ${tone === "danger" ? "danger" : ""}`;
    confirmButton.textContent = confirmLabel;

    const cleanup = (value: boolean) => {
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      resolve(value);
    };

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cleanup(false);
      }
    }

    cancelButton.addEventListener("click", () => cleanup(false));
    confirmButton.addEventListener("click", () => cleanup(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup(false);
      }
    });
    document.addEventListener("keydown", handleKeyDown);

    actions.append(cancelButton, confirmButton);
    dialog.append(heading, body, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    (tone === "danger" ? cancelButton : confirmButton).focus();
  });
};
