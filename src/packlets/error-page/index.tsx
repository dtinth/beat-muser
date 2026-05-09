/**
 * @packageDocumentation
 *
 * Error boundary page for React Router. Displays a clean error message
 * with a copyable stack trace and a way back home.
 */

import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { Flex, Text, Button, Box } from "@radix-ui/themes";
import { Copy, Home, AlertTriangle } from "lucide-react";

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Something went wrong";
  let message = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = String(error.data ?? "Unknown error");
    console.error("Route error:", error.status, error.data);
  } else if (error instanceof Error) {
    title = error.name;
    message = error.message;
    stack = error.stack;
    console.error("Unhandled error:", error);
  } else {
    console.error("Unknown error:", error);
  }

  const fullTrace = `${title}\n${message}${stack ? `\n\n${stack}` : ""}`;

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="4"
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "var(--gray-1)",
      }}
    >
      <AlertTriangle size={48} color="var(--red-9)" />
      <Text size="6" weight="bold" color="red">
        {title}
      </Text>
      <Text size="3" color="gray" style={{ maxWidth: 480, textAlign: "center" }}>
        {message}
      </Text>

      {stack && (
        <Box
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 720,
            maxHeight: 360,
            overflow: "auto",
            background: "var(--gray-3)",
            borderRadius: 8,
            padding: 16,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <pre style={{ margin: 0, color: "var(--gray-11)" }}>{stack}</pre>
          <Button
            size="1"
            variant="soft"
            style={{ position: "absolute", top: 8, right: 8 }}
            onClick={async () => {
              await navigator.clipboard.writeText(fullTrace);
            }}
          >
            <Copy size={14} />
            Copy
          </Button>
        </Box>
      )}

      <Flex gap="3">
        <Button variant="soft" onClick={() => navigate("/")}>
          <Home size={16} />
          Go Home
        </Button>
        <Button
          variant="soft"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload Page
        </Button>
      </Flex>
    </Flex>
  );
}
