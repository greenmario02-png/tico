import { EmptyState } from "@/components/EmptyState";
import * as React from "react";
import { fetchAllPages } from "@/lib/api";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth-context";
import type { Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierForm } from "@/features/suppliers/SupplierForm";
import { Icon } from "@/components/Icon";

// Pantalla admin-only, simple: listado + alta/edición/desactivación en
// diálogos, siguiendo el mismo patrón que IngredientsListPage. El borrado es
// lógico (isActive=false, SDD-05 §5.4) — un proveedor puede estar
// referenciado por ingredientes históricos.
export default function SuppliersPage() {
  const [showInactive, setShowInactive] = React.useState(false);
  const [items, setItems] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [deleting, setDeleting] = React.useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    // Nota: enviar `undefined` aquí para "mostrar desactivados" NO funciona:
    // supplierService.listSuppliers trata isActive===undefined igual que
    // "true" (solo activos) por defecto, así que hay que pedir
    // explícitamente "all" para traer también los inactivos.
    fetchAllPages<Supplier>("/suppliers", { isActive: showInactive ? "all" : "true" })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [showInactive]);

  React.useEffect(load, [load]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/suppliers/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="suppliers-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="supplier-new-button">
          <Icon name="add" size={18} />
          Nuevo proveedor
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          data-testid="supplier-show-inactive"
        />
        Mostrar desactivados
      </label>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="box"
          title="No se encontraron proveedores"
          description="Activa «Mostrar desactivados» o registra un proveedor nuevo."
          data-testid="suppliers-empty"
        />
      ) : (
        <Table data-testid="suppliers-table">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} data-testid="supplier-row" data-supplier-name={s.name}>
                <TableCell className="font-medium" data-testid="supplier-row-name">
                  {s.name}
                </TableCell>
                <TableCell>{s.contactPerson ?? "—"}</TableCell>
                <TableCell>{s.phone ?? "—"}</TableCell>
                <TableCell>{!s.isActive && <Badge variant="warning">desactivado</Badge>}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(s)} data-testid="supplier-edit-button">
                      Editar
                    </Button>
                    {s.isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(s);
                        }}
                        data-testid="supplier-delete-button"
                      >
                        Desactivar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="supplier-create-dialog">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onSuccess={() => {
              setCreateOpen(false);
              load();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent data-testid="supplier-edit-dialog">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          {editing && (
            <SupplierForm
              supplier={editing}
              onSuccess={() => {
                setEditing(null);
                load();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent data-testid="supplier-delete-dialog">
          <DialogHeader>
            <DialogTitle>Desactivar proveedor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres desactivar "{deleting?.name}"? Esta acción lo desactiva (borrado lógico), no borra su
            historial.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive" data-testid="supplier-delete-error">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="supplier-delete-cancel">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSubmitting}
              data-testid="supplier-delete-confirm"
            >
              {deleteSubmitting ? "Desactivando…" : "Sí, desactivar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
