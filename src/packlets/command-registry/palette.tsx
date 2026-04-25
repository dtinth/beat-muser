/**
 * @packageDocumentation
 *
 * Command palette UI. Triggered by keyboard shortcut (default: $mod+K).
 * Displays all registered commands with titles, filterable by search.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Box, Text, TextField } from "@radix-ui/themes";
import { CommandRegistry } from "./index";

interface CommandPaletteProps {
  registry: CommandRegistry;
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ registry, open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => {
    const all = registry.getAll().filter((c) => c.title);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((c) => c.title.toLowerCase().includes(q));
  }, [registry, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = commands[selectedIndex];
        if (cmd) {
          cmd.execute();
          onClose();
        }
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, commands, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <Box
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      <Box
        style={{
          width: 560,
          maxWidth: "90vw",
          background: "var(--color-panel)",
          borderRadius: 8,
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
          border: "1px solid var(--gray-5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TextField.Root
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command..."
          size="3"
          style={{
            borderRadius: 0,
            border: "none",
            borderBottom: "1px solid var(--gray-5)",
            background: "transparent",
          }}
        />
        <Box style={{ maxHeight: 320, overflow: "auto" }}>
          {commands.map((cmd, i) => (
            <Box
              key={cmd.id}
              onClick={() => {
                cmd.execute();
                onClose();
              }}
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
              <Text size="2">{cmd.title}</Text>
              {(cmd.shortcut || cmd.shortcutMac) && (
                <Text size="1" color="gray">
                  {cmd.shortcut}
                </Text>
              )}
            </Box>
          ))}
          {commands.length === 0 && (
            <Box style={{ padding: 16, textAlign: "center" }}>
              <Text size="2" color="gray">
                No commands found
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
