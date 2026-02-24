"use client";

import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Input, 
  Select, 
  SelectItem,
  Switch,
  Alert
} from "@heroui/react";
import { useState, useEffect } from "react";
import { AdminNavigationItem, AdminPage } from "@/lib/api";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item?: AdminNavigationItem | null;
  pages: AdminPage[];
  onSave: (data: Partial<AdminNavigationItem>) => Promise<void>;
};

export function NavigationItemModal({ 
  isOpen, 
  onOpenChange, 
  item, 
  pages,
  onSave 
}: Props) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"page" | "url">("page");
  const [pageId, setPageId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setLabel(item.label);
      setType(item.type);
      setPageId(item.page_id || "");
      setUrl(item.url || "");
      setOpenInNewTab(item.open_in_new_tab);
      setIsActive(item.is_active);
      setSortOrder(item.sort_order);
    } else {
      setLabel("");
      setType("page");
      setPageId("");
      setUrl("");
      setOpenInNewTab(false);
      setIsActive(true);
      setSortOrder(0);
    }
    setError(null);
  }, [item, isOpen]);

  const handleSubmit = async () => {
    if (!label.trim()) {
      setError("Label is required");
      return;
    }

    if (type === "page" && !pageId) {
      setError("Please select a page");
      return;
    }

    if (type === "url" && !url.trim()) {
      setError("URL is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        label,
        type,
        page_id: type === "page" ? pageId : null,
        url: type === "url" ? url : null,
        open_in_new_tab: openInNewTab,
        is_active: isActive,
        sort_order: sortOrder
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>
              {item ? "Edit Navigation Item" : "Add Navigation Item"}
            </ModalHeader>
            <ModalBody className="flex flex-col gap-4">
              {error && (
                <Alert color="danger" title="Error">
                  {error}
                </Alert>
              )}
              
              <Input
                label="Label"
                placeholder="e.g. About Us"
                value={label}
                onValueChange={setLabel}
                isRequired
              />

              <div className="flex gap-4">
                <Select
                  label="Type"
                  className="flex-1"
                  selectedKeys={[type]}
                  onSelectionChange={(keys) => setType(Array.from(keys)[0] as "page" | "url")}
                >
                  <SelectItem key="page" textValue="Page">Page</SelectItem>
                  <SelectItem key="url" textValue="URL">URL</SelectItem>
                </Select>

                <Input
                  label="Sort Order"
                  type="number"
                  className="w-24"
                  value={sortOrder.toString()}
                  onValueChange={(val) => setSortOrder(parseInt(val) || 0)}
                />
              </div>

              {type === "page" ? (
                <Select
                  label="Select Page"
                  selectedKeys={pageId ? [pageId] : []}
                  onSelectionChange={(keys) => setPageId(Array.from(keys)[0] as string)}
                  isRequired
                >
                  {pages.map((page) => (
                    <SelectItem key={page.id} textValue={page.title}>
                      <div className="flex flex-col">
                        <span>{page.title}</span>
                        <span className="text-tiny text-default-400">{page.slug}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              ) : (
                <Input
                  label="URL"
                  placeholder="e.g. https://example.com"
                  value={url}
                  onValueChange={setUrl}
                  isRequired
                />
              )}

              <div className="flex flex-col gap-4 py-2">
                <Switch 
                  isSelected={isActive} 
                  onValueChange={setIsActive}
                >
                  Active
                </Switch>
                <Switch 
                  isSelected={openInNewTab} 
                  onValueChange={setOpenInNewTab}
                >
                  Open in new tab
                </Switch>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleSubmit} 
                isLoading={loading}
              >
                {item ? "Update" : "Create"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
