/// <reference types="vite/client" />

declare module "*.css" {
  const src: string;
  export default src;
}

declare module "@radix-ui/themes/styles.css" {
  const src: string;
  export default src;
}
