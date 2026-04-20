import { Box, Heading } from "@radix-ui/themes";
import { useParams } from "react-router";

export function ProjectViewPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <Box p="4">
      <Heading size="6">{slug}</Heading>
    </Box>
  );
}
