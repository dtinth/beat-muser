/**
 * @packageDocumentation
 *
 * React UI host for the ModalManager. Renders the active modal from the
 * manager's stack and handles confirm/cancel interactions.
 */

import { useState, useEffect, useRef } from "react";
import { Dialog, Button, TextField, Text } from "@radix-ui/themes";
import type { ModalManager, ModalRequest } from "./index";

export function ModalHost({ manager }: { manager: ModalManager }) {
  const [stack, setStack] = useState<ModalRequest[]>([...manager.$stack.get()]);

  useEffect(() => {
    const unsub = manager.$stack.subscribe((value) => setStack([...value]));
    return unsub;
  }, [manager]);

  const active = stack[0];

  if (!active) return null;

  if (active.type === "input") {
    return <InputModal request={active} manager={manager} />;
  }

  return null;
}

function InputModal({ request, manager }: { request: ModalRequest; manager: ModalManager }) {
  const [value, setValue] = useState(request.value);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(request.value);
    setError(undefined);
    // Focus after a short delay to ensure the dialog is mounted
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [request.id]);

  const handleConfirm = () => {
    if (request.validate) {
      const validationError = request.validate(value ?? "");
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    manager.dismiss(request.id, value);
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && manager.cancel(request.id)}>
      <Dialog.Content maxWidth="300px">
        <Dialog.Title>{request.title}</Dialog.Title>
        <TextField.Root
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") manager.cancel(request.id);
          }}
        />
        {error && (
          <Text size="1" color="red" mt="1">
            {error}
          </Text>
        )}
        <Flex gap="2" mt="3" justify="end">
          <Button variant="soft" onClick={() => manager.cancel(request.id)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>OK</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

// Re-export Radix Flex to avoid extra import in the modal component
import { Flex } from "@radix-ui/themes";
