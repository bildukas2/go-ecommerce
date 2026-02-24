"use client";

import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell, 
  Chip, 
  Button, 
  Tooltip,
  Input
} from "@heroui/react";
import { Edit, Trash2, ExternalLink, GripVertical, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AdminNavigationItem, AdminPage } from "@/lib/api";
import { useState } from "react";

type Props = {
  items: AdminNavigationItem[];
  pages: AdminPage[];
  onEdit: (item: AdminNavigationItem) => void;
  onDelete: (id: string) => Promise<void>;
  onReorder: (id: string, newOrder: number) => Promise<void>;
};

export function NavigationTable({ 
  items, 
  pages, 
  onEdit, 
  onDelete, 
  onReorder 
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const getPageTitle = (pageId?: string | null) => {
    if (!pageId) return "-";
    const page = pages.find((p) => p.id === pageId);
    return page ? page.title : "Unknown Page";
  };

  const getPageSlug = (pageId?: string | null) => {
    if (!pageId) return null;
    const page = pages.find((p) => p.id === pageId);
    return page ? page.slug : null;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this navigation item?")) {
      return;
    }
    setLoadingId(id);
    try {
      await onDelete(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReorderChange = async (id: string, value: string) => {
    const newOrder = parseInt(value, 10);
    if (!isNaN(newOrder)) {
      await onReorder(id, newOrder);
    }
  };

  return (
    <Table 
      aria-label="Navigation items table"
      removeWrapper
      className="min-h-[400px]"
    >
      <TableHeader>
        <TableColumn width={60}>Sort</TableColumn>
        <TableColumn>Label</TableColumn>
        <TableColumn>Type</TableColumn>
        <TableColumn>Target</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn align="end">Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No navigation items found">
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Input
                type="number"
                size="sm"
                className="w-16"
                defaultValue={item.sort_order.toString()}
                onBlur={(e) => {
                  if (parseInt(e.target.value) !== item.sort_order) {
                    handleReorderChange(item.id, e.target.value);
                  }
                }}
              />
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{item.label}</p>
                {item.open_in_new_tab && (
                  <p className="text-xs text-default-400">Opens in new tab</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Chip size="sm" variant="flat" color={item.type === "page" ? "primary" : "secondary"}>
                {item.type.toUpperCase()}
              </Chip>
            </TableCell>
            <TableCell>
              {item.type === "page" ? (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{getPageTitle(item.page_id)}</span>
                  {getPageSlug(item.page_id) && (
                    <Link 
                      href={getPageSlug(item.page_id)!} 
                      target="_blank"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    >
                      {getPageSlug(item.page_id)}
                      <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
              ) : (
                <Link 
                  href={item.url || "#"} 
                  target="_blank"
                  className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
                >
                  {item.url}
                  <ExternalLink size={12} />
                </Link>
              )}
            </TableCell>
            <TableCell>
              <Chip
                color={item.is_active ? "success" : "default"}
                size="sm"
                variant="flat"
              >
                {item.is_active ? "Active" : "Disabled"}
              </Chip>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-2">
                <Tooltip content="Edit item">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => onEdit(item)}
                  >
                    <Edit size={18} className="text-default-400" />
                  </Button>
                </Tooltip>
                <Tooltip color="danger" content="Delete item">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => handleDelete(item.id)}
                    isLoading={loadingId === item.id}
                  >
                    <Trash2 size={18} />
                  </Button>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
