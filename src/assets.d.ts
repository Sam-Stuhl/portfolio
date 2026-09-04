// wrangler's "Data" rule turns an imported .pdf into an ArrayBuffer.
declare module "*.pdf" {
  const content: ArrayBuffer;
  export default content;
}

// wrangler's "Text" rule turns an imported .svg into a string.
declare module "*.svg" {
  const content: string;
  export default content;
}
