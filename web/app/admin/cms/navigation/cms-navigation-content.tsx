"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { NavigationTable } from "@/components/admin/cms/navigation-table";
import { NavigationItemModal } from "@/components/admin/cms/navigation-item-modal";
import { 
  AdminNavigationItem, 
  AdminPage, 
  createAdminNavigationItem, 
  updateAdminNavigationItem, 
  deleteAdminNavigationItem,
  reorderAdminNavigation
} from "@/lib/api";
import { useDisclosure, Alert } from "@heroui/react";

type Props = {
  initialItems: AdminNavigationItem[];
  pages: AdminPage[];
};

export function CMSNavigationContent({ initialItems, pages }: Props) {
  const [items, setItems] = useState<AdminNavigationItem[]>(initialItems);
  const [editingItem, setEditingItem] = useState<AdminNavigationItem | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    onOpen();
  };

  const handleEdit = (item: AdminNavigationItem) => {
    setEditingItem(item);
    onOpen();
  };

  const handleSave = async (data: Partial<AdminNavigationItem>) => {
    try {
      if (editingItem) {
        const updated = await updateAdminNavigationItem(editingItem.id, data);
        setItems((prev) => prev.map((item) => item.id === editingItem.id ? updated : item));
      } else {
        const created = await createAdminNavigationItem(data);
        setItems((prev) => [...prev, created]);
      }
      setError(null);
    } catch (err: any) {
      throw err; // Let the modal handle it
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdminNavigationItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete navigation item");
    }
  };

  const handleReorder = async (id: string, newOrder: number) => {
    try {
      // Optimistic update
      setItems((prev) => {
        const updated = prev.map((item) => item.id === id ? { ...item, sort_order: newOrder } : item);
        return [...updated].sort((a, b) => a.sort_order - b.sort_order);
      });

      await reorderAdminNavigation([{ id, sort_order: newOrder }]);
      setError(null);
    } catch (err: any) {
      setError("Failed to reorder items. Refreshing list...");
      // Re-fetch or revert on error (for now just letting user refresh)
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Navigation</h1>
          <p className="text-sm text-foreground/60">Manage your store's navigation menus</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Item
        </button>
      </div>

      {error && (
        <Alert color="danger" title="Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-content1 p-4 shadow-sm">
        <div className="overflow-hidden rounded-xl border border-surface-border">
          <NavigationTable 
            items={[...items].sort((a, b) => a.sort_order - b.sort_order)} 
            pages={pages}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        </div>
      </div>

      <NavigationItemModal 
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        item={editingItem}
        pages={pages}
        onSave={handleSave}
      />
    </div>
  );
}
