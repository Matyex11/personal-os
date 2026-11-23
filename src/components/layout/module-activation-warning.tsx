type ModuleActivationWarningProps = {
  message: string;
};

export function ModuleActivationWarning({ message }: ModuleActivationWarningProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground"
    >
      <p className="font-medium">Module settings could not be loaded</p>
      <p className="mt-1 text-muted-foreground">
        {message} Navigation stays available until activation settings load successfully — this is
        not the same as modules being turned off.
      </p>
    </div>
  );
}
