import { ActionForm } from "@/components/forms/action-form";

type StatusOption = { value: string; label?: string };

type StatusFormProps = {
  action: (formData: FormData) => Promise<{ ok: true; data?: unknown } | { ok: false; message: string }>;
  hiddenName: string;
  hiddenValue: string;
  currentStatus: string;
  options: StatusOption[];
  submitLabel?: string;
};

export function StatusForm({
  action,
  hiddenName,
  hiddenValue,
  currentStatus,
  options,
  submitLabel = "Update",
}: StatusFormProps) {
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name={hiddenName} value={hiddenValue} />
      <select
        name="status"
        defaultValue={currentStatus}
        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="Status"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label ?? option.value}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
