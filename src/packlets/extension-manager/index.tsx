/**
 * @packageDocumentation
 *
 * Extension management page. Lists installed extension URLs with
 * add/remove controls. Extensions are persisted in localStorage and
 * automatically loaded in the editor.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Box, Button, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { getAllExtensionUrls, addExtensionUrl, removeExtensionUrl } from "../extensions/index.ts";
import { useToast } from "../toast/index.tsx";
import { errorMessage } from "../shared/index.ts";

interface ExtensionInfo {
  url: string;
  name?: string;
}

function getStoredExtensions(): ExtensionInfo[] {
  return getAllExtensionUrls().map((url) => ({ url }));
}

export function ExtensionManagerPage() {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [extensions, setExtensions] = useState<ExtensionInfo[]>(() => getStoredExtensions());
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(() => {
    setExtensions(getStoredExtensions());
  }, []);

  const handleAdd = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;

    if (!URL.canParse(url)) {
      showError({ title: "Invalid URL", description: "Please enter a valid URL." });
      return;
    }

    if (getAllExtensionUrls().includes(url)) {
      showError({
        title: "Already added",
        description: "This extension URL is already in your list.",
      });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest: unknown = await res.json();
      const id =
        typeof manifest === "object" && manifest !== null && "id" in manifest
          ? manifest.id
          : undefined;
      const name =
        typeof manifest === "object" && manifest !== null && "name" in manifest
          ? manifest.name
          : undefined;
      if (typeof id !== "string" || id === "" || typeof name !== "string" || name === "") {
        throw new Error("Manifest missing required fields: id, name");
      }

      const confirmed = window.confirm(
        `Add extension "${name}"?\n\n${url}\n\nOnly add extensions from sources you trust. ` +
          `Extensions can read and modify your project data.`,
      );
      if (!confirmed) {
        setAdding(false);
        return;
      }

      addExtensionUrl(url);
      refresh();
      setUrlInput("");
    } catch (error) {
      showError({
        title: "Failed to add extension",
        description: errorMessage(error),
      });
    } finally {
      setAdding(false);
    }
  }, [urlInput, showError, refresh]);

  const handleRemove = useCallback(
    (url: string) => {
      removeExtensionUrl(url);
      refresh();
    },
    [refresh],
  );

  return (
    <Box p="4" style={{ maxWidth: 600, width: "100%" }}>
      <Flex direction="column" gap="4">
        <Flex align="center" gap="2">
          <Button
            variant="ghost"
            onClick={() => {
              void navigate("/");
            }}
          >
            &larr; Back
          </Button>
          <Heading size="6">Manage Extensions</Heading>
        </Flex>

        <Card
          variant="surface"
          style={{ background: "var(--orange-3)", borderColor: "var(--orange-6)" }}
        >
          <Flex gap="2" align="center">
            <Text size="2" style={{ color: "var(--orange-11)" }}>
              <strong>&#9888; Warning:</strong> Extensions can read and modify your project data.
              Only add extensions from sources you trust.
            </Text>
          </Flex>
        </Card>

        <Flex gap="2" align="center">
          <TextField.Root
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
            }}
            placeholder="Paste extension manifest URL..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) void handleAdd();
            }}
            style={{ flex: 1 }}
          />
          <Button
            onClick={() => {
              void handleAdd();
            }}
            disabled={adding || !urlInput.trim()}
          >
            {adding ? "Adding..." : "Add"}
          </Button>
        </Flex>

        {extensions.length === 0 ? (
          <Text size="2" color="gray">
            No extensions installed. Paste a manifest URL above to add one.
          </Text>
        ) : (
          <Flex direction="column" gap="2">
            {extensions.map((ext) => (
              <Card key={ext.url}>
                <Flex justify="between" align="center" gap="2">
                  <Flex direction="column" style={{ minWidth: 0, flex: 1 }}>
                    <Text
                      size="2"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={ext.url}
                    >
                      {ext.url}
                    </Text>
                  </Flex>
                  <Button
                    variant="ghost"
                    color="red"
                    size="1"
                    onClick={() => {
                      handleRemove(ext.url);
                    }}
                  >
                    Remove
                  </Button>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}
