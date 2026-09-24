import * as React from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SupplierFormProps {
  /** Si se pasa, el formulario edita ese proveedor en vez de crear uno nuevo. */
  supplier?: Supplier;
  onSuccess: (supplier: Supplier) => void;
  onCancel?: () => void;
}

// POST /api/suppliers: { name, contactPerson?, phone? }.
// PUT /api/suppliers/:id: cualquier subconjunto de name/contactPerson/phone/isActive.
export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const isEdit = Boolean(supplier);
  const [name, setName] = React.useState(supplier?.name ?? "");
  const [contactPerson, setContactPerson] = React.useState(supplier?.contactPerson ?? "");
  const [phone, setPhone] = React.useState(supplier?.phone ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        name,
        contactPerson: contactPerson.trim() === "" ? null : contactPerson.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
      };
      const result =
        isEdit && supplier
          ? await api.put<Supplier>(`/suppliers/${supplier.id}`, body)
          : await api.post<Supplier>("/suppliers", body);
      onSuccess(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="supplier-form">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sup-name">Nombre</Label>
        <Input
          id="sup-name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Molino La Paz"
          data-testid="supplier-form-name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sup-contact">Persona de contacto</Label>
        <Input
          id="sup-contact"
          value={contactPerson ?? ""}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="Opcional"
          data-testid="supplier-form-contact"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sup-phone">Teléfono</Label>
        <Input
          id="sup-phone"
          value={phone ?? ""}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Opcional"
          data-testid="supplier-form-phone"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="supplier-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} data-testid="supplier-form-cancel">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="supplier-form-submit">
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </form>
  );
}
