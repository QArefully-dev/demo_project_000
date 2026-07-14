import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ContactField = 'customerName' | 'customerEmail' | 'shippingAddress';

interface ContactDetailsStepProps {
  contact: Record<ContactField, string>;
  fieldError: (field: ContactField) => string | undefined;
  onChange: (field: ContactField, value: string) => void;
  onBlur: (field: ContactField) => void;
  onContinue: () => void;
  disabled: boolean;
}

export function ContactDetailsStep({
  contact,
  fieldError,
  onChange,
  onBlur,
  onContinue,
  disabled,
}: ContactDetailsStepProps) {
  const fields: Array<{
    id: ContactField;
    label: string;
    type?: 'email';
    autoComplete: string;
  }> = [
    { id: 'customerName', label: 'Full name', autoComplete: 'name' },
    { id: 'customerEmail', label: 'Email', type: 'email', autoComplete: 'email' },
    { id: 'shippingAddress', label: 'Shipping address', autoComplete: 'street-address' },
  ];

  return (
    <section aria-labelledby="contact-step-title" className="space-y-4">
      <div>
        <h2 id="contact-step-title" className="text-lg font-semibold">
          Contact and delivery
        </h2>
        <p className="text-sm text-muted-foreground">Step 1 of 2</p>
      </div>
      {fields.map((field) => {
        const error = fieldError(field.id);
        return (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
            </label>
            <Input
              id={field.id}
              type={field.type}
              value={contact[field.id]}
              onChange={(event) => onChange(field.id, event.target.value)}
              onBlur={() => onBlur(field.id)}
              autoComplete={field.autoComplete}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${field.id}-error` : undefined}
            />
            {error && (
              <p id={`${field.id}-error`} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <Button type="button" size="lg" className="w-full" disabled={disabled} onClick={onContinue}>
        Continue to payment
      </Button>
    </section>
  );
}
