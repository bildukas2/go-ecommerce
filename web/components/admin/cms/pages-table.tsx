"use client";

import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Tooltip } from "@heroui/react";
import { Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminPage } from "@/lib/api";

type Props = {
  pages: AdminPage[];
  deleteAction: (formData: FormData) => Promise<void>;
};

export function PagesTable({ pages, deleteAction }: Props) {
  return (
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
                href={page.slug} 
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
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={page.id} />
                  <Tooltip color="danger" content="Delete page">
                    <Button
                      type="submit"
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={(e: any) => {
                        if (!confirm("Are you sure you want to delete this page?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </Tooltip>
                </form>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
