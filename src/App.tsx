import { Outlet } from "react-router";
import { Box } from "@radix-ui/themes";

export default function App() {
  return (
    <Box p="4">
      <Outlet />
    </Box>
  );
}
