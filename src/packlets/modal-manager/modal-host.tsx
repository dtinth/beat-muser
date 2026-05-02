/**
 * @packageDocumentation
 *
 * React UI host for the ModalManager. Renders the active modal from the
 * manager's stack and handles confirm/cancel and select/cancel interactions.
 */

import { useState, useEffect, useRef } from "react";
import { Dialog, Button, TextField, Text, Box, Flex } from "@radix-ui/themes";
import type { ModalManager, ModalRequest, SelectItem } from "./index";

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
  if (active.type === "select") {
    return <SelectModal request={active} manager={manager} />;
  }

  return null;
}

function InputModal({ request, manager }: { request: ModalRequest; manager: ModalManager }) {
  const [value, setValue] = useState((request as { value?: string }).value);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue((request as { value?: string }).value);
    setError(undefined);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [request.id]);

  const handleConfirm = () => {
    const validate = (request as { validate?: (value: string) => string | undefined }).validate;
    if (validate) {
      const validationError = validate(value ?? "");
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

function SelectModal({ request, manager }: { request: ModalRequest; manager: ModalManager }) {
  const { items, placeholder } = request as { items: SelectItem[]; placeholder?: string };
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [request.id]);

  function handleSelect(item: SelectItem) {
    manager.dismiss(request.id, item);
  }

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && manager.cancel(request.id)}>
      <Dialog.Content maxWidth="560px" style={{ padding: 0, overflow: "hidden" }}>
        <Dialog.Title style={{ display: "none" }}>{request.title}</Dialog.Title>
        <TextField.Root
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? "Search..."}
          size="3"
          style={{
            borderRadius: 0,
            border: "none",
            borderBottom: "1px solid var(--gray-5)",
            background: "transparent",
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              manager.cancel(request.id);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const item = filtered[selectedIndex];
              if (item) handleSelect(item);
            }
          }}
        />
        <Box style={{ maxHeight: 320, overflow: "auto" }}>
          {filtered.map((item, i) => (
            <Box
              key={item.id}
              data-testid={item.testId ?? `select-item-${item.id}`}
              onClick={() => handleSelect(item)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: i === selectedIndex ? "var(--accent-5)" : undefined,
                color: i === selectedIndex ? "var(--accent-11)" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <Text size="2">{item.label}</Text>
              {item.detail && (
                <Text size="1" color="gray">
                  {item.detail}
                </Text>
              )}
            </Box>
          ))}
          {filtered.length === 0 && (
            <Box style={{ padding: 16, textAlign: "center" }}>
              <Text size="2" color="gray">
                No items found
              </Text>
            </Box>
          )}
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
}
