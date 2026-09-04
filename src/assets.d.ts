// wrangler's "Data" rule turns an imported .pdf into an ArrayBuffer.
declare module "*.pdf" {
  const content: ArrayBuffer;
  export default content;
}
