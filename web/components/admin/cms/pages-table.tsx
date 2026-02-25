"use client";

import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Tooltip, Alert } from "@heroui/react";
import { Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminPage } from "@/lib/api";
import { useState } from "react";

type Props = {
  pages: AdminPage[];
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
};

export function PagesTable({ pages, deleteAction }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page?")) {
      return;
    }
    
    setLoadingId(id);
    setError(null);
    try {
      const result = await deleteAction(id);
      if (!result.success) {
        setError(result.error || "Failed to delete page");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 pt-4">
          <Alert color="danger" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}
      <Table 
        aria-label="Pages table"
        removeWrapper
        className="min-h-[400px]"
      >
      <TableHeader>
        <TableColumn>Title</TableColumn>
        <TableColumn>Slug</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn>Updated</TableColumn>
        <TableColumn align="end">Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No pages found">
        {pages.map((page) => (
          <TableRow key={page.id}>
            <TableCell>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{page.title}</p>
                <p className="text-xs text-default-400">ID: {page.id}</p>
              </div>
            </TableCell>
            <TableCell>
              <Link 
                href={`/page${page.slug.startsWith('/') ? '' : '/'}${page.slug}`} 
                target="_blank"
                className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
              >
                {page.slug}
                <ExternalLink size={12} />
              </Link>
            </TableCell>
            <TableCell>
              <Chip
                color={page.status === "published" ? "success" : "default"}
                size="sm"
                variant="flat"
              >
                {page.status === "published" ? "Published" : "Draft"}
              </Chip>
            </TableCell>
            <TableCell>
              <p className="text-sm">
                {new Date(page.updated_at).toLocaleDateString()}
              </p>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-2">
                <Tooltip content="Edit page">
                  <Button
                    as={Link}
                    href={`/admin/cms/pages/${page.id}`}
                    isIconOnly
                    size="sm"
                    variant="light"
                  >
                    <Edit size={18} className="text-default-400" />
                  </Button>
                </Tooltip>
                <Tooltip color="danger" content="Delete page">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => handleDelete(page.id)}
                    isLoading={loadingId === page.id}
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
    </div>
  );
}
