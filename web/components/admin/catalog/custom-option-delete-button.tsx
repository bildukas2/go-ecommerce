"use client";

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react";

type CustomOptionDeleteButtonProps = {
  action: (formData: FormData) => Promise<void>;
  optionID: string;
  returnTo: string;
  optionTitle: string;
};

export function CustomOptionDeleteButton({ action, optionID, returnTo, optionTitle }: CustomOptionDeleteButtonProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <Button type="button" color="danger" variant="flat" size="sm" onPress={onOpen}>
        Delete
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Delete custom option</ModalHeader>
              <ModalBody className="text-sm text-foreground/75">
                <p>
                  Are you sure you want to delete <span className="font-medium text-foreground">{optionTitle}</span>?
                </p>
                <p>This action cannot be undone.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <form action={action}>
                  <input type="hidden" name="option_id" value={optionID} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <Button type="submit" color="danger">
                    Delete option
                  </Button>
                </form>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
