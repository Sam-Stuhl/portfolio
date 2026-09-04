// wrangler's "Data" rule turns an imported .pdf into an ArrayBuffer.
declare module "*.png" {
  const content: ArrayBuffer;
  export default content;
}

declare module "*.pdf" {
  const content: ArrayBuffer;
  export default content;
}

// wrangler's "Text" rule turns an imported .svg into a string.
declare module "*.svg" {
  const content: string;
  export default content;
}
